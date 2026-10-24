// GET  /api/topgun/scores → global board (top players per mission) + your own bests.
// POST /api/topgun/scores { mission, score } → record a finished mission (signed-in players only).
import { error, json } from '@sveltejs/kit';
import { MAX_SCORE, MISSIONS, getBoard, submitScore } from '$lib/server/scores';
import { keysConfigured } from '$lib/server/crypto';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, setHeaders }) => {
	if (!keysConfigured()) return json({ missions: {} });
	setHeaders({ 'cache-control': 'no-store' });
	return json(getBoard(locals.user?.id ?? null));
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to appear on the global high scores.');
	if (!keysConfigured()) error(503, 'High scores are not set up yet.');
	const body = await request.json().catch(() => null);
	const mission = Number(body?.mission);
	const score = Number(body?.score);
	if (!MISSIONS.includes(mission as 1 | 2 | 3) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
		error(400, 'Invalid score.');
	}
	// A mission takes over a minute to play; this only stops scripted floods.
	if (!rateLimit(`topgun:${locals.user.id}`, 30, 10 * 60_000)) error(429, 'Too many scores, slow down.');
	submitScore(locals.user.id, mission, score);
	return json(getBoard(locals.user.id));
};
