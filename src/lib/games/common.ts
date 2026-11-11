// Shared pieces for the E.Ngine Games ports (Edward's high-school Java games, redrawn on a <canvas>).
// Each game keeps its Java logic; this file is the browser plumbing around it.

/** Global high scores as the server returns them: top players per board, plus your own bests. */
export interface Board {
	/** This month's board, or all-time. */
	period?: 'month' | 'all';
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
	/** Touch screens: true while taps/swipes on the screen should steer (TouchSpec.gesture). */
	gestures?(): boolean;
	/** Touch screens: the on-screen buttons (by key code) that do nothing right now, shown greyed out. */
	disabledButtons?(): string[];
	/** Touch screens: the on-screen buttons (by key code) not shown right now (e.g. not unlocked yet). */
	hiddenButtons?(): string[];
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
	/** A finished run's score on a board (and, for games with levels, the level reached). */
	onScore: (board: number, score: number, level?: number) => void;
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
/** "Fredoka" (Google Fonts): round and bubbly, for Fishy. Trebuchet until it has loaded. */
export const BUBBLY = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';

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
		put(global.period === 'all' ? 'no global record yet' : 'no record this month yet', yy);
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
	put(opts.loggedIn ? `you${global.period === 'all' ? '' : ' this month'}: ${mine}` : `this browser: ${opts.local} · log in to rank`, yy);
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

// ── Menu UI: drawn buttons, cards, panels and key caps (the original art had its labels painted in) ──
// Menus are clicked or tapped. Each screen lists its buttons once (rect, look, action), and the same
// list is used to draw them, to show the hover highlight, and to handle clicks.

/** How one button state looks. */
export interface Look {
	fill: string;
	text: string;
	border: string;
	detail?: string;
}

/** A game's menu look: its lettering and colours. */
export interface UiTheme {
	family: string;
	size: number;
	detailSize?: number;
	radius: number;
	/** Upper-case labels (the arcade games' lettering). */
	caps?: boolean;
	borderWidth?: number;
	/** A soft glow around the hovered button. */
	glow?: string;
	/** Border of a hovered card (else the hover border). */
	cardHover?: string;
	idle: Look;
	hover: Look;
	/** The main action on a screen (Play, Buy…). */
	primary?: Look;
	/** Resets and other actions that can't be undone. */
	danger?: Look;
	/** A chosen option (current difficulty, ship…). */
	chosen?: Look;
	disabled: Look;
}

export interface UiButton {
	/** Stable id, for the hover highlight. */
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label?: string;
	/** A smaller second line. */
	detail?: string;
	kind?: 'primary' | 'danger';
	/** Shown as picked (e.g. the current difficulty). */
	chosen?: boolean;
	disabled?: boolean;
	/** Text size for this button (else the theme's). */
	size?: number;
	/** Extra drawing on top of the button (cards: sprites, stats…). */
	draw?: (ctx: CanvasRenderingContext2D, b: UiButton, look: Look) => void;
	onClick: () => void;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const rr = Math.max(0, Math.min(r, h / 2, w / 2));
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}

/** Which look a button has right now. */
export function lookOf(b: UiButton, theme: UiTheme, hovered: boolean): Look {
	if (b.disabled) return theme.disabled;
	// Cards (buttons with their own drawing) keep their look and just light up their border.
	if (hovered && b.draw) {
		const base = b.chosen && theme.chosen ? theme.chosen : theme.idle;
		return { ...base, border: theme.cardHover ?? theme.hover.border };
	}
	if (hovered) return theme.hover;
	if (b.chosen && theme.chosen) return theme.chosen;
	if (b.kind === 'danger' && theme.danger) return theme.danger;
	if (b.kind === 'primary' && theme.primary) return theme.primary;
	return theme.idle;
}

/** Draws a screen's buttons; `hover` is the id under the pointer. */
export function drawButtons(ctx: CanvasRenderingContext2D, buttons: UiButton[], theme: UiTheme, hover: string | null) {
	ctx.save();
	ctx.imageSmoothingEnabled = true;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const bw = theme.borderWidth ?? 2;
	for (const b of buttons) {
		const hovered = !b.disabled && b.id === hover;
		const look = lookOf(b, theme, hovered);
		roundRect(ctx, b.x + bw / 2, b.y + bw / 2, b.w - bw, b.h - bw, theme.radius);
		if (hovered && theme.glow) {
			ctx.shadowColor = theme.glow;
			ctx.shadowBlur = 16;
		}
		ctx.fillStyle = look.fill;
		ctx.fill();
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		if (bw > 0) {
			ctx.lineWidth = b.chosen && !b.disabled ? bw + 1 : bw;
			ctx.strokeStyle = look.border;
			ctx.stroke();
		}
		if (b.label) {
			const size = b.size ?? theme.size;
			const label = theme.caps ? b.label.toUpperCase() : b.label;
			const detail = b.detail && (theme.caps ? b.detail.toUpperCase() : b.detail);
			const ds = theme.detailSize ?? Math.round(size * 0.55);
			const cx = b.x + b.w / 2;
			const cy = b.y + b.h / 2;
			ctx.fillStyle = look.text;
			ctx.font = `bold ${size}px ${theme.family}`;
			if (detail) {
				const gap = 3;
				const top = cy - (size + gap + ds) / 2;
				ctx.fillText(label, cx, top + size / 2 + 1, b.w - 12);
				ctx.font = `${ds}px ${theme.family}`;
				ctx.fillStyle = look.detail ?? look.text;
				ctx.fillText(detail, cx, top + size + gap + ds / 2 + 1, b.w - 12);
			} else {
				ctx.fillText(label, cx, cy + 1, b.w - 12);
			}
		}
		if (b.draw) {
			ctx.save();
			b.draw(ctx, b, look);
			ctx.restore();
		}
	}
	ctx.restore();
}

/** The enabled button at a point, if any. */
export function buttonAt(buttons: UiButton[], x: number, y: number): UiButton | undefined {
	return buttons.find((b) => !b.disabled && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

/** Text with an explicit font, colour and alignment (restores the context after). */
export function text(
	ctx: CanvasRenderingContext2D,
	s: string,
	x: number,
	y: number,
	o: { size: number; family: string; color: string; bold?: boolean; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; max?: number }
) {
	ctx.save();
	ctx.font = `${o.bold === false ? '' : 'bold '}${o.size}px ${o.family}`;
	ctx.fillStyle = o.color;
	ctx.textAlign = o.align ?? 'left';
	ctx.textBaseline = o.baseline ?? 'middle';
	ctx.fillText(s, x, y, o.max);
	ctx.restore();
}

/** Wraps text into lines no wider than `w` (for descriptions). */
export function wrap(ctx: CanvasRenderingContext2D, s: string, w: number, font: string): string[] {
	ctx.save();
	ctx.font = font;
	const lines: string[] = [];
	let line = '';
	for (const word of s.split(' ')) {
		const next = line ? `${line} ${word}` : word;
		if (ctx.measureText(next).width > w && line) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	ctx.restore();
	return lines;
}

/** A filled, optionally outlined rounded panel. */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { fill: string; border?: string; radius?: number; width?: number; shadow?: string }) {
	ctx.save();
	roundRect(ctx, x, y, w, h, o.radius ?? 10);
	if (o.shadow) {
		ctx.shadowColor = o.shadow;
		ctx.shadowBlur = 20;
		ctx.shadowOffsetY = 6;
	}
	ctx.fillStyle = o.fill;
	ctx.fill();
	ctx.shadowColor = 'transparent';
	if (o.border) {
		ctx.lineWidth = o.width ?? 2;
		ctx.strokeStyle = o.border;
		ctx.stroke();
	}
	ctx.restore();
}

/** A keyboard key cap; returns its width (so several can sit in a row). */
export function keyCap(
	ctx: CanvasRenderingContext2D,
	label: string,
	x: number,
	y: number,
	o: { h?: number; min?: number; family: string; fill: string; text: string; border: string; size?: number }
): number {
	const h = o.h ?? 30;
	const size = o.size ?? 14;
	ctx.save();
	ctx.font = `bold ${size}px ${o.family}`;
	const w = Math.max(o.min ?? h, ctx.measureText(label).width + 16);
	roundRect(ctx, x, y + 3, w, h, 6);
	ctx.fillStyle = o.border;
	ctx.fill();
	roundRect(ctx, x, y, w, h, 6);
	ctx.fillStyle = o.fill;
	ctx.fill();
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = o.border;
	ctx.stroke();
	ctx.fillStyle = o.text;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, x + w / 2, y + h / 2 + 1);
	ctx.restore();
	return w;
}

/** A row of key caps separated by a small gap; returns the total width. */
export function keyRow(ctx: CanvasRenderingContext2D, keys: string[], x: number, y: number, o: Parameters<typeof keyCap>[4]): number {
	let cx = x;
	keys.forEach((k, i) => {
		cx += keyCap(ctx, k, cx, y, o) + (i < keys.length - 1 ? 6 : 0);
	});
	return cx - x;
}

/** Level pips: `of` slots, the first `n` filled. */
export function pips(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, of: number, o: { on: string; off: string; w?: number; h?: number; gap?: number }) {
	const w = o.w ?? 22, h = o.h ?? 8, gap = o.gap ?? 5;
	ctx.save();
	for (let i = 0; i < of; i++) {
		roundRect(ctx, x + i * (w + gap), y, w, h, h / 2);
		ctx.fillStyle = i < n ? o.on : o.off;
		ctx.fill();
	}
	ctx.restore();
}

/** A small padlock (locked options). */
export function padlock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = s * 0.16;
	ctx.beginPath();
	ctx.arc(cx, cy - s * 0.15, s * 0.28, Math.PI, 0);
	ctx.stroke();
	roundRect(ctx, cx - s * 0.42, cy - s * 0.15, s * 0.84, s * 0.65, s * 0.1);
	ctx.fill();
	ctx.restore();
}

/** Touch screens get "tap" wording instead of keyboard wording. */
export function touchScreen(): boolean {
	try {
		return matchMedia('(pointer: coarse)').matches;
	} catch {
		return false;
	}
}

/**
 * A two-step confirm for actions that can't be undone (reset scores…): the first click arms the
 * button for a few seconds, the second one does it.
 */
export class Confirm {
	private armed: string | null = null;
	private until = 0;
	/** True if `id` was armed (so this click should do it); otherwise arms it. */
	press(id: string): boolean {
		const now = performance.now();
		if (this.armed === id && now < this.until) {
			this.armed = null;
			return true;
		}
		this.armed = id;
		this.until = now + 3000;
		return false;
	}
	isArmed(id: string): boolean {
		return this.armed === id && performance.now() < this.until;
	}
	clear() {
		this.armed = null;
	}
}

// ── Game over: an arcade font, centred, dropping in as before ──

/** "Press Start 2P" (Google Fonts), for game-over titles; Arial Black until it has loaded. */
export const ARCADE = '"Press Start 2P", "Arial Black", sans-serif';
const webFonts = new Set<string>();
/** Loads a Google font once (`query` as in its css2 URL; `probe` a CSS font naming it). */
function loadWebFont(query: string, probes: string[]) {
	if (webFonts.has(query) || typeof document === 'undefined') return;
	webFonts.add(query);
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
	// Canvas text doesn't ask for fonts by itself: load the faces now.
	link.onload = () => probes.forEach((f) => void document.fonts?.load(f).catch(() => {}));
	document.head.appendChild(link);
}
/** Loads the arcade font once (the first game that needs it). */
export function loadArcadeFont() {
	loadWebFont('Press+Start+2P', ['32px "Press Start 2P"']);
}
/** Loads Fredoka (regular and bold) once. */
export function loadBubblyFont() {
	loadWebFont('Fredoka:wght@400;600;700', ['400 20px "Fredoka"', '600 20px "Fredoka"', '700 20px "Fredoka"']);
}

/**
 * The game-over title, centred at `y` (which the game animates down from above the screen), with
 * lines under it once it has landed.
 */
export function drawGameOver(
	ctx: CanvasRenderingContext2D,
	o: { width: number; height: number; y: number; landed: boolean; title?: string; color: string; lines: string[] }
) {
	ctx.save();
	ctx.fillStyle = 'rgba(0,0,0,0.55)';
	ctx.fillRect(0, 0, o.width, o.height);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const title = o.title ?? 'GAME OVER';
	let size = 40;
	ctx.font = `${size}px ${ARCADE}`;
	while (ctx.measureText(title).width > o.width - 40 && size > 16) ctx.font = `${(size -= 2)}px ${ARCADE}`;
	ctx.shadowColor = o.color;
	ctx.shadowBlur = 18;
	ctx.fillStyle = o.color;
	ctx.fillText(title, o.width / 2, o.y);
	ctx.shadowBlur = 0;
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.strokeText(title, o.width / 2, o.y);
	if (o.landed) {
		ctx.fillStyle = '#fff';
		o.lines.forEach((line, i) => {
			ctx.font = `${i == o.lines.length - 1 ? 10 : 14}px ${ARCADE}`;
			if (i == o.lines.length - 1) ctx.fillStyle = 'rgba(255,255,255,0.75)';
			ctx.fillText(line, o.width / 2, o.y + 56 + i * 30);
		});
	}
	ctx.restore();
}
