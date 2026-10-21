// GET /auth/google → redirect to Google's consent screen.
import { error, redirect } from '@sveltejs/kit';
import { generateCodeVerifier, generateState } from 'arctic';
import { googleClient, googleConfigured } from '$lib/server/google';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!googleConfigured()) error(404, 'Google sign-in is not configured');
	const state = generateState();
	const verifier = generateCodeVerifier();
	const authUrl = googleClient(url.origin).createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
	const opts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:', maxAge: 600 };
	cookies.set('g_state', state, opts);
	cookies.set('g_verifier', verifier, opts);
	redirect(302, authUrl.toString());
};
