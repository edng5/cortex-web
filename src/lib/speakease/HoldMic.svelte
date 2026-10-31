<!-- Hold to talk, let go to send (as in the app): records with the browser's own compressed format.
     Space works too, when nothing else has focus. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { app } from './app.svelte';

	let {
		onrecord,
		disabled = false,
		recording = $bindable(false),
		hint = 'Hold to talk',
		keys = true
	}: { onrecord: (blob: Blob) => void; disabled?: boolean; recording?: boolean; hint?: string; keys?: boolean } = $props();

	let recorder: MediaRecorder | null = null;
	let stream: MediaStream | null = null;
	let chunks: Blob[] = [];
	let held = false;
	let startedAt = 0;

	const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

	async function press(e: Event) {
		e.preventDefault();
		if (held || recorder || disabled) return;
		held = true;
		app.stopVoice();
		app.active();
		navigator.vibrate?.(10);
		recording = true;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
		} catch {
			held = false;
			recording = false;
			app.say('SpeakEase needs your microphone. Allow it in your browser, then try again.');
			return;
		}
		// Let go while the browser was still asking for the mic: nothing to record.
		if (!held) return finish(false);
		const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
		recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32_000 });
		chunks = [];
		recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
		recorder.start();
		startedAt = performance.now();
	}

	function release() {
		if (!held) return;
		held = false;
		navigator.vibrate?.(10);
		// A quick tap isn't a sentence.
		finish(!!recorder && performance.now() - startedAt > 350);
	}

	function finish(send: boolean) {
		const r = recorder;
		recorder = null;
		recording = false;
		const done = () => {
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
			if (send && chunks.length) onrecord(new Blob(chunks, { type: r?.mimeType || 'audio/webm' }));
			else if (!send && r) app.say('Hold the mic button while you speak.');
		};
		if (r && r.state !== 'inactive') {
			r.onstop = done;
			r.stop();
		} else done();
	}

	function key(e: KeyboardEvent) {
		if (!keys || e.code !== 'Space' || e.repeat) return;
		if (document.querySelector('.se [role="dialog"]')) return;
		if ((e.target as HTMLElement)?.closest('button:not(.mic), input, textarea, a')) return;
		if (e.type === 'keydown') press(e);
		else release();
	}

	onDestroy(() => {
		held = false;
		if (recorder || stream) finish(false);
	});
</script>

<svelte:window onkeydown={key} onkeyup={key} onblur={release} />

<div class="mic-wrap">
	<button
		class="mic"
		class:on={recording}
		onpointerdown={press}
		onpointerup={release}
		onpointercancel={release}
		onpointerleave={release}
		oncontextmenu={(e) => e.preventDefault()}
		aria-label="Hold to talk"
		{disabled}
	>
		{#if recording}<span class="pulse" aria-hidden="true"></span>{/if}
		<span class="core"><Icon name={recording ? 'mic-none' : 'mic'} size={34} color="#fff" /></span>
	</button>
	<p class="hint">{recording ? 'Listening… let go to send' : hint}</p>
</div>

<style>
	.mic-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.mic {
		position: relative;
		display: grid;
		place-items: center;
		width: 74px;
		height: 74px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.core {
		position: relative;
		display: grid;
		place-items: center;
		width: 66px;
		height: 66px;
		border-radius: 50%;
		background: linear-gradient(140deg, #3d7be0, #1db1fd);
		box-shadow:
			0 10px 24px -8px rgba(29, 177, 253, 0.7),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}
	.mic:hover .core {
		transform: translateY(-1px);
	}
	.mic.on .core {
		background: linear-gradient(140deg, #ef4444, #f97316);
		box-shadow: 0 10px 24px -8px rgba(239, 68, 68, 0.75);
		transform: scale(1.06);
	}
	.pulse {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: rgba(239, 68, 68, 0.35);
		animation: pulse 1.2s ease-out infinite;
	}
	@keyframes pulse {
		from {
			transform: scale(0.85);
			opacity: 1;
		}
		to {
			transform: scale(1.5);
			opacity: 0;
		}
	}
	.mic:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--se-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
