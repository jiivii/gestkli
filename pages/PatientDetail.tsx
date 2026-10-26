import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Baby, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck,
  ClipboardList, CreditCard, FileCheck2, FileText, HeartPulse, LockKeyhole, Mail,
  MapPin, Phone, Plus, ReceiptText, ShieldCheck, Stethoscope, UserCog, UserPlus, Users,
} from 'lucide-react';
import {
  Appointment, AppointmentStatus, ClinicalRecord, ClinicalSpecialty, ConsentRecord,
  Invoice, MedicalHistoryEntry, Patient, Payment, User, UserRole,
} from '../types';
import { dbService } from '../services/dbService';
import {
  canViewSpecialty, canWriteSpecialty, hasPermission, isAdmin, visibleClinicalSpecialties,
} from '../services/permissions';
import {
  ADMIN_STATE_COLORS, ADMIN_STATE_LABELS, APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS,
  calcAge, formatDate, formatMoney, formatTime, getAppointmentAdminState, getRoleProfile,
  isMinor, patientFullName, CLINICAL_SPECIALTIES, SPECIALTY_LABELS,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, SpecialtyBadge,
  Tabs, btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';
import ClinicalRecordModal from '../components/clinical/ClinicalRecordModal';
import ClinicalReportModal from '../components/clinical/ClinicalReportModal';
import ClinicalEvolution from '../components/clinical/ClinicalEvolution';
import { ObjectiveProgress } from '../components/clinical/shared';

interface Props { user: User; }

const consentTypes: { value: ConsentRecord['type']; label: string }[] = [
  { value: 'privacidad', label: 'Privacidad y protección de datos' },
  { value: 'clinico', label: 'Consentimiento informado clínico' },
  { value: 'menores', label: 'Representación legal de menor' },
  { value: 'coordinacion', label: 'Coordinación con terceros' },
  { value: 'imagen', label: 'Uso de imagen' },
  { value: 'grabacion', label: 'Grabación de sesiones' },
];

const PatientDetail: React.FC<Props> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [history, setHistory] = useState<MedicalHistoryEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<{ professionalId: string; specialty: string; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('resumen');
  const [newRecordSpecialty, setNewRecordSpecialty] = useState<ClinicalSpecialty | null>(null);
  const [appointmentForRecord, setAppointmentForRecord] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
  const [reportSpecialty, setReportSpecialty] = useState<ClinicalSpecialty | null>(null);
  const [reportBase, setReportBase] = useState<ClinicalRecord | null>(null);

  const [consentOpen, setConsentOpen] = useState(false);
  const [consentForm, setConsentForm] = useState<Partial<ConsentRecord>>({ type: 'clinico', signed: true });
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProfessional, setAssignProfessional] = useState('');
  const [saving, setSaving] = useState(false);

  const admin = isAdmin(user);
  const specialties = visibleClinicalSpecialties(user);
  const canManageConsents = hasPermission(user, 'clinical.consents.manage');
  const canBill = hasPermission(user, 'billing.view');
  const canAssign = hasPermission(user, 'patients.assign');
  const minor = patient ? isMinor(patient.birthDate) : false;

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const found = await dbService.getPatientById(id);
      if (!found) { setError('No se encontró la ficha del paciente o no tienes acceso.'); setLoading(false); return; }
      setPatient(found);

      const [appts, cons, hist, profs, assigns] = await Promise.all([
        dbService.getAppointmentsByPatient(id),
        dbService.getConsents(id),
        dbService.getHistoryByPatient(id),
        dbService.getProfessionals(),
        dbService.getAssignments(id),
      ]);
      setAppointments(appts);
      setConsents(cons);
      setHistory(hist);
      setProfessionals(profs.filter(p => p.role !== UserRole.ADMIN));
      setAssignments(assigns);

      if (specialties.length) {
        const lists = await Promise.all(specialties.map(s => dbService.getClinicalRecords(id, s, user)));
        setRecords(lists.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setRecords([]);
      }

      if (canBill) {
        const [invs, pays] = await Promise.all([dbService.getInvoices(), dbService.getPayments()]);
        setInvoices(invs.filter(i => i.patientId === id));
        setPayments(pays.filter(p => p.patientId === id));
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la ficha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, user.id, specialties.join(',')]);

  useEffect(() => {
    if (handled.current || loading || !patient) return;
    const appointmentId = searchParams.get('appointment');
    if (!appointmentId) return;
    handled.current = true;
    const appt = appointments.find(a => a.id === appointmentId);
    const specialty = (appt?.specialty || (user.role as ClinicalSpecialty)) as ClinicalSpecialty;
    if (appt && canWriteSpecialty(user, specialty)) {
      setNewRecordSpecialty(specialty);
      setAppointmentForRecord(appt.id);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, patient, appointments, searchParams]);

  const recordsBySpecialty = (specialty: ClinicalSpecialty) => records.filter(r => r.specialty === specialty);
  const activeObjectives = useMemo(() => {
    const list: any[] = [];
    records.forEach(r => (r.objectives || []).forEach(o => list.push({ ...o, recordId: r.id })));
    return list;
  }, [records]);

  const nextAppointment = appointments
    .filter(a => new Date(a.date) >= new Date() && a.status !== AppointmentStatus.CANCELLED)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const invoiceFor = (appointmentId: string) => invoices.find(i => i.appointmentId === appointmentId);
  const clinicalRecordFor = (appointmentId: string) => records.find(r => r.appointmentId === appointmentId);

  const saveConsent = async () => {
    if (!patient) return;
    if (!consentForm.title) { setError('Indica el título del consentimiento.'); return; }
    setSaving(true);
    try {
      await dbService.saveConsent({ ...consentForm, patientId: patient.id }, user);
      setConsentOpen(false);
      setConsentForm({ type: 'clinico', signed: true });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el consentimiento.');
    } finally {
      setSaving(false);
    }
  };

  const doAssign = async () => {
    if (!patient || !assignProfessional) return;
    const prof = professionals.find(p => p.id === assignProfessional);
    if (!prof) return;
    setSaving(true);
    try {
      await dbService.assignPatient(patient.id, prof.id, prof.role as ClinicalSpecialty);
      setAssignOpen(false);
      setAssignProfessional('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando ficha…</div>;
  }

  if (!patient) {
    return (
      <div className={cardClass}>
        <EmptyState icon={AlertTriangle} title="Ficha no disponible" description={error || 'Puede que no exista o que no tengas permiso para verla.'} action={<Link to="/patients" className={btnSecondary}><ArrowLeft size={15} /> Volver a pacientes</Link>} />
      </div>
    );
  }

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: ClipboardList },
    ...specialties.map(s => ({ id: `clinical-${s}`, label: SPECIALTY_LABELS[s], icon: s === UserRole.PSICOLOGIA ? HeartPulse : Stethoscope, count: recordsBySpecialty(s).length })),
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, count: appointments.length },
    { id: 'documents', label: 'Documentos', icon: FileCheck2, count: consents.length },
    ...(admin ? [{ id: 'admin', label: 'Administración', icon: ReceiptText }] : []),
  ];

  const renderSummary = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        {minor && (
          <InlineAlert level={patient.legalGuardian ? 'info' : 'warning'} title={patient.legalGuardian ? 'Paciente menor de edad' : 'Menor sin representante legal'}>
            {patient.legalGuardian
              ? `Representante legal: ${patient.legalGuardian.name} (${patient.legalGuardian.relationship || 'relación no indicada'}) · ${patient.legalGuardian.dni}`
              : 'No consta representante legal. Completa la ficha administrativa y los consentimientos antes de continuar.'}
          </InlineAlert>
        )}
        {(patient.alerts || []).length > 0 && (
          <InlineAlert level="warning" title="Alertas del paciente">{(patient.alerts || []).join(' · ')}</InlineAlert>
        )}
        {(patient.allergies || []).length > 0 && (
          <InlineAlert level="danger" title="Alergias registradas">{(patient.allergies || []).join(' · ')}</InlineAlert>
        )}

        <SectionCard title="Datos administrativos" description="Ficha única compartida por todas las especialidades">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: 'DNI / NIE', value: patient.dni },
              { label: 'Fecha de nacimiento', value: `${formatDate(patient.birthDate)} (${calcAge(patient.birthDate) ?? '—'} años)` },
              { label: 'Sexo', value: patient.sex || 'Sin especificar' },
              { label: 'Estado', value: patient.status || 'activo' },
              { label: 'Teléfono', value: patient.phone || '—', icon: Phone },
              { label: 'Email', value: patient.email || '—', icon: Mail },
              { label: 'Dirección', value: patient.address || '—', icon: MapPin },
              { label: 'Alta en el centro', value: formatDate(patient.createdAt) },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{item.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-700">{item.value}</p>
              </div>
            ))}
          </div>
          {patient.administrativeNotes && (
            <div className="mt-4 rounded-xl bg-stone-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Notas administrativas</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{patient.administrativeNotes}</p>
            </div>
          )}
        </SectionCard>

        {patient.legalGuardian && (
          <SectionCard title="Representante legal" description="Contacto y autorización para menores">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Nombre</p><p className="text-sm text-stone-700">{patient.legalGuardian.name}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">DNI</p><p className="text-sm text-stone-700">{patient.legalGuardian.dni}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Teléfono</p><p className="text-sm text-stone-700">{patient.legalGuardian.phone || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email</p><p className="text-sm text-stone-700">{patient.legalGuardian.email || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Relación</p><p className="text-sm text-stone-700">{patient.legalGuardian.relationship || '—'}</p></div>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Trazabilidad administrativa" description="Altas, vinculaciones y cambios administrativos" padded={false}>
          {history.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sin movimientos administrativos" />
          ) : (
            <div className="divide-y divide-stone-100">
              {history.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-stone-700">{entry.description}</p>
                    <p className="mt-0.5 text-[10px] text-stone-400">{formatDate(entry.date, true)} · {entry.professionalName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="Especialidades vinculadas" description="Cada una con su historia segmentada" padded={false}>
          {(patient.assignedSpecialties || []).length === 0 ? (
            <div className="p-4">
              <p className="text-xs text-stone-500">Sin especialidades asignadas.</p>
              {canAssign && <button onClick={() => setAssignOpen(true)} className={btnSecondary + ' mt-3 w-full text-xs'}><UserPlus size={14} /> Asignar profesional</button>}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {CLINICAL_SPECIALTIES.filter(s => (patient.assignedSpecialties || []).includes(s)).map(s => {
                const profile = getRoleProfile(s);
                const visible = canViewSpecialty(user, s);
                return (
                  <div key={s} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${profile.soft} ${profile.text}`}>{visible ? <Stethoscope size={15} /> : <LockKeyhole size={15} />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-800">{profile.label}</p>
                      <p className="text-[10px] text-stone-400">{visible ? `${recordsBySpecialty(s).length} registro(s)` : 'Historia reservada'}</p>
                    </div>
                    {canViewSpecialty(user, s) && <button onClick={() => setTab(`clinical-${s}`)} className="text-[11px] font-semibold text-stone-500 hover:text-stone-800">Abrir</button>}
                  </div>
                );
              })}
              {canAssign && (
                <button onClick={() => setAssignOpen(true)} className="w-full px-4 py-2.5 text-center text-[11px] font-semibold text-stone-500 hover:bg-stone-50 hover:text-stone-800">
                  + Vincular otra especialidad
                </button>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Próxima cita">
          {nextAppointment ? (
            <div>
              <p className="text-sm font-bold text-stone-900">{formatDate(nextAppointment.date, true)}</p>
              <p className="mt-0.5 text-xs text-stone-500">{nextAppointment.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {nextAppointment.specialty && <SpecialtyBadge specialty={nextAppointment.specialty} />}
                <Badge className={APPOINTMENT_STATUS_COLORS[nextAppointment.status]}>{APPOINTMENT_STATUS_LABELS[nextAppointment.status]}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-400">No hay citas próximas.</p>
          )}
          <Link to={`/appointments?patient=${patient.id}`} className={btnGhost + ' mt-3 w-full border border-stone-200 text-xs'}><CalendarDays size={13} /> Ver agenda del paciente</Link>
        </SectionCard>

        {activeObjectives.length > 0 && (
          <SectionCard title="Objetivos en seguimiento" description={`${activeObjectives.length} objetivo(s)`}>
            <ObjectiveProgress objectives={activeObjectives.slice(0, 8)} />
          </SectionCard>
        )}

        <SectionCard title="Consentimientos" description={`${consents.filter(c => c.signed).length} firmados de ${consents.length}`}>
          <div className="space-y-2">
            {consents.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-start gap-2">
                {c.signed ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-fisio-600" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-stone-700">{c.title}</p>
                  <p className="text-[10px] text-stone-400">{c.signed ? `Firmado ${formatDate(c.date)}` : 'Pendiente'}</p>
                </div>
              </div>
            ))}
            <button onClick={() => setTab('documents')} className="text-[11px] font-semibold text-stone-500 hover:text-stone-800">Gestionar documentos →</button>
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const renderClinical = (specialty: ClinicalSpecialty) => {
    if (!canViewSpecialty(user, specialty)) {
      return <EmptyState icon={LockKeyhole} title="Historia reservada" description="No tienes autorización para consultar esta especialidad." />;
    }
    const specialtyRecords = recordsBySpecialty(specialty);
    const latest = specialtyRecords[0];
    const writable = canWriteSpecialty(user, specialty);
    const profile = getRoleProfile(specialty);
    const pending = appointments.filter(a => a.specialty === specialty && a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded);

    return (
      <div className="space-y-4">
        <div className={`flex flex-col gap-3 rounded-2xl border ${profile.border} ${profile.soft} p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Historia de {profile.label}</p>
            <p className="mt-1 text-sm text-stone-700">
              {specialtyRecords.length ? `${specialtyRecords.length} registro(s) · último ${formatDate(latest.date)}` : 'Sin registros clínicos todavía.'}
            </p>
            {pending.length > 0 && <p className="mt-1 text-[11px] font-semibold text-amber-700">{pending.length} sesión(es) realizada(s) sin registro.</p>}
          </div>
          {writable && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setNewRecordSpecialty(specialty); setEditingRecord(null); }} className={btnPrimary}><Plus size={15} /> Nuevo registro</button>
              <button onClick={() => { setReportSpecialty(specialty); setReportBase(null); }} className={btnSecondary}><FileText size={15} /> Informe</button>
            </div>
          )}
        </div>

        {!writable && (
          <InlineAlert level="warning" title="Acceso de solo lectura">
            Puedes consultar esta historia por autorización expresa, pero no modificarla. El acceso queda auditado.
          </InlineAlert>
        )}

        {latest && (
          <SectionCard title="Último registro" description={`${formatDate(latest.date)} · ${latest.recordType}`}>
            <p className="text-sm leading-relaxed text-stone-700">{latest.summary || 'Sin síntesis.'}</p>
            {latest.objectives?.length > 0 && <div className="mt-3"><ObjectiveProgress objectives={latest.objectives} /></div>}
          </SectionCard>
        )}

        <ClinicalEvolution
          records={specialtyRecords}
          specialty={specialty}
          onOpen={writable ? record => { setNewRecordSpecialty(specialty); setEditingRecord(record); } : undefined}
          onReport={record => { setReportSpecialty(specialty); setReportBase(record); }}
        />
      </div>
    );
  };

  const renderAgenda = () => (
    <div className="space-y-4">
      <SectionCard title="Citas del paciente" description="Historial completo en el centro" padded={false}>
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Sin citas" description="No hay citas registradas para este paciente." />
        ) : (
          <div className="divide-y divide-stone-100">
            {appointments.map(appt => {
              const invoice = invoiceFor(appt.id);
              const record = clinicalRecordFor(appt.id);
              const state = getAppointmentAdminState(appt, { invoiceStatus: invoice?.status || null, hasClinicalRecord: !!record });
              return (
                <div key={appt.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-bold text-stone-800">{formatDate(appt.date)}</p>
                    <p className="text-[10px] text-stone-400">{formatTime(appt.date)} · {appt.durationMinutes || 45} min</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {appt.specialty && <SpecialtyBadge specialty={appt.specialty} />}
                      <Badge className={APPOINTMENT_STATUS_COLORS[appt.status]}>{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
                      <Badge className={ADMIN_STATE_COLORS[state]}>{ADMIN_STATE_LABELS[state]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">{appt.reason}{appt.room ? ` · ${appt.room}` : ''}</p>
                    <p className="text-[10px] text-stone-400">{appt.professionalName || 'Profesional'} {invoice ? `· Factura ${invoice.number}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {appt.status === AppointmentStatus.COMPLETED && appt.specialty && canWriteSpecialty(user, appt.specialty) && !record && (
                      <button
                        onClick={() => { setNewRecordSpecialty(appt.specialty!); setAppointmentForRecord(appt.id); setEditingRecord(null); }}
                        className={btnSecondary + ' !px-3 !py-1.5 text-[11px]'}
                      >
                        Registrar
                      </button>
                    )}
                    {record && canViewSpecialty(user, record.specialty) && (
                      <button
                        onClick={() => { setNewRecordSpecialty(record.specialty); setEditingRecord(record); }}
                        className={btnGhost + ' border border-stone-200 text-[11px]'}
                      >
                        Ver registro
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-4">
      {minor && (
        <InlineAlert level={consents.some(c => c.type === 'menores' && c.signed) ? 'success' : 'warning'} title="Protección del menor">
          {consents.some(c => c.type === 'menores' && c.signed)
            ? 'Consta autorización de representación legal. Revisa también la coordinación con terceros.'
            : 'Falta la autorización de representación legal. No se debe iniciar el tratamiento sin ella.'}
        </InlineAlert>
      )}
      <SectionCard
        title="Consentimientos y documentos"
        description="Trazabilidad de firmas, representación legal y autorizaciones"
        actions={canManageConsents ? <button onClick={() => setConsentOpen(true)} className={btnPrimary}><Plus size={15} /> Añadir</button> : undefined}
        padded={false}
      >
        {consents.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Sin documentos" description="Registra el consentimiento de privacidad y el consentimiento clínico." />
        ) : (
          <div className="divide-y divide-stone-100">
            {consents.map(c => (
              <div key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.signed ? 'bg-fisio-50 text-fisio-700' : 'bg-amber-50 text-amber-700'}`}>
                  {c.signed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-800">{c.title}</p>
                  <p className="text-[11px] text-stone-400">
                    {consentTypes.find(t => t.value === c.type)?.label || c.type}
                    {c.guardianName ? ` · Representante: ${c.guardianName}` : ''}
                    {c.date ? ` · ${formatDate(c.date)}` : ''}
                    {c.expiresAt ? ` · Caduca ${formatDate(c.expiresAt)}` : ''}
                  </p>
                  {c.notes && <p className="mt-0.5 text-[11px] text-stone-500">{c.notes}</p>}
                </div>
                <Badge className={c.signed ? 'border-fisio-200 bg-fisio-50 text-fisio-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                  {c.signed ? 'Firmado' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Política de privacidad" description="Estado del consentimiento administrativo">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            {patient.privacyPolicySigned ? 'Consta consentimiento de privacidad firmado.' : 'No consta consentimiento de privacidad firmado.'}
          </p>
          {canManageConsents && (
            <button
              onClick={async () => {
                await dbService.updatePatientPrivacy(patient.id, !patient.privacyPolicySigned);
                await load();
              }}
              className={btnSecondary + ' text-xs'}
            >
              Marcar como {patient.privacyPolicySigned ? 'pendiente' : 'firmado'}
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderAdmin = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cardClass + ' p-4'}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Facturado</p>
          <p className="mt-1 text-xl font-bold text-stone-900">{formatMoney(invoices.reduce((s, i) => s + i.total, 0))}</p>
        </div>
        <div className={cardClass + ' p-4'}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Cobrado</p>
          <p className="mt-1 text-xl font-bold text-fisio-700">{formatMoney(payments.reduce((s, p) => s + p.amount, 0))}</p>
        </div>
        <div className={cardClass + ' p-4'}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pendiente</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{formatMoney(invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0))}</p>
        </div>
      </div>

      <SectionCard title="Facturas del paciente" description={canBill ? 'Solo administración' : 'Sin permiso de facturación'} padded={false}>
        {!canBill ? (
          <EmptyState icon={LockKeyhole} title="Acceso restringido" />
        ) : invoices.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Sin facturas" />
        ) : (
          <div className="divide-y divide-stone-100">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-800">{inv.number}</p>
                  <p className="text-[10px] text-stone-400">{formatDate(inv.date)} · {inv.status}</p>
                </div>
                <p className="text-sm font-bold text-stone-800">{formatMoney(inv.total)}</p>
                <Link to="/billing?tab=invoices" className="text-[11px] font-semibold text-stone-500 hover:text-stone-800">Ver</Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Cobros registrados" padded={false}>
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="Sin cobros" />
        ) : (
          <div className="divide-y divide-stone-100">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-stone-800">{p.concept}</p>
                  <p className="text-[10px] text-stone-400">{formatDate(p.paymentDate)} · {p.method}</p>
                </div>
                <p className="text-sm font-bold text-fisio-700">{formatMoney(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Vinculación clínica" description="Profesionales y especialidades asignadas">
        <div className="space-y-2">
          {assignments.filter(a => a.active).map(a => {
            const prof = professionals.find(p => p.id === a.professionalId);
            return (
              <div key={`${a.professionalId}-${a.specialty}`} className="flex items-center gap-2 rounded-lg border border-stone-100 px-3 py-2">
                <UserCog size={14} className="text-stone-400" />
                <span className="text-xs text-stone-700">{prof?.name || 'Profesional'}</span>
                <SpecialtyBadge specialty={a.specialty} />
              </div>
            );
          })}
          {assignments.length === 0 && <p className="text-xs text-stone-400">Sin vinculaciones.</p>}
          {canAssign && <button onClick={() => setAssignOpen(true)} className={btnSecondary + ' text-xs'}><UserPlus size={14} /> Asignar profesional</button>}
        </div>
      </SectionCard>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-stone-200/80 pb-5">
        <Link to="/patients" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800">
          <ArrowLeft size={14} /> Volver a pacientes
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
              (patient.assignedSpecialties || [])[0] ? `${getRoleProfile((patient.assignedSpecialties || [])[0]).soft} ${getRoleProfile((patient.assignedSpecialties || [])[0]).text}` : 'bg-slate-100 text-slate-600'
            }`}>
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl text-stone-900">{patientFullName(patient)}</h1>
                {minor && <Badge className="border-logo-200 bg-logo-50 text-logo-800"><Baby size={11} /> Menor</Badge>}
                {!patient.privacyPolicySigned && <Badge className="border-amber-200 bg-amber-50 text-amber-800"><AlertTriangle size={11} /> RGPD pendiente</Badge>}
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {patient.dni} · {calcAge(patient.birthDate) ?? '—'} años · {patient.phone || 'sin teléfono'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(patient.assignedSpecialties || []).map(s => <SpecialtyBadge key={s} specialty={s} />)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin && <Link to={`/appointments?new=1&patient=${patient.id}`} className={btnSecondary}><CalendarDays size={15} /> Nueva cita</Link>}
            {specialties.length > 0 && canWriteSpecialty(user, specialties[0]) && (
              <button onClick={() => { setNewRecordSpecialty(specialties[0]); setEditingRecord(null); }} className={btnPrimary}><Plus size={15} /> Registrar sesión</button>
            )}
          </div>
        </div>
      </div>

      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}

      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === 'resumen' && renderSummary()}
      {tab.startsWith('clinical-') && renderClinical(tab.replace('clinical-', '') as ClinicalSpecialty)}
      {tab === 'agenda' && renderAgenda()}
      {tab === 'documents' && renderDocuments()}
      {tab === 'admin' && admin && renderAdmin()}

      {newRecordSpecialty && (
        <ClinicalRecordModal
          open={!!newRecordSpecialty}
          onClose={() => { setNewRecordSpecialty(null); setEditingRecord(null); setAppointmentForRecord(null); }}
          patient={patient}
          specialty={newRecordSpecialty}
          professional={user}
          appointmentId={appointmentForRecord}
          existing={editingRecord}
          previousObjectives={editingRecord ? [] : records.filter(r => r.specialty === newRecordSpecialty && r.objectives?.length)[0]?.objectives || []}
          onSaved={load}
        />
      )}

      {reportSpecialty && (
        <ClinicalReportModal
          open={!!reportSpecialty}
          onClose={() => { setReportSpecialty(null); setReportBase(null); }}
          patient={patient}
          specialty={reportSpecialty}
          professional={user}
          records={recordsBySpecialty(reportSpecialty)}
          baseRecord={reportBase}
          onSaved={load}
        />
      )}

      <Modal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Añadir consentimiento"
        subtitle={patientFullName(patient)}
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setConsentOpen(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveConsent} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tipo de documento">
            <select className={inputClass} value={consentForm.type} onChange={e => setConsentForm({ ...consentForm, type: e.target.value as ConsentRecord['type'], title: consentTypes.find(t => t.value === e.target.value)?.label || '' })}>
              {consentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Título" required><input className={inputClass} value={consentForm.title || ''} onChange={e => setConsentForm({ ...consentForm, title: e.target.value })} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fecha"><input type="date" className={inputClass} value={consentForm.date || ''} onChange={e => setConsentForm({ ...consentForm, date: e.target.value })} /></Field>
            <Field label="Caducidad (opcional)"><input type="date" className={inputClass} value={consentForm.expiresAt || ''} onChange={e => setConsentForm({ ...consentForm, expiresAt: e.target.value })} /></Field>
            <Field label="Firmado por"><input className={inputClass} value={consentForm.signedBy || ''} onChange={e => setConsentForm({ ...consentForm, signedBy: e.target.value })} /></Field>
            <Field label="Representante legal"><input className={inputClass} value={consentForm.guardianName || ''} onChange={e => setConsentForm({ ...consentForm, guardianName: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" className="accent-stone-800" checked={consentForm.signed !== false} onChange={e => setConsentForm({ ...consentForm, signed: e.target.checked })} />
            Documento firmado
          </label>
          <Field label="Notas"><textarea className={`${inputClass} resize-y`} rows={2} value={consentForm.notes || ''} onChange={e => setConsentForm({ ...consentForm, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Vincular profesional"
        subtitle="La historia clínica seguirá segmentada por especialidad"
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setAssignOpen(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={doAssign} className={btnPrimary} disabled={saving || !assignProfessional}>{saving ? 'Guardando…' : 'Vincular'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Profesional">
            <select className={inputClass} value={assignProfessional} onChange={e => setAssignProfessional(e.target.value)}>
              <option value="">Seleccionar profesional</option>
              {professionals.filter(p => p.active !== false).map(p => (
                <option key={p.id} value={p.id}>{p.name} · {SPECIALTY_LABELS[p.role] || p.role}</option>
              ))}
            </select>
          </Field>
          <p className="text-[11px] leading-relaxed text-stone-500">El profesional verá la ficha administrativa y solo la historia clínica de su propia especialidad. La asignación quedará registrada en auditoría.</p>
        </div>
      </Modal>
    </div>
  );
};

export default PatientDetail;
