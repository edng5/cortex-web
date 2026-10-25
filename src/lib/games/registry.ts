// E.Ngine Games: the in-browser ports of Edward's high-school Java games. Each game's code loads
// only when it's first played.
import type { ArcadeGame } from './common';

export type GameId = 'topgun' | 'fishy' | 'spaceinvaders' | 'frogger' | 'pong';

/** On-screen controls for touch screens (TouchControls.svelte). */
export interface TouchSpec {
	/** The joystick (W/A/S/D): h = left/right only, 4 = one direction at a time, 8 = any. */
	stick?: 'h' | '4' | '8';
	/** Crossy Road style instead of a joystick: tap to go forward (W), swipe to go that way. */
	gesture?: boolean;
	/** A second joystick on the right sending the arrow keys (Fishy's player 2). */
	stick2?: boolean;
	/** A wide game: on phones, ask for landscape (it's too small held upright). */
	landscape?: boolean;
	/** Re-press the held direction every this many ms (for one-action-per-press games). */
	repeat?: number;
	buttons: { label: string; code: string; big?: boolean }[];
}

export interface GameSpec {
	id: GameId;
	title: string;
	blurb: string;
	/** Menu button icon, and the gameplay picture previewed beside the buttons. */
	icon: string;
	preview: string;
	/** Short line under the title on the menu button. */
	tagline: string;
	accent: string;
	/** Canvas size (the Java window's drawing area). */
	w: number;
	h: number;
	/** Fixed game-loop step, as the Java thread's sleep. */
	tickMs: number;
	/** Controls under the game: keys, then what they do. */
	help: { keys: string[]; label: string }[];
	touch: TouchSpec;
	/** What the global boards are called (board number → name). */
	boards: Record<number, string>;
	load: () => Promise<ArcadeGame>;
}

const MOUSE = { keys: ['Mouse'], label: 'menus' };

export const GAMES: GameSpec[] = [
	{
		id: 'topgun',
		title: 'Top Gun',
		blurb: 'Fly three missions against waves of fighter jets, ships and an army base.',
		icon: '/games/icons/topgun.png',
		preview: '/games/previews/topgun.jpg',
		tagline: '3 missions · upgrades',
		accent: '#38bdf8',
		w: 600,
		h: 536,
		tickMs: 16,
		help: [
			{ keys: ['W', 'A', 'S', 'D'], label: 'fly' },
			{ keys: ['Space'], label: 'guns' },
			{ keys: ['Shift'], label: 'missile' },
			{ keys: ['Enter'], label: 'pause' },
			MOUSE
		],
		touch: { stick: '8', buttons: [{ label: 'Pause', code: 'Enter' }, { label: 'Missile', code: 'ShiftLeft' }, { label: 'Fire', code: 'Space', big: true }] },
		boards: { 1: 'Mission 1', 2: 'Mission 2', 3: 'Mission 3' },
		load: async () => {
			const m = await import('./topgun/TopGun');
			return new m.TopGun(await m.loadAssets());
		}
	},
	{
		id: 'fishy',
		title: 'Fishy',
		blurb: 'Eat smaller fish to grow, dodge the bigger ones, sharks and hooks. 2P local too.',
		icon: '/games/icons/fishy.png',
		preview: '/games/previews/fishy.jpg',
		tagline: 'Eat or be eaten · 2P local',
		accent: '#22d3ee',
		w: 900,
		h: 662,
		tickMs: 10,
		help: [
			{ keys: ['W', 'A', 'S', 'D'], label: 'swim' },
			{ keys: ['←', '↑', '↓', '→'], label: 'player 2' },
			{ keys: ['Enter'], label: 'play again' },
			MOUSE
		],
		touch: { stick: '8', stick2: true, landscape: true, buttons: [] },
		boards: { 1: 'Easy', 2: 'Medium', 3: 'Hard' },
		load: async () => {
			const m = await import('./fishy/Fishy');
			return new m.Fishy(await m.loadAssets());
		}
	},
	{
		id: 'spaceinvaders',
		title: 'Space Invaders',
		blurb: 'The arcade classic: Normal, Hard with boss waves, or No Shields with no bunkers to hide behind.',
		icon: '/games/icons/spaceinvaders.png',
		preview: '/games/previews/spaceinvaders.jpg',
		tagline: 'Waves, bosses, bunkers',
		accent: '#facc15',
		w: 550,
		h: 664,
		tickMs: 15,
		help: [
			{ keys: ['A', 'D'], label: 'move' },
			{ keys: ['Space'], label: 'shoot' },
			{ keys: ['Shift'], label: 'pause' },
			MOUSE
		],
		touch: { stick: 'h', buttons: [{ label: 'Pause', code: 'ShiftLeft' }, { label: 'Fire', code: 'Space', big: true }] },
		boards: { 1: 'Normal', 2: 'Hard', 3: 'No shields' },
		load: async () => {
			const m = await import('./spaceinvaders/SpaceInvaders');
			return new m.SpaceInvaders(await m.loadAssets());
		}
	},
	{
		id: 'frogger',
		title: 'Frogger',
		blurb: 'Hop across the road and river to the lily pads, collect coins and roll the gumball machine for swamp friends.',
		icon: '/games/icons/frogger.png',
		preview: '/games/previews/frogger.jpg',
		tagline: 'Hop, dodge, collect 10 friends',
		accent: '#4ade80',
		w: 520,
		h: 560,
		tickMs: 16,
		help: [
			{ keys: ['W', 'A', 'S', 'D'], label: 'hop' },
			{ keys: ['Enter'], label: 'pause' },
			MOUSE
		],
		touch: { gesture: true, buttons: [{ label: 'Pause', code: 'Enter' }] },
		boards: { 1: 'High score' },
		load: async () => {
			const m = await import('./frogger/Frogger');
			return new m.Frogger();
		}
	},
	{
		id: 'pong',
		title: 'Pong × Brick Breaker',
		blurb: 'Two games in one: keep the ball alive as it speeds up, or clear all 50 bricks.',
		icon: '/games/icons/pong.png',
		preview: '/games/previews/pong.jpg',
		tagline: 'Two paddle games in one',
		accent: '#f97316',
		w: 550,
		h: 670,
		tickMs: 10,
		help: [
			{ keys: ['A', 'D'], label: 'paddle' },
			{ keys: ['Space'], label: 'serve' },
			{ keys: ['Enter'], label: 'menu after game over' },
			MOUSE
		],
		touch: { stick: 'h', buttons: [{ label: 'Serve', code: 'Space', big: true }] },
		boards: { 1: 'Pong', 2: 'Brick Breaker' },
		load: async () => {
			const m = await import('./pong/Pong');
			return new m.Pong(await m.loadAssets());
		}
	}
];

export const gameById = (id: string | null) => GAMES.find((g) => g.id === id) ?? null;
