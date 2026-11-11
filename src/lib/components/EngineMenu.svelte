<!--
  E.Ngine Games main menu: a stack of game buttons with a preview of the one you point at, a row
  under both for FishMart and the online games, the monthly leaderboard beside it, and (under the
  logo) where players log in for the leaderboards and online play, and choose the name shown. Used on the left of the E.Ngine Games node (desktop) and in the games pop-up.
-->
<script lang="ts">
	import { GAMES, type GameId } from '$lib/games/registry';
	import { session } from '$lib/session.svelte';
	import MonthlyBoard from './MonthlyBoard.svelte';

	let { onpick, onlogin }: { onpick: (id: GameId) => void; onlogin: () => void } = $props();

	/** The game previewed (pointed at or focused). */
	let shown = $state<GameId>(GAMES[0].id);
	const preview = $derived(GAMES.find((g) => g.id === shown)!);

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let message = $state('');

	$effect(() => {
		if (session.user && session.playerName === undefined) session.loadPlayerName();
	});

	function edit() {
		draft = session.playerName ?? '';
		message = '';
		editing = true;
	}
	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		const r = await session.savePlayerName(draft);
		saving = false;
		if (r.ok) {
			editing = false;
			message = '';
		} else message = r.message ?? 'Could not save that name.';
	}
	const askName = $derived(!!session.user && (editing || session.playerName === null));
</script>

<div class="engine">
<header class="head">
	<img class="logo" src="/games/engine-logo.svg" alt="E.Ngine Games" width="520" height="170" />
	<div class="board">
		{#if !session.user}
			<p><strong>Log in</strong> to save your high scores on the global leaderboards and to play multiplayer games.</p>
			<button class="login" onclick={onlogin}>Log in</button>
		{:else if askName}
			<form onsubmit={save}>
				<label for="player-name">Choose your nickname for the global leaderboards</label>
				<div class="row">
					<input
						id="player-name"
						bind:value={draft}
						maxlength="16"
						minlength="3"
						autocomplete="nickname"
						placeholder="3–16 letters or numbers"
						spellcheck="false"
					/>
					<button type="submit" disabled={saving || draft.trim().length < 3}>{saving ? 'Saving…' : 'Save'}</button>
					{#if session.playerName && editing}
						<button type="button" class="ghost" onclick={() => (editing = false)}>Cancel</button>
					{/if}
				</div>
				{#if message}<p class="err" role="alert">{message}</p>{:else}<p class="hint">Keep it friendly: offensive nicknames are rejected. Until you choose one, your email shows partly hidden. You can change it any time from your account menu.</p>{/if}
			</form>
		{:else if session.playerName}
			<p>Your scores go on the global leaderboards as <strong>{session.playerName}</strong>. <button class="link" onclick={edit}>Change nickname</button></p>
		{:else}
			<p class="hint">Loading your leaderboard name…</p>
		{/if}
	</div>
</header>
<div class="cols">
<div class="menu">

	<div class="picker">
		<ul class="stack">
			{#each GAMES.filter((g) => !g.row) as g (g.id)}
				<li>
					<button
						class="game"
						class:on={shown === g.id}
						style="--accent: {g.accent}"
						onpointerenter={() => (shown = g.id)}
						onfocus={() => (shown = g.id)}
						onclick={() => onpick(g.id)}
					>
						<img src={g.icon} alt="" width="44" height="44" />
						<span class="text">
							<span class="title">{g.title}</span>
							<span class="line">{g.tagline}</span>
						</span>
						<span class="go" aria-hidden="true">▶</span>
					</button>
				</li>
			{/each}
		</ul>
		<div class="preview" style="--accent: {preview.accent}">
			{#key preview.id}
				<img src={preview.preview} alt="{preview.title} gameplay" width="480" height="360" />
			{/key}
			<p class="blurb"><strong>{preview.title}.</strong> {preview.blurb}</p>
			<button class="play" onclick={() => onpick(preview.id)}>Play {preview.title}</button>
		</div>
		{#each [1, 2] as r (r)}
			<ul class="row-games">
				{#each GAMES.filter((g) => g.row == r) as g (g.id)}
					<li>
						<button
							class="game"
							class:on={shown === g.id}
							style="--accent: {g.accent}"
							onpointerenter={() => (shown = g.id)}
							onfocus={() => (shown = g.id)}
							onclick={() => onpick(g.id)}
						>
							<img src={g.icon} alt="" width="44" height="44" />
							<span class="text">
								<span class="title">{g.title}</span>
								<span class="line">{g.tagline}</span>
							</span>
						</button>
					</li>
				{/each}
				{#if r == 2}
					<!-- Placeholders for the next games. -->
					{#each [1, 2] as n (n)}
						<li>
							<div class="game soon" aria-label="Coming soon">
								<span class="mystery" aria-hidden="true">?</span>
								<span class="text">
									<span class="title">Coming soon</span>
									<span class="line">A new game is on the way</span>
								</span>
							</div>
						</li>
					{/each}
				{/if}
			</ul>
		{/each}
	</div>

</div>
<div class="side"><MonthlyBoard /></div>
</div></div>

<style>
	/* Menu and monthly leaderboard side by side when there's room, else stacked. */
	.engine {
		container-type: inline-size;
		width: 100%;
		color: var(--text, #e2e8f0);
	}
	.cols {
		display: grid;
		gap: 14px;
		align-items: start;
	}
	@container (min-width: 800px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 250px;
			align-items: stretch;
		}
		/* The leaderboard is as tall as the menu beside it, and scrolls inside. */
		.side {
			position: relative;
		}
		.side > :global(.monthly) {
			position: absolute;
			inset: 0;
			overflow-y: auto;
			scrollbar-gutter: stable;
		}
		/* A slim glowing scrollbar to match the board. */
		.side > :global(.monthly::-webkit-scrollbar) {
			width: 8px;
		}
		.side > :global(.monthly::-webkit-scrollbar-track) {
			margin: 14px 0;
			border-radius: 8px;
			background: rgba(129, 140, 248, 0.08);
		}
		.side > :global(.monthly::-webkit-scrollbar-thumb) {
			border-radius: 8px;
			border: 2px solid transparent;
			background: linear-gradient(#22d3ee, #818cf8, #c084fc) padding-box;
			box-shadow: 0 0 6px rgba(129, 140, 248, 0.6);
		}
		.side > :global(.monthly::-webkit-scrollbar-thumb:hover) {
			border-width: 1px;
		}
		.side > :global(.monthly::-webkit-scrollbar-button) {
			display: none;
		}
		@supports not selector(::-webkit-scrollbar) {
			.side > :global(.monthly) {
				scrollbar-width: thin;
				scrollbar-color: #818cf8 rgba(129, 140, 248, 0.08);
			}
		}
	}
	.head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}
	.menu {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		min-width: 0;
		container-type: inline-size;
	}
	.logo {
		width: min(100%, 380px);
		height: auto;
		display: block;
	}
	.picker {
		width: 100%;
		display: grid;
		gap: 12px;
	}
	@container (min-width: 500px) {
		.picker {
			/* Three equal columns: the list takes one, the preview two, and the rows below
			   line up with them. */
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.stack {
			justify-content: space-between;
		}
		.preview {
			grid-column: span 2;
		}
		.row-games {
			grid-template-columns: subgrid;
		}
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.game {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 10px 7px 7px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		background: linear-gradient(100deg, color-mix(in srgb, var(--accent) 16%, rgba(10, 14, 26, 0.92)), rgba(10, 14, 26, 0.92) 70%);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.game img {
		flex: none;
		border-radius: 9px;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
		image-rendering: pixelated;
	}
	.game .text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.game .title {
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-size: 0.82rem;
		color: var(--accent);
	}
	.game .line {
		font-size: 0.74rem;
		color: var(--muted, #94a3b8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.game .go {
		font-size: 0.7rem;
		color: var(--accent);
		opacity: 0;
		transform: translateX(-4px);
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}
	.game.on,
	.game:focus-visible {
		outline: none;
		transform: translateX(4px);
		border-color: var(--accent);
		box-shadow:
			0 10px 28px -14px color-mix(in srgb, var(--accent) 80%, transparent),
			inset 3px 0 0 var(--accent);
	}
	.game.on .go,
	.game:focus-visible .go {
		opacity: 1;
		transform: none;
	}
	/* FishMart and the online games: a row under the list and the preview. */
	.row-games {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 8px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.game.soon {
		--accent: #64748b;
		cursor: default;
		border-style: dashed;
		opacity: 0.75;
	}
	.mystery {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 9px;
		border: 1px dashed rgba(148, 163, 184, 0.6);
		color: #94a3b8;
		font: 800 1.3rem/1 system-ui, sans-serif;
	}
	.row-games .game.on,
	.row-games .game:focus-visible {
		transform: translateY(-2px);
		box-shadow:
			0 10px 28px -14px color-mix(in srgb, var(--accent) 80%, transparent),
			inset 0 -3px 0 var(--accent);
	}
	.preview {
		display: none;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: rgba(10, 14, 26, 0.9);
		box-shadow: 0 16px 40px -18px color-mix(in srgb, var(--accent) 70%, transparent);
	}
	@container (min-width: 500px) {
		.preview {
			display: flex;
		}
	}
	.preview img {
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 8px;
		background: #000;
		animation: fade 0.2s ease-out;
	}
	.preview .blurb {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.4;
		color: var(--muted, #94a3b8);
	}
	.preview .blurb strong {
		color: var(--accent);
	}
	.play {
		align-self: flex-start;
		padding: 7px 14px;
		border-radius: 9px;
		border: none;
		background: var(--accent);
		color: #05070d;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}
	.play:hover {
		filter: brightness(1.1);
	}
	@keyframes fade {
		from {
			opacity: 0.3;
		}
	}
	.board {
		width: min(100%, 720px);
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		background: rgba(10, 14, 26, 0.85);
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.board p {
		margin: 0;
		flex: 1 1 260px;
	}
	.board form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.board label {
		font-weight: 600;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: inherit;
	}
	input:focus {
		outline: none;
		border-color: #818cf8;
	}
	.board button:not(.link) {
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: #6366f1;
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.board button:not(.link):hover:not(:disabled) {
		background: #4f46e5;
	}
	.board button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.board button.ghost {
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: #a5b4fc;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.hint {
		color: var(--muted, #94a3b8);
		font-size: 0.8rem;
	}
	.err {
		color: #fca5a5;
		font-size: 0.85rem;
	}
</style>
