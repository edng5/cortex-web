// FishMart's simulation: the store's state, the rules (water, temperature, space,
// predators, fighting fish), timed tasks run by staff, customers buying from the sale tanks,
// the show tank and its centrepiece pet, payroll, daily rewards, shipments and saving.
//
// Time is real time: everything is stored with timestamps, and `advance()` catches the store
// up on whatever happened while the game was closed (tasks finish, customers shop, water gets
// dirty, the centrepiece gets hungry).
import {
	CHEST_ODDS,
	ALBINO_OF,
	ALBINO_ODDS,
	BREEDER_COST,
	BREEDER_TIME,
	BROOD,
	HYBRID_ODDS,
	WILD,
	breedCost,
	hatchTime,
	breedTime,
	canBreed,
	MYTHIC_CROSS,
	speciesName,
	BUILD_TASKS,
	LUCK_OWNED,
	LUCK_SHOWN,
	luckyOdds,
	LAB_COST,
	LAB_TIME,
	EVENT_DECOR_ODDS,
	eventDecor,
	EVENT_CRATE_COST,
	EVENT_ODDS,
	activeEvent,
	eventPool,
	FREE_CRATE_MAX,
	GIFT_HOURS,
	GIFT_NAMES,
	RESEARCH_MAX,
	orderPrice,
	researchCost,
	researchTime,
	type Role,
	DEFAULT_LOOK,
	OVERGROWN,
	PLANT_GROWTH,
	RESTYLE_COST,
	TANK_SHAPES,
	TRIMMED,
	TRIM_TIME,
	type TankLook,
	type TankShape,
	RESTOCK_TIME,
	SHELF_CAP,
	SHELF_UPGRADE,
	SUPPLIES,
	SUPPLY_BUY,
	type SupplyId,
	BAIT_COST,
	CATCH_ODDS,
	COMBINE_BONUS,
	COMBINE_COST,
	COMBINE_TIME,
	CRATE_COST,
	CRATE_FISH,
	CRATE_ODDS,
	DAILY_BASE,
	DAILY_STREAK,
	FLOORS,
	FOOD_COST,
	GEM_ODDS,
	GEM_SECONDS,
	EXPAND_COST,
	EXPAND_MAX,
	EXPAND_TIME,
	gridSize,
	holdMax,
	HOLDING_BASE,
	HOLDING_COST,
	HOLDING_STEP,
	MAX_SHOW_TANKS,
	MAX_STAFF,
	NET_GEMS,
	NEW_SHOW_COST,
	NEW_SHOW_TIME,
	RARITIES,
	ROLES,
	SALT_COST,
	SHOW_CAP,
	SHOW_MAX_LEVEL,
	SHOW_UNLOCK,
	SIZES,
	SIZE_UNITS,
	SPECIES,
	STAFF_NAMES,
	START_CASH,
	START_GEMS,
	STORE_DECOR,
	SUPPLIERS,
	TANK_DECOR,
	TANK_TIERS,
	WHOLESALE,
	maxSizeFor,
	priceOf,
	showUpgradeCost,
	showUpgradeTime,
	species,
	tier,
	type DecorTag,
	type Rarity,
	type Species,
	type StoreItem,
	type StoreSnapshot,
	type TankTier,
	type Temp,
	type Water
} from './data';

export const SAVE_KEY = 'ifish-save';
const HOUR = 3600_000;
/** Customers don't shop for more than this while you're away. */
const MAX_OFFLINE_SALES = 12 * HOUR;

export type Gender = 'm' | 'f';
const FAV_SAFE = "★ That's a favourite, so it can't be sold. Unstar it first.";
export const randomGender = (): Gender => (Math.random() < 0.5 ? 'm' : 'f');
export interface Fish {
	u: number;
	s: string;
	/** Male or female (for breeding). */
	g?: Gender;
	/** A favourite: kept safe from selling (no wholesale, sale tanks or market). */
	fav?: boolean;
	/** A name (show-tank fish). */
	n?: string;
	/** Hours kept in a happy show tank: sold later, well-kept fish earn gems. */
	c: number;
}
interface Placed {
	x: number;
	y: number;
}
export interface SaleTank extends Placed {
	id: number;
	tier: TankTier;
	water: Water;
	temp: Temp;
	fish: Fish[];
	clean: number;
	ready: boolean;
}
export interface ShowTank extends Placed {
	id: number;
	level: number;
	seg: number;
	water: Water;
	temp: Temp;
	fish: Fish[];
	decor: DecorTag[];
	clean: number;
	ready: boolean;
	/** Glass shape, trim, stand and lights (older saves: the classic look). */
	look?: TankLook;
	/** How grown-in the live plants are (0–100); trim them when they get overgrown. */
	growth?: number;
}
export interface Staff {
	id: number;
	name: string;
	role: string;
}
export type TaskKind = 'build' | 'upgrade' | 'clean' | 'buildShow' | 'upgradeShow' | 'combine' | 'cleanShow' | 'restock' | 'trim' | 'research' | 'buildLab' | 'buildBreeder' | 'breed' | 'expand';
/** Task reference for the supply shelf (tanks use their ids). */
export const SHELF_REF = -1;
/** Task reference for building the research lab. */
export const LAB_REF = -2;
/** Task reference for the breeding tank (building it, and breeding in it). */
export const BREED_REF = -3;
/** Task reference for expanding the store. */
export const EXPAND_REF = -4;
export interface Task {
	id: number;
	kind: TaskKind;
	label: string;
	ref: number;
	ref2?: number;
	start: number;
	end: number;
	staff: number;
	/** The species being researched. */
	sp?: string;
}
export interface Decoration extends Placed {
	id: number;
	item: StoreItem;
}
export interface Pet {
	hunger: number;
	happy: number;
	bond: number;
	play: number;
	lastPlay: number;
}
export type Loc = 'hold' | `sale:${number}` | `show:${number}`;

interface Save {
	v: 1;
	name: string;
	named: boolean;
	cash: number;
	gems: number;
	day: string;
	streak: number;
	freeCrates: number;
	last: number;
	acc: number;
	seq: number;
	holdCap: number;
	/** Store expansions done (0 to EXPAND_MAX). */
	size?: number;
	floor: string;
	floors: string[];
	sale: SaleTank[];
	show: ShowTank[];
	hold: Fish[];
	staff: Staff[];
	tasks: Task[];
	decor: Decoration[];
	center: number | null;
	pet: Pet;
	layoff: boolean;
	/** The supply shelf: where it stands, how big it is, what's on it and what's on order. */
	shelf: { x: number; y: number; level: number };
	stock: Record<SupplyId, number>;
	order: Partial<Record<SupplyId, number>>;
	suppliesSold: number;
	sold: number;
	earned: number;
	caught: string[];
	/** Every species you've ever had (the wiki). */
	found: string[];
	/** Research level (0–5) per species. */
	research: Record<string, number>;
	/** Senior aquarists start chores on their own. */
	auto: boolean;
	/** The show tank you show off in the global showcase. */
	fav: number | null;
	/** Shared your favourite tank to the showcase (it's kept up to date). */
	shared: boolean;
	/** Today's gifts: which of the morning/afternoon/evening gifts you've opened. */
	gifts: { day: string; got: number[] };
	/** The free decoration left in your main show tank: keep it or sell it. */
	giftDecor: DecorTag | null;
	decorGiven: boolean;
	/** Special decorations you own: limited editions (event crates) and mythics (treasure chests). */
	limited: DecorTag[];
	/** Unopened treasure chests in storage. */
	chests: number;
	/** The research lab (2×2), once built. */
	lab: { x: number; y: number; ready: boolean } | null;
	/** The breeding tank (2×1), once built, and the pair in it. */
	breeder: {
		x: number;
		y: number;
		ready: boolean;
		pair: Fish[];
		/** Eggs laid (what's inside isn't known until they hatch), and when they hatch. */
		eggs?: { s: string; g: Gender }[];
		hatchAt?: number;
	} | null;
	log: string[];
}

const today = (t = Date.now()) => {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00') - Date.parse(a + 'T12:00')) / 86400_000);
const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
function roll<T>(odds: [T, number][]): T {
	const total = odds.reduce((a, [, w]) => a + w, 0);
	let r = Math.random() * total;
	for (const [v, w] of odds) if ((r -= w) <= 0) return v;
	return odds[0][0];
}
const RARITY_POINTS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4, ultra: 7, epic: 12, legendary: 20, mythic: 40 };
const sizeIdx = (s: Species) => SIZES.indexOf(s.size);

function fresh(): Save {
	return {
		v: 1,
		name: 'My Fish Store',
		named: false,
		cash: START_CASH,
		gems: START_GEMS,
		day: today(),
		streak: 1,
		freeCrates: 0,
		last: Date.now(),
		acc: 0,
		seq: 10,
		holdCap: HOLDING_BASE,
		floor: 'tile',
		floors: ['tile'],
		// A starter store: one small freshwater sale tank and the main show tank.
		sale: [{ id: 1, tier: 'small', water: 'fresh', temp: 'tropical', fish: [], clean: 100, ready: true, x: 0, y: 0 }],
		show: [{ id: 2, level: 1, seg: 1, water: 'fresh', temp: 'tropical', fish: [], decor: ['gravel'], clean: 100, ready: true, x: 5, y: 2, look: { ...DEFAULT_LOOK }, growth: TRIMMED }],
		hold: [
			{ u: 3, s: 'neon-tetra', c: 0 },
			{ u: 4, s: 'neon-tetra', c: 0 },
			{ u: 5, s: 'guppy', c: 0 },
			{ u: 6, s: 'platy', c: 0 },
			{ u: 7, s: 'freshwater-angelfish', c: 0 }
		],
		staff: [{ id: 8, name: 'You', role: 'owner' }],
		tasks: [],
		decor: [],
		center: null,
		pet: { hunger: 80, happy: 50, bond: 0, play: 0, lastPlay: 0 },
		layoff: false,
		shelf: { x: 9, y: 0, level: 1 },
		stock: { food: 12, conditioner: 8, filter: 5, net: 8 },
		order: {},
		suppliesSold: 0,
		sold: 0,
		earned: 0,
		caught: [],
		found: ['neon-tetra', 'guppy', 'platy', 'freshwater-angelfish'],
		research: {},
		auto: true,
		fav: null,
		shared: false,
		gifts: { day: today(), got: [] },
		giftDecor: null,
		decorGiven: false,
		limited: [],
		chests: 0,
		lab: null,
		breeder: null,
		log: ['Welcome! Stock your sale tank and set up your show tank.']
	};
}

/** Someone else's store, rebuilt from its showcase snapshot (just enough to draw it). */
function fromSnapshot(p: StoreSnapshot, name: string): Save {
	const s = fresh();
	let u = 2000;
	const fish = (sp: string, n?: string): Fish => ({ u: ++u, s: sp, c: 0, ...(n ? { n } : {}) });
	s.name = name;
	s.named = true;
	s.size = p.size;
	s.floor = p.floor;
	s.sale = p.sale.map((t, i) => ({ id: 1 + i, tier: t.tier, water: t.water, temp: t.temp, x: t.x, y: t.y, clean: t.clean, ready: true, fish: t.fish.map((f) => fish(f)) }));
	s.center = null;
	s.show = p.show.map((t, i) => {
		const tank: ShowTank = { id: 100 + i, x: t.x, y: t.y, level: t.level, seg: t.seg, water: t.water, temp: t.temp, clean: t.clean, growth: t.growth, decor: t.decor, look: t.look, ready: true, fish: t.fish.map((f) => fish(f.s, f.n)) };
		if (t.partner !== null && tank.fish[t.partner] && s.center === null) s.center = tank.fish[t.partner].u;
		return tank;
	});
	s.fav = s.show[p.fav]?.id ?? null;
	s.decor = p.decor.map((d, i) => ({ id: 500 + i, item: d.item, x: d.x, y: d.y }));
	s.shelf = { ...p.shelf };
	s.lab = p.lab ? { ...p.lab, ready: true } : null;
	s.breeder = p.breeder ? { ...p.breeder, ready: true, pair: [] } : null;
	s.staff = p.staff.map((role, i) => ({ id: 900 + i, name: i ? '' : 'You', role }));
	s.tasks = [];
	s.pet = { ...s.pet, happy: 80 };
	return s;
}

export type Result = { ok: true; msg?: string } | { ok: false; msg: string };
const ok = (msg?: string): Result => ({ ok: true, msg });
const no = (msg: string) => ({ ok: false as const, msg });

export class FishStore {
	s = $state<Save>(fresh());
	now = $state(Date.now());
	/** Messages to pop up (sales while away, finished tasks…). */
	toast = $state<string[]>([]);

	/** A look-only copy of someone else's store (from the showcase): never saved or simulated. */
	view = false;

	constructor(snap?: StoreSnapshot, name = '') {
		if (snap) {
			this.view = true;
			this.s = fromSnapshot(snap, name);
			return;
		}
		this.load();
		this.migrate();
		this.advance(true);
		this.leaveDecor();
	}

	// ── Saving ────────────────────────────────────────────────────────────────────────
	load() {
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (raw) {
				const d = JSON.parse(raw) as Save;
				if (d && d.v === 1) this.s = { ...fresh(), ...d, stock: { ...fresh().stock, ...d.stock } };
			}
		} catch {
			/* corrupt or blocked: start fresh */
		}
	}
	/** Bring older saves up to date. */
	private migrate() {
		const s = this.s;
		// Trainees are gone: you're the owner, and the rest become builders.
		for (const p of s.staff) if (p.role === 'trainee') p.role = p.name === 'You' ? 'owner' : 'builder';
		if (!s.staff.some((p) => p.role === 'owner')) s.staff.unshift({ id: this.nextId(), name: 'You', role: 'owner' });
		// The wiki starts with everything you've caught or own.
		const all = [...s.hold, ...s.sale.flatMap((t) => t.fish), ...s.show.flatMap((t) => t.fish)].map((f) => f.s);
		s.found = [...new Set([...s.found, ...s.caught, ...all])];
		if (s.center !== null && !s.show.some((t) => t.fish.some((f) => f.u === s.center))) s.center = null;
		// Every fish is male or female (older saves: picked at random).
		for (const f of [...s.hold, ...s.sale.flatMap((t) => t.fish), ...s.show.flatMap((t) => t.fish), ...(s.breeder?.pair ?? [])]) f.g ??= randomGender();
	}
	save() {
		if (this.view) return;
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify($state.snapshot(this.s)));
		} catch {
			/* storage full or blocked */
		}
	}
	reset() {
		this.s = fresh();
		this.save();
	}
	private say(m: string) {
		this.s.log = [m, ...this.s.log].slice(0, 30);
	}
	private nextId() {
		return ++this.s.seq;
	}
	/** A new fish (with a gender). */
	private newFish(s: string, extra: Partial<Fish> = {}): Fish {
		return { u: this.nextId(), s, c: 0, g: randomGender(), ...extra };
	}
	/** Add a species to the wiki. */
	private discover(id: string) {
		if (!this.s.found.includes(id)) {
			this.s.found.push(id);
			this.toast = [...this.toast, `New in your fish wiki: ${species(id).name}!`];
		}
	}

	// ── Tanks: capacity and the rules ─────────────────────────────────────────────────
	tankAt(loc: Loc): SaleTank | ShowTank | null {
		if (loc === 'hold') return null;
		const [kind, id] = loc.split(':');
		const list = kind === 'sale' ? this.s.sale : this.s.show;
		return (list as (SaleTank | ShowTank)[]).find((t) => t.id === Number(id)) ?? null;
	}
	fishAt(loc: Loc): Fish[] {
		return loc === 'hold' ? this.s.hold : (this.tankAt(loc)?.fish ?? []);
	}
	capOf(t: SaleTank | ShowTank) {
		if ('tier' in t) return tier(t.tier).cap;
		return Math.floor(SHOW_CAP[t.level] * t.seg * (t.seg > 1 ? COMBINE_BONUS : 1));
	}
	maxSizeOf(t: SaleTank | ShowTank) {
		return 'tier' in t ? tier(t.tier).maxSize : maxSizeFor(this.capOf(t));
	}
	used(t: SaleTank | ShowTank) {
		return t.fish.reduce((a, f) => a + SIZE_UNITS[species(f.s).size], 0);
	}
	decorSlots(t: ShowTank) {
		return 4 + t.seg * 2;
	}
	holdCap() {
		return this.s.holdCap;
	}

	/** Can this fish live in this tank? Water, temperature, size, space and tankmates. */
	check(t: SaleTank | ShowTank, sp: Species, ignoreUid?: number): Result {
		if (!t.ready) return no('That tank is still being set up.');
		if (sp.water !== t.water) return no(`${sp.name} is a ${sp.water === 'salt' ? 'saltwater' : 'freshwater'} fish; this tank is ${t.water === 'salt' ? 'saltwater' : 'freshwater'}.`);
		if (sp.temp !== t.temp) return no(`${sp.name} needs ${sp.temp === 'cold' ? 'cool, unheated' : 'warm, heated'} water; this tank is ${t.temp === 'cold' ? 'coldwater' : 'tropical'}.`);
		const max = this.maxSizeOf(t);
		if (SIZES.indexOf(sp.size) > SIZES.indexOf(max)) return no(`${sp.name} (${sp.size}) is too big for this tank (fits up to ${max}).`);
		const mates = t.fish.filter((f) => f.u !== ignoreUid).map((f) => species(f.s));
		const used = mates.reduce((a, m) => a + SIZE_UNITS[m.size], 0);
		if (used + SIZE_UNITS[sp.size] > this.capOf(t)) return no(`Not enough room: ${sp.name} needs ${SIZE_UNITS[sp.size]} space and only ${this.capOf(t) - used} is free.`);
		if (sp.alone && mates.length) return no(`${sp.name} is too aggressive for tankmates: it needs a tank to itself.`);
		const loner = mates.find((m) => m.alone);
		if (loner) return no(`${loner.name} attacks tankmates: it has to live alone.`);
		// Varieties are the same species (a Halfmoon Betta is still a Betta splendens).
		const kind = (x: Species) => x.sci.replace(/\s*\(.*\)$/, '');
		const rival = sp.single && mates.find((m) => m.single && kind(m) === kind(sp));
		if (rival) return no(`${sp.name} would fight the ${rival.name}: only one ${kind(sp)} per tank.`);
		const eats = (pred: Species, prey: Species) => {
			if (!pred.predator) return false;
			const p = sizeIdx(pred);
			return sizeIdx(prey) <= (p >= 3 ? p - 2 : p - 1);
		};
		const hunter = mates.find((m) => eats(m, sp));
		if (hunter) return no(`${hunter.name} would eat ${sp.name}.`);
		const prey = mates.find((m) => eats(sp, m));
		if (prey) return no(`${sp.name} would eat the ${prey.name}.`);
		return ok();
	}

	/** Move a fish between the backroom and tanks. */
	move(uid: number, from: Loc, to: Loc): Result {
		if (from === to) return ok();
		const src = this.fishAt(from);
		const fish = src.find((f) => f.u === uid);
		if (!fish) return no('That fish is gone.');
		const partner = fish.u === this.s.center;
		if (fish.fav && to.startsWith('sale')) return no(FAV_SAFE);
		if (partner && to.startsWith('sale')) return no("Your partner fish isn't for sale. Move it to another show tank or the backroom.");
		const sp = species(fish.s);
		if (to === 'hold') {
			if (this.s.hold.length >= this.holdCap()) return no('The backroom is full.');
		} else {
			const t = this.tankAt(to);
			if (!t) return no('No such tank.');
			const c = this.check(t, sp);
			if (!c.ok) return c;
		}
		src.splice(src.indexOf(fish), 1);
		this.fishAt(to).push(fish);
		if (partner && to === 'hold') {
			this.s.center = null;
			this.say(`${fish.n ?? sp.name} left its tank and is no longer your partner fish.`);
		}
		this.save();
		return ok();
	}

	/** Sell a backroom fish to a wholesaler (well under shop price). */
	// ── The online fish market (the server keeps the listings) ───────────────────────
	/** Where a fish is (backroom or a tank), so it can be taken out. */
	findFish(uid: number): { list: Fish[]; fish: Fish } | null {
		for (const list of [this.s.hold, ...this.s.sale.map((t) => t.fish), ...this.s.show.map((t) => t.fish)]) {
			const fish = list.find((f) => f.u === uid);
			if (fish) return { list, fish };
		}
		return null;
	}
	/** Take a fish out of the store to put it up for sale. */
	takeForSale(uid: number): Result {
		if (uid === this.s.center) return no("Your partner fish isn't for sale. Choose another partner first.");
		const at = this.findFish(uid);
		if (!at) return no('That fish is gone.');
		if (at.fish.fav) return no(FAV_SAFE);
		at.list.splice(at.list.indexOf(at.fish), 1);
		this.save();
		return ok();
	}
	/** A fish arriving (bought, or an unsold one taken back): into the backroom. */
	receive(speciesId: string, name: string | null, force = false): Result {
		if (!force && this.s.hold.length >= this.holdCap()) return no('The backroom is full: make room first.');
		this.s.hold.push(this.newFish(species(speciesId).id, name ? { n: name } : {}));
		this.discover(species(speciesId).id);
		this.save();
		return ok();
	}
	canAfford(price: number, currency: 'cash' | 'gems') {
		return (currency === 'gems' ? this.s.gems : this.s.cash) >= price;
	}
	pay(price: number, currency: 'cash' | 'gems', sign = -1) {
		if (currency === 'gems') this.s.gems += sign * price;
		else this.s.cash += sign * price;
		if (sign > 0 && currency === 'cash') this.s.earned += price;
		this.save();
	}
	/** Star (or unstar) a fish as a favourite. */
	toggleFav(uid: number) {
		const f = this.findFish(uid)?.fish;
		if (!f) return;
		if (f.fav) delete f.fav;
		else f.fav = true;
		this.save();
	}
	wholesale(uid: number): Result {
		const i = this.s.hold.findIndex((f) => f.u === uid);
		if (i < 0) return no('That fish is gone.');
		if (this.s.hold[i].fav) return no(FAV_SAFE);
		const sp = species(this.s.hold[i].s);
		const cash = Math.round(priceOf(sp) * WHOLESALE);
		this.s.hold.splice(i, 1);
		this.s.cash += cash;
		this.say(`Sold a ${sp.name} to a wholesaler for $${cash}.`);
		this.save();
		return ok(`+$${cash}`);
	}

	// ── The show tank and its centrepiece ─────────────────────────────────────────────
	get main(): ShowTank {
		return this.s.show[0];
	}
	/** The show tank your partner fish lives in. */
	get petTank(): ShowTank | null {
		return this.s.center === null ? null : (this.s.show.find((t) => t.fish.some((f) => f.u === this.s.center)) ?? null);
	}
	get centerFish(): Fish | null {
		return this.petTank?.fish.find((f) => f.u === this.s.center) ?? null;
	}
	/** The show tank you show off in the showcase (your main one until you pick another). */
	get favTank(): ShowTank {
		return this.s.show.find((t) => t.id === this.s.fav) ?? this.main;
	}
	/** Your whole store as the showcase shows it. */
	snapshot(): StoreSnapshot {
		const s = this.s;
		const fav = Math.max(0, s.show.indexOf(this.favTank));
		return {
			size: this.size,
			floor: s.floor,
			sale: s.sale.map((t) => ({ tier: t.tier, water: t.water, temp: t.temp, x: t.x, y: t.y, clean: Math.round(t.clean), fish: t.fish.map((f) => f.s) })),
			show: s.show.map((t) => {
				const pi = t.fish.findIndex((f) => f.u === s.center);
				return {
					x: t.x,
					y: t.y,
					water: t.water,
					temp: t.temp,
					level: t.level,
					seg: t.seg,
					clean: Math.round(t.clean),
					growth: Math.round(t.growth ?? TRIMMED),
					decor: t.decor,
					look: this.lookOf(t),
					fish: t.fish.map((f) => ({ s: f.s, ...(f.n ? { n: f.n } : {}) })),
					partner: pi < 0 ? null : pi
				};
			}),
			fav,
			decor: s.decor.map((d) => ({ item: d.item, x: d.x, y: d.y })),
			shelf: { ...s.shelf },
			lab: s.lab ? { x: s.lab.x, y: s.lab.y } : null,
			breeder: s.breeder ? { x: s.breeder.x, y: s.breeder.y } : null,
			staff: s.staff.map((p) => p.role)
		};
	}
	setFav(id: number): Result {
		if (!this.s.show.some((t) => t.id === id)) return no('No such tank.');
		this.s.fav = id;
		this.save();
		return ok('This is now your favourite show tank: the one everyone sees in the showcase.');
	}
	setCenter(uid: number, name?: string): Result {
		const f = this.s.show.flatMap((t) => t.fish).find((x) => x.u === uid);
		if (!f) return no('Put the fish in a show tank first.');
		if (this.s.center !== uid) this.s.pet = { hunger: 70, happy: 40, bond: 0, play: 0, lastPlay: 0 };
		this.s.center = uid;
		if (name) f.n = name;
		this.save();
		return ok();
	}
	feed(): Result {
		const home = this.petTank;
		if (!home || !this.centerFish) return no('Choose a partner fish first.');
		// Feeding takes a tin of fish food from the supply shelf.
		if (this.s.stock.food < 1) return no('Out of fish food! Restock the supply shelf.');
		this.s.stock.food--;
		const p = this.s.pet;
		if (p.hunger > 85) {
			// Overfeeding fouls the water.
			home.clean = clamp(home.clean - 8);
			p.happy = clamp(p.happy - 3);
			p.hunger = 100;
			this.save();
			return ok('Too much food! Uneaten food is dirtying the water.');
		}
		p.hunger = clamp(p.hunger + 35);
		this.save();
		return ok('Yum!');
	}
	play(): Result {
		if (!this.centerFish) return no('Choose a partner fish first.');
		const p = this.s.pet;
		const wait = p.lastPlay + 30 * 60_000 - Date.now();
		if (wait > 0) return no(`${this.centerFish.n ?? 'Your fish'} wants a rest. Play again in ${Math.ceil(wait / 60_000)} min.`);
		p.play = 100;
		p.lastPlay = Date.now();
		p.happy = clamp(p.happy + 4);
		this.save();
		return ok('It follows your finger along the glass!');
	}
	/** How well the centrepiece's tank suits it: liked decorations present. */
	decorMatch(): number {
		const f = this.centerFish;
		if (!f) return 0;
		const likes = species(f.s).likes;
		const has = this.petTank!.decor;
		// A reef is coral too.
		return likes.filter((l) => has.includes(l) || (l === 'coral' && has.includes('reef'))).length / likes.length;
	}
	petTarget(): number {
		const p = this.s.pet;
		const home = this.petTank;
		if (!home) return 0;
		const crowd = this.used(home) / this.capOf(home);
		return clamp(0.35 * p.hunger + 0.3 * home.clean + 20 * this.decorMatch() + 0.1 * p.play + (crowd < 0.85 ? 5 : 0));
	}
	addDecor(showId: number, tag: DecorTag): Result {
		const t = this.s.show.find((x) => x.id === showId);
		if (!t) return no('No such tank.');
		const d = TANK_DECOR.find((x) => x.id === tag)!;
		if (t.decor.includes(tag)) return no('Already in this tank.');
		if (d.water && d.water !== t.water) return no(`${d.name} is for ${d.water === 'salt' ? 'saltwater' : 'freshwater'} tanks.`);
		if (t.decor.length >= this.decorSlots(t)) return no('No more room for decorations in this tank.');
		if (this.s.cash < d.cost) return no('Not enough cash.');
		this.s.cash -= d.cost;
		t.decor.push(tag);
		this.save();
		return ok();
	}
	/** Change a show tank's decorations to exactly `want` (new ones are bought; removed ones aren't refunded). */
	setDecor(showId: number, want: DecorTag[]): Result {
		const t = this.s.show.find((x) => x.id === showId);
		if (!t) return no('No such tank.');
		const adds = want.filter((d) => !t.decor.includes(d));
		const wrong = want.map((d) => TANK_DECOR.find((x) => x.id === d)!).find((d) => d.water && d.water !== t.water);
		if (wrong) return no(`${wrong.name} is for ${wrong.water === 'salt' ? 'saltwater' : 'freshwater'} tanks.`);
		const notOwned = adds.map((d) => TANK_DECOR.find((x) => x.id === d)!).find((d) => d.limited && !this.s.limited.includes(d.id));
		if (notOwned) return no(`${notOwned.name} is a limited edition: it only comes in holiday event crates.`);
		if (want.length > this.decorSlots(t)) return no(`This tank has room for ${this.decorSlots(t)} decorations.`);
		const cost = adds.reduce((a, d) => a + this.decorPrice(d), 0);
		if (this.s.cash < cost) return no(`That comes to $${cost}: not enough cash.`);
		this.s.cash -= cost;
		t.decor = [...want];
		this.save();
		return ok(cost ? `Decorations updated for $${cost}.` : 'Decorations updated.');
	}
	/** What adding a decoration costs: limited editions you own are free to place. */
	decorPrice(tag: DecorTag) {
		const d = TANK_DECOR.find((x) => x.id === tag)!;
		return d.limited ? 0 : d.cost;
	}
	/** A one-off present: a decoration left in your main show tank (if there's room for one). */
	private leaveDecor() {
		if (this.s.decorGiven) return;
		const t = this.main;
		if (!t || t.decor.length >= this.decorSlots(t)) return;
		const options = TANK_DECOR.filter((d) => !d.limited && !t.decor.includes(d.id) && (!d.water || d.water === t.water) && d.cost >= 50);
		if (!options.length) return;
		const d = pick(options);
		t.decor.push(d.id);
		this.s.giftDecor = d.id;
		this.s.decorGiven = true;
		this.toast = [...this.toast, `🎁 Someone left a free ${d.name} in your main show tank! Keep it or sell it.`];
		this.save();
	}
	/** What selling the free decoration pays. */
	giftDecorValue() {
		const d = TANK_DECOR.find((x) => x.id === this.s.giftDecor);
		return d ? Math.round(d.cost / 2) : 0;
	}
	keepGiftDecor() {
		this.s.giftDecor = null;
		this.save();
	}
	sellGiftDecor(): Result {
		const tag = this.s.giftDecor;
		if (!tag) return no('Nothing to sell.');
		const cash = this.giftDecorValue();
		this.s.giftDecor = null;
		for (const t of this.s.show) t.decor = t.decor.filter((d) => d !== tag || t !== this.main);
		this.s.cash += cash;
		this.save();
		return ok(`Sold it for $${cash}.`);
	}
	removeDecor(showId: number, tag: DecorTag) {
		const t = this.s.show.find((x) => x.id === showId);
		if (t) t.decor = t.decor.filter((d) => d !== tag);
		this.save();
	}

	/** How nice a show tank is (0–100): clean water, decorations, rare fish, a happy centrepiece. */
	/** Clean-up crew (shrimp, snails, crabs) each slow algae and grime by 15%, up to 60%. */
	cleaners(fish: { s: string }[]) {
		return fish.filter((f) => species(f.s).cleaner).length;
	}
	dirtRate(fish: { s: string }[]) {
		return 1 - Math.min(0.6, this.cleaners(fish) * 0.15);
	}
	lookOf(t: ShowTank): TankLook {
		return { ...DEFAULT_LOOK, ...t.look };
	}
	/** Live plants: lush (grown in) looks great; overgrown crowds the fish and looks messy. */
	plantEffect(t: ShowTank) {
		if (!t.decor.includes('plants')) return 0;
		const g = t.growth ?? TRIMMED;
		if (g > OVERGROWN) return -Math.round((g - OVERGROWN) * 0.6);
		return g >= 45 ? 5 : 2;
	}
	overgrown(t: ShowTank) {
		return t.decor.includes('plants') && (t.growth ?? 0) > OVERGROWN;
	}
	niceness(t: ShowTank): number {
		const beauty = Math.min(1, t.decor.reduce((a, d) => a + TANK_DECOR.find((x) => x.id === d)!.beauty, 0) / 45);
		const rarity = Math.min(1, t.fish.reduce((a, f) => a + RARITY_POINTS[species(f.s).rarity], 0) / 40);
		const shape = TANK_SHAPES.find((x) => x.id === this.lookOf(t).shape)!.beauty;
		const base = 0.3 * t.clean + 20 * beauty + 15 * rarity + shape + this.plantEffect(t);
		if (t === this.petTank) return clamp(base + 0.25 * this.s.pet.happy + 0.1 * this.s.pet.bond);
		if (t === this.main && !this.centerFish) return base * 0.6;
		return clamp(base + (t.fish.length ? 0.35 * t.clean : 0));
	}
	storeAppeal() {
		const items = this.s.decor.reduce((a, d) => a + STORE_DECOR.find((x) => x.id === d.item)!.appeal, 0);
		return Math.min(30, items + (FLOORS.find((f) => f.id === this.s.floor)?.appeal ?? 0));
	}
	popularity(): number {
		const shows = this.s.show.filter((t) => t.ready);
		const avg = shows.length ? shows.reduce((a, t) => a + this.niceness(t), 0) / shows.length : 0;
		const segs = this.s.show.reduce((a, t) => a + t.seg, 0);
		return Math.round(clamp(0.7 * avg + this.storeAppeal() + 3 * (segs - 1)));
	}
	customersPerHour() {
		return 4 + this.popularity() * 0.5;
	}

	// ── Staff and timed tasks ─────────────────────────────────────────────────────────
	role(id: string): Role {
		return ROLES.find((r) => r.id === id) ?? ROLES[0];
	}
	canDo(p: Staff, kind: TaskKind) {
		const d = this.role(p.role).does;
		if (kind === 'research' || kind === 'breed') return d === 'research';
		return d === 'all' || (d === 'build' && BUILD_TASKS.includes(kind));
	}
	/** How many staff are free to do this kind of task right now. */
	freeFor(kind: TaskKind) {
		const busy = new Set(this.s.tasks.map((t) => t.staff));
		return this.s.staff.filter((p) => !busy.has(p.id) && this.canDo(p, kind)).length;
	}
	wages() {
		return this.s.staff.reduce((a, p) => a + this.role(p.role).wage, 0);
	}
	freeStaff(kind?: TaskKind): Staff | null {
		const busy = new Set(this.s.tasks.map((t) => t.staff));
		const free = this.s.staff.filter((p) => !busy.has(p.id) && (!kind || this.canDo(p, kind)));
		// The specialists first (builders build), then the fastest.
		const narrow = (p: Staff) => (this.role(p.role).does === 'all' ? 0 : 1);
		free.sort((a, b) => narrow(b) - narrow(a) || this.role(b.role).speed - this.role(a.role).speed);
		return free[0] ?? null;
	}
	hire(roleId: string): Result {
		const r = this.role(roleId);
		if (r.id === 'owner') return no("There's only one of you.");
		if (this.s.layoff) return no("You can't hire while payroll is short.");
		if (this.s.staff.length >= MAX_STAFF) return no('The store is fully staffed.');
		if (this.s.cash < r.hire) return no(`Hiring a ${r.name} costs $${r.hire}.`);
		this.s.cash -= r.hire;
		const used = new Set(this.s.staff.map((p) => p.name));
		const name = STAFF_NAMES.find((n) => !used.has(n)) ?? `Staff ${this.s.staff.length + 1}`;
		this.s.staff.push({ id: this.nextId(), name, role: roleId });
		this.say(`Hired ${name} (${r.name}).`);
		this.save();
		return ok();
	}
	layoff(id: number): Result {
		if (this.s.staff.length <= 1) return no('You need at least one employee to run the store.');
		if (this.s.tasks.some((t) => t.staff === id)) return no('They are busy with a task. Lay them off when it finishes.');
		const p = this.s.staff.find((x) => x.id === id);
		if (p?.role === 'owner') return no("You can't lay yourself off!");
		this.s.staff = this.s.staff.filter((x) => x.id !== id);
		if (p) this.say(`Laid off ${p.name}.`);
		this.checkPayroll();
		this.save();
		return ok();
	}
	private checkPayroll() {
		if (this.s.layoff && (this.wages() <= this.s.cash || this.s.staff.length <= 1)) this.s.layoff = false;
	}
	private startTask(kind: TaskKind, label: string, seconds: number, ref: number, ref2?: number, by?: Staff, sp?: string): Result {
		if (this.s.tasks.some((t) => t.ref === ref || t.ref2 === ref || (ref2 && (t.ref === ref2 || t.ref2 === ref2)))) return no('Someone is already working on that.');
		const who = by ?? this.freeStaff(kind);
		if (!who) {
			if (kind === 'research' || kind === 'breed') return no(this.s.staff.some((p) => this.role(p.role).does === 'research') ? 'Your scientists are all busy.' : `Hire a Research Scientist (Staff tab) to ${kind === 'breed' ? 'breed' : 'research'} fish.`);
			if (!this.s.staff.some((p) => this.canDo(p, kind))) return no('Builders only build: hire an Aquarist for that.');
			return no('Everyone who can do that is busy. Hire more staff or wait for a task to finish.');
		}
		const dur = Math.round((seconds * 1000) / this.role(who.role).speed);
		this.s.tasks.push({ id: this.nextId(), kind, label, ref, ref2, start: Date.now(), end: Date.now() + dur, staff: who.id, ...(sp ? { sp } : {}) });
		this.save();
		return ok(`${who.name} started: ${label}.`);
	}
	gemsToFinish(t: Task) {
		return Math.max(1, Math.ceil((t.end - this.now) / 1000 / GEM_SECONDS));
	}
	rush(taskId: number): Result {
		const t = this.s.tasks.find((x) => x.id === taskId);
		if (!t) return no('That task is already done.');
		const g = this.gemsToFinish(t);
		if (this.s.gems < g) return no(`That needs ${g} gems.`);
		this.s.gems -= g;
		t.end = Date.now();
		this.advance();
		return ok();
	}
	private finishTask(t: Task) {
		const sale = this.s.sale.find((x) => x.id === t.ref);
		const show = this.s.show.find((x) => x.id === t.ref);
		switch (t.kind) {
			case 'build':
				if (sale) sale.ready = true;
				break;
			case 'upgrade':
				if (sale) {
					const i = TANK_TIERS.findIndex((x) => x.id === sale.tier);
					sale.tier = TANK_TIERS[Math.min(TANK_TIERS.length - 1, i + 1)].id;
					sale.ready = true;
				}
				break;
			case 'clean':
				if (sale) sale.clean = 100;
				break;
			case 'cleanShow':
				if (show) show.clean = 100;
				break;
			case 'trim':
				if (show) show.growth = TRIMMED;
				break;
			case 'buildLab':
				if (this.s.lab) this.s.lab.ready = true;
				break;
			case 'expand':
				this.s.size = Math.min(EXPAND_MAX, this.size + 1);
				this.toast = [...this.toast, `🏗️ The store is bigger! More floor space, room for ${holdMax(this.size) - holdMax(this.size - 1)} more fish on backroom shelving, and another show tank slot.`];
				break;
			case 'buildBreeder':
				if (this.s.breeder) this.s.breeder.ready = true;
				break;
			case 'breed':
				this.layEggs();
				break;
			case 'research':
				if (t.sp) this.s.research[t.sp] = Math.min(RESEARCH_MAX, (this.s.research[t.sp] ?? 0) + 1);
				break;
			case 'restock':
				for (const x of SUPPLIES) this.s.stock[x.id] = Math.min(this.shelfCap(), this.s.stock[x.id] + (this.s.order[x.id] ?? 0));
				this.s.order = {};
				break;
			case 'buildShow':
				if (show) show.ready = true;
				break;
			case 'upgradeShow':
				if (show) {
					show.level = Math.min(SHOW_MAX_LEVEL, show.level + 1);
					show.ready = true;
				}
				break;
			case 'combine': {
				const b = this.s.show.find((x) => x.id === t.ref2);
				if (show && b) {
					show.level = Math.max(1, Math.floor((show.level * show.seg + b.level * b.seg) / (show.seg + b.seg)));
					show.seg += b.seg;
					show.fish.push(...b.fish);
					show.decor = [...new Set([...show.decor, ...b.decor])].slice(0, this.decorSlots(show));
					show.clean = Math.min(show.clean, b.clean);
					this.s.show = this.s.show.filter((x) => x !== b);
					show.ready = true;
				}
				break;
			}
		}
		this.toast = [...this.toast, `Done: ${t.label}`];
		this.say(`Finished: ${t.label}.`);
	}

	// ── The store floor ───────────────────────────────────────────────────────────────
	footprint(kind: 'sale' | 'show' | 'decor', o: { tier?: TankTier; seg?: number }): [number, number] {
		if (kind === 'sale') return [tier(o.tier!).w, 1];
		if (kind === 'show') return [Math.min(this.gw(), 2 * (o.seg ?? 1)), 2];
		return [1, 1];
	}
	/** Cells taken, except by `skip`. */
	private taken(skip?: object): boolean[][] {
		const g = Array.from({ length: this.gh() }, () => new Array(this.gw()).fill(false));
		const mark = (x: number, y: number, w: number, h: number) => {
			for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i < this.gw()) g[j][i] = true;
		};
		// The counter and the door are fixed.
		mark(0, this.gh() - 1, 2, 1);
		mark(5, this.gh() - 1, 2, 1);
		for (const t of this.s.sale) if (t !== skip) mark(t.x, t.y, ...this.footprint('sale', t));
		for (const t of this.s.show) if (t !== skip) mark(t.x, t.y, ...this.footprint('show', t));
		for (const d of this.s.decor) if (d !== skip) mark(d.x, d.y, 1, 1);
		if (this.s.shelf !== skip) mark(this.s.shelf.x, this.s.shelf.y, 2, 1);
		if (this.s.lab && this.s.lab !== skip) mark(this.s.lab.x, this.s.lab.y, 2, 2);
		if (this.s.breeder && this.s.breeder !== skip) mark(this.s.breeder.x, this.s.breeder.y, 2, 1);
		return g;
	}
	/** Where people can walk on the floor (true = blocked by a tank, decoration or the counter). Rugs can be walked on. */
	walkGrid(): boolean[][] {
		const g = Array.from({ length: this.gh() }, () => new Array(this.gw()).fill(false));
		const mark = (x: number, y: number, w: number, h: number) => {
			for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < this.gw()) g[j][i] = true;
		};
		mark(0, this.gh() - 1, 2, 1);
		for (const t of this.s.sale) mark(t.x, t.y, ...this.footprint('sale', t));
		for (const t of this.s.show) mark(t.x, t.y, ...this.footprint('show', t));
		for (const d of this.s.decor) if (d.item !== 'rug') mark(d.x, d.y, 1, 1);
		mark(this.s.shelf.x, this.s.shelf.y, 2, 1);
		if (this.s.lab) mark(this.s.lab.x, this.s.lab.y, 2, 2);
		if (this.s.breeder) mark(this.s.breeder.x, this.s.breeder.y, 2, 1);
		return g;
	}
	fits(x: number, y: number, w: number, h: number, skip?: object) {
		if (x < 0 || y < 0 || x + w > this.gw() || y + h > this.gh()) return false;
		const g = this.taken(skip);
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j][i]) return false;
		return true;
	}
	findSpot(w: number, h: number, skip?: object): Placed | null {
		for (let y = 0; y <= this.gh() - h; y++) for (let x = 0; x <= this.gw() - w; x++) if (this.fits(x, y, w, h, skip)) return { x, y };
		return null;
	}
	moveShelf(x: number, y: number): Result {
		if (!this.fits(x, y, 2, 1, this.s.shelf)) return no("It doesn't fit there.");
		this.s.shelf.x = x;
		this.s.shelf.y = y;
		this.save();
		return ok();
	}
	moveLab(x: number, y: number): Result {
		const lab = this.s.lab;
		if (!lab) return no('No lab yet.');
		if (!this.fits(x, y, 2, 2, lab)) return no("It doesn't fit there.");
		lab.x = x;
		lab.y = y;
		this.save();
		return ok();
	}
	moveBreeder(x: number, y: number): Result {
		const b = this.s.breeder;
		if (!b) return no('No breeding tank yet.');
		if (!this.fits(x, y, 2, 1, b)) return no("It doesn't fit there.");
		b.x = x;
		b.y = y;
		this.save();
		return ok();
	}
	/** Build the breeding tank (one per store). */
	buildBreeder(): Result {
		if (this.s.breeder) return no('You already have a breeding tank.');
		if (this.s.cash < BREEDER_COST) return no(`The breeding tank costs $${BREEDER_COST}.`);
		const spot = this.findSpot(2, 1);
		if (!spot) return no('No free floor space (the breeding tank needs 2×1). Move things around in Layout mode.');
		const r = this.startTask('buildBreeder', 'Build the breeding tank', BREEDER_TIME, BREED_REF);
		if (!r.ok) return r;
		this.s.cash -= BREEDER_COST;
		this.s.breeder = { ...spot, ready: false, pair: [] };
		this.save();
		return r;
	}

	// ── Breeding ─────────────────────────────────────────────────────────────────────
	/** Can these two fish breed right now? */
	breedCheck(maleUid: number, femaleUid: number): Result {
		const m = this.findFish(maleUid)?.fish;
		const f = this.findFish(femaleUid)?.fish;
		if (!m || !f) return no('Pick a male and a female.');
		if (m.g !== 'm' || f.g !== 'f') return no('You need one male (♂) and one female (♀).');
		if (m.u === this.s.center || f.u === this.s.center) return no('Your partner fish is busy being a pet.');
		const c = canBreed(species(m.s), species(f.s));
		return c.ok ? ok(c.cross ? 'A crossbreed!' : undefined) : no(c.why);
	}
	/** Start breeding a pair: they move into the breeding tank, and a scientist looks after them. */
	breed(maleUid: number, femaleUid: number): Result {
		const b = this.s.breeder;
		if (!b) return no('Build a breeding tank first (Build & buy).');
		if (!b.ready) return no('The breeding tank is still being built.');
		if (b.pair.length || this.s.tasks.some((t) => t.ref === BREED_REF)) return no('The breeding tank is busy.');
		if (b.eggs?.length) return no('Wait for the eggs to hatch first.');
		const c = this.breedCheck(maleUid, femaleUid);
		if (!c.ok) return c;
		const m = this.findFish(maleUid)!;
		const f = this.findFish(femaleUid)!;
		const [a, z] = [species(m.fish.s), species(f.fish.s)];
		// Room in the backroom for the parents and the biggest brood when they're done.
		const fromHold = [m, f].filter((x) => x.list === this.s.hold).length;
		const room = this.holdCap() - (this.s.hold.length - fromHold);
		const need = 2 + Math.max(BROOD[a.size], BROOD[z.size]);
		if (room < need) return no(`Make room in the backroom first: the parents and babies need ${need} spaces.`);
		const cost = breedCost(a, z);
		if (this.s.cash < cost) return no(`Breeding costs $${cost}.`);
		const label = a.id === z.id ? `Breed ${a.name}s` : `Crossbreed ${a.name} × ${z.name}`;
		const r = this.startTask('breed', label, breedTime(a, z), BREED_REF);
		if (!r.ok) return r;
		this.s.cash -= cost;
		for (const x of [m, f]) x.list.splice(x.list.indexOf(x.fish), 1);
		b.pair = [m.fish, f.fish];
		this.save();
		return r;
	}
	/** The pair has spawned: the parents go back to the backroom and a clutch of eggs stays in the tank. */
	private layEggs() {
		const b = this.s.breeder;
		if (!b || b.pair.length < 2) return;
		const [a, z] = b.pair.map((f) => species(f.s));
		const n = 1 + Math.floor(Math.random() * Math.max(BROOD[a.size], BROOD[z.size]));
		const kids: { s: string; g: Gender }[] = [];
		const how = canBreed(a, z);
		const top = Math.max(RARITIES.indexOf(a.rarity), RARITIES.indexOf(z.rarity));
		for (let i = 0; i < n; i++) {
			let sp = Math.random() < 0.5 ? a : z;
			if (how.ok && how.kind === 'legend' && Math.random() < MYTHIC_CROSS.odds * (1 + this.luck() / 100)) {
				// The legend: two legendary arowanas, and a dragon.
				sp = species(MYTHIC_CROSS.makes);
			} else if (how.ok && how.kind === 'strains' && Math.random() < HYBRID_ODDS) {
				// Mixing strains of one species sometimes brings out another of its strains.
				const kin = WILD.filter((s) => speciesName(s) === speciesName(a) && RARITIES.indexOf(s.rarity) <= top && s.id !== a.id && s.id !== z.id);
				if (kin.length) sp = pick(kin);
			} else if (how.ok && how.kind === 'hybrid' && Math.random() < HYBRID_ODDS) {
				// Real hybrids: the named ones (Flowerhorn, Alien Betta…) when the group has them.
				const named = (how.group?.makes ?? []).map((id) => species(id)).filter((s) => s.water === a.water && RARITIES.indexOf(s.rarity) <= top + 1);
				if (named.length) sp = pick(named);
			}
			// Very rarely: an albino (luck helps).
			const albino = ALBINO_OF[sp.id];
			if (albino && Math.random() < ALBINO_ODDS * (1 + this.luck() / 100)) sp = species(albino);
			kids.push({ s: sp.id, g: randomGender() });
		}
		this.s.hold.push(...b.pair);
		b.pair = [];
		b.eggs = kids;
		b.hatchAt = Date.now() + hatchTime(a, z) * 1000;
		this.toast = [...this.toast, `🥚 ${kids.length} egg${kids.length === 1 ? '' : 's'} laid in the breeding tank! The parents are back in the backroom.`];
		this.say(`${a.name} and ${z.name} laid ${kids.length} egg${kids.length === 1 ? '' : 's'}.`);
	}
	/** Gems to hatch the eggs right now. */
	gemsToHatch() {
		const at = this.s.breeder?.hatchAt ?? 0;
		return Math.max(1, Math.ceil((at - this.now) / 1000 / GEM_SECONDS));
	}
	hatchNow(): Result {
		const b = this.s.breeder;
		if (!b?.eggs?.length) return no('No eggs to hatch.');
		const g = this.gemsToHatch();
		if (this.s.gems < g) return no(`That needs ${g} gems.`);
		this.s.gems -= g;
		b.hatchAt = Date.now();
		this.hatchEggs();
		this.save();
		return ok();
	}
	/** Eggs whose time has come hatch into the backroom (as many as there's room for). */
	private hatchEggs() {
		const b = this.s.breeder;
		if (!b?.eggs?.length || (b.hatchAt ?? 0) > Date.now()) return;
		const room = this.holdCap() - this.s.hold.length;
		if (room <= 0) return;
		const out = b.eggs.slice(0, room);
		b.eggs = b.eggs.slice(room);
		const kids = out.map((e) => this.newFish(e.s, { g: e.g }));
		this.s.hold.push(...kids);
		for (const k of kids) this.discover(k.s);
		const names = kids.map((k) => species(k.s).name);
		const rare = kids.filter((k) => species(k.s).bred);
		this.toast = [
			...this.toast,
			`🐣 ${kids.length} bab${kids.length === 1 ? 'y' : 'ies'} hatched: ${names.join(', ')}!${b.eggs.length ? ` ${b.eggs.length} more waiting for room in the backroom.` : ''}`,
			...rare.map((k) => (species(k.s).rarity === 'mythic' ? `🐉 The legend is true: a ${species(k.s).name} hatched!` : `✨ A very rare ${species(k.s).name}!`))
		];
		this.say(`Hatched ${names.join(', ')}.`);
	}

	/** Store expansions done so far. */
	get size() {
		return this.s.size ?? 0;
	}
	/** The floor's columns and rows (it grows with each expansion). */
	gw() {
		return gridSize(this.size)[0];
	}
	gh() {
		return gridSize(this.size)[1];
	}
	/** The most show tanks (slots) you can ever have: more with each expansion. */
	maxShow() {
		return MAX_SHOW_TANKS + this.size;
	}
	/** Expand the store: a builder knocks through a wall. Everything you've placed stays where it is. */
	expand(): Result {
		if (this.size >= EXPAND_MAX) return no(`The store is as big as it gets (${EXPAND_MAX} expansions).`);
		const cost = EXPAND_COST[this.size];
		if (this.s.cash < cost) return no(`The next expansion costs $${cost.toLocaleString()}.`);
		const r = this.startTask('expand', `Expand the store (${this.size + 1}/${EXPAND_MAX})`, EXPAND_TIME[this.size], EXPAND_REF);
		if (!r.ok) return r;
		this.s.cash -= cost;
		this.save();
		return r;
	}

	/** Build the research lab (one per store; every scientist works in it). */
	buildLab(): Result {
		if (this.s.lab) return no('You already have a research lab.');
		if (this.s.cash < LAB_COST) return no(`The lab costs $${LAB_COST}.`);
		const spot = this.findSpot(2, 2);
		if (!spot) return no('No free floor space (the lab needs 2×2). Move things around in Layout mode.');
		const r = this.startTask('buildLab', 'Build the research lab', LAB_TIME, LAB_REF);
		if (!r.ok) return r;
		this.s.cash -= LAB_COST;
		this.s.lab = { ...spot, ready: false };
		this.save();
		return r;
	}
	shelfCap() {
		return SHELF_CAP[this.s.shelf.level];
	}
	/** What a full restock would cost now. */
	restockCost() {
		return SUPPLIES.reduce((a, x) => a + Math.max(0, this.shelfCap() - this.s.stock[x.id]) * x.cost, 0);
	}
	/** Order supplies to fill the shelf (as much as you can afford); a staff member stocks it. */
	restock(by?: Staff): Result {
		const order: Partial<Record<SupplyId, number>> = {};
		let cost = 0;
		for (const x of SUPPLIES) {
			const want = Math.max(0, this.shelfCap() - this.s.stock[x.id]);
			const can = Math.min(want, Math.floor((this.s.cash - cost) / x.cost));
			if (can > 0) {
				order[x.id] = can;
				cost += can * x.cost;
			}
		}
		if (!cost) return no(this.restockCost() ? 'Not enough cash to restock.' : 'The shelf is already full.');
		const r = this.startTask('restock', 'Restock the supply shelf', RESTOCK_TIME, SHELF_REF, undefined, by);
		if (!r.ok) return r;
		this.s.cash -= cost;
		this.s.order = order;
		this.save();
		return ok(`Ordered $${cost} of supplies. ${r.msg ?? ''}`.trim());
	}
	upgradeShelf(): Result {
		const cost = SHELF_UPGRADE[this.s.shelf.level];
		if (cost === undefined || this.s.shelf.level >= SHELF_CAP.length - 1) return no('The shelf is as big as it gets.');
		if (this.s.cash < cost) return no(`A bigger shelf costs $${cost}.`);
		this.s.cash -= cost;
		this.s.shelf.level++;
		this.save();
		return ok();
	}
	moveItem(kind: 'sale' | 'show' | 'decor', id: number, x: number, y: number): Result {
		const list = (kind === 'sale' ? this.s.sale : kind === 'show' ? this.s.show : this.s.decor) as (Placed & { id: number })[];
		const it = list.find((o) => o.id === id);
		if (!it) return no('Not found.');
		const [w, h] = kind === 'decor' ? [1, 1] : this.footprint(kind, it as SaleTank & ShowTank);
		if (!this.fits(x, y, w, h, it)) return no("It doesn't fit there.");
		it.x = x;
		it.y = y;
		this.save();
		return ok();
	}
	buyStoreDecor(item: StoreItem): Result {
		const d = STORE_DECOR.find((x) => x.id === item)!;
		if (this.s.cash < d.cost) return no('Not enough cash.');
		const spot = this.findSpot(1, 1);
		if (!spot) return no('No free floor space. Move things around in Layout mode.');
		this.s.cash -= d.cost;
		this.s.decor.push({ id: this.nextId(), item, ...spot });
		this.save();
		return ok();
	}
	sellStoreDecor(id: number) {
		const d = this.s.decor.find((x) => x.id === id);
		if (!d) return;
		this.s.cash += Math.round(STORE_DECOR.find((x) => x.id === d.item)!.cost / 2);
		this.s.decor = this.s.decor.filter((x) => x.id !== id);
		this.save();
	}
	setFloor(id: string): Result {
		const f = FLOORS.find((x) => x.id === id)!;
		if (!this.s.floors.includes(id)) {
			if (this.s.cash < f.cost) return no('Not enough cash.');
			this.s.cash -= f.cost;
			this.s.floors.push(id);
		}
		this.s.floor = id;
		this.save();
		return ok();
	}

	// ── Building ─────────────────────────────────────────────────────────────────────
	tankCost(t: TankTier, water: Water) {
		return Math.round(tier(t).cost * (water === 'salt' ? SALT_COST : 1));
	}
	buildTank(t: TankTier, water: Water, temp: Temp): Result {
		if (water === 'salt' && temp === 'cold') return no('Coldwater saltwater fish are not stocked here.');
		const cost = this.tankCost(t, water);
		if (this.s.cash < cost) return no(`That costs $${cost}.`);
		const spot = this.findSpot(tier(t).w, 1);
		if (!spot) return no('No free floor space. Move things around in Layout mode.');
		const id = this.nextId();
		const r = this.startTask('build', `Set up a ${tier(t).name.toLowerCase()}`, tier(t).build, id);
		if (!r.ok) return r;
		this.s.cash -= cost;
		this.s.sale.push({ id, tier: t, water, temp, fish: [], clean: 100, ready: false, ...spot });
		this.save();
		return r;
	}
	upgradeTank(id: number): Result {
		const t = this.s.sale.find((x) => x.id === id);
		if (!t) return no('No such tank.');
		const i = TANK_TIERS.findIndex((x) => x.id === t.tier);
		if (i >= TANK_TIERS.length - 1) return no('Already the biggest tank.');
		const next = TANK_TIERS[i + 1];
		const cost = Math.round((this.tankCost(next.id, t.water) - this.tankCost(t.tier, t.water)) * 0.8);
		if (this.s.cash < cost) return no(`Upgrading costs $${cost}.`);
		if (!this.fits(t.x, t.y, next.w, 1, t)) {
			const spot = this.findSpot(next.w, 1, t);
			if (!spot) return no('Not enough floor space for a bigger tank.');
			t.x = spot.x;
			t.y = spot.y;
		}
		const r = this.startTask('upgrade', `Upgrade to a ${next.name.toLowerCase()}`, next.build / 2, id);
		if (!r.ok) return r;
		this.s.cash -= cost;
		t.ready = false;
		this.save();
		return r;
	}
	upgradeCost(id: number) {
		const t = this.s.sale.find((x) => x.id === id)!;
		const i = TANK_TIERS.findIndex((x) => x.id === t.tier);
		const next = TANK_TIERS[i + 1];
		return next ? Math.round((this.tankCost(next.id, t.water) - this.tankCost(t.tier, t.water)) * 0.8) : 0;
	}
	sellTank(id: number): Result {
		const t = this.s.sale.find((x) => x.id === id);
		if (!t) return no('No such tank.');
		if (t.fish.length) return no('Move or sell the fish first.');
		if (this.s.tasks.some((x) => x.ref === id)) return no('Someone is working on it.');
		this.s.cash += Math.round(this.tankCost(t.tier, t.water) * 0.4);
		this.s.sale = this.s.sale.filter((x) => x !== t);
		this.save();
		return ok();
	}
	/** Switch an empty tank between fresh/salt and tropical/coldwater. */
	setWater(loc: Loc, water: Water, temp: Temp): Result {
		const t = this.tankAt(loc);
		if (!t) return no('No such tank.');
		if (water === 'salt' && temp === 'cold') return no('Coldwater saltwater fish are not stocked here.');
		if (t.fish.length) return no('Empty the tank before changing its water.');
		if (water === 'salt' && t.water === 'fresh' && 'tier' in t) {
			const extra = Math.round(tier(t.tier).cost * (SALT_COST - 1));
			if (this.s.cash < extra) return no(`Converting to saltwater costs $${extra} for the extra gear.`);
			this.s.cash -= extra;
		}
		t.water = water;
		t.temp = temp;
		if ('decor' in t) t.decor = t.decor.filter((d) => !TANK_DECOR.find((x) => x.id === d)!.water || TANK_DECOR.find((x) => x.id === d)!.water === water);
		this.save();
		return ok();
	}
	clean(loc: Loc, by?: Staff): Result {
		const t = this.tankAt(loc);
		if (!t) return no('No such tank.');
		if (t.clean >= 95) return no('That tank is already sparkling.');
		if ('tier' in t) {
			const mins = [1.5, 2, 3, 4, 6][TANK_TIERS.findIndex((x) => x.id === t.tier)];
			return this.startTask('clean', `Clean the ${tier(t.tier).name.toLowerCase()}`, mins * 60, t.id, undefined, by);
		}
		return this.startTask('cleanShow', 'Clean the show tank', 240 * t.seg, t.id, undefined, by);
	}
	/** Trim the live plants back (a staff task). */
	trim(id: number, by?: Staff): Result {
		const t = this.s.show.find((x) => x.id === id);
		if (!t) return no('No such tank.');
		if (!t.decor.includes('plants')) return no('There are no live plants in this tank.');
		if ((t.growth ?? 0) < 45) return no("The plants don't need trimming yet.");
		return this.startTask('trim', 'Trim the plants', TRIM_TIME * t.seg, t.id, undefined, by);
	}
	/** What restyling a show tank would cost: the new shape's price, plus a fee per repaint. */
	restyleCost(t: ShowTank, change: Partial<TankLook>) {
		const look = this.lookOf(t);
		let cost = 0;
		if (change.shape && change.shape !== look.shape) cost += Math.max(150, TANK_SHAPES.find((x) => x.id === change.shape)!.cost) * t.seg;
		for (const k of ['trim', 'stand', 'light'] as const) if (change[k] && change[k] !== look[k]) cost += RESTYLE_COST;
		return cost;
	}
	/** Change a show tank's glass shape or its trim, stand or lights. */
	restyle(id: number, change: Partial<TankLook>): Result {
		const t = this.s.show.find((x) => x.id === id);
		if (!t) return no('No such tank.');
		const look = this.lookOf(t);
		if (change.shape && change.shape !== look.shape && this.s.tasks.some((x) => x.ref === id || x.ref2 === id)) return no('Wait for the current job on this tank to finish.');
		const cost = this.restyleCost(t, change);
		if (!cost) return ok();
		if (this.s.cash < cost) return no(`That costs $${cost}.`);
		this.s.cash -= cost;
		t.look = { ...look, ...change };
		this.save();
		return ok(`Restyled for $${cost}.`);
	}
	showSlotsUnlocked() {
		return SHOW_UNLOCK.filter((lvl) => this.main.level >= lvl).length + this.size;
	}
	showSlotsUsed() {
		return this.s.show.reduce((a, t) => a + t.seg, 0);
	}
	buildShow(water: Water, temp: Temp, shape: TankShape = 'rect'): Result {
		if (water === 'salt' && temp === 'cold') return no('Coldwater saltwater fish are not stocked here.');
		if (this.showSlotsUsed() >= Math.min(this.maxShow(), this.showSlotsUnlocked())) {
			const next = SHOW_UNLOCK.find((lvl) => lvl > this.main.level);
			if (this.showSlotsUsed() >= this.maxShow())
				return no(this.size < EXPAND_MAX ? `You have all ${this.maxShow()} show tanks your store has room for. Expand the store for another.` : `You already have the maximum of ${this.maxShow()} show tanks.`);
			return no(next ? `Upgrade your main show tank to level ${next} (or expand the store) to unlock another show tank.` : 'Expand the store to unlock another show tank.');
		}
		const price = NEW_SHOW_COST + TANK_SHAPES.find((x) => x.id === shape)!.cost;
		if (this.s.cash < price) return no(`That show tank costs $${price}.`);
		const spot = this.findSpot(2, 2);
		if (!spot) return no('No free floor space (a show tank needs 2×2).');
		const id = this.nextId();
		const r = this.startTask('buildShow', 'Build a new show tank', NEW_SHOW_TIME, id);
		if (!r.ok) return r;
		this.s.cash -= price;
		this.s.show.push({ id, level: 1, seg: 1, water, temp, fish: [], decor: [], clean: 100, ready: false, look: { ...DEFAULT_LOOK, shape }, growth: TRIMMED, ...spot });
		this.save();
		return r;
	}
	upgradeShow(id: number): Result {
		const t = this.s.show.find((x) => x.id === id);
		if (!t) return no('No such tank.');
		if (t.level >= SHOW_MAX_LEVEL) return no('This show tank is fully upgraded. Combine show tanks to go bigger.');
		const cost = showUpgradeCost(t.level) * t.seg;
		if (this.s.cash < cost) return no(`Upgrading costs $${cost}.`);
		const r = this.startTask('upgradeShow', `Upgrade show tank to level ${t.level + 1}`, showUpgradeTime(t.level), id);
		if (!r.ok) return r;
		this.s.cash -= cost;
		this.save();
		return r;
	}
	/** Merge show tank `b` into `a`: one bigger tank (with a capacity bonus) that can hold sharks. */
	combine(aId: number, bId: number): Result {
		let a = this.s.show.find((x) => x.id === aId);
		let b = this.s.show.find((x) => x.id === bId);
		if (!a || !b || a === b) return no('Pick two different show tanks.');
		// The main show tank (with the centrepiece) always survives the merge.
		if (b === this.main) [a, b] = [b, a];
		if (!a.ready || !b.ready) return no('Both tanks need to be finished first.');
		if (a.water !== b.water || a.temp !== b.temp) return no('Both tanks need the same water (fresh/salt, tropical/coldwater).');
		if (this.s.cash < COMBINE_COST) return no(`Combining costs $${COMBINE_COST}.`);
		// The merged tank must hold everyone together.
		const merged: ShowTank = { ...a, fish: [], seg: a.seg + b.seg };
		for (const f of [...a.fish, ...b.fish]) {
			const c = this.check(merged, species(f.s));
			if (!c.ok) return no(`They can't share a tank: ${c.msg}`);
			merged.fish.push(f);
		}
		const [w, h] = this.footprint('show', { seg: a.seg + b.seg });
		if (w > this.gw()) return no('That would be too wide for the store.');
		let spot: Placed | null = this.fits(a.x, a.y, w, h, a) && !this.overlapsTank(a.x, a.y, w, h, b) ? { x: a.x, y: a.y } : null;
		if (!spot) spot = this.findSpotIgnoring(w, h, [a, b]);
		if (!spot) return no('Not enough floor space for the combined tank. Rearrange in Layout mode.');
		const r = this.startTask('combine', 'Combine two show tanks', COMBINE_TIME, a.id, b.id);
		if (!r.ok) return r;
		this.s.cash -= COMBINE_COST;
		a.x = spot.x;
		a.y = spot.y;
		b.x = spot.x;
		b.y = spot.y;
		a.ready = false;
		b.ready = false;
		this.save();
		return r;
	}
	private overlapsTank(x: number, y: number, w: number, h: number, t: ShowTank) {
		const [tw, th] = this.footprint('show', t);
		return x < t.x + tw && t.x < x + w && y < t.y + th && t.y < y + h;
	}
	private findSpotIgnoring(w: number, h: number, skip: object[]): Placed | null {
		const saved = skip.map((o) => ({ o, x: (o as Placed).x }));
		// Treat the skipped items as off the floor while searching.
		for (const s of saved) (s.o as Placed).x = -100;
		const spot = this.findSpot(w, h);
		for (const s of saved) (s.o as Placed).x = s.x;
		return spot;
	}

	// ── Luck: limited-edition event decorations make crates luckier ──────────────────
	/** Limited editions you own, and how many of those are on display in a show tank. */
	luckParts() {
		const owned = this.s.limited.length;
		const shown = this.s.limited.filter((d) => this.s.show.some((t) => t.decor.includes(d))).length;
		return { owned, shown };
	}
	luck() {
		const { owned, shown } = this.luckParts();
		return owned * LUCK_OWNED + shown * LUCK_SHOWN;
	}
	/** Fishing odds after your luck. */
	catchOdds() {
		return luckyOdds(CATCH_ODDS, this.luck());
	}
	/** A crate's odds after your luck. */
	crateOdds(event: boolean) {
		return luckyOdds(event ? EVENT_ODDS : CRATE_ODDS, this.luck());
	}

	// ── Shipments (gacha) ────────────────────────────────────────────────────────────
	openCrate(supplierId: string): { ok: false; msg: string } | { ok: true; fish: Fish[]; gems: number; free: boolean; decor?: DecorTag } {
		const ev = supplierId === 'event' ? activeEvent() : null;
		if (supplierId === 'event' && !ev) return no('That event is over. Watch for the next holiday!');
		const sup = ev ? { name: ev.crate } : SUPPLIERS.find((x) => x.id === supplierId)!;
		const cost = ev ? EVENT_CRATE_COST : CRATE_COST;
		const free = this.s.freeCrates > 0;
		if (!free && this.s.cash < cost) return no(`A crate costs $${cost}.`);
		if (this.s.hold.length + CRATE_FISH > this.holdCap()) return no(`Make room in the backroom first (a crate holds ${CRATE_FISH} fish).`);
		if (free) this.s.freeCrates--;
		else this.s.cash -= cost;
		const pool = ev ? eventPool(ev) : WILD.filter((s) => s.water === (sup as (typeof SUPPLIERS)[number]).water && s.temp === (sup as (typeof SUPPLIERS)[number]).temp && RARITIES.indexOf(s.rarity) <= RARITIES.indexOf('legendary'));
		const fish: Fish[] = [];
		for (let i = 0; i < CRATE_FISH; i++) {
			let r = RARITIES.indexOf(roll(this.crateOdds(!!ev)));
			// Not every supplier ships every rarity: fall back to the next one down.
			while (r > 0 && !pool.some((s) => s.rarity === RARITIES[r])) r--;
			const sp = pick(pool.filter((s) => s.rarity === RARITIES[r]));
			const f = this.newFish(sp.id);
			fish.push(f);
			this.s.hold.push(f);
			if (!this.s.found.includes(sp.id)) this.s.found.push(sp.id);
		}
		let gems = 0;
		const g = Math.random();
		if (g < GEM_ODDS.big) gems = 10;
		else if (g < GEM_ODDS.big + GEM_ODDS.small) gems = 1 + Math.floor(Math.random() * 3);
		// Event crates always come with a few treats, and maybe the limited-edition decoration.
		let decor: DecorTag | undefined;
		if (ev) {
			gems += 2 + Math.floor(Math.random() * 4);
			const d = eventDecor(ev);
			if (!this.s.limited.includes(d.id) && Math.random() < EVENT_DECOR_ODDS) {
				this.s.limited.push(d.id);
				decor = d.id;
			}
		}
		this.s.gems += gems;
		this.say(`${sup.name} delivered ${fish.map((f) => species(f.s).name).join(', ')}${gems ? ` and ${gems} gems` : ''}${decor ? `, plus a limited-edition ${TANK_DECOR.find((d) => d.id === decor)!.name}` : ''}.`);
		this.save();
		return { ok: true, fish, gems, free, decor };
	}
	buyHolding(): Result {
		if (this.s.holdCap >= holdMax(this.size)) return no(this.size < EXPAND_MAX ? 'The backroom is full of shelving. Expand the store for more room.' : 'The backroom is as big as it gets.');
		if (this.s.cash < HOLDING_COST) return no(`More shelving costs $${HOLDING_COST}.`);
		this.s.cash -= HOLDING_COST;
		this.s.holdCap += HOLDING_STEP;
		this.save();
		return ok();
	}

	// ── Fishing ──────────────────────────────────────────────────────────────────────
	cast(water: Water): { ok: false; msg: string } | { ok: true; sp: Species } {
		if (this.s.hold.length >= this.holdCap()) return no('The backroom is full: make room for your catch first.');
		if (this.s.cash < BAIT_COST) return no(`Bait costs $${BAIT_COST}.`);
		this.s.cash -= BAIT_COST;
		const pool = WILD.filter((s) => s.water === water && RARITIES.indexOf(s.rarity) >= 2);
		let r = RARITIES.indexOf(roll(this.catchOdds()));
		while (r > 2 && !pool.some((s) => s.rarity === RARITIES[r])) r--;
		let sp = pick(pool.filter((s) => s.rarity === RARITIES[r] && s.id !== 'shiny-magikarp'));
		// One Magikarp in seven is shiny.
		if (sp.id === 'magikarp' && Math.random() < 1 / 7) sp = species('shiny-magikarp');
		this.save();
		return { ok: true, sp };
	}
	land(sp: Species, netted: boolean): Result {
		if (netted) {
			const g = NET_GEMS[sp.rarity] ?? 2;
			if (this.s.gems < g) return no(`The net costs ${g} gems.`);
			this.s.gems -= g;
		}
		if (this.s.hold.length >= this.holdCap()) return no('The backroom is full.');
		this.s.hold.push(this.newFish(sp.id));
		if (!this.s.caught.includes(sp.id)) this.s.caught.push(sp.id);
		this.discover(sp.id);
		this.say(`Caught a ${sp.name}!`);
		// Now and then the line snags a treasure chest too (luck helps).
		if (Math.random() < CHEST_ODDS * (1 + this.luck() / 100)) {
			this.s.chests++;
			this.toast = [...this.toast, '🧰 Your line snagged a treasure chest! Open it in Storage.'];
			this.say('Fished up a treasure chest.');
		}
		this.save();
		return ok();
	}

	// ── Time passing ─────────────────────────────────────────────────────────────────
	/** Catch the store up to now. `opening`: report what happened while away. */
	advance(opening = false) {
		const now = Date.now();
		this.now = now;
		const s = this.s;
		const cashBefore = s.cash;
		const soldBefore = s.sold;
		const gemsBefore = s.gems;
		this.daily();
		// Tasks finish in order; time is simulated up to each one so sales and decay use the
		// store as it was (a tank cleaned 2 hours ago has been getting dirty again since).
		const due = s.tasks.filter((t) => t.end <= now).sort((a, b) => a.end - b.end);
		for (const t of due) {
			this.simulate(Math.max(s.last, Math.min(t.end, now)));
			s.tasks = s.tasks.filter((x) => x !== t);
			this.finishTask(t);
		}
		this.simulate(now);
		this.hatchEggs();
		this.automate();
		if (opening && (s.sold > soldBefore || s.cash !== cashBefore)) {
			const sold = s.sold - soldBefore;
			if (sold > 0)
				this.toast = [...this.toast, `While you were away: sold ${sold} fish for $${Math.max(0, s.cash - cashBefore).toLocaleString()}${s.gems > gemsBefore ? ` and ${s.gems - gemsBefore} gems` : ''}.`];
		}
		this.checkPayroll();
	}
	private simulate(until: number) {
		const s = this.s;
		const ms = until - s.last;
		if (ms <= 0) {
			if (ms < -60_000) s.last = until; // the clock went backwards: don't freeze the store
			return;
		}
		const h = ms / HOUR;
		// Dirty water, hunger and the centrepiece's mood.
		for (const t of s.sale) if (t.ready && t.fish.length) t.clean = clamp(t.clean - (100 / 30) * h * this.dirtRate(t.fish));
		for (const t of s.show) if (t.ready && t.fish.length) t.clean = clamp(t.clean - 5 * h * this.dirtRate(t.fish));
		// Live plants keep growing (faster under a bright light), until someone trims them.
		for (const t of s.show) if (t.ready && t.decor.includes('plants')) t.growth = clamp((t.growth ?? TRIMMED) + PLANT_GROWTH * h * (t.decor.includes('light') ? 1.3 : 1));
		const p = s.pet;
		if (this.centerFish) {
			p.hunger = clamp(p.hunger - 6.25 * h);
			p.play = clamp(p.play - 25 * h);
			const target = this.petTarget();
			const step = 12 * h;
			p.happy = p.happy < target ? Math.min(target, p.happy + step) : Math.max(target, p.happy - step);
			if (p.happy >= 80) p.bond = clamp(p.bond + 2 * h);
			else if (p.happy < 40) p.bond = clamp(p.bond - 1 * h);
		}
		// Fish in a happy show tank become well-kept.
		for (const t of s.show) if (t.ready && this.niceness(t) >= 60) for (const f of t.fish) f.c += h;
		// Customers.
		const shopping = Math.min(ms, MAX_OFFLINE_SALES) / HOUR;
		s.acc += this.customersPerHour() * shopping;
		while (s.acc >= 1) {
			s.acc -= 1;
			this.customer();
		}
		s.last = until;
	}
	private customer() {
		// Most also pick up a supply or two from the shelf (while it's stocked).
		if (Math.random() < SUPPLY_BUY) {
			const inStock = SUPPLIES.filter((x) => this.s.stock[x.id] > 0);
			for (let n = 1 + Math.floor(Math.random() * 2); n > 0 && inStock.length; n--) {
				const item = pick(inStock);
				if (this.s.stock[item.id] <= 0) continue;
				this.s.stock[item.id]--;
				this.s.cash += item.price;
				this.s.earned += item.price;
				this.s.suppliesSold++;
			}
		}
		const tanks = this.s.sale.filter((t) => t.ready && t.fish.length);
		if (!tanks.length) return;
		const all = tanks.flatMap((t) => t.fish.map((f) => ({ t, f })));
		const { t, f } = pick(all);
		const sp = species(f.s);
		const price = Math.round(priceOf(sp) * (0.55 + (0.45 * t.clean) / 100) * (1 + this.popularity() / 200));
		t.fish = t.fish.filter((x) => x !== f);
		this.s.cash += price;
		this.s.earned += price;
		this.s.sold++;
		// Fish that were well kept in a show tank earn gems too.
		const gems = Math.min(5, Math.floor(f.c / 12));
		this.s.gems += gems;
		this.say(`Sold a ${sp.name}${f.n ? ` (${f.n})` : ''} for $${price}${gems ? ` and ${gems} gems` : ''}.`);
	}
	private daily() {
		const s = this.s;
		const d = today();
		if (d === s.day) return;
		const days = Math.max(1, daysBetween(s.day, d));
		s.streak = days === 1 ? Math.min(30, s.streak + 1) : 1;
		const reward = DAILY_BASE + DAILY_STREAK * Math.min(s.streak - 1, 6);
		s.cash += reward;
		s.day = d;
		// Payroll for each day since the last visit (up to a week).
		const due = this.wages() * Math.min(days, 7);
		if (s.cash >= due) {
			s.cash -= due;
			this.toast = [...this.toast, `Daily reward: $${reward}! Paid $${due} in wages.`];
		} else {
			s.cash = 0;
			s.layoff = s.staff.length > 1;
			this.toast = [
				...this.toast,
				`Daily reward: $${reward}. Payroll of $${due} was more than you had.` + (s.layoff ? ' Lay off staff until you can afford their wages.' : '')
			];
		}
		this.say(`New day! Reward $${reward}, wages $${due}.`);
		this.save();
	}

	// ── Senior aquarists: chores without being asked ─────────────────────────────────
	private automate() {
		if (!this.s.auto || this.s.layoff) return;
		for (const p of this.s.staff) {
			if (!this.role(p.role).auto || this.s.tasks.some((t) => t.staff === p.id)) continue;
			const r = this.chore(p);
			if (!r) return;
			if (r.ok) this.say(`${p.name} got on with it: ${this.s.tasks.at(-1)?.label}.`);
		}
	}
	private chore(p: Staff): Result | null {
		const free = (id: number) => !this.s.tasks.some((t) => t.ref === id || t.ref2 === id);
		const dirtySale = this.s.sale.find((t) => t.ready && t.fish.length && t.clean < 60 && free(t.id));
		if (dirtySale) return this.clean(`sale:${dirtySale.id}`, p);
		const dirtyShow = this.s.show.find((t) => t.ready && t.fish.length && t.clean < 60 && free(t.id));
		if (dirtyShow) return this.clean(`show:${dirtyShow.id}`, p);
		const shaggy = this.s.show.find((t) => t.ready && this.overgrown(t) && free(t.id));
		if (shaggy) return this.trim(shaggy.id, p);
		const low = SUPPLIES.some((x) => this.s.stock[x.id] < this.shelfCap() * 0.25);
		// Only restock with money to spare after wages.
		if (low && free(SHELF_REF) && this.s.cash - this.restockCost() > this.wages()) return this.restock(p);
		return null;
	}
	setAuto(on: boolean) {
		this.s.auto = on;
		this.save();
	}

	// ── The fish wiki and research ───────────────────────────────────────────────────
	researchOf(id: string) {
		return this.s.research[id] ?? 0;
	}
	research(id: string): Result {
		const sp = species(id);
		if (!this.s.found.includes(sp.id)) return no("You haven't found that fish yet.");
		const lvl = this.researchOf(sp.id);
		if (lvl >= RESEARCH_MAX) return no('Fully researched.');
		if (!this.s.lab) return no('Build a research lab first (Build & buy).');
		if (!this.s.lab.ready) return no('The research lab is still being built.');
		const cost = researchCost(sp, lvl);
		if (this.s.cash < cost) return no(`Research costs $${cost}.`);
		const ref = -1000 - SPECIES.indexOf(sp);
		const r = this.startTask('research', `Research the ${sp.name} (level ${lvl + 1})`, researchTime(sp, lvl), ref, undefined, undefined, sp.id);
		if (!r.ok) return r;
		this.s.cash -= cost;
		this.save();
		return r;
	}
	/** Order a fully researched fish straight from the breeders. */
	order(id: string): Result {
		const sp = species(id);
		if (this.researchOf(sp.id) < RESEARCH_MAX) return no(`Research the ${sp.name} to level ${RESEARCH_MAX} first.`);
		const { price, currency } = orderPrice(sp);
		if (!this.canAfford(price, currency)) return no(`That costs ${currency === 'gems' ? `${price} gems` : `$${price}`}.`);
		if (this.s.hold.length >= this.holdCap()) return no('The backroom is full: make room first.');
		this.pay(price, currency);
		this.s.hold.push(this.newFish(sp.id));
		this.say(`Ordered a ${sp.name}.`);
		this.save();
		return ok(`A ${sp.name} is waiting in your backroom.`);
	}

	// ── Storage: treasure chests and special decorations ─────────────────────────────
	/** Open a treasure chest: maybe a mythic decoration, a limited edition, gems, cash or a free crate. */
	openChest(): { ok: false; msg: string } | { ok: true; icon: string; text: string; decor?: DecorTag; mythic?: boolean } {
		if (this.s.chests < 1) return no('No chests to open.');
		this.s.chests--;
		const owned = new Set(this.s.limited);
		const mythics = TANK_DECOR.filter((d) => d.mythic && !owned.has(d.id));
		const limited = TANK_DECOR.filter((d) => d.limited && !d.mythic && !owned.has(d.id));
		type Prize = 'mythic' | 'limited' | 'gems' | 'cash' | 'crate';
		const prize = roll<Prize>([
			['mythic', mythics.length ? 5 * (1 + this.luck() / 50) : 0],
			['limited', limited.length ? 12 : 0],
			['gems', 23],
			['cash', 35],
			['crate', 25]
		]);
		let out: { ok: true; icon: string; text: string; decor?: DecorTag; mythic?: boolean };
		if (prize === 'mythic' || prize === 'limited') {
			const d = pick(prize === 'mythic' ? mythics : limited);
			this.s.limited.push(d.id);
			out = { ok: true, icon: prize === 'mythic' ? '🌟' : '✨', text: `${prize === 'mythic' ? 'MYTHIC' : 'Limited edition'}: the ${d.name}!`, decor: d.id, mythic: prize === 'mythic' };
		} else if (prize === 'gems') {
			const g = 5 + Math.floor(Math.random() * 16);
			this.s.gems += g;
			out = { ok: true, icon: '💎', text: `${g} gems` };
		} else if (prize === 'crate' && this.s.freeCrates < FREE_CRATE_MAX) {
			this.s.freeCrates++;
			out = { ok: true, icon: '📦', text: 'A free shipment crate' };
		} else {
			const cash = 300 + Math.floor(Math.random() * 13) * 100;
			this.s.cash += cash;
			out = { ok: true, icon: '💵', text: `$${cash.toLocaleString()}` };
		}
		this.say(`Opened a treasure chest: ${out.text}`);
		this.save();
		return out;
	}
	/** Put one of your special decorations into a show tank (free: you own it). */
	placeSpecial(tag: DecorTag, showId: number): Result {
		const t = this.s.show.find((x) => x.id === showId);
		if (!t) return no('No such tank.');
		if (!this.s.limited.includes(tag)) return no("You don't have that yet.");
		if (t.decor.includes(tag)) return no("It's already in that tank.");
		if (t.decor.length >= this.decorSlots(t)) return no('That tank has no room for another decoration. Take one out (Decorate) first.');
		return this.setDecor(t.id, [...t.decor, tag]);
	}

	// ── Daily gifts ──────────────────────────────────────────────────────────────────
	/** Today's gifts that have unlocked and not been opened. */
	giftsReady(): number[] {
		const got = this.s.gifts.day === today(this.now) ? this.s.gifts.got : [];
		const h = new Date(this.now).getHours();
		return GIFT_HOURS.map((_, i) => i).filter((i) => GIFT_HOURS[i] <= h && !got.includes(i));
	}
	/** How long until the next gift unlocks (ms). */
	nextGift(): number {
		const d = new Date(this.now);
		const t = new Date(d);
		const next = GIFT_HOURS.find((hr) => hr > d.getHours());
		if (next === undefined) {
			t.setDate(d.getDate() + 1);
			t.setHours(GIFT_HOURS[0], 0, 0, 0);
		} else t.setHours(next, 0, 0, 0);
		return t.getTime() - this.now;
	}
	/** Open a gift: a free crate, some cash or some gems. */
	openGift(): Result {
		const i = this.giftsReady()[0];
		if (i === undefined) return no('No gift ready yet.');
		if (this.s.gifts.day !== today()) this.s.gifts = { day: today(), got: [] };
		this.s.gifts.got.push(i);
		const r = Math.random();
		let msg: string;
		if (r < 0.6 && this.s.freeCrates < FREE_CRATE_MAX) {
			this.s.freeCrates++;
			msg = 'a free shipment crate';
		} else if (r < 0.88) {
			const cash = 100 + Math.floor(Math.random() * 5) * 50;
			this.s.cash += cash;
			msg = `$${cash}`;
		} else {
			const gems = 3 + Math.floor(Math.random() * 6);
			this.s.gems += gems;
			msg = `${gems} gems`;
		}
		this.say(`${GIFT_NAMES[i]} gift: ${msg}.`);
		this.save();
		return ok(`🎁 ${GIFT_NAMES[i]} gift: ${msg}!`);
	}

	// ── Naming ───────────────────────────────────────────────────────────────────────
	rename(name: string) {
		this.s.name = name;
		this.s.named = true;
		this.save();
	}
}
