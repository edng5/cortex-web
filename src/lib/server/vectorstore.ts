// Vector database abstraction.
//
// The default `JsonVectorStore` keeps every chunk in data/vectors.json and does a
// brute-force cosine search in memory. For a personal site (hundreds to a few
// thousand chunks) this is instant and needs zero infrastructure.
//
// To move to a hosted vector DB (pgvector, Pinecone, Qdrant, Chroma, LanceDB…),
// implement `VectorStore` and return it from `getVectorStore()`.
import fs from 'node:fs';
import path from 'node:path';
import { cosine } from './embeddings';
import { DATA_DIR } from './content';

export interface Chunk {
	id: string; // `${nodeId}#${n}`
	nodeId: string;
	text: string;
}

export interface StoredChunk extends Chunk {
	vector: number[];
}

export interface SearchHit extends Chunk {
	score: number;
}

export interface VectorStore {
	upsert(chunks: StoredChunk[]): Promise<void>;
	search(vector: number[], k: number): Promise<SearchHit[]>;
	clear(): Promise<void>;
}

export const VECTORS_FILE = path.join(DATA_DIR, 'vectors.json');

interface VectorFile {
	model: string;
	createdAt: string;
	chunks: StoredChunk[];
}

export class JsonVectorStore implements VectorStore {
	private chunks: StoredChunk[] | null = null;
	private mtime = 0;

	constructor(
		private file = VECTORS_FILE,
		private model = 'unknown'
	) {}

	private load(): StoredChunk[] {
		if (!fs.existsSync(this.file)) return [];
		const m = fs.statSync(this.file).mtimeMs;
		// Hot-reload when `npm run ingest` rewrites the file.
		if (!this.chunks || m !== this.mtime) {
			const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as VectorFile;
			this.chunks = parsed.chunks;
			this.mtime = m;
		}
		return this.chunks;
	}

	async upsert(chunks: StoredChunk[]): Promise<void> {
		const byId = new Map(this.load().map((c) => [c.id, c]));
		for (const c of chunks) byId.set(c.id, c);
		this.chunks = [...byId.values()];
		fs.mkdirSync(path.dirname(this.file), { recursive: true });
		const out: VectorFile = { model: this.model, createdAt: new Date().toISOString(), chunks: this.chunks };
		fs.writeFileSync(this.file, JSON.stringify(out));
		this.mtime = fs.statSync(this.file).mtimeMs;
	}

	async search(vector: number[], k: number): Promise<SearchHit[]> {
		return this.load()
			.map(({ vector: v, ...rest }) => ({ ...rest, score: cosine(vector, v) }))
			.sort((a, b) => b.score - a.score)
			.slice(0, k);
	}

	async clear(): Promise<void> {
		this.chunks = [];
		if (fs.existsSync(this.file)) fs.rmSync(this.file);
	}

	isEmpty(): boolean {
		return this.load().length === 0;
	}
}

let store: JsonVectorStore | null = null;
export function getVectorStore(): JsonVectorStore {
	return (store ??= new JsonVectorStore());
}
