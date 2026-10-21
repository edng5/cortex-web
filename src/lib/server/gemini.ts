// Gemini (Google AI Studio / Generative Language API) streaming, via plain fetch + SSE.
// Used by llm.ts when CORTEX_PROVIDER=gemini, or when only GEMINI_API_KEY is set.
import { env } from '$env/dynamic/private';
import { LlmError } from './llm-error';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const geminiModel = () => env.GEMINI_MODEL || 'gemini-flash-lite-latest';

export interface GeminiTurn {
	role: 'user' | 'model';
	text: string;
}

/**
 * Streams visible answer text (thought parts are skipped). Throws LlmError for
 * rate limits, bad keys and safety blocks, so the caller can react to each.
 */
export async function* streamGemini(opts: {
	system: string;
	turns: GeminiTurn[];
	signal?: AbortSignal;
}): AsyncGenerator<string> {
	const key = env.GEMINI_API_KEY;
	if (!key) throw new LlmError('auth', 'GEMINI_API_KEY is not set');

	const res = await fetch(`${API}/${geminiModel()}:streamGenerateContent?alt=sse`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: opts.system }] },
			contents: opts.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
			generationConfig: {
				maxOutputTokens: 2048,
				// Keep voice latency down; GEMINI_THINKING=minimal|low|medium|high.
				thinkingConfig: { thinkingLevel: env.GEMINI_THINKING || 'low' }
			}
		}),
		signal: opts.signal
	});

	if (!res.ok || !res.body) {
		const detail = (await res.text().catch(() => '')).slice(0, 300);
		if (res.status === 429 || res.status === 503) throw new LlmError('rate_limit', detail);
		if (res.status === 401 || res.status === 403) throw new LlmError('auth', detail);
		throw new LlmError('other', `Gemini HTTP ${res.status}: ${detail}`);
	}

	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += value;
		let nl: number;
		while ((nl = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, nl).trim();
			buf = buf.slice(nl + 1);
			if (!line.startsWith('data:')) continue;
			const chunk = JSON.parse(line.slice(5));
			if (chunk.promptFeedback?.blockReason) throw new LlmError('blocked', chunk.promptFeedback.blockReason);
			const cand = chunk.candidates?.[0];
			for (const part of cand?.content?.parts ?? []) {
				if (!part.thought && typeof part.text === 'string' && part.text) yield part.text;
			}
			const finish = cand?.finishReason;
			if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST' || finish === 'SPII') {
				throw new LlmError('blocked', finish);
			}
		}
	}
}
