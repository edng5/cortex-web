// Client-side view of the visitor: who's logged in, how many Cortex questions are left,
// and which header pop-ups are open. Seeded from the page's server data.
import type { QuotaInfo } from '$lib/types';

export interface ClientUser {
	email: string;
	name: string | null;
	isMember: boolean;
	/** Chosen nickname (also the E.Ngine Games leaderboard name); null = not set. */
	nickname?: string | null;
}

class Session {
	user = $state<ClientUser | null>(null);
	quota = $state<QuotaInfo | null>(null);
	auth = $state<{ ready: boolean; google: boolean }>({ ready: false, google: false });

	loginOpen = $state(false);
	limitOpen = $state(false);
	limitMessage = $state('');
	experienceOpen = $state(false);
	projectsOpen = $state(false);
	/** E.Ngine Games pop-up, and the game showing in it (null = the games menu). */
	gameOpen = $state(false);
	gameId = $state<string | null>(null);
	/** Nickname, also the leaderboard name (undefined = not loaded yet, null = not chosen). */
	playerName = $state<string | null | undefined>(undefined);

	init(data: { user: ClientUser | null; quota: QuotaInfo | null; auth: { ready: boolean; google: boolean } }) {
		this.user = data.user;
		if (data.user && data.user.nickname !== undefined) this.playerName = data.user.nickname;
		this.quota = data.quota;
		this.auth = data.auth;
	}

	/** Open the E.Ngine Games pop-up, on a game or on its menu. */
	openGames(id: string | null = null) {
		this.gameId = id;
		this.gameOpen = true;
	}

	async loadPlayerName() {
		if (!this.user) return (this.playerName = null);
		try {
			const res = await fetch('/api/games/name');
			if (res.ok) this.playerName = ((await res.json()) as { name: string | null }).name;
		} catch {
			/* offline: ask again later */
		}
	}

	/** Choose a leaderboard name (checked on the server). Returns the message to show on failure. */
	async savePlayerName(name: string): Promise<{ ok: boolean; message?: string }> {
		try {
			const res = await fetch('/api/games/name', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.ok) {
				this.playerName = data.name;
				return { ok: true };
			}
			return { ok: false, message: data.message ?? 'Could not save that name.' };
		} catch {
			return { ok: false, message: 'Could not reach the server.' };
		}
	}

	openLimit(message: string) {
		this.limitMessage = message;
		this.limitOpen = true;
	}

	/** Ask for a one-time sign-in link. Returns the message to show. */
	async sendEmailLink(email: string): Promise<{ ok: boolean; message: string; devLink?: string }> {
		try {
			const res = await fetch('/auth/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await res.json().catch(() => ({}));
			return {
				ok: res.ok,
				message: data.message ?? (res.ok ? 'Check your email.' : 'Something went wrong.'),
				devLink: data.devLink
			};
		} catch {
			return { ok: false, message: 'Could not reach the server.' };
		}
	}

	async logout() {
		await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
		location.reload();
	}
}

export const session = new Session();
