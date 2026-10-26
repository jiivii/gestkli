import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, ClipboardList, FlaskConical, Plus, ShieldAlert, Target, Trash2,
} from 'lucide-react';
import { ClinicalObjective } from '../../types';
import {
  PSYCH_AREAS, PSYCH_RISK_LEVELS, PSYCH_TECHNIQUES, PSYCH_TEST_BANK,
} from '../../data/clinicalCatalog';
import { FormSection, TextArea, TextInput, SelectInput, Chips, ObjectiveEditor } from './shared';
import { Toggle, btnGhost, inputClass } from '../ui';

interface Props {
  data: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  objectives: ClinicalObjective[];
  onObjectivesChange: (objectives: ClinicalObjective[]) => void;
}

const LEVELS = [
  { value: 'sin_dificultad', label: 'Sin dificultad' },
  { value: 'leve', label: 'Leve' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'grave', label: 'Grave' },
  { value: 'no_valorado', label: 'No valorado' },
];

const PsychologyFields: React.FC<Props> = ({ data, onChange, objectives, onObjectivesChange }) => {
  const tests: any[] = Array.isArray(data.tests) ? data.tests : [];
  const risk = data.risk || {};
  const [testArea, setTestArea] = useState('');
  const [selectedTest, setSelectedTest] = useState('');
  const [reviewerDraft, setReviewerDraft] = useState<Record<string, string>>({});

  const filteredBank = useMemo(
    () => PSYCH_TEST_BANK.filter(t => !testArea || t.area === testArea),
    [testArea]
  );

  const updateTest = (id: string, patch: Record<string, any>) => {
    onChange({ tests: tests.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  const addTest = () => {
    const definition = PSYCH_TEST_BANK.find(t => t.id === selectedTest);
    if (!definition) return;
    onChange({
      tests: [
        ...tests,
        {
          id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          testId: definition.id,
          name: definition.name,
          area: definition.area,
          version: definition.version,
          date: new Date().toISOString().slice(0, 10),
          answers: '',
          rawScore: '',
          percentile: '',
          result: '',
          autoCorrected: false,
          reviewed: false,
          reviewerNote: '',
          licenseNote: definition.licenseNote,
        },
      ],
    });
    setSelectedTest('');
  };

  const highRisk = ['moderado', 'alto', 'inminente'].includes(risk.level);

  return (
    <div className="space-y-4">
      <FormSection title="Motivo e historia" icon={<Brain size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextArea label="Motivo de consulta" value={data.motivo} onChange={v => onChange({ motivo: v })} rows={2} placeholder="Demanda, expectativas y contexto de la consulta" className="md:col-span-2" />
          <TextArea label="Historia personal" value={data.personalHistory} onChange={v => onChange({ personalHistory: v })} rows={2} />
          <TextArea label="Historia familiar" value={data.familyHistory} onChange={v => onChange({ familyHistory: v })} rows={2} />
          <TextArea label="Historia médica" value={data.medicalHistory} onChange={v => onChange({ medicalHistory: v })} rows={2} />
          <TextArea label="Historia psicológica" value={data.psychologicalHistory} onChange={v => onChange({ psychologicalHistory: v })} rows={2} placeholder="Tratamientos previos, evaluaciones, ingresos…" />
        </div>
      </FormSection>

      <FormSection title="Áreas de exploración" icon={<ClipboardList size={16} />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PSYCH_AREAS.map(area => (
            <div key={area.key} className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2">
              <span className="text-xs font-medium text-stone-700">{area.label}</span>
              <select
                className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-600"
                value={data.areas?.[area.key] || 'no_valorado'}
                onChange={e => onChange({ areas: { ...(data.areas || {}), [area.key]: e.target.value } })}
              >
                {LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <TextArea
          label="Formulación clínica"
          value={data.formulation}
          onChange={v => onChange({ formulation: v })}
          rows={3}
          placeholder="Hipótesis explicativa: factores predisponentes, precipitantes y mantenedores"
          className="mt-3"
        />
      </FormSection>

      <FormSection title="Riesgo y protección" description="Revisa este apartado en cada sesión. No se automatiza ninguna decisión clínica." icon={<ShieldAlert size={16} />}>
        <div className="space-y-3">
          <SelectInput
            label="Nivel de riesgo"
            value={risk.level || 'sin_riesgo'}
            onChange={v => onChange({ risk: { ...risk, level: v } })}
            options={PSYCH_RISK_LEVELS}
          />
          {highRisk && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Activa el protocolo de riesgo del centro.</p>
                <p className="mt-0.5 text-red-700">Documenta la evaluación, las medidas adoptadas y la coordinación realizada. Si existe riesgo inminente, prioriza la seguridad y los recursos de urgencia.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SelectInput label="Ideación autolítica" value={risk.suicidal || 'No'} onChange={v => onChange({ risk: { ...risk, suicidal: v } })} options={['No', 'Pasiva', 'Activa sin plan', 'Activa con plan'].map(v => ({ value: v, label: v }))} />
            <SelectInput label="Autolesiones" value={risk.selfHarm || 'No'} onChange={v => onChange({ risk: { ...risk, selfHarm: v } })} options={['No', 'Ocasionales', 'Frecuentes', 'Recientes'].map(v => ({ value: v, label: v }))} />
            <TextInput label="Factores de protección" value={risk.protection} onChange={v => onChange({ risk: { ...risk, protection: v } })} className="md:col-span-2" />
            <TextArea label="Notas de riesgo y plan de seguridad" value={risk.notes} onChange={v => onChange({ risk: { ...risk, notes: v } })} rows={2} className="md:col-span-2" />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Pruebas psicométricas"
        description="Banco de metadatos. No se incluyen ítems, claves ni baremos licenciados."
        icon={<FlaskConical size={16} />}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p>Registra únicamente resultados y observaciones. La corrección automática permanece desactivada: requiere licencia vigente, baremos válidos y revisión del profesional.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select className={`${inputClass} sm:w-56`} value={testArea} onChange={e => { setTestArea(e.target.value); setSelectedTest(''); }}>
              <option value="">Todas las áreas</option>
              {PSYCH_AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <select className={`${inputClass} flex-1`} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
              <option value="">Seleccionar prueba ({filteredBank.length})</option>
              {filteredBank.map(t => (
                <option key={t.id} value={t.id}>{t.name} · {t.fullName}{t.licensed ? ' · licencia' : ''}</option>
              ))}
            </select>
            <button type="button" onClick={addTest} disabled={!selectedTest} className={`${btnGhost} shrink-0 border border-stone-200`}>
              <Plus size={14} /> Añadir
            </button>
          </div>

          {tests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-5 text-center text-xs text-stone-500">
              No hay pruebas registradas en este registro clínico.
            </p>
          ) : (
            <div className="space-y-2">
              {tests.map(test => (
                <div key={test.id} className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-stone-800">{test.name} <span className="text-[11px] font-normal text-stone-400">· {test.version}</span></p>
                      <p className="text-[11px] text-stone-400">{PSYCH_AREAS.find(a => a.key === test.area)?.label || test.area}</p>
                    </div>
                    <button type="button" onClick={() => onChange({ tests: tests.filter(t => t.id !== test.id) })} className="rounded-lg p-1 text-stone-300 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <TextInput label="Fecha" type="date" value={test.date} onChange={v => updateTest(test.id, { date: v })} />
                    <TextInput label="Puntuación directa" value={test.rawScore} onChange={v => updateTest(test.id, { rawScore: v })} />
                    <TextInput label="Percentil" value={test.percentile} onChange={v => updateTest(test.id, { percentile: v })} />
                    <TextInput label="Resultado / interpretación" value={test.result} onChange={v => updateTest(test.id, { result: v })} />
                    <TextArea label="Registro de respuestas (sin ítems)" value={test.answers} onChange={v => updateTest(test.id, { answers: v })} rows={2} className="col-span-2" placeholder="Ej. ejemplar autorizado, fecha de aplicación, condiciones" />
                    <div className="col-span-2 space-y-2">
                      <Toggle checked={!!test.reviewed} onChange={v => updateTest(test.id, { reviewed: v })} label="Revisado por el profesional" />
                      <input className={`${inputClass} py-1.5 text-xs`} placeholder="Nota de revisión" value={reviewerDraft[test.id] ?? test.reviewerNote ?? ''} onChange={e => { setReviewerDraft(s => ({ ...s, [test.id]: e.target.value })); updateTest(test.id, { reviewerNote: e.target.value }); }} />
                    </div>
                  </div>
                  <p className="mt-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-stone-500">{test.licenseNote}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Plan de intervención" icon={<Target size={16} />}>
        <div className="space-y-3">
          <ObjectiveEditor objectives={objectives} onChange={onObjectivesChange} compact />
          <TextArea label="Plan terapéutico" value={typeof data.plan === 'string' ? data.plan : ''} onChange={v => onChange({ plan: v })} rows={3} placeholder="Enfoque, frecuencia, estructura de las sesiones" />
          <Chips label="Técnicas" values={data.techniques || []} options={PSYCH_TECHNIQUES} onChange={v => onChange({ techniques: v })} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextArea label="Respuesta a la intervención" value={data.response} onChange={v => onChange({ response: v })} rows={2} />
            <TextArea label="Tareas entre sesiones" value={data.homework} onChange={v => onChange({ homework: v })} rows={2} />
            <TextArea label="Prevención de recaídas" value={data.relapsePrevention} onChange={v => onChange({ relapsePrevention: v })} rows={2} />
            <TextArea label="Derivaciones y coordinación" value={data.referrals} onChange={v => onChange({ referrals: v })} rows={2} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Borrador de informe" description="Texto de trabajo; el informe final se genera desde el botón de informes." icon={<ClipboardList size={16} />}>
        <TextArea label="Contenido de trabajo" value={data.draftReport} onChange={v => onChange({ draftReport: v })} rows={5} />
      </FormSection>
    </div>
  );
};

export default PsychologyFields;
