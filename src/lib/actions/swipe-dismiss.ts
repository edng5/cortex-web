// Svelte action: on phones, swipe an element down (while it's scrolled to the top) to dismiss
// it. The element follows the finger; past a threshold, or on a quick flick, it slides off the
// bottom and `ondismiss` runs. Otherwise it springs back. Normal scrolling is left alone.
// With `onswipex`, a sideways swipe slides it off left/right and reports the direction
// (1 = swiped left, i.e. "next"; -1 = swiped right, "previous"). Sideways swipes that start
// inside a picture carousel ([data-swipe-ignore]) are left to the carousel.
export interface SwipeDismissParams {
	ondismiss: () => void;
	onswipex?: (dir: 1 | -1) => void;
	enabled?: boolean;
}

export function swipeDismiss(el: HTMLElement, params: SwipeDismissParams) {
	let p = params;
	const phone = matchMedia('(max-width: 720px)');
	let state: 'idle' | 'maybe' | 'drag' | 'xdrag' = 'idle';
	let startX = 0;
	let startY = 0;
	let startT = 0;
	let dy = 0;
	let dx = 0;
	let inCarousel = false;

	function onStart(e: TouchEvent) {
		state = 'idle';
		if (p.enabled === false || !phone.matches || e.touches.length !== 1) return;
		const t = e.touches[0];
		startX = t.clientX;
		startY = t.clientY;
		startT = performance.now();
		dy = 0;
		dx = 0;
		inCarousel = !!(e.target as Element | null)?.closest?.('[data-swipe-ignore]');
		state = 'maybe';
	}

	function onMove(e: TouchEvent) {
		if (state === 'idle') return;
		const t = e.touches[0];
		const ddx = t.clientX - startX;
		const ddy = t.clientY - startY;
		if (state === 'maybe') {
			if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
			// A mostly-vertical pull downwards, from the top of the content, dismisses.
			if (ddy > 0 && ddy > Math.abs(ddx) * 1.2 && el.scrollTop <= 0) {
				state = 'drag';
				el.style.transition = 'none';
			} else if (p.onswipex && !inCarousel && Math.abs(ddx) > Math.abs(ddy) * 1.2) {
				state = 'xdrag';
				el.style.transition = 'none';
			} else {
				state = 'idle';
				return;
			}
		}
		e.preventDefault(); // don't scroll or pull-to-refresh while dragging the sheet
		if (state === 'xdrag') {
			dx = ddx;
			el.style.transform = `translateX(${dx}px) rotate(${dx / 60}deg)`;
			el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 600));
			return;
		}
		dy = Math.max(0, ddy);
		el.style.transform = `translateY(${dy}px)`;
	}

	function onEnd() {
		if (state === 'xdrag') {
			state = 'idle';
			const speed = Math.abs(dx) / Math.max(1, performance.now() - startT);
			el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
			if (Math.abs(dx) > Math.min(110, el.offsetWidth * 0.28) || (Math.abs(dx) > 40 && speed > 0.6)) {
				const dir = dx < 0 ? 1 : -1;
				el.style.transform = `translateX(${dx < 0 ? -110 : 110}vw)`;
				el.style.opacity = '0';
				setTimeout(() => p.onswipex?.(dir), 180);
			} else {
				el.style.transform = '';
				el.style.opacity = '';
			}
			return;
		}
		if (state !== 'drag') {
			state = 'idle';
			return;
		}
		state = 'idle';
		const speed = dy / Math.max(1, performance.now() - startT); // px per ms
		el.style.transition = 'transform 0.22s ease-out';
		if (dy > Math.min(140, el.offsetHeight * 0.25) || (dy > 40 && speed > 0.6)) {
			el.style.transform = 'translateY(110vh)';
			setTimeout(() => p.ondismiss(), 200);
		} else {
			el.style.transform = '';
		}
	}

	el.addEventListener('touchstart', onStart, { passive: true });
	el.addEventListener('touchmove', onMove, { passive: false });
	el.addEventListener('touchend', onEnd);
	el.addEventListener('touchcancel', onEnd);

	return {
		update(next: SwipeDismissParams) {
			p = next;
		},
		destroy() {
			el.removeEventListener('touchstart', onStart);
			el.removeEventListener('touchmove', onMove);
			el.removeEventListener('touchend', onEnd);
			el.removeEventListener('touchcancel', onEnd);
		}
	};
}
