// Block Drop: an original falling-block puzzle game for E.Ngine Games. Seven shapes of four blocks
// fall into a 10 × 20 well; fill a row and it clears. Classic scoring (40 / 100 / 300 / 1200 points
// × level for 1-4 rows at once), the level goes up every 10 rows and pieces fall faster. Pieces come
// from a shuffled bag of all seven, so droughts are short.
//
// Keys: A / D or ← / → move (hold to slide), S or ↓ soft drop, W / ↑ / X rotate clockwise,
// Q / Z rotate the other way, Space hard drop, Enter pause. Menus are clicked or tapped.
import { ARCADE, Confirm, buttonAt, drawButtons, drawGameOver, drawRecord, Gfx, loadArcadeFont, loadSave, panel, roundRect, text, touchScreen, writeSave, type ArcadeGame, type Board, type UiButton, type UiTheme } from '../common';

export const GAME_W = 480;
export const GAME_H = 600;
export const TICK_MS = 16; // ~60 steps a second

const SAVE_KEY = 'blockdrop-save';
const COLS = 10;
const ROWS = 20;
const CELL = 28;
const BX = 20; // the well's position
const BY = 20;

// The seven shapes (rotation states as cells in a 4×4 box), with their colours.
type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
const SHAPES: Record<Kind, number[][]> = {
	I: [[4, 5, 6, 7], [2, 6, 10, 14], [8, 9, 10, 11], [1, 5, 9, 13]],
	O: [[1, 2, 5, 6], [1, 2, 5, 6], [1, 2, 5, 6], [1, 2, 5, 6]],
	T: [[1, 4, 5, 6], [1, 5, 6, 9], [4, 5, 6, 9], [1, 4, 5, 9]],
	S: [[1, 2, 4, 5], [1, 5, 6, 10], [5, 6, 8, 9], [0, 4, 5, 9]],
	Z: [[0, 1, 5, 6], [2, 5, 6, 9], [4, 5, 9, 10], [1, 4, 5, 8]],
	J: [[0, 4, 5, 6], [1, 2, 5, 9], [4, 5, 6, 10], [1, 5, 8, 9]],
	L: [[2, 4, 5, 6], [1, 5, 9, 10], [4, 5, 6, 8], [0, 1, 5, 9]]
};
const COLORS: Record<Kind, string> = {
	I: '#3ee0ff', O: '#ffd23e', T: '#c46bff', S: '#5cf28a', Z: '#ff5d73', J: '#4f7dff', L: '#ff9d3e'
};
const KINDS = Object.keys(SHAPES) as Kind[];
/** Steps (at ~60 a second) per row of falling, by level. */
const GRAVITY = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1];
const POINTS = [0, 40, 100, 300, 1200];
/** Holding left / right: wait this many steps, then slide one column every so many. */
const DAS = 10, ARR = 3;
/** A piece resting on something locks after this many steps (unless it moves off). */
const LOCK = 28;

const UI: UiTheme = {
	family: ARCADE,
	size: 16,
	detailSize: 9,
	radius: 8,
	borderWidth: 2,
	glow: 'rgba(62,224,255,0.5)',
	idle: { fill: 'rgba(255,255,255,0.05)', text: '#e8ecf5', border: 'rgba(255,255,255,0.25)', detail: 'rgba(232,236,245,0.6)' },
	hover: { fill: '#3ee0ff', text: '#05070d', border: '#3ee0ff', detail: '#05070d' },
	primary: { fill: '#c46bff', text: '#fff', border: '#c46bff', detail: 'rgba(255,255,255,0.85)' },
	disabled: { fill: 'rgba(255,255,255,0.03)', text: 'rgba(232,236,245,0.3)', border: 'rgba(255,255,255,0.1)' }
};

interface Piece {
	kind: Kind;
	rot: number;
	x: number;
	y: number;
}

export class BlockDrop implements ArcadeGame {
	screen: 'menu' | 'play' | 'paused' | 'over' = 'menu';
	well: (Kind | null)[] = [];
	piece: Piece | null = null;
	next: Kind = 'T';
	bag: Kind[] = [];
	score = 0;
	lines = 0;
	level = 0;
	startLevel = 0;
	best = 0;
	games = 0;
	totalLines = 0;
	/** Rows being cleared (flashing), and how long the flash has left. */
	clearing: number[] = [];
	clearTimer = 0;
	fall = 0;
	lockTimer = 0;
	held = new Set<string>();
	slide = { dir: 0, timer: 0 };
	softDrop = false;
	goy = -60;

	sfx: (name: string) => void = () => {};
	onQuit: () => void = () => {};
	onScore: (board: number, score: number) => void = () => {};
	global: Board | null = null;
	loggedIn = false;
	private hover: string | null = null;
	private confirm = new Confirm();
	private g = new Gfx();

	constructor() {
		loadArcadeFont();
		Object.assign(this, loadSave(SAVE_KEY, { best: 0, startLevel: 0, games: 0, totalLines: 0 }));
		this.startLevel = Math.max(0, Math.min(9, this.startLevel | 0));
	}

	save() {
		const { best, startLevel, games, totalLines } = this;
		writeSave(SAVE_KEY, { best, startLevel, games, totalLines });
	}
	musicTrack() {
		if (this.screen == 'play' || this.screen == 'paused') return 'blockdrop-play';
		return 'blockdrop-menu';
	}
	disabledButtons() {
		return this.screen == 'play' ? [] : ['Space', 'KeyW'];
	}
	leave() {
		// Leaving mid-game still counts the score.
		if ((this.screen == 'play' || this.screen == 'paused') && this.score > 0) this.endGame(false);
		this.save();
	}

	// ── Game ──
	private start() {
		this.well = Array(COLS * ROWS).fill(null);
		this.bag = [];
		this.score = 0;
		this.lines = 0;
		this.level = this.startLevel;
		this.clearing = [];
		this.fall = 0;
		this.goy = -60;
		this.next = this.draw();
		this.spawn();
		this.screen = 'play';
		this.games++;
		this.save();
	}
	/** The next shape from the bag (a fresh shuffled set of all seven when it runs out). */
	private draw(): Kind {
		if (!this.bag.length) {
			this.bag = [...KINDS];
			for (let i = this.bag.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
			}
		}
		return this.bag.pop()!;
	}
	private spawn() {
		this.piece = { kind: this.next, rot: 0, x: 3, y: this.next == 'I' ? -1 : 0 };
		this.next = this.draw();
		this.lockTimer = 0;
		this.fall = 0;
		if (!this.fits(this.piece)) this.endGame(true);
	}
	private cells(p: Piece): [number, number][] {
		return SHAPES[p.kind][p.rot].map((c) => [p.x + (c & 3), p.y + (c >> 2)]);
	}
	private fits(p: Piece): boolean {
		return this.cells(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !this.well[y * COLS + x]));
	}
	private move(dx: number, dy: number): boolean {
		const p = this.piece!;
		const n = { ...p, x: p.x + dx, y: p.y + dy };
		if (!this.fits(n)) return false;
		this.piece = n;
		if (dx) this.lockTimer = 0;
		return true;
	}
	private rotate(dir: 1 | -1) {
		const p = this.piece!;
		const rot = (p.rot + dir + 4) % 4;
		// Try in place, then nudged sideways or up (wall and floor kicks).
		for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
			const n = { ...p, rot, x: p.x + kx, y: p.y + ky };
			if (this.fits(n)) {
				this.piece = n;
				this.lockTimer = 0;
				this.sfx('rotate');
				return;
			}
		}
	}
	private hardDrop() {
		let n = 0;
		while (this.move(0, 1)) n++;
		this.score += n * 2;
		this.lock();
	}
	private lock() {
		const p = this.piece!;
		for (const [x, y] of this.cells(p)) {
			if (y < 0) return this.endGame(true); // locked above the top
			this.well[y * COLS + x] = p.kind;
		}
		this.piece = null;
		const full = [];
		for (let y = 0; y < ROWS; y++) if (this.well.slice(y * COLS, y * COLS + COLS).every(Boolean)) full.push(y);
		if (full.length) {
			this.clearing = full;
			this.clearTimer = 18;
			this.sfx(full.length == 4 ? 'four' : 'clear');
		} else {
			this.sfx('lock');
			this.spawn();
		}
	}
	private finishClear() {
		const n = this.clearing.length;
		for (const y of this.clearing) {
			this.well.splice(y * COLS, COLS);
			this.well.unshift(...Array(COLS).fill(null));
		}
		this.clearing = [];
		this.score += POINTS[n] * (this.level + 1);
		this.lines += n;
		this.totalLines += n;
		const level = Math.max(this.startLevel, Math.floor(this.lines / 10));
		if (level > this.level) {
			this.level = level;
			this.sfx('levelUp');
		}
		this.spawn();
	}
	private endGame(lost: boolean) {
		if (this.score > this.best) this.best = this.score;
		this.onScore(1, this.score);
		this.save();
		if (lost) {
			this.screen = 'over';
			this.piece = null;
			this.sfx('lose');
		}
	}

	tick() {
		if (this.screen == 'over' && this.goy < 250) this.goy += 8;
		if (this.screen != 'play') return;
		if (this.clearing.length) {
			if (--this.clearTimer <= 0) this.finishClear();
			return;
		}
		if (!this.piece) return;
		// Sliding while left / right is held.
		const dir = this.held.has('L') && !this.held.has('R') ? -1 : this.held.has('R') && !this.held.has('L') ? 1 : 0;
		if (dir != this.slide.dir) this.slide = { dir, timer: 0 };
		else if (dir) {
			this.slide.timer++;
			if (this.slide.timer >= DAS && (this.slide.timer - DAS) % ARR == 0 && this.move(dir, 0)) this.sfx('move');
		}
		// Falling (faster while soft-dropping).
		const speed = this.softDrop ? Math.min(2, GRAVITY[Math.min(this.level, GRAVITY.length - 1)]) : GRAVITY[Math.min(this.level, GRAVITY.length - 1)];
		if (++this.fall >= speed) {
			this.fall = 0;
			if (this.move(0, 1)) {
				if (this.softDrop) this.score += 1;
			}
		}
		// Resting on something: lock after a moment.
		const resting = !this.fits({ ...this.piece, y: this.piece.y + 1 });
		if (resting) {
			if (++this.lockTimer >= (this.softDrop ? 4 : LOCK)) this.lock();
		} else this.lockTimer = 0;
	}

	// ── Keys ──
	keyPressed(code: string): boolean {
		const k = KEY[code];
		if (!k) return false;
		if (this.screen == 'paused') {
			if (k == 'pause') this.screen = 'play';
			return true;
		}
		if (this.screen == 'over') {
			if (k == 'pause') this.screen = 'menu';
			return true;
		}
		if (this.screen != 'play' || !this.piece || this.clearing.length) {
			if (k == 'L' || k == 'R') this.held.add(k);
			return true;
		}
		if (k == 'L' || k == 'R') {
			if (!this.held.has(k) && this.move(k == 'L' ? -1 : 1, 0)) this.sfx('move');
			this.held.add(k);
		}
		if (k == 'down') this.softDrop = true;
		if (k == 'cw') this.rotate(1);
		if (k == 'ccw') this.rotate(-1);
		if (k == 'drop') this.hardDrop();
		if (k == 'pause') {
			this.screen = 'paused';
			this.sfx('confirm');
		}
		return true;
	}
	keyReleased(code: string): boolean {
		const k = KEY[code];
		if (!k) return false;
		if (k == 'L' || k == 'R') this.held.delete(k);
		if (k == 'down') this.softDrop = false;
		return true;
	}

	// ── Menus (clicked or tapped) ──
	private ui(): UiButton[] {
		const cx = GAME_W / 2;
		if (this.screen == 'menu') {
			return [
				{ id: 'play', label: 'Play', x: cx - 110, y: 250, w: 220, h: 54, kind: 'primary', size: 20, onClick: () => this.start() },
				{ id: 'lvl-', label: '‹', x: cx - 110, y: 330, w: 44, h: 44, size: 18, disabled: this.startLevel == 0, onClick: () => this.setLevel(-1) },
				{ id: 'lvl+', label: '›', x: cx + 66, y: 330, w: 44, h: 44, size: 18, disabled: this.startLevel == 9, onClick: () => this.setLevel(1) },
				{ id: 'quit', label: 'Quit', x: cx - 110, y: 520, w: 220, h: 44, onClick: () => { this.save(); this.onQuit(); } }
			];
		}
		if (this.screen == 'paused') {
			return [
				{ id: 'resume', label: 'Resume', x: cx - 110, y: 260, w: 220, h: 50, kind: 'primary', onClick: () => (this.screen = 'play') },
				{ id: 'menu', label: 'Main menu', x: cx - 110, y: 324, w: 220, h: 50, onClick: () => { this.endGame(false); this.screen = 'menu'; } }
			];
		}
		if (this.screen == 'over' && this.goy >= 250) {
			return [
				{ id: 'again', label: 'Play again', x: cx - 110, y: 420, w: 220, h: 50, kind: 'primary', onClick: () => this.start() },
				{ id: 'menu', label: 'Main menu', x: cx - 110, y: 482, w: 220, h: 50, onClick: () => (this.screen = 'menu') }
			];
		}
		return [];
	}
	private setLevel(d: number) {
		this.startLevel = Math.max(0, Math.min(9, this.startLevel + d));
		this.save();
	}
	pointerMove(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		this.hover = b?.id ?? null;
		return !!b;
	}
	pointerDown(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		if (!b) return;
		this.sfx('confirm');
		this.confirm.clear();
		b.onClick();
		this.hover = null;
	}

	// ── Drawing ──
	private block(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha = 1, size = CELL) {
		ctx.globalAlpha = alpha;
		const g = ctx.createLinearGradient(x, y, x, y + size);
		g.addColorStop(0, color);
		g.addColorStop(1, shade(color, -0.35));
		roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 5);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.fillStyle = 'rgba(255,255,255,0.35)';
		ctx.fillRect(x + 4, y + 3, size - 8, 3);
		ctx.globalAlpha = 1;
	}

	paint(ctx: CanvasRenderingContext2D, now: number) {
		this.g.begin(ctx);
		const bg = ctx.createLinearGradient(0, 0, 0, GAME_H);
		bg.addColorStop(0, '#120b2e');
		bg.addColorStop(1, '#05030f');
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		if (this.screen == 'menu') return this.paintMenu(ctx, now);

		// The well.
		panel(ctx, BX - 6, BY - 6, COLS * CELL + 12, ROWS * CELL + 12, { fill: 'rgba(0,0,0,0.45)', border: 'rgba(196,107,255,0.6)', width: 2, radius: 10 });
		ctx.strokeStyle = 'rgba(255,255,255,0.04)';
		ctx.lineWidth = 1;
		for (let x = 1; x < COLS; x++) {
			ctx.beginPath();
			ctx.moveTo(BX + x * CELL, BY);
			ctx.lineTo(BX + x * CELL, BY + ROWS * CELL);
			ctx.stroke();
		}
		const flash = this.clearing.length && Math.floor(this.clearTimer / 3) % 2 == 0;
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const k = this.well[y * COLS + x];
				if (!k) continue;
				if (this.clearing.includes(y)) this.block(ctx, BX + x * CELL, BY + y * CELL, flash ? '#ffffff' : COLORS[k]);
				else this.block(ctx, BX + x * CELL, BY + y * CELL, COLORS[k]);
			}
		}
		if (this.piece) {
			// Ghost: where it would land.
			let gy = this.piece.y;
			while (this.fits({ ...this.piece, y: gy + 1 })) gy++;
			for (const [x, y] of this.cells({ ...this.piece, y: gy })) {
				if (y < 0) continue;
				ctx.strokeStyle = COLORS[this.piece.kind];
				ctx.globalAlpha = 0.45;
				ctx.lineWidth = 2;
				roundRect(ctx, BX + x * CELL + 3, BY + y * CELL + 3, CELL - 6, CELL - 6, 4);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			for (const [x, y] of this.cells(this.piece)) if (y >= 0) this.block(ctx, BX + x * CELL, BY + y * CELL, COLORS[this.piece.kind]);
		}

		// Side panel: next piece and numbers.
		const sx = 322;
		text(ctx, 'NEXT', sx, 34, { size: 12, family: ARCADE, color: '#c46bff' });
		panel(ctx, sx, 48, 136, 92, { fill: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', radius: 10 });
		const cells = SHAPES[this.next][0];
		const xs = cells.map((c) => c & 3), ys = cells.map((c) => c >> 2);
		const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
		for (const c of cells) {
			this.block(ctx, sx + 68 - (w * 22) / 2 + ((c & 3) - Math.min(...xs)) * 22, 94 - (h * 22) / 2 + ((c >> 2) - Math.min(...ys)) * 22, COLORS[this.next], 1, 22);
		}
		const stat = (label: string, value: string, y: number) => {
			text(ctx, label, sx, y, { size: 11, family: ARCADE, color: '#94a3b8' });
			text(ctx, value, sx, y + 24, { size: 18, family: ARCADE, color: '#fff' });
		};
		stat('SCORE', '' + this.score, 176);
		stat('LINES', '' + this.lines, 240);
		stat('LEVEL', '' + this.level, 304);
		stat('BEST', '' + Math.max(this.best, this.score), 368);
		if (!touchScreen()) {
			const help = ['A D  move', 'S  soft drop', 'W  rotate', 'Space  drop', 'Enter  pause'];
			help.forEach((h, i) => text(ctx, h, sx, 450 + i * 20, { size: 9, family: ARCADE, color: 'rgba(255,255,255,0.45)', bold: false }));
		}

		if (this.screen == 'paused') {
			ctx.fillStyle = 'rgba(5,3,15,0.7)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			text(ctx, 'PAUSED', GAME_W / 2, 200, { size: 30, family: ARCADE, color: '#3ee0ff', align: 'center' });
		}
		if (this.screen == 'over') {
			drawGameOver(ctx, {
				width: GAME_W, height: GAME_H, y: this.goy, landed: this.goy >= 250, color: '#ff5d73',
				lines: [`SCORE ${this.score}`, `LINES ${this.lines}`, touchScreen() ? 'TAP A BUTTON' : 'ENTER FOR THE MENU']
			});
		}
		drawButtons(ctx, this.ui(), UI, this.hover);
	}

	private paintMenu(ctx: CanvasRenderingContext2D, now: number) {
		// Falling blocks behind the title.
		for (let i = 0; i < 14; i++) {
			const k = KINDS[i % 7];
			const y = ((now / 18 + i * 97) % (GAME_H + 80)) - 60;
			this.block(ctx, (i * 61) % (GAME_W - 30), y, COLORS[k], 0.18);
		}
		// Title in blocks of colour.
		text(ctx, 'BLOCK', GAME_W / 2, 110, { size: 44, family: ARCADE, color: '#3ee0ff', align: 'center' });
		text(ctx, 'DROP', GAME_W / 2, 170, { size: 44, family: ARCADE, color: '#c46bff', align: 'center' });
		text(ctx, 'START LEVEL', GAME_W / 2, 320, { size: 11, family: ARCADE, color: '#94a3b8', align: 'center' });
		text(ctx, '' + this.startLevel, GAME_W / 2, 353, { size: 24, family: ARCADE, color: '#fff', align: 'center' });
		text(ctx, `BEST ${this.best}`, GAME_W / 2, 410, { size: 12, family: ARCADE, color: '#ffd23e', align: 'center' });
		ctx.save();
		ctx.textAlign = 'center';
		drawRecord(this.g, { global: this.global, board: 1, local: this.best, loggedIn: this.loggedIn, x: GAME_W / 2, y: 444, family: 'Arial, sans-serif', color: '#e8ecf5', dim: 'rgba(232,236,245,0.6)', size: 13 });
		ctx.restore();
		drawButtons(ctx, this.ui(), UI, this.hover);
	}
}

const KEY: Record<string, 'L' | 'R' | 'down' | 'cw' | 'ccw' | 'drop' | 'pause'> = {
	KeyA: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R', KeyS: 'down', ArrowDown: 'down',
	KeyW: 'cw', ArrowUp: 'cw', KeyX: 'cw', KeyQ: 'ccw', KeyZ: 'ccw', Space: 'drop', Enter: 'pause', NumpadEnter: 'pause'
};

/** A colour made lighter (amount > 0) or darker. */
function shade(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1), 16);
	const f = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
	return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function create() {
	return new BlockDrop();
}
