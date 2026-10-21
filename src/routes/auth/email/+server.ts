// POST /auth/email { email } → send a one-time sign-in link.
import { error, json } from '@sveltejs/kit';
import { createLoginLink, isValidEmail, normaliseEmail, recentLinkCount } from '$lib/server/auth';
import { emailConfigured, sendLoginEmail } from '$lib/server/mailer';
import { dev } from '$app/environment';
import { rateLimit } from '$lib/server/ratelimit';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const ip = getClientAddress();
	const body = await request.json().catch(() => null);
	const email = typeof body?.email === 'string' ? normaliseEmail(body.email) : '';
	if (!isValidEmail(email)) error(400, 'Please enter a valid email address.');

	// Without an email server, don't pretend to send: on the live site say so; when developing
	// locally, hand the link straight back so it can be clicked (see SMTP_URL in .env.example).
	if (!emailConfigured() && !dev) {
		error(503, 'Email sign-in is not set up yet. Please use Google sign-in, or try again later.');
	}

	// Throttle per IP and per address, so the endpoint can't be used to spam inboxes.
	if (!rateLimit(`login-ip:${ip}`, 10, 60 * 60_000) || recentLinkCount(email) >= 5) {
		error(429, 'Too many sign-in emails. Please try again later.');
	}

	const token = createLoginLink(email);
	const link = `${process.env.ORIGIN || url.origin}/auth/email/verify?token=${encodeURIComponent(token)}`;
	if (!emailConfigured()) {
		audit('login_link_sent', { email, ip, detail: { delivery: 'dev-inline' } });
		return json({
			ok: true,
			devLink: link,
			message: 'No email server is configured (SMTP_URL), so nothing was emailed. Development mode: use this link to sign in.'
		});
	}
	try {
		await sendLoginEmail(email, link);
	} catch (err) {
		console.error('[auth/email] send failed', err);
		error(502, 'Could not send the email. Please try again.');
	}
	audit('login_link_sent', { email, ip });
	// Same response whether or not the address already has an account.
	return json({ ok: true, message: `Check ${email} for a sign-in link (it expires in 15 minutes).` });
};
