// The signed-in player's nickname (their name on the site), so SpeakEase's characters greet them by
// it, and a tag for their account, so their progress syncs between devices.
import { getPlayerName } from '$lib/server/player-name';
import { blindIndex } from '$lib/server/crypto';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	nickname: locals.user ? getPlayerName(locals.user.id) : null,
	/** An opaque tag for the account (not the email), marking whose progress a browser holds. */
	account: locals.user ? blindIndex('speakease-account', locals.user.id).slice(0, 16) : null
});
