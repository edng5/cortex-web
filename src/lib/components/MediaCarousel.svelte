<!--
  Carousel for a node's pictures/videos: one large stage, prev/next arrows,
  counter, caption, and a thumbnail strip. Swipe on touch, ←/→ on keyboard.
  Only the current slide is mounted, so a playing video stops when you move on.
-->
<script lang="ts">
	import MediaItem from './MediaItem.svelte';
	import type { MediaItem as Media } from '$lib/media';
	import { lightbox } from '$lib/lightbox.svelte';

	let {
		items,
		title,
		stageHeight = '58svh',
		keyboard = false,
		thumbs = true,
		round = false
	}: {
		items: Media[];
		title: string;
		stageHeight?: string;
		keyboard?: boolean;
		thumbs?: boolean;
		/** Headshot style: pictures cropped to circles (stage + thumbnails). */
		round?: boolean;
	} = $props();

	let index = $state(0);
	const current = $derived(items[Math.min(index, items.length - 1)]);
	let strip: HTMLDivElement | undefined = $state();

	function go(i: number) {
		index = (i + items.length) % items.length;
		strip?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	}

	function onKey(e: KeyboardEvent) {
		if (!keyboard || items.length < 2) return;
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (e.key === 'ArrowRight') go(index + 1);
		else if (e.key === 'ArrowLeft') go(index - 1);
	}

	// Swipe (touch/pen) on the stage.
	let startX: number | null = null;
	function down(e: PointerEvent) {
		if (e.pointerType !== 'mouse') startX = e.clientX;
	}
	function up(e: PointerEvent) {
		if (startX === null) return;
		const dx = e.clientX - startX;
		startX = null;
		if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
	}

	function thumbOf(m: Media): string | null {
		if (m.kind === 'image') return m.src;
		if (m.kind === 'embed') return m.thumb ?? null;
		return null;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="carousel" class:round role="region" aria-roledescription="carousel" aria-label="{title} media">
	<div class="stage" onpointerdown={down} onpointerup={up} role="presentation" style="--stage-h: {stageHeight}">
		{#key current.src}
			<div class="slide">
				{#if round && current.kind === 'image'}
					<div class="avatar-stage">
						<button
							class="avatar"
							onclick={() => lightbox.show(current.src, current.caption)}
							aria-label="View {current.caption ?? 'photo'} full size"
						>
							<img src={current.src} alt={current.caption ?? ''} />
						</button>
					</div>
				{:else}
					<MediaItem item={current} {title} maxHeight={stageHeight} stage showCaption={false} />
				{/if}
			</div>
		{/key}

		{#if items.length > 1}
			<button class="nav prev" onclick={() => go(index - 1)} aria-label="Previous">‹</button>
			<button class="nav next" onclick={() => go(index + 1)} aria-label="Next">›</button>
			<span class="count" aria-live="polite">{index + 1} / {items.length}</span>
		{/if}
	</div>

	{#if current.caption}
		{#if round && current.caption.includes(' — ')}
			{@const [name, ...role] = current.caption.split(' — ')}
			<p class="caption"><strong>{name}</strong> <span class="role">— {role.join(' — ')}</span></p>
		{:else}
			<p class="caption">{current.caption}</p>
		{/if}
	{/if}

	{#if thumbs && items.length > 1}
		<div class="thumbs" bind:this={strip}>
			{#each items as m, i (m.src)}
				{@const t = thumbOf(m)}
				<button
					class="thumb"
					class:active={i === index}
					onclick={() => go(i)}
					aria-label="Show item {i + 1}"
					aria-current={i === index}
				>
					{#if t}<img src={t} alt="" loading="lazy" />{/if}
					{#if m.kind !== 'image'}<span class="play" aria-hidden="true">▶</span>{/if}
				</button>
			{/each}
		</div>
	{:else if items.length > 1}
		<div class="dots" aria-hidden="true">
			{#each items as m, i (m.src)}<span class:active={i === index}></span>{/each}
		</div>
	{/if}
</div>

<style>
	/* ── Round (headshot) style ── */
	.avatar-stage {
		height: var(--stage-h);
		display: grid;
		place-items: center;
		border-radius: 14px;
		background: radial-gradient(
			circle at 50% 50%,
			color-mix(in srgb, var(--accent, #38bdf8) 16%, transparent),
			transparent 65%
		);
	}
	.avatar {
		width: min(78%, calc(var(--stage-h) - 24px));
		aspect-ratio: 1;
		padding: 0;
		border-radius: 50%;
		overflow: hidden;
		border: 3px solid color-mix(in srgb, var(--accent, #38bdf8) 70%, white 10%);
		box-shadow:
			0 0 0 6px color-mix(in srgb, var(--accent, #38bdf8) 15%, transparent),
			0 0 40px -6px color-mix(in srgb, var(--accent, #38bdf8) 70%, transparent);
		background: #0b1020;
		cursor: zoom-in;
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 30%; /* keep faces, not chests, in frame */
		display: block;
	}
	.round .thumbs {
		justify-content: center;
	}
	.round .thumb {
		width: 44px;
		height: 44px;
		border-radius: 50%;
	}
	.round .thumb img {
		object-position: 50% 30%;
	}
	.round .caption {
		color: #e2e8f0;
		font-size: 0.95rem;
	}
	.round .caption strong {
		font-weight: 650;
	}
	.round .role {
		color: var(--muted);
		font-weight: 400;
	}

	.carousel {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.stage {
		position: relative;
		touch-action: pan-y;
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
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(5, 7, 13, 0.6);
		backdrop-filter: blur(6px);
		color: #fff;
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
		opacity: 0.75;
		transition:
			opacity 0.2s,
			background 0.2s;
	}
	.stage:hover .nav,
	.nav:focus-visible {
		opacity: 1;
	}
	.nav:hover {
		background: color-mix(in srgb, var(--accent, #38bdf8) 45%, rgba(5, 7, 13, 0.6));
	}
	.prev {
		left: 10px;
	}
	.next {
		right: 10px;
	}
	.count {
		position: absolute;
		top: 10px;
		right: 10px;
		padding: 3px 9px;
		border-radius: 99px;
		font-size: 0.75rem;
		background: rgba(5, 7, 13, 0.65);
		color: #e2e8f0;
		pointer-events: none;
	}
	.caption {
		margin: 0 4px;
		font-size: 0.85rem;
		color: var(--muted);
		text-align: center;
	}
	.thumbs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 2px 2px 6px;
		scrollbar-width: thin;
	}
	.thumb {
		position: relative;
		flex: none;
		width: 64px;
		height: 48px;
		padding: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid transparent;
		background: #111827;
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity 0.2s,
			border-color 0.2s;
	}
	.thumb:hover {
		opacity: 0.85;
	}
	.thumb.active {
		opacity: 1;
		border-color: var(--accent, #38bdf8);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
		font-size: 14px;
		text-shadow: 0 0 6px #000;
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: 6px;
	}
	.dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(148, 163, 184, 0.4);
	}
	.dots span.active {
		background: var(--accent, #38bdf8);
	}
</style>
