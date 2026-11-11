<!--
  The Four in a Row board: point at a column to see where your disc would land, click to drop it.
  The newest disc falls into place; the winning four glow.
-->
<script lang="ts">
	import type { BoardContext } from '$lib/games/online/Online.svelte';
	import { COLS, ROWS, canDrop, landing } from './rules';

	let { ctx }: { ctx: BoardContext } = $props();

	let hover = $state<number | null>(null);

	const v = $derived(ctx.view);
	const s = $derived(v.four!);
	const myDisc = $derived(v.you == v.first ? 1 : 2);
	const myTurn = $derived(v.phase == 'playing' && s.turn == myDisc);
	const lastCol = $derived((v.lastMove as { col: number } | undefined)?.col);
	/** The newest disc's cell (it gets the falling animation). */
	const newest = $derived.by(() => {
		if (lastCol == null) return -1;
		for (let r = 0; r < ROWS; r++) if (s.grid[r * COLS + lastCol]) return r * COLS + lastCol;
		return -1;
	});
	const ghost = $derived(myTurn && hover != null && canDrop(s, hover) ? landing(s, hover) * COLS + hover : -1);

	let lastKey = '';
	$effect(() => {
		const key = `${v.round}:${s.moves}`;
		if (s.moves && key != lastKey) ctx.sound('drop');
		lastKey = key;
	});

	function dropIn(col: number) {
		if (!myTurn || !canDrop(s, col)) return;
		hover = null;
		void ctx.send({ type: 'move', col });
	}
</script>

<p class="turn" class:mine={myTurn}>
	{#if v.phase != 'playing'}&nbsp;{:else if myTurn}Your turn: drop a disc{:else}Waiting for your opponent…{/if}
	<span class="you"><i class="disc d{myDisc}"></i> you</span>
</p>
<div class="four theme-{ctx.theme}" role="grid" aria-label="Four in a Row board">
	{#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
		<button
			class="col"
			style="grid-column: {c + 1}"
			disabled={!myTurn || !canDrop(s, c)}
			aria-label="Drop in column {c + 1}"
			onpointerenter={() => (hover = c)}
			onpointerleave={() => (hover = null)}
			onclick={() => dropIn(c)}
		></button>
	{/each}
	{#each s.grid as cell, i (i)}
		<div class="cell" style="grid-column: {(i % COLS) + 1}; grid-row: {Math.floor(i / COLS) + 1}">
			{#if cell}
				<i class="disc d{cell}" class:fall={i == newest} class:win={s.line?.includes(i)} style="--rows: {Math.floor(i / COLS) + 1}"></i>
			{:else if i == ghost}
				<i class="disc d{myDisc} ghost"></i>
			{/if}
		</div>
	{/each}
</div>

<style>
	.turn {
		margin: 0 0 6px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 14px;
		font-weight: 650;
		color: #94a3b8;
	}
	.turn.mine {
		color: #facc15;
	}
	.you {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.85rem;
		color: #c3cbe0;
	}
	.you .disc {
		width: 14px;
		height: 14px;
	}
	.four {
		--frame: #1d4ed8;
		--hole: #0b1226;
		--p1: #ef4444;
		--p2: #facc15;
		position: relative;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: repeat(6, 1fr);
		aspect-ratio: 7 / 6;
		width: 100%;
		padding: 2.2%;
		gap: 2.2%;
		border-radius: 14px;
		background: var(--frame);
		box-shadow:
			inset 0 -6px 0 rgba(0, 0, 0, 0.25),
			0 20px 50px -20px rgba(0, 0, 0, 0.8);
		overflow: hidden;
	}
	.theme-night {
		--frame: #111827;
		--hole: #030712;
		--p1: #22d3ee;
		--p2: #f472b6;
	}
	.theme-candy {
		--frame: #f9a8d4;
		--hole: #fdf2f8;
		--p1: #8b5cf6;
		--p2: #34d399;
	}
	.col {
		grid-row: 1 / -1;
		z-index: 2;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 10px;
	}
	.col:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
	}
	.col:disabled {
		cursor: default;
	}
	.cell {
		border-radius: 50%;
		background: var(--hole);
		box-shadow: inset 0 4px 6px rgba(0, 0, 0, 0.45);
		display: grid;
	}
	.disc {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		box-shadow:
			inset 0 -5px 0 rgba(0, 0, 0, 0.22),
			inset 0 4px 0 rgba(255, 255, 255, 0.25);
	}
	.d1 {
		background: var(--p1, #ef4444);
	}
	.d2 {
		background: var(--p2, #facc15);
	}
	.ghost {
		opacity: 0.35;
	}
	.fall {
		animation: fall calc(0.12s + var(--rows) * 0.05s) cubic-bezier(0.5, 0, 1, 1);
	}
	@keyframes fall {
		from {
			transform: translateY(calc(var(--rows) * -118%));
		}
	}
	.win {
		animation: glow 0.9s ease-in-out infinite alternate;
	}
	@keyframes glow {
		to {
			box-shadow:
				0 0 0 4px #fff,
				0 0 18px 6px rgba(255, 255, 255, 0.8);
		}
	}
</style>
