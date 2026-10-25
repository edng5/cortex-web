// GET  /api/games/name → { name } — the signed-in player's leaderboard name (null = not chosen yet).
// POST /api/games/name { name } → choose / change it (checked for length, characters, inappropriate
// words and impersonation, and unique; see player-name.ts).
import { error, json } from '@sveltejs/kit';
import { checkName, getPlayerName, setPlayerName } from '$lib/server/player-name';
import { audit } from '$lib/server/audit';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return json({ name: locals.user ? getPlayerName(locals.user.id) : null });
};

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
	const user = locals.user;
	if (!user) error(401, 'Log in to choose a nickname.');
	if (!rateLimit(`game-name:${user.id}`, 10, 10 * 60_000)) error(429, 'Too many tries. Wait a few minutes and try again.');
	const body = await request.json().catch(() => null);
	const check = checkName(body?.name);
	if (!check.ok) {
		audit('game_name_rejected', { userId: user.id, email: user.email, ip: getClientAddress(), detail: { name: String(body?.name ?? '').slice(0, 40) } });
		return json({ ok: false, message: check.message }, { status: 400 });
	}
	const saved = setPlayerName(user.id, check.name);
	if (!saved.ok) return json({ ok: false, message: saved.message }, { status: 409 });
	return json({ ok: true, name: check.name });
};
