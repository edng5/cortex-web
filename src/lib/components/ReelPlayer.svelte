<!--
  A portrait (9:16) YouTube player for a node's `reels`: plays them one after another and loops,
  with a button per reel to jump to it. `autoplay` starts it muted (browsers only autoplay muted
  video); the viewer can unmute in the player.
-->
<script lang="ts">
	import { youtubeId } from '$lib/media';

	let {
		reels,
		captions = {},
		title,
		height,
		autoplay = false
	}: { reels: string[]; captions?: Record<string, string>; title: string; height: string; autoplay?: boolean } = $props();

	const items = $derived(
		reels.map((url, i) => ({ id: youtubeId(url), label: captions[url] ?? `${title} reel ${i + 1}` })).filter((r) => r.id)
	);
	let current = $state(0);
	let started = $state(false);

	// Start at `current`, then the rest in order, looping (YouTube's playlist + loop parameters).
	const src = $derived.by(() => {
		if (!items.length) return '';
		const order = [...items.slice(current), ...items.slice(0, current)].map((r) => r.id);
		const play = autoplay || started;
		const q = new URLSearchParams({
			playlist: order.join(','),
			loop: '1',
			rel: '0',
			playsinline: '1',
			...(play ? { autoplay: '1' } : {}),
			...(play && !started ? { mute: '1' } : {})
		});
		return `https://www.youtube-nocookie.com/embed/${order[0]}?${q}`;
	});

	function pick(i: number) {
		current = i;
		started = true; // picked by hand: play it with sound
	}
</script>

<div class="reels" style="--h: {height}">
	<div class="frame">
		{#key src}
			<iframe
				{src}
				title={items[current]?.label ?? `${title} reels`}
				allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		{/key}
	</div>
	{#if items.length > 1}
		<div class="picks" role="tablist" aria-label="{title} reels">
			{#each items as r, i (r.id)}
				<button role="tab" aria-selected={i === current} class:on={i === current} onclick={() => pick(i)}>{r.label}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.reels {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}
	.frame {
		height: var(--h);
		aspect-ratio: 9 / 16;
		max-width: 100%;
		border-radius: 18px;
		overflow: hidden;
		background: #000;
		border: 1px solid rgba(148, 163, 184, 0.25);
		box-shadow: 0 30px 70px -25px rgba(0, 0, 0, 0.9);
	}
	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.picks {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		max-width: 420px;
	}
	.picks button {
		padding: 5px 11px;
		border-radius: 99px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(10, 14, 26, 0.85);
		color: var(--muted, #94a3b8);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.picks button:hover {
		color: #e2e8f0;
	}
	.picks button.on {
		border-color: var(--accent, #38bdf8);
		color: #e2e8f0;
	}
</style>
