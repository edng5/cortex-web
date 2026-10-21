// npm run audit -- [--days 7] [--event chat_prompt] [--limit 200]
// Prints the decrypted audit log (logins and Cortex prompts). Entries older than 90 days
// are deleted automatically. Run on the server; needs the same .env keys as the app.
import { getDb, purgeExpired } from '../src/lib/server/db';
import { decrypt } from '../src/lib/server/crypto';

const args = process.argv.slice(2);
const opt = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const days = Number(opt('days') ?? 7);
const event = opt('event');
const limit = Number(opt('limit') ?? 200);

const db = getDb();
purgeExpired();
const rows = db
	.prepare(
		`SELECT ts, event, user_id, email_enc, ip_enc, detail_enc FROM audit_log
		 WHERE ts >= ? ${event ? 'AND event = ?' : ''} ORDER BY ts DESC LIMIT ?`
	)
	.all(...([Date.now() - days * 86_400_000, ...(event ? [event] : []), limit] as unknown[])) as {
	ts: number;
	event: string;
	user_id: string | null;
	email_enc: string | null;
	ip_enc: string | null;
	detail_enc: string | null;
}[];

const dec = (v: string | null) => {
	if (!v) return '';
	try {
		return decrypt(v);
	} catch {
		return '(undecryptable)';
	}
};

console.log(`Audit log — last ${days} day(s)${event ? `, event=${event}` : ''} — ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}\n`);
for (const r of rows.reverse()) {
	const who = dec(r.email_enc) || (r.user_id ? `user ${r.user_id.slice(0, 8)}` : 'anonymous');
	const detail = r.detail_enc ? dec(r.detail_enc) : '';
	console.log(`${new Date(r.ts).toISOString()}  ${r.event.padEnd(16)} ${who.padEnd(28)} ip=${dec(r.ip_enc)}  ${detail}`);
}
