import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity, Apple, ArrowRight, Brain, CalendarDays, CheckCircle2, ClipboardCheck,
  ClipboardList, Clock, FileText, HeartPulse, MapPin, MessageCircle, Plus,
  Search, TrendingUp, Users,
} from 'lucide-react';
import {
  Appointment, AppointmentStatus, ClinicalObjective, ClinicalRecord, ClinicalSpecialty,
  Patient, User, UserRole,
} from '../types';
import { dbService } from '../services/dbService';
import { isAdmin } from '../services/permissions';
import {
  APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS, formatDate, formatTime,
  getRoleProfile, localTodayISO, patientFullName,
} from '../constants';
import {
  Badge, EmptyState, InlineAlert, Modal, PageHeader, SectionCard, SpecialtyBadge,
  StatCard, btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';
import { ObjectiveProgress } from '../components/clinical/shared';
import ClinicalRecordModal from '../components/clinical/ClinicalRecordModal';
import ClinicalEvolution from '../components/clinical/ClinicalEvolution';
import ClinicalReportModal from '../components/clinical/ClinicalReportModal';

interface Props {
  user: User;
  specialty: ClinicalSpecialty;
}

interface Tool { label: string; desc: string; icon: any; tone: string; action: 'valoracion' | 'sesion' | 'evolution' | 'report' }

const toolsBySpecialty: Record<ClinicalSpecialty, Tool[]> = {
  [UserRole.FISIOTERAPIA]: [
    { label: 'Valoración inicial', desc: 'Motivo, EVA, exploración y diagnóstico', icon: ClipboardCheck, tone: 'bg-fisio-50 text-fisio-700', action: 'valoracion' },
    { label: 'Sesión y evolución', desc: 'Técnicas, ejercicios y respuesta', icon: Activity, tone: 'bg-logo-50 text-logo-700', action: 'sesion' },
    { label: 'Mapa del dolor', desc: 'Zonas anteriores y posteriores', icon: MapPin, tone: 'bg-red-50 text-red-600', action: 'sesion' },
    { label: 'Evolución EVA', desc: 'Comparativa de intensidad del dolor', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', action: 'evolution' },
  ],
  [UserRole.NUTRICION]: [
    { label: 'Valoración nutricional', desc: 'Historia dietética y antropometría', icon: ClipboardCheck, tone: 'bg-nutri-50 text-nutri-700', action: 'valoracion' },
    { label: 'Plan alimentario', desc: 'Tomas, cantidades y alternativas', icon: Apple, tone: 'bg-fisio-50 text-fisio-700', action: 'sesion' },
    { label: 'Revisión y adherencia', desc: 'Dificultades, síntomas y ajustes', icon: ClipboardList, tone: 'bg-logo-50 text-logo-700', action: 'sesion' },
    { label: 'Evolución de medidas', desc: 'Peso, IMC y perímetros', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', action: 'evolution' },
  ],
  [UserRole.LOGOPEDIA]: [
    { label: 'Valoración del lenguaje', desc: 'Comprensión, expresión y habla', icon: MessageCircle, tone: 'bg-logo-50 text-logo-700', action: 'valoracion' },
    { label: 'Sesión por objetivos', desc: 'Aciertos, ayuda y tareas', icon: ClipboardCheck, tone: 'bg-fisio-50 text-fisio-700', action: 'sesion' },
    { label: 'Evolución por objetivo', desc: 'Resultados comparables', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', action: 'evolution' },
    { label: 'Generar informe', desc: 'Informe de seguimiento en PDF', icon: FileText, tone: 'bg-violet-50 text-violet-700', action: 'report' },
  ],
  [UserRole.PSICOLOGIA]: [
    { label: 'Entrevista inicial', desc: 'Historia y formulación clínica', icon: Brain, tone: 'bg-psy-50 text-psy-800', action: 'valoracion' },
    { label: 'Sesión de intervención', desc: 'Plan, técnicas y tareas', icon: ClipboardCheck, tone: 'bg-fisio-50 text-fisio-700', action: 'sesion' },
    { label: 'Pruebas psicométricas', desc: 'Registro de resultados sin ítems', icon: ClipboardList, tone: 'bg-violet-50 text-violet-700', action: 'sesion' },
    { label: 'Evolución y riesgo', desc: 'Progreso y prevención', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', action: 'evolution' },
  ],
};

const SpecialtyWorkspace: React.FC<Props> = ({ user, specialty }) => {
  const profile = getRoleProfile(specialty);
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'record' | 'report'>('record');
  const [pickerSearch, setPickerSearch] = useState('');
  const [recordPatient, setRecordPatient] = useState<Patient | null>(null);
  const [recordAppointment, setRecordAppointment] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
  const [reportPatient, setReportPatient] = useState<Patient | null>(null);
  const [reportRecord, setReportRecord] = useState<ClinicalRecord | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pats, appts] = await Promise.all([
        dbService.getPatients(user.id, user.role),
        dbService.getAppointments(user),
      ]);
      setPatients(pats.filter(p => (p.assignedSpecialties || []).includes(specialty) || appts.some(a => a.patientId === p.id)));
      setAppointments(appts);

      if (isAdmin(user)) {
        const lists = await Promise.all(pats.map(p => dbService.getClinicalRecords(p.id, specialty, user)));
        setRecords(lists.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setRecords(await dbService.getClinicalRecordsByProfessional(user.id, specialty));
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos de la especialidad.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id, specialty]);

  const openNewRecord = (patient: Patient, appointmentId?: string | null, existing?: ClinicalRecord | null, recordType?: 'valoracion' | 'sesion') => {
    setRecordPatient(patient);
    setRecordAppointment(appointmentId || null);
    setEditingRecord(existing || null);
    if (recordType) setPendingType(recordType);
    else setPendingType(existing ? existing.recordType as any : undefined);
  };

  const [pendingType, setPendingType] = useState<'valoracion' | 'sesion' | undefined>(undefined);

  useEffect(() => {
    if (handled.current || loading) return;
    const patientId = searchParams.get('patient');
    const appointmentId = searchParams.get('appointment');
    const tool = searchParams.get('tool');
    if (!patientId && !appointmentId && !tool) return;
    handled.current = true;

    const appt = appointmentId ? appointments.find(a => a.id === appointmentId) : undefined;
    const patient = patients.find(p => p.id === (patientId || appt?.patientId));
    if (patient) {
      openNewRecord(patient, appt?.id || null, null, tool === 'valoracion' ? 'valoracion' : 'sesion');
    } else if (tool === 'evolution') {
      document.getElementById('evolucion')?.scrollIntoView({ behavior: 'smooth' });
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, patients, appointments, searchParams]);

  const today = localTodayISO();
  const todayAppointments = useMemo(
    () => appointments
      .filter(a => new Date(a.date).toDateString() === new Date().toDateString())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [appointments]
  );
  const pendingRecords = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded);
  const activeObjectives = useMemo(() => {
    const byPatient = new Map<string, ClinicalObjective[]>();
    records.forEach(r => {
      if (r.objectives?.length) byPatient.set(r.patientId, r.objectives);
    });
    return Array.from(byPatient.entries()).flatMap(([, objs]) => objs).filter(o => o.status === 'activo');
  }, [records]);

  const previousObjectivesFor = (patientId: string) => {
    const record = records.find(r => r.patientId === patientId && r.objectives?.length);
    return record?.objectives || [];
  };

  const filteredPatients = patients.filter(p => {
    const needle = pickerSearch.toLowerCase();
    if (!needle) return true;
    return patientFullName(p).toLowerCase().includes(needle) || p.dni.toLowerCase().includes(needle);
  });

  const tools = toolsBySpecialty[specialty] || [];
  const recentRecords = records.slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Herramientas clínicas · ${profile.label}`}
        title={`Espacio de ${profile.label}`}
        description="Registra sesiones, revisa la evolución y genera informes. Solo ves la historia de tu especialidad."
        icon={specialty === UserRole.PSICOLOGIA ? Brain : specialty === UserRole.FISIOTERAPIA ? HeartPulse : specialty === UserRole.LOGOPEDIA ? MessageCircle : Apple}
        accent={profile.solid}
        actions={
          <>
            <button onClick={() => setPickerOpen(true)} className={btnSecondary}><Search size={16} /> Buscar paciente</button>
            <button onClick={() => setPickerOpen(true)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${profile.solid} ${profile.solidHover}`}>
              <Plus size={16} /> Nueva sesión
            </button>
          </>
        }
      />

      {error && <InlineAlert level="danger" title="Error de carga">{error}</InlineAlert>}
      {isAdmin(user) && (
        <InlineAlert level="warning" title="Acceso clínico de administración">
          Estás viendo contenido clínico por una autorización expresa. El acceso queda registrado en la auditoría y debe estar justificado en Configuración.
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Citas hoy" value={todayAppointments.length} icon={CalendarDays} hint={`${todayAppointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length} confirmadas`} tone="blue" />
        <StatCard title="Pacientes" value={patients.length} icon={Users} hint="En tu especialidad" tone="green" />
        <StatCard title="Sesiones registradas" value={records.length} icon={ClipboardCheck} hint="Historia segmentada" tone="violet" />
        <StatCard title="Pendientes de registrar" value={pendingRecords.length} icon={Clock} hint={pendingRecords.length ? 'Requieren evolución' : 'Todo al día'} tone={pendingRecords.length ? 'red' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SectionCard title="Agenda de hoy" description="Abre la ficha para registrar la sesión" padded={false}>
            {loading ? (
              <p className="p-8 text-center text-sm text-stone-400">Cargando agenda…</p>
            ) : todayAppointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin citas hoy" description="Puedes registrar una sesión no programada desde el botón Nueva sesión." />
            ) : (
              <div className="divide-y divide-stone-100">
                {todayAppointments.map(appt => {
                  const patient = patients.find(p => p.id === appt.patientId);
                  return (
                    <div key={appt.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm font-bold text-stone-900">{formatTime(appt.date)}</p>
                        <p className="text-[10px] text-stone-400">{appt.durationMinutes || 45} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{appt.patientName || (patient ? patientFullName(patient) : 'Paciente')}</p>
                        <p className="truncate text-xs text-stone-500">{appt.reason}{appt.room ? ` · ${appt.room}` : ''}</p>
                      </div>
                      {appt.clinicalRecorded ? (
                        <Badge className="border-fisio-200 bg-fisio-50 text-fisio-800"><CheckCircle2 size={11} /> Registrado</Badge>
                      ) : (
                        <Badge className={APPOINTMENT_STATUS_COLORS[appt.status]}>{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
                      )}
                      {patient && (
                        <button
                          onClick={() => openNewRecord(patient, appt.id, null, appt.clinicalRecorded ? 'sesion' : (records.some(r => r.patientId === patient.id) ? 'sesion' : 'valoracion'))}
                          className={`${btnGhost} border border-stone-200 text-xs`}
                        >
                          {appt.clinicalRecorded ? 'Nueva evolución' : 'Registrar'} <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Accesos de la especialidad" description={`Flujos de ${profile.label}`} padded={false}>
            <div className="grid grid-cols-1 gap-px bg-stone-100 sm:grid-cols-2">
              {tools.map(tool => (
                <button
                  key={tool.label}
                  onClick={() => {
                    if (tool.action === 'evolution') {
                      document.getElementById('evolucion')?.scrollIntoView({ behavior: 'smooth' });
                      return;
                    }
                    if (tool.action === 'report') {
                      setPickerMode('report');
                      setPickerOpen(true);
                      return;
                    }
                    setPickerMode('record');
                    setPendingType(tool.action);
                    setPickerOpen(true);
                  }}
                  className="flex items-start gap-3 bg-white p-4 text-left transition-colors hover:bg-stone-50"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tool.tone}`}><tool.icon size={17} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{tool.label}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{tool.desc}</p>
                  </div>
                  <ArrowRight size={14} className="ml-auto mt-1 shrink-0 text-stone-300" />
                </button>
              ))}
            </div>
          </SectionCard>

          <div id="evolucion">
            <ClinicalEvolution
              records={records}
              specialty={specialty}
              onOpen={record => {
                const patient = patients.find(p => p.id === record.patientId);
                if (patient) openNewRecord(patient, record.appointmentId || null, record);
              }}
              onReport={record => {
                const patient = patients.find(p => p.id === record.patientId);
                if (patient) { setReportPatient(patient); setReportRecord(record); }
              }}
            />
          </div>
        </div>

        <div className="space-y-5">
          <SectionCard title="Registros recientes" description="Últimas sesiones de tu especialidad" padded={false}>
            {loading ? (
              <p className="p-6 text-center text-xs text-stone-400">Cargando…</p>
            ) : recentRecords.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin registros" description="Registra la primera valoración de un paciente." />
            ) : (
              <div className="divide-y divide-stone-100">
                {recentRecords.map(record => {
                  const patient = patients.find(p => p.id === record.patientId);
                  return (
                    <button
                      key={record.id}
                      onClick={() => {
                        if (patient) openNewRecord(patient, record.appointmentId || null, record);
                      }}
                      className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-stone-50"
                    >
                      <div className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${profile.solid}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-stone-800">{patient ? patientFullName(patient) : 'Paciente'}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">{record.summary}</p>
                        <p className="mt-0.5 text-[10px] text-stone-400">{formatDate(record.date)} · {record.recordType}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Objetivos activos" description={`${activeObjectives.length} en seguimiento`}>
            <ObjectiveProgress objectives={activeObjectives.slice(0, 6)} />
          </SectionCard>

          <div className={`rounded-2xl border ${profile.border} bg-white p-5`}>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={15} className={profile.text} />
              <p className="text-sm font-bold text-stone-800">Buenas prácticas</p>
            </div>
            <p className="text-xs leading-relaxed text-stone-500">
              {specialty === UserRole.PSICOLOGIA
                ? 'No incorpores ítems de pruebas licenciadas. Registra resultados y revisa siempre la corrección manual. Los protocolos de riesgo no se automatizan.'
                : specialty === UserRole.FISIOTERAPIA
                  ? 'Registra EVA y zonas corporales en cada sesión. Así podrás comparar la evolución y justificar la continuidad del tratamiento.'
                  : specialty === UserRole.LOGOPEDIA
                    ? 'Mide cada objetivo con aciertos, ensayos y nivel de ayuda. La coordinación con el entorno requiere autorización previa.'
                    : 'Conserva las versiones del plan alimentario y documenta la adherencia. En menores, usa referencias de crecimiento validadas.'}
            </p>
          </div>

          <SectionCard title="Pacientes de la especialidad" padded={false}>
            {patients.length === 0 ? (
              <EmptyState icon={Users} title="Sin pacientes" description="Administración o una cita los vincularán a tu especialidad." />
            ) : (
              <div className="divide-y divide-stone-100">
                {patients.slice(0, 6).map(p => (
                  <Link key={p.id} to={`/patient/${p.id}`} className="flex items-center gap-2.5 px-4 py-3 hover:bg-stone-50">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${profile.soft} ${profile.text}`}>
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-stone-800">{patientFullName(p)}</p>
                      <p className="truncate text-[10px] text-stone-400">{p.dni} · {formatDate(p.birthDate)}</p>
                    </div>
                    <ArrowRight size={13} className="text-stone-300" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Selector de paciente */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={pickerMode === 'report' ? `Informe de ${profile.label}` : `Nueva sesión de ${profile.label}`}
        subtitle={pickerMode === 'report' ? 'Selecciona el paciente para generar el informe' : 'Selecciona el paciente para abrir el registro clínico'}
        accent={profile.solid}
        size="md"
      >
        <div className="space-y-3">
          <input className={inputClass} placeholder="Buscar por nombre o DNI…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
          {filteredPatients.length === 0 ? (
            <EmptyState icon={Users} title="No hay pacientes disponibles" description="Solo aparecen pacientes vinculados a tu especialidad." />
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerSearch('');
                    if (pickerMode === 'report') {
                      setReportPatient(p);
                      setReportRecord(null);
                    } else {
                      openNewRecord(p, null, null, pendingType);
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left hover:border-stone-200 hover:bg-stone-50"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${profile.soft} ${profile.text}`}>
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-800">{patientFullName(p)}</p>
                    <p className="truncate text-[11px] text-stone-400">{p.dni} · {formatDate(p.birthDate)}</p>
                  </div>
                  <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
                    {(p.assignedSpecialties || []).slice(0, 2).map(s => (
                      <SpecialtyBadge key={s} specialty={s} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {recordPatient && (
        <ClinicalRecordModal
          open={!!recordPatient}
          onClose={() => { setRecordPatient(null); setEditingRecord(null); setRecordAppointment(null); }}
          patient={recordPatient}
          specialty={specialty}
          professional={user}
          appointmentId={recordAppointment}
          existing={editingRecord}
          previousObjectives={editingRecord ? [] : previousObjectivesFor(recordPatient.id)}
          onSaved={load}
        />
      )}

      {reportPatient && (
        <ClinicalReportModal
          open={!!reportPatient}
          onClose={() => { setReportPatient(null); setReportRecord(null); }}
          patient={reportPatient}
          specialty={specialty}
          professional={user}
          records={records.filter(r => r.patientId === reportPatient.id)}
          baseRecord={reportRecord}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default SpecialtyWorkspace;
