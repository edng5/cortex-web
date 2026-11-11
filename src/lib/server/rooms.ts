// Online rooms for E.Ngine Games' multiplayer (Chess, Four in a Row, Fishy). A signed-in player
// creates a room and gets a 6-digit code; a second signed-in player joins with it. Each player
// listens on a server-sent event stream and sends moves as ordinary (HTTPS) requests, both checked
// against their session: only the room's two players can see or act in it.
//
// Chess and Four in a Row are played on the server: every move is checked against the rules here,
// so a player can't cheat their way up the ratings. Fishy is real-time, so the host's browser runs
// the game and the room only passes messages between the two players.
//
// Chess and Four in a Row rooms are either custom (made with a code for a friend: the host picks who
// goes first, takebacks and a clock; no rating) or ranked (matched with whoever else is looking:
// random first move, 10 minutes each, no takebacks, rated). Fishy rooms are rated.
//
// Rooms live in memory (one server). Idle rooms are cleared; a player who drops out of a game in
// progress and doesn't come back within 45 seconds loses it.
import crypto from 'node:crypto';
import * as chess from '$lib/games/chess/rules';
import * as four from '$lib/games/fourrow/rules';
import { getRating, recordMatch, type RatedGame } from './ratings';

export type RoomGame = RatedGame;
type SeatNo = 0 | 1;

interface Stream {
	send(event: object): void;
	close(): void;
}
interface Seat {
	userId: string;
	name: string;
	streams: Set<Stream>;
	gone?: ReturnType<typeof setTimeout>;
	rematch?: boolean;
	drawOffer?: boolean;
}
export interface RoomSettings {
	/** Results change ratings (and the win / loss record). */
	rated: boolean;
	/** Ranked: matched with a stranger, not joined by code. */
	matchmade: boolean;
	/** Who goes first in the first round (White in chess); rematches take turns. */
	first: 'host' | 'guest' | 'random';
	takebacks: boolean;
	/** Minutes on each player's clock; 0 = no clock. */
	clockMin: number;
}
export const RANKED: RoomSettings = { rated: true, matchmade: true, first: 'random', takebacks: false, clockMin: 10 };
export const CLOCK_CHOICES = [0, 1, 3, 5, 10, 15, 30];
/** A position to go back to (takebacks). */
interface Snapshot {
	chess?: chess.ChessState;
	four?: four.FourState;
	lastMove?: unknown;
}
interface Room {
	code: string;
	game: RoomGame;
	seats: [Seat, Seat | null];
	phase: 'waiting' | 'playing' | 'over';
	round: number;
	/** Chess: which seat plays White this round. Four in a Row: which seat drops first (disc 1). */
	first: SeatNo;
	chess?: chess.ChessState;
	four?: four.FourState;
	lastMove?: unknown;
	settings: RoomSettings;
	/** Positions before each move this round. */
	history: Snapshot[];
	/** A takeback asked for by this seat. */
	takeback: SeatNo | null;
	/** Time left on each player's clock (as of `since`), when there's a clock. */
	clock: { left: [number, number]; since: number; timer?: ReturnType<typeof setTimeout> } | null;
	active: number;
	/** Fishy: relay messages this second (a rate cap). */
	relays: { second: number; count: number };
}

const rooms = new Map<string, Room>();
const ABANDON_MS = 45_000;
const IDLE_MS = 30 * 60_000;

function newCode(): string {
	for (;;) {
		const code = String(crypto.randomInt(100000, 1000000));
		if (!rooms.has(code)) return code;
	}
}

const seatOf = (room: Room, userId: string): SeatNo | null =>
	room.seats[0].userId == userId ? 0 : room.seats[1]?.userId == userId ? 1 : null;

function broadcast(room: Room, event: object) {
	for (const seat of room.seats) seat?.streams.forEach((s) => s.send(event));
}
function sendTo(room: Room, seat: SeatNo, event: object) {
	room.seats[seat]?.streams.forEach((s) => s.send(event));
}

/** What a player sees of the room: players, ratings, the board, whose turn. */
function view(room: Room, you: SeatNo) {
	const players = room.seats.map((s, i) => s && { seat: i, name: s.name, mmr: getRating(s.userId, room.game).mmr, online: s.streams.size > 0 });
	return {
		t: 'room',
		code: room.code,
		game: room.game,
		you,
		phase: room.phase,
		round: room.round,
		first: room.first,
		players,
		chess: room.chess ? { board: room.chess.board, turn: room.chess.turn, castling: room.chess.castling, ep: room.chess.ep, check: chess.inCheck(room.chess) } : undefined,
		four: room.four,
		lastMove: room.lastMove,
		drawOffer: room.seats.findIndex((s) => s?.drawOffer),
		settings: { rated: room.settings.rated, ranked: room.settings.matchmade, takebacks: room.settings.takebacks, clockMin: room.settings.clockMin },
		takeback: room.takeback ?? -1,
		canTakeBack: room.phase == 'playing' && room.history.length >= (turnSeat(room) == you ? 2 : 1),
		clock: clockView(room)
	};
}
function syncAll(room: Room) {
	room.seats.forEach((s, i) => s && sendTo(room, i as SeatNo, view(room, i as SeatNo)));
}

/** Whose turn it is (a seat). */
function turnSeat(room: Room): SeatNo {
	const firstToMove = room.game == 'chess' ? room.chess?.turn == 'w' : room.game == 'fourrow' ? room.four?.turn == 1 : true;
	return firstToMove ? room.first : ((1 - room.first) as SeatNo);
}

// ── Clocks ──
/** Takes the time since the last check off the player whose turn it is. */
function tickClock(room: Room) {
	const c = room.clock;
	if (!c) return;
	const now = Date.now();
	if (room.phase == 'playing') {
		const s = turnSeat(room);
		c.left[s] = Math.max(0, c.left[s] - (now - c.since));
	}
	c.since = now;
}
/** Sets an alarm for when the player to move runs out of time. */
function armClock(room: Room) {
	const c = room.clock;
	if (!c) return;
	clearTimeout(c.timer);
	if (room.phase != 'playing') return;
	const s = turnSeat(room);
	c.timer = setTimeout(() => {
		tickClock(room);
		if (c.left[s] <= 0) flag(room, s);
		else armClock(room);
	}, c.left[s] + 25);
}
/** `seat` ran out of time: they lose, unless the other player couldn't possibly win (a draw). */
function flag(room: Room, seat: SeatNo) {
	const other = (1 - seat) as SeatNo;
	const otherColor: chess.Color = other == room.first ? 'w' : 'b';
	if (room.game == 'chess' && room.chess && chess.cannotMate(room.chess.board, otherColor)) finish(room, null, 'timeout-draw');
	else finish(room, other, 'timeout');
}
function clockView(room: Room) {
	const c = room.clock;
	if (!c) return null;
	const running: number = room.phase == 'playing' ? turnSeat(room) : -1;
	const left = c.left.slice();
	if (running >= 0) left[running] = Math.max(0, left[running] - (Date.now() - c.since));
	return { left, running };
}

function start(room: Room) {
	room.phase = 'playing';
	room.round++;
	room.lastMove = undefined;
	room.history = [];
	room.takeback = null;
	room.seats.forEach((s) => s && ((s.rematch = false), (s.drawOffer = false)));
	// Who goes first: as set for the first round, then the players take turns (random stays random).
	if (room.settings.first == 'random') room.first = crypto.randomInt(2) as SeatNo;
	else if (room.round == 1) room.first = room.settings.first == 'host' ? 0 : 1;
	else room.first = (1 - room.first) as SeatNo;
	if (room.game == 'chess') room.chess = chess.newGame();
	if (room.game == 'fourrow') room.four = four.newGame(1);
	if (room.clock) clearTimeout(room.clock.timer);
	const ms = room.settings.clockMin * 60_000;
	room.clock = ms && room.game != 'fishy' ? { left: [ms, ms], since: Date.now() } : null;
	armClock(room);
	syncAll(room);
}

/** Goes back to before the asker's last move (one move, or two when the other player has moved since). */
function takeBack(room: Room, asker: SeatNo) {
	const n = turnSeat(room) == asker ? 2 : 1;
	if (room.history.length < n) return false;
	tickClock(room);
	let snap: Snapshot | undefined;
	for (let i = 0; i < n; i++) snap = room.history.pop();
	room.chess = snap!.chess;
	room.four = snap!.four;
	room.lastMove = snap!.lastMove;
	room.takeback = null;
	room.seats.forEach((x) => x && (x.drawOffer = false));
	armClock(room);
	syncAll(room);
	return true;
}

/** Ends the round: records the result (and ratings) and tells both players. */
function finish(room: Room, winner: SeatNo | null, reason: string) {
	if (room.phase != 'playing' || !room.seats[1]) return;
	tickClock(room);
	room.phase = 'over';
	room.takeback = null;
	if (room.clock) clearTimeout(room.clock.timer);
	const [a, b] = [room.seats[0], room.seats[1]];
	// Custom games aren't rated (or counted in the record).
	const summary = room.settings.rated ? recordMatch(room.game, a.userId, b.userId, winner == null ? null : room.seats[winner]!.userId, reason) : null;
	broadcast(room, {
		t: 'end',
		winner,
		reason,
		ratings: summary ? [a, b].map((s) => ({ mmr: summary.ratings[s.userId].mmr, delta: summary.deltas[s.userId] })) : null
	});
	syncAll(room);
}

// ── Public API (used by /api/rooms) ──

export interface Player {
	id: string;
	name: string;
}

export function createRoom(game: RoomGame, user: Player, settings: RoomSettings): string {
	const code = newCode();
	rooms.set(code, {
		code,
		game,
		seats: [{ userId: user.id, name: user.name, streams: new Set() }, null],
		phase: 'waiting',
		round: 0,
		first: 0,
		settings,
		history: [],
		takeback: null,
		clock: null,
		active: Date.now(),
		relays: { second: 0, count: 0 }
	});
	return code;
}

/**
 * Ranked: joins someone already looking for a game (who is still connected), or opens a room to
 * wait in. Returns the room's code.
 */
export function findRanked(game: RoomGame, user: Player): string {
	let mine: Room | null = null;
	for (const room of rooms.values()) {
		if (room.game != game || !room.settings.matchmade || room.phase != 'waiting' || room.seats[1]) continue;
		if (room.seats[0].userId == user.id) {
			mine = room;
			continue;
		}
		if (room.seats[0].streams.size == 0) continue;
		room.seats[1] = { userId: user.id, name: user.name, streams: new Set() };
		room.active = Date.now();
		start(room);
		return room.code;
	}
	return mine?.code ?? createRoom(game, user, RANKED);
}

export type JoinResult = { ok: true; seat: SeatNo; game: RoomGame } | { ok: false; status: number; message: string };

export function joinRoom(code: string, user: Player, game?: string): JoinResult {
	const room = rooms.get(code);
	if (!room) return { ok: false, status: 404, message: 'No room with that code. Check it and try again.' };
	if (game && room.game != game) return { ok: false, status: 400, message: 'That code is for a different game.' };
	const already = seatOf(room, user.id);
	if (already != null) return { ok: true, seat: already, game: room.game };
	if (room.settings.matchmade) return { ok: false, status: 404, message: 'No room with that code. Check it and try again.' };
	if (room.seats[1]) return { ok: false, status: 409, message: 'That room is full.' };
	room.seats[1] = { userId: user.id, name: user.name, streams: new Set() };
	room.active = Date.now();
	start(room);
	return { ok: true, seat: 1, game: room.game };
}

/** A player's event stream: the room now, then everything that happens. Returns an unsubscribe. */
export function subscribe(code: string, userId: string, stream: Stream): (() => void) | null {
	const room = rooms.get(code);
	const seat = room ? seatOf(room, userId) : null;
	if (!room || seat == null) return null;
	const s = room.seats[seat]!;
	if (s.gone) {
		clearTimeout(s.gone);
		s.gone = undefined;
	}
	s.streams.add(stream);
	stream.send(view(room, seat));
	sendTo(room, (1 - seat) as SeatNo, { t: 'presence', seat, online: true });
	return () => {
		s.streams.delete(stream);
		if (s.streams.size) return;
		sendTo(room, (1 - seat) as SeatNo, { t: 'presence', seat, online: false });
		// Gone for good? A game in progress is lost; a room nobody joined is closed.
		s.gone = setTimeout(() => {
			if (s.streams.size) return;
			if (room.phase == 'playing') finish(room, (1 - seat) as SeatNo, 'abandoned');
			if (room.phase == 'waiting' || (room.seats.every((x) => !x || x.streams.size == 0))) close(room);
		}, ABANDON_MS);
	};
}

/** Checks the mover's clock: if they ran out, the game ends now. */
function outOfTime(room: Room, seat: SeatNo): boolean {
	if (!room.clock) return false;
	tickClock(room);
	if (room.clock.left[seat] > 0) return false;
	flag(room, seat);
	return true;
}

function close(room: Room) {
	if (room.clock) clearTimeout(room.clock.timer);
	broadcast(room, { t: 'closed' });
	room.seats.forEach((s) => s?.streams.forEach((st) => st.close()));
	rooms.delete(room.code);
}

export type ActResult = { ok: true } | { ok: false; status: number; message: string };
const bad = (message: string, status = 400): ActResult => ({ ok: false, status, message });

/** A player's action in their room: a move, resign, draw offer, rematch, leave, or (Fishy) a message. */
export function act(code: string, userId: string, msg: Record<string, unknown>): ActResult {
	const room = rooms.get(code);
	const seat = room ? seatOf(room, userId) : null;
	if (!room || seat == null) return bad('You are not in that room.', 403);
	room.active = Date.now();
	const other = (1 - seat) as SeatNo;
	const me = room.seats[seat]!;

	switch (msg.type) {
		case 'move': {
			if (room.phase != 'playing') return bad('The game is not in progress.');
			if (room.game == 'chess') {
				const s = room.chess!;
				const mySide = (seat == room.first ? 'w' : 'b') as chess.Color;
				if (s.turn != mySide) return bad("It's not your turn.");
				const m = msg.move as chess.Move | undefined;
				const move: chess.Move | null =
					m && Number.isInteger(m.from) && Number.isInteger(m.to)
						? { from: m.from, to: m.to, ...(m.promo && 'qrbn'.includes(m.promo) ? { promo: m.promo } : {}) }
						: null;
				if (!move || !chess.isLegal(s, move)) return bad('That move is not allowed.');
				if (outOfTime(room, seat)) return bad('Out of time.');
				const captured = s.board[move.to] != '.' || (s.board[move.from].toLowerCase() == 'p' && move.to == s.ep);
				room.history.push({ chess: s, lastMove: room.lastMove });
				room.takeback = null;
				room.chess = chess.play(s, move);
				room.lastMove = { ...move, captured };
				room.seats.forEach((x) => x && (x.drawOffer = false));
				const r = chess.result(room.chess);
				armClock(room);
				syncAll(room);
				if (r) finish(room, r.kind == 'checkmate' ? (r.winner == 'w' ? room.first : ((1 - room.first) as SeatNo)) : null, r.kind);
				return { ok: true };
			}
			if (room.game == 'fourrow') {
				const s = room.four!;
				const myDisc = seat == room.first ? 1 : 2;
				if (s.turn != myDisc) return bad("It's not your turn.");
				const col = Number(msg.col);
				if (!four.canDrop(s, col)) return bad('That column is full.');
				if (outOfTime(room, seat)) return bad('Out of time.');
				room.history.push({ four: s, lastMove: room.lastMove });
				room.takeback = null;
				room.four = four.drop(s, col);
				room.lastMove = { col };
				armClock(room);
				syncAll(room);
				if (room.four.winner != null) finish(room, room.four.winner == 0 ? null : room.four.winner == 1 ? room.first : ((1 - room.first) as SeatNo), room.four.winner ? 'four' : 'full');
				return { ok: true };
			}
			return bad('Unknown move.');
		}
		case 'resign':
			if (room.phase != 'playing') return bad('The game is not in progress.');
			finish(room, other, 'resign');
			return { ok: true };
		case 'draw': {
			if (room.game != 'chess' || room.phase != 'playing') return bad('No draw to offer.');
			if (room.seats[other]?.drawOffer) finish(room, null, 'agreed');
			else {
				me.drawOffer = true;
				syncAll(room);
			}
			return { ok: true };
		}
		// Takebacks (when the room allows them): ask, and the other player answers.
		case 'takeback': {
			if (!room.settings.takebacks) return bad('Takebacks are off in this room.');
			if (room.phase != 'playing') return bad('The game is not in progress.');
			if (room.history.length < (turnSeat(room) == seat ? 2 : 1)) return bad('Nothing to take back yet.');
			room.takeback = seat;
			syncAll(room);
			return { ok: true };
		}
		case 'takeback-answer': {
			if (room.takeback != other || room.phase != 'playing') return bad('No takeback to answer.');
			if (msg.accept === true) takeBack(room, other);
			else {
				room.takeback = null;
				sendTo(room, other, { t: 'takeback-declined' });
				syncAll(room);
			}
			return { ok: true };
		}
		case 'rematch':
			if (room.phase != 'over') return bad('The game is not over.');
			me.rematch = true;
			if (room.seats[other]?.rematch) {
				start(room); // (who goes first swaps, or is drawn again for random)
			} else broadcast(room, { t: 'rematch', seat });
			return { ok: true };
		case 'leave':
			if (room.phase == 'playing' && room.seats[1]) finish(room, other, 'resign');
			sendTo(room, other, { t: 'left', seat });
			close(room);
			return { ok: true };
		// Fishy (real-time, run in the host's browser): pass the message on to the other player.
		case 'relay': {
			if (room.game != 'fishy') return bad('Not a real-time game.');
			const sec = Math.floor(Date.now() / 1000);
			if (room.relays.second != sec) room.relays = { second: sec, count: 0 };
			if (++room.relays.count > 80) return bad('Too many messages.', 429);
			sendTo(room, other, { t: 'relay', from: seat, msg: msg.msg });
			return { ok: true };
		}
		// Fishy: the host reports who won the round.
		case 'result': {
			if (room.game != 'fishy' || seat != 0) return bad('Only the host reports the result.');
			const w = msg.winner;
			finish(room, w === 0 || w === 1 ? w : null, 'eaten');
			return { ok: true };
		}
	}
	return bad('Unknown action.');
}

// Clear rooms nobody has used for a while.
setInterval(() => {
	const now = Date.now();
	for (const room of rooms.values()) if (now - room.active > IDLE_MS) close(room);
}, 60_000).unref();
