import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, Download, Eye, FileText, LockKeyhole, RefreshCw,
  Search, ShieldCheck, UserCog, Users,
} from 'lucide-react';
import { AuditEntry, User } from '../types';
import { dbService, isDemoMode } from '../services/dbService';
import { formatDate } from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, StatCard,
  btnGhost, btnPrimary, btnSecondary, inputClass,
} from '../components/ui';
import { downloadCsv, dateStamp } from '../services/exportUtils';

interface Props { user: User; }

const ACTION_LABELS: Record<string, string> = {
  'patient.create': 'Alta de paciente',
  'patient.update': 'Modificación de paciente',
  'clinical.create': 'Registro clínico creado',
  'clinical.update': 'Registro clínico modificado',
  'payment.create': 'Cobro registrado',
  'payment.update': 'Cobro modificado',
  'payment.delete': 'Cobro eliminado',
  'invoice.create': 'Factura emitida',
  'invoice.update': 'Factura modificada',
  'consent.create': 'Consentimiento registrado',
  'consent.update': 'Consentimiento modificado',
  'settings.update': 'Configuración modificada',
  'settings.clinical_access': 'Acceso clínico de administración',
  'backup.verify': 'Verificación de copia',
  'professional.create': 'Profesional creado',
  'professional.update': 'Profesional modificado',
  'professional.delete': 'Profesional eliminado',
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'ai.query': 'Consulta a IA',
};

const ACTION_GROUPS: { id: string; label: string; prefixes: string[] }[] = [
  { id: 'all', label: 'Todas las acciones', prefixes: [] },
  { id: 'clinical', label: 'Clínica', prefixes: ['clinical.'] },
  { id: 'patients', label: 'Pacientes', prefixes: ['patient.'] },
  { id: 'billing', label: 'Facturación y cobros', prefixes: ['invoice.', 'payment.'] },
  { id: 'consents', label: 'Consentimientos', prefixes: ['consent.'] },
  { id: 'people', label: 'Profesionales', prefixes: ['professional.'] },
  { id: 'system', label: 'Sistema y seguridad', prefixes: ['settings.', 'backup.', 'auth.', 'ai.'] },
];

const groupFor = (action: string): string => {
  if (action.startsWith('clinical.')) return 'clinical';
  if (action.startsWith('patient.')) return 'patients';
  if (action.startsWith('invoice.') || action.startsWith('payment.')) return 'billing';
  if (action.startsWith('consent.')) return 'consents';
  if (action.startsWith('professional.')) return 'people';
  return 'system';
};

const GROUP_STYLES: Record<string, string> = {
  clinical: 'border-violet-200 bg-violet-50 text-violet-700',
  patients: 'border-stone-200 bg-stone-100 text-stone-700',
  billing: 'border-nutri-200 bg-nutri-50 text-nutri-800',
  consents: 'border-logo-200 bg-logo-50 text-logo-800',
  people: 'border-psy-200 bg-psy-50 text-psy-800',
  system: 'border-fisio-200 bg-fisio-50 text-fisio-800',
};

const actionLabel = (action: string): string =>
  ACTION_LABELS[action] || action.replace(/\./g, ' · ').replace(/^\w/, c => c.toUpperCase());

const toDay = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const localToday = (): string => toDay(new Date().toISOString());

const Audit: React.FC<Props> = ({ user }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(500);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [actor, setActor] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dbService.getAuditLog(limit);
      setEntries(data);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el registro de auditoría.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [limit]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => map.set(e.userId, e.userName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter(entry => {
      if (group !== 'all' && groupFor(entry.action) !== group) return false;
      if (actor !== 'all' && entry.userId !== actor) return false;
      const day = toDay(entry.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!term) return true;
      const haystack = [
        entry.userName, entry.detail, entry.action, actionLabel(entry.action),
        entry.entity, entry.entityId || '', entry.role,
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [entries, search, group, actor, from, to]);

  const today = localToday();
  const todayCount = entries.filter(e => toDay(e.createdAt) === today).length;
  const clinicalCount = entries.filter(e => groupFor(e.action) === 'clinical').length;
  const uniqueActors = actors.length;

  const clearFilters = () => {
    setSearch(''); setGroup('all'); setActor('all'); setFrom(''); setTo('');
  };

  const exportCsv = () => {
    const rows: (string | number | null | undefined)[][] = [
      ['Fecha', 'Profesional', 'Rol', 'Acción', 'Entidad', 'ID entidad', 'ID paciente', 'Detalle'],
      ...filtered.map(e => [
        formatDate(e.createdAt, true),
        e.userName,
        e.role,
        actionLabel(e.action),
        e.entity,
        e.entityId || '',
        e.patientId || '',
        e.detail,
      ]),
    ];
    downloadCsv(`sinestesya_auditoria_${dateStamp()}`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seguridad y trazabilidad"
        title="Registro de auditoría"
        description="Constancia de accesos y modificaciones sobre datos administrativos y clínicos. El registro es de solo lectura desde la aplicación."
        icon={ShieldCheck}
        accent="bg-slate-700"
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button onClick={exportCsv} className={btnPrimary} disabled={!filtered.length}>
              <Download size={16} /> Exportar CSV
            </button>
          </>
        }
      />

      {isDemoMode && (
        <InlineAlert level="warning" title="Entorno de demostración">
          Los movimientos mostrados pertenecen a datos ficticios. En producción el registro se conserva en
          <span className="font-mono"> audit_log</span> y no debe editarse ni borrarse desde la interfaz.
        </InlineAlert>
      )}

      {error && (
        <InlineAlert
          level="danger"
          title="No se pudo cargar la auditoría"
          action={<button onClick={load} className={btnSecondary}>Reintentar</button>}
        >
          {error}
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Movimientos cargados" value={entries.length} icon={FileText} hint={`Últimos ${limit} registros`} />
        <StatCard title="Hoy" value={todayCount} icon={CalendarDays} tone="blue" hint="Accesos y cambios del día" />
        <StatCard title="Registros clínicos" value={clinicalCount} icon={LockKeyhole} tone="violet" hint="Creación y modificación" />
        <StatCard title="Profesionales implicados" value={uniqueActors} icon={Users} tone="green" hint="Con actividad en el periodo" />
      </div>

      <InlineAlert level="info" title="Trazabilidad inmutable">
        Cada entrada incluye profesional, rol, acción, entidad e identificador de paciente cuando procede.
        La aplicación no permite editar ni eliminar entradas. Conserva el histórico según la política de retención
        configurada en el centro y restringe el acceso mediante permisos granulares.
      </InlineAlert>

      <SectionCard
        title="Filtros"
        description="Acota por profesional, tipo de acción o periodo. Los filtros solo afectan a lo que ves, no al registro."
        actions={<button onClick={clearFilters} className={btnGhost}>Limpiar filtros</button>}
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Field label="Buscar" className="lg:col-span-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Profesional, detalle, entidad…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Tipo de acción">
            <select className={inputClass} value={group} onChange={e => setGroup(e.target.value)}>
              {ACTION_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="Profesional">
            <select className={inputClass} value={actor} onChange={e => setActor(e.target.value)}>
              <option value="all">Todos</option>
              {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </Field>
          <Field label="Desde">
            <input type="date" className={inputClass} value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" className={inputClass} value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
          <span>
            <strong className="text-stone-800">{filtered.length}</strong> de {entries.length} movimientos visibles
          </span>
          <label className="flex items-center gap-2">
            Cargar
            <select className={`${inputClass} w-auto py-1.5 text-xs`} value={limit} onChange={e => setLimit(Number(e.target.value))}>
              {[200, 500, 1000, 2000].map(n => <option key={n} value={n}>{n} registros</option>)}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Movimientos"
        description="Ordenados del más reciente al más antiguo."
        padded={false}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-stone-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
            Cargando auditoría…
          </div>
        ) : !filtered.length ? (
          <EmptyState
            icon={ShieldCheck}
            title="Sin movimientos que coincidan"
            description={entries.length ? 'Prueba a ampliar el periodo o quitar filtros.' : 'Todavía no se han registrado acciones auditables.'}
            action={entries.length ? <button onClick={clearFilters} className={btnSecondary}>Quitar filtros</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-3 py-3 font-semibold">Profesional</th>
                  <th className="px-3 py-3 font-semibold">Acción</th>
                  <th className="px-3 py-3 font-semibold">Detalle</th>
                  <th className="px-3 py-3 font-semibold">Entidad</th>
                  <th className="px-5 py-3 text-right font-semibold">Ver</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className="cursor-pointer border-b border-stone-50 transition-colors last:border-0 hover:bg-stone-50/70"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-stone-500">{formatDate(entry.createdAt, true)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-stone-800">{entry.userName}</p>
                      <p className="text-[11px] text-stone-400">{entry.role}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={GROUP_STYLES[groupFor(entry.action)]}>{actionLabel(entry.action)}</Badge>
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <p className="truncate text-stone-600" title={entry.detail}>{entry.detail}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-stone-500">
                      <p className="font-mono">{entry.entity}</p>
                      {entry.patientId && <p className="mt-0.5 font-mono text-[10px] text-stone-400">pac. {entry.patientId.slice(0, 8)}…</p>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(entry); }}
                        className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-white hover:text-stone-700"
                        aria-label={`Ver detalle de ${actionLabel(entry.action)}`}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-start gap-2 text-xs text-stone-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p>
          La auditoría no sustituye el consentimiento informado ni la historia clínica. Si detectas un acceso
          indebido, documenta el incidente y revisa los permisos del profesional afectado.
        </p>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? actionLabel(selected.action) : 'Detalle de auditoría'}
        subtitle={selected ? formatDate(selected.createdAt, true) : undefined}
        size="md"
        footer={<button onClick={() => setSelected(null)} className={btnSecondary}>Cerrar</button>}
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Detalle registrado</p>
              <p className="mt-1 text-sm text-stone-800">{selected.detail}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Profesional', selected.userName],
                ['Rol', selected.role],
                ['Acción técnica', selected.action],
                ['Entidad', selected.entity],
                ['ID de entidad', selected.entityId || '—'],
                ['ID de paciente', selected.patientId || '—'],
                ['Fecha y hora', formatDate(selected.createdAt, true)],
                ['Identificador', selected.id],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-stone-100 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</dt>
                  <dd className="mt-0.5 break-all text-sm text-stone-700">{value}</dd>
                </div>
              ))}
            </dl>
            <InlineAlert level="info">
              Entrada inmutable. No puede modificarse ni eliminarse desde la aplicación; cualquier corrección
              debe quedar registrada como un nuevo movimiento.
            </InlineAlert>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Audit;
