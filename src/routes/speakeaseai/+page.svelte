<!-- /speakeaseai: SpeakEase AI on the web (the iOS and Android apps have reached end of support).
     In a phone frame on a computer; the whole screen on a phone. -->
<script lang="ts">
	import SpeakEase from '$lib/speakease/SpeakEase.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import { page } from '$app/state';
	import { site } from '$lib/config/site';
	import { session } from '$lib/session.svelte';

	let { data } = $props();
	$effect.pre(() => session.init({ user: data.user, quota: null, auth: data.auth }));
	// Opened from the site's header: Back returns to the home page; otherwise to the SpeakEase node.
	const fromHome = $derived(page.url.searchParams.get('from') === 'home');
	const back = $derived(fromHome ? '/' : '/?node=proj-speakease');
</script>

<svelte:head>
	<title>SpeakEase AI · {site.fullName}</title>
	<meta
		name="description"
		content="Practise speaking 16 languages with SpeakEase AI's friends: pronunciation feedback, corrections, translations and suggestions, now on the web."
	/>
	<meta name="theme-color" content="#222222" />
</svelte:head>

<main class="page">
	<div class="intro">
		<a class="home" href={back}>← {fromHome ? `Back to ${site.fullName}` : 'Back to SpeakEase AI'}</a>
		<div class="brand">
			<img src="/images/speakease/icon.png" alt="" width="44" height="44" />
			<div>
				<h1>SpeakEase AI</h1>
				<p>The iOS and Android apps have reached end of support. Here it is on the web: hold the mic and talk.</p>
			</div>
		</div>
	</div>
	<div class="phone">
		<div class="screen"><SpeakEase nickname={data.nickname} account={data.account} {back} /></div>
	</div>
</main>

{#if session.loginOpen}<LoginModal />{/if}

<style>
	.page {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 56px;
		padding: 24px 16px;
		background:
			radial-gradient(ellipse at 70% 20%, rgba(49, 108, 205, 0.22), transparent 60%),
			radial-gradient(ellipse at 20% 90%, rgba(148, 179, 229, 0.12), transparent 55%),
			#05070d;
	}
	.intro {
		max-width: 300px;
	}
	.home {
		color: #94a3b8;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.home:hover {
		color: #e2e8f0;
	}
	.brand {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		margin-top: 18px;
	}
	.brand img {
		flex: none;
		border-radius: 12px;
	}
	h1 {
		margin: 0 0 6px;
		font-size: 1.6rem;
		color: #e2e8f0;
	}
	.brand p {
		margin: 0;
		color: #94a3b8;
		line-height: 1.5;
	}
	.phone {
		flex: none;
		width: 400px;
		height: min(860px, calc(100svh - 48px));
		padding: 12px;
		border-radius: 48px;
		background: linear-gradient(145deg, #2b2f36, #0d0f13);
		box-shadow:
			0 0 0 2px #3a3f47,
			0 40px 80px -20px rgba(0, 0, 0, 0.8),
			0 0 80px -30px rgba(49, 108, 205, 0.6);
	}
	.screen {
		height: 100%;
		overflow: hidden;
		border-radius: 36px;
	}
	/* Phones: the app is the page. */
	@media (max-width: 760px) {
		.page {
			display: block;
			min-height: 0;
			padding: 0;
		}
		.intro {
			display: none;
		}
		.phone {
			width: 100%;
			height: 100svh;
			padding: 0;
			border-radius: 0;
			background: none;
			box-shadow: none;
		}
		.screen {
			border-radius: 0;
		}
	}
</style>
