// java.awt.Rectangle / Shape behaviour the game relies on, reproduced exactly.
// Java ints: whole-number maths, so divisions truncate toward zero (idiv).

export const idiv = (a: number, b: number) => Math.trunc(a / b);
/** Java's (int)(Math.random() * n). */
export const rnd = (n: number) => Math.floor(Math.random() * n);

export class Rect {
	constructor(
		public x: number,
		public y: number,
		public width: number,
		public height: number
	) {}

	/** java.awt.Rectangle.intersects (empty rectangles never intersect). */
	intersects(r: Rect): boolean {
		if (r.width <= 0 || r.height <= 0 || this.width <= 0 || this.height <= 0) return false;
		return r.x + r.width > this.x && r.y + r.height > this.y && this.x + this.width > r.x && this.y + this.height > r.y;
	}

	getBounds(): Rect {
		return new Rect(this.x, this.y, this.width, this.height);
	}
}

/** A Java Shape: a rectangle that may have been rotated (AffineTransform) one or more times. */
export class Shape {
	constructor(private pts: [number, number][]) {}

	static rect(x: number, y: number, w: number, h: number): Shape {
		return new Shape([
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h]
		]);
	}

	/** transform.rotate(toRadians(deg), cx, cy); transform.createTransformedShape(this) */
	rotated(deg: number, cx: number, cy: number): Shape {
		const t = (deg * Math.PI) / 180;
		const c = Math.cos(t);
		const s = Math.sin(t);
		return new Shape(this.pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]));
	}

	/** Shape.getBounds(): the enclosing integer rectangle. */
	getBounds(): Rect {
		let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
		for (const [x, y] of this.pts) {
			x1 = Math.min(x1, x); y1 = Math.min(y1, y);
			x2 = Math.max(x2, x); y2 = Math.max(y2, y);
		}
		const fx = Math.floor(x1);
		const fy = Math.floor(y1);
		return new Rect(fx, fy, Math.ceil(x2) - fx, Math.ceil(y2) - fy);
	}
}
