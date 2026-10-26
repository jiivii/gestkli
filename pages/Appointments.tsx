import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Ban, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, Clock, CreditCard, FileText, Filter, Plus, ReceiptText, RefreshCw,
  Search, UserX, XCircle,
} from 'lucide-react';
import {
  Appointment, AppointmentStatus, ClinicalSpecialty, Invoice, Patient, Service, User, UserRole,
} from '../types';
import { dbService } from '../services/dbService';
import { hasPermission, isAdmin } from '../services/permissions';
import {
  ADMIN_STATE_COLORS, ADMIN_STATE_LABELS, APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS,
  CLINICAL_SPECIALTIES, formatDate, formatMoney, formatTime, getAppointmentAdminState,
  getRoleProfile, localTodayISO, patientFullName, SPECIALTY_LABELS,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SpecialtyBadge, StatCard,
  btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';

interface Props { user: User; }

interface FormState {
  patientId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  durationMinutes: number;
  reason: string;
  room: string;
  notes: string;
  weeks: number;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Appointments: React.FC<Props> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const admin = isAdmin(user);
  const canManage = hasPermission(user, admin ? 'agenda.manage.all' : 'agenda.manage.own');
  const specialty = CLINICAL_SPECIALTIES.includes(user.role as ClinicalSpecialty) ? user.role as ClinicalSpecialty : null;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDate, setSelectedDate] = useState(localTodayISO());
  const [view, setView] = useState<'day' | 'upcoming'>('day');
  const [filterProfessional, setFilterProfessional] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [onlyPendingRecord, setOnlyPendingRecord] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    patientId: '', professionalId: '', serviceId: '',
    date: localTodayISO(), time: '10:00', durationMinutes: 45,
    reason: '', room: '', notes: '', weeks: 1,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [appts, pats, profs, servs, invs] = await Promise.all([
        dbService.getAppointments(user),
        dbService.getPatients(user.id, user.role),
        dbService.getProfessionals(),
        dbService.getServices(),
        admin ? dbService.getInvoices() : Promise.resolve([]),
      ]);
      setAppointments(appts);
      setPatients(pats);
      setProfessionals(profs.filter(p => p.role !== UserRole.ADMIN && p.active !== false));
      setServices(servs.filter(s => s.active));
      setInvoices(invs);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id, user.role]);

  useEffect(() => {
    const newParam = searchParams.get('new');
    const patientParam = searchParams.get('patient');
    const filter = searchParams.get('filter');
    if (filter === 'sin_registro') setOnlyPendingRecord(true);
    if (newParam === '1' && canManage) {
      setForm(f => ({
        ...f,
        patientId: patientParam || f.patientId,
        professionalId: specialty ? user.id : f.professionalId,
      }));
      setModalOpen(true);
    }
    if (newParam || patientParam || filter) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManage, specialty, user.id]);

  const openNew = () => {
    setForm({
      patientId: '', professionalId: specialty ? user.id : '',
      serviceId: '', date: selectedDate, time: '10:00', durationMinutes: 45,
      reason: '', room: '', notes: '', weeks: 1,
    });
    setFormError('');
    setModalOpen(true);
  };

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const pickService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) { set({ serviceId }); return; }
    set({
      serviceId,
      durationMinutes: service.durationMinutes,
      room: service.room || '',
      reason: form.reason || service.name,
      professionalId: form.professionalId || (specialty ? user.id : ''),
    });
  };

  const invoiceFor = (appointmentId: string) => invoices.find(i => i.appointmentId === appointmentId);

  const filtered = useMemo(() => {
    return appointments.filter(appt => {
      if (view === 'day' && dayKey(appt.date) !== selectedDate) return false;
      if (view === 'upcoming' && new Date(appt.date) < new Date(new Date().setHours(0, 0, 0, 0))) return false;
      if (filterProfessional && appt.professionalId !== filterProfessional) return false;
      if (filterSpecialty && appt.specialty !== filterSpecialty) return false;
      if (filterStatus && appt.status !== filterStatus) return false;
      if (onlyPendingRecord && !(appt.status === AppointmentStatus.COMPLETED && !appt.clinicalRecorded)) return false;
      if (search.trim()) {
        const patient = patients.find(p => p.id === appt.patientId);
        const haystack = `${appt.patientName || ''} ${patient ? patientFullName(patient) : ''} ${appt.reason} ${appt.professionalName || ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments, selectedDate, view, filterProfessional, filterSpecialty, filterStatus, onlyPendingRecord, search, patients]);

  const todayAppts = appointments.filter(a => dayKey(a.date) === localTodayISO());
  const pendingRecordCount = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded).length;
  const pendingInvoiceCount = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !invoiceFor(a.id)).length;

  const conflicts = useMemo(() => {
    if (!modalOpen || !form.professionalId || !form.date || !form.time) return [];
    const start = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(start.getTime())) return [];
    const end = new Date(start.getTime() + form.durationMinutes * 60000);
    return appointments.filter(a => {
      if (a.professionalId !== form.professionalId) return false;
      if ([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(a.status)) return false;
      const aStart = new Date(a.date);
      const aEnd = new Date(aStart.getTime() + (a.durationMinutes || 45) * 60000);
      return start < aEnd && end > aStart;
    });
  }, [modalOpen, form.professionalId, form.date, form.time, form.durationMinutes, appointments]);

  const createAppointment = async () => {
    setFormError('');
    if (!form.patientId) { setFormError('Selecciona un paciente.'); return; }
    if (!form.professionalId) { setFormError('Selecciona un profesional.'); return; }
    if (!form.date || !form.time) { setFormError('Indica fecha y hora.'); return; }
    const when = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(when.getTime())) { setFormError('Fecha u hora no válidas.'); return; }

    setSaving(true);
    try {
      const professional = professionals.find(p => p.id === form.professionalId);
      const service = services.find(s => s.id === form.serviceId);
      const resolvedSpecialty = (service && CLINICAL_SPECIALTIES.includes(service.specialty as ClinicalSpecialty))
        ? service.specialty as ClinicalSpecialty
        : (professional?.profession as ClinicalSpecialty) || (professional?.role as ClinicalSpecialty) || undefined;

      const payload: Partial<Appointment> = {
        patientId: form.patientId,
        professionalId: form.professionalId,
        date: when.toISOString(),
        status: AppointmentStatus.PENDING,
        reason: form.reason || service?.name || 'Consulta',
        notes: form.notes,
        specialty: resolvedSpecialty,
        serviceId: form.serviceId || null,
        room: form.room || null,
        durationMinutes: form.durationMinutes,
        createdBy: user.id,
      };
      const result = form.weeks > 1
        ? await dbService.createRecurringAppointments(payload, form.weeks)
        : await dbService.createAppointment(payload);
      if (!result.success) throw new Error(result.message || 'No se pudo crear la cita.');
      setModalOpen(false);
      setNotice(form.weeks > 1 ? `${form.weeks} citas creadas correctamente.` : 'Cita creada correctamente.');
      await load();
    } catch (e: any) {
      setFormError(e?.message || 'No se pudo crear la cita.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (appt: Appointment, status: AppointmentStatus) => {
    try {
      await dbService.updateAppointment(appt.id, { status });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el estado.');
    }
  };

  const issueInvoice = async (appt: Appointment) => {
    const service = services.find(s => s.id === appt.serviceId);
    const amount = service?.price || 0;
    if (!amount) {
      setError('La cita no tiene un servicio con precio. Configúralo en Servicios y tarifas.');
      return;
    }
    try {
      const number = await dbService.nextInvoiceNumber();
      const subtotal = amount;
      const taxRate = service?.taxRate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      await dbService.saveInvoice({
        number,
        patientId: appt.patientId,
        appointmentId: appt.id,
        date: localTodayISO(),
        dueDate: addDays(localTodayISO(), 30),
        items: [{
          id: `ii-${Date.now()}`,
          serviceId: service?.id || null,
          description: service?.name || appt.reason,
          quantity: 1,
          unitPrice: amount,
        }],
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount,
        amountPaid: 0,
        status: 'emitida',
        notes: 'Factura generada desde la agenda.',
        createdBy: user.id,
      }, user);
      setNotice(`Factura emitida por ${formatMoney(subtotal + taxAmount)}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo emitir la factura.');
    }
  };

  const apptActions = (appt: Appointment) => {
    const invoice = invoiceFor(appt.id);
    const state = getAppointmentAdminState(appt, { invoiceStatus: invoice?.status || null });
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {appt.status !== AppointmentStatus.COMPLETED && appt.status !== AppointmentStatus.CANCELLED && appt.status !== AppointmentStatus.NO_SHOW && canManage && (
          <>
            <button onClick={() => changeStatus(appt, AppointmentStatus.CONFIRMED)} className={btnGhost + ' border border-stone-200 !px-2 !py-1 text-[10px]'} title="Confirmar">
              <CheckCircle2 size={12} /> Confirmar
            </button>
            <button onClick={() => changeStatus(appt, AppointmentStatus.COMPLETED)} className={btnGhost + ' border border-fisio-200 !px-2 !py-1 text-[10px] text-fisio-700'} title="Marcar realizada">
              <CheckCircle2 size={12} /> Realizada
            </button>
            <button onClick={() => changeStatus(appt, AppointmentStatus.NO_SHOW)} className={btnGhost + ' border border-stone-200 !px-2 !py-1 text-[10px]'} title="Ausencia">
              <UserX size={12} /> Ausente
            </button>
            <button onClick={() => changeStatus(appt, AppointmentStatus.CANCELLED)} className={btnGhost + ' !px-2 !py-1 text-[10px] text-red-600'} title="Cancelar">
              <Ban size={12} /> Cancelar
            </button>
          </>
        )}

        {appt.specialty && (appt.status === AppointmentStatus.COMPLETED) && (
          appt.clinicalRecorded ? (
            <Badge className="border-fisio-200 bg-fisio-50 text-fisio-800"><CheckCircle2 size={10} /> Registro</Badge>
          ) : (
            <Link to={`/patient/${appt.patientId}?appointment=${appt.id}`} className={btnGhost + ' border border-amber-200 !px-2 !py-1 text-[10px] text-amber-800'}>
              <FileText size={12} /> Registrar
            </Link>
          )
        )}

        {admin && appt.status === AppointmentStatus.COMPLETED && (
          invoice ? (
            <Link to="/billing?tab=invoices" className={btnGhost + ' border border-stone-200 !px-2 !py-1 text-[10px]'}>
              <ReceiptText size={12} /> {invoice.number}
            </Link>
          ) : (
            <button onClick={() => issueInvoice(appt)} className={btnGhost + ' border border-nutri-200 !px-2 !py-1 text-[10px] text-nutri-800'}>
              <ReceiptText size={12} /> Facturar
            </button>
          )
        )}

        <Link to={`/patient/${appt.patientId}`} className={btnGhost + ' !px-2 !py-1 text-[10px]'}>
          Ficha <ChevronRight size={12} />
        </Link>
        <Badge className={ADMIN_STATE_COLORS[state]}>{ADMIN_STATE_LABELS[state]}</Badge>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={admin ? 'Administración · Agenda global' : `Consulta de ${getRoleProfile(user.role).label}`}
        title={admin ? 'Agenda del centro' : 'Mi agenda'}
        description="Reservada → realizada → registro clínico completado → factura emitida → factura pagada."
        icon={CalendarDays}
        actions={
          <>
            <button onClick={load} className={btnSecondary}><RefreshCw size={15} /> Actualizar</button>
            {canManage && <button onClick={openNew} className={btnPrimary}><Plus size={16} /> Nueva cita</button>}
          </>
        }
      />

      {notice && <InlineAlert level="success" title="Hecho">{notice}</InlineAlert>}
      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Citas hoy" value={todayAppts.length} icon={CalendarDays} hint={`${todayAppts.filter(a => a.status === AppointmentStatus.CONFIRMED).length} confirmadas`} tone="blue" />
        <StatCard title="Sin registro" value={pendingRecordCount} icon={FileText} hint="Realizadas sin evolución" tone={pendingRecordCount ? 'red' : 'neutral'} onClick={() => setOnlyPendingRecord(true)} />
        <StatCard title="Sin factura" value={pendingInvoiceCount} icon={ReceiptText} hint={admin ? 'Pendientes de facturar' : 'Solo administración'} tone="orange" />
        <StatCard title="Canceladas / ausencias" value={appointments.filter(a => [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(a.status)).length} icon={XCircle} hint="Histórico visible" tone="neutral" />
      </div>

      <div className={cardClass + ' p-3 md:p-4'}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className={btnGhost + ' border border-stone-200 !p-1.5'}><ChevronLeft size={16} /></button>
              <input type="date" className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-700" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setView('day'); }} />
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className={btnGhost + ' border border-stone-200 !p-1.5'}><ChevronRight size={16} /></button>
              <button onClick={() => setSelectedDate(localTodayISO())} className={btnGhost + ' text-xs'}>Hoy</button>
            </div>
            <div className="flex rounded-xl border border-stone-200 bg-white p-0.5">
              <button onClick={() => setView('day')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'day' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}>Día</button>
              <button onClick={() => setView('upcoming')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'upcoming' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}>Próximas</button>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
              <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar paciente, motivo o profesional…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {admin && (
                <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={filterProfessional} onChange={e => setFilterProfessional(e.target.value)}>
                  <option value="">Todos los profesionales</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {admin && (
                <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}>
                  <option value="">Todas las especialidades</option>
                  {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
                </select>
              )}
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}
              </select>
              <button onClick={() => setOnlyPendingRecord(v => !v)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${onlyPendingRecord ? 'border-red-300 bg-red-50 text-red-700' : 'border-stone-200 bg-white text-stone-600'}`}>
                Sin registro
              </button>
            </div>
          </div>
          <p className="text-[11px] text-stone-400">
            {view === 'day' ? `Citas del ${formatDate(selectedDate)}` : 'Citas desde hoy'} · {filtered.length} resultado(s)
          </p>
        </div>
      </div>

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando agenda…</div>
      ) : filtered.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={CalendarDays} title="Sin citas" description={view === 'day' ? 'No hay citas para este día con los filtros aplicados.' : 'No hay citas próximas con los filtros aplicados.'} action={canManage ? <button onClick={openNew} className={btnPrimary}><Plus size={15} /> Nueva cita</button> : undefined} />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(appt => {
            const patient = patients.find(p => p.id === appt.patientId);
            const professional = professionals.find(p => p.id === appt.professionalId);
            const profile = getRoleProfile(appt.specialty);
            return (
              <div key={appt.id} className={`${cardClass} p-3 md:p-4`}>
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-bold text-stone-900">{formatTime(appt.date)}</p>
                    <p className="text-[10px] text-stone-400">{appt.durationMinutes || 45} min</p>
                  </div>
                  <div className={`h-10 w-1 shrink-0 rounded-full ${profile.solid}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/patient/${appt.patientId}`} className="truncate text-sm font-bold text-stone-900 hover:underline">
                        {appt.patientName || (patient ? patientFullName(patient) : 'Paciente')}
                      </Link>
                      {appt.specialty && <SpecialtyBadge specialty={appt.specialty} />}
                      <Badge className={APPOINTMENT_STATUS_COLORS[appt.status]}>{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {appt.reason} {appt.room ? `· ${appt.room}` : ''} · {appt.professionalName || professional?.name || 'Profesional'}
                    </p>
                    {view === 'upcoming' && <p className="text-[10px] text-stone-400">{formatDate(appt.date, true)}</p>}
                    {appt.notes && <p className="mt-1 line-clamp-1 text-[11px] text-stone-400">{appt.notes}</p>}
                  </div>
                </div>
                <div className="mt-2 border-t border-stone-100 pt-2">
                  {apptActions(appt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva cita"
        subtitle="La cita quedará reservada y visible en la agenda correspondiente"
        accent="bg-slate-700"
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={createAppointment} className={btnPrimary} disabled={saving}>{saving ? 'Creando…' : form.weeks > 1 ? `Crear ${form.weeks} citas` : 'Crear cita'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {formError && <InlineAlert level="danger">{formError}</InlineAlert>}
          {conflicts.length > 0 && (
            <InlineAlert level="warning" title="Posible solapamiento">
              {conflicts.map(c => c.patientName || 'Paciente').join(', ')} ya tiene(n) una cita en ese tramo con el profesional seleccionado. Puedes continuar, pero revisa la agenda.
            </InlineAlert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Paciente" required className="sm:col-span-2">
              <select className={inputClass} value={form.patientId} onChange={e => set({ patientId: e.target.value })}>
                <option value="">Seleccionar paciente</option>
                {patients.map(p => <option key={p.id} value={p.id}>{patientFullName(p)} — {p.dni}</option>)}
              </select>
            </Field>
            <Field label="Profesional" required>
              <select className={inputClass} value={form.professionalId} onChange={e => set({ professionalId: e.target.value })} disabled={!!specialty && !admin}>
                <option value="">Seleccionar</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name} · {SPECIALTY_LABELS[p.role] || 'Profesional'}</option>)}
              </select>
            </Field>
            <Field label="Servicio">
              <select className={inputClass} value={form.serviceId} onChange={e => pickService(e.target.value)}>
                <option value="">Sin servicio</option>
                {services.filter(s => !specialty || s.specialty === specialty || s.specialty === 'otro').map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {formatMoney(s.price)}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha" required><input type="date" className={inputClass} value={form.date} onChange={e => set({ date: e.target.value })} /></Field>
            <Field label="Hora" required><input type="time" className={inputClass} value={form.time} onChange={e => set({ time: e.target.value })} /></Field>
            <Field label="Duración (minutos)"><input type="number" min={10} step={5} className={inputClass} value={form.durationMinutes} onChange={e => set({ durationMinutes: Number(e.target.value) })} /></Field>
            <Field label="Sala"><input className={inputClass} value={form.room} onChange={e => set({ room: e.target.value })} placeholder="Ej. Sala 1" /></Field>
            <Field label="Motivo" className="sm:col-span-2"><input className={inputClass} value={form.reason} onChange={e => set({ reason: e.target.value })} placeholder="Motivo de la cita" /></Field>
            <Field label="Notas"><textarea className={`${inputClass} resize-y`} rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} /></Field>
            <Field label="Repetir semanalmente" hint="Crea la cita en la misma franja durante varias semanas.">
              <select className={inputClass} value={form.weeks} onChange={e => set({ weeks: Number(e.target.value) })}>
                {[1, 2, 3, 4, 6, 8, 12].map(w => <option key={w} value={w}>{w === 1 ? 'No repetir' : `${w} semanas`}</option>)}
              </select>
            </Field>
          </div>
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
            La cita se crea como <strong>reservada</strong>. El profesional la confirma y, tras la sesión, registra la evolución. Administración emite y cobra la factura.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Appointments;
