// Question quotas for Cortex.
//   Not logged in: QUOTA_ANON (default 5) questions, ever, per network (blind index of the IP).
//   Logged in:     QUOTA_USER_DAILY (default 10) per UTC day.
//   Members:       unlimited, unless QUOTA_MEMBER_DAILY is set (still counted, for the audit trail).
import { getDb } from './db';
import { blindIndex } from './crypto';
import type { SessionUser } from './auth';

export interface QuotaStatus {
	used: number;
	limit: number;
	period: 'lifetime' | 'day';
	remaining: number;
	loggedIn: boolean;
	/** No cap (whitelisted members, by default). `limit` and `remaining` are then meaningless. */
	unlimited: boolean;
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
const limits = () => {
	const user = num(process.env.QUOTA_USER_DAILY, 10);
	// Members: no cap unless QUOTA_MEMBER_DAILY is set.
	const member = process.env.QUOTA_MEMBER_DAILY?.trim() ? num(process.env.QUOTA_MEMBER_DAILY, Infinity) : Infinity;
	return { anon: num(process.env.QUOTA_ANON, 5), user, member };
};
const today = () => new Date().toISOString().slice(0, 10);

export function quotaStatus(user: SessionUser | null, ip: string): QuotaStatus {
	const db = getDb();
	const L = limits();
	if (!user) {
		const row = db.prepare('SELECT count FROM anon_usage WHERE ip_hash = ?').get(blindIndex('ip', ip)) as
			| { count: number }
			| undefined;
		const used = row?.count ?? 0;
		return { used, limit: L.anon, period: 'lifetime', remaining: Math.max(0, L.anon - used), loggedIn: false, unlimited: false };
	}
	const row = db.prepare('SELECT count FROM user_usage WHERE user_id = ? AND day = ?').get(user.id, today()) as
		| { count: number }
		| undefined;
	const used = row?.count ?? 0;
	const limit = user.isMember ? L.member : L.user;
	if (!Number.isFinite(limit)) return { used, limit: 0, period: 'day', remaining: 0, loggedIn: true, unlimited: true };
	return { used, limit, period: 'day', remaining: Math.max(0, limit - used), loggedIn: true, unlimited: false };
}

/** Count one question. Call only after quotaStatus() said there's room. */
export function consumeQuota(user: SessionUser | null, ip: string): QuotaStatus {
	const db = getDb();
	if (!user) {
		db.prepare(
			`INSERT INTO anon_usage (ip_hash, count, first_at) VALUES (?, 1, ?)
			 ON CONFLICT(ip_hash) DO UPDATE SET count = count + 1`
		).run(blindIndex('ip', ip), Date.now());
	} else {
		db.prepare(
			`INSERT INTO user_usage (user_id, day, count) VALUES (?, ?, 1)
			 ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`
		).run(user.id, today());
	}
	return quotaStatus(user, ip);
}

/** Give a question back (Cortex failed to answer, e.g. an API outage). */
export function refundQuota(user: SessionUser | null, ip: string): QuotaStatus {
	const db = getDb();
	if (!user) {
		db.prepare('UPDATE anon_usage SET count = MAX(0, count - 1) WHERE ip_hash = ?').run(blindIndex('ip', ip));
	} else {
		db.prepare('UPDATE user_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND day = ?').run(user.id, today());
	}
	return quotaStatus(user, ip);
}
