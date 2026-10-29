// Svelte action: a sideways-scrolling strip (a wide fish tank) that a mouse can pan too.
// Touch screens already swipe it natively; with a mouse, drag it, or turn the wheel. Up/down
// wheel turns scroll it sideways until it reaches an end, then scroll the page as usual.
// A drag doesn't count as a click on whatever it started on.
export function panScroll(el: HTMLElement) {
	let down: { x: number; left: number; id: number } | null = null;
	let dragged = false;
	const wide = () => el.scrollWidth > el.clientWidth + 1;

	function onDown(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || e.button !== 0 || !wide()) return;
		down = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
		dragged = false;
	}
	function onMove(e: PointerEvent) {
		if (!down || e.pointerId !== down.id) return;
		const dx = e.clientX - down.x;
		if (!dragged && Math.abs(dx) < 5) return;
		if (!dragged) {
			dragged = true;
			el.setPointerCapture(down.id);
			el.style.cursor = 'grabbing';
		}
		el.scrollLeft = down.left - dx;
	}
	function onUp() {
		down = null;
		el.style.cursor = '';
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
			el.removeEventListener('pointerdown', onDown);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onUp);
			el.removeEventListener('click', onClick, true);
			el.removeEventListener('wheel', onWheel);
		}
	};
}
