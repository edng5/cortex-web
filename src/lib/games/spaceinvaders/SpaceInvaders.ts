// Space Invaders (SpaceInvaders.java and its classes), ported to TypeScript. The Java logic is kept
// as written, quirks included. Changes: menus also work with the mouse (hover + click), W/S
// replace the arrow keys in menus, the default ship controls are A/D ("Lefty" in Options), and
// No Shields (the original's "Shields Down" switch) is a third difficulty: Hard's waves and
// bosses without bunkers, so each difficulty has its own leaderboard.
import { Rect } from '../topgun/geometry';
import { ARIAL, ARIAL_BLACK, COMIC, Gfx, drawRecord, loadImages, loadSave, spotAt, writeSave, type ArcadeGame, type Board, type Hotspot } from '../common';

export const GAME_W = 550;
export const GAME_H = 664;
export const TICK_MS = 15;

const BASE = '/games/spaceinvaders/';
const IMAGES = {
	SpaceMM: 'SpaceMM.jpg', A11: 'A11.png', A12: 'A12.png', A21: 'A21.png', A22: 'A22.png', A31: 'A31.png', A32: 'A32.png',
	SShip: 'SShip.png', MShip: 'MShip.png', Mooneyship: 'Mooneyship.png', AlienShot: 'AlienShot.png', ShipShot: 'ShipShot.png',
	MMAlien1: 'MMAlien1.png', MMAlien2: 'MMAlien2.png', SpaceHS: 'SpaceHS.jpg', SpaceOption0: 'SpaceOption0.jpg',
	SpaceOption1: 'SpaceOption1.jpg', SpaceOption2: 'SpaceOption2.jpg', SpaceOption3: 'SpaceOption3.jpg',
	Shield1: 'Shield1.png', Shield2: 'Shield2.png', Shield3: 'Shield3.png', LCorner: 'LCorner.png', RCorner: 'RCorner.png',
	Locked: 'Locked.png', SpacePaused: 'SpacePaused.png'
};
type Images = Record<keyof typeof IMAGES, HTMLImageElement>;
export const loadAssets = () => loadImages(BASE, IMAGES);

const SAVE_KEY = 'spaceinvaders-save';
const rnd = (n: number) => Math.floor(Math.random() * n);
const Yellow = 'rgb(255,221,15)';

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
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();

	constructor(private img: Images) {
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

	// ── Mouse: every menu item can be hovered (moves the alien cursor) and clicked ──
	private spots(): Hotspot[] {
		const item = (x: number, y: number, w: number, h: number, sel: number): Hotspot => ({
			x, y, w, h,
			hover: () => (this.select = sel),
			click: () => {
				this.select = sel;
				this.keyPressed('Enter');
			}
		});
		const back = item(8, 6, 100, 36, 0);
		switch (this.game) {
			case 0: return [item(140, 350, 270, 50, 0), item(115, 422, 320, 50, 1), item(165, 497, 220, 48, 2), item(140, 570, 270, 50, 3)];
			case 3: return [back, item(420, 620, 115, 36, 1)];
			case 4: return [back, item(140, 285, 265, 72, 1), item(140, 392, 265, 64, 2), item(60, 497, 450, 70, 3)];
			case 5: return [back, item(62, 180, 176, 135, 1), item(325, 180, 145, 135, 2)];
			case 6: return [back, item(115, 167, 310, 126, 1), item(113, 330, 315, 126, 2), item(115, 499, 317, 129, 3)];
			case 7: return [back, item(68, 254, 416, 166, 1), item(68, 462, 416, 168, 2)];
			case 8: return [item(140, 328, 245, 36, 0), item(140, 372, 245, 40, 1)];
			case 2: return [{ x: 0, y: 0, w: GAME_W, h: GAME_H, click: () => this.keyPressed('Enter') }];
		}
		return [];
	}
	pointerMove(x: number, y: number) {
		const s = spotAt(this.spots(), x, y);
		s?.hover?.();
		return !!s && this.game != 2;
	}
	pointerDown(x: number, y: number) {
		spotAt(this.spots(), x, y)?.click();
	}

	// ── Keyboard ──
	keyPressed(code: string): boolean {
		const k = keyOf(code);
		if (!k) return false;
		const wasPaused = this.game == 8;
		const score = this.score;
		this.keyPressedJava(k);
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
			if (k == 'SHIFT') {
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
		this.run();
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
			this.score += 5;
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

		// Main Menu
		if (this.game == 0) {
			g.img(img.SpaceMM, 0, 0, 550, 700);
			this.at([[100, 370], [70, 440], [120, 515], [100, 590]]);
			this.cursor(g);
		}

		// GAME GRAPHICS
		if (this.game == 1 || this.game == 2 || this.game == 8) {
			g.setColor('#000');
			g.fillRect(0, 0, 550, 700);
			// Shields
			if (this.shieldsDown == 0) {
				for (const s of this.shields) {
					if (s.lives == 3) g.img(img.Shield3, s.x, s.y, s.sizeW, s.sizeH);
					if (s.lives == 2) g.img(img.Shield2, s.x, s.y, s.sizeW, s.sizeH);
					if (s.lives == 1) g.img(img.Shield1, s.x, s.y, s.sizeW, s.sizeH);
				}
				for (let i = 0; i < 9; i++) {
					const s = this.shields[i];
					if (i == 0 || i == 3 || i == 6) g.img(img.LCorner, s.x, s.y, s.sizeW, s.sizeH);
					if (i == 2 || i == 5 || i == 8) g.img(img.RCorner, s.x, s.y, s.sizeW, s.sizeH);
				}
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

		// GAME OVER
		if (this.game == 2) {
			g.setColor('rgb(255,0,0)');
			g.font(50, ARIAL_BLACK);
			g.drawString('Game Over!', 100, this.goy);
			g.font(20, ARIAL_BLACK);
			g.drawString('Press Enter to Return to the Main Menu', 40, 380);
		}

		// Highscores
		if (this.game == 3) {
			g.img(img.SpaceHS, 0, 0, 550, 700);
			this.at([[105, 18], [380, 630]]);
			this.cursor(g);
			g.setColor(Yellow);
			g.font(30, COMIC);
			if (this.highscore > 9999) this.hsx = 425;
			g.drawString('' + this.gp, 450, 305);
			g.drawString('' + this.highscore, this.hsx, 365);
			g.drawString('' + this.hwave, 450, 425);
			g.drawString('' + this.kills, 450, 485);
			g.drawString('' + this.bosses, 450, 545);
			// Global board, between the title and the stats.
			g.setColor(Yellow);
			g.font(14, ARIAL_BLACK);
			g.drawString('GLOBAL RECORD · ' + ['', 'NORMAL', 'HARD', 'NO SHIELDS'][this.difficulty], 52, 208);
			drawRecord(g, {
				global: this.global,
				board: this.difficulty,
				local: this.highscore,
				loggedIn: this.loggedIn,
				x: 52,
				y: 230,
				family: ARIAL,
				color: '#fff',
				dim: 'rgb(200,190,120)',
				size: 16
			});
		}

		// Options Menu
		if (this.game == 4) {
			g.img(img.SpaceOption0, 0, 0, 550, 700);
			this.at([[105, 18], [90, 315], [90, 415], [20, 520]]);
			this.cursor(g);
		}
		g.setColor(Yellow);
		// Controls Menu
		if (this.game == 5) {
			g.img(img.SpaceOption1, 0, 0, 550, 700);
			this.at([[105, 18], [20, 200], [250, 200]]);
			this.cursor(g);
			g.setColor(Yellow);
			if (this.controls == 1) g.fillRect(330, 215, 100, 3);
			if (this.controls == 2) g.fillRect(100, 215, 100, 3);
		}
		// Difficulty Menu
		if (this.game == 6) {
			g.img(img.SpaceOption2, 0, 0, 550, 700);
			this.at([[105, 18], [60, 180], [60, 350], [60, 520]]);
			this.cursor(g);
			g.setColor(Yellow);
			if (this.difficulty == 1) g.fillRect(130, 205, 120, 3);
			if (this.difficulty == 2) g.fillRect(130, 370, 80, 3);
			if (this.difficulty == 3) g.fillRect(186, 580, 174, 3);
		}
		// Character Select Menu
		if (this.game == 7) {
			g.img(img.SpaceOption3, 0, 0, 550, 700);
			this.at([[105, 18], [30, 270], [30, 480]]);
			this.cursor(g);
			g.setColor(Yellow);
			if (this.character == 1) g.fillRect(150, 300, 220, 3);
			if (this.character == 2) g.fillRect(145, 510, 250, 3);
			if (this.unlock == 0) g.img(img.Locked, 95, 477, 367, 137);
		}
		// Pause Screen
		if (this.game == 8) {
			g.img(img.SpacePaused, 0, 0, 550, 700);
			this.at([[165, 338], [150, 385]]);
			this.cursor(g);
		}
	}
}
