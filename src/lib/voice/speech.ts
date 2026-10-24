// Browser voice I/O: mic permission + level meter, speech-to-text, text-to-speech.
// All browser-only — import from components/onMount, never during SSR.
import { site } from '$lib/config/site';

// ─── Microphone (permission + live audio level) ──────────────────────────────

/** Phones/tablets: only one thing may capture audio at a time, and speech output needs a tap. */
export function isMobileDevice(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
}

export class MicMeter {
	private stream: MediaStream | null = null;
	private ctx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private buf: Uint8Array<ArrayBuffer> | null = null;
	private smoothed = 0;
	/** Phones: no live meter (it would hold the mic away from speech recognition); see `pulse()`. */
	private permissionOnly = false;
	private pulseLevel = 0;

	/** Prompts for mic permission. Throws if denied / unavailable. */
	async enable(): Promise<void> {
		if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no microphone access.');
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true }
		});
		// Phones allow one audio capture at a time: keep the permission, release the mic so
		// speech recognition can use it, and animate from recognition events instead.
		if (isMobileDevice()) {
			this.stream.getTracks().forEach((t) => t.stop());
			this.stream = null;
			this.permissionOnly = true;
			return;
		}
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

	/** Phones: words were just heard, so give the graph a short burst of "loudness". */
	pulse(): void {
		this.pulseLevel = 0.7;
	}

	/** 0..1 loudness, smoothed. Call once per animation frame. */
	level(): number {
		if (this.permissionOnly) {
			this.pulseLevel *= 0.94;
			this.smoothed += (this.pulseLevel - this.smoothed) * 0.2;
			return this.smoothed;
		}
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
	/** Everything heard as "final" in this listening session and not yet sent. */
	private pending = '';
	/** Results (by index) of this session already sent as a question, and how many are final now. */
	private sentUpTo = 0;
	private finalCount = 0;
	private sendTimer: ReturnType<typeof setTimeout> | undefined;
	/** Quiet time after the last words before the question is sent (a pause ends the question). */
	private static readonly END_OF_QUESTION_MS = 1100;

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
		this.sentUpTo = this.finalCount = 0; // result indices restart with each session
		// Phones: continuous mode marks each word "final" as soon as it's heard (and can repeat
		// them), so the question would be just its first word. Single-utterance mode returns the
		// whole sentence when the speaker stops; listening restarts after each one (onend).
		rec.continuous = !isMobileDevice();
		rec.interimResults = true;
		rec.lang = navigator.language || 'en-US';
		rec.onresult = (e) => {
			// Rebuild this session's text from all results (not just the new ones), then send it
			// only after a short pause, so a question is never cut off mid-sentence.
			let final = '';
			let interim = '';
			this.finalCount = this.sentUpTo;
			for (let i = this.sentUpTo; i < e.results.length; i++) {
				const r = e.results[i];
				const text = r[0].transcript.trim();
				if (r.isFinal) {
					this.finalCount = i + 1;
					if (text) final += text + ' ';
				} else if (text) interim += text + ' ';
			}
			this.pending = final.trim();
			this.handlers.onInterim((final + interim).trim());
			clearTimeout(this.sendTimer);
			if (this.pending) this.sendTimer = setTimeout(() => this.send(), Recognizer.END_OF_QUESTION_MS);
		};
		rec.onerror = (e) => {
			if (e.error === 'no-speech' || e.error === 'aborted') return;
			if (e.error === 'not-allowed') this.wanted = false;
			this.handlers.onError(`Speech recognition error: ${e.error}`);
		};
		// Recognition ends after silence (always, on phones); send what was heard, then restart
		// while we still want to listen.
		rec.onend = () => {
			this.rec = null;
			this.send();
			if (this.wanted && !this.paused) setTimeout(() => this.wanted && !this.paused && this.start(), 250);
		};
		this.rec = rec;
		try {
			rec.start();
		} catch {
			/* already started */
		}
	}

	/** Hand the collected words to Cortex as one question. */
	private send(): void {
		clearTimeout(this.sendTimer);
		const text = this.pending.trim();
		this.pending = '';
		this.sentUpTo = this.finalCount; // don't send these words again in this session
		if (text && this.wanted && !this.paused) this.handlers.onFinal(text);
	}

	/** Temporarily stop listening (e.g. while Cortex talks, so it doesn't hear itself). */
	pause(): void {
		clearTimeout(this.sendTimer);
		this.pending = '';
		this.paused = true;
		this.rec?.abort();
		this.rec = null;
	}

	resume(): void {
		if (this.wanted) this.start();
	}

	stop(): void {
		clearTimeout(this.sendTimer);
		this.pending = '';
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

	/** True when the chosen voice is a known male voice; otherwise the pitch is lowered. */
	private male = false;

	constructor() {
		if (typeof speechSynthesis === 'undefined') return;
		const pick = () => {
			const voices = speechSynthesis.getVoices();
			const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
			const male =
				site.preferredVoices.map((n) => voices.find((v) => v.name === n)).find(Boolean) ??
				en.find((v) => isMaleVoice(v) && /natural|neural|online/i.test(v.name)) ??
				en.find((v) => isMaleVoice(v));
			this.male = !!male;
			// No known male voice on this device: any English voice that isn't a known female
			// one, spoken lower (see say()).
			this.voice = male ?? en.find((v) => !isFemaleVoice(v)) ?? en[0] ?? null;
		};
		pick();
		speechSynthesis.addEventListener?.('voiceschanged', pick);
	}

	get supported(): boolean {
		return typeof speechSynthesis !== 'undefined';
	}

	/**
	 * Call from a tap/click. Phones (iOS especially) only allow speech that starts in a user
	 * gesture; speaking a silent utterance there unlocks later, asynchronous replies.
	 */
	unlock(): void {
		if (!this.supported || this.unlocked) return;
		this.unlocked = true;
		const u = new SpeechSynthesisUtterance(' ');
		u.volume = 0;
		speechSynthesis.speak(u);
	}
	private unlocked = false;

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
		u.pitch = this.male ? site.speechPitch : Math.min(site.speechPitch, 0.7);
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

// ─── Voice gender ────────────────────────────────────────────────────────────
// Browsers don't report a voice's gender, so recognise common voices by name.
// Windows/Edge, Chrome, Apple (macOS/iOS) and Android (Google TTS voice codes).
const MALE_VOICE =
	/\b(male|guy|andrew|brian|christopher|eric|roger|steffan|ryan|thomas|william|liam|david|mark|george|james|richard|sean|daniel|alex|aaron|arthur|fred|tom|oliver|reed|rishi|gordon|lee|evan|nathan|ralph|albert|bruce|junior|aditya|prabhat)\b|-x-(iom|iol|tpd|rjs|gbd|aud)-/i;
const FEMALE_VOICE =
	/\b(female|woman|samantha|karen|victoria|zira|aria|jenny|sonia|libby|natasha|moira|tessa|fiona|susan|hazel|catherine|emma|ava|allison|serena|kate|nicky|joanna|salli|kimberly|ivy|clara|michelle|ana|heera|neerja|google us english)\b/i;

function isMaleVoice(v: SpeechSynthesisVoice): boolean {
	return MALE_VOICE.test(v.name) && !/female/i.test(v.name);
}

function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
	return FEMALE_VOICE.test(v.name);
}
