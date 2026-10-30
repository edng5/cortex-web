// Keeps a game's progress (its save in localStorage) in step with the signed-in player's account,
// so coins, upgrades, characters and settings are the same on phone and computer.
//  - Before a game starts: the account's copy replaces this browser's if it changed more recently.
//  - While it's open: changes are noticed every few seconds and sent to the account (and right
//    away when the game is left or the page closes).
// Every change is time-stamped (`<key>@t`), even when signed out, so progress made on this device
// before signing in still counts as the newer copy, for an account that has none yet.
// A save started while signed out (`<key>@u` = '') or on another account never replaces an
// account's progress just for being newer, and a browser's save that the account's copy replaces
// is kept (`<key>@prev`), so a mix-up can always be undone.
import type { GameId } from './registry';

const stampKey = (key: string) => `${key}@t`;
const ownerKey = (key: string) => `${key}@u`;
const prevKey = (key: string) => `${key}@prev`;

/** A short tag for the account (not the email itself), to tell whose a browser's save is. */
export function accountTag(email: string): string {
	let h = 0x811c9dc5;
	for (const c of email.trim().toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
	return (h >>> 0).toString(36);
}

function read(key: string): { data: string | null; t: number; owner: string | null } {
	try {
		return { data: localStorage.getItem(key), t: Number(localStorage.getItem(stampKey(key))) || 0, owner: localStorage.getItem(ownerKey(key)) };
	} catch {
		return { data: null, t: 0, owner: null };
	}
}

/**
 * Bring this browser's save up to date from the account (or send it up, if this one is newer).
 * Resolves true once it's in step with the account, false if the account couldn't be reached.
 */
export async function pullSave(game: GameId, key: string, account: string): Promise<boolean> {
	const local = read(key);
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 8000);
		const res = await fetch(`/api/games/${game}/save`, { signal: ctrl.signal });
		clearTimeout(timer);
		if (!res.ok) return false;
		const server = (await res.json()) as { data: string | null; savedAt: number };
		// This account's (or from before saves were tagged): the newer copy wins.
		const mine = local.owner === null || local.owner === account;
		if (server.data !== null && (local.data === null || !mine || server.savedAt > local.t)) {
			if (local.data !== null && local.data !== server.data) localStorage.setItem(prevKey(key), local.data);
			localStorage.setItem(key, server.data);
			localStorage.setItem(stampKey(key), String(server.savedAt));
		} else if (local.data !== null && (server.data === null || local.t > server.savedAt)) {
			// This browser's is newer, or the account has none yet (saves from before syncing
			// have no time stamp: they count as now).
			const t = local.t || Date.now();
			localStorage.setItem(stampKey(key), String(t));
			if (!(await pushSave(game, local.data, t))) return false;
		}
		localStorage.setItem(ownerKey(key), account);
		return true;
	} catch {
		/* offline or slow: play on this browser's save */
		return false;
	}
}

/** Send a save to the account; true if the account took it (or already had a newer one). */
function pushSave(game: GameId, data: string, savedAt: number): Promise<boolean> {
	return fetch(`/api/games/${game}/save`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data, savedAt }),
		keepalive: data.length < 60_000 // the browser refuses bigger keepalive requests
	}).then(
		(r) => r.ok,
		() => false /* offline: sent next time it changes */
	);
}

/**
 * Watch a game's save while it's open: time-stamp every change, and send it to the account while
 * `account()` gives one (the account's tag, once `pullSave` has put this browser in step with it).
 * Returns `flush` (send any change now) and `stop`.
 */
export function watchSave(game: GameId, key: string, account: () => string | null) {
	let last = read(key).data;
	// A save that starts now, before this browser is in step with an account, is a signed-out one.
	const started = last === null;
	let unsent = false;
	const check = () => {
		const now = read(key).data;
		if (now !== null && now !== last) {
			last = now;
			try {
				localStorage.setItem(stampKey(key), String(Date.now()));
				if (started && !account() && read(key).owner === null) localStorage.setItem(ownerKey(key), '');
			} catch {
				/* storage blocked */
			}
			unsent = true;
		}
		if (unsent && account() && last !== null) {
			unsent = false;
			const data = last;
			pushSave(game, data, read(key).t || Date.now()).then((ok) => {
				if (!ok && last === data) unsent = true; // try again on the next check
			});
		}
	};
	const timer = setInterval(check, 4000);
	window.addEventListener('pagehide', check);
	return {
		flush: check,
		stop() {
			check();
			clearInterval(timer);
			window.removeEventListener('pagehide', check);
		}
	};
}
