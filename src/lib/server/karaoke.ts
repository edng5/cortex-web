// Keyboard Karaoke's server side: finding songs on YouTube, and finding their time-synced lyrics.
//
// - Search: YouTube's results page embeds its data as JSON (ytInitialData); we read the videos
//   out of it, the same way youtube.ts reads playlists, so no API key is needed. If YouTube
//   changes its page format this returns [] (pasting a link still works).
// - Lyrics: LRCLIB (lrclib.net), a free, open database of synced lyrics in LRC format (a time
//   stamp per line, sometimes per word). We pick the best match by title, artist and length.
//
// Both are cached in memory, and only titles / artists are ever sent: nothing about the player.

export interface FoundVideo {
	id: string;
	title: string;
	channel: string;
	/** Length in seconds (0 if unknown, e.g. a live stream). */
	seconds: number;
}

export interface FoundLyrics {
	/** LRC text with time stamps, or null if only plain lyrics were found. */
	synced: string | null;
	plain: string | null;
	track: string;
	artist: string;
	/** Length of the recording the lyrics were timed to (s). */
	duration: number;
	/** How many versions of these lyrics were compared to choose this one. */
	versions: number;
	/** LRCLIB's id for this version. */
	id?: number;
	/** The versions to choose from (best first, this one included), for the singer to switch. */
	options?: LyricsOption[];
}
export interface LyricsOption {
	id: number;
	artist: string;
	track: string;
	duration: number;
	synced: string;
	/** Timed word by word. */
	words: boolean;
}

const UA = 'KeyboardKaraoke/0.1 (E.Ngine Games)';
const HOUR = 60 * 60 * 1000;
const searchCache = new Map<string, { at: number; videos: FoundVideo[] }>();
const lyricsCache = new Map<string, { at: number; lyrics: FoundLyrics | null }>();

function trim<K, V>(m: Map<K, V>, max = 500) {
	while (m.size > max) m.delete(m.keys().next().value as K);
}

const toSeconds = (t: string | undefined) =>
	(t ?? '')
		.split(':')
		.map(Number)
		.reduce((a, n) => (Number.isFinite(n) ? a * 60 + n : a), 0);

/** Every `videoRenderer` in YouTube's page data. */
function videosIn(data: unknown): FoundVideo[] {
	const out: FoundVideo[] = [];
	const walk = (v: unknown) => {
		if (!v || typeof v != 'object' || out.length >= 20) return;
		if (Array.isArray(v)) return v.forEach(walk);
		const o = v as Record<string, unknown>;
		const r = o.videoRenderer as Record<string, any> | undefined;
		if (r && typeof r.videoId == 'string') {
			out.push({
				id: r.videoId,
				title: r.title?.runs?.[0]?.text ?? r.title?.simpleText ?? '',
				channel: r.ownerText?.runs?.[0]?.text ?? '',
				seconds: toSeconds(r.lengthText?.simpleText)
			});
			return;
		}
		for (const k in o) walk(o[k]);
	};
	walk(data);
	return out.filter((v) => /^[A-Za-z0-9_-]{11}$/.test(v.id));
}

export async function searchYouTube(q: string): Promise<FoundVideo[]> {
	const key = q.trim().toLowerCase();
	const hit = searchCache.get(key);
	if (hit && Date.now() - hit.at < 6 * HOUR) return hit.videos;
	let videos: FoundVideo[] = [];
	try {
		const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
				'Accept-Language': 'en-US,en;q=0.9'
			},
			signal: AbortSignal.timeout(8000)
		});
		const html = await res.text();
		const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
		if (m) videos = videosIn(JSON.parse(m[1])).slice(0, 12);
	} catch (err) {
		console.warn('[karaoke] search failed', err);
	}
	searchCache.set(key, { at: Date.now(), videos });
	trim(searchCache);
	return videos;
}

/** A video's title and channel (YouTube's public oEmbed endpoint), for a pasted link. */
export async function videoInfo(id: string): Promise<FoundVideo | null> {
	try {
		const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: AbortSignal.timeout(6000) });
		if (!res.ok) return null;
		const d = (await res.json()) as { title?: string; author_name?: string };
		return { id, title: d.title ?? 'YouTube video', channel: d.author_name ?? '', seconds: 0 };
	} catch {
		return null;
	}
}

/**
 * What a video says about itself: its channel, tags and the start of its description (read from
 * the watch page). Titles like `"Free" | Official Lyric Video | Sony Animation` don't name the
 * singer, but the description and tags usually do.
 */
export interface VideoContext {
	text: string;
	keywords: string[];
	/** It has subtitles (shown by YouTube's own player when there are no lyrics). */
	captions: boolean;
}
export async function videoContext(id: string): Promise<VideoContext> {
	const hit = contextCache.get(id);
	if (hit && Date.now() - hit.at < 24 * HOUR) return hit.ctx;
	let ctx: VideoContext = { text: '', keywords: [], captions: false };
	let ok = false;
	try {
		const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' },
			signal: AbortSignal.timeout(8000)
		});
		const html = await res.text();
		const m = html.match(/var ytInitialPlayerResponse = (\{.*?\});(?:var|<\/script>)/s);
		const d = m ? (JSON.parse(m[1])?.videoDetails ?? {}) : {};
		const keywords: string[] = Array.isArray(d.keywords) ? d.keywords.slice(0, 30).map(String) : [];
		ctx = { text: `${d.author ?? ''} ${keywords.join(' ')} ${String(d.shortDescription ?? '').slice(0, 800)}`, keywords, captions: html.includes('"captionTracks"') };
		ok = res.ok && !!m;
	} catch (err) {
		console.warn('[karaoke] video details failed', err);
	}
	// (A failed fetch isn't remembered: next time, it's tried again.)
	if (ok) contextCache.set(id, { at: Date.now(), ctx });
	trim(contextCache);
	return ctx;
}
const contextCache = new Map<string, { at: number; ctx: VideoContext }>();

/** "(feat. X)", "ft. X", "[Feat. X]": the guest, left out of the song's name. */
const FEAT = /\s*[([]?\b(?:feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]?/gi;
/** An artist name, tidied: no "- Topic" / "VEVO", no guests, and one script when it's written twice. */
function artistOf(s: string) {
	let a = s.replace(/\s*(- Topic|VEVO|Official|and \d+ more)$/i, '').replace(FEAT, '').trim();
	// "aespa 에스파", "BTS 방탄소년단": the same name in Latin letters and another script. Keep the
	// Latin one (lyric databases mostly use it).
	const latin = a
		.replace(/[^\u0000-ɏ]+/g, ' ')
		.replace(/[([{]\s*[)\]}]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (latin && latin != a) a = latin;
	return a;
}

/**
 * A video title as { artist, track }. Handles "Artist - Song (Official Video)", and the K-pop /
 * J-pop style "Artist 아티스트 'Song (Feat. X)' MV", where the song is in quotes and there's no dash.
 */
export function splitTitle(title: string, channel = ''): { artist: string; track: string } {
	const clean = title
		// Tags in brackets: [4K+60FPS], (Official Video), 【MV】, (Lyrics), [ENG SUB]…
		.replace(/[([{【][^)\]}】]*(official|video|audio|lyric|mv|m\/v|hd|4k|60fps|remaster|visualizer|live|performance|color coded|eng|sub|가사)[^)\]}】]*[)\]}】]/gi, '')
		// "… @2026 WORLD TOUR": where it was filmed.
		.replace(/\s@.*$/, '')
		.replace(/\b(official (music )?video|lyric video|lyrics?|mv|m\/v|performance video|dance practice)\b/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
	// "“Golden” Official Lyric Video | KPop Demon Hunters | Sony Animation": sections. Use the one
	// with the song (quoted, or "Artist - Song"); the rest are hints.
	const sections = clean.split(/\s[|｜]\s/).map((x) => x.trim()).filter(Boolean);
	if (sections.length > 1) {
		const main = sections.find((x) => /["“”'‘’「『]/.test(x) || /\s[-–—]\s/.test(x)) ?? sections[0];
		return splitTitle(main, channel);
	}
	const unquote = (t: string) => t.replace(/^["“”'‘’「『]|["“”'‘’」』]$/g, '').replace(FEAT, '').trim();
	const parts = clean.split(/\s[-–—|]\s/);
	if (parts.length >= 2) return { artist: artistOf(parts[0]), track: unquote(parts.slice(1).join(' ')) };
	// Japanese corner brackets, right after the name: YOASOBI「アイドル」.
	const jp = clean.match(/^(.*?)[「『]([^」』]+)[」』]/);
	if (jp && jp[2].trim()) return { artist: artistOf(jp[1]) || artistOf(channel), track: unquote(jp[2]) };
	// "FREE By Arden Cho and Cha Eun-woo": a short song name, then "by" and a list of names (two
	// or more capitalised words). "Stand By Me" stays one song.
	const by = clean.match(/^(\S+(?:\s\S+){0,3}?)\s+by\s+((?:[A-Z][\w.'-]*)(?:\s+(?:[A-Z][\w.'-]*|and|&|x))+)\s*$/i);
	if (by && !/['"“”‘’「『]/.test(clean) && /[A-Z]/.test(by[2]) && by[2].split(/\s+/).filter((w) => /^[A-Z]/.test(w)).length >= 2)
		return { artist: artistOf(by[2]), track: unquote(by[1]) };
	// A song in quotes (a quote mark at a word's edge, so "Don't" doesn't count).
	const q = clean.match(/^(.*?)(?:^|\s)['‘"“「『]([^'’"”」』]+)['’"”」』](?=\s|$|[(\[])/);
	if (q && q[2].trim()) return { artist: artistOf(q[1]) || artistOf(channel), track: unquote(q[2]) };
	return { artist: artistOf(channel), track: unquote(clean) };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9぀-ヿ一-鿿가-힯]+/g, ' ').trim();
/** How alike two names are (0..1): shared words. */
function alike(a: string, b: string) {
	const A = new Set(norm(a).split(' ').filter(Boolean));
	const B = new Set(norm(b).split(' ').filter(Boolean));
	if (!A.size || !B.size) return 0;
	let n = 0;
	for (const w of A) if (B.has(w)) n++;
	return n / Math.max(A.size, B.size);
}

interface LrcLibHit {
	id: number;
	trackName: string;
	artistName: string;
	albumName: string | null;
	duration: number;
	instrumental: boolean;
	plainLyrics: string | null;
	syncedLyrics: string | null;
}

/** Words of a name, for matching (single letters dropped, unless they're CJK / Hangul). */
const words = (s: string) => norm(s.replace(FEAT, ' ')).split(' ').filter((w) => w.length > 1 || /[^\x00-\x7f]/.test(w));
/** How much of `part` appears in `whole` (0..1). */
function coverage(part: string, whole: string) {
	const P = words(part);
	if (!P.length) return 0;
	const W = new Set(words(whole));
	return P.filter((w) => W.has(w)).length / P.length;
}
/** The lyrics' words (time stamps dropped), for comparing two versions. */
function lyricWords(lrc: string) {
	return new Set(norm(lrc.replace(/\[[^\]]*\]|<[^>]*>/g, ' ')).split(' ').filter(Boolean).slice(0, 400));
}
/** When the first sung line starts (s). */
function firstLine(lrc: string) {
	for (const row of lrc.split(/\r?\n/)) {
		const m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
		if (m && m[3].replace(/<[^>]*>/g, '').trim()) return Number(m[1]) * 60 + Number(m[2]);
	}
	return 0;
}

/**
 * Synced lyrics for a song. `hint` is the video's own title and channel: the song's name has to
 * appear in it, so a cover or a talk-show clip doesn't pick up some other song's lyrics.
 *
 * Cross-checking: LRCLIB often has several versions of the same song, sent in by different
 * people. They're compared with each other (their words, and when the first line starts), and the
 * version that agrees most with the rest is used, so a one-off mistake (the wrong lyrics, junk
 * lines, timings shifted) is outvoted.
 */
/** A song's own name: no guests, no "(from …)", no quotes. */
const core = (name: string) => name.replace(FEAT, '').replace(/\s*[([].*$/, '').replace(/["“”'‘’]/g, '').trim();
/** `phrase` appears in `text` as whole words, in order. */
const phraseIn = (phrase: string, text: string) => {
	const p = norm(phrase);
	return !!p && ` ${norm(text)} `.includes(` ${p} `);
};
/** Two song names are the same song: the same words, the same number of times ("Free" isn't "Free Free Free"). */
function sameSong(a: string, b: string) {
	const A = words(a);
	const B = words(b);
	if (!A.length || !B.length) return false;
	const left = [...B];
	let n = 0;
	for (const w of A) {
		const i = left.indexOf(w);
		if (i >= 0) {
			n++;
			left.splice(i, 1);
		}
	}
	return n / Math.max(A.length, B.length) >= 0.75;
}

export async function findLyrics(track: string, artist: string, seconds: number, title = '', channel = '', video?: VideoContext): Promise<FoundLyrics | null> {
	const hint = `${title} ${channel}`.trim();
	/** Everything known about the video: title, channel, and its description and tags. */
	const ctx = `${hint} ${video?.text ?? ''}`;
	const key = `${norm(track)}|${norm(artist)}|${Math.round(seconds / 5)}|${norm(hint).slice(0, 80)}|${video ? 'v' : ''}`;
	const hit = lyricsCache.get(key);
	// Found: kept a day. Not found: only half an hour (LRCLIB grows, and a search can come up short).
	if (hit && Date.now() - hit.at < (hit.lyrics ? 24 * HOUR : HOUR / 2)) return hit.lyrics;
	let failed = false;
	let lyrics: FoundLyrics | null = null;
	try {
		const ref = `${hint} ${artist} ${track}`;
		// The song: its exact name in the video's title (as a phrase), or the same name as the one asked for.
		const named = (h: LrcLibHit) => phraseIn(core(h.trackName), title || track) || sameSong(core(h.trackName), track);
		// Who sings it: their name (or, for a soundtrack, the album's) in the title or channel.
		// (Album words that are just the song's name again don't count: an album called "Golden"
		// says nothing about which "Golden" this is.)
		const albumCtx = (h: LrcLibHit) => {
			const own = new Set(words(h.trackName));
			const rest = words(h.albumName ?? '').filter((w) => !own.has(w));
			return rest.length ? coverage(rest.join(' '), ctx) : 0;
		};
		// …and the right singer: their name (or, for a soundtrack, the album's) has to match something
		// about the video, or the lyrics aren't used. No lyrics beats the wrong lyrics.
		// (Words of the artist's name that are just the song's name again don't count either: a band
		// called "Free" says nothing about who sings "Free".)
		const artistCtx = (h: LrcLibHit) => {
			const own = new Set([...words(h.trackName), ...words(track)]);
			const rest = words(h.artistName).filter((w) => !own.has(w));
			return rest.length ? coverage(rest.join(' '), ctx) : 0;
		};
		const singer = (h: LrcLibHit) => artistCtx(h) >= 0.5 || albumCtx(h) >= 0.5 || (!!artist && alike(h.artistName, artist) >= 0.5);
		const tries = [
			new URLSearchParams({ track_name: track, ...(artist ? { artist_name: artist } : {}) }),
			...(artist ? [new URLSearchParams({ q: `${artist} ${track}` })] : []),
			new URLSearchParams({ q: track }),
			// The song with the rest of the title ("'Golden' from KPop Demon Hunters" → "Golden KPop
			// Demon Hunters"): the context that tells one "Golden" from another.
			...title
				.split(/\s[|｜]\s/)
				.map((sec) => words(sec.replace(FEAT, ' ')).filter((w) => !words(track).includes(w) && !/^(from|by|the|cover|official|video|lyrics?|mv|ost|feat|ft|and)$/.test(w)).slice(0, 5).join(' '))
				.filter((rest) => rest && rest.length > 2)
				.flatMap((rest) => [rest.split(' ').slice(0, 2).join(' '), rest])
				.filter((rest, i, a) => a.indexOf(rest) == i)
				.slice(0, 3)
				.map((rest) => new URLSearchParams({ q: `${track} ${rest}` })),
			// The video's tags that aren't just the song's name ("rumi", "kpop demon hunters"…).
			...(video?.keywords ?? [])
				.map((k) => k.trim())
				.filter((k) => k && !words(k).every((w) => words(track).includes(w) || words(channel).includes(w) || /^(lyrics?|official|video|mv|karaoke|cover|song|music|sony|netflix|animation|pictures)$/.test(w)))
				.slice(0, 10)
				.map((k) => new URLSearchParams({ q: `${track} ${k}` }))
		];
		const seen = new Map<number, LrcLibHit>();
		const trusted = () => [...seen.values()].filter((h) => h.syncedLyrics && !h.instrumental && named(h) && singer(h)).length;
		for (const [i, q] of tries.entries()) {
			// Each search on its own: one that fails (a timeout, rate limiting) doesn't sink the rest.
			try {
				const res = await fetch(`https://lrclib.net/api/search?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
				if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
				const got = (await res.json()) as LrcLibHit[];
				if (Array.isArray(got)) for (const h of got) seen.set(h.id, h);
			} catch (err) {
				failed = true;
				console.warn('[karaoke] a lyrics search failed', String(err).slice(0, 120));
			}
			// (The first few searches always run; the tag searches stop once there's enough to compare.)
			if (i >= 4 && trusted() >= 4) break;
		}
		const fit = (h: LrcLibHit) =>
			artistCtx(h) * 2 + albumCtx(h) * 1.5 + (artist ? alike(h.artistName, artist) : 0) + coverage(h.trackName, ref) - (seconds ? Math.min(1, Math.abs(h.duration - seconds) / 45) : 0);
		const pool = [...seen.values()].filter((h) => !h.instrumental && named(h) && singer(h));
		const synced = pool.filter((h) => h.syncedLyrics);
		if (synced.length) {
			const top = synced.reduce((a, b) => (fit(b) > fit(a) ? b : a));
			// Every version of that same song (its name, about the same length), however its artist was
			// spelled ("HUNTR/X", "Huntrix"…).
			const topCore = core(top.trackName);
			const ctx = (h: LrcLibHit) => new Set(words(`${h.artistName} ${h.albumName ?? ''}`).filter((w) => !words(topCore).includes(w)));
			const topCtx = ctx(top);
			const related = (h: LrcLibHit) => [...ctx(h)].some((w) => topCtx.has(w));
			const same = synced.filter((h) => coverage(topCore, h.trackName) == 1 && (Math.abs(h.duration - top.duration) <= 8 || (seconds > 0 && Math.abs(h.duration - seconds) <= 5)) && related(h));
			// One vote per distinct version: the same file sent in six times is still one opinion.
			const uniq = new Map<string, LrcLibHit>();
			for (const h of same) {
				const k = norm(h.syncedLyrics!).slice(0, 300);
				const had = uniq.get(k);
				if (!had || fit(h) > fit(had)) uniq.set(k, h);
			}
			const info = [...uniq.values()].map((h) => ({ h, w: lyricWords(h.syncedLyrics!), first: firstLine(h.syncedLyrics!) }));
			const agree = (a: (typeof info)[number], b: (typeof info)[number]) => {
				let n = 0;
				for (const w of a.w) if (b.w.has(w)) n++;
				const text = n / Math.max(1, Math.min(a.w.size, b.w.size));
				return text - Math.min(1, Math.abs(a.first - b.first) / 2);
			};
			// The version the others agree with most (and, between equals, the best match for the video).
			// Its first lines have to be in the song as everyone else has it (other versions and covers,
			// timed or not): junk like "Let's Go karaoke… Are You Ready" isn't in anyone else's lyrics.
			const corpus = [...seen.values()]
				.filter((h) => sameSong(core(h.trackName), topCore) || phraseIn(topCore, h.trackName))
				// (Only this song, by a matching singer: other songs that share its name don't count.)
				.filter((h) => singer(h))
				.map((h) => norm((h.syncedLyrics ?? h.plainLyrics ?? '').replace(/\[[^\]]*\]|<[^>]*>/g, ' ')))
				.filter((t) => t.split(' ').length > 20)
				.map((t) => ({ k: t.slice(0, 300), t: ` ${t} ` }));
			/** How many of its first three lines (their first few words, as a phrase) most other versions also have. */
			const opening = (a: (typeof info)[number]) => {
				const mine = norm(a.h.syncedLyrics!.replace(/\[[^\]]*\]|<[^>]*>/g, ' ')).slice(0, 300);
				const others = corpus.filter((c) => c.k != mine);
				if (others.length < 2) return 0.5;
				const lines = a.h.syncedLyrics!
					.split(/\r?\n/)
					.map((r) => norm(r.replace(/\[[^\]]*\]|<[^>]*>/g, ' ')))
					.filter((l) => l.split(' ').length >= 2)
					.slice(0, 3);
				if (!lines.length) return 0;
				const known = lines.filter((l) => {
					const phrase = ` ${l.split(' ').slice(0, 4).join(' ')} `;
					return others.filter((o) => o.t.includes(phrase)).length >= others.length / 2;
				});
				return known.length / lines.length;
			};
			const votes = (a: (typeof info)[number]) => info.reduce((s, o) => s + (o == a ? 0 : agree(a, o)), 0) + opening(a) * 3 + fit(a.h) * 0.3 + (/<\d+:\d+/.test(a.h.syncedLyrics!) ? 0.5 : 0) + (seconds > 0 ? Math.max(0, 1 - Math.abs(a.h.duration - seconds) / 5) * 2 : 0);
			const ranked = [...info].sort((a, b) => votes(b) - votes(a));
			const h = ranked[0].h;
			// The others to choose from (distinct versions, best first).
			const options: LyricsOption[] = ranked.slice(0, 6).map((i) => ({ id: i.h.id, artist: i.h.artistName, track: i.h.trackName, duration: Math.round(i.h.duration), synced: i.h.syncedLyrics!, words: /<\d+:\d+/.test(i.h.syncedLyrics!) }));
			lyrics = { synced: h.syncedLyrics, plain: h.plainLyrics, track: h.trackName, artist: h.artistName, duration: h.duration, versions: info.length, id: h.id, options };
		} else {
			const plain = pool.filter((h) => h.plainLyrics);
			if (plain.length) {
				const h = plain.reduce((a, b) => (fit(b) > fit(a) ? b : a));
				lyrics = { synced: null, plain: h.plainLyrics, track: h.trackName, artist: h.artistName, duration: h.duration, versions: 1 };
			}
		}
	} catch (err) {
		failed = true;
		console.warn('[karaoke] lyrics lookup failed', err);
	}
	// A lookup that hit an error isn't remembered as "no lyrics": it's tried again next time.
	if (lyrics || !failed) lyricsCache.set(key, { at: Date.now(), lyrics });
	trim(lyricsCache);
	return lyrics;
}
