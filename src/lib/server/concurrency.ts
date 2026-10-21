// Concurrency control for Cortex answers.
//
// Every question is answered on its own HTTP response stream, so answers always go back to the
// browser that asked. On top of that:
//   - Global limit: at most CORTEX_MAX_CONCURRENT answers are generated at once (default 8);
//     extra requests wait in a FIFO queue (up to CORTEX_QUEUE_TIMEOUT_MS, default 30s).
//   - One stream per visitor: if the same visitor asks again while an answer is still
//     streaming, their previous stream is cancelled (newest question wins). Visitors are
//     identified by account, or by an anonymous per-browser cookie, so people sharing a
//     network never cancel each other.

export class Semaphore {
	private active = 0;
	private waiters: { resolve: () => void; reject: (e: Error) => void }[] = [];

	constructor(private max: () => number) {}

	get inFlight() {
		return this.active;
	}
	get queued() {
		return this.waiters.length;
	}
	/** True when a new request would have to wait. */
	get full() {
		return this.active >= this.max();
	}

	/** Resolves when a slot is free. Rejects on timeout or if `signal` aborts while waiting. */
	acquire(signal: AbortSignal, timeoutMs: number): Promise<() => void> {
		const release = () => {
			this.active--;
			this.waiters.shift()?.resolve();
		};
		if (this.active < this.max()) {
			this.active++;
			return Promise.resolve(once(release));
		}
		return new Promise((resolve, reject) => {
			const waiter = {
				resolve: () => {
					clearTimeout(timer);
					signal.removeEventListener('abort', onAbort);
					this.active++;
					resolve(once(release));
				},
				reject
			};
			const drop = () => {
				const i = this.waiters.indexOf(waiter);
				if (i >= 0) this.waiters.splice(i, 1);
			};
			const timer = setTimeout(() => {
				drop();
				reject(new BusyError());
			}, timeoutMs);
			const onAbort = () => {
				clearTimeout(timer);
				drop();
				reject(new Error('aborted'));
			};
			signal.addEventListener('abort', onAbort, { once: true });
			this.waiters.push(waiter);
		});
	}
}

export class BusyError extends Error {
	constructor() {
		super('Cortex is busy');
	}
}

function once(fn: () => void): () => void {
	let done = false;
	return () => {
		if (!done) {
			done = true;
			fn();
		}
	};
}

const num = (v: string | undefined, d: number) => (v && Number(v) > 0 ? Number(v) : d);
export const answerSlots = new Semaphore(() => num(process.env.CORTEX_MAX_CONCURRENT, 8));
export const queueTimeoutMs = () => num(process.env.CORTEX_QUEUE_TIMEOUT_MS, 30_000);

/** The visitor's in-flight answer, so a newer question from the same visitor replaces it. */
const activeByVisitor = new Map<string, AbortController>();

/** Register a new answer stream for `visitor`, cancelling any older one. Returns a cleanup fn. */
export function claimVisitorStream(visitor: string, ctrl: AbortController): () => void {
	activeByVisitor.get(visitor)?.abort();
	activeByVisitor.set(visitor, ctrl);
	return () => {
		if (activeByVisitor.get(visitor) === ctrl) activeByVisitor.delete(visitor);
	};
}

/** Serialise async work on a shared resource (e.g. the local embedding model). */
export function createMutex() {
	let tail: Promise<unknown> = Promise.resolve();
	return <T>(fn: () => Promise<T>): Promise<T> => {
		const run = tail.then(fn, fn);
		tail = run.catch(() => {});
		return run;
	};
}
