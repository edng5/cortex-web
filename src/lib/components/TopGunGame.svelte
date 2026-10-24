<!--
  Top Gun, Edward's high-school Java game, playing in the browser. CheerpJ runs the original
  Java Swing code (packaged as /games/topgun/topgun.jar) on a JVM compiled to WebAssembly,
  entirely in the visitor's browser. Desktop only: the game needs a keyboard.
  The Java runtime can start only once per page load, so callers keep this mounted.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let { autostart = false }: { autostart?: boolean } = $props();

	const CHEERPJ = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
	const GAME_W = 600;
	const GAME_H = 555 + 26; // the game window plus its title bar

	let screen = $state<HTMLElement>();
	let status = $state<'checking' | 'phone' | 'ready' | 'loading' | 'running' | 'error'>('checking');
	let message = $state('');

	onMount(() => {
		const phone = matchMedia('(max-width: 720px), (pointer: coarse)').matches;
		status = phone ? 'phone' : 'ready';
		if (!phone && autostart) start();
	});

	function loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (document.querySelector(`script[src="${src}"]`)) return resolve();
			const s = document.createElement('script');
			s.src = src;
			s.onload = () => resolve();
			s.onerror = () => reject(new Error('Could not load the Java runtime.'));
			document.head.appendChild(s);
		});
	}

	async function start() {
		if (!screen || status === 'loading' || status === 'running') return;
		status = 'loading';
		try {
			await loadScript(CHEERPJ);
			const w = window as unknown as {
				cheerpjInit: (o?: object) => Promise<void>;
				cheerpjCreateDisplay: (w: number, h: number, parent?: HTMLElement) => HTMLElement;
				cheerpjRunJar: (jar: string, ...args: string[]) => Promise<number>;
			};
			// ?fps logs frames per second to the console (for tuning); dev only: ?jar=name loads
			// /games/topgun/topgun-name.jar instead (to compare builds).
			const params = new URLSearchParams(location.search);
			const jarName = import.meta.env.DEV && params.get('jar');
			await w.cheerpjInit({ version: 8, status: 'splash', javaProperties: params.has('fps') ? ['tg.fps=1'] : [] });
			w.cheerpjCreateDisplay(-1, -1, screen);
			status = 'running';
			// Resolves when the game exits ("Quit" in its menu, which also saves progress).
			await w.cheerpjRunJar(jarName ? `/app/games/topgun/topgun-${jarName}.jar` : '/app/games/topgun/topgun.jar');
			status = 'ready';
			message = 'Thanks for playing! Your progress was saved in this browser.';
		} catch (err) {
			console.error('[topgun]', err);
			status = 'error';
			message = 'The game could not start in this browser. Try a recent Chrome, Edge or Firefox on a computer.';
		}
	}
</script>

{#if status === 'phone'}
	<section class="note">
		<p><strong>Top Gun needs a keyboard,</strong> so it's playable on a computer only.</p>
		<p>On your phone, you can watch the gameplay video instead:</p>
		<div class="video">
			<iframe
				src="https://www.youtube-nocookie.com/embed/FHri_2SCaCQ?rel=0"
				title="Top Gun gameplay"
				allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
	</section>
{:else}
	<section class="stage">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="screen" bind:this={screen} style="--w: {GAME_W}px; --h: {GAME_H}px" tabindex="0">
			{#if status !== 'running'}
				<div class="cover">
					{#if status === 'loading'}
						<p class="loading">Starting the Java runtime… (the first time takes a little while)</p>
					{:else}
						<button class="start" onclick={start} disabled={status === 'checking'}>▶ Play Top Gun</button>
						{#if message}<p class="msg" class:err={status === 'error'}>{message}</p>{/if}
					{/if}
				</div>
			{/if}
		</div>
		<ul class="help" aria-label="Controls">
			<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly / menus</li>
			<li><kbd>Space</kbd> guns</li>
			<li><kbd>Shift</kbd> missile</li>
			<li><kbd>Enter</kbd> select / pause</li>
			<li>Click the game first</li>
		</ul>
	</section>
{/if}

<style>
	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
	}
	.screen {
		position: relative;
		width: var(--w);
		height: var(--h);
		max-width: calc(100vw - 32px);
		flex: none;
		overflow: hidden;
		border-radius: 12px;
		border: 1px solid rgba(56, 189, 248, 0.45);
		background: #000 url('/games/topgun/TGMM.png') center / cover no-repeat;
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.9),
			0 0 50px -12px rgba(56, 189, 248, 0.45);
		outline: none;
	}
	.cover {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 12px;
		text-align: center;
		background: rgba(3, 5, 10, 0.55);
		backdrop-filter: blur(2px);
	}
	.start {
		padding: 14px 26px;
		border-radius: 12px;
		border: none;
		background: #0ea5e9;
		color: #fff;
		font: inherit;
		font-size: 1.1rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 10px 30px -8px rgba(14, 165, 233, 0.8);
	}
	.start:hover {
		background: #0284c7;
	}
	.start:disabled {
		opacity: 0.5;
	}
	.loading,
	.msg {
		margin: 0;
		max-width: 360px;
		color: #e2e8f0;
	}
	.msg.err {
		color: #fca5a5;
	}
	.help {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 20px;
		max-width: 600px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.88rem;
		color: var(--muted, #94a3b8);
	}
	kbd {
		display: inline-block;
		min-width: 20px;
		margin-right: 3px;
		padding: 1px 6px;
		border-radius: 5px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(255, 255, 255, 0.06);
		color: #e2e8f0;
		font: inherit;
		font-size: 0.8rem;
		text-align: center;
	}
	.note {
		max-width: 640px;
		margin: 0 auto;
		color: var(--muted, #94a3b8);
	}
	.note strong {
		color: #e2e8f0;
	}
	.video {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(56, 189, 248, 0.35);
	}
	.video iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
</style>
