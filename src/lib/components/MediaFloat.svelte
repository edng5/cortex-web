<!--
  Desktop: the selected node's extra pictures/videos (not its icon — that's in the
  info panel) float on the left, over the graph.
  Pictures fade out when the node is closed or switched (|global: the parent block is what
  gets removed, so local transitions would be skipped).
  Pictures float as a draggable pile by default; a node can switch to a carousel with
  `mediaLayout: carousel`, or to frameless cut-outs placed like a team photo with
  `mediaLayout: portrait`.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import MediaBento from './MediaBento.svelte';
	import MediaCarousel from './MediaCarousel.svelte';
	import type { MediaItem as Media } from '$lib/media';
	import type { PortraitSpot } from '$lib/types';

	let {
		items,
		title,
		accent,
		layout,
		portrait
	}: {
		items: Media[];
		title: string;
		accent: string;
		layout?: 'float' | 'carousel' | 'gallery' | 'portrait';
		portrait?: Record<string, PortraitSpot>;
	} = $props();
	// Desktop default is floating, draggable pictures; a node opts into the carousel
	// with `mediaLayout: carousel` (e.g. NEOS's simulation GIFs).
	const carousel = $derived(layout === 'carousel');
</script>

<section class="float" class:free={!carousel} aria-label="{title} media" style="--accent: {accent}">
	{#if carousel}
		<div class="card" in:fly|global={{ x: -40, duration: 380 }} out:fade|global={{ duration: 280 }}>
			<MediaCarousel {items} {title} keyboard stageHeight="min(62svh, 560px)" />
		</div>
	{:else}
		<div class="bento-wrap" out:fade|global={{ duration: 280 }}>
			<MediaBento {items} {title} portrait={layout === 'portrait' ? portrait : undefined} />
		</div>
	{/if}
</section>

<style>
	.float {
		position: fixed;
		top: 20px;
		left: 20px;
		bottom: 20px;
		width: var(--media-w, 420px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: safe center;
		overflow-y: auto;
		z-index: 25;
		scrollbar-width: none;
		/* Clicks pass through empty space to the graph; tiles/cards re-enable them. */
		pointer-events: none;
	}
	/* Free-floating tiles may be dragged anywhere, so don't clip them to the column. */
	.float.free {
		overflow: visible;
		z-index: 35;
	}
	.bento-wrap {
		width: 100%;
	}
	.card {
		pointer-events: auto;
		flex: none;
		width: 100%;
		padding: 12px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.78);
		backdrop-filter: blur(16px);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, rgba(148, 163, 184, 0.2));
		box-shadow:
			0 24px 50px -20px rgba(0, 0, 0, 0.95),
			0 0 40px -12px color-mix(in srgb, var(--accent) 55%, transparent);
		animation: drift 8s ease-in-out infinite;
	}
	.card:hover {
		animation-play-state: paused;
	}
	@keyframes drift {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-7px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
	}
</style>
