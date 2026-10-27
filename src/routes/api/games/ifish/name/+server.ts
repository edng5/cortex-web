// POST /api/games/ifish/name { name, kind: 'store' | 'fish' } → { ok, name } or { ok: false, message }
// Checks a name an iFish player wants to use (their store's name, or their centrepiece fish's),
// with the same guardrails as leaderboard nicknames: no slurs, profanity or sexual terms
// (including disguised ones), no impersonation. Store and fish names show publicly in the
// global showcase, so the game only uses names this accepts.
import { json } from '@sveltejs/kit';
import { checkName } from '$lib/server/player-name';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!rateLimit(`ifish-name:${getClientAddress()}`, 30, 10 * 60_000)) {
		return json({ ok: false, message: 'Too many tries. Wait a few minutes and try again.' }, { status: 429 });
	}
	const body = await request.json().catch(() => null);
	const fish = body?.kind === 'fish';
	const check = fish ? checkName(body?.name, 'fish name', 2, 16) : checkName(body?.name, 'store name', 3, 24);
	return json(check, { status: check.ok ? 200 : 400 });
};
