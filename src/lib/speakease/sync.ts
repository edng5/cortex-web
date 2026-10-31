// Keeps a signed-in player's SpeakEase progress the same on every device: everything SpeakEase keeps
// in this browser (the `speakease:` keys: chats, goals, streak, XP, badges, energy, phrase levels,
// dictionary, settings) is bundled into one save on their account (/api/games/speakease/save).
//  - Opening the app: the account's copy replaces this browser's if it changed more recently.
//  - The first time a browser meets the account (its save isn't tagged with it yet), the copy with
//    more progress wins instead (so an old copy on one device can't wipe another's).
//  - While it's open: changes are sent every few seconds, and when the page is left.
// A browser copy the account's replaces is kept (`speakease@prev`), so a mix-up can be undone.
const PREFIX = 'speakease:';
const STAMP = 'speakease@t';
const OWNER = 'speakease@u';
const PREV = 'speakease@prev';
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

function push(data: string, savedAt: number): Promise<boolean> {
	return fetch('/api/games/speakease/save', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data, savedAt }),
		keepalive: data.length < 60_000
	}).then(
		(r) => r.ok,
		() => false
	);
}

/**
 * Bring this browser in step with the account (before the app reads its storage). Resolves true
 * when in step, false if the account couldn't be reached (the app then runs on this browser's copy).
 */
export async function pullProgress(account: string): Promise<boolean> {
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 6000);
		const res = await fetch('/api/games/speakease/save', { signal: ctrl.signal });
		clearTimeout(timer);
		if (!res.ok) return false;
		const server = (await res.json()) as { data: string | null; savedAt: number };
		const local = bundle();
		const localData = pack(local);
		const hasLocal = Object.keys(local).length > 0;
		const t = Number(localStorage.getItem(STAMP)) || 0;
		const mine = localStorage.getItem(OWNER) === account;
		const take = () => {
			if (hasLocal && localData !== server.data) localStorage.setItem(PREV, localData);
			unpack(server.data!);
			localStorage.setItem(STAMP, String(server.savedAt));
		};
		if (server.data === null) {
			if (hasLocal && !(await push(localData, t || Date.now()))) return false;
			if (hasLocal) localStorage.setItem(STAMP, String(t || Date.now()));
		} else if (!hasLocal) {
			take();
		} else if (mine) {
			if (server.savedAt > t) take();
			else if (t > server.savedAt && localData !== server.data && !(await push(localData, t))) return false;
		} else if (progress(JSON.parse(server.data)) >= progress(local)) {
			take();
		} else {
			const now = Date.now();
			if (!(await push(localData, now))) return false;
			localStorage.setItem(STAMP, String(now));
		}
		localStorage.setItem(OWNER, account);
		return true;
	} catch {
		return false;
	}
}

/** While the app is open: send changes to the account every few seconds (and when leaving). */
export function watchProgress(): () => void {
	let last = pack(bundle());
	let unsent = false;
	const check = () => {
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
		if (unsent) {
			unsent = false;
			const data = last;
			push(data, Number(localStorage.getItem(STAMP)) || Date.now()).then((ok) => {
				if (!ok && last === data) unsent = true; // try again on the next check
			});
		}
	};
	const timer = setInterval(check, 5000);
	window.addEventListener('pagehide', check);
	return () => {
		check();
		clearInterval(timer);
		window.removeEventListener('pagehide', check);
	};
}
