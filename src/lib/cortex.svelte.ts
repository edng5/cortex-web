// Cortex state machine — ties together mic, speech recognition, the RAG API,
// text-to-speech and the neuron graph's visual mood.
//
//   idle ──(mic on)──▶ listening ──(question)──▶ thinking ──(first words)──▶ speaking
//     ▲                    ▲                                                   │
//     └────(mic off)───────┴──────────────────(done talking)──────────────────┘
import { askCortex, chatStatus } from '$lib/api/client';
import { session } from '$lib/session.svelte';
import type { ChatTurn } from '$lib/types';
import { MicMeter, Recognizer, Speaker, speechRecognitionSupported } from '$lib/voice/speech';

export type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

class Cortex {
	mode = $state<Mode>('idle');
	micEnabled = $state(false);
	muted = $state(false);

	/** Node shown in the pop-up panel. */
	selectedId = $state<string | null>(null);
	/** Nodes retrieved for the current question (glow while thinking). */
	activeIds = $state<string[]>([]);

	question = $state('');
	interim = $state('');
	answer = $state('');
	notice = $state<string | null>(null);
	/** Chat disabled after an explicit/inappropriate question (neurons stay clickable). */
	chatBlocked = $state(false);
	blockedMessage = $state<string | null>(null);

	readonly history: ChatTurn[] = [];
	private queuedNotice: string | null = null;

	private mic: MicMeter | null = null;
	private recognizer: Recognizer | null = null;
	private speaker: Speaker | null = null;
	private abort: AbortController | null = null;
	private streamDone = false;
	private focusId: string | null = null;

	/** 0..1 mic loudness — read every animation frame by the graph (not reactive on purpose). */
	audioLevel(): number {
		return this.mic?.level() ?? 0;
	}

	private ensureSpeaker(): Speaker {
		if (!this.speaker) {
			this.speaker = new Speaker();
			this.speaker.onStart = () => this.startSpeaking();
			this.speaker.onIdle = () => this.maybeFinish();
		}
		return this.speaker;
	}

	// ── Mic ────────────────────────────────────────────────────────────────

	async toggleMic(): Promise<void> {
		if (this.micEnabled) return this.disableMic();
		if (this.chatBlocked) return;
		this.notice = null;
		try {
			this.mic = new MicMeter();
			await this.mic.enable(); // ← browser permission prompt
		} catch (err) {
			this.mic = null;
			this.notice =
				err instanceof DOMException && err.name === 'NotAllowedError'
					? 'Microphone permission was denied. You can still type a question or click a neuron.'
					: 'Could not access a microphone. You can still type a question.';
			return;
		}
		this.micEnabled = true;
		this.ensureSpeaker();

		if (!speechRecognitionSupported()) {
			this.notice = "Your browser can't transcribe speech — try Chrome, Edge or Safari, or type below.";
		} else {
			this.recognizer = new Recognizer({
				onInterim: (t) => (this.interim = t),
				onFinal: (t) => {
					this.interim = '';
					this.ask(t);
				},
				onError: (m) => (this.notice = m)
			});
			if (this.mode === 'idle') this.recognizer.start();
		}
		if (this.mode === 'idle') this.mode = 'listening';
	}

	disableMic(): void {
		this.recognizer?.stop();
		this.recognizer = null;
		this.mic?.disable();
		this.mic = null;
		this.micEnabled = false;
		this.interim = '';
		if (this.mode === 'listening') this.mode = 'idle';
	}

	toggleMute(): void {
		this.muted = !this.muted;
		if (this.muted) {
			this.speaker?.cancel();
			if (this.mode === 'speaking' && this.streamDone) this.finish();
		}
	}

	// ── Asking ─────────────────────────────────────────────────────────────

	async ask(raw: string): Promise<void> {
		const question = raw.trim();
		if (!question || this.chatBlocked) return;

		this.abort?.abort();
		this.speaker?.cancel();
		this.recognizer?.pause(); // don't transcribe Cortex's own voice
		const abort = (this.abort = new AbortController());

		this.ensureSpeaker();
		this.question = question;
		this.answer = '';
		this.notice = null;
		this.activeIds = [];
		this.focusId = null;
		this.streamDone = false;
		this.mode = 'thinking';

		try {
			await askCortex(
				question,
				this.history,
				(e) => {
					if (abort.signal.aborted) return;
					switch (e.type) {
						case 'sources':
							this.activeIds = e.nodeIds;
							break;
						case 'focus':
							this.focusId = e.nodeId;
							break;
						case 'delta':
							if (this.queuedNotice && this.notice === this.queuedNotice) this.notice = null;
							this.queuedNotice = null;
							this.answer += e.text;
							if (this.muted) this.startSpeaking();
							else this.speaker!.push(e.text);
							break;
						case 'error':
							this.notice = e.message;
							break;
						case 'queued':
							this.queuedNotice = `Cortex is helping other visitors — you're #${e.position} in line…`;
							this.notice = this.queuedNotice;
							break;
						case 'quota':
							session.quota = e.quota;
							break;
						case 'quota_exceeded':
							session.quota = e.quota;
							session.openLimit(e.message);
							break;
						case 'blocked':
							this.block(e.message, e.until);
							if (!this.muted) {
								this.speaker!.push(e.message);
								this.speaker!.flush();
							}
							break;
						case 'done':
							break;
					}
				},
				abort.signal
			);
		} catch (err) {
			if (abort.signal.aborted) return;
			this.notice = 'Could not reach Cortex. Check your connection and try again.';
		}
		if (abort.signal.aborted) return;

		this.streamDone = true;
		if (this.answer) {
			this.history.push({ role: 'user', content: question }, { role: 'assistant', content: this.answer });
		}
		if (this.muted || !this.answer) {
			this.startSpeaking();
			this.finish();
		} else {
			this.speaker!.flush(); // → onIdle → maybeFinish
		}
	}

	/** First words are out: switch mood and pop up the node being discussed. */
	private startSpeaking(): void {
		if (this.mode !== 'thinking') return;
		this.mode = 'speaking';
		if (this.focusId) this.selectedId = this.focusId;
	}

	private maybeFinish(): void {
		if (this.streamDone && !this.speaker?.speaking) this.finish();
	}

	private finish(): void {
		this.startSpeaking(); // still pops up the focus node if TTS never started
		this.mode = this.micEnabled ? 'listening' : 'idle';
		this.activeIds = [];
		this.recognizer?.resume();
	}

	/** Stop talking / cancel the current answer. */
	interrupt(): void {
		this.abort?.abort();
		this.speaker?.cancel();
		this.streamDone = true;
		this.finish();
	}

	// ── Clicking neurons ───────────────────────────────────────────────────

	select(id: string | null): void {
		this.selectedId = id;
	}

	/**
	 * Back to the default view: closes the panel + media, stops any answer or speech,
	 * clears captions and highlights. The mic stays as the visitor left it.
	 */
	reset(): void {
		this.abort?.abort();
		this.abort = null;
		this.speaker?.cancel();
		this.streamDone = true;
		this.focusId = null;
		this.selectedId = null;
		this.activeIds = [];
		this.question = '';
		this.answer = '';
		this.interim = '';
		this.notice = null;
		this.mode = this.micEnabled ? 'listening' : 'idle';
		this.recognizer?.resume();
		if (this.chatBlocked) this.notice = this.blockedMessage;
	}

	// ── Guardrails ─────────────────────────────────────────────────────────

	private static BLOCK_KEY = 'cortex-chat-blocked-until';

	/** Disable chat: stop everything voice-related and remember it in this browser. */
	block(message: string, until: number): void {
		this.chatBlocked = true;
		this.blockedMessage = message;
		this.notice = message;
		this.question = '';
		this.answer = '';
		this.activeIds = [];
		this.abort?.abort();
		this.speaker?.cancel();
		this.disableMic();
		this.mode = 'idle';
		try {
			localStorage.setItem(Cortex.BLOCK_KEY, String(until));
		} catch {
			/* storage unavailable — the server still enforces the block */
		}
	}

	/** On page load: restore a block from the server (authoritative) or this browser. */
	async init(): Promise<void> {
		let until = 0;
		try {
			until = Number(localStorage.getItem(Cortex.BLOCK_KEY) || 0);
		} catch {
			/* ignore */
		}
		const status = await chatStatus();
		if (status.blocked) return this.block(status.message ?? 'Chat is disabled.', status.until ?? Date.now());
		if (until > Date.now()) {
			this.block('Chat has been turned off for this session.', until);
		} else {
			try {
				localStorage.removeItem(Cortex.BLOCK_KEY);
			} catch {
				/* ignore */
			}
		}
	}
}

export const cortex = new Cortex();
