<!-- Bottom dock: status, live captions, mic button, mute, and a typed-question fallback. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cortex } from '$lib/cortex.svelte';
	import { site } from '$lib/config/site';
	import { session } from '$lib/session.svelte';

	let text = $state('');
	let ring: HTMLSpanElement;

	const status = $derived(
		cortex.chatBlocked
			? 'Chat is turned off'
			: {
					idle: `Ask ${site.assistantName} about ${site.ownerName}`,
					listening: cortex.interim ? '…' : 'Listening — ask me anything',
					thinking: 'Thinking…',
					speaking: `${site.assistantName} is speaking`
				}[cortex.mode]
	);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const q = text.trim();
		if (!q) return;
		text = '';
		cortex.ask(q);
	}

	// Mic ring pulses with the user's voice.
	onMount(() => {
		let raf = 0;
		const loop = () => {
			raf = requestAnimationFrame(loop);
			if (ring) ring.style.transform = `scale(${1 + (cortex.micEnabled ? cortex.audioLevel() * 0.9 : 0)})`;
		};
		loop();
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="dock" data-mode={cortex.mode} class:blocked={cortex.chatBlocked}>
	<div class="captions" aria-live="polite">
		{#if cortex.notice}
			<p class="notice">{cortex.notice}</p>
		{/if}
		{#if cortex.interim}
			<p class="q interim">{cortex.interim}</p>
		{:else if cortex.question}
			<p class="q">“{cortex.question}”</p>
		{/if}
		{#if cortex.answer}
			<p class="a">{cortex.answer}</p>
		{:else if !cortex.question && !cortex.notice}
			<p class="a hint">{site.greeting}</p>
		{/if}
	</div>

	<div class="controls">
		<button
			class="mic"
			class:on={cortex.micEnabled}
			onclick={() => cortex.toggleMic()}
			disabled={cortex.chatBlocked}
			aria-pressed={cortex.micEnabled}
			aria-label={cortex.micEnabled ? 'Turn microphone off' : 'Turn microphone on'}
			title={cortex.micEnabled ? 'Mic on — click to turn off' : 'Talk to Cortex'}
		>
			<span class="ring" bind:this={ring}></span>
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
				<path
					fill="currentColor"
					d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
				/>
			</svg>
		</button>

		<form onsubmit={submit}>
			<input
				bind:value={text}
				placeholder={status}
				aria-label="Type a question for Cortex"
				maxlength="500"
				autocomplete="off"
				disabled={cortex.chatBlocked}
			/>
			<button type="submit" aria-label="Ask" disabled={!text.trim() || cortex.chatBlocked}>↵</button>
		</form>

		{#if cortex.mode === 'thinking' || cortex.mode === 'speaking'}
			<button class="small" onclick={() => cortex.interrupt()} aria-label="Stop" title="Stop">■</button>
		{/if}
		<button
			class="small"
			onclick={() => cortex.toggleMute()}
			aria-pressed={cortex.muted}
			aria-label={cortex.muted ? 'Unmute voice' : 'Mute voice'}
			title={cortex.muted ? 'Voice off' : 'Voice on'}
		>
			{cortex.muted ? '🔇' : '🔊'}
		</button>
	</div>

	{#if session.quota && !cortex.chatBlocked}
		{@const q = session.quota}
		<p class="quota" class:empty={!q.unlimited && q.remaining === 0}>
			{#if q.unlimited}
				Member · unlimited questions
			{:else if q.loggedIn}
				{q.remaining} of {q.limit} questions left today
			{:else}
				{q.remaining} of {q.limit} free questions left ·
				<button class="quota-login" onclick={() => (session.loginOpen = true)}>Log in for more</button>
			{/if}
		</p>
	{/if}
</div>

<style>
	.dock {
		position: absolute;
		/* --inset-left / --inset = media column / info panel widths (set on .stage) */
		left: calc(var(--inset-left, 0px) + (100% - var(--inset-left, 0px) - var(--inset, 0px)) / 2);
		bottom: 24px;
		transform: translateX(-50%);
		width: min(680px, calc(100vw - 32px - var(--inset-left, 0px) - var(--inset, 0px)));
		transition: left 0.3s, width 0.3s;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.captions {
		text-align: center;
		max-height: 28svh;
		overflow-y: auto;
		text-shadow: 0 1px 12px rgba(0, 0, 0, 0.9);
	}
	.captions p {
		margin: 4px 0;
	}
	.q {
		color: var(--muted);
		font-style: italic;
	}
	.interim {
		opacity: 0.7;
	}
	.a {
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.hint {
		color: var(--muted);
	}
	/* Chat turned off after an inappropriate question. */
	.blocked .controls {
		opacity: 0.45;
		filter: grayscale(0.6);
	}
	.blocked .mic,
	.blocked input {
		cursor: not-allowed;
	}
	/* Minimal question counter under the ask bar. */
	.quota {
		margin: -2px 0 0;
		text-align: center;
		font-size: 0.75rem;
		color: var(--muted);
		opacity: 0.85;
	}
	.quota.empty {
		color: #fca5a5;
	}
	.quota-login {
		padding: 0;
		border: none;
		background: none;
		color: #7dd3fc;
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.notice {
		color: #fca5a5;
		font-size: 0.9rem;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: 999px;
		background: rgba(10, 14, 26, 0.75);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}
	.mic {
		position: relative;
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		color: var(--text);
		background: #1e293b;
		display: grid;
		place-items: center;
		transition: background 0.2s;
	}
	.mic svg {
		position: relative;
	}
	.mic.on {
		background: #0ea5e9;
		color: #fff;
	}
	.ring {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 2px solid rgba(56, 189, 248, 0.6);
		opacity: 0;
		transition: opacity 0.2s;
	}
	.mic.on .ring {
		opacity: 1;
	}
	[data-mode='thinking'] .mic.on .ring {
		animation: spin 1.2s linear infinite;
		border-style: dashed;
	}
	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
	form {
		flex: 1;
		display: flex;
		min-width: 0;
	}
	input {
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font: inherit;
		padding: 0 6px;
	}
	input::placeholder {
		color: var(--muted);
	}
	form button,
	.small {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: none;
		color: var(--text);
		cursor: pointer;
		font-size: 15px;
	}
	form button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
