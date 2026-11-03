// Phrase Quest: learn phrases in a language by saying them. Easy greetings first; pass perLevel()
// phrases to level up (more at each level), and each level brings harder ones. After a level-up, a few phrases from
// earlier levels come back for review. A phrase you don't get gives you 2 more tries, then moves
// on and comes back a few phrases later. Progress is kept per language (never purged).
import { app, load, newId, post, store } from './app.svelte';
import { FRIENDS } from './data';
import { game } from './game.svelte';

export interface Card {
	id: string;
	text: string;
	romanization: string;
	sounds: string;
	ipa: string;
	meaning: string;
	tips: { word: string; soundsLike: string; how: string }[];
	level: number;
	/** Back from an earlier level, to check it stuck. */
	review?: boolean;
	/** Its opposite (yes → no), to learn as well when asked. */
	opposite?: Omit<Card, 'id' | 'level' | 'review' | 'opposite' | 'oppositeOf' | 'oppositeQueued'>;
	/** This card is the opposite of that phrase. */
	oppositeOf?: string;
	/** Its opposite has been added to the queue. */
	oppositeQueued?: boolean;
}

interface Progress {
	level: number;
	/** New phrases passed at this level. */
	passed: number;
	learned: Card[];
	queue: Card[];
}

export interface Result {
	heard: string;
	words: { w: string; s: number }[];
	score: number;
	pass: boolean;
	/** XP it earned (passed). */
	xp: number;
}

/** New phrases to pass to finish a level: 8 at level 1, two more each level after, up to 20. */
export const perLevel = (level: number) => Math.min(20, 8 + 2 * (Math.max(1, level) - 1));
/** Tries per phrase before moving on (the first go and 2 retries). */
export const TRIES = 3;
const REVIEWS = 3;
/** A phrase you couldn't get comes back after this many others. */
const COME_BACK_AFTER = 3;

/** Passed: a good average, and no word badly wrong. */
const passes = (r: { words: { s: number }[]; score: number }) => r.words.length > 0 && r.score >= 80 && Math.min(...r.words.map((w) => w.s)) >= 55;

const blank = (): Progress => ({ level: 1, passed: 0, learned: [], queue: [] });

class PhraseQuest {
	locale = $state(load<string>('phrases-lang', 'en-US'));
	progress = $state<Progress>(blank());
	loading = $state(false);
	checking = $state(false);
	/** The last try at the current phrase. */
	result = $state<Result | null>(null);
	/** Tries used on the current phrase. */
	tries = $state(0);
	/** Just levelled up: shows the celebration (the new level). */
	levelUp = $state<number | null>(null);
	error = $state<string | null>(null);
	/** A language has been opened (its progress is loaded). */
	private opened = $state(false);

	get tutor() {
		return FRIENDS.find((f) => f.locale === this.locale) ?? FRIENDS[0];
	}
	get card(): Card | null {
		return this.progress.queue[0] ?? null;
	}
	/** Retries left on the current phrase. */
	get retriesLeft() {
		return Math.max(0, TRIES - this.tries);
	}

	/** A language's level (the open one's as it stands, others as saved). */
	levelOf(locale: string): number {
		return locale === this.locale && this.opened ? this.progress.level : load<Progress>(`phrases:${locale}`, blank()).level;
	}

	/** Open a language (picks up where you left off). */
	async open(locale: string) {
		this.locale = locale;
		store('phrases-lang', locale);
		this.progress = { ...blank(), ...load<Progress>(`phrases:${locale}`, blank()) };
		this.opened = true;
		this.result = null;
		this.tries = 0;
		this.levelUp = null;
		await this.fill();
	}

	private save() {
		store(`phrases:${this.locale}`, this.progress);
	}

	/** Out of phrases: fetch new ones for the current level. */
	private async fill() {
		if (this.progress.queue.length || this.loading) return;
		const locale = this.locale;
		this.loading = true;
		this.error = null;
		try {
			const known = [...this.progress.learned, ...this.progress.queue].map((c) => c.text);
			const { phrases } = await post<{ phrases: Omit<Card, 'id' | 'level'>[] }>('phrases', {
				locale,
				level: this.progress.level,
				known,
				explainIn: app.translateTo
			});
			if (locale !== this.locale) return;
			this.progress.queue.push(...phrases.map((p) => ({ ...p, id: newId(), level: this.progress.level })));
			this.save();
		} catch (err) {
			this.error = (err as Error).message;
		} finally {
			this.loading = false;
		}
	}

	retryLoad() {
		this.fill();
	}

	/** Hear the phrase in the tutor's voice (slowly, if asked). */
	listen(slow = false) {
		const c = this.card;
		if (c) app.play(c.text, { botId: this.tutor.id, locale: this.locale, slow });
	}

	/** A recording of the learner saying the current phrase. */
	async attempt(blob: Blob) {
		const c = this.card;
		if (!c || this.checking) return;
		// Each try costs energy (not for members: they have unlimited energy here).
		if (!game.unlimited && !game.spend()) {
			app.say('Out of energy! It fills back up tomorrow.');
			return;
		}
		this.checking = true;
		this.result = null;
		app.active();
		try {
			const q = new URLSearchParams({ botId: this.tutor.id, locale: this.locale, target: c.text });
			const res = await fetch(`/api/speakease/attempt?${q}`, {
				method: 'POST',
				headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm' },
				body: blob
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Something went wrong. Please try again.');
			const r = (await res.json()) as Omit<Result, 'pass'>;
			if (this.card?.id !== c.id) return;
			this.tries++;
			const pass = passes(r);
			const xp = pass ? game.phrasePassed({ firstTry: this.tries === 1, score: r.score, review: !!c.review, level: this.progress.level, locale: this.locale }) : 0;
			if (!pass && this.tries >= TRIES) game.phraseMissed();
			this.result = { ...r, pass, xp };
		} catch (err) {
			app.say((err as Error).message);
		} finally {
			this.checking = false;
		}
	}

	/** Learn this phrase's opposite too: it comes up right after this one. */
	learnOpposite() {
		const c = this.card;
		if (!c?.opposite || c.oppositeQueued) return;
		c.oppositeQueued = true;
		this.progress.queue.splice(1, 0, { ...c.opposite, id: newId(), level: c.level, oppositeOf: c.text });
		this.save();
	}

	/** Phrases learned so far, by level (for reviewing). */
	get learnedByLevel(): { level: number; cards: Card[] }[] {
		const by = new Map<number, Card[]>();
		for (const c of this.progress.learned) by.set(c.level, [...(by.get(c.level) ?? []), c]);
		return [...by.entries()].sort(([a], [b]) => a - b).map(([level, cards]) => ({ level, cards }));
	}

	/**
	 * Go back over earlier phrases: a level's (or, with none given, everything learned), up to 8 in a
	 * shuffled review round before carrying on. Reviews don't count toward the next level.
	 */
	reviewLevel(level: number | null = null) {
		const pool = this.progress.learned.filter((c) => level === null || c.level === level);
		if (!pool.length) return;
		const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
		// Drop reviews already waiting, then put this round first.
		this.progress.queue = this.progress.queue.filter((c) => !c.review);
		this.progress.queue.unshift(...picked.map((c) => ({ ...c, id: newId(), review: true, opposite: undefined, oppositeQueued: undefined })));
		this.result = null;
		this.tries = 0;
		this.save();
	}

	/** After a result: next phrase (passed, or out of tries) or another go. */
	async next() {
		const c = this.card;
		const r = this.result;
		if (!c || !r) return;
		const p = this.progress;
		p.queue.shift();
		if (r.pass) {
			if (!c.review) {
				p.learned.push({ ...c, review: undefined });
				p.passed++;
				app.countPhrase(this.locale);
				if (p.passed >= perLevel(p.level)) {
					p.level++;
					p.passed = 0;
					this.levelUp = p.level;
					game.phraseLevelUp(p.level);
					// Review a few phrases from earlier levels before the new ones.
					const earlier = p.learned.filter((x) => x.level < p.level).sort(() => Math.random() - 0.5).slice(0, REVIEWS);
					p.queue.unshift(...earlier.map((x) => ({ ...x, id: newId(), review: true })));
				}
			}
		} else {
			// Out of tries: it comes back later.
			p.queue.splice(Math.min(COME_BACK_AFTER, p.queue.length), 0, { ...c, id: newId() });
		}
		this.result = null;
		this.tries = 0;
		this.save();
		await this.fill();
	}

	/** Another go at the same phrase (keeps the try count). */
	again() {
		this.result = null;
	}
}

export const quest = new PhraseQuest();
