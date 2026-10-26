import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock, Download, Euro, FileText,
  Percent, RefreshCw, TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Appointment, AppointmentStatus, ClinicalSpecialty, Expense, Invoice, Patient, Payment, Service, User,
} from '../types';
import { dbService } from '../services/dbService';
import {
  CLINICAL_SPECIALTIES, formatDate, formatMoney, getRoleProfile, localMonthStartISO,
  localTodayISO, patientFullName,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, PageHeader, ProgressBar, SectionCard, StatCard, Tabs,
  btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';
import { downloadCsv, dateStamp } from '../services/exportUtils';

interface Props { user: User; }

const toKey = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const workingDays = (from: string, to: string): number => {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

const inRange = (value: string, from: string, to: string): boolean => {
  const key = value.length > 10 ? toKey(value) : value;
  return key >= from && key <= to;
};

const BillingPending = (invoice: Invoice): number => Math.max(0, invoice.total - invoice.amountPaid);

const Reports: React.FC<Props> = ({ user }) => {
  const [tab, setTab] = useState('overview');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [from, setFrom] = useState(localMonthStartISO());
  const [to, setTo] = useState(localTodayISO());
  const [preset, setPreset] = useState('month');

  const applyPreset = (value: string) => {
    setPreset(value);
    const now = new Date();
    if (value === 'month') { setFrom(localMonthStartISO()); setTo(localTodayISO()); return; }
    if (value === 'prevMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(isoDate(start)); setTo(isoDate(end)); return;
    }
    if (value === 'quarter') {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      setFrom(isoDate(new Date(now.getFullYear(), qStart, 1))); setTo(localTodayISO()); return;
    }
    if (value === 'year') {
      setFrom(isoDate(new Date(now.getFullYear(), 0, 1))); setTo(localTodayISO()); return;
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [inv, pay, exp, appts, pats, profs, servs] = await Promise.all([
        dbService.getInvoices(),
        dbService.getPayments(),
        dbService.getExpenses(),
        dbService.getAppointments(user),
        dbService.getPatients(user.id, user.role),
        dbService.getProfessionals(),
        dbService.getServices(),
      ]);
      setInvoices(inv);
      setPayments(pay);
      setExpenses(exp);
      setAppointments(appts);
      setPatients(pats);
      setProfessionals(profs.filter(p => p.role !== 'admin'));
      setServices(servs);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los informes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id]);

  const period = useMemo(() => {
    const invs = invoices.filter(i => i.status !== 'anulada' && inRange(i.date, from, to));
    const pays = payments.filter(p => inRange(p.paymentDate, from, to));
    const exps = expenses.filter(e => inRange(e.date, from, to));
    const appts = appointments.filter(a => inRange(a.date, from, to));
    const completed = appts.filter(a => a.status === AppointmentStatus.COMPLETED);
    const cancelled = appts.filter(a => a.status === AppointmentStatus.CANCELLED);
    const noShow = appts.filter(a => a.status === AppointmentStatus.NO_SHOW);
    const newPatients = patients.filter(p => inRange(p.createdAt, from, to));
    return {
      invs, pays, exps, appts, completed, cancelled, noShow, newPatients,
      billed: invs.reduce((s, i) => s + i.total, 0),
      collected: pays.reduce((s, p) => s + p.amount, 0),
      spent: exps.reduce((s, e) => s + e.amount, 0),
      pending: invs.reduce((s, i) => s + BillingPending(i), 0),
      attendanceRate: appts.length ? (completed.length / appts.length) * 100 : 0,
      noShowRate: appts.length ? (noShow.length / appts.length) * 100 : 0,
    };
  }, [invoices, payments, expenses, appointments, patients, from, to]);

  const serviceById = useMemo(() => new Map(services.map(s => [s.id, s])), [services]);

  const specialtyStats = useMemo(() => {
    return CLINICAL_SPECIALTIES.map(specialty => {
      const profile = getRoleProfile(specialty);
      const invs = period.invs.filter(inv => inv.items.some(item => serviceById.get(item.serviceId || '')?.specialty === specialty));
      const billed = invs.reduce((sum, inv) => {
        return sum + inv.items.filter(item => serviceById.get(item.serviceId || '')?.specialty === specialty)
          .reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      }, 0);
      const collected = period.pays.filter(p => {
        if (p.invoiceId) {
          const inv = invoices.find(i => i.id === p.invoiceId);
          return !!inv && inv.items.some(item => serviceById.get(item.serviceId || '')?.specialty === specialty);
        }
        return p.concept === specialty;
      }).reduce((s, p) => s + p.amount, 0);
      const attributedExpenses = period.exps
        .filter(e => e.specialty === specialty)
        .reduce((s, e) => s + e.amount, 0);
      const sessions = period.completed.filter(a => a.specialty === specialty);
      const noShow = period.noShow.filter(a => a.specialty === specialty);
      return {
        specialty, profile, billed, collected, attributedExpenses,
        margin: collected - attributedExpenses,
        sessions: sessions.length,
        noShow: noShow.length,
        noShowRate: sessions.length + noShow.length ? (noShow.length / (sessions.length + noShow.length)) * 100 : 0,
      };
    });
  }, [period, serviceById, invoices]);

  const teamStats = useMemo(() => {
    const days = workingDays(from, to);
    const capacity = Math.max(1, days * 8 * 60);
    return professionals.map(prof => {
      const own = period.appts.filter(a => a.professionalId === prof.id && a.status !== AppointmentStatus.CANCELLED);
      const completed = own.filter(a => a.status === AppointmentStatus.COMPLETED);
      const minutes = own.reduce((s, a) => s + (a.durationMinutes || 45), 0);
      const noShow = own.filter(a => a.status === AppointmentStatus.NO_SHOW).length;
      const genre = prof.profession || prof.role;
      return {
        prof,
        booked: own.length,
        completed: completed.length,
        noShow,
        minutes,
        hours: minutes / 60,
        occupancy: Math.min(100, (minutes / capacity) * 100),
        specialty: CLINICAL_SPECIALTIES.includes(genre as ClinicalSpecialty) ? genre as ClinicalSpecialty : null,
      };
    }).sort((a, b) => b.minutes - a.minutes);
  }, [professionals, period.appts, from, to]);

  const totalOccupancy = useMemo(() => {
    const totalMinutes = teamStats.reduce((s, t) => s + t.minutes, 0);
    const days = workingDays(from, to);
    const capacity = Math.max(1, days * 8 * 60 * Math.max(1, professionals.length));
    return (totalMinutes / capacity) * 100;
  }, [teamStats, from, to, professionals.length]);

  const trend = useMemo(() => {
    const points: { label: string; Facturado: number; Cobrado: number; Gastos: number }[] = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
      const s = isoDate(start);
      const e = isoDate(end);
      points.push({
        label: start.toLocaleDateString('es-ES', { month: 'short' }),
        Facturado: invoices.filter(i => i.status !== 'anulada' && inRange(i.date, s, e)).reduce((sum, i) => sum + i.total, 0),
        Cobrado: payments.filter(p => inRange(p.paymentDate, s, e)).reduce((sum, p) => sum + p.amount, 0),
        Gastos: expenses.filter(x => inRange(x.date, s, e)).reduce((sum, x) => sum + x.amount, 0),
      });
    }
    return points;
  }, [invoices, payments, expenses]);

  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; specialty: string; count: number; revenue: number }>();
    period.invs.forEach(inv => inv.items.forEach(item => {
      const service = serviceById.get(item.serviceId || '');
      const key = item.serviceId || item.description;
      const current = map.get(key) || {
        name: service?.name || item.description,
        specialty: service?.specialty || 'otro',
        count: 0,
        revenue: 0,
      };
      current.count += item.quantity;
      current.revenue += item.quantity * item.unitPrice;
      map.set(key, current);
    }));
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [period.invs, serviceById]);

  const quality = useMemo(() => {
    const today = localTodayISO();
    const completedNoRecord = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.clinicalRecorded);
    const completedNoInvoice = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && !a.invoiceId);
    const overdue = invoices.filter(i => ['emitida', 'parcial'].includes(i.status) && i.dueDate < today);
    const draftOld = invoices.filter(i => i.status === 'borrador' && i.date < today);
    const pendingExpenses = expenses.filter(e => e.status === 'pendiente');
    const withoutPrivacy = patients.filter(p => !p.privacyPolicySigned);
    const minorsNoGuardian = patients.filter(p => {
      const birth = new Date(p.birthDate);
      if (Number.isNaN(birth.getTime())) return false;
      const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age < 18 && !p.legalGuardian;
    });
    return { completedNoRecord, completedNoInvoice, overdue, draftOld, pendingExpenses, withoutPrivacy, minorsNoGuardian };
  }, [appointments, invoices, expenses, patients]);

  const exportSummary = () => {
    downloadCsv(`sinestesya-informe-${from}-${to}`, [
      ['Indicador', 'Valor'],
      ['Periodo', `${from} / ${to}`],
      ['Citas', period.appts.length],
      ['Sesiones realizadas', period.completed.length],
      ['Canceladas', period.cancelled.length],
      ['Ausencias', period.noShow.length],
      ['Tasa de asistencia (%)', period.attendanceRate.toFixed(1)],
      ['Tasa de ausencia (%)', period.noShowRate.toFixed(1)],
      ['Facturado (€)', period.billed.toFixed(2)],
      ['Cobrado (€)', period.collected.toFixed(2)],
      ['Gastos (€)', period.spent.toFixed(2)],
      ['Pendiente de cobro (€)', period.pending.toFixed(2)],
      ['Pacientes nuevos', period.newPatients.length],
      ['Ocupación media (%)', totalOccupancy.toFixed(1)],
    ]);
  };

  const exportTeam = () => {
    downloadCsv(`sinestesya-equipo-${from}-${to}`, [
      ['Profesional', 'Perfil', 'Citas reservadas', 'Sesiones realizadas', 'Ausencias', 'Horas agenda', 'Ocupación (%)'],
      ...teamStats.map(t => [t.prof.name, t.specialty || 'administración', t.booked, t.completed, t.noShow, t.hours.toFixed(1), t.occupancy.toFixed(1)]),
    ]);
  };

  const exportSpecialty = () => {
    downloadCsv(`sinestesya-especialidades-${from}-${to}`, [
      ['Especialidad', 'Sesiones', 'Ausencias', 'Facturado', 'Cobrado', 'Gastos atribuidos', 'Margen'],
      ...specialtyStats.map(s => [s.profile.label, s.sessions, s.noShow, s.billed, s.collected, s.attributedExpenses, s.margin]),
    ]);
  };

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'specialties', label: 'Especialidades', icon: Euro },
    { id: 'team', label: 'Equipo y ocupación', icon: Users },
    { id: 'services', label: 'Servicios', icon: FileText },
    { id: 'quality', label: 'Calidad y avisos', icon: AlertTriangle, count: quality.completedNoRecord.length + quality.overdue.length + quality.withoutPrivacy.length },
  ];

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Sesiones realizadas" value={period.completed.length} icon={CheckCircle2} tone="green" hint={`${period.appts.length} citas en el periodo`} />
        <StatCard title="Facturado" value={formatMoney(period.billed)} icon={ReceiptIcon} tone="blue" hint={`${period.invs.length} facturas`} />
        <StatCard title="Cobrado" value={formatMoney(period.collected)} icon={Wallet} tone="orange" hint={`Pendiente ${formatMoney(period.pending)}`} />
        <StatCard title="Beneficio de caja" value={formatMoney(period.collected - period.spent)} icon={period.collected >= period.spent ? TrendingUp : TrendingDown} tone={period.collected >= period.spent ? 'green' : 'red'} hint={`Gastos ${formatMoney(period.spent)}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Tasa de asistencia" value={`${period.attendanceRate.toFixed(0)}%`} icon={Percent} tone="green" hint="Sobre citas del periodo" />
        <StatCard title="Ausencias" value={`${period.noShowRate.toFixed(0)}%`} icon={AlertTriangle} tone={period.noShowRate > 15 ? 'red' : 'yellow'} hint={`${period.noShow.length} citas`} />
        <StatCard title="Ocupación media" value={`${totalOccupancy.toFixed(0)}%`} icon={Clock} tone="blue" hint="Aproximada, 8 h/día laborable" />
        <StatCard title="Pacientes nuevos" value={period.newPatients.length} icon={Users} tone="orange" hint="Altas en el periodo" />
      </div>

      <SectionCard title="Evolución de los últimos 6 meses" description="Facturación, cobros y gastos por mes">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={v => `${v} €`} />
              <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Facturado" fill="#78716c" radius={[5, 5, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Cobrado" fill="#4f8a70" radius={[5, 5, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Gastos" fill="#d9824b" radius={[5, 5, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Facturación por especialidad" description="Importe facturado en el periodo">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={specialtyStats.map(s => ({ name: s.profile.shortLabel, total: s.billed, fill: s.profile.hex }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={v => `${v} €`} />
                <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={54}>
                  {specialtyStats.map(s => <Cell key={s.specialty} fill={s.profile.hex} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Servicios con más facturación" padded={false}>
          {topServices.length === 0 ? (
            <EmptyState icon={FileText} title="Sin datos" description="No hay líneas de factura en el periodo." />
          ) : (
            <div className="divide-y divide-stone-100">
              {topServices.map(service => (
                <div key={service.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-stone-800">{service.name}</p>
                    <p className="text-[10px] text-stone-400">{service.count} unidad(es)</p>
                  </div>
                  <span className="text-sm font-bold text-stone-800">{formatMoney(service.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );

  const renderSpecialties = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {specialtyStats.map(s => (
          <div key={s.specialty} className={cardClass + ' overflow-hidden'}>
            <div className={`h-1.5 ${s.profile.solid}`} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <Badge className={`${s.profile.soft} ${s.profile.text} ${s.profile.border}`}>{s.profile.label}</Badge>
                <span className="text-[10px] text-stone-400">{s.sessions} sesiones</span>
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Facturado</p>
              <p className="text-xl font-bold text-stone-900">{formatMoney(s.billed)}</p>
              <div className="mt-2 space-y-1 text-[11px] text-stone-500">
                <div className="flex justify-between"><span>Cobrado</span><span className="font-semibold text-fisio-700">{formatMoney(s.collected)}</span></div>
                <div className="flex justify-between"><span>Gastos atribuidos</span><span className="font-semibold text-nutri-700">{formatMoney(s.attributedExpenses)}</span></div>
                <div className="flex justify-between border-t border-stone-100 pt-1"><span>Margen</span><span className={`font-bold ${s.margin >= 0 ? 'text-stone-800' : 'text-red-600'}`}>{formatMoney(s.margin)}</span></div>
                <div className="flex justify-between"><span>Ausencias</span><span>{s.noShowRate.toFixed(0)}%</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionCard title="Comparativa económica" description="Facturado, cobrado y gastos atribuidos" actions={
        <button onClick={exportSpecialty} className={btnSecondary + ' !py-1.5 text-xs'}><Download size={13} /> CSV</button>
      }>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={specialtyStats.map(s => ({ name: s.profile.shortLabel, Facturado: s.billed, Cobrado: s.collected, Gastos: s.attributedExpenses }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={v => `${v} €`} />
              <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Facturado" fill="#a8a29e" radius={[5, 5, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Cobrado" fill="#4f8a70" radius={[5, 5, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Gastos" fill="#d9824b" radius={[5, 5, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[11px] text-stone-400">
          Los gastos generales del centro no se atribuyen a una especialidad. El margen mostrado es orientativo y no sustituye a la contabilidad oficial.
        </p>
      </SectionCard>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Profesionales" value={professionals.length} icon={Users} tone="blue" />
        <StatCard title="Horas de agenda" value={`${teamStats.reduce((s, t) => s + t.hours, 0).toFixed(0)} h`} icon={Clock} tone="orange" hint="Citas no canceladas" />
        <StatCard title="Ocupación media" value={`${totalOccupancy.toFixed(0)}%`} icon={Percent} tone={totalOccupancy > 80 ? 'green' : 'yellow'} hint="Aproximación 8 h/día" />
        <StatCard title="Ausencias" value={period.noShow.length} icon={AlertTriangle} tone="red" hint={`${period.noShowRate.toFixed(0)}% de las citas`} />
      </div>

      <SectionCard title="Carga por profesional" description="Actividad del periodo seleccionado" actions={
        <button onClick={exportTeam} className={btnSecondary + ' !py-1.5 text-xs'}><Download size={13} /> CSV</button>
      } padded={false}>
        {teamStats.length === 0 ? (
          <EmptyState icon={Users} title="Sin profesionales" />
        ) : (
          <div className="divide-y divide-stone-100">
            {teamStats.map(t => {
              const profile = t.specialty ? getRoleProfile(t.specialty) : null;
              return (
                <div key={t.prof.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${profile ? `${profile.soft} ${profile.text}` : 'bg-stone-100 text-stone-600'}`}>
                        {t.prof.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{t.prof.name}</p>
                        <p className="text-[10px] text-stone-400">{profile?.label || 'Administración'} · {t.completed} sesiones realizadas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-stone-500">
                      <span><strong className="text-stone-800">{t.hours.toFixed(1)} h</strong> agenda</span>
                      <span><strong className={t.noShow ? 'text-red-600' : 'text-stone-800'}>{t.noShow}</strong> ausencias</span>
                      <span className="w-14 text-right font-bold text-stone-800">{t.occupancy.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={t.occupancy} tone={t.occupancy > 85 ? 'bg-red-400' : profile?.solid || 'bg-stone-500'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <InlineAlert level="info" title="Cómo se calcula la ocupación">
        Minutos de citas no canceladas divididos entre los días laborables del periodo y una jornada teórica de 8 horas por profesional.
        No descuenta vacaciones, festivos ni horas administrativas, por lo que es un indicador orientativo.
      </InlineAlert>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-5">
      <SectionCard title="Rentabilidad por servicio" description="Unidades facturadas e ingresos del periodo" padded={false}>
        {topServices.length === 0 ? (
          <EmptyState icon={FileText} title="Sin facturación" description="No hay líneas de factura en el periodo seleccionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Especialidad</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-right">Ticket medio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topServices.map(s => {
                  const specialty = CLINICAL_SPECIALTIES.includes(s.specialty as ClinicalSpecialty) ? s.specialty as ClinicalSpecialty : null;
                  return (
                    <tr key={s.name}>
                      <td className="px-4 py-3 text-xs font-semibold text-stone-800">{s.name}</td>
                      <td className="px-4 py-3 text-xs text-stone-500">{specialty ? getRoleProfile(specialty).label : 'Otro'}</td>
                      <td className="px-4 py-3 text-right text-xs">{s.count}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-stone-800">{formatMoney(s.revenue)}</td>
                      <td className="px-4 py-3 text-right text-xs text-stone-500">{formatMoney(s.count ? s.revenue / s.count : 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Catálogo activo" description="Precios configurados actualmente (no históricos)" padded={false}>
        <div className="divide-y divide-stone-100">
          {services.filter(s => s.active).map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-stone-800">{s.name}</p>
                <p className="text-[10px] text-stone-400">{s.durationMinutes} min · {s.room || 'sin sala'}</p>
              </div>
              <span className="text-xs font-bold text-stone-700">{formatMoney(s.price)}</span>
            </div>
          ))}
          {services.filter(s => s.active).length === 0 && <EmptyState icon={FileText} title="Sin servicios activos" />}
        </div>
      </SectionCard>
    </div>
  );

  const renderQuality = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Sesiones sin registro" value={quality.completedNoRecord.length} icon={FileText} tone={quality.completedNoRecord.length ? 'red' : 'green'} hint="Realizadas sin evolución" />
        <StatCard title="Sesiones sin factura" value={quality.completedNoInvoice.length} icon={ReceiptIcon} tone={quality.completedNoInvoice.length ? 'orange' : 'green'} hint="Pendientes de facturar" />
        <StatCard title="Facturas vencidas" value={quality.overdue.length} icon={AlertTriangle} tone={quality.overdue.length ? 'red' : 'green'} hint="Emitidas o parciales" />
        <StatCard title="RGPD pendiente" value={quality.withoutPrivacy.length} icon={Users} tone={quality.withoutPrivacy.length ? 'yellow' : 'green'} hint="Sin consentimiento de privacidad" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Tareas administrativas abiertas" padded={false}>
          <div className="divide-y divide-stone-100">
            {[
              { label: 'Citas realizadas sin registro clínico', value: quality.completedNoRecord.length, tone: 'text-red-600', path: '/appointments?filter=sin_registro' },
              { label: 'Citas realizadas sin factura', value: quality.completedNoInvoice.length, tone: 'text-amber-700', path: '/billing?tab=invoices' },
              { label: 'Facturas vencidas', value: quality.overdue.length, tone: 'text-red-600', path: '/billing?tab=invoices' },
              { label: 'Borradores de factura antiguos', value: quality.draftOld.length, tone: 'text-amber-700', path: '/billing?tab=invoices' },
              { label: 'Gastos pendientes de pago', value: quality.pendingExpenses.length, tone: 'text-stone-700', path: '/billing?tab=expenses' },
              { label: 'Pacientes sin consentimiento de privacidad', value: quality.withoutPrivacy.length, tone: 'text-amber-700', path: '/patients' },
              { label: 'Menores sin representante legal', value: quality.minorsNoGuardian.length, tone: 'text-red-600', path: '/patients' },
            ].map(item => (
              <a key={item.label} href={`#${item.path}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                <span className="text-xs text-stone-600">{item.label}</span>
                <span className={`text-sm font-bold ${item.tone}`}>{item.value}</span>
              </a>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Cumplimiento y protección de datos" description="Revisión periódica recomendada">
          <div className="space-y-3 text-sm">
            {[
              'Los consentimientos de privacidad y clínicos se registran por paciente.',
              'Los menores requieren representante legal y autorización específica.',
              'El acceso de administración a notas clínicas está desactivado salvo autorización expresa y justificada.',
              'Las modificaciones clínicas conservan versión y auditoría.',
              'Las copias de seguridad y la política de retención se configuran en Ajustes.',
              'La IA clínica permanece desactivada hasta superar la evaluación de privacidad.',
            ].map(text => (
              <div key={text} className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-fisio-500" />
                <span className="text-xs text-stone-600">{text}</span>
              </div>
            ))}
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Este panel ayuda a detectar tareas abiertas, pero no sustituye una auditoría formal de protección de datos.
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración · Dirección"
        title="Estadísticas del centro"
        description="Actividad, ocupación, rentabilidad y calidad administrativa. Sin datos clínicos identificables."
        icon={BarChart3}
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
            <button onClick={exportSummary} className={btnPrimary}><Download size={15} /> Exportar resumen</button>
          </>
        }
      />

      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}

      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-end'}>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'month', label: 'Este mes' },
            { id: 'prevMonth', label: 'Mes anterior' },
            { id: 'quarter', label: 'Trimestre' },
            { id: 'year', label: 'Año' },
          ].map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${preset === p.id ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-end gap-2 md:justify-end">
          <Field label="Desde" className="w-full sm:w-40"><input type="date" className={`${inputClass} !py-1.5 text-xs`} value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }} /></Field>
          <Field label="Hasta" className="w-full sm:w-40"><input type="date" className={`${inputClass} !py-1.5 text-xs`} value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }} /></Field>
        </div>
      </div>

      <Tabs items={tabs} active={tab} onChange={setTab} />

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Calculando estadísticas…</div>
      ) : (
        <>
          {tab === 'overview' && renderOverview()}
          {tab === 'specialties' && renderSpecialties()}
          {tab === 'team' && renderTeam()}
          {tab === 'services' && renderServices()}
          {tab === 'quality' && renderQuality()}
        </>
      )}

      <p className="text-center text-[10px] text-stone-400">
        Informe generado el {formatDate(dateStamp())} por {user.name}. Los indicadores económicos son de gestión y no sustituyen a la contabilidad oficial.
      </p>
    </div>
  );
};

// Alias de icono para evitar confusión con el componente ReceiptText importado.
const ReceiptIcon = FileText;

export default Reports;
