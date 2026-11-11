// Chess rules, shared by the browser (to show legal moves) and the server (which checks every
// online move, so nobody can cheat their way up the ratings). No DOM, no dependencies.
//
// Squares are 0-63, row by row from the top of the board as White sees it: 0 = a8, 7 = h8,
// 56 = a1, 63 = h1. Pieces are letters, upper case for White (P N B R Q K), lower case for Black,
// and '.' for an empty square.

export type Color = 'w' | 'b';
export interface Move {
	from: number;
	to: number;
	/** Promotion piece (always given as lower case: q r b n). */
	promo?: 'q' | 'r' | 'b' | 'n';
}
export interface ChessState {
	board: string[];
	turn: Color;
	/** Castling rights still available: some of 'KQkq'. */
	castling: string;
	/** En-passant target square (the square passed over), or -1. */
	ep: number;
	/** Half-moves since the last capture or pawn move (the 50-move rule). */
	half: number;
	/** Positions seen so far (for threefold repetition). */
	seen: Record<string, number>;
}
export type ChessResult =
	| { kind: 'checkmate'; winner: Color }
	| { kind: 'stalemate' | 'fifty' | 'repetition' | 'material' };

const START = 'rnbqkbnr' + 'pppppppp' + '........'.repeat(4) + 'PPPPPPPP' + 'RNBQKBNR';

export function newGame(): ChessState {
	const s: ChessState = { board: START.split(''), turn: 'w', castling: 'KQkq', ep: -1, half: 0, seen: {} };
	s.seen[key(s)] = 1;
	return s;
}

export const colorOf = (p: string): Color | null => (p == '.' ? null : p == p.toUpperCase() ? 'w' : 'b');
const row = (sq: number) => sq >> 3;
const col = (sq: number) => sq & 7;
const at = (r: number, c: number) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c);
export const squareName = (sq: number) => 'abcdefgh'[col(sq)] + (8 - row(sq));

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Is `sq` attacked by any piece of colour `by`? */
export function attacked(board: string[], sq: number, by: Color): boolean {
	const r = row(sq), c = col(sq);
	const mine = (p: string) => colorOf(p) == by;
	const is = (s: number, kinds: string) => s >= 0 && mine(board[s]) && kinds.includes(board[s].toLowerCase());
	// Pawns attack diagonally forward (White up the board, so from the row below).
	const dir = by == 'w' ? 1 : -1;
	if (is(at(r + dir, c - 1), 'p') || is(at(r + dir, c + 1), 'p')) return true;
	for (const [dr, dc] of KNIGHT) if (is(at(r + dr, c + dc), 'n')) return true;
	for (const [dr, dc] of KING) if (is(at(r + dr, c + dc), 'k')) return true;
	const slide = (dirs: number[][], kinds: string) => {
		for (const [dr, dc] of dirs) {
			for (let k = 1; ; k++) {
				const s = at(r + dr * k, c + dc * k);
				if (s < 0) break;
				if (board[s] != '.') {
					if (is(s, kinds)) return true;
					break;
				}
			}
		}
		return false;
	};
	return slide(ROOK, 'rq') || slide(BISHOP, 'bq');
}

export function inCheck(s: ChessState, color: Color = s.turn): boolean {
	const k = s.board.indexOf(color == 'w' ? 'K' : 'k');
	return k >= 0 && attacked(s.board, k, color == 'w' ? 'b' : 'w');
}

/** Moves that follow the pieces' movement rules (the king may still be left in check). */
function pseudo(s: ChessState): Move[] {
	const { board, turn } = s;
	const them: Color = turn == 'w' ? 'b' : 'w';
	const out: Move[] = [];
	const add = (from: number, to: number) => {
		const p = board[from].toLowerCase();
		if (p == 'p' && (row(to) == 0 || row(to) == 7)) for (const promo of ['q', 'r', 'b', 'n'] as const) out.push({ from, to, promo });
		else out.push({ from, to });
	};
	for (let sq = 0; sq < 64; sq++) {
		const p = board[sq];
		if (colorOf(p) != turn) continue;
		const r = row(sq), c = col(sq);
		const kind = p.toLowerCase();
		if (kind == 'p') {
			const dir = turn == 'w' ? -1 : 1;
			const one = at(r + dir, c);
			if (one >= 0 && board[one] == '.') {
				add(sq, one);
				const home = turn == 'w' ? 6 : 1;
				const two = at(r + 2 * dir, c);
				if (r == home && board[two] == '.') out.push({ from: sq, to: two });
			}
			for (const dc of [-1, 1]) {
				const t = at(r + dir, c + dc);
				if (t < 0) continue;
				if (colorOf(board[t]) == them || t == s.ep) add(sq, t);
			}
		} else if (kind == 'n' || kind == 'k') {
			for (const [dr, dc] of kind == 'n' ? KNIGHT : KING) {
				const t = at(r + dr, c + dc);
				if (t >= 0 && colorOf(board[t]) != turn) out.push({ from: sq, to: t });
			}
			// Castling: rights still there, squares between empty, and the king doesn't start in,
			// pass through or land on an attacked square.
			if (kind == 'k') {
				const [K, Q, home] = turn == 'w' ? ['K', 'Q', 60] : ['k', 'q', 4];
				if (sq == home && !attacked(board, home, them)) {
					if (s.castling.includes(K) && board[home + 1] == '.' && board[home + 2] == '.' && !attacked(board, home + 1, them) && !attacked(board, home + 2, them)) {
						out.push({ from: home, to: home + 2 });
					}
					if (s.castling.includes(Q) && board[home - 1] == '.' && board[home - 2] == '.' && board[home - 3] == '.' && !attacked(board, home - 1, them) && !attacked(board, home - 2, them)) {
						out.push({ from: home, to: home - 2 });
					}
				}
			}
		} else {
			const dirs = kind == 'r' ? ROOK : kind == 'b' ? BISHOP : [...ROOK, ...BISHOP];
			for (const [dr, dc] of dirs) {
				for (let k = 1; ; k++) {
					const t = at(r + dr * k, c + dc * k);
					if (t < 0 || colorOf(board[t]) == turn) break;
					out.push({ from: sq, to: t });
					if (board[t] != '.') break;
				}
			}
		}
	}
	return out;
}

/** Plays a move (assumed legal) and returns the new position. */
export function play(s: ChessState, m: Move): ChessState {
	const board = s.board.slice();
	const p = board[m.from];
	const kind = p.toLowerCase();
	const captured = board[m.to] != '.' || (kind == 'p' && m.to == s.ep);
	board[m.to] = m.promo ? (s.turn == 'w' ? m.promo.toUpperCase() : m.promo) : p;
	board[m.from] = '.';
	// En passant: the captured pawn is beside the moving one.
	if (kind == 'p' && m.to == s.ep) board[m.to + (s.turn == 'w' ? 8 : -8)] = '.';
	// Castling: move the rook too.
	if (kind == 'k' && Math.abs(m.to - m.from) == 2) {
		if (m.to > m.from) {
			board[m.from + 1] = board[m.from + 3];
			board[m.from + 3] = '.';
		} else {
			board[m.from - 1] = board[m.from - 4];
			board[m.from - 4] = '.';
		}
	}
	let castling = s.castling;
	const lose = (chars: string) => (castling = castling.split('').filter((ch) => !chars.includes(ch)).join(''));
	if (p == 'K') lose('KQ');
	if (p == 'k') lose('kq');
	for (const sq of [m.from, m.to]) {
		if (sq == 63) lose('K');
		if (sq == 56) lose('Q');
		if (sq == 7) lose('k');
		if (sq == 0) lose('q');
	}
	const next: ChessState = {
		board,
		turn: s.turn == 'w' ? 'b' : 'w',
		castling,
		ep: kind == 'p' && Math.abs(m.to - m.from) == 16 ? (m.from + m.to) / 2 : -1,
		half: kind == 'p' || captured ? 0 : s.half + 1,
		seen: { ...s.seen }
	};
	const k = key(next);
	next.seen[k] = (next.seen[k] ?? 0) + 1;
	return next;
}

/** Every legal move in the position. */
export function legalMoves(s: ChessState): Move[] {
	return pseudo(s).filter((m) => !inCheck(play(s, m), s.turn));
}

/** Is this exact move legal? (Used by the server to check what a player sent.) */
export function isLegal(s: ChessState, m: Move): boolean {
	return legalMoves(s).some((x) => x.from == m.from && x.to == m.to && (x.promo ?? null) == (m.promo ?? null));
}

/** The game's result, or null while it's still on. */
export function result(s: ChessState): ChessResult | null {
	if (legalMoves(s).length == 0) return inCheck(s) ? { kind: 'checkmate', winner: s.turn == 'w' ? 'b' : 'w' } : { kind: 'stalemate' };
	if (s.half >= 100) return { kind: 'fifty' };
	if (Object.values(s.seen).some((n) => n >= 3)) return { kind: 'repetition' };
	if (insufficient(s.board)) return { kind: 'material' };
	return null;
}

/** `color` has only its king, or king and one bishop or knight: it can't mate (a timeout against it is a draw). */
export function cannotMate(board: string[], color: Color): boolean {
	const mine = board.filter((p) => p != '.' && colorOf(p) == color && p.toLowerCase() != 'k');
	return mine.length == 0 || (mine.length == 1 && 'nb'.includes(mine[0].toLowerCase()));
}

/** Neither side can possibly mate: K v K, K+minor v K, or K+B v K+B with bishops on one colour. */
function insufficient(board: string[]): boolean {
	const pieces = board.map((p, sq) => ({ p, sq })).filter((x) => x.p != '.' && x.p.toLowerCase() != 'k');
	if (pieces.length == 0) return true;
	if (pieces.length == 1) return 'nb'.includes(pieces[0].p.toLowerCase());
	if (pieces.every((x) => x.p.toLowerCase() == 'b')) {
		const shade = (sq: number) => (row(sq) + col(sq)) % 2;
		return pieces.every((x) => shade(x.sq) == shade(pieces[0].sq));
	}
	return false;
}

/** A position's identity for repetition: pieces, side to move, castling and en passant. */
function key(s: ChessState): string {
	return `${s.board.join('')} ${s.turn} ${s.castling} ${s.ep}`;
}

/** Parses a FEN position (for tests). */
export function fromFen(fen: string): ChessState {
	const [placement, turn, castling, ep, half] = fen.split(' ');
	const board: string[] = [];
	for (const ch of placement.replace(/\//g, '')) {
		if (/\d/.test(ch)) board.push(...'.'.repeat(+ch));
		else board.push(ch);
	}
	const epSq = ep && ep != '-' ? at(8 - +ep[1], 'abcdefgh'.indexOf(ep[0])) : -1;
	const s: ChessState = { board, turn: turn as Color, castling: castling == '-' ? '' : castling, ep: epSq, half: +(half ?? 0), seen: {} };
	s.seen[key(s)] = 1;
	return s;
}
