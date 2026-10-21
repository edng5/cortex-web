// Provider-neutral LLM failure, so /api/ask can pick the right message for visitors.
export class LlmError extends Error {
	constructor(
		readonly kind: 'rate_limit' | 'auth' | 'blocked' | 'other',
		message: string
	) {
		super(message);
		this.name = 'LlmError';
	}
}
