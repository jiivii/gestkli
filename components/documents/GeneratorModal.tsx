import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, FileCheck2, FileText, Save, Send, ShieldCheck,
} from 'lucide-react';
import {
  CenterSettings, DocumentTemplate, DocumentTemplateField, Patient, PatientDocument, User,
} from '../../types';
import { Badge, Field, InlineAlert, Modal, btnGhost, btnPrimary, btnSecondary, inputClass } from '../ui';
import DocumentPreview from './DocumentPreview';
import {
  DOCUMENT_CATEGORIES, categoryMeta, buildAutoValues, renderTemplate, templateIsUsable,
} from '../../services/documentTemplates';
import { createDocumentDraft, markDocumentDelivered, markDocumentReady } from '../../services/documentService';
import { formatDate } from '../../constants';

interface Props {
  open: boolean;
  patient: Patient;
  user: User;
  settings: CenterSettings;
  templates: DocumentTemplate[];
  replaceDocument?: PatientDocument | null;
  onClose: () => void;
  onCreated: (document: PatientDocument, ready: boolean) => void;
  onOpenTemplates?: () => void;
}

type Step = 'template' | 'data' | 'review';

const GeneratorModal: React.FC<Props> = ({
  open, patient, user, settings, templates, replaceDocument, onClose, onCreated, onOpenTemplates,
}) => {
  const usable = useMemo(
    () => templates
      .filter(templateIsUsable)
      .sort((a, b) => DOCUMENT_CATEGORIES.findIndex(c => c.id === a.category) - DOCUMENT_CATEGORIES.findIndex(c => c.id === b.category)
        || a.name.localeCompare(b.name, 'es')),
    [templates],
  );
  const [step, setStep] = useState<Step>('template');
  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedDocument, setSavedDocument] = useState<PatientDocument | null>(null);

  const selected = usable.find(t => t.id === templateId) || null;
  const autoValues = useMemo(() => buildAutoValues({
    patient, professional: user, center: settings,
    serviceName: replaceDocument?.serviceName || '',
    documentVersion: (replaceDocument?.version || 0) + 1,
  }), [patient, user, settings, replaceDocument]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSavedDocument(null);
    setSaving(false);
    if (replaceDocument?.templateId) {
      const matching = usable.find(t => t.id === replaceDocument.templateId);
      if (matching) {
        setTemplateId(matching.id);
        setValues({ ...(replaceDocument.fields || {}) });
        setStep('data');
        return;
      }
    }
    setTemplateId('');
    setValues({});
    setSearch('');
    setStep('template');
  }, [open, replaceDocument, usable]);

  if (!open) return null;

  const rendered = selected ? renderTemplate(selected, { ...autoValues, ...values }) : null;
  const manualFields = selected ? selected.fields.filter(f => !f.autoFill) : [];
  const autoFields = selected ? selected.fields.filter(f => f.autoFill) : [];
  const missing = rendered?.missingRequired || [];
  const unresolved = rendered?.text.includes('{{') || false;

  const goData = () => {
    setError('');
    if (!selected) {
      setError('Selecciona una plantilla aprobada.');
      return;
    }
    if (!selected.requiresSignature) {
      // Los documentos informativos también requieren revisión, pero no firma.
    }
    setStep('data');
  };

  const goReview = () => {
    setError('');
    if (!selected || !rendered) return;
    if (missing.length) {
      setError(`Faltan datos obligatorios: ${Array.from(new Set(missing)).join(', ')}.`);
      return;
    }
    if (unresolved) {
      setError('Quedan marcadores sin resolver. Revisa la plantilla o los datos.');
      return;
    }
    setStep('review');
  };

  const save = async (ready: boolean) => {
    if (!selected || !rendered) return;
    setSaving(true);
    setError('');
    try {
      const result = await createDocumentDraft({
        patient, template: selected, professional: user, settings,
        fields: values,
        serviceName: replaceDocument?.serviceName || null,
        serviceId: replaceDocument?.serviceId || null,
        appointmentId: replaceDocument?.appointmentId || null,
        replacesDocumentId: replaceDocument?.id || null,
        version: (replaceDocument?.version || 0) + 1,
      });
      const finalDocument = ready
        ? (selected.requiresSignature
          ? await markDocumentReady(result.document, user)
          : await markDocumentDelivered(result.document, user))
        : result.document;
      setSavedDocument(finalDocument);
      onCreated(finalDocument, ready);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el documento.');
    } finally {
      setSaving(false);
    }
  };

  const footer = step === 'template' ? (
    <>
      <button className={btnGhost} onClick={onClose}>Cancelar</button>
      <button className={btnPrimary} onClick={goData} disabled={!selected}>Continuar <ArrowRight size={15} /></button>
    </>
  ) : step === 'data' ? (
    <>
      <button className={btnGhost} onClick={() => setStep('template')}><ArrowLeft size={15} /> Plantilla</button>
      <button className={btnPrimary} onClick={goReview} disabled={!!missing.length}>Revisar documento <Eye size={15} /></button>
    </>
  ) : savedDocument ? (
    <>
      <button className={btnGhost} onClick={onClose}>Cerrar</button>
      <button className={btnPrimary} onClick={onClose}><CheckCircle2 size={15} /> Documento guardado</button>
    </>
  ) : (
    <>
      <button className={btnGhost} onClick={() => setStep('data')} disabled={saving}><ArrowLeft size={15} /> Datos</button>
      <button className={btnSecondary} onClick={() => save(false)} disabled={saving}><Save size={15} /> Guardar borrador</button>
      <button className={btnPrimary} onClick={() => save(true)} disabled={saving}>
        <Send size={15} /> {saving ? 'Guardando…' : selected?.requiresSignature ? 'He revisado · listo para enviar' : 'He revisado · registrar entrega'}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={replaceDocument ? 'Nueva versión del documento' : 'Generar documento'}
      subtitle={`${patient.firstName} ${patient.lastName} · revisión obligatoria antes de enviar`}
      size="xl"
      accent="bg-sky-700"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
          {[
            { id: 'template', label: '1. Plantilla' },
            { id: 'data', label: '2. Datos y revisión' },
            { id: 'review', label: '3. Vista previa exacta' },
          ].map(item => (
            <span key={item.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
              step === item.id ? 'bg-stone-800 text-white' : 'text-stone-500'
            }`}>
              {item.id === 'review' && step === 'review' ? <Eye size={12} /> : null}
              {item.label}
            </span>
          ))}
          {replaceDocument && (
            <Badge className="ml-auto border-amber-200 bg-amber-50 text-amber-800">
              Sustituye v{replaceDocument.version} · la anterior se conserva
            </Badge>
          )}
        </div>

        {error && <InlineAlert level="danger" title="No se puede continuar">{error}</InlineAlert>}

        {step === 'template' && (
          <div className="space-y-4">
            {!usable.length ? (
              <InlineAlert
                level="warning"
                title="No hay plantillas aprobadas"
                action={onOpenTemplates ? <button className={btnSecondary + ' text-xs'} onClick={onOpenTemplates}>Abrir gestor</button> : undefined}
              >
                Ninguna plantilla está aprobada y activa. Un administrador autorizado debe revisar y aprobar la biblioteca antes de generar documentos.
              </InlineAlert>
            ) : (
              <>
                <Field label="Buscar plantilla">
                  <input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, categoría o especialidad…" />
                </Field>
                <div className="grid max-h-[48vh] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {usable
                    .filter(t => !search.trim() || `${t.name} ${t.description} ${t.category} ${t.specialty || ''}`.toLowerCase().includes(search.toLowerCase()))
                    .map(template => {
                      const meta = categoryMeta(template.category);
                      const active = template.id === templateId;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => { setTemplateId(template.id); setValues({}); setError(''); }}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            active ? 'border-stone-800 bg-stone-50 ring-2 ring-stone-200' : 'border-stone-200 bg-white hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Badge className={meta.tone}>{meta.short}</Badge>
                            <span className="text-[10px] font-semibold text-stone-400">v{template.version}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-stone-800">{template.name}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-500">{template.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                            <span className="rounded-full bg-stone-100 px-2 py-0.5">{template.requiresSignature ? 'Requiere firma' : 'Informativo'}</span>
                            {template.required && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Obligatorio</span>}
                            {template.validityDays ? <span className="rounded-full bg-stone-100 px-2 py-0.5">Vigencia {template.validityDays} días</span> : null}
                          </div>
                        </button>
                      );
                    })}
                </div>
                {!usable.filter(t => !search.trim() || `${t.name} ${t.description}`.toLowerCase().includes(search.toLowerCase())).length && (
                  <p className="py-6 text-center text-sm text-stone-500">No hay coincidencias.</p>
                )}
              </>
            )}
          </div>
        )}

        {step === 'data' && selected && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <div className={`rounded-xl border p-3 ${categoryMeta(selected.category).tone}`}>
                <div className="flex items-start gap-2">
                  <FileText size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="mt-0.5 text-xs opacity-80">{selected.description}</p>
                  </div>
                </div>
              </div>

              {missing.length > 0 && (
                <InlineAlert level="warning" title="Datos pendientes">
                  Completa: {Array.from(new Set(missing)).join(', ')}. No se inventan datos ni se permite enviar con campos obligatorios vacíos.
                </InlineAlert>
              )}

              {manualFields.length === 0 ? (
                <InlineAlert level="info" title="Sin campos manuales">
                  Esta plantilla se completa con datos verificados de la ficha, del profesional y del centro. Revisa la vista previa antes de continuar.
                </InlineAlert>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {manualFields.map(field => (
                    <Field
                      key={field.key}
                      label={field.label}
                      required={field.required}
                      className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                    >
                      {field.type === 'textarea' ? (
                        <textarea
                          className={inputClass + ' min-h-[90px]'}
                          value={values[field.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          className={inputClass}
                          value={values[field.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        >
                          <option value="">Selecciona…</option>
                          {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
                          <input
                            type="checkbox"
                            checked={!!values[field.key]}
                            onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.checked }))}
                          />
                          <span>{field.help || 'Sí'}</span>
                        </label>
                      ) : (
                        <input
                          className={inputClass}
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                          value={values[field.key] ?? ''}
                          onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                        />
                      )}
                      {field.help && field.type !== 'checkbox' && <p className="mt-1 text-[10px] leading-relaxed text-stone-500">{field.help}</p>}
                    </Field>
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Datos automáticos de la ficha</p>
                <dl className="mt-2 space-y-2">
                  {autoFields.map(field => {
                    const value = autoValues[field.key];
                    return (
                      <div key={field.key}>
                        <dt className="text-[10px] font-semibold text-stone-500">{field.label}{field.required ? ' *' : ''}</dt>
                        <dd className={`text-xs ${value ? 'text-stone-800' : 'font-semibold text-amber-700'}`}>{value || 'No consta en la ficha'}</dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
                  Los datos de identidad, representación y centro no se pueden sobrescribir a mano. Si falta algo, actualiza la ficha o la configuración.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>El texto legal procede de la plantilla aprobada. No edites las cláusulas esenciales fuera de este flujo. Si necesitas un cambio, crea una nueva versión de plantilla y sométela a revisión.</p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 'review' && selected && rendered && (
          <div className="space-y-4">
            <InlineAlert level="info" title="Revisa la versión exacta que se enviará">
              Comprueba nombres, DNI, fechas, representación, servicio y todas las cláusulas. Una vez enviado, el contenido queda congelado y cualquier cambio exige una nueva versión.
            </InlineAlert>
            <DocumentPreview
              title={selected.name}
              text={rendered.text}
              templateName={selected.name}
              templateVersion={selected.version}
              version={(replaceDocument?.version || 0) + 1}
              centerName={settings.centerName}
              assurance={settings.documentSettings?.signatureLevel}
              contentSha256="se calculará al guardar el snapshot"
            />
            <div className="grid grid-cols-1 gap-2 text-[11px] text-stone-600 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"><ShieldCheck size={14} /> Plantilla aprobada v{selected.version}</div>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"><FileCheck2 size={14} /> Se guardará un snapshot inmutable</div>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"><Eye size={14} /> Fecha: {formatDate(new Date().toISOString())}</div>
            </div>
            {savedDocument && (
              <InlineAlert level="success" title="Documento guardado">
                {savedDocument.status === 'listo_para_enviar'
                  ? 'Está listo para enviarse a firma. Revisa los firmantes en el siguiente paso.'
                  : 'Se guardó como borrador. Debes revisarlo y marcarlo como listo antes de enviarlo.'}
              </InlineAlert>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GeneratorModal;
