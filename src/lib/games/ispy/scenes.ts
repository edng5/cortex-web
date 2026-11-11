// iSpy's scenes, drawn in code: a room or place, and the spots where things belong in it
// (books on shelves, fruit on the counter, frogs in the pond), so a level reads as a real scene.

export const SCENES = ['bedroom', 'garden', 'ocean', 'space', 'kitchen', 'jungle'] as const;
export type Scene = (typeof SCENES)[number];

/**
 * Where things go. Things rest on the ground between y0 and y1 (y0 = y1: a shelf), or float
 * there (sky, water, space). Things further back (smaller y) are drawn smaller when `depth`.
 */
export interface Spot {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
	/** Size, relative to the level's thing size. */
	s: number;
	float?: boolean;
	depth?: boolean;
	/** How busy it is (1: as many as fit). */
	w?: number;
	/** Keep out of this ellipse (cx, cy, rx, ry). */
	avoid?: [number, number, number, number];
	/** Names of the things that belong here (see ITEMS). */
	pool: string[];
}

const TOYS = ['basketball', 'fire truck', 'taxi', '8-ball', 'dinosaur', 'teddy bear', 'cap', 'boxing glove', 'space invader', 'balloon', 'ghost'];
const FRUIT = ['apple', 'strawberry', 'cherries', 'tomato', 'orange', 'carrot', 'banana', 'lemon', 'corn', 'broccoli', 'cucumber', 'green apple', 'blueberries', 'grapes', 'eggplant', 'potato', 'pineapple'];

export const SPOTS: Record<Scene, Spot[]> = {
	bedroom: [
		...[230, 310, 390].map((y) => ({
			x0: 58, x1: 252, y0: y, y1: y, s: 0.62,
			pool: ['book', 'gem', 'crystal ball', 'ribbon', 'star', 'magnet', 'space invader', '8-ball', 'sunglasses', 'cap', 'top hat', 'teddy bear', 'violin']
		})),
		{ x0: 668, x1: 812, y0: 300, y1: 300, s: 0.58, pool: ['cactus', 'blossom', 'rose', 'sunflower', 'clover'] },
		{ x0: 640, x1: 860, y0: 456, y1: 456, s: 0.72, pool: ['teddy bear', 'pig', 'ghost', 'book', 'ribbon', 'dinosaur', 'sheep'] },
		{ x0: 300, x1: 520, y0: 450, y1: 560, s: 0.85, depth: true, pool: TOYS },
		{ x0: 40, x1: 880, y0: 585, y1: 628, s: 1, depth: true, pool: [...TOYS, 'violin', 'book'] }
	],
	garden: [
		{ x0: 300, x1: 620, y0: 160, y1: 270, s: 0.72, float: true, pool: ['balloon', 'cloud', 'butterfly', 'bee'] },
		{ x0: 668, x1: 852, y0: 175, y1: 300, s: 0.6, float: true, pool: ['apple', 'cherries', 'green apple', 'lemon', 'orange', 'bee'] },
		{ x0: 392, x1: 628, y0: 414, y1: 414, s: 0.68, pool: ['rose', 'sunflower', 'blossom', 'clover', 'mushroom', 'carrot', 'pumpkin', 'strawberry', 'broccoli'] },
		{ x0: 140, x1: 360, y0: 520, y1: 560, s: 0.85, depth: true, pool: ['frog', 'turtle', 'swan', 'fish'] },
		{
			x0: 20, x1: 880, y0: 450, y1: 628, s: 1, depth: true, avoid: [250, 540, 175, 72],
			pool: ['sheep', 'pig', 'fox', 'chick', 'frog', 'turtle', 'ladybug', 'basketball', 'cap', 'mushroom', 'pumpkin', 'log', 'sunflower', 'rose']
		}
	],
	ocean: [
		{ x0: 40, x1: 860, y0: 170, y1: 480, s: 0.95, float: true, avoid: [600, 545, 70, 40], pool: ['whale', 'fish', 'dolphin', 'turtle', 'fish', 'dolphin'] },
		{ x0: 572, x1: 640, y0: 516, y1: 516, s: 0.52, pool: ['gem', 'crystal ball', 'ribbon', 'star'] },
		{
			x0: 30, x1: 870, y0: 590, y1: 630, s: 0.9, depth: true,
			pool: ['crab', 'crab', 'gem', 'crystal ball', '8-ball', 'top hat', 'sunglasses', 'cap', 'log', 'star', 'magnet', 'egg']
		}
	],
	space: [
		{ x0: 40, x1: 860, y0: 170, y1: 450, s: 0.82, float: true, avoid: [760, 230, 120, 70], pool: ['star', 'space invader', 'alien', 'ghost', 'crystal ball', 'gem', 'balloon', 'star'] },
		{ x0: 30, x1: 870, y0: 540, y1: 628, s: 0.95, depth: true, pool: ['alien', 'cheese', '8-ball', 'top hat', 'sunglasses', 'basketball', 'egg', 'gem', 'mushroom', 'dinosaur'] }
	],
	kitchen: [
		{ x0: 84, x1: 386, y0: 300, y1: 300, s: 0.6, pool: ['cookie', 'cheese', 'donut', 'egg', 'potato', 'eggplant', 'pineapple', 'corn', 'blueberries', 'grapes', 'pumpkin'] },
		{ x0: 24, x1: 668, y0: 410, y1: 432, s: 0.8, depth: true, pool: [...FRUIT, 'cookie', 'donut', 'egg', 'cheese', 'mushroom', 'pumpkin'] },
		{ x0: 712, x1: 860, y0: 190, y1: 600, s: 0.5, float: true, w: 0.35, avoid: [785, 338, 100, 10], pool: ['magnet', 'star', 'ribbon', 'blossom', 'clover', 'gem'] },
		{ x0: 708, x1: 862, y0: 152, y1: 152, s: 0.6, pool: ['cookie', 'toilet roll', 'pumpkin', 'cheese'] }
	],
	jungle: [
		{ x0: 30, x1: 360, y0: 246, y1: 246, s: 0.72, pool: ['parrot', 'monkey', 'spider', 'snake', 'chick', 'banana', 'coconut', 'pineapple'] },
		{ x0: 540, x1: 880, y0: 326, y1: 326, s: 0.72, pool: ['parrot', 'monkey', 'spider', 'snake', 'banana', 'coconut', 'butterfly'] },
		{ x0: 400, x1: 880, y0: 165, y1: 270, s: 0.6, float: true, w: 0.5, pool: ['butterfly', 'bee', 'parrot', 'butterfly'] },
		{ x0: 30, x1: 870, y0: 508, y1: 522, s: 0.85, depth: true, pool: ['crocodile', 'frog', 'turtle', 'fish', 'flamingo'] },
		{
			x0: 20, x1: 880, y0: 565, y1: 630, s: 1, depth: true,
			pool: ['tiger', 'gorilla', 'fox', 'dinosaur', 'frog', 'turtle', 'mushroom', 'log', 'pumpkin', 'banana', 'coconut', 'snake', 'flamingo', 'monkey']
		}
	]
};

/** Some things are bigger or smaller than others. */
export const SCALE: Record<string, number> = {
	whale: 1.45, dolphin: 1.2, gorilla: 1.2, tiger: 1.15, crocodile: 1.25, flamingo: 1.1, sheep: 1.1, pig: 1.05,
	butterfly: 0.75, bee: 0.7, ladybug: 0.7, spider: 0.75, cherries: 0.85, blueberries: 0.85, magnet: 0.9, egg: 0.85
};

// ── Drawing ──
type Ctx = CanvasRenderingContext2D;

function grad(ctx: Ctx, w: number, a: string, b: string, y0: number, y1: number) {
	const g = ctx.createLinearGradient(0, y0, 0, y1);
	g.addColorStop(0, a);
	g.addColorStop(1, b);
	ctx.fillStyle = g;
	ctx.fillRect(0, y0, w, y1 - y0);
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, r = 0) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
	ctx.fill();
}
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();
}
/** A wavy top edge, filled down to `bottom`. */
function wave(ctx: Ctx, w: number, y: number, amp: number, len: number, bottom: number, fill: string | CanvasGradient, phase = 0) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.moveTo(0, bottom);
	for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y + Math.sin(x / len + phase) * amp);
	ctx.lineTo(w, bottom);
	ctx.fill();
}

export function drawScene(ctx: Ctx, scene: Scene, W: number, H: number, now = 0) {
	ctx.save();
	if (scene == 'bedroom') {
		grad(ctx, W, '#fde68a', '#fbbf24', 0, 400);
		ctx.fillStyle = 'rgba(255,255,255,0.22)';
		for (let x = 0; x < W; x += 60) ctx.fillRect(x, 0, 24, 400);
		grad(ctx, W, '#c99a5e', '#9a6a36', 400, H);
		ctx.strokeStyle = 'rgba(80,45,15,0.25)';
		ctx.lineWidth = 2;
		for (let y = 430; y < H; y += 34) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(W, y);
			ctx.stroke();
		}
		box(ctx, 0, 394, W, 12, '#fff7ed');
		// Window, curtains and sill.
		box(ctx, 650, 150, 180, 150, '#bae6fd');
		ellipse(ctx, 700, 205, 30, 12, '#fff');
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 8;
		ctx.strokeRect(650, 150, 180, 150);
		ctx.beginPath();
		ctx.moveTo(740, 150);
		ctx.lineTo(740, 300);
		ctx.moveTo(650, 225);
		ctx.lineTo(830, 225);
		ctx.stroke();
		box(ctx, 626, 142, 34, 170, '#f472b6', 6);
		box(ctx, 820, 142, 34, 170, '#f472b6', 6);
		box(ctx, 640, 300, 200, 12, '#fff7ed', 3);
		// Bookshelf.
		box(ctx, 40, 150, 230, 256, '#7c4a1e', 6);
		box(ctx, 52, 162, 206, 232, '#5b3413', 3);
		for (const y of [230, 310, 390]) box(ctx, 46, y, 218, 10, '#92582a', 2);
		// Bed.
		box(ctx, 540, 400, 26, 180, '#7c4a1e', 6);
		box(ctx, 560, 456, 320, 60, '#f8fafc', 10);
		box(ctx, 610, 452, 270, 70, '#60a5fa', 12);
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		for (let x = 630; x < 870; x += 40) ctx.fillRect(x, 452, 14, 70);
		box(ctx, 566, 432, 70, 30, '#fff', 14);
		box(ctx, 566, 520, 12, 60, '#5b3413');
		box(ctx, 862, 520, 12, 60, '#5b3413');
		// Rug.
		ellipse(ctx, 330, 590, 200, 42, '#a78bfa');
		ellipse(ctx, 330, 590, 160, 30, '#c4b5fd');
	} else if (scene == 'garden') {
		grad(ctx, W, '#60c5f8', '#e0f2fe', 0, 340);
		ellipse(ctx, 860, 50, 70, 70, '#fde047');
		for (const [x, y, s] of [[440, 180, 1], [600, 115, 0.8], [180, 190, 0.7]]) {
			ellipse(ctx, x, y, 50 * s, 22 * s, '#fff');
			ellipse(ctx, x - 30 * s, y + 6 * s, 34 * s, 16 * s, '#fff');
			ellipse(ctx, x + 34 * s, y + 6 * s, 30 * s, 15 * s, '#fff');
		}
		ellipse(ctx, 200, 360, 420, 70, '#4ade80');
		ellipse(ctx, 760, 370, 380, 60, '#86efac');
		grad(ctx, W, '#86efac', '#15803d', 340, H);
		// Picket fence.
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 318, 650, 8);
		ctx.fillRect(0, 340, 650, 8);
		for (let x = 6; x < 640; x += 28) {
			ctx.beginPath();
			ctx.moveTo(x, 360);
			ctx.lineTo(x, 304);
			ctx.lineTo(x + 8, 296);
			ctx.lineTo(x + 16, 304);
			ctx.lineTo(x + 16, 360);
			ctx.fill();
		}
		// Flower bed.
		box(ctx, 380, 404, 260, 26, '#7c4a1e', 12);
		// Tree.
		box(ctx, 738, 250, 44, 190, '#7c4a1e', 6);
		ellipse(ctx, 690, 262, 82, 70, '#16a34a');
		ellipse(ctx, 830, 262, 82, 70, '#16a34a');
		ellipse(ctx, 760, 220, 112, 92, '#22c55e');
		// Pond.
		ellipse(ctx, 250, 540, 175, 72, '#a3e635');
		ellipse(ctx, 250, 540, 160, 60, '#38bdf8');
		ellipse(ctx, 210, 525, 60, 12, 'rgba(255,255,255,0.35)');
		ctx.strokeStyle = '#15803d';
		ctx.lineWidth = 3;
		for (let i = 0; i < 40; i++) {
			const x = (i * 157) % W;
			const y = 450 + ((i * 89) % 180);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - 4, y - 10);
			ctx.moveTo(x, y);
			ctx.lineTo(x + 4, y - 10);
			ctx.stroke();
		}
	} else if (scene == 'ocean') {
		grad(ctx, W, '#38bdf8', '#0c4a6e', 0, H);
		ctx.fillStyle = 'rgba(255,255,255,0.08)';
		for (const x of [120, 380, 640]) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x + 90, 0);
			ctx.lineTo(x + 230, 600);
			ctx.lineTo(x + 80, 600);
			ctx.fill();
		}
		const sand = ctx.createLinearGradient(0, 560, 0, H);
		sand.addColorStop(0, '#fcd34d');
		sand.addColorStop(1, '#c2790a');
		wave(ctx, W, 572, 8, 70, H, sand);
		// Rocks and seaweed.
		ellipse(ctx, 110, 590, 80, 34, '#57534e');
		ellipse(ctx, 820, 586, 70, 36, '#44403c');
		ctx.strokeStyle = '#15803d';
		ctx.lineWidth = 9;
		ctx.lineCap = 'round';
		for (const [x, h] of [[60, 200], [96, 150], [470, 120], [780, 220], [850, 160]]) {
			ctx.beginPath();
			ctx.moveTo(x, 590);
			for (let y = 0; y <= h; y += 10) ctx.lineTo(x + Math.sin(y / 22 + now / 700 + x) * 10, 590 - y);
			ctx.stroke();
		}
		// Treasure chest.
		box(ctx, 560, 520, 90, 54, '#92400e', 6);
		box(ctx, 560, 512, 90, 14, '#b45309', 6);
		box(ctx, 598, 530, 14, 18, '#facc15', 3);
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		for (let i = 0; i < 14; i++) {
			ctx.beginPath();
			ctx.arc((i * 137) % W, (((i * 211) % 420) + 160 - now / 30) % 420 + 150, 4 + (i % 3) * 3, 0, Math.PI * 2);
			ctx.fill();
		}
	} else if (scene == 'space') {
		grad(ctx, W, '#1e1b4b', '#020617', 0, H);
		ellipse(ctx, 300, 300, 260, 120, 'rgba(168,85,247,0.12)');
		ellipse(ctx, 620, 380, 220, 90, 'rgba(56,189,248,0.08)');
		ctx.fillStyle = '#fff';
		for (let i = 0; i < 110; i++) {
			const s = i % 7 == 0 ? 3 : 1.6;
			ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 500 + i);
			ctx.fillRect((i * 97) % W, (i * 53) % 540, s, s);
		}
		ctx.globalAlpha = 1;
		// Ringed planet and a little Earth.
		ellipse(ctx, 760, 230, 58, 58, '#c084fc');
		ellipse(ctx, 745, 215, 20, 10, 'rgba(255,255,255,0.25)');
		ctx.strokeStyle = '#f0abfc';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.ellipse(760, 230, 100, 20, -0.3, 0, Math.PI * 2);
		ctx.stroke();
		ellipse(ctx, 640, 170, 22, 22, '#3b82f6');
		ellipse(ctx, 634, 166, 9, 7, '#22c55e');
		// The moon's surface.
		const ground = ctx.createLinearGradient(0, 520, 0, H);
		ground.addColorStop(0, '#cbd5e1');
		ground.addColorStop(1, '#64748b');
		wave(ctx, W, 532, 12, 90, H, ground, 1);
		for (const [x, y, r] of [[120, 580, 40], [420, 610, 30], [700, 570, 46], [280, 560, 18], [860, 620, 26]]) {
			ellipse(ctx, x, y, r, r * 0.3, '#94a3b8');
			ellipse(ctx, x, y + 2, r * 0.8, r * 0.22, '#7c8a9e');
		}
	} else if (scene == 'kitchen') {
		grad(ctx, W, '#ecfeff', '#cffafe', 0, 420);
		ctx.fillStyle = 'rgba(14,116,144,0.1)';
		for (let x = 0; x < W; x += 40) for (let y = 0; y < 420; y += 40) if ((x + y) % 80 == 0) ctx.fillRect(x, y, 40, 40);
		// Window.
		box(ctx, 440, 160, 180, 130, '#7dd3fc');
		ellipse(ctx, 560, 190, 26, 26, '#fde047');
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 8;
		ctx.strokeRect(440, 160, 180, 130);
		ctx.beginPath();
		ctx.moveTo(530, 160);
		ctx.lineTo(530, 290);
		ctx.stroke();
		// Shelf.
		box(ctx, 70, 300, 330, 12, '#a16207', 3);
		box(ctx, 100, 312, 10, 24, '#854d0e');
		box(ctx, 360, 312, 10, 24, '#854d0e');
		// Counter and cupboards.
		box(ctx, 0, 432, 690, H - 432, '#e7e5e4');
		for (let x = 12; x < 680; x += 112) {
			box(ctx, x, 452, 100, 170, '#f5f5f4', 6);
			box(ctx, x + 44, 470, 12, 4, '#78716c', 2);
		}
		box(ctx, 0, 418, 690, 18, '#b45309', 3);
		// Fridge.
		box(ctx, 696, 152, 180, H - 152, '#f8fafc', 14);
		ctx.fillStyle = '#cbd5e1';
		ctx.fillRect(696, 336, 180, 4);
		box(ctx, 712, 260, 8, 60, '#94a3b8', 4);
		box(ctx, 712, 360, 8, 80, '#94a3b8', 4);
	} else {
		grad(ctx, W, '#15803d', '#052e16', 0, 480);
		ctx.fillStyle = 'rgba(2,44,22,0.55)';
		for (const x of [90, 240, 470, 690, 820]) ctx.fillRect(x, 0, 34, 480);
		ctx.strokeStyle = 'rgba(74,222,128,0.6)';
		ctx.lineWidth = 3;
		for (let i = 0; i < 9; i++) {
			const x = 40 + i * 100;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.quadraticCurveTo(x + 20, 80, x - 6, 120 + (i % 3) * 40);
			ctx.stroke();
		}
		for (let i = 0; i < 16; i++) {
			ctx.fillStyle = i % 2 ? '#16a34a' : '#22c55e';
			ctx.beginPath();
			ctx.ellipse((i * 121) % W, 10 + (i % 3) * 20, 70, 24, (i % 4) * 0.5 - 0.7, 0, Math.PI * 2);
			ctx.fill();
		}
		// Branches.
		box(ctx, 0, 246, 380, 16, '#78350f', 8);
		box(ctx, 520, 326, 380, 16, '#78350f', 8);
		// River and the ground.
		grad(ctx, W, '#0ea5e9', '#0369a1', 470, 540);
		ctx.strokeStyle = 'rgba(255,255,255,0.3)';
		ctx.lineWidth = 2;
		for (let i = 0; i < 10; i++) {
			const x = ((i * 97 + now / 20) % (W + 60)) - 30;
			ctx.beginPath();
			ctx.moveTo(x, 490 + (i % 3) * 14);
			ctx.lineTo(x + 30, 490 + (i % 3) * 14);
			ctx.stroke();
		}
		const ground = ctx.createLinearGradient(0, 530, 0, H);
		ground.addColorStop(0, '#4d7c0f');
		ground.addColorStop(1, '#1a2e05');
		wave(ctx, W, 540, 5, 50, H, ground);
		ctx.strokeStyle = '#65a30d';
		ctx.lineWidth = 3;
		for (let i = 0; i < 36; i++) {
			const x = (i * 157) % W;
			const y = 560 + ((i * 41) % 70);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - 5, y - 12);
			ctx.moveTo(x, y);
			ctx.lineTo(x + 5, y - 12);
			ctx.stroke();
		}
	}
	ctx.restore();
}
