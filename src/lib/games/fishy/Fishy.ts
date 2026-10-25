// Fishy (Fishy.java), ported to TypeScript. The game, its menus (clicked, as in the original) and
// its numbers are Edward's; the changes:
//  - Collisions are pixel-perfect: two fish only touch where both sprites have solid pixels, not
//    wherever their bounding boxes overlap (the Java version compared corner points of boxes).
//    And a bigger fish only eats you if you run into its mouth (the front), not its body or tail.
//  - Single player moves with WASD (the original used the arrow keys); in multiplayer, player 1
//    has WASD and player 2 the arrow keys, as before.
//  - A moment of safety after losing a life, so you can't be eaten again where you respawn.
import { COMIC, Gfx, Mask, drawRecord, loadImages, loadSave, pixelsTouch, writeSave, type ArcadeGame, type Board, type Sprite } from '../common';

export const GAME_W = 900;
export const GAME_H = 662;
export const TICK_MS = 10;

const BASE = '/games/fishy/';
const IMAGES = {
	Mainmenu: 'TitleScreen.jpg', Highscore: 'Highscore.jpg', Records: 'Records.jpg', Difficulty: 'Difficulty.jpg',
	Characters: 'Characters.jpg', Background1: 'Background1.png', FishyR: 'FishyCharR.png', FishyL: 'FishyCharL.png',
	FishyUp: 'FishyCharUp.png', EnemyFishR: 'EnemyFishR.png', EnemyFishL: 'EnemyFishL.png', SharkCharR: 'SharkCharR.png',
	SharkCharL: 'SharkCharL.png', SharkCharUp: 'SharkCharUp.png', MooneyFishR: 'MooneyFishR.png', MooneyFishL: 'MooneyFishL.png',
	MooneyFishUp: 'MooneyFishUp.png', GameOver: 'GameOver.jpg', WinScreen: 'WinScreen.jpg', HowToPlay1: 'HowToPlay1.jpg',
	HowToPlay2: 'HowToPlay2.jpg', EnemySharkR: 'SharkR.png', EnemySharkL: 'SharkL.png', TheHook: 'TheHook.png',
	UnlockShark: 'UnlockS.png', UnlockMooney: 'UnlockM.png', SelectedChar: 'SelectedChar.png', livesCount: 'livesCount.png',
	P1: 'P1.png', P2: 'P2.png', Fishy2R: 'FishyChar2R.png', Fishy2L: 'FishyChar2L.png', P1Win: 'P1Win.jpg', P2Win: 'P2Win.jpg',
	HSMulti: 'HSMulti.jpg'
};
type ImageName = keyof typeof IMAGES;
type Images = Record<ImageName, HTMLImageElement>;
export const loadAssets = () => loadImages(BASE, IMAGES);

const SAVE_KEY = 'fishy-save';
const rnd = (n: number) => Math.floor(Math.random() * n);
const SPRITES = [
	'FishyR', 'FishyL', 'SharkCharR', 'SharkCharL', 'MooneyFishR', 'MooneyFishL', 'Fishy2R', 'Fishy2L',
	'EnemyFishR', 'EnemyFishL', 'EnemySharkR', 'EnemySharkL', 'TheHook'
] as const;
type SpriteName = (typeof SPRITES)[number];
/** Ticks of safety after a respawn (0.8 s). */
const SAFE_TICKS = 80;

export class Fishy implements ArcadeGame {
	// ── Fields (as in Fishy.java; its four identical copies of each fish are one fish here) ──
	dx = 0; dy = 0; dx2 = 1; goY = -100; deltagoY = 0; sharkdx = 2; hookdy = 3; hookFlag = 0;
	game = 0; difficulty = 1;
	direction = 1;
	lives = 1; speed = 1; score = 0; scorecap = 9000; character = 1; hooked = 0;
	whichEnemy = 0;
	direction2 = 2; mdx = 0; mdy = 0; whoWon = 0;
	gp = 0; Tsa = 0; sa = 0; Tfa = 0; fa = 0; ehs = 0; mhs = 0; hhs = 0; fishAte = 0; sharkAte = 0; dbh = 0; p1s = 0; p2s = 0;
	unlockS = 0; unlockM = 0;

	// Enemy fish
	enemiesxR = [0, -100, -300, -275];
	enemiesy1 = [100, 300, 400, 600];
	enemiesw = [150, 42, 300, 210];
	enemiesh = [50, 14, 100, 70];
	enemiesxL = [1000, 1300, 930, 900];
	enemiesy2 = [50, 480, 200, 500];
	enemiesw2 = [150, 42, 30, 210];
	enemiesh2 = [50, 14, 10, 70];
	// Character
	x = 370; y = 250; fishw = 60; fishh = 20;
	livesX = [100, 140, 180, 220];
	// Sharks
	sharkxR = [0, -100];
	sharky1 = [100, 550];
	sharkw = [150, 210];
	sharkh = [50, 70];
	sharkxL = [1000, 1300];
	sharky2 = [140, 480];
	sharkw2 = [321, 420];
	sharkh2 = [107, 130];
	hookX = [210, 840];
	hookY = [-400, -400];
	// Player 1 and 2 fish (multiplayer)
	x2 = 250; y2 = 250; fishw2 = 60; fishh2 = 20;
	x3 = 650; y3 = 250; fishw3 = 60; fishh3 = 20;

	safe = 0;

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	/** Sound effects (set by the host). */
	sfx: (name: string) => void = () => {};
	/** Soundtrack: menus, one per difficulty in single player, and one for 2P local. */
	musicTrack() {
		if ([0, 3, 4, 5, 6, 9, 12, 13].includes(this.game)) return 'fishy-menu';
		if (this.game == 1) return 'fishy-' + this.difficulty;
		if (this.game == 2) return 'fishy-2p';
		return null;
	}
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();
	private masks: Record<SpriteName, Mask>;
	private readonly initial: Record<string, number | number[]>;

	constructor(private img: Images) {
		// Snapshot of the starting positions, for "Press Enter to Play Again" (the Java reset tables).
		this.initial = {};
		for (const k of RESET_FIELDS) {
			const v = this[k];
			this.initial[k] = Array.isArray(v) ? [...v] : v;
		}
		Object.assign(
			this,
			loadSave(SAVE_KEY, {
				gp: 0, Tsa: 0, sa: 0, Tfa: 0, fa: 0, ehs: 0, mhs: 0, hhs: 0, dbh: 0, p1s: 0, p2s: 0,
				unlockS: 0, unlockM: 0, character: 1, difficulty: 1
			})
		);
		if ((this.character == 2 && this.unlockS != 1) || (this.character == 3 && this.unlockM != 1)) this.character = 1;
		this.lives = this.character;
		this.speed = this.character;
		this.masks = Object.fromEntries(SPRITES.map((n) => [n, new Mask(img[n])])) as Record<SpriteName, Mask>;
	}

	save() {
		const { gp, Tsa, sa, Tfa, fa, ehs, mhs, hhs, dbh, p1s, p2s, unlockS, unlockM, character, difficulty } = this;
		writeSave(SAVE_KEY, { gp, Tsa, sa, Tfa, fa, ehs, mhs, hhs, dbh, p1s, p2s, unlockS, unlockM, character, difficulty });
	}

	leave() {
		// Single player mid-game: the high score is already kept live; send it to the board too.
		if (this.game == 1 && this.score > 0) this.onScore(this.difficulty, this.score);
		this.save();
	}

	// ── Mouse: the original menus. Java measured clicks on the window, so add its insets. ──
	pointerDown(px: number, py: number) {
		if (this.game == 7 || this.game == 8 || this.game == 10 || this.game == 11) {
			this.keyPressed('Enter'); // "Press Enter to Play Again": a click works too
			return;
		}
		const before = { game: this.game, difficulty: this.difficulty, character: this.character };
		this.mousePressed(px + 8, py + 31);
		if (this.game != before.game || this.difficulty != before.difficulty || this.character != before.character) this.sfx('confirm');
		this.save();
	}
	pointerMove(px: number, py: number) {
		if (this.game == 7 || this.game == 8 || this.game == 10 || this.game == 11) return false;
		const mx = px + 8, my = py + 31;
		const inR = (x0: number, x1: number, y0: number, y1: number) => mx >= x0 && mx <= x1 && my >= y0 && my < y1;
		const back = inR(10, 110, 40, 100), next = inR(810, 860, 40, 110);
		switch (this.game) {
			case 0:
				return (
					(mx >= 380 && mx <= 520 && [[200, 230], [260, 300], [330, 360], [400, 425], [470, 500]].some(([a, b]) => my >= a && my < b)) || next
				);
			case 3: case 4: case 5: case 12: return back || next;
			case 9: case 13: return back;
			case 6:
				return (
					back ||
					(mx >= 200 && mx <= 800 && (inR(200, 800, 290, 320) || (inR(200, 800, 430, 460) && this.unlockS == 1) || (inR(200, 800, 575, 605) && this.unlockM == 1)))
				);
		}
		return false;
	}

	private mousePressed(mouseX: number, mouseY: number) {
		const inR = (x0: number, x1: number, y0: number, y1: number) => mouseX >= x0 && mouseX <= x1 && mouseY >= y0 && mouseY < y1;
		if (this.game == 0) {
			if (inR(380, 520, 200, 230)) this.game = 1;
			if (inR(380, 520, 260, 300)) this.game = 2;
			if (inR(380, 520, 330, 360)) this.game = 3;
			if (inR(380, 520, 400, 425)) this.game = 4;
			if (inR(380, 520, 470, 500)) {
				this.save();
				this.onQuit();
			}
			if (inR(810, 860, 40, 110)) this.game = 5;
		} else if (this.game == 4) {
			if (inR(810, 860, 40, 110)) this.game = 6;
			else if (inR(50, 300, 190, 550)) this.difficulty = 1;
			else if (inR(320, 570, 190, 550)) this.difficulty = 2;
			else if (inR(600, 850, 190, 550)) this.difficulty = 3;
		}
		if (this.game == 3 || this.game == 4 || this.game == 5) {
			if (inR(10, 110, 40, 100)) this.game = 0;
		}
		if (this.game == 3) {
			if (inR(810, 860, 40, 110)) this.game = 12;
		} else if (this.game == 12) {
			if (inR(10, 110, 40, 100)) this.game = 3;
			else if (inR(810, 860, 40, 110)) this.game = 13;
		} else if (this.game == 13) {
			if (inR(10, 110, 40, 100)) this.game = 12;
		}
		if (this.game == 6) {
			if (inR(10, 110, 40, 100)) this.game = 4;
			else if (inR(200, 800, 290, 320)) {
				this.character = 1; this.speed = 1; this.lives = 1;
			} else if (inR(200, 800, 430, 460)) {
				if (this.unlockS == 1) { this.character = 2; this.speed = 2; this.lives = 2; }
			} else if (inR(200, 800, 575, 605)) {
				if (this.unlockM == 1) { this.character = 3; this.speed = 3; this.lives = 3; }
			}
		}
		if (this.game == 5) {
			if (inR(10, 110, 40, 100)) this.game = 0;
			if (inR(810, 860, 40, 110)) this.game = 9;
		}
		if (this.game == 9) {
			if (inR(10, 110, 40, 100)) this.game = 5;
		}
	}

	// ── Keyboard ──
	keyPressed(code: string): boolean {
		const sp = this.speed;
		const enter = code == 'Enter' || code == 'NumpadEnter';
		const known = enter || /^Key[WASD]$/.test(code) || /^Arrow(Up|Down|Left|Right)$/.test(code);
		if (!known) return false;
		if (this.game == 1 && this.hooked == 0) {
			if (code == 'KeyA') { this.direction = 2; this.dx = -sp; }
			if (code == 'KeyD') { this.direction = 1; this.dx = sp; }
			if (code == 'KeyW') this.dy = -sp;
			if (code == 'KeyS') this.dy = sp;
		}
		if (this.game == 2) {
			if (code == 'KeyA') { this.direction = 2; this.mdx = -sp; }
			if (code == 'KeyD') { this.direction = 1; this.mdx = sp; }
			if (code == 'KeyW') this.mdy = -sp;
			if (code == 'KeyS') this.mdy = sp;
			if (code == 'ArrowLeft') { this.direction2 = 2; this.dx = -sp; }
			if (code == 'ArrowRight') { this.direction2 = 1; this.dx = sp; }
			if (code == 'ArrowUp') this.dy = -sp;
			if (code == 'ArrowDown') this.dy = sp;
		}
		if ((this.game == 7 || this.game == 8 || this.game == 10 || this.game == 11) && enter) this.playAgain();
		return true;
	}
	keyReleased(code: string): boolean {
		if (this.game == 1) {
			if (code == 'KeyW' || code == 'KeyS') this.dy = 0;
			if (code == 'KeyA' || code == 'KeyD') this.dx = 0;
		}
		if (this.game == 2) {
			if (code == 'ArrowUp' || code == 'ArrowDown') this.dy = 0;
			if (code == 'ArrowLeft' || code == 'ArrowRight') this.dx = 0;
			if (code == 'KeyA' || code == 'KeyD') this.mdx = 0;
			if (code == 'KeyW' || code == 'KeyS') this.mdy = 0;
		}
		return /^Key[WASD]$/.test(code) || /^Arrow/.test(code) || code == 'Enter';
	}

	/** Enter on the game over / win screens: reset everything and back to the title screen. */
	private playAgain() {
		this.dx = 0; this.dy = 0; this.dx2 = 1; this.score = 0; this.goY = -100; this.hooked = 0; this.direction = 1;
		this.mdx = 0; this.mdy = 0; this.safe = 0;
		this.lives = this.character;
		if (this.fishAte > this.fa) this.fa = this.fishAte;
		if (this.sharkAte > this.sa) this.sa = this.sharkAte;
		for (const k of RESET_FIELDS) {
			const v = this.initial[k];
			(this as Record<string, unknown>)[k] = Array.isArray(v) ? [...v] : v;
		}
		this.fishAte = 0;
		this.sharkAte = 0;
		if (this.whoWon == 1) this.p1s++;
		else if (this.whoWon == 2) this.p2s++;
		this.whoWon = 0;
		this.gp++;
		this.game = 0;
		this.save();
	}

	// ── Game loop: run() moves things, then the rules Java kept in paintComponent ──
	tick() {
		const before = this.game;
		const was = { lives: this.lives, w: this.fishw, w2: this.fishw2, w3: this.fishw3, hooked: this.hooked };
		this.run();
		this.speed = this.game == 2 ? 1 : this.character;
		if (this.game == 1) this.singlePlayer();
		if (this.game == 2) this.multiplayer();
		// Sounds, from what this step changed.
		if (this.hooked == 1 && was.hooked == 0) this.sfx('hooked');
		if (this.lives < was.lives) this.sfx('eaten');
		if (this.fishw > was.w || this.fishw2 > was.w2 || this.fishw3 > was.w3) this.sfx('eat');
		if (before == 2 && (this.fishw2 < was.w2 || this.fishw3 < was.w3)) this.sfx('eaten');
		if (before != this.game) {
			if (this.game == 8 || this.game == 10 || this.game == 11) this.sfx('win');
			if (this.game == 7) this.sfx('lose');
		}
		if (before == 1 && (this.game == 7 || this.game == 8)) {
			this.onScore(this.difficulty, this.score);
			this.save();
		}
		if (this.game == 10) this.whoWon = 1;
		if (this.game == 11) this.whoWon = 2;
	}

	private moveEnemies() {
		for (let a = 0; a < 4; a++) {
			this.enemiesxR[a] += this.dx2;
			this.enemiesxL[a] -= this.dx2;
			if (this.enemiesxR[a] > 910) {
				this.enemiesxR[a] = -310;
				this.enemiesy1[a] = rnd(600) + 10;
				this.enemiesw[a] = rnd(300) + 40;
				this.enemiesh[a] = Math.trunc(this.enemiesw[a] / 3);
			}
			if (this.enemiesxL[a] < -310) {
				this.enemiesxL[a] = 1000;
				this.enemiesy2[a] = rnd(600) + 10;
				this.enemiesw2[a] = rnd(210) + 30;
				this.enemiesh2[a] = Math.trunc(this.enemiesw2[a] / 3);
			}
		}
	}

	private run() {
		if (this.game == 1) {
			this.moveEnemies();
			for (let a = 0; a < 2; a++) {
				if (this.difficulty == 2 || this.difficulty == 3) {
					this.sharkxR[a] += this.sharkdx;
					this.sharkxL[a] -= this.sharkdx;
					if (this.sharkxR[a] > 910) {
						this.sharkxR[a] = -560;
						this.sharky1[a] = rnd(500) + 10;
						this.sharkw[a] = rnd(400) + 150;
						this.sharkh[a] = Math.trunc(this.sharkw[a] / 3);
					}
					if (this.sharkxL[a] < -560) {
						this.sharkxL[a] = 1000;
						this.sharky2[a] = rnd(500) + 10;
						this.sharkw2[a] = rnd(400) + 180;
						this.sharkh2[a] = Math.trunc(this.sharkw2[a] / 3);
					}
				}
				if (this.difficulty == 3) {
					if (this.fishw < 300 && this.hookY[a] < 0 && this.hookFlag == 0) {
						this.hookdy = 3;
						this.hookFlag = 1;
					}
					if (this.hookY[a] > 0 && this.hookFlag == 1) this.hookdy = -3;
					if (this.hookY[a] < -500) {
						this.hookFlag = 0;
						this.hookX[a] = rnd(950) - 50;
					}
					this.hookY[a] += this.hookdy;
				}
			}
			this.x += this.dx;
			this.y += this.dy;
		}
		if (this.game == 2) {
			this.x2 += this.mdx;
			this.y2 += this.mdy;
			this.x3 += this.dx;
			this.y3 += this.dy;
			this.moveEnemies();
		}
		if (this.game == 7) {
			this.deltagoY = 5;
			if (this.goY > 180) this.deltagoY = 0;
			this.goY += this.deltagoY;
		}
	}

	// Sprites as drawn, for pixel collisions.
	private playerSprite(): Sprite {
		const n: SpriteName[] = this.character == 2 ? ['SharkCharR', 'SharkCharL'] : this.character == 3 ? ['MooneyFishR', 'MooneyFishL'] : ['FishyR', 'FishyL'];
		return { mask: this.masks[this.direction == 2 ? n[1] : n[0]], x: this.x, y: this.y, w: this.fishw, h: this.fishh };
	}
	private sprite(n: SpriteName, x: number, y: number, w: number, h: number): Sprite {
		return { mask: this.masks[n], x, y, w, h };
	}

	/** Wrap around left/right, stay inside top/bottom (until the fish is huge). */
	private border(f: { x: number; y: number; w: number; h: number }) {
		if (f.w >= 750) return f;
		if (f.x < 0) f.x = 900 - f.w;
		if (f.x > 900 - f.w) f.x = 0;
		if (f.y < 0) f.y = 0;
		if (f.y > 650 - f.h) f.y = 650 - f.h;
		return f;
	}

	private grow() {
		this.fishw += 5;
		this.fishh = Math.trunc(this.fishw / 3);
		this.score += 50;
	}
	private die() {
		this.lives--;
		this.x = 370;
		this.y = 250;
		this.safe = SAFE_TICKS;
	}

	private singlePlayer() {
		const b = this.border({ x: this.x, y: this.y, w: this.fishw, h: this.fishh });
		this.x = b.x;
		this.y = b.y;
		if (this.safe > 0) this.safe--;

		if (this.hooked == 0) {
			// Fish: you eat smaller fish wherever you touch them; a bigger fish only eats you if you
			// run into its mouth (the front of it), not its body or tail.
			for (let a = 0; a < 4; a++) {
				const me = this.playerSprite();
				const r = this.sprite('EnemyFishR', this.enemiesxR[a], this.enemiesy1[a], this.enemiesw[a], this.enemiesh[a]);
				if (pixelsTouch(me, r)) {
					if (this.fishw < this.enemiesw[a]) {
						if (this.safe == 0 && pixelsTouch(me, r, mouth(r, 1))) { this.die(); break; }
					} else if (this.fishw > this.enemiesw[a]) {
						this.enemiesxR[a] = -310;
						this.enemiesy1[a] = rnd(600) + 10;
						this.fishAte++; this.Tfa++;
						this.grow();
					}
				}
				const l = this.sprite('EnemyFishL', this.enemiesxL[a], this.enemiesy2[a], this.enemiesw2[a], this.enemiesh2[a]);
				if (pixelsTouch(this.playerSprite(), l)) {
					if (this.fishw < this.enemiesw2[a]) {
						if (this.safe == 0 && pixelsTouch(this.playerSprite(), l, mouth(l, -1))) { this.die(); break; }
					} else if (this.fishw > this.enemiesw2[a]) {
						this.enemiesxL[a] = 910;
						this.enemiesy2[a] = rnd(600) + 10;
						this.fishAte++; this.Tfa++;
						this.grow();
					}
				}
			}
		}
		for (let a = 0; a < 2; a++) {
			// Sharks
			if ((this.difficulty == 2 || this.difficulty == 3) && this.hooked == 0) {
				const sr = this.sprite('EnemySharkR', this.sharkxR[a], this.sharky1[a], this.sharkw[a], this.sharkh[a]);
				const sl = this.sprite('EnemySharkL', this.sharkxL[a], this.sharky2[a], this.sharkw2[a], this.sharkh2[a]);
				if (pixelsTouch(this.playerSprite(), sr)) {
					if (this.fishw < this.sharkw[a]) {
						if (this.safe == 0 && pixelsTouch(this.playerSprite(), sr, mouth(sr, 1))) this.die();
					} else if (this.fishw > this.sharkw[a]) {
						this.sharkxR[a] = -310;
						this.sharky1[a] = rnd(500) + 10;
						this.ateShark();
					}
				} else if (pixelsTouch(this.playerSprite(), sl)) {
					if (this.fishw < this.sharkw2[a]) {
						if (this.safe == 0 && pixelsTouch(this.playerSprite(), sl, mouth(sl, -1))) this.die();
					} else if (this.fishw > this.sharkw2[a]) {
						this.sharkxL[a] = 910;
						this.sharky2[a] = rnd(500) + 10;
						this.ateShark();
					}
				}
			}
			// Hooks: only the hook itself catches (the bottom of the line), not the line above it.
			if (this.difficulty == 3 && this.hooked == 0 && this.safe == 0) {
				const hook = this.sprite('TheHook', this.hookX[a], this.hookY[a], 30, 400);
				if (pixelsTouch(this.playerSprite(), hook, { x: this.hookX[a], y: this.hookY[a] + 330, w: 30, h: 70 })) {
					this.hookdy = -3;
					this.hooked = 1;
					this.whichEnemy = a;
				}
			}
		}
		if (this.hooked == 1) {
			this.y = this.hookY[this.whichEnemy] + 400;
			this.x = this.hookX[this.whichEnemy] + 15;
			this.direction = 3;
			if (this.y < 0) {
				this.hooked = 3;
				this.lives--;
				this.dbh++;
				this.direction = 1;
			}
		}
		if (this.y < 0 && this.hooked == 3) {
			this.x = 370;
			this.y = 250;
			this.hooked = 0;
			this.safe = SAFE_TICKS;
		}

		// Win Condition
		if (this.score > this.scorecap) {
			this.game = 8;
			if (this.difficulty == 3) this.unlockM = 1;
		}
		// Lose Condition
		if (this.lives <= 0) this.game = 7;
		if (this.difficulty == 1 && this.score > this.ehs) this.ehs = this.score;
		if (this.difficulty == 2 && this.score > this.mhs) this.mhs = this.score;
		if (this.difficulty == 3 && this.score > this.hhs) this.hhs = this.score;
	}

	private ateShark() {
		this.Tsa++;
		this.sharkAte++;
		this.unlockS = 1;
		this.grow();
	}

	private multiplayer() {
		const p1 = this.border({ x: this.x2, y: this.y2, w: this.fishw2, h: this.fishh2 });
		const p2 = this.border({ x: this.x3, y: this.y3, w: this.fishw3, h: this.fishh3 });
		[this.x2, this.y2, this.x3, this.y3] = [p1.x, p1.y, p2.x, p2.y];
		const s1 = () => this.sprite(this.direction == 2 ? 'FishyL' : 'FishyR', this.x2, this.y2, this.fishw2, this.fishh2);
		const s2 = () => this.sprite(this.direction2 == 2 ? 'Fishy2L' : 'Fishy2R', this.x3, this.y3, this.fishw3, this.fishh3);
		// Each player against the CPU fish: eaten (by a bigger one's mouth) = back to the start, small again.
		const versus = (me: () => Sprite, size: () => number, reset: () => void, grow: () => void) => {
			for (let a = 0; a < 4; a++) {
				const r = this.sprite('EnemyFishR', this.enemiesxR[a], this.enemiesy1[a], this.enemiesw[a], this.enemiesh[a]);
				if (pixelsTouch(me(), r)) {
					if (size() < this.enemiesw[a]) {
						if (pixelsTouch(me(), r, mouth(r, 1))) return reset();
					} else if (size() > this.enemiesw[a]) {
						this.enemiesxR[a] = -310;
						this.enemiesy1[a] = rnd(600) + 10;
						grow();
					}
				}
				const l = this.sprite('EnemyFishL', this.enemiesxL[a], this.enemiesy2[a], this.enemiesw2[a], this.enemiesh2[a]);
				if (pixelsTouch(me(), l)) {
					if (size() < this.enemiesw2[a]) {
						if (pixelsTouch(me(), l, mouth(l, -1))) return reset();
					} else if (size() > this.enemiesw2[a]) {
						this.enemiesxL[a] = 910;
						this.enemiesy2[a] = rnd(600) + 10;
						grow();
					}
				}
			}
		};
		versus(
			s1,
			() => this.fishw2,
			() => { this.fishw2 = 60; this.fishh2 = 20; this.x2 = 250; this.y2 = 250; },
			() => { this.fishw2 += 5; this.fishh2 = Math.trunc(this.fishw2 / 3); }
		);
		versus(
			s2,
			() => this.fishw3,
			() => { this.fishw3 = 60; this.fishh3 = 20; this.x3 = 650; this.y3 = 250; },
			() => { this.fishw3 += 5; this.fishh3 = Math.trunc(this.fishw3 / 3); }
		);
		// Player Collisions: the bigger fish wins.
		if (pixelsTouch(s1(), s2())) {
			if (this.fishw2 > this.fishw3) this.game = 10;
			else if (this.fishw2 < this.fishw3) this.game = 11;
		}
	}

	// ── Drawing (paintComponent) ──
	paint(ctx: CanvasRenderingContext2D, now: number) {
		const g = this.g;
		const i = this.img;
		g.begin(ctx);
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		if (this.game == 0) g.img(i.Mainmenu, 0, 0, 900, 700);

		if (this.game == 1) {
			g.img(i.Background1, 0, 0, 900, 700);
			for (let a = 0; a < 4; a++) {
				g.img(i.EnemyFishR, this.enemiesxR[a], this.enemiesy1[a], this.enemiesw[a], this.enemiesh[a]);
				g.img(i.EnemyFishL, this.enemiesxL[a], this.enemiesy2[a], this.enemiesw2[a], this.enemiesh2[a]);
			}
			for (let a = 0; a < 2; a++) {
				if (this.difficulty == 2 || this.difficulty == 3) {
					g.img(i.EnemySharkR, this.sharkxR[a], this.sharky1[a], this.sharkw[a], this.sharkh[a]);
					g.img(i.EnemySharkL, this.sharkxL[a], this.sharky2[a], this.sharkw2[a], this.sharkh2[a]);
				}
				if (this.difficulty == 3) g.img(i.TheHook, this.hookX[a], this.hookY[a], 30, 400);
			}
			// Blink while safe after a respawn.
			if (this.safe == 0 || Math.floor(now / 100) % 2 == 0) {
				const set: [ImageName, ImageName, ImageName] =
					this.character == 2 ? ['SharkCharR', 'SharkCharL', 'SharkCharUp'] : this.character == 3 ? ['MooneyFishR', 'MooneyFishL', 'MooneyFishUp'] : ['FishyR', 'FishyL', 'FishyUp'];
				if (this.direction == 1) g.img(i[set[0]], this.x, this.y, this.fishw, this.fishh);
				else if (this.direction == 2) g.img(i[set[1]], this.x, this.y, this.fishw, this.fishh);
				else if (this.direction == 3) g.img(i[set[2]], this.x, this.y, this.fishh, this.fishw);
			}
			// Lives and Score Output
			g.font(30, COMIC);
			g.setColor('rgb(0,0,255)');
			g.drawString('Lives:', 10, 660);
			g.drawString('' + this.score, 450, 40);
			for (let a = 0; a < this.lives; a++) g.img(i.livesCount, this.livesX[a], 630, 50, 40);
		}

		if (this.game == 2) {
			g.img(i.Background1, 0, 0, 900, 700);
			g.img(i.P1, this.x2 + 20, this.y2 - 30, 50, 50);
			g.img(i.P2, this.x3 + 20, this.y3 - 30, 50, 50);
			g.img(this.direction == 2 ? i.FishyL : i.FishyR, this.x2, this.y2, this.fishw2, this.fishh2);
			g.img(this.direction2 == 2 ? i.Fishy2L : i.Fishy2R, this.x3, this.y3, this.fishw3, this.fishh3);
			for (let a = 0; a < 4; a++) {
				g.img(i.EnemyFishR, this.enemiesxR[a], this.enemiesy1[a], this.enemiesw[a], this.enemiesh[a]);
				g.img(i.EnemyFishL, this.enemiesxL[a], this.enemiesy2[a], this.enemiesw2[a], this.enemiesh2[a]);
			}
			g.font(30, COMIC);
			g.setColor('#000');
			g.img(i.P1, 10, 630, 80, 80);
			g.img(i.P2, 780, 630, 80, 80);
			g.drawString('' + this.p1s, 70, 660);
			g.drawString('' + this.p2s, 840, 660);
		}

		// Highscore screen, with each difficulty's global record beside it.
		if (this.game == 3) {
			g.img(i.Highscore, 0, 0, 900, 700);
			g.font(24, COMIC);
			g.setColor('#000');
			g.drawString('' + this.ehs, 450, 260);
			g.drawString('' + this.mhs, 450, 370);
			g.drawString('' + this.hhs, 450, 480);
			g.font(18, COMIC);
			g.setColor('rgb(10,60,90)');
			g.drawString('Global records', 590, 200);
			for (const [board, y, local] of [[1, 252, this.ehs], [2, 362, this.mhs], [3, 472, this.hhs]] as const) {
				drawRecord(g, { global: this.global, board, local, loggedIn: this.loggedIn, x: 590, y, family: COMIC, color: '#000', dim: 'rgb(20,80,110)', size: 17 });
			}
		}
		if (this.game == 12) {
			g.img(i.Records, 0, 0, 900, 700);
			g.font(24, COMIC);
			g.setColor('#000');
			for (const [v, y] of [[this.gp, 250], [this.Tfa, 300], [this.Tsa, 350], [this.dbh, 400], [this.fa, 505], [this.sa, 555]]) {
				g.drawString('' + v, 450, y);
			}
		}
		if (this.game == 13) {
			g.img(i.HSMulti, 0, 0, 900, 700);
			g.font(24, COMIC);
			g.setColor('#000');
			g.drawString('' + this.p1s, 450, 260);
			g.drawString('' + this.p2s, 450, 370);
		}
		// Options screen
		if (this.game == 4) {
			g.img(i.Difficulty, 0, 0, 900, 700);
			const sx = [0, 150, 440, 730][this.difficulty];
			if (sx) g.img(i.SelectedChar, sx, 120, 45, 20);
		}
		if (this.game == 6) {
			g.img(i.Characters, 0, 0, 900, 700);
			if (this.unlockS == 0) g.img(i.UnlockShark, 400, 310, 379, 130);
			if (this.unlockM == 0) g.img(i.UnlockMooney, 400, 460, 379, 130);
			const sy = [0, 210, 365, 515][this.character];
			if (sy) g.img(i.SelectedChar, 25, sy, 45, 20);
		}
		// How to Play
		if (this.game == 5) g.img(i.HowToPlay2, 0, 0, 900, 700);
		if (this.game == 9) g.img(i.HowToPlay1, 0, 0, 900, 700);
		// Game Over
		if (this.game == 7) {
			g.img(i.GameOver, -150, 0, 1200, 700);
			g.setColor('rgb(255,118,118)');
			g.font(50, COMIC);
			g.drawString('Game Over!', 100, this.goY);
		}
		if (this.game == 8) g.img(i.WinScreen, 0, 0, 900, 700);
		if (this.game == 10) g.img(i.P1Win, 0, 0, 1200, 700);
		if (this.game == 11) g.img(i.P2Win, 0, 0, 1200, 700);
	}
}

/** The front of a fish or shark (its mouth end): the third of it facing the way it swims. */
function mouth(s: Sprite, dir: 1 | -1): { x: number; y: number; w: number; h: number } {
	const w = s.w * 0.35;
	return { x: dir > 0 ? s.x + s.w - w : s.x, y: s.y, w, h: s.h };
}

/** Fields "Play Again" puts back to their starting values (Fishy.java's reset tables). */
const RESET_FIELDS = [
	'enemiesxR', 'enemiesy1', 'enemiesw', 'enemiesh', 'enemiesxL', 'enemiesy2', 'enemiesw2', 'enemiesh2',
	'x', 'y', 'fishw', 'fishh',
	'sharkxR', 'sharky1', 'sharkw', 'sharkh', 'sharkxL', 'sharky2', 'sharkw2', 'sharkh2', 'hookX', 'hookY',
	'x2', 'y2', 'fishw2', 'fishh2', 'x3', 'y3', 'fishw3', 'fishh3'
] as const;
