import { DOC_META, docPath } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import type { DocumentType } from "@/lib/types";

// Plain, table-free HTML that renders the same in Gmail, Outlook and phones.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function layout(heading: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#24735a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="th"><body style="margin:0;background:#f7f7f5;font-family:'Sarabun','Leelawadee UI',Tahoma,sans-serif;color:#1c1f1e">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <p style="font-size:18px;font-weight:700;margin:0 0 16px">Work<span style="color:#24735a">Nest</span></p>
  <div style="background:#fff;border:1px solid #e4e4e0;border-radius:12px;padding:24px">
    <h1 style="font-size:18px;margin:0 0 12px">${esc(heading)}</h1>
    ${body}
    ${button}
  </div>
  <p style="font-size:12px;color:#8a8e8b;margin:16px 4px">อีเมลแจ้งเตือนอัตโนมัติจาก WorkNest</p>
</div></body></html>`;
}

export interface DocumentContext {
  workspace_id: string;
  workspace_name: string;
  document_id: string;
  type: DocumentType;
  number: string | null;
  title: string | null;
  total: string;
  client_name: string;
  emails: string[];
}

export type ClientEvent = "viewed" | "accepted" | "rejected";

const eventHeading: Record<ClientEvent, (label: string) => string> = {
  viewed: (label) => `ลูกค้าเปิดดู${label}แล้ว`,
  accepted: (label) => `ลูกค้าตอบรับ${label}แล้ว`,
  rejected: (label) => `ลูกค้าปฏิเสธ${label}`,
};

export function clientEventEmail(ctx: DocumentContext, event: ClientEvent, actorName?: string | null) {
  const label = DOC_META[ctx.type].label;
  const heading = eventHeading[event](label);
  const subject = `${heading}: ${ctx.number ?? ""} · ${ctx.client_name}`;
  const who = actorName ? ` (โดย ${actorName})` : "";
  const next =
    event === "accepted"
      ? "ขั้นต่อไป: สร้างใบแจ้งหนี้มัดจำหรือเต็มจำนวนได้จากหน้าใบเสนอราคา"
      : event === "rejected"
        ? "ลองติดต่อลูกค้าเพื่อสอบถามเหตุผล หรือคัดลอกเป็นฉบับใหม่เพื่อปรับราคา"
        : "";
  const lines = [
    `${label} <strong>${esc(ctx.number ?? "")}</strong>${ctx.title ? ` · ${esc(ctx.title)}` : ""}`,
    `ลูกค้า: ${esc(ctx.client_name)}${esc(who)}`,
    `ยอดรวม: ${formatMoney(ctx.total)} บาท`,
  ];
  const html = layout(
    heading,
    `<p style="margin:0;line-height:1.7">${lines.join("<br>")}</p>${next ? `<p style="margin:16px 0 0;color:#555">${esc(next)}</p>` : ""}`,
    { href: `${siteUrl()}${docPath(ctx.type, ctx.document_id)}`, label: `เปิด${label}` },
  );
  const text = [heading, ...lines.map((l) => l.replace(/<[^>]+>/g, "")), next, `${siteUrl()}${docPath(ctx.type, ctx.document_id)}`]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

export interface DigestItem {
  kind: "due_soon" | "due_today" | "overdue" | "quote_expiring";
  document_id: string;
  number: string;
  client_name: string;
  date: string;
  days: number;
  amount: string;
}

const kindLabel = (i: DigestItem) => {
  switch (i.kind) {
    case "due_soon":
      return `ครบกำหนดในอีก ${i.days} วัน (${formatDate(i.date)})`;
    case "due_today":
      return "ครบกำหนดวันนี้";
    case "overdue":
      return `เกินกำหนด ${-i.days} วัน`;
    case "quote_expiring":
      return `ใบเสนอราคาหมดอายุในอีก ${i.days} วัน (${formatDate(i.date)})`;
  }
};

export function digestEmail(workspaceName: string, items: DigestItem[]) {
  const invoices = items.filter((i) => i.kind !== "quote_expiring");
  const quotes = items.filter((i) => i.kind === "quote_expiring");
  const overdue = invoices.filter((i) => i.kind === "overdue").length;
  const subject =
    overdue > 0
      ? `มีใบแจ้งหนี้เกินกำหนด ${overdue} ใบ — สรุปวันนี้ (${workspaceName})`
      : `สรุปงานที่ต้องติดตามวันนี้ (${workspaceName})`;

  const row = (i: DigestItem) => {
    const type: DocumentType = i.kind === "quote_expiring" ? "quotation" : "invoice";
    const color = i.kind === "overdue" ? "#b42318" : i.kind === "due_today" ? "#b45309" : "#555";
    return `<li style="margin:0 0 10px"><a href="${esc(`${siteUrl()}${docPath(type, i.document_id)}`)}" style="color:#24735a;font-weight:600">${esc(i.number)}</a> · ${esc(i.client_name)}<br><span style="color:${color}">${esc(kindLabel(i))}</span> · ${formatMoney(i.amount)} บาท</li>`;
  };
  const section = (title: string, list: DigestItem[]) =>
    list.length ? `<p style="margin:16px 0 8px;font-weight:600">${title}</p><ul style="margin:0;padding-left:18px;line-height:1.6">${list.map(row).join("")}</ul>` : "";

  const html = layout(
    "งานที่ต้องติดตามวันนี้",
    section("ใบแจ้งหนี้", invoices) + section("ใบเสนอราคาใกล้หมดอายุ", quotes),
    { href: `${siteUrl()}/dashboard`, label: "เปิดภาพรวม" },
  );
  const text = [
    "งานที่ต้องติดตามวันนี้",
    ...items.map((i) => `- ${i.number} · ${i.client_name} · ${kindLabel(i)} · ${formatMoney(i.amount)} บาท`),
    `${siteUrl()}/dashboard`,
  ].join("\n");
  return { subject, html, text };
}
