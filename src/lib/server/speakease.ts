// SpeakEase AI (web edition) on Gemini: replies, speech recognition with per-word pronunciation
// scores, sentence corrections, suggestions, translations and the characters' voices.
// The mobile app used OpenAI for replies and Azure for speech, translation and voices; this does
// the same with the site's one Gemini key.
import { env } from '$env/dynamic/private';
import { LlmError } from './llm-error';
import { geminiModel } from './gemini';
import { PROMPTS } from './speakease-prompts';
import { LANGUAGE_NAMES, TRANSLATE_OPTIONS, noSpaces, type Gender } from '$lib/speakease/data';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Fastest first; the next is tried if one is busy (each has its own per-minute quota). */
const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'];

export interface Turn {
	role: 'user' | 'assistant';
	text: string;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type Content = { role: 'user' | 'model'; parts: Part[] };

async function call(model: string, body: object, signal?: AbortSignal): Promise<{ parts: { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } }[] }> {
	const key = env.GEMINI_API_KEY;
	if (!key) throw new LlmError('auth', 'GEMINI_API_KEY is not set');
	// One retry when Gemini is briefly busy.
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(`${API}/${model}:generateContent`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
			body: JSON.stringify(body),
			signal
		});
		if (res.ok) {
			const j = await res.json();
			if (j.promptFeedback?.blockReason) throw new LlmError('blocked', j.promptFeedback.blockReason);
			const cand = j.candidates?.[0];
			if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(cand?.finishReason)) throw new LlmError('blocked', cand.finishReason);
			return { parts: cand?.content?.parts ?? [] };
		}
		const detail = (await res.text().catch(() => '')).slice(0, 300);
		if ((res.status === 429 || res.status === 503) && attempt === 0) {
			await new Promise((r) => setTimeout(r, 700));
			continue;
		}
		if (res.status === 429 || res.status === 503) throw new LlmError('rate_limit', detail);
		if (res.status === 401 || res.status === 403) throw new LlmError('auth', detail);
		throw new LlmError('other', `Gemini HTTP ${res.status}: ${detail}`);
	}
}

async function text(system: string | null, contents: Content[], json?: object, maxTokens = 1024): Promise<string> {
	const { parts } = await call(geminiModel(), {
		...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
		contents,
		generationConfig: {
			maxOutputTokens: maxTokens,
			thinkingConfig: { thinkingLevel: 'low' },
			...(json ? { responseMimeType: 'application/json', responseSchema: json } : {})
		}
	});
	return parts
		.filter((p) => !p.thought && typeof p.text === 'string')
		.map((p) => p.text)
		.join('')
		.trim();
}

/** The chat as Gemini wants it: user/model turns, back to back turns from one side joined up. */
function toContents(turns: Turn[]): Content[] {
	const out: Content[] = [];
	for (const t of turns) {
		if (!t.text.trim()) continue;
		const role = t.role === 'assistant' ? 'model' : 'user';
		const last = out.at(-1);
		if (last?.role === role) (last.parts[0] as { text: string }).text += `\n${t.text}`;
		else out.push({ role, parts: [{ text: t.text }] });
	}
	if (out[0]?.role === 'model') out.unshift({ role: 'user', parts: [{ text: '(The chat begins.)' }] });
	return out;
}

const languageOf = (locale: string) => LANGUAGE_NAMES[locale] ?? 'English';

/** The character's prompt, plus who they are (so the words match the voice) and the language. */
function systemFor(botId: string, gender: Gender, locale: string, scenario: boolean, nickname: string | null): string {
	const self =
		gender === 'female'
			? 'You are a woman: when you refer to yourself, use feminine grammar, and if you give yourself a name, use one that suits a woman.'
			: 'You are a man: when you refer to yourself, use masculine grammar, and if you give yourself a name, use one that suits a man.';
	const lang = scenario ? '' : ` Always reply in ${languageOf(locale)}.`;
	// Every character but Easso is Cortex, the site's assistant (whatever name the app's prompt gave them).
	const cortex = botId === '0' ? '' : ' Your name is Cortex (whatever name is given above): you are Cortex, the friendly AI assistant of this website. If you introduce yourself, say you are Cortex.';
	// Signed in on the site: the characters call the player by their nickname (else "friend", as the app did).
	const name = nickname
		? ` The user's name is ${JSON.stringify(nickname)} (their nickname on this site): call them by it, not "friend", naturally and not in every message.`
		: '';
	return `${PROMPTS[botId]}\n\n${self}${cortex}${lang}${name} Your replies are read aloud, so write plain sentences: no markdown, lists or emojis.`;
}

/** The character's next message. */
export function reply(botId: string, gender: Gender, locale: string, turns: Turn[], scenario: boolean, nickname: string | null): Promise<string> {
	return text(systemFor(botId, gender, locale, scenario, nickname), toContents(turns));
}

/** What was said (in `locale`), and how well each word was pronounced (0–100). */
export async function transcribe(audioBase64: string, mimeType: string, locale: string): Promise<{ text: string; words: { w: string; s: number }[] }> {
	const lang = languageOf(locale);
	const out = await text(
		null,
		[
			{
				role: 'user',
				parts: [
					{ inlineData: { mimeType, data: audioBase64 } },
					{
						text:
							`The speaker is a learner practising ${lang} (${locale}). Transcribe what they meant to say, in ${lang} written the ` +
							`usual way (with punctuation), then split it into words (for Chinese or Japanese, short words). For each word, write ` +
							`down how it actually sounded (a rough phonetic spelling of what you heard, e.g. "vant" for "want" said with a v), ` +
							`then score its pronunciation from 0 to 100 like Azure pronunciation assessment's accuracy score: 95–100 said right ` +
							`(an accent alone is fine); 86–94 slightly off; 60–85 a sound clearly wrong (like v for w, z for th, a wrong vowel or ` +
							`tone, a dropped sound); under 60 mispronounced or hard to make out. Judge the sounds you heard, not the word you ` +
							`think they meant. If there is no speech, or only noise, return no words and an empty text.`
					}
				]
			}
		],
		{
			type: 'OBJECT',
			properties: {
				text: { type: 'STRING' },
				words: {
					type: 'ARRAY',
					items: {
						type: 'OBJECT',
						// `heard` first: writing down the sounds makes the scores honest (otherwise every word scores ~95).
						properties: { word: { type: 'STRING' }, heard: { type: 'STRING' }, score: { type: 'INTEGER' } },
						required: ['word', 'heard', 'score'],
						propertyOrdering: ['word', 'heard', 'score']
					}
				}
			},
			required: ['text', 'words']
		}
	);
	const j = JSON.parse(out) as { text?: string; words?: { word: string; score: number }[] };
	const words = (j.words ?? [])
		.filter((x) => typeof x.word === 'string' && x.word.trim())
		.map((x) => ({ w: x.word.trim(), s: Math.max(0, Math.min(100, Math.round(Number(x.score) || 0))) }));
	return { text: (j.text ?? '').trim() || words.map((x) => x.w).join(' '), words };
}

/** The app's sentence check: "Correction: …", or "Looks good!". */
export function correct(sentence: string): Promise<string> {
	return text(
		'Input a sentence, and I will list the grammatical errors. If there are any, I will provide a grammatically correct version of the sentence. Provide in the format Correction: <correction>. If the sentence is correct output Looks good!',
		[{ role: 'user', parts: [{ text: sentence }] }]
	);
}

/** A reply the learner could say next (the light bulb). */
export function suggest(turns: Turn[]): Promise<string> {
	return text(null, [
		...toContents(turns),
		{
			role: 'user',
			parts: [
				{
					text: 'Respond to the last message said by the assistant in the conversation with a maximum of 15 words! Do not say Sure or Sure thing! Respond in the same language as that message and use proper sentence structure and punctuation. Reply with only the response itself.'
				}
			]
		}
	]);
}

/** A message in another language (tap a bubble). */
export function translate(textIn: string, to: string): Promise<string> {
	const label = TRANSLATE_OPTIONS.find((o) => o.lang === to)?.label ?? 'English';
	return text(
		`You translate chat messages into ${label}${to === 'yue' ? ' (written Cantonese, Traditional characters)' : ''}. Reply with only the translation. If the message is already in ${label}, repeat it unchanged.`,
		[{ role: 'user', parts: [{ text: textIn }] }]
	);
}

// ── Phrase Quest (learning new phrases) ──────────────────────────────────────────────

/** A phrase to learn, with how to say it. */
export interface Phrase {
	text: string;
	/** Latin-letter reading for languages in other scripts (pinyin, romaji…); empty otherwise. */
	romanization: string;
	/** An easy sound-it-out spelling for an English speaker, stressed syllables in CAPITALS. */
	sounds: string;
	ipa: string;
	meaning: string;
	/** The tricky bits: a word, what it sounds like, how to make the sound. */
	tips: { word: string; soundsLike: string; how: string }[];
	/** Its opposite, when it has a natural one (yes → no, hello → goodbye), to learn as well. */
	opposite?: Omit<Phrase, 'opposite' | 'tips'> & { tips: Phrase['tips'] };
}

/** What each level asks for: easy greetings first, natural fluent sentences later. */
const LEVELS = [
	'very easy: greetings and polite words of 1–3 words (hello, thank you, please, yes, no, goodbye, sorry)',
	'easy: everyday expressions of 2–4 words (how are you, nice to meet you, my name is…, excuse me, I understand)',
	'simple sentences of 4–6 words about yourself, food, places and shopping',
	'everyday sentences of 5–8 words for asking for help, making plans, time and travel, with some trickier sounds',
	'longer sentences of 7–10 words using past and future tenses and linking words',
	'natural, fluent sentences of 8–14 words, including common idioms and expressions native speakers use, with tricky sounds'
];
const levelBrief = (level: number) => LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];

const PHRASE_SCHEMA = {
	type: 'OBJECT',
	properties: {
		phrases: {
			type: 'ARRAY',
			items: {
				type: 'OBJECT',
				properties: {
					text: { type: 'STRING' },
					romanization: { type: 'STRING' },
					sounds: { type: 'STRING' },
					ipa: { type: 'STRING' },
					meaning: { type: 'STRING' },
					tips: {
						type: 'ARRAY',
						items: {
							type: 'OBJECT',
							properties: { word: { type: 'STRING' }, soundsLike: { type: 'STRING' }, how: { type: 'STRING' } },
							required: ['word', 'soundsLike', 'how']
						}
					},
					opposite: {
						type: 'OBJECT',
						properties: {
							text: { type: 'STRING' },
							romanization: { type: 'STRING' },
							sounds: { type: 'STRING' },
							ipa: { type: 'STRING' },
							meaning: { type: 'STRING' },
							tips: {
								type: 'ARRAY',
								items: {
									type: 'OBJECT',
									properties: { word: { type: 'STRING' }, soundsLike: { type: 'STRING' }, how: { type: 'STRING' } },
									required: ['word', 'soundsLike', 'how']
								}
							}
						},
						required: ['text', 'romanization', 'sounds', 'ipa', 'meaning', 'tips']
					}
				},
				required: ['text', 'romanization', 'sounds', 'ipa', 'meaning', 'tips', 'opposite']
			}
		}
	},
	required: ['phrases']
};

/** New phrases for a level (none the learner already has). */
export async function phrases(locale: string, level: number, known: string[], explainIn: string, count = 5): Promise<Phrase[]> {
	const lang = languageOf(locale);
	const explain = TRANSLATE_OPTIONS.find((o) => o.lang === explainIn)?.label ?? 'English';
	const out = await text(
		`You are a friendly ${lang} pronunciation coach writing a phrase course for beginners.`,
		[
			{
				role: 'user',
				parts: [
					{
						text:
							`Give ${count} useful ${lang} (${locale}) phrases for level ${level}: ${levelBrief(level)}. ` +
							`Write each phrase as natives write it. Give: "romanization" (only for languages not written in Latin letters, else ""), ` +
							`"sounds" (an easy sound-it-out spelling for an English speaker, syllables split with hyphens and the stressed ` +
							`syllable in CAPITALS; mark tones for tonal languages), "ipa", "meaning" (in ${explain}), and "tips" for the 1–3 ` +
							`hardest words or sounds: what it sounds like and how to make the sound with your mouth (lips, tongue, tone), in ${explain}. ` +
							`Also give "opposite": the phrase with the opposite meaning, in the same fields (yes → no, hello → goodbye, ` +
							`I like it → I don't like it, open → closed), or an empty "text" if it has no natural opposite. ` +
							(known.length ? `Don't repeat any of these: ${known.slice(-80).join(' | ')}.` : '')
					}
				]
			}
		],
		PHRASE_SCHEMA,
		6000
	);
	const j = JSON.parse(out) as { phrases?: Phrase[] };
	return (j.phrases ?? [])
		.filter((p) => p && typeof p.text === 'string' && p.text.trim())
		.slice(0, count)
		.map((p) => ({
			text: p.text.trim(),
			romanization: String(p.romanization ?? '').trim(),
			sounds: String(p.sounds ?? '').trim(),
			ipa: String(p.ipa ?? '').trim(),
			meaning: String(p.meaning ?? '').trim(),
			tips: tipsOf(p.tips),
			...(p.opposite && String(p.opposite.text ?? '').trim()
				? {
						opposite: {
							text: String(p.opposite.text).trim(),
							romanization: String(p.opposite.romanization ?? '').trim(),
							sounds: String(p.opposite.sounds ?? '').trim(),
							ipa: String(p.opposite.ipa ?? '').trim(),
							meaning: String(p.opposite.meaning ?? '').trim(),
							tips: tipsOf(p.opposite.tips)
						}
					}
				: {})
		}));
}

// ── Flash Cards (vocabulary by category) ─────────────────────────────────────────────

/** A word to learn, with how to say it. */
export interface VocabWord {
	word: string;
	/** Latin-letter reading for languages in other scripts; empty otherwise. */
	romanization: string;
	/** An easy sound-it-out spelling for an English speaker, stressed syllable in CAPITALS. */
	sounds: string;
	ipa: string;
	/** What it means, in the learner's language (a word or two). */
	meaning: string;
	/** One emoji for it, when one fits. */
	emoji: string;
}

/** What each Flash Cards level asks for: the first words a beginner learns, then on from there. */
const VOCAB_LEVELS = [
	'the very first, most common and concrete words a beginner learns (short, everyday, easy to picture)',
	'common everyday words, still simple',
	'useful words that are a little less common',
	'more specific and descriptive words',
	'advanced, precise words a fluent speaker uses'
];

const WORD_PROPS = {
	type: 'OBJECT',
	properties: {
		word: { type: 'STRING' },
		romanization: { type: 'STRING' },
		sounds: { type: 'STRING' },
		ipa: { type: 'STRING' },
		meaning: { type: 'STRING' },
		emoji: { type: 'STRING' }
	},
	required: ['word', 'romanization', 'sounds', 'ipa', 'meaning', 'emoji']
};
const VOCAB_SCHEMA = {
	type: 'OBJECT',
	properties: {
		words: { type: 'ARRAY', items: WORD_PROPS },
		decoys: { type: 'ARRAY', items: WORD_PROPS }
	},
	required: ['words', 'decoys']
};

const wordOf = (w: Partial<VocabWord> | null | undefined): VocabWord | null =>
	w && typeof w.word === 'string' && w.word.trim()
		? {
				word: w.word.trim(),
				romanization: String(w.romanization ?? '').trim(),
				sounds: String(w.sounds ?? '').trim(),
				ipa: String(w.ipa ?? '').trim(),
				meaning: String(w.meaning ?? '').trim(),
				emoji: String(w.emoji ?? '').trim().slice(0, 8)
			}
		: null;

/**
 * New words in a category for a level (none the learner already has), and a few "decoys": common
 * words from other categories, for "pick every word that's food" questions.
 */
export async function vocab(locale: string, category: string, level: number, known: string[], explainIn: string, count = 8): Promise<{ words: VocabWord[]; decoys: VocabWord[] }> {
	const lang = languageOf(locale);
	const explain = TRANSLATE_OPTIONS.find((o) => o.lang === explainIn)?.label ?? 'English';
	const brief = VOCAB_LEVELS[Math.min(Math.max(level, 1), VOCAB_LEVELS.length) - 1];
	const out = await text(
		`You are a friendly ${lang} teacher making vocabulary flash cards.`,
		[
			{
				role: 'user',
				parts: [
					{
						text:
							`Give ${count} ${lang} (${locale}) words in the category "${category}", for level ${level}: ${brief}. ` +
							`Single words (or a short compound where that's how it's said), each with a clearly different meaning. ` +
							`Write each as natives write it. Give: "romanization" (only for languages not written in Latin letters, else ""), ` +
							`"sounds" (an easy sound-it-out spelling for an English speaker, syllables split with hyphens and the stressed ` +
							`syllable in CAPITALS; mark tones for tonal languages), "ipa", "meaning" (in ${explain}, one to three words), and ` +
							`"emoji" (one emoji that pictures it, or "" if none fits). ` +
							`Also give 4 "decoys": common, easy ${lang} words that are clearly NOT in "${category}" (from other everyday ` +
							`topics), in the same fields. ` +
							(known.length ? `Don't repeat any of these words: ${known.slice(-120).join(' | ')}.` : '')
					}
				]
			}
		],
		VOCAB_SCHEMA,
		5000
	);
	const j = JSON.parse(out) as { words?: Partial<VocabWord>[]; decoys?: Partial<VocabWord>[] };
	const seen = new Set<string>();
	const clean = (list: Partial<VocabWord>[] | undefined) =>
		(Array.isArray(list) ? list : [])
			.map(wordOf)
			.filter((w): w is VocabWord => !!w && !seen.has(w.word.toLowerCase()) && !!seen.add(w.word.toLowerCase()));
	const words = clean(j.words).slice(0, count);
	return { words, decoys: clean(j.decoys).slice(0, 4) };
}

const tipsOf = (v: unknown): Phrase['tips'] =>
	(Array.isArray(v) ? v : []).slice(0, 3).map((t) => ({ word: String(t?.word ?? ''), soundsLike: String(t?.soundsLike ?? ''), how: String(t?.how ?? '') }));

/**
 * The learner tried to say `target`: each of its words with a score (0 if left out or wrong), what
 * was heard, and an overall score.
 *
 * Listened to blind: the model isn't told the target (told it, it "hears" the phrase it expects,
 * filling in missing words and passing mispronunciations). What was heard is then lined up with the
 * target here: a word said right keeps its pronunciation score, a near miss (spelled nearly the
 * same) is capped, and a word that's missing or different scores 0.
 */
export async function assess(
	audioBase64: string,
	mimeType: string,
	locale: string,
	target: string
): Promise<{ heard: string; words: { w: string; s: number }[]; score: number }> {
	const heardNow = await transcribe(audioBase64, mimeType, locale);
	const heard = heardNow.text;
	const words = noSpaces(locale) ? alignChars(target, heardNow.words) : alignWords(target, heardNow.words);
	const score = words.length ? Math.round(words.reduce((n, x) => n + x.s, 0) / words.length) : 0;
	return { heard, words, score };
}

/** A near miss (a word recognisable but not quite right) scores at most this. */
const NEAR_MISS = 70;
const bare = (w: string) => w.toLocaleLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}']/gu, '');

/** How alike two words are, 0–1 (edit distance). */
function likeness(a: string, b: string): number {
	if (a === b) return 1;
	if (!a.length || !b.length) return 0;
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = cur;
	}
	return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/** Line the heard words up with the target's, in order (languages with spaces). */
function alignWords(target: string, heard: { w: string; s: number }[]): { w: string; s: number }[] {
	const pool = heard.map((h) => ({ key: bare(h.w), s: h.s }));
	let from = 0;
	return target
		.split(/\s+/)
		.filter((w) => bare(w))
		.map((w) => {
			const key = bare(w);
			// The next heard word that matches (looking a few words ahead, for skipped or extra words).
			for (let i = from; i < Math.min(pool.length, from + 4); i++) {
				if (pool[i].key === key) {
					from = i + 1;
					return { w, s: pool[i].s };
				}
			}
			for (let i = from; i < Math.min(pool.length, from + 2); i++) {
				if (likeness(pool[i].key, key) >= 0.6) {
					from = i + 1;
					return { w, s: Math.min(pool[i].s, NEAR_MISS) };
				}
			}
			return { w, s: 0 };
		});
}

/** Chinese and Japanese: line up character by character (each heard character takes its word's score). */
function alignChars(target: string, heard: { w: string; s: number }[]): { w: string; s: number }[] {
	const chars: { c: string; s: number }[] = [];
	for (const h of heard) for (const c of bare(h.w)) chars.push({ c, s: h.s });
	let from = 0;
	return [...bare(target)].map((c) => {
		for (let i = from; i < Math.min(chars.length, from + 4); i++) {
			if (chars[i].c === c) {
				from = i + 1;
				return { w: c, s: chars[i].s };
			}
		}
		return { w: c, s: 0 };
	});
}

/** How to say one word: a sound-it-out spelling, IPA and a tip (for words marked down in a chat). */
export async function pronounce(word: string, locale: string, explainIn: string): Promise<{ sounds: string; ipa: string; how: string }> {
	const lang = languageOf(locale);
	const explain = TRANSLATE_OPTIONS.find((o) => o.lang === explainIn)?.label ?? 'English';
	const out = await text(
		`You are a friendly ${lang} pronunciation coach.`,
		[
			{
				role: 'user',
				parts: [
					{
						text:
							`How do you pronounce the ${lang} word ${JSON.stringify(word)}? Give "sounds" (an easy sound-it-out spelling for an ` +
							`English speaker, syllables split with hyphens, the stressed one in CAPITALS, tones marked for tonal languages), "ipa", ` +
							`and "how": one or two short sentences in ${explain} on how to make the tricky sound (lips, tongue, tone).`
					}
				]
			}
		],
		{ type: 'OBJECT', properties: { sounds: { type: 'STRING' }, ipa: { type: 'STRING' }, how: { type: 'STRING' } }, required: ['sounds', 'ipa', 'how'] }
	);
	const j = JSON.parse(out) as { sounds?: string; ipa?: string; how?: string };
	return { sounds: String(j.sounds ?? ''), ipa: String(j.ipa ?? ''), how: String(j.how ?? '') };
}

// ── Phonetics (under a chat bubble) ────────────────────────────────────────────────

/** How to say a whole message, word by word: a sound-it-out spelling and IPA for each word. */
export async function phonetics(textIn: string, locale: string): Promise<{ romanization: string; words: { word: string; sounds: string; ipa: string }[] }> {
	const lang = languageOf(locale);
	const out = await text(
		`You are a friendly ${lang} pronunciation coach.`,
		[
			{
				role: 'user',
				parts: [
					{
						text:
							`Show a learner how to pronounce this ${lang} message, word by word (for Chinese or Japanese, short words): ` +
							`${JSON.stringify(textIn)}. For each word give "word" (as written), "sounds" (an easy sound-it-out spelling for an ` +
							`English speaker, syllables split with hyphens, the stressed one in CAPITALS, tones marked for tonal languages) and ` +
							`"ipa". Skip punctuation. Also give "romanization" for the whole message if ${lang} isn't written in Latin letters ` +
							`(pinyin, jyutping, romaji, revised romanization…), else "".`
					}
				]
			}
		],
		{
			type: 'OBJECT',
			properties: {
				romanization: { type: 'STRING' },
				words: {
					type: 'ARRAY',
					items: {
						type: 'OBJECT',
						properties: { word: { type: 'STRING' }, sounds: { type: 'STRING' }, ipa: { type: 'STRING' } },
						required: ['word', 'sounds', 'ipa']
					}
				}
			},
			required: ['romanization', 'words']
		},
		3000
	);
	const j = JSON.parse(out) as { romanization?: string; words?: { word: string; sounds: string; ipa: string }[] };
	const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	return {
		romanization: str(j.romanization),
		words: (j.words ?? []).filter((w) => str(w.word)).slice(0, 80).map((w) => ({ word: str(w.word), sounds: str(w.sounds), ipa: str(w.ipa).replace(/^\/|\/$/g, '') }))
	};
}

// ── Dictionary ─────────────────────────────────────────────────────────────────────

export interface DictEntry {
	/** The word in the language being learned. */
	word: string;
	romanization: string;
	sounds: string;
	ipa: string;
	partOfSpeech: string;
	/** What this sense means (in the learner's language), to tell senses apart. */
	sense: string;
	example: string;
	exampleTranslation: string;
}

/** A word (or short phrase) in the learner's language, in the language they're learning. */
export async function lookUp(word: string, from: string, locale: string): Promise<DictEntry[]> {
	const lang = languageOf(locale);
	const own = TRANSLATE_OPTIONS.find((o) => o.lang === from)?.label ?? 'English';
	const out = await text(
		`You are a bilingual ${own}–${lang} dictionary for language learners.`,
		[
			{
				role: 'user',
				parts: [
					{
						text:
							`Translate the ${own} word or phrase ${JSON.stringify(word)} into ${lang} (${locale}). Give up to 3 entries, one per ` +
							`common meaning (just 1 if it has one meaning), most common first. For each: "word" (as natives write it), ` +
							`"romanization" (only for languages not written in Latin letters, else ""), "sounds" (an easy sound-it-out ` +
							`spelling for an English speaker, syllables split with hyphens, the stressed one in CAPITALS, tones marked for ` +
							`tonal languages), "ipa", "partOfSpeech" (in ${own}), "sense" (a few words in ${own} saying which meaning this is), ` +
							`"example" (a short, everyday ${lang} sentence using it) and "exampleTranslation" (in ${own}). If it isn't a real ` +
							`word, give your best guess at what was meant.`
					}
				]
			}
		],
		{
			type: 'OBJECT',
			properties: {
				entries: {
					type: 'ARRAY',
					items: {
						type: 'OBJECT',
						properties: {
							word: { type: 'STRING' },
							romanization: { type: 'STRING' },
							sounds: { type: 'STRING' },
							ipa: { type: 'STRING' },
							partOfSpeech: { type: 'STRING' },
							sense: { type: 'STRING' },
							example: { type: 'STRING' },
							exampleTranslation: { type: 'STRING' }
						},
						required: ['word', 'romanization', 'sounds', 'ipa', 'partOfSpeech', 'sense', 'example', 'exampleTranslation']
					}
				}
			},
			required: ['entries']
		},
		3000
	);
	const j = JSON.parse(out) as { entries?: Partial<DictEntry>[] };
	const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	return (j.entries ?? [])
		.filter((e) => str(e.word))
		.slice(0, 3)
		.map((e) => ({
			word: str(e.word),
			romanization: str(e.romanization),
			sounds: str(e.sounds),
			ipa: str(e.ipa),
			partOfSpeech: str(e.partOfSpeech),
			sense: str(e.sense),
			example: str(e.example),
			exampleTranslation: str(e.exampleTranslation)
		}));
}

/**
 * The words spoken in the character's own voice, as a WAV file. Only the words are sent: an
 * instruction in the prompt ("speak slowly…") sometimes gets read out too, so the language goes in
 * the speech settings and slow playback is done by the player.
 */
export async function speak(textIn: string, voice: string, locale: string): Promise<Buffer> {
	let lastErr: unknown;
	for (const model of TTS_MODELS) {
		// With the language set, then (should a model not take that language code) without it.
		for (const languageCode of [locale, undefined]) {
			try {
				const { parts } = await call(model, {
					contents: [{ parts: [{ text: textIn }] }],
					generationConfig: {
						responseModalities: ['AUDIO'],
						speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }, ...(languageCode ? { languageCode } : {}) }
					}
				});
				const audio = parts.find((p) => p.inlineData)?.inlineData;
				if (!audio) throw new LlmError('other', 'No audio returned');
				const data = Buffer.from(audio.data, 'base64');
				return /wav/i.test(audio.mimeType) ? data : pcmToWav(data, Number(/rate=(\d+)/.exec(audio.mimeType)?.[1]) || 24_000);
			} catch (err) {
				lastErr = err;
				// Out of quota or busy: on to the next model, not this one again.
				if (!(err instanceof LlmError) || err.kind !== 'other') break;
			}
		}
	}
	throw lastErr;
}

/** Raw 16-bit mono PCM → a WAV file. */
function pcmToWav(pcm: Buffer, rate: number): Buffer {
	const h = Buffer.alloc(44);
	h.write('RIFF', 0);
	h.writeUInt32LE(36 + pcm.length, 4);
	h.write('WAVEfmt ', 8);
	h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20); // PCM
	h.writeUInt16LE(1, 22); // mono
	h.writeUInt32LE(rate, 24);
	h.writeUInt32LE(rate * 2, 28);
	h.writeUInt16LE(2, 32);
	h.writeUInt16LE(16, 34);
	h.write('data', 36);
	h.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([h, pcm]);
}
