// Game progress (coins, upgrades, unlocked characters, settings…) kept on the player's account,
// so a signed-in player has the same progress on every device. Each game's save is stored as the
// game itself stores it in the browser; the copy that changed most recently wins.
import { getDb } from './db';

/** Far larger than any game's save; anything bigger is refused. */
export const MAX_SAVE_BYTES = 32_000;

export function getSave(userId: string, game: string): { data: string; savedAt: number } | null {
	const row = getDb().prepare('SELECT data, saved_at FROM game_saves WHERE user_id = ? AND game = ?').get(userId, game) as
		| { data: string; saved_at: number }
		| undefined;
	return row ? { data: row.data, savedAt: row.saved_at } : null;
}

/** Store a save if it's newer than the one on the account. Returns the account's save time after. */
export function putSave(userId: string, game: string, data: string, savedAt: number): number {
	getDb()
		.prepare(
			`INSERT INTO game_saves (user_id, game, data, saved_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at
			 WHERE excluded.saved_at > game_saves.saved_at`
		)
		.run(userId, game, data, savedAt);
	return getSave(userId, game)!.savedAt;
}
