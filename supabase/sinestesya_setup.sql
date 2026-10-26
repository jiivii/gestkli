-- ============================================================
--  SINESTESYA SALUD INTEGRAL · ESQUEMA COMPLETO (v2)
--  Ejecutar en Supabase → SQL Editor.
--
--  Diseño:
--   · Una ficha administrativa única por paciente (DNI único).
--   · Historia clínica segmentada por especialidad en clinical_records.
--   · Administración NO puede leer notas clínicas salvo permiso
--     explícito «clinical.view.all» concedido en profiles.permissions.
--   · Auditoría inmutable de accesos y modificaciones.
--   · Facturación, cobros, gastos, bonos y cierres de caja.
--   · Mensajería interna separada de las salas físicas (clinic_rooms).
--
--  El script es idempotente: puede ejecutarse varias veces.
--  ANTES DE PRODUCCIÓN: revisa los avisos y prueba en un proyecto
--  de staging. No sustituye la revisión de un DPO/asesor legal.
-- ============================================================

create extension if not exists pgcrypto;

-- Evita que las funciones que referencian tablas creadas más abajo fallen
-- durante la creación. Las referencias se resuelven al ejecutar la función.
set check_function_bodies = off;

-- ============================================================
-- 1. PERFILES Y PERMISOS
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Usuario',
  email text,
  role text not null default 'medico',
  profession text,
  specialty text,
  permissions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists profession text;
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- La cuenta conserva role admin/medico por compatibilidad; la especialidad
-- real se guarda en profession y se valida en la aplicación.
alter table public.profiles drop constraint if exists profiles_profession_check;
alter table public.profiles add constraint profiles_profession_check
  check (profession is null or profession in ('fisioterapia', 'nutricion', 'psicologia', 'logopedia', 'otro'));

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_profession_idx on public.profiles (profession);

-- ------------------------------------------------------------
-- Funciones auxiliares de autorización
-- ------------------------------------------------------------

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active is not false
  );
$$;

create or replace function public.current_profession()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profession from public.profiles
  where id = auth.uid() and role = 'medico' and active is not false;
$$;

-- Permiso extra guardado en profiles.permissions (no incluye los permisos
-- base de cada rol, que se calculan en la aplicación).
create or replace function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select permissions ? permission
    from public.profiles
    where id = auth.uid() and active is not false
  ), false);
$$;

-- El paciente está vinculado al profesional actual por asignación o cita.
create or replace function public.is_assigned_to_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patient_professionals pp
    where pp.patient_id = p_patient_id
      and pp.professional_id = auth.uid()
      and pp.active is not false
  ) or exists (
    select 1 from public.appointments a
    where a.patient_id = p_patient_id
      and a.professional_id = auth.uid()
  );
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_participants rp
    where rp.room_id = p_room_id and rp.user_id = auth.uid()
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. PACIENTES Y VINCULACIÓN CLÍNICA
-- ============================================================

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  dni text not null,
  first_name text not null,
  second_name text,
  last_name text not null,
  second_last_name text,
  birth_date date not null,
  sex text,
  phone text,
  email text,
  address text,
  privacy_policy_signed boolean not null default false,
  status text not null default 'activo',
  alerts jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,
  legal_guardian_name text,
  legal_guardian_dni text,
  legal_guardian_phone text,
  legal_guardian_email text,
  legal_guardian_relationship text,
  administrative_notes text,
  assigned_specialties text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients add column if not exists second_name text;
alter table public.patients add column if not exists second_last_name text;
alter table public.patients add column if not exists sex text;
alter table public.patients add column if not exists phone text;
alter table public.patients add column if not exists email text;
alter table public.patients add column if not exists address text;
alter table public.patients add column if not exists privacy_policy_signed boolean not null default false;
alter table public.patients add column if not exists status text not null default 'activo';
alter table public.patients add column if not exists alerts jsonb not null default '[]'::jsonb;
alter table public.patients add column if not exists allergies jsonb not null default '[]'::jsonb;
alter table public.patients add column if not exists legal_guardian_name text;
alter table public.patients add column if not exists legal_guardian_dni text;
alter table public.patients add column if not exists legal_guardian_phone text;
alter table public.patients add column if not exists legal_guardian_email text;
alter table public.patients add column if not exists legal_guardian_relationship text;
alter table public.patients add column if not exists administrative_notes text;
alter table public.patients add column if not exists assigned_specialties text[] not null default '{}';
alter table public.patients add column if not exists created_at timestamptz not null default now();
alter table public.patients add column if not exists updated_at timestamptz not null default now();

create index if not exists patients_dni_idx on public.patients (upper(dni));
create index if not exists patients_name_idx on public.patients (lower(first_name), lower(last_name));

-- Prevención de duplicados por DNI. Si ya hubiera duplicados, el índice no
-- se crea y se muestra un aviso para que se revisen manualmente.
do $$
begin
  if not exists (
    select 1 from public.patients
    where dni is not null
    group by upper(dni)
    having count(*) > 1
  ) then
    execute 'create unique index if not exists patients_dni_unique on public.patients (upper(dni))';
  else
    raise notice 'AVISO: existen DNI duplicados. Revisa y fusiona las fichas antes de crear el índice único.';
  end if;
end $$;

create table if not exists public.patient_professionals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete cascade,
  specialty text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint patient_professionals_unique unique (patient_id, professional_id, specialty)
);

create index if not exists patient_professionals_patient_idx on public.patient_professionals (patient_id);
create index if not exists patient_professionals_professional_idx on public.patient_professionals (professional_id);

create table if not exists public.medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  professional_id uuid references public.profiles (id) on delete set null,
  description text not null,
  entry_type text not null default 'administrativa',
  date timestamptz not null default now()
);

create index if not exists medical_history_patient_idx on public.medical_history (patient_id, date desc);

-- ============================================================
-- 3. AGENDA
-- ============================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default 'otro',
  duration_minutes integer not null default 45,
  price numeric(10, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  room text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default 'comun',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete cascade,
  date timestamptz not null,
  status text not null default 'pendiente',
  reason text,
  notes text,
  specialty text,
  service_id uuid references public.services (id) on delete set null,
  room text,
  duration_minutes integer not null default 45,
  clinical_recorded boolean not null default false,
  invoice_id uuid,
  series_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments add column if not exists status text not null default 'pendiente';
alter table public.appointments add column if not exists reason text;
alter table public.appointments add column if not exists notes text;
alter table public.appointments add column if not exists specialty text;
alter table public.appointments add column if not exists service_id uuid;
alter table public.appointments add column if not exists room text;
alter table public.appointments add column if not exists duration_minutes integer not null default 45;
alter table public.appointments add column if not exists clinical_recorded boolean not null default false;
alter table public.appointments add column if not exists invoice_id uuid;
alter table public.appointments add column if not exists series_id text;
alter table public.appointments add column if not exists created_by uuid;
alter table public.appointments add column if not exists created_at timestamptz not null default now();
alter table public.appointments add column if not exists updated_at timestamptz not null default now();

create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_professional_idx on public.appointments (professional_id, date);
create index if not exists appointments_patient_idx on public.appointments (patient_id, date desc);

-- ============================================================
-- 4. HISTORIA CLÍNICA SEGMENTADA POR ESPECIALIDAD
-- ============================================================

create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  specialty text not null,
  record_type text not null default 'sesion',
  date timestamptz not null default now(),
  appointment_id uuid references public.appointments (id) on delete set null,
  status text not null default 'completado',
  summary text not null default '',
  objectives jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  signed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_records add column if not exists record_type text not null default 'sesion';
alter table public.clinical_records add column if not exists appointment_id uuid;
alter table public.clinical_records add column if not exists status text not null default 'completado';
alter table public.clinical_records add column if not exists summary text not null default '';
alter table public.clinical_records add column if not exists objectives jsonb not null default '[]'::jsonb;
alter table public.clinical_records add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.clinical_records add column if not exists version integer not null default 1;
alter table public.clinical_records add column if not exists signed_by uuid;
alter table public.clinical_records add column if not exists created_at timestamptz not null default now();
alter table public.clinical_records add column if not exists updated_at timestamptz not null default now();

alter table public.clinical_records drop constraint if exists clinical_records_specialty_check;
alter table public.clinical_records add constraint clinical_records_specialty_check
  check (specialty in ('psicologia', 'fisioterapia', 'logopedia', 'nutricion'));

create index if not exists clinical_records_patient_idx on public.clinical_records (patient_id, specialty, date desc);
create index if not exists clinical_records_professional_idx on public.clinical_records (professional_id, date desc);
create index if not exists clinical_records_appointment_idx on public.clinical_records (appointment_id);

-- ============================================================
-- 5. FACTURACIÓN, COBROS, GASTOS Y BONOS
-- ============================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  date date not null default current_date,
  due_date date,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  amount_paid numeric(10, 2) not null default 0,
  status text not null default 'borrador',
  method text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists appointment_id uuid;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists subtotal numeric(10, 2) not null default 0;
alter table public.invoices add column if not exists tax_rate numeric(5, 2) not null default 0;
alter table public.invoices add column if not exists tax_amount numeric(10, 2) not null default 0;
alter table public.invoices add column if not exists total numeric(10, 2) not null default 0;
alter table public.invoices add column if not exists amount_paid numeric(10, 2) not null default 0;
alter table public.invoices add column if not exists status text not null default 'borrador';
alter table public.invoices add column if not exists method text;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists created_by uuid;
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

create index if not exists invoices_date_idx on public.invoices (date desc);
create index if not exists invoices_patient_idx on public.invoices (patient_id, date desc);
create index if not exists invoices_number_idx on public.invoices (number);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  concept text not null default 'otro',
  amount numeric(10, 2) not null,
  method text not null default 'efectivo',
  payment_date date not null default current_date,
  professional_id uuid references public.profiles (id) on delete set null,
  patient_id uuid references public.patients (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payments add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

-- Los importes negativos representan devoluciones. Se elimina la restricción
-- antigua que solo permitía importes >= 0 y se exige importe distinto de cero.
alter table public.payments drop constraint if exists payments_amount_positive;
alter table public.payments drop constraint if exists payments_amount_nonzero;
alter table public.payments add constraint payments_amount_nonzero check (amount <> 0);
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('efectivo', 'tarjeta', 'transferencia', 'bizum'));

create index if not exists payments_payment_date_idx on public.payments (payment_date desc);
create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_patient_idx on public.payments (patient_id, payment_date desc);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  supplier text not null default '',
  category text not null default 'Otros',
  specialty text not null default 'general',
  amount numeric(10, 2) not null default 0,
  method text not null default 'transferencia',
  status text not null default 'pagado',
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (date desc);

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  opening_float numeric(10, 2) not null default 0,
  total_cash numeric(10, 2) not null default 0,
  total_card numeric(10, 2) not null default 0,
  total_other numeric(10, 2) not null default 0,
  total_expenses numeric(10, 2) not null default 0,
  expected_cash numeric(10, 2) not null default 0,
  counted_cash numeric(10, 2) not null default 0,
  difference numeric(10, 2) not null default 0,
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz not null default now(),
  notes text
);

create index if not exists cash_closings_date_idx on public.cash_closings (date desc);

create table if not exists public.session_packages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null default 'Bono de sesiones',
  service_id uuid references public.services (id) on delete set null,
  specialty text not null,
  total_sessions integer not null default 1,
  used_sessions integer not null default 0,
  price numeric(10, 2) not null default 0,
  purchase_date date not null default current_date,
  expiry_date date,
  status text not null default 'activo',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists session_packages_patient_idx on public.session_packages (patient_id, purchase_date desc);

-- ============================================================
-- 6. CONSENTIMIENTOS Y TRAZABILIDAD
-- ============================================================

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  type text not null default 'clinico',
  title text not null default 'Consentimiento',
  signed boolean not null default false,
  signed_by text,
  guardian_name text,
  date date not null default current_date,
  expires_at date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consents_patient_idx on public.consents (patient_id, created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_name text not null default '',
  role text not null default '',
  action text not null,
  entity text not null,
  entity_id text,
  patient_id uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_user_idx on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_patient_idx on public.audit_log (patient_id, created_at desc);

-- El registro de auditoría no se puede modificar ni eliminar desde la API.
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'El registro de auditoría es inmutable.';
end;
$$;

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  professional_id uuid references public.profiles (id) on delete set null,
  type text not null default 'otro',
  details text not null default '',
  sent_at timestamptz not null default now()
);

create index if not exists communication_logs_patient_idx on public.communication_logs (patient_id, sent_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null default '',
  read boolean not null default false,
  appointment_id uuid references public.appointments (id) on delete set null,
  type text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists notifications_professional_idx on public.notifications (professional_id, read, created_at desc);

-- ============================================================
-- 7. CONFIGURACIÓN DEL CENTRO
-- ============================================================

create table if not exists public.center_settings (
  id integer primary key default 1 check (id = 1),
  center_name text not null default 'Sinestesya',
  legal_name text not null default 'Sinestesya Salud Integral S.L.',
  cif text,
  address text,
  phone text,
  email text,
  web text,
  schedule text,
  admin_clinical_access boolean not null default false,
  clinical_access_justification text,
  retention_years integer not null default 5,
  ai_enabled boolean not null default false,
  ai_privacy_reviewed boolean not null default false,
  last_backup_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.center_settings add column if not exists admin_clinical_access boolean not null default false;
alter table public.center_settings add column if not exists clinical_access_justification text;
alter table public.center_settings add column if not exists retention_years integer not null default 5;
alter table public.center_settings add column if not exists ai_enabled boolean not null default false;
alter table public.center_settings add column if not exists ai_privacy_reviewed boolean not null default false;
alter table public.center_settings add column if not exists last_backup_at timestamptz;
alter table public.center_settings add column if not exists updated_at timestamptz not null default now();

insert into public.center_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- 8. MENSAJERÍA INTERNA (salas de chat)
-- ============================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct', 'group')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms add column if not exists type text not null default 'direct';
alter table public.rooms add column if not exists name text;
alter table public.rooms add column if not exists created_at timestamptz not null default now();
alter table public.rooms add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_participants (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  type text not null default 'text' check (type in ('text', 'image', 'file')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_idx on public.messages (room_id, created_at);

create or replace function public.create_direct_chat(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_room_id uuid;
  new_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida.';
  end if;
  if other_user_id = auth.uid() then
    raise exception 'No puedes abrir un chat contigo mismo.';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id and active is not false) then
    raise exception 'El profesional no existe o está inactivo.';
  end if;

  select r.id into existing_room_id
  from public.rooms r
  join public.room_participants p1 on p1.room_id = r.id and p1.user_id = auth.uid()
  join public.room_participants p2 on p2.room_id = r.id and p2.user_id = other_user_id
  where r.type = 'direct'
  limit 1;

  if existing_room_id is not null then
    return existing_room_id;
  end if;

  insert into public.rooms (type) values ('direct') returning id into new_room_id;
  insert into public.room_participants (room_id, user_id) values (new_room_id, auth.uid());
  insert into public.room_participants (room_id, user_id) values (new_room_id, other_user_id);
  return new_room_id;
end;
$$;

revoke all on function public.create_direct_chat(uuid) from public;
grant execute on function public.create_direct_chat(uuid) to authenticated;

-- ============================================================
-- 9. SOLICITUDES WEB (gestionadas por funciones serverless)
-- ============================================================

create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  paciente text not null default 'adulto',
  edad integer,
  fecha date not null,
  hora time not null,
  nombre text not null,
  telefono text,
  email text,
  notas text,
  status text not null default 'pendiente',
  professional_id uuid references public.profiles (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reservation_requests_status_idx on public.reservation_requests (status, created_at desc);

-- ============================================================
-- 10. IA (desactivada por defecto; solo historial propio)
-- ============================================================

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Conversación',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

-- ============================================================
-- 11. TRIGGERS updated_at
-- ============================================================

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists clinical_records_updated_at on public.clinical_records;
create trigger clinical_records_updated_at before update on public.clinical_records
  for each row execute function public.set_updated_at();

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists center_settings_updated_at on public.center_settings;
create trigger center_settings_updated_at before update on public.center_settings
  for each row execute function public.set_updated_at();

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_professionals enable row level security;
alter table public.medical_history enable row level security;
alter table public.services enable row level security;
alter table public.clinic_rooms enable row level security;
alter table public.appointments enable row level security;
alter table public.clinical_records enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_closings enable row level security;
alter table public.session_packages enable row level security;
alter table public.consents enable row level security;
alter table public.audit_log enable row level security;
alter table public.communication_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.center_settings enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reservation_requests enable row level security;
alter table public.ai_conversations enable row level security;

-- Eliminamos las políticas antiguas de las tablas gestionadas para evitar
-- reglas permisivas residuales. Solo afecta a políticas, no a datos.
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'patients', 'patient_professionals', 'medical_history',
        'services', 'clinic_rooms', 'appointments', 'clinical_records',
        'invoices', 'payments', 'expenses', 'cash_closings', 'session_packages',
        'consents', 'audit_log', 'communication_logs', 'notifications',
        'center_settings', 'rooms', 'room_participants', 'messages',
        'reservation_requests', 'ai_conversations'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Perfiles
-- ------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- Pacientes
-- ------------------------------------------------------------
create policy patients_select on public.patients
  for select to authenticated
  using (public.is_admin() or public.is_assigned_to_patient(id));

create policy patients_insert on public.patients
  for insert to authenticated
  with check (public.is_admin() or public.current_profession() is not null);

create policy patients_update_admin on public.patients
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy patients_delete_admin on public.patients
  for delete to authenticated using (public.is_admin());

create policy patient_professionals_select on public.patient_professionals
  for select to authenticated
  using (public.is_admin() or professional_id = auth.uid());

create policy patient_professionals_insert on public.patient_professionals
  for insert to authenticated
  with check (
    public.is_admin()
    or (professional_id = auth.uid() and specialty = public.current_profession())
  );

create policy patient_professionals_admin_write on public.patient_professionals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy patient_professionals_admin_delete on public.patient_professionals
  for delete to authenticated using (public.is_admin());

create policy medical_history_select on public.medical_history
  for select to authenticated
  using (public.is_admin() or public.is_assigned_to_patient(patient_id));

create policy medical_history_insert on public.medical_history
  for insert to authenticated
  with check (public.is_admin() or professional_id = auth.uid());

-- ------------------------------------------------------------
-- Servicios y salas físicas
-- ------------------------------------------------------------
create policy services_select on public.services
  for select to authenticated using (true);

create policy services_admin_write on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy clinic_rooms_select on public.clinic_rooms
  for select to authenticated using (true);

create policy clinic_rooms_admin_write on public.clinic_rooms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Agenda
-- ------------------------------------------------------------
create policy appointments_select on public.appointments
  for select to authenticated
  using (public.is_admin() or professional_id = auth.uid());

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (public.is_admin() or professional_id = auth.uid());

create policy appointments_update on public.appointments
  for update to authenticated
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

create policy appointments_delete_admin on public.appointments
  for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Historia clínica: solo la especialidad propia.
-- Administración requiere permiso explícito clinical.view.all
-- y únicamente puede leer, nunca escribir.
-- ------------------------------------------------------------
create policy clinical_records_select on public.clinical_records
  for select to authenticated
  using (
    (public.is_admin() and public.has_permission('clinical.view.all'))
    or (
      specialty = public.current_profession()
      and public.is_assigned_to_patient(patient_id)
    )
  );

create policy clinical_records_insert on public.clinical_records
  for insert to authenticated
  with check (
    professional_id = auth.uid()
    and specialty = public.current_profession()
    and public.is_assigned_to_patient(patient_id)
  );

create policy clinical_records_update on public.clinical_records
  for update to authenticated
  using (professional_id = auth.uid() and specialty = public.current_profession())
  with check (professional_id = auth.uid() and specialty = public.current_profession());

-- Sin política DELETE: los registros clínicos no se borran.

-- ------------------------------------------------------------
-- Facturación (solo administración)
-- ------------------------------------------------------------
create policy invoices_admin_all on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_admin_all on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy expenses_admin_all on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cash_closings_admin_all on public.cash_closings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy session_packages_admin_all on public.session_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Consentimientos
-- ------------------------------------------------------------
create policy consents_select on public.consents
  for select to authenticated
  using (public.is_admin() or public.is_assigned_to_patient(patient_id));

create policy consents_write on public.consents
  for insert to authenticated
  with check (public.is_admin() or public.is_assigned_to_patient(patient_id));

create policy consents_update on public.consents
  for update to authenticated
  using (public.is_admin() or public.is_assigned_to_patient(patient_id))
  with check (public.is_admin() or public.is_assigned_to_patient(patient_id));

create policy consents_delete_admin on public.consents
  for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Auditoría: lectura solo administración, escritura autenticada.
-- No hay políticas UPDATE/DELETE (además el trigger las bloquea).
-- ------------------------------------------------------------
create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.is_admin());

create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Comunicaciones y avisos
-- ------------------------------------------------------------
create policy communication_logs_select on public.communication_logs
  for select to authenticated
  using (public.is_admin() or public.is_assigned_to_patient(patient_id));

create policy communication_logs_insert on public.communication_logs
  for insert to authenticated
  with check (public.is_admin() or professional_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select to authenticated using (professional_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- ------------------------------------------------------------
-- Configuración del centro
-- ------------------------------------------------------------
create policy center_settings_select on public.center_settings
  for select to authenticated using (true);

create policy center_settings_admin_write on public.center_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Mensajería interna
-- ------------------------------------------------------------
create policy rooms_select_member on public.rooms
  for select to authenticated using (public.is_room_member(id));

create policy room_participants_select_member on public.room_participants
  for select to authenticated using (public.is_room_member(room_id));

create policy messages_select_member on public.messages
  for select to authenticated using (public.is_room_member(room_id));

create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_room_member(room_id));

-- ------------------------------------------------------------
-- Solicitudes web: solo lectura para administración. La escritura la
-- realizan las funciones serverless con service_role.
-- ------------------------------------------------------------
create policy reservation_requests_select_admin on public.reservation_requests
  for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- IA: historial propio
-- ------------------------------------------------------------
create policy ai_conversations_own on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 13. PERMISOS DE TABLAS Y FUNCIONES
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.patient_professionals to authenticated;
grant select, insert, update, delete on public.medical_history to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.clinic_rooms to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.clinical_records to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.cash_closings to authenticated;
grant select, insert, update, delete on public.session_packages to authenticated;
grant select, insert, update, delete on public.consents to authenticated;
grant select, insert on public.audit_log to authenticated;
grant select, insert, update, delete on public.communication_logs to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.center_settings to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.room_participants to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select on public.reservation_requests to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_profession() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_assigned_to_patient(uuid) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;

-- ============================================================
-- 14. ALTA AUTOMÁTICA DE PERFIL AL CREAR USUARIO EN AUTH
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, profession)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'medico',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 15. VERIFICACIÓN RÁPIDA
-- ============================================================
-- select id, full_name, role, profession, permissions, active from public.profiles order by full_name;
-- select specialty, count(*) from public.clinical_records group by specialty;
-- select id, number, total, amount_paid, status from public.invoices order by date desc limit 10;
-- select * from public.audit_log order by created_at desc limit 20;

-- ============================================================
--  FIN DEL ESQUEMA SINESTESYA
-- ============================================================

-- ============================================================
-- 15. DOCUMENTACI�N LEGAL, CONSENTIMIENTOS Y FIRMA ELECTR�NICA
-- ============================================================
-- Este bloque es idempotente. Antes de producci�n:
--   � Revisa los textos de las plantillas con el DPO/asesor jur�dico.
--   � Crea el bucket privado patient-documents (lo intenta este script).
--   � Configura RESEND_API_KEY, DOCUMENT_EMAIL_FROM y DOCUMENT_PUBLIC_URL.
--   � No uses la firma demo en producci�n. La firma OTP es simple
--     verificada; para avanzada/cualificada integra un proveedor eIDAS.

alter table public.patients add column if not exists secondary_legal_guardian_name text;
alter table public.patients add column if not exists secondary_legal_guardian_dni text;
alter table public.patients add column if not exists secondary_legal_guardian_phone text;
alter table public.patients add column if not exists secondary_legal_guardian_email text;
alter table public.patients add column if not exists secondary_legal_guardian_relationship text;
alter table public.patients add column if not exists representation_type text;
alter table public.patients add column if not exists guardianship_notes text;

alter table public.center_settings add column if not exists document_settings jsonb not null default '{}'::jsonb;
update public.center_settings
set document_settings = coalesce(document_settings, '{}'::jsonb) || jsonb_build_object(
  'signatureProvider', 'local_otp',
  'signatureProviderLabel', 'Firma electrónica simple verificada por OTP',
  'signatureLevel', 'simple_verificada_otp',
  'linkTtlHours', 72,
  'otpTtlMinutes', 10,
  'otpMaxAttempts', 5,
  'requireLegalReview', true,
  'privacyNoticeVersion', '1.0'
)
where id = 1 and (document_settings is null or document_settings = '{}'::jsonb);

-- Migración segura del default antiguo: el adaptador externo no está
-- implementado y debía fallar con 503. Solo se normaliza el valor de fábrica,
-- no una elección explícita de otro proveedor.
update public.center_settings
set document_settings = document_settings || jsonb_build_object(
  'signatureProvider', 'local_otp',
  'signatureProviderLabel', 'Firma electrónica simple verificada por OTP',
  'signatureLevel', 'simple_verificada_otp'
)
where id = 1
  and document_settings->>'signatureProvider' = 'external'
  and document_settings->>'signatureProviderLabel' = 'Proveedor externo pendiente de configurar'
  and document_settings->>'signatureLevel' = 'avanzada_proveedor';

-- ------------------------------------------------------------
-- 15.1 Permisos documentales (base por rol + extras del perfil)
-- ------------------------------------------------------------
create or replace function public.has_app_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active is not false
      and (
        case
          when p.role = 'admin' then p_permission in ('documents.view', 'documents.manage', 'documents.templates.manage')
          when p.role in ('fisioterapia', 'nutricion', 'logopedia', 'psicologia')
            then p_permission in ('documents.view', 'documents.manage')
          else false
        end
        or coalesce(p.permissions ? p_permission, false)
      )
  );
$$;

-- Permite leer documentos administrativos/transversales a quien tenga
-- documents.view. Los documentos cl�nicos exigen, adem�s, asignaci�n y
-- especialidad, o clinical.view.all en el caso de administraci�n.
create or replace function public.can_access_patient_document(
  p_patient_id uuid,
  p_specialty text,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_permission('documents.view')
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.active is not false
        and (
          (
            me.role = 'admin'
            and (
              (
                coalesce(p_specialty, '') = ''
                and coalesce(p_category, '') not in ('psicologia', 'fisioterapia', 'nutricion', 'logopedia', 'menores')
              )
              or public.has_permission('clinical.view.all')
            )
          )
          or (
            me.role in ('fisioterapia', 'nutricion', 'logopedia', 'psicologia')
            and public.is_assigned_to_patient(p_patient_id)
            and (
              coalesce(p_specialty, '') = ''
              or p_specialty in (me.role, coalesce(me.profession, ''))
            )
          )
        )
    );
$$;

create or replace function public.can_access_document_id(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patient_documents d
    where d.id = p_document_id
      and public.can_access_patient_document(d.patient_id, d.specialty, d.category)
  );
$$;

-- ------------------------------------------------------------
-- 15.2 Plantillas versionables
-- ------------------------------------------------------------
create table if not exists public.document_templates (
  id text primary key,
  name text not null,
  category text not null default 'general',
  specialty text,
  description text not null default '',
  body text not null default '',
  fields jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  active boolean not null default true,
  legal_status text not null default 'pendiente_revision',
  legal_reviewed_by text,
  legal_reviewed_at timestamptz,
  legal_review_notes text,
  requires_signature boolean not null default true,
  signer_rule text not null default 'manual',
  validity_days integer,
  required boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_templates add column if not exists active boolean not null default true;
alter table public.document_templates add column if not exists legal_status text not null default 'pendiente_revision';
alter table public.document_templates add column if not exists required boolean not null default false;

create index if not exists document_templates_category_idx on public.document_templates (category, specialty, active);

-- ------------------------------------------------------------
-- 15.3 Documentos del paciente (snapshot inmutable)
-- ------------------------------------------------------------
create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  template_id text references public.document_templates (id) on delete set null,
  template_name text not null default '',
  template_version integer not null default 1,
  category text not null default 'general',
  specialty text,
  professional_id uuid references public.profiles (id) on delete set null,
  professional_name text,
  service_id text,
  service_name text,
  appointment_id uuid,
  title text not null default 'Documento',
  status text not null default 'borrador',
  version integer not null default 1,
  is_current boolean not null default true,
  replaces_document_id uuid references public.patient_documents (id) on delete set null,
  replaced_by_document_id uuid references public.patient_documents (id) on delete set null,
  fields jsonb not null default '{}'::jsonb,
  patient_snapshot jsonb not null default '{}'::jsonb,
  professional_snapshot jsonb not null default '{}'::jsonb,
  center_snapshot jsonb not null default '{}'::jsonb,
  rendered_text text not null default '',
  content_sha256 text not null default '',
  signers jsonb not null default '[]'::jsonb,
  required_signatures integer not null default 0,
  signed_count integer not null default 0,
  signature_assurance text,
  signature_provider text,
  evidence jsonb,
  signed_pdf_path text,
  signed_pdf_sha256 text,
  generated_pdf_path text,
  external_upload boolean not null default false,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_documents_patient_idx on public.patient_documents (patient_id, created_at desc);
create index if not exists patient_documents_status_idx on public.patient_documents (patient_id, status, is_current);
create index if not exists patient_documents_sha_idx on public.patient_documents (content_sha256);

-- ------------------------------------------------------------
-- 15.4 Peticiones de firma (token/OTP solo como hash)
-- ------------------------------------------------------------
create table if not exists public.document_signature_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.patient_documents (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  signer_id text not null,
  recipient_name text not null default '',
  recipient_email text not null,
  condition text not null,
  token_hash text not null unique,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0,
  otp_last_sent_at timestamptz,
  verification_hash text,
  verification_expires_at timestamptz,
  verified_at timestamptz,
  status text not null default 'pendiente',
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  sent_count integer not null default 1,
  opened_at timestamptz,
  signed_at timestamptz,
  rejected_at timestamptz,
  failure_reason text,
  signed_pdf_path text,
  signed_pdf_sha256 text,
  evidence jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists document_requests_document_idx on public.document_signature_requests (document_id, created_at desc);
create index if not exists document_requests_status_idx on public.document_signature_requests (status, expires_at);
create index if not exists document_requests_email_idx on public.document_signature_requests (lower(recipient_email));

-- ------------------------------------------------------------
-- 15.5 Eventos inmutables
-- ------------------------------------------------------------
create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.patient_documents (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  request_id uuid references public.document_signature_requests (id) on delete set null,
  type text not null,
  actor_id uuid,
  actor_name text not null default 'Sistema',
  actor_type text not null default 'sistema',
  detail text not null default '',
  metadata jsonb,
  ip_hint text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists document_events_document_idx on public.document_events (document_id, created_at);
create index if not exists document_events_patient_idx on public.document_events (patient_id, created_at desc);

-- ------------------------------------------------------------
-- 15.6 Trigger de protecci�n del documento firmado
-- ------------------------------------------------------------
create or replace function public.protect_signed_document()
returns trigger
language plpgsql
as $$
begin
  -- No se puede declarar "firmado" sin un PDF final y una huella.
  if new.status = 'firmado' and (
    new.signed_at is null
    or coalesce(new.signed_pdf_path, '') = ''
    or coalesce(new.signed_pdf_sha256, '') = ''
  ) then
    raise exception 'Un documento firmado requiere PDF archivado, fecha y huella SHA-256.';
  end if;

  if tg_op = 'UPDATE' and (
    old.signed_at is not null
    or old.archived_at is not null
    or coalesce(old.signed_pdf_path, '') <> ''
  ) then
    if new.rendered_text is distinct from old.rendered_text
      or new.content_sha256 is distinct from old.content_sha256
      or new.template_id is distinct from old.template_id
      or new.template_version is distinct from old.template_version
      or new.title is distinct from old.title
      or new.category is distinct from old.category
      or new.specialty is distinct from old.specialty
      or new.patient_id is distinct from old.patient_id
      or new.fields is distinct from old.fields
      or new.patient_snapshot is distinct from old.patient_snapshot
      or new.professional_snapshot is distinct from old.professional_snapshot
      or new.center_snapshot is distinct from old.center_snapshot
      or new.signers is distinct from old.signers
      or new.signed_at is distinct from old.signed_at
      or new.archived_at is distinct from old.archived_at
      or new.signed_pdf_path is distinct from old.signed_pdf_path
      or new.signed_pdf_sha256 is distinct from old.signed_pdf_sha256
      or new.evidence is distinct from old.evidence
      or new.signature_assurance is distinct from old.signature_assurance
    then
      raise exception 'El documento firmado es inmutable. Crea una nueva versi�n y conserva la anterior.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_signed_document_trigger on public.patient_documents;
create trigger protect_signed_document_trigger
before insert or update on public.patient_documents
for each row execute function public.protect_signed_document();

-- Los eventos y las solicitudes tampoco se exponen a borrado desde el cliente.
drop trigger if exists document_events_immutable on public.document_events;
create or replace function public.document_event_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Los eventos documentales son inmutables.';
end;
$$;
create trigger document_events_immutable
before update or delete on public.document_events
for each row execute function public.document_event_immutable();

-- ------------------------------------------------------------
-- 15.7 RLS
-- ------------------------------------------------------------
alter table public.document_templates enable row level security;
alter table public.patient_documents enable row level security;
alter table public.document_signature_requests enable row level security;
alter table public.document_events enable row level security;

drop policy if exists document_templates_select on public.document_templates;
create policy document_templates_select on public.document_templates
for select to authenticated
using (
  (public.has_app_permission('documents.templates.manage'))
  or (active = true and legal_status = 'aprobada' and public.has_app_permission('documents.view'))
);

drop policy if exists document_templates_admin_insert on public.document_templates;
create policy document_templates_admin_insert on public.document_templates
for insert to authenticated
with check (public.is_admin() and public.has_app_permission('documents.templates.manage'));

drop policy if exists document_templates_admin_update on public.document_templates;
create policy document_templates_admin_update on public.document_templates
for update to authenticated
using (public.is_admin() and public.has_app_permission('documents.templates.manage'))
with check (public.is_admin() and public.has_app_permission('documents.templates.manage'));

drop policy if exists patient_documents_select on public.patient_documents;
create policy patient_documents_select on public.patient_documents
for select to authenticated
using (public.can_access_patient_document(patient_id, specialty, category));

drop policy if exists patient_documents_insert on public.patient_documents;
create policy patient_documents_insert on public.patient_documents
for insert to authenticated
with check (
  public.has_app_permission('documents.manage')
  and public.can_access_patient_document(patient_id, specialty, category)
);

drop policy if exists patient_documents_update on public.patient_documents;
create policy patient_documents_update on public.patient_documents
for update to authenticated
using (
  public.has_app_permission('documents.manage')
  and public.can_access_patient_document(patient_id, specialty, category)
)
with check (
  public.has_app_permission('documents.manage')
  and public.can_access_patient_document(patient_id, specialty, category)
);

drop policy if exists document_requests_select on public.document_signature_requests;
create policy document_requests_select on public.document_signature_requests
for select to authenticated
using (public.can_access_document_id(document_id));

drop policy if exists document_requests_insert on public.document_signature_requests;
create policy document_requests_insert on public.document_signature_requests
for insert to authenticated
with check (public.can_access_document_id(document_id) and public.has_app_permission('documents.manage'));

drop policy if exists document_requests_update on public.document_signature_requests;
create policy document_requests_update on public.document_signature_requests
for update to authenticated
using (public.can_access_document_id(document_id) and public.has_app_permission('documents.manage'))
with check (public.can_access_document_id(document_id) and public.has_app_permission('documents.manage'));

drop policy if exists document_events_select on public.document_events;
create policy document_events_select on public.document_events
for select to authenticated
using (public.can_access_document_id(document_id));

drop policy if exists document_events_insert on public.document_events;
create policy document_events_insert on public.document_events
for insert to authenticated
with check (public.can_access_document_id(document_id) and public.has_app_permission('documents.view'));

-- No hay pol�ticas de DELETE: los documentos, eventos y solicitudes no se
-- eliminan desde el cliente. La retenci�n se gestiona con un procedimiento
-- autorizado y documentado.

grant select on public.document_templates to authenticated;
grant insert, update on public.document_templates to authenticated;
grant select, insert, update on public.patient_documents to authenticated;
grant select, insert, update on public.document_signature_requests to authenticated;
grant select, insert on public.document_events to authenticated;
grant execute on function public.has_app_permission(text) to authenticated;
grant execute on function public.can_access_patient_document(uuid, text, text) to authenticated;
grant execute on function public.can_access_document_id(uuid) to authenticated;

-- ------------------------------------------------------------
-- 15.8 Bucket privado para PDF firmados
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-documents', 'patient-documents', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists patient_documents_storage_select on storage.objects;
create policy patient_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'patient-documents'
  and exists (
    select 1
    from public.patient_documents d
    where d.id::text = (storage.foldername(name))[2]
      and public.can_access_patient_document(d.patient_id, d.specialty, d.category)
  )
);

-- La subida y descarga pasan por /api/document-signing con service_role.
-- No se crean pol�ticas INSERT/UPDATE/DELETE para el cliente.
