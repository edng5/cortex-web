<script lang="ts">
	import '../app.css';
	import { site } from '$lib/config/site';
	let { children } = $props();
</script>

<svelte:head>
	<title>{site.title}</title>
	<meta name="description" content={site.description} />
	<meta property="og:title" content={site.title} />
	<meta property="og:description" content={site.description} />
</svelte:head>

{@render children()}
