<script lang="ts">
	import NeuralGraph from '$lib/components/NeuralGraph.svelte';
	import NodePanel from '$lib/components/NodePanel.svelte';
	import CortexDock from '$lib/components/CortexDock.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import MediaFloat from '$lib/components/MediaFloat.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import RotatingTitles from '$lib/components/RotatingTitles.svelte';
	import HeaderNav from '$lib/components/HeaderNav.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import LimitModal from '$lib/components/LimitModal.svelte';
	import ExperienceModal from '$lib/components/ExperienceModal.svelte';
	import ProjectsModal from '$lib/components/ProjectsModal.svelte';
	import PlaylistModal from '$lib/components/PlaylistModal.svelte';
	import GalleryModal from '$lib/components/GalleryModal.svelte';
	import GamePopup from '$lib/components/GamePopup.svelte';
	import EngineMenu from '$lib/components/EngineMenu.svelte';
	import { session } from '$lib/session.svelte';
	import { nodeMedia } from '$lib/media';
	import { cortex } from '$lib/cortex.svelte';
	import { site, typeStyle } from '$lib/config/site';
	import { NODE_TYPES, type NodeType } from '$lib/types';
	import { rankBySize } from '$lib/graph-rank';
	import { onMount } from 'svelte';

	let { data } = $props();

	// The session store is a client-side singleton: only fill it in the browser, never during
	// server rendering (that would share one visitor's login with other requests).
	// ($effect.pre runs only in the browser, before the first paint, and again when data changes.)
	$effect.pre(() => session.init(data));

	/** From the Experience / Projects pop-ups: close them and open the node. */
	function openNode(id: string) {
		session.experienceOpen = false;
		session.projectsOpen = false;
		cortex.select(id);
	}

	// Restore a chat lockout (explicit/inappropriate question) before the visitor starts talking.
	onMount(() => {
		cortex.init();
	});
	const graph = $derived(data.graph);
	const found = $derived(graph.nodes.find((n) => n.id === cortex.selectedId) ?? null);
	// Nodes with a playlist (the Surprise!) open a big player, and `mediaLayout: gallery` nodes
	// (Photography) a big centred gallery, instead of the info panel.
	const playlistNode = $derived(found?.playlist ? found : null);
	const galleryNode = $derived(found && !found.playlist && found.mediaLayout === 'gallery' ? found : null);
	const selected = $derived(found && !playlistNode && !galleryNode ? found : null);

	let innerWidth = $state(1200);
	const insetRight = $derived(selected && innerWidth > 720 ? 518 : 0);

	// ‹ › between nodes, biggest neuron first (wraps around). Web: buttons at the screen
	// edges; phones: swipe the info panel sideways.
	const ranked = $derived(rankBySize(graph.nodes, graph.edges));
	const rankIndex = $derived(found ? ranked.findIndex((n) => n.id === found.id) : -1);
	const neighbour = (dir: 1 | -1) =>
		rankIndex < 0 || ranked.length < 2 ? null : ranked[(rankIndex + dir + ranked.length) % ranked.length];
	const prevNode = $derived(neighbour(-1));
	const nextNode = $derived(neighbour(1));
	let enterFrom = $state<1 | -1>(1);
	// The game pop-up mounts on first open and then stays (hidden and paused), keeping your place.
	let gameMounted = $state(false);
	$effect(() => {
		if (session.gameOpen) gameMounted = true;
	});
	function step(dir: 1 | -1) {
		const to = dir === 1 ? nextNode : prevNode;
		if (!to) return;
		enterFrom = dir;
		cortex.select(to.id);
	}

	// Media floats on the left only when there is room for it beside the panel and graph;
	// on narrower screens it lives inside the info panel instead.
	const media = $derived(selected ? nodeMedia(selected) : []);
	// `mediaLayout: arcade` (Mini Games): the E.Ngine Games menu takes the left side instead of
	// pictures, and the node's videos go in the info panel.
	const arcade = $derived(selected?.mediaLayout === 'arcade');
	const floatMedia = $derived(innerWidth > 1024 && (media.length > 0 || arcade));
	const mediaWidth = $derived(Math.round(Math.min(600, Math.max(380, innerWidth * 0.38))));
	// Media may overlap the graph a little, so only shift the graph by about half its width.
	const insetLeft = $derived(floatMedia ? Math.round(mediaWidth * 0.5) : 0);
	// Wide screens: room for the games menu and its monthly leaderboard side by side.
	const arcadeWidth = $derived(innerWidth >= 1480 ? Math.min(mediaWidth + 290, innerWidth - 518 - 64 - 120) : mediaWidth);
	const presentTypes = $derived(NODE_TYPES.filter((t) => graph.nodes.some((n) => n.type === t)));

	// Legend filter: click a type to line its neurons up on the left, click again to clear.
	let filterType = $state<NodeType | null>(null);
	let filterOrder = $state<'date' | 'size'>('date');
	/** Types with dates (experience, education, projects…) can be ordered chronologically. */
	const filterHasDates = $derived(!!filterType && graph.nodes.some((n) => n.type === filterType && n.start));
	function toggleFilter(t: NodeType) {
		filterType = filterType === t ? null : t;
		filterOrder = graph.nodes.some((n) => n.type === t && n.start) ? 'date' : 'size';
	}
</script>

<svelte:window bind:innerWidth />

<main
	class="stage"
	class:media-open={floatMedia}
	data-mode={cortex.mode}
	style="--inset: {insetRight}px; --inset-left: {floatMedia ? mediaWidth + 84 : 0}px; --media-w: {mediaWidth}px"
>
	<NeuralGraph
		{graph}
		mode={cortex.mode}
		activeIds={cortex.activeIds}
		selectedId={cortex.selectedId}
		{insetRight}
		{insetLeft}
		getAudioLevel={() => cortex.audioLevel()}
		onselect={(id) => cortex.select(id)}
		{filterType}
		{filterOrder}
	/>

	<header class="hero">
		<h1><img class="logo" src={site.logo} alt={site.fullName} /></h1>
		<p class="titles"><RotatingTitles titles={site.titles} /></p>
	</header>

	<HeaderNav user={data.user} />

	<div class="legend" role="group" aria-label="Filter neurons by type">
		<ul>
			{#each presentTypes as t (t)}
				<li>
					<button
						class:active={filterType === t}
						class:muted={filterType !== null && filterType !== t}
						aria-pressed={filterType === t}
						onclick={() => toggleFilter(t)}
						title={filterType === t ? 'Show everything' : `Line up ${typeStyle[t].label} on the left`}
					>
						<span class="dot" style="background: {typeStyle[t].color}; color: {typeStyle[t].color}"></span>
						{typeStyle[t].label}
					</button>
				</li>
			{/each}
		</ul>
		{#if filterType}
			<div class="order" role="radiogroup" aria-label="Order">
				<span>Order</span>
				<button
					class:on={filterOrder === 'date'}
					disabled={!filterHasDates}
					onclick={() => (filterOrder = 'date')}
					role="radio"
					aria-checked={filterOrder === 'date'}
					title={filterHasDates ? 'Oldest first' : 'No dates for this type'}>Date</button
				>
				<button class:on={filterOrder === 'size'} onclick={() => (filterOrder = 'size')} role="radio" aria-checked={filterOrder === 'size'} title="Biggest neuron first">Size</button>
				<button class="clear" onclick={() => (filterType = null)} aria-label="Clear filter">✕</button>
			</div>
		{/if}
	</div>

	<CortexDock />

	{#if graph.nodes.length === 0}
		<p class="empty">No neurons yet — add markdown files to <code>content/</code> (see <code>content/_templates</code>).</p>
	{/if}

	<!-- Keyboard / screen-reader access to every node -->
	<nav class="sr-only" aria-label="All topics">
		<ul>
			{#each graph.nodes as n (n.id)}
				<li><button onclick={() => cortex.select(n.id)}>{n.title} ({n.type})</button></li>
			{/each}
		</ul>
	</nav>
</main>

{#if selected}
	{#key selected.id}
		{#if floatMedia && arcade}
			<section class="arcade-dock" style="--media-w: {arcadeWidth}px" aria-label="E.Ngine Games">
				<EngineMenu onpick={(id) => session.openGames(id)} onlogin={() => (session.loginOpen = true)} />
			</section>
		{:else if floatMedia}
			<div style="--media-w: {mediaWidth}px">
				<MediaFloat
					items={media}
					title={selected.title}
					accent={typeStyle[selected.type].color}
					layout={selected.mediaLayout}
					portrait={selected.portrait}
				/>
			</div>
		{/if}
		<NodePanel
			node={selected}
			{graph}
			onclose={() => cortex.reset()}
			onselect={(id) => cortex.select(id)}
			onstep={step}
			{enterFrom}
			inlineMedia={!floatMedia || arcade}
			videosOnly={floatMedia && arcade}
		/>
	{/key}
{/if}

{#if found && innerWidth > 720 && prevNode && nextNode}
	<button class="node-step prev" onclick={() => step(-1)} aria-label="Previous node: {prevNode.title}">
		<span aria-hidden="true">‹</span>
		<span class="tip">{prevNode.title}</span>
	</button>
	<button class="node-step next" onclick={() => step(1)} aria-label="Next node: {nextNode.title}">
		<span aria-hidden="true">›</span>
		<span class="tip">{nextNode.title}</span>
	</button>
{/if}

{#if gameMounted}
	<GamePopup open={session.gameOpen} onclose={() => (session.gameOpen = false)} />
{/if}

{#if playlistNode}
	<PlaylistModal node={playlistNode} onclose={() => cortex.reset()} />
{/if}
{#if galleryNode}
	{#key galleryNode.id}<GalleryModal node={galleryNode} onclose={() => cortex.reset()} />{/key}
{/if}

{#if session.experienceOpen}<ExperienceModal nodes={graph.nodes} onopen={openNode} />{/if}
{#if session.projectsOpen}<ProjectsModal nodes={graph.nodes} edges={graph.edges} onopen={openNode} />{/if}
{#if session.loginOpen}<LoginModal />{/if}
{#if session.limitOpen}<LimitModal />{/if}

<Lightbox />

<SiteFooter />

<style>
	.stage {
		position: relative;
		height: 100svh;
		min-height: 520px;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 40%, rgba(56, 189, 248, 0.07), transparent 60%),
			radial-gradient(ellipse at 80% 90%, rgba(167, 139, 250, 0.06), transparent 50%),
			var(--bg);
		transition: background 0.6s;
	}
	.stage[data-mode='thinking'] {
		background:
			radial-gradient(ellipse at 50% 45%, rgba(56, 189, 248, 0.14), transparent 60%),
			var(--bg);
	}
	.hero {
		position: absolute;
		transition: opacity 0.3s;
		top: 24px;
		left: max(16px, 4vw);
		pointer-events: none;
		max-width: 420px;
	}
	/* Floating media takes over the left side — fade the intro text out of its way. */
	.media-open .hero {
		opacity: 0;
	}
	/* Mini Games: the E.Ngine Games menu where pictures would float. */
	.arcade-dock {
		position: fixed;
		top: 20px;
		bottom: 20px;
		left: 64px; /* room for the "previous node" button at the screen edge */
		width: var(--media-w, 480px);
		z-index: 25;
		display: flex;
		align-items: safe center;
		overflow-y: auto;
		scrollbar-width: none;
		animation: dock-in 0.25s ease-out;
	}
	@keyframes dock-in {
		from {
			opacity: 0;
			transform: translateX(-16px);
		}
	}
	.hero h1 {
		margin: 0;
		line-height: 0;
	}
	.hero .logo {
		height: clamp(30px, 3.6vw, 44px);
		width: auto;
		filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.35));
	}
	.hero .titles {
		margin: 12px 0 0;
		font-size: clamp(1rem, 1.5vw, 1.25rem);
		perspective: 400px;
	}
	/* Phones: a smaller logo so it never runs under the Experience / Projects / Log in pill. */
	@media (max-width: 560px) {
		.hero {
			top: 22px;
			left: 12px;
		}
		.hero .logo {
			height: 22px;
		}
		.hero .titles {
			margin-top: 14px;
			font-size: 0.95rem;
		}
	}
	@media (max-width: 360px) {
		.hero .logo {
			height: 18px;
		}
	}
	.legend {
		position: absolute;
		top: 80px;
		right: max(16px, 4vw);
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.8rem;
		color: var(--muted);
		z-index: 21;
	}
	.legend ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.legend li button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 3px 8px;
		border-radius: 8px;
		border: 1px solid transparent;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			color 0.2s,
			background 0.2s,
			opacity 0.2s;
	}
	.legend li button:hover {
		color: var(--text);
		background: rgba(255, 255, 255, 0.05);
	}
	.legend li button.active {
		color: var(--text);
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(148, 163, 184, 0.25);
	}
	.legend li button.muted {
		opacity: 0.45;
	}
	.legend .dot {
		flex: none;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		box-shadow: 0 0 8px currentColor;
	}
	.legend .order {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		padding-left: 8px;
	}
	.legend .order span {
		margin-right: 2px;
	}
	.legend .order button {
		padding: 2px 8px;
		border-radius: 99px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.legend .order button.on {
		color: #0b1020;
		background: #7dd3fc;
		border-color: #7dd3fc;
	}
	.legend .order button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.legend .order .clear {
		border: none;
		padding: 2px 6px;
	}
	/* Phones: the legend becomes a swipeable row of chips under the header. */
	@media (max-width: 720px) {
		.legend {
			top: 92px;
			left: 0;
			right: 0;
			flex-direction: row;
			align-items: center;
			gap: 8px;
			padding: 0 12px;
			overflow-x: auto;
			scrollbar-width: none;
			font-size: 0.78rem;
		}
		.legend::-webkit-scrollbar {
			display: none;
		}
		.legend ul {
			flex-direction: row;
			gap: 6px;
		}
		.legend li button {
			white-space: nowrap;
			padding: 5px 10px;
			border-radius: 99px;
			border-color: rgba(148, 163, 184, 0.22);
			background: rgba(10, 14, 26, 0.7);
		}
		.legend .order {
			margin: 0;
			padding: 0;
			flex: none;
		}
		.legend .order button {
			padding: 4px 10px;
		}
	}
	.empty {
		position: absolute;
		top: 45%;
		width: 100%;
		text-align: center;
		color: var(--muted);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.sr-only:focus-within {
		position: fixed;
		z-index: 50;
		top: 8px;
		left: 8px;
		width: auto;
		height: auto;
		max-height: 60svh;
		overflow: auto;
		clip: auto;
		background: #0b1020;
		padding: 12px;
		border-radius: 8px;
	}
	/* ‹ › next / previous node (web): fixed at the screen edges, above panels and pop-ups. */
	.node-step {
		position: fixed;
		top: 50%;
		translate: 0 -50%;
		z-index: 70;
		width: 40px;
		height: 64px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(10, 14, 26, 0.72);
		backdrop-filter: blur(10px);
		color: #e2e8f0;
		font-size: 30px;
		line-height: 1;
		cursor: pointer;
		transition:
			background 0.2s,
			border-color 0.2s;
	}
	.node-step:hover {
		background: rgba(30, 41, 59, 0.9);
		border-color: rgba(167, 139, 250, 0.6);
	}
	.node-step.prev {
		left: 12px;
	}
	.node-step.next {
		right: 12px;
	}
	/* The neighbour's name, shown on hover. */
	.node-step .tip {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		white-space: nowrap;
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 0.8rem;
		background: rgba(10, 14, 26, 0.92);
		border: 1px solid rgba(148, 163, 184, 0.25);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s;
	}
	.node-step.prev .tip {
		left: calc(100% + 8px);
	}
	.node-step.next .tip {
		right: calc(100% + 8px);
	}
	.node-step:hover .tip,
	.node-step:focus-visible .tip {
		opacity: 1;
	}
</style>
