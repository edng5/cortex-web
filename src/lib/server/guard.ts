// Chat lockout for visitors who ask explicit or inappropriate questions.
//
// Two warnings first; the third offence turns chat off (24 hours by default, CORTEX_BLOCK_HOURS).
// Warnings expire once that long passes without another offence, and reset after a ban.
// Whitelisted members (MEMBER_EMAILS) are never warned or banned (the question still isn't
// answered). Kept in SQLite, by network (IP) and by account when signed in, so a restart or
// redeploy doesn't lift a ban. Behind a proxy, set adapter-node's ADDRESS_HEADER so
// getClientAddress() sees real IPs.
import { env } from '$env/dynamic/private';
import { getDb } from './db';
import { blindIndex, keysConfigured } from './crypto';

export const WARNINGS_BEFORE_BAN = 2;

export function banHours(): number {
	const hours = Number(env.CORTEX_BLOCK_HOURS || 24);
	return Number.isFinite(hours) && hours > 0 ? hours : 24;
}
const banMs = () => banHours() * 3_600_000;
/** "24 hours", "2 days"… for messages. */
export function banLength(): string {
	const h = banHours();
	return h % 24 === 0 && h > 24 ? `${h / 24} days` : `${h} hour${h === 1 ? '' : 's'}`;
}

/** Who a strike counts against: this network, and the account when signed in. */
export function guardKeys(ip: string, userId?: string | null): string[] {
	if (!keysConfigured()) return []; // no AUTH keys yet: nothing can be stored (chat is off anyway)
	return [`ip:${ip}`, ...(userId ? [`user:${userId}`] : [])].map((k) => blindIndex('guard', k));
}

interface Row {
	key_hash: string;
	strikes: number;
	banned_until: number;
	last_at: number;
}

function rows(keys: string[]): Row[] {
	const q = getDb().prepare('SELECT * FROM chat_strikes WHERE key_hash = ?');
	return keys.map((k) => q.get(k) as Row | undefined).filter((r): r is Row => !!r);
}

/** Remaining ban in ms (0 = not banned). */
export function blockedFor(keys: string[]): number {
	const now = Date.now();
	return Math.max(0, ...rows(keys).map((r) => r.banned_until - now));
}

export type Offence = { action: 'none' } | { action: 'warn'; warning: number } | { action: 'ban'; until: number };

/** Record an explicit/inappropriate question and decide: warning, or ban on the third. */
export function recordOffence(keys: string[], isMember: boolean): Offence {
	if (isMember || keys.length === 0) return { action: 'none' };
	const now = Date.now();
	// Strikes still "live" (an offence within the ban window, and not already banned for them).
	const prior = Math.max(
		0,
		...rows(keys).map((r) => (now - r.last_at < banMs() && r.banned_until <= now ? r.strikes : 0))
	);
	const strikes = prior + 1;
	const ban = strikes > WARNINGS_BEFORE_BAN;
	const until = ban ? now + banMs() : 0;
	const upsert = getDb().prepare(
		`INSERT INTO chat_strikes (key_hash, strikes, banned_until, last_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(key_hash) DO UPDATE SET strikes = excluded.strikes, banned_until = excluded.banned_until, last_at = excluded.last_at`
	);
	for (const k of keys) upsert.run(k, ban ? 0 : strikes, until, now);
	return ban ? { action: 'ban', until } : { action: 'warn', warning: strikes };
}

/** Instant pre-filter: does the question contain a configured blocked term (whole word)? */
export function hitsBlockedTerm(question: string, terms: string[]): boolean {
	const q = question.toLowerCase();
	return terms.some((t) => {
		const term = t.toLowerCase().trim();
		if (!term) return false;
		const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'u').test(q);
	});
}
