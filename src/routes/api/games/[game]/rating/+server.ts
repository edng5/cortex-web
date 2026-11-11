// GET /api/games/:game/rating → the signed-in player's own rating (MMR) and win / loss / draw
// record for an online game. Private: not on the public leaderboards.
import { error, json } from '@sveltejs/kit';
import { getRating, isRatedGame } from '$lib/server/ratings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params, setHeaders }) => {
	if (!locals.user) error(401, 'Log in to see your rating.');
	if (!isRatedGame(params.game)) error(404, 'No such game.');
	setHeaders({ 'cache-control': 'no-store' });
	return json(getRating(locals.user.id, params.game));
};
