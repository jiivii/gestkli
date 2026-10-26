import React from 'react';
import { BookOpen, ClipboardCheck, MessageCircle, School, Target, Users } from 'lucide-react';
import { ClinicalObjective } from '../../types';
import { SPEECH_AREAS, SPEECH_HELP_LEVELS } from '../../data/clinicalCatalog';
import { FormSection, TextArea, TextInput, SelectInput, ObjectiveEditor } from './shared';
import { Toggle, inputClass } from '../ui';

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

const SpeechFields: React.FC<Props> = ({ data, onChange, objectives, onObjectivesChange }) => {
  const results = data.objectiveResults || {};
  const updateResult = (objectiveId: string, patch: Record<string, any>) => {
    onChange({ objectiveResults: { ...results, [objectiveId]: { ...(results[objectiveId] || {}), ...patch } } });
  };

  return (
    <div className="space-y-4">
      <FormSection title="Datos generales" icon={<ClipboardCheck size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectInput
            label="Tipo de paciente"
            value={data.patientType || 'infantil'}
            onChange={v => onChange({ patientType: v })}
            options={[
              { value: 'infantil', label: 'Infantil' },
              { value: 'adolescente', label: 'Adolescente' },
              { value: 'adulto', label: 'Adulto' },
              { value: 'geriatrico', label: 'Geriátrico' },
            ]}
          />
          <TextInput label="Motivo de consulta" value={data.motivo} onChange={v => onChange({ motivo: v })} placeholder="Demanda principal y expectativas" />
          <TextArea label="Antecedentes" value={data.antecedentes} onChange={v => onChange({ antecedentes: v })} rows={2} placeholder="Desarrollo, salud, audición, episodios previos…" />
          <TextArea label="Contexto familiar" value={data.familyContext} onChange={v => onChange({ familyContext: v })} rows={2} placeholder="Lenguas del entorno, estimulación, dinámica familiar" />
          <TextArea label="Contexto escolar / laboral" value={data.schoolContext} onChange={v => onChange({ schoolContext: v })} rows={2} className="md:col-span-2" />
        </div>
      </FormSection>

      <FormSection title="Áreas de evaluación" description="Valora cada área y amplía la información en los campos de exploración." icon={<MessageCircle size={16} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SPEECH_AREAS.map(area => (
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

          <details className="rounded-xl border border-stone-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-stone-600">Exploración descriptiva por área</summary>
            <div className="grid grid-cols-1 gap-3 border-t border-stone-100 p-4 md:grid-cols-2">
              {[
                ['comprehension', 'Comprensión'], ['expression', 'Expresión'],
                ['vocabulary', 'Vocabulario'], ['grammar', 'Gramática y morfosintaxis'],
                ['articulation', 'Articulación'], ['phonology', 'Fonología'],
                ['pragmatics', 'Pragmática'], ['speech', 'Habla / inteligibilidad'],
                ['voice', 'Voz'], ['fluency', 'Fluidez'],
                ['reading', 'Lectura'], ['writing', 'Escritura'],
                ['orofacial', 'Motricidad orofacial'], ['feeding', 'Alimentación'],
                ['swallowing', 'Deglución'],
              ].map(([key, label]) => (
                <TextArea key={key} label={label} value={data[key]} onChange={v => onChange({ [key]: v })} rows={2} />
              ))}
            </div>
          </details>

          <TextArea label="Pruebas y procedimientos de evaluación" value={data.tests} onChange={v => onChange({ tests: v })} rows={2} placeholder="Instrumentos utilizados, observación, registro de lenguaje espontáneo…" />
        </div>
      </FormSection>

      <FormSection title="Objetivos y resultados de la sesión" description="Cada objetivo debe tener un resultado medible." icon={<Target size={16} />}>
        <div className="space-y-4">
          <ObjectiveEditor objectives={objectives} onChange={onObjectivesChange} compact />
          {objectives.length > 0 && (
            <div className="space-y-2">
              {objectives.map(objective => {
                const result = results[objective.id] || {};
                const attempts = Number(result.attempts) || 0;
                const correct = Number(result.correct) || 0;
                const pct = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
                return (
                  <div key={objective.id} className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                    <p className="mb-2 text-xs font-semibold text-stone-700">{objective.description || 'Objetivo sin descripción'}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-400">Aciertos</label>
                        <input type="number" min={0} className={`${inputClass} py-1.5 text-sm`} value={result.correct ?? ''} onChange={e => updateResult(objective.id, { correct: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-400">Ensayos</label>
                        <input type="number" min={0} className={`${inputClass} py-1.5 text-sm`} value={result.attempts ?? ''} onChange={e => updateResult(objective.id, { attempts: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-400">Ayuda</label>
                        <select className={`${inputClass} py-1.5 text-sm`} value={result.help || ''} onChange={e => updateResult(objective.id, { help: e.target.value })}>
                          <option value="">—</option>
                          {SPEECH_HELP_LEVELS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-400">Observaciones</label>
                        <input className={`${inputClass} py-1.5 text-sm`} value={result.notes || ''} onChange={e => updateResult(objective.id, { notes: e.target.value })} placeholder="Generalización, errores…" />
                      </div>
                    </div>
                    {attempts > 0 && (
                      <p className="mt-1.5 text-[11px] font-semibold text-stone-500">Resultado: {correct}/{attempts} · {pct}%</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Intervención y tareas" icon={<BookOpen size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextArea label="Actividades de la sesión" value={data.activities} onChange={v => onChange({ activities: v })} rows={2} />
          <TextArea label="Materiales utilizados" value={data.materials} onChange={v => onChange({ materials: v })} rows={2} />
          <TextArea label="Tareas para casa" value={data.homeTasks} onChange={v => onChange({ homeTasks: v })} rows={2} className="md:col-span-2" />
        </div>
      </FormSection>

      <FormSection title="Coordinación" description="La coordinación con terceros requiere autorización previa." icon={<Users size={16} />}>
        <div className="space-y-3">
          <Toggle
            checked={!!data.coordinationAuth}
            onChange={v => onChange({ coordinationAuth: v })}
            label="Autorización de coordinación"
            description="Familia, centro escolar, pediatría u otros profesionales."
          />
          <TextArea label="Notas de coordinación" value={data.coordinationNotes} onChange={v => onChange({ coordinationNotes: v })} rows={2} />
          {data.coordinationAuth && (
            <p className="flex items-start gap-2 rounded-lg border border-logo-200 bg-logo-50 px-3 py-2 text-[11px] text-logo-800">
              <School size={13} className="mt-0.5 shrink-0" />
              Registra únicamente la información necesaria y comparte solo con las personas autorizadas.
            </p>
          )}
        </div>
      </FormSection>
    </div>
  );
};

export default SpeechFields;
