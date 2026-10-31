<!-- A short burst of confetti over the app (level-ups, badges, finished scenarios and goals). -->
<script lang="ts">
	const COLORS = ['#316ccd', '#1db1fd', '#7c3aed', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];
	const pieces = Array.from({ length: 46 }, (_, i) => ({
		left: Math.random() * 100,
		delay: Math.random() * 0.25,
		dur: 1.3 + Math.random() * 0.9,
		drift: (Math.random() - 0.5) * 120,
		spin: (Math.random() - 0.5) * 900,
		w: 6 + Math.random() * 6,
		color: COLORS[i % COLORS.length],
		round: Math.random() < 0.3
	}));
	let gone = $state(false);
	setTimeout(() => (gone = true), 2600);
</script>

{#if !gone}
	<div class="confetti" aria-hidden="true">
		{#each pieces as p, i (i)}
			<i
				class:round={p.round}
				style="left: {p.left}%; width: {p.w}px; height: {p.round ? p.w : p.w * 1.6}px; background: {p.color}; animation-duration: {p.dur}s; animation-delay: {p.delay}s; --drift: {p.drift}px; --spin: {p.spin}deg"
			></i>
		{/each}
	</div>
{/if}

<style>
	.confetti {
		position: absolute;
		inset: 0;
		z-index: 11;
		overflow: hidden;
		pointer-events: none;
	}
	i {
		position: absolute;
		top: -20px;
		border-radius: 2px;
		animation: fall ease-in forwards;
	}
	i.round {
		border-radius: 50%;
	}
	@keyframes fall {
		to {
			transform: translate(var(--drift), 110vh) rotate(var(--spin));
			opacity: 0.9;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.confetti {
			display: none;
		}
	}
</style>
