// POST /auth/email { email } → email a 4-digit sign-in code (typed in at /auth/email/verify).
import { error, json } from '@sveltejs/kit';
import { CODE_MINUTES, createLoginCode, isValidEmail, normaliseEmail } from '$lib/server/auth';
import { emailConfigured, sendLoginCode } from '$lib/server/mailer';
import { dev } from '$app/environment';
import { rateLimit } from '$lib/server/ratelimit';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const ip = getClientAddress();
	const body = await request.json().catch(() => null);
	const email = typeof body?.email === 'string' ? normaliseEmail(body.email) : '';
	if (!isValidEmail(email)) error(400, 'Please enter a valid email address.');

	// Without an email server, don't pretend to send: on the live site say so; when developing
	// locally, hand the code straight back so it can be typed in (see SMTP_URL in .env.example).
	if (!emailConfigured() && !dev) {
		error(503, 'Email sign-in is not set up yet. Please use Google sign-in, or try again later.');
	}

	// Throttle per IP and per address, so the endpoint can't be used to spam inboxes
	// (or to keep getting new codes to guess at).
	if (!rateLimit(`login-ip:${ip}`, 10, 60 * 60_000)) error(429, 'Too many sign-in emails. Please try again later.');
	const code = createLoginCode(email);
	if (!code) error(429, 'Too many sign-in codes for this email. Please try again later, or use Google sign-in.');

	if (!emailConfigured()) {
		audit('login_code_sent', { email, ip, detail: { delivery: 'dev-inline' } });
		return json({
			ok: true,
			devCode: code,
			message: `No email server is configured (SMTP_URL), so nothing was emailed. Development mode: your code is ${code}.`
		});
	}
	try {
		await sendLoginCode(email, code, CODE_MINUTES);
	} catch (err) {
		console.error('[auth/email] send failed', err);
		error(502, 'Could not send the email. Please try again.');
	}
	audit('login_code_sent', { email, ip });
	// Same response whether or not the address already has an account.
	return json({ ok: true, message: `We emailed a 4-digit code to ${email}. It expires in ${CODE_MINUTES} minutes.` });
};
