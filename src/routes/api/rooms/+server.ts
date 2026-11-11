// POST /api/rooms { game } → { code }: a new online room (Chess, Four in a Row or Fishy) for the
// signed-in player, who waits there for someone to join with the code.
import { error, json } from '@sveltejs/kit';
import { createRoom } from '$lib/server/rooms';
import { isRatedGame } from '$lib/server/ratings';
import { roomPlayer } from '$lib/server/room-player';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to play online.');
	const body = await request.json().catch(() => null);
	const game = String(body?.game ?? '');
	if (!isRatedGame(game)) error(400, 'Unknown game.');
	if (!rateLimit(`room-create:${locals.user.id}`, 20, 10 * 60_000)) error(429, 'Too many rooms, slow down.');
	return json({ code: createRoom(game, roomPlayer(locals.user)) });
};
