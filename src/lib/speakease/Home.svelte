<!-- SpeakEase home: the player's level, XP, energy, badges and streak; today's goals; Phrase Quest
     and the dictionary; favourite and all languages (one friend each); scenarios (with stars); and
     settings (theme, translation language). -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import LangIcon from './LangIcon.svelte';
	import { app, load, store, type ThemeSetting } from './app.svelte';
	import { sideways } from './sideways';
	import { quest } from './quest.svelte';
	import { BADGES, ENERGY_MAX, countdown, game, starsFor } from './game.svelte';
	import { FRIENDS, SCENARIOS, TRANSLATE_OPTIONS, type Friend } from './data';

	/** `signedIn`: the games need an account (opening one signed out asks to sign in). */
	let {
		onopen,
		back = '/?node=proj-speakease',
		signedIn = false
	}: { onopen: (screen: 'chat' | 'practice' | 'phrases' | 'dictionary', id: string) => void; back?: string; signedIn?: boolean } = $props();

	let settingsOpen = $state(false);
	let questPicker = $state(false);
	let badgesOpen = $state(false);
	let scenePicker = $state(false);
	/** Today's goals folded up (remembered on this device). */
	let goalsOpen = $state(load('goals-open', true));
	function toggleGoals() {
		goalsOpen = !goalsOpen;
		store('goals-open', goalsOpen);
	}
	const sceneStars = $derived(SCENARIOS.reduce((n, sc) => n + starsFor(game.saved.scenes[sc.id] ?? 0), 0));

	const rank = $derived(game.rank);
	// Out of energy: the countdown to tomorrow's refill ticks every second.
	$effect(() => {
		if (game.energy >= 1) return;
		const t = setInterval(() => game.tick(), 1000);
		return () => clearInterval(t);
	});

	const favorites = $derived(app.favorites.map((id) => FRIENDS.find((f) => f.id === id)!).filter(Boolean));
	const goals = $derived(app.goals);
	const goalsDone = $derived(goals.filter((g) => g.done >= g.target).length);
	const streak = $derived(app.streakNow);

	const THEMES: { id: ThemeSetting; label: string; icon: 'auto' | 'sun' | 'moon' }[] = [
		{ id: 'system', label: 'System', icon: 'auto' },
		{ id: 'light', label: 'Light', icon: 'sun' },
		{ id: 'dark', label: 'Dark', icon: 'moon' }
	];

	function openGoal(g: (typeof goals)[number]) {
		if (g.go.kind === 'chat') onopen('chat', g.go.id);
		else onopen('phrases', g.go.locale);
	}
	function startQuest(f: Friend) {
		questPicker = false;
		onopen('phrases', f.locale);
	}
	const lastQuest = $derived(FRIENDS.find((f) => f.locale === quest.locale) ?? FRIENDS[0]);
</script>

<header class="bar">
	<a class="icon-btn" href={back} aria-label={back === '/' ? "Back to Edward Ng's site" : "Back to SpeakEase AI on Edward Ng's site"}><Icon name="back" size={22} /></a>
	<span class="brand"><img src="/images/speakease/icon.png" alt="" width="24" height="24" />SpeakEase</span>
	<span class="streak" class:lit={app.practisedToday} title={app.practisedToday ? 'Practised today' : streak ? 'Practise today to keep your streak' : 'Practise today to start a streak'}>
		<Icon name="flame" size={18} />{streak}
	</span>
	<button class="icon-btn" onclick={() => (settingsOpen = true)} aria-label="Settings"><Icon name="settings" size={22} /></button>
</header>

<div class="scroll">
	<section class="hello">
		<Avatar look="easso" size={56} name="Easso" />
		<div>
			<h1>Hello {app.nickname ?? 'friend'}!</h1>
			<p>
				{#if app.practisedToday}You've practised today. Keep it going!
				{:else if streak}Practise today to keep your {streak}-day streak.
				{:else}Pick a friend and start talking.{/if}
			</p>
		</div>
	</section>

	<section class="panel player">
		<div class="rank">
			<span class="lvl"><small>Lv</small>{rank.level}</span>
			<div class="rank-main">
				<div class="rank-row"><b>{rank.title}</b><span class="muted">{rank.into}/{rank.step} XP</span></div>
				<span class="bar-track xp"><span class="bar-fill" style="width: {(rank.into / rank.step) * 100}%"></span></span>
			</div>
		</div>
		<div class="stats">
			<div class="stat energy" title="Phrase Quest tries and scenario lines use energy. It fills back up each day.">
				<Icon name="bolt" size={18} />
				<span><b>{game.energy}</b>/{ENERGY_MAX}</span>
				<small>{game.energy >= ENERGY_MAX ? 'Full' : game.energy < 1 ? `Refills in ${countdown(game.nextEnergyIn)}` : 'Refills tomorrow'}</small>
			</div>
			<div class="stat flame" title="Days in a row you've practised">
				<Icon name="flame" size={18} />
				<span><b>{streak}</b> day{streak === 1 ? '' : 's'}</span>
				<small>Best {app.streak.best}</small>
			</div>
			<button class="stat medals" onclick={() => (badgesOpen = true)}>
				<Icon name="medal" size={18} />
				<span><b>{game.badgeCount}</b>/{BADGES.length}</span>
				<small>Badges</small>
			</button>
		</div>
	</section>

	<section class="panel goals">
		<button class="panel-head toggle" onclick={toggleGoals} aria-expanded={goalsOpen} aria-controls="goals-list">
			<h2>Today's goals</h2>
			<span class="muted">{goalsDone}/{goals.length} done</span>
			<span class="chev" class:open={goalsOpen} aria-hidden="true">
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</span>
		</button>
		{#if !goalsOpen}
			<span class="bar-track overall" aria-hidden="true">
				<span class="bar-fill" style="width: {(goals.reduce((n, g) => n + Math.min(1, g.done / g.target), 0) / Math.max(1, goals.length)) * 100}%"></span>
			</span>
		{/if}
		<div id="goals-list" hidden={!goalsOpen}>
		{#each goals as g (g.id)}
			{@const done = g.done >= g.target}
			<button class="goal" class:done onclick={() => openGoal(g)}>
				<span class="tick" aria-hidden="true">{#if done}<Icon name="check" size={22} />{/if}</span>
				<span class="goal-main">
					<span class="goal-text">{g.text}</span>
					<span class="bar-track"><span class="bar-fill" style="width: {(g.done / g.target) * 100}%"></span></span>
				</span>
				<span class="goal-count">{g.done}/{g.target}{g.id === 'minutes' ? ' min' : ''}<em class="reward">{done ? 'Done' : '+30 XP'}</em></span>
			</button>
		{/each}
		{#if !favorites.length}
			<p class="hint">Star a language below and your goals will be about it.</p>
		{/if}
		</div>
	</section>

	<button class="quest" onclick={() => (signedIn ? (questPicker = true) : onopen('phrases', ''))}>
		<span class="quest-icon"><Icon name="sparkles" size={26} color="#fff" /></span>
		<span class="quest-text">
			<strong>Phrase Quest</strong>
			<small>Learn new phrases, how to say them, and level up</small>
		</span>
		{#if signedIn}
			<span class="quest-level">{lastQuest.language}<br /><b>Lv {quest.levelOf(lastQuest.locale)}</b></span>
		{:else}
			<span class="locked">🔒 Sign in</span>
		{/if}
	</button>

	<button class="tile" onclick={() => (signedIn ? (scenePicker = true) : onopen('practice', ''))}>
		<span class="tile-icon scenes"><Icon name="play" size={22} color="#fff" /></span>
		<span class="quest-text"><strong>Scenarios</strong><small>Role-play everyday life and travel · {sceneStars}/{SCENARIOS.length * 3} ★</small></span>
		{#if signedIn}<Icon name="next" size={18} />{:else}<span class="locked">🔒 Sign in</span>{/if}
	</button>

	<button class="tile" onclick={() => onopen('dictionary', '')}>
		<span class="tile-icon"><Icon name="book" size={22} color="#fff" /></span>
		<span class="quest-text"><strong>Dictionary</strong><small>Look up a word and hear how it's said</small></span>
		{#if signedIn}<Icon name="next" size={18} />{:else}<span class="locked">🔒 Sign in</span>{/if}
	</button>

	<h2 class="section">Favorite Languages</h2>
	<div class="row hscroll" data-swipe-ignore use:sideways>
		{#each favorites as f (f.id)}
			<div class="fav">
				<LangIcon locale={f.locale} size={52} label={f.language} />
				<p><b>{f.language}</b><span>with {f.name}</span></p>
				<button class="btn fav-start" onclick={() => onopen('chat', f.id)}>Start</button>
				<button class="link" onclick={() => app.toggleFavorite(f.id)}>Remove from Favorites</button>
			</div>
		{:else}
			<div class="fav empty">Tap the ☆ on a language to add it here.</div>
		{/each}
	</div>

	<h2 class="section">All Languages</h2>
	<div class="grid">
		{#each FRIENDS as f (f.id)}
			{@const fav = app.favorites.includes(f.id)}
			<div class="lang">
				<button class="lang-main" onclick={() => onopen('chat', f.id)} aria-label="Practise {f.language} with {f.name}">
					<LangIcon locale={f.locale} size={44} label={f.language} />
					<span><b>{f.language}</b><small>with {f.name}</small></span>
				</button>
				<button class="star" class:on={fav} onclick={() => app.toggleFavorite(f.id)} aria-pressed={fav} aria-label={fav ? `Remove ${f.language} from favorites` : `Add ${f.language} to favorites`}>
					<Icon name={fav ? 'star' : 'star-outline'} size={20} />
				</button>
			</div>
		{/each}
	</div>

</div>

{#if settingsOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (settingsOpen = false)}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Settings">
		<div class="grabber"></div>
		<h3>Appearance</h3>
		<div class="seg" role="radiogroup" aria-label="Theme">
			{#each THEMES as t (t.id)}
				<button role="radio" aria-checked={app.themeSetting === t.id} class:on={app.themeSetting === t.id} onclick={() => app.setTheme(t.id)}>
					<Icon name={t.icon} size={18} />{t.label}
				</button>
			{/each}
		</div>
		<h3>Translate messages to</h3>
		<div class="chip-row">
			{#each TRANSLATE_OPTIONS as o (o.lang)}
				<button class="chip" class:on={app.translateTo === o.lang} onclick={() => app.setTranslate(o.lang)}>{o.label}</button>
			{/each}
		</div>
		<p class="fine">Chats are kept on this device for 30 days.</p>
		<button class="btn wide" onclick={() => (settingsOpen = false)}>Done</button>
	</div>
{/if}

{#if badgesOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (badgesOpen = false)}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Badges">
		<div class="grabber"></div>
		<h3>Badges · {game.badgeCount} of {BADGES.length}</h3>
		<div class="badges">
			{#each BADGES as b (b.id)}
				{@const won = game.saved.badges[b.id]}
				<div class="badge" class:locked={!won}>
					<span class="medal" style="--c: {b.color}">{won ? b.mark : '?'}</span>
					<b>{b.name}</b>
					<small>{b.about}</small>
				</div>
			{/each}
		</div>
		<button class="btn wide" onclick={() => (badgesOpen = false)}>Done</button>
	</div>
{/if}

{#if scenePicker}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (scenePicker = false)}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Choose a scenario">
		<div class="grabber"></div>
		<h3>Which scenario would you like to practise?</h3>
		<p class="fine top">Pick a language next. Each line uses 1 energy; finish a scenario for +40 XP and a star.</p>
		{#each ['Everyday', 'Travel'] as group (group)}
			<p class="group">{group}</p>
			<div class="grid">
				{#each SCENARIOS.filter((x) => x.group === group) as sc (sc.id)}
					{@const stars = starsFor(game.saved.scenes[sc.id] ?? 0)}
					<button class="scene" onclick={() => ((scenePicker = false), onopen('practice', sc.id))}>
						<span class="scene-icon" aria-hidden="true">{sc.icon}</span>
						<span>
							<b>{sc.name}</b><small>{sc.role}</small>
							<span class="stars" aria-label="{stars} of 3 stars">{#each [1, 2, 3] as n (n)}<i class:on={n <= stars}>★</i>{/each}</span>
						</span>
					</button>
				{/each}
			</div>
		{/each}
	</div>
{/if}

{#if questPicker}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (questPicker = false)}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Choose a language for Phrase Quest">
		<div class="grabber"></div>
		<h3>Which language would you like to learn?</h3>
		<div class="grid">
			{#each FRIENDS as f (f.id)}
				<button class="lang-main pick" class:on={quest.locale === f.locale} onclick={() => startQuest(f)}>
					<LangIcon locale={f.locale} size={36} label={f.language} />
					<span><b>{f.language}</b><small>Level {quest.levelOf(f.locale)}</small></span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.brand {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 17px;
	}
	.brand img {
		border-radius: 7px;
	}
	.streak {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px 5px 8px;
		border-radius: 999px;
		background: var(--se-surface-2);
		color: var(--se-muted);
		font-weight: 700;
		font-size: 14px;
	}
	.streak.lit {
		background: linear-gradient(135deg, #f97316, #facc15);
		color: #fff;
	}
	.scroll {
		flex: 1;
		overflow-y: auto;
		padding: 16px 16px 28px;
		scrollbar-width: none;
	}
	.scroll::-webkit-scrollbar {
		display: none;
	}
	.hello {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}
	.hello :global(.avatar) {
		box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.5);
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.hello p {
		margin: 2px 0 0;
		color: var(--se-muted);
		font-size: 14px;
	}
	.panel {
		padding: 14px;
		border-radius: 20px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
	}
	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.panel-head.toggle {
		align-items: center;
		gap: 8px;
		width: 100%;
		margin: 0;
		padding: 2px 0;
		border: none;
		background: none;
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.panel-head.toggle h2 {
		flex: 1;
	}
	.chev {
		display: grid;
		place-items: center;
		color: var(--se-muted);
		transform: rotate(-90deg);
		transition: transform 0.2s ease;
	}
	.chev.open {
		transform: none;
	}
	.overall {
		display: block;
		margin-top: 10px;
	}
	#goals-list {
		margin-top: 4px;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 750;
	}
	.muted {
		color: var(--se-muted);
		font-size: 13px;
	}
	.goal {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin-top: 6px;
		padding: 10px;
		border: none;
		border-radius: 14px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.goal:hover {
		filter: brightness(1.05);
	}
	.tick {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid var(--se-border);
		color: var(--se-good);
	}
	.goal.done .tick {
		border: none;
	}
	.goal-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.goal-text {
		font-size: 14px;
		font-weight: 600;
	}
	.goal.done .goal-text {
		color: var(--se-muted);
		text-decoration: line-through;
	}
	.bar-track {
		height: 6px;
		border-radius: 3px;
		background: var(--se-border);
		overflow: hidden;
	}
	.bar-fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--se-grad);
		transition: width 0.4s ease;
	}
	.goal.done .bar-fill {
		background: var(--se-good);
	}
	.goal-count {
		flex: none;
		color: var(--se-muted);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.hint,
	.fine {
		margin: 10px 2px 0;
		color: var(--se-muted);
		font-size: 13px;
	}
	.quest {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: 16px 0 6px;
		padding: 14px;
		border: none;
		border-radius: 20px;
		background:
			radial-gradient(120% 140% at 0% 0%, rgba(255, 255, 255, 0.18), transparent 50%),
			linear-gradient(130deg, #7c3aed, #316ccd 55%, #1db1fd);
		color: #fff;
		font: inherit;
		text-align: left;
		cursor: pointer;
		box-shadow: 0 14px 30px -16px rgba(124, 58, 237, 0.9);
		transition: transform 0.15s ease;
	}
	.quest:hover {
		transform: translateY(-1px);
	}
	.quest-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.18);
	}
	.quest-text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.quest-text strong {
		font-size: 17px;
	}
	.quest-text small {
		opacity: 0.85;
		font-size: 13px;
	}
	.quest-level {
		flex: none;
		text-align: right;
		font-size: 12px;
		opacity: 0.9;
	}
	.quest-level b {
		font-size: 16px;
	}
	.section {
		margin: 20px 2px 10px;
	}
	.row {
		display: flex;
		gap: 12px;
		scroll-snap-type: x mandatory;
		margin: 0 -16px;
		padding: 0 16px 6px;
	}
	.fav {
		flex: none;
		width: 200px;
		scroll-snap-align: start;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px 14px 12px;
		border-radius: 20px;
		background: var(--se-grad);
		color: #fff;
		text-align: center;
		box-shadow: 0 12px 26px -16px rgba(29, 177, 253, 0.9);
	}
	.fav :global(.avatar) {
		border: 3px solid rgba(255, 255, 255, 0.8);
	}
	.fav p {
		margin: 0;
		display: flex;
		flex-direction: column;
		font-size: 13px;
	}
	.fav p b {
		font-size: 17px;
	}
	.fav .btn.fav-start {
		width: 100%;
		background: #fff;
		color: #316ccd;
	}
	.fav .link {
		border: none;
		background: none;
		color: rgba(255, 255, 255, 0.85);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.fav.empty {
		width: 100%;
		justify-content: center;
		min-height: 90px;
		background: var(--se-surface);
		border: 1px dashed var(--se-border);
		color: var(--se-muted);
		font-size: 14px;
		box-shadow: none;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.lang {
		position: relative;
		display: flex;
		border-radius: 16px;
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
	}
	.lang-main,
	.scene {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		padding: 10px;
		border: none;
		border-radius: 16px;
		background: none;
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.lang-main > span,
	.scene > span {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.lang-main b,
	.scene b {
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lang-main small,
	.scene small {
		color: var(--se-muted);
		font-size: 12px;
	}
	.lang-main:hover,
	.scene:hover {
		background: var(--se-surface-2);
	}
	.lang .lang-main {
		padding-right: 30px;
	}
	.star {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--se-muted);
		cursor: pointer;
	}
	.star.on {
		color: #f5b301;
	}
	.scene {
		background: var(--se-surface);
		border: 1px solid var(--se-border);
		box-shadow: var(--se-shadow);
	}
	h3 {
		margin: 14px 0 10px;
		font-size: 15px;
	}
	.seg {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: 14px;
		background: var(--se-surface-2);
	}
	.seg button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--se-muted);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
	}
	.seg button.on {
		background: var(--se-surface);
		color: var(--se-text);
		font-weight: 650;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.wide {
		width: 100%;
		margin-top: 16px;
	}
	.player {
		margin-bottom: 12px;
	}
	.rank {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.lvl {
		flex: none;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: linear-gradient(130deg, #7c3aed, #316ccd 60%, #1db1fd);
		color: #fff;
		font-size: 20px;
		font-weight: 800;
		line-height: 1;
	}
	.lvl small {
		font-size: 10px;
		font-weight: 700;
		opacity: 0.85;
	}
	.rank-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.rank-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.xp {
		height: 8px;
	}
	.xp .bar-fill {
		background: linear-gradient(90deg, #7c3aed, #1db1fd);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 12px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 8px 4px;
		border: none;
		border-radius: 14px;
		background: var(--se-surface-2);
		color: var(--se-text);
		font: inherit;
		font-size: 13px;
	}
	.stat small {
		color: var(--se-muted);
		font-size: 11px;
	}
	.stat b {
		font-size: 16px;
	}
	.energy :global(svg) {
		color: #eab308;
	}
	.flame :global(svg) {
		color: #f97316;
	}
	.medals {
		cursor: pointer;
	}
	.medals :global(svg) {
		color: #a78bfa;
	}
	.reward {
		display: block;
		color: #a78bfa;
		font-size: 11px;
		font-style: normal;
		font-weight: 700;
		text-align: right;
	}
	.tile {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: 10px 0 6px;
		padding: 12px 14px;
		border: 1px solid var(--se-border);
		border-radius: 20px;
		background: var(--se-surface);
		color: var(--se-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		box-shadow: var(--se-shadow);
	}
	.locked {
		flex: none;
		padding: 4px 9px;
		border-radius: 999px;
		background: var(--se-surface-2);
		color: var(--se-muted);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}
	.quest .locked {
		background: rgba(255, 255, 255, 0.22);
		color: #fff;
	}
	.tile:hover {
		background: var(--se-surface-2);
	}
	.scene-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 30%;
		background: var(--se-surface-2);
		font-size: 22px;
	}
	.tile-icon.scenes {
		background: linear-gradient(135deg, #f59e0b, #ef4444);
	}
	.group {
		margin: 14px 2px 8px;
		color: var(--se-muted);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.fine.top {
		margin-top: -4px;
	}
	.tile-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 13px;
		background: linear-gradient(135deg, #14b8a6, #0ea5e9);
	}
	.tile .quest-text small {
		color: var(--se-muted);
		opacity: 1;
	}
	.stars {
		display: flex;
		gap: 1px;
		margin-top: 2px;
		font-size: 12px;
		font-style: normal;
	}
	.stars i {
		font-style: normal;
		color: var(--se-border);
	}
	.stars i.on {
		color: #f5b301;
	}
	.badges {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		border-radius: 14px;
		background: var(--se-surface-2);
		text-align: center;
	}
	.badge b {
		font-size: 12px;
	}
	.badge small {
		color: var(--se-muted);
		font-size: 11px;
		line-height: 1.3;
	}
	.medal {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 55%, #fff), var(--c));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent);
		color: #fff;
		font-weight: 800;
		font-size: 13px;
	}
	.badge.locked .medal {
		background: var(--se-border);
		box-shadow: none;
		color: var(--se-muted);
	}
	.badge.locked b {
		color: var(--se-muted);
	}
	.pick {
		border: 1px solid var(--se-border);
		background: var(--se-surface-2);
	}
	.pick.on {
		border-color: var(--se-primary-2);
	}
</style>
