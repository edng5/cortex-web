// Lists the videos in a public YouTube playlist without an API key, by reading the JSON
// YouTube embeds in the playlist page (ytInitialData). Cached for 6 hours.
// If YouTube changes its page format this returns [] and the player still works on its own.

export interface PlaylistVideo {
	id: string;
	title: string;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; videos: PlaylistVideo[] }>();

export function playlistIdFrom(url: string): string | null {
	try {
		const id = new URL(url).searchParams.get('list');
		return id && /^[A-Za-z0-9_-]{10,64}$/.test(id) ? id : null;
	} catch {
		return null;
	}
}

export async function playlistVideos(listId: string): Promise<PlaylistVideo[]> {
	const hit = cache.get(listId);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.videos;

	let videos: PlaylistVideo[] = [];
	try {
		const res = await fetch(`https://www.youtube.com/playlist?list=${listId}&hl=en`, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
				'Accept-Language': 'en-US,en;q=0.9'
			},
			signal: AbortSignal.timeout(8000)
		});
		const html = await res.text();
		const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
		if (m) videos = extract(JSON.parse(m[1]));
	} catch (err) {
		console.warn('[youtube] could not list playlist', listId, err);
	}
	cache.set(listId, { at: Date.now(), videos });
	return videos;
}

/** Walk ytInitialData for playlist entries (new "lockup" format, with the classic renderer as fallback). */
function extract(data: unknown): PlaylistVideo[] {
	const out: PlaylistVideo[] = [];
	const seen = new Set<string>();
	const add = (id: unknown, title: unknown) => {
		if (typeof id === 'string' && /^[\w-]{11}$/.test(id) && !seen.has(id)) {
			seen.add(id);
			out.push({ id, title: typeof title === 'string' && title ? title : 'Untitled video' });
		}
	};
	const walk = (o: unknown): void => {
		if (Array.isArray(o)) return o.forEach(walk);
		if (!o || typeof o !== 'object') return;
		const r = o as Record<string, any>;
		if (r.lockupViewModel) {
			const l = r.lockupViewModel;
			add(l.contentId, l.metadata?.lockupMetadataViewModel?.title?.content);
		}
		if (r.playlistVideoRenderer) {
			const p = r.playlistVideoRenderer;
			add(p.videoId, p.title?.runs?.[0]?.text ?? p.title?.simpleText);
		}
		for (const v of Object.values(r)) walk(v);
	};
	walk(data);
	return out;
}
