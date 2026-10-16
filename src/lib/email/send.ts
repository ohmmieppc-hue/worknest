// Minimal Resend client (REST, no SDK). Without RESEND_API_KEY it logs the
// email instead of sending, so local development works with no setup.

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Resend de-duplicates retries carrying the same key for 24 hours. */
  idempotencyKey: string;
}

export type SendResult = { ok: true; id?: string; dryRun?: boolean } | { ok: false; error: string };

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "WorkNest <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`[email:dry-run] to=${message.to.join(",")} subject="${message.subject}" key=${message.idempotencyKey}`);
    return { ok: true, dryRun: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: `${res.status} ${body.message ?? res.statusText}` };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
