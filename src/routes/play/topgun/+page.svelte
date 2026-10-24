<!-- Standalone page for Top Gun (the site normally opens it as a pop-up). -->
<script lang="ts">
	import TopGunGame from '$lib/components/TopGunGame.svelte';
	import { site } from '$lib/config/site';
</script>

<svelte:head>
	<title>Top Gun · {site.fullName}</title>
	<meta name="description" content="Play Top Gun, a flight-combat game Edward made in high school, right in your browser." />
</svelte:head>

<main class="play">
	<TopGunGame />
</main>

<style>
	.play {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 24px 16px;
		background: radial-gradient(ellipse at 50% 30%, rgba(56, 189, 248, 0.12), transparent 60%), #05070d;
		color: var(--text, #e2e8f0);
	}
</style>
