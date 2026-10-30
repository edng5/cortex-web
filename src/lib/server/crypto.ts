// Encryption-at-rest helpers for auth, quota and audit data.
//
// - encrypt/decrypt: AES-256-GCM (authenticated), random 12-byte IV per value.
//   Used for emails, IP addresses and chat prompts stored in the database.
// - blindIndex: HMAC-SHA256 so an encrypted value can still be looked up
//   (e.g. find a user by email, count an IP's free questions) without storing it in clear.
// - hashToken: SHA-256 of a random bearer token (sessions). Only the hash
//   is stored, so a database leak can't be replayed as live sessions.
//
// Keys come from env (generate them with `npm run gen-keys`):
//   AUTH_ENC_KEY   32 random bytes, base64 — encryption key
//   AUTH_HMAC_KEY  32 random bytes, base64 — blind-index key
// Pure module (reads process.env) so CLI scripts can use it too.
import crypto from 'node:crypto';

function key(name: 'AUTH_ENC_KEY' | 'AUTH_HMAC_KEY'): Buffer {
	const raw = process.env[name];
	if (!raw) throw new Error(`${name} is not set — run \`npm run gen-keys\` and restart the server.`);
	const buf = Buffer.from(raw, 'base64');
	if (buf.length !== 32) throw new Error(`${name} must be 32 bytes (base64).`);
	return buf;
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encrypt(plain: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key('AUTH_ENC_KEY'), iv);
	const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decrypt(blob: string): string {
	const [v, iv, tag, ct] = blob.split('.');
	if (v !== 'v1' || !iv || !tag || ct === undefined) throw new Error('Unrecognised ciphertext');
	const decipher = crypto.createDecipheriv('aes-256-gcm', key('AUTH_ENC_KEY'), Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Deterministic keyed hash for lookups. `scope` separates uses (email vs ip). */
export function blindIndex(scope: string, value: string): string {
	return crypto.createHmac('sha256', key('AUTH_HMAC_KEY')).update(`${scope}:${value}`).digest('base64url');
}

/** 32 bytes of randomness, URL-safe — for session and sign-in-link tokens. */
export function randomToken(): string {
	return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('base64url');
}

export function keysConfigured(): boolean {
	try {
		key('AUTH_ENC_KEY');
		key('AUTH_HMAC_KEY');
		return true;
	} catch {
		return false;
	}
}
