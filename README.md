# WorkNest

ระบบจัดการลูกค้า ใบเสนอราคา และการเก็บเงินสำหรับฟรีแลนซ์ไทย — Next.js 16 + Supabase

- สเปก: [worknest.md](worknest.md)
- Data model: [docs/data-model.md](docs/data-model.md)
- Database schema: [db/schema.sql](db/schema.sql)

## เริ่มต้น

1. สร้างโปรเจกต์ Supabase แล้วรัน `db/schema.sql` ใน SQL Editor (หรือเป็น migration)
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ URL และ Publishable key จาก Supabase → Settings → API
3. Supabase → Authentication → URL Configuration: ตั้ง Site URL = `http://localhost:3000` และเพิ่ม `http://localhost:3000/auth/confirm` ใน Redirect URLs
4. รัน

```bash
npm install
npm run dev
```

## ทดสอบ schema

ทดสอบกฎทางธุรกิจใน `db/schema.sql` บน Postgres แบบ embedded (PGlite) โดยไม่ต้องมี Supabase:

```bash
npm install --no-save @electric-sql/pglite
node db/schema.test.mjs db/schema.sql
```

## อีเมลแจ้งเตือน

- แจ้งเจ้าของ workspace ทันทีเมื่อลูกค้าเปิดดูเอกสารครั้งแรก / ตอบรับ / ปฏิเสธผ่าน Portal
- สรุปรายวัน 08:00 (Vercel Cron → `/api/cron/reminders`): ใบแจ้งหนี้ครบกำหนดใน 3 วัน / วันนี้ / เกินกำหนด 1, 7, 14, 30 วัน และใบเสนอราคาหมดอายุในอีก 2 วัน
- ส่งผ่าน Resend (`RESEND_API_KEY`, `EMAIL_FROM`) — ไม่ตั้ง key = แค่ log (dry-run)
- `CRON_SECRET` ใช้ทั้งเป็นรหัสของ cron และรหัสเรียกฟังก์ชัน `notify_*` ใน DB (เก็บ SHA-256 ไว้ใน `app_secrets`) จึงไม่ต้องใช้ service-role key
- กันส่งซ้ำด้วย `notification_log.idempotency_key`

## โครงสร้าง

| Path | หน้าที่ |
|---|---|
| `src/proxy.ts` | refresh session ของ Supabase และพาผู้ที่ยังไม่ login ไป `/login` |
| `src/lib/workspace.ts` | `requireWorkspace()` คืน user + workspace ของ request |
| `src/app/(app)/clients` | รายชื่อ / เพิ่ม / แก้ไขลูกค้า |
| `src/app/(app)/quotations` | ใบเสนอราคา: ร่าง → ออกเลขที่ → ส่ง → ตอบรับ / ปฏิเสธ / ยกเลิก |
| `src/app/(app)/invoices` | ใบแจ้งหนี้ (สร้างจากใบเสนอราคาเต็มจำนวนหรือแบ่งงวด), บันทึกรับเงิน, 50 ทวิ, QR พร้อมเพย์ |
| `src/app/(app)/receipts` | ใบเสร็จรับเงิน ออกจากการรับเงินแต่ละครั้ง |
| `src/app/(app)/settings` | ข้อมูลผู้ให้บริการ, พร้อมเพย์/บัญชีธนาคาร, ค่าเริ่มต้นเอกสาร |
| `src/components/document-*.tsx` | editor / ใบเอกสาร / ปุ่มสถานะ ที่ใช้ร่วมกันทุกประเภทเอกสาร |
| `src/app/api/documents/[id]/pdf` | PDF ฝั่ง server (`?download=1` = บันทึกเป็นไฟล์) |
| `src/lib/pdf/document-pdf.tsx` | layout PDF ด้วย react-pdf + ฟอนต์ Sarabun (`assets/fonts`, OFL) — ตัดคำไทยด้วย `Intl.Segmenter` และแยก "ำ" เป็น "ํา" เพื่อเลี่ยงบั๊กตัวอักษรท้ายหาย |
| `src/app/(app)/dashboard` | ภาพรวม: ยอดค้างรับ/เกินกำหนด, ใบเสนอราคารอตอบรับ, รับเงินเดือนนี้, ความเคลื่อนไหว |
| `src/app/p/[token]` | Client Portal (ไม่ต้อง login): ดูเอกสาร, ตอบรับ/ปฏิเสธใบเสนอราคา, QR, PDF — เข้าถึงผ่านฟังก์ชัน `portal_*` ใน DB เท่านั้น |
| `src/lib/totals.ts` | คำนวณยอดฝั่ง UI (DB คำนวณซ้ำและเป็นตัวจริง) |
| `src/lib/bahttext.ts` | แปลงจำนวนเงินเป็นคำอ่านภาษาไทย |

> โปรเจกต์นี้เปิด `cacheComponents` — โค้ดที่อ่าน cookies / session ต้องอยู่ใน `<Suspense>`
