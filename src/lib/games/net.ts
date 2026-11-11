// The browser side of online rooms (see $lib/server/rooms.ts): create or join a room with a code,
// listen to what happens in it, and send moves. Everything goes over the site's HTTPS connection
// with the player's login session; the server only lets the room's two players in.

export type RoomEvent = { t: string } & Record<string, unknown>;
/** Ranked, or a custom room's settings (who goes first, takebacks, minutes on the clock: 0 none). */
export interface RoomOptions {
	ranked?: boolean;
	first?: 'host' | 'guest' | 'random';
	takebacks?: boolean;
	clock?: number;
}

async function post(url: string, body: object): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
	try {
		const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { ok: false, message: data?.message ?? `Something went wrong (${res.status}).` };
		return { ok: true, data };
	} catch {
		return { ok: false, message: 'No connection. Check your internet and try again.' };
	}
}

export class Room {
	private es: EventSource | null = null;
	private closed = false;
	constructor(
		readonly code: string,
		private onEvent: (e: RoomEvent) => void
	) {}

	/**
	 * Makes a room for `game` (custom: with its settings), or with `ranked`, finds an opponent (or
	 * a room to wait for one in); resolves to its code, or an error message.
	 */
	static async create(game: string, opts: RoomOptions = {}): Promise<{ code: string } | { error: string }> {
		const r = await post('/api/rooms', { game, ...opts });
		return r.ok ? { code: String(r.data.code) } : { error: r.message };
	}

	/** Takes the free seat in room `code` (or rejoins your own). */
	static async join(code: string, game: string): Promise<{ seat: number } | { error: string }> {
		if (!/^\d{6}$/.test(code)) return { error: 'Room codes are 6 digits.' };
		const r = await post(`/api/rooms/${code}`, { type: 'join', game });
		return r.ok ? { seat: Number(r.data.seat) } : { error: r.message };
	}

	/** Starts listening (reconnects by itself if the connection drops). */
	listen() {
		this.es = new EventSource(`/api/rooms/${this.code}`);
		this.es.onmessage = (m) => {
			let e: RoomEvent;
			try {
				e = JSON.parse(m.data);
			} catch {
				return;
			}
			if (e.t == 'closed') this.stop();
			this.onEvent(e);
		};
	}

	send(msg: Record<string, unknown>) {
		if (this.closed) return Promise.resolve({ ok: false as const, message: 'The room is closed.' });
		return post(`/api/rooms/${this.code}`, msg);
	}

	/** Stops listening (without leaving: use send({ type: 'leave' }) to leave). */
	stop() {
		this.closed = true;
		this.es?.close();
		this.es = null;
	}

	/** Leaves the room (a game in progress counts as resigned) and stops listening. */
	leave() {
		if (this.closed) return;
		void this.send({ type: 'leave' });
		this.stop();
	}
}

export interface Rating {
	mmr: number;
	wins: number;
	losses: number;
	draws: number;
}
export async function myRating(game: string): Promise<Rating | null> {
	try {
		const res = await fetch(`/api/games/${game}/rating`);
		return res.ok ? await res.json() : null;
	} catch {
		return null;
	}
}
