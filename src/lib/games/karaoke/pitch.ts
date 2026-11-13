// Keyboard Karaoke: hearing you sing. The microphone goes into the Web Audio API, and every frame
// its latest ~46 ms of sound is run through YIN (de Cheveigné & Kawahara, 2002), a pitch detector
// built for voices: it finds the delay at which the wave best repeats itself (the period), with a
// cumulative-mean normalisation that stops it latching onto half or double the real pitch, and a
// parabolic fit between samples for sub-sample accuracy. Nothing is recorded or sent anywhere.

export interface Heard {
	/** Pitch in Hz, or 0 when you aren't singing (too quiet, or no clear pitch). */
	hz: number;
	/** The same as a (fractional) MIDI note number: 60 = middle C, +1 per semitone. 0 if none. */
	midi: number;
	/** Loudness (RMS, 0..1). */
	level: number;
	/** How clearly pitched the sound is (0..1). */
	clarity: number;
}

export const hzToMidi = (hz: number) => (hz > 0 ? 69 + 12 * Math.log2(hz / 440) : 0);
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const noteName = (midi: number) => `${NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;

/** YIN on one frame. Returns the period in samples (0 if none) and its clarity. */
export function yin(buf: Float32Array, sampleRate: number, minHz = 70, maxHz = 1100, threshold = 0.15): { hz: number; clarity: number } {
	const maxTau = Math.min(Math.floor(sampleRate / minHz), buf.length >> 1);
	const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
	const W = buf.length - maxTau;
	const d = new Float32Array(maxTau + 1);
	// Difference function: how unlike itself the wave is, shifted by tau.
	for (let tau = 1; tau <= maxTau; tau++) {
		let sum = 0;
		for (let i = 0; i < W; i++) {
			const x = buf[i] - buf[i + tau];
			sum += x * x;
		}
		d[tau] = sum;
	}
	// Cumulative mean normalised difference.
	let running = 0;
	d[0] = 1;
	for (let tau = 1; tau <= maxTau; tau++) {
		running += d[tau];
		d[tau] = running ? (d[tau] * tau) / running : 1;
	}
	// The first dip under the threshold (then down to its bottom).
	let tau = -1;
	for (let t = minTau; t <= maxTau; t++) {
		if (d[t] < threshold) {
			while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
			tau = t;
			break;
		}
	}
	if (tau < 0) return { hz: 0, clarity: 0 };
	// Parabolic interpolation around the dip.
	const a = d[tau - 1] ?? d[tau];
	const b = d[tau];
	const c = d[tau + 1] ?? d[tau];
	const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
	const period = tau + (Number.isFinite(shift) ? Math.max(-1, Math.min(1, shift)) : 0);
	return { hz: sampleRate / period, clarity: 1 - b };
}

export class Mic {
	private ctx: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private analyser: AnalyserNode | null = null;
	private buf = new Float32Array(2048);
	private smooth = 0;
	/**
	 * Hear yourself: the microphone goes straight out to the speakers / headphones as you sing (with
	 * some room echo, like a karaoke bar). Live only: nothing is recorded or kept. (Set before
	 * start() it also opens the microphone without echo cancellation, which would fight it.)
	 */
	monitor = false;
	/** How much room echo on your voice, 0..1 (what you hear, and what a friend hears). */
	echo = 0.25;
	private monitorGain: GainNode | null = null;
	private wet: GainNode | null = null;
	private out: MediaStreamAudioDestinationNode | null = null;

	get on() {
		return !!this.stream;
	}

	/** Asks for the microphone (the browser shows its permission prompt). */
	async start(): Promise<string | null> {
		if (this.stream) return null;
		try {
			// Echo cancellation helps when the song plays from speakers, but headphones are best. (Not
			// while hearing yourself: it would try to cancel your own voice coming back out.)
			this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !this.monitor, noiseSuppression: true, autoGainControl: true } });
		} catch {
			return 'No microphone: allow it in your browser to be scored.';
		}
		this.ctx = new AudioContext();
		const src = this.ctx.createMediaStreamSource(this.stream);
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		src.connect(this.analyser);
		this.buf = new Float32Array(this.analyser.fftSize);
		// Your voice: as it is, plus the room's echo (a short burst of fading noise as the room),
		// out to your ears (when hearing yourself) and to a friend (in a room, with voice on).
		const ctx = this.ctx;
		const voice = ctx.createGain();
		src.connect(voice);
		const len = Math.floor(ctx.sampleRate * 1.4);
		const ir = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const d = ir.getChannelData(ch);
			for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
		}
		const room = ctx.createConvolver();
		room.buffer = ir;
		this.wet = ctx.createGain();
		this.wet.gain.value = this.echo;
		const bus = ctx.createGain();
		voice.connect(bus);
		src.connect(room).connect(this.wet).connect(bus);
		this.monitorGain = ctx.createGain();
		this.monitorGain.gain.value = this.monitor ? 0.9 : 0;
		bus.connect(this.monitorGain).connect(ctx.destination);
		this.out = ctx.createMediaStreamDestination();
		bus.connect(this.out);
		void ctx.resume();
		return null;
	}

	stop() {
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.ctx?.close();
		this.ctx = null;
		this.analyser = null;
		this.monitorGain = this.wet = null;
		this.out = null;
	}
	/** Hear yourself, or not (mid-song too). */
	setMonitor(on: boolean) {
		this.monitor = on;
		if (this.monitorGain && this.ctx) this.monitorGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.03);
		// (Echo cancellation would try to cancel your own voice coming back out: off while hearing yourself.)
		void this.stream?.getAudioTracks()[0]?.applyConstraints({ echoCancellation: !on }).catch(() => {});
	}
	/** The room echo on your voice, 0..1. */
	setEcho(v: number) {
		this.echo = Math.max(0, Math.min(1, v));
		if (this.wet && this.ctx) this.wet.gain.setTargetAtTime(this.echo, this.ctx.currentTime, 0.03);
	}
	/** Your voice (with its echo) to send to a friend, while the microphone's on. */
	get sendTrack(): MediaStreamTrack | null {
		return this.out?.stream.getAudioTracks()[0] ?? null;
	}

	/** What the microphone hears right now. */
	read(): Heard {
		if (!this.analyser || !this.ctx) return { hz: 0, midi: 0, level: 0, clarity: 0 };
		this.analyser.getFloatTimeDomainData(this.buf);
		let sum = 0;
		for (const v of this.buf) sum += v * v;
		const level = Math.sqrt(sum / this.buf.length);
		// A noise gate: quiet sound isn't singing.
		if (level < 0.012) {
			this.smooth = 0;
			return { hz: 0, midi: 0, level, clarity: 0 };
		}
		const { hz, clarity } = yin(this.buf, this.ctx.sampleRate);
		if (!hz) return { hz: 0, midi: 0, level, clarity };
		// A little smoothing (in semitones), but jumps of more than a semitone go straight through.
		const m = hzToMidi(hz);
		this.smooth = this.smooth && Math.abs(m - this.smooth) < 1 ? this.smooth + (m - this.smooth) * 0.5 : m;
		return { hz, midi: this.smooth, level, clarity };
	}
}
