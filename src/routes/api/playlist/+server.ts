// GET /api/playlist?node=<id> → the videos in that node's playlist.
// Only for nodes this visitor can see (the Surprise! node is members-only).
import { error, json } from '@sveltejs/kit';
import { visibleNodes } from '$lib/server/content';
import { playlistIdFrom, playlistVideos } from '$lib/server/youtube';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const node = visibleNodes(!!locals.user?.isMember).find((n) => n.id === url.searchParams.get('node'));
	const listId = node?.playlist ? playlistIdFrom(node.playlist) : null;
	if (!node || !listId) error(404, 'Not found');
	return json(
		{ listId, videos: await playlistVideos(listId) },
		{ headers: { 'Cache-Control': 'private, max-age=600' } }
	);
};
