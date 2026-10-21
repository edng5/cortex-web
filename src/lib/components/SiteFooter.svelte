<!--
  Footer: brand (logo, role, location) + contact links with brand icons, then a
  bottom bar. Two columns on desktop; stacked and centred on mobile.
-->
<script lang="ts">
	import { site } from '$lib/config/site';
	import { brandFor } from '$lib/brand';

	const year = new Date().getFullYear();
	const links = [
		{ label: site.contact.email, url: `mailto:${site.contact.email}` },
		...site.contact.links
	].map((l) => ({ ...l, brand: brandFor(l.url) }));
</script>

<footer>
	<div class="inner">
		<div class="brand">
			<img class="logo" src={site.logo} alt="{site.fullName} logo" />
			<p class="role">{site.role}</p>
			<p class="loc">
				<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
					<path
						fill="currentColor"
						d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
					/>
				</svg>
				{site.contact.location}
			</p>
		</div>

		<nav class="contact" aria-label="Contact">
			<h2>Get in touch</h2>
			<ul>
				{#each links as l (l.url)}
					<li class:wide={l.url.startsWith('mailto:')}>
						<a href={l.url} target={l.url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
							{#if l.brand}
								<img src={l.brand.icon} alt="" width="18" height="18" />
							{:else}
								<!-- Resume / other: document icon -->
								<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
									<path
										fill="currentColor"
										d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 12h8v1.6H8V12Zm0 3.5h8v1.6H8v-1.6Z"
									/>
								</svg>
							{/if}
							<span>{l.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>

	<div class="bar">
		<span>© {year} {site.fullName}</span>
	</div>
</footer>

<style>
	footer {
		position: relative;
		background: linear-gradient(180deg, #04060b, #070b16);
		border-top: 1px solid rgba(148, 163, 184, 0.14);
		padding: 40px max(16px, 5vw) 20px;
	}
	/* Thin neon line along the top edge. */
	footer::before {
		content: '';
		position: absolute;
		left: 10%;
		right: 10%;
		top: -1px;
		height: 1px;
		background: linear-gradient(90deg, transparent, #38bdf8, #a78bfa, transparent);
		opacity: 0.6;
	}
	.inner {
		max-width: 1100px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 32px 48px;
		align-items: start;
	}
	.brand .logo {
		height: 34px;
		width: auto;
		display: block;
		filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.3));
	}
	.role {
		margin: 14px 0 4px;
		text-wrap: balance;
		color: var(--text);
		font-weight: 500;
	}
	.loc {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.contact h2 {
		margin: 0 0 12px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.contact ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 32px;
	}
	.contact li.wide {
		grid-column: 1 / -1;
	}
	.contact a {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
		color: var(--text);
		text-decoration: none;
		min-width: 0;
		max-width: 100%;
		transition: color 0.2s;
	}
	.contact a span {
		background: linear-gradient(90deg, #38bdf8, #a78bfa) left bottom / 0 1px no-repeat;
		padding-bottom: 2px;
		transition: background-size 0.25s ease;
	}
	.contact a:hover {
		color: #e0f2fe;
	}
	.contact a:hover span {
		background-size: 100% 1px;
	}
	.contact a img,
	.contact a svg {
		flex: none;
		width: 18px;
		height: 18px;
		color: #cbd5e1;
	}
	.contact a span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		max-width: 1100px;
		margin: 32px auto 0;
		padding-top: 16px;
		border-top: 1px solid rgba(148, 163, 184, 0.12);
		display: flex;
		justify-content: flex-start;
		gap: 12px;
		color: var(--muted);
		font-size: 0.82rem;
	}

	/* Mobile: one centred column. */
	@media (max-width: 720px) {
		footer {
			padding-top: 32px;
		}
		.inner {
			grid-template-columns: 1fr;
			gap: 28px;
			text-align: center;
		}
		.brand .logo {
			margin: 0 auto;
			height: 30px;
		}
		.loc {
			justify-content: center;
		}
		.contact ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.contact a {
			justify-content: center;
		}
		.bar {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 4px;
		}
	}
</style>
