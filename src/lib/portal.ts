import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { DocumentItem, DocumentRow, InvoiceBalance, Payment } from "@/lib/types";

export interface PortalDocument {
  document: DocumentRow;
  items: DocumentItem[];
  balance: InvoiceBalance | null;
  payment: Pick<Payment, "received_on" | "cash_amount" | "wht_amount" | "method" | "reference"> | null;
  reference: string | null;
}

// Tokens are 32 random bytes in base64url; reject anything else before
// touching the database.
export const isTokenShaped = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export async function getPortalDocument(token: string) {
  if (!isTokenShaped(token)) return { supabase: null, data: null };
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_get_document", { p_token: token });
  return { supabase, data: (data ?? null) as PortalDocument | null };
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim(),
    userAgent: h.get("user-agent") ?? "",
  };
}
