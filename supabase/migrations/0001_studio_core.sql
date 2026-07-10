-- Greyform Studio · core schema
-- Paste this whole file into the Supabase SQL editor and run once.
-- Re-running is safe: every statement is idempotent via IF NOT EXISTS / OR REPLACE.
--
-- Lives in a shared Supabase project: the greyform.org site (inquiries),
-- an ochudi_* personal-site set, and a campaigns app (brands, generations,
-- reviews, ...) all keep tables here. Every studio table therefore carries
-- the studio_ prefix — a bare name like `reviews` already belongs to
-- someone else, and `create table if not exists` would silently skip it.
-- Like the site, the app talks to Supabase exclusively through the
-- service-role key from the server — RLS is enabled with no policies, so
-- anon/authenticated clients get nothing.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────── settings ──
-- Single row of studio-wide configuration. The `only_row` check keeps it
-- single: the app upserts id = true.

create table if not exists public.studio_settings (
  id                  boolean primary key default true check (id),
  base_currency       char(3)     not null default 'NGN',
  invoice_prefix      text        not null default 'GF',
  next_invoice_seq    integer     not null default 1,
  -- Per-currency payment instructions rendered onto invoices, e.g.
  -- { "NGN": { "label": "Bank transfer", "lines": ["GTBank", "0123456789", "KeyPass Solutions"] },
  --   "USD": { "label": "Wise",          "lines": ["..."] } }
  payment_details     jsonb       not null default '{}'::jsonb,
  default_terms       text,
  default_tax_pct     numeric(5,2) not null default 0,
  updated_at          timestamptz not null default now()
);

insert into public.studio_settings (id) values (true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────── clients ──

create table if not exists public.studio_clients (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  company         text,
  email           text,
  phone           text,
  whatsapp        text,
  location        text,
  -- How they arrived. `referred_by` is free text (a person's name) or a note.
  source          text        not null default 'other',
  referred_by     text,
  -- Optional link back to the greyform.org inquiry that started it all.
  inquiry_id      uuid,
  -- Relationship drives default invoice treatment: friends_family and
  -- pro_bono get a "professional courtesy" discount line that shows full
  -- value before bringing the total down.
  relationship    text        not null default 'standard',
  default_discount_pct numeric(5,2) not null default 0,
  currency        char(3)     not null default 'NGN',
  -- Working-relationship facts surfaced at the top of every project view.
  preferred_channel text,
  decision_maker  text,
  update_cadence  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

-- ─────────────────────────────────────────────────────────────── projects ──

create table if not exists public.studio_projects (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete restrict,
  name            text        not null,
  kind            text        not null default 'development',
  status          text        not null default 'lead',
  description     text,
  tags            text[]      not null default '{}',
  pricing_model   text        not null default 'fixed',
  -- Money is stored as minor units (kobo, cents, pence) + ISO currency.
  quoted_minor    bigint,
  currency        char(3)     not null default 'NGN',
  discount_pct    numeric(5,2) not null default 0,
  discount_label  text,
  start_date      date,
  due_date        date,
  delivered_at    timestamptz,
  closed_at       timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists studio_projects_client_idx on public.studio_projects (client_id);
create index if not exists studio_projects_status_idx on public.studio_projects (status);

-- ───────────────────────────────────────────────────── milestones/timeline ──

create table if not exists public.studio_milestones (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        not null references public.studio_projects (id) on delete cascade,
  title           text        not null,
  description     text,
  due_date        date,
  completed_at    timestamptz,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists studio_milestones_project_idx on public.studio_milestones (project_id, sort_order);
create index if not exists studio_milestones_due_idx on public.studio_milestones (due_date) where completed_at is null;

-- ────────────────────────────────────────────────────────── correspondence ──
-- The paper trail: texts, calls, emails, meetings — noted with when they
-- happened, not just when they were logged. `is_decision` marks entries that
-- changed scope, price, or timeline (the ones that settle disputes later).

create table if not exists public.studio_correspondence (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete cascade,
  project_id      uuid        references public.studio_projects (id) on delete set null,
  channel         text        not null default 'other',
  direction       text        not null default 'in',
  occurred_at     timestamptz not null default now(),
  summary         text        not null,
  body            text,
  is_decision     boolean     not null default false,
  follow_up_on    date,
  created_at      timestamptz not null default now()
);

create index if not exists studio_correspondence_client_idx on public.studio_correspondence (client_id, occurred_at desc);
create index if not exists studio_correspondence_project_idx on public.studio_correspondence (project_id, occurred_at desc);
create index if not exists studio_correspondence_follow_up_idx on public.studio_correspondence (follow_up_on) where follow_up_on is not null;

-- ───────────────────────────────────────────────────────── events/calendar ──

create table if not exists public.studio_events (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        references public.studio_clients (id) on delete cascade,
  project_id      uuid        references public.studio_projects (id) on delete cascade,
  title           text        not null,
  kind            text        not null default 'call',
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location        text,
  agenda          text,
  outcome         text,
  status          text        not null default 'scheduled',
  -- Minutes before start at which to notify, e.g. '{1440, 60}' = 1 day + 1 hour.
  remind_minutes  integer[]   not null default '{1440, 60}',
  reminded_at     timestamptz[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists studio_events_starts_idx on public.studio_events (starts_at);
create index if not exists studio_events_project_idx on public.studio_events (project_id);

-- ─────────────────────────────────────────────────────────────── documents ──
-- Both generated (proposals, contracts, onboarding packs — structured
-- content in `content`, editable in-app, rendered to PDF/DOCX on demand)
-- and uploaded (signed contracts, receipts, briefs — a file in Storage at
-- `storage_path`). A generated doc that has been rendered may also carry a
-- storage_path for its frozen "as sent" copy.

create table if not exists public.studio_doc_templates (
  id              uuid primary key default gen_random_uuid(),
  kind            text        not null,
  name            text        not null,
  content         jsonb       not null default '{}'::jsonb,
  is_default      boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.studio_documents (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        references public.studio_clients (id) on delete cascade,
  project_id      uuid        references public.studio_projects (id) on delete cascade,
  kind            text        not null default 'other',
  title           text        not null,
  source          text        not null default 'uploaded',
  template_id     uuid        references public.studio_doc_templates (id) on delete set null,
  content         jsonb,
  status          text        not null default 'draft',
  storage_path    text,
  mime_type       text,
  size_bytes      bigint,
  sent_at         timestamptz,
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists studio_documents_project_idx on public.studio_documents (project_id);
create index if not exists studio_documents_kind_idx on public.studio_documents (kind);

-- ──────────────────────────────────────────────────────────────── invoices ──
-- Full value first, then the discount line brings it to the agreed price —
-- pro-bono and friends-family clients see what the work is actually worth.

create table if not exists public.studio_invoices (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete restrict,
  project_id      uuid        references public.studio_projects (id) on delete set null,
  number          text        not null unique,
  status          text        not null default 'draft',
  currency        char(3)     not null default 'NGN',
  issue_date      date        not null default current_date,
  due_date        date,
  discount_pct    numeric(5,2) not null default 0,
  discount_label  text,
  tax_pct         numeric(5,2) not null default 0,
  notes           text,
  terms           text,
  -- Rate to base currency, snapshotted when the invoice is issued so the
  -- finance overview doesn't drift as markets move.
  fx_rate_to_base numeric(18,8),
  sent_at         timestamptz,
  paid_at         timestamptz,
  voided_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists studio_invoices_client_idx on public.studio_invoices (client_id);
create index if not exists studio_invoices_status_idx on public.studio_invoices (status);

create table if not exists public.studio_invoice_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid        not null references public.studio_invoices (id) on delete cascade,
  title           text        not null,
  description     text,
  quantity        numeric(10,2) not null default 1,
  unit_minor      bigint      not null default 0,
  sort_order      integer     not null default 0
);

create index if not exists studio_invoice_items_invoice_idx on public.studio_invoice_items (invoice_id, sort_order);

-- ──────────────────────────────────────────────────────────────── payments ──
-- Payments can exist without an invoice (money already collected on projects
-- that started before this tool existed) and be linked to one later.

create table if not exists public.studio_payments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete restrict,
  project_id      uuid        references public.studio_projects (id) on delete set null,
  invoice_id      uuid        references public.studio_invoices (id) on delete set null,
  amount_minor    bigint      not null,
  currency        char(3)     not null default 'NGN',
  fx_rate_to_base numeric(18,8),
  received_at     date        not null default current_date,
  method          text        not null default 'bank_transfer',
  reference       text,
  receipt_document_id uuid    references public.studio_documents (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists studio_payments_project_idx on public.studio_payments (project_id);
create index if not exists studio_payments_invoice_idx on public.studio_payments (invoice_id);
create index if not exists studio_payments_received_idx on public.studio_payments (received_at desc);

-- ──────────────────────────────────────────────────────────────── expenses ──

create table if not exists public.studio_expenses (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        references public.studio_projects (id) on delete set null,
  title           text        not null,
  category        text        not null default 'other',
  amount_minor    bigint      not null,
  currency        char(3)     not null default 'NGN',
  fx_rate_to_base numeric(18,8),
  spent_at        date        not null default current_date,
  billable        boolean     not null default false,
  receipt_document_id uuid    references public.studio_documents (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists studio_expenses_project_idx on public.studio_expenses (project_id);
create index if not exists studio_expenses_spent_idx on public.studio_expenses (spent_at desc);

-- ─────────────────────────────────────────────────────────────── retainers ──
-- Three models (research: Ignition/Stark): hours bucket, deliverables quota,
-- or advisory access. Ambiguous terms are how recurring revenue becomes your
-- worst client relationship, so rollover / overage / notice are explicit.

create table if not exists public.studio_retainers (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete restrict,
  project_id      uuid        references public.studio_projects (id) on delete set null,
  name            text        not null,
  model           text        not null default 'hours',
  scope           text,
  amount_minor    bigint      not null,
  currency        char(3)     not null default 'NGN',
  cadence         text        not null default 'monthly',
  bill_day        integer     not null default 1 check (bill_day between 1 and 28),
  included_hours  numeric(6,2),
  included_deliverables text,
  rollover        text        not null default 'expire',
  overage_rate_minor bigint,
  response_time   text,
  notice_days     integer     not null default 30,
  started_on      date        not null default current_date,
  ends_on         date,
  status          text        not null default 'active',
  last_billed_on  date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists studio_retainers_status_idx on public.studio_retainers (status);

-- ───────────────────────────────────────────────────────────────── reviews ──

create table if not exists public.studio_reviews (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references public.studio_clients (id) on delete cascade,
  project_id      uuid        references public.studio_projects (id) on delete cascade,
  quote           text        not null,
  rating          integer     check (rating between 1 and 5),
  source          text        not null default 'other',
  received_at     date        not null default current_date,
  can_publish     boolean     not null default false,
  published       boolean     not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────── change requests ──
-- Scope-creep protection: any change to scope, price, or timeline gets a
-- written record with an explicit approval state before work starts.

create table if not exists public.studio_change_requests (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        not null references public.studio_projects (id) on delete cascade,
  title           text        not null,
  what_changes    text        not null,
  why             text,
  timeline_impact text,
  price_impact_minor bigint,
  currency        char(3),
  status          text        not null default 'draft',
  sent_at         timestamptz,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists studio_change_requests_project_idx on public.studio_change_requests (project_id);

-- ──────────────────────────────────────────────────────── handover vault ──
-- Per-project record of what was handed to the client at closeout (logins,
-- domains, hosting, design files) with a dated "transferred" state, so the
-- closeout proves everything left your hands.

create table if not exists public.studio_handover_items (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        not null references public.studio_projects (id) on delete cascade,
  label           text        not null,
  kind            text        not null default 'other',
  detail          text,
  transferred_at  timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists studio_handover_items_project_idx on public.studio_handover_items (project_id);

-- ─────────────────────────────────────────────────────────────── reminders ──
-- The notification queue: rows are drained by the cron tick, sent by web
-- push (and email fallback), and kept as the authoritative log — iOS may
-- drop pushes silently, this table never lies.

create table if not exists public.studio_reminders (
  id              uuid primary key default gen_random_uuid(),
  due_at          timestamptz not null,
  kind            text        not null default 'general',
  title           text        not null,
  body            text,
  url             text,
  client_id       uuid        references public.studio_clients (id) on delete cascade,
  project_id      uuid        references public.studio_projects (id) on delete cascade,
  event_id        uuid        references public.studio_events (id) on delete cascade,
  sent_at         timestamptz,
  channels        text[]      not null default '{push}',
  created_at      timestamptz not null default now()
);

create index if not exists studio_reminders_due_idx on public.studio_reminders (due_at) where sent_at is null;

-- ──────────────────────────────────────────────────────────────── fx rates ──
-- Daily cache of rates to base currency, fetched by cron; rows also serve as
-- the manual-override surface when an API rate looks wrong.

create table if not exists public.studio_fx_rates (
  currency        char(3)     not null,
  as_of           date        not null,
  rate_to_base    numeric(18,8) not null,
  source          text        not null default 'api',
  primary key (currency, as_of)
);

-- ─────────────────────────────────────────────────────── nudges dismissals ──
-- Suggestions ("send the onboarding pack", "ask for a review") are computed
-- from live data — only their dismissed/snoozed state is stored, keyed by a
-- deterministic string like 'onboarding-doc:<project_id>'.

create table if not exists public.studio_nudge_states (
  key             text primary key,
  dismissed_at    timestamptz,
  snoozed_until   timestamptz,
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────── push subscriptions ──

create table if not exists public.studio_push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  endpoint        text        not null unique,
  keys            jsonb       not null,
  device_label    text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

-- ──────────────────────────────────────────────────────── check constraints ──
-- Enum-style checks so typos can't sneak in, added idempotently.

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('studio_clients',        'studio_clients_source_check',        'source in (''inquiry'', ''phone_call'', ''referral'', ''repeat'', ''other'')'),
      ('studio_clients',        'studio_clients_relationship_check',  'relationship in (''standard'', ''friends_family'', ''pro_bono'')'),
      ('studio_projects',       'studio_projects_kind_check',         'kind in (''design'', ''development'', ''design_development'', ''retainer'', ''maintenance'', ''consulting'', ''other'')'),
      ('studio_projects',       'studio_projects_status_check',       'status in (''lead'', ''proposal_sent'', ''agreed'', ''onboarding'', ''active'', ''paused'', ''in_review'', ''delivered'', ''closed'', ''lost'')'),
      ('studio_projects',       'studio_projects_pricing_check',      'pricing_model in (''fixed'', ''hourly'', ''retainer'')'),
      ('studio_correspondence', 'studio_correspondence_channel_check','channel in (''email'', ''whatsapp'', ''sms'', ''call'', ''meeting'', ''in_person'', ''other'')'),
      ('studio_correspondence', 'studio_correspondence_direction_check', 'direction in (''in'', ''out'')'),
      ('studio_events',         'studio_events_kind_check',           'kind in (''call'', ''meeting'', ''deadline'', ''reminder'', ''other'')'),
      ('studio_events',         'studio_events_status_check',         'status in (''scheduled'', ''done'', ''cancelled'', ''no_show'')'),
      ('studio_documents',      'studio_documents_kind_check',        'kind in (''proposal'', ''contract'', ''signed_contract'', ''onboarding'', ''brief'', ''handover'', ''receipt'', ''invoice_pdf'', ''other'')'),
      ('studio_documents',      'studio_documents_source_check',      'source in (''generated'', ''uploaded'')'),
      ('studio_documents',      'studio_documents_status_check',      'status in (''draft'', ''sent'', ''signed'', ''archived'')'),
      ('studio_invoices',       'studio_invoices_status_check',       'status in (''draft'', ''sent'', ''partially_paid'', ''paid'', ''overdue'', ''void'', ''written_off'')'),
      ('studio_payments',       'studio_payments_method_check',       'method in (''bank_transfer'', ''cash'', ''wise'', ''paypal'', ''stripe'', ''crypto'', ''other'')'),
      ('studio_expenses',       'studio_expenses_category_check',     'category in (''software'', ''hosting'', ''domains'', ''fonts_stock'', ''contractor'', ''equipment'', ''transport'', ''data_airtime'', ''other'')'),
      ('studio_retainers',      'studio_retainers_cadence_check',     'cadence in (''monthly'', ''quarterly'')'),
      ('studio_retainers',      'studio_retainers_status_check',      'status in (''active'', ''paused'', ''ended'')'),
      ('studio_retainers',      'studio_retainers_model_check',       'model in (''hours'', ''deliverables'', ''advisory'')'),
      ('studio_retainers',      'studio_retainers_rollover_check',    'rollover in (''carry'', ''expire'', ''carry_with_note'')'),
      ('studio_reviews',        'studio_reviews_source_check',        'source in (''email'', ''whatsapp'', ''call'', ''form'', ''other'')'),
      ('studio_change_requests','studio_change_requests_status_check','status in (''draft'', ''sent'', ''approved'', ''rejected'')'),
      ('studio_handover_items', 'studio_handover_items_kind_check',   'kind in (''login'', ''domain'', ''hosting'', ''design_files'', ''code'', ''docs'', ''other'')')
    ) as t (tbl, conname, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.conname) then
      execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.conname, c.expr);
    end if;
  end loop;
end$$;

-- ────────────────────────────────────────────────────────── updated_at trg ──

create or replace function public.studio_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

do $$
declare
  t text;
begin
  foreach t in array array['studio_clients', 'studio_projects', 'studio_events', 'studio_doc_templates', 'studio_documents', 'studio_invoices', 'studio_retainers', 'studio_settings']
  loop
    if not exists (
      select 1 from pg_trigger where tgname = t || '_touch_updated_at'
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.studio_touch_updated_at()',
        t || '_touch_updated_at', t
      );
    end if;
  end loop;
end$$;

-- ───────────────────────────────────────────────────────────────────── RLS ──
-- Same posture as the site: server-only access via service-role key.

do $$
declare
  t text;
begin
  foreach t in array array[
    'studio_settings', 'studio_clients', 'studio_projects', 'studio_milestones', 'studio_correspondence',
    'studio_events', 'studio_doc_templates', 'studio_documents', 'studio_invoices', 'studio_invoice_items',
    'studio_payments', 'studio_expenses', 'studio_retainers', 'studio_reviews', 'studio_change_requests',
    'studio_handover_items', 'studio_reminders', 'studio_fx_rates', 'studio_nudge_states',
    'studio_push_subscriptions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end$$;

-- (Intentionally no policies: anon and authenticated roles get nothing.)

-- ───────────────────────────────────────────────────────── storage bucket ──
-- Private bucket for uploads (signed contracts, receipts) and frozen copies
-- of generated docs. All access goes through the app server via signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio',
  'studio',
  false,
  26214400, -- 25 MB per file; the app compresses images before upload anyway
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
