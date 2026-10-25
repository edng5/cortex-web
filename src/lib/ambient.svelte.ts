// Background music: an original ambient piece played live with the Web Audio API (nothing is
// downloaded, so there is no recording or licence involved). Slow pipe-organ chords in A minor
// with a deep drone, a soft repeating high motif and a long reverb, for a calm, spacey feel.
//
// Browsers only allow sound after the visitor interacts with the page, so it starts on the first
// click / tap / key press (unless the visitor muted it before; that choice is remembered).
// It dips very low while Cortex talks or listens (and while a reel video plays), then comes back,
// and pauses while an E.Ngine game is open (the games have their own music and sound effects).
const STORAGE_KEY = 'cortex-music-muted';
/** Overall loudness at full volume: deliberately quiet. */
const VOLUME = 0.14;
/** Share of that volume kept while ducked. */
const DUCKED = 0.08;

// A minor progression, one chord every BAR seconds: Am(add9) · Fmaj7 · C(add9) · G/B · Am · Fmaj7 · Dm7 · Esus4
const BAR = 9;
const CHORDS: number[][] = [
	[45, 52, 57, 59, 64], // A2 E3 A3 B3 E4
	[41, 48, 57, 60, 64], // F2 C3 A3 C4 E4
	[48, 55, 60, 62, 67], // C3 G3 C4 D4 G4
	[47, 55, 59, 62, 67], // B2 G3 B3 D4 G4
	[45, 52, 57, 60, 64], // A2 E3 A3 C4 E4
	[41, 48, 57, 60, 65], // F2 C3 A3 C4 F4
	[50, 57, 60, 65, 69], // D3 A3 C4 F4 A4
	[40, 52, 57, 59, 64] // E2 E3 A3 B3 E4
];
/** The high motif: chord tones an octave or two up, as steady quiet pulses. */
const MOTIF = [0, 2, 1, 3, 2, 4, 3, 2];
const PULSE = BAR / 12;

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Ambient {
	/** Visitor's choice (remembered). */
	muted = $state(false);
	/** Sound is actually running (after the first interaction). */
	playing = $state(false);

	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private bus: GainNode | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private nextBar = 0;
	private bar = 0;
	private ducks = new Set<string>();
	private pauses = new Set<string>();

	/** Read the saved choice and start on the first interaction. Call once in the browser. */
	init() {
		try {
			this.muted = localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			/* storage blocked: default on */
		}
		const first = () => {
			window.removeEventListener('pointerdown', first, true);
			window.removeEventListener('keydown', first, true);
			if (!this.muted && !this.pauses.size) this.start();
		};
		window.addEventListener('pointerdown', first, true);
		window.addEventListener('keydown', first, true);
		// No need to play to a hidden tab.
		document.addEventListener('visibilitychange', () => {
			if (!this.ctx) return;
			if (document.hidden) this.ctx.suspend();
			else if (!this.muted && !this.pauses.size) this.ctx.resume();
		});
	}

	toggle() {
		this.muted = !this.muted;
		try {
			localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
		} catch {
			/* storage blocked */
		}
		if (this.muted) this.fadeTo(0, 0.8, () => this.muted && this.ctx?.suspend());
		else if (!this.pauses.size) this.start();
	}

	/** Turn the music down while `reason` holds (Cortex speaking, a video playing…). */
	duck(reason: string, on: boolean) {
		if (on === this.ducks.has(reason)) return;
		if (on) this.ducks.add(reason);
		else this.ducks.delete(reason);
		if (this.ctx && !this.muted && !this.pauses.size) this.fadeTo(this.target(), on ? 0.6 : 2);
	}

	/** Pause the music while `reason` holds (a game is open), then carry on where it was. */
	pause(reason: string, on: boolean) {
		if (on === this.pauses.has(reason)) return;
		if (on) this.pauses.add(reason);
		else this.pauses.delete(reason);
		if (!this.ctx || this.muted) return;
		if (this.pauses.size) this.fadeTo(0, 0.8, () => this.pauses.size && this.ctx?.suspend());
		else {
			this.ctx.resume();
			this.fadeTo(this.target(), 2.5);
		}
	}

	private target() {
		return this.ducks.size ? VOLUME * DUCKED : VOLUME;
	}

	private fadeTo(value: number, seconds: number, done?: () => void) {
		if (!this.ctx || !this.master) return;
		const g = this.master.gain;
		const now = this.ctx.currentTime;
		g.cancelScheduledValues(now);
		g.setValueAtTime(g.value, now);
		g.linearRampToValueAtTime(value, now + seconds);
		if (done) setTimeout(done, seconds * 1000 + 50);
	}

	private start() {
		if (!this.ctx) {
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			this.build();
		}
		this.ctx.resume();
		this.playing = true;
		this.fadeTo(this.target(), 4);
	}

	/** Signal chain: voices → bus → (dry + long reverb) → gentle low-pass → master volume. */
	private build() {
		const ctx = this.ctx!;
		this.master = ctx.createGain();
		this.master.gain.value = 0;
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.value = 2600;
		tone.connect(this.master).connect(ctx.destination);

		this.bus = ctx.createGain();
		const dry = ctx.createGain();
		dry.gain.value = 0.55;
		const wet = ctx.createGain();
		wet.gain.value = 0.9;
		const reverb = ctx.createConvolver();
		reverb.buffer = this.impulse(6.5);
		this.bus.connect(dry).connect(tone);
		this.bus.connect(reverb).connect(wet).connect(tone);

		this.nextBar = ctx.currentTime + 0.2;
		this.schedule();
		this.timer = setInterval(() => this.schedule(), 500);
	}

	/** A cathedral-like reverb tail: stereo noise that decays over `seconds`. */
	private impulse(seconds: number): AudioBuffer {
		const ctx = this.ctx!;
		const len = Math.floor(ctx.sampleRate * seconds);
		const buf = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const d = buf.getChannelData(ch);
			for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
		}
		return buf;
	}

	/** Schedule bars a little ahead of time (Web Audio plays them sample-accurately). */
	private schedule() {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'running') return;
		while (this.nextBar < ctx.currentTime + 3) {
			const chord = CHORDS[this.bar % CHORDS.length];
			const t = this.nextBar;
			// Organ chord, overlapping into the next bar so the changes melt together.
			chord.forEach((n, i) => this.organ(freq(n), t + i * 0.12, BAR + 2.5, i === 0 ? 0.05 : 0.035));
			// Deep drone on the root.
			this.organ(freq(chord[0] - 12), t, BAR + 3, 0.05, true);
			// High motif (from the second bar on), two octaves of chord tones.
			if (this.bar > 0) {
				MOTIF.forEach((k, i) => {
					const n = chord[k] + (k < 2 ? 24 : 12);
					this.chime(freq(n), t + 1.5 + i * PULSE, i % 4 === 0 ? 0.03 : 0.018);
				});
			}
			this.nextBar += BAR;
			this.bar++;
		}
	}

	/** A pipe-organ-like note: a few soft harmonics, slow swell in and out, slightly detuned pair. */
	private organ(f: number, t: number, dur: number, level: number, sub = false) {
		const ctx = this.ctx!;
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(level, t + (sub ? 4 : 2.8));
		env.gain.setValueAtTime(level, t + dur - 3.5);
		env.gain.linearRampToValueAtTime(0, t + dur);
		env.connect(this.bus!);
		const partials = sub ? [[1, 1]] : [[1, 1], [2, 0.45], [3, 0.18], [4, 0.1]];
		for (const [mult, amp] of partials) {
			for (const detune of sub ? [0] : [-4, 4]) {
				const o = ctx.createOscillator();
				o.type = 'sine';
				o.frequency.value = f * mult;
				o.detune.value = detune;
				const g = ctx.createGain();
				g.gain.value = amp / (sub ? 1 : 2);
				o.connect(g).connect(env);
				o.start(t);
				o.stop(t + dur + 0.1);
			}
		}
	}

	/** A soft bell-like pulse for the high motif. */
	private chime(f: number, t: number, level: number) {
		const ctx = this.ctx!;
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(level, t + 0.04);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
		env.connect(this.bus!);
		for (const [mult, amp] of [[1, 1], [2.01, 0.25]]) {
			const o = ctx.createOscillator();
			o.type = 'sine';
			o.frequency.value = f * mult;
			const g = ctx.createGain();
			g.gain.value = amp;
			o.connect(g).connect(env);
			o.start(t);
			o.stop(t + 2.7);
		}
	}
}

export const ambient = new Ambient();
