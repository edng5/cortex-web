// Flash Cards: learn vocabulary by category. Pick a language and a category; each round is a mix of
// cards (what does this mean? which word is it? match them up, pick every word that fits), easy
// everyday words first, harder ones as you level up. Every word can be heard, and shows how to say
// it; after each card, every word on it shows its translation. Progress is kept per language and
// category, in this browser (and the account, through the usual SpeakEase sync).
import { app, load, newId, post, store } from './app.svelte';
import { FRIENDS } from './data';
import { game } from './game.svelte';

export interface Word {
	word: string;
	romanization: string;
	sounds: string;
	ipa: string;
	meaning: string;
	emoji: string;
}

export interface Category {
	id: string;
	name: string;
	emoji: string;
}
export const CATEGORIES: Category[] = [
	{ id: 'food', name: 'Food & Drink', emoji: '🍎' },
	{ id: 'animals', name: 'Animals', emoji: '🐶' },
	{ id: 'colours', name: 'Colours', emoji: '🎨' },
	{ id: 'numbers', name: 'Numbers', emoji: '🔢' },
	{ id: 'family', name: 'Family & People', emoji: '👪' },
	{ id: 'body', name: 'The Body', emoji: '🖐️' },
	{ id: 'clothes', name: 'Clothes', emoji: '👕' },
	{ id: 'home', name: 'Around the Home', emoji: '🏠' },
	{ id: 'travel', name: 'Travel & Places', emoji: '✈️' },
	{ id: 'weather', name: 'Weather & Nature', emoji: '🌤️' },
	{ id: 'feelings', name: 'Feelings', emoji: '😊' },
	{ id: 'jobs', name: 'Jobs', emoji: '👩‍🍳' },
	{ id: 'time', name: 'Time & Days', emoji: '🕒' },
	{ id: 'sports', name: 'Sports & Hobbies', emoji: '⚽' },
	{ id: 'school', name: 'School & Work', emoji: '📚' },
	{ id: 'verbs', name: 'Everyday Actions', emoji: '🏃' }
];

/**
 * The kinds of card:
 *  - mc: a word in the language: pick what it means;
 *  - pick: a meaning: pick the word in the language;
 *  - match: four words and four meanings: pair them up;
 *  - multi: pick every word that belongs to the category (the rest are from other topics).
 */
export type CardType = 'mc' | 'pick' | 'match' | 'multi';
export interface Question {
	id: string;
	type: CardType;
	/** The word asked about (mc, pick). */
	target: Word | null;
	/** The words on the card (match: the four to pair). */
	options: Word[];
	/** The right answers (words). */
	correct: string[];
	/** A word from an earlier round, back to check it stuck. */
	review?: boolean;
}

interface Progress {
	level: number;
	/** Cards right at this level (new words), toward the next. */
	right: number;
	/** Words learned in this category (all levels). */
	learned: (Word & { level: number })[];
}

/** Cards in a round. */
export const ROUND = 8;
/** Hearts per round: a wrong card costs one. */
export const HEARTS = 3;
/** Cards right to finish a level: 12 at level 1, four more each level after, up to 28. */
export const perLevel = (level: number) => Math.min(28, 12 + 4 * (Math.max(1, level) - 1));

const blank = (): Progress => ({ level: 1, right: 0, learned: [] });
const shuffle = <T>(a: T[]): T[] => {
	const b = [...a];
	for (let i = b.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[b[i], b[j]] = [b[j], b[i]];
	}
	return b;
};
const key = (w: Word) => w.word.toLowerCase();

/** The cards in a round, by level: plenty of multiple choice to start, more matching and picking later. */
const PLANS: CardType[][] = [
	['mc', 'pick', 'mc', 'match', 'pick', 'multi', 'mc', 'pick'],
	['pick', 'mc', 'match', 'multi', 'pick', 'mc', 'match', 'pick'],
	['pick', 'match', 'multi', 'pick', 'mc', 'match', 'multi', 'pick']
];

class FlashCards {
	locale = $state(load<string>('flash-lang', 'es-DO'));
	/** The category being played (null: choosing one). */
	category = $state<Category | null>(null);
	progress = $state<Progress>(blank());
	loading = $state(false);
	error = $state<string | null>(null);

	// The round.
	round = $state<Question[]>([]);
	index = $state(0);
	hearts = $state(HEARTS);
	/** Right answers in a row. */
	combo = $state(0);
	roundRight = $state(0);
	roundXp = $state(0);
	/** The answer to the current card (shown with every word's translation), or null. */
	answered = $state<{ chosen: string[]; right: boolean; xp: number } | null>(null);
	/** The round's over: the summary. */
	summary = $state(false);
	/** Just levelled up (the new level), for the celebration. */
	levelUp = $state<number | null>(null);

	// Matching: pairs found, the word picked on the left, a wrong pairing flashing.
	matched = $state<string[]>([]);
	matchPick = $state<string | null>(null);
	matchWrong = $state<string | null>(null);
	mistakes = $state(0);
	/** The meanings column, shuffled once per card. */
	matchRight = $state<Word[]>([]);
	// Multi-select: what's ticked.
	selected = $state<string[]>([]);

	get tutor() {
		return FRIENDS.find((f) => f.locale === this.locale) ?? FRIENDS[0];
	}
	get card(): Question | null {
		return this.round[this.index] ?? null;
	}
	/** Total words learned in Flash Cards, every language and category (for the badges). */
	private get total() {
		return load<number>('flash-total', 0);
	}

	/** A category's level in the open language. */
	levelOf(cat: string): number {
		return load<Progress>(`flash:${this.locale}:${cat}`, blank()).level;
	}
	learnedIn(cat: string): number {
		return load<Progress>(`flash:${this.locale}:${cat}`, blank()).learned.length;
	}

	/** Open a language (back to the category list). */
	open(locale: string) {
		this.locale = locale;
		store('flash-lang', locale);
		this.category = null;
		this.round = [];
		this.summary = false;
	}

	/** Play a category: picks up its level and deals a round. */
	async play(cat: Category) {
		this.category = cat;
		this.progress = { ...blank(), ...load<Progress>(`flash:${this.locale}:${cat.id}`, blank()) };
		await this.deal();
	}

	private save() {
		if (this.category) store(`flash:${this.locale}:${this.category.id}`, this.progress);
	}

	/** A fresh round: new words for the level, a couple of earlier ones back for review. */
	async deal() {
		const cat = this.category;
		if (!cat || this.loading) return;
		const locale = this.locale;
		this.loading = true;
		this.error = null;
		this.summary = false;
		this.levelUp = null;
		try {
			const known = this.progress.learned.map((w) => w.word);
			const { words, decoys } = await post<{ words: Word[]; decoys: Word[] }>('vocab', {
				locale,
				category: cat.name,
				level: this.progress.level,
				known,
				explainIn: app.translateTo
			});
			if (locale !== this.locale || cat !== this.category) return;
			if (words.length < 4) throw new Error("Couldn't find enough words just now. Please try again.");
			this.round = this.build(words, decoys);
			this.index = 0;
			this.hearts = HEARTS;
			this.combo = 0;
			this.roundRight = 0;
			this.roundXp = 0;
			this.startCard();
		} catch (err) {
			this.error = (err as Error).message;
		} finally {
			this.loading = false;
		}
	}

	/** The round's cards, from the new words, the decoys and what's been learned already. */
	private build(fresh: Word[], decoys: Word[]): Question[] {
		const learned = this.progress.learned;
		// A couple of earlier words come back (once there are some).
		const reviews = shuffle(learned).slice(0, learned.length >= 6 ? 2 : 0);
		const pool = [...fresh, ...learned];
		const plan = PLANS[Math.min(PLANS.length, this.progress.level) - 1];
		const targets = shuffle(fresh);
		let t = 0;
		let r = 0;
		const nextTarget = (): { w: Word; review: boolean } => {
			// Every third single-word card is a review, while there are reviews left.
			if (r < reviews.length && (t + r) % 3 == 2) return { w: reviews[r++], review: true };
			return { w: targets[t++ % targets.length], review: false };
		};
		// Other words to choose from: different meanings from the right one.
		const others = (w: Word, n: number) =>
			shuffle(pool.filter((o) => key(o) != key(w) && o.meaning.toLowerCase() != w.meaning.toLowerCase())).slice(0, n);
		return plan.map((type): Question => {
			if (type == 'match') {
				const four = shuffle(fresh).slice(0, 4);
				return { id: newId(), type, target: null, options: four, correct: four.map((w) => w.word) };
			}
			if (type == 'multi' && decoys.length >= 2) {
				const ins = shuffle(fresh).slice(0, 3);
				const outs = shuffle(decoys).slice(0, 3);
				return { id: newId(), type, target: null, options: shuffle([...ins, ...outs]), correct: ins.map((w) => w.word) };
			}
			const { w, review } = nextTarget();
			const kind: CardType = type == 'multi' ? 'pick' : type;
			return { id: newId(), type: kind, target: w, options: shuffle([w, ...others(w, 3)]), correct: [w.word], review };
		});
	}

	/** Set up the current card. */
	private startCard() {
		this.answered = null;
		this.matched = [];
		this.matchPick = null;
		this.matchWrong = null;
		this.mistakes = 0;
		this.selected = [];
		const c = this.card;
		this.matchRight = c?.type == 'match' ? shuffle(c.options) : [];
	}

	/** Hear a word in the tutor's voice. */
	say(w: Word, slow = false) {
		app.play(w.word, { botId: this.tutor.id, locale: this.locale, slow });
	}

	// ── Answering ──
	/** Multiple choice (mc, pick): the word chosen. */
	choose(w: Word) {
		const c = this.card;
		if (!c || this.answered) return;
		this.finish([w.word], c.correct.includes(w.word));
	}

	/** Multi-select: tick or untick a word. */
	toggle(w: Word) {
		if (this.answered) return;
		this.selected = this.selected.includes(w.word) ? this.selected.filter((x) => x != w.word) : [...this.selected, w.word];
	}
	/** Multi-select: check the ticked words. */
	checkSelected() {
		const c = this.card;
		if (!c || this.answered || !this.selected.length) return;
		const right = this.selected.length == c.correct.length && this.selected.every((x) => c.correct.includes(x));
		this.finish([...this.selected], right);
	}

	/** Matching: tap a word, then its meaning. */
	pickLeft(w: Word) {
		if (this.answered || this.matched.includes(w.word)) return;
		this.matchPick = w.word;
		this.matchWrong = null;
	}
	pickRight(w: Word) {
		const c = this.card;
		if (!c || this.answered || !this.matchPick || this.matched.includes(w.word)) return;
		if (w.word == this.matchPick) {
			this.matched = [...this.matched, w.word];
			this.matchPick = null;
			if (this.matched.length == c.options.length) this.finish(this.matched, this.mistakes <= 1);
		} else {
			this.mistakes++;
			this.matchWrong = w.word;
			setTimeout(() => {
				if (this.matchWrong == w.word) this.matchWrong = null;
			}, 600);
		}
	}

	/** A card answered: XP and a word learned, or a heart lost. */
	private finish(chosen: string[], right: boolean) {
		const c = this.card;
		if (!c) return;
		let xp = 0;
		if (right) {
			this.combo++;
			this.roundRight++;
			xp = game.cardRight(this.combo, !!c.review);
			this.roundXp += xp;
			// The words it taught.
			const taught = c.type == 'match' ? c.options : c.type == 'multi' ? c.options.filter((o) => c.correct.includes(o.word)) : c.target ? [c.target] : [];
			const have = new Set(this.progress.learned.map(key));
			let added = 0;
			for (const w of taught)
				if (!have.has(key(w))) {
					this.progress.learned.push({ ...w, level: this.progress.level });
					have.add(key(w));
					added++;
				}
			if (added) {
				const total = this.total + added;
				store('flash-total', total);
				game.wordsLearned(total);
			}
			if (!c.review) {
				this.progress.right++;
				if (this.progress.right >= perLevel(this.progress.level)) {
					this.progress.level++;
					this.progress.right = 0;
					this.levelUp = this.progress.level;
					game.flashLevelUp(this.progress.level, this.category?.name ?? 'Flash Cards');
				}
			}
			this.save();
		} else {
			this.combo = 0;
			this.hearts = Math.max(0, this.hearts - 1);
		}
		this.answered = { chosen, right, xp };
	}

	/** On to the next card (or the round's summary). */
	next() {
		if (!this.answered) return;
		if (this.hearts <= 0 || this.index + 1 >= this.round.length) {
			this.summary = true;
			if (this.roundRight == this.round.length) game.perfectRound();
			return;
		}
		this.index++;
		this.startCard();
	}

	/** Back to the categories. */
	leaveCategory() {
		this.category = null;
		this.round = [];
		this.summary = false;
		this.answered = null;
	}
}

export const flash = new FlashCards();
