// Check-up: the players' poses. A pose is a few joint angles (arms and legs bend side to side, as
// seen from behind; + turns a limb toward the player's right) plus the hips' height and a lean.
// Your player copies your body (fromPose); the computer player plays these animations.
import { P, type Pose } from './pose';

export interface Joints {
	/** Upper and lower arms, left and right (0 = hanging down, ±π = straight up). */
	lu: number;
	ll: number;
	ru: number;
	rl: number;
	/** Thighs and shins. */
	lt: number;
	ls: number;
	rt: number;
	rs: number;
	/** Hips up (+) or down (crouch, -). */
	y: number;
	/** Lean to the right (+) or left. */
	lean: number;
}

export const REST: Joints = { lu: -0.15, ll: -0.1, ru: 0.15, rl: 0.1, lt: -0.06, ls: 0.04, rt: 0.06, rs: -0.04, y: 0, lean: 0 };

const mix = (a: Joints, b: Joints, k: number): Joints => {
	const o = {} as Joints;
	for (const key of Object.keys(a) as (keyof Joints)[]) o[key] = a[key] + (b[key] - a[key]) * k;
	return o;
};
const smooth = (k: number) => k * k * (3 - 2 * k);
/** Plays keyframes [time 0..1, pose] over a normalised time. */
function keys(t: number, frames: [number, Partial<Joints>][]): Joints {
	const full = frames.map(([at, j]) => [at, { ...REST, ...j }] as [number, Joints]);
	if (t <= full[0][0]) return full[0][1];
	for (let i = 1; i < full.length; i++) {
		const [t1, j1] = full[i];
		const [t0, j0] = full[i - 1];
		if (t <= t1) return mix(j0, j1, smooth((t - t0) / (t1 - t0 || 1)));
	}
	return full[full.length - 1][1];
}

const STANCE: Partial<Joints> = { lu: -1.05, ll: -0.5, ru: 1.05, rl: 0.5, lt: -0.3, ls: 0.25, rt: 0.3, rs: -0.25, y: -0.45 };

export type AnimName = 'idle' | 'dribble' | 'stance' | 'slide' | 'shoot' | 'layup' | 'dunk' | 'pumpfake' | 'crossover' | 'spin' | 'stumble' | 'fall' | 'block' | 'celebrate' | 'sad';
/** Loops, timed by the clock (so the ball and the hands stay in step); the rest play once. */
export const LOOPS: AnimName[] = ['idle', 'dribble', 'stance', 'slide', 'celebrate', 'sad'];
/** How long each one-off animation lasts (ms). Loops (idle, dribble, stance, slide) have none. */
export const DURATION: Partial<Record<AnimName, number>> = {
	shoot: 950, layup: 900, dunk: 1000, pumpfake: 600, crossover: 450, spin: 700, stumble: 1300, fall: 2000, block: 900, celebrate: 1600, sad: 1400
};
/** When the ball leaves the hands, as a share of the shot animation. */
export const RELEASE_AT = { shoot: 0.5, layup: 0.55, dunk: 0.5 };

/** The pose for an animation `ms` after it started. */
export function animate(name: AnimName, ms: number): Joints {
	const dur = DURATION[name] ?? 1000;
	const t = Math.min(1, ms / dur);
	const s = ms / 1000;
	switch (name) {
		case 'idle':
			return { ...REST, y: Math.sin(s * 2) * 0.04 };
		case 'dribble': {
			// A few bounces with one hand, a crossover, a few with the other (see dribbleState).
			const d = dribbleState('dribble', ms);
			const pose = (side: 1 | -1) => dribblePose(side, s);
			if (d.cross == null) return pose(d.hand == 'right' ? 1 : -1);
			const from = d.hand == 'right' ? 1 : -1;
			return mixJ(pose(from), crossPose(), Math.sin(d.cross * Math.PI)) ;
		}
		case 'stance':
			return { ...REST, ...STANCE, y: -0.45 + Math.sin(s * 5) * 0.04 };
		case 'slide': {
			const k = Math.sin(s * 9);
			return { ...REST, ...STANCE, lt: -0.45 + k * 0.15, rt: 0.45 + k * 0.15, y: -0.5 + Math.abs(k) * 0.08 };
		}
		case 'shoot':
			return keys(t, [
				[0, { ...STANCE, y: -0.3 }],
				[0.25, { lu: -2.3, ll: 2.0, ru: 2.3, rl: -2.0, y: -0.6, lt: -0.2, ls: 0.3, rt: 0.2, rs: -0.3 }],
				[0.5, { lu: -3.0, ll: 0.1, ru: 3.0, rl: -0.1, y: 1.3 }],
				[0.7, { lu: -2.9, ll: 0.6, ru: 2.9, rl: -0.6, y: 1.0 }],
				[1, { ...REST }]
			]);
		case 'layup':
			return keys(t, [
				[0, { ...STANCE, y: -0.2 }],
				[0.3, { lu: -1.4, ll: 0.8, ru: 1.6, rl: -0.4, lt: -0.6, ls: 1.0, y: 0.2 }],
				[0.55, { lu: -0.8, ru: 3.05, rl: 0, lt: -1.1, ls: 1.4, y: 1.6, lean: 0.12 }],
				[1, { ...REST }]
			]);
		case 'dunk':
			// Gather, rise with the ball high, throw it down, hang on the rim a moment.
			return keys(t, [
				[0, { ...STANCE, y: -0.5 }],
				[0.25, { lu: -2.2, ll: 1.6, ru: 2.2, rl: -1.6, y: -0.8, lt: -0.3, ls: 0.5, rt: 0.3, rs: -0.5 }],
				[0.5, { lu: -3.05, ll: 0, ru: 3.05, rl: 0, y: 3.2, lt: -0.5, ls: 0.9, rt: 0.2, rs: 0.3 }],
				[0.7, { lu: -2.9, ll: 0.2, ru: 2.9, rl: -0.2, y: 2.8, lt: -0.2, ls: 0.4, rt: 0.2, rs: 0.3 }],
				[1, { ...REST }]
			]);
		case 'pumpfake':
			return keys(t, [
				[0, { ...STANCE, y: -0.3 }],
				[0.4, { lu: -2.4, ll: 1.6, ru: 2.4, rl: -1.6, y: -0.1 }],
				[1, { ...STANCE, y: -0.35 }]
			]);
		case 'crossover':
			return keys(t, [
				[0, { ...STANCE, ru: 0.6, rl: 0.2, lean: 0.25, y: -0.4 }],
				[0.5, { ...STANCE, ru: -0.3, rl: -0.6, lu: 0.2, ll: 0.3, lean: 0, y: -0.55 }],
				[1, { ...STANCE, lu: -0.6, ll: -0.2, lean: -0.25, y: -0.4 }]
			]);
		case 'spin':
			return keys(t, [
				[0, { ...STANCE, y: -0.4 }],
				[0.5, { ...STANCE, lu: -1.6, ru: 1.6, y: -0.3 }],
				[1, { ...STANCE, y: -0.4 }]
			]);
		case 'fall':
			// Ankles broken: down on the floor, then back up.
			return keys(t, [
				[0, { ...STANCE }],
				[0.15, { lean: 1.0, y: -0.9, lu: -1.7, ll: -0.4, ru: 1.9, rl: 0.5, lt: -0.5, rt: 0.35 }],
				[0.32, { lean: 1.45, y: -1.95, lu: -2.6, ll: 0.3, ru: 0.5, rl: 0.2, lt: -0.9, ls: 0.6, rt: 0.6, rs: -0.2 }],
				[0.72, { lean: 1.42, y: -1.92, lu: -2.4, ll: 0.5, ru: 0.7, rl: 0.1, lt: -0.8, ls: 0.7, rt: 0.5, rs: -0.1 }],
				[1, { ...STANCE }]
			]);
		case 'stumble':
			return keys(t, [
				[0, { ...STANCE }],
				[0.2, { lu: -1.8, ll: -0.6, ru: 0.6, rl: 0.6, lt: -0.7, ls: 0.6, rt: 0.2, rs: 0.1, y: -0.9, lean: -0.5 }],
				[0.55, { lu: -1.2, ru: 1.6, lt: -0.5, rt: 0.5, y: -1.1, lean: 0.35 }],
				[1, { ...STANCE }]
			]);
		case 'block':
			return keys(t, [
				[0, { ...STANCE }],
				[0.15, { ...STANCE, y: -0.7 }],
				[0.45, { lu: -3.1, ll: 0, ru: 3.1, rl: 0, y: 1.8, lt: -0.15, rt: 0.15 }],
				[1, { ...STANCE }]
			]);
		case 'celebrate': {
			const hop = Math.abs(Math.sin(s * 7));
			return { ...REST, lu: -2.8, ll: -0.3, ru: 2.8, rl: 0.3, y: hop * 0.7 };
		}
		case 'sad':
			return { ...REST, lu: -0.05, ru: 0.05, y: -0.25, lean: Math.sin(s * 1.5) * 0.05 };
	}
}

const mixJ = mix;
/** Dribbling with one hand (side 1 = right): the arm pumps with the bounce, the other arm guards. */
function dribblePose(side: 1 | -1, s: number): Joints {
	const b = Math.sin(s * Math.PI * 2 * BOUNCE_HZ);
	const bob = Math.abs(b) * 0.07;
	const ball = { u: 0.5 + b * 0.1, l: -0.25 + b * 0.38 };
	const guard = { u: -0.95, l: -0.55 };
	const arms = side > 0 ? { ru: ball.u, rl: ball.l, lu: guard.u, ll: guard.l } : { lu: -ball.u, ll: -ball.l, ru: -guard.u, rl: -guard.l };
	return { ...REST, ...STANCE, ...arms, y: -0.38 + bob, lean: side * 0.07 };
}
/** Halfway through a crossover: both hands low in front, body dipping. */
function crossPose(): Joints {
	return { ...REST, ...STANCE, lu: 0.25, ll: 0.5, ru: -0.25, rl: -0.5, y: -0.55, lean: 0 };
}
/** Bounces a second (the ball's rhythm; court.ts bounces the ball to it). */
export const BOUNCE_HZ = 2.2;

/**
 * Which hand has the ball, and how far through a crossover (0..1, from that hand to the other)
 * the ball is, for the dribbling animations.
 */
export function dribbleState(name: AnimName, ms: number): { hand: 'left' | 'right'; cross: number | null } {
	if (name == 'crossover') {
		const k = Math.min(1, ms / DURATION.crossover!);
		return { hand: 'right', cross: k < 0.15 || k > 0.85 ? null : (k - 0.15) / 0.7 };
	}
	if (name != 'dribble') return { hand: 'right', cross: null };
	// 2.6 s: right hand, cross over, left hand, cross back.
	const c = (ms / 1000) % 2.6;
	if (c < 1.1) return { hand: 'right', cross: null };
	if (c < 1.3) return { hand: 'right', cross: (c - 1.1) / 0.2 };
	if (c < 2.4) return { hand: 'left', cross: null };
	return { hand: 'left', cross: (c - 2.4) / 0.2 };
}

/** Your body, as joint angles (seen from behind, so the camera's picture is mirrored). */
export function fromPose(p: Pose): Joints {
	// A direction in the picture as the angle of a limb hanging from its top end.
	const dir = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(-(b.x - a.x), b.y - a.y);
	const lu = dir(p[P.lShoulder], p[P.lElbow]);
	const ru = dir(p[P.rShoulder], p[P.rElbow]);
	const lt = dir(p[P.lHip], p[P.lKnee]);
	const rt = dir(p[P.rHip], p[P.rKnee]);
	const lean = Math.atan2(p[P.rShoulder].y - p[P.lShoulder].y, p[P.lShoulder].x - p[P.rShoulder].x);
	// Bends as the smallest turn (so a joint never flips round the long way).
	const bend = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
	// The legs: when the knees or ankles are out of the picture (or guessed), the model makes them up
	// and they can cross over each other. Keep each leg on its own side, bending the way knees bend,
	// and fall back to an athletic stance when they can't be seen.
	const seen = Math.min(p[P.lKnee].visibility ?? 1, p[P.rKnee].visibility ?? 1, p[P.lAnkle].visibility ?? 1, p[P.rAnkle].visibility ?? 1);
	const legs =
		seen < 0.5
			? { lt: STANCE.lt!, ls: STANCE.ls!, rt: STANCE.rt!, rs: STANCE.rs! }
			: {
					lt: clamp(lt, -1.3, 0.12),
					ls: clamp(bend(dir(p[P.lKnee], p[P.lAnkle]) - lt), -0.35, 1.7),
					rt: clamp(rt, -0.12, 1.3),
					rs: clamp(bend(dir(p[P.rKnee], p[P.rAnkle]) - rt), -1.7, 0.35)
				};
	return {
		lu,
		ll: bend(dir(p[P.lElbow], p[P.lWrist]) - lu),
		ru,
		rl: bend(dir(p[P.rElbow], p[P.rWrist]) - ru),
		...legs,
		y: 0, // set from Motion (crouch / jump)
		lean: -lean
	};
}
