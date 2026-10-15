-- =============================================================================
-- WorkNest demo data — 3 clients, 3 quotations, 3 invoices, 2 receipts.
-- Goes into the first workspace. Every demo client has source = 'demo' so
-- db/clear-demo.sql can remove it all without touching real data.
-- Documents go through save_document_draft + issue, so numbering, totals,
-- snapshots and receipts are produced by the same rules as the app.
-- =============================================================================

create or replace function pg_temp.demo_doc(
  p_ws uuid, p_type document_type, p_client uuid, p_source uuid, p_issue date,
  p_valid date, p_due date, p_wht numeric, p_title text, p_scope text, p_terms text, p_items jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into documents (workspace_id, type, client_id, source_document_id, issue_date, wht_rate)
  values (p_ws, p_type, p_client, p_source, p_issue, p_wht)
  returning id into v_id;

  perform save_document_draft(v_id, jsonb_build_object(
    'client_id', p_client, 'title', p_title, 'issue_date', p_issue::text,
    'valid_until', coalesce(p_valid::text, ''), 'due_date', coalesce(p_due::text, ''),
    'wht_rate', p_wht::text, 'scope_of_work', coalesce(p_scope, ''), 'payment_terms', coalesce(p_terms, '')
  ), p_items);

  update documents set status = 'issued' where id = v_id;
  return v_id;
end $$;

create or replace function pg_temp.demo_event(p_doc uuid, p_event text, p_actor event_actor, p_name text, p_at timestamptz)
returns void
language sql as $$
  insert into document_events (workspace_id, document_id, event, actor, actor_name, created_at)
  select workspace_id, id, p_event, p_actor, p_name, p_at from documents where id = p_doc;
$$;

do $$
declare
  v_ws     uuid := (select id from workspaces order by created_at limit 1);
  d        date := current_date;
  c_green  uuid;
  c_malee  uuid;
  c_bright uuid;
  q1 uuid; q2 uuid; q3 uuid;
  i1 uuid; i2 uuid; i3 uuid;
  p1 uuid; p2 uuid;
begin
  if v_ws is null then
    raise exception 'no workspace — sign up and finish onboarding first';
  end if;
  if exists (select 1 from clients where workspace_id = v_ws and source = 'demo') then
    raise exception 'demo data already present — run db/clear-demo.sql first';
  end if;

  -- Clients ------------------------------------------------------------------
  insert into clients (workspace_id, kind, name, tax_id, branch_code, address, email, phone, status, default_wht_rate, source, notes)
  values (v_ws, 'company', 'บริษัท กรีนลีฟ คาเฟ่ จำกัด', '0105564012345', '00000',
          '88/9 ซอยอารีย์ 2 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400',
          'account@greenleaf-cafe.example', '02-123-4567', 'active', 3, 'demo', 'ข้อมูลตัวอย่าง')
  returning id into c_green;

  insert into clients (workspace_id, kind, name, address, email, phone, status, default_wht_rate, source, notes)
  values (v_ws, 'individual', 'คุณมาลี ศรีสุข', '45 หมู่ 3 ต.หนองแก อ.หัวหิน จ.ประจวบคีรีขันธ์ 77110',
          'malee.s@example.com', '081-234-5678', 'active', 0, 'demo', 'ข้อมูลตัวอย่าง')
  returning id into c_malee;

  insert into clients (workspace_id, kind, name, tax_id, branch_code, address, email, phone, status, default_wht_rate, source, notes)
  values (v_ws, 'company', 'บริษัท ไบรท์เทค โซลูชั่นส์ จำกัด', '0105563098765', '00001',
          '199 อาคารไบรท์ทาวเวอร์ ชั้น 12 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400',
          'procurement@brighttech.example', '02-987-6543', 'lead', 3, 'demo', 'ข้อมูลตัวอย่าง')
  returning id into c_bright;

  -- Created in issue-date order so document numbers run chronologically.

  -- Malee: wedding card invoice, overdue and only partly paid (day -40)
  i3 := pg_temp.demo_doc(v_ws, 'invoice', c_malee, null, d - 40, null, d - 10, 0,
    'ออกแบบการ์ดแต่งงานและป้ายต้อนรับ', null, 'ชำระภายใน 30 วัน',
    '[{"description":"ออกแบบการ์ดแต่งงาน 2 ด้าน","quantity":"1","unit":"แบบ","unit_price":"4500"},
      {"description":"ออกแบบป้ายต้อนรับ ขนาด 60x90 ซม.","quantity":"1","unit":"แบบ","unit_price":"3500"}]');
  update documents set status = 'sent' where id = i3;
  perform pg_temp.demo_event(i3, 'issued', 'owner', null, (d - 40) + time '13:30');
  insert into payments (workspace_id, invoice_id, received_on, cash_amount, wht_amount, method, reference, wht_cert_status)
  values (v_ws, i3, d - 33, 3000, 0, 'promptpay', 'โอนพร้อมเพย์', 'not_applicable') returning id into p2;
  perform issue_receipt_for_payment(p2);

  -- Green Leaf: logo + menu quotation, accepted by the client (day -30)
  q1 := pg_temp.demo_doc(v_ws, 'quotation', c_green, null, d - 30, d - 30 + 30, null, 3,
    'ออกแบบโลโก้และเมนูร้านกาแฟ',
    'ออกแบบโลโก้ 3 แบบให้เลือก พร้อมไฟล์ AI/PNG/SVG' || chr(10) || 'ออกแบบเมนู 2 หน้า (ไทย/อังกฤษ) พร้อมไฟล์สั่งพิมพ์',
    'มัดจำ 50% ก่อนเริ่มงาน ส่วนที่เหลือเมื่อส่งมอบไฟล์',
    '[{"description":"ออกแบบโลโก้ร้าน 3 แบบ พร้อมไฟล์ต้นฉบับ","quantity":"1","unit":"งาน","unit_price":"20000"},
      {"description":"ออกแบบเมนู 2 หน้า ภาษาไทย/อังกฤษ","quantity":"2","unit":"หน้า","unit_price":"6500"},
      {"description":"คู่มือการใช้โลโก้ (Brand guideline) ฉบับย่อ","quantity":"1","unit":"เล่ม","unit_price":"2000"}]');
  update documents set status = 'sent' where id = q1;
  update documents set status = 'accepted' where id = q1;
  perform pg_temp.demo_event(q1, 'issued', 'owner', null, (d - 30) + time '10:15');
  perform pg_temp.demo_event(q1, 'sent', 'owner', null, (d - 30) + time '10:16');
  perform pg_temp.demo_event(q1, 'viewed', 'client', null, (d - 29) + time '09:02');
  perform pg_temp.demo_event(q1, 'accepted', 'client', 'คุณนภา (เจ้าของร้าน)', (d - 28) + time '14:40');

  -- Green Leaf: 50% deposit invoice, paid with 3% withheld; 50 Tawi not yet received (day -27)
  i1 := pg_temp.demo_doc(v_ws, 'invoice', c_green, q1, d - 27, null, d + 3, 3,
    'ออกแบบโลโก้และเมนูร้านกาแฟ', null, null,
    '[{"description":"ค่าบริการงวด 50% (มัดจำ) ตามใบเสนอราคา","quantity":"1","unit":"งวด","unit_price":"17500"}]');
  perform pg_temp.demo_event(i1, 'issued', 'owner', null, (d - 27) + time '11:00');
  insert into payments (workspace_id, invoice_id, received_on, cash_amount, wht_amount, method, reference, wht_cert_status, income_type)
  values (v_ws, i1, d - 6, 16975, 525, 'transfer', 'KBank 22xx', 'pending', '40_2') returning id into p1;
  perform issue_receipt_for_payment(p1);

  -- BrightTech (lead): website quotation sent, expires in 3 days (day -11)
  q3 := pg_temp.demo_doc(v_ws, 'quotation', c_bright, null, d - 11, d + 3, null, 3,
    'พัฒนาเว็บไซต์องค์กร',
    'ออกแบบและพัฒนาเว็บไซต์ 8 หน้า รองรับภาษาไทย/อังกฤษ ระบบจัดการเนื้อหา (CMS) และติดตั้งบนเซิร์ฟเวอร์ของผู้ว่าจ้าง',
    'แบ่งชำระ 3 งวด: 40% / 40% / 20%',
    '[{"description":"ออกแบบ UX/UI 8 หน้า (Desktop + Mobile)","quantity":"1","unit":"งาน","unit_price":"32000"},
      {"description":"พัฒนาเว็บไซต์พร้อมระบบ CMS","quantity":"1","unit":"งาน","unit_price":"45000"},
      {"description":"ติดตั้งและอบรมการใช้งาน","quantity":"1","unit":"ครั้ง","unit_price":"8000"}]');
  update documents set status = 'sent' where id = q3;
  perform pg_temp.demo_event(q3, 'issued', 'owner', null, (d - 11) + time '15:00');
  perform pg_temp.demo_event(q3, 'sent', 'owner', null, (d - 11) + time '15:05');

  -- Malee: album quotation the client has opened (day -4)
  q2 := pg_temp.demo_doc(v_ws, 'quotation', c_malee, null, d - 4, d - 4 + 14, null, 0,
    'ออกแบบอัลบั้มภาพงานแต่งงาน',
    'จัดหน้าอัลบั้ม 20 หน้า (40 ภาพ) แก้ไขได้ 2 รอบ ส่งไฟล์พร้อมพิมพ์',
    'ชำระเต็มจำนวนเมื่อส่งมอบไฟล์',
    '[{"description":"จัดหน้าอัลบั้มภาพ 20 หน้า","quantity":"20","unit":"หน้า","unit_price":"450"},
      {"description":"รีทัชภาพเพิ่มเติม","quantity":"10","unit":"ภาพ","unit_price":"150"}]');
  update documents set status = 'sent' where id = q2;
  update documents set status = 'viewed' where id = q2;
  perform pg_temp.demo_event(q2, 'issued', 'owner', null, (d - 4) + time '09:45');
  perform pg_temp.demo_event(q2, 'sent', 'owner', null, (d - 4) + time '09:46');
  perform pg_temp.demo_event(q2, 'viewed', 'client', null, (d - 1) + time '20:12');

  -- Green Leaf: remaining 50% invoice, not yet due (day -2)
  i2 := pg_temp.demo_doc(v_ws, 'invoice', c_green, q1, d - 2, null, d + 28, 3,
    'ออกแบบโลโก้และเมนูร้านกาแฟ', null, 'ชำระภายใน 30 วันหลังส่งมอบงาน',
    '[{"description":"ค่าบริการงวด 50% (ส่วนที่เหลือ) ตามใบเสนอราคา","quantity":"1","unit":"งวด","unit_price":"17500"}]');
  update documents set status = 'sent' where id = i2;
  perform pg_temp.demo_event(i2, 'issued', 'owner', null, (d - 2) + time '16:20');
  perform pg_temp.demo_event(i2, 'sent', 'owner', null, (d - 2) + time '16:21');
end $$;
