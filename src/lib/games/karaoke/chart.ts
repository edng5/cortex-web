// Keyboard Karaoke: what to sing and when.
//
// Two sources, both plain text:
//  - LRC lyrics (from LRCLIB): "[01:02.50] a line" — a time per line, and in "enhanced" LRC a time
//    per word too: "[01:02.50] <01:02.50> a <01:02.90> line". Lines alone give the timing.
//  - UltraStar note charts (the open format used by UltraStar Deluxe, Vocaluxe, Performous…):
//    "#BPM:" and "#GAP:" in a header, then one note per line, ": start length pitch syllable", in
//    beats (a quarter of the BPM's beat), with pitch in semitones from middle C. "*" marks a golden
//    note (worth double), "F" a freestyle one (not scored), and "-" ends a line of lyrics. A chart
//    gives the pitch guide; its lyrics are used too.

/** One line of lyrics on screen: when it's sung, and its words / syllables with their times. */
export interface Line {
	start: number;
	end: number;
	text: string;
	parts: { t: number; end: number; text: string }[];
	/**
	 * Its words have real times (word-by-word LRC, or a note chart). Most lyrics only time each
	 * line, and then nobody knows when each word comes (a held note mid-line throws any guess
	 * off), so the line is shown as a whole rather than wiped word by word.
	 */
	timed: boolean;
}
/** A note to sing (seconds of the video, MIDI pitch: 60 = middle C). */
export interface Note {
	start: number;
	end: number;
	midi: number;
	text: string;
	golden: boolean;
	free: boolean;
}
export interface Chart {
	lines: Line[];
	notes: Note[];
}

const stamp = (m: string, s: string) => Number(m) * 60 + Number(s);

export function parseLRC(lrc: string): Line[] {
	let offset = 0;
	const raw: { t: number; text: string; words: { t: number; text: string }[] }[] = [];
	for (const row of lrc.split(/\r?\n/)) {
		const off = row.match(/^\[offset:\s*([+-]?\d+)\]/i);
		if (off) offset = Number(off[1]) / 1000;
		const times = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
		if (!times.length) continue;
		const body = row.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '');
		// Enhanced LRC: a time before each word.
		const words = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)].map((w) => ({ t: stamp(w[1], w[2]), text: w[3] }));
		const text = body.replace(/<\d+:\d+(?:\.\d+)?>/g, '').replace(/\s+/g, ' ').trim();
		for (const t of times) raw.push({ t: stamp(t[1], t[2]), text, words });
	}
	raw.sort((a, b) => a.t - b.t);
	// LRC times count from the recording's start; [offset] shifts them (lyrics later when positive).
	const lines: Line[] = [];
	raw.forEach((r, i) => {
		if (!r.text) return; // a blank stamped line just ends the previous one
		const start = r.t - offset;
		const next = raw[i + 1] ? raw[i + 1].t - offset : start + 6;
		// How long the line takes to sing: about a quarter of a second a syllable (and never past the
		// next line). Stretching it over the whole gap would drag the words through instrumental breaks.
		const sung = 0.35 + syllables(r.text) * 0.26;
		// With only the line's start known, it lasts until the next line (leaving room for held
		// words), but not across a long instrumental break.
		const end = r.words.length ? Math.min(next - 0.05, start + Math.max(1, sung)) : Math.min(next - 0.05, start + Math.max(2, sung * 1.8 + 1));
		const parts = r.words.length
			? r.words.map((w, k) => ({ t: w.t - offset, end: r.words[k + 1] ? r.words[k + 1].t - offset : Math.max(w.t - offset + 0.3, end), text: w.text }))
			: // No word times: pace the words over the line by their syllables.
				spread(r.text, start, end);
		lines.push({ start, end, text: r.text, parts, timed: r.words.length > 0 });
	});
	return lines;
}

/** Syllables in some lyrics: vowel groups in Latin script; a syllable a character in CJK and Hangul. */
export function syllables(text: string) {
	let n = 0;
	for (const w of text.toLowerCase().split(/\s+/)) {
		if (!w) continue;
		const cjk = w.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
		const latin = w.replace(/[^a-z\u00e0-\u024f]/g, '').replace(/e$/, '').match(/[aeiouy\u00e0-\u00ff]+/g)?.length ?? 0;
		n += cjk + (cjk ? 0 : Math.max(w.replace(/[^a-z0-9\u00e0-\u024f]/g, '') ? 1 : 0, latin));
	}
	return Math.max(1, n);
}

function spread(text: string, start: number, end: number) {
	const words = text.split(' ').map((w, i, a) => (i < a.length - 1 ? w + ' ' : w));
	const total = words.reduce((n, w) => n + syllables(w), 0) || 1;
	let t = start;
	return words.map((w) => {
		const d = ((end - start) * syllables(w)) / total;
		const p = { t, end: t + d, text: w };
		t += d;
		return p;
	});
}

export function parseUltraStar(txt: string): Chart & { title?: string; artist?: string } {
	let bpm = 0;
	let gap = 0;
	let title: string | undefined;
	let artist: string | undefined;
	const notes: Note[] = [];
	const breaks: number[] = [];
	for (const row of txt.split(/\r?\n/)) {
		const h = row.match(/^#([A-Z]+):(.*)$/i);
		if (h) {
			const v = h[2].trim().replace(',', '.');
			const k = h[1].toUpperCase();
			if (k == 'BPM') bpm = Number(v);
			else if (k == 'GAP') gap = Number(v) / 1000;
			else if (k == 'TITLE') title = h[2].trim();
			else if (k == 'ARTIST') artist = h[2].trim();
			continue;
		}
		if (!bpm) continue;
		const beat = 60 / (bpm * 4);
		const n = row.match(/^([:*FRG])\s+(-?\d+)\s+(\d+)\s+(-?\d+)\s?(.*)$/);
		if (n) {
			const start = gap + Number(n[2]) * beat;
			notes.push({ start, end: start + Number(n[3]) * beat, midi: 60 + Number(n[4]), text: n[5], golden: n[1] == '*' || n[1] == 'G', free: n[1] == 'F' || n[1] == 'R' });
			continue;
		}
		const b = row.match(/^-\s*(-?\d+)/);
		if (b) breaks.push(gap + Number(b[1]) * beat);
		if (row.trim() == 'E') break;
	}
	// Lines: the notes between line breaks.
	const lines: Line[] = [];
	let cur: Note[] = [];
	const flush = () => {
		if (!cur.length) return;
		lines.push({
			timed: true,
			start: cur[0].start,
			end: cur[cur.length - 1].end,
			text: cur.map((x) => x.text).join('').trim(),
			parts: cur.map((x) => ({ t: x.start, end: x.end, text: x.text }))
		});
		cur = [];
	};
	let bi = 0;
	for (const note of notes) {
		while (bi < breaks.length && breaks[bi] <= note.start) {
			flush();
			bi++;
		}
		cur.push(note);
	}
	flush();
	return { lines, notes, title, artist };
}

/** The line being sung at time t (or the next one coming up), and the one after it. */
export function linesAt(lines: Line[], t: number): { now: Line | null; next: Line | null } {
	const i = lines.findIndex((l) => t < l.end);
	if (i < 0) return { now: null, next: null };
	return { now: lines[i], next: lines[i + 1] ?? null };
}
