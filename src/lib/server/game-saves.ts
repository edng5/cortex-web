// Game progress (coins, upgrades, unlocked characters, settings…) kept on the player's account,
// so a signed-in player has the same progress on every device. Each game's save is stored as the
// game itself stores it in the browser; the copy that changed most recently wins.
//
// Backups: once a day (per player, per game), the save is copied aside just before it's replaced,
// and only the two newest copies are kept. `npm run saves:rollback` puts one back.
import { getDb } from './db';

/** How often a save is backed up, and how many backups are kept (older ones are purged). */
export const BACKUP_EVERY = 24 * 60 * 60_000;
export const BACKUPS_KEPT = 2;

/**
 * Far larger than any game's save; anything bigger is refused. A big FishMart store is well over
 * 50 KB (its wiki and research alone are ~50 KB once complete). Sent as JSON inside JSON, so this
 * stays well under the server's 512 KB request limit.
 */
export const MAX_SAVE_BYTES = 300_000;

export function getSave(userId: string, game: string): { data: string; savedAt: number } | null {
	const row = getDb().prepare('SELECT data, saved_at FROM game_saves WHERE user_id = ? AND game = ?').get(userId, game) as
		| { data: string; saved_at: number }
		| undefined;
	return row ? { data: row.data, savedAt: row.saved_at } : null;
}

/** Store a save if it's newer than the one on the account. Returns the account's save time after. */
export function putSave(userId: string, game: string, data: string, savedAt: number): number {
	backUp(userId, game, savedAt);
	getDb()
		.prepare(
			`INSERT INTO game_saves (user_id, game, data, saved_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at
			 WHERE excluded.saved_at > game_saves.saved_at`
		)
		.run(userId, game, data, savedAt);
	return getSave(userId, game)!.savedAt;
}

/**
 * Before a save is replaced: if its last backup is a day old (or there's none), copy the current
 * save aside, then purge all but the newest backups.
 */
function backUp(userId: string, game: string, incomingAt: number) {
	const db = getDb();
	const current = getSave(userId, game);
	// Nothing to keep yet, or this write won't replace it (it's older).
	if (!current || incomingAt <= current.savedAt) return;
	const last = db.prepare('SELECT MAX(backed_up_at) AS t FROM game_save_backups WHERE user_id = ? AND game = ?').get(userId, game) as { t: number | null };
	const now = Date.now();
	if (last.t !== null && now - last.t < BACKUP_EVERY) return;
	db.transaction(() => {
		db.prepare('INSERT OR REPLACE INTO game_save_backups (user_id, game, data, saved_at, backed_up_at) VALUES (?, ?, ?, ?, ?)').run(userId, game, current.data, current.savedAt, now);
		db.prepare(
			`DELETE FROM game_save_backups WHERE user_id = ? AND game = ? AND backed_up_at NOT IN (
				SELECT backed_up_at FROM game_save_backups WHERE user_id = ? AND game = ? ORDER BY backed_up_at DESC LIMIT ?
			)`
		).run(userId, game, userId, game, BACKUPS_KEPT);
	})();
}

export interface Backup {
	data: string;
	savedAt: number;
	backedUpAt: number;
}

/** A player's backups of one game's save, newest first. */
export function listBackups(userId: string, game: string): Backup[] {
	return (
		getDb()
			.prepare('SELECT data, saved_at, backed_up_at FROM game_save_backups WHERE user_id = ? AND game = ? ORDER BY backed_up_at DESC')
			.all(userId, game) as { data: string; saved_at: number; backed_up_at: number }[]
	).map((r) => ({ data: r.data, savedAt: r.saved_at, backedUpAt: r.backed_up_at }));
}

/**
 * Roll a save back to a backup. The save is marked as just made, so it replaces the copies on the
 * player's devices the next time they open the game. The save being replaced is kept as a backup
 * too (so a rollback can itself be undone), and the oldest are purged as usual.
 */
export function rollBack(userId: string, game: string, backup: Backup) {
	const db = getDb();
	const now = Date.now();
	db.transaction(() => {
		const current = getSave(userId, game);
		if (current)
			db.prepare('INSERT OR REPLACE INTO game_save_backups (user_id, game, data, saved_at, backed_up_at) VALUES (?, ?, ?, ?, ?)').run(userId, game, current.data, current.savedAt, now);
		db.prepare(
			`INSERT INTO game_saves (user_id, game, data, saved_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at`
		).run(userId, game, backup.data, now);
		db.prepare(
			`DELETE FROM game_save_backups WHERE user_id = ? AND game = ? AND backed_up_at NOT IN (
				SELECT backed_up_at FROM game_save_backups WHERE user_id = ? AND game = ? ORDER BY backed_up_at DESC LIMIT ?
			)`
		).run(userId, game, userId, game, BACKUPS_KEPT);
	})();
}
