// GET  /api/games/ifish/showcase → { entries } the fish players are showing off (rarest first).
// POST /api/games/ifish/showcase { store, species, fishName?, bond } → show off one of yours
// (signed-in players; store and fish names are checked like nicknames).
import { error, json } from '@sveltejs/kit';
import { listShowcase, postShowcase } from '$lib/server/ifish-showcase';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return json({ entries: listShowcase(locals.user?.id ?? null) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to show off your fish.');
	if (!rateLimit(`ifish-showcase:${locals.user.id}`, 20, 10 * 60_000)) error(429, 'Too many tries. Wait a few minutes.');
	const body = await request.json().catch(() => null);
	const r = postShowcase(locals.user.id, body ?? {});
	if (!r.ok) return json(r, { status: 400 });
	return json({ ok: true, entries: listShowcase(locals.user.id) });
};
