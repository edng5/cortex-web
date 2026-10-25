// Loads the ontology from /content/**/*.md (YAML frontmatter + markdown body).
// NOTE: uses relative imports only so scripts/ingest.ts can import it via tsx.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { NODE_TYPES, type GraphData, type GraphEdge, type NodeType, type OntologyNode, type PortraitSpot } from '../types';

export const CONTENT_DIR = path.resolve(process.cwd(), 'content');
export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const EDGES_FILE = path.join(DATA_DIR, 'edges.json');

/** Folder name → node type. Folders starting with "_" (e.g. _templates) are skipped. */
const FOLDER_TYPES: Record<string, NodeType> = {
	about: 'about',
	experience: 'experience',
	education: 'education',
	projects: 'project',
	publications: 'publication',
	skills: 'skill',
	interests: 'interest',
	quotes: 'quote',
	surprise: 'surprise'
};

/**
 * A value that may live in the environment instead of the (public) repo: "env:NAME" reads
 * process.env.NAME, e.g. `playlist: env:SURPRISE_PLAYLIST_URL`. Missing → undefined.
 */
function fromEnv(v: unknown): string | undefined {
	if (v === undefined || v === null || v === '') return undefined;
	const s = String(v);
	const m = /^env:([A-Z0-9_]+)$/.exec(s.trim());
	return m ? process.env[m[1]]?.trim() || undefined : s;
}

/** `portrait:` frontmatter → { src: { x, y, w, fly } }, dropping malformed entries. */
function asPortrait(v: unknown): Record<string, PortraitSpot> | undefined {
	if (!v || typeof v !== 'object') return undefined;
	const out: Record<string, PortraitSpot> = {};
	for (const [src, s] of Object.entries(v as Record<string, any>)) {
		const [x, y, w] = [Number(s?.x), Number(s?.y), Number(s?.w)];
		if ([x, y, w].every(Number.isFinite)) out[src] = { x, y, w, fly: s?.fly === true };
	}
	return Object.keys(out).length ? out : undefined;
}

function asStringArray(v: unknown): string[] {
	if (!v) return [];
	if (Array.isArray(v)) return v.map(String).filter(Boolean);
	return [String(v)];
}

function asDate(v: unknown): string | undefined {
	if (!v) return undefined;
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	return String(v);
}

function parseNode(file: string, folderType: NodeType): OntologyNode {
	const raw = fs.readFileSync(file, 'utf8');
	const { data, content } = matter(raw);
	const id = String(data.id ?? path.basename(file, '.md'));
	const type = (NODE_TYPES as readonly string[]).includes(data.type) ? data.type : folderType;

	return {
		id,
		type,
		title: String(data.title ?? id),
		summary: String(data.summary ?? ''),
		subtitle: data.subtitle ? String(data.subtitle) : undefined,
		start: asDate(data.start),
		end: asDate(data.end),
		tags: asStringArray(data.tags),
		images: asStringArray(data.images),
		mobileImages: data.mobileImages ? asStringArray(data.mobileImages) : undefined,
		icon: data.icon ? String(data.icon) : undefined,
		cover: data.cover ? String(data.cover) : undefined,
		videos: asStringArray(data.videos),
		reels: asStringArray(data.reels),
		mediaLayout: ['float', 'carousel', 'gallery', 'portrait', 'arcade'].includes(data.mediaLayout) ? data.mediaLayout : undefined,
		portrait: asPortrait(data.portrait),
		carousels:
			data.carousels && typeof data.carousels === 'object'
				? Object.fromEntries(Object.entries(data.carousels).map(([k, v]) => [k, asStringArray(v)]))
				: {},
		captions:
			data.captions && typeof data.captions === 'object'
				? Object.fromEntries(Object.entries(data.captions).map(([k, v]) => [k, String(v)]))
				: {},
		links: Array.isArray(data.links)
			? data.links
					.map((l: any) => ({ ...l, url: fromEnv(l?.url) }))
					.filter((l: any) => l && l.url)
					.map((l: any) => ({ label: String(l.label ?? l.url), url: String(l.url), kind: l.kind }))
			: [],
		related: asStringArray(data.related),
		author: data.author ? String(data.author) : undefined,
		wip: data.wip === true || data.status === 'wip',
		ring: data.ring === true,
		membersOnly: data.membersOnly === true,
		playlist: fromEnv(data.playlist),
		weight: typeof data.weight === 'number' ? data.weight : 1,
		body: content.trim()
	};
}

export function loadNodes(): OntologyNode[] {
	const nodes: OntologyNode[] = [];
	if (!fs.existsSync(CONTENT_DIR)) return nodes;

	for (const folder of fs.readdirSync(CONTENT_DIR)) {
		if (folder.startsWith('_')) continue;
		const type = FOLDER_TYPES[folder];
		const dir = path.join(CONTENT_DIR, folder);
		if (!type || !fs.statSync(dir).isDirectory()) continue;

		for (const f of fs.readdirSync(dir)) {
			if (!f.endsWith('.md') || f.startsWith('_')) continue;
			try {
				nodes.push(parseNode(path.join(dir, f), type));
			} catch (err) {
				console.error(`[content] failed to parse ${folder}/${f}:`, err);
			}
		}
	}

	const seen = new Set<string>();
	for (const n of nodes) {
		if (seen.has(n.id)) console.warn(`[content] duplicate node id "${n.id}" — ids must be unique`);
		seen.add(n.id);
	}
	return nodes;
}

/** Edges declared by hand via `related:` in frontmatter. */
export function explicitEdges(nodes: OntologyNode[]): GraphEdge[] {
	const ids = new Set(nodes.map((n) => n.id));
	const edges: GraphEdge[] = [];
	for (const n of nodes) {
		for (const r of n.related) {
			if (!ids.has(r)) {
				console.warn(`[content] ${n.id} → related "${r}" does not exist`);
				continue;
			}
			edges.push({ source: n.id, target: r, weight: 1, kind: 'explicit' });
		}
	}
	return edges;
}

/** Fallback before the first ingest: connect nodes that share tags. */
function tagEdges(nodes: OntologyNode[]): GraphEdge[] {
	const edges: GraphEdge[] = [];
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			const a = new Set(nodes[i].tags.map((t) => t.toLowerCase()));
			const shared = nodes[j].tags.filter((t) => a.has(t.toLowerCase())).length;
			if (shared > 0) {
				edges.push({
					source: nodes[i].id,
					target: nodes[j].id,
					weight: Math.min(1, 0.4 + shared * 0.2),
					kind: 'similarity'
				});
			}
		}
	}
	return edges;
}

/** Merge edges, dropping duplicates (undirected) and dangling ids. */
export function mergeEdges(nodes: OntologyNode[], ...lists: GraphEdge[][]): GraphEdge[] {
	const ids = new Set(nodes.map((n) => n.id));
	const out = new Map<string, GraphEdge>();
	for (const list of lists) {
		for (const e of list) {
			if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
			const key = [e.source, e.target].sort().join('::');
			const prev = out.get(key);
			if (!prev || e.kind === 'explicit' || e.weight > prev.weight) out.set(key, e);
		}
	}
	return [...out.values()];
}

/** Nodes this visitor may see: members-only nodes are dropped for everyone else. */
export function visibleNodes(isMember: boolean): OntologyNode[] {
	return loadNodes().filter((n) => isMember || !n.membersOnly);
}

/** Full graph for the front end: content + similarity edges from the last ingest. */
export function loadGraph(isMember = false): GraphData {
	const nodes = visibleNodes(isMember);
	let similarity: GraphEdge[] = [];
	if (fs.existsSync(EDGES_FILE)) {
		try {
			similarity = JSON.parse(fs.readFileSync(EDGES_FILE, 'utf8'));
		} catch {
			console.warn('[content] data/edges.json is unreadable — run `npm run ingest`');
		}
	} else {
		similarity = tagEdges(nodes);
	}
	return { nodes, edges: mergeEdges(nodes, explicitEdges(nodes), similarity) };
}
