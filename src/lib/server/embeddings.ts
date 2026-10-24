// Local text embeddings via transformers.js (runs on the server, no API key needed).
// Swap this module for a hosted embedding API (e.g. Voyage AI) if you prefer —
// just keep the `embed()` signature and re-run `npm run ingest`.
import path from 'node:path';
import { createMutex } from './concurrency';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'; // 384-dim, fast on CPU
// 8-bit weights and small batches keep memory low enough for a 512 MB server
// (full precision with batches of 32 peaked at ~740 MB during `npm run ingest`).
const DTYPE = 'q8';
const BATCH = 4;

type Extractor = (
	texts: string[],
	opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
	if (!extractorPromise) {
		extractorPromise = (async () => {
			const { pipeline, env } = await import('@huggingface/transformers');
			env.cacheDir = path.resolve(process.cwd(), '.cache', 'transformers');
			return (await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: DTYPE })) as unknown as Extractor;
		})();
		extractorPromise.catch(() => (extractorPromise = null));
	}
	return extractorPromise;
}

// One shared model instance serves every visitor; run its calls one at a time.
const exclusive = createMutex();

/** Returns one L2-normalised vector per input text. */
export async function embed(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];
	return exclusive(() => embedNow(texts));
}

async function embedNow(texts: string[]): Promise<number[][]> {
	const extractor = await getExtractor();
	const out: number[][] = [];
	for (let i = 0; i < texts.length; i += BATCH) {
		const res = await extractor(texts.slice(i, i + BATCH), { pooling: 'mean', normalize: true });
		out.push(...res.tolist());
	}
	return out;
}

/** Cosine similarity (vectors are pre-normalised, so this is a dot product). */
export function cosine(a: number[], b: number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
