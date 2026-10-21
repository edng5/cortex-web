// Browser voice I/O: mic permission + level meter, speech-to-text, text-to-speech.
// All browser-only — import from components/onMount, never during SSR.
import { site } from '$lib/config/site';

// ─── Microphone (permission + live audio level) ──────────────────────────────

export class MicMeter {
	private stream: MediaStream | null = null;
	private ctx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private buf: Uint8Array<ArrayBuffer> | null = null;
	private smoothed = 0;

	/** Prompts for mic permission. Throws if denied / unavailable. */
	async enable(): Promise<void> {
		if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no microphone access.');
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true }
		});
		this.ctx = new AudioContext();
		const src = this.ctx.createMediaStreamSource(this.stream);
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 512;
		this.buf = new Uint8Array(this.analyser.fftSize);
		src.connect(this.analyser);
	}

	disable(): void {
		this.stream?.getTracks().forEach((t) => t.stop());
		this.ctx?.close().catch(() => {});
		this.stream = this.ctx = this.analyser = this.buf = null;
		this.smoothed = 0;
	}

	/** 0..1 loudness, smoothed. Call once per animation frame. */
	level(): number {
		if (!this.analyser || !this.buf) return (this.smoothed *= 0.9);
		this.analyser.getByteTimeDomainData(this.buf);
		let sum = 0;
		for (const v of this.buf) {
			const x = (v - 128) / 128;
			sum += x * x;
		}
		const rms = Math.min(1, Math.sqrt(sum / this.buf.length) * 4);
		this.smoothed += (rms - this.smoothed) * 0.25;
		return this.smoothed;
	}
}

// ─── Speech-to-text (Web Speech API) ─────────────────────────────────────────
// Supported in Chrome, Edge and Safari. Note: Chrome sends audio to Google's
// speech service. Firefox has no support — the text box is the fallback.

export function speechRecognitionSupported(): boolean {
	return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class Recognizer {
	private rec: SpeechRecognitionLike | null = null;
	private wanted = false; // should be listening
	private paused = false;

	constructor(
		private handlers: {
			onInterim: (text: string) => void;
			onFinal: (text: string) => void;
			onError: (msg: string) => void;
		}
	) {}

	start(): void {
		const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!Ctor) return this.handlers.onError('Speech recognition is not supported in this browser.');
		this.wanted = true;
		this.paused = false;
		if (this.rec) return;

		const rec = new Ctor();
		rec.continuous = true;
		rec.interimResults = true;
		rec.lang = navigator.language || 'en-US';
		rec.onresult = (e) => {
			let interim = '';
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const r = e.results[i];
				const text = r[0].transcript.trim();
				if (r.isFinal) {
					if (text) this.handlers.onFinal(text);
				} else interim += text + ' ';
			}
			this.handlers.onInterim(interim.trim());
		};
		rec.onerror = (e) => {
			if (e.error === 'no-speech' || e.error === 'aborted') return;
			if (e.error === 'not-allowed') this.wanted = false;
			this.handlers.onError(`Speech recognition error: ${e.error}`);
		};
		// Chrome ends recognition after silence; restart while we still want it.
		rec.onend = () => {
			this.rec = null;
			if (this.wanted && !this.paused) setTimeout(() => this.wanted && !this.paused && this.start(), 250);
		};
		this.rec = rec;
		try {
			rec.start();
		} catch {
			/* already started */
		}
	}

	/** Temporarily stop listening (e.g. while Cortex talks, so it doesn't hear itself). */
	pause(): void {
		this.paused = true;
		this.rec?.abort();
		this.rec = null;
	}

	resume(): void {
		if (this.wanted) this.start();
	}

	stop(): void {
		this.wanted = false;
		this.rec?.abort();
		this.rec = null;
	}
}

// ─── Text-to-speech ──────────────────────────────────────────────────────────
// Speaks sentence-by-sentence as text streams in, so Cortex starts talking
// before the full answer has arrived.

export class Speaker {
	private pending = '';
	private queue = 0;
	private voice: SpeechSynthesisVoice | null = null;
	onStart: () => void = () => {};
	onIdle: () => void = () => {};

	constructor() {
		if (typeof speechSynthesis === 'undefined') return;
		const pick = () => {
			const voices = speechSynthesis.getVoices();
			this.voice =
				site.preferredVoices.map((n) => voices.find((v) => v.name === n)).find(Boolean) ??
				voices.find((v) => v.lang.startsWith('en') && /natural|neural|google/i.test(v.name)) ??
				voices.find((v) => v.lang.startsWith('en')) ??
				null;
		};
		pick();
		speechSynthesis.addEventListener?.('voiceschanged', pick);
	}

	get supported(): boolean {
		return typeof speechSynthesis !== 'undefined';
	}

	get speaking(): boolean {
		return this.queue > 0;
	}

	/** Feed streamed text; complete sentences are spoken immediately. */
	push(text: string): void {
		this.pending += text;
		const re = /[^.!?…]+[.!?…]+["')\]]*\s+/g;
		let m: RegExpExecArray | null;
		let consumed = 0;
		while ((m = re.exec(this.pending))) {
			this.say(m[0]);
			consumed = re.lastIndex;
		}
		this.pending = this.pending.slice(consumed);
	}

	/** Speak whatever is left (end of stream). */
	flush(): void {
		if (this.pending.trim()) this.say(this.pending);
		this.pending = '';
		if (this.queue === 0) this.onIdle();
	}

	cancel(): void {
		this.pending = '';
		this.queue = 0;
		if (this.supported) speechSynthesis.cancel();
	}

	private say(text: string): void {
		const clean = text.replace(/[*_#`>]/g, '').trim();
		if (!clean || !this.supported) return;
		const u = new SpeechSynthesisUtterance(clean);
		if (this.voice) u.voice = this.voice;
		u.rate = site.speechRate;
		u.pitch = site.speechPitch;
		u.onstart = () => this.onStart();
		const done = () => {
			this.queue = Math.max(0, this.queue - 1);
			if (this.queue === 0 && !this.pending) this.onIdle();
		};
		u.onend = done;
		u.onerror = done;
		this.queue++;
		speechSynthesis.speak(u);
	}
}
