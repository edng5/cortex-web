// Keyboard Karaoke: dance mode. Nine panels, like a 3×3 dance pad (the eight arrows and the
// centre); arrows rise up the screen to the targets at the top and you step on them in time.
//
// The steps aren't random: they're choreographed from the song itself.
//  - Rhythm: a step on each sung note or word (thinned for easier levels), and during the
//    instrumental breaks a groove on the song's own pulse, so you keep dancing between lines.
//  - Melody: the moves follow the tune. A line that climbs steps up the pad, one that falls steps
//    back down; a big leap in pitch is a big step (to a corner).
//  - Structure: each line of lyrics gets its own move (a box step, a sway, a V, a spin…) chosen
//    from its words, so when a line comes back (the chorus) its dance comes back too. Choruses get
//    bigger moves and jumps; verses calmer ones. Long held notes are held steps (freezes); each
//    line ends back in the middle.
//  - Feet: left-side panels for the left foot, right-side for the right, alternating, with no
//    crossovers or awkward double-steps on easier levels.
import type { Chart, Line } from './chart';
import type { KeyNote } from './keys';

/** The nine panels, as lanes left to right on screen: the left foot's three, the middle, the right foot's. */
export const PANELS = 9;
type Dir = 'ul' | 'l' | 'dl' | 'd' | 'c' | 'u' | 'dr' | 'r' | 'ur';
export const LANE_DIRS: Dir[] = ['ul', 'l', 'dl', 'd', 'c', 'u', 'dr', 'r', 'ur'];
/** Where each is on the pad (column, row; row 0 is the top). */
const GRID: Record<Dir, [number, number]> = { ul: [0, 0], u: [1, 0], ur: [2, 0], l: [0, 1], c: [1, 1], r: [2, 1], dl: [0, 2], d: [1, 2], dr: [2, 2] };
const AT: Dir[][] = [
	['ul', 'u', 'ur'],
	['l', 'c', 'r'],
	['dl', 'd', 'dr']
];
const laneOf = (d: Dir) => LANE_DIRS.indexOf(d);
export const PANEL_COLORS: Record<Dir, string> = { ul: '#f472b6', u: '#38bdf8', ur: '#f472b6', l: '#a78bfa', c: '#facc15', r: '#a78bfa', dl: '#fb923c', d: '#38bdf8', dr: '#fb923c' };
export const LANE_COLOR = (lane: number) => PANEL_COLORS[LANE_DIRS[lane]];
/** The arrow's angle (radians, 0 = pointing up), or null for the centre. */
const ANGLE: Record<Dir, number | null> = { u: 0, ur: Math.PI / 4, r: Math.PI / 2, dr: (3 * Math.PI) / 4, d: Math.PI, dl: (-3 * Math.PI) / 4, l: -Math.PI / 2, ul: -Math.PI / 4, c: null };
export const ARROW_GLYPH: Record<Dir, string> = { ul: '↖', u: '↑', ur: '↗', l: '←', c: '●', r: '→', dl: '↙', d: '↓', dr: '↘' };

// ── The pad: which button is which panel ──
/**
 * A binding: a keyboard key ("k:Numpad8"), a gamepad button ("b:3") or a gamepad axis pushed one
 * way ("a:1-" / "a:1+"). Most dance pads plug in as a keyboard (set in their own software) or as a
 * gamepad; either way, step on each panel once in the setup and it's learned.
 */
export type PadMap = Record<number, string[]>;
/** Out of the box: the number pad (7 8 9 / 4 5 6 / 1 2 3), the arrow keys, and Q W E / A S D / Z X C. */
export function defaultPadMap(): PadMap {
	const pad: Record<Dir, string[]> = {
		ul: ['k:Numpad7', 'k:KeyQ'],
		u: ['k:Numpad8', 'k:ArrowUp', 'k:KeyW'],
		ur: ['k:Numpad9', 'k:KeyE'],
		l: ['k:Numpad4', 'k:ArrowLeft', 'k:KeyA'],
		c: ['k:Numpad5', 'k:KeyS'],
		r: ['k:Numpad6', 'k:ArrowRight', 'k:KeyD'],
		dl: ['k:Numpad1', 'k:KeyZ'],
		d: ['k:Numpad2', 'k:ArrowDown', 'k:KeyX'],
		dr: ['k:Numpad3', 'k:KeyC']
	};
	const out: PadMap = {};
	LANE_DIRS.forEach((d, i) => (out[i] = pad[d]));
	return out;
}
/** The lane a keyboard key is bound to (or -1). */
export function laneForKey(map: PadMap, code: string): number {
	const b = `k:${code}`;
	for (let i = 0; i < PANELS; i++) if (map[i]?.includes(b)) return i;
	return -1;
}
/** Everything held on the gamepads right now, as bindings. */
export function gamepadHeld(): Set<string> {
	const held = new Set<string>();
	const pads = typeof navigator != 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
	for (const gp of pads) {
		if (!gp) continue;
		gp.buttons.forEach((b, i) => b.pressed && held.add(`b:${i}`));
		gp.axes.forEach((v, i) => {
			if (v < -0.5) held.add(`a:${i}-`);
			if (v > 0.5) held.add(`a:${i}+`);
		});
	}
	return held;
}
export function laneForBinding(map: PadMap, b: string): number {
	for (let i = 0; i < PANELS; i++) if (map[i]?.includes(b)) return i;
	return -1;
}
export const bindingLabel = (b: string) => (b.startsWith('k:') ? b.slice(2).replace(/^Key|^Digit/, '').replace('Numpad', 'Num ') : b.startsWith('b:') ? `Pad button ${b.slice(2)}` : `Pad axis ${b.slice(2)}`);

// ── The choreography ──
const hash = (s: string) => {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
};
/** Moves: a little dance, as panels in order (it loops if the line is longer). */
const CALM: Record<string, Dir[]> = {
	march: ['l', 'r', 'l', 'r'],
	sway: ['l', 'c', 'r', 'c'],
	box: ['l', 'u', 'r', 'd'],
	rock: ['d', 'u', 'd', 'u'],
	vstep: ['ul', 'ur', 'dl', 'dr'],
	slide: ['l', 'dl', 'd', 'dr', 'r']
};
const BIG: Record<string, Dir[]> = {
	spin: ['u', 'ur', 'r', 'dr', 'd', 'dl', 'l', 'ul'],
	diamond: ['u', 'r', 'd', 'l'],
	cross: ['ul', 'dr', 'ur', 'dl'],
	zigzag: ['ul', 'r', 'dl', 'ur', 'l', 'dr'],
	kick: ['u', 'c', 'u', 'l', 'u', 'r'],
	wave: ['l', 'ul', 'u', 'ur', 'r', 'dr', 'd', 'dl']
};
/** The left foot takes the left column, the right foot the right one; the middle column is either. */
const footOf = (d: Dir) => (GRID[d][0] == 0 ? 'L' : GRID[d][0] == 2 ? 'R' : null);
const mirror = (d: Dir): Dir => AT[GRID[d][1]][2 - GRID[d][0]];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9À-￿]+/g, ' ').trim();

export interface DanceNote extends KeyNote {
	/** A held step: how long to stay on it (s). */
	len?: number;
}
export type Level = 'easy' | 'normal' | 'hard';

/** The steps for a song, from its chart (notes, or lyrics and their timing). */
export function danceNotes(chart: Chart, level: Level = 'normal'): DanceNote[] {
	const minGap = level == 'easy' ? 0.42 : level == 'hard' ? 0.17 : 0.26;
	// The events: notes when there's a chart (with pitch), else the words.
	type Ev = { t: number; end: number; midi: number | null; golden: boolean; line: number };
	const evs: Ev[] = [];
	const lines = chart.lines as Line[];
	const lineAt = (t: number) => {
		const i = lines.findIndex((l) => t < l.end + 0.05);
		return i < 0 ? lines.length - 1 : i;
	};
	const notes = chart.notes.filter((n) => !n.free).sort((a, b) => a.start - b.start);
	if (notes.length) for (const n of notes) evs.push({ t: n.start, end: n.end, midi: n.midi, golden: n.golden, line: lineAt(n.start) });
	else
		lines.forEach((l, li) => {
			if (l.timed && l.parts.length) {
				for (const p of l.parts) if (p.text.trim()) evs.push({ t: p.t, end: p.end, midi: null, golden: false, line: li });
			} else {
				const words = l.text.split(/\s+/).filter(Boolean);
				const span = Math.max(0.3, l.end - l.start) * 0.85;
				words.forEach((_, i) => evs.push({ t: l.start + (span * i) / Math.max(1, words.length), end: l.start + (span * (i + 1)) / Math.max(1, words.length), midi: null, golden: false, line: li }));
			}
		});
	if (!evs.length) return [];
	// The song's pulse: the most common gap between steps (for the grooves in the breaks).
	const gaps = evs
		.slice(1)
		.map((e, i) => e.t - evs[i].t)
		.filter((g) => g > 0.2 && g < 1.2)
		.sort((a, b) => a - b);
	let beat = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0.5;
	while (beat < 0.4) beat *= 2;
	while (beat > 0.8) beat /= 2;
	// Choruses: lines that come back.
	const count = new Map<string, number>();
	for (const l of lines) count.set(norm(l.text), (count.get(norm(l.text)) ?? 0) + 1);
	const isChorus = (li: number) => (count.get(norm(lines[li]?.text ?? '')) ?? 0) >= 2;

	const out: DanceNote[] = [];
	let lastT = -9;
	let last: Dir = 'c';
	let lastFoot: 'L' | 'R' | null = null;
	const step = (t: number, d: Dir, golden = false, len?: number) => {
		// No crossovers: a left-column panel for the right foot (or the reverse) swaps sides.
		const f = footOf(d);
		if (f && lastFoot == f && level != 'hard' && d != last) d = mirror(d);
		out.push({ t, lane: laneOf(d), golden, len });
		lastFoot = footOf(d) ?? (lastFoot == 'L' ? 'R' : 'L');
		last = d;
		lastT = t;
	};
	// Line by line.
	const byLine = new Map<number, Ev[]>();
	for (const e of evs) {
		if (!byLine.has(e.line)) byLine.set(e.line, []);
		byLine.get(e.line)!.push(e);
	}
	const order = [...byLine.keys()].sort((a, b) => a - b);
	order.forEach((li, k) => {
		const es = byLine.get(li)!.filter((e, i, a) => i == 0 || e.t - a[i - 1].t >= minGap * 0.6);
		const chorus = isChorus(li);
		const key = norm(lines[li]?.text ?? String(li));
		const pool = chorus ? BIG : CALM;
		const names = Object.keys(pool);
		let move = [...pool[names[hash(key) % names.length]]];
		// A falling line dances its move backwards (and down the pad).
		const pitched = es.filter((e) => e.midi != null);
		if (pitched.length >= 2 && pitched[pitched.length - 1].midi! < pitched[0].midi! - 1) move = move.reverse();
		let m = 0;
		// Each line starts fresh on its feet, so a line that comes back dances exactly the same.
		lastFoot = null;
		last = 'c';
		es.forEach((e, i) => {
			if (e.t - lastT < minGap) return;
			let d = move[m++ % move.length];
			// A big leap in the tune: to the top row (up) or the bottom row (down).
			const prev = i > 0 ? es[i - 1].midi : null;
			if (e.midi != null && prev != null && Math.abs(e.midi - prev) >= 5) {
				const [c] = GRID[d];
				d = AT[e.midi > prev ? 0 : 2][c];
			}
			// The line's last step comes home to the middle (unless held).
			const held = e.end - e.t >= 0.75 && level != 'easy';
			if (i == es.length - 1 && !held && !chorus) d = 'c';
			step(e.t, d, e.golden, held ? Math.min(2.4, e.end - e.t) : undefined);
			// Jumps: both feet, on the chorus's first beat and on golden notes.
			if (level != 'easy' && ((chorus && i == 0) || e.golden)) {
				const other = mirror(d) == d ? (d == 'u' || d == 'd' ? 'c' : 'u') : mirror(d);
				out.push({ t: e.t, lane: laneOf(other), golden: e.golden });
			}
		});
		// The break before the next line: keep dancing on the pulse (a side-to-side groove).
		const next = order[k + 1];
		const end = es[es.length - 1]?.end ?? lastT;
		const nextT = next != null ? (byLine.get(next)![0]?.t ?? end) : end;
		if (nextT - end > beat * 4) {
			const every = level == 'easy' ? beat * 4 : level == 'hard' ? beat : beat * 2;
			const groove: Dir[] = chorus ? ['l', 'r', 'ul', 'ur'] : ['l', 'c', 'r', 'c'];
			let g = 0;
			for (let t = end + beat * 2; t < nextT - beat * 1.5; t += every) if (t - lastT >= minGap) step(t, groove[g++ % groove.length]);
		}
	});
	out.sort((a, b) => a.t - b.t || a.lane - b.lane);
	return out;
}

// ── Drawing ──
function arrow(g: CanvasRenderingContext2D, x: number, y: number, r: number, d: Dir, fill: string, stroke = 'rgba(255,255,255,0.85)') {
	const a = ANGLE[d];
	g.save();
	g.translate(x, y);
	g.fillStyle = fill;
	g.strokeStyle = stroke;
	g.lineWidth = Math.max(2, r * 0.12);
	g.lineJoin = 'round';
	g.beginPath();
	if (a == null) {
		// The centre: a square panel.
		const s = r * 0.78;
		g.rect(-s, -s, s * 2, s * 2);
	} else {
		g.rotate(a);
		g.moveTo(0, -r);
		g.lineTo(r * 0.92, -r * 0.05);
		g.lineTo(r * 0.36, -r * 0.05);
		g.lineTo(r * 0.36, r * 0.9);
		g.lineTo(-r * 0.36, r * 0.9);
		g.lineTo(-r * 0.36, -r * 0.05);
		g.lineTo(-r * 0.92, -r * 0.05);
	}
	g.closePath();
	g.fill();
	g.stroke();
	g.restore();
}
/**
 * The dance highway: arrows rise from the bottom to the targets at the top. `flash`: when each
 * lane was last stepped on; `pops`: verdicts; `held`: lanes being stood on now.
 */
export function drawDanceway(g: CanvasRenderingContext2D, w: number, h: number, notes: DanceNote[], t: number, flash: number[], pops: { at: number; lane: number; text: string; color: string }[], held: boolean[]) {
	const now = performance.now();
	const SPAN = 2.0;
	const lw = w / PANELS;
	const r = Math.min(lw * 0.42, 30);
	const hitY = r + 14;
	g.clearRect(0, 0, w, h);
	// Lanes: dark glass, the three groups (left foot, middle, right foot) just told apart.
	for (let i = 0; i < PANELS; i++) {
		const x = i * lw;
		const group = i < 3 ? 0 : i < 6 ? 1 : 2;
		g.fillStyle = group == 1 ? 'rgba(20,16,50,0.72)' : 'rgba(10,8,30,0.72)';
		g.fillRect(x, 0, lw, h);
		const lit = Math.max(0, 1 - (now - flash[i]) / 200, held[i] ? 0.6 : 0);
		if (lit > 0) {
			const glow = g.createLinearGradient(0, 0, 0, h);
			glow.addColorStop(0, LANE_COLOR(i) + 'aa');
			glow.addColorStop(1, LANE_COLOR(i) + '00');
			g.globalAlpha = lit;
			g.fillStyle = glow;
			g.fillRect(x, 0, lw, h);
			g.globalAlpha = 1;
		}
		if (i == 3 || i == 6) {
			g.fillStyle = 'rgba(255,255,255,0.18)';
			g.fillRect(x, 0, 2, h);
		}
	}
	// Beat lines rising.
	g.fillStyle = 'rgba(255,255,255,0.05)';
	for (let s = Math.ceil(t * 2) / 2; s < t + SPAN; s += 0.5) g.fillRect(0, hitY + ((s - t) / SPAN) * (h - hitY), w, 1);
	// The targets: outlines of each arrow.
	for (let i = 0; i < PANELS; i++) {
		const d = LANE_DIRS[i];
		const pulse = 1 + Math.max(0, 1 - (now - flash[i]) / 150) * 0.15;
		arrow(g, i * lw + lw / 2, hitY, r * pulse, d, 'rgba(255,255,255,0.08)', LANE_COLOR(i));
	}
	// The steps, rising (holds as a bar trailing below the arrow).
	for (let k = notes.length - 1; k >= 0; k--) {
		const n = notes[k];
		if (n.t > t + SPAN) continue;
		const end = n.t + (n.len ?? 0);
		if (end < t - 0.4) continue;
		const cx = n.lane * lw + lw / 2;
		const d = LANE_DIRS[n.lane];
		const y = hitY + ((n.t - t) / SPAN) * (h - hitY);
		if (n.len) {
			const y2 = hitY + ((end - t) / SPAN) * (h - hitY);
			g.fillStyle = LANE_COLOR(n.lane) + (n.frac === 0 ? '33' : '88');
			g.fillRect(cx - r * 0.3, Math.max(hitY, y), r * 0.6, Math.max(0, y2 - Math.max(hitY, y)));
		}
		if (n.frac != null && n.frac > 0) {
			const kk = (now - (n.at ?? now)) / 260;
			if (kk < 1) {
				g.globalAlpha = 1 - kk;
				arrow(g, cx, hitY, r * (1 + kk * 0.5), d, 'rgba(255,255,255,0.0)', LANE_COLOR(n.lane));
				g.globalAlpha = 1;
			}
			continue;
		}
		if (y < -r) continue;
		const missed = n.frac === 0;
		g.globalAlpha = missed ? 0.3 : 1;
		g.shadowColor = LANE_COLOR(n.lane);
		g.shadowBlur = missed ? 0 : 14;
		arrow(g, cx, y, r, d, missed ? '#64748b' : n.golden ? '#fde047' : LANE_COLOR(n.lane));
		g.shadowBlur = 0;
		g.globalAlpha = 1;
	}
	// Two at once: a bar joining a jump's arrows.
	g.textAlign = 'center';
	for (const p of pops) {
		const k = (now - p.at) / 700;
		if (k >= 1) continue;
		g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
		g.font = `900 ${Math.round(Math.min(16, lw * 0.3))}px system-ui, sans-serif`;
		g.fillStyle = p.color;
		g.fillText(p.text, p.lane * lw + lw / 2, hitY + r + 22 + k * 24);
	}
	g.globalAlpha = 1;
	g.textAlign = 'left';
}
