-- =============================================================================
-- WorkNest — MVP schema (draft)
-- Target: PostgreSQL 15+ / Supabase (uses auth.users, auth.uid(), roles
-- `authenticated` and `anon`). See docs/data-model.md for the rationale.
--
-- Conventions
--   * Every table carries workspace_id; child tables use composite foreign keys
--     (x_id, workspace_id) so rows can never point across workspaces.
--   * Money is numeric(14,2). Never float.
--   * Documents are immutable once issued: void + reissue instead of editing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type member_role       as enum ('owner', 'member');
create type client_kind       as enum ('individual', 'company');
create type client_status     as enum ('lead', 'active', 'inactive');
create type project_status    as enum ('draft', 'confirmed', 'in_progress', 'review', 'completed', 'cancelled');
create type milestone_status  as enum ('todo', 'in_progress', 'done');
create type document_type     as enum ('quotation', 'invoice', 'receipt', 'delivery_note');
create type document_status   as enum ('draft', 'issued', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'void');
create type schedule_due_rule as enum ('on_accept', 'on_milestone', 'fixed_date');
create type payment_method    as enum ('transfer', 'promptpay', 'cash', 'cheque', 'other');
create type wht_cert_status   as enum ('not_applicable', 'pending', 'received');
create type income_type       as enum ('40_2', '40_8');
create type file_kind         as enum ('logo', 'slip', 'contract', 'wht_cert', 'other');
create type event_actor       as enum ('owner', 'client', 'system');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Workspaces & members
-- -----------------------------------------------------------------------------
create table workspaces (
  id                        uuid primary key default gen_random_uuid(),
  display_name              text not null check (length(trim(display_name)) > 0),
  legal_name                text not null check (length(trim(legal_name)) > 0),
  tax_id                    text check (tax_id ~ '^[0-9]{13}$'),
  branch_code               text not null default '00000' check (branch_code ~ '^[0-9]{5}$'),
  address                   text,
  phone                     text,
  email                     text,
  logo_file_id              uuid,                       -- FK added after `files`
  promptpay_id              text check (promptpay_id ~ '^[0-9]{10}$|^[0-9]{13}$'),
  bank_accounts             jsonb not null default '[]'::jsonb,   -- [{bank, account_no, account_name}]
  vat_registered            boolean not null default false,
  default_quote_valid_days  int not null default 30 check (default_quote_valid_days > 0),
  default_credit_days       int not null default 30 check (default_credit_days >= 0),
  default_wht_rate          numeric(5,2) not null default 0 check (default_wht_rate between 0 and 100),
  doc_year_format           text not null default 'be' check (doc_year_format in ('be', 'ce')),
  doc_prefixes              jsonb not null default
    '{"quotation":"QT","invoice":"INV","receipt":"RC","delivery_note":"DN"}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          member_role not null default 'owner',
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members (user_id);

-- Used by every RLS policy. SECURITY DEFINER so it does not recurse into the
-- workspace_members policy.
create function is_workspace_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- Creates a workspace and makes the caller its owner (no direct INSERT policy).
create function create_workspace(p_display_name text, p_legal_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into workspaces (display_name, legal_name)
  values (p_display_name, p_legal_name)
  returning id into v_id;
  insert into workspace_members (workspace_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Files (Storage objects metadata; bucket is private, path = workspace_id/...)
-- -----------------------------------------------------------------------------
create table files (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  kind           file_kind not null,
  storage_path   text not null unique,
  mime_type      text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes     int not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  original_name  text,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (id, workspace_id)
);

alter table workspaces
  add constraint workspaces_logo_file_fk
  foreign key (logo_file_id) references files(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Clients (Lead is a client status, not a separate module)
-- -----------------------------------------------------------------------------
create table clients (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  kind              client_kind not null default 'individual',
  name              text not null check (length(trim(name)) > 0),
  tax_id            text check (tax_id ~ '^[0-9]{13}$'),
  branch_code       text check (branch_code ~ '^[0-9]{5}$'),
  address           text,
  email             text,
  phone             text,
  status            client_status not null default 'lead',
  default_wht_rate  numeric(5,2) not null default 0 check (default_wht_rate between 0 and 100),
  source            text,
  notes             text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, workspace_id)
);
create index clients_workspace_status_idx on clients (workspace_id, status);
create unique index clients_tax_id_unique
  on clients (workspace_id, tax_id, coalesce(branch_code, '00000'))
  where tax_id is not null;
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

create table client_contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  client_id     uuid not null,
  name          text not null,
  role_title    text,
  email         text,
  phone         text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (client_id, workspace_id) references clients(id, workspace_id) on delete cascade
);
create index client_contacts_client_idx on client_contacts (client_id);
create unique index client_contacts_one_primary on client_contacts (client_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Service items (saved line items)
-- -----------------------------------------------------------------------------
create table service_items (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  unit          text not null default 'งาน',
  unit_price    numeric(14,2) not null default 0 check (unit_price >= 0),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id)
);
create trigger service_items_updated_at before update on service_items
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Projects, milestones, links
-- -----------------------------------------------------------------------------
create table projects (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  client_id           uuid not null,
  primary_contact_id  uuid,
  code                text,
  name                text not null check (length(trim(name)) > 0),
  description         text,
  value               numeric(14,2) check (value >= 0),
  start_date          date,
  due_date            date,
  status              project_status not null default 'draft',
  revisions_included  int not null default 0 check (revisions_included >= 0),
  revisions_used      int not null default 0 check (revisions_used >= 0),
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, code),
  foreign key (client_id, workspace_id) references clients(id, workspace_id),
  foreign key (primary_contact_id, workspace_id) references client_contacts(id, workspace_id)
    on delete set null (primary_contact_id)
);
create index projects_workspace_status_idx on projects (workspace_id, status);
create index projects_client_idx on projects (client_id);
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();

create table milestones (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid not null,
  title         text not null,
  description   text,
  due_date      date,
  status        milestone_status not null default 'todo',
  sort_order    int not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references projects(id, workspace_id) on delete cascade
);
create index milestones_project_idx on milestones (project_id, sort_order);
create index milestones_workspace_due_idx on milestones (workspace_id, due_date) where status <> 'done';
create trigger milestones_updated_at before update on milestones
  for each row execute function set_updated_at();

create table project_links (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  project_id          uuid not null,
  label               text not null,
  url                 text not null check (url ~* '^https?://'),
  shared_with_client  boolean not null default false,
  created_at          timestamptz not null default now(),
  foreign key (project_id, workspace_id) references projects(id, workspace_id) on delete cascade
);
create index project_links_project_idx on project_links (project_id);

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------
create table document_number_sequences (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  doc_type      document_type not null,
  year          int not null,
  last_number   int not null,
  primary key (workspace_id, doc_type, year)
);

create table documents (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  type                  document_type not null,
  number                text,                         -- assigned on issue
  status                document_status not null default 'draft',
  client_id             uuid not null,
  project_id            uuid,
  source_document_id    uuid,                         -- QT -> INV -> RC chain
  replaces_document_id  uuid,                         -- reissue after void
  title                 text,
  issue_date            date not null default current_date,
  valid_until           date,                         -- quotation only
  due_date              date,                         -- invoice only
  currency              char(3) not null default 'THB',

  -- Totals: computed by trigger, never trusted from the client.
  subtotal              numeric(14,2) not null default 0,
  discount_amount       numeric(14,2) not null default 0 check (discount_amount >= 0),
  vat_rate              numeric(5,2)  not null default 0 check (vat_rate between 0 and 100),
  vat_amount            numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,
  wht_rate              numeric(5,2)  not null default 0 check (wht_rate between 0 and 100),
  wht_amount            numeric(14,2) not null default 0,
  amount_payable        numeric(14,2) not null default 0,

  scope_of_work         text,
  exclusions            text,
  revisions_included    int check (revisions_included >= 0),
  payment_terms         text,
  notes                 text,

  seller_snapshot       jsonb,                        -- filled on issue
  buyer_snapshot        jsonb,                        -- filled on issue

  issued_at             timestamptz,
  sent_at               timestamptz,
  first_viewed_at       timestamptz,
  responded_at          timestamptz,
  voided_at             timestamptz,
  void_reason           text,

  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (id, workspace_id),
  unique (workspace_id, type, number),
  foreign key (client_id, workspace_id)            references clients(id, workspace_id),
  foreign key (project_id, workspace_id)           references projects(id, workspace_id),
  foreign key (source_document_id, workspace_id)   references documents(id, workspace_id),
  foreign key (replaces_document_id, workspace_id) references documents(id, workspace_id),

  check ((status = 'draft') = (number is null)),
  check (status = 'draft' or (seller_snapshot is not null and buyer_snapshot is not null)),
  check (status <> 'void' or void_reason is not null),
  check (status not in ('accepted', 'rejected') or type in ('quotation', 'delivery_note')),
  check (status <> 'expired' or type = 'quotation'),
  check (valid_until is null or type = 'quotation'),
  check (due_date is null or type = 'invoice'),
  constraint documents_discount_le_subtotal check (discount_amount <= subtotal)
);
create index documents_workspace_type_status_idx on documents (workspace_id, type, status);
create index documents_client_idx on documents (client_id);
create index documents_project_idx on documents (project_id);
create index documents_source_idx on documents (source_document_id);

create table document_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  document_id      uuid not null,
  sort_order       int not null default 0,
  service_item_id  uuid,
  description      text not null check (length(trim(description)) > 0),
  quantity         numeric(12,3) not null default 1 check (quantity > 0),
  unit             text,
  unit_price       numeric(14,2) not null check (unit_price >= 0),
  discount_amount  numeric(14,2) not null default 0 check (discount_amount >= 0),
  amount           numeric(14,2) generated always as
                     (round(quantity * unit_price - discount_amount, 2)) stored,
  created_at       timestamptz not null default now(),
  check (discount_amount <= round(quantity * unit_price, 2)),
  foreign key (document_id, workspace_id) references documents(id, workspace_id) on delete cascade,
  foreign key (service_item_id, workspace_id) references service_items(id, workspace_id)
    on delete set null (service_item_id)
);
create index document_items_document_idx on document_items (document_id, sort_order);

-- -----------------------------------------------------------------------------
-- Payment schedules (installments defined on a quotation) & payments
-- -----------------------------------------------------------------------------
create table payment_schedules (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  quotation_id   uuid not null,
  project_id     uuid,
  milestone_id   uuid,
  sort_order     int not null default 0,
  label          text not null,                     -- e.g. "มัดจำ 50%"
  percent        numeric(5,2)  check (percent > 0 and percent <= 100),
  amount         numeric(14,2) check (amount > 0),
  due_rule       schedule_due_rule not null default 'on_accept',
  due_date       date,
  invoice_id     uuid unique,
  created_at     timestamptz not null default now(),
  check ((percent is null) <> (amount is null)),
  check (due_rule <> 'fixed_date'   or due_date is not null),
  check (due_rule <> 'on_milestone' or milestone_id is not null),
  foreign key (quotation_id, workspace_id) references documents(id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id)   references projects(id, workspace_id) on delete set null (project_id),
  foreign key (milestone_id, workspace_id) references milestones(id, workspace_id),
  foreign key (invoice_id, workspace_id)   references documents(id, workspace_id) on delete set null (invoice_id)
);
create index payment_schedules_quotation_idx on payment_schedules (quotation_id, sort_order);
create index payment_schedules_milestone_idx on payment_schedules (milestone_id);

create table payments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  invoice_id        uuid not null,
  received_on       date not null default current_date,
  cash_amount       numeric(14,2) not null check (cash_amount >= 0),     -- money that actually arrived
  wht_amount        numeric(14,2) not null default 0 check (wht_amount >= 0),  -- withheld by client
  method            payment_method not null default 'transfer',
  reference         text,
  slip_file_id      uuid,
  wht_cert_status   wht_cert_status not null default 'not_applicable',
  wht_cert_file_id  uuid,
  income_type       income_type,
  receipt_id        uuid unique,
  note              text,
  recorded_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (cash_amount + wht_amount > 0),
  check (wht_amount = 0 or wht_cert_status <> 'not_applicable'),
  foreign key (invoice_id, workspace_id)       references documents(id, workspace_id),
  foreign key (receipt_id, workspace_id)       references documents(id, workspace_id) on delete set null (receipt_id),
  foreign key (slip_file_id, workspace_id)     references files(id, workspace_id) on delete set null (slip_file_id),
  foreign key (wht_cert_file_id, workspace_id) references files(id, workspace_id) on delete set null (wht_cert_file_id)
);
create index payments_invoice_idx on payments (invoice_id);
create index payments_workspace_received_idx on payments (workspace_id, received_on);
create index payments_wht_pending_idx on payments (workspace_id) where wht_cert_status = 'pending';

-- -----------------------------------------------------------------------------
-- Client portal: share links & evidence log
-- -----------------------------------------------------------------------------
create table share_links (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  document_id       uuid not null,
  token_hash        bytea not null unique,    -- sha256(token); raw token lives only in the URL
  expires_at        timestamptz,
  revoked_at        timestamptz,
  last_accessed_at  timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  foreign key (document_id, workspace_id) references documents(id, workspace_id) on delete cascade
);
create index share_links_document_idx on share_links (document_id);

create table document_events (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  document_id   uuid not null,
  event         text not null,              -- issued, sent, viewed, accepted, rejected, voided, payment_recorded ...
  actor         event_actor not null,
  actor_name    text,
  ip            inet,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  foreign key (document_id, workspace_id) references documents(id, workspace_id) on delete cascade
);
create index document_events_document_idx on document_events (document_id, created_at);

-- -----------------------------------------------------------------------------
-- Notification log (idempotent sends)
-- -----------------------------------------------------------------------------
create table notification_log (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  channel          text not null check (channel in ('email', 'line')),
  kind             text not null,           -- invoice_due_soon, invoice_overdue, document_accepted ...
  entity_type      text,
  entity_id        uuid,
  recipient        text not null,
  idempotency_key  text not null unique,     -- e.g. invoice_overdue:<invoice_id>:<date>
  status           text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error            text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index notification_log_workspace_idx on notification_log (workspace_id, created_at);

-- =============================================================================
-- Business rules
-- =============================================================================

-- Atomic per (workspace, type, year) numbering, e.g. QT-2569-0001.
-- Table-based (not a sequence) so a rolled-back issue leaves no gap.
create function next_document_number(p_ws uuid, p_type document_type, p_date date) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_fmt     text;
  v_prefix  text;
  v_year    int;
  v_n       int;
begin
  select w.doc_year_format, coalesce(w.doc_prefixes ->> p_type::text, upper(left(p_type::text, 2)))
    into v_fmt, v_prefix
    from workspaces w where w.id = p_ws;
  if not found then
    raise exception 'workspace % not found', p_ws;
  end if;

  v_year := extract(year from p_date)::int + case when v_fmt = 'be' then 543 else 0 end;

  insert into document_number_sequences as s (workspace_id, doc_type, year, last_number)
  values (p_ws, p_type, v_year, 1)
  on conflict (workspace_id, doc_type, year)
    do update set last_number = s.last_number + 1
  returning last_number into v_n;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_n::text, 4, '0'));
end $$;

create function assert_document_type(p_id uuid, p_type document_type) returns void
language plpgsql as $$
begin
  if p_id is not null and not exists (select 1 from documents where id = p_id and type = p_type) then
    raise exception 'document % must be a %', p_id, p_type;
  end if;
end $$;

-- documents: totals, issue (number + snapshots), immutability, status transitions.
-- SECURITY DEFINER so it can call next_document_number (not executable by users).
create function documents_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ws       workspaces%rowtype;
  v_client   clients%rowtype;
  v_base     numeric(14,2);
  v_mutable  text[] := array['status', 'sent_at', 'first_viewed_at', 'responded_at',
                             'voided_at', 'void_reason', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'documents must be created as draft';
    end if;
    new.number := null;
    new.subtotal := 0;
  else
    -- Immutability: once out of draft only lifecycle columns may change.
    if old.status <> 'draft'
       and (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
      raise exception 'document % is %; void it and issue a new one instead of editing', old.number, old.status;
    end if;

    if new.status is distinct from old.status then
      if not (
           (old.status = 'draft'  and new.status = 'issued')
        or (old.status = 'issued' and new.status in ('sent', 'accepted', 'rejected', 'expired', 'void'))
        or (old.status = 'sent'   and new.status in ('viewed', 'accepted', 'rejected', 'expired', 'void'))
        or (old.status = 'viewed' and new.status in ('accepted', 'rejected', 'expired', 'void'))
        or (old.status in ('accepted', 'rejected', 'expired') and new.status = 'void')
      ) then
        raise exception 'invalid status transition % -> %', old.status, new.status;
      end if;

      case new.status
        when 'sent'     then new.sent_at := coalesce(new.sent_at, now());
        when 'viewed'   then new.first_viewed_at := coalesce(new.first_viewed_at, now());
        when 'accepted', 'rejected' then new.responded_at := coalesce(new.responded_at, now());
        when 'void'     then
          new.voided_at := coalesce(new.voided_at, now());
          if new.type = 'invoice' and exists (select 1 from payments p where p.invoice_id = new.id) then
            raise exception 'invoice % has recorded payments; remove them before voiding', new.number;
          end if;
        else null;
      end case;
    end if;

    if old.status = 'draft' then
      new.subtotal := (select coalesce(sum(i.amount), 0) from document_items i where i.document_id = new.id);
    end if;
  end if;

  -- Totals are only (re)computed while the document is still a draft.
  if tg_op = 'INSERT' or old.status = 'draft' then
    v_base := new.subtotal - new.discount_amount;
    new.vat_amount     := round(v_base * new.vat_rate / 100, 2);
    new.total          := v_base + new.vat_amount;
    new.wht_amount     := round(v_base * new.wht_rate / 100, 2);   -- WHT is on the pre-VAT amount
    new.amount_payable := new.total - new.wht_amount;
  end if;

  -- Issue: assign number, freeze seller/buyer data.
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'issued' then
    if not exists (select 1 from document_items i where i.document_id = new.id) then
      raise exception 'cannot issue a document without line items';
    end if;

    select * into v_ws from workspaces where id = new.workspace_id;
    select * into v_client from clients where id = new.client_id;

    if new.vat_rate > 0 and not v_ws.vat_registered then
      raise exception 'VAT can only be charged by a VAT-registered workspace';
    end if;

    new.number    := next_document_number(new.workspace_id, new.type, new.issue_date);
    new.issued_at := now();
    new.seller_snapshot := jsonb_build_object(
      'legal_name',     v_ws.legal_name,
      'tax_id',         v_ws.tax_id,
      'branch_code',    v_ws.branch_code,
      'address',        v_ws.address,
      'phone',          v_ws.phone,
      'email',          v_ws.email,
      'logo_file_id',   v_ws.logo_file_id,
      'promptpay_id',   v_ws.promptpay_id,
      'bank_accounts',  v_ws.bank_accounts,
      'vat_registered', v_ws.vat_registered);
    new.buyer_snapshot := jsonb_build_object(
      'kind',        v_client.kind,
      'name',        v_client.name,
      'tax_id',      v_client.tax_id,
      'branch_code', v_client.branch_code,
      'address',     v_client.address,
      'email',       v_client.email,
      'phone',       v_client.phone);
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger documents_before_write
  before insert or update on documents
  for each row execute function documents_before_write();

-- Only drafts can be deleted (cascades from a workspace delete are allowed).
create function documents_before_delete() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' and pg_trigger_depth() = 1 then
    raise exception 'document % is %; void it instead of deleting', old.number, old.status;
  end if;
  return old;
end $$;

create trigger documents_before_delete
  before delete on documents
  for each row execute function documents_before_delete();

-- Quotation accepted -> project confirmed, client lead -> active.
create function documents_after_update() returns trigger
language plpgsql as $$
begin
  if new.type = 'quotation' and new.status = 'accepted' and old.status <> 'accepted' then
    update projects set status = 'confirmed'
      where id = new.project_id and status = 'draft';
    update clients set status = 'active'
      where id = new.client_id and status = 'lead';
  end if;
  return null;
end $$;

create trigger documents_after_update
  after update of status on documents
  for each row execute function documents_after_update();

-- document_items: editable only while the parent is a draft; any change
-- re-runs the parent's total calculation.
create function document_items_guard() returns trigger
language plpgsql as $$
declare
  v_status document_status;
begin
  if tg_op = 'UPDATE' and new.document_id <> old.document_id then
    raise exception 'line items cannot be moved between documents';
  end if;
  select status into v_status from documents
    where id = case when tg_op = 'DELETE' then old.document_id else new.document_id end;
  if found and v_status <> 'draft' then
    raise exception 'line items of a % document cannot be changed', v_status;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger document_items_guard
  before insert or update or delete on document_items
  for each row execute function document_items_guard();

create function document_items_recalc() returns trigger
language plpgsql as $$
begin
  update documents set updated_at = now()
    where id = case when tg_op = 'DELETE' then old.document_id else new.document_id end;
  return null;
end $$;

create trigger document_items_recalc
  after insert or update or delete on document_items
  for each row execute function document_items_recalc();

-- payment_schedules: belong to a quotation; frozen once it is issued
-- (except linking the invoice created for the installment).
create function payment_schedules_guard() returns trigger
language plpgsql as $$
declare
  v_status document_status;
begin
  -- Fired by an FK cascade (e.g. workspace delete): parents may already be gone.
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op <> 'DELETE' then
    perform assert_document_type(new.quotation_id, 'quotation');
    perform assert_document_type(new.invoice_id, 'invoice');
  end if;

  select status into v_status from documents
    where id = case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  if found and v_status <> 'draft' then
    if tg_op <> 'UPDATE'
       or (to_jsonb(new) - 'invoice_id') is distinct from (to_jsonb(old) - 'invoice_id') then
      raise exception 'payment schedule of a % quotation cannot be changed', v_status;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger payment_schedules_guard
  before insert or update or delete on payment_schedules
  for each row execute function payment_schedules_guard();

-- payments: only on live invoices, never more than the invoice total.
create function payments_guard() returns trigger
language plpgsql as $$
declare
  v_inv    documents%rowtype;
  v_other  numeric(14,2);
begin
  -- Fired by an FK cascade (e.g. receipt_id set null): nothing to validate.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select * into v_inv from documents where id = new.invoice_id for update;
  if v_inv.type <> 'invoice' then
    raise exception 'payments must reference an invoice';
  end if;
  if v_inv.status in ('draft', 'void') then
    raise exception 'cannot record a payment on a % invoice', v_inv.status;
  end if;

  select coalesce(sum(p.cash_amount + p.wht_amount), 0) into v_other
    from payments p where p.invoice_id = new.invoice_id and p.id <> new.id;

  if v_other + new.cash_amount + new.wht_amount > v_inv.total then
    raise exception 'payment exceeds invoice % (outstanding %)', v_inv.number, v_inv.total - v_other;
  end if;

  perform assert_document_type(new.receipt_id, 'receipt');
  new.updated_at := now();
  return new;
end $$;

create trigger payments_guard
  before insert or update on payments
  for each row execute function payments_guard();

-- document_events is append-only evidence.
create function document_events_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'document_events is append-only';
  end if;
  return old;
end $$;

create trigger document_events_append_only
  before update or delete on document_events
  for each row execute function document_events_append_only();

-- Replace a draft's header fields and line items in one transaction.
-- SECURITY INVOKER: RLS still applies to every statement.
-- p_header keys: client_id, title, issue_date, valid_until, due_date,
--   discount_amount, wht_rate, scope_of_work, exclusions, revisions_included,
--   payment_terms, notes
-- p_items: [{description, quantity, unit, unit_price, discount_amount, service_item_id}]
create function save_document_draft(p_id uuid, p_header jsonb, p_items jsonb) returns void
language plpgsql as $$
declare
  v_doc documents%rowtype;
begin
  select * into v_doc from documents where id = p_id for update;
  if not found then
    raise exception 'document % not found', p_id;
  end if;
  if v_doc.status <> 'draft' then
    raise exception 'document % is %; void it and issue a new one instead of editing', v_doc.number, v_doc.status;
  end if;

  -- Reset the bill discount first so it never exceeds the subtotal mid-way.
  update documents set discount_amount = 0 where id = p_id;

  delete from document_items where document_id = p_id;
  insert into document_items (workspace_id, document_id, sort_order, service_item_id,
                              description, quantity, unit, unit_price, discount_amount)
  select v_doc.workspace_id,
         p_id,
         i.ord - 1,
         nullif(i.item ->> 'service_item_id', '')::uuid,
         i.item ->> 'description',
         coalesce(nullif(i.item ->> 'quantity', '')::numeric, 1),
         nullif(i.item ->> 'unit', ''),
         coalesce(nullif(i.item ->> 'unit_price', '')::numeric, 0),
         coalesce(nullif(i.item ->> 'discount_amount', '')::numeric, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as i(item, ord);

  update documents set
    client_id          = coalesce(nullif(p_header ->> 'client_id', '')::uuid, client_id),
    title              = nullif(p_header ->> 'title', ''),
    issue_date         = coalesce(nullif(p_header ->> 'issue_date', '')::date, issue_date),
    valid_until        = case when type = 'quotation' then nullif(p_header ->> 'valid_until', '')::date end,
    due_date           = case when type = 'invoice'   then nullif(p_header ->> 'due_date', '')::date end,
    discount_amount    = coalesce(nullif(p_header ->> 'discount_amount', '')::numeric, 0),
    wht_rate           = coalesce(nullif(p_header ->> 'wht_rate', '')::numeric, 0),
    scope_of_work      = nullif(p_header ->> 'scope_of_work', ''),
    exclusions         = nullif(p_header ->> 'exclusions', ''),
    revisions_included = nullif(p_header ->> 'revisions_included', '')::int,
    payment_terms      = nullif(p_header ->> 'payment_terms', ''),
    notes              = nullif(p_header ->> 'notes', '')
  where id = p_id;
end $$;

-- Issue a receipt for one payment, atomically: draft → item → issued → link.
-- SECURITY INVOKER: RLS still applies. A payment whose receipt was voided can
-- be given a new one.
create function issue_receipt_for_payment(p_payment_id uuid) returns uuid
language plpgsql as $$
declare
  v_pay  payments%rowtype;
  v_inv  documents%rowtype;
  v_id   uuid;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;
  if v_pay.receipt_id is not null
     and exists (select 1 from documents where id = v_pay.receipt_id and status <> 'void') then
    raise exception 'payment already has a receipt';
  end if;

  select * into v_inv from documents where id = v_pay.invoice_id;

  insert into documents (workspace_id, type, client_id, project_id, source_document_id, issue_date, title)
  values (v_pay.workspace_id, 'receipt', v_inv.client_id, v_inv.project_id, v_inv.id, v_pay.received_on, v_inv.title)
  returning id into v_id;

  -- One line for the settled amount (cash + tax withheld by the client).
  insert into document_items (workspace_id, document_id, description, quantity, unit_price)
  values (v_pay.workspace_id, v_id, 'รับชำระตามใบแจ้งหนี้เลขที่ ' || v_inv.number, 1,
          v_pay.cash_amount + v_pay.wht_amount);

  update documents set status = 'issued' where id = v_id;
  update payments set receipt_id = v_id where id = p_payment_id;

  insert into document_events (workspace_id, document_id, event, actor, metadata)
  values (v_pay.workspace_id, v_id, 'issued', 'owner', jsonb_build_object('payment_id', p_payment_id));

  return v_id;
end $$;

-- =============================================================================
-- Client portal (anonymous access by share-link token)
-- The raw token only ever lives in the URL; share_links stores sha256(token).
-- These SECURITY DEFINER functions are the portal's only way in: no table is
-- readable by `anon`.
-- =============================================================================

-- Live link for a token, or a null row. Internal: not executable by clients.
create function portal_link(p_token text) returns share_links
language sql stable security definer set search_path = public as $$
  select * from share_links
  where token_hash = sha256(convert_to(p_token, 'UTF8'))
    and revoked_at is null
    and (expires_at is null or expires_at > now());
$$;

create function portal_get_document(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_link     share_links;
  v_doc      documents%rowtype;
  v_items    jsonb;
  v_balance  jsonb;
  v_payment  jsonb;
  v_ref      text;
begin
  v_link := portal_link(p_token);
  if v_link.id is null then
    return null;
  end if;

  select * into v_doc from documents where id = v_link.document_id;
  if v_doc.status = 'draft' then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) - 'workspace_id' order by i.sort_order), '[]'::jsonb)
    into v_items from document_items i where i.document_id = v_doc.id;
  if v_doc.type = 'invoice' then
    select to_jsonb(b) - 'workspace_id' - 'client_id' - 'project_id' into v_balance
      from invoice_balances b where b.invoice_id = v_doc.id;
  end if;
  if v_doc.type = 'receipt' then
    select jsonb_build_object('received_on', p.received_on, 'cash_amount', p.cash_amount, 'wht_amount', p.wht_amount,
                              'method', p.method, 'reference', p.reference)
      into v_payment from payments p where p.receipt_id = v_doc.id;
  end if;
  select number into v_ref from documents where id = v_doc.source_document_id;

  return jsonb_build_object(
    'document',  to_jsonb(v_doc) - 'workspace_id' - 'created_by' - 'project_id' - 'replaces_document_id',
    'items',     v_items,
    'balance',   v_balance,
    'payment',   v_payment,
    'reference', v_ref);
end $$;

-- Called when the client opens the link: sent → viewed, plus an evidence row.
-- Returns true only for that first view, so the app can notify the owner once.
create function portal_record_view(p_token text, p_ip text, p_user_agent text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_link share_links;
  v_doc  documents%rowtype;
begin
  v_link := portal_link(p_token);
  if v_link.id is null then
    return false;
  end if;
  update share_links set last_accessed_at = now() where id = v_link.id;

  select * into v_doc from documents where id = v_link.document_id for update;
  if v_doc.type in ('quotation', 'invoice') and v_doc.status = 'sent' then
    update documents set status = 'viewed' where id = v_doc.id;
    insert into document_events (workspace_id, document_id, event, actor, ip, user_agent)
    values (v_doc.workspace_id, v_doc.id, 'viewed', 'client',
            case when p_ip ~ '^[0-9a-fA-F:.]+$' then p_ip::inet end, left(p_user_agent, 500));
    return true;
  end if;
  return false;
end $$;

-- Client accepts or rejects a quotation. Returns the new status.
create function portal_respond(p_token text, p_accept boolean, p_name text, p_ip text, p_user_agent text)
returns document_status
language plpgsql security definer set search_path = public as $$
declare
  v_link   share_links;
  v_doc    documents%rowtype;
  v_status document_status := case when p_accept then 'accepted' else 'rejected' end;
begin
  v_link := portal_link(p_token);
  if v_link.id is null then
    raise exception 'invalid or expired link';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'name is required';
  end if;

  select * into v_doc from documents where id = v_link.document_id for update;
  if v_doc.type <> 'quotation' then
    raise exception 'only quotations can be accepted or rejected';
  end if;
  if v_doc.status not in ('issued', 'sent', 'viewed') then
    raise exception 'quotation already %', v_doc.status;
  end if;
  if v_doc.valid_until < current_date then
    raise exception 'quotation expired';
  end if;

  update documents set status = v_status where id = v_doc.id;
  insert into document_events (workspace_id, document_id, event, actor, actor_name, ip, user_agent)
  values (v_doc.workspace_id, v_doc.id, v_status::text, 'client', left(trim(p_name), 200),
          case when p_ip ~ '^[0-9a-fA-F:.]+$' then p_ip::inet end, left(p_user_agent, 500));
  return v_status;
end $$;

-- =============================================================================
-- Email notifications
-- The app server (portal actions and the daily cron route) calls these with a
-- shared secret (CRON_SECRET) instead of holding a service-role key. Only the
-- SHA-256 of the secret is stored. They expose owner emails, so every one of
-- them rejects a wrong secret before doing anything.
-- =============================================================================
create table app_secrets (
  name         text primary key,
  secret_hash  bytea not null,
  created_at   timestamptz not null default now()
);
alter table app_secrets enable row level security;  -- no policies: unreadable via the API

create function notify_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_secrets
    where name = 'notify' and secret_hash = sha256(convert_to(coalesce(p_secret, ''), 'UTF8'))
  );
$$;

create function workspace_owner_emails(p_workspace uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(u.email order by u.email), '[]'::jsonb)
  from workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace and u.email is not null;
$$;

-- What an "event happened on this document" email needs.
create function notify_document_context(p_secret text, p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not notify_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'workspace_id', d.workspace_id, 'workspace_name', w.display_name,
    'document_id', d.id, 'type', d.type, 'number', d.number, 'title', d.title,
    'status', d.status, 'total', d.total, 'client_name', c.name,
    'emails', workspace_owner_emails(d.workspace_id))
  into v
  from documents d
  join workspaces w on w.id = d.workspace_id
  join clients c on c.id = d.client_id
  where d.id = p_document_id;
  return v;
end $$;

-- One row per workspace with something to remind about on p_today:
-- invoices due in 3 days / today / overdue by 1, 7, 14 or 30 days, and
-- quotations expiring in 2 days. Fixed milestones keep the digest from
-- repeating the same overdue invoice every day.
create function notify_due_digest(p_secret text, p_today date default current_date) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not notify_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  return query
  with items as (
    select d.workspace_id, jsonb_build_object(
             'kind', case when d.due_date < p_today then 'overdue' when d.due_date = p_today then 'due_today' else 'due_soon' end,
             'document_id', d.id, 'number', d.number, 'client_name', c.name,
             'date', d.due_date, 'days', d.due_date - p_today, 'amount', b.outstanding) as item
    from invoice_balances b
    join documents d on d.id = b.invoice_id
    join clients c on c.id = d.client_id
    where b.outstanding > 0
      and (d.due_date = p_today + 3 or d.due_date = p_today or (p_today - d.due_date) in (1, 7, 14, 30))
    union all
    select d.workspace_id, jsonb_build_object(
             'kind', 'quote_expiring', 'document_id', d.id, 'number', d.number, 'client_name', c.name,
             'date', d.valid_until, 'days', d.valid_until - p_today, 'amount', d.total)
    from documents d
    join clients c on c.id = d.client_id
    where d.type = 'quotation' and d.status in ('issued', 'sent', 'viewed') and d.valid_until = p_today + 2
  )
  select jsonb_build_object(
           'workspace_id', w.id, 'workspace_name', w.display_name,
           'emails', workspace_owner_emails(w.id),
           'items', jsonb_agg(i.item order by i.item ->> 'kind', i.item ->> 'number'))
  from items i
  join workspaces w on w.id = i.workspace_id
  group by w.id;
end $$;

-- Reserve an idempotency key before sending; false means it was already sent.
create function notify_claim(p_secret text, p_workspace uuid, p_kind text, p_key text, p_recipient text,
                             p_entity_type text, p_entity_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not notify_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  insert into notification_log (workspace_id, channel, kind, entity_type, entity_id, recipient, idempotency_key)
  values (p_workspace, 'email', p_kind, p_entity_type, p_entity_id, left(p_recipient, 500), p_key)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

create function notify_result(p_secret text, p_key text, p_ok boolean, p_error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not notify_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  update notification_log
  set status = case when p_ok then 'sent' else 'failed' end,
      sent_at = case when p_ok then now() end,
      error = left(p_error, 500)
  where idempotency_key = p_key;
end $$;

-- Daily job (pg_cron): expire quotations past valid_until.
create function expire_quotations() returns int
language sql as $$
  with expired as (
    update documents set status = 'expired'
    where type = 'quotation'
      and status in ('issued', 'sent', 'viewed')
      and valid_until < current_date
    returning 1
  )
  select count(*)::int from expired;
$$;

-- =============================================================================
-- Read models
-- =============================================================================

-- settled = cash received + tax withheld by the client.
create view invoice_balances with (security_invoker = true) as
select
  d.id                                               as invoice_id,
  d.workspace_id,
  d.client_id,
  d.project_id,
  d.number,
  d.issue_date,
  d.due_date,
  d.total,
  d.amount_payable,
  coalesce(sum(p.cash_amount), 0)                    as cash_received,
  coalesce(sum(p.wht_amount), 0)                     as wht_withheld,
  coalesce(sum(p.cash_amount + p.wht_amount), 0)     as settled,
  d.total - coalesce(sum(p.cash_amount + p.wht_amount), 0) as outstanding,
  case
    when coalesce(sum(p.cash_amount + p.wht_amount), 0) >= d.total then 'paid'
    when coalesce(sum(p.cash_amount + p.wht_amount), 0) > 0        then 'partially_paid'
    else 'unpaid'
  end                                                as payment_status,
  (d.due_date < current_date
   and coalesce(sum(p.cash_amount + p.wht_amount), 0) < d.total) as is_overdue
from documents d
left join payments p on p.invoice_id = d.id
where d.type = 'invoice' and d.status not in ('draft', 'void')
group by d.id;

create function dashboard_summary(p_ws uuid)
returns table (
  outstanding_total        numeric,
  overdue_count            int,
  overdue_total            numeric,
  awaiting_response_count  int,
  milestones_due_soon      int
)
language sql stable as $$
  select
    (select coalesce(sum(b.outstanding), 0) from invoice_balances b
      where b.workspace_id = p_ws and b.outstanding > 0),
    (select count(*)::int from invoice_balances b
      where b.workspace_id = p_ws and b.is_overdue),
    (select coalesce(sum(b.outstanding), 0) from invoice_balances b
      where b.workspace_id = p_ws and b.is_overdue),
    (select count(*)::int from documents d
      where d.workspace_id = p_ws and d.type = 'quotation' and d.status in ('issued', 'sent', 'viewed')),
    (select count(*)::int from milestones m
      where m.workspace_id = p_ws and m.status <> 'done' and m.due_date <= current_date + 7);
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table workspaces enable row level security;
create policy workspaces_member_select on workspaces
  for select to authenticated using (is_workspace_member(id));
create policy workspaces_member_update on workspaces
  for update to authenticated using (is_workspace_member(id)) with check (is_workspace_member(id));

alter table workspace_members enable row level security;
create policy workspace_members_member_select on workspace_members
  for select to authenticated using (is_workspace_member(workspace_id));

-- Only reachable through next_document_number().
alter table document_number_sequences enable row level security;

-- Full CRUD for members of the workspace.
do $$
declare
  t text;
begin
  foreach t in array array[
    'files', 'clients', 'client_contacts', 'service_items', 'projects', 'milestones',
    'project_links', 'documents', 'document_items', 'payment_schedules', 'payments', 'share_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated '
      'using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id))',
      t || '_member_all', t);
  end loop;
end $$;

-- Evidence: read + append only.
alter table document_events enable row level security;
create policy document_events_member_select on document_events
  for select to authenticated using (is_workspace_member(workspace_id));
create policy document_events_member_insert on document_events
  for insert to authenticated with check (is_workspace_member(workspace_id));

-- Written by the backend (service role); members may read.
alter table notification_log enable row level security;
create policy notification_log_member_select on notification_log
  for select to authenticated using (is_workspace_member(workspace_id));

-- The client portal never uses `anon` table access: a server endpoint hashes
-- the URL token, looks up share_links with the service role, and returns only
-- that document.
revoke execute on function next_document_number(uuid, document_type, date) from public, anon, authenticated;
revoke execute on function create_workspace(text, text) from public, anon;
grant  execute on function create_workspace(text, text) to authenticated;
revoke execute on function expire_quotations() from public, anon, authenticated;

-- Trigger functions are never called directly (EXECUTE is only checked at CREATE TRIGGER).
revoke execute on function documents_before_write() from public, anon, authenticated;
-- Needed by RLS policies for signed-in users only.
revoke execute on function is_workspace_member(uuid) from public, anon;
grant  execute on function is_workspace_member(uuid) to authenticated;

-- Pin search_path on every function (Supabase linter 0011).
alter function set_updated_at() set search_path = public;
alter function assert_document_type(uuid, document_type) set search_path = public;
alter function documents_before_delete() set search_path = public;
alter function documents_after_update() set search_path = public;
alter function document_items_guard() set search_path = public;
alter function document_items_recalc() set search_path = public;
alter function payment_schedules_guard() set search_path = public;
alter function payments_guard() set search_path = public;
alter function document_events_append_only() set search_path = public;
alter function save_document_draft(uuid, jsonb, jsonb) set search_path = public;
alter function issue_receipt_for_payment(uuid) set search_path = public;

-- Portal: the three entry points are public; the token lookup is not.
revoke execute on function portal_link(text) from public, anon, authenticated;
revoke execute on function portal_get_document(text) from public;
revoke execute on function portal_record_view(text, text, text) from public;
revoke execute on function portal_respond(text, boolean, text, text, text) from public;
grant execute on function portal_get_document(text) to anon, authenticated;
grant execute on function portal_record_view(text, text, text) to anon, authenticated;
grant execute on function portal_respond(text, boolean, text, text, text) to anon, authenticated;

-- Notifications: secret-gated entry points are callable; helpers are not.
revoke execute on function notify_secret_ok(text) from public, anon, authenticated;
revoke execute on function workspace_owner_emails(uuid) from public, anon, authenticated;
revoke execute on function notify_document_context(text, uuid) from public;
revoke execute on function notify_due_digest(text, date) from public;
revoke execute on function notify_claim(text, uuid, text, text, text, text, uuid) from public;
revoke execute on function notify_result(text, text, boolean, text) from public;
grant execute on function notify_document_context(text, uuid) to anon, authenticated;
grant execute on function notify_due_digest(text, date) to anon, authenticated;
grant execute on function notify_claim(text, uuid, text, text, text, text, uuid) to anon, authenticated;
grant execute on function notify_result(text, text, boolean, text) to anon, authenticated;
-- Set the secret once per database (value = CRON_SECRET in the app env):
--   insert into app_secrets (name, secret_hash) values ('notify', sha256(convert_to('<secret>', 'UTF8')));
alter function expire_quotations() set search_path = public;
alter function dashboard_summary(uuid) set search_path = public;

-- Nightly quotation expiry (Supabase: enable pg_cron first; cron runs in UTC):
--   create extension if not exists pg_cron;
--   select cron.schedule('expire-quotations', '5 17 * * *', $$select public.expire_quotations()$$);

-- current_date drives issue_date defaults, overdue checks and quotation
-- expiry, so it must be the Thai calendar day (run once per database):
--   alter database postgres set timezone to 'Asia/Bangkok';

-- Storage (Supabase): private bucket "workspace-files"; policies on
-- storage.objects should require is_workspace_member(<first path segment>::uuid).
