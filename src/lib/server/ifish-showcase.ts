// FishMart's global showcase: each signed-in player shows off their whole store (its layout and
// every tank, starring their favourite show tank) under their store's name, and anyone can walk
// around it and look inside the tanks. There are no high scores in FishMart; this is the shared
// part. Stores with rarer fish (then more bonded partner fish) are listed first.
import { getDb } from './db';
import { checkName } from './player-name';
import {
	EXPAND_MAX,
	FLOORS,
	MAX_SHOW_TANKS,
	RARITIES,
	ROLES,
	SHELF_CAP,
	SHOW_MAX_LEVEL,
	SPECIES_BY_ID,
	STORE_DECOR,
	TANK_DECOR,
	TANK_LIGHTS,
	TANK_SHAPES,
	TANK_STANDS,
	TANK_TIERS,
	TANK_TRIMS,
	gridSize,
	type StoreSnapshot
} from '$lib/games/fishstore/data';

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
	/** The whole store (stores shared before this was added have just their tank). */
	layout: StoreSnapshot | null;
	updatedAt: number;
	mine?: boolean;
}
const MAX_FISH = 80;
/** Points per fish by rarity, for sorting the showcase. */
const POINTS = [1, 2, 4, 7, 12, 20, 40];

/** How many tanks are in the showcase. */
export function countShowcase(): number {
	return (getDb().prepare('SELECT COUNT(*) AS n FROM ifish_showcase').get() as { n: number }).n;
}

/** A page of the showcase (rarest first): `offset` lets players scroll through everyone's tanks. */
export function listShowcase(userId: string | null, limit = 30, offset = 0): ShowcaseEntry[] {
	const rows = getDb()
		.prepare('SELECT user_id, store, species, fish_name, bond, tank, layout, updated_at FROM ifish_showcase ORDER BY rank DESC, bond DESC, updated_at DESC, user_id LIMIT ? OFFSET ?')
		.all(limit, offset) as { user_id: string; store: string; species: string; fish_name: string | null; bond: number; tank: string | null; layout: string | null; updated_at: number }[];
	return rows.map((r) => {
		const parse = <T>(v: string | null): T | null => {
			try {
				return v ? (JSON.parse(v) as T) : null;
			} catch {
				return null; // unreadable: show what's left
			}
		};
		return { store: r.store, species: r.species, fishName: r.fish_name, bond: r.bond, tank: parse<ShowcaseTank>(r.tank), layout: parse<StoreSnapshot>(r.layout), updatedAt: r.updated_at, mine: r.user_id === userId || undefined };
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
		seg: num(t.seg, 1, 10, 1),
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

const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);

/** Check a posted store: known things only, everything placed inside the (expanded) floor. */
function cleanStore(raw: unknown): StoreSnapshot | string {
	if (!raw || typeof raw !== 'object') return 'No store to show.';
	const p = raw as Record<string, unknown>;
	const size = int(p.size, 0, EXPAND_MAX) ?? 0;
	const [gw, gh] = gridSize(size);
	/** A spot for something w×h on the floor, or null if it's off the floor. */
	const at = (o: unknown, w: number, h: number) => {
		const q = (o ?? {}) as Record<string, unknown>;
		const x = int(q.x, 0, gw - w);
		const y = int(q.y, 0, gh - h);
		return x === null || y === null ? null : { x, y };
	};
	const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []) as Record<string, unknown>[];
	const sale: StoreSnapshot['sale'] = [];
	for (const t of list(p.sale, 40)) {
		const tt = TANK_TIERS.find((x) => x.id === t.tier);
		const spot = tt && at(t, tt.w, 1);
		if (!tt || !spot) continue;
		const fish = list(t.fish, MAX_FISH).filter((s) => typeof s === 'string' && SPECIES_BY_ID.has(s as unknown as string)) as unknown as string[];
		sale.push({ tier: tt.id, water: t.water === 'salt' ? 'salt' : 'fresh', temp: t.temp === 'cold' ? 'cold' : 'tropical', ...spot, clean: int(Math.round(Number(t.clean)), 0, 100) ?? 100, fish });
	}
	const show: StoreSnapshot['show'] = [];
	for (const t of list(p.show, MAX_SHOW_TANKS + EXPAND_MAX)) {
		const tank = cleanTank(t);
		if (typeof tank === 'string') continue;
		const spot = at(t, Math.min(gw, 2 * tank.seg), 2);
		if (spot) show.push({ ...(tank as unknown as StoreSnapshot['show'][number]), ...spot });
	}
	if (!show.length) return 'No show tank to show.';
	const decor: StoreSnapshot['decor'] = [];
	for (const d of list(p.decor, 120)) {
		const item = STORE_DECOR.find((x) => x.id === d.item);
		const spot = item && at(d, 1, 1);
		if (item && spot) decor.push({ item: item.id, ...spot });
	}
	const shelfAt = at(p.shelf, 2, 1);
	return {
		size,
		floor: FLOORS.some((f) => f.id === p.floor) ? (p.floor as string) : FLOORS[0].id,
		sale,
		show,
		fav: int(p.fav, 0, show.length - 1) ?? 0,
		decor,
		shelf: { ...(shelfAt ?? { x: Math.max(0, gw - 3), y: 0 }), level: int((p.shelf as Record<string, unknown>)?.level, 1, SHELF_CAP.length - 1) ?? 1 },
		lab: p.lab ? at(p.lab, 2, 2) : null,
		breeder: p.breeder ? at(p.breeder, 2, 1) : null,
		staff: list(p.staff, 30).filter((r) => ROLES.some((x) => x.id === (r as unknown as string))) as unknown as string[]
	};
}

export function postShowcase(userId: string, body: { store?: unknown; layout?: unknown; bond?: unknown }): { ok: true } | { ok: false; message: string } {
	const store = checkName(body.store, 'store name', 3, 24);
	if (!store.ok) return store;
	const layout = cleanStore(body.layout);
	if (typeof layout === 'string') return { ok: false, message: layout };
	const all = [...layout.show.flatMap((t) => t.fish.map((f) => f.s)), ...layout.sale.flatMap((t) => t.fish)];
	if (!all.length) return { ok: false, message: 'Put some fish in your store first.' };
	// The favourite tank is the one listed; its star is the partner fish, or else the rarest fish in the store.
	const { x: _x, y: _y, ...tank } = layout.show[layout.fav];
	const withPartner = layout.show.find((t) => t.partner !== null);
	const rank = (s: string) => RARITIES.indexOf(SPECIES_BY_ID.get(s)!.rarity);
	const star = withPartner ? withPartner.fish[withPartner.partner!] : { s: [...all].sort((a, b) => rank(b) - rank(a))[0], n: undefined };
	const score = all.reduce((a, s) => a + POINTS[rank(s)], 0);
	const bond = withPartner ? Math.max(0, Math.min(100, Math.round(Number(body.bond) || 0))) : 0;
	getDb()
		.prepare(
			`INSERT INTO ifish_showcase (user_id, store, species, fish_name, rank, bond, tank, layout, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET store = excluded.store, species = excluded.species, fish_name = excluded.fish_name,
			   rank = excluded.rank, bond = excluded.bond, tank = excluded.tank, layout = excluded.layout, updated_at = excluded.updated_at`
		)
		.run(userId, store.name, star.s, star.n ?? null, score, bond, JSON.stringify(tank), JSON.stringify(layout), Date.now());
	return { ok: true };
}
