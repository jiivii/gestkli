import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Printer, Save, Wand2 } from 'lucide-react';
import {
  ClinicalRecord, ClinicalSpecialty, Patient, User, UserRole,
} from '../../types';
import { dbService } from '../../services/dbService';
import { formatDate, getRoleProfile, patientFullName } from '../../constants';
import { REPORT_TITLES } from '../../data/clinicalCatalog';
import { Modal, InlineAlert, btnPrimary, btnSecondary, btnGhost, inputClass } from '../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  specialty: ClinicalSpecialty;
  professional: User;
  records: ClinicalRecord[];
  baseRecord?: ClinicalRecord | null;
  onSaved?: () => void;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ClinicalReportModal: React.FC<Props> = ({
  open, onClose, patient, specialty, professional, records, baseRecord, onSaved,
}) => {
  const profile = getRoleProfile(specialty);
  const defaultTitle = REPORT_TITLES[specialty]?.seguimiento || 'Informe clínico';
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [includeObjectives, setIncludeObjectives] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const eligible = useMemo(
    () => [...records].filter(r => r.recordType !== 'informe').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [records]
  );

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setContent('');
    setRecommendations('');
    setIncludeObjectives(true);
    setIncludeTests(true);
    setError('');
    setSaving(false);
    setSelected(baseRecord?.id ? [baseRecord.id] : eligible.slice(-3).map(r => r.id));
  }, [open, patient.id, specialty, baseRecord?.id]);

  const selectedRecords = useMemo(
    () => (selected.length ? eligible.filter(r => selected.includes(r.id)) : eligible),
    [eligible, selected]
  );

  const buildDraft = () => {
    const lines: string[] = [];
    const first = selectedRecords[0];
    const last = selectedRecords[selectedRecords.length - 1];

    lines.push(`Paciente: ${patientFullName(patient)} · DNI ${patient.dni} · Fecha de nacimiento ${formatDate(patient.birthDate)}.`);
    lines.push('');
    lines.push('1. MOTIVO DE CONSULTA');
    lines.push(first?.data?.motivo || 'No consta en los registros seleccionados.');
    lines.push('');
    lines.push('2. VALORACIÓN Y EVOLUCIÓN');
    let section = 3;
    selectedRecords.forEach(record => {
      lines.push(`${formatDate(record.date)} · ${record.recordType}: ${record.summary || 'Sin síntesis.'}`);
      if (specialty === UserRole.FISIOTERAPIA && record.data?.eva !== undefined) {
        lines.push(`   EVA ${record.data.eva}/10. ${record.data.painLocation || ''}`);
      }
      if (specialty === UserRole.NUTRICION && record.data?.weight) {
        lines.push(`   Peso ${record.data.weight} kg · Talla ${record.data.height || '—'} cm · IMC ${record.data.bmi || '—'}.`);
      }
      if (specialty === UserRole.LOGOPEDIA) {
        lines.push(`   Comprensión: ${record.data?.comprehension || '—'}`);
        lines.push(`   Expresión: ${record.data?.expression || '—'}`);
        lines.push(`   Articulación: ${record.data?.articulation || '—'}`);
      }
      if (specialty === UserRole.PSICOLOGIA) {
        lines.push(`   Formulación: ${record.data?.formulation || '—'}`);
      }
      lines.push('');
    });

    if (includeObjectives) {
      const objectives = last?.objectives || [];
      if (objectives.length) {
        lines.push(`${section++}. OBJETIVOS Y PROGRESO`);
        objectives.forEach(o => lines.push(`- ${o.description}${o.target ? ` (meta: ${o.target})` : ''}: ${o.progress}% · ${o.status}`));
        lines.push('');
      }
    }

    if (includeTests && specialty === UserRole.PSICOLOGIA) {
      const tests = selectedRecords.flatMap(r => (Array.isArray(r.data?.tests) ? r.data.tests : []));
      if (tests.length) {
        lines.push(`${section++}. PRUEBAS PSICOMÉTRICAS (resultados registrados)`);
        tests.forEach((t: any) => {
          lines.push(`- ${t.name} (${t.version || '—'}) · ${formatDate(t.date)}: puntuación ${t.rawScore || '—'}, percentil ${t.percentile || '—'}, resultado ${t.result || '—'}. Revisado: ${t.reviewed ? 'sí' : 'no'}.`);
        });
        lines.push('Nota: no se reproducen ítems ni claves de corrección. Los resultados requieren interpretación profesional.');
        lines.push('');
      }
    }

    const recommendationsRaw = last?.data?.recommendations || last?.data?.plan || '';
    const recommendationsText = typeof recommendationsRaw === 'string' ? recommendationsRaw : '';
    lines.push(`${section++}. RECOMENDACIONES`);
    lines.push(recommendations || recommendationsText || 'Mantener el plan de intervención y revisar en la próxima sesión.');
    lines.push('');
    lines.push(`${section}. CONCLUSIÓN`);
    lines.push(`Se emite este informe a petición de la persona interesada o su representante legal, con fines de coordinación clínica. Profesional responsable: ${professional.name}.`);

    setContent(lines.join('\n'));
  };

  const printReport = () => {
    if (!content.trim()) {
      setError('Genera o redacta el contenido del informe antes de imprimirlo.');
      return;
    }
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #292524; line-height: 1.55; font-size: 11.5pt; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #4f8a70; padding-bottom:12px; margin-bottom:18px; }
        .brand { font-size: 20pt; letter-spacing:-.02em; margin:0; }
        .sub { font-size: 8pt; letter-spacing:.28em; text-transform:uppercase; color:#78716c; margin:4px 0 0; }
        .meta { text-align:right; font-size:9pt; color:#57534e; }
        h1 { font-size:15pt; margin:0 0 4px; }
        h2 { font-size:11pt; margin:18px 0 6px; color:#3f3f46; }
        .patient { background:#f5f5f4; border:1px solid #e7e5e4; border-radius:8px; padding:10px 12px; font-size:9.5pt; margin-bottom:14px; }
        pre { white-space:pre-wrap; font-family:inherit; margin:0; }
        .foot { margin-top:26px; padding-top:10px; border-top:1px solid #d6d3d1; font-size:8pt; color:#78716c; }
        .sign { margin-top:34px; font-size:9.5pt; }
        .sign span { display:block; border-top:1px solid #a8a29e; width:260px; padding-top:5px; margin-top:28px; }
      </style></head><body>
      <div class="head">
        <div><p class="brand">sinestesya</p><p class="sub">salud integral</p></div>
        <div class="meta">${escapeHtml(profile.label)}<br>${escapeHtml(formatDate(new Date().toISOString()))}</div>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <div class="patient"><strong>${escapeHtml(patientFullName(patient))}</strong><br>DNI: ${escapeHtml(patient.dni)} · Nacimiento: ${escapeHtml(formatDate(patient.birthDate))}<br>Profesional: ${escapeHtml(professional.name)}</div>
      <pre>${escapeHtml(content)}</pre>
      <div class="sign">Firmado por ${escapeHtml(professional.name)}<span>Firma del profesional</span></div>
      <div class="foot">Documento clínico confidencial. Su acceso y difusión están limitados por el RGPD y la LOPDGDD. Sinestesya Salud Integral.</div>
      </body></html>`;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => iframe.contentWindow?.print(), 250);
  };

  const save = async () => {
    if (!content.trim()) {
      setError('El informe necesita contenido antes de guardarse.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await dbService.createClinicalRecord({
        patientId: patient.id,
        professionalId: professional.id,
        specialty,
        recordType: 'informe',
        date: new Date().toISOString(),
        status: 'completado',
        summary: title,
        objectives: [],
        data: {
          title,
          content,
          recommendations,
          includeTestResults: includeTests,
          includeObjectives,
          sourceRecordIds: selectedRecords.map(r => r.id),
        },
      }, professional);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el informe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar informe clínico"
      subtitle={`${patientFullName(patient)} · ${profile.label}`}
      size="xl"
      accent={profile.solid}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>Cancelar</button>
          <button type="button" onClick={printReport} className={btnSecondary}><Printer size={15} /> Imprimir / PDF</button>
          <button type="button" onClick={save} className={btnPrimary} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar informe'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert level="danger">{error}</InlineAlert>}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Título del informe</label>
          <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Registros incluidos</label>
            <span className="text-[11px] text-stone-400">{selected.length} de {eligible.length}</span>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2">
            {eligible.length === 0 && <p className="p-3 text-center text-xs text-stone-400">No hay registros clínicos disponibles.</p>}
            {eligible.map(record => (
              <label key={record.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-stone-50">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-stone-800"
                  checked={selected.includes(record.id)}
                  onChange={e => setSelected(prev => e.target.checked ? [...prev, record.id] : prev.filter(id => id !== record.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-stone-700">{formatDate(record.date)} · {record.recordType}</span>
                  <span className="block truncate text-stone-500">{record.summary}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-800" checked={includeObjectives} onChange={e => setIncludeObjectives(e.target.checked)} /> Incluir objetivos y progreso</label>
          {specialty === UserRole.PSICOLOGIA && (
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-stone-800" checked={includeTests} onChange={e => setIncludeTests(e.target.checked)} /> Incluir resultados de pruebas</label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={buildDraft} className={btnSecondary}><Wand2 size={15} /> Generar borrador desde registros</button>
          <p className="text-[11px] text-stone-400">Revisa y edita siempre el texto antes de firmarlo.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Contenido del informe</label>
          <textarea
            className={`${inputClass} min-h-[260px] resize-y font-serif leading-relaxed`}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Redacta el informe o genera un borrador a partir de los registros seleccionados."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Recomendaciones específicas (opcional)</label>
          <textarea className={`${inputClass} resize-y`} rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Pautas, seguimiento, derivación…" />
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-400">
          <FileText size={13} className="mt-0.5 shrink-0" />
          El PDF se genera mediante la impresión del navegador. No se envían datos a servicios externos.
        </p>
        <iframe ref={iframeRef} title="Impresión de informe" className="hidden" />
      </div>
    </Modal>
  );
};

export default ClinicalReportModal;
