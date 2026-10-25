<!--
  A portrait (9:16) YouTube player for a node's `reels`: plays them one after another, looping
  from the last back to the first, with a button per reel to jump to it. Uses the YouTube IFrame
  API so the next reel starts as soon as one ends. `autoplay` starts it with sound (the visitor
  just clicked to open the node, which lets the browser allow it); if the browser still blocks
  sound, it plays muted instead and the viewer can unmute in the player.
-->
<script lang="ts" module>
	interface YTPlayer {
		loadVideoById(id: string): void;
		cueVideoById(id: string): void;
		playVideo(): void;
		mute(): void;
		unMute(): void;
		destroy(): void;
	}
	type YTNamespace = {
		Player: new (
			el: HTMLElement,
			opts: {
				host?: string;
				videoId: string;
				playerVars?: Record<string, number | string>;
				events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
			}
		) => YTPlayer;
	};
	declare global {
		interface Window {
			YT?: YTNamespace;
			onYouTubeIframeAPIReady?: () => void;
		}
	}

	let apiPromise: Promise<YTNamespace> | null = null;
	/** Load YouTube's IFrame API once for the page. */
	function loadApi(): Promise<YTNamespace> {
		if (window.YT?.Player) return Promise.resolve(window.YT);
		apiPromise ??= new Promise((resolve) => {
			const prev = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = () => {
				prev?.();
				resolve(window.YT!);
			};
			const s = document.createElement('script');
			s.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild(s);
		});
		return apiPromise;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { youtubeId } from '$lib/media';
	import { ambient } from '$lib/ambient.svelte';

	let {
		reels,
		captions = {},
		title,
		height,
		autoplay = false
	}: { reels: string[]; captions?: Record<string, string>; title: string; height: string; autoplay?: boolean } = $props();

	const items = $derived(
		reels
			.map((url, i) => ({ id: youtubeId(url) ?? '', label: captions[url] ?? `${title} reel ${i + 1}` }))
			.filter((r) => r.id)
	);
	let current = $state(0);
	let mount = $state<HTMLDivElement>();
	let player: YTPlayer | null = null;

	const ENDED = 0;
	const PLAYING = 1;
	const BUFFERING = 3;
	let lastState = -1;

	onMount(() => {
		let disposed = false;
		loadApi().then((YT) => {
			if (disposed || !mount || !items.length) return;
			player = new YT.Player(mount, {
				host: 'https://www.youtube-nocookie.com',
				videoId: items[0].id,
				playerVars: { playsinline: 1, rel: 0, autoplay: autoplay ? 1 : 0 },
				events: {
					onReady: () => {
						if (!autoplay) return;
						player?.playVideo();
						// Sound blocked by the browser (it won't start): play muted rather than not at all.
						setTimeout(() => {
							if (!disposed && lastState !== PLAYING && lastState !== BUFFERING) {
								player?.mute();
								player?.playVideo();
							}
						}, 1500);
					},
					// A reel finished: on to the next, and from the last back to the first.
					onStateChange: (e) => {
						lastState = e.data;
						// Background music steps aside while a reel plays.
						ambient.duck('reel', e.data === PLAYING || e.data === BUFFERING || e.data === ENDED);
						if (e.data === ENDED) play((current + 1) % items.length);
					}
				}
			});
		});
		return () => {
			disposed = true;
			ambient.duck('reel', false);
			player?.destroy();
			player = null;
		};
	});

	function play(i: number) {
		current = i;
		player?.loadVideoById(items[i].id);
	}
	function pick(i: number) {
		player?.unMute(); // chosen by hand: play it with sound
		play(i);
	}
</script>

<div class="reels" style="--h: {height}">
	<div class="frame">
		<div class="mount" bind:this={mount} aria-label="{title} reels"></div>
	</div>
	{#if items.length > 1}
		<div class="picks" role="tablist" aria-label="{title} reels">
			{#each items as r, i (r.id)}
				<button role="tab" aria-selected={i === current} class:on={i === current} onclick={() => pick(i)}>{r.label}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.reels {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}
	.frame {
		height: var(--h);
		aspect-ratio: 9 / 16;
		max-width: 100%;
		border-radius: 18px;
		overflow: hidden;
		background: #000;
		border: 1px solid rgba(148, 163, 184, 0.25);
		box-shadow: 0 30px 70px -25px rgba(0, 0, 0, 0.9);
	}
	/* The API swaps this div for the player's <iframe>. */
	.frame :global(iframe),
	.mount {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.picks {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		max-width: 420px;
	}
	.picks button {
		padding: 5px 11px;
		border-radius: 99px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(10, 14, 26, 0.85);
		color: var(--muted, #94a3b8);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.picks button:hover {
		color: #e2e8f0;
	}
	.picks button.on {
		border-color: var(--accent, #38bdf8);
		color: #e2e8f0;
	}
</style>
