// Checks the email settings in .env: connects and logs in to the SMTP server (SMTP_URL),
// without sending anything. Run: npm run email:test
import nodemailer from 'nodemailer';

const url = process.env.SMTP_URL;
if (!url) {
	console.error('SMTP_URL is not set in .env, so sign-in emails cannot be sent. See .env.example.');
	process.exit(1);
}
const host = new URL(url).host;
try {
	await nodemailer.createTransport(url).verify();
	console.log(`OK: logged in to ${host}. Sign-in emails will be sent from ${process.env.EMAIL_FROM || '(EMAIL_FROM not set)'}.`);
} catch (err) {
	console.error(`Could not log in to ${host}: ${(err as Error).message}`);
	process.exit(1);
}
