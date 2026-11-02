<!--
  NEOS details: a floating window (drag it by its title bar, resize it from the corner) showing
  how well each species, diet and size class has done this run. Read from the simulator once a
  second while open.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { portal } from '$lib/actions/portal';
	import { SHADES, SIZE_CLASSES, type Sim } from '$lib/neos/sim';

	let { sim, onclose }: { sim: Sim; onclose: () => void } = $props();

	type Details = ReturnType<Sim['details']>;
	// (The simulator never changes while the window is open: it's read on a timer below.)
	// svelte-ignore state_referenced_locally
	let data = $state<Details>(sim.details());
	let tab = $state<'species' | 'diets' | 'sizes'>('species');
	type Group = Details['diets'][number];
	type Row = Details['species'][number];
	/**
	 * The stats columns, shared by the species, diet and size tables: what each shows (blank when it
	 * doesn't apply) and what it means (its tooltip). `species` columns are only in the species table.
	 */
	/** What every row (species, albinos, diets, sizes) has: the stats the columns show. */
	type Stats = Pick<Group, 'alive' | 'born' | 'died' | 'peak' | 'prey' | 'eatenBy' | 'starved' | 'escapes' | 'avgFit' | 'avgLife' | 'speed' | 'fecundity' | 'foodPer' | 'nodes' | 'matureAt' | 'rest'> &
		Partial<Pick<Row, 'id' | 'first' | 'last' | 'size' | 'litter'>>;
	type Col = { key: string; label: string; tip: string; show: (r: Stats) => string | number; species?: boolean };
	const dash = (ok: boolean, v: () => string | number) => (ok ? v() : '-');
	const COLS: Col[] = [
		{ key: 'alive', label: 'Alive', tip: 'Alive now (†: extinct)', show: (r) => r.alive || (r.id ? '†' : 0) },
		{ key: 'peak', label: 'Peak', tip: 'Most alive at once', show: (r) => r.peak },
		{ key: 'born', label: 'Born', tip: 'Born this run', show: (r) => r.born },
		{ key: 'first', label: 'Gens', tip: 'Generations it was around (first–last)', show: (r) => `${r.first}–${r.last ?? 'now'}`, species: true },
		{ key: 'avgLife', label: 'Lifespan', tip: 'How long they lived, on average', show: (r) => dash(!!r.died, () => life(r.avgLife)) },
		{ key: 'fecundity', label: 'Fecundity', tip: 'Babies each one had over its life, on average', show: (r) => dash(!!r.died, () => r.fecundity.toFixed(2)) },
		{ key: 'avgFit', label: 'Avg fitness', tip: 'Fitness at death, on average (food, prey, escapes)', show: (r) => dash(!!r.died, () => n1(r.avgFit)) },
		{ key: 'foodPer', label: 'Food/life', tip: 'Food eaten per NEOS', show: (r) => dash(!!r.born, () => n1(r.foodPer)) },
		{ key: 'speed', label: 'Speed', tip: 'How fast they swam over their lives, on average (world units a second)', show: (r) => dash(!!r.died, () => r.speed.toFixed(2)) },
		{ key: 'prey', label: 'Prey', tip: 'NEOS they ate', show: (r) => r.prey },
		{ key: 'eatenBy', label: 'Eaten', tip: 'Of theirs eaten by hunters', show: (r) => r.eatenBy },
		{ key: 'starved', label: 'Starved', tip: 'Of theirs that died of hunger', show: (r) => r.starved },
		{ key: 'escapes', label: 'Escapes', tip: 'Times they got away from a hunter', show: (r) => r.escapes },
		{ key: 'size', label: 'Size', tip: 'Body size at birth, on average (×1 is the original size)', show: (r) => (r.size !== undefined ? `×${r.size.toFixed(2)}` : ''), species: true },
		{ key: 'litter', label: 'Litter', tip: 'Litter size gene, on average', show: (r) => (r.litter !== undefined ? r.litter.toFixed(1) : ''), species: true },
		{ key: 'nodes', label: 'Nodes', tip: 'Hidden nodes in their networks, on average', show: (r) => dash(!!r.born, () => r.nodes.toFixed(1)) },
		{ key: 'matureAt', label: 'Matures', tip: 'Age they could first breed at, on average', show: (r) => dash(!!r.born, () => life(r.matureAt)) },
		{ key: 'rest', label: 'Rest', tip: 'Rest between births, on average', show: (r) => dash(!!r.born, () => life(r.rest)) }
	];
	const groupCols = COLS.filter((c) => !c.species);
	let sortBy = $state('born');
	let showExtinct = $state(true);

	const DIETS = ['Herbivores', 'Omnivores', 'Carnivores'];
	const DIET_ONE = ['Herbivore', 'Omnivore', 'Carnivore'];
	/** Line colours for the top species in the chart. */
	const LINES = ['#4ade80', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c'];

	const rows = $derived(
		data.species
			.filter((s) => showExtinct || s.alive)
			.toSorted((a, b) => {
				if (sortBy === 'name') return a.name.localeCompare(b.name);
				const k = sortBy as keyof Row;
				return Number(b[k] ?? -1) - Number(a[k] ?? -1);
			})
	);
	/** The species charted: the most born, and every one alive now with a big share. */
	const charted = $derived(data.species.toSorted((a, b) => b.born - a.born).slice(0, LINES.length));
	const colorOf = (id: number) => LINES[charted.findIndex((s) => s.id === id)] ?? null;

	// ── Dragging ──
	let x = $state(0);
	let y = $state(0);
	let drag: { dx: number; dy: number } | null = null;
	let win: HTMLElement;
	function down(e: PointerEvent) {
		if ((e.target as Element).closest('button, input, label')) return;
		drag = { dx: e.clientX - x, dy: e.clientY - y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const w = win.offsetWidth;
		x = Math.min(window.innerWidth - 60, Math.max(60 - w, e.clientX - drag.dx));
		y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.dy));
	}

	// ── The population chart: each charted species' count at the end of every generation ──
	let chart = $state<HTMLCanvasElement>();
	let chartBox = $state<HTMLDivElement>();
	function drawChart() {
		const c = chart?.getContext('2d');
		if (!chart || !c || !chartBox) return;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		const pts = data.history;
		const atEnd = chartBox.scrollLeft + chartBox.clientWidth >= chartBox.scrollWidth - 4;
		const cssW = Math.max(chartBox.clientWidth, pts.length * 12);
		chart.style.width = `${cssW}px`;
		const w = Math.round(cssW * dpr);
		const h = Math.round(chart.clientHeight * dpr);
		chart.width = w;
		chart.height = h;
		c.clearRect(0, 0, w, h);
		if (atEnd) chartBox.scrollLeft = chartBox.scrollWidth;
		if (pts.length < 2) {
			c.fillStyle = 'rgba(148, 163, 184, 0.8)';
			c.font = `${12 * dpr}px system-ui, sans-serif`;
			c.fillText('Fills in as generations finish.', 8 * dpr, h / 2);
			return;
		}
		const max = Math.max(1, ...pts.map((p) => Math.max(0, ...Object.values(p.counts))));
		const px = (i: number) => (i / (pts.length - 1)) * (w - 4) + 2;
		for (const s of charted) {
			c.beginPath();
			pts.forEach((p, i) => {
				const v = p.counts[s.id] ?? 0;
				const py = h - 4 - (v / max) * (h - 10);
				if (i) c.lineTo(px(i), py);
				else c.moveTo(px(i), py);
			});
			c.strokeStyle = colorOf(s.id)!;
			c.lineWidth = 2 * dpr;
			c.stroke();
		}
	}
	$effect(() => {
		void data;
		void tab;
		drawChart();
	});

	onMount(() => {
		x = Math.max(16, Math.round((window.innerWidth - Math.min(640, window.innerWidth - 32)) / 2));
		y = Math.max(16, Math.round(window.innerHeight * 0.08));
		const t = setInterval(() => (data = sim.details()), 1000);
		return () => clearInterval(t);
	});

	const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString();
	const life = (steps: number) => `${(steps * 0.04).toFixed(0)}s`;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div use:portal>
	<div class="win" bind:this={win} style="left: {x}px; top: {y}px" role="dialog" aria-label="NEOS details" data-swipe-ignore>
		<header role="toolbar" aria-label="NEOS details (drag to move)" tabindex="-1" onpointerdown={down} onpointermove={move} onpointerup={() => (drag = null)} onpointercancel={() => (drag = null)}>
			<span class="grip" aria-hidden="true">⠿</span>
			<h3>NEOS details</h3>
			<div class="tabs" role="tablist">
				<button role="tab" aria-selected={tab === 'species'} class:on={tab === 'species'} onclick={() => (tab = 'species')}>Species</button>
				<button role="tab" aria-selected={tab === 'diets'} class:on={tab === 'diets'} onclick={() => (tab = 'diets')}>Diets</button>
				<button role="tab" aria-selected={tab === 'sizes'} class:on={tab === 'sizes'} onclick={() => (tab = 'sizes')}>Sizes</button>
			</div>
			<button class="x" onclick={onclose} aria-label="Close">✕</button>
		</header>

		<div class="body">
			{#if tab === 'species'}
				<p class="hint">
					Names are <em>Genus species</em>. A species is a group of NEOS whose genes (and diet and size) stay close to its founder’s; every species
					starts in the original genus, <em>Neos</em>, and one that drifts far enough from every genus founds a new one ({data.genera} so far). The most
					successful kept breeding: sort by
					<b>Born</b> for the biggest lineages, <b>Peak</b> for the most at once, or <b>Avg fitness</b> for the best eaters.
				</p>
				<div class="legend">
					{#each charted as s (s.id)}<span><i style="--c: {colorOf(s.id)}"></i><em>{s.name}</em>{s.alive ? '' : ' †'}</span>{/each}
				</div>
				<div class="chart-box" bind:this={chartBox}><canvas bind:this={chart} aria-label="Population of each species per generation"></canvas></div>
				<div class="row">
					<label class="opt"><input type="checkbox" bind:checked={showExtinct} />Show extinct species ({data.species.filter((s) => !s.alive).length})</label>
					<span class="muted">Albinos so far: {data.species.reduce((n, s) => n + (s.albino?.born ?? 0), 0)} (1 in 1,000 babies; shown under their species)</span>
				</div>
				<div class="table-box">
					<table>
						<thead>
							<tr>
								<th class:sorted={sortBy === 'name'}><button onclick={() => (sortBy = 'name')}>Species</button></th>
								{#each COLS as c (c.key)}
									<th class:sorted={sortBy === c.key} title={c.tip}><button onclick={() => (sortBy = c.key)}>{c.label}</button></th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rows as s (s.id)}
								<tr class:extinct={!s.alive}>
									<td class="name">
										<i class="dot" style="background: {SHADES[s.diet][3]}" title={DIET_ONE[s.diet]}></i><em>{s.name}</em>{#if colorOf(s.id)}<i class="line" style="--c: {colorOf(s.id)}"></i>{/if}
									</td>
									{#each COLS as c (c.key)}<td>{c.show(s)}</td>{/each}
								</tr>
								{#if s.albino}
									{@const a = s.albino}
									<!-- Its albino subspecies (1 in 1,000 babies). -->
									<tr class="sub" class:extinct={!a.alive}>
										<td class="name"><span class="indent">↳</span><i class="dot albino" title="Albino"></i><em>{s.name}</em> (albino)</td>
										{#each COLS as c (c.key)}<td>{c.species ? '' : c.show({ ...a, id: s.id })}</td>{/each}
									</tr>
								{/if}
							{:else}
								<tr><td colspan={COLS.length + 1} class="none">No species yet: press ▶ Play.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				{@const groups = tab === 'diets' ? data.diets : data.sizes}
				{@const names = tab === 'diets' ? DIETS : SIZE_CLASSES}
				<p class="hint">
					{tab === 'diets'
						? 'How each diet has done this run (turn on predators in Algorithm for omnivores and carnivores).'
						: 'How each body size has done this run (turn on “Size and speed evolve” in Algorithm for sizes to change).'}
				</p>
				<div class="table-box">
					<table>
						<thead>
							<tr>
								<th></th>
								{#each groupCols as c (c.key)}<th title={c.tip}>{c.label}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each groups as g, i (i)}
								<tr class:extinct={!g.born}>
									<td class="name">{#if tab === 'diets'}<i class="dot" style="background: {SHADES[i][3]}"></i>{/if}{names[i]}</td>
									{#each groupCols as c (c.key)}<td>{c.show(g)}</td>{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.win {
		position: fixed;
		z-index: 70;
		width: min(640px, calc(100vw - 32px));
		height: min(560px, calc(100svh - 32px));
		min-width: 300px;
		min-height: 240px;
		max-width: calc(100vw - 16px);
		max-height: calc(100svh - 16px);
		display: flex;
		flex-direction: column;
		resize: both;
		overflow: hidden;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.96);
		border: 1px solid rgba(74, 222, 128, 0.35);
		box-shadow:
			0 24px 60px -16px rgba(0, 0, 0, 0.9),
			0 0 40px -14px rgba(74, 222, 128, 0.5);
		color: #e2e8f0;
		font-size: 0.8rem;
	}
	header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	header:active {
		cursor: grabbing;
	}
	.grip {
		color: #64748b;
	}
	h3 {
		margin: 0;
		font-size: 0.9rem;
	}
	.tabs {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	button {
		padding: 4px 9px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(255, 255, 255, 0.05);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.tabs button.on {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.16);
	}
	.x {
		border: none;
		background: none;
		font-size: 1rem;
		color: #94a3b8;
	}
	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		overflow: auto;
	}
	.hint {
		margin: 0;
		color: #94a3b8;
	}
	.hint b {
		color: #cbd5e1;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		color: #cbd5e1;
	}
	.legend i,
	.line {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: 5px;
		vertical-align: middle;
		border-radius: 2px;
		background: var(--c);
	}
	.line {
		margin: 0 0 0 6px;
	}
	.chart-box {
		flex: none;
		height: 130px;
		overflow-x: auto;
		overflow-y: hidden;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
	}
	.chart-box canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #cbd5e1;
		cursor: pointer;
	}
	.opt input {
		accent-color: #4ade80;
	}
	.table-box {
		flex: 1;
		min-height: 120px;
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	th,
	td {
		padding: 4px 6px;
		text-align: right;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
	}
	th {
		position: sticky;
		top: 0;
		background: #0b1020;
		color: #94a3b8;
		font-weight: 600;
	}
	th button {
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font-weight: inherit;
	}
	th.sorted {
		color: #4ade80;
	}
	th.sorted button::after {
		content: ' ▾';
	}
	.name {
		text-align: left;
	}
	/* The name column stays put while the stats scroll sideways (and its header in the corner). */
	td.name,
	th:first-child {
		position: sticky;
		left: 0;
		z-index: 1;
		background: #0b1020;
		box-shadow: 1px 0 0 rgba(148, 163, 184, 0.18);
	}
	th:first-child {
		z-index: 2;
	}
	tr.sub td.name {
		background: #0f1424;
	}
	.dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 6px;
		border-radius: 50%;
		vertical-align: middle;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.muted {
		color: #94a3b8;
	}
	tr.sub td {
		font-size: 0.74rem;
		background: rgba(245, 255, 250, 0.04);
	}
	.indent {
		margin: 0 4px 0 6px;
		color: #64748b;
	}
	.dot.albino {
		background: #f5fffa;
		box-shadow: 0 0 0 1px #94a3b8;
	}
	tr.extinct td {
		color: #64748b;
	}
	.none {
		text-align: center;
		color: #94a3b8;
		padding: 14px;
	}
</style>
