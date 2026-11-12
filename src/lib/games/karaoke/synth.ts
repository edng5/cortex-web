// Keyboard Karaoke: the backing for built-in songs (the warm-up), played by a tiny Web Audio synth
// from the song's own note chart: a soft electric-piano melody an octave up, a bass note on each
// bar and a count-in click. Its clock is the audio clock, so the lyrics and scoring follow it
// exactly like they follow a video.
import type { Note } from './chart';

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Synth {
	private ctx: AudioContext | null = null;
	private out: GainNode | null = null;
	/** Volume, 0..1. */
	private vol = 1;
	private t0 = 0;
	private pausedAt: number | null = null;
	private nodes: AudioScheduledSourceNode[] = [];
	length = 0;

	constructor(private notes: Note[]) {
		this.length = (notes.at(-1)?.end ?? 0) + 2;
	}

	/** Starts from `from` seconds. */
	play(from = 0) {
		this.stop();
		this.ctx = new AudioContext();
		const ctx = this.ctx;
		const out = ctx.createGain();
		out.gain.value = 0.22 * this.vol;
		out.connect(ctx.destination);
		this.out = out;
		this.t0 = ctx.currentTime + 0.1 - from;
		const tone = (f: number, at: number, dur: number, type: OscillatorType, level: number) => {
			if (at + dur < ctx.currentTime) return;
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = type;
			o.frequency.value = f;
			g.gain.setValueAtTime(0, at);
			g.gain.linearRampToValueAtTime(level, at + 0.01);
			g.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.2, dur));
			o.connect(g).connect(out);
			o.start(Math.max(ctx.currentTime, at));
			o.stop(at + dur + 0.05);
			this.nodes.push(o);
		};
		for (const n of this.notes) {
			const at = this.t0 + n.start;
			tone(hz(n.midi + 12), at, n.end - n.start, 'triangle', 0.5);
			tone(hz(n.midi + 24), at, (n.end - n.start) * 0.5, 'sine', 0.12);
		}
		// Count-in clicks over the intro, and a bass note under each phrase's first note.
		const first = this.notes[0]?.start ?? 0;
		for (let k = 4; k >= 1; k--) tone(1200, this.t0 + first - k * 0.6, 0.05, 'square', 0.15);
		let lastBass = -9;
		for (const n of this.notes)
			if (n.start - lastBass > 2.3) {
				lastBass = n.start;
				tone(hz(48 + (((n.midi % 12) + 12) % 12)), this.t0 + n.start, 2.2, 'sine', 0.6);
			}
		this.pausedAt = null;
	}
	pause() {
		if (this.pausedAt != null) return;
		this.pausedAt = this.time;
		this.stop();
	}
	resume() {
		if (this.pausedAt != null) this.play(this.pausedAt);
	}
	/** Volume, 0..1 (takes effect at once). */
	setVolume(v: number) {
		this.vol = Math.max(0, Math.min(1, v));
		if (this.out && this.ctx) this.out.gain.setTargetAtTime(0.22 * this.vol, this.ctx.currentTime, 0.03);
	}
	get paused() {
		return this.pausedAt != null;
	}
	/** It's been started (it has a clock running, or paused). */
	get started() {
		return !!this.ctx || this.pausedAt != null;
	}
	/**
	 * The browser is holding its sound (it was started without a tap, e.g. by a friend's room):
	 * its clock doesn't run until it's started again from a tap.
	 */
	get blocked() {
		return this.ctx?.state === 'suspended';
	}
	get time() {
		if (this.pausedAt != null) return this.pausedAt;
		return this.ctx ? this.ctx.currentTime - this.t0 : 0;
	}
	stop() {
		for (const n of this.nodes)
			try {
				n.stop();
			} catch {
				/* already stopped */
			}
		this.nodes = [];
		void this.ctx?.close();
		this.ctx = null;
	}
}
