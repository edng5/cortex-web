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
/** Fitness for getting away from a hunter (food is worth 1). */
const ESCAPE_FIT = 0.5;
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
	revive: boolean;
}

export const DEFAULTS: Config = {
	algo: 'neat',
	popSize: 64,
	popCap: 150,
	foodNum: 100,
	elitism: 0.2,
	mutate: 0.1,
	mutStrength: 0.1,
	mature: 200,
	lifeMin: 500,
	lifeMax: 600,
	vMax: 0.5,
	drMax: 720,
	dvMax: 0.25,
	cooldown: 150,
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
	predSpeed: 1.15,
	senseR: 0.8,
	starve: 400,
	body: false,
	sizeMutate: 0.2,
	maxSize: 2,
	energyUse: 0.15,
	selection: 'truncation',
	crossover: 'blend',
	mutScale: true,
	mutGauss: false,
	mutReset: false,
	mutLifespan: false,
	breedInWorld: true,
	pickyMates: true,
	seekMates: true,
	refill: true,
	revive: true
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
	/** Steps since it last ate. */
	hunger: number;
	/** Fitness that came from eating other NEOS. */
	meat: number;
	/** Being chased right now (a hunter close by): getting away counts as fitness. */
	chased: boolean;
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
	/** Average size alive at the end. */
	size?: number;
}
export interface Totals {
	steps: number;
	born: number;
	died: number;
	food: number;
	extinctions: number;
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
	totals: Totals = { steps: 0, born: 0, died: 0, food: 0, extinctions: 0, bestEver: 0, lineage: 0, eaten: 0, escapes: 0 };
	hall: Genome[] = [];
	extinct = false;
	/** Walls stay put across new worlds (they can only be changed before a run starts). */
	walls: Wall[] = [];
	/** This generation so far: the NEOS that died (their fitness), births, food. */
	private cur = { deadFit: [] as number[], born: 0, died: 0, food: 0, eaten: 0 };
	private threshold = 0;
	/** Limited food: how many are eaten and waiting to regrow, and regrowth owed. */
	private waiting = 0;
	private regrow = 0;
	private foodGrid: number[][] = Array.from({ length: GRID * GRID }, () => []);
	private neoGrid: Neo[][] = Array.from({ length: GRID * GRID }, () => []);

	constructor(cfg: Config) {
		this.cfg = { ...cfg };
		this.reset();
	}

	reset() {
		this.neos = [];
		this.gen = 0;
		this.genStep = 0;
		this.history = [];
		this.totals = { steps: 0, born: 0, died: 0, food: 0, extinctions: 0, bestEver: 0, lineage: 0, eaten: 0, escapes: 0 };
		this.hall = [];
		this.extinct = false;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0, eaten: 0 };
		this.regrow = 0;
		this.setFood(this.cfg.foodNum, true);
		for (let i = 0; i < this.cfg.popSize; i++) this.neos.push(this.spawn());
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
		g?: { wih?: ArrayLike<number>; who?: ArrayLike<number>; nh?: number; life?: number; gen?: number; diet?: number; size?: number; sp?: number },
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
		return {
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
			size,
			sp: this.cfg.body ? (g?.sp ?? 1) : 1,
			energy: STORE_E * size * 0.6,
			foodD: Infinity,
			eaten: false,
			cool: 0,
			input: 0,
			danger: 0
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
		const push = scarce * Math.max(hunger * hunger, meaty);
		const r = Math.random();
		const step = c.omnivores ? 1 : 2;
		// Starving outright when food is short, a herbivore's baby can skip straight to carnivore now and then.
		if (d === 0 && c.omnivores && hunger >= 1 && scarce > 0.5 && r < c.predMutate * 0.25) return 2;
		if (d < 2 && r < c.predMutate * push) return d + step > 2 ? 2 : d + step;
		if (d > 0 && r > 1 - c.predMutate * (1 - hunger * scarce) * 0.3) return Math.max(0, d - step);
		return c.omnivores || d !== 1 ? d : 0;
	}

	/** A baby of a and b (b may be a itself), made the way the chosen algorithm makes them. */
	private child(a: Genome | Neo, b: Genome | Neo, x?: number, y?: number): Neo {
		const c = this.cfg;
		const gen = Math.max(a.gen, b.gen) + 1;
		let life = randInt(c.lifeMin, Math.max(c.lifeMin, c.lifeMax));
		// Lifespan inherited (± the mutation strength) instead of drawn fresh.
		if (c.mutLifespan) life = Math.round(Math.max(50, ((a.life + b.life) / 2) * rand(1 - c.mutStrength, 1 + c.mutStrength)));
		const diet = this.dietOf(a.fit >= b.fit ? a : b);
		const body = this.bodyOf(a.fit >= b.fit ? a : b);
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

	private remember(n: Neo) {
		if (n.fit <= 0) return;
		if (this.hall.length >= 12 && n.fit <= this.hall[this.hall.length - 1].fit) return;
		// The hall of fame restarts the world, so it keeps herbivores, and only those that weren't eaten.
		if (n.diet || n.eaten) return;
		this.hall.push({ wih: [...n.wih], who: [...n.who], nh: n.nh, life: n.life, gen: n.gen, fit: n.fit, size: n.size, sp: n.sp });
		this.hall.sort((p, q) => q.fit - p.fit);
		this.hall.length = Math.min(this.hall.length, 12);
	}

	private nearestFood(n: Neo): number {
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
						if (d < bd) {
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
				n.fit++;
				n.hunger = 0;
				n.energy = Math.min(STORE_E * n.size, n.energy + FOOD_E);
				this.cur.food++;
				this.totals.food++;
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
		if (c.seekMates && c.breedInWorld && c.algo !== 'es') {
			for (const n of neos) {
				if (n.age <= n.life * 0.75) continue;
				let best: Neo | null = null;
				let bd = Infinity;
				const cx = cellOf(n.x);
				const cy = cellOf(n.y);
				for (let gy = Math.max(0, cy - 3); gy <= Math.min(GRID - 1, cy + 3); gy++)
					for (let gx = Math.max(0, cx - 3); gx <= Math.min(GRID - 1, cx + 3); gx++)
						for (const o of this.neoGrid[gy * GRID + gx]) {
							if (o === n || !fit(o) || !this.compatible(n, o)) continue;
							const d = (o.x - n.x) ** 2 + (o.y - n.y) ** 2;
							if (d < bd) {
								bd = d;
								best = o;
							}
						}
				if (best) n.input = heading(n, best.x, best.y);
			}
		}

		// Two grown-up, fit NEOS that meet have a baby (an evolution strategy needs no mate: it buds).
		if (c.breedInWorld) {
			const born: Neo[] = [];
			for (const n of neos) {
				if (n.eaten || n.cool > 0 || n.age < c.mature || !fit(n)) continue;
				if (neos.length + born.length >= c.popCap) break;
				if (c.algo === 'es') {
					born.push(this.child(n, n, n.x, n.y));
					n.cool = c.cooldown;
					continue;
				}
				const cx = cellOf(n.x);
				const cy = cellOf(n.y);
				search: for (let gy = Math.max(0, cy - 1); gy <= Math.min(GRID - 1, cy + 1); gy++)
					for (let gx = Math.max(0, cx - 1); gx <= Math.min(GRID - 1, cx + 1); gx++)
						for (const o of this.neoGrid[gy * GRID + gx]) {
							if (o === n || o.eaten || o.cool > 0 || o.age < c.mature || !fit(o)) continue;
							const touch = (EAT_R * (n.size + o.size)) / 2;
							if ((o.x - n.x) ** 2 + (o.y - n.y) ** 2 > touch * touch || !this.compatible(n, o)) continue;
							born.push(this.child(n, o, n.x, n.y));
							n.cool = o.cool = c.cooldown;
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
				this.remember(n);
				continue;
			}
			let dv = 0;
			let dr = 0;
			for (let h = 0; h < n.nh; h++) {
				const a = Math.tanh(n.wih[h] * n.input + n.wih[MAX_H + h] * n.danger);
				dv += n.who[h] * a;
				dr += n.who[MAX_H + h] * a;
			}
			n.r = (n.r + Math.tanh(dr) * turn + 360) % 360;
			// Top speed: by diet, then (body evolution) the speed gene, and bigger is slower.
			const dietTop = n.diet === 2 ? c.vMax * c.predSpeed : n.diet === 1 ? (c.vMax * (1 + c.predSpeed)) / 2 : c.vMax;
			const top = c.body ? (dietTop * n.sp) / Math.sqrt(n.size) : dietTop;
			n.v = Math.min(top, Math.max(0, n.v + (Math.tanh(dv) * acc) / (c.body ? n.size : 1)));
			n.hunger++;
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

		// Elitism: the fittest NEOS alive top the population back up (the hall of fame only steps in
		// when almost no one is left: its old genes would otherwise keep pulling evolution back).
		if (c.refill && this.totals.steps % 10 === 0 && neos.length < c.popSize)
			this.refillFrom(neos.length >= 4 ? neos : [...neos, ...this.hall], c.popSize - neos.length);

		if (++this.genStep >= Math.round(c.genTime / DT)) this.endGeneration();

		if (!neos.length) {
			if (c.revive) {
				// Extinct: the hall of fame (or fresh NEOS) start over, and the world goes on.
				this.totals.extinctions++;
				this.refillFrom(this.hall, c.popSize);
			} else this.extinct = true;
		}
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
			}
			if (!prey) continue;
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
		this.cur.eaten++;
		this.totals.eaten++;
		for (const o of pack) {
			// Bigger prey is a bigger meal, shared by the pack; omnivores get half.
			const v = ((o.diet === 2 ? c.preyValue : Math.max(1, c.preyValue / 2)) * prey.size) / pack.length;
			o.fit += v;
			o.meat += v;
			o.hunger = 0;
			o.energy = Math.min(STORE_E * o.size, o.energy + FOOD_E * 2 * prey.size);
		}
	}

	/** Record this generation's stats. */
	private endGeneration() {
		const fits = [...this.cur.deadFit, ...this.neos.map((n) => n.fit)];
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
			eaten: this.cur.eaten
		});
		if (this.history.length > 500) this.history.shift();
		this.gen++;
		this.genStep = 0;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0, eaten: 0 };
	}

	private refillFrom(all: (Neo | Genome)[], n: number) {
		// Top-ups come from herbivores (meat-eaters only arise from hungry parents and spread by hunting).
		const prey = all.filter((p) => !p.diet);
		const pool = prey.length ? prey : all;
		const add: Neo[] = [];
		for (let i = 0; i < n; i++) {
			if (pool.length >= 2) {
				const [a, b] = this.pick(pool);
				add.push(this.child(a, b));
			} else if (pool.length === 1) add.push(this.child(pool[0], pool[0]));
			else add.push(this.spawn());
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
			hall: this.hall.map(genes),
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
		this.hall = s.hall ?? [];
		if (s.neos?.length) this.neos = s.neos.map((g) => ({ ...this.spawn(g), fit: g.fit }));
	}

	/** NEAT's species: NEOS grouped with the first representative they're compatible with. */
	private species() {
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
			foodLeft: this.foodLeft(),
			species: this.species(),
			progress: this.genStep / Math.round(this.cfg.genTime / DT),
			time: this.totals.steps * DT
		};
	}
}
