import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Eye, FileCheck2,
  FileText, Filter, History, Info, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import {
  CenterSettings, ClinicalSpecialty, DocumentCategory, DocumentTemplate, DocumentTemplateField,
  DocumentTemplateFieldType, DocumentAutoFillKey, Patient, User,
} from '../types';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, StatCard, btnGhost,
  btnPrimary, btnSecondary, btnDanger, inputClass,
} from '../components/ui';
import { dbService } from '../services/dbService';
import {
  DOCUMENT_CATEGORIES, SIGNER_RULE_LABELS, buildAutoValues, categoryMeta, renderTemplate,
  templateIsUsable,
} from '../services/documentTemplates';
import { hasPermission } from '../services/permissions';
import { CLINICAL_SPECIALTIES, formatDate } from '../constants';
import DocumentPreview from '../components/documents/DocumentPreview';

interface Props { user: User; }

const fieldTypes: { id: DocumentTemplateFieldType; label: string }[] = [
  { id: 'text', label: 'Texto corto' },
  { id: 'textarea', label: 'Texto largo' },
  { id: 'date', label: 'Fecha' },
  { id: 'number', label: 'Número' },
  { id: 'email', label: 'Correo' },
  { id: 'dni', label: 'DNI/NIE' },
  { id: 'select', label: 'Selección' },
  { id: 'checkbox', label: 'Casilla de verificación' },
];

const autoFillOptions: { id: DocumentAutoFillKey; label: string }[] = [
  { id: 'patient.fullName', label: 'Paciente · nombre completo' },
  { id: 'patient.firstName', label: 'Paciente · nombre' },
  { id: 'patient.lastName', label: 'Paciente · apellidos' },
  { id: 'patient.dni', label: 'Paciente · DNI/NIE' },
  { id: 'patient.birthDate', label: 'Paciente · fecha de nacimiento' },
  { id: 'patient.age', label: 'Paciente · edad' },
  { id: 'patient.address', label: 'Paciente · dirección' },
  { id: 'patient.phone', label: 'Paciente · teléfono' },
  { id: 'patient.email', label: 'Paciente · correo' },
  { id: 'guardian.name', label: 'Representante · nombre' },
  { id: 'guardian.dni', label: 'Representante · DNI/NIE' },
  { id: 'guardian.phone', label: 'Representante · teléfono' },
  { id: 'guardian.email', label: 'Representante · correo' },
  { id: 'guardian.relationship', label: 'Representante · relación' },
  { id: 'guardian2.name', label: 'Segundo representante · nombre' },
  { id: 'guardian2.dni', label: 'Segundo representante · DNI/NIE' },
  { id: 'guardian2.phone', label: 'Segundo representante · teléfono' },
  { id: 'guardian2.email', label: 'Segundo representante · correo' },
  { id: 'guardian2.relationship', label: 'Segundo representante · relación' },
  { id: 'representation.type', label: 'Tipo de representación' },
  { id: 'professional.name', label: 'Profesional · nombre' },
  { id: 'professional.email', label: 'Profesional · correo' },
  { id: 'professional.phone', label: 'Profesional · teléfono' },
  { id: 'center.name', label: 'Centro · nombre' },
  { id: 'center.legalName', label: 'Centro · razón social' },
  { id: 'center.cif', label: 'Centro · CIF/NIF' },
  { id: 'center.address', label: 'Centro · dirección' },
  { id: 'center.email', label: 'Centro · correo' },
  { id: 'center.phone', label: 'Centro · teléfono' },
  { id: 'center.dpoName', label: 'Centro · DPO' },
  { id: 'center.dpoEmail', label: 'Centro · correo del DPO' },
  { id: 'service.name', label: 'Servicio' },
  { id: 'document.date', label: 'Fecha de generación' },
  { id: 'document.version', label: 'Versión del documento' },
];

const blankTemplate = (): Partial<DocumentTemplate> => ({
  name: '',
  category: 'general',
  specialty: null,
  description: '',
  body: '# {{center.name}}\n\nEscribe aquí el texto aprobado de la plantilla. Usa {{patient.fullName}}, {{document.date}} y bloques condicionales como {{#if guardian.name}}...{{/if}}.\n\n## Datos del paciente\n\n- Paciente: {{patient.fullName}}\n- DNI/NIE: {{patient.dni || \'no consta\'}}\n- Fecha: {{document.date}}\n\n## Declaración\n\nEl texto legal debe ser revisado y aprobado por la persona competente antes de activar la plantilla.\n',
  fields: [],
  requiresSignature: true,
  signerRule: 'manual',
  validityDays: null,
  required: false,
  active: true,
  legalStatus: 'pendiente_revision',
});

const samplePatient = {
  id: 'sample-patient', firstName: 'Ana', lastName: 'Ejemplo', dni: '00000000T',
  birthDate: '1990-05-12', address: 'Calle Ejemplo 1', phone: '600000000',
  email: 'ana.ejemplo@example.com', legalGuardian: null, secondaryLegalGuardian: null,
  assignedSpecialties: [],
} as unknown as Patient;

const DocumentTemplates: React.FC<Props> = ({ user }) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [draft, setDraft] = useState<Partial<DocumentTemplate>>(blankTemplate());
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<DocumentTemplate | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewConfirm, setReviewConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const canManage = hasPermission(user, 'documents.templates.manage');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, cfg] = await Promise.all([dbService.getDocumentTemplates(true), dbService.getSettings()]);
      setTemplates(list);
      setSettings(cfg);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setDraft(blankTemplate());
    setEditorOpen(true);
    setError('');
    setNotice('');
  };

  const openEdit = (template: DocumentTemplate) => {
    setEditing(template);
    setDraft({ ...template, fields: template.fields.map(f => ({ ...f })) });
    setEditorOpen(true);
    setError('');
    setNotice('');
  };

  const updateDraft = (patch: Partial<DocumentTemplate>) => setDraft(prev => ({ ...prev, ...patch }));

  const addField = () => {
    const fields = [...(draft.fields || [])];
    let index = fields.length + 1;
    while (fields.some(f => f.key === `campo_${index}`)) index += 1;
    fields.push({
      key: `campo_${index}`, label: 'Nuevo campo', type: 'text', required: false,
      autoFill: null, editable: true, options: [], placeholder: '', help: '',
    });
    updateDraft({ fields });
  };

  const updateField = (index: number, patch: Partial<DocumentTemplateField>) => {
    const fields = (draft.fields || []).map((field, i) => i === index ? { ...field, ...patch } : field);
    updateDraft({ fields });
  };

  const removeField = (index: number) => {
    updateDraft({ fields: (draft.fields || []).filter((_, i) => i !== index) });
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const fields = [...(draft.fields || [])];
    const next = index + direction;
    if (next < 0 || next >= fields.length) return;
    [fields[index], fields[next]] = [fields[next], fields[index]];
    updateDraft({ fields });
  };

  const validateDraft = (): string | null => {
    if (!draft.name?.trim()) return 'El nombre de la plantilla es obligatorio.';
    if (!draft.body?.trim()) return 'El texto de la plantilla es obligatorio.';
    if (/<script|javascript:|on\w+\s*=/i.test(draft.body || '')) {
      return 'El texto no puede contener HTML ejecutable, scripts ni manejadores de eventos. Usa solo el formato de marcadores permitido.';
    }
    const keys = (draft.fields || []).map(f => f.key.trim());
    if (keys.some(key => !key)) return 'Todos los campos deben tener una clave interna.';
    if (new Set(keys).size !== keys.length) return 'Hay claves de campo duplicadas.';
    if (keys.some(key => !/^[a-zA-Z0-9._-]+$/.test(key))) {
      return 'Las claves de campo solo pueden contener letras, números, puntos, guiones y guiones bajos.';
    }
    if ((draft.fields || []).some(f => !f.label.trim())) return 'Todos los campos deben tener una etiqueta visible.';
    if ((draft.fields || []).some(f => f.type === 'select' && !(f.options || []).length)) {
      return 'Los campos de selección necesitan al menos una opción.';
    }
    return null;
  };

  const save = async () => {
    const validation = validateDraft();
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const fields = (draft.fields || []).map(field => ({
        ...field,
        key: field.key.trim(),
        label: field.label.trim(),
        autoFill: field.autoFill || null,
        editable: field.autoFill ? false : field.editable !== false,
        options: field.type === 'select'
          ? (field.options || []).map(o => String(o).trim()).filter(Boolean)
          : [],
      }));
      const payload: Partial<DocumentTemplate> = {
        ...draft,
        name: draft.name!.trim(),
        description: (draft.description || '').trim(),
        fields,
        signerRule: draft.requiresSignature ? (draft.signerRule || 'manual') : 'manual',
        legalReviewNotes: editing?.legalReviewNotes || '',
      };

      if (editing) {
        if (editing.legalStatus === 'aprobada') {
          const created = await dbService.createDocumentTemplateVersion(editing, payload, user);
          setNotice(`Se creó la versión ${created.version} pendiente de revisión. La versión anterior quedó retirada y no se puede usar.`);
        } else {
          await dbService.saveDocumentTemplate({ ...payload, id: editing.id }, user);
          setNotice('Plantilla pendiente actualizada. Sigue sin ser utilizable hasta su aprobación.');
        }
      } else {
        const created = await dbService.saveDocumentTemplate({
          ...payload, version: 1, active: true, legalStatus: 'pendiente_revision',
          legalReviewedBy: null, legalReviewedAt: null,
        }, user);
        setNotice(`Plantilla «${created.name}» creada. Queda pendiente de revisión y no se puede usar todavía.`);
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  const changeActive = async (template: DocumentTemplate, active: boolean) => {
    setError('');
    setNotice('');
    try {
      await dbService.setDocumentTemplateActive(template, active, user);
      setNotice(active ? 'Plantilla activada.' : 'Plantilla desactivada. No se podrá usar para nuevos documentos; los documentos existentes se conservan.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar la activación.');
    }
  };

  const openApproval = (template: DocumentTemplate) => {
    setApprovalTarget(template);
    setReviewer(user.name || '');
    setReviewDate(new Date().toISOString().slice(0, 10));
    setReviewNotes('');
    setReviewConfirm(false);
    setError('');
  };

  const approve = async () => {
    if (!approvalTarget) return;
    if (!reviewer.trim()) { setError('Indica quién ha realizado la revisión.'); return; }
    if (!reviewConfirm) { setError('Confirma expresamente que la plantilla ha sido revisada.'); return; }
    setApproving(true);
    setError('');
    try {
      const reviewedAt = new Date(`${reviewDate}T12:00:00`).toISOString();
      await dbService.approveDocumentTemplate(approvalTarget.id, reviewer, reviewedAt, reviewNotes, user);
      setApprovalTarget(null);
      setNotice('Plantilla aprobada y activada. A partir de ahora puede usarse para generar documentos.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo aprobar la plantilla.');
    } finally {
      setApproving(false);
    }
  };

  const loadInitial = async () => {
    setSaving(true);
    setError('');
    try {
      await dbService.ensureDocumentTemplates(user);
      setNotice('Biblioteca inicial cargada. Todas las plantillas quedan pendientes de revisión y no son utilizables hasta su aprobación.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la biblioteca inicial.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter(template => {
      if (statusFilter !== 'all' && template.legalStatus !== statusFilter) return false;
      if (categoryFilter !== 'all' && template.category !== categoryFilter) return false;
      if (!term) return true;
      return `${template.name} ${template.description} ${template.category} ${template.specialty || ''}`.toLowerCase().includes(term);
    }).sort((a, b) => {
      if (a.name !== b.name) return a.name.localeCompare(b.name, 'es');
      return b.version - a.version;
    });
  }, [templates, search, statusFilter, categoryFilter]);

  const usableCount = templates.filter(templateIsUsable).length;
  const pendingCount = templates.filter(t => t.legalStatus === 'pendiente_revision').length;
  const approvedInactive = templates.filter(t => t.legalStatus === 'aprobada' && !t.active).length;

  const sampleValues = useMemo(() => {
    if (!previewTemplate || !settings) return {};
    const auto = buildAutoValues({
      patient: samplePatient, professional: user, center: settings,
      serviceName: 'Servicio de ejemplo', documentVersion: 1,
    });
    const manual: Record<string, any> = {};
    previewTemplate.fields.forEach(field => {
      if (field.autoFill) {
        manual[field.key] = auto[field.autoFill] || '';
      } else if (field.type === 'checkbox') {
        manual[field.key] = false;
      } else if (field.type === 'select') {
        manual[field.key] = field.options?.[0] || '';
      } else {
        manual[field.key] = field.placeholder || 'Dato de ejemplo';
      }
    });
    return { ...auto, ...manual };
  }, [previewTemplate, settings, user]);

  const sampleRendered = previewTemplate && settings
    ? renderTemplate(previewTemplate, sampleValues)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plantillas de documentación"
        description="Biblioteca legal versionada · solo las plantillas aprobadas y activas pueden generar documentos"
        icon={FileCheck2}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {!templates.length && (
                <button className={btnSecondary} onClick={loadInitial} disabled={saving}>
                  <RefreshCw size={15} /> Cargar biblioteca inicial
                </button>
              )}
              <button className={btnPrimary} onClick={openNew}>
                <Plus size={15} /> Nueva plantilla
              </button>
            </div>
          ) : undefined
        }
      />

      {error && <InlineAlert level="danger" title="Incidencia">{error}</InlineAlert>}
      {notice && <InlineAlert level="success" title="Plantillas actualizadas">{notice}</InlineAlert>}

      <InlineAlert level="warning" title="Revisión jurídica obligatoria">
        Las plantillas iniciales se entregan con estado «pendiente de revisión» y no son utilizables. Aprobar en esta pantalla registra revisor, fecha y notas, pero no sustituye la validación por el DPO o asesoría jurídica competente. No se debe afirmar que una firma es cualificada o avanzada sin proveedor y certificado que lo acrediten.
      </InlineAlert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Plantillas" value={templates.length} icon={FileText} hint="Incluye versiones históricas" />
        <StatCard title="Utilizables" value={usableCount} icon={CheckCircle2} tone="green" hint="Aprobadas y activas" />
        <StatCard title="Pendientes" value={pendingCount} icon={AlertTriangle} tone="orange" hint="Requieren revisión" />
        <StatCard title="Aprobadas retiradas" value={approvedInactive} icon={History} tone="red" hint="Conservadas por trazabilidad" />
      </div>

      {!templates.length && !loading && (
        <SectionCard title="Biblioteca vacía" description="Carga las plantillas iniciales o crea una desde cero">
          <EmptyState
            icon={FileCheck2}
            title="No hay plantillas"
            description="La biblioteca inicial incluye privacidad, especialidades, menores, teleconsulta, cierre y representación. Se cargarán como pendientes de revisión."
            action={canManage ? <button className={btnPrimary} onClick={loadInitial} disabled={saving}><RefreshCw size={15} /> Cargar biblioteca inicial</button> : undefined}
          />
        </SectionCard>
      )}

      {!!templates.length && (
        <SectionCard title="Biblioteca" description={`${filtered.length} plantilla(s) en la vista`} padded={false}>
          <div className="flex flex-col gap-2 border-b border-stone-100 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className={inputClass + ' pl-9'} placeholder="Buscar por nombre, categoría o especialidad…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <select className={inputClass + ' !w-auto min-w-[150px]'} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">Todas las categorías</option>
                {DOCUMENT_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.short}</option>)}
              </select>
              <select className={inputClass + ' !w-auto min-w-[150px]'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="pendiente_revision">Pendiente de revisión</option>
                <option value="aprobada">Aprobada</option>
                <option value="retirada">Retirada</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {filtered.map(template => {
              const meta = categoryMeta(template.category);
              const usable = templateIsUsable(template);
              return (
                <div key={template.id} className="px-4 py-3.5 hover:bg-stone-50/60">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${usable ? 'bg-fisio-50 text-fisio-700' : template.legalStatus === 'pendiente_revision' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                        {usable ? <CheckCircle2 size={18} /> : template.legalStatus === 'pendiente_revision' ? <AlertTriangle size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-stone-800">{template.name}</p>
                          <Badge className={meta.tone}>{meta.short}</Badge>
                          <Badge className={template.legalStatus === 'aprobada' ? 'border-fisio-200 bg-fisio-50 text-fisio-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                            {template.legalStatus === 'aprobada' ? 'Aprobada' : template.legalStatus === 'retirada' ? 'Retirada' : 'Pendiente de revisión'}
                          </Badge>
                          <span className="text-[10px] font-semibold text-stone-400">v{template.version}</span>
                          {template.required && <Badge className="border-logo-200 bg-logo-50 text-logo-700">Obligatoria</Badge>}
                          {template.legalStatus === 'aprobada' && !template.active && <Badge className="border-stone-300 bg-stone-100 text-stone-500">Retirada</Badge>}
                          {!template.requiresSignature && <Badge className="border-stone-200 bg-stone-50 text-stone-600">Informativa</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-500">{template.description || 'Sin descripción.'}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
                          <span>{template.specialty || 'Transversal'}</span>
                          <span>{SIGNER_RULE_LABELS[template.signerRule] || template.signerRule}</span>
                          <span>{template.fields.length} campo(s)</span>
                          {template.validityDays ? <span>Vigencia {template.validityDays} días</span> : null}
                          {template.legalReviewedBy && <span>Revisada por {template.legalReviewedBy} · {template.legalReviewedAt ? formatDate(template.legalReviewedAt) : ''}</span>}
                        </div>
                        {!usable && template.legalStatus === 'aprobada' && (
                          <p className="mt-1 text-[10px] text-amber-700">Aprobada pero inactiva: no se ofrece en el generador.</p>
                        )}
                        {template.legalStatus === 'pendiente_revision' && (
                          <p className="mt-1 text-[10px] text-amber-700">No utilizable hasta que se registre la aprobación y esté activa.</p>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 flex-wrap items-center gap-1 lg:justify-end">
                        <button className={btnGhost + ' !px-2.5 text-xs'} onClick={() => setPreviewTemplate(template)} title="Vista previa de ejemplo">
                          <Eye size={14} />
                        </button>
                        <button className={btnGhost + ' !px-2.5 text-xs'} onClick={() => openEdit(template)} title="Editar o crear nueva versión">
                          <FileCheck2 size={14} /> Editar
                        </button>
                        {template.legalStatus === 'pendiente_revision' && (
                          <button className={btnSecondary + ' !px-2.5 !py-1.5 text-xs'} onClick={() => openApproval(template)}>
                            <ClipboardCheck size={14} /> Aprobar
                          </button>
                        )}
                        {template.legalStatus === 'aprobada' && (
                          <button
                            className={(template.active ? btnDanger : btnSecondary) + ' !px-2.5 !py-1.5 text-xs'}
                            onClick={() => changeActive(template, !template.active)}
                          >
                            {template.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                            {template.active ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!filtered.length && (
              <div className="py-10 text-center text-sm text-stone-500">No hay plantillas que coincidan con los filtros.</div>
            )}
          </div>
        </SectionCard>
      )}

      <Modal
        open={editorOpen}
        onClose={() => { if (!saving) { setEditorOpen(false); setEditing(null); } }}
        title={editing ? (editing.legalStatus === 'aprobada' ? 'Nueva versión de plantilla' : 'Editar plantilla pendiente') : 'Nueva plantilla'}
        subtitle={editing ? `${editing.name} · versión ${editing.version}` : 'Se creará como pendiente de revisión'}
        size="xl"
        accent="bg-sky-700"
        footer={
          <>
            <button className={btnGhost} onClick={() => { setEditorOpen(false); setEditing(null); }} disabled={saving}>Cancelar</button>
            <button className={btnPrimary} onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            {editing?.legalStatus === 'aprobada' && (
              <InlineAlert level="warning" title="Se creará una nueva versión">
                La versión aprobada actual quedará retirada. La nueva versión nace pendiente de revisión y no se podrá usar hasta su aprobación. Los documentos ya generados conservan su snapshot y no cambian.
              </InlineAlert>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre" required className="sm:col-span-2">
                <input className={inputClass} value={draft.name || ''} onChange={e => updateDraft({ name: e.target.value })} />
              </Field>
              <Field label="Categoría" required>
                <select className={inputClass} value={draft.category || 'general'} onChange={e => updateDraft({ category: e.target.value as DocumentCategory })}>
                  {DOCUMENT_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Especialidad">
                <select className={inputClass} value={draft.specialty || ''} onChange={e => updateDraft({ specialty: (e.target.value || null) as ClinicalSpecialty | null })}>
                  <option value="">Transversal</option>
                  {CLINICAL_SPECIALTIES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Descripción" className="sm:col-span-2">
                <input className={inputClass} value={draft.description || ''} onChange={e => updateDraft({ description: e.target.value })} />
              </Field>
              <Field label="Regla de firmantes">
                <select className={inputClass} value={draft.signerRule || 'manual'} onChange={e => updateDraft({ signerRule: e.target.value as DocumentTemplate['signerRule'] })} disabled={!draft.requiresSignature}>
                  {Object.entries(SIGNER_RULE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </Field>
              <Field label="Vigencia (días)" hint="Vacío = sin caducidad automática.">
                <input className={inputClass} type="number" min={0} value={draft.validityDays ?? ''} onChange={e => updateDraft({ validityDays: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={draft.requiresSignature !== false} onChange={e => updateDraft({ requiresSignature: e.target.checked, signerRule: e.target.checked ? (draft.signerRule || 'manual') : 'manual' })} />
                Requiere firma
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={!!draft.required} onChange={e => updateDraft({ required: e.target.checked })} />
                Documento obligatorio para el paciente
              </label>
            </div>
            <Field label="Texto de la plantilla" required hint="Marcadores: {{campo}}, {{campo || 'texto alternativo'}}, {{#if campo}}...{{/if}}, {{#unless campo}}...{{/unless}}. No se permite HTML ni código.">
              <textarea className={inputClass + ' min-h-[330px] font-mono !text-[11px] leading-relaxed'} value={draft.body || ''} onChange={e => updateDraft({ body: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">Campos de la plantilla</p>
                <p className="text-[10px] text-stone-500">Los campos automáticos se rellenan desde la ficha y no se pueden sobrescribir.</p>
              </div>
              <button className={btnSecondary + ' !px-2.5 !py-1.5 text-xs'} onClick={addField}><Plus size={13} /> Añadir campo</button>
            </div>
            {(draft.fields || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">
                Sin campos manuales. El documento se generará solo con datos de la ficha. Añade campos si necesitas recoger información adicional.
              </div>
            )}
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {(draft.fields || []).map((field, index) => (
                <div key={`${field.key}-${index}`} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Campo {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button className="rounded p-1 text-stone-400 hover:bg-stone-100" onClick={() => moveField(index, -1)} title="Subir"><ChevronUp size={13} /></button>
                      <button className="rounded p-1 text-stone-400 hover:bg-stone-100" onClick={() => moveField(index, 1)} title="Bajar"><ChevronDown size={13} /></button>
                      <button className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeField(index)} title="Eliminar"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Clave interna" required>
                      <input className={inputClass + ' !py-2 font-mono !text-[11px]'} value={field.key} onChange={e => updateField(index, { key: e.target.value })} />
                    </Field>
                    <Field label="Etiqueta visible" required>
                      <input className={inputClass + ' !py-2'} value={field.label} onChange={e => updateField(index, { label: e.target.value })} />
                    </Field>
                    <Field label="Tipo">
                      <select className={inputClass + ' !py-2'} value={field.type} onChange={e => updateField(index, { type: e.target.value as DocumentTemplateFieldType })}>
                        {fieldTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Auto-relleno">
                      <select
                        className={inputClass + ' !py-2'}
                        value={field.autoFill || ''}
                        onChange={e => updateField(index, { autoFill: (e.target.value || null) as DocumentAutoFillKey | null, editable: !e.target.value })}
                      >
                        <option value="">Manual</option>
                        {autoFillOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </Field>
                    {field.type === 'select' && (
                      <Field label="Opciones (separadas por coma)" className="sm:col-span-2">
                        <input className={inputClass + ' !py-2'} value={(field.options || []).join(', ')} onChange={e => updateField(index, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })} />
                      </Field>
                    )}
                    <Field label="Ayuda / placeholder" className="sm:col-span-2">
                      <input className={inputClass + ' !py-2'} value={field.help || ''} onChange={e => updateField(index, { help: e.target.value })} placeholder="Texto de ayuda que verá el profesional" />
                    </Field>
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input type="checkbox" checked={field.required} onChange={e => updateField(index, { required: e.target.checked })} />
                      Obligatorio
                    </label>
                    <span className="text-[10px] text-stone-400">{field.autoFill ? 'Automático · solo lectura' : 'Manual · editable por el profesional'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title="Vista previa de ejemplo"
        subtitle={previewTemplate ? `${previewTemplate.name} · v${previewTemplate.version}` : ''}
        size="xl"
        accent="bg-stone-700"
        footer={<button className={btnPrimary} onClick={() => setPreviewTemplate(null)}>Cerrar</button>}
      >
        {previewTemplate && sampleRendered ? (
          <div className="space-y-3">
            <InlineAlert level="info" title="Datos ficticios">
              Esta vista usa un paciente, un profesional y un centro de ejemplo. Sirve para comprobar el formato y los bloques condicionales, no para validar el contenido jurídico.
            </InlineAlert>
            <DocumentPreview
              title={previewTemplate.name}
              text={sampleRendered.text}
              templateName={previewTemplate.name}
              templateVersion={previewTemplate.version}
              centerName={settings?.centerName || 'Sinestesya'}
              contentSha256="vista previa sin snapshot"
            />
            {sampleRendered.missingRequired.length > 0 && (
              <InlineAlert level="warning" title="Marcadores sin resolver en el ejemplo">
                {Array.from(new Set(sampleRendered.missingRequired)).join(', ')}
              </InlineAlert>
            )}
          </div>
        ) : <p className="text-sm text-stone-500">No se pudo generar la vista previa.</p>}
      </Modal>

      <Modal
        open={!!approvalTarget}
        onClose={() => { if (!approving) setApprovalTarget(null); }}
        title="Aprobar plantilla"
        subtitle={approvalTarget?.name}
        size="md"
        accent="bg-fisio-700"
        footer={
          <>
            <button className={btnGhost} onClick={() => setApprovalTarget(null)} disabled={approving}>Cancelar</button>
            <button className={btnPrimary} onClick={approve} disabled={approving || !reviewConfirm || !reviewer.trim()}>
              <ShieldCheck size={15} /> {approving ? 'Aprobando…' : 'Registrar aprobación'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <InlineAlert level="warning" title="No es una validación jurídica automática">
            Al aprobar, la plantilla pasa a estar disponible. Registra quién ha revisado realmente el texto y la fecha. Si la revisión no está hecha, cancela.
          </InlineAlert>
          <Field label="Revisado por (nombre y cargo)" required>
            <input className={inputClass} value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Nombre · DPO / asesoría jurídica" />
          </Field>
          <Field label="Fecha de revisión" required>
            <input className={inputClass} type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
          </Field>
          <Field label="Notas de revisión">
            <textarea className={inputClass + ' min-h-[80px]'} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Cambios solicitados, limitaciones, referencia del informe…" />
          </Field>
          {previewTemplate?.legalStatus === 'aprobada' && (
            <InlineAlert level="info" title="Versión anterior">La nueva versión sustituirá a la anterior en el generador.</InlineAlert>
          )}
          <label className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${reviewConfirm ? 'border-fisio-300 bg-fisio-50 text-fisio-900' : 'border-stone-300 text-stone-600'}`}>
            <input type="checkbox" className="mt-0.5" checked={reviewConfirm} onChange={e => setReviewConfirm(e.target.checked)} />
            <span>Confirmo que la plantilla ha sido revisada y que puedo acreditar quién, cuándo y con qué alcance. Entiendo que la aprobación queda auditada y que no equivale a una certificación legal externa.</span>
          </label>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentTemplates;
