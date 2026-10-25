// GET /api/games/monthly → this month's high-score leader on every E.Ngine Games board (a game
// nobody has played this month shows its most recent month with scores).
import { json } from '@sveltejs/kit';
import { getMonthly } from '$lib/server/scores';
import { keysConfigured } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ setHeaders }) => {
	if (!keysConfigured()) return json({ month: new Date().toISOString().slice(0, 7), games: {} });
	setHeaders({ 'cache-control': 'no-store' });
	return json(getMonthly());
};
