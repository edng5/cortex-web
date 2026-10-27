// iFish's global showcase: each signed-in player can show off one fish (their best, or their
// pet centrepiece) under their store's name. There are no high scores in iFish; this is the
// shared part. Rarer fish (then more bonded ones) are listed first.
import { getDb } from './db';
import { checkName } from './player-name';
import { RARITIES, SPECIES_BY_ID } from '$lib/games/fishstore/data';

export interface ShowcaseEntry {
	store: string;
	species: string;
	fishName: string | null;
	bond: number;
	updatedAt: number;
	mine?: boolean;
}

export function listShowcase(userId: string | null, limit = 40): ShowcaseEntry[] {
	const rows = getDb()
		.prepare('SELECT user_id, store, species, fish_name, bond, updated_at FROM ifish_showcase ORDER BY rank DESC, bond DESC, updated_at DESC LIMIT ?')
		.all(limit) as { user_id: string; store: string; species: string; fish_name: string | null; bond: number; updated_at: number }[];
	return rows.map((r) => ({
		store: r.store,
		species: r.species,
		fishName: r.fish_name,
		bond: r.bond,
		updatedAt: r.updated_at,
		mine: r.user_id === userId || undefined
	}));
}

export function postShowcase(
	userId: string,
	body: { store?: unknown; species?: unknown; fishName?: unknown; bond?: unknown }
): { ok: true } | { ok: false; message: string } {
	const sp = typeof body.species === 'string' ? SPECIES_BY_ID.get(body.species) : undefined;
	if (!sp) return { ok: false, message: 'Unknown fish.' };
	const store = checkName(body.store, 'store name', 3, 24);
	if (!store.ok) return store;
	let fishName: string | null = null;
	if (body.fishName) {
		const f = checkName(body.fishName, 'fish name', 2, 16);
		if (!f.ok) return f;
		fishName = f.name;
	}
	const bond = Math.max(0, Math.min(100, Math.round(Number(body.bond) || 0)));
	getDb()
		.prepare(
			`INSERT INTO ifish_showcase (user_id, store, species, fish_name, rank, bond, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET store = excluded.store, species = excluded.species, fish_name = excluded.fish_name,
			   rank = excluded.rank, bond = excluded.bond, updated_at = excluded.updated_at`
		)
		.run(userId, store.name, sp.id, fishName, RARITIES.indexOf(sp.rarity), bond, Date.now());
	return { ok: true };
}
