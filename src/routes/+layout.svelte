<script lang="ts">
	import '../app.css';
	import { site } from '$lib/config/site';
	import { session } from '$lib/session.svelte';
	import NicknameModal from '$lib/components/NicknameModal.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<title>{site.title}</title>
	<meta name="description" content={site.description} />
	<meta property="og:title" content={site.title} />
	<meta property="og:description" content={site.description} />
</svelte:head>

{@render children()}

<!-- Signed in without a nickname (just after typing the sign-in code, or after Google): pick one first. -->
{#if session.user && session.playerName === null}<NicknameModal />{/if}
