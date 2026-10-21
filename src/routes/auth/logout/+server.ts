// POST /auth/logout → end the session.
import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '$lib/server/auth';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, locals, getClientAddress }) => {
	deleteSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	if (locals.user) audit('logout', { userId: locals.user.id, email: locals.user.email, ip: getClientAddress() });
	return json({ ok: true });
};
