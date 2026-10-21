<!-- Roadmap of work experience, most recent at the top. Minimal rows; click to expand details. -->
<script lang="ts">
	import { marked } from 'marked';
	import { slide } from 'svelte/transition';
	import Modal from './Modal.svelte';
	import { session } from '$lib/session.svelte';
	import { typeStyle } from '$lib/config/site';
	import type { OntologyNode } from '$lib/types';

	let { nodes, onopen }: { nodes: OntologyNode[]; onopen: (id: string) => void } = $props();

	const jobs = $derived(
		nodes.filter((n) => n.type === 'experience').sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
	);
	let open = $state<string | null>(null);

	function fmt(d?: string) {
		if (!d) return '';
		const [y, m] = d.split('-');
		return m ? new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : y;
	}
	const range = (n: OntologyNode) => (n.start ? `${fmt(n.start)} – ${n.end ? fmt(n.end) : 'Present'}` : '');
	const company = (n: OntologyNode) => (n.subtitle ?? '').split(' · ')[0];
	const html = (md: string) => marked.parse(md, { async: false }) as string;
</script>

<Modal title="Experience" width="640px" onclose={() => (session.experienceOpen = false)}>
	<ol class="road" style="--accent: {typeStyle.experience.color}">
		{#each jobs as job (job.id)}
			{@const isOpen = open === job.id}
			<li class:current={!job.end} class:open={isOpen}>
				<span class="dot" aria-hidden="true"></span>
				<button class="row" onclick={() => (open = isOpen ? null : job.id)} aria-expanded={isOpen}>
					{#if job.icon}<img class="logo" src={job.icon} alt="" />{:else}<span class="logo blank"></span>{/if}
					<span class="text">
						<strong>{job.title}</strong>
						<span class="co">{company(job)}</span>
					</span>
					<span class="dates">{range(job)}</span>
					<span class="chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
				</button>
				{#if isOpen}
					<div class="details" transition:slide={{ duration: 220 }}>
						{#if job.summary}<p class="summary">{job.summary}</p>{/if}
						<div class="body">{@html html(job.body)}</div>
						<button class="graph" onclick={() => onopen(job.id)}>Show in graph →</button>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
</Modal>

<style>
	.road {
		list-style: none;
		margin: 0;
		padding: 0 0 0 22px;
		position: relative;
	}
	/* the roadmap line */
	.road::before {
		content: '';
		position: absolute;
		left: 6px;
		top: 10px;
		bottom: 10px;
		width: 2px;
		background: linear-gradient(var(--accent), #a78bfa);
		opacity: 0.45;
		border-radius: 2px;
	}
	li {
		position: relative;
		margin-bottom: 10px;
	}
	.dot {
		position: absolute;
		left: -21px;
		top: 22px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #0b1020;
		border: 2px solid var(--accent);
	}
	li.current .dot {
		background: var(--accent);
		box-shadow: 0 0 12px var(--accent);
	}
	.row {
		width: 100%;
		display: grid;
		grid-template-columns: 40px 1fr auto 18px;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.14);
		background: rgba(255, 255, 255, 0.025);
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
	}
	.row:hover,
	li.open .row {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.logo {
		width: 40px;
		height: 40px;
		border-radius: 9px;
		object-fit: cover;
		background: #fff;
	}
	.logo.blank {
		background: rgba(148, 163, 184, 0.15);
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.text strong {
		font-size: 0.98rem;
	}
	.co {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.dates {
		color: var(--muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.chev {
		color: var(--muted);
		font-size: 1.1rem;
		text-align: center;
	}
	.details {
		padding: 12px 14px 4px;
		color: #cbd5e1;
		line-height: 1.55;
		font-size: 0.92rem;
	}
	.summary {
		margin: 0 0 8px;
		color: #e2e8f0;
	}
	.body :global(h2) {
		font-size: 0.95rem;
		margin: 12px 0 4px;
		color: var(--text);
	}
	.body :global(ul) {
		padding-left: 18px;
		margin: 4px 0;
	}
	.graph {
		margin: 8px 0 6px;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
	@media (max-width: 560px) {
		.row {
			grid-template-columns: 34px 1fr 16px;
		}
		.logo {
			width: 34px;
			height: 34px;
		}
		.dates {
			grid-column: 2;
			grid-row: 2;
		}
	}
</style>
