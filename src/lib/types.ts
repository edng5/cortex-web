// Shared types for the ontology graph (used by both client and server).

export const NODE_TYPES = [
	'about',
	'experience',
	'education',
	'project',
	'publication',
	'skill',
	'interest',
	'quote',
	'surprise'
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export interface NodeLink {
	label: string;
	url: string;
	/** Optional icon hint: github | paper | website | demo | video | linkedin | other */
	kind?: string;
}

export interface OntologyNode {
	/** Stable id — the markdown filename without extension, e.g. "proj-cortex". */
	id: string;
	type: NodeType;
	title: string;
	/** One-to-two sentence summary shown at the top of the pop-up. */
	summary: string;
	/** Free-form subtitle, e.g. "ML Engineer @ Acme" or "NeurIPS 2025". */
	subtitle?: string;
	/** ISO dates (YYYY-MM or YYYY-MM-DD). `end` omitted = present. */
	start?: string;
	end?: string;
	tags: string[];
	/** Paths under /static (e.g. "/images/cortex-1.png") or full URLs. */
	images: string[];
	/**
	 * Optional pictures for small screens, where media sits inside the panel (e.g. one collage
	 * instead of many draggable pictures). Desktop always uses `images`.
	 */
	mobileImages?: string[];
	/** Logo / icon / avatar shown next to the title in the info panel (not with the pictures). */
	icon?: string;
	/** YouTube / Vimeo links, or video files under /static (.mp4, .webm). */
	videos: string[];
	/**
	 * Picture style: 'float' (draggable pile, the default), 'carousel' (beside the panel),
	 * 'gallery' (clicking the node opens a large centred gallery instead of the panel), or
	 * 'portrait' (frameless cut-outs placed by `portrait`, e.g. a team photo of PNGs).
	 */
	mediaLayout?: 'float' | 'carousel' | 'gallery' | 'portrait';
	/** For `mediaLayout: portrait`: where each image (by src) sits. See PortraitSpot. */
	portrait?: Record<string, PortraitSpot>;
	/** Named in-text carousels: put `<!-- carousel: name -->` in the body to place one. */
	carousels: Record<string, string[]>;
	/** Optional captions, keyed by image/video src. */
	captions: Record<string, string>;
	links: NodeLink[];
	/** Explicit connections to other node ids (in addition to similarity edges). */
	related: string[];
	/** For quotes: who said it. */
	author?: string;
	/** Only visible to logged-in members (MEMBER_EMAILS). Hidden from everyone else, including Cortex. */
	membersOnly: boolean;
	/** YouTube playlist URL: clicking the node opens a large playlist player instead of the panel. */
	playlist?: string;
	/** `wip: true` in frontmatter: shown as "Work in progress" (dashed neuron, banner in the panel). */
	wip: boolean;
	/** Bigger number = bigger neuron. Defaults to 1. */
	weight: number;
	/** Markdown body — long-form detail, also chunked into the vector DB. */
	body: string;
}

export interface GraphEdge {
	source: string;
	target: string;
	/** 0..1 — similarity score (or 1 for explicit `related` links). */
	weight: number;
	kind: 'similarity' | 'explicit';
}

export interface GraphData {
	nodes: OntologyNode[];
	edges: GraphEdge[];
}

/** Server-sent events streamed by /api/ask. */
export type AskEvent =
	| { type: 'sources'; nodeIds: string[] }
	| { type: 'focus'; nodeId: string | null }
	| { type: 'delta'; text: string }
	| { type: 'done' }
	/** Waiting for a free slot (the server is answering other visitors). */
	| { type: 'queued'; position: number }
	/** Remaining questions after this one was counted. */
	| { type: 'quota'; quota: QuotaInfo }
	/** No questions left: prompt the visitor to log in (or come back tomorrow). */
	| { type: 'quota_exceeded'; quota: QuotaInfo; message: string }
	/** The visitor asked something explicit/inappropriate: chat is disabled until `until` (ms epoch). */
	| { type: 'blocked'; message: string; until: number }
	| { type: 'error'; message: string };

export interface ChatTurn {
	role: 'user' | 'assistant';
	content: string;
}

/** Question allowance shown to the visitor (mirrors server QuotaStatus). */
/**
 * A cut-out's spot in a square `portrait` scene, in % of its side: `x` = centre, `y` = where
 * its bottom edge sits (ground ≈ 97), `w` = width. `fly`: it hovers and bobs; otherwise it
 * stands still on the ground. Earlier images in `images` are further back.
 */
export interface PortraitSpot {
	x: number;
	y: number;
	w: number;
	fly?: boolean;
}

export interface QuotaInfo {
	used: number;
	limit: number;
	period: 'lifetime' | 'day';
	remaining: number;
	loggedIn: boolean;
	/** No cap (whitelisted members). */
	unlimited: boolean;
}
