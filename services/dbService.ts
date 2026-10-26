import { supabase, isConfigured } from '../supabaseClients';
import {
  AcceptReservationPayload, Appointment, AppointmentStatus, AuditEntry, CashClosing,
  CenterSettings, ChatMessage, ChatRoom, ClinicalRecord, ClinicalSpecialty, ConsentRecord,
  Expense, Invoice, InvoiceStatus, MedicalHistoryEntry, Notification, Patient, Payment,
  PaymentInput, Permission, ReservationRequest, Service, SessionPackage, User, UserRole,
} from '../types';
import {
  CLINICAL_SPECIALTIES, localTodayISO, resolveAppRole,
} from '../constants';
import { hasPermission, isAdmin } from './permissions';
import {
  demoLogin, getDemoSession, getDemoState, newId, saveDemoState, setDemoSession,
  updateDemoState, resetDemoState,
} from './demoStore';

// ============================================================
//  Configuración del backend
// ============================================================

const forceDemo = String((import.meta as any).env?.VITE_DEMO_MODE || '').toLowerCase() === 'true';
export const isDemoMode = !isConfigured || forceDemo;

const apiFetch = async (path: string, options: { method?: string; body?: any } = {}): Promise<any> => {
  if (!isConfigured) throw new Error('Supabase no está configurado.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { payload = null; }
  if (!res.ok || payload?.ok === false) throw new Error(payload?.error || `Error del servidor (${res.status}).`);
  return payload;
};

const normalizePermissions = (value: any): Permission[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((x): x is Permission => typeof x === 'string');
  if (typeof value === 'object') return Object.keys(value).filter(k => value[k] === true) as Permission[];
  return [];
};

const parseJsonArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
};

// ------------------------------------------------------------
//  Mappers
// ------------------------------------------------------------

const mapUser = (u: any): User => {
  const role = resolveAppRole(u.role, u.profession);
  return {
    id: u.id,
    name: u.full_name || u.name || 'Usuario',
    email: u.email || '',
    role,
    profession: u.profession || (CLINICAL_SPECIALTIES.includes(role as ClinicalSpecialty) ? role : null),
    specialty: u.specialty || null,
    avatarUrl: u.avatar_url || undefined,
    phone: u.phone || undefined,
    permissions: normalizePermissions(u.permissions),
    active: u.active !== false,
    sourceRole: u.role,
    demo: !!u.demo,
  };
};

const mapPatient = (p: any): Patient => ({
  id: p.id,
  dni: p.dni,
  firstName: p.first_name ?? p.firstName,
  secondName: p.second_name ?? p.secondName ?? '',
  lastName: p.last_name ?? p.lastName,
  secondLastName: p.second_last_name ?? p.secondLastName ?? '',
  birthDate: p.birth_date ?? p.birthDate,
  sex: p.sex || '',
  phone: p.phone || '',
  email: p.email || '',
  address: p.address || '',
  createdAt: p.created_at ?? p.createdAt,
  updatedAt: p.updated_at ?? p.updatedAt,
  privacyPolicySigned: !!p.privacy_policy_signed,
  status: p.status || 'activo',
  alerts: parseJsonArray(p.alerts),
  allergies: parseJsonArray(p.allergies),
  legalGuardian: p.legal_guardian_name ? {
    name: p.legal_guardian_name,
    dni: p.legal_guardian_dni || '',
    phone: p.legal_guardian_phone || '',
    email: p.legal_guardian_email || '',
    relationship: p.legal_guardian_relationship || '',
  } : (p.legalGuardian || null),
  administrativeNotes: p.administrative_notes || '',
  assignedSpecialties: p.assigned_specialties || p.assignedSpecialties || [],
  demo: !!p.demo,
});

const mapAppointment = (a: any): Appointment => ({
  id: a.id,
  patientId: a.patient_id ?? a.patientId,
  professionalId: a.professional_id ?? a.professionalId,
  date: a.date,
  status: a.status,
  reason: a.reason || '',
  notes: a.notes || '',
  specialty: a.specialty || undefined,
  serviceId: a.service_id ?? a.serviceId ?? null,
  room: a.room || null,
  durationMinutes: a.duration_minutes ?? a.durationMinutes ?? 45,
  clinicalRecorded: !!(a.clinical_recorded ?? a.clinicalRecorded),
  invoiceId: a.invoice_id ?? a.invoiceId ?? null,
  seriesId: a.series_id ?? a.seriesId ?? null,
  createdBy: a.created_by ?? a.createdBy ?? null,
  createdAt: a.created_at ?? a.createdAt,
  patientName: a.patients
    ? `${a.patients.first_name} ${a.patients.last_name}`
    : (a.patientName || ''),
  professionalName: a.profiles?.full_name || a.professionalName || '',
  demo: !!a.demo,
});

const mapClinicalRecord = (r: any): ClinicalRecord => ({
  id: r.id,
  patientId: r.patient_id ?? r.patientId,
  professionalId: r.professional_id ?? r.professionalId,
  professionalName: r.profiles?.full_name || r.professionalName || '',
  specialty: r.specialty,
  recordType: r.record_type ?? r.recordType,
  date: r.date,
  appointmentId: r.appointment_id ?? r.appointmentId ?? null,
  status: r.status || 'completado',
  summary: r.summary || '',
  objectives: Array.isArray(r.objectives) ? r.objectives : [],
  data: typeof r.data === 'string' ? safeParse(r.data) : (r.data || {}),
  version: Number(r.version) || 1,
  createdAt: r.created_at ?? r.createdAt,
  updatedAt: r.updated_at ?? r.updatedAt,
  signedBy: r.signed_by ?? r.signedBy ?? null,
  demo: !!r.demo,
});

const safeParse = (value: string) => { try { return JSON.parse(value); } catch { return {}; } };

const mapPayment = (p: any): Payment => ({
  id: p.id,
  concept: p.concept,
  amount: Number(p.amount) || 0,
  method: p.method,
  paymentDate: p.payment_date ?? p.paymentDate,
  professionalId: p.professional_id ?? p.professionalId ?? null,
  patientId: p.patient_id ?? p.patientId ?? null,
  appointmentId: p.appointment_id ?? p.appointmentId ?? null,
  invoiceId: p.invoice_id ?? p.invoiceId ?? null,
  notes: p.notes || null,
  createdBy: p.created_by ?? p.createdBy ?? null,
  createdAt: p.created_at ?? p.createdAt,
  professionalName: p.profiles?.full_name,
  patientName: p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : undefined,
  demo: !!p.demo,
});

const mapInvoice = (i: any): Invoice => ({
  id: i.id,
  number: i.number,
  patientId: i.patient_id ?? i.patientId,
  patientName: i.patients ? `${i.patients.first_name} ${i.patients.last_name}` : i.patientName,
  appointmentId: i.appointment_id ?? i.appointmentId ?? null,
  date: i.date,
  dueDate: i.due_date ?? i.dueDate,
  items: Array.isArray(i.items) ? i.items : (safeParse(i.items || '[]') as any),
  subtotal: Number(i.subtotal) || 0,
  taxRate: Number(i.tax_rate ?? i.taxRate) || 0,
  taxAmount: Number(i.tax_amount ?? i.taxAmount) || 0,
  total: Number(i.total) || 0,
  amountPaid: Number(i.amount_paid ?? i.amountPaid) || 0,
  status: i.status || 'borrador',
  method: i.method || null,
  notes: i.notes || '',
  createdBy: i.created_by ?? i.createdBy ?? null,
  createdAt: i.created_at ?? i.createdAt,
  demo: !!i.demo,
});

const mapExpense = (e: any): Expense => ({
  id: e.id,
  date: e.date,
  supplier: e.supplier,
  category: e.category,
  specialty: e.specialty || 'general',
  amount: Number(e.amount) || 0,
  method: e.method,
  status: e.status || 'pagado',
  reference: e.reference || '',
  notes: e.notes || '',
  createdBy: e.created_by ?? e.createdBy ?? null,
  createdAt: e.created_at ?? e.createdAt,
  demo: !!e.demo,
});

const mapPackage = (p: any): SessionPackage => ({
  id: p.id,
  patientId: p.patient_id ?? p.patientId,
  patientName: p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : p.patientName,
  name: p.name,
  serviceId: p.service_id ?? p.serviceId ?? null,
  specialty: p.specialty,
  totalSessions: Number(p.total_sessions ?? p.totalSessions) || 0,
  usedSessions: Number(p.used_sessions ?? p.usedSessions) || 0,
  price: Number(p.price) || 0,
  purchaseDate: p.purchase_date ?? p.purchaseDate,
  expiryDate: p.expiry_date ?? p.expiryDate ?? null,
  status: p.status || 'activo',
  notes: p.notes || '',
  demo: !!p.demo,
});

const mapConsent = (c: any): ConsentRecord => ({
  id: c.id,
  patientId: c.patient_id ?? c.patientId,
  type: c.type,
  title: c.title,
  signed: !!c.signed,
  signedBy: c.signed_by ?? c.signedBy ?? '',
  guardianName: c.guardian_name ?? c.guardianName ?? '',
  date: c.date || '',
  expiresAt: c.expires_at ?? c.expiresAt ?? null,
  notes: c.notes || '',
  createdBy: c.created_by ?? c.createdBy ?? null,
  createdAt: c.created_at ?? c.createdAt,
  demo: !!c.demo,
});

const mapAudit = (a: any): AuditEntry => ({
  id: a.id,
  userId: a.user_id ?? a.userId,
  userName: a.user_name ?? a.userName,
  role: a.role || '',
  action: a.action,
  entity: a.entity,
  entityId: a.entity_id ?? a.entityId ?? null,
  patientId: a.patient_id ?? a.patientId ?? null,
  detail: a.detail || '',
  createdAt: a.created_at ?? a.createdAt,
  demo: !!a.demo,
});

const defaultSettings: CenterSettings = {
  centerName: 'Sinestesya',
  legalName: 'Sinestesya Salud Integral S.L.',
  cif: '',
  address: '',
  phone: '',
  email: 'hola@sinestesya.es',
  web: 'www.sinestesya.es',
  schedule: 'Lunes a viernes · 09:00–20:00',
  adminClinicalAccess: false,
  clinicalAccessJustification: '',
  retentionYears: 5,
  aiEnabled: false,
  aiPrivacyReviewed: false,
  lastBackupAt: null,
};

// ============================================================
//  dbService
// ============================================================

export const dbService = {
  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------
  async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
    if (isDemoMode) {
      const user = demoLogin(email, password);
      return user ? { user, token: 'demo-token' } : null;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return null;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (!profile) return null;
      return { user: mapUser(profile), token: data.session?.access_token || '' };
    } catch { return null; }
  },

  async getSession(): Promise<User | null> {
    if (isDemoMode) return getDemoSession();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      return profile ? mapUser(profile) : null;
    } catch { return null; }
  },

  async logout() {
    if (isDemoMode) { setDemoSession(null); return; }
    await supabase.auth.signOut();
  },

  isDemo: () => isDemoMode,
  resetDemo: () => { resetDemoState(); setDemoSession(null); },

  // ----------------------------------------------------------
  // NOTIFICACIONES
  // ----------------------------------------------------------
  async getNotifications(professionalId: string): Promise<Notification[]> {
    if (isDemoMode) {
      return getDemoState().notifications.filter(n => !n.read).slice(0, 20);
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('id,title,message,read,created_at,appointment_id')
      .eq('professional_id', professionalId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []) as Notification[];
  },

  async markNotificationRead(notificationId: string) {
    if (isDemoMode) {
      updateDemoState(s => {
        const n = s.notifications.find(x => x.id === notificationId);
        if (n) n.read = true;
      });
      return true;
    }
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    return !error;
  },

  // ----------------------------------------------------------
  // PACIENTES
  // ----------------------------------------------------------
  async getPatients(userId?: string, role?: string): Promise<Patient[]> {
    if (isDemoMode) {
      const state = getDemoState();
      if (!userId || role === UserRole.ADMIN) return state.patients;
      const assignmentPatients = state.assignments
        .filter(a => a.professionalId === userId && a.active)
        .map(a => a.patientId);
      const appointmentPatients = state.appointments
        .filter(a => a.professionalId === userId)
        .map(a => a.patientId);
      const allowed = new Set([...assignmentPatients, ...appointmentPatients]);
      return state.patients.filter(p => allowed.has(p.id));
    }

    if (!userId || role === UserRole.ADMIN) {
      const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(mapPatient);
    }

    const { data: assignments } = await supabase
      .from('patient_professionals')
      .select('patient_id')
      .eq('professional_id', userId)
      .eq('active', true);
    let ids = Array.from(new Set((assignments || []).map((a: any) => a.patient_id)));
    if (ids.length === 0) {
      const { data: appts } = await supabase.from('appointments').select('patient_id').eq('professional_id', userId);
      ids = Array.from(new Set((appts || []).map((a: any) => a.patient_id)));
    }
    if (ids.length === 0) return [];
    const { data } = await supabase.from('patients').select('*').in('id', ids).order('created_at', { ascending: false });
    return (data || []).map(mapPatient);
  },

  async getPatientById(id: string): Promise<Patient | undefined> {
    if (isDemoMode) return getDemoState().patients.find(p => p.id === id);
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    return error || !data ? undefined : mapPatient(data);
  },

  async createPatient(patient: Partial<Patient>, creator?: User): Promise<{ success: boolean; id?: string; error?: string }> {
    const dni = (patient.dni || '').trim().toUpperCase();
    if (!patient.firstName || !patient.lastName || !dni || !patient.birthDate) {
      return { success: false, error: 'Nombre, apellidos, DNI y fecha de nacimiento son obligatorios.' };
    }

    if (isDemoMode) {
      const state = getDemoState();
      if (state.patients.some(p => p.dni.toUpperCase() === dni)) {
        return { success: false, error: 'Ya existe una ficha con ese DNI. Evita crear duplicados.' };
      }
      const id = newId('p');
      const newPatient: Patient = {
        id, dni,
        firstName: patient.firstName.trim(),
        secondName: patient.secondName || '',
        lastName: patient.lastName.trim(),
        secondLastName: patient.secondLastName || '',
        birthDate: patient.birthDate,
        sex: patient.sex || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        createdAt: new Date().toISOString(),
        privacyPolicySigned: !!patient.privacyPolicySigned,
        status: 'activo',
        alerts: patient.alerts || [],
        allergies: patient.allergies || [],
        legalGuardian: patient.legalGuardian || null,
        administrativeNotes: patient.administrativeNotes || '',
        assignedSpecialties: creator && CLINICAL_SPECIALTIES.includes(creator.role as ClinicalSpecialty)
          ? [creator.role as ClinicalSpecialty]
          : [],
        demo: true,
      };
      state.patients.unshift(newPatient);
      if (creator && CLINICAL_SPECIALTIES.includes(creator.role as ClinicalSpecialty)) {
        state.assignments.push({
          id: newId('asg'), patientId: id, professionalId: creator.id,
          specialty: creator.role, active: true, createdAt: new Date().toISOString(),
        });
      }
      state.medicalHistory.unshift({
        id: newId('mh'), patientId: id, professionalId: creator?.id || 'system',
        professionalName: creator?.name || 'Sistema', date: new Date().toISOString(),
        description: 'Alta administrativa de paciente.', entryType: 'administrativa',
      });
      saveDemoState(state);
      await this.logAudit(creator, 'patient.create', 'patient', id, `Alta de paciente ${newPatient.firstName} ${newPatient.lastName}`, id);
      return { success: true, id };
    }

    const { data: existing } = await supabase.from('patients').select('id').eq('dni', dni).maybeSingle();
    if (existing?.id) return { success: false, error: 'Ya existe una ficha con ese DNI. Evita crear duplicados.' };

    const payload: any = {
      dni,
      first_name: patient.firstName,
      second_name: patient.secondName || null,
      last_name: patient.lastName,
      second_last_name: patient.secondLastName || null,
      birth_date: patient.birthDate,
      sex: patient.sex || null,
      phone: patient.phone || null,
      email: patient.email || null,
      address: patient.address || null,
      privacy_policy_signed: !!patient.privacyPolicySigned,
      alerts: patient.alerts || [],
      allergies: patient.allergies || [],
      legal_guardian_name: patient.legalGuardian?.name || null,
      legal_guardian_dni: patient.legalGuardian?.dni || null,
      legal_guardian_phone: patient.legalGuardian?.phone || null,
      legal_guardian_email: patient.legalGuardian?.email || null,
      legal_guardian_relationship: patient.legalGuardian?.relationship || null,
      administrative_notes: patient.administrativeNotes || null,
      status: 'activo',
    };
    const { data, error } = await supabase.from('patients').insert(payload).select('id').single();
    if (error || !data) return { success: false, error: error?.message || 'No se pudo crear la ficha.' };
    if (creator) {
      await supabase.from('medical_history').insert({
        patient_id: data.id, professional_id: creator.id, description: 'Alta administrativa de paciente.',
      });
      if (CLINICAL_SPECIALTIES.includes(creator.role as ClinicalSpecialty)) {
        await supabase.from('patient_professionals').insert({
          patient_id: data.id, professional_id: creator.id, specialty: creator.role, active: true,
        });
      }
      await this.logAudit(creator, 'patient.create', 'patient', data.id, 'Alta de paciente', data.id);
    }
    return { success: true, id: data.id };
  },

  async updatePatient(id: string, patch: Partial<Patient>, actor?: User): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => {
        const p = s.patients.find(x => x.id === id);
        if (p) Object.assign(p, patch, { updatedAt: new Date().toISOString() });
      });
      await this.logAudit(actor, 'patient.update', 'patient', id, 'Actualización de datos administrativos', id);
      return true;
    }
    const payload: any = {};
    if (patch.firstName !== undefined) payload.first_name = patch.firstName;
    if (patch.secondName !== undefined) payload.second_name = patch.secondName || null;
    if (patch.lastName !== undefined) payload.last_name = patch.lastName;
    if (patch.secondLastName !== undefined) payload.second_last_name = patch.secondLastName || null;
    if (patch.dni !== undefined) payload.dni = patch.dni;
    if (patch.birthDate !== undefined) payload.birth_date = patch.birthDate;
    if (patch.sex !== undefined) payload.sex = patch.sex || null;
    if (patch.phone !== undefined) payload.phone = patch.phone;
    if (patch.email !== undefined) payload.email = patch.email;
    if (patch.address !== undefined) payload.address = patch.address;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.alerts !== undefined) payload.alerts = patch.alerts;
    if (patch.allergies !== undefined) payload.allergies = patch.allergies;
    if (patch.administrativeNotes !== undefined) payload.administrative_notes = patch.administrativeNotes;
    if (patch.privacyPolicySigned !== undefined) payload.privacy_policy_signed = patch.privacyPolicySigned;
    if (patch.legalGuardian !== undefined) {
      payload.legal_guardian_name = patch.legalGuardian?.name || null;
      payload.legal_guardian_dni = patch.legalGuardian?.dni || null;
      payload.legal_guardian_phone = patch.legalGuardian?.phone || null;
      payload.legal_guardian_email = patch.legalGuardian?.email || null;
      payload.legal_guardian_relationship = patch.legalGuardian?.relationship || null;
    }
    payload.updated_at = new Date().toISOString();
    const { error } = await supabase.from('patients').update(payload).eq('id', id);
    if (!error) await this.logAudit(actor, 'patient.update', 'patient', id, 'Actualización de datos administrativos', id);
    return !error;
  },

  async updatePatientPrivacy(id: string, signed: boolean) {
    if (isDemoMode) {
      updateDemoState(s => {
        const p = s.patients.find(x => x.id === id);
        if (p) p.privacyPolicySigned = signed;
      });
      return true;
    }
    const { error } = await supabase.from('patients').update({ privacy_policy_signed: signed }).eq('id', id);
    return !error;
  },

  async assignPatient(patientId: string, professionalId: string, specialty?: ClinicalSpecialty): Promise<boolean> {
    if (isDemoMode) {
      const state = getDemoState();
      const professional = state.users.find(u => u.id === professionalId);
      const resolvedSpecialty = specialty || (professional?.role as ClinicalSpecialty);
      if (!resolvedSpecialty) return false;
      const existing = state.assignments.find(a => a.patientId === patientId && a.professionalId === professionalId && a.active);
      if (!existing) {
        state.assignments.push({
          id: newId('asg'), patientId, professionalId, specialty: resolvedSpecialty,
          active: true, createdAt: new Date().toISOString(),
        });
      }
      const patient = state.patients.find(p => p.id === patientId);
      if (patient) {
        patient.assignedSpecialties = Array.from(new Set([...(patient.assignedSpecialties || []), resolvedSpecialty]));
      }
      saveDemoState(state);
      return true;
    }
    const professional = await supabase.from('profiles').select('id, profession, role').eq('id', professionalId).maybeSingle();
    const resolved = specialty || professional.data?.profession;
    if (!resolved) return false;
    const { error } = await supabase.from('patient_professionals').upsert({
      patient_id: patientId, professional_id: professionalId, specialty: resolved, active: true,
    }, { onConflict: 'patient_id,professional_id,specialty' });
    if (!error) {
      await supabase.from('medical_history').insert({
        patient_id: patientId, professional_id: professionalId, description: 'Vinculación clínica con el profesional.',
      });
    }
    return !error;
  },

  async getAssignments(patientId?: string): Promise<{ patientId: string; professionalId: string; specialty: string; active: boolean }[]> {
    if (isDemoMode) {
      const list = getDemoState().assignments;
      return (patientId ? list.filter(a => a.patientId === patientId) : list) as any;
    }
    let query = supabase.from('patient_professionals').select('patient_id,professional_id,specialty,active');
    if (patientId) query = query.eq('patient_id', patientId);
    const { data } = await query;
    return (data || []).map((a: any) => ({
      patientId: a.patient_id, professionalId: a.professional_id, specialty: a.specialty, active: a.active,
    }));
  },

  async getCommunicationLogs(patientId: string) {
    if (isDemoMode) return [];
    const { data } = await supabase.from('communication_logs').select('*, profiles(full_name)').eq('patient_id', patientId).order('sent_at', { ascending: false });
    return (data || []).map((l: any) => ({
      id: l.id, patientId: l.patient_id, professionalId: l.professional_id,
      professionalName: l.profiles?.full_name, type: l.type, details: l.details, sentAt: l.sent_at,
    }));
  },

  async sendPrivacyEmail(patientId: string, professionalId: string) {
    if (isDemoMode) return { success: true, message: 'Simulación de demostración: no se ha enviado ningún correo real.' };
    await supabase.from('communication_logs').insert({
      patient_id: patientId, professional_id: professionalId, type: 'RGPD_EMAIL', details: 'Envío de documentación RGPD',
    });
    return { success: true, message: 'Registro de envío creado.' };
  },

  // ----------------------------------------------------------
  // HISTORIAL ADMINISTRATIVO (compatible con versión anterior)
  // ----------------------------------------------------------
  async getHistoryByPatient(patientId: string): Promise<MedicalHistoryEntry[]> {
    if (isDemoMode) return getDemoState().medicalHistory.filter(h => h.patientId === patientId);
    const { data } = await supabase.from('medical_history').select('*, profiles(full_name)').eq('patient_id', patientId).order('date', { ascending: false });
    return (data || []).map((h: any) => ({
      id: h.id, patientId: h.patient_id, professionalId: h.professional_id,
      professionalName: h.profiles?.full_name || 'Sistema', date: h.date, description: h.description,
      entryType: 'administrativa' as const,
    }));
  },

  async addHistoryEntry(entry: any) {
    if (isDemoMode) {
      updateDemoState(s => {
        s.medicalHistory.unshift({
          id: entry.id || newId('mh'), patientId: entry.patientId,
          professionalId: entry.professionalId, professionalName: entry.professionalName || 'Sistema',
          date: entry.date || new Date().toISOString(), description: entry.description,
          entryType: entry.entryType || 'administrativa',
        });
      });
      return true;
    }
    const { error } = await supabase.from('medical_history').insert({
      patient_id: entry.patientId, professional_id: entry.professionalId, description: entry.description,
    });
    return !error;
  },

  // ----------------------------------------------------------
  // CITAS
  // ----------------------------------------------------------
  async getAppointments(user?: User): Promise<Appointment[]> {
    if (isDemoMode) {
      const state = getDemoState();
      const list = [...state.appointments]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(a => {
          const patient = state.patients.find(p => p.id === a.patientId);
          const professional = state.users.find(u => u.id === a.professionalId);
          return {
            ...a,
            patientName: a.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : undefined),
            professionalName: a.professionalName || professional?.name,
          };
        });
      if (user && !isAdmin(user)) return list.filter(a => a.professionalId === user.id);
      return list;
    }
    let query = supabase
      .from('appointments')
      .select('*, patients(first_name,last_name), profiles(full_name)')
      .order('date', { ascending: true });
    if (user && !isAdmin(user)) query = query.eq('professional_id', user.id);
    const { data } = await query;
    return (data || []).map(mapAppointment);
  },

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    if (isDemoMode) {
      const state = getDemoState();
      return state.appointments
        .filter(a => a.patientId === patientId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(a => {
          const patient = state.patients.find(p => p.id === a.patientId);
          const professional = state.users.find(u => u.id === a.professionalId);
          return {
            ...a,
            patientName: a.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : undefined),
            professionalName: a.professionalName || professional?.name,
          };
        });
    }
    const { data } = await supabase
      .from('appointments')
      .select('*, profiles(full_name)')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });
    return (data || []).map(mapAppointment);
  },

  async createAppointment(appt: Partial<Appointment>): Promise<{ success: boolean; id?: string; message?: string }> {
    if (isDemoMode) {
      const state = getDemoState();
      const id = newId('apt');
      const professional = state.users.find(u => u.id === appt.professionalId);
      const service = state.services.find(s => s.id === appt.serviceId);
      const specialty = appt.specialty || (professional?.role as ClinicalSpecialty) || undefined;
      const record: Appointment = {
        id,
        patientId: appt.patientId!,
        professionalId: appt.professionalId!,
        date: appt.date!,
        status: appt.status || AppointmentStatus.PENDING,
        reason: appt.reason || 'Consulta',
        notes: appt.notes || '',
        specialty,
        serviceId: appt.serviceId || null,
        room: appt.room || service?.room || null,
        durationMinutes: appt.durationMinutes || service?.durationMinutes || 45,
        clinicalRecorded: false,
        invoiceId: null,
        seriesId: appt.seriesId || null,
        createdBy: appt.createdBy || null,
        createdAt: new Date().toISOString(),
        demo: true,
      };
      state.appointments.push(record);
      const patient = state.patients.find(p => p.id === record.patientId);
      if (patient && specialty) {
        patient.assignedSpecialties = Array.from(new Set([...(patient.assignedSpecialties || []), specialty]));
        if (!state.assignments.some(a => a.patientId === patient.id && a.professionalId === record.professionalId && a.active)) {
          state.assignments.push({
            id: newId('asg'), patientId: patient.id, professionalId: record.professionalId,
            specialty, active: true, createdAt: new Date().toISOString(),
          });
        }
      }
      saveDemoState(state);
      return { success: true, id };
    }
    const { data, error } = await supabase.from('appointments').insert({
      patient_id: appt.patientId,
      professional_id: appt.professionalId,
      date: appt.date,
      status: appt.status || AppointmentStatus.PENDING,
      reason: appt.reason,
      notes: appt.notes || null,
      specialty: appt.specialty || null,
      service_id: appt.serviceId || null,
      room: appt.room || null,
      duration_minutes: appt.durationMinutes || null,
      series_id: appt.seriesId || null,
      created_by: appt.createdBy || null,
    }).select('id').single();
    return error ? { success: false, message: error.message } : { success: true, id: data.id };
  },

  async createRecurringAppointments(appt: Partial<Appointment>, weeks: number): Promise<{ success: boolean; created: number; message?: string }> {
    if (weeks <= 1) {
      const result = await this.createAppointment(appt);
      return { success: result.success, created: result.success ? 1 : 0, message: result.message };
    }
    const seriesId = newId('serie');
    let created = 0;
    let lastError = '';
    for (let i = 0; i < weeks; i++) {
      const d = new Date(appt.date!);
      d.setDate(d.getDate() + i * 7);
      const result = await this.createAppointment({ ...appt, date: d.toISOString(), seriesId });
      if (result.success) created++; else lastError = result.message || '';
    }
    return { success: created > 0, created, message: lastError };
  },

  async updateAppointment(id: string, patch: Partial<Appointment>): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => {
        const a = s.appointments.find(x => x.id === id);
        if (a) Object.assign(a, patch);
      });
      return true;
    }
    const payload: any = {};
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.reason !== undefined) payload.reason = patch.reason;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (patch.room !== undefined) payload.room = patch.room;
    if (patch.serviceId !== undefined) payload.service_id = patch.serviceId;
    if (patch.specialty !== undefined) payload.specialty = patch.specialty;
    if (patch.durationMinutes !== undefined) payload.duration_minutes = patch.durationMinutes;
    if (patch.clinicalRecorded !== undefined) payload.clinical_recorded = patch.clinicalRecorded;
    if (patch.invoiceId !== undefined) payload.invoice_id = patch.invoiceId;
    const { error } = await supabase.from('appointments').update(payload).eq('id', id);
    return !error;
  },

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<boolean> {
    return this.updateAppointment(id, { status });
  },

  // ----------------------------------------------------------
  // HISTORIAS CLÍNICAS (segmentadas por especialidad)
  // ----------------------------------------------------------
  async getClinicalRecords(patientId: string, specialty?: ClinicalSpecialty, viewer?: User): Promise<ClinicalRecord[]> {
    if (isDemoMode) {
      const state = getDemoState();
      let records = state.clinicalRecords.filter(r => r.patientId === patientId);
      if (specialty) records = records.filter(r => r.specialty === specialty);
      if (viewer) {
        if (isAdmin(viewer) && !hasPermission(viewer, 'clinical.view.all')) return [];
        if (!isAdmin(viewer)) records = records.filter(r => r.specialty === viewer.role);
      }
      return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    let query = supabase
      .from('clinical_records')
      .select('*, profiles(full_name)')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });
    if (specialty) query = query.eq('specialty', specialty);
    const { data } = await query;
    return (data || []).map(mapClinicalRecord);
  },

  async getClinicalRecordsByProfessional(professionalId: string, specialty?: ClinicalSpecialty): Promise<ClinicalRecord[]> {
    if (isDemoMode) {
      return getDemoState().clinicalRecords
        .filter(r => r.professionalId === professionalId && (!specialty || r.specialty === specialty))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    let query = supabase
      .from('clinical_records')
      .select('*, profiles(full_name)')
      .eq('professional_id', professionalId)
      .order('date', { ascending: false });
    if (specialty) query = query.eq('specialty', specialty);
    const { data } = await query;
    return (data || []).map(mapClinicalRecord);
  },

  async getClinicalRecordById(id: string): Promise<ClinicalRecord | undefined> {
    if (isDemoMode) return getDemoState().clinicalRecords.find(r => r.id === id);
    const { data } = await supabase.from('clinical_records').select('*, profiles(full_name)').eq('id', id).single();
    return data ? mapClinicalRecord(data) : undefined;
  },

  async createClinicalRecord(input: Partial<ClinicalRecord>, actor: User): Promise<ClinicalRecord> {
    if (isDemoMode) {
      const state = getDemoState();
      const professional = state.users.find(u => u.id === input.professionalId);
      const record: ClinicalRecord = {
        id: newId('cr'),
        patientId: input.patientId!,
        professionalId: input.professionalId!,
        professionalName: professional?.name || actor.name,
        specialty: input.specialty!,
        recordType: input.recordType || 'sesion',
        date: input.date || new Date().toISOString(),
        appointmentId: input.appointmentId || null,
        status: input.status || 'completado',
        summary: input.summary || '',
        objectives: input.objectives || [],
        data: input.data || {},
        version: input.version || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        signedBy: input.status === 'firmado' ? actor.name : null,
        demo: true,
      };
      state.clinicalRecords.unshift(record);
      if (record.appointmentId) {
        const appt = state.appointments.find(a => a.id === record.appointmentId);
        if (appt) appt.clinicalRecorded = true;
      }
      const patient = state.patients.find(p => p.id === record.patientId);
      if (patient) {
        patient.assignedSpecialties = Array.from(new Set([...(patient.assignedSpecialties || []), record.specialty]));
      }
      saveDemoState(state);
      await this.logAudit(actor, 'clinical.create', 'clinical_record', record.id,
        `Registro ${record.recordType} de ${record.specialty}`, record.patientId);
      return record;
    }

    const payload: any = {
      patient_id: input.patientId,
      professional_id: input.professionalId,
      specialty: input.specialty,
      record_type: input.recordType || 'sesion',
      date: input.date || new Date().toISOString(),
      appointment_id: input.appointmentId || null,
      status: input.status || 'completado',
      summary: input.summary || '',
      objectives: input.objectives || [],
      data: input.data || {},
      version: input.version || 1,
      signed_by: input.status === 'firmado' ? actor.id : null,
    };
    const { data, error } = await supabase.from('clinical_records').insert(payload).select('*, profiles(full_name)').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo guardar el registro clínico.');
    if (input.appointmentId) {
      await supabase.from('appointments').update({ clinical_recorded: true }).eq('id', input.appointmentId);
    }
    await this.logAudit(actor, 'clinical.create', 'clinical_record', data.id,
      `Registro ${payload.record_type} de ${payload.specialty}`, payload.patient_id);
    return mapClinicalRecord(data);
  },

  async updateClinicalRecord(id: string, patch: Partial<ClinicalRecord>, actor: User): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => {
        const r = s.clinicalRecords.find(x => x.id === id);
        if (r) Object.assign(r, patch, { updatedAt: new Date().toISOString(), version: (r.version || 1) + 1 });
      });
      await this.logAudit(actor, 'clinical.update', 'clinical_record', id, 'Modificación de registro clínico', patch.patientId || null);
      return true;
    }
    const payload: any = {
      summary: patch.summary,
      objectives: patch.objectives,
      data: patch.data,
      status: patch.status,
      updated_at: new Date().toISOString(),
      signed_by: patch.status === 'firmado' ? actor.id : null,
    };
    const { error } = await supabase.from('clinical_records').update(payload).eq('id', id);
    if (!error) await this.logAudit(actor, 'clinical.update', 'clinical_record', id, 'Modificación de registro clínico', patch.patientId || null);
    return !error;
  },

  // ----------------------------------------------------------
  // SERVICIOS, SALAS Y BONOS
  // ----------------------------------------------------------
  async getServices(): Promise<Service[]> {
    if (isDemoMode) return getDemoState().services;
    const { data } = await supabase.from('services').select('*').order('specialty').order('name');
    return (data || []).map((s: any) => ({
      id: s.id, name: s.name, specialty: s.specialty, durationMinutes: s.duration_minutes,
      price: Number(s.price) || 0, taxRate: Number(s.tax_rate) || 0, room: s.room,
      description: s.description || '', active: s.active !== false, demo: false,
    }));
  },

  async saveService(service: Partial<Service>): Promise<Service> {
    if (isDemoMode) {
      const state = getDemoState();
      if (service.id) {
        const existing = state.services.find(s => s.id === service.id);
        if (existing) Object.assign(existing, service);
        saveDemoState(state);
        return existing!;
      }
      const created: Service = {
        id: newId('s'), name: service.name || 'Nuevo servicio',
        specialty: service.specialty || 'otro', durationMinutes: service.durationMinutes || 45,
        price: service.price || 0, taxRate: service.taxRate || 0, room: service.room || null,
        description: service.description || '', active: service.active !== false, demo: true,
      };
      state.services.push(created);
      saveDemoState(state);
      return created;
    }
    const payload = {
      name: service.name, specialty: service.specialty,
      duration_minutes: service.durationMinutes, price: service.price,
      tax_rate: service.taxRate, room: service.room, description: service.description,
      active: service.active,
    };
    if (service.id) {
      const { data, error } = await supabase.from('services').update(payload).eq('id', service.id).select('*').single();
      if (error) throw new Error(error.message);
      return { ...service, id: data.id } as Service;
    }
    const { data, error } = await supabase.from('services').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return {
      id: data.id, name: data.name, specialty: data.specialty, durationMinutes: data.duration_minutes,
      price: Number(data.price), taxRate: Number(data.tax_rate), room: data.room,
      description: data.description, active: data.active,
    };
  },

  async deleteService(id: string): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => { s.services = s.services.filter(x => x.id !== id); });
      return true;
    }
    const { error } = await supabase.from('services').delete().eq('id', id);
    return !error;
  },

  /** Salas físicas del centro (distinto del chat: getRooms(currentUserId)). */
  async getPhysicalRooms(): Promise<{ id: string; name: string; specialty: string; active: boolean }[]> {
    if (isDemoMode) return getDemoState().rooms;
    const { data } = await supabase.from('clinic_rooms').select('*').order('name');
    return (data || []).map((r: any) => ({ id: r.id, name: r.name, specialty: r.specialty, active: r.active !== false }));
  },

  async saveRoom(room: { id?: string; name: string; specialty?: string; active?: boolean }) {
    if (isDemoMode) {
      const state = getDemoState();
      if (room.id) {
        const existing = state.rooms.find(r => r.id === room.id);
        if (existing) Object.assign(existing, room);
      } else {
        state.rooms.push({ id: newId('room'), name: room.name, specialty: room.specialty || 'comun', active: room.active !== false });
      }
      saveDemoState(state);
      return true;
    }
    const { error } = room.id
      ? await supabase.from('clinic_rooms').update({ name: room.name, specialty: room.specialty, active: room.active }).eq('id', room.id)
      : await supabase.from('clinic_rooms').insert({ name: room.name, specialty: room.specialty, active: room.active !== false });
    return !error;
  },

  async getPackages(): Promise<SessionPackage[]> {
    if (isDemoMode) return getDemoState().packages;
    const { data } = await supabase.from('session_packages').select('*, patients(first_name,last_name)').order('purchase_date', { ascending: false });
    return (data || []).map(mapPackage);
  },

  async savePackage(pkg: Partial<SessionPackage>): Promise<SessionPackage> {
    if (isDemoMode) {
      const state = getDemoState();
      if (pkg.id) {
        const existing = state.packages.find(p => p.id === pkg.id);
        if (existing) Object.assign(existing, pkg);
        saveDemoState(state);
        return existing!;
      }
      const created: SessionPackage = {
        id: newId('pack'), patientId: pkg.patientId!, patientName: state.patients.find(p => p.id === pkg.patientId)?.firstName,
        name: pkg.name || 'Bono de sesiones', serviceId: pkg.serviceId || null,
        specialty: pkg.specialty!, totalSessions: pkg.totalSessions || 1, usedSessions: 0,
        price: pkg.price || 0, purchaseDate: pkg.purchaseDate || localTodayISO(),
        expiryDate: pkg.expiryDate || null, status: 'activo', notes: pkg.notes || '', demo: true,
      };
      state.packages.push(created);
      saveDemoState(state);
      return created;
    }
    const payload = {
      patient_id: pkg.patientId, name: pkg.name, service_id: pkg.serviceId,
      specialty: pkg.specialty, total_sessions: pkg.totalSessions, used_sessions: pkg.usedSessions || 0,
      price: pkg.price, purchase_date: pkg.purchaseDate, expiry_date: pkg.expiryDate,
      status: pkg.status || 'activo', notes: pkg.notes,
    };
    const { data, error } = pkg.id
      ? await supabase.from('session_packages').update(payload).eq('id', pkg.id).select('*, patients(first_name,last_name)').single()
      : await supabase.from('session_packages').insert(payload).select('*, patients(first_name,last_name)').single();
    if (error) throw new Error(error.message);
    return mapPackage(data);
  },

  async consumePackageSession(packageId: string): Promise<boolean> {
    if (isDemoMode) {
      let ok = false;
      updateDemoState(s => {
        const pkg = s.packages.find(p => p.id === packageId);
        if (pkg && pkg.usedSessions < pkg.totalSessions) {
          pkg.usedSessions++;
          if (pkg.usedSessions >= pkg.totalSessions) pkg.status = 'agotado';
          ok = true;
        }
      });
      return ok;
    }
    const { data } = await supabase.from('session_packages').select('used_sessions,total_sessions').eq('id', packageId).single();
    if (!data || data.used_sessions >= data.total_sessions) return false;
    const next = data.used_sessions + 1;
    const { error } = await supabase.from('session_packages').update({
      used_sessions: next, status: next >= data.total_sessions ? 'agotado' : 'activo',
    }).eq('id', packageId);
    return !error;
  },

  // ----------------------------------------------------------
  // CONTABILIDAD / FACTURAS / GASTOS
  // ----------------------------------------------------------
  async getPayments(fromDate?: string, toDate?: string): Promise<Payment[]> {
    if (isDemoMode) {
      return getDemoState().payments
        .filter(p => (!fromDate || p.paymentDate >= fromDate) && (!toDate || p.paymentDate <= toDate))
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    }
    let query = supabase.from('payments').select('*, profiles:professional_id(full_name), patients:patient_id(first_name,last_name)');
    if (fromDate) query = query.gte('payment_date', fromDate);
    if (toDate) query = query.lte('payment_date', toDate);
    const { data, error } = await query.order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (data || []).map(mapPayment);
  },

  async createPayment(payment: PaymentInput, actor?: User): Promise<Payment> {
    if (isDemoMode) {
      const state = getDemoState();
      const created: Payment = {
        id: newId('pay'), concept: payment.concept, amount: payment.amount, method: payment.method,
        paymentDate: payment.paymentDate, professionalId: payment.professionalId || null,
        patientId: payment.patientId || null, appointmentId: payment.appointmentId || null,
        invoiceId: payment.invoiceId || null, notes: payment.notes || null,
        createdBy: actor?.id || null, createdAt: new Date().toISOString(),
        professionalName: state.users.find(u => u.id === payment.professionalId)?.name,
        patientName: state.patients.find(p => p.id === payment.patientId)?.firstName,
        demo: true,
      };
      state.payments.unshift(created);
      if (created.appointmentId) {
        const appt = state.appointments.find(a => a.id === created.appointmentId);
        if (appt) appt.invoiceId = appt.invoiceId || created.invoiceId || null;
      }
      saveDemoState(state);
      await this.logAudit(actor, 'payment.create', 'payment', created.id, `Cobro de ${payment.amount} €`, created.patientId);
      return created;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('payments').insert({
      concept: payment.concept, amount: payment.amount, method: payment.method,
      payment_date: payment.paymentDate, professional_id: payment.professionalId || null,
      patient_id: payment.patientId || null, appointment_id: payment.appointmentId || null,
      invoice_id: payment.invoiceId || null, notes: payment.notes || null,
      created_by: session?.user?.id || null,
    }).select('*, profiles:professional_id(full_name), patients:patient_id(first_name,last_name)').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo registrar el cobro.');
    await this.logAudit(actor, 'payment.create', 'payment', data.id, `Cobro de ${payment.amount} €`, payment.patientId);
    return mapPayment(data);
  },

  async updatePayment(id: string, payment: PaymentInput, actor?: User): Promise<Payment> {
    if (isDemoMode) {
      let updated: Payment | undefined;
      updateDemoState(s => {
        const p = s.payments.find(x => x.id === id);
        if (p) {
          Object.assign(p, {
            concept: payment.concept, amount: payment.amount, method: payment.method,
            paymentDate: payment.paymentDate, professionalId: payment.professionalId || null,
            patientId: payment.patientId || null, appointmentId: payment.appointmentId || null,
            invoiceId: payment.invoiceId || null, notes: payment.notes || null,
          });
          updated = p;
        }
      });
      await this.logAudit(actor, 'payment.update', 'payment', id, 'Modificación de cobro', payment.patientId);
      if (!updated) throw new Error('No se encontró el cobro.');
      return updated;
    }
    const { data, error } = await supabase.from('payments').update({
      concept: payment.concept, amount: payment.amount, method: payment.method,
      payment_date: payment.paymentDate, professional_id: payment.professionalId || null,
      patient_id: payment.patientId || null, appointment_id: payment.appointmentId || null,
      invoice_id: payment.invoiceId || null, notes: payment.notes || null,
    }).eq('id', id).select('*, profiles:professional_id(full_name), patients:patient_id(first_name,last_name)').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo guardar el cambio.');
    return mapPayment(data);
  },

  async deletePayment(id: string, actor?: User): Promise<void> {
    if (isDemoMode) {
      updateDemoState(s => { s.payments = s.payments.filter(p => p.id !== id); });
      await this.logAudit(actor, 'payment.delete', 'payment', id, 'Eliminación de cobro', null);
      return;
    }
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getInvoices(): Promise<Invoice[]> {
    if (isDemoMode) return [...getDemoState().invoices].sort((a, b) => b.date.localeCompare(a.date));
    const { data } = await supabase.from('invoices').select('*, patients(first_name,last_name)').order('date', { ascending: false });
    return (data || []).map(mapInvoice);
  },

  async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const invoices = await this.getInvoices();
    const numbers = invoices.map(i => Number(i.number.split('-').pop())).filter(n => !Number.isNaN(n));
    const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
    return `${year}-${String(next).padStart(4, '0')}`;
  },

  async saveInvoice(invoice: Partial<Invoice>, actor?: User): Promise<Invoice> {
    const number = invoice.number || await this.nextInvoiceNumber();
    if (isDemoMode) {
      const state = getDemoState();
      if (invoice.id) {
        const existing = state.invoices.find(i => i.id === invoice.id);
        if (existing) {
          Object.assign(existing, invoice, { number: existing.number });
          if (invoice.appointmentId) {
            const appt = state.appointments.find(a => a.id === invoice.appointmentId);
            if (appt) appt.invoiceId = existing.id;
          }
          saveDemoState(state);
          await this.logAudit(actor, 'invoice.update', 'invoice', existing.id, `Actualización de factura ${existing.number}`, existing.patientId);
          return existing;
        }
      }
      const created: Invoice = {
        id: newId('inv'), number, patientId: invoice.patientId!,
        patientName: (() => { const p = state.patients.find(p => p.id === invoice.patientId); return p ? `${p.firstName} ${p.lastName}` : undefined; })(),
        appointmentId: invoice.appointmentId || null,
        date: invoice.date || localTodayISO(), dueDate: invoice.dueDate || localTodayISO(),
        items: invoice.items || [], subtotal: invoice.subtotal || 0, taxRate: invoice.taxRate || 0,
        taxAmount: invoice.taxAmount || 0, total: invoice.total || 0, amountPaid: invoice.amountPaid || 0,
        status: invoice.status || 'borrador', method: invoice.method || null, notes: invoice.notes || '',
        createdBy: actor?.id || null, createdAt: new Date().toISOString(), demo: true,
      };
      state.invoices.unshift(created);
      if (created.appointmentId) {
        const appt = state.appointments.find(a => a.id === created.appointmentId);
        if (appt) appt.invoiceId = created.id;
      }
      saveDemoState(state);
      await this.logAudit(actor, 'invoice.create', 'invoice', created.id, `Factura ${number} por ${created.total} €`, created.patientId);
      return created;
    }
    const payload = {
      number, patient_id: invoice.patientId, appointment_id: invoice.appointmentId || null,
      date: invoice.date, due_date: invoice.dueDate, items: invoice.items,
      subtotal: invoice.subtotal, tax_rate: invoice.taxRate, tax_amount: invoice.taxAmount,
      total: invoice.total, amount_paid: invoice.amountPaid || 0, status: invoice.status || 'borrador',
      method: invoice.method || null, notes: invoice.notes || null,
    };
    const { data, error } = invoice.id
      ? await supabase.from('invoices').update(payload).eq('id', invoice.id).select('*, patients(first_name,last_name)').single()
      : await supabase.from('invoices').insert(payload).select('*, patients(first_name,last_name)').single();
    if (error) throw new Error(error.message);
    if (payload.appointment_id) {
      await supabase.from('appointments').update({ invoice_id: data.id }).eq('id', payload.appointment_id);
    }
    return mapInvoice(data);
  },

  async registerInvoicePayment(invoiceId: string, amount: number, method: PaymentInput['method'], actor?: User): Promise<Invoice> {
    const invoices = await this.getInvoices();
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Factura no encontrada.');
    const paid = Math.min(invoice.total, invoice.amountPaid + amount);
    const status: InvoiceStatus = paid >= invoice.total ? 'pagada' : paid > 0 ? 'parcial' : invoice.status;
    await this.createPayment({
      concept: invoice.items[0]?.serviceId ? (invoice as any).specialty || 'otro' : 'otro',
      amount, method, paymentDate: localTodayISO(),
      patientId: invoice.patientId, appointmentId: invoice.appointmentId || null,
      invoiceId: invoice.id, notes: `Pago factura ${invoice.number}`,
    }, actor);
    return this.saveInvoice({ ...invoice, amountPaid: paid, status, method }, actor);
  },

  async getExpenses(): Promise<Expense[]> {
    if (isDemoMode) return [...getDemoState().expenses].sort((a, b) => b.date.localeCompare(a.date));
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    return (data || []).map(mapExpense);
  },

  async saveExpense(expense: Partial<Expense>, actor?: User): Promise<Expense> {
    if (isDemoMode) {
      const state = getDemoState();
      if (expense.id) {
        const existing = state.expenses.find(e => e.id === expense.id);
        if (existing) Object.assign(existing, expense);
        saveDemoState(state);
        return existing!;
      }
      const created: Expense = {
        id: newId('exp'), date: expense.date || localTodayISO(),
        supplier: expense.supplier || '', category: expense.category || 'Otros',
        specialty: expense.specialty || 'general', amount: expense.amount || 0,
        method: expense.method || 'transferencia', status: expense.status || 'pagado',
        reference: expense.reference || '', notes: expense.notes || '',
        createdBy: actor?.id || null, createdAt: new Date().toISOString(), demo: true,
      };
      state.expenses.unshift(created);
      saveDemoState(state);
      return created;
    }
    const payload = {
      date: expense.date, supplier: expense.supplier, category: expense.category,
      specialty: expense.specialty, amount: expense.amount, method: expense.method,
      status: expense.status, reference: expense.reference, notes: expense.notes,
    };
    const { data, error } = expense.id
      ? await supabase.from('expenses').update(payload).eq('id', expense.id).select('*').single()
      : await supabase.from('expenses').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return mapExpense(data);
  },

  async deleteExpense(id: string): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => { s.expenses = s.expenses.filter(e => e.id !== id); });
      return true;
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    return !error;
  },

  async getCashClosings(): Promise<CashClosing[]> {
    if (isDemoMode) return [...getDemoState().cashClosings].sort((a, b) => b.date.localeCompare(a.date));
    const { data } = await supabase.from('cash_closings').select('*').order('date', { ascending: false });
    return (data || []).map((c: any) => ({
      id: c.id, date: c.date, openingFloat: Number(c.opening_float) || 0,
      totalCash: Number(c.total_cash) || 0, totalCard: Number(c.total_card) || 0,
      totalOther: Number(c.total_other) || 0, totalExpenses: Number(c.total_expenses) || 0,
      expectedCash: Number(c.expected_cash) || 0, countedCash: Number(c.counted_cash) || 0,
      difference: Number(c.difference) || 0, closedBy: c.closed_by,
      closedAt: c.closed_at, notes: c.notes || '',
    }));
  },

  async closeCash(closing: Partial<CashClosing>, actor?: User): Promise<CashClosing> {
    if (isDemoMode) {
      const state = getDemoState();
      const created: CashClosing = {
        id: newId('cash'), date: closing.date || localTodayISO(),
        openingFloat: closing.openingFloat || 0, totalCash: closing.totalCash || 0,
        totalCard: closing.totalCard || 0, totalOther: closing.totalOther || 0,
        totalExpenses: closing.totalExpenses || 0, expectedCash: closing.expectedCash || 0,
        countedCash: closing.countedCash || 0, difference: closing.difference || 0,
        closedBy: actor?.id || '', closedByName: actor?.name || '',
        closedAt: new Date().toISOString(), notes: closing.notes || '', demo: true,
      };
      state.cashClosings.unshift(created);
      saveDemoState(state);
      return created;
    }
    const { data, error } = await supabase.from('cash_closings').insert({
      date: closing.date, opening_float: closing.openingFloat,
      total_cash: closing.totalCash, total_card: closing.totalCard,
      total_other: closing.totalOther, total_expenses: closing.totalExpenses,
      expected_cash: closing.expectedCash, counted_cash: closing.countedCash,
      difference: closing.difference, closed_by: actor?.id, notes: closing.notes,
    }).select('*').single();
    if (error) throw new Error(error.message);
    return { ...closing, id: data.id } as CashClosing;
  },

  // ----------------------------------------------------------
  // CONSENTIMIENTOS
  // ----------------------------------------------------------
  async getConsents(patientId: string): Promise<ConsentRecord[]> {
    if (isDemoMode) return getDemoState().consents.filter(c => c.patientId === patientId);
    const { data } = await supabase.from('consents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    return (data || []).map(mapConsent);
  },

  async saveConsent(consent: Partial<ConsentRecord>, actor?: User): Promise<ConsentRecord> {
    if (isDemoMode) {
      const state = getDemoState();
      if (consent.id) {
        const existing = state.consents.find(c => c.id === consent.id);
        if (existing) Object.assign(existing, consent);
        saveDemoState(state);
        await this.logAudit(actor, 'consent.update', 'consent', existing?.id || null, `Consentimiento ${consent.type}`, consent.patientId || null);
        return existing!;
      }
      const created: ConsentRecord = {
        id: newId('con'), patientId: consent.patientId!, type: consent.type || 'clinico',
        title: consent.title || 'Consentimiento', signed: consent.signed !== false,
        signedBy: consent.signedBy || '', guardianName: consent.guardianName || '',
        date: consent.date || localTodayISO(), expiresAt: consent.expiresAt || null,
        notes: consent.notes || '', createdBy: actor?.id || null,
        createdAt: new Date().toISOString(), demo: true,
      };
      state.consents.unshift(created);
      const patient = state.patients.find(p => p.id === created.patientId);
      if (patient && created.type === 'privacidad' && created.signed) patient.privacyPolicySigned = true;
      saveDemoState(state);
      await this.logAudit(actor, 'consent.create', 'consent', created.id, `Consentimiento ${created.type}`, created.patientId);
      return created;
    }
    const payload = {
      patient_id: consent.patientId, type: consent.type, title: consent.title,
      signed: consent.signed, signed_by: consent.signedBy, guardian_name: consent.guardianName,
      date: consent.date, expires_at: consent.expiresAt, notes: consent.notes,
    };
    const { data, error } = consent.id
      ? await supabase.from('consents').update(payload).eq('id', consent.id).select('*').single()
      : await supabase.from('consents').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return mapConsent(data);
  },

  // ----------------------------------------------------------
  // AUDITORÍA
  // ----------------------------------------------------------
  async logAudit(
    actor: User | undefined | null,
    action: string,
    entity: string,
    entityId: string | null,
    detail: string,
    patientId?: string | null,
  ): Promise<void> {
    if (!actor) return;
    if (isDemoMode) {
      updateDemoState(s => {
        s.audit.unshift({
          id: newId('aud'), userId: actor.id, userName: actor.name,
          role: actor.role, action, entity, entityId, patientId: patientId || null,
          detail, createdAt: new Date().toISOString(), demo: true,
        });
        s.audit = s.audit.slice(0, 2000);
      });
      return;
    }
    try {
      await supabase.from('audit_log').insert({
        user_id: actor.id, user_name: actor.name, role: actor.role,
        action, entity, entity_id: entityId, patient_id: patientId || null, detail,
      });
    } catch { /* la auditoría no debe bloquear la acción clínica */ }
  },

  async getAuditLog(limit = 200): Promise<AuditEntry[]> {
    if (isDemoMode) return getDemoState().audit.slice(0, limit);
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
    return (data || []).map(mapAudit);
  },

  // ----------------------------------------------------------
  // CONFIGURACIÓN DEL CENTRO
  // ----------------------------------------------------------
  async getSettings(): Promise<CenterSettings> {
    if (isDemoMode) return getDemoState().settings;
    const { data } = await supabase.from('center_settings').select('*').eq('id', 1).maybeSingle();
    if (!data) return defaultSettings;
    return {
      centerName: data.center_name || defaultSettings.centerName,
      legalName: data.legal_name || defaultSettings.legalName,
      cif: data.cif || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      web: data.web || '',
      schedule: data.schedule || defaultSettings.schedule,
      adminClinicalAccess: !!data.admin_clinical_access,
      clinicalAccessJustification: data.clinical_access_justification || '',
      retentionYears: Number(data.retention_years) || 5,
      aiEnabled: !!data.ai_enabled,
      aiPrivacyReviewed: !!data.ai_privacy_reviewed,
      lastBackupAt: data.last_backup_at || null,
    };
  },

  async saveSettings(settings: CenterSettings, actor?: User): Promise<boolean> {
    if (isDemoMode) {
      updateDemoState(s => { s.settings = settings; });
      await this.logAudit(actor, 'settings.update', 'settings', '1', 'Actualización de configuración del centro', null);
      return true;
    }
    const { error } = await supabase.from('center_settings').upsert({
      id: 1, center_name: settings.centerName, legal_name: settings.legalName, cif: settings.cif,
      address: settings.address, phone: settings.phone, email: settings.email, web: settings.web,
      schedule: settings.schedule, admin_clinical_access: settings.adminClinicalAccess,
      clinical_access_justification: settings.clinicalAccessJustification,
      retention_years: settings.retentionYears, ai_enabled: settings.aiEnabled,
      ai_privacy_reviewed: settings.aiPrivacyReviewed, last_backup_at: settings.lastBackupAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (!error) await this.logAudit(actor, 'settings.update', 'settings', '1', 'Actualización de configuración del centro', null);
    return !error;
  },

  // ----------------------------------------------------------
  // PROFESIONALES Y PERMISOS
  // ----------------------------------------------------------
  async getProfessionals(): Promise<User[]> {
    if (isDemoMode) return getDemoState().users;
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data || []).map(mapUser);
  },

  async createProfessional(data: { name: string; email: string; role: UserRole; profession?: string; permissions?: Permission[] }): Promise<{ success: boolean; message?: string }> {
    if (isDemoMode) {
      const state = getDemoState();
      if (state.users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
        return { success: false, message: 'Ya existe un usuario con ese correo.' };
      }
      const created: User = {
        id: newId('u'), name: data.name, email: data.email, role: data.role,
        profession: data.role === UserRole.ADMIN ? null : (data.role as ClinicalSpecialty),
        permissions: data.permissions || [], active: true,
        sourceRole: data.role === UserRole.ADMIN ? 'admin' : 'medico', demo: true,
      };
      state.users.push(created);
      saveDemoState(state);
      return { success: true };
    }
    try {
      const result = await apiFetch('/api/profiles', {
        method: 'POST',
        body: {
          action: 'create', name: data.name, email: data.email,
          role: data.role, profession: data.profession || data.role,
          permissions: data.permissions || [],
        },
      });
      return { success: !!result?.ok, message: result?.error };
    } catch (e: any) {
      return { success: false, message: e?.message || 'No se pudo crear el profesional.' };
    }
  },

  async updateProfessional(id: string, patch: Partial<User>): Promise<{ success: boolean; message?: string }> {
    if (isDemoMode) {
      updateDemoState(s => {
        const u = s.users.find(x => x.id === id);
        if (u) Object.assign(u, patch);
      });
      return { success: true };
    }
    try {
      const result = await apiFetch('/api/profiles', {
        method: 'PATCH',
        body: {
          action: 'update', professionalId: id,
          profession: patch.profession,
          permissions: patch.permissions,
          role: patch.role,
          active: patch.active,
          name: patch.name,
          phone: patch.phone,
        },
      });
      return { success: !!result?.ok, message: result?.error };
    } catch (e: any) {
      return { success: false, message: e?.message || 'No se pudo actualizar el profesional.' };
    }
  },

  async updateProfession(professionalId: string, profession: string | null) {
    return this.updateProfessional(professionalId, { profession: profession as any });
  },

  async updatePermissions(professionalId: string, permissions: Permission[]) {
    return this.updateProfessional(professionalId, { permissions });
  },

  async deleteProfessional(id: string) {
    if (isDemoMode) {
      updateDemoState(s => { s.users = s.users.filter(u => u.id !== id); });
      return true;
    }
    try {
      const result = await apiFetch('/api/profiles', { method: 'DELETE', body: { professionalId: id } });
      return !!result?.ok;
    } catch { return false; }
  },

  // ----------------------------------------------------------
  // SOLICITUDES WEB
  // ----------------------------------------------------------
  async getReservationRequests(status?: string): Promise<ReservationRequest[]> {
    if (isDemoMode) {
      const list = getDemoState().reservations;
      return (status && status !== 'all' ? list.filter(r => r.status === status) : list)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const payload = await apiFetch(`/api/reservation-requests${query}`);
    const rows: ReservationRequest[] = payload?.requests || [];
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async acceptReservationRequest(payload: AcceptReservationPayload): Promise<any> {
    if (isDemoMode) {
      const state = getDemoState();
      const request = state.reservations.find(r => r.id === payload.id);
      if (!request) throw new Error('Solicitud no encontrada.');
      let patientId = payload.patientId;
      if (!patientId && payload.newPatient) {
        const result = await this.createPatient({
          ...payload.newPatient,
          phone: payload.newPatient.phone || request.telefono,
          email: payload.newPatient.email || request.email,
        });
        if (!result.success || !result.id) throw new Error(result.error || 'No se pudo crear el paciente.');
        patientId = result.id;
      }
      if (!patientId) throw new Error('Selecciona o crea un paciente.');
      const result = await this.createAppointment({
        patientId,
        professionalId: payload.professionalId,
        date: payload.date,
        reason: payload.reason || request.area,
        notes: payload.notes || request.notas || '',
        status: AppointmentStatus.CONFIRMED,
        specialty: request.area as ClinicalSpecialty,
        createdBy: 'u-admin',
      });
      if (!result.success) throw new Error(result.message || 'No se pudo crear la cita.');
      request.status = 'confirmada';
      request.professional_id = payload.professionalId;
      request.appointment_id = result.id || null;
      saveDemoState(state);
      return { ok: true };
    }
    return apiFetch('/api/reservation-requests', { method: 'POST', body: payload });
  },

  async rejectReservationRequest(id: string) {
    if (isDemoMode) {
      updateDemoState(s => {
        const r = s.reservations.find(x => x.id === id);
        if (r) r.status = 'cancelada';
      });
      return { ok: true };
    }
    return apiFetch('/api/reservation-requests', { method: 'PATCH', body: { action: 'reject', id } });
  },

  async deleteReservationRequest(id: string) {
    if (isDemoMode) {
      updateDemoState(s => { s.reservations = s.reservations.filter(r => r.id !== id); });
      return { ok: true };
    }
    return apiFetch(`/api/reservation-requests?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ----------------------------------------------------------
  // CHAT INTERNO
  // ----------------------------------------------------------
  async getRooms(currentUserId: string): Promise<ChatRoom[]> {
    if (isDemoMode) return getDemoState().chatRooms;
    const { data: participations } = await supabase.from('room_participants').select('room_id, rooms(*)').eq('user_id', currentUserId);
    if (!participations) return [];
    const rooms: ChatRoom[] = [];
    for (const p of participations as any[]) {
      const roomData = (Array.isArray(p.rooms) ? p.rooms[0] : p.rooms) as any;
      if (!roomData) continue;
      const { data: parts } = await supabase.from('room_participants').select('profiles(*)').eq('room_id', roomData.id);
      const participants = (parts || []).map((pt: any) => mapUser(pt.profiles));
      rooms.push({
        id: roomData.id, type: roomData.type,
        name: roomData.type === 'direct'
          ? (participants.find(u => u.id !== currentUserId)?.name || 'Chat directo')
          : (roomData.name || 'Sala de equipo'),
        updatedAt: roomData.updated_at,
        participants,
      });
    }
    return rooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async createDirectChat(currentUserId: string, otherUserId: string) {
    if (isDemoMode) {
      const state = getDemoState();
      const existing = state.chatRooms.find(r =>
        r.type === 'direct' && r.participants?.some(p => p.id === currentUserId) && r.participants?.some(p => p.id === otherUserId)
      );
      if (existing) return { success: true, roomId: existing.id };
      const id = newId('room');
      state.chatRooms.push({
        id, type: 'direct', name: state.users.find(u => u.id === otherUserId)?.name || 'Chat directo',
        updatedAt: new Date().toISOString(),
        participants: state.users.filter(u => u.id === currentUserId || u.id === otherUserId),
      });
      saveDemoState(state);
      return { success: true, roomId: id };
    }
    const { data, error } = await supabase.rpc('create_direct_chat', { other_user_id: otherUserId });
    return { success: !error, roomId: data, error: error?.message };
  },

  async getMessages(roomId: string): Promise<ChatMessage[]> {
    if (isDemoMode) return getDemoState().chatMessages.filter(m => m.roomId === roomId);
    const { data } = await supabase.from('messages').select('*, profiles(full_name)').eq('room_id', roomId).order('created_at', { ascending: true });
    return (data || []).map((m: any) => ({
      id: m.id, roomId: m.room_id, senderId: m.sender_id,
      senderName: m.profiles?.full_name || 'Desconocido', content: m.content,
      type: m.type, createdAt: m.created_at, isRead: m.is_read || false,
    }));
  },

  async sendMessage(roomId: string, senderId: string, content: string, file?: File) {
    if (isDemoMode) {
      const state = getDemoState();
      const sender = state.users.find(u => u.id === senderId);
      state.chatMessages.push({
        id: newId('msg'), roomId, senderId, senderName: sender?.name || 'Usuario',
        content, type: file ? 'file' : 'text', createdAt: new Date().toISOString(), isRead: false,
      });
      const room = state.chatRooms.find(r => r.id === roomId);
      if (room) room.updatedAt = new Date().toISOString();
      saveDemoState(state);
      return true;
    }
    const type = file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text';
    const { error } = await supabase.from('messages').insert({ room_id: roomId, sender_id: senderId, content, type });
    return !error;
  },

  // ----------------------------------------------------------
  // IA (desactivada por defecto en el centro)
  // ----------------------------------------------------------
  async getAiHistory(userId: string) {
    if (isDemoMode) return [];
    const { data, error } = await supabase.from('ai_conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    return error ? [] : data;
  },

  async saveAiConversation(userId: string, conversationId: string, title: string, messages: any[]) {
    if (isDemoMode) return null;
    const { data, error } = await supabase.from('ai_conversations').upsert({
      id: conversationId, user_id: userId, title, messages, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select();
    return error ? null : data[0];
  },

  async deleteAiConversation(id: string) {
    if (isDemoMode) return true;
    const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
    return !error;
  },
};
