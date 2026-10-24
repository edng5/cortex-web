<!--
  Centred photo gallery for nodes with `mediaLayout: gallery` (e.g. Photography):
  a large stage, prev/next, caption + counter, and a thumbnail strip underneath.
  ←/→ step through photos; swipe on touch screens.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Modal from './Modal.svelte';
	import MediaItem from './MediaItem.svelte';
	import { nodeMedia, type MediaItem as Media } from '$lib/media';
	import { typeStyle } from '$lib/config/site';
	import type { OntologyNode } from '$lib/types';

	let { node, onclose }: { node: OntologyNode; onclose: () => void } = $props();

	const items = $derived(nodeMedia(node));
	let index = $state(0);
	const current = $derived<Media | undefined>(items[index]);
	let strip: HTMLDivElement | undefined = $state();

	async function go(i: number) {
		if (!items.length) return;
		index = (i + items.length) % items.length;
		await tick();
		strip?.querySelector<HTMLElement>('.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
		if (e.key === 'ArrowRight') go(index + 1);
		else if (e.key === 'ArrowLeft') go(index - 1);
	}

	// Swipe (touch/pen) on the stage.
	let startX: number | null = null;
	const down = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') startX = e.clientX;
	};
	const up = (e: PointerEvent) => {
		if (startX === null) return;
		const dx = e.clientX - startX;
		startX = null;
		if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
	};

	const thumbOf = (m: Media) => (m.kind === 'image' ? m.src : m.kind === 'embed' ? (m.thumb ?? null) : null);
</script>

<svelte:window onkeydown={onKey} />

<Modal title={node.title} width="1100px" {onclose} swipeClose>
	<div class="gallery" style="--accent: {typeStyle[node.type].color}">
		{#if node.summary}<p class="summary">{node.summary}</p>{/if}

		{#if current}
			<div class="stage" onpointerdown={down} onpointerup={up} role="presentation">
				{#key current.src}
					<div class="slide">
						<MediaItem item={current} title={node.title} stage maxHeight="calc(100svh - 330px)" showCaption={false} />
					</div>
				{/key}
				{#if items.length > 1}
					<button class="nav prev" onclick={() => go(index - 1)} aria-label="Previous photo">‹</button>
					<button class="nav next" onclick={() => go(index + 1)} aria-label="Next photo">›</button>
				{/if}
			</div>

			<div class="now">
				<strong>{current.caption ?? ''}</strong>
				<span class="count">{index + 1} / {items.length}</span>
			</div>
		{/if}

		{#if items.length > 1}
			<div class="strip" bind:this={strip} aria-label="All photos">
				{#each items as m, i (m.src)}
					{@const t = thumbOf(m)}
					<button class="thumb" class:active={i === index} onclick={() => go(i)} aria-label="Show photo {i + 1}" aria-current={i === index}>
						{#if t}<img src={t} alt="" loading="lazy" />{/if}
						{#if m.kind !== 'image'}<span class="play" aria-hidden="true">▶</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</Modal>

<style>
	.summary {
		margin: -6px 0 14px;
		color: var(--muted);
	}
	.stage {
		position: relative;
		touch-action: pan-y;
		border-radius: 12px;
		box-shadow: 0 0 60px -16px color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.stage :global(.media) {
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.slide {
		animation: fade 0.35s ease;
	}
	@keyframes fade {
		from {
			opacity: 0;
			transform: scale(0.985);
		}
	}
	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(5, 7, 13, 0.6);
		backdrop-filter: blur(6px);
		color: #fff;
		font-size: 26px;
		line-height: 1;
		cursor: pointer;
		opacity: 0.8;
		transition:
			opacity 0.2s,
			background 0.2s;
	}
	.stage:hover .nav,
	.nav:focus-visible {
		opacity: 1;
	}
	.nav:hover {
		background: color-mix(in srgb, var(--accent) 45%, rgba(5, 7, 13, 0.6));
	}
	.prev {
		left: 14px;
	}
	.next {
		right: 14px;
	}
	.now {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 12px 2px 6px;
	}
	.count {
		flex: none;
		color: var(--muted);
		font-size: 0.82rem;
	}
	.strip {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding: 6px 2px 10px;
		scrollbar-width: thin;
	}
	.thumb {
		position: relative;
		flex: none;
		width: 72px;
		height: 96px;
		padding: 0;
		border-radius: 9px;
		overflow: hidden;
		border: 2px solid transparent;
		background: #111827;
		cursor: pointer;
		opacity: 0.6;
		transition:
			opacity 0.2s,
			transform 0.2s,
			border-color 0.2s;
	}
	.thumb:hover {
		opacity: 0.9;
		transform: translateY(-2px);
	}
	.thumb.active {
		opacity: 1;
		border-color: var(--accent);
		box-shadow: 0 0 16px -4px var(--accent);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
	}
</style>
