<!--
  E.Ngine Games pop-up: the game being played (picked from the menu on the E.Ngine Games node).
  Leaving a game (Esc, ✕, a click outside, or Quit / Exit in its own menu) closes the pop-up,
  back to the node. Esc, ✕ and clicking outside ask first, so a stray key press doesn't end a
  run; the game pauses while asking. The pop-up stays mounted (hidden and paused), and so does
  every game started in it, so each one is where you left it when reopened.
  On mid-size screens the node has no menu beside it, so the pop-up opens on the menu instead.
-->
<script lang="ts">
	import ArcadeGame from './ArcadeGame.svelte';
	import EngineMenu from './EngineMenu.svelte';
	import { GAMES, gameById } from '$lib/games/registry';
	import { session } from '$lib/session.svelte';
	import { ambient } from '$lib/ambient.svelte';
	import { gameAudio } from '$lib/games/audio.svelte';

	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

	let confirming = $state(false);
	let keepBtn = $state<HTMLButtonElement>();
	/** Games started so far (they stay mounted, paused when not showing). */
	let started = $state<string[]>([]);
	const current = $derived(gameById(session.gameId));

	$effect(() => {
		const id = session.gameId;
		if (id && !started.includes(id)) started = [...started, id];
	});

	function askClose() {
		if (!current) return close();
		confirming = true;
		queueMicrotask(() => keepBtn?.focus());
	}
	function keepPlaying() {
		confirming = false;
	}
	function close() {
		confirming = false;
		session.gameId = null;
		onclose();
	}
	function login() {
		close();
		session.loginOpen = true;
	}

	// The site's background music rests while the games are open (they have their own sound).
	$effect(() => {
		ambient.pause('game', open);
	});

	function onKey(e: KeyboardEvent) {
		if (!open || e.key !== 'Escape') return;
		// Handle Esc here only: not in the game, and not the info panel underneath.
		e.stopImmediatePropagation();
		e.preventDefault();
		if (confirming) keepPlaying();
		else askClose();
	}
</script>

<svelte:window onkeydowncapture={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="backdrop"
	class:open
	onclick={(e) => e.target === e.currentTarget && askClose()}
	role="dialog"
	aria-modal="true"
	aria-label={current ? current.title : 'E.Ngine Games'}
	aria-hidden={!open}
>
	<div class="card" class:menu={!current}>
		<button class="close" onclick={askClose} aria-label="Close E.Ngine Games">✕</button>
		<button
			class="sound"
			class:off={gameAudio.muted}
			onclick={() => gameAudio.toggle()}
			aria-pressed={!gameAudio.muted}
			aria-label={gameAudio.muted ? 'Turn game sound on' : 'Mute game sound'}
			title={gameAudio.muted ? 'Turn game sound on' : 'Mute game sound'}
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
				{#if gameAudio.muted}
					<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				{:else}
					<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
				{/if}
			</svg>
		</button>
		{#if !current}
			<EngineMenu onpick={(id) => (session.gameId = id)} onlogin={login} />
		{/if}

		{#each GAMES.filter((g) => started.includes(g.id)) as g (g.id)}
			<div class="game" hidden={current?.id !== g.id}>
				<ArcadeGame spec={g} active={open && !confirming && current?.id === g.id} onquit={close} />
			</div>
		{/each}

		{#if confirming}
			<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
				<div class="box">
					<h2 id="leave-title">Leave the game?</h2>
					<p>It keeps your place: reopen it any time before you leave the site. High scores are saved.</p>
					<div class="actions">
						<button class="keep" bind:this={keepBtn} onclick={keepPlaying}>Keep playing</button>
						<button class="leave" onclick={close}>Close game</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80; /* above panels and pop-ups, below the lightbox */
		display: none;
		place-items: center;
		padding: 16px;
		background: rgba(3, 5, 10, 0.82);
		backdrop-filter: blur(6px);
		color: var(--text, #e2e8f0);
	}
	.backdrop.open {
		display: grid;
		animation: appear 0.2s ease-out;
	}
	.card {
		position: relative;
		padding: 50px 18px 16px; /* clear of the ✕ */
		border-radius: 18px;
		background: rgba(10, 14, 26, 0.9);
		border: 1px solid rgba(129, 140, 248, 0.35);
		box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.9);
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.card.menu {
		width: min(940px, calc(100vw - 32px));
		padding: 44px 22px 22px; /* clear of the ✕ */
	}
	.game[hidden] {
		display: none;
	}
	.close {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 2;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(10, 14, 26, 0.95);
		color: #fff;
		font-size: 15px;
		cursor: pointer;
	}
	.close:hover {
		border-color: rgba(129, 140, 248, 0.8);
	}
	/* Game sound on/off, beside the ✕. */
	.sound {
		position: absolute;
		top: 8px;
		right: 50px;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(10, 14, 26, 0.95);
		color: #c7d2fe;
		cursor: pointer;
	}
	.sound.off {
		color: #64748b;
	}
	.sound:hover {
		border-color: rgba(129, 140, 248, 0.8);
	}
	/* "Leave the game?" — over the game itself, so the game stays visible behind it. */
	.confirm {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		border-radius: 18px;
		background: rgba(3, 5, 10, 0.7);
		backdrop-filter: blur(3px);
		animation: appear 0.15s ease-out;
	}
	.box {
		width: min(340px, calc(100% - 32px));
		padding: 20px 22px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.96);
		border: 1px solid rgba(129, 140, 248, 0.4);
		box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.9);
		text-align: center;
	}
	.box h2 {
		margin: 0 0 6px;
		font-size: 1.1rem;
	}
	.box p {
		margin: 0 0 16px;
		color: var(--muted, #94a3b8);
		font-size: 0.88rem;
	}
	.actions {
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	.actions button {
		padding: 9px 16px;
		border-radius: 10px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.keep {
		border: none;
		background: #6366f1;
		color: #fff;
	}
	.keep:hover {
		background: #4f46e5;
	}
	.leave {
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: transparent;
		color: #e2e8f0;
	}
	.leave:hover {
		border-color: #fca5a5;
		color: #fca5a5;
	}
	/* Touch screens: the game edge to edge at the top, controls below (or beside, in landscape),
	   and the ✕ / sound buttons large in the top corner. */
	@media (pointer: coarse) {
		.backdrop {
			padding: 0;
			place-items: start center;
			background: #03050a;
		}
		.card:not(.menu) {
			width: 100vw;
			height: 100svh;
			max-height: none;
			padding: 52px 0 0;
			border: none;
			border-radius: 0;
			background: #03050a;
			overflow: hidden;
		}
		.card.menu {
			margin-top: 12px;
			max-height: calc(100svh - 24px);
		}
		.close,
		.sound {
			width: 42px;
			height: 42px;
			top: 6px;
		}
		.close {
			right: 8px;
		}
		.sound {
			right: 58px;
		}
	}
	@media (pointer: coarse) and (orientation: landscape) {
		.card:not(.menu) {
			padding-top: 6px;
		}
		.backdrop {
			place-items: center;
		}
	}
	@keyframes appear {
		from {
			opacity: 0;
		}
	}
</style>
