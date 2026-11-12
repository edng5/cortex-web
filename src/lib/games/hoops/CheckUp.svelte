<!--
  Check-up: 1-on-1 street ball played with your body. The webcam tracks you (in the browser; no
  footage is kept or sent) and your voxel player copies you. Practice records your own jump shot
  and layup as small templates and drills your moves; the Street Ladder is fifteen solo games to 11
  against AI-pun legends, each tougher than the last, with a bigger crowd every rung; online games
  are 1-on-1 by room code with a 24-second shot clock. Achievements and ladder wins unlock gear to
  wear; skill points (hard to come by) raise Shooting, Dribbling and Defense.
-->
<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { GameUiProps } from '$lib/games/registry';
	import { gameAudio } from '$lib/games/audio.svelte';
	import { P, startTracking, type Pose, type Tracker } from './pose';
	import { Motion, type MotionEvent } from './motion';
	import { fromPose, type Joints } from './anim';
	import { createCourt, BROWS, BUILDS, CHECK, EARRINGS, SHAPES, DEFAULT_LOOK, EYES, FACIAL, HAIRS, HAIR_COLORS, HOOP, JERSEYS, MOUTHS, SKINS, type Court, type Look } from './court';
	import { judge, makeTemplate, shotWindow, type ShotKind, type ShotTake, type ShotTemplate } from './shot';
	import { LADDER, leanMove, stepBackTo, SoloGame, START_STATS, STAT_INFO, TO, type Flash, type Stats, type TalkKind } from './game';
	import { UNLOCK_AT, perfectWindow, shotRating } from './shot';
	import { ANYONE, COMMON, INTERLUDES, LINES, MORE, PROLOGUE, type SceneLine } from './lore';
	import { Speaker } from '$lib/voice/speech';
	import ItemIcon from './ItemIcon.svelte';
	import { ACHIEVEMENTS, ALWAYS_ON, COURT_SLOTS, ITEMS, NO_PROGRESS, SLOT_NAMES, courtStyle, howToGet, unlocked as itemUnlocked, wear, type Progress, type Slot } from './items';
	import { Multi, type MultiView } from './multi';
	import { Room, myRating, type Rating, type RoomEvent } from '$lib/games/net';
	import { session } from '$lib/session.svelte';

	let { active, onquit, loggedIn }: GameUiProps = $props();

	// ── Save (follows the account, like the other games) ──
	const KEY = 'checkup-save';
	interface Save {
		look: Look;
		stats: Stats;
		points: number;
		templates: Partial<Record<ShotKind, ShotTemplate>>;
		/** Highest ladder rung unlocked (0-based). */
		unlocked: number;
		/** Ladder opponents beaten (each one's signature item is yours). */
		beaten: number;
		record: { wins: number; losses: number };
		/** Skill points earned in practice today (capped). */
		drill: { day: string; points: number };
		/** Gear worn, by slot (item ids). */
		equipped: Partial<Record<Slot, string | null>>;
		progress: Progress;
		achs: string[];
		/** Cut scenes already watched. */
		seen: string[];
		/** Ladder wins in a row. */
		streak?: number;
	}
	const fresh = (): Save => ({
		look: { ...DEFAULT_LOOK },
		stats: { ...START_STATS },
		points: 1,
		templates: {},
		unlocked: 0,
		beaten: 0,
		record: { wins: 0, losses: 0 },
		drill: { day: '', points: 0 },
		equipped: {},
		progress: { ...NO_PROGRESS },
		achs: [],
		seen: []
	});
	let save = $state<Save>(
		untrack(() => {
			try {
				const s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
				s.progress = { ...NO_PROGRESS, ...s.progress };
				s.stats = { ...START_STATS, ...s.stats };
				// Hairstyles that became gear (headband) or were dropped: back to short.
				if (!(HAIRS as readonly string[]).includes(s.look?.hair)) s.look = { ...DEFAULT_LOOK, ...s.look, hair: 'short' };
				s.seen ??= [];
				s.beaten = Math.max(s.beaten ?? 0, s.unlocked);
				return s;
			} catch {
				return fresh();
			}
		})
	);
	function persist() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ ...$state.snapshot(save), savedAt: Date.now() }));
		} catch {
			/* storage blocked */
		}
	}
	const sfx = (n: string) => gameAudio.play('checkup', n);

	// ── Screens ──
	type Screen = 'menu' | 'ladder' | 'calibrate' | 'game' | 'practice' | 'player' | 'how' | 'achievements' | 'online';
	let screen = $state<Screen>('menu');
	let canvas = $state<HTMLCanvasElement>();
	let video = $state<HTMLVideoElement>();
	let overlay = $state<HTMLCanvasElement>();
	let court: Court | null = null;
	let tracker: Tracker | null = null;
	let camStatus = $state('');
	let camOn = $state(false);
	const motion = new Motion();
	let queue: MotionEvent[] = [];
	let youJ: Joints | null = null;
	let tracked = $state(false);

	function go(s: Screen) {
		sfx('select');
		pending = {};
		screen = s;
		court?.camera(s == 'player' ? (playerTab == 'court' ? 'menu' : 'locker') : s == 'practice' ? 'practice' : s == 'game' || s == 'calibrate' ? 'offense' : 'menu');
		court?.showCpu(s == 'game' || s == 'calibrate' || s == 'online');
		if (s == 'menu' || s == 'ladder' || s == 'how' || s == 'player' || s == 'achievements') {
			game = null;
			// The camera is only on while practising or playing.
			stopCamera();
			court?.ball(s == 'player' ? 'dribble' : 'hidden');
			court?.setYou(null, 0, CHECK.z - 2, -1);
		}
		if (s == 'practice') {
			court?.ball('dribble');
			court?.setCrowd(0);
		}
	}
	$effect(() => {
		if (active) gameAudio.music(screen == 'game' || (screen == 'online' && !!multi && mview.phase != 'wait') ? 'checkup-play' : 'checkup-menu');
	});

	// ── Camera and body tracking ──
	async function ensureCamera(): Promise<boolean> {
		if (tracker) return true;
		if (!video) return false;
		try {
			tracker = await startTracking(video, onPose, (s) => (camStatus = s));
			camOn = true;
			return true;
		} catch (e) {
			camStatus = e instanceof Error && /denied|allowed/i.test(e.message) ? 'Camera blocked. Allow the camera for this site to play.' : `Couldn't start the camera: ${e instanceof Error ? e.message : e}`;
			return false;
		}
	}
	function stopCamera() {
		tracker?.stop();
		tracker = null;
		camOn = false;
	}
	function onPose(p: Pose, t: number) {
		const ev = motion.push(p, t);
		queue.push(...ev);
		tracked = motion.state.tracked;
		const j = fromPose(p);
		const offense = screen == 'practice' || (screen == 'game' && game?.ball == 'you') || (screen == 'online' && !!multi && mview.ball == roomView?.you);
		j.y = (offense ? 0 : motion.state.air * 2.2) - motion.state.crouch * 1.1;
		youJ = motion.state.tracked ? j : null;
		drawSkeleton(p);
	}
	function drawSkeleton(p: Pose) {
		const c = overlay;
		if (!c) return;
		const g = c.getContext('2d')!;
		g.clearRect(0, 0, c.width, c.height);
		g.strokeStyle = '#fb923c';
		g.lineWidth = 3;
		const pt = (i: number) => [(1 - p[i].x) * c.width, p[i].y * c.height] as const;
		for (const [a, b] of [
			[P.lShoulder, P.rShoulder], [P.lShoulder, P.lElbow], [P.lElbow, P.lWrist], [P.rShoulder, P.rElbow], [P.rElbow, P.rWrist],
			[P.lShoulder, P.lHip], [P.rShoulder, P.rHip], [P.lHip, P.rHip], [P.lHip, P.lKnee], [P.lKnee, P.lAnkle], [P.rHip, P.rKnee], [P.rKnee, P.rAnkle]
		]) {
			const [x1, y1] = pt(a);
			const [x2, y2] = pt(b);
			g.beginPath();
			g.moveTo(x1, y1);
			g.lineTo(x2, y2);
			g.stroke();
		}
	}

	// ── Voice: the Cortex voice reads the cut scenes and the opponents' lines ──
	let speaker: Speaker | null = null;
	function speak(text: string) {
		if (gameAudio.muted || !speaker) return;
		speaker.cancel();
		speaker.push(text + ' ');
		speaker.flush();
	}
	let bubble = $state<{ who: string; text: string; at: number } | null>(null);
	let lastTalk = 0;
	const pickOne = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];
	/** A line not said lately (the last 10), so the trash talk doesn't loop. */
	let said: string[] = [];
	function freshLine(pool: string[]) {
		const left = pool.filter((l) => !said.includes(l));
		const line = pickOne(left.length ? left : pool);
		said = [line, ...said.filter((l) => l != line)].slice(0, 10);
		return line;
	}
	function talk(who: string, text: string) {
		bubble = { who, text, at: performance.now() };
		speak(text);
	}
	/** The opponent reacts (not every time, and not too often). */
	function onTalk(k: TalkKind) {
		const t = performance.now();
		const big = k == 'theyBreakYou' || k == 'youBreakThem' || k == 'theyBlock' || k == 'youBlock' || k == 'stolen' || k == 'youDeep';
		if (t - lastTalk < 4000 || (!big && Math.random() < 0.4)) return;
		lastTalk = t;
		const l = LINES[opp.name];
		const more = MORE[opp.name];
		// Their own lines most of the time; sometimes something anyone would say.
		const own = (a: string[] | undefined, b: string[] | undefined, any: string[]) => [...(a ?? []), ...(b ?? []), ...(Math.random() < 0.3 ? any : [])];
		const text =
			k == 'theyScore' ? freshLine(own(l?.score, more?.score, ANYONE.score)) :
			k == 'youScore' ? freshLine(own(l?.youScore, more?.youScore, ANYONE.youScore)) :
			freshLine(COMMON[k]);
		talk(opp.name, text);
	}

	// Cut scenes: letterboxed, captioned, read aloud; tap to go on, or skip.
	let scene = $state<{ lines: SceneLine[]; i: number; at: number; then: () => void } | null>(null);
	let sceneTimer: ReturnType<typeof setTimeout> | undefined;
	let flashAt = $state(0);
	function play(lines: SceneLine[], then: () => void) {
		if (!lines.length) return then();
		scene = { lines, i: 0, at: performance.now(), then };
		showLine();
	}
	function showLine() {
		if (!scene) return;
		const l = scene.lines[scene.i];
		// A hard cut flashes white; a glide moves the camera there slowly.
		court?.camera(l.cam, l.cut == 'flash' ? 'cut' : 'glide');
		if (l.cut == 'flash') {
			flashAt = performance.now();
			sfx('swish');
		}
		court?.showCpu(l.cam == 'intro' || l.cam == 'offense');
		speak(l.text);
		clearTimeout(sceneTimer);
		sceneTimer = setTimeout(nextLine, 1800 + l.text.length * 55);
	}
	function nextLine() {
		if (!scene) return;
		if (scene.i + 1 < scene.lines.length) {
			scene.i++;
			scene.at = performance.now();
			showLine();
		} else endScene();
	}
	function endScene() {
		clearTimeout(sceneTimer);
		speaker?.cancel();
		const then = scene?.then;
		scene = null;
		then?.();
	}

	// ── The Street Ladder ──
	let rung = $state(0);
	let game = $state<SoloGame | null>(null);
	let hud = $state({ you: 0, cpu: 0, flash: null as SoloGame['flash'], bar: null as SoloGame['bar'], phase: '' as string, ball: 'you', clock: 15000, hand: 'right' as 'left' | 'right' });
	let result = $state<{ won: boolean; you: number; cpu: number; earned: number; unlockedNext: boolean; item: (typeof ITEMS)[number] | null } | null>(null);
	let calibStart = 0;

	async function pickRung(i: number) {
		if (i > save.unlocked) return;
		rung = i;
		result = null;
		bubble = null;
		go('calibrate');
		court?.setCpuLook(LADDER[i].look);
		court?.setCrowd(i);
		court?.ball('hidden');
		court?.setCpu(CHECK.x, CHECK.z - 1.8, 1, 'stance', 0);
		const intro: SceneLine = { who: LADDER[i].name, cam: 'intro', cut: 'flash', text: LINES[LADDER[i].name]?.intro ?? LADDER[i].tag };
		const first = !save.seen.includes('prologue');
		if (first) {
			save.seen = [...save.seen, 'prologue'];
			persist();
		}
		const camReady = ensureCamera();
		await new Promise<void>((done) => play(first ? [...PROLOGUE, intro] : [intro], done));
		court?.camera('offense');
		court?.showCpu(true);
		if (!(await camReady)) return;
		motion.calibrate();
		calibStart = performance.now();
	}
	function startGame() {
		const lvl = LADDER[rung];
		game = new SoloGame(
			court!,
			lvl,
			save.stats,
			save.templates,
			sfx,
			(winner, score, maxDown) => {
				const won = winner == 'you';
				const firstTime = won && rung == save.beaten;
				// Skill points are hard to come by: a win is worth one (two the first time); a loss, none.
				const earned = won ? 1 + (firstTime ? 1 : 0) : 0;
				save.points += earned;
				if (won) save.record.wins++;
				else save.record.losses++;
				let item = null as (typeof ITEMS)[number] | null;
				if (firstTime) {
					save.beaten = rung + 1;
					save.unlocked = Math.min(save.beaten, LADDER.length - 1);
					item = ITEMS.find((i) => i.from && 'rung' in i.from && i.from.rung == rung) ?? null;
				}
				// Ladder milestones, streaks and games played.
				save.streak = won ? (save.streak ?? 0) + 1 : 0;
				if (save.streak >= 3) achieve('onfire');
				if (save.beaten >= 5) achieve('rising');
				if (save.beaten >= 10) achieve('contender');
				track('games');
				if (won && score.cpu == 0) achieve('shutout');
				if (won && maxDown >= 5) achieve('comeback');
				if (won && rung == LADDER.length - 1) achieve('king');
				persist();
				if (won) court?.cheer();
				const l = LINES[lvl.name];
				if (l) talk(lvl.name, won ? l.lose : l.win);
				const story = firstTime && INTERLUDES[rung] && !save.seen.includes(`story-${rung}`) ? INTERLUDES[rung] : null;
				const show = () => (result = { won, you: score.you, cpu: score.cpu, earned, unlockedNext: firstTime && rung < LADDER.length - 1, item });
				setTimeout(() => {
					if (!story) return show();
					save.seen = [...save.seen, `story-${rung}`];
					persist();
					play(story, () => {
						court?.camera('offense');
						show();
					});
				}, 3200);
			},
			(k) => track(k),
			(k) => onTalk(k)
		);
		screen = 'game';
		court?.showCpu(true);
		game.start(performance.now(), motion.state);
	}

	// ── Practice ──
	type Drill = 'jumpshot' | 'layup' | 'pumpfake' | 'triple' | 'crossover' | 'inout' | 'spin' | 'stepback' | 'drive' | 'sprint' | 'swipe' | 'jump';
	const DRILLS: { id: Drill; name: string; how: string }[] = [
		{ id: 'jumpshot', name: 'Jump shot', how: 'Bring both hands up together above your shoulders (your set point), then shoot: hands up over your head, arms extended. Record 3 to set your timing, then drill it: release in the green.' },
		{ id: 'layup', name: 'Layup', how: "Step in and reach one hand high above your head while the other stays low. No timing: it's your Finishing and how well you're guarded." },
		{ id: 'pumpfake', name: 'Pump fake', how: 'From your set point, bring the ball up part way and back down without shooting. Defenders who bite jump out of position.' },
		{ id: 'triple', name: 'Triple threat', how: 'Knees bent, both hands together at your waist, hold it a moment. Your next move is quicker.' },
		{ id: 'crossover', name: 'Crossover', how: 'Hands low (dribbling height): swing them across your body, from one side to the other. A quick swing is enough.' },
		{ id: 'inout', name: 'In-and-out', how: 'Hands low on one side: push them in toward the middle and straight back out.' },
		{ id: 'spin', name: 'Spin move', how: 'Turn all the way round, quickly, and face the camera again.' },
		{ id: 'stepback', name: 'Step-back', how: 'Lean back sharply, or hop back away from the camera: a quick burst away from your defender to make room for a jumper.' },
		{ id: 'drive', name: 'Attack dribble', how: 'On offense, pound the ball: one hand low, bouncing hard and fast. You take off toward the rim, faster the longer you keep it up. Lean back to stop.' },
		{ id: 'sprint', name: 'Sprint back', how: 'On defense, run in place: knees up, arms pumping. You sprint back in front of the ball handler, even after he has gone by you.' },
		{ id: 'swipe', name: 'Steal', how: 'On defense, swipe one hand quickly across in front of you at waist or chest height. Close to him, it can strip the ball. Miss and you are off balance for a moment.' },

	];
	let drill = $state<Drill>('jumpshot');
	let counts = $state<Record<Drill, number>>({ jumpshot: 0, layup: 0, pumpfake: 0, triple: 0, crossover: 0, inout: 0, spin: 0, stepback: 0, drive: 0, sprint: 0, swipe: 0, jump: 0 });
	let takes = $state<ShotTake[]>([]);
	let recording = $state(false);
	let pBar = $state<{ start: number; release: number; zone: number; stop: number | null } | null>(null);
	let pNote = $state<Flash | null>(null);
	let lastShot = $state<string>('');
	let shootingBusy = false;

	async function openPractice() {
		go('practice');
		if (await ensureCamera()) motion.calibrate();
	}
	function note(text: string, color = '#fde68a', extra: Partial<Flash> = {}) {
		pNote = { text, color, at: performance.now(), kind: 'info', ...extra };
	}
	function practiceEvents(events: MotionEvent[], now: number) {
		for (const e of events) {
			if (e.type == 'set') {
				const t = save.templates.jumpshot;
				pBar = { start: now, release: t?.release ?? 700, zone: t ? shotWindow(t, save.stats.shooting) : 0, stop: null };
				court?.ball('hold');
			} else if (e.type == 'cancel') {
				pBar = null;
				court?.ball('dribble');
			} else if (e.type == 'pumpfake') {
				pBar = null;
				court?.ball('dribble');
				bump('pumpfake', 'Pump fake');
			} else if (e.type == 'triple') {
				bump('triple', 'Triple threat');
				track('triples');
			}
			else if (e.type == 'move') {
				if (e.move == 'crossover') {
					// The ball crosses from the hand it's in; crossing toward that same hand loses it.
					if (e.to == pHand) {
						note('Lost the ball!', '#f87171', { sub: `It was in your ${pHand} hand: cross the other way`, kind: 'bad' });
						sfx('steal');
						continue;
					}
					pHand = pHand == 'right' ? 'left' : 'right';
					court?.setYouHand(pHand);
				}
				bump(e.move, { crossover: 'Crossover', inout: 'In-and-out', spin: 'Spin move' }[e.move]);
				if (e.move == 'spin') court?.spin('you');
			} else if (e.type == 'sprint') bump('sprint', 'Sprint');
			else if (e.type == 'swipe') {
				bump('swipe', 'Swipe');
				sfx('steal');
			} else if (e.type == 'stepback') {
				bump('stepback', 'Step-back');
				practiceBurst = { from: { ...practicePos }, to: stepBackTo(practicePos), at: now };
			}

			else if (e.type == 'shot') practiceShot(e.take, now);
		}
	}
	function bump(d: Drill, label: string) {
		counts[d]++;
		sfx('move');
		note(`${label} ✓`, '#86efac');
		track('reps');
		if (counts[d] % 25 == 0) award(`25 ${label.toLowerCase()}s`);
	}
	function award(why: string) {
		const day = new Date().toISOString().slice(0, 10);
		if (save.drill.day != day) save.drill = { day, points: 0 };
		if (save.drill.points >= 2) return;
		save.drill.points++;
		save.points++;
		persist();
		note(`+1 skill point: ${why}`, '#facc15');
		sfx('recorded');
	}
	async function practiceShot(take: ShotTake, now: number) {
		if (pBar) pBar.stop = now - pBar.start;
		const kind = take.kind;
		if (recording && drill == kind) {
			takes = [...takes, take];
			sfx('move');
			note(`Take ${takes.length} of 3`, '#93c5fd');
			if (takes.length >= 3) {
				save.templates[kind] = makeTemplate(takes);
				persist();
				takes = [];
				recording = false;
				note(`${kind == 'layup' ? 'Layup' : 'Jump shot'} recorded`, '#86efac');
				sfx('recorded');
			}
			court?.ball('hold');
			if (!shootingBusy) {
				shootingBusy = true;
				await court?.shoot(true);
				shootingBusy = false;
			}
			setTimeout(() => (pBar = null), 700);
			court?.ball('dribble');
			return;
		}
		const dist = Math.hypot(practicePos.x - HOOP.x, practicePos.z - HOOP.z);
		const d = kind == 'layup' ? 2 : dist;
		const r = judge(take, save.templates[kind] ?? null, shotRating(save.stats, kind, d), d);
		const made = Math.random() < r.chance;
		note(kind == 'layup' ? 'Layup' : 'Jumper', '#e2e8f0', {
			sub: save.templates[kind] ? `${r.error > 0 ? '+' : ''}${r.error} ms` : 'Record it to time it',
			kind: 'shot',
			pct: Math.round(r.chance * 100),
			grade: save.templates[kind] ? r.grade : undefined
		});
		lastShot = `${kind == 'layup' ? 'Layup' : 'Jumper'}: ${r.grade}${save.templates[kind] ? ` (${r.error > 0 ? '+' : ''}${r.error} ms)` : ' (record it for timing)'} · ${Math.round(r.chance * 100)}%`;
		if (r.grade == 'perfect') sfx('perfect');
		counts[kind]++;
		track('reps');
		if (counts[kind] % 25 == 0) award(`25 ${kind == 'layup' ? 'layups' : 'jump shots'}`);
		if (shootingBusy) return;
		shootingBusy = true;
		court?.ball('hold');
		await court?.shoot(made);
		sfx(made ? 'swish' : 'rim');
		shootingBusy = false;
		pBar = null;
		court?.ball('dribble');
	}
	// In practice you move around the court too (from where you started).
	let practicePos = { x: 0, z: -2 };
	/** The hand with the ball in practice. */
	let pHand = $state<'left' | 'right'>('right');
	let pDrive = 0;
	let pDriving = false;
	let practiceBurst: { from: { x: number; z: number }; to: { x: number; z: number }; at: number } | null = null;

	// ── Player: look, gear and stats ──
	/** Your look with your gear on. */
	function effLook(): Look {
		let l: Look = { ...save.look, shoes: undefined, hat: null, band: null, sleeve: null, wrist: null, goggles: false, chain: null, knee: null };
		for (const [slot, id] of Object.entries(save.equipped) as [Slot, string | null][]) {
			const it = ITEMS.find((i) => i.id == id);
			if (it && owns(it)) l = wear(l, it, slot);
		}
		return l;
	}
	const owns = (it: (typeof ITEMS)[number]) => itemUnlocked(it, save.beaten, save.achs);
	/** The court as you've styled it. */
	function courtLook() {
		const chosen: Partial<Record<Slot, (typeof ITEMS)[number] | null>> = {};
		for (const slot of COURT_SLOTS) {
			const it = ITEMS.find((i) => i.id == save.equipped[slot]);
			chosen[slot] = it && owns(it) ? it : null;
		}
		return courtStyle(chosen);
	}
	/** A hairstyle you have to earn (from the ladder), if it's one. */
	const hairItem = (h: string) => ITEMS.find((i) => i.slot == 'hair' && i.value == h);
	function setLook(patch: Partial<Look>) {
		save.look = { ...save.look, ...patch };
		// Picking a plain jersey or hair colour takes off a special one.
		if (patch.jersey) save.equipped.jersey = null;
		if (patch.hairColor) save.equipped.hairColor = null;
		court?.setLook(effLook());
		persist();
		sfx('select');
	}
	function equip(slot: Slot, id: string | null) {
		save.equipped[slot] = save.equipped[slot] == id && !ALWAYS_ON.includes(slot) ? null : id;
		court?.setLook(effLook());
		court?.setStyle(courtLook());
		persist();
		sfx('select');
	}
	// Spending skill points: + and − set aside points (nothing is spent yet); Apply spends them,
	// Cancel puts them back.
	let pending = $state<Partial<Record<keyof Stats, number>>>({});
	const spent = $derived(Object.values(pending).reduce((a, n) => a + (n ?? 0), 0));
	const left = $derived(save.points - spent);
	function raise(k: keyof Stats) {
		if (left <= 0 || save.stats[k] + (pending[k] ?? 0) >= 99) return;
		pending[k] = (pending[k] ?? 0) + 1;
		sfx('move');
	}
	function lower(k: keyof Stats) {
		if (!pending[k]) return;
		pending[k]! -= 1;
		sfx('select');
	}
	function applyPoints() {
		if (spent <= 0 || spent > save.points) return;
		for (const [k, n] of Object.entries(pending) as [keyof Stats, number][]) save.stats[k] = Math.min(99, save.stats[k] + n);
		save.points -= spent;
		pending = {};
		persist();
		sfx('recorded');
	}
	function cancelPoints() {
		pending = {};
		sfx('select');
	}
	// Achievements: counters, and the gear (and a skill point) each one unlocks.
	let toast = $state<{ text: string; sub: string; at: number } | null>(null);
	function track(k: keyof Progress) {
		save.progress[k]++;
		for (const a of ACHIEVEMENTS) if (a.count && a.count.key == k && save.progress[k] >= a.count.n) achieve(a.id);
		persist();
	}
	function achieve(id: string) {
		if (save.achs.includes(id)) return;
		save.achs = [...save.achs, id];
		save.points++;
		const a = ACHIEVEMENTS.find((x) => x.id == id)!;
		const item = ITEMS.find((i) => i.from && 'ach' in i.from && i.from.ach == id);
		toast = { text: `🏆 ${a.name}`, sub: `+1 skill point${item ? ` · unlocked ${item.name}` : ''}`, at: performance.now() };
		sfx('recorded');
		persist();
	}
	/** Phones: how much of the screen a menu sheet takes. */
	let sheet = $state<'half' | 'max' | 'min'>('half');
	// My player's tabs; the Court tab shows the whole court so you can see it change.
	let playerTab = $state<'look' | 'gear' | 'court' | 'stats'>('look');
	function pickTab(t: typeof playerTab) {
		pending = {};
		playerTab = t;
		court?.camera(t == 'court' ? 'menu' : 'locker');
		sfx('select');
	}
	const SLOTS: Slot[] = ['shoes', 'hat', 'band', 'sleeve', 'wrist', 'goggles', 'chain', 'knee', 'jersey', 'hairColor'];
	/** What's on when nothing's been picked in a slot (its free item). */
	const defaultFor = (slot: Slot) => ITEMS.find((i) => i.slot == slot && !i.from)?.id;

	// ── Online 1-on-1 ──
	let room: Room | null = null;
	let roomView = $state<{ code: string; you: number; phase: string; round: number; players: ({ name: string; online: boolean } | null)[] } | null>(null);
	let multi = $state<Multi | null>(null);
	let mview = $state<MultiView>({ score: [0, 0], ball: 0, phase: 'wait', clock: 24000, flash: null, winner: null });
	let rating = $state<Rating | null>(null);
	let onlineErr = $state('');
	let onlineNote = $state('');
	let joinCode = $state('');
	let busy = $state(false);
	let mEnd = $state<{ won: boolean; score: [number, number]; mmr?: number; delta?: number } | null>(null);
	let iRematch = $state(false);
	let theyRematch = $state(false);

	async function openOnline() {
		go('online');
		onlineErr = '';
		court?.setCrowd(5);
		if (loggedIn) rating = await myRating('checkup');
	}
	async function createRoom() {
		busy = true;
		onlineErr = '';
		const r = await Room.create('checkup');
		busy = false;
		if ('error' in r) return (onlineErr = r.error);
		openRoom(r.code);
	}
	async function joinRoom(e: SubmitEvent) {
		e.preventDefault();
		const code = joinCode.replace(/\D/g, '');
		busy = true;
		onlineErr = '';
		const r = await Room.join(code, 'checkup');
		busy = false;
		if ('error' in r) return (onlineErr = r.error);
		openRoom(code);
	}
	async function openRoom(code: string) {
		mEnd = null;
		room = new Room(code, onRoom);
		room.listen();
		if (await ensureCamera()) motion.calibrate();
	}
	function onRoom(e: RoomEvent) {
		if (e.t == 'room') {
			const v = e as unknown as NonNullable<typeof roomView>;
			const newRound = roomView && v.round != roomView.round;
			roomView = v;
			if (v.phase == 'playing' && !multi && court && room) {
				const me = { name: session.playerName || 'You', look: effLook(), stats: { ...save.stats } };
				multi = new Multi(court, v.you as 0 | 1, room, me, save.templates, sfx, onMultiEnd, (k) => track(k));
				court.showCpu(true);
				multi.hello();
			} else if (newRound && multi) {
				mEnd = null;
				iRematch = theyRematch = false;
				multi.restart();
			}
		} else if (e.t == 'relay') multi?.onRelay(e.msg as Record<string, unknown>);
		else if (e.t == 'end') {
			const r = (e.ratings as { mmr: number; delta: number }[] | null)?.[roomView?.you ?? 0];
			if (mEnd && r) mEnd = { ...mEnd, mmr: r.mmr, delta: r.delta };
			else if (r) pendingRating = r;
		} else if (e.t == 'rematch') {
			if (e.seat != roomView?.you) theyRematch = true;
		} else if (e.t == 'left') onlineNote = 'Your opponent left.';
		else if (e.t == 'closed') {
			if (roomView) onlineNote ||= 'The room closed.';
			leaveRoom(false);
		}
	}
	let pendingRating: { mmr: number; delta: number } | null = null;
	function onMultiEnd(winner: 0 | 1, score: [number, number]) {
		const won = winner == roomView?.you;
		if (multi?.host) void room?.send({ type: 'result', winner });
		track('online');
		if (won) {
			track('onlineWins');
			court?.cheer();
		}
		mEnd = { won, score, ...(pendingRating ?? {}) };
		pendingRating = null;
		setTimeout(async () => (rating = await myRating('checkup')), 800);
	}
	function rematch() {
		iRematch = true;
		void room?.send({ type: 'rematch' });
	}
	function leaveRoom(send = true) {
		if (send) room?.leave();
		else room?.stop();
		room = null;
		roomView = null;
		multi = null;
		mEnd = null;
		iRematch = theyRematch = false;
		mview = { score: [0, 0], ball: 0, phase: 'wait', clock: 24000, flash: null, winner: null };
		court?.camera('menu');
		court?.ball('hidden');
	}
	$effect(() => () => room?.leave());

	// ── The loop ──
	let raf = 0;
	let now = $state(0);
	function frame(t: number) {
		raf = requestAnimationFrame(frame);
		now = t;
		const events = queue;
		queue = [];
		if (screen == 'calibrate') {
			court?.setYou(youJ, CHECK.x, CHECK.z, -1);
			court?.setCpu(CHECK.x, CHECK.z - 1.8, 1, 'stance', 0);
			if (motion.calibrated && t - calibStart > 2000) startGame();
		} else if (screen == 'game' && game) {
			for (const e of events) if (e.type == 'triple') track('triples');
			game.update(t, motion.state, events, youJ);
			hud = { you: game.score.you, cpu: game.score.cpu, flash: game.flash, bar: game.bar, phase: game.phase, ball: game.ball, clock: game.shotClock(t), hand: game.ballHand };
		} else if (screen == 'online' && multi) {
			multi.frame(t, motion.state, events, youJ);
			mview = { ...multi.view };
		} else if (screen == 'practice') {
			const m = motion.state;
			// Lean to move, toward your dribbling hand's side, like in a game.
			const pounding = m.dribbling && m.lean >= 0 && !m.setting;
			if (pounding && !pDriving) bump('drive', 'Attack dribble');
			pDriving = pounding;
			pDrive += ((pounding ? 1 : 0) - pDrive) * (pounding ? 0.05 : 0.1);
			const lean = pDrive > 0.05 ? Math.max(m.lean, 0.35 + pDrive * 0.65) : m.lean;
			let p = leanMove(practicePos, { ...m, lean, hand: pHand }, ((6 + save.stats.speed * 0.05) / 60) * (1 + pDrive * 0.9), -1);
			if (practiceBurst && t - practiceBurst.at < 300) {
				const k = 1 - (1 - (t - practiceBurst.at) / 300) ** 2;
				p = { x: practiceBurst.from.x + (practiceBurst.to.x - practiceBurst.from.x) * k, z: practiceBurst.from.z + (practiceBurst.to.z - practiceBurst.from.z) * k };
			}
			practicePos = { x: Math.max(-11, Math.min(11, p.x)), z: Math.max(-12.5, Math.min(8, p.z)) };
			court?.setYou(youJ, practicePos.x, practicePos.z, { x: HOOP.x, z: HOOP.z });
			practiceEvents(events, t);
		}
	}

	onMount(async () => {
		speaker = new Speaker();
		const unlock = () => speaker?.unlock();
		addEventListener('pointerdown', unlock, { once: true });
		if (!canvas) return;
		try {
			court = await createCourt(canvas);
			court.onBounce = () => sfx('bounce');
			const narrow = matchMedia('(max-width: 720px)');
			court.setCompact(narrow.matches);
			narrow.addEventListener('change', (e) => court?.setCompact(e.matches));
			court.setLook(effLook());
			court.setStyle(courtLook());
			court.setCrowd(Math.min(save.unlocked, 7));
			court.camera('menu');
			court.setYou(null, 0, CHECK.z - 2, -1);
		} catch {
			camStatus = "Couldn't start 3D graphics in this browser.";
		}
		raf = requestAnimationFrame(frame);
	});
	onDestroy(() => {
		speaker?.cancel();
		clearTimeout(sceneTimer);
		cancelAnimationFrame(raf);
		stopCamera();
		court?.dispose();
	});
	// Hidden (another game showing): let go of the camera.
	$effect(() => {
		if (!active) untrack(stopCamera);
	});

	const span = $derived(pBar ? pBar.release * 2 : 1400);
	const fillOf = (b: { start: number; stop?: number | null }, sp: number) => Math.min(1, (b.stop ?? now - b.start) / sp);
	const flashOn = $derived(hud.flash && now - hud.flash.at < 1800);
	const mFlashOn = $derived(mview.flash && now - mview.flash.at < 1800);
	const otherName = $derived(multi?.other?.name ?? roomView?.players?.[1 - (roomView?.you ?? 0)]?.name ?? 'Opponent');
	const opp = $derived(LADDER[rung]);
	function quitGame() {
		game = null;
		result = null;
		court?.setCrowd(Math.min(save.unlocked, 7));
		go('ladder');
	}
</script>

{#snippet scoreboard(you: number, them: number, name: string, mine: boolean, clock: number, hand: 'left' | 'right')}
	<div class="board">
		<div class="side you" class:has={mine}><span class="nm">YOU</span><span class="pts">{you}</span></div>
		<div class="center">
			<span class="to">FIRST TO {TO}</span>
			<span class="clock" class:low={clock < 5000}>{Math.ceil(clock / 1000)}</span>
		</div>
		<div class="side them" class:has={!mine}><span class="pts">{them}</span><span class="nm">{name}</span></div>
	</div>
	{#if mine}<div class="handtag">🏀 {hand} hand</div>{/if}
{/snippet}
{#snippet sheetBtns()}
	<span class="sheet-btns">
		<button class="ghost small" aria-label={sheet == 'min' ? 'Show the menu' : 'Minimise the menu'} onclick={() => (sheet = sheet == 'min' ? 'half' : 'min')}>{sheet == 'min' ? '▲' : '▼'}</button>
		<button class="ghost small" aria-label={sheet == 'max' ? 'Half screen' : 'Full screen'} onclick={() => (sheet = sheet == 'max' ? 'half' : 'max')}>{sheet == 'max' ? '⤓' : '⤒'}</button>
	</span>
{/snippet}
{#snippet ticker(f: Flash)}
	<!-- What just happened, in one line under the scoreboard. -->
	<div class="ticker" style="--c:{f.color}">
		<b>{f.text}</b>
		{#if f.grade}<span class="grade g-{f.grade}">{f.grade}</span>{/if}
		{#if f.pct != null}<em>{f.pct}%</em>{/if}
		{#if f.sub}<span class="tsub">{f.sub}</span>{/if}
	</div>
{/snippet}
{#snippet pop(f: Flash)}
	<div class="pop k-{f.kind ?? 'info'}" style="--c:{f.color}">
		<span class="ico" aria-hidden="true">{({ shot: '🏀', make: '🔥', miss: '💨', move: '⚡', bad: '😬', block: '🖐️', info: '💬' } as Record<string, string>)[f.kind ?? 'info']}</span>
		<div class="pbody">
			<b>{f.text}</b>
			{#if f.sub}<span class="psub">{f.sub}</span>{/if}
			{#if f.pct != null}
				<div class="pct">
					<div class="track"><i style="width:{f.pct}%"></i></div>
					<em>{f.pct}%</em>
					{#if f.grade}<span class="grade g-{f.grade}">{f.grade}</span>{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<svelte:window
	onkeydown={(e) => {
		if (!scene || !active) return;
		if (e.key == 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			endScene();
		} else if (e.key == ' ' || e.key == 'Enter') {
			e.preventDefault();
			nextLine();
		}
	}}
/>

<div class="checkup">
	<canvas class="three" bind:this={canvas}></canvas>

	<!-- The camera's view (mirrored) with your skeleton: only while playing or practising. -->
	<div class="cam" class:show={camOn && (screen == 'game' || screen == 'practice' || screen == 'calibrate' || (screen == 'online' && !!roomView))}>
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted></video>
		<canvas bind:this={overlay} width="320" height="240"></canvas>
		{#if camOn && !tracked}<p>Step into view</p>{/if}
	</div>

	{#if screen == 'menu'}
		<div class="menu">
			<div class="logo-wrap">
				<img class="crest" src="/games/checkup-crest.png" alt="" width="200" height="200" />
				<h1 class="logo"><span>CHECK</span><span class="dash">-</span><span>UP</span></h1>
			</div>
			<p class="sub">1-on-1 street ball. Your body is the controller.</p>
			<div class="buttons">
				<button class="big" onclick={() => go('ladder')}>Street Ladder<small>Solo · {save.unlocked + 1}/{LADDER.length} unlocked</small></button>
				<button onclick={openPractice}>Practice<small>Record your shot, drill your moves</small></button>
				<button onclick={openOnline}>Online 1-on-1<small>Play a friend with a room code</small></button>
				<button onclick={() => go('player')}>My player<small>Look, gear and stats · {save.points} skill point{save.points == 1 ? '' : 's'}</small></button>
				<button onclick={() => go('achievements')}>Achievements<small>{save.achs.length}/{ACHIEVEMENTS.length} · unlock gear</small></button>
				<button onclick={() => go('how')}>How to play</button>
				<button class="ghost" onclick={onquit}>Quit</button>
			</div>
			<p class="privacy">Uses your camera. Everything stays on this device: no video is saved or sent.</p>
		</div>
	{:else if screen == 'ladder'}
		<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel ladder">
			<header><h2>Street Ladder</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
			<p class="hint">Beat each player to unlock the next. The crowd grows as you climb. First to {TO}, ones and twos, make it take it.</p>
			<ol>
				{#each LADDER as l, i (l.name)}
					<li>
						<button class="rung" class:locked={i > save.unlocked} class:beaten={i < save.unlocked} disabled={i > save.unlocked} onclick={() => pickRung(i)}>
							<span class="n">{i + 1}</span>
							<span class="who"><b>{i > save.unlocked ? '???' : l.name}</b><small>{i > save.unlocked ? 'Locked' : l.tag}</small></span>
							<span class="rate">{i > save.unlocked ? '🔒' : `SHT ${l.shooting} · DRB ${l.dribbling} · DEF ${l.defense}`}</span>
						</button>
					</li>
				{/each}
			</ol>
			{#if camStatus}<p class="err">{camStatus}</p>{/if}
		</div>
	{:else if screen == 'calibrate' && !scene}
		<div class="center-card">
			<h2>vs {opp.name}</h2>
			<p>{opp.tag}</p>
			{#if !camOn}
				<p class="hint">{camStatus || 'Starting the camera…'}</p>
				{#if camStatus}<button onclick={() => pickRung(rung)}>Try again</button>{/if}
			{:else if !tracked}
				<p class="hint">Step back until the camera sees you from head to knees.</p>
			{:else}
				<p class="hint">Stand where you'll play from and hold still… this is the top of the key.</p>
				<div class="dots"><i></i><i></i><i></i></div>
			{/if}
			<button class="ghost small" onclick={quitGame}>Cancel</button>
		</div>
	{:else if screen == 'game'}
		{@render scoreboard(hud.you, hud.cpu, opp.name, hud.ball == 'you', hud.clock, hud.hand)}
		<button class="leave" onclick={quitGame}>Leave</button>
		{#if flashOn && hud.flash}
			{#key hud.flash.at}{@render ticker(hud.flash)}{/key}
		{/if}
		{#if hud.bar}
			<div class="bar">
				<div class="fill" style="width:{fillOf(hud.bar, hud.bar.release * 2) * 100}%"></div>
				<div class="zone" style="left:{((hud.bar.release - hud.bar.zone) / (hud.bar.release * 2)) * 100}%; width:{((2 * hud.bar.zone) / (hud.bar.release * 2)) * 100}%"></div>
				<div class="perfect" style="left:{((hud.bar.release - perfectWindow(hud.bar.zone)) / (hud.bar.release * 2)) * 100}%; width:{((2 * perfectWindow(hud.bar.zone)) / (hud.bar.release * 2)) * 100}%"></div>
				<div class="mark"></div>
			</div>
		{/if}
		{#if result}
			<div class="center-card result">
				<h2>{result.won ? 'You win!' : `${opp.name} wins`}</h2>
				<p class="final">{result.you} – {result.cpu}</p>
				<p class="earned">+{result.earned} skill point{result.earned == 1 ? '' : 's'}{result.unlockedNext ? ` · ${LADDER[rung + 1].name} unlocked` : ''}</p>
				{#if result.item}<p class="item"><ItemIcon item={result.item} size={40} /> New gear: {result.item.name}</p>{/if}
				<div class="row">
					{#if result.won && rung + 1 <= save.unlocked && rung + 1 < LADDER.length}
						<button onclick={() => pickRung(rung + 1)}>Next: {LADDER[rung + 1].name}</button>
					{/if}
					<button class={result.won ? 'ghost' : ''} onclick={() => pickRung(rung)}>Run it back</button>
					<button class="ghost" onclick={quitGame}>Ladder</button>
				</div>
			</div>
		{/if}
	{:else if screen == 'practice'}
		<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel practice">
			<header><h2>Practice</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
			{#if camStatus}<p class="err">{camStatus}</p>{/if}
			<div class="drills">
				{#each DRILLS as d (d.id)}
					<button class:on={drill == d.id} onclick={() => ((drill = d.id), (recording = false), (takes = []))}>
						{d.name}
						<small>{d.id == 'jumpshot' && !save.templates.jumpshot ? 'not recorded' : `${counts[d.id]} done`}</small>
					</button>
				{/each}
			</div>
			{#each DRILLS.filter((d) => d.id == drill) as d (d.id)}
				<p class="how">{d.how}</p>
				{#if d.id == 'layup'}
					{#if lastShot}<p class="last">{lastShot}</p>{/if}
				{:else if d.id == 'jumpshot'}
					{@const t = save.templates.jumpshot}
					{#if t}
						<p class="tpl">Your {d.name.toLowerCase()}: release {t.release} ms (± {t.spread}) · saved in {JSON.stringify(t).length} bytes</p>
					{/if}
					{#if recording}
						<p class="rec">● Recording: take {takes.length + 1} of 3</p>
					{:else}
						<button class="small" onclick={() => ((recording = true), (takes = []), sfx('select'))}>{t ? 'Re-record' : 'Record'} my {d.name.toLowerCase()}</button>
					{/if}
					{#if lastShot && !recording}<p class="last">{lastShot}</p>{/if}
				{/if}
			{/each}
			<p class="foot">Skill points from practice today: {save.drill.day == new Date().toISOString().slice(0, 10) ? save.drill.points : 0}/2 (every 25 reps)</p>
		</div>
		<div class="handtag solo">🏀 {pHand} hand</div>
		{#if pNote && now - pNote.at < 1600}
			{#key pNote.at}{@render ticker(pNote)}{/key}
		{/if}
		{#if pBar}
			<div class="bar">
				<div class="fill" style="width:{fillOf(pBar, span) * 100}%"></div>
				{#if pBar.zone}
					<div class="zone" style="left:{((pBar.release - pBar.zone) / span) * 100}%; width:{((2 * pBar.zone) / span) * 100}%"></div>
					<div class="perfect" style="left:{((pBar.release - perfectWindow(pBar.zone)) / span) * 100}%; width:{((2 * perfectWindow(pBar.zone)) / span) * 100}%"></div>
					<div class="mark"></div>
				{/if}
			</div>
		{/if}
	{:else if screen == 'player'}
		<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel player">
			<header><h2>My player</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
			<div class="tabs" role="tablist">
				{#each [['look', 'Appearance'], ['gear', 'Gear'], ['court', 'Court'], ['stats', 'Attributes']] as const as [id, label] (id)}
					<button role="tab" aria-selected={playerTab == id} class:on={playerTab == id} onclick={() => pickTab(id)}>
						{label}{#if id == 'stats' && save.points}<i class="badge">{save.points}</i>{/if}
					</button>
				{/each}
			</div>
			{#snippet slotRow(slot: Slot)}
				{@const items = ITEMS.filter((i) => i.slot == slot)}
				<div class="gear">
					<span>{SLOT_NAMES[slot]}</span>
					<div class="chips">
						{#if !ALWAYS_ON.includes(slot)}
							<button class:on={!save.equipped[slot]} onclick={() => equip(slot, null)}>None</button>
						{/if}
						{#each items as it (it.id)}
							{@const have = owns(it)}
							<button
								class:on={save.equipped[slot] == it.id || (!save.equipped[slot] && it.id == defaultFor(slot))}
								class:locked={!have}
								disabled={!have}
								title={have ? it.name : `Locked: ${howToGet(it, LADDER.map((l) => l.name))}`}
								onclick={() => equip(slot, it.id)}
							>
								<ItemIcon item={it} size={22} locked={!have} />{have ? it.name : '🔒 ' + it.name}
							</button>
						{/each}
					</div>
				</div>
			{/snippet}
			{#if playerTab == 'look'}
				<h3>Body</h3>
				<div class="gear">
					<span>Build</span>
					<div class="chips">
						{#each BUILDS as b (b)}<button class:on={(save.look.build ?? 'standard') == b} onclick={() => setLook({ build: b })}>{b}</button>{/each}
					</div>
				</div>
				<div class="gear">
					<span>Shape</span>
					<div class="chips">
						{#each SHAPES as b (b)}<button class:on={(save.look.shape ?? 'straight') == b} onclick={() => setLook({ shape: b })}>{b}</button>{/each}
					</div>
				</div>
				<h3>Skin</h3>
				<div class="swatches">{#each SKINS as c (c)}<button class="sw" class:on={save.look.skin == c} style="background:{c}" aria-label="Skin tone" onclick={() => setLook({ skin: c })}></button>{/each}</div>
				<h3>Face</h3>
				{#each [['Eyes', 'eyes', EYES, 'dots'], ['Brows', 'brows', BROWS, 'thin'], ['Mouth', 'mouth', MOUTHS, 'none'], ['Facial hair', 'facial', FACIAL, 'none'], ['Earrings', 'earrings', EARRINGS, 'none']] as const as [label, key, options, dflt] (key)}
					<div class="gear">
						<span>{label}</span>
						<div class="chips">
							{#each options as o (o)}
								<button class:on={(save.look[key] ?? dflt) == o} onclick={() => setLook({ [key]: o })}>{o}</button>
							{/each}
						</div>
					</div>
				{/each}
				<h3>Hair</h3>
				<div class="chips">
					{#each HAIRS as h (h)}
						{@const it = hairItem(h)}
						{@const have = !it || owns(it)}
						<button class:on={save.look.hair == h} class:locked={!have} disabled={!have} title={have ? h : `Locked: ${howToGet(it!, LADDER.map((l) => l.name))}`} onclick={() => setLook({ hair: h })}>{have ? h : '🔒 ' + h}</button>
					{/each}
				</div>
				<div class="swatches">{#each HAIR_COLORS as c (c)}<button class="sw" class:on={save.look.hairColor == c} style="background:{c}" aria-label="Hair colour" onclick={() => setLook({ hairColor: c })}></button>{/each}</div>
				<h3>Jersey</h3>
				<div class="swatches">{#each JERSEYS as c (c)}<button class="sw" class:on={save.look.jersey == c} style="background:{c}" aria-label="Jersey colour" onclick={() => setLook({ jersey: c })}></button>{/each}</div>
				<h3>Shorts</h3>
				<div class="swatches">{#each JERSEYS as c (c)}<button class="sw" class:on={save.look.shorts == c} style="background:{c}" aria-label="Shorts colour" onclick={() => setLook({ shorts: c })}></button>{/each}</div>
				<label class="num">Number <input type="number" min="0" max="99" value={save.look.number} onchange={(e) => setLook({ number: Math.max(0, Math.min(99, Math.round(+e.currentTarget.value) || 0)) })} /></label>
			{:else if playerTab == 'gear'}
				<p class="hint">Earned from the Street Ladder and achievements. Hover a locked one to see how to get it.</p>
				{#each SLOTS as slot (slot)}{@render slotRow(slot)}{/each}
			{:else if playerTab == 'court'}
				<p class="hint">Style the park: floor, paint, backboard, net, ball and half-court logo.</p>
				{#each COURT_SLOTS as slot (slot)}{@render slotRow(slot)}{/each}
			{:else}
				<h3>Attributes <span class="skillpts">{left} skill point{left == 1 ? '' : 's'}{spent ? ` (${spent} to spend)` : ''}</span></h3>
				{#each STAT_INFO as { key: k, name, what } (k)}
					<div class="stat">
						<span
							><b>{name}</b><small>{what}</small>
							{#if k == 'finishing' || k == 'three'}
								<small class="unlock" class:got={save.stats[k] >= UNLOCK_AT}>{save.stats[k] >= UNLOCK_AT ? '✓' : '🔒'} {UNLOCK_AT}: {k == 'finishing' ? 'dunks' : 'deep threes'}</small>
							{/if}</span
						>
						<div class="meter"><i style="width:{save.stats[k]}%"></i>{#if pending[k]}<i class="add" style="width:{pending[k]}%"></i>{/if}</div>
						<em class:up={pending[k]}>{save.stats[k] + (pending[k] ?? 0)}</em>
						<span class="pm">
							<button class="plus" disabled={!pending[k]} onclick={() => lower(k)} aria-label="Lower {name}">−</button>
							<button class="plus" disabled={left <= 0 || save.stats[k] + (pending[k] ?? 0) >= 99} onclick={() => raise(k)} aria-label="Raise {name}">+</button>
						</span>
					</div>
				{/each}
				{#if spent}
					<div class="apply-row">
						<span>Spend {spent} skill point{spent == 1 ? '' : 's'}?</span>
						<button class="ghost small" onclick={cancelPoints}>Cancel</button>
						<button class="small" onclick={applyPoints}>Apply</button>
					</div>
				{/if}
				<p class="foot">Record {save.record.wins}–{save.record.losses}. Earn points by winning ladder games (more the first time), from achievements and a little practice.</p>
			{/if}
		</div>
	{:else if screen == 'achievements'}
		<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel">
			<header><h2>Achievements</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
			<p class="hint">Each one is worth a skill point and unlocks gear. Beating a ladder opponent gives you their signature item too.</p>
			<ul class="achs">
				{#each ACHIEVEMENTS as a (a.id)}
					{@const done = save.achs.includes(a.id)}
					{@const item = ITEMS.find((i) => i.from && 'ach' in i.from && i.from.ach == a.id)}
					<li class:done>
						<div class="ach-text">
							<b>{done ? '🏆' : '🔒'} {a.name}</b>
							<small>{a.what}</small>
							{#if a.count && !done}
								<div class="meter"><i style="width:{Math.min(100, (save.progress[a.count.key] / a.count.n) * 100)}%"></i></div>
								<small>{Math.min(save.progress[a.count.key], a.count.n)} / {a.count.n}</small>
							{/if}
						</div>
						{#if item}
							<!-- The reward: a preview of the gear. -->
							<div class="reward" title={item.name}>
								<ItemIcon {item} size={44} locked={!done} />
								<small>{item.name}</small>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{:else if screen == 'online'}
		{#if !roomView}
			<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel">
				<header><h2>Online 1-on-1</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
				{#if !loggedIn}
					<p class="hint">Log in to play online and keep a rating.</p>
					<button onclick={() => (session.loginOpen = true)}>Log in</button>
				{:else}
					<p class="hint">First to {TO}, ones and twos, make it take it, with a 24-second shot clock. Your rating goes up and down with wins and losses (only you see it). Your camera stays on your device: only your movements (a few numbers) are sent.</p>
					<div class="statsrow"><span>Rating <b>{rating?.mmr ?? '…'}</b></span><span>W {rating?.wins ?? 0}</span><span>L {rating?.losses ?? 0}</span></div>
					<button disabled={busy} onclick={createRoom}>Create a room</button>
					<form class="join" onsubmit={joinRoom}>
						<input bind:value={joinCode} inputmode="numeric" maxlength="7" placeholder="Room code" aria-label="Room code" />
						<button class="ghost" disabled={busy || joinCode.replace(/\D/g, '').length != 6}>Join</button>
					</form>
				{/if}
				{#if onlineErr}<p class="err">{onlineErr}</p>{/if}
				{#if onlineNote}<p class="hint">{onlineNote}</p>{/if}
			</div>
		{:else if roomView.phase == 'waiting' || !multi || mview.phase == 'wait'}
			<div class="center-card">
				<h2>Room code</h2>
				<p class="code">{roomView.code}</p>
				<p class="hint">{roomView.phase == 'waiting' ? 'Send this code to a friend. The game starts when they join.' : 'Getting ready…'}</p>
				{#if camOn && !tracked}<p class="hint">Step back so the camera sees you head to knees.</p>{/if}
				{#if camStatus}<p class="err">{camStatus}</p>{/if}
				<div class="dots"><i></i><i></i><i></i></div>
				<button class="ghost small" onclick={() => leaveRoom()}>Leave</button>
			</div>
		{:else}
			{@const me = roomView.you}
			{@render scoreboard(mview.score[me], mview.score[1 - me], otherName, mview.ball == me, mview.clock, multi?.hands[me] ?? 'right')}
			<button class="leave" onclick={() => leaveRoom()}>Leave</button>
			{#if mFlashOn && mview.flash}
				{#key mview.flash.at}{@render ticker(mview.flash)}{/key}
			{/if}
			{#if mEnd}
				<div class="center-card result">
					<h2>{mEnd.won ? 'You win!' : `${otherName} wins`}</h2>
					<p class="final">{mEnd.score[me]} – {mEnd.score[1 - me]}</p>
					{#if mEnd.mmr}<p class="earned">Rating {mEnd.mmr} ({(mEnd.delta ?? 0) > 0 ? '+' : ''}{mEnd.delta})</p>{/if}
					<div class="row">
						{#if !onlineNote}<button disabled={iRematch} onclick={rematch}>{iRematch ? 'Waiting…' : theyRematch ? 'Accept rematch' : 'Rematch'}</button>{/if}
						<button class="ghost" onclick={() => leaveRoom()}>Leave</button>
					</div>
					{#if onlineNote}<p class="hint">{onlineNote}</p>{/if}
				</div>
			{/if}
		{/if}
	{:else if screen == 'how'}
		<div class:sheetmax={sheet == 'max'} class:sheetmin={sheet == 'min'} class="panel how-to">
			<header><h2>How to play</h2>{@render sheetBtns()}<button class="ghost small" onclick={() => go('menu')}>‹ Back</button></header>
			<ul>
				<li><b>Set up:</b> stand 2–3 m from the camera so it sees you head to knees, in good light, with room to step around.</li>
				<li><b>Move:</b> lean toward the camera to drive at the hoop, lean back to retreat. You go toward the side of the hand you're dribbling with (dribble right to go right). Pound the dribble (one hand bouncing hard) to explode toward the rim. On defense, lean toward or away from your man and slide your feet sideways; run in place to sprint back in front of him.</li>
				<li><b>Shoot:</b> both hands up together, then release over your head. Time it to your recorded release: the green zone on the shot bar.</li>
				<li><b>Layup:</b> near the rim, reach one hand high.</li>
				<li><b>Shake him:</b> crossover, in-and-out or spin (hands low) when he's close. Triple threat first makes it quicker. Pump fake to make him jump.</li>
				<li><b>Defend:</b> stay in front of him, and jump with his release to block. Swipe a hand across to go for the steal (miss and you're off balance).</li>
				<li><b>Score:</b> ones inside the arc, twos from behind it. First to {TO}, with a 24-second shot clock.</li>
				<li><b>Make it, take it:</b> score and you keep the ball. Miss, get blocked or get stripped, and it's theirs.</li>
				<li><b>Gear:</b> beat ladder opponents for their signature items, and earn the rest with achievements.</li>
			</ul>
		</div>
	{/if}
	{#if toast && now - toast.at < 3500}
		{#key toast.at}<div class="toast"><b>{toast.text}</b><span>{toast.sub}</span></div>{/key}
	{/if}
	{#if bubble && now - bubble.at < 4200 && (screen == 'game' || screen == 'calibrate')}
		{#key bubble.at}
			<div class="bubble"><b>{bubble.who}</b><span>"{bubble.text}"</span></div>
		{/key}
	{/if}
	{#if scene}
		{@const l = scene.lines[scene.i]}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="cutscene" data-esc-owner onclick={nextLine}>
			{#key flashAt}{#if flashAt && now - flashAt < 500}<div class="whiteflash"></div>{/if}{/key}
			<div class="lb top"></div>
			<div class="lb bottom"></div>
			{#key scene.i}
				<div class="caption"><b>{l.who}</b><p>{l.text}</p></div>
			{/key}
			<button class="skip" onclick={(e) => (e.stopPropagation(), endScene())} aria-label="Skip cut scene">Skip <span aria-hidden="true">⏭</span></button>
			<p class="next-hint">Click for next line · Esc to skip</p>
		</div>
	{/if}
</div>

<style>
	/* The scoreboard. */
	.board {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: stretch;
		border-radius: 14px;
		overflow: hidden;
		background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.92));
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 0.18),
			0 14px 30px -14px rgba(0, 0, 0, 0.9);
	}
	.side {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 14px;
		position: relative;
	}
	.side.you {
		background: linear-gradient(90deg, #ea580c, #f97316);
		color: #1c0a00;
	}
	.side.them {
		background: linear-gradient(90deg, #1e293b, #334155);
	}
	.side.has::after {
		/* The ball: who has possession. */
		content: '';
		position: absolute;
		bottom: 4px;
		left: 50%;
		width: 26px;
		height: 3px;
		margin-left: -13px;
		border-radius: 2px;
		background: #facc15;
		box-shadow: 0 0 8px #facc15;
	}
	.nm {
		font: 900 0.78rem Impact, 'Arial Black', sans-serif;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pts {
		font: 900 2.1rem/1 Impact, sans-serif;
		min-width: 1.4ch;
		text-align: center;
		/* (The score never shrinks; a long name is cut short instead.) */
		flex: none;
	}
	.center {
		display: grid;
		place-items: center;
		padding: 2px 12px;
		gap: 0;
	}
	.to {
		font: 800 0.58rem system-ui, sans-serif;
		letter-spacing: 0.12em;
		color: #94a3b8;
		white-space: nowrap;
	}
	.clock {
		font: 800 1.1rem ui-monospace, monospace;
		color: #facc15;
	}
	.clock.low {
		color: #f87171;
	}
	.handtag {
		position: absolute;
		top: 74px;
		left: 50%;
		transform: translateX(-50%);
		padding: 2px 10px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.8);
		font-size: 0.72rem;
		font-weight: 800;
		color: #fde68a;
		text-transform: capitalize;
	}
	.handtag.solo {
		top: 14px;
		left: 16px;
		transform: none;
	}
	/* What just happened: one slim line under the scoreboard. */
	.ticker {
		position: absolute;
		top: 100px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: min(560px, 92%);
		padding: 4px 14px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid var(--c);
		font-size: 0.85rem;
		white-space: nowrap;
		pointer-events: none;
		animation: popin2 0.25s ease-out;
	}
	.ticker b {
		color: var(--c);
		font: 900 0.95rem Impact, 'Arial Black', sans-serif;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.ticker em {
		font-style: normal;
		font-weight: 900;
		color: #fde68a;
	}
	.tsub {
		color: #cbd5e1;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.leave {
		position: absolute;
		top: 14px;
		right: 14px;
		padding: 6px 14px;
		background: #dc2626;
		color: #fff;
		box-shadow: 0 3px 0 #7f1d1d;
		font-size: 0.85rem;
	}
	/* The shot bar's perfect band: right in the middle of the green. */
	.perfect {
		position: absolute;
		top: 0;
		bottom: 0;
		background: #15803d;
		box-shadow: 0 0 6px #22c55e;
	}
	/* The crowned ball behind the menu logo. */
	.logo-wrap {
		position: relative;
	}
	.crest {
		position: absolute;
		left: 62%;
		top: -70px;
		width: 130px;
		height: auto;
		opacity: 0.9;
		filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
		z-index: 0;
		transform: rotate(10deg);
	}
	.logo,
	.sub {
		position: relative;
		z-index: 1;
	}
	.sheet-btns {
		display: none;
		gap: 4px;
	}
	@media (min-width: 721px) {
		/* The scoreboard's size, which the hand tag and the ticker below it follow. */
		.board,
		.handtag,
		.ticker {
			--pts: clamp(2.8rem, 5.2vw, 5rem);
		}
		.board {
			top: 14px;
			border-radius: 22px;
			max-width: calc(100% - 200px);
		}
		.side {
			padding: 10px 32px;
			gap: 20px;
			min-width: 0;
		}
		.side.has::after {
			width: 56px;
			height: 5px;
			margin-left: -28px;
			bottom: 7px;
			border-radius: 3px;
		}
		.nm {
			font-size: clamp(1rem, 1.9vw, 1.7rem);
			max-width: min(300px, 18vw);
			min-width: 0;
		}
		.pts {
			font-size: var(--pts);
		}
		.center {
			padding: 6px 26px;
		}
		.to {
			font-size: clamp(0.7rem, 1vw, 0.95rem);
		}
		.clock {
			font-size: clamp(1.8rem, 3vw, 2.8rem);
		}
		.handtag {
			top: calc(var(--pts) + 44px);
			font-size: 0.95rem;
			padding: 3px 14px;
		}
		.ticker {
			top: calc(var(--pts) + 78px);
		}
	}
	@media (max-width: 720px) {
		.board {
			top: 8px;
			border-radius: 20px;
			max-width: calc(100vw - 16px);
		}
		.side {
			padding: 8px 12px;
			gap: 8px;
			min-width: 0;
		}
		.pts {
			font-size: 2.2rem;
		}
		.nm {
			max-width: 84px;
			min-width: 0;
			font-size: 0.8rem;
		}
		.center {
			padding: 4px 10px;
		}
		.clock {
			font-size: 1.7rem;
		}
		.side.has::after {
			width: 44px;
			height: 5px;
			margin-left: -22px;
			bottom: 6px;
		}
		.handtag {
			top: 76px;
		}
		.ticker {
			top: 104px;
			font-size: 0.7rem;
			padding: 2px 10px;
		}
		.ticker b {
			font-size: 0.78rem;
		}
		.tsub {
			display: none;
		}
		/* Leave sits below the scoreboard on phones, out of its way. */
		.leave {
			top: auto;
			bottom: 12px;
			right: 12px;
		}
		/* Menus: a bottom sheet over half the screen, which can be minimised or maximised. */
		.panel {
			top: auto !important;
			left: 0 !important;
			right: 0 !important;
			bottom: 0 !important;
			width: auto !important;
			height: 50%;
			border-radius: 18px 18px 0 0;
			transition: height 0.25s ease;
		}
		.panel.sheetmax {
			height: 90%;
		}
		.panel.sheetmin {
			height: 58px;
			overflow: hidden;
		}
		.sheet-btns {
			display: inline-flex;
		}
		.panel header {
			gap: 6px;
		}
		.panel header h2 {
			flex: 1;
		}
		.crest {
			width: 110px;
			top: -30px;
		}
	}
	/* Pop-up cards: what just happened, with the shot's grade and make chance. */
	.pop {
		position: absolute;
		left: 50%;
		top: 24%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 240px;
		max-width: min(440px, 86%);
		padding: 10px 18px 10px 12px;
		border-radius: 16px;
		background: linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(30, 27, 75, 0.9));
		border: 2px solid var(--c);
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent),
			0 18px 40px -12px rgba(0, 0, 0, 0.75);
		pointer-events: none;
		animation: popin 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	@keyframes popin {
		from {
			transform: translateX(-50%) scale(0.5) rotate(-4deg);
			opacity: 0;
		}
	}
	.pop .ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 46px;
		height: 46px;
		border-radius: 12px;
		font-size: 1.6rem;
		background: color-mix(in srgb, var(--c) 22%, transparent);
	}
	.pbody {
		display: grid;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.pbody b {
		font: 900 1.9rem/1 Impact, 'Arial Black', sans-serif;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		background: linear-gradient(180deg, #fff, var(--c));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(2px 2px 0 #0f172a);
	}
	.pop.k-make b,
	.pop.k-move b,
	.pop.k-block b {
		font-size: 2.3rem;
	}
	.psub {
		font-size: 0.85rem;
		font-weight: 700;
		color: #cbd5e1;
	}
	.pct {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}
	.track {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.12);
		overflow: hidden;
	}
	.track i {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: linear-gradient(90deg, #f97316, #facc15, #22c55e);
		animation: grow 0.6s ease-out;
	}
	@keyframes grow {
		from {
			width: 0 !important;
		}
	}
	.pct em {
		font: 900 1.05rem Impact, sans-serif;
		font-style: normal;
		color: #fde68a;
	}
	.grade {
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #0f172a;
	}
	.g-perfect {
		background: #22c55e;
	}
	.g-good {
		background: #a3e635;
	}
	.g-early,
	.g-late {
		background: #f59e0b;
	}
	/* The opponent's trash talk. */
	.bubble {
		position: absolute;
		right: 16px;
		top: 70px;
		max-width: 300px;
		display: grid;
		gap: 2px;
		padding: 10px 14px;
		border-radius: 16px 16px 4px 16px;
		background: #fff;
		color: #0f172a;
		box-shadow: 0 10px 28px -10px rgba(0, 0, 0, 0.7);
		pointer-events: none;
		animation: popin2 0.3s ease-out;
	}
	@keyframes popin2 {
		from {
			transform: translateY(-8px);
			opacity: 0;
		}
	}
	.bubble b {
		font: 900 0.8rem Impact, sans-serif;
		letter-spacing: 0.05em;
		color: #ea580c;
		text-transform: uppercase;
	}
	.bubble span {
		font-weight: 700;
		font-size: 0.92rem;
	}
	/* Cut scenes. */
	.cutscene {
		position: absolute;
		inset: 0;
		cursor: pointer;
		z-index: 5;
	}
	.cutscene .lb {
		position: absolute;
		left: 0;
		right: 0;
		background: #000;
		animation: bars 0.5s ease-out;
	}
	/* Narrow letterbox bars that slide in from the edges. */
	.cutscene .top {
		top: 0;
		height: 8%;
		transform-origin: top;
	}
	.cutscene .bottom {
		bottom: 0;
		height: 8%;
		transform-origin: bottom;
	}
	@keyframes bars {
		from {
			transform: scaleY(0);
		}
	}
	/* The caption sits just above the bottom bar, on a soft fade. */
	.caption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 8%;
		padding: 40px 24px 14px;
		text-align: center;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
		animation: popin2 0.45s ease-out;
	}
	.caption p {
		max-width: 760px;
		margin-inline: auto !important;
		text-shadow: 0 2px 6px #000;
	}
	/* A hard cut: a white flash that fades. */
	.whiteflash {
		position: absolute;
		inset: 0;
		background: #fff;
		pointer-events: none;
		animation: whiteflash 0.5s ease-out forwards;
	}
	@keyframes whiteflash {
		from {
			opacity: 0.95;
		}
		to {
			opacity: 0;
		}
	}
	.caption b {
		font: 900 0.95rem Impact, sans-serif;
		letter-spacing: 0.1em;
		color: #fb923c;
		text-transform: uppercase;
	}
	.caption p {
		margin: 4px 0 0;
		font-size: 1.15rem;
		font-weight: 700;
		color: #f8fafc;
	}
	/* Skip: in the top bar, clear and easy to hit. */
	.skip {
		position: absolute;
		top: 1.2%;
		right: 16px;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 16px;
		border-radius: 999px;
		border: 2px solid rgba(255, 255, 255, 0.7);
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		box-shadow: none;
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.skip:hover {
		background: #f97316;
		border-color: #f97316;
		color: #1c0a00;
	}
	.next-hint {
		position: absolute;
		left: 16px;
		top: 1.6%;
		margin: 0;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
		pointer-events: none;
	}
	.unlock {
		color: #94a3b8;
	}
	.unlock.got {
		color: #4ade80;
	}
	.toast {
		position: absolute;
		top: 80px;
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 18px;
		border-radius: 14px;
		background: rgba(10, 14, 28, 0.92);
		border: 2px solid #facc15;
		text-align: center;
		pointer-events: none;
		animation: pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.toast b {
		display: block;
		color: #facc15;
		font-size: 1.2rem;
	}
	.item {
		color: #5eead4;
		font-weight: 800;
	}
	.gear {
		display: grid;
		gap: 4px;
		margin-bottom: 8px;
	}
	.gear > span {
		font-size: 0.8rem;
		color: #94a3b8;
		font-weight: 700;
	}
	.tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		margin: 12px 0 6px;
		padding: 4px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.06);
	}
	.tabs button {
		position: relative;
		padding: 7px 4px;
		font-size: 0.8rem;
		background: transparent;
		color: #cbd5e1;
		box-shadow: none;
		border-radius: 9px;
	}
	.tabs button.on {
		background: #f97316;
		color: #1c0a00;
	}
	.badge {
		position: absolute;
		top: -6px;
		right: -2px;
		min-width: 16px;
		padding: 1px 4px;
		border-radius: 999px;
		background: #facc15;
		color: #1c0a00;
		font: 900 0.65rem/1.3 system-ui, sans-serif;
		font-style: normal;
	}
	.gear .chips button {
		text-transform: none;
	}
	.chips button.locked {
		opacity: 0.45;
	}
	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 5px;
		border-radius: 3px;
		vertical-align: -1px;
		border: 1px solid rgba(255, 255, 255, 0.4);
	}
	.achs {
		list-style: none;
		padding: 0;
		margin: 10px 0 0;
		display: grid;
		gap: 8px;
	}
	.achs li {
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.ach-text {
		flex: 1;
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	.reward {
		display: grid;
		justify-items: center;
		gap: 2px;
		width: 76px;
		text-align: center;
	}
	.reward small {
		font-size: 0.62rem;
		line-height: 1.15;
		color: #cbd5e1;
	}
	.chips button :global(svg) {
		display: inline-block;
		vertical-align: -6px;
		margin-right: 5px;
		border-radius: 5px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.achs li.done {
		border: 1px solid #facc15;
	}
	.statsrow {
		display: flex;
		gap: 14px;
		margin: 8px 0 12px;
	}
	.join {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	.join input {
		width: 130px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: inherit;
		font: 800 1.1rem ui-monospace, monospace;
		letter-spacing: 0.12em;
	}
	.code {
		font: 900 2.6rem ui-monospace, monospace;
		letter-spacing: 0.2em;
		color: #fb923c;
	}
	.checkup {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		color: #f8fafc;
		font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
		background: #0b1020;
	}
	.three {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	button {
		font: inherit;
		cursor: pointer;
		border: none;
		border-radius: 12px;
		padding: 10px 18px;
		font-weight: 800;
		background: #f97316;
		color: #1c0a00;
		box-shadow: 0 4px 0 #9a3412;
	}
	button:disabled {
		cursor: default;
		opacity: 0.55;
		box-shadow: none;
	}
	button.ghost {
		background: rgba(15, 23, 42, 0.75);
		color: #f8fafc;
		border: 2px solid rgba(255, 255, 255, 0.35);
		box-shadow: none;
	}
	button.small {
		padding: 6px 12px;
		font-size: 0.85rem;
	}
	small {
		display: block;
		font-weight: 500;
		font-size: 0.72rem;
		opacity: 0.8;
	}
	/* Menu */
	.menu {
		position: absolute;
		left: 4%;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		gap: 10px;
		max-width: 340px;
	}
	.logo {
		margin: 0;
		font: 900 4.2rem/0.9 Impact, 'Arial Black', sans-serif;
		letter-spacing: 0.02em;
		color: #fff;
		text-shadow:
			4px 4px 0 #f97316,
			8px 8px 0 #0f172a;
		transform: rotate(-4deg);
	}
	.logo .dash {
		color: #f97316;
	}
	.sub {
		margin: 6px 0 4px;
		font-weight: 700;
		text-shadow: 0 2px 6px #000;
	}
	.buttons {
		display: grid;
		gap: 8px;
	}
	.buttons button {
		text-align: left;
	}
	.buttons .big {
		font-size: 1.3rem;
	}
	.privacy {
		margin: 4px 0 0;
		font-size: 0.75rem;
		text-shadow: 0 1px 4px #000;
	}
	/* Panels */
	.panel {
		position: absolute;
		top: 14px;
		right: 14px;
		bottom: 14px;
		width: min(400px, calc(100% - 28px));
		overflow: auto;
		padding: 16px;
		border-radius: 16px;
		background: rgba(10, 14, 28, 0.86);
		border: 2px solid rgba(249, 115, 22, 0.5);
		backdrop-filter: blur(4px);
	}
	.panel header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font: 900 1.6rem Impact, 'Arial Black', sans-serif;
		letter-spacing: 0.03em;
		color: #fb923c;
	}
	h3 {
		margin: 14px 0 6px;
		font-size: 0.95rem;
	}
	.hint {
		color: #cbd5e1;
		font-size: 0.9rem;
	}
	.err {
		color: #fca5a5;
	}
	.ladder ol {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.rung {
		width: 100%;
		display: grid;
		grid-template-columns: 28px 1fr auto;
		align-items: center;
		gap: 10px;
		text-align: left;
		background: rgba(255, 255, 255, 0.07);
		color: #f8fafc;
		box-shadow: none;
		border: 2px solid rgba(255, 255, 255, 0.12);
		padding: 8px 10px;
	}
	.rung:not(:disabled):hover {
		border-color: #f97316;
	}
	.rung .n {
		font: 900 1.3rem Impact, sans-serif;
		color: #fb923c;
	}
	.rung.beaten .n::after {
		content: ' ✓';
		color: #4ade80;
		font-size: 0.8rem;
	}
	.rung .rate {
		font-size: 0.7rem;
		color: #94a3b8;
		font-weight: 600;
	}
	.center-card {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 22px 28px;
		border-radius: 18px;
		background: rgba(10, 14, 28, 0.9);
		border: 2px solid #f97316;
		text-align: center;
		max-width: 440px;
	}
	.center-card p {
		margin: 0;
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #f97316;
		animation: pulse 1.1s infinite;
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
	/* Camera preview */
	.cam {
		position: absolute;
		left: 12px;
		bottom: 12px;
		width: 200px;
		aspect-ratio: 4 / 3;
		border-radius: 12px;
		overflow: hidden;
		background: #000;
		border: 2px solid rgba(255, 255, 255, 0.35);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s;
	}
	.cam.show {
		opacity: 1;
	}
	.cam video,
	.cam canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cam video {
		transform: scaleX(-1);
		opacity: 0.5;
	}
	.cam p {
		position: absolute;
		inset: auto 0 6px;
		margin: 0;
		text-align: center;
		font-size: 0.8rem;
		font-weight: 800;
		color: #fde68a;
	}
	/* Game HUD */
	.scoreboard {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: stretch;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.4);
		background: rgba(10, 14, 28, 0.85);
		font-weight: 800;
	}
	.team {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 14px;
	}
	.team span {
		font: 900 2rem Impact, sans-serif;
	}
	.team.you {
		background: #f97316;
		color: #1c0a00;
	}
	.team.cpu {
		background: #1e293b;
	}
	.team b {
		font-size: 0.8rem;
	}
	.mid {
		display: grid;
		place-content: center;
		text-align: center;
		padding: 0 12px;
		font-size: 0.75rem;
	}
	.mid em {
		font-style: normal;
		color: #fde68a;
	}
	.pause {
		position: absolute;
		top: 14px;
		right: 14px;
	}
	.flash {
		position: absolute;
		left: 50%;
		top: 26%;
		transform: translateX(-50%);
		display: grid;
		justify-items: center;
		pointer-events: none;
		animation: pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.flash b {
		font: 900 3rem Impact, 'Arial Black', sans-serif;
		color: var(--c);
		text-shadow:
			3px 3px 0 #0f172a,
			0 0 18px rgba(0, 0, 0, 0.6);
		letter-spacing: 0.03em;
	}
	.flash.small b {
		font-size: 2rem;
	}
	.flash span {
		font-weight: 800;
		text-shadow: 0 2px 6px #000;
	}
	@keyframes pop {
		from {
			transform: translateX(-50%) scale(0.4);
			opacity: 0;
		}
	}
	.bar {
		position: absolute;
		left: 50%;
		bottom: 34px;
		width: min(60%, 460px);
		height: 22px;
		transform: translateX(-50%);
		border-radius: 11px;
		background: rgba(15, 23, 42, 0.85);
		border: 2px solid rgba(255, 255, 255, 0.6);
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: linear-gradient(90deg, #f97316, #facc15);
	}
	.zone {
		position: absolute;
		top: 0;
		bottom: 0;
		background: rgba(34, 197, 94, 0.6);
	}
	.mark {
		position: absolute;
		left: 50%;
		top: -2px;
		bottom: -2px;
		width: 3px;
		background: #fff;
	}
	.result .final {
		font: 900 2.6rem Impact, sans-serif;
	}
	.earned {
		color: #facc15;
		font-weight: 800;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 6px;
	}
	/* Practice */
	.drills {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin: 10px 0;
	}
	.drills button {
		text-align: left;
		background: rgba(255, 255, 255, 0.07);
		color: #f8fafc;
		box-shadow: none;
		border: 2px solid transparent;
		padding: 7px 10px;
		font-size: 0.9rem;
	}
	.drills button.on {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.18);
	}
	.how {
		font-size: 0.9rem;
		color: #e2e8f0;
		line-height: 1.4;
	}
	.tpl,
	.last {
		font-size: 0.85rem;
		color: #93c5fd;
	}
	.rec {
		color: #f87171;
		font-weight: 800;
	}
	.foot {
		margin-top: 12px;
		font-size: 0.78rem;
		color: #94a3b8;
	}
	/* Player */
	.swatches,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 6px;
	}
	.sw {
		width: 30px;
		height: 30px;
		padding: 0;
		border-radius: 8px;
		box-shadow: none;
		border: 2px solid rgba(255, 255, 255, 0.25);
	}
	.sw.on {
		border-color: #f97316;
		outline: 2px solid #f97316;
	}
	.chips button {
		padding: 5px 10px;
		font-size: 0.8rem;
		text-transform: capitalize;
		background: rgba(255, 255, 255, 0.08);
		color: #f8fafc;
		box-shadow: none;
		border: 2px solid transparent;
	}
	.chips button.on {
		border-color: #f97316;
	}
	.num {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
		font-weight: 800;
	}
	.num input {
		width: 70px;
		padding: 6px 8px;
		border-radius: 8px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: inherit;
		font: inherit;
		font-weight: 800;
	}
	/* (Its own name: a shared ".pts" shrank the scoreboard's scores to dots.) */
	.skillpts {
		float: right;
		color: #facc15;
		font-size: 0.85rem;
	}
	.stat {
		display: grid;
		grid-template-columns: 1fr 90px 28px 68px;
		align-items: center;
		gap: 8px;
		margin: 8px 0;
	}
	.meter {
		height: 10px;
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.12);
		overflow: hidden;
	}
	.meter {
		display: flex;
	}
	.meter i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #f97316, #facc15);
	}
	/* Points set aside but not applied yet. */
	.meter i.add {
		background: #4ade80;
	}
	.stat em.up {
		color: #4ade80;
	}
	.pm {
		display: flex;
		gap: 4px;
	}
	.pm .plus {
		flex: 1;
	}
	.apply-row {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid #4ade80;
	}
	.apply-row span {
		flex: 1;
		font-weight: 700;
		font-size: 0.85rem;
	}
	.stat em {
		font-style: normal;
		font-weight: 900;
	}
	.plus {
		padding: 2px 0;
		font-size: 1.1rem;
	}
	.how-to ul {
		padding-left: 18px;
		line-height: 1.5;
		font-size: 0.92rem;
	}
	@media (max-width: 700px) {
		.menu {
			left: 50%;
			transform: translate(-50%, -50%);
		}
		.logo {
			font-size: 3rem;
		}
		.cam {
			width: 130px;
		}
	}
</style>
