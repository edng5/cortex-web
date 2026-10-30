// Accounts, sessions and passwordless email sign-in.
//
// Security model
// - No passwords: sign in with Google (OAuth 2.0 + PKCE) or a 4-digit code sent by email.
// - Session = 32 random bytes in an HttpOnly, Secure, SameSite=Lax cookie. The database only
//   stores sha256(token), so a leaked DB can't be used to hijack sessions. 30-day expiry,
//   extended on use ("remember me" for the next visit).
// - Sign-in codes: random, stored as an HMAC, single use, expire after 10 minutes. Guessing is
//   capped: 5 wrong tries burns the code, 15 a day locks the email out until the day is up, and
//   only 5 codes are sent an hour, so a 4-digit code can't be worked out by trying them all.
// - Emails are stored AES-256-GCM encrypted, looked up via an HMAC blind index.
// - Members: emails listed in MEMBER_EMAILS (env, comma-separated) — never in the repo.
import crypto from 'node:crypto';
import { getDb } from './db';
import { blindIndex, decrypt, encrypt, hashToken, randomToken } from './crypto';

export const SESSION_COOKIE = 'cortex_session';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 86_400_000;
export const CODE_MINUTES = 10;
const CODE_MS = CODE_MINUTES * 60_000;
const CODE_TRIES = 5;
const SENDS_PER_HOUR = 5;
const FAILS_PER_DAY = 15;

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

// ── Email sign-in codes ───────────────────────────────────────────────────

type CodeRow = {
	email_enc: string;
	code_hash: string | null;
	expires_at: number;
	tries: number;
	sends: number;
	sends_from: number;
	fails: number;
	fails_from: number;
};
const codeHash = (emailHash: string, code: string) => blindIndex('login-code', `${emailHash}:${code}`);
const codeRow = (emailHash: string) => getDb().prepare('SELECT * FROM login_codes WHERE email_hash = ?').get(emailHash) as CodeRow | undefined;

/**
 * A new sign-in code for this email (any earlier one stops working), or null if it's had too
 * many codes this hour, or too many wrong guesses today.
 */
export function createLoginCode(email: string): string | null {
	const e = normaliseEmail(email);
	const eh = blindIndex('email', e);
	const now = Date.now();
	const row = codeRow(eh);
	const hourly = row && now - row.sends_from < 60 * 60_000;
	const daily = row && now - row.fails_from < 86_400_000;
	if ((hourly && row.sends >= SENDS_PER_HOUR) || (daily && row.fails >= FAILS_PER_DAY)) return null;
	const code = String(crypto.randomInt(0, 10_000)).padStart(4, '0');
	getDb()
		.prepare(
			`INSERT INTO login_codes (email_hash, email_enc, code_hash, expires_at, tries, sends, sends_from, fails, fails_from)
			 VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
			 ON CONFLICT(email_hash) DO UPDATE SET email_enc = excluded.email_enc, code_hash = excluded.code_hash,
			   expires_at = excluded.expires_at, tries = 0, sends = excluded.sends, sends_from = excluded.sends_from,
			   fails = excluded.fails, fails_from = excluded.fails_from`
		)
		.run(eh, encrypt(e), codeHash(eh, code), now + CODE_MS, hourly ? row.sends + 1 : 1, hourly ? row.sends_from : now, daily ? row.fails : 0, daily ? row.fails_from : now);
	return code;
}

/**
 * Check a code typed in. Right: the email (and the code is used up). Wrong: why, and how many
 * tries are left on this code.
 */
export function consumeLoginCode(email: string, code: string): { ok: true; email: string } | { ok: false; reason: 'wrong' | 'expired' | 'locked'; triesLeft: number } {
	const eh = blindIndex('email', normaliseEmail(email));
	const now = Date.now();
	const row = codeRow(eh);
	if (!row || !row.code_hash || row.expires_at < now) return { ok: false, reason: 'expired', triesLeft: 0 };
	if (now - row.fails_from < 86_400_000 && row.fails >= FAILS_PER_DAY) return { ok: false, reason: 'locked', triesLeft: 0 };
	const db = getDb();
	const given = /^\d{4}$/.test(code) ? codeHash(eh, code) : '';
	const right = given.length === row.code_hash.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(row.code_hash));
	if (right) {
		// Used up (only one request can win, if two arrive at once).
		const res = db.prepare('UPDATE login_codes SET code_hash = NULL WHERE email_hash = ? AND code_hash = ?').run(eh, row.code_hash);
		if (res.changes === 1) return { ok: true, email: decrypt(row.email_enc) };
		return { ok: false, reason: 'expired', triesLeft: 0 };
	}
	const tries = row.tries + 1;
	const freshDay = now - row.fails_from >= 86_400_000;
	const fails = freshDay ? 1 : row.fails + 1;
	const burned = tries >= CODE_TRIES || fails >= FAILS_PER_DAY;
	db.prepare('UPDATE login_codes SET tries = ?, fails = ?, fails_from = ?, code_hash = ? WHERE email_hash = ?').run(
		tries,
		fails,
		freshDay ? now : row.fails_from,
		burned ? null : row.code_hash,
		eh
	);
	if (fails >= FAILS_PER_DAY) return { ok: false, reason: 'locked', triesLeft: 0 };
	return { ok: false, reason: burned ? 'expired' : 'wrong', triesLeft: CODE_TRIES - tries };
}
