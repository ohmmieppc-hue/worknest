import type { Metadata } from "next";
import Link from "next/link";
import { bahtText } from "@/lib/bahttext";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "WorkNest — ใบเสนอราคาและเก็บเงินสำหรับฟรีแลนซ์" },
  description:
    "ใบเสนอราคา ใบแจ้งหนี้ ใบส่งมอบงาน และใบเสร็จภาษาไทย ลูกค้าตอบรับผ่านลิงก์ แบ่งชำระเป็นงวด QR พร้อมเพย์ และคำนวณหัก ณ ที่จ่ายให้อัตโนมัติ สำหรับฟรีแลนซ์ไทย",
};

const primaryCta =
  "inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700";
const secondaryCta =
  "inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50";

export default function LandingPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <main>
        <Hero />
        <Problems />
        <Workflow />
        <ThaiFeatures />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Work<span className="text-brand-600">Nest</span>
        </Link>
        <nav className="hidden gap-5 text-sm text-stone-600 md:flex">
          <a href="#how" className="hover:text-stone-900">
            ทำงานอย่างไร
          </a>
          <a href="#features" className="hover:text-stone-900">
            ฟีเจอร์
          </a>
          <a href="#faq" className="hover:text-stone-900">
            คำถามที่พบบ่อย
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
            เข้าสู่ระบบ
          </Link>
          <Link href="/login?mode=signup" className={`${primaryCta} px-4 py-2`}>
            สมัครใช้งาน
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-stone-200 bg-[#f7f7f5]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            สำหรับฟรีแลนซ์และสตูดิโอเล็กในไทย
          </p>
          {/* Thai has no spaces between words, so keep phrases from splitting mid-word. */}
          <h1 className="text-[2rem] leading-tight font-semibold tracking-tight sm:text-5xl sm:leading-tight">
            <span className="inline-block">ใบเสนอราคา</span>
            <span className="inline-block">ที่ดูมืออาชีพ</span>
            <br />
            <span className="text-brand-600">
              <span className="inline-block">เก็บเงินครบ</span>{" "}
              <span className="inline-block">ไม่ต้องทวงซ้ำ</span>
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
            ตั้งแต่ใบเสนอราคา ใบแจ้งหนี้ ใบส่งมอบงาน จนถึงใบเสร็จ ส่งเป็นลิงก์ให้ลูกค้ากดตอบรับและตรวจรับงานได้เอง
            แบ่งชำระเป็นงวด มี QR พร้อมเพย์ และคำนวณหัก ณ ที่จ่ายให้ครบ
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className={primaryCta}>
              เริ่มสร้างใบเสนอราคา
            </Link>
            <a href="#how" className={secondaryCta}>
              ดูขั้นตอนการทำงาน
            </a>
          </div>
        </div>
        <QuotationPreview />
      </div>
    </section>
  );
}

// A static sample document, rendered with the same helpers the app uses.
function QuotationPreview() {
  const items = [
    { description: "ออกแบบ UI เว็บไซต์ 5 หน้า", qty: 1, price: 18000 },
    { description: "พัฒนาเว็บไซต์ (Next.js)", qty: 1, price: 24000 },
    { description: "ดูแลหลังส่งมอบ", qty: 3, price: 1500 },
  ];
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const wht = Math.round(subtotal * 3) / 100;
  const payable = subtotal - wht;
  const schedule = [
    { label: "มัดจำก่อนเริ่มงาน", percent: 40 },
    { label: "ส่งงานรอบแรก", percent: 40 },
    { label: "ส่งมอบงาน", percent: 20 },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="absolute -inset-4 -z-0 rotate-2 rounded-2xl bg-brand-100/60" />
      <div className="relative rounded-2xl border border-stone-200 bg-white p-6 text-sm shadow-xl shadow-stone-300/30 sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <p className="text-xs text-stone-500">ผู้ให้บริการ</p>
            <p className="font-semibold">Somchai Studio</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">ใบเสนอราคา</p>
            <p className="text-xs text-stone-500">QT-2569-0012</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-stone-500">ลูกค้า</p>
        <p className="font-medium">บริษัท เอบีซี จำกัด (สำนักงานใหญ่)</p>

        <table className="mt-4 w-full">
          <tbody className="divide-y divide-stone-100">
            {items.map((i) => (
              <tr key={i.description}>
                <td className="py-2 pr-3">{i.description}</td>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(i.qty * i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3">
          <div className="flex justify-between font-semibold">
            <dt>ยอดรวมทั้งสิ้น</dt>
            <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-stone-500">
            <dt>หัก ณ ที่จ่าย 3%</dt>
            <dd className="tabular-nums">−{formatMoney(wht)}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-brand-50 px-3 py-2 text-base font-semibold text-brand-700">
            <dt>ยอดชำระสุทธิ</dt>
            <dd className="tabular-nums">{formatMoney(payable)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-right text-xs text-stone-500">({bahtText(payable)})</p>

        <div className="mt-4 border-t border-stone-200 pt-3">
          <p className="mb-1.5 text-xs text-stone-500">งวดชำระ</p>
          <ul className="space-y-1 text-xs">
            {schedule.map((s) => (
              <li key={s.label} className="flex justify-between gap-3">
                <span>
                  {s.label} <span className="text-stone-400">{s.percent}%</span>
                </span>
                <span className="tabular-nums">{formatMoney((subtotal * s.percent) / 100)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">แก้ไขได้ 2 รอบ</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">ลูกค้าตอบรับผ่านลิงก์แล้ว</span>
        </div>
      </div>
    </div>
  );
}

function Problems() {
  const problems = [
    {
      title: "ลูกค้าโอนมาไม่ตรงยอด",
      body: "บริษัทหัก ณ ที่จ่าย 3% แต่ใบเสนอราคาไม่ได้บอก ต้องมานั่งไล่ยอดทีหลัง WorkNest แสดงยอดรวม ยอดหัก และยอดที่ต้องโอนจริงให้ชัดตั้งแต่แรก",
    },
    {
      title: "งานงอก แก้ไม่จบ",
      body: "ระบุขอบเขตงาน สิ่งที่ไม่รวม และจำนวนรอบแก้ไขไว้ในใบเสนอราคา เมื่อลูกค้าตอบรับแล้ว ทั้งสองฝ่ายมีข้อตกลงเดียวกันให้อ้างอิง",
    },
    {
      title: "ส่งงานแล้ว ลูกค้าเงียบ",
      body: "ส่งใบส่งมอบงานเป็นลิงก์ ลูกค้ากดตรวจรับหรือขอแก้ไขได้เลย ระบบเก็บชื่อและเวลาไว้เป็นหลักฐาน และนับรอบแก้ไขให้เทียบกับที่ตกลง",
    },
    {
      title: "เอกสารกระจัดกระจาย",
      body: "ใบเสนอราคาอยู่ใน Word ลูกค้าอยู่ในแชต เลขที่เอกสารจำเอง WorkNest รวมลูกค้าและเอกสารไว้ที่เดียว พร้อมเลขที่ต่อเนื่องที่ไม่ข้ามและไม่ซ้ำ",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
        เรื่องที่ฟรีแลนซ์เจอทุกเดือน แต่ไม่ควรต้องเสียเวลาด้วย
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {problems.map((p, i) => (
          <div key={p.title} className="rounded-xl border border-stone-200 p-6">
            <p className="text-sm font-semibold text-brand-600">0{i + 1}</p>
            <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 leading-relaxed text-stone-600">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const steps: { title: string; body: string; soon?: boolean }[] = [
    { title: "สร้างใบเสนอราคา", body: "ใส่รายการ ขอบเขตงาน รอบแก้ไข และงวดชำระ เช่น 40/40/20 ระบบคำนวณยอดให้ทันที" },
    { title: "ลูกค้าตอบรับผ่านลิงก์", body: "ลูกค้าไม่ต้องสมัคร เปิดลิงก์แล้วกดตอบรับ ระบบเก็บชื่อ เวลา และ IP เป็นหลักฐาน" },
    { title: "ใบแจ้งหนี้ทีละงวด", body: "กดออกใบแจ้งหนี้ตามงวดที่ตกลง ลูกค้าสแกน QR พร้อมเพย์ด้วยยอดที่ถูกต้อง" },
    { title: "ส่งมอบงาน", body: "ลูกค้ากดตรวจรับหรือขอแก้ไข คำขอแก้ไขนับเป็นรอบแก้ไขให้อัตโนมัติ" },
    { title: "รับเงินและใบเสร็จ", body: "บันทึกรับเงิน ออกใบเสร็จทันที และติดตามว่าได้ 50 ทวิ ครบหรือยัง" },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-stone-200 bg-[#f7f7f5]">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">จากคุยงาน ถึงได้เงิน</h2>
        <p className="mt-2 max-w-2xl text-stone-600">ทุกขั้นต่อกันในคลิกเดียว ไม่ต้องกรอกข้อมูลลูกค้าซ้ำ และระบบบอกเสมอว่าขั้นต่อไปคืออะไร</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-stone-200 bg-white p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">
                {s.title}
                {s.soon && (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-medium text-amber-800">
                    เร็ว ๆ นี้
                  </span>
                )}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ThaiFeatures() {
  const features: { title: string; body: string; soon?: boolean }[] = [
    { title: "หัก ณ ที่จ่ายอัตโนมัติ", body: "คิดจากยอดก่อน VAT ตามหลักที่ถูกต้อง และแสดงยอดชำระสุทธิบนเอกสาร" },
    { title: "บาทถ้วน และ พ.ศ.", body: "เขียนจำนวนเงินเป็นตัวอักษรภาษาไทย และแสดงวันที่แบบพุทธศักราช" },
    { title: "เลขที่เอกสารต่อเนื่อง", body: "เช่น QT-2569-0001 แยกตามประเภทเอกสารและปี ไม่ข้าม ไม่ซ้ำ แม้กดพร้อมกัน" },
    { title: "เอกสารแก้ย้อนหลังไม่ได้", body: "เก็บข้อมูลลูกค้า ณ วันที่ออกไว้ แก้ข้อมูลลูกค้าภายหลังก็ไม่กระทบใบเก่า" },
    { title: "QR พร้อมเพย์บนใบแจ้งหนี้", body: "ลูกค้าสแกนจ่ายได้ทันทีด้วยยอดที่ต้องโอนจริง หลังหัก ณ ที่จ่ายแล้ว" },
    { title: "ติดตามใบ 50 ทวิ", body: "รู้ว่าลูกค้ารายไหนยังไม่ส่งหนังสือรับรองหัก ณ ที่จ่าย ก่อนถึงหน้ายื่นภาษี" },
    { title: "ใบกำกับภาษีสำหรับผู้จด VAT", body: "คิด VAT 7% และออกใบเสร็จรับเงิน/ใบกำกับภาษีเมื่อได้รับเงิน ตามหลักงานบริการ" },
    { title: "PDF ฟอนต์ไทยพร้อมโลโก้", body: "ดาวน์โหลดหรือพิมพ์เป็น A4 ได้ทุกเอกสาร ตัดคำภาษาไทยถูกต้อง" },
    { title: "ใช้บนมือถือได้", body: "เช็กยอดค้างรับ บันทึกรับเงิน และส่งลิงก์ให้ลูกค้าได้จากโทรศัพท์" },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">ออกแบบมาสำหรับเอกสารแบบไทยโดยเฉพาะ</h2>
      <p className="mt-2 max-w-2xl text-stone-600">ไม่ใช่โปรแกรมต่างประเทศที่แปลเป็นภาษาไทย</p>
      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="border-l-2 border-brand-500 pl-4">
            <h3 className="font-semibold">
              {f.title}
              {f.soon && (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-medium text-amber-800">
                  เร็ว ๆ นี้
                </span>
              )}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    {
      q: "ยังไม่ได้จด VAT ใช้ได้ไหม",
      a: "ได้ WorkNest ตั้งต้นสำหรับผู้ที่ยังไม่จดภาษีมูลค่าเพิ่ม และจะไม่ให้คิด VAT บนเอกสารจนกว่าคุณจะตั้งค่าว่าจดแล้ว",
    },
    {
      q: "ออกใบกำกับภาษีได้ไหม",
      a: "ได้สำหรับผู้ที่จด VAT แล้ว เปิดในตั้งค่า แล้วใบเสร็จของใบแจ้งหนี้ที่มี VAT จะออกเป็นใบเสร็จรับเงิน/ใบกำกับภาษีเมื่อได้รับเงิน ผู้ที่ยังไม่จด VAT ออกใบกำกับภาษีไม่ได้ตามกฎหมาย",
    },
    {
      q: "ลูกค้าต้องสมัครสมาชิกไหม",
      a: "ไม่ต้อง ลูกค้าเปิดลิงก์ที่คุณส่งให้ แล้วดูเอกสาร ดาวน์โหลด PDF ตอบรับใบเสนอราคา หรือตรวจรับงานได้เลย ลิงก์มีอายุ 90 วันและเพิกถอนได้",
    },
    {
      q: "ลูกค้าแบ่งจ่ายหลายงวดไม่เท่ากันได้ไหม",
      a: "ได้ ตั้งงวดชำระในใบเสนอราคาเป็นเปอร์เซ็นต์หรือจำนวนเงิน เช่น 40/40/20 ลูกค้าเห็นตั้งแต่ก่อนตอบรับ แล้วคุณออกใบแจ้งหนี้ทีละงวดได้ในคลิกเดียว",
    },
    {
      q: "หัก ณ ที่จ่ายคิดอย่างไร",
      a: "ระบบคิดจากยอดหลังหักส่วนลดและก่อน VAT ตามอัตราที่คุณกำหนด ลูกค้านิติบุคคลจะตั้งค่าเริ่มต้นไว้ที่ 3% ซึ่งเป็นอัตราทั่วไปของค่าบริการ และแก้ได้ทุกใบ",
    },
    {
      q: "ข้อมูลของฉันปลอดภัยแค่ไหน",
      a: "ข้อมูลแต่ละบัญชีถูกแยกด้วย Row Level Security ในฐานข้อมูล ผู้ใช้อื่นมองไม่เห็นลูกค้าหรือเอกสารของคุณ และเอกสารที่ออกแล้วถูกล็อกไม่ให้แก้ย้อนหลัง",
    },
  ];
  return (
    <section id="faq" className="scroll-mt-20 border-t border-stone-200 bg-[#f7f7f5]">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">คำถามที่พบบ่อย</h2>
        <div className="mt-8 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-stone-400 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="rounded-2xl bg-brand-700 px-6 py-14 text-center text-white sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">ส่งใบเสนอราคาใบต่อไปจาก WorkNest</h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">ตั้งค่าครั้งเดียว แล้วสร้างใบเสนอราคาได้ภายในไม่กี่นาที ไปจนถึงเก็บเงินครบทุกงวด</p>
        <Link
          href="/login?mode=signup"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          สมัครใช้งาน
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-stone-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-stone-500">
        <p>
          Work<span className="text-brand-600">Nest</span> · ระบบจัดการงานสำหรับฟรีแลนซ์ไทย
        </p>
        <Link href="/login" className="hover:text-stone-800">
          เข้าสู่ระบบ
        </Link>
      </div>
    </footer>
  );
}
