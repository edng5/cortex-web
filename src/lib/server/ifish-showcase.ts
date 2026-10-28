// FishMart's global showcase: each signed-in player shows off their favourite show tank under
// their store's name, and anyone can look inside it. There are no high scores in FishMart; this
// is the shared part. Tanks with rarer fish (then more bonded partner fish) are listed first.
import { getDb } from './db';
import { checkName } from './player-name';
import { RARITIES, SHOW_MAX_LEVEL, SPECIES_BY_ID, TANK_DECOR, TANK_LIGHTS, TANK_SHAPES, TANK_STANDS, TANK_TRIMS } from '$lib/games/fishstore/data';

/** A show tank as everyone sees it. */
export interface ShowcaseTank {
	water: 'fresh' | 'salt';
	temp: 'tropical' | 'cold';
	level: number;
	seg: number;
	clean: number;
	growth: number;
	decor: string[];
	look: { shape: string; trim: string; stand: string; light: string };
	fish: { s: string; n?: string }[];
	/** Which fish is the partner (index into `fish`), if it lives here. */
	partner: number | null;
}
export interface ShowcaseEntry {
	store: string;
	species: string;
	fishName: string | null;
	bond: number;
	tank: ShowcaseTank | null;
	updatedAt: number;
	mine?: boolean;
}
const MAX_FISH = 80;
/** Points per fish by rarity, for sorting the showcase. */
const POINTS = [1, 2, 4, 7, 12, 20, 40];

export function listShowcase(userId: string | null, limit = 40): ShowcaseEntry[] {
	const rows = getDb()
		.prepare('SELECT user_id, store, species, fish_name, bond, tank, updated_at FROM ifish_showcase ORDER BY rank DESC, bond DESC, updated_at DESC LIMIT ?')
		.all(limit) as { user_id: string; store: string; species: string; fish_name: string | null; bond: number; tank: string | null; updated_at: number }[];
	return rows.map((r) => {
		let tank: ShowcaseTank | null = null;
		try {
			tank = r.tank ? (JSON.parse(r.tank) as ShowcaseTank) : null;
		} catch {
			/* an unreadable tank: just the fish */
		}
		return { store: r.store, species: r.species, fishName: r.fish_name, bond: r.bond, tank, updatedAt: r.updated_at, mine: r.user_id === userId || undefined };
	});
}

const pickOf = <T extends { id: string }>(list: T[], v: unknown, fallback: string) => (list.some((x) => x.id === v) ? (v as string) : fallback);

/** Check a posted tank: only known fish, decorations and styles; names checked like nicknames. */
function cleanTank(raw: unknown): ShowcaseTank | string {
	if (!raw || typeof raw !== 'object') return 'No tank to show.';
	const t = raw as Record<string, unknown>;
	const fishIn = Array.isArray(t.fish) ? t.fish.slice(0, MAX_FISH) : [];
	const fish: ShowcaseTank['fish'] = [];
	for (const f of fishIn as { s?: unknown; n?: unknown }[]) {
		if (typeof f?.s !== 'string' || !SPECIES_BY_ID.has(f.s)) continue;
		const out: { s: string; n?: string } = { s: f.s };
		if (f.n) {
			const n = checkName(f.n, 'fish name', 2, 16);
			if (n.ok) out.n = n.name;
		}
		fish.push(out);
	}
	const look = (t.look ?? {}) as Record<string, unknown>;
	const num = (v: unknown, lo: number, hi: number, d: number) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || d));
	const partner = Number.isInteger(t.partner) && (t.partner as number) >= 0 && (t.partner as number) < fish.length ? (t.partner as number) : null;
	return {
		water: t.water === 'salt' ? 'salt' : 'fresh',
		temp: t.temp === 'cold' ? 'cold' : 'tropical',
		level: num(t.level, 1, SHOW_MAX_LEVEL, 1),
		seg: num(t.seg, 1, 5, 1),
		clean: num(t.clean, 0, 100, 100),
		growth: num(t.growth, 0, 100, 30),
		decor: [...new Set(Array.isArray(t.decor) ? t.decor : [])].filter((d) => TANK_DECOR.some((x) => x.id === d)).slice(0, 20) as string[],
		look: {
			shape: pickOf(TANK_SHAPES, look.shape, 'rect'),
			trim: pickOf(TANK_TRIMS, look.trim, TANK_TRIMS[0].id),
			stand: pickOf(TANK_STANDS, look.stand, TANK_STANDS[0].id),
			light: pickOf(TANK_LIGHTS, look.light, TANK_LIGHTS[0].id)
		},
		fish,
		partner
	};
}

export function postShowcase(userId: string, body: { store?: unknown; tank?: unknown; bond?: unknown }): { ok: true } | { ok: false; message: string } {
	const store = checkName(body.store, 'store name', 3, 24);
	if (!store.ok) return store;
	const tank = cleanTank(body.tank);
	if (typeof tank === 'string') return { ok: false, message: tank };
	if (!tank.fish.length) return { ok: false, message: 'Put some fish in your favourite tank first.' };
	// The star of the tank: the partner fish, or else the rarest.
	const rank = (s: string) => RARITIES.indexOf(SPECIES_BY_ID.get(s)!.rarity);
	const star = tank.partner !== null ? tank.fish[tank.partner] : [...tank.fish].sort((a, b) => rank(b.s) - rank(a.s))[0];
	const score = tank.fish.reduce((a, f) => a + POINTS[rank(f.s)], 0);
	const bond = tank.partner !== null ? Math.max(0, Math.min(100, Math.round(Number(body.bond) || 0))) : 0;
	getDb()
		.prepare(
			`INSERT INTO ifish_showcase (user_id, store, species, fish_name, rank, bond, tank, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET store = excluded.store, species = excluded.species, fish_name = excluded.fish_name,
			   rank = excluded.rank, bond = excluded.bond, tank = excluded.tank, updated_at = excluded.updated_at`
		)
		.run(userId, store.name, star.s, star.n ?? null, score, bond, JSON.stringify(tank), Date.now());
	return { ok: true };
}
