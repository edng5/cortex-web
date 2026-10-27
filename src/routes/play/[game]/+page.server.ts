// The signed-in player (if any), so games on their own page know who's playing (saves, boards).
import { googleConfigured } from '$lib/server/google';
import { keysConfigured } from '$lib/server/crypto';
import { getPlayerName } from '$lib/server/player-name';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	return {
		user: user ? { email: user.email, name: user.name, isMember: user.isMember, nickname: getPlayerName(user.id) } : null,
		auth: { ready: keysConfigured(), google: googleConfigured() }
	};
};
