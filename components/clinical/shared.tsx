import React from 'react';
import { Plus, Trash2, Target } from 'lucide-react';
import { ClinicalObjective } from '../../types';
import { Field, inputClass, ProgressBar, btnGhost, btnSecondary } from '../ui';

export const FormSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, description, children, icon, className = '' }) => (
  <section className={`rounded-2xl border border-stone-200/80 bg-white ${className}`}>
    <div className="flex items-start gap-2.5 border-b border-stone-100 px-4 py-3">
      {icon && <div className="mt-0.5 text-stone-400">{icon}</div>}
      <div>
        <h3 className="text-sm font-bold text-stone-800">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export const TextInput: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', className = '', min, max, step, hint, required }) => (
  <Field label={label} className={className} hint={hint} required={required}>
    <input
      type={type}
      className={inputClass}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
    />
  </Field>
);

export const TextArea: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  hint?: string;
}> = ({ label, value, onChange, placeholder, rows = 3, className = '', hint }) => (
  <Field label={label} className={className} hint={hint}>
    <textarea
      className={`${inputClass} resize-y`}
      rows={rows}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </Field>
);

export const SelectInput: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  hint?: string;
}> = ({ label, value, onChange, options, placeholder, className = '', hint }) => (
  <Field label={label} className={className} hint={hint}>
    <select className={`${inputClass} bg-white`} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

export const Chips: React.FC<{
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  hint?: string;
}> = ({ label, values, options, onChange, hint }) => {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
  };
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-stone-800 bg-stone-800 text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </Field>
  );
};

export const ObjectiveEditor: React.FC<{
  objectives: ClinicalObjective[];
  onChange: (objectives: ClinicalObjective[]) => void;
  compact?: boolean;
}> = ({ objectives, onChange, compact }) => {
  const update = (id: string, patch: Partial<ClinicalObjective>) => {
    onChange(objectives.map(o => o.id === id ? { ...o, ...patch } : o));
  };
  const add = () => {
    onChange([...objectives, {
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: '',
      area: '',
      target: '',
      progress: 0,
      status: 'activo',
    }]);
  };
  return (
    <div className="space-y-3">
      {objectives.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-5 text-center">
          <Target size={20} className="mx-auto mb-1.5 text-stone-300" />
          <p className="text-xs text-stone-500">Define objetivos individuales y medibles para poder evaluar la evolución.</p>
        </div>
      )}
      {objectives.map((objective, index) => (
        <div key={objective.id} className="rounded-xl border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Objetivo {index + 1}</span>
            <button type="button" onClick={() => onChange(objectives.filter(o => o.id !== objective.id))} className="rounded-lg p-1 text-stone-300 hover:bg-red-50 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="space-y-2">
            <input
              className={`${inputClass} py-2`}
              placeholder="Descripción del objetivo (ej. reducir dolor a ≤3/10)"
              value={objective.description}
              onChange={e => update(objective.id, { description: e.target.value })}
            />
            {!compact && (
              <div className="grid grid-cols-2 gap-2">
                <input className={`${inputClass} py-2 text-xs`} placeholder="Área" value={objective.area || ''} onChange={e => update(objective.id, { area: e.target.value })} />
                <input className={`${inputClass} py-2 text-xs`} placeholder="Meta medible" value={objective.target || ''} onChange={e => update(objective.id, { target: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100} step={5}
                value={objective.progress}
                onChange={e => {
                  const progress = Number(e.target.value);
                  update(objective.id, {
                    progress,
                    status: progress >= 100 ? 'conseguido' : progress === 0 ? 'revisar' : 'activo',
                  });
                }}
                className="h-1.5 flex-1 cursor-pointer accent-stone-800"
              />
              <span className="w-10 text-right text-xs font-bold text-stone-600">{objective.progress}%</span>
              <select
                className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-600"
                value={objective.status}
                onChange={e => update(objective.id, { status: e.target.value as ClinicalObjective['status'] })}
              >
                <option value="activo">Activo</option>
                <option value="conseguido">Conseguido</option>
                <option value="revisar">Revisar</option>
              </select>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-semibold text-stone-500 hover:border-stone-400 hover:text-stone-800">
        <Plus size={14} /> Añadir objetivo
      </button>
    </div>
  );
};

export const ObjectiveProgress: React.FC<{ objectives: ClinicalObjective[] }> = ({ objectives }) => {
  if (!objectives.length) return <p className="text-xs text-stone-400">Sin objetivos definidos.</p>;
  return (
    <div className="space-y-2.5">
      {objectives.map(o => (
        <div key={o.id}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-stone-700">{o.description}</p>
            <span className="shrink-0 text-[11px] font-bold text-stone-500">{o.progress}%</span>
          </div>
          <ProgressBar value={o.progress} tone={o.progress >= 100 ? 'bg-fisio-500' : o.progress >= 60 ? 'bg-logo-400' : 'bg-amber-400'} />
        </div>
      ))}
    </div>
  );
};
