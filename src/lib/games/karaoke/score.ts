// Keyboard Karaoke: scoring, out of 100.
//
// With a note chart (the pitch guide): every moment of every note counts. You score while you sing
// within a semitone of the note (full marks inside half a semitone), in any octave, so a low voice
// can sing a high song. Golden notes count double, freestyle notes not at all. That's pitch and
// timing in one: singing the right note at the wrong time misses.
//
// With lyrics only (no chart): timing is whether you sing while a line is up (and not over the
// gaps), and pitch is control: how much of your singing sits on real notes rather than sliding
// between them, and in the key you've been singing in.
import type { Chart, Line, Note } from './chart';
import type { Heard } from './pitch';

/** Distance between two pitches in semitones, ignoring octaves (0..6). */
export const pitchGap = (a: number, b: number) => Math.abs((((a - b) % 12) + 18) % 12 - 6);
/** Timing leeway (s): notes and lines count a little early or late. */
export const SLACK = 0.25;

export interface Live {
	/** The score out of 100, over the whole song (the final score at the end). */
	score: number;
	/** How it's going so far (out of 100), over what's been sung: the live grade. Null before the first note. */
	sofar: number | null;
	/** 0..1, how this part of the song is going. */
	pitch: number;
	timing: number;
	/** The note being sung now (with a chart). */
	note: Note | null;
	/** You're on it right now. */
	hit: boolean;
	combo: number;
}

/** How a note (or, with lyrics only, a line) went: for the pop-ups. */
export interface Verdict {
	/** 0..1 of it sung on pitch. */
	frac: number;
	golden: boolean;
	/** The note's pitch (with a chart), for where the pop-up appears. */
	midi: number | null;
}

export const RANKS: [number, string][] = [
	[90, 'Superstar'],
	[80, 'Lead singer'],
	[65, 'Rising star'],
	[50, 'Amateur'],
	[30, 'Shower singer'],
	[0, 'Tone deaf (for now)']
];
export const rankOf = (score: number) => RANKS.find(([n]) => score >= n)![1];

/** Letter grades, like a report card (or a rhythm game): S+ at the top, F at the bottom. */
export const GRADES: [number, string][] = [
	[97, 'S+'], [93, 'S'], [90, 'A+'], [86, 'A'], [83, 'A-'], [80, 'B+'], [76, 'B'], [73, 'B-'],
	[70, 'C+'], [66, 'C'], [63, 'C-'], [60, 'D+'], [56, 'D'], [50, 'D-'], [0, 'F']
];
export const gradeOf = (score: number) => GRADES.find(([n]) => score >= n)![1];
/** A colour per grade letter. */
export const gradeColor = (g: string) => ({ S: '#fde047', A: '#4ade80', B: '#38bdf8', C: '#a78bfa', D: '#fb923c', F: '#f87171' })[g[0]] ?? '#fff';

export class Scorer {
	private hitW = 0;
	private noteW = 0;
	private totalW: number;
	// Lyrics only.
	private lineT = 0;
	private voicedInLine = 0;
	private gapVoiced = 0;
	private voiced = 0;
	private onNote = 0;
	private hist = new Array(12).fill(0);
	private combo = 0;
	private lastT = -1;
	// The note (or line) being sung, and how much of it has been on pitch so far.
	private cur: object | null = null;
	private curHit = 0;
	private curDur = 0;
	private curNote: { golden: boolean; midi: number | null } = { golden: false, midi: null };
	/** Notes / lines just finished (the game takes them for the pop-ups). */
	verdicts: Verdict[] = [];
	live: Live = { score: 0, sofar: null, pitch: 0, timing: 0, note: null, hit: false, combo: 0 };

	constructor(
		private chart: Chart,
		/** Semitones of leeway (easy 1.5, normal 1, hard 0.6). */
		private tolerance = 1
	) {
		this.totalW = chart.notes.filter((n) => !n.free).reduce((s, n) => s + (n.end - n.start) * (n.golden ? 2 : 1), 0);
	}
	/** The lines (and notes) to score from now on, keeping the score so far (the parts were handed round). */
	setChart(chart: Chart) {
		this.chart = chart;
		this.totalW = chart.notes.filter((n) => !n.free).reduce((s, n) => s + (n.end - n.start) * (n.golden ? 2 : 1), 0);
		this.cur = null;
		this.curHit = 0;
		this.curDur = 0;
	}
	get hasNotes() {
		return this.chart.notes.length > 0;
	}

	/** Called every frame with the video's time (s) and what the microphone hears. */
	push(t: number, h: Heard) {
		const dt = this.lastT < 0 ? 0 : t - this.lastT;
		this.lastT = t;
		// Skips (seeking, a stall) don't count.
		if (dt <= 0 || dt > 0.25) return this.live;
		const singing = h.midi > 0 && h.clarity > 0.6;
		if (this.hasNotes) this.pushNotes(t, dt, h, singing);
		else this.pushLines(t, dt, h, singing);
		return this.live;
	}

	private pushNotes(t: number, dt: number, h: Heard, singing: boolean) {
		const note = this.chart.notes.find((n) => t >= n.start && t < n.end && !n.free) ?? null;
		let hit = false;
		let k = 0;
		if (note) {
			const w = note.golden ? 2 : 1;
			this.noteW += dt * w;
			if (singing) {
				// A note sung a little early or late (the video and the chart a touch out of step, or
				// you are) still counts: any note within SLACK of now, at its pitch.
				const near = this.chart.notes.filter((n) => !n.free && t >= n.start - SLACK && t < n.end + SLACK);
				for (const n of near) {
					const gap = pitchGap(h.midi, n.midi);
					k = Math.max(k, gap <= this.tolerance * 0.5 ? 1 : gap <= this.tolerance ? 0.6 : 0);
				}
				this.hitW += dt * w * k;
				hit = k > 0;
			}
		}
		this.track(note, k, dt, { golden: !!note?.golden, midi: note?.midi ?? null });
		this.combo = hit ? this.combo + dt : note ? 0 : this.combo;
		this.live = {
			score: Math.round((this.hitW / (this.totalW || 1)) * 100),
			sofar: this.noteW > 0.3 ? Math.round((this.hitW / this.noteW) * 100) : null,
			pitch: this.noteW ? this.hitW / this.noteW : 0,
			timing: this.noteW ? this.hitW / this.noteW : 0,
			note,
			hit,
			combo: Math.floor(this.combo)
		};
	}

	private pushLines(t: number, dt: number, h: Heard, singing: boolean) {
		const line = this.chart.lines.find((l: Line) => t >= l.start && t < l.end) ?? null;
		// (Singing just before a line starts or just after it ends counts as in it.)
		const inLine = !!line || this.chart.lines.some((l: Line) => t >= l.start - SLACK * 2 && t < l.end + SLACK * 3);
		if (inLine) {
			this.lineT += dt;
			if (singing) this.voicedInLine += dt;
		} else if (singing) this.gapVoiced += dt;
		let hit = false;
		// (Pitch counts while a line is up: singing over the gaps isn't the song.)
		if (singing && inLine) {
			this.voiced += dt;
			const nearest = Math.round(h.midi);
			this.hist[((nearest % 12) + 12) % 12] += dt;
			// On a note (not sliding between two), and in the key you've been singing in.
			// (Easy lets a voice wobble more; hard wants it right on the note.)
			const steady = Math.abs(h.midi - nearest) < Math.min(0.42, 0.3 * this.tolerance);
			const inKey = this.inKey(nearest);
			if (steady && inKey) this.onNote += dt;
			hit = steady && inKey;
		}
		// A line's verdict: on-pitch singing over ~60% of it is a perfect line.
		this.track(line, hit ? 1 / 0.6 : 0, dt, { golden: false, midi: null });
		this.combo = hit ? this.combo + dt : inLine && !singing ? this.combo : 0;
		// People sing about half of a line (breaths, short words): that's full marks for timing.
		const timing = Math.max(0, Math.min(1, this.voicedInLine / (0.45 * (this.lineT || 1))) - Math.min(0.2, this.gapVoiced / (this.lineT + 20)));
		const pitch = this.voiced ? this.onNote / this.voiced : 0;
		const sung = this.lineT / (this.chart.lines.reduce((s, l) => s + (l.end - l.start), 0) || 1);
		this.live = { score: Math.round((0.6 * timing + 0.4 * pitch) * 100 * Math.min(1, sung)), sofar: this.lineT > 1 ? Math.round((0.6 * timing + 0.4 * pitch) * 100) : null, pitch, timing, note: null, hit, combo: Math.floor(this.combo) };
	}

	/** Follows the current note / line; when it ends, its verdict goes out. */
	private track(part: object | null, k: number, dt: number, info: { golden: boolean; midi: number | null }) {
		if (part !== this.cur) {
			if (this.cur && this.curDur > 0.05) this.verdicts.push({ frac: Math.min(1, this.curHit / this.curDur), ...this.curNote });
			this.cur = part;
			this.curHit = this.curDur = 0;
			this.curNote = info;
		}
		if (part) {
			this.curDur += dt;
			this.curHit += dt * k;
		}
	}

	/** In the major (or relative minor) key that fits what you've sung so far best. */
	private inKey(midi: number) {
		const total = this.hist.reduce((a, b) => a + b, 0);
		if (total < 4) return true; // too early to tell
		const MAJOR = [0, 2, 4, 5, 7, 9, 11];
		let best = 0;
		let bestFit = -1;
		for (let k = 0; k < 12; k++) {
			const fit = MAJOR.reduce((s, d) => s + this.hist[(k + d) % 12], 0);
			if (fit > bestFit) [best, bestFit] = [k, fit];
		}
		return MAJOR.includes((((midi - best) % 12) + 12) % 12);
	}

	/** The final score (the song's over). */
	final() {
		return this.live.score;
	}
}
