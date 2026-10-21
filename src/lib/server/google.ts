// Google sign-in (OAuth 2.0 authorization code + PKCE) via arctic.
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; the redirect URI to register in Google
// Cloud Console is <your origin>/auth/google/callback.
import { Google } from 'arctic';

export function googleConfigured(): boolean {
	return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleClient(origin: string): Google {
	return new Google(
		process.env.GOOGLE_CLIENT_ID!,
		process.env.GOOGLE_CLIENT_SECRET!,
		`${process.env.ORIGIN || origin}/auth/google/callback`
	);
}
