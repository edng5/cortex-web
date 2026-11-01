// npm run saves:rollback -- --email player@example.com [--game ifish] [--backup 1] [--apply]
// Rolls a player's saved progress (an arcade game, FishMart or SpeakEase AI) back to one of its
// daily backups. Without --game it lists the player's saves and backups; without --apply it only
// shows what it would do. --backup 1 is the newest backup (the default), 2 the one before.
// Run on the server (needs the same keys as the app). The save being replaced is kept as a backup,
// so a rollback can be undone with another rollback. The player should close the game on every
// device first, then open it again (signed in).
import { getDb } from '../src/lib/server/db';
import { blindIndex } from '../src/lib/server/crypto';
import { getSave, listBackups, rollBack } from '../src/lib/server/game-saves';

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
const email = opt('email')?.trim().toLowerCase();
const game = opt('game')?.trim();
const pick = Math.max(1, Math.round(Number(opt('backup') ?? 1)) || 1);
const apply = args.includes('--apply');
if (!email) {
	console.error('Usage: npm run saves:rollback -- --email player@example.com [--game ifish] [--backup 1] [--apply]');
	process.exit(1);
}

const db = getDb();
const when = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length)) + c);
const size = (s: string) => (s.length > 1024 ? `${(s.length / 1024).toFixed(1)} KB` : `${s.length} bytes`);
/** A line about a save: its size, and for FishMart its store, fish and cash. */
function about(data: string, savedAt: number) {
	let extra = '';
	try {
		const s = JSON.parse(data);
		if (s && typeof s === 'object' && 'hold' in s && 'show' in s) {
			const fish = [...(s.hold ?? []), ...(s.sale ?? []).flatMap((t: { fish: unknown[] }) => t.fish), ...(s.show ?? []).flatMap((t: { fish: unknown[] }) => t.fish)].length;
			extra = ` · "${s.name}" · ${fish} fish · $${Math.round(s.cash)} · ${s.gems} gems`;
		}
	} catch {
		/* not JSON: just the size */
	}
	return `saved ${when(savedAt)} · ${size(data)}${extra}`;
}

const user = db.prepare('SELECT id FROM users WHERE email_hash = ?').get(blindIndex('email', email)) as { id: string } | undefined;
if (!user) {
	console.error(`No account with the email ${mask(email)}.`);
	process.exit(1);
}

if (!game) {
	// No game named: list every save the player has, and its backups.
	const games = db.prepare('SELECT DISTINCT game FROM game_saves WHERE user_id = ? UNION SELECT DISTINCT game FROM game_save_backups WHERE user_id = ?').all(user.id, user.id) as { game: string }[];
	console.log(`\nSaves for ${mask(email)}:`);
	if (!games.length) console.log('  none');
	for (const { game: g } of games) {
		const cur = getSave(user.id, g);
		console.log(`\n  ${g}: ${cur ? about(cur.data, cur.savedAt) : 'no current save'}`);
		listBackups(user.id, g).forEach((b, i) => console.log(`    backup ${i + 1} (made ${when(b.backedUpAt)}): ${about(b.data, b.savedAt)}`));
	}
	console.log('\nAdd --game <name> to roll one back.\n');
	process.exit(0);
}

const backups = listBackups(user.id, game);
const current = getSave(user.id, game);
console.log(`\n${game} for ${mask(email)}:`);
console.log(`  now:      ${current ? about(current.data, current.savedAt) : 'no current save'}`);
backups.forEach((b, i) => console.log(`  backup ${i + 1}: (made ${when(b.backedUpAt)}) ${about(b.data, b.savedAt)}`));
const chosen = backups[pick - 1];
if (!chosen) {
	console.error(backups.length ? `\nThere's no backup ${pick} (there ${backups.length === 1 ? 'is 1' : `are ${backups.length}`}).` : '\nThis save has no backups yet (they are made daily, once it has been saved before).');
	process.exit(1);
}
if (!apply) {
	console.log(`\nNothing changed. Add --apply to roll back to backup ${pick}.\n`);
	process.exit(0);
}

rollBack(user.id, game, chosen);
console.log(`\nRolled ${game} back to backup ${pick} (${about(chosen.data, chosen.savedAt)}).`);
console.log('The save it replaced is kept as a backup, so this can be undone the same way.');
console.log('The player should close the game on every device first, then open it again (signed in).\n');
