// npm run ifish:restore -- --store "Store Name" --email player@example.com [--cash 0] [--gems 0] [--apply]
// Finds a FishMart store by its showcase name and puts it back on a player's account: their
// account's save becomes that store, and the showcase entry (and any market listings) move to
// them if the store was shown from another account. Without --apply it only reports what it
// finds. Run on the server (needs the same keys as the app); a backup of everything it changes
// is written next to the database first.
//
// The store comes from the account's own save if that save is still this store (everything
// comes back). Otherwise it's rebuilt from the showcase copy: the floor, every tank with its fish
// and decorations, the partner fish, staff and furniture come back; cash, gems, the holding tank,
// research and the wiki start over. --cash and --gems add a bonus on top (say, as an apology).
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/lib/server/db';
import { blindIndex, decrypt } from '../src/lib/server/crypto';
import { START_CASH, START_GEMS, STAFF_NAMES, TANK_DECOR, type StoreSnapshot } from '../src/lib/games/fishstore/data';

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
const apply = args.includes('--apply');
const bonusCash = Math.max(0, Math.round(Number(opt('cash') ?? 0)) || 0);
const bonusGems = Math.max(0, Math.round(Number(opt('gems') ?? 0)) || 0);
if (!storeName || !email) {
	console.error('Usage: npm run ifish:restore -- --store "Store Name" --email player@example.com [--apply]');
	process.exit(1);
}

const db = getDb();
const when = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-');
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length)) + c);
const emailOf = (userId: string) => {
	const row = db.prepare('SELECT email_enc FROM users WHERE id = ?').get(userId) as { email_enc: string } | undefined;
	try {
		return row ? decrypt(row.email_enc) : '(no such account)';
	} catch {
		return '(undecryptable)';
	}
};

type ShowRow = { user_id: string; store: string; layout: string | null; updated_at: number };
type SaveRow = { data: string; saved_at: number };
const saveOf = (userId: string) => db.prepare("SELECT data, saved_at FROM game_saves WHERE user_id = ? AND game = 'ifish'").get(userId) as SaveRow | undefined;
const showOf = (userId: string) => db.prepare('SELECT user_id, store, layout, updated_at FROM ifish_showcase WHERE user_id = ?').get(userId) as ShowRow | undefined;

function describeSave(row: SaveRow | undefined) {
	if (!row) return 'none';
	try {
		const s = JSON.parse(row.data);
		const fish = [...(s.hold ?? []), ...(s.sale ?? []).flatMap((t: { fish: unknown[] }) => t.fish), ...(s.show ?? []).flatMap((t: { fish: unknown[] }) => t.fish)].length;
		return `"${s.name}" · ${fish} fish · $${Math.round(s.cash)} · ${s.gems} gems · ${s.found?.length ?? 0} in wiki · ${row.data.length} bytes · saved ${when(row.saved_at)}`;
	} catch {
		return `unreadable (${row.data.length} bytes, saved ${when(row.saved_at)})`;
	}
}

// ── What's there ──────────────────────────────────────────────────────────────────────
const target = db.prepare('SELECT id, provider, created_at, last_login FROM users WHERE email_hash = ?').get(blindIndex('email', email)) as
	| { id: string; provider: string; created_at: number; last_login: number }
	| undefined;
const shown = db.prepare('SELECT user_id, store, layout, updated_at FROM ifish_showcase WHERE lower(trim(store)) = lower(?)').all(storeName) as ShowRow[];

console.log(`\nAccount ${mask(email)}:`);
if (!target) console.log('  no account with this email');
else {
	console.log(`  id ${target.id} · signs in with ${target.provider} · joined ${when(target.created_at)} · last login ${when(target.last_login)}`);
	console.log(`  FishMart save: ${describeSave(saveOf(target.id))}`);
	const own = showOf(target.id);
	console.log(`  showcase: ${own ? `"${own.store}" (updated ${when(own.updated_at)})` : 'none'}`);
	const logins = db.prepare("SELECT ts FROM audit_log WHERE event = 'login' AND user_id = ? ORDER BY ts DESC LIMIT 5").all(target.id) as { ts: number }[];
	console.log(`  recent logins: ${logins.map((l) => when(l.ts)).join(', ') || 'none in the last 90 days'}`);
}
console.log(`\nShowcase stores named "${storeName}": ${shown.length}`);
for (const r of shown) {
	console.log(`  shown by ${mask(emailOf(r.user_id))} (id ${r.user_id}${r.user_id === target?.id ? ', this account' : ', ANOTHER account'}) · updated ${when(r.updated_at)}`);
	if (r.user_id !== target?.id) console.log(`    that account's FishMart save: ${describeSave(saveOf(r.user_id))}`);
}

if (!apply) {
	console.log('\nNothing changed. Add --apply to put the store back on the account.\n');
	process.exit(0);
}

// ── Putting it back ───────────────────────────────────────────────────────────────────
if (!target) throw new Error('No account with that email: they need to sign in once first.');
if (shown.length !== 1) throw new Error(`Expected exactly one showcase store named "${storeName}", found ${shown.length}.`);
const from = shown[0];
const owner = from.user_id;

/** A save rebuilt from the showcase copy (the game fills in everything else as a new store has it). */
function fromShowcase(p: StoreSnapshot, name: string) {
	let u = 2000;
	const fish = (s: string, n?: string) => ({ u: ++u, s, c: 0, ...(n ? { n } : {}) });
	let center: number | null = null;
	const show = p.show.map((t, i) => {
		const tank = { id: 100 + i, x: t.x, y: t.y, level: t.level, seg: t.seg, water: t.water, temp: t.temp, clean: t.clean, growth: t.growth, decor: t.decor, look: t.look, ready: true, fish: t.fish.map((f) => fish(f.s, f.n)) };
		if (t.partner !== null && tank.fish[t.partner] && center === null) center = tank.fish[t.partner].u;
		return tank;
	});
	const sale = p.sale.map((t, i) => ({ id: 1 + i, tier: t.tier, water: t.water, temp: t.temp, x: t.x, y: t.y, clean: t.clean, ready: true, fish: t.fish.map((s) => fish(s)) }));
	const species = [...new Set([...show.flatMap((t) => t.fish), ...sale.flatMap((t) => t.fish)].map((f) => f.s))];
	const special = new Set(TANK_DECOR.filter((d) => d.limited).map((d) => d.id as string));
	return {
		v: 1,
		name,
		named: true,
		last: Date.now(),
		size: p.size,
		floor: p.floor,
		floors: [...new Set(['tile', p.floor])],
		sale,
		show,
		hold: [],
		center,
		fav: show[p.fav]?.id ?? null,
		shared: true,
		decor: p.decor.map((d, i) => ({ id: 500 + i, item: d.item, x: d.x, y: d.y })),
		shelf: { ...p.shelf },
		lab: p.lab ? { ...p.lab, ready: true } : null,
		breeder: p.breeder ? { ...p.breeder, ready: true, pair: [] } : null,
		staff: p.staff.map((role, i) => ({ id: 900 + i, name: role === 'owner' ? 'You' : STAFF_NAMES[i % STAFF_NAMES.length], role })),
		found: species,
		limited: [...new Set(show.flatMap((t) => t.decor).filter((d) => special.has(d)))],
		seq: u + 10,
		log: ['Welcome back! Your store has been restored.']
	};
}

const ownerSave = saveOf(owner);
let restored: string;
let source: string;
const ownerSaveName = (() => {
	try {
		return ownerSave ? String(JSON.parse(ownerSave.data).name).trim().toLowerCase() : null;
	} catch {
		return null;
	}
})();
if (ownerSave && ownerSaveName === storeName.toLowerCase()) {
	restored = ownerSave.data;
	source = 'the account save (everything)';
} else {
	if (!from.layout) throw new Error('The showcase entry has no store layout to rebuild from.');
	restored = JSON.stringify(fromShowcase(JSON.parse(from.layout) as StoreSnapshot, from.store));
	source = 'the showcase copy (store, tanks and fish; cash, gems and research start over)';
}

if (bonusCash || bonusGems) {
	const s = JSON.parse(restored);
	s.cash = (Number(s.cash) || START_CASH) + bonusCash;
	s.gems = (Number(s.gems) || START_GEMS) + bonusGems;
	s.log = [`A gift from FishMart: $${bonusCash.toLocaleString('en')} and ${bonusGems} gems. Sorry about the trouble!`, ...(Array.isArray(s.log) ? s.log : [])].slice(0, 30);
	restored = JSON.stringify(s);
}

const dir = path.dirname(process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve('data', 'app.db'));
const backup = path.join(dir, `ifish-restore-backup-${Date.now()}.json`);
fs.writeFileSync(
	backup,
	JSON.stringify(
		{
			target: { id: target.id, save: saveOf(target.id) ?? null, showcase: showOf(target.id) ?? null },
			owner: { id: owner, save: ownerSave ?? null, showcase: from },
			market: db.prepare('SELECT * FROM ifish_market WHERE seller_id = ?').all(owner)
		},
		null,
		1
	)
);

db.transaction(() => {
	// Newer than anything on the player's devices, so it replaces the new store they started.
	db.prepare(
		`INSERT INTO game_saves (user_id, game, data, saved_at) VALUES (?, 'ifish', ?, ?)
		 ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at`
	).run(target.id, restored, Date.now());
	if (owner !== target.id) {
		db.prepare('DELETE FROM ifish_showcase WHERE user_id = ?').run(target.id);
		db.prepare('UPDATE ifish_showcase SET user_id = ? WHERE user_id = ?').run(target.id, owner);
		db.prepare('UPDATE ifish_market SET seller_id = ? WHERE seller_id = ? AND claimed = 0').run(target.id, owner);
	}
})();

console.log(`\nRestored "${from.store}" to ${mask(email)} from ${source}.`);
if (bonusCash || bonusGems) console.log(`Added a bonus of $${bonusCash} and ${bonusGems} gems.`);
if (owner !== target.id) console.log('Moved the showcase entry and unclaimed market listings to the account.');
console.log(`Backup of what was there before: ${backup}`);
console.log('The player should close FishMart on every device first, then open it again (signed in).\n');
