// Which E.Ngine Games leaderboard is showing: this month's, or all-time. One switch for the leaders
// beside the games menu and the boards inside each game, remembered in this browser.
export type Period = 'month' | 'all';

const KEY = 'engine:board-period';

class BoardPeriod {
	value = $state<Period>('month');

	constructor() {
		try {
			if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'all') this.value = 'all';
		} catch {
			/* storage blocked: start on this month */
		}
	}

	set(p: Period) {
		this.value = p;
		try {
			localStorage.setItem(KEY, p);
		} catch {
			/* storage blocked: still switches for this visit */
		}
	}
}

export const boardPeriod = new BoardPeriod();
