"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { notifyClientEvent } from "@/lib/notify";
import { getPortalDocument, isTokenShaped, requestMeta } from "@/lib/portal";

export interface RespondState {
  error?: string;
}

const MESSAGES: [RegExp, string][] = [
  [/name is required/, "กรุณากรอกชื่อผู้ตอบรับ"],
  [/note is required/, "กรุณาระบุสิ่งที่ต้องการให้แก้ไข"],
  [/already (accepted|rejected)/, "เอกสารนี้ได้รับการตอบกลับแล้ว"],
  [/expired/, "ใบเสนอราคานี้หมดอายุแล้ว กรุณาติดต่อผู้ให้บริการ"],
  [/invalid or expired link/, "ลิงก์ไม่ถูกต้องหรือหมดอายุ"],
];

export async function respondAction(token: string, accept: boolean, _prev: RespondState, formData: FormData): Promise<RespondState> {
  if (!isTokenShaped(token)) return { error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อผู้ตอบรับ" };
  if (accept && !formData.get("agree")) return { error: "กรุณาติ๊กช่องยืนยันก่อน" };
  // Only delivery notes send a note: what the client wants changed.
  const note = String(formData.get("note") ?? "").trim() || null;

  const { ip, userAgent } = await requestMeta();
  const { data: portal } = await getPortalDocument(token);
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_respond", {
    p_token: token,
    p_accept: accept,
    p_name: name,
    p_ip: ip,
    p_user_agent: userAgent,
    p_note: note,
  });
  if (error) {
    const match = MESSAGES.find(([re]) => re.test(error.message));
    return { error: match ? match[1] : "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }

  if (portal) after(() => notifyClientEvent(portal.document.id, accept ? "accepted" : "rejected", name, note));
  revalidatePath(`/p/${token}`);
  return {};
}
