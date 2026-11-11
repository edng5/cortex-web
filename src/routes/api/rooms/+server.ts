// POST /api/rooms { game, ranked?, first?, takebacks?, clock? } → { code }: an online room for the
// signed-in player. Chess and Four in a Row: ranked finds an opponent (or waits for one; rated,
// random first move, 10 minutes each), otherwise a custom room with the host's settings (unrated)
// that a friend joins with its code. Fishy rooms are rated.
import { error, json } from '@sveltejs/kit';
import { CLOCK_CHOICES, createRoom, findRanked, type RoomSettings } from '$lib/server/rooms';
import { isRatedGame } from '$lib/server/ratings';
import { roomPlayer } from '$lib/server/room-player';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to play online.');
	const body = await request.json().catch(() => null);
	const game = String(body?.game ?? '');
	if (!isRatedGame(game)) error(400, 'Unknown game.');
	if (!rateLimit(`room-create:${locals.user.id}`, 30, 10 * 60_000)) error(429, 'Too many rooms, slow down.');
	const player = roomPlayer(locals.user);
	// Real-time games (run in the host's browser): rated rooms by code.
	if (game == 'fishy' || game == 'checkup') return json({ code: createRoom(game, player, { rated: true, matchmade: false, first: 'random', takebacks: false, clockMin: 0 }) });
	if (body?.ranked === true) return json({ code: findRanked(game, player) });
	const first = ['host', 'guest', 'random'].includes(body?.first) ? (body.first as RoomSettings['first']) : 'random';
	const clockMin = CLOCK_CHOICES.includes(Number(body?.clock)) ? Number(body.clock) : 0;
	return json({ code: createRoom(game, player, { rated: false, matchmade: false, first, takebacks: body?.takebacks === true, clockMin }) });
};
