// SpeakEase AI (web edition): the app's state (what the mobile app kept in its chat context) and
// its calls to /api/speakease. Chats, favourites, settings, the streak, today's goals and phrase
// progress are kept in this browser, as the app kept them on the phone. Chat messages older than
// 30 days are deleted (nothing else is).
import { FRIENDS, LANGUAGE_NAMES, SCENARIO_LANGUAGES, friendById, greetingFor, scenarioById } from './data';
import { game } from './game.svelte';
import { Speaker, isMaleVoice } from '$lib/voice/speech';
import { site } from '$lib/config/site';

export interface Msg {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	/** When it was said (ms), so old chat history can be cleared out. */
	t: number;
	/** What the learner said, word by word, with a pronunciation score (0–100) for each. */
	words?: { w: string; s: number }[];
	/** Sent to the character but not shown (a scenario's "Start scenario in …"). */
	hidden?: boolean;
}

/** How to say a message: romanization (other scripts) and each word's sounds-like spelling and IPA. */
export interface Phonetics {
	romanization: string;
	words: { word: string; sounds: string; ipa: string }[];
}

export type Screen = 'home' | 'chat' | 'practice' | 'phrases' | 'dictionary' | 'flash';
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Goal {
	id: string;
	text: string;
	done: number;
	target: number;
	/** Where tapping the goal takes you. */
	go: { kind: 'chat'; id: string } | { kind: 'phrases'; locale: string };
}

const KEY = 'speakease:';
/** Chat messages are kept this long. */
export const CHAT_DAYS = 30;
/** Today's practice counts as active for this long after the last tap or word. */
const IDLE_MS = 90_000;

export const load = <T>(k: string, fallback: T): T => {
	try {
		const v = localStorage.getItem(KEY + k);
		return v === null ? fallback : (JSON.parse(v) as T);
	} catch {
		return fallback;
	}
};
export const store = (k: string, v: unknown) => {
	try {
		if (v === null) localStorage.removeItem(KEY + k);
		else localStorage.setItem(KEY + k, JSON.stringify(v));
	} catch {
		/* storage full or blocked */
	}
};
export const newId = () => Math.random().toString(36).slice(2, 10);
/** Today in the player's own time zone, e.g. 2026-10-31. */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterday = () => today(new Date(Date.now() - 86_400_000));

export async function post<T>(action: string, body: unknown): Promise<T> {
	const res = await fetch(`/api/speakease/${action}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Something went wrong. Please try again.');
	return res.json() as Promise<T>;
}

/** Delete chat messages older than CHAT_DAYS (whole chats once empty). Only chats: nothing else. */
function purgeOldChats() {
	try {
		const cutoff = Date.now() - CHAT_DAYS * 86_400_000;
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && /^speakease:chat\d+$/.test(k)) keys.push(k.slice(KEY.length));
		}
		for (const k of keys) {
			const msgs = load<Msg[]>(k, []);
			if (!Array.isArray(msgs)) {
				store(k, null);
				continue;
			}
			// Saved before messages had times: they count from now.
			const kept = msgs.map((m) => ({ ...m, t: m.t || Date.now() })).filter((m) => m.t >= cutoff);
			if (!kept.some((m) => m.role === 'user')) store(k, null);
			else if (kept.length !== msgs.length || msgs.some((m) => !m.t)) store(k, kept);
		}
	} catch {
		/* storage blocked */
	}
}

/** Today's practice so far (for the goals). */
interface Day {
	day: string;
	seconds: number;
	/** Things said to each friend today. */
	msgs: Record<string, number>;
	/** Phrases learned today, per language. */
	phrases: Record<string, number>;
	/** Goals already rewarded today ('all' once every goal is done). */
	awarded: string[];
}
const freshDay = (): Day => ({ day: today(), seconds: 0, msgs: {}, phrases: {}, awarded: [] });

class SpeakEase {
	screen = $state<Screen>('home');
	/** The character in the open chat (a friend or a scenario). */
	botId = $state('0');
	/** The language being spoken (a friend's language, or the scenario's chosen one). */
	locale = $state('en-US');
	messages = $state<Msg[]>([]);
	recording = $state(false);
	waiting = $state(false);
	/** A problem to show briefly (couldn't hear you, server busy…). */
	toast = $state<string | null>(null);

	/** The player's nickname on the site (signed in), or null. */
	nickname = $state<string | null>(null);
	favorites = $state<string[]>([]);
	translateTo = $state('en');
	themeSetting = $state<ThemeSetting>('system');
	private systemDark = $state(true);
	scenarioLanguage = $state('English');

	streak = $state<{ count: number; best: number; last: string }>({ count: 0, best: 0, last: '' });
	day = $state<Day>(freshDay());

	/** Per message: its translation (and into what), its sentence check. */
	translations = $state<Record<string, { to: string; text: string }>>({});
	corrections = $state<Record<string, string>>({});

	private audio: HTMLAudioElement | null = null;
	private voiceCache = new Map<string, string>();
	private toastTimer: ReturnType<typeof setTimeout> | undefined;
	/** Voices out of quota (or failing): Cortex reads things aloud, and they're tried again after a while. */
	private voiceRestUntil = 0;
	/** "Cortex is taking over" is showing. */
	cortexNote = $state(false);
	private cortexNoteTimer: ReturnType<typeof setTimeout> | undefined;
	/** Cortex's own voice (the site's assistant), made when first needed. */
	private cortex: Speaker | null = null;
	/** Languages this device has no voice for (told once). */
	private noVoiceFor = new Set<string>();
	private lastActive = 0;

	init(nickname: string | null) {
		this.nickname = nickname;
		purgeOldChats();
		game.init();
		this.favorites = load<string[]>('favorites', []).filter((id) => friendById(id));
		this.translateTo = load('translate', 'en');
		const theme = load<string>('theme', 'system');
		this.themeSetting = theme === 'light' || theme === 'dark' ? theme : 'system';
		const lang = load('scenario', 'English');
		this.scenarioLanguage = SCENARIO_LANGUAGES.some((l) => l.label === lang) ? lang : 'English';
		this.streak = { count: 0, best: 0, last: '', ...load('streak', {}) };
		const d = load<Day>('today', freshDay());
		this.day = d.day === today() ? { ...freshDay(), ...d } : freshDay();
		const mq = matchMedia('(prefers-color-scheme: dark)');
		this.systemDark = mq.matches;
		mq.addEventListener('change', (e) => (this.systemDark = e.matches));
	}

	get theme(): 'light' | 'dark' {
		return this.themeSetting === 'system' ? (this.systemDark ? 'dark' : 'light') : this.themeSetting;
	}
	get friend() {
		return friendById(this.botId);
	}
	get scenario() {
		return scenarioById(this.botId);
	}
	get title() {
		return this.friend?.name ?? this.scenario?.name ?? '';
	}

	say(message: string) {
		this.toast = message;
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => (this.toast = null), 3500);
	}

	// ── Streak, practice time and today's goals ──────────────────────────────────────
	/** The player did something (a tap, a word): practice time keeps counting for a while. */
	active() {
		this.lastActive = Date.now();
	}

	/** Every few seconds: count practice time while a lesson is open and the player is active. */
	tick(seconds: number) {
		this.rollDay();
		game.tick();
		if (this.screen === 'home' || document.hidden || Date.now() - this.lastActive > IDLE_MS) return;
		this.day.seconds += seconds;
		store('today', this.day);
		this.checkGoals();
	}

	/** Reward goals as they're finished (once each), and finishing them all. */
	private checkGoals() {
		const goals = this.goals;
		for (const g of goals) {
			if (g.done >= g.target && !this.day.awarded.includes(g.id)) {
				this.day.awarded.push(g.id);
				game.goalDone(g.text);
			}
		}
		if (goals.length && goals.every((g) => g.done >= g.target) && !this.day.awarded.includes('all')) {
			this.day.awarded.push('all');
			game.allGoalsDone();
		}
		store('today', this.day);
	}

	private rollDay() {
		if (this.day.day !== today()) this.day = freshDay();
	}

	/** Practised today: keeps (or starts) the streak. */
	private practised() {
		this.active();
		const s = this.streak;
		if (s.last === today()) return;
		const count = s.last === yesterday() ? s.count + 1 : 1;
		this.streak = { count, best: Math.max(s.best, count), last: today() };
		store('streak', this.streak);
		game.newDay(count);
	}

	/** The streak as it stands today (gone if a day was missed). */
	get streakNow(): number {
		return this.streak.last === today() || this.streak.last === yesterday() ? this.streak.count : 0;
	}
	get practisedToday(): boolean {
		return this.streak.last === today();
	}

	countMessage(friendId: string) {
		this.rollDay();
		this.day.msgs[friendId] = (this.day.msgs[friendId] ?? 0) + 1;
		store('today', this.day);
		this.practised();
		this.checkGoals();
	}

	countPhrase(locale: string) {
		this.rollDay();
		this.day.phrases[locale] = (this.day.phrases[locale] ?? 0) + 1;
		store('today', this.day);
		this.practised();
		this.checkGoals();
	}

	/**
	 * Today's goals: one for each favourite language (up to three), switching day to day between
	 * talking with that friend and learning its phrases; with no favourites, 15 minutes of practice.
	 */
	get goals(): Goal[] {
		const favs = this.favorites.map((id) => friendById(id)!).filter(Boolean).slice(0, 3);
		if (!favs.length) {
			return [
				{ id: 'minutes', text: 'Practise for 15 minutes', done: Math.min(15, Math.floor(this.day.seconds / 60)), target: 15, go: { kind: 'chat', id: '0' } }
			];
		}
		const dayNo = Math.floor(new Date(`${this.day.day}T12:00:00`).getTime() / 86_400_000);
		return favs.map((f, i) =>
			(dayNo + i) % 2 === 0
				? { id: `chat${f.id}`, text: `Say 5 things to ${f.name} in ${f.language}`, done: Math.min(5, this.day.msgs[f.id] ?? 0), target: 5, go: { kind: 'chat', id: f.id } }
				: {
						id: `phrases${f.locale}`,
						text: `Learn 3 new ${f.language} phrases`,
						done: Math.min(3, this.day.phrases[f.locale] ?? 0),
						target: 3,
						go: { kind: 'phrases', locale: f.locale }
					}
		);
	}

	// ── Settings ─────────────────────────────────────────────────────────────────────
	toggleFavorite(id: string) {
		this.favorites = this.favorites.includes(id) ? this.favorites.filter((f) => f !== id) : [...this.favorites, id];
		store('favorites', this.favorites);
	}
	setTranslate(lang: string) {
		this.translateTo = lang;
		store('translate', lang);
	}
	setTheme(theme: ThemeSetting) {
		this.themeSetting = theme;
		store('theme', theme);
	}

	// ── Screens ──────────────────────────────────────────────────────────────────────
	private reset() {
		this.stopVoice();
		this.translations = {};
		this.corrections = {};
	}

	/** Open a friend's chat: their saved conversation, or their hello. */
	openChat(id: string) {
		const f = friendById(id);
		if (!f) return;
		this.reset();
		this.botId = id;
		this.locale = f.locale;
		const saved = load<Msg[]>(`chat${id}`, []);
		this.messages = saved.length ? saved : [{ id: newId(), role: 'assistant', text: greetingFor(f, this.nickname), t: Date.now() }];
		this.screen = 'chat';
		// Friend chats are plain conversations: no game pops in here.
		game.quiet = true;
		this.active();
		// Greet out loud: the hello in a new chat, or the last thing they said in a saved one.
		const last = [...this.messages].reverse().find((m) => m.role === 'assistant');
		if (last) this.play(last.text);
	}

	/** Open a scenario: it starts once a language is picked (scenarios aren't saved). */
	openScenario(id: string) {
		if (!scenarioById(id)) return;
		this.reset();
		this.botId = id;
		this.locale = SCENARIO_LANGUAGES.find((l) => l.label === this.scenarioLanguage)?.locale ?? 'en-US';
		this.messages = [];
		this.screen = 'practice';
		this.active();
	}

	openPhrases() {
		this.reset();
		this.screen = 'phrases';
		this.active();
	}

	openDictionary() {
		this.reset();
		this.screen = 'dictionary';
		this.active();
	}

	openFlash() {
		this.reset();
		this.screen = 'flash';
		this.active();
	}

	pickScenarioLanguage(label: string) {
		this.scenarioLanguage = label;
		store('scenario', label);
		this.locale = SCENARIO_LANGUAGES.find((l) => l.label === label)?.locale ?? 'en-US';
	}

	goHome() {
		this.stopVoice();
		this.screen = 'home';
		game.release();
	}

	// ── Chatting ─────────────────────────────────────────────────────────────────────
	private save() {
		if (this.screen === 'chat') store(`chat${this.botId}`, this.messages);
	}

	private turns() {
		return this.messages.map((m) => ({ role: m.role, text: m.text })).slice(-60);
	}

	/** The character's next message (spoken aloud). */
	private async answer() {
		const bot = this.botId;
		const { text } = await post<{ text: string }>('reply', {
			botId: bot,
			locale: this.locale,
			turns: this.turns(),
			scenario: this.screen === 'practice'
		});
		if (bot !== this.botId) return;
		const msg: Msg = { id: newId(), role: 'assistant', text, t: Date.now() };
		this.messages.push(msg);
		this.save();
		this.play(msg.text);
		// A scenario says END SCENARIO when it's been played through (and starts again).
		const sc = this.scenario;
		if (sc && this.screen === 'practice' && /END SCENARIO/.test(text) && this.messages.some((m) => m.role === 'user' && !m.hidden)) {
			game.sceneDone(sc.id, sc.name.replace(/!$/, ''));
		}
	}

	/** Start the picked scenario (the character speaks first). */
	async startScenario() {
		this.messages = [{ id: newId(), role: 'user', text: `Start scenario in ${this.scenarioLanguage}`, hidden: true, t: Date.now() }];
		this.waiting = true;
		try {
			await this.answer();
		} catch (err) {
			this.say((err as Error).message);
		} finally {
			this.waiting = false;
		}
	}

	/** A recording from the mic: what was said (and how well), then the character's reply. */
	async sendRecording(blob: Blob) {
		const bot = this.botId;
		// Scenario lines cost energy (friend chats are free).
		if (this.screen === 'practice' && !game.spend()) {
			this.say('Out of energy! It fills back up tomorrow.');
			return;
		}
		this.waiting = true;
		this.active();
		try {
			const res = await fetch(`/api/speakease/listen?botId=${encodeURIComponent(bot)}&locale=${encodeURIComponent(this.locale)}`, {
				method: 'POST',
				headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm' },
				body: blob
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Something went wrong. Please try again.');
			const heard = (await res.json()) as { text: string; words: { w: string; s: number }[] };
			if (bot !== this.botId) return;
			// Like the app, an empty recording still goes to the character (who asks you to repeat).
			this.messages.push({ id: newId(), role: 'user', text: heard.text, words: heard.words, t: Date.now() });
			if (heard.text) {
				if (this.friend) this.countMessage(bot);
				else {
					this.practised();
					game.sceneLine();
				}
			}
			await this.answer();
		} catch (err) {
			this.say((err as Error).message);
		} finally {
			this.waiting = false;
		}
	}

	/** The light bulb: something the learner could say next. */
	async suggest() {
		if (this.waiting) return;
		this.waiting = true;
		this.active();
		try {
			const { text } = await post<{ text: string }>('suggest', { turns: this.turns() });
			this.messages.push({ id: newId(), role: 'user', text, t: Date.now() });
			this.save();
		} catch (err) {
			this.say((err as Error).message);
		} finally {
			this.waiting = false;
		}
	}

	/** Tap a bubble: its translation (fetched once per language). */
	async translationOf(m: Msg): Promise<string | null> {
		this.active();
		const have = this.translations[m.id];
		if (have?.to === this.translateTo) return have.text;
		try {
			const { text } = await post<{ text: string }>('translate', { text: m.text, to: this.translateTo });
			this.translations[m.id] = { to: this.translateTo, text };
			return text;
		} catch (err) {
			this.say((err as Error).message);
			return null;
		}
	}

	/** The checkmark: the sentence checked ("Correction: …" or "Looks good!"). */
	async correctionOf(m: Msg): Promise<string | null> {
		this.active();
		if (this.corrections[m.id]) return this.corrections[m.id];
		try {
			const { text } = await post<{ text: string }>('correct', { text: m.text });
			this.corrections[m.id] = text;
			return text;
		} catch (err) {
			this.say((err as Error).message);
			return null;
		}
	}

	private phoneticsCache = new Map<string, Promise<Phonetics | null>>();
	/** How to say a message, word by word (the "/ə/" button under a bubble), fetched once. */
	phoneticsOf(m: Msg): Promise<Phonetics | null> {
		const key = `${this.locale}|${m.text}`;
		if (!this.phoneticsCache.has(key)) {
			this.phoneticsCache.set(
				key,
				post<Phonetics>('phonetics', { text: m.text.slice(0, 1000), locale: this.locale }).catch((err) => {
					this.phoneticsCache.delete(key);
					this.say((err as Error).message);
					return null;
				})
			);
		}
		return this.phoneticsCache.get(key)!;
	}

	private guides = new Map<string, Promise<{ sounds: string; ipa: string; how: string } | null>>();
	/** How to say a word (sound-it-out spelling, IPA and a tip), fetched once per word. */
	pronunciationOf(word: string, locale = this.locale) {
		const key = `${locale}|${this.translateTo}|${word}`;
		if (!this.guides.has(key)) {
			this.guides.set(
				key,
				post<{ sounds: string; ipa: string; how: string }>('pronounce', { word, locale, explainIn: this.translateTo }).catch(() => {
					this.guides.delete(key);
					return null;
				})
			);
		}
		return this.guides.get(key)!;
	}

	/** Delete (from the menu): a friend's chat starts over with their hello; a scenario restarts. */
	clear() {
		this.reset();
		store(`chat${this.botId}`, null);
		const f = this.friend;
		this.messages = f ? [{ id: newId(), role: 'assistant', text: greetingFor(f, this.nickname), t: Date.now() }] : [];
	}

	// ── Voices ───────────────────────────────────────────────────────────────────────
	/**
	 * Say something aloud. Cortex (everyone but Easso) speaks with the browser's voice, as on the rest
	 * of the site. Easso has his own Gemini voice; when it's out of quota (or fails), Cortex takes
	 * over for a while, and says so.
	 */
	async play(text: string, opts: { botId?: string; locale?: string; slow?: boolean } = {}) {
		const clean = text.replace(/END SCENARIO/g, '').trim();
		if (!clean) return;
		const bot = opts.botId ?? this.botId;
		const locale = opts.locale ?? this.locale;
		const screen = this.screen;
		// One recording serves both speeds: slow is played back slower.
		const key = `${bot}|${locale}|${clean}`;
		this.stopVoice();
		if (bot !== '0') return this.cortexSay(clean, locale, !!opts.slow);
		let url = this.voiceCache.get(key);
		if (!url && Date.now() < this.voiceRestUntil) return this.cortexSay(clean, locale, !!opts.slow);
		try {
			if (!url) {
				const res = await fetch('/api/speakease/speak', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ botId: bot, locale, text: clean.slice(0, 1000) })
				});
				if (!res.ok) throw new Error(`voice ${res.status}`);
				url = URL.createObjectURL(await res.blob());
				this.voiceCache.set(key, url);
			}
		} catch {
			// Out of quota or unreachable: Cortex reads for a while, then the voices are tried again.
			this.voiceRestUntil = Date.now() + 5 * 60_000;
			if (this.screen === screen && this.screen !== 'home') this.cortexSay(clean, locale, !!opts.slow, true);
			return;
		}
		if (this.screen !== screen || this.screen === 'home') return;
		this.stopVoice();
		this.audio = new Audio(url);
		if (opts.slow) {
			this.audio.preservesPitch = true;
			this.audio.playbackRate = 0.7;
		}
		try {
			await this.audio.play();
		} catch (err) {
			if ((err as Error).name !== 'AbortError' && (err as Error).name !== 'NotAllowedError') this.say("Couldn't play that.");
		}
	}

	/**
	 * Cortex reads it: the site assistant's own voice for English; for other languages the
	 * browser's voice for that language, at Cortex's pace (an English voice can't read them).
	 */
	private cortexSay(text: string, locale: string, slow: boolean, announce = false) {
		if (typeof speechSynthesis === 'undefined') return;
		if (announce) {
			this.cortexNote = true;
			clearTimeout(this.cortexNoteTimer);
			this.cortexNoteTimer = setTimeout(() => (this.cortexNote = false), 5000);
		}
		speechSynthesis.cancel();
		if (/^en/i.test(locale) && !slow) {
			this.cortex ??= new Speaker();
			this.cortex.push(`${text} `);
			this.cortex.flush();
			return;
		}
		const lang = locale.toLowerCase();
		// This language's voices on the device, a male one first (Cortex is a he).
		const all = speechSynthesis.getVoices();
		const exact = all.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
		const near = all.filter((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0]));
		const voice = exact.find(isMaleVoice) ?? near.find(isMaleVoice) ?? exact[0] ?? near[0];
		if (!voice && !/^en/i.test(locale)) {
			// No voice for this language on this device (an English voice can't read it): say so once.
			if (!this.noVoiceFor.has(locale)) {
				this.noVoiceFor.add(locale);
				const name = (LANGUAGE_NAMES[locale] ?? 'this language').replace(/ \(.*\)$/, '');
				this.say(`This device has no ${name} voice, so Cortex can't read it aloud. You can add one in your system's speech settings.`);
			}
			return;
		}
		const u = new SpeechSynthesisUtterance(text);
		if (voice) u.voice = voice;
		u.lang = locale;
		u.rate = slow ? 0.75 : site.speechRate;
		u.pitch = site.speechPitch;
		speechSynthesis.speak(u);
	}

	/**
	 * Call from the tap that opens a chat or scenario: phones (iOS especially) only allow speech
	 * that starts in a tap, and this lets the greeting that follows be spoken.
	 */
	unlockVoice() {
		if (typeof speechSynthesis === 'undefined' || this.voiceUnlocked) return;
		this.voiceUnlocked = true;
		const u = new SpeechSynthesisUtterance(' ');
		u.volume = 0;
		speechSynthesis.speak(u);
	}
	private voiceUnlocked = false;

	stopVoice() {
		this.audio?.pause();
		this.audio = null;
		if (typeof speechSynthesis !== 'undefined' && (this.cortex || speechSynthesis.speaking)) speechSynthesis.cancel();
	}
}

export const app = new SpeakEase();
export const allFriends = FRIENDS;
