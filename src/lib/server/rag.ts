// Retrieval: chunking (used at ingest) + query-time search.
import type { OntologyNode } from '../types';
import type { Chunk, SearchHit } from './vectorstore';
import { embed } from './embeddings';
import { getVectorStore } from './vectorstore';

const MAX_CHUNK_CHARS = 900;

function nodeHeader(n: OntologyNode): string {
	const when = n.start ? ` (${n.start} – ${n.end ?? 'present'})` : '';
	const sub = n.subtitle ? ` — ${n.subtitle}` : '';
	const by = n.author ? ` — ${n.author}` : '';
	return `[${n.type}] ${n.title}${sub}${by}${when}`;
}

/**
 * Splits a node into retrieval chunks. The first chunk is a "card" (title,
 * summary, tags, links) so short questions match the node itself; the body is
 * split on paragraphs, and each piece is prefixed with the node header so
 * every chunk stands on its own.
 */
export function chunkNode(n: OntologyNode): Chunk[] {
	const header = nodeHeader(n);
	const card = [
		header,
		n.summary,
		n.tags.length ? `Tags: ${n.tags.join(', ')}` : '',
		n.links.length ? `Links: ${n.links.map((l) => `${l.label} (${l.url})`).join('; ')}` : ''
	]
		.filter(Boolean)
		.join('\n');

	const chunks: Chunk[] = [{ id: `${n.id}#0`, nodeId: n.id, text: card }];

	let buf = '';
	const flush = () => {
		if (buf.trim()) {
			chunks.push({ id: `${n.id}#${chunks.length}`, nodeId: n.id, text: `${header}\n${buf.trim()}` });
		}
		buf = '';
	};
	// HTML comments (e.g. carousel markers) are layout hints, not content.
	// Inline images (e.g. section icons) are decoration, not content.
	const text = n.body.replace(/<!--[\s\S]*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)\s*/g, '');
	for (const para of text.split(/\n\s*\n/)) {
		if (buf.length + para.length > MAX_CHUNK_CHARS) flush();
		buf += (buf ? '\n\n' : '') + para;
	}
	flush();
	return chunks;
}

// The embedding model has never seen coined names like "DocVision" or "KeyAttack", so a
// question naming a node may not retrieve it. Chunks of a node named in the question are
// lifted above everything else.
const NAME_BOOST = 0.5;

/**
 * Names a question might use for a chunk's node, from its header line: the title, and for
 * experience/education the organisation (first part of the subtitle), each with any
 * bracketed alias, e.g. "NEOS" or "Bank of Montreal".
 */
function namesIn(chunkText: string): string[] {
	const m = /^\[(\w+)\] (.+?)(?: — (.+?))?(?: \(\d{4}.*\))?$/m.exec(chunkText);
	if (!m) return [];
	const [, type, title, subtitle] = m;
	const sources = [title];
	if ((type === 'experience' || type === 'education') && subtitle) sources.push(subtitle.split(' · ')[0]);
	const names: string[] = [];
	for (const s of sources) {
		names.push(s.replace(/\s*\([^)]*\)/g, '').trim());
		const alias = /\(([^)]+)\)/.exec(s)?.[1];
		if (alias) names.push(alias.trim());
	}
	// Short names only when they're acronyms ("BMO"), so words like "Art" don't over-match.
	return names.filter((n) => n.length >= 4 || /^[A-Z]{3}$/.test(n));
}

function mentions(query: string, name: string): boolean {
	const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu').test(query);
}

export interface RetrievalResult {
	hits: SearchHit[];
	/** Distinct node ids in rank order. */
	nodeIds: string[];
}

/** `allowed`: node ids this visitor may see (members-only content is excluded for others). */
export async function retrieve(query: string, k = 8, allowed?: Set<string>): Promise<RetrievalResult> {
	const store = getVectorStore();
	if (store.isEmpty()) return { hits: [], nodeIds: [] };

	const [qv] = await embed([query]);
	// Score every chunk (the store is small), boost nodes named in the question, then drop
	// chunks from nodes this visitor can't see.
	const named = (h: SearchHit) => namesIn(h.text).some((name) => mentions(query, name));
	const hits = (await store.search(qv, Infinity))
		.map((h) => (named(h) ? { ...h, score: h.score + NAME_BOOST } : h))
		.sort((a, b) => b.score - a.score)
		.filter((h) => h.score > 0.15 && (!allowed || allowed.has(h.nodeId)))
		.slice(0, k);
	const nodeIds = [...new Set(hits.map((h) => h.nodeId))];
	return { hits, nodeIds };
}
