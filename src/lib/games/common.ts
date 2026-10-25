// Shared pieces for the E.Ngine Games ports (Edward's high-school Java games, redrawn on a <canvas>).
// Each game keeps its Java logic; this file is the browser plumbing around it.

/** Global high scores as the server returns them: top players per board, plus your own bests. */
export interface Board {
	missions: Record<number, { name: string; score: number }[]>;
	you?: Record<number, number>;
}

/** What the game host (ArcadeGame.svelte) needs from a game. */
export interface ArcadeGame {
	/** One fixed-rate step of the game loop (the Java `run()` body). */
	tick(): void;
	paint(ctx: CanvasRenderingContext2D, now: number): void;
	/** Return true if the key belongs to the game (so the page doesn't scroll etc.). */
	keyPressed(code: string): boolean;
	keyReleased(code: string): boolean;
	/** Mouse over the canvas (game coordinates). Returns true over something clickable. */
	pointerMove(x: number, y: number): boolean;
	pointerDown(x: number, y: number): void;
	/** Persist progress and local stats (localStorage). */
	save(): void;
	/** Sound effects: the host sets this; the game calls it with a sound's name. */
	sfx: (name: string) => void;
	/** The soundtrack for what's on screen ('<game>-menu', '<game>-<difficulty>'…), or null for silence. */
	musicTrack(): string | null;
	/**
	 * The player left the game (Esc, ✕ or a click outside the pop-up) mid-run: count the run's score
	 * now, as quitting from the game's own menu would (local high scores and onScore).
	 */
	leave(): void;
	/** The player picked Quit / Exit on the game's own menu. */
	onQuit: () => void;
	/** A run ended with this score, on this board (mission, mode or difficulty). */
	onScore: (board: number, score: number) => void;
	/** Global high scores from the server; null until loaded (screens fall back to local scores). */
	global: Board | null;
	/** Whether the player is signed in (their scores count on the global board). */
	loggedIn: boolean;
}

/** A clickable area on a menu screen. `hover` runs while the mouse is over it (moves the menu cursor). */
export interface Hotspot {
	x: number;
	y: number;
	w: number;
	h: number;
	hover?: () => void;
	click: () => void;
}

export function spotAt(spots: Hotspot[], x: number, y: number): Hotspot | undefined {
	return spots.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load ${src}`));
		img.src = src;
	});
}

/** Load a set of images ({ name: file }) from one folder. */
export async function loadImages<K extends string>(base: string, files: Record<K, string>): Promise<Record<K, HTMLImageElement>> {
	const names = Object.keys(files) as K[];
	const imgs = await Promise.all(names.map((n) => loadImage(base + files[n])));
	return Object.fromEntries(names.map((n, i) => [n, imgs[i]])) as Record<K, HTMLImageElement>;
}

/** Saved stats (localStorage), merged over the defaults so new fields survive old saves. */
export function loadSave<T extends object>(key: string, defaults: T): T {
	try {
		const raw = localStorage.getItem(key);
		if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
	} catch {
		/* blocked or corrupt: start fresh */
	}
	return { ...defaults };
}
export function writeSave(key: string, data: object) {
	try {
		localStorage.setItem(key, JSON.stringify(data));
	} catch {
		/* storage full or blocked */
	}
}

/**
 * The bits of java.awt.Graphics2D the games use: a current colour and font, and drawString at a
 * baseline. Fonts are bold, as in the Java code (new Font(name, 1, size)).
 */
export class Gfx {
	ctx!: CanvasRenderingContext2D;
	color = 'rgb(51,51,51)';

	begin(ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
		ctx.imageSmoothingEnabled = true;
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
	}
	setColor(c: string) {
		this.color = c;
	}
	font(px: number, family: string, bold = true) {
		this.ctx.font = `${bold ? 'bold ' : ''}${px}px ${family}`;
	}
	img(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
		if (w <= 0 || h <= 0) return;
		this.ctx.drawImage(img, x, y, w, h);
	}
	fillRect(x: number, y: number, w: number, h: number) {
		if (w <= 0 || h <= 0) return;
		this.ctx.fillStyle = this.color;
		this.ctx.fillRect(x, y, w, h);
	}
	fillOval(x: number, y: number, w: number, h: number) {
		if (w <= 0 || h <= 0) return;
		const c = this.ctx;
		c.fillStyle = this.color;
		c.beginPath();
		c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
		c.fill();
	}
	drawString(s: string, x: number, y: number) {
		this.ctx.fillStyle = this.color;
		this.ctx.fillText(s, x, y);
	}
	width(s: string) {
		return this.ctx.measureText(s).width;
	}
	/** Right-aligned text ending at x. */
	drawRight(s: string, x: number, y: number) {
		this.drawString(s, x - this.width(s), y);
	}
}

export const ARIAL_BLACK = '"Arial Black", "Arial Bold", Gadget, Arial, sans-serif';
export const ARIAL = 'Arial, Helvetica, sans-serif';
export const COMIC = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive';

/**
 * Global board for one mode, drawn on a game's high-scores screen: the record holder, and your
 * own best (or this browser's best when signed out).
 */
export function drawRecord(
	g: Gfx,
	opts: {
		global: Board | null;
		board: number;
		local: number;
		loggedIn: boolean;
		x: number;
		y: number;
		align?: 'left' | 'right';
		family: string;
		color: string;
		dim: string;
		size?: number;
		rows?: number;
	}
) {
	const { global, board, x, y, family, color, dim } = opts;
	const size = opts.size ?? 15;
	const rows = opts.rows ?? 1;
	const put = (s: string, yy: number) => (opts.align === 'right' ? g.drawRight(s, x, yy) : g.drawString(s, x, yy));
	const list = global?.missions[board] ?? [];
	let yy = y;
	g.font(size, family);
	if (!global) {
		g.setColor(dim);
		put('global board loading…', yy);
		return;
	}
	if (list.length === 0) {
		g.setColor(dim);
		put('no global record yet', yy);
		yy += size + 5;
	}
	list.slice(0, rows).forEach((e, i) => {
		g.setColor(color);
		put(`${rows > 1 ? `${i + 1}. ` : ''}${e.name}  ${e.score}`, yy);
		yy += size + 5;
	});
	g.setColor(dim);
	g.font(size - 2, family, false);
	const mine = opts.loggedIn ? (global.you?.[board] ?? 0) : opts.local;
	put(opts.loggedIn ? `you: ${mine}` : `this browser: ${mine} · log in to rank`, yy);
}

/**
 * Pixel-perfect collision masks (Fishy): which pixels of an image are solid, so two sprites only
 * "touch" where both are actually drawn, not where their bounding boxes overlap.
 */
export class Mask {
	readonly w: number;
	readonly h: number;
	private solid: Uint8Array;

	constructor(img: HTMLImageElement, threshold = 96) {
		this.w = img.naturalWidth;
		this.h = img.naturalHeight;
		const c = document.createElement('canvas');
		c.width = this.w;
		c.height = this.h;
		const ctx = c.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(img, 0, 0);
		const data = ctx.getImageData(0, 0, this.w, this.h).data;
		this.solid = new Uint8Array(this.w * this.h);
		for (let i = 0; i < this.solid.length; i++) this.solid[i] = data[i * 4 + 3] > threshold ? 1 : 0;
	}

	/** Is the image pixel under world point (px, py) solid, when drawn at (x, y, w, h)? */
	at(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
		const u = Math.floor(((px - x) * this.w) / w);
		const v = Math.floor(((py - y) * this.h) / h);
		if (u < 0 || v < 0 || u >= this.w || v >= this.h) return false;
		return this.solid[v * this.w + u] === 1;
	}
}

export interface Sprite {
	mask: Mask;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Do two drawn sprites share at least one solid pixel? (optionally only inside `clip`) */
export function pixelsTouch(a: Sprite, b: Sprite, clip?: { x: number; y: number; w: number; h: number }): boolean {
	let x0 = Math.max(a.x, b.x);
	let y0 = Math.max(a.y, b.y);
	let x1 = Math.min(a.x + a.w, b.x + b.w);
	let y1 = Math.min(a.y + a.h, b.y + b.h);
	if (clip) {
		x0 = Math.max(x0, clip.x);
		y0 = Math.max(y0, clip.y);
		x1 = Math.min(x1, clip.x + clip.w);
		y1 = Math.min(y1, clip.y + clip.h);
	}
	if (x1 <= x0 || y1 <= y0) return false;
	// Big overlaps are sampled every other pixel: still far finer than the fish outlines.
	const step = (x1 - x0) * (y1 - y0) > 6000 ? 2 : 1;
	for (let py = y0; py < y1; py += step) {
		for (let px = x0; px < x1; px += step) {
			if (a.mask.at(px + 0.5, py + 0.5, a.x, a.y, a.w, a.h) && b.mask.at(px + 0.5, py + 0.5, b.x, b.y, b.w, b.h)) return true;
		}
	}
	return false;
}
