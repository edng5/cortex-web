// Fishy (Fishy.java), ported to TypeScript. The game, its menus (clicked, as in the original) and
// its numbers are Edward's; the changes:
//  - Collisions are pixel-perfect: two fish only touch where both sprites have solid pixels, not
//    wherever their bounding boxes overlap (the Java version compared corner points of boxes).
//    And a bigger fish only eats you if you run into its mouth (the front), not its body or tail.
//  - Single player moves with WASD or the arrow keys (so either on-screen joystick works on
//    phones); in multiplayer, player 1 has WASD and player 2 the arrow keys, as before.
//  - A moment of safety after losing a life, so you can't be eaten again where you respawn.
import { COMIC, Gfx, Mask, buttonAt, drawButtons, drawRecord, keyRow, loadImages, loadSave, padlock, panel, pips, pixelsTouch, text, writeSave, type ArcadeGame, type Board, type Sprite, type UiButton, type UiTheme } from '../common';
import { Room, myRating, type Rating, type RoomEvent } from '../net';

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
const MENU_SCREENS = [0, 3, 4, 5, 12, 13, 16, 17, 18];
/** Online: the host's fish positions for the guest (`p` the players, `e` the CPU fish). */
interface Snapshot {
	k: 2;
	p: number[];
	e: number[];
}
/** WASD or the arrows, as directions (online: either set moves your fish). */
const DIRS: Record<string, 'L' | 'R' | 'U' | 'D'> = { KeyA: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R', KeyW: 'U', ArrowUp: 'U', KeyS: 'D', ArrowDown: 'D' };
/** A move from the other player: only -1, 0 or 1. */
const clampMove = (v: unknown) => (v === 1 ? 1 : v === -1 ? -1 : 0);
/** `game` while a game is paused. */
const PAUSED = 14;

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
		if ([0, 3, 4, 5, 6, 9, 12, 13, 16, 17, 18].includes(this.game)) return 'fishy-menu';
		const mode = this.game == PAUSED ? this.pausedFrom : this.game;
		if (mode == 1) return 'fishy-' + this.difficulty;
		if (mode == 2) return 'fishy-2p';
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
		// Online: leaving the game leaves the room (a game in progress counts as lost).
		this.net?.room.leave();
		this.net = null;
		// Single player mid-game (or paused): the high score is already kept live; send it to the board too.
		const mode = this.game == PAUSED ? this.pausedFrom : this.game;
		if (mode == 1 && this.score > 0) this.onScore(this.difficulty, this.score);
		this.save();
	}

	// ── Pause: Enter or P (or the pause button) during a game ──
	/** The mode that was paused (1 single player, 2 multiplayer). */
	private pausedFrom = 1;
	private pause() {
		this.pausedFrom = this.game;
		this.game = PAUSED;
		this.dx = 0; this.dy = 0; this.mdx = 0; this.mdy = 0;
	}
	private resume() {
		this.game = this.pausedFrom;
	}
	/** Ends the paused run: single player scores count, as they do when a game ends. */
	private endRun() {
		if (this.pausedFrom == 1 && this.score > 0) this.onScore(this.difficulty, this.score);
		this.playAgain(); // resets the fish and goes to the title screen
	}
	/** Touch screens: Pause only during a game. */
	hiddenButtons() {
		return (this.game == 1 || this.game == 2 || this.game == PAUSED) && !this.net ? [] : ['Enter'];
	}

	// ── Online multiplayer (room codes) ──
	// The host (who made the room) runs the game in their browser as Player 1 and sends the fish
	// positions to the guest ~25 times a second; the guest is Player 2 and sends their key presses
	// to the host. The room (on the site's server, over HTTPS, for the two signed-in players only)
	// passes the messages on and records who won, for both players' ratings.
	// Screens: 16 the Multiplayer menu, 17 typing a room code, 18 waiting in a room.
	private net: {
		room: Room;
		code: string;
		role: 0 | 1;
		opponent: string;
		opponentOnline: boolean;
		end: { winner: number | null; delta: number; mmr: number } | null;
		theyWantRematch: boolean;
		iWantRematch: boolean;
	} | null = null;
	private netNote = '';
	private codeDraft = '';
	private rating: Rating | null = null;
	private snapTimer = 0;
	/** Guest: where the host says the fish are (the guest eases towards it). */
	private target: Snapshot | null = null;

	private openMultiplayer() {
		this.game = 16;
		this.netNote = '';
		if (this.loggedIn) myRating('fishy').then((r) => (this.rating = r));
	}
	private async createRoom() {
		this.netNote = 'Making a room…';
		const r = await Room.create('fishy');
		if ('error' in r) return void (this.netNote = r.error);
		this.enterRoom(r.code, 0);
	}
	private async joinRoom() {
		this.netNote = 'Joining…';
		const r = await Room.join(this.codeDraft, 'fishy');
		if ('error' in r) return void (this.netNote = r.error);
		this.enterRoom(this.codeDraft, r.seat as 0 | 1);
	}
	private enterRoom(code: string, role: 0 | 1) {
		const room = new Room(code, (e) => this.onRoomEvent(e));
		this.net = { room, code, role, opponent: '', opponentOnline: true, end: null, theyWantRematch: false, iWantRematch: false };
		this.netNote = '';
		this.game = 18;
		room.listen();
	}
	private leaveRoom(note = '') {
		this.net?.room.leave();
		this.net = null;
		this.target = null;
		this.resetFish();
		this.netNote = note;
		this.game = 16;
		if (this.loggedIn) myRating('fishy').then((r) => (this.rating = r));
	}

	private onRoomEvent(e: RoomEvent) {
		const net = this.net;
		if (!net) return;
		if (e.t == 'room') {
			const players = e.players as ({ name: string; online: boolean } | null)[];
			const them = players[1 - net.role];
			net.opponent = them?.name ?? '';
			net.opponentOnline = them?.online ?? false;
			// A new round (the second player joined, or both asked for a rematch): start it.
			if (e.phase == 'playing' && (this.game == 18 || ((this.game == 10 || this.game == 11) && e.round != this.round))) {
				this.round = e.round as number;
				this.resetFish();
				net.end = null;
				net.iWantRematch = net.theyWantRematch = false;
				this.target = null;
				this.game = 2;
				this.sfx('confirm');
			}
		} else if (e.t == 'relay') {
			const msg = e.msg as Record<string, number>;
			if (net.role == 0 && msg.k == 1 && this.game == 2) {
				// The guest's keys move Player 2.
				this.dx = clampMove(msg.dx);
				this.dy = clampMove(msg.dy);
				if (msg.d == 1 || msg.d == 2) this.direction2 = msg.d;
			} else if (net.role == 1 && msg.k == 2) this.applySnapshot(msg as unknown as Snapshot);
		} else if (e.t == 'end') {
			const ratings = e.ratings as { mmr: number; delta: number }[];
			const winner = e.winner as number | null;
			net.end = { winner, delta: ratings[net.role].delta, mmr: ratings[net.role].mmr };
			// Player 1 is the host.
			this.game = winner == 1 ? 11 : 10;
			this.whoWon = 0; // (online wins count in the rating, not the same-keyboard tally)
			this.sfx(winner == net.role ? 'win' : 'lose');
		} else if (e.t == 'rematch') {
			if (e.seat != net.role) net.theyWantRematch = true;
		} else if (e.t == 'presence') {
			if (e.seat != net.role) net.opponentOnline = !!e.online;
		} else if (e.t == 'left') {
			this.leaveRoom('Your opponent left the room.');
		} else if (e.t == 'closed') {
			if (this.net) this.leaveRoom(this.game == 18 ? 'The room was closed.' : 'The room closed.');
		}
	}
	private round = 0;

	/** Host: the fish (both players and the CPU fish) for the guest. */
	private sendSnapshot() {
		const r = Math.round;
		const s: Snapshot = {
			k: 2,
			p: [r(this.x2), r(this.y2), this.fishw2, this.fishh2, this.direction, r(this.x3), r(this.y3), this.fishw3, this.fishh3, this.direction2],
			e: [...this.enemiesxR, ...this.enemiesy1, ...this.enemiesw, ...this.enemiesh, ...this.enemiesxL, ...this.enemiesy2, ...this.enemiesw2, ...this.enemiesh2].map(r)
		};
		void this.net!.room.send({ type: 'relay', msg: s });
	}
	/** Guest: take the host's fish positions (sizes and facing at once; positions eased in tick). */
	private applySnapshot(s: Snapshot) {
		if (!Array.isArray(s.p) || s.p.length != 10 || !Array.isArray(s.e) || s.e.length != 32) return;
		const [, , w2, , d1, , , w3, , d2] = s.p;
		if (this.target) {
			if (w2 > this.fishw2 || w3 > this.fishw3) this.sfx('eat');
			else if (w2 < this.fishw2 || w3 < this.fishw3) this.sfx('eaten');
		}
		[, , this.fishw2, this.fishh2] = s.p;
		[, , , , , , , this.fishw3, this.fishh3] = s.p;
		this.direction = d1;
		this.direction2 = d2;
		[this.enemiesw, this.enemiesh, this.enemiesw2, this.enemiesh2] = [s.e.slice(8, 12), s.e.slice(12, 16), s.e.slice(24, 28), s.e.slice(28, 32)];
		if (!this.target) this.placeAt(s, 1);
		this.target = s;
	}
	/** Guest: move the fish `f` of the way to the host's positions (1 = all the way). */
	private placeAt(s: Snapshot, f: number) {
		const ease = (a: number, b: number) => (Math.abs(b - a) > 120 ? b : a + (b - a) * f);
		this.x2 = ease(this.x2, s.p[0]);
		this.y2 = ease(this.y2, s.p[1]);
		this.x3 = ease(this.x3, s.p[5]);
		this.y3 = ease(this.y3, s.p[6]);
		for (let a = 0; a < 4; a++) {
			this.enemiesxR[a] = ease(this.enemiesxR[a], s.e[a]);
			this.enemiesy1[a] = ease(this.enemiesy1[a], s.e[4 + a]);
			this.enemiesxL[a] = ease(this.enemiesxL[a], s.e[16 + a]);
			this.enemiesy2[a] = ease(this.enemiesy2[a], s.e[20 + a]);
		}
	}
	/** Guest: tell the host which way Player 2 is swimming. */
	private sendInput() {
		const h = this.guestKeys;
		const dx = (h.has('R') ? 1 : 0) - (h.has('L') ? 1 : 0);
		const dy = (h.has('D') ? 1 : 0) - (h.has('U') ? 1 : 0);
		if (dx) this.direction2 = dx < 0 ? 2 : 1;
		void this.net!.room.send({ type: 'relay', msg: { k: 1, dx, dy, d: this.direction2 } });
	}
	private guestKeys = new Set<'L' | 'R' | 'U' | 'D'>();

	/** Typing a room code on screen 17 (keyboard digits work too). */
	private typeCode(ch: string) {
		this.netNote = '';
		if (ch == '⌫') this.codeDraft = this.codeDraft.slice(0, -1);
		else if (/\d/.test(ch) && this.codeDraft.length < 6) this.codeDraft += ch;
		this.sfx('select');
	}

	private onlineButtons(): UiButton[] {
		const back: UiButton = { id: 'back', x: 20, y: 18, w: 128, h: 46, label: '‹ Back', size: 22, onClick: () => (this.game = 0) };
		if (this.game == 16) {
			const needLogin = !this.loggedIn;
			return [
				back,
				{ id: 'local', x: 300, y: 170, w: 300, h: 64, label: 'Same keyboard', detail: '2 players on this device', onClick: () => (this.game = 2) },
				{ id: 'create', x: 300, y: 250, w: 300, h: 64, label: 'Create online room', detail: needLogin ? 'Log in to play online' : 'Get a code for a friend', kind: 'primary', disabled: needLogin, onClick: () => this.createRoom() },
				{ id: 'join', x: 300, y: 330, w: 300, h: 64, label: 'Join with a code', detail: needLogin ? 'Log in to play online' : "Type your friend's code", disabled: needLogin, onClick: () => { this.codeDraft = ''; this.netNote = ''; this.game = 17; } }
			];
		}
		if (this.game == 17) {
			const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Join'];
			return [
				{ ...back, onClick: () => (this.game = 16) },
				...keys.map((k, i): UiButton => ({
					id: 'key' + k, label: k, x: 330 + (i % 3) * 84, y: 250 + Math.floor(i / 3) * 70, w: 72, h: 58, size: k == 'Join' ? 20 : 26,
					kind: k == 'Join' ? 'primary' : undefined,
					disabled: k == 'Join' && this.codeDraft.length != 6,
					onClick: () => (k == 'Join' ? this.joinRoom() : this.typeCode(k))
				}))
			];
		}
		if (this.game == 18) return [{ id: 'cancel', x: 375, y: 470, w: 150, h: 50, label: 'Cancel', onClick: () => this.leaveRoom() }];
		if ((this.game == 10 || this.game == 11) && this.net?.end) {
			const n = this.net;
			return [
				{ id: 'rematch', x: 300, y: 560, w: 145, h: 50, label: n.iWantRematch ? 'Waiting…' : n.theyWantRematch ? 'Accept' : 'Rematch', kind: 'primary', disabled: n.iWantRematch, onClick: () => { n.iWantRematch = true; void n.room.send({ type: 'rematch' }); } },
				{ id: 'leave', x: 455, y: 560, w: 145, h: 50, label: 'Leave', onClick: () => this.leaveRoom() }
			];
		}
		return [];
	}

	/** The online screens and overlays, drawn over the sea / the game. */
	private paintOnline(ctx: CanvasRenderingContext2D) {
		const g = this.g;
		if (this.game == 16 || this.game == 17 || this.game == 18) {
			g.img(this.img.Sea, 0, 0, 900, 700);
			const title = (s: string) => text(ctx, s, 450, 46, { size: 40, family: COMIC, color: INK, align: 'center' });
			if (this.game == 16) {
				title('Multiplayer');
				if (this.loggedIn && this.rating) {
					panel(ctx, 300, 420, 300, 70, { fill: CARD, border: 'rgba(255,255,255,0.95)', radius: 18 });
					text(ctx, `Online: ${this.rating.wins} W · ${this.rating.losses} L`, 450, 442, { size: 18, family: COMIC, color: INK, align: 'center' });
					text(ctx, `Rating ${this.rating.mmr} (only you can see it)`, 450, 470, { size: 15, family: COMIC, color: INK_SOFT, align: 'center', bold: false });
				}
			}
			if (this.game == 17) {
				title('Join a room');
				for (let i = 0; i < 6; i++) {
					panel(ctx, 300 + i * 52, 150, 44, 60, { fill: 'rgba(255,255,255,0.85)', border: CORAL, radius: 10 });
					text(ctx, this.codeDraft[i] ?? '', 322 + i * 52, 181, { size: 30, family: COMIC, color: INK, align: 'center' });
				}
			}
			if (this.game == 18 && this.net) {
				title('Room code');
				panel(ctx, 300, 140, 300, 110, { fill: 'rgba(255,255,255,0.88)', border: CORAL, radius: 20 });
				text(ctx, this.net.code.split('').join(' '), 450, 196, { size: 52, family: COMIC, color: CORAL, align: 'center' });
				text(ctx, this.net.role == 0 ? 'Send this code to a friend. The game starts when they join.' : 'Joining the game…', 450, 290, { size: 20, family: COMIC, color: INK, align: 'center', bold: false });
				text(ctx, 'You are Player ' + (this.net.role + 1), 450, 330, { size: 18, family: COMIC, color: INK_SOFT, align: 'center', bold: false });
			}
			if (this.netNote) text(ctx, this.netNote, 450, this.game == 17 ? 560 : 520, { size: 18, family: COMIC, color: 'rgb(190,60,30)', align: 'center' });
		}
		const n = this.net;
		if (n && this.game == 2) {
			// Who's who, and the opponent's connection.
			text(ctx, `Room ${n.code} · vs ${n.opponent}${n.opponentOnline ? '' : ' (reconnecting…)'}`, 450, 22, { size: 15, family: COMIC, color: '#fff', align: 'center' });
			const [x, y, w] = n.role == 0 ? [this.x2, this.y2, this.fishw2] : [this.x3, this.y3, this.fishw3];
			text(ctx, 'YOU', x + w / 2, y - 40, { size: 14, family: COMIC, color: '#fff', align: 'center' });
		}
		if (n?.end && (this.game == 10 || this.game == 11)) {
			const won = n.end.winner == n.role;
			panel(ctx, 280, 470, 340, 80, { fill: 'rgba(255,255,255,0.9)', border: CORAL, radius: 18 });
			text(ctx, won ? 'You win!' : 'You lose', 450, 494, { size: 26, family: COMIC, color: INK, align: 'center' });
			text(ctx, `Rating ${n.end.mmr} (${n.end.delta >= 0 ? '+' : ''}${n.end.delta})`, 450, 528, { size: 17, family: COMIC, color: INK_SOFT, align: 'center', bold: false });
			if (n.theyWantRematch && !n.iWantRematch) text(ctx, 'Your opponent wants a rematch', 450, 630, { size: 16, family: COMIC, color: '#fff', align: 'center' });
		}
		drawButtons(ctx, this.onlineButtons(), UI, this.hover);
	}

	// ── Menus: drawn buttons and cards, clicked or tapped ──
	// Screens (`game`): 0 title, 3 / 12 / 13 high scores (single player, records, multiplayer tabs),
	// 4 options (difficulty and character), 5 how to play.
	private hover: string | null = null;

	pointerDown(px: number, py: number) {
		if ((this.game == 7 || this.game == 8 || this.game == 10 || this.game == 11) && !this.net) {
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
		if (!MENU_SCREENS.includes(this.game) && this.game != 1 && this.game != 2 && this.game != PAUSED && !(this.net && (this.game == 10 || this.game == 11))) return false;
		const b = buttonAt(this.ui(), px, py);
		this.hover = b?.id ?? null;
		return !!b;
	}

	private ui(): UiButton[] {
		if (this.game >= 16 || (this.net && (this.game == 10 || this.game == 11))) return this.onlineButtons();
		const back: UiButton = { id: 'back', x: 20, y: 18, w: 128, h: 46, label: '‹ Back', size: 22, onClick: () => (this.game = 0) };
		switch (this.game) {
			case 0: {
				const rows: [string, string | undefined, () => void][] = [
					['Single Player', `${DIFFICULTIES[this.difficulty]} · playing as ${CHARACTERS[this.character]}`, () => (this.game = 1)],
					['Multiplayer', 'Same keyboard or online', () => this.openMultiplayer()],
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
			case 1: case 2:
				if (this.net) return []; // no pausing an online game
				return [{ id: 'pause', x: 838, y: 12, w: 48, h: 48, label: 'II', size: 18, onClick: () => this.pause() }];
			case PAUSED:
				return [
					{ id: 'resume', x: 330, y: 270, w: 240, h: 54, label: 'Resume', kind: 'primary', onClick: () => this.resume() },
					{ id: 'restart', x: 330, y: 336, w: 240, h: 54, label: 'Restart', onClick: () => { const m = this.pausedFrom; this.endRun(); this.game = m; } },
					{ id: 'quit', x: 330, y: 402, w: 240, h: 54, label: 'Main menu', onClick: () => this.endRun() }
				];
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
		// Typing a room code.
		if (this.game == 17) {
			const digit = /^(Digit|Numpad)(\d)$/.exec(code);
			if (digit) this.typeCode(digit[2]);
			else if (code == 'Backspace') this.typeCode('⌫');
			else if (enter && this.codeDraft.length == 6) void this.joinRoom();
			else return false;
			return true;
		}
		const known = enter || code == 'KeyP' || /^Key[WASD]$/.test(code) || /^Arrow(Up|Down|Left|Right)$/.test(code);
		if (!known) return false;
		// Online: your fish only (WASD or the arrows); no pausing.
		if (this.net) {
			const dir = DIRS[code];
			if (this.game == 2 && dir) {
				if (this.net.role == 1) {
					this.guestKeys.add(dir);
					this.sendInput();
				} else {
					if (dir == 'L') { this.direction = 2; this.mdx = -1; }
					if (dir == 'R') { this.direction = 1; this.mdx = 1; }
					if (dir == 'U') this.mdy = -1;
					if (dir == 'D') this.mdy = 1;
				}
			}
			return true;
		}
		if ((enter || code == 'KeyP') && (this.game == 1 || this.game == 2)) {
			this.pause();
			this.sfx('confirm');
			return true;
		}
		if (this.game == PAUSED) {
			if (enter || code == 'KeyP') {
				this.resume();
				this.sfx('confirm');
			}
			return true;
		}
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
		if (this.net) {
			const dir = DIRS[code];
			if (this.game == 2 && dir) {
				if (this.net.role == 1) {
					this.guestKeys.delete(dir);
					this.sendInput();
				} else {
					if (dir == 'L' || dir == 'R') this.mdx = 0;
					if (dir == 'U' || dir == 'D') this.mdy = 0;
				}
			}
			return !!dir;
		}
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
		this.resetFish();
		if (this.whoWon == 1) this.p1s++;
		else if (this.whoWon == 2) this.p2s++;
		this.whoWon = 0;
		this.gp++;
		this.game = 0;
		this.save();
	}
	/** Puts every fish back where a game starts. */
	private resetFish() {
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
		this.guestKeys.clear();
	}

	// ── Game loop: run() moves things, then the rules Java kept in paintComponent ──
	tick() {
		if (this.game == PAUSED) return;
		// Online guest: the host runs the game; ease the fish towards where the host says they are.
		if (this.net?.role == 1) {
			if (this.game == 2 && this.target) this.placeAt(this.target, 0.35);
			return;
		}
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
		if (this.net) {
			// Online host: send the fish to the guest, and the result when a fish is eaten.
			if (this.game == 2 && ++this.snapTimer % 4 == 0) this.sendSnapshot();
			if (before == 2 && (this.game == 10 || this.game == 11)) {
				this.sendSnapshot();
				void this.net.room.send({ type: 'result', winner: this.game == 10 ? 0 : 1 });
			}
			return;
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
		if (this.game == PAUSED) {
			// The game as it was, dimmed, with the pause menu on top.
			this.game = this.pausedFrom;
			this.paintFrame(ctx, now);
			this.game = PAUSED;
			ctx.fillStyle = 'rgba(0,30,60,0.55)';
			ctx.fillRect(0, 0, GAME_W, GAME_H);
			panel(ctx, 300, 180, 300, 300, { fill: 'rgba(255,255,255,0.9)', border: CORAL, width: 3, radius: 22 });
			text(ctx, 'Paused', 450, 226, { size: 36, family: COMIC, color: INK, align: 'center' });
			drawButtons(ctx, this.ui(), UI, this.hover);
			return;
		}
		if (this.game >= 16) return this.paintOnline(ctx);
		this.paintFrame(ctx, now);
		if ((this.game == 1 || this.game == 2) && !this.net) drawButtons(ctx, this.ui(), UI, this.hover);
		if (this.net) this.paintOnline(ctx);
	}

	private paintFrame(ctx: CanvasRenderingContext2D, now: number) {
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
