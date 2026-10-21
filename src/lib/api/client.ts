// Client for POST /api/ask — parses the server-sent event stream.
import type { AskEvent, ChatTurn } from '$lib/types';

export async function askCortex(
	question: string,
	history: ChatTurn[],
	onEvent: (e: AskEvent) => void,
	signal?: AbortSignal
): Promise<void> {
	const res = await fetch('/api/ask', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ question, history }),
		signal
	});

	if (!res.ok || !res.body) {
		let message = `Request failed (${res.status})`;
		let data: {
			message?: string;
			blocked?: boolean;
			until?: number;
			quotaExceeded?: boolean;
			quota?: import('$lib/types').QuotaInfo;
		} = {};
		try {
			data = await res.json();
			message = data.message ?? message;
		} catch {
			/* not json */
		}
		if (data.quotaExceeded && data.quota) onEvent({ type: 'quota_exceeded', quota: data.quota, message });
		else if (data.blocked) onEvent({ type: 'blocked', message, until: data.until ?? Date.now() });
		else onEvent({ type: 'error', message });
		return;
	}

	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += value;
		let idx: number;
		while ((idx = buf.indexOf('\n\n')) !== -1) {
			const frame = buf.slice(0, idx);
			buf = buf.slice(idx + 2);
			const data = frame
				.split('\n')
				.filter((l) => l.startsWith('data:'))
				.map((l) => l.slice(5).trimStart())
				.join('\n');
			if (data) onEvent(JSON.parse(data) as AskEvent);
		}
	}
}

/** Has this visitor's chat been disabled (server-side)? */
export async function chatStatus(): Promise<{ blocked: boolean; until?: number; message?: string }> {
	try {
		const res = await fetch('/api/ask');
		return res.ok ? await res.json() : { blocked: false };
	} catch {
		return { blocked: false };
	}
}
