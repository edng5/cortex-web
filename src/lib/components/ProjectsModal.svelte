<!--
  All projects as floating cards (like the pictures on the left): they drift, can be
  dragged around, and a click opens the project just like clicking its neuron.
  Phones get a plain list instead: each project's icon, title and subtitle.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { session } from '$lib/session.svelte';
	import { typeStyle } from '$lib/config/site';
	import { nodeMedia } from '$lib/media';
	import { rankBySize } from '$lib/graph-rank';
	import type { GraphEdge, OntologyNode } from '$lib/types';

	let { nodes, edges, onopen }: { nodes: OntologyNode[]; edges: GraphEdge[]; onopen: (id: string) => void } =
		$props();

	// Biggest neuron first: same size formula as the graph (importance weight + connections).
	const projects = $derived(rankBySize(nodes.filter((n) => n.type === 'project'), edges));
	const accent = typeStyle.project.color;

	function thumb(n: OntologyNode): string | null {
		if (n.icon) return n.icon;
		const m = nodeMedia(n)[0];
		if (!m) return null;
		return m.kind === 'image' ? m.src : m.kind === 'embed' ? (m.thumb ?? null) : null;
	}
	/** Vector logos are shown whole (with breathing room), not cropped to fill. */
	const isVector = (src: string) => /\.svg($|\?)/i.test(src);

	// Scatter cards over a loose grid, with a little tilt and nudge each.
	let W = $state(1200);
	let H = $state(800);
	const CARD_W = 220;
	const CARD_H = 210;
	const TILTS = [-3, 2.4, -1.6, 3.2, -2.2, 1.4, -3.6, 2];
	const layout = $derived.by(() => {
		const cols = Math.max(1, Math.min(4, Math.floor((W - 40) / (CARD_W + 30))));
		const rows = Math.ceil(projects.length / cols);
		const cellW = Math.min((W - 40) / cols, CARD_W + 80);
		const cellH = Math.min((H - 140) / rows, CARD_H + 60);
		const x0 = (W - cellW * cols) / 2;
		const y0 = 100 + Math.max(0, (H - 140 - cellH * rows) / 2);
		return projects.map((p, i) => {
			const c = i % cols;
			const r = Math.floor(i / cols);
			return {
				p,
				x: x0 + c * cellW + (cellW - CARD_W) / 2 + ((i * 37) % 23) - 11,
				y: y0 + r * cellH + (cellH - CARD_H) / 2 + ((i * 53) % 19) - 9,
				tilt: TILTS[i % TILTS.length]
			};
		});
	});

	// Dragging (a click without movement opens the project).
	let offsets = $state<Record<string, { dx: number; dy: number; z: number }>>({});
	let topZ = 1;
	let drag: { id: string; px: number; py: number; ox: number; oy: number; moved: boolean } | null = null;
	let dragging = $state<string | null>(null);

	function down(e: PointerEvent, id: string) {
		if (e.button !== 0) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const o = (offsets[id] ??= { dx: 0, dy: 0, z: 0 });
		o.z = ++topZ;
		drag = { id, px: e.clientX, py: e.clientY, ox: o.dx, oy: o.dy, moved: false };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.px;
		const dy = e.clientY - drag.py;
		if (!drag.moved && Math.hypot(dx, dy) < 5) return;
		drag.moved = true;
		dragging = drag.id;
		offsets[drag.id].dx = drag.ox + dx;
		offsets[drag.id].dy = drag.oy + dy;
	}
	function up() {
		if (drag && !drag.moved) onopen(drag.id);
		drag = null;
		dragging = null;
	}

	// ── Phones: a list ──
	const phone = $derived(W <= 720);

	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopImmediatePropagation();
				session.projectsOpen = false;
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});
</script>

<svelte:window bind:innerWidth={W} bind:innerHeight={H} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="desk"
	role="dialog"
	aria-modal="true"
	aria-label="Projects"
	tabindex="-1"
	transition:fade={{ duration: 200 }}
	onclick={(e) => e.target === e.currentTarget && (session.projectsOpen = false)}
	style="--accent: {accent}"
>
	<header>
		<h2>Projects</h2>
		<p>{phone ? 'Tap one to open it' : 'Drag them around · click one to open it'}</p>
		<button class="close" onclick={() => (session.projectsOpen = false)} aria-label="Close">✕</button>
	</header>

	{#if phone}
		<ul class="list" aria-label="Projects">
			{#each projects as p (p.id)}
				{@const t = thumb(p)}
				<li>
					<button class="row" onclick={() => onopen(p.id)}>
						<span class="icon">
							{#if t}<img src={t} alt="" class:logo={isVector(t)} draggable="false" />{:else}<span class="ph">{p.title[0]}</span>{/if}
						</span>
						<span class="text">
							<strong>{p.title}</strong>
							{#if p.subtitle}<span class="sub">{p.subtitle}</span>{/if}
						</span>
						<span class="chev" aria-hidden="true">›</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
	{#each layout as { p, x, y, tilt }, i (p.id)}
		{@const o = offsets[p.id] ?? { dx: 0, dy: 0, z: 0 }}
		{@const t = thumb(p)}
		<button
			class="card"
			class:dragging={dragging === p.id}
			style="left: {x}px; top: {y}px; transform: translate({o.dx}px, {o.dy}px); z-index: {o.z + 1};
				--tilt: {tilt}deg; --deal: {i * 70}ms; --dur: {11 + (i % 4) * 2}s; --delay: {i * -2.3}s; --wx: {i % 2 ? -1 : 1}"
			onpointerdown={(e) => down(e, p.id)}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={() => ((drag = null), (dragging = null))}
			ondragstart={(e) => e.preventDefault()}
			aria-label="Open {p.title}"
		>
			<span class="paper">
				<span class="thumb">
					{#if t}<img src={t} alt="" class:logo={isVector(t)} draggable="false" />{:else}<span class="ph">{p.title[0]}</span>{/if}
				</span>
				<strong>{p.title}</strong>
				{#if p.subtitle}<span class="sub">{p.subtitle}</span>{/if}
			</span>
		</button>
	{/each}
	{/if}
</div>

<style>
	.desk {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: radial-gradient(ellipse at 50% 40%, rgba(167, 139, 250, 0.12), transparent 60%), rgba(3, 5, 10, 0.88);
		backdrop-filter: blur(8px);
		overflow: hidden;
		outline: none;
	}
	header {
		position: absolute;
		top: 22px;
		left: 0;
		right: 0;
		text-align: center;
		pointer-events: none;
	}
	h2 {
		margin: 0;
		font-size: 1.5rem;
	}
	header p {
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}
	.close {
		pointer-events: auto;
		position: absolute;
		top: -4px;
		right: 20px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(10, 14, 26, 0.7);
		color: #fff;
		cursor: pointer;
	}
	.card {
		position: absolute;
		width: 220px;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: grab;
		touch-action: none;
		rotate: var(--tilt);
		transition: rotate 0.25s ease;
		animation: deal 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--deal);
	}
	.card.dragging {
		cursor: grabbing;
		rotate: calc(var(--tilt) * 0.3);
	}
	.paper {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 10px 14px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.9);
		border: 1px solid color-mix(in srgb, var(--accent) 55%, rgba(148, 163, 184, 0.2));
		box-shadow:
			0 18px 36px -14px rgba(0, 0, 0, 0.9),
			0 0 34px -12px color-mix(in srgb, var(--accent) 60%, transparent);
		animation: wander var(--dur) ease-in-out infinite;
		animation-delay: var(--delay);
		transition: scale 0.2s ease;
	}
	.card:hover .paper {
		scale: 1.04;
	}
	.card.dragging .paper {
		animation-play-state: paused;
		scale: 1.06;
	}
	.thumb {
		position: relative;
		display: grid;
		place-items: center;
		height: 130px;
		border-radius: 9px;
		overflow: hidden;
		background: #fff;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
	.ph {
		font-size: 3rem;
		font-weight: 800;
		color: var(--accent);
	}
	strong {
		font-size: 0.98rem;
		padding: 0 2px;
	}
	.sub {
		color: var(--muted);
		font-size: 0.8rem;
		padding: 0 2px;
	}
	.thumb img.logo {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		object-fit: contain;
		padding: 14px;
	}
	/* ── Phones: a list ── */
	.list {
		position: absolute;
		top: 92px;
		bottom: 0;
		left: 0;
		right: 0;
		margin: 0;
		padding: 0 14px 24px;
		list-style: none;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
		-webkit-overflow-scrolling: touch;
	}
	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, rgba(148, 163, 184, 0.15));
		background: rgba(10, 14, 26, 0.92);
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:active {
		background: rgba(30, 27, 60, 0.95);
	}
	.icon {
		flex: none;
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		overflow: hidden;
		background: #fff;
	}
	.icon img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.icon img.logo {
		box-sizing: border-box;
		object-fit: contain;
		padding: 6px;
	}
	.icon .ph {
		font-size: 1.5rem;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.text strong {
		font-size: 0.98rem;
	}
	.text .sub {
		padding: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.chev {
		flex: none;
		color: var(--muted);
		font-size: 1.4rem;
	}
	@keyframes deal {
		from {
			opacity: 0;
			translate: 0 40px;
			rotate: calc(var(--tilt) + 10deg);
		}
	}
	@keyframes wander {
		0%,
		100% {
			translate: 0 0;
		}
		33% {
			translate: calc(var(--wx) * 6px) -8px;
		}
		66% {
			translate: calc(var(--wx) * -5px) -3px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card,
		.paper {
			animation: none;
		}
	}
</style>
