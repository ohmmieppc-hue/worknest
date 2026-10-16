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
  [/already (accepted|rejected)/, "ใบเสนอราคานี้ได้รับการตอบกลับแล้ว"],
  [/expired/, "ใบเสนอราคานี้หมดอายุแล้ว กรุณาติดต่อผู้ให้บริการ"],
  [/invalid or expired link/, "ลิงก์ไม่ถูกต้องหรือหมดอายุ"],
];

export async function respondAction(token: string, accept: boolean, _prev: RespondState, formData: FormData): Promise<RespondState> {
  if (!isTokenShaped(token)) return { error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อผู้ตอบรับ" };
  if (accept && !formData.get("agree")) return { error: "กรุณายืนยันว่าได้อ่านขอบเขตงานและเงื่อนไขแล้ว" };

  const { ip, userAgent } = await requestMeta();
  const { data: portal } = await getPortalDocument(token);
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_respond", {
    p_token: token,
    p_accept: accept,
    p_name: name,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) {
    const match = MESSAGES.find(([re]) => re.test(error.message));
    return { error: match ? match[1] : "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }

  if (portal) after(() => notifyClientEvent(portal.document.id, accept ? "accepted" : "rejected", name));
  revalidatePath(`/p/${token}`);
  return {};
}
