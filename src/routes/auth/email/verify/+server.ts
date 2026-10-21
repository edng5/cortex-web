// GET /auth/email/verify?token=… → burn the link, sign in, go home.
import { error, redirect } from '@sveltejs/kit';
import { consumeLoginLink, upsertUser } from '$lib/server/auth';
import { startSession } from '$lib/server/session-cookie';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies, getClientAddress }) => {
	const email = consumeLoginLink(url.searchParams.get('token') ?? '');
	if (!email) error(400, 'This sign-in link is invalid or has expired. Request a new one from the Log in menu.');
	const userId = upsertUser(email, 'email');
	startSession(cookies, url, userId);
	audit('login', { userId, email, ip: getClientAddress(), detail: { provider: 'email' } });
	redirect(302, '/');
};
