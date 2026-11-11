// E.Ngine Games: the in-browser ports of Edward's high-school Java games. Each game's code loads
// only when it's first played.
import type { Component } from 'svelte';
import type { ArcadeGame } from './common';

export type GameId = 'topgun' | 'fishy' | 'spaceinvaders' | 'frogger' | 'pong' | 'ispy' | 'blockdrop' | 'ifish' | 'chess' | 'fourrow';

/** What a component game (spec.ui) is given. */
export interface GameUiProps {
	/** Showing (false: hidden, paused). */
	active: boolean;
	/** The player picked Quit in the game. */
	onquit: () => void;
	loggedIn: boolean;
}

/** On-screen controls for touch screens (TouchControls.svelte). */
export interface TouchSpec {
	/** The joystick (W/A/S/D): h = left/right only, 4 = one direction at a time, 8 = any. */
	stick?: 'h' | '4' | '8';
	/** Arrow buttons (held like keys) instead of the joystick, left to right. */
	arrows?: ('left' | 'down' | 'up' | 'right')[];
	/** A bigger joystick (or two). */
	bigStick?: boolean;
	/** Crossy Road style instead of a joystick: tap to go forward (W), swipe to go that way. */
	gesture?: boolean;
	/** A second joystick on the right sending the arrow keys (Fishy's player 2). */
	stick2?: boolean;
	/** A wide game: on phones, ask for landscape (it's too small held upright). */
	landscape?: boolean;
	/** Joystick in the middle of the screen with the buttons beside it (instead of at the edges). */
	center?: boolean;
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
	/** Shown in a row under the list and preview in the games menu (instead of the list): 1 or 2. */
	row?: 1 | 2;
	/** Where the game keeps its progress in localStorage (synced to the player's account). */
	saveKey: string;
	/** Canvas size (the Java window's drawing area). */
	w: number;
	h: number;
	/** Fixed game-loop step, as the Java thread's sleep. */
	tickMs: number;
	/** Controls under the game: keys, then what they do. */
	help: { keys: string[]; label: string }[];
	touch: TouchSpec;
	/** What the global boards are called (board number → name); none for games without high scores. */
	boards: Record<number, string>;
	/** A canvas game… */
	load?: () => Promise<ArcadeGame>;
	/** …or a game made of Svelte components (menus and panels), with its soundtrack. */
	ui?: () => Promise<Component<GameUiProps>>;
	music?: string;
}

const MOUSE = { keys: ['Mouse'], label: 'menus' };

export const GAMES: GameSpec[] = [
	{
		id: 'topgun',
		saveKey: 'topgun-save',
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
		touch: {
			stick: '8',
			bigStick: true,
			// Missile and Roll appear once those upgrades are bought.
			buttons: [{ label: 'Pause', code: 'Enter' }, { label: 'Roll', code: 'Roll' }, { label: 'Missile', code: 'ShiftLeft' }, { label: 'Fire', code: 'Space', big: true }]
		},
		boards: { 1: 'Mission 1', 2: 'Mission 2', 3: 'Mission 3' },
		load: async () => {
			const m = await import('./topgun/TopGun');
			return new m.TopGun(await m.loadAssets());
		}
	},
	{
		id: 'fishy',
		saveKey: 'fishy-save',
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
			{ keys: ['Enter'], label: 'pause / play again' },
			MOUSE
		],
		touch: { stick: '8', stick2: true, bigStick: true, landscape: true, buttons: [{ label: 'Pause', code: 'Enter' }] },
		boards: { 1: 'Easy', 2: 'Medium', 3: 'Hard' },
		load: async () => {
			const m = await import('./fishy/Fishy');
			return new m.Fishy(await m.loadAssets());
		}
	},
	{
		id: 'spaceinvaders',
		saveKey: 'spaceinvaders-save',
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
			{ keys: ['Enter'], label: 'pause' },
			MOUSE
		],
		touch: { arrows: ['left', 'right'], buttons: [{ label: 'Pause', code: 'Enter' }, { label: 'Fire', code: 'Space', big: true }] },
		boards: { 1: 'Normal', 2: 'Hard', 3: 'No shields' },
		load: async () => {
			const m = await import('./spaceinvaders/SpaceInvaders');
			return new m.SpaceInvaders(await m.loadAssets());
		}
	},
	{
		id: 'frogger',
		saveKey: 'frogger-save',
		title: 'Frogger',
		blurb: 'Timed lily-pad runs or an endless hop. Coins unlock new characters.',
		icon: '/games/icons/frogger.png',
		preview: '/games/previews/frogger.jpg',
		tagline: 'Classic or Endless · 10 friends',
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
		boards: { 1: 'Classic', 2: 'Endless' },
		load: async () => {
			const m = await import('./frogger/Frogger');
			return new m.Frogger();
		}
	},
	{
		id: 'pong',
		saveKey: 'pong-save',
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
		touch: { arrows: ['left', 'right'], center: true, buttons: [{ label: 'Serve', code: 'Space', big: true }] },
		boards: { 1: 'Pong', 2: 'Brick Breaker' },
		load: async () => {
			const m = await import('./pong/Pong');
			return new m.Pong(await m.loadAssets());
		}
	},
	{
		id: 'ispy',
		saveKey: 'ispy-save',
		title: 'iSpy',
		blurb: 'I spy with my little eye… something red! Find what I spy in busy scenes before time runs out, or stump the computer.',
		icon: '/games/icons/ispy.png',
		preview: '/games/previews/ispy.jpg',
		tagline: 'Seek & find · stump the computer',
		accent: '#14b8a6',
		w: 900,
		h: 640,
		tickMs: 16,
		help: [MOUSE, { keys: ['H'], label: 'hint' }, { keys: ['Enter'], label: 'pause' }],
		touch: { buttons: [{ label: 'Hint', code: 'KeyH' }, { label: 'Pause', code: 'Enter' }] },
		boards: { 1: 'Seek & Find' },
		load: async () => (await import('./ispy/ISpy')).create()
	},
	{
		id: 'ifish',
		saveKey: 'ifish-save',
		title: 'FishMart',
		blurb: 'Run a fish store with 800+ real species, then fish, breed and trade.',
		icon: '/games/icons/ifish.png',
		preview: '/games/previews/ifish.jpg',
		tagline: 'Fish store sim · global showcase',
		accent: '#2ab0e8',
		row: 1,
		w: 1040,
		h: 700,
		tickMs: 1000,
		help: [],
		touch: { buttons: [] },
		boards: {},
		// FishMart picks its own soundtrack (by tab, and the store's tunes take turns).
		ui: async () => (await import('./fishstore/IFish.svelte')).default
	},
	{
		id: 'chess',
		saveKey: 'chess-save',
		title: 'Chess',
		blurb: 'Play chess online against a friend: make a room, share its code. Your rating rises and falls with every game.',
		icon: '/games/icons/chess.png',
		preview: '/games/previews/chess.jpg',
		tagline: 'Online · room codes',
		accent: '#e0b46b',
		row: 1,
		w: 640,
		h: 760,
		tickMs: 1000,
		help: [],
		touch: { buttons: [] },
		boards: {},
		music: 'chess-menu',
		ui: async () => (await import('./chess/Chess.svelte')).default
	},
	{
		id: 'fourrow',
		saveKey: 'fourrow-save',
		title: 'Four in a Row',
		blurb: 'Drop discs, line up four before your friend does. Online with room codes, with a rating for every player.',
		icon: '/games/icons/fourrow.png',
		preview: '/games/previews/fourrow.jpg',
		tagline: 'Online · room codes',
		accent: '#facc15',
		row: 1,
		w: 640,
		h: 700,
		tickMs: 1000,
		help: [],
		touch: { buttons: [] },
		boards: {},
		music: 'fourrow-menu',
		ui: async () => (await import('./fourrow/FourRow.svelte')).default
	},
	{
		id: 'blockdrop',
		saveKey: 'blockdrop-save',
		title: 'Block Drop',
		blurb: 'Falling-block puzzles: turn and slide the shapes to fill rows. Every 10 rows the level goes up and they fall faster.',
		icon: '/games/icons/blockdrop.png',
		preview: '/games/previews/blockdrop.jpg',
		tagline: 'Clear rows · climb levels',
		accent: '#c46bff',
		row: 2,
		w: 480,
		h: 600,
		tickMs: 16,
		help: [
			{ keys: ['A', 'D'], label: 'move' },
			{ keys: ['S'], label: 'soft drop' },
			{ keys: ['W'], label: 'rotate' },
			{ keys: ['Space'], label: 'drop' },
			{ keys: ['Enter'], label: 'pause' },
			MOUSE
		],
		touch: {
			arrows: ['left', 'down', 'right'],
			buttons: [{ label: 'Pause', code: 'Enter' }, { label: 'Rotate', code: 'KeyW' }, { label: 'Drop', code: 'Space', big: true }]
		},
		boards: { 1: 'Score' },
		load: async () => (await import('./blockdrop/BlockDrop')).create()
	}
];

export const gameById = (id: string | null) => GAMES.find((g) => g.id === id) ?? null;
