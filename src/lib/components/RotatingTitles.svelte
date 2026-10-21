<!--
  Cycles through titles under the logo. Each title's letters rise in one by one
  (staggered), hold, then the whole word blurs up and out before the next arrives.
  Respects prefers-reduced-motion (plain cross-fade).
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let { titles, interval = 2800 }: { titles: string[]; interval?: number } = $props();

	let index = $state(0);
	let leaving = $state(false);

	onMount(() => {
		const LEAVE_MS = 450;
		let t: ReturnType<typeof setTimeout>;
		const tick = () => {
			leaving = true;
			t = setTimeout(() => {
				index = (index + 1) % titles.length;
				leaving = false;
				t = setTimeout(tick, interval);
			}, LEAVE_MS);
		};
		t = setTimeout(tick, interval);
		return () => clearTimeout(t);
	});

	const chars = $derived([...titles[index]]);
	// Width reserved for the longest title so the layout never jumps.
	const longest = $derived(titles.reduce((a, b) => (b.length > a.length ? b : a), ''));
</script>

<span class="rotator" aria-live="polite">
	<span class="sizer" aria-hidden="true">{longest}</span>
	{#key index}
		<span class="word" class:leaving aria-label={titles[index]}>
			{#each chars as ch, i}
				<span class="ch" style="--i: {i}; --t: {chars.length > 1 ? i / (chars.length - 1) : 0}" aria-hidden="true"
					>{ch === ' ' ? ' ' : ch}</span
				>
			{/each}
			<span class="caret" aria-hidden="true"></span>
		</span>
	{/key}
</span>

<style>
	.rotator {
		position: relative;
		display: inline-grid;
		align-items: center;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.sizer {
		grid-area: 1 / 1;
		visibility: hidden;
		padding-right: 14px;
	}
	.word {
		grid-area: 1 / 1;
		white-space: nowrap;
		transition:
			opacity 0.45s ease,
			transform 0.45s ease,
			filter 0.45s ease;
	}
	.word.leaving {
		opacity: 0;
		transform: translateY(-10px);
		filter: blur(6px);
	}
	.ch {
		display: inline-block;
		/* sky → violet across the word */
		color: color-mix(in oklab, #bae6fd, #a78bfa calc(var(--t) * 100%));
		text-shadow: 0 0 18px color-mix(in oklab, #38bdf8 40%, transparent);
		animation: rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
		animation-delay: calc(var(--i) * 32ms);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.55em) rotateX(70deg);
			filter: blur(4px);
		}
	}
	.caret {
		display: inline-block;
		vertical-align: -0.12em;
		margin-left: 4px;
		width: 2px;
		height: 1.05em;
		background: #7dd3fc;
		box-shadow: 0 0 10px #38bdf8;
		animation: blink 1.1s steps(1) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ch {
			animation: none;
		}
		.word.leaving {
			transform: none;
			filter: none;
		}
		.caret {
			animation: none;
		}
	}
</style>
