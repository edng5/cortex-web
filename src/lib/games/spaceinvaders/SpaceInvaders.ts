// Space Invaders (SpaceInvaders.java and its classes), ported to TypeScript. The Java logic is kept
// as written, quirks included. Changes: the menus are redrawn and clicked or tapped (Options puts
// controls, difficulty and ship on one page), the default ship controls are A/D ("Lefty"), and
// No Shields (the original's "Shields Down" switch) is a third difficulty: Hard's waves and
// bosses without bunkers, so each difficulty has its own leaderboard.
import { Rect } from '../topgun/geometry';
import { ARIAL, ARIAL_BLACK, Confirm, drawGameOver, loadArcadeFont, Gfx, buttonAt, drawButtons, drawRecord, keyRow, loadImages, loadSave, padlock, panel, text, touchScreen, writeSave, type ArcadeGame, type Board, type UiButton, type UiTheme } from '../common';

export const GAME_W = 550;
export const GAME_H = 664;
export const TICK_MS = 15;

const BASE = '/games/spaceinvaders/';
const IMAGES = {
	SpaceMM: 'SpaceMM.jpg', A11: 'A11.png', A12: 'A12.png', A21: 'A21.png', A22: 'A22.png', A31: 'A31.png', A32: 'A32.png',
	SShip: 'SShip.png', MShip: 'MShip.png', Mooneyship: 'Mooneyship.png', AlienShot: 'AlienShot.png', ShipShot: 'ShipShot.png',
	MMAlien1: 'MMAlien1.png', MMAlien2: 'MMAlien2.png',
	Shield1: 'Shield1.png'
};
type Images = Record<keyof typeof IMAGES, HTMLImageElement>;
export const loadAssets = () => loadImages(BASE, IMAGES);

const SAVE_KEY = 'spaceinvaders-save';
const rnd = (n: number) => Math.floor(Math.random() * n);
const Yellow = 'rgb(255,221,15)';

// ── Menu look: arcade yellow on black ──
const UI: UiTheme = {
	family: ARIAL_BLACK,
	size: 22,
	detailSize: 12,
	radius: 4,
	caps: true,
	borderWidth: 2,
	glow: 'rgba(255,170,0,0.55)',
	cardHover: '#fff',
	idle: { fill: 'rgba(0,0,0,0.6)', text: Yellow, border: 'rgba(255,221,15,0.45)', detail: 'rgba(255,221,15,0.7)' },
	hover: { fill: Yellow, text: '#000', border: Yellow, detail: 'rgb(150,40,0)' },
	primary: { fill: 'rgba(255,221,15,0.14)', text: Yellow, border: Yellow, detail: 'rgba(255,221,15,0.8)' },
	danger: { fill: 'rgba(0,0,0,0.6)', text: '#ff6e6e', border: 'rgba(255,110,110,0.7)' },
	chosen: { fill: 'rgba(255,221,15,0.12)', text: Yellow, border: Yellow },
	disabled: { fill: 'rgba(255,255,255,0.03)', text: 'rgba(255,221,15,0.3)', border: 'rgba(255,221,15,0.18)' }
};
const KEY = { family: 'Arial, sans-serif', fill: '#f2f2f2', text: '#111', border: '#888', size: 13, h: 28 };
/** A check mark on the picked option. */
function tick(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
	ctx.save();
	ctx.strokeStyle = Yellow;
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(cx - 7, cy);
	ctx.lineTo(cx - 2, cy + 5);
	ctx.lineTo(cx + 8, cy - 6);
	ctx.stroke();
	ctx.restore();
}

class Aliens {
	sizeW = 40; sizeH = 20; y_speed = 0; x_speed = 2; x = 10; y = 50; delay = 0; alive = 1; shot = 0;
	boundaryA = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveA() {
		this.delay++;
		if (this.delay == 10) {
			this.x += this.x_speed;
			this.delay = 0;
		}
		this.boundaryA = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	}
	deadA() {
		this.y = 750;
		this.alive = 0;
	}
}

class Boss {
	sizeW = 400; sizeH = 200; y_speed = 0; x_speed = 0; x = 75; y = -250; delay = 0; alive = 1; health = 50; shot = 0; battle = 0;
	boundaryB = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveB() {
		this.delay++;
		if (this.delay == 10) {
			this.y += this.y_speed;
			this.x += this.x_speed;
			this.delay = 0;
		}
		if (this.alive == 1) this.boundaryB = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	}
	deadB() {
		this.y = -250; this.x = 75; this.alive = 0; this.health = 50; this.shot = 0; this.x_speed = 0; this.battle = 0;
	}
	checkBoundaryB() {
		if (this.y > 50) {
			this.y = 50;
			this.y_speed = 0;
			this.battle = 1;
		}
	}
}

class Missile {
	sizeW = 3; sizeH = 10; y_speed = 0; x = 150; y = 595;
	boundaryM = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveM() {
		this.y += this.y_speed;
		this.boundaryM = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	}
	checkBoundaryM() {
		this.y = 595;
		this.y_speed = 0;
	}
}

class Mothership {
	sizeW = 40; sizeH = 20; x_speed = 2; x = -300; y = 10; shot = 0;
	boundaryA = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveA() {
		this.x += this.x_speed;
		this.boundaryA = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	}
	deadA() {
		this.x = -300;
		this.x_speed = 2;
	}
	checkBoundaryA() {
		if (this.x > 1000) this.x = -300;
	}
}

/**
 * A bunker block, drawn as chunky arcade pixels (10 × 10 cells of 3 px). The top outer corners of
 * each bunker are bevelled and the middle of its second row has the arch; damage eats away cells
 * in a pattern fixed for each block, more with every hit. Cached per block and damage level.
 */
const shieldCache = new Map<string, HTMLCanvasElement>();
function shieldSprite(i: number, lives: number): HTMLCanvasElement {
	const key = i + ':' + lives;
	const hit = shieldCache.get(key);
	if (hit) return hit;
	const N = 10, C = 3;
	let seed = i * 9301 + 49297;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const cells: { r: number; c: number; order: number }[] = [];
	for (let r = 0; r < N; r++) {
		for (let c = 0; c < N; c++) {
			if ([0, 3, 6].includes(i) && r < (N - 1 - c) * 0.6) continue; // bevel, top left
			if ([2, 5, 8].includes(i) && r < c * 0.6) continue; // bevel, top right
			if ([10, 13, 16].includes(i) && Math.hypot(c + 0.5 - N / 2, r + 0.5 - N) < 4.6) continue; // arch
			// Damage starts at the edges and spreads in.
			const edge = Math.min(r, c, N - 1 - r, N - 1 - c);
			cells.push({ r, c, order: rand() + edge * 0.12 });
		}
	}
	const gone = Math.round(cells.length * (lives >= 3 ? 0 : lives == 2 ? 0.3 : 0.58));
	const keep = cells.sort((a, b) => a.order - b.order).slice(gone);
	const cv = document.createElement('canvas');
	cv.width = cv.height = N * C;
	const x = cv.getContext('2d')!;
	for (const { r, c } of keep) {
		const light = r < 2 ? 18 : r > N - 3 ? -18 : 0; // lit from above
		x.fillStyle = `rgb(${50 + light},${lives == 1 ? 205 : 235 + Math.min(20, light)},${50 + light})`;
		x.fillRect(c * C, r * C, C, C);
	}
	shieldCache.set(key, cv);
	return cv;
}

class Shields {
	sizeW = 30; sizeH = 30; x = 50; y = 450; lives = 3;
	boundaryS = new Rect(this.x, this.y, this.sizeW, this.sizeH);
}

class Ship {
	sizeW = 50; sizeH = 30; x_speed = 0; x = 250; y = 600; delay = 0; lives = 3; shot = 0;
	boundaryS = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveS() {
		this.delay++;
		if (this.delay == 1) {
			this.x += this.x_speed;
			this.boundaryS = new Rect(this.x, this.y, this.sizeW, this.sizeH);
			this.delay = 0;
		}
	}
	checkBoundaryS() {
		if (this.x < 0) this.x = 0;
		if (this.x > 540 - this.sizeW) this.x = 490;
	}
}

class AlienMissile {
	sizeW = 3; sizeH = 10; y_speed = 0; x = 25; y = 50; launchA = 0;
	boundaryAM = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	moveAM() {
		this.y += this.y_speed;
		this.boundaryAM = new Rect(this.x, this.y, this.sizeW, this.sizeH);
	}
}

type Key = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'A' | 'D' | 'SPACE' | 'SHIFT' | 'ENTER';
function keyOf(code: string): Key | null {
	switch (code) {
		case 'KeyW': return 'UP';
		case 'KeyS': return 'DOWN';
		case 'KeyA': return 'A';
		case 'KeyD': return 'D';
		case 'ArrowLeft': return 'LEFT';
		case 'ArrowRight': return 'RIGHT';
		case 'Space': return 'SPACE';
		case 'ShiftLeft':
		case 'ShiftRight': return 'SHIFT';
		case 'Enter':
		case 'NumpadEnter': return 'ENTER';
	}
	return null;
}

export class SpaceInvaders implements ArcadeGame {
	// ── Fields (as in SpaceInvaders.java) ──
	ship = new Ship();
	missile = new Missile();
	mothership = new Mothership();
	boss = new Boss();
	numAliens = 45; numMissiles = 45; numBMissiles = 45; numShields = 24;
	aliens: Aliens[] = [];
	aMissiles: AlienMissile[] = [];
	bMissiles: AlienMissile[] = [];
	shields: Shields[] = [];
	game = 0; select = 0; rx = 100; ry = 370;
	goy = -100; goy_speed = 0;
	launch = 0; checkA = 8; check = 2; counter = 0; aCounter = 0; livesCount = 3; score = 0; wave = 0;
	deathTimer = 0; trigger = 0; lastShot = 0; deathTimer2 = 0; trigger2 = 0; trigger3 = 0; trigger4 = 0;
	gp = 0; highscore = 0; hwave = 0; kills = 0; bosses = 0; counter2 = 0;
	hsx = 450;
	character = 1; controls = 2; difficulty = 1;
	aTurn = 0; delay = 0; delay2 = 0; startDelay = 0;
	bossLvl = 0; bossWave = 2; healthw = 400;
	random = rnd(45); random2 = rnd(45); randomx = rnd(400) + 1;
	lives = [430, 465, 500];
	shieldsDown = 0;
	unlock = 0;
	LeftBound = new Rect(-10, 0, 10, 700);
	RightBound = new Rect(540, 0, 10, 700);
	ShipBound = new Rect(0, 590, 550, 20);

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	/** Sound effects (set by the host). */
	sfx: (name: string) => void = () => {};
	/** Soundtrack: menus, then one per difficulty while playing (and paused). */
	musicTrack() {
		if ([0, 3, 4, 5, 6, 7].includes(this.game)) return 'spaceinvaders-menu';
		if (this.game == 1 || this.game == 8) return 'spaceinvaders-' + this.difficulty;
		return null;
	}
	private stepSound = 0;
	private ticks = 0;
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();

	constructor(private img: Images) {
		loadArcadeFont();
		Object.assign(
			this,
			loadSave(SAVE_KEY, { gp: 0, highscore: 0, hwave: 0, kills: 0, bosses: 0, unlock: 0, controls: 2, difficulty: 1, character: 1, shieldsDown: 0 })
		);
		if (this.unlock != 1 && this.character == 2) this.character = 1;
		if (this.shieldsDown == 1) this.difficulty = 3; // saves from when No Shields was a switch
		this.shieldsDown = this.difficulty == 3 ? 1 : 0;
		// Create Aliens
		let startx = 0, starty = 0;
		for (let i = 0; i < this.numAliens; i++) {
			const a = new Aliens();
			a.x += startx;
			a.y += starty;
			a.boundaryA = new Rect(a.x, a.y, a.sizeW, a.sizeH);
			this.aliens.push(a);
			startx += 50;
			if (i == this.checkA) {
				starty += 30;
				startx = 0;
				this.checkA += 9;
			}
		}
		// Create Alien Missiles
		for (let i = 0; i < this.numMissiles; i++) {
			this.random = rnd(45);
			const m = new AlienMissile();
			m.x = this.aliens[this.random].x + 20;
			m.y = this.aliens[this.random].y;
			this.aMissiles.push(m);
		}
		// Create Boss Missiles
		for (let i = 0; i < this.numBMissiles; i++) {
			this.randomx = rnd(400) + this.boss.x;
			const m = new AlienMissile();
			m.x = this.randomx;
			m.y = 150;
			this.bMissiles.push(m);
		}
		for (let i = 0; i < this.numShields; i++) this.shields.push(new Shields());
		this.placeShields();
	}

	save() {
		const { gp, highscore, hwave, kills, bosses, unlock, controls, difficulty, character, shieldsDown } = this;
		writeSave(SAVE_KEY, { gp, highscore, hwave, kills, bosses, unlock, controls, difficulty, character, shieldsDown });
	}

	/** The three bunkers (with their gaps), as in the constructor and resetGame(). */
	private placeShields() {
		let startsx = 0, startsy = 0, shieldCount = 0;
		for (const s of this.shields) {
			s.x = 50 + startsx;
			s.y = 450 + startsy;
			s.lives = 3;
			s.boundaryS = new Rect(s.x, s.y, s.sizeW, s.sizeH);
			startsx += 30;
			shieldCount++;
			if ([3, 6, 12, 15, 20, 22].includes(shieldCount)) startsx += 90;
			if (shieldCount == 9 || shieldCount == 18) {
				startsx = 0;
				startsy += 30;
			}
			if (shieldCount == 19 || shieldCount == 21 || shieldCount == 23) startsx += 30;
		}
	}

	leave() {
		// Playing or paused: count the score, as Main Menu from the pause screen does.
		if ((this.game == 1 || this.game == 8) && this.score > 0) this.onScore(this.difficulty, this.score);
		this.save();
	}

	// ── Menus: drawn buttons and cards, clicked or tapped (the keyboard is for playing) ──
	// Screens (`game`): 0 title, 3 high scores, 4 options (controls, difficulty and ship on one
	// page), 8 paused.
	private hover: string | null = null;
	private confirm = new Confirm();

	/** Picks menu item `sel` the way the Java menus did (cursor on it, then Enter). */
	private press(sel: number) {
		const wasPaused = this.game == 8;
		const score = this.score;
		this.select = sel;
		this.keyPressedJava('ENTER');
		this.sfx('confirm');
		// Leaving a run from the pause menu still counts its score.
		if (wasPaused && this.game == 0 && score > 0) this.onScore(this.difficulty, score);
	}
	/** Back to the main menu from Options (as its Back item did). */
	private toMain() {
		this.game = 0; this.select = 0; this.delay2 = 0; this.startDelay = 0;
		this.save();
	}

	private ui(): UiButton[] {
		const back: UiButton = { id: 'back', x: 14, y: 14, w: 96, h: 36, label: '‹ Back', size: 15, onClick: () => this.press(0) };
		switch (this.game) {
			case 0: {
				const rows: [string, string?][] = [
					['New Game', ['', 'Normal', 'Hard', 'No Shields'][this.difficulty]],
					['High Scores'],
					['Options', 'Controls, difficulty and ship'],
					['Quit Game']
				];
				return rows.map(([label, detail], i) => ({
					id: 'main' + i, label, detail, x: 125, y: 340 + i * 66, w: 300, h: 54, kind: i == 0 ? ('primary' as const) : undefined, onClick: () => this.press(i)
				}));
			}
			case 3: {
				const armed = this.confirm.isArmed('clear');
				return [
					back,
					{
						id: 'clear', x: 315, y: 596, w: 220, h: 44, label: armed ? 'Click again to clear' : 'Clear stats', size: 15, kind: 'danger',
						onClick: () => this.confirm.press('clear') && this.press(1)
					}
				];
			}
			case 4:
				return [
					{ ...back, onClick: () => this.toMain() },
					...([[2, 'Lefty', ['A', 'D']], [1, 'Righty', ['←', '→']]] as const).map(([c, name, keys], i): UiButton => ({
						id: 'ctl' + c, x: 25 + i * 255, y: 128, w: 245, h: 92, chosen: this.controls == c,
						draw: (ctx, b) => {
							text(ctx, name.toUpperCase(), b.x + 18, b.y + 24, { size: 17, family: ARIAL_BLACK, color: Yellow });
							keyRow(ctx, [...keys], b.x + 18, b.y + 44, KEY);
							text(ctx, 'move', b.x + 98, b.y + 59, { size: 14, family: ARIAL, color: '#ddd', bold: false });
							if (this.controls == c) tick(ctx, b.x + b.w - 26, b.y + 24);
						},
						onClick: () => (this.controls = c)
					})),
					...[1, 2, 3].map((d): UiButton => ({
						id: 'diff' + d, x: 20 + (d - 1) * 175, y: 270, w: 160, h: 132, chosen: this.difficulty == d,
						draw: (ctx, b) => this.drawDifficulty(ctx, b, d),
						onClick: () => {
							this.difficulty = d; // 1 Normal, 2 Hard, 3 No Shields
							this.shieldsDown = d == 3 ? 1 : 0;
						}
					})),
					...[1, 2].map((c): UiButton => {
						const locked = c == 2 && this.unlock != 1;
						return {
							id: 'ship' + c, x: 25 + (c - 1) * 255, y: 452, w: 245, h: 112, chosen: this.character == c, disabled: locked,
							draw: (ctx, b) => {
								ctx.globalAlpha = locked ? 0.4 : 1;
								ctx.drawImage(c == 1 ? this.img.SShip : this.img.Mooneyship, b.x + b.w / 2 - 40, b.y + 18, 80, 48);
								text(ctx, c == 1 ? 'SPACESHIP' : 'MOONEYSHIP', b.x + b.w / 2, b.y + 86, { size: 16, family: ARIAL_BLACK, color: Yellow, align: 'center' });
								ctx.globalAlpha = 1;
								if (locked) {
									padlock(ctx, b.x + b.w - 26, b.y + 24, 22, Yellow);
									text(ctx, 'Unlock: defeat a boss', b.x + b.w / 2, b.y + 104, { size: 12, family: ARIAL, color: '#ff8a80', align: 'center' });
								} else if (this.character == c) tick(ctx, b.x + b.w - 26, b.y + 24);
							},
							onClick: () => (this.character = c)
						};
					})
				];
			case 8:
				return [
					{ id: 'resume', x: 150, y: 300, w: 250, h: 52, label: 'Resume', kind: 'primary', onClick: () => this.press(0) },
					{ id: 'quit', x: 150, y: 364, w: 250, h: 52, label: 'Main menu', onClick: () => this.press(1) }
				];
		}
		return [];
	}

	private drawDifficulty(ctx: CanvasRenderingContext2D, b: UiButton, d: number) {
		const i = this.img;
		const cx = b.x + b.w / 2;
		text(ctx, ['', 'NORMAL', 'HARD', 'NO SHIELDS'][d], cx, b.y + 22, { size: 15, family: ARIAL_BLACK, color: Yellow, align: 'center' });
		ctx.drawImage(i.A11, cx - 66, b.y + 44, 36, 18);
		ctx.drawImage(i.A21, cx - 18, b.y + 44, 36, 18);
		ctx.drawImage(i.A31, cx + 30, b.y + 44, 36, 18);
		const lines = [['Waves of aliens', 'and bunkers'], ['Boss fights', 'every few waves'], ['Hard, with no', 'bunkers to hide']][d - 1];
		if (d == 2) ctx.drawImage(i.MMAlien1, cx + 34, b.y + 6, 34, 17);
		if (d == 3) {
			ctx.drawImage(i.Shield1, cx - 12, b.y + 66, 24, 24);
			ctx.strokeStyle = '#ff5252';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(cx - 14, b.y + 64); ctx.lineTo(cx + 14, b.y + 92);
			ctx.moveTo(cx + 14, b.y + 64); ctx.lineTo(cx - 14, b.y + 92);
			ctx.stroke();
		}
		lines.forEach((l, k) => text(ctx, l, cx, b.y + 102 + k * 16, { size: 12, family: ARIAL, color: '#ddd', align: 'center', bold: false }));
		if (this.difficulty == d) tick(ctx, b.x + b.w - 18, b.y + 18);
	}

	pointerMove(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		this.hover = b?.id ?? null;
		if (this.game == 2) return false;
		return !!b;
	}
	pointerDown(x: number, y: number) {
		if (this.game == 2) {
			this.keyPressed('Enter'); // game over: a click does what Enter does
			return;
		}
		const b = buttonAt(this.ui(), x, y);
		if (!b) return;
		if (b.id != 'clear') this.confirm.clear();
		b.onClick();
		this.hover = null;
		this.save();
	}

	private paintMenus(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		const img = this.img;
		const buttons = this.ui();
		const title = (s: string, y = 64) => text(ctx, s, 275, y, { size: 34, family: ARIAL_BLACK, color: Yellow, align: 'center' });

		if (this.game == 0) {
			g.img(img.SpaceMM, 0, 0, 550, 700);
			// The art's painted-on labels are blacked out; drawn buttons replace them.
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 335, 550, 292);
			// The alien cursor sits beside the button under the pointer.
			const b = buttons.find((x) => x.id == this.hover);
			if (b) {
				[this.rx, this.ry] = [b.x - 48, b.y + b.h / 2 - 9];
				this.cursor(g);
			}
		}

		if (this.game == 3) {
			title('HIGH SCORES', 76);
			const rows: [string, number][] = [
				['Games played', this.gp], ['High score', this.highscore], ['Highest wave', this.hwave], ['Total kills', this.kills], ['Bosses killed', this.bosses]
			];
			panel(ctx, 40, 116, 470, 290, { fill: 'rgba(255,221,15,0.06)', border: 'rgba(255,221,15,0.45)', radius: 6 });
			rows.forEach(([k, v], i) => {
				const y = 150 + i * 54;
				text(ctx, k.toUpperCase(), 68, y, { size: 17, family: ARIAL_BLACK, color: Yellow });
				text(ctx, '' + v, 482, y, { size: 22, family: ARIAL_BLACK, color: '#fff', align: 'right' });
				if (i < rows.length - 1) {
					ctx.fillStyle = 'rgba(255,221,15,0.15)';
					ctx.fillRect(64, y + 27, 422, 1);
				}
			});
			panel(ctx, 40, 426, 470, 150, { fill: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.2)', radius: 6 });
			text(ctx, 'GLOBAL RECORD · ' + ['', 'NORMAL', 'HARD', 'NO SHIELDS'][this.difficulty], 68, 456, { size: 14, family: ARIAL_BLACK, color: Yellow });
			drawRecord(g, {
				global: this.global, board: this.difficulty, local: this.highscore, loggedIn: this.loggedIn,
				x: 68, y: 488, family: ARIAL, color: '#fff', dim: 'rgb(200,190,120)', size: 16, rows: 3
			});
		}

		if (this.game == 4) {
			title('OPTIONS');
			text(ctx, 'CONTROLS', 25, 110, { size: 15, family: ARIAL_BLACK, color: '#fff' });
			text(ctx, 'DIFFICULTY', 25, 252, { size: 15, family: ARIAL_BLACK, color: '#fff' });
			text(ctx, 'SHIP', 25, 434, { size: 15, family: ARIAL_BLACK, color: '#fff' });
			// The other keys, for reference.
			const w1 = keyRow(ctx, ['Space'], 120, 594, KEY);
			text(ctx, 'shoot', 128 + w1, 609, { size: 14, family: ARIAL, color: '#ddd', bold: false });
			const w2 = keyRow(ctx, ['Enter'], 290, 594, KEY);
			text(ctx, 'pause', 298 + w2, 609, { size: 14, family: ARIAL, color: '#ddd', bold: false });
		}

		if (this.game == 8) {
			ctx.fillStyle = 'rgba(0,0,0,0.6)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			panel(ctx, 120, 200, 310, 240, { fill: 'rgba(10,10,20,0.95)', border: Yellow, width: 2, radius: 8 });
			text(ctx, 'PAUSED', 275, 248, { size: 34, family: ARIAL_BLACK, color: Yellow, align: 'center' });
			if (!touchScreen()) text(ctx, 'Enter to resume', 275, 466, { size: 14, family: ARIAL, color: 'rgba(255,255,255,0.7)', align: 'center', bold: false });
		}

		drawButtons(ctx, buttons, UI, this.hover);
	}

	// ── Keyboard ──
	keyPressed(code: string): boolean {
		const k = keyOf(code);
		if (!k) return false;
		// Menus are clicked or tapped. Paused, Enter (or Shift, the original pause key) resumes.
		if (this.game == 0 || this.game == 3 || this.game == 4 || this.game == 5 || this.game == 6 || this.game == 7) return true;
		if (this.game == 8) {
			if (k == 'ENTER' || k == 'SHIFT') this.press(0);
			return true;
		}
		const wasPaused = this.game == 8;
		const score = this.score;
		const before = { game: this.game, select: this.select, launch: this.launch };
		this.keyPressedJava(k);
		if (this.game == 1 && before.launch == 0 && this.launch == 1) this.sfx('laser');
		if (this.game != before.game && before.game != 1) this.sfx('confirm');
		else if (this.select != before.select && this.game != 1) this.sfx('select');
		// Leaving a run from the pause menu still counts its score.
		if (wasPaused && this.game == 0 && score > 0) this.onScore(this.difficulty, score);
		return true;
	}
	keyReleased(code: string): boolean {
		const k = keyOf(code);
		if (!k) return false;
		if (this.game == 1) {
			if (this.controls == 1 && (k == 'RIGHT' || k == 'LEFT')) this.ship.x_speed = 0;
			if (this.controls == 2 && (k == 'D' || k == 'A')) this.ship.x_speed = 0;
		}
		return true;
	}

	/** W/S move the menu cursor (the Java game used the up/down arrows). */
	private menuMove(k: Key, max: number) {
		if (k == 'UP') {
			this.select--;
			if (this.select < 0) this.select = 0;
		}
		if (k == 'DOWN') this.select++;
		if (this.select > max) this.select = max;
	}

	private keyPressedJava(k: Key) {
		const was = this.game; // (Enter that starts a game mustn't also pause it)
		// Main Menu
		if (this.game == 0) {
			this.menuMove(k, 3);
			if (k == 'ENTER') {
				if (this.select == 0) {
					this.game = 1;
					this.gp++;
					this.wave++;
				}
				if (this.select == 1) { this.game = 3; this.select = 0; this.startDelay = 1; }
				if (this.select == 2) { this.game = 4; this.select = 0; this.startDelay = 1; }
				if (this.select == 3) {
					this.save();
					this.onQuit();
				}
			}
		}
		// Highscores
		if (this.game == 3) {
			this.menuMove(k, 1);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 0; this.delay2 = 0; this.startDelay = 0; }
				if (this.select == 1) this.clearHS();
			}
		}
		// Options
		if (this.game == 4) {
			this.menuMove(k, 3);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 0; this.delay2 = 0; this.startDelay = 0; }
				if (this.select == 1) { this.game = 5; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
				if (this.select == 2) { this.game = 6; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
				if (this.select == 3) { this.game = 7; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
			}
		}
		// Controls
		if (this.game == 5) {
			this.menuMove(k, 2);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 4; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
				if (this.select == 1) this.controls = 2;
				if (this.select == 2) this.controls = 1;
			}
		}
		// Difficulty
		if (this.game == 6) {
			this.menuMove(k, 3);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 4; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
				if (this.select >= 1) {
					this.difficulty = this.select; // 1 Normal, 2 Hard, 3 No Shields
					this.shieldsDown = this.difficulty == 3 ? 1 : 0;
				}
			}
		}
		// Character Select
		if (this.game == 7) {
			this.menuMove(k, 2);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 4; this.select = 0; this.delay2 = 0; this.startDelay = 1; }
				if (this.select == 1) this.character = 1;
				if (this.unlock == 1 && this.select == 2) this.character = 2;
			}
		}
		// GAME
		if (this.game == 1) {
			if (this.controls == 1) {
				if (k == 'RIGHT') this.ship.x_speed = 2;
				if (k == 'LEFT') this.ship.x_speed = -2;
			}
			if (this.controls == 2) {
				if (k == 'D') this.ship.x_speed = 2;
				if (k == 'A') this.ship.x_speed = -2;
			}
			if (k == 'SPACE') {
				this.missile.y_speed = -8;
				this.launch = 1;
			}
			// Pause: Enter (as in the other games) or Shift (the original's key).
			if (k == 'SHIFT' || (k == 'ENTER' && was == 1)) {
				this.game = 8;
				this.delay2 = 0;
				this.startDelay = 1;
			}
		}
		if (this.game == 2 && k == 'ENTER') {
			this.game = 0;
			this.resetGame();
		}
		// Game Paused
		if (this.game == 8) {
			this.menuMove(k, 1);
			if (this.delay2 > 5 && k == 'ENTER') {
				if (this.select == 0) { this.game = 1; this.delay2 = 0; this.startDelay = 0; }
				if (this.select == 1) { this.game = 0; this.select = 0; this.delay2 = 0; this.startDelay = 0; this.resetGame(); }
			}
		}
		this.save();
	}

	// ── Game loop (run) ──
	tick() {
		const before = this.game;
		const shot = () => this.aliens.filter((a) => a.shot == 1).length;
		const launched = () => this.aMissiles.filter((m) => m.launchA == 1).length + this.bMissiles.filter((m) => m.launchA == 1).length;
		const was = {
			shot: shot(), launched: launched(), ufo: this.mothership.shot, lives: this.ship.lives, boss: this.boss.health,
			bossShot: this.boss.shot, turn: this.aTurn, wave: this.wave
		};
		this.run();
		// Sounds, from what this step changed.
		if (this.game == 1) {
			if (shot() > was.shot) this.sfx('alienDie');
			if (this.mothership.shot == 1 && was.ufo == 0) this.sfx('ufoDie');
			if (this.ship.lives < was.lives) this.sfx('playerDie');
			if (this.boss.shot == 1 && was.bossShot == 0) this.sfx('bossDie');
			else if (this.boss.health < was.boss) this.sfx('bossHit');
			if (launched() > was.launched) this.sfx('alienShot');
			if (this.wave > was.wave) this.sfx('wave');
			// The invaders' marching beat, one of four low notes each time they shuffle.
			if (this.aTurn != was.turn) this.sfx('step' + (this.stepSound++ % 4));
			// The mothership hums while it crosses the screen.
			const m = this.mothership;
			if (m.shot == 0 && m.x > -40 && m.x < 550 && ++this.ticks % 18 == 0) this.sfx('ufo');
		}
		if (before != 2 && this.game == 2) this.sfx('lose');
		if (before != 2 && this.game == 2) {
			this.onScore(this.difficulty, this.score);
			this.save();
		}
	}

	private run() {
		const { ship, missile, mothership, boss } = this;
		if (this.startDelay == 1) this.delay2++;
		// Animations
		if (this.game >= 0) {
			this.delay++;
			if (this.delay == 30) {
				this.aTurn = this.aTurn == 0 ? 1 : 0;
				this.delay = 0;
			}
		}
		// GAME
		if (this.game == 1) {
			ship.moveS();
			missile.moveM();
			mothership.moveA();
			if (this.bossLvl == 0) mothership.checkBoundaryA();
			this.checkHits();
			this.gotHit();
			this.timer();
			this.timer2();
			ship.checkBoundaryS();
			this.missileMechanics();
			for (const a of this.aliens) a.moveA();
			this.aliensMechanics();
			this.aMissileMechanics();
			this.aMissileLaunch();
			for (const m of this.aMissiles) m.moveAM();
			for (const s of this.shields) {
				s.boundaryS.x = s.x;
				s.boundaryS.y = s.y;
			}
			if (this.shieldsDown == 0) this.shieldsHit();
			if (this.difficulty == 1) {
				if (this.aCounter == 45) {
					this.aCounter = 0;
					this.wave++;
					this.newWave();
				}
			}
			if (this.difficulty >= 2) {
				if (this.aCounter == 45) {
					this.wave++;
					this.aCounter = 0;
					if (this.wave != this.bossWave) this.newWave();
				}
				if (this.wave == this.bossWave) {
					this.bossLvl = 1;
					boss.y_speed = 2;
					boss.moveB();
					this.checkHitsB();
					boss.checkBoundaryB();
				}
				if (boss.battle == 1) {
					for (const m of this.bMissiles) m.moveAM();
					this.gotHitB();
					this.bMissileLaunch();
					this.bMissileMechanics();
					this.bossMechanics();
				}
			}
		}
		// GAME OVER
		if (this.game == 2) {
			this.goy_speed = 10;
			this.goy += this.goy_speed;
			if (this.goy > 330) this.goy = 330;
			missile.moveM();
			for (const m of this.aMissiles) m.moveAM();
			this.aliensMechanics();
			if (boss.battle == 0) {
				mothership.moveA();
				mothership.checkBoundaryA();
			}
			if (boss.battle == 1) {
				for (const m of this.bMissiles) m.moveAM();
				this.gotHitB();
				this.bMissileLaunch();
				this.bMissileMechanics();
			}
		}
		this.HS();
	}

	private missileMechanics() {
		const previousX = this.missile.x;
		this.missile.x = this.ship.x + 23;
		if (this.launch == 1) this.missile.x = previousX;
		if (this.missile.y < 0) this.missileReturn();
	}

	private aMissileMechanics() {
		for (const m of this.aMissiles) {
			const previousAX = m.x;
			m.x = this.aliens[this.random].x + 20;
			if (m.launchA == 0) m.y = this.aliens[this.random].y;
			if (m.launchA == 1) m.x = previousAX;
		}
	}

	private aMissileLaunch() {
		this.counter++;
		if (this.counter == 30) {
			this.random = rnd(45);
			this.aMissiles[this.random].y_speed = 8;
			this.aMissiles[this.random].launchA = 1;
			this.aMissiles.forEach((m, i) => {
				if (m.y > 700) {
					m.launchA = 0;
					m.y_speed = 0;
					m.y = this.aliens[i].y;
					m.x = this.aliens[i].x + 20;
				}
			});
			this.counter = 0;
		}
	}

	private bMissileMechanics() {
		for (const m of this.bMissiles) {
			const previousAX = m.x;
			m.x = this.randomx;
			if (m.launchA == 0) m.y = 150;
			if (m.launchA == 1) m.x = previousAX;
		}
	}

	private bMissileLaunch() {
		this.counter2++;
		if (this.counter2 == 30) {
			this.random2 = rnd(45);
			this.bMissiles[this.random2].y_speed = 8;
			this.bMissiles[this.random2].launchA = 1;
			for (const m of this.bMissiles) {
				if (m.y > 700) {
					m.launchA = 0;
					m.y_speed = 0;
					m.y = 150;
					this.randomx = rnd(400) + this.boss.x;
					m.x = this.randomx;
				}
			}
			this.counter2 = 0;
		}
	}

	private bossMechanics() {
		const { boss, ship } = this;
		boss.boundaryB.x = boss.x;
		if (ship.x < boss.x) boss.x_speed = -1;
		else if (ship.x + ship.sizeW > boss.x + boss.sizeW) boss.x_speed = 1;
		else boss.x_speed = 0;
		if (boss.x > 150) boss.x = 150;
		if (boss.x < 0) boss.x = 0;
	}

	private aliensMechanics() {
		const speed = () => (this.wave < 5 ? 2 : this.wave < 10 ? 3 : 4);
		for (const al of this.aliens) {
			if (al.boundaryA.intersects(this.LeftBound) && this.check == 1) {
				for (const a of this.aliens) {
					a.x_speed = speed();
					a.y += 5;
					this.check = 2;
				}
			}
			if (al.boundaryA.intersects(this.RightBound) && this.check == 2) {
				for (const a of this.aliens) {
					a.x_speed = -speed();
					a.y += 5;
					this.check = 1;
				}
			}
			if (al.boundaryA.intersects(this.ShipBound)) {
				this.game = 2;
				this.ship.shot = 1;
			}
		}
	}

	private checkHits() {
		for (let i = 0; i < this.numAliens; i++) {
			if (this.missile.boundaryM.intersects(this.aliens[i].boundaryA)) {
				this.aliens[i].shot = 1;
				this.trigger = 1;
				this.missileReturn();
				this.aCounter++;
				this.score += i < 9 ? 50 : i < 27 ? 20 : 10;
				this.lastShot = i;
			}
		}
		if (this.missile.boundaryM.intersects(this.mothership.boundaryA)) {
			this.mothership.shot = 1;
			this.trigger3 = 1;
			this.missileReturn();
			this.score += 250;
			this.mothership.x_speed = 0;
		}
	}

	private checkHitsB() {
		const { boss, ship } = this;
		if (boss.battle == 1 && this.missile.boundaryM.intersects(boss.boundaryB)) {
			this.score += 10; // each hit (beating the boss adds 1000)
			this.missileReturn();
			boss.health--;
			this.healthw -= 8;
			if (boss.health == 0) {
				if (ship.lives < 3) {
					ship.lives++;
					this.livesCount++;
				}
				this.aCounter = 45;
				boss.battle = 0;
				this.bossLvl = 0;
				boss.y_speed = 0;
				this.bossWave += 3;
				this.trigger4 = 1;
				this.score += 1000;
				boss.shot = 1;
				this.bosses++;
				this.unlock = 1;
			}
		}
	}

	private timer() {
		if (this.trigger == 1) {
			this.deathTimer++;
			if (this.deathTimer == 20) {
				this.aliens[this.lastShot].deadA();
				this.deathTimer = 0;
				this.trigger = 0;
				this.kills++;
			}
		}
		if (this.trigger3 == 1) {
			this.deathTimer++;
			if (this.deathTimer == 20) {
				this.mothership.deadA();
				this.deathTimer = 0;
				this.trigger3 = 0;
				this.kills++;
				this.mothership.shot = 0;
			}
		}
		if (this.trigger4 == 1) {
			this.deathTimer++;
			if (this.deathTimer == 10) {
				this.boss.deadB();
				this.deathTimer = 0;
				this.trigger4 = 0;
				this.healthw = 400;
				this.kills++;
				this.boss.shot = 0;
			}
		}
	}

	private shipHit() {
		this.trigger2 = 1;
		this.ship.lives--;
		this.livesCount--;
		this.ship.shot = 1;
		if (this.ship.lives == 0) this.game = 2;
	}

	private gotHit() {
		this.aMissiles.forEach((m, i) => {
			if (m.boundaryAM.intersects(this.ship.boundaryS)) {
				m.y = this.aliens[i].y;
				m.x = this.aliens[i].x + 20;
				m.launchA = 0;
				m.y_speed = 0;
				this.shipHit();
			}
		});
	}

	private gotHitB() {
		for (const m of this.bMissiles) {
			if (m.boundaryAM.intersects(this.ship.boundaryS)) {
				m.y = 150;
				this.randomx = rnd(400) + this.boss.x;
				m.x = this.randomx;
				m.launchA = 0;
				m.y_speed = 0;
				this.shipHit();
			}
		}
	}

	private timer2() {
		if (this.trigger2 == 1) {
			this.deathTimer2++;
			if (this.deathTimer2 == 20) {
				this.ship.x = 250;
				this.deathTimer2 = 0;
				this.trigger2 = 0;
				this.ship.shot = 0;
			}
		}
	}

	private missileReturn() {
		this.launch = 0;
		this.missile.x = this.ship.x + 25;
		this.missile.checkBoundaryM();
	}

	private shieldsHit() {
		const hitShield = (s: Shields) => {
			s.lives--;
			if (s.lives == 0) s.y = 750;
		};
		for (const s of this.shields) {
			if (this.missile.boundaryM.intersects(s.boundaryS)) {
				this.missileReturn();
				hitShield(s);
			}
		}
		for (const s of this.shields) {
			this.aMissiles.forEach((m, a) => {
				if (m.boundaryAM.intersects(s.boundaryS)) {
					m.y = this.aliens[a].y;
					m.x = this.aliens[a].x + 20;
					m.launchA = 0;
					m.y_speed = 0;
					hitShield(s);
				}
			});
		}
		for (const s of this.shields) {
			for (const a of this.aliens) if (a.boundaryA.intersects(s.boundaryS)) hitShield(s);
		}
		for (const s of this.shields) {
			for (const m of this.bMissiles) {
				if (m.boundaryAM.intersects(s.boundaryS)) {
					m.y = 150;
					this.randomx = rnd(400) + this.boss.x;
					m.x = this.randomx;
					m.launchA = 0;
					m.y_speed = 0;
					hitShield(s);
				}
			}
		}
	}

	/** Line the aliens up again (top row at y0). */
	private formAliens(y0: number) {
		let startx = 0, starty = 0;
		this.checkA = 8;
		for (const a of this.aliens) {
			a.y = y0;
			a.x = 10;
		}
		this.aliens.forEach((a, i) => {
			a.y += starty;
			a.x += startx;
			startx += 50;
			if (i == this.checkA) {
				startx = 0;
				starty += 30;
				this.checkA += 9;
			}
			a.boundaryA.y = a.y;
			a.shot = 0;
		});
		for (const m of this.aMissiles) {
			this.random = rnd(45);
			m.x = this.aliens[this.random].x + 20;
			m.y = this.aliens[this.random].y;
		}
	}

	private newWave() {
		this.trigger = 0;
		this.trigger2 = 0;
		this.formAliens(this.wave < 5 ? 50 : this.wave < 10 ? 100 : 150);
		if (this.ship.lives < 3) {
			this.ship.lives++;
			this.livesCount++;
		}
		this.ship.shot = 0;
	}

	private resetGame() {
		const { ship, boss } = this;
		this.trigger = 0;
		this.trigger2 = 0;
		this.placeShields();
		this.formAliens(50);
		this.aCounter = 0;
		ship.lives = 3; ship.x = 250; ship.x_speed = 0;
		this.goy = -100; this.score = 0; this.livesCount = 3; this.wave = 0; ship.shot = 0;
		this.mothership.x = -300;
		this.bossWave = 2; this.healthw = 400;
		boss.health = 50; boss.battle = 0; this.bossLvl = 0; boss.y = -250; boss.x_speed = 0; boss.x = 75;
	}

	private HS() {
		if (this.highscore < this.score) this.highscore = this.score;
		if (this.hwave < this.wave) this.hwave = this.wave;
	}

	private clearHS() {
		this.highscore = 0; this.hwave = 0; this.kills = 0; this.gp = 0; this.bosses = 0; this.hsx = 450;
	}

	// ── Drawing (paintComponent) ──
	private cursor(g: Gfx) {
		g.img(this.aTurn == 0 ? this.img.MMAlien1 : this.img.MMAlien2, this.rx, this.ry, 33, 17);
	}
	private at(points: [number, number][]) {
		const p = points[this.select];
		if (p) [this.rx, this.ry] = p;
	}

	paint(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		const { img, ship, missile, mothership, boss } = this;
		g.begin(ctx);
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		// GAME GRAPHICS
		if (this.game == 1 || this.game == 2 || this.game == 8) {
			g.setColor('#000');
			g.fillRect(0, 0, 550, 700);
			// Shields
			if (this.shieldsDown == 0) {
				this.shields.forEach((s, i) => {
					if (s.lives > 0) ctx.drawImage(shieldSprite(i, s.lives), s.x, s.y, s.sizeW, s.sizeH);
				});
			}
			// Ship
			g.setColor('rgb(0,255,0)');
			if (ship.shot == 0) {
				g.fillRect(missile.x, missile.y, missile.sizeW, missile.sizeH);
				g.img(this.character == 2 ? img.Mooneyship : img.SShip, ship.x, ship.y, ship.sizeW, ship.sizeH);
			}
			if (ship.shot == 1) g.img(img.ShipShot, ship.x, ship.y, ship.sizeW, ship.sizeH);
			g.setColor('rgb(255,0,0)');
			for (const m of this.aMissiles) g.fillRect(m.x, m.y, m.sizeW, m.sizeH);
			// Aliens
			this.aliens.forEach((a, i) => {
				if (a.shot != 0) return;
				const row = i < 9 ? [img.A31, img.A32] : i < 27 ? [img.A21, img.A22] : [img.A11, img.A12];
				g.img(row[this.aTurn], a.x, a.y, a.sizeW, a.sizeH);
			});
			for (const a of this.aliens) if (a.shot == 1) g.img(img.AlienShot, a.x, a.y, a.sizeW, a.sizeH);
			g.img(mothership.shot == 0 ? img.MShip : img.AlienShot, mothership.x, mothership.y, mothership.sizeW, mothership.sizeH);
			// Boss
			if (boss.battle == 1) {
				g.setColor('rgb(128,128,128)');
				g.fillRect(75, 10, 400, 8);
				g.setColor('rgb(255,0,0)');
				g.fillRect(75, 10, this.healthw, 8);
				g.setColor('#fff');
				g.font(15, ARIAL_BLACK);
				g.drawString('Boss', 250, 35);
				g.setColor('rgb(255,0,0)');
				for (const m of this.bMissiles) g.fillRect(m.x, m.y, m.sizeW, m.sizeH);
			}
			if (boss.shot == 0) g.img(this.aTurn == 0 ? img.MMAlien1 : img.MMAlien2, boss.x, boss.y, boss.sizeW, boss.sizeH);
			if (boss.shot == 1) g.img(img.AlienShot, boss.x, boss.y, boss.sizeW, boss.sizeH);
			// Texts
			g.setColor('#fff');
			g.font(20, ARIAL_BLACK);
			g.drawString('Score: ' + this.score, 10, 650);
			g.drawString('Lives: ', 350, 650);
			for (let i = 0; i < this.livesCount; i++) {
				g.img(this.character == 2 ? img.Mooneyship : img.SShip, this.lives[i], 640, 25, 10);
			}
			g.font(15, ARIAL_BLACK);
			g.setColor(Yellow);
			g.drawString('Wave', 230, 640);
			g.drawString('' + this.wave, 250, 660);
		}

		// GAME OVER: the title drops in (as before), centred, then the score and how to go on.
		if (this.game == 2) {
			drawGameOver(ctx, {
				width: GAME_W, height: GAME_H, y: this.goy, landed: this.goy >= 330, color: 'rgb(255,60,60)',
				lines: [`SCORE ${this.score}`, `WAVE ${this.wave}`, touchScreen() ? 'TAP TO RETURN TO THE MENU' : 'PRESS ENTER FOR THE MENU']
			});
		}

		// Menus (and the pause screen, over the frozen game).
		if (this.game == 0 || this.game == 3 || this.game == 4 || this.game == 8) this.paintMenus(ctx);
	}
}
