// Check-up: a 1-on-1 game against the computer, to 11 by ones and twos (twos from behind the arc).
// Everything you do comes from your body (Motion): lean forward / back to move (on offense toward
// the hoop and your dribbling hand's side; on defense up on your man or back toward the rim, with
// side steps to slide), dribble moves to break ankles, pump fakes to make them jump, shots and
// layups judged against your practice templates, and jumps to block. Where you guard matters: sag
// off and he shoots it open; crowd him and he'll try to drive by. Seven ratings shape the odds.
import { ARC, CHECK, HOOP, type Court, type Look } from './court';
import { DURATION, RELEASE_AT, animate, type AnimName, type Joints } from './anim';
import type { MotionEvent, MotionState } from './motion';
import { judge, shotWindow, zoneOf, shotRating, UNLOCK_AT, type Grade, type ShotKind, type ShotTemplate } from './shot';

export type Side = 'you' | 'cpu';
/** Ratings, 0–99. (Handles is `dribbling`, kept for old saves.) */
export interface Stats {
	shooting: number;
	three: number;
	finishing: number;
	dribbling: number;
	speed: number;
	defense: number;
	blocking: number;
}
export const STAT_INFO: { key: keyof Stats; name: string; what: string }[] = [
	{ key: 'shooting', name: 'Mid-range', what: 'Jumpers inside the arc: bigger green window, better odds' },
	{ key: 'three', name: 'Three-point', what: 'Shots from deep (worth 2)' },
	{ key: 'finishing', name: 'Finishing', what: 'Layups and close shots' },
	{ key: 'dribbling', name: 'Handles', what: 'Break more ankles; fewer steals' },
	{ key: 'speed', name: 'Speed', what: 'How fast you drive and slide' },
	{ key: 'defense', name: 'Defense', what: 'Fall for fewer ankle breakers; better contests' },
	{ key: 'blocking', name: 'Blocking', what: 'Wider block window, more blocks' }
];
export const START_STATS: Stats = { shooting: 40, three: 35, finishing: 40, dribbling: 40, speed: 40, defense: 40, blocking: 35 };

/** The flash on screen: what happened (a shot shows its grade and make chance). */
export interface Flash {
	text: string;
	sub?: string;
	color: string;
	at: number;
	kind?: 'shot' | 'make' | 'miss' | 'move' | 'bad' | 'block' | 'info';
	pct?: number;
	grade?: Grade;
}
/** Moments the opponent has something to say about. */
export type TalkKind = 'theyScore' | 'youScore' | 'theyBreakYou' | 'youBreakThem' | 'youBlock' | 'theyBlock' | 'bit';

/** An opponent's seven ratings, from their three headline ones and their style. */
export function cpuStats(l: Level): Stats {
	const big = (l.look.scale ?? 1) > 1.1;
	const c = (v: number) => Math.max(5, Math.min(99, Math.round(v)));
	return {
		shooting: l.shooting,
		three: c(l.shooting + (l.style.deep ? 8 : big ? -25 : -8)),
		finishing: c((l.shooting + l.dribbling) / 2 + (big ? 18 : 4)),
		dribbling: l.dribbling,
		speed: c(l.dribbling * (l.style.speed ?? 1) - (big ? 8 : 0)),
		defense: l.defense,
		blocking: c(l.defense + (big ? 14 : -6))
	};
}
/**
 * An opponent on the Street Ladder: each win unlocks the next, tougher one (and a bigger crowd).
 * Parody versions of legends, playing the way the real ones did.
 */
export interface Level extends Pick<Stats, 'shooting' | 'dribbling' | 'defense'> {
	name: string;
	/** Their style, in a line. */
	tag: string;
	look: Look;
	style: {
		/** How often they pull up when open (vs driving). */
		pullUp: number;
		/** Steps back behind the arc to shoot threes. */
		deep: boolean;
		/** Favourite dribble move. */
		move: 'crossover' | 'spin';
		/** How often they try a move when you're in front. */
		moves: number;
		/** Burst on drives (1 = normal). */
		speed?: number;
		/** Throws it down at the rim (also anyone with Finishing 70+). */
		dunk?: boolean;
	};
}
export const LADDER: Level[] = [
	{
		name: 'Spud Web 1.0', tag: 'Old-school, slow loading, still dunks', shooting: 24, dribbling: 32, defense: 22,
		look: { skin: '#7a4a26', hair: 'short', hairColor: '#1f130a', jersey: '#dc2626', shorts: '#f8fafc', number: 4, scale: 0.78, wrist: '#14b8a6' },
		style: { pullUp: 0.2, deep: false, move: 'crossover', moves: 0.03, dunk: true }
	},
	{
		name: 'Dennis RobotMan', tag: 'All defense, no offense', shooting: 22, dribbling: 24, defense: 46,
		look: { skin: '#7a4a26', hair: 'buzz', hairColor: '#39ff14', jersey: '#dc2626', shorts: '#0f172a', number: 91 },
		style: { pullUp: 0.25, deep: false, move: 'spin', moves: 0.015 }
	},
	{
		name: 'Manute BOOL', tag: 'True or false: you can score on him', shooting: 18, dribbling: 16, defense: 58,
		look: { skin: '#3d2414', hair: 'bald', hairColor: '#1f130a', jersey: '#1d4ed8', shorts: '#1d4ed8', number: 10, scale: 1.35, band: '#f8fafc' },
		style: { pullUp: 0.12, deep: false, move: 'spin', moves: 0.01 }
	},
	{
		name: "Shaquille O'NeuralNet", tag: 'A deep network that lives in the paint', shooting: 34, dribbling: 30, defense: 52,
		look: { skin: '#4e2f19', hair: 'bald', hairColor: '#1f130a', jersey: '#f59e0b', shorts: '#6d28d9', number: 34, scale: 1.25, shoes: '#6d28d9|#facc15' },
		style: { pullUp: 0.08, deep: false, move: 'spin', moves: 0.02, dunk: true }
	},
	{
		name: 'Regex Miller', tag: 'Matches every pattern, especially from deep', shooting: 62, dribbling: 40, defense: 40,
		look: { skin: '#7a4a26', hair: 'bald', hairColor: '#1f130a', jersey: '#facc15', shorts: '#1e3a8a', number: 31, knee: '#1e3a8a' },
		style: { pullUp: 0.75, deep: true, move: 'crossover', moves: 0.015 }
	},
	{
		name: 'Steve Hash', tag: 'Hashes out the perfect shot', shooting: 64, dribbling: 58, defense: 38,
		look: { skin: '#f6d5bc', hair: 'long', hairColor: '#5a3825', jersey: '#7c3aed', shorts: '#f97316', number: 13, wrist: '#dc2626' },
		style: { pullUp: 0.6, deep: false, move: 'crossover', moves: 0.03 }
	},
	{
		name: 'Derrick ROWS', tag: 'Inserts himself into every fast break', shooting: 50, dribbling: 70, defense: 50,
		look: { skin: '#65391d', hair: 'buzz', hairColor: '#1f130a', jersey: '#dc2626', shorts: '#111827', number: 1, shoes: '#dc2626|#f8fafc' },
		style: { pullUp: 0.25, deep: false, move: 'crossover', moves: 0.045, speed: 1.3, dunk: true }
	},
	{
		name: 'A.I.', tag: 'The crossover king', shooting: 55, dribbling: 78, defense: 48,
		look: { skin: '#a0663a', hair: 'cornrows', hairColor: '#1f130a', jersey: '#f8fafc', shorts: '#1e3a8a', number: 3, scale: 0.9, sleeve: '#f8fafc' },
		style: { pullUp: 0.35, deep: false, move: 'crossover', moves: 0.05 }
	},
	{
		name: 'Tim DuncANN', tag: 'Neural-net fundamentals', shooting: 60, dribbling: 50, defense: 72,
		look: { skin: '#4e2f19', hair: 'buzz', hairColor: '#1f130a', jersey: '#9ca3af', shorts: '#111827', number: 21, scale: 1.15 },
		style: { pullUp: 0.45, deep: false, move: 'spin', moves: 0.02 }
	},
	{
		name: 'Hakeem OlaJSON', tag: 'Spins, shakes, swats, and parses your every move', shooting: 58, dribbling: 62, defense: 78,
		look: { skin: '#3d2414', hair: 'short', hairColor: '#1f130a', jersey: '#dc2626', shorts: '#f8fafc', number: 34, scale: 1.15, shoes: '#1e3a8a|#dc2626' },
		style: { pullUp: 0.3, deep: false, move: 'spin', moves: 0.04, dunk: true }
	},
	{
		name: 'Kernel Durant', tag: 'Seven feet of buckets, running at ring zero', shooting: 78, dribbling: 66, defense: 60,
		look: { skin: '#7a4a26', hair: 'short', hairColor: '#1f130a', jersey: '#2563eb', shorts: '#f97316', number: 35, scale: 1.2, band: '#111827' },
		style: { pullUp: 0.65, deep: false, move: 'crossover', moves: 0.03, dunk: true }
	},
	{
		name: 'Steph cURL', tag: 'Fetches threes from any range', shooting: 84, dribbling: 74, defense: 56,
		look: { skin: '#c68642', hair: 'short', hairColor: '#1f130a', jersey: '#2563eb', shorts: '#facc15', number: 30, scale: 0.92, shoes: '#2563eb|#facc15' },
		style: { pullUp: 0.8, deep: true, move: 'crossover', moves: 0.035 }
	},
	{
		name: 'Kobe BYTEant', tag: 'Mamba mentality, one byte at a time', shooting: 82, dribbling: 80, defense: 76,
		look: { skin: '#8d5a34', hair: 'buzz', hairColor: '#1f130a', jersey: '#6d28d9', shorts: '#facc15', number: 24, sleeve: '#6d28d9' },
		style: { pullUp: 0.55, deep: false, move: 'spin', moves: 0.045, dunk: true }
	},
	{
		name: 'LeBot James', tag: 'The chosen one, trained on everything', shooting: 78, dribbling: 80, defense: 80,
		look: { skin: '#65391d', hair: 'buzz', hairColor: '#1f130a', jersey: '#7f1d1d', shorts: '#facc15', number: 6, scale: 1.15, chain: '#facc15', hat: '#facc15' },
		style: { pullUp: 0.35, deep: false, move: 'crossover', moves: 0.04, speed: 1.15, dunk: true }
	},
	{
		name: 'AI Jordan', tag: 'The GOAT. Good luck.', shooting: 88, dribbling: 86, defense: 88,
		look: { skin: '#7a4a26', hair: 'bald', hairColor: '#1f130a', jersey: '#dc2626', shorts: '#0f172a', number: 23, shoes: '#dc2626|#111827', wrist: '#111827' },
		style: { pullUp: 0.5, deep: false, move: 'crossover', moves: 0.05, dunk: true }
	}
];
export const TO = 11;
const SHOT_CLOCK = 15_000;
const CHECK_MS = 2600;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const toHoop = (p: { x: number; z: number }) => Math.hypot(p.x - HOOP.x, p.z - HOOP.z);
const pointsFrom = (p: { x: number; z: number }) => (toHoop(p) > ARC ? 2 : 1);

/**
 * The ball handler's move this frame (facing the basket). Lean forward: attack the basket itself
 * (so you don't drift into a corner), angled a little toward your dribbling hand, faster the more
 * you lean. Lean back: back away. Stand tall: drift slowly back out toward the top of the key.
 * (`facing` is kept for callers; the direction always comes from where the basket is.)
 */
export function leanMove(p: { x: number; z: number }, m: MotionState, speed: number, _facing: -1 | 1 = -1) {
	void _facing;
	const tx = HOOP.x - p.x;
	const tz = HOOP.z - p.z;
	const d = Math.hypot(tx, tz) || 1;
	const fx = tx / d;
	const fz = tz / d;
	// Your right, facing the basket.
	const rx = -fz;
	const rz = fx;
	if (m.lean > 0) {
		if (d < 1.4) return { ...p }; // at the rim
		// Toward the hand with the ball (the game keeps track of it; see `ballHand`).
		const side = m.hand == 'right' ? 1 : m.hand == 'left' ? -1 : 0;
		const a = side * 0.42; // about 24° toward the dribbling hand
		const step = speed * (0.5 + m.lean * 0.55);
		return { x: p.x + (fx * Math.cos(a) + rx * Math.sin(a)) * step, z: p.z + (fz * Math.cos(a) + rz * Math.sin(a)) * step };
	}
	if (m.lean < 0) {
		const step = speed * 0.75 * -m.lean;
		return { x: p.x - fx * step, z: p.z - fz * step };
	}
	// Standing tall: stay where you are.
	return { ...p };
}
/** A step-back: this far straight away from the basket, over a moment. */
export const STEPBACK = 2.8;
export function stepBackTo(p: { x: number; z: number }) {
	const tx = HOOP.x - p.x;
	const tz = HOOP.z - p.z;
	const d = Math.hypot(tx, tz) || 1;
	return { x: p.x - (tx / d) * STEPBACK, z: p.z - (tz / d) * STEPBACK };
}

export class SoloGame {
	score = { you: 0, cpu: 0 };
	ball: Side = 'you';
	phase: 'check' | 'live' | 'flight' | 'over' = 'check';
	phaseAt = 0;
	winner: Side | null = null;
	flash: Flash | null = null;
	/** The shot bar while you're in your shooting set (jump shots). */
	bar: { start: number; release: number; zone: number } | null = null;
	you = { x: CHECK.x, z: CHECK.z };
	cpu = { x: CHECK.x, z: CHECK.z - 1.8 };
	private cpuAnim: { name: AnimName; since: number } = { name: 'stance', since: 0 };
	private anchor = { x: 0, depth: 0 };
	private shotClockAt = 0;
	// You on offense: the defender's state.
	private cpuStumble = 0;
	private cpuAir = 0;
	private cpuThink = 0;
	private cpuTarget = { x: 0, z: 0 };
	private tripleAt = -9999;
	// You on defense: the computer's plan, and you getting beaten.
	private plan: { kind: 'size' | 'drive' | 'shoot' | 'layup'; until: number; lane: number; back?: boolean } = { kind: 'size', until: 0, lane: 0 };
	private cpuShot: { start: number; release: number; kind: 'shoot' | 'layup' | 'dunk'; resolved: boolean } | null = null;
	private beatenUntil = 0;
	private lastJump = -9999;
	private youAnim: AnimName | null = null;
	private burst: { from: { x: number; z: number }; to: { x: number; z: number }; at: number } | null = null;
	/** The hand with the ball: a crossover swaps it (crossing toward the hand that already has it loses the ball). */
	ballHand: 'left' | 'right' = 'right';
	private cs: Stats;
	/** The defender being knocked back by an ankle breaker: from, to, when. */
	private knock: { from: { x: number; z: number }; to: { x: number; z: number }; at: number } | null = null;

	constructor(
		private court: Court,
		readonly level: Level,
		private stats: Stats,
		private templates: Partial<Record<ShotKind, ShotTemplate>>,
		private sfx: (name: string) => void,
		private onEnd: (winner: Side, score: { you: number; cpu: number }, maxDown: number) => void,
		/** Counts toward achievements. */
		private track: (k: 'makes' | 'twos' | 'shakes' | 'blocks' | 'perfects' | 'bites' | 'dunks' | 'deeps' | 'floors') => void = () => {},
		/** The opponent's trash talk. */
		private talk: (k: TalkKind) => void = () => {}
	) {
		this.cs = cpuStats(level);
	}
	/** The most you were down by this game (for the Comeback achievement). */
	private maxDown = 0;

	/** Time left on the shot clock (ms). */
	shotClock(now: number) {
		return this.phase == 'live' ? Math.max(0, SHOT_CLOCK - (now - this.shotClockAt)) : SHOT_CLOCK;
	}

	start(now: number, m: MotionState) {
		this.score = { you: 0, cpu: 0 };
		this.maxDown = 0;
		this.ball = Math.random() < 0.5 ? 'you' : 'cpu';
		this.check(now, m);
	}

	/** Check-up: both players reset at the top of the key; the ball is checked, then it's live. */
	private check(now: number, m: MotionState) {
		this.ballHand = 'right';
		this.court.setYouHand('right');
		this.phase = 'check';
		this.phaseAt = now;
		this.bar = null;
		this.cpuShot = null;
		this.cpuStumble = this.cpuAir = this.beatenUntil = 0;
		this.anchor = { x: m.x, depth: m.depth };
		if (this.ball == 'you') {
			this.you = { x: CHECK.x, z: CHECK.z };
			this.cpu = { x: CHECK.x, z: CHECK.z - 1.8 };
		} else {
			this.cpu = { x: CHECK.x, z: CHECK.z };
			this.you = { x: CHECK.x, z: CHECK.z - 2.2 };
		}
		this.say(now, this.ball == 'you' ? 'Your ball' : "CPU's ball", this.ball == 'you' ? 'Check-up!' : 'Check-up! Get in front of him', '#fbbf24');
		this.sfx('check');
		this.court.ball('hold', this.ball);
		this.court.camera(this.ball == 'you' ? 'offense' : 'defense');
	}

	private say(now: number, text: string, sub: string | undefined, color: string, extra: Partial<Flash> = {}) {
		this.flash = { text, sub, color, at: now, ...extra };
	}

	update(now: number, m: MotionState, events: MotionEvent[], youJ: Joints | null) {
		if (this.phase == 'over') {
			this.draw(now, youJ);
			return;
		}
		if (this.phase == 'check') {
			if (now - this.phaseAt > CHECK_MS) {
				this.phase = 'live';
				this.phaseAt = this.shotClockAt = now;
				this.anchor = { x: m.x, depth: m.depth };
				this.plan = { kind: 'size', until: now + 700 + Math.random() * 900, lane: 0 };
				this.sfx('whistle');
			}
			this.draw(now, youJ);
			return;
		}
		// Moving. On offense: lean forward to attack the hoop, back to retreat, drifting toward the side
		// of the hand you're dribbling with. On defense: lean toward or away from your man, and slide
		// sideways with your feet (steps from where you stood at the check).
		const off = this.ball == 'you';
		if (this.phase == 'live') {
			let next = off ? leanMove(this.you, { ...m, hand: this.ballHand }, (6 + this.stats.speed * 0.05) / 60, -1) : { ...this.you };
			// A step-back: a quick burst straight away from the basket (and your defender).
			if (off && this.burst && now - this.burst.at < 300) {
				const k = 1 - (1 - (now - this.burst.at) / 300) ** 2;
				next = { x: this.burst.from.x + (this.burst.to.x - this.burst.from.x) * k, z: this.burst.from.z + (this.burst.to.z - this.burst.from.z) * k };
			}
			if (!off && now > this.beatenUntil - 700) {
				// Defense: side steps slide you across; lean forward to step up on him, back to sag off.
				const targetX = CHECK.x - (m.x - this.anchor.x) * 2.6;
				const v = (7.5 + this.stats.speed * 0.05) / 60;
				next.x += clamp(targetX - next.x, -v, v);
				next.z += m.lean * v;
				// Staying in front: when you're close, your feet slide you onto his line to the basket
				// (better defenders more so).
				const near = dist(this.you, this.cpu);
				if (near < 3 && now > this.beatenUntil) {
					const hx = HOOP.x - this.cpu.x;
					const hz = HOOP.z - this.cpu.z;
					const hd = Math.hypot(hx, hz) || 1;
					const spot = { x: this.cpu.x + (hx / hd) * Math.min(near, 1.8), z: this.cpu.z + (hz / hd) * Math.min(near, 1.8) };
					const pull = 0.05 + this.stats.defense * 0.0008;
					next.x += (spot.x - next.x) * pull;
					next.z += (spot.z - next.z) * pull * 0.5;
				}
			}
			this.you.x = clamp(next.x, -11.5, 11.5);
			this.you.z = clamp(next.z, -13, 9.5);
		}
		for (const e of events) if (e.type == 'jump') this.lastJump = now;
		if (this.phase == 'live') {
			if (off) this.offense(now, m, events);
			else this.defense(now, events);
			if (this.phase == 'live' && now - this.shotClockAt > SHOT_CLOCK) {
				this.say(now, 'Shot clock!', 'Turnover', '#f87171');
				this.sfx('buzzer');
				this.change(now, m);
			}
		} else if (this.phase == 'flight' && !off && this.cpuShot && !this.cpuShot.resolved) this.resolveCpuShot(now);
		this.lastMotion = m;
		this.draw(now, youJ);
	}
	private lastMotion: MotionState | null = null;

	// ── You have the ball ──
	private offense(now: number, m: MotionState, events: MotionEvent[]) {
		const near = dist(this.you, this.cpu);
		// The defender: stays between you and the hoop, reacting with a delay (better defenders are quicker).
		if (now < this.cpuStumble) {
			// Ankles broken: knocked back (and maybe down) for a moment.
			if (this.knock) {
				const k = Math.min(1, (now - this.knock.at) / 320);
				const e = 1 - (1 - k) ** 3;
				this.cpu.x = this.knock.from.x + (this.knock.to.x - this.knock.from.x) * e;
				this.cpu.z = this.knock.from.z + (this.knock.to.z - this.knock.from.z) * e;
			}
		} else if (now < this.cpuAir) this.setCpuAnim('block', now);
		else {
			if (now > this.cpuThink) {
				const hx = HOOP.x - this.you.x;
				const hz = HOOP.z - this.you.z;
				const hd = Math.hypot(hx, hz) || 1;
				this.cpuTarget = { x: this.you.x + (hx / hd) * 2.0, z: this.you.z + (hz / hd) * 2.0 };
				this.cpuThink = now + 340 - this.level.defense * 1.5;
			}
			const tx = this.cpuTarget.x - this.cpu.x;
			const tz = this.cpuTarget.z - this.cpu.z;
			const td = Math.hypot(tx, tz);
			const v = (3.8 + this.cs.speed * 0.035) / 60;
			if (td > 0.05) {
				const step = Math.min(td, v);
				this.cpu.x += (tx / td) * step;
				this.cpu.z += (tz / td) * step;
			}
			this.setCpuAnim(td > 0.4 ? 'slide' : 'stance', now);
			// You can't walk through a defender who's set: you bump off.
			// (Only head-on: get a shoulder past him and you're by.)
			if (Math.abs(this.you.x - this.cpu.x) < 0.85 && this.you.z < this.cpu.z + 1.0 && this.you.z > this.cpu.z - 0.4 && td < 0.3) this.you.z = this.cpu.z + 1.0;
		}
		this.court.ball(m.setting ? 'hold' : 'dribble', 'you');
		const tpl = this.templates.jumpshot;
		for (const e of events) {
			if (e.type == 'set' && tpl) this.bar = { start: now, release: tpl.release, zone: shotWindow(tpl, shotRating(this.stats, 'jumpshot', toHoop(this.you))) };
			else if (e.type == 'cancel') this.bar = null;
			else if (e.type == 'triple') {
				this.tripleAt = now;
				this.say(now, 'Triple threat', 'Next move is quicker', '#93c5fd');
			} else if (e.type == 'pumpfake') {
				this.bar = null;
				if (near < 3.2 && now > this.cpuAir && Math.random() < 0.6 - this.level.defense * 0.004) {
					this.cpuAir = now + 950;
					this.track('bites');
					this.talk('bit');
					this.say(now, 'He bit!', 'Shoot or drive now', '#34d399', { kind: 'move' });
					this.sfx('ooh');
				} else this.say(now, 'Pump fake', 'He stayed down', '#cbd5e1');
			} else if (e.type == 'stepback') {
				this.burst = { from: { ...this.you }, to: stepBackTo(this.you), at: now };
				this.say(now, 'Step-back', 'Room to shoot', '#93c5fd', { kind: 'move' });
				this.sfx('squeak');
			} else if (e.type == 'move') {
				const name = { crossover: 'Crossover', inout: 'In-and-out', spin: 'Spin move' }[e.move];
				if (e.move == 'spin') this.court.spin('you');
				if (e.move == 'crossover') {
					// The ball has to cross from the hand it's in to the other one.
					const from = this.ballHand;
					if (e.to == from) {
						this.say(now, 'Lost the handle!', `The ball was in your ${from} hand`, '#f87171', { kind: 'bad' });
						this.sfx('steal');
						return this.change(now, m);
					}
					this.ballHand = from == 'right' ? 'left' : 'right';
					this.court.setYouHand(this.ballHand);
				}
				if (near > 2.8 || now < this.cpuStumble) {
					this.say(now, name, undefined, '#cbd5e1');
					continue;
				}
				// Your handles against his defense (a triple threat first helps).
				const chance = 0.25 + this.stats.dribbling * 0.0065 + (now - this.tripleAt < 2500 ? 0.12 : 0) - this.cs.defense * 0.0045;
				if (Math.random() < chance) {
					// Most ankle breakers send him stumbling back; the nastiest put him on the floor.
					const floor = Math.random() < 0.05 + this.stats.dribbling * 0.002 - this.cs.defense * 0.0015;
					this.cpuStumble = now + (floor ? 2000 : 1300);
					const dx = this.cpu.x - this.you.x;
					const dz = this.cpu.z - this.you.z;
					const dd = Math.hypot(dx, dz) || 1;
					const push = floor ? 2.6 : 1.7;
					// Knocked back and off to the side, out of your way.
					const side = e.move == 'crossover' || e.move == 'inout' ? (Math.random() < 0.5 ? 1 : -1) : 0;
					this.knock = { from: { ...this.cpu }, to: { x: clamp(this.cpu.x + (dx / dd) * push * 0.6 + side * push * 0.8, -11.5, 11.5), z: clamp(this.cpu.z + (dz / dd) * push * 0.6, -13, 9.5) }, at: now };
					this.setCpuAnim(floor ? 'fall' : 'stumble', now, true);
					this.track('shakes');
					if (floor) this.track('floors');
					this.talk('youBreakThem');
					this.say(now, floor ? 'ANKLES!' : e.move == 'crossover' ? 'Shook him!' : 'Got him leaning!', floor ? `${name} · he's on the floor` : name, '#facc15', { kind: 'move' });
					this.sfx('ooh');
				} else if (Math.random() < 0.12 - this.stats.dribbling * 0.0008) {
					this.say(now, 'Stripped!', 'Turnover', '#f87171', { kind: 'bad' });
					this.sfx('steal');
					return this.change(now, m);
				} else {
					this.say(now, name, 'He stayed in front', '#cbd5e1', { kind: 'info' });
					this.sfx('squeak');
				}
			} else if (e.type == 'shot') {
				this.bar = null;
				this.yourShot(now, e.take.kind, e);
				return;
			}
		}
	}

	private yourShot(now: number, kind: ShotKind, e: Extract<MotionEvent, { type: 'shot' }>) {
		const d = toHoop(this.you);
		// Finishing 70+: a layup at the rim while you jump is a dunk.
		const dunk = kind == 'layup' && this.stats.finishing >= UNLOCK_AT && d < 2.8;
		const r = judge(e.take, this.templates[kind] ?? null, shotRating(this.stats, kind, d), d);
		if (r.grade == 'perfect' && this.templates[kind]) this.track('perfects');
		const near = dist(this.you, this.cpu);
		const open = now < this.cpuStumble || now < this.cpuAir;
		const contest = open ? 0 : clamp(1 - (near - 1) / 2.2, 0, 1);
		const blocked = Math.random() < contest * (0.04 + this.cs.blocking * 0.0035) * (dunk ? 0.5 : kind == 'layup' ? 1.2 : 1);
		const finalChance = r.grade == 'perfect' && kind == 'jumpshot' ? 1 : dunk ? Math.min(0.97, r.chance + 0.3) * (1 - 0.2 * contest) : r.chance * (1 - (kind == 'layup' ? 0.6 : 0.5) * contest);
		const made = !blocked && Math.random() < finalChance;
		if (contest > 0.3) this.setCpuAnim('block', now, true);
		const pts = pointsFrom(this.you);
		const label = { perfect: 'Perfect release', good: 'Good release', early: 'Early', late: 'Late' }[r.grade];
		const zone = zoneOf(d);
		const what = dunk ? 'SLAM!' : kind == 'layup' ? 'Layup' : zone == 'deep' ? (this.stats.three >= UNLOCK_AT ? 'Logo three!' : 'Heave from deep') : pts == 2 ? 'From deep' : zone == 'close' ? 'Short jumper' : 'Jumper';
		this.say(now, what, `${label}${contest > 0.4 ? ' · contested' : open ? ' · wide open' : ''}`, '#e2e8f0', {
			kind: 'shot',
			pct: Math.round(finalChance * 100),
			grade: this.templates[kind] ? r.grade : undefined
		});
		this.phase = 'flight';
		this.court.ball('hold', 'you');
		if (dunk) this.sfx('ooh');
		void this.court.shoot(made, blocked, dunk).then(() => this.result(performance.now(), 'you', made, blocked, pts, dunk));
	}

	// ── The computer has the ball ──
	private defense(now: number, events: MotionEvent[]) {
		const near = dist(this.you, this.cpu);
		const beaten = now < this.beatenUntil;
		const inFront = !beaten && Math.abs(this.you.x - this.cpu.x) < 1.6 && this.you.z < this.cpu.z + 0.3 && this.cpu.z - this.you.z < 2.6;
		this.court.ball(this.cpuShot ? 'hold' : 'dribble', 'cpu');
		if (this.cpuShot) return;
		const p = this.plan;
		if (p.kind == 'size') {
			this.setCpuAnim('dribble', now);
			if (now > p.until) {
				// Sagging off gives him the jumper; crowding him invites the drive.
				const open = near > 2.8 || !inFront;
				const st = this.level.style;
				if (toHoop(this.cpu) < 3) this.startCpuShot(now, 'layup');
				else if (st.deep && toHoop(this.cpu) <= ARC + 0.3) this.plan = { kind: 'drive', until: now + 1200, lane: this.cpu.x, back: true };
				else if (open && Math.random() < st.pullUp + 0.35) this.startCpuShot(now, 'shoot');
				else if (near > 1.8 && Math.random() < st.pullUp * 0.5) this.startCpuShot(now, 'shoot');
				else {
					const lane = this.you.x > this.cpu.x ? this.cpu.x - 2.4 : this.cpu.x + 2.4;
					this.plan = { kind: 'drive', until: now + 2600, lane: clamp(lane, -6, 6) };
				}
			}
			return;
		}
		if (p.kind == 'drive' && p.back) {
			// A shooter steps back behind the arc for a three.
			const dz = this.cpu.z - HOOP.z;
			const dx = this.cpu.x - HOOP.x;
			const dd = Math.hypot(dx, dz) || 1;
			const v = (4 + this.cs.speed * 0.03) / 60;
			this.cpu.x += (dx / dd) * v;
			this.cpu.z += (dz / dd) * v;
			this.setCpuAnim('dribble', now);
			if (toHoop(this.cpu) > ARC + 0.8 || now > p.until) this.startCpuShot(now, 'shoot');
			return;
		}
		if (p.kind == 'drive') {
			const target = { x: p.lane * 0.5, z: HOOP.z + 1.6 };
			const tx = target.x - this.cpu.x;
			const tz = target.z - this.cpu.z;
			const td = Math.hypot(tx, tz);
			// Cut off: you're right in front of him.
			const cutOff = inFront && this.cpu.z - this.you.z < 1.7;
			if (cutOff) {
				this.setCpuAnim('dribble', now);
				// A dribble move to get past you, or a pull-up over you.
				if (Math.random() < this.level.style.moves) {
					const move: AnimName = Math.random() < 0.75 ? this.level.style.move : this.level.style.move == 'spin' ? 'crossover' : 'spin';
					this.setCpuAnim(move, now, true);
					if (move == 'spin') this.court.spin('cpu');
					// His handles against your defense: better defense, fewer ankles broken.
					const tight = this.cpu.z - this.you.z < 1.0 ? 0.08 : 0;
					if (Math.random() < 0.3 + this.cs.dribbling * 0.0045 + tight - this.stats.defense * 0.006) {
						this.beatenUntil = now + 1300;
						p.lane = -p.lane || (Math.random() < 0.5 ? 2.4 : -2.4);
						// You get knocked back (you're moving yourself, but the court shoves your spot).
						const dx = this.you.x - this.cpu.x;
						const dz = this.you.z - this.cpu.z;
						const dd = Math.hypot(dx, dz) || 1;
						this.you.x = clamp(this.you.x + (dx / dd) * 1.2 + (Math.random() < 0.5 ? 1 : -1) * 1.1, -11.5, 11.5);
						this.you.z = clamp(this.you.z + (dz / dd) * 1.2, -13, 9.5);
						this.anchor.x = this.lastMotion ? this.lastMotion.x - (CHECK.x - this.you.x) / 2.6 : this.anchor.x;
						this.talk('theyBreakYou');
						this.say(now, move == 'crossover' ? 'Got crossed!' : 'Spun past you!', 'Recover!', '#f87171', { kind: 'bad' });
						this.sfx('ooh');
					} else {
						this.say(now, 'Locked up!', 'He had to pull up', '#34d399');
						this.sfx('squeak');
						this.startCpuShot(now + 200, 'shoot');
					}
				}
				return;
			}
			if (td < 0.6 || toHoop(this.cpu) < 2.4) return this.startCpuShot(now, 'layup');
			const v = (3.9 + this.cs.speed * 0.03) / 60;
			this.cpu.x += (tx / td) * Math.min(td, v);
			this.cpu.z += (tz / td) * Math.min(td, v);
			this.setCpuAnim('dribble', now);
			if (now > p.until) this.startCpuShot(now, toHoop(this.cpu) < 3 ? 'layup' : 'shoot');
		}
		void events;
	}

	private startCpuShot(now: number, kind: 'shoot' | 'layup') {
		// Dunkers throw it down at the rim.
		const k2: 'shoot' | 'layup' | 'dunk' = kind == 'layup' && toHoop(this.cpu) < 2.8 && (this.level.style.dunk || this.cs.finishing >= UNLOCK_AT) ? 'dunk' : kind;
		this.startCpuShotAs(now, k2);
	}
	private startCpuShotAs(now: number, kind: 'shoot' | 'layup' | 'dunk') {
		const dur = DURATION[kind]!;
		this.cpuShot = { start: now, release: now + dur * RELEASE_AT[kind], kind, resolved: false };
		this.setCpuAnim(kind, now, true);
		this.phase = 'flight';
	}

	/** After the computer's release (and your chance to jump with it): blocked, made or missed. */
	private resolveCpuShot(now: number) {
		const s = this.cpuShot!;
		const window = 80 + this.stats.blocking * 1.6;
		if (now < s.release + window) {
			this.court.ball('hold', 'cpu');
			return;
		}
		s.resolved = true;
		const near = dist(this.you, this.cpu);
		const beaten = now < this.beatenUntil;
		const inFront = !beaten && Math.abs(this.you.x - this.cpu.x) < 1.6 && this.you.z < this.cpu.z + 0.5;
		const timed = Math.abs(this.lastJump - s.release) < window;
		const blocked = inFront && timed && near < 2.4 && Math.random() < (0.25 + this.stats.blocking * 0.006) * (s.kind == 'dunk' ? 0.45 : 1);
		// Only a close defender bothers the shot (better defenders bother it more).
		const contest = inFront ? clamp(1 - (near - 1) / 1.8, 0, 1) * (timed ? 1 : 0.6) * (0.75 + this.stats.defense * 0.004) : 0;
		const d = toHoop(this.cpu);
		const base = s.kind == 'dunk' ? 0.85 : s.kind == 'layup' ? 0.6 : { close: 0.55, mid: 0.42, three: 0.3, deep: 0.12 }[zoneOf(d)];
		const rating = shotRating(this.cs, s.kind == 'shoot' ? 'jumpshot' : 'layup', d);
		const made = !blocked && Math.random() < (base + rating * 0.003) * (1 - 0.55 * Math.min(1, contest));
		const pts = pointsFrom(this.cpu);
		if (blocked) {
			this.track('blocks');
			this.talk('youBlock');
			this.say(now, 'BLOCKED!', 'Get outta here!', '#34d399', { kind: 'block' });
			this.sfx('block');
		} else if (contest > 0.4) this.say(now, 'Contested', undefined, '#cbd5e1', { kind: 'info' });
		else if (!inFront || near > 3) this.say(now, 'Wide open!', 'Close out on him', '#f87171', { kind: 'bad' });
		if (s.kind == 'dunk' && !blocked) this.sfx('ooh');
		void this.court.shoot(made, blocked, s.kind == 'dunk').then(() => this.result(performance.now(), 'cpu', made, blocked, pts, s.kind == 'dunk'));
	}

	// ── After a shot ──
	private result(now: number, shooter: Side, made: boolean, blocked: boolean, pts: number, dunk = false) {
		if (made) {
			this.score[shooter] += pts;
			this.maxDown = Math.max(this.maxDown, this.score.cpu - this.score.you);
			if (shooter == 'you') {
				this.track('makes');
				if (pts == 2) this.track('twos');
				if (dunk) this.track('dunks');
				if (zoneOf(toHoop(this.you)) == 'deep') this.track('deeps');
			}
			this.sfx(pts == 2 ? 'swish2' : 'swish');
			this.talk(shooter == 'you' ? 'youScore' : 'theyScore');
			if (dunk) this.court.cheer();
			this.say(now, shooter == 'you' ? (dunk ? '+1 POSTERIZED!' : pts == 2 ? '+2 SPLASH!' : '+1 Bucket') : `${this.level.name} +${pts}${dunk ? ' (slam)' : ''}`, `${this.score.you} – ${this.score.cpu}`, shooter == 'you' ? '#22c55e' : '#f87171', { kind: shooter == 'you' ? 'make' : 'bad' });
		} else if (!blocked) {
			this.sfx('rim');
			this.say(now, shooter == 'you' ? 'Rimmed out' : 'Off the rim', `${this.score.you} – ${this.score.cpu}`, '#cbd5e1', { kind: 'miss' });
		} else if (shooter == 'you') {
			this.sfx('block');
			this.talk('theyBlock');
			this.say(now, 'Swatted!', 'Turnover', '#f87171', { kind: 'block' });
		}
		if (this.score[shooter] >= TO) {
			this.phase = 'over';
			this.winner = shooter;
			this.phaseAt = now;
			this.court.ball('hidden');
			this.sfx(shooter == 'you' ? 'win' : 'lose');
			this.say(now, shooter == 'you' ? 'GAME!' : 'CPU wins', `${this.score.you} – ${this.score.cpu}`, shooter == 'you' ? '#facc15' : '#f87171');
			this.onEnd(shooter, { ...this.score }, this.maxDown);
			return;
		}
		// The other player's ball (after a make, a miss or a block).
		this.ball = shooter == 'you' ? 'cpu' : 'you';
		if (this.lastMotion) this.check(now + 600, this.lastMotion);
	}

	private change(now: number, m: MotionState) {
		this.ball = this.ball == 'you' ? 'cpu' : 'you';
		this.check(now, m);
	}

	private setCpuAnim(name: AnimName, now: number, restart = false) {
		if (restart || this.cpuAnim.name != name) {
			// One-off animations play through before a loop takes over.
			const cur = this.cpuAnim;
			const busy = DURATION[cur.name] && now - cur.since < DURATION[cur.name]! && !restart;
			if (!busy) this.cpuAnim = { name, since: now };
		}
	}

	private draw(now: number, youJ: Joints | null) {
		const offense = this.ball == 'you';
		// The computer faces the hoop with the ball, you without it (and the other way round).
		// The ball handler faces the hoop; the defender keeps turning to face the ball handler.
		const rim = { x: HOOP.x, z: HOOP.z };
		const youFacing = offense ? rim : { ...this.cpu };
		const cpuFacing = offense ? { ...this.you } : rim;
		let j = youJ;
		if (this.phase == 'over') j = animate(this.winner == 'you' ? 'celebrate' : 'sad', now - this.phaseAt);
		if (this.phase == 'over') this.setCpuAnim(this.winner == 'cpu' ? 'celebrate' : 'sad', now);
		this.court.setYou(j, this.you.x, this.you.z, youFacing);
		this.court.setCpu(this.cpu.x, this.cpu.z, cpuFacing, this.cpuAnim.name, this.cpuAnim.since);
		void this.youAnim;
	}
}
