<!-- Dictionary: look up a word in your own language and see it in the language you're learning, with
     how to say it, an example, and the tutor's voice. Recent lookups are kept on this device. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import LangIcon from './LangIcon.svelte';
	import { app, load, post, store } from './app.svelte';
	import { game } from './game.svelte';
	import { quest } from './quest.svelte';
	import { sideways } from './sideways';
	import { FRIENDS, TRANSLATE_OPTIONS } from './data';

	let { onback }: { onback: () => void } = $props();

	interface Entry {
		word: string;
		romanization: string;
		sounds: string;
		ipa: string;
		partOfSpeech: string;
		sense: string;
		example: string;
		exampleTranslation: string;
	}
	interface Lookup {
		query: string;
		from: string;
		locale: string;
		entries: Entry[];
	}

	/** The language you're learning (the last one used in Phrase Quest, to start with). */
	let locale = $state(load<string>('dict-lang', quest.locale));
	let query = $state('');
	let busy = $state(false);
	let current = $state<Lookup | null>(null);
	let recent = $state<Lookup[]>(load<Lookup[]>('dictionary', []));
	let input = $state<HTMLInputElement>();

	const tutor = $derived(FRIENDS.find((f) => f.locale === locale) ?? FRIENDS[0]);
	const fromLabel = $derived(TRANSLATE_OPTIONS.find((o) => o.lang === app.translateTo)?.label ?? 'English');
	const key = (l: { query: string; from: string; locale: string }) => `${l.from}|${l.locale}|${l.query.toLocaleLowerCase()}`;

	function pickLanguage(l: string) {
		locale = l;
		store('dict-lang', l);
		current = null;
	}

	async function lookUp(e?: SubmitEvent) {
		e?.preventDefault();
		const word = query.trim();
		if (!word || busy) return;
		const ask = { query: word, from: app.translateTo, locale };
		const seen = recent.find((r) => key(r) === key(ask));
		if (seen) {
			current = seen;
			return;
		}
		busy = true;
		app.active();
		try {
			const { entries } = await post<{ entries: Entry[] }>('dictionary', { word, from: app.translateTo, locale });
			current = { ...ask, entries };
			if (entries.length) {
				recent = [current, ...recent.filter((r) => key(r) !== key(ask))].slice(0, 30);
				store('dictionary', recent);
				game.lookedUp();
			}
		} catch (err) {
			app.say((err as Error).message);
		} finally {
			busy = false;
		}
	}

	function open(r: Lookup) {
		locale = r.locale;
		query = r.query;
		current = r;
	}

	const hear = (text: string, slow = false) => app.play(text, { botId: tutor.id, locale, slow });
</script>

<header class="bar">
	<button class="icon-btn" onclick={onback} aria-label="Back to home"><Icon name="back" size={22} /></button>
	<span class="who"><b>Dictionary</b><small>{fromLabel} → {tutor.language}</small></span>
</header>

<div class="body">
	<form class="search" onsubmit={lookUp}>
		<input
			bind:this={input}
			bind:value={query}
			placeholder="Type a word in {fromLabel}…"
			maxlength="80"
			autocomplete="off"
			enterkeyhint="search"
			aria-label="Word to look up"
		/>
		<button class="btn" type="submit" disabled={busy || !query.trim()}>{busy ? '…' : 'Look up'}</button>
	</form>

	<p class="label">Translate into</p>
	<div class="langs hscroll" data-swipe-ignore use:sideways>
		{#each FRIENDS as f (f.id)}
			<button class="lang" class:on={f.locale === locale} onclick={() => pickLanguage(f.locale)} title={f.language}>
				<LangIcon locale={f.locale} size={30} label={f.language} />
				<span>{f.language}</span>
			</button>
		{/each}
	</div>
	<p class="fine">Looking up from {fromLabel}: change it in Settings → Translate messages to.</p>

	{#if busy}
		<div class="state"><div class="spinner" aria-hidden="true"></div></div>
	{:else if current}
		{#if !current.entries.length}
			<p class="state muted">No {tutor.language} word found for “{current.query}”.</p>
		{/if}
		{#each current.entries as e, i (i)}
			<article class="entry">
				<div class="entry-head">
					<div>
						<p class="pos">{e.partOfSpeech}{e.sense ? ` · ${e.sense}` : ''}</p>
						<h2 dir="auto">{e.word}</h2>
						{#if e.romanization}<p class="roman">{e.romanization}</p>{/if}
					</div>
					<div class="listen">
						<button class="icon-btn hear" onclick={() => hear(e.word)} aria-label="Hear {e.word}"><Icon name="volume" size={22} /></button>
						<button class="icon-btn hear" onclick={() => hear(e.word, true)} aria-label="Hear {e.word} slowly"><Icon name="slow" size={22} /></button>
					</div>
				</div>
				<p class="say"><span class="tag">Sounds like</span> <b>{e.sounds}</b> {#if e.ipa}<span class="ipa">/{e.ipa.replace(/^\/|\/$/g, '')}/</span>{/if}</p>
				{#if e.example}
					<button class="example" onclick={() => hear(e.example)}>
						<span dir="auto">{e.example}</span>
						<small>{e.exampleTranslation}</small>
					</button>
				{/if}
			</article>
		{/each}
	{:else if recent.length}
		<p class="label">Recent</p>
		<div class="recent">
			{#each recent as r (key(r))}
				{@const f = FRIENDS.find((x) => x.locale === r.locale)}
				<button class="recent-item" onclick={() => open(r)}>
					<span><b>{r.query}</b> → <span dir="auto">{r.entries[0]?.word}</span></span>
					<small>{f?.language}</small>
				</button>
			{/each}
		</div>
	{:else}
		<p class="state muted">Look up any word, see how it's said and hear it.</p>
	{/if}
</div>

<style>
	.who {
		flex: 1;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.who b {
		font-size: 16px;
	}
	.who small {
		color: var(--se-muted);
		font-size: 12px;
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding: 14px;
	}
	.search {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		min-width: 0;
		padding: 12px 14px;
		border: 1px solid var(--se-border);
		border-radius: 14px;
		background: var(--se-surface);
		color: var(--se-text);
		font: inherit;
		font-size: 16px;
	}
	input:focus {
		outline: 2px solid var(--se-primary-2);
		outline-offset: 0;
	}
	.label {
		margin: 16px 2px 8px;
		color: var(--se-muted);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.langs {
		display: flex;
		gap: 8px;
		margin: 0 -14px;
		padding: 0 14px 4px;
	}
	.lang {
		flex: none;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px 4px 4px;
		border: 1px solid var(--se-border);
		border-radius: 999px;
		background: var(--se-surface);
		color: var(--se-text);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.lang.on {
		border-color: transparent;
		background: var(--se-grad);
		color: #fff;
	}
	.fine {
		margin: 8px 2px 0;
		color: var(--se-muted);
		font-size: 12px;
	}
	.state {
		display: grid;
		place-items: center;
		padding: 30px 10px;
		text-align: center;
	}
	.muted {
		color: var(--se-muted);
	}
	.spinner {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 3px solid var(--se-surface-2);
		border-top-color: var(--se-primary-2);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.entry {
		margin-top: 14px;
		padding: 16px;
		border-radius: 20px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
	}
	.entry-head {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.entry-head > div:first-child {
		flex: 1;
		min-width: 0;
	}
	.pos {
		margin: 0;
		color: var(--se-primary-2);
		font-size: 12px;
		font-weight: 700;
	}
	h2 {
		margin: 2px 0 0;
		font-size: 26px;
		font-weight: 800;
	}
	.roman {
		margin: 2px 0 0;
		opacity: 0.85;
	}
	.listen {
		display: flex;
		gap: 4px;
	}
	.listen .icon-btn.hear {
		background: var(--se-surface-2);
	}
	.say {
		margin: 10px 0 0;
	}
	.tag {
		color: var(--se-muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.ipa {
		color: var(--se-muted);
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
	}
	.example {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		margin-top: 12px;
		padding: 10px 12px;
		border: none;
		border-left: 3px solid var(--se-primary-2);
		border-radius: 10px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.example small {
		color: var(--se-muted);
	}
	.recent {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.recent-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid var(--se-border);
		border-radius: 14px;
		background: var(--se-surface);
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.recent-item small {
		color: var(--se-muted);
	}
</style>
