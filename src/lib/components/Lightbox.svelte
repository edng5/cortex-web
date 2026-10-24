<!-- Full-screen view of one image. Click anywhere or press Esc to close. -->
<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { lightbox } from '$lib/lightbox.svelte';

	function onKey(e: KeyboardEvent) {
		if (lightbox.src && e.key === 'Escape') {
			// Close only the lightbox, not the info panel underneath.
			e.stopImmediatePropagation();
			lightbox.close();
		}
	}
</script>

<svelte:window onkeydowncapture={onKey} />

{#if lightbox.src}
	<div
		class="backdrop"
		role="dialog"
		aria-modal="true"
		aria-label={lightbox.caption ?? 'Image'}
		tabindex="-1"
		transition:fade={{ duration: 180 }}
		onclick={() => lightbox.close()}
		onkeydown={() => {}}
	>
		<figure transition:scale={{ start: 0.94, duration: 220 }}>
			<img src={lightbox.src} alt={lightbox.caption ?? ''} class:vector={/\.svg($|\?)/i.test(lightbox.src)} />
			{#if lightbox.caption}<figcaption>{lightbox.caption}</figcaption>{/if}
		</figure>
		<button class="close" aria-label="Close image">✕</button>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		/* minmax(0, 1fr): the track never grows past the screen, so the picture stays centred. */
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		padding: 32px;
		background: rgba(3, 5, 10, 0.86);
		backdrop-filter: blur(10px);
		cursor: zoom-out;
	}
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		max-height: 100%;
	}
	img {
		/* % of the padded area, not of the viewport, so the picture can't overflow the side. */
		max-width: min(1200px, 100%);
		max-height: calc(100svh - 120px);
		object-fit: contain;
		border-radius: 12px;
		box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.9);
	}
	/* Vector art has no resolution limit: show it big. */
	img.vector {
		width: min(1100px, 100%);
		height: auto;
	}
	@media (max-width: 720px) {
		.backdrop {
			padding: 64px 12px 24px; /* clear the close button; use the full width */
		}
	}
	figcaption {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.close {
		position: fixed;
		top: 16px;
		right: 16px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(10, 14, 26, 0.7);
		color: #fff;
		font-size: 16px;
		cursor: pointer;
	}
</style>
