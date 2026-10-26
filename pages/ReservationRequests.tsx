import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarPlus, Check, CheckCircle2, Clock, ExternalLink, Inbox,
  Loader2, Mail, Phone, RefreshCw, Search, Trash2, UserPlus, X,
} from 'lucide-react';
import { Appointment, Patient, ReservationRequest, ReservationStatus, User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { getProfessionalLabel, patientFullName } from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, StatCard,
  btnGhost, btnPrimary, btnSecondary, cardClass, inputClass, labelClass,
} from '../components/ui';

interface Props { user: User; }

interface NewPatientForm {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  phone: string;
  email: string;
}

interface AcceptForm {
  request: ReservationRequest;
  professionalId: string;
  date: string;
  reason: string;
  notes: string;
  patientMode: 'existing' | 'new';
  patientId: string;
  patientSearch: string;
  newPatient: NewPatientForm;
  saving: boolean;
  error: string | null;
}

type FilterStatus = 'all' | ReservationStatus;

const STATUS_META: Record<ReservationStatus, { label: string; badge: string; dot: string }> = {
  pendiente: { label: 'Pendiente', badge: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  confirmada: { label: 'Confirmada', badge: 'border-fisio-200 bg-fisio-50 text-fisio-800', dot: 'bg-fisio-500' },
  cancelada: { label: 'Rechazada', badge: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
};

const formatRequestedDate = (request: ReservationRequest): string => {
  const d = new Date(`${request.fecha}T${request.hora}`);
  if (Number.isNaN(d.getTime())) return `${request.fecha} ${request.hora}`;
  return d.toLocaleString('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'S';

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const ReservationRequests: React.FC<Props> = ({ user }) => {
  const [requests, setRequests] = useState<ReservationRequest[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [acceptForm, setAcceptForm] = useState<AcceptForm | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [reqs, profs, pats, appts] = await Promise.all([
        dbService.getReservationRequests(),
        dbService.getProfessionals(),
        dbService.getPatients(user.id, UserRole.ADMIN),
        dbService.getAppointments(),
      ]);
      setRequests(reqs);
      setProfessionals(profs);
      setPatients(pats);
      setAppointments(appts);
    } catch (e: any) {
      setLoadError(e?.message || 'No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => requests.reduce((acc, request) => {
    acc[request.status] = (acc[request.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [requests]);

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter(request => {
      if (filterStatus !== 'all' && request.status !== filterStatus) return false;
      if (!needle) return true;
      return [request.nombre, request.telefono, request.email, request.area, request.notas || '']
        .join(' ').toLowerCase().includes(needle);
    });
  }, [requests, filterStatus, search]);

  const filteredPatients = useMemo(() => {
    if (!acceptForm) return [];
    const needle = acceptForm.patientSearch.trim().toLowerCase();
    if (!needle) return patients;
    return patients.filter(p =>
      [patientFullName(p), p.dni, p.phone, p.email].join(' ').toLowerCase().includes(needle),
    );
  }, [acceptForm, patients]);

  const conflicts = useMemo(() => {
    const list: string[] = [];
    if (!acceptForm) return list;
    const when = new Date(acceptForm.date);
    if (Number.isNaN(when.getTime())) return list;

    if (acceptForm.professionalId) {
      const clash = appointments.find(a =>
        a.professionalId === acceptForm.professionalId
        && Math.abs(new Date(a.date).getTime() - when.getTime()) < 60000,
      );
      if (clash) list.push(`Ese profesional ya tiene una cita a esa hora (${clash.patientName || 'paciente'}).`);
    }

    if (acceptForm.patientMode === 'existing' && acceptForm.patientId) {
      const clash = appointments.find(a =>
        a.patientId === acceptForm.patientId && dayKey(new Date(a.date)) === dayKey(when),
      );
      if (clash) {
        list.push(`El paciente ya tiene otra cita ese día a las ${new Date(clash.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`);
      }
    }
    return list;
  }, [acceptForm, appointments]);

  const openAcceptModal = (request: ReservationRequest) => {
    const suggested =
      (request.telefono && patients.find(p => p.phone === request.telefono)) ||
      (request.email && patients.find(p => p.email?.toLowerCase() === request.email.toLowerCase())) ||
      null;

    const [first, ...rest] = request.nombre.trim().split(/\s+/);
    // La solicitud web solo aporta la edad, no la fecha exacta: no se inventa.
    const birthDate = '';

    setAcceptForm({
      request,
      professionalId: request.professional_id || '',
      date: `${request.fecha}T${String(request.hora).slice(0, 5)}`,
      reason: request.area ? `Solicitud web · ${request.area}` : 'Solicitud desde la web',
      notes: '',
      patientMode: suggested ? 'existing' : 'new',
      patientId: suggested?.id || '',
      patientSearch: suggested ? patientFullName(suggested) : '',
      newPatient: {
        firstName: first || '',
        lastName: rest.join(' '),
        dni: '',
        birthDate,
        phone: request.telefono,
        email: request.email,
      },
      saving: false,
      error: null,
    });
  };

  const updateForm = (patch: Partial<AcceptForm>) =>
    setAcceptForm(prev => (prev ? { ...prev, ...patch } : prev));

  const updateNewPatient = (patch: Partial<NewPatientForm>) =>
    setAcceptForm(prev => (prev ? { ...prev, newPatient: { ...prev.newPatient, ...patch } } : prev));

  const submitAccept = async () => {
    if (!acceptForm) return;
    const form = acceptForm;
    if (!form.professionalId) return updateForm({ error: 'Selecciona el profesional que atenderá la cita.' });
    if (!form.date || Number.isNaN(Date.parse(form.date))) return updateForm({ error: 'La fecha y hora no son válidas.' });
    if (form.patientMode === 'existing' && !form.patientId) return updateForm({ error: 'Selecciona un paciente existente.' });
    if (form.patientMode === 'new') {
      if (!form.newPatient.firstName.trim() || !form.newPatient.lastName.trim()) {
        return updateForm({ error: 'Nombre y apellidos del paciente son obligatorios.' });
      }
      if (!form.newPatient.dni.trim()) return updateForm({ error: 'El DNI es obligatorio para evitar duplicados.' });
      if (!form.newPatient.birthDate) return updateForm({ error: 'La fecha de nacimiento es obligatoria.' });
    }

    updateForm({ saving: true, error: null });
    try {
      await dbService.acceptReservationRequest({
        id: form.request.id,
        professionalId: form.professionalId,
        date: new Date(form.date).toISOString(),
        reason: form.reason,
        notes: form.notes,
        ...(form.patientMode === 'existing'
          ? { patientId: form.patientId }
          : { newPatient: { ...form.newPatient } }),
      });
      setAcceptForm(null);
      setToast({ type: 'success', message: `Solicitud de ${form.request.nombre} confirmada. La cita se ha creado en la agenda.` });
      await load();
    } catch (e: any) {
      updateForm({ saving: false, error: e?.message || 'No se pudo aceptar la solicitud.' });
    }
  };

  const reject = async (request: ReservationRequest) => {
    if (!window.confirm(`¿Rechazar la solicitud de ${request.nombre}? Se conservará como rechazada y no se creará ninguna cita.`)) return;
    setBusyId(request.id);
    try {
      await dbService.rejectReservationRequest(request.id);
      setToast({ type: 'success', message: 'Solicitud rechazada.' });
      await load();
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'No se pudo rechazar la solicitud.' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (request: ReservationRequest) => {
    const extra = request.status === 'confirmada' ? '\n\nLa cita ya creada NO se eliminará.' : '';
    if (!window.confirm(`¿Eliminar definitivamente la solicitud de ${request.nombre}?${extra}\n\nEsta acción no se puede deshacer.`)) return;
    setBusyId(request.id);
    try {
      await dbService.deleteReservationRequest(request.id);
      setToast({ type: 'success', message: 'Solicitud eliminada.' });
      await load();
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'No se pudo eliminar la solicitud.' });
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all', label: 'Todas', count: requests.length },
    { id: 'pendiente', label: 'Pendientes', count: stats.pendiente || 0 },
    { id: 'confirmada', label: 'Confirmadas', count: stats.confirmada || 0 },
    { id: 'cancelada', label: 'Rechazadas', count: stats.cancelada || 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Captación"
        title="Solicitudes web"
        description="Peticiones de cita recibidas desde la web. Revisa los datos, confirma la cita y evita duplicar fichas."
        icon={Inbox}
        actions={
          <button onClick={load} className={btnSecondary} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        }
      />

      {loadError && (
        <InlineAlert level="danger" title="No se pudieron cargar las solicitudes" action={<button onClick={load} className={btnSecondary}>Reintentar</button>}>
          {loadError}
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Pendientes" value={stats.pendiente || 0} icon={Clock} tone="yellow" hint="Requieren revisión" />
        <StatCard title="Confirmadas" value={stats.confirmada || 0} icon={CheckCircle2} tone="green" hint="Ya tienen cita" />
        <StatCard title="Rechazadas" value={stats.cancelada || 0} icon={X} tone="red" hint="Sin cita creada" />
        <StatCard title="Total recibidas" value={requests.length} icon={Inbox} hint="Histórico cargado" />
      </div>

      <SectionCard
        title="Bandeja de solicitudes"
        description="Las nuevas peticiones aparecen aquí con estado pendiente."
        padded={false}
        actions={
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, teléfono, email…"
              className={`${inputClass} pl-9`}
            />
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-stone-100 px-4 pt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                filterStatus === tab.id
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">{tab.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-stone-500">
            <Loader2 size={18} className="animate-spin" /> Cargando solicitudes…
          </div>
        ) : !visibleRequests.length ? (
          <EmptyState
            icon={Inbox}
            title={requests.length ? 'Sin coincidencias' : 'No hay solicitudes'}
            description={requests.length
              ? 'Prueba con otro término o cambia el filtro de estado.'
              : 'Las peticiones enviadas desde la web aparecerán aquí automáticamente.'}
            action={requests.length ? <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className={btnSecondary}>Quitar filtros</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-semibold">Fecha solicitada</th>
                  <th className="px-3 py-3 font-semibold">Paciente</th>
                  <th className="px-3 py-3 font-semibold">Solicitud</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map(request => {
                  const meta = STATUS_META[request.status] || STATUS_META.pendiente;
                  const busy = busyId === request.id;
                  return (
                    <tr key={request.id} className="border-b border-stone-50 align-top last:border-0 hover:bg-stone-50/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold capitalize text-stone-800">{formatRequestedDate(request)}</p>
                        <p className="mt-1 text-[11px] text-stone-400">
                          Recibida {new Date(request.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">
                            {initials(request.nombre)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-800">{request.nombre}</p>
                            <div className="mt-0.5 space-y-0.5 text-[11px] text-stone-500">
                              <p className="flex items-center gap-1"><Phone size={11} /> {request.telefono || '—'}</p>
                              <p className="flex items-center gap-1"><Mail size={11} /> {request.email || '—'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge className="border-stone-200 bg-stone-50 capitalize text-stone-700">{request.area}</Badge>
                        <p className="mt-1.5 text-[11px] capitalize text-stone-500">
                          {request.paciente === 'nino'
                            ? `Menor${request.edad !== null ? ` · ${request.edad} años` : ''}`
                            : 'Adulto'}
                        </p>
                        {request.notas && (
                          <p className="mt-1 max-w-[220px] line-clamp-2 text-[11px] text-stone-400" title={request.notas}>
                            {request.notas}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <Badge className={meta.badge} dot>{meta.label}</Badge>
                        {request.status === 'confirmada' && request.appointment_id && (
                          <Link to="/appointments" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-logo-700 hover:underline">
                            <ExternalLink size={11} /> Ver cita
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {request.status === 'pendiente' && (
                            <>
                              <button onClick={() => openAcceptModal(request)} disabled={busy} className={`${btnPrimary} px-3 py-1.5 text-xs`}>
                                <Check size={14} /> Aceptar
                              </button>
                              <button onClick={() => reject(request)} disabled={busy} className={`${btnSecondary} px-3 py-1.5 text-xs text-red-700`}>
                                <X size={14} /> Rechazar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => remove(request)}
                            disabled={busy}
                            className={`${btnGhost} px-2 py-1.5 text-stone-400 hover:text-red-600`}
                            title="Eliminar solicitud"
                            aria-label="Eliminar solicitud"
                          >
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="flex items-start gap-2 text-xs text-stone-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        La solicitud web no crea una ficha hasta que administración la acepta. Revisa teléfono, email y DNI antes de
        confirmar para evitar duplicados y citas erróneas.
      </p>

      <Modal
        open={!!acceptForm}
        onClose={() => { if (!acceptForm?.saving) setAcceptForm(null); }}
        title="Aceptar solicitud de cita"
        subtitle={acceptForm ? `${acceptForm.request.nombre} · ${formatRequestedDate(acceptForm.request)}` : undefined}
        size="lg"
        accent="bg-fisio-500"
        footer={
          <>
            <button onClick={() => setAcceptForm(null)} disabled={acceptForm?.saving} className={btnSecondary}>Cancelar</button>
            <button onClick={submitAccept} disabled={acceptForm?.saving} className={btnPrimary}>
              {acceptForm?.saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
              {acceptForm?.saving ? 'Confirmando…' : 'Confirmar y crear cita'}
            </button>
          </>
        }
      >
        {acceptForm && (
          <div className="space-y-5">
            <div className={`${cardClass} bg-stone-50/70 p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-800">{acceptForm.request.nombre}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{acceptForm.request.telefono} · {acceptForm.request.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold capitalize text-stone-700">{formatRequestedDate(acceptForm.request)}</p>
                  <p className="text-xs capitalize text-stone-500">{acceptForm.request.area}</p>
                </div>
              </div>
              {acceptForm.request.notas && (
                <p className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-500">
                  <span className="font-semibold">Nota del paciente:</span> {acceptForm.request.notas}
                </p>
              )}
            </div>

            {acceptForm.error && (
              <InlineAlert level="danger" title="Revisa los datos">{acceptForm.error}</InlineAlert>
            )}

            {conflicts.length > 0 && (
              <InlineAlert level="warning" title="Posible conflicto de horario">
                <ul className="list-inside list-disc space-y-0.5">
                  {conflicts.map(conflict => <li key={conflict}>{conflict}</li>)}
                </ul>
              </InlineAlert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Profesional" required>
                <select className={inputClass} value={acceptForm.professionalId} onChange={e => updateForm({ professionalId: e.target.value })}>
                  <option value="">Seleccionar profesional</option>
                  {professionals.map(professional => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name} · {getProfessionalLabel(professional)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha y hora" required>
                <input type="datetime-local" className={inputClass} value={acceptForm.date} onChange={e => updateForm({ date: e.target.value })} />
              </Field>
              <Field label="Motivo">
                <input className={inputClass} value={acceptForm.reason} onChange={e => updateForm({ reason: e.target.value })} placeholder="Motivo de consulta" />
              </Field>
              <Field label="Notas internas">
                <input className={inputClass} value={acceptForm.notes} onChange={e => updateForm({ notes: e.target.value })} placeholder="Observaciones para el equipo" />
              </Field>
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <p className={labelClass}>Paciente</p>
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => updateForm({ patientMode: 'existing' })}
                  className={`rounded-md py-1.5 text-sm font-semibold transition-colors ${acceptForm.patientMode === 'existing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
                >
                  Ficha existente
                </button>
                <button
                  type="button"
                  onClick={() => updateForm({ patientMode: 'new' })}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-semibold transition-colors ${acceptForm.patientMode === 'new' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
                >
                  <UserPlus size={14} /> Crear ficha
                </button>
              </div>

              {acceptForm.patientMode === 'existing' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      className={`${inputClass} pl-9`}
                      value={acceptForm.patientSearch}
                      onChange={e => updateForm({ patientSearch: e.target.value, patientId: '' })}
                      placeholder="Buscar por nombre, DNI, teléfono o email"
                    />
                  </div>
                  <select className={inputClass} value={acceptForm.patientId} onChange={e => updateForm({ patientId: e.target.value })}>
                    <option value="">Seleccionar paciente ({filteredPatients.length})</option>
                    {filteredPatients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patientFullName(patient)} — {patient.dni}{patient.phone ? ` · ${patient.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  {!filteredPatients.length && (
                    <p className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-700">
                      Ningún paciente coincide. Crea una ficha nueva o revisa la búsqueda.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre" required>
                    <input className={inputClass} value={acceptForm.newPatient.firstName} onChange={e => updateNewPatient({ firstName: e.target.value })} />
                  </Field>
                  <Field label="Apellidos" required>
                    <input className={inputClass} value={acceptForm.newPatient.lastName} onChange={e => updateNewPatient({ lastName: e.target.value })} />
                  </Field>
                  <Field label="DNI / Pasaporte" required hint="Se comprueba contra las fichas existentes.">
                    <input className={inputClass} value={acceptForm.newPatient.dni} onChange={e => updateNewPatient({ dni: e.target.value })} />
                  </Field>
                  <Field label="Fecha de nacimiento" required hint={acceptForm.request.edad !== null && acceptForm.request.edad !== undefined ? `La solicitud indica ${acceptForm.request.edad} años; confirma la fecha exacta.` : undefined}>
                    <input type="date" className={inputClass} value={acceptForm.newPatient.birthDate} onChange={e => updateNewPatient({ birthDate: e.target.value })} />
                  </Field>
                  <Field label="Teléfono">
                    <input type="tel" className={inputClass} value={acceptForm.newPatient.phone} onChange={e => updateNewPatient({ phone: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inputClass} value={acceptForm.newPatient.email} onChange={e => updateNewPatient({ email: e.target.value })} />
                  </Field>
                </div>
              )}
            </div>

            <InlineAlert level="info">
              Al confirmar se crea la cita con estado <strong>confirmada</strong> y la solicitud queda vinculada.
              Si el paciente es menor, completa después la representación legal y los consentimientos en su ficha.
            </InlineAlert>
          </div>
        )}
      </Modal>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success'
            ? 'border-fisio-200 bg-fisio-50 text-fisio-900'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-start gap-2">
            {toast.type === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationRequests;
