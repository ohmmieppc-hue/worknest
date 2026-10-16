import { Card } from "@/components/ui";
import { eventLabel } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentType } from "@/lib/types";

interface EventRow {
  id: number;
  event: string;
  actor: "owner" | "client" | "system";
  actor_name: string | null;
  ip: string | null;
  metadata: { reason?: string; note?: string; via?: string; recorded_manually?: boolean } | null;
  created_at: string;
}

const actorLabel = { owner: "คุณ", client: "ลูกค้า", system: "ระบบ" };

// Evidence trail for one document: issued, sent, viewed, answered, voided.
// Collapsed by default so it never pushes the document itself down.
export async function DocumentHistory({ documentId, type }: { documentId: string; type: DocumentType }) {
  const { supabase } = await requireWorkspace();
  const { data } = await supabase
    .from("document_events")
    .select("id, event, actor, actor_name, ip, metadata, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  const events = (data ?? []) as EventRow[];
  if (events.length === 0) return null;

  return (
    <Card className="print:hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="block font-semibold">ประวัติเอกสาร</span>
            <span className="block text-xs text-stone-500">
              {events.length} รายการ · ล่าสุด {eventLabel(events[0].event, type)} {formatDateTime(events[0].created_at)}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-stone-400 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ol className="border-t border-stone-100 px-4 py-3">
          {events.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Timeline rail */}
              {i < events.length - 1 && <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-px bg-stone-200" />}
              <span
                aria-hidden="true"
                className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white ring-1 ${
                  e.actor === "client" ? "bg-indigo-500 ring-indigo-200" : "bg-stone-400 ring-stone-200"
                }`}
              />
              <div className="min-w-0 text-sm">
                <p>
                  <span className="font-medium">{eventLabel(e.event, type)}</span>
                  <span className="text-stone-500">
                    {" "}
                    · {e.actor_name ?? actorLabel[e.actor]}
                    {e.metadata?.recorded_manually && " (บันทึกเอง)"}
                    {e.metadata?.via === "share_link" && " (สร้างลิงก์)"}
                  </span>
                </p>
                {(e.metadata?.reason || e.metadata?.note) && (
                  <p className="mt-0.5 whitespace-pre-line text-stone-600">“{e.metadata.reason ?? e.metadata.note}”</p>
                )}
                <p className="mt-0.5 text-xs text-stone-500">
                  {formatDateTime(e.created_at)}
                  {e.ip && ` · IP ${e.ip}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
