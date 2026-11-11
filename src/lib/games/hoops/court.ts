// Check-up: the 3D voxel park (three.js). A street court with a chain-net hoop, a chain-link fence,
// trees, benches, lamps and a city skyline; two blocky players (you, customised, and the computer)
// and the ball. The game tells it where everyone is and what they're doing; it draws and animates.
import { animate, BOUNCE_HZ, dribbleState, LOOPS, REST, type AnimName, type Joints } from './anim';
import { DEFAULT_COURT, type CourtStyle } from './items';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Three = any;
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/** The rim (court units; the floor is y 0, the hoop faces +z). */
export const HOOP = { x: 0, y: 7, z: -10 };
/** Where the ball is checked: top of the key, behind the arc. */
export const CHECK = { x: 0, z: 1.5 };
/** The three-point arc's radius (shots from beyond it score 2). */
export const ARC = 9.5;

export interface Look {
	skin: string;
	hair: (typeof HAIRS)[number];
	hairColor: string;
	jersey: string;
	shorts: string;
	number: number;
	/** Body size (1 = normal; a big man is bigger). */
	scale?: number;
	/** The face: eyes, brows, mouth and facial hair (in the hair colour). */
	eyes?: (typeof EYES)[number];
	brows?: (typeof BROWS)[number];
	mouth?: (typeof MOUTHS)[number];
	facial?: (typeof FACIAL)[number];
	build?: (typeof BUILDS)[number];
	shape?: (typeof SHAPES)[number];
	earrings?: (typeof EARRINGS)[number];
	/** Gear (items.ts): shoes 'main|sole', and colours for the rest (null / absent: none). */
	shoes?: string;
	band?: string | null;
	/** A crown (its gold), worn over the hair. */
	hat?: string | null;
	sleeve?: string | null;
	wrist?: string | null;
	goggles?: boolean;
	chain?: string | null;
	knee?: string | null;
}
// Fair to deep, with warm, neutral and olive undertones.
export const SKINS = [
	'#fde7d6', '#f6d5bc', '#f1c7a5', '#e9b893', '#e0ac85', '#d9a273', '#c9925f', '#c68642',
	'#b5794a', '#a0663a', '#8d5a34', '#7a4a26', '#65391d', '#4e2f19', '#3d2414', '#2b190e'
];
export const HAIRS = [
	'short', 'fade', 'buzz', 'afro', 'curly', 'twists', 'locs', 'cornrows', 'braids', 'mohawk', 'flattop', 'bob', 'bun', 'spacebuns', 'pigtails', 'ponytail', 'long', 'flow', 'bald'
] as const;
export const EYES = ['dots', 'wide', 'lashes', 'sleepy', 'focused'] as const;
/** Body build: standard, or slim (narrower shoulders and hips). */
/** Body build (slim, standard or big) and shape (curvy adds a fuller chest and wider hips). */
export const BUILDS = ['slim', 'standard', 'big'] as const;
export const SHAPES = ['straight', 'curvy'] as const;
export const EARRINGS = ['none', 'studs', 'hoops'] as const;
export const BROWS = ['none', 'thin', 'thick', 'angry'] as const;
export const MOUTHS = ['none', 'smile', 'grin', 'flat', 'lips'] as const;
export const FACIAL = ['none', 'stubble', 'mustache', 'goatee', 'beard'] as const;
export const HAIR_COLORS = ['#0b0806', '#1f130a', '#3b2414', '#5a3825', '#6b4423', '#8b5a2b', '#a0522d', '#c49a5a', '#e3c27a', '#f0e0b0', '#9ca3af', '#e5e7eb', '#b91c1c', '#2563eb', '#db2777', '#16a34a'];
export const JERSEYS = ['#7c3aed', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#0f172a', '#f8fafc', '#db2777'];
export const DEFAULT_LOOK: Look = { skin: '#c68642', hair: 'short', hairColor: '#1f130a', jersey: '#7c3aed', shorts: '#1e1b4b', number: 23 };
export const CPU_LOOK: Look = { skin: '#7a4a26', hair: 'short', band: '#dc2626', hairColor: '#1f130a', jersey: '#f8fafc', shorts: '#dc2626', number: 0 };

type BallMode =
	| { kind: 'hold'; who: 'you' | 'cpu' }
	| { kind: 'dribble'; who: 'you' | 'cpu' }
	| { kind: 'flight'; from: Three; t0: number; dur: number; made: boolean; blocked: boolean; dunk?: boolean; done: () => void }
	| { kind: 'loose'; at: Three; vel: Three; t0: number }
	| { kind: 'hidden' };

/** Cameras: the game's views, and cut-scene shots (a close-up of the opponent, the crowd, the city). */
export type CamMode = 'menu' | 'offense' | 'defense' | 'practice' | 'locker' | 'intro' | 'crowd' | 'skyline';

/** Which way a player faces: ±1 (−1 = toward the hoop, +1 = away), or a spot on the court to face. */
export type Facing = number | { x: number; z: number };

export interface Court {
	/**
	 * Your player's joints (from your body) and place: x across, z along the court, and which way
	 * they face: ±1 (−1 = toward the hoop) or a spot to turn toward (a defender tracks their man).
	 */
	setYou(j: Joints | null, x: number, z: number, facing: Facing): void;
	/** The computer player's place and animation (started at `since`). */
	setCpu(x: number, z: number, facing: Facing, anim: AnimName, since: number): void;
	showCpu(on: boolean): void;
	setLook(look: Look): void;
	setCpuLook(look: Look): void;
	/** Online: the other player's body drives the opponent (instead of an animation). */
	setOther(j: Joints, x: number, z: number, facing: Facing): void;
	/** How big the crowd is, 0 (an empty park) to 7 (packed bleachers, under the lights). */
	setCrowd(level: number): void;
	/** The court's look: floor, key paint, backboard, net, ball and half-court logo. */
	setStyle(style: CourtStyle): void;
	/** The crowd jumps up. */
	cheer(): void;
	ball(mode: 'hold' | 'dribble' | 'hidden', who?: 'you' | 'cpu'): void;
	/** The ball flies at the rim from whoever has it; resolves when it's in (or off the rim / swatted). */
	shoot(made: boolean, blocked?: boolean, dunk?: boolean): Promise<void>;
	/** Change the view: 'cut' jumps there at once, 'glide' moves there slowly (cut scenes); default eases. */
	camera(mode: CamMode, move?: 'cut' | 'glide'): void;
	/** Which hand you're dribbling with (the ball follows it). */
	setYouHand(hand: 'left' | 'right' | null): void;
	/** Phones: frame My player in the middle (above the half-screen menu), not to the left. */
	setCompact(on: boolean): void;
	/** The other (online) player's ball hand. */
	setOtherHand(hand: 'left' | 'right'): void;
	/** A spin move: the player turns all the way round. */
	spin(who: 'you' | 'cpu'): void;
	onBounce: () => void;
	dispose(): void;
}

export async function createCourt(canvas: HTMLCanvasElement): Promise<Court> {
	const T: Three = await import(/* @vite-ignore */ THREE_URL);
	const renderer = new T.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(2, devicePixelRatio));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = T.PCFSoftShadowMap;
	const scene = new T.Scene();
	const SKY_TOP = new T.Color('#5aa7e6');
	scene.background = SKY_TOP;
	scene.fog = new T.Fog('#bcdcf2', 38, 95);
	const camera = new T.PerspectiveCamera(52, 1, 0.1, 200);

	scene.add(new T.HemisphereLight('#d9ecff', '#4b6b2a', 0.85));
	const sun = new T.DirectionalLight('#fff2d6', 1.6);
	sun.position.set(14, 26, 10);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, far: 80 });
	scene.add(sun);

	// ── Voxels: one instanced mesh per colour ──
	const cube = new T.BoxGeometry(1, 1, 1);
	const mats = new Map<string, Three>();
	const mat = (c: string, extra: object = {}) => {
		const key = c + JSON.stringify(extra);
		if (!mats.has(key)) mats.set(key, new T.MeshLambertMaterial({ color: c, ...extra }));
		return mats.get(key);
	};
	type Vox = { x: number; y: number; z: number; c: string; s?: number; sx?: number; sy?: number; sz?: number };
	function voxels(list: Vox[], parent: Three = scene, shadows = true) {
		const byColour = new Map<string, Vox[]>();
		for (const v of list) (byColour.get(v.c) ?? byColour.set(v.c, []).get(v.c)!).push(v);
		const m = new T.Matrix4();
		const meshes: Three[] = [];
		for (const [c, vs] of byColour) {
			const mesh = new T.InstancedMesh(cube, mat(c), vs.length);
			vs.forEach((v, i) => mesh.setMatrixAt(i, m.makeScale(v.sx ?? v.s ?? 1, v.sy ?? v.s ?? 1, v.sz ?? v.s ?? 1).setPosition(v.x, v.y, v.z)));
			mesh.castShadow = shadows;
			mesh.receiveShadow = true;
			parent.add(mesh);
			meshes.push(mesh);
		}
		return meshes;
	}
	// A little random, the same every time.
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const pick = <X>(a: X[]) => a[Math.floor(rnd() * a.length)];

	// ── The park ──
	const ground: Vox[] = [];
	for (let x = -30; x <= 30; x++)
		for (let z = -34; z <= 26; z++) {
			const onCourt = Math.abs(x) <= 12 && z >= -14 && z <= 10;
			const path = !onCourt && Math.abs(z - 15) <= 1 && x > -30;
			const apron = !onCourt && Math.abs(x) <= 14 && z >= -16 && z <= 12;
			const c = onCourt ? '' : path ? pick(['#cdbb94', '#c4b088', '#d4c39d']) : apron ? pick(['#9ca3af', '#a1a8b3']) : pick(['#4f9a3a', '#56a33f', '#4a9036', '#5aa844']);
			if (c) ground.push({ x, y: -0.5, z, c });
		}
	voxels(ground, scene, false);
	// The court: the floor's two colours, a painted key, the arc, and the lines, raised a hair.
	let style: CourtStyle = { ...DEFAULT_COURT };
	const courtGroup = new T.Group();
	scene.add(courtGroup);
	function buildCourt() {
	courtGroup.clear();
	const court: Vox[] = [];
	for (let x = -12; x <= 12; x++)
		for (let z = -14; z <= 10; z++) {
			const d = Math.hypot(x - HOOP.x, z - HOOP.z);
			let c = (x * 7 + z * 13) % 5 == 0 ? style.floor[1] : style.floor[0];
			if (Math.abs(x) <= 2 && z >= -13 && z <= -4) c = style.key;
			// The arc: every tile the curve passes through (so it's one unbroken line).
			const near = Math.hypot(Math.max(0, Math.abs(x - HOOP.x) - 0.5), Math.max(0, Math.abs(z - HOOP.z) - 0.5));
			const far = Math.hypot(Math.abs(x - HOOP.x) + 0.5, Math.abs(z - HOOP.z) + 0.5);
			// (Strictly inside: a tile the curve only grazes along its edge stays unpainted.)
			if (near < ARC && far > ARC && d > ARC - 0.75 && z >= -13) c = '#f8fafc';
			if ((z == -4 && Math.abs(x) <= 2) || (Math.abs(x) == 3 && z >= -13 && z <= -4) || Math.abs(x) == 12 || z == -14 || z == 10) c = '#f8fafc';
			if (Math.hypot(x, z + 4) < 2.5 && Math.hypot(x, z + 4) > 1.6 && z > -4) c = '#f8fafc';
			// The splash logo near half court (for threes from the logo).
			// A gold crown at half court (King of the Park).
			if (style.decal == 'crown') {
				const dz = z - 7;
				const ax = Math.abs(x);
				if ((dz >= 0 && dz <= 1 && ax <= 2) || (dz == -1 && (ax == 2 || ax == 0)) || (dz == -2 && ax == 0)) c = dz == 0 && x == 0 ? '#dc2626' : '#facc15';
			}
			if (style.decal == 'splash') {
				const r = Math.hypot(x, z - 7);
				if (r < 2.4) c = r > 1.6 ? '#facc15' : (x + z) % 2 ? '#38bdf8' : '#0ea5e9';
			}
			court.push({ x, y: -0.45, z, c, sy: 0.92 });
		}
	voxels(court, courtGroup, false);
	}
	buildCourt();

	// Chain-link fence round the court (see-through), with posts and a top rail.
	const fence = new T.Group();
	const mesh = new T.MeshLambertMaterial({ color: '#9ca3af', transparent: true, opacity: 0.28 });
	const fencePanel = (w: number, x: number, z: number, rot: number) => {
		const m = new T.Mesh(new T.BoxGeometry(w, 5, 0.06), mesh);
		m.position.set(x, 2.5, z);
		m.rotation.y = rot;
		fence.add(m);
	};
	fencePanel(29, 0, -16.5, 0);
	fencePanel(28, -14.5, -2.5, Math.PI / 2);
	fencePanel(28, 14.5, -2.5, Math.PI / 2);
	scene.add(fence);
	const posts: Vox[] = [];
	for (let x = -14; x <= 14; x += 3) for (let y = 0; y <= 5; y++) posts.push({ x, y, z: -16.5, c: '#6b7280', sx: 0.25, sz: 0.25 });
	for (const sx of [-14.5, 14.5]) for (let z = -16; z <= 11; z += 3) for (let y = 0; y <= 5; y++) posts.push({ x: sx, y, z, c: '#6b7280', sx: 0.25, sz: 0.25 });
	for (let x = -14; x <= 14; x++) posts.push({ x, y: 5, z: -16.5, c: '#6b7280', sy: 0.18, sz: 0.18 });
	for (const sx of [-14.5, 14.5]) for (let z = -16; z <= 11; z++) posts.push({ x: sx, y: 5, z, c: '#6b7280', sy: 0.18, sx: 0.18 });
	voxels(posts);

	// Trees: trunks and leafy blobs.
	const trees: Vox[] = [];
	const tree = (tx: number, tz: number, h: number) => {
		for (let y = 0; y < h; y++) trees.push({ x: tx, y, z: tz, c: '#6b4423', s: 0.9 });
		const leaves = ['#2f7d32', '#388e3c', '#2e6b2f', '#43a047'];
		for (let x = -2; x <= 2; x++)
			for (let y = 0; y <= 3; y++)
				for (let z = -2; z <= 2; z++) {
					const r = Math.hypot(x, (y - 1.4) * 1.2, z);
					if (r < 2.6 && rnd() > 0.12) trees.push({ x: tx + x, y: h + y, z: tz + z, c: pick(leaves) });
				}
	};
	for (const [x, z, h] of [[-25, -14, 5], [-26, -2, 6], [-19, 13, 5], [25, -15, 6], [26, -3, 5], [19, 13, 6], [-24, 18, 5], [24, 17, 6], [-6, -24, 6], [7, -25, 5], [-22, -24, 5], [22, -22, 6]] as const) tree(x, z, h);
	voxels(trees);

	// Benches and lamp posts by the court; a water fountain.
	const props: Vox[] = [];
	const bench = (bx: number, bz: number) => {
		for (let k = -1; k <= 1; k++) {
			props.push({ x: bx, y: 0.9, z: bz + k, c: '#92400e', sx: 1.2, sy: 0.2 });
			props.push({ x: bx + 0.5, y: 1.5, z: bz + k, c: '#92400e', sx: 0.2, sy: 0.9 });
		}
		for (const k of [-1, 1]) props.push({ x: bx, y: 0.4, z: bz + k, c: '#374151', sx: 1, sy: 0.8, sz: 0.2 });
	};
	bench(-16.5, -6);
	bench(-16.5, 4);
	bench(16.5, -6);
	const lamps: Three[] = [];
	for (const [lx, lz] of [[-15.5, -15], [15.5, -15], [-15.5, 10], [15.5, 10]] as const) {
		for (let y = 0; y < 9; y++) props.push({ x: lx, y, z: lz, c: '#1f2937', sx: 0.35, sz: 0.35 });
		props.push({ x: lx + (lx < 0 ? 0.6 : -0.6), y: 9, z: lz, c: '#1f2937', sx: 1.4, sy: 0.3, sz: 0.4 });
		const bulb = new T.Mesh(new T.BoxGeometry(0.8, 0.25, 0.5), new T.MeshBasicMaterial({ color: '#fff7c2' }));
		bulb.position.set(lx + (lx < 0 ? 0.9 : -0.9), 8.75, lz);
		scene.add(bulb);
		lamps.push(bulb);
	}
	props.push({ x: 17, y: 0.6, z: 4, c: '#94a3b8', sx: 0.8, sy: 1.2, sz: 0.8 }, { x: 17, y: 1.3, z: 4, c: '#cbd5e1', sx: 1, sy: 0.2, sz: 1 });
	// A boombox on the bench.
	props.push({ x: -16.5, y: 1.25, z: 4.8, c: '#111827', sx: 0.9, sy: 0.5, sz: 0.4 }, { x: -16.5, y: 1.25, z: 5.02, c: '#f59e0b', sx: 0.7, sy: 0.3, sz: 0.02 });
	voxels(props);

	// The city behind the park.
	const city: Vox[] = [];
	const towers = ['#64748b', '#475569', '#7c8798', '#94a3b8', '#8b5e3c', '#a16207'];
	for (let i = 0; i < 22; i++) {
		const x = -54 + i * 5 + rnd() * 2;
		const h = 8 + Math.floor(rnd() * 22);
		const w = 3 + Math.floor(rnd() * 2);
		const c = pick(towers);
		city.push({ x, y: h / 2, z: -48 - rnd() * 6, c, sx: w, sy: h, sz: 4 });
		for (let y = 2; y < h - 1; y += 2) for (let k = -1; k <= 1; k += 2) if (rnd() > 0.35) city.push({ x: x + k * (w / 4), y, z: -45.9 - 0, c: rnd() > 0.7 ? '#fde68a' : '#cbd5e1', sx: 0.6, sy: 0.8, sz: 0.1 });
	}
	voxels(city, scene, false);
	// Clouds.
	const clouds = new T.Group();
	const cl: Vox[] = [];
	for (const [cx, cy, cz] of [[-20, 26, -30], [8, 30, -38], [30, 24, -20], [-34, 28, 0]] as const)
		for (let k = 0; k < 14; k++) cl.push({ x: cx + (rnd() - 0.5) * 9, y: cy + (rnd() - 0.5) * 1.6, z: cz + (rnd() - 0.5) * 4, c: '#ffffff', sx: 2, sy: 1, sz: 2 });
	voxels(cl, clouds, false);
	scene.add(clouds);

	// The hoop: pole, backboard with its square, rim, and a chain net.
	const hoop: Vox[] = [];
	for (let y = 0; y <= 9; y++) hoop.push({ x: 0, y, z: -12.8, c: '#334155', sx: 0.6, sz: 0.6 });
	hoop.push({ x: 0, y: 9, z: -12.1, c: '#334155', sx: 0.5, sy: 0.5, sz: 1.6 });

	for (let a = 0; a < 20; a++) {
		const ang = (a / 20) * Math.PI * 2;
		hoop.push({ x: HOOP.x + Math.cos(ang) * 0.78, y: HOOP.y, z: HOOP.z + Math.sin(ang) * 0.78, c: '#ea580c', s: 0.2 });
	}
	hoop.push({ x: 0, y: HOOP.y, z: -10.85, c: '#ea580c', sx: 0.2, sy: 0.2, sz: 0.5 });
	// The hoop goes see-through when the camera is behind it (you on defense).
	const hoopMeshes: Three[] = voxels(hoop);
	const net = new T.Group();
	net.position.set(HOOP.x, HOOP.y, HOOP.z);
	const chain: Vox[] = [];
	for (let a = 0; a < 10; a++) {
		const ang = (a / 10) * Math.PI * 2;
		for (let k = 1; k <= 5; k++) chain.push({ x: Math.cos(ang) * (0.72 - k * 0.07), y: -k * 0.27, z: Math.sin(ang) * (0.72 - k * 0.07), c: '#d1d5db', s: 0.1 });
	}
	void chain;
	for (const m of hoopMeshes) {
		m.material = m.material.clone();
		m.material.transparent = true;
	}
	let hoopFade = 1;
	scene.add(net);
	const boardGroup = new T.Group();
	scene.add(boardGroup);
	let boardMeshes: Three[] = [];
	function buildBoard() {
		boardGroup.clear();
		const b: Vox[] = [];
		const glass = (x: number, y: number) => ({ x, y: 7.2 + y, z: -11.2, c: '#e2e8f0', sz: 0.25 });
		for (let x = -2; x <= 2; x++)
			for (let y = 0; y < 3; y++) {
				if (style.board == 'shattered' && ((x == 1 && y == 2) || (x == -2 && y == 0) || (x == 2 && y == 1))) continue; // holes
				b.push(glass(x, y));
			}
		const square = style.board == 'bank' ? '#facc15' : '#ea580c';
		for (const [x, y] of [[-0.5, 7.4], [0.5, 7.4], [-0.5, 8.4], [0.5, 8.4], [0, 8.4], [-0.5, 7.9], [0.5, 7.9]]) b.push({ x, y, z: -11.05, c: square, s: style.board == 'bank' ? 0.4 : 0.32, sz: 0.06 });
		if (style.board == 'binary') {
			// 1s and 0s printed across the glass.
			for (let i = 0; i < 18; i++) {
				const x = -1.9 + (i % 6) * 0.75;
				const y = 7.25 + Math.floor(i / 6) * 0.95;
				const one = (i * 7) % 3 != 0;
				b.push({ x, y: y + 0.25, z: -11.03, c: '#1e293b', sx: one ? 0.08 : 0.24, sy: 0.32, sz: 0.04 });
			}
		}
		if (style.board == 'shattered') {
			// Cracks running out from the rim.
			for (let i = 0; i < 26; i++) {
				const a = (i % 6) * 1.05 + 0.3;
				const r = 0.25 + Math.floor(i / 6) * 0.42;
				b.push({ x: Math.cos(a) * r * 1.4, y: 8 + Math.sin(a) * r, z: -11.03, c: '#475569', s: 0.08, sz: 0.04 });
			}
			for (let i = 0; i < 8; i++) b.push({ x: -1.6 + i * 0.45, y: 0.1, z: -10.6 + (i % 3) * 0.3, c: '#cbd5e1', s: 0.14 });
		}
		if (style.board == 'bank') for (const [x, y] of [[-0.9, 8.9], [0.9, 8.9], [-0.9, 7.2], [0.9, 7.2]]) b.push({ x, y, z: -11.03, c: '#facc15', s: 0.14, sz: 0.04 });
		boardMeshes = voxels(b, boardGroup);
		for (const m of boardMeshes) {
			m.material = m.material.clone();
			m.material.transparent = true;
		}
	}
	buildBoard();
	// The net: chain (the park's) or fresh white nylon.
	function buildNet() {
		net.clear();
		const strands: Vox[] = [];
		const nylon = style.net == 'nylon';
		for (let a = 0; a < (nylon ? 14 : 10); a++) {
			const ang = (a / (nylon ? 14 : 10)) * Math.PI * 2;
			for (let k = 1; k <= 5; k++) strands.push({ x: Math.cos(ang) * (0.72 - k * 0.07), y: -k * 0.27, z: Math.sin(ang) * (0.72 - k * 0.07), c: nylon ? '#f8fafc' : '#d1d5db', s: nylon ? 0.12 : 0.1 });
		}
		netMeshes = voxels(strands, net);
		for (const m of netMeshes) {
			m.material = m.material.clone();
			m.material.transparent = true;
		}
	}
	let netMeshes: Three[] = [];

	// ── The crowd: people by the fence, then bleachers, filling up as you climb the ladder ──
	const crowd = new T.Group();
	scene.add(crowd);
	let fans: { g: Three; phase: number; base: number }[] = [];
	let excite = 0;
	const SHIRTS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0f172a', '#f8fafc', '#db2777', '#0ea5e9', '#a16207'];
	function fan(x: number, y: number, z: number, faceX: number, seated: boolean) {
		const g = new T.Group();
		const skin = pick(SKINS);
		const shirt = pick(SHIRTS);
		const add = (w: number, h: number, d: number, c: string, py: number) => {
			const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c));
			m.position.y = py;
			m.castShadow = true;
			g.add(m);
		};
		if (!seated) add(0.5, 1.2, 0.4, pick(['#1e293b', '#334155', '#78350f', '#1e3a8a']), 0.6);
		add(0.8, 1.0, 0.5, shirt, seated ? 0.6 : 1.7);
		add(0.55, 0.55, 0.55, skin, seated ? 1.4 : 2.5);
		if (rnd() < 0.5) add(0.6, 0.18, 0.6, pick(HAIR_COLORS.concat(SHIRTS)), seated ? 1.75 : 2.85);
		g.position.set(x, y, z);
		g.rotation.y = Math.atan2(faceX, 0) || (faceX < 0 ? -Math.PI / 2 : Math.PI / 2);
		crowd.add(g);
		fans.push({ g, phase: rnd() * 6, base: y });
	}
	function bleacher(cx: number, cz: number, alongZ: boolean, rows: number, len: number, outward: number, fill: number) {
		const v: Vox[] = [];
		for (let r = 0; r < rows; r++)
			for (let k = 0; k < len; k++) {
				const along = k - len / 2 + 0.5;
				const x = alongZ ? cx + outward * r * 1.2 : cx + along;
				const z = alongZ ? cz + along : cz + outward * r * 1.2;
				v.push({ x, y: 0.4 + r * 0.8, z, c: r % 2 ? '#9ca3af' : '#b4bcc8', sx: alongZ ? 1.2 : 1, sy: 0.25, sz: alongZ ? 1 : 1.2 });
				v.push({ x, y: r * 0.4, z, c: '#4b5563', sx: alongZ ? 1.2 : 1, sy: 0.8 * (r + 1), sz: alongZ ? 1 : 1.2 });
				if (rnd() < fill && k % 1 == 0) {
					// Facing the court.
					const face = alongZ ? -outward : 0;
					fan(x, 0.55 + r * 0.8, z, face || 0.0001, true);
					if (!alongZ) fans[fans.length - 1].g.rotation.y = outward < 0 ? 0 : Math.PI;
				}
			}
		voxels(v, crowd);
	}
	let night = false;
	function setCrowd(level: number) {
		crowd.clear();
		fans = [];
		seed = 99;
		// People standing at the fence.
		const standing = level <= 0 ? 0 : Math.min(26, 3 + level * 4);
		for (let i = 0; i < standing; i++) {
			const side = i % 3;
			if (side == 0) fan(-15.4, 0, -14 + rnd() * 24, 1, false);
			else if (side == 1) fan(15.4, 0, -14 + rnd() * 24, -1, false);
			else {
				fan(-12 + rnd() * 24, 0, 11.6 + rnd() * 1.5, 0, false);
				fans[fans.length - 1].g.rotation.y = Math.PI;
			}
		}
		// Bleachers: left from level 2, right from 4, behind the hoop from 6; fuller each time.
		const fill = Math.min(0.9, 0.25 + level * 0.1);
		if (level >= 2) bleacher(-17.8, -3, true, level >= 5 ? 5 : 3, 14, -1, fill);
		if (level >= 4) bleacher(17.8, -3, true, level >= 6 ? 5 : 3, 14, 1, fill);
		if (level >= 6) bleacher(0, -18.5, false, 4, 18, -1, fill);
		// The last games are under the lights.
		night = level >= 6;
		scene.background = new T.Color(night ? '#1b2340' : '#5aa7e6');
		scene.fog.color = new T.Color(night ? '#1b2340' : '#bcdcf2');
		sun.intensity = night ? 0.55 : 1.6;
		sun.color = new T.Color(night ? '#a5b4fc' : '#fff2d6');
		for (const l of lampLights) l.intensity = night ? 60 : 0;
		for (const b of lamps) b.material.color = new T.Color(night ? '#fffbe0' : '#e5e7eb');
	}
	const lampLights: Three[] = [];
	for (const b of lamps) {
		const l = new T.PointLight('#fff2c2', 0, 30, 1.6);
		l.position.copy(b.position);
		l.position.y -= 0.4;
		scene.add(l);
		lampLights.push(l);
	}
	function animateCrowd(now: number) {
		excite *= 0.985;
		for (const f of fans) {
			const hop = Math.max(0, Math.sin(now / 160 + f.phase)) * (0.08 + excite * 0.6);
			f.g.position.y = f.base + hop;
		}
	}

	// ── Players ──
	function makeBaller(look: Look) {
		const root = new T.Group();
		const body = new T.Group();
		root.add(body);
		const hips = new T.Group();
		hips.position.y = 2.9;
		body.add(hips);
		const box = (w: number, h: number, d: number, c: string, parent: Three, x = 0, y = 0, z = 0) => {
			const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c));
			m.position.set(x, y, z);
			m.castShadow = true;
			parent.add(m);
			return m;
		};
		// Build: slim, standard or big (torso, shoulders, arms and legs); shape: curvy adds a fuller
		// chest and a little more hip.
		const B = { slim: { tw: 1.42, td: 0.8, arm: 0.38, sx: 0.9, leg: 0.58, lx: 0.4 }, standard: { tw: 1.7, td: 0.9, arm: 0.42, sx: 1.05, leg: 0.62, lx: 0.45 }, big: { tw: 2.05, td: 1.08, arm: 0.52, sx: 1.25, leg: 0.72, lx: 0.52 } }[look.build ?? 'standard'];
		const curvy = look.shape == 'curvy';
		box(B.tw, 2.1, B.td, look.jersey, hips, 0, 1.05);
		// Trim at the neck.
		box(B.tw + 0.02, 0.12, B.td + 0.02, look.shorts, hips, 0, 2.05);
		if (curvy) {
			// A fuller chest, under the jersey (the front is -z).
			for (const x of [-0.27, 0.27]) box(B.tw * 0.36, 0.42, 0.22, look.jersey, hips, x * (B.tw / 1.7), 1.5, -B.td / 2 - 0.08);
			// Wider hips, in the shorts.
			box(B.tw + 0.16, 0.42, B.td + 0.04, look.shorts, hips, 0, 0.14);
		}
		box(0.9, 0.9, 0.9, look.skin, hips, 0, 2.65);
		face(look, box, hips);
		hair(look, hips);
		// The number on the back, in voxel digits.
		digits(look.number, look.jersey == '#f8fafc' || look.jersey == '#f59e0b' ? '#0f172a' : '#f8fafc', hips);
		const part = (w: number, h: number, c: string, parent: Three, x: number, y: number) => {
			const pivot = new T.Group();
			pivot.position.set(x, y, 0);
			box(w, h, w, c, pivot, 0, -h / 2);
			parent.add(pivot);
			return pivot;
		};
		const arm = (side: number) => {
			const upper = part(B.arm, 1.1, look.skin, hips, side * B.sx, 2.0);
			// Sleeve-less jersey edge.
			box(0.46, 0.25, 0.46, look.jersey, upper, 0, -0.1);
			const lower = part(0.38, 1.0, look.skin, upper, 0, -1.1);
			const hand = new T.Object3D();
			hand.position.y = -1.05;
			lower.add(hand);
			return { upper, lower, hand };
		};
		const leg = (side: number) => {
			const upper = part(B.leg, 1.4, look.shorts, hips, side * (B.lx + (curvy ? 0.04 : 0)), 0);
			const lower = part(0.55, 1.4, look.skin, upper, 0, -1.4);
			box(0.58, 0.4, 0.58, '#f8fafc', lower, 0, -1.0); // socks
			// Shoes (toes forward): upper and sole.
			const [main, sole] = (look.shoes ?? '#111827|#f8fafc').split('|');
			box(0.66, 0.3, 0.95, main, lower, 0, -1.43, -0.14);
			box(0.68, 0.1, 0.98, sole, lower, 0, -1.6, -0.14);
			return { upper, lower };
		};
		const L = { arm: arm(-1), leg: leg(-1) };
		const R = { arm: arm(1), leg: leg(1) };
		// Gear.
		if (look.band) box(0.99, 0.16, 0.99, look.band, hips, 0, 2.95);
		if (look.hat) {
			// A crown: a gold band with five points and a red jewel at the front.
			const top = look.hair == 'afro' ? 3.62 : look.hair == 'flattop' ? 3.62 : look.hair == 'mohawk' ? 3.5 : 3.22;
			box(1.0, 0.2, 1.0, look.hat, hips, 0, top);
			for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [0, -0.45], [-0.42, 0.42], [0.42, 0.42]]) box(0.16, 0.26, 0.16, look.hat, hips, x, top + 0.22, z);
			box(0.14, 0.14, 0.04, '#dc2626', hips, 0, top, -0.51);
		}
		if (look.sleeve) {
			box(0.46, 0.95, 0.46, look.sleeve, R.arm.upper, 0, -0.62);
			box(0.42, 0.85, 0.42, look.sleeve, R.arm.lower, 0, -0.45);
		}
		if (look.wrist) for (const S of [L, R]) box(0.44, 0.2, 0.44, look.wrist, S.arm.lower, 0, -0.82);
		if (look.goggles) {
			box(0.96, 0.24, 0.08, '#111827', hips, 0, 2.72, -0.47);
			for (const x of [-0.2, 0.2]) box(0.24, 0.14, 0.04, '#93c5fd', hips, x, 2.72, -0.52);
		}
		if (look.chain) {
			box(0.62, 0.08, 0.05, look.chain, hips, 0, 1.98, -0.47);
			box(0.18, 0.22, 0.05, look.chain, hips, 0, 1.76, -0.48);
		}
		if (look.knee) box(0.62, 0.36, 0.62, look.knee, L.leg.lower, 0, -0.2);
		root.scale.setScalar(look.scale ?? 1);
		scene.add(root);
		const cur: Joints = { ...REST };
		return {
			root,
			L,
			R,
			cur,
			set(j: Joints, k = 0.45) {
				for (const key of Object.keys(cur) as (keyof Joints)[]) cur[key] += (j[key] - cur[key]) * k;
				L.arm.upper.rotation.z = cur.lu;
				L.arm.lower.rotation.z = cur.ll;
				R.arm.upper.rotation.z = cur.ru;
				R.arm.lower.rotation.z = cur.rl;
				L.leg.upper.rotation.z = cur.lt;
				L.leg.lower.rotation.z = cur.ls;
				R.leg.upper.rotation.z = cur.rt;
				R.leg.lower.rotation.z = cur.rs;
				body.position.y = Math.max(-2.2, cur.y);
				hips.rotation.z = cur.lean;
			},
			dispose() {
				scene.remove(root);
			}
		};
	}
	/** The face, on the head's front (-z): eyes, brows, mouth, facial hair. */
	function face(look: Look, box: (w: number, h: number, d: number, c: string, parent: Three, x?: number, y?: number, z?: number) => Three, hips: Three) {
		const ink = '#111827';
		const hairC = look.hairColor;
		const z = -0.46;
		// Facial hair first (the mouth sits on top).
		if (look.facial == 'beard') box(0.94, 0.4, 0.94, hairC, hips, 0, 2.36, 0);
		if (look.facial == 'stubble') box(0.86, 0.3, 0.04, shade(look.skin, 0.72), hips, 0, 2.38, z - 0.005);
		if (look.facial == 'goatee') box(0.24, 0.22, 0.04, hairC, hips, 0, 2.31, z - 0.01);
		if (look.facial == 'mustache' || look.facial == 'goatee') box(0.34, 0.07, 0.04, hairC, hips, 0, 2.53, z - 0.01);
		// Eyes.
		const eyes = look.eyes ?? 'dots';
		for (const x of [-0.2, 0.2]) {
			if (eyes == 'wide') {
				box(0.2, 0.18, 0.03, '#f8fafc', hips, x, 2.72, z);
				box(0.1, 0.12, 0.03, ink, hips, x, 2.71, z - 0.02);
			} else if (eyes == 'lashes') {
				box(0.13, 0.13, 0.04, ink, hips, x, 2.71, z);
				// Lashes: a line over the eye, flicked out at the side.
				box(0.2, 0.04, 0.04, ink, hips, x, 2.8, z - 0.01);
				box(0.05, 0.06, 0.04, ink, hips, x + (x < 0 ? -0.11 : 0.11), 2.83, z - 0.01);
			} else if (eyes == 'sleepy') box(0.19, 0.06, 0.04, ink, hips, x, 2.7, z);
			else if (eyes == 'focused') box(0.16, 0.09, 0.04, ink, hips, x, 2.71, z);
			else box(0.13, 0.13, 0.04, ink, hips, x, 2.72, z);
		}
		// Brows (hair colour).
		const brows = look.brows ?? 'thin';
		if (brows != 'none')
			for (const x of [-0.2, 0.2]) {
				const b = box(0.22, brows == 'thick' ? 0.08 : 0.05, 0.04, hairC == '#e5e7eb' || hairC == '#f0e0b0' ? '#9ca3af' : hairC, hips, x, 2.87, z - 0.01);
				if (brows == 'angry') b.rotation.z = x < 0 ? -0.35 : 0.35;
			}
		// Mouth.
		const mouth = look.mouth ?? 'none';
		if (mouth == 'smile') {
			box(0.26, 0.05, 0.04, ink, hips, 0, 2.45, z - 0.02);
			for (const x of [-0.15, 0.15]) box(0.05, 0.05, 0.04, ink, hips, x, 2.48, z - 0.02);
		} else if (mouth == 'grin') {
			box(0.32, 0.12, 0.04, ink, hips, 0, 2.46, z - 0.02);
			box(0.26, 0.05, 0.04, '#f8fafc', hips, 0, 2.48, z - 0.03);
		} else if (mouth == 'flat') box(0.24, 0.045, 0.04, ink, hips, 0, 2.46, z - 0.02);
		else if (mouth == 'lips') {
			box(0.26, 0.06, 0.04, '#be185d', hips, 0, 2.48, z - 0.02);
			box(0.2, 0.05, 0.04, '#db2777', hips, 0, 2.43, z - 0.02);
		}
		// Earrings, on the sides of the head.
		if (look.earrings == 'studs') for (const x of [-0.47, 0.47]) box(0.08, 0.08, 0.08, '#facc15', hips, x, 2.52, 0.02);
		if (look.earrings == 'hoops')
			for (const x of [-0.47, 0.47]) {
				box(0.05, 0.22, 0.05, '#facc15', hips, x, 2.42, -0.06);
				box(0.05, 0.22, 0.05, '#facc15', hips, x, 2.42, 0.1);
				box(0.05, 0.05, 0.2, '#facc15', hips, x, 2.31, 0.02);
			}
	}
	/** A darker (or lighter) version of a colour. */
	function shade(hex: string, k: number) {
		const n = parseInt(hex.slice(1), 16);
		const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
		return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
	}
	function hair(look: Look, hips: Three) {
		// A block of hair: size, then where (the head's top is at y 3.1; its back faces +z).
		const h = (w: number, hh: number, d: number, y: number, z = 0, c = look.hairColor, x = 0) => {
			const m = new T.Mesh(new T.BoxGeometry(w, hh, d), mat(c));
			m.position.set(x, y, z);
			m.castShadow = true;
			hips.add(m);
		};
		const top = () => h(0.96, 0.22, 0.96, 3.07);
		switch (look.hair) {
			case 'short':
				h(0.96, 0.25, 0.96, 3.05);
				h(0.96, 0.4, 0.2, 2.85, 0.4);
				break;
			case 'fade':
				h(0.94, 0.26, 0.94, 3.1);
				h(0.97, 0.14, 0.97, 2.92);
				break;
			case 'buzz':
				h(0.94, 0.1, 0.94, 3.12);
				break;
			case 'afro':
				h(1.4, 0.9, 1.4, 3.2);
				break;
			case 'curly':
				h(1.04, 0.3, 1.04, 3.1);
				for (const [x, z] of [[-0.3, -0.3], [0.3, -0.25], [0, 0], [-0.32, 0.3], [0.3, 0.32], [0, -0.4], [0.05, 0.4]]) h(0.3, 0.26, 0.3, 3.32, z, look.hairColor, x);
				break;
			case 'twists':
				top();
				for (const x of [-0.32, 0, 0.32]) for (const z of [-0.32, 0, 0.32]) h(0.2, 0.34, 0.2, 3.3, z, look.hairColor, x);
				break;
			case 'locs':
				h(1.0, 0.3, 1.0, 3.1);
				for (const x of [-0.42, -0.14, 0.14, 0.42]) h(0.16, 1.0, 0.16, 2.55, 0.42, look.hairColor, x);
				for (const z of [-0.2, 0.15]) for (const x of [-0.5, 0.5]) h(0.14, 0.8, 0.14, 2.65, z, look.hairColor, x);
				break;
			case 'cornrows':
				h(0.93, 0.06, 0.93, 3.1, 0, look.skin);
				for (const x of [-0.36, -0.18, 0, 0.18, 0.36]) h(0.1, 0.12, 0.96, 3.13, 0.02, look.hairColor, x);
				break;
			case 'mohawk':
				h(0.24, 0.5, 1.0, 3.3);
				break;
			case 'flattop':
				h(0.96, 0.6, 0.96, 3.35);
				break;
			case 'bun':
				top();
				h(0.42, 0.36, 0.42, 3.36, 0.12);
				break;
			case 'ponytail':
				top();
				h(0.96, 0.5, 0.16, 2.9, 0.47);
				h(0.24, 0.8, 0.24, 2.55, 0.6);
				break;
			case 'braids':
				// Two long braids down the back.
				h(0.96, 0.24, 0.96, 3.07);
				h(0.96, 0.4, 0.18, 2.85, 0.42);
				for (const x of [-0.25, 0.25]) for (let k = 0; k < 4; k++) h(0.17, 0.22, 0.17, 2.55 - k * 0.24, 0.5, look.hairColor, x + (k % 2 ? 0.03 : -0.03));
				break;
			case 'bob':
				// Chin length all round.
				h(1.0, 0.26, 1.0, 3.07);
				h(1.02, 0.6, 0.2, 2.7, 0.42);
				for (const x of [-0.5, 0.5]) h(0.14, 0.6, 0.84, 2.72, 0.02, look.hairColor, x);
				h(0.9, 0.16, 0.14, 3.0, -0.44);
				break;
			case 'spacebuns':
				top();
				for (const x of [-0.3, 0.3]) h(0.36, 0.34, 0.36, 3.33, -0.02, look.hairColor, x);
				break;
			case 'pigtails':
				top();
				h(0.96, 0.36, 0.18, 2.9, 0.42);
				for (const x of [-0.58, 0.58]) {
					h(0.2, 0.2, 0.2, 2.9, 0.12, look.hairColor, x);
					h(0.22, 0.55, 0.22, 2.6, 0.18, look.hairColor, x * 1.08);
				}
				break;
			case 'flow':
				// Steve Hash's flow: swept over, down to the neck.
				top();
				h(0.9, 0.2, 0.22, 3.02, -0.4);
				h(1.0, 0.65, 0.2, 2.75, 0.45);
				for (const x of [-0.5, 0.5]) h(0.12, 0.55, 0.75, 2.85, 0.05, look.hairColor, x);
				break;
			case 'long':
				top();
				h(1.0, 1.15, 0.2, 2.6, 0.45);
				for (const x of [-0.5, 0.5]) h(0.12, 0.85, 0.8, 2.75, 0.05, look.hairColor, x);
				break;
			case 'bald':
				break;
		}
	}
	// 3×5 pixel digits.
	const FONT: Record<string, string> = {
		'0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
		'5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111'
	};
	function digits(n: number, colour: string, hips: Three) {
		const s = String(Math.max(0, Math.min(99, Math.round(n))));
		const px = 0.13;
		const totalW = s.length * 3 * px + (s.length - 1) * px;
		s.split('').forEach((ch, i) => {
			const bits = FONT[ch];
			for (let r = 0; r < 5; r++)
				for (let c = 0; c < 3; c++)
					if (bits[r * 3 + c] == '1') {
						const m = new T.Mesh(new T.BoxGeometry(px, px, 0.04), mat(colour));
						// The back faces +z (the camera behind the player); read left to right from there.
						m.position.set(-totalW / 2 + i * 4 * px + c * px + px / 2, 1.55 - r * px, 0.47);
						hips.add(m);
					}
		});
	}

	let you = makeBaller(DEFAULT_LOOK);
	let cpu = makeBaller(CPU_LOOK);
	cpu.root.visible = false;
	let youJ: Joints | null = null;
	let cpuAnim: { name: AnimName; since: number } = { name: 'idle', since: 0 };
	let otherJ: Joints | null = null;
	let youHand: 'left' | 'right' = 'right';
	let otherHand: 'left' | 'right' = 'right';
	// Loops follow the clock (so the hands and the ball stay in step); one-offs play from their start.
	const cpuMs = (now: number) => (LOOPS.includes(cpuAnim.name) ? now : now - cpuAnim.since);

	// ── The ball ──
	const ball = new T.Group();
	function buildBall() {
		ball.clear();
		const bv: Vox[] = [];
		// Classic orange with seams; the dunk-contest red, white and blue; or gold.
		const colour = (x: number, y: number) =>
			style.ball == 'aba' ? ['#dc2626', '#f8fafc', '#2563eb'][x + 1] : style.ball == 'gold' ? (x == 0 || y == 0 ? '#ca8a04' : '#facc15') : x == 0 || y == 0 ? '#c2410c' : '#f97316';
		for (let x = -1; x <= 1; x++)
			for (let y = -1; y <= 1; y++)
				for (let z = -1; z <= 1; z++) if (Math.abs(x) + Math.abs(y) + Math.abs(z) < 3) bv.push({ x: x * 0.17, y: y * 0.17, z: z * 0.17, c: colour(x, y), s: 0.17 });
		voxels(bv, ball);
	}
	buildBall();
	buildNet();
	scene.add(ball);
	let mode: BallMode = { kind: 'hidden' };
	const v1 = new T.Vector3();
	const v2 = new T.Vector3();
	let lastBounce = 0;
	let api: Court;

	function holderOf(who: 'you' | 'cpu') {
		return who == 'you' ? you : cpu;
	}
	function placeBall(now: number) {
		ball.visible = mode.kind != 'hidden';
		if (mode.kind == 'hold') {
			const b = holderOf(mode.who);
			b.L.arm.hand.getWorldPosition(v1);
			b.R.arm.hand.getWorldPosition(v2);
			ball.position.lerpVectors(v1, v2, 0.5);
			// In front of them.
			ball.position.x += Math.sin(b.root.rotation.y) * -0.35;
			ball.position.z += Math.cos(b.root.rotation.y) * -0.35;
		} else if (mode.kind == 'dribble') {
			const b = holderOf(mode.who);
			const ds = mode.who == 'cpu' ? (otherJ ? { hand: otherHand, cross: null } : dribbleState(cpuAnim.name, cpuMs(now))) : { hand: youHand, cross: null };
			const fromHand = ds.hand == 'left' ? b.L.arm.hand : b.R.arm.hand;
			const toHand = ds.hand == 'left' ? b.R.arm.hand : b.L.arm.hand;
			fromHand.getWorldPosition(v1);
			const fx = Math.sin(b.root.rotation.y) * -0.45;
			const fz = Math.cos(b.root.rotation.y) * -0.45;
			if (ds.cross != null) {
				// A crossover: the ball skips low across the body to the other hand.
				toHand.getWorldPosition(v2);
				const k = ds.cross;
				ball.position.set(v1.x + (v2.x - v1.x) * k + fx, 0.35 + Math.abs(Math.cos(k * Math.PI)) * 0.5, v1.z + (v2.z - v1.z) * k + fz);
				if (Math.abs(k - 0.5) < 0.08 && now - lastBounce > 200) {
					lastBounce = now;
					api.onBounce();
				}
			} else {
				// Bounces between the hand and the floor, a little in front of it.
				const ph = ((now / 1000) * BOUNCE_HZ) % 1;
				const h = Math.abs(Math.cos(ph * Math.PI));
				ball.position.set(v1.x + fx, 0.3 + (Math.max(0.6, v1.y) - 0.3) * h, v1.z + fz);
				if (h < 0.08 && now - lastBounce > 250) {
					lastBounce = now;
					api.onBounce();
				}
			}
		} else if (mode.kind == 'flight') {
			const f = mode;
			const k = Math.min(1, (now - f.t0) / f.dur);
			if (f.blocked) {
				// Swatted away early.
				const to = new T.Vector3(f.from.x + 5, 0.4, f.from.z + 4);
				ball.position.lerpVectors(f.from, to, k);
				ball.position.y += Math.sin(k * Math.PI) * 2;
				if (k >= 1) finishFlight(f);
				return;
			}
			const to = new T.Vector3(HOOP.x + (f.made ? 0 : 0.85), HOOP.y + 0.35, HOOP.z);
			ball.position.lerpVectors(f.from, to, k);
			// A jumper arcs; a dunk goes straight down through.
			ball.position.y += f.dunk ? Math.sin(k * Math.PI) * 0.4 : Math.sin(k * Math.PI) * (2.4 + f.from.distanceTo(to) * 0.18);
			ball.rotation.x -= 0.22;
			if (k >= 1) {
				const after = (now - f.t0 - f.dur) / 650;
				if (f.made) {
					ball.position.set(HOOP.x, HOOP.y - after * 5, HOOP.z);
					net.scale.y = 1 + Math.sin(Math.min(1, after * 2) * Math.PI) * 0.35;
				} else ball.position.set(HOOP.x + 0.85 + after * 3, HOOP.y + 0.35 + Math.sin(after * Math.PI) * 1.6 - after * 3, HOOP.z + after * 2.5);
				if (after >= 1) finishFlight(f);
			}
		}
	}
	function finishFlight(f: Extract<BallMode, { kind: 'flight' }>) {
		mode = { kind: 'hidden' };
		net.scale.y = 1;
		f.done();
	}

	// ── Camera ──
	let camMode: CamMode = 'menu';
	let camCut = false;
	let compact = false;
	let camGlide = false;
	const camPos = new T.Vector3(0, 12, 20);
	const camLook = new T.Vector3(0, 4, -6);
	function updateCamera(now: number) {
		const y = you.root.position;
		const c = cpu.root.position;
		let pos: Three;
		let look: Three;
		if (camMode == 'menu') {
			const a = now / 9000;
			pos = new T.Vector3(Math.sin(a) * 22, 10 + Math.sin(a * 0.7) * 1.5, -3 + Math.cos(a) * 22);
			look = new T.Vector3(0, 3, -6);
		} else if (camMode == 'intro') {
			// A slow push in on the opponent, from the side.
			const a = (now / 5000) % 1;
			pos = new T.Vector3(c.x + 4.6 - a * 0.8, 4.3, c.z + 3.6 - a * 0.6);
			look = new T.Vector3(c.x, 3.6, c.z);
		} else if (camMode == 'crowd') {
			pos = new T.Vector3(2, 5.5, 1);
			look = new T.Vector3(-16, 2.5, -4 + Math.sin(now / 3000) * 3);
		} else if (camMode == 'skyline') {
			// High above the court (over the players' heads), looking out at the city.
			pos = new T.Vector3(Math.sin(now / 8000) * 3, 13, 13);
			look = new T.Vector3(0, 15, -46);
		} else if (camMode == 'locker') {
			// In front of your player, who stands left of the customising panel.
			// (Seen from the front, the screen's right is -x: aim right of them so they stand on the left.)
			// On a phone the menu takes the bottom half: centre them, in the top half.
			// (In front of the hoop's pole, a little to the side, and high enough to see all of them.)
			pos = compact ? new T.Vector3(y.x + 2.4, 6.2, y.z - 10.8) : new T.Vector3(y.x - 2.2, 4.4, y.z - 10.5);
			look = compact ? new T.Vector3(y.x, -2.2, y.z) : new T.Vector3(y.x - 3.6, 3.1, y.z);
		} else if (camMode == 'defense') {
			// High behind the hoop (see-through), looking down at the ball handler over your shoulder.
			pos = new T.Vector3(y.x * 0.5, 13, -16.5);
			look = new T.Vector3(c.x, 1.5, c.z + 1);
		} else {
			pos = new T.Vector3(y.x * 0.7, 7.2, y.z + 8.5);
			look = new T.Vector3(y.x * 0.3, 4.6, Math.min(y.z - 6, -7));
		}
		hoopFade += ((camMode == 'defense' ? 0.18 : 1) - hoopFade) * 0.1;
		for (const m of [...hoopMeshes, ...boardMeshes, ...netMeshes]) m.material.opacity = hoopFade;
		if (camCut) {
			camPos.copy(pos);
			camLook.copy(look);
			camCut = false;
		}
		const snap = camMode == 'menu' || camMode == 'skyline' || camMode == 'crowd';
		const k = camGlide ? 0.03 : snap ? 0.25 : 0.08;
		camPos.lerp(pos, k);
		camLook.lerp(look, camGlide ? 0.035 : snap ? 0.25 : 0.1);
		if (camGlide && camPos.distanceTo(pos) < 0.05) camGlide = false;
		camera.position.copy(camPos);
		camera.lookAt(camLook);
	}

	// ── Loop ──
	let raf = 0;
	const resize = () => {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const pr = renderer.getPixelRatio();
		if (w && h && (canvas.width != Math.round(w * pr) || canvas.height != Math.round(h * pr))) {
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		}
		// Tall, narrow screens (phones held upright) see more with a wider view.
		const fov = camera.aspect < 0.8 ? 78 : 52;
		if (camera.fov != fov) {
			camera.fov = fov;
			camera.updateProjectionMatrix();
		}
	};
	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		resize();
		you.set(youJ ?? animate(camMode == 'menu' || camMode == 'locker' ? 'dribble' : 'idle', now), youJ ? 0.5 : 0.3);
		cpu.set(otherJ ?? animate(cpuAnim.name, cpuMs(now)), otherJ ? 0.4 : 0.35);
		clouds.position.x = Math.sin(now / 40000) * 6;
		animateCrowd(now);
		placeBall(now);
		updateCamera(now);
		renderer.render(scene, camera);
	};
	raf = requestAnimationFrame(loop);

	/**
	 * Turns a player toward where they should face, a little at a time (a defender takes a beat to
	 * catch up when the ball handler goes round them).
	 */
	function turn(root: Three, facing: Facing) {
		// The rig faces -z at rotation 0; facing a direction (dx, dz) is atan2(-dx, -dz).
		const want = typeof facing == 'number' ? (facing < 0 ? 0 : Math.PI) : Math.atan2(-(facing.x - root.position.x), -(facing.z - root.position.z));
		const u = root.userData as { yaw?: number; spinAt?: number };
		let yaw = u.yaw ?? root.rotation.y;
		let d = want - yaw;
		d = Math.atan2(Math.sin(d), Math.cos(d));
		yaw += d * 0.18;
		u.yaw = yaw;
		// A spin move: one full turn on top of the heading.
		let extra = 0;
		if (u.spinAt) {
			const k = (performance.now() - u.spinAt) / 620;
			if (k >= 1) u.spinAt = 0;
			else extra = (1 - (1 - k) ** 2) * Math.PI * 2;
		}
		root.rotation.y = yaw + extra;
	}

	api = {
		onBounce: () => {},
		setYou(j, x, z, facing) {
			youJ = j;
			you.root.position.x += (x - you.root.position.x) * 0.35;
			you.root.position.z += (z - you.root.position.z) * 0.35;
			turn(you.root, facing);
		},
		setOther(j, x, z, facing) {
			otherJ = j;
			cpu.root.position.x += (x - cpu.root.position.x) * 0.3;
			cpu.root.position.z += (z - cpu.root.position.z) * 0.3;
			turn(cpu.root, facing);
		},
		setCpu(x, z, facing, anim, since) {
			otherJ = null;
			cpu.root.position.x += (x - cpu.root.position.x) * 0.3;
			cpu.root.position.z += (z - cpu.root.position.z) * 0.3;
			turn(cpu.root, facing);
			cpuAnim = { name: anim, since };
		},
		showCpu(on) {
			cpu.root.visible = on;
		},
		setCpuLook(look) {
			const at = cpu.root.position.clone();
			const vis = cpu.root.visible;
			cpu.dispose();
			cpu = makeBaller(look);
			cpu.root.position.copy(at);
			cpu.root.visible = vis;
		},
		setCrowd,
		setStyle(st) {
			const was = style;
			style = { ...st };
			if (was.floor.join() != st.floor.join() || was.key != st.key || was.decal != st.decal) buildCourt();
			if (was.board != st.board) buildBoard();
			if (was.net != st.net) buildNet();
			if (was.ball != st.ball) buildBall();
		},
		cheer() {
			excite = 1;
		},
		setLook(look) {
			const at = you.root.position.clone();
			const rot = you.root.rotation.y;
			you.dispose();
			you = makeBaller(look);
			you.root.position.copy(at);
			you.root.rotation.y = rot;
		},
		ball(m, who = 'you') {
			if (mode.kind == 'flight') return;
			mode = m == 'hidden' ? { kind: 'hidden' } : { kind: m, who };
		},
		shoot(made, blocked = false, dunk = false) {
			const from = ball.position.clone();
			const dur = blocked ? 600 : dunk ? 330 : 950 + from.distanceTo(new T.Vector3(HOOP.x, HOOP.y, HOOP.z)) * 22;
			if (dunk && made) {
				excite = 1;
				net.scale.y = 1.4;
			}
			return new Promise<void>((resolve) => {
				let settled = false;
				const done = () => {
					if (settled) return;
					settled = true;
					resolve();
				};
				mode = { kind: 'flight', from, t0: performance.now(), dur, made, blocked, dunk, done };
				// If the page isn't drawing (a background tab), the game still goes on.
				setTimeout(() => {
					if (!settled && mode.kind == 'flight' && mode.done == done) mode = { kind: 'hidden' };
					done();
				}, dur + 1200);
			});
		},
		camera(m, move) {
			camMode = m;
			camCut = move == 'cut';
			camGlide = move == 'glide';
		},
		spin(who) {
			(who == 'you' ? you : cpu).root.userData.spinAt = performance.now();
		},
		setCompact(on) {
			compact = on;
		},
		setOtherHand(h) {
			otherHand = h;
		},
		setYouHand(h) {
			if (h) youHand = h;
		},
		dispose() {
			cancelAnimationFrame(raf);
			renderer.dispose();
		}
	};
	return api;
}
