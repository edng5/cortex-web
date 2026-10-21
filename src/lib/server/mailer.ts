// Sends the one-time sign-in email.
// Configure SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465) and EMAIL_FROM.
// Without SMTP_URL (local dev) the link is printed to the server console instead.
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;

export function emailConfigured(): boolean {
	return !!process.env.SMTP_URL;
}

export async function sendLoginEmail(to: string, link: string): Promise<void> {
	if (!process.env.SMTP_URL) {
		console.warn(`[mailer] SMTP_URL not set — sign-in link for ${to}:\n  ${link}`);
		return;
	}
	transport ??= nodemailer.createTransport(process.env.SMTP_URL);
	await transport.sendMail({
		from: process.env.EMAIL_FROM || 'Cortex <no-reply@localhost>',
		to,
		subject: 'Your sign-in link for Cortex',
		text: `Click to sign in to Edward Ng's site (Cortex):\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
		html: `<p>Click to sign in to Edward Ng's site (Cortex):</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0ea5e9;color:#fff;text-decoration:none">Sign in</a></p>
<p style="color:#64748b;font-size:13px">This link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`
	});
}
