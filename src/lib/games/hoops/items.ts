// Check-up: things to wear and court styles, and how you get them. A few basics are free; the rest
// come from beating each Street Ladder opponent (something that fits the real player: Shaq's
// shattered backboard, A.I.'s arm sleeve, Kobe's purple and gold court…) or from achievements.
import type { Look } from './court';

export type Slot =
	| 'shoes' | 'hat' | 'band' | 'sleeve' | 'wrist' | 'goggles' | 'chain' | 'knee' | 'jersey' | 'hairColor' | 'hair'
	| 'floor' | 'key' | 'board' | 'net' | 'ball' | 'decal';
export const SLOT_NAMES: Record<Slot, string> = {
	shoes: 'Shoes', hat: 'Headwear', band: 'Headband', sleeve: 'Arm sleeve', wrist: 'Wristbands', goggles: 'Goggles', chain: 'Chain', knee: 'Knee pad', jersey: 'Jersey',
	hairColor: 'Hair colour', hair: 'Hairstyle', floor: 'Court floor', key: 'Key paint', board: 'Backboard', net: 'Net', ball: 'Ball', decal: 'Half-court logo'
};
/** The court's style (the park you play in), not something you wear. */
export const COURT_SLOTS: Slot[] = ['floor', 'key', 'board', 'net', 'ball', 'decal'];
/** Styles you can't take off, only swap (no "None"). */
export const ALWAYS_ON: Slot[] = ['shoes', 'jersey', 'hairColor', 'hair', 'floor', 'key', 'board', 'net', 'ball'];

export interface Item {
	id: string;
	name: string;
	slot: Slot;
	/** A colour; shoes and floors are 'a|b'; goggles 'on'; backboards, nets, balls, logos and hairstyles a style name. */
	value: string;
	/** Free, beat a ladder rung (0-based), or an achievement. */
	from: null | { rung: number } | { ach: string };
}

const free = (slot: Slot, id: string, name: string, value: string): Item => ({ id, name, slot, value, from: null });
const rung = (r: number, slot: Slot, id: string, name: string, value: string): Item => ({ id, name, slot, value, from: { rung: r } });
const ach = (a: string, slot: Slot, id: string, name: string, value: string): Item => ({ id, name, slot, value, from: { ach: a } });

export const ITEMS: Item[] = [
	free('shoes', 'shoes-black', 'Park blacks', '#111827|#f8fafc'),
	free('shoes', 'shoes-white', 'Clean whites', '#f8fafc|#111827'),
	free('floor', 'floor-park', 'Park blue', '#2f6690|#2a5d86'),
	free('key', 'key-orange', 'Orange paint', '#c2410c'),
	free('board', 'board-glass', 'Glass', 'glass'),
	free('net', 'net-chain', 'Chain net', 'chain'),
	free('ball', 'ball-classic', 'Classic ball', 'classic'),
	// From the Street Ladder: something that fits each real player.
	rung(0, 'ball', 'aba-ball', 'Dunk-contest ball', 'aba'), // Spud Webb won the dunk contest
	rung(1, 'hairColor', 'worm-dye', 'Worm green dye', '#39ff14'), // Rodman's dyed hair
	rung(2, 'board', 'bool-board', 'True/False backboard', 'binary'),
	rung(3, 'board', 'shattered', 'Shattered backboard', 'shattered'), // Shaq broke a few
	rung(4, 'floor', 'hardwood', 'Hoosier hardwood', '#c98a4b|#b97a3d'), // Indiana basketball
	rung(5, 'hair', 'flow', 'The Flow (hairstyle)', 'flow'), // Nash's floppy hair
	rung(6, 'shoes', 'ros-1', 'ROWS 1s', '#dc2626|#f8fafc'), // Rose's signature shoes
	rung(7, 'sleeve', 'ai-sleeve', 'A.I. sleeve', '#f8fafc'), // Iverson made the arm sleeve famous
	rung(8, 'board', 'bank', 'Bank-shot backboard', 'bank'), // Duncan's bank shot
	rung(9, 'key', 'clutch-key', 'Clutch City paint', '#dc2626'), // Houston red
	rung(10, 'shoes', 'kernel-kd', 'Kernel KDs', '#1e3a8a|#f97316'), // KD's signature shoes
	rung(11, 'decal', 'splash-logo', 'Splash logo', 'splash'), // threes from the logo
	rung(12, 'floor', 'mamba-floor', 'Purple & gold court', '#4c1d95|#5b21b6|#facc15'), // the Lakers' colours
	rung(13, 'hat', 'kings-crown', "King's crown", '#facc15'), // the King
	rung(14, 'shoes', 'ai-1', 'AI 1s', '#dc2626|#111827'),
	// From achievements.
	ach('first-bucket', 'wrist', 'rookie-wrist', 'Rookie wristbands', '#f8fafc'),
	ach('splash', 'shoes', 'splash', 'Splash kicks', '#14b8a6|#f8fafc'),
	ach('ankles', 'sleeve', 'breaker', 'Breaker sleeve', '#dc2626'),
	ach('swat', 'band', 'swat-band', 'Swat headband', '#dc2626'),
	ach('perfect', 'jersey', 'gold', 'Gold jersey', '#d4af37'),
	ach('gymrat', 'goggles', 'goggles', 'Gym rat goggles', 'on'),
	ach('bite', 'knee', 'pump-knee', 'Pump-fake knee pad', '#111827'),
	ach('shutout', 'chain', 'ice-chain', 'Ice chain', '#e5e7eb'),
	ach('comeback', 'shoes', 'comeback', 'Comeback kicks', '#111827|#facc15'),
	ach('king', 'decal', 'crown-logo', 'Crown at half court', 'crown'),
	ach('online', 'jersey', 'netcode', 'Netcode teal', '#0d9488'),
	ach('posterized', 'band', 'rim-rocker', 'Rim-rocker headband', '#f97316'),
	ach('highlight', 'ball', 'gold-ball', 'Golden ball', 'gold'),
	ach('logo', 'wrist', 'logo-wrist', 'Logo wristbands', '#facc15'),
	ach('floored', 'sleeve', 'floor-sleeve', 'Floor-general sleeve', '#facc15'),
	ach('triple', 'knee', 'triple-knee', 'Triple-threat knee pad', '#f8fafc'),
	ach('regular', 'net', 'nylon-net', 'Fresh nylon net', 'nylon'),
	ach('rising', 'band', 'rising-band', 'Rising-star headband', '#0ea5e9'),
	ach('contender', 'shoes', 'contender', 'Contender kicks', '#facc15|#111827'),
	ach('onfire', 'hairColor', 'flame-dye', 'Flame dye', '#f97316'),
	ach('online-win', 'wrist', 'net-wrist', 'Netcode wristbands', '#0d9488'),
	ach('gym-legend', 'floor', 'midnight-floor', 'Midnight court', '#0f172a|#1e293b|#7c3aed'),
	ach('sharpshooter', 'sleeve', 'sharp-sleeve', 'Sharpshooter sleeve', '#2563eb')
];

/** What counts toward achievements. */
export interface Progress {
	makes: number;
	twos: number;
	shakes: number;
	blocks: number;
	perfects: number;
	reps: number;
	bites: number;
	online: number;
	dunks: number;
	deeps: number;
	floors: number;
	triples: number;
	games: number;
	onlineWins: number;
}
export const NO_PROGRESS: Progress = { makes: 0, twos: 0, shakes: 0, blocks: 0, perfects: 0, reps: 0, bites: 0, online: 0, dunks: 0, deeps: 0, floors: 0, triples: 0, games: 0, onlineWins: 0 };

export interface Achievement {
	id: string;
	name: string;
	what: string;
	/** Counted ones: which counter, and how many. Others are unlocked by the game (wins). */
	count?: { key: keyof Progress; n: number };
}
export const ACHIEVEMENTS: Achievement[] = [
	{ id: 'first-bucket', name: 'First Bucket', what: 'Score in a game', count: { key: 'makes', n: 1 } },
	{ id: 'splash', name: 'Splash Zone', what: 'Make 10 twos (from behind the arc)', count: { key: 'twos', n: 10 } },
	{ id: 'ankles', name: 'Ankle Breaker', what: 'Shake your defender 10 times', count: { key: 'shakes', n: 10 } },
	{ id: 'swat', name: 'Rejected', what: 'Block 5 shots', count: { key: 'blocks', n: 5 } },
	{ id: 'perfect', name: 'Perfect Form', what: '10 perfect releases in games', count: { key: 'perfects', n: 10 } },
	{ id: 'gymrat', name: 'Gym Rat', what: '150 reps in practice', count: { key: 'reps', n: 150 } },
	{ id: 'bite', name: "Got 'Em", what: 'Make 5 defenders bite on a pump fake', count: { key: 'bites', n: 5 } },
	{ id: 'shutout', name: 'Shutout', what: 'Win a game 11–0' },
	{ id: 'comeback', name: 'Comeback', what: 'Win after being down by 5' },
	{ id: 'king', name: 'King of the Park', what: 'Beat AI Jordan' },
	{ id: 'online', name: 'Online Debut', what: 'Finish an online game', count: { key: 'online', n: 1 } },
	{ id: 'posterized', name: 'Posterized', what: 'Throw down your first dunk (Finishing 70+)', count: { key: 'dunks', n: 1 } },
	{ id: 'highlight', name: 'Highlight Reel', what: 'Dunk 10 times', count: { key: 'dunks', n: 10 } },
	{ id: 'logo', name: 'From the Logo', what: 'Make a deep three (Three-point 70+)', count: { key: 'deeps', n: 1 } },
	{ id: 'floored', name: 'Floored', what: 'Put 3 defenders on the floor', count: { key: 'floors', n: 3 } },
	{ id: 'triple', name: 'Triple Threat', what: 'Get into triple threat 20 times', count: { key: 'triples', n: 20 } },
	{ id: 'regular', name: 'Park Regular', what: 'Play 10 ladder games', count: { key: 'games', n: 10 } },
	{ id: 'rising', name: 'Rising Star', what: 'Beat 5 ladder opponents' },
	{ id: 'contender', name: 'Contender', what: 'Beat 10 ladder opponents' },
	{ id: 'onfire', name: 'On Fire', what: 'Win 3 ladder games in a row' },
	{ id: 'online-win', name: 'Netcode Victory', what: 'Win an online game', count: { key: 'onlineWins', n: 1 } },
	{ id: 'gym-legend', name: 'Gym Legend', what: '500 reps in practice', count: { key: 'reps', n: 500 } },
	{ id: 'sharpshooter', name: 'Sharpshooter', what: 'Make 25 twos', count: { key: 'twos', n: 25 } }
];

export function unlocked(item: Item, beaten: number, achs: string[]): boolean {
	if (!item.from) return true;
	if ('rung' in item.from) return item.from.rung < beaten;
	return achs.includes(item.from.ach);
}
export function howToGet(item: Item, names: string[]): string {
	if (!item.from) return '';
	if ('rung' in item.from) return `Beat ${names[item.from.rung]}`;
	const a = ACHIEVEMENTS.find((x) => x.id == (item.from as { ach: string }).ach);
	return a ? `${a.name}: ${a.what}` : '';
}

/** Wearing an item: what it changes on your look. */
export function wear(look: Look, item: Item | null, slot: Slot): Look {
	const v = item?.value ?? null;
	switch (slot) {
		case 'shoes':
			return { ...look, shoes: v ?? '#111827|#f8fafc' };
		case 'jersey':
			return v ? { ...look, jersey: v } : look;
		case 'hairColor':
			return v ? { ...look, hairColor: v } : look;
		case 'hair':
			return v ? { ...look, hair: v as Look['hair'] } : look;
		case 'goggles':
			return { ...look, goggles: !!v };
		case 'floor':
		case 'key':
		case 'board':
		case 'net':
		case 'ball':
		case 'decal':
			return look; // the court's, not yours (see courtStyle)
		default:
			return { ...look, [slot]: v };
	}
}

/** How the court looks: floor colours (and key paint), backboard, net, ball and half-court logo. */
export interface CourtStyle {
	floor: [string, string];
	key: string;
	board: 'glass' | 'binary' | 'shattered' | 'bank';
	net: 'chain' | 'nylon';
	ball: 'classic' | 'aba' | 'gold';
	decal: 'none' | 'splash' | 'crown';
}
export const DEFAULT_COURT: CourtStyle = { floor: ['#2f6690', '#2a5d86'], key: '#c2410c', board: 'glass', net: 'chain', ball: 'classic', decal: 'none' };

/** The court style from what's chosen (a floor can bring its own key paint, unless one is chosen). */
export function courtStyle(chosen: Partial<Record<Slot, Item | null>>): CourtStyle {
	const c: CourtStyle = { ...DEFAULT_COURT };
	const f = chosen.floor?.value.split('|');
	if (f) {
		c.floor = [f[0], f[1]];
		if (f[2]) c.key = f[2];
	}
	if (chosen.key) c.key = chosen.key.value;
	if (chosen.board) c.board = chosen.board.value as CourtStyle['board'];
	if (chosen.net) c.net = chosen.net.value as CourtStyle['net'];
	if (chosen.ball) c.ball = chosen.ball.value as CourtStyle['ball'];
	if (chosen.decal) c.decal = chosen.decal.value as CourtStyle['decal'];
	return c;
}
