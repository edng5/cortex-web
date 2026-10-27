<!-- A fish's picture (voxel style), for cards and lists. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { species } from './data';
	import { drawFish } from './fishArt';

	let { id, size = 56 }: { id: string; size?: number } = $props();
	let canvas = $state<HTMLCanvasElement>();

	function paint() {
		if (!canvas) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = size * dpr;
		canvas.height = size * 0.7 * dpr;
		const c = canvas.getContext('2d')!;
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.clearRect(0, 0, size, size);
		const sp = species(id);
		drawFish(c, sp, size / 2, size * 0.35, size * (sp.shape === 'ray' ? 0.75 : 0.85), 1, 0.4);
	}
	onMount(() => {
		paint();
		// Pictures (Fishy) load a moment later.
		const t = setTimeout(paint, 400);
		return () => clearTimeout(t);
	});
	$effect(() => {
		void id;
		paint();
	});
</script>

<canvas bind:this={canvas} style="width: {size}px; height: {size * 0.7}px" aria-hidden="true"></canvas>

<style>
	canvas {
		display: block;
		flex: none;
		image-rendering: pixelated;
	}
</style>
