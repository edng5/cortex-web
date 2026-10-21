// ─────────────────────────────────────────────────────────────
//  Site-wide settings. Edit these to make the site yours.
// ─────────────────────────────────────────────────────────────
import type { NodeType } from '$lib/types';

export const site = {
	/** First name — how Cortex refers to you ("Edward built…"). */
	ownerName: 'Edward',
	fullName: 'Edward Ng',
	/** Short role line shown in the footer. */
	role: 'Tech Lead · Machine Learning Engineer @ BMO',
	assistantName: 'Cortex',
	title: 'Edward Ng — Cortex',
	description:
		"Edward Ng's interactive portfolio: Tech Lead and Machine Learning Engineer at BMO working on ML, GenAI and full-stack apps. Ask Cortex anything.",

	/** Titles that rotate under the logo at the top of the page. */
	titles: ['Edward Ng', 'Machine Learning Engineer', 'Tech Lead', 'Researcher', 'DevOps'],

	/** Wordmark from edng5.com. Replace static/logo.png to change it. */
	logo: '/logo.png',

	contact: {
		email: 'edwardk.ng@gmail.com',
		location: 'Toronto, ON',
		links: [
			{ label: 'GitHub', url: 'https://github.com/edng5' },
			{ label: 'LinkedIn', url: 'https://linkedin.com/in/edng5' },
			{ label: 'YouTube', url: 'https://www.youtube.com/@edng5' },
			{ label: 'Resume', url: '/resume.pdf' }
		]
	},

	/** Greeting Cortex speaks / shows before the first question. */
	greeting: "Hi, I'm Cortex — Edward's AI. Tap a neuron, or turn on the mic and ask me anything.",

	/** Preferred TTS voice names, tried in order (falls back to the browser default). */
	preferredVoices: ['Google UK English Male', 'Microsoft Guy Online (Natural)', 'Daniel', 'Alex'],
	speechRate: 1.03,
	speechPitch: 0.95
};

/** Neuron colour per node type (also used in the legend). */
export const typeStyle: Record<NodeType, { color: string; label: string }> = {
	about: { color: '#f8fafc', label: 'About Me' },
	experience: { color: '#38bdf8', label: 'Experience' },
	education: { color: '#fb923c', label: 'Education' },
	project: { color: '#a78bfa', label: 'Projects' },
	publication: { color: '#f472b6', label: 'Publications' },
	skill: { color: '#34d399', label: 'Skills' },
	interest: { color: '#fbbf24', label: 'Interests' },
	quote: { color: '#f87171', label: 'Quotes' },
	surprise: { color: '#f0abfc', label: 'Surprise!' }
};
