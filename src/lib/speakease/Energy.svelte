<!-- Energy for the games (Phrase Quest, scenarios): a chip for the header, or (`out`) the panel shown
     when it's run out, counting down to when it fills back up (tomorrow). -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { ENERGY_MAX, countdown, game } from './game.svelte';

	/** `unlimited`: a member in Phrase Quest (no energy used): the chip shows ∞. */
	let { out = false, onhome, unlimited = false }: { out?: boolean; onhome?: () => void; unlimited?: boolean } = $props();

	// The countdown ticks every second while it's showing.
	$effect(() => {
		if (!out) return;
		const t = setInterval(() => game.tick(), 1000);
		return () => clearInterval(t);
	});
</script>

{#if out}
	<div class="out" role="status">
		<span class="bolt"><Icon name="bolt" size={30} color="#fff" /></span>
		<b>Out of energy</b>
		<p>It fills back up tomorrow, in</p>
		<span class="count" aria-label="Time until energy refills">{countdown(game.nextEnergyIn)}</span>
		<p>Finishing a daily goal gives you 5 now, and levelling up in Phrase Quest fills it up.</p>
		<p class="muted">Chats with your friends are free: keep talking while you wait.</p>
		{#if onhome}<button class="btn" onclick={onhome}>Back to friends</button>{/if}
	</div>
{:else if unlimited}
	<span class="chip" title="Unlimited energy: members’ tries in Phrase Quest are free.">
		<Icon name="bolt" size={16} />∞
	</span>
{:else}
	<span class="chip" class:low={game.energy <= 3} title="Energy: {game.energy} of {ENERGY_MAX}. Each try uses 1; it fills back up each day.">
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
	.count {
		font-size: 32px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		color: #ea580c;
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
