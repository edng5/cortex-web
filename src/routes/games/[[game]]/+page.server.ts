// /games and /games/<id>: the home page, with the E.Ngine Games pop-up open on the menu or that
// game (the home page opens it from the address). Same data as the home page.
import { load as home } from '../../+page.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => home(event as unknown as Parameters<typeof home>[0]);
