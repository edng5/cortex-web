<!--
  E.Ngine Games leaders: this month's top score on every game's boards (a game nobody has played
  this month shows its most recent month with scores), or switched to all-time. Nothing at all
  shows "-". Click a game (its title or its scores) for a pop-up of each board's top 3.
-->
<script lang="ts">
	import { GAMES } from '$lib/games/registry';
	import { boardPeriod } from '$lib/games/board-period.svelte';
	import BoardToggle from './BoardToggle.svelte';
	import Modal from './Modal.svelte';
	import { portal } from '$lib/actions/portal';

	type Entry = { name: string; score: number } | null;
	type Monthly = {
		period?: 'month' | 'all';
		month: string;
		games: Partial<Record<string, { month: string | null; boards: Record<number, Entry>; top?: Record<number, NonNullable<Entry>[]> }>>;
	};

	/** The game whose top 3 is showing in the pop-up. */
	let open = $state<string | null>(null);
	const openGame = $derived(GAMES.find((g) => g.id === open) ?? null);

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
		<h3><span>{allTime ? 'All-time' : 'Monthly'}</span><span>leaders</span></h3>
		<span class="month">{allTime ? '' : data ? monthName(data.month) : ' '}</span>
	</header>
	<BoardToggle />
	{#each GAMES.filter((g) => Object.keys(g.boards).length) as g (g.id)}
		{@const row = data?.games[g.id]}
		<button class="game" style="--accent: {g.accent}" onclick={() => (open = g.id)} title="See the top 3 for {g.title}">
			<h4>
				<img src={g.icon} alt="" width="20" height="20" />{g.title}
				{#if !allTime && row?.month && data && row.month !== data.month}<span class="from">from {monthName(row.month)}</span>{/if}
				<span class="more" aria-hidden="true">Top 3 ›</span>
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
		</button>
	{/each}
</aside>

{#if openGame}
	{@const g = openGame}
	{@const row = data?.games[g.id]}
	<div use:portal>
		<!-- Above the E.Ngine Games window (80), where this board also shows; below the lightbox (100). -->
		<Modal title="{g.title} leaders" width="420px" z={90} onclose={() => (open = null)}>
			<div class="pop" style="--accent: {g.accent}">
				<div class="pophead">
					<img src={g.icon} alt="" width="40" height="40" />
					<span>{allTime ? 'All-time' : row?.month ? monthName(row.month) : data ? monthName(data.month) : ''}</span>
					<BoardToggle />
				</div>
				{#each Object.entries(g.boards) as [b, label] (b)}
					{@const top = row?.top?.[Number(b)] ?? []}
					<section>
						{#if Object.keys(g.boards).length > 1}<h4>{label}</h4>{/if}
						<ol>
							{#each [0, 1, 2] as i (i)}
								{@const t = top[i]}
								<li class:empty={!t}>
									<span class="medal">{['🥇', '🥈', '🥉'][i]}</span>
									<span class="who">{t ? t.name : data || failed ? 'No one yet' : '…'}</span>
									<span class="score">{t ? t.score.toLocaleString() : ''}</span>
								</li>
							{/each}
						</ol>
					</section>
				{/each}
			</div>
		</Modal>
	</div>
{/if}

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
	/* Always two lines, so switching Monthly / All-time doesn't change the height. */
	h3 span {
		display: block;
	}
	.month {
		color: var(--muted, #94a3b8);
		font-size: 0.75rem;
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
	/* The whole game (title and scores) opens its top 3. */
	.game {
		display: block;
		width: 100%;
		padding: 8px 6px 4px;
		margin: 0 -6px;
		box-sizing: content-box;
		border: none;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.game:hover,
	.game:focus-visible {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.more {
		margin-left: auto;
		color: var(--muted, #94a3b8);
		font-weight: 400;
		font-size: 0.68rem;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.game:hover .more,
	.game:focus-visible .more {
		opacity: 1;
	}
	.pop {
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: var(--text, #e2e8f0);
	}
	.pophead {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		color: var(--muted, #94a3b8);
	}
	.pophead img {
		border-radius: 8px;
	}
	.pophead span {
		flex: 1;
	}
	.pop h4 {
		margin: 0 0 6px;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	li {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
	}
	li:first-child {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	li.empty {
		color: var(--muted, #94a3b8);
	}
	.medal {
		font-size: 1.1rem;
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
