// Check-up online: 1-on-1 against another player, over a room code (like Fishy's online mode). The
// room's host (seat 0) runs the game; the guest sends its body as a few numbers ~15 times a second
// (lean, dribbling hand, side steps, jumps and joint angles: never video) plus its moves and shots
// (judged on the guest's own device against its own templates), and the host sends back where
// everyone is, the score, and the 24-second shot clock. The host reports the result for the ratings.
import type { Room } from '../net';
import { CHECK, HOOP, ARC, type Court, type Look } from './court';
import type { Joints } from './anim';
import type { MotionEvent, MotionState } from './motion';
import { judge, shotRating, zoneOf, UNLOCK_AT, type ShotKind, type ShotTemplate } from './shot';
import { leanMove, START_STATS, stepBackTo, TO, type Flash, type Stats } from './game';

export const SHOT_CLOCK_MS = 24_000;
const CHECK_MS = 2600;
/** When the check pass goes (ms into the check). */
const CHECK_PASS_AT = 950;

export interface PlayerInfo {
	name: string;
	look: Look;
	stats: Stats;
}
/** One player's controls this moment. */
interface Input {
	lean: number;
	hand: 'left' | 'right' | null;
	x: number;
	setting: boolean;
	j: number[] | null;
	/** Running in place (0..1) and pounding the dribble. */
	run?: number;
	drib?: boolean;
}
type Seat = 0 | 1;

const JOINT_KEYS: (keyof Joints)[] = ['lu', 'll', 'ru', 'rl', 'lt', 'ls', 'rt', 'rs', 'y', 'lean'];
const packJ = (j: Joints | null) => (j ? JOINT_KEYS.map((k) => Math.round(j[k] * 100)) : null);
const unpackJ = (q: number[] | null): Joints | null => (q ? (Object.fromEntries(JOINT_KEYS.map((k, i) => [k, q[i] / 100])) as unknown as Joints) : null);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const toHoop = (p: { x: number; z: number }) => Math.hypot(p.x - HOOP.x, p.z - HOOP.z);

/** What both screens show (sent by the host). */
export interface MultiView {
	score: [number, number];
	ball: Seat;
	phase: 'wait' | 'check' | 'live' | 'flight' | 'over';
	clock: number;
	flash: Flash | null;
	winner: Seat | null;
}

export class Multi {
	view: MultiView = { score: [0, 0], ball: 0, phase: 'wait', clock: SHOT_CLOCK_MS, flash: null, winner: null };
	other: PlayerInfo | null = null;
	private pos = [{ x: CHECK.x, z: CHECK.z }, { x: CHECK.x, z: CHECK.z - 2.2 }];
	private inputs: [Input, Input] = [
		{ lean: 0, hand: null, x: 0, setting: false, j: null },
		{ lean: 0, hand: null, x: 0, setting: false, j: null }
	];
	private otherJ: Joints | null = null;
	private lastSend = 0;
	private sentHi = false;
	// Host-only game state.
	private phaseAt = 0;
	private clockAt = 0;
	private anchor = [0, 0];
	private stumble = [0, 0];
	private bit = [0, 0];
	private lastJump = [-9999, -9999];
	private fakeAt = [-9999, -9999];
	private pending: { seat: Seat; chance: number; at: number; kind: ShotKind; dunk: boolean } | null = null;
	private ended = false;
	private hostFlashAt = 0;
	// The check pass (on each screen).
	private lastPhase = '';
	private checkAt = 0;
	private checkPassed = true;
	/** The hand with the ball, per player (crossovers swap it). */
	hands: ['left' | 'right', 'left' | 'right'] = ['right', 'right'];
	private burst: { seat: Seat; from: { x: number; z: number }; to: { x: number; z: number }; at: number } | null = null;
	/** Per player: attacking off the dribble, sprinting on defense, reached for the ball and missed. */
	private drive = [0, 0];
	private sprint = [0, 0];
	private reach = [0, 0];

	constructor(
		private court: Court,
		readonly seat: Seat,
		private room: Room,
		private me: PlayerInfo,
		private templates: Partial<Record<ShotKind, ShotTemplate>>,
		private sfx: (name: string) => void,
		private onEnd: (winner: Seat, score: [number, number]) => void,
		/** Achievement counters for this player. */
		private track: (k: 'makes' | 'twos' | 'shakes' | 'blocks' | 'perfects' | 'bites' | 'dunks' | 'deeps' | 'floors') => void
	) {}

	get host() {
		return this.seat == 0;
	}
	private send(msg: object) {
		void this.room.send({ type: 'relay', msg });
	}

	/** A message from the other player (via the room). */
	onRelay(msg: Record<string, unknown>) {
		const k = msg.k;
		if (k == 'hi') {
			this.other = msg.info as PlayerInfo;
			this.court.setCpuLook(this.other.look);
			if (!this.sentHi) this.hello();
			if (this.host && this.view.phase == 'wait') this.startGame(performance.now());
		} else if (k == 'in' && this.host) {
			this.inputs[1] = { lean: +(msg.lean as number) || 0, hand: (msg.hand as Input['hand']) ?? null, x: +(msg.x as number) || 0, setting: !!msg.set, j: (msg.j as number[]) ?? null, run: clamp(+(msg.run as number) || 0, 0, 1), drib: !!msg.drib };
			this.otherJ = unpackJ(this.inputs[1].j);
		} else if (k == 'ev' && this.host) {
			this.hostEvent(1, msg as unknown as MotionEvent, performance.now());
		} else if (k == 'shot' && this.host) {
			this.hostShot(1, msg.kind as ShotKind, clamp(+(msg.chance as number) || 0, 0, 0.97), performance.now(), !!msg.dunk);
		} else if (k == 'st' && !this.host) {
			const p = msg.p as number[][];
			this.pos = [{ x: p[0][0], z: p[0][1] }, { x: p[1][0], z: p[1][1] }];
			this.otherJ = unpackJ(msg.j as number[] | null);
			if (Array.isArray(msg.hands)) this.hands = msg.hands as Multi['hands'];
			this.inputs[0].setting = !!msg.set0;
			this.inputs[1].setting = !!msg.set1;
			const v = msg.v as MultiView;
			// A new message from the host: show it from now (our clocks differ).
			if (v.flash && v.flash.at != this.hostFlashAt) {
				this.hostFlashAt = v.flash.at;
				v.flash = { ...v.flash, at: performance.now() };
			} else v.flash = this.view.flash;
			if (v.ball != this.view.ball || v.phase == 'check') this.court.camera(v.ball == this.seat ? 'offense' : 'defense');
			this.view = v;
		} else if (k == 'fly' && !this.host) {
			this.fly(msg.seat as Seat, !!msg.made, !!msg.blocked, !!msg.dunk, !!msg.soft);
		} else if (k == 'crowd' && !this.host) {
			this.crowd(msg.seat as Seat, msg.mood as 'three' | 'make' | 'big');
		} else if (k == 'sfx' && !this.host) this.sfx(String(msg.name));
		else if (k == 'spin' && !this.host) this.court.spin(msg.seat == this.seat ? 'you' : 'cpu');
		else if (k == 'trk' && !this.host && ['makes', 'twos', 'shakes', 'blocks', 'bites', 'dunks', 'deeps', 'floors'].includes(msg.key as string)) this.track(msg.key as 'makes');
		else if (k == 'end' && !this.host && !this.ended) {
			this.ended = true;
			this.view = { ...this.view, phase: 'over', winner: msg.winner as Seat, score: msg.score as [number, number] };
			this.onEnd(msg.winner as Seat, msg.score as [number, number]);
		}
	}

	/** A rematch: a fresh game (the host deals it). */
	restart() {
		this.ended = false;
		this.view = { ...this.view, phase: 'wait', winner: null, score: [0, 0] };
		if (this.host) this.startGame(performance.now());
	}

	/** Introduce yourself (look and stats). */
	hello() {
		this.sentHi = true;
		this.send({ k: 'hi', info: this.me });
	}

	/** Every frame: your body, your events; the host also runs the game. */
	frame(now: number, m: MotionState, events: MotionEvent[], j: Joints | null) {
		const mine: Input = { lean: m.lean, hand: m.hand, x: m.x, setting: m.setting, j: packJ(j), run: m.run, drib: m.dribbling };
		if (this.host) {
			this.inputs[0] = mine;
			for (const e of events) {
				if (e.type == 'shot') {
					const r = judge(e.take, this.templates[e.take.kind] ?? null, shotRating(this.me.stats, e.take.kind, toHoop(this.pos[0])), toHoop(this.pos[0]));
					if (r.grade == 'perfect' && this.templates[e.take.kind]) this.track('perfects');
					const dunk = this.canDunk(e.take.kind, this.pos[0], m);
					this.hostShot(0, e.take.kind, dunk ? Math.min(0.97, r.chance + 0.3) : r.chance, now, dunk);
				} else this.hostEvent(0, e, now);
			}
			this.hostStep(now);
			if (now - this.lastSend > 80) {
				this.lastSend = now;
				const v = { ...this.view, flash: this.view.flash ? { ...this.view.flash } : null };
				this.send({ k: 'st', p: this.pos.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]), j: packJ(j), set0: m.setting, set1: this.inputs[1].setting, hands: this.hands, v });
			}
		} else {
			if (now - this.lastSend > 66) {
				this.lastSend = now;
				this.send({ k: 'in', lean: Math.round(m.lean * 100) / 100, hand: m.hand, x: Math.round(m.x * 100) / 100, set: m.setting, j: mine.j, run: Math.round(m.run * 100) / 100, drib: m.dribbling });
			}
			for (const e of events) {
				// (Jumps count while a shot is up too: that's when blocks happen.)
				if (this.view.phase != 'live' && !(this.view.phase == 'flight' && e.type == 'jump')) continue;
				if (e.type == 'shot') {
					const r = judge(e.take, this.templates[e.take.kind] ?? null, shotRating(this.me.stats, e.take.kind, toHoop(this.pos[1])), toHoop(this.pos[1]));
					if (r.grade == 'perfect' && this.templates[e.take.kind]) this.track('perfects');
					const dunk = this.canDunk(e.take.kind, this.pos[1], m);
					this.send({ k: 'shot', kind: e.take.kind, chance: Math.round((dunk ? Math.min(0.97, r.chance + 0.3) : r.chance) * 1000) / 1000, dunk });
				} else if (e.type == 'move' || e.type == 'pumpfake' || e.type == 'jump' || e.type == 'triple' || e.type == 'stepback' || e.type == 'swipe') this.send({ k: 'ev', ...e });
			}
		}
		this.draw(j);
	}

	private draw(j: Joints | null) {
		const me = this.pos[this.seat];
		const them = this.pos[1 - this.seat];
		const myBall = this.view.ball == this.seat;
		// The ball handler faces the hoop; the defender keeps turning to face the ball handler.
		const rim = { x: HOOP.x, z: HOOP.z };
		this.court.setYou(j, me.x, me.z, myBall ? rim : { ...them });
		this.court.setYouHand(this.hands[this.seat]);
		this.court.setOtherHand(this.hands[1 - this.seat]);
		if (this.otherJ) this.court.setOther(this.otherJ, them.x, them.z, myBall ? { ...me } : rim);
		else this.court.setCpu(them.x, them.z, myBall ? { ...me } : rim, 'stance', 0);
		// The check: the defender has the ball while both get set, then bounces it over.
		const now = performance.now();
		if (this.view.phase == 'check' && this.lastPhase != 'check') {
			this.checkAt = now;
			this.checkPassed = false;
		}
		this.lastPhase = this.view.phase;
		if (this.view.phase == 'check') {
			const offense = myBall ? 'you' : 'cpu';
			const defense = myBall ? 'cpu' : 'you';
			if (!this.checkPassed && now - this.checkAt > CHECK_PASS_AT) {
				this.checkPassed = true;
				this.court.checkPass(defense, offense);
			}
			this.court.ball('hold', this.checkPassed ? offense : defense);
		} else if (this.view.phase == 'live') {
			const holderSetting = this.inputs[this.view.ball].setting;
			this.court.ball(holderSetting ? 'hold' : 'dribble', myBall ? 'you' : 'cpu');
		}
	}

	// ── The host's game ──
	private startGame(now: number) {
		this.view = { score: [0, 0], ball: Math.random() < 0.5 ? 0 : 1, phase: 'check', clock: SHOT_CLOCK_MS, flash: null, winner: null };
		this.check(now);
	}
	private check(now: number) {
		const off = this.view.ball;
		this.view.phase = 'check';
		this.phaseAt = now;
		this.pending = null;
		this.stumble = [0, 0];
		this.bit = [0, 0];
		this.hands = ['right', 'right'];
		this.drive = [0, 0];
		this.sprint = [0, 0];
		this.reach = [0, 0];
		this.pos[off] = { x: CHECK.x, z: CHECK.z };
		this.pos[1 - off] = { x: CHECK.x, z: CHECK.z - 2.2 };
		this.say(now, off == 0 ? `${this.me.name}'s ball` : `${this.other?.name ?? 'Guest'}'s ball`, 'Check-up!', '#fbbf24');
		// (The check pass makes its own bounce.)
		this.court.camera(off == this.seat ? 'offense' : 'defense');
	}
	private say(now: number, text: string, sub: string | undefined, color: string, extra: Partial<Flash> = {}) {
		this.view.flash = { text, sub, color, at: now, ...extra };
	}
	private cue(name: string) {
		this.sfx(name);
		this.send({ k: 'sfx', name });
	}
	/** Counts toward a player's achievements (the guest's are counted on the guest's device). */
	private credit(s: Seat, key: 'makes' | 'twos' | 'shakes' | 'blocks' | 'bites' | 'dunks' | 'deeps' | 'floors') {
		if (s == this.seat) this.track(key);
		else this.send({ k: 'trk', key });
	}
	private nameOf(s: Seat) {
		return s == 0 ? this.me.name : (this.other?.name ?? 'Guest');
	}
	private statsOf(s: Seat): Stats {
		return s == 0 ? this.me.stats : { ...START_STATS, ...(this.other?.stats ?? {}) };
	}

	private hostStep(now: number) {
		const v = this.view;
		if (v.phase == 'check') {
			if (now - this.phaseAt > CHECK_MS) {
				v.phase = 'live';
				this.clockAt = now;
				this.anchor = [this.inputs[0].x, this.inputs[1].x];
				this.cue('whistle');
			}
			return;
		}
		if (v.phase == 'flight' && this.pending && now > this.pending.at) this.resolveShot(now);
		if (v.phase != 'live') return;
		v.clock = Math.max(0, SHOT_CLOCK_MS - (now - this.clockAt));
		const off = v.ball;
		const def = (1 - off) as Seat;
		// The ball handler leans to attack (toward the dribbling hand); the defender leans and slides.
		const so = this.statsOf(off);
		const sd = this.statsOf(def);
		const io = this.inputs[off];
		const pounding = !!io.drib && io.lean >= 0 && !io.setting;
		this.drive[off] += ((pounding ? 1 : 0) - this.drive[off]) * (pounding ? 0.05 : 0.1);
		this.drive[def] = 0;
		const drv = this.drive[off];
		const lean = drv > 0.05 ? Math.max(io.lean, 0.35 + drv * 0.65) : io.lean;
		let o = leanMove(this.pos[off], { ...(io as unknown as MotionState), lean, hand: this.hands[off] }, ((6 + so.speed * 0.05) / 60) * (1 + drv * 0.9), -1);
		const b = this.burst;
		if (b && b.seat == off && now - b.at < 300) {
			const k = 1 - (1 - (now - b.at) / 300) ** 2;
			o = { x: b.from.x + (b.to.x - b.from.x) * k, z: b.from.z + (b.to.z - b.from.z) * k };
		}
		this.pos[off] = { x: clamp(o.x, -11.5, 11.5), z: clamp(o.z, -13, 9.5) };
		this.sprint[def] += (((this.inputs[def].run ?? 0) > 0.3 ? (this.inputs[def].run ?? 0) : 0) - this.sprint[def]) * 0.2;
		if (this.sprint[def] > 0.25 && now > this.reach[def]) {
			const a = this.pos[off];
			const d = this.pos[def];
			const hx = HOOP.x - a.x;
			const hz = HOOP.z - a.z;
			const hd = Math.hypot(hx, hz) || 1;
			const sx = a.x + (hx / hd) * 1.5 - d.x;
			const sz = a.z + (hz / hd) * 1.5 - d.z;
			const s = Math.hypot(sx, sz);
			const vS = ((11 + sd.speed * 0.08) / 60) * this.sprint[def];
			if (s > 0.05) {
				d.x = clamp(d.x + (sx / s) * Math.min(s, vS), -11.5, 11.5);
				d.z = clamp(d.z + (sz / s) * Math.min(s, vS), -13, 9.5);
			}
			if (now < this.stumble[def] && s < 0.8) {
				this.stumble[def] = now;
				this.say(now, 'Recovered!', `${this.nameOf(def)} is back in front`, '#34d399', { kind: 'move' });
			}
			// Side steps carry on from here.
			this.anchor[def] = this.inputs[def].x - (CHECK.x - d.x) / 2.6;
		} else if (now > this.stumble[def] && now > this.reach[def]) {
			const vD = (6.5 + sd.speed * 0.045) / 60;
			const d = this.pos[def];
			const tx = CHECK.x - (this.inputs[def].x - this.anchor[def]) * 2.6;
			d.x = clamp(d.x + clamp(tx - d.x, -vD * 1.15, vD * 1.15), -11.5, 11.5);
			d.z = clamp(d.z + this.inputs[def].lean * vD, -13, 9.5);
			const a = this.pos[off];
			const near = Math.hypot(a.x - d.x, a.z - d.z);
			if (near < 3) {
				const hx = HOOP.x - a.x;
				const hz = HOOP.z - a.z;
				const hd = Math.hypot(hx, hz) || 1;
				const pull = 0.05 + sd.defense * 0.0008;
				d.x += (a.x + (hx / hd) * Math.min(near, 1.8) - d.x) * pull;
				d.z += (a.z + (hz / hd) * Math.min(near, 1.8) - d.z) * pull * 0.5;
			}
			// No walking through a defender who's square in front.
			if (Math.abs(a.x - d.x) < 0.85 && a.z < d.z + 1.0 && a.z > d.z - 0.4) a.z = d.z + 1.0;
		}
		if (v.clock <= 0) {
			this.say(now, 'Shot clock!', 'Turnover', '#f87171');
			this.cue('buzzer');
			v.ball = def;
			this.check(now);
		}
	}

	private hostEvent(seat: Seat, e: MotionEvent, now: number) {
		const v = this.view;
		if (v.phase != 'live') {
			if (e.type == 'jump') this.lastJump[seat] = now;
			return;
		}
		const off = v.ball;
		const def = (1 - off) as Seat;
		if (e.type == 'jump') {
			this.lastJump[seat] = now;
			// Jumping right after the ball handler's pump fake: bit on it.
			if (seat == def && now - this.fakeAt[off] < 650 && now > this.bit[def]) {
				this.bit[def] = now + 900;
				this.credit(off, 'bites');
				this.say(now, `${this.nameOf(def)} bit!`, 'Shoot or drive now', '#34d399');
				this.cue('ooh');
			}
		} else if (e.type == 'pumpfake' && seat == off) this.fakeAt[off] = now;
		else if (e.type == 'swipe' && seat == def) {
			const near = dist(this.pos[off], this.pos[def]);
			if (near > 2.4) return;
			const chance = clamp(0.16 + this.statsOf(def).defense * 0.0045 - this.statsOf(off).dribbling * 0.0028, 0.05, 0.45);
			if (Math.random() < chance) {
				this.say(now, 'STOLE IT!', `${this.nameOf(def)} picked ${this.nameOf(off)}'s pocket`, '#34d399', { kind: 'block' });
				this.cue('steal');
				this.crowdAll(def, 'big');
				this.view.ball = def;
				this.check(now + 400);
				return;
			}
			this.reach[def] = now + 650;
			this.stumble[def] = Math.max(this.stumble[def], now + 900);
			this.say(now, 'Reached!', `${this.nameOf(def)} is off balance`, '#f87171', { kind: 'bad' });
			this.cue('squeak');
		}
		else if (e.type == 'stepback' && seat == off) {
			this.burst = { seat: off, from: { ...this.pos[off] }, to: stepBackTo(this.pos[off]), at: now };
			this.say(now, 'Step-back', undefined, '#93c5fd', { kind: 'move' });
			this.cue('squeak');
		}
		else if (e.type == 'move' && seat == off) {
			if (e.move == 'crossover') {
				// The ball has to cross from the hand it's in to the other one, or it's lost.
				if (e.to == this.hands[off]) {
					this.say(now, 'Lost the handle!', `${this.nameOf(off)} crossed the wrong way`, '#f87171', { kind: 'bad' });
					this.cue('steal');
					this.view.ball = def;
					this.check(now);
					return;
				}
				this.hands[off] = this.hands[off] == 'right' ? 'left' : 'right';
			}
			if (e.move == 'spin') {
				this.court.spin(off == this.seat ? 'you' : 'cpu');
				this.send({ k: 'spin', seat: off });
			}
			const near = dist(this.pos[off], this.pos[def]);
			if (near > 2.8 || now < this.stumble[def]) return;
			if (Math.random() < 0.28 + this.statsOf(off).dribbling * 0.0065 - this.statsOf(def).defense * 0.0055) {
				const floor = Math.random() < 0.05 + this.statsOf(off).dribbling * 0.002 - this.statsOf(def).defense * 0.0015;
				this.stumble[def] = now + (floor ? 1900 : 1200);
				// The defender gets knocked back and to the side.
				const a = this.pos[off];
				const d = this.pos[def];
				const dd = Math.hypot(d.x - a.x, d.z - a.z) || 1;
				const push = floor ? 2.4 : 1.6;
				const side = Math.random() < 0.5 ? 1 : -1;
				this.pos[def] = { x: clamp(d.x + ((d.x - a.x) / dd) * push * 0.6 + side * push * 0.8, -11.5, 11.5), z: clamp(d.z + ((d.z - a.z) / dd) * push * 0.6, -13, 9.5) };
				this.anchor[def] += (side * push * 0.8) / 2.6;
				this.credit(off, 'shakes');
				if (floor) this.credit(off, 'floors');
				this.say(now, floor ? 'ANKLES!' : 'Shook him!', floor ? `${this.nameOf(def)} hit the floor` : `${this.nameOf(off)} got by`, '#facc15', { kind: 'move' });
				this.cue('ooh');
			} else {
				this.say(now, 'Stayed in front', undefined, '#cbd5e1');
				this.cue('squeak');
			}
		}
	}

	private hostShot(seat: Seat, kind: ShotKind, chance: number, now: number, dunk = false) {
		const v = this.view;
		if (v.phase != 'live' || seat != v.ball) return;
		v.phase = 'flight';
		// Wait a moment for the defender's jump (block timing), then decide.
		const window = 80 + this.statsOf((1 - seat) as Seat).blocking * 1.6;
		this.pending = { seat, chance, at: now + window, kind, dunk };
		const d = toHoop(this.pos[seat]);
		this.say(now, kind == 'layup' ? 'Layup' : d > ARC ? 'From deep…' : zoneOf(d) == 'close' ? 'Short jumper' : 'Jumper', undefined, '#e2e8f0');
		if (d > ARC && kind == 'jumpshot') this.crowdAll(seat, 'three');
	}

	private resolveShot(now: number) {
		const p = this.pending!;
		this.pending = null;
		const off = p.seat;
		const def = (1 - off) as Seat;
		const near = dist(this.pos[off], this.pos[def]);
		const open = now < this.stumble[def] || now < this.bit[def];
		const contest = open ? 0 : clamp(1 - (near - 1) / 2.2, 0, 1);
		const window = 80 + this.statsOf(def).blocking * 1.6;
		const timed = Math.abs(this.lastJump[def] - (p.at - window)) < window;
		const blocked = !open && timed && near < 2.4 && Math.random() < (0.25 + this.statsOf(def).blocking * 0.006) * (p.dunk ? 0.45 : 1);
		const made = !blocked && Math.random() < p.chance * (1 - (p.dunk ? 0.2 : 0.5) * contest * (timed ? 1 : 0.6) * (0.75 + this.statsOf(def).defense * 0.004));
		const pts = toHoop(this.pos[off]) > ARC ? 2 : 1;
		if (blocked) this.credit(def, 'blocks');
		if (made) {
			this.credit(off, 'makes');
			if (pts == 2) this.credit(off, 'twos');
			if (p.dunk) this.credit(off, 'dunks');
			if (zoneOf(toHoop(this.pos[off])) == 'deep') this.credit(off, 'deeps');
		}
		const soft = p.kind == 'layup';
		this.send({ k: 'fly', seat: off, made, blocked, dunk: p.dunk, soft });
		this.fly(off, made, blocked, p.dunk, soft).then(() => {
			const v = this.view;
			if (made) {
				v.score[off] += pts;
				this.cue(pts == 2 ? 'swish2' : 'swish');
				this.crowdAll(off, pts == 2 || p.dunk ? 'big' : 'make');
				this.say(performance.now(), `${this.nameOf(off)} +${pts}`, `${v.score[0]} – ${v.score[1]}`, off == 0 ? '#22c55e' : '#f87171');
			} else if (blocked) {
				this.cue('block');
				this.crowdAll(def, 'big');
				this.say(performance.now(), 'BLOCKED!', `by ${this.nameOf(def)}`, '#34d399');
			} else {
				this.cue('rim');
				this.say(performance.now(), 'Off the rim', `${v.score[0]} – ${v.score[1]}`, '#cbd5e1');
			}
			if (v.score[off] >= TO) {
				v.phase = 'over';
				v.winner = off;
				this.ended = true;
				this.send({ k: 'st', p: this.pos.map((q) => [q.x, q.z]), j: null, v });
				this.send({ k: 'end', winner: off, score: v.score });
				this.onEnd(off, [...v.score] as [number, number]);
				return;
			}
			// Make it, take it: the scorer keeps the ball.
			v.ball = made ? off : def;
			this.check(performance.now());
		});
	}

	/** Finishing 70+: a layup at the rim while jumping is a dunk. */
	private canDunk(kind: ShotKind, at: { x: number; z: number }, m: MotionState) {
		void m;
		return kind == 'layup' && this.me.stats.finishing >= UNLOCK_AT && toHoop(at) < 2.8;
	}
	private fly(seat: Seat, made: boolean, blocked: boolean, dunk = false, soft = false) {
		this.court.ball('hold', seat == this.seat ? 'you' : 'cpu');
		return this.court.shoot(made, blocked, dunk, soft);
	}
	/** The crowd, on both screens. */
	private crowdAll(seat: Seat, mood: 'three' | 'make' | 'big') {
		this.crowd(seat, mood);
		this.send({ k: 'crowd', seat, mood });
	}
	/** The crowd is on your side: it roars for your big plays and groans at theirs. */
	private crowd(seat: Seat, mood: 'three' | 'make' | 'big') {
		if (mood == 'three') {
			this.court.react('three');
			this.sfx('threeUp');
		} else if (seat == this.seat) {
			this.court.react(mood == 'big' ? 'roar' : 'cheer');
			this.sfx(mood == 'big' ? 'roar' : 'cheer');
			if (mood == 'big') this.court.shake(0.35);
		} else {
			this.court.react('groan');
			this.sfx('groan');
		}
	}
}
