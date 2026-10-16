"use client";

import { useRef } from "react";
import { Button } from "@/components/ui";
import { useConfirm } from "@/components/confirm-dialog";
import { archiveClientAction } from "../actions";

export function ArchiveClientButton({ id, name }: { id: string; name: string }) {
  const form = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();
  return (
    <form ref={form} action={archiveClientAction.bind(null, id)}>
      <Button
        type="button"
        variant="ghost"
        onClick={async () => {
          const ok = await confirm({
            title: `เก็บ "${name}" เข้าคลัง?`,
            description: "ลูกค้าจะไม่แสดงในรายชื่อและตอนสร้างเอกสารใหม่ เอกสารเดิมยังอยู่ครบ",
            confirmLabel: "เก็บเข้าคลัง",
          });
          if (ok) form.current?.requestSubmit();
        }}
      >
        เก็บเข้าคลัง
      </Button>
    </form>
  );
}
