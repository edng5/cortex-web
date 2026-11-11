<!--
  Chess, online against another player (room codes; see Online.svelte). The board itself is in
  ChessBoard.svelte; the server checks every move.
-->
<script lang="ts">
	import type { GameUiProps } from '$lib/games/registry';
	import Online, { type BoardContext, type Theme } from '$lib/games/online/Online.svelte';
	import ChessBoard from './ChessBoard.svelte';

	let { onquit, loggedIn }: GameUiProps = $props();

	const THEMES: Theme[] = [
		{ id: 'wood', name: 'Wood', swatch: ['#f0d9b5', '#b58863'] },
		{ id: 'ocean', name: 'Ocean', swatch: ['#dbe9f4', '#5b8db8'] },
		{ id: 'neon', name: 'Neon', swatch: ['#2c2f4a', '#161829'] },
		{ id: 'marble', name: 'Marble', swatch: ['#ece9e4', '#8f949c'] }
	];

	function describe(winner: number | null, reason: string, you: number): string {
		if (winner == null) {
			const draws: Record<string, string> = {
				stalemate: 'Draw by stalemate',
				fifty: 'Draw: 50 moves without progress',
				repetition: 'Draw by repetition',
				material: 'Draw: not enough pieces to mate',
				agreed: 'Draw agreed'
			};
			return draws[reason] ?? 'Draw';
		}
		const won = winner == you;
		if (reason == 'checkmate') return won ? 'Checkmate! You win' : 'Checkmate. You lose';
		if (reason == 'resign') return won ? 'Your opponent resigned. You win' : 'You resigned';
		if (reason == 'abandoned') return won ? 'Your opponent left. You win' : 'You left the game';
		return won ? 'You win' : 'You lose';
	}
</script>

<Online game="chess" title="Chess" accent="#e0b46b" {loggedIn} {onquit} themes={THEMES} saveKey="chess-save" {describe}>
	{#snippet board(ctx: BoardContext)}
		<ChessBoard {ctx} />
	{/snippet}
</Online>
