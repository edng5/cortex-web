<!--
  The shop floor, in Frogger's oblique voxel style: bevelled floor tiles under ceiling-light pools,
  a back wall with windows and shelves, tanks on wooden stands (fish swimming in the water you look
  down into), decorations, the counter and the door. Voxel people walk about on real paths:
  customers come in, browse the tanks and leave (with a fish bag when they bought something); staff
  head to whatever tank they're working on, and one minds the till. Tap a tank to manage it; in
  Layout mode, tap something, then tap where it should go.
-->
<script lang="ts" module>
	export type FloorPick = { kind: 'sale' | 'show' | 'decor' | 'shelf'; id: number } | null;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { DEFAULT_LOOK, FLOORS, GRID_H, GRID_W, SUPPLIES, TANK_LIGHTS, TANK_STANDS, TANK_TRIMS, species, tier, type StoreItem, type TankLook } from './data';
	import { bx, drawVoxel, model, shade, type Box } from '../voxel';
	import type { FishStore } from './store.svelte';

	let {
		store,
		layout = false,
		picked = null,
		ontap
	}: { store: FishStore; layout?: boolean; picked?: FloorPick; ontap: (x: number, y: number) => void } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let wrap = $state<HTMLDivElement>();
	let hover = $state<[number, number] | null>(null);
	let T = 40;
	/** Phones: the floor is bigger than the screen, and you drag to look around. */
	let pan = $state(false);
	let drag: { x: number; y: number; sl: number; st: number; moved: boolean } | null = null;
	const ZF = 0.72;
	const wallH = () => Math.round(T * 1.9);
	const DOOR: [number, number] = [5, GRID_H - 1];
	const TILL: [number, number] = [1, GRID_H - 2];
	const PAY: [number, number] = [2, GRID_H - 1];

	// ── People ─────────────────────────────────────────────────────────────────────────
	interface Look {
		shirt: string;
		pants: string;
		skin: string;
		hair: string;
	}
	interface Agent {
		id: number;
		kind: 'cust' | 'staff';
		staffId?: number;
		x: number;
		y: number;
		path: [number, number][];
		wait: number;
		goal: 'browse' | 'pay' | 'leave' | 'work' | 'idle' | 'till';
		visits: number;
		bag: string | null;
		look: Look;
		phase: number;
		dir: 1 | -1;
		/** Which way they face (they turn to face where they walk). */
		face: 'down' | 'up' | 'left' | 'right';
		moving: boolean;
	}
	const SHIRTS = ['#e85a5a', '#5a8ae8', '#f0c040', '#9a5ae8', '#4ac08a', '#f08a3a', '#e8e8e8', '#3a3a48', '#e86ab0'];
	const PANTS = ['#2a3a6a', '#3a3a3a', '#6a4a2a', '#4a6a8a', '#2a2a2a'];
	const SKINS = ['#f4d0b0', '#e0b090', '#c08a60', '#8a5a3a', '#5a3a28', '#f8dcc8'];
	const HAIRS = ['#2a1a10', '#6a4220', '#c89040', '#1a1a1a', '#a03a20', '#e8e0d0', '#5a3a6a'];
	const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
	const agents: Agent[] = [];
	let seq = 0;
	let lastSold = -1;
	let buyers = 0;
	let spawnIn = 1;

	function grid() {
		return store.walkGrid();
	}
	function free(g: boolean[][], x: number, y: number) {
		return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && !g[y][x];
	}
	/** Shortest walk between cells (breadth-first), or null. */
	function route(g: boolean[][], from: [number, number], to: [number, number]): [number, number][] | null {
		const key = (x: number, y: number) => y * GRID_W + x;
		const prev = new Map<number, number>();
		const q: [number, number][] = [from];
		prev.set(key(...from), -1);
		while (q.length) {
			const [x, y] = q.shift()!;
			if (x === to[0] && y === to[1]) {
				const path: [number, number][] = [];
				let k = key(x, y);
				while (k !== -1) {
					path.unshift([k % GRID_W, Math.floor(k / GRID_W)]);
					k = prev.get(k)!;
				}
				return path;
			}
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if ((free(g, nx, ny) || (nx === to[0] && ny === to[1])) && !prev.has(key(nx, ny))) {
					prev.set(key(nx, ny), key(x, y));
					q.push([nx, ny]);
				}
			}
		}
		return null;
	}
	/** A free cell next to something (in front first, so people face the glass). */
	function beside(g: boolean[][], x: number, y: number, w: number, h: number): [number, number] | null {
		const opts: [number, number][] = [];
		for (let i = x; i < x + w; i++) opts.push([i, y + h]);
		for (let j = y; j < y + h; j++) opts.push([x - 1, j], [x + w, j]);
		for (let i = x; i < x + w; i++) opts.push([i, y - 1]);
		const ok = opts.filter(([a, b]) => free(g, a, b));
		return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
	}
	function cellOf(a: Agent): [number, number] {
		return [Math.max(0, Math.min(GRID_W - 1, Math.floor(a.x))), Math.max(0, Math.min(GRID_H - 1, Math.floor(a.y)))];
	}
	function goTo(a: Agent, to: [number, number] | null) {
		if (!to) return false;
		const p = route(grid(), cellOf(a), to);
		if (!p) return false;
		a.path = p.slice(1);
		return true;
	}
	function tanks() {
		return [
			...store.s.sale.filter((t) => t.ready).map((t) => ({ x: t.x, y: t.y, w: tier(t.tier).w, h: 1, id: t.id })),
			...store.s.show.filter((t) => t.ready).map((t) => ({ x: t.x, y: t.y, w: Math.min(GRID_W, 2 * t.seg), h: 2, id: t.id }))
		];
	}
	function allTanks() {
		return [
			...store.s.sale.map((t) => ({ x: t.x, y: t.y, w: tier(t.tier).w, h: 1, id: t.id })),
			...store.s.show.map((t) => ({ x: t.x, y: t.y, w: Math.min(GRID_W, 2 * t.seg), h: 2, id: t.id }))
		];
	}
	function nextBrowse(a: Agent) {
		const ts = tanks();
		if (!ts.length || a.visits >= 3) return leave(a);
		a.goal = 'browse';
		a.visits++;
		// Some stop at the supply shelf for food and gear.
		if (Math.random() < 0.3) {
			const sh = store.s.shelf;
			if (goTo(a, beside(grid(), sh.x, sh.y, 2, 1))) return;
		}
		const t = pick(ts);
		if (!goTo(a, beside(grid(), t.x, t.y, t.w, t.h))) leave(a);
	}
	function leave(a: Agent) {
		a.goal = 'leave';
		goTo(a, [DOOR[0] + (Math.random() < 0.5 ? 0 : 1), DOOR[1]]);
	}
	function newLook(staff: boolean): Look {
		return { shirt: staff ? '#f4f4f4' : pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS) };
	}

	function updatePeople(dt: number) {
		const s = store.s;
		// Staff: one person per employee.
		for (const p of s.staff)
			if (!agents.some((a) => a.kind === 'staff' && a.staffId === p.id))
				agents.push({ id: ++seq, kind: 'staff', staffId: p.id, x: TILL[0] + 0.5, y: TILL[1] + 0.5, path: [], wait: 0, goal: 'idle', visits: 0, bag: null, look: newLook(true), phase: Math.random() * 6, dir: 1, face: 'down', moving: false });
		for (let i = agents.length - 1; i >= 0; i--) {
			const a = agents[i];
			if (a.kind === 'staff' && !s.staff.some((p) => p.id === a.staffId)) agents.splice(i, 1);
		}
		// Sales: someone walks out with a fish.
		if (lastSold < 0) lastSold = s.sold;
		if (s.sold > lastSold) {
			buyers = Math.min(4, buyers + (s.sold - lastSold));
			lastSold = s.sold;
		}
		// Customers drift in, more for a popular store.
		const pop = store.popularity();
		const want = Math.min(9, 1 + Math.round(pop / 13));
		const custs = agents.filter((a) => a.kind === 'cust');
		spawnIn -= dt;
		if ((custs.length < want || buyers > 0) && spawnIn <= 0) {
			spawnIn = 2 + Math.random() * 4;
			const a: Agent = { id: ++seq, kind: 'cust', x: DOOR[0] + 0.5 + (Math.random() < 0.5 ? 0 : 1), y: DOOR[1] + 0.5, path: [], wait: 0, goal: 'browse', visits: 0, bag: null, look: newLook(false), phase: Math.random() * 6, dir: 1, face: 'down', moving: false };
			agents.push(a);
			nextBrowse(a);
		}
		const busy = new Map(s.tasks.map((t) => [t.staff, t]));
		for (let i = agents.length - 1; i >= 0; i--) {
			const a = agents[i];
			// Walk.
			if (a.path.length) {
				const [cx, cy] = a.path[0];
				const tx = cx + 0.5;
				const ty = cy + 0.5;
				const dx = tx - a.x;
				const dy = ty - a.y;
				const d = Math.hypot(dx, dy);
				const sp = (a.kind === 'staff' ? 2.2 : 1.6) * dt;
				if (d <= sp) {
					a.x = tx;
					a.y = ty;
					a.path.shift();
				} else {
					a.x += (dx / d) * sp;
					a.y += (dy / d) * sp;
				}
				if (Math.abs(dx) > 0.05) a.dir = dx > 0 ? 1 : -1;
				if (d > 0.02) a.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
				a.moving = true;
				a.phase += dt * 10;
				continue;
			}
			a.moving = false;
			if (a.wait > 0) {
				a.wait -= dt;
				continue;
			}
			if (a.kind === 'cust') {
				if (a.goal === 'leave') {
					agents.splice(i, 1);
					continue;
				}
				if (a.goal === 'pay') {
					a.bag = pick(['#f08a1a', '#3a6ad8', '#d8423a', '#f0d020', '#4ad0e8']);
					buyers = Math.max(0, buyers - 1);
					a.wait = 1.2;
					leave(a);
					continue;
				}
				// Browsing: look a while, then buy (if someone just did) or move on.
				a.wait = 2 + Math.random() * 4;
				if (buyers > 0 && !a.bag && a.visits >= 1) {
					a.goal = 'pay';
					if (!goTo(a, PAY)) leave(a);
				} else nextBrowse(a);
			} else {
				const task = a.staffId !== undefined ? busy.get(a.staffId) : undefined;
				if (task) {
					const t = allTanks().find((x) => x.id === task.ref || x.id === task.ref2);
					if (a.goal !== 'work' && t) {
						a.goal = 'work';
						goTo(a, beside(grid(), t.x, t.y, t.w, t.h));
					}
					a.wait = 1;
				} else if (a.staffId === store.s.staff[0]?.id) {
					if (a.goal !== 'till') {
						a.goal = 'till';
						goTo(a, TILL);
					}
					a.wait = 2;
				} else {
					a.goal = 'idle';
					const ts = tanks();
					if (ts.length && Math.random() < 0.6) {
						const t = pick(ts);
						goTo(a, beside(grid(), t.x, t.y, t.w, t.h));
					}
					a.wait = 3 + Math.random() * 5;
				}
			}
		}
	}

	/** A Crossy Road style person, in tile units, facing the viewer (mirrored for left/right). */
	function personModel(a: Agent): Box[] {
		const { shirt, pants, skin, hair } = a.look;
		const step = a.moving ? Math.sin(a.phase) * 0.06 : 0;
		const staff = a.kind === 'staff';
		const b: Box[] = [
			bx(0.36, 0.48 + step, 0, 0.11, 0.1, 0.26, pants),
			bx(0.53, 0.48 - step, 0, 0.11, 0.1, 0.26, pants),
			bx(0.33, 0.44, 0.26, 0.34, 0.16, 0.3, shirt),
			bx(0.27, 0.46 - step, 0.3, 0.06, 0.1, 0.24, shirt),
			bx(0.67, 0.46 + step, 0.3, 0.06, 0.1, 0.24, shirt),
			bx(0.36, 0.42, 0.56, 0.28, 0.22, 0.26, skin),
			bx(0.36, 0.41, 0.82, 0.28, 0.23, 0.06, hair),
			bx(0.36, 0.4, 0.66, 0.28, 0.04, 0.2, hair),
			bx(0.41, 0.63, 0.68, 0.05, 0.01, 0.05, '#1a1a1a'),
			bx(0.54, 0.63, 0.68, 0.05, 0.01, 0.05, '#1a1a1a')
		];
		if (staff) {
			// Teal apron and cap.
			b.push(bx(0.36, 0.6, 0.26, 0.28, 0.01, 0.28, '#1a9a9a'));
			b.push(bx(0.34, 0.4, 0.86, 0.32, 0.26, 0.06, '#1a9a9a'), bx(0.38, 0.62, 0.84, 0.24, 0.08, 0.03, '#127070'));
		}
		if (a.bag) b.push(bx(0.68, 0.5, 0.18, 0.14, 0.12, 0.16, '#e8f4ff', 0.85), bx(0.71, 0.53, 0.22, 0.07, 0.02, 0.05, a.bag));
		return b;
	}
	const flipX = (m: Box[]) => m.map((b) => ({ ...b, x: 1 - b.x - b.w }));
	/** Turn a front-facing model to face right (its front ends up on the +x side). */
	const turnRight = (m: Box[]) => m.map((b) => ({ ...b, x: b.y, y: 1 - b.x - b.w, w: b.d, d: b.w }));
	function facing(a: Agent): Box[] {
		const m = personModel(a);
		const { hair, skin } = a.look;
		if (a.face === 'down') return m;
		if (a.face === 'up') {
			// Seen from behind: the back of the head is all hair, no face.
			return [...m.filter((b) => b.c !== '#1a1a1a'), bx(0.36, 0.63, 0.6, 0.28, 0.02, 0.28, hair)];
		}
		// Side on: turn the body, and give it one eye and a nose on the side we can see.
		const side = turnRight(m.filter((b) => b.c !== '#1a1a1a'));
		side.push(bx(0.55, 0.645, 0.68, 0.05, 0.01, 0.05, '#1a1a1a'), bx(0.64, 0.5, 0.64, 0.03, 0.06, 0.05, skin));
		return a.face === 'right' ? side : flipX(side);
	}

	// ── Things on the floor ────────────────────────────────────────────────────────────
	function decorModel(item: StoreItem, t: number): Box[] {
		switch (item) {
			case 'plant':
				return [bx(0.3, 0.3, 0, 0.4, 0.4, 0.3, '#b05a2d'), bx(0.32, 0.32, 0.3, 0.36, 0.36, 0.03, '#4a2a1a'), bx(0.2, 0.25, 0.32, 0.25, 0.25, 0.3, '#3a9a3a'), bx(0.5, 0.35, 0.32, 0.28, 0.25, 0.42, '#4aaa4a'), bx(0.35, 0.45, 0.32, 0.25, 0.2, 0.55, '#5ab84a'), bx(0.4, 0.38, 0.85, 0.15, 0.15, 0.12, '#6ac85a')];
			case 'bench':
				return [bx(0.1, 0.35, 0, 0.1, 0.3, 0.25, '#5a3a20'), bx(0.8, 0.35, 0, 0.1, 0.3, 0.25, '#5a3a20'), bx(0.05, 0.3, 0.25, 0.9, 0.4, 0.08, '#b07a40'), bx(0.05, 0.28, 0.33, 0.9, 0.06, 0.3, '#a06a30')];
			case 'lamp':
				return [bx(0.38, 0.38, 0, 0.24, 0.24, 0.05, '#333'), bx(0.47, 0.47, 0.05, 0.06, 0.06, 0.9, '#555'), bx(0.3, 0.3, 0.95, 0.4, 0.4, 0.22, Math.sin(t * 2) > 0 ? '#fff4b0' : '#ffe880')];
			case 'poster':
				return [bx(0.1, 0.05, 0, 0.8, 0.08, 0.95, '#f4f0e8'), bx(0.18, 0.06, 0.35, 0.64, 0.08, 0.5, '#3a8ad8'), bx(0.32, 0.07, 0.55, 0.36, 0.08, 0.15, '#f08a1a')];
			case 'rug':
				return [bx(0.02, 0.05, 0, 0.96, 0.9, 0.03, '#3a6ad8'), bx(0.15, 0.2, 0.03, 0.7, 0.15, 0.01, '#7ab8f8'), bx(0.15, 0.6, 0.03, 0.7, 0.15, 0.01, '#7ab8f8')];
			case 'sign':
				return [bx(0.15, 0.4, 0, 0.7, 0.2, 0.5, '#2a2a3a'), bx(0.2, 0.39, 0.6, 0.6, 0.2, 0.3, Math.sin(t * 4) > -0.6 ? '#ff4da6' : '#a03070')];
			case 'statue':
				return [bx(0.2, 0.2, 0, 0.6, 0.6, 0.2, '#9a9aa4'), bx(0.3, 0.3, 0.2, 0.4, 0.4, 0.5, '#e86a3a'), bx(0.25, 0.4, 0.7, 0.2, 0.2, 0.2, '#e86a3a'), bx(0.55, 0.35, 0.55, 0.15, 0.15, 0.2, '#f4f4f4')];
			case 'fountain':
				return [bx(0.05, 0.05, 0, 0.9, 0.9, 0.25, '#b0b0b8'), bx(0.15, 0.15, 0.25, 0.7, 0.7, 0.02, '#5ac8f0'), bx(0.42, 0.42, 0.25, 0.16, 0.16, 0.5 + Math.sin(t * 3) * 0.08, '#9ad8f8')];
			case 'arch':
				return [bx(0, 0.3, 0, 0.2, 0.4, 1, '#ff7a8a'), bx(0.8, 0.3, 0, 0.2, 0.4, 1, '#c86af0'), bx(0, 0.3, 1, 1, 0.4, 0.2, '#ffb84a')];
		}
	}

	/** A tank on a stand, w tiles wide (h deep), open-topped; show tanks in their chosen shape and colours. */
	function tankModel(w: number, d: number, water: string, building: boolean, show: boolean, look: TankLook = DEFAULT_LOOK): Box[] {
		const wood = show ? (TANK_STANDS.find((x) => x.id === look.stand)?.color ?? '#4a2e1c') : '#7a5232';
		const boxes: Box[] = [bx(0.05, 0.1, 0, w - 0.1, d - 0.2, 0.35, wood)];
		// Cabinet doors with little handles.
		const doors = Math.max(1, Math.round(w));
		for (let i = 0; i < doors; i++) {
			const dw = (w - 0.24) / doors;
			boxes.push(bx(0.12 + i * dw + 0.02, d - 0.11, 0.05, dw - 0.04, 0.01, 0.24, shade(wood, 0.82)));
			boxes.push(bx(0.12 + i * dw + (i % 2 ? 0.06 : dw - 0.1), d - 0.105, 0.17, 0.04, 0.012, 0.06, '#d8d8d0'));
		}
		if (building) {
			boxes.push(bx(0.1, 0.15, 0.35, w - 0.2, d - 0.3, 0.6, '#c8c8d0', 0.3));
			for (let i = 0; i < w * 3; i++) boxes.push(bx(0.12 + i * 0.32, d - 0.17, 0.35, 0.16, 0.03, 0.6, i % 2 ? '#f0c020' : '#2a2a2a'));
			return boxes;
		}
		const wh = show ? 0.78 : 0.62;
		const top = 0.35 + wh;
		const sand = show ? '#e8d8a8' : '#c8b890';
		// The water's footprint, by glass shape: [x, y, w, d] pieces.
		let parts: [number, number, number, number][] = [[0.1, 0.15, w - 0.2, d - 0.3]];
		if (show && look.shape === 'bowfront') parts.push([0.35, d - 0.17, w - 0.7, 0.08]);
		if (show && look.shape === 'hex') parts = [[0.3, 0.15, w - 0.6, d - 0.3], [0.1, 0.4, 0.2, d - 0.8], [w - 0.3, 0.4, 0.2, d - 0.8]];
		if (show && look.shape === 'cylinder') parts = [[0.4, 0.12, w - 0.8, d - 0.24], [0.18, 0.3, w - 0.36, d - 0.6], [0.1, 0.55, w - 0.2, d - 1.1]];
		for (const [x, y, pw, pd] of parts) {
			boxes.push(bx(x, y, 0.35, pw, pd, 0.06, sand));
			boxes.push(bx(x, y, 0.41, pw, pd, wh - 0.06, water, show && look.shape === 'panorama' ? 0.8 : 0.88));
		}
		// The rim (rimless panoramas have none).
		if (!(show && look.shape === 'panorama')) {
			const rim = show ? (TANK_TRIMS.find((x) => x.id === look.trim)?.color ?? '#1e2630') : '#33414f';
			const [x, y, pw, pd] = parts[0];
			boxes.push(bx(x - 0.02, y - 0.02, top, pw + 0.04, 0.05, 0.05, rim), bx(x - 0.02, y + pd - 0.03, top, pw + 0.04, 0.05, 0.05, rim));
			boxes.push(bx(x - 0.02, y - 0.02, top, 0.05, pd, 0.05, rim), bx(x + pw - 0.03, y - 0.02, top, 0.05, pd, 0.05, rim));
		}
		// A hood light glowing over show tanks.
		if (show) boxes.push(bx(w / 2 - 0.3, d / 2 - 0.05, top + 0.25, 0.6, 0.1, 0.04, '#e8e8e0'), bx(w / 2 - 0.02, d / 2 - 0.02, top + 0.05, 0.04, 0.04, 0.2, '#888'));
		return boxes;
	}

	/** The supply shelf (2 tiles): shelves stocked with fish food, conditioner, filters and nets. */
	function shelfModel(): Box[] {
		const cap = store.shelfCap();
		const wood = '#c8a070';
		// Shallow shelves seen from the front, the stock lined up along each edge.
		const b: Box[] = [bx(0.05, 0.55, 0, 0.06, 0.2, 1.35, '#8a6a48'), bx(1.89, 0.55, 0, 0.06, 0.2, 1.35, '#8a6a48'), bx(0.05, 0.5, 0, 1.9, 0.05, 1.35, '#a88a60')];
		SUPPLIES.forEach((it, row) => {
			const z = 0.06 + row * 0.31;
			b.push(bx(0.1, 0.55, z, 1.8, 0.2, 0.04, wood));
			const n = Math.min(8, Math.ceil((store.s.stock[it.id] / Math.max(1, cap)) * 8));
			for (let i = 0; i < n; i++) b.push(bx(0.15 + i * 0.215, 0.6, z + 0.04, 0.17, 0.12, 0.22, i % 2 ? it.color : shade(it.color, 0.88)));
		});
		b.push(bx(0.6, 0.52, 1.35, 0.8, 0.05, 0.2, '#2a7ab0'), bx(0.68, 0.57, 1.41, 0.64, 0.01, 0.08, '#f4f4f4'));
		return b;
	}
	/** The counter: till, card reader, a stand of fish bags and a row of betta cups. */
	function counterModel(t: number): Box[] {
		const b: Box[] = [
			bx(0.05, 0.1, 0, 1.9, 0.8, 0.5, '#7a4a2a'),
			bx(0.05, 0.85, 0.05, 1.9, 0.02, 0.4, '#6a3e22'),
			bx(0.05, 0.1, 0.5, 1.9, 0.8, 0.06, '#d8b080'),
			bx(1.25, 0.25, 0.56, 0.45, 0.35, 0.2, '#2a2a30'),
			bx(1.3, 0.28, 0.76, 0.35, 0.06, 0.2, '#1a1a20'),
			bx(1.33, 0.29, 0.79, 0.29, 0.06, 0.14, Math.sin(t * 2) > 0 ? '#4ade80' : '#3ac870'),
			bx(1.05, 0.5, 0.56, 0.12, 0.18, 0.1, '#333'),
			bx(0.12, 0.2, 0.56, 0.16, 0.16, 0.4, '#8a8a90'),
			bx(0.1, 0.18, 0.96, 0.2, 0.2, 0.04, '#8a8a90')
		];
		// Clear fish bags hanging on the stand.
		for (let i = 0; i < 3; i++) b.push(bx(0.08 + i * 0.07, 0.35, 0.62 + i * 0.08, 0.08, 0.06, 0.12, '#dff4ff', 0.7));
		// Betta cups.
		const bettas = ['#d8423a', '#3a6ad8', '#9a5ae8', '#f08a1a'];
		bettas.forEach((col, i) => {
			b.push(bx(0.45 + i * 0.17, 0.55, 0.56, 0.13, 0.13, 0.14, '#cfeeff', 0.6));
			b.push(bx(0.48 + i * 0.17, 0.6, 0.62 + Math.sin(t * 2 + i) * 0.015, 0.07, 0.03, 0.04, col));
		});
		return b;
	}

	function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
		c.fillStyle = 'rgba(0,0,0,0.18)';
		c.beginPath();
		c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
		c.fill();
	}

	onMount(() => {
		let raf = 0;
		let last = performance.now();
		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			updatePeople(dt);
			draw(now / 1000);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});

	function draw(t: number) {
		if (!canvas || !wrap) return;
		const fitW = wrap.clientWidth;
		const fitH = wrap.clientHeight;
		pan = fitW < 640;
		const fit = Math.floor(Math.min(fitW / GRID_W, fitH > 80 ? (fitH - 8) / (GRID_H + 1.9) : Infinity));
		T = pan ? Math.max(fit, 46) : Math.max(16, fit);
		const W = GRID_W * T;
		const Z = T * ZF;
		const oy = wallH();
		const H = oy + GRID_H * T + 6;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			canvas.style.width = W + 'px';
			canvas.style.height = H + 'px';
		}
		const c = canvas.getContext('2d')!;
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.fillStyle = '#0b1a26';
		c.fillRect(0, 0, W, H);
		const FW = GRID_W * T;

		// The back wall: wainscot, wallpaper, windows with sky, and lamps.
		const wg = c.createLinearGradient(0, 0, 0, oy);
		wg.addColorStop(0, '#2c5578');
		wg.addColorStop(1, '#3a6f98');
		c.fillStyle = wg;
		c.fillRect(0, 0, FW, oy);
		c.fillStyle = 'rgba(255,255,255,0.05)';
		for (let i = 0; i < FW; i += T / 2) c.fillRect(i, 0, T / 4, oy * 0.62);
		for (let i = 0; i < 3; i++) {
			const wx = FW * (0.12 + i * 0.32);
			const ww = T * 2.2;
			c.fillStyle = '#1e3a52';
			c.fillRect(wx - 4, oy * 0.12 - 4, ww + 8, oy * 0.42 + 8);
			const sky = c.createLinearGradient(0, oy * 0.12, 0, oy * 0.54);
			sky.addColorStop(0, '#7fd0ff');
			sky.addColorStop(1, '#cdeeff');
			c.fillStyle = sky;
			c.fillRect(wx, oy * 0.12, ww, oy * 0.42);
			c.fillStyle = 'rgba(255,255,255,0.85)';
			const cx = wx + ((t * 6 + i * 40) % (ww + 30)) - 20;
			c.fillRect(Math.max(wx, cx), oy * 0.2, Math.max(0, Math.min(wx + ww, cx + 22) - Math.max(wx, cx)), 6);
			c.fillStyle = '#1e3a52';
			c.fillRect(wx + ww / 2 - 2, oy * 0.12, 4, oy * 0.42);
		}
		c.fillStyle = '#6a4a2e';
		c.fillRect(0, oy * 0.62, FW, oy * 0.38);
		c.fillStyle = '#7d5a38';
		for (let i = 0; i < FW; i += T * 0.6) c.fillRect(i + 2, oy * 0.66, T * 0.6 - 4, oy * 0.3);
		c.fillStyle = '#4a321e';
		c.fillRect(0, oy * 0.6, FW, 4);
		for (let i = 0; i < 4; i++) {
			const lx = FW * (0.06 + i * 0.3);
			c.fillStyle = '#d8d0c0';
			c.fillRect(lx, 4, T * 0.5, 6);
			const glow = c.createRadialGradient(lx + T * 0.25, 10, 2, lx + T * 0.25, 10, T);
			glow.addColorStop(0, 'rgba(255,240,200,0.45)');
			glow.addColorStop(1, 'rgba(255,240,200,0)');
			c.fillStyle = glow;
			c.fillRect(lx - T, 0, T * 2.5, T * 1.2);
		}

		// The shop sign with the store's name.
		{
			const name = store.s.name || 'FishMart';
			c.font = `900 ${Math.max(10, Math.round(T * 0.36))}px 'Arial Black', Impact, sans-serif`;
			const tw = c.measureText(name).width + T * 0.6;
			const sx = FW / 2 - tw / 2;
			const sy = oy * 0.6 - T * 0.62;
			c.fillStyle = '#3a2416';
			c.fillRect(sx - 3, sy - 3, tw + 6, T * 0.56 + 6);
			c.fillStyle = '#f4ecd8';
			c.fillRect(sx, sy, tw, T * 0.56);
			c.fillStyle = '#1a6a9a';
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillText(name, FW / 2, sy + T * 0.3);
			c.textBaseline = 'alphabetic';
			// Little fish either side.
			for (const [fx, dir] of [
				[sx + 6, 1],
				[sx + tw - 16, -1]
			] as const) {
				c.fillStyle = '#f08a1a';
				c.fillRect(fx, sy + T * 0.22, 10, 6);
				c.fillRect(dir > 0 ? fx - 4 : fx + 10, sy + T * 0.2, 4, 10);
			}
		}
		// A wall clock, and framed fish posters between the windows.
		{
			const cx = FW * 0.93;
			const cy = oy * 0.3;
			c.fillStyle = '#f4f4f4';
			c.beginPath();
			c.arc(cx, cy, T * 0.28, 0, Math.PI * 2);
			c.fill();
			c.strokeStyle = '#2a2a30';
			c.lineWidth = 3;
			c.stroke();
			const now = new Date();
			const hand = (a: number, l: number) => {
				c.beginPath();
				c.moveTo(cx, cy);
				c.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l);
				c.stroke();
			};
			c.lineWidth = 2;
			hand(((now.getHours() % 12) / 12) * Math.PI * 2, T * 0.14);
			hand((now.getMinutes() / 60) * Math.PI * 2, T * 0.22);
			c.lineWidth = 1;
			for (let i = 0; i < 2; i++) {
				const px = FW * (0.29 + i * 0.32);
				const py = oy * 0.16;
				c.fillStyle = '#e8dcc0';
				c.fillRect(px, py, T * 0.7, T * 0.5);
				c.fillStyle = i ? '#1a5aa8' : '#1a6a70';
				c.fillRect(px + 3, py + 3, T * 0.7 - 6, T * 0.5 - 6);
				c.fillStyle = i ? '#ffd23a' : '#f05a5a';
				c.fillRect(px + T * 0.2, py + T * 0.2, T * 0.25, T * 0.12);
				c.fillRect(px + T * 0.12, py + T * 0.17, T * 0.08, T * 0.18);
			}
		}
		// Skirting board.
		c.fillStyle = '#3a2618';
		c.fillRect(0, oy - 5, FW, 5);

		// Floor: bevelled tiles.
		const fl = FLOORS.find((f) => f.id === store.s.floor) ?? FLOORS[0];
		for (let y = 0; y < GRID_H; y++)
			for (let x = 0; x < GRID_W; x++) {
				const X = x * T;
				const Y = oy + y * T;
				const base = (x + y) % 2 ? fl.a : fl.b;
				c.fillStyle = base;
				c.fillRect(X, Y, T, T);
				c.fillStyle = shade(base, 1.08);
				c.fillRect(X, Y, T, 2);
				c.fillRect(X, Y, 2, T);
				c.fillStyle = shade(base, 0.86);
				c.fillRect(X, Y + T - 2, T, 2);
				c.fillRect(X + T - 2, Y, 2, T);
			}
		// The wall's shadow on the floor, and pools of light.
		const ws = c.createLinearGradient(0, oy, 0, oy + T * 0.8);
		ws.addColorStop(0, 'rgba(0,0,0,0.25)');
		ws.addColorStop(1, 'rgba(0,0,0,0)');
		c.fillStyle = ws;
		c.fillRect(0, oy, FW, T * 0.8);
		for (let i = 0; i < 3; i++) {
			const lx = FW * (0.2 + i * 0.3);
			const ly = oy + GRID_H * T * 0.45;
			const pool = c.createRadialGradient(lx, ly, 4, lx, ly, T * 3);
			pool.addColorStop(0, 'rgba(255,250,220,0.18)');
			pool.addColorStop(1, 'rgba(255,250,220,0)');
			c.fillStyle = pool;
			c.fillRect(lx - T * 3, ly - T * 3, T * 6, T * 6);
		}
		// The entrance mat.
		c.fillStyle = '#3a2a1a';
		c.fillRect(DOOR[0] * T + 4, oy + DOOR[1] * T + 4, 2 * T - 8, T - 8);
		c.fillStyle = '#5a4a3a';
		for (let i = 0; i < 6; i++) c.fillRect(DOOR[0] * T + 8, oy + DOOR[1] * T + 8 + i * ((T - 16) / 6), 2 * T - 16, 2);
		c.fillStyle = '#fff';
		c.font = `bold ${Math.max(8, Math.round(T * 0.22))}px sans-serif`;
		c.textAlign = 'center';
		c.fillText('WELCOME', (DOOR[0] + 1) * T, oy + GRID_H * T - T * 0.3);

		if (layout) {
			c.strokeStyle = 'rgba(0,0,0,0.15)';
			for (let x = 0; x <= GRID_W; x++) c.strokeRect(x * T, oy, 0, GRID_H * T);
			for (let y = 0; y <= GRID_H; y++) c.strokeRect(0, oy + y * T, FW, 0);
			if (hover && picked) {
				c.fillStyle = 'rgba(74,222,128,0.35)';
				c.fillRect(hover[0] * T, oy + hover[1] * T, T, T);
			}
		}

		// Everything standing on the floor, back rows first.
		const things: { y: number; f: () => void }[] = [];
		things.push({
			y: GRID_H - 0.01,
			f: () => {
				shadow(c, T, oy + (GRID_H - 0.4) * T, T * 1.1, T * 0.3);
					drawVoxel(c, counterModel(t), 0, oy + (GRID_H - 1) * T, T, Z);
				}
			});
			{
				const sh = store.s.shelf;
				const sel = picked?.kind === 'shelf';
				const low = SUPPLIES.some((it) => store.s.stock[it.id] < store.shelfCap() * 0.2);
				things.push({
					y: sh.y + 0.9,
					f: () => {
						shadow(c, (sh.x + 1) * T, oy + (sh.y + 0.75) * T, T * 0.95, T * 0.18);
						drawVoxel(c, model(shelfModel()), sh.x * T, oy + sh.y * T, T, Z);
						if (low) bubble(c, '📦', (sh.x + 1) * T, oy + sh.y * T - Z * 1.6);
						if (sel) outline(c, sh.x, sh.y, 2, 1, oy, Z);
					}
				});
			}
		for (const tk of store.s.sale) {
			const w = tier(tk.tier).w;
			const sel = picked?.kind === 'sale' && picked.id === tk.id;
			things.push({
				y: tk.y + 0.99,
				f: () => {
					shadow(c, (tk.x + w / 2) * T, oy + (tk.y + 0.9) * T, w * T * 0.5, T * 0.2);
					drawVoxel(c, model(tankModel(w, 1, tk.water === 'salt' ? '#4aa8e8' : tk.temp === 'cold' ? '#7ac8d0' : '#4ac0b0', !tk.ready, false)), tk.x * T, oy + tk.y * T, T, Z);
						if (tk.ready) {
							swimmers(c, tk.fish.map((f) => species(f.s).colors), tk.x, tk.y, w, 1, 0.97, t, oy, Z, tk.clean);
							throughGlass(c, tk.fish.map((f) => species(f.s).colors), tk.x, tk.y, w, 1, 0.62, t, oy, Z, -1);
						}
					if (tk.clean < 40 && tk.ready) bubble(c, '🧽', (tk.x + w / 2) * T, oy + tk.y * T - Z * 1.2);
					if (sel) outline(c, tk.x, tk.y, w, 1, oy, Z);
				}
			});
		}
		for (const sh of store.s.show) {
			const w = Math.min(GRID_W, 2 * sh.seg);
			const sel = picked?.kind === 'show' && picked.id === sh.id;
			things.push({
				y: sh.y + 1.99,
				f: () => {
					shadow(c, (sh.x + w / 2) * T, oy + (sh.y + 1.85) * T, w * T * 0.5, T * 0.25);
						const lk = store.lookOf(sh);
						drawVoxel(c, model(tankModel(w, 2, sh.water === 'salt' ? '#3a9ae8' : sh.temp === 'cold' ? '#6ab8d0' : '#3ab8a8', !sh.ready, true, lk)), sh.x * T, oy + sh.y * T, T, Z);
						if (sh.ready) {
							swimmers(c, sh.fish.map((f) => species(f.s).colors), sh.x, sh.y, w, 2, 1.13, t, oy, Z, sh.clean);
							throughGlass(c, sh.fish.map((f) => species(f.s).colors), sh.x, sh.y, w, 2, 0.78, t, oy, Z, sh.decor.includes('plants') ? (sh.growth ?? 30) : -1, TANK_LIGHTS.find((x) => x.id === lk.light)?.tint);
						}
					bubble(c, '⭐', (sh.x + w / 2) * T, oy + sh.y * T - Z * 1.4);
					if (sel) outline(c, sh.x, sh.y, w, 2, oy, Z);
				}
			});
		}
		for (const d of store.s.decor) {
			const sel = picked?.kind === 'decor' && picked.id === d.id;
			things.push({
				y: d.item === 'rug' ? d.y - 0.5 : d.y + 0.9,
				f: () => {
					if (d.item !== 'rug') shadow(c, (d.x + 0.5) * T, oy + (d.y + 0.75) * T, T * 0.4, T * 0.15);
					drawVoxel(c, model(decorModel(d.item, t)), d.x * T, oy + d.y * T, T, Z);
					if (sel) outline(c, d.x, d.y, 1, 1, oy, Z);
				}
			});
		}
		for (const a of agents) {
			things.push({
				y: a.y + 0.3,
				f: () => {
					const bob = a.moving ? Math.abs(Math.sin(a.phase)) * T * 0.05 : 0;
					shadow(c, a.x * T, oy + (a.y + 0.05) * T, T * 0.22, T * 0.09);
						drawVoxel(c, model(facing(a)), (a.x - 0.5) * T, oy + (a.y - 0.5) * T - bob, T, Z);
					if (a.kind === 'staff' && a.goal === 'work' && !a.moving) bubble(c, '🔧', a.x * T, oy + a.y * T - Z * 1.3);
					if (a.kind === 'cust' && a.goal === 'browse' && !a.moving && a.wait > 0 && Math.floor(t + a.id) % 5 === 0) bubble(c, '❤️', a.x * T, oy + a.y * T - Z * 1.3);
				}
			});
		}
		things.sort((p, q) => p.y - q.y);
		for (const th of things) th.f();
		progressBars(c, oy, Z);
	}

	/** Fish swimming in a tank, seen through its open top, with light rippling on the water. */
	function swimmers(c: CanvasRenderingContext2D, fish: [string, string, string][], x: number, y: number, w: number, d: number, topZ: number, t: number, oy: number, Z: number, clean: number) {
		const X0 = (x + 0.1) * T;
		const Y0 = oy + (y + 0.15) * T - topZ * Z;
		const WW = (w - 0.2) * T;
		const HH = (d - 0.3) * T;
		c.save();
		c.beginPath();
		c.rect(X0, Y0, WW, HH);
		c.clip();
		c.fillStyle = 'rgba(255,255,255,0.12)';
		for (let i = 0; i < 3 * w; i++) {
			const rx = X0 + ((i * 37 + t * 14) % WW);
			c.fillRect(rx, Y0 + ((i * 23) % HH), T * 0.3, 1.5);
		}
		fish.slice(0, 9 * w).forEach((col, i) => {
			const sp = 0.3 + (i % 5) * 0.11;
			const u = (Math.sin(t * sp + i * 1.7) + 1) / 2;
			const fx = X0 + 3 + u * (WW - 12);
			const fy = Y0 + 3 + ((i * 0.41 + Math.sin(t * 0.7 + i) * 0.05) % 1) * (HH - 8);
			const dir = Math.cos(t * sp + i * 1.7) > 0 ? 1 : -1;
			const len = Math.max(5, T * 0.16);
			c.fillStyle = col[0];
			c.fillRect(fx, fy, len, len * 0.45);
			c.fillStyle = col[1];
			c.fillRect(fx, fy + len * 0.25, len, len * 0.2);
			c.fillStyle = col[2];
			c.fillRect(dir > 0 ? fx - len * 0.35 : fx + len, fy, len * 0.35, len * 0.45);
			c.fillStyle = '#111';
			c.fillRect(dir > 0 ? fx + len * 0.7 : fx + len * 0.12, fy + 1, 1.5, 1.5);
		});
		if (clean < 60) {
			c.fillStyle = `rgba(90,110,40,${(60 - clean) / 120})`;
			c.fillRect(X0, Y0, WW, HH);
		}
		c.restore();
		// Glass glint.
		c.fillStyle = 'rgba(255,255,255,0.18)';
		c.fillRect(X0 + WW * 0.08, Y0 + HH + 2, 3, T * 0.35);
	}

	const TASK_ICON: Record<string, string> = { build: '🔨', buildShow: '🔨', upgrade: '⬆️', upgradeShow: '⬆️', clean: '🧽', cleanShow: '🧽', trim: '✂️', restock: '📦', combine: '🔗' };
	/** A progress bar floating over whatever is being built, upgraded, cleaned or restocked. */
	function progressBars(c: CanvasRenderingContext2D, oy: number, Z: number) {
		const now = Date.now();
		for (const task of store.s.tasks) {
			let box: { x: number; y: number; w: number } | null = null;
			if (task.ref === -1) box = { x: store.s.shelf.x, y: store.s.shelf.y, w: 2 };
			else {
				const t = allTanks().find((x) => x.id === task.ref);
				if (t) box = t;
			}
			if (!box) continue;
			const p = Math.max(0, Math.min(1, (now - task.start) / Math.max(1, task.end - task.start)));
			const bw = Math.min(box.w * T * 0.8, T * 2.4);
			const cx = (box.x + box.w / 2) * T;
			const y = oy + box.y * T - Z * 1.75;
			c.fillStyle = 'rgba(4,18,28,0.85)';
			c.beginPath();
			c.roundRect(cx - bw / 2 - 3, y - 3, bw + 6, 13, 6);
			c.fill();
			c.fillStyle = '#1e293b';
			c.fillRect(cx - bw / 2, y, bw, 7);
			c.fillStyle = p > 0.85 ? '#4ade80' : '#2ab0e8';
			c.fillRect(cx - bw / 2, y, bw * p, 7);
			c.fillStyle = 'rgba(255,255,255,0.35)';
			c.fillRect(cx - bw / 2, y, bw * p, 2);
			const left = Math.max(0, Math.ceil((task.end - now) / 1000));
			const txt = left >= 3600 ? `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m` : left >= 60 ? `${Math.floor(left / 60)}m ${left % 60}s` : `${left}s`;
			c.font = `bold ${Math.max(9, Math.round(T * 0.24))}px sans-serif`;
			c.textAlign = 'center';
			c.fillStyle = '#fff';
			c.fillText(`${TASK_ICON[task.kind] ?? '⏳'} ${txt}`, cx, y - 6);
		}
	}

	/** Fish and plants seen side-on through a tank's front glass. */
	function throughGlass(c: CanvasRenderingContext2D, fish: [string, string, string][], x: number, y: number, w: number, d: number, wh: number, t: number, oy: number, Z: number, plants: number, tint?: string) {
		const X0 = (x + 0.12) * T;
		const WW = (w - 0.24) * T;
		const yFront = oy + (y + d - 0.15) * T;
		const top = yFront - (0.35 + wh) * Z;
		const H = (wh - 0.06) * Z;
		c.save();
		c.beginPath();
		c.rect(X0, top, WW, H);
		c.clip();
		if (plants >= 0) {
			const tall = 0.3 + (plants / 100) * 0.7;
			for (let i = 0; i < w * 4; i++) {
				const px = X0 + ((i * 0.27 + 0.05) % 1) * WW;
				const ph = H * tall * (0.5 + ((i * 37) % 10) / 20);
				c.fillStyle = i % 2 ? '#3a9a3a' : '#5ab84a';
				c.fillRect(px + Math.sin(t + i) * 1.5, top + H - ph, 3, ph);
			}
		}
		fish.slice(0, 8 * w).forEach((col, i) => {
			const sp = 0.25 + (i % 5) * 0.09;
			const u = (Math.sin(t * sp + i * 2.3) + 1) / 2;
			const dir = Math.cos(t * sp + i * 2.3) > 0 ? 1 : -1;
			const len = Math.max(5, T * 0.15);
			const fx = X0 + 2 + u * (WW - len - 4);
			const fy = top + 3 + ((i * 0.37) % 1) * (H - 8);
			c.fillStyle = col[0];
			c.fillRect(fx, fy, len, len * 0.4);
			c.fillStyle = col[2];
			c.fillRect(dir > 0 ? fx - len * 0.3 : fx + len, fy, len * 0.3, len * 0.4);
		});
		if (tint) {
			c.fillStyle = tint;
			c.fillRect(X0, top, WW, H);
		}
		c.fillStyle = 'rgba(255,255,255,0.12)';
		c.fillRect(X0 + WW * 0.1, top, 3, H);
		c.restore();
	}

	function bubble(c: CanvasRenderingContext2D, s: string, x: number, y: number) {
		c.font = `${Math.round(T * 0.32)}px sans-serif`;
		c.textAlign = 'center';
		c.fillText(s, x, y + Math.sin(performance.now() / 300) * 2);
	}
	function outline(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, oy: number, Z: number) {
		c.strokeStyle = '#4ade80';
		c.lineWidth = 3;
		c.strokeRect(x * T + 1, oy + y * T - Z * 1.2, w * T - 2, h * T + Z * 1.2);
		c.lineWidth = 1;
	}

	function cell(e: PointerEvent): [number, number] | null {
		const r = canvas!.getBoundingClientRect();
		const x = Math.floor((e.clientX - r.left) / T);
		// Things stand up out of the floor: a tap a little above a tile still counts for it.
		const y = Math.floor((e.clientY - r.top - wallH() + (layout ? 0 : T * 0.4)) / T);
		return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H ? [x, y] : null;
	}
</script>

<div class="floor" bind:this={wrap}>
	<canvas
		bind:this={canvas}
		class:pan
		onpointerdown={(e) => {
			drag = { x: e.clientX, y: e.clientY, sl: wrap!.scrollLeft, st: wrap!.scrollTop, moved: false };
		}}
		onpointermove={(e) => {
			hover = cell(e);
			if (!drag || !pan) return;
			const dx = e.clientX - drag.x;
			const dy = e.clientY - drag.y;
			if (Math.hypot(dx, dy) > 6) drag.moved = true;
			if (drag.moved) {
				wrap!.scrollLeft = drag.sl - dx;
				wrap!.scrollTop = drag.st - dy;
			}
		}}
		onpointerup={(e) => {
			const tap = drag && !drag.moved;
			drag = null;
			if (!tap) return;
			const p = cell(e);
			if (p) ontap(p[0], p[1]);
		}}
		onpointercancel={() => (drag = null)}
		onpointerleave={() => ((hover = null), (drag = null))}
		aria-label="Your store floor"
	></canvas>
</div>

<style>
	.floor {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		overflow: hidden;
	}
	.floor:has(canvas.pan) {
		justify-content: flex-start;
		overflow: auto;
		scrollbar-width: none;
	}
	canvas.pan {
		touch-action: none;
		flex: none;
	}
	canvas {
		display: block;
		cursor: pointer;
		border-radius: 10px;
		touch-action: manipulation;
		box-shadow: 0 12px 30px -14px #000;
	}
</style>
