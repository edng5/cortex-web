// SpeakEase's game layer: XP (and a player level with a title), badges, combos, scenario stars,
// and the little celebrations (+XP pops, confetti). Everything but the friend chats is a game: those
// stay plain conversations (they still count toward today's goals, celebrated back on the home
// screen). Kept in this browser, like the rest of the player's progress.
import { SCENARIOS } from './data';

const KEY = 'speakease:game';
const TRAVEL = SCENARIOS.filter((s) => s.group === 'Travel').map((s) => s.id);

export interface Badge {
	id: string;
	name: string;
	about: string;
	/** A short symbol for the medal. */
	mark: string;
	color: string;
}

export const BADGES: Badge[] = [
	{ id: 'first-steps', name: 'First Steps', about: 'Learn your first phrase in Phrase Quest.', mark: '1', color: '#38bdf8' },
	{ id: 'phrase-10', name: 'Phrase Collector', about: 'Learn 10 phrases.', mark: '10', color: '#a78bfa' },
	{ id: 'phrase-50', name: 'Phrasebook', about: 'Learn 50 phrases.', mark: '50', color: '#7c3aed' },
	{ id: 'globetrotter', name: 'Globetrotter', about: 'Learn phrases in 3 languages.', mark: '3', color: '#22c55e' },
	{ id: 'polyglot', name: 'Polyglot', about: 'Learn phrases in 6 languages.', mark: '6', color: '#16a34a' },
	{ id: 'climber', name: 'Climber', about: 'Reach level 3 in Phrase Quest.', mark: 'L3', color: '#6366f1' },
	{ id: 'perfect', name: 'Perfect Pitch', about: 'Score 100 on a phrase.', mark: '100', color: '#ec4899' },
	{ id: 'on-a-roll', name: 'On a Roll', about: 'Get 5 phrases right first try in a row.', mark: 'x5', color: '#f97316' },
	{ id: 'scene-1', name: 'Curtain Up', about: 'Finish a scenario.', mark: '★', color: '#f59e0b' },
	{ id: 'full-cast', name: 'Full Cast', about: 'Finish 6 different scenarios.', mark: '6★', color: '#d97706' },
	{ id: 'globetrotter-trip', name: 'Ready to Travel', about: 'Finish every travel scenario.', mark: '✈', color: '#0284c7' },
	{ id: 'word-seeker', name: 'Word Seeker', about: 'Look up 25 words in the dictionary.', mark: 'Aa', color: '#14b8a6' },
	{ id: 'goal-getter', name: 'Goal Getter', about: "Finish all of a day's goals.", mark: 'G', color: '#10b981' },
	{ id: 'streak-3', name: 'Warming Up', about: 'Practise 3 days in a row.', mark: '3d', color: '#fb923c' },
	{ id: 'streak-7', name: 'On Fire', about: 'Practise 7 days in a row.', mark: '7d', color: '#ef4444' },
	{ id: 'streak-30', name: 'Unstoppable', about: 'Practise 30 days in a row.', mark: '30d', color: '#b91c1c' }
];

/** Scenario stars: 1 for finishing it once, 2 at 3 times, 3 at 5 times. */
export const starsFor = (wins: number) => (wins >= 5 ? 3 : wins >= 3 ? 2 : wins >= 1 ? 1 : 0);

/** Energy: practice in the games costs it, and it fills back up the next day (friend chats are free). */
export const ENERGY_MAX = 20;
/** A phrase attempt or a scenario line. */
export const ENERGY_COST = 1;

/** The local date (YYYY-MM-DD): energy refills when it changes. */
const dayOf = (t: number) => {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** A countdown as h:mm:ss (or m:ss under an hour). */
export const countdown = (ms: number) => {
	const s = Math.max(0, Math.ceil(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** XP to go from level n to n + 1. */
const stepFor = (n: number) => 100 + (n - 1) * 50;
const TITLES: [number, string][] = [
	[12, 'Legend'],
	[8, 'Polyglot'],
	[5, 'Conversationalist'],
	[3, 'Explorer'],
	[1, 'Beginner']
];

interface Saved {
	xp: number;
	/** Badge id → when it was won (ms). */
	badges: Record<string, number>;
	/** Phrases learned in each language. */
	phraseLangs: Record<string, number>;
	phrases: number;
	bestCombo: number;
	/** Scenario id → times finished. */
	scenes: Record<string, number>;
	/** Energy left on `energyDay` (a new day starts full). */
	energy: number;
	energyDay: string;
	/** Words looked up in the dictionary. */
	lookups: number;
}
const blank = (): Saved => ({ xp: 0, badges: {}, phraseLangs: {}, phrases: 0, bestCombo: 0, scenes: {}, energy: ENERGY_MAX, energyDay: '', lookups: 0 });

class Game {
	saved = $state<Saved>(blank());
	/** Floating "+20 XP" pops, newest last. */
	pops = $state<{ id: number; text: string }[]>([]);
	/** Changes to start a confetti burst. */
	confetti = $state(0);
	/** A badge just won (shown in a banner). */
	won = $state<Badge | null>(null);
	/** First-try passes in a row in Phrase Quest. */
	combo = $state(0);
	/** In a friend chat: no pops, confetti or banners (XP still counts, shown back home). */
	quiet = false;
	/** Pops and a celebration held back while quiet, for the home screen. */
	private held: string[] = [];
	private heldParty = false;
	/** Ticks so the next day's refill (and its countdown) shows up. */
	now = $state(Date.now());
	/** Members (the site's member list): Phrase Quest costs them no energy. */
	unlimited = $state(false);
	private popId = 0;
	private wonTimer: ReturnType<typeof setTimeout> | undefined;

	init() {
		try {
			this.saved = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
		} catch {
			this.saved = blank();
		}
	}
	private save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.saved));
		} catch {
			/* storage full or blocked */
		}
	}

	// ── Energy ──────────────────────────────────────────────────────────────────────
	/** Energy right now: what's left today, or full on a new day. */
	get energy(): number {
		const s = this.saved;
		return s.energyDay === dayOf(this.now) ? Math.min(ENERGY_MAX, s.energy) : ENERGY_MAX;
	}
	/** Until it fills back up at midnight (ms), or 0 when full. */
	get nextEnergyIn(): number {
		if (this.energy >= ENERGY_MAX) return 0;
		const midnight = new Date(this.now);
		midnight.setHours(24, 0, 0, 0);
		return midnight.getTime() - this.now;
	}
	/** A new day: back to full. */
	private settle() {
		const s = this.saved;
		this.now = Date.now();
		const day = dayOf(this.now);
		if (s.energyDay !== day) {
			s.energy = ENERGY_MAX;
			s.energyDay = day;
		}
	}
	/** Spend energy; false (and nothing spent) if there isn't enough. */
	spend(n = ENERGY_COST): boolean {
		this.settle();
		if (this.saved.energy < n) return false;
		this.saved.energy -= n;
		this.save();
		return true;
	}
	refill(n = ENERGY_MAX, label = '') {
		this.settle();
		const before = this.saved.energy;
		this.saved.energy = Math.min(ENERGY_MAX, this.saved.energy + n);
		this.save();
		if (this.saved.energy > before) this.pop(`+${this.saved.energy - before} energy${label ? ` · ${label}` : ''}`);
	}
	tick() {
		this.now = Date.now();
	}

	/** The player's level, how far into it they are, and their title. */
	get rank() {
		let level = 1;
		let left = this.saved.xp;
		while (left >= stepFor(level)) left -= stepFor(level++);
		return { level, into: left, step: stepFor(level), title: TITLES.find(([min]) => level >= min)![1] };
	}
	get badgeCount() {
		return Object.keys(this.saved.badges).length;
	}

	/** Give XP (with a floating "+n XP"); a new player level is celebrated. */
	award(xp: number, label = '') {
		if (xp <= 0) return;
		const before = this.rank.level;
		this.saved.xp += xp;
		this.save();
		this.pop(`+${xp} XP${label ? ` · ${label}` : ''}`);
		if (this.rank.level > before) {
			this.pop(`Level ${this.rank.level}! ${this.rank.title}`);
			this.celebrate();
		}
	}

	pop(text: string) {
		if (this.quiet) {
			this.held.push(text);
			return;
		}
		const id = ++this.popId;
		this.pops.push({ id, text });
		setTimeout(() => (this.pops = this.pops.filter((p) => p.id !== id)), 1800);
	}

	celebrate() {
		if (this.quiet) this.heldParty = true;
		else this.confetti++;
	}

	/** Back from a friend chat: show what was earned there. */
	release() {
		this.quiet = false;
		const held = this.held;
		this.held = [];
		held.forEach((t, i) => setTimeout(() => this.pop(t), i * 350));
		if (this.heldParty) {
			this.heldParty = false;
			this.celebrate();
		}
	}

	unlock(id: string) {
		if (this.saved.badges[id]) return;
		const badge = BADGES.find((b) => b.id === id);
		if (!badge) return;
		this.saved.badges[id] = Date.now();
		this.save();
		if (!this.quiet) this.won = badge;
		this.celebrate();
		clearTimeout(this.wonTimer);
		this.wonTimer = setTimeout(() => (this.won = null), 3800);
	}

	// ── What earns what ────────────────────────────────────────────────────────────
	/** A word looked up in the dictionary (new to this visit). */
	lookedUp() {
		this.saved.lookups++;
		this.save();
		this.award(5, 'New word');
		if (this.saved.lookups >= 25) this.unlock('word-seeker');
	}

	/** A line said in a scenario. */
	sceneLine() {
		this.award(10);
	}

	/** A scenario played through to the end: bonus XP, a star, maybe a badge. */
	sceneDone(id: string, name: string) {
		const s = this.saved;
		const before = starsFor(s.scenes[id] ?? 0);
		s.scenes[id] = (s.scenes[id] ?? 0) + 1;
		this.save();
		this.award(40, `${name} complete`);
		if (starsFor(s.scenes[id]) > before) this.pop(`${'★'.repeat(starsFor(s.scenes[id]))} ${name}`);
		this.unlock('scene-1');
		if (Object.keys(s.scenes).length >= 6) this.unlock('full-cast');
		if (TRAVEL.every((t) => s.scenes[t])) this.unlock('globetrotter-trip');
		this.celebrate();
	}

	/** A phrase passed in Phrase Quest. Returns the XP it earned (for the result card). */
	phrasePassed(opts: { firstTry: boolean; score: number; review: boolean; level: number; locale: string }): number {
		const s = this.saved;
		this.combo = opts.firstTry ? this.combo + 1 : 0;
		s.bestCombo = Math.max(s.bestCombo, this.combo);
		let xp = opts.review ? 10 : 20;
		if (opts.firstTry) xp += 5;
		if (opts.score >= 95) xp += 5;
		if (this.combo >= 2) xp += Math.min(25, 5 * (this.combo - 1));
		if (!opts.review) {
			s.phrases++;
			s.phraseLangs[opts.locale] = (s.phraseLangs[opts.locale] ?? 0) + 1;
		}
		this.award(xp, this.combo >= 2 ? `Combo x${this.combo}` : '');
		this.unlock('first-steps');
		if (Object.keys(s.phraseLangs).length >= 3) this.unlock('globetrotter');
		if (Object.keys(s.phraseLangs).length >= 6) this.unlock('polyglot');
		if (opts.score >= 100) this.unlock('perfect');
		if (this.combo >= 5) this.unlock('on-a-roll');
		if (s.phrases >= 10) this.unlock('phrase-10');
		if (s.phrases >= 50) this.unlock('phrase-50');
		if (opts.level >= 3) this.unlock('climber');
		this.save();
		return xp;
	}

	/** Out of tries on a phrase: the combo ends. */
	phraseMissed() {
		this.combo = 0;
	}

	phraseLevelUp(level: number) {
		this.award(50, `Phrase level ${level}`);
		this.refill(ENERGY_MAX, 'Level up');
		if (level >= 3) this.unlock('climber');
		this.celebrate();
	}

	/** First practice of the day: XP, and streak badges. */
	newDay(streak: number) {
		this.award(15, `Day ${streak} streak`);
		if (streak >= 3) this.unlock('streak-3');
		if (streak >= 7) this.unlock('streak-7');
		if (streak >= 30) this.unlock('streak-30');
	}

	goalDone(text: string) {
		this.award(30, 'Goal done');
		this.refill(5, 'Goal done');
		this.pop(`✓ ${text}`);
	}

	allGoalsDone() {
		this.award(50, 'All goals done');
		this.unlock('goal-getter');
		this.celebrate();
	}
}

export const game = new Game();
