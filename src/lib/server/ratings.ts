// Ratings (MMR) and win / loss / draw records for the online games. Elo: a win against a
// stronger player gains more than a win against a weaker one. Private to each player.
import { getDb } from './db';

export const RATED_GAMES = ['chess', 'fourrow', 'fishy'] as const;
export type RatedGame = (typeof RATED_GAMES)[number];
export const isRatedGame = (g: string): g is RatedGame => (RATED_GAMES as readonly string[]).includes(g);

const START = 1000;
const K = 32;

export interface Rating {
	mmr: number;
	wins: number;
	losses: number;
	draws: number;
}

export function getRating(userId: string, game: RatedGame): Rating {
	const row = getDb().prepare('SELECT mmr, wins, losses, draws FROM match_ratings WHERE user_id = ? AND game = ?').get(userId, game) as
		| Rating
		| undefined;
	return row ?? { mmr: START, wins: 0, losses: 0, draws: 0 };
}

export interface MatchSummary {
	game: RatedGame;
	/** Rating change for each player. */
	deltas: Record<string, number>;
	ratings: Record<string, Rating>;
}

/**
 * Records a finished match between `a` and `b`: `winner` is one of them, or null for a draw.
 * Returns each player's rating change and new record.
 */
export function recordMatch(game: RatedGame, a: string, b: string, winner: string | null, reason: string): MatchSummary {
	const db = getDb();
	const ra = getRating(a, game);
	const rb = getRating(b, game);
	const expectA = 1 / (1 + 10 ** ((rb.mmr - ra.mmr) / 400));
	const scoreA = winner == null ? 0.5 : winner == a ? 1 : 0;
	const da = Math.round(K * (scoreA - expectA));
	const db_ = -da;
	const now = Date.now();
	const save = db.prepare(
		`INSERT INTO match_ratings (user_id, game, mmr, wins, losses, draws, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, game) DO UPDATE SET mmr = excluded.mmr, wins = excluded.wins, losses = excluded.losses,
		 draws = excluded.draws, updated_at = excluded.updated_at`
	);
	const next = (r: Rating, d: number, s: number): Rating => ({
		mmr: Math.max(100, r.mmr + d),
		wins: r.wins + (s == 1 ? 1 : 0),
		losses: r.losses + (s == 0 ? 1 : 0),
		draws: r.draws + (s == 0.5 ? 1 : 0)
	});
	const na = next(ra, da, scoreA);
	const nb = next(rb, db_, 1 - scoreA);
	db.transaction(() => {
		save.run(a, game, na.mmr, na.wins, na.losses, na.draws, now);
		save.run(b, game, nb.mmr, nb.wins, nb.losses, nb.draws, now);
		db.prepare('INSERT INTO matches (game, p1, p2, winner, p1_delta, p2_delta, reason, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
			game, a, b, winner, da, db_, reason, now
		);
	})();
	return { game, deltas: { [a]: da, [b]: db_ }, ratings: { [a]: na, [b]: nb } };
}
