// Keeps a signed-in player's SpeakEase progress the same on every device: everything SpeakEase keeps
// in this browser (the `speakease:` keys: chats, goals, streak, XP, badges, energy, phrase levels,
// dictionary, settings) is bundled into one save on their account (/api/games/speakease/save).
//  - Opening the app: the account's copy replaces this browser's if it changed more recently.
//  - The first time a browser meets the account (its save isn't tagged with it yet), the copy with
//    more progress wins instead (so an old copy on one device can't wipe another's).
//  - While it's open: changes are sent every few seconds, and when the page is left.
//  - Coming back to the page (tab shown again, window focused, back online): if another device
//    has saved since, its progress is taken and the app reloaded with it, so a copy left open here
//    never overwrites progress made elsewhere. Each save also says which version of the account's
//    this browser last had (`speakease@base`); if another device saved since, the account refuses
//    it and sends the newer progress back, which is taken the same way.
// A browser copy the account's replaces is kept (`speakease@prev`), so a mix-up can be undone.
import { deviceId } from '$lib/games/cloud-save';

const PREFIX = 'speakease:';
const STAMP = 'speakease@t';
const OWNER = 'speakease@u';
const PREV = 'speakease@prev';
const BASE = 'speakease@base';
/** Chats are trimmed to their latest messages in the account's copy (it has a size limit). */
const CHAT_KEEP = 80;

type Bundle = Record<string, string>;

function bundle(): Bundle {
	const out: Bundle = {};
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k?.startsWith(PREFIX)) continue;
			let v = localStorage.getItem(k) ?? '';
			if (/^speakease:chat\d+$/.test(k)) {
				try {
					const msgs = JSON.parse(v);
					if (Array.isArray(msgs) && msgs.length > CHAT_KEEP) v = JSON.stringify(msgs.slice(-CHAT_KEEP));
				} catch {
					continue;
				}
			}
			out[k] = v;
		}
	} catch {
		/* storage blocked */
	}
	return out;
}

/** The bundle as a stable string (keys sorted), to tell when anything changed. */
const pack = (b: Bundle) => JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a], [c]) => a.localeCompare(c))));

function unpack(data: string) {
	const b = JSON.parse(data) as Bundle;
	const old: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k?.startsWith(PREFIX)) old.push(k);
	}
	for (const k of old) if (!(k in b)) localStorage.removeItem(k);
	for (const [k, v] of Object.entries(b)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
}

/** How much progress a bundle holds (XP, then phrases learned), to pick the fuller copy. */
function progress(b: Bundle): number {
	let n = 0;
	try {
		n += Number(JSON.parse(b['speakease:game'] ?? '{}').xp) || 0;
	} catch {
		/* ignore */
	}
	for (const [k, v] of Object.entries(b)) {
		if (!k.startsWith('speakease:phrases:')) continue;
		try {
			n += 20 * (JSON.parse(v).learned?.length ?? 0);
		} catch {
			/* ignore */
		}
	}
	return n;
}

type Pushed = { ok: boolean; savedAt?: number; conflict?: { data: string; savedAt: number } };
/** Send progress, saying which version of the account's this browser last had; `conflict`: another device's newer progress. */
async function push(data: string, savedAt: number): Promise<Pushed> {
	try {
		const base = localStorage.getItem(BASE);
		const r = await fetch('/api/games/speakease/save', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data, savedAt, base: base === null ? undefined : Number(base), device: deviceId() }),
			keepalive: data.length < 60_000
		});
		if (r.status === 409) return { ok: false, conflict: (await r.json()) as { data: string; savedAt: number } };
		if (!r.ok) return { ok: false };
		const at = ((await r.json()) as { savedAt: number }).savedAt;
		localStorage.setItem(BASE, String(at));
		return { ok: true, savedAt: at };
	} catch {
		return { ok: false };
	}
}
/** Put the account's progress in this browser (keeping what it replaces), as the version this browser now has. */
function takeServer(data: string, savedAt: number) {
	const localData = pack(bundle());
	if (localData !== '{}' && localData !== data) localStorage.setItem(PREV, localData);
	unpack(data);
	localStorage.setItem(STAMP, String(savedAt));
	localStorage.setItem(BASE, String(savedAt));
}
async function fetchServer(ms: number): Promise<{ data: string | null; savedAt: number } | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const res = await fetch('/api/games/speakease/save', { signal: ctrl.signal, cache: 'no-store' });
		return res.ok ? ((await res.json()) as { data: string | null; savedAt: number }) : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Bring this browser in step with the account (before the app reads its storage). Resolves true
 * when in step, false if the account couldn't be reached (the app then runs on this browser's copy).
 */
export async function pullProgress(account: string): Promise<boolean> {
	try {
		const server = await fetchServer(6000);
		if (!server) return false;
		const local = bundle();
		const localData = pack(local);
		const hasLocal = Object.keys(local).length > 0;
		const t = Number(localStorage.getItem(STAMP)) || 0;
		const mine = localStorage.getItem(OWNER) === account;
		const baseRaw = localStorage.getItem(BASE);
		// Synced before with an older version than the account now has: another device saved since.
		const stale = baseRaw !== null && server.savedAt > Number(baseRaw);
		const take = () => takeServer(server.data!, server.savedAt);
		/** Send this browser's progress; on a conflict, take the account's newer one instead. */
		const send = async (at: number) => {
			const r = await push(localData, at);
			if (r.conflict) takeServer(r.conflict.data, r.conflict.savedAt);
			else if (!r.ok) return false;
			else localStorage.setItem(STAMP, String(at));
			return true;
		};
		if (server.data === null) {
			if (hasLocal && !(await send(t || Date.now()))) return false;
		} else if (!hasLocal) {
			take();
		} else if (mine) {
			if (stale || server.savedAt > t) take();
			else if (t > server.savedAt && localData !== server.data) {
				localStorage.setItem(BASE, String(server.savedAt));
				if (!(await send(t))) return false;
			} else localStorage.setItem(BASE, String(server.savedAt));
		} else if (progress(JSON.parse(server.data)) >= progress(local)) {
			take();
		} else {
			localStorage.setItem(BASE, String(server.savedAt));
			if (!(await send(Date.now()))) return false;
		}
		localStorage.setItem(OWNER, account);
		return true;
	} catch {
		return false;
	}
}

/**
 * While the app is open: send changes to the account every few seconds (and when leaving). When
 * another device turns out to have saved since (on coming back to the page, or a refused save),
 * its progress is put in this browser and `onStale` called (the app reloads with it).
 */
export function watchProgress(onStale: () => void = () => location.reload()): () => void {
	let last = pack(bundle());
	let unsent = false;
	let busy = false;
	let stopped = false;
	const stale = (server: { data: string; savedAt: number }) => {
		if (stopped) return;
		stop();
		try {
			takeServer(server.data, server.savedAt);
		} catch {
			/* storage blocked */
		}
		onStale();
	};
	const check = () => {
		if (stopped) return;
		const now = pack(bundle());
		if (now !== last) {
			last = now;
			try {
				localStorage.setItem(STAMP, String(Date.now()));
			} catch {
				/* storage blocked */
			}
			unsent = true;
		}
		// One save at a time, so this browser's own saves never trip over each other.
		if (unsent && !busy) {
			unsent = false;
			busy = true;
			const data = last;
			push(data, Number(localStorage.getItem(STAMP)) || Date.now()).then((r) => {
				busy = false;
				if (r.conflict) return stale(r.conflict);
				if (!r.ok && last === data) unsent = true; // try again on the next check
			});
		}
	};
	/** Coming back to the page: has another device saved since? */
	let refreshing = false;
	const refresh = async () => {
		if (stopped || refreshing) return;
		refreshing = true;
		const server = await fetchServer(6000);
		refreshing = false;
		const base = localStorage.getItem(BASE);
		if (server?.data && base !== null && server.savedAt > Number(base)) stale({ data: server.data, savedAt: server.savedAt });
		else check();
	};
	const onVisible = () => document.visibilityState === 'visible' && refresh();
	const timer = setInterval(check, 5000);
	window.addEventListener('pagehide', check);
	document.addEventListener('visibilitychange', onVisible);
	window.addEventListener('focus', refresh);
	window.addEventListener('online', refresh);
	function stop() {
		stopped = true;
		clearInterval(timer);
		window.removeEventListener('pagehide', check);
		document.removeEventListener('visibilitychange', onVisible);
		window.removeEventListener('focus', refresh);
		window.removeEventListener('online', refresh);
	}
	return () => {
		check();
		stop();
	};
}
