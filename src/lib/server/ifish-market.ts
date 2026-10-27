// FishMart's fish market: signed-in players list their rare (or rarer) fish for sale at a price in
// cash or gems, and other players buy them. Listing takes the fish out of the seller's store
// (the game removes it before posting); a sale hands the fish to the buyer straight away, and the
// money waits here until the seller next opens the market and collects it. Unsold fish can be
// taken back.
import { getDb } from './db';
import { checkName } from './player-name';
import { RARITIES, SPECIES_BY_ID } from '$lib/games/fishstore/data';

export type Currency = 'cash' | 'gems';
export interface Listing {
	id: number;
	store: string;
	species: string;
	fishName: string | null;
	price: number;
	currency: Currency;
	createdAt: number;
	mine?: boolean;
}
/** The rarest a player can sell: rare and up (common fish go to the wholesaler). */
export const MIN_RARITY = RARITIES.indexOf('rare');
export const MAX_PRICE: Record<Currency, number> = { cash: 1_000_000, gems: 5_000 };
export const MAX_LISTINGS = 10;

type Row = { id: number; seller_id: string; store: string; species: string; fish_name: string | null; price: number; currency: Currency; created_at: number };
const toListing = (r: Row, userId: string | null): Listing => ({
	id: r.id,
	store: r.store,
	species: r.species,
	fishName: r.fish_name,
	price: r.price,
	currency: r.currency,
	createdAt: r.created_at,
	mine: r.seller_id === userId || undefined
});

export function listMarket(userId: string | null, limit = 80): Listing[] {
	const rows = getDb()
		.prepare('SELECT id, seller_id, store, species, fish_name, price, currency, created_at FROM ifish_market WHERE buyer_id IS NULL ORDER BY created_at DESC LIMIT ?')
		.all(limit) as Row[];
	return rows.map((r) => toListing(r, userId));
}

type Fail = { ok: false; message: string };

export function createListing(
	userId: string,
	body: { store?: unknown; species?: unknown; fishName?: unknown; price?: unknown; currency?: unknown }
): { ok: true; listing: Listing } | Fail {
	const sp = typeof body.species === 'string' ? SPECIES_BY_ID.get(body.species) : undefined;
	if (!sp) return { ok: false, message: 'Unknown fish.' };
	if (RARITIES.indexOf(sp.rarity) < MIN_RARITY) return { ok: false, message: 'Only rare fish (or rarer) can be sold on the market.' };
	const currency: Currency = body.currency === 'gems' ? 'gems' : 'cash';
	const price = Math.round(Number(body.price));
	if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE[currency]) return { ok: false, message: `Set a price from 1 to ${MAX_PRICE[currency].toLocaleString()} ${currency}.` };
	const store = checkName(body.store, 'store name', 3, 24);
	if (!store.ok) return store;
	let fishName: string | null = null;
	if (body.fishName) {
		const f = checkName(body.fishName, 'fish name', 2, 16);
		if (!f.ok) return f;
		fishName = f.name;
	}
	const db = getDb();
	const open = (db.prepare('SELECT COUNT(*) AS n FROM ifish_market WHERE seller_id = ? AND buyer_id IS NULL').get(userId) as { n: number }).n;
	if (open >= MAX_LISTINGS) return { ok: false, message: `You can have up to ${MAX_LISTINGS} fish for sale at once.` };
	const now = Date.now();
	const r = db
		.prepare('INSERT INTO ifish_market (seller_id, store, species, fish_name, price, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run(userId, store.name, sp.id, fishName, price, currency, now);
	return { ok: true, listing: { id: Number(r.lastInsertRowid), store: store.name, species: sp.id, fishName, price, currency, createdAt: now, mine: true } };
}

/** Buy a listing: it's marked sold to you (only one buyer can win it). The game then pays and takes the fish. */
export function buyListing(userId: string, id: number): { ok: true; listing: Listing } | Fail {
	const db = getDb();
	const row = db.prepare('SELECT id, seller_id, store, species, fish_name, price, currency, created_at FROM ifish_market WHERE id = ? AND buyer_id IS NULL').get(id) as Row | undefined;
	if (!row) return { ok: false, message: 'Someone else got that one first.' };
	if (row.seller_id === userId) return { ok: false, message: "That's your own fish. Take it back instead." };
	const r = db.prepare('UPDATE ifish_market SET buyer_id = ?, sold_at = ? WHERE id = ? AND buyer_id IS NULL').run(userId, Date.now(), id);
	if (!r.changes) return { ok: false, message: 'Someone else got that one first.' };
	return { ok: true, listing: toListing(row, userId) };
}

/** Take back one of your unsold fish. */
export function cancelListing(userId: string, id: number): { ok: true; listing: Listing } | Fail {
	const db = getDb();
	const row = db.prepare('SELECT id, seller_id, store, species, fish_name, price, currency, created_at FROM ifish_market WHERE id = ? AND seller_id = ? AND buyer_id IS NULL').get(id, userId) as Row | undefined;
	if (!row) return { ok: false, message: 'That fish has already sold.' };
	db.prepare('DELETE FROM ifish_market WHERE id = ? AND buyer_id IS NULL').run(id);
	return { ok: true, listing: toListing(row, userId) };
}

/** Collect the money from your fish that sold (each sale is paid out once). */
export function claimSales(userId: string): { sales: { species: string; fishName: string | null; price: number; currency: Currency }[] } {
	const db = getDb();
	const claim = db.transaction(() => {
		const rows = db.prepare('SELECT id, species, fish_name, price, currency FROM ifish_market WHERE seller_id = ? AND buyer_id IS NOT NULL AND claimed = 0').all(userId) as {
			id: number;
			species: string;
			fish_name: string | null;
			price: number;
			currency: Currency;
		}[];
		db.prepare('UPDATE ifish_market SET claimed = 1 WHERE seller_id = ? AND buyer_id IS NOT NULL AND claimed = 0').run(userId);
		// Paid-out sales aren't needed any more.
		db.prepare('DELETE FROM ifish_market WHERE claimed = 1 AND sold_at < ?').run(Date.now() - 30 * 86_400_000);
		return rows;
	});
	return { sales: claim().map((r) => ({ species: r.species, fishName: r.fish_name, price: r.price, currency: r.currency })) };
}
