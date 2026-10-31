// The signed-in player's nickname (their name on the site), so SpeakEase's characters greet them by it.
import { getPlayerName } from '$lib/server/player-name';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	nickname: locals.user ? getPlayerName(locals.user.id) : null
});
