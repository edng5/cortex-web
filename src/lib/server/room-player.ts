// The name a player shows in online rooms: their leaderboard nickname, or their email partly hidden.
import { getPlayerName } from './player-name';
import { maskEmail } from './scores';

export function roomPlayer(user: { id: string; email: string }) {
	return { id: user.id, name: getPlayerName(user.id) ?? maskEmail(user.email) };
}
