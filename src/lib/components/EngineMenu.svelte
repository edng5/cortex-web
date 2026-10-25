<!--
  E.Ngine Games main menu: a stack of game buttons with a preview of the one you point at, the
  monthly leaderboard beside it, and where players log in for the global leaderboards and choose
  the name shown on them. Used on the left of the Mini Games node (desktop) and in the games pop-up.
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
	<p class="tag">Edward's high-school Java games, rebuilt to play in your browser.</p>
</header>
<div class="cols">
<div class="menu">

	<div class="picker">
		<ul class="stack">
			{#each GAMES as g (g.id)}
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
	</div>

	<div class="board">
		{#if !session.user}
			<p><strong>Global leaderboards:</strong> log in to save your high scores and compete with other players.</p>
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
</div>
<MonthlyBoard />
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
	.tag {
		margin: -4px 0 4px;
		color: var(--muted, #94a3b8);
		font-size: 0.9rem;
		text-align: center;
	}
	.picker {
		width: 100%;
		display: grid;
		gap: 12px;
	}
	@container (min-width: 500px) {
		.picker {
			grid-template-columns: 230px minmax(0, 1fr);
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
		width: 100%;
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
