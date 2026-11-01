<!--
  The NEOS simulator: one continuous world of little neural-net organisms that eat, breed and
  evolve (see $lib/neos/sim). A run starts only when Play is pressed; before that, walls can be
  drawn on the world (and only then). Drawn on a canvas at up to 30 frames a second, only while
  it's on screen and changing. Settings, the genetic algorithm's parts, predators, live stats, and
  up to 3 named saved runs (settings, walls, stats and the NEOS's genes) kept in this browser.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import NeosDetails from './NeosDetails.svelte';
	import { portal } from '$lib/actions/portal';
	import { ALGOS, DEFAULTS, DT, MAX_WALLS, SHADES, colorOf, type Neo, RANGES, Sim, WALL_T, WORLD, wallDist2, type Algo, type Config, type Crossover, type Selection } from '$lib/neos/sim';

	let { compact = false }: { compact?: boolean } = $props();

	const SAVES_KEY = 'neos-sim-saves';
	/** Before named saves there was one, under this key (moved into the list on first visit). */
	const OLD_KEY = 'neos-sim-save';
	const MAX_SAVES = 3;
	type SaveSlot = { id: string; name: string; at: number; gen: number; data: string };
	const sim = new Sim(DEFAULTS);
	let cfg = $state<Config>({ ...DEFAULTS });
	/** ready: not started (walls can be drawn) · running · paused · stopped (the run is over). */
	let phase = $state<'ready' | 'running' | 'paused' | 'stopped'>('ready');
	let wallCount = $state(0);
	/** Redraw the world on the next frame (it's only redrawn every frame while running). */
	let dirty = true;
	let speed = $state(2);
	let tab = $state<'settings' | 'algo' | 'stats'>('stats');
	let live = $state(sim.live());
	let totals = $state({ ...sim.totals });
	let history = $state([...sim.history]);
	let extinct = $state(false);
	let saves = $state<SaveSlot[]>([]);
	/** The saves pop-up: naming a new save (and, when full, picking one to delete), or loading. */
	let savesOpen = $state<null | 'save' | 'load'>(null);
	let saveName = $state('');
	/** The draggable details window (species, diets, sizes). */
	let detailsOpen = $state(false);
	let note = $state('');

	let canvas: HTMLCanvasElement;
	let chart = $state<HTMLCanvasElement>();
	let chartBox = $state<HTMLDivElement>();
	/** Each generation gets at least this much of the chart; past the box's width it scrolls sideways. */
	const GEN_PX = 10;
	let root: HTMLElement;

	// Settings apply as they change.
	$effect(() => {
		sim.configure($state.snapshot(cfg) as Config);
		dirty = true;
	});

	const SLIDERS: { key: keyof Config; label: string; fmt?: (v: number) => string; tip: string; only?: Algo[]; preds?: boolean; limit?: boolean; body?: boolean }[] = [
		{ key: 'popSize', label: 'Population size', tip: 'NEOS at the start; with elitism refill on, the fittest’s babies keep it from dropping below this.' },
		{ key: 'popCap', label: 'Population cap', tip: 'No more babies once there are this many (the original stopped at 150).' },
		{ key: 'foodNum', label: 'Food', tip: 'Most food in the world; each one eaten reappears somewhere else (at once, or at the regrowth rate when limited).' },
		{ key: 'foodRegrow', label: 'Food regrowth', fmt: (v) => `${v}/s`, tip: 'How many eaten food particles come back each second. Scarce food is what pushes NEOS to eat each other.', limit: true },
		{ key: 'elitism', label: 'Elitism', fmt: (v) => `top ${Math.round(v * 100)}%`, tip: 'Only NEOS this fit may breed, and truncation selection picks parents from them.' },
		{ key: 'hidden', label: 'Hidden nodes', tip: 'Size of every NEOS’s network (NEAT starts at 1 and grows its own).', only: ['ga', 'es', 'de', 'random'] },
		{ key: 'addNode', label: 'Add-node chance', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'NEAT: chance a baby grows a new hidden node.', only: ['neat'] },
		{ key: 'compat', label: 'Species threshold', fmt: (v) => v.toFixed(1), tip: 'NEAT: how different two NEOS may be and still mate. Lower = more, smaller species.', only: ['neat'] },
		{ key: 'deF', label: 'Differential weight F', fmt: (v) => v.toFixed(2), tip: 'Differential evolution: how far along B − C a baby moves.', only: ['de'] },
		{ key: 'deCR', label: 'Crossover rate CR', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Differential evolution: chance each gene takes the new value.', only: ['de'] },
		{ key: 'mutate', label: 'Mutation rate', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Chance a baby is mutated.', only: ['neat', 'ga'] },
		{ key: 'mutStrength', label: 'Mutation strength', fmt: (v) => v.toFixed(2), tip: 'How big a mutation is (an evolution strategy’s noise).', only: ['neat', 'ga', 'es'] },
		{ key: 'mature', label: 'Maturity age', fmt: (v) => `${v} steps`, tip: 'NEOS younger than this can’t breed.' },
		{ key: 'lifeMin', label: 'Lifespan (min)', fmt: (v) => `${v} steps`, tip: 'Each NEOS lives a random number of steps between the min and max.' },
		{ key: 'lifeMax', label: 'Lifespan (max)', fmt: (v) => `${v} steps`, tip: 'Each NEOS lives a random number of steps between the min and max.' },
		{ key: 'cooldown', label: 'Breeding cooldown', fmt: (v) => `${v} steps`, tip: 'Rest between babies.' },
		{ key: 'vMax', label: 'Max speed', fmt: (v) => v.toFixed(2), tip: 'World units a second.' },
		{ key: 'dvMax', label: 'Max acceleration', fmt: (v) => v.toFixed(2), tip: 'How fast a NEOS can speed up or slow down.' },
		{ key: 'drMax', label: 'Max turn rate', fmt: (v) => `${v}°/s`, tip: 'How fast a NEOS can turn.' },
		{ key: 'genTime', label: 'Generation length', fmt: (v) => `${v} s`, tip: 'How often a generation’s stats are recorded. The world never stops.' },
		{ key: 'predMutate', label: 'Diet mutation (when starving)', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Chance a starving parent’s baby eats more meat. Well-fed parents’ babies almost never change.', preds: true },
		{ key: 'preyValue', label: 'Prey value', fmt: (v) => `${v} food`, tip: 'Fitness a carnivore gets for each NEOS it eats (omnivores get half).', preds: true },
		{ key: 'predSpeed', label: 'Carnivore speed', fmt: (v) => `×${v.toFixed(2)}`, tip: 'Carnivores’ top speed compared with herbivores (omnivores are in between).', preds: true },
		{ key: 'senseR', label: 'Danger sense range', fmt: (v) => v.toFixed(1), tip: 'How far away a NEOS senses something that could eat it (hunters see prey twice as far).', preds: true },
		{ key: 'sizeMutate', label: 'Body mutation', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Chance a baby’s size, and separately its speed, change a little.', body: true },
		{ key: 'maxSize', label: 'Size limit', fmt: (v) => `×${v.toFixed(1)}`, tip: 'The biggest a NEOS can grow (×1 is the original size).', body: true },
		{ key: 'energyUse', label: 'Energy use', fmt: (v) => v.toFixed(2), tip: 'Energy burned a step, × size² and how fast it’s going. Food refills it; empty is death.', body: true },
		{ key: 'starve', label: 'Starvation', fmt: (v) => `${v} steps`, tip: 'Omnivores and carnivores die if they go this long without eating; hunger is also what makes babies meatier.', preds: true }
	];
	const SELECTIONS: [Selection, string, string][] = [
		['truncation', 'Truncation', 'Parents are random picks from the top elitism % (the original).'],
		['tournament', 'Tournament', 'The fittest of 3 random NEOS, twice.'],
		['roulette', 'Roulette', 'Chance to be picked grows with fitness.']
	];
	const CROSSOVERS: [Crossover, string, string][] = [
		['blend', 'Blend', 'A random weighted average of both parents’ weights (the original).'],
		['uniform', 'Uniform', 'Each weight from one parent or the other, 50/50.'],
		['onepoint', 'One-point', 'The first part of the genes from one parent, the rest from the other.'],
		['none', 'None (clone)', 'Babies copy the first parent.']
	];
	const SWITCHES: { key: keyof Config; label: string; tip: string; group: 'mut' | 'life' }[] = [
		{ key: 'mutScale', label: 'Scale a weight (×0.9–1.1)', tip: 'The original mutation.', group: 'mut' },
		{ key: 'mutGauss', label: 'Gaussian noise on all weights', tip: 'Small random nudges everywhere.', group: 'mut' },
		{ key: 'mutReset', label: 'Reset a random weight', tip: 'One weight starts over.', group: 'mut' },
		{ key: 'mutLifespan', label: 'Inherit lifespan', tip: 'Babies get their parents’ average lifespan (± strength) instead of a random one.', group: 'mut' },
		{ key: 'breedInWorld', label: 'Breed when they meet', tip: 'Two fit, grown-up NEOS that touch have a baby.', group: 'life' },
		{ key: 'pickyMates', label: 'Only fit NEOS breed', tip: 'Mates must be in the top elitism %.', group: 'life' },
		{ key: 'seekMates', label: 'Seek mates in old age', tip: 'Past 75% of their life, NEOS swim toward fit mates instead of food.', group: 'life' },
		{ key: 'refill', label: 'Elitism refill', tip: 'Whenever the population drops below its size, the fittest NEOS’ babies top it back up.', group: 'life' },
		{ key: 'revive', label: 'Revive after extinction', tip: 'If everyone dies, the hall of fame’s genes start again.', group: 'life' }
	];

	/** A fresh world, waiting for Play (walls can be drawn again). */
	function reset() {
		sim.reset();
		sim.settleWalls();
		phase = 'ready';
		note = '';
		dirty = true;
		sync();
	}
	function play() {
		if (phase === 'stopped') return;
		phase = 'running';
		note = '';
	}
	function stop() {
		phase = 'stopped';
		dirty = true;
		sync();
	}
	function readSaves(): SaveSlot[] {
		try {
			const list = JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]') as SaveSlot[];
			const old = localStorage.getItem(OLD_KEY);
			if (old) {
				const o = JSON.parse(old);
				list.unshift({ id: String(o.at), name: 'My run', at: o.at, gen: o.gen ?? 0, data: old });
				localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(0, MAX_SAVES)));
				localStorage.removeItem(OLD_KEY);
			}
			return list.slice(0, MAX_SAVES);
		} catch {
			return [];
		}
	}
	function writeSaves(list: SaveSlot[]) {
		try {
			localStorage.setItem(SAVES_KEY, JSON.stringify(list));
			saves = list;
			return true;
		} catch {
			note = 'Couldn’t save in this browser (storage is full or blocked).';
			return false;
		}
	}
	function openSave() {
		if (phase === 'running') phase = 'paused';
		saveName = `Run ${saves.length + 1}`;
		savesOpen = 'save';
	}
	function save() {
		if (saves.length >= MAX_SAVES) return;
		const at = Date.now();
		const name = saveName.trim().slice(0, 40) || `Run ${saves.length + 1}`;
		const slot: SaveSlot = { id: `${at}`, name, at, gen: sim.gen, data: JSON.stringify({ at, speed, ...sim.snapshot() }) };
		if (writeSaves([slot, ...saves])) {
			note = `Saved “${name}”: settings, walls, stats and every NEOS’s genes.`;
			savesOpen = null;
		}
	}
	function remove(id: string) {
		writeSaves(saves.filter((s) => s.id !== id));
	}
	function load(slot: SaveSlot) {
		try {
			const s = JSON.parse(slot.data);
			savesOpen = null;
			sim.restore(s);
			cfg = { ...sim.cfg };
			speed = s.speed ?? speed;
			// A loaded run carries on (paused) from where it was saved.
			phase = sim.totals.steps ? 'paused' : 'ready';
			wallCount = sim.walls.length;
			dirty = true;
			note = `Loaded “${slot.name}”. Press ▶ to carry on.`;
			sync();
		} catch {
			note = 'That save couldn’t be read.';
		}
	}
	function defaults() {
		cfg = { ...DEFAULTS };
		note = 'Settings back to the original’s.';
	}
	function sync() {
		live = sim.live();
		totals = { ...sim.totals };
		extinct = sim.extinct;
		if (history.length !== sim.history.length || history.at(-1) !== sim.history.at(-1)) history = [...sim.history];
	}

	// ── Walls (only before a run starts) ──
	const PAD = WORLD * 0.25;
	/** Where on the world a pointer is. */
	function worldAt(e: PointerEvent): [number, number] {
		const r = canvas.getBoundingClientRect();
		const span = WORLD * 2 + PAD * 2;
		const x = ((e.clientX - r.left) / r.width) * span - WORLD - PAD;
		const y = WORLD + PAD - ((e.clientY - r.top) / r.height) * span;
		return [Math.max(-WORLD, Math.min(WORLD, x)), Math.max(-WORLD, Math.min(WORLD, y))];
	}
	let drawing = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
	function wallDown(e: PointerEvent) {
		if (phase !== 'ready') return;
		const [x, y] = worldAt(e);
		// Tapping a wall removes it.
		const hit = sim.walls.findIndex((w) => wallDist2(w, x, y) < (WALL_T * 2.5) ** 2);
		if (hit >= 0) {
			sim.walls.splice(hit, 1);
			wallCount = sim.walls.length;
			dirty = true;
			return;
		}
		if (sim.walls.length >= MAX_WALLS) {
			note = `That's the most walls (${MAX_WALLS}).`;
			return;
		}
		canvas.setPointerCapture(e.pointerId);
		drawing = { x1: x, y1: y, x2: x, y2: y };
	}
	function wallMove(e: PointerEvent) {
		if (!drawing) return hoverAt(e);
		[drawing.x2, drawing.y2] = worldAt(e);
		dirty = true;
	}

	// ── Hovering (or tapping) a NEOS: what species it is ──
	/** The pointer over the world (css px in the view, and world units), or null when it's off. */
	let pointer: { px: number; py: number; wx: number; wy: number } | null = null;
	// (Not reactive state: that would wrap the NEOS in a proxy, and it must stay the simulator's own object.)
	let hovered: Neo | null = null;
	let hoverInfo = $state<{ px: number; py: number; flip: boolean; species: string; lines: string[]; diet: number; albino: boolean } | null>(null);
	function hoverAt(e: PointerEvent) {
		const r = canvas.getBoundingClientRect();
		const [wx, wy] = worldAt(e);
		pointer = { px: e.clientX - r.left, py: e.clientY - r.top, wx, wy };
		pickHover();
	}
	function hoverOff() {
		pointer = null;
		if (hovered) dirty = true;
		hovered = null;
		hoverInfo = null;
	}
	/** The NEOS under the pointer (the nearest within a little more than its body). */
	function pickHover() {
		if (!pointer) return;
		let best: Neo | null = null;
		let bd = Infinity;
		for (const n of sim.neos) {
			const d = (n.x - pointer.wx) ** 2 + (n.y - pointer.wy) ** 2;
			const reach = 0.05 * n.size + 0.05;
			if (d < bd && d <= reach * reach) {
				bd = d;
				best = n;
			}
		}
		if (best !== hovered) dirty = true;
		hovered = best;
		describe();
	}
	/** The label for the hovered NEOS, next to it (refreshed as it swims). */
	function describe() {
		const n = hovered;
		if (!n || !sim.neos.includes(n)) {
			hovered = null;
			hoverInfo = null;
			return;
		}
		const r = canvas.getBoundingClientRect();
		const span = WORLD * 2 + PAD * 2;
		const px = ((n.x + WORLD + PAD) / span) * r.width;
		const py = ((WORLD + PAD - n.y) / span) * r.height;
		const albino = colorOf(n) === '#f5fffa';
		const sp = sim.species.get(n.spc);
		hoverInfo = {
			px,
			py,
			flip: px > r.width * 0.6,
			species: `${albino ? 'Albino ' : ''}${sp?.name ?? 'Unknown species'}`,
			diet: n.diet,
			albino,
			lines: [
				`${['Herbivore', 'Omnivore', 'Carnivore'][n.diet]}${sim.cfg.body ? ` · size ×${n.size.toFixed(2)} · speed ×${n.sp.toFixed(2)}` : ''}`,
				`Generation ${n.gen} · ${n.nh} hidden node${n.nh === 1 ? '' : 's'}`,
				`Fitness ${num(n.fit)} · age ${Math.round(n.age * DT)}s of ${Math.round(n.life * DT)}s`
			]
		};
	}
	function wallUp() {
		if (!drawing) return;
		// Too short to be a wall: ignore it.
		if (Math.hypot(drawing.x2 - drawing.x1, drawing.y2 - drawing.y1) > 0.1) {
			sim.walls.push({ ...drawing });
			sim.settleWalls();
			wallCount = sim.walls.length;
		}
		drawing = null;
		dirty = true;
	}
	function clearWalls() {
		sim.walls = [];
		wallCount = 0;
		dirty = true;
	}

	// ── Drawing ──
	let ctx: CanvasRenderingContext2D | null = null;
	let size = 0;
	function fit() {
		const w = canvas.clientWidth;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		size = Math.round(w * dpr);
		if (canvas.width !== size) canvas.width = canvas.height = size;
	}
	function draw() {
		if (!ctx || !size) return;
		const pad = WORLD * 0.25;
		const k = size / (WORLD * 2 + pad * 2);
		const sx = (x: number) => (x + WORLD + pad) * k;
		const sy = (y: number) => (WORLD + pad - y) * k;
		ctx.fillStyle = '#cfe0f2';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = 'rgba(30, 58, 95, 0.25)';
		ctx.lineWidth = 1;
		ctx.strokeRect(sx(-WORLD), sy(WORLD), WORLD * 2 * k, WORLD * 2 * k);

		// Walls (and the one being drawn).
		const walls = drawing ? [...sim.walls, drawing] : sim.walls;
		if (walls.length) {
			ctx.beginPath();
			for (const w of walls) {
				ctx.moveTo(sx(w.x1), sy(w.y1));
				ctx.lineTo(sx(w.x2), sy(w.y2));
			}
			ctx.lineCap = 'round';
			ctx.lineWidth = WALL_T * 2 * k;
			ctx.strokeStyle = '#334155';
			ctx.stroke();
			ctx.lineCap = 'butt';
		}

		// Food: one path for all of it.
		const fr = Math.max(1.5, 0.03 * k);
		ctx.beginPath();
		for (let i = 0; i < sim.fx.length; i++) {
			if (Number.isNaN(sim.fx[i])) continue; // eaten, not regrown yet
			const x = sx(sim.fx[i]);
			const y = sy(sim.fy[i]);
			ctx.moveTo(x + fr, y);
			ctx.arc(x, y, fr, 0, Math.PI * 2);
		}
		ctx.fillStyle = '#7b68ee';
		ctx.fill();
		ctx.strokeStyle = '#483d8b';
		ctx.lineWidth = 1;
		ctx.stroke();

		// NEOS: one fill per colour, then every outline and tail in one stroke.
		const r = Math.max(2.5, 0.05 * k);
		const byColor = new Map<string, number[]>();
		sim.neos.forEach((n, i) => {
			const col = colorOf(n);
			const l = byColor.get(col);
			if (l) l.push(i);
			else byColor.set(col, [i]);
		});
		for (const [color, ids] of byColor) {
			ctx.beginPath();
			for (const i of ids) {
				const n = sim.neos[i];
				const x = sx(n.x);
				const y = sy(n.y);
				ctx.moveTo(x + r * n.size, y);
				ctx.arc(x, y, r * n.size, 0, Math.PI * 2);
			}
			ctx.fillStyle = color;
			ctx.fill();
		}
		ctx.beginPath();
		const tail = 0.075 * k;
		for (const n of sim.neos) {
			const x = sx(n.x);
			const y = sy(n.y);
			ctx.moveTo(x + r * n.size, y);
			ctx.arc(x, y, r * n.size, 0, Math.PI * 2);
			const a = (n.r * Math.PI) / 180;
			ctx.moveTo(x, y);
			ctx.lineTo(x + Math.cos(a) * tail * n.size, y - Math.sin(a) * tail * n.size);
		}
		ctx.strokeStyle = '#006400';
		ctx.lineWidth = Math.max(1, k * 0.008);
		ctx.stroke();

		// Meat-eaters: a ring and fangs, red for carnivores and blue for omnivores.
		let preds = 0;
		let omnis = 0;
		for (const [diet, col] of [
			[2, '#b91c1c'],
			[1, '#1d4ed8']
		] as const) {
			ctx.beginPath();
			for (const n of sim.neos) {
				if (n.diet !== diet) continue;
				if (diet === 2) preds++;
				else omnis++;
				const x = sx(n.x);
				const y = sy(n.y);
				const rr = r * n.size;
				ctx.moveTo(x + rr * 1.5, y);
				ctx.arc(x, y, rr * 1.5, 0, Math.PI * 2);
				const a = (n.r * Math.PI) / 180;
				for (const s of [-0.45, 0.45]) {
					ctx.moveTo(x + Math.cos(a + s) * rr * 1.5, y - Math.sin(a + s) * rr * 1.5);
					ctx.lineTo(x + Math.cos(a + s * 0.3) * rr * (diet === 2 ? 2.6 : 2.1), y - Math.sin(a + s * 0.3) * rr * (diet === 2 ? 2.6 : 2.1));
				}
			}
			ctx.strokeStyle = col;
			ctx.lineWidth = Math.max(1.5, k * 0.012);
			ctx.stroke();
		}

		// The hovered NEOS: a ring so it's clear which one the label is about.
		if (hovered && sim.neos.includes(hovered)) {
			ctx.beginPath();
			ctx.arc(sx(hovered.x), sy(hovered.y), r * hovered.size * 2.2, 0, Math.PI * 2);
			ctx.strokeStyle = '#0f172a';
			ctx.lineWidth = Math.max(1.5, k * 0.01);
			ctx.setLineDash([4, 3]);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		ctx.fillStyle = '#1e3a5f';
		ctx.font = `600 ${Math.round(size * 0.032)}px system-ui, sans-serif`;
		ctx.textBaseline = 'top';
		ctx.fillText(`GENERATION: ${sim.gen}`, size * 0.03, size * 0.025);
		ctx.textAlign = 'right';
		ctx.fillText(`${sim.neos.length} NEOS${omnis ? ` · ${omnis} omni` : ''}${preds ? ` · ${preds} carni` : ''}`, size * 0.97, size * 0.025);
		ctx.textAlign = 'left';
		// This generation's progress along the bottom.
		ctx.fillStyle = 'rgba(30, 58, 95, 0.35)';
		ctx.fillRect(0, size - 4, size * (sim.genStep / Math.round(sim.cfg.genTime / DT)), 4);
	}

	/** Best and average fitness, and the population, per generation. */
	function drawChart() {
		if (!chart) return;
		const c = chart.getContext('2d');
		if (!c) return;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		const pts = history;
		// Wider than its box once there are many generations; stay at the newest end if already there.
		const box = chartBox;
		const atEnd = !box || box.scrollLeft + box.clientWidth >= box.scrollWidth - 4;
		const cssW = Math.max(box?.clientWidth ?? 0, pts.length * GEN_PX);
		chart.style.width = `${cssW}px`;
		const w = Math.round(cssW * dpr);
		const h = Math.round(chart.clientHeight * dpr);
		chart.width = w;
		chart.height = h;
		c.clearRect(0, 0, w, h);
		if (box && atEnd) box.scrollLeft = box.scrollWidth;
		if (pts.length < 2) {
			c.fillStyle = 'rgba(148, 163, 184, 0.8)';
			c.font = `${12 * dpr}px system-ui, sans-serif`;
			c.fillText('The chart fills in as generations finish.', 8 * dpr, h / 2);
			return;
		}
		const maxFit = Math.max(1, ...pts.map((p) => p.best));
		const maxPop = Math.max(1, ...pts.map((p) => p.alive));
		const x = (i: number) => (i / (pts.length - 1)) * (w - 4) + 2;
		const line = (vals: number[], max: number, color: string, fill = false) => {
			c.beginPath();
			vals.forEach((v, i) => (i ? c.lineTo(x(i), h - 4 - (v / max) * (h - 12)) : c.moveTo(x(i), h - 4 - (v / max) * (h - 12))));
			if (fill) {
				c.lineTo(x(vals.length - 1), h);
				c.lineTo(x(0), h);
				c.fillStyle = color;
				c.fill();
			} else {
				c.strokeStyle = color;
				c.lineWidth = 2 * dpr;
				c.stroke();
			}
		};
		line(pts.map((p) => p.alive), maxPop, 'rgba(148, 163, 184, 0.15)', true);
		line(pts.map((p) => p.avg), maxFit, '#38bdf8');
		line(pts.map((p) => p.best), maxFit, '#4ade80');
		if (pts.some((p) => p.omnis)) line(pts.map((p) => p.omnis ?? 0), maxPop, '#818cf8');
		if (pts.some((p) => p.preds)) line(pts.map((p) => p.preds ?? 0), maxPop, '#f87171');
	}
	$effect(() => {
		void history;
		void tab;
		drawChart();
	});

	onMount(() => {
		ctx = canvas.getContext('2d', { alpha: false });
		saves = readSaves();
		fit();
		sim.settleWalls();
		const ro = new ResizeObserver(() => (fit(), draw()));
		ro.observe(canvas);
		// Only run while it can be seen.
		let visible = true;
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
		io.observe(root);
		let raf = 0;
		let last = 0;
		let lastSync = 0;
		const frame = (t: number) => {
			raf = requestAnimationFrame(frame);
			if (!visible || t - last < 33) return; // ~30 fps is plenty
			last = t;
			const running = phase === 'running' && !sim.extinct;
			if (running) for (let i = 0; i < speed; i++) sim.step();
			// Not running: only redraw when something changed.
			if (running || dirty) {
				draw();
				dirty = false;
			}
			if (running && pointer) {
				if (hovered && sim.neos.includes(hovered)) describe();
				else pickHover();
			}
			if (t - lastSync > 250) {
				lastSync = t;
				sync();
			}
		};
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
		};
	});

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	/** Fitness can be fractional (escapes, shared kills): one decimal at most. */
	const num = (v: number) => String(Math.round(v * 10) / 10);
	const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

<section class="neos" class:compact bind:this={root} data-swipe-ignore aria-label="NEOS simulator">
	<div class="grid">
	<div class="stage">
		<!-- A fixed square box with the canvas drawn inside it, so the canvas's pixel size never feeds back into the layout. -->
		<div class="view">
			<canvas
				bind:this={canvas}
				class:drawable={phase === 'ready'}
				aria-label="NEOS swimming, eating and breeding"
				onpointerdown={(e) => (phase === 'ready' ? wallDown(e) : hoverAt(e))}
				onpointermove={wallMove}
				onpointerup={wallUp}
				onpointercancel={wallUp}
				onpointerleave={(e) => e.pointerType === 'mouse' && hoverOff()}
			></canvas>
			{#if hoverInfo}
				<div class="tip" class:flip={hoverInfo.flip} style="left: {hoverInfo.px}px; top: {hoverInfo.py}px">
					<b><i class="dot" style="background: {hoverInfo.albino ? '#f5fffa' : SHADES[hoverInfo.diet][3]}"></i>{hoverInfo.species}</b>
					{#each hoverInfo.lines as l (l)}<span>{l}</span>{/each}
				</div>
			{/if}
			{#if phase === 'ready' && !drawing}
				<div class="hint-over">
					<b>Draw walls</b> by dragging on the world{wallCount ? ' · tap a wall to remove it' : ''}, then press ▶ Play. Walls can only be placed before a run starts.
				</div>
			{:else if phase === 'stopped'}
				<div class="extinct">Run stopped. Start a new world to place walls and run again.</div>
			{:else if extinct}
				<div class="extinct">Extinct! Turn on “Revive after extinction” or start a new world.</div>
			{/if}
		</div>
		<div class="bar">
			{#if phase === 'running'}
				<button class="play" onclick={() => (phase = 'paused')} title="Pause">❚❚ Pause</button>
			{:else}
				<button class="play" disabled={phase === 'stopped'} onclick={play} title={phase === 'paused' ? 'Carry on' : 'Start the run'}>▶ {phase === 'paused' ? 'Resume' : 'Play'}</button>
			{/if}
			<button class="stop" disabled={phase === 'ready' || phase === 'stopped'} onclick={stop} title="End this run">■ Stop</button>
			{#if phase === 'ready' && wallCount}<button onclick={clearWalls} title="Remove every wall">Clear walls</button>{/if}
			<label class="speed" title="Simulation steps per frame">
				<span>Speed ×{speed}</span>
				<input type="range" min="1" max="10" step="1" bind:value={speed} aria-label="Speed" />
			</label>
			<button onclick={reset} title="A fresh world with these settings, waiting for Play (walls can be changed again)">↺ New world</button>
			<button onclick={openSave} title="Name and keep this run (settings, walls, stats, genes) in this browser: up to {MAX_SAVES}">💾 Save</button>
			<button onclick={() => (detailsOpen = !detailsOpen)} class:on={detailsOpen} title="How each species, diet and size has done (opens a window you can drag around)">📊 Details</button>
			<button onclick={() => (savesOpen = 'load')} disabled={!saves.length} title={saves.length ? 'Load one of your saved runs' : 'Nothing saved yet'}>📂 Load</button>
		</div>
		{#if note}<p class="note">{note}<button aria-label="Dismiss" onclick={() => (note = '')}>✕</button></p>{/if}
	</div>

	<div class="side-box">
	<div class="side">
		<div class="tabs" role="tablist">
			<button role="tab" aria-selected={tab === 'stats'} class:on={tab === 'stats'} onclick={() => (tab = 'stats')}>Stats</button>
			<button role="tab" aria-selected={tab === 'settings'} class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>Hyperparameters</button>
			<button role="tab" aria-selected={tab === 'algo'} class:on={tab === 'algo'} onclick={() => (tab = 'algo')}>Algorithm</button>
		</div>

		{#if tab === 'stats'}
			<div class="stats">
				<div><span>Time</span><b>{clock(live.time)}</b></div>
				<div><span>Generation</span><b>{sim.gen} <small>({pct(live.progress)})</small></b></div>
				<div><span>Alive</span><b>{live.alive}</b></div>
				<div><span>Lineage</span><b>gen {live.lineage}</b></div>
				<div><span>Best now</span><b>{num(live.best)}</b></div>
				<div><span>Average now</span><b>{live.avg.toFixed(2)}</b></div>
				<div><span>Best ever</span><b>{num(totals.bestEver)}</b></div>
				<div><span>Food eaten</span><b>{totals.food.toLocaleString()}</b></div>
				<div><span>Born</span><b>{totals.born.toLocaleString()}</b></div>
				<div><span>Died</span><b>{totals.died.toLocaleString()}</b></div>
				<div><span>Extinctions</span><b>{totals.extinctions}</b></div>
				<div><span>Deepest lineage</span><b>gen {totals.lineage}</b></div>
				<div><span>Hidden nodes</span><b>{live.hidden.toFixed(1)} <small>avg</small></b></div>
				{#if cfg.algo === 'neat'}<div><span>Species</span><b>{live.species}</b></div>{/if}
				{#if cfg.body}
					<div><span>Size{cfg.predators ? ' (herbivores)' : ''}</span><b>×{live.sizeHerb.toFixed(2)}</b></div>
					{#if cfg.predators}<div><span>Size (meat-eaters)</span><b>{live.sizeMeat ? `×${live.sizeMeat.toFixed(2)}` : '-'}</b></div>{/if}
					<div><span>Speed gene</span><b>×{live.speedGene.toFixed(2)}</b></div>
				{/if}
				{#if cfg.foodLimit}<div><span>Food left</span><b>{live.foodLeft} <small>/ {cfg.foodNum}</small></b></div>{/if}
				{#if cfg.predators}
					<div class="herb"><span>Herbivores</span><b>{live.alive - live.preds - live.omnis}</b></div>
					{#if cfg.omnivores}<div class="omni"><span>Omnivores</span><b>{live.omnis}</b></div>{/if}
					<div class="pred"><span>Carnivores</span><b>{live.preds}</b></div>
					<div class="pred"><span>Eaten</span><b>{totals.eaten.toLocaleString()}</b></div>
				{/if}
			</div>
			<div class="legend"><i style="--c: #4ade80"></i>Best <i style="--c: #38bdf8"></i>Average <i class="area"></i>Population{#if cfg.predators}{#if cfg.omnivores}<i style="--c: #818cf8"></i>Omnivores{/if}<i style="--c: #f87171"></i>Carnivores{/if}</div>
			<div class="chart-box" bind:this={chartBox}><canvas class="chart" bind:this={chart} aria-label="Fitness per generation"></canvas></div>
			<div class="table-box">
				<table>
					<thead><tr><th>Gen</th><th>Best</th><th>Avg</th><th>Alive</th><th>Total</th><th>Born</th>{#if cfg.body}<th>Size</th>{/if}{#if cfg.predators}<th>Omni</th><th>Carn</th><th>Eaten</th>{/if}</tr></thead>
					<tbody>
						{#each history.toReversed() as h (h.gen)}
							<tr><td>{h.gen}</td><td>{num(h.best)}</td><td>{h.avg.toFixed(2)}</td><td>{h.alive}</td><td>{h.total}</td><td>{h.born}</td>{#if cfg.body}<td>{h.size?.toFixed(2) ?? '-'}</td>{/if}{#if cfg.predators}<td>{h.omnis ?? 0}</td><td>{h.preds ?? 0}</td><td>{h.eaten ?? 0}</td>{/if}</tr>
						{:else}
							<tr><td colspan="10" class="none">Each generation’s stats appear here.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if tab === 'settings'}
			<label class="opt" title="Eaten food comes back at a limited rate instead of at once">
				<input type="checkbox" bind:checked={cfg.foodLimit} />Limit food regrowth (scarcity: the pressure that can make NEOS eat each other)
			</label>
			<div class="sliders">
				{#each SLIDERS.filter((s) => (!s.only || s.only.includes(cfg.algo)) && (!s.preds || cfg.predators) && (!s.limit || cfg.foodLimit) && (!s.body || cfg.body)) as s (s.key)}
					{@const [min, max, step] = RANGES[s.key]}
					{@const v = cfg[s.key] as number}
					<label title={s.tip}>
						<span class="lab">{s.label}<b>{s.fmt ? s.fmt(v) : v}</b></span>
						<input type="range" {min} {max} {step} value={v} oninput={(e) => ((cfg[s.key] as number) = Number(e.currentTarget.value))} />
					</label>
				{/each}
			</div>
			<button class="small" onclick={defaults}>Reset to the original’s settings</button>
		{:else}
			<fieldset class="algos">
				<legend>Evolution algorithm</legend>
				{#each ALGOS as a (a.id)}
					<label class="algo" class:on={cfg.algo === a.id}>
						<input type="radio" name="neos-algo" value={a.id} bind:group={cfg.algo} />
						<span><b>{a.name}</b><small>{a.about}</small></span>
					</label>
				{/each}
			</fieldset>
			{#if cfg.algo === 'neat' || cfg.algo === 'ga'}
			<fieldset>
				<legend>Selection</legend>
				{#each SELECTIONS as [id, label, tip] (id)}
					<label class="opt" title={tip}><input type="radio" name="neos-sel" value={id} bind:group={cfg.selection} />{label}</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Crossover</legend>
				{#each CROSSOVERS as [id, label, tip] (id)}
					<label class="opt" title={tip}><input type="radio" name="neos-cross" value={id} bind:group={cfg.crossover} />{label}</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Mutations</legend>
				{#each SWITCHES.filter((s) => s.group === 'mut') as s (s.key)}
					<label class="opt" title={s.tip}><input type="checkbox" bind:checked={cfg[s.key] as boolean} />{s.label}</label>
				{/each}
			</fieldset>
			{:else}
				<p class="hint">{cfg.algo === 'es' ? 'An evolution strategy mutates every baby with Gaussian noise (Mutation strength in Hyperparameters); there’s no crossover.' : cfg.algo === 'de' ? 'Differential evolution makes babies from three NEOS (F and CR in Hyperparameters); there’s no separate crossover or mutation.' : 'Random search passes nothing on: a baseline to compare the others against.'}</p>
			{/if}
			<fieldset class="algos">
				<legend>Body</legend>
				<label class="opt" title="Size and speed are genes, paid for in energy">
					<input type="checkbox" bind:checked={cfg.body} />Size and speed evolve
				</label>
				<small class="hint">Bigger NEOS are slower and burn more energy (size²), as do fast ones; an empty energy store is death. A hunter alone can only eat NEOS its size or smaller, but a pack of smaller ones touching a big NEOS can if their sizes add up, so being big is mostly worth it for herbivores, which then have less to run from.</small>
			</fieldset>
			<fieldset class="algos">
				<legend>Predators</legend>
				<label class="opt" title="NEOS can evolve to eat other NEOS">
					<input type="checkbox" bind:checked={cfg.predators} />Some NEOS can evolve to eat other NEOS
				</label>
				<label class="opt" title="Omnivores eat food and herbivores: the step between herbivores and carnivores">
					<input type="checkbox" bind:checked={cfg.omnivores} disabled={!cfg.predators} />Omnivores in between
				</label>
				<small class="hint"
					>Herbivores are <b class="c-herb">green</b>, omnivores <b class="c-omni">blue</b> and carnivores <b class="c-carn">red</b> (with fangs). Hunger drives it: a starving parent’s baby may eat more meat, a well-fed one’s almost never, so with plenty of food, predators don’t take hold. Limit food regrowth (Hyperparameters) to make food scarce. Every NEOS senses the nearest thing that could eat it, so prey can evolve to run away.</small
				>
			</fieldset>
			<fieldset>
				<legend>Life and elitism</legend>
				{#each SWITCHES.filter((s) => s.group === 'life') as s (s.key)}
					<label class="opt" title={s.tip}><input type="checkbox" bind:checked={cfg[s.key] as boolean} />{s.label}</label>
				{/each}
			</fieldset>
			<p class="hint">Changes apply straight away; the world keeps going.</p>
		{/if}
	</div>
	</div>
	</div>
</section>

{#if detailsOpen}<NeosDetails {sim} onclose={() => (detailsOpen = false)} />{/if}

{#if savesOpen}
	<div use:portal>
		<Modal title={savesOpen === 'save' ? 'Save this run' : 'Load a run'} width="440px" onclose={() => (savesOpen = null)}>
			<div class="saves">
				{#if savesOpen === 'save'}
					{#if saves.length >= MAX_SAVES}
						<p class="warn">You have {MAX_SAVES} saved runs, the most there can be. Delete one to make room:</p>
					{:else}
						<form
							class="name"
							onsubmit={(e) => {
								e.preventDefault();
								save();
							}}
						>
							<label for="neos-save-name">Name this run</label>
							<div class="row">
								<input id="neos-save-name" bind:value={saveName} maxlength="40" placeholder="e.g. Scarce food, NEAT" />
								<button class="primary" type="submit">Save</button>
							</div>
							<small>Keeps the settings, walls, stats and every NEOS’s genes, in this browser ({saves.length}/{MAX_SAVES} used).</small>
						</form>
					{/if}
				{/if}
				{#if saves.length}
					<ul>
						{#each saves as s (s.id)}
							<li>
								<span class="sname"><b>{s.name}</b><small>{when(s.at)} · generation {s.gen}</small></span>
								{#if savesOpen === 'load'}<button class="primary" onclick={() => load(s)}>Load</button>{/if}
								<button class="del" onclick={() => remove(s.id)} title="Delete {s.name}">Delete</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No saved runs yet.</p>
				{/if}
			</div>
		</Modal>
	</div>
{/if}

<style>
	.neos {
		container-type: inline-size;
		padding: 12px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(74, 222, 128, 0.3);
		box-shadow: 0 0 40px -14px rgba(74, 222, 128, 0.5);
		color: #e2e8f0;
		font-size: 0.82rem;
		pointer-events: auto;
	}
	.neos.compact {
		padding: 8px;
		border-radius: 12px;
	}
	.stage {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.view {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
		background: #cfe0f2;
	}
	.view canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.saves {
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: #e2e8f0;
		font-size: 0.88rem;
	}
	.saves .name {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.saves .row {
		display: flex;
		gap: 8px;
	}
	.saves input {
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
	}
	.saves small,
	.saves .muted {
		color: #94a3b8;
	}
	.saves .warn {
		margin: 0;
		color: #fbbf24;
	}
	.saves ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.saves li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.05);
	}
	.sname {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.sname b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.primary {
		background: rgba(74, 222, 128, 0.2);
		border-color: #4ade80;
	}
	.del:hover {
		border-color: #f87171 !important;
		color: #fca5a5;
	}
	/* The hovered NEOS's label: beside it, on its left near the right edge. */
	.tip {
		position: absolute;
		z-index: 2;
		transform: translate(14px, -50%);
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 9px;
		border-radius: 9px;
		background: rgba(10, 14, 26, 0.92);
		border: 1px solid rgba(148, 163, 184, 0.3);
		font-size: 0.72rem;
		color: #cbd5e1;
		white-space: nowrap;
		pointer-events: none;
	}
	.tip.flip {
		transform: translate(calc(-100% - 14px), -50%);
	}
	.tip b {
		color: #f1f5f9;
		font-size: 0.8rem;
	}
	.tip .dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 6px;
		border-radius: 50%;
		vertical-align: middle;
		box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.6);
	}
	canvas.drawable {
		cursor: crosshair;
		touch-action: none;
	}
	.hint-over {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 12px;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(10, 14, 26, 0.78);
		font-size: 0.78rem;
		text-align: center;
		pointer-events: none;
	}
	.stop:not(:disabled):hover {
		border-color: #f87171;
	}
	.stats .pred b,
	.c-carn {
		color: #f87171;
	}
	.stats .omni b,
	.c-omni {
		color: #93c5fd;
	}
	.stats .herb b,
	.c-herb {
		color: #4ade80;
	}
	.extinct {
		position: absolute;
		left: 12px;
		right: 12px;
		top: 40%;
		padding: 10px;
		border-radius: 10px;
		background: rgba(10, 14, 26, 0.85);
		text-align: center;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	button {
		padding: 5px 10px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: #4ade80;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.play {
		min-width: 38px;
		background: rgba(74, 222, 128, 0.18);
	}
	.speed {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1 1 120px;
		color: #94a3b8;
		white-space: nowrap;
	}
	.speed input {
		flex: 1;
		min-width: 60px;
	}
	input[type='range'] {
		accent-color: #4ade80;
	}
	.note {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin: 0;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(74, 222, 128, 0.1);
		color: #bbf7d0;
	}
	.note button {
		padding: 0 4px;
		border: none;
		background: none;
	}
	.side-box {
		min-width: 0;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.tabs {
		display: flex;
		gap: 4px;
	}
	.tabs button {
		flex: 1;
		padding: 6px 4px;
		font-size: 0.78rem;
	}
	.bar button.on {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.16);
	}
	.tabs button.on {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.16);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 6px;
	}
	.stats div {
		display: flex;
		flex-direction: column;
		padding: 5px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
	}
	.stats span {
		color: #94a3b8;
		font-size: 0.7rem;
	}
	.stats b {
		font-variant-numeric: tabular-nums;
	}
	.stats small {
		color: #94a3b8;
		font-weight: 400;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 4px 10px;
		flex-wrap: wrap;
		color: #94a3b8;
		font-size: 0.72rem;
	}
	.legend i {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: -6px;
		border-radius: 2px;
		background: var(--c);
	}
	.legend i.area {
		height: 8px;
		background: rgba(148, 163, 184, 0.3);
	}
	/* Desktop (a mouse): the chart's scroll bar always shows, thick enough to grab. */
	@media (hover: hover) and (pointer: fine) {
		.chart-box {
			overflow-x: scroll !important;
			scrollbar-width: auto !important;
			scrollbar-color: rgba(74, 222, 128, 0.55) rgba(255, 255, 255, 0.06);
		}
		.chart-box::-webkit-scrollbar {
			height: 10px;
		}
		.chart-box::-webkit-scrollbar-thumb {
			border-radius: 5px;
			background: rgba(74, 222, 128, 0.55);
		}
		.chart-box::-webkit-scrollbar-track {
			background: rgba(255, 255, 255, 0.06);
		}
	}
	.chart-box {
		flex: none;
		height: 120px;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
		scrollbar-width: thin;
	}
	.chart {
		display: block;
		width: 100%;
		height: 100%;
	}
	.none {
		text-align: center;
		color: #94a3b8;
		padding: 12px 4px;
	}
	/* Every generation's row, in its own scrolling box. */
	.table-box {
		flex: none;
		height: 170px;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	thead th {
		position: sticky;
		top: 0;
		background: #0b1020;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
	}
	th,
	td {
		padding: 3px 4px;
		text-align: right;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
	}
	th {
		color: #94a3b8;
		font-weight: 600;
	}
	.sliders {
		display: grid;
		gap: 8px;
	}
	.sliders label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lab {
		display: flex;
		justify-content: space-between;
		color: #cbd5e1;
	}
	.lab b {
		color: #4ade80;
		font-variant-numeric: tabular-nums;
	}
	.small {
		align-self: flex-start;
		font-size: 0.75rem;
	}
	fieldset {
		margin: 0;
		padding: 6px 10px 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	legend {
		padding: 0 4px;
		color: #94a3b8;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.opt input {
		accent-color: #4ade80;
	}
	.hint {
		margin: 0;
		color: #94a3b8;
		font-size: 0.75rem;
	}
	.grid {
		display: grid;
		gap: 12px;
	}
	.algos {
		flex-direction: column;
		flex-wrap: nowrap;
	}
	.algo {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 5px 6px;
		border-radius: 8px;
		cursor: pointer;
	}
	.algo.on {
		background: rgba(74, 222, 128, 0.12);
	}
	.algo input {
		margin-top: 3px;
		accent-color: #4ade80;
	}
	.algo span {
		display: flex;
		flex-direction: column;
	}
	.algo small {
		color: #94a3b8;
		font-size: 0.72rem;
	}
	/* Wide: the world on the left, the controls beside it. */
	@container (min-width: 720px) {
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
		}
		/* As tall as the world beside it, scrolling inside rather than stretching the card. */
		.side-box {
			position: relative;
			min-width: 0;
			min-height: 360px;
		}
		.side {
			position: absolute;
			inset: 0;
			overflow-y: auto;
			scrollbar-width: thin;
		}
	}
</style>
