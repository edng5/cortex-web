// Audit log: who logged in, and what was asked of Cortex by whom. Emails, IPs and prompt
// text are encrypted at rest; rows are deleted after 90 days (see db.ts purgeExpired).
// Read it with `npm run audit`.
import { getDb } from './db';
import { encrypt } from './crypto';

export type AuditEvent = 'login' | 'login_code_sent' | 'login_link_sent' | 'logout' | 'chat_prompt' | 'chat_blocked' | 'quota_exceeded' | 'game_name_rejected';

export function audit(
	event: AuditEvent,
	opts: { userId?: string | null; email?: string | null; ip?: string | null; detail?: Record<string, unknown> }
): void {
	try {
		getDb()
			.prepare(
				'INSERT INTO audit_log (ts, event, user_id, email_enc, ip_enc, detail_enc) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(
				Date.now(),
				event,
				opts.userId ?? null,
				opts.email ? encrypt(opts.email) : null,
				opts.ip ? encrypt(opts.ip) : null,
				opts.detail ? encrypt(JSON.stringify(opts.detail)) : null
			);
	} catch (err) {
		// Never let auditing break the request, but make failures visible.
		console.error('[audit] failed to write', event, err);
	}
}
