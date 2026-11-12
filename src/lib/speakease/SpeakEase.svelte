<!-- SpeakEase AI, the app: home, a friend's chat, a scenario, Phrase Quest or the dictionary. Back
     (in the app or the browser) returns home. Also shows the game's +XP pops, confetti and badges. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import Home from './Home.svelte';
	import Chat from './Chat.svelte';
	import Phrases from './Phrases.svelte';
	import Dictionary from './Dictionary.svelte';
	import Flashcards from './Flashcards.svelte';
	import { flash } from './flash.svelte';
	import Confetti from './Confetti.svelte';
	import Avatar from './Avatar.svelte';
	import { app, load } from './app.svelte';
	import { quest } from './quest.svelte';
	import { game } from './game.svelte';
	import { pullProgress, watchProgress } from './sync';
	import { session } from '$lib/session.svelte';

	/** `back`: where the home screen's back arrow goes (the home page, or the SpeakEase node). */
	let {
		nickname = null,
		account = null,
		back = '/?node=proj-speakease',
		/** On the site's member list: unlimited energy in Phrase Quest. */
		member = false
	}: { nickname?: string | null; account?: string | null; back?: string; member?: boolean } = $props();

	/** The games (Phrase Quest, scenarios, the dictionary) need an account; friend chats don't. */
	const signedIn = $derived(!!account);
	/** Asking to sign in before a game opens. */
	let signInFor = $state<string | null>(null);
	const GAME_NAMES = { practice: 'Scenarios', phrases: 'Phrase Quest', dictionary: 'the Dictionary', flash: 'Flash Cards' } as const;
	const googleHref = $derived(`/auth/google?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);

	// Drawn once this browser's settings are loaded (no flash of the wrong theme or favourites).
	let ready = $state(false);
	onMount(() => {
		let stopSync: (() => void) | null = null;
		let gone = false;
		// Signed in: first take the account's progress (if it's newer), then keep sending changes.
		const synced = account ? pullProgress(account) : Promise.resolve(false);
		// Members have unlimited energy in Phrase Quest.
		game.unlimited = member;
		synced.then((inStep) => {
			if (gone) return;
			quest.locale = load('phrases-lang', quest.locale);
			app.init(nickname);
			ready = true;
			if (inStep) stopSync = watchProgress();
		});
		// Practice time for today's goal (only while a lesson is open and you're active).
		const timer = setInterval(() => app.tick(5), 5000);
		return () => {
			gone = true;
			clearInterval(timer);
			stopSync?.();
		};
	});

	function open(screen: 'chat' | 'practice' | 'phrases' | 'dictionary' | 'flash', id: string) {
		if (screen !== 'chat' && !signedIn) {
			signInFor = GAME_NAMES[screen];
			return;
		}
		// This tap lets the greeting be spoken (phones only allow speech that starts in a tap).
		app.unlockVoice();
		if (screen === 'chat') app.openChat(id);
		else if (screen === 'practice') app.openScenario(id);
		else if (screen === 'dictionary') app.openDictionary();
		else if (screen === 'flash') {
			app.openFlash();
			flash.open(id);
		}
		else {
			app.openPhrases();
			quest.open(id);
		}
		pushState('', { speakease: screen });
	}

	// Browser Back from a lesson → home.
	$effect(() => {
		if (!page.state.speakease && app.screen !== 'home') app.goHome();
	});
</script>

<div class="se" class:light={app.theme === 'light'} onpointerdown={() => app.active()} role="presentation">
	{#if !ready}
		<div class="loading" aria-label="Loading"></div>
	{:else if app.screen === 'home'}
		<Home onopen={open} {back} {signedIn} />
	{:else if app.screen === 'phrases'}
		<Phrases onback={() => history.back()} />
	{:else if app.screen === 'dictionary'}
		<Dictionary onback={() => history.back()} />
	{:else if app.screen === 'flash'}
		<Flashcards onback={() => history.back()} />
	{:else}
		{#key app.botId}<Chat onback={() => history.back()} />{/key}
	{/if}
	{#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
	{#if signInFor}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="overlay" onclick={() => (signInFor = null)}></div>
		<div class="sheet sign-in" role="dialog" aria-modal="true" aria-label="Sign in to play">
			<div class="grabber"></div>
			<span class="lock" aria-hidden="true">🔒</span>
			<h3>Sign in to play {signInFor}</h3>
			<p>Phrase Quest, Flash Cards, Scenarios and the Dictionary are for signed-in players, so your XP, levels and badges are saved to your account and follow you to every device.</p>
			<p class="free">Chatting with your friends is free, no account needed.</p>
			{#if session.auth.google}<a class="btn wide" href={googleHref}>Continue with Google</a>{/if}
			<button
				class="btn wide"
				class:ghost={session.auth.google}
				onclick={() => {
					signInFor = null;
					session.loginOpen = true;
				}}>Sign in with an email code</button
			>
			<button class="btn ghost wide" onclick={() => (signInFor = null)}>Not now</button>
		</div>
	{/if}

	<div class="pops" aria-live="polite">
		{#each game.pops as p (p.id)}<span class="pop">{p.text}</span>{/each}
	</div>
	{#key game.confetti}{#if game.confetti}<Confetti />{/if}{/key}
	{#if app.cortexNote}
		<div class="won cortex-note" role="status">
			<Avatar look="cortex" size={42} name="Cortex" />
			<span><small>Cortex is taking over</small><b>Easso's voice is resting</b><em>Cortex will read things aloud for now.</em></span>
		</div>
	{/if}
	{#if game.won}
		<div class="won" role="status">
			<span class="medal" style="--c: {game.won.color}">{game.won.mark}</span>
			<span><small>Badge unlocked</small><b>{game.won.name}</b><em>{game.won.about}</em></span>
		</div>
	{/if}
</div>

<style>
	.se {
		--se-primary: #316ccd;
		--se-primary-2: #1db1fd;
		--se-grad: linear-gradient(135deg, #316ccd, #1db1fd);
		--se-accent: #94b3e5;
		--se-bg: #0e1320;
		--se-surface: #161d2e;
		--se-surface-2: #1f2840;
		--se-border: rgba(255, 255, 255, 0.07);
		--se-text: #e9edf5;
		--se-muted: #8b95aa;
		--se-bot: #222b41;
		--se-bot-text: #e9edf5;
		--se-shadow: 0 10px 30px -18px rgba(0, 0, 0, 0.8);
		--se-good: #34d399;
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background:
			radial-gradient(120% 60% at 100% 0%, rgba(49, 108, 205, 0.18), transparent 60%),
			var(--se-bg);
		color: var(--se-text);
		font-family: Inter, Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif;
	}
	.se.light {
		--se-bg: #f2f5fb;
		--se-surface: #ffffff;
		--se-surface-2: #e9eef8;
		--se-border: rgba(15, 23, 42, 0.08);
		--se-text: #152035;
		--se-muted: #5c6880;
		--se-bot: #ffffff;
		--se-bot-text: #152035;
		--se-shadow: 0 10px 28px -18px rgba(30, 60, 120, 0.45);
		--se-good: #059669;
		background:
			radial-gradient(120% 60% at 100% 0%, rgba(49, 108, 205, 0.12), transparent 60%),
			var(--se-bg);
	}
	.se :global(.bar) {
		flex: none;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 60px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--se-border);
		background: color-mix(in srgb, var(--se-surface) 80%, transparent);
		backdrop-filter: blur(10px);
	}
	.se :global(.icon-btn) {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 12px;
		background: none;
		color: var(--se-text);
		cursor: pointer;
		text-decoration: none;
	}
	.se :global(.icon-btn:hover) {
		background: var(--se-surface-2);
	}
	.se :global(.icon-btn:disabled) {
		opacity: 0.4;
		cursor: default;
	}
	/* Pop-ups shared by every screen. */
	.se :global(.overlay) {
		position: absolute;
		inset: 0;
		z-index: 6;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(4, 8, 18, 0.55);
		backdrop-filter: blur(2px);
		animation: se-fade 0.15s ease-out;
	}
	.se :global(.card) {
		width: 100%;
		max-width: 340px;
		max-height: 85%;
		overflow-y: auto;
		padding: 20px;
		border-radius: 20px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.6);
		color: var(--se-text);
		animation: se-pop 0.18s ease-out;
	}
	.se :global(.sheet) {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 6;
		max-height: 88%;
		overflow-y: auto;
		padding: 10px 16px 22px;
		border-radius: 24px 24px 0 0;
		background: var(--se-surface);
		border-top: 1px solid var(--se-border);
		box-shadow: 0 -20px 50px -10px rgba(0, 0, 0, 0.5);
		color: var(--se-text);
		animation: se-up 0.22s ease-out;
	}
	.sign-in {
		text-align: center;
	}
	.sign-in .lock {
		font-size: 34px;
	}
	.sign-in h3 {
		margin: 6px 0 8px;
	}
	.sign-in p {
		margin: 0 0 10px;
		color: var(--se-muted);
		font-size: 14px;
		line-height: 1.5;
	}
	.sign-in .free {
		color: var(--se-good);
		font-weight: 650;
	}
	.sign-in .btn {
		width: 100%;
		margin-top: 8px;
		text-decoration: none;
		box-sizing: border-box;
	}
	.se :global(.sheet .grabber) {
		width: 40px;
		height: 4px;
		margin: 0 auto 12px;
		border-radius: 2px;
		background: var(--se-border);
	}
	.se :global(.btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 18px;
		border: none;
		border-radius: 14px;
		background: var(--se-grad);
		color: #fff;
		font: inherit;
		font-weight: 650;
		cursor: pointer;
		box-shadow: 0 8px 20px -10px rgba(29, 177, 253, 0.8);
	}
	.se :global(.btn.ghost) {
		background: var(--se-surface-2);
		color: var(--se-text);
		box-shadow: none;
	}
	.se :global(.btn:disabled) {
		opacity: 0.5;
		cursor: default;
	}
	/* Rows that scroll sideways: a slim scrollbar with a mouse (desktop); phones swipe without one. */
	.se :global(.hscroll) {
		overflow-x: auto;
		scrollbar-width: none;
	}
	.se :global(.hscroll::-webkit-scrollbar) {
		display: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.se :global(.hscroll) {
			scrollbar-width: thin;
			scrollbar-color: color-mix(in srgb, var(--se-primary-2) 55%, transparent) transparent;
			padding-bottom: 10px;
		}
		.se :global(.hscroll::-webkit-scrollbar) {
			display: block;
			height: 8px;
		}
		.se :global(.hscroll::-webkit-scrollbar-track) {
			margin: 0 16px;
			border-radius: 4px;
			background: var(--se-surface-2);
		}
		.se :global(.hscroll::-webkit-scrollbar-thumb) {
			border-radius: 4px;
			background: color-mix(in srgb, var(--se-primary-2) 55%, transparent);
		}
		.se :global(.hscroll::-webkit-scrollbar-thumb:hover) {
			background: var(--se-primary-2);
		}
	}
	.se :global(.chip-row) {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.se :global(.chip) {
		padding: 8px 12px;
		border: 1px solid var(--se-border);
		border-radius: 999px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
	}
	.se :global(.chip.on) {
		border-color: transparent;
		background: var(--se-grad);
		color: #fff;
	}
	@keyframes -global-se-fade {
		from {
			opacity: 0;
		}
	}
	@keyframes -global-se-pop {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
	}
	@keyframes -global-se-up {
		from {
			transform: translateY(100%);
		}
	}
	.loading {
		flex: 1;
	}
	.pops {
		position: absolute;
		top: 70px;
		left: 0;
		right: 0;
		z-index: 9;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		pointer-events: none;
	}
	.pop {
		padding: 6px 12px;
		border-radius: 999px;
		background: linear-gradient(135deg, #7c3aed, #316ccd);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		box-shadow: 0 8px 20px -8px rgba(124, 58, 237, 0.8);
		animation: pop-rise 1.8s ease-out forwards;
	}
	@keyframes pop-rise {
		0% {
			transform: translateY(12px) scale(0.9);
			opacity: 0;
		}
		12%,
		70% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(-14px);
			opacity: 0;
		}
	}
	.won {
		position: absolute;
		left: 12px;
		right: 12px;
		top: 70px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 18px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: 0 20px 40px -14px rgba(0, 0, 0, 0.6);
		animation: se-pop 0.25s ease-out;
	}
	.cortex-note {
		border-color: color-mix(in srgb, #e5306f 45%, var(--se-border));
	}
	.won span:last-child {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.won small {
		color: var(--se-muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.won em {
		color: var(--se-muted);
		font-size: 13px;
		font-style: normal;
	}
	.medal {
		flex: none;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent),
			0 6px 16px -6px var(--c);
		color: #fff;
		font-weight: 800;
		font-size: 14px;
	}
	.toast {
		position: absolute;
		left: 50%;
		bottom: 120px;
		z-index: 9;
		transform: translateX(-50%);
		width: max-content;
		max-width: 85%;
		padding: 10px 14px;
		border-radius: 12px;
		background: rgba(15, 20, 32, 0.94);
		color: #fff;
		font-size: 14px;
		text-align: center;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
	@media (prefers-reduced-motion: reduce) {
		.se :global(*) {
			animation-duration: 0.01ms !important;
		}
	}
</style>
