<!--
  Free-floating pictures for a node (desktop default; NEOS opts into the carousel instead). Tiles start in a composed
  "bento" layout sized from each item's real aspect ratio, then wander gently on
  their own and can be dragged anywhere on screen. A click (no drag) on a picture
  opens it in the lightbox.

    3 items, one tall (e.g. phone screenshot):     otherwise: justified rows
      ┌──────┬────┐                                 ┌────┬──────┐
      │ A    │    │   T = tallest, full height       │ A  │  B   │   equal heights per row,
      ├──────┤ T  │                                  ├────┴──────┤   widths follow aspect ratio
      │ B    │    │                                  │     C     │
      └──────┴────┘                                 └───────────┘
-->
<script lang="ts">
	import MediaItem from './MediaItem.svelte';
	import type { MediaItem as Media } from '$lib/media';
	import type { PortraitSpot } from '$lib/types';
	import { lightbox } from '$lib/lightbox.svelte';

	let {
		items,
		title,
		portrait
	}: {
		items: Media[];
		title: string;
		/** Frameless cut-outs (transparent PNGs) placed in a square scene instead of the pile. */
		portrait?: Record<string, PortraitSpot>;
	} = $props();

	const GAP = 14;
	let width = $state(0);
	let innerHeight = $state(900);
	let innerWidth = $state(1440);
	let aspects = $state<(number | null)[]>([]);

	// Measure natural aspect ratios (videos are 16:9).
	$effect(() => {
		const list = items;
		aspects = list.map((m) => (m.kind === 'image' ? null : 16 / 9));
		list.forEach((m, i) => {
			if (m.kind !== 'image') return;
			const img = new Image();
			img.onload = () => (aspects[i] = img.naturalWidth / img.naturalHeight || 1);
			img.onerror = () => (aspects[i] = 4 / 3);
			img.src = m.src;
		});
	});

	interface Tile {
		item: Media;
		x: number;
		y: number;
		w: number;
		h: number;
	}

	const clampA = (a: number) => Math.min(2.4, Math.max(0.45, a));

	const layout = $derived.by((): { tiles: Tile[]; height: number } | null => {
		if (!width || aspects.some((a) => a === null)) return null;
		const a = (aspects as number[]).map(clampA);
		const W = width;
		const maxH = Math.max(320, innerHeight * 0.86 - 40);
		const n = items.length;

		// Team portrait: a square scene a little wider than the column (spilling over the graph),
		// each cut-out at its spot; images without a spot are left out.
		if (portrait) {
			const side = Math.min(maxH, W * 1.2, innerWidth * 0.5);
			const tiles: Tile[] = [];
			items.forEach((item, i) => {
				const s = portrait[item.src];
				if (!s) return;
				const w = (side * s.w) / 100;
				const h = w / (aspects[i] as number);
				tiles.push({ item, x: (side * s.x) / 100 - w / 2, y: (side * s.y) / 100 - h, w, h });
			});
			return { tiles, height: side };
		}

		// Rows of items with equal heights filling the width ("justified").
		const rows = (groups: number[][]): { tiles: Tile[]; height: number } => {
			const tiles: Tile[] = [];
			let y = 0;
			for (const g of groups) {
				const h = (W - GAP * (g.length - 1)) / g.reduce((s, i) => s + a[i], 0);
				let x = 0;
				for (const i of g) {
					tiles.push({ item: items[i], x, y, w: a[i] * h, h });
					x += a[i] * h + GAP;
				}
				y += h + GAP;
			}
			return { tiles, height: y - GAP };
		};

		let out: { tiles: Tile[]; height: number };
		if (n === 3) {
			const t = [0, 1, 2].reduce((best, i) => (a[i] < a[best] ? i : best), 0);
			const [p, q] = [0, 1, 2].filter((i) => i !== t);
			if (a[t] < 0.8) {
				let R = W * 0.4;
				let H = R / a[t];
				if (H > maxH) {
					H = maxH;
					R = H * a[t];
				}
				const L = W - R - GAP;
				// Split the left column so both pictures get heights matching their shapes.
				const hp = Math.min(Math.max((H - GAP) * (a[q] / (a[p] + a[q])), H * 0.3), H * 0.7);
				return {
					height: H,
					tiles: [
						{ item: items[p], x: 0, y: 0, w: L, h: hp },
						{ item: items[q], x: 0, y: hp + GAP, w: L, h: H - hp - GAP },
						{ item: items[t], x: L + GAP, y: 0, w: R, h: H }
					]
				};
			}
			out = rows([[0, 1], [2]]);
		} else if (n === 2) {
			const side = (W - GAP) / (a[0] + a[1]);
			out = side >= 150 ? rows([[0, 1]]) : rows([[0], [1]]);
		} else if (n === 1) {
			out = rows([[0]]);
		} else {
			// 4+ items: keep tall (portrait) and wide pictures in separate rows, so a phone
			// screenshot never shares a row with a 16:9 video and shrinks to a sliver.
			const chunk = (list: number[], k: number) =>
				Array.from({ length: Math.ceil(list.length / k) }, (_, r) => list.slice(r * k, r * k + k));
			const wide = [...Array(n).keys()].filter((i) => a[i] >= 0.9);
			const tall = [...Array(n).keys()].filter((i) => a[i] < 0.9);
			// Big sets of tall photos (e.g. a photography roll) use wider rows so they don't shrink to slivers.
			const tallPer = tall.length <= 6 ? 3 : tall.length <= 12 ? 4 : 6;
			out = rows([...chunk(wide, wide.length <= 4 ? 2 : 3), ...chunk(tall, tallPer)]);
		}

		// Short block (e.g. a tall + a wide picture side by side): grow it, spilling past
		// the column over the graph, up to ~62% of the screen height / 55% of its width.
		// A single picture stays a bit smaller so it doesn't cover the whole graph.
		const growTo = Math.min((innerHeight * 0.62) / out.height, (innerWidth * (n === 1 ? 0.42 : 0.55)) / W);
		if (growTo > 1) {
			out = {
				height: out.height * growTo,
				tiles: out.tiles.map((t) => ({ ...t, x: t.x * growTo, y: t.y * growTo, w: t.w * growTo, h: t.h * growTo }))
			};
		}

		// Too tall for the screen: shrink the whole block and centre it.
		if (out.height > maxH) {
			const s = maxH / out.height;
			const offset = (W - W * s) / 2;
			out = {
				height: maxH,
				tiles: out.tiles.map((t) => ({ ...t, x: offset + t.x * s, y: t.y * s, w: t.w * s, h: t.h * s }))
			};
		}
		return out;
	});

	// ── "Papers on a desk": overlap, tilt and nudge the composed layout ─────
	const FRAME = 6; // paper border (px)
	const PULL = 0.8; // pull each tile's centre 20% toward the middle → neighbours overlap
	const TILTS = [-3.2, 2.6, -1.6, 3.4, -2.4, 1.8, -3.8, 2.2];
	const NUDGE = [
		[-6, 4],
		[8, -6],
		[-4, 8],
		[6, 3],
		[-8, -4],
		[4, -8],
		[-3, 6],
		[7, 5]
	];
	const pile = $derived.by(() => {
		if (!layout) return null;
		// Cut-outs stay exactly where the portrait puts them, upright.
		if (portrait) return layout.tiles.map((t) => ({ ...t, tilt: 0, fly: !!portrait[t.item.src]?.fly }));
		const cx = width / 2;
		const cy = layout.height / 2;
		return layout.tiles.map((t, i) => {
			const mx = t.x + t.w / 2;
			const my = t.y + t.h / 2;
			const [nx, ny] = NUDGE[i % NUDGE.length];
			return {
				...t,
				x: cx + (mx - cx) * PULL - t.w / 2 + nx,
				y: cy + (my - cy) * PULL - t.h / 2 + ny,
				tilt: TILTS[i % TILTS.length],
				fly: true
			};
		});
	});

	// ── Dragging / stacking ───────────────────────────────────────────────
	let offsets = $state<{ dx: number; dy: number; z: number }[]>([]);
	let topZ = 1;
	let wasOnTop = true;
	$effect(() => {
		// Later items start on top of the pile.
		offsets = items.map((_, i) => ({ dx: 0, dy: 0, z: i + 1 }));
		topZ = items.length;
	});
	let dragging = $state<number | null>(null);
	let drag: { i: number; px: number; py: number; ox: number; oy: number; rect: DOMRect; moved: boolean } | null =
		null;
	let suppressClick = false;

	function onDown(e: PointerEvent, i: number) {
		if (e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const o = offsets[i];
		drag = { i, px: e.clientX, py: e.clientY, ox: o.dx, oy: o.dy, rect: el.getBoundingClientRect(), moved: false };
		wasOnTop = o.z === topZ;
		if (!wasOnTop) o.z = ++topZ; // pick it up off the pile
	}

	function onMove(e: PointerEvent) {
		if (!drag) return;
		let dx = e.clientX - drag.px;
		let dy = e.clientY - drag.py;
		if (!drag.moved && Math.hypot(dx, dy) < 5) return;
		drag.moved = true;
		dragging = drag.i;
		// Keep at least 60px of the tile on screen.
		const r = drag.rect;
		dx = Math.min(Math.max(dx, 60 - r.right), window.innerWidth - 60 - r.left);
		dy = Math.min(Math.max(dy, 60 - r.bottom), window.innerHeight - 60 - r.top);
		offsets[drag.i].dx = drag.ox + dx;
		offsets[drag.i].dy = drag.oy + dy;
	}

	function onUp() {
		// A drag, or a click on a paper that was underneath (which just brings it to the
		// top), shouldn't open the lightbox. A click on the top paper opens it.
		if (drag && (drag.moved || !wasOnTop)) {
			// Swallow the click the browser fires right after a drag, but don't let the flag
			// linger (if the drag ended off the tile, no click comes and a later real click must work).
			suppressClick = true;
			setTimeout(() => (suppressClick = false), 0);
		}
		drag = null;
		dragging = null;
	}

	function onClickCapture(e: MouseEvent) {
		if (suppressClick) {
			e.preventDefault();
			e.stopPropagation();
			suppressClick = false;
		}
	}
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<div class="bento" bind:clientWidth={width} style="height: {layout ? layout.height : 0}px">
	{#if pile}
		{#each pile as t, i (t.item.src)}
			{@const o = offsets[items.indexOf(t.item)] ?? { dx: 0, dy: 0, z: 0 }}
			{@const idx = items.indexOf(t.item)}
			<div
				class="tile"
				class:cutout={!!portrait}
				class:grounded={!t.fly}
				class:dragging={dragging === idx}
				class:video={t.item.kind !== 'image'}
				style="left: {t.x}px; top: {t.y}px; width: {t.w}px; height: {t.h}px; transform: translate({o.dx}px, {o.dy}px); z-index: {o.z};
					--tilt: {t.tilt}deg; --deal: {i * 110}ms;
					--delay: {i * -3.1}s; --dur: {13 + i * 2.5}s; --wx: {i % 2 ? -1 : 1}"
				onpointerdown={(e) => t.item.kind === 'image' && onDown(e, idx)}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				onclickcapture={onClickCapture}
				ondragstart={(e) => e.preventDefault()}
				role="group"
				aria-label={t.item.caption ?? title}
			>
				<div class="wander">
					{#if portrait}
						<!-- A click (not a drag) opens it full size, like the framed pictures. -->
						<a
							class="cut-link"
							href={t.item.src}
							target="_blank"
							rel="noopener"
							aria-label="View {t.item.caption ?? title} full size"
							draggable="false"
							onclick={(e) => {
								if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
								e.preventDefault();
								lightbox.show(t.item.src, t.item.caption);
							}}
						>
							<img class="cut" src={t.item.src} alt={t.item.caption ?? title} draggable="false" />
						</a>
					{:else}
						<MediaItem item={t.item} {title} stage clickToLoad maxHeight="{t.h - 2 * FRAME}px" showCaption={false} />
					{/if}
					{#if t.item.caption}<span class="cap">{t.item.caption}</span>{/if}
				</div>
				<!-- Videos swallow pointer events inside the player, so they get a drag handle. -->
				{#if t.item.kind !== 'image'}
					<span
						class="grip"
						role="presentation"
						onpointerdown={(e) => {
							e.stopPropagation();
							onDown(e, idx);
						}}
						onpointermove={onMove}
						onpointerup={onUp}
						onpointercancel={onUp}
						title="Drag to move">⠿ drag</span
					>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	.bento {
		position: relative;
		width: 100%;
	}
	.tile {
		position: absolute;
		pointer-events: auto;
		touch-action: none;
		cursor: grab;
		rotate: var(--tilt);
		transition: rotate 0.25s ease;
		/* Dealt onto the desk one after another. */
		animation: deal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--deal);
	}
	/* Videos stay upright and still: a YouTube player inside a tilted, drifting, blurred card can
	   render blank in Chrome, and a moving player is hard to click. */
	.tile.video {
		cursor: default;
		rotate: 0deg;
		animation: none;
	}
	.tile.video .wander {
		animation: none;
		backdrop-filter: none;
		background: rgba(10, 14, 26, 0.96);
	}
	.tile.video.dragging {
		rotate: 0deg;
	}
	.tile.dragging {
		cursor: grabbing;
		rotate: calc(var(--tilt) * 0.3); /* straightens a little when picked up */
	}
	/* The "paper": same frame as the carousel card — dark glass with an accent-coloured border. */
	.wander {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 6px;
		border-radius: 12px;
		background: rgba(10, 14, 26, 0.82);
		backdrop-filter: blur(14px);
		border: 1px solid color-mix(in srgb, var(--accent) 55%, rgba(148, 163, 184, 0.2));
		box-shadow:
			0 18px 36px -14px rgba(0, 0, 0, 0.9),
			0 4px 10px -4px rgba(0, 0, 0, 0.6),
			0 0 34px -12px color-mix(in srgb, var(--accent) 60%, transparent);
		animation: wander var(--dur) ease-in-out infinite;
		animation-delay: var(--delay);
		transition:
			scale 0.2s ease,
			box-shadow 0.2s ease;
	}
	.tile:hover .wander {
		scale: 1.02;
	}
	.tile.dragging .wander {
		animation-play-state: paused;
		scale: 1.04;
		box-shadow:
			0 34px 60px -16px rgba(0, 0, 0, 0.95),
			0 8px 18px -6px rgba(0, 0, 0, 0.7),
			0 0 46px -12px color-mix(in srgb, var(--accent) 70%, transparent);
	}
	.tile :global(.media) {
		height: 100%;
		border: none;
		border-radius: 7px;
	}
	.tile:not(.video) :global(.img-wrap) {
		cursor: inherit;
	}
	.cap {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 6px;
		padding: 18px 12px 8px;
		border-radius: 0 0 7px 7px;
		font-size: 0.78rem;
		color: #e2e8f0;
		background: linear-gradient(transparent, rgba(5, 7, 13, 0.85));
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.tile:hover .cap {
		opacity: 1;
	}
	.grip {
		position: absolute;
		top: -12px;
		left: 50%;
		translate: -50% 0;
		padding: 3px 10px;
		border-radius: 99px;
		font-size: 0.72rem;
		color: #e2e8f0;
		background: rgba(10, 14, 26, 0.9);
		border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
		cursor: grab;
		opacity: 0;
		transition: opacity 0.2s;
		user-select: none;
		touch-action: none;
	}
	.tile:hover .grip,
	.tile.dragging .grip {
		opacity: 1;
	}
	/* Team portrait: bare transparent PNGs — no frame, just a shadow that follows their shape. */
	.tile.cutout .wander {
		padding: 0;
		border: none;
		border-radius: 0;
		background: none;
		backdrop-filter: none;
		box-shadow: none;
		filter: drop-shadow(0 14px 16px rgba(0, 0, 0, 0.55))
			drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 22%, transparent));
	}
	.tile.cutout.dragging .wander {
		box-shadow: none;
		filter: drop-shadow(0 26px 26px rgba(0, 0, 0, 0.6))
			drop-shadow(0 0 28px color-mix(in srgb, var(--accent) 30%, transparent));
	}
	/* Ground-dwellers stand still on the ground; flyers keep bobbing. */
	.tile.cutout.grounded .wander {
		animation: none;
	}
	.cut-link {
		display: block;
		width: 100%;
		height: 100%;
		cursor: inherit;
	}
	.cut {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		cursor: inherit;
		user-select: none;
	}
	/* Caption as a small pill under the cut-out instead of a bar over a photo. */
	.tile.cutout .cap {
		left: 50%;
		right: auto;
		bottom: -6px;
		translate: -50% 100%;
		padding: 3px 10px;
		border-radius: 99px;
		white-space: nowrap;
		background: rgba(10, 14, 26, 0.85);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
	}
	@keyframes deal {
		from {
			opacity: 0;
			translate: -46px -26px;
			rotate: calc(var(--tilt) - 14deg);
			scale: 1.08;
		}
	}
	/* Slow, uneven wander — like the neurons. */
	@keyframes wander {
		0%,
		100% {
			translate: 0 0;
			rotate: 0deg;
		}
		25% {
			translate: calc(var(--wx) * 6px) -7px;
			rotate: calc(var(--wx) * 0.6deg);
		}
		50% {
			translate: calc(var(--wx) * -3px) -12px;
			rotate: 0deg;
		}
		75% {
			translate: calc(var(--wx) * -7px) -4px;
			rotate: calc(var(--wx) * -0.5deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wander {
			animation: none;
		}
	}
</style>
