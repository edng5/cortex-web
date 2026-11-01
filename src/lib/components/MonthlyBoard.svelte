<!--
  E.Ngine Games leaders: this month's top score on every game's boards (a game nobody has played
  this month shows its most recent month with scores), or switched to all-time. Nothing at all
  shows "-". Click a game to see each of its boards' top 3.
-->
<script lang="ts">
	import { GAMES } from '$lib/games/registry';
	import { boardPeriod } from '$lib/games/board-period.svelte';
	import BoardToggle from './BoardToggle.svelte';

	type Entry = { name: string; score: number } | null;
	type Monthly = {
		period?: 'month' | 'all';
		month: string;
		games: Partial<Record<string, { month: string | null; boards: Record<number, Entry>; top?: Record<number, NonNullable<Entry>[]> }>>;
	};

	/** The games opened up to show their top 3. */
	let open = $state<string[]>([]);
	const toggle = (id: string) => (open = open.includes(id) ? open.filter((x) => x !== id) : [...open, id]);

	let data = $state<Monthly | null>(null);
	let failed = $state(false);

	$effect(() => {
		const period = boardPeriod.value;
		let gone = false;
		data = null;
		failed = false;
		fetch(`/api/games/monthly?period=${period}`)
			.then(async (res) => {
				if (gone) return;
				if (res.ok) data = (await res.json()) as Monthly;
				else failed = true;
			})
			.catch(() => !gone && (failed = true));
		return () => (gone = true);
	});
	const allTime = $derived(boardPeriod.value === 'all');

	const monthName = (m: string) => {
		const [y, mo] = m.split('-').map(Number);
		return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
	};
</script>

<aside class="monthly" aria-label={allTime ? 'All-time leaderboard' : 'Monthly leaderboard'}>
	<header>
		<h3>{allTime ? 'All-time leaders' : 'Monthly leaders'}</h3>
		<span class="month">{allTime ? '' : data ? monthName(data.month) : ' '}</span>
	</header>
	<BoardToggle />
	{#each GAMES.filter((g) => Object.keys(g.boards).length) as g (g.id)}
		{@const row = data?.games[g.id]}
		{@const isOpen = open.includes(g.id)}
		<section style="--accent: {g.accent}">
			<h4>
				<button class="game" aria-expanded={isOpen} onclick={() => toggle(g.id)} title={isOpen ? 'Show just the leader' : 'Show the top 3'}>
					<img src={g.icon} alt="" width="20" height="20" />{g.title}
					<span class="chev" class:up={isOpen} aria-hidden="true">▾</span>
				</button>
				{#if !allTime && row?.month && data && row.month !== data.month}<span class="from">from {monthName(row.month)}</span>{/if}
			</h4>
			<dl>
				{#each Object.entries(g.boards) as [b, label] (b)}
					{@const e = row?.boards[Number(b)] ?? null}
					{@const top = row?.top?.[Number(b)] ?? (e ? [e] : [])}
					{#if isOpen}
						{#if Object.keys(g.boards).length > 1}<dt class="board">{label}</dt>{/if}
						{#each [0, 1, 2] as i (i)}
							{@const t = top[i]}
							<div class="line top">
								<dt class="rank">{['🥇', '🥈', '🥉'][i]}</dt>
								<dd class="who">{t ? t.name : data || failed ? '-' : '…'}</dd>
								<dd class="score">{t ? t.score.toLocaleString() : ''}</dd>
							</div>
						{/each}
					{:else}
						<div class="line">
							{#if Object.keys(g.boards).length > 1}<dt>{label}</dt>{/if}
							<dd class="who">{e ? e.name : data || failed ? '-' : '…'}</dd>
							<dd class="score">{e ? e.score.toLocaleString() : data || failed ? '-' : ''}</dd>
						</div>
					{/if}
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
	.game {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.game:hover {
		filter: brightness(1.2);
	}
	.chev {
		font-size: 0.7rem;
		color: var(--muted, #94a3b8);
		transition: transform 0.15s;
	}
	.chev.up {
		transform: rotate(180deg);
	}
	dt.board {
		margin-top: 4px;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	dt.rank {
		min-width: 0;
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
