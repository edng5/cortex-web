// Client-side view of the visitor: who's logged in, how many Cortex questions are left,
// and which header pop-ups are open. Seeded from the page's server data.
import type { QuotaInfo } from '$lib/types';

export interface ClientUser {
	email: string;
	name: string | null;
	isMember: boolean;
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

	init(data: { user: ClientUser | null; quota: QuotaInfo | null; auth: { ready: boolean; google: boolean } }) {
		this.user = data.user;
		this.quota = data.quota;
		this.auth = data.auth;
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
