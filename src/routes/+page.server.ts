import { loadGraph } from '$lib/server/content';
import { quotaStatus } from '$lib/server/quota';
import { googleConfigured } from '$lib/server/google';
import { keysConfigured } from '$lib/server/crypto';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, getClientAddress }) => {
	const user = locals.user;
	const authReady = keysConfigured();
	return {
		// Members-only nodes are only sent to members.
		graph: loadGraph(!!user?.isMember),
		user: user ? { email: user.email, name: user.name, isMember: user.isMember } : null,
		quota: authReady ? quotaStatus(user, getClientAddress()) : null,
		auth: { ready: authReady, google: googleConfigured() }
	};
};
