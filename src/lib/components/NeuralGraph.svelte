<!--
  Neuron graph: d3-force layout rendered on <canvas>.

  Mood by mode:
    idle       calm drift
    listening  faster, "excited" motion that also reacts to mic loudness
    thinking   glow wave + signals travelling along edges; retrieved nodes light up
    speaking   focused node and its neighbours glow
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		forceCollide,
		forceLink,
		forceManyBody,
		forceSimulation,
		forceX,
		forceY,
		type Simulation,
		type SimulationLinkDatum,
		type SimulationNodeDatum
	} from 'd3-force';
	import { typeStyle } from '$lib/config/site';
	import type { Mode } from '$lib/cortex.svelte';
	import type { GraphData, OntologyNode } from '$lib/types';

	interface Props {
		graph: GraphData;
		mode: Mode;
		activeIds: string[];
		selectedId: string | null;
		/** Pixels on the right covered by the info panel — graph re-centres to the left. */
		insetRight?: number;
		/** Pixels on the left covered by the floating media column. */
		insetLeft?: number;
		getAudioLevel?: () => number;
		onselect?: (id: string) => void;
		/** Legend filter: neurons of this type line up on the left, everything else on the right. */
		filterType?: string | null;
		/** Order of the filtered column: oldest → newest, or biggest neuron first. */
		filterOrder?: 'date' | 'size';
	}

	let {
		graph,
		mode,
		activeIds,
		selectedId,
		insetRight = 0,
		insetLeft = 0,
		getAudioLevel = () => 0,
		onselect,
		filterType = null,
		filterOrder = 'date'
	}: Props = $props();

	interface SimNode extends SimulationNodeDatum {
		id: string;
		data: OntologyNode;
		r: number;
		color: string;
		phase: number;
		glow: number;
		/** Smoothed filter dimming (1 = full, ~0.28 = faded) and filter-label visibility (0..1). */
		dim: number;
		lab: number;
		neighbours: Set<string>;
	}
	interface SimLink extends SimulationLinkDatum<SimNode> {
		weight: number;
		kind: string;
		offset: number;
	}

	let canvas: HTMLCanvasElement;
	let hoveredId = $state<string | null>(null);

	// Mutable render state read by the animation loop.
	let nodes: SimNode[] = [];
	let links: SimLink[] = [];
	let sim: Simulation<SimNode, SimLink> | null = null;
	let width = 0;
	let height = 0;
	let dpr = 1;
	let view = { x: 0, y: 0, k: 1 };
	let snapView = true; // jump (not ease) to the fitted view on first paint / resize
	// Title pill beside the hovered node (fades in/out).
	const pillAlpha = new Map<string, number>();

	function build(g: GraphData) {
		const prev = new Map(nodes.map((n) => [n.id, n]));
		const degree = new Map<string, number>();
		for (const e of g.edges) {
			degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
			degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
		}
		nodes = g.nodes.map((d) => {
			const p = prev.get(d.id);
			return {
				id: d.id,
				data: d,
				r: 4 + d.weight * 3 + Math.sqrt(degree.get(d.id) ?? 0) * 1.5,
				color: typeStyle[d.type]?.color ?? '#94a3b8',
				phase: Math.random() * Math.PI * 2,
				glow: 0.15,
				dim: 1,
				lab: 0,
				neighbours: new Set(),
				x: p?.x ?? (Math.random() - 0.5) * 300,
				y: p?.y ?? (Math.random() - 0.5) * 300
			};
		});
		const byId = new Map(nodes.map((n) => [n.id, n]));
		links = g.edges
			.filter((e) => byId.has(e.source) && byId.has(e.target))
			.map((e) => {
				byId.get(e.source)!.neighbours.add(e.target);
				byId.get(e.target)!.neighbours.add(e.source);
				return { source: e.source, target: e.target, weight: e.weight, kind: e.kind, offset: Math.random() } as SimLink;
			});

		sim?.stop();
		sim = forceSimulation<SimNode, SimLink>(nodes)
			.force(
				'link',
				forceLink<SimNode, SimLink>(links)
					.id((d) => d.id)
					.distance((l) => 120 - l.weight * 50)
					.strength((l) => 0.15 + l.weight * 0.35)
			)
			.force('charge', forceManyBody<SimNode>().strength(-160).distanceMax(500))
			.force('collide', forceCollide<SimNode>((d) => d.r + 10))
			.force('x', forceX<SimNode>(0).strength(0.03))
			.force('y', forceY<SimNode>(0).strength(0.045))
			.velocityDecay(0.35)
			.alphaTarget(0.02) // never fully cools → nodes keep wandering
			.stop(); // we tick manually in the render loop
		for (let i = 0; i < 200; i++) sim.tick(); // pre-settle so first paint isn't chaos
	}

	$effect(() => {
		build(graph);
		// Re-apply the current filter to the rebuilt graph, but don't make this effect depend on it:
		// a filter change must never rebuild (and teleport) the simulation, only glide it.
		untrack(() => applyFilter(filterType, filterOrder));
	});

	$effect(() => {
		applyFilter(filterType, filterOrder);
	});

	// ── Legend filter layout ──────────────────────────────────────────────
	const COL_RIGHT_EDGE = -260; // world x where the filtered block ends (others sit to the right)
	const GAP_X = 210;
	const GAP_Y = 54;

	type Pt = { x: number; y: number };
	const TWEEN_MS = 1100; // each neuron's glide
	const STAGGER_MS = 35; // filtered neurons cascade into the column one after another

	/** Glide in progress: every node eases from `from` to `to`, then the holding forces take over. */
	let tween: { start: number; from: Map<string, Pt>; to: Map<string, Pt>; delay: Map<string, number>; done: () => void } | null =
		null;
	/** Where everything sat before a filter was applied, so clearing glides back home. */
	let homePos: Map<string, Pt> | null = null;

	const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
	const snapshot = () => new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));

	function glide(to: Map<string, Pt>, delay: Map<string, number>, done: () => void) {
		tween = { start: performance.now(), from: snapshot(), to, delay, done };
	}

	/** Called every frame before sim.tick(): pin nodes along their eased paths. */
	function stepTween(now: number) {
		if (!tween) return;
		let finished = true;
		for (const n of nodes) {
			const a = tween.from.get(n.id);
			const b = tween.to.get(n.id);
			if (!a || !b) continue;
			const t = Math.min(1, Math.max(0, (now - tween.start - (tween.delay.get(n.id) ?? 0)) / TWEEN_MS));
			if (t < 1) finished = false;
			const e = ease(t);
			n.fx = a.x + (b.x - a.x) * e;
			n.fy = a.y + (b.y - a.y) * e;
			n.vx = n.vy = 0;
		}
		if (finished) {
			for (const n of nodes) n.fx = n.fy = null;
			const done = tween.done;
			tween = null;
			done();
		}
	}

	/** Pull the filtered type into ordered column(s) on the left; the rest gather on the right. */
	function applyFilter(type: string | null, order: 'date' | 'size') {
		if (!sim) return;
		const link = sim.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>> | undefined;

		if (!type) {
			if (!homePos) return; // nothing to undo
			const home = homePos;
			// Glide everyone back to where they were, then restore the free-floating forces.
			// `homePos` is only cleared once they arrive, so picking another filter mid-glide
			// still remembers the original layout.
			glide(home, new Map(), () => {
				homePos = null;
				sim?.force('x', forceX<SimNode>(0).strength(0.03));
				sim?.force('y', forceY<SimNode>(0).strength(0.045));
				sim?.force('charge', forceManyBody<SimNode>().strength(-160).distanceMax(500));
				link?.strength((l) => 0.15 + l.weight * 0.35);
				sim?.alpha(0.3);
			});
			return;
		}

		homePos ??= snapshot(); // remember the unfiltered layout (kept when switching type/order)
		const home = homePos;
		const picked = nodes.filter((n) => n.data.type === type);
		picked.sort((a, b) => {
			if (order === 'date') {
				const da = a.data.start ?? '';
				const db = b.data.start ?? '';
				if (da && db && da !== db) return db.localeCompare(da); // most recent first
				if (!da !== !db) return da ? -1 : 1; // undated go last
			}
			return b.r - a.r; // biggest (most important) first
		});

		// Up to 10 → one column (reads top to bottom); more → a few columns, read column by column.
		const rows = picked.length <= 10 ? Math.max(1, picked.length) : Math.ceil(Math.sqrt(picked.length * 2.4));
		const cols = Math.ceil(picked.length / rows);
		const to = new Map<string, Pt>();
		const delay = new Map<string, number>();
		picked.forEach((n, i) => {
			const c = Math.floor(i / rows);
			const inCol = Math.min(rows, picked.length - c * rows);
			to.set(n.id, { x: COL_RIGHT_EDGE - (cols - 1 - c) * GAP_X, y: ((i % rows) - (inCol - 1) / 2) * GAP_Y });
			delay.set(n.id, i * STAGGER_MS);
		});

		// Everyone else keeps their shape and slides (slightly tightened) to the right.
		const rest = nodes.filter((n) => !to.has(n.id));
		const mx = rest.reduce((s, n) => s + (home.get(n.id)?.x ?? 0), 0) / Math.max(1, rest.length);
		const my = rest.reduce((s, n) => s + (home.get(n.id)?.y ?? 0), 0) / Math.max(1, rest.length);
		for (const n of rest) {
			const h = home.get(n.id) ?? { x: n.x ?? 0, y: n.y ?? 0 };
			to.set(n.id, { x: 300 + (h.x - mx) * 0.8, y: (h.y - my) * 0.85 });
		}

		link?.strength(0.01); // keep the connections drawn, but let the layout hold
		glide(to, delay, () => {
			// Hold the arrangement gently (neurons still drift a little, like before).
			sim?.force('x', forceX<SimNode>((d) => to.get(d.id)?.x ?? 0).strength((d) => (picked.includes(d) ? 0.6 : 0.12)));
			sim?.force('y', forceY<SimNode>((d) => to.get(d.id)?.y ?? 0).strength((d) => (picked.includes(d) ? 0.6 : 0.12)));
			sim?.force('charge', forceManyBody<SimNode>().strength((d) => (picked.includes(d) ? -20 : -40)).distanceMax(300));
			sim?.alpha(0.3);
		});
	}

	// ── Interaction ───────────────────────────────────────────────────────────

	function toWorld(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		return {
			x: (clientX - rect.left - view.x) / view.k,
			y: (clientY - rect.top - view.y) / view.k
		};
	}

	function nodeAt(clientX: number, clientY: number): SimNode | null {
		const p = toWorld(clientX, clientY);
		let best: SimNode | null = null;
		let bestD = Infinity;
		for (const n of nodes) {
			const d = Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y);
			if (d < n.r + 8 / view.k && d < bestD) {
				best = n;
				bestD = d;
			}
		}
		return best;
	}

	let drag: { node: SimNode; startX: number; startY: number; moved: boolean } | null = null;

	function onPointerDown(e: PointerEvent) {
		const n = nodeAt(e.clientX, e.clientY);
		if (!n) return;
		canvas.setPointerCapture(e.pointerId);
		drag = { node: n, startX: e.clientX, startY: e.clientY, moved: false };
		n.fx = n.x;
		n.fy = n.y;
	}

	function onPointerMove(e: PointerEvent) {
		if (drag) {
			if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) drag.moved = true;
			const p = toWorld(e.clientX, e.clientY);
			drag.node.fx = p.x;
			drag.node.fy = p.y;
			return;
		}
		hoveredId = nodeAt(e.clientX, e.clientY)?.id ?? null;
	}

	function onPointerUp() {
		if (!drag) return;
		const { node, moved } = drag;
		node.fx = node.fy = null;
		drag = null;
		if (!moved) onselect?.(node.id);
	}

	// ── Render loop ───────────────────────────────────────────────────────────

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

		const ro = new ResizeObserver(() => {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			snapView = true;
		});
		ro.observe(canvas);

		let energy = 1;
		let clock = 0; // energy-scaled time, so speed changes never cause jumps
		let last = performance.now();
		let raf = 0;

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			const dt = Math.min(64, now - last);
			last = now;

			// Mood → target energy.
			const level = getAudioLevel();
			const target =
				mode === 'listening' ? 2.4 + level * 5 : mode === 'thinking' ? 1.7 : mode === 'speaking' ? 1.5 : 1;
			energy += (target - energy) * 0.05;
			const motion = reduceMotion ? 0.25 : 1;
			clock += dt * energy * motion;

			// Brownian nudges keep everything wandering calmly (or excitedly).
			if (sim) {
				stepTween(now); // filter glide (pins nodes along eased paths while it runs)
				const jitter = 0.05 * energy * energy * motion;
				for (const n of nodes) {
					n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * jitter;
					n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * jitter;
				}
				sim.tick();
			}

			draw(ctx);
		};

		const draw = (ctx: CanvasRenderingContext2D) => {
			// Auto-fit: smoothly scale/translate so the whole graph is visible.
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
			for (const n of nodes) {
				minX = Math.min(minX, n.x! - n.r); maxX = Math.max(maxX, n.x! + n.r);
				minY = Math.min(minY, n.y! - n.r); maxY = Math.max(maxY, n.y! + n.r);
			}
			const availW = Math.max(200, width - insetLeft - insetRight);
			const pad = 70;
			const padTop = 120; // clear the logo + rotating titles in the top-left
			const padBottom = 150; // keep neurons clear of the ask bar / captions
			const k = nodes.length
				? Math.min(1.6, (availW - pad * 2) / (maxX - minX || 1), (height - padTop - padBottom) / (maxY - minY || 1))
				: 1;
			const tk = Math.max(0.3, k);
			const tx = insetLeft + availW / 2 - ((minX + maxX) / 2) * tk;
			const ty = padTop + (height - padTop - padBottom) / 2 - ((minY + maxY) / 2) * tk;
			const ease = snapView ? 1 : 0.04;
			snapView = false;
			view.k += (tk - view.k) * ease;
			view.x += (tx - view.x) * ease;
			view.y += (ty - view.y) * ease;

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);
			ctx.save();
			ctx.translate(view.x, view.y);
			ctx.scale(view.k, view.k);

			const active = new Set(activeIds);
			const selected = selectedId ? nodes.find((n) => n.id === selectedId) : null;
			const t = clock * 0.001;

			// Drift offset for drawing (on top of the physics position).
			const amp = 3 + energy * 1.5;
			const pos = (n: SimNode) => ({
				x: n.x! + Math.sin(t * 0.7 + n.phase) * amp,
				y: n.y! + Math.cos(t * 0.55 + n.phase * 1.3) * amp
			});

			// Ease each node's filter dimming and label toward their targets (no popping between states).
			for (const n of nodes) {
				const match = !!filterType && n.data.type === filterType;
				n.dim += ((!filterType || match ? 1 : 0.28) - n.dim) * 0.08;
				n.lab += ((match ? 1 : 0) - n.lab) * 0.08;
			}

			// Target glow per node.
			for (const n of nodes) {
				let g = 0.12 + 0.05 * Math.sin(t * 1.2 + n.phase); // resting shimmer
				if (mode === 'listening') g += 0.08;
				if (mode === 'thinking') {
					const wave = 0.5 + 0.5 * Math.sin(t * 4 - Math.hypot(n.x!, n.y!) * 0.02);
					g = 0.25 + wave * 0.45;
					if (active.has(n.id)) g = 0.85 + 0.15 * Math.sin(t * 8 + n.phase);
				}
				if (mode === 'speaking') {
					if (active.has(n.id)) g = 0.5;
					if (selected && selected.neighbours.has(n.id)) g = Math.max(g, 0.55);
				}
				if (selected?.id === n.id) g = 0.9 + 0.1 * Math.sin(t * 5);
				if (hoveredId === n.id) g = Math.max(g, 0.8);
				n.glow += (g - n.glow) * 0.08;
			}

			// Edges.
			for (const l of links) {
				const a = l.source as SimNode;
				const b = l.target as SimNode;
				const pa = pos(a);
				const pb = pos(b);
				const hot = Math.max(a.glow, b.glow);
				const linkDim = 0.35 + 0.65 * Math.max(a.dim, b.dim) ** 2; // both ends faded → faint line
				ctx.strokeStyle = `rgba(148, 197, 255, ${(0.05 + l.weight * 0.1 + hot * 0.25) * linkDim})`;
				ctx.lineWidth = (0.6 + l.weight * 0.8) / Math.sqrt(view.k);
				ctx.beginPath();
				ctx.moveTo(pa.x, pa.y);
				ctx.lineTo(pb.x, pb.y);
				ctx.stroke();

				// Thinking: signals firing along axons.
				if (mode === 'thinking' || (mode === 'speaking' && (active.has(a.id) || active.has(b.id)))) {
					const p = (t * 0.6 + l.offset) % 1;
					const sx = pa.x + (pb.x - pa.x) * p;
					const sy = pa.y + (pb.y - pa.y) * p;
					ctx.fillStyle = `rgba(224, 242, 254, ${0.35 + hot * 0.6})`;
					ctx.beginPath();
					ctx.arc(sx, sy, 1.8 / Math.sqrt(view.k), 0, Math.PI * 2);
					ctx.fill();
				}
			}

			// Neurons.
			ctx.globalCompositeOperation = 'lighter';
			for (const n of nodes) {
				const p = pos(n);
				const haloR = n.r * (2 + n.glow * 4);
				const fade = n.dim * n.dim;
				const grad = ctx.createRadialGradient(p.x, p.y, n.r * 0.3, p.x, p.y, haloR);
				grad.addColorStop(0, hexA(n.color, (0.25 + n.glow * 0.55) * fade));
				grad.addColorStop(1, hexA(n.color, 0));
				ctx.fillStyle = grad;
				ctx.beginPath();
				ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalCompositeOperation = 'source-over';
			for (const n of nodes) {
				const p = pos(n);
				const dim = n.dim;
				ctx.fillStyle = hexA(n.color, (0.75 + n.glow * 0.25) * dim);
				ctx.beginPath();
				ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2);
				ctx.fill();
				// nucleus
				ctx.fillStyle = `rgba(255,255,255,${(0.35 + n.glow * 0.5) * dim})`;
				ctx.beginPath();
				ctx.arc(p.x - n.r * 0.25, p.y - n.r * 0.25, n.r * 0.35, 0, Math.PI * 2);
				ctx.fill();
				// Work in progress: slowly rotating dashed ring.
				if (n.data.wip) {
					ctx.save();
					ctx.strokeStyle = hexA(n.color, 0.85);
					ctx.lineWidth = 1.5 / view.k;
					ctx.setLineDash([4 / view.k, 4 / view.k]);
					ctx.lineDashOffset = -t * 6;
					ctx.beginPath();
					ctx.arc(p.x, p.y, n.r + 5, 0, Math.PI * 2);
					ctx.stroke();
					ctx.restore();
				}
			}

			const pillTarget = updatePillTargets();

			// Small labels above active nodes and the biggest neurons (yield to title pills).
			ctx.textAlign = 'center';
			ctx.textBaseline = 'bottom';
			const fontPx = 12 / view.k;
			ctx.font = `500 ${fontPx}px Inter, system-ui, sans-serif`;
			for (const n of nodes) {
				const emphasised = n.id === selectedId || active.has(n.id);
				const shown = emphasised ? 1 : Math.max(n.lab, n.data.weight >= 2.5 && width > 720 ? 1 : 0) * n.dim;
				// Always-on labels for big neurons only where there's room; on phones the title pill is enough.
				if (shown < 0.02) continue;
				const fade = 1 - (pillAlpha.get(n.id) ?? 0);
				if (fade < 0.05) continue;
				const p = pos(n);
				const label = truncate(n.data.title, n.lab > 0.5 ? 24 : 34);
				const base = emphasised ? 0.95 : 0.55 + 0.4 * n.lab; // filtered names read brighter
				ctx.fillStyle = `rgba(226, 232, 240, ${base * shown * fade})`;
				ctx.fillText(label, p.x, p.y - n.r - 6 / view.k);
			}

			ctx.restore();

			// Title pills (screen space, so text stays crisp at any zoom).
			for (const n of nodes) {
				const target = pillTarget.has(n.id) ? 1 : 0;
				const a = (pillAlpha.get(n.id) ?? 0) + (target - (pillAlpha.get(n.id) ?? 0)) * 0.15;
				if (a < 0.01 && target === 0) {
					pillAlpha.delete(n.id);
					continue;
				}
				pillAlpha.set(n.id, a);
				const p = pos(n);
				drawPill(ctx, n, view.x + p.x * view.k, view.y + p.y * view.k, a);
			}
		};

		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			sim?.stop();
		};
	});

	/** Title pill only for the node under the mouse; nothing when not hovering. */
	function updatePillTargets(): Set<string> {
		return hoveredId ? new Set([hoveredId]) : new Set();
	}

	/** Rounded "title pill" beside a node: colour dot, title, and type · subtitle. */
	function drawPill(ctx: CanvasRenderingContext2D, n: SimNode, sx: number, sy: number, alpha: number) {
		const r = n.r * view.k;
		const padX = 12;
		const gap = 14;
		const leftEdge = insetLeft + 8;
		const rightEdge = width - insetRight - 8;
		const maxTextW = Math.min(320, rightEdge - leftEdge) - padX * 2 - 14;

		ctx.save();
		ctx.globalAlpha = alpha;
		const titleFont = '600 13px Inter, system-ui, sans-serif';
		const metaFont = '400 11px Inter, system-ui, sans-serif';
		const title = fitText(ctx, n.data.title, titleFont, maxTextW);
		const meta = fitText(
			ctx,
			[typeStyle[n.data.type]?.label.replace(/s$/, ''), n.data.subtitle].filter(Boolean).join(' · '),
			metaFont,
			maxTextW
		);
		ctx.font = titleFont;
		const titleW = ctx.measureText(title).width;
		ctx.font = metaFont;
		const metaW = ctx.measureText(meta).width;

		const w = Math.max(titleW, metaW) + padX * 2 + 14;
		const h = meta ? 44 : 30;
		const slide = (1 - alpha) * 8;

		// Prefer the right of the node; otherwise whichever side has more room,
		// clamped so the pill never leaves the visible graph area (narrow phones).
		const roomRight = rightEdge - (sx + r + gap);
		const roomLeft = sx - r - gap - leftEdge;
		const onRight = roomRight >= w || roomRight >= roomLeft;
		const rawX = onRight ? sx + r + gap + slide : sx - r - gap - w - slide;
		const x = Math.min(Math.max(rawX, leftEdge), rightEdge - w);
		// If clamping pushed it over the node, drop it just below the node instead.
		const coversNode = x < sx + r && x + w > sx - r;
		const y = Math.min(Math.max(coversNode ? sy + r + 10 : sy - h / 2, 8), height - h - 8);

		// Connector from the node's edge to the pill.
		ctx.strokeStyle = hexA(n.color, 0.6);
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (coversNode) {
			ctx.moveTo(sx, sy + r + 2);
			ctx.lineTo(sx, y);
		} else {
			ctx.moveTo(onRight ? sx + r + 2 : sx - r - 2, sy);
			ctx.lineTo(onRight ? x : x + w, y + h / 2);
		}
		ctx.stroke();

		ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
		ctx.strokeStyle = hexA(n.color, 0.55);
		ctx.shadowColor = hexA(n.color, 0.45);
		ctx.shadowBlur = 18;
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, 10);
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.stroke();

		ctx.fillStyle = n.color;
		ctx.beginPath();
		ctx.arc(x + padX + 4, y + (meta ? 16 : h / 2), 4, 0, Math.PI * 2);
		ctx.fill();

		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#e2e8f0';
		ctx.font = '600 13px Inter, system-ui, sans-serif';
		ctx.fillText(title, x + padX + 14, y + (meta ? 16 : h / 2));
		if (meta) {
			ctx.fillStyle = '#94a3b8';
			ctx.font = '400 11px Inter, system-ui, sans-serif';
			ctx.fillText(meta, x + padX + 14, y + 31);
		}
		ctx.restore();
	}

	/** Truncates `text` with an ellipsis so it fits `maxW` pixels in `font`. */
	function fitText(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number): string {
		ctx.font = font;
		if (ctx.measureText(text).width <= maxW) return text;
		let s = text;
		while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
		return s.trimEnd() + '…';
	}

	function hexA(hex: string, a: number): string {
		const n = parseInt(hex.slice(1), 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
	}

	function truncate(s: string, max: number) {
		return s.length > max ? s.slice(0, max - 1) + '…' : s;
	}

	const hovered = $derived(hoveredId ? graph.nodes.find((n) => n.id === hoveredId) : null);
</script>

<canvas
	bind:this={canvas}
	class="graph"
	class:pointer={!!hoveredId}
	aria-label="Network of Edward's experience, projects, publications, skills, interests and quotes. Use the list below the graph for keyboard access."
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointerleave={() => (hoveredId = null)}
></canvas>

{#if hovered}
	<div class="sr-only" aria-live="polite">{hovered.title}</div>
{/if}

<style>
	.graph {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
		outline: none;
	}
	.pointer {
		cursor: pointer;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
