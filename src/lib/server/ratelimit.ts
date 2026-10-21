// Tiny in-memory sliding-window rate limiter for /api/ask.
// Good enough for a single Node process; use Redis/Upstash if you scale out.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 10 * 60_000): boolean {
	const now = Date.now();
	const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
	if (recent.length >= limit) {
		hits.set(key, recent);
		return false;
	}
	recent.push(now);
	hits.set(key, recent);
	if (hits.size > 10_000) hits.clear(); // crude memory cap
	return true;
}
