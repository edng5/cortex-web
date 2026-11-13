<!--
  The chess board: pick one of your pieces to see where it can go, then pick a square (or drag the
  piece there: mouse or finger; it springs back if dropped anywhere it can't go). Shows the
  last move and a king in check; asks what a promoting pawn becomes. Turned round when you're Black.
-->
<script lang="ts">
	import type { BoardContext } from '$lib/games/online/Online.svelte';
	import { legalMoves, squareName, type ChessState, type Move } from './rules';

	let { ctx }: { ctx: BoardContext } = $props();

	const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

	let picked = $state<number | null>(null);
	let promo = $state<{ from: number; to: number } | null>(null);

	const v = $derived(ctx.view);
	const c = $derived(v.chess!);
	const mine = $derived(v.you == v.first ? 'w' : 'b');
	const flip = $derived(mine == 'b');
	const myTurn = $derived(v.phase == 'playing' && c.turn == mine);
	const pos = $derived<ChessState>({ board: c.board, turn: c.turn, castling: c.castling, ep: c.ep, half: 0, seen: {} });
	const moves = $derived<Move[]>(myTurn && picked != null ? legalMoves(pos).filter((m) => m.from == picked) : []);
	const last = $derived(v.lastMove as { from: number; to: number; captured?: boolean } | undefined);
	const king = $derived(c.check ? c.board.indexOf(c.turn == 'w' ? 'K' : 'k') : -1);
	const order = $derived(Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i)));

	// A sound for each move as it arrives (yours or theirs).
	let lastKey = '';
	$effect(() => {
		const key = last ? `${v.round}:${last.from}-${last.to}` : '';
		if (key && key != lastKey) ctx.sound(c.check ? 'check' : last!.captured ? 'capture' : 'move');
		lastKey = key;
	});
	// A new round, or the move went through: clear the selection.
	$effect(() => {
		void c.board;
		picked = null;
		promo = null;
	});

	const colorOf = (p: string) => (p == '.' ? null : p == p.toUpperCase() ? 'w' : 'b');

	function tap(sq: number) {
		if (!myTurn || promo) return;
		const target = moves.find((m) => m.to == sq);
		if (target) {
			if (target.promo) promo = { from: target.from, to: target.to };
			else void send({ from: target.from, to: target.to });
			return;
		}
		if (colorOf(c.board[sq]) == mine) {
			picked = picked == sq ? null : sq;
			ctx.sound('select');
		} else picked = null;
	}
	// ── Dragging a piece ──
	let boardEl = $state<HTMLDivElement>();
	/** A piece being dragged: from where, where the pointer is (on the board), and the square under it. */
	let drag = $state<{ from: number; id: number; x: number; y: number; over: number | null; moved: boolean; sx: number; sy: number; wasPicked: boolean } | null>(null);
	/** The square under a point on the screen (or null, off the board). */
	function squareAt(cx: number, cy: number): number | null {
		const r = boardEl?.getBoundingClientRect();
		if (!r) return null;
		const col = Math.floor(((cx - r.left) / r.width) * 8);
		const row = Math.floor(((cy - r.top) / r.height) * 8);
		if (col < 0 || col > 7 || row < 0 || row > 7) return null;
		const i = row * 8 + col;
		return flip ? 63 - i : i;
	}
	function down(e: PointerEvent, sq: number) {
		if (!myTurn || promo || e.button > 0) return;
		// Not one of yours: a tap (move the picked piece there, or nothing).
		if (colorOf(c.board[sq]) != mine) return tap(sq);
		e.preventDefault();
		const r = boardEl!.getBoundingClientRect();
		const wasPicked = picked == sq;
		if (!wasPicked) {
			picked = sq;
			ctx.sound('select');
		}
		drag = { from: sq, id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, over: sq, moved: false, sx: e.clientX, sy: e.clientY, wasPicked };
		try {
			// (Keeps the moves coming while the pointer's off the board.)
			boardEl!.setPointerCapture(e.pointerId);
		} catch {
			/* not a live pointer */
		}
	}
	function move(e: PointerEvent) {
		if (!drag || e.pointerId != drag.id) return;
		const r = boardEl!.getBoundingClientRect();
		drag.x = e.clientX - r.left;
		drag.y = e.clientY - r.top;
		drag.over = squareAt(e.clientX, e.clientY);
		if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
	}
	function up(e: PointerEvent) {
		if (!drag || e.pointerId != drag.id) return;
		const d = drag;
		drag = null;
		if (!d.moved) {
			// A tap on a piece: it was picked on the way down; a second tap puts it back down.
			if (d.wasPicked) picked = null;
			return;
		}
		const to = squareAt(e.clientX, e.clientY);
		const target = to == null ? null : moves.find((m) => m.to == to);
		if (target) {
			if (target.promo) promo = { from: target.from, to: target.to };
			else void send({ from: target.from, to: target.to });
		}
		// (Anywhere else: it springs back, still picked.)
	}
	function cancelDrag() {
		drag = null;
	}

	async function send(m: Move) {
		promo = null;
		picked = null;
		await ctx.send({ type: 'move', move: m });
	}
</script>

<p class="turn" class:mine={myTurn}>
	{#if v.phase != 'playing'}&nbsp;{:else if myTurn}{c.check ? 'Check! ' : ''}Your move ({mine == 'w' ? 'White' : 'Black'}){:else}{c.check ? 'Check! ' : ''}Waiting for your opponent…{/if}
</p>
<div
	class="chess theme-{ctx.theme}"
	class:dragging={drag?.moved}
	bind:this={boardEl}
	role="group"
	aria-label="Chess board"
	onpointermove={move}
	onpointerup={up}
	onpointercancel={cancelDrag}
	onlostpointercapture={cancelDrag}
>
	{#each order as sq (sq)}
		{@const p = c.board[sq]}
		{@const target = moves.find((m) => m.to == sq)}
		<button
			class="sq"
			class:dark={((sq >> 3) + (sq & 7)) % 2 == 1}
			class:picked={picked == sq}
			class:last={last && (last.from == sq || last.to == sq)}
			class:check={sq == king}
			class:target={!!target && p == '.'}
			class:capture={!!target && p != '.'}
			class:over={drag?.moved && drag.over == sq && !!target}
			class:mine={myTurn && colorOf(p) == mine}
			aria-label={squareName(sq) + (p != '.' ? ' ' + p : '')}
			onpointerdown={(e) => down(e, sq)}
			onclick={(e) => e.detail == 0 && tap(sq)}
		>
			{#if p != '.'}<span class="pc" class:white={p == p.toUpperCase()} class:lifted={drag?.moved && drag.from == sq}>{GLYPH[p.toLowerCase()]}&#xFE0E;</span>{/if}
			{#if (sq & 7) == (flip ? 7 : 0)}<i class="rank">{8 - (sq >> 3)}</i>{/if}
			{#if sq >> 3 == (flip ? 0 : 7)}<i class="file">{'abcdefgh'[sq & 7]}</i>{/if}
		</button>
	{/each}
	{#if drag?.moved}
		<!-- The piece in hand, following the pointer. -->
		{@const p = c.board[drag.from]}
		<span class="ghost" style="left:{drag.x}px; top:{drag.y}px" aria-hidden="true"><span class="pc" class:white={p == p.toUpperCase()}>{GLYPH[p.toLowerCase()]}&#xFE0E;</span></span>
	{/if}
	{#if promo}
		<div class="promo">
			<p>Promote to</p>
			<div>
				{#each ['q', 'r', 'b', 'n'] as const as k (k)}
					<button onclick={() => send({ ...promo!, promo: k })} aria-label={k}>
						<span class="pc" class:white={mine == 'w'}>{GLYPH[k]}&#xFE0E;</span>
					</button>
				{/each}
			</div>
			<button class="cancel" onclick={() => (promo = null)}>Cancel</button>
		</div>
	{/if}
</div>

<style>
	.turn {
		margin: 0 0 6px;
		text-align: center;
		font-weight: 650;
		color: #94a3b8;
	}
	.turn.mine {
		color: #e0b46b;
	}
	.chess {
		--light: #f0d9b5;
		--dark: #b58863;
		--frame: #6b4a2e;
		position: relative;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		aspect-ratio: 1;
		width: 100%;
		border-radius: 8px;
		overflow: hidden;
		box-shadow:
			0 0 0 4px var(--frame),
			0 20px 50px -20px rgba(0, 0, 0, 0.8);
	}
	.theme-ocean {
		--light: #dbe9f4;
		--dark: #5b8db8;
		--frame: #2f5677;
	}
	.theme-neon {
		--light: #2c2f4a;
		--dark: #161829;
		--frame: #7c3aed;
	}
	.theme-marble {
		--light: #ece9e4;
		--dark: #8f949c;
		--frame: #5a5e66;
	}
	.sq {
		position: relative;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: var(--light);
		cursor: pointer;
		container-type: size;
	}
	.sq.dark {
		background: var(--dark);
	}
	.sq.last {
		background: color-mix(in srgb, var(--light) 55%, #e6d34a);
	}
	.sq.dark.last {
		background: color-mix(in srgb, var(--dark) 55%, #c9b520);
	}
	.sq.picked {
		box-shadow: inset 0 0 0 4px #4ade80;
	}
	/* Dragging: your pieces can be grabbed, the square under the piece lights up. */
	.sq.mine {
		cursor: grab;
		touch-action: none;
	}
	.chess.dragging,
	.chess.dragging .sq {
		cursor: grabbing;
	}
	.sq.over {
		box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.85);
	}
	.pc.lifted {
		opacity: 0.3;
	}
	.ghost {
		position: absolute;
		width: 12.5%;
		height: 12.5%;
		display: grid;
		place-items: center;
		transform: translate(-50%, -55%) scale(1.15);
		pointer-events: none;
		z-index: 5;
		container-type: size;
		filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.45));
	}
	.sq.check {
		background: radial-gradient(circle, #ff4d4d 0%, #c81e1e 45%, transparent 75%), var(--light);
	}
	.sq.dark.check {
		background: radial-gradient(circle, #ff4d4d 0%, #c81e1e 45%, transparent 75%), var(--dark);
	}
	.sq.target::after {
		content: '';
		position: absolute;
		width: 28%;
		height: 28%;
		border-radius: 50%;
		background: rgba(20, 30, 20, 0.35);
	}
	.sq.capture::after {
		content: '';
		position: absolute;
		inset: 6%;
		border-radius: 50%;
		border: 5px solid rgba(20, 30, 20, 0.35);
	}
	.pc {
		font-size: 78cqh;
		line-height: 1;
		font-family: 'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Arial Unicode MS', serif;
		/* Solid pieces with an outline in the other side's colour, so both sides read clearly on
		   every theme (white pieces on light squares included). */
		color: #1b1b1f;
		-webkit-text-stroke: 0.08em rgba(255, 255, 255, 0.9);
		paint-order: stroke fill;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.35);
		user-select: none;
	}
	.pc.white {
		color: #fff;
		-webkit-text-stroke: 0.09em #1b1b1f;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.45);
	}
	.theme-ocean .pc {
		color: #0d2a4a;
		-webkit-text-stroke-color: #eaf3fb;
	}
	.theme-ocean .pc.white {
		color: #fffaf0;
		-webkit-text-stroke-color: #0d2a4a;
	}
	.theme-marble .pc {
		color: #25282e;
		-webkit-text-stroke-color: #fbfaf7;
	}
	.theme-marble .pc.white {
		color: #fffdf8;
		-webkit-text-stroke-color: #25282e;
	}
	/* Neon: a bright side and a dark side, each outlined in its glow. */
	.theme-neon .pc {
		color: #3b0a45;
		-webkit-text-stroke: 0.08em #ff4fd8;
		text-shadow: 0 0 8px rgba(255, 79, 216, 0.85);
	}
	.theme-neon .pc.white {
		color: #e8fdff;
		-webkit-text-stroke: 0.08em #00c8ff;
		text-shadow: 0 0 8px rgba(94, 241, 255, 0.85);
	}
	.rank,
	.file {
		position: absolute;
		font: 700 11px system-ui, sans-serif;
		font-style: normal;
		opacity: 0.6;
		color: var(--dark);
	}
	.dark .rank,
	.dark .file {
		color: var(--light);
	}
	.rank {
		top: 3px;
		left: 4px;
	}
	.file {
		bottom: 2px;
		right: 4px;
	}
	.promo {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		background: rgba(4, 6, 14, 0.7);
	}
	.promo p {
		margin: 0;
		font-weight: 700;
		color: #fff;
	}
	.promo div {
		display: flex;
		gap: 8px;
	}
	.promo div button {
		width: 64px;
		height: 64px;
		border-radius: 10px;
		border: 1px solid #e0b46b;
		background: rgba(255, 255, 255, 0.12);
		cursor: pointer;
		container-type: size;
	}
	.promo .cancel {
		padding: 6px 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		background: transparent;
		color: #fff;
		cursor: pointer;
	}
</style>
