<!-- Log in: Google, or a one-time link by email. No passwords. -->
<script lang="ts">
	import Modal from './Modal.svelte';
	import { session } from '$lib/session.svelte';

	let email = $state('');
	let sending = $state(false);
	let result = $state<{ ok: boolean; message: string; devLink?: string } | null>(null);

	async function sendLink(e: SubmitEvent) {
		e.preventDefault();
		if (!email.trim() || sending) return;
		sending = true;
		result = await session.sendEmailLink(email.trim());
		sending = false;
	}
</script>

<Modal title="Log in" width="420px" onclose={() => (session.loginOpen = false)}>
	<p class="lead">Log in to ask Cortex up to <strong>10 questions a day</strong>.</p>

	{#if !session.auth.ready}
		<p class="warn">Login isn't configured on this server yet.</p>
	{:else}
		{#if session.auth.google}
			<a class="google" href="/auth/google">
				<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
					<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
					<path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
					<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
					<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
				</svg>
				Continue with Google
			</a>
			<div class="or"><span>or</span></div>
		{/if}

		{#if result?.ok && result.devLink}
			<div class="dev">
				<p>{result.message}</p>
				<a href={result.devLink}>Sign in as {email.trim()}</a>
			</div>
		{:else if result?.ok}
			<p class="sent">{result.message}</p>
		{:else}
			<form onsubmit={sendLink}>
				<label for="login-email">Email me a sign-in link</label>
				<div class="row">
					<input
						id="login-email"
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						autocomplete="email"
						required
						maxlength="254"
					/>
					<button type="submit" disabled={sending || !email.trim()}>{sending ? 'Sending…' : 'Send link'}</button>
				</div>
				{#if result && !result.ok}<p class="err">{result.message}</p>{/if}
			</form>
		{/if}
		<p class="fine">No password needed. You'll stay signed in on this device for 30 days.</p>
	{/if}
</Modal>

<style>
	.lead {
		margin: 0 0 18px;
		color: #cbd5e1;
	}
	.google {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 11px 14px;
		border-radius: 10px;
		background: #fff;
		color: #1f2937;
		font-weight: 600;
		text-decoration: none;
	}
	.google:hover {
		background: #f1f5f9;
	}
	.or {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 16px 0;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(148, 163, 184, 0.2);
	}
	label {
		display: block;
		font-size: 0.85rem;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		min-width: 0;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
		font: inherit;
	}
	button {
		padding: 10px 14px;
		border-radius: 10px;
		border: none;
		background: #0ea5e9;
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.sent {
		padding: 12px;
		border-radius: 10px;
		background: rgba(52, 211, 153, 0.1);
		border: 1px solid rgba(52, 211, 153, 0.4);
		color: #a7f3d0;
	}
	.dev {
		padding: 12px;
		border-radius: 10px;
		background: rgba(251, 191, 36, 0.08);
		border: 1px solid rgba(251, 191, 36, 0.45);
		color: #fde68a;
		font-size: 0.88rem;
	}
	.dev p {
		margin: 0 0 10px;
	}
	.dev a {
		display: inline-block;
		padding: 8px 14px;
		border-radius: 8px;
		background: #f59e0b;
		color: #111827;
		font-weight: 600;
		text-decoration: none;
	}
	.err,
	.warn {
		color: #fca5a5;
		font-size: 0.88rem;
	}
	.fine {
		margin: 16px 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
</style>
