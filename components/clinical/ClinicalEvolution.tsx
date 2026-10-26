import React, { useMemo } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronRight, FileText, TrendingUp } from 'lucide-react';
import { ClinicalRecord, ClinicalRecordStatus, ClinicalSpecialty, UserRole } from '../../types';
import { formatDate, getRoleProfile, ADMIN_STATE_LABELS } from '../../constants';
import { Badge, EmptyState, SectionCard, cardClass } from '../ui';

interface Props {
  records: ClinicalRecord[];
  specialty: ClinicalSpecialty;
  onOpen?: (record: ClinicalRecord) => void;
  onReport?: (record: ClinicalRecord) => void;
}

const statusStyles: Record<ClinicalRecordStatus, string> = {
  borrador: 'bg-amber-50 text-amber-800 border-amber-200',
  completado: 'bg-logo-50 text-logo-800 border-logo-200',
  firmado: 'bg-fisio-50 text-fisio-800 border-fisio-200',
};

const ClinicalEvolution: React.FC<Props> = ({ records, specialty, onOpen, onReport }) => {
  const profile = getRoleProfile(specialty);
  const ordered = useMemo(
    () => [...records].filter(r => r.recordType !== 'informe').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [records]
  );

  const chartData = useMemo(() => {
    return ordered.map(record => {
      const date = new Date(record.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      if (specialty === UserRole.FISIOTERAPIA) {
        return { date, eva: Number(record.data?.eva) || 0, label: 'EVA' };
      }
      if (specialty === UserRole.NUTRICION) {
        return {
          date,
          weight: Number(record.data?.weight) || null,
          bmi: Number(record.data?.bmi) || null,
          label: 'Peso / IMC',
        };
      }
      const objectives = record.objectives || [];
      const progress = objectives.length
        ? Math.round(objectives.reduce((s, o) => s + (Number(o.progress) || 0), 0) / objectives.length)
        : null;
      return { date, progress, label: 'Progreso' };
    });
  }, [ordered, specialty]);

  const hasChart = chartData.some(d => (d as any).eva !== undefined || (d as any).weight || (d as any).progress !== null);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Evolución clínica"
        description={specialty === UserRole.FISIOTERAPIA
          ? 'Intensidad del dolor (EVA) registrada en cada sesión.'
          : specialty === UserRole.NUTRICION
            ? 'Peso e IMC a lo largo de las revisiones.'
            : 'Progreso medio de los objetivos definidos.'}
      >
        {ordered.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Todavía no hay evolución" description="Los datos aparecerán cuando se registren sesiones o valoraciones." />
        ) : !hasChart ? (
          <p className="py-6 text-center text-sm text-stone-400">Los registros actuales no contienen datos numéricos comparables.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ec" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a8a29e' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
                {specialty === UserRole.FISIOTERAPIA && (
                  <Line type="monotone" dataKey="eva" name="EVA" stroke={profile.hex} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                )}
                {specialty === UserRole.NUTRICION && (
                  <>
                    <Line type="monotone" dataKey="weight" name="Peso (kg)" stroke={profile.hex} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="bmi" name="IMC" stroke="#4f8a70" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </>
                )}
                {specialty !== UserRole.FISIOTERAPIA && specialty !== UserRole.NUTRICION && (
                  <Line type="monotone" dataKey="progress" name="Progreso (%)" stroke={profile.hex} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Historial de registros" description={`${records.length} registro(s) de ${profile.label}`} padded={false}>
        {records.length === 0 ? (
          <EmptyState icon={FileText} title="Sin registros" description="Aún no hay historia clínica de esta especialidad." />
        ) : (
          <div className="divide-y divide-stone-100">
            {[...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => (
              <div key={record.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <div className="w-24 shrink-0">
                  <p className="text-xs font-bold text-stone-700">{formatDate(record.date)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">v{record.version}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="border-stone-200 bg-stone-50 text-stone-600">{record.recordType}</Badge>
                    <Badge className={statusStyles[record.status]}>{record.status}</Badge>
                    {record.professionalName && <span className="text-[11px] text-stone-400">{record.professionalName}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-700">{record.summary || 'Sin síntesis.'}</p>
                  {record.objectives?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {record.objectives.slice(0, 3).map(o => (
                        <span key={o.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">
                          {o.description.length > 38 ? `${o.description.slice(0, 38)}…` : o.description} · {o.progress}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {onReport && (
                    <button type="button" onClick={() => onReport(record)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                      <FileText size={13} /> Informe
                    </button>
                  )}
                  {onOpen && (
                    <button type="button" onClick={() => onOpen(record)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                      Abrir <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default ClinicalEvolution;
