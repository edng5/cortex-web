<!--
  Large YouTube player for nodes with a `playlist` (the members-only Surprise! node),
  with a carousel of every video in the playlist underneath. ←/→ step through videos.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Modal from './Modal.svelte';
	import type { OntologyNode } from '$lib/types';

	let { node, onclose }: { node: OntologyNode; onclose: () => void } = $props();

	interface Video {
		id: string;
		title: string;
	}
	let listId = $state<string | null>(null);
	let videos = $state<Video[]>([]);
	let index = $state(0);
	let autoplay = $state(false); // only after the visitor picks a video
	let loading = $state(true);
	let strip: HTMLDivElement | undefined = $state();

	onMount(async () => {
		try {
			const res = await fetch(`/api/playlist?node=${encodeURIComponent(node.id)}`);
			if (res.ok) {
				const data = await res.json();
				listId = data.listId;
				videos = data.videos ?? [];
			}
		} finally {
			loading = false;
		}
		if (!listId && node.playlist) listId = new URL(node.playlist).searchParams.get('list');
	});

	const current = $derived(videos[index]);
	const src = $derived.by(() => {
		if (!listId) return null;
		const base = 'https://www.youtube-nocookie.com/embed/';
		const list = `list=${encodeURIComponent(listId)}&rel=0${autoplay ? '&autoplay=1' : ''}`;
		// Play the chosen video within the playlist; without the video list, play the playlist itself.
		return current ? `${base}${current.id}?${list}` : `${base}videoseries?${list}`;
	});

	async function play(i: number) {
		if (!videos.length) return;
		index = (i + videos.length) % videos.length;
		autoplay = true;
		await tick();
		strip?.querySelector<HTMLElement>('.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	}

	function scrollStrip(dir: number) {
		strip?.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: 'smooth' });
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
		if (e.key === 'ArrowRight') play(index + 1);
		else if (e.key === 'ArrowLeft') play(index - 1);
	}
</script>

<svelte:window onkeydown={onKey} />

<Modal title={node.title} width="1100px" {onclose}>
	{#if node.summary}<p class="summary">{node.summary}</p>{/if}

	{#if src}
		<div class="player">
			{#key src}
				<iframe
					{src}
					title={current?.title ?? `${node.title} playlist`}
					allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
				></iframe>
			{/key}
		</div>
		{#if current}
			<div class="now">
				<span class="label">Now playing</span>
				<strong>{current.title}</strong>
				<span class="count">{index + 1} / {videos.length}</span>
			</div>
		{/if}
	{:else if !loading}
		<p>No playlist configured.</p>
	{/if}

	{#if videos.length > 1}
		<div class="carousel" aria-label="Videos in this playlist">
			<button class="nav" onclick={() => scrollStrip(-1)} aria-label="Scroll left">‹</button>
			<div class="strip" bind:this={strip}>
				{#each videos as v, i (v.id)}
					<button class="video" class:active={i === index} onclick={() => play(i)} aria-current={i === index}>
						<span class="thumb">
							<img src="https://i.ytimg.com/vi/{v.id}/mqdefault.jpg" alt="" loading="lazy" />
							{#if i === index}<span class="playing" aria-hidden="true">▶</span>{/if}
						</span>
						<span class="title">{v.title}</span>
					</button>
				{/each}
			</div>
			<button class="nav" onclick={() => scrollStrip(1)} aria-label="Scroll right">›</button>
		</div>
	{:else if loading}
		<p class="loading">Loading videos…</p>
	{/if}
</Modal>

<style>
	.summary {
		margin: -6px 0 14px;
		color: var(--muted);
	}
	.player {
		position: relative;
		aspect-ratio: 16 / 9;
		/* Leave room for the title row and the video strip below, without scrolling. */
		max-width: calc((100svh - 360px) * 16 / 9);
		margin: 0 auto;
		border-radius: 12px;
		overflow: hidden;
		background: #000;
		box-shadow: 0 0 60px -14px rgba(240, 171, 252, 0.55);
		border: 1px solid rgba(240, 171, 252, 0.45);
	}
	iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.now {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 12px 2px 4px;
		min-width: 0;
	}
	.label {
		flex: none;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #f0abfc;
	}
	.now strong {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.count {
		flex: none;
		color: var(--muted);
		font-size: 0.82rem;
	}
	.carousel {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}
	.nav {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(255, 255, 255, 0.04);
		color: #fff;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
	}
	.nav:hover {
		border-color: #f0abfc;
	}
	.strip {
		flex: 1;
		display: flex;
		gap: 12px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		padding: 6px 2px 10px;
		scrollbar-width: thin;
	}
	.video {
		flex: none;
		width: 176px;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		scroll-snap-align: start;
		opacity: 0.75;
		transition:
			opacity 0.2s,
			transform 0.2s;
	}
	.video:hover {
		opacity: 1;
		transform: translateY(-2px);
	}
	.video.active {
		opacity: 1;
	}
	.thumb {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		border-radius: 9px;
		overflow: hidden;
		border: 2px solid transparent;
		background: #111827;
	}
	.video.active .thumb {
		border-color: #f0abfc;
		box-shadow: 0 0 18px -4px #f0abfc;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.playing {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.35);
		color: #fff;
		font-size: 22px;
	}
	.title {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin-top: 6px;
		font-size: 0.8rem;
		line-height: 1.35;
	}
	.loading {
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
