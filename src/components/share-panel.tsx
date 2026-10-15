"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, ErrorMessage, inputClass } from "@/components/ui";
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

export function SharePanel({ type, documentId, links }: { type: DocumentType; documentId: string; links: ShareLinkRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [url, setUrl] = useState<string>();
  const [copied, setCopied] = useState(false);

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

  function revoke(linkId: string) {
    if (!confirm("เพิกถอนลิงก์นี้? ลูกค้าจะเปิดลิงก์นี้ไม่ได้อีก")) return;
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

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div>
          <h2 className="font-semibold">ลิงก์สำหรับลูกค้า</h2>
          <p className="text-xs text-stone-500">
            ลูกค้าเปิดดู{type === "quotation" ? " ตอบรับ" : ""}และดาวน์โหลด PDF ได้โดยไม่ต้องสมัคร · ลิงก์มีอายุ 90 วัน
          </p>
        </div>
        <Button variant="secondary" onClick={create} disabled={pending}>
          {pending ? "กำลังสร้าง…" : live.length ? "สร้างลิงก์ใหม่" : "สร้างลิงก์"}
        </Button>
      </div>

      {url && (
        <div className="border-b border-stone-200 bg-brand-50/60 p-4">
          <p className="mb-2 text-sm font-medium text-brand-700">คัดลอกลิงก์นี้ส่งให้ลูกค้า (แสดงครั้งเดียว ระบบไม่เก็บลิงก์เต็มไว้)</p>
          <div className="flex flex-wrap gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} />
            <Button onClick={copy}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</Button>
            <a href={url} target="_blank" rel="noopener" className="self-center text-sm text-brand-700 hover:underline">
              เปิดดู
            </a>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="divide-y divide-stone-100 text-sm">
          {links.map((l) => {
            const isLive = live.some((x) => x.id === l.id);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className={isLive ? "" : "text-stone-400 line-through"}>สร้างเมื่อ {when(l.created_at)}</span>
                <span className="flex items-center gap-3 text-xs text-stone-500">
                  {l.last_accessed_at ? `ลูกค้าเปิดล่าสุด ${when(l.last_accessed_at)}` : "ยังไม่มีการเปิด"}
                  {isLive ? (
                    <button type="button" onClick={() => revoke(l.id)} disabled={pending} className="font-medium text-red-700 hover:underline">
                      เพิกถอน
                    </button>
                  ) : (
                    <span>{l.revoked_at ? "เพิกถอนแล้ว" : "หมดอายุ"}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <div className="p-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </Card>
  );
}
