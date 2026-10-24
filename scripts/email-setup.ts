// npm run email:setup
// Sets SMTP_URL and EMAIL_FROM in .env for sending sign-in emails from a Gmail account, then
// checks the login. The App Password is typed in hidden and only ever written to .env.
//
// Before running: turn on 2-Step Verification for the Google account, then create an App
// Password at https://myaccount.google.com/apppasswords (any name, e.g. "Cortex").
import fs from 'node:fs';
import readline from 'node:readline';
import nodemailer from 'nodemailer';

const FILE = '.env';
const DEFAULT_EMAIL = 'edwardk.ng@gmail.com';
const DEFAULT_NAME = 'Edward Ng';

function ask(question: string, hidden = false): Promise<string> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		if (hidden) {
			// Echo nothing while the password is typed or pasted.
			(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
				if (s.includes(question)) process.stdout.write(s);
			};
		}
		rl.question(question, (answer) => {
			rl.close();
			if (hidden) process.stdout.write('\n');
			resolve(answer.trim());
		});
	});
}

/** Replaces `NAME=...` in .env text, or appends it. */
function setVar(text: string, name: string, value: string): string {
	const line = `${name}=${value}`;
	const re = new RegExp(`^${name}=.*$`, 'm');
	if (re.test(text)) return text.replace(re, () => line);
	return (text && !text.endsWith('\n') ? text + '\n' : text) + line + '\n';
}

console.log('Press Enter to accept the value in [brackets].');
let email = '';
for (;;) {
	email = (await ask(`Gmail address [${DEFAULT_EMAIL}]: `)) || DEFAULT_EMAIL;
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) break;
	console.log('That is not an email address. Type your Gmail address (or press Enter for the default).');
}
const name = (await ask(`Sender name [${DEFAULT_NAME}]: `)) || DEFAULT_NAME;
console.log('\nNext: the 16-letter App Password from myaccount.google.com/apppasswords.');
console.log('NOT your normal Google password. Typing is hidden.');
let password = '';
for (let tries = 1; ; tries++) {
	// Google shows it as four groups of four letters; spaces and dashes are fine.
	password = (await ask('App Password: ', true)).replace(/[\s-]+/g, '');
	if (/^[a-z]{16}$/i.test(password)) break;
	// Never echo what was typed; the length is enough to spot a bad paste.
	const got = password.length === 0 ? 'nothing (the paste may not have gone in; try right-click or Ctrl+V)' : `${password.length} characters`;
	if (tries === 3) {
		console.error(`Still not a 16-letter App Password (got ${got}). Nothing was changed.`);
		process.exit(1);
	}
	console.log(`That wasn't 16 letters (got ${got}). Try again.`);
}

const smtpUrl = `smtps://${encodeURIComponent(email)}:${encodeURIComponent(password)}@smtp.gmail.com:465`;
try {
	await nodemailer.createTransport(smtpUrl).verify();
} catch (err) {
	console.error(`Gmail rejected the login: ${(err as Error).message}\nNothing was changed. Check the address and App Password.`);
	process.exit(1);
}

let text = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
text = setVar(text, 'SMTP_URL', smtpUrl);
// Gmail only sends from the signed-in address, so the From address must be that account.
text = setVar(text, 'EMAIL_FROM', `"${name} <${email}>"`);
fs.writeFileSync(FILE, text, { mode: 0o600 });
console.log(`Done: logged in to Gmail as ${email} and saved SMTP_URL and EMAIL_FROM to ${FILE}.`);
console.log('Restart the dev server, and add the same two values to your host\'s environment variables.');
