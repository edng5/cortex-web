// Keyboard Karaoke: splitting a song into parts for the singers in a room.
//
//  - Songs whose lyrics name their singers ("Jennie: …", "[Rosé] …", "(Lisa) …" at the start of a
//    line, carried on until the next name): each singer goes to a player, at random. More singers
//    than players and players take several; "All" / "Both" lines, and lines two players' singers
//    share, are sung together.
//  - Otherwise, random parts: the song splits into sections (at pauses, and every few lines), dealt
//    out evenly at random; lines that come back (the chorus) are sung together.
// Both screens get the same split from the same lyrics and the host's random seed. The players can
// then hand the roles (the singers, or "Part 1", "Part 2"…) to whoever they like: `assign`, shared
// in the room, overrides the random deal.
import type { Line } from './chart';

/** Who sings a line: a player (their seat), or everyone. */
export type Who = number | 'all';
export interface Parts {
	/** Per line (the chart's lines, in order). */
	who: Who[];
	/** Per line: the singer named in the lyrics, or ''. */
	singer: string[];
	/** Each player's singers (by seat), when the lyrics name them. */
	cast: string[][];
	/** The lines with the singers' names taken off. */
	lines: Line[];
	/** The roles that can be handed out, and who has each (a seat, or 'all'). */
	roles: { key: string; label: string; who: Who }[];
}
/** Who has each role, by its key (a seat, or -1: everyone). */
export type Assign = Record<string, number>;

/** A small seeded random number generator (mulberry32): the same seed, the same numbers. */
export function seeded(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const shuffled = <T>(a: T[], rnd: () => number) => {
	const b = [...a];
	for (let i = b.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[b[i], b[j]] = [b[j], b[i]];
	}
	return b;
};

/** Ad-libs that look like a name in brackets but aren't one. */
const ADLIB = /^(oh+|ooh+|ah+|yeah+|yea|hey|la+|na+|woo+|uh+|mm+|hmm+|whoa+|ay+|eh+|ha+|huh|yo|uh-huh|ooh-ooh|ha-ha|x\d|\d+x|repeat|chorus|verse.*|bridge|intro|outro|pre-?chorus|hook|instrumental|spoken)$/i;
/** "Everyone" labels. */
const ALL = /^(all|both|everyone|everybody|together|group|tutti)$/i;
/** A name at the start of a line: "Name:", "[Name]" or "(Name)", then the words to sing. */
const TAG = /^\s*(?:\[([^\]\n]{1,30})\]|\(([^)\n]{1,30})\)|([^\s:][^:\n]{0,28}?):)\s+(?=\S)/u;

/** The singers named in a label ("Jennie & Lisa", "Rosé, Jisoo and Lisa"), or 'all'. */
function namesIn(label: string): string[] | 'all' {
	const parts = label
		.split(/\s*(?:&|,|\+|\/|\band\b|\bx\b|\bwith\b)\s*/i)
		.map((x) => x.trim())
		.filter(Boolean);
	if (parts.some((x) => ALL.test(x))) return 'all';
	return parts;
}

/** The singers' names read from the lyrics (and the lines without them), if the song has at least two. */
function readSingers(lines: Line[]): { labels: (string[] | 'all' | null)[]; lines: Line[] } | null {
	const found: (string[] | 'all' | null)[] = [];
	const clean: Line[] = [];
	const counts = new Map<string, number>();
	for (const l of lines) {
		const m = l.text.match(TAG);
		const label = m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : '';
		// A label: name-like (not an ad-lib or a section heading), and not too long.
		const ok = label && !ADLIB.test(label) && label.split(/\s+/).length <= 5 && !/[.!?]$/.test(label);
		if (m && ok) {
			const names = namesIn(label);
			found.push(names);
			if (names != 'all') for (const n of names) counts.set(n.toLowerCase(), (counts.get(n.toLowerCase()) ?? 0) + 1);
			const cut = m[0].length;
			clean.push({
				...l,
				text: l.text.slice(cut).trim(),
				// (Its first word or syllable loses the name too.)
				parts: l.parts.map((p, i) => (i == 0 ? { ...p, text: p.text.replace(TAG, '') } : p)).filter((p) => p.text.trim())
			});
		} else {
			found.push(null);
			clean.push(l);
		}
	}
	// Real singers: names that label at least two lines, and at least two of them.
	const real = [...counts.entries()].filter(([, n]) => n >= 2);
	if (real.length < 2) return null;
	return { labels: found, lines: clean };
}

/**
 * Split a song's lines among `players` seats (0, 1, …). `seed`: the host's random seed for this
 * song, so both screens agree.
 */
export function splitParts(lines: Line[], players: number, seed: number, assign: Assign = {}): Parts {
	const rnd = seeded(seed);
	const n = Math.max(1, players);
	const sung = readSingers(lines);
	if (sung) {
		// Singers to players: shuffled, then dealt round the players (several each if need be).
		const names: string[] = [];
		const display = new Map<string, string>();
		for (const lab of sung.labels)
			if (lab && lab != 'all')
				for (const x of lab) {
					const k = x.toLowerCase();
					if (!display.has(k)) {
						display.set(k, x);
						names.push(k);
					}
				}
		const seats = shuffled(
			Array.from({ length: n }, (_, i) => i),
			rnd
		);
		const seatOf = new Map<string, number>();
		shuffled(names, rnd).forEach((k, i) => seatOf.set(k, seats[i % n]));
		// The players' own choices.
		for (const k of names) if (pick(assign['s:' + k], n) != null) seatOf.set(k, pick(assign['s:' + k], n)!);
		const cast: string[][] = Array.from({ length: n }, () => []);
		for (const [k, s] of seatOf) if (s >= 0) cast[s].push(display.get(k)!);
		// Each line: its singer's player (carried on from the last name until the next).
		let current: Who = 'all';
		let currentName = '';
		const who: Who[] = [];
		const singer: string[] = [];
		sung.labels.forEach((lab) => {
			if (lab == 'all') {
				current = 'all';
				currentName = 'All';
			} else if (lab) {
				const s = new Set(lab.map((x) => seatOf.get(x.toLowerCase())).filter((x) => x != null));
				current = s.size == 1 && [...s][0]! >= 0 ? [...s][0]! : 'all';
				currentName = lab.map((x) => display.get(x.toLowerCase()) ?? x).join(' & ');
			}
			who.push(current);
			singer.push(currentName);
		});
		const roles = names.map((k) => ({ key: 's:' + k, label: display.get(k)!, who: (seatOf.get(k)! < 0 ? 'all' : seatOf.get(k)!) as Who }));
		return { who, singer, cast, lines: sung.lines, roles };
	}

	// Random parts. Lines that come back (the chorus): everyone.
	const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
	const seen = new Map<string, number>();
	for (const l of lines) seen.set(norm(l.text), (seen.get(norm(l.text)) ?? 0) + 1);
	// Sections: a new one at a pause (over 2.5 s) or every 4 lines.
	const sections: number[][] = [];
	let cur: number[] = [];
	lines.forEach((l, i) => {
		const gap = i > 0 ? l.start - lines[i - 1].end : 0;
		if (cur.length && (gap > 2.5 || cur.length >= 4)) {
			sections.push(cur);
			cur = [];
		}
		cur.push(i);
	});
	if (cur.length) sections.push(cur);
	// Dealt evenly: each player the same number of sections (give or take one), in a random order.
	const deck = shuffled(
		sections.map((_, i) => i % n),
		rnd
	);
	// "Part 1", "Part 2"…: dealt to the players in turn, unless they've picked otherwise.
	const holder = Array.from({ length: n }, (_, k) => pick(assign['p:' + k], n) ?? k);
	const who: Who[] = lines.map(() => 'all');
	sections.forEach((sec, i) => {
		const h = holder[deck[i]];
		for (const li of sec) who[li] = (seen.get(norm(lines[li].text)) ?? 0) >= 2 || h < 0 ? 'all' : h;
	});
	const roles = holder.map((h, k) => ({ key: 'p:' + k, label: `Part ${k + 1}`, who: (h < 0 ? 'all' : h) as Who }));
	return { who, singer: lines.map(() => ''), cast: Array.from({ length: n }, () => []), lines, roles };
}

/** A player's choice for a role, if it's a real one: a seat, or -1 (everyone). */
function pick(v: unknown, n: number): number | null {
	return typeof v == 'number' && Number.isInteger(v) && v >= -1 && v < n ? v : null;
}
