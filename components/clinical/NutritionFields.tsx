import React from 'react';
import { Apple, Baby, Calculator, ClipboardList, Plus, Trash2, Utensils } from 'lucide-react';
import { ClinicalObjective } from '../../types';
import {
  NUTRITION_DIETS, NUTRITION_GOALS, NUTRITION_MEAL_SLOTS,
} from '../../data/clinicalCatalog';
import { FormSection, TextArea, TextInput, SelectInput, Chips, ObjectiveEditor } from './shared';
import { Toggle, btnGhost, inputClass } from '../ui';

interface Props {
  data: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  objectives: ClinicalObjective[];
  onObjectivesChange: (objectives: ClinicalObjective[]) => void;
}

const NutritionFields: React.FC<Props> = ({ data, onChange, objectives, onObjectivesChange }) => {
  const plan = data.plan || { meals: [], recommendations: '' };
  const meals: any[] = Array.isArray(plan.meals) ? plan.meals : [];

  const recomputeBmi = (patch: Record<string, any>) => {
    const next = { ...data, ...patch };
    const weight = Number(String(next.weight).replace(',', '.'));
    const heightCm = Number(String(next.height).replace(',', '.'));
    if (weight > 0 && heightCm > 0) {
      const bmi = weight / Math.pow(heightCm / 100, 2);
      onChange({ ...patch, bmi: Math.round(bmi * 10) / 10 });
    } else {
      onChange({ ...patch, bmi: '' });
    }
  };

  const updatePlan = (patch: Record<string, any>) => onChange({ plan: { ...plan, ...patch } });

  const updateMeal = (index: number, patch: Record<string, any>) => {
    updatePlan({ meals: meals.map((m, i) => i === index ? { ...m, ...patch } : m) });
  };

  const addMeal = () => {
    const available = NUTRITION_MEAL_SLOTS.find(slot => !meals.some(m => m.slot === slot)) || 'Comida';
    updatePlan({
      meals: [...meals, { slot: available, foods: '', quantities: '', alternatives: '', recipe: '' }],
    });
  };

  return (
    <div className="space-y-4">
      <FormSection title="Motivo e historia dietética" icon={<ClipboardList size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextArea label="Motivo de consulta" value={data.motivo} onChange={v => onChange({ motivo: v })} rows={2} placeholder="Objetivo del paciente, demanda y expectativas" />
          <TextArea label="Antecedentes personales" value={data.antecedentes} onChange={v => onChange({ antecedentes: v })} rows={2} placeholder="Patologías, medicación, cirugías, análisis relevantes" />
          <TextInput label="Alergias alimentarias" value={data.allergies} onChange={v => onChange({ allergies: v })} placeholder="Ej. frutos secos, marisco" />
          <TextInput label="Intolerancias" value={data.intolerances} onChange={v => onChange({ intolerances: v })} placeholder="Ej. lactosa, gluten" />
          <TextArea label="Historia dietética" value={data.dietaryHistory} onChange={v => onChange({ dietaryHistory: v })} rows={2} placeholder="Tipo de dieta, frecuencia de alimentos, cambios recientes" />
          <TextArea label="Hábitos y horarios" value={data.habits} onChange={v => onChange({ habits: v })} rows={2} placeholder="Comidas fuera de casa, picoteo, sueño, alcohol…" />
          <TextInput label="Horario habitual de comidas" value={data.mealSchedule} onChange={v => onChange({ mealSchedule: v })} placeholder="Desayuno 7:30 · Comida 14:00 · Cena 21:00" className="md:col-span-2" />
          <TextArea label="Preferencias y rechazos" value={data.preferences} onChange={v => onChange({ preferences: v })} rows={2} />
          <TextArea label="Actividad física" value={data.physicalActivity} onChange={v => onChange({ physicalActivity: v })} rows={2} />
          <TextInput label="Hidratación" value={data.hydration} onChange={v => onChange({ hydration: v })} placeholder="Ej. 1,5 L/día" />
          <SelectInput
            label="Objetivo nutricional"
            value={data.goal}
            onChange={v => onChange({ goal: v })}
            options={NUTRITION_GOALS.map(g => ({ value: g, label: g }))}
            placeholder="Seleccionar objetivo"
          />
          <SelectInput
            label="Tipo de dieta"
            value={data.dietType || ''}
            onChange={v => onChange({ dietType: v })}
            options={NUTRITION_DIETS.map(d => ({ value: d, label: d }))}
            placeholder="Seleccionar dieta"
          />
        </div>
      </FormSection>

      <FormSection title="Antropometría" description="Los valores se guardan en cada revisión para comparar la evolución." icon={<Calculator size={16} />}>
        <div className="space-y-4">
          <Toggle
            checked={!!data.pediatric}
            onChange={v => onChange({ pediatric: v })}
            label="Paciente pediátrico"
            description="Activa referencias de crecimiento y percentiles adecuados a la edad."
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <TextInput label="Peso (kg)" type="number" step={0.1} value={data.weight} onChange={v => recomputeBmi({ weight: v })} placeholder="0,0" />
            <TextInput label="Talla (cm)" type="number" step={0.1} value={data.height} onChange={v => recomputeBmi({ height: v })} placeholder="0" />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">IMC</label>
              <div className={`${inputClass} flex items-center justify-between bg-stone-50`}>
                <span className="font-bold text-stone-800">{data.bmi || '—'}</span>
                <span className="text-[10px] text-stone-400">kg/m²</span>
              </div>
            </div>
            <TextInput label="Cintura (cm)" type="number" step={0.1} value={data.waist} onChange={v => onChange({ waist: v })} />
            <TextInput label="Cadera (cm)" type="number" step={0.1} value={data.hip} onChange={v => onChange({ hip: v })} />
            <TextInput label="Brazo (cm)" type="number" step={0.1} value={data.arm} onChange={v => onChange({ arm: v })} />
            <TextInput label="Muslo (cm)" type="number" step={0.1} value={data.thigh} onChange={v => onChange({ thigh: v })} />
            <TextInput label="Grasa corporal (%)" type="number" step={0.1} value={data.bodyFat} onChange={v => onChange({ bodyFat: v })} />
            <TextInput label="Masa muscular (kg)" type="number" step={0.1} value={data.muscleMass} onChange={v => onChange({ muscleMass: v })} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Pliegues cutáneos (mm)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['triceps', 'Tricipital'], ['subescapular', 'Subescapular'],
                ['suprailiaco', 'Suprailíaco'], ['abdominal', 'Abdominal'],
              ].map(([key, label]) => (
                <TextInput
                  key={key}
                  label={label}
                  type="number"
                  step={0.1}
                  value={data.skinfolds?.[key] ?? ''}
                  onChange={v => onChange({ skinfolds: { ...(data.skinfolds || {}), [key]: v } })}
                />
              ))}
            </div>
          </div>

          {data.pediatric && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-nutri-200 bg-nutri-50/60 p-3 sm:grid-cols-2">
              <TextInput label="Referencia de crecimiento" value={data.growthReference} onChange={v => onChange({ growthReference: v })} placeholder="Ej. OMS 5-19 años" />
              <TextInput label="Percentil / z-score" value={data.growthPercentile} onChange={v => onChange({ growthPercentile: v })} placeholder="Ej. IMC percentil 65" />
              <p className="text-[11px] leading-relaxed text-nutri-800 sm:col-span-2">
                <Baby size={12} className="mr-1 inline" />
                En menores, interpreta siempre con referencias validadas para edad y sexo. Registra la fuente utilizada.
              </p>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Plan alimentario" description="Cada versión conserva su historial en la evolución del paciente." icon={<Utensils size={16} />}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-nutri-50 px-2.5 py-1 text-xs font-bold text-nutri-800">Versión {data.planVersion || 1}</span>
              <button type="button" onClick={() => onChange({ planVersion: (Number(data.planVersion) || 1) + 1 })} className={`${btnGhost} text-xs`}>
                Nueva versión
              </button>
            </div>
            <p className="text-[11px] text-stone-400">No elimines la versión anterior: queda registrada en la historia.</p>
          </div>

          <div className="space-y-2">
            {meals.length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-6 text-center">
                <Apple size={20} className="mx-auto mb-1.5 text-stone-300" />
                <p className="text-xs text-stone-500">Añade las tomas del plan alimentario.</p>
              </div>
            )}
            {meals.map((meal, index) => (
              <div key={index} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <select
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold text-stone-700"
                    value={meal.slot || 'Comida'}
                    onChange={e => updateMeal(index, { slot: e.target.value })}
                  >
                    {NUTRITION_MEAL_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                  <button type="button" onClick={() => updatePlan({ meals: meals.filter((_, i) => i !== index) })} className="ml-auto rounded-lg p-1 text-stone-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input className={`${inputClass} py-2 text-sm`} placeholder="Alimentos" value={meal.foods || ''} onChange={e => updateMeal(index, { foods: e.target.value })} />
                  <input className={`${inputClass} py-2 text-sm`} placeholder="Cantidades" value={meal.quantities || ''} onChange={e => updateMeal(index, { quantities: e.target.value })} />
                  <input className={`${inputClass} py-2 text-sm`} placeholder="Alternativas" value={meal.alternatives || ''} onChange={e => updateMeal(index, { alternatives: e.target.value })} />
                  <input className={`${inputClass} py-2 text-sm`} placeholder="Receta / preparación (opcional)" value={meal.recipe || ''} onChange={e => updateMeal(index, { recipe: e.target.value })} />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addMeal} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-semibold text-stone-500 hover:border-stone-400 hover:text-stone-800">
            <Plus size={14} /> Añadir toma
          </button>

          <TextArea
            label="Recomendaciones del plan"
            value={plan.recommendations}
            onChange={v => updatePlan({ recommendations: v })}
            rows={3}
            placeholder="Pautas generales, educación alimentaria, alimentos a evitar…"
          />
        </div>
      </FormSection>

      <FormSection title="Seguimiento" icon={<ClipboardList size={16} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectInput
            label="Adherencia al plan"
            value={data.adherence}
            onChange={v => onChange({ adherence: v })}
            options={['Alta', 'Media', 'Baja', 'No valorable'].map(v => ({ value: v, label: v }))}
            placeholder="Seleccionar"
          />
          <TextInput label="Dificultades detectadas" value={data.difficulties} onChange={v => onChange({ difficulties: v })} />
          <TextArea label="Síntomas digestivos o clínicos" value={data.symptoms} onChange={v => onChange({ symptoms: v })} rows={2} />
          <TextArea label="Contexto familiar y social" value={data.familyContext} onChange={v => onChange({ familyContext: v })} rows={2} placeholder="Especialmente relevante en pacientes pediátricos" />
        </div>
      </FormSection>

      <FormSection title="Objetivos nutricionales" icon={<Apple size={16} />}>
        <ObjectiveEditor objectives={objectives} onChange={onObjectivesChange} />
      </FormSection>
    </div>
  );
};

export default NutritionFields;
