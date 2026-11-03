<!-- Phrase Quest: say each phrase until you've got it. Shows how to say it (sounds-like spelling,
     IPA, tips for the tricky sounds), plays it in the tutor's voice (slowly too), scores each word. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import HoldMic from './HoldMic.svelte';
	import Energy from './Energy.svelte';
	import { game } from './game.svelte';
	import { app } from './app.svelte';
	import { TRIES, perLevel, quest } from './quest.svelte';
	import { noSpaces } from './data';

	let { onback }: { onback: () => void } = $props();

	let recording = $state(false);
	/** The "review earlier phrases" sheet. */
	let reviewOpen = $state(false);
	function review(level: number | null) {
		reviewOpen = false;
		quest.reviewLevel(level);
	}
	const card = $derived(quest.card);
	const r = $derived(quest.result);
	/** Waiting for "Next" (passed, or out of tries). */
	const settled = $derived(!!r && (r.pass || quest.retriesLeft === 0));
	const tutor = $derived(quest.tutor);
	const p = $derived(quest.progress);

	const colour = (s: number) => (s < 60 ? '#ef4444' : s <= 85 ? '#d97706' : 'var(--se-good)');
	const praise = (score: number) => (score >= 95 ? 'Perfect!' : score >= 88 ? 'Great job!' : 'Nice, you got it!');
	/** Tips for the words that were marked down this time. */
	const weakTips = $derived(
		r && card && !r.pass
			? card.tips.filter((t) => r.words.some((w) => w.s < 80 && (t.word.includes(w.w) || w.w.includes(t.word))))
			: []
	);
</script>

<header class="bar">
	<button class="icon-btn" onclick={onback} aria-label="Back to home"><Icon name="back" size={22} /></button>
	<Avatar look={tutor.persona} size={38} name={tutor.name} />
	<span class="who"><b>Phrase Quest</b><small>{tutor.language} with {tutor.name}</small></span>
	<button class="review-btn" onclick={() => (reviewOpen = true)} disabled={!p.learned.length} title={p.learned.length ? 'Review earlier phrases' : 'Learn a phrase first'}>
		<Icon name="retry" size={16} />Review
	</button>
	<Energy unlimited={game.unlimited} />
	<span class="level">Lv {p.level}</span>
</header>

<div class="progress" aria-label="{p.passed} of {perLevel(p.level)} phrases to the next level">
	{#each Array(perLevel(p.level)) as _, i (i)}<i class:on={i < p.passed}></i>{/each}
</div>

<div class="body">
	{#if quest.error && !card}
		<div class="state">
			<p>{quest.error}</p>
			<button class="btn" onclick={() => quest.retryLoad()}><Icon name="retry" size={18} color="#fff" />Try again</button>
		</div>
	{:else if !card}
		<div class="state">
			<div class="spinner" aria-hidden="true"></div>
			<p>Finding level {p.level} phrases…</p>
		</div>
	{:else}
		<article class="phrase" class:review={card.review}>
			<p class="tag">{card.review ? 'Review' : card.oppositeOf ? `Opposite of “${card.oppositeOf}”` : `New phrase · Level ${card.level}`}</p>
			<h1 dir="auto">{card.text}</h1>
			{#if card.romanization}<p class="roman">{card.romanization}</p>{/if}
			<p class="meaning">{card.meaning}</p>
			{#if card.opposite && !card.review}
				<!-- Collapsed to start with, for every new phrase. -->
				{#key card.id}
					<details class="opposite">
						<summary>Opposite{#if card.oppositeQueued}<span class="queued">Up next</span>{/if}</summary>
						<div class="opp-body">
							<span><b dir="auto">{card.opposite.text}</b> <em>{card.opposite.meaning}</em></span>
							{#if !card.oppositeQueued}
								<button class="btn ghost small" onclick={() => quest.learnOpposite()}>Learn the opposite too</button>
							{/if}
						</div>
					</details>
				{/key}
			{/if}
			<div class="say">
				<div>
					<span class="label">Sounds like</span>
					<span class="sounds">{card.sounds}</span>
					{#if card.ipa}<span class="ipa">/{card.ipa.replace(/^\/|\/$/g, '')}/</span>{/if}
				</div>
				<div class="listen">
					<button class="icon-btn hear" onclick={() => quest.listen()} aria-label="Hear it" title="Hear it"><Icon name="volume" size={22} /></button>
					<button class="icon-btn hear" onclick={() => quest.listen(true)} aria-label="Hear it slowly" title="Slowly"><Icon name="slow" size={22} /></button>
				</div>
			</div>
			{#if card.tips.length}
				<details open={card.level <= 2 || !!weakTips.length}>
					<summary>How to say it</summary>
					<ul>
						{#each card.tips as t, i (i)}
							<li class:weak={weakTips.includes(t)}>
								<b dir="auto">{t.word}</b>
								<span class="like">sounds like “{t.soundsLike}”</span>
								<span class="how">{t.how}</span>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</article>

		{#if game.energy < 1 && !game.unlimited && !quest.checking && !settled}
			<Energy out onhome={onback} />
		{:else if quest.checking}
			<div class="result"><div class="spinner small" aria-hidden="true"></div><p>Listening to how you said it…</p></div>
		{:else if r}
			<div class="result" class:pass={r.pass} class:fail={!r.pass}>
				<div class="score">
					<b>{r.score}</b><small>/100</small>
				</div>
				<div class="verdict">
					{#if r.pass}
						<p class="big">{praise(r.score)} <span class="xp">+{r.xp} XP</span></p>
						{#if game.combo >= 2}<p class="combo">Combo x{game.combo}! Keep getting them first try.</p>{/if}
						<p>{card.review ? 'Still got it.' : `${p.passed + 1 >= perLevel(p.level) ? 'That finishes the level!' : `${perLevel(p.level) - p.passed - 1} more to level ${p.level + 1}.`}`}</p>
					{:else if quest.retriesLeft > 0}
						<p class="big">Almost!</p>
						<p>Listen again and give it another go. {quest.retriesLeft} {quest.retriesLeft === 1 ? 'try' : 'tries'} left.</p>
					{:else}
						<p class="big">We'll come back to this one.</p>
						<p>It'll come up again in a few phrases.</p>
					{/if}
					{#if r.words.length}
						<p class="words" dir="auto">
							{#each r.words as w, i (i)}<span style="color: {colour(w.s)}" title="{w.s}/100">{w.w}</span>{#if i < r.words.length - 1 && !noSpaces(quest.locale)}{' '}{/if}{/each}
						</p>
					{/if}
					{#if r.heard && !r.pass}<p class="heard">Heard: “{r.heard}”</p>{/if}
				</div>
			</div>
			{#if settled}
				<button class="btn wide" onclick={() => quest.next()}>Next phrase<Icon name="next" size={18} color="#fff" /></button>
			{/if}
		{:else}
			<p class="prompt">Listen, then hold the mic and say the phrase. {TRIES} tries per phrase.</p>
		{/if}
	{/if}
</div>

<div class="dock">
	<HoldMic
		bind:recording
		hint={settled ? 'Tap Next to carry on' : quest.tries ? 'Hold and try again' : 'Hold and say the phrase'}
		disabled={!card || quest.checking || settled || (game.energy < 1 && !game.unlimited)}
		onrecord={(b) => quest.attempt(b)}
	/>
</div>

{#if reviewOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (reviewOpen = false)}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Review earlier phrases">
		<div class="grabber"></div>
		<h3>Review earlier phrases</h3>
		<p class="fine">Reviews don't count toward the next level. Tap a phrase to hear it.</p>
		<button class="btn wide" onclick={() => review(null)}>Review everything ({p.learned.length})</button>
		{#each quest.learnedByLevel as lv (lv.level)}
			<div class="lv">
				<div class="lv-head">
					<b>Level {lv.level}</b><small>{lv.cards.length} phrase{lv.cards.length === 1 ? '' : 's'}</small>
					<button class="btn ghost small" onclick={() => review(lv.level)}>Review level {lv.level}</button>
				</div>
				<div class="lv-list">
					{#each lv.cards as c (c.id)}
						<button class="lv-item" onclick={() => app.play(c.text, { botId: tutor.id, locale: quest.locale })}>
							<span dir="auto">{c.text}</span><small>{c.meaning}</small>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if quest.levelUp}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Level up">
		<div class="card up">
			<div class="burst" aria-hidden="true"><Icon name="sparkles" size={40} color="#fff" /></div>
			<p class="eyebrow">Level up!</p>
			<h2>Level {quest.levelUp}</h2>
			<p>
				{p.learned.length} {tutor.language} phrases learned. First a quick review of earlier phrases, then new, harder ones.
			</p>
			<button class="btn wide" onclick={() => (quest.levelUp = null)}>Keep going</button>
		</div>
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
	.level {
		padding: 5px 10px;
		border-radius: 999px;
		background: linear-gradient(130deg, #7c3aed, #316ccd);
		color: #fff;
		font-weight: 750;
		font-size: 14px;
	}
	.review-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		border: 1px solid var(--se-border);
		border-radius: 999px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		font-size: 13px;
		font-weight: 650;
		cursor: pointer;
	}
	.review-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.opposite {
		margin-top: 10px;
		border-radius: 12px;
		border: 1px dashed color-mix(in srgb, var(--se-primary-2) 50%, transparent);
	}
	.opposite summary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		list-style: none;
		color: var(--se-muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.opposite summary::-webkit-details-marker {
		display: none;
	}
	/* A chevron that turns when open. */
	.opposite summary::after {
		content: '';
		width: 6px;
		height: 6px;
		margin-left: auto;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(45deg);
		transition: transform 0.15s;
	}
	.opposite[open] summary::after {
		transform: rotate(-135deg);
	}
	.opposite summary .queued {
		text-transform: none;
		letter-spacing: 0;
	}
	.opp-body {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 10px 8px;
	}
	.opp-body > span {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 6px;
	}
	.opposite em {
		color: var(--se-muted);
		font-size: 13px;
		font-style: normal;
	}
	.queued {
		color: var(--se-good);
		font-size: 13px;
		font-weight: 700;
	}
	.btn.small {
		padding: 7px 11px;
		border-radius: 10px;
		font-size: 13px;
		white-space: nowrap;
	}
	.fine {
		margin: -4px 0 12px;
		color: var(--se-muted);
		font-size: 13px;
	}
	.lv {
		margin-top: 14px;
	}
	.lv-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.lv-head small {
		flex: 1;
		color: var(--se-muted);
	}
	.lv-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.lv-item {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 10px;
		border: none;
		border-radius: 10px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.lv-item small {
		color: var(--se-muted);
		text-align: end;
	}
	.progress {
		display: flex;
		gap: 4px;
		padding: 8px 14px 0;
	}
	.progress i {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: var(--se-surface-2);
		transition: background 0.3s;
	}
	.progress i.on {
		background: var(--se-grad);
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding: 14px;
	}
	.state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		height: 100%;
		color: var(--se-muted);
		text-align: center;
	}
	.spinner {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 3px solid var(--se-surface-2);
		border-top-color: var(--se-primary-2);
		animation: spin 0.8s linear infinite;
	}
	.spinner.small {
		width: 22px;
		height: 22px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.phrase {
		padding: 18px;
		border-radius: 22px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
	}
	.phrase.review {
		border-color: #a78bfa;
	}
	.tag {
		margin: 0 0 6px;
		color: var(--se-primary-2);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.review .tag {
		color: #a78bfa;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		line-height: 1.25;
		font-weight: 800;
	}
	.roman {
		margin: 4px 0 0;
		font-size: 16px;
		color: var(--se-text);
		opacity: 0.85;
	}
	.meaning {
		margin: 6px 0 0;
		color: var(--se-muted);
		font-size: 15px;
	}
	.say {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 14px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--se-surface-2);
	}
	.say > div:first-child {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.label {
		color: var(--se-muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.sounds {
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.02em;
		overflow-wrap: anywhere;
	}
	.ipa {
		color: var(--se-muted);
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
		font-size: 14px;
	}
	.listen {
		display: flex;
		gap: 4px;
	}
	.listen .icon-btn.hear {
		background: var(--se-surface);
	}
	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
		font-size: 14px;
	}
	ul {
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	li {
		display: flex;
		flex-direction: column;
		padding: 8px 10px;
		border-radius: 12px;
		background: var(--se-surface-2);
		border: 1px solid transparent;
	}
	li.weak {
		border-color: #d97706;
	}
	.like {
		font-size: 13px;
		color: var(--se-primary-2);
	}
	.how {
		font-size: 13px;
		color: var(--se-muted);
		line-height: 1.45;
	}
	.prompt {
		margin: 14px 4px 0;
		color: var(--se-muted);
		font-size: 14px;
		text-align: center;
	}
	.result {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		margin-top: 14px;
		padding: 14px;
		border-radius: 18px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		color: var(--se-muted);
		animation: se-pop 0.18s ease-out;
	}
	.result.pass {
		border-color: color-mix(in srgb, var(--se-good) 60%, transparent);
		background: color-mix(in srgb, var(--se-good) 10%, var(--se-surface));
	}
	.result.fail {
		border-color: rgba(217, 119, 6, 0.5);
	}
	.result p {
		margin: 0 0 4px;
	}
	.score {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--se-surface-2);
		color: var(--se-text);
	}
	.pass .score {
		background: var(--se-good);
		color: #fff;
	}
	.score b {
		font-size: 22px;
		line-height: 1;
	}
	.score small {
		font-size: 10px;
		opacity: 0.8;
	}
	.verdict {
		flex: 1;
		min-width: 0;
		color: var(--se-text);
		font-size: 14px;
	}
	.big {
		font-size: 17px;
		font-weight: 750;
	}
	.xp {
		display: inline-block;
		margin-left: 6px;
		padding: 2px 8px;
		border-radius: 999px;
		background: linear-gradient(135deg, #7c3aed, #316ccd);
		color: #fff;
		font-size: 12px;
		vertical-align: middle;
	}
	.combo {
		color: #f97316;
		font-weight: 700;
	}
	.words {
		font-size: 17px;
		font-weight: 650;
	}
	.heard {
		color: var(--se-muted);
		font-size: 13px;
	}
	.wide {
		width: 100%;
		margin-top: 12px;
	}
	.dock {
		flex: none;
		padding: 10px 0 14px;
		border-top: 1px solid var(--se-border);
		background: color-mix(in srgb, var(--se-surface) 70%, transparent);
	}
	.up {
		text-align: center;
	}
	.burst {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		margin: 0 auto 10px;
		border-radius: 50%;
		background: linear-gradient(130deg, #7c3aed, #316ccd 55%, #1db1fd);
		box-shadow: 0 0 0 10px rgba(124, 58, 237, 0.15);
		animation: se-pop 0.3s ease-out;
	}
	.eyebrow {
		margin: 0;
		color: #a78bfa;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.up h2 {
		margin: 2px 0 8px;
		font-size: 30px;
	}
	.up p {
		color: var(--se-muted);
		line-height: 1.5;
	}
</style>
