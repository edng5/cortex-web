// Sends the sign-in code email.
// Configure SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465) and EMAIL_FROM.
// Without SMTP_URL (local dev) the code is printed to the server console instead.
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;

export function emailConfigured(): boolean {
	return !!process.env.SMTP_URL;
}

export async function sendLoginCode(to: string, code: string, minutes: number): Promise<void> {
	if (!process.env.SMTP_URL) {
		console.warn(`[mailer] SMTP_URL not set — sign-in code for ${to}: ${code}`);
		return;
	}
	transport ??= nodemailer.createTransport(process.env.SMTP_URL);
	await transport.sendMail({
		from: process.env.EMAIL_FROM || 'Cortex <no-reply@localhost>',
		to,
		subject: `${code} is your sign-in code for Cortex`,
		text: `Your code to sign in to Edward Ng's site (Cortex) is:\n\n${code}\n\nType it into the Log in box. It works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.`,
		html: `<p>Your code to sign in to Edward Ng's site (Cortex) is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:12px 0">${code}</p>
<p style="color:#64748b;font-size:13px">Type it into the Log in box. It works once and expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.</p>`
	});
}
