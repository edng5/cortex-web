// NEOS (Neuro Evolution Organism Simulator), in the browser: the same organisms as the original
// Python project (github.com/edng5/neos), one continuous world instead of separate generation runs,
// and a choice of how they evolve: NEAT (networks grow new hidden nodes, and only similar NEOS can
// mate), the original NEOS genetic algorithm (fixed networks), an evolution strategy (babies are
// mutated clones), differential evolution, or random search (a baseline that doesn't learn).
//
// Each NEOS has a tiny neural net (1 input → hidden nodes, tanh → 2 outputs): the input is the heading
// to the nearest food (or, late in life, to the nearest fit mate), the outputs turn it and speed it
// up or slow it down. Eating food is fitness. Two fit, grown-up NEOS that meet have a baby; NEOS
// die of old age, and whenever the population drops below its size the fittest's babies top it
// back up (elitism). Generations never stop the world: every "generation length" the stats are
// recorded while everyone keeps swimming.

export const WORLD = 2; // the world is [-2, 2] × [-2, 2], like the original
const EAT_R = 0.075;
export const DT = 0.04;
/** Most hidden nodes a network can have (NEAT grows toward this). */
export const MAX_H = 8;
const CELL = 0.25;
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
	deCR: [0, 1, 0.05]
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
	color: string;
	/** Weights, sized for MAX_H hidden nodes: input→hidden, then hidden→speed and hidden→turn. */
	wih: Float32Array;
	who: Float32Array;
	/** Hidden nodes in use. */
	nh: number;
	cool: number;
	input: number;
}
export interface Genome {
	wih: ArrayLike<number>;
	who: ArrayLike<number>;
	nh: number;
	life: number;
	gen: number;
	fit: number;
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
}
export interface Totals {
	steps: number;
	born: number;
	died: number;
	food: number;
	extinctions: number;
	bestEver: number;
	lineage: number;
}

// The original's colours by generation (lineage), and the rare albino.
const COLORS = ['#90ee90', '#2e8b57', '#006400', '#556b2f', '#cd853f', '#f08080', '#ff4500', '#b22222', '#8b0000', '#000000'];
const pickColor = (gen: number) => (Math.random() < 0.001 ? '#f5fffa' : COLORS[gen < COLORS.length ? gen : Math.floor(Math.random() * COLORS.length)]);
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
	totals: Totals = { steps: 0, born: 0, died: 0, food: 0, extinctions: 0, bestEver: 0, lineage: 0 };
	hall: Genome[] = [];
	extinct = false;
	/** This generation so far: the NEOS that died (their fitness), births, food. */
	private cur = { deadFit: [] as number[], born: 0, died: 0, food: 0 };
	private threshold = 0;
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
		this.totals = { steps: 0, born: 0, died: 0, food: 0, extinctions: 0, bestEver: 0, lineage: 0 };
		this.hall = [];
		this.extinct = false;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0 };
		this.setFood(this.cfg.foodNum, true);
		for (let i = 0; i < this.cfg.popSize; i++) this.neos.push(this.spawn());
	}

	/** Change settings on the fly (food appears or goes; the rest applies from now on). */
	configure(cfg: Config) {
		if (cfg.foodNum !== this.cfg.foodNum) this.setFood(cfg.foodNum, false);
		// The original GA's networks are all one size: switching to it (or resizing) reshapes them.
		if (cfg.algo === 'ga' && (this.cfg.algo !== 'ga' || cfg.hidden !== this.cfg.hidden)) for (const n of this.neos) n.nh = cfg.hidden;
		this.cfg = { ...cfg, lifeMax: Math.max(cfg.lifeMin, cfg.lifeMax) };
	}

	private setFood(n: number, fresh: boolean) {
		const fx = new Float32Array(n);
		const fy = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const keep = !fresh && i < this.fx.length;
			fx[i] = keep ? this.fx[i] : rand(-WORLD, WORLD);
			fy[i] = keep ? this.fy[i] : rand(-WORLD, WORLD);
		}
		this.fx = fx;
		this.fy = fy;
	}

	/** Hidden nodes a brand-new NEOS starts with. */
	private startH() {
		return this.cfg.algo === 'neat' ? 1 : this.cfg.hidden;
	}

	/** A NEOS with these genes (or fresh random ones). */
	private spawn(g?: { wih?: ArrayLike<number>; who?: ArrayLike<number>; nh?: number; life?: number; gen?: number }, x?: number, y?: number): Neo {
		const gen = g?.gen ?? 0;
		const wih = new Float32Array(MAX_H);
		const who = new Float32Array(2 * MAX_H);
		const gi = g?.wih;
		const go = g?.who;
		const half = go ? go.length / 2 : 0;
		for (let h = 0; h < MAX_H; h++) {
			wih[h] = gi && h < gi.length ? gi[h] : rand(-1, 1);
			who[h] = go && h < half ? go[h] : rand(-1, 1);
			who[MAX_H + h] = go && h < half ? go[half + h] : rand(-1, 1);
		}
		return {
			x: x ?? rand(-WORLD, WORLD),
			y: y ?? rand(-WORLD, WORLD),
			r: rand(0, 360),
			v: rand(0, this.cfg.vMax),
			fit: 0,
			age: 0,
			life: g?.life ?? randInt(this.cfg.lifeMin, Math.max(this.cfg.lifeMin, this.cfg.lifeMax)),
			gen,
			color: gen === 0 ? COLORS[0] : pickColor(gen),
			wih,
			who,
			nh: Math.max(1, Math.min(MAX_H, g?.nh ?? this.startH())),
			cool: 0,
			input: 0
		};
	}

	/** How different two NEOS are (NEAT's compatibility distance): extra nodes, plus weight differences. */
	private distance(a: Neo | Genome, b: Neo | Genome) {
		const h = Math.min(a.nh, b.nh);
		let d = 0;
		for (let i = 0; i < h; i++) d += Math.abs(a.wih[i] - b.wih[i]) + Math.abs(a.who[i] - b.who[i]) + Math.abs(a.who[MAX_H + i] - b.who[MAX_H + i]);
		return Math.abs(a.nh - b.nh) + d / (3 * h);
	}
	/** NEOS a and b may mate (NEAT: same species only). */
	private compatible(a: Neo, b: Neo) {
		return this.cfg.algo !== 'neat' || this.distance(a, b) <= this.cfg.compat;
	}

	/** A baby of a and b (b may be a itself), made the way the chosen algorithm makes them. */
	private child(a: Genome | Neo, b: Genome | Neo, x?: number, y?: number): Neo {
		const c = this.cfg;
		const gen = Math.max(a.gen, b.gen) + 1;
		let life = randInt(c.lifeMin, Math.max(c.lifeMin, c.lifeMax));
		// Lifespan inherited (± the mutation strength) instead of drawn fresh.
		if (c.mutLifespan) life = Math.round(Math.max(50, ((a.life + b.life) / 2) * rand(1 - c.mutStrength, 1 + c.mutStrength)));
		if (c.algo === 'random') return this.spawn({ life, gen }, x, y);

		// The genes as one list: input weights, then the speed row, then the turn row.
		const G = MAX_H * 3;
		const get = (p: Genome | Neo, i: number) => (i < MAX_H ? p.wih[i] : p.who[i - MAX_H]);
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
			const used = () => nodeOf(randInt(0, nh - 1)) + MAX_H * randInt(0, 2);
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
				g[MAX_H + nh] = rand(-0.3, 0.3);
				g[2 * MAX_H + nh] = rand(-0.3, 0.3);
				nh++;
			}
		}
		return this.spawn({ wih: g.subarray(0, MAX_H), who: g.subarray(MAX_H), nh, life, gen }, x, y);
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
		this.hall.push({ wih: [...n.wih], who: [...n.who], nh: n.nh, life: n.life, gen: n.gen, fit: n.fit });
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
		for (let i = 0; i < this.fx.length; i++) this.foodGrid[cellOf(this.fy[i]) * GRID + cellOf(this.fx[i])].push(i);
		for (const n of neos) {
			let f = this.nearestFood(n);
			if (f < 0) continue;
			const dx = this.fx[f] - n.x;
			const dy = this.fy[f] - n.y;
			if (dx * dx + dy * dy <= EAT_R * EAT_R) {
				n.fit++;
				this.cur.food++;
				this.totals.food++;
				const old = this.foodGrid[cellOf(this.fy[f]) * GRID + cellOf(this.fx[f])];
				old.splice(old.indexOf(f), 1);
				this.fx[f] = rand(-WORLD, WORLD);
				this.fy[f] = rand(-WORLD, WORLD);
				this.foodGrid[cellOf(this.fy[f]) * GRID + cellOf(this.fx[f])].push(f);
				f = this.nearestFood(n);
			}
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
				if (n.cool > 0 || n.age < c.mature || !fit(n)) continue;
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
							if (o === n || o.cool > 0 || o.age < c.mature || !fit(o)) continue;
							if ((o.x - n.x) ** 2 + (o.y - n.y) ** 2 > EAT_R * EAT_R || !this.compatible(n, o)) continue;
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
			if (n.age >= n.life) {
				this.cur.deadFit.push(n.fit);
				this.cur.died++;
				this.totals.died++;
				this.remember(n);
				continue;
			}
			let dv = 0;
			let dr = 0;
			for (let h = 0; h < n.nh; h++) {
				const a = Math.tanh(n.wih[h] * n.input);
				dv += n.who[h] * a;
				dr += n.who[MAX_H + h] * a;
			}
			n.r = (n.r + Math.tanh(dr) * turn + 360) % 360;
			n.v = Math.min(c.vMax, Math.max(0, n.v + Math.tanh(dv) * acc));
			const rad = (n.r * Math.PI) / 180;
			n.x = Math.min(WORLD, Math.max(-WORLD, n.x + n.v * Math.cos(rad) * DT));
			n.y = Math.min(WORLD, Math.max(-WORLD, n.y + n.v * Math.sin(rad) * DT));
			n.age++;
			if (n.cool > 0) n.cool--;
			if (n.fit > this.totals.bestEver) this.totals.bestEver = n.fit;
			if (n.gen > this.totals.lineage) this.totals.lineage = n.gen;
			neos[w++] = n;
		}
		neos.length = w;
		this.totals.steps++;

		// Elitism: the fittest (alive, or in the hall of fame) top the population back up.
		if (c.refill && this.totals.steps % 10 === 0 && neos.length < c.popSize) this.refillFrom([...neos, ...this.hall], c.popSize - neos.length);

		if (++this.genStep >= Math.round(c.genTime / DT)) this.endGeneration();

		if (!neos.length) {
			if (c.revive) {
				// Extinct: the hall of fame (or fresh NEOS) start over, and the world goes on.
				this.totals.extinctions++;
				this.refillFrom(this.hall, c.popSize);
			} else this.extinct = true;
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
			lineage: this.neos.reduce((m, n) => Math.max(m, n.gen), 0)
		});
		if (this.history.length > 500) this.history.shift();
		this.gen++;
		this.genStep = 0;
		this.cur = { deadFit: [], born: 0, died: 0, food: 0 };
	}

	private refillFrom(pool: (Neo | Genome)[], n: number) {
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
			life: n.life,
			gen: n.gen,
			fit: n.fit
		});
		return { cfg: this.cfg, gen: this.gen, history: this.history, totals: this.totals, hall: this.hall.map(genes), neos: this.neos.map(genes) };
	}
	restore(s: ReturnType<Sim['snapshot']>) {
		this.cfg = { ...DEFAULTS, ...s.cfg };
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
		for (const o of this.neos) {
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
			species: this.species(),
			progress: this.genStep / Math.round(this.cfg.genTime / DT),
			time: this.totals.steps * DT
		};
	}
}
