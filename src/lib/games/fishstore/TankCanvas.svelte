<!--
  A live aquarium, drawn in 3D: you look in through the front glass at the back wall, the side
  panes and the substrate floor receding into the tank, with rocks, wood, plants and coral built
  from chunky voxel blocks (in Frogger's style) standing at different depths. Fish (to scale: the
  tank is `widthCm` wide) swim forward and back as well as about, smaller and hazier further
  away, casting shadows on the sand. The glass shape (classic, bow-front, hexagon, cylinder or
  rimless), trim, stand and lights follow the tank's look. Dirty water turns murky with algae on
  the glass; live plants grow taller over time and get overgrown until trimmed. Decorations keep
  their true shape whatever the tank's width: a wide tank gets more of the natural scenery (rocks,
  plants, coral) laid side by side, rather than the same pieces stretched. The centrepiece
  swims briskly with hearts when happy, and mopes near the bottom when it isn't.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { DEFAULT_LOOK, TANK_LIGHTS, TANK_STANDS, TANK_TRIMS, species, type DecorTag, type TankLook, type Water } from './data';
	import { drawFish } from './fishArt';
	import { shade } from '../voxel';
	import { visibleLoop } from '../visible-loop';
	import type { Fish } from './store.svelte';

	let {
		fish,
		decor = [],
		water,
		clean,
		widthCm,
		center = null,
		happy = 50,
		height = 220,
		look = DEFAULT_LOOK,
		growth = 30,
		stand = false,
		tallCm = 0
	}: {
		fish: Fish[];
		decor?: DecorTag[];
		water: Water;
		clean: number;
		widthCm: number;
		center?: number | null;
		happy?: number;
		/** Pixels, or 0 to fill the parent's height. */
		height?: number;
		look?: TankLook;
		growth?: number;
		/** Draw the cabinet stand under the tank. */
		stand?: boolean;
		/** How tall the glass is in cm, for a short, wide view: fish are never drawn bigger than that allows. */
		tallCm?: number;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	let wrap = $state<HTMLDivElement>();

	/** A fish's place in the tank: u across (0 left → 1 right), v down (0 surface → 1 floor), z depth (0 back → 1 front). */
	interface Swimmer {
		u: number;
		v: number;
		z: number;
		tu: number;
		tv: number;
		tz: number;
		dir: 1 | -1;
		phase: number;
	}
	const swimmers = new Map<number, Swimmer>();
	/** The still back of the tank, drawn once (see draw), and what it was drawn for. */
	let back: { key: string; canvas: HTMLCanvasElement } | null = null;

	// Animates only while it's on screen, at up to 60 frames a second.
	onMount(() => visibleLoop(wrap!, (now, dt) => draw(now / 1000, Math.min(0.05, dt)), 60));

	// ── The tank's geometry ─────────────────────────────────────────────────────────────
	// Front glass rectangle (F) and the back wall (B), smaller and a little lower: you look
	// slightly down into the tank, so the floor shows. P() maps a point in the tank to the screen.
	let fx0 = 0,
		fx1 = 0,
		fy0 = 0,
		fy1 = 0,
		bx0 = 0,
		bx1 = 0,
		by0 = 0,
		by1 = 0;
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	function Pg(u: number, v: number, z: number): [number, number] {
		return [lerp(bx0 + u * (bx1 - bx0), fx0 + u * (fx1 - fx0), z), lerp(by0 + v * (by1 - by0), fy0 + v * (fy1 - fy0), z)];
	}
	// Scenery is laid out in tiles about as wide as the tank is tall (REF), so it keeps its shape:
	// inside one, u runs 0 → 1 across the tile (tu0 + u * tsc in the tank; tsc < 0 mirrors it).
	const REF = 1.6;
	let tu0 = 0,
		tsc = 1,
		seedOff = 0;
	const P = (u: number, v: number, z: number) => Pg(tu0 + u * tsc, v, z);
	/** A tile's width in pixels (for glows sized to the scenery). */
	const tilePx = () => Math.abs(tsc) * (fx1 - fx0);
	/** Run `f` inside a tile. */
	function inTile(u0: number, sc: number, seed: number, f: () => void) {
		const prev = [tu0, tsc, seedOff];
		[tu0, tsc, seedOff] = [u0, sc, seed];
		f();
		[tu0, tsc, seedOff] = prev;
	}
	/** How much smaller things look at depth z. */
	const depthScale = (z: number) => lerp((bx1 - bx0) / (fx1 - fx0), 1, z);
	/** The substrate's surface (v). */
	const FLOOR = 0.88;

	function quad(c: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient) {
		c.fillStyle = fill;
		c.beginPath();
		c.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
		c.closePath();
		c.fill();
	}
	// Pg's two halves, for the hot path (cube faces) without building arrays: the same sums.
	const gx = (u: number, z: number) => lerp(bx0 + u * (bx1 - bx0), fx0 + u * (fx1 - fx0), z);
	const gy = (v: number, z: number) => lerp(by0 + v * (by1 - by0), fy0 + v * (fy1 - fy0), z);
	/** A four-cornered face of a cube: corners (u, v, z) in the tank's own u. */
	function face(c: CanvasRenderingContext2D, fill: string, ua: number, va: number, za: number, ub: number, vb: number, zb: number, uc: number, vc: number, zc: number, ud: number, vd: number, zd: number) {
		c.fillStyle = fill;
		c.beginPath();
		c.moveTo(gx(ua, za), gy(va, za));
		c.lineTo(gx(ub, zb), gy(vb, zb));
		c.lineTo(gx(uc, zc), gy(vc, zc));
		c.lineTo(gx(ud, zd), gy(vd, zd));
		c.closePath();
		c.fill();
	}

	/**
	 * A voxel block standing in the tank: u0–u1 across, z0–z1 deep, from v1 (bottom) up to v0
	 * (top). Draws the side facing the middle (perspective), the top, then the front.
	 */
	function cube(c: CanvasRenderingContext2D, ua: number, ub: number, z0: number, z1: number, v0: number, v1: number, col: string) {
		// Into the tank's own u (a mirrored tile swaps the sides).
		let u0 = tu0 + ua * tsc,
			u1 = tu0 + ub * tsc;
		if (u0 > u1) [u0, u1] = [u1, u0];
		const um = (u0 + u1) / 2;
		const us = um < 0.5 ? u1 : u0;
		face(c, shade(col, 0.72), us, v0, z1, us, v0, z0, us, v1, z0, us, v1, z1);
		face(c, shade(col, 1.18), u0, v0, z0, u1, v0, z0, u1, v0, z1, u0, v0, z1);
		face(c, col, u0, v0, z1, u1, v0, z1, u1, v1, z1, u0, v1, z1);
	}

	/** The front outline of the glass, for clipping and the frame. */
	function outline(c: CanvasRenderingContext2D, shape: TankLook['shape']) {
		const W = fx1 - fx0;
		const bulge = (fy1 - fy0) * 0.05;
		c.beginPath();
		if (shape === 'bowfront') {
			c.moveTo(fx0, fy0);
			c.quadraticCurveTo(fx0 + W / 2, fy0 + bulge * 2, fx1, fy0);
			c.lineTo(fx1, fy1);
			c.quadraticCurveTo(fx0 + W / 2, fy1 + bulge * 2, fx0, fy1);
		} else if (shape === 'cylinder') {
			c.ellipse(fx0 + W / 2, fy0, W / 2, bulge * 1.6, 0, Math.PI, 0, true);
			c.lineTo(fx1, fy1);
			c.ellipse(fx0 + W / 2, fy1, W / 2, bulge * 1.6, 0, 0, Math.PI);
		} else if (shape === 'hex') {
			c.moveTo(fx0, fy0);
			c.lineTo(fx0 + W * 0.22, fy0 + bulge);
			c.lineTo(fx1 - W * 0.22, fy0 + bulge);
			c.lineTo(fx1, fy0);
			c.lineTo(fx1, fy1);
			c.lineTo(fx1 - W * 0.22, fy1 + bulge);
			c.lineTo(fx0 + W * 0.22, fy1 + bulge);
			c.lineTo(fx0, fy1);
		} else c.rect(fx0, fy0, W, fy1 - fy0);
		c.closePath();
	}

	// Seeded randomness, so the scenery stays put from frame to frame.
	function rng(seed: number) {
		let h = (seed + seedOff) * 2654435761;
		return () => {
			h = Math.imul(h ^ (h >>> 15), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			return ((h ^= h >>> 16) >>> 0) / 4294967296;
		};
	}

	function draw(t: number, dt: number) {
		if (!canvas || !wrap) return;
		const W = wrap.clientWidth;
		const H = height || wrap.clientHeight || 220;
		if (W < 10 || H < 10) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
		}
		const c = canvas.getContext('2d')!;
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.imageSmoothingEnabled = false;
		c.clearRect(0, 0, W, H);
		const L = { ...DEFAULT_LOOK, ...look };
		const trim = TANK_TRIMS.find((x) => x.id === L.trim)?.color ?? '#1e2630';
		const standCol = TANK_STANDS.find((x) => x.id === L.stand)?.color ?? '#4a2e1c';
		const tint = TANK_LIGHTS.find((x) => x.id === L.light)?.tint ?? 'rgba(0,0,0,0)';
		const rimless = L.shape === 'panorama';

		// Layout: hood/rim on top, the glass, the base rail and (optionally) the stand.
		const standH = stand ? Math.round(H * 0.17) : 0;
		const rimH = rimless ? 4 : Math.max(8, Math.round(H * 0.045));
		const baseH = rimless ? 4 : Math.max(6, Math.round(H * 0.035));
		const side = rimless ? 3 : Math.max(4, Math.round(W * 0.008));
		fx0 = side;
		fx1 = W - side;
		fy0 = rimH;
		fy1 = H - baseH - standH;
		const iw = fx1 - fx0;
		const ih = fy1 - fy0;
		const inset = L.shape === 'cylinder' ? 0.13 : L.shape === 'hex' ? 0.12 : 0.085;
		bx0 = fx0 + iw * inset;
		bx1 = fx1 - iw * inset;
		by0 = fy0 + ih * 0.03;
		by1 = fy1 - ih * 0.2;
		const dirty = 1 - clean / 100;
		/** About how many tank-tall tiles fit across (more floor detail for wide tanks). */
		const reps = Math.max(1, Math.round(iw / (REF * ih)));
		const salt = water === 'salt';
		const top = salt ? '#5ec8f0' : '#6ed0c0';
		const deep = salt ? '#1a4a98' : '#185a66';

		function still(c: CanvasRenderingContext2D) {
			c.save();
			outline(c, L.shape);
			c.clip();
			// Side walls, back wall and the underside of the surface.
			c.fillStyle = mix(top, deep, 0.45);
			c.fillRect(0, 0, W, H);
			const bw = c.createLinearGradient(0, by0, 0, by1);
			bw.addColorStop(0, mix(top, deep, 0.25));
			bw.addColorStop(1, deep);
			quad(c, [P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], bw);
			const sideG = (x0: number, x1: number) => {
				const g = c.createLinearGradient(x0, 0, x1, 0);
				g.addColorStop(0, mix(top, deep, 0.35));
				g.addColorStop(1, mix(top, deep, 0.6));
				return g;
			};
			quad(c, [P(0, 0, 1), P(0, 0, 0), P(0, 1, 0), P(0, 1, 1)], sideG(fx0, bx0));
			quad(c, [P(1, 0, 1), P(1, 0, 0), P(1, 1, 0), P(1, 1, 1)], sideG(fx1, bx1));
			const surf = c.createLinearGradient(0, fy0, 0, by0);
			surf.addColorStop(0, 'rgba(255,255,255,0.45)');
			surf.addColorStop(1, 'rgba(255,255,255,0.12)');
			quad(c, [P(0, 0, 1), P(1, 0, 1), P(1, 0, 0), P(0, 0, 0)], surf);
			// The backdrop picture on the back wall.
			if (decor.includes('backdrop')) {
				const r = rng(7);
				for (let i = 0; i < 9; i++) {
					const u0 = i / 9;
					const hgt = 0.25 + r() * 0.35;
					quad(c, [P(u0, 1 - hgt, 0), P(u0 + 0.12, 1 - hgt - 0.05, 0), P(u0 + 0.12, 1, 0), P(u0, 1, 0)], salt ? '#2a4a8a' : '#2a5a5a');
				}
			}

			// The floor: substrate surface receding to the back wall, and its cut face behind the front glass.
			const sub = decor.includes('sand') ? '#e8d8a8' : decor.includes('gravel') ? '#8a8478' : salt ? '#e0d0a0' : '#b8a888';
			const fg = c.createLinearGradient(0, by1, 0, fy1);
			fg.addColorStop(0, shade(sub, 0.7));
			fg.addColorStop(1, sub);
			quad(c, [P(0, FLOOR, 0), P(1, FLOOR, 0), P(1, FLOOR, 1), P(0, FLOOR, 1)], fg);
			quad(c, [P(0, 1, 0), P(1, 1, 0), P(1, FLOOR, 0), P(0, FLOOR, 0)], shade(sub, 0.6));
			{
				const r = rng(3);
				for (let i = 0; i < 90 * reps; i++) {
					const u = r();
					const z = r();
					const [x, y] = P(u, FLOOR, z);
					const s = depthScale(z) * (2 + r() * 3);
					c.fillStyle = shade(sub, 0.75 + r() * 0.45);
					c.fillRect(x, y - s * 0.5, s * 1.4, s * 0.7);
				}
			}
			// The substrate's cut face behind the front glass: layers of sand and pebbles.
			{
				const [, ya] = P(0, FLOOR, 1);
				const sg = c.createLinearGradient(0, ya, 0, fy1);
				sg.addColorStop(0, shade(sub, 0.95));
				sg.addColorStop(1, shade(sub, 0.55));
				quad(c, [P(0, FLOOR, 1), P(1, FLOOR, 1), P(1, 1.02, 1), P(0, 1.02, 1)], sg);
				const r = rng(9);
				for (let i = 0; i < 70 * reps; i++) {
					const x = fx0 + r() * (fx1 - fx0);
					const y = ya + 3 + r() * (fy1 - ya - 4);
					const sz = 2 + r() * 4;
					c.fillStyle = shade(sub, 0.6 + r() * 0.5);
					c.fillRect(x, y, sz * 1.3, sz * 0.8);
				}
			}
			c.restore();
		}
		// The still part of the water (walls, surface, backdrop, floor and its pebbles) is drawn once
		// into a copy, reused every frame until the tank's size or look changes; what moves goes on top.
		const backKey = [W, H, dpr, L.shape, stand, water, decor.includes('backdrop'), decor.includes('sand'), decor.includes('gravel')].join('|');
		if (!back || back.key !== backKey) {
			const cv = back?.canvas ?? document.createElement('canvas');
			cv.width = canvas.width;
			cv.height = canvas.height;
			const b = cv.getContext('2d')!;
			b.setTransform(dpr, 0, 0, dpr, 0, 0);
			b.imageSmoothingEnabled = false;
			still(b);
			back = { key: backKey, canvas: cv };
		}
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.drawImage(back.canvas, 0, 0);
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.save();
		outline(c, L.shape);
		c.clip();
		// Ripples on the surface.
		c.fillStyle = 'rgba(255,255,255,0.35)';
		for (let i = 0; i < 14 * reps; i++) {
			const u = (i * 0.137 / reps + t * 0.03 * (i % 2 ? 1 : -1) + 10) % 1;
			const z = (i * 0.29) % 1;
			const [x, y] = P(u, 0, z);
			c.fillRect(x, y + 1, 10 * depthScale(z), 1.5);
		}
		// Light dancing on the floor (caustics).
		c.fillStyle = 'rgba(255,255,255,0.13)';
		for (let i = 0; i < 18 * reps; i++) {
			const u = (i * 0.173 / reps + Math.sin(t * 0.5 + i) * 0.03 + 1) % 1;
			const z = (i * 0.311 + Math.cos(t * 0.4 + i * 2) * 0.03 + 1) % 1;
			const [x, y] = P(u, FLOOR, z);
			const s = depthScale(z) * (8 + 4 * Math.sin(t * 1.3 + i));
			c.fillRect(x, y - s * 0.15, s, s * 0.3);
		}
		// Shafts of light from above.
		const rays = decor.includes('light') ? 5 : 3;
		c.fillStyle = decor.includes('light') ? 'rgba(255,255,230,0.11)' : 'rgba(255,255,255,0.05)';
		for (let i = 0; i < rays; i++) {
			const u = (i + 0.5) / rays + Math.sin(t * 0.3 + i) * 0.04;
			const [ax, ay] = P(u, 0, 0.6);
			const [bxx, byy] = P(u + 0.18, FLOOR, 0.3);
			c.beginPath();
			c.moveTo(ax, ay);
			c.lineTo(ax + 22, ay);
			c.lineTo(bxx + 40, byy);
			c.lineTo(bxx, byy);
			c.fill();
		}

		// Everything in the water, back to front.
		const items: { z: number; f: () => void }[] = [];
		scenery(c, t, items);
		swim(c, t, dt, items, W);
		items.sort((a, b) => a.z - b.z);
		for (const it of items) it.f();

		// Bubbles rising (an air stone if there is one).
		const stone = decor.includes('bubbles');
		c.fillStyle = 'rgba(255,255,255,0.65)';
		for (let i = 0; i < (stone ? 26 : 10); i++) {
			const z = stone ? 0.35 : (i * 0.37) % 1;
			const v = 1 - ((t * 0.25 + i * 0.137) % 1);
			const u = stone ? stoneU + Math.sin(t * 3 + i) * 0.012 : (i * 0.193 + 0.05) % 1;
			const [x, y] = P(u, v * FLOOR, z);
			const s = (2 + (i % 3)) * depthScale(z);
			c.fillRect(Math.round(x), Math.round(y), s, s);
		}
		// The light's colour, then dirt: murky water and algae on the glass.
		c.fillStyle = tint;
		c.fillRect(0, 0, W, H);
		if (dirty > 0.2) {
			c.fillStyle = `rgba(90,110,40,${(dirty - 0.2) * 0.45})`;
			c.fillRect(0, 0, W, H);
			c.fillStyle = `rgba(60,110,30,${(dirty - 0.2) * 0.85})`;
			for (let i = 0; i < dirty * 50; i++) {
				const ax = fx0 + ((i * 53) % iw);
				c.fillRect(ax, fy1 - 10 - ((i * 29) % Math.max(1, ih * dirty * 0.8)), 4 + (i % 4), 4 + (i % 3));
			}
		}
		glass(c, L.shape, W);
		c.restore();
		frame(c, L.shape, trim, rimless, W, H, rimH, baseH, standH, tint);
		if (stand) drawStand(c, standCol, W, H, standH);
	}

	type Items = { push: (it: { z: number; f: () => void }) => void };
	/** Where the air stone sits (u across the whole tank). */
	let stoneU = 0.9;

	/**
	 * Lay the scenery out in tiles about as wide as the tank is tall, edge to edge (overlapping a
	 * little when they don't divide evenly). The natural pieces fill every tile, every other one
	 * mirrored and seeded afresh so it doesn't look copied; the one-off pieces (the treasure
	 * chest, air stone, limited editions) sit once, in the middle tile.
	 */
	function scenery(c: CanvasRenderingContext2D, t: number, items: Items) {
		const iw = fx1 - fx0;
		const ih = fy1 - fy0;
		const tw = Math.min(1, (REF * ih) / iw);
		const n = Math.max(1, Math.ceil(1 / tw - 0.15));
		const step = n > 1 ? (1 - tw) / (n - 1) : 0;
		const start = n > 1 ? 0 : (1 - tw) / 2;
		const mid = Math.floor((n - 1) / 2);
		for (let i = 0; i < n; i++) {
			const flip = (i - mid) % 2 !== 0;
			const u0 = start + i * step;
			const at: [number, number, number] = [flip ? u0 + tw : u0, flip ? -tw : tw, (i - mid) * 7919];
			const tiled: Items = { push: (it) => items.push({ z: it.z, f: () => inTile(...at, it.f) }) };
			inTile(...at, () => tile(c, t, tiled, i === mid));
		}
	}

	/** One tile's scenery: rocks, caves, wood, plants, coral and the rest (`once`: the one-off pieces too). */
	function tile(c: CanvasRenderingContext2D, t: number, items: Items, once: boolean) {
		const has = (d: DecorTag) => decor.includes(d);
		const rock = (u: number, z: number, size: number, col: string) => {
			items.push({
				z,
				f: () => {
					const w = 0.09 * size;
					cube(c, u - w, u + w, z - 0.12 * size, z, FLOOR - 0.12 * size, FLOOR, col);
					cube(c, u - w * 0.7, u + w * 0.5, z - 0.1 * size, z - 0.02, FLOOR - 0.22 * size, FLOOR - 0.12 * size, shade(col, 1.06));
					cube(c, u - w * 0.35, u + w * 0.2, z - 0.07 * size, z - 0.04, FLOOR - 0.29 * size, FLOOR - 0.22 * size, shade(col, 1.12));
				}
			});
		};
		if (has('rock')) {
			rock(0.14, 0.32, 1.2, '#a89480');
			rock(0.83, 0.6, 0.8, '#b8a088');
		}
		if (has('cave')) {
			items.push({
				z: 0.5,
				f: () => {
					const col = '#767680';
					cube(c, 0.27, 0.3, 0.4, 0.48, FLOOR - 0.13, FLOOR, col);
					cube(c, 0.37, 0.4, 0.4, 0.48, FLOOR - 0.13, FLOOR, col);
					cube(c, 0.26, 0.41, 0.39, 0.48, FLOOR - 0.19, FLOOR - 0.13, shade(col, 1.08));
					cube(c, 0.29, 0.37, 0.41, 0.46, FLOOR - 0.23, FLOOR - 0.19, shade(col, 1.14));
					const [a, b] = P(0.3, FLOOR - 0.13, 0.48);
					const [cx, d] = P(0.37, FLOOR, 0.48);
					c.fillStyle = '#12161e';
					c.fillRect(a, b, cx - a, d - b);
				}
			});
		}
		if (has('wood')) {
			items.push({
				z: 0.42,
				f: () => {
					for (let i = 0; i < 7; i++) cube(c, 0.55 + i * 0.03, 0.59 + i * 0.03, 0.34, 0.42, FLOOR - 0.06 - i * 0.07, FLOOR - i * 0.07, i % 2 ? '#6a4a2a' : '#7a5632');
					for (let i = 0; i < 4; i++) cube(c, 0.62 - i * 0.03, 0.66 - i * 0.03, 0.36, 0.41, FLOOR - 0.3 - i * 0.06, FLOOR - 0.24 - i * 0.06, '#5a3e22');
				}
			});
		}
		if (has('plants')) {
			// Taller as they grow in; past overgrown they reach the surface and spread along it.
			const g = Math.max(0, Math.min(100, growth));
			const tall = 0.25 + (g / 100) * 0.75;
			const r = rng(11);
			const clumps = 9 + Math.round(g / 12);
			for (let i = 0; i < clumps; i++) {
				const u = 0.04 + r() * 0.92;
				const z = 0.05 + r() * 0.8;
				const h = (0.35 + r() * 0.45) * tall;
				const col = ['#2f9a3a', '#4ab84a', '#6acd4a', '#3aa060'][i % 4];
				const leaf = r() < 0.5;
				items.push({
					z,
					f: () => {
						const n = Math.max(3, Math.round(h / 0.05));
						for (let k = 0; k < n; k++) {
							const sway = Math.sin(t * 1.1 + i + k * 0.35) * 0.006 * k;
							const w = leaf && k % 3 === 1 ? 0.028 : 0.012;
							cube(c, u - w + sway, u + w + sway, z - 0.02, z, FLOOR - (k + 1) * (h / n), FLOOR - k * (h / n), k % 2 ? col : shade(col, 1.1));
						}
					}
				});
			}
			if (g > 70) {
				// A tangled mat of leaves along the surface, thicker the longer it's left.
				const mat = (g - 70) / 30;
				items.push({
					z: 0.99,
					f: () => {
						const r2 = rng(5);
						for (let i = 0; i < 40 * mat + 6; i++) {
							const u = r2();
							const z = r2();
							const [x, y] = P(u, 0.02 + r2() * 0.08 * mat, z);
							const s = depthScale(z) * (6 + r2() * 8);
							c.fillStyle = i % 2 ? 'rgba(60,150,60,0.85)' : 'rgba(90,180,70,0.85)';
							c.fillRect(x, y, s, s * 0.5);
						}
					}
				});
			}
		}
		if (has('coral')) {
			const cols = ['#ff7a8a', '#ffb84a', '#c86af0', '#ff5a5a', '#5ad8c8'];
			const spots: [number, number][] = [
				[0.4, 0.3],
				[0.55, 0.72],
				[0.7, 0.25],
				[0.3, 0.75],
				[0.9, 0.4]
			];
			spots.forEach(([u, z], i) => {
				const col = cols[i % cols.length];
				items.push({
					z,
					f: () => {
						cube(c, u - 0.012, u + 0.012, z - 0.03, z, FLOOR - 0.16, FLOOR, col);
						cube(c, u - 0.045, u - 0.012, z - 0.03, z, FLOOR - 0.12, FLOOR - 0.08, col);
						cube(c, u - 0.045, u - 0.03, z - 0.03, z, FLOOR - 0.22, FLOOR - 0.12, col);
						cube(c, u + 0.012, u + 0.045, z - 0.03, z, FLOOR - 0.16, FLOOR - 0.12, shade(col, 1.08));
						cube(c, u + 0.03, u + 0.045, z - 0.03, z, FLOOR - 0.26, FLOOR - 0.16, shade(col, 1.08));
						cube(c, u - 0.01, u + 0.01, z - 0.03, z, FLOOR - 0.24, FLOOR - 0.16, shade(col, 1.15));
					}
				});
			});
		}
		if (has('reef')) {
			// A whole reef: live rock along the back, smothered and crowded with coral at every
			// depth: branching staghorn, brain domes, table plates, sea fans and tube sponges.
			const r = rng(21);
			const cols = ['#ff7a8a', '#ffb84a', '#c86af0', '#ff5a5a', '#5ad8c8', '#f4e04a', '#ff8ac8', '#7ab8ff', '#f08a4a'];
			for (let i = 0; i < 6; i++) rock(0.06 + i * 0.176 + (r() - 0.5) * 0.04, 0.1 + r() * 0.1, 0.9 + r() * 0.6, i % 2 ? '#9a8a7a' : '#8a7e72');
			for (let i = 0; i < 30; i++) {
				const u = 0.03 + r() * 0.94;
				const z = 0.08 + r() * 0.84;
				const col = cols[Math.floor(r() * cols.length)];
				const kind = Math.floor(r() * 5);
				const s = 0.55 + r() * 0.7;
				const ph = r() * 6;
				items.push({ z, f: () => reefPiece(c, t, kind, u, z, s, col, ph) });
			}
		}
		if (has('anemone')) {
			items.push({
				z: 0.62,
				f: () => {
					cube(c, 0.74, 0.84, 0.54, 0.62, FLOOR - 0.04, FLOOR, '#c86a8a');
					for (let i = 0; i < 9; i++) {
						const sway = Math.sin(t * 2 + i) * 0.008;
						cube(c, 0.745 + i * 0.01 + sway, 0.752 + i * 0.01 + sway, 0.56, 0.6, FLOOR - 0.14 - (i % 3) * 0.02, FLOOR - 0.04, '#f4a8c8');
					}
				}
			});
		}
		if (once && has('ornament')) {
			items.push({
				z: 0.78,
				f: () => {
					cube(c, 0.44, 0.56, 0.7, 0.78, FLOOR - 0.1, FLOOR, '#8a5a2a');
					cube(c, 0.44, 0.56, 0.68, 0.76, FLOOR - 0.15, FLOOR - 0.1, '#7a4a22');
					cube(c, 0.49, 0.51, 0.77, 0.785, FLOOR - 0.12, FLOOR - 0.06, '#f0c040');
					// Treasure glinting.
					if (Math.sin(t * 2) > 0.6) {
						const [x, y] = P(0.47, FLOOR - 0.16, 0.74);
						c.fillStyle = '#fff6b0';
						c.fillRect(x, y, 3, 3);
					}
				}
			});
		}
		if (once && has('bubbles')) {
			stoneU = tu0 + 0.9 * tsc;
			items.push({ z: 0.35, f: () => cube(c, 0.88, 0.92, 0.32, 0.36, FLOOR - 0.03, FLOOR, '#5a6a7a') });
		}
		if (once) limitedEditions(c, t, items, has);
	}

	/** One coral on the reef: `kind` 0 staghorn, 1 brain, 2 table, 3 sea fan, 4 tube sponges; `s` its size. */
	function reefPiece(c: CanvasRenderingContext2D, t: number, kind: number, u: number, z: number, s: number, col: string, ph: number) {
		const F = FLOOR;
		const d = 0.03 * s;
		if (kind === 0) {
			// Staghorn: a trunk forking into antlers, tips paler.
			const sway = Math.sin(t * 1.3 + ph) * 0.003;
			cube(c, u - 0.008 * s, u + 0.008 * s, z - d, z, F - 0.12 * s, F, col);
			for (const [du, h0, h1] of [[-0.03, 0.07, 0.2], [0.03, 0.09, 0.22], [-0.012, 0.12, 0.27], [0.014, 0.12, 0.25]]) {
				cube(c, u + Math.min(0, du) * s, u + Math.max(0, du) * s, z - d, z, F - (h0 + 0.02) * s, F - h0 * s, col);
				cube(c, u + du * s - 0.006 * s + sway, u + du * s + 0.006 * s + sway, z - d, z, F - h1 * s, F - h0 * s, shade(col, 1.08));
				cube(c, u + du * s - 0.006 * s + sway, u + du * s + 0.006 * s + sway, z - d, z, F - (h1 + 0.02) * s, F - h1 * s, shade(col, 1.35));
			}
		} else if (kind === 1) {
			// Brain coral: a dome, with its winding grooves picked out.
			const rows = [0.06, 0.056, 0.048, 0.036, 0.02];
			rows.forEach((w, i) => cube(c, u - w * s, u + w * s, z - d * 1.6, z, F - (i + 1) * 0.022 * s, F - i * 0.022 * s, i % 2 ? col : shade(col, 0.88)));
			for (let i = 0; i < 3; i++) cube(c, u - 0.04 * s + i * 0.03 * s, u - 0.03 * s + i * 0.03 * s, z, z + 0.002, F - (0.05 + (i % 2) * 0.02) * s, F - (0.035 + (i % 2) * 0.02) * s, shade(col, 0.7));
		} else if (kind === 2) {
			// Table coral: a short stalk holding up a broad flat plate.
			cube(c, u - 0.008 * s, u + 0.008 * s, z - d, z, F - 0.1 * s, F, shade(col, 0.85));
			cube(c, u - 0.07 * s, u + 0.07 * s, z - d * 2, z, F - 0.12 * s, F - 0.1 * s, col);
			cube(c, u - 0.05 * s, u + 0.05 * s, z - d * 1.6, z - d * 0.4, F - 0.135 * s, F - 0.12 * s, shade(col, 1.15));
		} else if (kind === 3) {
			// A sea fan: a flat lattice, gently swaying.
			const sway = Math.sin(t * 1.1 + ph) * 0.005;
			for (let k = -3; k <= 3; k++) {
				const x = u + k * 0.012 * s + sway * (1 - Math.abs(k) / 4);
				cube(c, x - 0.0035 * s, x + 0.0035 * s, z - 0.008, z, F - (0.22 - Math.abs(k) * 0.028) * s, F - 0.01 * s, col);
			}
			for (let j = 1; j <= 3; j++) cube(c, u - (4 - j) * 0.012 * s + sway, u + (4 - j) * 0.012 * s + sway, z - 0.008, z, F - (j * 0.05 + 0.006) * s, F - j * 0.05 * s, shade(col, 1.12));
			cube(c, u - 0.006 * s, u + 0.006 * s, z - 0.012, z, F - 0.02 * s, F, shade(col, 0.7));
		} else {
			// Tube sponges: a cluster of open-topped tubes.
			for (const [du, h] of [[-0.022, 0.12], [0, 0.18], [0.024, 0.1], [0.012, 0.07]]) {
				const x = u + du * s;
				cube(c, x - 0.01 * s, x + 0.01 * s, z - d, z, F - h * s, F, col);
				cube(c, x - 0.006 * s, x + 0.006 * s, z - d * 0.8, z - d * 0.2, F - h * s - 0.002, F - h * s, shade(col, 0.45));
			}
		}
	}

	/** The holiday limited editions, each with its own spot so they can all share a tank. */
	function limitedEditions(c: CanvasRenderingContext2D, t: number, items: Items, has: (d: DecorTag) => boolean) {
		const F = FLOOR;
		const glow = (u: number, v: number, z: number, col: string, r: number) => {
			const [x, y] = P(u, v, z);
			const g = c.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, col);
			g.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = g;
			c.fillRect(x - r, y - r, r * 2, r * 2);
		};
		if (has('pumpkin')) {
			const u = 0.3;
			const z = 0.8;
			items.push({
				z,
				f: () => {
					// Ribbed orange body, a stem, and a face that flickers.
					cube(c, u - 0.07, u + 0.07, z - 0.08, z, F - 0.1, F, '#e8741a');
					cube(c, u - 0.06, u + 0.06, z - 0.07, z - 0.01, F - 0.13, F - 0.1, '#f08a2a');
					for (const du of [-0.035, 0.035]) cube(c, u + du - 0.004, u + du + 0.004, z - 0.002, z + 0.002, F - 0.1, F, '#c85a10');
					cube(c, u - 0.008, u + 0.008, z - 0.05, z - 0.03, F - 0.17, F - 0.13, '#3a7a2a');
					const lit = 0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.08;
					const eye = lit > 0.8 ? '#ffe070' : lit > 0.65 ? '#ffc040' : '#f09a20';
					cube(c, u - 0.045, u - 0.02, z, z + 0.003, F - 0.08, F - 0.06, eye);
					cube(c, u + 0.02, u + 0.045, z, z + 0.003, F - 0.08, F - 0.06, eye);
					cube(c, u - 0.04, u + 0.04, z, z + 0.003, F - 0.04, F - 0.025, eye);
					glow(u, F - 0.06, z, `rgba(255,170,40,${0.25 * lit})`, tilePx() * 0.06);
				}
			});
		}
		if (has('xmastree')) {
			const u = 0.78;
			const z = 0.74;
			items.push({
				z,
				f: () => {
					cube(c, u - 0.012, u + 0.012, z - 0.02, z, F - 0.04, F, '#6a4a2a');
					const tiers = [0.075, 0.06, 0.045, 0.03, 0.016];
					tiers.forEach((w, i) => cube(c, u - w, u + w, z - 0.04, z, F - 0.04 - (i + 1) * 0.05, F - 0.04 - i * 0.05, i % 2 ? '#2a8a3a' : '#1e7a30'));
					const balls = ['#e83a3a', '#f0c040', '#4aa8f0', '#f4f4f0'];
					for (let i = 0; i < 7; i++) {
						const tier = i % 4;
						const bu = u + (i % 2 ? 1 : -1) * tiers[tier] * 0.7;
						const on = Math.sin(t * 3 + i) > -0.3;
						cube(c, bu - 0.006, bu + 0.006, z - 0.004, z + 0.004, F - 0.06 - tier * 0.05, F - 0.048 - tier * 0.05, on ? balls[i % 4] : shade(balls[i % 4], 0.6));
					}
					cube(c, u - 0.01, u + 0.01, z - 0.025, z - 0.015, F - 0.31, F - 0.29, '#ffe060');
					glow(u, F - 0.3, z, 'rgba(255,230,120,0.35)', tilePx() * 0.03);
				}
			});
		}
		if (has('lantern')) {
			const u = 0.62;
			const z = 0.66;
			const sway = Math.sin(t * 1.2) * 0.006;
			items.push({
				z,
				f: () => {
					// A red paper lantern on a little anchor, gold caps and a tassel.
					cube(c, u - 0.004, u + 0.004, z - 0.02, z - 0.012, F - 0.1, F, '#3a2a1a');
					cube(c, u - 0.03 + sway, u + 0.03 + sway, z - 0.05, z - 0.01, F - 0.2, F - 0.12, '#d8282a');
					cube(c, u - 0.04 + sway, u + 0.04 + sway, z - 0.045, z - 0.015, F - 0.185, F - 0.135, '#e83a3a');
					cube(c, u - 0.022 + sway, u + 0.022 + sway, z - 0.04, z - 0.02, F - 0.215, F - 0.2, '#f0c040');
					cube(c, u - 0.022 + sway, u + 0.022 + sway, z - 0.04, z - 0.02, F - 0.12, F - 0.105, '#f0c040');
					cube(c, u - 0.004 + sway * 1.5, u + 0.004 + sway * 1.5, z - 0.032, z - 0.028, F - 0.105, F - 0.07, '#f0c040');
					glow(u + sway, F - 0.16, z - 0.01, 'rgba(255,90,60,0.28)', tilePx() * 0.05);
				}
			});
		}
		if (has('heart')) {
			const u = 0.15;
			const z = 0.7;
			items.push({
				z,
				f: () => {
					// A voxel heart, rows from the point up.
					const rows: [number, number][] = [
						[-0.008, 0.008],
						[-0.024, 0.024],
						[-0.04, 0.04],
						[-0.052, 0.052],
						[-0.056, 0.056],
						[-0.056, 0.056]
					];
					const beat = 1 + Math.max(0, Math.sin(t * 4)) * 0.06;
					cube(c, u - 0.03, u + 0.03, z - 0.03, z, F - 0.02, F, '#f4a8c8');
					rows.forEach(([a, b], i) => cube(c, u + a * beat, u + b * beat, z - 0.03, z, F - 0.02 - (i + 1) * 0.022 * beat, F - 0.02 - i * 0.022 * beat, '#e8406a'));
					cube(c, u - 0.054 * beat, u - 0.006, z - 0.03, z, F - 0.02 - 7 * 0.022 * beat, F - 0.02 - 6 * 0.022 * beat, '#e8406a');
					cube(c, u + 0.006, u + 0.054 * beat, z - 0.03, z, F - 0.02 - 7 * 0.022 * beat, F - 0.02 - 6 * 0.022 * beat, '#e8406a');
					cube(c, u - 0.04, u - 0.025, z, z + 0.002, F - 0.15, F - 0.13, '#ffc0d0');
				}
			});
		}
		if (has('clover')) {
			const u = 0.68;
			const z = 0.8;
			items.push({
				z,
				f: () => {
					// A black pot brimming with gold, a four-leaf clover beside it.
					cube(c, u - 0.05, u + 0.05, z - 0.06, z, F - 0.07, F, '#2a2a30');
					cube(c, u - 0.056, u + 0.056, z - 0.064, z + 0.004, F - 0.08, F - 0.07, '#3a3a42');
					for (let i = 0; i < 5; i++) {
						const cu = u - 0.04 + i * 0.02;
						cube(c, cu - 0.009, cu + 0.009, z - 0.05, z - 0.01, F - 0.09 - (i % 2) * 0.01, F - 0.08, Math.sin(t * 3 + i) > 0.7 ? '#fff0a0' : '#f0c040');
					}
					const cu = u + 0.09;
					cube(c, cu - 0.003, cu + 0.003, z - 0.01, z - 0.004, F - 0.08, F, '#3a8a2a');
					for (const [du, dv] of [[-0.016, 0], [0.016, 0], [0, -0.016], [0, 0.016]])
						cube(c, cu + du - 0.012, cu + du + 0.012, z - 0.012, z, F - 0.1 + dv - 0.012, F - 0.1 + dv + 0.012, '#4ab84a');
				}
			});
		}
		if (has('egg')) {
			const u = 0.46;
			const z = 0.78;
			items.push({
				z,
				f: () => {
					// A painted egg in pastel stripes, widest a little below the middle.
					const rows = [0.03, 0.042, 0.048, 0.046, 0.04, 0.03, 0.016];
					const cols = ['#f8b8d0', '#fff2a0', '#a8e0f8', '#d0b8f8'];
					rows.forEach((w, i) => cube(c, u - w, u + w, z - 0.05, z, F - (i + 1) * 0.022, F - i * 0.022, cols[i % 4]));
					for (let i = 0; i < 3; i++) cube(c, u - 0.03 + i * 0.025, u - 0.022 + i * 0.025, z, z + 0.002, F - 0.075, F - 0.067, '#ffffff');
				}
			});
		}
		if (has('invader')) {
			// The red invader from Space Invaders, block for block from its sprite, bobbing and
			// marching its legs (two frames, like the game).
			const A = ['....####....', '.##########.', '############', '###..##..###', '############', '..###..###..'];
			const legs = [
				['.##..##..##.', '..##....##..'],
				['..##.##.##..', '##........##']
			];
			const frame = Math.floor(t * 2) % 2;
			const rows = [...A, ...legs[frame]];
			const cw = 0.011;
			const ch = 0.017;
			const u0 = 0.7;
			const z = 0.5;
			const top = F - 0.5 + Math.sin(t * 1.3) * 0.02;
			items.push({
				z,
				f: () => {
					rows.forEach((row, j) =>
						[...row].forEach((px, i) => {
							if (px === '#') cube(c, u0 + i * cw, u0 + (i + 1) * cw, z - 0.025, z, top + j * ch, top + (j + 1) * ch, j % 2 ? '#c8001a' : '#e0102a');
						})
					);
					glow(u0 + 6 * cw, top + 4 * ch, z, 'rgba(255,40,60,0.22)', tilePx() * 0.07);
				}
			});
		}
		if (has('jet')) {
			// The Top Gun jet: Top Gun's own F-14 sprite (seen from behind), pixel for pixel as
			// voxels, hovering with its afterburners (the red ones) flickering.
			const rows = [
				'.......................c........................................',
				'......................de.................de.....................',
				'......................if.................fhd....................',
				'......................if.................fhd....................',
				'......................hff...............ffhc....................',
				'.......................hf...............eff.....................',
				'.......................hfd..............fff.....................',
				'.......................hff......a......dfff.....................',
				'.......................hff.....fcc.....dfff.....................',
				'.......................hfff...efdcf...dffff.....................',
				'.......................fffe.cdfhhfhdd.cffhc.....................',
				'.......................dhffcecbhccdaibfffh......................',
				'.......................dhffdadabfcaebbfffh......................',
				'...................baaachffdadiaaaehabfffhaaa...................',
				'................baaaaaachfdbfeaiadbcfcbeffaaaaaabb..............',
				'..........bbbbaaaaabddcehhaacbaiadcaeaadhhccdcaaaaaabbbb........',
				'.......aaaceaaaadeedcckiiddbdadbabdaccbchikfcdeeebaaacdaaa......',
				'....aaaeefeihhhhcccbahiiihfhdaheeeiaaifhiiihbaccchhhhifefebaab..',
				'.bbbhhhhhhhhbbbaaaaafijjjjiiiheaaacfkiiijjjikaaaaabbbdhhhhhhhdbb',
				'.ffffff...baaaaaaabbhijjjjifhicbcbbhifhjjjjjkcbaaaaaaa....dffffh',
				'.........cddddddddfkiijggjihh.cikidcdihjggjjikiddddddddd........',
				'...................chijjjjif...c.....diijjjik...................',
				'.....................iiiiih...........diiiiic...................',
				'......................hhhh.............dhhhc....................'
			];
			const PAL: Record<string, string> = { a: '#ffffff', b: '#dfeaf3', c: '#bac3ce', d: '#9b9d9a', e: '#867d74', f: '#6c7781', g: '#7d5c53', h: '#4d5053', i: '#2c2928', j: '#c00000', k: '#000000' };
			const cw = 0.0055;
			const ch = 0.009;
			const u0 = 0.17;
			const z = 0.56;
			const top = F - 0.5 + Math.sin(t * 0.9) * 0.012;
			const burn = Math.sin(t * 17) + Math.sin(t * 29) > 0;
			items.push({
				z,
				f: () => {
					rows.forEach((row, j) => {
						for (let i = 0; i < row.length; i++) {
							const px = row[i];
							if (px === '.') continue;
							const col = px === 'j' && burn ? '#ff3a24' : PAL[px];
							const u = u0 + i * cw;
							const v = top + j * ch;
							// A front face, and a top face where nothing sits above (light enough for ~540 blocks).
							if (j === 0 || rows[j - 1][i] === '.') quad(c, [P(u, v, z - 0.02), P(u + cw, v, z - 0.02), P(u + cw, v, z), P(u, v, z)], shade(col, 1.18));
							quad(c, [P(u, v, z), P(u + cw, v, z), P(u + cw, v + ch, z), P(u, v + ch, z)], col);
						}
					});
					for (const e of [26, 45]) glow(u0 + e * cw, top + 20 * ch, z, `rgba(255,60,40,${burn ? 0.4 : 0.25})`, tilePx() * 0.035);
				}
			});
		}
		if (has('sandcastle')) {
			const u = 0.55;
			const z = 0.82;
			items.push({
				z,
				f: () => {
					const sand = '#e8cc8a';
					cube(c, u - 0.08, u + 0.08, z - 0.06, z, F - 0.06, F, sand);
					for (const du of [-0.06, 0.06]) {
						cube(c, u + du - 0.022, u + du + 0.022, z - 0.05, z - 0.01, F - 0.13, F - 0.06, shade(sand, 1.04));
						for (const k of [-1, 1]) cube(c, u + du + k * 0.014 - 0.007, u + du + k * 0.014 + 0.007, z - 0.05, z - 0.01, F - 0.145, F - 0.13, sand);
					}
					cube(c, u - 0.028, u + 0.028, z - 0.05, z - 0.01, F - 0.17, F - 0.06, shade(sand, 1.08));
					cube(c, u - 0.012, u + 0.012, z - 0.003, z + 0.001, F - 0.05, F, '#7a5a3a');
					cube(c, u - 0.002, u + 0.002, z - 0.03, z - 0.026, F - 0.23, F - 0.17, '#6a4a2a');
					const flap = Math.sin(t * 5) * 0.004;
					cube(c, u + 0.002, u + 0.03 + flap, z - 0.03, z - 0.026, F - 0.23, F - 0.205, '#e83a3a');
				}
			});
		}
	}

	/** The fish, swimming in three dimensions. */
	function swim(c: CanvasRenderingContext2D, t: number, dt: number, items: { z: number; f: () => void }[], W: number) {
		const live = new Set(fish.map((f) => f.u));
		for (const u of swimmers.keys()) if (!live.has(u)) swimmers.delete(u);
		const pxPerCm = Math.min((fx1 - fx0) / widthCm, tallCm ? (fy1 - fy0) / tallCm : Infinity);
		for (const f of fish) {
			const sp = species(f.s);
			const isCenter = f.u === center;
			const base = Math.max(9, Math.min(W * 0.7, sp.cm * pxPerCm)) * (isCenter ? 1.1 : 1);
			const crawl = sp.shape === 'snail' || sp.shape === 'crab' || sp.shape === 'shrimp';
			const floor = sp.shape === 'bottom' || sp.shape === 'ray' || crawl;
			// Keep the whole fish inside the glass.
			const margin = Math.min(0.4, base / 2 / (fx1 - fx0));
			const vMin = floor ? FLOOR : 0.08 + Math.min(0.3, (base * 0.25) / (fy1 - fy0));
			const vMax = floor ? FLOOR : Math.max(vMin + 0.02, FLOOR - 0.06 - Math.min(0.3, (base * 0.2) / (fy1 - fy0)));
			let s = swimmers.get(f.u);
			if (!s) {
				const u = margin + Math.random() * (1 - 2 * margin);
				const v = vMin + Math.random() * (vMax - vMin);
				const z = 0.15 + Math.random() * 0.8;
				s = { u, v, z, tu: u, tv: v, tz: z, dir: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 10 };
				swimmers.set(f.u, s);
			}
			const mood = isCenter ? happy / 100 : 0.7;
			if (Math.hypot(s.tu - s.u, (s.tv - s.v) * 0.6, (s.tz - s.z) * 0.5) < 0.02) {
				s.tu = margin + Math.random() * (1 - 2 * margin);
				s.tv = isCenter && mood < 0.3 ? vMax - Math.random() * 0.05 : vMin + Math.random() * (vMax - vMin);
				s.tz = isCenter ? 0.6 + Math.random() * 0.38 : 0.12 + Math.random() * 0.85;
			}
			const pxSpeed = sp.shape === 'snail' ? 3 : crawl ? 9 : (20 + 30 * mood) * Math.min(1.6, Math.max(0.6, base / 40));
			const speed = pxSpeed / (fx1 - fx0);
			const du = s.tu - s.u;
			const dv = s.tv - s.v;
			const dz = s.tz - s.z;
			const d = Math.hypot(du, dv, dz) || 1;
			s.u += (du / d) * speed * dt;
			s.v += (dv / d) * speed * dt * 0.6;
			s.z += (dz / d) * speed * dt * 0.8;
			if (Math.abs(du) > 0.01) s.dir = du > 0 ? 1 : -1;
			const sw = s;
			items.push({
				z: sw.z,
				f: () => {
					const k = depthScale(sw.z);
					const len = base * k;
					// Its shadow on the floor, then the fish (hazier further back).
					const [shx, shy] = P(sw.u, FLOOR, sw.z);
					c.fillStyle = `rgba(0,20,30,${floor ? 0.25 : 0.14})`;
					c.beginPath();
					c.ellipse(shx, shy, len * 0.4, Math.max(1.5, len * 0.07), 0, 0, Math.PI * 2);
					c.fill();
					const [x, y0] = P(sw.u, sw.v, sw.z);
					const y = floor ? y0 - len * 0.12 : y0;
					drawFish(c, sp, x, y, len, sw.dir, t * (0.6 + mood) + sw.phase, undefined, 0.72 + 0.28 * sw.z);
					if (isCenter && happy >= 75 && Math.floor(t * 1.5 + sw.phase) % 4 === 0) {
						c.fillStyle = '#ff5d8f';
						c.fillRect(x - 3, y - len * 0.5 - ((t * 20) % 12), 6, 5);
						c.fillRect(x - 1, y - len * 0.5 - ((t * 20) % 12) + 5, 2, 2);
					}
				}
			});
		}
	}

	/** Reflections on the glass, which depend on its shape. */
	function glass(c: CanvasRenderingContext2D, shape: TankLook['shape'], W: number) {
		const iw = fx1 - fx0;
		const g = (x: number, w: number, a: number) => {
			const gr = c.createLinearGradient(x, 0, x + w, 0);
			gr.addColorStop(0, 'rgba(255,255,255,0)');
			gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
			gr.addColorStop(1, 'rgba(255,255,255,0)');
			c.fillStyle = gr;
			c.fillRect(x, fy0 - 20, w, fy1 - fy0 + 40);
		};
		if (shape === 'cylinder') {
			// Round glass: dark at the curving edges, a long highlight down one side.
			const e = c.createLinearGradient(fx0, 0, fx1, 0);
			e.addColorStop(0, 'rgba(0,10,30,0.45)');
			e.addColorStop(0.12, 'rgba(0,10,30,0)');
			e.addColorStop(0.88, 'rgba(0,10,30,0)');
			e.addColorStop(1, 'rgba(0,10,30,0.45)');
			c.fillStyle = e;
			c.fillRect(fx0, 0, iw, fy1 + 40);
			g(fx0 + iw * 0.12, iw * 0.06, 0.35);
			g(fx0 + iw * 0.82, iw * 0.03, 0.2);
		} else if (shape === 'bowfront') {
			g(fx0 + iw * 0.04, iw * 0.08, 0.22);
			g(fx1 - iw * 0.12, iw * 0.08, 0.22);
		} else if (shape === 'hex') {
			// Angled corner panes: a touch darker, with a seam where they meet the front pane.
			c.fillStyle = 'rgba(0,20,40,0.16)';
			c.fillRect(fx0, 0, iw * 0.22, fy1 + 40);
			c.fillRect(fx1 - iw * 0.22, 0, iw * 0.22, fy1 + 40);
			c.fillStyle = 'rgba(255,255,255,0.35)';
			c.fillRect(fx0 + iw * 0.22 - 1, 0, 2, fy1 + 40);
			c.fillRect(fx1 - iw * 0.22 - 1, 0, 2, fy1 + 40);
			g(fx0 + iw * 0.3, iw * 0.05, 0.16);
		} else {
			// A diagonal glare across flat glass.
			c.fillStyle = 'rgba(255,255,255,0.07)';
			c.beginPath();
			c.moveTo(fx0 + iw * 0.1, fy0);
			c.lineTo(fx0 + iw * 0.18, fy0);
			c.lineTo(fx0 + iw * 0.06, fy1);
			c.lineTo(fx0 - iw * 0.02, fy1);
			c.fill();
			c.fillRect(fx0 + iw * 0.2, fy0, 3, fy1 - fy0);
		}
		void W;
	}

	/** The rim, hood light and base rail, in the trim's colour (rimless tanks: just silicone seams). */
	function frame(c: CanvasRenderingContext2D, shape: TankLook['shape'], trim: string, rimless: boolean, W: number, H: number, rimH: number, baseH: number, standH: number, tint: string) {
		const iw = fx1 - fx0;
		const bulge = (fy1 - fy0) * 0.05;
		if (rimless) {
			c.strokeStyle = 'rgba(200,235,255,0.55)';
			c.lineWidth = 2;
			c.strokeRect(fx0, fy0, iw, fy1 - fy0);
			c.strokeStyle = 'rgba(200,235,255,0.25)';
			c.beginPath();
			c.moveTo(fx0, fy0);
			c.lineTo(bx0, by0);
			c.moveTo(fx1, fy0);
			c.lineTo(bx1, by0);
			c.stroke();
			c.lineWidth = 1;
			// A slim pendant light above.
			c.fillStyle = shade(trim, 0.9);
			c.fillRect(W * 0.3, 0, W * 0.4, 3);
		} else {
			c.save();
			c.lineJoin = 'round';
			c.strokeStyle = trim;
			c.lineWidth = Math.max(3, (fx0 + (W - fx1)) / 2) * 1.6;
			outline(c, shape);
			c.stroke();
			c.restore();
			// Hood on top, base rail at the bottom (curved to follow the shape).
			const hood = (y: number, h: number, curve: number) => {
				c.fillStyle = shade(trim, 1.18);
				c.fillRect(0, y - h * 0.3, W, h * 0.3);
				c.fillStyle = trim;
				c.beginPath();
				c.moveTo(0, y);
				if (shape === 'hex') {
					c.lineTo(fx0 + iw * 0.22, y + curve);
					c.lineTo(fx1 - iw * 0.22, y + curve);
					c.lineTo(W, y);
				} else c.quadraticCurveTo(W / 2, y + curve * 2, W, y);
				c.lineTo(W, y + h);
				if (shape === 'hex') {
					c.lineTo(fx1 - iw * 0.22, y + h + curve);
					c.lineTo(fx0 + iw * 0.22, y + h + curve);
					c.lineTo(0, y + h);
				} else c.quadraticCurveTo(W / 2, y + h + curve * 2, 0, y + h);
				c.closePath();
				c.fill();
				c.fillStyle = 'rgba(255,255,255,0.18)';
				c.fillRect(0, y, W, 1.5);
			};
			const curve = shape === 'rect' ? 0 : shape === 'cylinder' ? bulge * 0.8 : bulge * 0.5;
			hood(fy0 - rimH, rimH, curve);
			hood(fy1, baseH, curve);
			// The hood light's glow.
			const glow = c.createLinearGradient(0, fy0, 0, fy0 + 30);
			glow.addColorStop(0, tint.replace(/[\d.]+\)$/, '0.5)'));
			glow.addColorStop(1, 'rgba(255,255,255,0)');
			c.fillStyle = tint === 'rgba(255,255,240,0)' ? 'rgba(255,255,240,0.18)' : glow;
			c.fillRect(fx0, fy0, iw, 3);
		}
		void H;
		void standH;
	}

	function drawStand(c: CanvasRenderingContext2D, col: string, W: number, H: number, standH: number) {
		const y = H - standH;
		const marble = col === '#cfc8c0';
		c.fillStyle = shade(col, 1.2);
		c.fillRect(0, y, W, 5);
		c.fillStyle = col;
		c.fillRect(0, y + 5, W, standH - 5);
		if (marble) {
			c.strokeStyle = 'rgba(120,110,100,0.35)';
			for (let i = 0; i < 6; i++) {
				c.beginPath();
				c.moveTo((i * W) / 6, y + 5);
				c.quadraticCurveTo((i * W) / 6 + 30, y + standH / 2, (i * W) / 6 + 10, H);
				c.stroke();
			}
		}
		// Cabinet doors with handles.
		const doors = Math.max(2, Math.round(W / 220));
		const dw = (W - 16) / doors;
		for (let i = 0; i < doors; i++) {
			const x = 8 + i * dw;
			c.fillStyle = shade(col, 0.85);
			c.fillRect(x + 3, y + 10, dw - 6, standH - 16);
			c.fillStyle = shade(col, 0.95);
			c.fillRect(x + 6, y + 13, dw - 12, standH - 22);
			c.fillStyle = '#c8c8c0';
			c.fillRect(i % 2 ? x + 10 : x + dw - 14, y + standH / 2 - 6, 4, 12);
		}
		c.fillStyle = 'rgba(0,0,0,0.25)';
		c.fillRect(0, H - 4, W, 4);
	}

	function mix(a: string, b: string, f: number) {
		const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
		const [x, y] = [p(a), p(b)];
		return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
	}
</script>

<div class="tank" class:fill={!height} bind:this={wrap} style={height ? `height: ${height}px` : ''}>
	<canvas bind:this={canvas} style="width: 100%; height: 100%" aria-hidden="true"></canvas>
</div>

<style>
	.tank {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-radius: 6px;
	}
	.tank.fill {
		height: 100%;
	}
	canvas {
		display: block;
		image-rendering: pixelated;
	}
</style>
