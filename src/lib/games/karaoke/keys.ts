// Keyboard Karaoke: the keys, for players who'd rather not sing. The song's notes fall down four
// lanes to a line; tap a lane as its note reaches the line (D F J K on a keyboard, the four pads
// on a phone). Low notes are on the left, high ones on the right, like a keyboard; with lyrics
// only (no note chart), the words make the rhythm and the lanes are dealt out from the words.
import type { Chart, Line } from './chart';
import type { Heard } from './pitch';
import type { Live, Verdict } from './score';

export const LANES = 4;
/** The keys for the lanes, left to right: the home row, two fingers of each hand. */
export const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
export const LANE_LABELS = ['D', 'F', 'J', 'K'];
export const LANE_COLORS = ['#f472b6', '#38bdf8', '#facc15', '#4ade80'];

/** How far off a tap can be (s), for each verdict (the video's clock wobbles a little). */
const PERFECT = 0.075;
const GREAT = 0.13;
const GOOD = 0.2;
/** Notes closer together than this are thinned out (one tap per word, not a drum roll). */
const MIN_GAP = 0.22;

export interface KeyNote {
	t: number;
	lane: number;
	golden: boolean;
	/** Judged: how it went (0..1; 0 is a miss), and when (performance.now(), for the effects). */
	frac?: number;
	at?: number;
}

/** A small, steady hash of a word (the same lanes every time the song's played). */
function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

/** The notes to tap, from the song's note chart, or from its words. */
export function keyNotes(chart: Chart): KeyNote[] {
	const out: KeyNote[] = [];
	const add = (n: KeyNote) => {
		const last = out[out.length - 1];
		if (!last || n.t - last.t >= MIN_GAP) out.push(n);
	};
	const notes = chart.notes.filter((n) => !n.free).sort((a, b) => a.start - b.start);
	if (notes.length) {
		// Pitch to lane: the song's own range, split in four (by how often each pitch comes up, so
		// all four lanes get used).
		const sorted = notes.map((n) => n.midi).sort((a, b) => a - b);
		const cut = [0.25, 0.5, 0.75].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
		for (const n of notes) {
			let lane = cut.filter((c) => n.midi > c).length;
			// (One pitch held over several notes stays in one lane; a run up or down moves across.)
			lane = Math.max(0, Math.min(LANES - 1, lane));
			add({ t: n.start, lane, golden: n.golden });
		}
		return out;
	}
	// Lyrics only: a tap per word (or syllable, when they're timed), the lanes stepping about from
	// the words themselves (never the same lane four times running).
	let lane = 1;
	let same = 0;
	const step = (word: string) => {
		const h = hash(word.toLowerCase());
		let next = h % 5 == 0 ? lane : (lane + 1 + (h % 3)) % LANES;
		same = next == lane ? same + 1 : 0;
		if (same >= 2) {
			next = (lane + 2) % LANES;
			same = 0;
		}
		lane = next;
		return lane;
	};
	for (const l of chart.lines as Line[]) {
		if (l.timed && l.parts.length) {
			for (const p of l.parts) if (p.text.trim()) add({ t: p.t, lane: step(p.text), golden: false });
		} else {
			// Only the line's start and end are known: its words spread across it.
			const words = l.text.split(/\s+/).filter(Boolean);
			const span = Math.max(0.3, l.end - l.start) * 0.85;
			words.forEach((w, i) => add({ t: l.start + (span * i) / Math.max(1, words.length), lane: step(w), golden: false }));
		}
	}
	return out;
}

/** Scores the keys, with the same face as the singing scorer (the game treats them alike). */
export class KeysScorer {
	notes: KeyNote[] = [];
	verdicts: Verdict[] = [];
	live: Live = { score: 0, sofar: null, pitch: 0, timing: 0, note: null, hit: false, combo: 0 };
	private sum = 0;
	private judged = 0;
	private combo = 0;
	private lastHit = -1;
	/** Where the song is (s), as of the last frame. */
	t = 0;

	constructor(chart: Chart) {
		this.notes = keyNotes(chart);
	}
	/** New lyrics or chart mid-song: new notes from here on (the score so far stays). */
	setChart(chart: Chart) {
		this.notes = keyNotes(chart).filter((n) => n.t > this.t + GOOD);
	}
	/** Every frame: notes that went by untapped are misses. */
	push(t: number, _h?: Heard): Live {
		this.t = t;
		for (const n of this.notes) {
			if (n.frac != null) continue;
			if (n.t > t - GOOD) break;
			this.judge(n, 0);
		}
		this.update(t);
		return this.live;
	}
	/** A tap on a lane at song time t: the nearest note in that lane close enough, if any. */
	press(lane: number, t: number) {
		let best: KeyNote | null = null;
		for (const n of this.notes) {
			if (n.t > t + GOOD) break;
			if (n.frac != null || n.lane != lane || Math.abs(n.t - t) > GOOD) continue;
			if (!best || Math.abs(n.t - t) < Math.abs(best.t - t)) best = n;
		}
		if (!best) {
			// A tap with nothing to hit: the run of hits ends (but the crowd doesn't mind).
			this.combo = 0;
			this.update(t);
			return null;
		}
		const off = Math.abs(best.t - t);
		this.judge(best, off <= PERFECT ? 1 : off <= GREAT ? 0.7 : 0.45);
		this.lastHit = t;
		this.update(t);
		return best;
	}
	private judge(n: KeyNote, frac: number) {
		n.frac = frac;
		n.at = performance.now();
		this.sum += frac * (n.golden ? 2 : 1);
		this.judged += n.golden ? 2 : 1;
		this.combo = frac > 0 ? this.combo + 1 : 0;
		this.verdicts.push({ frac, golden: n.golden, midi: null, lane: n.lane });
	}
	private update(t: number) {
		const total = this.notes.reduce((s, n) => s + (n.golden ? 2 : 1), 0) || 1;
		this.live = {
			score: Math.round((this.sum / Math.max(total, this.judged)) * 100),
			sofar: this.judged ? Math.round((this.sum / this.judged) * 100) : null,
			pitch: 0,
			timing: this.judged ? this.sum / this.judged : 0,
			note: null,
			hit: t - this.lastHit < 0.15,
			combo: this.combo
		};
	}
	final() {
		return this.live.score;
	}
}

/**
 * The highway: four lanes, the notes falling to the line near the bottom. `flash`: when each lane
 * was last tapped (performance.now()); `pops`: the verdicts to show over the lanes.
 */
export function drawHighway(
	g: CanvasRenderingContext2D,
	w: number,
	h: number,
	notes: KeyNote[],
	t: number,
	flash: number[],
	pops: { at: number; lane: number; text: string; color: string }[]
) {
	const now = performance.now();
	const SPAN = 1.8;
	const hitY = h - 22;
	const lw = w / LANES;
	g.clearRect(0, 0, w, h);
	// The lanes: dark glass, a faint stripe of each lane's colour, brighter for a moment when tapped.
	for (let i = 0; i < LANES; i++) {
		const x = i * lw;
		const lit = Math.max(0, 1 - (now - flash[i]) / 180);
		const grad = g.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, 'rgba(10,8,30,0.35)');
		grad.addColorStop(1, `rgba(10,8,30,${0.78 - lit * 0.3})`);
		g.fillStyle = grad;
		g.fillRect(x, 0, lw, h);
		if (lit > 0) {
			const glow = g.createLinearGradient(0, hitY, 0, 0);
			glow.addColorStop(0, LANE_COLORS[i] + '88');
			glow.addColorStop(1, LANE_COLORS[i] + '00');
			g.globalAlpha = lit;
			g.fillStyle = glow;
			g.fillRect(x, 0, lw, hitY);
			g.globalAlpha = 1;
		}
		g.fillStyle = 'rgba(255,255,255,0.08)';
		g.fillRect(x, 0, 1, h);
	}
	// Beat lines drifting down (one a second, for a sense of speed).
	g.fillStyle = 'rgba(255,255,255,0.06)';
	for (let s = Math.ceil(t); s < t + SPAN; s++) g.fillRect(0, hitY - ((s - t) / SPAN) * hitY, w, 1);
	// The line to hit, with a ring per lane.
	g.fillStyle = 'rgba(255,255,255,0.75)';
	g.fillRect(0, hitY - 1, w, 2);
	for (let i = 0; i < LANES; i++) {
		g.strokeStyle = LANE_COLORS[i];
		g.lineWidth = 3;
		g.beginPath();
		g.ellipse(i * lw + lw / 2, hitY, lw * 0.32, 9, 0, 0, Math.PI * 2);
		g.stroke();
	}
	g.lineWidth = 1;
	// The notes, falling.
	for (const n of notes) {
		if (n.t > t + SPAN) break;
		const cx = n.lane * lw + lw / 2;
		if (n.frac != null && n.frac > 0) {
			// Hit: a burst at the line.
			const k = (now - (n.at ?? now)) / 260;
			if (k >= 1) continue;
			g.globalAlpha = 1 - k;
			g.strokeStyle = LANE_COLORS[n.lane];
			g.lineWidth = 4;
			g.beginPath();
			g.ellipse(cx, hitY, lw * (0.32 + k * 0.25), 9 + k * 14, 0, 0, Math.PI * 2);
			g.stroke();
			g.globalAlpha = 1;
			g.lineWidth = 1;
			continue;
		}
		const y = hitY - ((n.t - t) / SPAN) * hitY;
		if (y > h + 20) continue;
		const missed = n.frac === 0;
		g.globalAlpha = missed ? 0.3 : 1;
		g.fillStyle = missed ? '#64748b' : n.golden ? '#fde047' : LANE_COLORS[n.lane];
		g.shadowColor = g.fillStyle as string;
		g.shadowBlur = missed ? 0 : 12;
		g.beginPath();
		g.ellipse(cx, y, lw * 0.3, 10, 0, 0, Math.PI * 2);
		g.fill();
		g.shadowBlur = 0;
		g.fillStyle = 'rgba(255,255,255,0.7)';
		g.beginPath();
		g.ellipse(cx, y - 3, lw * 0.16, 3.5, 0, 0, Math.PI * 2);
		g.fill();
		g.globalAlpha = 1;
	}
	// Verdicts over the lanes.
	g.textAlign = 'center';
	for (const p of pops) {
		const k = (now - p.at) / 700;
		if (k >= 1) continue;
		g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
		g.font = `900 ${Math.round(Math.min(18, lw * 0.22) * (k < 0.12 ? 0.7 + k * 2.5 : 1))}px system-ui, sans-serif`;
		g.fillStyle = p.color;
		g.fillText(p.text, p.lane * lw + lw / 2, hitY - 26 - k * 30);
	}
	g.globalAlpha = 1;
	g.textAlign = 'left';
}
