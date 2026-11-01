// NEOS (Neuro Evolution Organism Simulator), in the browser: the same organisms as the original
// Python project (github.com/edng5/neos), one continuous world instead of separate generation runs,
// and a choice of how they evolve: NEAT (networks grow new hidden nodes, and only similar NEOS can
// mate), the original NEOS genetic algorithm (fixed networks), an evolution strategy (babies are
// mutated clones), differential evolution, or random search (a baseline that doesn't learn).
//
// Each NEOS has a tiny neural net (2 inputs → hidden nodes, tanh → 2 outputs): the first input is the
// heading to the nearest food (or, late in life, to the nearest fit mate), the outputs turn it and
// speed it up or slow it down. Eating food is fitness. With predators on, hungry parents sometimes
// have babies with a meatier diet: omnivores (food, and herbivores) and carnivores (other NEOS only;
// they starve without them). Well-fed parents almost never do, so predators only take hold when
// food is short (limit how fast it regrows to make it short). The second input is the heading to
// the nearest NEOS that could eat this one, stronger the closer it is, so prey whose genes steer
// them away survive to breed, and running away evolves. With body evolution on, size and speed
// are genes too, paid for in energy (bigger and faster burns more; an empty store is death): a big
// NEOS is slower and hungrier but can't be eaten by a smaller hunter alone (only by a pack whose
// sizes add up), so it has less to run from. Two fit, grown-up NEOS that meet have a baby; NEOS
// die of old age, and whenever the population drops below its size the fittest's babies top it
// back up (elitism). Generations never stop the world: every "generation length" the stats are
// recorded while everyone keeps swimming.

export const WORLD = 2; // the world is [-2, 2] × [-2, 2], like the original
const EAT_R = 0.075;
/** How close two NEOS have to get to mate (a little more than touching). */
const MATE_R = 0.12;
/** A courting NEOS slows down within this distance of its mate. */
const COURT_R = 0.6;
/** How far a NEOS notices a willing mate (×2 for the fittest), and how far its species' elite draw it. */
const ATTRACT_NEAR = 0.6;
const ATTRACT_FAR = 2.5;
/** Fitness for getting away from a hunter (food is worth 1). */
const ESCAPE_FIT = 0.5;
/** Steps a hunter spends digesting after a kill, before it can hunt again. */
const DIGEST = 120;
/** Body evolution: energy from a food particle, a full store (× size), and the smallest size. */
const FOOD_E = 20;
const STORE_E = 70;
export const MIN_SIZE = 0.5;
/** The speed gene's range (top speed = max speed × speed ÷ √size). */
const SPEED_RANGE: [number, number] = [0.5, 1.6];
export const DT = 0.04;
/** Most hidden nodes a network can have (NEAT grows toward this). */
export const MAX_H = 8;
const CELL = 0.25;
/** A wall's half-thickness, and how close a NEOS's centre may get to one. */
export const WALL_T = 0.035;
const WALL_GAP = WALL_T + 0.05;
/** Most walls a world can have. */
export const MAX_WALLS = 40;
const GRID = Math.ceil((WORLD * 2) / CELL);

export type Algo = 'neat' | 'ga' | 'es' | 'de' | 'random';
export type Selection = 'truncation' | 'tournament' | 'roulette';
export type Crossover = 'blend' | 'uniform' | 'onepoint' | 'none';

export interface Config {
	algo: Algo;
	popSize: number;
	popCap: number;
	foodNum: number;
	elitism: number;
	mutate: number;
	mutStrength: number;
	mature: number;
	lifeMin: number;
	lifeMax: number;
	vMax: number;
	drMax: number;
	dvMax: number;
	cooldown: number;
	/** Food a baby costs (shared by its parents): a NEOS has to eat to afford breeding. */
	breedCost: number;
	genTime: number;
	/** Hidden nodes (fixed-network algorithms; NEAT starts at 1 and grows). */
	hidden: number;
	/** NEAT: chance a baby gains a hidden node. */
	addNode: number;
	/** NEAT: how different two NEOS may be and still mate (speciation). */
	compat: number;
	/** Differential evolution: the differential weight F and crossover rate CR. */
	deF: number;
	deCR: number;
	/** Predators: NEOS can evolve to eat other NEOS. */
	predators: boolean;
	/** Omnivores (food and herbivores) as the step between herbivores and carnivores. */
	omnivores: boolean;
	/** Chance a starving parent's baby changes diet (well-fed parents: almost never). */
	predMutate: number;
	/** Eaten food comes back at a limited rate (otherwise at once, somewhere else). */
	foodLimit: boolean;
	/** Food that regrows a second, when limited. */
	foodRegrow: number;
	/** Fitness a predator gets for each NEOS it eats (food is worth 1). */
	preyValue: number;
	/** Predators' top speed, × the max speed. */
	predSpeed: number;
	/** How far away a NEOS senses a predator. */
	senseR: number;
	/** Steps a predator lasts without eating. */
	starve: number;
	/** Body evolution: size and speed are genes, paid for in energy. */
	body: boolean;
	/** Chance a baby's size and speed change. */
	sizeMutate: number;
	/** The biggest a NEOS can grow (1 = the original size). */
	maxSize: number;
	/** Energy burned a step (× size² and how fast it's going). */
	energyUse: number;
	/**
	 * Life history evolves: litter size, maturity age and rest between births are genes (starting
	 * at 1 baby, the maturity age and the breeding cooldown), each with a cost.
	 */
	litter: boolean;
	/** The most babies one birth can have. */
	maxLitter: number;
	/** Chance each of a baby's life-history genes changes (litter ±1, maturity and rest ±20% or so). */
	litterMutate: number;
	// The genetic algorithm, piece by piece.
	selection: Selection;
	crossover: Crossover;
	mutScale: boolean;
	mutGauss: boolean;
	mutReset: boolean;
	mutLifespan: boolean;
	breedInWorld: boolean;
	pickyMates: boolean;
	seekMates: boolean;
	refill: boolean;
}

export const DEFAULTS: Config = {
	algo: 'neat',
	popSize: 64,
	popCap: 150,
	foodNum: 100,
	elitism: 0.2,
	mutate: 0.1,
	mutStrength: 0.1,
	mature: 120,
	lifeMin: 500,
	lifeMax: 600,
	vMax: 0.5,
	drMax: 720,
	dvMax: 0.25,
	cooldown: 80,
	breedCost: 1,
	genTime: 50,
	hidden: 5,
	addNode: 0.05,
	compat: 2,
	deF: 0.6,
	deCR: 0.7,
	predators: false,
	omnivores: true,
	predMutate: 0.15,
	foodLimit: false,
	foodRegrow: 6,
	preyValue: 4,
	predSpeed: 1,
	senseR: 0.8,
	starve: 400,
	body: false,
	sizeMutate: 0.2,
	maxSize: 2,
	energyUse: 0.15,
	litter: false,
	maxLitter: 5,
	litterMutate: 0.15,
	selection: 'truncation',
	crossover: 'blend',
	mutScale: true,
	mutGauss: false,
	mutReset: false,
	mutLifespan: false,
	breedInWorld: true,
	pickyMates: false,
	seekMates: true,
	refill: false,
};

/** Slider ranges: [min, max, step]. */
export const RANGES: Record<string, [number, number, number]> = {
	popSize: [8, 150, 1],
	popCap: [30, 300, 10],
	foodNum: [10, 300, 5],
	elitism: [0.05, 0.6, 0.05],
	mutate: [0, 1, 0.01],
	mutStrength: [0.01, 0.5, 0.01],
	mature: [20, 600, 10],
	lifeMin: [100, 1500, 10],
	lifeMax: [100, 1500, 10],
	vMax: [0.1, 1.5, 0.05],
	drMax: [90, 1440, 30],
	dvMax: [0.05, 1, 0.05],
	cooldown: [0, 600, 10],
	breedCost: [0.5, 8, 0.5],
	genTime: [10, 120, 5],
	hidden: [1, MAX_H, 1],
	addNode: [0, 0.3, 0.01],
	compat: [0.3, 5, 0.1],
	deF: [0.1, 1.5, 0.05],
	deCR: [0, 1, 0.05],
	predMutate: [0, 0.5, 0.01],
	foodRegrow: [0.5, 40, 0.5],
	preyValue: [1, 10, 1],
	predSpeed: [0.6, 1.8, 0.05],
	senseR: [0.2, 2, 0.1],
	starve: [100, 1500, 50],
	sizeMutate: [0, 0.6, 0.02],
	maxSize: [1.1, 3, 0.1],
	maxLitter: [2, 8, 1],
	litterMutate: [0, 0.5, 0.01],
	energyUse: [0.05, 0.4, 0.01]
};

export const ALGOS: { id: Algo; name: string; about: string }[] = [
	{
		id: 'neat',
		name: 'NEAT',
		about: 'NeuroEvolution of Augmenting Topologies: networks start with one hidden node and babies can grow more; only NEOS of a similar species can mate.'
	},
	{ id: 'ga', name: 'Original NEOS GA', about: 'The original Python code: fixed-size networks, parents crossed over, then sometimes mutated.' },
	{ id: 'es', name: 'Evolution strategy', about: 'No mates: a fit, grown-up NEOS buds a baby that is a copy of it with Gaussian noise on every weight.' },
	{ id: 'de', name: 'Differential evolution', about: 'A baby is parent A + F × (B − C), for its mate B and a random C, each gene mixed with A at rate CR.' },
	{ id: 'random', name: 'Random search', about: 'A baseline: babies get brand-new random weights, so nothing is passed on.' }
];

export interface Neo {
	x: number;
	y: number;
	r: number;
	v: number;
	fit: number;
	age: number;
	life: number;
	gen: number;
	/** Set only for the rare albino; otherwise the colour comes from diet and generation (colorOf). */
	color: string;
	/**
	 * Weights, sized for MAX_H hidden nodes: wih = food input→hidden, then danger input→hidden;
	 * who = hidden→speed, then hidden→turn.
	 */
	wih: Float32Array;
	who: Float32Array;
	/** Hidden nodes in use. */
	nh: number;
	/** Diet: 0 herbivore (food), 1 omnivore (food and herbivores), 2 carnivore (other NEOS only). */
	diet: number;
	/** Its species' id. */
	spc: number;
	/** Life-history genes: babies per birth, the age it can first breed at, and its rest between births. */
	litter: number;
	matureAt: number;
	rest: number;
	/** Distance to the mate it's swimming toward (Infinity: not looking): it brakes as it closes in. */
	seekD: number;
	/** Food eaten since it last bred: what it can spend on babies. */
	store: number;
	/** Steps since it last ate. */
	hunger: number;
	/** Fitness that came from eating other NEOS. */
	meat: number;
	/** Being chased right now (a hunter close by): getting away counts as fitness. */
	chased: boolean;
	/** Steps left digesting its last kill (it won't hunt until then). */
	digest: number;
	/** Body genes: size (1 = the original's) and speed (× the max speed); and energy left. */
	size: number;
	sp: number;
	energy: number;
	/** Distance to the nearest food (omnivores go for whichever is closer). */
	foodD: number;
	/** Eaten this step (removed with the dead). */
	eaten: boolean;
	cool: number;
	input: number;
	/** Heading to the nearest predator, scaled by how close it is (0: none in sight). */
	danger: number;
}
export interface Genome {
	wih: ArrayLike<number>;
	who: ArrayLike<number>;
	nh: number;
	diet?: number;
	size?: number;
	sp?: number;
	litter?: number;
	matureAt?: number;
	rest?: number;
	life: number;
	gen: number;
	fit: number;
}
/** A wall: a thick line from (x1, y1) to (x2, y2), placed before a run starts. */
export interface Wall {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/** Does the segment (x1, y1)-(x2, y2) cross a wall's centre line? */
function crosses(x1: number, y1: number, x2: number, y2: number, w: Wall) {
	const d1x = x2 - x1;
	const d1y = y2 - y1;
	const d2x = w.x2 - w.x1;
	const d2y = w.y2 - w.y1;
	const den = d1x * d2y - d1y * d2x;
	if (!den) return false;
	const t = ((w.x1 - x1) * d2y - (w.y1 - y1) * d2x) / den;
	const u = ((w.x1 - x1) * d1y - (w.y1 - y1) * d1x) / den;
	return t > 0 && t < 1 && u >= 0 && u <= 1;
}

/** Squared distance from (px, py) to a wall's centre line. */
export function wallDist2(w: Wall, px: number, py: number) {
	const dx = w.x2 - w.x1;
	const dy = w.y2 - w.y1;
	const len = dx * dx + dy * dy;
	const t = len ? Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / len)) : 0;
	return (w.x1 + t * dx - px) ** 2 + (w.y1 + t * dy - py) ** 2;
}

export interface GenStat {
	gen: number;
	best: number;
	avg: number;
	alive: number;
	total: number;
	born: number;
	died: number;
	food: number;
	lineage: number;
	/** Carnivores and omnivores alive at the end, and NEOS eaten. */
	preds?: number;
	omnis?: number;
	eaten?: number;
	/** Average size and litter size alive at the end. */
	size?: number;
	litter?: number;
}
/** How a group of NEOS (a species, a diet, a size class) has done over the run. */
export interface Tally {
	born: number;
	died: number;
	/** Most alive at once (checked each generation and whenever the details are read). */
	peak: number;
	food: number;
	/** NEOS it ate, and how many of its own were eaten. */
	prey: number;
	eatenBy: number;
	escapes: number;
	/** Summed over the dead: fitness and age, for averages. */
	fitSum: number;
	lifeSum: number;
}
/** A species: NEOS whose genes are within the species threshold of its founder's. */
export interface Species extends Tally {
	id: number;
	name: string;
	diet: number;
	/** Generations it was first and (if extinct) last seen. */
	first: number;
	last: number | null;
	sizeSum: number;
	litterSum: number;
	/** Its albino subspecies (the rare 1-in-1,000 white babies), tallied on their own too. */
	albino: Tally;
	/** The founder's genes, which newcomers are compared against. */
	rep: { wih: Float32Array; who: Float32Array; nh: number; diet: number; size: number };
}
const tally = (): Tally => ({ born: 0, died: 0, peak: 0, food: 0, prey: 0, eatenBy: 0, escapes: 0, fitSum: 0, lifeSum: 0 });
/** Size classes for the details: small, medium, large. */
export const SIZE_CLASSES = ['Small (< ×0.8)', 'Medium', 'Large (> ×1.25)'];
const sizeClass = (s: number) => (s < 0.8 ? 0 : s > 1.25 ? 2 : 1);
// Species names: two made-up syllables from the id (e.g. "Corlia"), so each is easy to tell apart.
const SYL_A = ['Ala', 'Bri', 'Cor', 'Del', 'Eri', 'Fen', 'Gal', 'Hal', 'Ira', 'Jun', 'Kel', 'Lum', 'Mor', 'Nix', 'Ori', 'Pel', 'Qua', 'Ros', 'Syl', 'Tor', 'Umb', 'Val', 'Wyn', 'Xan', 'Yor', 'Zel'];
const SYL_B = ['ba', 'cis', 'dra', 'nex', 'fin', 'gor', 'lia', 'mus', 'nox', 'pha', 'ria', 'tus', 'vel', 'zor'];
const NAMES = 182; // 26 × 14 / gcd: the two syllables don't repeat together before this
const speciesName = (id: number) => SYL_A[id % SYL_A.length] + SYL_B[(id * 5) % SYL_B.length] + (id >= NAMES ? ` ${Math.floor(id / NAMES) + 1}` : '');
/** Most species kept (the extinct ones that did least are dropped first). */
const MAX_SPECIES = 300;

export interface Totals {
	steps: number;
	born: number;
	died: number;
	food: number;
	bestEver: number;
	lineage: number;
	eaten: number;
	escapes: number;
}

/** Colours by diet (herbivores green, omnivores blue, carnivores red), darker with each generation. */
export const SHADES = [
	['#b7f5b0', '#86e07c', '#4fc25a', '#2e9e44', '#1f7a35', '#145c28'],
	['#b3d4ff', '#84b5f7', '#5591ec', '#3570d6', '#2453b0', '#193c86'],
	['#ffb3b3', '#f88484', '#ec5555', '#d63535', '#b02424', '#861919']
];
/** The rare albino (1 in 1,000 babies), as in the original. */
const ALBINO = '#f5fffa';
export const colorOf = (n: Neo) => n.color || SHADES[n.diet][Math.min(n.gen, SHADES[0].length - 1)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

/** Heading from a to (x, y), relative to a's facing, in [-1, 1] (as the original computed it). */
function heading(a: Neo, x: number, y: number) {
	let d = (Math.atan2(y - a.y, x - a.x) * 180) / Math.PI - a.r;
	if (d > 180) d -= 360;
	else if (d < -180) d += 360;
	return d / 180;
}
const cellOf = (v: number) => Math.min(GRID - 1, Math.max(0, Math.floor((v + WORLD) / CELL)));

export class Sim {
	cfg: Config;
	neos: Neo[] = [];
	fx: Float32Array = new Float32Array(0);
	fy: Float32Array = new Float32Array(0);
	gen = 0;
	genStep = 0;
	history: GenStat[] = [];
	totals: Totals = { steps: 0, born: 0, died: 0, food: 0, bestEver: 0, lineage: 0, eaten: 0, escapes: 0 };
	/** Every species seen this run, by id; and how each diet and size class has done. */
	species = new Map<number, Species>();
	byDiet: Tally[] = [tally(), tally(), tally()];
	bySize: Tally[] = [tally(), tally(), tally()];
	/** Each generation: how many of each species were alive at its end. */
	speciesHistory: { gen: number; counts: Record<number, number> }[] = [];
	private nextSpecies = 1;
	extinct = false;
	/** Walls stay put across new worlds (they can only be changed before a run starts). */
	walls: Wall[] = [];
	/** This generation so far: the NEOS that died (their fitness), births, food. */
	private cur = { deadFit: [] as number[], born: 0, died: 0, food: 0, eaten: 0 };
	private threshold = 0;
	/** How much of the population eats meat (refreshed every step): a check on predators' numbers. */
	private meatShare = 0;
	/** Limited food: how many are eaten and waiting to regrow, and regrowth owed. */
	private waiting = 0;
	private regrow = 0;
	private foodGrid: number[][] = Array.from({ length: GRID * GRID }, () => []);
	private neoGrid: Neo[][] = Array.from({ length: GRID * GRID }, () => []);

	constructor(cfg: Config) {
		this.cfg = { ...cfg };
		this.reset();
	}

	/** Forget every species (a new world). */
	private clearSpecies() {
		this.species = new Map();
		this.byDiet = [tally(), tally(), tally()];
		this.bySize = [tally(), tally(), tally()];
		this.speciesHistory = [];
		this.nextSpecies = 1;
	}

	reset() {
		this.clearSpecies();
		this.neos = [];
		this.gen = 0;
		this.genStep = 0;
		this.history = [];
		this.totals = { steps: 0, born: 0, died: 0, food: 0, bestEver: 0, lineage: 0, eaten: 0, escapes: 0 };
		this.extinct = false;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0, eaten: 0 };
		this.regrow = 0;
		this.setFood(this.cfg.foodNum, true);
		// The first NEOS start at mixed ages (as a real population would), so they don't all die of
		// old age together.
		for (let i = 0; i < this.cfg.popSize; i++) {
			const n = this.spawn();
			n.age = randInt(0, Math.round(n.life * 0.6));
			this.neos.push(n);
		}
	}

	/** Change settings on the fly (food appears or goes; the rest applies from now on). */
	configure(cfg: Config) {
		if (cfg.foodNum !== this.cfg.foodNum) this.setFood(cfg.foodNum, false);
		// The original GA's networks are all one size: switching to it (or resizing) reshapes them.
		if (cfg.algo === 'ga' && (this.cfg.algo !== 'ga' || cfg.hidden !== this.cfg.hidden)) for (const n of this.neos) n.nh = cfg.hidden;
		if (!cfg.foodLimit && this.waiting) {
			for (let i = 0; i < this.fx.length; i++) if (Number.isNaN(this.fx[i])) [this.fx[i], this.fy[i]] = this.freeSpot();
			this.waiting = 0;
		}
		if (!cfg.body) for (const n of this.neos) n.size = n.sp = 1;
		else for (const n of this.neos) n.size = Math.min(cfg.maxSize, n.size);
		if (!cfg.predators) for (const n of this.neos) n.diet = 0;
		else if (!cfg.omnivores) for (const n of this.neos) if (n.diet === 1) n.diet = 0;
		this.cfg = { ...cfg, lifeMax: Math.max(cfg.lifeMin, cfg.lifeMax) };
	}

	/** Touching (or inside) a wall. */
	/** Food available right now. */
	foodLeft() {
		return this.fx.length - this.waiting;
	}
	blocked(x: number, y: number, gap = WALL_GAP) {
		for (const w of this.walls) if (wallDist2(w, x, y) < gap * gap) return true;
		return false;
	}
	/** Nothing in the way between two points: walls block sight (food, mates, prey and hunters behind them go unseen). */
	sees(x1: number, y1: number, x2: number, y2: number) {
		for (const w of this.walls) if (crosses(x1, y1, x2, y2, w)) return false;
		return true;
	}
	/** How far ahead (up to `look`) a NEOS heading `deg` from (x, y) can go before a wall. */
	private clearance(x: number, y: number, deg: number, look: number) {
		const a = (deg * Math.PI) / 180;
		for (let s = 1; s <= 4; s++) {
			const t = (look * s) / 4;
			const px = x + Math.cos(a) * t;
			const py = y + Math.sin(a) * t;
			if (this.blocked(px, py) || !this.sees(x, y, px, py)) return t - look / 4;
		}
		return look;
	}
	/** A random spot clear of the walls. */
	private freeSpot(): [number, number] {
		for (let i = 0; i < 30; i++) {
			const x = rand(-WORLD, WORLD);
			const y = rand(-WORLD, WORLD);
			if (!this.blocked(x, y)) return [x, y];
		}
		return [rand(-WORLD, WORLD), rand(-WORLD, WORLD)];
	}
	/** Walls changed (before a run): move anything now inside one. */
	settleWalls() {
		for (let i = 0; i < this.fx.length; i++) if (!Number.isNaN(this.fx[i]) && this.blocked(this.fx[i], this.fy[i])) [this.fx[i], this.fy[i]] = this.freeSpot();
		for (const n of this.neos) if (this.blocked(n.x, n.y)) [n.x, n.y] = this.freeSpot();
	}

	private setFood(n: number, fresh: boolean) {
		const fx = new Float32Array(n);
		const fy = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const keep = !fresh && i < this.fx.length && !Number.isNaN(this.fx[i]);
			[fx[i], fy[i]] = keep ? [this.fx[i], this.fy[i]] : this.freeSpot();
		}
		this.fx = fx;
		this.fy = fy;
		this.waiting = 0;
		for (let i = 0; i < n; i++) if (Number.isNaN(fx[i])) this.waiting++;
	}

	/** Hidden nodes a brand-new NEOS starts with. */
	private startH() {
		return this.cfg.algo === 'neat' ? 1 : this.cfg.hidden;
	}

	/** A NEOS with these genes (or fresh random ones). */
	private spawn(
		g?: {
			wih?: ArrayLike<number>;
			who?: ArrayLike<number>;
			nh?: number;
			life?: number;
			gen?: number;
			diet?: number;
			size?: number;
			sp?: number;
			litter?: number;
			matureAt?: number;
			rest?: number;
			/** How many babies it was born with (siblings share the parents' investment). */
			brood?: number;
		},
		x?: number,
		y?: number
	): Neo {
		const size = this.cfg.body ? Math.min(this.cfg.maxSize, g?.size ?? 1) : 1;
		const gen = g?.gen ?? 0;
		const wih = new Float32Array(2 * MAX_H);
		const who = new Float32Array(2 * MAX_H);
		// (Saves from before predators have only the food weights; the danger ones start random.)
		const gi = g?.wih;
		const go = g?.who;
		const half = go ? go.length / 2 : 0;
		for (let i = 0; i < 2 * MAX_H; i++) wih[i] = gi && i < gi.length ? gi[i] : rand(-1, 1);
		for (let h = 0; h < MAX_H; h++) {
			who[h] = go && h < half ? go[h] : rand(-1, 1);
			who[MAX_H + h] = go && h < half ? go[half + h] : rand(-1, 1);
		}
		const [fx, fy] = x === undefined || y === undefined ? this.freeSpot() : [x, y];
		const n: Neo = {
			spc: 0,
			x: fx,
			y: fy,
			r: rand(0, 360),
			v: rand(0, this.cfg.vMax),
			fit: 0,
			age: 0,
			life: g?.life ?? randInt(this.cfg.lifeMin, Math.max(this.cfg.lifeMin, this.cfg.lifeMax)),
			gen,
			color: gen > 0 && Math.random() < 0.001 ? ALBINO : '',
			wih,
			who,
			nh: Math.max(1, Math.min(MAX_H, g?.nh ?? this.startH())),
			diet: this.cfg.predators ? (g?.diet ?? 0) : 0,
			hunger: 0,
			meat: 0,
			chased: false,
			digest: 0,
			size,
			sp: this.cfg.body ? (g?.sp ?? 1) : 1,
			// Babies from a big litter start with less energy (the parents' investment is shared).
			energy: STORE_E * size * 0.6 * Math.min(1, 2 / ((g?.brood ?? 1) + 1)),
			litter: this.cfg.litter ? Math.max(1, Math.min(this.cfg.maxLitter, g?.litter ?? 1)) : 1,
			matureAt: this.cfg.litter ? (g?.matureAt ?? this.cfg.mature) : this.cfg.mature,
			rest: this.cfg.litter ? (g?.rest ?? this.cfg.cooldown) : this.cfg.cooldown,
			seekD: Infinity,
			store: 0,
			foodD: Infinity,
			eaten: false,
			cool: 0,
			input: 0,
			danger: 0
		};
		this.classify(n);
		return n;
	}

	/** How different a NEOS is from a species' founder: genes, plus diet and size. */
	private speciesDist(n: Neo, s: Species) {
		return this.distance(n, s.rep as unknown as Genome) + Math.abs(n.diet - s.rep.diet) * 2 + Math.abs(n.size - s.rep.size) * 2;
	}
	/** Put a newborn into the closest living species within the threshold, or found a new one. */
	private classify(n: Neo) {
		const alive = new Set(this.neos.map((o) => o.spc));
		let best: Species | null = null;
		let bd = this.cfg.compat;
		for (const s of this.species.values()) {
			if (s.last !== null && !alive.has(s.id)) continue;
			const d = this.speciesDist(n, s);
			if (d <= bd) {
				bd = d;
				best = s;
			}
		}
		if (!best) {
			const id = this.nextSpecies++;
			best = {
				...tally(),
				id,
				name: speciesName(id),
				diet: n.diet,
				first: this.gen,
				last: null,
				sizeSum: 0,
				litterSum: 0,
				albino: tally(),
				rep: { wih: n.wih.slice(), who: n.who.slice(), nh: n.nh, diet: n.diet, size: n.size }
			};
			this.species.set(id, best);
			this.pruneSpecies();
		}
		best.last = null;
		n.spc = best.id;
		best.sizeSum += n.size;
		best.litterSum += n.litter;
		for (const t of this.tallies(n)) t.born++;
	}
	/** The species, diet and size-class tallies a NEOS counts toward. */
	private tallies(n: Neo): Tally[] {
		const s = this.species.get(n.spc);
		const out = [this.byDiet[n.diet], this.bySize[sizeClass(n.size)]];
		if (s) out.push(s);
		if (s && n.color === ALBINO) out.push(s.albino);
		return out;
	}
	private pruneSpecies() {
		if (this.species.size <= MAX_SPECIES) return;
		const alive = new Set(this.neos.map((o) => o.spc));
		const gone = [...this.species.values()].filter((s) => !alive.has(s.id)).sort((a, b) => a.born - b.born);
		for (const s of gone.slice(0, this.species.size - MAX_SPECIES)) this.species.delete(s.id);
	}
	/** Alive counts per species, diet and size class right now (and peaks updated). */
	private countAlive() {
		const sp = new Map<number, number>();
		const albino = new Map<number, number>();
		const diet = [0, 0, 0];
		const size = [0, 0, 0];
		for (const n of this.neos) {
			sp.set(n.spc, (sp.get(n.spc) ?? 0) + 1);
			if (n.color === ALBINO) albino.set(n.spc, (albino.get(n.spc) ?? 0) + 1);
			diet[n.diet]++;
			size[sizeClass(n.size)]++;
		}
		for (const [id, c] of sp) {
			const s = this.species.get(id);
			if (s && c > s.peak) s.peak = c;
		}
		for (const [id, c] of albino) {
			const s = this.species.get(id);
			if (s && c > s.albino.peak) s.albino.peak = c;
		}
		diet.forEach((c, i) => (this.byDiet[i].peak = Math.max(this.byDiet[i].peak, c)));
		size.forEach((c, i) => (this.bySize[i].peak = Math.max(this.bySize[i].peak, c)));
		return { sp, albino, diet, size };
	}
	/** Everything the details panel shows. */
	details() {
		const alive = this.countAlive();
		const species = [...this.species.values()].map((s) => ({
			id: s.id,
			name: s.name,
			diet: s.diet,
			first: s.first,
			last: s.last,
			alive: alive.sp.get(s.id) ?? 0,
			size: s.born ? s.sizeSum / s.born : 1,
			litter: s.born ? s.litterSum / s.born : 1,
			born: s.born,
			died: s.died,
			peak: s.peak,
			food: s.food,
			prey: s.prey,
			eatenBy: s.eatenBy,
			escapes: s.escapes,
			avgFit: s.died ? s.fitSum / s.died : 0,
			avgLife: s.died ? s.lifeSum / s.died : 0,
			albino: s.albino.born
				? {
						...s.albino,
						alive: alive.albino.get(s.id) ?? 0,
						avgFit: s.albino.died ? s.albino.fitSum / s.albino.died : 0,
						avgLife: s.albino.died ? s.albino.lifeSum / s.albino.died : 0
					}
				: null
		}));
		const group = (t: Tally, n: number) => ({ ...t, alive: n, avgFit: t.died ? t.fitSum / t.died : 0, avgLife: t.died ? t.lifeSum / t.died : 0 });
		return {
			species,
			diets: this.byDiet.map((t, i) => group(t, alive.diet[i])),
			sizes: this.bySize.map((t, i) => group(t, alive.size[i])),
			history: this.speciesHistory
		};
	}

	/** How different two NEOS are (NEAT's compatibility distance): extra nodes, plus weight differences. */
	private distance(a: Neo | Genome, b: Neo | Genome) {
		const h = Math.min(a.nh, b.nh);
		let d = 0;
		for (let i = 0; i < h; i++)
			d += Math.abs(a.wih[i] - b.wih[i]) + Math.abs(a.wih[MAX_H + i] - b.wih[MAX_H + i]) + Math.abs(a.who[i] - b.who[i]) + Math.abs(a.who[MAX_H + i] - b.who[MAX_H + i]);
		return Math.abs(a.nh - b.nh) + d / (4 * h);
	}
	/** NEOS a and b may mate: neighbouring diets only (never herbivore with carnivore), and for NEAT, the same species. */
	private compatible(a: Neo, b: Neo) {
		return Math.abs(a.diet - b.diet) <= 1 && (this.cfg.algo !== 'neat' || this.distance(a, b) <= this.cfg.compat);
	}
	/** a can eat b: carnivores eat herbivores and omnivores; omnivores eat herbivores. */
	private eats(a: Neo, b: Neo) {
		return a.diet === 2 ? b.diet < 2 : a.diet === 1 && b.diet === 0;
	}

	/** A baby's size and speed: its fitter parent's, sometimes nudged bigger or smaller, faster or slower. */
	private bodyOf(p: Neo | Genome) {
		const c = this.cfg;
		let size = p.size ?? 1;
		let sp = p.sp ?? 1;
		if (!c.body) return { size: 1, sp: 1 };
		if (Math.random() < c.sizeMutate) size *= Math.exp(gauss() * 0.15);
		if (Math.random() < c.sizeMutate) sp *= Math.exp(gauss() * 0.12);
		return {
			size: Math.min(c.maxSize, Math.max(MIN_SIZE, size)),
			sp: Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], sp))
		};
	}

	/**
	 * A baby's diet: its fitter parent's, sometimes shifted. Hunger is the pressure: a starving
	 * parent's baby often turns meatier, a well-fed one's almost never (and meat-eaters with plenty
	 * of food drift back), so predators only take hold when food is short. An omnivore living
	 * mostly off hunting also tends to have carnivores (it's specialising).
	 */
	private dietOf(p: Neo | Genome) {
		const c = this.cfg;
		const d = p.diet ?? 0;
		if (!c.predators) return 0;
		const hunger = 'hunger' in p ? Math.min(1, p.hunger / (c.starve * 0.5)) : 0;
		const meaty = d === 1 && 'meat' in p && p.fit > 0 ? p.meat / p.fit : 0;
		// How short food is across the world: none when it's plentiful (or regrows at once), so
		// one unlucky hungry NEOS in a well-fed world doesn't start a line of predators.
		const scarce = c.foodLimit && this.fx.length ? 1 - this.foodLeft() / this.fx.length : 0;
		const r = Math.random();
		const step = c.omnivores ? 1 : 2;
		// Meatier: only when plant food is short, the parent is going hungry (or, an omnivore, lives
		// off hunting), and there's plenty of prey about (few meat-eaters already).
		const prey = 1 - this.meatShare;
		const up = this.meatShare < 0.3 ? scarce * Math.max(hunger * hunger, meaty) * prey * prey : 0;
		// Back toward plants (a strong pull, so predators can't overrun the prey): more likely the
		// more common meat-eaters are, when this one is struggling to catch any (hungry), and when
		// plant food is plentiful again.
		const down = Math.min(0.6, c.predMutate * (1 - scarce) + Math.max(0, this.meatShare - 0.15) * 1.5 + 0.25 * hunger);
		if (d < 2 && r < c.predMutate * up) return Math.min(2, d + step);
		if (d > 0 && r < down) return Math.max(0, d - step);
		return c.omnivores || d !== 1 ? d : 0;
	}

	/** A baby's life-history genes (litter size, maturity, rest): its fitter parent's, sometimes changed. */
	private lifeOf(p: Neo | Genome) {
		const c = this.cfg;
		if (!c.litter) return { litter: 1, matureAt: c.mature, rest: c.cooldown };
		let litter = p.litter ?? 1;
		let matureAt = p.matureAt ?? c.mature;
		let rest = p.rest ?? c.cooldown;
		if (Math.random() < c.litterMutate) litter += Math.random() < 0.5 ? -1 : 1;
		if (Math.random() < c.litterMutate) matureAt *= Math.exp(gauss() * 0.2);
		if (Math.random() < c.litterMutate) rest *= Math.exp(gauss() * 0.2);
		return {
			litter: Math.max(1, Math.min(c.maxLitter, litter)),
			matureAt: Math.round(Math.max(20, Math.min(800, matureAt))),
			rest: Math.round(Math.max(10, Math.min(800, rest)))
		};
	}
	/** Resting less between births makes each baby cost more food (√ of how much shorter the rest is). */
	private babyCost(a: Neo, b: Neo) {
		const c = this.cfg;
		if (!c.litter) return c.breedCost;
		const rest = Math.max(10, (a.rest + b.rest) / 2);
		return c.breedCost * Math.min(2.5, Math.max(0.7, Math.sqrt(Math.max(10, c.cooldown) / rest)));
	}

	/**
	 * A birth: as many babies as the fitter parent's litter size (room allowing), around the first
	 * parent. The trade-off: bigger litters mean babies with shorter lives and (body evolution)
	 * less starting energy, and the parents rest longer afterwards.
	 */
	/** Could breed now: grown up, rested, not eaten, and fed enough to pay its share of a baby. */
	private ready(n: Neo, solo = false) {
		const c = this.cfg;
		const cost = this.babyCost(n, n);
		return !n.eaten && n.cool <= 0 && n.age >= n.matureAt && n.store >= (solo ? cost : cost / 2);
	}

	private birth(a: Neo, b: Neo, room: number): Neo[] {
		const c = this.cfg;
		// Each baby costs food from the parents' stores: a litter is as big as the gene says and they can afford.
		const funds = a === b ? a.store : a.store + b.store;
		const cost = this.babyCost(a, b);
		const k = Math.max(0, Math.min(room, (a.fit >= b.fit ? a : b).litter, Math.floor(funds / cost)));
		if (!k) return [];
		const left = Math.max(0, funds - k * cost);
		if (a === b) a.store = left;
		else {
			a.store = (left * a.store) / funds;
			b.store = left - a.store;
		}
		const out: Neo[] = [];
		for (let i = 0; i < k; i++) {
			const ang = (i / Math.max(1, k)) * Math.PI * 2;
			const r = k > 1 ? 0.06 : 0;
			out.push(this.child(a, b, Math.min(WORLD, Math.max(-WORLD, a.x + Math.cos(ang) * r)), Math.min(WORLD, Math.max(-WORLD, a.y + Math.sin(ang) * r)), k));
		}
		// Each parent rests by its own rest gene, longer after a bigger litter.
		a.cool = Math.round(a.rest * (1 + 0.6 * (k - 1)));
		b.cool = Math.round(b.rest * (1 + 0.6 * (k - 1)));
		return out;
	}

	/** A baby of a and b (b may be a itself), made the way the chosen algorithm makes them. */
	private child(a: Genome | Neo, b: Genome | Neo, x?: number, y?: number, brood = 1): Neo {
		const c = this.cfg;
		const gen = Math.max(a.gen, b.gen) + 1;
		let life = randInt(c.lifeMin, Math.max(c.lifeMin, c.lifeMax));
		// Lifespan inherited (± the mutation strength) instead of drawn fresh.
		if (c.mutLifespan) life = Math.round(Math.max(50, ((a.life + b.life) / 2) * rand(1 - c.mutStrength, 1 + c.mutStrength)));
		// Babies from bigger litters live shorter lives.
		life = Math.round(life * Math.max(0.4, 1 - 0.08 * (brood - 1)));
		const lifeGenes = this.lifeOf(a.fit >= b.fit ? a : b);
		// Maturing early means a shorter life (live fast, die young).
		if (c.litter) life = Math.round(life * Math.min(1.2, Math.max(0.6, 0.6 + (0.4 * lifeGenes.matureAt) / Math.max(20, c.mature))));
		const diet = this.dietOf(a.fit >= b.fit ? a : b);
		const body = { ...this.bodyOf(a.fit >= b.fit ? a : b), ...lifeGenes, brood };
		if (c.algo === 'random') return this.spawn({ life, gen, diet, ...body }, x, y);

		// The genes as one list: food and danger input weights, then the speed row, then the turn row.
		const G = MAX_H * 4;
		const get = (p: Genome | Neo, i: number) => (i < 2 * MAX_H ? (i < p.wih.length ? p.wih[i] : 0) : p.who[i - 2 * MAX_H]);
		const g = new Float32Array(G);
		// NEAT keeps the fitter parent's network shape (its extra nodes come along).
		const fa = a.fit >= b.fit ? a : b;
		const fb = fa === a ? b : a;
		let nh = c.algo === 'ga' ? c.hidden : fa.nh;
		const nodeOf = (i: number) => i % MAX_H;

		if (c.algo === 'es') {
			// A copy of the parent with Gaussian noise on every weight.
			for (let i = 0; i < G; i++) g[i] = clamp1(get(a, i) + gauss() * c.mutStrength);
			nh = a.nh;
		} else if (c.algo === 'de') {
			// DE/rand/1/bin: A + F·(B − C), each gene taken with chance CR (at least one always is).
			const pool: (Neo | Genome)[] = this.neos.length > 2 ? this.neos : [a, b];
			const r = pool[randInt(0, pool.length - 1)];
			const keep = randInt(0, G - 1);
			for (let i = 0; i < G; i++) g[i] = Math.random() < c.deCR || i === keep ? clamp1(get(a, i) + c.deF * (get(b, i) - get(r, i))) : get(a, i);
			nh = Math.max(a.nh, b.nh);
		} else {
			// NEAT and the original GA: crossover, then (sometimes) mutation.
			const w = Math.random();
			const cut = randInt(1, G - 1);
			for (let i = 0; i < G; i++) {
				const pa = get(fa, i);
				// Genes only the fitter parent has (its extra nodes) come from it.
				const pb = nodeOf(i) < fb.nh ? get(fb, i) : pa;
				g[i] = c.crossover === 'blend' ? w * pa + (1 - w) * pb : c.crossover === 'uniform' ? (Math.random() < 0.5 ? pa : pb) : c.crossover === 'onepoint' ? (i < cut ? pa : pb) : pa;
			}
			const used = () => nodeOf(randInt(0, nh - 1)) + MAX_H * randInt(0, 3);
			if (Math.random() < c.mutate) {
				// Scale: the original's mutation (one weight × 0.9–1.1, or ± the strength).
				if (c.mutScale) {
					const i = used();
					g[i] = clamp1(g[i] * rand(1 - c.mutStrength, 1 + c.mutStrength));
				}
				// Gaussian: a little noise on every weight.
				if (c.mutGauss) for (let i = 0; i < G; i++) g[i] = clamp1(g[i] + gauss() * c.mutStrength * 0.5);
				// Reset: one weight starts over.
				if (c.mutReset) g[used()] = rand(-1, 1);
			}
			// NEAT: sometimes a new hidden node, with small outgoing weights so it eases in.
			if (c.algo === 'neat' && nh < MAX_H && Math.random() < c.addNode) {
				g[nh] = rand(-1, 1);
				g[MAX_H + nh] = rand(-1, 1);
				g[2 * MAX_H + nh] = rand(-0.3, 0.3);
				g[3 * MAX_H + nh] = rand(-0.3, 0.3);
				nh++;
			}
		}
		return this.spawn({ wih: g.subarray(0, 2 * MAX_H), who: g.subarray(2 * MAX_H), nh, life, gen, diet, ...body }, x, y);
	}

	/** Two parents from a pool, by the chosen selection. */
	private pick(pool: (Neo | Genome)[]): [Neo | Genome, Neo | Genome] {
		const c = this.cfg;
		const sorted = pool.toSorted((p, q) => q.fit - p.fit);
		const one = (): Neo | Genome => {
			if (c.selection === 'tournament') {
				let best = sorted[randInt(0, sorted.length - 1)];
				for (let k = 0; k < 2; k++) {
					const o = sorted[randInt(0, sorted.length - 1)];
					if (o.fit > best.fit) best = o;
				}
				return best;
			}
			if (c.selection === 'roulette') {
				const sum = sorted.reduce((s, p) => s + p.fit + 0.5, 0);
				let r = Math.random() * sum;
				for (const p of sorted) if ((r -= p.fit + 0.5) <= 0) return p;
				return sorted[0];
			}
			// Truncation (the original): a random one of the top elitism %.
			const top = Math.max(1, Math.floor(sorted.length * c.elitism));
			return sorted[randInt(0, top - 1)];
		};
		const a = one();
		// NEAT: the second parent from a's species when there is one.
		if (c.algo === 'neat') {
			for (let k = 0; k < 6; k++) {
				const b = one();
				if (b !== a && this.distance(a, b) <= c.compat) return [a, b];
			}
		}
		return [a, one()];
	}

	private nearestFood(n: Neo): number {
		const walled = this.walls.length > 0;
		const cx = cellOf(n.x);
		const cy = cellOf(n.y);
		let best = -1;
		let bd = Infinity;
		for (let ring = 0; ring < GRID; ring++) {
			// Anything in a farther ring is at least (ring - 1) cells away.
			if (best >= 0 && (ring - 1) * CELL > Math.sqrt(bd)) break;
			for (let gy = cy - ring; gy <= cy + ring; gy++) {
				if (gy < 0 || gy >= GRID) continue;
				for (let gx = cx - ring; gx <= cx + ring; gx++) {
					if (gx < 0 || gx >= GRID || (Math.abs(gx - cx) !== ring && Math.abs(gy - cy) !== ring)) continue;
					for (const i of this.foodGrid[gy * GRID + gx]) {
						const dx = this.fx[i] - n.x;
						const dy = this.fy[i] - n.y;
						const d = dx * dx + dy * dy;
						if (d < bd && (!walled || this.sees(n.x, n.y, this.fx[i], this.fy[i]))) {
							bd = d;
							best = i;
						}
					}
				}
			}
		}
		return best;
	}

	step() {
		const c = this.cfg;
		if (this.extinct) return;
		const neos = this.neos;

		// Food, bucketed so each NEOS only looks nearby.
		for (const b of this.foodGrid) b.length = 0;
		// Limited food: eaten food (NaN) regrows a little at a time.
		if (c.foodLimit && this.waiting) {
			this.regrow = Math.min(this.regrow + c.foodRegrow * DT, this.waiting);
			for (let i = 0; i < this.fx.length && this.regrow >= 1; i++)
				if (Number.isNaN(this.fx[i])) {
					[this.fx[i], this.fy[i]] = this.freeSpot();
					this.regrow--;
					this.waiting--;
				}
		}
		for (let i = 0; i < this.fx.length; i++) if (!Number.isNaN(this.fx[i])) this.foodGrid[cellOf(this.fy[i]) * GRID + cellOf(this.fx[i])].push(i);
		for (const n of neos) {
			n.foodD = Infinity;
			if (n.diet === 2) continue;
			let f = this.nearestFood(n);
			if (f < 0) continue;
			const dx = this.fx[f] - n.x;
			const dy = this.fy[f] - n.y;
			// (A bigger body doesn't reach food any further: size only costs a herbivore, unless there are hunters.)
			if (dx * dx + dy * dy <= EAT_R * EAT_R) {
				// Omnivores are generalists: plants are worth half as much to them as to a herbivore.
				const worth = n.diet === 1 ? 0.5 : 1;
				n.fit += worth;
				n.store += worth;
				n.hunger = 0;
				n.energy = Math.min(STORE_E * n.size, n.energy + FOOD_E);
				this.cur.food++;
				this.totals.food++;
				for (const t of this.tallies(n)) t.food++;
				const old = this.foodGrid[cellOf(this.fy[f]) * GRID + cellOf(this.fx[f])];
				old.splice(old.indexOf(f), 1);
				if (c.foodLimit) {
					this.fx[f] = this.fy[f] = NaN;
					this.waiting++;
				} else {
					[this.fx[f], this.fy[f]] = this.freeSpot();
					this.foodGrid[cellOf(this.fy[f]) * GRID + cellOf(this.fx[f])].push(f);
				}
				f = this.nearestFood(n);
				if (f < 0) continue;
			}
			n.foodD = Math.hypot(this.fx[f] - n.x, this.fy[f] - n.y);
			n.input = heading(n, this.fx[f], this.fy[f]);
		}

		let meaters = 0;
		for (const n of neos) if (n.diet) meaters++;
		this.meatShare = neos.length ? meaters / neos.length : 0;

		// Who counts as fit: the fitness at the elitism percentile (rechecked every few steps).
		if (this.totals.steps % 5 === 0 && neos.length) {
			const fits = neos.map((n) => n.fit).sort((a, b) => b - a);
			this.threshold = fits[Math.max(0, Math.floor(fits.length * c.elitism) - 1)];
		}
		const fit = (n: Neo) => !c.pickyMates || n.fit >= Math.max(1, this.threshold);

		for (const b of this.neoGrid) b.length = 0;
		for (const n of neos) this.neoGrid[cellOf(n.y) * GRID + cellOf(n.x)].push(n);
		if (c.predators) this.hunt();

		// Late in life, swim toward the nearest fit (and, for NEAT, compatible) NEOS instead of food.
		// The urge to mate: a NEOS that could breed now (grown up, rested, fed enough) goes after a
		// willing mate it can see. Mates are chosen by attraction: its own species first, and fitter
		// ones, which can be seen from further away (the fittest draw their species from across
		// most of the world).
		for (const n of neos) n.seekD = Infinity;
		if (c.seekMates && c.breedInWorld && c.algo !== 'es') {
			let top = 1;
			for (const o of neos) if (o.fit > top) top = o.fit;
			const elite = Math.max(1, this.threshold);
			for (const n of neos) {
				if (!this.ready(n) || !fit(n)) continue;
				let best: Neo | null = null;
				let bs = 0;
				let bd = Infinity;
				const cx = cellOf(n.x);
				const cy = cellOf(n.y);
				const r = Math.ceil(ATTRACT_FAR / CELL);
				for (let gy = Math.max(0, cy - r); gy <= Math.min(GRID - 1, cy + r); gy++)
					for (let gx = Math.max(0, cx - r); gx <= Math.min(GRID - 1, cx + r); gx++)
						for (const o of this.neoGrid[gy * GRID + gx]) {
							if (o === n || !this.ready(o) || !fit(o) || !this.compatible(n, o)) continue;
							if (this.walls.length && !this.sees(n.x, n.y, o.x, o.y)) continue;
							const d = Math.sqrt((o.x - n.x) ** 2 + (o.y - n.y) ** 2);
							const same = o.spc === n.spc;
							// Any willing mate in sight will do, but attraction picks: its own species, fitter, and
							// closer; the elite of its species draw it from furthest away.
							if (d > ATTRACT_FAR) continue;
							const reach = same && o.fit >= elite ? ATTRACT_FAR : ATTRACT_NEAR * (1 + o.fit / top);
							const score = ((same ? 2 : 1) * (1 + (2 * o.fit) / top) * (d <= reach ? 3 : 1)) / (d + 0.1);
							if (score > bs) {
								bs = score;
								bd = d;
								best = o;
							}
						}
				if (best) {
					n.input = heading(n, best.x, best.y);
					n.seekD = bd;
				}
			}
		}

		// Two grown-up, fit NEOS that meet have a baby (an evolution strategy needs no mate: it buds).
		if (c.breedInWorld) {
			const born: Neo[] = [];
			for (const n of neos) {
				if (!this.ready(n, c.algo === 'es') || !fit(n)) continue;
				if (neos.length + born.length >= c.popCap) break;
				if (c.algo === 'es') {
					born.push(...this.birth(n, n, c.popCap - neos.length - born.length));
					continue;
				}
				const cx = cellOf(n.x);
				const cy = cellOf(n.y);
				search: for (let gy = Math.max(0, cy - 1); gy <= Math.min(GRID - 1, cy + 1); gy++)
					for (let gx = Math.max(0, cx - 1); gx <= Math.min(GRID - 1, cx + 1); gx++)
						for (const o of this.neoGrid[gy * GRID + gx]) {
							if (o === n || !this.ready(o) || !fit(o)) continue;
							const touch = MATE_R * (n.size + o.size) / 2;
							if ((o.x - n.x) ** 2 + (o.y - n.y) ** 2 > touch * touch || !this.compatible(n, o)) continue;
							born.push(...this.birth(n, o, c.popCap - neos.length - born.length));
							break search;
						}
			}
			if (born.length) {
				neos.push(...born);
				this.cur.born += born.length;
				this.totals.born += born.length;
			}
		}

		// Think, turn, speed up or slow down, move, age; the old die.
		const turn = c.drMax * DT;
		const acc = c.dvMax * DT;
		let w = 0;
		for (const n of neos) {
			// Old age, eaten, (meat-eaters) starved, or (body evolution) out of energy.
			if (n.age >= n.life || n.eaten || (n.diet > 0 && n.hunger > c.starve) || (c.body && n.energy <= 0)) {
				this.cur.deadFit.push(n.fit);
				this.cur.died++;
				this.totals.died++;
				for (const t of this.tallies(n)) {
					t.died++;
					t.fitSum += n.fit;
					t.lifeSum += n.age;
					if (n.eaten) t.eatenBy++;
				}
				continue;
			}
			let dv = 0;
			let dr = 0;
			for (let h = 0; h < n.nh; h++) {
				const a = Math.tanh(n.wih[h] * n.input + n.wih[MAX_H + h] * n.danger);
				dv += n.who[h] * a;
				dr += n.who[MAX_H + h] * a;
			}
			// Top speed: by diet, then (body evolution) the speed gene, and bigger is slower.
			const dietTop = n.diet === 2 ? c.vMax * c.predSpeed : n.diet === 1 ? (c.vMax * (1 + c.predSpeed)) / 2 : c.vMax;
			const top = c.body ? (dietTop * n.sp) / Math.sqrt(n.size) : dietTop;
			const push = acc / (c.body ? n.size : 1);
			if (n.seekD < Infinity) {
				// Courting (instinct, not the network): turn straight toward the mate, slow down as it
				// gets close (and to turn when it's off to the side), and stop once there, so the
				// pair meet instead of circling each other.
				n.r = (n.r + Math.max(-turn, Math.min(turn, n.input * 180)) + 360) % 360;
				const near = n.seekD <= (MATE_R * n.size) / 2 ? 0 : Math.min(1, Math.max(0.15, n.seekD / COURT_R));
				const want = top * near * (1 - 0.7 * Math.min(1, Math.abs(n.input) * 2));
				n.v = n.v > want ? Math.max(want, n.v - push * 2) : Math.min(want, n.v + push);
			} else {
				n.r = (n.r + Math.tanh(dr) * turn + 360) % 360;
				n.v = Math.min(top, Math.max(0, n.v + Math.tanh(dv) * push));
			}
			// Walls ahead (a reflex, not the network): look a little way ahead; if a wall's coming,
			// turn toward whichever side is clearer, and slow down.
			if (this.walls.length) {
				const look = 0.15 + n.v * 0.5;
				if (this.clearance(n.x, n.y, n.r, look) < look) {
					const left = this.clearance(n.x, n.y, n.r + 50, look);
					const right = this.clearance(n.x, n.y, n.r - 50, look);
					n.r = (n.r + (left >= right ? turn : -turn) + 360) % 360;
					n.v *= 0.85;
				}
			}
			n.hunger++;
			if (n.digest > 0) n.digest--;
			// Energy: bigger and faster burns more.
			if (c.body) n.energy -= c.energyUse * n.size * n.size * (0.3 + 0.7 * (n.v / c.vMax) ** 2);
			const rad = (n.r * Math.PI) / 180;
			const nx = Math.min(WORLD, Math.max(-WORLD, n.x + n.v * Math.cos(rad) * DT));
			const ny = Math.min(WORLD, Math.max(-WORLD, n.y + n.v * Math.sin(rad) * DT));
			if (!this.walls.length || !this.blocked(nx, ny)) {
				n.x = nx;
				n.y = ny;
			} else {
				// A wall: slide along it if one direction is free, else stop.
				if (!this.blocked(nx, n.y)) n.x = nx;
				else if (!this.blocked(n.x, ny)) n.y = ny;
				n.v *= 0.5;
			}
			n.age++;
			if (n.cool > 0) n.cool--;
			if (n.fit > this.totals.bestEver) this.totals.bestEver = n.fit;
			if (n.gen > this.totals.lineage) this.totals.lineage = n.gen;
			neos[w++] = n;
		}
		neos.length = w;
		this.totals.steps++;

		// Elitism: the fittest living NEOS top the population back up.
		if (c.refill && this.totals.steps % 10 === 0 && neos.length < c.popSize) this.refillFrom(neos, c.popSize - neos.length);

		if (++this.genStep >= Math.round(c.genTime / DT)) this.endGeneration();

		// Everyone's dead: nothing brings them back.
		if (!neos.length) this.extinct = true;
	}

	/**
	 * Meat-eaters steer toward the nearest NEOS they can eat (omnivores: if it's closer than food)
	 * and eat any they touch; everyone senses the nearest NEOS that could eat them (its heading,
	 * stronger the closer it is).
	 */
	private hunt() {
		const c = this.cfg;
		const reach = Math.ceil(c.senseR / CELL);
		for (const n of this.neos) {
			n.danger = 0;
			if (n.eaten) continue;
			const cx = cellOf(n.x);
			const cy = cellOf(n.y);
			// Hunters look twice as far for prey as prey look for hunters.
			const r = n.diet ? reach * 2 : reach;
			let prey: Neo | null = null;
			let pd = Infinity;
			let threat: Neo | null = null;
			let td = Infinity;
			for (let gy = Math.max(0, cy - r); gy <= Math.min(GRID - 1, cy + r); gy++)
				for (let gx = Math.max(0, cx - r); gx <= Math.min(GRID - 1, cx + r); gx++)
					for (const o of this.neoGrid[gy * GRID + gx]) {
						if (o === n || o.eaten) continue;
						const d = (o.x - n.x) ** 2 + (o.y - n.y) ** 2;
						if ((d < pd || d < td) && this.walls.length && !this.sees(n.x, n.y, o.x, o.y)) continue;
						if (d < pd && this.eats(n, o)) {
							pd = d;
							prey = o;
						}
						// A threat: anything that could eat it (a smaller one only as part of a pack).
						if (d < td && this.eats(o, n)) {
							td = d;
							threat = o;
						}
					}
			if (threat) {
				const d = Math.sqrt(td);
				// Being bigger than the hunter makes it less of a worry (it would take a pack).
				const worry = Math.min(1, threat.size / n.size);
				if (d <= c.senseR) n.danger = heading(n, threat.x, threat.y) * (1 - d / c.senseR) * worry;
				// A hunter within half the sense range: being chased.
				if (d <= c.senseR * 0.5) n.chased = true;
			}
			// Got away (no hunter in range any more): surviving is worth a little fitness.
			if (n.chased && !n.danger) {
				n.chased = false;
				n.fit += ESCAPE_FIT;
				this.totals.escapes++;
				for (const t of this.tallies(n)) t.escapes++;
			}
			if (!prey) continue;
			// Still digesting its last kill: not hunting (an omnivore keeps eating plants). Omnivores
			// mostly graze, and only hunt once they've gone a while without eating.
			if (n.digest > 0 || (n.diet === 1 && n.hunger < c.starve * 0.25)) continue;
			const d = Math.sqrt(pd);
			if (d <= this.touch(n, prey)) this.bite(n, prey);
			if (!prey.eaten && (n.diet === 2 || d < n.foodD)) n.input = heading(n, prey.x, prey.y);
		}
	}

	/** How close a hunter has to be to catch prey. */
	private touch(a: Neo, b: Neo) {
		return EAT_R * 0.75 * (a.size + b.size);
	}
	/**
	 * Hunter n is touching prey. As big or bigger: eaten. Smaller: only if the hunters touching it
	 * (the pack) add up to its size, and they share it.
	 */
	private bite(n: Neo, prey: Neo) {
		const c = this.cfg;
		let pack = [n];
		if (n.size < prey.size * 0.9) {
			pack = [];
			const cx = cellOf(prey.x);
			const cy = cellOf(prey.y);
			for (let gy = Math.max(0, cy - 1); gy <= Math.min(GRID - 1, cy + 1); gy++)
				for (let gx = Math.max(0, cx - 1); gx <= Math.min(GRID - 1, cx + 1); gx++)
					for (const o of this.neoGrid[gy * GRID + gx])
						if (!o.eaten && o !== prey && this.eats(o, prey) && (o.x - prey.x) ** 2 + (o.y - prey.y) ** 2 <= this.touch(o, prey) ** 2) pack.push(o);
			if (pack.reduce((s, o) => s + o.size, 0) < prey.size) return;
		}
		prey.eaten = true;
		for (const t of this.tallies(n)) t.prey++;
		this.cur.eaten++;
		this.totals.eaten++;
		for (const o of pack) {
			// Bigger prey is a bigger meal, shared by the pack; omnivores get half.
			const v = ((o.diet === 2 ? c.preyValue : Math.max(1, c.preyValue / 2)) * prey.size) / pack.length;
			o.fit += v;
			// Prey converts poorly into babies: a kill pays a carnivore's half of one baby (an
			// omnivore needs two), however much fitness it gives, so predators breed slower than they hunt.
			o.store += (c.breedCost * (o.diet === 2 ? 0.5 : 0.25) * prey.size) / pack.length;
			o.digest = DIGEST;
			o.meat += v;
			o.hunger = 0;
			o.energy = Math.min(STORE_E * o.size, o.energy + FOOD_E * 2 * prey.size);
		}
	}

	/** Record this generation's stats. */
	private endGeneration() {
		const fits = [...this.cur.deadFit, ...this.neos.map((n) => n.fit)];
		const alive = this.countAlive();
		for (const s of this.species.values()) if (s.last === null && !alive.sp.has(s.id)) s.last = this.gen;
		this.speciesHistory.push({ gen: this.gen, counts: Object.fromEntries(alive.sp) });
		if (this.speciesHistory.length > 500) this.speciesHistory.shift();
		this.history.push({
			gen: this.gen,
			best: fits.length ? Math.max(...fits) : 0,
			avg: fits.length ? Math.round((fits.reduce((a, b) => a + b, 0) / fits.length) * 100) / 100 : 0,
			alive: this.neos.length,
			total: fits.length,
			born: this.cur.born,
			died: this.cur.died,
			food: this.cur.food,
			lineage: this.neos.reduce((m, n) => Math.max(m, n.gen), 0),
			preds: this.neos.filter((n) => n.diet === 2).length,
			omnis: this.neos.filter((n) => n.diet === 1).length,
			size: this.neos.length ? Math.round((this.neos.reduce((a, n) => a + n.size, 0) / this.neos.length) * 100) / 100 : 1,
			litter: this.neos.length ? Math.round((this.neos.reduce((a, n) => a + n.litter, 0) / this.neos.length) * 100) / 100 : 1,
			eaten: this.cur.eaten
		});
		if (this.history.length > 500) this.history.shift();
		this.gen++;
		this.genStep = 0;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0, eaten: 0 };
	}

	/**
	 * Elitism's top-up: babies of the fittest living NEOS, bred like any other baby. Only NEOS that
	 * have eaten and are off their breeding cooldown can be parents (herbivores first: meat-eaters
	 * only arise from hungry parents and spread by hunting), each has one baby and then rests. So
	 * it's no safety net: if too few NEOS find food, births can't keep up with deaths and the
	 * population dies out.
	 */
	private refillFrom(living: Neo[], n: number) {
		const fed = living.filter((p) => p.fit >= 1 && !p.eaten && p.cool <= 0);
		const herbivores = fed.filter((p) => !p.diet);
		let pool = herbivores.length >= 2 ? herbivores : fed;
		const add: Neo[] = [];
		while (add.length < n && pool.length >= 2) {
			const [a, b] = this.pick(pool);
			const pa = a as Neo;
			const pb = (b === a ? pool.find((p) => p !== a) : b) as Neo;
			add.push(...this.birth(pa, pb, n - add.length));
			pool = pool.filter((p) => p !== pa && p !== pb);
		}
		this.neos.push(...add);
		this.cur.born += add.length;
		this.totals.born += add.length;
	}

	/** What a save keeps: the settings, the stats, and every NEOS's genes (to carry on later). */
	snapshot() {
		const genes = (n: Neo | Genome) => ({
			wih: Array.from(n.wih, (v) => +v.toFixed(4)),
			who: Array.from(n.who, (v) => +v.toFixed(4)),
			nh: n.nh,
			diet: n.diet ?? 0,
			size: +(n.size ?? 1).toFixed(3),
			sp: +(n.sp ?? 1).toFixed(3),
			litter: n.litter ?? 1,
			matureAt: n.matureAt ?? this.cfg.mature,
			rest: n.rest ?? this.cfg.cooldown,
			life: n.life,
			gen: n.gen,
			fit: n.fit
		});
		return {
			cfg: this.cfg,
			gen: this.gen,
			history: this.history,
			totals: this.totals,
			walls: this.walls,
			neos: this.neos.map(genes)
		};
	}
	restore(s: ReturnType<Sim['snapshot']>) {
		this.cfg = { ...DEFAULTS, ...s.cfg };
		this.walls = s.walls ?? [];
		this.reset();
		this.gen = s.gen ?? 0;
		this.history = s.history ?? [];
		this.totals = { ...this.totals, ...s.totals };
		if (s.neos?.length) {
			// The loaded NEOS are sorted into species afresh.
			this.clearSpecies();
			this.neos = [];
			for (const g of s.neos) this.neos.push({ ...this.spawn(g), fit: g.fit });
		}
	}

	/** NEAT's species: NEOS grouped with the first representative they're compatible with. */
	private speciesCount() {
		if (this.cfg.algo !== 'neat') return 0;
		const reps: Neo[] = [];
		for (const n of this.neos) if (!reps.some((r) => this.distance(r, n) <= this.cfg.compat)) reps.push(n);
		return reps.length;
	}

	/** Live numbers for the stats panel. */
	live() {
		const n = this.neos.length;
		let sum = 0;
		let best = 0;
		let lineage = 0;
		let hidden = 0;
		let preds = 0;
		let omnis = 0;
		let sizeH = 0;
		let sizeM = 0;
		let speed = 0;
		for (const o of this.neos) {
			if (o.diet) sizeM += o.size;
			else sizeH += o.size;
			speed += o.sp;
			if (o.diet === 2) preds++;
			else if (o.diet === 1) omnis++;
			sum += o.fit;
			hidden += o.nh;
			if (o.fit > best) best = o.fit;
			if (o.gen > lineage) lineage = o.gen;
		}
		return {
			alive: n,
			avg: n ? sum / n : 0,
			best,
			lineage,
			hidden: n ? hidden / n : 0,
			preds,
			omnis,
			sizeHerb: n - preds - omnis ? sizeH / (n - preds - omnis) : 0,
			sizeMeat: preds + omnis ? sizeM / (preds + omnis) : 0,
			speedGene: n ? speed / n : 1,
			litter: n ? this.neos.reduce((a, o) => a + o.litter, 0) / n : 1,
			matureAt: n ? this.neos.reduce((a, o) => a + o.matureAt, 0) / n : this.cfg.mature,
			rest: n ? this.neos.reduce((a, o) => a + o.rest, 0) / n : this.cfg.cooldown,
			litterHerb: n - preds - omnis ? this.neos.reduce((a, o) => a + (o.diet ? 0 : o.litter), 0) / (n - preds - omnis) : 0,
			litterMeat: preds + omnis ? this.neos.reduce((a, o) => a + (o.diet ? o.litter : 0), 0) / (preds + omnis) : 0,
			foodLeft: this.foodLeft(),
			species: this.speciesCount(),
			progress: this.genStep / Math.round(this.cfg.genTime / DT),
			time: this.totals.steps * DT
		};
	}
}
