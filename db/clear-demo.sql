-- =============================================================================
-- Remove everything db/seed-demo.sql created (clients with source = 'demo' and
-- all their documents, payments, links and events), then drop number counters
-- that no longer have any document so numbering restarts cleanly.
-- Issued documents are normally undeletable, so the guard trigger is switched
-- off only inside this transaction.
-- =============================================================================
begin;

alter table documents disable trigger documents_before_delete;

delete from payments
where invoice_id in (select d.id from documents d join clients c on c.id = d.client_id where c.source = 'demo');

-- Children first: receipts and invoices reference quotations/invoices.
delete from documents
where client_id in (select id from clients where source = 'demo') and type = 'receipt';
delete from documents
where client_id in (select id from clients where source = 'demo') and type = 'invoice';
delete from documents
where client_id in (select id from clients where source = 'demo');

delete from clients where source = 'demo';

delete from document_number_sequences s
where not exists (
  select 1 from documents d
  where d.workspace_id = s.workspace_id and d.type = s.doc_type and d.number is not null
);

alter table documents enable trigger documents_before_delete;

commit;
