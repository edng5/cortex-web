<!--
  Pick a nickname: shown to anyone signed in who doesn't have one yet (right after typing their
  sign-in code, or after signing in with Google). It's their name on the leaderboards, in the
  FishMart showcase and market, and what SpeakEase's characters call them. It can't be skipped
  (only signing out leaves it); the nickname can be changed later from the account menu.
-->
<script lang="ts">
	import Modal from './Modal.svelte';
	import { session } from '$lib/session.svelte';

	let draft = $state('');
	let saving = $state(false);
	let message = $state('');
	let input = $state<HTMLInputElement>();

	$effect(() => {
		input?.focus();
	});

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (saving || draft.trim().length < 3) return;
		saving = true;
		message = '';
		const r = await session.savePlayerName(draft.trim());
		saving = false;
		// Saved: the box closes (session.playerName is set). SpeakEase greets by nickname from the
		// start, so reload it there to use the new one.
		if (r.ok && location.pathname.startsWith('/speakeaseai')) location.reload();
		else if (!r.ok) message = r.message ?? 'Could not save that nickname.';
	}
</script>

<!-- Closing does nothing: a nickname has to be chosen (or sign out). -->
<Modal title="Choose your nickname" width="420px" z={95} closable={false} onclose={() => {}}>
	<form class="nick" onsubmit={save}>
		<label for="nickname">Nickname</label>
		<div class="row">
			<input
				id="nickname"
				bind:this={input}
				bind:value={draft}
				maxlength="16"
				minlength="3"
				autocomplete="nickname"
				placeholder="3–16 letters or numbers"
				spellcheck="false"
				oninput={() => (message = '')}
			/>
			<button type="submit" disabled={saving || draft.trim().length < 3}>{saving ? 'Saving…' : 'Save'}</button>
		</div>
		{#if message}
			<p class="err" role="alert">{message}</p>
		{:else}
			<p class="hint">Letters, numbers, spaces and _ . - only. Keep it friendly: offensive nicknames are rejected. You can change it any time from your account menu.</p>
		{/if}
		<button type="button" class="link" onclick={() => session.logout()}>Not you? Sign out</button>
	</form>
</Modal>

<style>
	.nick {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	label {
		font-size: 0.85rem;
		color: var(--muted, #94a3b8);
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
		background: rgba(255, 255, 255, 0.05);
		color: inherit;
		font: inherit;
	}
	input:focus {
		outline: none;
		border-color: #38bdf8;
	}
	button[type='submit'] {
		padding: 10px 16px;
		border: none;
		border-radius: 10px;
		background: linear-gradient(135deg, #38bdf8, #6366f1);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--muted, #94a3b8);
	}
	.err {
		margin: 0;
		font-size: 0.85rem;
		color: #f87171;
	}
	.link {
		align-self: flex-start;
		margin-top: 4px;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted, #94a3b8);
		font: inherit;
		font-size: 0.8rem;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
