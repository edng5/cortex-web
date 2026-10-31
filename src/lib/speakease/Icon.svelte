<!-- The handful of icons the SpeakEase app used (Ionicons / Material look-alikes), as inline SVG. -->
<script lang="ts">
	type Name =
		| 'settings'
		| 'star'
		| 'star-outline'
		| 'menu'
		| 'mic'
		| 'mic-none'
		| 'check'
		| 'copy'
		| 'volume'
		| 'bulb'
		| 'trash'
		| 'help'
		| 'close'
		| 'play'
		| 'back'
		| 'flame'
		| 'sparkles'
		| 'slow'
		| 'next'
		| 'retry'
		| 'sun'
		| 'moon'
		| 'auto'
		| 'bolt'
		| 'book'
		| 'medal';
	let { name, size = 24, color = 'currentColor' }: { name: Name; size?: number; color?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
	{#if name === 'settings'}
		<path
			fill="none"
			stroke={color}
			stroke-width="1.6"
			stroke-linejoin="round"
			d="M10.3 3h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.7v1.8l1.8 1.7-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.7v-1.8L4.2 8.4l1.7-2.9 2.3.8 1.6-.9z"
		/>
		<circle cx="12" cy="12" r="3" fill="none" stroke={color} stroke-width="1.6" />
	{:else if name === 'star'}
		<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
	{:else if name === 'star-outline'}
		<path fill="none" stroke={color} stroke-width="1.6" stroke-linejoin="round" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
	{:else if name === 'menu'}
		<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
	{:else if name === 'mic'}
		<path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5.3-3a5.3 5.3 0 01-10.6 0H5a7 7 0 006 6.9V21h2v-3.1a7 7 0 006-6.9z" />
	{:else if name === 'mic-none'}
		<path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm-1.2-9a1.2 1.2 0 012.4 0v6a1.2 1.2 0 01-2.4 0zM17.3 11a5.3 5.3 0 01-10.6 0H5a7 7 0 006 6.9V21h2v-3.1a7 7 0 006-6.9z" />
	{:else if name === 'check'}
		<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.6 14.4L6 12l1.4-1.4 3 3 6.2-6.2L18 8.8z" />
	{:else if name === 'copy'}
		<path d="M16 1H6a2 2 0 00-2 2v12h2V3h10zm3 4H10a2 2 0 00-2 2v14a2 2 0 002 2h9a2 2 0 002-2V7a2 2 0 00-2-2zm0 16h-9V7h9z" />
	{:else if name === 'volume'}
		<path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z" />
	{:else if name === 'bulb'}
		<path d="M9 21a1 1 0 001 1h4a1 1 0 001-1v-1H9zm3-19a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" />
	{:else if name === 'trash'}
		<path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z" />
	{:else if name === 'help'}
		<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2zm2.1-7.7l-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3a2 2 0 00.6-1.4 2 2 0 00-4 0H8a4 4 0 018 0 3.2 3.2 0 01-.9 2.3z" />
	{:else if name === 'close'}
		<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6l3.6-3.6L7 8.4 8.4 7l3.6 3.6L15.6 7 17 8.4 13.4 12z" />
	{:else if name === 'play'}
		<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14.5v-9l6 4.5z" />
	{:else if name === 'flame'}
		<path d="M12 2c.4 3.2 4.5 5.6 4.5 10.5A5 5 0 0112 18a5 5 0 01-4.5-5.5c0-2.3 1.3-4 2.5-5 .1 1.8.9 3 2 3.5C11.3 8.6 11.4 5.5 12 2z" />
		<path d="M12 22a3.5 3.5 0 01-3.5-3.5c0-1.6 1-2.7 2-3.3 0 1 .6 1.8 1.5 2 .2-1.3.9-2.5 2-3.2.6 1.1 1.5 2.4 1.5 4.5A3.5 3.5 0 0112 22z" opacity="0.6" />
	{:else if name === 'sparkles'}
		<path d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9zm8 10l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9zM18 2l.7 1.3L20 4l-1.3.7L18 6l-.7-1.3L16 4l1.3-.7z" />
	{:else if name === 'slow'}
		<path d="M19.5 14.5c1 0 1.5-.8 1.5-1.6 0-1-.8-1.9-2-1.9h-.3A7 7 0 005 11c-1.6.3-3 1.6-3 3.4V16h2.6l.6 2h2.3l.4-1.5h7.2l.4 1.5h2.3l.6-2H21v-1.5zM9 9.3h6a5 5 0 012.7 1.7H6.3A5 5 0 019 9.3z" />
	{:else if name === 'next'}
		<path d="M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z" />
	{:else if name === 'retry'}
		<path d="M17.7 6.3A8 8 0 104 12h2a6 6 0 1110.3-4.2L13 11h7V4z" />
	{:else if name === 'sun'}
		<path d="M12 7a5 5 0 100 10 5 5 0 000-10zM11 1h2v3h-2zm0 19h2v3h-2zM3.5 4.9l1.4-1.4 2.1 2.1-1.4 1.4zm13 13l1.4-1.4 2.1 2.1-1.4 1.4zM1 11h3v2H1zm19 0h3v2h-3zM3.5 19.1l2.1-2.1 1.4 1.4-2.1 2.1zm13-13l2.1-2.1 1.4 1.4-2.1 2.1z" />
	{:else if name === 'moon'}
		<path d="M12.3 2a9 9 0 109.7 11.6A7.5 7.5 0 0112.3 2z" />
	{:else if name === 'auto'}
		<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18V4a8 8 0 010 16z" />
	{:else if name === 'bolt'}
		<path d="M13 2L4 14h6l-1 8 9-12h-6z" />
	{:else if name === 'book'}
		<path d="M4 4.5A2.5 2.5 0 016.5 2H20v16H6.5A1.5 1.5 0 005 19.5 1.5 1.5 0 006.5 21H20v1H6.5A2.5 2.5 0 014 19.5zM8 6v2h8V6z" />
	{:else if name === 'medal'}
		<path d="M7 2h4l1 3 1-3h4l-3 7.1A6.5 6.5 0 1112 22a6.5 6.5 0 01-2-12.7zm5 10l-1.2 2.4-2.6.4 1.9 1.8-.5 2.6 2.4-1.2 2.4 1.2-.5-2.6 1.9-1.8-2.6-.4z" />
	{:else if name === 'back'}
		<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
	{/if}
</svg>
