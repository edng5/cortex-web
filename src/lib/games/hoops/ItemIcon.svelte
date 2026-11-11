<!--
  A little picture of a Check-up gear item, in its colours: a shoe, a headband on a head, a sleeve,
  wristbands, goggles, a chain, a knee pad, a jersey, or hair dye.
-->
<script lang="ts">
	import type { Item } from './items';

	let { item, size = 36, locked = false }: { item: Item; size?: number; locked?: boolean } = $props();
	const SKIN = '#c68642';
	const [main, second] = $derived(item.value.split('|'));
	const outline = '#0f172a';
</script>

<svg class:locked width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
	<rect x="0" y="0" width="36" height="36" rx="8" fill="#1e293b" />
	{#if item.slot == 'shoes'}
		<path d="M5 22 L5 15 L13 15 L17 19 L28 21 Q31 22 31 25 L31 26 L5 26 Z" fill={main} stroke={outline} stroke-width="1.2" />
		<rect x="5" y="25" width="26" height="4" rx="1" fill={second ?? '#f8fafc'} stroke={outline} stroke-width="1.2" />
		<path d="M10 17 L14 17 M11 19 L16 19" stroke={second ?? '#f8fafc'} stroke-width="1.5" />
	{:else if item.slot == 'band'}
		<rect x="9" y="8" width="18" height="20" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="8" y="12" width="20" height="5" fill={main} stroke={outline} stroke-width="1.2" />
		<rect x="13" y="20" width="3" height="3" fill={outline} /><rect x="20" y="20" width="3" height="3" fill={outline} />
	{:else if item.slot == 'goggles'}
		<rect x="9" y="8" width="18" height="20" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="7" y="15" width="22" height="7" rx="2" fill="#111827" />
		<rect x="10" y="16.5" width="6" height="4" rx="1" fill="#93c5fd" /><rect x="20" y="16.5" width="6" height="4" rx="1" fill="#93c5fd" />
	{:else if item.slot == 'sleeve'}
		<rect x="13" y="4" width="10" height="28" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="13" y="7" width="10" height="20" rx="2" fill={main} stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'wrist'}
		<rect x="5" y="8" width="9" height="22" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="22" y="8" width="9" height="22" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="4" y="21" width="11" height="5" fill={main} stroke={outline} stroke-width="1.2" />
		<rect x="21" y="21" width="11" height="5" fill={main} stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'chain'}
		<path d="M8 7 Q18 26 28 7" fill="none" stroke={main} stroke-width="2.5" stroke-dasharray="3 1.5" />
		<rect x="14.5" y="19" width="7" height="9" rx="1.5" fill={main} stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'knee'}
		<rect x="12" y="3" width="12" height="30" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<rect x="11" y="13" width="14" height="9" rx="2" fill={main} stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'jersey'}
		<path d="M10 6 L15 6 Q18 10 21 6 L26 6 L28 12 L26 13 L26 31 L10 31 L10 13 L8 12 Z" fill={main} stroke={outline} stroke-width="1.2" />
		<text x="18" y="25" text-anchor="middle" font-size="9" font-weight="900" fill={main == '#f8fafc' || main == '#facc15' || main == '#d4af37' ? outline : '#f8fafc'}>23</text>
	{:else if item.slot == 'hairColor'}
		<rect x="9" y="11" width="18" height="18" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<path d="M8 15 L8 9 Q18 3 28 9 L28 15 Q18 10 8 15 Z" fill={main} stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'hair'}
		<rect x="9" y="11" width="18" height="18" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<path d="M7 18 L7 9 Q18 2 29 9 L29 22 L26 22 L26 13 Q17 8 10 14 L10 22 L7 22 Z" fill="#5a3825" stroke={outline} stroke-width="1.2" />
	{:else if item.slot == 'floor'}
		{#each [0, 1, 2, 3] as r (r)}{#each [0, 1, 2, 3] as c (c)}<rect x={4 + c * 7} y={4 + r * 7} width="7" height="7" fill={(r + c) % 2 ? main : (second ?? main)} />{/each}{/each}
		{#if item.value.split('|')[2]}<rect x="12" y="4" width="12" height="16" fill={item.value.split('|')[2]} />{/if}
		<rect x="4" y="20" width="28" height="2" fill="#f8fafc" />
	{:else if item.slot == 'key'}
		<rect x="4" y="4" width="28" height="28" fill="#2f6690" />
		<rect x="11" y="4" width="14" height="20" fill={main} stroke="#f8fafc" stroke-width="1.5" />
		<path d="M11 24 Q18 31 25 24" fill="none" stroke="#f8fafc" stroke-width="1.5" />
	{:else if item.slot == 'board'}
		<rect x="5" y="6" width="26" height="18" fill={item.value == 'shattered' ? '#cbd5e1' : '#e2e8f0'} stroke="#94a3b8" stroke-width="1.2" />
		<rect x="13" y="12" width="10" height="8" fill="none" stroke={item.value == 'bank' ? '#facc15' : '#ea580c'} stroke-width={item.value == 'bank' ? 2.5 : 1.6} />
		{#if item.value == 'shattered'}<path d="M18 15 L9 8 M18 15 L28 9 M18 15 L26 23 M18 15 L8 21" stroke="#475569" stroke-width="1" />{/if}
		{#if item.value == 'binary'}<text x="18" y="12" text-anchor="middle" font-size="5" font-family="monospace" fill="#1e293b">1011</text>{/if}
		<rect x="12" y="25" width="12" height="2.5" fill="#ea580c" />
		<path d="M13 28 L15 33 M17 28 L17 33 M21 28 L19 33 M23 28 L21 33" stroke="#e5e7eb" stroke-width="1" />
	{:else if item.slot == 'net'}
		<rect x="7" y="8" width="22" height="3" rx="1" fill="#ea580c" />
		<path d="M8 11 L12 28 M13 11 L15 28 M18 11 L18 28 M23 11 L21 28 M28 11 L24 28 M11 18 L25 18 M12 24 L24 24" stroke={item.value == 'nylon' ? '#f8fafc' : '#9ca3af'} stroke-width={item.value == 'nylon' ? 1.6 : 1.1} stroke-dasharray={item.value == 'chain' ? '2 1' : 'none'} />
	{:else if item.slot == 'ball'}
		{#if item.value == 'aba'}
			<clipPath id="ball-clip"><circle cx="18" cy="18" r="11" /></clipPath>
			<g clip-path="url(#ball-clip)"><rect x="7" y="7" width="8" height="22" fill="#dc2626" /><rect x="15" y="7" width="7" height="22" fill="#f8fafc" /><rect x="22" y="7" width="8" height="22" fill="#2563eb" /></g>
			<circle cx="18" cy="18" r="11" fill="none" stroke={outline} stroke-width="1.2" />
		{:else}
			<circle cx="18" cy="18" r="11" fill={item.value == 'gold' ? '#facc15' : '#f97316'} stroke={outline} stroke-width="1.2" />
			<path d="M7 18 L29 18 M18 7 L18 29 M10 10 Q15 18 10 26 M26 10 Q21 18 26 26" stroke={item.value == 'gold' ? '#a16207' : '#7c2d12'} stroke-width="1.2" fill="none" />
		{/if}
	{:else if item.slot == 'hat'}
		<rect x="9" y="14" width="18" height="16" rx="3" fill={SKIN} stroke={outline} stroke-width="1.2" />
		<path d="M7 15 L7 6 L12 11 L18 4 L24 11 L29 6 L29 15 Z" fill={main} stroke={outline} stroke-width="1.2" />
		<rect x="16.5" y="10" width="3" height="3" fill="#dc2626" />
	{:else if item.slot == 'decal' && item.value == 'crown'}
		<rect x="4" y="4" width="28" height="28" fill="#2f6690" />
		<path d="M8 25 L8 12 L13 18 L18 9 L23 18 L28 12 L28 25 Z" fill="#facc15" stroke={outline} stroke-width="1.2" />
		<rect x="16.5" y="19" width="3" height="3" fill="#dc2626" />
	{:else if item.slot == 'decal'}
		<rect x="4" y="4" width="28" height="28" fill="#2f6690" />
		<circle cx="18" cy="18" r="10" fill="#0ea5e9" stroke="#facc15" stroke-width="3" />
		<path d="M11 19 Q14 15 17 19 T23 19 T27 18" stroke="#f8fafc" stroke-width="1.8" fill="none" />
	{/if}
	{#if locked}
		<!-- Still locked: a little padlock in the corner (the item keeps its colours, so you see what you'd get). -->
		<rect x="23" y="23" width="12" height="12" rx="3" fill="#0f172a" opacity="0.85" />
		<rect x="25.5" y="28" width="7" height="5" rx="1" fill="#facc15" />
		<path d="M27 28 L27 26.5 Q29 24 31 26.5 L31 28" fill="none" stroke="#facc15" stroke-width="1.3" />
	{/if}
</svg>

<style>
	svg {
		flex: none;
		display: block;
	}
	.locked {
		opacity: 0.9;
	}
</style>
