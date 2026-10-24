// Global high scores for the in-browser games (Top Gun). Each signed-in player's best score per
// mission is kept; the board shows players by their login email, partly masked because the
// board is public (e.g. "edw•••@gmail.com").
import { getDb } from './db';
import { decrypt } from './crypto';

export const GAME = 'topgun';
export const MISSIONS = [1, 2, 3] as const;
/** Far above anything reachable in a mission; anything higher is rejected as tampered. */
export const MAX_SCORE = 1_000_000;

export interface BoardEntry {
	name: string;
	score: number;
}
export interface Board {
	/** Top players per mission, best first. */
	missions: Record<number, BoardEntry[]>;
	/** The signed-in player's own bests (absent when signed out). */
	you?: Record<number, number>;
}

export function maskEmail(email: string): string {
	const [local = '', domain = ''] = email.split('@');
	const shown = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
	return `${shown}•••@${domain}`;
}

/** Keep the player's best score for this mission. Returns their best after this run. */
export function submitScore(userId: string, mission: number, score: number): number {
	const db = getDb();
	db.prepare(
		`INSERT INTO game_scores (user_id, game, mission, best, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, game, mission) DO UPDATE SET
		   best = MAX(best, excluded.best),
		   updated_at = CASE WHEN excluded.best > best THEN excluded.updated_at ELSE updated_at END`
	).run(userId, GAME, mission, score, Date.now());
	const row = db.prepare('SELECT best FROM game_scores WHERE user_id = ? AND game = ? AND mission = ?').get(userId, GAME, mission) as
		| { best: number }
		| undefined;
	return row?.best ?? score;
}

export function getBoard(userId: string | null, limit = 5): Board {
	const db = getDb();
	const top = db.prepare(
		`SELECT s.best AS score, u.email_enc AS email_enc
		 FROM game_scores s JOIN users u ON u.id = s.user_id
		 WHERE s.game = ? AND s.mission = ? AND s.best > 0
		 ORDER BY s.best DESC, s.updated_at ASC
		 LIMIT ?`
	);
	const missions: Record<number, BoardEntry[]> = {};
	for (const m of MISSIONS) {
		missions[m] = (top.all(GAME, m, limit) as { score: number; email_enc: string }[]).map((r) => {
			let name = 'player';
			try {
				name = maskEmail(decrypt(r.email_enc));
			} catch {
				/* unreadable row (keys changed): keep the score, hide the name */
			}
			return { name, score: r.score };
		});
	}
	const board: Board = { missions };
	if (userId) {
		const mine = db.prepare('SELECT mission, best FROM game_scores WHERE user_id = ? AND game = ?').all(userId, GAME) as {
			mission: number;
			best: number;
		}[];
		board.you = Object.fromEntries(mine.map((r) => [r.mission, r.best]));
	}
	return board;
}
