<!--
  The NEOS simulator: one continuous world of little neural-net organisms that eat, breed and
  evolve (see $lib/neos/sim). Drawn on a canvas at up to 30 frames a second, and only while it's
  on screen. Settings, the genetic algorithm's parts, live stats, and one saved run (settings,
  stats and the NEOS's genes) kept in this browser.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ALGOS, DEFAULTS, DT, RANGES, Sim, WORLD, type Algo, type Config, type Crossover, type Selection } from '$lib/neos/sim';

	let { compact = false }: { compact?: boolean } = $props();

	const SAVE_KEY = 'neos-sim-save';
	const sim = new Sim(DEFAULTS);
	let cfg = $state<Config>({ ...DEFAULTS });
	let running = $state(true);
	let speed = $state(2);
	let tab = $state<'settings' | 'algo' | 'stats'>('stats');
	let live = $state(sim.live());
	let totals = $state({ ...sim.totals });
	let history = $state([...sim.history]);
	let extinct = $state(false);
	let saved = $state<number | null>(null);
	let note = $state('');

	let canvas: HTMLCanvasElement;
	let chart = $state<HTMLCanvasElement>();
	let chartBox = $state<HTMLDivElement>();
	/** Each generation gets at least this much of the chart; past the box's width it scrolls sideways. */
	const GEN_PX = 10;
	let root: HTMLElement;

	// Settings apply as they change.
	$effect(() => {
		sim.configure($state.snapshot(cfg) as Config);
	});

	const SLIDERS: { key: keyof Config; label: string; fmt?: (v: number) => string; tip: string; only?: Algo[] }[] = [
		{ key: 'popSize', label: 'Population size', tip: 'NEOS at the start; with elitism refill on, the fittest’s babies keep it from dropping below this.' },
		{ key: 'popCap', label: 'Population cap', tip: 'No more babies once there are this many (the original stopped at 150).' },
		{ key: 'foodNum', label: 'Food', tip: 'Food particles in the world; each one eaten reappears somewhere else.' },
		{ key: 'elitism', label: 'Elitism', fmt: (v) => `top ${Math.round(v * 100)}%`, tip: 'Only NEOS this fit may breed, and truncation selection picks parents from them.' },
		{ key: 'hidden', label: 'Hidden nodes', tip: 'Size of every NEOS’s network (NEAT starts at 1 and grows its own).', only: ['ga', 'es', 'de', 'random'] },
		{ key: 'addNode', label: 'Add-node chance', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'NEAT: chance a baby grows a new hidden node.', only: ['neat'] },
		{ key: 'compat', label: 'Species threshold', fmt: (v) => v.toFixed(1), tip: 'NEAT: how different two NEOS may be and still mate. Lower = more, smaller species.', only: ['neat'] },
		{ key: 'deF', label: 'Differential weight F', fmt: (v) => v.toFixed(2), tip: 'Differential evolution: how far along B − C a baby moves.', only: ['de'] },
		{ key: 'deCR', label: 'Crossover rate CR', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Differential evolution: chance each gene takes the new value.', only: ['de'] },
		{ key: 'mutate', label: 'Mutation rate', fmt: (v) => `${Math.round(v * 100)}%`, tip: 'Chance a baby is mutated.', only: ['neat', 'ga'] },
		{ key: 'mutStrength', label: 'Mutation strength', fmt: (v) => v.toFixed(2), tip: 'How big a mutation is (an evolution strategy’s noise).', only: ['neat', 'ga', 'es'] },
		{ key: 'mature', label: 'Maturity age', fmt: (v) => `${v} steps`, tip: 'NEOS younger than this can’t breed.' },
		{ key: 'lifeMin', label: 'Lifespan (min)', fmt: (v) => `${v} steps`, tip: 'Each NEOS lives a random number of steps between the min and max.' },
		{ key: 'lifeMax', label: 'Lifespan (max)', fmt: (v) => `${v} steps`, tip: 'Each NEOS lives a random number of steps between the min and max.' },
		{ key: 'cooldown', label: 'Breeding cooldown', fmt: (v) => `${v} steps`, tip: 'Rest between babies.' },
		{ key: 'vMax', label: 'Max speed', fmt: (v) => v.toFixed(2), tip: 'World units a second.' },
		{ key: 'dvMax', label: 'Max acceleration', fmt: (v) => v.toFixed(2), tip: 'How fast a NEOS can speed up or slow down.' },
		{ key: 'drMax', label: 'Max turn rate', fmt: (v) => `${v}°/s`, tip: 'How fast a NEOS can turn.' },
		{ key: 'genTime', label: 'Generation length', fmt: (v) => `${v} s`, tip: 'How often a generation’s stats are recorded. The world never stops.' }
	];
	const SELECTIONS: [Selection, string, string][] = [
		['truncation', 'Truncation', 'Parents are random picks from the top elitism % (the original).'],
		['tournament', 'Tournament', 'The fittest of 3 random NEOS, twice.'],
		['roulette', 'Roulette', 'Chance to be picked grows with fitness.']
	];
	const CROSSOVERS: [Crossover, string, string][] = [
		['blend', 'Blend', 'A random weighted average of both parents’ weights (the original).'],
		['uniform', 'Uniform', 'Each weight from one parent or the other, 50/50.'],
		['onepoint', 'One-point', 'The first part of the genes from one parent, the rest from the other.'],
		['none', 'None (clone)', 'Babies copy the first parent.']
	];
	const SWITCHES: { key: keyof Config; label: string; tip: string; group: 'mut' | 'life' }[] = [
		{ key: 'mutScale', label: 'Scale a weight (×0.9–1.1)', tip: 'The original mutation.', group: 'mut' },
		{ key: 'mutGauss', label: 'Gaussian noise on all weights', tip: 'Small random nudges everywhere.', group: 'mut' },
		{ key: 'mutReset', label: 'Reset a random weight', tip: 'One weight starts over.', group: 'mut' },
		{ key: 'mutLifespan', label: 'Inherit lifespan', tip: 'Babies get their parents’ average lifespan (± strength) instead of a random one.', group: 'mut' },
		{ key: 'breedInWorld', label: 'Breed when they meet', tip: 'Two fit, grown-up NEOS that touch have a baby.', group: 'life' },
		{ key: 'pickyMates', label: 'Only fit NEOS breed', tip: 'Mates must be in the top elitism %.', group: 'life' },
		{ key: 'seekMates', label: 'Seek mates in old age', tip: 'Past 75% of their life, NEOS swim toward fit mates instead of food.', group: 'life' },
		{ key: 'refill', label: 'Elitism refill', tip: 'Whenever the population drops below its size, the fittest NEOS’ babies top it back up.', group: 'life' },
		{ key: 'revive', label: 'Revive after extinction', tip: 'If everyone dies, the hall of fame’s genes start again.', group: 'life' }
	];

	function reset() {
		sim.reset();
		running = true;
		note = 'New world started.';
		sync();
	}
	function save() {
		try {
			const at = Date.now();
			localStorage.setItem(SAVE_KEY, JSON.stringify({ at, speed, ...sim.snapshot() }));
			saved = at;
			note = 'Saved: settings, stats and every NEOS’s genes.';
		} catch {
			note = 'Couldn’t save in this browser.';
		}
	}
	function load() {
		try {
			const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
			if (!s) return;
			sim.restore(s);
			cfg = { ...sim.cfg };
			speed = s.speed ?? speed;
			note = `Loaded your run from ${new Date(s.at).toLocaleString()}.`;
			sync();
		} catch {
			note = 'That save couldn’t be read.';
		}
	}
	function defaults() {
		cfg = { ...DEFAULTS };
		note = 'Settings back to the original’s.';
	}
	function sync() {
		live = sim.live();
		totals = { ...sim.totals };
		extinct = sim.extinct;
		if (history.length !== sim.history.length || history.at(-1) !== sim.history.at(-1)) history = [...sim.history];
	}

	// ── Drawing ──
	let ctx: CanvasRenderingContext2D | null = null;
	let size = 0;
	function fit() {
		const w = canvas.clientWidth;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		size = Math.round(w * dpr);
		if (canvas.width !== size) canvas.width = canvas.height = size;
	}
	function draw() {
		if (!ctx || !size) return;
		const pad = WORLD * 0.25;
		const k = size / (WORLD * 2 + pad * 2);
		const sx = (x: number) => (x + WORLD + pad) * k;
		const sy = (y: number) => (WORLD + pad - y) * k;
		ctx.fillStyle = '#cfe0f2';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = 'rgba(30, 58, 95, 0.25)';
		ctx.lineWidth = 1;
		ctx.strokeRect(sx(-WORLD), sy(WORLD), WORLD * 2 * k, WORLD * 2 * k);

		// Food: one path for all of it.
		const fr = Math.max(1.5, 0.03 * k);
		ctx.beginPath();
		for (let i = 0; i < sim.fx.length; i++) {
			const x = sx(sim.fx[i]);
			const y = sy(sim.fy[i]);
			ctx.moveTo(x + fr, y);
			ctx.arc(x, y, fr, 0, Math.PI * 2);
		}
		ctx.fillStyle = '#7b68ee';
		ctx.fill();
		ctx.strokeStyle = '#483d8b';
		ctx.stroke();

		// NEOS: one fill per colour, then every outline and tail in one stroke.
		const r = Math.max(2.5, 0.05 * k);
		const byColor = new Map<string, number[]>();
		sim.neos.forEach((n, i) => {
			const l = byColor.get(n.color);
			if (l) l.push(i);
			else byColor.set(n.color, [i]);
		});
		for (const [color, ids] of byColor) {
			ctx.beginPath();
			for (const i of ids) {
				const n = sim.neos[i];
				const x = sx(n.x);
				const y = sy(n.y);
				ctx.moveTo(x + r, y);
				ctx.arc(x, y, r, 0, Math.PI * 2);
			}
			ctx.fillStyle = color;
			ctx.fill();
		}
		ctx.beginPath();
		const tail = 0.075 * k;
		for (const n of sim.neos) {
			const x = sx(n.x);
			const y = sy(n.y);
			ctx.moveTo(x + r, y);
			ctx.arc(x, y, r, 0, Math.PI * 2);
			const a = (n.r * Math.PI) / 180;
			ctx.moveTo(x, y);
			ctx.lineTo(x + Math.cos(a) * tail, y - Math.sin(a) * tail);
		}
		ctx.strokeStyle = '#006400';
		ctx.lineWidth = Math.max(1, k * 0.008);
		ctx.stroke();

		ctx.fillStyle = '#1e3a5f';
		ctx.font = `600 ${Math.round(size * 0.032)}px system-ui, sans-serif`;
		ctx.textBaseline = 'top';
		ctx.fillText(`GENERATION: ${sim.gen}`, size * 0.03, size * 0.025);
		ctx.textAlign = 'right';
		ctx.fillText(`${sim.neos.length} NEOS`, size * 0.97, size * 0.025);
		ctx.textAlign = 'left';
		// This generation's progress along the bottom.
		ctx.fillStyle = 'rgba(30, 58, 95, 0.35)';
		ctx.fillRect(0, size - 4, size * (sim.genStep / Math.round(sim.cfg.genTime / DT)), 4);
	}

	/** Best and average fitness, and the population, per generation. */
	function drawChart() {
		if (!chart) return;
		const c = chart.getContext('2d');
		if (!c) return;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		const pts = history;
		// Wider than its box once there are many generations; stay at the newest end if already there.
		const box = chartBox;
		const atEnd = !box || box.scrollLeft + box.clientWidth >= box.scrollWidth - 4;
		const cssW = Math.max(box?.clientWidth ?? 0, pts.length * GEN_PX);
		chart.style.width = `${cssW}px`;
		const w = Math.round(cssW * dpr);
		const h = Math.round(chart.clientHeight * dpr);
		chart.width = w;
		chart.height = h;
		c.clearRect(0, 0, w, h);
		if (box && atEnd) box.scrollLeft = box.scrollWidth;
		if (pts.length < 2) {
			c.fillStyle = 'rgba(148, 163, 184, 0.8)';
			c.font = `${12 * dpr}px system-ui, sans-serif`;
			c.fillText('The chart fills in as generations finish.', 8 * dpr, h / 2);
			return;
		}
		const maxFit = Math.max(1, ...pts.map((p) => p.best));
		const maxPop = Math.max(1, ...pts.map((p) => p.alive));
		const x = (i: number) => (i / (pts.length - 1)) * (w - 4) + 2;
		const line = (vals: number[], max: number, color: string, fill = false) => {
			c.beginPath();
			vals.forEach((v, i) => (i ? c.lineTo(x(i), h - 4 - (v / max) * (h - 12)) : c.moveTo(x(i), h - 4 - (v / max) * (h - 12))));
			if (fill) {
				c.lineTo(x(vals.length - 1), h);
				c.lineTo(x(0), h);
				c.fillStyle = color;
				c.fill();
			} else {
				c.strokeStyle = color;
				c.lineWidth = 2 * dpr;
				c.stroke();
			}
		};
		line(pts.map((p) => p.alive), maxPop, 'rgba(148, 163, 184, 0.15)', true);
		line(pts.map((p) => p.avg), maxFit, '#38bdf8');
		line(pts.map((p) => p.best), maxFit, '#4ade80');
	}
	$effect(() => {
		void history;
		void tab;
		drawChart();
	});

	onMount(() => {
		ctx = canvas.getContext('2d', { alpha: false });
		try {
			const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
			saved = s?.at ?? null;
		} catch {
			/* storage blocked */
		}
		fit();
		const ro = new ResizeObserver(() => (fit(), draw()));
		ro.observe(canvas);
		// Only run while it can be seen.
		let visible = true;
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
		io.observe(root);
		let raf = 0;
		let last = 0;
		let lastSync = 0;
		const frame = (t: number) => {
			raf = requestAnimationFrame(frame);
			if (!visible || t - last < 33) return; // ~30 fps is plenty
			last = t;
			if (running && !sim.extinct) for (let i = 0; i < speed; i++) sim.step();
			draw();
			if (t - lastSync > 250) {
				lastSync = t;
				sync();
			}
		};
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
		};
	});

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

<section class="neos" class:compact bind:this={root} data-swipe-ignore aria-label="NEOS simulator">
	<div class="grid">
	<div class="stage">
		<!-- A fixed square box with the canvas drawn inside it, so the canvas's pixel size never feeds back into the layout. -->
		<div class="view">
			<canvas bind:this={canvas} aria-label="NEOS swimming, eating and breeding"></canvas>
			{#if extinct}<div class="extinct">Extinct! Turn on “Revive after extinction” or start a new world.</div>{/if}
		</div>
		<div class="bar">
			<button class="play" onclick={() => (running = !running)} aria-label={running ? 'Pause' : 'Play'}>{running ? '❚❚' : '▶'}</button>
			<label class="speed" title="Simulation steps per frame">
				<span>Speed ×{speed}</span>
				<input type="range" min="1" max="10" step="1" bind:value={speed} aria-label="Speed" />
			</label>
			<button onclick={reset} title="Start a new world with these settings">↺ New world</button>
			<button onclick={save} title="Keep this run (settings, stats, genes) in this browser">💾 Save</button>
			<button onclick={load} disabled={!saved} title={saved ? `Saved ${when(saved)}` : 'Nothing saved yet'}>📂 Load</button>
		</div>
		{#if note}<p class="note">{note}<button aria-label="Dismiss" onclick={() => (note = '')}>✕</button></p>{/if}
	</div>

	<div class="side-box">
	<div class="side">
		<div class="tabs" role="tablist">
			<button role="tab" aria-selected={tab === 'stats'} class:on={tab === 'stats'} onclick={() => (tab = 'stats')}>Stats</button>
			<button role="tab" aria-selected={tab === 'settings'} class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>Hyperparameters</button>
			<button role="tab" aria-selected={tab === 'algo'} class:on={tab === 'algo'} onclick={() => (tab = 'algo')}>Algorithm</button>
		</div>

		{#if tab === 'stats'}
			<div class="stats">
				<div><span>Time</span><b>{clock(live.time)}</b></div>
				<div><span>Generation</span><b>{sim.gen} <small>({pct(live.progress)})</small></b></div>
				<div><span>Alive</span><b>{live.alive}</b></div>
				<div><span>Lineage</span><b>gen {live.lineage}</b></div>
				<div><span>Best now</span><b>{live.best}</b></div>
				<div><span>Average now</span><b>{live.avg.toFixed(2)}</b></div>
				<div><span>Best ever</span><b>{totals.bestEver}</b></div>
				<div><span>Food eaten</span><b>{totals.food.toLocaleString()}</b></div>
				<div><span>Born</span><b>{totals.born.toLocaleString()}</b></div>
				<div><span>Died</span><b>{totals.died.toLocaleString()}</b></div>
				<div><span>Extinctions</span><b>{totals.extinctions}</b></div>
				<div><span>Deepest lineage</span><b>gen {totals.lineage}</b></div>
				<div><span>Hidden nodes</span><b>{live.hidden.toFixed(1)} <small>avg</small></b></div>
				{#if cfg.algo === 'neat'}<div><span>Species</span><b>{live.species}</b></div>{/if}
			</div>
			<div class="legend"><i style="--c: #4ade80"></i>Best <i style="--c: #38bdf8"></i>Average <i class="area"></i>Population</div>
			<div class="chart-box" bind:this={chartBox}><canvas class="chart" bind:this={chart} aria-label="Fitness per generation"></canvas></div>
			<div class="table-box">
				<table>
					<thead><tr><th>Gen</th><th>Best</th><th>Avg</th><th>Alive</th><th>Total</th><th>Born</th></tr></thead>
					<tbody>
						{#each history.toReversed() as h (h.gen)}
							<tr><td>{h.gen}</td><td>{h.best}</td><td>{h.avg.toFixed(2)}</td><td>{h.alive}</td><td>{h.total}</td><td>{h.born}</td></tr>
						{:else}
							<tr><td colspan="6" class="none">Each generation’s stats appear here.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if tab === 'settings'}
			<div class="sliders">
				{#each SLIDERS.filter((s) => !s.only || s.only.includes(cfg.algo)) as s (s.key)}
					{@const [min, max, step] = RANGES[s.key]}
					{@const v = cfg[s.key] as number}
					<label title={s.tip}>
						<span class="lab">{s.label}<b>{s.fmt ? s.fmt(v) : v}</b></span>
						<input type="range" {min} {max} {step} value={v} oninput={(e) => ((cfg[s.key] as number) = Number(e.currentTarget.value))} />
					</label>
				{/each}
			</div>
			<button class="small" onclick={defaults}>Reset to the original’s settings</button>
		{:else}
			<fieldset class="algos">
				<legend>Evolution algorithm</legend>
				{#each ALGOS as a (a.id)}
					<label class="algo" class:on={cfg.algo === a.id}>
						<input type="radio" name="neos-algo" value={a.id} bind:group={cfg.algo} />
						<span><b>{a.name}</b><small>{a.about}</small></span>
					</label>
				{/each}
			</fieldset>
			{#if cfg.algo === 'neat' || cfg.algo === 'ga'}
			<fieldset>
				<legend>Selection</legend>
				{#each SELECTIONS as [id, label, tip] (id)}
					<label class="opt" title={tip}><input type="radio" name="neos-sel" value={id} bind:group={cfg.selection} />{label}</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Crossover</legend>
				{#each CROSSOVERS as [id, label, tip] (id)}
					<label class="opt" title={tip}><input type="radio" name="neos-cross" value={id} bind:group={cfg.crossover} />{label}</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Mutations</legend>
				{#each SWITCHES.filter((s) => s.group === 'mut') as s (s.key)}
					<label class="opt" title={s.tip}><input type="checkbox" bind:checked={cfg[s.key] as boolean} />{s.label}</label>
				{/each}
			</fieldset>
			{:else}
				<p class="hint">{cfg.algo === 'es' ? 'An evolution strategy mutates every baby with Gaussian noise (Mutation strength in Hyperparameters); there’s no crossover.' : cfg.algo === 'de' ? 'Differential evolution makes babies from three NEOS (F and CR in Hyperparameters); there’s no separate crossover or mutation.' : 'Random search passes nothing on: a baseline to compare the others against.'}</p>
			{/if}
			<fieldset>
				<legend>Life and elitism</legend>
				{#each SWITCHES.filter((s) => s.group === 'life') as s (s.key)}
					<label class="opt" title={s.tip}><input type="checkbox" bind:checked={cfg[s.key] as boolean} />{s.label}</label>
				{/each}
			</fieldset>
			<p class="hint">Changes apply straight away; the world keeps going.</p>
		{/if}
	</div>
	</div>
	</div>
</section>

<style>
	.neos {
		container-type: inline-size;
		padding: 12px;
		border-radius: 14px;
		background: rgba(10, 14, 26, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(74, 222, 128, 0.3);
		box-shadow: 0 0 40px -14px rgba(74, 222, 128, 0.5);
		color: #e2e8f0;
		font-size: 0.82rem;
		pointer-events: auto;
	}
	.neos.compact {
		padding: 8px;
		border-radius: 12px;
	}
	.stage {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.view {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
		background: #cfe0f2;
	}
	.view canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.extinct {
		position: absolute;
		left: 12px;
		right: 12px;
		top: 40%;
		padding: 10px;
		border-radius: 10px;
		background: rgba(10, 14, 26, 0.85);
		text-align: center;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	button {
		padding: 5px 10px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: #4ade80;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.play {
		min-width: 38px;
		background: rgba(74, 222, 128, 0.18);
	}
	.speed {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1 1 120px;
		color: #94a3b8;
		white-space: nowrap;
	}
	.speed input {
		flex: 1;
		min-width: 60px;
	}
	input[type='range'] {
		accent-color: #4ade80;
	}
	.note {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin: 0;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(74, 222, 128, 0.1);
		color: #bbf7d0;
	}
	.note button {
		padding: 0 4px;
		border: none;
		background: none;
	}
	.side-box {
		min-width: 0;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.tabs {
		display: flex;
		gap: 4px;
	}
	.tabs button {
		flex: 1;
		padding: 6px 4px;
		font-size: 0.78rem;
	}
	.tabs button.on {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.16);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 6px;
	}
	.stats div {
		display: flex;
		flex-direction: column;
		padding: 5px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
	}
	.stats span {
		color: #94a3b8;
		font-size: 0.7rem;
	}
	.stats b {
		font-variant-numeric: tabular-nums;
	}
	.stats small {
		color: #94a3b8;
		font-weight: 400;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 4px 10px;
		flex-wrap: wrap;
		color: #94a3b8;
		font-size: 0.72rem;
	}
	.legend i {
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: -6px;
		border-radius: 2px;
		background: var(--c);
	}
	.legend i.area {
		height: 8px;
		background: rgba(148, 163, 184, 0.3);
	}
	.chart-box {
		flex: none;
		height: 120px;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
		scrollbar-width: thin;
	}
	.chart {
		display: block;
		width: 100%;
		height: 100%;
	}
	.none {
		text-align: center;
		color: #94a3b8;
		padding: 12px 4px;
	}
	/* Every generation's row, in its own scrolling box. */
	.table-box {
		flex: none;
		height: 170px;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	thead th {
		position: sticky;
		top: 0;
		background: #0b1020;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
	}
	th,
	td {
		padding: 3px 4px;
		text-align: right;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
	}
	th {
		color: #94a3b8;
		font-weight: 600;
	}
	.sliders {
		display: grid;
		gap: 8px;
	}
	.sliders label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lab {
		display: flex;
		justify-content: space-between;
		color: #cbd5e1;
	}
	.lab b {
		color: #4ade80;
		font-variant-numeric: tabular-nums;
	}
	.small {
		align-self: flex-start;
		font-size: 0.75rem;
	}
	fieldset {
		margin: 0;
		padding: 6px 10px 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	legend {
		padding: 0 4px;
		color: #94a3b8;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.opt input {
		accent-color: #4ade80;
	}
	.hint {
		margin: 0;
		color: #94a3b8;
		font-size: 0.75rem;
	}
	.grid {
		display: grid;
		gap: 12px;
	}
	.algos {
		flex-direction: column;
		flex-wrap: nowrap;
	}
	.algo {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 5px 6px;
		border-radius: 8px;
		cursor: pointer;
	}
	.algo.on {
		background: rgba(74, 222, 128, 0.12);
	}
	.algo input {
		margin-top: 3px;
		accent-color: #4ade80;
	}
	.algo span {
		display: flex;
		flex-direction: column;
	}
	.algo small {
		color: #94a3b8;
		font-size: 0.72rem;
	}
	/* Wide: the world on the left, the controls beside it. */
	@container (min-width: 720px) {
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
		}
		/* As tall as the world beside it, scrolling inside rather than stretching the card. */
		.side-box {
			position: relative;
			min-width: 0;
			min-height: 360px;
		}
		.side {
			position: absolute;
			inset: 0;
			overflow-y: auto;
			scrollbar-width: thin;
		}
	}
</style>
