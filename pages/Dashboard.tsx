import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock,
  Euro, FileText, HeartPulse, TrendingUp, Users, Wallet, Plus, Activity,
  ChevronRight, Brain, Apple, MessageCircle, Stethoscope, ClipboardList,
  ShieldAlert, ReceiptText, Sparkles, UserPlus, MapPin, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { User, UserRole, Appointment, AppointmentStatus, ClinicalRecord, ClinicalSpecialty, Invoice, Payment } from '../types';
import { dbService, isDemoMode } from '../services/dbService';
import {
  ROLE_PROFILES, SPECIALTY_LABELS, formatMoney, formatTime, localTodayISO, getRoleProfile,
  isClinicalRole, buildDashboardAlerts, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS,
  ADMIN_STATE_LABELS, ADMIN_STATE_COLORS, getAppointmentAdminState, patientFullName,
} from '../constants';
import { hasPermission, isAdmin } from '../services/permissions';
import { Badge, EmptyState, InlineAlert, PageHeader, SectionCard, StatCard, btnPrimary, btnSecondary, cardClass } from '../components/ui';

interface DashboardProps { user: User; }

const localDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const specialtyIcon = (specialty: string, size = 18) => {
  switch (specialty) {
    case UserRole.PSICOLOGIA: return <Brain size={size} />;
    case UserRole.FISIOTERAPIA: return <HeartPulse size={size} />;
    case UserRole.LOGOPEDIA: return <MessageCircle size={size} />;
    case UserRole.NUTRICION: return <Apple size={size} />;
    default: return <Stethoscope size={size} />;
  }
};

// ============================================================
// ADMINISTRACIÓN
// ============================================================

const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [appts, invs, pays, pats, profs, res] = await Promise.all([
        dbService.getAppointments(user),
        dbService.getInvoices(),
        dbService.getPayments(),
        dbService.getPatients(),
        dbService.getProfessionals(),
        dbService.getReservationRequests('pendiente').catch(() => []),
      ]);
      setAppointments(appts);
      setInvoices(invs);
      setPayments(pays);
      setPatientCount(pats.length);
      setProfessionals(profs.filter(p => p.role !== UserRole.ADMIN));
      setReservations(res.length);
      setLoading(false);
    };
    load();
  }, [user]);

  const today = localTodayISO();
  const todayAppointments = useMemo(
    () => appointments.filter(a => localDateKey(a.date) === today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [appointments, today]
  );

  const monthPayments = payments.filter(p => p.paymentDate.slice(0, 7) === today.slice(0, 7));
  const monthRevenue = monthPayments.reduce((s, p) => s + p.amount, 0);
  const openInvoices = invoices.filter(i => (i.status === 'emitida' || i.status === 'parcial') && i.amountPaid < i.total);
  const pendingAmount = openInvoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);

  const completedWithoutRecord = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded);
  const completedWithoutInvoice = appointments.filter(a => {
    if (a.status !== AppointmentStatus.COMPLETED) return false;
    const inv = invoices.find(i => i.appointmentId === a.id);
    return !inv || inv.status === 'borrador';
  });
  const unconfirmedToday = todayAppointments.filter(a => a.status === AppointmentStatus.PENDING);

  const alerts = buildDashboardAlerts({
    completedWithoutRecord: completedWithoutRecord.length,
    completedWithoutInvoice: completedWithoutInvoice.length,
    unpaidInvoices: openInvoices.length,
    pendingReservations: reservations,
    unconfirmedToday: unconfirmedToday.length,
  });

  const specialtyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    monthPayments.forEach(p => {
      const concept = p.concept as ClinicalSpecialty;
      const key = SPECIALTY_LABELS[concept] ? concept : 'otro';
      map.set(key, (map.get(key) || 0) + p.amount);
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      name: SPECIALTY_LABELS[key] || 'Otros',
      value,
      color: ROLE_PROFILES[key as UserRole]?.hex || '#94a3b8',
    }));
  }, [monthPayments]);

  const estimatedCapacity = Math.max(1, professionals.length * 8 * 60);
  const bookedMinutes = todayAppointments
    .filter(a => a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.NO_SHOW)
    .reduce((s, a) => s + (a.durationMinutes || 45), 0);
  const occupancy = Math.round((bookedMinutes / estimatedCapacity) * 100);

  const invoiceFor = (appointmentId: string) => invoices.find(i => i.appointmentId === appointmentId);

  const pipeline = [
    { key: 'reservada', label: 'Reservadas', count: appointments.filter(a => a.status === AppointmentStatus.PENDING || a.status === AppointmentStatus.CONFIRMED).length, color: 'bg-amber-400', text: 'text-amber-700' },
    { key: 'realizada', label: 'Realizadas', count: appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length, color: 'bg-logo-400', text: 'text-logo-700' },
    { key: 'registro', label: 'Con registro', count: appointments.filter(a => a.clinicalRecorded).length, color: 'bg-violet-400', text: 'text-violet-700' },
    { key: 'factura', label: 'Con factura', count: appointments.filter(a => invoiceFor(a.id)).length, color: 'bg-nutri-400', text: 'text-nutri-700' },
    { key: 'pagada', label: 'Pagadas', count: invoices.filter(i => i.status === 'pagada').length, color: 'bg-fisio-500', text: 'text-fisio-700' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración · Sinestesya"
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={`Vista global del centro · ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        icon={ShieldAlert}
        accent="bg-slate-700"
        actions={
          <>
            <Link to="/appointments?new=1" className={btnSecondary}><Plus size={16} /> Nueva cita</Link>
            <Link to="/billing?tab=invoices" className={btnPrimary}><ReceiptText size={16} /> Emitir factura</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Citas hoy" value={todayAppointments.length} icon={CalendarDays} hint={`${todayAppointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length} confirmadas`} tone="blue" />
        <StatCard title="Ocupación estimada" value={`${occupancy}%`} icon={Activity} hint="Horas reservadas / capacidad" tone="green" />
        <StatCard title="Ingresos del mes" value={formatMoney(monthRevenue)} icon={Euro} hint={`${monthPayments.length} cobros registrados`} tone="orange" />
        <StatCard title="Pendiente de cobro" value={formatMoney(pendingAmount)} icon={Wallet} hint={`${openInvoices.length} facturas abiertas`} tone="red" onClick={() => navigate('/billing?tab=invoices')} />
        <StatCard title="Pacientes activos" value={patientCount} icon={Users} hint={`${professionals.length} profesionales`} tone="yellow" onClick={() => navigate('/patients')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SectionCard
            title="Agenda de hoy"
            description="Estado administrativo de cada cita: reservada → realizada → registro clínico → factura → pago."
            actions={<Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800">Ver agenda <ArrowRight size={14} /></Link>}
            padded={false}
          >
            {loading ? (
              <div className="p-8 text-center text-sm text-stone-400">Cargando agenda…</div>
            ) : todayAppointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No hay citas hoy" description="La agenda global está libre. Puedes crear una cita desde el botón superior." />
            ) : (
              <div className="divide-y divide-stone-100">
                {todayAppointments.map(appt => {
                  const prof = professionals.find(p => p.id === appt.professionalId);
                  const invoice = invoiceFor(appt.id);
                  const state = getAppointmentAdminState(appt, { invoiceStatus: invoice?.status || null });
                  const specialty = appt.specialty || (prof?.role as ClinicalSpecialty | undefined);
                  const profile = getRoleProfile(specialty);
                  return (
                    <Link key={appt.id} to={`/patient/${appt.patientId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50">
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm font-bold text-stone-900">{formatTime(appt.date)}</p>
                        <p className="text-[10px] text-stone-400">{appt.durationMinutes || 45} min</p>
                      </div>
                      <div className={`h-9 w-1 shrink-0 rounded-full ${profile.solid}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-stone-900">{appt.patientName || 'Paciente'}</p>
                          {specialty && <Badge className={`${profile.soft} ${profile.text} ${profile.border}`}>{profile.shortLabel}</Badge>}
                          <Badge className={ADMIN_STATE_COLORS[state]}>{ADMIN_STATE_LABELS[state]}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {appt.professionalName || prof?.name || 'Profesional'} · {appt.reason} {appt.room ? `· ${appt.room}` : ''}
                        </p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-stone-300" />
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <SectionCard title="Ingresos por especialidad" description="Cobros del mes en curso">
              {specialtyRevenue.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sin cobros este mes" description="Los ingresos aparecerán aquí al registrar cobros." />
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={specialtyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ec" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a8a29e' }} />
                      <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                        {specialtyRevenue.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Ciclo de la sesión" description="Estado agregado de las citas registradas">
              <div className="space-y-3">
                {pipeline.map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="flex-1 text-sm text-stone-600">{item.label}</span>
                    <span className={`text-sm font-bold ${item.text}`}>{item.count}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-stone-100 pt-3 text-[11px] text-stone-400">
                  Una cita solo se considera cerrada cuando tiene registro clínico y factura pagada.
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-5">
          <SectionCard title="Tareas pendientes" description="Detección automática del estado administrativo">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 size={30} className="mb-2 text-fisio-500" />
                <p className="text-sm font-semibold text-stone-700">Todo al día</p>
                <p className="mt-1 text-xs text-stone-400">No hay incidencias administrativas detectadas.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map(alert => (
                  <Link
                    key={alert.id}
                    to={alert.actionPath || '/'}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-stone-50 ${
                      alert.level === 'danger' ? 'border-red-200 bg-red-50/50' :
                      alert.level === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                      'border-stone-200 bg-white'
                    }`}
                  >
                    <div className={`mt-0.5 ${alert.level === 'danger' ? 'text-red-500' : alert.level === 'warning' ? 'text-amber-500' : 'text-logo-500'}`}>
                      {alert.level === 'danger' ? <AlertTriangle size={17} /> : alert.level === 'warning' ? <Clock size={17} /> : <ClipboardList size={17} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-stone-800">{alert.title}</p>
                        {alert.count !== undefined && <span className="text-xs font-bold text-stone-500">{alert.count}</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{alert.description}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{alert.actionLabel} →</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Accesos rápidos" padded={false}>
            <div className="divide-y divide-stone-100">
              {[
                { label: 'Nuevo paciente', desc: 'Ficha administrativa única', path: '/patients?new=1', icon: UserPlus },
                { label: 'Registrar cobro', desc: 'Efectivo, tarjeta, Bizum', path: '/billing?tab=payments&new=1', icon: Euro },
                { label: 'Cierre de caja', desc: 'Cuadre diario por método', path: '/billing?tab=cash', icon: Wallet },
                { label: 'Exportar para asesoría', desc: 'Facturas, gastos y cobros', path: '/billing?tab=export', icon: FileText },
              ].map(item => (
                <Link key={item.path} to={item.path} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><item.icon size={15} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-stone-800">{item.label}</p>
                    <p className="text-[10px] text-stone-400">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300" />
                </Link>
              ))}
            </div>
          </SectionCard>

          <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-800 to-stone-900 p-5 text-white">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              <ShieldAlert size={13} /> Privacidad
            </div>
            <p className="text-sm font-semibold">Administración no accede a notas clínicas</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              El acceso a historias clínicas detalladas requiere una autorización expresa y justificada. Puedes revisar los permisos en Configuración.
            </p>
            <Link to="/settings?tab=security" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white">
              Revisar permisos <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PROFESIONALES CLÍNICOS
// ============================================================

interface ToolLink { label: string; desc: string; icon: any; tool: string; tone: string; }

const specialtyTools: Record<ClinicalSpecialty, ToolLink[]> = {
  [UserRole.FISIOTERAPIA]: [
    { label: 'Nueva valoración', desc: 'Motivo, EVA y exploración', icon: ClipboardCheck, tool: 'valoracion', tone: 'bg-fisio-50 text-fisio-700' },
    { label: 'Mapa del dolor', desc: 'Silueta corporal anterior y posterior', icon: MapPin, tool: 'body', tone: 'bg-red-50 text-red-600' },
    { label: 'Evolución EVA', desc: 'Comparativa entre valoraciones', icon: TrendingUp, tool: 'evolution', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Ejercicios y sesiones', desc: 'Técnicas y pautas domiciliarias', icon: Activity, tool: 'session', tone: 'bg-logo-50 text-logo-700' },
  ],
  [UserRole.NUTRICION]: [
    { label: 'Antropometría', desc: 'Peso, IMC, perímetros y pliegues', icon: Activity, tool: 'valoracion', tone: 'bg-nutri-50 text-nutri-700' },
    { label: 'Plan alimentario', desc: 'Comidas, cantidades y alternativas', icon: Apple, tool: 'plan', tone: 'bg-fisio-50 text-fisio-700' },
    { label: 'Evolución de medidas', desc: 'Peso, IMC y perímetros', icon: TrendingUp, tool: 'evolution', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Seguimiento y adherencia', desc: 'Dificultades, síntomas y objetivos', icon: ClipboardList, tool: 'session', tone: 'bg-logo-50 text-logo-700' },
  ],
  [UserRole.LOGOPEDIA]: [
    { label: 'Valoración del lenguaje', desc: 'Comprensión, expresión y habla', icon: MessageCircle, tool: 'valoracion', tone: 'bg-logo-50 text-logo-700' },
    { label: 'Objetivos y sesión', desc: 'Aciertos, ayuda y evolución', icon: ClipboardCheck, tool: 'session', tone: 'bg-fisio-50 text-fisio-700' },
    { label: 'Evolución por objetivo', desc: 'Comparativa de resultados', icon: TrendingUp, tool: 'evolution', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Coordinación', desc: 'Familia, escuela y equipo', icon: Users, tool: 'coordination', tone: 'bg-violet-50 text-violet-700' },
  ],
  [UserRole.PSICOLOGIA]: [
    { label: 'Entrevista inicial', desc: 'Historia y formulación clínica', icon: Brain, tool: 'valoracion', tone: 'bg-psy-50 text-psy-800' },
    { label: 'Pruebas psicométricas', desc: 'Banco por áreas y resultados', icon: ClipboardList, tool: 'tests', tone: 'bg-violet-50 text-violet-700' },
    { label: 'Plan de intervención', desc: 'Objetivos y técnicas', icon: HeartPulse, tool: 'session', tone: 'bg-fisio-50 text-fisio-700' },
    { label: 'Evolución y riesgo', desc: 'Seguimiento y prevención', icon: TrendingUp, tool: 'evolution', tone: 'bg-amber-50 text-amber-700' },
  ],
};

const ClinicalDashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const specialty = user.role as ClinicalSpecialty;
  const profile = getRoleProfile(specialty);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [appts, pats, recs] = await Promise.all([
        dbService.getAppointments(user),
        dbService.getPatients(user.id, user.role),
        dbService.getClinicalRecordsByProfessional(user.id, specialty),
      ]);
      setAppointments(appts);
      setPatients(pats);
      setRecords(recs);
      setLoading(false);
    };
    load();
  }, [user, specialty]);

  const today = localTodayISO();
  const todayAppointments = appointments
    .filter(a => localDateKey(a.date) === today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const upcoming = appointments
    .filter(a => new Date(a.date) >= new Date() && a.status !== AppointmentStatus.CANCELLED)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextAppointment = upcoming[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekRecords = records.filter(r => new Date(r.date) >= weekStart);
  const pendingRecords = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded);
  const draftReports = records.filter(r => r.recordType === 'informe' && r.status === 'borrador');

  const lastRecordFor = (patientId: string) => records.find(r => r.patientId === patientId);
  const patientName = (id: string) => {
    const p = patients.find(x => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : 'Paciente';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Consulta de ${profile.label}`}
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={`Tu espacio clínico · ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        icon={specialty === UserRole.PSICOLOGIA ? Brain : specialty === UserRole.FISIOTERAPIA ? HeartPulse : specialty === UserRole.LOGOPEDIA ? MessageCircle : Apple}
        accent={profile.solid}
        actions={
          <>
            <Link to="/appointments" className={btnSecondary}><CalendarDays size={16} /> Mi agenda</Link>
            <Link to={`/clinical/${specialty}`} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${profile.solid} ${profile.solidHover}`}>
              <Plus size={16} /> Nueva sesión
            </Link>
          </>
        }
      />

      <div className={`overflow-hidden rounded-3xl ${profile.soft} border ${profile.border}`}>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${profile.solid}`}>
              {specialtyIcon(specialty, 22)}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Próxima cita</p>
              {nextAppointment ? (
                <>
                  <p className="mt-1 text-xl font-bold text-stone-900">{nextAppointment.patientName || patientName(nextAppointment.patientId)}</p>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {new Date(nextAppointment.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatTime(nextAppointment.date)} · {nextAppointment.reason}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-lg font-semibold text-stone-700">Sin citas próximas</p>
              )}
            </div>
          </div>
          {nextAppointment && (
            <Link to={`/patient/${nextAppointment.patientId}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/80 px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:bg-white">
              Abrir ficha <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Citas hoy" value={todayAppointments.length} icon={CalendarDays} hint={`${todayAppointments.filter(a => a.status === AppointmentStatus.CONFIRMED).length} confirmadas`} tone="blue" />
        <StatCard title="Pacientes asignados" value={patients.length} icon={Users} hint="Solo tu especialidad" tone="green" onClick={() => navigate('/patients')} />
        <StatCard title="Registros esta semana" value={weekRecords.length} icon={ClipboardCheck} hint={`${records.length} en total`} tone="violet" />
        <StatCard title="Pendiente de registrar" value={pendingRecords.length} icon={Clock} hint={pendingRecords.length ? 'Sesiones realizadas sin evolución' : 'Todo registrado'} tone={pendingRecords.length ? 'red' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SectionCard
            title="Agenda de hoy"
            description="Tus citas y el estado de su registro clínico"
            actions={<Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800">Ver todas <ArrowRight size={14} /></Link>}
            padded={false}
          >
            {loading ? (
              <div className="p-8 text-center text-sm text-stone-400">Cargando…</div>
            ) : todayAppointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No tienes citas hoy" description="Aprovecha para revisar objetivos pendientes o preparar informes." />
            ) : (
              <div className="divide-y divide-stone-100">
                {todayAppointments.map(appt => (
                  <Link key={appt.id} to={`/patient/${appt.patientId}?appointment=${appt.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-sm font-bold text-stone-900">{formatTime(appt.date)}</p>
                      <p className="text-[10px] text-stone-400">{appt.durationMinutes || 45} min</p>
                    </div>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${profile.soft} ${profile.text}`}>
                      {specialtyIcon(specialty, 16)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900">{appt.patientName || patientName(appt.patientId)}</p>
                      <p className="truncate text-xs text-stone-500">{appt.reason} {appt.room ? `· ${appt.room}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {appt.clinicalRecorded ? (
                        <Badge className="border-fisio-200 bg-fisio-50 text-fisio-800"><CheckCircle2 size={11} /> Registrado</Badge>
                      ) : appt.status === AppointmentStatus.COMPLETED ? (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800"><Clock size={11} /> Registrar</Badge>
                      ) : (
                        <Badge className={APPOINTMENT_STATUS_COLORS[appt.status]}>{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
                      )}
                      <ChevronRight size={15} className="text-stone-300" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Herramientas de tu especialidad" description={`Accesos directos de ${profile.label}`} padded={false}>
            <div className="grid grid-cols-1 gap-px bg-stone-100 sm:grid-cols-2">
              {specialtyTools[specialty].map(tool => (
                <Link key={tool.label} to={`/clinical/${specialty}?tool=${tool.tool}`} className="flex items-start gap-3 bg-white p-4 transition-colors hover:bg-stone-50">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tool.tone}`}><tool.icon size={17} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{tool.label}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{tool.desc}</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto mt-1 shrink-0 text-stone-300" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Mis pacientes" description="Última actividad registrada" padded={false}>
            {patients.length === 0 ? (
              <EmptyState icon={Users} title="Sin pacientes asignados" description="Los pacientes aparecerán cuando administración los vincule o al crear una cita." />
            ) : (
              <div className="divide-y divide-stone-100">
                {patients.slice(0, 5).map(p => {
                  const last = lastRecordFor(p.id);
                  return (
                    <Link key={p.id} to={`/patient/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${profile.soft} ${profile.text}`}>
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-800">{patientFullName(p)}</p>
                        <p className="truncate text-[11px] text-stone-400">
                          {last ? `Último registro: ${new Date(last.date).toLocaleDateString('es-ES')}` : 'Sin registros todavía'}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-stone-300" />
                    </Link>
                  );
                })}
                {patients.length > 5 && (
                  <Link to="/patients" className="block px-4 py-3 text-center text-xs font-semibold text-stone-500 hover:bg-stone-50 hover:text-stone-800">
                    Ver los {patients.length} pacientes
                  </Link>
                )}
              </div>
            )}
          </SectionCard>

          {pendingRecords.length > 0 && (
            <InlineAlert level="warning" title={`${pendingRecords.length} sesión(es) sin registro`}>
              <p>Hay citas realizadas pendientes de evolución clínica.</p>
              <button onClick={() => navigate(`/patient/${pendingRecords[0].patientId}?appointment=${pendingRecords[0].id}`)} className="mt-1 text-xs font-bold underline">
                Abrir la primera
              </button>
            </InlineAlert>
          )}

          <div className={`rounded-2xl border ${profile.border} bg-white p-5`}>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={15} className={profile.text} />
              <p className="text-sm font-bold text-stone-800">Recordatorio clínico</p>
            </div>
            <p className="text-xs leading-relaxed text-stone-500">
              {specialty === UserRole.PSICOLOGIA
                ? 'Las pruebas psicométricas licenciadas se registran sin ítems ni claves. La corrección automática solo se habilita con autorización y baremos válidos.'
                : specialty === UserRole.FISIOTERAPIA
                  ? 'Registra la evolución del dolor (EVA) y las zonas corporales en cada sesión para comparar resultados entre valoraciones.'
                  : specialty === UserRole.LOGOPEDIA
                    ? 'Cada objetivo debe tener un resultado medible: aciertos, nivel de ayuda y evolución. La coordinación con el entorno requiere autorización.'
                    : 'Los planes nutricionales conservan historial de versiones. En pacientes infantiles, utiliza referencias de crecimiento adecuadas a la edad.'}
            </p>
            {draftReports.length > 0 && (
              <p className="mt-3 rounded-lg bg-stone-50 px-2.5 py-2 text-[11px] font-medium text-stone-600">
                {draftReports.length} informe(s) en borrador pendiente(s) de revisión.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  if (isAdmin(user)) return <AdminDashboard user={user} />;
  if (isClinicalRole(user.role)) return <ClinicalDashboard user={user} />;
  return (
    <div className="space-y-5">
      <PageHeader title="Perfil pendiente de configuración" description="Tu cuenta todavía no tiene una especialidad asignada. Contacta con administración." />
      <div className={cardClass + ' p-6'}>
        <InlineAlert level="warning" title="Sin acceso clínico">
          Hasta que se asigne una especialidad, no podrás acceder a historias clínicas ni a la agenda asistencial.
        </InlineAlert>
      </div>
    </div>
  );
};

export default Dashboard;
