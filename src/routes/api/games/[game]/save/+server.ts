// GET /api/games/:game/save → { data, savedAt } the signed-in player's progress (data: null if none).
// PUT /api/games/:game/save { data, savedAt } → keep it if it's newer than the account's copy.
import { error, json } from '@sveltejs/kit';
import { isGame } from '$lib/server/scores';
import { MAX_SAVE_BYTES, getSave, putSave } from '$lib/server/game-saves';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params, setHeaders }) => {
	if (!isGame(params.game)) error(404, 'No such game.');
	if (!locals.user) error(401, 'Log in to sync your progress.');
	setHeaders({ 'cache-control': 'no-store' });
	return json(getSave(locals.user.id, params.game) ?? { data: null, savedAt: 0 });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!isGame(params.game)) error(404, 'No such game.');
	if (!locals.user) error(401, 'Log in to sync your progress.');
	// Saves are sent every few seconds at most while playing; this only stops floods.
	if (!rateLimit(`game-save:${locals.user.id}`, 300, 10 * 60_000)) error(429, 'Too many saves, slow down.');
	const body = await request.json().catch(() => null);
	const data = body?.data;
	const savedAt = Number(body?.savedAt);
	if (typeof data !== 'string' || data.length > MAX_SAVE_BYTES) error(400, 'Invalid save.');
	if (!Number.isFinite(savedAt) || savedAt <= 0) error(400, 'Invalid save time.');
	// A clock far in the future would make this save win forever: cap it at now.
	return json({ savedAt: putSave(locals.user.id, params.game, data, Math.min(savedAt, Date.now())) });
};
