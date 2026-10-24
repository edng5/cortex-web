// Svelte action: on phones, swipe an element down (while it's scrolled to the top) to dismiss
// it. The element follows the finger; past a threshold, or on a quick flick, it slides off the
// bottom and `ondismiss` runs. Otherwise it springs back. Sideways swipes (e.g. a photo
// carousel) and normal scrolling are left alone.
export interface SwipeDismissParams {
	ondismiss: () => void;
	enabled?: boolean;
}

export function swipeDismiss(el: HTMLElement, params: SwipeDismissParams) {
	let p = params;
	const phone = matchMedia('(max-width: 720px)');
	let state: 'idle' | 'maybe' | 'drag' = 'idle';
	let startX = 0;
	let startY = 0;
	let startT = 0;
	let dy = 0;

	function onStart(e: TouchEvent) {
		state = 'idle';
		if (p.enabled === false || !phone.matches || e.touches.length !== 1 || el.scrollTop > 0) return;
		const t = e.touches[0];
		startX = t.clientX;
		startY = t.clientY;
		startT = performance.now();
		dy = 0;
		state = 'maybe';
	}

	function onMove(e: TouchEvent) {
		if (state === 'idle') return;
		const t = e.touches[0];
		const ddx = t.clientX - startX;
		const ddy = t.clientY - startY;
		if (state === 'maybe') {
			if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
			// Only a mostly-vertical pull downwards, from the top of the content, dismisses.
			if (ddy > 0 && ddy > Math.abs(ddx) * 1.2 && el.scrollTop <= 0) {
				state = 'drag';
				el.style.transition = 'none';
			} else {
				state = 'idle';
				return;
			}
		}
		e.preventDefault(); // don't scroll or pull-to-refresh while dragging the sheet
		dy = Math.max(0, ddy);
		el.style.transform = `translateY(${dy}px)`;
	}

	function onEnd() {
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
