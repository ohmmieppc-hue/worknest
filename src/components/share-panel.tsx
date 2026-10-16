"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, ErrorMessage, inputClass } from "@/components/ui";
import { useConfirm } from "@/components/confirm-dialog";
import type { DocumentType } from "@/lib/types";
import { createShareLinkAction, revokeShareLinkAction } from "@/app/(app)/documents/share-actions";

export interface ShareLinkRow {
  id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
}

const fmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const when = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "—");

/**
 * Customer link for a document. `suggested` (the document is issued but not
 * yet sent) makes creating a link the page's main call to action; once a link
 * exists the panel folds into a single status line.
 */
export function SharePanel({
  type,
  documentId,
  links,
  suggested = false,
}: {
  type: DocumentType;
  documentId: string;
  links: ShareLinkRow[];
  suggested?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [url, setUrl] = useState<string>();
  const [copied, setCopied] = useState(false);
  const confirm = useConfirm();

  const live = links.filter((l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date()));

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createShareLinkAction(type, documentId);
      if (result.error) setError(result.error);
      else {
        setUrl(result.url);
        setCopied(false);
        router.refresh();
      }
    });
  }

  async function revoke(linkId: string) {
    const ok = await confirm({
      title: "เพิกถอนลิงก์นี้?",
      description: "ลูกค้าจะเปิดลิงก์นี้ไม่ได้อีก ถ้าต้องการส่งใหม่ให้สร้างลิงก์ใหม่",
      confirmLabel: "เพิกถอน",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await revokeShareLinkAction(type, documentId, linkId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง");
    }
  }

  const what = type === "quotation" ? "ดูและตอบรับ" : type === "delivery_note" ? "ดูและตรวจรับงาน" : "ดูและดาวน์โหลด PDF";
  const lastOpened = live.map((l) => l.last_accessed_at).filter(Boolean).sort().at(-1) ?? null;

  const copyBox = url && (
    <div className="border-t border-stone-200 bg-brand-50/60 p-4">
      <p className="mb-2 text-sm font-medium text-brand-700">คัดลอกลิงก์นี้ส่งให้ลูกค้า (แสดงครั้งเดียว ระบบไม่เก็บลิงก์เต็มไว้)</p>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-xs`} />
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={copy}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}</Button>
        <a href={url} target="_blank" rel="noopener" className="text-sm text-brand-700 hover:underline">
          เปิดดู
        </a>
      </div>
    </div>
  );
  const errorBox = error && (
    <div className="p-4">
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );

  // Not sent yet: sending is the next step.
  if (live.length === 0 && suggested && !url) {
    return (
      <Card className="overflow-hidden border-brand-200">
        <div className="p-4">
          <h2 className="text-sm font-semibold">ส่งให้ลูกค้า</h2>
          <p className="mt-1 mb-3 text-sm text-stone-500">สร้างลิงก์แล้วส่งทาง LINE หรืออีเมล ลูกค้า{what}ได้โดยไม่ต้องสมัคร</p>
          <Button onClick={create} disabled={pending} className="w-full">
            {pending ? "กำลังสร้าง…" : "สร้างลิงก์ส่งลูกค้า"}
          </Button>
        </div>
        {errorBox}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="block font-semibold">ลิงก์ลูกค้า</span>
            <span className="block text-xs text-stone-500">
              {live.length === 0
                ? "ยังไม่มีลิงก์ที่ใช้ได้"
                : lastOpened
                  ? `ลูกค้าเปิดล่าสุด ${when(lastOpened)}`
                  : "ส่งแล้ว · ลูกค้ายังไม่เปิด"}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-stone-400 transition group-open:rotate-180">
            ▾
          </span>
        </summary>

        {links.length > 0 && (
          <ul className="divide-y divide-stone-100 border-t border-stone-100 text-sm">
            {links.map((l) => {
              const isLive = live.some((x) => x.id === l.id);
              return (
                <li key={l.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={isLive ? "" : "text-stone-400 line-through"}>สร้างเมื่อ {when(l.created_at)}</span>
                    {isLive ? (
                      <button type="button" onClick={() => revoke(l.id)} disabled={pending} className="text-xs font-medium text-red-700 hover:underline">
                        เพิกถอน
                      </button>
                    ) : (
                      <span className="text-xs text-stone-500">{l.revoked_at ? "เพิกถอนแล้ว" : "หมดอายุ"}</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{l.last_accessed_at ? `ลูกค้าเปิดล่าสุด ${when(l.last_accessed_at)}` : "ยังไม่มีการเปิด"}</p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-stone-100 px-4 py-3">
          <p className="mb-2 text-xs text-stone-500">ลูกค้า{what}ได้โดยไม่ต้องสมัคร · ลิงก์มีอายุ 90 วัน</p>
          <Button variant="secondary" onClick={create} disabled={pending}>
            {pending ? "กำลังสร้าง…" : live.length ? "สร้างลิงก์ใหม่" : "สร้างลิงก์"}
          </Button>
        </div>
      </details>
      {copyBox}
      {errorBox}
    </Card>
  );
}
