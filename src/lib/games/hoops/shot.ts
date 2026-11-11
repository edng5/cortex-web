// Hoops: shots. Watches the per-frame numbers (pose.ts features) for
//  - a jump shot: both hands come up together above the shoulders (the set point), then rise to a
//    peak above the head (the release);
//  - a pump fake: from the set point the hands go part way up and come back down;
//  - a layup: one hand goes up high above the head while the other stays low.
// Practice records your own shots as small templates (timing and motion, about 600 bytes each), and
// a live shot is judged against yours: release timing (the shot bar), how alike the motion is, the
// distance and contest, scaled by the Shooting stat.
import { dequantize, quantize } from './pose';

export type ShotKind = 'jumpshot' | 'layup';
export interface ShotTake {
	kind: ShotKind;
	/** ms from the set point (layup: the hand passing the shoulder) to the release. */
	release: number;
	/** The motion, resampled to SAMPLES frames of 8 numbers. */
	frames: number[][];
	/** Layups: which hand ('left' | 'right', the player's own). */
	hand?: 'left' | 'right';
}
/** A calibrated shot: your usual release time, how much it varies, and the motion. */
export interface ShotTemplate {
	release: number;
	spread: number;
	frames: number[][];
	takes: number;
}

const SAMPLES = 20;
const avgLift = (f: number[]) => (f[0] + f[1]) / 2;

export interface ShotEvents {
	onSet?: () => void;
	onShot?: (take: ShotTake) => void;
	onPumpFake?: () => void;
	onCancel?: () => void;
}

/** Finds jump shots, pump fakes and layups in the live stream of frames. */
export class ShotDetector {
	phase: 'idle' | 'set' = 'idle';
	setAt = 0;
	private frames: { t: number; f: number[] }[] = [];
	private peak = -9;
	private peakAt = 0;
	private cool = 0;
	// Layups: per hand, when it was last low, and its highest point since.
	private hands: ({ lowAt: number; peak: number; peakAt: number } | undefined)[] = [];

	constructor(private on: ShotEvents) {}

	push(f: number[], t: number) {
		this.frames.push({ t, f });
		const keepFrom = this.phase == 'set' ? this.setAt - 300 : Math.min(t - 1800, ...this.hands.map((r) => (r ? r.lowAt - 200 : Infinity)));
		while (this.frames.length && this.frames[0].t < keepFrom) this.frames.shift();
		if (t < this.cool) return;
		if (this.layup(f, t)) return;
		const lift = avgLift(f);
		if (this.phase == 'idle') {
			// Set point: both hands above the shoulders, close together (the ball).
			if (Math.min(f[0], f[1]) > 0.25 && f[7] < 1.5) {
				this.phase = 'set';
				this.setAt = t;
				this.peak = lift;
				this.peakAt = t;
				this.on.onSet?.();
			}
			return;
		}
		if (lift > this.peak) {
			this.peak = lift;
			this.peakAt = t;
		}
		const extended = Math.max(f[2], f[3]) > 0.8;
		// Release: hands at their highest above the head, arms extended (or starting back down).
		const released = (this.peak > 0.9 && lift < this.peak - 0.15) || (lift > 1.25 && extended && t - this.peakAt > 60);
		if (released) {
			this.on.onShot?.({ kind: 'jumpshot', release: this.peakAt - this.setAt, frames: this.take(this.setAt - 300, this.peakAt + 200) });
			this.reset(t + 700);
		} else if (lift < 0.05 && this.peak < 0.9) {
			// Back down without shooting: a pump fake if the hands went up a bit first.
			if (this.peak > 0.45) this.on.onPumpFake?.();
			else this.on.onCancel?.();
			this.reset(t + 250);
		} else if (t - this.setAt > 2500) {
			this.on.onCancel?.();
			this.reset(t + 300);
		}
	}

	/**
	 * A layup: one hand reaches high (above the head) while the other stays down (below the
	 * shoulder), often with a knee coming up. Timed from when that hand was last low to its peak.
	 */
	private layup(f: number[], t: number): boolean {
		// A knee up (bent hard while the other leg is straight) makes it a surer layup.
		const kneeUp = Math.min(f[4], f[5]) < 0.72 && Math.max(f[4], f[5]) > 0.85;
		for (const h of [0, 1] as const) {
			const lift = f[h];
			const other = f[1 - h];
			const st = (this.hands[h] ??= { lowAt: t, peak: -9, peakAt: t });
			if (lift < 0.15) {
				st.lowAt = t;
				st.peak = -9;
				continue;
			}
			if (lift > st.peak) {
				st.peak = lift;
				st.peakAt = t;
			}
			const high = st.peak > (kneeUp ? 0.7 : 0.9);
			const oneHand = other < 0.3 && st.peak - other > (kneeUp ? 0.5 : 0.65);
			// Released: the hand stops rising (or starts down) after reaching up.
			const released = lift < st.peak - 0.08 || t - st.peakAt > 90;
			if (high && oneHand && released && t - st.lowAt < 1600) {
				this.on.onShot?.({ kind: 'layup', release: st.peakAt - st.lowAt, frames: this.take(st.lowAt - 200, st.peakAt + 200), hand: h == 0 ? 'left' : 'right' });
				this.reset(t + 700);
				return true;
			}
		}
		return false;
	}
	private take(from: number, to: number) {
		return resample(this.frames.filter((x) => x.t >= from && x.t <= to).map((x) => x.f), SAMPLES);
	}
	private reset(coolUntil: number) {
		this.phase = 'idle';
		this.frames = [];
		this.hands = [];
		this.cool = coolUntil;
	}
}

function resample(frames: number[][], n: number): number[][] {
	if (!frames.length) return Array.from({ length: n }, () => Array(8).fill(0));
	return Array.from({ length: n }, (_, i) => {
		const x = (i / (n - 1)) * (frames.length - 1);
		const a = frames[Math.floor(x)];
		const b = frames[Math.min(frames.length - 1, Math.ceil(x))];
		const k = x - Math.floor(x);
		return a.map((v, j) => v + (b[j] - v) * k);
	});
}

/** Averages practice takes into a template (timing and motion). */
export function makeTemplate(takes: ShotTake[]): ShotTemplate {
	const rel = takes.map((t) => t.release);
	const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
	const spread = Math.sqrt(rel.reduce((a, b) => a + (b - mean) ** 2, 0) / rel.length);
	const frames = Array.from({ length: SAMPLES }, (_, i) => quantize(Array.from({ length: 8 }, (_, j) => takes.reduce((a, t) => a + t.frames[i][j], 0) / takes.length)));
	return { release: Math.round(mean), spread: Math.round(spread), frames, takes: takes.length };
}

/** How alike two motions are, 0..1 (dynamic time warping, so a slightly faster or slower shot still matches). */
export function formMatch(a: number[][], tpl: number[][]): number {
	const b = tpl.map(dequantize);
	const n = a.length;
	const m = b.length;
	const d = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
	d[0][0] = 0;
	for (let i = 1; i <= n; i++)
		for (let j = 1; j <= m; j++) {
			const cost = Math.sqrt(a[i - 1].reduce((s, v, k) => s + (v - b[j - 1][k]) ** 2, 0));
			d[i][j] = cost + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
		}
	return Math.exp(-(d[n][m] / (n + m)) * 1.6);
}

/** The green window (± ms around your release): wider with the Shooting stat, and a little for a shot that varies. */
export const shotWindow = (tpl: ShotTemplate, shooting: number) => Math.round(25 + shooting * 0.9 + Math.min(40, tpl.spread / 2));

export type Grade = 'perfect' | 'good' | 'early' | 'late';
export interface ShotResult {
	/** Released this many ms early (negative) or late (positive) against your template. */
	error: number;
	window: number;
	grade: Grade;
	form: number;
	chance: number;
}

/** Logo range: this far out is a deep three (Three-point 70+ makes it playable). */
export const DEEP = 13;
/** Ratings that unlock dunks (Finishing) and deep threes (Three-point). */
export const UNLOCK_AT = 70;
/** Where the shot is from (court units from the hoop): close, mid-range, three, or deep. */
export const zoneOf = (dist: number) => (dist < 3.2 ? 'close' : dist < 9.5 ? 'mid' : dist < DEEP ? 'three' : 'deep');
/** The rating that counts for a shot: Finishing for layups and close ones, Three-point from deep, else Mid-range. */
export function shotRating(st: { shooting: number; three: number; finishing: number }, kind: ShotKind, dist: number) {
	const z = zoneOf(dist);
	return kind == 'layup' || z == 'close' ? st.finishing : z == 'three' || z == 'deep' ? st.three : st.shooting;
}
const BASE = { jumpshot: { close: 0.6, mid: 0.46, three: 0.34, deep: 0.3 }, layup: { close: 0.7, mid: 0.3, three: 0.08, deep: 0.02 } };

/** Judges a shot against your template: timing, form, distance and the Shooting stat (0..99). */
export function judge(take: ShotTake, tpl: ShotTemplate | null, shooting: number, dist: number): ShotResult {
	const zone = zoneOf(dist);
	// Deep threes are a heave until your Three-point rating unlocks the range.
	const base = (BASE[take.kind][zone] + shooting * 0.003) * (zone == 'deep' && shooting < UNLOCK_AT ? 0.3 : 1);
	if (!tpl) return { error: 0, window: 0, grade: 'good', form: 0.6, chance: base * 0.8 };
	const window = shotWindow(tpl, shooting);
	const error = take.release - tpl.release;
	const e = Math.abs(error);
	const form = formMatch(take.frames, tpl.frames);
	let chance: number;
	let grade: Grade;
	if (e <= window / 3) {
		grade = 'perfect';
		chance = Math.min(0.97, base + 0.4);
	} else if (e <= window) {
		grade = 'good';
		chance = base + 0.12;
	} else {
		grade = error < 0 ? 'early' : 'late';
		chance = base * Math.max(0.12, 1 - (e - window) / 350);
	}
	chance *= 0.55 + 0.45 * form;
	return { error: Math.round(error), window, grade, form, chance };
}
