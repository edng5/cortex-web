// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionUser | null;
			/** Anonymous per-browser id (cookie). */
			visitorId: string;
		}
	}

	// Web Speech API (not in lib.dom for all TS versions)
	interface Window {
		SpeechRecognition?: new () => SpeechRecognitionLike;
		webkitSpeechRecognition?: new () => SpeechRecognitionLike;
	}

	interface SpeechRecognitionLike extends EventTarget {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		start(): void;
		stop(): void;
		abort(): void;
		onresult: ((e: SpeechRecognitionEventLike) => void) | null;
		onerror: ((e: { error: string }) => void) | null;
		onend: (() => void) | null;
	}

	interface SpeechRecognitionEventLike {
		resultIndex: number;
		results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
	}
}

export {};
