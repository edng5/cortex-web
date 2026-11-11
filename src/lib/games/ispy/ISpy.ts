// iSpy: Edward's I Spy (a Python + OpenCV game where the computer guesses an object by its
// colour), made into an arcade game for E.Ngine Games. Two modes:
//  - Seek & Find: "I spy with my little eye, something RED…" Click a matching thing in a busy scene
//    before time runs out. Right finds add time and build a combo; wrong clicks cost time. Each
//    level is busier, with smaller things, more lookalikes, and clues that add what kind of thing it is.
//  - Stump the Computer (the original game, turned round): pick a thing in your head, say its
//    colour, and the computer gets three guesses. Stump it to score.
// Scenes are rooms and places with things where they belong, filled differently every game. Menus are clicked or tapped; H for a hint,
// Enter to pause. Seek & Find scores go on the public leaderboard.
import { Gfx, buttonAt, drawButtons, drawGameOver, loadArcadeFont, loadSave, panel, roundRect, text, touchScreen, writeSave, type ArcadeGame, type Board, type UiButton, type UiTheme } from '../common';
import { SCALE, SCENES, SPOTS, drawScene, type Scene, type Spot } from './scenes';

export const GAME_W = 900;
export const GAME_H = 640;
export const TICK_MS = 16;

const SAVE_KEY = 'ispy-save';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const ROUND = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

type Colour = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'brown' | 'white' | 'black';
type Kind = 'food' | 'animal' | 'toy' | 'thing' | 'nature' | 'vehicle';
interface Item {
	e: string;
	name: string;
	colour: Colour;
	kind: Kind;
}
// Things to spy (chosen for colours that look the same on every device).
const ITEMS: Item[] = [
	...(
		[
			['🍎', 'apple', 'food'], ['🍓', 'strawberry', 'food'], ['🍒', 'cherries', 'food'], ['🎈', 'balloon', 'toy'], ['🚒', 'fire truck', 'vehicle'], ['🍅', 'tomato', 'food'], ['🦜', 'parrot', 'animal'], ['🐞', 'ladybug', 'animal'],
			['🍄', 'mushroom', 'nature'], ['🌹', 'rose', 'nature'], ['🦀', 'crab', 'animal'], ['🧲', 'magnet', 'thing'], ['🥊', 'boxing glove', 'thing']
		] as const
	).map(([e, name, kind]) => ({ e, name, kind, colour: 'red' as const })),
	...([['🍊', 'orange', 'food'], ['🥕', 'carrot', 'food'], ['🦊', 'fox', 'animal'], ['🐅', 'tiger', 'animal'], ['🎃', 'pumpkin', 'nature'], ['🏀', 'basketball', 'toy']] as const).map(
		([e, name, kind]) => ({ e, name, kind, colour: 'orange' as const })
	),
	...(
		[['🍌', 'banana', 'food'], ['🧀', 'cheese', 'food'], ['🍋', 'lemon', 'food'], ['🐥', 'chick', 'animal'], ['🌻', 'sunflower', 'nature'], ['⭐', 'star', 'thing'], ['🚕', 'taxi', 'vehicle'], ['🌽', 'corn', 'food'], ['🍍', 'pineapple', 'food'], ['🐝', 'bee', 'animal']] as const
	).map(([e, name, kind]) => ({ e, name, kind, colour: 'yellow' as const })),
	...(
		[['🐸', 'frog', 'animal'], ['🐢', 'turtle', 'animal'], ['🦖', 'dinosaur', 'animal'], ['🥦', 'broccoli', 'food'], ['🥒', 'cucumber', 'food'], ['🍏', 'green apple', 'food'], ['🌵', 'cactus', 'nature'], ['🍀', 'clover', 'nature'], ['🐍', 'snake', 'animal'], ['🐊', 'crocodile', 'animal'], ['👽', 'alien', 'toy']] as const
	).map(([e, name, kind]) => ({ e, name, kind, colour: 'green' as const })),
	...([['🐳', 'whale', 'animal'], ['🐟', 'fish', 'animal'], ['🫐', 'blueberries', 'food'], ['📘', 'book', 'thing'], ['💎', 'gem', 'thing'], ['🧢', 'cap', 'thing'], ['🐬', 'dolphin', 'animal'], ['🦋', 'butterfly', 'animal']] as const).map(
		([e, name, kind]) => ({ e, name, kind, colour: 'blue' as const })
	),
	...([['🍇', 'grapes', 'food'], ['🍆', 'eggplant', 'food'], ['🔮', 'crystal ball', 'thing'], ['👾', 'space invader', 'toy']] as const).map(([e, name, kind]) => ({
		e, name, kind, colour: 'purple' as const
	})),
	...([['🐷', 'pig', 'animal'], ['🦩', 'flamingo', 'animal'], ['🍩', 'donut', 'food'], ['🌸', 'blossom', 'nature'], ['🎀', 'ribbon', 'thing']] as const).map(([e, name, kind]) => ({
		e, name, kind, colour: 'pink' as const
	})),
	...([['🧸', 'teddy bear', 'toy'], ['🐻', 'bear', 'animal'], ['🍪', 'cookie', 'food'], ['🥔', 'potato', 'food'], ['🎻', 'violin', 'thing'], ['🪵', 'log', 'nature'], ['🐒', 'monkey', 'animal'], ['🥥', 'coconut', 'food']] as const).map(
		([e, name, kind]) => ({ e, name, kind, colour: 'brown' as const })
	),
	...([['🐑', 'sheep', 'animal'], ['🦢', 'swan', 'animal'], ['🥚', 'egg', 'food'], ['🧻', 'toilet roll', 'thing'], ['☁️', 'cloud', 'nature'], ['👻', 'ghost', 'toy']] as const).map(
		([e, name, kind]) => ({ e, name, kind, colour: 'white' as const })
	),
	...([['🎱', '8-ball', 'toy'], ['🎩', 'top hat', 'thing'], ['🕶️', 'sunglasses', 'thing'], ['🕷️', 'spider', 'animal'], ['🦍', 'gorilla', 'animal']] as const).map(
		([e, name, kind]) => ({ e, name, kind, colour: 'black' as const })
	)
];
const COLOURS: Colour[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'white', 'black'];
const SWATCH: Record<Colour, string> = {
	red: '#ef4444', orange: '#f97316', yellow: '#facc15', green: '#22c55e', blue: '#3b82f6',
	purple: '#a855f7', pink: '#f472b6', brown: '#92400e', white: '#f8fafc', black: '#111827'
};
const KIND_HINT: Record<Kind, string> = {
	food: 'you can eat', animal: "that's an animal", toy: 'you can play with', thing: "that's a thing you own", nature: 'that grows or floats outside', vehicle: 'with wheels'
};

const itemNamed = new Map(ITEMS.map((i) => [i.name, i]));
const poolOf = (spot: Spot) => spot.pool.map((n) => itemNamed.get(n)!).filter(Boolean);

interface Placed {
	item: Item;
	x: number;
	y: number;
	size: number;
	rot: number;
	/** Where it rests (for its shadow), or null when it floats. */
	base: number | null;
	/** What else could be in its spot (for lookalikes). */
	pool: Item[];
	found: number; // 0, or when it was found (fades out)
}

const UI: UiTheme = {
	family: ROUND,
	size: 22,
	detailSize: 13,
	radius: 16,
	borderWidth: 3,
	glow: 'rgba(20,184,166,0.5)',
	idle: { fill: 'rgba(255,255,255,0.88)', text: '#134e4a', border: 'rgba(255,255,255,1)', detail: 'rgba(19,78,74,0.75)' },
	hover: { fill: '#ffffff', text: '#0f766e', border: '#14b8a6', detail: '#0f766e' },
	primary: { fill: '#14b8a6', text: '#fff', border: '#fff', detail: 'rgba(255,255,255,0.9)' },
	chosen: { fill: '#fff', text: '#134e4a', border: '#f59e0b' },
	disabled: { fill: 'rgba(255,255,255,0.4)', text: 'rgba(19,78,74,0.4)', border: 'rgba(255,255,255,0.6)' }
};

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: readonly T[]): T => a[rnd(a.length)];

export class ISpy implements ArcadeGame {
	screen: 'menu' | 'how' | 'seek' | 'levelUp' | 'over' | 'paused' | 'stump' = 'menu';
	scene: Scene = 'bedroom';
	things: Placed[] = [];
	level = 1;
	score = 0;
	best = 0;
	time = 0; // seconds left
	combo = 0;
	lastFind = 0;
	clue: { colour: Colour; kind: Kind | null } | null = null;
	found = 0;
	goal = 3;
	hints = 2;
	hint: { x: number; y: number; until: number } | null = null;
	flash: { text: string; color: string; at: number; x: number; y: number } | null = null;
	shake = 0;
	goy = -60;
	/** Stump the Computer. */
	stump: { colour: Colour | null; guesses: Placed[]; at: number; done: 'you' | 'me' | null } = { colour: null, guesses: [], at: 0, done: null };
	wins = { you: 0, me: 0 };
	private now = 0;
	private hover: string | null = null;
	private g = new Gfx();

	sfx: (name: string) => void = () => {};
	onQuit: () => void = () => {};
	onScore: (board: number, score: number) => void = () => {};
	global: Board | null = null;
	loggedIn = false;

	constructor() {
		loadArcadeFont();
		const s = loadSave(SAVE_KEY, { best: 0, wins: { you: 0, me: 0 } });
		this.best = s.best;
		this.wins = { you: s.wins?.you ?? 0, me: s.wins?.me ?? 0 };
	}
	save() {
		writeSave(SAVE_KEY, { best: this.best, wins: this.wins });
	}
	musicTrack() {
		return this.screen == 'seek' || this.screen == 'levelUp' || this.screen == 'paused' ? 'ispy-play' : 'ispy-menu';
	}
	leave() {
		if (this.screen == 'seek' || this.screen == 'paused' || this.screen == 'levelUp') this.endSeek();
		this.save();
	}
	disabledButtons() {
		return this.screen == 'seek' && this.hints > 0 ? [] : ['KeyH'];
	}

	// ── Scenes ──
	/** Puts `n` things where they belong in the scene (books on shelves, frogs in the pond). */
	private populate(n: number, size: number) {
		const spots = SPOTS[this.scene];
		// Each spot gets things by how many fit in it (floating ones a bit sparser).
		const weight = spots.map((p) => {
			const d = size * p.s;
			return (p.w ?? 1) * (p.float ? ((p.x1 - p.x0) * (p.y1 - p.y0) * 0.45) / (d * d) : ((p.x1 - p.x0) / d) * (1 + (p.y1 - p.y0) / (d * 0.6)));
		});
		const total = weight.reduce((a, b) => a + b, 0);
		const placed: Placed[] = [];
		for (let i = 0; i < n; i++) {
			let best: Placed | null = null;
			let bestGap = -Infinity;
			// Pick a spot; if it's full, another one (a little overlap is fine, piles look natural).
			for (let tries = 0; tries < 5 && !(best && bestGap > -best.size * 0.3); tries++) {
				let r = Math.random() * total;
				let k = 0;
				while (r > weight[k] && k < spots.length - 1) r -= weight[k++];
				const spot = spots[k];
				const pool = poolOf(spot);
				const item = pick(pool);
				// Try a few places in it; keep the one furthest from the rest.
				for (let t = 0; t < 16; t++) {
					const x = spot.x0 + Math.random() * (spot.x1 - spot.x0);
					const y = spot.y0 + Math.random() * (spot.y1 - spot.y0);
					if (spot.avoid) {
						const [ax, ay, rx, ry] = spot.avoid;
						if (((x - ax) / rx) ** 2 + ((y - ay) / ry) ** 2 < 1) continue;
					}
					const far = spot.depth && spot.y1 > spot.y0 ? 0.78 + 0.32 * ((y - spot.y0) / (spot.y1 - spot.y0)) : 1;
					const s = size * spot.s * far * (SCALE[item.name] ?? 1) * (0.92 + Math.random() * 0.16);
					const p: Placed = { item, x, y: spot.float ? y : y - s * 0.42, size: s, rot: (Math.random() - 0.5) * 0.16, base: spot.float ? null : y, pool, found: 0 };
					const gap = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - p.x, q.y - p.y) - (q.size + p.size) * 0.45), 1e9);
					if (gap > bestGap) {
						bestGap = gap;
						best = p;
					}
					if (gap > 2) break;
				}
			}
			// Too crowded everywhere: leave it out rather than bury something.
			if (best && bestGap > -best.size * 0.45) placed.push(best);
		}
		// Back to front: things lower down are nearer, drawn over the ones behind.
		return placed.sort((p, q) => (p.base ?? p.y) - (q.base ?? q.y));
	}

	// ── Seek & Find ──
	private startSeek() {
		this.level = 1;
		this.score = 0;
		this.time = 45;
		this.combo = 0;
		this.goy = -60;
		this.newLevel();
	}
	private newLevel() {
		const L = this.level;
		this.scene = SCENES[(L - 1) % SCENES.length];
		this.goal = Math.min(6, 3 + Math.floor((L - 1) / 2));
		this.found = 0;
		this.hints = 2;
		this.hint = null;
		this.things = this.populate(Math.min(90, 40 + L * 7), Math.max(28, 50 - L * 2.5));
		this.nextClue();
		this.screen = 'seek';
	}
	/** A new clue, for something that's in the scene (and not found yet). */
	private nextClue() {
		const left = this.things.filter((t) => !t.found);
		const target = pick(left);
		// From level 3, some clues also say what kind of thing it is (and there are more lookalikes).
		const withKind = this.level >= 3 && Math.random() < Math.min(0.85, 0.3 + this.level * 0.08);
		this.clue = { colour: target.item.colour, kind: withKind ? target.item.kind : null };
		// More lookalikes later: things of the same colour but another kind.
		if (withKind && this.level >= 4) {
			// (Only things that belong in that spot: no fish on the bookshelf.)
			const lookFor = (t: Placed) => t.pool.filter((i) => i.colour == target.item.colour && i.kind != target.item.kind);
			for (let k = 0; k < Math.min(3, this.level - 3); k++) {
				const spare = this.things.find((t) => !t.found && t.item.colour != target.item.colour && t != target && lookFor(t).length);
				if (spare) spare.item = pick(lookFor(spare));
			}
		}
	}
	private matches(t: Placed) {
		return !!this.clue && t.item.colour == this.clue.colour && (!this.clue.kind || t.item.kind == this.clue.kind);
	}
	private clickSeek(x: number, y: number) {
		// The topmost thing under the pointer.
		const hit = [...this.things].reverse().find((t) => !t.found && Math.hypot(t.x - x, t.y - y) < t.size * 0.55);
		if (!hit) return;
		if (this.matches(hit)) {
			hit.found = this.now;
			const quick = this.now - this.lastFind < 6000;
			this.combo = quick ? this.combo + 1 : 1;
			this.lastFind = this.now;
			const pts = 100 * this.level * Math.min(5, this.combo);
			this.score += pts;
			this.time = Math.min(99, this.time + 4);
			this.found++;
			this.flash = { text: `+${pts}${this.combo > 1 ? `  x${Math.min(5, this.combo)}` : ''}`, color: '#16a34a', at: this.now, x: hit.x, y: hit.y };
			this.sfx(this.combo > 2 ? 'combo' : 'found');
			if (this.found >= this.goal) {
				// Level cleared: time left is worth points.
				this.score += Math.round(this.time) * 10 * this.level;
				this.screen = 'levelUp';
				this.flash = null;
				this.sfx('levelUp');
				setTimeout(() => {
					if (this.screen != 'levelUp') return;
					this.level++;
					this.time = Math.min(99, this.time + 10);
					this.newLevel();
				}, 1800);
			} else this.nextClue();
		} else {
			this.time = Math.max(0, this.time - 3);
			this.combo = 0;
			this.shake = 12;
			this.flash = { text: `Not that one: it's a ${hit.item.name}! −3s`, color: '#dc2626', at: this.now, x: hit.x, y: hit.y };
			this.sfx('wrong');
		}
	}
	private useHint() {
		if (this.screen != 'seek' || this.hints <= 0) return;
		const t = this.things.find((x) => !x.found && this.matches(x));
		if (!t) return;
		this.hints--;
		this.score = Math.max(0, this.score - 50);
		// A circle somewhere around it (not right on it).
		this.hint = { x: t.x + (Math.random() - 0.5) * 80, y: t.y + (Math.random() - 0.5) * 80, until: this.now + 1800 };
		this.sfx('hint');
	}
	private endSeek() {
		if (this.score > this.best) this.best = this.score;
		if (this.score > 0) this.onScore(1, this.score); // Seek & Find's public leaderboard
		this.screen = 'over';
		this.goy = -60;
		this.save();
		this.sfx('lose');
	}

	// ── Stump the Computer ──
	private startStump() {
		this.scene = pick(SCENES);
		this.things = this.populate(48, 44);
		this.stump = { colour: null, guesses: [], at: 0, done: null };
		this.screen = 'stump';
	}
	private sayColour(c: Colour) {
		const options = this.things.filter((t) => t.item.colour == c);
		if (!options.length) {
			this.flash = { text: `I don't see anything ${c} here!`, color: '#dc2626', at: this.now, x: GAME_W / 2, y: 300 };
			this.sfx('wrong');
			return;
		}
		// The computer's guesses: up to three, in a random order.
		// (One guess per kind of thing: two blossoms are one guess.)
		const distinct = options.filter((t, i) => options.findIndex((o) => o.item.name == t.item.name) == i);
		this.stump = { colour: c, guesses: distinct.sort(() => Math.random() - 0.5).slice(0, 3), at: 0, done: null };
		this.sfx('guess');
	}
	private answer(yes: boolean) {
		const s = this.stump;
		if (yes) {
			s.done = 'me';
			this.wins.me++;
			this.sfx('lose');
		} else if (++s.at >= s.guesses.length) {
			s.done = 'you';
			this.wins.you++;
			this.sfx('win');
		} else this.sfx('guess');
		this.save();
	}

	// ── Loop ──
	tick() {
		this.now = performance.now();
		if (this.shake > 0) this.shake--;
		if (this.screen == 'over' && this.goy < 260) this.goy += 8;
		if (this.screen != 'seek') return;
		const before = Math.ceil(this.time);
		this.time -= TICK_MS / 1000;
		if (Math.ceil(this.time) != before && this.time <= 10 && this.time > 0) this.sfx('tick');
		if (this.time <= 0) {
			this.time = 0;
			this.endSeek();
		}
	}

	keyPressed(code: string): boolean {
		if (code == 'Enter' || code == 'NumpadEnter') {
			if (this.screen == 'seek') this.screen = 'paused';
			else if (this.screen == 'paused') this.screen = 'seek';
			return true;
		}
		if (code == 'KeyH') {
			this.useHint();
			return true;
		}
		return false;
	}
	keyReleased(code: string): boolean {
		return code == 'Enter' || code == 'KeyH';
	}

	// ── Menus and buttons ──
	private ui(): UiButton[] {
		const cx = GAME_W / 2;
		switch (this.screen) {
			case 'menu':
				return [
					{ id: 'seek', label: 'Seek & Find', detail: 'Find what I spy before time runs out', x: cx - 170, y: 300, w: 340, h: 70, kind: 'primary', onClick: () => this.startSeek() },
					{ id: 'stump', label: 'Stump the Computer', detail: 'Think of something; I guess what it is', x: cx - 170, y: 386, w: 340, h: 70, onClick: () => this.startStump() },
					{ id: 'how', label: 'How to play', x: cx - 170, y: 472, w: 165, h: 50, size: 18, onClick: () => (this.screen = 'how') },
					{ id: 'quit', label: 'Quit', x: cx + 5, y: 472, w: 165, h: 50, size: 18, onClick: () => { this.save(); this.onQuit(); } }
				];
			case 'how':
				return [{ id: 'back', label: '‹ Back', x: 20, y: 18, w: 120, h: 46, size: 20, onClick: () => (this.screen = 'menu') }];
			case 'seek':
				return [
					{ id: 'hint', label: `Hint (${this.hints})`, x: GAME_W - 150, y: 92, w: 130, h: 44, size: 17, disabled: this.hints <= 0, onClick: () => this.useHint() },
					// (On phones the menu button is with the touch controls.)
					...(touchScreen() ? [] : [{ id: 'pause', label: '☰', x: GAME_W - 66, y: 18, w: 48, h: 48, size: 22, onClick: () => (this.screen = 'paused') }])
				];
			case 'paused':
				return [
					{ id: 'resume', label: 'Resume', x: cx - 120, y: 280, w: 240, h: 54, kind: 'primary', onClick: () => (this.screen = 'seek') },
					{ id: 'menu', label: 'Main menu', x: cx - 120, y: 346, w: 240, h: 54, onClick: () => { this.endSeek(); this.screen = 'menu'; } }
				];
			case 'over':
				return this.goy >= 260
					? [
							{ id: 'again', label: 'Play again', x: cx - 170, y: 440, w: 160, h: 54, kind: 'primary', onClick: () => this.startSeek() },
							{ id: 'menu', label: 'Main menu', x: cx + 10, y: 440, w: 160, h: 54, onClick: () => (this.screen = 'menu') }
						]
					: [];
			case 'stump': {
				const s = this.stump;
				const back: UiButton = { id: 'back', label: '‹ Menu', x: 20, y: 18, w: 120, h: 46, size: 20, onClick: () => (this.screen = 'menu') };
				if (!s.colour) {
					return [
						back,
						...COLOURS.map((c, i): UiButton => ({
							id: 'c-' + c, label: '', x: 110 + i * 70, y: 96, w: 60, h: 46,
							draw: (ctx, b) => {
								roundRect(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 10);
								ctx.fillStyle = SWATCH[c];
								ctx.fill();
								ctx.strokeStyle = 'rgba(0,0,0,0.25)';
								ctx.lineWidth = 2;
								ctx.stroke();
							},
							onClick: () => this.sayColour(c)
						}))
					];
				}
				if (s.done) return [back, { id: 'again', label: 'Again', x: cx - 80, y: 96, w: 160, h: 50, kind: 'primary', onClick: () => this.startStump() }];
				return [
					back,
					{ id: 'yes', label: 'Yes!', x: cx - 150, y: 96, w: 140, h: 50, kind: 'primary', onClick: () => this.answer(true) },
					{ id: 'no', label: 'No', x: cx + 10, y: 96, w: 140, h: 50, onClick: () => this.answer(false) }
				];
			}
		}
		return [];
	}
	pointerMove(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		this.hover = b?.id ?? null;
		return !!b || this.screen == 'seek';
	}
	pointerDown(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		if (b) {
			this.sfx('confirm');
			b.onClick();
			this.hover = null;
			return;
		}
		if (this.screen == 'seek') this.clickSeek(x, y);
	}

	// ── Drawing ──
	private backdrop(ctx: CanvasRenderingContext2D, scene: Scene) {
		drawScene(ctx, scene, GAME_W, GAME_H, this.now);
	}

	private drawThings(ctx: CanvasRenderingContext2D) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const t of this.things) {
			if (t.found && this.now - t.found > 500) continue;
			// A soft shadow under things that rest on something.
			if (t.base != null && !t.found) {
				ctx.fillStyle = 'rgba(0,0,0,0.18)';
				ctx.beginPath();
				ctx.ellipse(t.x, t.base, t.size * 0.32, t.size * 0.07, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.save();
			ctx.translate(t.x, t.y);
			ctx.rotate(t.rot);
			if (t.found) {
				const k = (this.now - t.found) / 500;
				ctx.globalAlpha = 1 - k;
				ctx.scale(1 + k, 1 + k);
			}
			ctx.font = `${Math.round(t.size)}px ${EMOJI}`;
			ctx.fillStyle = '#000';
			ctx.fillText(t.item.e, 0, 0);
			ctx.restore();
		}
	}

	paint(ctx: CanvasRenderingContext2D, now: number) {
		this.now = now;
		this.g.begin(ctx);
		const cx = GAME_W / 2;
		const buttons = this.ui();

		if (this.screen == 'menu' || this.screen == 'how') {
			this.backdrop(ctx, 'garden');
			// A few things bobbing about behind the title.
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			['🍎', '🐸', '📘', '🌻', '🎈', '🧸', '🐳', '🍩'].forEach((e, i) => {
				ctx.font = `46px ${EMOJI}`;
				ctx.fillText(e, 80 + i * 105, 560 + Math.sin(now / 500 + i) * 10);
			});
			if (this.screen == 'menu') {
				panel(ctx, cx - 230, 70, 460, 190, { fill: 'rgba(255,255,255,0.85)', border: '#14b8a6', width: 4, radius: 28 });
				text(ctx, 'iSpy', cx, 140, { size: 84, family: ROUND, color: '#0f766e', align: 'center' });
				ctx.font = `64px ${EMOJI}`;
				ctx.fillText('🔍', cx + 150, 126 + Math.sin(now / 300) * 6);
				text(ctx, 'with my little eye…', cx, 214, { size: 22, family: ROUND, color: '#134e4a', align: 'center', bold: false });
				text(ctx, `Best ${this.best}   ·   You ${this.wins.you} – ${this.wins.me} Computer`, cx, 616, { size: 16, family: ROUND, color: '#134e4a', align: 'center' });
			} else {
				panel(ctx, 70, 80, GAME_W - 140, 420, { fill: 'rgba(255,255,255,0.92)', border: '#14b8a6', width: 3, radius: 24 });
				text(ctx, 'How to play', cx, 120, { size: 34, family: ROUND, color: '#0f766e', align: 'center' });
				const lines = [
					['Seek & Find', ''],
					['I spy something of a colour (later: and what kind of thing).', 'Click any match in the scene.'],
					['Right: +4 seconds, and quick finds build a combo (up to x5).', 'Wrong: −3 seconds. Clear the level for a time bonus.'],
					[`Stuck? Hint (H) circles the area: two per level, −50 points.`, ''],
					['Stump the Computer', ''],
					['Think of something in the scene and tell me its colour.', 'I get three guesses. Answer Yes or No. Stump me to win!']
				];
				let y = 168;
				for (const [a, b] of lines) {
					const heading = !b && (a == 'Seek & Find' || a == 'Stump the Computer');
					text(ctx, a, 110, y, { size: heading ? 22 : 17, family: ROUND, color: heading ? '#0f766e' : '#134e4a', bold: heading });
					y += heading ? 32 : 24;
					if (b) {
						text(ctx, b, 110, y, { size: 17, family: ROUND, color: '#134e4a', bold: false });
						y += 34;
					}
				}
			}
			return drawButtons(ctx, buttons, UI, this.hover);
		}

		if (this.screen == 'stump') {
			this.backdrop(ctx, this.scene);
			this.drawThings(ctx);
			const s = this.stump;
			panel(ctx, 160, 14, GAME_W - 320, 70, { fill: 'rgba(255,255,255,0.92)', border: '#14b8a6', width: 3, radius: 22 });
			let say = 'Think of something here. What colour is it?';
			if (s.colour && !s.done) say = `Something ${s.colour}… Is it the ${s.guesses[s.at].item.name}?`;
			if (s.done == 'me') say = `Got it! The ${s.guesses[s.at].item.name}. I win! 😎`;
			if (s.done == 'you') say = `You stumped me! 🤯 You win this one.`;
			text(ctx, say, cx, 49, { size: 22, family: ROUND, color: '#134e4a', align: 'center', max: GAME_W - 360 });
			// The computer points at its guess.
			if (s.colour && !s.done) {
				const t = s.guesses[s.at];
				ctx.strokeStyle = '#f59e0b';
				ctx.lineWidth = 5;
				ctx.setLineDash([8, 6]);
				ctx.beginPath();
				ctx.arc(t.x, t.y, t.size * 0.7 + Math.sin(now / 200) * 4, 0, Math.PI * 2);
				ctx.stroke();
				ctx.setLineDash([]);
			}
			text(ctx, `You ${this.wins.you} – ${this.wins.me} Computer`, GAME_W - 20, 620, { size: 16, family: ROUND, color: '#fff', align: 'right' });
			this.drawFlash(ctx);
			return drawButtons(ctx, buttons, UI, this.hover);
		}

		// Seek & Find (and its pause / level-up / game-over screens).
		ctx.save();
		if (this.shake) ctx.translate((Math.random() - 0.5) * this.shake, 0);
		this.backdrop(ctx, this.scene);
		this.drawThings(ctx);
		ctx.restore();
		if (this.hint && now < this.hint.until) {
			ctx.strokeStyle = '#facc15';
			ctx.lineWidth = 6;
			ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 90);
			ctx.beginPath();
			ctx.arc(this.hint.x, this.hint.y, 120, 0, Math.PI * 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
		// The clue.
		if (this.clue) {
			panel(ctx, 20, 14, GAME_W - 110, 66, { fill: 'rgba(255,255,255,0.93)', border: SWATCH[this.clue.colour], width: 4, radius: 22 });
			const kind = this.clue.kind ? ` ${KIND_HINT[this.clue.kind]}` : '';
			ctx.save();
			ctx.font = `bold 23px ${ROUND}`;
			const lead = 'I spy with my little eye something ';
			const lw = ctx.measureText(lead).width;
			const cw = ctx.measureText(this.clue.colour.toUpperCase()).width;
			const kw = ctx.measureText(kind).width;
			let x = 20 + (GAME_W - 110) / 2 - (lw + cw + kw) / 2;
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#134e4a';
			ctx.fillText(lead, x, 47);
			x += lw;
			ctx.fillStyle = this.clue.colour == 'white' ? '#64748b' : SWATCH[this.clue.colour];
			ctx.fillText(this.clue.colour.toUpperCase(), x, 47);
			x += cw;
			ctx.fillStyle = '#134e4a';
			ctx.fillText(kind, x, 47);
			ctx.restore();
		}
		// Score, time, progress.
		panel(ctx, 20, 92, 520, 44, { fill: 'rgba(15,23,42,0.75)', radius: 14 });
		const low = this.time <= 10;
		text(ctx, `⏱ ${Math.ceil(this.time)}s`, 40, 114, { size: 20, family: ROUND, color: low ? '#f87171' : '#fff' });
		text(ctx, `Score ${this.score}`, 150, 114, { size: 20, family: ROUND, color: '#fff' });
		text(ctx, `Level ${this.level}`, 310, 114, { size: 20, family: ROUND, color: '#fff' });
		text(ctx, `Found ${this.found}/${this.goal}`, 420, 114, { size: 20, family: ROUND, color: '#5eead4' });
		this.drawFlash(ctx);

		if (this.screen == 'levelUp') {
			ctx.fillStyle = 'rgba(15,23,42,0.45)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			text(ctx, `Level ${this.level} clear!`, cx, 300, { size: 52, family: ROUND, color: '#fff', align: 'center' });
			text(ctx, 'Time bonus added', cx, 356, { size: 22, family: ROUND, color: '#5eead4', align: 'center' });
		}
		if (this.screen == 'paused') {
			ctx.fillStyle = 'rgba(15,23,42,0.6)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			text(ctx, 'Paused', cx, 220, { size: 48, family: ROUND, color: '#fff', align: 'center' });
			if (!touchScreen()) text(ctx, 'Enter to resume', cx, 440, { size: 16, family: ROUND, color: 'rgba(255,255,255,0.8)', align: 'center', bold: false });
		}
		if (this.screen == 'over') {
			drawGameOver(ctx, {
				width: GAME_W, height: GAME_H, y: this.goy, landed: this.goy >= 260, title: "TIME'S UP!", color: '#2dd4bf',
				lines: [`SCORE ${this.score}`, `LEVEL ${this.level} · BEST ${this.best}`, ' ']
			});
		}
		drawButtons(ctx, buttons, UI, this.hover);
	}

	private drawFlash(ctx: CanvasRenderingContext2D) {
		const f = this.flash;
		if (!f || this.now - f.at > 1100) return;
		const k = (this.now - f.at) / 1100;
		ctx.globalAlpha = 1 - k;
		text(ctx, f.text, Math.max(160, Math.min(GAME_W - 160, f.x)), f.y - 40 - k * 30, { size: 22, family: ROUND, color: f.color, align: 'center' });
		ctx.globalAlpha = 1;
	}
}

export function create() {
	return new ISpy();
}

