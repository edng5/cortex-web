// Fish body plans: how each family of fish is really shaped, built as voxel models. Every species
// is matched to a plan by its scientific name (genus), so a tetra, a pleco, a goldfish, a wrasse
// and a triggerfish each get their family's real outline, fins, tail and features, painted in the
// species' own colours and pattern. A handful of iconic fish have fully hand-built models
// (fishModels.ts) on top of this.
//
// Tile units as in fishArt: x along the fish (tail at 0, nose at 1), y across (viewer at larger
// y), z up, with the middle of the body at MID.
import { bx, type Box } from '../voxel';
import type { Species } from './data';

const MID = 0.32;
type FinShape = 'tri' | 'rounded' | 'long' | 'sail' | 'spiny' | 'flow';
interface Fin {
	/** Start (tail end) and width along the fish, and height. */
	x: number;
	w: number;
	h: number;
	shape: FinShape;
}
type Tail = 'fork' | 'round' | 'fan' | 'lunate' | 'lyre' | 'double' | 'sword' | 'small' | 'shark' | 'ribbon' | 'truncate' | 'none';
type Extra =
	| 'barbels'
	| 'longBarbels'
	| 'sucker'
	| 'hump'
	| 'wen'
	| 'telescope'
	| 'bubbles'
	| 'celestial'
	| 'pompom'
	| 'horn'
	| 'trigger'
	| 'adipose'
	| 'filament'
	| 'trunk'
	| 'lure'
	| 'spines'
	| 'teeth'
	| 'lips'
	| 'ear'
	| 'whiskerFringe'
	| 'tufts'
	| 'keel'
	| 'transparent'
	| 'lionSpines'
	| 'gape';
interface Plan {
	x0: number;
	x1: number;
	/** Back and belly heights at their deepest, where the deepest point is (0–1 along the body), how deep the tail base is, and how blunt the head is. */
	top: number;
	bot: number;
	peak?: number;
	base?: number;
	nose?: number;
	/** Thickness, side to side, as a share of height. */
	thick?: number;
	/** Rests its flat belly on the bottom. */
	flat?: boolean;
	dorsal?: Fin[];
	anal?: Fin[];
	tail: Tail;
	tailSize?: number;
	pect?: number;
	ventral?: number;
	eye?: number;
	snout?: number;
	extras?: Extra[];
}

const P: Record<string, Plan> = {
	tetra: { x0: 0.2, x1: 0.92, top: 0.15, bot: 0.12, peak: 0.55, dorsal: [{ x: 0.48, w: 0.1, h: 0.08, shape: 'tri' }], anal: [{ x: 0.3, w: 0.2, h: 0.06, shape: 'long' }], tail: 'fork', eye: 0.075, extras: ['adipose'] },
	hatchet: { x0: 0.22, x1: 0.92, top: 0.06, bot: 0.24, peak: 0.6, base: 0.3, dorsal: [{ x: 0.32, w: 0.08, h: 0.06, shape: 'tri' }], anal: [{ x: 0.25, w: 0.18, h: 0.05, shape: 'long' }], tail: 'fork', eye: 0.08, pect: 0.1, extras: ['keel'] },
	barb: { x0: 0.2, x1: 0.92, top: 0.2, bot: 0.15, peak: 0.55, dorsal: [{ x: 0.48, w: 0.12, h: 0.1, shape: 'tri' }], anal: [{ x: 0.33, w: 0.1, h: 0.06, shape: 'tri' }], tail: 'fork', eye: 0.065, extras: ['barbels'] },
	danio: { x0: 0.18, x1: 0.94, top: 0.1, bot: 0.09, peak: 0.55, dorsal: [{ x: 0.36, w: 0.1, h: 0.06, shape: 'tri' }], anal: [{ x: 0.3, w: 0.14, h: 0.05, shape: 'long' }], tail: 'fork', eye: 0.06 },
	sharkminnow: { x0: 0.18, x1: 0.95, top: 0.13, bot: 0.1, peak: 0.5, dorsal: [{ x: 0.5, w: 0.12, h: 0.13, shape: 'tri' }], anal: [{ x: 0.3, w: 0.08, h: 0.05, shape: 'tri' }], tail: 'fork', tailSize: 1.2, eye: 0.05, extras: ['barbels'] },
	guppy: { x0: 0.38, x1: 0.94, top: 0.1, bot: 0.09, peak: 0.6, dorsal: [{ x: 0.44, w: 0.12, h: 0.08, shape: 'flow' }], anal: [{ x: 0.42, w: 0.05, h: 0.04, shape: 'tri' }], tail: 'fan', tailSize: 1.9, eye: 0.06 },
	livebearer: { x0: 0.22, x1: 0.92, top: 0.15, bot: 0.13, peak: 0.55, dorsal: [{ x: 0.45, w: 0.16, h: 0.09, shape: 'rounded' }], anal: [{ x: 0.36, w: 0.06, h: 0.05, shape: 'tri' }], tail: 'round', eye: 0.06 },
	swordtail: { x0: 0.22, x1: 0.92, top: 0.13, bot: 0.11, peak: 0.55, dorsal: [{ x: 0.45, w: 0.16, h: 0.08, shape: 'rounded' }], anal: [{ x: 0.36, w: 0.06, h: 0.05, shape: 'tri' }], tail: 'sword', eye: 0.06 },
	sailfin: { x0: 0.22, x1: 0.92, top: 0.15, bot: 0.13, peak: 0.55, dorsal: [{ x: 0.3, w: 0.42, h: 0.2, shape: 'sail' }], anal: [{ x: 0.36, w: 0.06, h: 0.05, shape: 'tri' }], tail: 'round', eye: 0.06 },
	betta: { x0: 0.3, x1: 0.92, top: 0.11, bot: 0.11, peak: 0.55, dorsal: [{ x: 0.32, w: 0.2, h: 0.2, shape: 'flow' }], anal: [{ x: 0.3, w: 0.42, h: 0.24, shape: 'flow' }], tail: 'fan', tailSize: 2, eye: 0.055, ventral: 0.15 },
	plakat: { x0: 0.25, x1: 0.92, top: 0.12, bot: 0.12, peak: 0.55, dorsal: [{ x: 0.35, w: 0.15, h: 0.1, shape: 'rounded' }], anal: [{ x: 0.3, w: 0.35, h: 0.1, shape: 'long' }], tail: 'round', tailSize: 1.2, eye: 0.055 },
	gourami: { x0: 0.22, x1: 0.9, top: 0.17, bot: 0.17, peak: 0.5, dorsal: [{ x: 0.3, w: 0.18, h: 0.08, shape: 'rounded' }], anal: [{ x: 0.24, w: 0.5, h: 0.1, shape: 'long' }], tail: 'round', eye: 0.06, ventral: 0.3, thick: 0.3 },
	cichlid: { x0: 0.2, x1: 0.93, top: 0.18, bot: 0.15, peak: 0.55, nose: 0.35, dorsal: [{ x: 0.3, w: 0.5, h: 0.08, shape: 'spiny' }, { x: 0.22, w: 0.12, h: 0.12, shape: 'rounded' }], anal: [{ x: 0.23, w: 0.2, h: 0.1, shape: 'rounded' }], tail: 'round', eye: 0.06, pect: 0.08, extras: ['lips'] },
	dwarfcichlid: { x0: 0.2, x1: 0.93, top: 0.16, bot: 0.13, peak: 0.55, dorsal: [{ x: 0.3, w: 0.52, h: 0.1, shape: 'spiny' }, { x: 0.22, w: 0.12, h: 0.14, shape: 'rounded' }], anal: [{ x: 0.23, w: 0.2, h: 0.1, shape: 'rounded' }], tail: 'round', eye: 0.06, ventral: 0.1 },
	frontosa: { x0: 0.2, x1: 0.93, top: 0.2, bot: 0.15, peak: 0.6, nose: 0.4, dorsal: [{ x: 0.3, w: 0.5, h: 0.08, shape: 'spiny' }, { x: 0.22, w: 0.12, h: 0.12, shape: 'rounded' }], anal: [{ x: 0.23, w: 0.2, h: 0.1, shape: 'rounded' }], tail: 'fork', eye: 0.06, extras: ['hump', 'lips'] },
	flowerhorn: { x0: 0.2, x1: 0.93, top: 0.2, bot: 0.16, peak: 0.55, nose: 0.4, dorsal: [{ x: 0.3, w: 0.5, h: 0.1, shape: 'spiny' }, { x: 0.2, w: 0.14, h: 0.16, shape: 'rounded' }], anal: [{ x: 0.22, w: 0.22, h: 0.14, shape: 'rounded' }], tail: 'round', tailSize: 1.2, eye: 0.06, extras: ['hump', 'lips'] },
	parrot: { x0: 0.22, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.5, nose: 0.6, dorsal: [{ x: 0.3, w: 0.45, h: 0.08, shape: 'long' }], anal: [{ x: 0.26, w: 0.2, h: 0.08, shape: 'rounded' }], tail: 'round', eye: 0.06, thick: 0.6 },
	bass: { x0: 0.18, x1: 0.95, top: 0.14, bot: 0.13, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.5, w: 0.25, h: 0.1, shape: 'spiny' }, { x: 0.28, w: 0.2, h: 0.09, shape: 'rounded' }], anal: [{ x: 0.25, w: 0.15, h: 0.08, shape: 'rounded' }], tail: 'truncate', eye: 0.05, extras: ['lips'] },
	pike: { x0: 0.15, x1: 0.96, top: 0.1, bot: 0.09, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.25, w: 0.55, h: 0.06, shape: 'long' }], anal: [{ x: 0.22, w: 0.14, h: 0.06, shape: 'rounded' }], tail: 'round', eye: 0.05 },
	pleco: { x0: 0.18, x1: 0.94, top: 0.13, bot: 0.06, peak: 0.75, nose: 0.7, base: 0.35, flat: true, dorsal: [{ x: 0.5, w: 0.2, h: 0.1, shape: 'rounded' }], anal: [], tail: 'lyre', eye: 0.045, pect: 0.12, extras: ['sucker', 'adipose'] },
	sailpleco: { x0: 0.18, x1: 0.94, top: 0.14, bot: 0.06, peak: 0.7, nose: 0.5, flat: true, dorsal: [{ x: 0.42, w: 0.32, h: 0.22, shape: 'sail' }], anal: [], tail: 'lyre', eye: 0.045, pect: 0.12, extras: ['sucker'] },
	hillstream: { x0: 0.2, x1: 0.9, top: 0.06, bot: 0.03, peak: 0.6, nose: 0.6, flat: true, thick: 2.5, dorsal: [{ x: 0.45, w: 0.12, h: 0.05, shape: 'rounded' }], tail: 'fork', eye: 0.04, pect: 0.16 },
	loach: { x0: 0.18, x1: 0.95, top: 0.1, bot: 0.08, peak: 0.5, nose: 0.5, dorsal: [{ x: 0.48, w: 0.1, h: 0.06, shape: 'tri' }], anal: [{ x: 0.3, w: 0.06, h: 0.04, shape: 'tri' }], tail: 'fork', eye: 0.04, extras: ['barbels'] },
	clownloach: { x0: 0.18, x1: 0.95, top: 0.16, bot: 0.12, peak: 0.55, nose: 0.45, dorsal: [{ x: 0.46, w: 0.12, h: 0.1, shape: 'tri' }], anal: [{ x: 0.3, w: 0.07, h: 0.05, shape: 'tri' }], tail: 'fork', tailSize: 1.2, eye: 0.045, extras: ['barbels'] },
	catfish: { x0: 0.18, x1: 0.95, top: 0.12, bot: 0.1, peak: 0.6, nose: 0.6, dorsal: [{ x: 0.58, w: 0.1, h: 0.12, shape: 'tri' }], anal: [{ x: 0.25, w: 0.12, h: 0.06, shape: 'long' }], tail: 'fork', tailSize: 1.2, eye: 0.045, extras: ['longBarbels', 'adipose'] },
	synodontis: { x0: 0.18, x1: 0.94, top: 0.15, bot: 0.1, peak: 0.65, nose: 0.55, dorsal: [{ x: 0.58, w: 0.1, h: 0.14, shape: 'tri' }], anal: [{ x: 0.3, w: 0.08, h: 0.06, shape: 'tri' }], tail: 'fork', tailSize: 1.2, eye: 0.05, extras: ['longBarbels', 'adipose'] },
	bigcatfish: { x0: 0.15, x1: 0.96, top: 0.13, bot: 0.11, peak: 0.6, nose: 0.75, dorsal: [{ x: 0.55, w: 0.1, h: 0.12, shape: 'tri' }], anal: [{ x: 0.25, w: 0.12, h: 0.07, shape: 'rounded' }], tail: 'fork', tailSize: 1.2, eye: 0.035, extras: ['longBarbels', 'adipose'] },
	twig: { x0: 0.2, x1: 0.98, top: 0.04, bot: 0.03, peak: 0.5, flat: true, dorsal: [{ x: 0.45, w: 0.06, h: 0.05, shape: 'tri' }], tail: 'fork', eye: 0.03, snout: 0.08 },
	glass: { x0: 0.2, x1: 0.94, top: 0.1, bot: 0.12, peak: 0.6, anal: [{ x: 0.2, w: 0.6, h: 0.05, shape: 'long' }], tail: 'fork', eye: 0.06, extras: ['transparent', 'longBarbels'] },
	rainbow: { x0: 0.2, x1: 0.92, top: 0.2, bot: 0.15, peak: 0.45, nose: 0.3, dorsal: [{ x: 0.5, w: 0.08, h: 0.08, shape: 'tri' }, { x: 0.28, w: 0.18, h: 0.08, shape: 'long' }], anal: [{ x: 0.26, w: 0.35, h: 0.08, shape: 'long' }], tail: 'fork', eye: 0.065, thick: 0.3 },
	killi: { x0: 0.2, x1: 0.94, top: 0.1, bot: 0.09, peak: 0.55, dorsal: [{ x: 0.26, w: 0.14, h: 0.08, shape: 'rounded' }], anal: [{ x: 0.26, w: 0.16, h: 0.08, shape: 'rounded' }], tail: 'round', tailSize: 1.2, eye: 0.06 },
	gar: { x0: 0.12, x1: 0.82, top: 0.08, bot: 0.07, peak: 0.5, nose: 0.6, dorsal: [{ x: 0.15, w: 0.1, h: 0.06, shape: 'rounded' }], anal: [{ x: 0.14, w: 0.1, h: 0.06, shape: 'rounded' }], tail: 'round', eye: 0.035, snout: 0.16, extras: ['teeth'] },
	needle: { x0: 0.15, x1: 0.85, top: 0.05, bot: 0.05, peak: 0.5, dorsal: [{ x: 0.17, w: 0.1, h: 0.05, shape: 'rounded' }], anal: [{ x: 0.17, w: 0.1, h: 0.05, shape: 'rounded' }], tail: 'truncate', eye: 0.035, snout: 0.14, extras: ['teeth'] },
	bichir: { x0: 0.15, x1: 0.95, top: 0.08, bot: 0.07, peak: 0.6, nose: 0.65, dorsal: [{ x: 0.2, w: 0.55, h: 0.07, shape: 'spiny' }], tail: 'round', eye: 0.04, pect: 0.13 },
	knife: { x0: 0.05, x1: 0.92, top: 0.1, bot: 0.12, peak: 0.6, base: 0.1, nose: 0.4, anal: [{ x: 0.1, w: 0.65, h: 0.07, shape: 'long' }], tail: 'none', eye: 0.035 },
	elephantnose: { x0: 0.2, x1: 0.88, top: 0.1, bot: 0.1, peak: 0.6, dorsal: [{ x: 0.24, w: 0.16, h: 0.06, shape: 'long' }], anal: [{ x: 0.24, w: 0.16, h: 0.06, shape: 'long' }], tail: 'fork', eye: 0.03, extras: ['trunk'] },
	butterflyfw: { x0: 0.25, x1: 0.9, top: 0.08, bot: 0.06, peak: 0.6, dorsal: [{ x: 0.3, w: 0.08, h: 0.05, shape: 'tri' }], anal: [{ x: 0.3, w: 0.12, h: 0.06, shape: 'flow' }], tail: 'fan', eye: 0.05, pect: 0.3 },
	archer: { x0: 0.2, x1: 0.92, top: 0.12, bot: 0.18, peak: 0.45, nose: 0.3, dorsal: [{ x: 0.3, w: 0.14, h: 0.08, shape: 'spiny' }], anal: [{ x: 0.28, w: 0.18, h: 0.09, shape: 'rounded' }], tail: 'truncate', eye: 0.065 },
	leaf: { x0: 0.25, x1: 0.92, top: 0.16, bot: 0.16, peak: 0.5, nose: 0.2, dorsal: [{ x: 0.3, w: 0.45, h: 0.06, shape: 'spiny' }], anal: [{ x: 0.3, w: 0.3, h: 0.06, shape: 'long' }], tail: 'round', eye: 0.05, snout: 0.05 },
	snakehead: { x0: 0.15, x1: 0.95, top: 0.1, bot: 0.1, peak: 0.5, nose: 0.6, dorsal: [{ x: 0.18, w: 0.6, h: 0.06, shape: 'long' }], anal: [{ x: 0.18, w: 0.4, h: 0.06, shape: 'long' }], tail: 'round', eye: 0.04 },
	piranha: { x0: 0.2, x1: 0.92, top: 0.22, bot: 0.2, peak: 0.5, nose: 0.5, dorsal: [{ x: 0.42, w: 0.12, h: 0.1, shape: 'tri' }], anal: [{ x: 0.24, w: 0.2, h: 0.08, shape: 'long' }], tail: 'fork', eye: 0.05, thick: 0.35, extras: ['adipose', 'teeth'] },
	arapaima: { x0: 0.12, x1: 0.96, top: 0.1, bot: 0.1, peak: 0.6, nose: 0.6, dorsal: [{ x: 0.13, w: 0.18, h: 0.06, shape: 'long' }], anal: [{ x: 0.13, w: 0.18, h: 0.06, shape: 'long' }], tail: 'round', eye: 0.03 },
	puffer: { x0: 0.25, x1: 0.88, top: 0.18, bot: 0.18, peak: 0.55, nose: 0.6, thick: 0.85, dorsal: [{ x: 0.3, w: 0.08, h: 0.07, shape: 'rounded' }], anal: [{ x: 0.3, w: 0.08, h: 0.07, shape: 'rounded' }], tail: 'small', eye: 0.07, pect: 0.07 },
	boxfish: { x0: 0.25, x1: 0.88, top: 0.16, bot: 0.16, peak: 0.5, base: 0.4, nose: 0.85, thick: 1, dorsal: [{ x: 0.3, w: 0.06, h: 0.06, shape: 'rounded' }], anal: [{ x: 0.3, w: 0.06, h: 0.06, shape: 'rounded' }], tail: 'fan', eye: 0.06 },
	goldfish: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.55, thick: 0.75, dorsal: [{ x: 0.45, w: 0.18, h: 0.12, shape: 'rounded' }], anal: [{ x: 0.35, w: 0.06, h: 0.07, shape: 'tri' }], tail: 'double', tailSize: 1.5, eye: 0.055 },
	ranchu: { x0: 0.3, x1: 0.86, top: 0.22, bot: 0.2, peak: 0.4, nose: 0.65, thick: 0.85, tail: 'double', tailSize: 1.1, eye: 0.05, extras: ['wen'] },
	oranda: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.6, thick: 0.75, dorsal: [{ x: 0.45, w: 0.18, h: 0.12, shape: 'rounded' }], tail: 'double', tailSize: 1.6, eye: 0.05, extras: ['wen'] },
	telescope: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.55, thick: 0.75, dorsal: [{ x: 0.45, w: 0.18, h: 0.12, shape: 'rounded' }], tail: 'double', tailSize: 1.6, eye: 0.08, extras: ['telescope'] },
	bubbleeye: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.6, thick: 0.75, tail: 'double', tailSize: 1.3, eye: 0.04, extras: ['bubbles'] },
	celestialeye: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.6, thick: 0.75, tail: 'double', tailSize: 1.3, eye: 0.05, extras: ['celestial'] },
	pompom: { x0: 0.3, x1: 0.88, top: 0.2, bot: 0.2, peak: 0.45, nose: 0.6, thick: 0.75, dorsal: [{ x: 0.45, w: 0.18, h: 0.12, shape: 'rounded' }], tail: 'double', tailSize: 1.4, eye: 0.05, extras: ['pompom'] },
	comet: { x0: 0.22, x1: 0.92, top: 0.15, bot: 0.13, peak: 0.5, dorsal: [{ x: 0.42, w: 0.2, h: 0.1, shape: 'rounded' }], anal: [{ x: 0.32, w: 0.06, h: 0.06, shape: 'tri' }], tail: 'fork', tailSize: 1.6, eye: 0.05 },
	koi: { x0: 0.18, x1: 0.94, top: 0.14, bot: 0.12, peak: 0.5, nose: 0.5, dorsal: [{ x: 0.3, w: 0.36, h: 0.07, shape: 'long' }], anal: [{ x: 0.28, w: 0.06, h: 0.06, shape: 'tri' }], tail: 'fork', tailSize: 1.2, eye: 0.04, pect: 0.08, extras: ['barbels'] },
	sunfish: { x0: 0.2, x1: 0.92, top: 0.2, bot: 0.17, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.3, w: 0.42, h: 0.08, shape: 'spiny' }], anal: [{ x: 0.25, w: 0.15, h: 0.08, shape: 'rounded' }], tail: 'truncate', eye: 0.05, extras: ['ear'] },
	stickleback: { x0: 0.2, x1: 0.94, top: 0.11, bot: 0.1, peak: 0.55, dorsal: [{ x: 0.3, w: 0.12, h: 0.06, shape: 'rounded' }], anal: [{ x: 0.3, w: 0.1, h: 0.05, shape: 'rounded' }], tail: 'truncate', eye: 0.055, extras: ['spines'] },
	sturgeon: { x0: 0.12, x1: 0.86, top: 0.09, bot: 0.08, peak: 0.5, flat: true, dorsal: [{ x: 0.22, w: 0.1, h: 0.08, shape: 'tri' }], tail: 'shark', eye: 0.03, snout: 0.12, extras: ['barbels'] },
	hifin: { x0: 0.22, x1: 0.9, top: 0.24, bot: 0.12, peak: 0.6, nose: 0.4, dorsal: [{ x: 0.35, w: 0.3, h: 0.25, shape: 'sail' }], anal: [{ x: 0.3, w: 0.08, h: 0.06, shape: 'tri' }], tail: 'fork', eye: 0.045 },
	clownfish: { x0: 0.24, x1: 0.92, top: 0.15, bot: 0.12, peak: 0.55, nose: 0.5, dorsal: [{ x: 0.5, w: 0.18, h: 0.08, shape: 'spiny' }, { x: 0.32, w: 0.16, h: 0.1, shape: 'rounded' }], anal: [{ x: 0.32, w: 0.12, h: 0.08, shape: 'rounded' }], tail: 'round', eye: 0.06, pect: 0.07 },
	damsel: { x0: 0.24, x1: 0.92, top: 0.16, bot: 0.13, peak: 0.55, nose: 0.45, dorsal: [{ x: 0.32, w: 0.4, h: 0.08, shape: 'long' }], anal: [{ x: 0.3, w: 0.14, h: 0.08, shape: 'rounded' }], tail: 'fork', eye: 0.065 },
	tang: { x0: 0.22, x1: 0.9, top: 0.2, bot: 0.19, peak: 0.5, nose: 0.3, thick: 0.25, dorsal: [{ x: 0.3, w: 0.52, h: 0.1, shape: 'long' }], anal: [{ x: 0.3, w: 0.38, h: 0.09, shape: 'long' }], tail: 'lunate', eye: 0.05 },
	unicorn: { x0: 0.18, x1: 0.92, top: 0.15, bot: 0.14, peak: 0.5, nose: 0.4, thick: 0.3, dorsal: [{ x: 0.25, w: 0.55, h: 0.07, shape: 'long' }], anal: [{ x: 0.25, w: 0.4, h: 0.07, shape: 'long' }], tail: 'lunate', eye: 0.04, extras: ['horn'] },
	marineangel: { x0: 0.24, x1: 0.9, top: 0.2, bot: 0.18, peak: 0.5, nose: 0.4, thick: 0.3, dorsal: [{ x: 0.24, w: 0.5, h: 0.11, shape: 'long' }, { x: 0.2, w: 0.1, h: 0.14, shape: 'rounded' }], anal: [{ x: 0.24, w: 0.34, h: 0.1, shape: 'long' }], tail: 'truncate', eye: 0.05 },
	swallowtailangel: { x0: 0.24, x1: 0.9, top: 0.17, bot: 0.15, peak: 0.5, nose: 0.4, thick: 0.3, dorsal: [{ x: 0.28, w: 0.48, h: 0.08, shape: 'long' }], anal: [{ x: 0.28, w: 0.3, h: 0.07, shape: 'long' }], tail: 'lyre', eye: 0.05 },
	butterfly: { x0: 0.24, x1: 0.88, top: 0.22, bot: 0.2, peak: 0.5, nose: 0.25, thick: 0.25, dorsal: [{ x: 0.24, w: 0.48, h: 0.1, shape: 'long' }], anal: [{ x: 0.24, w: 0.32, h: 0.1, shape: 'long' }], tail: 'truncate', eye: 0.05, snout: 0.05 },
	longnose: { x0: 0.24, x1: 0.82, top: 0.2, bot: 0.17, peak: 0.5, nose: 0.25, thick: 0.25, dorsal: [{ x: 0.24, w: 0.45, h: 0.1, shape: 'spiny' }], anal: [{ x: 0.24, w: 0.3, h: 0.1, shape: 'long' }], tail: 'truncate', eye: 0.045, snout: 0.14 },
	bannerfish: { x0: 0.24, x1: 0.88, top: 0.22, bot: 0.2, peak: 0.5, nose: 0.3, thick: 0.25, dorsal: [{ x: 0.24, w: 0.4, h: 0.1, shape: 'long' }], anal: [{ x: 0.24, w: 0.32, h: 0.12, shape: 'long' }], tail: 'truncate', eye: 0.05, snout: 0.04, extras: ['filament'] },
	wrasse: { x0: 0.2, x1: 0.94, top: 0.11, bot: 0.1, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.26, w: 0.58, h: 0.06, shape: 'long' }], anal: [{ x: 0.26, w: 0.34, h: 0.05, shape: 'long' }], tail: 'round', eye: 0.045, pect: 0.07 },
	fairywrasse: { x0: 0.2, x1: 0.94, top: 0.12, bot: 0.1, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.26, w: 0.58, h: 0.09, shape: 'flow' }], anal: [{ x: 0.26, w: 0.34, h: 0.07, shape: 'long' }], tail: 'lyre', eye: 0.05 },
	birdwrasse: { x0: 0.18, x1: 0.86, top: 0.1, bot: 0.09, peak: 0.5, dorsal: [{ x: 0.24, w: 0.55, h: 0.05, shape: 'long' }], anal: [{ x: 0.24, w: 0.3, h: 0.05, shape: 'long' }], tail: 'lunate', eye: 0.04, snout: 0.12 },
	goby: { x0: 0.2, x1: 0.94, top: 0.08, bot: 0.07, peak: 0.6, nose: 0.6, flat: true, dorsal: [{ x: 0.55, w: 0.12, h: 0.07, shape: 'tri' }, { x: 0.3, w: 0.2, h: 0.06, shape: 'long' }], anal: [], tail: 'round', eye: 0.05 },
	firefish: { x0: 0.2, x1: 0.94, top: 0.07, bot: 0.06, peak: 0.55, nose: 0.6, dorsal: [{ x: 0.62, w: 0.06, h: 0.2, shape: 'tri' }, { x: 0.25, w: 0.3, h: 0.07, shape: 'long' }], anal: [{ x: 0.25, w: 0.28, h: 0.06, shape: 'long' }], tail: 'round', eye: 0.05 },
	jawfish: { x0: 0.2, x1: 0.92, top: 0.09, bot: 0.08, peak: 0.7, nose: 0.75, dorsal: [{ x: 0.24, w: 0.55, h: 0.05, shape: 'long' }], anal: [{ x: 0.24, w: 0.3, h: 0.05, shape: 'long' }], tail: 'round', eye: 0.07 },
	blenny: { x0: 0.2, x1: 0.92, top: 0.08, bot: 0.07, peak: 0.6, nose: 0.85, flat: true, dorsal: [{ x: 0.24, w: 0.6, h: 0.06, shape: 'long' }], tail: 'round', eye: 0.05, extras: ['tufts'] },
	dragonet: { x0: 0.22, x1: 0.9, top: 0.08, bot: 0.06, peak: 0.6, nose: 0.6, flat: true, thick: 1, dorsal: [{ x: 0.5, w: 0.12, h: 0.12, shape: 'sail' }, { x: 0.3, w: 0.16, h: 0.07, shape: 'long' }], tail: 'round', eye: 0.05, pect: 0.1 },
	basslet: { x0: 0.2, x1: 0.93, top: 0.12, bot: 0.1, peak: 0.5, nose: 0.45, dorsal: [{ x: 0.24, w: 0.6, h: 0.06, shape: 'long' }], anal: [{ x: 0.26, w: 0.2, h: 0.06, shape: 'rounded' }], tail: 'fork', eye: 0.06 },
	anthias: { x0: 0.2, x1: 0.93, top: 0.14, bot: 0.12, peak: 0.5, nose: 0.4, dorsal: [{ x: 0.24, w: 0.6, h: 0.07, shape: 'long' }, { x: 0.68, w: 0.05, h: 0.14, shape: 'tri' }], anal: [{ x: 0.26, w: 0.16, h: 0.07, shape: 'rounded' }], tail: 'lyre', tailSize: 1.3, eye: 0.06 },
	cardinal: { x0: 0.22, x1: 0.9, top: 0.17, bot: 0.15, peak: 0.55, nose: 0.4, dorsal: [{ x: 0.52, w: 0.1, h: 0.1, shape: 'tri' }, { x: 0.32, w: 0.12, h: 0.1, shape: 'tri' }], anal: [{ x: 0.3, w: 0.14, h: 0.08, shape: 'tri' }], tail: 'fork', eye: 0.08 },
	banggai: { x0: 0.22, x1: 0.9, top: 0.17, bot: 0.15, peak: 0.55, nose: 0.4, dorsal: [{ x: 0.52, w: 0.1, h: 0.18, shape: 'tri' }, { x: 0.32, w: 0.12, h: 0.16, shape: 'flow' }], anal: [{ x: 0.3, w: 0.14, h: 0.14, shape: 'flow' }], tail: 'lyre', tailSize: 1.4, eye: 0.07, ventral: 0.12 },
	hawkfish: { x0: 0.2, x1: 0.92, top: 0.13, bot: 0.1, peak: 0.6, nose: 0.5, dorsal: [{ x: 0.3, w: 0.5, h: 0.08, shape: 'spiny' }], anal: [{ x: 0.28, w: 0.12, h: 0.06, shape: 'rounded' }], tail: 'truncate', eye: 0.06, pect: 0.1, extras: ['tufts'] },
	longnosehawk: { x0: 0.2, x1: 0.82, top: 0.1, bot: 0.08, peak: 0.6, dorsal: [{ x: 0.28, w: 0.45, h: 0.08, shape: 'spiny' }], tail: 'truncate', eye: 0.05, snout: 0.14, extras: ['tufts'] },
	trigger: { x0: 0.2, x1: 0.9, top: 0.2, bot: 0.17, peak: 0.45, nose: 0.4, thick: 0.35, dorsal: [{ x: 0.26, w: 0.2, h: 0.1, shape: 'long' }], anal: [{ x: 0.26, w: 0.2, h: 0.1, shape: 'long' }], tail: 'lyre', eye: 0.045, extras: ['trigger'] },
	grouper: { x0: 0.18, x1: 0.94, top: 0.15, bot: 0.14, peak: 0.5, nose: 0.5, dorsal: [{ x: 0.3, w: 0.5, h: 0.07, shape: 'spiny' }, { x: 0.22, w: 0.12, h: 0.1, shape: 'rounded' }], anal: [{ x: 0.22, w: 0.14, h: 0.09, shape: 'rounded' }], tail: 'round', eye: 0.04, extras: ['lips'] },
	lyregrouper: { x0: 0.18, x1: 0.94, top: 0.15, bot: 0.14, peak: 0.5, nose: 0.5, dorsal: [{ x: 0.3, w: 0.5, h: 0.07, shape: 'spiny' }], anal: [{ x: 0.24, w: 0.12, h: 0.08, shape: 'rounded' }], tail: 'lunate', tailSize: 1.3, eye: 0.04 },
	rabbitfish: { x0: 0.22, x1: 0.9, top: 0.18, bot: 0.16, peak: 0.5, nose: 0.3, thick: 0.3, dorsal: [{ x: 0.26, w: 0.56, h: 0.09, shape: 'spiny' }], anal: [{ x: 0.26, w: 0.3, h: 0.08, shape: 'spiny' }], tail: 'fork', eye: 0.05, snout: 0.04 },
	batfish: { x0: 0.26, x1: 0.88, top: 0.24, bot: 0.22, peak: 0.5, nose: 0.4, thick: 0.25, dorsal: [{ x: 0.3, w: 0.32, h: 0.2, shape: 'sail' }], anal: [{ x: 0.3, w: 0.3, h: 0.2, shape: 'sail' }], tail: 'truncate', eye: 0.05 },
	frogfish: { x0: 0.25, x1: 0.88, top: 0.2, bot: 0.17, peak: 0.55, nose: 0.75, thick: 0.85, dorsal: [{ x: 0.3, w: 0.2, h: 0.07, shape: 'rounded' }], tail: 'round', eye: 0.035, pect: 0.1, extras: ['lure', 'tufts'] },
	filefish: { x0: 0.22, x1: 0.88, top: 0.18, bot: 0.17, peak: 0.45, nose: 0.3, thick: 0.25, dorsal: [{ x: 0.28, w: 0.16, h: 0.07, shape: 'long' }], anal: [{ x: 0.28, w: 0.16, h: 0.07, shape: 'long' }], tail: 'round', eye: 0.045, snout: 0.05, extras: ['trigger'] },
	goatfish: { x0: 0.2, x1: 0.94, top: 0.11, bot: 0.1, peak: 0.5, nose: 0.4, flat: true, dorsal: [{ x: 0.55, w: 0.1, h: 0.08, shape: 'tri' }, { x: 0.32, w: 0.1, h: 0.07, shape: 'tri' }], anal: [], tail: 'fork', eye: 0.05, extras: ['barbels'] },
	reefshark: { x0: 0.2, x1: 0.97, top: 0.1, bot: 0.09, peak: 0.45, nose: 0.25, thick: 0.6, dorsal: [{ x: 0.52, w: 0.14, h: 0.14, shape: 'tri' }, { x: 0.28, w: 0.05, h: 0.04, shape: 'tri' }], anal: [{ x: 0.28, w: 0.05, h: 0.04, shape: 'tri' }], tail: 'shark', tailSize: 1.3, eye: 0.03, pect: 0.14 },
	bambooshark: { x0: 0.35, x1: 0.97, top: 0.08, bot: 0.07, peak: 0.5, nose: 0.55, thick: 0.7, dorsal: [{ x: 0.42, w: 0.07, h: 0.07, shape: 'tri' }, { x: 0.34, w: 0.06, h: 0.06, shape: 'tri' }], tail: 'ribbon', eye: 0.03, pect: 0.1, extras: ['barbels'] },
	wobbegong: { x0: 0.25, x1: 0.97, top: 0.06, bot: 0.04, peak: 0.6, nose: 0.85, flat: true, thick: 2, dorsal: [{ x: 0.3, w: 0.06, h: 0.05, shape: 'tri' }, { x: 0.22, w: 0.05, h: 0.04, shape: 'tri' }], tail: 'ribbon', eye: 0.025, pect: 0.14, extras: ['whiskerFringe'] },
	hornshark: { x0: 0.28, x1: 0.96, top: 0.11, bot: 0.08, peak: 0.7, nose: 0.7, dorsal: [{ x: 0.62, w: 0.08, h: 0.1, shape: 'tri' }, { x: 0.38, w: 0.07, h: 0.08, shape: 'tri' }], tail: 'shark', eye: 0.03, pect: 0.12, extras: ['spines'] },
	kuhli: { x0: 0.12, x1: 0.95, top: 0.045, bot: 0.04, peak: 0.5, base: 0.6, nose: 0.6, dorsal: [{ x: 0.3, w: 0.06, h: 0.03, shape: 'rounded' }], tail: 'round', tailSize: 0.6, eye: 0.03, extras: ['barbels'] },
	dojo: { x0: 0.12, x1: 0.95, top: 0.06, bot: 0.055, peak: 0.5, base: 0.6, nose: 0.6, dorsal: [{ x: 0.42, w: 0.08, h: 0.04, shape: 'rounded' }], tail: 'round', tailSize: 0.8, eye: 0.03, extras: ['longBarbels'] },
	horseface: { x0: 0.15, x1: 0.92, top: 0.05, bot: 0.045, peak: 0.5, base: 0.6, flat: true, dorsal: [{ x: 0.45, w: 0.08, h: 0.04, shape: 'tri' }], tail: 'fork', tailSize: 0.8, eye: 0.03, snout: 0.08 },
	spinyeel: { x0: 0.06, x1: 0.9, top: 0.05, bot: 0.05, peak: 0.5, base: 0.5, nose: 0.5, dorsal: [{ x: 0.06, w: 0.5, h: 0.03, shape: 'long' }, { x: 0.56, w: 0.2, h: 0.015, shape: 'spiny' }], anal: [{ x: 0.06, w: 0.4, h: 0.03, shape: 'long' }], tail: 'round', tailSize: 0.5, eye: 0.03, snout: 0.07 },
	ropefish: { x0: 0.04, x1: 0.95, top: 0.035, bot: 0.035, peak: 0.5, base: 0.6, nose: 0.6, dorsal: [{ x: 0.1, w: 0.6, h: 0.02, shape: 'spiny' }], tail: 'round', tailSize: 0.5, eye: 0.025, pect: 0.05 },
	moray: { x0: 0.04, x1: 0.96, top: 0.07, bot: 0.06, peak: 0.75, base: 0.4, nose: 0.6, dorsal: [{ x: 0.04, w: 0.8, h: 0.035, shape: 'long' }], anal: [{ x: 0.04, w: 0.45, h: 0.03, shape: 'long' }], tail: 'none', eye: 0.035, extras: ['gape', 'teeth'] },
	ribboneel: { x0: 0.04, x1: 0.96, top: 0.035, bot: 0.03, peak: 0.75, base: 0.5, nose: 0.5, dorsal: [{ x: 0.04, w: 0.85, h: 0.03, shape: 'long' }], anal: [{ x: 0.04, w: 0.5, h: 0.025, shape: 'long' }], tail: 'none', eye: 0.03, extras: ['gape', 'tufts'] },
	gardeneel: { x0: 0.04, x1: 0.96, top: 0.03, bot: 0.03, peak: 0.5, base: 0.7, nose: 0.7, tail: 'none', eye: 0.035 },
	lionfish: { x0: 0.22, x1: 0.9, top: 0.17, bot: 0.15, peak: 0.55, nose: 0.5, thick: 0.4, dorsal: [{ x: 0.24, w: 0.16, h: 0.08, shape: 'rounded' }], anal: [{ x: 0.26, w: 0.12, h: 0.08, shape: 'rounded' }], tail: 'round', tailSize: 1.1, eye: 0.05, extras: ['lionSpines', 'tufts'] },
	dwarflion: { x0: 0.24, x1: 0.88, top: 0.18, bot: 0.16, peak: 0.55, nose: 0.55, thick: 0.45, dorsal: [{ x: 0.26, w: 0.14, h: 0.07, shape: 'rounded' }], anal: [{ x: 0.26, w: 0.12, h: 0.07, shape: 'rounded' }], tail: 'round', eye: 0.055, pect: 0.2, extras: ['lionSpines', 'tufts'] },
	pipefish: { x0: 0.08, x1: 0.82, top: 0.03, bot: 0.03, peak: 0.5, base: 0.6, dorsal: [{ x: 0.35, w: 0.08, h: 0.03, shape: 'long' }], tail: 'fan', tailSize: 0.6, eye: 0.03, snout: 0.12 }
};

/** Which plan a species uses, by its scientific name (genus, and a few species). */
const BY_GENUS: [RegExp, string][] = [
	[/^(Carnegiella|Gasteropelecus)/, 'hatchet'],
	[/^(Paracheirodon|Hyphessobrycon|Hemigrammus|Gymnocorymbus|Phenacogrammus|Moenkhausia|Nematobrycon|Thayeria|Pristella|Hasemania|Psalidodon|Inpaichthys|Aphyocharax|Prionobrama|Exodon)/, 'tetra'],
	[/^(Puntius|Puntigrus|Pethia|Barbodes|Oliotius|Sahyadria|Desmopuntius|Barbonymus|Dawkinsia|Haludaria|Trigonostigma)/, 'barb'],
	[/^(Epalzeorhynchos|Balantiocheilos|Labeo|Crossocheilus|Gyrinocheilus)/, 'sharkminnow'],
	[/^(Danio|Devario|Boraras|Rasbora|Microdevario|Sundadanio|Tanichthys|Pimephales|Leuciscus|Rhodeus|Scardinius|Gambusia|Heterandria|Nannostomus)/, 'danio'],
	[/^Poecilia (reticulata|wingei)/, 'guppy'],
	[/^Poecilia latipinna(?! \(balloon)/, 'sailfin'],
	[/^Xiphophorus hellerii/, 'swordtail'],
	[/^(Xiphophorus|Poecilia)/, 'livebearer'],
	[/^Betta splendens \(plakat\)|^Betta (imbellis|macrostoma)|^Macropodus/, 'plakat'],
	[/^(Betta|Calloplesiops)/, 'betta'],
	[/^(Trichogaster|Trichopodus|Helostoma|Sphaerichthys|Parosphromenus|Osphronemus|Trichopsis)/, 'gourami'],
	[/^(Cyphotilapia)/, 'frontosa'],
	[/Hybrid cichlid \(blood parrot\)/, 'parrot'],
	[/^(Hybrid cichlid|Herichthys hybrid)/, 'flowerhorn'],
	[/^(Mikrogeophagus|Pelvicachromis|Apistogramma|Dicrossus|Cleithracara|Neolamprologus|Nannacara|Julidochromis|Cyprichromis|Altolamprologus)/, 'dwarfcichlid'],
	[/^(Cichla|Datnioides|Hoplias)/, 'bass'],
	[/^Crenicichla/, 'pike'],
	[/^(Andinoacara|Labidochromis|Melanochromis|Maylandia|Pseudotropheus|Chindongo|Aulonocara|Protomelas|Cyrtocara|Nimbochromis|Fossorochromis|Tropheus|Cyathopharynx|Haplochromis|Labeotropheus|Heterotilapia|Hemichromis|Heros|Amatitlania|Thorichthys|Rocio|Herichthys|Amphilophus|Trichromis|Uaru|Geophagus|Parachromis|Hypselecara|Mesonauta|Herotilapia)/, 'cichlid'],
	[/^(Pterygoplichthys)/, 'sailpleco'],
	[/^(Ancistrus|Baryancistrus|Panaque|Panaqolus|Chaetostoma|Hypancistrus|Hemiancistrus|Leporacanthicus|Scobinancistrus|Peckoltia|Dekeyseria|Parotocinclus|Pseudacanthicus|Otocinclus)/, 'pleco'],
	[/^Sewellia/, 'hillstream'],
	[/^(Chromobotia|Botia kubotai)/, 'clownloach'],
	[/^(Botia|Yasuhikotakia|Ambastaia)/, 'loach'],
	[/^(Synodontis|Platydoras|Microglanis|Bunocephalus|Hara)/, 'synodontis'],
	[/^Kryptopterus/, 'glass'],
	[/^Farlowella/, 'twig'],
	[/^(Phractocephalus|Pseudoplatystoma)/, 'bigcatfish'],
	[/^(Pimelodus|Pangasianodon)/, 'catfish'],
	[/^(Melanotaenia|Glossolepis|Iriatherina|Pseudomugil|Marosatherina|Chilatherina)/, 'rainbow'],
	[/^(Epiplatys|Fundulopanchax|Aphyosemion|Aplocheilus|Nothobranchius|Jordanella)/, 'killi'],
	[/^(Lepisosteus|Atractosteus)/, 'gar'],
	[/^Xenentodon/, 'needle'],
	[/^Polypterus/, 'bichir'],
	[/^(Apteronotus|Chitala)/, 'knife'],
	[/^Gnathonemus/, 'elephantnose'],
	[/^Pantodon/, 'butterflyfw'],
	[/^Toxotes/, 'archer'],
	[/^(Monocirrhus|Nandus|Taenianotus)/, 'leaf'],
	[/^Channa/, 'snakehead'],
	[/^(Piaractus|Pygocentrus)/, 'piranha'],
	[/^Arapaima/, 'arapaima'],
	[/^(Carinotetraodon|Tetraodon|Colomesus|Dichotomyctere|Arothron|Diodon|Canthigaster)/, 'puffer'],
	[/^(Ostracion|Lactoria)/, 'boxfish'],
	[/\((ranchu|lionhead|lionchu)\)/, 'ranchu'],
	[/\((oranda|red cap oranda|panda|chocolate)\)/, 'oranda'],
	[/\((telescope|black moor)\)/, 'telescope'],
	[/\(bubble eye\)/, 'bubbleeye'],
	[/\(celestial\)/, 'celestialeye'],
	[/\(pompom\)/, 'pompom'],
	[/^Carassius auratus( \((comet|shubunkin|wakin)\))?$/, 'comet'],
	[/^Carassius/, 'goldfish'],
	[/^Cyprinus/, 'koi'],
	[/^(Lepomis|Enneacanthus)/, 'sunfish'],
	[/^Gasterosteus/, 'stickleback'],
	[/^Acipenser/, 'sturgeon'],
	[/^Myxocyprinus/, 'hifin'],
	[/^Etheostoma/, 'goby'],
	[/^(Amphiprion|Premnas)/, 'clownfish'],
	[/^(Chrysiptera|Dascyllus|Chromis|Hypsypops|Pictichromis|Pseudochromis)/, 'damsel'],
	[/^Naso (unicornis|vlamingii)/, 'unicorn'],
	[/^(Zebrasoma|Acanthurus|Ctenochaetus|Naso)/, 'tang'],
	[/^Genicanthus/, 'swallowtailangel'],
	[/^(Centropyge|Pomacanthus|Holacanthus|Pygoplites|Apolemichthys|Paracentropyge)/, 'marineangel'],
	[/^(Chelmon|Forcipiger)/, 'longnose'],
	[/^(Heniochus|Zanclus)/, 'bannerfish'],
	[/^(Chaetodon|Hemitaurichthys)/, 'butterfly'],
	[/^Gomphosus/, 'birdwrasse'],
	[/^(Cirrhilabrus|Paracheilinus)/, 'fairywrasse'],
	[/^(Pseudocheilinus|Halichoeres|Macropharyngodon|Labroides|Choerodon|Coris|Wetmorella|Anampses|Thalassoma)/, 'wrasse'],
	[/^Nemateleotris/, 'firefish'],
	[/^Opistognathus/, 'jawfish'],
	[/^(Cryptocentrus|Valenciennea|Gobiodon|Elacatinus|Amblygobius|Amblyeleotris|Lythrypnus|Stonogobiops)/, 'goby'],
	[/^Synchiropus/, 'dragonet'],
	[/^(Salarias|Ecsenius)/, 'blenny'],
	[/^(Gramma|Liopropoma|Assessor)/, 'basslet'],
	[/^Pseudanthias/, 'anthias'],
	[/^Pterapogon/, 'banggai'],
	[/^(Sphaeramia|Apogon)/, 'cardinal'],
	[/^Oxycirrhites/, 'longnosehawk'],
	[/^(Neocirrhites|Paracirrhites|Cirrhitichthys)/, 'hawkfish'],
	[/^(Rhinecanthus|Odonus|Balistoides|Xanthichthys|Melichthys|Balistes|Sufflamen|Balistapus)/, 'trigger'],
	[/^Variola/, 'lyregrouper'],
	[/^(Cromileptes|Cephalopholis)/, 'grouper'],
	[/^Siganus/, 'rabbitfish'],
	[/^Platax/, 'batfish'],
	[/^Antennarius/, 'frogfish'],
	[/^(Oxymonacanthus|Chaetodermis)/, 'filefish'],
	[/^Parupeneus/, 'goatfish'],
	[/^(Carcharhinus|Triaenodon|Triakis)/, 'reefshark'],
	[/^(Chiloscyllium|Hemiscyllium|Atelomycterus|Ginglymostoma)/, 'bambooshark'],
	[/^Orectolobus/, 'wobbegong'],
	[/^Heterodontus/, 'hornshark'],
	[/^(Doryrhamphus|Corythoichthys)/, 'pipefish'],
	[/^Iodotropheus/, 'cichlid'],
	[/^Pangio/, 'kuhli'],
	[/^Misgurnus/, 'dojo'],
	[/^Acantopsis/, 'horseface'],
	[/^(Mastacembelus|Macrognathus)/, 'spinyeel'],
	[/^Erpetoichthys/, 'ropefish'],
	[/^Rhinomuraena/, 'ribboneel'],
	[/^Heteroconger/, 'gardeneel'],
	[/^(Echidna|Gymnomuraena|Enchelycore|Gymnothorax)/, 'moray'],
	[/^Dendrochirus/, 'dwarflion'],
	[/^Pterois/, 'lionfish']
];

export function planOf(sp: Species): Plan | null {
	for (const [re, name] of BY_GENUS) if (re.test(sp.sci)) return P[name];
	return null;
}

// ── Building ─────────────────────────────────────────────────────────────────────────
function seeded(key: string) {
	let h = 2166136261;
	for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return ((h ^= h >>> 16) >>> 0) / 4294967296;
	};
}
const lighten = (hex: string, f: number) => {
	const n = parseInt(hex.slice(1), 16);
	const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
	return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
};

/** The body's height at u (0 = tail base, 1 = nose), as a share of its deepest. */
function profile(u: number, peak: number, base: number, nose: number) {
	if (u <= peak) return base + (1 - base) * Math.sin((Math.PI / 2) * (u / peak)) ** 0.8;
	return nose + (1 - nose) * Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak))) ** 0.7;
}

export function buildFromPlan(sp: Species, p: Plan, phase: number): Box[] {
	const [body, belly, finC] = sp.colors;
	const pc = sp.pcolor ?? '#202028';
	const out: Box[] = [];
	const rnd = seeded(sp.id);
	const sw = Math.sin(phase * Math.PI * 2);
	const N = 14;
	const dx = (p.x1 - p.x0) / N;
	const peak = p.peak ?? 0.55;
	const base = p.base ?? 0.3;
	const nose = p.nose ?? 0.45;
	const thick = p.thick ?? 0.45;
	const floor = 0.05;
	const ghost = p.extras?.includes('transparent');
	const spots = new Set(Array.from({ length: 7 }, () => Math.floor(rnd() * N)));
	const patches = new Set(Array.from({ length: 5 }, () => Math.floor(rnd() * N)));
	const tops: number[] = [];
	const bots: number[] = [];
	let headD = 0;
	for (let i = 0; i < N; i++) {
		const u = (i + 0.5) / N;
		const k = profile(u, peak, base, nose);
		const top = p.flat ? floor + (p.top + p.bot) * k : MID + p.top * k;
		const bot = p.flat ? floor : MID - p.bot * k;
		tops.push(top);
		bots.push(bot);
		const h = top - bot;
		const d = Math.max(0.05, h * thick);
		if (i === N - 2) headD = d;
		const wave = Math.sin(phase * Math.PI * 2 - u * 4) * (1 - u) * 0.025;
		const y = 0.5 - d / 2 + wave;
		const x = p.x0 + i * dx;
		// Paint: belly below, body above, with the species' pattern.
		let upper = body;
		let lower = belly;
		switch (sp.pattern) {
			case 'vbands':
				if (i % 4 === 1) upper = lower = pc;
				break;
			case 'zebra':
				if (i % 2 === 1) upper = lower = pc;
				break;
			case 'split':
				if (u < 0.45) upper = pc;
				break;
			case 'calico':
			case 'marble':
				if (patches.has(i)) upper = pc;
				break;
		}
		const a = ghost ? 0.45 : undefined;
		const bh = h * 0.38;
		out.push(bx(x, y, bot, dx + 0.002, d, bh, lower, a));
		out.push(bx(x, y, bot + bh, dx + 0.002, d, h - bh, upper, a));
		const side = y + d;
		if (sp.pattern === 'hstripes') {
			out.push(bx(x, side, bot + h * 0.6, dx + 0.002, 0.004, h * 0.1, pc));
			out.push(bx(x, side, bot + h * 0.3, dx + 0.002, 0.004, h * 0.08, pc));
		}
		if (sp.pattern === 'neon') {
			out.push(bx(x, side, bot + h * 0.55, dx + 0.002, 0.004, h * 0.14, pc));
			if (u < 0.6) out.push(bx(x, side, bot + h * 0.1, dx + 0.002, 0.004, h * 0.32, '#e8303a'));
		}
		if (sp.pattern === 'spots' && spots.has(i)) out.push(bx(x + dx * 0.15, side, bot + h * (0.3 + rnd() * 0.45), dx * 0.7, 0.004, h * 0.14, pc));
		if (sp.pattern === 'calico' && patches.has(i) && i % 2) out.push(bx(x, side, bot + h * 0.2, dx + 0.002, 0.004, h * 0.25, '#1a1a1a'));
	}
	const topAt = (x: number) => tops[Math.max(0, Math.min(N - 1, Math.floor((x - p.x0) / dx)))];
	const botAt = (x: number) => bots[Math.max(0, Math.min(N - 1, Math.floor((x - p.x0) / dx)))];
	const fd = 0.05;
	const fy = 0.5 - fd / 2;
	const zc = p.flat ? floor + (p.top + p.bot) * base * 0.6 : MID;
	const tailH = (p.flat ? p.top + p.bot : p.top + p.bot) * (p.tailSize ?? 1);

	// Fins along the back and belly.
	const drawFin = (f: Fin, up: boolean) => {
		const steps = Math.max(2, Math.round(f.w / 0.045));
		for (let s = 0; s < steps; s++) {
			const fx = f.x + (s * f.w) / steps;
			const t = s / (steps - 1 || 1); // 0 at the tail end, 1 at the head end
			let h = f.h;
			if (f.shape === 'tri') h = f.h * (0.3 + 0.7 * t);
			if (f.shape === 'rounded') h = f.h * Math.sin(Math.PI * (0.15 + 0.7 * (1 - t)));
			if (f.shape === 'long') h = f.h * (0.75 + 0.25 * (1 - t));
			if (f.shape === 'sail') h = f.h * (0.6 + 0.4 * Math.sin(Math.PI * t));
			if (f.shape === 'spiny') h = f.h * (s % 2 ? 0.75 : 1) * (0.6 + 0.4 * t);
			if (f.shape === 'flow') h = f.h * (0.5 + 0.5 * (1 - t)) * (1 + Math.sin(phase * Math.PI * 2 + s) * 0.08);
			const anchor = up ? topAt(fx + f.w / steps / 2) - 0.01 : botAt(fx + f.w / steps / 2) + 0.01;
			out.push(bx(fx, fy, up ? anchor : anchor - h, f.w / steps + 0.002, fd, h, s === steps - 1 && up ? lighten(finC, 1.1) : finC));
		}
	};
	for (const f of p.dorsal ?? []) drawFin(f, true);
	for (const f of p.anal ?? []) drawFin(f, false);

	// The tail.
	const tx = p.x0;
	const ty = 0.475 + sw * 0.045;
	const tailBox = (x: number, z: number, w: number, h: number, col = finC) => out.push(bx(x, ty, z, w, fd, h, col));
	const T = p.tail;
	if (T === 'fork' || T === 'lyre' || T === 'lunate') {
		// Solid lobes, built column by column out from the tail base: each column reaches further
		// up and down, with the notch between the lobes cutting in deeper as it goes.
		const span = tailH * (T === 'lyre' ? 0.75 : T === 'lunate' ? 0.7 : 0.6);
		const K = 5;
		const w = (0.15 * (p.tailSize ?? 1)) / K;
		const stem = tailH * 0.13;
		tailBox(tx - 0.03, zc - stem, 0.032, stem * 2);
		for (let s = 0; s < K; s++) {
			const t = (s + 1) / K;
			const reach = stem + (span - stem) * t ** 0.8;
			const notch = T === 'fork' ? reach * Math.max(0, t - 0.3) * 0.95 : T === 'lunate' ? reach * (0.15 + 0.45 * t) : reach * Math.max(0, t - 0.2) * 0.85;
			const x = tx - 0.03 - (s + 1) * w;
			const col = s >= K - 2 ? lighten(finC, 1.08) : finC;
			if (notch < stem * 0.6) tailBox(x, zc - reach, w + 0.002, reach * 2, col);
			else {
				tailBox(x, zc + notch, w + 0.002, reach - notch, col);
				tailBox(x, zc - reach, w + 0.002, reach - notch, col);
			}
		}
		if (T === 'lyre') {
			// Long streamers off the lobe tips.
			tailBox(tx - 0.03 - K * w - 0.05, zc + span - 0.025, 0.05, 0.025);
			tailBox(tx - 0.03 - K * w - 0.05, zc - span, 0.05, 0.025);
		}
	} else if (T === 'round' || T === 'truncate' || T === 'fan') {
		const big = T === 'fan';
		const K = big ? 6 : 4;
		const w = ((big ? 0.22 : 0.12) * (p.tailSize ?? 1)) / K;
		const h0 = tailH * (big ? 0.6 : 0.42);
		for (let s = 0; s < K; s++) {
			const t = (s + 1) / K;
			// Fans spread wide then round off; round tails swell and close; truncate ones stay square.
			const hs = T === 'truncate' ? h0 * (0.75 + 0.3 * t) : big ? h0 * (0.4 + 0.8 * Math.sin(t * Math.PI * 0.55)) * (t === 1 ? 0.88 : 1) : h0 * (0.75 + 0.35 * Math.sin(Math.PI * t) - (t === 1 ? 0.25 : 0));
			tailBox(tx - t * w * K, zc - hs / 2, w + 0.002, hs, s >= K - 1 ? lighten(finC, 1.1) : finC);
		}
	} else if (T === 'double') {
		// Fancy goldfish: two tails, splayed and flowing.
		const w = 0.14 * (p.tailSize ?? 1);
		for (const side of [-1, 1]) {
			const yy = 0.5 + side * 0.06 + sw * 0.03;
			for (let s = 0; s < 3; s++) out.push(bx(tx - (s + 1) * (w / 3), yy, zc - tailH * (0.25 + s * 0.12), w / 3 + 0.002, 0.04, tailH * (0.5 + s * 0.22), finC));
		}
	} else if (T === 'sword') {
		tailBox(tx - 0.12, zc - tailH * 0.25, 0.12, tailH * 0.5);
		tailBox(tx - 0.28, zc - tailH * 0.4, 0.28, 0.035, sp.pcolor && sp.pattern !== 'none' ? pc : lighten(finC, 0.7));
	} else if (T === 'small') {
		tailBox(tx - 0.08, zc - tailH * 0.18, 0.08, tailH * 0.36);
	} else if (T === 'shark') {
		tailBox(tx - 0.06, zc - 0.02, 0.06, tailH * 0.35);
		tailBox(tx - 0.13, zc + tailH * 0.1, 0.07, tailH * 0.45);
		tailBox(tx - 0.08, zc - tailH * 0.25, 0.06, tailH * 0.22);
	} else if (T === 'ribbon') {
		// A long, low tail, half the animal's length (bamboo sharks, wobbegongs).
		for (let s = 0; s < 6; s++) {
			const u = s / 6;
			const h = tailH * (0.35 - u * 0.2);
			const wave = Math.sin(phase * Math.PI * 2 - u * 3) * 0.04 * u;
			out.push(bx(tx - (s + 1) * 0.055, 0.47 + wave, zc - h * 0.6, 0.057, fd + 0.02, h, s % 2 && sp.pattern === 'vbands' ? pc : body));
		}
	}

	// Side and belly fins.
	if (p.pect) out.push(bx(p.x0 + (p.x1 - p.x0) * 0.68, 0.5 + headD / 2 + 0.002, zc - p.bot * 0.3 + sw * 0.01, p.pect, 0.01, p.pect * 0.5, lighten(finC, 1.08)));
	else out.push(bx(p.x0 + (p.x1 - p.x0) * 0.66, 0.5 + headD / 2 + 0.002, zc - p.bot * 0.25 + sw * 0.01, 0.07, 0.01, 0.035, lighten(finC, 1.08)));
	if (p.ventral) {
		const vx = p.x0 + (p.x1 - p.x0) * 0.62;
		out.push(bx(vx, 0.495, botAt(vx) - p.ventral, 0.015, 0.02, p.ventral, finC));
	}

	// Head features.
	const nx = p.x1;
	const headTop = topAt(nx - dx);
	const headBot = botAt(nx - dx);
	const er = p.eye ?? 0.05;
	let ex = nx - (p.x1 - p.x0) * 0.12;
	let ez = p.flat ? headTop - er * 1.4 : zc + (headTop - zc) * 0.35;
	const ex2 = p.extras ?? [];
	if (p.snout) {
		const sz = p.flat ? headBot + 0.01 : zc - 0.005;
		out.push(bx(nx - 0.01, 0.48, sz, p.snout, 0.04, 0.025, lighten(body, 0.9)));
		if (ex2.includes('teeth')) out.push(bx(nx, 0.5, sz - 0.004, p.snout * 0.9, 0.03, 0.006, '#f4f4f4'));
	} else if (ex2.includes('teeth')) out.push(bx(nx - 0.04, 0.5 + headD / 2, zc - 0.03, 0.04, 0.006, 0.01, '#f4f4f4'));
	if (ex2.includes('lips')) out.push(bx(nx - 0.01, 0.47, zc - 0.035, 0.03, 0.06, 0.04, lighten(body, 1.15)));
	if (ex2.includes('barbels')) out.push(bx(nx - 0.03, 0.52, headBot - 0.01, 0.05, 0.015, 0.012, lighten(body, 1.2)), bx(nx - 0.05, 0.46, headBot - 0.02, 0.04, 0.015, 0.012, lighten(body, 1.2)));
	if (ex2.includes('longBarbels')) {
		out.push(bx(nx - 0.02, 0.52, zc, 0.12, 0.01, 0.01, lighten(body, 0.8)), bx(nx - 0.12, 0.52, zc - 0.03, 0.1, 0.01, 0.01, lighten(body, 0.8)));
		out.push(bx(nx - 0.04, 0.53, headBot - 0.02, 0.06, 0.01, 0.01, lighten(belly, 0.9)));
	}
	if (ex2.includes('sucker')) out.push(bx(nx - 0.08, 0.46, floor - 0.005, 0.08, 0.08, 0.012, '#3a3028'));
	if (ex2.includes('adipose')) out.push(bx(p.x0 + (p.x1 - p.x0) * 0.12, fy, topAt(p.x0 + 0.05) - 0.01, 0.04, fd, 0.03, finC));
	if (ex2.includes('hump')) {
		for (let s = 0; s < 3; s++) out.push(bx(nx - 0.2 + s * 0.045, 0.5 - headD * 0.4, headTop - 0.01, 0.045, headD * 0.8, 0.05 - Math.abs(s - 1) * 0.015, lighten(body, 1.05)));
	}
	if (ex2.includes('wen')) {
		const wc = sp.pcolor && sp.pattern !== 'none' ? pc : lighten(body, 1.15);
		for (let s = 0; s < 4; s++) out.push(bx(nx - 0.16 + s * 0.04, 0.5 - headD * 0.35, headTop - 0.02 + (s % 2) * 0.012, 0.04, headD * 0.7, 0.04, wc));
		out.push(bx(nx - 0.04, 0.5 + headD / 2 - 0.01, zc - 0.03, 0.04, 0.02, 0.06, wc));
	}
	if (ex2.includes('telescope')) {
		ez = zc + 0.02;
		out.push(bx(ex - er / 2, 0.5 + headD / 2, ez - er / 2, er, 0.05, er, lighten(body, 0.9)));
	}
	if (ex2.includes('celestial')) ez = headTop - er * 0.3;
	if (ex2.includes('bubbles')) out.push(bx(ex - 0.06, 0.5 + headD / 2 - 0.02, zc - 0.08, 0.09, 0.05, 0.08, '#f8e0c0', 0.75));
	if (ex2.includes('pompom')) out.push(bx(nx - 0.01, 0.5 + headD / 2 - 0.01, zc + 0.01, 0.04, 0.03, 0.04, '#f06a8a'));
	if (ex2.includes('horn')) out.push(bx(nx - 0.1, 0.49, headTop, 0.06, 0.03, 0.05, lighten(body, 0.85)), bx(nx - 0.06, 0.49, headTop + 0.04, 0.05, 0.03, 0.025, lighten(body, 0.85)));
	if (ex2.includes('trigger')) out.push(bx(nx - 0.28, fy, headTop - 0.01, 0.025, fd, 0.12, finC));
	if (ex2.includes('filament')) {
		for (let s = 0; s < 5; s++) out.push(bx(p.x0 + (p.x1 - p.x0) * 0.55 - s * 0.05, fy, topAt(p.x0 + 0.5) + 0.05 + s * 0.045, 0.05, fd * 0.6, 0.045, finC));
	}
	if (ex2.includes('trunk')) out.push(bx(nx - 0.02, 0.49, headBot - 0.05, 0.03, 0.03, 0.06, lighten(body, 0.9)), bx(nx, 0.49, headBot - 0.08, 0.04, 0.03, 0.03, lighten(body, 0.9)));
	if (ex2.includes('lure')) out.push(bx(nx - 0.05, 0.49, headTop, 0.01, 0.01, 0.08, '#d8c8a0'), bx(nx - 0.06, 0.48, headTop + 0.08, 0.03, 0.03, 0.03, '#f8a0c0'));
	if (ex2.includes('spines')) for (let s = 0; s < 3; s++) out.push(bx(p.x0 + (p.x1 - p.x0) * (0.55 + s * 0.1), fy, topAt(p.x0 + (p.x1 - p.x0) * (0.55 + s * 0.1)) - 0.01, 0.015, fd, 0.06, lighten(body, 0.7)));
	if (ex2.includes('lionSpines')) {
		// Tall separate venomous spines along the back, with webbing, and big feathery side fins.
		for (let s = 0; s < 9; s++) {
			const sx = p.x0 + (p.x1 - p.x0) * (0.32 + s * 0.065);
			const h = 0.1 + Math.sin((s / 8) * Math.PI) * 0.13;
			out.push(bx(sx, fy, topAt(sx) - 0.01, 0.014, fd, h, s % 2 ? lighten(finC, 1.15) : finC));
			out.push(bx(sx + 0.014, fy, topAt(sx) - 0.01, 0.05, fd * 0.6, h * 0.45, lighten(finC, 1.25), 0.7));
		}
		const px = p.x0 + (p.x1 - p.x0) * 0.42;
		for (let s = 0; s < 6; s++) {
			const len = (p.pect ?? 0.16) + 0.08 + s * 0.012;
			out.push(bx(px + 0.04 - len * 0.5, 0.5 + headD / 2 + 0.004, zc - 0.02 - s * 0.03 + sw * 0.01, len, 0.008, 0.016, s % 2 ? pc : lighten(finC, 1.2)));
		}
	}
	if (ex2.includes('gape')) out.push(bx(nx - 0.07, 0.5 + headD / 2 + 0.002, zc - 0.015, 0.07, 0.004, 0.012, '#3a1420'));
	if (ex2.includes('ear')) out.push(bx(ex - 0.08, 0.5 + headD / 2 + 0.003, zc - 0.005, 0.04, 0.006, 0.03, '#1a1a1a'));
	if (ex2.includes('tufts')) out.push(bx(ex - 0.01, 0.5, headTop, 0.015, 0.015, 0.03, lighten(finC, 1.1)), bx(ex + 0.02, 0.5, headTop, 0.015, 0.015, 0.025, lighten(finC, 1.1)));
	if (ex2.includes('whiskerFringe')) for (let s = 0; s < 5; s++) out.push(bx(nx - 0.12 + s * 0.025, 0.6, floor, 0.012, 0.02, 0.03, lighten(body, 0.8)));
	if (ex2.includes('keel')) out.push(bx(p.x0 + (p.x1 - p.x0) * 0.4, 0.49, botAt(p.x0 + 0.4) - 0.02, 0.2, 0.02, 0.02, lighten(belly, 0.9)));
	if (p.flat && ex === nx - (p.x1 - p.x0) * 0.12) ex = nx - (p.x1 - p.x0) * 0.1;
	// The eye.
	const ey = 0.5 + headD / 2 + (ex2.includes('telescope') ? 0.05 : 0.003);
	out.push(bx(ex - er / 2, ey, ez - er / 2, er, 0.006, er, '#f6f6f2'));
	out.push(bx(ex - er / 4 + er * 0.12, ey + 0.004, ez - er / 4, er * 0.55, 0.006, er * 0.55, '#121216'));
	out.push(bx(ex - er / 8 + er * 0.12, ey + 0.008, ez + er * 0.06, er * 0.16, 0.004, er * 0.16, '#ffffff'));
	return out;
}
