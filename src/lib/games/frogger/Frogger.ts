// Frogger: Edward's Grade 10 pygame game (FroggerV15), rebuilt in TypeScript for the browser,
// with two modes:
//  - Classic (timed), the original: get the frog across a road of cars and a river of logs to
//    the five lily pads at the top before the timer runs out, with 3 lives; points for every
//    row forward and for each lily pad. Filling all five is a level up (faster), not the end.
//  - Endless, in the spirit of Crossy Road: hop forward as far as you can across randomly
//    generated grass, roads, railways and rivers.
// What's new:
//  - Endless mode is random: rows are generated as you go (cars and trucks, trains with a warning
//    light, rivers of moving logs or still lily pads, trees in the way), getting faster the
//    further you get. The camera creeps forward, so dawdling gets you caught by a heron.
//  - Chunky 3D "voxel" graphics: every car, log, train, tree and character is built from little
//    blocks drawn with a lit top and a shaded front; characters turn to face where they hop.
//  - Coins to pick up, spent on a gumball machine that rolls 10 swamp animals to play as
//    (and a rare hidden one).
//  - Global high scores (rows travelled), a soundtrack and sound effects.
import { ARIAL, ARIAL_BLACK, Gfx, drawRecord, loadSave, spotAt, writeSave, type ArcadeGame, type Board, type Hotspot } from '../common';

export const GAME_W = 520;
export const GAME_H = 560;
export const TICK_MS = 16;
const DT = TICK_MS / 1000;

const T = 40; // tile size in pixels
const Z = 30; // pixels per tile of height (how tall blocks look)
const HUD = 40;
const COLS = 13;
/** Rows on screen. */
const VISIBLE = 13;
const START_COL = 6;
const ROLL_COST = 10;
/** Chance (%) of the hidden character on a roll, while it's still to be found. */
const RARE_PCT = 3;
const SAVE_KEY = 'frogger-save';
/** Moving things live in [SPAN0, SPAN0 + SPAN) tiles and wrap around (wider than the screen). */
const SPAN0 = -5;
const SPAN = COLS + 10;
/** Global boards: 1 = Classic (points), 2 = Endless (rows). */
const BOARDS = { classic: 1, endless: 2 } as const;
type Mode = keyof typeof BOARDS;
// Classic mode's fixed board, bottom to top (world rows): start, 5 road lanes, a verge, 5 river
// lanes of logs and turtle rafts (the rafts dive from level 2), and the lily pads at the top.
const PADS = [1, 4, 6, 8, 11];
const HOME_ROW = 12;
const ATTEMPT_TIME = 30;
const CLASSIC: { kind: 'road' | 'river'; v?: string; turtles?: boolean; len: number; dir: 1 | -1; speed: number; count: number }[] = [
	{ kind: 'road', v: 'muscle', len: 1, dir: -1, speed: 1.6, count: 3 },
	{ kind: 'road', v: 'bus', len: 3, dir: 1, speed: 0.9, count: 2 },
	{ kind: 'road', v: 'car', len: 1, dir: -1, speed: 1.3, count: 3 },
	{ kind: 'road', v: 'sport', len: 1, dir: 1, speed: 2.4, count: 2 },
	{ kind: 'road', v: 'truck', len: 2, dir: -1, speed: 1.0, count: 2 },
	{ kind: 'river', len: 2, dir: 1, speed: 1.7, count: 3 },
	{ kind: 'river', turtles: true, len: 3, dir: -1, speed: 1.2, count: 3 },
	{ kind: 'river', len: 4, dir: 1, speed: 0.8, count: 2 },
	{ kind: 'river', turtles: true, len: 2, dir: -1, speed: 1.5, count: 4 },
	{ kind: 'river', len: 3, dir: 1, speed: 1.1, count: 3 }
];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <X>(xs: X[]): X => xs[Math.floor(Math.random() * xs.length)];

// ── Voxel drawing ────────────────────────────────────────────────────────────────────────
// A model is a list of boxes in tile units: (x, y) from the tile's top-left corner on the
// ground (y grows toward the viewer), z up from the ground; w × d footprint, h tall.
interface Box {
	x: number;
	y: number;
	z: number;
	w: number;
	d: number;
	h: number;
	c: string;
	a?: number;
}
type Model = Box[];
const bx = (x: number, y: number, z: number, w: number, d: number, h: number, c: string, a?: number): Box => ({ x, y, z, w, d, h, c, a });
/** Draw order: farther (smaller y) and lower first, so blocks in front and on top cover them. */
const model = (boxes: Box[]): Model => boxes.sort((p, q) => p.y + p.d + p.z - (q.y + q.d + q.z));

function shade(hex: string, f: number): string {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
	return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function drawModel(ctx: CanvasRenderingContext2D, m: Model, px: number, py: number, s = 1, alpha = 1, flatten = 1) {
	for (const b of m) {
		ctx.globalAlpha = alpha * (b.a ?? 1);
		const X = px + b.x * T * s;
		const W = b.w * T * s;
		const top = py + b.y * T * s - (b.z + b.h) * Z * s * flatten;
		ctx.fillStyle = shade(b.c, 1.14);
		ctx.fillRect(X, top, W, b.d * T * s);
		ctx.fillStyle = shade(b.c, 0.74);
		ctx.fillRect(X, py + (b.y + b.d) * T * s - (b.z + b.h) * Z * s * flatten, W, b.h * Z * s * flatten);
	}
	ctx.globalAlpha = 1;
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.28) {
	ctx.fillStyle = `rgba(0,0,0,${a})`;
	ctx.beginPath();
	ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();
}

// ── Characters: the frog, 10 swamp animals from the gumball machine, and one rare hidden one ─
function frogLike(body: string, dark: string, eye: string, pupil: string, extra: Box[] = [], wide = 0): Model {
	return model([
		bx(0.12 - wide / 2, 0.6, 0, 0.22, 0.26, 0.14, dark),
		bx(0.66 + wide / 2, 0.6, 0, 0.22, 0.26, 0.14, dark),
		bx(0.14 - wide / 2, 0.26, 0, 0.16, 0.16, 0.1, dark),
		bx(0.7 + wide / 2, 0.26, 0, 0.16, 0.16, 0.1, dark),
		bx(0.2 - wide / 2, 0.3, 0, 0.6 + wide, 0.5, 0.32, body),
		bx(0.26 - wide / 3, 0.16, 0.12, 0.48 + (wide * 2) / 3, 0.26, 0.28, body),
		bx(0.24 - wide / 2, 0.14, 0.38, 0.17, 0.15, 0.14, eye),
		bx(0.59 + wide / 2, 0.14, 0.38, 0.17, 0.15, 0.14, eye),
		bx(0.28 - wide / 2, 0.15, 0.52, 0.09, 0.08, 0.02, pupil),
		bx(0.63 + wide / 2, 0.15, 0.52, 0.09, 0.08, 0.02, pupil),
		...extra
	]);
}

export const CHARACTERS: { id: string; name: string; model: Model; rare?: boolean; flop?: boolean }[] = [
	{ id: 'frog', name: 'Frog', model: frogLike('#4cbb4c', '#2e8b2e', '#ffffff', '#111111') },
	{
		id: 'toad',
		name: 'Toad',
		model: frogLike('#9a7442', '#6e5230', '#e8a33a', '#111111', [bx(0.3, 0.42, 0.32, 0.1, 0.1, 0.03, '#5e4524'), bx(0.56, 0.54, 0.32, 0.1, 0.1, 0.03, '#5e4524'), bx(0.42, 0.66, 0.32, 0.08, 0.08, 0.03, '#5e4524')], 0.1)
	},
	{
		id: 'treefrog',
		name: 'Tree Frog',
		model: frogLike('#6ee04a', '#3fa82a', '#e23b3b', '#111111', [bx(0.1, 0.8, 0, 0.12, 0.08, 0.06, '#ff9a3c'), bx(0.78, 0.8, 0, 0.12, 0.08, 0.06, '#ff9a3c'), bx(0.12, 0.24, 0, 0.1, 0.06, 0.06, '#ff9a3c'), bx(0.78, 0.24, 0, 0.1, 0.06, 0.06, '#ff9a3c')])
	},
	{
		id: 'dartfrog',
		name: 'Poison Dart Frog',
		model: frogLike('#2f6fe0', '#1d48a0', '#111111', '#2f6fe0', [bx(0.3, 0.4, 0.32, 0.1, 0.1, 0.03, '#111111'), bx(0.58, 0.48, 0.32, 0.1, 0.1, 0.03, '#111111'), bx(0.4, 0.64, 0.32, 0.12, 0.08, 0.03, '#111111')])
	},
	{
		id: 'turtle',
		name: 'Turtle',
		model: model([
			bx(0.08, 0.22, 0, 0.14, 0.14, 0.1, '#c9b27a'),
			bx(0.78, 0.22, 0, 0.14, 0.14, 0.1, '#c9b27a'),
			bx(0.08, 0.66, 0, 0.14, 0.14, 0.1, '#c9b27a'),
			bx(0.78, 0.66, 0, 0.14, 0.14, 0.1, '#c9b27a'),
			bx(0.44, 0.82, 0, 0.12, 0.12, 0.08, '#c9b27a'),
			bx(0.38, 0.04, 0.06, 0.24, 0.2, 0.16, '#c9b27a'),
			bx(0.4, 0.05, 0.22, 0.06, 0.06, 0.02, '#111111'),
			bx(0.54, 0.05, 0.22, 0.06, 0.06, 0.02, '#111111'),
			bx(0.15, 0.2, 0.05, 0.7, 0.62, 0.18, '#3d7a3a'),
			bx(0.25, 0.28, 0.23, 0.5, 0.46, 0.12, '#4f9a48'),
			bx(0.4, 0.42, 0.35, 0.2, 0.18, 0.02, '#2f5e2c')
		])
	},
	{
		id: 'gator',
		name: 'Baby Alligator',
		model: model([
			bx(0.16, 0.24, 0, 0.14, 0.14, 0.08, '#2f5528'),
			bx(0.7, 0.24, 0, 0.14, 0.14, 0.08, '#2f5528'),
			bx(0.16, 0.66, 0, 0.14, 0.14, 0.08, '#2f5528'),
			bx(0.7, 0.66, 0, 0.14, 0.14, 0.08, '#2f5528'),
			bx(0.42, 0.85, 0, 0.16, 0.22, 0.12, '#3e6b35'),
			bx(0.3, 0.15, 0, 0.4, 0.75, 0.2, '#3e6b35'),
			bx(0.36, -0.16, 0, 0.28, 0.34, 0.14, '#4a7d3f'),
			bx(0.37, -0.17, 0.1, 0.26, 0.04, 0.03, '#ffffff'),
			bx(0.32, 0.12, 0.2, 0.1, 0.1, 0.08, '#f2d23c'),
			bx(0.58, 0.12, 0.2, 0.1, 0.1, 0.08, '#f2d23c'),
			bx(0.44, 0.35, 0.2, 0.12, 0.08, 0.05, '#2a4a24'),
			bx(0.44, 0.55, 0.2, 0.12, 0.08, 0.05, '#2a4a24')
		])
	},
	{
		id: 'duck',
		name: 'Mallard Duck',
		model: model([
			bx(0.36, 0.7, 0, 0.1, 0.1, 0.1, '#f2a134'),
			bx(0.54, 0.7, 0, 0.1, 0.1, 0.1, '#f2a134'),
			bx(0.22, 0.3, 0.08, 0.56, 0.55, 0.3, '#d9cfc0'),
			bx(0.18, 0.4, 0.18, 0.06, 0.35, 0.16, '#8a6a4a'),
			bx(0.76, 0.4, 0.18, 0.06, 0.35, 0.16, '#8a6a4a'),
			bx(0.4, 0.8, 0.3, 0.2, 0.1, 0.1, '#333333'),
			bx(0.32, 0.12, 0.32, 0.36, 0.3, 0.3, '#2e8b57'),
			bx(0.32, 0.4, 0.32, 0.36, 0.04, 0.06, '#ffffff'),
			bx(0.38, 0.0, 0.4, 0.24, 0.14, 0.08, '#f2b134'),
			bx(0.36, 0.13, 0.55, 0.06, 0.06, 0.02, '#111111'),
			bx(0.58, 0.13, 0.55, 0.06, 0.06, 0.02, '#111111')
		])
	},
	{
		id: 'heron',
		name: 'Great Blue Heron',
		model: model([
			bx(0.38, 0.5, 0, 0.06, 0.06, 0.35, '#d4b23c'),
			bx(0.56, 0.5, 0, 0.06, 0.06, 0.35, '#d4b23c'),
			bx(0.28, 0.35, 0.35, 0.44, 0.45, 0.28, '#8fa3b8'),
			bx(0.42, 0.22, 0.55, 0.16, 0.16, 0.35, '#c7d3df'),
			bx(0.38, 0.14, 0.85, 0.24, 0.22, 0.16, '#e8eef4'),
			bx(0.44, -0.12, 0.88, 0.1, 0.28, 0.06, '#f2c23c'),
			bx(0.4, 0.24, 1.0, 0.2, 0.06, 0.04, '#222222'),
			bx(0.4, 0.16, 1.0, 0.05, 0.05, 0.02, '#111111'),
			bx(0.55, 0.16, 1.0, 0.05, 0.05, 0.02, '#111111')
		])
	},
	{
		id: 'axolotl',
		name: 'Albino Axolotl',
		model: model([
			bx(0.24, 0.26, 0, 0.12, 0.1, 0.06, '#f7b8c9'),
			bx(0.64, 0.26, 0, 0.12, 0.1, 0.06, '#f7b8c9'),
			bx(0.24, 0.6, 0, 0.12, 0.1, 0.06, '#f7b8c9'),
			bx(0.64, 0.6, 0, 0.12, 0.1, 0.06, '#f7b8c9'),
			bx(0.42, 0.76, 0.02, 0.16, 0.32, 0.12, '#ffc2d4'),
			bx(0.46, 0.74, 0.14, 0.08, 0.34, 0.06, '#ffe6ee', 0.85),
			bx(0.32, 0.22, 0, 0.36, 0.58, 0.18, '#ffd6e0'),
			bx(0.26, 0.04, 0, 0.48, 0.26, 0.22, '#ffe2ea'),
			bx(0.12, 0.0, 0.14, 0.14, 0.06, 0.04, '#ff6f9f'),
			bx(0.1, 0.09, 0.16, 0.16, 0.06, 0.04, '#ff6f9f'),
			bx(0.12, 0.18, 0.14, 0.14, 0.06, 0.04, '#ff6f9f'),
			bx(0.74, 0.0, 0.14, 0.14, 0.06, 0.04, '#ff6f9f'),
			bx(0.74, 0.09, 0.16, 0.16, 0.06, 0.04, '#ff6f9f'),
			bx(0.74, 0.18, 0.14, 0.14, 0.06, 0.04, '#ff6f9f'),
			bx(0.33, 0.07, 0.22, 0.07, 0.07, 0.02, '#111111'),
			bx(0.6, 0.07, 0.22, 0.07, 0.07, 0.02, '#111111'),
			bx(0.42, 0.04, 0.12, 0.16, 0.02, 0.03, '#e88aa6')
		])
	},
	{
		id: 'newt',
		name: 'Salamander',
		model: model([
			bx(0.22, 0.25, 0, 0.14, 0.1, 0.06, '#e06010'),
			bx(0.64, 0.25, 0, 0.14, 0.1, 0.06, '#e06010'),
			bx(0.22, 0.62, 0, 0.14, 0.1, 0.06, '#e06010'),
			bx(0.64, 0.62, 0, 0.14, 0.1, 0.06, '#e06010'),
			bx(0.42, 0.8, 0, 0.16, 0.32, 0.1, '#ff7a1a'),
			bx(0.36, 0.2, 0, 0.28, 0.6, 0.14, '#ff7a1a'),
			bx(0.32, 0.04, 0, 0.36, 0.2, 0.16, '#ff8c33'),
			bx(0.35, 0.06, 0.16, 0.07, 0.07, 0.02, '#111111'),
			bx(0.58, 0.06, 0.16, 0.07, 0.07, 0.02, '#111111'),
			bx(0.4, 0.35, 0.14, 0.08, 0.08, 0.02, '#5a2a00'),
			bx(0.52, 0.5, 0.14, 0.08, 0.08, 0.02, '#5a2a00'),
			bx(0.42, 0.66, 0.14, 0.08, 0.08, 0.02, '#5a2a00')
		])
	},
	{
		id: 'dragonfly',
		name: 'Dragonfly',
		model: model([
			bx(0.45, 0.15, 0.4, 0.1, 0.72, 0.1, '#1fb5a8'),
			bx(0.4, 0.06, 0.38, 0.2, 0.16, 0.14, '#127a70'),
			bx(0.36, 0.04, 0.46, 0.1, 0.1, 0.1, '#3cd2ff'),
			bx(0.54, 0.04, 0.46, 0.1, 0.1, 0.1, '#3cd2ff'),
			bx(0.05, 0.26, 0.5, 0.4, 0.14, 0.02, '#cdefff', 0.75),
			bx(0.55, 0.26, 0.5, 0.4, 0.14, 0.02, '#cdefff', 0.75),
			bx(0.1, 0.44, 0.5, 0.35, 0.12, 0.02, '#cdefff', 0.75),
			bx(0.55, 0.44, 0.5, 0.35, 0.12, 0.02, '#cdefff', 0.75)
		])
	},
	{
		id: 'magikarp',
		name: 'Magikarp',
		rare: true,
		flop: true,
		// A chunky block fish on its belly, facing the camera: pink lips round a dark mouth,
		// eyes either side, yellow whiskers and fins, a white dorsal fin and a spreading tail.
		model: model([
			// Tail, spreading out behind.
			bx(0.18, -0.14, 0.14, 0.64, 0.12, 0.26, '#f2f2f2'),
			bx(0.3, -0.04, 0.1, 0.4, 0.24, 0.3, '#d6d6d6'),
			// Body, with darker stripes across its back.
			bx(0.2, 0.18, 0.04, 0.6, 0.6, 0.42, '#e8462a'),
			bx(0.2, 0.3, 0.46, 0.6, 0.05, 0.005, '#b9321c'),
			bx(0.2, 0.44, 0.46, 0.6, 0.05, 0.005, '#b9321c'),
			bx(0.2, 0.18, 0.04, 0.6, 0.1, 0.42, '#d33e24'),
			// White dorsal fin standing up, with grey ribs.
			bx(0.44, 0.24, 0.46, 0.12, 0.42, 0.24, '#ececec'),
			bx(0.44, 0.34, 0.7, 0.12, 0.04, 0.005, '#9a9a9a'),
			bx(0.44, 0.48, 0.7, 0.12, 0.04, 0.005, '#9a9a9a'),
			// Yellow side fins and whiskers.
			bx(0.08, 0.44, 0.06, 0.12, 0.2, 0.06, '#f2dd6b'),
			bx(0.8, 0.44, 0.06, 0.12, 0.2, 0.06, '#f2dd6b'),
			bx(0.02, 0.66, 0.3, 0.18, 0.04, 0.04, '#f2dd6b'),
			bx(0.8, 0.66, 0.3, 0.18, 0.04, 0.04, '#f2dd6b'),
			bx(0.04, 0.72, 0.18, 0.16, 0.04, 0.04, '#e8c94a'),
			bx(0.8, 0.72, 0.18, 0.16, 0.04, 0.04, '#e8c94a'),
			// Eyes on the front corners.
			bx(0.21, 0.76, 0.28, 0.14, 0.04, 0.14, '#ffffff'),
			bx(0.65, 0.76, 0.28, 0.14, 0.04, 0.14, '#ffffff'),
			bx(0.25, 0.8, 0.32, 0.06, 0.01, 0.06, '#111111'),
			bx(0.69, 0.8, 0.32, 0.06, 0.01, 0.06, '#111111'),
			// Big pink lips round a dark open mouth.
			bx(0.36, 0.78, 0.06, 0.28, 0.06, 0.26, '#f29a9a'),
			bx(0.42, 0.84, 0.12, 0.16, 0.01, 0.14, '#3a1212')
		])
	}
];
const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

type Facing = 'up' | 'down' | 'left' | 'right';
const turned = new Map<string, Model>();
/** A character's model turned to face a direction (built facing up; rotated about the tile's centre). */
function facingModel(ch: (typeof CHARACTERS)[number], facing: Facing): Model {
	if (facing === 'up' || ch.flop) return ch.model;
	const key = ch.id + facing;
	let m = turned.get(key);
	if (!m) {
		m = model(
			ch.model.map((b) =>
				facing === 'down'
					? { ...b, x: 1 - (b.x + b.w), y: 1 - (b.y + b.d) }
					: facing === 'right'
						? { ...b, x: 1 - (b.y + b.d), y: b.x, w: b.d, d: b.w }
						: { ...b, x: b.y, y: 1 - (b.x + b.w), w: b.d, d: b.w }
			)
		);
		turned.set(key, m);
	}
	return m;
}

/** Draw a character facing a way (toward the viewer by default); Magikarp flops about (bounces, tips side to side, flips over) instead of standing. */
function drawCharacter(
	ctx: CanvasRenderingContext2D,
	ch: (typeof CHARACTERS)[number],
	px: number,
	py: number,
	time: number,
	s = 1,
	alpha = 1,
	flatten = 1,
	facing: Facing = 'down'
) {
	if (!ch.flop) return drawModel(ctx, facingModel(ch, facing), px, py, s, alpha, flatten);
	const beat = time / 0.35;
	const k = beat % 1;
	const cx = px + (T * s) / 2;
	const cy = py + T * s * 0.6;
	ctx.save();
	ctx.translate(cx, cy - Math.sin(k * Math.PI) * 7 * s);
	ctx.rotate(Math.sin(k * Math.PI * 2) * 0.22);
	ctx.scale(Math.floor(beat) % 2 ? -1 : 1, 1);
	ctx.translate(-cx, -cy);
	drawModel(ctx, ch.model, px, py, s, alpha, flatten);
	ctx.restore();
}

/**
 * The gumball odds: every roll gives a character you don't have yet. The hidden one has a fixed
 * RARE_PCT chance; the others share the rest equally. Once it's the only one left, it's certain.
 */
function gumballOdds(owned: string[]): { id: string; name: string; pct: number; rare: boolean }[] {
	const left = CHARACTERS.filter((c) => !owned.includes(c.id));
	const rare = left.filter((c) => c.rare);
	const normal = left.filter((c) => !c.rare);
	const rarePct = normal.length ? RARE_PCT : 100 / Math.max(1, rare.length);
	const normalPct = normal.length ? (100 - rarePct * rare.length) / normal.length : 0;
	return [...normal, ...rare].map((c) => ({ id: c.id, name: c.name, pct: c.rare ? rarePct : normalPct, rare: !!c.rare }));
}

// ── Vehicles and logs ──────────────────────────────────────────────────────
function vehicle(kind: string, len: number, color: string, dir: number): Model {
	const front = dir > 0 ? len - 0.12 : 0.04;
	const boxes: Box[] = [
		bx(0.18, 0.74, 0, 0.22, 0.12, 0.14, '#111111'),
		bx(len - 0.4, 0.74, 0, 0.22, 0.12, 0.14, '#111111'),
		bx(0.18, 0.14, 0, 0.22, 0.12, 0.14, '#111111'),
		bx(len - 0.4, 0.14, 0, 0.22, 0.12, 0.14, '#111111')
	];
	if (kind === 'truck') {
		const cab = dir > 0 ? len - 0.7 : 0.05;
		const box = dir > 0 ? 0.05 : 0.75;
		boxes.push(bx(box, 0.16, 0.08, len - 0.8, 0.68, 0.62, '#e8e8e8'));
		boxes.push(bx(cab, 0.2, 0.08, 0.65, 0.6, 0.42, color));
		boxes.push(bx(cab + (dir > 0 ? 0.35 : 0.05), 0.24, 0.5, 0.25, 0.52, 0.08, '#9ed6ff'));
	} else if (kind === 'bus') {
		boxes.push(bx(0.05, 0.16, 0.08, len - 0.1, 0.68, 0.55, '#f2c12e'));
		for (let i = 0.3; i < len - 0.3; i += 0.45) boxes.push(bx(i, 0.84, 0.35, 0.3, 0.001, 0.16, '#9ed6ff'));
		boxes.push(bx(0.05, 0.16, 0.63, len - 0.1, 0.68, 0.03, '#e0ac1a'));
	} else {
		boxes.push(bx(0.05, 0.2, 0.08, len - 0.1, 0.6, 0.26, color));
		boxes.push(bx(len * 0.28, 0.26, 0.34, len * 0.44, 0.48, 0.18, '#9ed6ff'));
		boxes.push(bx(len * 0.3, 0.28, 0.52, len * 0.4, 0.44, 0.04, color));
		if (kind === 'muscle') {
			boxes.push(bx(0.05, 0.44, 0.341, len - 0.1, 0.06, 0.005, '#111111'));
			boxes.push(bx(0.05, 0.52, 0.341, len - 0.1, 0.06, 0.005, '#111111'));
		}
	}
	boxes.push(bx(front, 0.24, 0.16, 0.08, 0.12, 0.08, '#fff3a0'));
	boxes.push(bx(front, 0.64, 0.16, 0.08, 0.12, 0.08, '#fff3a0'));
	return model(boxes);
}

function logModel(len: number): Model {
	return model([
		bx(0, 0.18, 0, len, 0.64, 0.3, '#8b5a2b'),
		bx(0.1, 0.3, 0.3, len - 0.2, 0.08, 0.01, '#a8743f'),
		bx(0.1, 0.6, 0.3, len - 0.2, 0.06, 0.01, '#6e4520'),
		bx(0, 0.18, 0, 0.08, 0.64, 0.3, '#d9b07a'),
		bx(len - 0.08, 0.18, 0, 0.08, 0.64, 0.3, '#d9b07a')
	]);
}
/** Classic's turtle rafts: a row of these, swimming along (one raft per lane dives now and then). */
const TURTLE = model([
	bx(0.38, 0.06, 0, 0.24, 0.18, 0.12, '#c9b27a'),
	bx(0.1, 0.2, 0, 0.8, 0.62, 0.16, '#3d7a3a'),
	bx(0.2, 0.28, 0.16, 0.6, 0.46, 0.1, '#4f9a48'),
	bx(0.4, 0.4, 0.26, 0.2, 0.2, 0.02, '#2f5e2c')
]);

// ── Scenery and trains ─────────────────────────────────────────────────────────────────
const SCENERY: Model[] = [
	model([bx(0.42, 0.42, 0, 0.16, 0.16, 0.3, '#7a4a20'), bx(0.16, 0.14, 0.3, 0.68, 0.68, 0.55, '#3f9a3a'), bx(0.26, 0.24, 0.85, 0.48, 0.48, 0.25, '#56b84c')]),
	model([bx(0.44, 0.44, 0, 0.12, 0.12, 0.25, '#7a4a20'), bx(0.24, 0.24, 0.25, 0.52, 0.52, 0.9, '#2f7d32'), bx(0.32, 0.32, 1.15, 0.36, 0.36, 0.3, '#3f9a3a')]),
	model([bx(0.16, 0.26, 0, 0.68, 0.56, 0.32, '#9aa0a6'), bx(0.26, 0.34, 0.32, 0.4, 0.34, 0.12, '#b5bbc1')]),
	model([bx(0.12, 0.3, 0, 0.76, 0.52, 0.34, '#4caf50'), bx(0.24, 0.36, 0.34, 0.4, 0.3, 0.12, '#66c66a')])
];

function trainModel(len: number, dir: number): Model {
	const boxes: Box[] = [bx(0, 0.18, 0.06, len, 0.64, 0.56, '#2f6fe0'), bx(0, 0.18, 0.62, len, 0.64, 0.06, '#5a8ef0')];
	for (let k = 3; k < len; k += 3) boxes.push(bx(k, 0.18, 0.06, 0.08, 0.64, 0.56, '#1b3f8a'));
	for (let k = 0.3; k < len - 0.4; k += 0.75) boxes.push(bx(k, 0.82, 0.36, 0.45, 0.001, 0.16, '#cfe9ff'));
	const nose = dir > 0 ? len - 0.9 : 0;
	boxes.push(bx(nose, 0.16, 0.06, 0.9, 0.68, 0.6, '#e23b3b'));
	boxes.push(bx(dir > 0 ? len - 0.1 : 0, 0.3, 0.26, 0.1, 0.4, 0.14, '#fff3a0'));
	return model(boxes);
}

// ── The endless world: rows generated as you go ─────────────────────────────────────────
type RowKind = 'grass' | 'road' | 'rail' | 'river' | 'home';
interface Item {
	x: number;
	len: number;
	m: Model;
}
interface Train {
	x: number;
	/** Seconds until it comes (≤ 0: passing now). */
	wait: number;
	warned: boolean;
	len: number;
	m: Model;
}
interface Row {
	kind: RowKind;
	dir: 1 | -1;
	speed: number;
	/** Classic mode: the lane's speed at level 1 (it speeds up with each level). */
	base?: number;
	/** Classic: a lane of turtle rafts; its first raft dives now and then from level 2 (phase offset). */
	dive?: number;
	/** Vehicles (road) or logs (river). */
	items: Item[];
	/** Grass: columns blocked by trees or rocks. */
	trees: Map<number, Model>;
	/** River: still lily pads (a lily-pad river has no logs). */
	pads: Set<number>;
	coin: number | null;
	train?: Train;
}
const CAR_COLORS = ['#e23b3b', '#2f6fe0', '#f28c28', '#e8e8e8', '#7b3fe0', '#f2c12e', '#2fbf71'];
const VEHICLES: [string, number][] = [
	['car', 1],
	['sport', 1],
	['muscle', 1],
	['truck', 2],
	['bus', 3]
];

type State = 'menu' | 'play' | 'paused' | 'over' | 'gumball' | 'scores' | 'controls';
interface Hop {
	fx: number;
	fr: number;
	tx: number;
	tr: number;
	t: number;
}

export class Frogger implements ArcadeGame {
	state: State = 'menu';
	mode: Mode = 'endless';
	rows = new Map<number, Row>();
	/** Bottom row on screen (fractional: the camera glides). */
	cam = 0;
	// Frog
	x = START_COL;
	row = 1;
	facing: Facing = 'up';
	hop: Hop | null = null;
	dying: { t: number; kind: 'splash' | 'squash' | 'caught' } | null = null;
	moved = false;
	// Run
	score = 0;
	runCoins = 0;
	// Classic mode
	level = 1;
	lives = 3;
	timer = ATTEMPT_TIME;
	maxRow = 0;
	filled = new Set<number>();
	coinTimer = 4;
	banner: { text: string; t: number } | null = null;
	// Saved: best Endless run (rows) and best Classic score (points)
	best = 0;
	bestClassic = 0;
	games = 0;
	coins = 0;
	owned: string[] = ['frog'];
	selected = 'frog';
	// Gumball machine
	roll: { t: number; prize: string; color: string } | null = null;
	crank = 0;
	showOdds = false;

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	sfx: (name: string) => void = () => {};
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();
	private hover = -1;
	private time = 0;
	private planKind: RowKind = 'grass';
	private planLeft = 0;
	private genTo = -1;

	constructor() {
		this.mode = 'endless';
		// `best2`: the endless game's best (the old lily-pad game's points aren't comparable).
		const saved = loadSave(SAVE_KEY, { best: 0, best2: 0, games: 0, coins: 0, owned: ['frog'], selected: 'frog' });
		this.best = saved.best2;
		this.bestClassic = saved.best;
		this.games = saved.games;
		this.coins = saved.coins;
		this.owned = saved.owned.map((id) => (id === 'beaver' ? 'axolotl' : id));
		this.selected = saved.selected === 'beaver' ? 'axolotl' : saved.selected;
		if (!this.owned.includes(this.selected)) this.selected = 'frog';
		this.resetWorld();
	}

	save() {
		const { games, coins, owned, selected } = this;
		writeSave(SAVE_KEY, { best: this.bestClassic, best2: this.best, games, coins, owned, selected });
	}

	/** Tap / swipe to hop, on touch screens, while playing (menus are tapped as usual). */
	gestures() {
		return this.state === 'play';
	}

	musicTrack() {
		if (this.state === 'play' || this.state === 'paused') {
			const tier = this.mode === 'classic' ? Math.ceil(this.level / 2) : 1 + Math.floor(this.score / 50);
			return 'frogger-play-' + Math.min(3, tier);
		}
		if (this.state === 'over') return null;
		return 'frogger-menu';
	}

	leave() {
		if (this.state === 'play' || this.state === 'paused') this.record();
		if (this.state === 'play') this.state = 'paused';
		this.save();
	}

	/** Count this run: the mode's best, and its global board. */
	private record() {
		if (this.score <= 0) return;
		if (this.mode === 'classic') this.bestClassic = Math.max(this.bestClassic, this.score);
		else this.best = Math.max(this.best, this.score);
		this.onScore(BOARDS[this.mode], this.score);
	}

	// ── World generation ──
	private resetWorld() {
		this.rows.clear();
		this.planLeft = 0;
		this.genTo = -1;
		this.cam = 0;
		this.hop = null;
		this.dying = null;
		this.moved = false;
		if (this.mode === 'classic') this.buildClassic();
		else this.ensureRows();
		this.respawn();
	}

	/** Back to the start (a new run, or Classic's next life / next lily pad). */
	private respawn() {
		this.x = START_COL;
		this.row = this.mode === 'classic' ? 0 : 1;
		this.facing = 'up';
		this.hop = null;
		this.dying = null;
		this.timer = ATTEMPT_TIME;
		this.maxRow = this.row;
	}

	/** Classic mode's fixed board (see CLASSIC). */
	private buildClassic() {
		const grass = (): Row => ({ kind: 'grass', dir: 1, speed: 0, items: [], trees: new Map(), pads: new Set(), coin: null });
		this.rows.set(0, grass());
		CLASSIC.forEach((l, k) => {
			const items: Item[] = [];
			const color = pick(CAR_COLORS);
			for (let n = 0; n < l.count; n++) {
				const x = SPAN0 + (n * SPAN) / l.count + rand(0, 1);
				const m = l.turtles ? TURTLE : l.kind === 'river' ? logModel(l.len) : vehicle(l.v!, l.len, l.v === 'muscle' ? '#f2a020' : CAR_COLORS[(k + n * 2) % CAR_COLORS.length] ?? color, l.dir);
				items.push({ x, len: l.len, m });
			}
			const row: Row = { kind: l.kind, dir: l.dir, speed: l.speed, base: l.speed, items, trees: new Map(), pads: new Set(), coin: null };
			if (l.turtles) row.dive = k * 1.7;
			this.rows.set(k < 5 ? k + 1 : k + 2, row);
		});
		this.rows.set(6, grass());
		this.rows.set(HOME_ROW, { kind: 'home', dir: 1, speed: 0, items: [], trees: new Map(), pads: new Set(PADS), coin: null });
	}

	/** Endless mode: generate rows ahead of the camera; forget the ones far behind. */
	private ensureRows() {
		if (this.mode === 'classic') return;
		while (this.genTo < this.cam + VISIBLE + 4) {
			this.genTo++;
			this.rows.set(this.genTo, this.makeRow(this.genTo));
		}
		for (const i of this.rows.keys()) if (i < this.cam - 3) this.rows.delete(i);
	}

	private makeRow(i: number): Row {
		const prev = this.rows.get(i - 1);
		// Harder the further you get.
		const d = 1 + Math.min(1.2, i / 160);
		const row: Row = { kind: 'grass', dir: Math.random() < 0.5 ? 1 : -1, speed: 0, items: [], trees: new Map(), pads: new Set(), coin: null };
		if (i < 4) {
			// A safe meadow to start on, with a few trees at the sides.
			for (const c of [0, 1, 11, 12]) if (Math.random() < 0.6) row.trees.set(c, pick(SCENERY));
			return row;
		}
		if (this.planLeft <= 0) {
			const r = Math.random();
			this.planKind = r < 0.28 ? 'grass' : r < 0.62 ? 'road' : r < 0.84 ? 'river' : 'rail';
			if (this.planKind === prev?.kind) this.planKind = prev.kind === 'grass' ? 'road' : 'grass';
			this.planLeft = { grass: randInt(1, 2), road: randInt(1, 4), river: randInt(1, 3), rail: randInt(1, 2) }[this.planKind];
		}
		this.planLeft--;
		row.kind = this.planKind;

		if (row.kind === 'grass') {
			// Trees and rocks in the way, never too many; lily pads coming out of a river stay open.
			const n = randInt(0, 4);
			for (let k = 0; k < n; k++) {
				const c = randInt(0, COLS - 1);
				if (!prev?.pads.has(c)) row.trees.set(c, pick(SCENERY));
			}
		} else if (row.kind === 'road') {
			const [kind, len] = pick(VEHICLES);
			row.speed = rand(1.0, 2.6) * d * (len === 1 ? 1.15 : 0.8);
			const color = pick(CAR_COLORS);
			let x = SPAN0 + rand(0, 3);
			while (x < SPAN0 + SPAN - len) {
				row.items.push({ x, len, m: vehicle(kind, len, kind === 'muscle' ? '#f2a020' : color, row.dir) });
				x += len + randInt(3, 6) + rand(0, 1.5);
			}
		} else if (row.kind === 'river') {
			const afterPads = prev?.kind === 'river' && prev.pads.size > 0;
			if (Math.random() < (afterPads ? 0.55 : 0.35)) {
				// Still lily pads: always one lined up with the row before, so it can be crossed.
				if (afterPads) row.pads.add(pick([...prev!.pads]));
				const n = randInt(3, 6);
				while (row.pads.size < n) row.pads.add(randInt(0, COLS - 1));
			} else {
				if (prev?.kind === 'river' && !prev.pads.size) row.dir = prev.dir === 1 ? -1 : 1;
				row.speed = rand(0.9, 2.0) * d;
				let x = SPAN0 + rand(0, 2);
				while (x < SPAN0 + SPAN - 2) {
					const len = randInt(2, 4);
					row.items.push({ x, len, m: logModel(len) });
					x += len + randInt(2, 4);
				}
			}
		} else {
			const len = randInt(8, 12);
			row.train = { x: row.dir > 0 ? SPAN0 - len : SPAN0 + SPAN, wait: rand(1.5, 6), warned: false, len, m: trainModel(len, row.dir) };
		}
		if ((row.kind === 'grass' || row.kind === 'road') && Math.random() < 0.16) {
			const c = randInt(0, COLS - 1);
			if (!row.trees.has(c)) row.coin = c;
		}
		return row;
	}

	// ── Starting and ending ──
	private newGame(mode: Mode = this.mode) {
		this.mode = mode;
		this.score = 0;
		this.runCoins = 0;
		this.level = 1;
		this.lives = 3;
		this.filled.clear();
		this.coinTimer = 4;
		this.resetWorld();
		this.games++;
		this.state = 'play';
		this.banner = { text: 'GO!', t: 1 };
		this.save();
	}
	private die(kind: 'splash' | 'squash' | 'caught') {
		if (this.dying) return;
		this.dying = { t: 0, kind };
		this.hop = null;
		this.sfx(kind);
	}
	private gameOver() {
		this.state = 'over';
		this.record();
		this.sfx('lose');
		this.save();
	}

	/** Classic: a lily pad reached (all five = level up, everything faster). */
	private reachHome(col: number) {
		this.filled.add(col);
		this.score += 200 + Math.ceil(this.timer) * 10;
		this.sfx('home');
		if (this.filled.size === PADS.length) {
			this.level++;
			this.score += 1000;
			this.filled.clear();
			const mult = Math.min(2.2, 1 + 0.15 * (this.level - 1));
			for (const r of this.rows.values()) if (r.base) r.speed = r.base * mult;
			this.banner = { text: `LEVEL ${this.level}!`, t: 1.6 };
			this.sfx('levelUp');
		}
		this.respawn();
	}

	// ── Keyboard: WASD (or arrows) to hop, Enter to pause ──
	keyPressed(code: string): boolean {
		const dirs: Record<string, [number, number, Facing]> = {
			KeyW: [0, 1, 'up'],
			ArrowUp: [0, 1, 'up'],
			KeyS: [0, -1, 'down'],
			ArrowDown: [0, -1, 'down'],
			KeyA: [-1, 0, 'left'],
			ArrowLeft: [-1, 0, 'left'],
			KeyD: [1, 0, 'right'],
			ArrowRight: [1, 0, 'right']
		};
		const enter = code === 'Enter' || code === 'NumpadEnter';
		if (!dirs[code] && !enter && code !== 'Space') return false;
		if (this.state === 'play' && enter) {
			this.state = 'paused';
			this.sfx('select');
		} else if (this.state === 'paused' && (enter || dirs[code])) {
			this.state = 'play';
		} else if (this.state === 'over' && (enter || code === 'Space')) {
			this.newGame();
		} else if (this.state === 'menu' && enter) {
			this.newGame('endless');
		} else if (this.state === 'play' && dirs[code]) {
			const [dx, dr, face] = dirs[code];
			this.tryHop(dx, dr, face);
		}
		return true;
	}
	keyReleased(code: string): boolean {
		return /^(Key[WASD]|Arrow|Enter|Space)/.test(code);
	}

	private isLogs(r?: Row) {
		return r?.kind === 'river' && r.pads.size === 0;
	}

	private tryHop(dx: number, dr: number, face: Facing) {
		if (this.hop || this.dying) return;
		this.facing = face;
		const tr = this.row + dr;
		const target = this.rows.get(tr);
		if (tr < 0 || !target) return;
		let tx = this.x + dx;
		if (!this.isLogs(this.rows.get(this.row)) && (tx < 0 || tx > COLS - 1)) return;
		if (!this.isLogs(target)) tx = Math.round(tx);
		// A tree or rock in the way: just turn to face it.
		if (target.kind === 'grass' && target.trees.has(tx)) return;
		this.hop = { fx: this.x, fr: this.row, tx, tr, t: 0 };
		this.moved = true;
		this.sfx('hop');
	}

	private land() {
		const h = this.hop!;
		this.hop = null;
		this.x = h.tx;
		this.row = h.tr;
		if (this.mode === 'endless') this.score = Math.max(this.score, this.row - 1);
		else if (this.row > this.maxRow) {
			this.maxRow = this.row;
			this.score += 10;
		}
		const r = this.rows.get(this.row)!;
		if (r.kind === 'home') {
			const col = Math.round(this.x);
			if (PADS.includes(col) && !this.filled.has(col)) this.reachHome(col);
			else this.die('splash');
			return;
		}
		if (r.kind === 'river') {
			if (r.pads.size) {
				if (!r.pads.has(Math.round(this.x))) return this.die('splash');
			} else if (!this.log(r)) return this.die('splash');
		}
		if (r.coin !== null && r.coin === Math.round(this.x)) {
			r.coin = null;
			this.coins++;
			this.runCoins++;
			if (this.mode === 'classic') this.score += 25;
			this.sfx('coin');
			this.save();
		}
	}

	/** The log (or surfaced turtle raft) under the frog, if any. */
	private log(r: Row): Item | undefined {
		const cx = this.x + 0.5;
		return r.items.find((it, i) => cx >= it.x && cx <= it.x + it.len && !(i === 0 && this.diveDepth(r) > 0.7));
	}

	/** Classic's diving rafts: 0 = surfaced, 1 = fully under (only each turtle lane's first raft dives). */
	private diveDepth(r: Row): number {
		if (this.mode !== 'classic' || this.level < 2 || r.dive === undefined) return 0;
		const p = (this.time + r.dive) % 6;
		if (p < 3.5) return 0;
		if (p < 4.2) return (p - 3.5) / 0.7;
		if (p < 5.3) return 1;
		return 1 - (p - 5.3) / 0.7;
	}

	// ── Game loop ──
	tick() {
		this.time += DT;
		if (this.banner && (this.banner.t -= DT) <= 0) this.banner = null;
		if (this.roll) this.tickRoll();
		if (this.state === 'paused' || this.state === 'over') return;
		this.ensureRows();
		this.moveWorld();
		if (this.state !== 'play') return;

		if (this.dying) {
			this.dying.t += DT;
			if (this.dying.t > 1.1) {
				if (this.mode === 'classic' && --this.lives > 0) this.respawn();
				else this.gameOver();
			}
			return;
		}
		if (this.hop) {
			this.hop.t += DT / 0.12;
			if (this.hop.t >= 1) this.land();
		} else {
			const r = this.rows.get(this.row);
			// Riding a log; carried off the edge = lost in the river.
			if (r && this.isLogs(r)) {
				if (!this.log(r)) this.die('splash');
				else {
					this.x += r.dir * r.speed * DT;
					if (this.x + 0.5 < 0 || this.x + 0.5 > COLS) this.die('splash');
				}
			}
			if (r?.kind === 'road' && r.items.some((it) => this.x + 0.78 > it.x + 0.08 && this.x + 0.22 < it.x + it.len - 0.08)) this.die('squash');
			const tr = r?.train;
			if (tr && tr.wait <= 0 && this.x + 0.8 > tr.x && this.x + 0.2 < tr.x + tr.len) this.die('squash');
		}
		if (this.mode === 'classic') {
			// Classic: beat the clock; coins pop up on the road and the verge now and then.
			this.timer -= DT;
			if (this.timer <= 0 && !this.dying) this.die('squash');
			if ((this.coinTimer -= DT) <= 0) {
				this.coinTimer = 5 + Math.random() * 4;
				for (const r of this.rows.values()) r.coin = null;
				const r = this.rows.get(randInt(1, 6));
				if (r) r.coin = randInt(0, COLS - 1);
			}
			return;
		}
		// The camera keeps up with the frog, and creeps forward on its own once you've set off:
		// fall off the bottom of the screen and a heron gets you.
		const target = this.row - 3;
		if (target > this.cam) this.cam += Math.min(target - this.cam, 6 * DT);
		if (this.moved && !this.dying) this.cam += Math.min(0.32, 0.1 + this.score / 600) * DT;
		if (!this.dying && !this.hop && this.row < this.cam - 0.6) this.die('caught');
	}

	private moveWorld() {
		for (const [i, r] of this.rows) {
			for (const it of r.items) {
				it.x += r.dir * r.speed * DT;
				if (r.dir > 0 && it.x > SPAN0 + SPAN) it.x -= SPAN;
				if (r.dir < 0 && it.x + it.len < SPAN0) it.x += SPAN;
			}
			const tr = r.train;
			if (!tr) continue;
			const onScreen = this.state === 'play' && i >= this.cam - 1 && i <= this.cam + VISIBLE;
			tr.wait -= DT;
			if (tr.wait < 1.3 && !tr.warned) {
				tr.warned = true;
				if (onScreen) this.sfx('bell');
			}
			if (tr.wait <= 0) {
				if (tr.x === (r.dir > 0 ? SPAN0 - tr.len : SPAN0 + SPAN) && onScreen) this.sfx('train');
				tr.x += r.dir * 22 * DT;
				if ((r.dir > 0 && tr.x > SPAN0 + SPAN) || (r.dir < 0 && tr.x + tr.len < SPAN0)) {
					tr.x = r.dir > 0 ? SPAN0 - tr.len : SPAN0 + SPAN;
					tr.wait = rand(3, 7);
					tr.warned = false;
				}
			}
		}
	}

	// ── Gumball machine ──
	private rollGumball() {
		const odds = gumballOdds(this.owned);
		if (this.roll || this.coins < ROLL_COST || !odds.length) return;
		let pick = Math.random() * 100;
		const prize = (odds.find((o) => (pick -= o.pct) < 0) ?? odds[odds.length - 1]).id;
		this.coins -= ROLL_COST;
		const colors = ['#ff5a7a', '#5ac8ff', '#ffd23f', '#7bdc6b', '#c88bff', '#ff9a3c'];
		this.roll = { t: 0, prize, color: colors[Math.floor(Math.random() * colors.length)] };
		this.sfx('crank');
		this.save();
	}
	private tickRoll() {
		const r = this.roll!;
		const before = r.t;
		r.t += DT;
		if (r.t < 0.9) this.crank += DT * 7;
		if (before < 1.6 && r.t >= 1.6) {
			this.owned.push(r.prize);
			this.selected = r.prize;
			this.sfx('prize');
			this.save();
		}
		if (r.t > 4.5) this.roll = null;
	}

	// ── Mouse ──
	private spots(): Hotspot[] {
		const btn = (i: number, x: number, y: number, w: number, h: number, click: () => void): Hotspot => ({
			x, y, w, h,
			hover: () => (this.hover = i),
			click: () => {
				this.sfx('confirm');
				click();
			}
		});
		switch (this.state) {
			case 'menu':
				return MENU.map((m, i) => btn(i, 140, 262 + i * 48, 240, 40, () => this.menuAction(m.id)));
			case 'gumball': {
				// The odds pop-up: a click anywhere closes it.
				if (this.showOdds) return [btn(50, 0, 0, GAME_W, GAME_H, () => (this.showOdds = false))];
				const s: Hotspot[] = [
					btn(0, 12, 50, 92, 32, () => (this.state = 'menu')),
					btn(1, 300, 330, 196, 46, () => this.rollGumball()),
					btn(2, 340, 410, 116, 28, () => (this.showOdds = true))
				];
				CHARACTERS.forEach((c, i) => {
					if (this.owned.includes(c.id))
						s.push(btn(10 + i, slotX(i), 478, SLOT_W, 56, () => ((this.selected = c.id), this.save())));
				});
				return s;
			}
			case 'scores':
			case 'controls':
				return [btn(0, 12, 50, 92, 32, () => (this.state = 'menu'))];
			case 'paused':
				return [btn(0, 140, 290, 240, 42, () => (this.state = 'play')), btn(1, 140, 342, 240, 42, () => this.quitRun())];
			case 'over':
				return [btn(0, 140, 330, 240, 42, () => this.newGame(this.mode)), btn(1, 140, 382, 240, 42, () => (this.state = 'menu'))];
		}
		return [];
	}
	private quitRun() {
		this.record();
		this.state = 'menu';
		this.save();
	}
	private menuAction(id: string) {
		if (id === 'classic' || id === 'endless') this.newGame(id);
		else if (id === 'quit') {
			this.save();
			this.onQuit();
		} else this.state = id as State;
	}
	pointerMove(x: number, y: number) {
		this.hover = -1;
		const s = spotAt(this.spots(), x, y);
		s?.hover?.();
		return !!s;
	}
	pointerDown(x: number, y: number) {
		spotAt(this.spots(), x, y)?.click();
	}

	// ── Drawing ──
	paint(ctx: CanvasRenderingContext2D, now: number) {
		const g = this.g;
		g.begin(ctx);
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, GAME_W, GAME_H);
		ctx.clip();
		this.drawBoard(ctx, now);
		if (this.state !== 'play') {
			ctx.fillStyle = this.state === 'paused' || this.state === 'over' ? 'rgba(4,20,12,0.55)' : 'rgba(4,20,12,0.6)';
			ctx.fillRect(0, HUD, GAME_W, GAME_H - HUD);
		}
		this.drawHud(ctx);
		if (this.state === 'menu') this.drawMenu(ctx, now);
		if (this.state === 'gumball') this.drawGumball(ctx, now);
		if (this.state === 'scores') this.drawScores(ctx);
		if (this.state === 'controls') this.drawControls(ctx);
		if (this.state === 'paused') this.drawPanel(ctx, 'PAUSED', ['Resume', 'Main Menu'], 290);
		if (this.state === 'over') {
			const best = this.mode === 'classic' ? this.bestClassic : this.best;
			this.drawPanel(ctx, 'GAME OVER', ['Play Again', 'Main Menu'], 330, [`Score ${this.score}`, `Best ${best} · +${this.runCoins} coins`]);
		}
		if (this.state === 'play' && this.dying?.kind === 'caught') this.title(ctx, 'Caught by a heron!', GAME_W / 2, 260, 26, '#ffe14a');
		if (this.banner && this.state === 'play') this.title(ctx, this.banner.text, GAME_W / 2, 300, 44, '#ffe14a');
		ctx.restore();
	}

	/** Screen y of a (possibly fractional) world row. */
	private rowY(r: number) {
		return HUD + (this.cam + VISIBLE - 1 - r) * T;
	}

	private drawBoard(ctx: CanvasRenderingContext2D, now: number) {
		const t = now / 1000;
		const top = Math.ceil(this.cam + VISIBLE) + 1;
		const bottom = Math.floor(this.cam) - 1;
		// Ground first (back to front), then everything standing on it (back to front).
		for (let r = top; r >= bottom; r--) {
			const row = this.rows.get(r);
			if (row) this.drawGround(ctx, row, r, t);
		}
		for (let r = top; r >= bottom; r--) {
			const row = this.rows.get(r);
			if (!row) continue;
			const y = this.rowY(r);
			// Coins lie on the ground, under any car driving over them.
			if (row.coin !== null) this.drawCoin(ctx, row.coin, y, t);
			if (row.kind === 'grass') for (const [c, m] of row.trees) drawModel(ctx, m, c * T, y);
			if (row.kind === 'home') {
				// Reeds along the bank; water inlets with a lily pad each (and a frog once reached).
				for (let c = 0; c < COLS; c++) {
					if (PADS.includes(c)) {
						this.lilyPad(ctx, c * T + T / 2, y + T / 2 + 2, c);
						if (this.filled.has(c)) drawCharacter(ctx, characterById(this.selected), c * T + 4, y + 4, this.time, 0.8);
					} else {
						for (let k = 0; k < 3; k++) {
							const h = 0.5 + ((c * 3 + k) % 3) * 0.2;
							drawModel(ctx, model([bx(0, 0.4, 0, 0.12, 0.12, h, '#3e8f2c'), bx(0, 0.36, h, 0.12, 0.16, 0.14, '#8b5a2b')]), c * T + 6 + k * 12, y + 2);
						}
					}
				}
			}
			if (row.kind === 'river') {
				for (const c of row.pads) this.lilyPad(ctx, c * T + T / 2, y + T / 2, c + r);
				row.items.forEach((it, i) => {
					if (row.dive === undefined) return drawModel(ctx, it.m, it.x * T, y);
					// Turtle rafts: one turtle per tile; the diving raft sinks and fades.
					const depth = i === 0 ? this.diveDepth(row) : 0;
					for (let k = 0; k < it.len; k++) drawModel(ctx, it.m, (it.x + k) * T, y - depth * 10, 1, 1 - depth * 0.75);
				});
			}
			if (row.kind === 'road') {
				for (const it of row.items) {
					shadow(ctx, (it.x + it.len / 2) * T, y + T * 0.86, it.len * T * 0.48, 5, 0.22);
					drawModel(ctx, it.m, it.x * T, y);
				}
			}
			if (row.kind === 'rail' && row.train) {
				const tr = row.train;
				// Warning light: flashes red while a train is coming or passing.
				const flashing = tr.wait < 1.3 && Math.floor(t * 4) % 2 === 0;
				ctx.fillStyle = '#d9d9d9';
				ctx.fillRect(8, y - 18, 5, 40);
				ctx.fillStyle = '#222';
				ctx.fillRect(2, y - 26, 17, 12);
				ctx.fillStyle = flashing ? '#ff3b30' : '#5a1a1a';
				ctx.beginPath();
				ctx.arc(10.5, y - 20, 4.5, 0, Math.PI * 2);
				ctx.fill();
				if (tr.wait <= 0) drawModel(ctx, tr.m, tr.x * T, y);
			}
			if ((this.state === 'play' || this.state === 'paused') && this.frogRow() === r) this.drawFrog(ctx);
		}
	}

	private drawGround(ctx: CanvasRenderingContext2D, row: Row, r: number, t: number) {
		const y = this.rowY(r);
		const below = this.rows.get(r - 1);
		if (row.kind === 'home') {
			ctx.fillStyle = '#2f8f3a';
			ctx.fillRect(0, y, GAME_W, T);
			ctx.fillStyle = '#2b86cc';
			for (const c of PADS) ctx.fillRect(c * T + 2, y + 6, T - 4, T - 4);
			ctx.fillStyle = '#6b4a2b';
			ctx.fillRect(0, y + T - 1, GAME_W, 7);
		} else if (row.kind === 'grass') {
			ctx.fillStyle = r % 2 ? '#5fc24d' : '#58b947';
			ctx.fillRect(0, y, GAME_W, T);
			ctx.fillStyle = 'rgba(0,0,0,0.05)';
			for (let c = r % 2; c < COLS; c += 2) ctx.fillRect(c * T, y, T, T);
			// Raised edge where grass meets water, road or rails.
			if (below && below.kind !== 'grass') {
				ctx.fillStyle = below.kind === 'river' ? '#6b4a2b' : '#8a8f96';
				ctx.fillRect(0, y + T - 1, GAME_W, 7);
			}
		} else if (row.kind === 'road') {
			ctx.fillStyle = '#4a4f57';
			ctx.fillRect(0, y, GAME_W, T);
			if (this.rows.get(r + 1)?.kind === 'road') {
				ctx.fillStyle = '#e8e8e8';
				for (let x = 8; x < GAME_W; x += 48) ctx.fillRect(x, y - 1, 24, 3);
			}
		} else if (row.kind === 'rail') {
			ctx.fillStyle = '#8a7a68';
			ctx.fillRect(0, y, GAME_W, T);
			ctx.fillStyle = '#6b4a2b';
			for (let x = 4; x < GAME_W; x += 20) ctx.fillRect(x, y + 6, 8, T - 12);
			ctx.fillStyle = '#c9ccd1';
			ctx.fillRect(0, y + 11, GAME_W, 4);
			ctx.fillRect(0, y + 25, GAME_W, 4);
		} else {
			ctx.fillStyle = r % 2 ? '#2a8fd6' : '#2b86cc';
			ctx.fillRect(0, y, GAME_W, T);
			ctx.fillStyle = 'rgba(255,255,255,0.18)';
			for (let k = 0; k < 6; k++) {
				const wx = ((k * 97 + t * 18 * row.dir) % (GAME_W + 60) + GAME_W + 60) % (GAME_W + 60) - 30;
				ctx.fillRect(wx, y + 10 + ((k * 13) % 20), 26, 3);
			}
		}
	}

	private frogRow() {
		return this.hop ? (this.hop.t < 0.5 ? this.hop.fr : this.hop.tr) : this.row;
	}

	private lilyPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
		ctx.fillStyle = '#2f7a2a';
		ctx.beginPath();
		ctx.ellipse(cx, cy + 3, 16, 11, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#4fae3c';
		ctx.beginPath();
		ctx.ellipse(cx, cy, 16, 11, 0, 0.35, Math.PI * 2 - 0.05);
		ctx.lineTo(cx, cy);
		ctx.fill();
		ctx.strokeStyle = 'rgba(30,90,30,0.6)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx - 10, cy - 4);
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx - 6, cy + 7);
		ctx.stroke();
		if (seed % 4 === 1) {
			ctx.fillStyle = '#ff8fc0';
			ctx.fillRect(cx + 4, cy - 7, 6, 5);
			ctx.fillStyle = '#ffd1e6';
			ctx.fillRect(cx + 5, cy - 9, 4, 3);
		}
	}

	private drawCoin(ctx: CanvasRenderingContext2D, col: number, rowY: number, t: number) {
		const cx = col * T + T / 2;
		const cy = rowY + T / 2 - 6 + Math.sin(t * 4) * 2;
		const w = Math.max(2, Math.abs(Math.cos(t * 3)) * 11);
		shadow(ctx, cx, rowY + T * 0.8, 9, 3);
		ctx.fillStyle = '#c99712';
		ctx.beginPath();
		ctx.ellipse(cx, cy + 2, w, 11, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#ffd84a';
		ctx.beginPath();
		ctx.ellipse(cx, cy, w, 11, 0, 0, Math.PI * 2);
		ctx.fill();
		if (w > 6) {
			ctx.fillStyle = '#f2b81c';
			ctx.fillRect(cx - w * 0.3, cy - 5, w * 0.6, 10);
		}
	}

	private drawFrog(ctx: CanvasRenderingContext2D) {
		const ch = characterById(this.selected);
		let x = this.x;
		let r = this.row;
		let lift = 0;
		if (this.hop) {
			const k = this.hop.t;
			x = this.hop.fx + (this.hop.tx - this.hop.fx) * k;
			r = this.hop.fr + (this.hop.tr - this.hop.fr) * k;
			lift = Math.sin(k * Math.PI) * 12;
		}
		const px = x * T;
		const py = this.rowY(r);
		if (this.dying) {
			const k = Math.min(1, this.dying.t / 0.9);
			if (this.dying.kind === 'splash') {
				ctx.strokeStyle = `rgba(220,240,255,${1 - k})`;
				ctx.lineWidth = 3;
				for (let i = 0; i < 3; i++) {
					ctx.beginPath();
					ctx.ellipse(px + T / 2, py + T / 2, 6 + k * 22 + i * 6, (6 + k * 22 + i * 6) * 0.5, 0, 0, Math.PI * 2);
					ctx.stroke();
				}
				if (k < 0.3) drawCharacter(ctx, ch, px, py + k * 30, this.time, 1, 1 - k * 3, 1, this.facing);
			} else if (this.dying.kind === 'caught') {
				// A heron swoops down and carries the frog off.
				const heron = characterById('heron');
				const lift2 = k < 0.5 ? (1 - k * 2) * 220 : (k - 0.5) * -240;
				if (k < 0.5) drawCharacter(ctx, ch, px, py, this.time, 1, 1, 1, this.facing);
				drawCharacter(ctx, heron, px - T * 0.4, py - 30 - lift2, this.time, 1.6);
				if (k >= 0.5) drawCharacter(ctx, ch, px, py - 10 - (k - 0.5) * 240, this.time, 0.8, 1, 1, this.facing);
			} else {
				drawCharacter(ctx, ch, px, py, this.time, 1, 1 - k * 0.6, 0.15, this.facing);
			}
			return;
		}
		shadow(ctx, px + T / 2, py + T * 0.78, 13 - lift / 3, 5);
		const hover = ch.id === 'dragonfly' ? Math.sin(this.time * 6) * 3 : 0;
		drawCharacter(ctx, ch, px, py - lift + hover, this.time, 1, 1, 1, this.facing);
	}

	private drawHud(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		ctx.fillStyle = '#123d24';
		ctx.fillRect(0, 0, GAME_W, HUD);
		ctx.fillStyle = '#0c2a19';
		ctx.fillRect(0, HUD - 3, GAME_W, 3);
		if (this.mode === 'classic' && (this.state === 'play' || this.state === 'paused' || this.state === 'over')) {
			g.font(15, ARIAL_BLACK);
			g.setColor('#ffffff');
			g.drawString(`${this.score}`, 12, 26);
			g.setColor('#9be38a');
			g.font(12, ARIAL_BLACK);
			g.drawString(`LV ${this.level}`, 92, 26);
			ctx.fillStyle = '#0c2a19';
			ctx.fillRect(150, 15, 150, 12);
			const k = Math.max(0, this.timer / ATTEMPT_TIME);
			ctx.fillStyle = k > 0.3 ? '#5fd35f' : '#ff6b4a';
			ctx.fillRect(150, 15, 150 * k, 12);
			for (let i = 0; i < this.lives; i++) drawModel(ctx, CHARACTERS[0].model, 312 + i * 22, 14, 0.5);
		} else if (this.state === 'play' || this.state === 'paused' || this.state === 'over') {
			g.font(22, ARIAL_BLACK);
			g.setColor('#ffffff');
			g.drawString(`${this.score}`, 14, 30);
			g.font(12, ARIAL_BLACK);
			g.setColor('#9be38a');
			g.drawString(`TOP ${Math.max(this.best, this.score)}`, 14 + g.width(`${this.score}`) * 1.9 + 12, 28);
		}
		// Coins.
		ctx.fillStyle = '#c99712';
		ctx.beginPath();
		ctx.arc(GAME_W - 70, 21, 9, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#ffd84a';
		ctx.beginPath();
		ctx.arc(GAME_W - 70, 19, 9, 0, Math.PI * 2);
		ctx.fill();
		g.font(15, ARIAL_BLACK);
		g.setColor('#ffe680');
		g.drawString(`${this.coins}`, GAME_W - 56, 26);
	}

	private title(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, color: string) {
		ctx.textAlign = 'center';
		ctx.font = `bold ${size}px ${ARIAL_BLACK}`;
		ctx.lineJoin = 'round';
		ctx.lineWidth = size / 6;
		ctx.strokeStyle = '#0b2a14';
		ctx.strokeText(text, cx, y);
		ctx.fillStyle = color;
		ctx.fillText(text, cx, y);
		ctx.textAlign = 'left';
	}

	private button(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, h: number, on: boolean, disabled = false) {
		ctx.fillStyle = disabled ? '#3a4a40' : on ? '#ffe14a' : '#2f9e44';
		ctx.fillRect(x, y + 4, w, h);
		ctx.fillStyle = disabled ? '#56685c' : on ? '#fff3a0' : '#4cc55e';
		ctx.fillRect(x, y, w, h - 4);
		ctx.textAlign = 'center';
		ctx.font = `bold 17px ${ARIAL_BLACK}`;
		ctx.fillStyle = disabled ? '#a9b8ae' : on ? '#3a2a00' : '#ffffff';
		ctx.fillText(label, x + w / 2, y + h / 2 + 4);
		ctx.textAlign = 'left';
	}

	private drawMenu(ctx: CanvasRenderingContext2D, now: number) {
		this.title(ctx, 'FROGGER', GAME_W / 2, 132, 58, '#6ee04a');
		const ch = characterById(this.selected);
		const bob = Math.abs(Math.sin(now / 300)) * 8;
		shadow(ctx, GAME_W / 2, 238, 22, 6);
		drawCharacter(ctx, ch, GAME_W / 2 - T * 0.9, 190 - (ch.flop ? 0 : bob), this.time, 1.8);
		ctx.textAlign = 'center';
		ctx.font = `bold 12px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText(ch.name, GAME_W / 2, 254);
		ctx.textAlign = 'left';
		MENU.forEach((m, i) => this.button(ctx, m.label, 140, 262 + i * 48, 240, 40, this.hover === i));
	}

	private drawPanel(ctx: CanvasRenderingContext2D, heading: string, buttons: string[], y0: number, lines: string[] = []) {
		ctx.fillStyle = 'rgba(8,30,18,0.92)';
		ctx.fillRect(110, y0 - 130, 300, 130 + buttons.length * 52 + 16);
		this.title(ctx, heading, GAME_W / 2, y0 - 78, 38, heading === 'GAME OVER' ? '#ff6b4a' : '#ffe14a');
		ctx.textAlign = 'center';
		ctx.font = `bold 16px ${ARIAL_BLACK}`;
		ctx.fillStyle = '#ffffff';
		lines.forEach((l, i) => ctx.fillText(l, GAME_W / 2, y0 - 44 + i * 22));
		ctx.textAlign = 'left';
		buttons.forEach((b, i) => this.button(ctx, b, 140, y0 + i * 52, 240, 42, this.hover === i));
	}

	private back(ctx: CanvasRenderingContext2D) {
		this.button(ctx, '‹ Back', 12, 50, 92, 32, this.hover === 0);
	}

	private drawScores(ctx: CanvasRenderingContext2D) {
		this.back(ctx);
		this.title(ctx, 'HIGH SCORES', GAME_W / 2, 128, 40, '#ffe14a');
		const g = this.g;
		g.font(17, ARIAL_BLACK);
		g.setColor('#ffffff');
		g.drawString('Best Classic (points)', 100, 180);
		g.drawRight(`${this.bestClassic}`, 420, 180);
		g.drawString('Best Endless (rows)', 100, 212);
		g.drawRight(`${this.best}`, 420, 212);
		g.drawString('Games played', 100, 244);
		g.drawRight(`${this.games}`, 420, 244);
		g.drawString('Characters', 100, 276);
		g.drawRight(`${this.owned.length} / ${CHARACTERS.length}`, 420, 276);
		const record = (board: number, label: string, local: number, y: number) => {
			g.font(14, ARIAL_BLACK);
			g.setColor('#9be38a');
			g.drawString(label, 100, y);
			drawRecord(g, { global: this.global, board, local, loggedIn: this.loggedIn, x: 100, y: y + 24, family: ARIAL, color: '#ffffff', dim: '#a9d8a0', size: 15, rows: 2 });
		};
		record(BOARDS.classic, 'GLOBAL · CLASSIC', this.bestClassic, 322);
		record(BOARDS.endless, 'GLOBAL · ENDLESS', this.best, 430);
	}

	private drawControls(ctx: CanvasRenderingContext2D) {
		this.back(ctx);
		this.title(ctx, 'HOW TO PLAY', GAME_W / 2, 140, 40, '#ffe14a');
		const lines: [string, string][] = [
			['W A S D', 'Hop (arrow keys work too)'],
			['Classic', 'Fill all 5 lily pads before time runs out'],
			['Endless', 'Hop forward as far as you can'],
			['Road', "Don't get hit by cars"],
			['Railway', 'Red light: a train is coming!'],
			['River', 'Hop on logs and lily pads'],
			['Keep up', "Dawdle and a heron gets you"],
			['Coins', `Spend ${ROLL_COST} on the gumball machine`]
		];
		lines.forEach(([k, v], i) => {
			const y = 180 + i * 42;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(70, y - 22, 110, 32);
			ctx.fillStyle = '#123d24';
			ctx.textAlign = 'center';
			ctx.font = `bold 14px ${ARIAL_BLACK}`;
			ctx.fillText(k, 125, y);
			ctx.textAlign = 'left';
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 15px ${ARIAL}`;
			ctx.fillText(v, 196, y);
		});
	}

	private drawGumball(ctx: CanvasRenderingContext2D, now: number) {
		this.back(ctx);
		this.title(ctx, 'GUMBALL MACHINE', GAME_W / 2, 118, 32, '#ff8fc0');
		const cx = 160;
		const cy = 230;
		// Base and stand.
		ctx.fillStyle = '#b8202e';
		ctx.fillRect(cx - 62, cy + 80, 124, 120);
		ctx.fillStyle = '#e23b3b';
		ctx.fillRect(cx - 62, cy + 76, 124, 110);
		ctx.fillStyle = '#8f1621';
		ctx.fillRect(cx - 74, cy + 190, 148, 16);
		// Coin slot and chute.
		ctx.fillStyle = '#d9d9d9';
		ctx.fillRect(cx - 34, cy + 96, 30, 30);
		ctx.fillStyle = '#333';
		ctx.fillRect(cx - 22, cy + 102, 6, 18);
		ctx.fillStyle = '#5a0f17';
		ctx.fillRect(cx + 8, cy + 140, 40, 34);
		// Crank.
		const a = this.crank;
		ctx.fillStyle = '#d9d9d9';
		ctx.beginPath();
		ctx.arc(cx + 22, cy + 112, 14, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#f5f5f5';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(cx + 22, cy + 112);
		ctx.lineTo(cx + 22 + Math.cos(a) * 18, cy + 112 + Math.sin(a) * 18);
		ctx.stroke();
		// Glass globe full of gumballs.
		ctx.fillStyle = 'rgba(190,230,255,0.25)';
		ctx.beginPath();
		ctx.arc(cx, cy, 86, 0, Math.PI * 2);
		ctx.fill();
		const colors = ['#ff5a7a', '#5ac8ff', '#ffd23f', '#7bdc6b', '#c88bff', '#ff9a3c'];
		for (let i = 0; i < 46; i++) {
			const ang = i * 2.4;
			const rad = 12 + ((i * 37) % 66);
			const gx = cx + Math.cos(ang) * rad * 0.95;
			const gy = cy + 20 + Math.abs(Math.sin(ang)) * rad * 0.62 - (i % 5) * 4;
			ctx.fillStyle = colors[i % colors.length];
			ctx.beginPath();
			ctx.arc(gx, gy, 9, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = 'rgba(255,255,255,0.5)';
			ctx.fillRect(gx - 4, gy - 5, 3, 3);
		}
		ctx.strokeStyle = 'rgba(255,255,255,0.7)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(cx, cy, 86, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,0.35)';
		ctx.fillRect(cx - 52, cy - 58, 12, 34);
		ctx.fillStyle = '#e23b3b';
		ctx.fillRect(cx - 24, cy - 96, 48, 14);

		// Roll button, what's left to find, and the odds.
		const odds = gumballOdds(this.owned);
		const normalLeft = odds.filter((o) => !o.rare).length;
		const can = this.coins >= ROLL_COST && odds.length > 0 && !this.roll;
		this.button(ctx, odds.length ? `Roll · ${ROLL_COST} coins` : 'All collected!', 300, 330, 196, 46, this.hover === 1 && can, !can);
		ctx.textAlign = 'center';
		ctx.font = `bold 13px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText(
			normalLeft ? `${normalLeft} swamp friends left to find` : odds.length ? 'A hidden friend is still out there…' : 'You found every character!',
			398,
			398
		);
		ctx.textAlign = 'left';
		this.button(ctx, 'See odds', 340, 410, 116, 28, this.hover === 2);

		// The roll: a gumball drops down the chute and pops open to reveal the new character.
		const r = this.roll;
		if (r) {
			const t = r.t;
			if (t > 0.9 && t < 1.6) {
				const k = (t - 0.9) / 0.7;
				ctx.fillStyle = r.color;
				ctx.beginPath();
				ctx.arc(cx + 28, cy + 150 + k * 10, 11, 0, Math.PI * 2);
				ctx.fill();
			}
			if (t >= 1.6) {
				const k = Math.min(1, (t - 1.6) / 0.4);
				const ch = characterById(r.prize);
				ctx.fillStyle = `rgba(255,240,150,${0.25 * k})`;
				for (let i = 0; i < 12; i++) {
					ctx.save();
					ctx.translate(398, 228);
					ctx.rotate(i * (Math.PI / 6) + now / 1500);
					ctx.fillRect(-4, 0, 8, 110);
					ctx.restore();
				}
				ctx.fillStyle = r.color;
				ctx.beginPath();
				ctx.arc(398 - 40 * k, 250, 18, Math.PI / 2, (Math.PI * 3) / 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(398 + 40 * k, 250, 18, -Math.PI / 2, Math.PI / 2);
				ctx.fill();
				drawCharacter(ctx, ch, 398 - T * 1.2, 210 - (1 - k) * 20, this.time, 2.4, k);
				this.title(ctx, 'NEW!', 398, 160, 24, '#ffe14a');
				ctx.textAlign = 'center';
				ctx.font = `bold 16px ${ARIAL_BLACK}`;
				ctx.fillStyle = '#ffffff';
				ctx.fillText(ch.name, 398, 308);
				ctx.textAlign = 'left';
			}
		} else {
			const ch = characterById(this.selected);
			drawCharacter(ctx, ch, 398 - T * 1.1, 215, this.time, 2.2);
			ctx.textAlign = 'center';
			ctx.font = `bold 14px ${ARIAL_BLACK}`;
			ctx.fillStyle = '#ffffff';
			ctx.fillText(`Playing as ${ch.name}`, 398, 308);
			ctx.textAlign = 'left';
		}

		// Collection: click one you own to play as it. The hidden one shows as a gold star.
		ctx.font = `bold 12px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText('Your collection: click one to play as it', slotX(0), 470);
		CHARACTERS.forEach((c, i) => {
			const x = slotX(i);
			const own = this.owned.includes(c.id);
			const hidden = c.rare && !own;
			ctx.fillStyle = c.id === this.selected ? '#ffe14a' : this.hover === 10 + i ? '#4cc55e' : hidden ? '#b8860b' : 'rgba(255,255,255,0.12)';
			ctx.fillRect(x, 478, SLOT_W, 56);
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fillRect(x + 2, 480, SLOT_W - 4, 52);
			if (own) drawCharacter(ctx, c, x + 1, 498, this.time, 0.9);
			else {
				ctx.font = `bold 22px ${ARIAL_BLACK}`;
				ctx.fillStyle = hidden ? '#ffd84a' : 'rgba(255,255,255,0.35)';
				ctx.textAlign = 'center';
				ctx.fillText(hidden ? '★' : '?', x + SLOT_W / 2, 514);
				ctx.textAlign = 'left';
			}
		});
		if (this.showOdds) this.drawOdds(ctx, odds);
	}

	/** Pop-up: each character still to find and its chance on the next roll. */
	private drawOdds(ctx: CanvasRenderingContext2D, odds: ReturnType<typeof gumballOdds>) {
		ctx.fillStyle = 'rgba(2,12,8,0.7)';
		ctx.fillRect(0, 0, GAME_W, GAME_H);
		const h = 118 + Math.max(1, odds.length) * 30;
		const y0 = Math.round((GAME_H - h) / 2);
		ctx.fillStyle = '#0f3320';
		ctx.fillRect(90, y0, 340, h);
		ctx.strokeStyle = '#ff8fc0';
		ctx.lineWidth = 3;
		ctx.strokeRect(90, y0, 340, h);
		this.title(ctx, 'GUMBALL ODDS', GAME_W / 2, y0 + 40, 24, '#ff8fc0');
		ctx.font = `bold 15px ${ARIAL}`;
		if (!odds.length) {
			ctx.textAlign = 'center';
			ctx.fillStyle = '#ffffff';
			ctx.fillText('You found every character!', GAME_W / 2, y0 + 80);
		}
		odds.forEach((o, i) => {
			const y = y0 + 64 + i * 30;
			const ch = characterById(o.id);
			drawModel(ctx, o.rare ? ch.model.map((b) => ({ ...b, c: '#3a3a3a' })) : ch.model, 108, y - 2, 0.55);
			ctx.textAlign = 'left';
			ctx.fillStyle = o.rare ? '#ffd84a' : '#ffffff';
			ctx.fillText(o.rare ? '★ ??? (hidden)' : o.name, 140, y + 18);
			ctx.textAlign = 'right';
			ctx.fillText(`${o.pct % 1 ? o.pct.toFixed(1) : o.pct}%`, 410, y + 18);
		});
		ctx.textAlign = 'center';
		ctx.font = `12px ${ARIAL}`;
		ctx.fillStyle = '#a9d8a0';
		ctx.fillText("Every roll gives a character you don't have yet.", GAME_W / 2, y0 + h - 30);
		ctx.fillText('Click anywhere to close', GAME_W / 2, y0 + h - 12);
		ctx.textAlign = 'left';
	}
}

const MENU = [
	{ id: 'classic', label: 'Classic' },
	{ id: 'endless', label: 'Endless' },
	{ id: 'gumball', label: 'Gumball Machine' },
	{ id: 'scores', label: 'High Scores' },
	{ id: 'controls', label: 'How to Play' },
	{ id: 'quit', label: 'Quit' }
];
const SLOT_W = 38;
const slotX = (i: number) => Math.round((GAME_W - (CHARACTERS.length * (SLOT_W + 3) - 3)) / 2) + i * (SLOT_W + 3);

/** Everything is drawn in code: nothing to load. */
export const loadAssets = async () => undefined;
