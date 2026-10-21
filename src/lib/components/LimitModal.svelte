<!-- Shown when the visitor runs out of Cortex questions. -->
<script lang="ts">
	import Modal from './Modal.svelte';
	import { session } from '$lib/session.svelte';

	const loggedIn = $derived(!!session.user);
	function login() {
		session.limitOpen = false;
		session.loginOpen = true;
	}
</script>

<Modal title={loggedIn ? "That's all for today" : 'Out of free questions'} width="420px" onclose={() => (session.limitOpen = false)}>
	<div class="icon" aria-hidden="true">{loggedIn ? '🌙' : '🧠'}</div>
	<p>{session.limitMessage}</p>
	<p class="sub">You can still explore everything by clicking the neurons.</p>
	<div class="actions">
		{#if !loggedIn}
			<button class="primary" onclick={login}>Log in</button>
		{/if}
		<button class="ghost" onclick={() => (session.limitOpen = false)}>{loggedIn ? 'OK' : 'Maybe later'}</button>
	</div>
</Modal>

<style>
	.icon {
		font-size: 2rem;
		margin-bottom: 6px;
	}
	p {
		margin: 0 0 10px;
		color: #e2e8f0;
	}
	.sub {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	button {
		padding: 10px 16px;
		border-radius: 10px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.primary {
		border: none;
		background: #0ea5e9;
		color: #fff;
	}
	.ghost {
		background: none;
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: var(--text);
	}
</style>
