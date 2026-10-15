"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";
import { docPath } from "@/lib/documents";
import type { DocumentRow, DocumentType } from "@/lib/types";

const LINK_LIFETIME_DAYS = 90;

export interface ShareResult {
  error?: string;
  url?: string;
}

/**
 * Creates a portal link. Only the SHA-256 of the token is stored, so the URL
 * is returned once and cannot be shown again. Creating a link counts as
 * sending an issued quotation/invoice.
 */
export async function createShareLinkAction(type: DocumentType, documentId: string): Promise<ShareResult> {
  const { supabase, user, workspace } = await requireWorkspace();

  const { data: doc } = await supabase.from("documents").select("id, status, workspace_id").eq("id", documentId).maybeSingle();
  if (!doc) return { error: "ไม่พบเอกสาร" };
  const current = doc as Pick<DocumentRow, "id" | "status" | "workspace_id">;
  if (current.status === "draft" || current.status === "void") return { error: "แชร์ได้เฉพาะเอกสารที่ออกแล้วและยังไม่ยกเลิก" };

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  const expires = new Date(Date.now() + LINK_LIFETIME_DAYS * 86_400_000).toISOString();

  const { error } = await supabase.from("share_links").insert({
    workspace_id: workspace.id,
    document_id: documentId,
    token_hash: `\\x${hash}`,
    expires_at: expires,
    created_by: user.id,
  });
  if (error) return { error: toThaiError(error) };

  if (current.status === "issued" && (type === "quotation" || type === "invoice")) {
    const { error: sendError } = await supabase.from("documents").update({ status: "sent" }).eq("id", documentId);
    if (!sendError) {
      await supabase.from("document_events").insert({
        workspace_id: current.workspace_id,
        document_id: documentId,
        event: "sent",
        actor: "owner",
        metadata: { via: "share_link" },
      });
    }
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  revalidatePath(docPath(type, documentId));
  return { url: `${origin}/p/${token}` };
}

export async function revokeShareLinkAction(type: DocumentType, documentId: string, linkId: string): Promise<ShareResult> {
  const { supabase } = await requireWorkspace();
  const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  if (error) return { error: toThaiError(error) };
  revalidatePath(docPath(type, documentId));
  return {};
}
