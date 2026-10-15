// Maps database / auth errors raised by db/schema.sql to Thai messages.

const RULES: [RegExp, string][] = [
  [/without line items/, "ต้องมีรายการอย่างน้อย 1 รายการก่อนออกเอกสาร"],
  [/void it and issue a new one|void it instead/, "เอกสารนี้ออกแล้ว แก้ไขหรือลบไม่ได้ ต้องยกเลิกแล้วออกฉบับใหม่"],
  [/invalid status transition/, "เปลี่ยนสถานะเอกสารแบบนี้ไม่ได้"],
  [/VAT-registered/, "คิด VAT ได้เฉพาะเมื่อจดทะเบียนภาษีมูลค่าเพิ่มแล้ว"],
  [/documents_discount_le_subtotal/, "ส่วนลดท้ายบิลมากกว่ายอดรวม"],
  [/document_items_check|discount_amount_check/, "ส่วนลดของรายการมากกว่าราคา"],
  [/clients_tax_id_unique/, "มีลูกค้าที่ใช้เลขผู้เสียภาษีและสาขานี้อยู่แล้ว"],
  [/tax_id_check/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"],
  [/branch_code_check/, "รหัสสาขาต้องเป็นตัวเลข 5 หลัก (สำนักงานใหญ่ = 00000)"],
  [/promptpay_id_check/, "พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลข 13 หลัก"],
  [/violates foreign key constraint .*documents_client/, "ลูกค้ารายนี้มีเอกสารอยู่ ลบไม่ได้"],
  [/Invalid login credentials/, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
  [/Email not confirmed/, "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ยืนยันในอีเมลก่อน"],
  [/User already registered/, "อีเมลนี้สมัครไว้แล้ว"],
  [/Email address .* is invalid/, "ใช้อีเมลนี้ไม่ได้ กรุณาใช้อีเมลจริง"],
  [/Error sending confirmation email/, "ส่งอีเมลยืนยันไม่สำเร็จ ลองใหม่อีกครั้งในภายหลัง"],
  [/email rate limit exceeded/i, "ขออีเมลยืนยันบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
  [/Password should be at least/, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"],
];

export function toThaiError(error: { message?: string } | string | null | undefined) {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  for (const [pattern, thai] of RULES) {
    if (pattern.test(message)) return thai;
  }
  return `เกิดข้อผิดพลาด: ${message || "ไม่ทราบสาเหตุ"}`;
}
