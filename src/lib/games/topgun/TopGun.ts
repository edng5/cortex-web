// Top Gun — Edward's high-school Java (Swing) game, ported to TypeScript + <canvas>.
// The logic is a line-for-line port of TopGun.java: same fields, same per-tick update order
// (the Java run() loop), same key handling and the same drawing, including Java's whole-number
// maths and its quirks (e.g. hit boxes that update a tick late), so it plays like the original.
// Differences: the menus are redrawn and clicked or tapped (each button still runs the Java menu
// item it replaces), progress saves to localStorage, "Quit" closes the game instead of exiting
// the program, and destroying the army base in mission 3 is worth a bonus.
import { ABase, Bullets, Clouds, EnemiesJ, EnemiesR, Missiles, Ships } from './entities';
import { Rect, idiv, rnd } from './geometry';
import { Confirm, buttonAt, drawButtons, keyRow, padlock, panel, pips, text, touchScreen, wrap, type ArcadeGame, type Board, type UiButton, type UiTheme } from '../common';

export const GAME_W = 600;
export const GAME_H = 536; // ends at the bottom of the cockpit dashboard (300 + 236)
/** One game tick (the Java loop slept ~15 ms per iteration; it ran at ~61 ticks/s). */
export const TICK_MS = 16;
/** Score for destroying the army base in mission 3. */
const BASE_BONUS = 100000;

const BASE = '/games/topgun/';
const SAVE_KEY = 'topgun-save';

const IMAGES = {
	TopGunMM: 'TGMM.png',
	missile: 'Missile.png', ejets: 'eJets.png', ejets2: 'FrontJet.png', eships: 'eShips.png', Base: 'ArmyBase.png',
	TGBack1: 'TGBack1.png', Runway: 'Runway.png', TakeOff: 'TakeOff.png', Landing: 'Landing.png',
	LandingBack: 'LandingBack.png', BackDrop1: 'BackDrop1.png', TGBack2: 'TGBack2.png', TGBack3: 'TGBack3.png',
	Dashboard: 'Dashboard.png', Reticle: 'Reticle.png', Cloud: 'Cloud.png', Radar1: 'Radar1.png',
	CoverRadar: 'CoverRadar.png', FInd: 'FlightIndicator.png', PInd: 'PositionIndicator.png',
	Mission1: 'Mission1.png', Mission2: 'Mission2.png', Mission3a: 'Mission3a.png', Mission3b: 'Mission3b.png',
	Upgrade: 'UpgradeMenu.png', PMission1: 'PMission1.png',
	PMission2: 'PMission2.png', PMission3: 'PMission3.png'
} as const;
type ImageName = keyof typeof IMAGES;

/** The original's animated GIFs, as sprite sheets (canvas only draws a GIF's first frame). */
const ANIMS = {
	JetMM: { file: 'Jet-sheet.png', w: 480, h: 243, cols: 8, durations: [50, 40, 50, 40, 50, 40, 50, 40, 50, 40, 50, 50, 40, 50, 40, 50, 40, 50, 40, 50, 40, 50, 50, 50] },
	Boom: { file: 'Explosion-sheet.png', w: 210, h: 200, cols: 10, durations: [200, 100, 100, 100, 100, 100, 100, 100, 100, 100] },
	LandingSeq: { file: 'LandingSeq-sheet.png', w: 686, h: 600, cols: 5, durations: Array(32).fill(100) as number[] }
} as const;
type AnimName = keyof typeof ANIMS;

/** A looping animation that, like a Java Toolkit image, starts the first time it's drawn. */
class Anim {
	private start: number | null = null;
	private readonly total: number;
	constructor(
		private img: HTMLImageElement,
		private spec: (typeof ANIMS)[AnimName]
	) {
		this.total = spec.durations.reduce((a, b) => a + b, 0);
	}
	restart() {
		this.start = null;
	}
	draw(ctx: CanvasRenderingContext2D, now: number, x: number, y: number, w: number, h: number) {
		if (w === 0 || h === 0) return;
		if (this.start === null) this.start = now;
		let t = (now - this.start) % this.total;
		let f = 0;
		while (f < this.spec.durations.length - 1 && t >= this.spec.durations[f]) t -= this.spec.durations[f++];
		const sx = (f % this.spec.cols) * this.spec.w;
		const sy = Math.floor(f / this.spec.cols) * this.spec.h;
		ctx.drawImage(this.img, sx, sy, this.spec.w, this.spec.h, x, y, w, h);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load ${src}`));
		img.src = src;
	});
}

export interface Assets {
	img: Record<ImageName, HTMLImageElement>;
	anim: Record<AnimName, Anim>;
}

export async function loadAssets(): Promise<Assets> {
	const names = Object.keys(IMAGES) as ImageName[];
	const imgs = await Promise.all(names.map((n) => loadImage(BASE + IMAGES[n])));
	const animNames = Object.keys(ANIMS) as AnimName[];
	const sheets = await Promise.all(animNames.map((n) => loadImage(BASE + ANIMS[n].file)));
	return {
		img: Object.fromEntries(names.map((n, i) => [n, imgs[i]])) as Record<ImageName, HTMLImageElement>,
		anim: Object.fromEntries(animNames.map((n, i) => [n, new Anim(sheets[i], ANIMS[n])])) as Record<AnimName, Anim>
	};
}

// java.awt.Color values the game uses.
const C = {
	DEFAULT: 'rgb(51,51,51)', // a Swing panel's default foreground
	RED: 'rgb(255,0,0)',
	GREEN: 'rgb(0,255,0)',
	GRAY: 'rgb(128,128,128)',
	ORANGE: 'rgb(255,200,0)',
	BLACK: 'rgb(0,0,0)',
	Green: 'rgb(113,200,117)'
};
const AGENCY = '"Agency FB", "Bahnschrift SemiCondensed", "Arial Narrow", sans-serif';

// ── Menu look: the logo's navy and red on the art's peach ──
const NAVY = 'rgb(0,0,82)';
const RED = 'rgb(227,30,36)';
const PEACH = 'rgb(245,222,178)';
const MUTED = 'rgba(0,0,82,0.6)';
const UI: UiTheme = {
	family: AGENCY,
	size: 25,
	detailSize: 14,
	radius: 6,
	caps: true,
	borderWidth: 2,
	idle: { fill: 'rgba(255,255,255,0.5)', text: NAVY, border: 'rgba(0,0,82,0.45)', detail: 'rgba(0,0,82,0.7)' },
	hover: { fill: NAVY, text: '#fff', border: RED, detail: 'rgb(254,198,137)' },
	primary: { fill: RED, text: '#fff', border: RED, detail: 'rgba(255,255,255,0.85)' },
	danger: { fill: 'rgba(255,255,255,0.5)', text: RED, border: RED, detail: RED },
	chosen: { fill: NAVY, text: '#fff', border: NAVY },
	disabled: { fill: 'rgba(0,0,82,0.08)', text: 'rgba(0,0,82,0.4)', border: 'rgba(0,0,82,0.2)', detail: 'rgba(0,0,82,0.4)' }
};
/** Pause and mission-over screens: light on dark navy. */
const NIGHT: UiTheme = {
	...UI,
	idle: { fill: 'rgba(255,255,255,0.08)', text: '#fff', border: 'rgba(255,255,255,0.35)' },
	hover: { fill: '#fff', text: NAVY, border: RED },
	primary: { fill: RED, text: '#fff', border: RED }
};

/** Mission briefings (the mission select art's text, redrawn). */
const MISSIONS = [
	{
		difficulty: 'Easy', chip: 'rgb(46,160,67)', sky: 'rgb(182,238,251)', ground: 'rgb(255,255,255)',
		brief: 'A flock of enemy jets is flying overhead. You decide to attack the unsuspecting pilots, despite not having a full tank of fuel.',
		objective: 'Shoot down 75 enemy jets'
	},
	{
		difficulty: 'Medium', chip: 'rgb(230,140,20)', sky: 'rgb(182,238,251)', ground: 'rgb(1,42,254)',
		brief: 'The enemy is running low on supplies and uses cargo ships to move ammunition and food. Cut off their resupply.',
		objective: 'Sink 30 cargo ships'
	},
	{
		difficulty: 'Hard', chip: RED, sky: 'rgb(98,163,255)', ground: 'rgb(255,171,0)',
		brief: 'You are deployed to destroy a neighbouring army base in the desert. The base is heavily guarded by enemy fighters.',
		objective: 'Destroy army base'
	}
];

/** The upgrades screen: what each level does, its price, and its icon in the upgrade art (UpgradeMenu.png). */
interface UpgradeSpec {
	name: string;
	levels: string[];
	icons: [number, number][];
	level(g: TopGun): number;
	cost(g: TopGun): number;
}
const UPGRADES: UpgradeSpec[] = [
	{ name: 'Health', levels: ['6 health bars', '12 health bars', '24 health bars'], icons: [[113, 150], [273, 150], [432, 150]], level: (g) => g.health, cost: (g) => g.hCost },
	{ name: 'Missile', levels: ['No missiles', 'Missiles (Shift)', 'Lock-on missiles'], icons: [[120, 380], [274, 380], [429, 380]], level: (g) => g.miss, cost: (g) => g.mCost },
	{ name: 'Gun', levels: ['Single gun', 'Rapid fire', 'Twin guns'], icons: [[118, 662], [273, 662], [429, 662]], level: (g) => g.shoot, cost: (g) => g.sCost },
	{ name: 'Movement', levels: ['Standard', 'Barrel roll'], icons: [[186, 880], [368, 880]], level: (g) => g.move, cost: (g) => g.cCost }
];
const CARD_W = 274;
const CARD_H = 186;
const cardAt = (i: number) => ({ x: i % 2 ? 306 : 20, y: i < 2 ? 70 : 266 });

/** Thrown where the Java code would hit ArrayIndexOutOfBoundsException (it ends that key handler). */
class JavaIndexError extends Error {}

export class TopGun implements ArcadeGame {
	// ── Fields (as in TopGun.java) ──
	game = 0; mission = 1; sequence = 0;
	select = 0; cx = 200; cy = 170; startDelay2 = 1; delay2 = 0; maxSelect = 4;
	gameSizeX = 600; gameSizeY = 555;
	bx = -600; by = -650; bdx = 0; bdy = 0; tilt = 0; dtilt = 0; centerX = 300; centerY = 300;
	sy = 150; sy2 = -700; sdy = 0; startTimer = 0;
	clouds: Clouds[] = [];
	numBullets = 5; count = 0; previousAX = 0; counter = 0;
	px = 285; fy = 450; center2X = 102; center2Y = 460;
	bulletsR: Bullets[] = [];
	bulletsL: Bullets[] = [];
	eBullets: Bullets[] = [];
	missiles = new Missiles();
	numJets = 4; deathTimer = 0; lastShot = 0; startDelay = 0; check = 0;
	limit = 0; limit2 = 0; hw = 300; destroy = 0;
	lives = 6;
	lx = [187, 206, 225, 244, 263, 282, 301, 320, 339, 358, 377, 396, 187, 206, 225, 244, 263, 282, 301, 320, 339, 358, 377, 396];
	ly = [490, 490, 490, 490, 490, 490, 490, 490, 490, 490, 490, 490, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500];
	fuel = 8; fuelTimer = 0;
	f2y = [479, 471, 463, 455, 447, 439, 431, 423];
	EndTimer = 0; success = 0; complete = 0; score = 0;
	eJets: EnemiesJ[] = [];
	rJets: EnemiesR[] = [];
	numShips = 3; killsShip = 0;
	ships: Ships[] = [];
	aBase = new ABase();
	kills = 0;
	// Upgrades
	earned = 0; money = 0; health = 0; hCost = 1000; miss = 0; mCost = 750; shoot = 0; sCost = 1500; move = 0; cCost = 3000;
	uy = 0; u2y = 125; u3y = 125; u4y = 355; u5y = 355; u6y = 80; u7y = 80; u8y = 300;
	lox = 0; loy = 0; low = 0; loh = 0; target = 0; lockedon = 0; object = 0; evade = 0;
	count2 = 0; count3 = 0; startCounter1 = 0;
	count4 = 0; count5 = 0; startCounter2 = 0;
	mComplete = 0; mPage = 0;
	h1 = 0; h2 = 0; h3 = 0; gp = 0;
	delay3 = 0;
	hbx = 200; hby = 80; hbw = 190; hbh = 200; random = 0;
	hitbox = new Rect(this.hbx, this.hby, this.hbw, this.hbh);

	/** Sound effects (set by the host): guns, missiles, explosions, hits, menus. */
	sfx: (name: string) => void = () => {};
	/** Soundtrack: the anthem on menus, quiet synth rock during a mission (and its pause screen). */
	musicTrack() {
		if (this.game == 0 || this.game == 5 || this.game == 6 || this.game == 7 || this.game == -1) return 'topgun-menu';
		if (this.game == 1 || this.game == 4) return 'topgun-play';
		return null;
	}
	/** Called when the player picks Quit on the main menu (after saving). */
	onQuit: () => void = () => {};
	/** Called once when a mission ends (won, failed or game over) with its final score. */
	onScore: (mission: number, score: number) => void = () => {};
	/** Global high scores (from the server); null = not loaded, so the screen shows local scores. */
	global: Board | null = null;
	/** Whether the player is signed in (their scores count on the global board). */
	loggedIn = false;

	private color = C.DEFAULT;
	private lastSaved = '';

	constructor(private a: Assets) {
		this.load();

		for (let i = 0; i < this.numBullets; i++) {
			const b = new Bullets();
			b.create();
			b.x = 430;
			b.y = 300;
			this.bulletsR.push(b);
		}
		for (let i = 0; i < this.numBullets; i++) {
			const b = new Bullets();
			b.create();
			b.x = 150;
			b.y = 300;
			this.bulletsL.push(b);
		}
		for (let i = 0; i < 5; i++) {
			const c = new Clouds();
			c.create();
			c.x = rnd(500);
			c.y = rnd(400);
			this.clouds.push(c);
		}
		for (let i = 0; i < this.numJets; i++) {
			const j = new EnemiesJ();
			j.create();
			j.x = rnd(300) + 100;
			j.y = rnd(200) + 100;
			this.eJets.push(j);
		}
		for (let i = 0; i < this.numBullets; i++) {
			const b = new Bullets();
			b.create();
			this.random = rnd(this.numJets);
			b.x = this.eJets[this.random].x + idiv(this.eJets[this.random].sizeW, 2);
			b.y = this.eJets[this.random].y + idiv(this.eJets[this.random].sizeH, 2);
			b.size = 5;
			this.eBullets.push(b);
		}
		for (let i = 0; i < this.numJets; i++) {
			const r = new EnemiesR();
			r.create();
			r.x = 280 + rnd(30) + 1;
			r.y = 800;
			this.rJets.push(r);
		}
		for (let i = 0; i < this.numShips; i++) {
			const s = new Ships();
			s.create();
			s.x = rnd(70) - 100;
			s.y = rnd(140) + this.by + 800;
			this.ships.push(s);
		}
		this.aBase.create();
		this.missiles.create();
		this.HealthBar();
	}

	// ── Save data (the Java version's TopGunFile.txt line, kept in localStorage) ──
	private saveLine() {
		return [this.lives, this.money, this.health, this.hCost, this.miss, this.mCost, this.shoot, this.sCost, this.move,
			this.cCost, this.mComplete, this.h1, this.h2, this.h3, this.gp].join(',');
	}
	private load() {
		let line: string | null = null;
		try {
			line = localStorage.getItem(SAVE_KEY);
		} catch {
			/* storage unavailable: start fresh */
		}
		if (!line) return;
		const f = line.split(',').map((v) => parseInt(v, 10));
		if (f.length < 15 || f.some((n) => !Number.isFinite(n))) return;
		[this.lives, this.money, this.health, this.hCost, this.miss, this.mCost, this.shoot, this.sCost, this.move,
			this.cCost, this.mComplete, this.h1, this.h2, this.h3, this.gp] = f;
		this.lastSaved = line;
	}
	/** Saves progress (cheap; skipped when nothing changed). */
	save() {
		const line = this.saveLine();
		if (line === this.lastSaved) return;
		try {
			localStorage.setItem(SAVE_KEY, line);
			this.lastSaved = line;
		} catch {
			/* storage full or blocked */
		}
	}

	// ── Keyboard ──
	/** Returns true if the key belongs to the game (so the page shouldn't scroll etc.). */
	keyPressed(code: string): boolean {
		// Phones: the Roll button does the keyboard's double-tap barrel roll (once it's unlocked).
		if (code == 'Roll') {
			if (this.game == 1 && this.sequence == 1 && this.move >= 1) {
				const side = this.rollSide;
				// A clean double tap, whatever was tapped before.
				this.count2 = 0; this.count3 = 0; this.count4 = 0; this.count5 = 0;
				try {
					this.keyPressedJava(side);
					this.keyReleasedJava(side);
					this.keyPressedJava(side);
				} catch (e) {
					if (!(e instanceof JavaIndexError)) throw e;
				}
				this.rolling = true;
			}
			return true;
		}
		const k = keyOf(code);
		if (!k) return false;
		if (k == 'A' || k == 'D') this.rollSide = k;
		// Menus are clicked or tapped. Enter is kept as a shortcut where a mission is in progress:
		// it continues from the pause screen, and picks the main action after a mission.
		if (this.game == 0 || this.game == 5 || this.game == 6 || this.game == 7 || this.game == -1) return true;
		if (this.game == 3 || this.game == 4) {
			if (k == 'ENTER') this.press(0);
			return true;
		}
		const before = { game: this.game, select: this.select, count: this.count, fired: this.missiles.fired, shoot: this.shoot };
		try {
			this.keyPressedJava(k);
		} catch (e) {
			if (!(e instanceof JavaIndexError)) throw e;
		}
		// Sounds, from what the key changed.
		if (this.game == 1 && this.count > before.count && before.count < (before.shoot >= 1 ? 3 : this.numBullets)) this.sfx('gun');
		if (this.game == 1 && before.fired == 0 && this.missiles.fired == 1) this.sfx('missile');
		if (this.game != before.game && before.game != 1) this.sfx('confirm');
		else if (this.select != before.select && this.game != 1) this.sfx('select');
		return true;
	}
	keyReleased(code: string): boolean {
		if (code == 'Roll') {
			if (this.rolling) {
				this.rolling = false;
				try {
					this.keyReleasedJava(this.rollSide);
				} catch (e) {
					if (!(e instanceof JavaIndexError)) throw e;
				}
			}
			return true;
		}
		const k = keyOf(code);
		if (!k) return false;
		try {
			this.keyReleasedJava(k);
		} catch (e) {
			if (!(e instanceof JavaIndexError)) throw e;
		}
		return true;
	}

	/** The roll goes the way you last tilted (A or D). */
	private rollSide: 'A' | 'D' = 'A';
	private rolling = false;
	/** Touch screens: Missile and Roll only once they're unlocked. */
	hiddenButtons() {
		const hide: string[] = [];
		if (this.miss < 1) hide.push('ShiftLeft');
		if (this.move < 1) hide.push('Roll');
		return hide;
	}

	leave() {
		// Mid-mission (flying or paused): keep the score, as at the end of a mission.
		if ((this.game == 1 || this.game == 4) && this.score > 0) {
			if (this.mission == 1 && this.h1 < this.score) this.h1 = this.score;
			else if (this.mission == 2 && this.h2 < this.score) this.h2 = this.score;
			else if (this.mission == 3 && this.h3 < this.score) this.h3 = this.score;
			this.onScore(this.mission, this.score);
		}
		this.save();
	}

	// ── Menus: drawn buttons, clicked or tapped (the keyboard is for flying) ──
	private hover: string | null = null;
	private confirm = new Confirm();

	/** Picks menu item `sel` the way the Java menus did (cursor on it, then Enter). */
	private press(sel: number) {
		this.select = sel;
		try {
			this.keyPressedJava('ENTER');
		} catch (e) {
			if (!(e instanceof JavaIndexError)) throw e;
		}
		this.sfx('confirm');
	}

	/** The current screen's buttons: drawn, hovered and clicked from this one list. */
	private ui(): UiButton[] {
		const go = (sel: number) => () => this.press(sel);
		const back: UiButton = { id: 'back', x: 14, y: 12, w: 96, h: 36, label: '‹ Back', size: 20, onClick: go(0) };
		switch (this.game) {
			case 0: {
				const unlocked = Math.min(3, this.mComplete + 1);
				const rows: [string, string?][] = [
					['Play', `${unlocked} of 3 missions unlocked`],
					['High Scores'],
					['Upgrades', `$${this.money} to spend`],
					['Controls'],
					['Quit', 'Progress is saved']
				];
				return rows.map(([label, detail], i) => ({
					id: 'main' + i, label, detail, x: 16, y: 150 + i * 66, w: 196, h: 54, kind: i == 0 ? ('primary' as const) : undefined, onClick: go(i)
				}));
			}
			case 5: {
				const armedS = this.confirm.isArmed('scores');
				const armedG = this.confirm.isArmed('game');
				return [
					back,
					{
						id: 'scores', x: 196, y: 470, w: 180, h: 46, label: armedS ? 'Click again' : 'Reset scores', detail: armedS ? 'clears high scores' : undefined,
						kind: armedS ? 'danger' : undefined, onClick: () => this.confirm.press('scores') && this.press(1)
					},
					{
						id: 'game', x: 390, y: 470, w: 196, h: 46, label: armedG ? 'Click again' : 'Reset game', detail: armedG ? 'clears all progress' : undefined,
						kind: 'danger', onClick: () => this.confirm.press('game') && this.press(2)
					}
				];
			}
			case 6: {
				const buttons: UiButton[] = [back];
				UPGRADES.forEach((u, i) => {
					const { x, y } = cardAt(i);
					const level = u.level(this);
					const maxed = level >= u.levels.length - 1;
					const cost = u.cost(this);
					const short = !maxed && this.money < cost;
					buttons.push({
						id: 'buy' + i, x: x + 14, y: y + 134, w: CARD_W - 28, h: 40, size: 20,
						label: maxed ? 'Maxed out' : short ? `Need $${cost}` : `Buy  ·  $${cost}`,
						kind: 'primary', disabled: maxed || short, onClick: go(i + 1)
					});
				});
				buttons.push({ id: 'fly', x: 446, y: 476, w: 140, h: 46, label: 'Fly ›', kind: 'primary', onClick: go(5) });
				return buttons;
			}
			case -1: {
				const page = Math.max(1, this.select);
				const locked = this.mComplete < page - 1;
				const tabs: UiButton[] = [1, 2, 3].map((m) => ({
					id: 'tab' + m, x: 24 + (m - 1) * 128, y: 110, w: 120, h: 34, size: 18,
					label: `Mission ${m}`, chosen: m == page,
					onClick: () => {
						this.select = m;
						this.sfx('select');
					}
				}));
				return [
					{ ...back, onClick: go(0) },
					...tabs,
					{ id: 'prev', x: 140, y: 440, w: 60, h: 56, label: '‹', size: 34, disabled: page <= 1, onClick: () => { this.select = page - 1; this.sfx('select'); } },
					{
						id: 'play', x: 212, y: 436, w: 176, h: 64, label: locked ? 'Locked' : 'Play', detail: `Mission ${page}`,
						kind: 'primary', disabled: locked, size: 30, onClick: go(page)
					},
					{ id: 'next', x: 400, y: 440, w: 60, h: 56, label: '›', size: 34, disabled: page >= 3, onClick: () => { this.select = page + 1; this.sfx('select'); } }
				];
			}
			case 7:
				return [back];
			case 4:
				return [
					{ id: 'resume', x: 180, y: 196, w: 240, h: 50, label: 'Continue', kind: 'primary', onClick: go(0) },
					{ id: 'restart', x: 180, y: 258, w: 240, h: 50, label: 'Restart mission', onClick: go(1) },
					{ id: 'menu', x: 180, y: 320, w: 240, h: 50, label: 'Main menu', onClick: go(2) }
				];
			case 3:
				return [
					{ id: 'end0', x: 120, y: 392, w: 172, h: 52, label: this.success == 2 ? 'Upgrades' : 'Retry', kind: 'primary', onClick: go(0) },
					{ id: 'end1', x: 308, y: 392, w: 172, h: 52, label: 'Main menu', onClick: go(1) }
				];
		}
		return [];
	}

	pointerMove(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		this.hover = b?.id ?? null;
		return !!b;
	}
	pointerDown(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		if (!b) return;
		if (!b.id.startsWith('scores') && !b.id.startsWith('game')) this.confirm.clear();
		b.onClick();
		this.hover = null;
	}

	/** Peach page with a title (high scores, upgrades, controls). */
	private page(title: string) {
		const ctx = this.ctx;
		ctx.fillStyle = PEACH;
		ctx.fillRect(0, 0, GAME_W, GAME_H);
		text(ctx, title.toUpperCase(), 300, 32, { size: 36, family: AGENCY, color: NAVY, align: 'center' });
		ctx.fillStyle = RED;
		ctx.fillRect(270, 54, 60, 3);
	}

	private paintMenus() {
		const ctx = this.ctx;
		const buttons = this.ui();
		let theme = UI;

		if (this.game == 0) {
			this.img('TopGunMM', 0, 0, 600, 560);
			this.anim('JetMM', 232, 352, 400, 203);
			// The art's painted-on labels are covered by the panel colour; drawn buttons replace them.
			ctx.fillStyle = 'rgb(254,198,137)';
			ctx.fillRect(0, 140, 228, 400);
		}

		// High scores: each mission's best (yours and the global record), games played, resets.
		if (this.game == 5) {
			this.page('High Scores');
			const g = this.global;
			const local: Record<number, number> = { 1: this.h1, 2: this.h2, 3: this.h3 };
			const status = !g ? 'Loading global records…' : `${g.period === 'all' ? 'All-time' : 'This month’s'} records${this.loggedIn ? '' : '  ·  log in to rank your scores'}`;
			text(ctx, status, 300, 76, { size: 15, family: AGENCY, color: MUTED, align: 'center', bold: false });
			text(ctx, 'YOUR BEST', 372, 100, { size: 14, family: AGENCY, color: MUTED, align: 'center' });
			text(ctx, 'RECORD', 500, 100, { size: 14, family: AGENCY, color: MUTED, align: 'center' });
			MISSIONS.forEach((m, i) => {
				const y = 112 + i * 84;
				panel(ctx, 24, y, 552, 74, { fill: 'rgba(255,255,255,0.55)', border: 'rgba(0,0,82,0.18)', radius: 8 });
				text(ctx, `MISSION ${i + 1}`, 42, y + 26, { size: 26, family: AGENCY, color: NAVY });
				text(ctx, m.objective, 42, y + 52, { size: 15, family: AGENCY, color: MUTED, bold: false });
				const mine = this.loggedIn && g ? (g.you?.[i + 1] ?? 0) : local[i + 1];
				text(ctx, '' + mine, 372, y + 37, { size: 30, family: AGENCY, color: NAVY, align: 'center' });
				const top = g?.missions[i + 1]?.[0];
				text(ctx, top ? '' + top.score : '—', 500, y + 30, { size: 24, family: AGENCY, color: RED, align: 'center' });
				text(ctx, top ? top.name : g ? 'no record yet' : '', 500, y + 54, { size: 13, family: 'Arial, sans-serif', color: MUTED, align: 'center', bold: false, max: 140 });
			});
			panel(ctx, 24, 368, 552, 52, { fill: 'rgba(255,255,255,0.35)', radius: 8 });
			text(ctx, 'GAMES PLAYED', 42, 395, { size: 22, family: AGENCY, color: NAVY });
			text(ctx, '' + this.gp, 372, 395, { size: 28, family: AGENCY, color: NAVY, align: 'center' });
			text(ctx, 'Reset game also clears money, upgrades and missions.', 24, 446, { size: 14, family: AGENCY, color: MUTED, bold: false });
		}

		// Upgrades: one card per upgrade, with its level, what it does now and next, and the price.
		if (this.game == 6) {
			this.page('Upgrades');
			panel(ctx, 446, 12, 140, 38, { fill: NAVY, radius: 8 });
			text(ctx, '$' + this.money, 516, 32, { size: 24, family: AGENCY, color: '#fff', align: 'center' });
			const sheet = this.a.img.Upgrade;
			UPGRADES.forEach((u, i) => {
				const { x, y } = cardAt(i);
				const level = u.level(this);
				const max = u.levels.length - 1;
				panel(ctx, x, y, CARD_W, CARD_H, { fill: 'rgba(255,255,255,0.6)', border: 'rgba(0,0,82,0.25)', radius: 10 });
				text(ctx, u.name.toUpperCase(), x + 14, y + 20, { size: 22, family: AGENCY, color: NAVY });
				pips(ctx, x + CARD_W - 14 - u.levels.length * 27 + 5, y + 16, level + 1, u.levels.length, { on: RED, off: 'rgba(0,0,82,0.15)' });
				// Now → next, with the art's icons.
				const icon = (n: number, ix: number, iy: number, dim = false) => {
					const [sx, sy] = u.icons[n];
					ctx.save();
					if (dim) ctx.globalAlpha = 0.55;
					ctx.drawImage(sheet, sx, sy, 84, 78, ix, iy, 64, 60);
					ctx.restore();
				};
				icon(level, x + 14, y + 40);
				text(ctx, 'NOW', x + 92, y + 52, { size: 13, family: AGENCY, color: MUTED });
				text(ctx, u.levels[level], x + 92, y + 70, { size: 17, family: AGENCY, color: NAVY, max: CARD_W - 106 });
				if (level < max) {
					text(ctx, 'NEXT', x + 92, y + 94, { size: 13, family: AGENCY, color: MUTED });
					text(ctx, u.levels[level + 1], x + 92, y + 112, { size: 17, family: AGENCY, color: RED, max: CARD_W - 106 });
				} else text(ctx, 'Fully upgraded', x + 92, y + 100, { size: 16, family: AGENCY, color: MUTED, bold: false });
			});
			text(ctx, 'Earn money by flying missions.', 24, 499, { size: 16, family: AGENCY, color: MUTED, bold: false });
		}

		// Mission select: the mission's own backdrop, a briefing card, and Play.
		if (this.game == -1) {
			const page = Math.max(1, this.select);
			const m = MISSIONS[page - 1];
			this.img(page == 1 ? 'PMission1' : page == 2 ? 'PMission2' : 'PMission3', 0, 0, 600, 555);
			// Cover the art's painted text, arrows and buttons; the card and buttons below replace them.
			ctx.fillStyle = m.sky;
			ctx.fillRect(0, 0, 130, 56);
			panel(ctx, 6, 96, 588, 326, { fill: 'rgb(250,250,252)', border: NAVY, width: 3, radius: 12, shadow: 'rgba(0,0,40,0.35)' });
			ctx.fillStyle = m.ground;
			ctx.fillRect(130, 428, 340, 80);
			const locked = this.mComplete < page - 1;
			text(ctx, `MISSION ${page}`, 28, 178, { size: 38, family: AGENCY, color: NAVY });
			const tw = (() => { ctx.save(); ctx.font = `bold 38px ${AGENCY}`; const w = ctx.measureText(`MISSION ${page}`).width; ctx.restore(); return w; })();
			panel(ctx, 40 + tw, 165, 74, 26, { fill: m.chip, radius: 13 });
			text(ctx, m.difficulty.toUpperCase(), 77 + tw, 179, { size: 15, family: AGENCY, color: '#fff', align: 'center' });
			const lines = wrap(ctx, m.brief, 540, `20px ${AGENCY}`);
			lines.forEach((l, i) => text(ctx, l, 28, 216 + i * 24, { size: 20, family: AGENCY, color: 'rgb(40,40,70)', bold: false }));
			const oy = 222 + lines.length * 24 + 14;
			text(ctx, 'OBJECTIVE', 28, oy, { size: 14, family: AGENCY, color: MUTED });
			text(ctx, m.objective, 28, oy + 22, { size: 22, family: AGENCY, color: RED });
			text(ctx, 'FUEL', 330, oy, { size: 14, family: AGENCY, color: MUTED });
			text(ctx, page == 1 ? '3 tanks' : '8 tanks', 330, oy + 22, { size: 22, family: AGENCY, color: NAVY });
			text(ctx, 'YOUR BEST', 450, oy, { size: 14, family: AGENCY, color: MUTED });
			text(ctx, '' + [this.h1, this.h2, this.h3][page - 1], 450, oy + 22, { size: 22, family: AGENCY, color: NAVY });
			if (locked) {
				panel(ctx, 6, 152, 588, 270, { fill: 'rgba(250,250,252,0.9)', radius: 12 });
				padlock(ctx, 300, 250, 56, NAVY);
				text(ctx, `Complete Mission ${page - 1} to unlock`, 300, 312, { size: 24, family: AGENCY, color: NAVY, align: 'center' });
			}
		}

		// Controls: every key, and the moves that upgrades unlock.
		if (this.game == 7) {
			this.page('Controls');
			const key = { family: 'Arial, sans-serif', fill: '#fff', text: NAVY, border: 'rgba(0,0,82,0.45)', size: 13, h: 28 };
			panel(ctx, 20, 74, 272, 380, { fill: 'rgba(255,255,255,0.5)', border: 'rgba(0,0,82,0.18)', radius: 10 });
			text(ctx, 'FLYING', 38, 98, { size: 20, family: AGENCY, color: NAVY });
			const basic: [string[], string][] = [
				[['W'], 'Climb'], [['S'], 'Dive'], [['A'], 'Tilt left'], [['D'], 'Tilt right'],
				[['Space'], 'Fire guns'], [['Shift'], 'Fire a missile'], [['Enter'], 'Pause']
			];
			basic.forEach(([keys, what], i) => {
				const y = 122 + i * 44;
				keyRow(ctx, keys, 38, y, key);
				text(ctx, what, 132, y + 15, { size: 19, family: AGENCY, color: NAVY, bold: false });
			});
			panel(ctx, 308, 74, 272, 380, { fill: 'rgba(255,255,255,0.5)', border: 'rgba(0,0,82,0.18)', radius: 10 });
			text(ctx, 'UNLOCKED BY UPGRADES', 326, 98, { size: 20, family: AGENCY, color: NAVY });
			const adv: [string, string[], string, string][] = [
				['Rapid fire', ['Space'], 'hold to keep firing', 'Gun level 2'],
				['Twin guns', ['Space'], 'fires from both wings', 'Gun level 3'],
				['Lock-on missile', ['Shift'], 'target in the reticle', 'Missile level 3'],
				['Barrel roll', ['A', 'A'], 'or D, D: dodge fire', 'Movement level 2']
			];
			adv.forEach(([name, keys, how, need], i) => {
				const y = 120 + i * 82;
				text(ctx, name.toUpperCase(), 326, y + 8, { size: 18, family: AGENCY, color: RED });
				const w = keyRow(ctx, keys, 326, y + 22, key);
				text(ctx, how, 336 + w, y + 37, { size: 16, family: AGENCY, color: NAVY, bold: false, max: 262 - w - 20 });
				text(ctx, 'Needs ' + need, 326, y + 66, { size: 13, family: AGENCY, color: MUTED, bold: false });
			});
			text(ctx, 'On phones: the joystick flies; the Fire, Missile and Pause buttons sit beside it.', 300, 478, { size: 15, family: AGENCY, color: MUTED, align: 'center', bold: false });
		}

		// Paused (drawn over the frozen mission).
		if (this.game == 4) {
			theme = NIGHT;
			ctx.fillStyle = 'rgba(0,0,30,0.55)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			panel(ctx, 150, 112, 300, 280, { fill: 'rgba(0,0,60,0.94)', border: RED, width: 3, radius: 14 });
			text(ctx, 'PAUSED', 300, 152, { size: 40, family: AGENCY, color: '#fff', align: 'center' });
			if (!touchScreen()) text(ctx, 'Enter to continue', 300, 418, { size: 16, family: AGENCY, color: 'rgba(255,255,255,0.8)', align: 'center', bold: false });
		}

		// Mission over: the result, score and pay.
		if (this.game == 3) {
			theme = NIGHT;
			ctx.fillStyle = 'rgb(6,10,34)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			const [title, color] =
				this.success == 2 ? ['MISSION COMPLETE', 'rgb(113,200,117)'] : this.success == 1 ? ['MISSION FAILED', 'rgb(255,170,60)'] : ['GAME OVER', 'rgb(255,80,80)'];
			panel(ctx, 100, 60, 400, 400, { fill: 'rgba(0,0,60,0.9)', border: color, width: 3, radius: 14 });
			text(ctx, title, 300, 104, { size: 40, family: AGENCY, color, align: 'center' });
			text(ctx, `Mission ${this.mission}`, 300, 136, { size: 18, family: AGENCY, color: 'rgba(255,255,255,0.7)', align: 'center', bold: false });
			this.earned = this.success == 0 ? idiv(this.score, 250) : idiv(this.score, 100);
			const rows: [string, string, string?][] = [['SCORE', '' + this.score]];
			if (this.success == 2 && this.mission == 3) rows.push(['BASE DESTROYED', '+' + BASE_BONUS, 'rgb(113,200,117)']);
			rows.push(['EARNED', '$' + this.earned]);
			if (this.success == 2) rows.push(['MISSION BONUS', '+$300', 'rgb(113,200,117)']);
			rows.forEach(([k, v, c], i) => {
				const y = 182 + i * 48;
				text(ctx, k, 140, y, { size: 20, family: AGENCY, color: 'rgba(255,255,255,0.75)' });
				text(ctx, v, 460, y, { size: 28, family: AGENCY, color: c ?? '#fff', align: 'right' });
			});
			if (this.mission == 1 && this.h1 < this.score) this.h1 = this.score;
			else if (this.mission == 2 && this.h2 < this.score) this.h2 = this.score;
			else if (this.mission == 3 && this.h3 < this.score) this.h3 = this.score;
		}

		drawButtons(ctx, buttons, theme, this.hover);
	}

	private keyPressedJava(keyCode: Key) {
		// Menu Selection (WASD instead of the original arrow keys)
		if (this.game == 0 || this.game == 4 || this.game == 6 || this.game == -1 || this.game == 5 || this.game == 7) {
			if (this.game == 0) this.maxSelect = 4;
			if (this.game == 4 || this.game == 5) this.maxSelect = 2;
			if (this.game == 6) this.maxSelect = 5;
			if (this.game == 7) this.maxSelect = 1;
			if (this.game == -1) this.maxSelect = 3;
			if (keyCode == 'W') {
				this.select--;
				if (this.select < 0) this.select = 0;
			}
			if (keyCode == 'S') this.select++;
			if (this.select > this.maxSelect) this.select = this.maxSelect;
		}
		if (this.game == 3 || this.game == -1) {
			if (this.game == 3) this.maxSelect = 1;
			if (this.game == -1) this.maxSelect = 3;
			if (keyCode == 'A') {
				this.select--;
				if (this.select < 0) this.select = 0;
			}
			if (keyCode == 'D') this.select++;
			if (this.select > this.maxSelect) this.select = this.maxSelect;
		}

		// Main Menu
		if (this.game == 0) {
			if (keyCode == 'ENTER') {
				if (this.select == 0) {
					this.game = -1; this.select = 1; this.startDelay2 = 1; this.delay2 = 0;
				} else if (this.select == 1) {
					this.game = 5; this.select = 0; this.startDelay2 = 1; this.delay2 = 0;
				} else if (this.select == 2) {
					this.game = 6; this.startDelay2 = 1; this.delay2 = 0; this.select = 0;
				} else if (this.select == 3) {
					this.game = 7; this.select = 0; this.startDelay2 = 1; this.delay2 = 0;
				} else if (this.select == 4) {
					// Quit Game and Save Data
					this.save();
					this.onQuit();
				}
			}
		}

		// Highscores Menu
		if (this.game == 5) {
			if (keyCode == 'ENTER') {
				if (this.select == 1) {
					this.h1 = 0; this.h2 = 0; this.h3 = 0; this.gp = 0;
				}
				if (this.select == 2) {
					this.lives = 6; this.money = 0; this.health = 0; this.hCost = 1000; this.miss = 0; this.mCost = 750;
					this.shoot = 0; this.sCost = 1500; this.move = 0; this.cCost = 3000; this.mComplete = 0;
					this.h1 = 0; this.h2 = 0; this.h3 = 0; this.gp = 0;
				}
			}
		}

		// GAME
		if (this.game == 1) {
			if (this.sequence == 1 || this.sequence == 2 || this.sequence == 3) {
				if (keyCode == 'ENTER') {
					this.game = 4; this.select = 0; this.startDelay2 = 1;
				}
			}
			if (this.sequence == 1) {
				if (keyCode == 'W') this.bdy = 2;
				if (keyCode == 'S') this.bdy = -2;
				if (keyCode == 'A') {
					this.dtilt = 1; this.startCounter2 = 1; this.count2 = 0; this.count3 = 0; this.startCounter1 = 0;
					if (this.move == 1 && this.count4 == 1) {
						this.dtilt = 5; this.evade = 1;
					}
				}
				if (keyCode == 'D') {
					this.dtilt = -1; this.startCounter1 = 1; this.count4 = 0; this.count5 = 0; this.startCounter2 = 0;
					if (this.move == 1 && this.count2 == 1) {
						this.dtilt = -5; this.evade = 1;
					}
				}
				if (this.shoot >= 1) {
					if (keyCode == 'SPACE') {
						if (this.count < 3) {
							this.bulletsR[this.count].y_speed = -8;
							this.bulletsR[this.count].x_speed = -9;
							this.bulletsR[this.count].changesize = -1;
							if (this.shoot == 2) {
								this.bulletsL[this.count].y_speed = -8;
								this.bulletsL[this.count].x_speed = 9;
								this.bulletsL[this.count].changesize = -1;
							}
						}
						this.count++;
					}
				}
			}
		}

		// Game Over Screen
		if (this.game == 3) {
			if (keyCode == 'ENTER') {
				if (this.success == 0 || this.success == 1) {
					if (this.select == 0) {
						this.game = 1; this.resetGame();
					}
					if (this.select == 1) {
						this.game = 0; this.resetGame(); this.select = 0;
					}
				}
				if (this.success == 2) {
					if (this.select == 0) {
						this.game = 6; this.startDelay2 = 1; this.select = 0; this.resetGame();
					}
					if (this.select == 1) {
						this.game = 0; this.resetGame(); this.select = 0;
					}
				}
			}
		}

		// Game Paused
		if (this.game == 4) {
			if (keyCode == 'ENTER') {
				if (this.select == 0) {
					if (this.delay2 > 5) {
						this.game = 1; this.delay2 = 0; this.startDelay2 = 0;
					}
				}
				if (this.select == 1) {
					this.resetGame(); this.game = 1;
				}
				if (this.select == 2) {
					this.game = 0; this.select = 0; this.resetGame();
				}
			}
		}

		// Upgrades Menu
		if (this.game == 6) {
			if (keyCode == 'ENTER') {
				if (this.select == 1 && this.money >= this.hCost && this.health < 2) {
					this.health += 1; this.HealthBar(); this.money -= this.hCost; this.hCost += 500;
				}
				if (this.select == 2 && this.money >= this.mCost && this.miss < 2) {
					this.miss += 1; this.money -= this.mCost; this.mCost = 2500;
				}
				if (this.select == 3 && this.money >= this.sCost && this.shoot < 2) {
					this.shoot += 1; this.money -= this.sCost; this.sCost = this.sCost * 2;
				}
				if (this.select == 4 && this.money >= this.cCost && this.move < 1) {
					this.move += 1; this.money -= this.cCost;
				}
				if (this.select == 5) {
					this.game = -1; this.select = 1; this.delay2 = 0; this.startDelay2 = 1; this.uy = 0;
				}
			}
		}

		// Level Select Menu
		if (this.game == -1) {
			if (keyCode == 'ENTER') {
				if (this.delay2 > 5) {
					if (this.mComplete >= this.select - 1) {
						if (this.select == 1) {
							this.game = 1; this.mission = 1; this.fuel = 3; this.startDelay2 = 0; this.delay2 = 0;
						}
						if (this.select == 2) {
							this.game = 1; this.mission = 2; this.fuel = 8; this.startDelay2 = 0; this.delay2 = 0;
						}
						if (this.select == 3) {
							this.game = 1; this.mission = 3; this.fuel = 8; this.startDelay2 = 0; this.delay2 = 0;
						}
					}
				}
			}
		}

		// Back Button
		if (this.game == -1 || this.game == 5 || this.game == 6 || this.game == 7) {
			if (keyCode == 'ENTER') {
				if (this.select == 0) {
					if (this.delay2 > 5) {
						this.game = 0; this.delay2 = 0; this.startDelay2 = 0;
					}
				}
			}
		}
	}

	private keyReleasedJava(keyCode: Key) {
		if (this.game == 1) {
			if (keyCode == 'W') this.bdy = 0;
			if (keyCode == 'S') this.bdy = 0;
			if (keyCode == 'A' || keyCode == 'D') {
				this.dtilt = 0;
				this.missiles.shot += 1;
			}
			if (keyCode == 'D') {
				this.count2++;
				if (this.count2 >= 2 || this.count3 >= 7) {
					this.count2 = 0; this.count3 = 0; this.startCounter1 = 0;
				}
			}
			if (keyCode == 'A') {
				this.count4++;
				if (this.count4 >= 2 || this.count5 >= 7) {
					this.count4 = 0; this.count5 = 0; this.startCounter2 = 0;
				}
			}
			if (this.shoot == 0 && this.sequence == 1) {
				if (keyCode == 'SPACE') {
					const b = this.bulletsR[this.count];
					if (!b) throw new JavaIndexError();
					b.y_speed = -8;
					b.x_speed = -9;
					b.changesize = -1;
					this.count++;
				}
			}
			if (keyCode == 'SHIFT') {
				if (this.miss > 0) {
					if (this.lockedon == 0) {
						this.missiles.y_speed = -3; this.missiles.changesize = -1; this.missiles.shot = 1; this.missiles.fired = 1;
					}
					if (this.lockedon == 1) {
						this.missiles.y_speed = -2; this.missiles.changesize = -1; this.missiles.fired = 1;
					}
				}
			}
		}
	}

	// ── One iteration of the Java run() loop ──
	private ticks = 0;
	tick() {
		const prevGame = this.game;
		const hitFlags = () => this.eJets.filter((j) => j.trigger == 1).length + this.ships.filter((s) => s.trigger == 1).length;
		const shipHealth = () => this.ships.reduce((sum, s) => sum + s.health, 0);
		const before = { lives: this.lives, hits: hitFlags(), ships: shipHealth(), base: this.aBase.health };
		this.tickJava();
		// Sounds, from what this step changed.
		if (this.game == 1) {
			if (hitFlags() > before.hits) this.sfx('boom');
			else if (shipHealth() < before.ships || this.aBase.health < before.base) this.sfx('baseHit');
			if (this.lives < before.lives) this.sfx('hit');
		}
		if (prevGame !== 3 && this.game === 3) this.sfx(this.success == 2 ? 'win' : 'lose');
		if (prevGame !== 3 && this.game === 3) this.onScore(this.mission, this.score);
		// Save progress every couple of seconds (the original only saved on Quit).
		if (++this.ticks % 120 === 0) this.save();
	}

	private tickJava() {
		if (this.startDelay2 == 1) this.delay2++;
		if (this.startCounter1 == 1) this.count3++;
		if (this.startCounter2 == 1) this.count5++;

		if (this.game == 1) {
			if (this.sequence == 0) {
				if (this.startTimer > 50) {
					this.sdy = 2;
					this.sy += this.sdy;
					this.sy2 += 1;
				}
			}
			if (this.sequence == 1) {
				this.by += this.bdy;
				this.bx += this.bdx;

				this.checkMComplete();

				this.fy -= idiv(this.bdy, 2);
				if (this.fy > 475) this.fy = 475;
				if (this.fy < 435) this.fy = 435;

				this.px -= idiv(this.bdx, 2);
				if (this.px > 320) this.px = 320;
				if (this.px < 240) this.px = 240;

				this.tilt += this.dtilt;
				if (this.by > -300) { this.by = -300; this.limit2 = 1; }
				if (this.by < -850) { this.by = -850; this.limit2 = 1; }
				if (this.bx > -300) { this.bx = -300; this.limit = 1; }
				if (this.bx < -850) { this.bx = -850; this.limit = 1; }
				if (this.bx < -300 && this.bx > -850) this.limit = 0;
				if (this.by < -300 && this.by > -850) this.limit2 = 0;

				if (this.tilt < 5 && this.tilt > -5) this.bdx = 0;
				else if (this.tilt > 5 && this.tilt < 90) this.bdx = 2;
				else if (this.tilt < -5 && this.tilt > -90) this.bdx = -2;

				if (this.tilt > 360 || this.tilt < -360) this.tilt = 0;
				if (this.tilt <= 60 && this.tilt >= -60) this.evade = 0;

				// Bullet Movement
				for (let i = 0; i < this.numBullets; i++) {
					this.bulletsR[i].move();
					this.bulletsL[i].move();
					this.bulletsR[i].checkBoundary();
					this.bulletsL[i].checkBoundary();
					if (this.bulletsR[i].reset == 1 || this.bulletsL[i].reset == 1) {
						this.bulletsR[i].x = 430;
						this.bulletsL[i].x = 150;
						this.bulletsR[i].reset = 0;
						this.bulletsL[i].reset = 0;
						this.count = 0;
					}
				}

				// Missile Movement
				if (this.lockedon == 1 && this.missiles.fired > 0) {
					const t = this.object == 1 ? this.eJets[this.target] : this.object == 2 ? this.ships[this.target] : null;
					if (t) {
						if (this.missiles.x > t.x) this.missiles.x_speed = -3;
						if (this.missiles.x < t.x) this.missiles.x_speed = 3;
						if (this.missiles.x == t.x) this.missiles.x_speed = 0;
						if (this.missiles.y > t.y) this.missiles.y_speed = -3;
						if (this.missiles.y < t.y) this.missiles.y_speed = 3;
						if (this.missiles.y == t.y) this.missiles.y_speed = 0;
					}
				}

				this.missiles.move();
				if (this.miss == 1) {
					if (this.missiles.y < 170) this.missiles.returnMissile();
				}
				if (this.miss == 2) {
					if (this.lockedon == 0 && this.missiles.y > 170) this.missiles.returnMissile();
					if (this.missiles.size < 3) {
						this.missiles.returnMissile();
						this.lockedon = 0;
					}
				}

				// Cloud Movement
				for (const c of this.clouds) {
					c.move();
					c.checkBoundary();
					c.x += this.bdx;
					c.y += this.bdy;
					if (c.x > 300) c.x_speed = 2;
					else if (c.x < 300) c.x_speed = -2;
					if (c.y > 150) c.y_speed = 2;
					else if (c.y < 150) c.y_speed = -2;
				}

				// Jets Movement
				for (const j of this.eJets) {
					if (this.mission == 1) { j.range1 = 300; j.range2 = 100; }
					if (this.mission == 2 || this.mission == 3) { j.range1 = 100; j.range2 = 30; }
					j.move();
					j.checkBoundary();
					j.x += this.bdx;
					j.y += this.bdy;
					if (j.x > 300) j.x_speed = -2;
					else if (j.x < 300) j.x_speed = 2;
					if (j.y > 150) j.y_speed = -2;
					else if (j.y < 150) j.y_speed = 2;
				}
				this.rotating();

				// Update Jet
				for (const j of this.eJets) {
					j.go++;
					if (j.go > 80) { j.leave = 1; j.stop = 0; }
					if (j.leave == 1) {
						if (j.x > 300) j.x_speed = 2;
						else if (j.x < 300) j.x_speed = -2;
						if (j.y > 150) j.y_speed = 2;
						else if (j.y < 150) j.y_speed = -2;
					}
				}

				// Update eBullets
				if (this.mission == 2 || this.mission == 3) {
					for (const b of this.eBullets) b.move();
					this.eBulletsMechanics();
					this.eBulletsLaunch();
					this.gotHit();
					this.checkHealth();
				}

				// Update Ships
				if (this.mission == 2) {
					for (const s of this.ships) {
						s.move();
						s.checkBoundary();
						s.x += this.bdx;
						s.y += this.bdy;
						if (s.x > 600) s.y = rnd(140) + this.by + 800;
					}
					this.hitShip();
					this.rotatingShips();
				}

				// Update Base
				if (this.mission == 3) {
					if (this.aBase.check < 4 && this.limit == 0) this.aBase.x += this.bdx;
					if (this.aBase.check < 4 && this.limit2 == 0) this.aBase.y += this.bdy;
					if (this.aBase.check >= 4) {
						this.aBase.x = this.bx + 750;
						this.aBase.y = this.by + 735;
					}
					this.hitBase();
					this.rotatingBase();
				}

				// Update Bounds (only the bullets' rectangles actually move; the rest were copies in Java)
				for (const b of this.bulletsL) { b.boundary.x = b.x; b.boundary.y = b.y; }
				for (const b of this.bulletsR) { b.boundary.x = b.x; b.boundary.y = b.y; }
				for (const r of this.rJets) r.move();
				this.hitJet();
				this.LockOn();
				this.radar();
				this.radarBoundary();
			}
			if (this.sequence == 2 || this.sequence == 3) {
				for (const c of this.clouds) c.move();
				for (const j of this.eJets) j.move();
				if (this.mission == 2) for (const s of this.ships) s.x = rnd(60) - 100;
				for (let i = 0; i < this.numBullets; i++) {
					this.bulletsR[i].move();
					this.bulletsL[i].move();
					this.bulletsR[i].checkBoundary();
					this.bulletsL[i].checkBoundary();
				}
			}
			// Reset Tilt
			if (this.sequence == 2) {
				if (this.tilt < 0) this.tilt++;
				else if (this.tilt > 0) this.tilt--;
				else {
					this.sequence = 3;
					this.lockedon = 0;
					this.missiles.fired = 0;
				}
				if (this.mission == 2 || this.mission == 3) this.sy = -200;
			}
			// Landing Sequence
			if (this.sequence == 3) {
				if (this.mission == 1) {
					this.sy -= 2;
					if (this.sy < -330) this.sequence = 4;
				} else if (this.mission == 2) {
					this.bdy = 2; this.by += this.bdy; this.sy += 2;
					if (this.by > -300) this.sequence = 4;
				} else if (this.mission == 3 && this.complete == 0) {
					this.bdy = 2; this.by += this.bdy; this.sy += 2;
					if (this.by > -300) this.sequence = 4;
				} else if (this.mission == 3 && this.complete == 1) {
					this.bdy = 1; this.by += this.bdy; this.sy += 1;
					this.aBase.y = this.by + 735;
					this.destroy = 1;
					if (this.by > -300) this.sequence = 4;
				}
			}
			this.Timer();
		}
	}

	checkHealth() {
		if (this.lives <= 0) {
			this.game = 3;
			this.select = 0;
		}
	}

	hitJet() {
		for (let i = 0; i < this.numJets; i++) {
			for (let a = 0; a < this.numBullets; a++) {
				if (this.bulletsL[a].y < 190 && this.bulletsL[a].boundary.intersects(this.eJets[i].boundary.getBounds())) {
					this.eJets[i].trigger = 1;
					this.lastShot = i;
				}
				if (this.bulletsR[a].y < 190 && this.bulletsR[a].boundary.intersects(this.eJets[i].boundary.getBounds())) {
					this.eJets[i].trigger = 1;
					this.lastShot = i;
				}
			}
			if (this.lockedon == 1 && this.object == 1) {
				if (this.missiles.fired > 0) {
					if (this.missiles.boundary.getBounds().intersects(this.eJets[this.target].boundary.getBounds())) {
						this.eJets[this.target].trigger = 1;
						this.lastShot = i;
						this.missiles.returnMissile();
						this.lockedon = 0;
					}
				}
			} else {
				if (this.missiles.fired > 0 && this.missiles.y < 190) {
					if (this.missiles.boundary.getBounds().intersects(this.eJets[i].boundary.getBounds())) {
						this.eJets[i].trigger = 1;
						this.lastShot = i;
						this.missiles.returnMissile();
					}
				}
			}
		}
	}

	eBulletsMechanics() {
		for (const b of this.eBullets) {
			const previousAX = b.x;
			const j = this.eJets[this.random];
			b.x = j.x + idiv(j.sizeW, 2);
			if (b.launch == 0) b.y = j.y + idiv(j.sizeH, 2);
			if (b.launch == 1) b.x = previousAX;
		}
	}

	eBulletsLaunch() {
		this.counter++;
		if (this.counter == 30) {
			this.random = rnd(this.numJets);
			this.eBullets[this.random].y_speed = 4;
			this.eBullets[this.random].changesize = 1;
			this.eBullets[this.random].launch = 1;
			for (const b of this.eBullets) {
				if (b.y > 400) {
					const j = this.eJets[this.random];
					b.launch = 0; b.y_speed = 0; b.changesize = 0; b.size = 5;
					b.y = j.y + idiv(j.sizeH, 2);
					b.x = j.x + idiv(j.sizeW, 2);
				}
			}
			this.counter = 0;
		}
	}

	hitShip() {
		for (let i = 0; i < this.numShips; i++) {
			for (let a = 0; a < this.numBullets; a++) {
				if (this.bulletsL[a].y < 190 && this.bulletsL[a].boundary.intersects(this.ships[i].boundary.getBounds())) {
					this.ships[i].health -= 1;
					if (this.ships[i].health < 0) this.ships[i].trigger = 1;
				}
				if (this.bulletsR[a].y < 190 && this.bulletsR[a].boundary.intersects(this.ships[i].boundary.getBounds())) {
					this.ships[i].health -= 1;
					if (this.ships[i].health < 0) this.ships[i].trigger = 1;
				}
			}
			if (this.lockedon == 1 && this.object == 2) {
				if (this.missiles.fired > 0) {
					const t = this.ships[this.target];
					if (this.missiles.boundary.getBounds().intersects(t.boundary.getBounds())) {
						t.health -= 5;
						if (t.health <= 0) t.trigger = 1;
						this.missiles.returnMissile();
						this.lockedon = 0;
					}
				}
			} else {
				if (this.missiles.fired > 0 && this.missiles.y < 190) {
					if (this.missiles.boundary.getBounds().intersects(this.ships[i].boundary.getBounds())) {
						this.ships[i].health -= 5;
						if (this.ships[i].health <= 0) this.ships[i].trigger = 1;
						this.missiles.returnMissile();
					}
				}
			}
		}
	}

	hitBase() {
		if (this.aBase.check >= 4) {
			for (let a = 0; a < this.numBullets; a++) {
				for (const b of [this.bulletsL[a], this.bulletsR[a]]) {
					if (b.y < 180 && b.boundary.intersects(this.aBase.boundary.getBounds())) {
						this.aBase.health -= 1;
						this.hw -= 3;
						this.score += 750;
					}
				}
			}
		}
	}

	gotHit() {
		if (this.evade == 0) {
			for (const b of this.eBullets) {
				if (this.hitbox.intersects(b.boundary.getBounds())) {
					if (b.size > 20) {
						const j = this.eJets[this.random];
						b.launch = 0; b.y_speed = 0; b.changesize = 0; b.size = 5;
						b.y = j.y + idiv(j.sizeH, 2);
						b.x = j.x + idiv(j.sizeW, 2);
						this.lives--;
					}
				}
			}
		}
	}

	HealthBar() {
		if (this.health == 0) this.lives = 6;
		else if (this.health == 1) this.lives = 12;
		else if (this.health == 2) this.lives = 24;
	}

	LockOn() {
		if (this.miss == 2) {
			for (let i = 0; i < this.numJets; i++) {
				if (this.hitbox.intersects(this.eJets[i].boundary.getBounds())) {
					this.target = i; this.lockedon = 1; this.object = 1;
					const t = this.eJets[this.target];
					this.lox = t.x; this.loy = t.y; this.low = t.sizeW; this.loh = t.sizeH;
				}
			}
			for (let i = 0; i < this.numShips; i++) {
				if (this.hitbox.intersects(this.ships[i].boundary.getBounds())) {
					this.target = i; this.lockedon = 1; this.object = 2;
					const t = this.ships[this.target];
					this.lox = t.x; this.loy = t.y; this.low = t.sizeW; this.loh = t.sizeH;
				}
			}
			if (this.lox < this.hbx || this.lox > this.hbx + this.hbw || this.loy < this.hby || this.loy > this.hby + this.hbh) {
				this.lox = 800;
				if (this.missiles.fired == 0) this.lockedon = 0;
			}
		}
	}

	radar() {
		for (let i = 0; i < this.numJets; i++) {
			if (this.eJets[i].sizeW == 5) this.rJets[i].y = 353;
			if (this.eJets[i].sizeW > 5) this.rJets[i].x = 247 + idiv(this.eJets[i].x, 6);
		}
	}

	radarBoundary() {
		for (const r of this.rJets) if (r.y > 418) r.y = 800;
	}

	checkMComplete() {
		const done = (m: number) => {
			this.sy = 200; this.sequence = 2; this.success = 2; this.complete = 1;
			if (this.mComplete < m) this.mComplete = m;
		};
		if (this.mission == 1 && this.kills >= 75) done(1);
		if (this.mission == 2 && this.killsShip >= 30) done(2);
		if (this.mission == 3 && this.aBase.health <= 0) {
			// Destroying the army base is worth a bonus (once, as the mission completes).
			if (this.complete == 0) this.score += BASE_BONUS;
			done(3);
		}
	}

	rotating() {
		for (const j of this.eJets) j.boundary = j.boundary.rotated(this.tilt, this.centerX, this.centerY);
	}
	rotatingShips() {
		for (const s of this.ships) s.boundary = s.boundary.rotated(this.tilt, this.centerX, this.centerY);
	}
	rotatingBase() {
		// (The original loops over numShips here, rotating the base's box three times.)
		for (let i = 0; i < this.numShips; i++) this.aBase.boundary = this.aBase.boundary.rotated(this.tilt, this.centerX, this.centerY);
	}

	checkSize() {
		const b = this.aBase;
		if (b.sizeW > 300) { b.sizeW = 300; b.changesizeW = 0; b.check++; }
		if (b.sizeH > 120) { b.sizeH = 120; b.changesizeH = 0; b.check++; }
		if (b.y < this.by + 735) { b.y = this.by + 735; b.y_speed = 0; b.check++; }
		if (b.x < this.bx + 750) { b.x = this.bx + 750; b.x_speed = 0; b.check++; }
	}

	Timer() {
		if (this.sequence == 1) {
			for (const j of this.eJets) {
				if (j.trigger == 1) {
					j.deathTimer++;
					if (j.deathTimer == 30) {
						j.y = 800; j.deathTimer = 0;
						this.kills++;
						this.score += 1000;
					}
				}
			}
			if (this.mission == 2) {
				for (const s of this.ships) {
					if (s.trigger == 1) {
						s.deathTimer++;
						if (s.deathTimer == 30) {
							s.dead();
							s.y = rnd(140) + this.by + 800;
							s.deathTimer = 0;
							this.killsShip++;
							this.score += 2500;
						}
					}
				}
			}
			if (this.mission == 3) {
				const b = this.aBase;
				if (b.initial == -1) { b.y = 900; b.x = 900; }
				else if (b.initial == 0) { b.y = this.by + 795; b.x = this.bx + 900; b.initial = 1; }
				else if (b.initial == 1) b.appear();
				if (this.fuel == 5 && b.initial == -1) b.initial = 0;
				this.checkSize();
			}
		}
		if (this.sequence == 0) {
			this.startTimer++;
			if (this.startTimer == 350) {
				this.sequence = 1;
				this.startTimer = 0;
			}
		}
		if (this.sequence == 1) {
			this.fuelTimer++;
			if (this.fuelTimer == 4000) {
				this.fuel--;
				this.fuelTimer = 0;
			}
			if (this.fuel == 0) {
				this.sy = 200;
				this.sequence = 2;
			}
		}
		if (this.sequence == 4) {
			this.EndTimer++;
			if (this.EndTimer == 200) {
				if (this.complete == 0) this.success = 1;
				this.game = 3;
				this.select = 0;
				this.startDelay2 = 1;
				this.EndTimer = 0;
			}
		}
	}

	resetGame() {
		this.sequence = 0; this.bx = -600; this.by = -650; this.bdx = 0; this.bdy = 0; this.tilt = 0; this.dtilt = 0;
		this.sy = 150; this.sy2 = -700; this.sdy = 0; this.startTimer = 0; this.count = 0; this.px = 285; this.fy = 450;
		this.deathTimer = 0; this.lastShot = 0; this.startDelay = 0; this.delay2 = 0; this.check = 0;
		this.count2 = 0; this.count3 = 0; this.count4 = 0; this.count5 = 0; this.startCounter1 = 0; this.startCounter2 = 0;
		this.fuel = this.mission == 1 ? 3 : 8;
		this.fuelTimer = 0; this.EndTimer = 0;
		if (this.success == 2) this.money += 300;
		this.success = 0; this.complete = 0; this.score = 0;
		this.money += this.earned;
		this.gp++;
		this.earned = 0; this.kills = 0; this.uy = 0; this.lockedon = 0; this.target = 0;
		this.killsShip = 0; this.lox = 800;
		if (this.health == 0) this.lives = 6;
		else if (this.health == 1) this.lives = 12;
		else if (this.health == 2) this.lives = 24;
		for (const j of this.eJets) j.y = 800;
		for (const s of this.ships) {
			s.x = rnd(60) - 100;
			s.y = rnd(140) + this.by + 800;
		}
		for (let i = 0; i < this.numBullets; i++) {
			this.bulletsR[i].x = 430; this.bulletsR[i].y = 300;
			this.bulletsL[i].x = 150; this.bulletsL[i].y = 300;
		}
		const b = this.aBase;
		b.y = 900; b.changesizeW = 3; b.changesizeH = 1; b.sizeH = 4; b.sizeW = 10; b.x_speed = -3; b.y_speed = -1;
		b.initial = -1; b.check = 0; b.health = 100;
		this.hw = 300; this.destroy = 0;
		this.a.anim.LandingSeq.restart();
		this.save();
	}

	// ── Drawing (paintComponent) ──
	private ctx!: CanvasRenderingContext2D;
	private now = 0;

	private setColor(c: string) {
		this.color = c;
	}
	private img(name: ImageName, x: number, y: number, w: number, h: number) {
		if (w === 0 || h === 0) return;
		this.ctx.drawImage(this.a.img[name], x, y, w, h);
	}
	private anim(name: AnimName, x: number, y: number, w: number, h: number) {
		this.a.anim[name].draw(this.ctx, this.now, x, y, w, h);
	}
	private fillOval(x: number, y: number, w: number, h: number) {
		if (w <= 0 || h <= 0) return;
		const c = this.ctx;
		c.fillStyle = this.color;
		c.beginPath();
		c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
		c.fill();
	}
	private fillRect(x: number, y: number, w: number, h: number) {
		this.ctx.fillStyle = this.color;
		this.ctx.fillRect(x, y, w, h);
	}
	private drawRect(x: number, y: number, w: number, h: number) {
		const c = this.ctx;
		c.strokeStyle = this.color;
		c.lineWidth = 1;
		c.strokeRect(x + 0.5, y + 0.5, w, h);
	}
	private font(px: number, family = AGENCY) {
		this.ctx.font = `bold ${px}px ${family}`;
	}
	private drawString(s: string, x: number, y: number) {
		this.ctx.fillStyle = this.color;
		this.ctx.textBaseline = 'alphabetic';
		this.ctx.fillText(s, x, y);
	}
	private stringWidth(s: string) {
		return this.ctx.measureText(s).width;
	}
	/** g2.rotate(toRadians(deg), cx, cy) around a block of drawing (colour is not restored, as in Java). */
	private rotated(deg: number, cx: number, cy: number, draw: () => void) {
		const c = this.ctx;
		c.save();
		c.translate(cx, cy);
		c.rotate((deg * Math.PI) / 180);
		c.translate(-cx, -cy);
		draw();
		c.restore();
	}

	/** Your gun rounds: a hot tracer with a fading streak behind it (same position and size as before). */
	private tracer(b: Bullets) {
		if (b.x_speed == 0 && b.y_speed == 0) return; // waiting in the gun
		const ctx = this.ctx;
		const r = Math.max(2, b.size / 2);
		const cx = b.x + r, cy = b.y + r;
		const tx = cx - b.x_speed * 3.2, ty = cy - b.y_speed * 3.2;
		ctx.save();
		const streak = ctx.createLinearGradient(tx, ty, cx, cy);
		streak.addColorStop(0, 'rgba(230,90,0,0)');
		streak.addColorStop(1, 'rgba(255,170,30,0.95)');
		ctx.strokeStyle = streak;
		ctx.lineWidth = Math.max(2, r * 0.9);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(tx, ty);
		ctx.lineTo(cx, cy);
		ctx.stroke();
		const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
		glow.addColorStop(0, 'rgba(255,255,230,1)');
		glow.addColorStop(0.35, 'rgba(255,190,40,0.95)');
		glow.addColorStop(1, 'rgba(230,90,0,0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	/** Enemy fire: a pulsing red plasma ball that grows as it comes at you. */
	private plasma(b: Bullets) {
		if (b.launch != 1) return; // not fired yet (it waits inside its jet)
		const ctx = this.ctx;
		const r = b.size / 2;
		const cx = b.x + r, cy = b.y + r;
		const R = r * 1.8 * (1 + 0.12 * Math.sin(this.now / 60));
		ctx.save();
		const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
		glow.addColorStop(0, 'rgba(255,255,255,1)');
		glow.addColorStop(0.3, 'rgba(255,110,70,0.95)');
		glow.addColorStop(0.65, 'rgba(220,20,20,0.55)');
		glow.addColorStop(1, 'rgba(160,0,0,0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(cx, cy, R, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	paint(ctx: CanvasRenderingContext2D, now: number) {
		this.ctx = ctx;
		this.now = now;
		this.color = C.DEFAULT;
		ctx.imageSmoothingEnabled = false; // Java's default (nearest neighbour) when scaling
		ctx.fillStyle = 'rgb(238,238,238)';
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		// GAME GRAPHICS
		if (this.game == 1 || this.game == 4) {
			this.rotated(this.tilt, this.centerX, this.centerY, () => {
				if (this.mission == 1) this.img('TGBack1', this.bx, this.by, 1600, 1600);
				if (this.mission == 2) this.img('TGBack2', this.bx, this.by, 1600, 1600);
				if (this.mission == 3) this.img('TGBack3', this.bx, this.by, 1600, 1600);

				if (this.sequence == 0) {
					if (this.mission == 1) this.img('TGBack2', 0, this.sy2, 1600, 1600);
					this.img('Runway', 0, this.sy, 600, 200);
					if (this.mission == 1) this.img('BackDrop1', 0, this.sy - 600, 600, 300);
				}
				if (this.sequence == 3) {
					if (this.mission == 1) this.img('LandingBack', 0, -600, 1600, 1600);
					this.img('BackDrop1', 0, this.sy, 600, 300);
				}

				// Ships
				if (this.mission == 2) {
					for (const s of this.ships) {
						if (s.trigger == 0) this.img('eships', s.x, s.y, s.sizeW, s.sizeH);
						else if (s.trigger == 1) this.anim('Boom', s.x, s.y, s.sizeW, s.sizeH + s.sizeH);
					}
				}

				if (this.mission == 3) {
					const b = this.aBase;
					this.img('Base', b.x, b.y, b.sizeW, b.sizeH);
					if (this.destroy == 1) {
						for (let i = 0; i < 5; i++) {
							const randomx = Math.floor(Math.random() * 300 + b.x);
							const randomy = Math.floor(Math.random() * 120 + b.y);
							this.anim('Boom', randomx, randomy, 30, 30);
						}
					}
				}

				if (this.missiles.fired == 0 && this.sequence == 1) {
					this.setColor(C.RED);
					this.drawRect(this.lox, this.loy, this.low, this.loh);
				}

				// Clouds
				if (this.sequence == 1 || this.sequence == 2) {
					for (const c of this.clouds) this.img('Cloud', c.x, c.y, c.size, c.size);

					// Enemy Bullets
					if (this.mission == 2 || this.mission == 3) {
						for (const b of this.eBullets) this.plasma(b);
					}

					// Enemies
					this.setColor(C.GRAY);
					for (const j of this.eJets) {
						if (this.mission == 1) {
							if (j.trigger == 0) this.img('ejets', j.x, j.y, j.sizeW, j.sizeH);
						} else if (this.mission == 2 || this.mission == 3) {
							if (j.trigger == 0) this.img('ejets2', j.x, j.y, j.sizeW, j.sizeH);
						}
						if (j.trigger == 1) this.anim('Boom', j.x, j.y, j.sizeW, j.sizeH + j.sizeH);
					}
				}
			});

			// Missiles
			const m = this.missiles;
			if (m.fired > 0) {
				if (this.dtilt == 0 && m.shot == 1) this.img('missile', m.x, m.y, m.size, m.size);
				else this.rotated(this.tilt, 280, 320, () => this.img('missile', m.x, m.y, m.size, m.size));
			}

			// Bullets, cockpit and radar
			if (this.sequence == 1 || this.sequence == 0 || this.sequence == 2 || this.sequence == 3) {
				for (const b of this.bulletsR) this.tracer(b);
				for (const b of this.bulletsL) this.tracer(b);

				this.img('Reticle', 195, 80, 200, 200);
				this.img('Dashboard', 0, 300, 600, 236);

				this.img('Radar1', 189, 337, 222, 149);
				this.setColor(C.RED);
				for (let i = 0; i < this.numJets; i++) {
					if (this.eJets[i].trigger == 0) {
						const r = this.rJets[i];
						this.fillOval(r.x, r.y, r.sizeW, r.sizeH);
					}
				}
				this.img('CoverRadar', 189, 337, 222, 149);
				this.img('PInd', this.px, 415, 18, 13);
			}
			if (this.sequence == 0) this.img('TakeOff', 189, 337, 222, 149);
			if (this.sequence == 2 || this.sequence == 3) this.img('Landing', 189, 337, 222, 149);

			// Lives and fuel
			for (let i = 0; i < this.lives && i < this.lx.length; i++) this.fillRect(this.lx[i], this.ly[i], 16, 6);
			for (let i = 0; i < this.fuel && i < this.f2y.length; i++) this.fillRect(18, this.f2y[i], 15, 6);

			this.rotated(-this.tilt, this.center2X, this.center2Y, () => this.img('FInd', 72, this.fy, 59, 17));

			if (this.sequence == 4) this.anim('LandingSeq', -43, 0, 686, 600);
		}

		// Mission Objectives
		if (this.game == 1) {
			if (this.sequence == 0 || this.sequence == 1) {
				if (this.mission == 1) {
					this.setColor(C.Green);
					this.font(20);
					this.img('Mission1', 0, 0, 600, 600);
					this.drawString('' + this.kills, 125, 288);
				}
				if (this.mission == 2) {
					this.setColor(C.Green);
					this.font(20);
					this.img('Mission2', 0, 0, 600, 600);
					this.drawString('' + this.killsShip, 125, 288);
				}
				if (this.mission == 3) {
					if (this.aBase.check < 4) this.img('Mission3a', 0, 0, 600, 600);
					if (this.aBase.check >= 4) {
						this.img('Mission3b', 0, 0, 600, 600);
						this.setColor(C.GRAY);
						this.fillRect(150, 12, 300, 8);
						this.setColor(C.RED);
						this.fillRect(150, 12, this.hw, 8);
						this.setColor(C.BLACK);
						this.font(15, 'Arial, sans-serif');
						this.drawString('Army Base', 270, 35);
					}
				}
			}
		}

		// Menus (and the pause / mission-over screens) are drawn over whatever is above.
		if (this.game != 1) this.paintMenus();
	}
}

type Key = 'W' | 'A' | 'S' | 'D' | 'SPACE' | 'SHIFT' | 'ENTER';
function keyOf(code: string): Key | null {
	switch (code) {
		case 'KeyW': return 'W';
		case 'KeyA': return 'A';
		case 'KeyS': return 'S';
		case 'KeyD': return 'D';
		case 'Space': return 'SPACE';
		case 'ShiftLeft':
		case 'ShiftRight': return 'SHIFT';
		case 'Enter':
		case 'NumpadEnter': return 'ENTER';
		default: return null;
	}
}
