// Parses the hidden header Cortex writes before every answer:
//
//   <scope>edward|cortex|off_topic|inappropriate</scope><focus>node-id|none</focus> answer…
//
// Text is held back until the scope is known, so nothing from an off-topic or
// inappropriate reply ever reaches the visitor. Pure module (no SvelteKit imports)
// so it can be unit-tested with tsx.

export type Scope = 'edward' | 'cortex' | 'off_topic' | 'inappropriate';
const SCOPES: Scope[] = ['edward', 'cortex', 'off_topic', 'inappropriate'];

const SCOPE_RE = /^\s*<scope>\s*([a-z_]+)\s*<\/scope>\s*/i;
const FOCUS_RE = /^\s*<focus>\s*([^<]*?)\s*<\/focus>\s*/i;
/** If the header hasn't resolved after this many characters, stop waiting. */
const MAX_HEADER = 240;

export interface HeaderResult {
	scope: Scope;
	focus: string | null;
}

export class AnswerHeaderParser {
	private buf = '';
	private scope: Scope | null = null;
	private focus: string | null | undefined = undefined; // undefined = not yet parsed
	private done = false;

	/**
	 * Feed a text delta. Returns `{ header, text }` once the header is resolved
	 * (header only on the first resolved call), otherwise null while still buffering.
	 */
	push(delta: string): { header?: HeaderResult; text: string } | null {
		if (this.done) return { text: this.allowsText() ? delta : '' };
		this.buf += delta;
		return this.tryResolve(false);
	}

	/** End of stream: resolve with whatever we have. */
	flush(): { header?: HeaderResult; text: string } | null {
		if (this.done) return null;
		return this.tryResolve(true);
	}

	private tryResolve(force: boolean): { header?: HeaderResult; text: string } | null {
		if (this.scope === null) {
			const m = this.buf.match(SCOPE_RE);
			if (m) {
				const s = m[1].toLowerCase() as Scope;
				this.scope = SCOPES.includes(s) ? s : 'off_topic'; // unknown label → refuse
				this.buf = this.buf.slice(m[0].length);
			} else if (force || this.buf.trimStart().length > MAX_HEADER || !couldBeTag(this.buf, '<scope>')) {
				// Model skipped the scope tag. Fail closed: treat as off-topic.
				this.scope = 'off_topic';
			} else {
				return null;
			}
		}
		// Off-topic / inappropriate: we never need the rest.
		if (this.scope === 'off_topic' || this.scope === 'inappropriate') {
			return this.finish(null, '');
		}
		if (this.focus === undefined) {
			const m = this.buf.match(FOCUS_RE);
			if (m) {
				const id = m[1].trim();
				this.buf = this.buf.slice(m[0].length);
				return this.finish(id && id.toLowerCase() !== 'none' ? id : null, this.buf);
			}
			if (force || this.buf.trimStart().length > MAX_HEADER || !couldBeTag(this.buf, '<focus>')) {
				return this.finish(null, this.buf); // no focus tag — keep the text
			}
			return null;
		}
		return null;
	}

	/** Only on-topic answers (about Edward or Cortex) may produce visible text. */
	private allowsText(): boolean {
		return this.scope === 'edward' || this.scope === 'cortex';
	}

	private finish(focus: string | null, text: string) {
		this.focus = focus;
		this.done = true;
		this.buf = '';
		return { header: { scope: this.scope!, focus }, text: text.replace(/^\s+/, '') };
	}
}

/** Could `buf` (ignoring leading whitespace) still turn into `tag`? */
function couldBeTag(buf: string, tag: string): boolean {
	const head = buf.trimStart().toLowerCase();
	return head.length < tag.length ? tag.startsWith(head) : head.startsWith(tag);
}
