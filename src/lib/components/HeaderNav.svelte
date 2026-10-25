<!-- Top-right header: Experience · Projects · Log in / account menu. -->
<script lang="ts">
	import { session, type ClientUser } from '$lib/session.svelte';

	// From the page's server data (not the client store), so it renders correctly on the server too.
	let { user }: { user: ClientUser | null } = $props();

	let menuOpen = $state(false);
	// The nickname as changed in this visit, else as the page loaded with it.
	const nickname = $derived(session.playerName !== undefined ? session.playerName : (user?.nickname ?? null));
	const who = $derived(nickname || user?.name || user?.email || '');
	const initial = $derived((who || '?').trim()[0]?.toUpperCase() ?? '?');

	// Change nickname (checked on the server: length, characters, offensive words, unique).
	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let error = $state('');
	function startEdit() {
		draft = nickname ?? '';
		error = '';
		editing = true;
	}
	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		const r = await session.savePlayerName(draft);
		saving = false;
		if (r.ok) editing = false;
		else error = r.message ?? 'Could not save that nickname.';
	}
</script>

<svelte:window
	onclick={() => {
		menuOpen = false;
		editing = false;
	}}
/>

<nav class="nav" aria-label="Main">
	<button class="link" onclick={() => (session.experienceOpen = true)}>Experience</button>
	<button class="link" onclick={() => (session.projectsOpen = true)}>Projects</button>
	{#if user}
		<div class="account">
			<button
				class="avatar"
				class:member={user.isMember}
				onclick={(e) => {
					e.stopPropagation();
					menuOpen = !menuOpen;
				}}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-label="Account"
				title={user.email}>{initial}</button
			>
			{#if menuOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()}>
					<p class="who">{who}</p>
					{#if who !== user.email}<p class="email">{user.email}</p>{/if}
					{#if user.isMember}<span class="badge">★ Member</span>{/if}
					{#if editing}
						<form class="nick" onsubmit={save}>
							<label for="nickname">Nickname</label>
							<input
								id="nickname"
								bind:value={draft}
								maxlength="16"
								autocomplete="nickname"
								spellcheck="false"
								placeholder="3–16 letters or numbers"
							/>
							{#if error}<p class="err" role="alert">{error}</p>{:else}<p class="hint">Shown on the E.Ngine Games leaderboards. Keep it friendly.</p>{/if}
							<div class="row">
								<button type="submit" class="save" disabled={saving || draft.trim().length < 3}>{saving ? 'Saving…' : 'Save'}</button>
								<button type="button" class="cancel" onclick={() => (editing = false)}>Cancel</button>
							</div>
						</form>
					{:else}
						<button class="edit" role="menuitem" onclick={startEdit}>{nickname ? 'Change nickname' : 'Set a nickname'}</button>
					{/if}
					<button class="out" role="menuitem" onclick={() => session.logout()}>Log out</button>
				</div>
			{/if}
		</div>
	{:else}
		<button class="login" onclick={() => (session.loginOpen = true)}>Log in</button>
	{/if}
</nav>

<style>
	.nav {
		position: absolute;
		top: 20px;
		right: max(16px, 4vw);
		z-index: 22;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px;
		border-radius: 999px;
		background: rgba(10, 14, 26, 0.6);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(148, 163, 184, 0.16);
	}
	button {
		font: inherit;
		cursor: pointer;
	}
	.link {
		padding: 7px 14px;
		border-radius: 999px;
		border: none;
		background: none;
		color: #cbd5e1;
		font-size: 0.9rem;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.link:hover {
		background: rgba(56, 189, 248, 0.12);
		color: #fff;
	}
	.login {
		padding: 7px 16px;
		border-radius: 999px;
		border: none;
		background: linear-gradient(90deg, #0ea5e9, #8b5cf6);
		color: #fff;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.account {
		position: relative;
	}
	.avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 2px solid #38bdf8;
		background: #0b1020;
		color: #e0f2fe;
		font-weight: 700;
	}
	.avatar.member {
		border-color: #f0abfc;
		box-shadow: 0 0 14px -2px #f0abfc;
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		min-width: 220px;
		padding: 14px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.96);
		border: 1px solid rgba(148, 163, 184, 0.2);
		box-shadow: 0 20px 50px -18px rgba(0, 0, 0, 0.9);
		outline: none;
	}
	.who {
		margin: 0;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.email {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 0.82rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.badge {
		display: inline-block;
		margin-top: 8px;
		padding: 2px 9px;
		border-radius: 99px;
		font-size: 0.75rem;
		color: #f5d0fe;
		border: 1px solid rgba(240, 171, 252, 0.5);
	}
	.edit {
		display: block;
		width: 100%;
		margin-top: 12px;
		padding: 8px;
		border-radius: 9px;
		border: 1px solid rgba(129, 140, 248, 0.4);
		background: rgba(99, 102, 241, 0.12);
		color: var(--text);
	}
	.edit:hover {
		border-color: #818cf8;
	}
	.nick {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 12px;
		width: 240px;
	}
	.nick label {
		font-size: 0.8rem;
		font-weight: 600;
	}
	.nick input {
		padding: 7px 9px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
	}
	.nick input:focus {
		outline: none;
		border-color: #818cf8;
	}
	.nick .hint,
	.nick .err {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.nick .err {
		color: #fca5a5;
	}
	.nick .row {
		display: flex;
		gap: 6px;
	}
	.save,
	.cancel {
		flex: 1;
		padding: 7px;
		border-radius: 8px;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.save {
		border: none;
		background: #6366f1;
		color: #fff;
		font-weight: 600;
	}
	.save:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.cancel {
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: none;
		color: var(--text);
	}
	.out {
		display: block;
		width: 100%;
		margin-top: 12px;
		padding: 8px;
		border-radius: 9px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: none;
		color: var(--text);
	}
	.out:hover {
		border-color: #fca5a5;
		color: #fca5a5;
	}
	@media (max-width: 560px) {
		.nav {
			top: 14px;
			right: 10px;
			gap: 2px;
		}
		.link {
			padding: 6px 8px;
			font-size: 0.8rem;
		}
		.login {
			padding: 6px 11px;
			font-size: 0.8rem;
		}
	}
	@media (max-width: 360px) {
		.link {
			padding: 5px 6px;
			font-size: 0.74rem;
		}
		.login {
			padding: 5px 9px;
			font-size: 0.74rem;
		}
	}
</style>
