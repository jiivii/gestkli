import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, Save, Sparkles } from 'lucide-react';
import {
  ClinicalObjective, ClinicalRecord, ClinicalRecordStatus, ClinicalRecordType,
  ClinicalSpecialty, Patient, User, UserRole,
} from '../../types';
import { dbService } from '../../services/dbService';
import { getRoleProfile, patientFullName, formatDate } from '../../constants';
import { Modal, SpecialtyBadge, btnPrimary, btnSecondary, btnGhost, InlineAlert } from '../ui';
import { emptyClinicalData, mergeClinicalData, recordTypeOptions, statusOptions } from './defaults';
import { FormSection, SelectInput, TextArea } from './shared';
import PhysioFields from './PhysioFields';
import NutritionFields from './NutritionFields';
import SpeechFields from './SpeechFields';
import PsychologyFields from './PsychologyFields';

interface Props {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  specialty: ClinicalSpecialty;
  professional: User;
  appointmentId?: string | null;
  existing?: ClinicalRecord | null;
  previousObjectives?: ClinicalObjective[];
  onSaved: () => void;
}

const toLocalInput = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ClinicalRecordModal: React.FC<Props> = ({
  open, onClose, patient, specialty, professional, appointmentId, existing, previousObjectives, onSaved,
}) => {
  const [data, setData] = useState<Record<string, any>>(() => emptyClinicalData(specialty));
  const [objectives, setObjectives] = useState<ClinicalObjective[]>([]);
  const [summary, setSummary] = useState('');
  const [recordType, setRecordType] = useState<ClinicalRecordType>('sesion');
  const [status, setStatus] = useState<ClinicalRecordStatus>('completado');
  const [date, setDate] = useState(toLocalInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const profile = getRoleProfile(specialty);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    if (existing) {
      setData(mergeClinicalData(specialty, existing.data));
      setObjectives(existing.objectives || []);
      setSummary(existing.summary || '');
      setRecordType(existing.recordType);
      setStatus(existing.status);
      setDate(toLocalInput(existing.date));
    } else {
      setData(emptyClinicalData(specialty));
      setObjectives(previousObjectives ? previousObjectives.map(o => ({ ...o, id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })) : []);
      setSummary('');
      setRecordType(previousObjectives?.length ? 'sesion' : 'valoracion');
      setStatus('completado');
      setDate(toLocalInput());
    }
  }, [open, existing?.id, specialty, patient.id, appointmentId]);

  const patchData = (patch: Record<string, any>) => setData(prev => ({ ...prev, ...patch }));

  const specialtyFields = useMemo(() => {
    const common = { data, onChange: patchData, objectives, onObjectivesChange: setObjectives };
    switch (specialty) {
      case UserRole.FISIOTERAPIA: return <PhysioFields {...common} />;
      case UserRole.NUTRICION: return <NutritionFields {...common} />;
      case UserRole.LOGOPEDIA: return <SpeechFields {...common} />;
      case UserRole.PSICOLOGIA: return <PsychologyFields {...common} />;
      default: return null;
    }
  }, [specialty, data, objectives]);

  const save = async (nextStatus: ClinicalRecordStatus) => {
    if (!summary.trim()) {
      setError('Añade al menos una síntesis de la sesión para poder guardar el registro.');
      return;
    }
    if (!date) {
      setError('La fecha del registro es obligatoria.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<ClinicalRecord> = {
        patientId: patient.id,
        professionalId: professional.id,
        specialty,
        recordType,
        date: new Date(date).toISOString(),
        appointmentId: appointmentId || existing?.appointmentId || null,
        status: nextStatus,
        summary: summary.trim(),
        objectives,
        data,
        version: existing?.version || 1,
      };
      if (existing) {
        await dbService.updateClinicalRecord(existing.id, payload, professional);
      } else {
        const created = await dbService.createClinicalRecord(payload, professional);
        if (appointmentId) {
          await dbService.updateAppointment(appointmentId, { clinicalRecorded: true });
        }
        if (recordType === 'informe' && created.id) {
          // El informe también queda enlazado al paciente, ya lo está por el registro.
        }
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el registro clínico.');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>Cancelar</button>
      <button type="button" onClick={() => save('borrador')} className={btnSecondary} disabled={saving}>
        <Save size={15} /> Guardar borrador
      </button>
      <button type="button" onClick={() => save('completado')} className={btnPrimary} disabled={saving}>
        <CheckCircle2 size={15} /> {saving ? 'Guardando…' : 'Guardar y completar'}
      </button>
      <button
        type="button"
        onClick={() => save('firmado')}
        disabled={saving}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${profile.solid} ${profile.solidHover} disabled:opacity-50`}
      >
        <FileSignature size={15} /> Firmar
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Editar registro clínico' : 'Nuevo registro clínico'}
      subtitle={`${patientFullName(patient)} · ${formatDate(patient.birthDate)}`}
      size="xl"
      accent={profile.solid}
      footer={footer}
      bodyClassName="p-4 md:p-6"
    >
      <div className="space-y-4">
        <div className={`flex flex-col gap-3 rounded-2xl border ${profile.border} ${profile.soft} p-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SpecialtyBadge specialty={specialty} />
              {appointmentId && <span className="text-[11px] font-medium text-stone-500">Vinculado a una cita</span>}
              {existing && <span className="text-[11px] text-stone-500">Versión {existing.version}</span>}
            </div>
            <p className="mt-1 text-sm font-semibold text-stone-800">{patientFullName(patient)}</p>
          </div>
          <p className="text-xs text-stone-500">Profesional: {professional.name}</p>
        </div>

        {error && <InlineAlert level="danger" title="No se pudo guardar">{error}</InlineAlert>}

        <FormSection title="Metadatos del registro" icon={<Sparkles size={16} />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Fecha y hora</label>
              <input
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60"
              />
            </div>
            <SelectInput label="Tipo de registro" value={recordType} onChange={v => setRecordType(v as ClinicalRecordType)} options={recordTypeOptions} />
            <SelectInput label="Estado" value={status} onChange={v => setStatus(v as ClinicalRecordStatus)} options={statusOptions} />
          </div>
        </FormSection>

        <FormSection title="Síntesis de la sesión" description="Resumen breve y trazable de lo trabajado.">
          <TextArea
            label="Evolución / síntesis"
            value={summary}
            onChange={setSummary}
            rows={3}
            placeholder={
              specialty === UserRole.PSICOLOGIA
                ? 'Ej. Se trabaja reestructuración cognitiva. Buena adherencia a tareas. Riesgo estable.'
                : specialty === UserRole.NUTRICION
                  ? 'Ej. Buena adherencia al plan. Ajuste de raciones. Pérdida de 0,4 kg esta semana.'
                  : specialty === UserRole.LOGOPEDIA
                    ? 'Ej. Mejora en conciencia fonológica. 7/10 aciertos con ayuda. Se mantienen pautas.'
                    : 'Ej. Buena tolerancia. Dolor 3/10. Se progresa el ejercicio y se revisan pautas.'
            }
          />
        </FormSection>

        {!existing && !!previousObjectives?.length && (
          <InlineAlert level="info" title="Objetivos de la sesión anterior">
            Se han copiado para agilizar el registro. Revisa y actualiza el progreso de hoy antes de guardar.
          </InlineAlert>
        )}

        {specialtyFields}

        <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] leading-relaxed text-stone-500">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-stone-400" />
          <p>Este registro queda vinculado a tu perfil y a la auditoría del centro. Los cambios de versión se conservan. No incluyas datos de terceros sin base legal ni consentimiento.</p>
        </div>
      </div>
    </Modal>
  );
};

export default ClinicalRecordModal;
