// Drawing fish in the chunky voxel style of Frogger: each species is first painted from its
// body shape, colours and pattern (stripes, bands, spots, calico patches…), then rebuilt out of
// blocks, each with a lighter top face and a darker underside, like Frogger's boxes. Sprites are
// cached per species, size and tail-swish frame. Magikarp and Stockfish (the easter eggs) have
// their own hand-built models (fishModels.ts); Fishy is drawn from its original art.
import type { Species } from './data';
import { bx, drawVoxel, model, type Box, type Model } from '../voxel';
import { customModel } from './fishModels';
import { buildFromPlan, planOf } from './bodyPlans';

type Ctx = CanvasRenderingContext2D;

/** A repeatable random number from a string (calico patches stay put on each fish). */
function seeded(key: string) {
	let h = 2166136261;
	for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return ((h ^= h >>> 16) >>> 0) / 4294967296;
	};
}

const BODY_H: Record<string, number> = { fish: 0.42, tall: 0.62, disc: 0.88, long: 0.2, shark: 0.24, ray: 0.7, puffy: 0.62, betta: 0.36, eel: 0.11, lion: 0.42, guppy: 0.32, bottom: 0.32 };

/** The size of one block, in screen pixels. */
export const BLOCK = 3;
const FRAMES = 4;
const sprites = new Map<string, HTMLCanvasElement>();

/**
 * Draw `sp` centred at (x, y), about `len` pixels nose to tail, facing right (dir 1) or left (-1),
 * built from voxel blocks. `t` swishes the tail.
 */
export function drawFish(c: Ctx, sp: Species, x: number, y: number, len: number, dir: 1 | -1, t: number, _key = sp.id, alpha = 1) {
	if (sp.img) return drawPicture(c, sp.img, x, y, len, dir, t, alpha);
	const frame = ((Math.floor(((t * 6) / (Math.PI * 2)) * FRAMES) % FRAMES) + FRAMES) % FRAMES;
	const key = `${sp.id}|${frame}|${dir}`;
	let m = models.get(key);
	if (!m) {
		m = fishModel(sp, frame / FRAMES, dir);
		models.set(key, m);
	}
	// The model is one tile long; its middle sits at height MID.
	const T = len;
	const Z = len * 0.8;
	c.save();
	c.imageSmoothingEnabled = false;
	drawVoxel(c, m, x - T / 2, y - T / 2 + MID * Z, T, Z, 1, alpha);
	c.restore();
}

// ── Voxel fish models ────────────────────────────────────────────────────────────────
// Built like Frogger's characters, out of boxes, in tile units: x along the fish (tail at 0, nose
// at 1), y across it (0.5 is the middle; the viewer is at larger y), z up. The body is a row of
// slices whose height and thickness follow the species' outline; the belly, fins, tail and eyes
// are boxes of their own, and the pattern is painted onto the slices.
const MID = 0.32;
const models = new Map<string, Model>();
const hexShade = (hex: string, f: number) => {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
	return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
};

/** Body height (tile units), thickness (side to side, as a share of height) and how blunt the nose is. */
const OUTLINE: Record<string, { h: number; thick: number; nose: number; flat?: boolean }> = {
	fish: { h: 0.32, thick: 0.45, nose: 0.6 },
	tall: { h: 0.4, thick: 0.3, nose: 0.55 },
	disc: { h: 0.52, thick: 0.3, nose: 0.75 },
	long: { h: 0.17, thick: 0.5, nose: 0.25 },
	shark: { h: 0.2, thick: 0.6, nose: 0.3 },
	puffy: { h: 0.42, thick: 0.75, nose: 0.8 },
	betta: { h: 0.24, thick: 0.45, nose: 0.6 },
	lion: { h: 0.3, thick: 0.5, nose: 0.6 },
	guppy: { h: 0.2, thick: 0.45, nose: 0.6 },
	bottom: { h: 0.22, thick: 0.6, nose: 0.5, flat: true },
	eel: { h: 0.09, thick: 0.9, nose: 0.4 },
	ray: { h: 0.06, thick: 1, nose: 0.9 }
};

function fishModel(sp: Species, phase: number, dir: 1 | -1): Model {
	// Some fish have their own hand-built model (see fishModels.ts).
	const custom = customModel(sp);
	if (custom) return finish(custom(sp, phase), dir, sp.shape === 'ray');
	// Otherwise its family's body plan (bodyPlans.ts); the generic outline is the fallback.
	const plan = planOf(sp);
	if (plan) return finish(buildFromPlan(sp, plan, phase), dir, false);
	const o = OUTLINE[sp.shape] ?? OUTLINE.fish;
	const [body, belly, fin] = sp.colors;
	const pc = sp.pcolor ?? '#202028';
	const boxes: Box[] = [];
	const swish = Math.sin(phase * Math.PI * 2);
	const rnd = seeded(sp.id);
	const N = sp.shape === 'eel' ? 16 : 11;
	const x0 = sp.shape === 'guppy' ? 0.3 : sp.shape === 'betta' ? 0.25 : 0.2;
	const x1 = sp.shape === 'shark' || sp.shape === 'long' ? 0.98 : 0.92;
	const dx = (x1 - x0) / N;
	const spots = new Set(Array.from({ length: 6 }, () => Math.floor(rnd() * N)));
	const patches = new Set(Array.from({ length: 4 }, () => Math.floor(rnd() * N)));
	let headTop = 0;
	let headD = 0;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		// Outline: rounded, tapering to the tail; sharks and arowanas come to a point at the nose.
		let k = Math.sin(Math.PI * Math.min(1, u * (1 + (1 - o.nose) * 0.6)));
		if (sp.shape === 'ray') k = Math.sin(Math.PI * u) ** 0.5;
		if (sp.shape === 'eel') k = 1 - u * 0.15;
		k = Math.max(0.28, k);
		const h = o.h * k;
		const d = sp.shape === 'ray' ? 0.75 * Math.sin(Math.PI * u) ** 0.6 : Math.max(0.06, h * o.thick);
		// A gentle wave down the body as it swims (stronger toward the tail; eels wriggle).
		const wave = Math.sin(phase * Math.PI * 2 - u * 4) * (1 - u) * (sp.shape === 'eel' ? 0.07 : 0.025);
		const y = 0.5 - d / 2 + wave;
		const z = o.flat ? 0 : MID - h / 2;
		const x = x0 + i * dx;
		// Colours: the pattern on the upper body, the belly below.
		let top = body;
		switch (sp.pattern) {
			case 'vbands':
				if (i % 4 === 1) top = pc;
				break;
			case 'zebra':
				if (i % 2 === 1) top = pc;
				break;
			case 'split':
				if (u < 0.45) top = pc;
				break;
			case 'calico':
			case 'marble':
				if (patches.has(i)) top = pc;
				break;
		}
		const bh = o.flat ? h * 0.3 : h * 0.38;
		const banded = sp.pattern === 'vbands' || sp.pattern === 'zebra';
		boxes.push(bx(x, y, z, dx + 0.002, d, bh, banded && top === pc ? pc : belly));
		boxes.push(bx(x, y, z + bh, dx + 0.002, d, h - bh, top));
		// Horizontal stripes and the neon line run along the side facing you.
		if (sp.pattern === 'hstripes' || sp.pattern === 'neon') boxes.push(bx(x, y + d, z + h * 0.55, dx + 0.002, 0.004, h * 0.12, sp.pattern === 'neon' ? (sp.pcolor ?? '#2fb5ff') : pc));
		if (sp.pattern === 'neon' && u < 0.6) boxes.push(bx(x, y + d, z + h * 0.08, dx + 0.002, 0.004, h * 0.3, '#e8303a'));
		if (sp.pattern === 'spots' && spots.has(i)) boxes.push(bx(x + dx * 0.2, y + d, z + h * (0.35 + rnd() * 0.4), dx * 0.6, 0.004, h * 0.15, pc));
		if (i === N - 2) {
			headTop = z + h;
			headD = d;
		}
	}
	const zc = o.flat ? o.h / 2 : MID;
	const hMax = o.h;
	const fd = 0.05;
	const finY = 0.5 - fd / 2;
	/**
	 * A stepped voxel fin: `steps` boxes stacked away from the body (up when `up`), each narrower
	 * than the last and set further back, so it reads as a swept-back triangle.
	 */
	const fan = (x: number, z: number, w: number, h: number, up: boolean, steps: number, sweep: number, col: string, y = finY) => {
		for (let k = 0; k < steps; k++) {
			const ww = w * (1 - k / (steps + 0.5));
			const sh = h / steps;
			boxes.push(bx(x - k * sweep, y, up ? z + k * sh : z - (k + 1) * sh, ww, fd, sh + 0.002, k === steps - 1 ? hexShade(col, 1.12) : col));
		}
	};
	// The tail: a forked or fanned fin in steps, flicking with the swish.
	if (sp.shape !== 'ray' && sp.shape !== 'eel') {
		const big = sp.shape === 'guppy' || sp.shape === 'betta';
		const span = big ? hMax * 1.1 : sp.shape === 'shark' ? hMax * 1.1 : sp.shape === 'puffy' ? hMax * 0.75 : hMax * 0.62;
		const tw = big ? 0.22 : 0.12;
		const ty = 0.475 + swish * 0.04;
		boxes.push(bx(x0 - 0.05, ty, zc - hMax * 0.12, 0.06, fd, hMax * 0.24, fin));
		if (sp.shape === 'shark' || sp.shape === 'long') {
			fan(x0 - 0.06, zc, tw, span, true, 3, 0.04, fin, ty);
			fan(x0 - 0.06, zc, tw * 0.7, span * 0.55, false, 2, 0.03, fin, ty);
		} else {
			fan(x0 - 0.08, zc, tw, span, true, big ? 4 : 3, big ? 0.05 : 0.03, fin, ty);
			fan(x0 - 0.08, zc, tw, span, false, big ? 4 : 3, big ? 0.05 : 0.03, fin, ty);
		}
	}
	// Dorsal and anal fins, swept back.
	const back = zc + hMax / 2 - 0.02;
	const belly2 = zc - hMax / 2 + 0.02;
	if (sp.shape === 'tall') {
		// Tangs, marine angels, gouramis: long, continuous dorsal and anal fins along the body,
		// tallest toward the back.
		for (let i = 0; i < 6; i++) boxes.push(bx(0.3 + i * 0.09, finY, back, 0.092, fd, hMax * (0.4 - i * 0.045), i === 0 ? hexShade(fin, 1.1) : fin));
		for (let i = 0; i < 4; i++) boxes.push(bx(0.32 + i * 0.09, finY, belly2 - hMax * (0.36 - i * 0.06), 0.092, fd, hMax * (0.36 - i * 0.06), fin));
	} else if (sp.shape === 'betta') {
		fan(0.5, back, 0.26, hMax * 0.85, true, 4, 0.05, fin);
		fan(0.48, belly2, 0.24, hMax * 0.85, false, 4, 0.05, fin);
	} else if (sp.shape === 'disc' || sp.shape === 'lion') {
		fan(0.45, back, 0.3, hMax * 0.3, true, 2, 0.04, fin);
		fan(0.43, belly2, 0.28, hMax * 0.3, false, 2, 0.04, fin);
	} else if (sp.shape === 'shark') {
		fan(0.52, back, 0.14, hMax * 0.9, true, 3, 0.03, fin);
	} else if (sp.shape === 'long') {
		fan(0.24, back, 0.2, hMax * 0.45, true, 2, 0.03, fin);
		fan(0.26, belly2, 0.18, hMax * 0.35, false, 2, 0.03, fin);
	} else if (sp.shape !== 'eel' && sp.shape !== 'ray') {
		fan(0.45, back, 0.22, hMax * 0.32, true, 2, 0.04, fin);
	}
	// Lionfish spines.
	if (sp.shape === 'lion') for (let i = 0; i < 5; i++) boxes.push(bx(0.4 + i * 0.07, 0.49, zc + hMax / 2, 0.02, 0.02, hMax * (0.9 + (i % 2) * 0.3), i % 2 ? pc : '#f4f0e8'));
	// The side fin, on the side facing you.
	if (sp.shape !== 'eel' && sp.shape !== 'ray') boxes.push(bx(0.6, 0.5 + headD / 2 + 0.002, zc - hMax * 0.2 + swish * 0.01, 0.1, 0.01, hMax * 0.25, hexShade(fin, 1.1)));
	// Eyes: white with a dark pupil, near the nose (a ray's are on top).
	const ex = sp.shape === 'ray' ? 0.62 : x1 - (x1 - x0) * 0.16;
	const er = Math.max(0.035, Math.min(0.06, hMax * 0.2));
	if (sp.shape === 'ray') {
		boxes.push(bx(ex, 0.4, 0.06, er, er, 0.01, '#f4f4f4'), bx(ex, 0.56, 0.06, er, er, 0.01, '#f4f4f4'));
		boxes.push(bx(0.02, 0.48 + swish * 0.03, 0.02, 0.22, 0.04, 0.03, hexShade(body, 0.7)));
	} else {
		const ez = o.flat ? headTop - er * 1.6 : zc + hMax * 0.1;
		const ey = 0.5 + headD / 2 + 0.003;
		boxes.push(bx(ex - er / 2, ey, ez, er, 0.006, er, '#f8f8f8'));
		boxes.push(bx(ex - er / 4 + er * 0.15, ey + 0.004, ez + er * 0.2, er * 0.55, 0.006, er * 0.55, '#141418'));
	}
	return finish(boxes, dir, sp.shape === 'ray');
}

/**
 * Seen side-on through the glass: squash the fish's thickness so its side (and markings) fill
 * the view, with just a sliver of its back showing on top for depth. Rays are seen from above,
 * so they keep theirs. Then mirror for fish swimming left.
 */
function finish(boxes: Box[], dir: 1 | -1, flat: boolean): Model {
	const k = flat ? 0.45 : 0.35;
	const squashed = boxes.map((b) => ({ ...b, y: 0.5 + (b.y - 0.5) * k, d: b.d * k }));
	return model(dir > 0 ? squashed : squashed.map((b) => ({ ...b, x: 1 - b.x - b.w })));
}

const tone = (v: number, f: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));

const pictures = new Map<string, HTMLImageElement>();
/** A fish drawn from a picture (Fishy), loaded the first time it's needed. */
function drawPicture(c: Ctx, img: [string, string], x: number, y: number, len: number, dir: 1 | -1, t: number, alpha: number) {
	const src = dir > 0 ? img[0] : img[1];
	let im = pictures.get(src);
	if (!im) {
		im = new Image();
		im.src = src;
		pictures.set(src, im);
	}
	if (!im.complete || !im.naturalWidth) return;
	const h = (len * im.naturalHeight) / im.naturalWidth;
	c.save();
	c.globalAlpha = alpha;
	c.drawImage(im, x - len / 2, y - h / 2 + Math.sin(t * 3) * 2, len, h);
	c.restore();
}

/** The smooth painted fish the blocks are made from. */
function drawVector(c: Ctx, sp: Species, x: number, y: number, len: number, dir: 1 | -1, t: number, key = sp.id, alpha = 1) {
	const [body, belly, fin] = sp.colors;
	const L = len;
	const H = L * BODY_H[sp.shape];
	const sw = Math.sin(t * 6) * 0.25;
	c.save();
	c.globalAlpha = alpha;
	c.translate(x, y);
	c.scale(dir, 1);
	c.lineJoin = 'round';

	if (sp.shape === 'ray') {
		drawRay(c, sp, L, H, t);
		c.restore();
		return;
	}
	if (sp.shape === 'eel') {
		drawEel(c, sp, L, t, key);
		c.restore();
		return;
	}

	const bodyX = sp.shape === 'guppy' ? 0.1 * L : 0;
	const bw = sp.shape === 'guppy' ? L * 0.62 : sp.shape === 'betta' ? L * 0.66 : L * 0.78;
	const tailX = bodyX - bw / 2;
	// Fins behind the body.
	c.fillStyle = fin;
	c.strokeStyle = shade(fin, 0.6);
	c.lineWidth = Math.max(1, L / 60);
	if (sp.shape === 'tall' || sp.shape === 'disc' || sp.shape === 'lion') {
		c.beginPath();
		c.moveTo(-bw * 0.25, -H * 0.4);
		c.quadraticCurveTo(-bw * 0.1, -H * (sp.shape === 'tall' ? 1.25 : 0.85), bw * 0.15, -H * 0.42);
		c.closePath();
		c.fill();
		c.beginPath();
		c.moveTo(-bw * 0.25, H * 0.4);
		c.quadraticCurveTo(-bw * 0.1, H * (sp.shape === 'tall' ? 1.25 : 0.85), bw * 0.15, H * 0.42);
		c.closePath();
		c.fill();
	}
	if (sp.shape === 'betta') {
		c.beginPath();
		c.moveTo(-bw * 0.3, -H * 0.3);
		c.bezierCurveTo(-bw * 0.6, -H * 1.6, -bw * 1.2, -H * 0.6 + sw * H, -bw * 0.95, 0);
		c.bezierCurveTo(-bw * 1.2, H * 0.8 - sw * H, -bw * 0.6, H * 1.7, bw * 0.1, H * 0.35);
		c.closePath();
		c.fill();
	}
	if (sp.shape === 'shark' || sp.shape === 'long') {
		// Dorsal fin (sharks: tall triangle; arowanas: long and low toward the tail).
		c.beginPath();
		if (sp.shape === 'shark') {
			c.moveTo(-bw * 0.05, -H * 0.4);
			c.lineTo(-bw * 0.18, -H * 1.5);
			c.lineTo(-bw * 0.28, -H * 0.4);
		} else {
			c.moveTo(-bw * 0.2, -H * 0.4);
			c.lineTo(-bw * 0.42, -H * 0.9);
			c.lineTo(-bw * 0.48, -H * 0.3);
		}
		c.closePath();
		c.fill();
	}
	// Tail.
	c.beginPath();
	const tw = sp.shape === 'guppy' ? L * 0.5 : sp.shape === 'puffy' ? L * 0.42 : sp.shape === 'shark' ? L * 0.3 : L * 0.28;
	const th = sp.shape === 'guppy' ? H * 2.4 : sp.shape === 'puffy' ? H * 1.2 : sp.shape === 'shark' ? H * 2.2 : H * 1.1;
	c.moveTo(tailX + 2, 0);
	if (sp.shape === 'shark') {
		c.lineTo(tailX - tw, -th * 0.65 + sw * th * 0.2);
		c.lineTo(tailX - tw * 0.45, 0);
		c.lineTo(tailX - tw * 0.7, th * 0.35 + sw * th * 0.2);
	} else if (sp.shape === 'puffy') {
		c.bezierCurveTo(tailX - tw * 0.5, -th, tailX - tw * 1.2, -th * 0.4 + sw * th, tailX - tw, sw * th * 0.5);
		c.bezierCurveTo(tailX - tw * 1.2, th * 0.4 + sw * th, tailX - tw * 0.5, th, tailX + 2, 0);
	} else {
		c.quadraticCurveTo(tailX - tw * 0.6, -th * 0.2, tailX - tw, -th / 2 + sw * th * 0.3);
		c.quadraticCurveTo(tailX - tw * 0.7, sw * th * 0.3, tailX - tw, th / 2 + sw * th * 0.3);
		c.quadraticCurveTo(tailX - tw * 0.6, th * 0.2, tailX + 2, 0);
	}
	c.closePath();
	c.fill();
	c.stroke();

	// Body.
	const path = new Path2D();
	if (sp.shape === 'shark' || sp.shape === 'long') {
		path.moveTo(bodyX + bw / 2 + L * 0.06, sp.shape === 'shark' ? H * 0.05 : -H * 0.1);
		path.bezierCurveTo(bodyX + bw * 0.3, -H * 0.75, bodyX - bw * 0.3, -H * 0.55, tailX, 0);
		path.bezierCurveTo(bodyX - bw * 0.3, H * 0.55, bodyX + bw * 0.3, H * 0.65, bodyX + bw / 2 + L * 0.06, sp.shape === 'shark' ? H * 0.05 : -H * 0.1);
	} else if (sp.shape === 'bottom') {
		path.moveTo(bodyX + bw / 2, H * 0.1);
		path.bezierCurveTo(bodyX + bw * 0.4, -H * 0.7, bodyX - bw * 0.3, -H * 0.6, tailX, 0);
		path.lineTo(tailX, H * 0.25);
		path.lineTo(bodyX + bw * 0.4, H * 0.45);
		path.closePath();
	} else {
		path.ellipse(bodyX, 0, bw / 2, H / 2, 0, 0, Math.PI * 2);
	}
	const grad = c.createLinearGradient(0, -H / 2, 0, H / 2);
	grad.addColorStop(0, shade(body, 0.85));
	grad.addColorStop(0.45, body);
	grad.addColorStop(1, belly);
	c.fillStyle = grad;
	c.fill(path);
	// Markings, clipped to the body.
	c.save();
	c.clip(path);
	paintPattern(c, sp, bodyX, bw, H, key);
	c.restore();
	c.strokeStyle = shade(body, 0.55);
	c.lineWidth = Math.max(1, L / 50);
	c.stroke(path);

	// Lionfish spines.
	if (sp.shape === 'lion') {
		c.strokeStyle = sp.pcolor ?? fin;
		c.lineWidth = Math.max(1, L / 70);
		for (let i = 0; i < 7; i++) {
			const a = -Math.PI * 0.85 + i * 0.22;
			const px = bodyX + bw * 0.1 - i * bw * 0.06;
			c.beginPath();
			c.moveTo(px, -H * 0.3);
			c.lineTo(px + Math.cos(a) * H, -H * 0.3 + Math.sin(a) * H * 1.1);
			c.stroke();
		}
		for (let i = 0; i < 4; i++) {
			c.beginPath();
			c.moveTo(bodyX + bw * 0.1, H * 0.1);
			c.lineTo(bodyX - bw * 0.1 - i * bw * 0.12, H * (0.9 + i * 0.15));
			c.stroke();
		}
	}
	// Pectoral fin.
	c.fillStyle = shade(fin, 1.05);
	c.globalAlpha = alpha * 0.85;
	c.beginPath();
	c.ellipse(bodyX + bw * 0.12, H * 0.15, bw * 0.12, H * 0.12, 0.6 + sw, 0, Math.PI * 2);
	c.fill();
	c.globalAlpha = alpha;
	// Eye.
	const ex = bodyX + bw * 0.3;
	const ey = sp.shape === 'bottom' ? -H * 0.15 : -H * 0.08;
	const er = Math.max(1.4, Math.min(H * 0.16, L * 0.06));
	c.fillStyle = '#ffffff';
	c.beginPath();
	c.arc(ex, ey, er, 0, Math.PI * 2);
	c.fill();
	c.fillStyle = '#111';
	c.beginPath();
	c.arc(ex + er * 0.25, ey, er * 0.6, 0, Math.PI * 2);
	c.fill();
	if (sp.shape === 'bottom' && sp.id === 'corydoras') {
		c.strokeStyle = shade(body, 0.6);
		c.beginPath();
		c.moveTo(bodyX + bw / 2 - 1, H * 0.15);
		c.lineTo(bodyX + bw / 2 + L * 0.06, H * 0.3);
		c.stroke();
	}
	c.restore();
}

function paintPattern(c: Ctx, sp: Species, bx: number, bw: number, H: number, key: string) {
	const pc = sp.pcolor ?? '#000';
	const rnd = seeded(key);
	const left = bx - bw / 2;
	c.fillStyle = pc;
	switch (sp.pattern) {
		case 'neon':
			c.fillRect(left + bw * 0.15, -H * 0.12, bw * 0.75, H * 0.14);
			c.fillStyle = '#e8303a';
			c.fillRect(left, H * 0.04, bw * 0.55, H * 0.3);
			break;
		case 'hstripes':
			for (let i = -2; i <= 2; i++) c.fillRect(left, i * H * 0.2 - H * 0.04, bw, H * 0.08);
			break;
		case 'vbands':
			for (let i = 0; i < 3; i++) c.fillRect(left + bw * (0.22 + i * 0.25), -H, bw * 0.09, H * 2);
			break;
		case 'zebra':
			for (let i = 0; i < 6; i++) {
				c.beginPath();
				const x0 = left + bw * (0.08 + i * 0.16);
				c.moveTo(x0, -H);
				c.quadraticCurveTo(x0 + bw * 0.08, 0, x0, H);
				c.lineTo(x0 + bw * 0.05, H);
				c.quadraticCurveTo(x0 + bw * 0.13, 0, x0 + bw * 0.05, -H);
				c.fill();
			}
			break;
		case 'spots':
			for (let i = 0; i < 14; i++) {
				c.beginPath();
				c.arc(left + rnd() * bw, (rnd() - 0.5) * H, Math.max(0.8, H * 0.07), 0, Math.PI * 2);
				c.fill();
			}
			break;
		case 'calico':
			for (let i = 0; i < 5; i++) {
				c.globalAlpha = 0.85;
				c.fillStyle = i % 3 === 2 ? '#1a1a1a' : pc;
				c.beginPath();
				c.ellipse(left + rnd() * bw, (rnd() - 0.5) * H, bw * (0.08 + rnd() * 0.1), H * (0.15 + rnd() * 0.15), rnd() * 3, 0, Math.PI * 2);
				c.fill();
			}
			c.globalAlpha = 1;
			break;
		case 'marble':
			c.globalAlpha = 0.6;
			for (let i = 0; i < 6; i++) {
				c.beginPath();
				c.ellipse(left + rnd() * bw, (rnd() - 0.5) * H, bw * 0.12, H * 0.1, rnd() * 3, 0, Math.PI * 2);
				c.fill();
			}
			c.globalAlpha = 1;
			break;
		case 'split':
			c.fillRect(left, -H, bw * 0.45, H * 2);
			break;
	}
}

function drawRay(c: Ctx, sp: Species, L: number, H: number, t: number) {
	const [body, belly] = sp.colors;
	const wave = Math.sin(t * 4) * H * 0.06;
	c.strokeStyle = shade(body, 0.5);
	c.lineWidth = Math.max(1, L / 60);
	c.beginPath();
	c.moveTo(-L * 0.25, 0);
	c.lineTo(-L * 0.7, wave);
	c.stroke();
	const path = new Path2D();
	path.ellipse(0, 0, L * 0.32, H * 0.45 + wave, 0, 0, Math.PI * 2);
	const g = c.createRadialGradient(0, -H * 0.1, 1, 0, 0, L * 0.35);
	g.addColorStop(0, shade(body, 1.15));
	g.addColorStop(1, body);
	c.fillStyle = g;
	c.fill(path);
	c.save();
	c.clip(path);
	paintPattern(c, sp, 0, L * 0.64, H, sp.id);
	c.restore();
	c.stroke(path);
	c.fillStyle = belly;
	for (const s of [-1, 1]) {
		c.beginPath();
		c.arc(L * 0.12, s * H * 0.08, Math.max(1.2, L * 0.025), 0, Math.PI * 2);
		c.fill();
	}
}

function drawEel(c: Ctx, sp: Species, L: number, t: number, key: string) {
	const [body] = sp.colors;
	const n = 14;
	const pts: [number, number][] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		pts.push([L / 2 - u * L, Math.sin(t * 4 - u * 5) * L * 0.06 * u]);
	}
	c.lineCap = 'round';
	for (let i = 0; i < n; i++) {
		const w = L * 0.11 * (1 - (i / n) * 0.6);
		c.strokeStyle = shade(body, 0.55);
		c.lineWidth = w + 2;
		c.beginPath();
		c.moveTo(...pts[i]);
		c.lineTo(...pts[i + 1]);
		c.stroke();
	}
	for (let i = 0; i < n; i++) {
		const w = L * 0.11 * (1 - (i / n) * 0.6);
		c.strokeStyle = body;
		c.lineWidth = w;
		c.beginPath();
		c.moveTo(...pts[i]);
		c.lineTo(...pts[i + 1]);
		c.stroke();
	}
	const rnd = seeded(key);
	c.fillStyle = sp.pcolor ?? '#222';
	for (let i = 1; i < n; i += 1) {
		const [x, y] = pts[i];
		c.beginPath();
		c.arc(x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * L * 0.06, Math.max(1, L * 0.018), 0, Math.PI * 2);
		c.fill();
	}
	c.fillStyle = '#ffd84a';
	c.beginPath();
	c.arc(L * 0.44, -L * 0.02, Math.max(1.4, L * 0.02), 0, Math.PI * 2);
	c.fill();
}

export function shade(hex: string, f: number) {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
	return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Pixel length to draw a fish at, by size class, for a tank `scale`. */
export const FISH_LEN = { S: 18, M: 28, L: 42, XL: 62, XXL: 90 } as const;
