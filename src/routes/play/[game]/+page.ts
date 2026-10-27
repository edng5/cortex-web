import { error } from '@sveltejs/kit';
import { gameById } from '$lib/games/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, data }) => {
	if (!gameById(params.game)) error(404, 'No such game.');
	return { ...data, id: params.game };
};
