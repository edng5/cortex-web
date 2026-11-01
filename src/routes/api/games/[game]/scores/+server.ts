// GET  /api/games/:game/scores[?period=all] → global board (top players per board) + your own bests,
//      this month's (the default) or all-time.
// POST /api/games/:game/scores[?period=all] { board, score } → record a finished run (signed-in
//      players only), and get that board back.
// (`mission` is accepted as an alias of `board`, as Top Gun calls its boards missions.)
import { error, json } from '@sveltejs/kit';
import { GAMES, getBoard, isGame, periodOf, submitScore } from '$lib/server/scores';
import { keysConfigured } from '$lib/server/crypto';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params, url, setHeaders }) => {
	if (!isGame(params.game)) error(404, 'No such game.');
	const period = periodOf(url.searchParams.get('period'));
	if (!keysConfigured()) return json({ period, missions: {} });
	setHeaders({ 'cache-control': 'no-store' });
	return json(getBoard(params.game, locals.user?.id ?? null, period));
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const game = params.game;
	if (!isGame(game)) error(404, 'No such game.');
	if (!locals.user) error(401, 'Log in to appear on the global high scores.');
	if (!keysConfigured()) error(503, 'High scores are not set up yet.');
	const body = await request.json().catch(() => null);
	const board = Number(body?.board ?? body?.mission);
	const score = Number(body?.score);
	const { boards, max } = GAMES[game];
	if (!(boards as readonly number[]).includes(board) || !Number.isInteger(score) || score < 0 || score > max) {
		error(400, 'Invalid score.');
	}
	// A run takes well over a minute; this only stops scripted floods.
	if (!rateLimit(`games:${locals.user.id}`, 40, 10 * 60_000)) error(429, 'Too many scores, slow down.');
	submitScore(locals.user.id, game, board, score);
	return json(getBoard(game, locals.user.id, periodOf(url.searchParams.get('period'))));
};
