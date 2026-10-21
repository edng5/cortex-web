// npm run new-node -- <type> <id> ["Title"]
// e.g. npm run new-node -- project proj-cortex "Cortex Website"
// Copies content/_templates/<type>.md to the right folder with id/title filled in.
import fs from 'node:fs';
import path from 'node:path';

const FOLDERS: Record<string, string> = {
	about: 'about',
	experience: 'experience',
	education: 'education',
	project: 'projects',
	publication: 'publications',
	skill: 'skills',
	interest: 'interests',
	quote: 'quotes'
};

const [type, id, title] = process.argv.slice(2);
if (!type || !id || !FOLDERS[type]) {
	console.log(`Usage: npm run new-node -- <${Object.keys(FOLDERS).join('|')}> <id> ["Title"]`);
	process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
	console.error('id must be lowercase letters, numbers and dashes (e.g. proj-cortex)');
	process.exit(1);
}

const root = path.resolve(process.cwd(), 'content');
const dest = path.join(root, FOLDERS[type], `${id}.md`);
if (fs.existsSync(dest)) {
	console.error(`${dest} already exists`);
	process.exit(1);
}
let tpl = fs.readFileSync(path.join(root, '_templates', `${type}.md`), 'utf8');
if (title) tpl = tpl.replace(/^title: .*$/m, `title: ${JSON.stringify(title)}`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, tpl);
console.log(`Created ${path.relative(process.cwd(), dest)} — fill it in, then run: npm run ingest`);
