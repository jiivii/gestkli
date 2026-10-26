import React from 'react';
import { Activity, ClipboardCheck, Dumbbell, MapPin, Stethoscope } from 'lucide-react';
import { ClinicalObjective } from '../../types';
import { PHYSIO_EXERCISES, PHYSIO_TECHNIQUES } from '../../data/clinicalCatalog';
import { FormSection, TextArea, TextInput, Chips, ObjectiveEditor } from './shared';
import BodyMap from './BodyMap';

interface Props {
  data: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  objectives: ClinicalObjective[];
  onObjectivesChange: (objectives: ClinicalObjective[]) => void;
}

const PhysioFields: React.FC<Props> = ({ data, onChange, objectives, onObjectivesChange }) => {
  const eva = Number(data.eva) || 0;

  return (
    <div className="space-y-4">
      <FormSection title="Motivo y antecedentes" icon={<ClipboardCheck size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextArea
            label="Motivo de consulta"
            value={data.motivo}
            onChange={v => onChange({ motivo: v })}
            placeholder="Qué le trae, desde cuándo y cómo afecta a su día a día"
            rows={3}
          />
          <TextArea
            label="Antecedentes y contexto"
            value={data.antecedentes}
            onChange={v => onChange({ antecedentes: v })}
            placeholder="Episodios previos, cirugías, medicación, trabajo, deporte…"
            rows={3}
          />
        </div>
      </FormSection>

      <FormSection
        title="Dolor y mapa corporal"
        description="Marca las zonas dolorosas y registra la intensidad percibida."
        icon={<MapPin size={16} />}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Intensidad EVA</label>
              <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
                eva >= 7 ? 'bg-red-50 text-red-700' : eva >= 4 ? 'bg-amber-50 text-amber-700' : 'bg-fisio-50 text-fisio-700'
              }`}>
                {eva} / 10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={eva}
              onChange={e => onChange({ eva: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer accent-stone-800"
            />
            <div className="mt-1 flex justify-between text-[10px] font-medium text-stone-400">
              <span>Sin dolor</span><span>Moderado</span><span>Máximo</span>
            </div>
          </div>

          <BodyMap
            selected={Array.isArray(data.painZones) ? data.painZones : []}
            onChange={zones => onChange({ painZones: zones })}
            eva={eva}
          />

          <TextArea
            label="Localización y características del dolor"
            value={data.painLocation}
            onChange={v => onChange({ painLocation: v })}
            placeholder="Irradiación, tipo de dolor, factores que lo alivian o agravan…"
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection title="Exploración física" description="Hallazgos objetivos de la valoración." icon={<Stethoscope size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextArea label="Movilidad articular" value={data.mobility} onChange={v => onChange({ mobility: v })} rows={2} placeholder="Rangos, limitaciones y dolor al movimiento" />
          <TextArea label="Fuerza muscular" value={data.strength} onChange={v => onChange({ strength: v })} rows={2} placeholder="Balance muscular, pruebas isométricas…" />
          <TextArea label="Sensibilidad" value={data.sensitivity} onChange={v => onChange({ sensitivity: v })} rows={2} placeholder="Sensibilidad superficial, alteraciones…" />
          <TextArea label="Postura y control motor" value={data.posture} onChange={v => onChange({ posture: v })} rows={2} placeholder="Alineación, compensaciones, control lumbopélvico…" />
          <TextArea
            label="Pruebas funcionales y ortopédicas"
            value={data.functionalTests}
            onChange={v => onChange({ functionalTests: v })}
            rows={2}
            placeholder="Lasègue, Schober, tests específicos y resultados"
            className="md:col-span-2"
          />
          <TextArea
            label="Diagnóstico fisioterapéutico / impresión clínica"
            value={data.diagnosis}
            onChange={v => onChange({ diagnosis: v })}
            rows={2}
            placeholder="Síntesis del cuadro y razonamiento clínico"
            className="md:col-span-2"
          />
        </div>
      </FormSection>

      <FormSection title="Tratamiento de la sesión" icon={<Activity size={16} />}>
        <div className="space-y-3">
          <Chips label="Técnicas aplicadas" values={data.techniques || []} options={PHYSIO_TECHNIQUES} onChange={v => onChange({ techniques: v })} />
          <Chips label="Ejercicios terapéuticos" values={data.exercises || []} options={PHYSIO_EXERCISES} onChange={v => onChange({ exercises: v })} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextArea label="Recomendaciones y pautas domiciliarias" value={data.recommendations} onChange={v => onChange({ recommendations: v })} rows={3} />
            <TextArea label="Incidencias de la sesión" value={data.incidents} onChange={v => onChange({ incidents: v })} rows={3} placeholder="Reacciones, tolerancia, cambios de plan…" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Objetivos terapéuticos" description="Define metas medibles y actualiza su progreso en cada sesión." icon={<Dumbbell size={16} />}>
        <ObjectiveEditor objectives={objectives} onChange={onObjectivesChange} />
      </FormSection>
    </div>
  );
};

export default PhysioFields;
