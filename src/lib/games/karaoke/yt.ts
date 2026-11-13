// Keyboard Karaoke: playing music videos with YouTube's IFrame Player API (the official embed).
// The video plays inside YouTube's own player, so its audio can't be read by the page (that's the
// browser's cross-origin rule): the game follows the video's clock instead, polling the player's
// current time every frame for the lyrics, the pitch guide and the score.

interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(s: number, allowSeekAhead: boolean): void;
	getCurrentTime(): number;
	getDuration(): number;
	getPlayerState(): number;
	setVolume(v: number): void;
	destroy(): void;
}
interface YTApi {
	Player: new (el: HTMLElement, opts: object) => YTPlayer;
}
// (Not declared on Window globally: the site's reel player has its own typing for YouTube's API.)
const w = () => window as unknown as { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

let loading: Promise<void> | null = null;
function loadApi(): Promise<void> {
	if (w().YT?.Player) return Promise.resolve();
	loading ??= new Promise((resolve, reject) => {
		// (If the site's reel player already asked for the API, wait for its callback too.)
		const prev = w().onYouTubeIframeAPIReady;
		w().onYouTubeIframeAPIReady = () => {
			prev?.();
			resolve();
		};
		const s = document.createElement('script');
		s.src = 'https://www.youtube.com/iframe_api';
		s.onerror = () => {
			loading = null;
			reject(new Error("Couldn't reach YouTube."));
		};
		document.head.appendChild(s);
	});
	return loading;
}

export type VideoState = 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export class Video {
	private p: YTPlayer | null = null;
	state: VideoState = 'loading';
	/** YouTube's player is ready (its methods exist). */
	private ready = false;
	error = '';

	constructor(
		private el: HTMLElement,
		private onState: (s: VideoState) => void
	) {}

	/** `captions`: show the video's own subtitles (YouTube's player draws them; the page can't read them). */
	async load(id: string, captions = false) {
		await loadApi();
		this.p?.destroy();
		this.ready = false;
		this.state = 'loading';
		await new Promise<void>((resolve) => {
			this.p = new (w().YT as YTApi).Player(this.el, {
				videoId: id,
				width: '100%',
				height: '100%',
				// No related videos at the end, plays inline on phones, keyboard off (the game's keys).
				playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 0, ...(captions ? { cc_load_policy: 1 } : {}) },
				events: {
					onReady: () => {
						this.ready = true;
						resolve();
					},
					onStateChange: (e: { data: number }) => {
						const s = e.data == 1 ? 'playing' : e.data == 2 ? 'paused' : e.data == 0 ? 'ended' : this.state;
						if (s != this.state) {
							this.state = s;
							this.onState(s);
						}
					},
					onError: (e: { data: number }) => {
						// 101 / 150: the uploader doesn't allow it to be embedded on other sites.
						this.error = e.data == 101 || e.data == 150 ? "This video can't be played outside YouTube. Try another upload of the song (a lyric video often works)." : 'YouTube could not play this video.';
						this.state = 'error';
						this.onState('error');
						resolve();
					}
				}
			});
		});
	}
	play() {
		if (this.ready) this.p?.playVideo();
	}
	/** The video's volume, 0..100. */
	setVolume(v: number) {
		if (this.ready) this.p?.setVolume(Math.round(Math.max(0, Math.min(100, v))));
	}
	pause() {
		if (this.ready) this.p?.pauseVideo();
	}
	seek(s: number) {
		if (this.ready) this.p?.seekTo(Math.max(0, s), true);
	}
	// YouTube's player only reports its time a few times a second, so read on its own the lyrics
	// would move in steps (and lag). Between reports, while it's playing, the clock runs on.
	private reported = -1;
	private reportedAt = 0;
	get time() {
		// (Until YouTube's player says it's ready, it has none of its methods yet.)
		if (!this.p || !this.ready) return 0;
		const t = this.p.getCurrentTime() ?? 0;
		const now = performance.now();
		if (t != this.reported) {
			this.reported = t;
			this.reportedAt = now;
			return t;
		}
		return this.state == 'playing' ? t + Math.min(0.6, (now - this.reportedAt) / 1000) : t;
	}
	get duration() {
		return this.ready ? (this.p?.getDuration() ?? 0) : 0;
	}
	destroy() {
		this.p?.destroy();
		this.p = null;
		this.ready = false;
	}
}

/** The video id in a YouTube link (watch, youtu.be, shorts, embed), or null. */
export function videoIdFrom(text: string): string | null {
	const t = text.trim();
	if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
	try {
		const u = new URL(t);
		if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null;
		if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
		const v = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1];
		return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
	} catch {
		return null;
	}
}
