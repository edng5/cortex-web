// Node "size" (importance): the same formula the graph uses for a neuron's radius, so lists
// ordered by it match what visitors see. weight × 3 + √(connections) × 1.5.
import type { GraphEdge, OntologyNode } from '$lib/types';

export function degrees(edges: GraphEdge[]): Map<string, number> {
	const d = new Map<string, number>();
	for (const e of edges) {
		d.set(e.source, (d.get(e.source) ?? 0) + 1);
		d.set(e.target, (d.get(e.target) ?? 0) + 1);
	}
	return d;
}

export function nodeSize(n: OntologyNode, degree: Map<string, number>): number {
	return n.weight * 3 + Math.sqrt(degree.get(n.id) ?? 0) * 1.5;
}

/** Nodes biggest first (ties by title). */
export function rankBySize(nodes: OntologyNode[], edges: GraphEdge[]): OntologyNode[] {
	const d = degrees(edges);
	return [...nodes].sort((a, b) => nodeSize(b, d) - nodeSize(a, d) || a.title.localeCompare(b.title));
}
