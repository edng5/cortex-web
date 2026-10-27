// GET  /api/games/ifish/market → { listings } fish for sale (newest first).
// POST /api/games/ifish/market (signed-in players):
//   { action: 'list', store, species, fishName?, price, currency } → put a rare fish up for sale
//   { action: 'buy', id }    → buy a listing (the game pays and takes the fish)
//   { action: 'cancel', id } → take back one of your unsold fish
//   { action: 'claim' }      → collect the money from your fish that sold
import { error, json } from '@sveltejs/kit';
import { buyListing, cancelListing, claimSales, createListing, listMarket } from '$lib/server/ifish-market';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return json({ listings: listMarket(locals.user?.id ?? null) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to use the fish market.');
	if (!rateLimit(`ifish-market:${locals.user.id}`, 60, 10 * 60_000)) error(429, 'Too many tries. Wait a few minutes.');
	const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
	const uid = locals.user.id;
	const id = Math.round(Number(body.id));
	let r;
	switch (body.action) {
		case 'list':
			r = createListing(uid, body);
			break;
		case 'buy':
			r = buyListing(uid, id);
			break;
		case 'cancel':
			r = cancelListing(uid, id);
			break;
		case 'claim':
			return json({ ok: true, ...claimSales(uid) });
		default:
			return json({ ok: false, message: 'Unknown action.' }, { status: 400 });
	}
	if (!r.ok) return json(r, { status: 400 });
	return json({ ...r, listings: listMarket(uid) });
};
