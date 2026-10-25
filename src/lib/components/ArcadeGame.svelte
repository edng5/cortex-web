<!--
  One E.Ngine game (Edward's high-school games, ported to TypeScript) on a <canvas>.
  Played with the keyboard, menus clicked; on touch screens, with on-screen controls
  (TouchControls) that send the same key presses, and the game sized to fill the width.
  `active` = false pauses the game (pop-up hidden, another game showing, or "Leave the game?").
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { ArcadeGame, Board } from '$lib/games/common';
	import type { GameSpec } from '$lib/games/registry';
	import { session } from '$lib/session.svelte';
	import { gameAudio } from '$lib/games/audio.svelte';
	import TouchControls from './TouchControls.svelte';
	import { pullSave, watchSave } from '$lib/games/cloud-save';

	let { spec, active = true, onquit }: { spec: GameSpec; active?: boolean; onquit?: () => void } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let status = $state<'loading' | 'running' | 'error'>('loading');
	let pointer = $state(false);
	/** A touch screen: show the on-screen controls. */
	let touch = $state(false);
	let portrait = $state(false);
	/** The game wants taps/swipes as controls right now (Frogger while playing). */
	let gestures = $state(false);
	/** Wide games held upright on a phone: ask to rotate, and wait (paused) until they do. */
	const rotate = $derived(touch && portrait && !!spec.touch.landscape);
	const playing = $derived(active && !rotate);
	let game: ArcadeGame | null = null;
	/** Send any unsynced progress to the account now (set once the game starts). */
	let syncFlush = () => {};
	const held = new Set<string>();

	onMount(() => {
		touch = matchMedia('(pointer: coarse)').matches;
		const upright = matchMedia('(orientation: portrait)');
		portrait = upright.matches;
		const onTurn = () => (portrait = upright.matches);
		upright.addEventListener('change', onTurn);
		let raf = 0;
		let disposed = false;
		// Signed in: start from the account's progress if it's newer (coins, upgrades, settings…),
		// and keep sending changes to it while playing.
		let sync: ReturnType<typeof watchSave> | null = null;
		(session.user ? pullSave(spec.id, spec.saveKey) : Promise.resolve())
			.then(() => {
				// Watch from here on (so taking the account's copy doesn't count as a new change).
				sync = watchSave(spec.id, spec.saveKey, () => !!session.user);
				syncFlush = sync.flush;
				return spec.load();
			})
			.then((g) => {
				if (disposed) return;
				game = g;
				g.onQuit = () => onquit?.();
				g.onScore = submitScore;
				g.sfx = (name) => gameAudio.play(spec.id, name);
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
					if (!game || !ctx || !playing) return;
					const g = !!game.gestures?.();
					if (g !== gestures) gestures = g;
					// The soundtrack for this screen (menu, or gameplay by mode / difficulty).
					gameAudio.music(game.musicTrack());
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
			upright.removeEventListener('change', onTurn);
			disposed = true;
			cancelAnimationFrame(raf);
			gameAudio.stopIf(spec.id);
			game?.save();
			sync?.stop();
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
			gameAudio.stopIf(spec.id);
			game?.leave();
			syncFlush();
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
	// On-screen controls: the same as pressing and releasing keys.
	function touchPress(code: string) {
		if (!game || !active) return;
		if (game.keyPressed(code)) held.add(code);
	}
	function touchRelease(code: string) {
		if (!game) return;
		game.keyReleased(code);
		held.delete(code);
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
	{#if rotate && active}
		<div class="rotate" role="status">
			<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
				<rect x="20" y="8" width="24" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
				<path d="M10 40a24 24 0 0 0 18 16M10 40l-2 8M10 40l7 3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
			</svg>
			<p>Rotate your phone to play {spec.title}</p>
		</div>
	{:else if touch && status === 'running' && active}
		<TouchControls spec={spec.touch} {gestures} press={touchPress} release={touchRelease} />
	{/if}
	<ul class="help" class:hidden={touch} aria-label="Controls">
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
		touch-action: none;
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
	/* Touch screens: as wide as the screen (same proportions), leaving room for the controls
	   below in portrait; in landscape they sit beside the game. */
	@media (pointer: coarse) {
		.stage {
			--reserve: 250px;
		}
		.screen {
			width: min(100vw, calc((100svh - var(--reserve)) * var(--w) / var(--h)));
			border-radius: 0;
			border-left: none;
			border-right: none;
		}
	}
	@media (pointer: coarse) and (orientation: landscape) {
		.stage {
			--reserve: 16px;
		}
	}
	/* "Rotate your phone" for wide games held upright. */
	.rotate {
		position: fixed;
		inset: 0;
		z-index: 1; /* under the pop-up's ✕, so it's still easy to leave */
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 14px;
		padding: 24px;
		text-align: center;
		background: rgba(3, 5, 10, 0.94);
		color: #e2e8f0;
		font-weight: 600;
	}
	.rotate svg {
		color: #a5b4fc;
		animation: tilt 1.8s ease-in-out infinite;
	}
	@keyframes tilt {
		0%,
		30% {
			transform: rotate(0deg);
		}
		60%,
		100% {
			transform: rotate(-90deg);
		}
	}
	.help.hidden {
		display: none;
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
