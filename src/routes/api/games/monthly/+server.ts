// GET /api/games/monthly[?period=all] → this month's high-score leader on every E.Ngine Games board
// (a game nobody has played this month shows its most recent month with scores), or with
// period=all, every board's all-time leader.
import { json } from '@sveltejs/kit';
import { getAllTime, getMonthly, periodOf } from '$lib/server/scores';
import { keysConfigured } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, setHeaders }) => {
	const period = periodOf(url.searchParams.get('period'));
	if (!keysConfigured()) return json({ period, month: new Date().toISOString().slice(0, 7), games: {} });
	setHeaders({ 'cache-control': 'no-store' });
	return json(period === 'all' ? getAllTime() : getMonthly());
};
