<!--
  One E.Ngine game (Edward's high-school Java games, ported to TypeScript) on a <canvas>.
  Desktop only: they're played with the keyboard; menus are clicked.
  `active` = false pauses the game (pop-up hidden, another game showing, or "Leave the game?").
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { ArcadeGame, Board } from '$lib/games/common';
	import type { GameSpec } from '$lib/games/registry';
	import { session } from '$lib/session.svelte';

	let { spec, active = true, onquit }: { spec: GameSpec; active?: boolean; onquit?: () => void } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let status = $state<'loading' | 'running' | 'error'>('loading');
	let pointer = $state(false);
	let game: ArcadeGame | null = null;
	const held = new Set<string>();

	onMount(() => {
		let raf = 0;
		let disposed = false;
		spec
			.load()
			.then((g) => {
				if (disposed) return;
				game = g;
				g.onQuit = () => onquit?.();
				g.onScore = submitScore;
				g.loggedIn = !!session.user;
				loadBoard();
				status = 'running';
				const ctx = setupCanvas();
				let last = performance.now();
				let acc = 0;
				const frame = (now: number) => {
					raf = requestAnimationFrame(frame);
					const dt = Math.min(250, now - last);
					last = now;
					if (!game || !ctx || !active) return;
					// Fixed-rate game ticks (like the Java loop), drawn once per screen refresh.
					acc += dt;
					let steps = 0;
					while (acc >= spec.tickMs && steps < 10) {
						game.tick();
						acc -= spec.tickMs;
						steps++;
					}
					if (steps === 10) acc = 0; // fell far behind (tab was busy): don't fast-forward
					game.paint(ctx, now);
				};
				raf = requestAnimationFrame(frame);
				queueMicrotask(() => canvas?.focus());
			})
			.catch((err) => {
				console.error(`[${spec.id}]`, err);
				status = 'error';
			});
		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			game?.save();
		};
	});

	// Sharp on HiDPI screens; the game draws in its own (Java window) coordinates.
	function setupCanvas(): CanvasRenderingContext2D | null {
		if (!canvas) return null;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = spec.w * dpr;
		canvas.height = spec.h * dpr;
		const ctx = canvas.getContext('2d');
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (ctx && game) game.paint(ctx, performance.now());
		return ctx;
	}

	// ── Global high scores ──
	const url = $derived(`/api/games/${spec.id}/scores`);
	async function loadBoard() {
		try {
			const res = await fetch(url);
			if (res.ok && game) game.global = (await res.json()) as Board;
		} catch {
			/* offline: the high scores screen falls back to this browser's scores */
		}
	}
	/** Best score sent per board this visit, so leaving and coming back doesn't resend it. */
	const sent: Record<number, number> = {};
	async function submitScore(board: number, score: number) {
		if (!session.user || score <= 0 || score <= (sent[board] ?? 0)) return;
		sent[board] = score;
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ board, score })
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
	// A new leaderboard name: show it on the board.
	$effect(() => {
		void session.playerName;
		if (game) loadBoard();
	});

	// Paused while hidden (Esc, ✕, back to the games menu): let go of held keys so nothing keeps
	// moving, and count the run so far, as quitting from the game's own menu would.
	$effect(() => {
		if (!active) {
			releaseAll();
			game?.leave();
		} else if (status === 'running') {
			queueMicrotask(() => canvas?.focus());
			loadBoard(); // back again: refresh the global high scores
		}
	});

	function onKeyDown(e: KeyboardEvent) {
		if (!game || !active) return;
		if (game.keyPressed(e.code)) {
			e.preventDefault();
			held.add(e.code);
		}
	}
	function onKeyUp(e: KeyboardEvent) {
		if (!game) return;
		if (game.keyReleased(e.code)) {
			e.preventDefault();
			held.delete(e.code);
		}
	}
	function releaseAll() {
		for (const code of held) game?.keyReleased(code);
		held.clear();
	}

	// ── Mouse: page pixels → game coordinates ──
	function toGame(e: PointerEvent): [number, number] {
		const r = canvas!.getBoundingClientRect();
		return [((e.clientX - r.left) * spec.w) / r.width, ((e.clientY - r.top) * spec.h) / r.height];
	}
	function onPointerMove(e: PointerEvent) {
		if (!game || !active) return;
		pointer = game.pointerMove(...toGame(e));
	}
	function onPointerDown(e: PointerEvent) {
		if (!game || !active || e.button !== 0) return;
		canvas?.focus();
		game.pointerDown(...toGame(e));
		pointer = game.pointerMove(...toGame(e));
	}
</script>

<section class="stage">
	<div class="screen" style="--w: {spec.w}; --h: {spec.h}; --accent: {spec.accent}">
		<canvas
			bind:this={canvas}
			class:pointer
			tabindex="0"
			aria-label={spec.title}
			onkeydown={onKeyDown}
			onkeyup={onKeyUp}
			onblur={releaseAll}
			onpointermove={onPointerMove}
			onpointerdown={onPointerDown}
		></canvas>
		{#if status !== 'running'}
			<div class="cover">
				{#if status === 'loading'}
					<p class="msg">Loading {spec.title}…</p>
				{:else}
					<p class="msg err">The game could not load. Please refresh the page and try again.</p>
				{/if}
			</div>
		{/if}
	</div>
	<ul class="help" aria-label="Controls">
		{#each spec.help as h (h.label)}
			<li>{#each h.keys as k (k)}<kbd>{k}</kbd>{/each} {h.label}</li>
		{/each}
	</ul>
</section>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.screen {
		position: relative;
		/* As big as the game, shrunk to fit the window (keeping its shape). */
		width: min(calc(var(--w) * 1px), calc(100vw - 72px), calc((100vh - 170px) * var(--w) / var(--h)));
		aspect-ratio: var(--w) / var(--h);
		flex: none;
		overflow: hidden;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
		background: #000;
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.9),
			0 0 50px -12px color-mix(in srgb, var(--accent) 50%, transparent);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		outline: none;
	}
	canvas.pointer {
		cursor: pointer;
	}
	.cover {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		text-align: center;
		background: rgba(3, 5, 10, 0.7);
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
		gap: 6px 18px;
		max-width: 640px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.86rem;
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
		font-size: 0.78rem;
		text-align: center;
	}
</style>
