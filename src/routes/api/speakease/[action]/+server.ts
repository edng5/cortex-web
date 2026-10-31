// SpeakEase AI (web edition) API, one route per thing the app's backend did:
//   POST /api/speakease/listen?botId=…&locale=…   (body: the recording) → { text, words: [{ w, s }] }
//   POST /api/speakease/reply     { botId, locale, turns, scenario? }    → { text }
//   POST /api/speakease/speak     { botId, locale, text, slow? }        → audio/wav (Easso's voice; others are Cortex)
//   POST /api/speakease/correct   { text }                               → { text }
//   POST /api/speakease/suggest   { turns }                              → { text }
//   POST /api/speakease/translate { text, to }                           → { text }
// Phrase Quest (the phrase-learning game) and pronunciation guides:
//   POST /api/speakease/phrases   { locale, level, known, explainIn }    → { phrases: [...] }
//   POST /api/speakease/attempt?botId=…&locale=…&target=…  (body: the recording) → { heard, words, score }
//   POST /api/speakease/pronounce { word, locale, explainIn }           → { sounds, ipa, how }
//   POST /api/speakease/dictionary { word, from, locale }               → { entries: [...] }
//   POST /api/speakease/phonetics  { text, locale }                     → { romanization, words: [{ word, sounds, ipa }] }
// Open to everyone (like the app), so it's rate limited per visitor. Signed-in players are called
// by their site nickname (looked up here, never taken from the page).
import { error, json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/ratelimit';
import { LlmError } from '$lib/server/llm-error';
import { assess, correct, lookUp, phonetics, phrases, pronounce, reply, speak, suggest, transcribe, translate, type Turn } from '$lib/server/speakease';
import { getPlayerName } from '$lib/server/player-name';
import { EASSO_VOICE, LANGUAGE_NAMES, TRANSLATE_OPTIONS, friendById, scenarioById } from '$lib/speakease/data';
import type { RequestHandler } from './$types';

const MAX_TEXT = 1000;
const MAX_TARGET = 300;
const MAX_TURNS = 60;
/** A minute or so of speech in the browser's compressed formats (or ~15 s of WAV). */
const MAX_AUDIO = 480_000;
const AUDIO_TYPES = ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/flac'];

const who = (botId: unknown) => {
	const c = typeof botId === 'string' ? (friendById(botId) ?? scenarioById(botId)) : null;
	if (!c) error(400, 'No such character.');
	return { c, scenario: !friendById(c.id) };
};
const locale = (v: unknown) => {
	if (typeof v !== 'string' || !(v in LANGUAGE_NAMES)) error(400, 'No such language.');
	return v;
};
const textOf = (v: unknown) => {
	if (typeof v !== 'string' || !v.trim() || v.length > MAX_TEXT) error(400, 'Invalid text.');
	return v.trim();
};
const turnsOf = (v: unknown): Turn[] => {
	if (!Array.isArray(v) || v.length > MAX_TURNS) error(400, 'Invalid chat.');
	return v.map((t) => {
		if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.text !== 'string' || t.text.length > MAX_TEXT) error(400, 'Invalid chat.');
		return { role: t.role, text: t.text };
	});
};

export const POST: RequestHandler = async ({ params, request, url, getClientAddress, locals }) => {
	// Per visitor: plenty for a real conversation, not for scripted abuse of the key.
	const visitor = locals.user?.id ?? locals.visitorId ?? getClientAddress();
	if (!rateLimit(`speakease:${visitor}`, 120, 10 * 60_000) || !rateLimit(`speakease-ip:${getClientAddress()}`, 240, 10 * 60_000)) {
		error(429, 'Easso needs a little break. Please try again in a few minutes.');
	}

	const nickname = locals.user ? getPlayerName(locals.user.id) : null;
	const recording = async () => {
		const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
		if (!AUDIO_TYPES.includes(type)) error(415, 'Unsupported audio.');
		const audio = Buffer.from(await request.arrayBuffer());
		if (audio.length > MAX_AUDIO) error(413, 'That recording is too long. Try a shorter sentence.');
		return { type, audio };
	};
	const explainIn = (v: unknown) => (TRANSLATE_OPTIONS.some((o) => o.lang === v) ? (v as string) : 'en');

	try {
		if (params.action === 'attempt') {
			who(url.searchParams.get('botId'));
			const loc = locale(url.searchParams.get('locale'));
			const target = url.searchParams.get('target') ?? '';
			if (!target.trim() || target.length > MAX_TARGET) error(400, 'Invalid phrase.');
			const { type, audio } = await recording();
			if (!audio.length) return json({ heard: '', words: [], score: 0 });
			return json(await assess(audio.toString('base64'), type, loc, target.trim()));
		}
		if (params.action === 'listen') {
			const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
			if (!AUDIO_TYPES.includes(type)) error(415, 'Unsupported audio.');
			who(url.searchParams.get('botId'));
			const loc = locale(url.searchParams.get('locale'));
			const audio = Buffer.from(await request.arrayBuffer());
			if (!audio.length) return json({ text: '', words: [] });
			if (audio.length > MAX_AUDIO) error(413, 'That recording is too long. Try a shorter sentence.');
			return json(await transcribe(audio.toString('base64'), type, loc));
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') error(400, 'Invalid request.');
		switch (params.action) {
			case 'reply': {
				const { c, scenario } = who(body.botId);
				// Scenario characters are Cortex too (male).
				return json({ text: await reply(c.id, 'gender' in c ? c.gender : 'male', locale(body.locale), turnsOf(body.turns), scenario, nickname) });
			}
			case 'speak': {
				// Only Easso has a Gemini voice: everyone else is Cortex, who speaks with the browser's voice.
				const { c } = who(body.botId);
				if (c.id !== '0') error(400, 'This character speaks with Cortex’s voice.');
				const wav = await speak(textOf(body.text), EASSO_VOICE, locale(body.locale), body.slow === true);
				return new Response(new Uint8Array(wav), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
			}
			case 'correct':
				return json({ text: await correct(textOf(body.text)) });
			case 'suggest':
				return json({ text: await suggest(turnsOf(body.turns)) });
			case 'phrases': {
				const level = Number(body.level);
				if (!Number.isInteger(level) || level < 1 || level > 99) error(400, 'Invalid level.');
				const known = Array.isArray(body.known) ? body.known.filter((k: unknown) => typeof k === 'string' && k.length <= MAX_TARGET).slice(-80) : [];
				return json({ phrases: await phrases(locale(body.locale), level, known, explainIn(body.explainIn)) });
			}
			case 'pronounce': {
				const word = typeof body.word === 'string' ? body.word.trim() : '';
				if (!word || word.length > 60) error(400, 'Invalid word.');
				return json(await pronounce(word, locale(body.locale), explainIn(body.explainIn)));
			}
			case 'phonetics':
				return json(await phonetics(textOf(body.text), locale(body.locale)));
			case 'dictionary': {
				const word = typeof body.word === 'string' ? body.word.trim() : '';
				if (!word || word.length > 80) error(400, 'Type a word to look up.');
				return json({ entries: await lookUp(word, explainIn(body.from), locale(body.locale)) });
			}
			case 'translate': {
				if (!TRANSLATE_OPTIONS.some((o) => o.lang === body.to)) error(400, 'No such language.');
				return json({ text: await translate(textOf(body.text), body.to) });
			}
			default:
				error(404, 'Not found.');
		}
	} catch (err) {
		if (err instanceof LlmError) {
			console.error(`[speakease] ${params.action}: ${err.kind}`, err.message);
			if (err.kind === 'rate_limit' && params.action === 'speak') error(503, 'Voices are taking a break right now, so replies are text only for a while.');
			if (err.kind === 'rate_limit') error(503, 'SpeakEase is busy right now. Please try again in a moment.');
			if (err.kind === 'blocked') error(422, "Sorry, I can't help with that one.");
			error(502, 'Something went wrong. Please try again.');
		}
		throw err;
	}
};
