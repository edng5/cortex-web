// Keeps a game's progress (its save in localStorage) in step with the signed-in player's account,
// so coins, upgrades, characters and settings are the same on phone and computer.
//  - Before a game starts: the account's copy replaces this browser's if it changed more recently.
//  - While it's open: changes are noticed every few seconds and sent to the account (and right
//    away when the game is left or the page closes).
// Every change is time-stamped (`<key>@t`), even when signed out, so progress made on this device
// before signing in still counts as the newer copy.
import type { GameId } from './registry';

const stampKey = (key: string) => `${key}@t`;

function read(key: string): { data: string | null; t: number } {
	try {
		return { data: localStorage.getItem(key), t: Number(localStorage.getItem(stampKey(key))) || 0 };
	} catch {
		return { data: null, t: 0 };
	}
}

/** Bring this browser's save up to date from the account (or send it up, if this one is newer). */
export async function pullSave(game: GameId, key: string): Promise<void> {
	const local = read(key);
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 3000);
		const res = await fetch(`/api/games/${game}/save`, { signal: ctrl.signal });
		clearTimeout(timer);
		if (!res.ok) return;
		const server = (await res.json()) as { data: string | null; savedAt: number };
		if (server.data !== null && (local.data === null || server.savedAt > local.t)) {
			localStorage.setItem(key, server.data);
			localStorage.setItem(stampKey(key), String(server.savedAt));
		} else if (local.data !== null && (server.data === null || local.t > server.savedAt)) {
			// This browser's is newer, or the account has none yet (saves from before syncing
			// have no time stamp: they count as now).
			const t = local.t || Date.now();
			localStorage.setItem(stampKey(key), String(t));
			await pushSave(game, local.data, t);
		}
	} catch {
		/* offline or slow: play on this browser's save */
	}
}

function pushSave(game: GameId, data: string, savedAt: number) {
	return fetch(`/api/games/${game}/save`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data, savedAt }),
		keepalive: true
	}).catch(() => {
		/* offline: sent next time it changes */
	});
}

/**
 * Watch a game's save while it's open: time-stamp every change, and send it to the account when
 * `signedIn()`. Returns `flush` (send any change now) and `stop`.
 */
export function watchSave(game: GameId, key: string, signedIn: () => boolean) {
	let last = read(key).data;
	let unsent = false;
	const check = () => {
		const now = read(key).data;
		if (now !== null && now !== last) {
			last = now;
			try {
				localStorage.setItem(stampKey(key), String(Date.now()));
			} catch {
				/* storage blocked */
			}
			unsent = true;
		}
		if (unsent && signedIn() && last !== null) {
			unsent = false;
			pushSave(game, last, read(key).t || Date.now());
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
