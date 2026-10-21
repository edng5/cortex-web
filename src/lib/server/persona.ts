// Loads Cortex's persona from content/cortex-persona.md (re-read when the file changes).
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface Persona {
	name: string;
	tagline: string;
	personality: string;
	refusal: string;
	blockedMessage: string;
	blockedTerms: string[];
	/** Markdown: facts Cortex may share about itself. */
	about: string;
}

const FILE = path.resolve(process.cwd(), 'content', 'cortex-persona.md');

const DEFAULTS: Persona = {
	name: 'Cortex',
	tagline: "Edward's AI assistant.",
	personality: 'Warm, concise and professional.',
	refusal: "I can only answer questions about Edward and about me, Cortex. Try asking about his work!",
	blockedMessage: "That's not something I'll respond to. Chat has been turned off for this session.",
	blockedTerms: [],
	about: "Cortex is Edward's personal AI assistant on his portfolio website."
};

let cache: { mtime: number; persona: Persona } | null = null;

export function loadPersona(): Persona {
	try {
		const mtime = fs.statSync(FILE).mtimeMs;
		if (cache && cache.mtime === mtime) return cache.persona;
		const { data, content } = matter(fs.readFileSync(FILE, 'utf8'));
		const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);
		const persona: Persona = {
			name: str(data.name, DEFAULTS.name),
			tagline: str(data.tagline, DEFAULTS.tagline),
			personality: str(data.personality, DEFAULTS.personality),
			refusal: str(data.refusal, DEFAULTS.refusal),
			blockedMessage: str(data.blockedMessage, DEFAULTS.blockedMessage),
			blockedTerms: Array.isArray(data.blockedTerms) ? data.blockedTerms.map(String).filter(Boolean) : [],
			about: content.trim() || DEFAULTS.about
		};
		cache = { mtime, persona };
		return persona;
	} catch {
		return DEFAULTS;
	}
}
