// ============================================================
//  SINESTESYA · Modelo de dominio
//  Cinco perfiles: Administración + 4 especialidades clínicas
// ============================================================

/**
 * Perfiles de acceso de la aplicación.
 * - `admin`: gestión administrativa y económica del centro.
 * - Especialidades clínicas: cada una accede SOLO a su historia clínica.
 * - `pendiente`: cuenta creada pero sin especialidad asignada (sin acceso clínico).
 */
export enum UserRole {
  ADMIN = 'admin',
  FISIOTERAPIA = 'fisioterapia',
  NUTRICION = 'nutricion',
  LOGOPEDIA = 'logopedia',
  PSICOLOGIA = 'psicologia',
  PENDIENTE = 'pendiente',
}

export type ClinicalSpecialty =
  | UserRole.FISIOTERAPIA
  | UserRole.NUTRICION
  | UserRole.LOGOPEDIA
  | UserRole.PSICOLOGIA;

export type Permission =
  // Agenda
  | 'agenda.view.own'
  | 'agenda.view.all'
  | 'agenda.manage.own'
  | 'agenda.manage.all'
  // Pacientes / administración
  | 'patients.view.assigned'
  | 'patients.view.all'
  | 'patients.create'
  | 'patients.edit.admin'
  | 'patients.assign'
  // Clínica
  | 'clinical.view.own'
  | 'clinical.write.own'
  | 'clinical.view.all' // solo con autorización expresa en el perfil
  | 'clinical.consents.manage'
  // Economía y centro
  | 'billing.view'
  | 'billing.manage'
  | 'services.manage'
  | 'reports.view'
  | 'professionals.manage'
  | 'settings.manage'
  | 'audit.view'
  // Comunicación
  | 'messages.use';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Especialidad clínica (también se guarda en profiles.profession). */
  profession?: ClinicalSpecialty | 'otro' | null;
  specialty?: string | null;
  avatarUrl?: string;
  phone?: string;
  /** Permisos granulares adicionales o revocados. El rol define los base. */
  permissions?: Permission[];
  active?: boolean;
  /** Rol tal y como vive en la base de datos (admin | medico | ...). */
  sourceRole?: string;
  demo?: boolean;
}

export interface LegalGuardian {
  name: string;
  dni: string;
  phone: string;
  email?: string;
  relationship: string;
}

export type PatientStatus = 'activo' | 'inactivo' | 'archivado';

export interface Patient {
  id: string;
  dni: string;
  firstName: string;
  secondName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  sex?: 'mujer' | 'hombre' | 'otro' | '';
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  updatedAt?: string;
  privacyPolicySigned: boolean;
  status?: PatientStatus;
  alerts?: string[];
  allergies?: string[];
  legalGuardian?: LegalGuardian | null;
  administrativeNotes?: string;
  assignedSpecialties?: ClinicalSpecialty[];
  demo?: boolean;
}

export interface MedicalHistoryEntry {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName: string;
  date: string;
  description: string;
  specialty?: ClinicalSpecialty;
  entryType?: 'administrativa' | 'clinica';
}

// ------------------------------------------------------------
// Agenda
// ------------------------------------------------------------

export enum AppointmentStatus {
  PENDING = 'pendiente',
  CONFIRMED = 'confirmada',
  COMPLETED = 'completada',
  CANCELLED = 'cancelada',
  NO_SHOW = 'ausente',
}

/** Estados administrativos encadenados (no sustituyen al estado de la cita). */
export type AppointmentAdminState =
  | 'reservada'
  | 'realizada'
  | 'registro_completado'
  | 'factura_emitida'
  | 'factura_pagada'
  | 'cancelada'
  | 'ausente';

export interface Appointment {
  id: string;
  patientId: string;
  professionalId: string;
  date: string; // ISO String
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  specialty?: ClinicalSpecialty;
  serviceId?: string | null;
  room?: string | null;
  durationMinutes?: number;
  clinicalRecorded?: boolean;
  invoiceId?: string | null;
  seriesId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  patientName?: string;
  professionalName?: string;
  demo?: boolean;
}

export interface Service {
  id: string;
  name: string;
  specialty: ClinicalSpecialty | 'administracion' | 'otro';
  durationMinutes: number;
  price: number;
  taxRate: number;
  room?: string | null;
  description?: string;
  active: boolean;
  demo?: boolean;
}

export interface Room {
  id: string;
  name: string;
  specialty?: ClinicalSpecialty | 'comun' | null;
  active: boolean;
}

// ------------------------------------------------------------
// Historia clínica modular (una fila por sesión / valoración)
// ------------------------------------------------------------

export type ClinicalRecordType = 'valoracion' | 'sesion' | 'informe' | 'alta';
export type ClinicalRecordStatus = 'borrador' | 'completado' | 'firmado';

export interface ClinicalObjective {
  id: string;
  description: string;
  area?: string;
  target?: string;
  progress: number; // 0-100
  status: 'activo' | 'conseguido' | 'revisar';
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName?: string;
  specialty: ClinicalSpecialty;
  recordType: ClinicalRecordType;
  date: string;
  appointmentId?: string | null;
  status: ClinicalRecordStatus;
  summary: string;
  objectives: ClinicalObjective[];
  data: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
  signedBy?: string | null;
  demo?: boolean;
}

export interface PsychTestApplication {
  id: string;
  testId: string;
  name: string;
  area: string;
  version: string;
  date: string;
  answers?: string;
  rawScore?: number | string;
  percentile?: number | string;
  result?: string;
  autoCorrected: boolean;
  reviewed: boolean;
  reviewerNote?: string;
  licenseNote?: string;
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  type: 'privacidad' | 'clinico' | 'menores' | 'coordinacion' | 'imagen' | 'grabacion';
  title: string;
  signed: boolean;
  signedBy: string;
  guardianName?: string;
  date: string;
  expiresAt?: string | null;
  notes?: string;
  createdBy?: string | null;
  createdAt: string;
  demo?: boolean;
}

// ------------------------------------------------------------
// Administración económica
// ------------------------------------------------------------

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'bizum';
export type PaymentConcept = 'fisioterapia' | 'nutricion' | 'psicologia' | 'logopedia' | 'otro';
export type Profession = PaymentConcept;

export interface Payment {
  id: string;
  concept: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  professionalId: string | null;
  patientId: string | null;
  appointmentId: string | null;
  invoiceId?: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  professionalName?: string;
  patientName?: string;
  demo?: boolean;
}

export interface PaymentInput {
  concept: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  professionalId?: string | null;
  patientId?: string | null;
  appointmentId?: string | null;
  invoiceId?: string | null;
  notes?: string;
}

export type InvoiceStatus = 'borrador' | 'emitida' | 'parcial' | 'pagada' | 'anulada';

export interface InvoiceItem {
  id: string;
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  patientName?: string;
  appointmentId?: string | null;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  method?: PaymentMethod | null;
  notes?: string;
  createdBy?: string | null;
  createdAt: string;
  demo?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  supplier: string;
  category: string;
  specialty?: ClinicalSpecialty | 'general' | null;
  amount: number;
  method: PaymentMethod;
  status: 'pagado' | 'pendiente';
  reference?: string;
  notes?: string;
  createdBy?: string | null;
  createdAt: string;
  demo?: boolean;
}

export interface SessionPackage {
  id: string;
  patientId: string;
  patientName?: string;
  name: string;
  serviceId?: string | null;
  specialty: ClinicalSpecialty;
  totalSessions: number;
  usedSessions: number;
  price: number;
  purchaseDate: string;
  expiryDate?: string | null;
  status: 'activo' | 'agotado' | 'caducado';
  notes?: string;
  demo?: boolean;
}

export interface CashClosing {
  id: string;
  date: string;
  openingFloat: number;
  totalCash: number;
  totalCard: number;
  totalOther: number;
  totalExpenses: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  closedBy: string;
  closedByName?: string;
  closedAt: string;
  notes?: string;
  demo?: boolean;
}

// ------------------------------------------------------------
// Seguridad y trazabilidad
// ------------------------------------------------------------

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  entity: string;
  entityId?: string | null;
  patientId?: string | null;
  detail: string;
  createdAt: string;
  demo?: boolean;
}

export interface CenterSettings {
  centerName: string;
  legalName: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  web: string;
  schedule: string;
  adminClinicalAccess: boolean;
  clinicalAccessJustification?: string;
  retentionYears: number;
  aiEnabled: boolean;
  aiPrivacyReviewed: boolean;
  lastBackupAt?: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  appointment_id?: string | null;
  type?: 'info' | 'warning' | 'danger' | 'success';
}

// ------------------------------------------------------------
// Solicitudes web / chat / auth (compatibilidad con módulos existentes)
// ------------------------------------------------------------

export type ReservationStatus = 'pendiente' | 'confirmada' | 'cancelada';

export interface ReservationRequest {
  id: string;
  area: string;
  paciente: string;
  edad: number | null;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  email: string;
  notas: string | null;
  status: ReservationStatus;
  professional_id: string | null;
  appointment_id: string | null;
  created_at: string;
}

export interface AcceptReservationPayload {
  id: string;
  professionalId: string;
  date: string;
  reason?: string;
  notes?: string;
  patientId?: string;
  newPatient?: {
    firstName: string;
    lastName: string;
    dni: string;
    birthDate: string;
    phone?: string;
    email?: string;
    address?: string;
  };
}

export interface ChatRoom {
  id: string;
  type: 'direct' | 'group';
  name: string;
  updatedAt: string;
  participants?: User[];
  lastMessage?: string;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  filePath?: string;
  createdAt: string;
  isRead: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface CommunicationLog {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName?: string;
  type: string;
  details: string;
  sentAt: string;
}

// ------------------------------------------------------------
// Utilidades de tipado para la UI
// ------------------------------------------------------------

export interface DashboardAlert {
  id: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
  actionLabel?: string;
  actionPath?: string;
}
