// Svelte action: a mouse wheel scrolls a sideways row (favourites, languages) until it reaches an
// end, then scrolls the page as usual. Trackpads' own sideways swipes are left alone.
export function sideways(el: HTMLElement) {
	const wheel = (e: WheelEvent) => {
		if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || el.scrollWidth <= el.clientWidth) return;
		const max = el.scrollWidth - el.clientWidth;
		if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
		e.preventDefault();
		el.scrollLeft += e.deltaY;
	};
	// Not passive, so it can stop the page scrolling instead.
	el.addEventListener('wheel', wheel, { passive: false });
	return { destroy: () => el.removeEventListener('wheel', wheel) };
}
