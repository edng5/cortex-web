// POST /auth/email/verify { email, code } → check the emailed code, sign in.
import { error, json } from '@sveltejs/kit';
import { consumeLoginCode, isValidEmail, normaliseEmail, upsertUser } from '$lib/server/auth';
import { startSession } from '$lib/server/session-cookie';
import { rateLimit } from '$lib/server/ratelimit';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	const body = await request.json().catch(() => null);
	const email = typeof body?.email === 'string' ? normaliseEmail(body.email) : '';
	const code = typeof body?.code === 'string' ? body.code.trim() : '';
	if (!isValidEmail(email)) error(400, 'Please enter a valid email address.');
	// Guesses from one place, across emails (each email also has its own limits).
	if (!rateLimit(`login-code-ip:${ip}`, 30, 60 * 60_000)) error(429, 'Too many tries. Please try again later.');

	const res = consumeLoginCode(email, code);
	if (!res.ok) {
		if (res.reason === 'wrong') error(400, `That code isn't right. ${res.triesLeft} ${res.triesLeft === 1 ? 'try' : 'tries'} left.`);
		if (res.reason === 'locked') error(429, 'Too many wrong codes for this email today. Please use Google sign-in, or try again tomorrow.');
		error(400, 'That code has expired or been used. Send yourself a new one.');
	}
	const userId = upsertUser(res.email, 'email');
	startSession(cookies, url, userId);
	audit('login', { userId, email: res.email, ip, detail: { provider: 'email' } });
	return json({ ok: true });
};
