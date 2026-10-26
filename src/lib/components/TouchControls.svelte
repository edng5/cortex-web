<!--
  On-screen controls for the E.Ngine Games on touch screens: a translucent joystick (W/A/S/D),
  an optional second one (arrow keys, for Fishy's player 2) and the game's buttons. Or, for
  `gesture` games (Frogger), Crossy Road style: tap anywhere to go forward, swipe to go that way.
  They send the same key presses the keyboard would, so the games don't need to know about touch.
-->
<script lang="ts">
	import type { TouchSpec } from '$lib/games/registry';

	let {
		spec,
		gestures = false,
		disabled = [],
		press,
		release
	}: { spec: TouchSpec; gestures?: boolean; disabled?: string[]; press: (code: string) => void; release: (code: string) => void } = $props();

	/** Tap = forward; swipe = that direction (a key tap: press then release). */
	function swipeArea(el: HTMLElement) {
		let start: { id: number; x: number; y: number } | null = null;
		const tap = (code: string) => {
			press(code);
			release(code);
		};
		const down = (e: PointerEvent) => {
			if (start) return;
			start = { id: e.pointerId, x: e.clientX, y: e.clientY };
			e.preventDefault();
		};
		const up = (e: PointerEvent) => {
			if (!start || e.pointerId !== start.id) return;
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			start = null;
			if (Math.hypot(dx, dy) < 18) return tap(WASD.up);
			if (Math.abs(dx) > Math.abs(dy)) tap(dx < 0 ? WASD.left : WASD.right);
			else tap(dy < 0 ? WASD.up : WASD.down);
		};
		const cancel = () => (start = null);
		el.addEventListener('pointerdown', down);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', cancel);
		return {
			destroy() {
				el.removeEventListener('pointerdown', down);
				el.removeEventListener('pointerup', up);
				el.removeEventListener('pointercancel', cancel);
			}
		};
	}

	const WASD = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
	const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

	/** One joystick: drag the knob; the held keys follow its direction. */
	function stick(el: HTMLElement, opts: { keys: typeof WASD; mode: 'h' | '4' | '8'; repeat?: number }) {
		const knob = el.querySelector<HTMLElement>('.knob')!;
		let held = new Set<string>();
		let pointer: number | null = null;
		let timer: ReturnType<typeof setInterval> | null = null;

		const set = (next: Set<string>) => {
			for (const k of held) if (!next.has(k)) release(k);
			for (const k of next) if (!held.has(k)) press(k);
			held = next;
			// Games that act once per press (Frogger's hops) repeat while the stick is held.
			if (timer) clearInterval(timer);
			timer = null;
			if (opts.repeat && next.size) timer = setInterval(() => held.forEach((k) => press(k)), opts.repeat);
		};
		const move = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			const R = r.width / 2;
			let dx = (e.clientX - (r.left + R)) / R;
			let dy = (e.clientY - (r.top + R)) / R;
			const len = Math.hypot(dx, dy);
			if (len > 1) {
				dx /= len;
				dy /= len;
			}
			knob.style.transform = `translate(${dx * R * 0.6}px, ${(opts.mode === 'h' ? 0 : dy) * R * 0.6}px)`;
			const next = new Set<string>();
			const DEAD = 0.35;
			if (opts.mode === 'h') {
				if (dx < -DEAD) next.add(opts.keys.left);
				if (dx > DEAD) next.add(opts.keys.right);
			} else if (opts.mode === '4') {
				if (Math.max(Math.abs(dx), Math.abs(dy)) > DEAD) {
					if (Math.abs(dx) > Math.abs(dy)) next.add(dx < 0 ? opts.keys.left : opts.keys.right);
					else next.add(dy < 0 ? opts.keys.up : opts.keys.down);
				}
			} else {
				if (dx < -DEAD) next.add(opts.keys.left);
				if (dx > DEAD) next.add(opts.keys.right);
				if (dy < -DEAD) next.add(opts.keys.up);
				if (dy > DEAD) next.add(opts.keys.down);
			}
			set(next);
		};
		const down = (e: PointerEvent) => {
			if (pointer !== null) return;
			pointer = e.pointerId;
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				/* pointer already gone */
			}
			e.preventDefault();
			move(e);
		};
		const pmove = (e: PointerEvent) => e.pointerId === pointer && move(e);
		const up = (e: PointerEvent) => {
			if (e.pointerId !== pointer) return;
			pointer = null;
			knob.style.transform = '';
			set(new Set());
		};
		el.addEventListener('pointerdown', down);
		el.addEventListener('pointermove', pmove);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
		return {
			destroy() {
				set(new Set());
				el.removeEventListener('pointerdown', down);
				el.removeEventListener('pointermove', pmove);
				el.removeEventListener('pointerup', up);
				el.removeEventListener('pointercancel', up);
			}
		};
	}

	/** A button: held while touched. */
	function button(el: HTMLElement, code: string) {
		let pointer: number | null = null;
		const down = (e: PointerEvent) => {
			if (pointer !== null) return;
			pointer = e.pointerId;
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				/* pointer already gone */
			}
			e.preventDefault();
			el.classList.add('on');
			press(code);
		};
		const up = (e: PointerEvent) => {
			if (e.pointerId !== pointer) return;
			pointer = null;
			el.classList.remove('on');
			release(code);
		};
		el.addEventListener('pointerdown', down);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
		return {
			destroy() {
				if (pointer !== null) release(code);
				el.removeEventListener('pointerdown', down);
				el.removeEventListener('pointerup', up);
				el.removeEventListener('pointercancel', up);
			}
		};
	}
</script>

{#if spec.gesture && gestures}
	<div class="swipe" use:swipeArea>
		<p class="hint">Tap to hop · Swipe to turn</p>
	</div>
{/if}
<div class="touch" aria-hidden="true">
	{#if spec.stick}
		<div class="pad stick" use:stick={{ keys: WASD, mode: spec.stick, repeat: spec.repeat }}>
			<div class="knob"></div>
			{#if spec.stick2}<span class="tag">P1</span>{/if}
		</div>
	{:else}
		<span></span>
	{/if}
	<div class="right">
		{#each spec.buttons as b (b.code)}
			<div class="btn" class:big={b.big} class:off={disabled.includes(b.code)} use:button={b.code}>{b.label}</div>
		{/each}
		{#if spec.stick2}
			<div class="pad stick small" use:stick={{ keys: ARROWS, mode: '8' }}>
				<div class="knob"></div>
				<span class="tag">P2</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.touch {
		position: fixed;
		left: 0;
		right: 0;
		bottom: calc(14px + env(safe-area-inset-bottom));
		z-index: 4;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 0 18px;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}
	/* Tap / swipe anywhere below the top bar (the ✕ and the buttons stay on top). */
	.swipe {
		position: fixed;
		top: 52px;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.hint {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(110px + env(safe-area-inset-bottom));
		margin: 0;
		text-align: center;
		font: 600 0.85rem/1 system-ui, sans-serif;
		color: rgba(255, 255, 255, 0.7);
		animation: hint-fade 4s ease-in forwards;
		pointer-events: none;
	}
	@keyframes hint-fade {
		0%,
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
	.pad,
	.btn {
		pointer-events: auto;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.stick {
		position: relative;
		width: 128px;
		height: 128px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.28);
		display: grid;
		place-items: center;
	}
	.stick.small {
		width: 108px;
		height: 108px;
	}
	.knob {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.38);
		border: 2px solid rgba(255, 255, 255, 0.55);
		pointer-events: none;
	}
	.tag {
		position: absolute;
		top: -18px;
		font-size: 0.7rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.6);
	}
	.right {
		display: flex;
		flex-wrap: wrap-reverse;
		justify-content: flex-end;
		align-items: flex-end;
		gap: 12px;
		max-width: 60vw;
	}
	.btn {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		border: 2px solid rgba(255, 255, 255, 0.32);
		color: rgba(255, 255, 255, 0.85);
		font: 700 0.72rem/1 system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.btn.big {
		width: 82px;
		height: 82px;
		font-size: 0.8rem;
	}
	.btn:global(.on) {
		background: rgba(255, 255, 255, 0.32);
	}
	.btn.off {
		pointer-events: none;
		opacity: 0.3;
	}
	/* Landscape phones: smaller, so they sit beside the game. */
	@media (orientation: landscape) {
		.stick {
			width: 108px;
			height: 108px;
		}
		.btn {
			width: 56px;
			height: 56px;
		}
		.btn.big {
			width: 70px;
			height: 70px;
		}
	}
</style>
