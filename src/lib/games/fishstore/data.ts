// FishMart's data: real fish species (with the conditions they really need), tanks,
// decorations, staff and suppliers. Everything the store simulation and its sanity checks use.
import { FAMILIES } from './catalog';

export type Water = 'fresh' | 'salt';
export type Temp = 'tropical' | 'cold';
export type Size = 'S' | 'M' | 'L' | 'XL' | 'XXL';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'ultra' | 'epic' | 'legendary' | 'mythic';
export type Shape = 'magikarp' | 'sprite' | 'fish' | 'tall' | 'disc' | 'long' | 'shark' | 'ray' | 'puffy' | 'betta' | 'eel' | 'lion' | 'guppy' | 'bottom' | 'shrimp' | 'snail' | 'crab';
export type Pattern = 'none' | 'neon' | 'hstripes' | 'vbands' | 'spots' | 'calico' | 'marble' | 'split' | 'zebra';
export type DecorTag = 'sand' | 'gravel' | 'plants' | 'wood' | 'cave' | 'rock' | 'coral' | 'anemone' | 'ornament' | 'bubbles' | 'light' | 'backdrop';

export interface Species {
	id: string;
	name: string;
	sci: string;
	water: Water;
	temp: Temp;
	size: Size;
	rarity: Rarity;
	/** Eats fish much smaller than itself. */
	predator?: boolean;
	/** Only one of its kind per tank (bettas fight each other). */
	single?: boolean;
	/** Too aggressive for any tankmates. */
	alone?: boolean;
	/** Clean-up crew: grazes algae and leftovers, so its tank stays clean for longer. */
	cleaner?: boolean;
	likes: DecorTag[];
	shape: Shape;
	/** Body, belly, fins. */
	colors: [string, string, string];
	pattern: Pattern;
	pcolor?: string;
	/** Adult length (cm), for drawing fish to scale. */
	cm: number;
	/** Drawn from a picture instead (facing right, facing left). */
	img?: [string, string];
}

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'ultra', 'epic', 'legendary', 'mythic'];
export const RARITY_LABEL: Record<Rarity, string> = {
	common: 'Common',
	uncommon: 'Uncommon',
	rare: 'Rare',
	ultra: 'Ultra-rare',
	epic: 'Epic',
	legendary: 'Legendary',
	mythic: 'Mythic'
};
export const RARITY_COLOR: Record<Rarity, string> = {
	common: '#94a3b8',
	uncommon: '#4ade80',
	rare: '#38bdf8',
	ultra: '#a78bfa',
	epic: '#f472b6',
	legendary: '#fbbf24',
	mythic: '#ff4d6d'
};
/** Base sale price by rarity, then scaled by size. */
const BASE_PRICE: Record<Rarity, number> = { common: 22, uncommon: 65, rare: 220, ultra: 650, epic: 2200, legendary: 8000, mythic: 40000 };
export const SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL'];
export const SIZE_LABEL: Record<Size, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large', XXL: 'Giant' };
/** How much of a tank a fish takes up (bioload), by size. A 40-gallon (15) holds 1 large + 7 small. */
export const SIZE_UNITS: Record<Size, number> = { S: 1, M: 3, L: 8, XL: 20, XXL: 50 };
const SIZE_PRICE: Record<Size, number> = { S: 1, M: 1.3, L: 1.7, XL: 2.2, XXL: 3 };

export const priceOf = (s: Species) => Math.round(BASE_PRICE[s.rarity] * SIZE_PRICE[s.size]);

// ── Reading the catalogue ────────────────────────────────────────────────────────────
const COLOR: Record<string, string> = {
	red: '#d8423a', darkred: '#9a2a24', orange: '#f08a1a', gold: '#e8b030', yellow: '#f0d020', cream: '#f0e6c8',
	white: '#f4f4f0', silver: '#c8ccd4', gray: '#8a9098', black: '#26282e', brown: '#8a6a4a', tan: '#c8a878',
	green: '#4aa84a', olive: '#8a9a4a', teal: '#2ab0a8', cyan: '#4ad0e8', blue: '#3a6ad8', navy: '#1e3270',
	purple: '#8a4ad8', violet: '#b070e8', pink: '#f08ab0', magenta: '#d84a9a'
};
/** Typical adult size (cm) by size class, and the real size of fish whose scale matters most. */
const CLASS_CM: Record<Size, number> = { S: 4, M: 11, L: 25, XL: 65, XXL: 180 };
const CM: Record<string, number> = {
	'Cherry Shrimp': 3, 'Amano Shrimp': 5, 'Bamboo Shrimp': 8, 'Vampire Shrimp': 15, 'Ghost Shrimp': 4, 'Gold Mystery Snail': 5, 'Red Ramshorn Snail': 2.5,
	'Malaysian Trumpet Snail': 2.5, 'Yellow Rabbit Snail': 9, 'Zebra Nerite Snail': 2.5, 'Horned Nerite Snail': 2, 'Japanese Trapdoor Snail': 6, 'Coral Banded Shrimp': 7,
	'Sexy Shrimp': 2, 'Turbo Snail': 6, 'Fighting Conch': 9, 'Tiger Cowrie': 12, 'Emerald Crab': 5, 'Blue Leg Hermit Crab': 3, 'Sally Lightfoot Crab': 8,
	'Neon Tetra': 3.5, 'Cardinal Tetra': 4, 'Ember Tetra': 2, 'Chili Rasbora': 1.5, 'Phoenix Rasbora': 1.8, 'Pea Puffer': 2.5,
	'Endler\'s Livebearer': 2.5, 'Guppy': 4, 'Betta': 6, 'Zebra Danio': 4.5, 'Harlequin Rasbora': 4.5, 'Otocinclus': 4,
	'Pygmy Corydoras': 2.5, 'Celestial Pearl Danio': 2, 'Galaxy Rasbora': 2, 'Sparkling Gourami': 3.5, 'Dwarf Seahorse': 2.5,
	'Clown Goby': 3.5, 'Neon Goby': 4.5, 'Ocellaris Clownfish': 8, 'Percula Clownfish': 8, 'Royal Gramma': 8,
	'Freshwater Angelfish': 15, 'Discus': 18, 'Oscar': 33, 'Tinfoil Barb': 30, 'Bala Shark': 30, 'Kissing Gourami': 28,
	'Clown Loach': 25, 'Flowerhorn Cichlid': 30, 'Severum': 20, 'Jack Dempsey': 25, 'Green Terror': 25, 'Frontosa': 33,
	'Common Goldfish': 30, 'Comet Goldfish': 30, 'Fancy Goldfish': 15, 'Koi': 60, 'Kohaku Koi': 60, 'Butterfly Koi': 60,
	'Silver Arowana': 90, 'Black Arowana': 90, 'Super Red Arowana': 90, 'Golden Arowana': 90, 'Platinum Arowana': 90,
	'Albino Silver Arowana': 90, 'Jardini Arowana': 60, 'Alligator Gar': 200, 'Albino Alligator Gar': 200, 'Platinum Alligator Gar': 200,
	'Florida Gar': 75, 'Spotted Gar': 75, 'Arapaima': 250, 'Red Tail Catfish': 130, 'Iridescent Shark': 120, 'Tiger Shovelnose Catfish': 90,
	'Common Pleco': 45, 'Sailfin Pleco': 50, 'Scarlet Pleco': 35, 'Clown Knifefish': 80, 'Fire Eel': 90, 'Tire Track Eel': 70,
	'Bullseye Snakehead': 120, 'Pacu': 75, 'Giant Gourami': 60, 'Peacock Bass': 70, 'Wolf Cichlid': 60, 'Mbu Puffer': 70,
	'Motoro Stingray': 45, 'Polka Dot Stingray': 50, 'Teacup Stingray': 25, 'Black Diamond Stingray': 60, 'Tiger River Stingray': 60,
	'Yellow Tang': 18, 'Blue Tang': 30, 'Emperor Angelfish': 38, 'Queen Angelfish': 45, 'French Angelfish': 40, 'Red Lionfish': 38,
	'Snowflake Moray': 75, 'Zebra Moray': 150, 'Green Moray': 250, 'Ribbon Eel': 120, 'Dragon Moray': 90,
	'Brownbanded Bamboo Shark': 105, 'White-spotted Bamboo Shark': 95, 'Epaulette Shark': 107, 'Coral Catshark': 70, 'Horn Shark': 120,
	'Zebra Shark': 250, 'Blacktip Reef Shark': 160, 'Whitetip Reef Shark': 160, 'Nurse Shark': 300, 'Wobbegong': 150, 'Leopard Shark': 150,
	'Albino Bamboo Shark': 105, 'Blue Spotted Stingray': 35, 'Southern Stingray': 150, 'Spotted Eagle Ray': 250, 'Blue Spotted Fantail Ray': 180,
	'Yellow Stingray': 35, 'Unicorn Tang': 70, 'Vlamingi Tang': 60, 'Orbiculate Batfish': 50, 'Panther Grouper': 70, 'Lyretail Grouper': 80,
	'Leafy Seadragon': 35, 'Weedy Seadragon': 45, 'Lined Seahorse': 15, 'Garibaldi Damselfish': 30, 'Harlequin Tuskfish': 30
};

function parseCatalog(): Species[] {
	const out: Species[] = [];
	const ids = new Set<string>();
	for (const fam of FAMILIES) {
		const [water, temp, shape, likes, famFlags = ''] = fam.head.split(' ');
		for (const raw of fam.lines.split('\n')) {
			const line = raw.trim();
			if (!line) continue;
			const [name, sci, size, rarity, colors, pattern, pcolor, flags = '', shapeOverride] = line.split('|');
			const cols = colors.split('/').map((c) => COLOR[c] ?? c);
			const f = (flags && flags !== '-' ? flags : '') + famFlags;
			let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			while (ids.has(id)) id += '-2';
			ids.add(id);
			out.push({
				id,
				name,
				sci,
				water: water as Water,
				temp: temp as Temp,
				size: size as Size,
				rarity: rarity as Rarity,
				predator: f.includes('P') || undefined,
				single: f.includes('S') || undefined,
				alone: f.includes('A') || undefined,
				cleaner: f.includes('C') || undefined,
				likes: likes.split(',') as DecorTag[],
				shape: (shapeOverride || shape) as Shape,
				colors: [cols[0], cols[1] ?? cols[0], cols[2] ?? cols[0]],
				pattern: (pattern || 'none') as Pattern,
				pcolor: pcolor ? (COLOR[pcolor] ?? pcolor) : undefined,
				cm: CM[name] ?? CLASS_CM[size as Size]
			});
		}
	}
	// The easter egg: not a real fish, but every pond has a legend.
	out.push({
		id: 'magikarp',
		name: 'Magikarp',
		sci: 'Pokémon (easter egg)',
		water: 'fresh',
		temp: 'tropical',
		size: 'XL',
		rarity: 'mythic',
		likes: ['plants', 'sand'],
		shape: 'magikarp',
		colors: ['#ee5a2c', '#f6d75a', '#f2f2f2'],
		pattern: 'none',
		cm: 90
	});
	// And the hero of E.Ngine Games' Fishy, in its original 2D art.
	out.push({
		id: 'fishy',
		name: 'Fishy',
		sci: 'E.Ngine Games (easter egg)',
		water: 'salt',
		temp: 'tropical',
		size: 'M',
		rarity: 'mythic',
		likes: ['coral', 'rock'],
		shape: 'sprite',
		colors: ['#f0a030', '#f8d070', '#f08a1a'],
		pattern: 'none',
		cm: 14,
		img: ['/games/fishy/FishyCharR.png', '/games/fishy/FishyCharL.png']
	});
	return out;
}

export const SPECIES: Species[] = parseCatalog();
export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export const species = (id: string) => SPECIES_BY_ID.get(id) ?? SPECIES[0];

// ── Tanks ────────────────────────────────────────────────────────────────────────────
export type TankTier = 'nano' | 'small' | 'medium' | 'large' | 'giant';
export const TANK_TIERS: { id: TankTier; name: string; gallons: number; cm: number; cost: number; build: number; cap: number; maxSize: Size; w: number }[] = [
	{ id: 'nano', name: 'Nano tank', gallons: 10, cm: 50, cost: 150, build: 60, cap: 6, maxSize: 'S', w: 1 },
	{ id: 'small', name: 'Small tank', gallons: 40, cm: 90, cost: 450, build: 300, cap: 15, maxSize: 'L', w: 1 },
	{ id: 'medium', name: 'Medium tank', gallons: 75, cm: 120, cost: 1200, build: 900, cap: 30, maxSize: 'L', w: 2 },
	{ id: 'large', name: 'Large tank', gallons: 180, cm: 180, cost: 3500, build: 2700, cap: 70, maxSize: 'XL', w: 2 },
	{ id: 'giant', name: 'Giant tank', gallons: 500, cm: 300, cost: 10000, build: 7200, cap: 160, maxSize: 'XL', w: 3 }
];
export const tier = (id: TankTier) => TANK_TIERS.find((t) => t.id === id)!;
/** Saltwater setups need more gear (protein skimmer, salt mix, live rock). */
export const SALT_COST = 1.5;

/** Show tank capacity per level (one segment). */
export const SHOW_CAP = [0, 15, 22, 30, 40, 52, 66, 82, 100, 120, 140];
export const SHOW_MAX_LEVEL = 10;
/** Combined show tanks get a bonus: one big tank holds more than several small ones. */
export const COMBINE_BONUS = 1.15;
export const MAX_SHOW_TANKS = 5;
/** A show tank's real width (cm) for its capacity: 15 → ~85 cm, a big combined tank → 5 m+. */
export const showWidthCm = (cap: number) => Math.round(60 + cap * 1.6);
/** Main show tank level needed to unlock each extra show tank. */
export const SHOW_UNLOCK = [0, 3, 5, 7, 9];
export const showUpgradeCost = (level: number) => Math.round(300 * Math.pow(level, 1.6));
export const showUpgradeTime = (level: number) => 120 * level;
export const NEW_SHOW_COST = 2500;
export const NEW_SHOW_TIME = 1200;
export const COMBINE_COST = 1500;
export const COMBINE_TIME = 1800;

// ── Show tank styles ──────────────────────────────────────────────────────────────────
/** The shape of a show tank's glass: pricier shapes look better (beauty adds to niceness). */
export type TankShape = 'rect' | 'bowfront' | 'hex' | 'cylinder' | 'panorama';
export const TANK_SHAPES: { id: TankShape; name: string; cost: number; beauty: number; blurb: string }[] = [
	{ id: 'rect', name: 'Classic', cost: 0, beauty: 0, blurb: 'A straight-sided rectangle with a framed rim.' },
	{ id: 'bowfront', name: 'Bow-front', cost: 600, beauty: 4, blurb: 'Curved front glass that wraps the view.' },
	{ id: 'hex', name: 'Hexagon', cost: 800, beauty: 5, blurb: 'Six-sided, with angled corner panes.' },
	{ id: 'cylinder', name: 'Cylinder', cost: 1200, beauty: 7, blurb: 'A round column of water, seen from every side.' },
	{ id: 'panorama', name: 'Rimless panorama', cost: 1500, beauty: 8, blurb: 'Low-iron glass, no frame: nothing between you and the fish.' }
];
export const TANK_TRIMS: { id: string; name: string; color: string }[] = [
	{ id: 'black', name: 'Black', color: '#1e2630' },
	{ id: 'chrome', name: 'Chrome', color: '#b8c4d0' },
	{ id: 'gold', name: 'Gold', color: '#d4a830' },
	{ id: 'white', name: 'White', color: '#eef2f6' },
	{ id: 'oak', name: 'Oak', color: '#a8743e' }
];
export const TANK_STANDS: { id: string; name: string; color: string }[] = [
	{ id: 'walnut', name: 'Walnut', color: '#4a2e1c' },
	{ id: 'oak', name: 'Oak', color: '#9a6a38' },
	{ id: 'white', name: 'White gloss', color: '#e4e8ec' },
	{ id: 'black', name: 'Black gloss', color: '#22262c' },
	{ id: 'marble', name: 'Marble', color: '#cfc8c0' }
];
export const TANK_LIGHTS: { id: string; name: string; tint: string }[] = [
	{ id: 'day', name: 'Daylight', tint: 'rgba(255,255,240,0)' },
	{ id: 'blue', name: 'Actinic blue', tint: 'rgba(70,110,255,0.16)' },
	{ id: 'sunset', name: 'Sunset', tint: 'rgba(255,140,60,0.15)' },
	{ id: 'pink', name: 'Coral pink', tint: 'rgba(255,90,180,0.13)' },
	{ id: 'moon', name: 'Moonlight', tint: 'rgba(30,40,120,0.28)' }
];
export interface TankLook {
	shape: TankShape;
	trim: string;
	stand: string;
	light: string;
}
export const DEFAULT_LOOK: TankLook = { shape: 'rect', trim: 'black', stand: 'walnut', light: 'day' };
/** Repainting the trim or stand, or changing the lights. */
export const RESTYLE_COST = 40;
/** Live plants grow (percent an hour); past OVERGROWN they crowd the tank until trimmed. */
export const PLANT_GROWTH = 4;
export const OVERGROWN = 70;
export const TRIMMED = 30;
export const TRIM_TIME = 150;
/** The biggest fish a tank of this capacity can hold. */
export function maxSizeFor(cap: number): Size {
	if (cap >= 200) return 'XXL';
	if (cap >= 60) return 'XL';
	if (cap >= 15) return 'L';
	if (cap >= 8) return 'M';
	return 'S';
}

// ── Decorations ──────────────────────────────────────────────────────────────────────
export const TANK_DECOR: { id: DecorTag; name: string; cost: number; beauty: number; water?: Water }[] = [
	{ id: 'sand', name: 'Sand substrate', cost: 50, beauty: 4 },
	{ id: 'gravel', name: 'Gravel', cost: 30, beauty: 3, water: 'fresh' },
	{ id: 'plants', name: 'Live plants', cost: 90, beauty: 9, water: 'fresh' },
	{ id: 'wood', name: 'Driftwood', cost: 60, beauty: 6, water: 'fresh' },
	{ id: 'cave', name: 'Rock cave', cost: 70, beauty: 6 },
	{ id: 'rock', name: 'Live rock', cost: 120, beauty: 8, water: 'salt' },
	{ id: 'coral', name: 'Coral garden', cost: 260, beauty: 13, water: 'salt' },
	{ id: 'anemone', name: 'Anemone', cost: 180, beauty: 10, water: 'salt' },
	{ id: 'ornament', name: 'Treasure chest', cost: 40, beauty: 3 },
	{ id: 'bubbles', name: 'Bubble wall', cost: 35, beauty: 3 },
	{ id: 'light', name: 'LED lighting', cost: 150, beauty: 8 },
	{ id: 'backdrop', name: 'Ocean backdrop', cost: 60, beauty: 4 }
];
export const decor = (id: DecorTag) => TANK_DECOR.find((d) => d.id === id)!;

export type StoreItem = 'plant' | 'bench' | 'lamp' | 'poster' | 'rug' | 'sign' | 'statue' | 'fountain' | 'arch';
export const STORE_DECOR: { id: StoreItem; name: string; cost: number; appeal: number; icon: string }[] = [
	{ id: 'poster', name: 'Fish poster', cost: 40, appeal: 1, icon: '🖼️' },
	{ id: 'plant', name: 'Potted plant', cost: 60, appeal: 2, icon: '🪴' },
	{ id: 'lamp', name: 'Floor lamp', cost: 70, appeal: 2, icon: '💡' },
	{ id: 'rug', name: 'Wave rug', cost: 80, appeal: 2, icon: '🟦' },
	{ id: 'bench', name: 'Viewing bench', cost: 90, appeal: 3, icon: '🪑' },
	{ id: 'sign', name: 'Neon fish sign', cost: 250, appeal: 4, icon: '🐟' },
	{ id: 'statue', name: 'Koi statue', cost: 350, appeal: 5, icon: '🗿' },
	{ id: 'fountain', name: 'Water fountain', cost: 600, appeal: 7, icon: '⛲' },
	{ id: 'arch', name: 'Coral archway', cost: 900, appeal: 9, icon: '🌈' }
];
export const FLOORS: { id: string; name: string; cost: number; appeal: number; a: string; b: string }[] = [
	{ id: 'tile', name: 'Plain tile', cost: 0, appeal: 0, a: '#cfd6de', b: '#c3cbd4' },
	{ id: 'wood', name: 'Wood planks', cost: 400, appeal: 3, a: '#b88a5a', b: '#a87a4a' },
	{ id: 'marble', name: 'Marble', cost: 1200, appeal: 6, a: '#eeeef2', b: '#dedee6' },
	{ id: 'ocean', name: 'Ocean glass', cost: 2500, appeal: 10, a: '#5ab8d8', b: '#4aa8c8' }
];
export const GRID_W = 12;
export const GRID_H = 8;

// ── Supplies (sold from the shelf) ───────────────────────────────────────────────────
export type SupplyId = 'food' | 'conditioner' | 'filter' | 'net';
/** Bought wholesale (cost), sold to customers (price). Feeding your centrepiece uses fish food too. */
export const SUPPLIES: { id: SupplyId; name: string; icon: string; cost: number; price: number; color: string }[] = [
	{ id: 'food', name: 'Fish food', icon: '🥫', cost: 3, price: 9, color: '#e8a030' },
	{ id: 'conditioner', name: 'Water conditioner', icon: '🧴', cost: 4, price: 11, color: '#4ab0e8' },
	{ id: 'filter', name: 'Filter cartridges', icon: '🧽', cost: 6, price: 15, color: '#f4f4f4' },
	{ id: 'net', name: 'Fish nets', icon: '🥅', cost: 2, price: 7, color: '#4ac06a' }
];
/** How many of each item the shelf holds, by shelf level. */
export const SHELF_CAP = [0, 20, 35, 55];
export const SHELF_UPGRADE = [0, 600, 1800];
export const RESTOCK_TIME = 45;
/** Share of customers who also pick up supplies. */
export const SUPPLY_BUY = 0.55;

// ── Staff ────────────────────────────────────────────────────────────────────────────
export const ROLES: { id: string; name: string; speed: number; wage: number; hire: number }[] = [
	{ id: 'trainee', name: 'Trainee', speed: 1, wage: 40, hire: 100 },
	{ id: 'aquarist', name: 'Aquarist', speed: 1.5, wage: 90, hire: 450 },
	{ id: 'senior', name: 'Senior Aquarist', speed: 2.2, wage: 180, hire: 1400 }
];
export const MAX_STAFF = 8;
export const STAFF_NAMES = ['Maya', 'Leo', 'Priya', 'Sam', 'Noah', 'Aiko', 'Diego', 'Zara', 'Omar', 'Ivy', 'Kai', 'Nina', 'Ravi', 'Tess', 'Jun', 'Lena'];

// ── Suppliers (the daily shipment gacha) ─────────────────────────────────────────────
export const CRATE_COST = 120;
export const CRATE_FISH = 3;
export const SUPPLIERS: { id: string; name: string; water: Water; temp: Temp; blurb: string }[] = [
	{ id: 'amazon', name: 'Amazon Aquatics', water: 'fresh', temp: 'tropical', blurb: 'Tropical freshwater from river farms.' },
	{ id: 'cold', name: 'Coldwater Co.', water: 'fresh', temp: 'cold', blurb: 'Goldfish, koi and coldwater minnows.' },
	{ id: 'reef', name: 'Coral Coast Imports', water: 'salt', temp: 'tropical', blurb: 'Captive-bred and collected reef fish.' }
];
/** Shipment odds (%); legendaries can only be caught, not shipped. */
export const CRATE_ODDS: [Rarity, number][] = [
	['common', 58],
	['uncommon', 30],
	['rare', 9],
	['ultra', 2.5],
	['epic', 0.5]
];
/** Chance a crate also holds gems. */
export const GEM_ODDS = { small: 0.25, big: 0.03 };

// ── Fishing ──────────────────────────────────────────────────────────────────────────
export const BAIT_COST = 40;
export const CATCH_ODDS: [Rarity, number][] = [
	['rare', 62],
	['ultra', 26],
	['epic', 10],
	['legendary', 2],
	// One cast in ~300: an easter egg (Magikarp in fresh water, Fishy on the reef).
	['mythic', 0.33]
];
export const NET_GEMS: Partial<Record<Rarity, number>> = { rare: 2, ultra: 4, epic: 8, legendary: 15, mythic: 40 };
/** Minigame difficulty: catch-bar height (0–1), fish speed and how jumpy it is. */
export const DIFFICULTY: Partial<Record<Rarity, { bar: number; speed: number; jump: number }>> = {
	rare: { bar: 0.3, speed: 0.6, jump: 0.25 },
	ultra: { bar: 0.25, speed: 0.85, jump: 0.4 },
	epic: { bar: 0.2, speed: 1.1, jump: 0.55 },
	legendary: { bar: 0.15, speed: 1.4, jump: 0.75 },
	mythic: { bar: 0.12, speed: 1.7, jump: 0.95 }
};

// ── Economy ──────────────────────────────────────────────────────────────────────────
export const START_CASH = 800;
export const START_GEMS = 10;
export const HOLDING_BASE = 10;
export const HOLDING_STEP = 5;
export const HOLDING_MAX = 30;
export const HOLDING_COST = 500;
export const FOOD_COST = 5;
/** Seconds a task takes per gem to skip. */
export const GEM_SECONDS = 300;
export const DAILY_BASE = 150;
export const DAILY_STREAK = 30;
export const WHOLESALE = 0.4;
