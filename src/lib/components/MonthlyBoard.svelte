<!--
  E.Ngine Games monthly leaders: this month's top score on every game's boards. A game nobody
  has played this month shows its most recent month with scores; nothing at all shows "-".
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { GAMES } from '$lib/games/registry';

	type Entry = { name: string; score: number } | null;
	type Monthly = { month: string; games: Partial<Record<string, { month: string | null; boards: Record<number, Entry> }>> };

	let data = $state<Monthly | null>(null);
	let failed = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/api/games/monthly');
			if (res.ok) data = (await res.json()) as Monthly;
			else failed = true;
		} catch {
			failed = true;
		}
	});

	const monthName = (m: string) => {
		const [y, mo] = m.split('-').map(Number);
		return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
	};
</script>

<aside class="monthly" aria-label="Monthly leaderboard">
	<header>
		<h3>Monthly leaders</h3>
		<span class="month">{data ? monthName(data.month) : ' '}</span>
	</header>
	{#each GAMES as g (g.id)}
		{@const row = data?.games[g.id]}
		<section style="--accent: {g.accent}">
			<h4>
				<img src={g.icon} alt="" width="20" height="20" />{g.title}
				{#if row?.month && data && row.month !== data.month}<span class="from">from {monthName(row.month)}</span>{/if}
			</h4>
			<dl>
				{#each Object.entries(g.boards) as [b, label] (b)}
					{@const e = row?.boards[Number(b)] ?? null}
					<div class="line">
						{#if Object.keys(g.boards).length > 1}<dt>{label}</dt>{/if}
						<dd class="who">{e ? e.name : data || failed ? '-' : '…'}</dd>
						<dd class="score">{e ? e.score.toLocaleString() : data || failed ? '-' : ''}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</aside>

<style>
	.monthly {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 14px 12px;
		border-radius: 14px;
		border: 1px solid rgba(129, 140, 248, 0.28);
		/* See-through: the graph shows behind it. */
		background: rgba(10, 14, 26, 0.55);
		backdrop-filter: blur(3px);
		color: var(--text, #e2e8f0);
		font-size: 0.8rem;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font-size: 0.82rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #c7d2fe;
	}
	.month {
		color: var(--muted, #94a3b8);
		font-size: 0.75rem;
	}
	section {
		padding-top: 8px;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}
	h4 {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 4px;
		font-size: 0.8rem;
		color: var(--accent);
	}
	h4 img {
		border-radius: 4px;
	}
	.from {
		color: var(--muted, #94a3b8);
		font-weight: 400;
		font-size: 0.7rem;
	}
	dl {
		margin: 0;
	}
	.line {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 8px;
		padding: 1px 0;
	}
	dt {
		color: var(--muted, #94a3b8);
		min-width: 72px;
	}
	.line:not(:has(dt)) .who {
		grid-column: 1 / 3;
	}
	dd {
		margin: 0;
	}
	.who {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.score {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		text-align: right;
	}
</style>
