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
	spaceinvaders: { boards: [1], max: 10_000_000 },
	pong: { boards: [1, 2], max: 100_000 }
} as const;
export type GameId = keyof typeof GAMES;
export const isGame = (g: string): g is GameId => Object.hasOwn(GAMES, g);

export interface BoardEntry {
	name: string;
	score: number;
}
export interface Board {
	/** Top players per board ("missions" for Top Gun's sake), best first. */
	missions: Record<number, BoardEntry[]>;
	/** The signed-in player's own bests (absent when signed out). */
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
	/** The current month, 'YYYY-MM'. */
	month: string;
	/** Per game: the month shown (this one, or the latest with scores; null = never played) and each board's leader. */
	games: Record<GameId, { month: string | null; boards: Record<number, BoardEntry | null> }>;
}

/** This month's leader on every board; a game nobody has played this month shows its latest month with scores. */
export function getMonthly(): Monthly {
	const db = getDb();
	const month = monthOf(Date.now());
	const latest = db.prepare('SELECT MAX(month) AS m FROM game_monthly WHERE game = ? AND month <= ? AND best > 0');
	const leader = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc, p.name AS name
		 FROM game_monthly s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.month = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC LIMIT 1`
	);
	const games = {} as Monthly['games'];
	for (const game of Object.keys(GAMES) as GameId[]) {
		const m = (latest.get(game, month) as { m: string | null }).m;
		const boards: Record<number, BoardEntry | null> = {};
		for (const b of GAMES[game].boards) {
			const r = m ? (leader.get(game, m, b) as { score: number; email_enc: string; name: string | null } | undefined) : undefined;
			boards[b] = r ? { name: rowName(r), score: r.score } : null;
		}
		games[game] = { month: m, boards };
	}
	return { month, games };
}

export function getBoard(game: GameId, userId: string | null, limit = 5): Board {
	const db = getDb();
	const top = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc, p.name AS name
		 FROM game_scores s JOIN users u ON u.id = s.user_id LEFT JOIN player_names p ON p.user_id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC
		 LIMIT ?`
	);
	const missions: Record<number, BoardEntry[]> = {};
	for (const m of GAMES[game].boards) {
		missions[m] = (top.all(game, m, limit) as { score: number; email_enc: string; name: string | null }[]).map((r) => ({
			name: rowName(r),
			score: r.score
		}));
	}
	const board: Board = { missions };
	if (userId) {
		const mine = db.prepare('SELECT mission, best FROM game_scores WHERE user_id = ? AND game = ?').all(userId, game) as {
			mission: number;
			best: number;
		}[];
		board.you = Object.fromEntries(mine.map((r) => [r.mission, r.best]));
	}
	return board;
}
