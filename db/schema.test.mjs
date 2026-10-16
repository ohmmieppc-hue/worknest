import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const schemaPath = process.argv[2];
const db = new PGlite();

const stub = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon; create role authenticated;
`;

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const expectError = async (name, sql, params, pattern) => {
  try {
    await db.query(sql, params);
    ok(name, false, '(no error raised)');
  } catch (e) {
    ok(name, pattern.test(e.message), `-> ${e.message}`);
  }
};

await db.exec(stub);
await db.exec(readFileSync(schemaPath, 'utf8'));
console.log('schema loaded');

const user = '11111111-1111-1111-1111-111111111111';
await db.query(`insert into auth.users values ($1)`, [user]);
await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);

const { ws } = await one(`select create_workspace('Ohm Studio', 'นายโอม ฟรีแลนซ์') as ws`);
await db.query(`update workspaces set tax_id='1234567890123', promptpay_id='0812345678' where id=$1`, [ws]);
ok('workspace created with owner', (await one(`select count(*)::int c from workspace_members where workspace_id=$1`, [ws])).c === 1);

const { id: client } = await one(
  `insert into clients (workspace_id, kind, name, tax_id, default_wht_rate) values ($1,'company','บริษัท เอ จำกัด','0105551234567',3) returning id`, [ws]);
const { id: project } = await one(
  `insert into projects (workspace_id, client_id, name) values ($1,$2,'เว็บไซต์บริษัท') returning id`, [ws, client]);

// Quotation draft with items
const { id: qt } = await one(
  `insert into documents (workspace_id, type, client_id, project_id, wht_rate, discount_amount, valid_until)
   values ($1,'quotation',$2,$3,3,0,current_date+30) returning id`, [ws, client, project]);
await db.query(`insert into document_items (workspace_id, document_id, description, quantity, unit_price) values
  ($1,$2,'ออกแบบ UI',1,20000), ($1,$2,'พัฒนาเว็บไซต์',2,15000.50)`, [ws, qt]);
let d = await one(`select * from documents where id=$1`, [qt]);
ok('subtotal computed from items', d.subtotal === '50001.00', d.subtotal);
ok('wht 3% computed', d.wht_amount === '1500.03', d.wht_amount);
ok('amount_payable = total - wht', d.amount_payable === '48500.97', d.amount_payable);

await db.query(`update documents set discount_amount=1 where id=$1`, [qt]);
d = await one(`select * from documents where id=$1`, [qt]);
ok('discount recomputes totals', d.total === '50000.00' && d.wht_amount === '1500.00', `${d.total}/${d.wht_amount}`);

await db.query(`update documents set subtotal=1 where id=$1`, [qt]);
d = await one(`select subtotal from documents where id=$1`, [qt]);
ok('subtotal not spoofable', d.subtotal === '50001.00', d.subtotal);

await db.query(`insert into payment_schedules (workspace_id, quotation_id, project_id, label, percent, due_rule) values
  ($1,$2,$3,'มัดจำ 50%',50,'on_accept'), ($1,$2,$3,'ส่วนที่เหลือ 50%',50,'on_accept')`, [ws, qt, project]);

await expectError('VAT blocked for non-VAT workspace',
  `update documents set vat_rate=7, status='issued' where id=$1`, [qt], /VAT/);

// Issue
await db.query(`update documents set status='issued' where id=$1`, [qt]);
d = await one(`select * from documents where id=$1`, [qt]);
const beYear = new Date().getFullYear() + 543;
ok('number assigned on issue', d.number === `QT-${beYear}-0001`, d.number);
ok('snapshots filled', d.seller_snapshot?.legal_name === 'นายโอม ฟรีแลนซ์' && d.buyer_snapshot?.name === 'บริษัท เอ จำกัด');

await expectError('issued document is immutable',
  `update documents set notes='edit' where id=$1`, [qt], /void it/);
await expectError('issued items are immutable',
  `update document_items set unit_price=1 where document_id=$1`, [qt], /cannot be changed/);
await expectError('issued schedule is frozen',
  `update payment_schedules set label='x' where quotation_id=$1`, [qt], /cannot be changed/);
await expectError('issued document cannot be deleted',
  `delete from documents where id=$1`, [qt], /void it instead/);
await expectError('invalid transition rejected',
  `update documents set status='draft' where id=$1`, [qt], /invalid status transition|void it/);

await db.query(`update documents set status='sent' where id=$1`, [qt]);
await db.query(`update documents set status='accepted' where id=$1`, [qt]);
ok('accept -> project confirmed', (await one(`select status from projects where id=$1`, [project])).status === 'confirmed');
ok('accept -> client active', (await one(`select status from clients where id=$1`, [client])).status === 'active');

// Invoice for deposit
const { id: inv } = await one(
  `insert into documents (workspace_id, type, client_id, project_id, source_document_id, wht_rate, due_date)
   values ($1,'invoice',$2,$3,$4,3,current_date-1) returning id`, [ws, client, project, qt]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'มัดจำ 50%',25000)`, [ws, inv]);
await expectError('no payment on draft invoice',
  `insert into payments (workspace_id, invoice_id, cash_amount) values ($1,$2,100)`, [ws, inv], /draft/);
await db.query(`update documents set status='issued' where id=$1`, [inv]);
d = await one(`select number from documents where id=$1`, [inv]);
ok('invoice numbering separate', d.number === `INV-${beYear}-0001`, d.number);
await db.query(`update payment_schedules set invoice_id=$1 where quotation_id=$2 and label='มัดจำ 50%'`, [inv, qt]);
ok('schedule can link invoice after issue', true);

let b = await one(`select * from invoice_balances where invoice_id=$1`, [inv]);
ok('unpaid + overdue', b.payment_status === 'unpaid' && b.is_overdue === true);

await expectError('wht requires cert status',
  `insert into payments (workspace_id, invoice_id, cash_amount, wht_amount) values ($1,$2,10000,300)`, [ws, inv], /check constraint/);
await db.query(`insert into payments (workspace_id, invoice_id, cash_amount, wht_amount, wht_cert_status, income_type)
  values ($1,$2,10000,300,'pending','40_2')`, [ws, inv]);
b = await one(`select * from invoice_balances where invoice_id=$1`, [inv]);
ok('partial payment', b.payment_status === 'partially_paid' && b.outstanding === '14700.00', `${b.payment_status} ${b.outstanding}`);

await expectError('overpayment rejected',
  `insert into payments (workspace_id, invoice_id, cash_amount) values ($1,$2,20000)`, [ws, inv], /exceeds/);
await db.query(`insert into payments (workspace_id, invoice_id, cash_amount, wht_amount, wht_cert_status) values ($1,$2,14250,450,'pending')`, [ws, inv]);
b = await one(`select * from invoice_balances where invoice_id=$1`, [inv]);
ok('fully paid (cash + wht = total)', b.payment_status === 'paid' && b.outstanding === '0.00' && b.is_overdue === false,
  `${b.payment_status} ${b.outstanding} cash=${b.cash_received} wht=${b.wht_withheld}`);

await expectError('cannot void invoice with payments',
  `update documents set status='void', void_reason='x' where id=$1`, [inv], /recorded payments/);

const s = await one(`select * from dashboard_summary($1)`, [ws]);
ok('dashboard summary runs', Number(s.outstanding_total) === 0, JSON.stringify(s));

// Draft deletion + events append-only
const { id: dn } = await one(`insert into documents (workspace_id, type, client_id) values ($1,'delivery_note',$2) returning id`, [ws, client]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'ไฟล์ Figma',0)`, [ws, dn]);
await db.query(`insert into document_events (workspace_id, document_id, event, actor) values ($1,$2,'created','owner')`, [ws, dn]);
await expectError('events append-only (update)', `update document_events set event='x'`, [], /append-only/);
await expectError('events append-only (delete)', `delete from document_events`, [], /append-only/);
await db.query(`delete from documents where id=$1`, [dn]);
ok('draft deletable (cascades items/events)', (await one(`select count(*)::int c from documents where id=$1`, [dn])).c === 0);

// Cross-workspace reference blocked by composite FK
const { id: ws2 } = await one(`insert into workspaces (display_name, legal_name) values ('Other','Other') returning id`);
await expectError('cross-workspace client reference blocked',
  `insert into documents (workspace_id, type, client_id) values ($1,'invoice',$2)`, [ws2, client], /foreign key/);

// Quotation expiry job
const { id: qt2 } = await one(`insert into documents (workspace_id, type, client_id, valid_until) values ($1,'quotation',$2,current_date-1) returning id`, [ws, client]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'x',100)`, [ws, qt2]);
await db.query(`update documents set status='issued' where id=$1`, [qt2]);
const e = await one(`select expire_quotations() n`);
ok('expire_quotations', e.n === 1 && (await one(`select status from documents where id=$1`, [qt2])).status === 'expired');
ok('second quotation number', (await one(`select number from documents where id=$1`, [qt2])).number === `QT-${beYear}-0002`);

// save_document_draft: atomic header + items replace
const { id: qt3 } = await one(`insert into documents (workspace_id, type, client_id) values ($1,'quotation',$2) returning id`, [ws, client]);
await db.query(`select save_document_draft($1, $2, $3)`, [qt3,
  JSON.stringify({ title: 'โลโก้', discount_amount: '100', wht_rate: '3', valid_until: '2099-01-01', revisions_included: '2' }),
  JSON.stringify([{ description: 'ออกแบบโลโก้', quantity: '1', unit_price: '5000' }, { description: 'นามบัตร', quantity: '2', unit: 'แบบ', unit_price: '750.25' }])]);
d = await one(`select * from documents where id=$1`, [qt3]);
ok('save_document_draft totals', d.subtotal === '6500.50' && d.total === '6400.50' && d.wht_amount === '192.02', `${d.subtotal}/${d.total}/${d.wht_amount}`);
ok('save_document_draft header', d.title === 'โลโก้' && d.revisions_included === 2);
await db.query(`select save_document_draft($1, $2, $3)`, [qt3, JSON.stringify({ discount_amount: '0' }),
  JSON.stringify([{ description: 'ออกแบบโลโก้', unit_price: '50' }])]);
d = await one(`select subtotal, (select count(*)::int from document_items where document_id=$1) n from documents where id=$1`, [qt3]);
ok('save_document_draft replaces items (discount reset first)', d.subtotal === '50.00' && d.n === 1, `${d.subtotal}/${d.n}`);
await expectError('save_document_draft discount > subtotal',
  `select save_document_draft($1, $2, $3)`, [qt3, JSON.stringify({ discount_amount: '999' }), JSON.stringify([{ description: 'x', unit_price: '1' }])],
  /documents_discount_le_subtotal/);
await expectError('save_document_draft rejects issued',
  `select save_document_draft($1, '{}', '[]')`, [qt], /void it/);

// issue_receipt_for_payment
const { id: inv2 } = await one(
  `insert into documents (workspace_id, type, client_id, wht_rate) values ($1,'invoice',$2,3) returning id`, [ws, client]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'งานออกแบบ',10000)`, [ws, inv2]);
await db.query(`update documents set status='issued' where id=$1`, [inv2]);
const { id: pay } = await one(
  `insert into payments (workspace_id, invoice_id, received_on, cash_amount, wht_amount, wht_cert_status) values ($1,$2,'2026-10-20',9700,300,'pending') returning id`, [ws, inv2]);
const { rc } = await one(`select issue_receipt_for_payment($1) rc`, [pay]);
d = await one(`select * from documents where id=$1`, [rc]);
ok('receipt issued with own numbering', d.type === 'receipt' && d.status === 'issued' && d.number === `RC-${beYear}-0001`, d.number);
ok('receipt amount = cash + wht', d.total === '10000.00' && d.issue_date instanceof Date, d.total);
ok('payment linked to receipt', (await one(`select receipt_id from payments where id=$1`, [pay])).receipt_id === rc);
await expectError('second receipt for same payment rejected', `select issue_receipt_for_payment($1)`, [pay], /already has a receipt/);
await db.query(`update documents set status='void', void_reason='x' where id=$1`, [rc]);
const { rc2 } = await one(`select issue_receipt_for_payment($1) rc2`, [pay]);
ok('new receipt after void', (await one(`select number from documents where id=$1`, [rc2])).number === `RC-${beYear}-0002`);

// Client portal
const { id: qt4 } = await one(`insert into documents (workspace_id, type, client_id, valid_until) values ($1,'quotation',$2,current_date+7) returning id`, [ws, client]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'ทดสอบ portal',500)`, [ws, qt4]);
await db.query(`update documents set status='issued' where id=$1`, [qt4]);
await db.query(`update documents set status='sent' where id=$1`, [qt4]);
await db.query(`insert into share_links (workspace_id, document_id, token_hash, expires_at) values ($1,$2,sha256(convert_to('tok-live','UTF8')), now() + interval '1 day')`, [ws, qt4]);
await db.query(`insert into share_links (workspace_id, document_id, token_hash, revoked_at) values ($1,$2,sha256(convert_to('tok-revoked','UTF8')), now())`, [ws, qt4]);
await db.query(`insert into share_links (workspace_id, document_id, token_hash, expires_at) values ($1,$2,sha256(convert_to('tok-expired','UTF8')), now() - interval '1 day')`, [ws, qt4]);

let pd = (await one(`select portal_get_document('tok-live') d`)).d;
ok('portal returns document for live token', pd?.document?.number?.startsWith('QT-') && pd.items.length === 1 && !('workspace_id' in pd.document));
ok('portal rejects revoked token', (await one(`select portal_get_document('tok-revoked') d`)).d === null);
ok('portal rejects expired token', (await one(`select portal_get_document('tok-expired') d`)).d === null);
ok('portal rejects unknown token', (await one(`select portal_get_document('nope') d`)).d === null);

ok('first view returns true', (await one(`select portal_record_view('tok-live', '203.0.113.9', 'test-agent') v`)).v === true);
ok('second view returns false', (await one(`select portal_record_view('tok-live', null, null) v`)).v === false);
ok('portal view marks sent → viewed', (await one(`select status from documents where id=$1`, [qt4])).status === 'viewed');
await expectError('portal respond needs a name', `select portal_respond('tok-live', true, '  ', null, null)`, [], /name is required/);
await expectError('portal respond rejects bad token', `select portal_respond('tok-revoked', true, 'สมชาย', null, null)`, [], /invalid or expired/);
ok('portal accept', (await one(`select portal_respond('tok-live', true, 'สมชาย ใจดี', 'not-an-ip', 'ua') s`)).s === 'accepted');
const ev = await one(`select actor, actor_name, ip from document_events where document_id=$1 and event='accepted'`, [qt4]);
ok('accept evidence recorded', ev.actor === 'client' && ev.actor_name === 'สมชาย ใจดี' && ev.ip === null);
await expectError('portal cannot respond twice', `select portal_respond('tok-live', false, 'x', null, null)`, [], /already accepted/);

// Revision rounds on an accepted quotation
await db.query(`insert into document_revisions (workspace_id, document_id, note) values ($1,$2,'แก้สีโลโก้')`, [ws, qt4]);
ok('revision logged on accepted quotation', (await one(`select count(*)::int c from document_revisions where document_id=$1`, [qt4])).c === 1);
await expectError('revision blocked on non-accepted document',
  `insert into document_revisions (workspace_id, document_id, note) values ($1,$2,'x')`, [ws, rc2], /accepted quotation/);
await expectError('revision needs a note',
  `insert into document_revisions (workspace_id, document_id, note) values ($1,$2,'  ')`, [ws, qt4], /check/);
pd = (await one(`select portal_get_document('tok-live') d`)).d;
ok('portal shows revisions', pd.revisions?.length === 1 && pd.revisions[0].note === 'แก้สีโลโก้');

// Delivery notes: client signs off or asks for changes through the portal
const newDn = async (token) => {
  const { id } = await one(`insert into documents (workspace_id, type, client_id, source_document_id) values ($1,'delivery_note',$2,$3) returning id`, [ws, client, qt4]);
  await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'ไฟล์งานออกแบบ',0)`, [ws, id]);
  await db.query(`update documents set status='issued' where id=$1`, [id]);
  await db.query(`update documents set status='sent' where id=$1`, [id]);
  await db.query(`insert into share_links (workspace_id, document_id, token_hash) values ($1,$2,sha256(convert_to($3,'UTF8')))`, [ws, id, token]);
  return id;
};
const dn1 = await newDn('tok-dn1');
ok('delivery note numbered DN-', (await one(`select number from documents where id=$1`, [dn1])).number.startsWith('DN-'));
ok('delivery note view marks viewed', (await one(`select portal_record_view('tok-dn1', null, null) v`)).v === true);
await expectError('asking for changes needs a note', `select portal_respond('tok-dn1', false, 'สมชาย', null, null, '  ')`, [], /note is required/);
ok('client asks for changes', (await one(`select portal_respond('tok-dn1', false, 'สมชาย', null, null, 'ขอปรับฟอนต์') s`)).s === 'rejected');
const revs = (await db.query(`select note, requested_by from document_revisions where document_id=$1 order by created_at`, [qt4])).rows;
ok('change request logged as revision on quotation', revs.length === 2 && revs[1].requested_by === 'client' && revs[1].note.includes('ขอปรับฟอนต์'));
pd = (await one(`select portal_get_document('tok-dn1') d`)).d;
ok('portal returns response evidence', pd.response?.actor_name === 'สมชาย' && pd.response?.note === 'ขอปรับฟอนต์');
const dn2 = await newDn('tok-dn2');
ok('client signs off delivery', (await one(`select portal_respond('tok-dn2', true, 'สมชาย ใจดี', null, null) s`)).s === 'accepted');
ok('sign-off adds no revision', (await one(`select count(*)::int c from document_revisions where document_id=$1`, [qt4])).c === 2);
await expectError('delivery note cannot be answered twice', `select portal_respond('tok-dn2', false, 'x', null, null, 'y')`, [], /already accepted/);

// Notifications (secret-gated)
await db.query(`update auth.users set email = 'owner@example.com'`);
await db.query(`insert into app_secrets (name, secret_hash) values ('notify', sha256(convert_to('s3cret', 'UTF8')))`);
await expectError('notify rejects wrong secret', `select notify_document_context('nope', $1)`, [qt4], /forbidden/);
const ctx = (await one(`select notify_document_context('s3cret', $1) c`, [qt4])).c;
ok('notify context has owner email and doc', ctx.emails[0] === 'owner@example.com' && ctx.number?.startsWith('QT-') && ctx.client_name === 'บริษัท เอ จำกัด');
ok('notify claim first time', (await one(`select notify_claim('s3cret', $1, 'accepted', 'k1', 'owner@example.com', 'document', $2) c`, [ws, qt4])).c === true);
ok('notify claim is idempotent', (await one(`select notify_claim('s3cret', $1, 'accepted', 'k1', 'owner@example.com', 'document', $2) c`, [ws, qt4])).c === false);
await db.query(`select notify_result('s3cret', 'k1', true, null)`);
ok('notify result recorded', (await one(`select status from notification_log where idempotency_key='k1'`)).status === 'sent');

const { id: inv5 } = await one(`insert into documents (workspace_id, type, client_id, due_date) values ($1,'invoice',$2,current_date + 3) returning id`, [ws, client]);
await db.query(`insert into document_items (workspace_id, document_id, description, unit_price) values ($1,$2,'รอเก็บเงิน',1000)`, [ws, inv5]);
await db.query(`update documents set status='issued' where id=$1`, [inv5]);
let digest = (await db.query(`select d from notify_due_digest('s3cret') d`)).rows.map(r => r.d);
ok('digest picks invoice due in 3 days', digest.length === 1 && digest[0].items.some(i => i.kind === 'due_soon' && i.document_id === inv5) && digest[0].emails[0] === 'owner@example.com');
digest = (await db.query(`select d from notify_due_digest('s3cret', current_date + 4) d`)).rows.map(r => r.d);
ok('digest picks overdue by 1 day', digest[0]?.items.some(i => i.kind === 'overdue' && i.days === -1));
digest = (await db.query(`select d from notify_due_digest('s3cret', current_date + 5) d`)).rows.map(r => r.d);
ok('digest skips overdue by 2 days', !digest.some(d => d.items.some(i => i.document_id === inv5)));
await expectError('digest rejects wrong secret', `select notify_due_digest('nope')`, [], /forbidden/);

// VAT: a VAT invoice's receipt is the tax invoice, split from what was received
await db.query(`update workspaces set vat_registered = true where id=$1`, [ws]);
const { id: vinv } = await one(`insert into documents (workspace_id, type, client_id) values ($1,'invoice',$2) returning id`, [ws, client]);
await db.query(`select save_document_draft($1, $2, $3)`, [vinv,
  JSON.stringify({ vat_rate: '7', wht_rate: '3' }), JSON.stringify([{ description: 'ออกแบบ', quantity: '1', unit_price: '10000' }])]);
let vi = await one(`select vat_rate, vat_amount, total, wht_amount, amount_payable from documents where id=$1`, [vinv]);
ok('draft saves vat_rate', vi.vat_rate === '7.00' && vi.vat_amount === '700.00' && vi.total === '10700.00' && vi.amount_payable === '10400.00',
  JSON.stringify(vi));
await db.query(`update documents set status='issued' where id=$1`, [vinv]);
const { id: vpay } = await one(`insert into payments (workspace_id, invoice_id, cash_amount, wht_amount, wht_cert_status, income_type)
  values ($1,$2,5000,0,'not_applicable','40_2') returning id`, [ws, vinv]);
const { r: vrc } = await one(`select issue_receipt_for_payment($1) r`, [vpay]);
const vr = await one(`select vat_rate, subtotal, vat_amount, total from documents where id=$1`, [vrc]);
ok('vat receipt splits amount received', vr.vat_rate === '7.00' && vr.total === '5000.00' && Number(vr.subtotal) + Number(vr.vat_amount) === 5000,
  JSON.stringify(vr));
await db.query(`update workspaces set vat_registered = false where id=$1`, [ws]);

// Workspace delete cascades even with issued docs
await db.query(`delete from workspaces where id=$1`, [ws]);
ok('workspace delete cascades', (await one(`select count(*)::int c from documents`)).c === 0);

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
