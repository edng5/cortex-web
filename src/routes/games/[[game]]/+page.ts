import { error } from '@sveltejs/kit';
import { gameById } from '$lib/games/registry';
import type { PageLoad } from './$types';

// An unknown game is a 404 (the menu itself is /games).
export const load: PageLoad = ({ params, data }) => {
	if (params.game && !gameById(params.game)) error(404, 'No such game.');
	return { ...data, gameTitle: params.game ? gameById(params.game)!.title : null };
};
