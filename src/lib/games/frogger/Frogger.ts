// Frogger: Edward's Grade 10 pygame game (FroggerV15), rebuilt in TypeScript for the browser.
// The game is the original's: get the frog from the bottom to the five lily pads at the top,
// across a road of cars and a river of logs, before the timer runs out, with 3 lives; points
// for every row forward and for each lily pad reached. What's new:
//  - Chunky 3D "voxel" graphics (in the spirit of Crossy Road): every car, log, turtle, lily pad
//    and character is built from little blocks drawn with a lit top and a shaded front.
//  - One hop per key press; filling all five lily pads is a level up (faster traffic and river,
//    and diving turtles from level 2) instead of the end of the game.
//  - Coins to pick up, spent on a gumball machine that rolls 10 swamp animals to play as
//    (this replaces the original character select).
//  - Global high scores, a soundtrack and sound effects, like the other E.Ngine Games.
import { ARIAL, ARIAL_BLACK, Gfx, drawRecord, loadSave, spotAt, writeSave, type ArcadeGame, type Board, type Hotspot } from '../common';

export const GAME_W = 520;
export const GAME_H = 560;
export const TICK_MS = 16;
const DT = TICK_MS / 1000;

const T = 40; // tile size in pixels
const Z = 30; // pixels per tile of height (how tall blocks look)
const HUD = 40;
const COLS = 13;
const ROWS = 13;
const RIVER = [1, 2, 3, 4, 5];
const ROAD = [7, 8, 9, 10, 11];
const PADS = [1, 4, 6, 8, 11];
const START_COL = 6;
const ATTEMPT_TIME = 30;
const ROLL_COST = 30;
const SAVE_KEY = 'frogger-save';
const LOOP = COLS + 6;
const SPAN0 = -4;

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

// ── Characters: the frog, and 10 swamp animals from the gumball machine ──────────────────
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

export const CHARACTERS: { id: string; name: string; model: Model }[] = [
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
		id: 'beaver',
		name: 'Beaver',
		model: model([
			bx(0.3, 0.8, 0, 0.4, 0.3, 0.08, '#4a3b2b'),
			bx(0.2, 0.25, 0, 0.6, 0.55, 0.4, '#8b5a2b'),
			bx(0.3, 0.06, 0.1, 0.4, 0.26, 0.3, '#9b6a3b'),
			bx(0.43, 0.02, 0.12, 0.14, 0.05, 0.08, '#fff6d5'),
			bx(0.45, 0.06, 0.34, 0.1, 0.06, 0.05, '#111111'),
			bx(0.34, 0.1, 0.4, 0.06, 0.06, 0.02, '#111111'),
			bx(0.6, 0.1, 0.4, 0.06, 0.06, 0.02, '#111111'),
			bx(0.28, 0.06, 0.4, 0.08, 0.06, 0.06, '#7a4a20'),
			bx(0.64, 0.06, 0.4, 0.08, 0.06, 0.06, '#7a4a20')
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
	}
];
const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

// ── Vehicles, logs, turtles, coins ──────────────────────────────────────────────────────
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
const TURTLE = model([
	bx(0.38, 0.06, 0, 0.24, 0.18, 0.12, '#c9b27a'),
	bx(0.1, 0.2, 0, 0.8, 0.62, 0.16, '#3d7a3a'),
	bx(0.2, 0.28, 0.16, 0.6, 0.46, 0.1, '#4f9a48'),
	bx(0.4, 0.4, 0.26, 0.2, 0.2, 0.02, '#2f5e2c')
]);

// ── Lanes ───────────────────────────────────────────────────────────────────────────────
type Kind = 'log' | 'turtle' | 'car' | 'sport' | 'muscle' | 'truck' | 'bus';
interface Item {
	x: number;
	m: Model;
}
interface Lane {
	row: number;
	kind: Kind;
	dir: 1 | -1;
	speed: number;
	len: number;
	items: Item[];
	/** Turtles: one group dives now and then (from level 2). */
	dive?: number;
}
const LANES: { row: number; kind: Kind; dir: 1 | -1; speed: number; len: number; count: number }[] = [
	{ row: 1, kind: 'log', dir: 1, speed: 1.1, len: 3, count: 3 },
	{ row: 2, kind: 'turtle', dir: -1, speed: 1.5, len: 2, count: 4 },
	{ row: 3, kind: 'log', dir: 1, speed: 0.8, len: 4, count: 2 },
	{ row: 4, kind: 'turtle', dir: -1, speed: 1.2, len: 3, count: 3 },
	{ row: 5, kind: 'log', dir: 1, speed: 1.7, len: 2, count: 3 },
	{ row: 7, kind: 'truck', dir: -1, speed: 1.0, len: 2, count: 2 },
	{ row: 8, kind: 'sport', dir: 1, speed: 2.4, len: 1, count: 2 },
	{ row: 9, kind: 'car', dir: -1, speed: 1.3, len: 1, count: 3 },
	{ row: 10, kind: 'bus', dir: 1, speed: 0.9, len: 3, count: 2 },
	{ row: 11, kind: 'muscle', dir: -1, speed: 1.6, len: 1, count: 3 }
];
const CAR_COLORS = ['#e23b3b', '#2f6fe0', '#f28c28', '#e8e8e8', '#7b3fe0', '#f2c12e', '#2fbf71'];

function makeLanes(): Lane[] {
	return LANES.map((l, li) => ({
		row: l.row,
		kind: l.kind,
		dir: l.dir,
		speed: l.speed,
		len: l.len,
		dive: l.kind === 'turtle' ? li * 1.7 : undefined,
		items: Array.from({ length: l.count }, (_, i) => ({
			x: SPAN0 + (i * LOOP) / l.count + ((li * 7 + i * 3) % 3) * 0.4,
			m:
				l.kind === 'log'
					? logModel(l.len)
					: l.kind === 'turtle'
						? TURTLE
						: vehicle(l.kind, l.len, l.kind === 'muscle' ? '#f2a020' : CAR_COLORS[(li + i * 2) % CAR_COLORS.length], l.dir)
		}))
	}));
}

type State = 'menu' | 'play' | 'paused' | 'over' | 'gumball' | 'scores' | 'controls';
type Facing = 'up' | 'down' | 'left' | 'right';
interface Hop {
	fx: number;
	fr: number;
	tx: number;
	tr: number;
	t: number;
}
interface Coin {
	x: number;
	row: number;
	ttl: number;
	lane?: Lane;
}

export class Frogger implements ArcadeGame {
	state: State = 'menu';
	lanes = makeLanes();
	// Frog
	x = START_COL;
	row = ROWS - 1;
	facing: Facing = 'up';
	hop: Hop | null = null;
	dying: { t: number; kind: 'splash' | 'squash' } | null = null;
	// Run
	score = 0;
	level = 1;
	lives = 3;
	timer = ATTEMPT_TIME;
	minRow = ROWS - 1;
	filled = new Set<number>();
	coin: Coin | null = null;
	coinTimer = 4;
	runCoins = 0;
	banner: { text: string; t: number } | null = null;
	// Saved
	best = 0;
	games = 0;
	coins = 0;
	owned: string[] = ['frog'];
	selected = 'frog';
	// Gumball machine
	roll: { t: number; prize: string; color: string } | null = null;
	crank = 0;

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	sfx: (name: string) => void = () => {};
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();
	private hover = -1;
	private time = 0;

	constructor() {
		Object.assign(this, loadSave(SAVE_KEY, { best: 0, games: 0, coins: 0, owned: ['frog'], selected: 'frog' }));
		if (!this.owned.includes(this.selected)) this.selected = 'frog';
	}

	save() {
		const { best, games, coins, owned, selected } = this;
		writeSave(SAVE_KEY, { best, games, coins, owned, selected });
	}

	musicTrack() {
		if (this.state === 'play' || this.state === 'paused') return 'frogger-play-' + Math.min(3, Math.ceil(this.level / 2));
		if (this.state === 'over') return null;
		return 'frogger-menu';
	}

	leave() {
		if ((this.state === 'play' || this.state === 'paused') && this.score > 0) {
			this.best = Math.max(this.best, this.score);
			this.onScore(1, this.score);
		}
		if (this.state === 'play') this.state = 'paused';
		this.save();
	}

	private get speedMult() {
		return Math.min(2.2, 1 + 0.15 * (this.level - 1));
	}

	// ── Starting, dying, scoring ──
	private newGame() {
		this.lanes = makeLanes();
		this.score = 0;
		this.level = 1;
		this.lives = 3;
		this.filled.clear();
		this.coin = null;
		this.coinTimer = 4;
		this.runCoins = 0;
		this.games++;
		this.respawn();
		this.state = 'play';
		this.banner = { text: 'GO!', t: 1 };
		this.save();
	}
	private respawn() {
		this.x = START_COL;
		this.row = ROWS - 1;
		this.facing = 'up';
		this.hop = null;
		this.dying = null;
		this.timer = ATTEMPT_TIME;
		this.minRow = ROWS - 1;
	}
	private die(kind: 'splash' | 'squash') {
		if (this.dying) return;
		this.dying = { t: 0, kind };
		this.hop = null;
		this.sfx(kind);
	}
	private gameOver() {
		this.state = 'over';
		this.best = Math.max(this.best, this.score);
		this.onScore(1, this.score);
		this.sfx('lose');
		this.save();
	}
	private reachHome(col: number) {
		this.filled.add(col);
		this.score += 200 + Math.ceil(this.timer) * 10;
		this.sfx('home');
		if (this.filled.size === PADS.length) {
			this.level++;
			this.score += 1000;
			this.filled.clear();
			this.banner = { text: `LEVEL ${this.level}!`, t: 1.6 };
			this.sfx('levelUp');
		}
		this.respawn();
	}

	// ── Keyboard: WASD (or arrows) to hop, Enter to pause ──
	keyPressed(code: string): boolean {
		const dirs: Record<string, [number, number, Facing]> = {
			KeyW: [0, -1, 'up'],
			ArrowUp: [0, -1, 'up'],
			KeyS: [0, 1, 'down'],
			ArrowDown: [0, 1, 'down'],
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
			this.state = 'menu';
		} else if (this.state === 'menu' && enter) {
			this.newGame();
		} else if (this.state === 'play' && dirs[code]) {
			const [dx, dr, face] = dirs[code];
			this.tryHop(dx, dr, face);
		}
		return true;
	}
	keyReleased(code: string): boolean {
		return /^(Key[WASD]|Arrow|Enter|Space)/.test(code);
	}

	private tryHop(dx: number, dr: number, face: Facing) {
		if (this.hop || this.dying) return;
		this.facing = face;
		const tr = this.row + dr;
		let tx = this.x + dx;
		if (tr > ROWS - 1 || tr < 0) return;
		const onLand = !RIVER.includes(this.row);
		if (onLand && (tx < 0 || tx > COLS - 1)) return;
		if (!RIVER.includes(tr)) tx = Math.round(tx);
		this.hop = { fx: this.x, fr: this.row, tx, tr, t: 0 };
		this.sfx('hop');
	}

	private land() {
		const h = this.hop!;
		this.hop = null;
		this.x = h.tx;
		this.row = h.tr;
		if (this.row < this.minRow) {
			this.minRow = this.row;
			this.score += 10;
		}
		if (this.row === 0) {
			const col = Math.round(this.x);
			if (PADS.includes(col) && !this.filled.has(col)) this.reachHome(col);
			else this.die('splash');
			return;
		}
		if (RIVER.includes(this.row) && !this.platform()) this.die('splash');
		this.checkCoin();
	}

	/** The log or surfaced turtle under the frog, if any. */
	private platform(): Lane | null {
		const lane = this.lanes.find((l) => l.row === this.row);
		if (!lane) return null;
		const cx = this.x + 0.5;
		for (const [i, it] of lane.items.entries()) {
			if (cx >= it.x && cx <= it.x + lane.len) {
				if (lane.kind === 'turtle' && i === 0 && this.diveDepth(lane) > 0.7) return null;
				return lane;
			}
		}
		return null;
	}
	/** 0 = surfaced, 1 = fully under water (only the first turtle group of a lane dives). */
	private diveDepth(lane: Lane): number {
		if (this.level < 2 || lane.dive === undefined) return 0;
		const p = (this.time + lane.dive) % 6;
		if (p < 3.5) return 0;
		if (p < 4.2) return (p - 3.5) / 0.7;
		if (p < 5.3) return 1;
		return 1 - (p - 5.3) / 0.7;
	}

	private checkCoin() {
		const c = this.coin;
		if (!c || this.dying || c.row !== this.row || Math.abs(c.x - this.x) > 0.6) return;
		this.coin = null;
		this.coins++;
		this.runCoins++;
		this.score += 25;
		this.sfx('coin');
		this.save();
	}
	private spawnCoin() {
		const rows = [...RIVER, 6, ...ROAD];
		const row = rows[Math.floor(Math.random() * rows.length)];
		const lane = this.lanes.find((l) => l.row === row);
		if (lane && RIVER.includes(row)) {
			// On a log or turtle, riding along with it.
			const it = lane.items[Math.floor(Math.random() * lane.items.length)];
			this.coin = { x: it.x + Math.floor(Math.random() * lane.len), row, ttl: 9, lane };
		} else {
			this.coin = { x: Math.floor(Math.random() * COLS), row, ttl: 9 };
		}
	}

	// ── Game loop ──
	tick() {
		this.time += DT;
		if (this.banner && (this.banner.t -= DT) <= 0) this.banner = null;
		if (this.roll) this.tickRoll();
		if (this.state === 'paused' || this.state === 'over') return;
		this.moveLanes();
		if (this.state !== 'play') return;

		if (this.dying) {
			this.dying.t += DT;
			if (this.dying.t > 0.9) {
				this.lives--;
				if (this.lives <= 0) this.gameOver();
				else this.respawn();
			}
			return;
		}
		if (this.hop) {
			this.hop.t += DT / 0.13;
			if (this.hop.t >= 1) this.land();
		} else {
			// Riding a log or turtle; carried off the edge = lost in the river.
			if (RIVER.includes(this.row)) {
				const lane = this.platform();
				if (!lane) this.die('splash');
				else {
					this.x += lane.dir * lane.speed * this.speedMult * DT;
					if (this.x + 0.5 < 0 || this.x + 0.5 > COLS) this.die('splash');
				}
			}
			// Hit by a car.
			const road = this.lanes.find((l) => l.row === this.row && ROAD.includes(l.row));
			if (road && road.items.some((it) => this.x + 0.78 > it.x + 0.08 && this.x + 0.22 < it.x + road.len - 0.08)) this.die('squash');
			this.checkCoin();
		}
		this.timer -= DT;
		if (this.timer <= 0 && !this.dying) this.die('squash');
		// Coins come and go.
		if (this.coin) {
			if (this.coin.lane) this.coin.x += this.coin.lane.dir * this.coin.lane.speed * this.speedMult * DT;
			this.coin.ttl -= DT;
			if (this.coin.ttl <= 0 || this.coin.x < -1 || this.coin.x > COLS) this.coin = null;
		} else if ((this.coinTimer -= DT) <= 0) {
			this.spawnCoin();
			this.coinTimer = 5 + Math.random() * 4;
		}
	}

	private moveLanes() {
		const m = this.state === 'play' ? this.speedMult : 1;
		for (const lane of this.lanes) {
			for (const it of lane.items) {
				it.x += lane.dir * lane.speed * m * DT;
				if (it.x > SPAN0 + LOOP) it.x -= LOOP;
				if (it.x < SPAN0) it.x += LOOP;
			}
		}
	}

	// ── Gumball machine ──
	private rollGumball() {
		const left = CHARACTERS.filter((c) => !this.owned.includes(c.id));
		if (this.roll || this.coins < ROLL_COST || !left.length) return;
		const prize = left[Math.floor(Math.random() * left.length)].id;
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
				return MENU.map((m, i) => btn(i, 140, 262 + i * 52, 240, 42, () => this.menuAction(m.id)));
			case 'gumball': {
				const s: Hotspot[] = [btn(0, 12, 50, 92, 32, () => (this.state = 'menu')), btn(1, 300, 330, 196, 46, () => this.rollGumball())];
				CHARACTERS.forEach((c, i) => {
					if (this.owned.includes(c.id))
						s.push(btn(10 + i, slotX(i), 478, 42, 56, () => ((this.selected = c.id), this.save())));
				});
				return s;
			}
			case 'scores':
			case 'controls':
				return [btn(0, 12, 50, 92, 32, () => (this.state = 'menu'))];
			case 'paused':
				return [btn(0, 140, 290, 240, 42, () => (this.state = 'play')), btn(1, 140, 342, 240, 42, () => this.quitRun())];
			case 'over':
				return [btn(0, 140, 330, 240, 42, () => this.newGame()), btn(1, 140, 382, 240, 42, () => (this.state = 'menu'))];
		}
		return [];
	}
	private quitRun() {
		if (this.score > 0) {
			this.best = Math.max(this.best, this.score);
			this.onScore(1, this.score);
		}
		this.state = 'menu';
		this.save();
	}
	private menuAction(id: string) {
		if (id === 'play') this.newGame();
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
			this.drawPanel(ctx, 'GAME OVER', ['Play Again', 'Main Menu'], 330, [`Score ${this.score}`, `Best ${this.best} · +${this.runCoins} coins`]);
		}
		if (this.banner && this.state === 'play') this.title(ctx, this.banner.text, GAME_W / 2, 300, 44, '#ffe14a');
		ctx.restore();
	}

	private rowY(r: number) {
		return HUD + r * T;
	}

	private drawBoard(ctx: CanvasRenderingContext2D, now: number) {
		const t = now / 1000;
		for (let r = 0; r < ROWS; r++) {
			const y = this.rowY(r);
			if (r === 0) {
				ctx.fillStyle = '#2f8f3a';
				ctx.fillRect(0, y, GAME_W, T);
			} else if (RIVER.includes(r)) {
				ctx.fillStyle = r % 2 ? '#2a8fd6' : '#2b86cc';
				ctx.fillRect(0, y, GAME_W, T);
				ctx.fillStyle = 'rgba(255,255,255,0.18)';
				for (let i = 0; i < 6; i++) {
					const wx = ((i * 97 + t * 18 * (r % 2 ? 1 : -1)) % (GAME_W + 60)) - 30;
					ctx.fillRect(wx, y + 10 + ((i * 13) % 20), 26, 3);
				}
			} else if (ROAD.includes(r)) {
				ctx.fillStyle = '#4a4f57';
				ctx.fillRect(0, y, GAME_W, T);
				if (r < 11) {
					ctx.fillStyle = '#e8e8e8';
					for (let x = 8; x < GAME_W; x += 48) ctx.fillRect(x, y + T - 2, 24, 3);
				}
			} else {
				ctx.fillStyle = r % 2 ? '#5fc24d' : '#58b947';
				ctx.fillRect(0, y, GAME_W, T);
				for (let c = 0; c < COLS; c++) {
					if ((c + r) % 2) {
						ctx.fillStyle = 'rgba(0,0,0,0.05)';
						ctx.fillRect(c * T, y, T, T);
					}
				}
			}
		}
		// Raised banks: a dirt edge where grass meets water, a curb where it meets road.
		const edge = (r: number, c: string) => {
			ctx.fillStyle = c;
			ctx.fillRect(0, this.rowY(r + 1) - 1, GAME_W, 8);
		};
		edge(0, '#6b4a2b');
		edge(6, '#8a8f96');
		ctx.fillStyle = '#6b4a2b';
		ctx.fillRect(0, this.rowY(6) - 6, GAME_W, 6);
		ctx.fillStyle = '#8a8f96';
		ctx.fillRect(0, this.rowY(12) - 5, GAME_W, 5);

		// Home row: reeds along the bank, water inlets with lily pads.
		for (let c = 0; c < COLS; c++) {
			const x = c * T;
			const y = this.rowY(0);
			if (PADS.includes(c)) {
				ctx.fillStyle = '#2b86cc';
				ctx.fillRect(x + 2, y + 6, T - 4, T - 4);
				this.lilyPad(ctx, x + T / 2, y + T / 2 + 2, c);
				if (this.filled.has(c)) drawModel(ctx, characterById(this.selected).model, x + 4, y + 4, 0.8);
			} else {
				for (let k = 0; k < 3; k++) {
					const rx = x + 6 + k * 12;
					const h = 0.5 + ((c * 3 + k) % 3) * 0.2;
					drawModel(ctx, model([bx(0, 0.4, 0, 0.12, 0.12, h, '#3e8f2c'), bx(0, 0.36, h, 0.12, 0.16, 0.14, '#8b5a2b')]), rx, y + 2);
				}
			}
		}

		// Lanes, back to front, with the frog and the coin in their rows.
		for (let r = 1; r < ROWS; r++) {
			const y = this.rowY(r);
			const lane = this.lanes.find((l) => l.row === r);
			if (lane) {
				for (const [i, it] of lane.items.entries()) {
					if (lane.kind === 'turtle') {
						const depth = i === 0 ? this.diveDepth(lane) : 0;
						for (let k = 0; k < lane.len; k++) {
							drawModel(ctx, TURTLE, (it.x + k) * T, y - depth * 10, 1, 1 - depth * 0.75);
						}
					} else {
						if (!RIVER.includes(r)) shadow(ctx, (it.x + lane.len / 2) * T, y + T * 0.86, lane.len * T * 0.48, 5, 0.22);
						drawModel(ctx, it.m, it.x * T, y);
					}
				}
			}
			if (this.coin && this.coin.row === r) this.drawCoin(ctx, this.coin.x, r, t);
			if ((this.state === 'play' || this.state === 'paused') && this.frogRow() === r) this.drawFrog(ctx);
		}
		// The frog mid-hop into the home row.
		if ((this.state === 'play' || this.state === 'paused') && this.frogRow() === 0) this.drawFrog(ctx);
	}

	private frogRow() {
		return this.hop ? (this.hop.t < 0.5 ? this.hop.fr : this.hop.tr) : this.row;
	}

	private lilyPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
		ctx.fillStyle = '#2f7a2a';
		ctx.beginPath();
		ctx.ellipse(cx, cy + 3, 15, 10, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#4fae3c';
		ctx.beginPath();
		ctx.ellipse(cx, cy, 15, 10, 0, 0.35, Math.PI * 2 - 0.05);
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
		if (seed % 3 === 1) {
			ctx.fillStyle = '#ff8fc0';
			ctx.fillRect(cx + 4, cy - 7, 6, 5);
			ctx.fillStyle = '#ffd1e6';
			ctx.fillRect(cx + 5, cy - 9, 4, 3);
		}
	}

	private drawCoin(ctx: CanvasRenderingContext2D, x: number, r: number, t: number) {
		const cx = x * T + T / 2;
		const cy = this.rowY(r) + T / 2 - 6 + Math.sin(t * 4) * 2;
		const w = Math.max(2, Math.abs(Math.cos(t * 3)) * 11);
		shadow(ctx, cx, this.rowY(r) + T * 0.8, 9, 3);
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
		const py = this.rowY(0) + r * T;
		if (this.dying) {
			const k = this.dying.t / 0.9;
			if (this.dying.kind === 'splash') {
				ctx.strokeStyle = `rgba(220,240,255,${1 - k})`;
				ctx.lineWidth = 3;
				for (let i = 0; i < 3; i++) {
					ctx.beginPath();
					ctx.ellipse(px + T / 2, py + T / 2, 6 + k * 22 + i * 6, (6 + k * 22 + i * 6) * 0.5, 0, 0, Math.PI * 2);
					ctx.stroke();
				}
				if (k < 0.3) drawModel(ctx, ch.model, px, py + k * 30, 1, 1 - k * 3);
			} else {
				drawModel(ctx, ch.model, px, py, 1, 1 - k * 0.6, 0.15);
			}
			return;
		}
		shadow(ctx, px + T / 2, py + T * 0.78, 13 - lift / 3, 5);
		const hover = ch.id === 'dragonfly' ? Math.sin(this.time * 6) * 3 : 0;
		drawModel(ctx, ch.model, px, py - lift + hover);
	}

	private drawHud(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		ctx.fillStyle = '#123d24';
		ctx.fillRect(0, 0, GAME_W, HUD);
		ctx.fillStyle = '#0c2a19';
		ctx.fillRect(0, HUD - 3, GAME_W, 3);
		g.font(15, ARIAL_BLACK);
		if (this.state === 'play' || this.state === 'paused' || this.state === 'over') {
			g.setColor('#ffffff');
			g.drawString(`${this.score}`, 12, 26);
			g.setColor('#9be38a');
			g.font(12, ARIAL_BLACK);
			g.drawString(`LV ${this.level}`, 92, 26);
			// Timer bar.
			ctx.fillStyle = '#0c2a19';
			ctx.fillRect(150, 15, 150, 12);
			const k = Math.max(0, this.timer / ATTEMPT_TIME);
			ctx.fillStyle = k > 0.3 ? '#5fd35f' : '#ff6b4a';
			ctx.fillRect(150, 15, 150 * k, 12);
			// Lives.
			for (let i = 0; i < this.lives; i++) drawModel(ctx, CHARACTERS[0].model, 312 + i * 22, 14, 0.5);
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
		drawModel(ctx, ch.model, GAME_W / 2 - T * 0.9, 190 - bob, 1.8);
		ctx.textAlign = 'center';
		ctx.font = `bold 12px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText(ch.name, GAME_W / 2, 254);
		ctx.textAlign = 'left';
		MENU.forEach((m, i) => this.button(ctx, m.label, 140, 262 + i * 52, 240, 42, this.hover === i));
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
		this.title(ctx, 'HIGH SCORES', GAME_W / 2, 140, 40, '#ffe14a');
		const g = this.g;
		g.font(18, ARIAL_BLACK);
		g.setColor('#ffffff');
		g.drawString('Your best', 120, 200);
		g.drawRight(`${this.best}`, 400, 200);
		g.drawString('Games played', 120, 236);
		g.drawRight(`${this.games}`, 400, 236);
		g.drawString('Characters', 120, 272);
		g.drawRight(`${this.owned.length} / ${CHARACTERS.length}`, 400, 272);
		g.font(15, ARIAL_BLACK);
		g.setColor('#9be38a');
		g.drawString('GLOBAL RECORD', 120, 330);
		drawRecord(g, {
			global: this.global,
			board: 1,
			local: this.best,
			loggedIn: this.loggedIn,
			x: 120,
			y: 356,
			family: ARIAL,
			color: '#ffffff',
			dim: '#a9d8a0',
			size: 16,
			rows: 3
		});
	}

	private drawControls(ctx: CanvasRenderingContext2D) {
		this.back(ctx);
		this.title(ctx, 'HOW TO PLAY', GAME_W / 2, 140, 40, '#ffe14a');
		const lines: [string, string][] = [
			['W A S D', 'Hop (arrow keys work too)'],
			['Enter', 'Pause'],
			['Road', "Don't get hit by cars"],
			['River', 'Ride the logs and turtles'],
			['Goal', 'Fill all 5 lily pads to level up'],
			['Coins', 'Spend 30 on the gumball machine']
		];
		lines.forEach(([k, v], i) => {
			const y = 190 + i * 46;
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

		// Roll button and coins.
		const left = CHARACTERS.filter((c) => !this.owned.includes(c.id)).length;
		const can = this.coins >= ROLL_COST && left > 0 && !this.roll;
		this.button(ctx, left ? `Roll · ${ROLL_COST} coins` : 'All collected!', 300, 330, 196, 46, this.hover === 1 && can, !can);
		ctx.textAlign = 'center';
		ctx.font = `bold 13px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText(left ? `${left} swamp friends left to find` : 'You found every character!', 398, 400);
		ctx.textAlign = 'left';

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
				drawModel(ctx, ch.model, 398 - T * 1.2, 210 - (1 - k) * 20, 2.4, k);
				this.title(ctx, 'NEW!', 398, 160, 24, '#ffe14a');
				ctx.textAlign = 'center';
				ctx.font = `bold 16px ${ARIAL_BLACK}`;
				ctx.fillStyle = '#ffffff';
				ctx.fillText(ch.name, 398, 308);
				ctx.textAlign = 'left';
			}
		} else {
			const ch = characterById(this.selected);
			drawModel(ctx, ch.model, 398 - T * 1.1, 215, 2.2);
			ctx.textAlign = 'center';
			ctx.font = `bold 14px ${ARIAL_BLACK}`;
			ctx.fillStyle = '#ffffff';
			ctx.fillText(`Playing as ${ch.name}`, 398, 308);
			ctx.textAlign = 'left';
		}

		// Collection: click one you own to play as it.
		ctx.font = `bold 12px ${ARIAL}`;
		ctx.fillStyle = '#c9f5c0';
		ctx.fillText('Your collection: click one to play as it', 18, 470);
		CHARACTERS.forEach((c, i) => {
			const x = slotX(i);
			const own = this.owned.includes(c.id);
			ctx.fillStyle = c.id === this.selected ? '#ffe14a' : this.hover === 10 + i ? '#4cc55e' : 'rgba(255,255,255,0.12)';
			ctx.fillRect(x, 478, 42, 56);
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fillRect(x + 2, 480, 38, 52);
			if (own) drawModel(ctx, c.model, x + 1, 496, 1);
			else {
				ctx.font = `bold 22px ${ARIAL_BLACK}`;
				ctx.fillStyle = 'rgba(255,255,255,0.35)';
				ctx.textAlign = 'center';
				ctx.fillText('?', x + 21, 514);
				ctx.textAlign = 'left';
			}
		});
	}
}

const MENU = [
	{ id: 'play', label: 'New Game' },
	{ id: 'gumball', label: 'Gumball Machine' },
	{ id: 'scores', label: 'High Scores' },
	{ id: 'controls', label: 'How to Play' },
	{ id: 'quit', label: 'Quit' }
];
const slotX = (i: number) => 18 + i * 44;

/** Everything is drawn in code: nothing to load. */
export const loadAssets = async () => undefined;
