// Hoops: reading your movements. Every camera frame becomes a few numbers (pose.ts), and from them:
//  - where you stand: steps left / right, and toward / away from the camera (you look bigger closer),
//    against where you stood when the game started (the calibration);
//  - crouch and jumps (the hips rising fast);
//  - triple threat (knees bent, both hands together at the waist);
//  - dribble moves, with the hands low: crossover (hands swing across the body), in-and-out (out,
//    in, out again on one side) and spin (a full turn: the shoulders narrow, then come back);
//  - shots, layups and pump fakes (shot.ts).
import { body, features, type Pose } from './pose';
import { ShotDetector, type ShotTake } from './shot';

export type MoveName = 'crossover' | 'inout' | 'spin';
export type MotionEvent =
	| { type: 'set' }
	| { type: 'cancel' }
	| { type: 'shot'; take: ShotTake }
	| { type: 'pumpfake' }
	| { type: 'move'; move: MoveName }
	| { type: 'jump' }
	| { type: 'triple' };

export interface MotionState {
	/** Body in view this frame. */
	tracked: boolean;
	/** Steps to the side, in shoulder widths (+ = your right). */
	x: number;
	/** Toward the camera (+) or back (-), as a share of your starting size (0.2 = a big step closer). */
	depth: number;
	/** How far the hips have risen above where they usually are (shoulder widths): a jump. */
	air: number;
	/** Leaning toward the camera (+, move forward) or back (-), against your normal stance; 0 inside a small dead zone. */
	lean: number;
	/** The hand you're dribbling with (the lower one, at dribbling height), or null. */
	hand: 'left' | 'right' | null;
	/** Knees bent (0 standing tall … 1 deep squat). */
	crouch: number;
	/** Knees bent, hands together at the waist. */
	triple: boolean;
	/** The hands are up in a shooting set. */
	setting: boolean;
	/** Hands low (dribbling height). */
	low: boolean;
	/** The latest frame's numbers (for the practice read-outs). */
	f: number[];
}

export class Motion {
	state: MotionState = { tracked: false, x: 0, depth: 0, lean: 0, hand: null, air: 0, crouch: 0, triple: false, setting: false, low: false, f: Array(8).fill(0) };
	private base: { cx: number; sw: number; legs: number; lean: number } | null = null;
	private calib: { cx: number; sw: number; legs: number; lean: number }[] | null = null;
	private leanEma = 0;
	private hipEma: number | null = null;
	private swEma: number | null = null;
	private airborne = false;
	private tripleSince = 0;
	private lastTriple = 0;
	private events: MotionEvent[] = [];
	private shots: ShotDetector;
	// Dribble moves: the hands' path across the body while they're low.
	private hands: { t: number; x: number }[] = [];
	private moveCool = 0;
	private spin: { at: number } | null = null;

	constructor() {
		this.shots = new ShotDetector({
			onSet: () => this.events.push({ type: 'set' }),
			onCancel: () => this.events.push({ type: 'cancel' }),
			onShot: (take) => this.events.push({ type: 'shot', take }),
			onPumpFake: () => this.events.push({ type: 'pumpfake' })
		});
	}

	/** Stand still for a moment: that's the middle of the court and your normal size. */
	calibrate() {
		this.calib = [];
		this.base = null;
	}
	get calibrated() {
		return !!this.base;
	}
	get calibrating() {
		return !!this.calib;
	}

	/** Reads a frame; returns what happened in it. */
	push(p: Pose, t: number): MotionEvent[] {
		const b = body(p);
		const f = features(p);
		const s = this.state;
		s.tracked = b.seen > 0.5;
		s.f = f;
		if (!s.tracked) return [];
		if (this.calib) {
			this.calib.push({ cx: b.cx, sw: b.sw, legs: f[6], lean: b.lean });
			if (this.calib.length >= 30) {
				const avg = (k: 'cx' | 'sw' | 'legs' | 'lean') => this.calib!.reduce((a, c) => a + c[k], 0) / this.calib!.length;
				this.base = { cx: avg('cx'), sw: avg('sw'), legs: avg('legs'), lean: avg('lean') };
				this.calib = null;
			}
		}
		const base = this.base ?? { cx: 0.5, sw: b.sw, legs: f[6], lean: b.lean };

		// Lean (smoothed; the depth estimate is noisy), with a dead zone so standing tall is still.
		this.leanEma += (b.lean - base.lean - this.leanEma) * 0.18;
		const lean = this.leanEma;
		s.lean = Math.abs(lean) < 0.12 ? 0 : Math.max(-1, Math.min(1, (lean - Math.sign(lean) * 0.12) / 0.45));
		// The dribbling hand: the lower one, when it's down at the hips and clearly below the other.
		s.hand = f[0] < -0.9 && f[0] < f[1] - 0.35 ? 'left' : f[1] < -0.9 && f[1] < f[0] - 0.35 ? 'right' : s.hand && Math.min(f[0], f[1]) < -0.9 ? s.hand : null;

		// Turning (a spin) narrows the shoulders: hold position while side-on.
		this.swEma = this.swEma == null ? b.sw : this.swEma + (b.sw - this.swEma) * 0.04;
		const sideOn = b.sw < this.swEma * 0.75;
		if (!sideOn) {
			s.x = (b.cx - base.cx) / base.sw;
			s.depth = b.sw / base.sw - 1;
		}

		// Jumps: the hips rise quickly above where they've been lately.
		this.hipEma = this.hipEma == null ? b.hipY : this.hipEma + (b.hipY - this.hipEma) * 0.03;
		s.air = Math.max(0, (this.hipEma - b.hipY) / b.sw);
		if (!this.airborne && s.air > 0.35) {
			this.airborne = true;
			this.events.push({ type: 'jump' });
		} else if (this.airborne && s.air < 0.15) this.airborne = false;

		s.crouch = Math.max(0, Math.min(1, ((base.legs - f[6]) / Math.max(0.5, base.legs)) * 3));
		// Triple threat: knees bent, both hands together low in front.
		const handsLow = f[0] < -0.4 && f[1] < -0.4;
		const bent = f[6] < base.legs * 0.9;
		const triple = bent && handsLow && f[0] > -1.8 && f[1] > -1.8 && f[7] < 1.0;
		if (triple && !s.triple) this.tripleSince = t;
		if (triple && t - this.tripleSince > 500 && t - this.lastTriple > 1500) {
			this.lastTriple = t;
			this.events.push({ type: 'triple' });
		}
		s.triple = triple;
		s.low = (f[0] + f[1]) / 2 < -0.5;

		this.shots.push(f, t);
		s.setting = this.shots.phase == 'set';
		this.dribbleMoves(b, t, sideOn);

		const out = this.events;
		this.events = [];
		return out;
	}

	private dribbleMoves(b: ReturnType<typeof body>, t: number, sideOn: boolean) {
		// Spin: the shoulders go narrow (side-on, back to the camera) and come back within a second.
		if (sideOn && !this.spin) this.spin = { at: t };
		if (this.spin && !sideOn) {
			if (t - this.spin.at > 150 && t - this.spin.at < 1300 && t > this.moveCool) this.fire('spin', t);
			this.spin = null;
		}
		if (this.spin && t - this.spin.at > 2000) this.spin = null;
		if (!this.state.low || sideOn) {
			this.hands = [];
			return;
		}
		// Where the hands are across the body, in shoulder widths (+ = your right).
		const hx = (b.handX - b.cx) / b.sw;
		this.hands.push({ t, x: hx });
		while (this.hands.length && this.hands[0].t < t - 800) this.hands.shift();
		if (t < this.moveCool || this.hands.length < 4) return;
		const recent = this.hands.filter((h) => h.t > t - 450);
		const minX = Math.min(...recent.map((h) => h.x));
		const maxX = Math.max(...recent.map((h) => h.x));
		// Crossover: from one side of the body to the other, fast.
		if (minX < -0.45 && maxX > 0.45) {
			const iMin = recent.findIndex((h) => h.x == minX);
			const iMax = recent.findIndex((h) => h.x == maxX);
			if (Math.abs(iMin - iMax) >= 2) return this.fire('crossover', t);
		}
		// In-and-out: out to one side, in toward the middle, back out — all on the same side.
		for (const side of [1, -1]) {
			const xs = this.hands.map((h) => h.x * side);
			const out1 = xs.findIndex((x) => x > 0.55);
			if (out1 < 0) continue;
			const inn = xs.findIndex((x, i) => i > out1 && x < 0.2 && x > -0.3);
			if (inn < 0) continue;
			const out2 = xs.findIndex((x, i) => i > inn && x > 0.55);
			if (out2 > 0) return this.fire('inout', t);
		}
	}
	private fire(move: MoveName, t: number) {
		this.events.push({ type: 'move', move });
		this.moveCool = t + 650;
		this.hands = [];
	}
}
