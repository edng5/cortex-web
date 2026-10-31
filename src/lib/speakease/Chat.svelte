<!-- A SpeakEase chat (a friend, or a scenario): hold the mic to talk; each bubble can be translated
     (tap it), checked (✓), copied and played back; the light bulb suggests what to say next. -->
<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import HoldMic from './HoldMic.svelte';
	import Energy from './Energy.svelte';
	import { game, starsFor } from './game.svelte';
	import { app, type Msg } from './app.svelte';
	import { SCENARIO_LANGUAGES, TIPS, noSpaces } from './data';

	let { onback }: { onback: () => void } = $props();

	const practice = $derived(app.screen === 'practice');
	const who = $derived(app.friend ?? app.scenario);
	let list = $state<HTMLDivElement>();

	// Pop-ups
	let menuOpen = $state(false);
	let confirmOpen = $state(false);
	let tip = $state<number | null>(null);
	/** Scenarios open with the language picker. */
	let languageOpen = $state(app.screen === 'practice');
	let check = $state<{ msg: Msg; text: string } | null>(null);
	/** Messages showing their translation. */
	let translated = $state<Record<string, boolean>>({});
	let copied = $state<string | null>(null);
	/** Messages showing how to pronounce them (the /ə/ button). */
	let sounding = $state<Record<string, boolean>>({});

	const shown = $derived(app.messages.filter((m) => !m.hidden));
	const lastBot = $derived([...shown].reverse().find((m) => m.role === 'assistant')?.id);
	const subtitle = $derived(app.friend ? app.friend.language : practice ? `${app.scenario?.role} · ${app.scenarioLanguage}` : '');

	// Keep the newest message in view.
	$effect(() => {
		void shown.length;
		void app.waiting;
		void app.recording;
		tick().then(() => list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }));
	});

	/** Pronunciation colours (as the app: red under 60, yellow to 85, green above), readable on blue. */
	const colour = (s: number) => (s < 60 ? '#ff9a9a' : s <= 85 ? '#ffe27a' : '#9dffc4');

	async function toggleTranslation(m: Msg) {
		if (!m.text) return;
		if (translated[m.id]) return (translated[m.id] = false);
		if (await app.translationOf(m)) translated[m.id] = true;
	}

	async function openCheck(m: Msg) {
		if (!m.text) return;
		const text = await app.correctionOf(m);
		if (text) check = { msg: m, text };
	}

	async function copy(m: Msg) {
		try {
			await navigator.clipboard.writeText(m.text);
			copied = m.id;
			setTimeout(() => copied === m.id && (copied = null), 1200);
		} catch {
			app.say("Couldn't copy that.");
		}
	}

	function startScenario() {
		languageOpen = false;
		app.startScenario();
	}
	function confirmDelete() {
		confirmOpen = false;
		app.clear();
		translated = {};
		if (practice) languageOpen = true;
	}
	const scenarioLocale = $derived(SCENARIO_LANGUAGES.find((l) => l.label === app.scenarioLanguage)?.locale);
</script>

<header class="bar">
	<button class="icon-btn" onclick={onback} aria-label="Back to home"><Icon name="back" size={22} /></button>
	<Avatar look={app.friend?.persona ?? 'cortex'} size={38} name={app.friend?.name ?? 'Cortex'} />
	<span class="who"><b>{app.title}</b>{#if subtitle}<small>{subtitle}</small>{/if}</span>
	<!-- Scenarios are a game (energy, XP, stars); friend chats are plain conversations. -->
	{#if practice}<Energy />{/if}
	<button class="icon-btn" onclick={() => (menuOpen = true)} aria-label="Menu"><Icon name="menu" size={24} /></button>
</header>

<div class="messages" bind:this={list} data-swipe-ignore>
	{#each shown as m (m.id)}
		{@const user = m.role === 'user'}
		{@const showTr = translated[m.id] && app.translations[m.id]}
		<div class="msg" class:user>
			<button class="bubble" onclick={() => toggleTranslation(m)} title="Tap to translate">
				{#if showTr}
					<span dir="auto">{app.translations[m.id].text}</span>
					<span class="tr-tag">Translated</span>
				{:else if user && m.words?.length}
					<span dir="auto">
						{#each m.words as w, i (i)}<span style="color: {colour(w.s)}">{w.w}</span>{#if i < m.words.length - 1 && !noSpaces(app.locale)}{' '}{/if}{/each}
					</span>
				{:else if user && !m.text}
					<span class="quiet">(nothing heard)</span>
				{:else}
					<span dir="auto">{m.text}</span>
				{/if}
			</button>
			<div class="tools">
				{#if user}
					<button onclick={() => openCheck(m)} aria-label="Check this sentence" title="Check"><Icon name="check" size={20} /></button>
					<button onclick={() => copy(m)} aria-label="Copy" title="Copy">{#if copied === m.id}<span class="copied">Copied</span>{:else}<Icon name="copy" size={18} />{/if}</button>
					<button onclick={() => m.text && app.play(m.text)} aria-label="Play" title="Play"><Icon name="volume" size={20} /></button>
					<button class="ipa-btn" class:on={sounding[m.id]} onclick={() => m.text && (sounding[m.id] = !sounding[m.id])} aria-pressed={!!sounding[m.id]} aria-label="How to pronounce it" title="How to pronounce it">/ə/</button>
				{:else}
					<button onclick={() => app.play(m.text)} aria-label="Play" title="Play"><Icon name="volume" size={20} /></button>
					<button onclick={() => copy(m)} aria-label="Copy" title="Copy">{#if copied === m.id}<span class="copied">Copied</span>{:else}<Icon name="copy" size={18} />{/if}</button>
					<button class="ipa-btn" class:on={sounding[m.id]} onclick={() => m.text && (sounding[m.id] = !sounding[m.id])} aria-pressed={!!sounding[m.id]} aria-label="How to pronounce it" title="How to pronounce it">/ə/</button>
					{#if m.id === lastBot && !app.waiting}
						<button class="idea" onclick={() => app.suggest()} aria-label="Suggest a reply" title="Not sure what to say?"><Icon name="bulb" size={18} />Idea</button>
					{/if}
				{/if}
			</div>
			{#if sounding[m.id] && m.text}
				<div class="phon">
					{#await app.phoneticsOf(m)}
						<p class="phon-wait">Working out how to say it…</p>
					{:then ph}
						{#if ph}
							{#if ph.romanization}<p class="phon-roman">{ph.romanization}</p>{/if}
							<div class="phon-words">
								{#each ph.words as w, i (i)}
									<button class="phon-word" onclick={() => app.play(w.word, { slow: true })} title="Hear “{w.word}” slowly">
										<span dir="auto">{w.word}</span>
										<b>{w.sounds}</b>
										{#if w.ipa}<small>/{w.ipa}/</small>{/if}
									</button>
								{/each}
							</div>
						{/if}
					{/await}
				</div>
			{/if}
		</div>
	{/each}

	{#if app.recording}
		<div class="msg user"><div class="bubble waves" aria-label="Listening"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
	{:else if app.waiting}
		{#if !practice || shown.length}
			<div class="msg user"><div class="bubble dots" aria-label="Loading"><i></i><i></i><i></i></div></div>
		{/if}
		<div class="msg"><div class="bubble dots" aria-label="Loading"><i></i><i></i><i></i></div></div>
	{/if}
</div>

{#if practice && game.energy < 1 && !app.waiting}
	<div class="energy-out"><Energy out onhome={onback} /></div>
{/if}

<div class="dock">
	<HoldMic
		bind:recording={app.recording}
		disabled={(app.waiting && !app.recording) || (practice && game.energy < 1)}
		hint={practice ? 'Hold to talk · 1 energy a line' : 'Hold to talk'}
		onrecord={(b) => app.sendRecording(b)}
	/>
</div>

{#if menuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="menu-back" onclick={() => (menuOpen = false)}>
		<div class="menu" role="menu">
			<button role="menuitem" onclick={() => ((menuOpen = false), (tip = 0))}><Icon name="help" size={20} />Help</button>
			<button role="menuitem" class="danger" onclick={() => ((menuOpen = false), (confirmOpen = true))}><Icon name="trash" size={20} />Delete chat</button>
			<button role="menuitem" onclick={() => (menuOpen = false)}><Icon name="close" size={20} />Close</button>
		</div>
	</div>
{/if}

{#if confirmOpen}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Delete chat">
		<div class="card center">
			<p class="card-title">Are you sure?</p>
			<p>Do you want to delete the chat?</p>
			<div class="yesno">
				<button class="btn ghost" onclick={() => (confirmOpen = false)}>No</button>
				<button class="btn danger" onclick={confirmDelete}>Yes, delete</button>
			</div>
		</div>
	</div>
{/if}

{#if tip !== null}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Tips">
		<div class="card center">
			<p class="eyebrow">Tip {tip + 1} of {TIPS.length}</p>
			<p class="tip">{TIPS[tip]}</p>
			<div class="dots-nav" aria-hidden="true">{#each TIPS as _, i (i)}<i class:on={i === tip}></i>{/each}</div>
			<button class="btn wide" onclick={() => (tip = tip! < TIPS.length - 1 ? tip! + 1 : null)}>{tip < TIPS.length - 1 ? 'Next' : 'Got it'}</button>
		</div>
	</div>
{/if}

{#if check}
	{@const low = (check.msg.words ?? []).filter((w) => w.s < 85)}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Sentence check">
		<div class="card">
			<p class="card-title">Sentence Structure</p>
			<p class="pre" dir="auto"><span class="muted">Original:</span> {check.msg.text}</p>
			<p class="verdict" class:good={/^looks good/i.test(check.text.trim())} dir="auto">{check.text}</p>
			<p class="card-title">Pronunciation</p>
			{#if low.length}
				{#each low as w, i (i)}
					<div class="word">
						<div class="word-head">
							<span dir="auto" style="color: {w.s < 60 ? '#ef4444' : '#d97706'}"><b>{w.w}</b></span>
							<button class="icon-btn" onclick={() => app.play(w.w)} aria-label="Hear {w.w}"><Icon name="volume" size={20} /></button>
							<button class="icon-btn" onclick={() => app.play(w.w, { slow: true })} aria-label="Hear {w.w} slowly"><Icon name="slow" size={20} /></button>
						</div>
						{#await app.pronunciationOf(w.w)}
							<p class="muted small">Getting how to say it…</p>
						{:then g}
							{#if g}
								<p class="sounds">{g.sounds} {#if g.ipa}<span class="ipa">/{g.ipa.replace(/^\/|\/$/g, '')}/</span>{/if}</p>
								<p class="how">{g.how}</p>
							{/if}
						{/await}
					</div>
				{/each}
			{:else}
				<p class="verdict good">Looks good!</p>
			{/if}
			<button class="btn wide" onclick={() => (check = null)}>Close</button>
		</div>
	</div>
{/if}

{#if languageOpen}
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Select a language">
		<div class="grabber"></div>
		{#if who}
			<div class="sheet-head">
				<Avatar look="cortex" size={44} name="Cortex" />
				<div>
					<b>{app.title}</b><small>{app.scenario?.role}</small>
					{#if app.scenario}
						{@const stars = starsFor(game.saved.scenes[app.scenario.id] ?? 0)}
						<small class="sc-stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)} · finish it for +40 XP</small>
					{/if}
				</div>
			</div>
		{/if}
		<p class="sheet-title">Select a language:</p>
		<div class="chip-row">
			{#each SCENARIO_LANGUAGES as l (l.label)}
				<button class="chip" class:on={app.scenarioLanguage === l.label} onclick={() => app.pickScenarioLanguage(l.label)}>{l.label}</button>
			{/each}
		</div>
		<button class="btn wide" onclick={startScenario} disabled={!scenarioLocale}><Icon name="play" size={20} color="#fff" />Start in {app.scenarioLanguage}</button>
	</div>
{/if}

<style>
	.who {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.2;
	}
	.who b {
		font-size: 16px;
	}
	.who small {
		color: var(--se-muted);
		font-size: 12px;
	}
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px 0 8px;
		scrollbar-width: thin;
	}
	.msg {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		margin: 6px 0;
		padding: 0 64px 0 14px;
	}
	.msg.user {
		align-items: flex-end;
		padding: 0 14px 0 56px;
	}
	.bubble {
		max-width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--se-border);
		border-radius: 18px 18px 18px 6px;
		background: var(--se-bot);
		color: var(--se-bot-text);
		font: inherit;
		font-size: 15px;
		line-height: 1.45;
		text-align: start;
		cursor: pointer;
		overflow-wrap: anywhere;
		box-shadow: var(--se-shadow);
	}
	.user .bubble {
		border: none;
		border-radius: 18px 18px 6px 18px;
		background: linear-gradient(135deg, #2f6fdc, #1789f2);
		color: #fff;
	}
	.tr-tag {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		opacity: 0.7;
	}
	.quiet {
		opacity: 0.75;
		font-style: italic;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-top: 3px;
	}
	.tools button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 32px;
		min-width: 32px;
		justify-content: center;
		padding: 0 8px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--se-muted);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.tools button:hover {
		background: var(--se-surface-2);
		color: var(--se-text);
	}
	.tools .idea {
		color: #f5b301;
		font-weight: 600;
	}
	.copied {
		font-size: 12px;
	}
	.tools .ipa-btn {
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
		font-size: 14px;
		font-weight: 700;
	}
	.tools .ipa-btn.on {
		background: var(--se-surface-2);
		color: var(--se-primary-2);
	}
	/* How to say it: each word with its sounds-like spelling and IPA (tap one to hear it slowly). */
	.phon {
		max-width: 100%;
		margin-top: 4px;
		padding: 10px;
		border-radius: 14px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		animation: se-pop 0.15s ease-out;
	}
	.phon-wait {
		margin: 0;
		color: var(--se-muted);
		font-size: 13px;
	}
	.phon-roman {
		margin: 0 0 8px;
		color: var(--se-primary-2);
		font-size: 14px;
		font-weight: 600;
	}
	.phon-words {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.phon-word {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 6px 9px;
		border: none;
		border-radius: 10px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		font-size: 13px;
		line-height: 1.25;
		cursor: pointer;
	}
	.phon-word:hover {
		outline: 1px solid var(--se-primary-2);
	}
	.phon-word b {
		font-size: 13px;
		letter-spacing: 0.02em;
	}
	.phon-word small {
		color: var(--se-muted);
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
		font-size: 12px;
	}
	/* Listening: the app's sound-wave bubble. */
	.waves {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 42px;
		width: 84px;
		justify-content: center;
		cursor: default;
	}
	.waves i {
		width: 4px;
		height: 8px;
		border-radius: 2px;
		background: #fff;
		animation: wave 0.9s ease-in-out infinite;
	}
	.waves i:nth-child(2n) {
		animation-delay: -0.3s;
	}
	.waves i:nth-child(3n) {
		animation-delay: -0.6s;
	}
	@keyframes wave {
		50% {
			height: 26px;
		}
	}
	/* Waiting: the app's three dots. */
	.dots {
		display: flex;
		gap: 6px;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 42px;
		cursor: default;
	}
	.dots i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--se-muted);
		animation: dot 1.2s ease-in-out infinite;
	}
	.user .dots i {
		background: #fff;
	}
	.dots i:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dots i:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes dot {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		30% {
			transform: translateY(-6px);
			opacity: 1;
		}
	}
	.energy-out {
		padding: 0 14px;
	}
	.sc-stars {
		color: #f5b301 !important;
	}
	.dock {
		flex: none;
		padding: 10px 0 14px;
		border-top: 1px solid var(--se-border);
		background: color-mix(in srgb, var(--se-surface) 70%, transparent);
	}
	.menu-back {
		position: absolute;
		inset: 0;
		z-index: 6;
	}
	.menu {
		position: absolute;
		top: 58px;
		right: 10px;
		display: flex;
		flex-direction: column;
		min-width: 170px;
		padding: 6px;
		border-radius: 16px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.55);
		animation: se-pop 0.15s ease-out;
	}
	.menu button {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--se-text);
		font: inherit;
		font-size: 15px;
		text-align: left;
		cursor: pointer;
	}
	.menu button:hover {
		background: var(--se-surface-2);
	}
	.menu .danger {
		color: #ef4444;
	}
	.card p {
		margin: 0 0 10px;
	}
	.center {
		text-align: center;
	}
	.card-title {
		font-size: 17px;
		font-weight: 750;
	}
	.eyebrow {
		color: var(--se-primary-2);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.tip {
		font-size: 16px;
		line-height: 1.5;
	}
	.dots-nav {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin: 6px 0 14px;
	}
	.dots-nav i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--se-border);
	}
	.dots-nav i.on {
		width: 18px;
		border-radius: 3px;
		background: var(--se-primary-2);
	}
	.pre {
		white-space: pre-line;
	}
	.muted {
		color: var(--se-muted);
	}
	.small {
		font-size: 13px;
	}
	.verdict {
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--se-surface-2);
		white-space: pre-line;
	}
	.verdict.good {
		color: var(--se-good);
		font-weight: 650;
	}
	.word {
		margin-bottom: 10px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--se-surface-2);
	}
	.word-head {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.word-head span {
		flex: 1;
		font-size: 17px;
	}
	.word-head .icon-btn.icon-btn {
		width: 34px;
		height: 34px;
	}
	.sounds {
		margin: 4px 0 2px !important;
		font-weight: 650;
		letter-spacing: 0.02em;
	}
	.ipa {
		margin-left: 6px;
		color: var(--se-muted);
		font-weight: 400;
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
	}
	.how {
		margin: 0 !important;
		color: var(--se-muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.yesno {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 6px;
	}
	.btn.danger {
		background: linear-gradient(135deg, #ef4444, #f97316);
		box-shadow: none;
	}
	.wide {
		width: 100%;
		margin-top: 8px;
	}
	.sheet-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}
	.sheet-head div {
		display: flex;
		flex-direction: column;
	}
	.sheet-head small {
		color: var(--se-muted);
	}
	.sheet-title {
		margin: 12px 0 10px;
		font-weight: 700;
	}
	.sheet .wide {
		margin-top: 16px;
	}
</style>
