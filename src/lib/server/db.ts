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
		CREATE INDEX IF NOT EXISTS audit_ts ON audit_log(ts);
		CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
	`);
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
