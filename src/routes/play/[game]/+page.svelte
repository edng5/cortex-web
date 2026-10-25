<!-- Standalone page for one E.Ngine game (the site normally opens them in a pop-up). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ArcadeGame from '$lib/components/ArcadeGame.svelte';
	import { gameById } from '$lib/games/registry';
	import { site } from '$lib/config/site';

	let { data } = $props();
	const spec = $derived(gameById(data.id)!);
	let phone = $state<boolean | null>(null);
	onMount(() => (phone = matchMedia('(max-width: 720px), (pointer: coarse)').matches));
</script>

<svelte:head>
	<title>{spec.title} · {site.fullName}</title>
	<meta name="description" content="Play {spec.title}, a game Edward made in high school, right in your browser." />
</svelte:head>

<main class="play">
	{#if phone}
		<p class="note"><strong>{spec.title} needs a keyboard,</strong> so it's playable on a computer only.</p>
	{:else if phone === false}
		{#key spec.id}<ArcadeGame {spec} />{/key}
	{/if}
</main>

<style>
	.play {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 24px 16px;
		background: radial-gradient(ellipse at 50% 30%, rgba(129, 140, 248, 0.14), transparent 60%), #05070d;
		color: var(--text, #e2e8f0);
	}
	.note {
		max-width: 420px;
		text-align: center;
		color: var(--muted, #94a3b8);
	}
	.note strong {
		color: #e2e8f0;
	}
</style>
