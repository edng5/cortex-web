// Hand-built voxel models for fish whose shape the generic outline can't capture, drawn from
// photographs of the real fish:
//  - Oscar: deep oval body, big head and mouth, long dorsal and anal fins ending in rounded lobes
//    over the tail base, a rounded tail, dark with orange marbling, and the black, orange-ringed
//    eyespot (ocellus) at the base of the tail.
//  - Discus: an almost perfect disc (the fins run right round the edge), wavy stripes, a red eye
//    and a small mouth.
//  - Arowana: long, with a dead-straight back, an upturned jaw with two chin barbels, a deeper
//    belly, big mosaic scales, and the dorsal and anal fins set far back beside a small tail.
//  - Corydoras: a humped back peaking at a tall triangular dorsal fin, a flat belly, a blunt
//    sloping snout with barbels, a forked tail and a metallic green flank.
//  - Zebra Shark: a thick, blunt-headed body with ridges, two dorsal fins set back, broad pectoral
//    fins, and a ribbon-like tail nearly half its length; tan with dark spots.
//  - Freshwater Angelfish: a compressed, diamond-shaped body with very tall, swept-back dorsal
//    and anal fins, long trailing ventral filaments, and black vertical bars through the eye and
//    body that run on into the fins.
//  - Blue Tang: royal blue, with the black "palette" band running from the eye to the tail and
//    looping round a blue patch, a yellow tail edged black, black-edged fins and a small snout.
//
// Tile units as in fishArt: x along the fish (tail at 0, nose at 1), y across (viewer at larger
// y), z up, with the middle of the body at MID.
import { bx, magikarpModel, type Box } from '../voxel';
import type { Species } from './data';

export const MID = 0.32;
type Seg = [number, number, string];

/** Which hand-built model a species uses (varieties share their species' model). */
export function customModel(sp: Species): ((sp: Species, phase: number) => Box[]) | null {
	if (sp.id === 'magikarp' || sp.id === 'shiny-magikarp') return magikarp;
	if (sp.id === 'stockfish') return stockfish;
	if (sp.sci.startsWith('Astronotus')) return oscar;
	if (sp.sci.startsWith('Symphysodon')) return discus;
	if (sp.sci.startsWith('Osteoglossum') || sp.sci.startsWith('Scleropages')) return arowana;
	if (sp.sci.startsWith('Corydoras')) return cory;
	if (sp.id === 'zebra-shark') return zebraShark;
	if (sp.sci.startsWith('Paracanthurus')) return blueTang;
	if (sp.sci.startsWith('Pterophyllum')) return angelfish;
	if (sp.shape === 'ray') return ray;
	if (sp.shape === 'shrimp') return shrimp;
	if (sp.shape === 'snail') return snail;
	if (sp.shape === 'crab') return crab;
	if (/^(Hippocampus|Phycodurus|Phyllopteryx)/.test(sp.sci)) return seahorse;
	return null;
}

/** One vertical slice of body from z0 to z1, painted in bands (fractions of its height). */
function slice(out: Box[], x: number, w: number, z0: number, z1: number, d: number, segs: Seg[], wave = 0) {
	const h = z1 - z0;
	for (const [f0, f1, col] of segs) out.push(bx(x, 0.5 - d / 2 + wave, z0 + h * f0, w + 0.002, d, h * (f1 - f0), col));
}
/** A thin fin plate. */
function fin(out: Box[], x: number, z: number, w: number, h: number, col: string, y = 0.475, d = 0.05) {
	out.push(bx(x, y, z, w, d, h, col));
}
/** An eye on the side facing the viewer: iris ring and pupil. */
function eye(out: Box[], x: number, z: number, r: number, d: number, iris: string) {
	const y = 0.5 + d / 2 + 0.003;
	out.push(bx(x - r / 2, y, z - r / 2, r, 0.006, r, iris));
	out.push(bx(x - r / 4, y + 0.004, z - r / 4, r / 2, 0.006, r / 2, '#121216'));
	out.push(bx(x - r / 4, y + 0.008, z + r / 8, r / 6, 0.004, r / 6, '#ffffff'));
}
const swishOf = (phase: number) => Math.sin(phase * Math.PI * 2);

function oscar(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const mark = sp.pcolor ?? '#f07a2a';
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 12;
	const x0 = 0.22;
	const x1 = 0.95;
	const dx = (x1 - x0) / N;
	// Deep oval: shallow at the tail base, deepest behind the head, rounding into a big head.
	const half = [0.07, 0.1, 0.14, 0.17, 0.19, 0.2, 0.2, 0.195, 0.18, 0.16, 0.13, 0.09];
	const marbled = [2, 4, 5, 7, 9];
	for (let i = 0; i < N; i++) {
		const hz = half[i];
		const top = MID + hz + 0.01;
		const bot = MID - hz;
		const d = 0.06 + hz * 0.45;
		const wave = Math.sin(phase * Math.PI * 2 - i * 0.4) * (1 - i / N) * 0.02;
		const segs: Seg[] =
			i === 0
				? // The ocellus: a black eyespot ringed with orange at the base of the tail.
					[
						[0, 0.25, mark],
						[0.25, 0.75, '#141418'],
						[0.75, 1, mark]
					]
				: marbled.includes(i)
					? [
							[0, 0.3, belly],
							[0.3, 0.55, mark],
							[0.55, 0.8, body],
							[0.8, 1, mark]
						]
					: [
							[0, 0.3, i % 2 ? mark : belly],
							[0.3, 1, body]
						];
		slice(b, x0 + i * dx, dx, bot, top, d, segs, wave);
	}
	// Long dorsal and anal fins, ending in rounded lobes over the tail base.
	for (let i = 0; i < 6; i++) fin(b, 0.48 + i * 0.07, MID + 0.19 - i * 0.01, 0.07, 0.05, body);
	fin(b, 0.25, MID + 0.08, 0.2, 0.12, finC);
	fin(b, 0.27, MID + 0.19, 0.12, 0.04, finC);
	fin(b, 0.26, MID - 0.2, 0.2, 0.12, finC);
	fin(b, 0.28, MID - 0.24, 0.12, 0.04, finC);
	// Rounded tail.
	const ty = 0.475 + sw * 0.04;
	fin(b, 0.13, MID - 0.12, 0.1, 0.24, finC, ty);
	fin(b, 0.06, MID - 0.09, 0.07, 0.18, finC, ty);
	// Big mouth and a red-ringed eye.
	b.push(bx(0.93, 0.47, MID - 0.06, 0.06, 0.06, 0.05, '#3a2a24'));
	eye(b, 0.84, MID + 0.06, 0.06, 0.15, '#d83a2a');
	// Pectoral fin.
	b.push(bx(0.68, 0.585, MID - 0.06 + sw * 0.01, 0.08, 0.008, 0.07, finC));
	return b;
}

function discus(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const line = sp.pcolor ?? '#e8702a';
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 13;
	const x0 = 0.16;
	const x1 = 0.9;
	const dx = (x1 - x0) / N;
	for (let i = 0; i < N; i++) {
		// A circle: the fins round the edge make the outline.
		const u = (i + 0.5) / N;
		const hz = 0.34 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) + 0.02;
		const d = 0.05 + hz * 0.25;
		const segs: Seg[] = [[0, 0.12, finC]];
		// Wavy horizontal stripes across the body.
		const bands = 6;
		for (let k = 0; k < bands; k++) {
			const f0 = 0.12 + (k / bands) * 0.76 + (i % 2 ? 0.02 : 0);
			const f1 = 0.12 + ((k + 1) / bands) * 0.76 + (i % 2 ? 0.02 : 0);
			segs.push([f0, Math.min(0.88, f1), k % 2 ? line : k === 0 ? belly : body]);
		}
		segs.push([0.88, 1, finC]);
		slice(b, x0 + i * dx, dx, MID - hz, MID + hz, d, segs);
	}
	const ty = 0.475 + sw * 0.04;
	fin(b, 0.08, MID - 0.08, 0.09, 0.16, finC, ty);
	eye(b, 0.8, MID + 0.07, 0.055, 0.12, '#e03a2a');
	b.push(bx(0.89, 0.48, MID - 0.01, 0.03, 0.04, 0.03, '#3a2a24'));
	b.push(bx(0.66, 0.565, MID - 0.05 + sw * 0.01, 0.07, 0.008, 0.06, finC));
	return b;
}

function arowana(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 14;
	const x0 = 0.12;
	const x1 = 0.97;
	const dx = (x1 - x0) / N;
	const top = MID + 0.08;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		// Straight back; the belly deepens toward the middle and rises to the upturned jaw.
		const bot = MID - 0.02 - 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8;
		const d = 0.08 + (top - bot) * 0.35;
		const wave = Math.sin(phase * Math.PI * 2 - u * 4) * (1 - u) * 0.025;
		// Big mosaic scales: alternate light and dark rows.
		const segs: Seg[] = [
			[0, 0.25, belly],
			[0.25, 0.45, i % 2 ? body : belly],
			[0.45, 0.7, i % 2 ? belly : body],
			[0.7, 1, body]
		];
		slice(b, x0 + i * dx, dx, bot, top, d, segs, wave);
	}
	// Upturned jaw and the two chin barbels.
	b.push(bx(0.95, 0.47, top - 0.03, 0.05, 0.06, 0.03, '#d8dce4'));
	b.push(bx(0.97, 0.485, top - 0.005, 0.06, 0.02, 0.015, '#b8bcc8'), bx(0.98, 0.495, top + 0.01, 0.05, 0.015, 0.012, '#b8bcc8'));
	// Long, low dorsal and anal fins far back, and a small rounded tail.
	fin(b, 0.13, top - 0.01, 0.2, 0.06, finC);
	fin(b, 0.16, top + 0.04, 0.12, 0.03, finC);
	fin(b, 0.12, MID - 0.11, 0.24, 0.07, finC);
	const ty = 0.475 + sw * 0.03;
	fin(b, 0.04, MID - 0.05, 0.09, 0.12, finC, ty);
	fin(b, 0.0, MID - 0.03, 0.05, 0.08, finC, ty);
	eye(b, 0.89, top - 0.035, 0.045, 0.1, '#f0e8a0');
	b.push(bx(0.72, 0.545, MID - 0.08 + sw * 0.01, 0.12, 0.008, 0.035, finC));
	return b;
}

function cory(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const flank = sp.pattern === 'none' ? '#3a8a6a' : (sp.pcolor ?? '#3a8a6a');
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 11;
	const x0 = 0.2;
	const x1 = 0.94;
	const dx = (x1 - x0) / N;
	const floor = 0.06;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		// Flat belly; the back humps up to the dorsal fin, then slopes down to a blunt snout.
		const hump = u < 0.6 ? 0.12 + 0.2 * (u / 0.6) : 0.32 - 0.3 * ((u - 0.6) / 0.4);
		const top = floor + Math.max(0.1, hump);
		const d = 0.1 + (top - floor) * 0.45;
		const segs: Seg[] = [
			[0, 0.3, belly],
			[0.3, 0.7, i > 2 && i < 8 ? flank : body],
			[0.7, 1, body]
		];
		if (sp.pattern === 'spots' && i % 2) segs.splice(1, 1, [0.3, 0.5, sp.pcolor ?? '#222'], [0.5, 0.7, body]);
		slice(b, x0 + i * dx, dx, floor, top, d, segs);
	}
	// Tall triangular dorsal fin (spine at the front), a tiny adipose fin, and a forked tail.
	for (let k = 0; k < 4; k++) fin(b, 0.6 - k * 0.025, floor + 0.32 + k * 0.05, 0.1 - k * 0.02, 0.05, k === 0 ? body : finC);
	fin(b, 0.3, floor + 0.17, 0.04, 0.03, finC);
	const ty = 0.475 + sw * 0.04;
	fin(b, 0.14, floor + 0.1, 0.07, 0.06, finC, ty);
	fin(b, 0.08, floor + 0.15, 0.08, 0.09, finC, ty);
	fin(b, 0.08, floor - 0.02, 0.08, 0.08, finC, ty);
	// Barbels under the snout, and a high eye.
	b.push(bx(0.93, 0.5, floor, 0.05, 0.02, 0.015, '#d8c098'), bx(0.92, 0.46, floor + 0.01, 0.05, 0.02, 0.015, '#d8c098'));
	eye(b, 0.85, floor + 0.15, 0.045, 0.18, '#d8c890');
	b.push(bx(0.72, 0.6, floor + 0.01, 0.1, 0.01, 0.04, finC));
	return b;
}

function zebraShark(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const spot = sp.pcolor ?? '#3a3028';
	const b: Box[] = [];
	const sw = swishOf(phase);
	// Body: thick and blunt from the head back to the pelvic fins…
	const N = 9;
	const x0 = 0.45;
	const x1 = 0.98;
	const dx = (x1 - x0) / N;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		const hz = 0.07 + 0.05 * Math.sin(Math.PI * Math.min(1, u * 1.15));
		const d = 0.16 + hz;
		const segs: Seg[] = [
			[0, 0.3, belly],
			[0.3, 0.55, i % 2 ? spot : body],
			[0.55, 0.85, i % 3 === 1 ? spot : body],
			[0.85, 1, '#e0d0a8']
		];
		slice(b, x0 + i * dx, dx, MID - hz, MID + hz, d, segs);
	}
	// …then the long ribbon tail (nearly half its length), swaying.
	const M = 10;
	for (let i = 0; i < M; i++) {
		const u = i / M;
		const hz = 0.02 + 0.045 * u;
		const wave = Math.sin(phase * Math.PI * 2 - u * 3) * (1 - u) * 0.05;
		slice(b, 0.45 * u, 0.045, MID - hz, MID + hz * 0.6, 0.06 + hz, [
			[0, 0.5, i % 2 ? spot : body],
			[0.5, 1, body]
		], wave);
	}
	// Two dorsal fins set well back, broad pectoral fins, a small eye and nostril barbels.
	fin(b, 0.5, MID + 0.1, 0.1, 0.07, finC);
	fin(b, 0.52, MID + 0.16, 0.06, 0.03, finC);
	fin(b, 0.38, MID + 0.06, 0.07, 0.05, finC);
	b.push(bx(0.78, 0.62, MID - 0.12 + sw * 0.005, 0.12, 0.08, 0.02, finC));
	b.push(bx(0.6, 0.6, MID - 0.11, 0.08, 0.06, 0.02, finC));
	eye(b, 0.93, MID + 0.03, 0.03, 0.27, '#2a2420');
	b.push(bx(0.98, 0.5, MID - 0.02, 0.02, 0.02, 0.02, '#8a7a5a'));
	return b;
}

function blueTang(sp: Species, phase: number): Box[] {
	const [body, , tail] = sp.colors;
	const black = '#121830';
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 12;
	const x0 = 0.22;
	const x1 = 0.9;
	const dx = (x1 - x0) / N;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		const hz = 0.08 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.7;
		const d = 0.05 + hz * 0.3;
		// The palette: a black band from the eye to the tail base, looping round a blue patch.
		let segs: Seg[];
		if (i <= 1)
			segs = [
				[0, 0.35, body],
				[0.35, 0.75, black],
				[0.75, 1, body]
			];
		else if (i >= 3 && i <= 8)
			segs = [
				[0, 0.25, body],
				[0.25, 0.38, black],
				[0.38, 0.62, body],
				[0.62, 0.88, black],
				[0.88, 1, body]
			];
		else
			segs = [
				[0, 0.45, body],
				[0.45, 0.8, black],
				[0.8, 1, body]
			];
		slice(b, x0 + i * dx, dx, MID - hz, MID + hz, d, segs);
	}
	// Black-edged dorsal and anal fins.
	fin(b, 0.3, MID + 0.19, 0.5, 0.04, body);
	fin(b, 0.3, MID + 0.23, 0.5, 0.015, black);
	fin(b, 0.32, MID - 0.23, 0.42, 0.04, body);
	fin(b, 0.32, MID - 0.245, 0.42, 0.015, black);
	// The yellow tail, edged black top and bottom.
	const ty = 0.475 + sw * 0.04;
	fin(b, 0.13, MID - 0.06, 0.1, 0.12, tail, ty);
	fin(b, 0.05, MID - 0.1, 0.09, 0.2, tail, ty);
	fin(b, 0.05, MID + 0.1, 0.09, 0.02, black, ty);
	fin(b, 0.05, MID - 0.12, 0.09, 0.02, black, ty);
	eye(b, 0.82, MID + 0.07, 0.045, 0.1, '#202838');
	b.push(bx(0.89, 0.48, MID + 0.01, 0.03, 0.04, 0.025, body));
	// Pectoral fin with a yellow tip.
	b.push(bx(0.7, 0.56, MID - 0.03 + sw * 0.01, 0.07, 0.008, 0.06, body), bx(0.66, 0.56, MID - 0.03, 0.04, 0.008, 0.06, tail));
	return b;
}

function angelfish(sp: Species, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const bar = sp.pattern === 'vbands' || sp.pattern === 'zebra' ? (sp.pcolor ?? '#202028') : null;
	const b: Box[] = [];
	const sw = swishOf(phase);
	const N = 10;
	const x0 = 0.3;
	const x1 = 0.88;
	const dx = (x1 - x0) / N;
	const bars = new Set([1, 4, 8]);
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		// Diamond-ish: deepest a little behind the middle, pointed at the snout.
		const hz = 0.05 + 0.15 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.9;
		const d = 0.05 + hz * 0.3;
		const col = bar && bars.has(i) ? bar : body;
		const segs: Seg[] = sp.pattern === 'marble' || sp.pattern === 'calico'
			? [[0, 0.4, belly], [0.4, 0.7, i % 3 === 1 ? (sp.pcolor ?? '#222') : body], [0.7, 1, i % 4 === 2 ? (sp.pcolor ?? '#222') : body]]
			: [[0, 0.35, bar && bars.has(i) ? bar : belly], [0.35, 1, col]];
		slice(b, x0 + i * dx, dx, MID - hz, MID + hz, d, segs);
	}
	// The tall sail fins, swept back, banded where the bars run through them.
	for (let k = 0; k < 6; k++) {
		const w = 0.16 - k * 0.015;
		const x = 0.5 - k * 0.04;
		const z = MID + 0.17 + k * 0.06;
		fin(b, x, z, w, 0.06, bar && k % 2 ? bar : finC);
		fin(b, x - 0.01, MID - 0.23 - k * 0.06, w, 0.06, bar && k % 2 ? bar : finC);
	}
	// Long ventral filaments trailing down from the chest.
	b.push(bx(0.66, 0.5, MID - 0.42, 0.015, 0.02, 0.28, finC), bx(0.68, 0.5, MID - 0.38, 0.015, 0.02, 0.24, finC));
	// Tail: a fan with trailing tips.
	const ty = 0.475 + sw * 0.04;
	fin(b, 0.2, MID - 0.08, 0.1, 0.16, finC, ty);
	fin(b, 0.13, MID - 0.12, 0.08, 0.24, finC, ty);
	fin(b, 0.1, MID + 0.12, 0.04, 0.05, finC, ty);
	fin(b, 0.1, MID - 0.17, 0.04, 0.05, finC, ty);
	eye(b, 0.81, MID + 0.05, 0.045, 0.09, '#d83a2a');
	return b;
}

/**
 * Stingrays: a flat round disc lying on the sand, seen a little from above so the spots on its
 * back show, with the wing edges rippling and a long whip tail. Eagle rays have pointed wings.
 */
function ray(sp: Species, phase: number): Box[] {
	const [body, belly, fin] = sp.colors;
	const pc = sp.pcolor ?? '#f4f0e0';
	const out: Box[] = [];
	const eagle = sp.sci.startsWith('Aetobatus');
	const N = 12;
	const x0 = 0.3;
	const x1 = 0.92;
	const dx = (x1 - x0) / N;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		// Width across the disc: round for river rays, a broad diamond of wings for eagle rays.
		const half = eagle ? 0.42 * (1 - Math.abs(u - 0.55) / 0.55) ** 0.6 : 0.3 * Math.sin(Math.PI * u) ** 0.55;
		const ripple = Math.sin(phase * Math.PI * 2 + u * 6) * 0.012;
		const x = x0 + i * dx;
		const h = 0.035 + Math.sin(Math.PI * u) * 0.025;
		const z = eagle ? 0.28 + ripple * 2 : 0.04;
		out.push(bx(x, 0.5 - half, z + ripple, dx + 0.002, half * 2, h * 0.4, belly));
		out.push(bx(x, 0.5 - half, z + ripple + h * 0.4, dx + 0.002, half * 2, h * 0.6, body));
		// Spots on the back.
		if (sp.pattern !== 'none' && half > 0.06) {
			for (let k = 0; k < 3; k++) {
				const yy = 0.5 - half * 0.75 + ((i * 7 + k * 5) % 9) / 9 * half * 1.5;
				if ((i + k) % 2 === 0) out.push(bx(x + dx * 0.2, yy, z + ripple + h, dx * 0.6, 0.035, 0.004, pc));
			}
		}
	}
	// Eyes on top near the front, the tail whip behind.
	const ez = (eagle ? 0.28 : 0.04) + 0.06;
	out.push(bx(x1 - 0.12, 0.44, ez, 0.025, 0.025, 0.02, '#1a1a1a'), bx(x1 - 0.12, 0.535, ez, 0.025, 0.025, 0.02, '#1a1a1a'));
	if (eagle) out.push(bx(x1, 0.47, 0.28, 0.06, 0.06, 0.04, body));
	const sw = swishOf(phase);
	for (let s = 0; s < 6; s++) out.push(bx(x0 - (s + 1) * 0.045, 0.49 + sw * 0.02 * s * 0.3, (eagle ? 0.29 : 0.05) + 0.004, 0.047, 0.02, 0.014, s === 1 ? '#d8d0b0' : fin));
	return out;
}

/**
 * Seahorses swim upright: a curled tail at the bottom, a round belly, a bent neck and a long
 * snout pointing forward, with a little fluttering fin on the back. Seadragons are longer and
 * wear leafy (or weedy) flaps.
 */
function seahorse(sp: Species, phase: number): Box[] {
	const [body, belly, fin] = sp.colors;
	const pc = sp.pcolor ?? '#f4f0e0';
	const out: Box[] = [];
	const dragon = /^(Phycodurus|Phyllopteryx)/.test(sp.sci);
	const leafy = sp.sci.startsWith('Phycodurus');
	const bob = Math.sin(phase * Math.PI * 2) * 0.01;
	const d = 0.07;
	const seg = (x: number, z: number, w: number, h: number, col: string) => out.push(bx(x, 0.5 - d / 2, z + bob, w, d, h, col));
	if (!dragon) {
		// Body stacked from the tail up; it leans forward slightly as it rises.
		const rows: [number, number, number][] = [
			// [x of the front edge, width, z]
			[0.5, 0.05, 0.12],
			[0.52, 0.07, 0.17],
			[0.56, 0.1, 0.22],
			[0.6, 0.13, 0.27],
			[0.62, 0.14, 0.32],
			[0.62, 0.13, 0.37],
			[0.6, 0.1, 0.42],
			[0.58, 0.08, 0.47],
			[0.6, 0.09, 0.52]
		];
		rows.forEach(([fx, w, z], i) => {
			seg(fx - w, z, w, 0.052, i % 2 && sp.pattern !== 'none' ? pc : body);
			if (i >= 2 && i <= 6) seg(fx - 0.03, z, 0.03, 0.052, belly);
		});
		// Curled tail.
		seg(0.46, 0.08, 0.04, 0.045, body);
		seg(0.42, 0.05, 0.05, 0.04, body);
		seg(0.4, 0.09, 0.03, 0.04, body);
		seg(0.43, 0.12, 0.03, 0.025, body);
		// Head and snout, crown on top.
		seg(0.52, 0.56, 0.1, 0.06, body);
		seg(0.62, 0.565, 0.12, 0.03, body);
		seg(0.72, 0.56, 0.025, 0.04, body);
		seg(0.54, 0.62, 0.04, 0.035, fin);
		// Fluttering back fin.
		out.push(bx(0.44 + Math.sin(phase * Math.PI * 8) * 0.008, 0.48, 0.32 + bob, 0.05, 0.04, 0.08, fin, 0.8));
		eye(out, 0.585, 0.59 + bob, 0.03, d, '#f0e0a0');
		return out;
	}
	// Seadragon: long and slender, held almost level, with leafy appendages.
	const N = 12;
	for (let i = 0; i < N; i++) {
		const u = i / N;
		const x = 0.12 + u * 0.66;
		const z = 0.3 + Math.sin(u * Math.PI * 1.2) * 0.04;
		const h = 0.04 + Math.sin(Math.PI * Math.min(1, u * 1.4)) * 0.035;
		seg(x, z - h / 2, 0.057, h, i % 3 === 1 ? pc : body);
		if (i % 2 === 0) {
			const leaf = leafy ? 0.09 : 0.05;
			out.push(bx(x, 0.47, z + h / 2 + bob, 0.04, 0.06, leaf, fin, 0.85));
			out.push(bx(x + 0.01, 0.47, z - h / 2 - leaf * 0.8 + bob, 0.04, 0.06, leaf * 0.8, fin, 0.85));
		}
	}
	seg(0.78, 0.31, 0.05, 0.05, body);
	seg(0.83, 0.32, 0.12, 0.022, body);
	eye(out, 0.8, 0.345 + bob, 0.025, d, '#f0d080');
	return out;
}

// ── The clean-up crew ───────────────────────────────────────────────────────────────

/**
 * Shrimp, side-on: an arched, segmented body with a fan tail, a pointed rostrum and long
 * feelers, walking legs and swimmerets underneath that paddle as it moves.
 */
function shrimp(sp: Species, phase: number): Box[] {
	const [body, belly, fin] = sp.colors;
	const pc = sp.pcolor ?? body;
	const out: Box[] = [];
	const big = sp.size !== 'S';
	const bamboo = sp.sci.startsWith('Atyopsis') || sp.sci.startsWith('Atya');
	const sw = swishOf(phase);
	const d = 0.12;
	// The arch: low at the tail, highest over the middle, the head a little lower and longer.
	const N = 10;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		const x = 0.22 + i * 0.065;
		const lift = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.08;
		const h = 0.05 + Math.sin(Math.PI * Math.min(1, u * 1.05)) * 0.07;
		const z0 = 0.1 + lift - h * 0.3;
		let top = body;
		if (sp.pattern === 'vbands' && i % 3 !== 2) top = pc;
		if (sp.pattern === 'zebra' && i % 2) top = pc;
		slice(out, x, 0.065, z0, z0 + h, d, [
			[0, 0.4, belly],
			[0.4, 1, top]
		]);
		// Cleaner and fire shrimp: a white stripe down the back; others: segment lines.
		if (sp.pattern === 'split') out.push(bx(x, 0.5 - d * 0.2, z0 + h, 0.066, d * 0.4, 0.01, pc));
		else if (i % 2 === 0 && i < 7) out.push(bx(x, 0.5 + d / 2, z0 + h * 0.5, 0.008, 0.004, h * 0.5, belly));
		if (sp.pattern === 'spots' && i % 3 === 1) out.push(bx(x + 0.02, 0.5 + d / 2, z0 + h * 0.55, 0.025, 0.004, 0.02, pc));
		if (sp.pattern === 'hstripes') out.push(bx(x, 0.5 + d / 2, z0 + h * 0.55, 0.066, 0.004, 0.012, pc));
		// Swimmerets under the tail half, legs under the head half.
		if (i >= 2 && i <= 5) out.push(bx(x + 0.02, 0.49, z0 - 0.03 + Math.sin(phase * Math.PI * 6 + i) * 0.006, 0.02, 0.02, 0.03, fin, 0.85));
		if (i >= 6 && i <= 8) {
			const step = Math.sin(phase * Math.PI * 4 + i * 2) * 0.012;
			out.push(bx(x + 0.01 + step, 0.5 + d / 2 - 0.02, 0.03, 0.012, 0.012, Math.max(0.01, z0 - 0.03), fin));
		}
	}
	// Tail fan.
	out.push(bx(0.12, 0.47, 0.06 + sw * 0.01, 0.1, 0.06, 0.08, fin), bx(0.08, 0.47, 0.04 + sw * 0.01, 0.06, 0.06, 0.04, fin));
	// Rostrum, eye and feelers.
	const hx = 0.22 + N * 0.065;
	out.push(bx(hx - 0.01, 0.48, 0.17, 0.08, 0.04, 0.02, body));
	eye(out, hx - 0.06, 0.2, 0.035, d, '#141418');
	const ant = big ? 0.32 : 0.42;
	out.push(bx(hx, 0.5, 0.2 + sw * 0.01, ant, 0.01, 0.01, fin), bx(hx, 0.47, 0.22 - sw * 0.01, ant * 0.8, 0.01, 0.01, fin));
	if (bamboo) {
		// Fan feeders: little feathery fans held forward.
		out.push(bx(hx - 0.02, 0.52, 0.04, 0.05, 0.02, 0.06, lighten(fin, 1.2)));
	} else if (sp.sci.startsWith('Stenopus')) {
		// Coral banded: long banded claws.
		for (let k = 0; k < 4; k++) out.push(bx(hx - 0.05 + k * 0.06, 0.53, 0.09, 0.06, 0.03, 0.03, k % 2 ? pc : body));
		out.push(bx(hx + 0.19, 0.53, 0.07, 0.05, 0.03, 0.06, pc));
	}
	return out;
}

/**
 * Snails glide on a pale foot with two feelers, under their shell: a dome for nerites, an
 * apple-round shell for mystery snails, a flat coil for ramshorns, a tall cone for trumpet,
 * cerith and rabbit snails, a flared conch, and a glossy egg for cowries.
 */
function snail(sp: Species, phase: number): Box[] {
	const [shell, foot, trim] = sp.colors;
	const pc = sp.pcolor ?? trim;
	const out: Box[] = [];
	const g = sp.sci;
	const kind = /^(Melanoides|Tylomelania|Cerithium|Nassarius|Engina)/.test(g)
		? 'cone'
		: g.startsWith('Planorbella')
			? 'coil'
			: g.startsWith('Cypraea')
				? 'cowrie'
				: g.startsWith('Strombus')
					? 'conch'
					: /^(Pomacea|Cipangopaludina|Turbo)/.test(g)
						? 'round'
						: 'dome';
	const creep = Math.sin(phase * Math.PI * 2) * 0.01;
	const d = 0.3;
	// The foot along the ground, with feelers at the front.
	const footC = kind === 'cowrie' ? trim : lighten(foot, 1.25);
	out.push(bx(0.25, 0.5 - d * 0.35, 0.04, 0.6 + creep, d * 0.7, 0.04, footC));
	out.push(bx(0.82 + creep, 0.48, 0.08, 0.015, 0.015, 0.08, footC), bx(0.82 + creep, 0.53, 0.08, 0.015, 0.015, 0.07, footC));
	const band = (i: number) => (sp.pattern === 'zebra' || sp.pattern === 'vbands' ? (i % 2 ? pc : shell) : shell);
	if (kind === 'dome' || kind === 'round') {
		const tall = kind === 'round' ? 0.32 : 0.2;
		const w = kind === 'round' ? 0.44 : 0.46;
		const N = 7;
		for (let i = 0; i < N; i++) {
			const u = (i + 0.5) / N;
			const h = tall * Math.sin(Math.PI * u) ** 0.4;
			const dd = d * (0.6 + 0.4 * Math.sin(Math.PI * u));
			out.push(bx(0.24 + (i * w) / N, 0.5 - dd / 2, 0.07, w / N + 0.002, dd, h, band(i)));
		}
		// The spiral at the back, and the horns of horned nerites.
		out.push(bx(0.24, 0.5 + d * 0.28, 0.07 + tall * 0.45, 0.08, 0.02, 0.08, lighten(shell, 0.7)));
		if (g.startsWith('Clithon')) for (let k = 0; k < 3; k++) out.push(bx(0.3 + k * 0.12, 0.5, 0.07 + tall * 0.85, 0.02, 0.02, 0.07, '#1a1408'));
		if (sp.pattern === 'marble' || sp.pattern === 'spots') for (let k = 0; k < 4; k++) out.push(bx(0.3 + k * 0.09, 0.5 + d * 0.28, 0.1 + ((k * 7) % 4) * 0.035, 0.04, 0.02, 0.03, pc));
		if (sp.pattern === 'hstripes') out.push(bx(0.26, 0.5 + d * 0.28, 0.07 + tall * 0.5, w - 0.04, 0.02, 0.02, pc));
	} else if (kind === 'coil') {
		// A flat coil standing on edge, like a horn.
		const r = 0.17;
		const N = 8;
		for (let i = 0; i < N; i++) {
			const v = ((i + 0.5) / N) * 2 - 1;
			const h = 2 * r * Math.sqrt(1 - v * v);
			out.push(bx(0.28 + (i * 2 * r) / N, 0.44, 0.08 + r - h / 2, (2 * r) / N + 0.002, 0.12, h, shell));
		}
		// The coil's grooves, spiralling in to the middle.
		out.push(bx(0.36, 0.56, 0.12, 0.18, 0.004, 0.02, lighten(shell, 0.7)), bx(0.36, 0.56, 0.32, 0.18, 0.004, 0.02, lighten(shell, 0.7)));
		out.push(bx(0.42, 0.56, 0.19, 0.06, 0.004, 0.06, lighten(shell, 0.6)));
	} else if (kind === 'cone') {
		// A tall spire tilted back over the tail.
		const N = 6;
		for (let i = 0; i < N; i++) {
			const w = 0.26 - i * 0.035;
			out.push(bx(0.42 - i * 0.05, 0.5 - w * 0.5, 0.07 + i * 0.05, w, w, 0.055, band(i)));
			if (sp.pattern === 'spots' && i % 2) out.push(bx(0.45 - i * 0.05, 0.5 + w * 0.5, 0.09 + i * 0.05, 0.03, 0.004, 0.02, pc));
			if (sp.pattern === 'hstripes') out.push(bx(0.42 - i * 0.05, 0.5 + w * 0.5, 0.1 + i * 0.05, w, 0.004, 0.012, pc));
		}
	} else if (kind === 'conch') {
		out.push(bx(0.22, 0.38, 0.07, 0.5, 0.24, 0.16, shell), bx(0.3, 0.42, 0.23, 0.3, 0.16, 0.08, lighten(shell, 0.9)));
		out.push(bx(0.36, 0.44, 0.31, 0.14, 0.1, 0.06, lighten(shell, 0.8)), bx(0.6, 0.36, 0.07, 0.16, 0.06, 0.2, trim));
		out.push(bx(0.72, 0.5, 0.1, 0.06, 0.04, 0.06, '#e8c818'));
	} else {
		// Cowrie: a glossy spotted egg.
		const N = 7;
		for (let i = 0; i < N; i++) {
			const u = (i + 0.5) / N;
			const h = 0.24 * Math.sin(Math.PI * u) ** 0.5;
			out.push(bx(0.22 + i * 0.07, 0.5 - d * 0.45, 0.06, 0.072, d * 0.9, h, shell));
			if (i % 2 === 0) out.push(bx(0.24 + i * 0.07, 0.5 + d * 0.45, 0.1 + (i % 3) * 0.04, 0.035, 0.004, 0.035, pc));
			if (i % 3 === 1) out.push(bx(0.25 + i * 0.07, 0.5 + d * 0.45, 0.07 + h * 0.6, 0.03, 0.004, 0.03, pc));
		}
		out.push(bx(0.3, 0.5 - d * 0.2, 0.3, 0.3, d * 0.4, 0.008, lighten(shell, 1.3)));
	}
	return out;
}

/**
 * Crabs scuttle on their legs with two claws held up front: emerald and sally lightfoot crabs
 * show their flat shell; hermit crabs wear a borrowed snail shell on their back.
 */
function crab(sp: Species, phase: number): Box[] {
	const [body, belly, legC] = sp.colors;
	const pc = sp.pcolor ?? legC;
	const out: Box[] = [];
	const hermit = /^(Clibanarius|Paguristes|Ciliopagurus)/.test(sp.sci);
	const step = (k: number) => Math.sin(phase * Math.PI * 4 + k * 1.7) * 0.02;
	const d = 0.32;
	if (hermit) {
		// The borrowed shell, the crab peeking out the front.
		for (let i = 0; i < 5; i++) {
			const w = 0.3 - i * 0.05;
			out.push(bx(0.2 + i * 0.02, 0.5 - w / 2, 0.1 + i * 0.06, 0.34 - i * 0.05, w, 0.065, i % 2 ? '#c8b898' : '#a89878'));
		}
		out.push(bx(0.52, 0.4, 0.08, 0.14, 0.2, 0.12, body));
		for (let k = 0; k < 3; k++) out.push(bx(0.58 + k * 0.06 + step(k), 0.58, 0.03, 0.025, 0.03, 0.09, sp.pattern === 'vbands' && k % 2 ? pc : legC));
		out.push(bx(0.66, 0.4, 0.12, 0.12, 0.08, 0.07, body), bx(0.66, 0.54, 0.1, 0.1, 0.06, 0.06, body));
		eye(out, 0.64, 0.2, 0.03, 0.1, '#141418');
		out.push(bx(0.64, 0.5, 0.2, 0.012, 0.012, 0.06, legC));
		return out;
	}
	// A broad flat shell seen side-on, legs splayed underneath.
	const N = 6;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		const h = 0.07 + Math.sin(Math.PI * u) * 0.05;
		out.push(bx(0.3 + i * 0.07, 0.5 - d / 2, 0.08, 0.072, d, h * 0.4, belly));
		out.push(bx(0.3 + i * 0.07, 0.5 - d / 2, 0.08 + h * 0.4, 0.072, d, h * 0.6, body));
		if (sp.pattern === 'hstripes' && i % 2) out.push(bx(0.3 + i * 0.07, 0.5 + d / 2, 0.1, 0.06, 0.004, 0.02, pc));
	}
	for (let k = 0; k < 4; k++) {
		const lx = 0.28 + k * 0.11 + step(k);
		out.push(bx(lx, 0.5 + d / 2 - 0.02, 0.03, 0.02, 0.03, 0.06, legC), bx(lx - 0.04, 0.5 + d / 2, 0.0, 0.05, 0.02, 0.035, legC));
	}
	// Claws.
	out.push(bx(0.72, 0.44, 0.1, 0.1, 0.1, 0.06, legC), bx(0.8, 0.44, 0.1 + step(9) * 0.5, 0.06, 0.1, 0.09, lighten(legC, 1.1)));
	eye(out, 0.68, 0.2, 0.03, 0.12, '#141418');
	out.push(bx(0.67, 0.5, 0.17, 0.012, 0.012, 0.04, body));
	return out;
}

const lighten = (hex: string, f: number) => {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
	return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
};

// ── The mythic easter eggs ──────────────────────────────────────────────────────────

/**
 * Magikarp: Frogger's own model, exactly, but turned to stand the right way up for swimming in
 * a tank: belly down, its crown fin along the top, and its flank (with the eye and side fin)
 * facing the glass. Frogger lies it flat; FishMart sits it on its belly. The shiny one is the
 * same model with every bit of orange turned yellow.
 */
const SHINY: Record<string, string> = { '#ee5a2c': '#ffd23a', '#c9381e': '#e0a818', '#e8462a': '#f0b020' };
function magikarp(sp: Species): Box[] {
	const shiny = sp.id === 'shiny-magikarp';
	// Frogger's model: x across (belly → back), y along (head → tail), z up out of its flank.
	// Here: x along (tail → head), z up (belly → back), y toward the viewer (the flank).
	const boxes = magikarpModel().map((b) => ({ ...b, x: 1 - (b.y + b.d), w: b.d, y: b.z, d: b.h, z: b.x, h: b.w, c: (shiny && SHINY[b.c]) || b.c }));
	// Centre it: its middle at MID, its thickness around the middle of the tile.
	const z0 = Math.min(...boxes.map((b) => b.z));
	const z1 = Math.max(...boxes.map((b) => b.z + b.h));
	const y1 = Math.max(...boxes.map((b) => b.y + b.d));
	return boxes.map((b) => ({ ...b, z: b.z + MID - (z0 + z1) / 2, y: b.y + 0.5 - y1 / 2 }));
}

/**
 * Stockfish: a fish carved as a chess knight. A white Staunton knight swims upright: a round
 * weighted base with a checkered band and green felt, a curved neck with a ridged mane, a long
 * horse's head with ears and a nostril, and little fins (a back fin along the mane, a side fin
 * at the chest and a fan tail out behind the base) so it can swim.
 */
function stockfish(_sp: Species, phase: number): Box[] {
	const out: Box[] = [];
	const ivory = '#efe6d2';
	const shadow = '#d6cab0';
	const ink = '#22222a';
	const felt = '#2f6b3a';
	const fin = '#9fd4e8';
	const sw = swishOf(phase);
	const d = 0.3;
	const y = 0.5 - d / 2;
	const disc = (x: number, w: number, z: number, h: number, col: string, dd = d) => out.push(bx(x, 0.5 - dd / 2, z, w, dd, h, col));
	// The base: felt, a black-and-white checkered band, a collar.
	disc(0.26, 0.5, 0.02, 0.02, felt, d + 0.04);
	disc(0.26, 0.5, 0.04, 0.07, ivory, d + 0.04);
	for (let i = 0; i < 6; i++) out.push(bx(0.27 + i * 0.08, 0.5 + (d + 0.04) / 2 + 0.002, 0.06, 0.08, 0.004, 0.03, i % 2 ? ink : ivory));
	disc(0.3, 0.42, 0.11, 0.04, shadow, d);
	disc(0.33, 0.36, 0.15, 0.04, ivory, d - 0.04);
	// The neck rising from the base and curving forward, chest out in front.
	const neck: [number, number, number][] = [
		// [left edge (the mane side), right edge (the chest), z]
		[0.34, 0.64, 0.19],
		[0.33, 0.66, 0.24],
		[0.33, 0.67, 0.29],
		[0.34, 0.66, 0.34],
		[0.35, 0.64, 0.39],
		[0.37, 0.64, 0.44]
	];
	for (const [a, b, z] of neck) out.push(bx(a, y + 0.03, z, b - a, d - 0.06, 0.055, ivory));
	// The head: long, reaching forward and a little down, the muzzle squared off.
	out.push(bx(0.38, y + 0.04, 0.48, 0.3, d - 0.08, 0.07, ivory));
	out.push(bx(0.4, y + 0.04, 0.55, 0.3, d - 0.08, 0.06, ivory));
	out.push(bx(0.62, y + 0.05, 0.43, 0.2, d - 0.1, 0.1, ivory));
	out.push(bx(0.42, y + 0.04, 0.61, 0.2, d - 0.08, 0.04, ivory));
	// Ears.
	out.push(bx(0.43, 0.48, 0.65, 0.04, 0.06, 0.06, ivory), bx(0.5, 0.48, 0.65, 0.04, 0.06, 0.05, shadow));
	// The mouth line, nostril and eye on the near side.
	const near = 0.5 + (d - 0.08) / 2 + 0.003;
	out.push(bx(0.68, near, 0.455, 0.14, 0.004, 0.012, ink));
	out.push(bx(0.77, near, 0.5, 0.025, 0.004, 0.02, ink));
	out.push(bx(0.55, near, 0.56, 0.035, 0.004, 0.035, ink), bx(0.56, near + 0.002, 0.575, 0.012, 0.004, 0.012, '#ffffff'));
	// The mane: carved ridges down the back of the neck, with a fin along it.
	for (let i = 0; i < 6; i++) out.push(bx(0.32, 0.5 - 0.04, 0.24 + i * 0.065, 0.035, 0.08, 0.035, i % 2 ? shadow : ivory));
	for (let i = 0; i < 5; i++) out.push(bx(0.27 + Math.sin(phase * Math.PI * 2 + i) * 0.006, 0.48, 0.26 + i * 0.07, 0.05, 0.04, 0.05, fin));
	// A side fin at the chest and a fan tail out behind the base.
	out.push(bx(0.5, near + 0.004, 0.27 + sw * 0.01, 0.1, 0.006, 0.06, fin));
	for (let s = 0; s < 3; s++) out.push(bx(0.22 - (s + 1) * 0.04, 0.475 + sw * 0.03, 0.12 - s * 0.025, 0.042, 0.05, 0.1 + s * 0.05, fin));
	return out;
}
