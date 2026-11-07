<!--
  Pop-up shell: dimmed backdrop, centred card, closes on Esc / backdrop click.
  Esc is caught first so it closes only this pop-up, not the info panel underneath.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { swipeDismiss } from '$lib/actions/swipe-dismiss';

	let {
		title,
		onclose,
		width = '640px',
		bare = false,
		swipeClose = false,
		z = 60,
		closable = true,
		children
	}: {
		title: string;
		onclose: () => void;
		width?: string;
		bare?: boolean;
		/** Phones: swipe the card down to close it (for node views, not pop-ups with draggable content). */
		swipeClose?: boolean;
		/** Stacking layer (60, above the page; higher for pop-ups opened over the games window, at 80). */
		z?: number;
		/** false: no ✕ (a step that has to be finished, like choosing a nickname). */
		closable?: boolean;
		children: Snippet;
	} = $props();
	let swiped = $state(false);

	let card: HTMLElement;
	$effect(() => {
		card?.focus({ preventScroll: true });
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopImmediatePropagation();
			onclose();
		}
	}
</script>

<svelte:window onkeydowncapture={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" style="z-index: {z}" transition:fade={{ duration: 180 }} onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div
		class="card"
		class:bare
		bind:this={card}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		style="--w: {width}"
		transition:fly={{ y: 16, duration: swiped ? 0 : 220 }}
		use:swipeDismiss={{
			enabled: swipeClose,
			ondismiss: () => {
				swiped = true;
				onclose();
			}
		}}
	>
		{#if !bare}
			<header>
				<h2>{title}</h2>
				{#if closable}<button class="close" onclick={onclose} aria-label="Close">✕</button>{/if}
			</header>
		{/if}
		{@render children()}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(3, 5, 10, 0.72);
		backdrop-filter: blur(6px);
	}
	.card {
		width: min(var(--w), 100%);
		max-height: calc(100svh - 32px);
		overflow-y: auto;
		padding: 22px 24px 26px;
		border-radius: 18px;
		background: rgba(10, 14, 26, 0.94);
		border: 1px solid rgba(148, 163, 184, 0.18);
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.9),
			0 0 60px -20px rgba(56, 189, 248, 0.35);
		outline: none;
	}
	.card.bare {
		padding: 0;
		background: transparent;
		border: none;
		box-shadow: none;
		overflow: visible;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.close {
		background: none;
		border: none;
		color: var(--muted);
		font-size: 18px;
		cursor: pointer;
		padding: 4px 8px;
	}
	.close:hover {
		color: var(--text);
	}
</style>
