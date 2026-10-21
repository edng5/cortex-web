// Sets the login cookie (shared by the Google and email sign-in routes).
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE, createSession } from './auth';

export function startSession(cookies: Cookies, url: URL, userId: string): void {
	const { token, expires } = createSession(userId);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true, // not readable from JavaScript
		sameSite: 'lax', // not sent on cross-site POSTs
		secure: url.protocol === 'https:',
		expires // persists for the next visit
	});
}
