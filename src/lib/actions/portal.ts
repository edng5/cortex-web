// Moves an element to the end of <body>, so a pop-up inside a scaled or clipped container
// (e.g. the zoomed E.Ngine Games dock) still covers the whole screen at its normal size.
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
