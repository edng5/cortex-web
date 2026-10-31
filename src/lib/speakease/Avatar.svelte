<!-- A character's portrait, in a circle: Easso the robot (redrawn from the app's mascot) or Cortex,
     the site's assistant (a brain with a smiling chip at its heart, redrawn from his icon). -->
<script lang="ts">
	import type { Persona } from './data';

	let { look, size = 48, name = '' }: { look: Persona; size?: number; name?: string } = $props();

	const uid = $props.id();
</script>

<svg class="avatar" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={name || (look === 'easso' ? 'Easso' : 'Cortex')}>
	<defs>
		<clipPath id="c{uid}"><circle cx="50" cy="50" r="50" /></clipPath>
		{#if look === 'easso'}
			<linearGradient id="bg{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b9bff" /><stop offset="1" stop-color="#1db1fd" /></linearGradient>
			<linearGradient id="head{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#dfe7f3" /></linearGradient>
			<radialGradient id="eye{uid}"><stop offset="0" stop-color="#e0fbff" /><stop offset="0.45" stop-color="#5ee7ff" /><stop offset="1" stop-color="#1d9bf0" /></radialGradient>
		{:else}
			<linearGradient id="bg{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e2a5a" /><stop offset="1" stop-color="#3b1f6e" /></linearGradient>
			<radialGradient id="glow{uid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5eead4" stop-opacity="0.55" /><stop offset="1" stop-color="#5eead4" stop-opacity="0" /></radialGradient>
			<linearGradient id="brain{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7eb3" /><stop offset="1" stop-color="#e5306f" /></linearGradient>
			<linearGradient id="chip{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9" /><stop offset="1" stop-color="#0ea5e9" /></linearGradient>
		{/if}
	</defs>
	<g clip-path="url(#c{uid})">
		<rect width="100" height="100" fill="url(#bg{uid})" />
		{#if look === 'easso'}
			<!-- Easso: white robot head, dark visor with glowing eyes and a smile, antenna, headset mic. -->
			<circle cx="22" cy="20" r="14" fill="#fff" opacity="0.12" />
			<path d="M18 100c2-15 15-23 32-23s30 8 32 23z" fill="#eef3fa" />
			<path d="M40 78h20v6a10 10 0 01-20 0z" fill="#c9d5e6" />
			<circle cx="50" cy="91" r="3.2" fill="#5ee7ff" />
			<path d="M50 20V11" stroke="#c9d5e6" stroke-width="3" stroke-linecap="round" />
			<circle cx="50" cy="9" r="4.2" fill="#ff6b8b" />
			<circle cx="48.8" cy="7.8" r="1.3" fill="#fff" opacity="0.8" />
			<rect x="16" y="38" width="9" height="20" rx="4" fill="#c9d5e6" />
			<rect x="75" y="38" width="9" height="20" rx="4" fill="#c9d5e6" />
			<rect x="22" y="19" width="56" height="54" rx="20" fill="url(#head{uid})" />
			<rect x="22" y="19" width="56" height="54" rx="20" fill="none" stroke="#b8c6da" stroke-width="1.2" />
			<rect x="29" y="31" width="42" height="30" rx="13" fill="#17223b" />
			<rect x="31" y="33" width="38" height="8" rx="4" fill="#fff" opacity="0.07" />
			<ellipse cx="41" cy="45" rx="4.6" ry="5.4" fill="url(#eye{uid})" />
			<ellipse cx="59" cy="45" rx="4.6" ry="5.4" fill="url(#eye{uid})" />
			<circle cx="42.4" cy="43.4" r="1.3" fill="#fff" />
			<circle cx="60.4" cy="43.4" r="1.3" fill="#fff" />
			<path d="M44 53.5q6 4.5 12 0" stroke="#5ee7ff" stroke-width="2.4" fill="none" stroke-linecap="round" />
			<circle cx="34.5" cy="54" r="2.6" fill="#ff8fab" opacity="0.55" />
			<circle cx="65.5" cy="54" r="2.6" fill="#ff8fab" opacity="0.55" />
			<path d="M20 56c0 10 7 16 18 16" stroke="#17223b" stroke-width="2.4" fill="none" stroke-linecap="round" />
			<rect x="36" y="69" width="7" height="5" rx="2.5" fill="#17223b" />
		{:else}
			<!-- Cortex: a glossy brain with a glowing chip at its heart, a smiling robot face on the chip. -->
			<g fill="#ffffff" opacity="0.5">
				<circle cx="16" cy="22" r="0.9" /><circle cx="84" cy="18" r="0.7" /><circle cx="88" cy="70" r="0.8" /><circle cx="12" cy="76" r="0.6" />
			</g>
			<!-- brain: two hemispheres of soft lobes -->
			<path
				d="M50 19c-4-5-12-6-16-2-6-2-12 2-12 8-6 2-8 9-5 14-4 4-3 11 2 14-1 6 4 11 10 11 3 5 10 6 14 3 3 3 5 3 7 3z"
				fill="url(#brain{uid})"
			/>
			<path
				d="M50 19c4-5 12-6 16-2 6-2 12 2 12 8 6 2 8 9 5 14 4 4 3 11-2 14 1 6-4 11-10 11-3 5-10 6-14 3-3 3-5 3-7 3z"
				fill="url(#brain{uid})"
			/>
			<!-- folds -->
			<g fill="none" stroke="#a3124a" stroke-width="2" stroke-linecap="round" opacity="0.55">
				<path d="M50 20v50" />
				<path d="M33 25c3 2 4 5 3 8M24 37c4 0 7 2 8 5M22 52c4-1 7 0 9 3M30 65c2-3 5-4 8-3" />
				<path d="M67 25c-3 2-4 5-3 8M76 37c-4 0-7 2-8 5M78 52c-4-1-7 0-9 3M70 65c-2-3-5-4-8-3" />
			</g>
			<!-- shine -->
			<path d="M30 24c3-3 8-4 12-2" stroke="#ffd1e3" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8" />
			<path d="M58 22c4-2 9-1 12 2" stroke="#ffd1e3" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.6" />
			<!-- chip glow, pins and body -->
			<circle cx="50" cy="47" r="24" fill="url(#glow{uid})" />
			<g stroke="#bae6fd" stroke-width="2" stroke-linecap="round">
				<path d="M42 33v-4M58 33v-4M42 61v4M50 61v4M58 61v4M36 39h-4M36 47h-4M36 55h-4M64 39h4M64 47h4M64 55h4" />
			</g>
			<rect x="36" y="33" width="28" height="28" rx="7" fill="url(#chip{uid})" stroke="#e0f7ff" stroke-width="1.5" />
			<rect x="38" y="35" width="24" height="7" rx="3.5" fill="#fff" opacity="0.18" />
			<!-- robot face -->
			<rect x="41" y="41" width="18" height="14" rx="7" fill="#0f172a" />
			<path d="M44.5 47.5q1.6-2 3.2 0M52.3 47.5q1.6-2 3.2 0" stroke="#5eead4" stroke-width="1.6" fill="none" stroke-linecap="round" />
			<path d="M47.5 51q2.5 1.6 5 0" stroke="#5eead4" stroke-width="1.4" fill="none" stroke-linecap="round" />
			<!-- "C" badge on the antenna -->
			<path d="M50 33v-3" stroke="#e0f7ff" stroke-width="1.6" />
			<circle cx="50" cy="28.5" r="3.6" fill="#0f172a" stroke="#e0f7ff" stroke-width="1" />
			<path d="M51.4 27.2a1.9 1.9 0 100 2.6" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" />
		{/if}
	</g>
</svg>

<style>
	.avatar {
		flex: none;
		display: block;
		border-radius: 50%;
	}
</style>
