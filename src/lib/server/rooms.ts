// Online rooms for E.Ngine Games' multiplayer (Chess, Four in a Row, Fishy). A signed-in player
// creates a room and gets a 6-digit code; a second signed-in player joins with it. Each player
// listens on a server-sent event stream and sends moves as ordinary (HTTPS) requests, both checked
// against their session: only the room's two players can see or act in it.
//
// Chess and Four in a Row are played on the server: every move is checked against the rules here,
// so a player can't cheat their way up the ratings. Fishy is real-time, so the host's browser runs
// the game and the room only passes messages between the two players.
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
		drawOffer: room.seats.findIndex((s) => s?.drawOffer)
	};
}
function syncAll(room: Room) {
	room.seats.forEach((s, i) => s && sendTo(room, i as SeatNo, view(room, i as SeatNo)));
}

function start(room: Room) {
	room.phase = 'playing';
	room.round++;
	room.lastMove = undefined;
	room.seats.forEach((s) => s && ((s.rematch = false), (s.drawOffer = false)));
	if (room.game == 'chess') room.chess = chess.newGame();
	if (room.game == 'fourrow') room.four = four.newGame(1);
	syncAll(room);
}

/** Ends the round: records the result (and ratings) and tells both players. */
function finish(room: Room, winner: SeatNo | null, reason: string) {
	if (room.phase != 'playing' || !room.seats[1]) return;
	room.phase = 'over';
	const [a, b] = [room.seats[0], room.seats[1]];
	const summary = recordMatch(room.game, a.userId, b.userId, winner == null ? null : room.seats[winner]!.userId, reason);
	broadcast(room, {
		t: 'end',
		winner,
		reason,
		ratings: [a, b].map((s) => ({ mmr: summary.ratings[s.userId].mmr, delta: summary.deltas[s.userId] }))
	});
	syncAll(room);
}

// ── Public API (used by /api/rooms) ──

export interface Player {
	id: string;
	name: string;
}

export function createRoom(game: RoomGame, user: Player): string {
	const code = newCode();
	rooms.set(code, {
		code,
		game,
		seats: [{ userId: user.id, name: user.name, streams: new Set() }, null],
		phase: 'waiting',
		round: 0,
		first: crypto.randomInt(2) as SeatNo,
		active: Date.now(),
		relays: { second: 0, count: 0 }
	});
	return code;
}

export type JoinResult = { ok: true; seat: SeatNo; game: RoomGame } | { ok: false; status: number; message: string };

export function joinRoom(code: string, user: Player, game?: string): JoinResult {
	const room = rooms.get(code);
	if (!room) return { ok: false, status: 404, message: 'No room with that code. Check it and try again.' };
	if (game && room.game != game) return { ok: false, status: 400, message: 'That code is for a different game.' };
	const already = seatOf(room, user.id);
	if (already != null) return { ok: true, seat: already, game: room.game };
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

function close(room: Room) {
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
				const captured = s.board[move.to] != '.' || (s.board[move.from].toLowerCase() == 'p' && move.to == s.ep);
				room.chess = chess.play(s, move);
				room.lastMove = { ...move, captured };
				room.seats.forEach((x) => x && (x.drawOffer = false));
				const r = chess.result(room.chess);
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
				room.four = four.drop(s, col);
				room.lastMove = { col };
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
		case 'rematch':
			if (room.phase != 'over') return bad('The game is not over.');
			me.rematch = true;
			if (room.seats[other]?.rematch) {
				room.first = (1 - room.first) as SeatNo; // swap colours / who goes first
				start(room);
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
