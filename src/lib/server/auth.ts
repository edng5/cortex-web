// Accounts, sessions and passwordless email sign-in.
//
// Security model
// - No passwords: sign in with Google (OAuth 2.0 + PKCE) or a one-time email link.
// - Session = 32 random bytes in an HttpOnly, Secure, SameSite=Lax cookie. The database only
//   stores sha256(token), so a leaked DB can't be used to hijack sessions. 30-day expiry,
//   extended on use ("remember me" for the next visit).
// - Sign-in links: random token, stored hashed, single use, expire after 15 minutes.
// - Emails are stored AES-256-GCM encrypted, looked up via an HMAC blind index.
// - Members: emails listed in MEMBER_EMAILS (env, comma-separated) — never in the repo.
import crypto from 'node:crypto';
import { getDb } from './db';
import { blindIndex, decrypt, encrypt, hashToken, randomToken } from './crypto';

export const SESSION_COOKIE = 'cortex_session';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 86_400_000;
const LINK_MS = 15 * 60_000;

export interface SessionUser {
	id: string;
	email: string;
	name: string | null;
	isMember: boolean;
}

export function normaliseEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
	return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isMember(email: string): boolean {
	const list = (process.env.MEMBER_EMAILS ?? '')
		.split(',')
		.map((e) => normaliseEmail(e))
		.filter(Boolean);
	return list.includes(normaliseEmail(email));
}

/** Find or create the user for a verified email; returns the user id. */
export function upsertUser(email: string, provider: 'google' | 'email', name?: string | null): string {
	const db = getDb();
	const e = normaliseEmail(email);
	const hash = blindIndex('email', e);
	const now = Date.now();
	const row = db.prepare('SELECT id FROM users WHERE email_hash = ?').get(hash) as { id: string } | undefined;
	if (row) {
		db.prepare('UPDATE users SET last_login = ?, provider = ?, name_enc = COALESCE(?, name_enc) WHERE id = ?').run(
			now,
			provider,
			name ? encrypt(name) : null,
			row.id
		);
		return row.id;
	}
	const id = crypto.randomUUID();
	db.prepare(
		'INSERT INTO users (id, email_hash, email_enc, name_enc, provider, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(id, hash, encrypt(e), name ? encrypt(name) : null, provider, now, now);
	return id;
}

/** New session; returns the raw token for the cookie (never stored). */
export function createSession(userId: string): { token: string; expires: Date } {
	const token = randomToken();
	const now = Date.now();
	getDb()
		.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
		.run(hashToken(token), userId, now, now + SESSION_MS);
	return { token, expires: new Date(now + SESSION_MS) };
}

/** Resolve a session cookie to a user (and slide its expiry). */
export function validateSession(token: string | undefined): { user: SessionUser; renewed?: Date } | null {
	if (!token || token.length > 100) return null;
	const db = getDb();
	const th = hashToken(token);
	const row = db
		.prepare(
			`SELECT s.expires_at, u.id, u.email_enc, u.name_enc FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.token_hash = ?`
		)
		.get(th) as { expires_at: number; id: string; email_enc: string; name_enc: string | null } | undefined;
	if (!row) return null;
	const now = Date.now();
	if (row.expires_at < now) {
		db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(th);
		return null;
	}
	const email = decrypt(row.email_enc);
	const user: SessionUser = {
		id: row.id,
		email,
		name: row.name_enc ? decrypt(row.name_enc) : null,
		isMember: isMember(email)
	};
	// Extend once more than half the lifetime has passed.
	if (row.expires_at - now < SESSION_MS / 2) {
		const exp = now + SESSION_MS;
		db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(exp, th);
		return { user, renewed: new Date(exp) };
	}
	return { user };
}

export function deleteSession(token: string | undefined): void {
	if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

// ── Email sign-in links ───────────────────────────────────────────────────

/** Recent links for this email/IP — used to throttle sending. */
export function recentLinkCount(email: string, windowMs = 60 * 60_000): number {
	const row = getDb()
		.prepare('SELECT COUNT(*) AS n FROM login_links WHERE email_hash = ? AND expires_at > ?')
		.get(blindIndex('email', normaliseEmail(email)), Date.now() - windowMs + LINK_MS) as { n: number };
	return row.n;
}

export function createLoginLink(email: string): string {
	const e = normaliseEmail(email);
	const token = randomToken();
	getDb()
		.prepare('INSERT INTO login_links (token_hash, email_hash, email_enc, expires_at) VALUES (?, ?, ?, ?)')
		.run(hashToken(token), blindIndex('email', e), encrypt(e), Date.now() + LINK_MS);
	return token;
}

/** Single-use: returns the email if the link is valid, and burns it. */
export function consumeLoginLink(token: string): string | null {
	if (!token || token.length > 100) return null;
	const db = getDb();
	const th = hashToken(token);
	const row = db
		.prepare('SELECT email_enc, expires_at, used_at FROM login_links WHERE token_hash = ?')
		.get(th) as { email_enc: string; expires_at: number; used_at: number | null } | undefined;
	if (!row || row.used_at || row.expires_at < Date.now()) return null;
	const res = db.prepare('UPDATE login_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(Date.now(), th);
	if (res.changes !== 1) return null; // lost a race with another click
	return decrypt(row.email_enc);
}
