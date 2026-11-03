// Keeps a game's progress (its save in localStorage) in step with the signed-in player's account,
// so coins, upgrades, characters and settings are the same on phone and computer.
//  - Before a game starts: the account's copy replaces this browser's if it changed more recently.
//  - While it's open: changes are noticed every few seconds and sent to the account (and right
//    away when the game is left or the page closes).
//  - Coming back to the page (tab shown again, window focused, back online): the account is
//    checked, and if another device has saved since, its newer save is taken and the game restarted
//    from it, so an old copy left open here never overwrites progress made elsewhere.
// Stale copies can't win on the account either: each save says which version of the account's
// save this browser last had (`<key>@base`) and which device it is; if another device has saved
// since, the account refuses it and sends the newer save back, which is then taken the same way.
// Every change is time-stamped (`<key>@t`), even when signed out, so progress made on this device
// before signing in still counts as the newer copy, for an account that has none yet.
// A save started while signed out (`<key>@u` = '') or on another account never replaces an
// account's progress just for being newer, and a browser's save that the account's copy replaces
// is kept (`<key>@prev`), so a mix-up can always be undone.
import type { GameId } from './registry';

const stampKey = (key: string) => `${key}@t`;
const ownerKey = (key: string) => `${key}@u`;
const prevKey = (key: string) => `${key}@prev`;
const baseKey = (key: string) => `${key}@base`;

/** A short tag for the account (not the email itself), to tell whose a browser's save is. */
export function accountTag(email: string): string {
	let h = 0x811c9dc5;
	for (const c of email.trim().toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
	return (h >>> 0).toString(36);
}

/** This browser's id (random, kept in this browser), so its own saves never count as a conflict. */
export function deviceId(): string {
	try {
		let id = localStorage.getItem('device-id');
		if (!id) {
			id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
			localStorage.setItem('device-id', id);
		}
		return id;
	} catch {
		return 'unknown';
	}
}

function read(key: string): { data: string | null; t: number; owner: string | null; base: number | null } {
	try {
		const b = localStorage.getItem(baseKey(key));
		return {
			data: localStorage.getItem(key),
			t: Number(localStorage.getItem(stampKey(key))) || 0,
			owner: localStorage.getItem(ownerKey(key)),
			base: b === null ? null : Number(b) || 0
		};
	} catch {
		return { data: null, t: 0, owner: null, base: null };
	}
}

/** Put the account's save in this browser (keeping the one it replaces), as the version this browser now has. */
function take(key: string, data: string, savedAt: number) {
	const local = read(key);
	if (local.data !== null && local.data !== data) localStorage.setItem(prevKey(key), local.data);
	localStorage.setItem(key, data);
	localStorage.setItem(stampKey(key), String(savedAt));
	localStorage.setItem(baseKey(key), String(savedAt));
}

type Server = { data: string | null; savedAt: number };
async function fetchSave(game: GameId, ms = 8000): Promise<Server | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const res = await fetch(`/api/games/${game}/save`, { signal: ctrl.signal, cache: 'no-store' });
		return res.ok ? ((await res.json()) as Server) : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Bring this browser's save up to date from the account (or send it up, if this one is newer).
 * Resolves true once it's in step with the account, false if the account couldn't be reached.
 */
export async function pullSave(game: GameId, key: string, account: string): Promise<boolean> {
	const local = read(key);
	try {
		const server = await fetchSave(game);
		if (!server) return false;
		// This account's (or from before saves were tagged): the newer copy wins, but a copy that
		// has already synced with an older version of the account's than the account now has
		// (another device saved since) is stale, whatever its time stamp says.
		const mine = local.owner === null || local.owner === account;
		const stale = local.base !== null && server.savedAt > local.base;
		if (server.data !== null && (local.data === null || !mine || stale || server.savedAt > local.t)) {
			take(key, server.data, server.savedAt);
		} else if (local.data !== null && (server.data === null || local.t > server.savedAt)) {
			// This browser's is newer, or the account has none yet (saves from before syncing
			// have no time stamp: they count as now).
			const t = local.t || Date.now();
			localStorage.setItem(stampKey(key), String(t));
			const r = await pushSave(game, local.data, t, server.data === null ? undefined : server.savedAt);
			if (r.conflict) take(key, r.conflict.data, r.conflict.savedAt);
			else if (!r.ok) return false;
			else localStorage.setItem(baseKey(key), String(r.savedAt));
		} else if (server.data !== null) {
			localStorage.setItem(baseKey(key), String(server.savedAt));
		}
		localStorage.setItem(ownerKey(key), account);
		return true;
	} catch {
		/* offline or slow: play on this browser's save */
		return false;
	}
}

type PushResult = { ok: boolean; savedAt?: number; conflict?: { data: string; savedAt: number } };

/**
 * Send a save to the account, saying which version of the account's this browser last had
 * (`base`). `conflict`: another device saved since, and this is its newer save (nothing was written).
 */
async function pushSave(game: GameId, data: string, savedAt: number, base: number | undefined): Promise<PushResult> {
	try {
		const r = await fetch(`/api/games/${game}/save`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data, savedAt, base, device: deviceId() }),
			keepalive: data.length < 60_000 // the browser refuses bigger keepalive requests
		});
		if (r.status === 409) return { ok: false, conflict: (await r.json()) as { data: string; savedAt: number } };
		if (!r.ok) return { ok: false };
		return { ok: true, savedAt: ((await r.json()) as { savedAt: number }).savedAt };
	} catch {
		return { ok: false }; /* offline: sent next time it changes */
	}
}

/**
 * Watch a game's save while it's open: time-stamp every change, and send it to the account while
 * `account()` gives one (the account's tag, once `pullSave` has put this browser in step with it).
 * When another device turns out to have saved since (a refused save, or a check on coming back
 * to the page), `onStale(take)` is called: the game should stop without saving, call `take()` to
 * put the newer save in place, then start again from it. Returns `flush` (send any change now),
 * `refresh` (check the account now) and `stop`.
 */
export function watchSave(game: GameId, key: string, account: () => string | null, onStale?: (take: () => void) => void) {
	let last = read(key).data;
	// A save that starts now, before this browser is in step with an account, is a signed-out one.
	const started = last === null;
	let unsent = false;
	let busy = false;
	let stopped = false;
	/** Another device's newer save: hand over to the game to restart from it. */
	const stale = (server: { data: string; savedAt: number }) => {
		unsent = false;
		const adopt = () => {
			try {
				take(key, server.data, server.savedAt);
			} catch {
				/* storage blocked */
			}
			last = server.data;
		};
		// (Already stopped, the game is gone: just put the newer save in place.)
		if (onStale && !stopped) onStale(adopt);
		else adopt();
	};
	const check = () => {
		if (stopped) return;
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
		// One save at a time, so this browser's own saves never trip over each other.
		if (unsent && !busy && account() && last !== null) {
			unsent = false;
			busy = true;
			const data = last;
			const local = read(key);
			pushSave(game, data, local.t || Date.now(), local.base ?? undefined).then((r) => {
				busy = false;
				if (r.conflict) return stale(r.conflict);
				if (r.ok && r.savedAt !== undefined) {
					try {
						localStorage.setItem(baseKey(key), String(r.savedAt));
					} catch {
						/* storage blocked */
					}
				} else if (last === data) unsent = true; // try again on the next check
			});
		}
	};
	/** Coming back to the page: has another device saved since? Then take its save; else send ours. */
	let refreshing = false;
	const refresh = async () => {
		if (stopped || refreshing || !account()) return;
		refreshing = true;
		const server = await fetchSave(game, 6000);
		refreshing = false;
		if (stopped || !server || server.data === null) return check();
		const base = read(key).base;
		if (base !== null && server.savedAt > base) stale({ data: server.data, savedAt: server.savedAt });
		else check();
	};
	const onVisible = () => document.visibilityState === 'visible' && refresh();
	const timer = setInterval(check, 4000);
	window.addEventListener('pagehide', check);
	document.addEventListener('visibilitychange', onVisible);
	window.addEventListener('focus', refresh);
	window.addEventListener('online', refresh);
	return {
		flush: check,
		refresh,
		stop() {
			check();
			stopped = true;
			clearInterval(timer);
			window.removeEventListener('pagehide', check);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', refresh);
			window.removeEventListener('online', refresh);
		}
	};
}
