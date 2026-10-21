import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';

/** Anonymous per-browser id: keeps visitors on the same network from sharing Cortex streams. */
const VISITOR_COOKIE = 'cortex_vid';

// SvelteKit loads .env into $env, not process.env. Bridge it once so the auth, crypto and
// quota modules (which also run from CLI scripts) can read their settings the same way.
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined && v !== undefined) process.env[k] = v;

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	let vid = event.cookies.get(VISITOR_COOKIE);
	if (!vid || !/^[\w-]{16,64}$/.test(vid)) {
		vid = crypto.randomBytes(16).toString('base64url');
		event.cookies.set(VISITOR_COOKIE, vid, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	event.locals.visitorId = vid;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		try {
			const s = validateSession(token);
			if (s) {
				event.locals.user = s.user;
				if (s.renewed) {
					event.cookies.set(SESSION_COOKIE, token, {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						secure: event.url.protocol === 'https:',
						expires: s.renewed
					});
				}
			} else {
				event.cookies.delete(SESSION_COOKIE, { path: '/' });
			}
		} catch (err) {
			console.error('[auth] session check failed', err);
		}
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
