<!-- Pop-up with full details for a node: body, links, related nodes, and (when
     `inlineMedia` is on, i.e. mobile) its pictures and videos. -->
<script lang="ts">
	import { marked } from 'marked';
	import { fly } from 'svelte/transition';
	import { swipeDismiss } from '$lib/actions/swipe-dismiss';
	import { session } from '$lib/session.svelte';
	import { typeStyle } from '$lib/config/site';
	import { carouselMedia, nodeMedia } from '$lib/media';
	import MediaItem from './MediaItem.svelte';
	import MediaCarousel from './MediaCarousel.svelte';
	import { lightbox } from '$lib/lightbox.svelte';
	import { brandFor } from '$lib/brand';
	import type { GraphData, OntologyNode } from '$lib/types';

	interface Props {
		node: OntologyNode;
		graph: GraphData;
		onclose: () => void;
		onselect: (id: string) => void;
		/** Phones: swipe the panel sideways to step to the next (1) / previous (-1) node by size. */
		onstep?: (dir: 1 | -1) => void;
		/** Which side the panel slides in from: 1 = right (next), -1 = left (previous). */
		enterFrom?: 1 | -1;
		/** Show images/videos inside the panel (mobile). On desktop they float on the left instead. */
		inlineMedia?: boolean;
		/** Only the videos inside the panel (the E.Ngine Games menu has the left side). */
		videosOnly?: boolean;
	}
	let { node, graph, onclose, onselect, onstep, enterFrom = 1, inlineMedia = true, videosOnly = false }: Props = $props();
	const media = $derived(nodeMedia(node, true).filter((m) => !videosOnly || m.kind !== 'image'));

	// Body markdown is your own trusted content from /content.
	const html = $derived(marked.parse(node.body, { async: false }) as string);
	// Split the body at `<!-- carousel: name [round] -->` markers → html / carousel parts, and
	// at `<!-- play: engine -->` (or a game id) markers → an "E.Ngine Games" button that opens the
	// in-browser games (desktop only).
	type BodyPart =
		| { html: string }
		| { carousel: ReturnType<typeof carouselMedia>; round: boolean }
		| { play: string };
	const bodyParts = $derived.by(() => {
		const bits = html.split(/<!--\s*carousel:\s*([\w-]+)(?:\s+(round))?\s*-->/);
		const parts: BodyPart[] = [];
		// split() with 2 capture groups yields [html, name, style, html, name, style, …]
		for (let i = 0; i < bits.length; i += 3) {
			const sub = bits[i].split(/<!--\s*play:\s*([\w-]+)\s*-->/);
			for (let j = 0; j < sub.length; j += 2) {
				parts.push({ html: sub[j] });
				if (j + 1 < sub.length) parts.push({ play: sub[j + 1] });
			}
			if (i + 1 < bits.length) parts.push({ carousel: carouselMedia(node, bits[i + 1]), round: bits[i + 2] === 'round' });
		}
		return parts;
	});
	const style = $derived(typeStyle[node.type]);

	const related = $derived.by(() => {
		const ids = new Set<string>();
		for (const e of graph.edges) {
			if (e.source === node.id) ids.add(e.target);
			if (e.target === node.id) ids.add(e.source);
		}
		return graph.nodes.filter((n) => ids.has(n.id));
	});

	function fmt(d?: string) {
		if (!d) return '';
		const [y, m] = d.split('-');
		if (!m) return y;
		return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
	}
	const dates = $derived(node.start ? `${fmt(node.start)} – ${node.end ? fmt(node.end) : 'Present'}` : '');
	const isQuote = $derived(node.type === 'quote');

	let panel: HTMLElement;
	// Swiped away on a phone: it has already slid off, so skip the sideways exit animation.
	let swiped = $state(false);
	$effect(() => {
		void node.id;
		panel?.scrollTo({ top: 0 });
		panel?.focus({ preventScroll: true });
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<aside
	class="panel"
	bind:this={panel}
	tabindex="-1"
	aria-labelledby="panel-title"
	style="--accent: {style.color}"
	transition:fly={{ x: swiped ? 0 : 40 * enterFrom, duration: swiped ? 0 : 260 }}
	use:swipeDismiss={{
		ondismiss: () => {
			swiped = true;
			onclose();
		},
		onswipex: onstep
			? (dir) => {
					swiped = true;
					onstep(dir);
				}
			: undefined
	}}
>
	<span class="grabber" aria-hidden="true"></span>
	<header>
		<span class="badge">{style.label.replace(/s$/, '')}</span>
		<button class="close" onclick={onclose} aria-label="Close">✕</button>
	</header>

	{#if isQuote}
		<blockquote id="panel-title">“{node.title}”</blockquote>
		{#if node.author}<p class="author">— {node.author}{node.subtitle ? `, ${node.subtitle}` : ''}</p>{/if}
	{:else}
		<div class="title-row">
			{#if node.icon}
				<button
					class="icon-btn"
					class:avatar={node.type === 'about'}
					onclick={() => lightbox.show(node.icon!, node.title)}
					aria-label="View {node.title} logo"
				>
					<img src={node.icon} alt="" class:logo={/\.svg($|\?)/i.test(node.icon)} />
				</button>
			{/if}
			<div class="title-text">
				<h2 id="panel-title">{node.title}</h2>
				{#if node.subtitle}<p class="subtitle">{node.subtitle}</p>{/if}
				{#if dates}<p class="dates">{dates}</p>{/if}
			</div>
		</div>
	{/if}

	{#if node.wip}
		<div class="wip" role="status">
			<span class="wip-icon" aria-hidden="true">🚧</span>
			<div>
				<strong>Work in progress</strong>
				<span>This section is still being written — check back soon.</span>
			</div>
		</div>
	{/if}

	{#if node.summary}<p class="summary">{node.summary}</p>{/if}

	{#if inlineMedia && media.length}
		<div class="gallery" data-swipe-ignore>
			{#if media.length === 1}
				<MediaItem item={media[0]} title={node.title} maxHeight="320px" />
			{:else}
				<MediaCarousel items={media} title={node.title} stageHeight="260px" thumbs={media.length > 3} />
			{/if}
		</div>
	{/if}

	{#if node.links.length}
		<div class="links">
			{#each node.links as link (link.url)}
				{@const brand = brandFor(link.url)}
				<a class="link" href={link.url} target="_blank" rel="noopener noreferrer">
					{#if brand}
						<img class="brand" src={brand.icon} alt="" width="16" height="16" />
					{:else}
						<span class="icon" aria-hidden="true">{icon(link.kind)}</span>
					{/if}{link.label}
				</a>
			{/each}
		</div>
	{/if}

	{#if node.body}
		<!-- Click on an image inside the body text → open it in the lightbox. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="body"
			onclick={(e) => {
				const t = e.target as HTMLElement;
				if (t instanceof HTMLImageElement && t.closest('p')) lightbox.show(t.src, t.alt || undefined);
			}}
		>
			{#each bodyParts as part, i (i)}
				{#if 'html' in part}
					{@html part.html}
				{:else if 'play' in part}
					<button class="play-game" onclick={() => session.openGames(part.play === 'engine' ? null : part.play)}>
						<span class="play-icon" aria-hidden="true"></span>
						E.Ngine Games
					</button>
				{:else if part.carousel.length}
					<div class="inline-carousel">
						<MediaCarousel
							items={part.carousel}
							title={node.title}
							stageHeight={part.round ? "200px" : "240px"}
							thumbs={part.carousel.length > 3}
							round={part.round}
						/>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if node.tags.length}
		<ul class="tags">
			{#each node.tags as tag (tag)}<li>#{tag}</li>{/each}
		</ul>
	{/if}

	{#if related.length}
		<section class="related">
			<h3>Connected neurons</h3>
			<div class="chips">
				{#each related as r (r.id)}
					<button style="--c: {typeStyle[r.type].color}" onclick={() => onselect(r.id)}>{r.title}</button>
				{/each}
			</div>
		</section>
	{/if}
</aside>

<script lang="ts" module>
	function icon(kind?: string) {
		switch (kind) {
			case 'github': return '⌥';
			case 'paper': return '📄';
			case 'demo': return '▶';
			case 'video': return '🎬';
			case 'linkedin': return 'in';
			default: return '↗';
		}
	}
</script>

<style>
	.panel {
		position: fixed;
		top: 16px;
		right: 64px; /* room for the "next node" button at the screen edge */
		bottom: 16px;
		width: min(440px, calc(100vw - 32px));
		overflow-y: auto;
		padding: 20px 22px 28px;
		background: rgba(10, 14, 26, 0.86);
		backdrop-filter: blur(18px);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-top: 3px solid var(--accent);
		border-radius: 16px;
		box-shadow: 0 0 60px -10px color-mix(in srgb, var(--accent) 40%, transparent);
		z-index: 30;
		outline: none;
	}
	/* Phones: a bottom sheet; the grabber hints that it can be swiped down to close. */
	.grabber {
		display: none;
	}
	@media (max-width: 720px) {
		.panel {
			top: auto;
			left: 8px;
			right: 8px;
			bottom: 8px;
			width: auto;
			max-height: 72svh;
			padding-top: 16px;
		}
		.grabber {
			display: block;
			width: 40px;
			height: 4px;
			margin: -6px auto 8px;
			border-radius: 99px;
			background: rgba(148, 163, 184, 0.45);
		}
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	.badge {
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
		padding: 3px 8px;
		border-radius: 99px;
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
	h2 {
		margin: 4px 0 2px;
		font-size: 1.5rem;
		line-height: 1.2;
	}
	blockquote {
		margin: 8px 0;
		font-size: 1.35rem;
		font-style: italic;
		line-height: 1.4;
	}
	.author,
	.subtitle {
		color: var(--muted);
		margin: 0;
	}
	.dates {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 2px 0 0;
	}
	.summary {
		font-size: 1.02rem;
		margin: 14px 0;
	}
	.gallery {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 14px 0;
	}
	.gallery > :global(.carousel) {
		width: 100%;
	}
	.title-row {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.title-text {
		min-width: 0;
	}
	.icon-btn {
		flex: none;
		width: 64px;
		height: 64px;
		padding: 0;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: #fff;
		box-shadow: 0 0 24px -6px color-mix(in srgb, var(--accent) 60%, transparent);
		cursor: zoom-in;
		transition: transform 0.2s;
	}
	.icon-btn:hover {
		transform: scale(1.05);
	}
	.icon-btn.avatar {
		border-radius: 50%;
		width: 72px;
		height: 72px;
	}
	.icon-btn img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	/* Vector tech logos: show the whole mark with breathing room. */
	.icon-btn img.logo {
		object-fit: contain;
		padding: 10px;
	}
	/* "Play" button for an in-browser game (desktop only: the game needs a keyboard). */
	.play-game {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0 18px;
		padding: 7px 22px 7px 7px;
		border-radius: 99px;
		border: 1px solid color-mix(in srgb, var(--accent) 70%, #fff 10%);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent) 85%, #0ea5e9),
			color-mix(in srgb, var(--accent) 55%, #0b1020)
		);
		color: #fff;
		font: inherit;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow:
			0 10px 24px -10px color-mix(in srgb, var(--accent) 80%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
		transition:
			transform 0.15s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}
	.play-game:hover {
		transform: translateY(-1px);
		filter: brightness(1.08);
		box-shadow:
			0 14px 30px -10px color-mix(in srgb, var(--accent) 95%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
	}
	.play-game:active {
		transform: translateY(0);
	}
	.play-game:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 3px;
	}
	/* Round white disc with a triangle, like a media player's play button. */
	.play-icon {
		position: relative;
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 14px rgba(255, 255, 255, 0.45);
	}
	.play-icon::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -35% -50%;
		border-style: solid;
		border-width: 7px 0 7px 11px;
		border-color: transparent transparent transparent var(--accent);
	}
	@media (max-width: 720px) {
		.play-game {
			display: none;
		}
	}
	.inline-carousel {
		margin: 14px 0 18px;
	}
	.wip {
		display: flex;
		gap: 12px;
		align-items: center;
		margin: 14px 0;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
		background: repeating-linear-gradient(
			-45deg,
			color-mix(in srgb, var(--accent) 10%, transparent) 0 10px,
			transparent 10px 20px
		);
	}
	.wip-icon {
		font-size: 1.5rem;
	}
	.wip div {
		display: flex;
		flex-direction: column;
	}
	.wip span {
		color: var(--muted);
		font-size: 0.88rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0;
	}
	.link .brand {
		width: 16px;
		height: 16px;
		flex: none;
	}
	.link {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		padding: 7px 12px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		color: var(--text);
		text-decoration: none;
		font-size: 0.9rem;
	}
	.link:hover {
		background: color-mix(in srgb, var(--accent) 26%, transparent);
	}
	.body {
		line-height: 1.6;
		color: #cbd5e1;
	}
	.body :global(h2) {
		font-size: 1.05rem;
		margin: 20px 0 6px;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 10px;
	}
	/* Images written in the body markdown (e.g. a logo under a section title): full panel width. */
	.body :global(p > img) {
		display: block;
		width: 100%;
		height: auto;
		margin: 6px 0 4px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		box-shadow: 0 0 26px -10px color-mix(in srgb, var(--accent) 60%, transparent);
		cursor: zoom-in;
	}
	/* Section icons: `## ![](/images/x.png) Heading` in the markdown. */
	.body :global(h2 img) {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		object-fit: cover;
		background: #fff;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		box-shadow: 0 0 18px -6px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.body :global(a) {
		color: var(--accent);
	}
	.body :global(ul) {
		padding-left: 20px;
	}
	.tags {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0;
		margin: 18px 0 0;
	}
	.tags li {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.related h3 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		margin: 24px 0 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips button {
		font: inherit;
		font-size: 0.85rem;
		color: var(--text);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		border-radius: 99px;
		padding: 5px 11px;
		cursor: pointer;
	}
	.chips button:hover {
		background: color-mix(in srgb, var(--c) 20%, transparent);
	}
</style>
