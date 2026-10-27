<!--
  The loading screen for one E.Ngine game, themed on the game: Top Gun's jet streaks across the
  sky, Fishy's fish swims through rising bubbles, a Space Invader marches over the stars, Frogger's
  frog hops across the lanes, Pong's ball rallies between the paddles, and iFish opens up shop.
-->
<script lang="ts">
	import type { GameSpec } from '$lib/games/registry';

	let { spec }: { spec: GameSpec } = $props();

	const LINES: Record<string, string> = {
		topgun: 'Scrambling the jets',
		fishy: 'Filling the tank',
		spaceinvaders: 'Incoming wave',
		frogger: 'Looking both ways',
		pong: 'Serving',
		ifish: 'Opening the store'
	};
</script>

<div class="load {spec.id}" style="--accent: {spec.accent}" role="status" aria-label="Loading {spec.title}">
	<div class="scene" aria-hidden="true">
		{#if spec.id === 'topgun'}
			<span class="cloud c1"></span>
			<span class="cloud c2"></span>
			<span class="jet"><span class="trail"></span><img src={spec.icon} alt="" /></span>
		{:else if spec.id === 'fishy'}
			{#each [12, 28, 47, 63, 81] as x, i (x)}
				<span class="bubble" style="left: {x}%; animation-delay: {i * 0.45}s"></span>
			{/each}
			<span class="fish"><img src={spec.icon} alt="" /></span>
		{:else if spec.id === 'spaceinvaders'}
			{#each Array(18) as _, i (i)}
				<span class="star" style="left: {(i * 37) % 100}%; top: {(i * 53) % 100}%; animation-delay: {(i % 5) * 0.3}s"></span>
			{/each}
			<span class="invader"></span>
		{:else if spec.id === 'frogger'}
			<span class="lane l1"></span>
			<span class="lane l2"></span>
			<span class="frog"><img src={spec.icon} alt="" /></span>
		{:else if spec.id === 'ifish'}
			<span class="awning"></span>
			<span class="shop"><img src={spec.icon} alt="" /></span>
			<span class="open">OPEN</span>
			<span class="swimmer"></span>
		{:else}
			<span class="paddle left"></span>
			<span class="paddle right"></span>
			<span class="ball"></span>
		{/if}
	</div>
	<p class="title">{spec.title}</p>
	<p class="line">{LINES[spec.id] ?? 'Loading'}<span class="dots"><span>.</span><span>.</span><span>.</span></span></p>
</div>

<style>
	.load {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		overflow: hidden;
		color: #e2e8f0;
		text-align: center;
	}
	.scene {
		position: relative;
		width: min(80%, 340px);
		height: 130px;
		margin-bottom: 10px;
		overflow: hidden;
		border-radius: 12px;
	}
	.title {
		margin: 0;
		font: 900 1.4rem/1.1 'Arial Black', Impact, sans-serif;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
		text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.line {
		margin: 0;
		font-size: 0.85rem;
		color: #94a3b8;
	}
	.dots span {
		animation: blink 1.2s infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes blink {
		0%,
		60%,
		100% {
			opacity: 0.2;
		}
		30% {
			opacity: 1;
		}
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
	}

	/* iFish: the shop opens, its sign swinging, a fish swimming past the window. */
	.ifish {
		background: radial-gradient(ellipse at 50% 40%, #134a6a, #07121c 75%);
	}
	.ifish .scene {
		background: #1b3550;
	}
	.awning {
		position: absolute;
		inset: 0 0 auto;
		height: 22px;
		background: repeating-linear-gradient(90deg, #e8434b 0 20px, #f4f1ea 20px 40px);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.25);
	}
	.shop {
		position: absolute;
		left: 50%;
		bottom: 6px;
		width: 92px;
		height: 92px;
		margin-left: -46px;
		animation: bob 1.6s ease-in-out infinite;
	}
	.open {
		position: absolute;
		top: 30px;
		right: 24px;
		padding: 2px 6px;
		font: 900 0.7rem/1 'Arial Black', Impact, sans-serif;
		color: #04121c;
		background: #4ade80;
		border-radius: 3px;
		transform-origin: 50% -8px;
		animation: swing 1.8s ease-in-out infinite;
	}
	.swimmer {
		position: absolute;
		top: 64px;
		width: 18px;
		height: 9px;
		background: #2ab0e8;
		box-shadow: -7px 0 0 -1px #1a7ab0;
		animation: swimby 3.2s linear infinite;
	}
	@keyframes bob {
		50% {
			transform: translateY(-5px);
		}
	}
	@keyframes swing {
		0%,
		100% {
			transform: rotate(-8deg);
		}
		50% {
			transform: rotate(8deg);
		}
	}
	@keyframes swimby {
		from {
			left: -30px;
		}
		to {
			left: 110%;
		}
	}

	/* Top Gun: a jet streaking through the sky. */
	.topgun {
		background: linear-gradient(#0b2a4a, #1e5a8a 60%, #f0a868);
	}
	.topgun .scene {
		background: linear-gradient(#3b82c4, #9cc8ea);
	}
	.cloud {
		position: absolute;
		height: 16px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.8);
		animation: drift 3s linear infinite;
	}
	.c1 {
		top: 22px;
		width: 70px;
	}
	.c2 {
		top: 88px;
		width: 50px;
		animation-duration: 4.4s;
		animation-delay: -2s;
	}
	@keyframes drift {
		from {
			left: 100%;
		}
		to {
			left: -30%;
		}
	}
	.jet {
		position: absolute;
		top: 44px;
		width: 44px;
		height: 44px;
		animation: fly 2.4s ease-in-out infinite;
	}
	.trail {
		position: absolute;
		right: 70%;
		top: 50%;
		width: 140px;
		height: 3px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9));
	}
	@keyframes fly {
		0% {
			left: -20%;
			transform: translateY(10px) rotate(-6deg);
		}
		50% {
			transform: translateY(-12px) rotate(4deg);
		}
		100% {
			left: 110%;
			transform: translateY(10px) rotate(-6deg);
		}
	}

	/* Fishy: a fish swimming through rising bubbles. */
	.fishy {
		background: radial-gradient(circle at 50% 20%, #0e5f8a, #04203a 75%);
	}
	.fishy .scene {
		background: linear-gradient(#1b8ab8, #0b4a78);
	}
	.bubble {
		position: absolute;
		bottom: -14px;
		width: 10px;
		height: 10px;
		border: 2px solid rgba(255, 255, 255, 0.7);
		border-radius: 50%;
		animation: rise 2.2s ease-in infinite;
	}
	@keyframes rise {
		to {
			transform: translateY(-160px) translateX(8px);
			opacity: 0;
		}
	}
	.fish {
		position: absolute;
		top: 42px;
		width: 48px;
		height: 48px;
		animation: swim 3.2s ease-in-out infinite alternate;
	}
	@keyframes swim {
		from {
			left: 6%;
			transform: translateY(-8px) scaleX(-1);
		}
		to {
			left: 78%;
			transform: translateY(8px) scaleX(-1);
		}
	}

	/* Space Invaders: an invader marching over twinkling stars. */
	.spaceinvaders {
		background: #05050c;
	}
	.spaceinvaders .scene {
		background: #000;
	}
	.star {
		position: absolute;
		width: 2px;
		height: 2px;
		background: #fff;
		animation: twinkle 1.5s infinite;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.2;
		}
	}
	.invader {
		position: absolute;
		top: 40px;
		width: 4px;
		height: 4px;
		color: #facc15;
		/* An 11×8 invader, one shadow per pixel. */
		box-shadow:
			8px 0, 32px 0,
			12px 4px, 28px 4px,
			8px 8px, 12px 8px, 16px 8px, 20px 8px, 24px 8px, 28px 8px, 32px 8px,
			4px 12px, 8px 12px, 16px 12px, 20px 12px, 24px 12px, 32px 12px, 36px 12px,
			0 16px, 4px 16px, 8px 16px, 12px 16px, 16px 16px, 20px 16px, 24px 16px, 28px 16px, 32px 16px, 36px 16px, 40px 16px,
			0 20px, 8px 20px, 12px 20px, 16px 20px, 20px 20px, 24px 20px, 28px 20px, 32px 20px, 40px 20px,
			0 24px, 8px 24px, 32px 24px, 40px 24px,
			12px 28px, 16px 28px, 24px 28px, 28px 28px;
		animation: march 2.4s steps(6) infinite alternate;
	}
	@keyframes march {
		from {
			left: 10%;
		}
		to {
			left: calc(90% - 44px);
			top: 60px;
		}
	}

	/* Frogger: a frog hopping across the lanes. */
	.frogger {
		background: #14301c;
	}
	.frogger .scene {
		background: linear-gradient(#3a8a3a 0 22%, #3a3a44 22% 78%, #3a8a3a 78%);
	}
	.lane {
		position: absolute;
		left: 0;
		width: 200%;
		height: 3px;
		background: repeating-linear-gradient(90deg, #f8e070 0 18px, transparent 18px 36px);
		animation: road 1s linear infinite;
	}
	.l1 {
		top: 42%;
	}
	.l2 {
		top: 58%;
		animation-direction: reverse;
	}
	@keyframes road {
		to {
			transform: translateX(-36px);
		}
	}
	.frog {
		position: absolute;
		left: calc(50% - 20px);
		width: 40px;
		height: 40px;
		animation: hop 2.4s steps(4) infinite;
	}
	@keyframes hop {
		from {
			top: 100%;
		}
		to {
			top: -40px;
		}
	}

	/* Pong: the ball rallying between two paddles. */
	.pong {
		background: #0a0a0a;
	}
	.pong .scene {
		background: #000;
		border: 2px solid #333;
	}
	.paddle {
		position: absolute;
		width: 8px;
		height: 34px;
		background: #fff;
		animation: track 1.6s ease-in-out infinite alternate;
	}
	.left {
		left: 10px;
	}
	.right {
		right: 10px;
		animation-delay: -0.8s;
	}
	@keyframes track {
		from {
			top: 12px;
		}
		to {
			top: 80px;
		}
	}
	.ball {
		position: absolute;
		width: 10px;
		height: 10px;
		background: #f97316;
		animation:
			rallyX 1.6s linear infinite alternate,
			rallyY 1.1s ease-in-out infinite alternate;
	}
	@keyframes rallyX {
		from {
			left: 20px;
		}
		to {
			left: calc(100% - 30px);
		}
	}
	@keyframes rallyY {
		from {
			top: 14px;
		}
		to {
			top: 104px;
		}
	}
</style>
