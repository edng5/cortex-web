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
	blockdrop: { boards: [1], max: 50_000_000 },
	// FishMart has no high scores; it's listed so its progress can be saved to accounts.
	ifish: { boards: [] as number[], max: 0 },
	// iSpy has no public leaderboard; listed so its progress saves to accounts.
	ispy: { boards: [1], max: 20_000_000 },
	// Check-up keeps its progress (look, stats, ladder, shot templates) in the account; no high scores.
	checkup: { boards: [] as number[], max: 0 },
	// Keyboard Karaoke keeps its song book (favourites, queue, best grades, lyric timings) in the account.
	karaoke: { boards: [] as number[], max: 0 },
	// Online games: ratings are kept separately (ratings.ts); listed so their themes save to accounts.
	chess: { boards: [] as number[], max: 0 },
	fourrow: { boards: [] as number[], max: 0 }
} as const;
export type GameId = keyof typeof GAMES;
export const isGame = (g: string): g is GameId => Object.hasOwn(GAMES, g);

export interface BoardEntry {
	name: string;
	score: number;
	/** The level the score was reached at (games with levels and one board: Block Drop, iSpy). */
	level?: number | null;
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

/** Keep the player's best score on this board (and the level it was reached at). Returns their best after this run. */
export function submitScore(userId: string, game: GameId, board: number, score: number, level: number | null = null): number {
	const db = getDb();
	db.prepare(
		`INSERT INTO game_scores (user_id, game, mission, best, level, updated_at) VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, game, mission) DO UPDATE SET
		   level = CASE WHEN excluded.best > best THEN excluded.level ELSE level END,
		   updated_at = CASE WHEN excluded.best > best THEN excluded.updated_at ELSE updated_at END,
		   best = MAX(best, excluded.best)`
	).run(userId, game, board, score, level, Date.now());
	db.prepare(
		`INSERT INTO game_monthly (user_id, game, mission, month, best, level, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, game, mission, month) DO UPDATE SET
		   level = CASE WHEN excluded.best > best THEN excluded.level ELSE level END,
		   updated_at = CASE WHEN excluded.best > best THEN excluded.updated_at ELSE updated_at END,
		   best = MAX(best, excluded.best)`
	).run(userId, game, board, monthOf(Date.now()), score, level, Date.now());
	const row = db.prepare('SELECT best FROM game_scores WHERE user_id = ? AND game = ? AND mission = ?').get(userId, game, board) as
		| { best: number }
		| undefined;
	return row?.best ?? score;
}

const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

type Row = { score: number; level: number | null; email_enc: string; name: string | null };
const entry = (r: Row): BoardEntry => ({ name: rowName(r), score: r.score, ...(r.level != null ? { level: r.level } : {}) });

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
// (SQLite: with MAX(), the bare `level` comes from the best row.)
const ALL_TIME = `(SELECT user_id, game, mission, MAX(best) AS best, level, MIN(updated_at) AS updated_at FROM (
	SELECT user_id, game, mission, best, level, updated_at FROM game_scores
	UNION ALL SELECT user_id, game, mission, best, level, updated_at FROM game_monthly
) GROUP BY user_id, game, mission)`;

/** Every board's all-time top 3 (the best scores ever, every month included). */
export function getAllTime(): Monthly {
	const db = getDb();
	const leader = db.prepare(
		`SELECT s.best AS score, s.level AS level, u.email_enc AS email_enc, p.name AS name
		 FROM ${ALL_TIME} s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC LIMIT 3`
	);
	const games = {} as Monthly['games'];
	for (const game of Object.keys(GAMES) as GameId[]) {
		const boards: Record<number, BoardEntry | null> = {};
		const top: Record<number, BoardEntry[]> = {};
		for (const b of GAMES[game].boards) {
			top[b] = (leader.all(game, b) as Row[]).map(entry);
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
		`SELECT s.best AS score, s.level AS level, u.email_enc AS email_enc, p.name AS name
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
			top[b] = m ? (leader.all(game, m, b) as Row[]).map(entry) : [];
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
		`SELECT s.best AS score, s.level AS level, u.email_enc AS email_enc, p.name AS name
		 FROM ${table} s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0${extra}
		 ORDER BY s.best DESC, s.updated_at ASC
		 LIMIT ?`
	);
	const missions: Record<number, BoardEntry[]> = {};
	for (const m of GAMES[game].boards) {
		missions[m] = (top.all(game, m, ...args, limit) as Row[]).map(entry);
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
