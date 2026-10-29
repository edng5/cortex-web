// GET  /api/games/ifish/showcase?offset=0&limit=30 → { entries, total } a page of the show tanks
//      players are showing off (rarest first), so everyone's tanks can be browsed.
// POST /api/games/ifish/showcase { store, layout, bond } → show off your whole store, starring your
// favourite show tank (signed-in players; store and fish names are checked like nicknames).
import { error, json } from '@sveltejs/kit';
import { countShowcase, listShowcase, postShowcase } from '$lib/server/ifish-showcase';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const int = (k: string, d: number, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(url.searchParams.get(k) ?? d)) || 0));
	const limit = int('limit', 30, 50) || 30;
	return json({ entries: listShowcase(locals.user?.id ?? null, limit, int('offset', 0, 1_000_000)), total: countShowcase() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to show off your store.');
	if (!rateLimit(`ifish-showcase:${locals.user.id}`, 20, 10 * 60_000)) error(429, 'Too many tries. Wait a few minutes.');
	const body = await request.json().catch(() => null);
	const r = postShowcase(locals.user.id, body ?? {});
	if (!r.ok) return json(r, { status: 400 });
	return json({ ok: true, entries: listShowcase(locals.user.id), total: countShowcase() });
};
