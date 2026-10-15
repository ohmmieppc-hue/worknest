"use client";

import { Button, buttonClass } from "@/components/ui";

// Print uses the on-screen document with print CSS (A4); the PDF is rendered
// on the server so it can be saved or emailed as a file.
export function DocumentExport({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={() => window.print()}>
        พิมพ์
      </Button>
      <a href={`/api/documents/${id}/pdf?download=1`} className={buttonClass("secondary")} download>
        ดาวน์โหลด PDF
      </a>
      <a href={`/api/documents/${id}/pdf`} target="_blank" rel="noopener" className={buttonClass("ghost")}>
        เปิด PDF
      </a>
    </div>
  );
}
