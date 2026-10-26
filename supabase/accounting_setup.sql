-- ============================================================
--  KLINIKA · CONTABILIDAD + PROFESIÓN DE PROFESIONALES
--  Ejecutar en el SQL Editor de Supabase (Dashboard → SQL).
--  No modifica datos existentes ni el ENUM de roles.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NUEVA COLUMNA: profession en profiles
--    (role sigue siendo el PERMISO: admin/medico/enfermero/recepcionista)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists profession text;

alter table public.profiles
  drop constraint if exists profiles_profession_check;

alter table public.profiles
  add constraint profiles_profession_check
  check (
    profession is null
    or profession in ('fisioterapia', 'nutricion', 'psicologia', 'logopedia', 'otro')
  );

-- ------------------------------------------------------------
-- 2. NUEVA TABLA: payments (cobros del centro)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  concept        text not null,                                  -- fisioterapia | nutricion | psicologia | logopedia | otro
  amount         numeric(10, 2) not null,
  method         text not null default 'efectivo',               -- efectivo | tarjeta | transferencia | bizum
  payment_date   date not null default current_date,
  professional_id uuid references public.profiles (id) on delete set null,
  patient_id      uuid references public.patients (id) on delete set null,
  appointment_id  uuid references public.appointments (id) on delete set null,
  notes          text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint payments_amount_positive check (amount >= 0),
  constraint payments_method_check
    check (method in ('efectivo', 'tarjeta', 'transferencia', 'bizum'))
);

create index if not exists payments_payment_date_idx
  on public.payments (payment_date desc);

create index if not exists payments_appointment_idx
  on public.payments (appointment_id);

-- ------------------------------------------------------------
-- 3. RLS: todos los usuarios autenticados ven la contabilidad,
--    solo admin y recepcionista crean/editan/borran.
-- ------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "Ver cobros" on public.payments;
create policy "Ver cobros" on public.payments
  for select to authenticated
  using (true);

drop policy if exists "Gestionar cobros" on public.payments;
create policy "Gestionar cobros" on public.payments
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'recepcionista')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'recepcionista')
    )
  );

-- ============================================================
--  VERIFICACIÓN RÁPIDA (opcional)
-- ============================================================
-- select id, profession from public.profiles order by full_name;
-- select * from public.payments limit 10;
