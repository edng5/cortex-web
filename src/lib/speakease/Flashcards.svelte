<!-- Flash Cards: vocabulary by category. Choose a category, then rounds of cards: what a word
     means, which word means something, matching pairs, and picking every word that fits. Every word
     can be heard and shows how to say it; after each card, every word on it shows its translation.
     Hearts, combos, XP, stars and levels make it a game. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import { CATEGORIES, HEARTS, ROUND, flash, perLevel, type Word } from './flash.svelte';

	let { onback }: { onback: () => void } = $props();

	const tutor = $derived(flash.tutor);
	const card = $derived(flash.card);
	const a = $derived(flash.answered);
	const p = $derived(flash.progress);
	const stars = $derived(flash.roundRight >= ROUND - 1 ? 3 : flash.roundRight >= 5 ? 2 : flash.roundRight >= 3 ? 1 : 0);
	const isRight = (w: Word) => !!card?.correct.includes(w.word);
	const chosen = (w: Word) => !!a?.chosen.includes(w.word);
</script>

{#snippet hear(w: Word, small = false)}
	<!-- (Its own button inside a card button: hearing a word doesn't answer with it.) -->
	<span
		class="hear"
		class:small
		role="button"
		tabindex="0"
		aria-label="Hear {w.word}"
		title="Hear it"
		onclick={(e) => (e.stopPropagation(), flash.say(w))}
		onkeydown={(e) => (e.key == 'Enter' || e.key == ' ') && (e.preventDefault(), e.stopPropagation(), flash.say(w))}
	><Icon name="volume" size={small ? 16 : 20} /></span>
{/snippet}

{#snippet sayIt(w: Word)}
	<!-- How to say it: the reading (other scripts), a sound-it-out spelling, and the IPA. -->
	{#if w.romanization}<span class="roman">{w.romanization}</span>{/if}
	{#if w.sounds}<span class="sounds">{w.sounds}</span>{/if}
	{#if w.ipa}<span class="ipa">/{w.ipa.replace(/^\/|\/$/g, '')}/</span>{/if}
{/snippet}

<header class="bar">
	<button class="icon-btn" onclick={() => (flash.category ? flash.leaveCategory() : onback())} aria-label={flash.category ? 'Back to the categories' : 'Back to home'}><Icon name="back" size={22} /></button>
	<Avatar look={tutor.persona} size={38} name={tutor.name} />
	<span class="who"><b>Flash Cards</b><small>{flash.category ? `${flash.category.emoji} ${flash.category.name}` : `${tutor.language} with ${tutor.name}`}</small></span>
	{#if flash.category}
		<span class="hearts" aria-label="{flash.hearts} of {HEARTS} hearts left">
			{#each Array(HEARTS) as _, i (i)}<i class:lost={i >= flash.hearts}>{i < flash.hearts ? '❤️' : '🤍'}</i>{/each}
		</span>
		<span class="level">Lv {p.level}</span>
	{/if}
</header>

{#if flash.category && !flash.summary && flash.round.length}
	<div class="progress" aria-label="Card {flash.index + 1} of {flash.round.length}">
		{#each flash.round as _, i (i)}<i class:on={i < flash.index || (i == flash.index && !!a)} class:now={i == flash.index && !a}></i>{/each}
	</div>
{/if}

<div class="body">
	{#if !flash.category}
		<!-- Choosing a category. -->
		<p class="intro">Pick a topic. Easy everyday words first; level up for harder ones.</p>
		<div class="cats">
			{#each CATEGORIES as c (c.id)}
				<button class="cat" onclick={() => flash.play(c)}>
					<span class="cat-emoji" aria-hidden="true">{c.emoji}</span>
					<b>{c.name}</b>
					<small>Level {flash.levelOf(c.id)}{flash.learnedIn(c.id) ? ` · ${flash.learnedIn(c.id)} words` : ''}</small>
				</button>
			{/each}
		</div>
	{:else if flash.loading}
		<div class="state">
			<div class="deck" aria-hidden="true"><i></i><i></i><i></i></div>
			<p>Shuffling {flash.category.name.toLowerCase()} cards…</p>
		</div>
	{:else if flash.error}
		<div class="state">
			<p>{flash.error}</p>
			<button class="btn" onclick={() => flash.deal()}><Icon name="retry" size={18} color="#fff" />Try again</button>
		</div>
	{:else if flash.summary}
		<!-- The round's over. -->
		<div class="summary">
			{#if flash.levelUp}
				<div class="burst" aria-hidden="true">⬆️</div>
				<p class="eyebrow">Level up!</p>
				<h2>{flash.category.name} level {flash.levelUp}</h2>
				<p class="fine">Harder words from here on.</p>
			{:else if flash.hearts <= 0}
				<div class="burst sad" aria-hidden="true">💔</div>
				<p class="eyebrow">Out of hearts</p>
				<h2>So close!</h2>
			{:else}
				<p class="eyebrow">Round complete</p>
				<h2>{flash.roundRight == flash.round.length ? 'Perfect!' : flash.roundRight >= 5 ? 'Nice work!' : 'Keep going!'}</h2>
			{/if}
			<div class="stars" aria-label="{stars} of 3 stars">
				{#each [0, 1, 2] as i (i)}<span class:on={i < stars} style="animation-delay:{i * 0.15}s">★</span>{/each}
			</div>
			<p class="tally"><b>{flash.roundRight}</b> of {flash.round.length} right · <b>+{flash.roundXp} XP</b></p>
			<div class="lvbar" aria-label="{p.right} of {perLevel(p.level)} to level {p.level + 1}">
				<span>Lv {p.level}</span>
				<i><b style="width:{(p.right / perLevel(p.level)) * 100}%"></b></i>
				<span>{p.right}/{perLevel(p.level)}</span>
			</div>
			<button class="btn wide" onclick={() => flash.deal()}>Next round<Icon name="next" size={18} color="#fff" /></button>
			<button class="btn ghost wide" onclick={() => flash.leaveCategory()}>Other categories</button>
		</div>
	{:else if card}
		{#key card.id}
			<div class="card" class:review={card.review}>
				{#if card.review}<p class="tag">Review</p>{/if}

				{#if card.type == 'mc' && card.target}
					<!-- What does this mean? -->
					<p class="ask">What does this mean?</p>
					<div class="target">
						<div class="tword">
							<h1>{card.target.word}</h1>
							{@render sayIt(card.target)}
						</div>
						{@render hear(card.target)}
					</div>
					<div class="options">
						{#each card.options as o (o.word)}
							<button class="opt" class:right={a && isRight(o)} class:wrong={a && chosen(o) && !isRight(o)} disabled={!!a} onclick={() => flash.choose(o)}>
								<span class="main">{o.meaning}</span>
								{#if a}
									<!-- Each answer's word, and how it sounds. -->
									<span class="reveal">{o.emoji} {o.word}{#if o.romanization} · {o.romanization}{/if}</span>
									{@render hear(o, true)}
								{/if}
							</button>
						{/each}
					</div>
				{:else if card.type == 'pick' && card.target}
					<!-- Which word means this? -->
					<p class="ask">Which word means…</p>
					<div class="target meaning">
						{#if card.target.emoji}<span class="emoji" aria-hidden="true">{card.target.emoji}</span>{/if}
						<h1>{card.target.meaning}</h1>
					</div>
					<div class="options">
						{#each card.options as o (o.word)}
							<button class="opt word" class:right={a && isRight(o)} class:wrong={a && chosen(o) && !isRight(o)} disabled={!!a} onclick={() => flash.choose(o)}>
								<span class="main">{o.word}</span>
								<span class="phon">{#if o.romanization}{o.romanization} · {/if}{o.sounds}</span>
								{#if a}<span class="reveal">= {o.meaning}</span>{/if}
								{@render hear(o, true)}
							</button>
						{/each}
					</div>
				{:else if card.type == 'match'}
					<!-- Pair each word with its meaning. -->
					<p class="ask">Match each word to its meaning</p>
					<div class="match">
						<div class="col">
							{#each card.options as o (o.word)}
								<button class="opt word" class:done={flash.matched.includes(o.word)} class:picked={flash.matchPick == o.word} disabled={!!a || flash.matched.includes(o.word)} onclick={() => flash.pickLeft(o)}>
									<span class="main">{o.word}</span>
									<span class="phon">{#if o.romanization}{o.romanization} · {/if}{o.sounds}</span>
									<!-- Matched (or the card's done): its meaning beside it. -->
									{#if a || flash.matched.includes(o.word)}<span class="reveal">= {o.emoji} {o.meaning}</span>{/if}
									{@render hear(o, true)}
								</button>
							{/each}
						</div>
						<div class="col">
							{#each flash.matchRight as o (o.word)}
								<button class="opt" class:done={flash.matched.includes(o.word)} class:wrong={flash.matchWrong == o.word} disabled={!!a || flash.matched.includes(o.word) || !flash.matchPick} onclick={() => flash.pickRight(o)}>
									<span class="main">{o.emoji} {o.meaning}</span>
								</button>
							{/each}
						</div>
					</div>
					{#if !a}<p class="fine">{flash.matchPick ? 'Now tap its meaning.' : 'Tap a word, then its meaning.'}{flash.mistakes ? ` · ${flash.mistakes} miss${flash.mistakes == 1 ? '' : 'es'}` : ''}</p>{/if}
				{:else if card.type == 'multi'}
					<!-- Pick every word in the category. -->
					<p class="ask">Tap every word that's <b>{flash.category.name.toLowerCase()}</b></p>
					<div class="options grid">
						{#each card.options as o (o.word)}
							<button class="opt word" class:on={flash.selected.includes(o.word)} class:right={a && isRight(o)} class:wrong={a && chosen(o) && !isRight(o)} class:missed={a && isRight(o) && !chosen(o)} disabled={!!a} onclick={() => flash.toggle(o)} aria-pressed={flash.selected.includes(o.word)}>
								<span class="tick" aria-hidden="true">{flash.selected.includes(o.word) ? '✓' : ''}</span>
								<span class="main">{o.word}</span>
								<span class="phon">{#if o.romanization}{o.romanization} · {/if}{o.sounds}</span>
								{#if a}<span class="reveal">= {o.emoji} {o.meaning}</span>{/if}
								{@render hear(o, true)}
							</button>
						{/each}
					</div>
					{#if !a}<button class="btn wide" disabled={!flash.selected.length} onclick={() => flash.checkSelected()}>Check</button>{/if}
				{/if}
			</div>
		{/key}

		{#if a}
			<!-- How it went, then on to the next card. -->
			<div class="verdict" class:right={a.right}>
				<span class="v-icon" aria-hidden="true">{a.right ? '🎉' : '😅'}</span>
				<div class="v-text">
					<b>{a.right ? (flash.combo >= 3 ? `${flash.combo} in a row!` : 'Correct!') : card.type == 'match' ? 'Too many misses' : 'Not quite'}</b>
					{#if a.right}
						<small>+{a.xp} XP{flash.combo >= 2 ? ` · combo x${flash.combo}` : ''}</small>
					{:else if card.target}
						<small>{card.target.word} = {card.target.meaning}</small>
					{:else}
						<small>Lost a heart · the answers are marked</small>
					{/if}
				</div>
				<button class="btn" onclick={() => flash.next()}>{flash.hearts <= 0 || flash.index + 1 >= flash.round.length ? 'See results' : 'Continue'}<Icon name="next" size={18} color="#fff" /></button>
			</div>
		{/if}
	{/if}
</div>

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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.level {
		padding: 5px 10px;
		border-radius: 999px;
		background: linear-gradient(130deg, #0ea5e9, #6366f1);
		color: #fff;
		font-weight: 750;
		font-size: 14px;
	}
	.hearts {
		display: inline-flex;
		gap: 1px;
		font-size: 15px;
	}
	.hearts i {
		font-style: normal;
		transition: transform 0.25s;
	}
	.hearts i.lost {
		animation: heart-lost 0.4s ease-out;
	}
	@keyframes heart-lost {
		40% {
			transform: scale(1.5) rotate(-12deg);
		}
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
	.progress i.now {
		background: color-mix(in srgb, var(--se-primary-2) 45%, var(--se-surface-2));
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding: 14px;
	}
	.intro {
		margin: 0 0 12px;
		color: var(--se-muted);
		font-size: 14px;
	}
	/* Categories. */
	.cats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}
	.cat {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 14px;
		border: 1px solid var(--se-border);
		border-radius: 18px;
		background: var(--se-surface);
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		box-shadow: var(--se-shadow);
		transition:
			transform 0.15s,
			border-color 0.15s;
	}
	.cat:hover {
		transform: translateY(-2px);
		border-color: var(--se-primary-2);
	}
	.cat-emoji {
		font-size: 30px;
		margin-bottom: 4px;
	}
	.cat b {
		font-size: 15px;
	}
	.cat small {
		color: var(--se-muted);
		font-size: 12px;
	}
	/* Loading: a little deck being shuffled. */
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
	.deck {
		position: relative;
		width: 70px;
		height: 90px;
	}
	.deck i {
		position: absolute;
		inset: 0;
		border-radius: 10px;
		background: var(--se-grad);
		box-shadow: var(--se-shadow);
		animation: shuffle 1.1s ease-in-out infinite;
	}
	.deck i:nth-child(2) {
		animation-delay: 0.18s;
		opacity: 0.8;
	}
	.deck i:nth-child(3) {
		animation-delay: 0.36s;
		opacity: 0.6;
	}
	@keyframes shuffle {
		0%,
		100% {
			transform: translateX(0) rotate(0);
		}
		50% {
			transform: translateX(22px) rotate(10deg);
		}
	}
	/* A card. */
	.card {
		padding: 16px;
		border-radius: 22px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
		animation: deal 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	@keyframes deal {
		from {
			transform: translateY(14px) rotate(-1.5deg);
			opacity: 0;
		}
	}
	.card.review {
		border-color: #a78bfa;
	}
	.tag {
		margin: 0 0 4px;
		color: #a78bfa;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.ask {
		margin: 0 0 10px;
		color: var(--se-muted);
		font-size: 14px;
		font-weight: 600;
	}
	.ask b {
		color: var(--se-text);
	}
	.target {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		border-radius: 16px;
		background: var(--se-surface-2);
		margin-bottom: 12px;
	}
	.target.meaning {
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}
	.tword {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		line-height: 1.2;
		font-weight: 800;
		overflow-wrap: anywhere;
	}
	.emoji {
		font-size: 44px;
	}
	.roman {
		font-size: 15px;
		opacity: 0.85;
	}
	.sounds {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}
	.ipa {
		color: var(--se-muted);
		font-family: 'Charis SIL', 'Doulos SIL', 'Segoe UI', serif;
		font-size: 13px;
	}
	.hear {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: var(--se-grad);
		color: #fff;
		cursor: pointer;
		box-shadow: 0 4px 14px -6px rgba(49, 108, 205, 0.9);
		transition: transform 0.12s;
	}
	.hear:hover {
		transform: scale(1.08);
	}
	.hear:active {
		transform: scale(0.94);
	}
	.hear.small {
		width: 30px;
		height: 30px;
	}
	/* Answers. */
	.options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.options.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.opt {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 8px;
		padding: 12px 14px;
		border: 2px solid var(--se-border);
		border-radius: 14px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s,
			transform 0.12s;
	}
	.opt:not(:disabled):hover {
		border-color: var(--se-primary-2);
		transform: translateY(-1px);
	}
	.opt:disabled {
		cursor: default;
	}
	.opt .main {
		grid-column: 1;
		font-weight: 700;
		font-size: 16px;
		overflow-wrap: anywhere;
	}
	.opt.word .main {
		font-size: 18px;
	}
	.opt .phon {
		grid-column: 1;
		color: var(--se-muted);
		font-size: 12.5px;
		font-weight: 600;
	}
	.opt .reveal {
		grid-column: 1;
		font-size: 13px;
		font-weight: 600;
		color: var(--se-text);
		opacity: 0.85;
		animation: reveal 0.3s ease-out;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
	}
	.opt .hear {
		grid-column: 2;
		grid-row: 1 / span 3;
	}
	.opt.right {
		border-color: var(--se-good);
		background: color-mix(in srgb, var(--se-good) 16%, var(--se-surface-2));
		animation: right-pop 0.35s ease-out;
	}
	.opt.wrong {
		border-color: #ef4444;
		background: color-mix(in srgb, #ef4444 14%, var(--se-surface-2));
		animation: shake 0.35s;
	}
	.opt.missed {
		border-style: dashed;
		border-color: var(--se-good);
	}
	.opt.on {
		border-color: var(--se-primary-2);
		background: color-mix(in srgb, var(--se-primary-2) 16%, var(--se-surface-2));
	}
	.tick {
		position: absolute;
		top: 6px;
		right: 8px;
		color: var(--se-primary-2);
		font-weight: 900;
	}
	@keyframes right-pop {
		50% {
			transform: scale(1.03);
		}
	}
	@keyframes shake {
		25% {
			transform: translateX(-5px);
		}
		75% {
			transform: translateX(5px);
		}
	}
	/* Matching. */
	.match {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.opt.picked {
		border-color: var(--se-primary-2);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--se-primary-2) 30%, transparent);
	}
	.opt.done {
		border-color: var(--se-good);
		background: color-mix(in srgb, var(--se-good) 14%, var(--se-surface-2));
		opacity: 0.85;
	}
	.fine {
		margin: 10px 0 0;
		color: var(--se-muted);
		font-size: 13px;
		text-align: center;
	}
	/* The verdict. */
	.verdict {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
		padding: 12px 14px;
		border-radius: 18px;
		background: color-mix(in srgb, #ef4444 14%, var(--se-surface));
		border: 1px solid color-mix(in srgb, #ef4444 40%, transparent);
		box-shadow: var(--se-shadow);
		animation: deal 0.25s ease-out;
	}
	.verdict.right {
		background: color-mix(in srgb, var(--se-good) 14%, var(--se-surface));
		border-color: color-mix(in srgb, var(--se-good) 45%, transparent);
	}
	.v-icon {
		font-size: 28px;
	}
	.v-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.v-text small {
		color: var(--se-muted);
		overflow-wrap: anywhere;
	}
	/* The round's summary. */
	.summary {
		max-width: 420px;
		margin: 0 auto;
		text-align: center;
	}
	.burst {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		margin: 6px auto 10px;
		border-radius: 50%;
		font-size: 34px;
		background: linear-gradient(130deg, #0ea5e9, #6366f1);
		box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.15);
		animation: se-pop 0.3s ease-out;
	}
	.burst.sad {
		background: linear-gradient(130deg, #f43f5e, #9f1239);
		box-shadow: 0 0 0 10px rgba(244, 63, 94, 0.15);
	}
	.eyebrow {
		margin: 0;
		color: #818cf8;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.summary h2 {
		margin: 2px 0 6px;
		font-size: 28px;
	}
	.stars {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin: 6px 0;
		font-size: 40px;
	}
	.stars span {
		color: var(--se-surface-2);
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
	}
	.stars span.on {
		color: #fbbf24;
		text-shadow: 0 0 14px rgba(251, 191, 36, 0.6);
		animation: star-in 0.45s cubic-bezier(0.2, 1.8, 0.4, 1) backwards;
	}
	@keyframes star-in {
		from {
			transform: scale(0.2) rotate(-40deg);
			opacity: 0;
		}
	}
	.tally {
		color: var(--se-muted);
	}
	.tally b {
		color: var(--se-text);
	}
	.lvbar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 6px 0 14px;
		font-size: 13px;
		font-weight: 700;
		color: var(--se-muted);
	}
	.lvbar i {
		flex: 1;
		height: 10px;
		border-radius: 5px;
		background: var(--se-surface-2);
		overflow: hidden;
	}
	.lvbar b {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #0ea5e9, #6366f1);
		transition: width 0.6s ease-out;
	}
	.wide {
		width: 100%;
		margin-top: 10px;
	}
	@media (max-width: 420px) {
		.options.grid,
		.match {
			grid-template-columns: 1fr;
		}
		.match {
			grid-template-columns: 1fr 1fr;
		}
		h1 {
			font-size: 26px;
		}
	}
</style>
