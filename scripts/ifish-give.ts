// npm run ifish:give -- --store "Store Name" --fish stockfish,wobbegong [--email player@example.com] [--apply]
// Puts fish into a FishMart player's backroom (say, ones an update took away). The player is
// found by their store's name (in their account save, or the showcase), or by --email. Fish are
// species ids or names, comma-separated. Without --apply it only reports what it would do. Run on
// the server (needs the same keys as the app); a backup of the save is written next to the
// database first. The player should close FishMart on every device before it's applied.
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/lib/server/db';
import { blindIndex } from '../src/lib/server/crypto';
import { SPECIES, SPECIES_BY_ID } from '../src/lib/games/fishstore/data';

try {
	process.loadEnvFile();
} catch {
	/* no .env: the keys are in the environment */
}

const args = process.argv.slice(2);
const opt = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const storeName = opt('store')?.trim();
const email = opt('email')?.trim().toLowerCase();
const fishArg = opt('fish')?.trim();
const apply = args.includes('--apply');
if ((!storeName && !email) || !fishArg) {
	console.error('Usage: npm run ifish:give -- --store "Store Name" --fish stockfish,wobbegong [--email player@example.com] [--apply]');
	process.exit(1);
}

// Each fish by id, or by name ("Wobbegong").
const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wanted = fishArg.split(',').map((v) => {
	const sp = SPECIES_BY_ID.get(key(v)) ?? SPECIES.find((s) => s.name.toLowerCase() === v.trim().toLowerCase());
	if (!sp) throw new Error(`No fish called "${v.trim()}".`);
	return sp;
});

const db = getDb();
const when = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
type SaveRow = { user_id: string; data: string; saved_at: number };

// ── Whose store ───────────────────────────────────────────────────────────────────────
let rows: SaveRow[];
if (email) {
	const user = db.prepare('SELECT id FROM users WHERE email_hash = ?').get(blindIndex('email', email)) as { id: string } | undefined;
	if (!user) throw new Error('No account with that email.');
	rows = db.prepare("SELECT user_id, data, saved_at FROM game_saves WHERE user_id = ? AND game = 'ifish'").all(user.id) as SaveRow[];
} else {
	const all = db.prepare("SELECT user_id, data, saved_at FROM game_saves WHERE game = 'ifish'").all() as SaveRow[];
	const nameOf = (r: SaveRow) => {
		try {
			return String(JSON.parse(r.data).name ?? '').trim().toLowerCase();
		} catch {
			return '';
		}
	};
	rows = all.filter((r) => nameOf(r) === storeName!.toLowerCase());
	// Not in any save under that name: try the showcase.
	if (!rows.length) {
		const shown = db.prepare('SELECT user_id FROM ifish_showcase WHERE lower(trim(store)) = lower(?)').all(storeName) as { user_id: string }[];
		rows = all.filter((r) => shown.some((x) => x.user_id === r.user_id));
	}
}
if (rows.length !== 1) throw new Error(`Expected exactly one FishMart save, found ${rows.length}. Add --email to pick the account.`);
const row = rows[0];
const s = JSON.parse(row.data);

const already = new Set([...(s.hold ?? []), ...(s.sale ?? []).flatMap((t: { fish: { s: string }[] }) => t.fish), ...(s.show ?? []).flatMap((t: { fish: { s: string }[] }) => t.fish)].map((f: { s: string }) => f.s));
console.log(`\nStore "${s.name}" (account ${row.user_id}) · backroom ${s.hold?.length ?? 0}/${s.holdCap} · saved ${when(row.saved_at)}`);
for (const sp of wanted) console.log(`  + ${sp.name} (${sp.id}, ${sp.rarity})${already.has(sp.id) ? '  (they already have one)' : ''}`);

if (!apply) {
	console.log('\nNothing changed. Add --apply to give these fish.\n');
	process.exit(0);
}

// ── Giving them ───────────────────────────────────────────────────────────────────────
const dir = path.dirname(process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve('data', 'app.db'));
const backup = path.join(dir, `ifish-give-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify({ user_id: row.user_id, data: row.data, saved_at: row.saved_at }));

s.seq = Number(s.seq) || 10;
s.hold = Array.isArray(s.hold) ? s.hold : [];
for (const sp of wanted) s.hold.push({ u: ++s.seq, s: sp.id, c: 0, g: Math.random() < 0.5 ? 'm' : 'f' });
s.found = [...new Set([...(Array.isArray(s.found) ? s.found : []), ...wanted.map((sp) => sp.id)])];
s.log = [`A gift from FishMart: ${wanted.map((sp) => sp.name).join(' and ')}, waiting in your backroom.`, ...(Array.isArray(s.log) ? s.log : [])].slice(0, 30);

// Newer than anything on the player's devices, so this copy wins the next sync.
// (No device: every device's next save is refused until it has taken this one.)
db.prepare("UPDATE game_saves SET data = ?, saved_at = ?, device = NULL WHERE user_id = ? AND game = 'ifish'").run(JSON.stringify(s), Date.now(), row.user_id);

console.log(`\nGave ${wanted.length} fish to "${s.name}"; they're in the backroom (${s.hold.length}/${s.holdCap}).`);
console.log(`Backup of the save before: ${backup}`);
console.log('The player should close FishMart on every device first, then open it again (signed in).\n');
