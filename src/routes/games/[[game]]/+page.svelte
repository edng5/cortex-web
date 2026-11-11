<!-- /games and /games/<id>: the home page, with E.Ngine Games open (see the home page). -->
<script lang="ts">
	import Home from '../../+page.svelte';
	import { site } from '$lib/config/site';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.gameTitle ? `${data.gameTitle} · E.Ngine Games` : 'E.Ngine Games'} · {site.fullName}</title>
	<meta name="description" content={data.gameTitle ? `Play ${data.gameTitle} in your browser, one of the E.Ngine Games on Edward Ng's site.` : "E.Ngine Games: Edward Ng's games, playable in your browser."} />
</svelte:head>

<Home data={data as never} />
