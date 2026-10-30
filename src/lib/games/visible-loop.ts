// A canvas animation loop that only runs while its element is on screen: hidden (another tab,
// the game closed), scrolled out of view, or behind display:none, it stops completely (no
// wake-ups, no drawing), and picks up again when it's back. `frame` gets the time and the
// seconds since the last frame (0 on the first frame after a pause, so nothing jumps).
// `maxFps` caps how often it draws on fast screens (a 120 Hz phone draws every other frame at 60).
export function visibleLoop(el: Element, frame: (now: number, dt: number) => void, maxFps = Infinity): () => void {
	let raf = 0;
	let last = -1;
	// When the next frame is due (with a little slack, so a frame a touch early still counts).
	// Scheduled, not just spaced out, so 90 and 144 Hz screens still get about 60 too.
	const every = 1000 / maxFps;
	let due = 0;
	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		if (last >= 0 && now < due - 2) return;
		due = Math.max(due + every, now);
		const dt = last < 0 ? 0 : Math.max(0, now - last) / 1000;
		last = now;
		frame(now, dt);
	};
	const io = new IntersectionObserver(([e]) => {
		if (e.isIntersecting && !raf) {
			last = -1;
			raf = requestAnimationFrame(loop);
		} else if (!e.isIntersecting && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	});
	io.observe(el);
	return () => {
		io.disconnect();
		cancelAnimationFrame(raf);
	};
}
