<!-- Top-right header: Experience · Projects · Log in / account menu. -->
<script lang="ts">
	import { session, type ClientUser } from '$lib/session.svelte';

	// From the page's server data (not the client store), so it renders correctly on the server too.
	let { user }: { user: ClientUser | null } = $props();

	let menuOpen = $state(false);
	const initial = $derived((user?.name || user?.email || '?').trim()[0]?.toUpperCase() ?? '?');
</script>

<svelte:window onclick={() => (menuOpen = false)} />

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
					<p class="who">{user.name ?? user.email}</p>
					{#if user.name}<p class="email">{user.email}</p>{/if}
					{#if user.isMember}<span class="badge">★ Member</span>{/if}
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
			padding: 6px 9px;
			font-size: 0.82rem;
		}
		.login {
			padding: 6px 12px;
			font-size: 0.82rem;
		}
	}
</style>
