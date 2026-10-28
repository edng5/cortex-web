// SQLite store for auth, quotas and the audit log (data/app.db).
// Sensitive columns are encrypted (see crypto.ts); lookups use blind indexes or token hashes.
// Pure module (no SvelteKit imports) so CLI scripts can open it too.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const AUDIT_RETENTION_DAYS = 90;

/** DATABASE_PATH puts the database on its own persistent disk in production (e.g. /var/data/app.db). */
const dbFile = () =>
	process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (db) return db;
	const file = dbFile(); // read when first opened, after .env has been loaded
	fs.mkdirSync(path.dirname(file), { recursive: true });
	db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id          TEXT PRIMARY KEY,
			email_hash  TEXT NOT NULL UNIQUE,   -- blind index for lookup
			email_enc   TEXT NOT NULL,          -- AES-256-GCM
			name_enc    TEXT,
			provider    TEXT NOT NULL,          -- 'google' | 'email'
			created_at  INTEGER NOT NULL,
			last_login  INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			token_hash  TEXT PRIMARY KEY,       -- sha256(token); the token itself only lives in the cookie
			user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at  INTEGER NOT NULL,
			expires_at  INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS login_links (
			token_hash  TEXT PRIMARY KEY,
			email_hash  TEXT NOT NULL,
			email_enc   TEXT NOT NULL,
			expires_at  INTEGER NOT NULL,
			used_at     INTEGER
		);
		-- Free questions for visitors who aren't logged in, keyed by a blind index of their IP.
		CREATE TABLE IF NOT EXISTS anon_usage (
			ip_hash     TEXT PRIMARY KEY,
			count       INTEGER NOT NULL,
			first_at    INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS user_usage (
			user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			day         TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
			count       INTEGER NOT NULL,
			PRIMARY KEY (user_id, day)
		);
		CREATE TABLE IF NOT EXISTS audit_log (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			ts          INTEGER NOT NULL,
			event       TEXT NOT NULL,          -- login | login_link_sent | logout | chat_prompt | chat_blocked | quota_exceeded
			user_id     TEXT,
			email_enc   TEXT,
			ip_enc      TEXT,
			detail_enc  TEXT                    -- JSON, encrypted (e.g. the prompt text)
		);
		CREATE TABLE IF NOT EXISTS game_scores (
			user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			game        TEXT NOT NULL,          -- e.g. 'topgun'
			mission     INTEGER NOT NULL,
			best        INTEGER NOT NULL,       -- the player's best score for this mission
			updated_at  INTEGER NOT NULL,
			PRIMARY KEY (user_id, game, mission)
		);
		CREATE TABLE IF NOT EXISTS game_monthly (
			user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			game        TEXT NOT NULL,
			mission     INTEGER NOT NULL,       -- board (mission, difficulty or mode)
			month       TEXT NOT NULL,          -- 'YYYY-MM' (UTC)
			best        INTEGER NOT NULL,       -- the player's best score on this board that month
			updated_at  INTEGER NOT NULL,
			PRIMARY KEY (user_id, game, mission, month)
		);
		CREATE INDEX IF NOT EXISTS game_monthly_board ON game_monthly(game, month, mission, best DESC);
		-- Scores from before monthly boards existed count for the month they were set.
		INSERT OR IGNORE INTO game_monthly (user_id, game, mission, month, best, updated_at)
			SELECT user_id, game, mission, strftime('%Y-%m', updated_at / 1000, 'unixepoch'), best, updated_at FROM game_scores;
		CREATE TABLE IF NOT EXISTS game_saves (
			user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			game        TEXT NOT NULL,
			data        TEXT NOT NULL,          -- the game's save (coins, upgrades, settings…), as the game stores it
			saved_at    INTEGER NOT NULL,       -- when it last changed on the player's device (ms); newer wins
			PRIMARY KEY (user_id, game)
		);
		CREATE TABLE IF NOT EXISTS player_names (
			user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			name        TEXT NOT NULL,          -- leaderboard name the player chose (public)
			name_key    TEXT NOT NULL UNIQUE,   -- normalised, so names are unique ignoring case/spaces
			updated_at  INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS ifish_showcase (
			user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			store       TEXT NOT NULL,          -- the player's store name (checked, public)
			species     TEXT NOT NULL,          -- the fish they're showing off
			fish_name   TEXT,                   -- its name, if given (checked, public)
			rank        INTEGER NOT NULL,       -- rarity rank, for sorting
			bond        INTEGER NOT NULL,       -- how bonded the centrepiece is (0-100)
			tank        TEXT,                   -- JSON: the favourite show tank being shown off
			updated_at  INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS ifish_market (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			seller_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			store       TEXT NOT NULL,          -- the seller's store name (checked, public)
			species     TEXT NOT NULL,          -- the fish for sale (rare or better)
			fish_name   TEXT,                   -- its name, if given (checked, public)
			price       INTEGER NOT NULL,
			currency    TEXT NOT NULL,          -- 'cash' | 'gems'
			created_at  INTEGER NOT NULL,
			buyer_id    TEXT,                   -- set when sold
			sold_at     INTEGER,
			claimed     INTEGER NOT NULL DEFAULT 0  -- 1 once the seller has collected the money
		);
		CREATE INDEX IF NOT EXISTS ifish_market_open ON ifish_market (buyer_id, created_at);
		CREATE TABLE IF NOT EXISTS chat_strikes (
			key_hash      TEXT PRIMARY KEY,     -- blind index of 'ip:…' or 'user:…'
			strikes       INTEGER NOT NULL,     -- warnings given since the last ban (expire with time)
			banned_until  INTEGER NOT NULL,     -- ms epoch; 0 = not banned
			last_at       INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS game_scores_board ON game_scores(game, mission, best DESC);
		CREATE INDEX IF NOT EXISTS audit_ts ON audit_log(ts);
		CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
	`);
	// Columns added after a table was first created.
	const cols = (db.prepare("PRAGMA table_info(ifish_showcase)").all() as { name: string }[]).map((c) => c.name);
	if (!cols.includes('tank')) db.exec('ALTER TABLE ifish_showcase ADD COLUMN tank TEXT');
	purgeExpired();
	setInterval(purgeExpired, 60 * 60 * 1000).unref(); // hourly
	return db;
}

/** Retention: audit log 90 days; expired sessions/links; usage counters older than 2 days. */
export function purgeExpired(): void {
	if (!db) return;
	const now = Date.now();
	db.prepare('DELETE FROM audit_log WHERE ts < ?').run(now - AUDIT_RETENTION_DAYS * 86_400_000);
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
	db.prepare('DELETE FROM login_links WHERE expires_at < ?').run(now - 86_400_000);
	const twoDaysAgo = new Date(now - 2 * 86_400_000).toISOString().slice(0, 10);
	db.prepare('DELETE FROM user_usage WHERE day < ?').run(twoDaysAgo);
}
