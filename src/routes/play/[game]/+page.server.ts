// Old address for a single game: games now live at /games/<id>.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => redirect(308, `/games/${params.game}`);
