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
		SALT_COST,
		CRATE_FISH,
		FLOORS,
		FOOD_COST,
		EVENTS,
		CHEST_ODDS,
		DECOR_ICON,
		ALBINO_OF,
		BREEDER_COST,
		BREEDER_TIME,
		breedCost,
		breedTime,
		BROOD,
		hatchTime,
		canBreed,
		canBreedAtAll,
		speciesName,
		LAB_COST,
		LAB_TIME,
		EVENT_CRATE_COST,
		EVENT_DECOR_ODDS,
		LUCK_OWNED,
		oddsText,
		LUCK_SHOWN,
		activeEvent,
		eventDecor,
		GIFT_HOURS,
		GIFT_NAMES,
		RARITIES,
		RESEARCH_MAX,
		orderPrice,
		researchCost,
		researchTime,
		HOLDING_COST,
		EXPAND_COST,
		EXPAND_MAX,
		EXPAND_TIME,
		HOLD_PER_EXPAND,
		gridSize,
		holdMax,
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
		type StoreItem,
		type StoreSnapshot,
		type TankLook,
		type TankShape,
		type TankTier,
		type Temp,
		type Water
	} from './data';
	import { FishStore, BREED_REF, EXPAND_REF, SHELF_REF, type Fish, type Loc, type Result, type SaleTank, type ShowTank } from './store.svelte';
	import { gameAudio } from '../audio.svelte';
	import TankCanvas from './TankCanvas.svelte';
	import StoreFloor, { type FloorPick } from './StoreFloor.svelte';
	import Fishing from './Fishing.svelte';
	import FishIcon from './FishIcon.svelte';
	import type { GameUiProps } from '../registry';
	import { session } from '$lib/session.svelte';
	import { panScroll } from '$lib/actions/pan-scroll';

	let { active, onquit, loggedIn }: GameUiProps = $props();

	const store = new FishStore();
	// Development only: a handle for testing from the browser console.
	if (import.meta.env.DEV) (window as unknown as { ifish: FishStore }).ifish = store;
	const s = $derived(store.s);
	const sfx = (n: string) => gameAudio.play('ifish', n);

	type Tab = 'store' | 'show' | 'backroom' | 'storage' | 'ship' | 'fish' | 'staff' | 'wiki' | 'showcase';
	const TABS: { id: Tab; icon: string; label: string }[] = [
		{ id: 'store', icon: '🏪', label: 'Store' },
		{ id: 'show', icon: '⭐', label: 'Show tank' },
		{ id: 'backroom', icon: '📦', label: 'Backroom' },
		{ id: 'storage', icon: '🎒', label: 'Storage' },
		{ id: 'ship', icon: '🚚', label: 'Shipments' },
		{ id: 'fish', icon: '🎣', label: 'Fishing' },
		{ id: 'staff', icon: '🧑‍🔧', label: 'Staff' },
		{ id: 'wiki', icon: '📖', label: 'Fish wiki' },
		{ id: 'showcase', icon: '🌍', label: 'Market' }
	];
	let tab = $state<Tab>('store');
	let picked = $state<FloorPick>(null);
	let layout = $state(false);
	let showId = $state<number>(store.s.show[0].id);
	let note = $state('');
	/** The payroll warning, closed for now. */
	let hideAlert = $state(false);
	let toasts = $state<{ id: number; text: string }[]>([]);
	let toastSeq = 0;

	// Dialogs.
	let naming = $state<null | { kind: 'store' | 'fish'; uid?: number; value: string; error: string; busy: boolean }>(null);
	let moving = $state<null | { uid: number; from: Loc }>(null);
	let adding = $state<null | Loc>(null);
	let crate = $state<null | { fish: Fish[]; gems: number; open: number; decor?: DecorTag }>(null);
	let building = $state(false);
	let decorFor = $state<number | null>(null);
	let combining = $state(false);
	let choosingCenter = $state(false);
	let sellDecor = $state<number | null>(null);
	let buildWater = $state<Water>('fresh');
	let buildTemp = $state<Temp>('tropical');
	let buildShape = $state<TankShape>('rect');
	// Choices you make before paying: nothing is bought until you press Apply.
	let decorDraft = $state<DecorTag[]>([]);
	let styleDraft = $state<TankLook | null>(null);
	type CartTank = { tier: TankTier; water: Water; temp: Temp };
	let cart = $state<{ tanks: CartTank[]; decor: Partial<Record<StoreItem, number>>; floor: string | null }>({ tanks: [], decor: {}, floor: null });
	function openDecor(id: number) {
		decorFor = id;
		decorDraft = [...(s.show.find((x) => x.id === id)?.decor ?? [])];
	}
	function toggleDraft(tag: DecorTag) {
		decorDraft = decorDraft.includes(tag) ? decorDraft.filter((d) => d !== tag) : [...decorDraft, tag];
	}
	function openBuild() {
		cart = { tanks: [], decor: {}, floor: null };
		building = true;
	}
	const cartCost = $derived(
		cart.tanks.reduce((a, t) => a + store.tankCost(t.tier, t.water), 0) +
			Object.entries(cart.decor).reduce((a, [id, n]) => a + (STORE_DECOR.find((d) => d.id === id)?.cost ?? 0) * (n ?? 0), 0) +
			(cart.floor && !s.floors.includes(cart.floor) ? (FLOORS.find((f) => f.id === cart.floor)?.cost ?? 0) : 0)
	);
	const cartCount = $derived(cart.tanks.length + Object.values(cart.decor).reduce((a, n) => a + (n ?? 0), 0) + (cart.floor && cart.floor !== s.floor ? 1 : 0));
	function addToCart(tier: TankTier) {
		cart.tanks = [...cart.tanks, { tier, water: buildWater, temp: buildWater === 'salt' ? 'tropical' : buildTemp }];
		sfx('click');
	}
	function bump(item: StoreItem, by: number) {
		cart.decor = { ...cart.decor, [item]: Math.max(0, (cart.decor[item] ?? 0) + by) };
		sfx('click');
	}
	/** Buy everything in the cart, or nothing if it can't all go through. */
	function checkout() {
		if (cartCost > s.cash) return act({ ok: false, msg: `That comes to ${money(cartCost)}: you have ${money(s.cash)}.` });
		const freeStaff = store.freeFor('build');
		if (cart.tanks.length > freeStaff) return act({ ok: false, msg: `Each new tank needs a free builder or aquarist to set it up: you have ${freeStaff} free. Hire more or buy fewer tanks.` });
		const failed: string[] = [];
		if (cart.floor && cart.floor !== s.floor) {
			const r = store.setFloor(cart.floor);
			if (!r.ok) failed.push(r.msg);
		}
		for (const [id, n] of Object.entries(cart.decor))
			for (let i = 0; i < (n ?? 0); i++) {
				const r = store.buyStoreDecor(id as StoreItem);
				if (!r.ok) failed.push(r.msg);
			}
		for (const t of cart.tanks) {
			const r = store.buildTank(t.tier, t.water, t.temp);
			if (!r.ok) failed.push(r.msg);
		}
		building = false;
		if (failed.length) act({ ok: false, msg: `Some things couldn't be bought: ${[...new Set(failed)].join(' ')}` });
		else act({ ok: true, msg: 'Bought! New tanks are being set up; decorations are on the floor (move them in Layout mode).' }, 'coin');
	}
	function openStyle() {
		styleDraft = { ...store.lookOf(show) };
	}
	function applyStyle() {
		if (!styleDraft) return;
		const t = show;
		const change = { ...styleDraft };
		const cost = store.restyleCost(t, change);
		const done = () => {
			if (act(store.restyle(t.id, change), 'coin')) {
				styleDraft = null;
				panel = null;
			}
		};
		if (!cost) return ((styleDraft = null), (panel = null));
		if (change.shape !== store.lookOf(t).shape) {
			const sh = TANK_SHAPES.find((x) => x.id === change.shape)!;
			ask({ title: `Refit as a ${sh.name.toLowerCase()} tank?`, body: `Costs ${money(cost)} in all. It holds the same number of fish, and all ${t.fish.length} of them stay in the tank.`, fish: t.fish, yes: `Apply · ${money(cost)}`, run: done });
		} else buy('Restyle this tank?', cost, done, { yes: 'Apply' });
	}
	// The show tank's pop-out panels.
	type Panel = 'stats' | 'fish' | 'pet' | 'style' | 'tank' | 'new';
	let panel = $state<Panel | null>(null);
	// "Are you sure?" before changing a tank, listing the rare fish it holds and where they'll go.
	let confirmAsk = $state<null | { title: string; body: string; fish: Fish[]; yes: string; run: () => unknown; leaving?: boolean }>(null);
	function ask(q: NonNullable<typeof confirmAsk>) {
		confirmAsk = q;
		sfx('click');
	}
	/** Every purchase and upgrade asks first, saying what it costs (and what you have). */
	function buy(title: string, price: number, run: () => unknown, o: { gems?: boolean; note?: string; yes?: string } = {}) {
		const cost = o.gems ? `💎 ${price}` : money(price);
		const have = o.gems ? `💎 ${s.gems}` : money(s.cash);
		ask({ title, body: `Costs ${cost}.${o.note ? ` ${o.note}` : ''} You have ${have}.`, fish: [], yes: `${o.yes ?? 'Buy'} · ${cost}`, run });
	}
	const rareFish = (fs: Fish[]) => fs.filter((f) => RARITY_ORDER(f) >= 2);
	type ShowcaseTank = { water: Water; temp: Temp; level: number; seg: number; clean: number; growth: number; decor: DecorTag[]; look: TankLook; fish: { s: string; n?: string }[]; partner: number | null };
	type ShowcaseEntry = { store: string; species: string; fishName: string | null; bond: number; tank: ShowcaseTank | null; layout: StoreSnapshot | null; mine?: boolean };
	let showcase = $state<ShowcaseEntry[] | null>(null);
	/** How many tanks are in the showcase (they load a page at a time). */
	let showcaseTotal = $state(0);
	let showcaseLoading = false;
	/** The tank being looked at (an index into `showcase`): step through everyone's tanks. */
	let viewIdx = $state<number | null>(null);
	const viewing = $derived(viewIdx === null ? null : (showcase?.[viewIdx] ?? null));
	/** Their whole store, to walk around (look only). */
	const viewStore = $derived(viewing?.layout ? new FishStore(viewing.layout, viewing.store) : null);
	/** The tank tapped in their store (looked at in a pop-up over it). */
	let viewSel = $state<{ kind: 'sale' | 'show'; id: number } | null>(null);
	const viewTank = $derived.by((): { t: ShowTank | SaleTank; center: number | null; look?: TankLook } | null => {
		if (!viewing) return null;
		const vs = viewStore;
		if (!vs) {
			const t = asShowTank(tankOf(viewing));
			const pi = tankOf(viewing).partner;
			return { t, center: pi === null ? null : pi + 1, look: t.look };
		}
		if (!viewSel) return null;
		const t = viewSel.kind === 'sale' ? vs.s.sale.find((x) => x.id === viewSel!.id) : vs.s.show.find((x) => x.id === viewSel!.id);
		return t ? { t, center: vs.s.center, look: 'tier' in t ? undefined : vs.lookOf(t) } : null;
	});
	/** A tank's width on screen in the viewer: true to its size (wide tanks scroll sideways). */
	const PX_PER_CM = 3.4;
	function tapView(x: number, y: number) {
		const vs = viewStore;
		if (!vs) return;
		const at = (o: { x: number; y: number }, w: number, h: number) => x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
		const sh = vs.s.show.find((t) => at(t, ...vs.footprint('show', t)));
		const sa = vs.s.sale.find((t) => at(t, ...vs.footprint('sale', t)));
		if (sh) viewSel = { kind: 'show', id: sh.id };
		else if (sa) viewSel = { kind: 'sale', id: sa.id };
		else return;
		sfx('click');
	}
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
		return `${t === store.main ? 'Main show tank' : 'Show tank'} #${t.id}${t.id === store.favTank.id ? ' ♥' : ''}`;
	};
	const locs = $derived<Loc[]>(['hold', ...s.sale.map((t) => `sale:${t.id}` as Loc), ...s.show.map((t) => `show:${t.id}` as Loc)]);
	const show = $derived(s.show.find((t) => t.id === showId) ?? s.show[0]);
	const isMain = $derived(show === store.main);
	/** The partner fish lives in the tank you're looking at. */
	const isHome = $derived(!!store.centerFish && store.petTank?.id === show.id);
	const isFav = $derived(store.favTank.id === show.id);
	const pop = $derived(store.popularity());
	const center = $derived(store.centerFish);

	/** What's on the floor at this tile. */
	function hitAt(x: number, y: number): FloorPick {
		const at = (o: { x: number; y: number }, w: number, h: number) => x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
		const hitSale = s.sale.find((t) => at(t, tier(t.tier).w, 1));
		const hitShow = s.show.find((t) => at(t, Math.min(store.gw(), 2 * t.seg), 2));
		const hitDecor = s.decor.find((d) => at(d, 1, 1));
		const hitShelf = at(s.shelf, 2, 1);
		const hitLab = !!s.lab && at(s.lab, 2, 2);
		const hitBreeder = !!s.breeder && at(s.breeder, 2, 1);
		if (!hitSale && !hitShow && !hitDecor && !hitShelf && !hitLab && hitBreeder) return { kind: 'breeder', id: -3 };
		return hitSale ? { kind: 'sale', id: hitSale.id } : hitShow ? { kind: 'show', id: hitShow.id } : hitDecor ? { kind: 'decor', id: hitDecor.id } : hitShelf ? { kind: 'shelf', id: -1 } : hitLab ? { kind: 'lab', id: -2 } : null;
	}
	const samePick = (a: FloorPick, b: FloorPick) => !!a && !!b && a.kind === b.kind && a.id === b.id;
	/** Move the picked thing so its top-left corner is at (x, y). */
	function placePicked(x: number, y: number) {
		if (!picked) return;
		if (act(picked.kind === 'shelf' ? store.moveShelf(x, y) : picked.kind === 'lab' ? store.moveLab(x, y) : picked.kind === 'breeder' ? store.moveBreeder(x, y) : store.moveItem(picked.kind, picked.id, x, y), 'click')) picked = null;
	}
	/** Layout mode: pressing on something picks it up (so it can be dragged). */
	function pressFloor(x: number, y: number): boolean | 'held' {
		const hit = hitAt(x, y);
		if (!hit) return false;
		// Pressing inside what's already picked up: let a tap there move it instead.
		if (samePick(hit, picked)) return 'held' as const;
		picked = hit;
		sfx('click');
		return true;
	}
	/** Layout mode: the picked-up thing was dragged by (dx, dy) tiles. */
	function dragFloor(dx: number, dy: number) {
		if (!picked) return;
		const box =
			picked.kind === 'shelf' ? s.shelf : picked.kind === 'lab' ? s.lab : picked.kind === 'breeder' ? s.breeder : picked.kind === 'decor' ? s.decor.find((d) => d.id === picked!.id) : picked.kind === 'sale' ? s.sale.find((t) => t.id === picked!.id) : s.show.find((t) => t.id === picked!.id);
		if (box) placePicked(box.x + dx, box.y + dy);
	}
	function tapFloor(x: number, y: number) {
		const at = (o: { x: number; y: number }, w: number, h: number) => x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
		const hitSale = s.sale.find((t) => at(t, tier(t.tier).w, 1));
		const hitShow = s.show.find((t) => at(t, Math.min(store.gw(), 2 * t.seg), 2));
		const hitDecor = s.decor.find((d) => at(d, 1, 1));
		const hitShelf = at(s.shelf, 2, 1);
		const hitLab = !!s.lab && at(s.lab, 2, 2);
		const hitBreeder = !!s.breeder && at(s.breeder, 2, 1);
		const hit: FloorPick = !hitSale && !hitShow && !hitDecor && !hitShelf && !hitLab && hitBreeder ? { kind: 'breeder', id: -3 } : hitSale ? { kind: 'sale', id: hitSale.id } : hitShow ? { kind: 'show', id: hitShow.id } : hitDecor ? { kind: 'decor', id: hitDecor.id } : hitShelf ? { kind: 'shelf', id: -1 } : hitLab ? { kind: 'lab', id: -2 } : null;
		if (layout) {
			// Taps on something else pick it; taps on empty floor (or inside the picked thing) move it there.
			if (hit && !samePick(hit, picked)) {
				picked = hit;
				sfx('click');
			} else if (picked) placePicked(x, y);
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
	const pickedSale = $derived(!layout && picked?.kind === 'sale' ? (s.sale.find((t) => t.id === picked!.id) ?? null) : null);

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
			if (n.kind === 'store') {
				store.rename(r.name);
				if (s.shared) shareTank(true);
			}
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
		crate = { fish: r.fish, gems: r.gems, open: 0, decor: r.decor };
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

	/** Load the showcase from the top, or (`more`) the next page of tanks. */
	async function loadShowcase(more = false) {
		if (showcaseLoading) return;
		showcaseLoading = true;
		try {
			const r = await fetch(`/api/games/ifish/showcase?offset=${more ? (showcase?.length ?? 0) : 0}`);
			const j = (await r.json()) as { entries: ShowcaseEntry[]; total: number };
			showcase = more ? [...(showcase ?? []), ...j.entries] : j.entries;
			showcaseTotal = j.total ?? showcase.length;
		} catch {
			showcaseMsg = 'Could not load the showcase.';
		} finally {
			showcaseLoading = false;
		}
	}
	/** Step to the next (or previous) player's tank, loading more as you go. */
	async function stepView(d: number) {
		if (viewIdx === null || !showcase) return;
		const next = viewIdx + d;
		if (next < 0) return;
		if (next >= showcase.length) {
			if (showcase.length >= showcaseTotal) return;
			await loadShowcase(true);
			if (next >= (showcase?.length ?? 0)) return;
		}
		viewIdx = next;
		viewSel = null;
		sfx('click');
	}
	function viewKeys(e: KeyboardEvent) {
		if (viewIdx === null) return;
		if (e.key === 'ArrowRight') stepView(1);
		else if (e.key === 'ArrowLeft') stepView(-1);
		else if (e.key === 'Escape') {
			if (viewSel) viewSel = null;
			else viewIdx = null;
		}
	}
	$effect(() => {
		if (tab === 'showcase' && !showcase) {
			// Keep your shared tank up to date, then load everyone's.
			if (s.shared) shareTank(true);
			else loadShowcase();
		}
		if (tab === 'showcase' && !market) loadMarket();
	});
	/** Every fish you own, rarest first. */
	const myFish = $derived([...s.show.flatMap((t) => t.fish), ...s.sale.flatMap((t) => t.fish), ...s.hold].sort((a, b) => RARITY_ORDER(b) - RARITY_ORDER(a)));
	function RARITY_ORDER(f: Fish) {
		return ['common', 'uncommon', 'rare', 'ultra', 'epic', 'legendary', 'mythic'].indexOf(species(f.s).rarity);
	}
	const sellable = $derived(myFish.filter((f) => RARITY_ORDER(f) >= 2 && f.u !== s.center && !f.fav));
	/** Post your whole store (starring your favourite show tank) to the showcase (quiet: just keep it current). */
	async function shareTank(quiet = false) {
		if (![...s.show, ...s.sale].some((t) => t.fish.length)) {
			if (!quiet) showcaseMsg = 'Put some fish in your store first.';
			if (quiet) loadShowcase();
			return;
		}
		if (!quiet) showcaseMsg = '';
		try {
			const r = await fetch('/api/games/ifish/showcase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ store: s.name, layout: store.snapshot(), bond: Math.round(s.pet.bond) })
			});
			const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; entries?: ShowcaseEntry[]; total?: number };
			if (!r.ok || !j.ok) {
				if (!quiet) showcaseMsg = j.message ?? 'Could not share that.';
				if (quiet) loadShowcase();
			} else {
				showcase = j.entries ?? showcase;
				showcaseTotal = j.total ?? showcaseTotal;
				s.shared = true;
				store.save();
				if (!quiet) {
					showcaseMsg = 'Your store is in the showcase!';
					sfx('done');
				}
			}
		} catch {
			if (!quiet) showcaseMsg = 'Could not reach the showcase.';
		}
	}
	/** A shared tank as a ShowTank, so it can be drawn and measured like yours. */
	function asShowTank(t: ShowcaseTank): ShowTank {
		return { id: -1, x: 0, y: 0, ready: true, level: t.level, seg: t.seg, water: t.water, temp: t.temp, clean: t.clean, growth: t.growth, decor: t.decor, look: t.look, fish: t.fish.map((f, i) => ({ u: i + 1, s: f.s, c: 0, ...(f.n ? { n: f.n } : {}) })) };
	}
	/** Entries from before tanks were shared: just their one fish. */
	const tankOf = (e: ShowcaseEntry): ShowcaseTank =>
		e.tank ?? { water: species(e.species).water, temp: species(e.species).temp, level: 3, seg: 1, clean: 100, growth: 30, decor: ['gravel'], look: { shape: 'rect', trim: 'black', stand: 'walnut', light: 'day' } as TankLook, fish: [{ s: e.species, ...(e.fishName ? { n: e.fishName } : {}) }], partner: 0 };

	// ── Partner fish ──
	/** Move a fish; taking your partner out to the backroom ends the partnership, so ask first. */
	function moveFish(uid: number, from: Loc, to: Loc) {
		const f = store.fishAt(from).find((x) => x.u === uid);
		if (f && uid === s.center && to === 'hold') {
			moving = null;
			return ask({
				title: `Take ${f.n ?? species(f.s).name} out of its tank?`,
				body: `It goes to the backroom and stops being your partner fish: its bond (${Math.round(s.pet.bond)}) is lost. To keep it as your partner, move it to another show tank instead.`,
				fish: [],
				yes: 'Take it out',
				run: () => act(store.move(uid, from, to), 'splash')
			});
		}
		if (act(store.move(uid, from, to), 'splash')) moving = null;
	}

	// ── The fish wiki ──
	type WikiFilter = 'all' | 'found' | 'missing' | 'research';
	let wikiWater = $state<'all' | 'fresh' | 'cold' | 'salt'>('all');
	let wikiShow = $state<WikiFilter>('all');
	let wikiFind = $state('');
	let wikiLimit = $state(60);
	let wikiSel = $state<string | null>(null);
	const found = $derived(new Set(s.found));
	const wikiList = $derived(
		SPECIES.filter((sp) => {
			if (wikiWater === 'salt' && sp.water !== 'salt') return false;
			if (wikiWater === 'fresh' && (sp.water !== 'fresh' || sp.temp !== 'tropical')) return false;
			if (wikiWater === 'cold' && (sp.water !== 'fresh' || sp.temp !== 'cold')) return false;
			const has = found.has(sp.id);
			if (wikiShow === 'found' && !has) return false;
			if (wikiShow === 'missing' && has) return false;
			if (wikiShow === 'research' && !(s.research[sp.id] ?? 0)) return false;
			const q = wikiFind.trim().toLowerCase();
			return !q || (has && (sp.name.toLowerCase().includes(q) || sp.sci.toLowerCase().includes(q)));
		}).sort((a, b) => +found.has(b.id) - +found.has(a.id) || RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.name.localeCompare(b.name))
	);
	const researchTask = (id: string) => s.tasks.find((t) => t.kind === 'research' && t.sp === id);

	// ── Storage ──
	let chestPrize = $state<null | { icon: string; text: string; decor?: DecorTag; mythic?: boolean }>(null);
	let placeIn = $state<Record<string, number>>({});
	function openChest() {
		const r = store.openChest();
		if (!r.ok) return act(r);
		chestPrize = r;
		sfx(r.mythic ? 'rare' : r.decor ? 'rare' : 'coin');
	}
	const specials = $derived(TANK_DECOR.filter((d) => d.limited));

	// ── Breeding ──
	let breedM = $state<number | null>(null);
	let breedF = $state<number | null>(null);

	// ── Holiday events ──
	const event = $derived(activeEvent(store.now));
	const endsOn = (md: string) => new Date(`2000-${md}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const decorName = (tag: DecorTag) => TANK_DECOR.find((d) => d.id === tag)?.name ?? tag;

	// ── Daily gifts ──
	const giftsReady = $derived(store.giftsReady());
	function openGift() {
		const r = store.openGift();
		if (act(r, 'rare')) toasts = [...toasts, { id: ++toastSeq, text: r.msg ?? '' }].slice(-4);
	}

	const tasksFor = (ref: number) => s.tasks.find((t) => t.ref === ref || t.ref2 === ref);
	const decorBeauty = (t: ShowTank) => t.decor.reduce((a, d) => a + TANK_DECOR.find((x) => x.id === d)!.beauty, 0);
	/** The backroom, favourites first. */
	const holdFish = $derived([...s.hold].sort((a, b) => +!!b.fav - +!!a.fav));
</script>

<svelte:window onkeydown={viewKeys} />

{#snippet tankLook()}
	{#if viewTank}
		{@const t = viewTank.t}
		{@const sale = 'tier' in t}
		{@const cm = sale ? tier(t.tier).cm : showWidthCm((viewStore ?? store).capOf(t))}
		<h4>
			{sale ? `${tier(t.tier).name} (for sale)` : `${viewStore && viewStore.favTank === t ? '♥ Favourite show tank' : 'Show tank'}`}
			<span class="muted small">· {t.fish.length} fish · {cm} cm wide{sale ? '' : ` · level ${t.level}${t.seg > 1 ? ` · ${t.seg} tanks combined` : ''}`} · {t.water === 'salt' ? 'Saltwater' : t.temp === 'cold' ? 'Coldwater' : 'Tropical fresh'}</span>
		</h4>
		<div class="tankscroll" use:panScroll>
			<div style="width: max(100%, {Math.round(cm * PX_PER_CM)}px)">
				{#if sale}
					<TankCanvas fish={t.fish} water={t.water} clean={t.clean} widthCm={cm} height={200} decor={['gravel']} />
				{:else}
					<TankCanvas fish={t.fish} decor={t.decor} water={t.water} clean={t.clean} widthCm={cm} center={viewTank.center} happy={80} height={260} tallCm={46} look={viewTank.look} growth={t.growth ?? 30} stand />
				{/if}
			</div>
		</div>
		{#if Math.round(cm * PX_PER_CM) > 600}<p class="muted small">↔ A big tank: scroll sideways to see all of it.</p>{/if}
		<ul class="rarelist">
			{#each t.fish.toSorted((a, b) => RARITIES.indexOf(species(b.s).rarity) - RARITIES.indexOf(species(a.s).rarity)) as f (f.u)}
				{@const sp = species(f.s)}
				<li style="--rc: {RARITY_COLOR[sp.rarity]}"><FishIcon id={sp.id} size={34} /><span>{f.n ? `${f.n} the ` : ''}{sp.name}{f.u === viewTank.center ? ' 💗' : ''}</span><b>{RARITY_LABEL[sp.rarity]}</b></li>
			{/each}
		</ul>
		{#if !t.fish.length}<p class="muted small">No fish in this tank right now.</p>{/if}
	{/if}
{/snippet}

{#snippet fishRow(f: Fish, from: Loc)}
	{@const sp = species(f.s)}
	<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
		<button class="star" class:on={f.fav} title={f.fav ? 'Favourite: safe from selling. Tap to unstar.' : 'Favourite: keep it safe from selling'} aria-label={f.fav ? 'Unstar' : 'Mark as favourite'} onclick={() => (store.toggleFav(f.u), sfx('click'))}>{f.fav ? '★' : '☆'}</button>
		<FishIcon id={sp.id} size={58} />
		<div class="fi">
			<b>{f.n ? `${f.n} · ` : ''}{sp.name} {@render sex(f)}</b>
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
				{#if f.u === s.center}<span class="good">💗 Partner</span>{/if}
			</span>
			<span class="price">{money(priceOf(sp))}</span>
		</div>
		<div class="fa">
			<button onclick={() => (moving = { uid: f.u, from })}>Move</button>
			{#if from === 'hold' && !f.fav}<button class="sellred" onclick={() => ask({ title: `Wholesale your ${f.n ?? sp.name}?`, body: `A wholesaler pays ${money(priceOf(sp) * 0.4)} for it. It's gone for good.`, fish: [f], leaving: true, yes: 'Wholesale', run: () => act(store.wholesale(f.u), 'coin') })}>Wholesale</button>{/if}
		</div>
	</li>
{/snippet}

{#snippet sex(f: Fish)}
	{#if f.g}<span class="sex {f.g}" title={f.g === 'm' ? 'Male' : 'Female'}>{f.g === 'm' ? '♂' : '♀'}</span>{/if}
{/snippet}

{#snippet breeding()}
	{@const br = s.breeder}
	{@const task = tasksFor(BREED_REF)}
	<h3>💞 Breeding</h3>
	{#if !br}
		<p class="small">Breed a male and a female of the same species for babies, or crossbreed fish that really interbreed in the hobby (platies × swordtails, goldfish × koi, Malawi cichlids…). Every so often a brood holds a very rare albino.</p>
		<p class="muted small">You need a breeding tank ({money(BREEDER_COST)}, 2×1) and a Research Scientist to look after the fish.</p>
		<button class="primary" onclick={() => buy('Build a breeding tank?', BREEDER_COST, () => act(store.buildBreeder(), 'coin'), { yes: 'Build' })}>Build a breeding tank ({money(BREEDER_COST)})</button>
	{:else if !br.ready}
		<p>The breeding tank is being built{task ? `: ${time(task.end - store.now)} left` : '…'}</p>
	{:else if br.eggs?.length}
		{@const left = (br.hatchAt ?? 0) - store.now}
		<div class="eggs">{#each br.eggs as _, i (i)}<span>🥚</span>{/each}</div>
		{#if left > 0}
			<p class="small">{br.eggs.length} egg{br.eggs.length === 1 ? '' : 's'} in the breeding tank: hatching in {time(left)}. What's inside is a surprise until then.</p>
			<button class="gem" onclick={() => buy('Hatch the eggs now?', store.gemsToHatch(), () => act(store.hatchNow(), 'rare'), { gems: true, yes: 'Hatch now' })}>Hatch now 💎{store.gemsToHatch()}</button>
		{:else}
			<p class="small warnline">The eggs are ready to hatch: make room in the backroom for {br.eggs.length} bab{br.eggs.length === 1 ? 'y' : 'ies'}.</p>
		{/if}
	{:else if br.pair.length}
		<div class="pair">
			{#each br.pair as f (f.u)}
				{@const sp = species(f.s)}
				<span><FishIcon id={sp.id} size={48} /><b>{f.n ?? sp.name} {@render sex(f)}</b></span>
			{/each}
		</div>
		{#if task}
			<p class="small">{task.label} · {s.staff.find((p) => p.id === task.staff)?.name ?? 'A scientist'} is looking after them: {time(task.end - store.now)} left.</p>
			<i class="prog"><em style="width: {Math.min(100, ((store.now - task.start) / (task.end - task.start)) * 100)}%"></em></i>
			<button class="gem" onclick={() => buy(`Finish ${task.label.toLowerCase()} now?`, store.gemsToFinish(task), () => act(store.rush(task.id), 'done'), { gems: true, yes: 'Finish now' })}>Finish now 💎{store.gemsToFinish(task)}</button>
		{/if}
	{:else}
		{@const males = myFish.filter((f) => f.g === 'm' && f.u !== s.center && canBreedAtAll(species(f.s)))}
		{@const dad = myFish.find((f) => f.u === breedM)}
		{@const moms = myFish.filter((f) => f.g === 'f' && f.u !== s.center && canBreedAtAll(species(f.s))).sort((a, b) => (dad ? +canBreed(species(dad.s), species(b.s)).ok - +canBreed(species(dad.s), species(a.s)).ok : 0))}
		{@const mom = myFish.find((f) => f.u === breedF)}
		<p class="muted small">Pick a ♂ male and a ♀ female: the same species, or fish that really interbreed (like platies and swordtails, or goldfish and koi). A Research Scientist looks after them. They lay eggs (the parents go back to the backroom), and the eggs hatch a while later.</p>
		<div class="row">
			<select bind:value={breedM} aria-label="Male">
				<option value={null}>♂ Pick a male…</option>
				{#each males as f (f.u)}<option value={f.u}>{f.n ? `${f.n} (${species(f.s).name})` : species(f.s).name}</option>{/each}
			</select>
			<select bind:value={breedF} aria-label="Female">
				<option value={null}>♀ Pick a female…</option>
				{#each moms as f (f.u)}
					{@const okay = !dad || canBreed(species(dad.s), species(f.s)).ok}
					<option value={f.u} disabled={!okay}>{f.n ? `${f.n} (${species(f.s).name})` : species(f.s).name}{okay ? '' : ' (not a match)'}</option>
				{/each}
			</select>
		</div>
		{#if dad && mom}
			{@const a = species(dad.s)}
			{@const z = species(mom.s)}
			{@const c = canBreed(a, z)}
			{#if c.ok}
				<div class="pair">
					<span><FishIcon id={a.id} size={44} />♂</span><b>×</b><span><FishIcon id={z.id} size={44} />♀</span>
				</div>
				<p class="small">
					{#if c.kind === 'legend'}✨ An old legend says that when these two legendary arowanas breed, a dragon is sometimes born…
					{:else if c.kind === 'hybrid'}A real-life hybrid ({c.group?.name} interbreed): the babies take after either parent{c.group?.makes ? `, and now and then come out as a ${c.group.makes.map((id) => species(id).name).join(' or ')}` : ''}.
					{:else if c.kind === 'karp'}Babies will be Magikarp, and now and then one hatches ✨ shiny.
					{:else if c.kind === 'strains'}Two strains of {speciesName(a)}: the babies take after either parent, and now and then show another strain.
					{:else}Babies will be {a.name}s.{/if}
					{#if ALBINO_OF[a.id] || ALBINO_OF[z.id]}✨ A very rare albino is possible.{/if}
				</p>
				<p class="muted small">Costs {money(breedCost(a, z))} · about {time(breedTime(a, z) * 1000)} to spawn, then {time(hatchTime(a, z) * 1000)} for the eggs to hatch · up to {Math.max(BROOD[a.size], BROOD[z.size])} bab{Math.max(BROOD[a.size], BROOD[z.size]) === 1 ? 'y' : 'ies'}</p>
				<button class="primary" onclick={() => act(store.breed(dad.u, mom.u), 'splash') && ((breedM = null), (breedF = null))}>💞 Start breeding</button>
			{:else}
				<p class="why">{c.why}</p>
			{/if}
		{/if}
		{#if !males.length || !moms.length}<p class="muted small">You need at least one male and one female.</p>{/if}
	{/if}
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
			<button class="luck" title="Luck: rarer fish in crates and when fishing. Each limited-edition event decoration adds {LUCK_OWNED}, and {LUCK_SHOWN} more while it's on display in a show tank." onclick={() => (tab = 'ship')}>🍀 {store.luck()}</button>
			{#if giftsReady.length}
				<button class="free" onclick={openGift} title="Three gifts a day: morning ({GIFT_HOURS[0]}:00), afternoon ({GIFT_HOURS[1]}:00) and evening ({GIFT_HOURS[2]}:00)">🎁 {GIFT_NAMES[giftsReady[0]]} gift!</button>
			{:else}
				<span class="muted small" title="Three gifts a day: morning ({GIFT_HOURS[0]}:00), afternoon ({GIFT_HOURS[1]}:00) and evening ({GIFT_HOURS[2]}:00)">🎁 in {time(store.nextGift())}</span>
			{/if}
			{#if s.freeCrates}<button class="crates" onclick={() => (tab = 'ship')}>📦 {s.freeCrates} free</button>{/if}
		</div>
		<button class="quit" onclick={() => (store.save(), onquit())}>Exit</button>
	</header>

	<nav class="tabs" aria-label="FishMart sections">
		{#each TABS as t (t.id)}
			<button class:on={tab === t.id} onclick={() => ((tab = t.id), (note = ''), sfx('click'))}>
				<span class="ic">{t.icon}</span><span class="lb">{t.label}</span>
				{#if t.id === 'staff' && s.layoff}<i class="dot"></i>{/if}
				{#if t.id === 'ship' && event}<i class="evt">{event.icon}</i>{/if}
				{#if t.id === 'storage' && s.chests}<i class="evt">🧰{s.chests}</i>{/if}
			</button>
		{/each}
	</nav>

	<main class="body" class:full={tab === 'show' || tab === 'store'}>
		{#if s.layoff && !hideAlert}
			<p class="alert">Payroll is short! Lay off staff (Staff tab) until your cash covers their daily wages.<button class="nx" aria-label="Close" onclick={() => (hideAlert = true)}>✕</button></p>
		{/if}
		{#if note}<p class="note">{note}<button class="nx" aria-label="Close" onclick={() => (note = '')}>✕</button></p>{/if}

		{#if tab === 'store'}
			<div class="storeview" role="presentation" onclick={(e) => picked && !(e.target as Element).closest('.storepop, .floorbox') && (picked = null)}>
			<div class="row">
				<button class="primary" onclick={openBuild}>🔨 Build & buy</button>
				<button class:on={layout} onclick={() => ((layout = !layout), (picked = null))}>{layout ? '✓ Done arranging' : '↔ Layout mode'}</button>
				<span class="muted">{layout ? 'Drag something to move it, or tap it and then tap where it should go.' : 'Tap a tank, the supply shelf or the lab to manage it. ★ = show tank.'}</span>
			</div>
			<div class="floorbox"><StoreFloor {store} {layout} {picked} ontap={tapFloor} onpress={pressFloor} ondragby={dragFloor} /></div>
			<p class="muted small">Popularity {pop}/100 · about {Math.round(store.customersPerHour())} customers an hour · {s.sold} fish sold · {money(s.earned)} earned</p>
			{#if !layout && (picked?.kind === 'shelf' || picked?.kind === 'lab' || picked?.kind === 'breeder' || pickedSale)}
				<div class="pop storepop">
				<button class="x" aria-label="Close" onclick={() => (picked = null)}>✕</button>

			{#if picked?.kind === 'breeder' && !layout}
				<section class="card">{@render breeding()}</section>
			{/if}
			{#if picked?.kind === 'lab' && !layout && s.lab}
				{@const jobs = s.tasks.filter((t) => t.kind === 'research')}
				{@const sci = s.staff.filter((p) => store.role(p.role).does === 'research')}
				<section class="card">
					<h3>🔬 Research lab</h3>
					{#if !s.lab.ready}
						{@const task = tasksFor(-2)}
						<p>Being built{task ? `: ${time(task.end - store.now)} left` : '…'}</p>
					{:else}
						<p class="muted small">Your Research Scientists work here, one fish each at a time: hire more to research several fish at once. {sci.length} scientist{sci.length === 1 ? '' : 's'} · {jobs.length} researching.</p>
						<ul class="list">
							{#each jobs as j (j.id)}
								<li class="task">
									<div class="fi">
										<b>{j.label}</b>
										<span class="muted small">{s.staff.find((p) => p.id === j.staff)?.name ?? '?'} · {time(j.end - store.now)} left</span>
										<i class="prog"><em style="width: {Math.min(100, ((store.now - j.start) / (j.end - j.start)) * 100)}%"></em></i>
									</div>
								</li>
							{/each}
						</ul>
						<div class="row">
							<button class="primary" onclick={() => ((tab = 'wiki'), (picked = null))}>📖 Research in the fish wiki</button>
							{#if !sci.length}<button onclick={() => ((tab = 'staff'), (picked = null))}>Hire a scientist</button>{/if}
						</div>
					{/if}
				</section>
			{/if}
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
						<button class="primary" disabled={!!task} onclick={() => buy('Restock the supply shelf?', store.restockCost(), () => act(store.restock(), 'coin'), { yes: 'Restock' })}>📦 Restock ({money(store.restockCost())})</button>
						{#if s.shelf.level < SHELF_CAP.length - 1}<button onclick={() => buy('Get a bigger shelf?', SHELF_UPGRADE[s.shelf.level], () => act(store.upgradeShelf(), 'coin'), { yes: 'Upgrade' })}>⬆ Bigger shelf ({money(SHELF_UPGRADE[s.shelf.level])})</button>{/if}
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
								<button onclick={() => ask({ title: `Switch to ${t.water === 'salt' ? 'fresh' : 'salt'}water?`, body: `Only fish for the new water can be stocked here afterwards.${t.water === 'fresh' ? ` Costs ${money(Math.round(tier(t.tier).cost * (SALT_COST - 1)))} for the saltwater gear. You have ${money(s.cash)}.` : ''}`, fish: [], yes: 'Switch', run: () => act(store.setWater(`sale:${t.id}`, t.water === 'salt' ? 'fresh' : 'salt', 'tropical')) })}>Switch to {t.water === 'salt' ? 'fresh' : 'salt'}</button>
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
			<div class="stage" role="presentation" onclick={(e) => panel && !(e.target as Element).closest('.pop, .tools, .hud, .nudge, .giftnote') && ((panel = null), (styleDraft = null))}>
				{#if show.ready}
					<!-- Drawn at its true width, like the showcase: a big tank scrolls sideways. -->
					{@const px = Math.round(showWidthCm(store.capOf(show)) * PX_PER_CM)}
					<div class="tankscroll stagescroll" use:panScroll>
						<div class="tankwide" style="width: max(100%, {px}px)">
							<TankCanvas fish={show.fish} decor={show.decor} water={show.water} clean={show.clean} widthCm={showWidthCm(store.capOf(show))} center={s.center} happy={s.pet.happy} height={0} look={panel === 'style' && styleDraft ? styleDraft : lk} growth={show.growth ?? 30} stand />
						</div>
					</div>
					{#if px > 600}<span class="scrollhint">↔ Scroll to see the whole tank</span>{/if}
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
							<button class:on={t.id === show.id} onclick={() => ((showId = t.id), (panel = null))} title={`${t === store.main ? 'Main show tank' : `Show tank #${t.id}`}${t.id === store.favTank.id ? ' (favourite)' : ''}`}>{t === store.main ? '★' : '#' + t.id}{t.id === store.favTank.id ? ' ♥' : ''}</button>
						{/each}
					{:else}
						<span class="tname">★ {isMain ? 'Main show tank' : 'Show tank'} · Lv {show.level}{isFav ? ' · ♥' : ''}</span>
					{/if}
				</div>
				{#if show.ready}
					<div class="hud tr">
						<span title="Niceness">✨ {Math.round(store.niceness(show))}</span>
						<span title="Clean" class:low={show.clean < 40}>🫧 {Math.round(show.clean)}</span>
						{#if plants}<span title="Plant growth" class:low={store.overgrown(show)}>🌿 {Math.round(show.growth ?? 30)}</span>{/if}
						<span title="Space used">🐟 {store.used(show)}/{store.capOf(show)}</span>
						{#if isHome}<span title="Partner fish happiness" class:low={s.pet.happy < 40}>💗 {Math.round(s.pet.happy)}</span>{/if}
					</div>
				{/if}
				{#if task}<div class="taskpill">⏳ {task.label} · {time(task.end - store.now)}</div>{/if}
				{#if isMain && s.giftDecor}
					<div class="giftnote">
						<button class="nx" aria-label="Close (keep it)" title="Keep it" onclick={() => store.keepGiftDecor()}>✕</button>
						<span>🎁 Someone left you a free <b>{decorName(s.giftDecor)}</b> in this tank!</span>
						<div class="row">
							<button class="primary" onclick={() => (store.keepGiftDecor(), act({ ok: true, msg: `The ${decorName(s.giftDecor!)} stays in your tank.` }, 'done'))}>Keep it</button>
							<button onclick={() => act(store.sellGiftDecor(), 'coin')}>Sell for {money(store.giftDecorValue())}</button>
						</div>
					</div>
				{/if}
				{#if show.ready && store.overgrown(show) && !task}<button class="nudge" onclick={() => act(store.trim(show.id))}>✂️ The plants are overgrown: trim them</button>{/if}

				<!-- Icon toolbar: each pops out a panel over the tank. -->
				<nav class="tools" aria-label="Show tank tools">
					{#each [['stats', '📊', 'Stats'], ['fish', '🐠', 'Fish'], ['pet', '💗', 'Partner fish'], ['style', '🎨', 'Style'], ['tank', '⬆️', 'Tank: upgrade, combine, water'], ['new', '🏗️', 'New show tank']] as [id, ic, label] (id)}
						<button class:on={panel === id} title={label} aria-label={label} onclick={() => ((panel = panel === id ? null : (id as Panel)), panel === 'style' ? openStyle() : (styleDraft = null), sfx('click'))}>{ic}</button>
					{/each}
					<hr />
					<button title="Add fish" aria-label="Add fish" disabled={!show.ready} onclick={() => (adding = `show:${show.id}`)}>➕</button>
					<button title="Decorate" aria-label="Decorate" disabled={!show.ready} onclick={() => openDecor(show.id)}>🪸</button>
					<button title="Clean" aria-label="Clean" disabled={!show.ready || !!task} onclick={() => act(store.clean(`show:${show.id}`))}>🧽</button>
					{#if plants}<button title="Trim plants" aria-label="Trim plants" disabled={!!task} onclick={() => act(store.trim(show.id))}>✂️</button>{/if}
					{#if isHome}<button title="Feed (uses fish food)" aria-label="Feed" onclick={() => act(store.feed(), 'feed')}>🍤</button>{/if}
					<button class:on={isFav} title={isFav ? 'Your favourite tank (shown in the showcase)' : 'Make this your favourite tank (shown in the showcase)'} aria-label="Favourite tank" disabled={isFav} onclick={() => act(store.setFav(show.id), 'done')}>{isFav ? '♥' : '♡'}</button>
				</nav>

				{#if panel}
					<div class="pop">
						<button class="x" aria-label="Close" onclick={() => ((panel = null), (styleDraft = null))}>✕</button>
						{#if panel === 'stats'}
							<h3>{isMain ? 'Main show tank' : `Show tank #${show.id}`}{isFav ? ' ♥' : ''}</h3>
							<p class="muted small">Level {show.level}{show.seg > 1 ? ` · ${show.seg} tanks combined` : ''} · {show.water === 'salt' ? 'Saltwater' : show.temp === 'cold' ? 'Coldwater' : 'Tropical fresh'} · {TANK_SHAPES.find((x) => x.id === lk.shape)?.name}</p>
							{@render bar('Niceness', store.niceness(show), '#fbbf24')}
							{@render bar('Clean', show.clean, '#38bdf8')}
							{#if plants}{@render bar('Plants', show.growth ?? 30, '#4ade80')}{/if}
							<p class="muted small">
								Space {store.used(show)}/{store.capOf(show)} · fits up to {SIZE_LABEL[store.maxSizeOf(show)]} fish · decorations {show.decor.length}/{store.decorSlots(show)} (beauty {decorBeauty(show)}) · show fish aren't sold{#if store.cleaners(show.fish)} · 🧽 crew: algae {Math.round((1 - store.dirtRate(show.fish)) * 100)}% slower{/if}
							</p>
							{#if isFav}<p class="muted small">♥ Your favourite: this is the tank everyone sees in the showcase.</p>{:else}<button onclick={() => act(store.setFav(show.id), 'done')}>♡ Make this my favourite tank</button>{/if}
							{#if plants}<p class="muted small">🌿 Live plants grow every hour (faster under a bright light). Lush plants add niceness; past {OVERGROWN}% they're overgrown and look messy until trimmed.</p>{/if}
						{:else if panel === 'fish'}
							<h3>Fish · {show.fish.length}</h3>
							<ul class="list">{#each show.fish as f (f.u)}{@render fishRow(f, `show:${show.id}`)}{/each}</ul>
							{#if !show.fish.length}<p class="muted">No fish yet.</p>{/if}
							<button onclick={() => (adding = `show:${show.id}`)}>➕ Add fish</button>
						{:else if panel === 'pet'}
							{#if center && isHome}
								{@const sp = species(center.s)}
								<h3>{center.n ?? sp.name}{#if center.n}<span class="muted small">&nbsp;the {sp.name}</span>{/if}</h3>
								<button class="link" onclick={() => (naming = { kind: 'fish', uid: center.u, value: center.n ?? '', error: '', busy: false })}>rename</button>
								{@render bar('Fed', s.pet.hunger, '#4ade80')}
								{@render bar('Happy', s.pet.happy, '#f472b6')}
								{@render bar('Bond', s.pet.bond, '#a78bfa')}
								<p class="muted small">Likes: {sp.likes.map((l) => TANK_DECOR.find((d) => d.id === l)?.name).join(', ')} ({Math.round(store.decorMatch() * 100)}% in the tank) · fish food on the shelf: {s.stock.food}</p>
								<div class="row">
									<button onclick={() => act(store.feed(), 'feed')}>🍤 Feed (1 fish food)</button>
									<button onclick={() => act(store.play(), 'splash')}>👆 Play</button>
									<button onclick={() => (moving = { uid: center.u, from: `show:${show.id}` })}>↔ Move to another tank</button>
									<button onclick={() => moveFish(center.u, `show:${show.id}`, 'hold')}>Take out</button>
									<button onclick={() => (choosingCenter = true)}>Change partner</button>
								</div>
							{:else if center && store.petTank}
								{@const home = store.petTank}
								{@const sp = species(center.s)}
								{@const chk = store.check(show, sp, center.u)}
								<h3>Partner fish</h3>
								<p class="small">{center.n ?? sp.name} lives in {tankName(`show:${home.id}`)}.</p>
								{#if !chk.ok}<p class="why">{chk.msg}</p>{/if}
								<div class="row">
									<button class="primary" disabled={!chk.ok} onclick={() => act(store.move(center.u, `show:${home.id}`, `show:${show.id}`), 'splash')}>↔ Move it here</button>
									<button onclick={() => ((showId = home.id), (panel = 'pet'))}>Go to its tank</button>
									<button disabled={!show.fish.length} onclick={() => (choosingCenter = true)}>Pick one from this tank</button>
								</div>
							{:else}
								<h3>Partner fish</h3>
								<p class="small">Pick a fish from this tank to look after like a pet. Keep it fed, its water clean and its favourite decorations in, and its happiness makes its tank (and your store) shine. You can move it to another show tank any time.</p>
								<button class="primary" disabled={!show.fish.length} onclick={() => (choosingCenter = true)}>Choose a partner fish</button>
							{/if}
						{:else if panel === 'style' && styleDraft}
							{@const d = styleDraft}
							{@const cost = store.restyleCost(show, d)}
							<h3>Style this tank</h3>
							<p class="muted small">Pick what you like: the tank shows a preview. Nothing changes until you press Apply.</p>
							<h4>Glass shape</h4>
							<div class="shapes">
								{#each TANK_SHAPES as sh (sh.id)}
									<button class:on={d.shape === sh.id} onclick={() => (d.shape = sh.id)}>
										<b>{sh.name}</b>
										<span class="small muted">{sh.blurb}</span>
										<span class="small">{lk.shape === sh.id ? 'Current' : money(Math.max(150, sh.cost) * show.seg)}{sh.beauty ? ` · +${sh.beauty} niceness` : ''}</span>
									</button>
								{/each}
							</div>
							<h4>Trim · {money(RESTYLE_COST)} to change</h4>
							<div class="swatches">
								{#each TANK_TRIMS as x (x.id)}<button class:on={d.trim === x.id} style="--sw: {x.color}" title={x.name} aria-label={x.name} onclick={() => (d.trim = x.id)}></button>{/each}
							</div>
							<h4>Stand · {money(RESTYLE_COST)} to change</h4>
							<div class="swatches">
								{#each TANK_STANDS as x (x.id)}<button class:on={d.stand === x.id} style="--sw: {x.color}" title={x.name} aria-label={x.name} onclick={() => (d.stand = x.id)}></button>{/each}
							</div>
							<h4>Lights · {money(RESTYLE_COST)} to change</h4>
							<div class="row">
								{#each TANK_LIGHTS as x (x.id)}<button class:on={d.light === x.id} onclick={() => (d.light = x.id)}>{x.name}</button>{/each}
							</div>
							<div class="applybar">
								<span>{cost ? `Total ${money(cost)}` : 'No changes yet'}</span>
								<button onclick={() => ((styleDraft = null), (panel = null))}>✕ Cancel</button>
								<button class="primary" disabled={!cost || cost > s.cash} onclick={applyStyle}>Apply</button>
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
							<h4>Water</h4>
							{@const waterNow = show.water === 'salt' ? 'salt' : show.temp === 'cold' ? 'cold' : 'fresh'}
							<div class="row">
								{#each [['fresh', '💧 Freshwater', 'fresh', 'tropical'], ['salt', '🌊 Saltwater', 'salt', 'tropical'], ['cold', '❄️ Coldwater', 'fresh', 'cold']] as [id, label, w, tp] (id)}
									<button
										class:on={waterNow === id}
										disabled={waterNow === id || !!show.fish.length}
										onclick={() =>
											ask({
												title: `Make this a ${label.slice(3).toLowerCase()} tank?`,
												body: `Only ${id === 'salt' ? 'saltwater' : id === 'cold' ? 'coldwater' : 'tropical freshwater'} fish can live here afterwards.${(w === 'salt') !== (show.water === 'salt') ? ' Decorations that only suit the old water are removed.' : ''}`,
												fish: [],
												yes: 'Change water',
												run: () => act(store.setWater(`show:${show.id}`, w as Water, tp as Temp))
											})}>{label}</button
									>
								{/each}
							</div>
							{#if show.fish.length}<p class="muted small">Move the fish out to change the water type (the tank must be empty).</p>{/if}
						{:else if panel === 'new'}
							<h3>New show tank</h3>
							<p class="muted small">Used {store.showSlotsUsed()}/{Math.min(store.maxShow(), store.showSlotsUnlocked())} (your store has room for {store.maxShow()}). More unlock at main tank levels {SHOW_UNLOCK.slice(1).join(', ')}, and one with each store expansion. Combine show tanks to house giants like the Zebra Shark.</p>
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
							<button class="primary" onclick={() => buy('Build a new show tank?', NEW_SHOW_COST + (TANK_SHAPES.find((x) => x.id === buildShape)?.cost ?? 0), () => act(store.buildShow(buildWater, buildWater === 'salt' ? 'tropical' : buildTemp, buildShape)) && (panel = null), { yes: 'Build' })}>Build ({money(NEW_SHOW_COST + (TANK_SHAPES.find((x) => x.id === buildShape)?.cost ?? 0))})</button>
						{/if}
					</div>
				{/if}
			</div>
		{:else if tab === 'backroom'}
			<section class="card">{@render breeding()}</section>
			<section class="card">
				<h3>Backroom · {holdFish.length}/{s.holdCap}</h3>
				<p class="muted small">New fish wait here. Stock them in sale tanks (customers buy them), show them off in a show tank, or sell to a wholesaler for 40% of their price.</p>
				{#if s.holdCap < holdMax(store.size)}<button onclick={() => buy('Add more backroom shelving?', HOLDING_COST, () => act(store.buyHolding()), { note: 'Room for 5 more fish.' })}>More shelving +5 ({money(HOLDING_COST)})</button>
				{:else if store.size < EXPAND_MAX}<p class="muted small">The backroom is full of shelving: expand the store (Build &amp; buy) to fit {HOLD_PER_EXPAND} more.</p>{/if}
				<ul class="list">{#each holdFish as f (f.u)}{@render fishRow(f, 'hold')}{/each}</ul>
				{#if !holdFish.length}<p class="muted">Empty. Open a shipment or go fishing!</p>{/if}
			</section>
		{:else if tab === 'storage'}
			<section class="card">
				<h3>🎒 Storage</h3>
				<p class="muted small">Things you've collected that aren't fish: treasure chests, free crates and special decorations.</p>
				<div class="stash">
					<div class="item">
						<span class="big">🧰</span>
						<div class="fi">
							<b>Treasure chests · {s.chests}</b>
							<span class="muted small">Fished up now and then (about {Math.round(CHEST_ODDS * (1 + store.luck() / 100) * 100)}% of catches with your luck). They can hold gems, cash, free crates, limited editions, or a mythic decoration.</span>
						</div>
						<button class="primary" disabled={!s.chests} onclick={openChest}>Open</button>
					</div>
					<div class="item">
						<span class="big">📦</span>
						<div class="fi"><b>Free crates · {s.freeCrates}</b><span class="muted small">Open them from any supplier in Shipments.</span></div>
						<button disabled={!s.freeCrates} onclick={() => (tab = 'ship')}>Go</button>
					</div>
				</div>
			</section>
			<section class="card">
				<h3>✨ Special decorations · {s.limited.length}/{specials.length}</h3>
				<p class="muted small">Limited editions come from holiday event crates; mythics only from treasure chests. Each adds 🍀 luck, and more on display. Mythics make any tank as beautiful as it gets.</p>
				<div class="stash">
					{#each specials as d (d.id)}
						{@const have = s.limited.includes(d.id)}
						{@const shownIn = s.show.filter((t) => t.decor.includes(d.id))}
						<div class="item" class:missing={!have} class:mythicitem={d.mythic}>
							<span class="big">{have ? (DECOR_ICON[d.id] ?? '✨') : '?'}</span>
							<div class="fi">
								<b>{have ? d.name : '???'}</b>
								<span class="small {d.mythic ? 'rar mythic' : 'limited'}">{d.mythic ? 'MYTHIC · beauty max' : `Limited edition · ${EVENTS.find((e) => e.id === d.limited)?.name ?? ''}`}</span>
								{#if have}<span class="muted small">{shownIn.length ? `On display: ${shownIn.map((t) => tankName(`show:${t.id}`)).join(', ')}` : 'In storage'}</span>{/if}
							</div>
							{#if have}
								<select bind:value={placeIn[d.id]} aria-label="Show tank">
									{#each s.show.filter((t) => !t.decor.includes(d.id)) as t (t.id)}<option value={t.id}>{tankName(`show:${t.id}`)}</option>{/each}
								</select>
								<button disabled={shownIn.length === s.show.length} onclick={() => act(store.placeSpecial(d.id, placeIn[d.id] ?? s.show.find((t) => !t.decor.includes(d.id))!.id), 'done')}>Put in tank</button>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{:else if tab === 'ship'}
			<section class="card">
				<h3>Daily shipments</h3>
				<p class="muted small">Each crate holds {CRATE_FISH} fish for {money(CRATE_COST)}. Your three daily gifts (morning, afternoon and evening) often hold a free crate: {s.freeCrates} waiting. Some crates hide 💎 gems. Odds{store.luck() ? ' with your luck' : ''}: {oddsText(store.crateOdds(false))}. Mythic fish can only be caught.</p>
				<p class="luckline">🍀 <b>Luck {store.luck()}</b>: makes rarer fish more likely in every crate and on every cast when fishing. Collect limited-edition decorations from holiday event crates: each adds {LUCK_OWNED} luck, and {LUCK_SHOWN} more while it's on display in a show tank. {store.luckParts().owned ? `You have ${store.luckParts().owned} (${store.luckParts().shown} on display).` : "You don't have any yet."}</p>
				{#if event}
					{@const ld = eventDecor(event)}
					<div class="event">
						<span class="eicon">{event.icon}</span>
						<div class="fi">
							<b>{event.name} event · {event.crate}</b>
							<span class="small">{event.blurb} Fish from every water, with much better odds than a regular crate{store.luck() ? ', plus your luck' : ''}: {oddsText(store.crateOdds(true))}. Always a few 💎 gems.</span>
							<span class="small">✨ Limited edition: a {Math.round(EVENT_DECOR_ODDS * 100)}% chance of the <b>{ld.name}</b> tank decoration{s.limited.includes(ld.id) ? ' (you have it!)' : ''}. Only until {endsOn(event.to)}.</span>
						</div>
						<button class="primary" onclick={() => (s.freeCrates ? openCrate('event') : buy(`Open a ${event.name} crate?`, EVENT_CRATE_COST, () => openCrate('event'), { yes: 'Open' }))}>{s.freeCrates ? '🎁 Open free crate' : `Open (${money(EVENT_CRATE_COST)})`}</button>
					</div>
				{/if}
				<div class="suppliers">
					{#each SUPPLIERS as sup (sup.id)}
						<div class="sup">
							<b>{sup.name}</b>
							<span class="muted small">{sup.blurb}</span>
							<button class="primary" onclick={() => (s.freeCrates ? openCrate(sup.id) : buy(`Open a crate from ${sup.name}?`, CRATE_COST, () => openCrate(sup.id), { yes: 'Open' }))}>{s.freeCrates ? '🎁 Open free crate' : `Open crate (${money(CRATE_COST)})`}</button>
						</div>
					{/each}
				</div>
			</section>
		{:else if tab === 'fish'}
			<Fishing {store} {sfx} active={active && tab === 'fish'} />
			<p class="muted small">Bait {money(BAIT_COST)} a cast. Catches go to your backroom. Odds{store.luck() ? ` with your 🍀 luck ${store.luck()}` : ''}: {oddsText(store.catchOdds())}. Raise your luck with limited-edition event decorations.</p>
		{:else if tab === 'staff'}
			<section class="card">
				<h3>Staff · wages {money(store.wages())}/day</h3>
				<p class="muted small">Each employee works one task at a time; faster staff finish sooner. Builders only build, Research Scientists only research (in the Fish wiki), and Senior Aquarists do chores on their own. Wages are paid each day.</p>
			{#if s.staff.some((p) => store.role(p.role).auto)}
				<label class="autotoggle"><input type="checkbox" checked={s.auto} onchange={(e) => store.setAuto(e.currentTarget.checked)} /> Senior Aquarists clean dirty tanks, trim plants and restock the shelf on their own</label>
			{/if}
				<ul class="list">
					{#each s.staff as p (p.id)}
						{@const r = store.role(p.role)}
						{@const busy = s.tasks.find((t) => t.staff === p.id)}
						<li class="staff">
							<span class="av">{p.name[0]}</span>
							<div class="fi"><b>{p.name}</b><span class="muted small">{r.name} · speed ×{r.speed} · {r.wage ? `${money(r.wage)}/day` : 'unpaid'}{r.auto && s.auto ? ' · 🤖 auto' : ''}</span>{#if busy}<span class="small">🔧 {busy.label} · {time(busy.end - store.now)}</span>{:else}<span class="small good">Free</span>{/if}</div>
							{#if p.role !== 'owner'}<button class="danger" disabled={s.staff.length <= 1} onclick={() => act(store.layoff(p.id))}>Lay off</button>{/if}
						</li>
					{/each}
				</ul>
				<h4>Hire</h4>
				<ul class="dest">
					{#each ROLES.filter((r) => r.hire) as r (r.id)}
						<li><button onclick={() => buy(`Hire a ${r.name}?`, r.hire, () => act(store.hire(r.id)), { note: `Then ${money(r.wage)} a day in wages.`, yes: 'Hire' })}><b>{r.name}</b> · {money(r.hire)} · {money(r.wage)}/day · speed ×{r.speed}<span class="muted small"> · {r.blurb}</span></button></li>
					{/each}
				</ul>
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
							<button class="gem" onclick={() => buy(`Finish ${t.label.toLowerCase()} now?`, store.gemsToFinish(t), () => act(store.rush(t.id), 'done'), { gems: true, yes: 'Finish now' })}>Finish now 💎{store.gemsToFinish(t)}</button>
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
		{:else if tab === 'wiki'}
			<section class="card">
				<h3>📖 Fish wiki · found {s.found.length} of {SPECIES.length}</h3>
				<p class="muted small">Every fish you've ever had is logged here. Research Scientists study the fish you've found in your research lab, one fish each at a time; at research level {RESEARCH_MAX} you can order that fish straight from the breeders.</p>
				{#if !s.lab}<p class="small warnline">You need a research lab first: build one from 🔨 Build & buy.</p>{/if}
				<i class="prog"><em style="width: {(s.found.length / SPECIES.length) * 100}%"></em></i>
				<div class="row">
					<select bind:value={wikiWater} onchange={() => (wikiLimit = 60)} aria-label="Water"><option value="all">All waters</option><option value="fresh">Tropical fresh</option><option value="cold">Coldwater</option><option value="salt">Saltwater</option></select>
					<select bind:value={wikiShow} onchange={() => (wikiLimit = 60)} aria-label="Show"><option value="all">Found and missing</option><option value="found">Found</option><option value="missing">Missing</option><option value="research">Researched</option></select>
					<input bind:value={wikiFind} oninput={() => (wikiLimit = 60)} placeholder="Search found fish…" aria-label="Search" />
				</div>
				<div class="wiki">
					{#each wikiList.slice(0, wikiLimit) as sp (sp.id)}
						{@const has = found.has(sp.id)}
						{@const lvl = s.research[sp.id] ?? 0}
						{#if has}
							<button class="wcard" style="--rc: {RARITY_COLOR[sp.rarity]}" onclick={() => (wikiSel = sp.id)}>
								<FishIcon id={sp.id} size={56} />
								<b>{sp.name}</b>
								<span class="pips" title="Research level {lvl}/{RESEARCH_MAX}">{#each Array(RESEARCH_MAX) as _, i (i)}<i class:on={i < lvl}></i>{/each}</span>
								{#if researchTask(sp.id)}<span class="small">🔬 researching</span>{/if}
							</button>
						{:else}
							<div class="wcard missing" style="--rc: {RARITY_COLOR[sp.rarity]}">
								<span class="qm">?</span>
								<b>???</b>
								<span class="small muted">{RARITY_LABEL[sp.rarity]} · {sp.water === 'salt' ? 'salt' : sp.temp === 'cold' ? 'cold' : 'fresh'}</span>
							</div>
						{/if}
					{/each}
				</div>
				{#if !wikiList.length}<p class="muted">Nothing here.</p>{/if}
				{#if wikiList.length > wikiLimit}<button onclick={() => (wikiLimit += 60)}>Show more ({wikiList.length - wikiLimit} left)</button>{/if}
			</section>
		{:else if tab === 'showcase'}
			<section class="card">
				<h3>🌍 Global showcase</h3>
				<p class="muted small">Every player shows off their whole store, starring their favourite show tank. Visit one to walk around it and tap any tank to look inside, then scroll through everyone's with ◀ ▶. Stores with rarer fish come first.</p>
				{#if showcase?.length}<button class="primary" onclick={() => ((viewSel = null), (viewIdx = showcase!.findIndex((e) => !e.mine) >= 0 ? showcase!.findIndex((e) => !e.mine) : 0), sfx('click'))}>👀 Browse all {showcaseTotal} store{showcaseTotal === 1 ? '' : 's'}</button>{/if}
				{#if loggedIn}
					{@const fav = store.favTank}
					<div class="row">
						<span class="small">♥ Your favourite: <b>{tankName(`show:${fav.id}`)}</b> · {fav.fish.length} fish</span>
						<button class="primary" disabled={![...s.show, ...s.sale].some((t) => t.fish.length)} onclick={() => shareTank()}>{s.shared ? 'Update my store' : 'Share my store'}</button>
						<button onclick={() => ((tab = 'show'), (showId = fav.id))}>Change favourite…</button>
					</div>
					{#if s.shared}<p class="muted small">Your shared store updates whenever you open the showcase.</p>{/if}
				{:else}
					<p>Log in to show off your store to everyone.</p>
				{/if}
				{#if showcaseMsg}<p class="note">{showcaseMsg}<button class="nx" aria-label="Close" onclick={() => (showcaseMsg = '')}>✕</button></p>{/if}
				<ul class="list">
					{#each showcase ?? [] as e, i (i)}
						{@const t = tankOf(e)}
						{@const sp = species(e.species)}
						<li class="fish" class:mine={e.mine} style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={58} />
							<div class="fi">
								<b>{e.store}{e.mine ? ' (you)' : ''}</b>
								{#if e.layout}
									{@const [gw, gh] = gridSize(e.layout.size)}
									<span class="small">{e.layout.show.length} show tank{e.layout.show.length === 1 ? '' : 's'} · {e.layout.sale.length} sale tank{e.layout.sale.length === 1 ? '' : 's'} · {e.layout.show.reduce((a, x) => a + x.fish.length, 0) + e.layout.sale.reduce((a, x) => a + x.fish.length, 0)} fish · {gw}×{gh} floor</span>
								{:else}
									<span class="small">{t.fish.length} fish · {TANK_SHAPES.find((x) => x.id === t.look.shape)?.name ?? 'Classic'} {t.water === 'salt' ? 'reef' : t.temp === 'cold' ? 'coldwater' : 'tropical'} tank · level {t.level}</span>
								{/if}
								<span class="muted small">Star: {e.fishName ? `${e.fishName} the ` : ''}{sp.name} <span class="rar" class:mythic={sp.rarity === 'mythic'}>{RARITY_LABEL[sp.rarity]}</span>{e.bond ? ` · bond ${e.bond}` : ''}</span>
							</div>
							<div class="fa"><button onclick={() => ((viewSel = null), (viewIdx = i), sfx('click'))}>👀 Visit</button></div>
						</li>
					{/each}
				</ul>
				{#if showcase && !showcase.length}<p class="muted">Nobody has shared a store yet. Be the first!</p>{/if}
				{#if showcase && showcase.length < showcaseTotal}<button onclick={() => loadShowcase(true)}>Show more stores ({showcaseTotal - showcase.length} left)</button>{/if}
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
				{#if marketMsg}<p class="note">{marketMsg}<button class="nx" aria-label="Close" onclick={() => (marketMsg = '')}>✕</button></p>{/if}
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
		{#each toasts as t (t.id)}<p>{t.text}<button class="nx" aria-label="Close" onclick={() => (toasts = toasts.filter((x) => x.id !== t.id))}>✕</button></p>{/each}
	</div>

	<!-- ── Dialogs ── -->
	{#if naming}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (naming = null)}>
			<form
				class="dlg"
				onsubmit={(e) => {
					e.preventDefault();
					submitName();
				}}
			>
				<button class="x" type="button" aria-label="Close" onclick={() => (naming = null)}>✕</button>
				<h3>{naming.kind === 'store' ? (s.named ? 'Rename your store' : 'Welcome to FishMart! Name your store') : 'Name your partner fish'}</h3>
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
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (moving = null)}>
			<div class="dlg">
				<button class="x" type="button" aria-label="Close" onclick={() => (moving = null)}>✕</button>
				<h3>Move {f ? (f.n ?? species(f.s).name) : 'fish'} to…</h3>
				{#if m.uid === s.center}<p class="muted small">💗 Your partner fish stays your partner in any show tank. Taking it to the backroom ends the partnership.</p>{/if}
				<ul class="dest">
					{#each locs.filter((l) => l !== m.from && !(m.uid === s.center && l.startsWith('sale'))) as l (l)}
						{@const t = store.tankAt(l)}
						{@const chk = f?.fav && l.startsWith('sale') ? { ok: false, msg: "★ Favourites can't go in sale tanks (customers would buy them)." } : f && t ? store.check(t, species(f.s)) : null}
						<li>
							<button disabled={(chk && !chk.ok) || (l === 'hold' && s.hold.length >= s.holdCap)} onclick={() => moveFish(m.uid, m.from, l)}>{tankName(l)}{t ? ` · ${store.used(t)}/${store.capOf(t)}` : ` · ${s.hold.length}/${s.holdCap}`}</button>
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
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (adding = null)}>
			<div class="dlg wide">
				<button class="x" type="button" aria-label="Close" onclick={() => (adding = null)}>✕</button>
				<h3>Add fish to {tankName(to)}</h3>
				{#if t}<p class="muted small">{t.water === 'salt' ? 'Saltwater' : 'Freshwater'} · {t.temp} · space left {store.capOf(t) - store.used(t)} · fits up to {SIZE_LABEL[store.maxSizeOf(t)]}</p>{/if}
				<ul class="list">
					{#each s.hold as f (f.u)}
						{@const sp = species(f.s)}
						{@const chk = f.fav && to.startsWith('sale') ? { ok: false, msg: "★ Favourite: it can't go in a sale tank." } : t ? store.check(t, sp) : null}
						<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={48} />
							<div class="fi"><b>{f.fav ? '★ ' : ''}{sp.name}</b><span class="small">{SIZE_LABEL[sp.size]} ({SIZE_UNITS[sp.size]} space) · {sp.water} · {sp.temp}</span>{#if chk && !chk.ok}<span class="why">{chk.msg}</span>{/if}</div>
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
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (crate && crate.open >= crate.fish.length && (crate = null))}>
			<div class="dlg wide crate">
				<button class="x" type="button" aria-label="Close" onclick={() => (crate = null)}>✕</button>
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
					{#if c.decor}<p class="gemline limited">✨ Limited edition: a {decorName(c.decor)}! +{LUCK_OWNED} 🍀 luck, and +{LUCK_SHOWN} more once it's on display in a show tank (Decorate).</p>{/if}
					<button class="primary" onclick={() => (crate = null)}>To the backroom</button>
				{:else}
					<button onclick={revealNext}>Open next</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if building}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (building = false)}>
			<div class="dlg wide">
				<button class="x" aria-label="Cancel" onclick={() => (building = false)}>✕</button>
				<h3>🔨 Build & buy</h3>
				<p class="muted small">Add what you want, then Buy. Nothing is paid for until you do.</p>
				<h4>Sale tanks</h4>
				<div class="row">
					<select bind:value={buildWater}><option value="fresh">Freshwater</option><option value="salt">Saltwater (+50% gear)</option></select>
					{#if buildWater === 'fresh'}<select bind:value={buildTemp}><option value="tropical">Tropical (heated)</option><option value="cold">Coldwater (goldfish, koi)</option></select>{/if}
				</div>
				<ul class="dest">
					{#each TANK_TIERS as tt (tt.id)}
						<li><button onclick={() => addToCart(tt.id as TankTier)}>＋ {tt.name} · {tt.gallons} gal · holds {tt.cap} · up to {SIZE_LABEL[tt.maxSize]} · {money(store.tankCost(tt.id as TankTier, buildWater))} · {time(tt.build * 1000)}</button></li>
					{/each}
				</ul>
				{#if cart.tanks.length}
					<ul class="cartlist">
						{#each cart.tanks as ct, i (i)}
							<li>{tier(ct.tier).name} ({ct.water === 'salt' ? 'salt' : ct.temp === 'cold' ? 'cold fresh' : 'fresh'}) · {money(store.tankCost(ct.tier, ct.water))}<button class="link" onclick={() => (cart.tanks = cart.tanks.filter((_, j) => j !== i))}>remove</button></li>
						{/each}
					</ul>
				{/if}
				<h4>Research lab</h4>
				{#if s.lab}
					<p class="muted small">You have a lab{s.lab.ready ? '' : ' (being built)'}. Every scientist works in it: hire more scientists to research more fish at once.</p>
				{:else}
					<button onclick={() => ((building = false), buy('Build a research lab?', LAB_COST, () => act(store.buildLab(), 'coin'), { yes: 'Build' }))}>🔬 Build a research lab · 2×2 · {money(LAB_COST)} · {time(LAB_TIME * 1000)}</button>
					<p class="muted small">Needed for research. One lab is enough for all your scientists.</p>
				{/if}
				<h4>Breeding tank</h4>
				{#if s.breeder}
					<p class="muted small">You have a breeding tank{s.breeder.ready ? '' : ' (being built)'}. Breed fish from the Backroom tab, or tap it on the floor.</p>
				{:else}
					<button onclick={() => ((building = false), buy('Build a breeding tank?', BREEDER_COST, () => act(store.buildBreeder(), 'coin'), { yes: 'Build' }))}>💞 Build a breeding tank · 2×1 · {money(BREEDER_COST)} · {time(BREEDER_TIME * 1000)}</button>
					<p class="muted small">Breed a male and a female of the same species (or fish that really interbreed) for babies, and maybe a very rare albino. A Research Scientist looks after them.</p>
				{/if}
				<h4>Show tanks</h4>
				<button onclick={() => ((building = false), (tab = 'show'), (panel = 'new'))}>⭐ Build a show tank (choose its shape)…</button>
				<h4>Expand the store · {store.size}/{EXPAND_MAX}</h4>
				{#if tasksFor(EXPAND_REF)}
					<p class="muted small">🏗️ Expanding: done in {time(tasksFor(EXPAND_REF)!.end - store.now)}.</p>
				{:else if store.size < EXPAND_MAX}
					{@const [gw, gh] = gridSize(store.size + 1)}
					<button onclick={() => ((building = false), buy(`Expand the store to ${gw}×${gh}?`, EXPAND_COST[store.size], () => act(store.expand(), 'coin'), { note: `Takes ${time(EXPAND_TIME[store.size] * 1000)}; nothing in your store moves.`, yes: 'Expand' }))}>🏗️ Expand to {gw}×{gh} · {money(EXPAND_COST[store.size])} · {time(EXPAND_TIME[store.size] * 1000)}</button>
					<p class="muted small">More floor space, room for {HOLD_PER_EXPAND} more fish of backroom shelving, and one more show tank slot. Everything you've placed stays where it is. A builder does it.</p>
				{:else}
					<p class="muted small">Your store is fully expanded ({store.gw()}×{store.gh()}).</p>
				{/if}
				<h4>Store decorations (popularity)</h4>
				<ul class="dest">
					{#each STORE_DECOR as d (d.id)}
						{@const n = cart.decor[d.id] ?? 0}
						<li class="qty">
							<span>{d.icon} {d.name} · {money(d.cost)} · +{d.appeal}</span>
							<button disabled={!n} onclick={() => bump(d.id, -1)} aria-label="One fewer">−</button>
							<b>{n}</b>
							<button onclick={() => bump(d.id, 1)} aria-label="One more">＋</button>
						</li>
					{/each}
				</ul>
				<h4>Floor</h4>
				<div class="row">
					{#each FLOORS as f (f.id)}
						<button class:on={(cart.floor ?? s.floor) === f.id} onclick={() => (cart.floor = f.id)}>{f.name}{s.floors.includes(f.id) ? '' : ` · ${money(f.cost)}`} · +{f.appeal}</button>
					{/each}
				</div>
				<div class="applybar">
					<span>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'} · ${money(cartCost)}` : 'Nothing picked yet'}</span>
					<button onclick={() => (building = false)}>✕ Cancel</button>
					<button class="primary" disabled={!cartCount || cartCost > s.cash} onclick={() => buy(`Buy ${cartCount} item${cartCount === 1 ? '' : 's'}?`, cartCost, checkout)}>Buy</button>
				</div>
			</div>
		</div>
	{/if}

	{#if decorFor !== null}
		{@const t = s.show.find((x) => x.id === decorFor)!}
		{@const adds = decorDraft.filter((d) => !t.decor.includes(d))}
		{@const removes = t.decor.filter((d) => !decorDraft.includes(d))}
		{@const cost = adds.reduce((a, d) => a + store.decorPrice(d), 0)}
		{@const full = decorDraft.length >= store.decorSlots(t)}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (decorFor = null)}>
			<div class="dlg wide">
				<button class="x" aria-label="Cancel" onclick={() => (decorFor = null)}>✕</button>
				<h3>🪸 Decorate · {decorDraft.length}/{store.decorSlots(t)}</h3>
				<p class="muted small">Tick what you want in the tank, then Apply. Removed decorations aren't refunded (limited editions stay yours to place again).</p>
				<ul class="dest">
					{#each TANK_DECOR.filter((d) => !d.limited || s.limited.includes(d.id) || t.decor.includes(d.id)) as d (d.id)}
						{@const on = decorDraft.includes(d.id)}
						{@const had = t.decor.includes(d.id)}
						{@const wrong = !!d.water && d.water !== t.water}
						<li>
							<button class="pick" class:on disabled={wrong || (!on && full)} onclick={() => toggleDraft(d.id as DecorTag)}>
								<span class="tick">{on ? '☑' : '☐'}</span>
								{d.name} · beauty +{d.beauty}
								<span class="muted small">{had ? (on ? 'in the tank' : 'will be removed') : wrong ? `${d.water} only` : d.limited ? `✨ limited edition · yours · +${LUCK_SHOWN} 🍀 on display` : money(d.cost)}</span>
							</button>
						</li>
					{/each}
				</ul>
				<div class="applybar">
					<span>{adds.length || removes.length ? `${adds.length ? `Adding ${adds.length} · ${money(cost)}` : ''}${adds.length && removes.length ? ' · ' : ''}${removes.length ? `removing ${removes.length}` : ''}` : 'No changes yet'}</span>
					<button onclick={() => (decorFor = null)}>✕ Cancel</button>
					<button class="primary" disabled={(!adds.length && !removes.length) || cost > s.cash} onclick={() => {
						const apply = () => act(store.setDecor(t.id, decorDraft), 'coin') && (decorFor = null);
						if (cost) buy(`Add ${adds.length} decoration${adds.length === 1 ? '' : 's'}?`, cost, apply, { yes: 'Apply' });
						else apply();
					}}>Apply</button>
				</div>
			</div>
		</div>
	{/if}

	{#if combining}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (combining = false)}>
			<div class="dlg">
				<button class="x" type="button" aria-label="Close" onclick={() => (combining = false)}>✕</button>
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
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (choosingCenter = false)}>
			<div class="dlg wide">
				<button class="x" type="button" aria-label="Close" onclick={() => (choosingCenter = false)}>✕</button>
				<h3>Choose your partner fish</h3>
				<p class="muted small">Your partner fish is a pet: feed it, keep its tank clean and decorated the way it likes, and play with it. A happy, bonded partner makes its show tank (and your store) shine. Choosing a new one starts a new bond.</p>
				<ul class="list">
					{#each show.fish as f (f.u)}
						{@const sp = species(f.s)}
						<li class="fish" style="--rc: {RARITY_COLOR[sp.rarity]}">
							<FishIcon id={sp.id} size={48} />
							<div class="fi"><b>{f.n ?? sp.name}</b><span class="small muted">Likes {sp.likes.join(', ')}</span></div>
							{#if f.u === s.center}<span class="small good">💗 Partner</span>{:else}<button onclick={() => (act(store.setCenter(f.u), 'done'), (choosingCenter = false))}>Choose</button>{/if}
						</li>
					{/each}
				</ul>
				{#if !show.fish.length}<p class="muted">Add fish to this show tank first.</p>{/if}
				<button onclick={() => (choosingCenter = false)}>Cancel</button>
			</div>
		</div>
	{/if}


	{#if chestPrize}
		{@const p = chestPrize}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (chestPrize = null)}>
			<div class="dlg chest" class:mythicprize={p.mythic}>
				<button class="x" type="button" aria-label="Close" onclick={() => (chestPrize = null)}>✕</button>
				<h3>🧰 Treasure chest</h3>
				<span class="prize">{p.decor ? (DECOR_ICON[p.decor] ?? '✨') : p.icon}</span>
				<b class="prizetext">{p.text}</b>
				{#if p.decor}<p class="muted small">It's in your Storage: put it in any show tank. +{LUCK_OWNED} 🍀 luck, and +{LUCK_SHOWN} more on display.</p>{/if}
				<div class="row">
					{#if s.chests}<button class="primary" onclick={openChest}>Open another ({s.chests})</button>{/if}
					<button onclick={() => (chestPrize = null)}>Done</button>
				</div>
			</div>
		</div>
	{/if}

	{#if viewing}
		{@const v = viewing}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (viewIdx = null)}>
			<div class="dlg wide visit" class:store={!!viewStore}>
				<button class="x" aria-label="Close" onclick={() => (viewIdx = null)}>✕</button>
				<div class="browse">
					<button aria-label="Previous store" disabled={!viewIdx} onclick={() => stepView(-1)}>◀</button>
					<span class="small muted">{(viewIdx ?? 0) + 1} of {showcaseTotal}</span>
					<button aria-label="Next store" disabled={(viewIdx ?? 0) + 1 >= showcaseTotal} onclick={() => stepView(1)}>▶</button>
				</div>
				<h3>{v.store}{v.mine ? ' (you)' : ''}</h3>
				{#if viewStore}
					{@const vs = viewStore}
					<p class="muted small">{vs.s.show.length} show tank{vs.s.show.length === 1 ? '' : 's'} · {vs.s.sale.length} sale tank{vs.s.sale.length === 1 ? '' : 's'} · {vs.gw()}×{vs.gh()} floor. Tap any tank to look inside.</p>
					{#key vs}<div class="visitfloor"><StoreFloor store={vs} ontap={tapView} /></div>{/key}
				{:else}
					<p class="muted small">This player shared just their favourite tank (before whole stores could be shared).</p>
				{/if}
				{#if !viewStore}{@render tankLook()}{/if}
			</div>
		</div>
		{#if viewStore && viewTank}
			<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (viewSel = null)}>
				<div class="dlg wide visit">
					<button class="x" aria-label="Close" onclick={() => (viewSel = null)}>✕</button>
					<h3>{v.store}</h3>
					{@render tankLook()}
					<div class="row"><button onclick={() => (viewSel = null)}>← Back to the store</button></div>
				</div>
			</div>
		{/if}
	{/if}

	{#if wikiSel}
		{@const sp = species(wikiSel)}
		{@const lvl = s.research[sp.id] ?? 0}
		{@const task = researchTask(sp.id)}
		{@const ord = orderPrice(sp)}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (wikiSel = null)}>
			<div class="dlg wide">
				<button class="x" aria-label="Close" onclick={() => (wikiSel = null)}>✕</button>
				<div class="wikihead" style="--rc: {RARITY_COLOR[sp.rarity]}">
					<FishIcon id={sp.id} size={130} />
					<div class="fi">
						<h3>{sp.name}</h3>
						<i class="small">{sp.sci}</i>
						<span class="rar" class:mythic={sp.rarity === 'mythic'}>{RARITY_LABEL[sp.rarity]}</span>
						<span class="chips">
							<span>{sp.water === 'salt' ? '🌊 Salt' : '💧 Fresh'}</span>
							<span>{sp.temp === 'cold' ? '❄️ Cold' : '🔥 Tropical'}</span>
							<span>{SIZE_LABEL[sp.size]} · {sp.cm} cm</span>
							{#if sp.predator}<span class="warn">Predator</span>{/if}
							{#if sp.single}<span class="warn">1 per tank</span>{/if}
							{#if sp.alone}<span class="warn">Alone only</span>{/if}
							{#if sp.cleaner}<span class="good">🧽 Clean-up crew</span>{/if}
						</span>
						<span class="price">Store price {money(priceOf(sp))}</span>
						<span class="small">Likes: {sp.likes.map((l) => TANK_DECOR.find((d) => d.id === l)?.name).join(', ')}</span>
						{#if sp.bred}<span class="small limited">✨ Only from breeding: a very rare surprise in a brood.</span>{:else if ALBINO_OF[sp.id]}<span class="small">💞 Breeding these can very rarely give an albino.</span>{:else if sp.id === 'magikarp'}<span class="small">💞 Breeding Magikarp can sometimes give a shiny one.</span>{/if}
					</div>
				</div>
				<h4>🔬 Research · level {lvl}/{RESEARCH_MAX}</h4>
				<span class="pips big">{#each Array(RESEARCH_MAX) as _, i (i)}<i class:on={i < lvl}></i>{/each}</span>
				{#if task}
					<p class="small">{s.staff.find((p) => p.id === task.staff)?.name ?? 'A scientist'} is on it: {time(task.end - store.now)} left.</p>
					<i class="prog"><em style="width: {Math.min(100, ((store.now - task.start) / (task.end - task.start)) * 100)}%"></em></i>
				{:else if lvl < RESEARCH_MAX}
					<p class="muted small">Next level: {money(researchCost(sp, lvl))} and about {time((researchTime(sp, lvl) * 1000) / (ROLES.find((r) => r.id === 'scientist')?.speed ?? 1))}. Needs the research lab and a free Research Scientist.</p>
					<button class="primary" disabled={researchCost(sp, lvl) > s.cash} onclick={() => buy(`Research the ${sp.name} (level ${lvl + 1})?`, researchCost(sp, lvl), () => act(store.research(sp.id)), { yes: 'Research' })}>Research level {lvl + 1}</button>
				{/if}
				{#if lvl >= RESEARCH_MAX}
					<p class="small good">Fully researched: you can order this fish whenever you like.</p>
					<button class="primary" disabled={!store.canAfford(ord.price, ord.currency)} onclick={() => buy(`Order a ${sp.name}?`, ord.price, () => act(store.order(sp.id), 'coin'), { gems: ord.currency === 'gems', yes: 'Order' })}>Order one ({ord.currency === 'gems' ? `💎 ${ord.price}` : money(ord.price)})</button>
				{:else}
					<p class="muted small">At level {RESEARCH_MAX} you can order it for {ord.currency === 'gems' ? `💎 ${ord.price}` : money(ord.price)}.</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if sellDecor !== null}
		{@const d = s.decor.find((x) => x.id === sellDecor)}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (sellDecor = null)}>
			<div class="dlg">
				<button class="x" type="button" aria-label="Close" onclick={() => (sellDecor = null)}>✕</button>
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
	{#if confirmAsk}
		{@const q = confirmAsk}
		{@const rare = rareFish(q.fish)}
		<div class="modal" role="presentation" onclick={(e) => e.target === e.currentTarget && (confirmAsk = null)}>
			<div class="dlg">
				<button class="x" type="button" aria-label="Close" onclick={() => (confirmAsk = null)}>✕</button>
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
	.event {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
		padding: 12px;
		margin-bottom: 12px;
		border-radius: 12px;
		background: linear-gradient(120deg, rgba(249, 115, 22, 0.25), rgba(124, 58, 237, 0.25));
		border: 1px solid rgba(251, 191, 36, 0.5);
	}
	.eicon {
		font-size: 2.4rem;
	}
	.evt {
		font-style: normal;
		font-size: 0.8rem;
		margin-left: auto;
	}
	.limited {
		color: #fbbf24;
	}
	.giftnote {
		position: absolute;
		left: 12px;
		bottom: 12px;
		z-index: 3;
		max-width: min(360px, calc(100% - 90px));
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(6, 22, 34, 0.92);
		border: 1px solid #f59e0b;
		font-size: 0.85rem;
	}
	.luck {
		padding: 2px 8px;
		font-weight: 700;
	}
	.luckline {
		font-size: 0.82rem;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(74, 222, 128, 0.1);
		border: 1px solid rgba(74, 222, 128, 0.35);
	}
	.note,
	.alert,
	.toasts p,
	.giftnote {
		position: relative;
		padding-right: 30px !important;
	}
	.nx {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 0 6px !important;
		min-height: 0 !important;
		line-height: 1.4;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.25) !important;
		border: none !important;
		color: inherit;
		cursor: pointer;
		border-radius: 6px;
	}
	.toasts p {
		pointer-events: auto;
	}
	.sellred {
		background: #dc2626 !important;
		border-color: #b91c1c !important;
		color: #fff !important;
		font-weight: 700;
	}
	.sellred:hover {
		background: #ef4444 !important;
	}
	.star {
		font-size: 1.05rem;
		padding: 2px 8px !important;
		color: #94a3b8;
	}
	.star.on {
		color: #fbbf24;
	}
	.stash {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.stash .item {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
	}
	.stash .item.missing {
		opacity: 0.5;
	}
	.stash .item.mythicitem {
		border: 1px solid rgba(255, 77, 109, 0.5);
	}
	.stash .big {
		font-size: 1.8rem;
		width: 40px;
		text-align: center;
	}
	.chest {
		align-items: center;
		text-align: center;
	}
	.prize {
		font-size: 4rem;
		animation: pop 0.5s ease-out;
	}
	.prizetext {
		font-size: 1.1rem;
	}
	.mythicprize {
		border-color: #ff4d6d;
		box-shadow: 0 0 40px -6px #ff4d6d;
	}
	@keyframes pop {
		from {
			transform: scale(0.2) rotate(-20deg);
			opacity: 0;
		}
	}
	.sex {
		font-weight: 800;
	}
	.sex.m {
		color: #60a5fa;
	}
	.sex.f {
		color: #f472b6;
	}
	.dlg.wide.visit {
		width: min(980px, 100%);
	}
	.visit > * {
		flex-shrink: 0;
	}
	/* Visiting a store: the floor takes all the room the dialog has. */
	.dlg.visit.store {
		height: 100%;
	}
	.visit.store > .visitfloor {
		flex: 1 1 0;
		min-height: 260px;
	}
	.tankscroll {
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		border-radius: 6px;
	}
	.stagescroll,
	.tankwide {
		height: 100%;
	}
	.scrollhint {
		position: absolute;
		left: 50%;
		bottom: 18px;
		transform: translateX(-50%);
		padding: 2px 10px;
		border-radius: 999px;
		background: rgba(7, 18, 28, 0.75);
		color: #cbd5e1;
		font-size: 0.75rem;
		pointer-events: none;
		z-index: 2;
	}
	.browse {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin: 0 32px 4px;
	}
	.browse button {
		min-width: 44px;
		font-size: 1.1rem;
	}
	.eggs {
		display: flex;
		gap: 4px;
		font-size: 1.6rem;
		animation: wobble 2.4s ease-in-out infinite;
	}
	@keyframes wobble {
		50% {
			transform: rotate(4deg);
		}
	}
	.pair {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.pair span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.crates {
		background: #2563eb !important;
	}
	.autotoggle {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 0.85rem;
		margin: 6px 0;
	}
	.wiki {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
		gap: 8px;
		margin: 10px 0;
	}
	.wcard {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 6px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid transparent;
		border-bottom: 3px solid var(--rc);
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		text-align: center;
		cursor: pointer;
	}
	.wcard:hover {
		border-color: var(--rc);
	}
	.wcard.missing {
		cursor: default;
		opacity: 0.55;
	}
	.wcard .qm {
		display: grid;
		place-items: center;
		width: 56px;
		height: 39px;
		font-size: 1.6rem;
		font-weight: 900;
		color: rgba(255, 255, 255, 0.35);
	}
	.pips {
		display: flex;
		gap: 3px;
	}
	.pips i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.15);
	}
	.pips i.on {
		background: #a78bfa;
	}
	.pips.big i {
		width: 16px;
		height: 16px;
	}
	.wikihead {
		display: flex;
		gap: 14px;
		align-items: center;
		flex-wrap: wrap;
	}
	.wikihead h3 {
		margin: 0;
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
	.applybar {
		position: sticky;
		bottom: -16px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin: 4px -16px -16px;
		padding: 10px 16px;
		background: #0b1c2a;
		border-top: 1px solid rgba(42, 176, 232, 0.3);
	}
	.pop .applybar {
		bottom: -14px;
		margin: 4px -14px -14px;
		padding: 10px 14px;
	}
	.applybar span {
		margin-right: auto;
		font-weight: 700;
		color: #fde68a;
	}
	.dlg {
		position: relative;
	}
	.dlg > .x {
		position: absolute;
		top: 10px;
		right: 10px;
		padding: 2px 8px !important;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pick .muted {
		margin-left: auto;
	}
	.tick {
		font-size: 1.05rem;
	}
	.qty {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.qty span {
		flex: 1;
	}
	.qty b {
		min-width: 18px;
		text-align: center;
	}
	.dest .qty button {
		width: auto;
		padding: 2px 10px;
	}
	.cartlist {
		list-style: none;
		margin: 0;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(42, 176, 232, 0.1);
		font-size: 0.85rem;
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
