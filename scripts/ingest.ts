// npm run ingest
// Reads content/**/*.md → chunks → embeddings → data/vectors.json (the vector DB)
// and computes similarity edges between nodes → data/edges.json (the graph).
// Re-run whenever you add or edit content.
import fs from 'node:fs';
import { loadNodes, EDGES_FILE, DATA_DIR } from '../src/lib/server/content';
import { chunkNode } from '../src/lib/server/rag';
import { embed, cosine, EMBEDDING_MODEL } from '../src/lib/server/embeddings';
import { JsonVectorStore, VECTORS_FILE, type StoredChunk } from '../src/lib/server/vectorstore';
import type { GraphEdge } from '../src/lib/types';

/** Each node links to its K most similar neighbours if similarity ≥ MIN_SIM. */
const K_NEIGHBOURS = 3;
const MIN_SIM = 0.35;

function normalize(v: number[]): number[] {
	const n = Math.hypot(...v) || 1;
	return v.map((x) => x / n);
}

async function main() {
	const t0 = Date.now();
	const nodes = loadNodes();
	if (nodes.length === 0) {
		console.log('No content found in content/. Add some .md files (see content/_templates).');
		return;
	}
	console.log(`Loaded ${nodes.length} nodes. Embedding with ${EMBEDDING_MODEL} (first run downloads the model)…`);

	const chunks = nodes.flatMap(chunkNode);
	const vectors = await embed(chunks.map((c) => c.text));
	const stored: StoredChunk[] = chunks.map((c, i) => ({ ...c, vector: vectors[i] }));

	const store = new JsonVectorStore(VECTORS_FILE, EMBEDDING_MODEL);
	await store.clear();
	await store.upsert(stored);
	console.log(`Wrote ${stored.length} chunks → ${VECTORS_FILE}`);

	// Node vector = mean of its chunk vectors.
	const nodeVec = new Map<string, number[]>();
	for (const n of nodes) {
		const vs = stored.filter((c) => c.nodeId === n.id).map((c) => c.vector);
		const mean = vs[0].map((_, d) => vs.reduce((s, v) => s + v[d], 0) / vs.length);
		nodeVec.set(n.id, normalize(mean));
	}

	const edges = new Map<string, GraphEdge>();
	// Work-in-progress nodes are placeholders: only their explicit `related:` links apply.
	const linkable = nodes.filter((n) => !n.wip);
	for (const a of linkable) {
		const ranked = linkable
			.filter((b) => b.id !== a.id)
			.map((b) => ({ id: b.id, sim: cosine(nodeVec.get(a.id)!, nodeVec.get(b.id)!) }))
			.sort((x, y) => y.sim - x.sim)
			.slice(0, K_NEIGHBOURS)
			.filter((x) => x.sim >= MIN_SIM);
		for (const { id, sim } of ranked) {
			const key = [a.id, id].sort().join('::');
			if (!edges.has(key)) {
				edges.set(key, { source: a.id, target: id, weight: Number(sim.toFixed(3)), kind: 'similarity' });
			}
		}
	}

	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.writeFileSync(EDGES_FILE, JSON.stringify([...edges.values()], null, 1));
	console.log(`Wrote ${edges.size} similarity edges → ${EDGES_FILE}`);
	console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
