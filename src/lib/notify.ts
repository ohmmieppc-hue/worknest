import { createClient as createSupabase } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { clientEventEmail, digestEmail, type ClientEvent, type DigestItem, type DocumentContext } from "@/lib/email/templates";
import { supabaseEnv } from "@/lib/supabase/env";

// Server-only. Talks to the secret-gated notify_* functions with the anon key
// and CRON_SECRET; no user session and no service-role key involved.

function notifyClient() {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const { url, key } = supabaseEnv();
  const db = createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { db, secret };
}

async function deliver(
  c: NonNullable<ReturnType<typeof notifyClient>>,
  args: { workspaceId: string; kind: string; key: string; to: string[]; entityId?: string; email: { subject: string; html: string; text: string } },
) {
  if (args.to.length === 0) return "no-recipient" as const;

  const { data: claimed, error } = await c.db.rpc("notify_claim", {
    p_secret: c.secret,
    p_workspace: args.workspaceId,
    p_kind: args.kind,
    p_key: args.key,
    p_recipient: args.to.join(","),
    p_entity_type: args.entityId ? "document" : null,
    p_entity_id: args.entityId ?? null,
  });
  if (error) throw new Error(`notify_claim: ${error.message}`);
  if (!claimed) return "duplicate" as const;

  const result = await sendEmail({ to: args.to, idempotencyKey: args.key, ...args.email });
  await c.db.rpc("notify_result", {
    p_secret: c.secret,
    p_key: args.key,
    p_ok: result.ok,
    p_error: result.ok ? (result.dryRun ? "dry-run (no RESEND_API_KEY)" : null) : result.error,
  });
  return result.ok ? ("sent" as const) : ("failed" as const);
}

/** Tell the workspace owners that a client viewed / accepted / rejected a document. */
export async function notifyClientEvent(documentId: string, event: ClientEvent, actorName?: string | null) {
  const c = notifyClient();
  if (!c) return console.warn("[notify] CRON_SECRET not set; skipping", event, documentId);
  try {
    const { data, error } = await c.db.rpc("notify_document_context", { p_secret: c.secret, p_document_id: documentId });
    if (error || !data) throw new Error(error?.message ?? "document not found");
    const ctx = data as DocumentContext;
    const outcome = await deliver(c, {
      workspaceId: ctx.workspace_id,
      kind: `client_${event}`,
      key: `client_${event}:${documentId}`,
      to: ctx.emails,
      entityId: documentId,
      email: clientEventEmail(ctx, event, actorName),
    });
    console.info(`[notify] client_${event} ${ctx.number}: ${outcome}`);
  } catch (e) {
    console.error("[notify] client event failed", event, documentId, e);
  }
}

/** Daily digest for every workspace with something due; safe to run more than once a day. */
export async function sendDailyDigests(today: string) {
  const c = notifyClient();
  if (!c) throw new Error("CRON_SECRET not set");
  const { data, error } = await c.db.rpc("notify_due_digest", { p_secret: c.secret, p_today: today });
  if (error) throw new Error(`notify_due_digest: ${error.message}`);

  const results: Record<string, string> = {};
  for (const row of (data ?? []) as { workspace_id: string; workspace_name: string; emails: string[]; items: DigestItem[] }[]) {
    try {
      results[row.workspace_id] = await deliver(c, {
        workspaceId: row.workspace_id,
        kind: "daily_digest",
        key: `daily_digest:${row.workspace_id}:${today}`,
        to: row.emails,
        email: digestEmail(row.workspace_name, row.items),
      });
    } catch (e) {
      results[row.workspace_id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return results;
}
