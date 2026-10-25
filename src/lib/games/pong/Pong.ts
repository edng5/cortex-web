// Pong × Brick Breaker (Pong_BBV3.java), ported to TypeScript. The Java game's logic is kept as
// written, including its quirks; the paddle moves with A/D instead of the arrow keys, and the
// menus are clicked as in the original.
//
// Java coordinates: mouse clicks were measured on the window (title bar and border included), so
// the menu buttons here are the original hit boxes moved by the window insets (8, 31).
import { Rect } from '../topgun/geometry';
import { ARIAL, ARIAL_BLACK, Gfx, drawRecord, loadImages, loadSave, spotAt, writeSave, type ArcadeGame, type Board, type Hotspot } from '../common';

export const GAME_W = 550;
export const GAME_H = 670;
export const TICK_MS = 10;

const BASE = '/games/pong/';
const IMAGES = { PongMM: 'PongMM.jpg', BrickMM: 'BrickMM.jpg', PongHS: 'PongHS.jpg', BrickHS: 'BrickHS.jpg' };
type Images = Record<keyof typeof IMAGES, HTMLImageElement>;
export const loadAssets = () => loadImages(BASE, IMAGES);

const SAVE_KEY = 'pong-save';
const Blue = 'rgb(18,38,169)';
const Orange = 'rgb(247,148,29)';
const WHITE = 'rgb(255,255,255)';
const BLACK = 'rgb(0,0,0)';

class Ball {
	size = 20; y_speed = 0; x_speed = 0; x = 260; y = 330;
	boundary = new Rect(this.x, this.y, this.size, this.size);
}

class Bricks {
	sizeW = 50; sizeH = 30; x = 0; y = 35;
	boundaryT = new Rect(this.x, this.y, this.sizeW, this.sizeH - 28);
	boundaryB = new Rect(this.x, this.y + 28, this.sizeW, this.sizeH - 28);
	boundaryL = new Rect(this.x, this.y, this.sizeW - 49, this.sizeH);
	boundaryR = new Rect(this.x + 49, this.y, this.sizeW - 49, this.sizeH);
}

class Paddle {
	sizeW = 150; sizeH = 15; x = 200; y = 600; x_speed = 0;
}

/** The 50 bricks: rows of 10, 55 px apart, rows 35 px apart. */
function makeBricks(): Bricks[] {
	const bricks: Bricks[] = [];
	let startx = 0, starty = 0, chkpt = 9;
	for (let i = 0; i < 50; i++) {
		const b = new Bricks();
		b.x += startx;
		b.y += starty;
		bricks.push(b);
		startx += 55;
		if (i == chkpt) {
			starty += 35;
			startx = 0;
			chkpt += 10;
		}
	}
	return bricks;
}

export class Pong implements ArcadeGame {
	// ── Fields (as in Pong_BBV3.java) ──
	bdx = 0; bdy = 0;
	b2x = 260; b2y = 330; b2w = 20; b2h = 20; b2dx = 0; b2dy = 0;
	xmove = 3; ymove = 3;
	goy = -100; gody = 5;
	game = 0; difficulty = 0; start = 0;
	score = 0; highscore = 0; scorex = 500;
	bscore = 0; bhighscore = 0;
	mode = 1;
	pgp = 0; pbh = 0; bgp = 0; bbb = 0;
	nx = -150; ndx = 0; check = 0; hit = 0; counter = 0;
	numBricks = 50;
	bricks = makeBricks();
	ball = new Ball();
	paddle = new Paddle();
	delay = 0;

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	/** Sound effects (set by the host). */
	sfx: (name: string) => void = () => {};
	/** On a menu screen (the host plays the menu soundtrack there). */
	inMenu() {
		return this.game == 0 || this.game == 3;
	}
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();

	constructor(private img: Images) {
		const s = loadSave(SAVE_KEY, { highscore: 0, bhighscore: 0, pgp: 0, pbh: 0, bgp: 0, bbb: 0 });
		Object.assign(this, s);
	}

	save() {
		const { highscore, bhighscore, pgp, pbh, bgp, bbb } = this;
		writeSave(SAVE_KEY, { highscore, bhighscore, pgp, pbh, bgp, bbb });
	}

	leave() {
		if (this.game == 1) {
			const score = this.mode == 1 ? this.score : this.bscore;
			if (score > 0) this.onScore(this.mode, score);
		}
		this.save();
	}

	// ── Mouse (the original menus) ──
	private spots(): Hotspot[] {
		const s: Hotspot[] = [];
		if (this.game == 0) {
			s.push({ x: 92, y: 259, w: 400, h: 81, click: () => this.play() });
			s.push({ x: 92, y: 359, w: 400, h: 91, click: () => (this.game = 3) });
			s.push({ x: 92, y: 479, w: 400, h: 81, click: () => { this.save(); this.onQuit(); } });
		}
		if (this.game == 0 || this.game == 3) s.push({ x: 212, y: 634, w: 330, h: 36, click: () => this.switchMode() });
		if (this.game == 3) s.push({ x: 0, y: 0, w: 122, h: 49, click: () => (this.game = 0) });
		// Game over: a click does what Enter does.
		if (this.game == 2) s.push({ x: 0, y: 0, w: GAME_W, h: GAME_H, click: () => this.keyPressed('Enter') });
		return s;
	}
	pointerMove(x: number, y: number) {
		return !!spotAt(this.spots(), x, y) && this.game != 2;
	}
	pointerDown(x: number, y: number) {
		const spot = spotAt(this.spots(), x, y);
		if (spot && this.game != 2) this.sfx('confirm');
		spot?.click();
	}

	private play() {
		this.game = 1;
		if (this.mode == 1) this.pgp++;
		if (this.mode == 2) this.bgp++;
	}
	private switchMode() {
		if (this.mode == 1) {
			this.mode = 2;
			this.ball.x = 260;
			this.ball.y = 570;
		} else if (this.mode == 2) {
			this.mode = 1;
			this.ball.x = 260;
			this.ball.y = 330;
		}
	}

	// ── Keyboard: A/D paddle, Space to serve, Enter after game over ──
	keyPressed(code: string): boolean {
		const left = code == 'KeyA', right = code == 'KeyD', space = code == 'Space';
		const enter = code == 'Enter' || code == 'NumpadEnter';
		if (!left && !right && !space && !enter) return false;
		if (this.game == 1) {
			if (space && this.start == 0) this.sfx('serve');
			if (left) this.paddle.x_speed = this.difficulty > 2 ? -8 : -5;
			if (right) this.paddle.x_speed = this.difficulty > 2 ? 8 : 5;
			if (space) {
				this.bdx = -this.xmove;
				this.bdy = -this.ymove;
				this.start = 1;
			}
		}
		if (this.game == 2 && enter) this.resetGame();
		return true;
	}
	keyReleased(code: string): boolean {
		if (code != 'KeyA' && code != 'KeyD') return code == 'Space' || code == 'Enter';
		if (this.game == 1) this.paddle.x_speed = 0;
		return true;
	}

	private resetGame() {
		const { paddle, ball } = this;
		this.game = 0;
		paddle.x = 200; paddle.sizeW = 150; paddle.x_speed = 0;
		ball.x = 280; ball.y = 330;
		this.bdx = 0; this.bdy = 0; this.xmove = 3; this.ymove = 3; this.goy = -100; this.start = 0; this.difficulty = 0;
		this.b2x = 280; this.b2y = 330; this.b2dx = 0; this.b2dy = 0;
		this.score = 0; this.nx = -100; this.bscore = 0; this.check = 0; this.counter = 0;
		if (this.mode == 2) {
			this.bricks = makeBricks();
			ball.x = 280;
			ball.y = 570;
		}
		this.save();
	}

	// ── Game loop: run() moves things, then the collision logic that Java kept in paintComponent ──
	tick() {
		const before = this.game;
		const was = { bdx: this.bdx, bdy: this.bdy, b2dx: this.b2dx, b2dy: this.b2dy, counter: this.counter, score: this.score, level: this.difficulty };
		this.run();
		if (this.game == 1 || this.game == 2) this.logic();
		// Sounds, from what this step changed.
		if (this.game == 1) {
			if (this.counter > was.counter) this.sfx('brick');
			else if (this.score > was.score || (this.mode == 2 && was.bdy > 0 && this.bdy < 0 && this.ball.y >= 560)) this.sfx('paddle');
			else if (this.bdx != was.bdx || this.bdy != was.bdy || this.b2dx != was.b2dx || this.b2dy != was.b2dy) {
				if (was.bdx || was.bdy || was.b2dx || was.b2dy) this.sfx('wall');
			}
			if (this.difficulty > was.level) this.sfx('levelUp');
		}
		if (before == 1 && this.game == 2) this.sfx(this.mode == 2 && this.counter == this.numBricks ? 'win' : 'lose');
		if (before == 1 && this.game == 2) {
			this.onScore(this.mode, this.mode == 1 ? this.score : this.bscore);
			this.save();
		}
	}

	private run() {
		const { paddle, ball } = this;
		if (this.game == 1) {
			paddle.x += paddle.x_speed;
			ball.x += this.bdx;
			ball.y += this.bdy;
			ball.boundary.x = ball.x;
			ball.boundary.y = ball.y;
			for (const b of this.bricks) {
				b.boundaryB.x = b.x; b.boundaryB.y = b.y + 28;
				b.boundaryT.x = b.x; b.boundaryT.y = b.y;
				b.boundaryL.x = b.x; b.boundaryL.y = b.y;
				b.boundaryR.x = b.x + 49; b.boundaryR.y = b.y;
			}
			if (this.difficulty >= 0) {
				this.b2x += this.b2dx;
				this.b2y += this.b2dy;
			}
			if (this.check == 0) {
				if (this.score == 10 || this.score == 20 || this.score == 30 || this.score == 40) {
					this.ndx = 5;
					this.nx += this.ndx;
				}
			}
		}
		if (this.game == 2) {
			if (this.goy < 350) this.goy += this.gody;
		}
	}

	private checkWin() {
		if (this.counter == this.numBricks) {
			this.ball.y = 570;
			this.ball.x = 280;
			this.ball.x_speed = 0;
			this.ball.y_speed = 0;
			this.delay++;
		}
		if (this.delay == 50) {
			this.game = 2;
			this.delay = 0;
		}
	}

	private logic() {
		const { paddle, ball } = this;
		if (this.score > this.highscore) this.highscore = this.score;
		// paddle boundaries
		if (paddle.x < 0) paddle.x = 0;
		if (paddle.x > 550 - paddle.sizeW) paddle.x = 550 - paddle.sizeW;
		// Ball collisions
		if (ball.y <= 0) this.bdy = this.ymove;
		if (ball.x <= 0) this.bdx = this.xmove;
		if (ball.x >= 550 - ball.size) this.bdx = -this.xmove;
		if (ball.y > 700 - ball.size) {
			ball.y = 650;
			this.b2y = 650;
			this.game = 2;
		}

		if (this.mode == 1) {
			if (this.difficulty == 0) { this.xmove = 3; this.ymove = 3; }
			if (this.difficulty == 1) { this.xmove = 5; this.ymove = 5; }
			if (this.difficulty == 2) paddle.sizeW = 90;
			if (this.difficulty == 4) { this.xmove = 5; this.ymove = 8; }
			if (this.nx > 700) {
				this.nx = -250;
				this.ndx = 0;
				this.check = 1;
				if (this.score > 29) this.nx = -400;
			}
			if (this.score > 9) this.difficulty = 1;
			if (this.score > 19) this.difficulty = 2;
			if (this.score > 29) this.difficulty = 3;
			if (this.score > 39) this.difficulty = 4;
			if (this.score == 9 || this.score == 19 || this.score == 29 || this.score == 39) this.check = 0;
			if (this.score > 9) this.scorex = 480;

			// Ball Collision
			if (paddle.x - ball.size < ball.x && ball.x < paddle.x + paddle.sizeW && ball.y >= 600 - ball.size && ball.y <= 615 - ball.size) {
				this.bdy = -this.ymove;
				this.score++;
				this.pbh++;
				if (this.score == 30) {
					this.b2dx = -3;
					this.b2dy = -2;
				}
			}
			// Ball 2 Collision
			if (this.b2y < 0) this.b2dy = 2;
			if (this.b2x < 0) this.b2dx = 3;
			if (this.b2x > 550 - this.b2w) this.b2dx = -3;
			if (paddle.x - this.b2w < this.b2x && this.b2x < paddle.x + paddle.sizeW && this.b2y >= 600 - this.b2h && this.b2y <= 615 - this.b2h) {
				this.b2dy = -2;
				this.score++;
				this.pbh++;
			}
			if (this.b2y > 700 - this.b2h) {
				this.b2y = 650;
				ball.y = 650;
				this.game = 2;
			}
		}
		if (this.mode == 2) {
			for (const b of this.bricks) {
				if (ball.boundary.intersects(b.boundaryT)) { this.bdy = -this.ymove; b.x = 600; this.hit = 1; }
				if (ball.boundary.intersects(b.boundaryB)) { this.bdy = this.ymove; b.x = 600; this.hit = 1; }
				if (ball.boundary.intersects(b.boundaryL)) { this.bdx = -this.xmove; b.x = 600; this.hit = 1; }
				if (ball.boundary.intersects(b.boundaryR)) { this.bdx = this.xmove; b.x = 600; this.hit = 1; }
				if (this.hit == 1) {
					this.counter++;
					this.bbb++;
					this.bscore += 10;
					this.hit = 0;
				}
				this.checkWin();
			}
			if (this.bscore > this.bhighscore) this.bhighscore = this.bscore;
			if (paddle.x - ball.size < ball.x && ball.x < paddle.x + paddle.sizeW && ball.y >= 600 - ball.size && ball.y <= 615 - ball.size) {
				this.bdy = -this.ymove;
			}
		}
	}

	// ── Drawing (paintComponent) ──
	paint(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		const { paddle, ball, img } = this;
		g.begin(ctx);
		ctx.fillStyle = BLACK;
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		if (this.game == 0) g.img(this.mode == 1 ? img.PongMM : img.BrickMM, 0, 0, 550, 700);

		if (this.game == 1 || this.game == 2) {
			if (this.mode == 1) {
				g.setColor(BLACK);
				g.fillRect(0, 0, 550, 700);
				g.setColor(WHITE);
				g.font(30, ARIAL_BLACK);
				if (this.difficulty == 1) g.drawString('FASTER!', this.nx, 300);
				if (this.difficulty == 2) g.drawString('SHRINKED!', this.nx, 300);
				if (this.difficulty == 3) g.drawString('DOUBLE TROUBLE!', this.nx, 300);
				if (this.difficulty == 3 || this.difficulty == 4) g.fillOval(this.b2x, this.b2y, this.b2w, this.b2h);
				if (this.difficulty == 4) g.drawString('FASTERR!!!', this.nx, 300);
				g.font(40, ARIAL_BLACK);
				g.drawString('' + this.score, this.scorex, 50);
				g.font(20, ARIAL_BLACK);
				g.drawString('Highscore: ' + this.highscore, 375, 80);
			}
			if (this.mode == 2) {
				g.setColor(Blue);
				g.fillRect(0, 0, 550, 700);
				for (const b of this.bricks) {
					g.setColor(Orange);
					g.fillRect(b.x, b.y, b.sizeW, b.sizeH);
					g.setColor(BLACK);
					g.fillRect(b.boundaryT.x, b.boundaryT.y, 50, 3);
					g.fillRect(b.boundaryB.x, b.boundaryB.y, 50, 3);
					g.fillRect(b.boundaryL.x, b.boundaryL.y, 3, 30);
					g.fillRect(b.boundaryR.x, b.boundaryR.y, 3, 30);
				}
				g.setColor(Orange);
				g.font(30, ARIAL_BLACK);
				g.drawString('' + this.bscore, 20, 640);
				g.font(15, ARIAL_BLACK);
				g.drawString('Highscore: ' + this.bhighscore, 20, 660);
			}
			if (this.start == 0) {
				g.setColor(WHITE);
				g.font(20, ARIAL_BLACK);
				g.drawString('Press Space to Play', 160, this.mode == 1 ? 380 : 650);
			}
			g.setColor(WHITE);
			g.fillRect(paddle.x, paddle.y, paddle.sizeW, paddle.sizeH);
			g.fillOval(ball.x, ball.y, ball.size, ball.size);
			if (this.game == 2) {
				g.font(50, ARIAL_BLACK);
				g.drawString('Game Over!', 100, this.goy);
				g.font(20, ARIAL_BLACK);
				g.drawString('Press Enter to Return to the Main Menu', 50, 380);
			}
		}

		if (this.game == 3) {
			const pong = this.mode == 1;
			g.img(pong ? img.PongHS : img.BrickHS, 0, 0, 550, 700);
			g.setColor(WHITE);
			g.font(30, ARIAL);
			g.drawString('' + (pong ? this.highscore : this.bhighscore), 400, 320);
			g.drawString('' + (pong ? this.pgp : this.bgp), 400, 420);
			g.drawString('' + (pong ? this.pbh : this.bbb), 400, 540);
			// Global board, in the space under the stats.
			g.setColor(pong ? 'rgb(120,220,140)' : 'rgb(255,190,110)');
			g.font(13, ARIAL_BLACK);
			g.drawString('GLOBAL RECORD', 40, 584);
			drawRecord(g, {
				global: this.global,
				board: this.mode,
				local: pong ? this.highscore : this.bhighscore,
				loggedIn: this.loggedIn,
				x: 40,
				y: 604,
				family: ARIAL,
				color: WHITE,
				dim: 'rgb(190,200,230)',
				size: 15
			});
		}
	}
}
