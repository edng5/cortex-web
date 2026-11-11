// Keyboard Karaoke lookups (see $lib/server/karaoke.ts):
//   GET /api/games/karaoke?search=<words>                       → { videos } from YouTube
//   GET /api/games/karaoke?playlist=<YouTube playlist link>     → { videos } in that playlist
//   GET /api/games/karaoke?video=<id>                           → { video } its title and channel
//   GET /api/games/karaoke?title=<video title>&channel=&seconds=&id= → { lyrics } (synced if found)
//   GET /api/games/karaoke?track=&artist=&seconds=              → { lyrics } for a named song
// Rate-limited per visitor, since each lookup reaches out to another site.
import { error, json } from '@sveltejs/kit';
import { findLyrics, searchYouTube, splitTitle, videoContext, videoInfo } from '$lib/server/karaoke';
import { playlistIdFrom, playlistVideos } from '$lib/server/youtube';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const text = (v: string | null, max = 200) => (v ?? '').slice(0, max).trim();

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
	const who = locals.user?.id ?? getClientAddress();
	if (!rateLimit(`karaoke:${who}`, 120, 10 * 60_000)) error(429, 'Too many lookups. Wait a few minutes.');
	const p = url.searchParams;
	const cache = { headers: { 'Cache-Control': 'private, max-age=600' } };

	if (p.has('search')) {
		const q = text(p.get('search'), 120);
		if (!q) error(400, 'Search for something.');
		return json({ videos: await searchYouTube(q) }, cache);
	}
	if (p.has('playlist')) {
		const id = playlistIdFrom(text(p.get('playlist'), 300));
		if (!id) error(400, "That isn't a YouTube playlist link.");
		const videos = (await playlistVideos(id)).map((v) => ({ id: v.id, title: v.title, channel: '', seconds: 0 }));
		return json({ videos }, cache);
	}
	if (p.has('video')) {
		const id = text(p.get('video'), 11);
		if (!/^[A-Za-z0-9_-]{11}$/.test(id)) error(400, 'Not a YouTube video.');
		return json({ video: await videoInfo(id) }, cache);
	}
	const seconds = Math.max(0, Math.min(3600, Number(p.get('seconds')) || 0));
	let track = text(p.get('track'));
	let artist = text(p.get('artist'));
	if (!track && p.has('title')) ({ track, artist } = splitTitle(text(p.get('title')), text(p.get('channel'))));
	if (!track) error(400, 'Which song?');
	// The video's own title and channel: the song found has to be named in it.
	// The video's own description and tags help tell which song (and singer) it is.
	const id = text(p.get('id'), 11);
	const video = /^[A-Za-z0-9_-]{11}$/.test(id) ? await videoContext(id) : undefined;
	const title = text(p.get('title'));
	const channel = text(p.get('channel'));
	let lyrics = await findLyrics(track, artist, seconds, title, channel, video);
	// "SONG - ARTIST" the other way round: try the two halves swapped.
	if (!lyrics && artist && /\s[-–—]\s/.test(title)) lyrics = await findLyrics(artist, track, seconds, title, channel, video);
	// (No lyrics: whether YouTube's own subtitles can be shown instead.)
	return json({ lyrics, track, artist, captions: video?.captions ?? false }, lyrics ? cache : { headers: { 'Cache-Control': 'no-store' } });
};
