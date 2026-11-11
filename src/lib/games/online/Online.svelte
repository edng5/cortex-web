<!--
  The online shell for E.Ngine Games' room-code games (Chess, Four in a Row): log in, see your
  rating (MMR) and record, pick a theme, create a room (and share its code) or join one, then play
  with the game's own board inside. Results update the ratings on the server; they're private to
  each player, not on the public leaderboards.
-->
<script lang="ts" module>
	export interface Theme {
		id: string;
		name: string;
		/** Colours for the theme chip. */
		swatch: string[];
	}
	export interface RoomView {
		code: string;
		you: number;
		phase: 'waiting' | 'playing' | 'over';
		round: number;
		first: number;
		players: ({ seat: number; name: string; mmr: number; online: boolean } | null)[];
		chess?: { board: string[]; turn: 'w' | 'b'; castling: string; ep: number; check: boolean };
		four?: import('$lib/games/fourrow/rules').FourState;
		lastMove?: Record<string, unknown>;
		drawOffer: number;
	}
	export interface BoardContext {
		view: RoomView;
		send: (msg: Record<string, unknown>) => Promise<boolean>;
		theme: string;
		sound: (name: string) => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Room, myRating, type Rating, type RoomEvent } from '$lib/games/net';
	import { gameAudio } from '$lib/games/audio.svelte';
	import { session } from '$lib/session.svelte';
	import { untrack } from 'svelte';

	let {
		game,
		title,
		accent,
		loggedIn,
		onquit,
		themes,
		saveKey,
		board,
		describe
	}: {
		game: 'chess' | 'fourrow';
		title: string;
		accent: string;
		loggedIn: boolean;
		onquit: () => void;
		themes: Theme[];
		saveKey: string;
		board: Snippet<[BoardContext]>;
		/** The result in words, from the winner (seat or null) and the reason. */
		describe: (winner: number | null, reason: string, you: number) => string;
	} = $props();

	// ── Theme (kept in the game's save, so it follows the account) ──
	let theme = $state(
		untrack(() => {
			try {
				const s = JSON.parse(localStorage.getItem(saveKey) ?? '{}');
				if (themes.some((t) => t.id == s.theme)) return s.theme as string;
			} catch {
				/* no save yet */
			}
			return themes[0].id;
		})
	);
	function pickTheme(id: string) {
		theme = id;
		try {
			localStorage.setItem(saveKey, JSON.stringify({ theme: id, savedAt: Date.now() }));
		} catch {
			/* storage blocked */
		}
		sound('select');
	}

	const sound = (name: string) => gameAudio.play(game, name);

	// ── Rating ──
	let rating = $state<Rating | null>(null);
	async function loadRating() {
		rating = loggedIn ? await myRating(game) : null;
	}
	$effect(() => {
		if (loggedIn) loadRating();
	});

	// ── Room ──
	let room: Room | null = null;
	let view = $state<RoomView | null>(null);
	let end = $state<{ winner: number | null; reason: string; ratings: { mmr: number; delta: number }[] } | null>(null);
	let theyWantRematch = $state(false);
	let iWantRematch = $state(false);
	let notice = $state('');
	let error = $state('');
	let busy = $state(false);
	let joinCode = $state('');
	let confirmResign = $state(false);

	function onEvent(e: RoomEvent) {
		if (e.t == 'room') {
			const next = e as unknown as RoomView;
			if (view?.phase == 'waiting' && next.phase == 'playing') sound('start');
			if (next.round != view?.round) {
				end = null;
				theyWantRematch = false;
				iWantRematch = false;
			}
			view = next;
		} else if (e.t == 'end') {
			end = e as unknown as typeof end;
			const you = view?.you ?? 0;
			sound(end!.winner == null ? 'draw' : end!.winner == you ? 'win' : 'lose');
			loadRating();
		} else if (e.t == 'rematch') {
			if (e.seat != view?.you) theyWantRematch = true;
		} else if (e.t == 'left') {
			notice = 'Your opponent left the room.';
		} else if (e.t == 'closed') {
			if (view) notice ||= 'The room was closed.';
			room = null;
			view = null;
		} else if (e.t == 'presence' && view) {
			const p = view.players[e.seat as number];
			if (p) p.online = !!e.online;
		}
	}

	async function create() {
		error = '';
		busy = true;
		const r = await Room.create(game);
		busy = false;
		if ('error' in r) return (error = r.error);
		open(r.code);
	}
	async function join(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const code = joinCode.replace(/\D/g, '');
		busy = true;
		const r = await Room.join(code, game);
		busy = false;
		if ('error' in r) return (error = r.error);
		open(code);
	}
	function open(code: string) {
		notice = '';
		end = null;
		room = new Room(code, onEvent);
		room.listen();
		sound('confirm');
	}
	function leave() {
		room?.leave();
		room = null;
		view = null;
		end = null;
		confirmResign = false;
	}
	async function send(msg: Record<string, unknown>) {
		if (!room) return false;
		const r = await room.send(msg);
		if (!r.ok) {
			error = r.message;
			setTimeout(() => (error = ''), 3000);
		}
		return r.ok;
	}
	function rematch() {
		iWantRematch = true;
		void send({ type: 'rematch' });
	}

	// Leaving the game (closing it) leaves the room too.
	$effect(() => () => room?.leave());

	const me = $derived(view ? view.players[view.you] : null);
	const them = $derived(view ? view.players[1 - view.you] : null);
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(view!.code);
			notice = 'Code copied.';
		} catch {
			/* clipboard blocked */
		}
	}
</script>

<div class="online" style="--accent: {accent}">
	{#if !view}
		<!-- Lobby -->
		<div class="lobby">
			<header>
				<h1>{title}</h1>
				<button class="ghost" onclick={onquit}>← Games</button>
			</header>
			{#if !loggedIn}
				<div class="panel">
					<p><strong>{title} is played online against another player.</strong> Log in to create or join a room, and to keep your rating.</p>
					<button class="primary" onclick={() => (session.loginOpen = true)}>Log in</button>
				</div>
			{:else}
				<div class="panel stats">
					<div><span>Rating</span><b>{rating?.mmr ?? '…'}</b></div>
					<div><span>Wins</span><b>{rating?.wins ?? 0}</b></div>
					<div><span>Losses</span><b>{rating?.losses ?? 0}</b></div>
					<div><span>Draws</span><b>{rating?.draws ?? 0}</b></div>
				</div>
				<p class="private">Your rating goes up when you win and down when you lose, by more against a higher-rated player. Only you can see it.</p>
				<div class="panel play">
					<div>
						<h2>Start a game</h2>
						<p>Make a room and send its code to a friend.</p>
						<button class="primary" disabled={busy} onclick={create}>Create room</button>
					</div>
					<form onsubmit={join}>
						<h2>Join a game</h2>
						<label for="{game}-code">Room code</label>
						<div class="row">
							<input
								id="{game}-code"
								bind:value={joinCode}
								inputmode="numeric"
								autocomplete="off"
								maxlength="7"
								placeholder="6 digits"
							/>
							<button class="primary" disabled={busy || joinCode.replace(/\D/g, '').length != 6}>Join</button>
						</div>
					</form>
				</div>
			{/if}
			<div class="panel">
				<h2>Theme</h2>
				<div class="themes">
					{#each themes as t (t.id)}
						<button class="theme" class:on={theme == t.id} onclick={() => pickTheme(t.id)}>
							<span class="sw">{#each t.swatch as c (c)}<i style="background:{c}"></i>{/each}</span>
							{t.name}
						</button>
					{/each}
				</div>
			</div>
			{#if error}<p class="err" role="alert">{error}</p>{/if}
			{#if notice}<p class="note">{notice}</p>{/if}
		</div>
	{:else if view.phase == 'waiting'}
		<!-- Waiting for the second player -->
		<div class="waiting">
			<h2>Room code</h2>
			<button class="code" onclick={copyCode} title="Copy">{view.code}</button>
			<p>Send this code to a friend. The game starts as soon as they join.</p>
			<div class="dots"><i></i><i></i><i></i></div>
			<button class="ghost" onclick={leave}>Cancel</button>
			{#if notice}<p class="note">{notice}</p>{/if}
		</div>
	{:else}
		<!-- Playing -->
		<div class="game">
			<div class="bar">
				<div class="player them" class:off={!them?.online}>
					<b>{them?.name}</b><span>{them?.mmr}</span>{#if !them?.online}<em>reconnecting…</em>{/if}
				</div>
				<div class="room">Room {view.code}</div>
			</div>
			<div class="board">{@render board({ view, send, theme, sound })}</div>
			<div class="bar">
				<div class="player you"><b>{me?.name} (you)</b><span>{me?.mmr}</span></div>
				<div class="actions">
					{#if view.phase == 'playing'}
						{#if game == 'chess'}
							<button class="ghost" onclick={() => send({ type: 'draw' })}>
								{view.drawOffer == 1 - view.you ? 'Accept draw' : view.drawOffer == view.you ? 'Draw offered' : 'Offer draw'}
							</button>
						{/if}
						{#if confirmResign}
							<button class="danger" onclick={() => { confirmResign = false; send({ type: 'resign' }); }}>Really resign?</button>
						{:else}
							<button class="ghost" onclick={() => (confirmResign = true)}>Resign</button>
						{/if}
					{/if}
					<button class="ghost" onclick={leave}>Leave</button>
				</div>
			</div>
			{#if view.drawOffer == 1 - view.you && view.phase == 'playing'}<p class="note">Your opponent offers a draw.</p>{/if}
			{#if error}<p class="err" role="alert">{error}</p>{/if}
			{#if notice}<p class="note">{notice}</p>{/if}

			{#if end && view.phase == 'over'}
				<div class="end">
					<div class="box">
						<h2>{describe(end.winner, end.reason, view.you)}</h2>
						{#if end.ratings[view.you]}
							{@const r = end.ratings[view.you]}
							<p class="mmr">Rating {r.mmr} <span class:up={r.delta > 0} class:down={r.delta < 0}>({r.delta > 0 ? '+' : ''}{r.delta})</span></p>
						{/if}
						<div class="row">
							{#if !notice}
								<button class="primary" disabled={iWantRematch} onclick={rematch}>
									{iWantRematch ? 'Waiting for opponent…' : theyWantRematch ? 'Accept rematch' : 'Rematch'}
								</button>
							{/if}
							<button class="ghost" onclick={leave}>Leave</button>
						</div>
						{#if theyWantRematch && !iWantRematch}<p class="note">Your opponent wants a rematch.</p>{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.online {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: auto;
		color: #e8ecf5;
		font-family: system-ui, sans-serif;
		background: radial-gradient(circle at 30% 0%, color-mix(in srgb, var(--accent) 22%, #0b1020), #070a14 70%);
	}
	.lobby {
		max-width: 620px;
		margin: 0 auto;
		padding: 22px 18px;
		display: grid;
		gap: 14px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h1 {
		margin: 0;
		font-size: 1.8rem;
		letter-spacing: 0.02em;
		color: var(--accent);
	}
	h2 {
		margin: 0 0 6px;
		font-size: 1rem;
	}
	.panel {
		padding: 14px 16px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.panel p {
		margin: 0 0 10px;
		color: #c3cbe0;
		font-size: 0.92rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		text-align: center;
	}
	.stats span {
		display: block;
		font-size: 0.75rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.stats b {
		font-size: 1.5rem;
	}
	.stats div:first-child b {
		color: var(--accent);
	}
	.private {
		margin: -6px 2px 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.play {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}
	@media (max-width: 520px) {
		.play {
			grid-template-columns: 1fr;
		}
	}
	label {
		display: block;
		font-size: 0.8rem;
		color: #94a3b8;
		margin-bottom: 4px;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.play .row {
		justify-content: flex-start;
	}
	input {
		width: 9ch;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font: 600 1.1rem ui-monospace, monospace;
		letter-spacing: 0.15em;
	}
	button {
		padding: 8px 16px;
		border-radius: 9px;
		font: inherit;
		font-weight: 650;
		cursor: pointer;
		color: #e8ecf5;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.primary {
		border: none;
		background: var(--accent);
		color: #070a14;
	}
	.ghost {
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.05);
	}
	.danger {
		border: none;
		background: #ef4444;
	}
	.themes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.theme {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.04);
		font-weight: 600;
	}
	.theme.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.sw {
		display: flex;
	}
	.sw i {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		margin-right: 2px;
	}
	.err {
		margin: 0;
		color: #fca5a5;
		text-align: center;
	}
	.note {
		margin: 4px 0 0;
		color: #fde68a;
		text-align: center;
		font-size: 0.9rem;
	}
	.waiting {
		min-height: 100%;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		padding: 20px;
		text-align: center;
	}
	.waiting p {
		color: #c3cbe0;
		max-width: 36ch;
		margin: 0;
	}
	.code {
		font: 800 3rem ui-monospace, monospace;
		letter-spacing: 0.2em;
		padding: 10px 20px;
		border: 2px dashed var(--accent);
		background: rgba(255, 255, 255, 0.04);
		color: var(--accent);
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.2s infinite ease-in-out;
	}
	.dots i:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots i:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes pulse {
		50% {
			opacity: 0.2;
		}
	}
	.game {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
	}
	.bar {
		width: min(100%, 560px);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.player {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.player span {
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.player em {
		font-size: 0.75rem;
		color: #fde68a;
	}
	.player.off b {
		opacity: 0.6;
	}
	.room {
		font: 600 0.8rem ui-monospace, monospace;
		color: #94a3b8;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.actions button {
		padding: 6px 12px;
		font-size: 0.85rem;
	}
	.board {
		width: min(100%, 560px);
	}
	.end {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(4, 6, 14, 0.55);
		animation: fade 0.25s ease-out;
	}
	.end .box {
		padding: 22px 26px;
		border-radius: 16px;
		background: rgba(12, 16, 30, 0.96);
		border: 1px solid var(--accent);
		text-align: center;
		display: grid;
		gap: 10px;
	}
	.end h2 {
		font-size: 1.5rem;
		margin: 0;
	}
	.mmr {
		margin: 0;
		color: #c3cbe0;
	}
	.up {
		color: #4ade80;
	}
	.down {
		color: #f87171;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
