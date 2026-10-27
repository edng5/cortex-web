// Leaderboard names for E.Ngine Games. Players pick their own name (shown publicly on the global
// high scores), so it is checked before it is saved:
//  - 3–16 characters: letters, numbers, spaces, and _ . - (no emoji, links or look-alike letters)
//  - no slurs, profanity or sexual terms, including spelled with numbers or symbols ("a55", "$h1t")
//    or hidden inside run-together words ("xXfuckXx")
//  - nothing that pretends to be Edward, the site or staff
//  - unique, ignoring case, spaces and punctuation
// Without a chosen name, the board shows the player's email, partly masked.
import { getDb } from './db';
import { loadPersona } from './persona';

export const NAME_MIN = 3;
export const NAME_MAX = 16;

/** Hidden anywhere in a name (after undoing number/symbol swaps) → rejected. Kept to stems that don't occur in ordinary names. */
const BANNED_STEMS = [
	'fuck', 'fck', 'phuck', 'shit', 'cunt', 'bitch', 'biatch', 'whore', 'slut', 'nigg', 'nigga', 'faggot', 'retard', 'molest',
	'paedo', 'pedophile', 'porn', 'pussy', 'penis', 'vagina', 'dildo', 'blowjob', 'handjob', 'boner', 'jizz', 'cumshot',
	'orgasm', 'nude', 'naked', 'hentai', 'onlyfans', 'nazi', 'hitler', 'kkk', 'jihad', 'terrorist', 'killyourself',
	'suicide', 'tranny', 'twat', 'bollock', 'bastard', 'motherf', 'asshole', 'dumbass', 'jackass', 'arsehole', 'douche',
	'cocksuck', 'dickhead', 'xxx'
];
/** Ordinary names that contain a stem above. */
const ALLOWED = ['scunthorpe'];
/**
 * Rejected only as a whole word: they're inside innocent names (Cassie, Dickens, Titan, Essex,
 * Canal, Grape, Therapist, Torpedo, Montenegro, Raccoon, Spicy, Swanky, Thorny, Fukuda…).
 */
const BANNED_WORDS = [
	'ass', 'arse', 'dick', 'cock', 'cum', 'tit', 'tits', 'boob', 'boobs', 'hoe', 'hoes', 'piss', 'crap', 'sex', 'sexy', 'anal', 'anus',
	'fag', 'fags', 'rape', 'raped', 'rapist', 'pedo', 'negro', 'coon', 'spic', 'gook', 'chink', 'kike', 'dyke', 'wank', 'wanker',
	'horny', 'heil', 'isis', 'kys', 'fuk', 'nut', 'nuts', 'balls', 'weed', 'meth', 'coke', 'kill', 'die', 'hate', 'nsfw'
];
/** Impersonation: the site owner, the site's AI, staff. */
const RESERVED = ['edward', 'edwardng', 'eng', 'engine', 'engames', 'cortex', 'admin', 'administrator', 'moderator', 'mod', 'staff', 'official', 'system', 'support', 'root', 'owner', 'anthropic', 'claude', 'gemini'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g', '2': 'z' };

/** Lower-case letters only, with number/symbol swaps undone ("Sh!t_L0rd" → "shitlord"). */
function squash(s: string): string {
	return [...s.toLowerCase()].map((c) => LEET[c] ?? c).join('').replace(/[^a-z]/g, '');
}
/** Same, collapsing repeated letters too ("fuuuck" → "fuck"). */
const unrepeat = (s: string) => s.replace(/(.)\1+/g, '$1');
/** The key names must be unique on: case, spaces and punctuation ignored. */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

/**
 * Check a public name: a leaderboard nickname by default; `what`/`min`/`max` adapt it for other
 * names players choose (an FishMart store's name, a pet fish's name).
 */
export function checkName(raw: unknown, what = 'nickname', min = NAME_MIN, max = NAME_MAX): NameCheck {
	const What = what[0].toUpperCase() + what.slice(1);
	if (typeof raw !== 'string') return { ok: false, message: `Please enter a ${what}.` };
	const name = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
	if (name.length < min || name.length > max) {
		return { ok: false, message: `${What}s are ${min} to ${max} characters.` };
	}
	// Store and fish names may also use ' and & ("Ed's Reef & Co").
	const punct = what === 'nickname' ? '' : "'&";
	if (!new RegExp(`^[A-Za-z0-9][A-Za-z0-9 _.${punct}-]*$`).test(name)) {
		return { ok: false, message: `Use letters, numbers, spaces, and _ . ${punct ? "' & " : ''}- only (starting with a letter or number).` };
	}
	if (!/[A-Za-z]/.test(name)) return { ok: false, message: 'Include at least one letter.' };

	let flat = squash(name);
	for (const ok of ALLOWED) flat = flat.replaceAll(ok, '');
	// Words as typed (split on spaces/punctuation and between letters and numbers), with swaps undone.
	const words = name
		.split(/[^A-Za-z0-9!@$|+]+|(?<=[a-z])(?=[A-Z])/)
		.map(squash)
		.filter(Boolean);
	const extra = loadPersona().blockedTerms.map(squash).filter((t) => t.length >= 3);
	const stems = [...BANNED_STEMS.map(squash), ...extra];
	const inappropriate =
		stems.some((t) => flat.includes(t) || (unrepeat(t).length >= 4 && unrepeat(flat).includes(unrepeat(t)))) ||
		words.some((w) => BANNED_WORDS.includes(w) || BANNED_WORDS.includes(unrepeat(w)));
	if (inappropriate) return { ok: false, message: `That ${what} isn't allowed. Please pick something friendly.` };

	if (RESERVED.includes(squash(name)) || RESERVED.includes(nameKey(name)) || squash(name).startsWith('edwardng') || squash(name).startsWith('admin')) {
		return { ok: false, message: `That ${what} is reserved. Please pick another.` };
	}
	return { ok: true, name };
}

export function getPlayerName(userId: string): string | null {
	const row = getDb().prepare('SELECT name FROM player_names WHERE user_id = ?').get(userId) as { name: string } | undefined;
	return row?.name ?? null;
}

/** Save a checked name. Fails if another player already has it. */
export function setPlayerName(userId: string, name: string): { ok: true } | { ok: false; message: string } {
	const key = nameKey(name);
	const db = getDb();
	const taken = db.prepare('SELECT user_id FROM player_names WHERE name_key = ?').get(key) as { user_id: string } | undefined;
	if (taken && taken.user_id !== userId) return { ok: false, message: 'Someone already has that nickname. Try another.' };
	db.prepare(
		`INSERT INTO player_names (user_id, name, name_key, updated_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key, updated_at = excluded.updated_at`
	).run(userId, name, key, Date.now());
	return { ok: true };
}
