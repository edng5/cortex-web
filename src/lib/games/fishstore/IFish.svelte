<!--
  FishMart: run a fish store. Stock sale tanks from daily supplier shipments (a gacha), set up a show
  tank with a pet centrepiece to make the store popular, hire staff to build and clean (timed
  tasks that keep running while you're away), go fishing for rare fish, and show off your best
  fish to everyone. Works with touch and mouse; progress is saved (and synced when signed in).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BAIT_COST,
		COMBINE_COST,
		CRATE_COST,
		CRATE_FISH,
		CRATE_ODDS,
		FLOORS,
		FOOD_COST,
		HOLDING_COST,
		HOLDING_MAX,
		MAX_SHOW_TANKS,
		NEW_SHOW_COST,
		SHELF_CAP,
		SHELF_UPGRADE,
		SUPPLIES,
		OVERGROWN,
		RESTYLE_COST,
		TANK_LIGHTS,
		TANK_SHAPES,
		TANK_STANDS,
		TANK_TRIMS,
		RARITY_COLOR,
		RARITY_LABEL,
		ROLES,
		SHOW_MAX_LEVEL,
		SHOW_UNLOCK,
		SIZE_LABEL,
		SIZE_UNITS,
		SPECIES,
		STORE_DECOR,
		SUPPLIERS,
		TANK_DECOR,
		TANK_TIERS,
		priceOf,
		showUpgradeCost,
		showWidthCm,
		species,
		tier,
		type DecorTag,
		type Species,
		type TankLook,
		type TankShape,
		type TankTier,
		type Temp,
		type Water
	} from './data';
	import { FishStore, SHELF_REF, type Fish, type Loc, type Result, type SaleTank, type ShowTank } from './store.svelte';
	import { gameAudio } from '../audio.svelte';
	import TankCanvas from './TankCanvas.svelte';
	import StoreFloor, { type FloorPick } from './StoreFloor.svelte';
	import Fishing from './Fishing.svelte';
	import FishIcon from './FishIcon.svelte';
	import type { GameUiProps } from '../registry';
	import { session } from '$lib/session.svelte';

	let { active, onquit, loggedIn }: GameUiProps = $props();

	const store = new FishStore();
	// Development only: a handle for testing from the browser console.
	if (import.meta.env.DEV) (window as unknown as { ifish: FishStore }).ifish = store;
	const s = $derived(store.s);
	const sfx = (n: string) => gameAudio.play('ifish', n);

	type Tab = 'store' | 'show' | 'backroom' | 'ship' | 'fish' | 'staff' | 'showcase';
	const TABS: { id: Tab; icon: string; label: string }[] = [
		{ id: 'store', icon: '🏪', label: 'Store' },
		{ id: 'show', icon: '⭐', label: 'Show tank' },
		{ id: 'backroom', icon: '📦', label: 'Backroom' },
		{ id: 'ship', icon: '🚚', label: 'Shipments' },
		{ id: 'fish', icon: '🎣', label: 'Fishing' },
		{ id: 'staff', icon: '🧑‍🔧', label: 'Staff' },
		{ id: 'showcase', icon: '🌍', label: 'Market' }
	];
	let tab = $state<Tab>('store');
	let picked = $state<FloorPick>(null);
	let layout = $state(false);
	let showId = $state<number>(store.s.show[0].id);
	let note = $state('');
	let toasts = $state<{ id: number; text: string }[]>([]);
	let toastSeq = 0;

	// Dialogs.
	let naming = $state<null | { kind: 'store' | 'fish'; uid?: number; value: string; error: string; busy: boolean }>(null);
	let moving = $state<null | { uid: number; from: Loc }>(null);
	let adding = $state<null | Loc>(null);
	let crate = $state<null | { fish: Fish[]; gems: number; open: number }>(null);
	let building = $state(false);
	let decorFor = $state<number | null>(null);
	let combining = $state(false);
	let choosingCenter = $state(false);
	let sellDecor = $state<number | null>(null);
	let buildWater = $state<Water>('fresh');
	let buildTemp = $state<Temp>('tropical');
	let buildShape = $state<TankShape>('rect');
	// The show tank's pop-out panels.
	type Panel = 'stats' | 'fish' | 'pet' | 'style' | 'tank' | 'new';
	let panel = $state<Panel | null>(null);
	// "Are you sure?" before changing a tank, listing the rare fish it holds and where they'll go.
	let confirmAsk = $state<null | { title: string; body: string; fish: Fish[]; yes: string; run: () => unknown; leaving?: boolean }>(null);
	function ask(q: NonNullable<typeof confirmAsk>) {
		confirmAsk = q;
		sfx('click');
	}
	function askRestyle(t: ShowTank, change: Partial<TankLook>) {
		const cur = store.lookOf(t);
		if (!change.shape || change.shape === cur.shape) return act(store.restyle(t.id, change), 'coin');
		const sh = TANK_SHAPES.find((x) => x.id === change.shape)!;
		ask({
			title: `Refit as a ${sh.name.toLowerCase()} tank?`,
			body: `Costs ${money(Math.max(150, sh.cost) * t.seg)}. It holds the same number of fish, and all ${t.fish.length} of them stay in the tank.`,
			fish: t.fish,
			yes: 'Refit',
			run: () => act(store.restyle(t.id, change), 'coin')
		});
	}
	const rareFish = (fs: Fish[]) => fs.filter((f) => RARITY_ORDER(f) >= 2);
	let showcase = $state<{ store: string; species: string; fishName: string | null; bond: number; mine?: boolean }[] | null>(null);
	let showcaseMsg = $state('');

	/** FishMart needs an account (your store lives in it): close the game and open the login. */
	function login() {
		onquit();
		session.loginOpen = true;
	}

	onMount(() => {
		if (!loggedIn) return;
		if (!store.s.named) naming = { kind: 'store', value: '', error: '', busy: false };
		const tick = setInterval(() => store.advance(), 1000);
		const save = setInterval(() => store.save(), 15_000);
		return () => {
			clearInterval(tick);
			clearInterval(save);
			store.save();
		};
	});
	// Tasks finishing, sales while away, daily rewards: shown as toasts.
	$effect(() => {
		if (!store.toast.length) return;
		const add = store.toast.map((text) => ({ id: ++toastSeq, text }));
		store.toast = [];
		toasts = [...toasts, ...add].slice(-4);
		sfx('done');
		for (const t of add) setTimeout(() => (toasts = toasts.filter((x) => x.id !== t.id)), 6000);
	});
	$effect(() => {
		if (!active) store.save();
	});

	function act(r: Result | { ok: boolean; msg?: string }, good = 'click') {
		note = r.msg ?? '';
		sfx(r.ok ? good : 'error');
		return r.ok;
	}
	const money = (n: number) => '$' + Math.round(n).toLocaleString();
	const time = (ms: number) => {
		const sec = Math.max(0, Math.ceil(ms / 1000));
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const r = sec % 60;
		return h ? `${h}h ${m}m` : m ? `${m}m ${r}s` : `${r}s`;
	};
	const tankName = (loc: Loc) => {
		if (loc === 'hold') return 'Backroom';
		const t = store.tankAt(loc);
		if (!t) return '?';
		if ('tier' in t) return `${tier(t.tier).name} (${t.water === 'salt' ? 'salt' : t.temp === 'cold' ? 'cold fresh' : 'fresh'}) #${t.id}`;
		return `${t === store.main ? 'Main show tank' : 'Show tank'} #${t.id}`;
	};
	const locs = $derived<Loc[]>(['hold', ...s.sale.map((t) => `sale:${t.id}` as Loc), ...s.show.map((t) => `show:${t.id}` as Loc)]);
	const show = $derived(s.show.find((t) => t.id === showId) ?? s.show[0]);
	const isMain = $derived(show === store.main);
	const pop = $derived(store.popularity());
	const center = $derived(store.centerFish);

	function tapFloor(x: number, y: number) {
		const at = (o: { x: number; y: number }, w: number, h: number) => x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
		const hitSale = s.sale.find((t) => at(t, tier(t.tier).w, 1));
		const hitShow = s.show.find((t) => at(t, Math.min(12, 2 * t.seg), 2));
		const hitDecor = s.decor.find((d) => at(d, 1, 1));
		const hitShelf = at(s.shelf, 2, 1);
		const hit: FloorPick = hitSale ? { kind: 'sale', id: hitSale.id } : hitShow ? { kind: 'show', id: hitShow.id } : hitDecor ? { kind: 'decor', id: hitDecor.id } : hitShelf ? { kind: 'shelf', id: -1 } : null;
		if (layout) {
			if (hit) {
				picked = hit;
				sfx('click');
			} else if (picked) {
				act(picked.kind === 'shelf' ? store.moveShelf(x, y) : store.moveItem(picked.kind, picked.id, x, y));
			}
			return;
		}
		picked = hit;
		if (hit?.kind === 'show') {
			showId = hit.id;
			tab = 'show';
		}
		if (hit?.kind === 'decor') sellDecor = hit.id;
		if (hit) sfx('click');
	}
	const pickedSale = $derived(picked?.kind === 'sale' ? (s.sale.find((t) => t.id === picked!.id) ?? null) : null);

	async function submitName() {
		if (!naming) return;
		const n = naming;
		n.busy = true;
		n.error = '';
		try {
			const res = await fetch('/api/games/ifish/name', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: n.value, kind: n.kind })
			});
			const r = (await res.json()) as { ok: boolean; name?: string; message?: string };
			if (!r.ok || !r.name) {
				n.error = r.message ?? 'That name isn’t allowed.';
				n.busy = false;
				sfx('error');
				return;
			}
			if (n.kind === 'store') store.rename(r.name);
			else if (n.uid) store.setCenter(n.uid, r.name);
			naming = null;
			sfx('done');
		} catch {
			n.error = 'Could not check the name (offline?). Try again later.';
			n.busy = false;
		}
	}

	function openCrate(id: string) {
		const r = store.openCrate(id);
		if (!r.ok) return act(r);
		sfx('crate');
		crate = { fish: r.fish, gems: r.gems, open: 0 };
	}
	function revealNext() {
		if (!crate) return;
		const f = crate.fish[crate.open];
		if (f) sfx(['rare', 'ultra', 'epic', 'legendary', 'mythic'].includes(species(f.s).rarity) ? 'rare' : 'reveal');
		crate.open++;
	}

	// ── The fish market ──
	type Listing = { id: number; store: string; species: string; fishName: string | null; price: number; currency: 'cash' | 'gems'; mine?: boolean };
	let market = $state<Listing[] | null>(null);
	let marketMsg = $state('');
	let marketBusy = $state(false);
	let sellUid = $state<number | null>(null);
	let sellPrice = $state(500);
	let sellCurrency = $state<'cash' | 'gems'>('cash');
	async function marketPost(body: Record<string, unknown>) {
		const r = await fetch('/api/games/ifish/market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; listing?: Listing; listings?: Listing[]; sales?: { species: string; price: number; currency: 'cash' | 'gems' }[] };
		if (j.listings) market = j.listings;
		return { ...j, ok: r.ok && !!j.ok };
	}
	async function loadMarket() {
		try {
			const r = await fetch('/api/games/ifish/market');
			market = ((await r.json()) as { listings: Listing[] }).listings;
			if (loggedIn) {
				// Collect the money from anything that sold while you were away.
				const c = await marketPost({ action: 'claim' });
				for (const sale of c.sales ?? []) {
					store.pay(sale.price, sale.currency, 1);
					toasts = [...toasts, { id: ++toastSeq, text: `Sold your ${species(sale.species).name} on the market for ${sale.currency === 'gems' ? `💎 ${sale.price}` : money(sale.price)}!` }].slice(-4);
					sfx('coin');
				}
			}
		} catch {
			marketMsg = 'Could not reach the market.';
		}
	}
	function listFish() {
		const f = myFish.find((x) => x.u === sellUid);
		if (!f) return;
		const sp = species(f.s);
		const price = Math.round(sellPrice);
		ask({
			title: `Sell your ${f.n ?? sp.name}?`,
			body: `It leaves your store now and goes on the market for ${sellCurrency === 'gems' ? `💎 ${price}` : money(price)}. You can take it back any time until someone buys it.`,
			fish: [f],
			leaving: true,
			yes: 'Put it up for sale',
			run: async () => {
				marketBusy = true;
				marketMsg = '';
				const taken = store.takeForSale(f.u);
				if (!taken.ok) {
					marketBusy = false;
					return act(taken);
				}
				try {
					const r = await marketPost({ action: 'list', store: s.name, species: f.s, fishName: f.n ?? null, price, currency: sellCurrency });
					if (!r.ok) {
						store.receive(f.s, f.n ?? null, true);
						marketMsg = r.message ?? 'Could not list that fish.';
						sfx('error');
					} else {
						marketMsg = `Your ${sp.name} is up for sale.`;
						sellUid = null;
						sfx('coin');
					}
				} catch {
					store.receive(f.s, f.n ?? null, true);
					marketMsg = 'Could not reach the market. Your fish is back in the backroom.';
				}
				marketBusy = false;
			}
		});
	}
	function buyFish(l: Listing) {
		const sp = species(l.species);
		if (!store.canAfford(l.price, l.currency)) return act({ ok: false, msg: `You need ${l.currency === 'gems' ? `💎 ${l.price}` : money(l.price)}.` });
		if (s.hold.length >= store.holdCap()) return act({ ok: false, msg: 'Your backroom is full: make room first.' });
		ask({
			title: `Buy ${l.fishName ?? `a ${sp.name}`}?`,
			body: `From ${l.store} for ${l.currency === 'gems' ? `💎 ${l.price}` : money(l.price)}. It goes to your backroom.`,
			fish: [],
			yes: 'Buy',
			run: async () => {
				marketBusy = true;
				try {
					const r = await marketPost({ action: 'buy', id: l.id });
					if (r.ok) {
						store.pay(l.price, l.currency);
						store.receive(l.species, l.fishName, true);
						marketMsg = `Bought a ${sp.name}! It's in your backroom.`;
						sfx('rare');
					} else {
						marketMsg = r.message ?? 'Could not buy that fish.';
						sfx('error');
					}
				} catch {
					marketMsg = 'Could not reach the market.';
				}
				marketBusy = false;
			}
		});
	}
	async function cancelFish(l: Listing) {
		marketBusy = true;
		try {
			const r = await marketPost({ action: 'cancel', id: l.id });
			if (r.ok) {
				store.receive(l.species, l.fishName, true);
				marketMsg = `Your ${species(l.species).name} is back in the backroom.`;
			} else marketMsg = r.message ?? 'Could not take it back.';
		} catch {
			marketMsg = 'Could not reach the market.';
		}
		marketBusy = false;
	}

	async function loadShowcase() {
		try {
			const r = await fetch('/api/games/ifish/showcase');
			showcase = ((await r.json()) as { entries: typeof showcase }).entries;
		} catch {
			showcaseMsg = 'Could not load the showcase.';
		}
	}
	$effect(() => {
		if (tab === 'showcase' && !showcase) loadShowcase();
		if (tab === 'showcase' && !market) loadMarket();
	});
	/** Every fish you own, rarest first. */
	const myFish = $derived([...s.show.flatMap((t) => t.fish), ...s.sale.flatMap((t) => t.fish), ...s.hold].sort((a, b) => RARITY_ORDER(b) - RARITY_ORDER(a)));
	function RARITY_ORDER(f: Fish) {
		return ['common', 'uncommon', 'rare', 'ultra', 'epic', 'legendary', 'mythic'].indexOf(species(f.s).rarity);
	}
	const sellable = $derived(myFish.filter((f) => RARITY_ORDER(f) >= 2 && f.u !== s.center));
	let showOffUid = $state<number | null>(null);
	async function showOff() {
		const f = myFish.find((x) => x.u === showOffUid) ?? myFish[0];
		if (!f) return;
		showcaseMsg = '';
		try {
			const r = await fetch('/api/games/ifish/showcase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ store: s.name, species: f.s, fishName: f.n, bond: f.u === s.center ? s.pet.bond : 0 })
			});
			const j = (await r.json()) as { ok?: boolean; message?: string; entries?: typeof showcase };
			if (!r.ok || !j.ok) showcaseMsg = j.message ?? 'Could not post that.';
			else {
				showcase = j.entries ?? showcase;
				showcaseMsg = `Showing off your ${species(f.s).name}!`;
				sfx('done');
			}
		} catch {
			showcaseMsg = 'Could not reach the showcase.';
		}
	}

	const tasksFor = (ref: number) => s.tasks.find((t) => t.ref === ref || t.ref2 === ref);
	const decorBeauty = (t: ShowTank) => t.decor.reduce((a, d) => a + TANK_DECOR.find((x) => x.id === d)!.beauty, 0);
	const holdFish = $derived(s.hold);
</script>

{#snippet fishRow(f: Fish, from: Loc)}
	{@const sp = species(f.s)}
	<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
		<FishIcon id={sp.id} size={58} />
		<div class="fi">
			<b>{f.n ? `${f.n} · ` : ''}{sp.name}</b>
			<span class="rar" class:mythic={sp.rarity === 'mythic'}>{RARITY_LABEL[sp.rarity]}</span>
			<span class="chips">
				<span>{sp.water === 'salt' ? '🌊 Salt' : '💧 Fresh'}</span>
				<span>{sp.temp === 'cold' ? '❄️ Cold' : '🔥 Tropical'}</span>
				<span>{SIZE_LABEL[sp.size]} · {sp.cm} cm</span>
				{#if sp.predator}<span class="warn">Predator</span>{/if}
				{#if sp.single}<span class="warn">1 per tank</span>{/if}
				{#if sp.alone}<span class="warn">Alone only</span>{/if}
				{#if sp.cleaner}<span class="good" title="Grazes algae: the tank gets dirty 15% slower (up to 60% with several)">🧽 Clean-up crew</span>{/if}
				{#if f.c >= 12}<span class="good">Well kept ★</span>{/if}
			</span>
			<span class="price">{money(priceOf(sp))}</span>
		</div>
		<div class="fa">
			{#if f.u !== s.center}<button onclick={() => (moving = { uid: f.u, from })}>Move</button>{/if}
			{#if from === 'hold'}<button onclick={() => act(store.wholesale(f.u), 'coin')}>Wholesale</button>{/if}
		</div>
	</li>
{/snippet}

{#snippet bar(label: string, v: number, color = '#4ade80')}
	<div class="bar"><span>{label}</span><i><em style="width: {Math.round(v)}%; background: {v < 30 ? '#f87171' : v < 60 ? '#facc15' : color}"></em></i><b>{Math.round(v)}</b></div>
{/snippet}

{#if !loggedIn}
	<div class="gate">
		<div class="brand big">Fish<span>Mart</span></div>
		<p>Run your own fish store: hundreds of real fish, show tanks, staff, fishing and a market to trade rare fish with other players.</p>
		<p class="muted">Your store is saved to your account, so log in to play.</p>
		<div class="row">
			<button class="primary" onclick={login}>Log in to play</button>
			<button onclick={onquit}>Back</button>
		</div>
	</div>
{:else}
<div class="ifish">
	<header class="top">
		<div class="brand">Fish<span>Mart</span></div>
		<button class="storename" onclick={() => (naming = { kind: 'store', value: s.name, error: '', busy: false })} title="Rename your store">{s.name} ✎</button>
		<div class="stats">
			<span title="Cash">💵 {money(s.cash)}</span>
			<span title="Gems">💎 {s.gems}</span>
			<span title="Popularity">⭐ {pop}</span>
			{#if s.freeCrates}<button class="free" onclick={() => (tab = 'ship')}>🎁 {s.freeCrates} free</button>{/if}
		</div>
		<button class="quit" onclick={() => (store.save(), onquit())}>Exit</button>
	</header>

	<nav class="tabs" aria-label="FishMart sections">
		{#each TABS as t (t.id)}
			<button class:on={tab === t.id} onclick={() => ((tab = t.id), (note = ''), sfx('click'))}>
				<span class="ic">{t.icon}</span><span class="lb">{t.label}</span>
				{#if t.id === 'staff' && s.layoff}<i class="dot"></i>{/if}
			</button>
		{/each}
	</nav>

	<main class="body" class:full={tab === 'show' || tab === 'store'}>
		{#if s.layoff}
			<p class="alert">Payroll is short! Lay off staff (Staff tab) until your cash covers their daily wages.</p>
		{/if}
		{#if note}<p class="note">{note}</p>{/if}

		{#if tab === 'store'}
			<div class="storeview">
			<div class="row">
				<button class="primary" onclick={() => (building = true)}>🔨 Build & buy</button>
				<button class:on={layout} onclick={() => ((layout = !layout), (picked = null))}>{layout ? '✓ Done arranging' : '↔ Layout mode'}</button>
				<span class="muted">{layout ? 'Tap something, then tap where it should go.' : 'Tap a tank or the supply shelf to manage it. ★ = show tank.'}</span>
			</div>
			<div class="floorbox"><StoreFloor {store} {layout} {picked} ontap={tapFloor} /></div>
			<p class="muted small">Popularity {pop}/100 · about {Math.round(store.customersPerHour())} customers an hour · {s.sold} fish sold · {money(s.earned)} earned</p>
			{#if (picked?.kind === 'shelf' && !layout) || pickedSale}
				<div class="pop storepop">
				<button class="x" aria-label="Close" onclick={() => (picked = null)}>✕</button>

			{#if picked?.kind === 'shelf' && !layout}
				{@const task = tasksFor(SHELF_REF)}
				<section class="card">
					<h3>🛒 Supply shelf · level {s.shelf.level}</h3>
					<p class="muted small">Customers buy food and gear here, and your centrepiece's food comes off it too. Keep it stocked! Holds {store.shelfCap()} of each item.</p>
					<ul class="stock">
						{#each SUPPLIES as it (it.id)}
							{@const n = s.stock[it.id]}
							<li class:low={n < store.shelfCap() * 0.2}>
								<span>{it.icon} {it.name}</span>
								<i><em style="width: {Math.round((n / Math.max(1, store.shelfCap())) * 100)}%; background: {it.color}"></em></i>
								<b>{n}/{store.shelfCap()}</b>
								<span class="muted small">sells {money(it.price)}</span>
							</li>
						{/each}
					</ul>
					<div class="row">
						<button class="primary" disabled={!!task} onclick={() => act(store.restock(), 'coin')}>📦 Restock ({money(store.restockCost())})</button>
						{#if s.shelf.level < SHELF_CAP.length - 1}<button onclick={() => act(store.upgradeShelf(), 'coin')}>⬆ Bigger shelf ({money(SHELF_UPGRADE[s.shelf.level])})</button>{/if}
					</div>
					{#if task}<p class="muted small">{task.label}: {time(task.end - store.now)} left</p>{/if}
					<p class="muted small">{s.suppliesSold} supplies sold so far.</p>
				</section>
			{/if}
			{#if pickedSale}
				{@const t = pickedSale}
				{@const task = tasksFor(t.id)}
				<section class="card">
					<h3>{tier(t.tier).name} · {tier(t.tier).gallons} gal · {t.water === 'salt' ? 'Saltwater' : t.temp === 'cold' ? 'Coldwater fresh' : 'Tropical fresh'}</h3>
					{#if !t.ready}
						<p>Being set up{task ? `: ${time(task.end - store.now)} left` : '…'}</p>
					{:else}
						<TankCanvas fish={t.fish} water={t.water} clean={t.clean} widthCm={tier(t.tier).cm} height={150} decor={['gravel']} />
						{@render bar('Clean', t.clean, '#38bdf8')}
						<p class="muted small">Space {store.used(t)}/{store.capOf(t)} · fish up to {SIZE_LABEL[store.maxSizeOf(t)]} · customers buy from here{#if store.cleaners(t.fish)} · 🧽 crew: algae {Math.round((1 - store.dirtRate(t.fish)) * 100)}% slower{/if}</p>
						<div class="row">
							<button onclick={() => (adding = `sale:${t.id}`)}>➕ Stock fish</button>
							<button disabled={!!task} onclick={() => act(store.clean(`sale:${t.id}`))}>🧽 Clean</button>
							{#if t.tier !== 'giant'}<button disabled={!!task} onclick={() => ask({ title: 'Upgrade this sale tank?', body: `Costs ${money(store.upgradeCost(t.id))}. Your fish stay in it while it's upgraded.`, fish: t.fish, yes: 'Upgrade', run: () => act(store.upgradeTank(t.id)) })}>⬆ Upgrade ({money(store.upgradeCost(t.id))})</button>{/if}
							{#if !t.fish.length}
								<button onclick={() => ask({ title: `Switch to ${t.water === 'salt' ? 'fresh' : 'salt'}water?`, body: 'Only fish for the new water can be stocked here afterwards.', fish: [], yes: 'Switch', run: () => act(store.setWater(`sale:${t.id}`, t.water === 'salt' ? 'fresh' : 'salt', 'tropical')) })}>Switch to {t.water === 'salt' ? 'fresh' : 'salt'}</button>
								{#if t.water === 'fresh'}<button onclick={() => act(store.setWater(`sale:${t.id}`, 'fresh', t.temp === 'cold' ? 'tropical' : 'cold'))}>Make {t.temp === 'cold' ? 'tropical' : 'coldwater'}</button>{/if}
								<button class="danger" onclick={() => ask({ title: 'Sell this tank?', body: 'You get some of its cost back. It is empty, so no fish are affected.', fish: [], yes: 'Sell', run: () => (act(store.sellTank(t.id), 'coin'), (picked = null)) })}>Sell tank</button>
							{/if}
						</div>
						{#if task}<p class="muted small">{task.label}: {time(task.end - store.now)} left</p>{/if}
						<ul class="list">{#each t.fish as f (f.u)}{@render fishRow(f, `sale:${t.id}`)}{/each}</ul>
					{/if}
				</section>
			{/if}
				</div>
			{/if}
			</div>
		{:else if tab === 'show'}
			{@const task = tasksFor(show.id)}
			{@const lk = store.lookOf(show)}
			{@const plants = show.decor.includes('plants')}
			<div class="stage">
				{#if show.ready}
					<TankCanvas fish={show.fish} decor={show.decor} water={show.water} clean={show.clean} widthCm={showWidthCm(store.capOf(show))} center={isMain ? s.center : null} happy={s.pet.happy} height={0} look={lk} growth={show.growth ?? 30} stand />
				{:else}
					<div class="building">
						<span>🏗️</span>
						<p>Under construction{task ? `: ${time(task.end - store.now)} left` : '…'}</p>
					</div>
				{/if}

				<!-- Which tank, and a few glanceable meters. -->
				<div class="hud tl">
					{#if s.show.length > 1}
						{#each s.show as t (t.id)}
							<button class:on={t.id === show.id} onclick={() => ((showId = t.id), (panel = null))} title={t === store.main ? 'Main show tank' : `Show tank #${t.id}`}>{t === store.main ? '★' : '#' + t.id}</button>
						{/each}
					{:else}
						<span class="tname">★ {isMain ? 'Main show tank' : 'Show tank'} · Lv {show.level}</span>
					{/if}
				</div>
				{#if show.ready}
					<div class="hud tr">
						<span title="Niceness">✨ {Math.round(store.niceness(show))}</span>
						<span title="Clean" class:low={show.clean < 40}>🫧 {Math.round(show.clean)}</span>
						{#if plants}<span title="Plant growth" class:low={store.overgrown(show)}>🌿 {Math.round(show.growth ?? 30)}</span>{/if}
						<span title="Space used">🐟 {store.used(show)}/{store.capOf(show)}</span>
						{#if isMain && center}<span title="Centrepiece happiness" class:low={s.pet.happy < 40}>💗 {Math.round(s.pet.happy)}</span>{/if}
					</div>
				{/if}
				{#if task}<div class="taskpill">⏳ {task.label} · {time(task.end - store.now)}</div>{/if}
				{#if show.ready && store.overgrown(show) && !task}<button class="nudge" onclick={() => act(store.trim(show.id))}>✂️ The plants are overgrown: trim them</button>{/if}

				<!-- Icon toolbar: each pops out a panel over the tank. -->
				<nav class="tools" aria-label="Show tank tools">
					{#each [['stats', '📊', 'Stats'], ['fish', '🐠', 'Fish'], ...(isMain ? [['pet', '💗', 'Centrepiece']] : []), ['style', '🎨', 'Style'], ['tank', '⬆️', 'Tank'], ['new', '🏗️', 'New show tank']] as [id, ic, label] (id)}
						<button class:on={panel === id} title={label} aria-label={label} onclick={() => ((panel = panel === id ? null : (id as Panel)), sfx('click'))}>{ic}</button>
					{/each}
					<hr />
					<button title="Add fish" aria-label="Add fish" disabled={!show.ready} onclick={() => (adding = `show:${show.id}`)}>➕</button>
					<button title="Decorate" aria-label="Decorate" disabled={!show.ready} onclick={() => (decorFor = show.id)}>🪸</button>
					<button title="Clean" aria-label="Clean" disabled={!show.ready || !!task} onclick={() => act(store.clean(`show:${show.id}`))}>🧽</button>
					{#if plants}<button title="Trim plants" aria-label="Trim plants" disabled={!!task} onclick={() => act(store.trim(show.id))}>✂️</button>{/if}
					{#if isMain && center}<button title="Feed (uses fish food)" aria-label="Feed" onclick={() => act(store.feed(), 'feed')}>🍤</button>{/if}
				</nav>

				{#if panel}
					<div class="pop">
						<button class="x" aria-label="Close" onclick={() => (panel = null)}>✕</button>
						{#if panel === 'stats'}
							<h3>{isMain ? 'Main show tank' : `Show tank #${show.id}`}</h3>
							<p class="muted small">Level {show.level}{show.seg > 1 ? ` · ${show.seg} tanks combined` : ''} · {show.water === 'salt' ? 'Saltwater' : show.temp === 'cold' ? 'Coldwater' : 'Tropical fresh'} · {TANK_SHAPES.find((x) => x.id === lk.shape)?.name}</p>
							{@render bar('Niceness', store.niceness(show), '#fbbf24')}
							{@render bar('Clean', show.clean, '#38bdf8')}
							{#if plants}{@render bar('Plants', show.growth ?? 30, '#4ade80')}{/if}
							<p class="muted small">
								Space {store.used(show)}/{store.capOf(show)} · fits up to {SIZE_LABEL[store.maxSizeOf(show)]} fish · decorations {show.decor.length}/{store.decorSlots(show)} (beauty {decorBeauty(show)}) · show fish aren't sold{#if store.cleaners(show.fish)} · 🧽 crew: algae {Math.round((1 - store.dirtRate(show.fish)) * 100)}% slower{/if}
							</p>
							{#if plants}<p class="muted small">🌿 Live plants grow every hour (faster under a bright light). Lush plants add niceness; past {OVERGROWN}% they're overgrown and look messy until trimmed.</p>{/if}
						{:else if panel === 'fish'}
							<h3>Fish · {show.fish.length}</h3>
							<ul class="list">{#each show.fish as f (f.u)}{@render fishRow(f, `show:${show.id}`)}{/each}</ul>
							{#if !show.fish.length}<p class="muted">No fish yet.</p>{/if}
							<button onclick={() => (adding = `show:${show.id}`)}>➕ Add fish</button>
						{:else if panel === 'pet'}
							{#if center}
								{@const sp = species(center.s)}
								<h3>{center.n ?? sp.name}{#if center.n}<span class="muted small"> the {sp.name}</span>{/if}</h3>
								<button class="link" onclick={() => (naming = { kind: 'fish', uid: center.u, value: center.n ?? '', error: '', busy: false })}>rename</button>
								{@render bar('Fed', s.pet.hunger, '#4ade80')}
								{@render bar('Happy', s.pet.happy, '#f472b6')}
								{@render bar('Bond', s.pet.bond, '#a78bfa')}
								<p class="muted small">Likes: {sp.likes.map((l) => TANK_DECOR.find((d) => d.id === l)?.name).join(', ')} ({Math.round(store.decorMatch() * 100)}% in the tank) · fish food on the shelf: {s.stock.food}</p>
								<div class="row">
									<button onclick={() => act(store.feed(), 'feed')}>🍤 Feed (1 fish food)</button>
									<button onclick={() => act(store.play(), 'splash')}>👆 Play</button>
									<button onclick={() => (choosingCenter = true)}>Change</button>
								</div>
							{:else}
								<h3>Centrepiece</h3>
								<p class="small">Pick a fish from this tank to look after like a pet. Keep it fed, its water clean and its favourite decorations in, and its happiness makes the whole store more popular.</p>
								<button class="primary" disabled={!show.fish.length} onclick={() => (choosingCenter = true)}>Choose centrepiece</button>
							{/if}
						{:else if panel === 'style'}
							<h3>Style this tank</h3>
							<h4>Glass shape</h4>
							<div class="shapes">
								{#each TANK_SHAPES as sh (sh.id)}
									<button class:on={lk.shape === sh.id} onclick={() => askRestyle(show, { shape: sh.id })}>
										<b>{sh.name}</b>
										<span class="small muted">{sh.blurb}</span>
										<span class="small">{lk.shape === sh.id ? 'Current' : money(Math.max(150, sh.cost) * show.seg)}{sh.beauty ? ` · +${sh.beauty} niceness` : ''}</span>
									</button>
								{/each}
							</div>
							<h4>Trim · {money(RESTYLE_COST)}</h4>
							<div class="swatches">
								{#each TANK_TRIMS as x (x.id)}<button class:on={lk.trim === x.id} style="--sw: {x.color}" title={x.name} aria-label={x.name} onclick={() => act(store.restyle(show.id, { trim: x.id }), 'coin')}></button>{/each}
							</div>
							<h4>Stand · {money(RESTYLE_COST)}</h4>
							<div class="swatches">
								{#each TANK_STANDS as x (x.id)}<button class:on={lk.stand === x.id} style="--sw: {x.color}" title={x.name} aria-label={x.name} onclick={() => act(store.restyle(show.id, { stand: x.id }), 'coin')}></button>{/each}
							</div>
							<h4>Lights · {money(RESTYLE_COST)}</h4>
							<div class="row">
								{#each TANK_LIGHTS as x (x.id)}<button class:on={lk.light === x.id} onclick={() => act(store.restyle(show.id, { light: x.id }), 'coin')}>{x.name}</button>{/each}
							</div>
						{:else if panel === 'tank'}
							<h3>Tank</h3>
							<p class="muted small">Level {show.level} of {SHOW_MAX_LEVEL}. Bigger tanks hold more and bigger fish.</p>
							<div class="row">
								{#if show.level < SHOW_MAX_LEVEL}
									<button disabled={!!task} onclick={() => ask({ title: `Upgrade to level ${show.level + 1}?`, body: `Costs ${money(showUpgradeCost(show.level) * show.seg)}. Your fish stay in the tank while it's upgraded.`, fish: show.fish, yes: 'Upgrade', run: () => act(store.upgradeShow(show.id)) })}>⬆ Level {show.level + 1} ({money(showUpgradeCost(show.level) * show.seg)})</button>
								{/if}
								{#if s.show.length > 1}<button disabled={!!task} onclick={() => (combining = true)}>🔗 Combine with another</button>{/if}
							</div>
							{#if !show.fish.length}
								<h4>Water</h4>
								<div class="row">
									<button onclick={() => ask({ title: `Switch to ${show.water === 'salt' ? 'fresh' : 'salt'}water?`, body: 'Decorations that only suit the old water are removed.', fish: [], yes: 'Switch', run: () => act(store.setWater(`show:${show.id}`, show.water === 'salt' ? 'fresh' : 'salt', 'tropical')) })}>Switch to {show.water === 'salt' ? 'fresh' : 'salt'}</button>
									{#if show.water === 'fresh'}<button onclick={() => ask({ title: `Make it ${show.temp === 'cold' ? 'tropical' : 'coldwater'}?`, body: 'Only fish for that temperature can live here afterwards.', fish: [], yes: 'Change', run: () => act(store.setWater(`show:${show.id}`, 'fresh', show.temp === 'cold' ? 'tropical' : 'cold')) })}>Make {show.temp === 'cold' ? 'tropical' : 'coldwater'}</button>{/if}
								</div>
							{:else}
								<p class="muted small">Move the fish out to change the water type.</p>
							{/if}
						{:else if panel === 'new'}
							<h3>New show tank</h3>
							<p class="muted small">Used {store.showSlotsUsed()}/{Math.min(MAX_SHOW_TANKS, store.showSlotsUnlocked())} (max {MAX_SHOW_TANKS}). More unlock at main tank levels {SHOW_UNLOCK.slice(1).join(', ')}. Combine show tanks to house giants like the Zebra Shark.</p>
							<div class="row">
								<select bind:value={buildWater}><option value="fresh">Freshwater</option><option value="salt">Saltwater</option></select>
								{#if buildWater === 'fresh'}<select bind:value={buildTemp}><option value="tropical">Tropical</option><option value="cold">Coldwater</option></select>{/if}
							</div>
							<div class="shapes">
								{#each TANK_SHAPES as sh (sh.id)}
									<button class:on={buildShape === sh.id} onclick={() => (buildShape = sh.id)}>
										<b>{sh.name}</b>
										<span class="small muted">{sh.blurb}</span>
										<span class="small">{money(NEW_SHOW_COST + sh.cost)}</span>
									</button>
								{/each}
							</div>
							<button class="primary" onclick={() => act(store.buildShow(buildWater, buildWater === 'salt' ? 'tropical' : buildTemp, buildShape)) && (panel = null)}>Build ({money(NEW_SHOW_COST + (TANK_SHAPES.find((x) => x.id === buildShape)?.cost ?? 0))})</button>
						{/if}
					</div>
				{/if}
			</div>
		{:else if tab === 'backroom'}
			<section class="card">
				<h3>Backroom · {holdFish.length}/{s.holdCap}</h3>
				<p class="muted small">New fish wait here. Stock them in sale tanks (customers buy them), show them off in a show tank, or sell to a wholesaler for 40% of their price.</p>
				{#if s.holdCap < HOLDING_MAX}<button onclick={() => act(store.buyHolding())}>More shelving +5 ({money(HOLDING_COST)})</button>{/if}
				<ul class="list">{#each holdFish as f (f.u)}{@render fishRow(f, 'hold')}{/each}</ul>
				{#if !holdFish.length}<p class="muted">Empty. Open a shipment or go fishing!</p>{/if}
			</section>
		{:else if tab === 'ship'}
			<section class="card">
				<h3>Daily shipments</h3>
				<p class="muted small">Each crate holds {CRATE_FISH} fish for {money(CRATE_COST)} (you get a free crate every day: {s.freeCrates} waiting). Some crates hide 💎 gems. Odds: {CRATE_ODDS.map(([r, p]) => `${RARITY_LABEL[r]} ${p}%`).join(' · ')}. Legendary and Mythic fish can only be caught.</p>
				<div class="suppliers">
					{#each SUPPLIERS as sup (sup.id)}
						<div class="sup">
							<b>{sup.name}</b>
							<span class="muted small">{sup.blurb}</span>
							<button class="primary" onclick={() => openCrate(sup.id)}>{s.freeCrates ? '🎁 Open free crate' : `Open crate (${money(CRATE_COST)})`}</button>
						</div>
					{/each}
				</div>
			</section>
		{:else if tab === 'fish'}
			<Fishing {store} {sfx} active={active && tab === 'fish'} />
			<p class="muted small">Bait {money(BAIT_COST)} a cast. Catches go to your backroom.</p>
		{:else if tab === 'staff'}
			<section class="card">
				<h3>Staff · wages {money(store.wages())}/day</h3>
				<p class="muted small">Each employee works one task at a time (building, upgrading, cleaning); faster staff finish sooner. Wages are paid each day. You always keep at least one employee.</p>
				<ul class="list">
					{#each s.staff as p (p.id)}
						{@const r = store.role(p.role)}
						{@const busy = s.tasks.find((t) => t.staff === p.id)}
						<li class="staff">
							<span class="av">{p.name[0]}</span>
							<div class="fi"><b>{p.name}</b><span class="muted small">{r.name} · speed ×{r.speed} · {money(r.wage)}/day</span>{#if busy}<span class="small">🔧 {busy.label} · {time(busy.end - store.now)}</span>{:else}<span class="small good">Free</span>{/if}</div>
							<button class="danger" disabled={s.staff.length <= 1} onclick={() => act(store.layoff(p.id))}>Lay off</button>
						</li>
					{/each}
				</ul>
				<div class="row">
					{#each ROLES as r (r.id)}
						<button onclick={() => act(store.hire(r.id))}>Hire {r.name} ({money(r.hire)}, {money(r.wage)}/day)</button>
					{/each}
				</div>
			</section>
			<section class="card">
				<h3>Tasks</h3>
				{#if !s.tasks.length}<p class="muted">Nothing in progress.</p>{/if}
				<ul class="list">
					{#each s.tasks as t (t.id)}
						<li class="task">
							<div class="fi">
								<b>{t.label}</b>
								<span class="muted small">{s.staff.find((p) => p.id === t.staff)?.name ?? '?'} · {time(t.end - store.now)} left</span>
								<i class="prog"><em style="width: {Math.min(100, ((store.now - t.start) / (t.end - t.start)) * 100)}%"></em></i>
							</div>
							<button class="gem" onclick={() => act(store.rush(t.id), 'done')}>Finish now 💎{store.gemsToFinish(t)}</button>
						</li>
					{/each}
				</ul>
			</section>
			<section class="card">
				<h3>Store log</h3>
				<p class="muted small">Daily streak: {s.streak} day{s.streak === 1 ? '' : 's'}. Come back each day for cash and a free crate.</p>
				<ul class="log">{#each s.log as l, i (i)}<li>{l}</li>{/each}</ul>
				<button class="danger small" onclick={() => confirm('Start a brand new store? Everything will be lost.') && (store.reset(), (showId = store.s.show[0].id))}>Start over</button>
			</section>
		{:else if tab === 'showcase'}
			<section class="card">
				<h3>🌍 Global showcase</h3>
				<p class="muted small">Every store can show off one fish. Rarest first.</p>
				{#if loggedIn}
					<div class="row">
						<select bind:value={showOffUid}>
							<option value={null}>My rarest fish</option>
							{#each myFish as f (f.u)}<option value={f.u}>{f.n ? `${f.n} (${species(f.s).name})` : species(f.s).name} · {RARITY_LABEL[species(f.s).rarity]}</option>{/each}
						</select>
						<button class="primary" disabled={!myFish.length} onclick={showOff}>Show it off</button>
					</div>
				{:else}
					<p>Log in to show off your fish to everyone.</p>
				{/if}
				{#if showcaseMsg}<p class="note">{showcaseMsg}</p>{/if}
				<ul class="list">
					{#each showcase ?? [] as e, i (i)}
						{@const sp = species(e.species)}
						<li class="fish" class:mine={e.mine} style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={58} />
							<div class="fi"><b>{e.fishName ? `${e.fishName} · ` : ''}{sp.name}</b><span class="rar" class:mythic={sp.rarity === 'mythic'}>{RARITY_LABEL[sp.rarity]}</span><span class="muted small">at {e.store}{e.bond ? ` · bond ${e.bond}` : ''}</span></div>
						</li>
					{/each}
				</ul>
				{#if showcase && !showcase.length}<p class="muted">Nobody has shown off a fish yet. Be the first!</p>{/if}
			</section>
			<section class="card">
				<h3>🛒 Fish market</h3>
				<p class="muted small">Sell your rare (or rarer) fish to other players for cash or gems, at your price. A listed fish leaves your store; if it sells, you collect the money next time you're here. Bought fish arrive in your backroom.</p>
				{#if loggedIn}
					<div class="row">
						<select bind:value={sellUid}>
							<option value={null}>Pick a fish to sell…</option>
							{#each sellable as f (f.u)}<option value={f.u}>{f.n ? `${f.n} (${species(f.s).name})` : species(f.s).name} · {RARITY_LABEL[species(f.s).rarity]}</option>{/each}
						</select>
						<input class="price" type="number" min="1" bind:value={sellPrice} aria-label="Price" />
						<select bind:value={sellCurrency} aria-label="Currency"><option value="cash">💵 cash</option><option value="gems">💎 gems</option></select>
						<button class="primary" disabled={sellUid === null || !(sellPrice >= 1) || marketBusy} onclick={listFish}>Sell</button>
					</div>
					{#if sellUid !== null}
						{@const f = myFish.find((x) => x.u === sellUid)}
						{#if f}<p class="muted small">Store price {money(priceOf(species(f.s)))} · wholesale would pay {money(priceOf(species(f.s)) * 0.4)}.</p>{/if}
					{/if}
					{#if sellUid !== null && sellCurrency === 'cash'}
						{@const f = myFish.find((x) => x.u === sellUid)}
						{#if f && sellPrice < priceOf(species(f.s)) * 0.5}<p class="small warnline">That's well under its store price.</p>{/if}
					{/if}
					{#if !sellable.length}<p class="muted small">You have no rare fish to sell yet. Catch some or open shipments!</p>{/if}
				{:else}
					<p>Log in to buy and sell fish.</p>
				{/if}
				{#if marketMsg}<p class="note">{marketMsg}</p>{/if}
				<ul class="list">
					{#each market ?? [] as l (l.id)}
						{@const sp = species(l.species)}
						<li class="fish" class:mine={l.mine} style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={58} />
							<div class="fi">
								<b>{l.fishName ? `${l.fishName} · ` : ''}{sp.name}</b>
								<span class="rar" class:mythic={sp.rarity === 'mythic'}>{RARITY_LABEL[sp.rarity]}</span>
								<span class="muted small">from {l.store}{l.mine ? ' (yours)' : ''}</span>
								<span class="price">{l.currency === 'gems' ? `💎 ${l.price.toLocaleString()}` : money(l.price)}</span>
							</div>
							<div class="fa">
								{#if l.mine}
									<button disabled={marketBusy} onclick={() => cancelFish(l)}>Take back</button>
								{:else if loggedIn}
									<button class="primary" disabled={marketBusy || !store.canAfford(l.price, l.currency)} onclick={() => buyFish(l)}>Buy</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				{#if market && !market.length}<p class="muted">Nothing for sale right now.</p>{/if}
			</section>
		{/if}
	</main>

	<div class="toasts" aria-live="polite">
		{#each toasts as t (t.id)}<p>{t.text}</p>{/each}
	</div>

	<!-- ── Dialogs ── -->
	{#if naming}
		<div class="modal">
			<form
				class="dlg"
				onsubmit={(e) => {
					e.preventDefault();
					submitName();
				}}
			>
				<h3>{naming.kind === 'store' ? (s.named ? 'Rename your store' : 'Welcome to FishMart! Name your store') : 'Name your centrepiece'}</h3>
				<input bind:value={naming.value} maxlength={naming.kind === 'store' ? 24 : 16} placeholder={naming.kind === 'store' ? 'e.g. Reef Haven' : 'e.g. Bubbles'} />
				{#if naming.error}<p class="err">{naming.error}</p>{:else}<p class="muted small">Shown publicly in the showcase, so keep it friendly. Offensive names are rejected.</p>{/if}
				<div class="row">
					<button class="primary" type="submit" disabled={naming.busy || naming.value.trim().length < 2}>{naming.busy ? 'Checking…' : 'Save'}</button>
					<button type="button" onclick={() => (naming = null)}>{s.named || naming.kind === 'fish' ? 'Cancel' : 'Later'}</button>
				</div>
			</form>
		</div>
	{/if}

	{#if moving}
		{@const m = moving}
		{@const f = store.fishAt(m.from).find((x) => x.u === m.uid)}
		<div class="modal">
			<div class="dlg">
				<h3>Move {f ? species(f.s).name : 'fish'} to…</h3>
				<ul class="dest">
					{#each locs.filter((l) => l !== m.from) as l (l)}
						{@const t = store.tankAt(l)}
						{@const chk = f && t ? store.check(t, species(f.s)) : null}
						<li>
							<button disabled={(chk && !chk.ok) || (l === 'hold' && s.hold.length >= s.holdCap)} onclick={() => act(store.move(m.uid, m.from, l), 'splash') && (moving = null)}>{tankName(l)}{t ? ` · ${store.used(t)}/${store.capOf(t)}` : ` · ${s.hold.length}/${s.holdCap}`}</button>
							{#if chk && !chk.ok}<span class="why">{chk.msg}</span>{/if}
						</li>
					{/each}
				</ul>
				<button onclick={() => (moving = null)}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if adding}
		{@const to = adding}
		{@const t = store.tankAt(to)}
		<div class="modal">
			<div class="dlg wide">
				<h3>Add fish to {tankName(to)}</h3>
				{#if t}<p class="muted small">{t.water === 'salt' ? 'Saltwater' : 'Freshwater'} · {t.temp} · space left {store.capOf(t) - store.used(t)} · fits up to {SIZE_LABEL[store.maxSizeOf(t)]}</p>{/if}
				<ul class="list">
					{#each s.hold as f (f.u)}
						{@const sp = species(f.s)}
						{@const chk = t ? store.check(t, sp) : null}
						<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={48} />
							<div class="fi"><b>{sp.name}</b><span class="small">{SIZE_LABEL[sp.size]} ({SIZE_UNITS[sp.size]} space) · {sp.water} · {sp.temp}</span>{#if chk && !chk.ok}<span class="why">{chk.msg}</span>{/if}</div>
							<button disabled={!!chk && !chk.ok} onclick={() => act(store.move(f.u, 'hold', to), 'splash')}>Add</button>
						</li>
					{/each}
				</ul>
				{#if !s.hold.length}<p class="muted">Your backroom is empty.</p>{/if}
				<button onclick={() => (adding = null)}>Done</button>
			</div>
		</div>
	{/if}

	{#if crate}
		{@const c = crate}
		<div class="modal">
			<div class="dlg wide crate">
				<h3>📦 Shipment arrived!</h3>
				<div class="cards">
					{#each c.fish as f, i (f.u)}
						{@const sp = species(f.s)}
						{#if i < c.open}
							<div class="cardf open" style="--rc: {RARITY_COLOR[sp.rarity]}">
								<span class="rar">{RARITY_LABEL[sp.rarity]}</span>
								<FishIcon id={sp.id} size={76} />
								<b>{sp.name}</b>
								<span class="small muted">{money(priceOf(sp))}</span>
							</div>
						{:else}
							<button class="cardf shut" onclick={revealNext} disabled={i !== c.open}>?</button>
						{/if}
					{/each}
				</div>
				{#if c.open >= c.fish.length}
					{#if c.gems}<p class="gemline">+{c.gems} 💎 gems were packed in the crate!</p>{/if}
					<button class="primary" onclick={() => (crate = null)}>To the backroom</button>
				{:else}
					<button onclick={revealNext}>Open next</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if building}
		<div class="modal">
			<div class="dlg wide">
				<h3>🔨 Build & buy</h3>
				<h4>Sale tanks</h4>
				<div class="row">
					<select bind:value={buildWater}><option value="fresh">Freshwater</option><option value="salt">Saltwater (+50% gear)</option></select>
					{#if buildWater === 'fresh'}<select bind:value={buildTemp}><option value="tropical">Tropical (heated)</option><option value="cold">Coldwater (goldfish, koi)</option></select>{/if}
				</div>
				<ul class="dest">
					{#each TANK_TIERS as tt (tt.id)}
						<li><button onclick={() => act(store.buildTank(tt.id as TankTier, buildWater, buildWater === 'salt' ? 'tropical' : buildTemp)) && (building = false)}>{tt.name} · {tt.gallons} gal · holds {tt.cap} · up to {SIZE_LABEL[tt.maxSize]} · {money(store.tankCost(tt.id, buildWater))} · {time(tt.build * 1000)}</button></li>
					{/each}
				</ul>
				<h4>Show tanks</h4>
				<button onclick={() => ((building = false), (tab = 'show'), (panel = 'new'))}>⭐ Build a show tank (choose its shape)…</button>
				<h4>Store decorations (popularity)</h4>
				<div class="row">
					{#each STORE_DECOR as d (d.id)}
						<button onclick={() => act(store.buyStoreDecor(d.id), 'coin')}>{d.icon} {d.name} · {money(d.cost)} · +{d.appeal}</button>
					{/each}
				</div>
				<h4>Floor</h4>
				<div class="row">
					{#each FLOORS as f (f.id)}
						<button class:on={s.floor === f.id} onclick={() => act(store.setFloor(f.id))}>{f.name}{s.floors.includes(f.id) ? '' : ` · ${money(f.cost)}`} · +{f.appeal}</button>
					{/each}
				</div>
				<button onclick={() => (building = false)}>Close</button>
			</div>
		</div>
	{/if}

	{#if decorFor !== null}
		{@const t = s.show.find((x) => x.id === decorFor)!}
		<div class="modal">
			<div class="dlg wide">
				<h3>🪸 Decorate · {t.decor.length}/{store.decorSlots(t)}</h3>
				<ul class="dest">
					{#each TANK_DECOR as d (d.id)}
						{@const has = t.decor.includes(d.id)}
						{@const wrong = !!d.water && d.water !== t.water}
						<li>
							{#if has}
								<button class="on" onclick={() => store.removeDecor(t.id, d.id as DecorTag)}>✓ {d.name} (remove)</button>
							{:else}
								<button disabled={wrong} onclick={() => act(store.addDecor(t.id, d.id as DecorTag), 'coin')}>{d.name} · {money(d.cost)} · beauty +{d.beauty}{wrong ? ` · ${d.water} only` : ''}</button>
							{/if}
						</li>
					{/each}
				</ul>
				<button onclick={() => (decorFor = null)}>Done</button>
			</div>
		</div>
	{/if}

	{#if combining}
		<div class="modal">
			<div class="dlg">
				<h3>🔗 Combine with show tank #{show.id}</h3>
				<p class="muted small">Two show tanks become one bigger tank ({money(COMBINE_COST)}, takes a while). Both need the same water, and all their fish must get along.</p>
				<ul class="dest">
					{#each s.show.filter((x) => x.id !== show.id) as o (o.id)}
						<li><button onclick={() => ((combining = false), ask({ title: `Combine with show tank #${o.id}?`, body: `Costs ${money(COMBINE_COST)} and takes a while. Every fish from both tanks moves into the combined tank (it checks they all get along first). This can't be undone.`, fish: [...show.fish, ...o.fish], yes: 'Combine', run: () => act(store.combine(show.id, o.id)) }))}>Show tank #{o.id} · level {o.level} · {o.fish.length} fish</button></li>
					{/each}
				</ul>
				<button onclick={() => (combining = false)}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if choosingCenter}
		<div class="modal">
			<div class="dlg wide">
				<h3>Choose your centrepiece</h3>
				<p class="muted small">Your centrepiece is a pet: feed it, keep its tank clean and decorated the way it likes, and play with it. A happy, bonded centrepiece makes your show tank (and store) shine.</p>
				<ul class="list">
					{#each store.main.fish as f (f.u)}
						{@const sp = species(f.s)}
						<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={48} />
							<div class="fi"><b>{f.n ?? sp.name}</b><span class="small muted">Likes {sp.likes.join(', ')}</span></div>
							<button onclick={() => (act(store.setCenter(f.u), 'done'), (choosingCenter = false))}>Choose</button>
						</li>
					{/each}
				</ul>
				{#if !store.main.fish.length}<p class="muted">Add fish to your main show tank first.</p>{/if}
				<button onclick={() => (choosingCenter = false)}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if confirmAsk}
		{@const q = confirmAsk}
		{@const rare = rareFish(q.fish)}
		<div class="modal">
			<div class="dlg">
				<h3>{q.title}</h3>
				<p class="small">{q.body}</p>
				{#if rare.length}
					{#if q.leaving}<p class="small warnline">Leaving your store:</p>{:else}<p class="small good">Your rare fish are safe: they stay with the tank.</p>{/if}
					<ul class="rarelist">
						{#each rare as f (f.u)}
							{@const sp = species(f.s)}
							<li style="--rc: {RARITY_COLOR[sp.rarity]}"><FishIcon id={sp.id} size={34} /><span>{f.n ?? sp.name}</span><b>{RARITY_LABEL[sp.rarity]}</b></li>
						{/each}
					</ul>
				{/if}
				<div class="row">
					<button class="primary" onclick={() => (q.run(), (confirmAsk = null))}>{q.yes}</button>
					<button onclick={() => (confirmAsk = null)}>Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	{#if sellDecor !== null}
		{@const d = s.decor.find((x) => x.id === sellDecor)}
		<div class="modal">
			<div class="dlg">
				{#if d}
					{@const info = STORE_DECOR.find((x) => x.id === d.item)!}
					<h3>{info.icon} {info.name}</h3>
					<p class="muted small">Adds +{info.appeal} popularity. Move it in Layout mode.</p>
					<div class="row">
						<button class="danger" onclick={() => (store.sellStoreDecor(d.id), (sellDecor = null), sfx('coin'))}>Sell for {money(info.cost / 2)}</button>
						<button onclick={() => (sellDecor = null)}>Keep</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
{/if}

<style>
	.ifish {
		position: relative;
		display: grid;
		grid-template-columns: 150px 1fr;
		grid-template-rows: auto 1fr;
		height: 100%;
		color: #e2e8f0;
		background: linear-gradient(#0b2233, #07121c);
		font-size: 0.92rem;
		overflow: hidden;
	}
	.top {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		padding-right: 100px; /* clear of the pop-up's buttons */
		background: #0f2f45;
		border-bottom: 3px solid #08202f;
		flex-wrap: wrap;
	}
	.brand {
		font: 900 1.4rem/1 'Arial Black', Impact, sans-serif;
		color: #e2e8f0;
	}
	.brand span {
		color: #2ab0e8;
	}
	.storename {
		border: none;
		background: none;
		color: #fde68a;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.stats {
		display: flex;
		gap: 12px;
		margin-left: auto;
		font-weight: 700;
		align-items: center;
	}
	.free {
		animation: pulse 1.4s infinite;
		background: #f59e0b !important;
		color: #1a1000 !important;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.06);
		}
	}
	.tabs {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 8px;
		background: #0a1c2a;
		overflow-y: auto;
	}
	.tabs button {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 10px;
		border: none;
		border-radius: 10px;
		background: none;
		color: #cbd5e1;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tabs button.on {
		background: #134a6a;
		color: #fff;
	}
	.dot {
		position: absolute;
		top: 6px;
		left: 24px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f87171;
	}
	.body {
		padding: 12px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	button,
	select,
	input {
		font: inherit;
		color: inherit;
	}
	.body button,
	.dlg button,
	.top button,
	select {
		padding: 7px 12px;
		border-radius: 9px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		cursor: pointer;
	}
	select {
		background: #0f2f45;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button.on {
		border-color: #2ab0e8;
		background: rgba(42, 176, 232, 0.2);
	}
	.primary {
		background: #2ab0e8 !important;
		border-color: #2ab0e8 !important;
		color: #04121c !important;
		font-weight: 700;
	}
	.danger {
		border-color: rgba(248, 113, 113, 0.5) !important;
		color: #fca5a5 !important;
	}
	.gem {
		border-color: #a78bfa !important;
		background: rgba(167, 139, 250, 0.18) !important;
	}
	.link {
		border: none !important;
		background: none !important;
		color: #7dd3fc;
		padding: 0 4px !important;
		text-decoration: underline;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.muted {
		color: #94a3b8;
	}
	.small {
		font-size: 0.8rem;
	}
	.good {
		color: #4ade80;
	}
	.card {
		padding: 12px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(148, 163, 184, 0.14);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.card h3,
	.dlg h3 {
		margin: 0;
		font-size: 1rem;
	}
	.dlg h4 {
		margin: 6px 0 0;
		font-size: 0.85rem;
		color: #7dd3fc;
	}
	.note {
		margin: 0;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(250, 204, 21, 0.12);
		color: #fde68a;
	}
	.alert {
		margin: 0;
		padding: 8px 10px;
		border-radius: 8px;
		background: rgba(248, 113, 113, 0.15);
		color: #fecaca;
		font-weight: 600;
	}
	.bar {
		display: grid;
		grid-template-columns: 70px 1fr 30px;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
	}
	.bar i,
	.prog {
		display: block;
		height: 10px;
		border-radius: 2px;
		background: #1e293b;
		box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.3);
	}
	.bar em,
	.prog em {
		display: block;
		height: 100%;
		border-radius: 2px;
		box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.25);
	}
	.prog em {
		background: #2ab0e8;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.fish,
	.staff,
	.task {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
		border-left: 4px solid var(--rc, #334155);
	}
	.fish.mine {
		background: rgba(42, 176, 232, 0.12);
	}
	.fi {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.fa {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.rar {
		color: var(--rc);
		font-weight: 800;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.rar.mythic {
		background: linear-gradient(90deg, #ff4d6d, #fbbf24, #4ade80, #38bdf8, #a78bfa);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 0.72rem;
	}
	.chips span {
		padding: 1px 6px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.07);
	}
	.chips .warn {
		background: rgba(248, 113, 113, 0.2);
		color: #fecaca;
	}
	.chips .good {
		background: rgba(74, 222, 128, 0.15);
	}
	.price {
		color: #86efac;
		font-weight: 700;
		font-size: 0.8rem;
	}
	.av {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 8px;
		background: #134a6a;
		font-weight: 800;
	}
	.suppliers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
	}
	.sup {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		border-radius: 12px;
		background: #0f2f45;
		box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.3);
	}
	.log {
		margin: 0;
		padding-left: 18px;
		max-height: 180px;
		overflow-y: auto;
		font-size: 0.8rem;
		color: #cbd5e1;
	}
	.toasts {
		position: absolute;
		right: 12px;
		bottom: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: min(360px, 80%);
		pointer-events: none;
		z-index: 5;
	}
	.toasts p {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: #134a6a;
		box-shadow: 0 8px 20px -8px #000;
		animation: in 0.2s ease-out;
	}
	@keyframes in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
	.modal {
		position: absolute;
		inset: 0;
		z-index: 6;
		display: grid;
		place-items: center;
		padding: 12px;
		background: rgba(2, 8, 14, 0.7);
	}
	.dlg {
		width: min(420px, 100%);
		max-height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border-radius: 14px;
		background: #0f2333;
		border: 1px solid rgba(42, 176, 232, 0.35);
	}
	.dlg.wide {
		width: min(640px, 100%);
	}
	.dlg input {
		padding: 9px 12px;
		border-radius: 9px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
	}
	.err {
		margin: 0;
		color: #fca5a5;
	}
	.dest {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.dest button {
		width: 100%;
		text-align: left;
	}
	.why {
		display: block;
		font-size: 0.75rem;
		color: #fca5a5;
		padding: 2px 4px 0;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.cardf {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		min-height: 150px;
		border-radius: 12px;
		text-align: center;
	}
	.cardf.shut {
		justify-content: center;
		font-size: 2.4rem;
		font-weight: 900;
		background: repeating-linear-gradient(45deg, #8a5a2a 0 14px, #7a4a22 14px 28px) !important;
		border: 3px solid #5a3a1a !important;
	}
	.cardf.open {
		background: rgba(255, 255, 255, 0.05);
		border: 3px solid var(--rc);
		box-shadow: 0 0 22px -6px var(--rc);
		animation: flip 0.35s ease-out;
	}
	@keyframes flip {
		from {
			transform: rotateY(90deg);
		}
	}
	.gemline {
		margin: 0;
		color: #c4b5fd;
		font-weight: 700;
	}

	/* The show tank fills the screen; tools pop out over it. */
	.body.full {
		padding: 0;
		gap: 0;
		overflow: hidden;
	}
	.body.full > .alert,
	.body.full > .note {
		margin: 6px 8px 0;
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 320px;
		padding: 10px 62px 0 10px;
		background: radial-gradient(ellipse at 50% 30%, #173a52, #07121c 75%);
	}
	.building {
		display: grid;
		place-items: center;
		align-content: center;
		height: 100%;
		color: #fde68a;
		font-size: 1rem;
	}
	.building span {
		font-size: 3rem;
	}
	.hud {
		position: absolute;
		top: 18px;
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		z-index: 2;
	}
	.hud.tl {
		left: 22px;
	}
	.hud.tr {
		right: 76px;
	}
	.hud span,
	.hud button {
		padding: 3px 9px !important;
		border-radius: 99px !important;
		background: rgba(4, 18, 28, 0.62) !important;
		border: 1px solid rgba(255, 255, 255, 0.14) !important;
		font-size: 0.8rem;
		font-weight: 700;
		backdrop-filter: blur(3px);
	}
	.hud button.on {
		background: rgba(42, 176, 232, 0.55) !important;
	}
	.hud .low {
		color: #fca5a5;
	}
	.taskpill,
	.nudge {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 22%;
		z-index: 2;
		padding: 5px 12px !important;
		border-radius: 99px !important;
		background: rgba(4, 18, 28, 0.7) !important;
		font-size: 0.8rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.nudge {
		bottom: calc(22% + 34px);
		color: #bbf7d0;
		border: 1px solid rgba(74, 222, 128, 0.5) !important;
		animation: pulse 1.6s infinite;
	}
	.tools {
		position: absolute;
		right: 8px;
		top: 10px;
		bottom: 10px;
		width: 46px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-y: auto;
		z-index: 3;
	}
	.tools button {
		width: 46px;
		height: 42px;
		padding: 0 !important;
		font-size: 1.25rem;
		border-radius: 12px !important;
		background: rgba(15, 47, 69, 0.9) !important;
		flex: none;
	}
	.tools button.on {
		background: #2ab0e8 !important;
	}
	.tools hr {
		width: 70%;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		margin: 2px auto;
	}
	.pop {
		position: absolute;
		right: 62px;
		top: 10px;
		width: min(360px, calc(100% - 80px));
		max-height: calc(100% - 20px);
		overflow-y: auto;
		z-index: 4;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
		border-radius: 14px;
		background: rgba(10, 30, 45, 0.94);
		border: 1px solid rgba(42, 176, 232, 0.35);
		box-shadow: 0 16px 40px -14px #000;
		animation: pop 0.16s ease-out;
	}
	@keyframes pop {
		from {
			transform: translateX(10px);
			opacity: 0;
		}
	}
	.pop h3 {
		margin: 0;
		font-size: 1rem;
		padding-right: 24px;
	}
	.pop h4 {
		margin: 4px 0 0;
		font-size: 0.82rem;
		color: #7dd3fc;
	}
	.pop .x {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 8px !important;
	}
	.shapes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.shapes button {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
	}
	.swatches {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.swatches button {
		width: 30px;
		height: 30px;
		padding: 0 !important;
		border-radius: 50% !important;
		background: var(--sw) !important;
		border: 2px solid rgba(255, 255, 255, 0.25) !important;
	}
	.swatches button.on {
		border: 3px solid #2ab0e8 !important;
		box-shadow: 0 0 0 2px #04121c inset;
	}
	.gate {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		height: 100%;
		padding: 24px;
		text-align: center;
		color: #e2e8f0;
		background: radial-gradient(ellipse at 50% 35%, #134a6a, #07121c 70%);
	}
	.gate p {
		margin: 0;
		max-width: 440px;
	}
	.gate button {
		padding: 9px 16px;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
		cursor: pointer;
	}
	.brand.big {
		font-size: 3rem;
	}
	.storeview {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
	}
	.floorbox {
		flex: 1;
		min-height: 0;
	}
	.storeview > p {
		margin: 0;
	}
	.storepop {
		top: 52px;
		right: 12px;
		width: min(400px, calc(100% - 24px));
		max-height: calc(100% - 64px);
	}
	.storepop .card {
		padding: 0;
		background: none;
		border: none;
	}
	.warnline {
		margin: 0;
		color: #fca5a5;
	}
	input.price {
		width: 110px;
		padding: 7px 10px;
		border-radius: 9px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(255, 255, 255, 0.06);
	}
	.stock {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.stock li {
		display: grid;
		grid-template-columns: 1.4fr 1fr 52px auto;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
	}
	.stock i {
		height: 10px;
		border-radius: 2px;
		background: #1e293b;
	}
	.stock em {
		display: block;
		height: 100%;
		border-radius: 2px;
	}
	.stock li.low b {
		color: #fca5a5;
	}
	.rarelist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rarelist li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		border-left: 4px solid var(--rc);
	}
	.rarelist b {
		margin-left: auto;
		color: var(--rc);
		font-size: 0.72rem;
		text-transform: uppercase;
	}

	/* Phones: tabs along the bottom, one column. */
	@media (max-width: 700px) {
		.ifish {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr auto;
			font-size: 0.88rem;
		}
		.top {
			padding: 6px 10px;
			gap: 6px;
		}
		.stats {
			gap: 8px;
			margin-left: 0;
			width: 100%;
			font-size: 0.85rem;
		}
		.tabs {
			grid-row: 3;
			flex-direction: row;
			justify-content: space-between;
			padding: 4px;
			overflow-x: auto;
		}
		.tabs button {
			flex-direction: column;
			gap: 2px;
			padding: 6px 4px;
			font-size: 0.65rem;
			flex: 1;
			align-items: center;
		}
		.tabs .ic {
			font-size: 1.2rem;
		}
		.cards {
			gap: 6px;
		}
		.stage {
			padding: 6px 54px 0 6px;
		}
		.hud.tr {
			top: auto;
			bottom: 24%;
			left: 14px;
			right: 60px;
		}
		.pop {
			right: 54px;
			width: calc(100% - 62px);
		}
		.quit {
			order: -1;
		}
	}
</style>
