// An online room (see $lib/server/rooms.ts), for its two signed-in players only.
// GET  /api/rooms/:code → the room's live events (server-sent events), starting with the room now.
// POST /api/rooms/:code { type: 'join', game } → take the free seat.
// POST /api/rooms/:code { type: 'move' | 'resign' | 'draw' | 'rematch' | 'leave' | 'relay' | 'result', … }
import { error, json } from '@sveltejs/kit';
import { act, joinRoom, subscribe } from '$lib/server/rooms';
import { roomPlayer } from '$lib/server/room-player';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const validCode = (c: string) => /^\d{6}$/.test(c);

export const GET: RequestHandler = ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Log in to play online.');
	if (!validCode(params.code)) error(404, 'No such room.');
	const enc = new TextEncoder();
	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	const userId = locals.user.id;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let open = true;
			const end = () => {
				if (!open) return;
				open = false;
				clearInterval(heartbeat);
				unsubscribe?.();
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			unsubscribe = subscribe(params.code, userId, {
				send: (e) => open && controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)),
				close: end
			});
			if (!unsubscribe) {
				controller.enqueue(enc.encode(`data: ${JSON.stringify({ t: 'closed' })}\n\n`));
				open = false;
				controller.close();
				return;
			}
			// Keeps the connection open through proxies.
			heartbeat = setInterval(() => open && controller.enqueue(enc.encode(': ping\n\n')), 15_000);
			request.signal.addEventListener('abort', end);
		},
		cancel() {
			clearInterval(heartbeat);
			unsubscribe?.();
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' }
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Log in to play online.');
	if (!validCode(params.code)) error(404, 'No room with that code. Check it and try again.');
	const text = await request.text();
	if (text.length > 4096) error(413, 'Message too large.');
	let msg: Record<string, unknown>;
	try {
		msg = JSON.parse(text);
	} catch {
		error(400, 'Bad message.');
	}
	if (!msg || typeof msg != 'object') error(400, 'Bad message.');
	if (msg.type == 'join') {
		// Codes are 6 digits: cap how many a player can try.
		if (!rateLimit(`room-join:${locals.user.id}`, 20, 10 * 60_000)) error(429, 'Too many tries, wait a few minutes.');
		const r = joinRoom(params.code, roomPlayer(locals.user), typeof msg.game == 'string' ? msg.game : undefined);
		if (!r.ok) error(r.status, r.message);
		return json(r);
	}
	const r = act(params.code, locals.user.id, msg);
	if (!r.ok) error(r.status, r.message);
	return json({ ok: true });
};
