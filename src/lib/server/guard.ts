// Chat lockout for visitors who ask explicit or inappropriate questions.
//
// Enforced on the server (by client IP) so it can't be undone from the browser;
// the browser also remembers it so the UI stays disabled across reloads.
// In-memory: a server restart clears it. Behind a proxy, set adapter-node's
// ADDRESS_HEADER (e.g. X-Forwarded-For) so getClientAddress() sees real IPs.
import { env } from '$env/dynamic/private';

const blocked = new Map<string, number>(); // ip → blocked-until (ms)

function blockMs(): number {
	const hours = Number(env.CORTEX_BLOCK_HOURS || 24);
	return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3_600_000;
}

/** Remaining block time in ms (0 = not blocked). */
export function blockedFor(ip: string): number {
	const until = blocked.get(ip);
	if (!until) return 0;
	const left = until - Date.now();
	if (left <= 0) {
		blocked.delete(ip);
		return 0;
	}
	return left;
}

export function blockVisitor(ip: string): number {
	const until = Date.now() + blockMs();
	blocked.set(ip, until);
	if (blocked.size > 50_000) blocked.clear(); // crude memory cap
	return until;
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
