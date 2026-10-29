// Svelte action: a sideways-scrolling strip (a wide fish tank) panned by hand. A finger or a
// mouse drags it sideways (a quick flick keeps it gliding); the browser keeps up/down swipes
// (touch-action: pan-y), so the page around it still scrolls. Chrome on Android won't reliably
// hand sideways swipes to a strip inside the games pop-up, so they're handled here.
// Up/down wheel turns scroll it sideways until it reaches an end, then scroll the page as usual.
// A drag doesn't count as a click on whatever it started on.
export function panScroll(el: HTMLElement) {
	let down: { x: number; left: number; id: number } | null = null;
	let dragged = false;
	let v = 0; // px per ms, for the flick
	let last = { x: 0, t: 0 };
	let glide = 0;
	const wide = () => el.scrollWidth > el.clientWidth + 1;
	el.style.touchAction = 'pan-y';

	function onDown(e: PointerEvent) {
		cancelAnimationFrame(glide);
		if ((e.pointerType === 'mouse' && e.button !== 0) || !e.isPrimary || !wide()) return;
		down = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
		last = { x: e.clientX, t: e.timeStamp };
		dragged = false;
		v = 0;
	}
	function onMove(e: PointerEvent) {
		if (!down || e.pointerId !== down.id) return;
		const dx = e.clientX - down.x;
		if (!dragged && Math.abs(dx) < 6) return;
		if (!dragged) {
			dragged = true;
			el.setPointerCapture(down.id);
			if (e.pointerType === 'mouse') el.style.cursor = 'grabbing';
		}
		el.scrollLeft = down.left - dx;
		const dt = e.timeStamp - last.t;
		if (dt > 0) v = 0.8 * ((e.clientX - last.x) / dt) + 0.2 * v;
		last = { x: e.clientX, t: e.timeStamp };
	}
	function onUp(e: PointerEvent) {
		if (!down || e.pointerId !== down.id) return;
		down = null;
		el.style.cursor = '';
		if (!dragged || e.type === 'pointercancel' || e.timeStamp - last.t > 80) return;
		// The flick: keep gliding, slowing down.
		let speed = -v;
		let t0 = performance.now();
		const step = (t: number) => {
			const dt = t - t0;
			t0 = t;
			el.scrollLeft += speed * dt;
			speed *= Math.pow(0.995, dt);
			if (Math.abs(speed) > 0.02) glide = requestAnimationFrame(step);
		};
		glide = requestAnimationFrame(step);
	}
	function onClick(e: MouseEvent) {
		if (!dragged) return;
		dragged = false;
		e.stopPropagation();
		e.preventDefault();
	}
	function onWheel(e: WheelEvent) {
		if (!wide() || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
		const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
		const max = el.scrollWidth - el.clientWidth;
		if ((d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= max - 1)) return;
		e.preventDefault();
		el.scrollLeft += d;
	}

	el.addEventListener('pointerdown', onDown);
	el.addEventListener('pointermove', onMove);
	el.addEventListener('pointerup', onUp);
	el.addEventListener('pointercancel', onUp);
	el.addEventListener('click', onClick, true);
	el.addEventListener('wheel', onWheel, { passive: false });
	return {
		destroy() {
			cancelAnimationFrame(glide);
			el.removeEventListener('pointerdown', onDown);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onUp);
			el.removeEventListener('click', onClick, true);
			el.removeEventListener('wheel', onWheel);
		}
	};
}
