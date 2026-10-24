<!--
  Top Gun, Edward's high-school Java game, ported to TypeScript and drawn on a <canvas>
  ($lib/games/topgun). Desktop only: it's played with the keyboard.
  `active` = false pauses the game (e.g. pop-up hidden, or the "Leave the game?" prompt).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { GAME_H, GAME_W, TICK_MS, TopGun, loadAssets } from '$lib/games/topgun/TopGun';
	import { session } from '$lib/session.svelte';

	let {
		autostart = false,
		active = true,
		onquit
	}: { autostart?: boolean; active?: boolean; onquit?: () => void } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let status = $state<'checking' | 'phone' | 'loading' | 'ready' | 'running' | 'error'>('checking');
	let game: TopGun | null = null;
	const held = new Set<string>();

	onMount(() => {
		const phone = matchMedia('(max-width: 720px), (pointer: coarse)').matches;
		if (phone) {
			status = 'phone';
			return;
		}
		status = 'loading';
		let raf = 0;
		let disposed = false;
		loadAssets()
			.then((assets) => {
				if (disposed) return;
				game = new TopGun(assets);
				game.onQuit = () => onquit?.();
				game.onMissionEnd = submitScore;
				game.loggedIn = !!session.user;
				loadBoard();
				status = autostart ? 'running' : 'ready';
				const ctx = setupCanvas();
				let last = performance.now();
				let acc = 0;
				const frame = (now: number) => {
					raf = requestAnimationFrame(frame);
					const dt = Math.min(250, now - last);
					last = now;
					if (!game || !ctx || status !== 'running' || !active) return;
					// Fixed-rate game ticks (like the Java loop), drawn once per screen refresh.
					acc += dt;
					let steps = 0;
					while (acc >= TICK_MS && steps < 8) {
						game.tick();
						acc -= TICK_MS;
						steps++;
					}
					if (steps === 8) acc = 0; // fell far behind (tab was busy): don't fast-forward
					game.paint(ctx, now);
				};
				raf = requestAnimationFrame(frame);
				if (autostart) queueMicrotask(() => canvas?.focus());
			})
			.catch((err) => {
				console.error('[topgun]', err);
				status = 'error';
			});
		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			game?.save();
		};
	});

	// Draw one frame right away (so the menu shows before the first tick), sharp on HiDPI screens.
	function setupCanvas(): CanvasRenderingContext2D | null {
		if (!canvas) return null;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = GAME_W * dpr;
		canvas.height = GAME_H * dpr;
		const ctx = canvas.getContext('2d');
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (ctx && game) game.paint(ctx, performance.now());
		return ctx;
	}

	// ── Global high scores ──
	type Board = NonNullable<TopGun['global']>;
	async function loadBoard() {
		try {
			const res = await fetch('/api/topgun/scores');
			if (res.ok && game) game.global = (await res.json()) as Board;
		} catch {
			/* offline: the high scores screen falls back to this browser's scores */
		}
	}
	async function submitScore(mission: number, score: number) {
		if (!session.user || score <= 0) return;
		try {
			const res = await fetch('/api/topgun/scores', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mission, score })
			});
			if (res.ok && game) game.global = (await res.json()) as Board;
		} catch {
			/* offline: the score still counts in this browser */
		}
	}
	$effect(() => {
		const signedIn = !!session.user;
		if (game) game.loggedIn = signedIn;
	});

	// Paused while hidden: save, and let go of held keys so the plane doesn't keep turning.
	$effect(() => {
		if (!active) {
			releaseAll();
			game?.save();
		} else if (status === 'running') {
			queueMicrotask(() => canvas?.focus());
			loadBoard(); // reopened: refresh the global high scores
		}
	});

	function start() {
		if (status !== 'ready') return;
		status = 'running';
		canvas?.focus();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (!game || status !== 'running' || !active) return;
		if (game.keyPressed(e.code)) {
			e.preventDefault();
			held.add(e.code);
		}
	}
	function onKeyUp(e: KeyboardEvent) {
		if (!game || status !== 'running') return;
		if (game.keyReleased(e.code)) {
			e.preventDefault();
			held.delete(e.code);
		}
	}
	function releaseAll() {
		for (const code of held) game?.keyReleased(code);
		held.clear();
	}
</script>

{#if status === 'phone'}
	<section class="note">
		<p><strong>Top Gun needs a keyboard,</strong> so it's playable on a computer only.</p>
		<p>On your phone, you can watch the gameplay video instead:</p>
		<div class="video">
			<iframe
				src="https://www.youtube-nocookie.com/embed/FHri_2SCaCQ?rel=0"
				title="Top Gun gameplay"
				allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
	</section>
{:else}
	<section class="stage">
		<div class="screen" style="--w: {GAME_W}px; --h: {GAME_H}px">
			<canvas
				bind:this={canvas}
				tabindex="0"
				aria-label="Top Gun"
				onkeydown={onKeyDown}
				onkeyup={onKeyUp}
				onblur={releaseAll}
			></canvas>
			{#if status !== 'running'}
				<div class="cover">
					{#if status === 'loading' || status === 'checking'}
						<p class="msg">Loading…</p>
					{:else if status === 'error'}
						<p class="msg err">The game could not load. Please refresh the page and try again.</p>
					{:else}
						<button class="start" onclick={start}>▶ Play Top Gun</button>
					{/if}
				</div>
			{/if}
		</div>
		<ul class="help" aria-label="Controls">
			<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly / menus</li>
			<li><kbd>Space</kbd> guns</li>
			<li><kbd>Shift</kbd> missile</li>
			<li><kbd>Enter</kbd> select / pause</li>
			<li>Click the game first</li>
		</ul>
	</section>
{/if}

<style>
	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
	}
	.screen {
		position: relative;
		width: var(--w);
		height: var(--h);
		max-width: calc(100vw - 32px);
		flex: none;
		overflow: hidden;
		border-radius: 12px;
		border: 1px solid rgba(56, 189, 248, 0.45);
		background: #000 url('/games/topgun/TGMM.png') center / cover no-repeat;
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.9),
			0 0 50px -12px rgba(56, 189, 248, 0.45);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		outline: none;
		image-rendering: pixelated;
	}
	.cover {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 12px;
		text-align: center;
		background: rgba(3, 5, 10, 0.55);
		backdrop-filter: blur(2px);
	}
	.start {
		padding: 14px 26px;
		border-radius: 12px;
		border: none;
		background: #0ea5e9;
		color: #fff;
		font: inherit;
		font-size: 1.1rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 10px 30px -8px rgba(14, 165, 233, 0.8);
	}
	.start:hover {
		background: #0284c7;
	}
	.msg {
		margin: 0;
		max-width: 360px;
		color: #e2e8f0;
	}
	.msg.err {
		color: #fca5a5;
	}
	.help {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 20px;
		max-width: 600px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.88rem;
		color: var(--muted, #94a3b8);
	}
	kbd {
		display: inline-block;
		min-width: 20px;
		margin-right: 3px;
		padding: 1px 6px;
		border-radius: 5px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
		color: #e2e8f0;
		font: inherit;
		font-size: 0.8rem;
		text-align: center;
	}
	.note {
		max-width: 640px;
		margin: 0 auto;
		color: var(--muted, #94a3b8);
	}
	.note strong {
		color: #e2e8f0;
	}
	.video {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(56, 189, 248, 0.35);
	}
	.video iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
</style>
