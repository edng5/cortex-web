// POST /api/ask  { question: string, history?: ChatTurn[] }
// → text/event-stream of AskEvent JSON lines (quota → sources → focus → delta… → done)
//
// Order of checks: chat lockout → burst rate limit → question quota → blocked terms → model.
// Guardrails: blocked terms or a question the model classifies as inappropriate disable chat
// for the visitor; off-topic questions get the persona's fixed refusal.
// Every prompt is written to the encrypted audit log (90-day retention).
import Anthropic from '@anthropic-ai/sdk';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { visibleNodes } from '$lib/server/content';
import { retrieve } from '$lib/server/rag';
import { sanitizeHistory, streamCortexAnswer } from '$lib/server/llm';
import { LlmError } from '$lib/server/llm-error';
import { rateLimit } from '$lib/server/ratelimit';
import { loadPersona } from '$lib/server/persona';
import { blockVisitor, blockedFor, hitsBlockedTerm } from '$lib/server/guard';
import { consumeQuota, quotaStatus, refundQuota } from '$lib/server/quota';
import { keysConfigured } from '$lib/server/crypto';
import { audit } from '$lib/server/audit';
import { BusyError, answerSlots, claimVisitorStream, queueTimeoutMs } from '$lib/server/concurrency';
import type { AskEvent } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_QUESTION_CHARS = 500;

function sse(events: AskEvent[]): Response {
	const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
	return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const ip = getClientAddress();
	const user = locals.user;
	const persona = loadPersona();
	const who = { userId: user?.id ?? null, email: user?.email ?? null, ip };

	const left = blockedFor(ip);
	if (left > 0) {
		return json({ message: persona.blockedMessage, blocked: true, until: Date.now() + left }, { status: 403 });
	}

	const limit = Number(env.CORTEX_RATE_LIMIT || 20);
	if (!rateLimit(ip, limit)) error(429, 'Too many questions — give Cortex a minute to rest.');

	const body = await request.json().catch(() => null);
	const question = typeof body?.question === 'string' ? body.question.trim() : '';
	if (!question) error(400, 'Missing question');
	if (question.length > MAX_QUESTION_CHARS) error(400, 'Question is too long');
	const history = sanitizeHistory(body?.history);

	// Question quota (requires the encryption keys; see `npm run gen-keys`).
	if (!keysConfigured()) error(503, 'Cortex is not fully configured yet (missing AUTH keys).');
	const status = quotaStatus(user, ip);
	if (!status.unlimited && status.remaining <= 0) {
		audit('quota_exceeded', { ...who, detail: { limit: status.limit, period: status.period } });
		const message = status.loggedIn
			? `You've used all ${status.limit} of today's questions. Come back tomorrow for more!`
			: `You've used your ${status.limit} free questions. Log in to keep chatting with ${persona.name} (${env.QUOTA_USER_DAILY || 10} questions a day).`;
		return json({ quotaExceeded: true, quota: status, message }, { status: 429 });
	}
	const quota = consumeQuota(user, ip);

	// Instant pre-filter: configured blocked terms never reach the model.
	if (hitsBlockedTerm(question, persona.blockedTerms)) {
		const until = blockVisitor(ip);
		audit('chat_blocked', { ...who, detail: { question, reason: 'blocked_term' } });
		return sse([
			{ type: 'quota', quota },
			{ type: 'blocked', message: persona.blockedMessage, until }
		]);
	}

	// Only what this visitor may see (members-only nodes are hidden from everyone else).
	const nodes = visibleNodes(!!user?.isMember);
	const allowed = new Set(nodes.map((n) => n.id));
	const abort = new AbortController();
	request.signal.addEventListener('abort', () => abort.abort());
	// One live answer per visitor (account, or per-browser cookie): a newer question from the
	// same visitor cancels their older stream; other visitors are never affected.
	const unclaim = claimVisitorStream(user ? `u:${user.id}` : `v:${locals.visitorId}`, abort);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const enc = new TextEncoder();
			const send = (e: AskEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
			send({ type: 'quota', quota });
			let releaseSlot: (() => void) | undefined;
			let answered = false; // any answer text sent yet?

			try {
				// Global limit on answers generated at once; extra requests wait their turn.
				if (answerSlots.full) send({ type: 'queued', position: answerSlots.queued + 1 });
				releaseSlot = await answerSlots.acquire(abort.signal, queueTimeoutMs());

				// Retrieval: include the previous question so follow-ups ("what about his
				// second one?") still find the right material.
				const lastUser = [...history].reverse().find((t) => t.role === 'user')?.content ?? '';
				const { hits, nodeIds } = await retrieve(`${lastUser}\n${question}`.trim(), 8, allowed);

				const scope = await streamCortexAnswer({
					question,
					history,
					hits,
					nodes,
					persona,
					signal: abort.signal,
					handlers: {
						onFocus: (nodeId) => {
							// Only light up retrieved neurons once we know the question is on-topic.
							send({ type: 'sources', nodeIds });
							send({ type: 'focus', nodeId: nodeId ?? nodeIds[0] ?? null });
						},
						onText: (text) => {
							answered = true;
							send({ type: 'delta', text });
						}
					}
				});

				if (scope === 'inappropriate') {
					const until = blockVisitor(ip);
					audit('chat_blocked', { ...who, detail: { question, reason: 'model' } });
					send({ type: 'blocked', message: persona.blockedMessage, until });
				} else {
					audit('chat_prompt', { ...who, detail: { question, scope } });
					if (scope === 'off_topic') {
						send({ type: 'focus', nodeId: null });
						send({ type: 'delta', text: persona.refusal });
					}
				}
				send({ type: 'done' });
			} catch (err) {
				if (abort.signal.aborted) {
					// Cancelled (visitor left, or asked something newer) before any answer: give it back.
					if (!answered) refundQuota(user, ip);
					return;
				}
				if (err instanceof BusyError) {
					send({ type: 'quota', quota: refundQuota(user, ip) });
					send({ type: 'error', message: 'Cortex is busy with other visitors right now. Please try again in a moment.' });
					return;
				}
				console.error('[api/ask]', err);
				audit('chat_prompt', { ...who, detail: { question, scope: 'error' } });
				// A failed answer shouldn't cost the visitor a question.
				send({ type: 'quota', quota: refundQuota(user, ip) });
				let message = 'Cortex had a misfire. Please try again.';
				if (err instanceof Anthropic.RateLimitError) message = 'Cortex is busy right now — try again in a moment.';
				else if (err instanceof Anthropic.AuthenticationError) message = 'Cortex is not configured (bad API key).';
				else if (err instanceof LlmError && err.kind === 'rate_limit') message = 'Cortex is busy right now — try again in a moment.';
				else if (err instanceof LlmError && err.kind === 'auth') message = 'Cortex is not configured (bad API key).';
				send({ type: 'error', message });
			} finally {
				releaseSlot?.();
				unclaim();
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			}
		},
		cancel() {
			abort.abort();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};

/** GET /api/ask → is this visitor's chat disabled? (checked on page load) */
export const GET: RequestHandler = async ({ getClientAddress }) => {
	const left = blockedFor(getClientAddress());
	return json(
		left > 0 ? { blocked: true, until: Date.now() + left, message: loadPersona().blockedMessage } : { blocked: false }
	);
};
