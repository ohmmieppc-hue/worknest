import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

// Static how-to for the whole flow, from setup to getting paid. Button names
// in quotes match the labels in the app.

interface Section {
  id: string;
  title: string;
  intro: string;
  href?: { path: string; label: string };
  steps: ReactNode[];
  tips?: ReactNode[];
}

const FLOW = [
  { label: "ใบเสนอราคา", note: "ลูกค้าตอบรับผ่านลิงก์" },
  { label: "ใบแจ้งหนี้", note: "มัดจำ / เต็มจำนวน + QR" },
  { label: "ส่งมอบงาน", note: "ลูกค้าตรวจรับ / ขอแก้ไข" },
  { label: "รับเงิน + ใบเสร็จ", note: "บันทึกยอด 50 ทวิ" },
];

const SECTIONS: Section[] = [
  {
    id: "setup",
    title: "เริ่มต้นใช้งาน",
    intro: "ตั้งค่าครั้งเดียว ข้อมูลนี้จะไปอยู่บนหัวเอกสารทุกใบที่ออกหลังจากนี้",
    href: { path: "/settings", label: "ไปที่ตั้งค่า" },
    steps: [
      "อัปโหลดโลโก้ (PNG หรือ JPG ไม่เกิน 1MB)",
      "กรอกชื่อบนเอกสาร เลขประจำตัวผู้เสียภาษี 13 หลัก ที่อยู่ เบอร์โทร และอีเมล",
      "ใส่พร้อมเพย์ (เบอร์โทรหรือเลข 13 หลัก) เพื่อให้ใบแจ้งหนี้มี QR สำหรับโอน และบัญชีธนาคารเป็นทางเลือก",
      "ตั้งค่าเริ่มต้น: ระยะยืนราคาของใบเสนอราคา และเครดิตเทอมของใบแจ้งหนี้",
    ],
    tips: ["แก้ข้อมูลภายหลังได้ เอกสารที่ออกไปแล้วจะยังแสดงข้อมูลเดิม (ระบบเก็บสำเนาไว้ตอนออกเอกสาร)"],
  },
  {
    id: "clients",
    title: "ลูกค้าและรายการบริการ",
    intro: "บันทึกลูกค้าและบริการที่ทำประจำไว้ เพื่อเลือกใส่เอกสารได้เร็ว",
    href: { path: "/clients", label: "ไปที่ลูกค้า" },
    steps: [
      <>กด “+ เพิ่มลูกค้า” ใส่ชื่อ ประเภท (บุคคล / นิติบุคคล) เลขผู้เสียภาษี และอัตราหัก ณ ที่จ่ายที่ลูกค้ามักหัก (ค่าบริการทั่วไป 3%)</>,
      "ผู้ที่ติดต่อมาแต่ยังไม่ได้จ้าง ตั้งสถานะเป็น Lead ไว้ติดตาม",
      <>
        ที่เมนู <Link href="/services" className="text-brand-700 hover:underline">บริการ</Link> บันทึกชื่อบริการ ราคา และหน่วย แล้วเลือก “+ เพิ่มจากรายการบริการ…” ตอนทำเอกสาร
      </>,
    ],
    tips: ["หน้าลูกค้าแต่ละรายแสดงเอกสารทั้งหมดและยอดค้างรับของลูกค้ารายนั้น"],
  },
  {
    id: "quotation",
    title: "ใบเสนอราคา",
    intro: "เสนอราคา แล้วส่งลิงก์ให้ลูกค้ากดตอบรับออนไลน์ได้เลย ไม่ต้องเซ็นกระดาษ",
    href: { path: "/quotations/new", label: "สร้างใบเสนอราคา" },
    steps: [
      <>กด “+ สร้างใบเสนอราคา” แล้วเลือกลูกค้า ใส่ชื่องาน รายการ ส่วนลด และหัก ณ ที่จ่าย ระบบคำนวณยอดให้อัตโนมัติ</>,
      "กรอกขอบเขตงาน สิ่งที่ไม่รวมในราคา และจำนวนรอบแก้ไขที่รวมในราคา เพื่อกันงานบานปลาย",
      <>กด “บันทึกร่าง” ได้เรื่อย ๆ เมื่อพร้อมกด “ออกใบเสนอราคา” จะได้เลขที่เอกสาร (เช่น QT-2569-0001)</>,
      <>กด “สร้างลิงก์” ในกล่อง “ลิงก์สำหรับลูกค้า” แล้วส่งลิงก์ทาง LINE หรืออีเมล ลูกค้าเปิดดู ดาวน์โหลด PDF และกดตอบรับได้</>,
      <>ถ้าลูกค้าตอบรับนอกระบบ กด “ลูกค้าตอบรับ” บันทึกเองได้</>,
    ],
    tips: [
      "ออกเอกสารแล้วแก้ไขไม่ได้ ถ้าต้องแก้ให้ “ยกเลิกเอกสาร” แล้ว “ออกฉบับใหม่แทน”",
      "ใบเสนอราคาที่เลยวันยืนราคาจะเปลี่ยนเป็น “หมดอายุ” อัตโนมัติ",
    ],
  },
  {
    id: "revisions",
    title: "นับรอบแก้ไข",
    intro: "ติดตามว่าใช้รอบแก้ไขไปกี่รอบแล้ว เทียบกับที่ตกลงไว้ในใบเสนอราคา",
    steps: [
      "เปิดใบเสนอราคาที่ลูกค้าตอบรับแล้ว จะมีกล่อง “รอบแก้ไขที่ใช้ไป”",
      <>พิมพ์ว่าแก้อะไรในรอบนั้น แล้วกด “บันทึกรอบแก้ไข”</>,
      "เมื่อเกินจำนวนที่ตกลง ระบบจะเตือนว่าคิดค่าบริการเพิ่มได้ ลูกค้าเห็นตัวเลขเดียวกันในลิงก์ใบเสนอราคา",
    ],
    tips: ["เมื่อลูกค้ากด “ขอแก้ไขงาน” ในใบส่งมอบงาน ระบบนับเป็นรอบแก้ไขให้อัตโนมัติ"],
  },
  {
    id: "invoice",
    title: "ใบแจ้งหนี้และ QR พร้อมเพย์",
    intro: "เรียกเก็บเงินจากใบเสนอราคาที่ตอบรับแล้ว จะเก็บเต็มจำนวนหรือแบ่งงวดก็ได้",
    href: { path: "/invoices", label: "ไปที่ใบแจ้งหนี้" },
    steps: [
      <>เปิดใบเสนอราคาที่ตอบรับแล้ว กด “สร้างใบแจ้งหนี้” แล้วเลือก “เต็มจำนวน” หรือใส่เปอร์เซ็นต์ เช่น มัดจำ 50%</>,
      "ตรวจวันครบกำหนดชำระ แล้วกดออกใบแจ้งหนี้",
      "สร้างลิงก์ส่งให้ลูกค้า ในลิงก์มี QR พร้อมเพย์ตามยอดที่ต้องโอนจริง (หักภาษี ณ ที่จ่ายออกแล้ว)",
    ],
    tips: ["แท็บ “เกินกำหนด” และการ์ดสรุปด้านบนช่วยให้เห็นว่าต้องทวงใครก่อน"],
  },
  {
    id: "payment",
    title: "บันทึกรับเงิน ใบเสร็จ และ 50 ทวิ",
    intro: "เมื่อลูกค้าโอนแล้ว บันทึกยอดรับเพื่อปิดใบแจ้งหนี้และออกใบเสร็จ",
    steps: [
      <>ในหน้าใบแจ้งหนี้ กด “+ บันทึกรับเงิน” ใส่วันที่ ยอดที่รับจริง ช่องทาง และยอดหัก ณ ที่จ่าย (ถ้ามี)</>,
      <>ติ๊ก “ออกใบเสร็จรับเงินทันที” (ติ๊กไว้ให้แล้ว) ระบบออกใบเสร็จตามยอดที่รับ</>,
      "ถ้าลูกค้าหักภาษี ณ ที่จ่าย ระบบจะติดตามว่าได้รับหนังสือรับรอง 50 ทวิ แล้วหรือยัง",
      "รับเงินเป็นงวด ๆ ได้ ยอดคงค้างและสถานะชำระจะอัปเดตเอง",
    ],
    tips: ["ใบเสร็จที่ออกผิด ยกเลิกแล้วออกใบใหม่จากหน้าใบแจ้งหนี้ได้"],
  },
  {
    id: "delivery",
    title: "ส่งมอบงานและให้ลูกค้าตรวจรับ",
    intro: "ส่งงานพร้อมหลักฐานการตรวจรับ ใบส่งมอบงานไม่แสดงราคา",
    href: { path: "/delivery-notes", label: "ไปที่ส่งมอบงาน" },
    steps: [
      <>เปิดใบเสนอราคาที่ตอบรับแล้ว กด “สร้างใบส่งมอบงาน” ระบบดึงรายการงานมาให้</>,
      "ใส่รายละเอียดหรือลิงก์ไฟล์งาน แล้วกด “ออกใบส่งมอบงาน”",
      <>สร้างลิงก์ส่งให้ลูกค้า ลูกค้ากด “ตรวจรับงาน” หรือ “ขอแก้ไขงาน” พร้อมบอกสิ่งที่ต้องแก้</>,
      <>ถ้าลูกค้าขอแก้ไข แก้งานแล้วกด “คัดลอกเป็นฉบับใหม่” เพื่อส่งมอบรอบถัดไป</>,
    ],
    tips: ["ระบบบันทึกชื่อผู้ตรวจรับ วันเวลา และ IP ไว้เป็นหลักฐาน และแสดงบนใบส่งมอบงานกับ PDF"],
  },
  {
    id: "share",
    title: "ลิงก์ลูกค้า PDF และการพิมพ์",
    intro: "ลูกค้าไม่ต้องสมัครสมาชิก เปิดลิงก์ก็ดูเอกสารได้",
    steps: [
      "ลิงก์มีอายุ 90 วัน และแสดงให้คัดลอกได้ครั้งเดียว ถ้าหายให้สร้างลิงก์ใหม่",
      <>กด “เพิกถอน” เพื่อปิดลิงก์ที่ไม่ต้องการแล้ว</>,
      <>ทุกเอกสารมีปุ่ม “พิมพ์” “ดาวน์โหลด PDF” และ “เปิด PDF” ด้านขวาบน</>,
    ],
    tips: ["ระบบส่งอีเมลแจ้งเมื่อลูกค้าเปิดดูครั้งแรก ตอบรับ ปฏิเสธ หรือตรวจรับงาน และสรุปงานที่ต้องตามทุกเช้า"],
  },
];

const STATUSES: [string, string][] = [
  ["ร่าง", "ยังแก้ไขได้ ยังไม่มีเลขที่"],
  ["ออกแล้ว", "ได้เลขที่แล้ว แก้ไขไม่ได้"],
  ["ส่งแล้ว", "สร้างลิงก์หรือกดว่าส่งแล้ว"],
  ["ลูกค้าเปิดดูแล้ว", "ลูกค้าเปิดลิงก์แล้ว"],
  ["ตอบรับแล้ว / ตรวจรับแล้ว", "ลูกค้ายืนยันแล้ว"],
  ["ปฏิเสธ / ขอแก้ไข", "ลูกค้าไม่ยืนยัน ดูเหตุผลในเอกสาร"],
  ["หมดอายุ", "ใบเสนอราคาเลยวันยืนราคา"],
  ["ยกเลิก", "ยกเลิกแล้ว ยังเก็บไว้เป็นประวัติ"],
];

const FAQ: [string, string][] = [
  ["ออกเอกสารผิด แก้ได้ไหม", "เอกสารที่ออกแล้วแก้ไม่ได้ตามหลักบัญชี ให้กด “ยกเลิกเอกสาร” ใส่เหตุผล แล้วกด “ออกฉบับใหม่แทน” ระบบคัดลอกข้อมูลเดิมให้"],
  ["เลขที่เอกสารรันอย่างไร", "แยกตามประเภทและปี พ.ศ. เช่น QT-2569-0001, INV-2569-0001, RC-2569-0001, DN-2569-0001 และไม่ข้ามเลข"],
  ["หัก ณ ที่จ่ายคิดจากยอดไหน", "คิดจากยอดก่อน VAT ระบบแสดงทั้งยอดรวมและยอดชำระสุทธิที่ลูกค้าต้องโอน"],
  [
    "ออกใบกำกับภาษีได้ไหม",
    "ได้ถ้าจดทะเบียน VAT แล้ว: เปิด “จดทะเบียนภาษีมูลค่าเพิ่มแล้ว” ในตั้งค่า เอกสารใหม่จะคิด VAT 7% และเมื่อบันทึกรับเงินของใบแจ้งหนี้ที่มี VAT ใบเสร็จจะออกเป็น “ใบเสร็จรับเงิน/ใบกำกับภาษี” (งานบริการเกิดภาษีเมื่อได้รับเงิน) ผู้ที่ยังไม่จด VAT ออกใบกำกับภาษีไม่ได้",
  ],
  ["ลบลูกค้าที่มีเอกสารแล้วได้ไหม", "ไม่ได้ เพื่อไม่ให้ประวัติเอกสารหาย เปลี่ยนสถานะเป็นไม่ active แทน"],
];

export default function GuidePage() {
  return (
    <div>
      <PageHeader title="คู่มือการใช้งาน" description="ตั้งแต่เสนอราคาจนเก็บเงินได้ ทำตามลำดับนี้ได้เลย" />

      {/* The whole flow at a glance. */}
      <ol className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FLOW.map((f, i) => (
          <li key={f.label}>
            <Card className="flex h-full items-start gap-2.5 p-3 sm:gap-3 sm:p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{f.label}</p>
                <p className="text-sm text-stone-500">{f.note}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
        <nav aria-label="สารบัญ" className="mb-6 lg:mb-0">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:sticky lg:top-8 lg:flex-col lg:gap-0.5 lg:overflow-visible">
            {[...SECTIONS.map((s) => ({ id: s.id, title: s.title })), { id: "status", title: "สถานะเอกสาร" }, { id: "faq", title: "คำถามพบบ่อย" }].map(
              (s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="shrink-0 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 hover:text-brand-700 lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-3 lg:py-1.5 lg:hover:bg-stone-100"
                >
                  {s.title}
                </a>
              ),
            )}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {SECTIONS.map((s) => (
            <Card key={s.id} className="p-5 sm:p-6">
              <section id={s.id} className="scroll-mt-24">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{s.title}</h2>
                    <p className="mt-0.5 text-sm text-stone-500">{s.intro}</p>
                  </div>
                  {s.href && (
                    <Link href={s.href.path} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                      {s.href.label} →
                    </Link>
                  )}
                </div>
                <ol className="space-y-2.5">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {s.tips && (
                  <ul className="mt-4 space-y-1.5 rounded-lg bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                    {s.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                )}
              </section>
            </Card>
          ))}

          <Card className="p-5 sm:p-6">
            <section id="status" className="scroll-mt-24">
              <h2 className="mb-4 text-lg font-semibold">สถานะเอกสาร</h2>
              <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_1fr]">
                {STATUSES.map(([name, meaning]) => (
                  <div key={name} className="contents">
                    <dt className="font-medium">{name}</dt>
                    <dd className="mb-1.5 text-stone-600 sm:mb-0">{meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </Card>

          <Card className="p-5 sm:p-6">
            <section id="faq" className="scroll-mt-24">
              <h2 className="mb-2 text-lg font-semibold">คำถามพบบ่อย</h2>
              <div className="divide-y divide-stone-100">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                      {q}
                      <span aria-hidden="true" className="text-stone-400 transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </Card>
        </div>
      </div>
    </div>
  );
}
