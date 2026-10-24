<!--
  One image, uploaded video, or YouTube/Vimeo embed with an optional caption.
  Images keep their natural aspect ratio (never cropped). `maxHeight` caps tall
  images (e.g. phone screenshots); `stage` fills a fixed carousel frame instead,
  letterboxing the picture over a blurred copy of itself.
-->
<script lang="ts">
	import type { MediaItem } from '$lib/media';
	import { lightbox } from '$lib/lightbox.svelte';

	function zoom(e: MouseEvent, src: string, caption?: string) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
		e.preventDefault();
		lightbox.show(src, caption);
	}

	let {
		item,
		title,
		maxHeight = '420px',
		stage = false,
		showCaption = true,
		clickToLoad = false
	}: {
		item: MediaItem;
		title: string;
		maxHeight?: string;
		stage?: boolean;
		showCaption?: boolean;
		/** Embeds: show the thumbnail and a play button; load (and start) the player on click. */
		clickToLoad?: boolean;
	} = $props();
	let loaded = $state(false);
	const autoplayUrl = (url: string) => url + (url.includes('?') ? '&' : '?') + 'autoplay=1';
</script>

<figure class="media" class:stage class:video={item.kind !== 'image'} style="--max-h: {maxHeight}">
	{#if item.kind === 'image'}
		<a
			class="img-wrap"
			href={item.src}
			target="_blank"
			rel="noopener"
			aria-label="View image full size"
			onclick={(e) => zoom(e, item.src, item.caption)}
		>
			{#if stage}<img class="backdrop" src={item.src} alt="" aria-hidden="true" />{/if}
			<img class="main" src={item.src} alt={item.caption ?? title} loading="lazy" />
		</a>
	{:else if item.kind === 'embed' && clickToLoad && !loaded}
		<div class="frame">
			<button class="poster" onclick={() => (loaded = true)} aria-label="Play {item.caption ?? `${title} video`}">
				{#if item.thumb}<img src={item.thumb} alt="" loading="lazy" draggable="false" />{/if}
				<span class="play" aria-hidden="true"></span>
			</button>
		</div>
	{:else if item.kind === 'embed'}
		<div class="frame">
			<iframe
				src={clickToLoad ? autoplayUrl(item.embedUrl) : item.embedUrl}
				title={item.caption ?? `${title} video`}
				loading="lazy"
				allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
	{:else}
		<div class="frame">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src={item.src} controls playsinline preload="metadata"></video>
		</div>
	{/if}
	{#if showCaption && item.caption}<figcaption>{item.caption}</figcaption>{/if}
</figure>

<style>
	.media {
		margin: 0;
		overflow: hidden;
		border-radius: 14px;
		background: #0b1020;
		border: 1px solid color-mix(in srgb, var(--accent, #38bdf8) 35%, rgba(148, 163, 184, 0.2));
		/* Shrink-wrap images so a tall screenshot doesn't sit in a wide empty box. */
		width: fit-content;
		max-width: 100%;
	}
	.media.video,
	.media.stage {
		width: 100%;
	}
	.img-wrap {
		position: relative;
		display: block;
		cursor: zoom-in;
	}
	.main {
		display: block;
		max-width: 100%;
		max-height: var(--max-h);
		width: auto;
		height: auto;
		margin: 0 auto;
	}

	/* Carousel stage: fixed frame, picture fully visible, blurred fill behind it. */
	.stage .img-wrap {
		height: var(--max-h);
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.stage .main {
		position: relative;
		max-height: var(--max-h);
		object-fit: contain;
	}
	.backdrop {
		position: absolute;
		inset: -20px;
		width: calc(100% + 40px);
		height: calc(100% + 40px);
		object-fit: cover;
		filter: blur(22px) brightness(0.45) saturate(1.2);
	}

	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
	}
	.stage .frame {
		height: var(--max-h);
		aspect-ratio: auto;
		background: #000;
	}
	iframe,
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: #000;
	}
	/* Click-to-load poster: the video's thumbnail with a YouTube-style play button. */
	.poster {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: #000;
		cursor: pointer;
	}
	.poster img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play {
		position: relative;
		width: 68px;
		height: 48px;
		border-radius: 14px;
		background: rgba(220, 38, 38, 0.92);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
		transition:
			transform 0.15s,
			background 0.15s;
	}
	.play::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -35% -50%;
		border-style: solid;
		border-width: 10px 0 10px 17px;
		border-color: transparent transparent transparent #fff;
	}
	.poster:hover .play {
		transform: scale(1.08);
		background: #dc2626;
	}
	figcaption {
		padding: 8px 12px;
		font-size: 0.82rem;
		color: var(--muted);
	}
</style>
