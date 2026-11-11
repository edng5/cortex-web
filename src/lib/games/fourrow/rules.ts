// Four in a Row rules (7 columns × 6 rows; drop a disc, first to line up four wins), shared by
// the browser and the server (which checks every online move).

export const COLS = 7;
export const ROWS = 6;
export type Disc = 1 | 2;

export interface FourState {
	/** Row by row from the top: 0 empty, 1 or 2 a player's disc. */
	grid: number[];
	turn: Disc;
	moves: number;
	/** The winning four (cell indexes), once someone has won. */
	line: number[] | null;
	winner: Disc | 0 | null; // 0 = draw (board full), null = still playing
}

export function newGame(first: Disc = 1): FourState {
	return { grid: Array(COLS * ROWS).fill(0), turn: first, moves: 0, line: null, winner: null };
}

/** The row a disc dropped in `col` lands on, or -1 when the column is full. */
export function landing(s: FourState, col: number): number {
	for (let r = ROWS - 1; r >= 0; r--) if (s.grid[r * COLS + col] == 0) return r;
	return -1;
}

export function canDrop(s: FourState, col: number): boolean {
	return s.winner == null && Number.isInteger(col) && col >= 0 && col < COLS && landing(s, col) >= 0;
}

/** Drops the current player's disc in `col` (assumed allowed) and returns the new state. */
export function drop(s: FourState, col: number): FourState {
	const r = landing(s, col);
	const grid = s.grid.slice();
	const cell = r * COLS + col;
	grid[cell] = s.turn;
	const line = fourThrough(grid, cell);
	const moves = s.moves + 1;
	return {
		grid,
		turn: s.turn == 1 ? 2 : 1,
		moves,
		line,
		winner: line ? s.turn : moves == COLS * ROWS ? 0 : null
	};
}

/** Four (or more) in a line through `cell`, if there is one. */
function fourThrough(grid: number[], cell: number): number[] | null {
	const who = grid[cell];
	const r0 = Math.floor(cell / COLS), c0 = cell % COLS;
	for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
		const line = [cell];
		for (const sign of [1, -1]) {
			for (let k = 1; ; k++) {
				const r = r0 + dr * k * sign, c = c0 + dc * k * sign;
				if (r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r * COLS + c] != who) break;
				line.push(r * COLS + c);
			}
		}
		if (line.length >= 4) return line;
	}
	return null;
}
