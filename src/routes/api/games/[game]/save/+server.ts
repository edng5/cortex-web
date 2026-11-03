// GET /api/games/:game/save → { data, savedAt } the signed-in player's progress (data: null if none).
// PUT /api/games/:game/save { data, savedAt, base?, device? } → keep it, unless another device has
//     saved since `base` (the version this device last had): then 409 { data, savedAt }, the newer save.
import { error, json } from '@sveltejs/kit';
import { isGame } from '$lib/server/scores';
import { MAX_SAVE_BYTES, getSave, putSave } from '$lib/server/game-saves';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

/** The arcade games, plus SpeakEase AI (its progress bundle, synced the same way). */
const saveable = (g: string) => isGame(g) || g === 'speakease';

export const GET: RequestHandler = ({ locals, params, setHeaders }) => {
	if (!saveable(params.game)) error(404, 'No such game.');
	if (!locals.user) error(401, 'Log in to sync your progress.');
	setHeaders({ 'cache-control': 'no-store' });
	return json(getSave(locals.user.id, params.game) ?? { data: null, savedAt: 0 });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!saveable(params.game)) error(404, 'No such game.');
	if (!locals.user) error(401, 'Log in to sync your progress.');
	// Saves are sent every few seconds at most while playing; this only stops floods.
	if (!rateLimit(`game-save:${locals.user.id}`, 300, 10 * 60_000)) error(429, 'Too many saves, slow down.');
	const body = await request.json().catch(() => null);
	const data = body?.data;
	const savedAt = Number(body?.savedAt);
	if (typeof data !== 'string' || data.length > MAX_SAVE_BYTES) error(400, 'Invalid save.');
	if (!Number.isFinite(savedAt) || savedAt <= 0) error(400, 'Invalid save time.');
	const base = body?.base === undefined || body?.base === null ? undefined : Number(body.base);
	if (base !== undefined && !Number.isFinite(base)) error(400, 'Invalid base.');
	const device = typeof body?.device === 'string' ? body.device.slice(0, 40) : undefined;
	// A clock far in the future would make this save win forever: cap it at now.
	const r = putSave(locals.user.id, params.game, data, Math.min(savedAt, Date.now()), { base, device });
	if (r.conflict) return json(r.conflict, { status: 409 });
	return json({ savedAt: r.savedAt });
};
