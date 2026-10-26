import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Baby, CalendarPlus, CheckCircle2, ChevronRight, FileWarning,
  Plus, Search, ShieldCheck, UserPlus, Users, X,
} from 'lucide-react';
import { Patient, PatientStatus, User, UserRole, ClinicalSpecialty, RepresentationType } from '../types';
import { dbService } from '../services/dbService';
import { hasPermission, isAdmin } from '../services/permissions';
import {
  CLINICAL_SPECIALTIES, calcAge, formatDate, getRoleProfile, isMinor,
  patientFullName, SPECIALTY_LABELS,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, SpecialtyBadge,
  btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';

interface Props { user: User; }

const emptyForm = {
  firstName: '', secondName: '', lastName: '', secondLastName: '',
  dni: '', birthDate: '', sex: '' as Patient['sex'], phone: '', email: '', address: '',
  privacyPolicySigned: false,
  alerts: '', allergies: '', administrativeNotes: '',
  guardianName: '', guardianDni: '', guardianPhone: '', guardianEmail: '', guardianRelationship: '',
  secondaryGuardianName: '', secondaryGuardianDni: '', secondaryGuardianPhone: '', secondaryGuardianEmail: '', secondaryGuardianRelationship: '',
  representationType: 'no_consta' as RepresentationType, guardianshipNotes: '',
};

type FormState = typeof emptyForm;

const Patients: React.FC<Props> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterStatus, setFilterStatus] = useState<PatientStatus | 'all'>('all');
  const [filterConsent, setFilterConsent] = useState(false);
  const [filterMinor, setFilterMinor] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const admin = isAdmin(user);
  const canCreate = hasPermission(user, 'patients.create');
  const clinical = CLINICAL_SPECIALTIES.includes(user.role as ClinicalSpecialty);
  const specialty = clinical ? user.role as ClinicalSpecialty : null;

  const load = async () => {
    setLoading(true);
    try {
      setPatients(await dbService.getPatients(user.id, user.role));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id, user.role]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && canCreate) {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canCreate]);

  const openCreate = () => {
    setEditPatient(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setModalOpen(true);
  };

  const openEdit = (patient: Patient) => {
    setEditPatient(patient);
    setForm({
      firstName: patient.firstName,
      secondName: patient.secondName || '',
      lastName: patient.lastName,
      secondLastName: patient.secondLastName || '',
      dni: patient.dni,
      birthDate: patient.birthDate,
      sex: patient.sex || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      privacyPolicySigned: patient.privacyPolicySigned,
      alerts: (patient.alerts || []).join(', '),
      allergies: (patient.allergies || []).join(', '),
      administrativeNotes: patient.administrativeNotes || '',
      guardianName: patient.legalGuardian?.name || '',
      guardianDni: patient.legalGuardian?.dni || '',
      guardianPhone: patient.legalGuardian?.phone || '',
      guardianEmail: patient.legalGuardian?.email || '',
      guardianRelationship: patient.legalGuardian?.relationship || '',
      secondaryGuardianName: patient.secondaryLegalGuardian?.name || '',
      secondaryGuardianDni: patient.secondaryLegalGuardian?.dni || '',
      secondaryGuardianPhone: patient.secondaryLegalGuardian?.phone || '',
      secondaryGuardianEmail: patient.secondaryLegalGuardian?.email || '',
      secondaryGuardianRelationship: patient.secondaryLegalGuardian?.relationship || '',
      representationType: patient.representationType || 'no_consta',
      guardianshipNotes: patient.guardianshipNotes || '',
    });
    setError('');
    setNotice('');
    setModalOpen(true);
  };

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const duplicate = useMemo(() => {
    const dni = form.dni.trim().toUpperCase();
    if (!dni) return null;
    return patients.find(p => p.dni.toUpperCase() === dni && p.id !== editPatient?.id) || null;
  }, [form.dni, patients, editPatient?.id]);

  const formMinor = isMinor(form.birthDate);
  const visible = patients.filter(p => {
    const needle = search.trim().toLowerCase();
    if (needle) {
      const haystack = `${patientFullName(p)} ${p.dni} ${p.phone} ${p.email}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filterSpecialty && !(p.assignedSpecialties || []).includes(filterSpecialty as ClinicalSpecialty)) return false;
    if (filterStatus !== 'all' && (p.status || 'activo') !== filterStatus) return false;
    if (filterConsent && !p.privacyPolicySigned) return false;
    if (filterMinor && !isMinor(p.birthDate)) return false;
    return true;
  });

  const save = async () => {
    setError('');
    setNotice('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dni.trim() || !form.birthDate) {
      setError('Nombre, apellidos, DNI y fecha de nacimiento son obligatorios.');
      return;
    }
    if (duplicate) {
      setError(`Ya existe una ficha con el DNI ${duplicate.dni}. Abre la ficha existente para evitar duplicados.`);
      return;
    }
    if (formMinor && (!form.guardianName.trim() || !form.guardianDni.trim())) {
      setError('Para un menor de edad, el nombre y DNI del representante legal son obligatorios.');
      return;
    }
    if (formMinor && form.representationType === 'no_consta') {
      setError('Indica el tipo de representación legal del menor (patria potestad, tutela, acogimiento u otro).');
      return;
    }
    if (form.secondaryGuardianName.trim() && !form.secondaryGuardianDni.trim()) {
      setError('Si registras un segundo representante, indica también su DNI.');
      return;
    }
    if (form.secondaryGuardianName.trim() && !form.representationType) {
      setError('Indica el tipo de representación antes de añadir un segundo representante.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Patient> = {
        firstName: form.firstName.trim(),
        secondName: form.secondName.trim(),
        lastName: form.lastName.trim(),
        secondLastName: form.secondLastName.trim(),
        dni: form.dni.trim().toUpperCase(),
        birthDate: form.birthDate,
        sex: form.sex,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        privacyPolicySigned: form.privacyPolicySigned,
        alerts: form.alerts.split(',').map(s => s.trim()).filter(Boolean),
        allergies: form.allergies.split(',').map(s => s.trim()).filter(Boolean),
        administrativeNotes: form.administrativeNotes.trim(),
        legalGuardian: formMinor || form.guardianName
          ? {
              name: form.guardianName.trim(),
              dni: form.guardianDni.trim().toUpperCase(),
              phone: form.guardianPhone.trim(),
              email: form.guardianEmail.trim(),
              relationship: form.guardianRelationship.trim(),
            }
          : null,
        secondaryLegalGuardian: form.secondaryGuardianName.trim()
          ? {
              name: form.secondaryGuardianName.trim(),
              dni: form.secondaryGuardianDni.trim().toUpperCase(),
              phone: form.secondaryGuardianPhone.trim(),
              email: form.secondaryGuardianEmail.trim(),
              relationship: form.secondaryGuardianRelationship.trim(),
            }
          : null,
        representationType: (formMinor || form.guardianName.trim()) ? form.representationType : null,
        guardianshipNotes: form.guardianshipNotes.trim() || undefined,
      };

      if (editPatient) {
        const ok = await dbService.updatePatient(editPatient.id, payload, user);
        if (!ok) throw new Error('No se pudieron guardar los cambios.');
        setNotice('Ficha actualizada correctamente.');
      } else {
        const result = await dbService.createPatient(payload, user);
        if (!result.success) throw new Error(result.error || 'No se pudo crear la ficha.');
        setNotice('Paciente creado correctamente. La ficha es única para todas las especialidades.');
      }
      await load();
      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la ficha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={admin ? 'Administración · Pacientes' : `Consulta de ${getRoleProfile(user.role).label}`}
        title="Pacientes"
        description={admin
          ? 'Ficha administrativa única. Las historias clínicas están segmentadas por especialidad y no son visibles desde aquí.'
          : 'Solo aparecen los pacientes vinculados a tu especialidad. La ficha administrativa es compartida.'}
        icon={Users}
        actions={canCreate ? <button onClick={openCreate} className={btnPrimary}><UserPlus size={16} /> Nuevo paciente</button> : undefined}
      />

      {notice && <InlineAlert level="success" title="Guardado">{notice}</InlineAlert>}

      <div className={cardClass + ' p-3 md:p-4'}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-stone-400" size={17} />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Buscar por nombre, DNI, teléfono o email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700" value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}>
              <option value="">Todas las especialidades</option>
              {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
            </select>
            <select className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="all">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
              <option value="archivado">Archivados</option>
            </select>
            <button onClick={() => setFilterConsent(v => !v)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${filterConsent ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-stone-200 bg-white text-stone-600'}`}>
              Sin RGPD
            </button>
            <button onClick={() => setFilterMinor(v => !v)} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${filterMinor ? 'border-logo-300 bg-logo-50 text-logo-800' : 'border-stone-200 bg-white text-stone-600'}`}>
              Menores
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">{visible.length} ficha(s) · {patients.filter(p => !p.privacyPolicySigned).length} sin consentimiento RGPD</p>
      </div>

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando pacientes…</div>
      ) : visible.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={Users}
            title={patients.length === 0 ? 'Todavía no hay pacientes' : 'Sin resultados'}
            description={patients.length === 0 ? 'Crea la primera ficha administrativa. Después podrás vincularla a una o varias especialidades.' : 'Prueba a cambiar la búsqueda o los filtros.'}
            action={canCreate && patients.length === 0 ? <button onClick={openCreate} className={btnPrimary}><Plus size={16} /> Nuevo paciente</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visible.map(patient => {
            const minor = isMinor(patient.birthDate);
            const specialties = patient.assignedSpecialties || [];
            return (
              <div key={patient.id} className={`${cardClass} p-4 transition-shadow hover:shadow-md`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                    specialties[0] ? `${getRoleProfile(specialties[0]).soft} ${getRoleProfile(specialties[0]).text}` : 'bg-slate-100 text-slate-600'
                  }`}>
                    {patient.firstName[0]}{patient.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/patient/${patient.id}`} className="truncate text-sm font-bold text-stone-900 hover:underline">{patientFullName(patient)}</Link>
                      {minor && <Badge className="border-logo-200 bg-logo-50 text-logo-800"><Baby size={11} /> Menor</Badge>}
                      {(patient.status || 'activo') !== 'activo' && <Badge className="border-stone-200 bg-stone-100 text-stone-500">{patient.status}</Badge>}
                      {!patient.privacyPolicySigned && <Badge className="border-amber-200 bg-amber-50 text-amber-800"><FileWarning size={11} /> RGPD pendiente</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      {patient.dni} · {calcAge(patient.birthDate) ?? '—'} años · {patient.phone || 'sin teléfono'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {specialties.length === 0 && <span className="text-[11px] text-stone-400">Sin especialidad asignada</span>}
                      {specialties.map(s => <SpecialtyBadge key={s} specialty={s} />)}
                    </div>
                    {(patient.alerts || []).length > 0 && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{(patient.alerts || []).join(' · ')}</span>
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-stone-300" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
                  <Link to={`/patient/${patient.id}`} className={btnSecondary + ' !px-3 !py-1.5 text-xs'}>Abrir ficha</Link>
                  {admin && (
                    <Link to={`/appointments?new=1&patient=${patient.id}`} className={btnGhost + ' border border-stone-200 text-xs'}>
                      <CalendarPlus size={13} /> Cita
                    </Link>
                  )}
                  {specialty && (
                    <Link to={`/clinical/${specialty}?patient=${patient.id}`} className={btnGhost + ' border border-stone-200 text-xs'}>
                      <Plus size={13} /> Sesión
                    </Link>
                  )}
                  {(admin || hasPermission(user, 'patients.edit.admin')) && (
                    <button onClick={() => openEdit(patient)} className={btnGhost + ' text-xs'}>Editar</button>
                  )}
                  <span className="ml-auto text-[10px] text-stone-300">Alta {formatDate(patient.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPatient ? 'Editar ficha administrativa' : 'Nuevo paciente'}
        subtitle={editPatient ? patientFullName(editPatient) : 'Una única ficha para todas las especialidades'}
        size="lg"
        accent="bg-slate-700"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button type="button" onClick={save} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : editPatient ? 'Guardar cambios' : 'Crear ficha'}</button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <InlineAlert level="danger" title="Revisa los datos">{error}</InlineAlert>}
          {duplicate && (
            <InlineAlert level="warning" title="Posible duplicado">
              Ya existe <Link to={`/patient/${duplicate.id}`} className="font-bold underline">{patientFullName(duplicate)}</Link> con el DNI {duplicate.dni}. Abre esa ficha en lugar de crear otra.
            </InlineAlert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Primer nombre" required><input className={inputClass} value={form.firstName} onChange={e => set({ firstName: e.target.value })} /></Field>
            <Field label="Segundo nombre"><input className={inputClass} value={form.secondName} onChange={e => set({ secondName: e.target.value })} /></Field>
            <Field label="Primer apellido" required><input className={inputClass} value={form.lastName} onChange={e => set({ lastName: e.target.value })} /></Field>
            <Field label="Segundo apellido"><input className={inputClass} value={form.secondLastName} onChange={e => set({ secondLastName: e.target.value })} /></Field>
            <Field label="DNI / NIE / pasaporte" required hint="Se usa para detectar duplicados.">
              <input className={inputClass} value={form.dni} onChange={e => set({ dni: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Fecha de nacimiento" required>
              <input type="date" className={inputClass} value={form.birthDate} onChange={e => set({ birthDate: e.target.value })} />
            </Field>
            <Field label="Sexo">
              <select className={inputClass} value={form.sex || ''} onChange={e => set({ sex: e.target.value as Patient['sex'] })}>
                <option value="">Sin especificar</option>
                <option value="mujer">Mujer</option>
                <option value="hombre">Hombre</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Teléfono"><input className={inputClass} value={form.phone} onChange={e => set({ phone: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={e => set({ email: e.target.value })} /></Field>
            <Field label="Dirección"><input className={inputClass} value={form.address} onChange={e => set({ address: e.target.value })} /></Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Alertas administrativas" hint="Separadas por comas. Visibles para el equipo autorizado.">
              <input className={inputClass} value={form.alerts} onChange={e => set({ alerts: e.target.value })} placeholder="Ej. requiere intérprete" />
            </Field>
            <Field label="Alergias" hint="Separadas por comas.">
              <input className={inputClass} value={form.allergies} onChange={e => set({ allergies: e.target.value })} placeholder="Ej. penicilina, frutos secos" />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5 text-xs text-stone-600">
            <input type="checkbox" className="mt-0.5 accent-stone-800" checked={form.privacyPolicySigned} onChange={e => set({ privacyPolicySigned: e.target.checked })} />
            <span>He informado y firmado la política de privacidad y el consentimiento informado correspondiente.</span>
          </label>

          <div className={`rounded-xl border p-3 ${formMinor ? 'border-logo-200 bg-logo-50/60' : 'border-stone-200 bg-stone-50/50'}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className={`flex items-center gap-1.5 text-xs font-bold ${formMinor ? 'text-logo-900' : 'text-stone-700'}`}>
                <Baby size={14} /> Representación legal
                {formMinor && <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-logo-800">Obligatoria en menores</span>}
              </p>
              {formMinor && <span className="text-[10px] text-logo-800">No se presupone que una sola firma parental sea suficiente en todos los casos.</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipo de representación" required={formMinor}>
                <select className={inputClass} value={form.representationType} onChange={e => set({ representationType: e.target.value as RepresentationType })}>
                  <option value="no_consta">No consta / sin representación</option>
                  <option value="patria_potestad_conjunta">Patria potestad conjunta</option>
                  <option value="patria_potestad_exclusiva">Patria potestad exclusiva</option>
                  <option value="tutela">Tutela</option>
                  <option value="acogimiento">Acogimiento</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
              <Field label="Relación del primer representante">
                <input className={inputClass} value={form.guardianRelationship} onChange={e => set({ guardianRelationship: e.target.value })} placeholder="Madre, padre, tutor legal…" />
              </Field>
              <Field label="Nombre y apellidos del representante" required={formMinor}>
                <input className={inputClass} value={form.guardianName} onChange={e => set({ guardianName: e.target.value })} />
              </Field>
              <Field label="DNI / NIE del representante" required={formMinor}>
                <input className={inputClass} value={form.guardianDni} onChange={e => set({ guardianDni: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Teléfono del representante">
                <input className={inputClass} value={form.guardianPhone} onChange={e => set({ guardianPhone: e.target.value })} />
              </Field>
              <Field label="Email del representante">
                <input type="email" className={inputClass} value={form.guardianEmail} onChange={e => set({ guardianEmail: e.target.value })} />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 bg-white/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Segundo representante legal</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">
                Opcional. Regístralo si consta otra persona con representación. La necesidad de su firma depende del documento, la edad, la madurez, la capacidad y la ley aplicable; no se deduce automáticamente.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre y apellidos">
                  <input className={inputClass} value={form.secondaryGuardianName} onChange={e => set({ secondaryGuardianName: e.target.value })} />
                </Field>
                <Field label="DNI / NIE">
                  <input className={inputClass} value={form.secondaryGuardianDni} onChange={e => set({ secondaryGuardianDni: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Relación">
                  <input className={inputClass} value={form.secondaryGuardianRelationship} onChange={e => set({ secondaryGuardianRelationship: e.target.value })} placeholder="Madre, padre, tutor legal…" />
                </Field>
                <Field label="Teléfono">
                  <input className={inputClass} value={form.secondaryGuardianPhone} onChange={e => set({ secondaryGuardianPhone: e.target.value })} />
                </Field>
                <Field label="Email" className="sm:col-span-2">
                  <input type="email" className={inputClass} value={form.secondaryGuardianEmail} onChange={e => set({ secondaryGuardianEmail: e.target.value })} />
                </Field>
              </div>
            </div>

            <Field label="Observaciones sobre representación o tutela" className="mt-3" hint="No incluyas información clínica. Documenta autorizaciones, limitaciones o resoluciones relevantes.">
              <textarea className={inputClass + ' min-h-[64px]'} value={form.guardianshipNotes} onChange={e => set({ guardianshipNotes: e.target.value })} />
            </Field>
            {formMinor && form.representationType === 'patria_potestad_conjunta' && !form.secondaryGuardianName.trim() && (
              <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-800">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Consta patria potestad conjunta sin segundo representante registrado. No se bloqueará por ello, pero revisa cada documento y no asumas que una sola firma basta.
              </p>
            )}
          </div>

          <Field label="Notas administrativas" hint="No incluyas información clínica en este campo.">
            <textarea className={`${inputClass} resize-y`} rows={3} value={form.administrativeNotes} onChange={e => set({ administrativeNotes: e.target.value })} />
          </Field>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            La ficha administrativa es única. Las notas clínicas se guardan separadas por especialidad y no son accesibles desde administración salvo autorización expresa y justificada.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Patients;
