// Sound for E.Ngine Games: soundtracks (menus, and gameplay by mode / difficulty) and sound
// effects, all original and synthesized live with the Web Audio API (no recordings, so nothing to
// license). One shared engine for every game: each game names the soundtrack it wants
// (`musicTrack()`, e.g. 'fishy-2'), the host passes it to `music()`, and games call
// `play('name')` for sound effects.
import type { GameId } from './registry';

const STORAGE_KEY = 'engine-games-muted';
const VOLUME = 0.32;

// ── Music: a tiny step sequencer (one step = an eighth note) ─────────────────────────────
// Patterns are space-separated tokens: a note (C4, F#3, Bb2), "." for a rest, "-" to hold.
type Voice = 'square' | 'triangle' | 'sine' | 'sawtooth' | 'pluck' | 'bell';
interface Track {
	bpm: number;
	/** Soundtrack loudness (menus 1; gameplay quieter, so the sound effects stay clear). */
	gain?: number;
	parts: { voice: Voice; level: number; notes: string; detune?: number }[];
	/** Drums, one character per step: k kick, s snare, h hat, . nothing. */
	drums?: string;
}

const TRACKS: Record<string, Track> = {
	// Top Gun: an original, soaring 80s-style anthem in E minor (big pads, slow heroic lead).
	'topgun-menu': {
		bpm: 104,
		parts: [
			{
				voice: 'sawtooth',
				level: 0.035,
				notes:
					'E4 - - - G4 - A4 - B4 - - - - - A4 B4 C5 - - - B4 - A4 - G4 - - - A4 - - - ' +
					'B4 - - - D5 - E5 - F#5 - - - E5 - D5 - E5 - - - - - - - . . . . . . . . '
			},
			{ voice: 'square', level: 0.018, notes: 'E3 - - - - - - - C3 - - - - - - - D3 - - - - - - - B2 - - - - - - - ' },
			{ voice: 'square', level: 0.018, notes: 'B3 - - - - - - - G3 - - - - - - - A3 - - - - - - - F#3 - - - - - - - ' },
			{
				voice: 'triangle',
				level: 0.09,
				notes: 'E2 E2 E2 E2 E2 E2 E2 E2 C2 C2 C2 C2 C2 C2 C2 C2 D2 D2 D2 D2 D2 D2 D2 D2 B1 B1 B1 B1 B1 B1 B1 B1 '
			}
		],
		drums: 'k...s...k.k.s...'
	},
	// Fishy: bouncy and bubbly, in F major.
	'fishy-menu': {
		bpm: 108,
		parts: [
			{
				voice: 'pluck',
				level: 0.07,
				notes:
					'F4 A4 C5 A4 F5 . C5 . D5 C5 A4 F4 G4 . . . ' +
					'Bb4 D5 F5 D5 Bb4 . G4 . A4 C5 F5 C5 A4 . . . ' +
					'F4 A4 C5 A4 F5 . C5 . D5 C5 A4 F4 G4 . A4 Bb4 ' +
					'C5 . A4 . G4 . E4 . F4 . . . . . . . '
			},
			{ voice: 'sine', level: 0.08, notes: 'F2 . . F2 C3 . . . Bb1 . . Bb1 F2 . . . F2 . . F2 C3 . . . C2 . . C2 G2 . C2 . ' },
			{ voice: 'bell', level: 0.025, notes: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . F6 . C6 . ' }
		],
		drums: 'k..hk.h.k..hk.hh'
	},
	// Space Invaders: dark, pulsing and alien, in E minor.
	'spaceinvaders-menu': {
		bpm: 96,
		parts: [
			{ voice: 'square', level: 0.045, notes: 'E2 E2 D2 D2 C2 C2 B1 B1 E2 E2 D2 D2 C2 C2 B1 B1 ' },
			{
				voice: 'sine',
				level: 0.06,
				detune: 12,
				notes:
					'. . . . E5 - - - G5 - F#5 - E5 - - - ' +
					'. . . . B4 - - - D5 - C5 - B4 - - - ' +
					'. . . . E5 - - - G5 - A5 - B5 - - - ' +
					'C6 - B5 - A5 - G5 - F#5 - - - - - - - '
			}
		],
		drums: 'k...h...k...h.h.'
	},
	// Pong × Brick Breaker: bright, upbeat synth pop in C major.
	'pong-menu': {
		bpm: 126,
		parts: [
			{
				voice: 'square',
				level: 0.04,
				notes:
					'C5 . E5 . G5 . E5 . A5 . G5 . E5 . D5 . ' +
					'F5 . A5 . C6 . A5 . G5 - - - . . . . ' +
					'C5 . E5 . G5 . E5 . A5 . G5 . E5 . C5 . ' +
					'D5 . E5 . F5 . D5 . C5 - - - . . . . '
			},
			{ voice: 'triangle', level: 0.09, notes: 'C3 C3 G2 G2 A2 A2 E2 E2 F2 F2 C3 C3 G2 G2 G2 G2 ' }
		],
		drums: 'k.h.s.h.k.k.s.hh'
	},
	// Frogger: a cheerful, swampy tune in G major.
	'frogger-menu': {
		bpm: 110,
		parts: [
			{ voice: 'pluck', level: 0.07, notes: 'G4 B4 D5 . B4 . G4 . A4 C5 E5 . C5 . A4 . B4 D5 G5 . D5 . B4 . A4 - - - . . . . ' },
			{ voice: 'sine', level: 0.08, notes: 'G2 . . G2 D3 . . . A2 . . A2 E3 . . . G2 . . G2 D3 . . . D2 . . D2 A2 . D2 . ' },
			{ voice: 'bell', level: 0.025, notes: '. . . . . . . . . . . . . . . . . . . . . . . . G6 . D6 . B5 . . . ' }
		],
		drums: 'k..hk.h.k..hk.hh'
	},
	// ── Gameplay soundtracks (quieter than the menus) ──
	// Top Gun missions: an original, driving 80s synth-rock track, kept quiet under the action.
	'topgun-play': {
		bpm: 144,
		gain: 0.35,
		parts: [
			{ voice: 'sawtooth', level: 0.035, notes: 'A1 A1 A2 A1 A1 A1 A2 A1 F1 F1 F2 F1 G1 G1 G2 G1 ' },
			{ voice: 'square', level: 0.025, notes: '. . A3 . . . A3 . . . F3 . . . G3 . ' },
			{ voice: 'square', level: 0.03, notes: 'A4 - - - C5 - D5 - E5 - - - D5 - C5 - D5 - - - C5 - A4 - G4 - - - A4 - - - ' }
		],
		drums: 'k.h.s.h.k.k.s.h.'
	},
	// Fishy, by difficulty: calm, then tense, then frantic; and a playful duel for 2P local.
	'fishy-1': {
		bpm: 96,
		gain: 0.55,
		parts: [
			{ voice: 'pluck', level: 0.07, notes: 'C5 . A4 . F4 . A4 . Bb4 . G4 . E4 . G4 . A4 . F4 . C4 . F4 . G4 - - - . . . . ' },
			{ voice: 'sine', level: 0.08, notes: 'F2 . . . C3 . . . Bb1 . . . C2 . . . F2 . . . C3 . . . C2 . . . C2 . . . ' }
		],
		drums: 'k.....h.k.....h.'
	},
	'fishy-2': {
		bpm: 112,
		gain: 0.55,
		parts: [
			{ voice: 'pluck', level: 0.07, notes: 'D5 F5 A5 F5 D5 . C5 . Bb4 D5 F5 D5 A4 . . . G4 Bb4 D5 Bb4 G4 . F4 . E4 G4 A4 C5 D5 . . . ' },
			{ voice: 'triangle', level: 0.09, notes: 'D2 . D3 . D2 . D3 . Bb1 . Bb2 . Bb1 . Bb2 . G1 . G2 . G1 . G2 . A1 . A2 . A1 . C#2 . ' }
		],
		drums: 'k.h.s.h.k.h.s.hh'
	},
	'fishy-3': {
		bpm: 136,
		gain: 0.55,
		parts: [
			{ voice: 'square', level: 0.035, notes: 'E5 . F5 . E5 . B4 . C5 . B4 . A4 . B4 . E5 . F5 . G5 . F5 . E5 - - - . . . . ' },
			{ voice: 'sawtooth', level: 0.03, notes: 'E2 E2 E3 E2 F2 F2 F3 F2 E2 E2 E3 E2 D2 D2 D3 C2 ' }
		],
		drums: 'k.hsk.hsk.hsk.ss'
	},
	'fishy-2p': {
		bpm: 120,
		gain: 0.55,
		parts: [
			{ voice: 'square', level: 0.035, notes: 'G4 B4 D5 B4 G5 . D5 . E5 D5 B4 G4 A4 . . . C5 E5 G5 E5 C5 . A4 . B4 D5 G5 D5 B4 . . . ' },
			{ voice: 'triangle', level: 0.09, notes: 'G2 . G2 D3 G2 . G2 D3 C2 . C2 G2 D2 . D2 A2 ' }
		],
		drums: 'k.h.s.h.k.k.s.h.'
	},
	// Space Invaders, by difficulty: sparse and eerie (Normal), darker (Hard), urgent (No Shields).
	// Kept light so the invaders' marching beat still comes through.
	'spaceinvaders-1': {
		bpm: 100,
		gain: 0.5,
		parts: [
			{ voice: 'sine', level: 0.06, detune: 12, notes: '. . . . B4 - - - . . . . A4 - G4 - . . . . E5 - - - D5 - B4 - - - - - ' },
			{ voice: 'triangle', level: 0.09, notes: 'E2 . . . E2 . . . C2 . . . D2 . . . ' }
		],
		drums: 'k.......k.......'
	},
	'spaceinvaders-2': {
		bpm: 116,
		gain: 0.5,
		parts: [
			{ voice: 'square', level: 0.03, notes: 'E5 - D5 - B4 - G4 - A4 - B4 - G4 - E4 - E5 - D5 - B4 - D5 - E5 - - - F#5 - - - ' },
			{ voice: 'sawtooth', level: 0.03, notes: 'E2 E2 B1 B1 C2 C2 D2 D2 ' }
		],
		drums: 'k...s...k.k.s...'
	},
	'spaceinvaders-3': {
		bpm: 136,
		gain: 0.5,
		parts: [
			{ voice: 'square', level: 0.03, notes: 'E5 G5 B5 G5 E5 G5 B5 G5 F5 A5 C6 A5 F5 A5 C6 A5 E5 G5 B5 G5 D5 F#5 A5 F#5 E5 - - - . . . . ' },
			{ voice: 'sawtooth', level: 0.03, notes: 'E2 E3 E2 E3 F2 F3 F2 F3 E2 E3 E2 E3 D2 D3 D#2 D#3 ' }
		],
		drums: 'k.hsk.hsk.hsk.hs'
	},
	// Brick Breaker: bouncy, in A minor.
	'pong-brick': {
		bpm: 118,
		gain: 0.55,
		parts: [
			{ voice: 'square', level: 0.035, notes: 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 . F5 . A5 . C6 . A5 . G5 - - - . . . . ' },
			{ voice: 'triangle', level: 0.09, notes: 'A2 . A2 E3 F2 . F2 C3 G2 . G2 D3 E2 . E2 B2 ' }
		],
		drums: 'k.h.k.s.k.h.k.s.'
	},
	// FishMart: a relaxed, bubbly shop tune in F major (it plays for a long time, so it stays gentle).
	'ifish-store': {
		bpm: 92,
		gain: 0.55,
		parts: [
			{ voice: 'pluck', level: 0.06, notes: 'F4 . A4 . C5 . A4 . G4 . Bb4 . D5 . Bb4 . A4 . C5 . F5 . C5 . G4 . E4 . C4 - - - ' },
			{ voice: 'sine', level: 0.08, notes: 'F2 . . . C3 . . . G2 . . . D3 . . . F2 . . . A2 . . . C2 . . . C2 . . . ' },
			{ voice: 'bell', level: 0.018, notes: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . A6 . F6 . ' }
		],
		drums: 'k...h...k...h..h'
	},
	// More shop tunes (the store rotates through all three): a laid-back café groove in B-flat…
	'ifish-store-2': {
		bpm: 86,
		gain: 0.55,
		parts: [
			{ voice: 'pluck', level: 0.06, notes: 'D5 . F5 . Bb5 . A5 . G5 . F5 . D5 . C5 . Eb5 . G5 . F5 . D5 . Bb4 . C5 - - - . . ' },
			{ voice: 'sine', level: 0.08, notes: 'Bb1 . . Bb1 F2 . . . G1 . . G1 D2 . . . Eb2 . . Eb2 Bb2 . . . F1 . . F1 C2 . F1 . ' },
			{ voice: 'bell', level: 0.018, notes: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . F6 . D6 . ' }
		],
		drums: 'k..hs..hk..hs.h.'
	},
	// …and a slow, dreamy drift through the kelp, in D major.
	'ifish-store-3': {
		bpm: 76,
		gain: 0.55,
		parts: [
			{ voice: 'bell', level: 0.03, notes: 'F#5 - - - A5 - - - E5 - - - D5 - - - B4 - - - D5 - - - A4 - - - - - - - ' },
			{ voice: 'pluck', level: 0.04, notes: 'D4 F#4 A4 F#4 D4 F#4 A4 F#4 B3 D4 F#4 D4 B3 D4 F#4 D4 G3 B3 D4 B3 G3 B3 D4 B3 A3 C#4 E4 C#4 A3 C#4 E4 C#4 ' },
			{ voice: 'triangle', level: 0.05, notes: 'D3 - - - - - - - B2 - - - - - - - G2 - - - - - - - A2 - - - - - - - ' }
		],
		drums: 'k.......h.......'
	},
	// Fishing: an easy-going riverbank twang in G major.
	'ifish-fishing': {
		bpm: 100,
		gain: 0.55,
		parts: [
			{ voice: 'pluck', level: 0.07, notes: 'D5 . B4 . G4 . B4 D5 E5 . D5 . B4 . . . C5 . E5 . D5 . B4 . A4 . G4 . A4 - - - ' },
			{ voice: 'sine', level: 0.08, notes: 'G2 . D3 . G2 . D3 . G2 . D3 . G2 . D3 . C3 . G2 . C3 . G2 . D3 . A2 . D3 . A2 . ' }
		],
		drums: 'k..h.hk.k..h.h..'
	},
	// The market (other players' stores): a bright, busy market-day tune in C major.
	'ifish-market': {
		bpm: 112,
		gain: 0.5,
		parts: [
			{ voice: 'square', level: 0.03, notes: 'E5 . G5 . C6 . G5 . A5 . F5 . C5 . F5 . G5 . E5 . C5 . E5 . D5 . B4 . G4 - - - ' },
			{ voice: 'triangle', level: 0.09, notes: 'C3 . C3 . G2 . C3 . F2 . F2 . C3 . F2 . C3 . C3 . G2 . C3 . G2 . G2 . D3 . G2 . ' }
		],
		drums: 'k.h.s.h.k.h.s.hh'
	},
	// Pong: one tune that speeds up with each stage (FASTER!, SHRINKED!, DOUBLE TROUBLE!, FASTERR!!!).
	...Object.fromEntries(
		[112, 124, 134, 144, 158].map((bpm, stage): [string, Track] => [
			`pong-${stage}`,
			{
				bpm,
				gain: 0.55,
				parts: [
					{ voice: 'square', level: 0.035, notes: 'C5 . G4 . C5 . E5 . D5 . G4 . B4 . D5 . C5 . G4 . C5 . E5 . F5 . E5 . D5 . B4 . ' },
					{ voice: 'triangle', level: 0.09, notes: 'C3 . C3 . G2 . G2 . A2 . A2 . F2 . G2 . ' }
				],
				drums: 'k.h.s.h.k.h.s.h.'
			}
		])
	),
	// Frogger: a bouncy hop-along tune that gets faster every two levels.
	...Object.fromEntries(
		[120, 134, 150].map((bpm, i): [string, Track] => [
			`frogger-play-${i + 1}`,
			{
				bpm,
				gain: 0.55,
				parts: [
					{ voice: 'square', level: 0.035, notes: 'C5 . E5 G5 . E5 C5 . D5 . F5 A5 . F5 D5 . E5 . G5 C6 . G5 E5 . D5 . B4 G4 . . . . ' },
					{ voice: 'triangle', level: 0.09, notes: 'C3 . G2 . C3 . G2 . D3 . A2 . D3 . A2 . E3 . B2 . E3 . B2 . G2 . D3 . G2 . G2 . ' }
				],
				drums: 'k.h.s.h.k.k.s.h.'
			}
		])
	)
};

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(tok: string): number | null {
	const m = tok.match(/^([A-G])([#b]?)(-?\d)$/);
	if (!m) return null;
	return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Each part as steps: a note with its length in steps, or null (rest / held). */
function parse(notes: string): ({ m: number; len: number } | null)[] {
	const toks = notes.trim().split(/\s+/);
	const out: ({ m: number; len: number } | null)[] = toks.map(() => null);
	toks.forEach((t, i) => {
		const m = midi(t);
		if (m === null) return;
		let len = 1;
		while (toks[i + len] === '-') len++;
		out[i] = { m, len };
	});
	return out;
}

class GameAudio {
	muted = $state(false);
	private ctx: AudioContext | null = null;
	private out: GainNode | null = null;
	private musicBus: GainNode | null = null;
	private noiseBuf: AudioBuffer | null = null;
	private track: string | null = null;
	private step = 0;
	private nextStep = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private parsed = new Map<string, ReturnType<typeof parse>[]>();

	constructor() {
		if (typeof localStorage !== 'undefined') {
			try {
				this.muted = localStorage.getItem(STORAGE_KEY) === '1';
			} catch {
				/* storage blocked */
			}
		}
	}

	toggle() {
		this.muted = !this.muted;
		try {
			localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
		} catch {
			/* storage blocked */
		}
		if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.ctx.currentTime, 0.05);
	}

	/** Create / wake the audio context (the visitor has clicked to open a game by then). */
	private ensure(): AudioContext | null {
		if (typeof window === 'undefined') return null;
		if (!this.ctx) {
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return null;
			this.ctx = new Ctx();
			this.out = this.ctx.createGain();
			this.out.gain.value = this.muted ? 0 : VOLUME;
			this.out.connect(this.ctx.destination);
			this.musicBus = this.ctx.createGain();
			this.musicBus.gain.value = 0;
			this.musicBus.connect(this.out);
			const len = this.ctx.sampleRate;
			this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
			const d = this.noiseBuf.getChannelData(0);
			for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		}
		if (this.ctx.state === 'suspended') this.ctx.resume();
		return this.ctx;
	}

	/** Pause everything (the games pop-up is closed) or carry on. */
	setActive(on: boolean) {
		if (!this.ctx) return;
		if (on) this.ctx.resume();
		else {
			this.music(null);
			this.ctx.suspend();
		}
	}

	// ── Menu music ──
	/** Play a soundtrack by name (null = silence). Safe to call every frame. */
	music(id: string | null) {
		if (id === this.track) return;
		const ctx = id ? this.ensure() : this.ctx;
		if (!ctx || !this.musicBus) return;
		const now = ctx.currentTime;
		this.musicBus.gain.cancelScheduledValues(now);
		this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
		if (!id) {
			// Fade out; notes already scheduled ring out under the fade.
			this.musicBus.gain.linearRampToValueAtTime(0, now + 0.4);
			this.track = null;
			if (this.timer) clearInterval(this.timer);
			this.timer = null;
			return;
		}
		if (!TRACKS[id]) return;
		this.track = id;
		if (!this.parsed.has(id)) this.parsed.set(id, TRACKS[id].parts.map((p) => parse(p.notes)));
		this.step = 0;
		this.nextStep = now + 0.1;
		this.musicBus.gain.linearRampToValueAtTime(TRACKS[id].gain ?? 1, now + 0.8);
		if (!this.timer) this.timer = setInterval(() => this.schedule(), 100);
		this.schedule();
	}

	/** Stop the soundtrack if it's this game's (the game was hidden). */
	stopIf(game: GameId) {
		if (this.track?.startsWith(game + '-')) this.music(null);
	}

	private schedule() {
		const ctx = this.ctx;
		const id = this.track;
		if (!ctx || !id || ctx.state !== 'running') return;
		const tr = TRACKS[id];
		const parts = this.parsed.get(id)!;
		const dur = 60 / tr.bpm / 2;
		while (this.nextStep < ctx.currentTime + 0.25) {
			const t = this.nextStep;
			tr.parts.forEach((p, i) => {
				const steps = parts[i];
				const n = steps[this.step % steps.length];
				if (n) this.note(p.voice, hz(n.m), t, n.len * dur, p.level, p.detune);
			});
			if (tr.drums) {
				const d = tr.drums[this.step % tr.drums.length];
				if (d === 'k') this.kick(t);
				else if (d === 's') this.snare(t);
				else if (d === 'h') this.hat(t);
			}
			this.nextStep += dur;
			this.step++;
		}
	}

	private note(voice: Voice, f: number, t: number, dur: number, level: number, detune = 0) {
		const ctx = this.ctx!;
		const env = ctx.createGain();
		env.connect(this.musicBus!);
		const o = ctx.createOscillator();
		o.type = voice === 'pluck' || voice === 'bell' ? 'triangle' : voice;
		o.frequency.value = f;
		if (detune) {
			// Gentle vibrato for the spacey lead.
			const lfo = ctx.createOscillator();
			const depth = ctx.createGain();
			lfo.frequency.value = 5;
			depth.gain.value = detune;
			lfo.connect(depth).connect(o.detune);
			lfo.start(t);
			lfo.stop(t + dur + 0.3);
		}
		o.connect(env);
		const g = env.gain;
		g.setValueAtTime(0, t);
		if (voice === 'pluck' || voice === 'bell') {
			const ring = voice === 'bell' ? 1.2 : 0.35;
			g.linearRampToValueAtTime(level, t + 0.005);
			g.exponentialRampToValueAtTime(0.0001, t + ring);
			o.start(t);
			o.stop(t + ring + 0.05);
		} else {
			g.linearRampToValueAtTime(level, t + 0.01);
			g.setValueAtTime(level, t + Math.max(0.02, dur - 0.04));
			g.linearRampToValueAtTime(0, t + dur);
			o.start(t);
			o.stop(t + dur + 0.05);
		}
	}

	private kick(t: number) {
		const ctx = this.ctx!;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.frequency.setValueAtTime(130, t);
		o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
		g.gain.setValueAtTime(0.18, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		o.connect(g).connect(this.musicBus!);
		o.start(t);
		o.stop(t + 0.2);
	}
	private snare(t: number) {
		this.noise(t, 0.12, 0.07, 'bandpass', 1800, 1800, this.musicBus!);
	}
	private hat(t: number) {
		this.noise(t, 0.04, 0.03, 'highpass', 7000, 7000, this.musicBus!);
	}

	// ── Sound effects ──
	private tone(type: OscillatorType, f0: number, f1: number, dur: number, level: number, delay = 0) {
		const ctx = this.ctx!;
		const t = ctx.currentTime + delay;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		g.gain.setValueAtTime(level, t);
		g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
		o.connect(g).connect(this.out!);
		o.start(t);
		o.stop(t + dur + 0.02);
	}
	private noise(t: number, dur: number, level: number, type: BiquadFilterType, f0: number, f1: number, dest: AudioNode, delay = 0) {
		const ctx = this.ctx!;
		t += delay;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuf;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.setValueAtTime(f0, t);
		filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(level, t);
		g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
		src.connect(filter).connect(g).connect(dest);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
	}
	private fx(dur: number, level: number, type: BiquadFilterType, f0: number, f1: number, delay = 0) {
		this.noise(this.ctx!.currentTime, dur, level, type, f0, f1, this.out!, delay);
	}
	private arp(notes: number[], gap: number, type: OscillatorType, level: number, len = 0.18) {
		notes.forEach((m, i) => this.tone(type, hz(m), hz(m), len, level, i * gap));
	}

	/** Play a named sound effect for a game. Unknown names are ignored. */
	play(game: GameId, name: string) {
		if (this.muted || !this.ensure()) return;
		const S = SOUNDS[game]?.[name] ?? SOUNDS.common[name];
		S?.(this);
	}

	// Building blocks the sound table uses.
	_tone = this.tone.bind(this);
	_fx = this.fx.bind(this);
	_arp = this.arp.bind(this);
}

type Sound = (a: GameAudio) => void;
const SOUNDS: Record<GameId | 'common', Record<string, Sound>> = {
	common: {
		select: (a) => a._tone('square', 660, 660, 0.05, 0.05),
		confirm: (a) => a._arp([72, 79], 0.06, 'square', 0.05, 0.08),
		win: (a) => a._arp([60, 64, 67, 72, 76, 79, 84], 0.09, 'square', 0.06, 0.2),
		lose: (a) => a._arp([67, 63, 60, 55, 51, 48], 0.13, 'triangle', 0.09, 0.25)
	},
	topgun: {
		gun: (a) => {
			a._fx(0.08, 0.16, 'bandpass', 2400, 800);
			a._tone('square', 900, 250, 0.07, 0.05);
		},
		missile: (a) => {
			a._fx(0.9, 0.12, 'bandpass', 500, 2600);
			a._tone('sawtooth', 120, 260, 0.6, 0.04);
		},
		boom: (a) => {
			a._fx(0.9, 0.35, 'lowpass', 1600, 60);
			a._tone('sine', 90, 30, 0.6, 0.25);
		},
		hit: (a) => {
			a._tone('square', 240, 70, 0.25, 0.08);
			a._fx(0.25, 0.15, 'lowpass', 3000, 300);
		},
		baseHit: (a) => {
			a._fx(0.35, 0.18, 'lowpass', 1200, 120);
			a._tone('triangle', 160, 60, 0.3, 0.12);
		}
	},
	fishy: {
		eat: (a) => {
			a._tone('sine', 320, 980, 0.12, 0.16);
			a._tone('sine', 700, 1400, 0.06, 0.06, 0.06);
		},
		eaten: (a) => {
			a._tone('sine', 260, 50, 0.45, 0.22);
			a._fx(0.35, 0.12, 'lowpass', 900, 100);
		},
		hooked: (a) => {
			for (let i = 0; i < 4; i++) a._tone('square', 300 + i * 120, 420 + i * 120, 0.08, 0.04, i * 0.09);
		},
		bubble: (a) => a._tone('sine', 500, 1100, 0.08, 0.05)
	},
	spaceinvaders: {
		laser: (a) => a._tone('square', 1300, 180, 0.16, 0.05),
		alienDie: (a) => {
			a._fx(0.28, 0.18, 'bandpass', 1800, 300);
			a._tone('square', 520, 60, 0.25, 0.05);
		},
		alienShot: (a) => a._tone('sawtooth', 300, 120, 0.12, 0.025),
		step0: (a) => a._tone('square', 98, 96, 0.09, 0.07),
		step1: (a) => a._tone('square', 87, 85, 0.09, 0.07),
		step2: (a) => a._tone('square', 78, 76, 0.09, 0.07),
		step3: (a) => a._tone('square', 73, 71, 0.09, 0.07),
		ufo: (a) => {
			a._tone('sine', 700, 1000, 0.12, 0.035);
			a._tone('sine', 1000, 700, 0.12, 0.035, 0.12);
		},
		ufoDie: (a) => a._arp([84, 79, 76, 72, 67], 0.05, 'square', 0.05, 0.08),
		playerDie: (a) => {
			a._fx(0.9, 0.3, 'lowpass', 2500, 80);
			a._tone('sawtooth', 400, 40, 0.8, 0.06);
		},
		bossHit: (a) => a._tone('square', 180, 120, 0.08, 0.06),
		bossDie: (a) => {
			a._fx(1.4, 0.35, 'lowpass', 2000, 50);
			a._arp([60, 67, 72, 79, 84], 0.1, 'square', 0.05, 0.2);
		},
		wave: (a) => a._arp([64, 67, 71, 76], 0.08, 'square', 0.05, 0.12)
	},
	frogger: {
		hop: (a) => a._tone('square', 420, 760, 0.07, 0.045),
		splash: (a) => {
			a._fx(0.6, 0.25, 'lowpass', 2400, 200);
			a._tone('sine', 500, 120, 0.35, 0.08);
		},
		squash: (a) => {
			a._tone('square', 180, 50, 0.3, 0.08);
			a._fx(0.3, 0.2, 'lowpass', 1800, 150);
		},
		home: (a) => a._arp([72, 76, 79, 84], 0.07, 'square', 0.05, 0.12),
		coin: (a) => {
			a._tone('square', 988, 988, 0.07, 0.05);
			a._tone('square', 1319, 1319, 0.16, 0.05, 0.07);
		},
		levelUp: (a) => a._arp([60, 64, 67, 72, 76, 79, 84, 88], 0.07, 'square', 0.05, 0.14),
		crank: (a) => {
			for (let i = 0; i < 6; i++) a._fx(0.04, 0.12, 'bandpass', 2600, 2000, i * 0.13);
		},
		prize: (a) => a._arp([76, 79, 84, 88, 91, 96], 0.06, 'triangle', 0.08, 0.3),
		bell: (a) => {
			for (let i = 0; i < 4; i++) a._tone('triangle', 1760, 1700, 0.18, 0.06, i * 0.3);
		},
		train: (a) => {
			a._fx(1.6, 0.22, 'lowpass', 600, 200);
			a._tone('sawtooth', 220, 180, 0.5, 0.05);
			a._tone('sawtooth', 277, 230, 0.5, 0.04);
		},
		caught: (a) => {
			a._tone('square', 1200, 700, 0.25, 0.05);
			a._tone('square', 1100, 600, 0.25, 0.05, 0.22);
		}
	},
	ifish: {
		click: (a) => a._tone('square', 880, 880, 0.03, 0.03),
		coin: (a) => {
			a._tone('square', 988, 988, 0.06, 0.04);
			a._tone('square', 1319, 1319, 0.12, 0.04, 0.06);
		},
		splash: (a) => {
			a._fx(0.4, 0.18, 'lowpass', 2600, 300);
			a._tone('sine', 600, 160, 0.25, 0.06);
		},
		crate: (a) => {
			a._fx(0.25, 0.2, 'lowpass', 1200, 150);
			a._tone('square', 200, 120, 0.15, 0.06);
		},
		reveal: (a) => a._arp([72, 76, 79], 0.07, 'triangle', 0.08, 0.15),
		rare: (a) => a._arp([72, 76, 79, 84, 88, 91], 0.07, 'triangle', 0.09, 0.25),
		reel: (a) => a._tone('square', 1500, 1500, 0.02, 0.015),
		catch: (a) => a._arp([67, 72, 76, 79, 84], 0.08, 'square', 0.05, 0.18),
		escape: (a) => a._arp([67, 63, 60], 0.1, 'triangle', 0.08, 0.2),
		bite: (a) => {
			a._tone('sine', 900, 500, 0.12, 0.08);
			a._tone('sine', 900, 500, 0.12, 0.08, 0.15);
		},
		feed: (a) => a._fx(0.3, 0.08, 'bandpass', 3000, 1200),
		done: (a) => a._arp([76, 79, 84], 0.08, 'triangle', 0.07, 0.15),
		error: (a) => a._tone('square', 200, 160, 0.15, 0.05)
	},
	pong: {
		paddle: (a) => a._tone('square', 520, 520, 0.06, 0.07),
		wall: (a) => a._tone('square', 300, 300, 0.05, 0.05),
		brick: (a) => {
			a._tone('square', 880, 1320, 0.07, 0.05);
			a._fx(0.08, 0.05, 'highpass', 4000, 2000);
		},
		serve: (a) => a._arp([72, 76], 0.07, 'square', 0.05, 0.08),
		levelUp: (a) => a._arp([72, 76, 79, 84], 0.07, 'square', 0.05, 0.1)
	}
};

export const gameAudio = new GameAudio();
