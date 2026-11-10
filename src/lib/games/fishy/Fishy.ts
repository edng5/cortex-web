// Fishy (Fishy.java), ported to TypeScript. The game, its menus (clicked, as in the original) and
// its numbers are Edward's; the changes:
//  - Collisions are pixel-perfect: two fish only touch where both sprites have solid pixels, not
//    wherever their bounding boxes overlap (the Java version compared corner points of boxes).
//    And a bigger fish only eats you if you run into its mouth (the front), not its body or tail.
//  - Single player moves with WASD or the arrow keys (so either on-screen joystick works on
//    phones); in multiplayer, player 1 has WASD and player 2 the arrow keys, as before.
//  - A moment of safety after losing a life, so you can't be eaten again where you respawn.
import { COMIC, Gfx, Mask, buttonAt, drawButtons, drawRecord, keyRow, loadImages, loadSave, padlock, panel, pips, pixelsTouch, text, writeSave, type ArcadeGame, type Board, type Sprite, type UiButton, type UiTheme } from '../common';

export const GAME_W = 900;
export const GAME_H = 662;
export const TICK_MS = 10;

const BASE = '/games/fishy/';
const IMAGES = {
	Mainmenu: 'TitleScreenClean.jpg', Sea: 'SeaClean.jpg', Background1: 'Background1.png', FishyR: 'FishyCharR.png', FishyL: 'FishyCharL.png',
	FishyUp: 'FishyCharUp.png', EnemyFishR: 'EnemyFishR.png', EnemyFishL: 'EnemyFishL.png', SharkCharR: 'SharkCharR.png',
	SharkCharL: 'SharkCharL.png', SharkCharUp: 'SharkCharUp.png', MooneyFishR: 'MooneyFishR.png', MooneyFishL: 'MooneyFishL.png',
	MooneyFishUp: 'MooneyFishUp.png', GameOver: 'GameOver.jpg', WinScreen: 'WinScreen.jpg', EnemySharkR: 'SharkR.png', EnemySharkL: 'SharkL.png', TheHook: 'TheHook.png', livesCount: 'livesCount.png',
	P1: 'P1.png', P2: 'P2.png', Fishy2R: 'FishyChar2R.png', Fishy2L: 'FishyChar2L.png', P1Win: 'P1Win.jpg', P2Win: 'P2Win.jpg'
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

// ── Menu look: white bubbles on the sea, coral for the main action and the picked option ──
const INK = 'rgb(10,55,85)';
const INK_SOFT = 'rgba(10,55,85,0.75)';
const CORAL = 'rgb(240,110,70)';
const CARD = 'rgba(255,255,255,0.72)';
const UI: UiTheme = {
	family: COMIC,
	size: 26,
	detailSize: 15,
	radius: 26,
	borderWidth: 3,
	glow: 'rgba(0,50,110,0.35)',
	cardHover: 'rgb(0,120,190)',
	idle: { fill: 'rgba(255,255,255,0.6)', text: 'rgb(14,74,110)', border: 'rgba(255,255,255,0.95)', detail: 'rgba(14,74,110,0.75)' },
	hover: { fill: 'rgb(255,255,255)', text: 'rgb(0,100,155)', border: CORAL, detail: 'rgb(220,90,50)' },
	primary: { fill: CORAL, text: '#fff', border: 'rgba(255,255,255,0.95)', detail: 'rgba(255,255,255,0.9)' },
	chosen: { fill: 'rgba(255,255,255,0.92)', text: INK, border: CORAL },
	disabled: { fill: 'rgba(255,255,255,0.6)', text: 'rgba(14,74,110,0.5)', border: 'rgba(255,255,255,0.8)' }
};
const DIFFICULTIES = ['', 'Easy', 'Medium', 'Hard'];
const CHARACTERS = ['', 'Fishy', 'Shark', 'Mooney Fish'];
/** The menu screens (title, high scores tabs, options, how to play). */
const MENU_SCREENS = [0, 3, 4, 5, 12, 13];

/** A small "Selected" pill under a picked card. */
function badge(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
	panel(ctx, cx - 50, cy - 13, 100, 26, { fill: CORAL, radius: 13 });
	text(ctx, label, cx, cy + 1, { size: 15, family: COMIC, color: '#fff', align: 'center' });
}

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

	// ── Menus: drawn buttons and cards, clicked or tapped ──
	// Screens (`game`): 0 title, 3 / 12 / 13 high scores (single player, records, multiplayer tabs),
	// 4 options (difficulty and character), 5 how to play.
	private hover: string | null = null;

	pointerDown(px: number, py: number) {
		if (this.game == 7 || this.game == 8 || this.game == 10 || this.game == 11) {
			this.keyPressed('Enter'); // "Press Enter to Play Again": a click works too
			return;
		}
		const b = buttonAt(this.ui(), px, py);
		if (!b) return;
		this.sfx('confirm');
		b.onClick();
		this.hover = null;
		this.save();
	}
	pointerMove(px: number, py: number) {
		if (!MENU_SCREENS.includes(this.game)) return false;
		const b = buttonAt(this.ui(), px, py);
		this.hover = b?.id ?? null;
		return !!b;
	}

	private ui(): UiButton[] {
		const back: UiButton = { id: 'back', x: 20, y: 18, w: 128, h: 46, label: '‹ Back', size: 22, onClick: () => (this.game = 0) };
		switch (this.game) {
			case 0: {
				const rows: [string, string | undefined, () => void][] = [
					['Single Player', `${DIFFICULTIES[this.difficulty]} · playing as ${CHARACTERS[this.character]}`, () => (this.game = 1)],
					['Multiplayer', '2 players · one keyboard', () => (this.game = 2)],
					['High Scores', 'Records and 2P wins', () => (this.game = 3)],
					['Options', 'Difficulty and character', () => (this.game = 4)],
					['Exit Game', undefined, () => { this.save(); this.onQuit(); }]
				];
				return [
					...rows.map(([label, detail, onClick], i): UiButton => ({
						id: 'main' + i, label, detail, x: 300, y: 150 + i * 68, w: 300, h: 56, kind: i == 0 ? 'primary' : undefined, onClick
					})),
					// The art's "?" bubble: How to Play.
					{ id: 'help', x: 804, y: 22, w: 64, h: 64, label: '?', size: 34, onClick: () => (this.game = 5) }
				];
			}
			case 3: case 12: case 13:
				return [
					back,
					...([[3, 'Single player'], [12, 'Records'], [13, 'Multiplayer']] as const).map(([screen, label], i): UiButton => ({
						id: 'tab' + screen, label, x: 216 + i * 160, y: 100, w: 150, h: 44, size: 20, chosen: this.game == screen,
						onClick: () => (this.game = screen)
					}))
				];
			case 4:
				return [
					back,
					...[1, 2, 3].map((d): UiButton => ({
						id: 'diff' + d, x: 60 + (d - 1) * 270, y: 136, w: 240, h: 190, chosen: this.difficulty == d,
						draw: (ctx, b) => this.drawDifficulty(ctx, b, d),
						onClick: () => (this.difficulty = d)
					})),
					...[1, 2, 3].map((c): UiButton => {
						const locked = (c == 2 && this.unlockS != 1) || (c == 3 && this.unlockM != 1);
						return {
							id: 'char' + c, x: 60 + (c - 1) * 270, y: 392, w: 240, h: 216, chosen: this.character == c, disabled: locked,
							draw: (ctx, b) => this.drawCharacter(ctx, b, c, locked),
							onClick: () => {
								// As the original: the character sets your speed and lives.
								this.character = c; this.speed = c; this.lives = c;
							}
						};
					})
				];
			case 5:
				return [back];
		}
		return [];
	}

	private drawDifficulty(ctx: CanvasRenderingContext2D, b: UiButton, d: number) {
		const i = this.img;
		const cx = b.x + b.w / 2;
		text(ctx, DIFFICULTIES[d], cx, b.y + 30, { size: 28, family: COMIC, color: INK, align: 'center' });
		// Who's in the water.
		ctx.drawImage(i.EnemyFishR, b.x + 24, b.y + 62, 72, 24);
		if (d >= 2) ctx.drawImage(i.EnemySharkR, b.x + 104, b.y + 56, 84, 28);
		if (d == 3) ctx.drawImage(i.TheHook, b.x + 200, b.y + 46, 16, 60);
		const lines = [['Fish only', 'Fish and sharks', 'Fish, sharks and hooks'][d - 1], 'Speed: ' + ['slow', 'moderate', 'fast'][d - 1]];
		lines.forEach((l, k) => text(ctx, l, cx, b.y + 120 + k * 26, { size: 17, family: COMIC, color: INK_SOFT, align: 'center', bold: false }));
		if (this.difficulty == d) badge(ctx, cx, b.y + b.h - 20, 'Selected');
	}

	private drawCharacter(ctx: CanvasRenderingContext2D, b: UiButton, c: number, locked: boolean) {
		const i = this.img;
		const cx = b.x + b.w / 2;
		ctx.globalAlpha = locked ? 0.45 : 1;
		const sprite = c == 1 ? i.FishyR : c == 2 ? i.SharkCharR : i.MooneyFishR;
		ctx.drawImage(sprite, cx - 75, b.y + 14, 150, 50);
		text(ctx, CHARACTERS[c], cx, b.y + 86, { size: 24, family: COMIC, color: INK, align: 'center' });
		text(ctx, 'Speed', b.x + 30, b.y + 120, { size: 16, family: COMIC, color: INK_SOFT, bold: false });
		pips(ctx, b.x + 100, b.y + 114, c, 3, { on: 'rgb(60,200,90)', off: 'rgba(14,74,110,0.18)', w: 30, h: 12 });
		text(ctx, 'Lives', b.x + 30, b.y + 146, { size: 16, family: COMIC, color: INK_SOFT, bold: false });
		pips(ctx, b.x + 100, b.y + 140, c, 3, { on: 'rgb(60,200,90)', off: 'rgba(14,74,110,0.18)', w: 30, h: 12 });
		ctx.globalAlpha = 1;
		if (locked) {
			padlock(ctx, b.x + b.w - 30, b.y + 28, 26, INK);
			text(ctx, c == 2 ? 'Unlock: eat a shark' : 'Unlock: win on Hard', cx, b.y + 186, { size: 16, family: COMIC, color: 'rgb(190,60,30)', align: 'center' });
		} else if (this.character == c) badge(ctx, cx, b.y + b.h - 22, 'Selected');
	}

	private paintMenus(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		const i = this.img;
		g.img(this.game == 0 ? i.Mainmenu : i.Sea, 0, 0, 900, 700);
		const title = (s: string) => text(ctx, s, 450, 46, { size: 40, family: COMIC, color: INK, align: 'center' });

		// High scores: three tabs.
		if (this.game == 3) {
			title('High Scores');
			[[1, 'Easy', this.ehs], [2, 'Medium', this.mhs], [3, 'Hard', this.hhs]].forEach(([board, name, best], k) => {
				const y = 170 + k * 118;
				panel(ctx, 110, y, 680, 100, { fill: CARD, border: 'rgba(255,255,255,0.95)', radius: 18 });
				text(ctx, name as string, 140, y + 50, { size: 30, family: COMIC, color: INK });
				text(ctx, 'YOUR BEST', 360, y + 32, { size: 13, family: COMIC, color: INK_SOFT });
				text(ctx, '' + best, 360, y + 64, { size: 30, family: COMIC, color: INK });
				text(ctx, 'GLOBAL RECORD', 540, y + 32, { size: 13, family: COMIC, color: INK_SOFT });
				drawRecord(g, { global: this.global, board: board as number, local: best as number, loggedIn: this.loggedIn, x: 540, y: y + 60, family: COMIC, color: INK, dim: INK_SOFT, size: 17 });
			});
		}
		if (this.game == 12) {
			title('High Scores');
			const block = (x: number, heading: string, rows: [string, number][]) => {
				panel(ctx, x, 170, 330, 300, { fill: CARD, border: 'rgba(255,255,255,0.95)', radius: 18 });
				text(ctx, heading, x + 28, 206, { size: 26, family: COMIC, color: INK });
				rows.forEach(([k, v], n) => {
					text(ctx, k, x + 28, 254 + n * 48, { size: 19, family: COMIC, color: INK_SOFT, bold: false });
					text(ctx, '' + v, x + 302, 254 + n * 48, { size: 24, family: COMIC, color: INK, align: 'right' });
				});
			};
			block(110, 'All games', [['Games played', this.gp], ['Fish eaten', this.Tfa], ['Sharks eaten', this.Tsa], ['Caught by hooks', this.dbh]]);
			block(460, 'Best in one game', [['Fish eaten', this.fa], ['Sharks eaten', this.sa]]);
		}
		if (this.game == 13) {
			title('High Scores');
			[[i.P1, 'Player 1', this.p1s], [i.P2, 'Player 2', this.p2s]].forEach(([icon, name, wins], k) => {
				const x = 150 + k * 320;
				panel(ctx, x, 180, 280, 260, { fill: CARD, border: 'rgba(255,255,255,0.95)', radius: 18 });
				ctx.drawImage(icon as HTMLImageElement, x + 100, 196, 80, 80);
				text(ctx, name as string, x + 140, 300, { size: 26, family: COMIC, color: INK, align: 'center' });
				text(ctx, '' + wins, x + 140, 354, { size: 48, family: COMIC, color: CORAL, align: 'center' });
				text(ctx, 'wins', x + 140, 396, { size: 18, family: COMIC, color: INK_SOFT, align: 'center', bold: false });
			});
		}

		if (this.game == 4) {
			title('Options');
			text(ctx, 'Difficulty', 60, 116, { size: 24, family: COMIC, color: INK });
			text(ctx, 'Character', 60, 372, { size: 24, family: COMIC, color: INK });
		}

		// How to play: both modes on one page.
		if (this.game == 5) {
			title('How to Play');
			const key = { family: 'Arial, sans-serif', fill: '#fff', text: INK, border: 'rgba(14,74,110,0.45)', size: 13, h: 28 };
			const col = (x: number, heading: string) => {
				panel(ctx, x, 96, 400, 470, { fill: CARD, border: 'rgba(255,255,255,0.95)', radius: 18 });
				text(ctx, heading, x + 200, 128, { size: 28, family: COMIC, color: INK, align: 'center' });
			};
			const line = (x: number, y: number, s: string) => text(ctx, s, x, y, { size: 17, family: COMIC, color: INK_SOFT, bold: false, max: 360 });
			col(40, 'Single player');
			ctx.drawImage(i.FishyR, 70, 160, 90, 30);
			ctx.drawImage(i.EnemyFishR, 190, 168, 45, 15);
			line(70, 214, 'Eat fish smaller than you to grow.');
			ctx.drawImage(i.EnemyFishL, 70, 240, 150, 50);
			ctx.drawImage(i.FishyL, 240, 256, 54, 18);
			line(70, 312, 'Avoid bigger fish: swim into their');
			line(70, 334, 'mouth and you lose a life.');
			line(70, 372, 'Medium adds sharks; Hard adds hooks.');
			line(70, 398, 'Reach 9000 points to win.');
			keyRow(ctx, ['W', 'A', 'S', 'D'], 70, 432, key);
			line(70, 482, 'or the arrow keys to swim');
			col(460, 'Multiplayer');
			ctx.drawImage(i.P1, 500, 156, 44, 44);
			ctx.drawImage(i.FishyR, 550, 166, 90, 30);
			ctx.drawImage(i.P2, 680, 156, 44, 44);
			ctx.drawImage(i.Fishy2L, 730, 166, 90, 30);
			line(490, 230, 'Eat the other player to win.');
			line(490, 262, 'If a CPU fish eats you, you shrink');
			line(490, 284, 'back to your starting size.');
			text(ctx, 'Player 1', 490, 340, { size: 17, family: COMIC, color: INK });
			keyRow(ctx, ['W', 'A', 'S', 'D'], 600, 326, key);
			text(ctx, 'Player 2', 490, 392, { size: 17, family: COMIC, color: INK });
			keyRow(ctx, ['↑', '←', '↓', '→'], 600, 378, key);
			panel(ctx, 230, 576, 440, 34, { fill: 'rgba(255,255,255,0.85)', radius: 17 });
			text(ctx, 'On phones: the joystick swims (two in multiplayer).', 450, 592, { size: 17, family: COMIC, color: INK, align: 'center', bold: false });
		}

		drawButtons(ctx, this.ui(), UI, this.hover);
	}

	// ── Keyboard ──
	keyPressed(code: string): boolean {
		const sp = this.speed;
		const enter = code == 'Enter' || code == 'NumpadEnter';
		const known = enter || /^Key[WASD]$/.test(code) || /^Arrow(Up|Down|Left|Right)$/.test(code);
		if (!known) return false;
		if (this.game == 1 && this.hooked == 0) {
			if (code == 'KeyA' || code == 'ArrowLeft') { this.direction = 2; this.dx = -sp; }
			if (code == 'KeyD' || code == 'ArrowRight') { this.direction = 1; this.dx = sp; }
			if (code == 'KeyW' || code == 'ArrowUp') this.dy = -sp;
			if (code == 'KeyS' || code == 'ArrowDown') this.dy = sp;
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
			if (code == 'KeyW' || code == 'KeyS' || code == 'ArrowUp' || code == 'ArrowDown') this.dy = 0;
			if (code == 'KeyA' || code == 'KeyD' || code == 'ArrowLeft' || code == 'ArrowRight') this.dx = 0;
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

		if (MENU_SCREENS.includes(this.game)) this.paintMenus(ctx);

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
