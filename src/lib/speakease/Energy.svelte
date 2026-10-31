<!-- Energy for the games (Phrase Quest, scenarios): a chip for the header, or (`out`) the panel shown
     when it's run out, with when the next point arrives. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { ENERGY_MAX, game } from './game.svelte';

	let { out = false, onhome }: { out?: boolean; onhome?: () => void } = $props();
	const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
</script>

{#if out}
	<div class="out" role="status">
		<span class="bolt"><Icon name="bolt" size={30} color="#fff" /></span>
		<b>Out of energy</b>
		<p>Your next bolt arrives in <b>{mmss(game.nextEnergyIn)}</b>. Finishing a daily goal gives you 5, and levelling up in Phrase Quest fills it up.</p>
		<p class="muted">Chats with your friends are free: keep talking while you wait.</p>
		{#if onhome}<button class="btn" onclick={onhome}>Back to friends</button>{/if}
	</div>
{:else}
	<span class="chip" class:low={game.energy <= 3} title="Energy: {game.energy} of {ENERGY_MAX}. Each try uses 1; it refills over time.">
		<Icon name="bolt" size={16} />{game.energy}
	</span>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 5px 10px 5px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, #eab308 18%, var(--se-surface-2));
		color: #ca8a04;
		font-weight: 750;
		font-size: 14px;
	}
	.chip.low {
		background: color-mix(in srgb, #ef4444 18%, var(--se-surface-2));
		color: #ef4444;
	}
	.out {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin: 14px 0;
		padding: 20px;
		border-radius: 20px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		text-align: center;
	}
	.out p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
	}
	.muted {
		color: var(--se-muted);
	}
	.bolt {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: linear-gradient(135deg, #facc15, #f97316);
		box-shadow: 0 10px 24px -10px rgba(249, 115, 22, 0.8);
	}
</style>
