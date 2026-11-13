<!--
  Keyboard Karaoke: pick songs from YouTube (search, a link, a playlist or the song book), queue
  them up, and sing. The microphone's pitch is tracked live (pitch.ts) and scored against the
  song's note chart (the pitch guide) or, with lyrics only, on timing and pitch control (score.ts).
  Lyrics are found automatically and kept in time with the video (chart.ts, /api/games/karaoke).
  Rooms: sing with a friend; the host's queue and video clock lead, each singer is scored on their
  own device (so network delay never costs points), and live scores and pitch are shared.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { GameUiProps } from '$lib/games/registry';
	import { gameAudio } from '$lib/games/audio.svelte';
	import { Room, type RoomEvent } from '$lib/games/net';
	import { session } from '$lib/session.svelte';
	import { Mic, noteName, type Heard } from './pitch';
	import { linesAt, parseLRC, parseUltraStar, type Chart, type Line } from './chart';
	import { Scorer, gradeColor, gradeOf, pitchGap, type Live, type Verdict } from './score';
	import { Video, videoIdFrom, type VideoState } from './yt';
	import { Synth } from './synth';
	import { splitParts, type Assign, type Parts, type Who } from './parts';
	import { SONGS, type Song } from './songs';

	let { active, onquit, loggedIn }: GameUiProps = $props();

	// ── Save: best scores, the queue, per-song lyric offsets and charts, settings ──
	const KEY = 'karaoke-save';
	interface Item extends Song {
		channel?: string;
		seconds?: number;
		/** Who queued it (in a room). */
		by?: string;
	}
	interface Save {
		best: Record<string, number>;
		queue: Item[];
		offsets: Record<string, number>;
		charts: Record<string, string>;
		level: 'easy' | 'normal' | 'hard';
		/** Favourite songs, shown in the song book (up to FAV_MAX). */
		favs: Item[];
		/** Scoring on (grades, the health bar, pop-ups), or just singing. */
		scoring: boolean;
		/** The lyrics version picked per song (LRCLIB id), when it isn't the best match. */
		picks: Record<string, number>;
		/** The song's volume (0..100). */
		volume: number;
		/** In a room: split songs into parts for the singers (the host's setting). */
		partsOn: boolean;
	}
	const fresh = (): Save => ({ best: {}, queue: [], offsets: {}, charts: {}, level: 'normal', favs: [], scoring: true, picks: {}, volume: 80, partsOn: true });
	let save = $state<Save>(load());
	function load(): Save {
		try {
			const s: Save = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
			// Scores used to be out of 10,000; they're out of 100 now.
			for (const k in s.best) if (s.best[k] > 100) s.best[k] = Math.round(s.best[k] / 100);
			return s;
		} catch {
			return fresh();
		}
	}
	function persist() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ ...$state.snapshot(save), savedAt: Date.now() }));
		} catch {
			/* storage full or blocked */
		}
	}
	const keyOf = (s: Song) => s.id || `builtin:${s.title}`;
	// How close to the note counts (semitones): lenient, since a video and its lyrics or chart are
	// rarely perfectly in step.
	const TOLERANCE = 1.5;

	// ── Favourites ──
	const FAV_MAX = 100;

	// ── Per-song memory (lyric timing, the lyrics picked), kept small ──
	/**
	 * How many songs' settings are kept. Past this, the oldest go first (first in, first out),
	 * except favourites, which are kept for as long as there are others to clear; if every song
	 * left is a favourite, the oldest of those go.
	 */
	const SONG_MEMORY = 1000;
	function remember<T>(map: Record<string, T>, key: string, value: T): Record<string, T> {
		// Re-added at the end: the newest.
		const out = { ...map };
		delete out[key];
		out[key] = value;
		let excess = Object.keys(out).length - SONG_MEMORY;
		if (excess > 0) {
			const favs = new Set(save.favs.map(keyOf));
			for (const k of Object.keys(out)) {
				if (excess <= 0) break;
				if (k != key && !favs.has(k)) {
					delete out[k];
					excess--;
				}
			}
			for (const k of Object.keys(out)) {
				if (excess <= 0) break;
				if (k != key) {
					delete out[k];
					excess--;
				}
			}
		}
		return out;
	}
	const isFav = (s: Song) => save.favs.some((f) => keyOf(f) == keyOf(s));
	function toggleFav(s: Item) {
		if (isFav(s)) {
			save.favs = save.favs.filter((f) => keyOf(f) != keyOf(s));
			note = `Removed “${s.title}” from favourites`;
		} else if (save.favs.length >= FAV_MAX) {
			note = `Favourites are full (${FAV_MAX}): remove one to add another`;
			return;
		} else {
			// (Kept without who queued it.)
			const { by: _by, ...song } = s;
			void _by;
			save.favs = [...save.favs, song];
			note = `Added “${s.title}” to favourites`;
		}
		persist();
	}

	// ── Screens ──
	type Screen = 'menu' | 'sing' | 'results' | 'room' | 'how';
	let screen = $state<Screen>('menu');
	let tab = $state<'book' | 'search' | 'link'>('book');
	$effect(() => {
		if (active) gameAudio.music(screen == 'sing' ? null : 'karaoke-menu');
	});
	$effect(() => {
		if (!active && screen == 'sing') pauseSong();
	});

	// ── Finding songs ──
	let query = $state('');
	let link = $state('');
	let found = $state<Item[]>([]);
	let finding = $state(false);
	let findErr = $state('');
	async function search(e?: SubmitEvent) {
		e?.preventDefault();
		if (!query.trim()) return;
		await lookup(`search=${encodeURIComponent(query.trim())}`);
	}
	async function fromLink(e: SubmitEvent) {
		e.preventDefault();
		findErr = '';
		const t = link.trim();
		if (/[?&]list=/.test(t) && !/[?&]v=/.test(t)) return lookup(`playlist=${encodeURIComponent(t)}`);
		const id = videoIdFrom(t);
		if (!id) return (findErr = "That doesn't look like a YouTube link.");
		link = '';
		let it: Item = { id, title: 'YouTube video', artist: '' };
		try {
			const d = await (await fetch(`/api/games/karaoke?video=${id}`)).json();
			if (d.video) it = { id, title: d.video.title, artist: d.video.channel, channel: d.video.channel };
		} catch {
			/* queue it untitled */
		}
		enqueue(it);
	}
	async function lookup(q: string) {
		finding = true;
		findErr = '';
		try {
			const r = await fetch(`/api/games/karaoke?${q}`);
			const d = await r.json();
			if (!r.ok) throw new Error(d?.message ?? 'Search failed.');
			found = (d.videos as { id: string; title: string; channel: string; seconds: number }[]).map((v) => ({ ...v, artist: v.channel }));
			if (!found.length) findErr = 'Nothing found. Try other words, or paste a link.';
		} catch (err) {
			findErr = err instanceof Error ? err.message : 'Search failed.';
		}
		finding = false;
	}

	// ── The queue (in a room, the host's queue is everyone's) ──
	function enqueue(it: Item) {
		const item = { ...it, by: room ? me() : undefined };
		if (room && !isHost) {
			send({ k: 'add', item });
			note = `Sent “${item.title}” to the host's queue`;
			return;
		}
		save.queue = [...save.queue, item];
		persist();
		shareQueue();
		note = `Queued “${item.title}”`;
		// Its lyrics, looked up now (the first couple in the queue), so it starts straight away later.
		if (save.queue.indexOf(item) < 3) prefetch([item]);
	}
	function unqueue(i: number) {
		save.queue = save.queue.filter((_, k) => k != i);
		persist();
		shareQueue();
	}
	function moveUp(i: number) {
		if (i <= 0) return;
		const q = [...save.queue];
		[q[i - 1], q[i]] = [q[i], q[i - 1]];
		save.queue = q;
		persist();
		shareQueue();
	}
	let note = $state('');
	$effect(() => {
		if (!note) return;
		const t = setTimeout(() => (note = ''), 2500);
		return () => clearTimeout(t);
	});

	// ── Singing ──
	const mic = new Mic();
	let micErr = $state('');
	// The notes under the lyrics (lyrics found, no microphone…) go away after a few seconds.
	$effect(() => {
		if (!lyricsNote) return;
		const t = setTimeout(() => (lyricsNote = ''), 6000);
		return () => clearTimeout(t);
	});
	$effect(() => {
		if (!micErr) return;
		const t = setTimeout(() => (micErr = ''), 6000);
		return () => clearTimeout(t);
	});
	let video = $state.raw<Video | null>(null);
	let synth: Synth | null = null;
	let videoEl = $state<HTMLDivElement>();
	let lane = $state<HTMLCanvasElement>();
	let song = $state<Item | null>(null);
	let chart = $state<Chart>({ lines: [], notes: [] });
	let lyricsNote = $state('');
	/** Looking up the lyrics before the song starts (the loading screen). */
	let preparing = $state(false);
	// ── Singing in a friend's room: following the host's song ──
	/** The host's song time last heard, and when. */
	let hostSync: { t: number; at: number; playing: boolean } | null = null;
	/** Where the host's song is now (an estimate between their updates). */
	const hostNow = () => (hostSync ? hostSync.t + (hostSync.playing ? (performance.now() - hostSync.at) / 1000 : 0) : 0);
	/** The browser wouldn't start the song without a tap: show the "tap to sing along" button. */
	let needsTap = $state(false);
	function checkStarted() {
		const mine = run;
		setTimeout(() => {
			if (mine != run || screen != 'sing') return;
			if ((synth && synth.blocked) || (video && video.state != 'playing' && hostSync?.playing !== false)) needsTap = true;
		}, 1500);
	}
	// ── Starting together ──
	/** The host has the song loaded and is waiting for the other singer's screen to be ready. */
	let waitingFriend = $state(false);
	/** The joiner is loaded and waiting for the host to start. */
	let waitingHost = $state(false);
	let waitTimer: ReturnType<typeof setTimeout> | undefined;
	/** Both singers in the room right now. */
	const friendHere = () => !!roomView && roomView.players.filter((x) => x?.online).length >= 2;
	/** The joiner said they're ready for this song (maybe before the host had it loaded). */
	let friendReady = '';
	/**
	 * The song's loaded on this screen. Alone: it starts. The host: waits for the other singer (up to
	 * 20 s, or until "Start now"). The joiner: tells the host, and starts when the host does.
	 */
	function ready(mine: number) {
		if (mine != run) return;
		if (!room) return go();
		if (isHost) {
			if (!friendHere()) return go();
			waitingFriend = true;
			// (They were ready first.)
			if (song && friendReady == keyOf(song)) return startTogether();
			waitTimer = setTimeout(() => waitingFriend && startTogether(), 20_000);
		} else {
			waitingHost = true;
			send({ k: 'ready', run: song ? keyOf(song) : '' });
		}
	}
	/** Start the song here. */
	function go() {
		if (synth) synth.play(0);
		else video?.play();
	}
	/** The host: both ready (or not waiting any longer): start, and tell the other singer. */
	function startTogether() {
		if (!waitingFriend) return;
		waitingFriend = false;
		clearTimeout(waitTimer);
		go();
		send({ k: 'play', t: 0 });
		checkStarted();
	}
	/** The tap: start the song (sound allowed now), in step with the host. */
	function tapToSing() {
		needsTap = false;
		const t = hostNow();
		if (synth) synth.play(t);
		else if (video) {
			video.seek(t);
			video.play();
		}
	}
	let introHint = $state(0);
	function useIntroHint() {
		nudge(introHint - offset);
		introHint = 0;
	}
	let offset = $state(0);
	let scorer: Scorer | null = null;
	let live = $state<Live>({ score: 0, sofar: null, pitch: 0, timing: 0, note: null, hit: false, combo: 0 });
	let heard = $state<Heard>({ hz: 0, midi: 0, level: 0, clarity: 0 });
	let songT = $state(0);
	let vstate = $state<VideoState>('loading');
	let paused = $state(false);
	let trail: { t: number; midi: number; hit: boolean }[] = [];
	let theirTrail: { t: number; midi: number }[] = [];
	type Mood = 'great' | 'ok' | 'bad';
	let result = $state<{ score: number; best: boolean; song: Item; theirs?: number; lost?: boolean; scored?: boolean; skipped?: boolean; mood: Mood } | null>(null);
	// Confetti and tomatoes for the results (random, made once per result).
	const confetti = Array.from({ length: 90 }, (_, i) => ({ x: Math.random() * 100, d: Math.random() * 1.2, t: 2.2 + Math.random() * 1.8, c: ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#fb923c', '#fff'][i % 7], r: Math.random() * 360, w: 6 + Math.random() * 6 }));
	const tomatoes = Array.from({ length: 9 }, (_, i) => ({ from: i % 2 ? 110 : -10, x: 38 + Math.random() * 24, y: 34 + Math.random() * 32, d: 0.4 + i * 0.26, r: (Math.random() - 0.5) * 720 }));

	/**
	 * Which song is on, as a counter: each sing() is a new run, and anything still loading for an
	 * older one stops. (The song object can't be compared: stored in state, Svelte wraps it, so a
	 * song that came in from the other singer never equals itself.)
	 */
	let run = 0;
	async function sing(item: Item) {
		const mine = ++run;
		screen = 'sing';
		song = item;
		waitingFriend = false;
		waitingHost = false;
		optsOpen = false;
		rolesOpen = false;
		songsOpen = false;
		lyricPal = null;
		looks = [];
		if (!room) partsOn = false;
		clearTimeout(waitTimer);
		// (A ready from the other singer is for the song they're on: a new start clears it, unless it's this song.)
		if (song && friendReady != keyOf(item)) friendReady = '';
		result = null;
		trail = [];
		theirTrail = [];
		pops = [];
		sparks = [];
		laneMid = 0;
		health = 100;
		healthFx = null;
		beatIdx = -1;
		beatAt = 0;
		lostCrowd = false;
		introHint = 0;
		lyricsNote = '';
		lyricOptions = [];
		lyricPick = 0;
		paused = false;
		needsTap = false;
		micErr = (await mic.start()) ?? '';
		offset = save.offsets[keyOf(item)] ?? item.offset ?? 0;
		// The chart: the song's own, one you've added, or lyrics found online.
		const own = item.chart ?? save.charts[keyOf(item)];
		chart = own ? parseUltraStar(own) : { lines: [], notes: [] };
		applyParts();
		scorer = makeScorer();
		live = scorer.live;
		if (!item.id) {
			synth = new Synth(chart.notes);
			synth.setVolume(save.volume / 100);
			vstate = 'playing';
			ready(mine);
		} else {
			vstate = 'loading';
			// The lyrics first (usually ready already: they're looked up while the song before plays),
			// so the song never starts without them.
			let found: Found | null = null;
			if (!own) {
				preparing = true;
				found = await lyricsFor(item);
				preparing = false;
				if (mine != run || screen != 'sing') return;
			}
			// Meanwhile, get the next songs ready.
			prefetch(save.queue.filter((q) => keyOf(q) != keyOf(item)).slice(0, 2));
			await Promise.resolve();
			if (!videoEl) return;
			const holder = document.createElement('div');
			videoEl.replaceChildren(holder);
			const v = new Video(holder, (s) => {
				vstate = s;
				if (s == 'ended') finish();
				if (isHost && room) send({ k: s == 'paused' ? 'pause' : s == 'playing' ? 'play' : 'state', t: video?.time ?? 0 });
			});
			video = v;
			void readStills(item.id);
			// No synced lyrics: YouTube's own subtitles, if the video has them.
			// (Lyrics found: the video's own subtitles off, so they don't cover or fight the game's.)
			await video.load(item.id, !!found && !found.lyrics?.synced && found.captions ? 'show' : own || found?.lyrics?.synced ? 'hide' : 'auto');
			if (video.state == 'error' || mine != run) return;
			if (found) useLyrics(item, found);
			ready(mine);
		}
	}
	// ── Lyrics: looked up before a song starts, and ahead of time for the songs queued next ──
	interface Found {
		lyrics: { synced: string | null; plain: string | null; artist: string; track: string; duration: number; versions: number; id?: number; options?: LyricsOption[] } | null;
		captions: boolean;
		error?: boolean;
	}
	const lookups = new Map<string, Promise<Found>>();
	/** The lyrics for a song: fetched once, then shared (so queued songs are ready when they come up). */
	function lyricsFor(item: Item): Promise<Found> {
		const k = keyOf(item);
		let p = lookups.get(k);
		if (!p) {
			const q = item.artist && item.title != 'YouTube video'
				? `title=${encodeURIComponent(item.title)}&channel=${encodeURIComponent(item.channel ?? item.artist)}`
				: `title=${encodeURIComponent(item.title)}`;
			p = fetch(`/api/games/karaoke?${q}&seconds=${Math.round(item.seconds ?? 0)}&id=${item.id}`)
				.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
				.then((d) => ({ lyrics: d.lyrics ?? null, captions: !!d.captions }))
				.catch(() => {
					// (Not kept: it's tried again next time.)
					lookups.delete(k);
					return { lyrics: null, captions: false, error: true };
				});
			lookups.set(k, p);
		}
		return p;
	}
	/** Look up the next songs' lyrics now, so there's no wait when they come up. */
	function prefetch(items: Item[]) {
		for (const it of items) if (it.id && !(it.chart ?? save.charts[keyOf(it)])) void lyricsFor(it);
	}
	/** Puts found lyrics in place (and what to tell the singer). */
	interface LyricsOption {
		id: number;
		artist: string;
		track: string;
		duration: number;
		synced: string;
		words: boolean;
	}
	/** The lyric versions found for the song that's on, and the one in use. */
	let lyricOptions = $state<LyricsOption[]>([]);
	let lyricPick = $state(0);
	function useLyrics(item: Item, f: Found) {
		const l = f.lyrics;
		lyricOptions = l?.options ?? [];
		// The version picked last time for this song (if it's still among them), else the best match.
		const picked = lyricOptions.find((o) => o.id == save.picks[keyOf(item)]);
		lyricPick = picked?.id ?? l?.id ?? 0;
		if (l?.synced) {
			chart = { lines: parseLRC(picked?.synced ?? l.synced), notes: [] };
			applyParts();
			scorer = makeScorer();
			live = scorer.live;
			lyricsNote = `Lyrics: ${l.artist} – ${l.track}${l.versions > 1 ? ` (checked against ${l.versions} versions)` : ''}. Out of time? Nudge them, or tap when the first line starts.`;
			// A music video often has an intro the recording doesn't: offer to shift the lyrics by
			// the difference (it could be an outro instead, so it's offered, not done).
			const extra = (video?.duration ?? item.seconds ?? 0) - l.duration;
			if (extra >= 3 && extra <= 45 && !save.offsets[keyOf(item)]) introHint = Math.round(extra * 2) / 2;
		} else if (f.captions) {
			lyricOptions = [];
			lyricsNote = "No synced lyrics we could trust for this one, so YouTube's own subtitles are on instead. You're scored on pitch control.";
		} else if (l?.plain) {
			lyricsNote = "Only unsynced lyrics were found for this one, and the video has no subtitles. You're scored on pitch control.";
		} else if (f.error) {
			lyricsNote = "Couldn't reach the lyrics service. Sing along anyway: you're scored on pitch control.";
		} else lyricsNote = "No lyrics we could trust for this video, and it has no subtitles. Sing along anyway: you're scored on pitch control.";
	}
	/** Switch to another version of the lyrics (remembered for this song). */
	function pickLyrics(id: number) {
		const o = lyricOptions.find((x) => x.id == id);
		if (!o || !song) return;
		lyricPick = id;
		chart = { lines: parseLRC(o.synced), notes: [] };
		applyParts();
		scorer = makeScorer();
		live = scorer.live;
		beatIdx = -1;
		save.picks = remember(save.picks, keyOf(song), id);
		persist();
		note = `Lyrics: ${o.artist} – ${o.track}`;
	}
	// ── Jump to the song: past a long intro, to just before the first line ──
	/** A few seconds to get ready before the first line. */
	const READY = 3;
	const firstLineAt = $derived(chart.lines.length ? chart.lines[0].start + offset : null);
	function jumpToSong() {
		if (firstLineAt == null || !video || (room && !isHost)) return;
		video.seek(Math.max(0, firstLineAt - READY));
		video.play();
		note = 'Get ready…';
	}
	function nudge(d: number) {
		setOffset(offset + d);
	}
	/** "The first line starts now": lines the lyrics up with the video (for everyone in the room). */
	function tapSync() {
		const first = chart.lines[0];
		if (!first || !song) return;
		setOffset(clock() - first.start);
	}
	/** Where the lyrics sit against the video; in a room, the same for everyone (the videos play in step). */
	function setOffset(o: number, remote = false) {
		offset = Math.round(o * 100) / 100;
		if (!song) return;
		save.offsets = remember(save.offsets, keyOf(song), offset);
		persist();
		if (room && !remote) send({ k: 'offset', o: offset, run: keyOf(song) });
	}
	const clock = () => (synth ? synth.time : (video?.time ?? 0));
	/** Pause (in a room, for everyone: either singer can). `remote`: the other singer paused it. */
	function pauseSong(remote = false) {
		if (synth) synth.pause();
		else video?.pause();
		paused = true;
		if (room && !remote) send({ k: 'pausereq', paused: true, t: clock() });
	}
	function resumeSong(remote = false) {
		if (synth) synth.resume();
		else video?.play();
		paused = false;
		if (room && !remote) send({ k: 'pausereq', paused: false, t: clock() });
	}
	function stopMedia() {
		synth?.stop();
		synth = null;
		video?.destroy();
		video = null;
	}
	function finish(skipped = false) {
		if (!song || !scorer) return;
		// Skipped: graded on the part you sang (and not counted as a best).
		const score = skipped ? (live.sofar ?? 0) : scorer.final();
		const k = keyOf(song);
		const best = !skipped && save.scoring && (chart.lines.length > 0 || chart.notes.length > 0) && score > (save.best[k] ?? 0);
		if (best) save.best[k] = score;
		// Played: off the front of the queue.
		if (save.queue[0] && keyOf(save.queue[0]) == k) save.queue = save.queue.slice(1);
		persist();
		shareQueue();
		if (room) send({ k: 'done', score });
		// The host ended or skipped it: end it for the other singer too.
		if (room && isHost) send({ k: 'end', skipped });
		// No lyrics (and no chart): nothing to score against, so no grade: just the confetti.
		const words = chart.lines.length > 0 || chart.notes.length > 0;
		const scored = save.scoring && words;
		const mood: Mood = !words ? 'great' : !save.scoring ? 'ok' : score >= 76 ? 'great' : score < 56 ? 'bad' : 'ok';
		result = { score, best: best && words, song, theirs: partner?.done ?? undefined, lost: lostCrowd, scored, skipped, mood };
		// The crowd's verdict: cheers and applause, polite applause, or boos (and tomatoes).
		if (mood == 'great') {
			gameAudio.play('karaoke', 'cheer');
			gameAudio.play('karaoke', 'applause');
		} else if (mood == 'bad') {
			gameAudio.play('karaoke', 'boo');
			for (let i = 0; i < 4; i++) setTimeout(() => screen == 'results' && gameAudio.play('karaoke', 'splat'), 650 + i * 260);
		} else gameAudio.play('karaoke', 'applause');
		if (best) setTimeout(() => gameAudio.play('karaoke', 'best'), 500);
		stopMedia();
		mic.stop();
		screen = 'results';
	}
	// ── Volume ──
	/** The volume before muting (to come back to). */
	let lastVolume = 0;
	function setVolume(v: number) {
		if (save.volume) lastVolume = save.volume;
		save.volume = Math.max(0, Math.min(100, Math.round(v)));
		video?.setVolume(save.volume);
		synth?.setVolume(save.volume / 100);
		persist();
	}
	// The video's volume, once it's ready (and whenever the song changes).
	$effect(() => {
		if (vstate != 'loading' && video) video.setVolume(save.volume);
	});

	// ── Parts: who sings which lines (in a room) ──
	let parts = $state<Parts | null>(null);
	/** This song's split: the host's random seed and setting (sent with the song). */
	let partSeed = 0;
	let partsOn = true;
	const mySeat = () => roomView?.you ?? 0;
	const seatName = (seat: number) => (seat == mySeat() ? 'You' : (roomView?.players[seat]?.name ?? 'your friend'));
	/** Split the lyrics between the singers (in a room with the setting on), else everyone sings it all. */
	/** The song's lines before the split (with the singers' names), to split again when roles change. */
	let baseLines: Line[] = [];
	/** Who has which role (the players' own picks, shared in the room). */
	let assign = $state<Assign>({});
	let rolesOpen = $state(false);
	function applyParts() {
		baseLines = chart.lines;
		splitNow();
	}
	function splitNow() {
		const players = roomView?.players.filter(Boolean).length ?? 0;
		if (!room || !partsOn || players < 2 || !baseLines.length) {
			parts = null;
			return;
		}
		const p = splitParts(baseLines, players, partSeed, $state.snapshot(assign));
		chart = { lines: p.lines, notes: chart.notes };
		parts = p;
	}
	/** Your lines (and the ones everyone sings) and their notes: what you're scored on, and what the crowd reacts to. */
	function myChart() {
		if (!parts) return chart;
		const me = mySeat();
		const lines = chart.lines.filter((_, i) => parts!.who[i] == 'all' || parts!.who[i] == me);
		const notes = chart.notes.filter((n) => lines.some((l) => n.start >= l.start - 0.05 && n.start < l.end + 0.05));
		return { lines, notes };
	}
	function makeScorer() {
		return new Scorer(myChart(), TOLERANCE);
	}
	/** Hand a role to a player (a seat, or -1: everyone), for everyone in the room. (No key: just split again.) */
	function setRole(key: string, seat: number, remote = false) {
		if (key) assign = { ...assign, [key]: seat };
		splitNow();
		scorer?.setChart(myChart());
		if (room && !remote && song) send({ k: 'roles', assign: $state.snapshot(assign), run: keyOf(song) });
	}
	/** The song's really in parts (not everyone singing everything). */
	const split = $derived(!!parts && parts.who.some((w) => w != 'all'));
	/** Whose a line is (for the label over it). */
	const whoOf = (l: Line | null): Who | null => (split && parts && l ? (parts.who[chart.lines.indexOf(l)] ?? null) : null);
	const singerOf = (l: Line | null) => (parts && l ? (parts.singer[chart.lines.indexOf(l)] ?? '') : '');
	/** Your singers (when the lyrics name them). */
	const myCast = $derived(parts ? parts.cast[mySeat()] ?? [] : []);

	// -- Lyric colours: picked to stand out from the video behind them --
	// The video plays in YouTube's own frame, so the page can't see its pixels; but YouTube publishes
	// a few stills from every video (a quarter, half and three quarters of the way in), and those can
	// be read. The band where the lyrics sit is sampled in each, and the lyrics take colours that
	// contrast with the still nearest to now. (A faint outline keeps them readable regardless.)
	type Look = { r: number; g: number; b: number; lum: number; bright: number };
	type Pal = { ink: string; sung: string; ol: string; glow: string };
	let lyricPal = $state<Pal | null>(null);
	let looks = $state.raw<(Look | null)[]>([]);
	const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const lumOf = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
	function sampleStill(url: string): Promise<Look | null> {
		return new Promise((res) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				try {
					// (A missing still comes back as YouTube's small grey placeholder.)
					if (img.naturalWidth < 200) return res(null);
					const W = 64;
					const H = 36;
					const c = document.createElement('canvas');
					c.width = W;
					c.height = H;
					const g = c.getContext('2d', { willReadFrequently: true })!;
					g.drawImage(img, 0, 0, W, H);
					// The lyrics' band: the lower middle of the picture.
					const d = g.getImageData(Math.round(W * 0.1), Math.round(H * 0.5), Math.round(W * 0.8), Math.round(H * 0.42)).data;
					let r = 0;
					let gg = 0;
					let b = 0;
					let lum = 0;
					let bright = 0;
					const n = d.length / 4;
					for (let i = 0; i < d.length; i += 4) {
						r += d[i];
						gg += d[i + 1];
						b += d[i + 2];
						const l = lumOf(d[i], d[i + 1], d[i + 2]);
						lum += l;
						if (l > 0.45) bright++;
					}
					res({ r: r / n, g: gg / n, b: b / n, lum: lum / n, bright: bright / n });
				} catch {
					res(null);
				}
			};
			img.onerror = () => res(null);
			img.src = url;
		});
	}
	async function readStills(id: string) {
		const got = await Promise.all(['mqdefault', 'mq1', 'mq2', 'mq3'].map((f) => sampleStill(`https://i.ytimg.com/vi/${id}/${f}.jpg`)));
		if (song?.id != id) return;
		stillAt = -1;
		looks = got;
	}
	/** Colours for the lyrics over a background like this one. */
	function paletteFor(L: Look): Pal {
		const bg = L.lum;
		// Mostly bright behind the words: dark lyrics with a light edge; otherwise light lyrics.
		const dark = bg > 0.42 || L.bright > 0.55;
		const ink = dark ? '#1a1033' : '#ffffff';
		const options = dark ? ['#be185d', '#6d28d9', '#1d4ed8', '#047857'] : ['#f472b6', '#fde047', '#22d3ee', '#a3e635'];
		// The sung colour: one that stands out from the background, in brightness and in colour
		// (the usual pink, unless the video's pinkish there).
		let best = options[0];
		let bestScore = -1;
		options.forEach((o, i) => {
			const [r, g, b] = hex(o);
			const dist = Math.hypot(r - L.r, g - L.g, b - L.b) / 441;
			const score = contrast(lumOf(r, g, b), bg) * (0.4 + dist) * (i == 0 ? 1.25 : 1);
			if (score > bestScore) [best, bestScore] = [o, score];
		});
		return dark
			? { ink, sung: best, ol: 'rgba(255, 255, 255, 0.55)', glow: 'rgba(255, 255, 255, 0.7)' }
			: { ink, sung: best, ol: 'rgba(0, 0, 0, 0.55)', glow: 'rgba(0, 0, 0, 0.85)' };
	}
	/** Which still is nearest to now (1 to 3: a quarter, half, three quarters in; 0: the thumbnail). */
	let stillAt = -1;
	const stillWant = $derived.by(() => {
		const dur = video?.duration ?? 0;
		const f = dur > 0 ? (songT + offset) / dur : 0;
		return f < 0.375 ? 1 : f < 0.625 ? 2 : 3;
	});
	$effect(() => {
		if (screen != 'sing' || !looks.length) return;
		const want = stillWant;
		const i = looks[want] ? want : looks[0] ? 0 : looks.findIndex(Boolean);
		if (i < 0 || i == stillAt) return;
		stillAt = i;
		lyricPal = paletteFor(looks[i]!);
	});

	/** Phones: the options sheet. */
	let optsOpen = $state(false);
	/** The drawer for queueing songs while one plays. */
	let songsOpen = $state(false);
	/** The song on now (it stays at the front of the queue until it ends). */
	const nowSinging = (q: Item, i: number, inSong: boolean) => inSong && i == 0 && !!song && keyOf(q) == keyOf(song);
	/** Picking an option closes the sheet (the volume and lyric nudges stay open, to keep adjusting). */
	function closeAfter(e: MouseEvent) {
		const b = (e.target as HTMLElement).closest('button');
		if (b && !b.classList.contains('keep') && !b.closest('.sheet-head')) optsOpen = false;
	}

	/** Skip the rest of this song: on to its results (graded on what you sang), then the next. */
	function skipSong() {
		finish(true);
	}
	/** Start this song again from the top, with a fresh score (in a room, for both singers). */
	function restartSong(fromHost = false) {
		if (!song || !scorer || preparing) return;
		if (room && !isHost && !fromHost) return;
		trail = [];
		theirTrail = [];
		pops = [];
		sparks = [];
		health = 100;
		healthFx = null;
		lostCrowd = false;
		beatIdx = -1;
		beatAt = 0;
		scorer = makeScorer();
		live = scorer.live;
		paused = false;
		if (synth) synth.play(0);
		else if (video) {
			video.seek(0);
			video.play();
		}
		if (room && isHost) send({ k: 'restart' });
		note = 'From the top!';
	}
	function leaveSong() {
		stopMedia();
		mic.stop();
		screen = room ? 'room' : 'menu';
	}
	function nextSong() {
		const n = save.queue[0];
		if (!n) return (screen = room ? 'room' : 'menu');
		playFor(n);
	}
	/**
	 * Start a song: alone, just sing it; in a room, for both singers. (The host's game keeps the
	 * song's clock, so a joiner asks the host's game to start it, and it starts on both screens.)
	 */
	function playFor(item: Item) {
		if (!room) return void sing(item);
		if (isHost) return startInRoom(item);
		send({ k: 'req', item: $state.snapshot(item) });
		note = `Starting “${item.title}” for both of you…`;
	}

	// ── The loop: the clock, the microphone, the score, the pitch lane ──
	let raf = 0;
	let lastLive = 0;
	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		if (screen != 'sing' || !scorer) return;
		const t = clock() - offset;
		songT = t;
		heard = mic.read();
		if (!paused && vstate == 'playing') {
			live = scorer.push(t, heard);
			for (const v of scorer.verdicts.splice(0)) popFor(v, now);
			// A beat when the next word / note comes in.
			let i = beatIdx;
			while (i + 1 < onsets.length && onsets[i + 1] <= t) i++;
			if (i != beatIdx) {
				if (i > beatIdx && t - onsets[i] < 0.3) beatAt = now;
				beatIdx = i;
			}
			voiceLvl = Math.round(Math.min(1, voiceLvl * 0.8 + Math.min(1, heard.level * 9) * 0.2) * 100) / 100;
			if (save.scoring && live.hit && now - lastSpark > 70) {
				lastSpark = now;
				sparks.push({ at: now, vx: -40 - Math.random() * 60, vy: (Math.random() - 0.5) * 80, golden: !!live.note?.golden });
			}
			if (heard.midi) trail.push({ t, midi: heard.midi, hit: live.hit });
			while (trail.length && trail[0].t < t - 3) trail.shift();
			if (synth && t + offset > synth.length) finish();
		}
		if (room && now - lastLive > 250) {
			lastLive = now;
			send({ k: 'live', h: Math.round(health), score: live.sofar ?? 0, t: Math.round(t * 100) / 100, m: heard.midi ? Math.round(heard.midi * 10) / 10 : 0 });
		}
		draw(t);
	}
	// Pop-ups: a word when a note (or line) is sung well, and sparkles while you're on pitch.
	let pops: { at: number; text: string; color: string; midi: number | null }[] = [];
	let sparks: { at: number; vx: number; vy: number; golden: boolean }[] = [];
	let lastSpark = 0;
	let laneMid = 0;
	let health = $state(100);
	let healthFx = $state<{ kind: 'up' | 'down'; at: number } | null>(null);
	/** The last beat (a word or note starting), and your voice's loudness (0..1), for the bar. */
	let beatAt = $state(0);
	let voiceLvl = $state(0);
	let beatIdx = -1;
	/** When each word / syllable / note starts: the song's rhythm, as far as the game knows it. */
	const onsets = $derived((chart.notes.length ? chart.notes.map((n) => n.start) : chart.lines.flatMap((l) => l.parts.map((p) => p.t))).sort((a, b) => a - b));
	let lostCrowd = $state(false);
	function popFor(v: Verdict, now: number) {
		if (!save.scoring) return;
		// Lines (lyrics only) are fewer and longer than notes, so each counts for more.
		const k = v.midi == null ? 2 : 1;
		const change = v.frac >= 0.85 ? (v.golden ? 8 : 5) : v.frac >= 0.6 ? 3 : v.frac >= 0.35 ? 1 : -6;
		health = Math.max(0, Math.min(100, health + change * k));
		healthFx = { kind: change >= 0 ? 'up' : 'down', at: now };
		if (health <= 0 && !lostCrowd) {
			lostCrowd = true;
			pops.push({ at: now, text: 'Lost the crowd!', color: '#f87171', midi: null });
		}
		const [text, color] =
			v.frac >= 0.85 ? [v.golden ? 'GOLDEN!' : 'Perfect!', v.golden ? '#fde047' : '#4ade80'] :
			v.frac >= 0.6 ? ['Great!', '#86efac'] :
			v.frac >= 0.35 ? ['Good', '#a5b4fc'] :
			['', ''];
		if (text) pops.push({ at: now, text, color, midi: v.midi });
	}

	/** The pitch lane: upcoming notes scroll right to left past the "now" line; your voice is the trail. */
	function draw(t: number) {
		const c = lane;
		if (!c) return;
		const w = c.clientWidth;
		const h = c.clientHeight;
		if (c.width != w * devicePixelRatio) {
			c.width = w * devicePixelRatio;
			c.height = h * devicePixelRatio;
		}
		const g = c.getContext('2d')!;
		g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
		g.clearRect(0, 0, w, h);
		const SPAN = 6;
		const nowX = w * 0.28;
		const x = (s: number) => nowX + ((s - t) / SPAN) * w;
		// The range of pitches shown: the song's notes, or where you've been singing.
		const notes = chart.notes.filter((n) => n.end > t - 2 && n.start < t + SPAN);
		const pool = notes.length ? notes.map((n) => n.midi) : trail.map((p) => p.midi);
		const want = pool.length ? (Math.min(...pool) + Math.max(...pool)) / 2 : 60;
		// Eased, so the lane glides to a new range instead of jumping when new notes come in.
		laneMid = laneMid ? laneMid + (want - laneMid) * 0.04 : want;
		const mid = laneMid;
		const lo = mid - 9;
		const hi = mid + 9;
		const y = (m: number) => h - 14 - ((m - lo) / (hi - lo)) * (h - 28);
		// Semitone grid, with C's named.
		g.font = '600 10px system-ui, sans-serif';
		for (let m = Math.ceil(lo); m <= hi; m++) {
			const isC = ((m % 12) + 12) % 12 == 0;
			g.strokeStyle = isC ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)';
			g.beginPath();
			g.moveTo(0, y(m));
			g.lineTo(w, y(m));
			g.stroke();
			if (isC) {
				g.fillStyle = 'rgba(255,255,255,0.4)';
				g.fillText(noteName(m), 4, y(m) - 3);
			}
		}
		// Your voice is drawn in the octave nearest the song (so any voice can follow the guide).
		const fold = (m: number, target: number) => m + 12 * Math.round((target - m) / 12);
		const ref = live.note?.midi ?? notes.find((n) => n.start > t)?.midi ?? mid;
		// With lyrics only: the words along the bottom, where they're sung (a timing guide; a note
		// chart adds the pitches).
		if (!chart.notes.length) {
			g.font = '700 12px system-ui, sans-serif';
			for (const l of chart.lines)
				if (l.end > t - 2 && l.start < t + SPAN)
					for (const p of l.timed ? l.parts : [{ t: l.start, end: l.end, text: l.text }]) {
						const x0 = x(p.t);
						const x1 = x(p.end);
						if (x1 < 0 || x0 > w) continue;
						const on = t >= p.t && t < p.end;
						g.fillStyle = on ? 'rgba(240,171,252,0.55)' : 'rgba(129,140,248,0.22)';
						g.beginPath();
						g.roundRect(x0, h - 30, Math.max(3, x1 - x0 - 3), 22, 6);
						g.fill();
						g.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.75)';
						g.fillText(p.text.trim(), x0 + 4, h - 15, Math.max(10, x1 - x0 - 6));
					}
		}
		// The notes to sing, with their words underneath.
		let textEnd = -1e9;
		g.font = '700 12px system-ui, sans-serif';
		for (const n of notes) {
			const word = n.text.trim();
			if (!word) continue;
			const tx = Math.max(x(n.start), textEnd + 3);
			const on = t >= n.start && t < n.end;
			g.fillStyle = on ? '#fff' : t >= n.end ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
			g.fillText(word, tx, y(n.midi) + 20);
			textEnd = tx + g.measureText(word).width;
		}
		for (const n of notes) {
			const x0 = x(n.start);
			const x1 = x(n.end);
			const on = t >= n.start && t < n.end;
			g.fillStyle = n.free ? 'rgba(148,163,184,0.25)' : n.golden ? (on ? '#fde047' : 'rgba(250,204,21,0.6)') : on ? '#a5b4fc' : 'rgba(129,140,248,0.45)';
			const r = 6;
			g.beginPath();
			g.roundRect(x0, y(n.midi) - r, Math.max(4, x1 - x0 - 2), r * 2, r);
			g.fill();
			if (on && live.hit) {
				g.shadowColor = n.golden ? '#fde047' : '#4ade80';
				g.shadowBlur = 16;
				g.fill();
				g.shadowBlur = 0;
			}
		}
		// Your friend's voice (in a room), a little behind (it travels over the network).
		g.fillStyle = 'rgba(244,114,182,0.7)';
		for (const p of theirTrail) if (p.t > t - 3 && p.t <= t + 0.5) g.fillRect(x(p.t) - 1.5, y(fold(p.midi, ref)) - 1.5, 3, 3);
		// Your voice.
		for (const p of trail) {
			g.fillStyle = p.hit ? '#4ade80' : '#f8fafc';
			g.beginPath();
			g.arc(x(p.t), y(fold(p.midi, ref)), 2.4, 0, Math.PI * 2);
			g.fill();
		}
		// Now.
		g.strokeStyle = 'rgba(255,255,255,0.7)';
		g.lineWidth = 2;
		g.beginPath();
		g.moveTo(nowX, 6);
		g.lineTo(nowX, h - 6);
		g.stroke();
		g.lineWidth = 1;
		const youY = heard.midi ? y(fold(heard.midi, ref)) : h / 2;
		if (heard.midi) {
			g.fillStyle = live.hit ? '#4ade80' : '#f8fafc';
			g.beginPath();
			g.arc(nowX, youY, 6, 0, Math.PI * 2);
			g.fill();
		}
		const now = performance.now();
		// Sparkles: fly back off the "now" line while you hold the note.
		sparks = sparks.filter((p) => now - p.at < 450);
		for (const p of sparks) {
			const k = (now - p.at) / 450;
			g.globalAlpha = 1 - k;
			g.fillStyle = p.golden ? '#fde047' : '#86efac';
			const sx = nowX + p.vx * k;
			const sy = youY + p.vy * k;
			g.beginPath();
			g.arc(sx, sy, 2.5 * (1 - k) + 0.5, 0, Math.PI * 2);
			g.fill();
		}
		// Pop-ups: grow in, float up, fade out, just behind the "now" line.
		pops = pops.filter((p) => now - p.at < 900);
		g.textAlign = 'center';
		for (const p of pops) {
			const k = (now - p.at) / 900;
			const scale = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5);
			g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
			g.font = `900 ${Math.round(18 * scale)}px system-ui, sans-serif`;
			g.fillStyle = p.color;
			g.shadowColor = p.color;
			g.shadowBlur = 10;
			const py = (p.midi != null ? y(fold(p.midi, ref)) : h / 2) - 14 - k * 26;
			g.fillText(p.text, nowX - 40, Math.max(18, py));
			g.shadowBlur = 0;
		}
		g.textAlign = 'left';
		g.globalAlpha = 1;
	}

	const lyric = $derived(linesAt(chart.lines, songT));
	/** How far through each word / syllable of a line you are (0..1), for the colour wipe. */
	const wipe = (l: Line, i: number) => {
		const p = l.parts[i];
		return Math.max(0, Math.min(1, (songT - p.t) / Math.max(0.05, p.end - p.t)));
	};

	// ── Rooms: sing with a friend ──
	let room = $state.raw<Room | null>(null);
	let roomView = $state<{ code: string; you: number; phase: string; players: ({ name: string; online: boolean } | null)[] } | null>(null);
	let roomErr = $state('');
	let joinCode = $state('');
	let busy = $state(false);
	let partner = $state<{ score: number; h: number; done: number | null } | null>(null);
	const isHost = $derived(roomView?.you == 0);
	const me = () => session.playerName || 'You';
	const theirName = $derived(roomView?.players[roomView.you == 0 ? 1 : 0]?.name ?? 'your friend');
	function send(msg: Record<string, unknown>) {
		void room?.send({ type: 'relay', msg });
	}
	function shareQueue() {
		if (room && isHost) send({ k: 'queue', q: $state.snapshot(save.queue) });
	}
	async function createRoom() {
		busy = true;
		roomErr = '';
		const r = await Room.create('karaoke');
		busy = false;
		if ('error' in r) return (roomErr = r.error);
		openRoom(r.code);
	}
	async function joinRoom(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		roomErr = '';
		const code = joinCode.replace(/\D/g, '');
		const r = await Room.join(code, 'karaoke');
		busy = false;
		if ('error' in r) return (roomErr = r.error);
		openRoom(code);
	}
	function openRoom(code: string) {
		room = new Room(code, onRoom);
		room.listen();
		partner = null;
	}
	function leaveRoom() {
		room?.leave();
		room = null;
		roomView = null;
		partner = null;
		if (screen == 'sing') leaveSong();
		screen = 'menu';
	}
	function onRoom(e: RoomEvent) {
		if (e.t == 'room') {
			const was = roomView?.phase;
			roomView = e as unknown as NonNullable<typeof roomView>;
			if (roomView.phase == 'playing' && was != 'playing') {
				partner = { score: 0, h: 100, done: null };
				shareQueue();
			}
		} else if (e.t == 'relay') onRelay(e.msg as Record<string, unknown>);
		else if (e.t == 'left') roomErr = `${theirName} left the room.`;
		else if (e.t == 'closed') {
			room = null;
			roomView = null;
			if (screen == 'room') screen = 'menu';
		}
	}
	function onRelay(m: Record<string, unknown>) {
		const k = m.k;
		if (k == 'queue' && !isHost && Array.isArray(m.q)) save.queue = m.q as Item[];
		else if (k == 'add' && isHost && m.item) {
			save.queue = [...save.queue, m.item as Item];
			persist();
			shareQueue();
			note = `${theirName} queued “${(m.item as Item).title}”`;
		} else if (k == 'pausereq' && screen == 'sing') {
			// The other singer paused (or carried on): the same here.
			if (m.paused && !paused) {
				pauseSong(true);
				note = `${theirName} paused`;
			} else if (!m.paused && paused) {
				resumeSong(true);
				note = `${theirName} carried on`;
			}
		} else if (k == 'ready' && isHost) {
			// The joiner's loaded: start together.
			friendReady = String(m.run ?? '');
			if (waitingFriend && song && m.run == keyOf(song)) startTogether();
		} else if (k == 'req' && isHost && m.item) {
			// The joiner wants to sing this: start it for both (or queue it, if a song is on).
			const item = m.item as Item;
			if (screen == 'sing') {
				save.queue = [item, ...save.queue];
				persist();
				shareQueue();
				note = `${theirName} wants to sing “${item.title}” next`;
			} else startInRoom(item);
		} else if (k == 'start' && !isHost && m.item) {
			partSeed = Number(m.seed) || 0;
			partsOn = m.parts !== false;
			assign = {};
			partner = { score: 0, h: 100, done: null };
			void sing(m.item as Item);
		} else if (k == 'roles' && song && m.run == keyOf(song) && m.assign && typeof m.assign == 'object') {
			// The other singer handed a role round.
			const a: Assign = {};
			for (const [key, v] of Object.entries(m.assign as Record<string, unknown>)) if (typeof v == 'number') a[key] = v;
			assign = a;
			setRole('', 0, true);
			note = `${theirName} changed the roles`;
		} else if (k == 'offset' && song && m.run == keyOf(song) && Number.isFinite(Number(m.o))) {
			// The other singer lined the lyrics up: the same here.
			setOffset(Number(m.o), true);
			note = `${theirName} lined the lyrics up (${offset > 0 ? '+' : ''}${offset.toFixed(1)}s)`;
		} else if (k == 'live' && partner) {
			partner.score = Number(m.score) || 0;
			partner.h = Math.max(0, Math.min(100, Number(m.h ?? 100)));
			if (Number(m.m)) theirTrail.push({ t: Number(m.t), midi: Number(m.m) });
			while (theirTrail.length > 60) theirTrail.shift();
		} else if (k == 'restart' && !isHost && screen == 'sing') {
			restartSong(true);
		} else if (k == 'end' && !isHost && screen == 'sing') {
			finish(!!m.skipped);
		} else if (k == 'done' && partner) {
			partner.done = Number(m.score) || 0;
			if (result) result.theirs = partner.done;
		} else if (!isHost && (k == 'play' || k == 'pause' || k == 'state' || k == 'sync')) {
			// Follow the host's song: play / pause with it, and catch up if we drift apart.
			const ht = Number(m.t) || 0;
			const playing = k == 'play' || (k == 'sync' && !!m.playing);
			const stopped = k == 'pause' || (k == 'sync' && !m.playing);
			hostSync = { t: ht, at: performance.now(), playing: !stopped };
			if (!waitingHost && !needsTap) paused = stopped;
			// The host has started: off we go (and if the browser won't play it, a tap will).
			if (waitingHost && playing) {
				waitingHost = false;
				checkStarted();
			}
			// (Still loading, or waiting for the tap: nothing to follow yet.)
			if (waitingHost || needsTap) return;
			if (video) {
				if (stopped) video.pause();
				else if (playing && video.state != 'playing') video.play();
				if (Math.abs(video.time - ht) > 0.4) video.seek(ht + 0.15);
			} else if (synth) {
				if (stopped && !synth.paused) synth.pause();
				else if (playing && (synth.paused || !synth.started || Math.abs(synth.time - ht) > 0.4)) synth.play(ht + 0.05);
				if (synth.blocked) needsTap = true;
			}
		}
	}
	// The host's video clock, every couple of seconds.
	$effect(() => {
		if (!room || !isHost || screen != 'sing') return;
		const iv = setInterval(() => !waitingFriend && (video || synth) && send({ k: 'sync', t: clock(), playing: !paused }), 2000);
		return () => clearInterval(iv);
	});
	function startInRoom(item: Item) {
		partSeed = Math.floor(Math.random() * 2 ** 31);
		assign = {};
		partsOn = save.partsOn;
		send({ k: 'start', item, seed: partSeed, parts: partsOn });
		void sing(item);
	}

	function onKey(e: KeyboardEvent) {
		if (screen != 'sing' || (e.target as HTMLElement)?.tagName == 'INPUT') return;
		// (Choosing songs: the song's keys are off; Escape goes back to it.)
		if (songsOpen) {
			if (e.code == 'Escape') songsOpen = false;
			return;
		}
		if (e.code == 'Space') {
			e.preventDefault();
			if (paused) resumeSong();
			else pauseSong();
		} else if (e.code == 'ArrowLeft') nudge(-0.1);
		else if (e.code == 'ArrowRight') nudge(0.1);
		else if (e.code == 'KeyT') tapSync();
		else if (e.code == 'KeyN' && (!room || isHost)) skipSong();
		else if (e.code == 'KeyR' && (!room || isHost)) restartSong();
		else if (e.code == 'KeyJ' && (!room || isHost)) jumpToSong();
	}

	// Paste a chart for the song that's on.
	let chartText = $state('');
	let showChart = $state(false);
	function useChart() {
		if (!song || !chartText.trim()) return;
		const c = parseUltraStar(chartText);
		if (!c.notes.length) return (lyricsNote = "That chart didn't have any notes in it (UltraStar .txt format).");
		save.charts[keyOf(song)] = chartText;
		persist();
		chart = c;
		applyParts();
		scorer = makeScorer();
		showChart = false;
		lyricsNote = 'Chart added: the pitch guide is on, and this song now has full scoring.';
	}

	onMount(() => {
		raf = requestAnimationFrame(frame);
		addEventListener('keydown', onKey);
	});
	onDestroy(() => {
		cancelAnimationFrame(raf);
		removeEventListener('keydown', onKey);
		stopMedia();
		mic.stop();
		room?.leave();
	});
	const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

{#snippet star(s: Item)}
	<button class="small ghost star" class:on={isFav(s)} aria-label={isFav(s) ? `Remove ${s.title} from favourites` : `Add ${s.title} to favourites`} aria-pressed={isFav(s)} onclick={() => toggleFav(s)}>{isFav(s) ? '★' : '☆'}</button>
{/snippet}

<!-- Finding songs (the song book, YouTube, a link): on the menu, and in the drawer while a song plays. -->
{#snippet finder(inSong: boolean)}
					<div class="tabs" role="tablist">
						<button role="tab" aria-selected={tab == 'book'} class:on={tab == 'book'} onclick={() => (tab = 'book')}>Song book</button>
						<button role="tab" aria-selected={tab == 'search'} class:on={tab == 'search'} onclick={() => (tab = 'search')}>Search YouTube</button>
						<button role="tab" aria-selected={tab == 'link'} class:on={tab == 'link'} onclick={() => (tab = 'link')}>Paste a link</button>
					</div>
					{#if tab == 'book'}
						{#if SONGS.length}
						<ul class="list">
							{#each SONGS as s (keyOf(s))}
								<li>
									<span class="t"><b>{s.title}</b><small>{s.artist}{s.chart ? ' · pitch guide' : ''}{save.best[keyOf(s)] ? ` · best ${gradeOf(save.best[keyOf(s)])}` : ''}</small></span>
									{@render star(s)}
									<button class="small ghost" onclick={() => enqueue(s)}>Queue</button>
									{#if !inSong}<button class="small" onclick={() => (playFor(s))}>Sing</button>{/if}
								</li>
							{/each}
						</ul>
						{/if}
						<h3 class="sect">★ Favourites <small>{save.favs.length}/{FAV_MAX}</small></h3>
						{#if !save.favs.length}
							<p class="hint">Star songs (☆) in a search, the queue or after singing, and they'll wait here.</p>
						{:else}
							<ul class="list">
								{#each save.favs as s (keyOf(s))}
									<li>
										{#if s.id}<img src="https://i.ytimg.com/vi/{s.id}/default.jpg" alt="" loading="lazy" />{/if}
										<span class="t"><b>{s.title}</b><small>{s.artist || s.channel || ''}{save.best[keyOf(s)] ? ` · best ${gradeOf(save.best[keyOf(s)])}` : ''}</small></span>
										{@render star(s)}
										<button class="small ghost" onclick={() => enqueue(s)}>Queue</button>
										{#if !inSong}<button class="small" onclick={() => (playFor(s))}>Sing</button>{/if}
									</li>
								{/each}
							</ul>
						{/if}
					{:else if tab == 'search'}
						<form class="row" onsubmit={search}>
							<input bind:value={query} placeholder="Song or artist" aria-label="Search YouTube" />
							<button disabled={finding}>{finding ? '…' : 'Search'}</button>
						</form>
						<p class="hint">Tip: add “lyrics” or “karaoke” to find uploads that can be played here.</p>
					{:else}
						<form class="row" onsubmit={fromLink}>
							<input bind:value={link} placeholder="YouTube video or playlist link" aria-label="YouTube link" />
							<button disabled={finding}>Add</button>
						</form>
						<p class="hint">A playlist link lists its songs below, to queue one by one.</p>
					{/if}
					{#if findErr}<p class="err">{findErr}</p>{/if}
					{#if tab != 'book' && found.length}
						<ul class="list">
							{#each found as v (v.id)}
								<li>
									<img src="https://i.ytimg.com/vi/{v.id}/default.jpg" alt="" loading="lazy" />
									<span class="t"><b>{v.title}</b><small>{v.channel ?? ''}{v.seconds ? ` · ${mmss(v.seconds)}` : ''}</small></span>
									{@render star(v)}
									<button class="small ghost" onclick={() => enqueue(v)}>Queue</button>
								</li>
							{/each}
						</ul>
					{/if}
{/snippet}
<!-- The queue. -->
{#snippet upNext(inSong: boolean)}
					{#if !save.queue.length}
						<p class="hint">Nothing queued yet.</p>
					{:else}
						<ol class="list">
							{#each save.queue as q, i (i + q.id + q.title)}
								<li>
									<span class="t"><b>{q.title}</b><small>{nowSinging(q, i, inSong) ? 'Now singing · ' : ''}{q.artist || q.channel || ''}{q.by ? ` · ${q.by}` : ''}</small></span>
									{@render star(q)}
									{#if (!room || isHost) && !nowSinging(q, i, inSong)}
										<button class="small ghost" aria-label="Move up" disabled={i == 0} onclick={() => moveUp(i)}>↑</button>
										<button class="small ghost" aria-label="Remove" onclick={() => unqueue(i)}>✕</button>
									{/if}
								</li>
							{/each}
						</ol>
						{#if !inSong}<button class="go" onclick={nextSong}>Sing the next song ▶</button>{/if}
					{/if}
{/snippet}

<div class="kk">
	{#if note}<div class="toast">{note}</div>{/if}
	{#if screen == 'menu'}
		<div class="menu-fx" aria-hidden="true">
			<div class="lights"><i></i><i></i></div>
			{#each ['♪', '♫', '♩', '♬', '♪', '♫', '♬', '♩', '♪', '♫'] as n, i (i)}<span class="float" style="left:{6 + i * 9.5}%; animation-delay:{(i * 1.37) % 9}s; animation-duration:{9 + (i % 4) * 2}s">{n}</span>{/each}
			<div class="eq floor">{#each Array(48) as _, i (i)}<i style="animation-delay:{((i * 7) % 11) * 0.09}s"></i>{/each}</div>
		</div>
		<div class="menu">
			<header class="top">
				<h1 class="logo" aria-label="Keyboard Karaoke">
					<span class="logo-mic" aria-hidden="true"><i></i></span>
					<span class="logo-words" aria-hidden="true">
						<span class="logo-kb">KEYBOARD</span>
						<span class="logo-ko">Karaoke</span>
						<span class="logo-keys"></span>
					</span>
				</h1>
				<p class="sub">Queue songs from YouTube and sing. Your pitch and timing are scored live.</p>
			</header>
			<div class="cols">
				<section class="find">
					{@render finder(false)}
				</section>
				<section class="queue">
					<h2>Up next {#if room}<small>· room {roomView?.code}</small>{/if}</h2>
					{@render upNext(false)}
					<label class="toggle">
						<input type="checkbox" bind:checked={save.scoring} onchange={persist} />
						<span>Scoring {save.scoring ? 'on: grades, health and pop-ups' : 'off: just sing'}</span>
					</label>
					{#if room && isHost}
						<label class="toggle">
							<input type="checkbox" bind:checked={save.partsOn} onchange={persist} />
							<span>Parts {save.partsOn ? 'on: you each get your own lines' : 'off: you both sing everything'}</span>
						</label>
					{/if}
					<div class="foot">
						{#if room}
							<button class="ghost small" onclick={() => (screen = 'room')}>Room</button>
						{:else}
							<button class="ghost small" onclick={() => (screen = 'room')}>Sing with a friend</button>
						{/if}
						<button class="ghost small" onclick={() => (screen = 'how')}>How it works</button>
						<button class="ghost small" onclick={onquit}>Quit</button>
					</div>
				</section>
			</div>

		</div>
	{:else if screen == 'sing' && song}
		<div class="stage" style="--lvl:{voiceLvl}; --hp:{save.scoring ? health / 100 : 1}">
			<div class="video" class:hidden={!song.id} bind:this={videoEl}></div>
			{#if waitingFriend && !preparing}
				<div class="loading tap">
					<div class="spin" aria-hidden="true">
						{#each Array(5) as _, i (i)}<i style="animation-delay:{i * 0.12}s"></i>{/each}
					</div>
					<b>Waiting for {theirName}…</b>
					<small>“{song.title}” starts for both of you as soon as they're ready.</small>
					{#if myCast.length}<small class="cast">You're singing {myCast.join(', ')}</small>{:else if parts}<small class="cast">You'll take turns: your lines are marked</small>{/if}
					<button class="small ghost" onclick={startTogether}>Start now</button>
				</div>
			{:else if waitingHost && !preparing}
				<div class="loading tap">
					<div class="spin" aria-hidden="true">
						{#each Array(5) as _, i (i)}<i style="animation-delay:{i * 0.12}s"></i>{/each}
					</div>
					<b>Ready!</b>
					<small>Starting “{song.title}” with {theirName}…</small>
					{#if myCast.length}<small class="cast">You're singing {myCast.join(', ')}</small>{:else if parts}<small class="cast">You'll take turns: your lines are marked</small>{/if}
				</div>
			{:else if needsTap && !preparing}
				<div class="loading tap">
					<b>{theirName} started “{song.title}”</b>
					<button class="tapbtn" onclick={tapToSing}>▶ Tap to sing along</button>
					<small>Your browser needs a tap before it plays sound.</small>
				</div>
			{:else if preparing || (song.id && vstate == 'loading')}
				<div class="loading" role="status">
					<div class="spin" aria-hidden="true">
						{#each Array(5) as _, i (i)}<i style="animation-delay:{i * 0.12}s"></i>{/each}
					</div>
					<b>{song.title}</b>
					<small>{preparing ? 'Finding the lyrics and lining them up…' : 'Cueing up the video…'}</small>
				</div>
			{/if}
			{#if !song.id}<div class="warm"><span>🎹</span><b>{song.title}</b><small>Warm-up · sing along with the piano</small><span class="eq" aria-hidden="true">{#each Array(16) as _, i (i)}<i style="animation-delay:{(i * 0.13) % 0.9}s"></i>{/each}</span></div>{/if}
			<div class="lights" aria-hidden="true"><i></i><i></i></div>
			<!-- The sound waves along the floor, like the menu's: taller and brighter as you sing. -->
			<div class="eq floor stage-eq" aria-hidden="true">{#each Array(48) as _, i (i)}<i style="animation-delay:{((i * 7) % 11) * 0.09}s"></i>{/each}</div>
			<div class="edge" aria-hidden="true"></div>

			<div class="hud">
				{#if save.scoring}
					<!-- The crowd bar: pulses on every word / note (the song's rhythm), glows with your voice,
					     shimmers when you're on fire, strobes red in danger. The grade waits for the end. -->
					<div class="health main" class:danger={health < 25} class:out={health <= 0} class:fire={health >= 85} style="--lvl:{voiceLvl}; --hp:{health / 100}" aria-label="Crowd {Math.round(health)}%">
						<span class="hlabel">{health <= 0 ? 'BOO!' : health < 25 ? 'DANGER' : health >= 85 ? 'ON FIRE' : 'CROWD'}</span>
						<span class="htrack">
							<i style="width:{health}%"><b class="shine"></b></i>
							{#key beatAt}{#if beatAt}<em class="hbeat" style="width:{health}%"></em>{/if}{/key}
							{#key healthFx?.at}{#if healthFx}<em class="hfx {healthFx.kind}"></em>{/if}{/key}
						</span>
						<span class="hpct">{Math.round(health)}</span>
					</div>
					{#if partner}
						<div class="health them" class:danger={partner.h < 25}>
							<span class="hlabel">{theirName.slice(0, 10)}</span>
							<span class="htrack"><i style="width:{partner.h}%"></i></span>
						</div>
					{/if}
				{/if}
				<div class="you">{heard.midi ? noteName(heard.midi) : '—'}{#if live.note}<small> → {noteName(live.note.midi)}{pitchGap(heard.midi, live.note.midi) <= 0.5 && heard.midi ? ' ✓' : ''}</small>{/if}</div>
				{#if save.scoring && live.combo >= 3}{#key live.combo}<div class="combo"><span>🔥</span> {live.combo}s on it!</div>{/key}{/if}
			</div>
			<canvas class="lane" bind:this={lane}></canvas>
			<div class="lyrics" style={lyricPal ? `--ink:${lyricPal.ink}; --sung:${lyricPal.sung}; --ol:${lyricPal.ol}; --glow:${lyricPal.glow}` : undefined}>
				{#if lyric.now}
					{@const w = whoOf(lyric.now)}
					{#if w != null}
						<!-- Whose line it is (when the song's split into parts). -->
						<p class="part" class:mine={w == mySeat()} class:all={w == 'all'}>{w == 'all' ? '🎤 Together' : w == mySeat() ? '🎤 Your turn' : `🎧 ${seatName(w)}'s turn`}{singerOf(lyric.now) && w != 'all' ? ` · ${singerOf(lyric.now)}` : ''}</p>
					{/if}
					{#key beatAt}
						{#if lyric.now.timed}
							<p class="now" class:soon={songT < lyric.now.start} class:theirs={w != null && w != 'all' && w != mySeat()} class:beat={beatAt > 0}>
								{#each lyric.now.parts as p, i (i)}<span class="w" style="--k:{wipe(lyric.now, i)}">{p.text}</span>{/each}
							</p>
						{:else}
							<p class="now whole" class:soon={songT < lyric.now.start} class:theirs={w != null && w != 'all' && w != mySeat()} class:on={songT >= lyric.now.start} class:beat={beatAt > 0}>{lyric.now.text}</p>
						{/if}
					{/key}
					{#if !lyric.now.timed && songT >= lyric.now.start}
						<div class="lineprog" aria-hidden="true"><i style="width:{Math.min(100, ((songT - lyric.now.start) / Math.max(0.5, lyric.now.end - lyric.now.start)) * 100)}%"></i></div>
					{/if}
					{#if lyric.next}
						{@const nw = whoOf(lyric.next)}
						<p class="next">{#if nw != null && nw != w}<span class="nextpart">{nw == 'all' ? 'Together' : nw == mySeat() ? 'You' : seatName(nw)}:</span> {/if}{lyric.next.text}</p>
					{/if}
				{:else if chart.lines.length && songT < chart.lines[0].start}
					<p class="next">♪ {Math.max(0, Math.ceil(chart.lines[0].start - songT))}…</p>
				{/if}
			</div>
			<div class="bar">
				<button class="small" onclick={() => (paused ? resumeSong() : pauseSong())} title={room ? 'Pauses (or carries on) for everyone' : undefined}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
				<button class="small ghost" aria-expanded={songsOpen} onclick={() => (songsOpen = true)} title="Queue more songs (the song keeps playing)">+ Songs</button>
				<!-- Phones: the rest is in a sheet that pops up, and goes away after picking something. -->
				<button class="small ghost optbtn" aria-expanded={optsOpen} onclick={() => (optsOpen = !optsOpen)}>☰ Options</button>
				{#if optsOpen}<button class="shade" aria-label="Close the options" onclick={() => (optsOpen = false)}></button>{/if}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="opts-panel" class:open={optsOpen} onclick={closeAfter}>
				<div class="sheet-head"><b>Options</b><button class="small ghost" aria-label="Close the options" onclick={() => (optsOpen = false)}>✕</button></div>
				<label class="vol" title="Song volume ({save.volume}%)">
					<button class="small ghost keep" aria-label={save.volume ? 'Mute the song' : 'Unmute the song'} onclick={() => setVolume(save.volume ? 0 : lastVolume || 80)}>{save.volume == 0 ? '🔇' : save.volume < 40 ? '🔈' : save.volume < 75 ? '🔉' : '🔊'}</button>
					<input type="range" min="0" max="100" step="1" value={save.volume} oninput={(e) => setVolume(Number((e.currentTarget as HTMLInputElement).value))} aria-label="Song volume" />
				</label>
				{#if song.id}
					<span class="sync">
						Lyrics {offset > 0 ? '+' : ''}{offset.toFixed(1)}s
						<button class="small ghost keep" aria-label="Lyrics earlier" onclick={() => nudge(-0.25)}>−</button>
						<button class="small ghost keep" aria-label="Lyrics later" onclick={() => nudge(0.25)}>+</button>
						{#if chart.lines.length}<button class="small ghost" onclick={tapSync} title="Press when the first line starts (T)">Tap: first line now</button>{/if}
					</span>
					{#if lyricOptions.length > 1}
						<label class="pick">
							<span class="vh">Lyrics version</span>
							<select value={lyricPick} onchange={(e) => pickLyrics(Number((e.currentTarget as HTMLSelectElement).value))} title="Other versions of these lyrics">
								{#each lyricOptions as o, i (o.id)}
									<option value={o.id}>{i == 0 ? '★ ' : ''}{o.artist} – {o.track} · {mmss(o.duration)}{o.words ? ' · word by word' : ''}</option>
								{/each}
							</select>
						</label>
					{/if}
					<button class="small ghost" onclick={() => (showChart = !showChart)}>{chart.notes.length ? 'Chart ✓' : 'Add a chart'}</button>
				{/if}
				{#if parts?.roles.length}
					<button class="small ghost" aria-expanded={rolesOpen} onclick={() => (rolesOpen = !rolesOpen)} title="Who sings which part">Roles</button>
				{/if}
				<span class="grow"></span>
				{#if !room || isHost}
					{#if song.id && firstLineAt != null && songT + offset < firstLineAt - READY - 1}
						<button class="small jump" onclick={jumpToSong} title="Skip the intro: to {READY} seconds before the first line (J)">Jump to song ⏩</button>
					{/if}
					<button class="small ghost" onclick={() => restartSong()} title="Start this song again (R)">Restart ↺</button>
					<button class="small ghost" onclick={skipSong} title="Skip to the next song (N)">Skip ⏭</button>
					<button class="small ghost" onclick={() => finish()}>End song</button>
				{/if}
				<button class="small leave" onclick={leaveSong}>Leave</button>
				</div>
			</div>
			{#if songsOpen}
				<!-- Queue songs without leaving this one: it plays on behind. -->
				<button class="drawer-shade" aria-label="Back to the song" onclick={() => (songsOpen = false)}></button>
				<div class="songs-drawer" role="dialog" aria-label="Add songs">
					<div class="drawer-head">
						<b>Add songs</b>
						<button class="small" onclick={() => (songsOpen = false)}>Back to the song</button>
					</div>
					<section class="find">{@render finder(true)}</section>
					<section class="queue">
						<h2>Up next {#if room}<small>· {isHost ? 'your queue' : `${theirName}'s queue`}</small>{/if}</h2>
						{@render upNext(true)}
					</section>
				</div>
			{/if}
			{#if rolesOpen && parts?.roles.length}
				<div class="roles" role="dialog" aria-label="Roles">
					<div class="roles-head"><b>Who sings what</b><button class="small ghost" aria-label="Close the roles" onclick={() => (rolesOpen = false)}>✕</button></div>
					{#each parts.roles as r (r.key)}
						<label class="role">
							<span>{r.label}</span>
							<select value={r.who == 'all' ? -1 : r.who} onchange={(e) => setRole(r.key, Number((e.currentTarget as HTMLSelectElement).value))}>
								{#each roomView?.players ?? [] as pl, i (i)}
									{#if pl}<option value={i}>{i == mySeat() ? 'You' : pl.name}</option>{/if}
								{/each}
								<option value={-1}>Everyone</option>
							</select>
						</label>
					{/each}
					<p class="hint small">Shared: everyone in the room sees the same roles.</p>
				</div>
			{/if}
			{#if lyricsNote || micErr || vstate == 'error'}
				<p class="msg">{vstate == 'error' ? video?.error : micErr || lyricsNote}</p>
			{/if}
			{#if introHint}
				<p class="msg hintbar">
					This video runs {introHint}s longer than the recording the lyrics were timed to (probably an intro).
					<button class="small" onclick={useIntroHint}>Shift lyrics +{introHint}s</button>
					<button class="small ghost" onclick={() => (introHint = 0)}>No</button>
				</p>
			{/if}
			{#if showChart}
				<div class="chartbox">
					<p>Paste an UltraStar chart (.txt) for this song: its notes become the pitch guide. Charts are saved on this device.</p>
					<textarea bind:value={chartText} rows="8" placeholder={'#TITLE:…\n#BPM:…\n#GAP:…\n: 0 4 5 Hel\n: 4 4 7 lo'}></textarea>
					<div class="row"><button class="small ghost" onclick={() => (showChart = false)}>Cancel</button><button class="small" onclick={useChart}>Use chart</button></div>
				</div>
			{/if}
		</div>
	{:else if screen == 'results' && result}
		<div class="verdict {result.mood}" aria-hidden="true">
			{#if result.mood == 'great'}
				{#each confetti as c, i (i)}<i class="conf" style="left:{c.x}%; background:{c.c}; width:{c.w}px; animation-delay:{c.d}s; animation-duration:{c.t}s; --r:{c.r}deg"></i>{/each}
			{:else if result.mood == 'bad'}
				{#each tomatoes as t, i (i)}
					<span class="tomato" style="--fx:{t.from}vw; --x:{t.x}%; --y:{t.y}%; --r:{t.r}deg; animation-delay:{t.d}s">🍅</span>
					<span class="splat" style="left:{t.x}%; top:{t.y}%; animation-delay:{t.d + 0.55}s"></span>
				{/each}
			{/if}
		</div>
		<div class="card results {result.mood}">
			<p class="crowd-says">{result.mood == 'great' ? '👏 The crowd goes wild!' : result.mood == 'bad' ? '🍅 Boooo!' : '👏 Polite applause'}</p>
			<h2>{result.song.title}</h2>
			{#if result.scored}
				{@const g = gradeOf(result.score)}
				<p class="big-grade" style="--g:{gradeColor(g)}">{g}</p>
				{#if result.skipped}<p class="hint">Skipped: graded on the part you sang.</p>{/if}
				<p class="rank">{[result.best ? 'New best!' : save.best[keyOf(result.song)] ? `Best: ${gradeOf(save.best[keyOf(result.song)])}` : '', result.lost ? 'you lost the crowd for a bit' : ''].filter(Boolean).join(' · ')}</p>
			{:else}
				<p class="rank">Nice singing! 🎤</p>
			{/if}
			<p><button class="small ghost" onclick={() => result && toggleFav(result.song)}>{result && isFav(result.song) ? '★ In favourites' : '☆ Add to favourites'}</button></p>
			{#if result.theirs != null}<p class="hint">{theirName}: {gradeOf(result.theirs)}</p>{:else if partner}<p class="hint">Waiting for {theirName}'s score…</p>{/if}
			<div class="row">
				{#if save.queue.length}<button onclick={nextSong}>Next: {save.queue[0].title}</button>{/if}
				<button class="ghost" onclick={() => (screen = room ? 'room' : 'menu')}>{room ? 'Back to the room' : 'Song list'}</button>
			</div>
		</div>
	{:else if screen == 'room'}
		<div class="card wide">
			<header class="row"><h2>Sing with a friend</h2><button class="ghost small" onclick={() => (screen = 'menu')}>‹ Songs</button></header>
			{#if !loggedIn}
				<p class="hint">Log in to make or join a room.</p>
			{:else if !room}
				<p class="hint">Make a room and share its code, or join a friend's. The host picks the songs (you can send them yours), everyone's video stays in time with the host's, and you see each other's score and pitch live.</p>
				<div class="row">
					<button onclick={createRoom} disabled={busy}>Make a room</button>
					<form class="row" onsubmit={joinRoom}>
						<input bind:value={joinCode} inputmode="numeric" maxlength="6" placeholder="6-digit code" aria-label="Room code" />
						<button disabled={busy}>Join</button>
					</form>
				</div>
			{:else}
				<p class="code">Room <b>{roomView?.code ?? '…'}</b></p>
				<ul class="people">
					{#each roomView?.players ?? [] as p, i (i)}
						<li>{p ? `${p.name}${i == 0 ? ' (host)' : ''}${i == roomView?.you ? ' · you' : ''}` : 'Waiting for a friend…'}</li>
					{/each}
				</ul>
				{#if roomView?.phase == 'playing'}
					<p class="hint">Either of you can queue songs and start one: it starts for both of you.</p>
				{#if isHost}
					<label class="toggle">
						<input type="checkbox" bind:checked={save.partsOn} onchange={persist} />
						<span>Split songs into parts: {save.partsOn ? 'each of you gets your own lines (and singers, when the lyrics name them)' : 'you both sing everything'}</span>
					</label>
				{:else}
					<p class="hint small">Parts are the host's choice.</p>
				{/if}
				{/if}
				<div class="row">
					<button class="ghost" onclick={() => (screen = 'menu')}>Songs and queue</button>
					<button class="leave" onclick={leaveRoom}>Leave the room</button>
				</div>
			{/if}
			{#if roomErr}<p class="err">{roomErr}</p>{/if}
			<p class="hint small">Hearing each other isn't on yet: voices over the internet arrive a fraction of a second late, which sounds off against music that's playing in time on each screen. Rooms for more than two are coming too.</p>
		</div>
	{:else if screen == 'how'}
		<div class="card wide how">
			<header class="row"><h2>How it works</h2><button class="ghost small" onclick={() => (screen = 'menu')}>‹ Back</button></header>
			<ul>
				<li><b>Pick songs</b> from the song book, YouTube search, or a pasted video or playlist link, and queue them up.</li>
				<li><b>Sing</b> into your microphone (headphones help, so it hears you, not the song). Nothing is recorded or sent.</li>
				<li><b>The pitch guide</b>: bars scrolling toward the line are the notes to sing; your voice is the trail of dots, green when you're on the note. Any octave counts.</li>
				<li><b>Grades</b> go from S+ down to F. The crowd bar starts full: notes you nail fill it back up, misses drain it. Turn scoring off to just sing.</li>
				<li><b>Lenient on purpose</b>: within 1½ semitones counts, in any octave, and a little early or late is fine (videos and lyrics are rarely perfectly in step).</li>
				<li><b>How it's judged</b>: With a note chart: every moment you're on the right note at the right time (golden notes double). With lyrics only: singing while lines are up, and holding steady notes in key.</li>
				<li><b>Lyrics</b> are found and timed automatically. Music videos often have intros: nudge the lyrics with − / + (or ← / →), or press <kbd>T</kbd> when the first line starts.</li>
				<li><b>Keys</b>: <kbd>Space</kbd> pause, <kbd>←</kbd> <kbd>→</kbd> nudge lyrics, <kbd>T</kbd> tap to sync, <kbd>J</kbd> jump past the intro, <kbd>R</kbd> restart, <kbd>N</kbd> skip.</li>
			</ul>
		</div>
	{/if}
</div>

<style>
	.kk {
		--ink: #f8fafc;
		--muted: #a5b4fc;
		--card: rgba(17, 12, 46, 0.86);
		--accent: #e879f9;
		position: absolute;
		inset: 0;
		overflow: hidden;
		color: var(--ink);
		font: 15px/1.4 system-ui, sans-serif;
		background:
			radial-gradient(1200px 600px at 20% -10%, rgba(232, 121, 249, 0.35), transparent 60%),
			radial-gradient(900px 500px at 110% 110%, rgba(56, 189, 248, 0.3), transparent 60%),
			linear-gradient(160deg, #1e1240, #0b1026);
		user-select: none;
	}
	button {
		font: inherit;
		font-weight: 700;
		border: 0;
		border-radius: 10px;
		padding: 8px 14px;
		background: linear-gradient(135deg, #e879f9, #8b5cf6);
		color: #fff;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button.ghost {
		background: rgba(255, 255, 255, 0.08);
		color: var(--ink);
	}
	button.small {
		padding: 4px 10px;
		font-size: 0.82rem;
	}
	button.leave {
		background: #dc2626;
	}
	input,
	textarea {
		font: inherit;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 10px;
		padding: 8px 12px;
		user-select: text;
		min-width: 0;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.row input {
		flex: 1;
	}
	.hint {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.hint.small {
		font-size: 0.75rem;
		opacity: 0.8;
	}
	.err {
		color: #fca5a5;
		font-size: 0.85rem;
	}
	/* Menu */
	.menu {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 24px 28px;
		gap: 16px;
	}
	/* The logo: a neon sign over a strip of piano keys, with a glowing mic. */
	.logo {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 0;
	}
	.logo-mic {
		position: relative;
		flex: none;
		width: 62px;
		height: 62px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fdf4ff, #e879f9 45%, #7c3aed);
		box-shadow:
			0 0 0 3px rgba(240, 171, 252, 0.35),
			0 0 24px #e879f9;
		animation: mic-bob 2.4s ease-in-out infinite;
	}
	/* The mic's head: a grille in a capsule. */
	.logo-mic i {
		position: absolute;
		left: 50%;
		top: 11px;
		width: 20px;
		height: 30px;
		margin-left: -9px;
		border-radius: 9px;
		background: repeating-linear-gradient(#1e1240 0 2px, #f8fafc 2px 5px);
		box-shadow: 0 0 0 2px #f8fafc;
	}
	.logo-mic i::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: -12px;
		width: 3px;
		height: 10px;
		margin-left: -1.5px;
		background: #f8fafc;
		border-radius: 2px;
	}
	.logo-words {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}
	.logo-kb {
		font: 800 1.05rem/1 ui-monospace, 'Cascadia Code', monospace;
		letter-spacing: 0.55em;
		color: #7dd3fc;
		text-shadow: 0 0 8px rgba(125, 211, 252, 0.8);
	}
	.logo-ko {
		font: italic 900 3.4rem/1 'Brush Script MT', 'Segoe Script', 'Arial Black', cursive;
		color: #fdf4ff;
		letter-spacing: 0.02em;
		margin-top: 2px;
		text-shadow:
			0 0 4px #fff,
			0 0 10px #f0abfc,
			0 0 22px #e879f9,
			0 0 42px #c026d3;
		animation: neon 5s infinite;
	}
	/* A strip of piano keys under the name. */
	.logo-keys {
		margin-top: 6px;
		height: 12px;
		width: 100%;
		border-radius: 2px;
		background:
			repeating-linear-gradient(90deg, transparent 0 7px, #1e1240 7px 11px, transparent 11px 14px) top / 100% 7px no-repeat,
			repeating-linear-gradient(90deg, #f8fafc 0 13px, #c4b5fd 13px 14px);
		box-shadow: 0 0 12px rgba(232, 121, 249, 0.5);
	}
	@keyframes neon {
		0%, 18%, 22%, 60%, 64%, 100% { opacity: 1; }
		20%, 62% { opacity: 0.55; }
	}
	@keyframes mic-bob {
		50% { transform: translateY(-3px) rotate(-6deg); }
	}
	.tiny {
		font-size: 0.75rem;
		margin: -4px 0 0;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}
	.toggle input {
		accent-color: #e879f9;
		width: 16px;
		height: 16px;
	}
	/* The grade, live. */
	@keyframes grade-in {
		from { transform: scale(1.8); opacity: 0; }
	}
	/* The crowd (health) bar: starts full, nailed notes fill it, misses drain it. It pulses on every
	   word / note, glows with your voice, shimmers on fire, strobes in danger. */
	.health {
		--lvl: 0;
		--hp: 1;
		flex: 1;
		min-width: 200px;
		max-width: 560px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 12px;
		border-radius: 14px;
		background: linear-gradient(180deg, rgba(30, 18, 64, 0.92), rgba(10, 8, 30, 0.92));
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			0 0 calc(6px + var(--lvl) * 26px) color-mix(in srgb, #4ade80 calc(var(--hp) * 100%), #ef4444),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transition: box-shadow 0.08s;
	}
	.health.them {
		flex: 0 1 220px;
		min-width: 140px;
		padding: 5px 10px;
		opacity: 0.9;
	}
	.health.them .htrack {
		height: 10px;
	}
	.health.them .htrack i {
		background: linear-gradient(90deg, #f472b6, #c084fc);
	}
	.hlabel {
		font: italic 900 0.72rem system-ui, sans-serif;
		letter-spacing: 0.14em;
		color: #86efac;
		min-width: 62px;
		text-shadow: 0 0 8px currentColor;
	}
	.health.fire .hlabel {
		color: #fde047;
		animation: fire-text 0.6s ease-in-out infinite alternate;
	}
	.health.danger .hlabel,
	.health.out .hlabel {
		color: #f87171;
		animation: blink 0.4s steps(2) infinite;
	}
	.hpct {
		font: 900 0.85rem ui-monospace, monospace;
		min-width: 2.2em;
		text-align: right;
		color: rgba(255, 255, 255, 0.75);
	}
	.htrack {
		position: relative;
		flex: 1;
		height: 20px;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.07);
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
	}
	/* Segments, over the fill. */
	.htrack::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(90deg, transparent 0 calc(5% - 2px), rgba(10, 8, 30, 0.7) calc(5% - 2px) 5%);
		pointer-events: none;
	}
	.htrack i {
		position: absolute;
		inset: 0 auto 0 0;
		overflow: hidden;
		border-radius: 10px;
		background: linear-gradient(90deg, #ef4444, #f59e0b 25%, #facc15 45%, #4ade80 70%, #22d3ee 90%, #a78bfa);
		background-size: 560px 100%;
		/* Louder singing: a brighter bar. */
		filter: brightness(calc(0.9 + var(--lvl) * 0.6)) saturate(calc(1 + var(--lvl) * 0.6));
		transition: width 0.35s cubic-bezier(0.2, 1.3, 0.4, 1);
	}
	/* A highlight sweeping along the fill. */
	.shine {
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.55) 45%, transparent 60%);
		background-size: 200% 100%;
		animation: sweep 1.8s linear infinite;
	}
	/* On fire: the colours cycle and the shine speeds up. */
	.health.fire .htrack i {
		animation: rainbow 1.2s linear infinite;
	}
	.health.fire .shine {
		animation-duration: 0.7s;
	}
	/* In danger: a red strobe. */
	.health.danger .htrack i {
		animation: strobe 0.35s steps(2) infinite;
	}
	/* The beat: each word / note flashes the bar and bumps it. */
	.hbeat {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 10px;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.75));
		mix-blend-mode: screen;
		animation: beat 0.28s ease-out forwards;
	}
	.health:has(.hbeat) .htrack {
		animation: bump 0.22s ease-out;
	}
	/* A flash on each change: white when it fills, red when it drains (with a shake). */
	.hfx {
		position: absolute;
		inset: 0;
		border-radius: 10px;
		animation: hflash 0.45s ease-out forwards;
	}
	.hfx.up {
		background: rgba(255, 255, 255, 0.6);
	}
	.hfx.down {
		background: rgba(248, 113, 113, 0.75);
	}
	.health:has(.hfx.down) {
		animation: shake 0.3s;
	}
	@keyframes sweep {
		from { background-position: 150% 0; }
		to { background-position: -50% 0; }
	}
	@keyframes rainbow {
		to { background-position: 560px 0; }
	}
	@keyframes strobe {
		50% { filter: brightness(1.8) saturate(1.4); }
	}
	@keyframes beat {
		from { opacity: 1; }
		to { opacity: 0; }
	}
	@keyframes bump {
		40% { transform: scaleY(1.25); }
	}
	@keyframes fire-text {
		to { text-shadow: 0 0 14px #f97316, 0 0 4px #fde047; }
	}
	@keyframes hflash {
		to { opacity: 0; }
	}
	@keyframes shake {
		25% { transform: translateX(-4px); }
		75% { transform: translateX(4px); }
	}
	@keyframes blink {
		50% { opacity: 0.45; }
	}
	.big-grade {
		margin: 6px 0 0;
		font: italic 900 6rem/1 'Arial Black', Impact, sans-serif;
		color: var(--g);
		text-shadow:
			0 0 18px var(--g),
			0 6px 0 rgba(0, 0, 0, 0.4);
		animation: grade-in 0.6s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.msg.hintbar {
		bottom: 200px;
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		justify-content: center;
	}
	.sub {
		margin: 4px 0 0;
		color: var(--muted);
	}
	.cols {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		/* (One row, the height that's left: without this the row grows to fit a long queue and
		   pushes the panel off the screen.) */
		grid-template-rows: minmax(0, 1fr);
		gap: 18px;
	}
	.find,
	.queue {
		background: var(--card);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
	}
	.queue h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.queue h2 small {
		color: var(--muted);
		font-weight: 600;
	}
	.tabs {
		display: flex;
		gap: 6px;
	}
	.tabs button {
		background: rgba(255, 255, 255, 0.06);
		color: var(--ink);
	}
	.tabs button.on {
		background: linear-gradient(135deg, #e879f9, #8b5cf6);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		/* Scrolls inside its panel (and gives way to the panel's buttons). */
		flex: 0 1 auto;
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(232, 121, 249, 0.5) transparent;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 0;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.05);
	}
	.list img {
		width: 64px;
		height: 48px;
		object-fit: cover;
		border-radius: 6px;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.t b,
	.t small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.t small {
		color: var(--muted);
	}
	.go {
		margin-top: auto;
	}
	.opts,
	.foot {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}
	.opts span {
		color: var(--muted);
		font-size: 0.85rem;
		margin-right: 4px;
	}
	.star {
		color: #fde047;
		font-size: 1rem;
		line-height: 1;
	}
	.sect {
		margin: 8px 0 0;
		font-size: 0.95rem;
	}
	.sect small {
		color: var(--muted);
		font-weight: 600;
	}
	.of {
		font-size: 0.45em;
		opacity: 0.7;
		margin-left: 2px;
	}
	.toast {
		z-index: 5;
		position: absolute;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(15, 23, 42, 0.92);
		border: 1px solid var(--accent);
		padding: 6px 14px;
		border-radius: 999px;
		font-weight: 700;
		font-size: 0.85rem;
	}
	/* Singing */
	.stage {
		position: absolute;
		inset: 0;
		background: #000;
	}
	.video {
		position: absolute;
		inset: 0;
	}
	.video.hidden {
		display: none;
	}
	.video :global(iframe) {
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.warm {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 6px;
		background: radial-gradient(600px 400px at 50% 40%, #4c1d95, #0b1026);
	}
	.warm span {
		font-size: 4rem;
	}
	.warm b {
		font-size: 1.8rem;
	}
	.warm small {
		color: var(--muted);
	}
	.hud {
		position: absolute;
		top: 12px;
		left: 12px;
		right: 12px;
		z-index: 2;
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	/* The crowd bar: the whole width of the screen. */
	.health.main {
		flex: 1 1 100%;
		max-width: none;
		padding: 10px 16px;
		gap: 14px;
	}
	.health.main .htrack {
		height: 34px;
		border-radius: 17px;
	}
	.health.main .htrack i,
	.health.main .hbeat,
	.health.main .hfx {
		border-radius: 17px;
	}
	.health.main .hlabel {
		font-size: 1rem;
		min-width: 92px;
	}
	.health.main .hpct {
		font-size: 1.2rem;
	}
	.you {
		margin-left: auto;
		padding: 6px 14px;
		border-radius: 12px;
		background: rgba(17, 12, 46, 0.75);
		font: 800 1.3rem ui-monospace, monospace;
	}
	.you small {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.combo {
		padding: 4px 14px;
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(249, 115, 22, 0.35), rgba(250, 204, 21, 0.35));
		border: 1px solid #facc15;
		color: #fde047;
		font: italic 900 0.95rem system-ui, sans-serif;
		box-shadow: 0 0 16px rgba(250, 204, 21, 0.5);
		animation: pop-in 0.3s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.combo span {
		display: inline-block;
		animation: flame 0.4s ease-in-out infinite alternate;
	}
	@keyframes pop-in {
		from { transform: scale(1.5); }
	}
	@keyframes flame {
		to { transform: scale(1.25) rotate(-8deg); }
	}
	/* A friend started the song: one tap to let the browser play it. */
	.loading.tap {
		background: radial-gradient(600px 400px at 50% 45%, rgba(91, 33, 182, 0.92), rgba(11, 16, 38, 0.95));
	}
	.tapbtn {
		font-size: 1.3rem;
		padding: 14px 28px;
		border-radius: 999px;
		box-shadow: 0 0 30px rgba(232, 121, 249, 0.6);
		animation: pop-in 0.4s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	/* Getting a song ready: a bouncing mic-level meter while the lyrics are found. */
	.loading {
		position: absolute;
		inset: 0;
		z-index: 4;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		text-align: center;
		background: radial-gradient(600px 400px at 50% 45%, rgba(91, 33, 182, 0.95), rgba(11, 16, 38, 0.98));
		animation: fade-in 0.25s;
	}
	.loading b {
		font-size: 1.5rem;
		max-width: 80vw;
	}
	.loading small {
		color: var(--muted);
		animation: blink 1.2s ease-in-out infinite;
	}
	.spin {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		height: 56px;
	}
	.spin i {
		width: 12px;
		height: 100%;
		border-radius: 6px;
		background: linear-gradient(0deg, #7c3aed, #f0abfc);
		box-shadow: 0 0 12px #e879f9;
		transform-origin: bottom;
		animation: eq 0.6s ease-in-out infinite alternate;
	}
	@keyframes fade-in {
		from { opacity: 0; }
	}
	/* Stage lights: two beams sweeping over the stage (and the video, softly). */
	.lights {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		mix-blend-mode: screen;
	}
	.lights i {
		position: absolute;
		top: -30%;
		width: 34%;
		height: 160%;
		background: linear-gradient(180deg, rgba(232, 121, 249, 0.32), transparent 75%);
		clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%);
		transform-origin: 50% 0;
		animation: beam 7s ease-in-out infinite alternate;
		opacity: calc(0.35 + var(--lvl, 0) * 0.65);
	}
	.lights i:first-child {
		left: 5%;
	}
	.lights i:last-child {
		right: 5%;
		background: linear-gradient(180deg, rgba(56, 189, 248, 0.32), transparent 75%);
		animation-delay: -3.5s;
		animation-direction: alternate-reverse;
	}
	@keyframes beam {
		from { transform: rotate(-22deg); }
		to { transform: rotate(22deg); }
	}
	/* The screen's edges glow with your voice (green when the crowd's with you, red when not). */
	.edge {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 calc(20px + var(--lvl) * 90px) color-mix(in srgb, #4ade80 calc(var(--hp) * 100%), #ef4444);
		opacity: calc(0.25 + var(--lvl) * 0.75);
		transition: box-shadow 0.1s, opacity 0.1s;
	}
	/* A dancing equalizer (the warm-up stage, and the menu's floor). */
	.eq {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 60px;
	}
	.eq i {
		flex: 1;
		min-width: 6px;
		height: 100%;
		border-radius: 3px 3px 1px 1px;
		background: linear-gradient(0deg, #7c3aed, #e879f9 60%, #fdf4ff);
		transform-origin: bottom;
		animation: eq 0.9s ease-in-out infinite alternate;
	}
	@keyframes eq {
		from { transform: scaleY(0.12); }
		to { transform: scaleY(1); }
	}
	.warm .eq {
		width: min(420px, 80vw);
		margin-top: 18px;
	}
	/* The menu's backdrop: lights, floating notes, the equalizer along the floor. */
	.menu-fx {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.menu-fx .lights i {
		opacity: 0.5;
	}
	.float {
		position: absolute;
		bottom: -40px;
		font-size: 1.6rem;
		color: rgba(240, 171, 252, 0.55);
		text-shadow: 0 0 10px #e879f9;
		animation: float-up linear infinite;
	}
	@keyframes float-up {
		0% { transform: translateY(0) rotate(0); opacity: 0; }
		10% { opacity: 1; }
		100% { transform: translateY(-110vh) rotate(40deg); opacity: 0; }
	}
	.eq.floor {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 70px;
		gap: 3px;
		opacity: 0.35;
	}
	.menu {
		z-index: 1;
	}
	/* In the game: the same waves, under the lyrics, following your voice. */
	.eq.floor.stage-eq {
		height: calc(70px + var(--lvl) * 90px);
		opacity: calc(0.22 + var(--lvl) * 0.5);
		pointer-events: none;
		transition: height 0.12s, opacity 0.12s;
	}
	.list li {
		transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
	}
	.list li:hover {
		transform: translateX(4px);
		background: rgba(232, 121, 249, 0.12);
		box-shadow: inset 3px 0 0 #e879f9;
	}
	button {
		transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
	}
	button:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.12);
		box-shadow: 0 4px 14px rgba(232, 121, 249, 0.35);
	}
	button:not(:disabled):active {
		transform: translateY(1px) scale(0.98);
	}
	.find,
	.queue {
		backdrop-filter: blur(6px);
	}
	/* The lyrics bump on each beat. */
	.now.beat {
		animation: lyric-beat 0.25s ease-out;
	}
	@keyframes lyric-beat {
		40% { transform: scale(1.04); }
	}
	/* Results: the crowd's verdict. */
	.verdict {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 3;
	}
	.card.results {
		z-index: 2;
	}
	.card.results.great {
		border-color: #facc15;
		box-shadow: 0 0 40px rgba(250, 204, 21, 0.35);
		animation: card-in 0.5s cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	.card.results.bad {
		border-color: #ef4444;
		animation: card-in 0.5s ease-out, card-shake 0.3s 0.75s 3;
	}
	/* (Keeps the card's centring while it shakes.) */
	@keyframes card-shake {
		25% { transform: translate(calc(-50% - 6px), -50%); }
		75% { transform: translate(calc(-50% + 6px), -50%); }
	}
	@keyframes card-in {
		from { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
	}
	.crowd-says {
		margin: 0 0 6px;
		font: italic 900 1.1rem system-ui, sans-serif;
		color: #fde047;
	}
	.card.results.bad .crowd-says {
		color: #f87171;
	}
	.conf {
		position: absolute;
		top: -20px;
		height: 12px;
		border-radius: 2px;
		animation: confetti linear forwards;
		transform: rotate(var(--r));
	}
	@keyframes confetti {
		to { transform: translateY(110vh) rotate(calc(var(--r) + 720deg)); }
	}
	/* Tomatoes fly in from the sides and splat on the card. */
	.tomato {
		position: absolute;
		left: var(--fx);
		top: 60%;
		font-size: 2.4rem;
		opacity: 0;
		animation: throw 0.6s cubic-bezier(0.3, 0, 0.6, 1) forwards;
	}
	@keyframes throw {
		0% { opacity: 1; transform: translate(0, 0) rotate(0); }
		55% { transform: translate(calc((var(--x) - var(--fx)) * 0.55), -30vh) rotate(calc(var(--r) * 0.6)); }
		/* (Gone on impact: the splat takes over.) */
		92% { opacity: 1; }
		100% { opacity: 0; left: var(--x); top: var(--y); transform: translate(-50%, -50%) rotate(var(--r)) scale(0.6); }
	}
	.splat {
		position: absolute;
		width: 90px;
		height: 70px;
		margin: -35px 0 0 -45px;
		opacity: 0;
		background: radial-gradient(circle at 50% 50%, #dc2626 0 32%, transparent 33%),
			radial-gradient(circle at 18% 30%, #ef4444 0 10%, transparent 11%),
			radial-gradient(circle at 82% 25%, #b91c1c 0 9%, transparent 10%),
			radial-gradient(circle at 25% 80%, #dc2626 0 8%, transparent 9%),
			radial-gradient(circle at 78% 78%, #ef4444 0 11%, transparent 12%);
		animation: splat 3.2s ease-out forwards;
	}
	/* Splat, drip down a little, fade away (so the buttons are clear again). */
	@keyframes splat {
		0% { opacity: 1; transform: scale(0.2); }
		8% { opacity: 0.85; transform: scale(1); }
		65% { opacity: 0.8; transform: scale(1) translateY(6px); }
		100% { opacity: 0; transform: scale(1) translateY(14px); }
	}
	.lane {
		position: absolute;
		left: 12px;
		right: 12px;
		top: 118px;
		height: 30%;
		width: calc(100% - 24px);
		border-radius: 14px;
		background: rgba(10, 8, 30, 0.72);
		backdrop-filter: blur(4px);
	}
	.lyrics {
		/* The lyrics' colours (picked against the video, when it can be seen): the words, the sung
		part, a faint outline (in case the pick is wrong), and the shadow. */
		--ink: #ffffff;
		--sung: #f472b6;
		--ol: rgba(0, 0, 0, 0.55);
		--glow: rgba(0, 0, 0, 0.85);
		--outline: drop-shadow(1px 0 0 var(--ol)) drop-shadow(-1px 0 0 var(--ol)) drop-shadow(0 1px 0 var(--ol)) drop-shadow(0 -1px 0 var(--ol));
		position: absolute;
		left: 0;
		right: 0;
		bottom: 64px;
		text-align: center;
		padding: 0 20px;
		text-shadow:
			0 2px 0 var(--glow),
			0 0 12px var(--glow);
	}
	.lyrics p {
		margin: 6px 0;
	}
	.now {
		font: 900 clamp(1.4rem, 3vw, 2.4rem) / 1.2 system-ui, sans-serif;
		/* (A drop shadow, not a text shadow: the wipe's text is see-through, and a text shadow would
		show through it and turn the words black.) */
		text-shadow: none;
		filter: var(--outline) drop-shadow(0 2px 0 var(--glow)) drop-shadow(0 0 6px var(--glow));
	}
	.now.soon {
		opacity: 0.75;
	}
	/* On a computer the options sit in the bar; the sheet's parts are for phones. */
	.opts-panel {
		display: contents;
	}
	.optbtn,
	.sheet-head,
	.shade {
		display: none;
	}
	.vol {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.vol input {
		width: 90px;
		accent-color: #e879f9;
	}
	.pick select {
		max-width: 220px;
		font: 600 0.78rem system-ui, sans-serif;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 3px 6px;
	}
	.pick option {
		background: #1e1240;
	}
	.vh {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.jump {
		background: linear-gradient(135deg, #22d3ee, #6366f1);
		animation: pop-in 0.3s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	/* Parts: whose turn it is, just over the line, in the lyrics' own lettering. */
	.part {
		margin: 0 0 2px !important;
		font: 900 clamp(1.05rem, 2.2vw, 1.75rem) / 1.2 system-ui, sans-serif;
		color: var(--ink);
		opacity: 0.8;
		text-shadow: none;
		filter: var(--outline) drop-shadow(0 2px 0 var(--glow)) drop-shadow(0 0 6px var(--glow));
	}
	.part.mine {
		color: var(--sung);
		opacity: 1;
		animation: turn-pulse 1.2s ease-in-out infinite;
	}
	.part.all {
		color: var(--sung);
		opacity: 1;
	}
	@keyframes turn-pulse {
		50% { transform: scale(1.06); }
	}
	/* Queueing songs mid-song: a panel down the right (computers), a sheet from the bottom (phones). */
	.drawer-shade {
		position: absolute;
		inset: 0;
		z-index: 7;
		border: 0;
		border-radius: 0;
		padding: 0;
		background: rgba(5, 3, 20, 0.45);
		box-shadow: none !important;
		transform: none !important;
		cursor: default;
	}
	.songs-drawer {
		position: absolute;
		z-index: 8;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(460px, 100%);
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: linear-gradient(160deg, #1e1240, #0b1026);
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: -12px 0 40px rgba(0, 0, 0, 0.5);
		animation: drawer-in 0.22s ease-out;
	}
	@keyframes drawer-in {
		from { transform: translateX(40px); opacity: 0; }
	}
	.drawer-head {
		position: sticky;
		top: -12px;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: -12px -12px 0;
		padding: 12px;
		background: #1c1140;
		font-size: 1.05rem;
	}
	.songs-drawer .find,
	.songs-drawer .queue {
		flex: none;
		padding: 10px;
	}
	/* (The drawer scrolls as a whole.) */
	.songs-drawer .find .list,
	.songs-drawer .queue .list {
		max-height: none;
		overflow: visible;
	}
	.songs-drawer .list li:hover {
		transform: none;
	}
	@media (max-width: 720px), (pointer: coarse) and (max-height: 520px) {
		.songs-drawer {
			top: auto;
			left: 0;
			width: auto;
			max-height: min(88%, 88dvh);
			border-left: 0;
			border-top: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 18px 18px 0 0;
			padding-bottom: calc(12px + env(safe-area-inset-bottom));
			animation-name: sheet-in;
		}
		@keyframes sheet-in {
			from { transform: translateY(60px); opacity: 0; }
		}
		.drawer-head {
			border-radius: 18px 18px 0 0;
		}
	}
	/* Short landscape phones: a full-height side panel still fits best. */
	@media (pointer: coarse) and (max-height: 520px) and (min-width: 721px) {
		.songs-drawer {
			top: 0;
			left: auto;
			width: min(460px, 70%);
			max-height: none;
			border-radius: 0;
		}
	}
	.roles {
		position: absolute;
		right: 12px;
		bottom: 70px;
		z-index: 6;
		width: min(320px, calc(100% - 24px));
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(18, 10, 40, 0.94);
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(6px);
	}
	.roles-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.role {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 5px 0;
		font: 700 0.9rem system-ui, sans-serif;
	}
	.role select {
		font: 600 0.85rem system-ui, sans-serif;
		color: #fff;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 4px 6px;
	}
	.role option {
		background: #1e1240;
	}
	/* Your friend's line: dimmed (sing along quietly, or rest). */
	.now.theirs {
		opacity: 0.45;
	}
	.nextpart {
		font-weight: 800;
		color: var(--sung);
	}
	.cast {
		color: #f9a8d4 !important;
		font-weight: 700;
	}
	/* A line without word times: it lights up as a whole, and a bar runs to the next line. */
	.now.whole {
		color: var(--ink);
		transition:
			color 0.3s,
			text-shadow 0.3s;
	}
	.now.whole.on {
		color: var(--sung);
		filter: var(--outline) drop-shadow(0 2px 0 var(--glow)) drop-shadow(0 0 10px color-mix(in srgb, var(--sung) 70%, transparent));
	}
	.lineprog {
		width: min(560px, 80%);
		height: 4px;
		margin: 2px auto 6px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.15);
		overflow: hidden;
	}
	.lineprog i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #f472b6, #fde047);
		transition: width 0.1s linear;
	}
	/* The karaoke wipe: each word fills with colour as it's sung. */
	.w {
		/* Sung: bright pink; still to sing: white. */
		background: linear-gradient(90deg, var(--sung) calc(var(--k) * 100%), var(--ink) calc(var(--k) * 100%));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		white-space: pre;
	}
	.next {
		font: 700 clamp(1rem, 2vw, 1.4rem) system-ui, sans-serif;
		color: color-mix(in srgb, var(--ink) 75%, transparent);
		filter: var(--outline);
	}
	.bar {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		padding: 6px 10px;
		border-radius: 12px;
		background: rgba(17, 12, 46, 0.85);
	}
	.sync {
		display: flex;
		gap: 4px;
		align-items: center;
		font-size: 0.82rem;
		font-weight: 700;
	}
	.grow {
		flex: 1;
	}
	.msg {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 168px;
		max-width: min(640px, 92%);
		margin: 0;
		padding: 6px 12px;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.9);
		font-size: 0.82rem;
		text-align: center;
	}
	.chartbox {
		position: absolute;
		right: 12px;
		bottom: 64px;
		width: min(440px, 92%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-radius: 14px;
		background: var(--card);
		border: 1px solid rgba(255, 255, 255, 0.15);
		font-size: 0.82rem;
	}
	.chartbox p {
		margin: 0;
	}
	.chartbox textarea {
		font: 12px ui-monospace, monospace;
	}
	/* Cards: results, rooms, how it works. */
	.card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(440px, 92%);
		max-height: 92%;
		overflow: auto;
		padding: 20px;
		border-radius: 18px;
		background: var(--card);
		border: 1px solid rgba(255, 255, 255, 0.12);
		text-align: center;
	}
	.card.wide {
		width: min(640px, 94%);
		text-align: left;
	}
	.card h2 {
		margin: 0 0 6px;
	}
	.card header {
		justify-content: space-between;
	}
	.big {
		font: 900 3.6rem/1 'Arial Black', Impact, sans-serif;
		margin: 10px 0 4px;
		background: linear-gradient(90deg, #f0abfc, #7dd3fc);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.rank {
		font-weight: 800;
		color: #fde047;
	}
	.card .row {
		justify-content: center;
	}
	.card.wide .row {
		justify-content: flex-start;
	}
	.code b {
		font: 900 1.6rem ui-monospace, monospace;
		letter-spacing: 0.12em;
		color: #f0abfc;
	}
	.people {
		padding-left: 18px;
	}
	.how ul {
		padding-left: 18px;
		line-height: 1.55;
	}
	kbd {
		padding: 0 5px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.15);
		font: 0.8rem ui-monospace, monospace;
	}
	.find,
	.queue {
		min-width: 0;
	}
	/* Phones: one column the width of the screen; everything shrinks to fit rather than spilling. */
	@media (max-width: 720px) {
		.menu {
			padding: 12px;
			gap: 10px;
			overflow-y: auto;
			overflow-x: hidden;
		}
		.cols {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto;
			gap: 12px;
		}
		.find,
		.queue {
			padding: 10px;
		}
		.find .list,
		.queue .list {
			max-height: 46vh;
		}
		.sub {
			font-size: 0.82rem;
		}
		/* The tabs scroll sideways if they don't fit. */
		.tabs {
			overflow-x: auto;
			scrollbar-width: none;
		}
		.tabs button {
			flex: none;
			padding: 6px 10px;
			font-size: 0.82rem;
		}
		.list li {
			gap: 6px;
			padding: 6px;
		}
		.list li:hover {
			transform: none;
		}
		.list img {
			width: 48px;
			height: 36px;
		}
		.list li button.small {
			padding: 4px 8px;
		}
		.row input {
			min-width: 0;
		}
		/* Singing: Pause and Options in the bar; the rest in a sheet that pops up from the bottom. */
		.bar {
			flex-wrap: nowrap;
			left: 6px;
			right: 6px;
			bottom: 6px;
			padding: 6px;
		}
		.bar > * {
			flex: none;
		}
		.optbtn {
			display: inline-block;
			margin-left: auto;
		}
		.shade {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 29;
			padding: 0;
			border-radius: 0;
			background: rgba(5, 3, 20, 0.55);
			animation: fade-in 0.2s;
		}
		.opts-panel {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 30;
			display: flex;
			flex-direction: column;
			gap: 10px;
			max-height: 72%;
			overflow-y: auto;
			padding: 12px 16px 18px;
			border-radius: 20px 20px 0 0;
			background: #1a1240;
			border-top: 1px solid rgba(232, 121, 249, 0.4);
			box-shadow: 0 -18px 40px -10px rgba(0, 0, 0, 0.7);
			transform: translateY(105%);
			visibility: hidden;
			transition:
				transform 0.25s ease,
				visibility 0.25s;
		}
		.opts-panel.open {
			transform: none;
			visibility: visible;
		}
		.sheet-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.opts-panel > *,
		.opts-panel .sync,
		.opts-panel .pick select {
			width: 100%;
			max-width: none;
		}
		.opts-panel .vol input {
			flex: 1;
			width: auto;
		}
		.opts-panel .sync {
			display: flex;
			flex-wrap: wrap;
		}
		.opts-panel .grow {
			display: none;
		}
		.opts-panel > button {
			padding: 10px 14px;
			font-size: 0.9rem;
		}
		.hud {
			left: 6px;
			right: 6px;
			top: 6px;
		}
		.health.main {
			padding: 6px 10px;
			gap: 8px;
		}
		.health.main .htrack {
			height: 22px;
		}
		.health.main .hlabel {
			font-size: 0.72rem;
			min-width: 58px;
		}
		.health.main .hpct {
			font-size: 0.9rem;
		}
		.lyrics {
			bottom: 56px;
			padding: 0 10px;
		}
		.msg {
			bottom: 150px;
			font-size: 0.75rem;
		}
		.card,
		.card.wide {
			width: calc(100% - 24px);
			padding: 16px;
		}
		.big-grade {
			font-size: 4.5rem;
		}
		.warm {
			padding: 0 16px;
		}
		.warm b {
			font-size: 1.3rem;
		}
		.warm span:first-child {
			font-size: 2.6rem;
		}
		.logo-ko {
			font-size: 2rem;
		}
		.logo-mic {
			width: 42px;
			height: 42px;
		}
		.logo-mic i {
			top: 6px;
			transform: scale(0.8);
		}
		.lane {
			left: 6px;
			right: 6px;
			width: calc(100% - 12px);
			top: 92px;
			height: 30%;
		}
		.you {
			margin-left: 0;
		}
	}
</style>
