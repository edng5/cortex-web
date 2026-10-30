// Voxel models, Crossy Road style: every model is a pile of boxes drawn with a light top face and a
// darker front face. Shared by Frogger and FishMart (which reuses Frogger's Magikarp).
//
// A model is a list of boxes in tile units: (x, y) from the tile's top-left corner on the
// ground (y grows toward the viewer), z up from the ground; w × d footprint, h tall.
export interface Box {
	x: number;
	y: number;
	z: number;
	w: number;
	d: number;
	h: number;
	c: string;
	a?: number;
}
export type Model = Box[];
export const bx = (x: number, y: number, z: number, w: number, d: number, h: number, c: string, a?: number): Box => ({ x, y, z, w, d, h, c, a });
/** Draw order: farther (smaller y) and lower first, so blocks in front and on top cover them. */
export const model = (boxes: Box[]): Model => boxes.sort((p, q) => p.y + p.d + p.z - (q.y + q.d + q.z));
/** Draw order for a flat model with details lying on top of it (Magikarp): bottom up, then back to front. */
export const layered = (boxes: Box[]): Model => boxes.sort((p, q) => p.z - q.z || p.y + p.d - (q.y + q.d));

// Shading is asked for over and over with the same colours (every block of every model, every
// frame), so the answers are remembered. Shades that drift smoothly (glows) would fill the cache
// forever, so it starts afresh when it gets big.
const shades = new Map<string, Map<number, string>>();
let remembered = 0;
export function shade(color: string, f: number): string {
	let byF = shades.get(color);
	if (!byF) shades.set(color, (byF = new Map()));
	let out = byF.get(f);
	if (out === undefined) {
		if (++remembered > 4000) {
			shades.clear();
			shades.set(color, byF);
			byF.clear();
			remembered = 1;
		}
		out = computeShade(color, f);
		byF.set(f, out);
	}
	return out;
}
function computeShade(color: string, f: number): string {
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
	// Also takes an already-shaded rgb(...) colour, so shades can be stacked.
	if (color.startsWith('rgb')) {
		const [r, g, b] = color.slice(color.indexOf('(') + 1).split(',').map((x) => parseFloat(x));
		return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
	}
	const n = parseInt(color.slice(1), 16);
	return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Each colour's lit top and shaded front, by colour (the hot path: every block, every frame). */
const tops = new Map<string, string>();
const fronts = new Map<string, string>();
const lit = (map: Map<string, string>, c: string, f: number) => {
	let out = map.get(c);
	if (out === undefined) map.set(c, (out = shade(c, f)));
	return out;
};

/** Draw a model with its tile's top-left at (px, py): `T` px per tile, `Z` px per tile of height. */
export function drawVoxel(ctx: CanvasRenderingContext2D, m: Model, px: number, py: number, T: number, Z: number, s = 1, alpha = 1, flatten = 1) {
	for (const b of m) {
		ctx.globalAlpha = alpha * (b.a ?? 1);
		const X = px + b.x * T * s;
		const W = b.w * T * s;
		const top = py + b.y * T * s - (b.z + b.h) * Z * s * flatten;
		ctx.fillStyle = lit(tops, b.c, 1.14);
		ctx.fillRect(X, top, W, b.d * T * s);
		ctx.fillStyle = lit(fronts, b.c, 0.74);
		ctx.fillRect(X, py + (b.y + b.d) * T * s - (b.z + b.h) * Z * s * flatten, W, b.h * Z * s * flatten);
	}
	ctx.globalAlpha = 1;
}

/**
 * Magikarp, chunky blocks like the others, lying on its side as it flops: built facing up (head at
 * the top), its back (crown fin) to the right and belly to the left, with its flank, eye and side
 * fin facing the sky.
 */
export function magikarpModel(): Model {
	const orange = '#ee5a2c';
	const dark = '#c9381e';
	const yellow = '#f6d75a';
	const white = '#f2f2f2';
	const grey = '#b8b8c2';
	const red = '#e8462a';
	return layered([
		// Tail: an orange stem opening into a white fan with grey ribs and a red edge.
		bx(0.36, 0.62, 0.05, 0.3, 0.08, 0.12, orange),
		bx(0.28, 0.68, 0.06, 0.44, 0.06, 0.08, white),
		bx(0.2, 0.74, 0.06, 0.6, 0.07, 0.08, white),
		bx(0.12, 0.81, 0.06, 0.76, 0.08, 0.08, white),
		bx(0.3, 0.7, 0.14, 0.04, 0.19, 0.005, grey),
		bx(0.48, 0.7, 0.14, 0.04, 0.19, 0.005, grey),
		bx(0.66, 0.7, 0.14, 0.04, 0.19, 0.005, grey),
		bx(0.06, 0.89, 0.06, 0.88, 0.05, 0.08, red),
		bx(0.06, 0.79, 0.06, 0.06, 0.1, 0.08, red),
		bx(0.88, 0.79, 0.06, 0.06, 0.1, 0.08, red),
		bx(0.14, 0.73, 0.06, 0.06, 0.08, 0.08, red),
		bx(0.8, 0.73, 0.06, 0.06, 0.08, 0.08, red),
		// Belly fins.
		bx(0.08, 0.36, 0.06, 0.1, 0.22, 0.08, yellow),
		bx(0.03, 0.38, 0.06, 0.06, 0.05, 0.06, yellow),
		bx(0.03, 0.48, 0.06, 0.06, 0.05, 0.06, yellow),
		// Flat body.
		bx(0.16, 0.1, 0, 0.66, 0.54, 0.2, orange),
		// Darker scales across its back.
		bx(0.5, 0.36, 0.2, 0.18, 0.04, 0.005, dark),
		bx(0.46, 0.46, 0.2, 0.22, 0.04, 0.005, dark),
		bx(0.54, 0.54, 0.2, 0.14, 0.04, 0.005, dark),
		// Crown fin along its back (the side it lies to), with three points, low down so from the
		// side it peeks out from behind the body.
		bx(0.82, 0.2, 0, 0.16, 0.38, 0.1, yellow),
		bx(0.98, 0.22, 0, 0.06, 0.07, 0.1, yellow),
		bx(0.98, 0.35, 0, 0.08, 0.08, 0.1, yellow),
		bx(0.98, 0.5, 0, 0.05, 0.07, 0.1, yellow),
		// Big pink lips at the front, with a yellow whisker at the side of the mouth.
		bx(0.36, 0.02, 0.04, 0.18, 0.1, 0.18, '#f4a0a0'),
		bx(0.4, 0.0, 0.1, 0.1, 0.03, 0.08, '#b55a5a'),
		bx(0.3, 0.12, 0.2, 0.05, 0.16, 0.03, yellow),
		bx(0.26, 0.26, 0.2, 0.05, 0.08, 0.03, yellow),
		// Eye on its flank, near the head.
		bx(0.5, 0.13, 0.2, 0.2, 0.18, 0.02, '#ffffff'),
		bx(0.55, 0.18, 0.22, 0.09, 0.08, 0.01, '#111111'),
		// White side fin with grey ribs, under an orange strip.
		bx(0.28, 0.3, 0.2, 0.16, 0.2, 0.03, white),
		bx(0.3, 0.36, 0.23, 0.12, 0.03, 0.005, grey),
		bx(0.3, 0.42, 0.23, 0.12, 0.03, 0.005, grey),
		bx(0.44, 0.3, 0.2, 0.05, 0.2, 0.04, orange)
	]);
}
