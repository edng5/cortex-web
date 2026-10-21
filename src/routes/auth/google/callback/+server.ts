// GET /auth/google/callback → verify, create/find the user, start a session.
import { error, redirect } from '@sveltejs/kit';
import { decodeIdToken } from 'arctic';
import { googleClient, googleConfigured } from '$lib/server/google';
import { isValidEmail, upsertUser } from '$lib/server/auth';
import { startSession } from '$lib/server/session-cookie';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

interface GoogleClaims {
	iss?: string;
	aud?: string;
	exp?: number;
	email?: string;
	email_verified?: boolean;
	name?: string;
}

export const GET: RequestHandler = async ({ url, cookies, getClientAddress }) => {
	if (!googleConfigured()) error(404, 'Google sign-in is not configured');
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const savedState = cookies.get('g_state');
	const verifier = cookies.get('g_verifier');
	cookies.delete('g_state', { path: '/' });
	cookies.delete('g_verifier', { path: '/' });
	// CSRF protection: the state must round-trip through our own cookie.
	if (!code || !state || !savedState || !verifier || state !== savedState) error(400, 'Invalid sign-in request');

	let claims: GoogleClaims;
	try {
		const tokens = await googleClient(url.origin).validateAuthorizationCode(code, verifier);
		// The ID token comes straight from Google's token endpoint over TLS; still check its claims.
		claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
	} catch (err) {
		console.error('[auth/google] code exchange failed', err);
		error(400, 'Google sign-in failed');
	}
	const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
	if (!issOk || claims.aud !== process.env.GOOGLE_CLIENT_ID || !claims.exp || claims.exp * 1000 < Date.now()) {
		error(400, 'Invalid Google token');
	}
	if (!claims.email || !claims.email_verified || !isValidEmail(claims.email)) {
		error(400, 'Google account email is not verified');
	}

	const userId = upsertUser(claims.email, 'google', claims.name ?? null);
	startSession(cookies, url, userId);
	audit('login', { userId, email: claims.email, ip: getClientAddress(), detail: { provider: 'google' } });
	redirect(302, '/');
};
