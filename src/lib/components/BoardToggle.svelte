<!-- The Monthly / All-time switch for the E.Ngine Games leaderboards. -->
<script lang="ts">
	import { boardPeriod } from '$lib/games/board-period.svelte';
</script>

<div class="toggle" role="group" aria-label="Leaderboard">
	<button class:on={boardPeriod.value === 'month'} aria-pressed={boardPeriod.value === 'month'} onclick={() => boardPeriod.set('month')}>Monthly</button>
	<button class:on={boardPeriod.value === 'all'} aria-pressed={boardPeriod.value === 'all'} onclick={() => boardPeriod.set('all')}>All-time</button>
</div>

<style>
	.toggle {
		display: inline-flex;
		padding: 2px;
		border-radius: 999px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		background: rgba(15, 23, 42, 0.6);
	}
	button {
		padding: 3px 10px;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--muted, #94a3b8);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
	}
	button:hover {
		color: #e2e8f0;
	}
	button.on {
		background: rgba(129, 140, 248, 0.3);
		color: #e0e7ff;
	}
</style>
