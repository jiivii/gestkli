import {
  User, UserRole, Patient, Appointment, AppointmentStatus, ClinicalSpecialty,
  DashboardAlert, PaymentConcept
} from './types';

import ACCOUNTING_SQL from './supabase/accounting_setup.sql?raw';
import SINESTESYA_SQL from './supabase/sinestesya_setup.sql?raw';

export { ACCOUNTING_SQL, SINESTESYA_SQL };

export const CENTER_NAME = 'Sinestesya';
export const CENTER_TAGLINE = 'Salud integral';
export const CENTER_LEGAL_NAME = 'Sinestesya Salud Integral S.L.';
export const CENTER_EMAIL = 'hola@sinestesya.es';
export const CENTER_PHONE = '+34 900 000 000';

// ------------------------------------------------------------
// Perfiles y especialidades
// ------------------------------------------------------------

export const CLINICAL_SPECIALTIES: ClinicalSpecialty[] = [
  UserRole.PSICOLOGIA,
  UserRole.FISIOTERAPIA,
  UserRole.LOGOPEDIA,
  UserRole.NUTRICION,
];

export interface RoleProfileConfig {
  id: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  /** Clases tailwind suaves, accesibles y consistentes. */
  soft: string;
  softHover: string;
  text: string;
  border: string;
  solid: string;
  solidHover: string;
  ring: string;
  hex: string;
  lightHex: string;
  navActive: string;
  gradient: string;
}

export const ROLE_PROFILES: Record<UserRole, RoleProfileConfig> = {
  [UserRole.ADMIN]: {
    id: UserRole.ADMIN,
    label: 'Administración',
    shortLabel: 'Admin',
    description: 'Agenda global, pacientes, facturación y funcionamiento del centro.',
    soft: 'bg-slate-100',
    softHover: 'hover:bg-slate-200',
    text: 'text-slate-700',
    border: 'border-slate-200',
    solid: 'bg-slate-700',
    solidHover: 'hover:bg-slate-800',
    ring: 'focus:ring-slate-400',
    hex: '#475569',
    lightHex: '#f1f5f9',
    navActive: 'bg-slate-100 text-slate-800 border-slate-200',
    gradient: 'from-slate-600 to-slate-800',
  },
  [UserRole.PSICOLOGIA]: {
    id: UserRole.PSICOLOGIA,
    label: 'Psicología',
    shortLabel: 'Psicología',
    description: 'Historia psicológica, pruebas psicométricas y planes de intervención.',
    soft: 'bg-psy-50',
    softHover: 'hover:bg-psy-100',
    text: 'text-psy-800',
    border: 'border-psy-200',
    solid: 'bg-psy-500',
    solidHover: 'hover:bg-psy-600',
    ring: 'focus:ring-psy-400',
    hex: '#c9a227',
    lightHex: '#fdf8e7',
    navActive: 'bg-psy-50 text-psy-900 border-psy-200',
    gradient: 'from-psy-400 to-psy-600',
  },
  [UserRole.FISIOTERAPIA]: {
    id: UserRole.FISIOTERAPIA,
    label: 'Fisioterapia',
    shortLabel: 'Fisioterapia',
    description: 'Valoración funcional, dolor, tratamiento y evolución física.',
    soft: 'bg-fisio-50',
    softHover: 'hover:bg-fisio-100',
    text: 'text-fisio-800',
    border: 'border-fisio-200',
    solid: 'bg-fisio-500',
    solidHover: 'hover:bg-fisio-600',
    ring: 'focus:ring-fisio-400',
    hex: '#4f8a70',
    lightHex: '#eef7f2',
    navActive: 'bg-fisio-50 text-fisio-900 border-fisio-200',
    gradient: 'from-fisio-400 to-fisio-600',
  },
  [UserRole.LOGOPEDIA]: {
    id: UserRole.LOGOPEDIA,
    label: 'Logopedia',
    shortLabel: 'Logopedia',
    description: 'Lenguaje, habla, voz, comunicación y evolución por objetivos.',
    soft: 'bg-logo-50',
    softHover: 'hover:bg-logo-100',
    text: 'text-logo-800',
    border: 'border-logo-200',
    solid: 'bg-logo-500',
    solidHover: 'hover:bg-logo-600',
    ring: 'focus:ring-logo-400',
    hex: '#4a7fb5',
    lightHex: '#eef5fb',
    navActive: 'bg-logo-50 text-logo-900 border-logo-200',
    gradient: 'from-logo-400 to-logo-600',
  },
  [UserRole.NUTRICION]: {
    id: UserRole.NUTRICION,
    label: 'Nutrición',
    shortLabel: 'Nutrición',
    description: 'Antropometría, planes alimentarios, adherencia y seguimiento.',
    soft: 'bg-nutri-50',
    softHover: 'hover:bg-nutri-100',
    text: 'text-nutri-800',
    border: 'border-nutri-200',
    solid: 'bg-nutri-500',
    solidHover: 'hover:bg-nutri-600',
    ring: 'focus:ring-nutri-400',
    hex: '#d9824b',
    lightHex: '#fdf2ea',
    navActive: 'bg-nutri-50 text-nutri-900 border-nutri-200',
    gradient: 'from-nutri-400 to-nutri-600',
  },
  [UserRole.PENDIENTE]: {
    id: UserRole.PENDIENTE,
    label: 'Perfil pendiente',
    shortLabel: 'Pendiente',
    description: 'Cuenta sin especialidad asignada. Sin acceso a datos clínicos.',
    soft: 'bg-gray-100',
    softHover: 'hover:bg-gray-200',
    text: 'text-gray-600',
    border: 'border-gray-200',
    solid: 'bg-gray-500',
    solidHover: 'hover:bg-gray-600',
    ring: 'focus:ring-gray-400',
    hex: '#6b7280',
    lightHex: '#f3f4f6',
    navActive: 'bg-gray-100 text-gray-700 border-gray-200',
    gradient: 'from-gray-400 to-gray-600',
  },
};

export const getRoleProfile = (role?: string | null): RoleProfileConfig =>
  ROLE_PROFILES[(role as UserRole) || UserRole.PENDIENTE] || ROLE_PROFILES[UserRole.PENDIENTE];

export const isClinicalRole = (role?: string | null): role is ClinicalSpecialty =>
  !!role && CLINICAL_SPECIALTIES.includes(role as ClinicalSpecialty);

export const isAdminRole = (role?: string | null): boolean => role === UserRole.ADMIN;

/** Perfil clínico a partir de una cuenta médica y su profesión. */
export const resolveAppRole = (dbRole?: string | null, profession?: string | null): UserRole => {
  if (dbRole === UserRole.ADMIN) return UserRole.ADMIN;
  if (isClinicalRole(profession)) return profession as ClinicalSpecialty;
  return UserRole.PENDIENTE;
};

export const SPECIALTY_LABELS: Record<string, string> = {
  [UserRole.PSICOLOGIA]: 'Psicología',
  [UserRole.FISIOTERAPIA]: 'Fisioterapia',
  [UserRole.LOGOPEDIA]: 'Logopedia',
  [UserRole.NUTRICION]: 'Nutrición',
  [UserRole.ADMIN]: 'Administración',
};

export const PROFESSION_OPTIONS: { value: string; label: string }[] = [
  { value: UserRole.PSICOLOGIA, label: 'Psicología' },
  { value: UserRole.FISIOTERAPIA, label: 'Fisioterapia' },
  { value: UserRole.LOGOPEDIA, label: 'Logopedia' },
  { value: UserRole.NUTRICION, label: 'Nutrición' },
  { value: 'otro', label: 'Otro' },
];

export const PROFESSION_LABELS: Record<string, string> = {
  [UserRole.PSICOLOGIA]: 'Psicología',
  [UserRole.FISIOTERAPIA]: 'Fisioterapia',
  [UserRole.LOGOPEDIA]: 'Logopedia',
  [UserRole.NUTRICION]: 'Nutrición',
  otro: 'Otro',
};

/** Roles de base de datos conservados por compatibilidad. */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administración',
  medico: 'Profesional clínico',
  enfermero: 'Enfermería',
  recepcionista: 'Recepción',
};

export const getProfessionalLabel = (profile: {
  profession?: string | null;
  specialty?: string | null;
  role?: string | null;
}): string => {
  if (profile.profession && PROFESSION_LABELS[profile.profession]) return PROFESSION_LABELS[profile.profession];
  if (profile.role && SPECIALTY_LABELS[profile.role]) return SPECIALTY_LABELS[profile.role];
  if (profile.specialty) return profile.specialty;
  if (profile.role && ROLE_LABELS[profile.role]) return ROLE_LABELS[profile.role];
  return profile.role || '';
};

export const getProfessionColor = (profession?: string | null): string => {
  switch (profession) {
    case UserRole.FISIOTERAPIA: return 'bg-fisio-50 text-fisio-800 border-fisio-200';
    case UserRole.NUTRICION: return 'bg-nutri-50 text-nutri-800 border-nutri-200';
    case UserRole.PSICOLOGIA: return 'bg-psy-50 text-psy-800 border-psy-200';
    case UserRole.LOGOPEDIA: return 'bg-logo-50 text-logo-800 border-logo-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

// ------------------------------------------------------------
// Citas
// ------------------------------------------------------------

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  [AppointmentStatus.PENDING]: 'Reservada',
  [AppointmentStatus.CONFIRMED]: 'Confirmada',
  [AppointmentStatus.COMPLETED]: 'Realizada',
  [AppointmentStatus.CANCELLED]: 'Cancelada',
  [AppointmentStatus.NO_SHOW]: 'Ausencia',
};

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  [AppointmentStatus.PENDING]: 'bg-amber-50 text-amber-800 border-amber-200',
  [AppointmentStatus.CONFIRMED]: 'bg-logo-50 text-logo-800 border-logo-200',
  [AppointmentStatus.COMPLETED]: 'bg-fisio-50 text-fisio-800 border-fisio-200',
  [AppointmentStatus.CANCELLED]: 'bg-red-50 text-red-700 border-red-200',
  [AppointmentStatus.NO_SHOW]: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const ADMIN_STATE_LABELS: Record<string, string> = {
  reservada: 'Reservada',
  realizada: 'Realizada',
  registro_completado: 'Registro clínico completo',
  factura_emitida: 'Factura emitida',
  factura_pagada: 'Factura pagada',
  cancelada: 'Cancelada',
  ausente: 'Ausente',
};

export const ADMIN_STATE_COLORS: Record<string, string> = {
  reservada: 'bg-amber-50 text-amber-800 border-amber-200',
  realizada: 'bg-logo-50 text-logo-800 border-logo-200',
  registro_completado: 'bg-violet-50 text-violet-700 border-violet-200',
  factura_emitida: 'bg-orange-50 text-orange-800 border-orange-200',
  factura_pagada: 'bg-fisio-50 text-fisio-800 border-fisio-200',
  cancelada: 'bg-red-50 text-red-700 border-red-200',
  ausente: 'bg-gray-100 text-gray-600 border-gray-200',
};

// ------------------------------------------------------------
// Economía
// ------------------------------------------------------------

export const PAYMENT_CONCEPTS: { value: PaymentConcept | string; label: string }[] = [
  { value: 'fisioterapia', label: 'Sesión Fisioterapia' },
  { value: 'nutricion', label: 'Sesión Nutrición' },
  { value: 'psicologia', label: 'Sesión Psicología' },
  { value: 'logopedia', label: 'Sesión Logopedia' },
  { value: 'otro', label: 'Otro concepto' },
];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'bizum', label: 'Bizum' },
];

export const EXPENSE_CATEGORIES = [
  'Alquiler', 'Suministros', 'Material clínico', 'Formación', 'Software',
  'Marketing', 'Seguros', 'Servicios externos', 'Personal', 'Otros',
];

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  parcial: 'Pago parcial',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600 border-gray-200',
  emitida: 'bg-orange-50 text-orange-800 border-orange-200',
  parcial: 'bg-amber-50 text-amber-800 border-amber-200',
  pagada: 'bg-fisio-50 text-fisio-800 border-fisio-200',
  anulada: 'bg-red-50 text-red-700 border-red-200',
};

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

export const localTodayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const localMonthStartISO = (offsetMonths = 0): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);

export const formatDate = (value?: string | null, withTime = false): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime
    ? date.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export const calcAge = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const isMinor = (birthDate?: string | null): boolean => {
  const age = calcAge(birthDate);
  return age !== null && age < 18;
};

export const patientFullName = (p?: Patient | null): string =>
  p ? [p.firstName, p.secondName, p.lastName, p.secondLastName].filter(Boolean).join(' ') : '';

export const initials = (name?: string): string =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'S';

export const getAppointmentAdminState = (
  appointment: Appointment,
  opts?: { hasClinicalRecord?: boolean; invoiceStatus?: string | null }
): string => {
  if (appointment.status === AppointmentStatus.CANCELLED) return 'cancelada';
  if (appointment.status === AppointmentStatus.NO_SHOW) return 'ausente';
  if (appointment.status !== AppointmentStatus.COMPLETED) return 'reservada';
  if (opts?.invoiceStatus === 'pagada') return 'factura_pagada';
  if (opts?.invoiceStatus === 'emitida' || opts?.invoiceStatus === 'parcial') return 'factura_emitida';
  if (appointment.clinicalRecorded || opts?.hasClinicalRecord) return 'registro_completado';
  return 'realizada';
};

export const getProfessionalUserName = (user?: User | null): string => user?.name || 'Profesional';

export const buildDashboardAlerts = (input: {
  completedWithoutRecord?: number;
  completedWithoutInvoice?: number;
  unpaidInvoices?: number;
  pendingReservations?: number;
  unconfirmedToday?: number;
  pendingExpenses?: number;
}): DashboardAlert[] => {
  const alerts: DashboardAlert[] = [];
  if (input.completedWithoutRecord) alerts.push({
    id: 'no-record', level: 'danger', title: 'Sesiones sin registro clínico',
    description: `${input.completedWithoutRecord} cita(s) realizada(s) sin evolución registrada.`,
    count: input.completedWithoutRecord, actionLabel: 'Revisar agenda', actionPath: '/appointments?filter=sin_registro',
  });
  if (input.completedWithoutInvoice) alerts.push({
    id: 'no-invoice', level: 'warning', title: 'Sesiones sin factura',
    description: `${input.completedWithoutInvoice} sesión(es) realizada(s) pendientes de facturar.`,
    count: input.completedWithoutInvoice, actionLabel: 'Facturación', actionPath: '/billing?tab=invoices',
  });
  if (input.unpaidInvoices) alerts.push({
    id: 'unpaid', level: 'warning', title: 'Facturas pendientes',
    description: `${input.unpaidInvoices} factura(s) emitidas con importe pendiente.`,
    count: input.unpaidInvoices, actionLabel: 'Ver facturas', actionPath: '/billing?tab=invoices',
  });
  if (input.pendingReservations) alerts.push({
    id: 'reservations', level: 'info', title: 'Solicitudes web pendientes',
    description: `${input.pendingReservations} solicitud(es) de cita esperando confirmación.`,
    count: input.pendingReservations, actionLabel: 'Revisar', actionPath: '/reservations',
  });
  if (input.unconfirmedToday) alerts.push({
    id: 'unconfirmed', level: 'info', title: 'Citas de hoy sin confirmar',
    description: `${input.unconfirmedToday} cita(s) de hoy siguen en estado reservada.`,
    count: input.unconfirmedToday, actionLabel: 'Agenda de hoy', actionPath: '/appointments',
  });
  if (input.pendingExpenses) alerts.push({
    id: 'expenses', level: 'info', title: 'Gastos pendientes de pago',
    description: `${input.pendingExpenses} gasto(s) registrados como pendientes.`,
    count: input.pendingExpenses, actionLabel: 'Gastos', actionPath: '/billing?tab=expenses',
  });
  return alerts;
};

// ------------------------------------------------------------
// Compatibilidad con el esquema anterior
// ------------------------------------------------------------

export const SQL_SCHEMA = `
-- El esquema completo y actualizado está en supabase/sinestesya_setup.sql.
-- Ejecútalo en el SQL Editor de Supabase antes de usar la aplicación en producción.
`;

export const MOCK_USERS: User[] = [];
export const MOCK_PATIENTS: Patient[] = [];
export const MOCK_APPOINTMENTS: Appointment[] = [];
