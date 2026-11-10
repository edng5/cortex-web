// Pong × Brick Breaker (Pong_BBV3.java), ported to TypeScript. The Java game's logic is kept as
// written, including its quirks; the paddle moves with A/D instead of the arrow keys, and the
// menus are clicked as in the original.
//
// Java coordinates: mouse clicks were measured on the window (title bar and border included), so
// the menu buttons here are the original hit boxes moved by the window insets (8, 31).
import { Rect } from '../topgun/geometry';
import { ARIAL, ARIAL_BLACK, Gfx, drawGameOver, loadArcadeFont, buttonAt, drawButtons, drawRecord, loadImages, loadSave, panel, roundRect, text, touchScreen, writeSave, type ArcadeGame, type Board, type UiButton, type UiTheme } from '../common';

export const GAME_W = 550;
export const GAME_H = 670;
export const TICK_MS = 10;

const BASE = '/games/pong/';
const IMAGES = { PongMM: 'PongMM.jpg', BrickMM: 'BrickMM.jpg' };
type Images = Record<keyof typeof IMAGES, HTMLImageElement>;
export const loadAssets = () => loadImages(BASE, IMAGES);

const SAVE_KEY = 'pong-save';
const Blue = 'rgb(18,38,169)';
const Orange = 'rgb(247,148,29)';
const WHITE = 'rgb(255,255,255)';
const BLACK = 'rgb(0,0,0)';
const Red = 'rgb(237,27,36)';

/** Menu look, in each game's colour: Pong red on black, Brick Breaker orange on blue. */
const theme = (accent: string, bg: string): UiTheme => ({
	family: ARIAL_BLACK,
	size: 26,
	detailSize: 13,
	radius: 4,
	caps: true,
	borderWidth: 3,
	idle: { fill: 'rgba(255,255,255,0.04)', text: WHITE, border: accent, detail: 'rgba(255,255,255,0.7)' },
	hover: { fill: accent, text: WHITE, border: WHITE, detail: 'rgba(255,255,255,0.9)' },
	primary: { fill: accent, text: WHITE, border: accent, detail: 'rgba(255,255,255,0.9)' },
	chosen: { fill: WHITE, text: bg, border: WHITE },
	disabled: { fill: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.2)' }
});

class Ball {
	size = 20; y_speed = 0; x_speed = 0; x = 260; y = 330;
	boundary = new Rect(this.x, this.y, this.size, this.size);
}

class Paddle {
	sizeW = 150; sizeH = 15; x = 200; y = 600; x_speed = 0;
}

// ── Brick Breaker pieces ──
const BB_R = 10; // ball radius
const BB_SPEED = 4.6; // px per tick at the start…
const BB_MAX_SPEED = 7.5; // …rising a little with every brick
const BB_SHIELD_Y = 634;
/** The wall is one colour: orange at first, then a new colour every 10 bricks (hues, in order). */
const BRICK_HUES = [30, 50, 140, 195, 275];
const brickColor = (hue: number) => `hsl(${hue.toFixed(0)},95%,58%)`;

type PowerKind = 'wide' | 'multi' | 'slow' | 'laser' | 'shield';
const POWERS: Record<PowerKind, { name: string; letter: string; color: string; weight: number }> = {
	wide: { name: 'Wide paddle', letter: 'W', color: 'rgb(46,170,90)', weight: 25 },
	multi: { name: 'Multi-ball', letter: 'M', color: 'rgb(150,80,230)', weight: 20 },
	slow: { name: 'Slow-mo', letter: 'S', color: 'rgb(20,160,200)', weight: 20 },
	laser: { name: 'Lasers', letter: 'L', color: 'rgb(225,50,60)', weight: 15 },
	shield: { name: 'Shield', letter: 'B', color: 'rgb(30,120,220)', weight: 20 }
};
function pickPower(): PowerKind {
	const kinds = Object.keys(POWERS) as PowerKind[];
	let r = Math.random() * kinds.reduce((s, k) => s + POWERS[k].weight, 0);
	for (const k of kinds) if ((r -= POWERS[k].weight) < 0) return k;
	return 'wide';
}

interface BBall { x: number; y: number; vx: number; vy: number; out?: boolean }
interface BBrick { x: number; y: number; w: number; h: number; row: number; alive: boolean }
interface Breakout {
	balls: BBall[];
	bricks: BBrick[];
	caps: { x: number; y: number; kind: PowerKind }[];
	shots: { x: number; y: number }[];
	parts: { x: number; y: number; vx: number; vy: number; life: number; color: string }[];
	/** Ticks left on each timed power-up; shield is 1 until it saves a ball. */
	wide: number;
	slow: number;
	laser: number;
	shield: number;
	ticks: number;
	lastShot: number;
	/** The wall's current hue (eases to the next one as bricks fall). */
	hue: number;
	flash: { text: string; ticks: number } | null;
}
/** The original layout: 50 bricks, 10 to a row, 55 px apart, rows 35 px apart. */
function newBreakout(): Breakout {
	const bricks: BBrick[] = [];
	for (let i = 0; i < 50; i++) bricks.push({ x: 3 + (i % 10) * 55, y: 35 + Math.floor(i / 10) * 35, w: 50, h: 30, row: Math.floor(i / 10), alive: true });
	return {
		balls: [{ x: 275, y: 600 - BB_R, vx: 0, vy: 0 }], bricks, caps: [], shots: [], parts: [],
		wide: 0, slow: 0, laser: 0, shield: 0, ticks: 0, lastShot: -99, flash: null, hue: BRICK_HUES[0]
	};
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
	ball = new Ball();
	paddle = new Paddle();
	delay = 0;

	onQuit = () => {};
	onScore: (board: number, score: number) => void = () => {};
	/** Sound effects (set by the host). */
	sfx: (name: string) => void = () => {};
	/** Soundtrack: menus; Pong speeds up with each stage; Brick Breaker has its own. */
	musicTrack() {
		if (this.game == 0 || this.game == 3) return 'pong-menu';
		if (this.game == 1) return this.mode == 2 ? 'pong-brick' : 'pong-' + this.difficulty;
		return null;
	}
	/** Serve only before the ball is in play; it comes back once the game is over. */
	disabledButtons() {
		// (Brick Breaker's lasers fire with Space too.)
		return this.game == 1 && this.start == 1 && !(this.mode == 2 && this.bb.laser > 0) ? ['Space'] : [];
	}
	global: Board | null = null;
	loggedIn = false;

	private g = new Gfx();

	constructor(private img: Images) {
		loadArcadeFont();
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

	// ── Menus: drawn buttons, clicked or tapped ──
	// A Pong / Brick Breaker switch sits at the top of the main menu and the high scores screen.
	private hover: string | null = null;

	private ui(): UiButton[] {
		const modes: UiButton[] = [
			{ id: 'mode1', label: 'Pong', x: 95, y: 240, w: 176, h: 44, size: 15, chosen: this.mode == 1, onClick: () => { if (this.mode != 1) this.switchMode(); } },
			{ id: 'mode2', label: 'Brick Breaker', x: 279, y: 240, w: 176, h: 44, size: 15, chosen: this.mode == 2, onClick: () => { if (this.mode != 2) this.switchMode(); } }
		];
		if (this.game == 0) {
			const rows: [string, string | undefined, () => void][] = [
				['Play', this.mode == 1 ? 'Keep the ball in play' : 'Clear all 50 bricks', () => this.play()],
				['High Scores', undefined, () => (this.game = 3)],
				['Exit Game', undefined, () => { this.save(); this.onQuit(); }]
			];
			return [
				...modes,
				...rows.map(([label, detail, onClick], i): UiButton => ({
					id: 'main' + i, label, detail, x: 95, y: 312 + i * 88, w: 360, h: 70, kind: i == 0 ? 'primary' : undefined, onClick
				}))
			];
		}
		if (this.game == 3) {
			return [{ id: 'back', label: '‹ Back', x: 16, y: 16, w: 110, h: 40, size: 16, onClick: () => (this.game = 0) }, ...modes];
		}
		return [];
	}
	pointerMove(x: number, y: number) {
		const b = buttonAt(this.ui(), x, y);
		this.hover = b?.id ?? null;
		return !!b;
	}
	pointerDown(x: number, y: number) {
		// Game over: a click does what Enter does.
		if (this.game == 2) {
			this.keyPressed('Enter');
			return;
		}
		const b = buttonAt(this.ui(), x, y);
		if (!b) return;
		this.sfx('confirm');
		b.onClick();
		this.hover = null;
	}

	private paintMenus(ctx: CanvasRenderingContext2D) {
		const pong = this.mode == 1;
		const bg = pong ? BLACK : Blue;
		const accent = pong ? Red : Orange;
		// The art's logo, with its painted-on buttons covered; drawn buttons replace them.
		this.g.img(pong ? this.img.PongMM : this.img.BrickMM, 0, 0, 550, 700);
		ctx.fillStyle = bg;
		ctx.fillRect(0, 225, 550, 475);
		if (this.game == 3) {
			// Stats for the game picked in the switch.
			const rows: [string, number][] = pong
				? [['High score', this.highscore], ['Games played', this.pgp], ['Balls hit', this.pbh]]
				: [['High score', this.bhighscore], ['Games played', this.bgp], ['Bricks broken', this.bbb]];
			panel(ctx, 60, 312, 430, 196, { fill: 'rgba(255,255,255,0.05)', border: accent, width: 2, radius: 6 });
			rows.forEach(([k, v], i) => {
				const y = 352 + i * 58;
				text(ctx, k.toUpperCase(), 88, y, { size: 18, family: ARIAL_BLACK, color: WHITE });
				text(ctx, '' + v, 462, y, { size: 24, family: ARIAL_BLACK, color: WHITE, align: 'right' });
			});
			text(ctx, 'GLOBAL RECORD', 60, 540, { size: 13, family: ARIAL_BLACK, color: pong ? 'rgb(255,120,120)' : 'rgb(255,190,110)' });
			drawRecord(this.g, {
				global: this.global, board: this.mode, local: pong ? this.highscore : this.bhighscore, loggedIn: this.loggedIn,
				x: 60, y: 566, family: ARIAL, color: WHITE, dim: 'rgb(190,200,230)', size: 15, rows: 3
			});
		}
		drawButtons(ctx, this.ui(), theme(accent, bg), this.hover);
	}

	private play() {
		if (this.mode == 2) this.newBricks();
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
		if (this.game == 1 && this.mode == 2) {
			if (left) this.paddle.x_speed = -7;
			if (right) this.paddle.x_speed = 7;
			if (space) this.bbSpace();
		} else if (this.game == 1) {
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
			this.newBricks();
			ball.x = 280;
			ball.y = 570;
		}
		this.save();
	}

	// ── Game loop: run() moves things, then the collision logic that Java kept in paintComponent ──
	tick() {
		const before = this.game;
		const was = { bdx: this.bdx, bdy: this.bdy, b2dx: this.b2dx, b2dy: this.b2dy, counter: this.counter, score: this.score, level: this.difficulty };
		// Brick Breaker plays its own sounds as things happen.
		if (this.mode == 2 && this.game == 1) this.stepBrick();
		else this.run();
		if (this.mode == 1 && (this.game == 1 || this.game == 2)) this.logic();
		// Sounds, from what this step changed.
		if (this.game == 1 && this.mode == 1) {
			if (this.score > was.score) this.sfx('paddle');
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
	}

	// ── Brick Breaker (rewritten): real ball physics and power-ups ──
	// Balls move in small steps (no passing through bricks), bounce off the side of a brick they
	// actually hit, and leave the paddle at an angle set by where they land on it. Broken bricks
	// sometimes drop a power-up capsule; catch it with the paddle.
	private bb = newBreakout();

	/** A fresh wall of bricks and a ball resting on the paddle. */
	private newBricks() {
		this.bb = newBreakout();
		this.counter = 0;
		this.delay = 0;
		this.paddle.sizeW = 150;
		this.paddle.x = 200;
	}

	private bbSpeed() {
		const base = Math.min(BB_MAX_SPEED, BB_SPEED + this.counter * 0.06);
		return this.bb.slow > 0 ? base * 0.65 : base;
	}

	/** Space in Brick Breaker: serve, or fire the lasers while they're powered up. */
	private bbSpace() {
		const bb = this.bb;
		if (this.start == 0) {
			this.start = 1;
			this.sfx('serve');
			const a = (Math.random() - 0.5) * 0.8;
			const s = this.bbSpeed();
			for (const b of bb.balls) {
				b.vx = s * Math.sin(a);
				b.vy = -s * Math.cos(a);
			}
		} else if (bb.laser > 0 && bb.ticks - bb.lastShot >= 22) {
			bb.lastShot = bb.ticks;
			const p = this.paddle;
			bb.shots.push({ x: p.x + 8, y: p.y - 4 }, { x: p.x + p.sizeW - 10, y: p.y - 4 });
			this.sfx('wall');
		}
	}

	private stepBrick() {
		const bb = this.bb;
		const p = this.paddle;
		bb.ticks++;
		// Paddle: move, and grow or shrink smoothly to its width.
		p.x += p.x_speed;
		const target = bb.wide > 0 ? 220 : 150;
		if (p.sizeW != target) {
			const c = p.x + p.sizeW / 2;
			p.sizeW += Math.sign(target - p.sizeW) * Math.min(4, Math.abs(target - p.sizeW));
			p.x = c - p.sizeW / 2;
		}
		p.x = Math.max(0, Math.min(550 - p.sizeW, p.x));
		for (const k of ['wide', 'slow', 'laser'] as const) if (bb[k] > 0) bb[k]--;
		const hue = BRICK_HUES[Math.min(BRICK_HUES.length - 1, Math.floor(this.counter / 10))];
		bb.hue += Math.sign(hue - bb.hue) * Math.min(1.5, Math.abs(hue - bb.hue));

		// All bricks gone: a moment to enjoy it, then the end screen.
		if (this.counter == this.numBricks) {
			if (++this.delay >= 50) {
				this.game = 2;
				this.delay = 0;
			}
			return;
		}

		if (this.start == 0) {
			// Waiting to serve: the ball rides on the paddle.
			const b = bb.balls[0];
			b.x = p.x + p.sizeW / 2;
			b.y = p.y - BB_R;
		} else {
			const speed = this.bbSpeed();
			const steps = Math.ceil(speed / 3);
			for (const b of bb.balls) {
				for (let s = 0; s < steps && !b.out; s++) this.moveBall(b, speed, steps);
			}
			bb.balls = bb.balls.filter((b) => !b.out);
			if (bb.balls.length == 0) {
				this.game = 2;
				return;
			}
		}

		// Capsules fall; the paddle catches them.
		for (const c of bb.caps) {
			c.y += 2.4;
			if (c.y + 9 >= p.y && c.y - 9 <= p.y + p.sizeH && c.x + 18 >= p.x && c.x - 18 <= p.x + p.sizeW) {
				c.y = 999;
				this.powerUp(c.kind);
			}
		}
		bb.caps = bb.caps.filter((c) => c.y < 690);

		// Laser shots.
		for (const s of bb.shots) {
			s.y -= 9;
			const hit = bb.bricks.find((br) => br.alive && s.x >= br.x && s.x <= br.x + br.w && s.y <= br.y + br.h && s.y + 12 >= br.y);
			if (hit) {
				this.breakBrick(hit);
				s.y = -99;
			}
		}
		bb.shots = bb.shots.filter((s) => s.y > -20);

		for (const pt of bb.parts) {
			pt.x += pt.vx;
			pt.y += pt.vy;
			pt.vy += 0.15;
			pt.life--;
		}
		bb.parts = bb.parts.filter((pt) => pt.life > 0);
	}

	/** One small step of one ball: walls, paddle, shield, then at most one brick. */
	private moveBall(b: BBall, speed: number, steps: number) {
		const bb = this.bb;
		const p = this.paddle;
		// Keep the speed (it changes with slow-mo and as bricks fall) and never let the ball
		// settle into a near-flat path.
		const len = Math.hypot(b.vx, b.vy) || 1;
		b.vx = (b.vx / len) * speed;
		b.vy = (b.vy / len) * speed;
		if (Math.abs(b.vy) < speed * 0.3) {
			b.vy = Math.sign(b.vy || -1) * speed * 0.3;
			b.vx = Math.sign(b.vx || 1) * Math.sqrt(speed * speed - b.vy * b.vy);
		}
		const px = b.x, py = b.y;
		b.x += b.vx / steps;
		b.y += b.vy / steps;

		if (b.x < BB_R) { b.x = BB_R; b.vx = Math.abs(b.vx); this.sfx('wall'); }
		if (b.x > 550 - BB_R) { b.x = 550 - BB_R; b.vx = -Math.abs(b.vx); this.sfx('wall'); }
		if (b.y < BB_R) { b.y = BB_R; b.vy = Math.abs(b.vy); this.sfx('wall'); }

		// Paddle: the further from the middle it lands, the steeper it leaves (up to 60°).
		if (b.vy > 0 && b.y + BB_R >= p.y && py + BB_R <= p.y + 6 && b.x >= p.x - BB_R && b.x <= p.x + p.sizeW + BB_R) {
			const off = Math.max(-1, Math.min(1, (b.x - (p.x + p.sizeW / 2)) / (p.sizeW / 2)));
			const a = off * 1.05;
			b.vx = speed * Math.sin(a);
			b.vy = -speed * Math.cos(a);
			b.y = p.y - BB_R;
			this.sfx('paddle');
		}
		// The shield power-up catches one ball that gets past the paddle.
		if (bb.shield > 0 && b.vy > 0 && b.y + BB_R >= BB_SHIELD_Y) {
			b.y = BB_SHIELD_Y - BB_R;
			b.vy = -Math.abs(b.vy);
			bb.shield = 0;
			this.sfx('wall');
		}
		if (b.y - BB_R > 670) {
			b.out = true;
			return;
		}

		// Bricks: the nearest one the ball touches. It bounces off the side it came in from.
		for (const br of bb.bricks) {
			if (!br.alive) continue;
			const cx = Math.max(br.x, Math.min(b.x, br.x + br.w));
			const cy = Math.max(br.y, Math.min(b.y, br.y + br.h));
			if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BB_R * BB_R) continue;
			const fromSide = px + BB_R <= br.x || px - BB_R >= br.x + br.w;
			const fromTopOrBottom = py + BB_R <= br.y || py - BB_R >= br.y + br.h;
			if (fromSide && !fromTopOrBottom) {
				b.vx = -b.vx;
				b.x = px;
			} else {
				b.vy = -b.vy;
				b.y = py;
			}
			this.breakBrick(br);
			break;
		}
	}

	private breakBrick(br: BBrick) {
		const bb = this.bb;
		br.alive = false;
		this.counter++;
		this.bbb++;
		this.bscore += 10;
		if (this.bscore > this.bhighscore) this.bhighscore = this.bscore;
		this.sfx('brick');
		for (let i = 0; i < 8; i++) {
			bb.parts.push({
				x: br.x + Math.random() * br.w, y: br.y + Math.random() * br.h,
				vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.8) * 3, life: 30 + Math.random() * 15, color: brickColor(bb.hue)
			});
		}
		// About one brick in five drops a power-up.
		if (Math.random() < 0.2 && this.counter < this.numBricks) {
			bb.caps.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, kind: pickPower() });
		}
	}

	private powerUp(kind: PowerKind) {
		const bb = this.bb;
		this.sfx('levelUp');
		bb.flash = { text: POWERS[kind].name, ticks: 90 };
		if (kind == 'wide') bb.wide = 1200;
		if (kind == 'slow') bb.slow = 1000;
		if (kind == 'laser') bb.laser = 1000;
		if (kind == 'shield') bb.shield = 1;
		if (kind == 'multi') {
			// Every ball splits in three (up to 6 balls).
			const more: BBall[] = [];
			for (const b of bb.balls) {
				for (const turn of [-0.4, 0.4]) {
					if (bb.balls.length + more.length >= 6) break;
					const c = Math.cos(turn), s = Math.sin(turn);
					more.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c });
				}
			}
			bb.balls.push(...more);
		}
	}

	private paintBricks(ctx: CanvasRenderingContext2D) {
		const bb = this.bb;
		const p = this.paddle;
		const sky = ctx.createLinearGradient(0, 0, 0, 670);
		sky.addColorStop(0, 'rgb(22,44,180)');
		sky.addColorStop(1, 'rgb(8,18,92)');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, 550, 700);

		// Bricks: one colour for the whole wall, with a light top edge and a shaded bottom.
		const col = brickColor(bb.hue);
		for (const br of bb.bricks) {
			if (!br.alive) continue;
			roundRect(ctx, br.x, br.y, br.w, br.h, 5);
			ctx.fillStyle = col;
			ctx.fill();
			ctx.fillStyle = 'rgba(255,255,255,0.35)';
			ctx.fillRect(br.x + 4, br.y + 3, br.w - 8, 4);
			ctx.fillStyle = 'rgba(0,0,0,0.22)';
			ctx.fillRect(br.x + 3, br.y + br.h - 6, br.w - 6, 4);
		}
		for (const pt of bb.parts) {
			ctx.globalAlpha = Math.min(1, pt.life / 25);
			ctx.fillStyle = pt.color;
			ctx.fillRect(pt.x, pt.y, 4, 4);
		}
		ctx.globalAlpha = 1;

		// Capsules.
		for (const c of bb.caps) {
			const info = POWERS[c.kind];
			roundRect(ctx, c.x - 20, c.y - 10, 40, 20, 10);
			ctx.fillStyle = info.color;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = 'rgba(255,255,255,0.85)';
			ctx.stroke();
			text(ctx, info.letter, c.x, c.y + 1, { size: 12, family: ARIAL_BLACK, color: WHITE, align: 'center' });
		}

		// Shield, lasers.
		if (bb.shield > 0) {
			ctx.save();
			ctx.shadowColor = 'rgb(90,230,255)';
			ctx.shadowBlur = 12;
			ctx.fillStyle = 'rgb(140,240,255)';
			ctx.fillRect(0, BB_SHIELD_Y, 550, 4);
			ctx.restore();
		}
		ctx.save();
		ctx.shadowColor = 'rgb(255,80,80)';
		ctx.shadowBlur = 8;
		ctx.fillStyle = 'rgb(255,140,120)';
		for (const s of bb.shots) ctx.fillRect(s.x - 1.5, s.y, 3, 12);
		ctx.restore();

		// Paddle (with laser cannons while they last).
		if (bb.laser > 0) {
			ctx.fillStyle = 'rgb(255,90,90)';
			ctx.fillRect(p.x + 4, p.y - 7, 8, 8);
			ctx.fillRect(p.x + p.sizeW - 12, p.y - 7, 8, 8);
		}
		const pg = ctx.createLinearGradient(0, p.y, 0, p.y + p.sizeH);
		pg.addColorStop(0, WHITE);
		pg.addColorStop(1, 'rgb(190,200,230)');
		roundRect(ctx, p.x, p.y, p.sizeW, p.sizeH, 7);
		ctx.fillStyle = pg;
		ctx.fill();
		ctx.fillStyle = Orange;
		ctx.fillRect(p.x + p.sizeW / 2 - 12, p.y + 5, 24, 5);

		// Balls, with a soft glow.
		ctx.save();
		ctx.shadowColor = 'rgba(255,255,255,0.9)';
		ctx.shadowBlur = 10;
		ctx.fillStyle = WHITE;
		for (const b of bb.balls) {
			ctx.beginPath();
			ctx.arc(b.x, b.y, BB_R, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();

		// Score, and the power-ups running out.
		text(ctx, '' + this.bscore, 20, 654, { size: 22, family: ARIAL_BLACK, color: Orange });
		text(ctx, 'Best ' + this.bhighscore, 20 + 16 + 14 * ('' + this.bscore).length, 656, { size: 13, family: ARIAL_BLACK, color: 'rgb(255,200,140)' });
		let cx = 530;
		for (const k of ['laser', 'slow', 'wide'] as const) {
			if (bb[k] <= 0) continue;
			const label = `${POWERS[k].name} ${Math.ceil(bb[k] / 100)}s`;
			ctx.save();
			ctx.font = `bold 12px ${ARIAL_BLACK}`;
			const w = ctx.measureText(label).width + 18;
			ctx.restore();
			cx -= w;
			roundRect(ctx, cx, 643, w - 6, 22, 11);
			ctx.fillStyle = POWERS[k].color;
			ctx.fill();
			text(ctx, label, cx + (w - 6) / 2, 655, { size: 12, family: ARIAL_BLACK, color: WHITE, align: 'center' });
		}
		if (bb.flash && bb.flash.ticks > 0) {
			bb.flash.ticks--;
			ctx.globalAlpha = Math.min(1, bb.flash.ticks / 30);
			text(ctx, bb.flash.text.toUpperCase() + '!', 275, 360, { size: 28, family: ARIAL_BLACK, color: WHITE, align: 'center' });
			ctx.globalAlpha = 1;
		}
		if (this.start == 0) {
			text(ctx, touchScreen() ? 'Tap Serve to play' : 'Press Space to Play', 275, 470, { size: 20, family: ARIAL_BLACK, color: WHITE, align: 'center' });
			text(ctx, 'Catch falling capsules for power-ups', 275, 500, { size: 13, family: ARIAL, color: 'rgba(255,255,255,0.75)', align: 'center', bold: false });
		}
	}

	// ── Drawing (paintComponent) ──
	paint(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		const { paddle, ball, img } = this;
		g.begin(ctx);
		ctx.fillStyle = BLACK;
		ctx.fillRect(0, 0, GAME_W, GAME_H);

		if (this.game == 0 || this.game == 3) this.paintMenus(ctx);

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
			if (this.mode == 2) this.paintBricks(ctx);
			if (this.mode == 1 && this.start == 0) {
				g.setColor(WHITE);
				g.font(20, ARIAL_BLACK);
				g.drawString('Press Space to Play', 160, this.mode == 1 ? 380 : 650);
			}
			if (this.mode == 1) {
				g.setColor(WHITE);
				g.fillRect(paddle.x, paddle.y, paddle.sizeW, paddle.sizeH);
				g.fillOval(ball.x, ball.y, ball.size, ball.size);
			}
			g.setColor(WHITE);
			// Game over: the title drops in (as before), centred, then the score and how to go on.
			if (this.game == 2) {
				const won = this.mode == 2 && this.counter == this.numBricks;
				const score = this.mode == 1 ? this.score : this.bscore;
				drawGameOver(ctx, {
					width: GAME_W, height: GAME_H, y: this.goy - 30, landed: this.goy >= 350, title: won ? 'YOU WIN!' : 'GAME OVER',
					color: won ? 'rgb(90,230,120)' : this.mode == 1 ? 'rgb(255,60,60)' : Orange,
					lines: [`SCORE ${score}`, `BEST ${this.mode == 1 ? this.highscore : this.bhighscore}`, touchScreen() ? 'TAP TO RETURN TO THE MENU' : 'PRESS ENTER FOR THE MENU']
				});
			}
		}


	}
}
