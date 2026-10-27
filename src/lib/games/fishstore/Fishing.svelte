<!--
  FishMart's fishing minigame, played like Stardew Valley's: cast (bait costs cash), wait for a bite
  and hook it, then hold (Space, mouse or finger) to lift the green bar and keep the fish inside it.
  The catch meter fills while the fish is in the bar and drains while it isn't. Rarer fish dart
  about faster and more often, and the bar is smaller. Fail, and you can net it with gems.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { BAIT_COST, DIFFICULTY, NET_GEMS, RARITY_COLOR, RARITY_LABEL, type Species, type Water } from './data';
	import { drawFish } from './fishArt';
	import { shade } from '../voxel';
	import type { FishStore } from './store.svelte';
	import FishIcon from './FishIcon.svelte';

	let { store, sfx, active }: { store: FishStore; sfx: (n: string) => void; active: boolean } = $props();

	type Phase = 'pick' | 'wait' | 'bite' | 'reel' | 'won' | 'lost';
	let phase = $state<Phase>('pick');
	let spot = $state<Water>('fresh');
	let fish = $state<Species | null>(null);
	let msg = $state('');
	let progress = $state(0.3);
	let canvas = $state<HTMLCanvasElement>();
	let holding = false;
	let bar = 0;
	let barV = 0;
	let fy = 0.5;
	let target = 0.5;
	let biteTimer = 0;

	function cast() {
		const r = store.cast(spot);
		if (!r.ok) {
			msg = r.msg;
			sfx('error');
			return;
		}
		fish = r.sp;
		msg = '';
		phase = 'wait';
		sfx('splash');
		biteTimer = 1.2 + Math.random() * 2.8;
	}
	function hook() {
		if (phase === 'bite') {
			phase = 'reel';
			progress = 0.3;
			bar = 0.2;
			barV = 0;
			fy = 0.4;
			target = 0.5;
			sfx('reel');
		} else if (phase === 'wait') {
			msg = 'Too early! Wait for the "!"';
		}
	}
	function finish(won: boolean) {
		if (won && fish) {
			const r = store.land(fish, false);
			phase = r.ok ? 'won' : 'lost';
			if (!r.ok) msg = r.msg;
			sfx(r.ok ? 'catch' : 'error');
		} else {
			phase = 'lost';
			sfx('escape');
		}
	}
	function net() {
		if (!fish) return;
		const r = store.land(fish, true);
		if (r.ok) {
			phase = 'won';
			sfx('catch');
		} else msg = r.msg;
	}

	onMount(() => {
		let raf = 0;
		let last = performance.now();
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			step(dt, now / 1000);
			draw(now / 1000);
		};
		raf = requestAnimationFrame(loop);
		const down = (e: KeyboardEvent) => {
			if (!active || e.code !== 'Space') return;
			e.preventDefault();
			if (phase === 'bite' || phase === 'wait') hook();
			holding = true;
		};
		const up = (e: KeyboardEvent) => {
			if (e.code === 'Space') holding = false;
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
		};
	});

	function step(dt: number, t: number) {
		if (phase === 'wait') {
			biteTimer -= dt;
			if (biteTimer <= 0) {
				phase = 'bite';
				biteTimer = 1.1;
				sfx('bite');
			}
		} else if (phase === 'bite') {
			biteTimer -= dt;
			if (biteTimer <= 0) {
				phase = 'lost';
				msg = 'Too slow: it stole the bait!';
				sfx('escape');
			}
		} else if (phase === 'reel' && fish) {
			const d = DIFFICULTY[fish.rarity] ?? DIFFICULTY.rare!;
			// The bar: hold to rise, let go to sink.
			barV += (holding ? 2.6 : -2.2) * dt;
			barV = Math.max(-1.2, Math.min(1.2, barV));
			bar += barV * dt;
			if (bar < 0) (bar = 0), (barV = Math.max(0, barV) * -0.3);
			if (bar > 1 - d.bar) (bar = 1 - d.bar), (barV = 0);
			// The fish darts between targets.
			if (Math.random() < d.jump * dt * 2) target = Math.random();
			fy += (target - fy) * Math.min(1, d.speed * dt * 2.2) + Math.sin(t * 9) * 0.002 * d.speed;
			fy = Math.max(0.03, Math.min(0.97, fy));
			const inside = fy >= bar && fy <= bar + d.bar;
			progress += (inside ? 0.3 : -0.2 - d.speed * 0.05) * dt;
			if (inside && Math.random() < 0.15) sfx('reel');
			if (progress >= 1) finish(true);
			else if (progress <= 0) finish(false);
		}
	}

	function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, d = 6) {
		c.fillStyle = shade(col, 1.2);
		c.fillRect(x, y - d, w, d);
		c.fillStyle = shade(col, 0.82);
		c.fillRect(x, y, w, h);
	}

	function draw(t: number) {
		if (!canvas) return;
		const W = canvas.clientWidth;
		const H = 300;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (canvas.width !== Math.round(W * dpr)) {
			canvas.width = Math.round(W * dpr);
			canvas.height = H * dpr;
		}
		const c = canvas.getContext('2d')!;
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.imageSmoothingEnabled = false;
		// A voxel shore: sky, water, a wooden dock.
		c.fillStyle = spot === 'salt' ? '#7fd4ff' : '#9ad8b0';
		c.fillRect(0, 0, W, H);
		const waterTop = 110;
		for (let i = 0; i < 6; i++) {
			c.fillStyle = spot === 'salt' ? ['#3aa8e8', '#2a90d8', '#2280c8', '#1a70b8', '#1460a8', '#105098'][i] : ['#3ab8a0', '#2aa890', '#229880', '#1a8870', '#147860', '#106850'][i];
			c.fillRect(0, waterTop + i * 32, W, 32);
		}
		for (let i = 0; i < 10; i++) {
			c.fillStyle = 'rgba(255,255,255,0.35)';
			c.fillRect((i * 97 + t * 30) % W, waterTop + 6 + (i % 3) * 14, 18, 3);
		}
		for (let i = 0; i < 5; i++) box(c, 20 + i * 34, waterTop - 6, 34, 18, '#8a5a2a', 8);
		box(c, 30, waterTop + 12, 10, 90, '#6a4220', 0);
		box(c, 150, waterTop + 12, 10, 90, '#6a4220', 0);
		if (spot === 'salt') {
			const cols = ['#ff7a8a', '#ffb84a', '#c86af0'];
			for (let i = 0; i < 6; i++) box(c, W * 0.55 + i * 30, H - 30 - (i % 3) * 14, 14, 40, cols[i % 3], 4);
		} else {
			for (let i = 0; i < 8; i++) box(c, W * 0.5 + i * 24, H - 36 - (i % 3) * 10, 10, 40, '#3a9a3a', 4);
		}
		// Line and bobber.
		const bobX = W * 0.42;
		const bob = phase === 'bite' ? Math.sin(t * 30) * 4 + 6 : Math.sin(t * 2) * 2;
		if (phase !== 'pick') {
			c.strokeStyle = '#fff';
			c.beginPath();
			c.moveTo(170, waterTop - 60);
			c.lineTo(bobX, waterTop + bob);
			c.stroke();
			box(c, bobX - 5, waterTop - 4 + bob, 10, 8, '#e83a3a', 4);
			box(c, 150, waterTop - 70, 24, 6, '#5a3a20', 3);
		}
		if (phase === 'bite') {
			c.fillStyle = '#fff';
			c.font = 'bold 42px sans-serif';
			c.textAlign = 'center';
			c.fillText('!', bobX, waterTop - 26);
		}
		// The catch meter (reeling).
		if (phase === 'reel' && fish) {
			const d = DIFFICULTY[fish.rarity] ?? DIFFICULTY.rare!;
			const mx = W - 120;
			const my = 30;
			const mh = 250;
			box(c, mx - 10, my, 60, mh + 10, '#6a4220', 8);
			c.fillStyle = '#123a5a';
			c.fillRect(mx, my + 5, 40, mh);
			// Green bar.
			const by = my + 5 + mh - (bar + d.bar) * mh;
			box(c, mx + 2, by, 36, d.bar * mh, holding ? '#6af07a' : '#4ad85a', 4);
			// The fish (a mystery until caught).
			const fyPx = my + 5 + mh - fy * mh;
			c.fillStyle = RARITY_COLOR[fish.rarity];
			c.fillRect(mx + 8, fyPx - 8, 24, 16);
			c.fillStyle = '#111';
			c.font = 'bold 13px sans-serif';
			c.textAlign = 'center';
			c.fillText('?', mx + 20, fyPx + 5);
			// Progress.
			c.fillStyle = '#222';
			c.fillRect(mx + 54, my + 5, 12, mh);
			c.fillStyle = progress > 0.66 ? '#4ade80' : progress > 0.33 ? '#facc15' : '#f87171';
			c.fillRect(mx + 54, my + 5 + mh * (1 - progress), 12, mh * progress);
		}
		if (phase === 'won' && fish) drawFish(c, fish, W * 0.42, waterTop - 40 + Math.sin(t * 4) * 4, 70, 1, t);
	}
</script>

<div class="fishing">
	<div class="spots">
		<button class:on={spot === 'fresh'} disabled={phase !== 'pick' && phase !== 'won' && phase !== 'lost'} onclick={() => (spot = 'fresh')}>🌿 River (freshwater)</button>
		<button class:on={spot === 'salt'} disabled={phase !== 'pick' && phase !== 'won' && phase !== 'lost'} onclick={() => (spot = 'salt')}>🪸 Reef (saltwater)</button>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="scene"
		onpointerdown={(e) => {
			e.preventDefault();
			if (phase === 'bite' || phase === 'wait') hook();
			holding = true;
		}}
		onpointerup={() => (holding = false)}
		onpointerleave={() => (holding = false)}
		onpointercancel={() => (holding = false)}
	>
		<canvas bind:this={canvas} style="height: 300px"></canvas>
		{#if phase === 'reel' && fish}
			<p class="hint" style="--c: {RARITY_COLOR[fish.rarity]}">Something <b>{RARITY_LABEL[fish.rarity]}</b> is on the line! Hold to lift the green bar.</p>
		{:else if phase === 'wait'}
			<p class="hint">Waiting for a bite… tap / Space when you see "!"</p>
		{:else if phase === 'bite'}
			<p class="hint big">BITE! Tap / Space now!</p>
		{/if}
	</div>

	{#if phase === 'pick'}
		<div class="panel">
			<p>Cast into the {spot === 'salt' ? 'reef' : 'river'} for rare fish to show off: Rare, Ultra-rare, Epic, even Legendary albinos and platinums. Bait costs ${BAIT_COST}.</p>
			<button class="primary" onclick={cast}>🎣 Cast (${BAIT_COST})</button>
		</div>
	{:else if phase === 'won' && fish}
		<div class="panel result" style="--c: {RARITY_COLOR[fish.rarity]}">
			<FishIcon id={fish.id} size={72} />
			<div>
				<p class="rar">{RARITY_LABEL[fish.rarity]}</p>
				<h3>{fish.name}</h3>
				<p class="sci">{fish.sci}</p>
				<p>Caught! It's waiting in your backroom.</p>
			</div>
			<button class="primary" onclick={() => (phase = 'pick')}>Fish again</button>
		</div>
	{:else if phase === 'lost'}
		<div class="panel">
			<p>{msg || 'It got away!'}</p>
			{#if fish && !msg.startsWith('Too slow') && !msg.startsWith('The backroom')}
				<button class="gem" onclick={net}>🥅 Net it ({NET_GEMS[fish.rarity] ?? 2} 💎)</button>
			{/if}
			<button onclick={() => ((phase = 'pick'), (msg = ''))}>Let it go</button>
		</div>
	{/if}
	{#if msg && phase === 'pick'}<p class="err">{msg}</p>{/if}
</div>

<style>
	.fishing {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.spots {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.spots button,
	.panel button {
		padding: 8px 14px;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.spots button.on {
		border-color: #2ab0e8;
		background: rgba(42, 176, 232, 0.2);
	}
	.scene {
		position: relative;
		user-select: none;
		touch-action: none;
		cursor: pointer;
	}
	canvas {
		display: block;
		width: 100%;
		border-radius: 12px;
	}
	.hint {
		position: absolute;
		left: 12px;
		bottom: 10px;
		margin: 0;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.55);
		font-size: 0.85rem;
	}
	.hint b {
		color: var(--c);
	}
	.hint.big {
		font-size: 1.2rem;
		font-weight: 800;
		color: #ffe14a;
	}
	.panel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.05);
	}
	.panel p {
		margin: 0;
		flex: 1 1 240px;
	}
	.primary {
		background: #2ab0e8 !important;
		border-color: #2ab0e8 !important;
		color: #04121c !important;
		font-weight: 700 !important;
	}
	.gem {
		background: rgba(167, 139, 250, 0.25) !important;
		border-color: #a78bfa !important;
	}
	.result {
		border: 2px solid var(--c);
	}
	.result h3 {
		margin: 2px 0;
	}
	.rar {
		color: var(--c);
		font-weight: 800;
		text-transform: uppercase;
		font-size: 0.75rem;
	}
	.sci {
		font-style: italic;
		color: #94a3b8;
		font-size: 0.8rem;
	}
	.err {
		color: #fca5a5;
		margin: 0;
	}
</style>
