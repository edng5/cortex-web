// Global high scores for E.Ngine Games (the in-browser games). Each signed-in player's best
// score per board is kept: Top Gun has one board per mission, Fishy one per difficulty, Pong ×
// Brick Breaker one per mode, Space Invaders one. Players appear under the leaderboard name they
// chose (player-name.ts), or else their login email, partly masked because the board is public
// (e.g. "edw•••@gmail.com").
import { getDb } from './db';
import { decrypt } from './crypto';

/** Boards per game, and a score far above anything reachable (higher = tampered, rejected). */
export const GAMES = {
	topgun: { boards: [1, 2, 3], max: 1_000_000 },
	fishy: { boards: [1, 2, 3], max: 50_000 },
	spaceinvaders: { boards: [1, 2, 3], max: 10_000_000 },
	frogger: { boards: [1, 2], max: 1_000_000 },
	pong: { boards: [1, 2], max: 100_000 },
	// FishMart has no high scores; it's listed so its progress can be saved to accounts.
	ifish: { boards: [] as number[], max: 0 }
} as const;
export type GameId = keyof typeof GAMES;
export const isGame = (g: string): g is GameId => Object.hasOwn(GAMES, g);

export interface BoardEntry {
	name: string;
	score: number;
}
/** Which leaderboard: this month's (UTC), or every score ever. */
export type Period = 'month' | 'all';
export const periodOf = (v: string | null): Period => (v === 'all' ? 'all' : 'month');

export interface Board {
	period: Period;
	/** Top players per board ("missions" for Top Gun's sake), best first. */
	missions: Record<number, BoardEntry[]>;
	/** The signed-in player's own bests in this period (absent when signed out). */
	you?: Record<number, number>;
}

export function maskEmail(email: string): string {
	const [local = '', domain = ''] = email.split('@');
	const shown = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
	return `${shown}•••@${domain}`;
}

/** Keep the player's best score on this board. Returns their best after this run. */
export function submitScore(userId: string, game: GameId, board: number, score: number): number {
	const db = getDb();
	db.prepare(
		`INSERT INTO game_scores (user_id, game, mission, best, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, game, mission) DO UPDATE SET
		   best = MAX(best, excluded.best),
		   updated_at = CASE WHEN excluded.best > best THEN excluded.updated_at ELSE updated_at END`
	).run(userId, game, board, score, Date.now());
	db.prepare(
		`INSERT INTO game_monthly (user_id, game, mission, month, best, updated_at) VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, game, mission, month) DO UPDATE SET
		   best = MAX(best, excluded.best),
		   updated_at = CASE WHEN excluded.best > best THEN excluded.updated_at ELSE updated_at END`
	).run(userId, game, board, monthOf(Date.now()), score, Date.now());
	const row = db.prepare('SELECT best FROM game_scores WHERE user_id = ? AND game = ? AND mission = ?').get(userId, game, board) as
		| { best: number }
		| undefined;
	return row?.best ?? score;
}

const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/** Display name for a board row: the chosen leaderboard name, else the masked email. */
function rowName(r: { name: string | null; email_enc: string }): string {
	if (r.name) return r.name;
	try {
		return maskEmail(decrypt(r.email_enc));
	} catch {
		return 'player'; // unreadable row (keys changed): keep the score, hide the name
	}
}

export interface Monthly {
	period: Period;
	/** The current month, 'YYYY-MM'. */
	month: string;
	/**
	 * Per game: the month shown (this one, or the latest with scores; null = never played, or the
	 * all-time board), each board's leader, and each board's top 3 (shown when a game is opened).
	 */
	games: Record<GameId, { month: string | null; boards: Record<number, BoardEntry | null>; top: Record<number, BoardEntry[]> }>;
}

/**
 * All-time scores: each player's best per board, from the all-time table and every month's board
 * (October 2026's included), so a score kept only on a monthly board still counts.
 */
const ALL_TIME = `(SELECT user_id, game, mission, MAX(best) AS best, MIN(updated_at) AS updated_at FROM (
	SELECT user_id, game, mission, best, updated_at FROM game_scores
	UNION ALL SELECT user_id, game, mission, best, updated_at FROM game_monthly
) GROUP BY user_id, game, mission)`;

/** Every board's all-time top 3 (the best scores ever, every month included). */
export function getAllTime(): Monthly {
	const db = getDb();
	const leader = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc, p.name AS name
		 FROM ${ALL_TIME} s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC LIMIT 3`
	);
	const games = {} as Monthly['games'];
	for (const game of Object.keys(GAMES) as GameId[]) {
		const boards: Record<number, BoardEntry | null> = {};
		const top: Record<number, BoardEntry[]> = {};
		for (const b of GAMES[game].boards) {
			top[b] = (leader.all(game, b) as { score: number; email_enc: string; name: string | null }[]).map((r) => ({ name: rowName(r), score: r.score }));
			boards[b] = top[b][0] ?? null;
		}
		games[game] = { month: null, boards, top };
	}
	return { period: 'all', month: monthOf(Date.now()), games };
}

/** This month's top 3 on every board; a game nobody has played this month shows its latest month with scores. */
export function getMonthly(): Monthly {
	const db = getDb();
	const month = monthOf(Date.now());
	const latest = db.prepare('SELECT MAX(month) AS m FROM game_monthly WHERE game = ? AND month <= ? AND best > 0');
	const leader = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc, p.name AS name
		 FROM game_monthly s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.month = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC LIMIT 3`
	);
	const games = {} as Monthly['games'];
	for (const game of Object.keys(GAMES) as GameId[]) {
		const m = (latest.get(game, month) as { m: string | null }).m;
		const boards: Record<number, BoardEntry | null> = {};
		const top: Record<number, BoardEntry[]> = {};
		for (const b of GAMES[game].boards) {
			top[b] = m ? (leader.all(game, m, b) as { score: number; email_enc: string; name: string | null }[]).map((r) => ({ name: rowName(r), score: r.score })) : [];
			boards[b] = top[b][0] ?? null;
		}
		games[game] = { month: m, boards, top };
	}
	return { period: 'month', month, games };
}

/** A game's top players per board, this month or all-time, and the signed-in player's own bests. */
export function getBoard(game: GameId, userId: string | null, period: Period = 'all', limit = 5): Board {
	const db = getDb();
	// The monthly table has one row per player per month; all-time is each player's best ever.
	const [table, extra, args] = period === 'month' ? ['game_monthly', ' AND s.month = ?', [monthOf(Date.now())]] : [ALL_TIME, '', []];
	const top = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc, p.name AS name
		 FROM ${table} s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0${extra}
		 ORDER BY s.best DESC, s.updated_at ASC
		 LIMIT ?`
	);
	const missions: Record<number, BoardEntry[]> = {};
	for (const m of GAMES[game].boards) {
		missions[m] = (top.all(game, m, ...args, limit) as { score: number; email_enc: string; name: string | null }[]).map((r) => ({
			name: rowName(r),
			score: r.score
		}));
	}
	const board: Board = { period, missions };
	if (userId) {
		const mine = db.prepare(`SELECT s.mission, s.best FROM ${table} s WHERE s.user_id = ? AND s.game = ?${extra}`).all(userId, game, ...args) as {
			mission: number;
			best: number;
		}[];
		board.you = Object.fromEntries(mine.map((r) => [r.mission, r.best]));
	}
	return board;
}
