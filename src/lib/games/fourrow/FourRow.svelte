<!--
  Four in a Row, online against another player (room codes; see Online.svelte). The server checks
  every move; the board is in FourBoard.svelte.
-->
<script lang="ts">
	import type { GameUiProps } from '$lib/games/registry';
	import Online, { type BoardContext, type Theme } from '$lib/games/online/Online.svelte';
	import FourBoard from './FourBoard.svelte';

	let { onquit, loggedIn }: GameUiProps = $props();

	const THEMES: Theme[] = [
		{ id: 'classic', name: 'Classic', swatch: ['#1d4ed8', '#ef4444', '#facc15'] },
		{ id: 'night', name: 'Night', swatch: ['#111827', '#22d3ee', '#f472b6'] },
		{ id: 'candy', name: 'Candy', swatch: ['#f9a8d4', '#8b5cf6', '#34d399'] }
	];

	function describe(winner: number | null, reason: string, you: number): string {
		if (winner == null) return 'Draw: the board is full';
		const won = winner == you;
		if (reason == 'four') return won ? 'Four in a row! You win' : 'They got four in a row. You lose';
		if (reason == 'resign') return won ? 'Your opponent resigned. You win' : 'You resigned';
		if (reason == 'abandoned') return won ? 'Your opponent left. You win' : 'You left the game';
		return won ? 'You win' : 'You lose';
	}
</script>

<Online game="fourrow" title="Four in a Row" accent="#facc15" {loggedIn} {onquit} themes={THEMES} saveKey="fourrow-save" {describe}>
	{#snippet board(ctx: BoardContext)}
		<FourBoard {ctx} />
	{/snippet}
</Online>
