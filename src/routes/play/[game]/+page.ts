import { error } from '@sveltejs/kit';
import { gameById } from '$lib/games/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!gameById(params.game)) error(404, 'No such game.');
	return { id: params.game };
};
