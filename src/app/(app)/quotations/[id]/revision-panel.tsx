"use client";

import { useActionState } from "react";
import { Card, ErrorMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { RevisionCounter, RevisionList } from "@/components/revisions";
import type { DocumentRevision } from "@/lib/types";
import { deleteRevisionAction, logRevisionAction, type RevisionState } from "../revision-actions";

export function RevisionPanel({
  quotationId,
  included,
  revisions,
  canLog,
}: {
  quotationId: string;
  included: number | null;
  revisions: DocumentRevision[];
  canLog: boolean;
}) {
  const [state, action] = useActionState<RevisionState, FormData>(logRevisionAction.bind(null, quotationId), {});

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">รอบแก้ไขที่ใช้ไป</h2>
          <p className="text-xs text-stone-500">ลูกค้าเห็นตัวเลขนี้ในลิงก์ใบเสนอราคา</p>
        </div>
        <RevisionCounter used={revisions.length} included={included} />
      </div>

      <RevisionList
        revisions={revisions}
        action={(r) =>
          r.id && (
            <form action={deleteRevisionAction.bind(null, quotationId, r.id)}>
              <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                ลบ
              </button>
            </form>
          )
        }
      />

      {canLog && (
        // key resets the textarea after each successful save.
        <form key={state.saved ?? 0} action={action} className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3 sm:flex-row sm:items-start">
          <textarea
            name="note"
            rows={2}
            required
            maxLength={1000}
            placeholder="แก้อะไรในรอบนี้ เช่น เปลี่ยนสีโลโก้ตามคอมเมนต์ลูกค้า"
            className={inputClass}
          />
          <SubmitButton className="shrink-0">บันทึกรอบแก้ไข</SubmitButton>
        </form>
      )}
      <ErrorMessage>{state.error}</ErrorMessage>
    </Card>
  );
}
