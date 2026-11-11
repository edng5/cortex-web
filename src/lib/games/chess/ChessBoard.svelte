<!--
  The chess board: pick one of your pieces to see where it can go, then pick a square. Shows the
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
	async function send(m: Move) {
		promo = null;
		picked = null;
		await ctx.send({ type: 'move', move: m });
	}
</script>

<p class="turn" class:mine={myTurn}>
	{#if v.phase != 'playing'}&nbsp;{:else if myTurn}{c.check ? 'Check! ' : ''}Your move ({mine == 'w' ? 'White' : 'Black'}){:else}{c.check ? 'Check! ' : ''}Waiting for your opponent…{/if}
</p>
<div class="chess theme-{ctx.theme}">
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
			aria-label={squareName(sq) + (p != '.' ? ' ' + p : '')}
			onclick={() => tap(sq)}
		>
			{#if p != '.'}<span class="pc" class:white={p == p.toUpperCase()}>{GLYPH[p.toLowerCase()]}&#xFE0E;</span>{/if}
			{#if (sq & 7) == (flip ? 7 : 0)}<i class="rank">{8 - (sq >> 3)}</i>{/if}
			{#if sq >> 3 == (flip ? 0 : 7)}<i class="file">{'abcdefgh'[sq & 7]}</i>{/if}
		</button>
	{/each}
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
		color: #1b1b1f;
		text-shadow:
			0 0 2px rgba(255, 255, 255, 0.9),
			0 2px 3px rgba(0, 0, 0, 0.35);
		user-select: none;
	}
	.pc.white {
		color: #fbfbfb;
		text-shadow:
			0 0 2px #000,
			0 0 1px #000,
			0 2px 3px rgba(0, 0, 0, 0.5);
	}
	.theme-neon .pc {
		color: #ff4fd8;
		text-shadow: 0 0 8px rgba(255, 79, 216, 0.8);
	}
	.theme-neon .pc.white {
		color: #5ef1ff;
		text-shadow: 0 0 8px rgba(94, 241, 255, 0.8);
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
