import nodemailer from "nodemailer";

// SMTP configuration (e.g. Gmail with an app password). When unset the support
// flow still records feedback locally but skips the actual send.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// The inbox that receives support/feedback messages. Replies go to the sender
// (the logged-in user's email) via the Reply-To header.
export const SUPPORT_TO_EMAIL = process.env.SUPPORT_TO_EMAIL || "goassethub@gmail.com";
const SUPPORT_FROM_EMAIL =
  process.env.SUPPORT_FROM_EMAIL || SMTP_USER || "support@assethub.my";

export type MailResult = { sent: boolean; reason?: string };

function isConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER);
}

/**
 * Send an email through the configured SMTP server. When SMTP isn't configured
 * (e.g. local dev before adding SMTP_* env vars) it logs a warning and returns
 * sent:false so the calling feature still records its data without crashing.
 */
export async function sendMail(opts: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  if (!isConfigured()) {
    console.warn("[mail] SMTP not configured — skipping send to", opts.to);
    return { sent: false, reason: "smtp-not-configured" };
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: SUPPORT_FROM_EMAIL,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { sent: true };
}
