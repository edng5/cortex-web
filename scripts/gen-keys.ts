// npm run gen-keys
// Adds AUTH_ENC_KEY and AUTH_HMAC_KEY (32 random bytes each) to .env if they're missing.
// Never overwrites existing keys: changing them makes stored emails, prompts and quota
// records unreadable. Keep .env out of git and back the keys up somewhere safe.
import crypto from 'node:crypto';
import fs from 'node:fs';

const FILE = '.env';
let text = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const added: string[] = [];

for (const name of ['AUTH_ENC_KEY', 'AUTH_HMAC_KEY']) {
	if (new RegExp(`^${name}=.+`, 'm').test(text)) continue;
	if (text && !text.endsWith('\n')) text += '\n';
	text += `${name}=${crypto.randomBytes(32).toString('base64')}\n`;
	added.push(name);
}

if (added.length) {
	fs.writeFileSync(FILE, text, { mode: 0o600 });
	console.log(`Added ${added.join(' and ')} to ${FILE}. Restart the server to pick them up.`);
} else {
	console.log('Keys already present in .env — nothing changed.');
}
