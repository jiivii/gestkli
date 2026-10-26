import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, CheckCircle2, ChevronRight, Clock, Download, Eye, FileCheck2, FileText,
  Filter, FolderOpen, History, MailWarning, Plus, RefreshCw, Search, Send, Settings2, ShieldAlert,
  ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CenterSettings, DocumentTemplate, Patient, PatientDocument, Permission,
} from '../../types';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, SectionCard, StatCard, btnGhost, btnPrimary,
  btnSecondary, btnDanger, inputClass,
} from '../ui';
import {
  DOCUMENT_CATEGORIES, DOCUMENT_STATUS_META, SIGNATURE_CONDITION_LABELS, categoryMeta, isMinorAge,
} from '../../services/documentTemplates';
import {
  documentNeedsAttention, downloadDocumentPdf, getDocumentCapabilities, revokeDocument,
} from '../../services/documentService';
import { dbService } from '../../services/dbService';
import {
  canManagePatientDocument, canViewPatientDocument, getClinicalSpecialty, hasPermission, isAdmin,
} from '../../services/permissions';
import { formatDate, patientFullName } from '../../constants';
import GeneratorModal from './GeneratorModal';
import SendModal from './SendModal';
import DocumentDetailModal from './DocumentDetailModal';
import ExternalUploadModal from './ExternalUploadModal';

interface Props {
  patient: Patient;
  user: import('../../types').User;
}

const closedStatuses = ['firmado', 'archivado', 'revocado', 'sustituido', 'entregado'];

const PatientDocumentsPanel: React.FC<Props> = ({ patient, user }) => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof getDocumentCapabilities>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [replaceDocument, setReplaceDocument] = useState<PatientDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailDocument, setDetailDocument] = useState<PatientDocument | null>(null);
  const [sendDocument, setSendDocument] = useState<PatientDocument | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PatientDocument | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const minor = isMinorAge(patient.birthDate);

  const canManage = hasPermission(user, 'documents.manage');
  const canTemplates = hasPermission(user, 'documents.templates.manage');

  const canUseTemplate = (template: DocumentTemplate): boolean => {
    if (hasPermission(user, 'clinical.view.all')) return true;
    if (isAdmin(user)) {
      return !template.specialty && ['privacidad', 'general', 'menores'].includes(template.category);
    }
    const specialty = getClinicalSpecialty(user);
    if (template.specialty) return template.specialty === specialty;
    return true;
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [docs, tpls, cfg] = await Promise.all([
        dbService.getPatientDocuments(patient.id),
        dbService.getDocumentTemplates(false),
        dbService.getSettings(),
      ]);
      setDocuments(docs.filter(doc => canViewPatientDocument(user, doc)));
      setTemplates(tpls.filter(canUseTemplate));
      setSettings(cfg);
      getDocumentCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la documentación del paciente.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patient.id, user.id]);

  const documentTemplate = (doc: PatientDocument) =>
    templates.find(t => t.id === doc.templateId) || null;

  const missingRequired = useMemo(() => {
    return templates.filter(template => {
      if (!template.required) return false;
      if (template.category === 'menores' && !minor) return false;
      if (template.specialty && !(patient.assignedSpecialties || []).includes(template.specialty)) return false;
      const done = documents.some(doc =>
        doc.isCurrent
        && doc.templateId === template.id
        && (template.requiresSignature
          ? ['firmado', 'archivado'].includes(doc.status)
          : ['entregado', 'archivado'].includes(doc.status)),
      );
      return !done;
    });
  }, [templates, documents, patient.assignedSpecialties, minor]);

  const attention = documents.filter(documentNeedsAttention);
  const reviewPending = documents.filter(d => ['borrador', 'pendiente_revision'].includes(d.status));
  const expired = documents.filter(d =>
    d.expiresAt
    && new Date(d.expiresAt).getTime() <= Date.now()
    && !['firmado', 'archivado', 'revocado', 'sustituido', 'entregado'].includes(d.status)
  );
  const signedCount = documents.filter(d => ['firmado', 'archivado'].includes(d.status)).length;
  const pendingCount = documents.filter(d => ['enviado', 'pendiente_firma'].includes(d.status)).length;

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...documents]
      .filter(doc => {
        if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
        if (!term) return true;
        return `${doc.title} ${doc.templateName} ${doc.category} ${doc.status} ${doc.professionalName || ''}`
          .toLowerCase().includes(term);
      })
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [documents, search, categoryFilter, statusFilter]);

  const openGenerator = (replace?: PatientDocument | null) => {
    setReplaceDocument(replace || null);
    setGeneratorOpen(true);
  };

  const handleCreated = async (doc: PatientDocument, ready: boolean) => {
    setGeneratorOpen(false);
    setReplaceDocument(null);
    await load(true);
    if (ready && doc.status === 'listo_para_enviar') {
      setSendDocument(doc);
    } else {
      setDetailDocument(doc);
      setNotice(doc.status === 'entregado' ? 'Documento informativo entregado y registrado.' : 'Documento guardado en el expediente.');
    }
  };

  const download = async (doc: PatientDocument) => {
    setDownloadingId(doc.id);
    setError('');
    try {
      await downloadDocumentPdf(doc, user);
      setNotice(doc.signedAt ? 'Copia firmada descargada. La descarga ha quedado auditada.' : 'Copia del documento descargada.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo descargar el documento.');
    } finally {
      setDownloadingId('');
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    if (!revokeReason.trim()) {
      setError('Indica el motivo de la revocación.');
      return;
    }
    setRevoking(true);
    setError('');
    try {
      const updated = await revokeDocument(revokeTarget, user, revokeReason);
      setRevokeTarget(null);
      setRevokeReason('');
      setDetailDocument(updated);
      setNotice('Documento revocado. Los archivos firmados y su historial se conservan.');
      await load(true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo revocar el documento.');
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <SectionCard title="Documentación y consentimientos">
        <div className="flex items-center gap-3 py-10 text-sm text-stone-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
          Cargando documentación del paciente…
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {(error || notice) && (
        <InlineAlert level={error ? 'danger' : 'success'} title={error ? 'Incidencia documental' : 'Registro actualizado'}>
          <div className="flex items-start justify-between gap-3">
            <span>{error || notice}</span>
            <button className="text-xs underline" onClick={() => { setError(''); setNotice(''); }}>Cerrar</button>
          </div>
        </InlineAlert>
      )}

      {capabilities?.demo && (
        <InlineAlert level="warning" title="Entorno de demostración documental">
          Los enlaces y OTP funcionan solo en este navegador. Las firmas se etiquetan como «sin validez jurídica». Para producción se requiere Supabase, correo transaccional y un proveedor de firma configurado.
        </InlineAlert>
      )}

      {!capabilities?.demo && capabilities && !capabilities.providerConfigured && (
        <InlineAlert level="danger" title="Firma no configurada en el servidor">
          No se enviarán documentos hasta configurar el correo y el proveedor de firma. No se simulará una firma válida. {capabilities.warnings[0] || ''}
        </InlineAlert>
      )}

      {minor && !patient.legalGuardian && (
        <InlineAlert level="danger" title="Representación legal incompleta">
          El paciente es menor y no consta representante legal. No generes ni envíes documentos de representación hasta completar la ficha y verificar la patria potestad o tutela.
        </InlineAlert>
      )}

      {minor && patient.representationType === 'patria_potestad_conjunta' && !patient.secondaryLegalGuardian && (
        <InlineAlert level="warning" title="Representación conjunta sin segundo progenitor">
          Consta patria potestad conjunta, pero solo hay un representante. No se presupone que una firma sea suficiente: revisa la documentación y la legislación aplicable antes de enviar.
        </InlineAlert>
      )}

      {missingRequired.length > 0 && (
        <InlineAlert
          level="warning"
          title={`Documentación obligatoria pendiente (${missingRequired.length})`}
          action={canManage ? <button className={btnSecondary + ' text-xs'} onClick={() => openGenerator()}><Plus size={13} /> Generar</button> : undefined}
        >
          <ul className="mt-1 space-y-0.5">
            {missingRequired.slice(0, 4).map(template => <li key={template.id}>· {template.name}</li>)}
            {missingRequired.length > 4 && <li>· y {missingRequired.length - 4} más</li>}
          </ul>
        </InlineAlert>
      )}

      {expired.length > 0 && (
        <InlineAlert level="warning" title={`${expired.length} enlace(s) caducado(s)`}>
          Los enlaces caducados no permiten firmar. Genera un nuevo envío o una nueva versión si el documento sigue siendo necesario.
        </InlineAlert>
      )}

      {reviewPending.length > 0 && (
        <InlineAlert level="info" title={`${reviewPending.length} documento(s) pendiente(s) de revisión`}>
          Revisa la versión exacta antes de enviar. Un borrador no se considera entregado ni firmado.
        </InlineAlert>
      )}

      {!templates.length && (
        <InlineAlert
          level="warning"
          title="No hay plantillas aprobadas y activas"
          action={canTemplates ? <button className={btnSecondary + ' text-xs'} onClick={() => navigate('/document-templates')}>Abrir gestor</button> : undefined}
        >
          Un administrador autorizado debe revisar y aprobar la biblioteca inicial antes de generar documentos. Las plantillas pendientes no se pueden usar.
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Documentos" value={documents.length} icon={FolderOpen} hint="Incluye versiones históricas" />
        <StatCard title="Firmados" value={signedCount} icon={CheckCircle2} tone="green" hint="Con evidencia archivada" />
        <StatCard title="Pendientes de firma" value={pendingCount} icon={Clock} tone="orange" hint="Enlaces activos" />
        <StatCard title="Requieren atención" value={attention.length + missingRequired.length} icon={AlertTriangle} tone="red" hint="Incidencias o documentación obligatoria" />
      </div>

      <SectionCard
        title="Documentación y consentimientos"
        description="Información, bases jurídicas, autorizaciones, firmas y evidencias"
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {canTemplates && (
                <button className={btnGhost + ' !px-2.5 text-xs'} onClick={() => navigate('/document-templates')} title="Gestionar plantillas">
                  <Settings2 size={14} />
                </button>
              )}
              <button className={btnSecondary + ' !px-3 !py-2 text-xs'} onClick={() => setUploadOpen(true)}>
                <Upload size={14} /> Subir firmado
              </button>
              <button className={btnPrimary + ' !px-3 !py-2 text-xs'} onClick={() => openGenerator()}>
                <Plus size={14} /> Generar documento
              </button>
            </div>
          ) : undefined
        }
        padded={false}
      >
        <div className="flex flex-col gap-2 border-b border-stone-100 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className={inputClass + ' pl-9'}
              placeholder="Buscar por título, plantilla, profesional…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select className={inputClass + ' !w-auto min-w-[145px]'} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {DOCUMENT_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.short}</option>)}
            </select>
            <select className={inputClass + ' !w-auto min-w-[145px]'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              {Object.entries(DOCUMENT_STATUS_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
            </select>
          </div>
        </div>

        {visibleDocuments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length ? 'Sin resultados' : 'Sin documentación registrada'}
            description={documents.length
              ? 'Ajusta los filtros o la búsqueda.'
              : 'Genera la información de privacidad, los consentimientos y la documentación clínica aplicable. No se crean documentos automáticamente sin revisión.'}
            action={canManage && !documents.length ? <button className={btnPrimary} onClick={() => openGenerator()}><Plus size={15} /> Generar primer documento</button> : undefined}
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {visibleDocuments.map(doc => {
              const meta = DOCUMENT_STATUS_META[doc.status];
              const category = categoryMeta(doc.category);
              const template = documentTemplate(doc);
              const templateUsable = !!template;
              const isClosed = closedStatuses.includes(doc.status);
              const manageable = canManagePatientDocument(user, doc);
              const canSend = manageable && templateUsable && !isClosed && !doc.signedAt;
              const canNewVersion = manageable && templateUsable && doc.status !== 'sustituido';
              const canRevoke = manageable && !['revocado', 'sustituido'].includes(doc.status);
              return (
                <div key={doc.id} className={`px-4 py-3.5 transition-colors hover:bg-stone-50/70 ${doc.isCurrent ? '' : 'opacity-75'}`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setDetailDocument(doc)}
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        doc.status === 'firmado' || doc.status === 'archivado' ? 'bg-fisio-50 text-fisio-700'
                          : documentNeedsAttention(doc) ? 'bg-amber-50 text-amber-700'
                            : 'bg-stone-100 text-stone-500'
                      }`}
                      title="Ver documento"
                    >
                      {doc.status === 'firmado' || doc.status === 'archivado' ? <FileCheck2 size={18} />
                        : doc.status === 'entregado' ? <Archive size={18} />
                          : documentNeedsAttention(doc) ? <AlertTriangle size={18} /> : <FileText size={18} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button onClick={() => setDetailDocument(doc)} className="truncate text-left text-sm font-semibold text-stone-800 hover:text-stone-950">
                          {doc.title}
                        </button>
                        <Badge className={meta.tone}>{meta.label}</Badge>
                        <Badge className={category.tone}>{category.short}</Badge>
                        <span className="text-[10px] font-semibold text-stone-400">v{doc.version}</span>
                        {!doc.isCurrent && <Badge className="border-stone-300 bg-stone-100 text-stone-500">Histórico</Badge>}
                        {doc.externalUpload && <Badge className="border-logo-200 bg-logo-50 text-logo-700">Externo</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
                        <span>{doc.templateName} · plantilla v{doc.templateVersion}</span>
                        {doc.professionalName && <span>{doc.professionalName}</span>}
                        <span>Creado {formatDate(doc.createdAt)}</span>
                        {doc.sentAt && <span>Enviado {formatDate(doc.sentAt)}</span>}
                        {doc.signedAt && <span>Firmado {formatDate(doc.signedAt, true)}</span>}
                        {doc.expiresAt && !doc.signedAt && <span>Enlace hasta {formatDate(doc.expiresAt, true)}</span>}
                      </div>
                      {doc.signers.length > 0 && (
                        <p className="mt-1 truncate text-[10px] text-stone-500">
                          Firmantes: {doc.signers.map(s => `${s.name} (${SIGNATURE_CONDITION_LABELS[s.condition]}, ${s.status})`).join(' · ')}
                        </p>
                      )}
                      {doc.revocationReason && <p className="mt-1 text-[10px] text-red-600">Revocado: {doc.revocationReason}</p>}
                      {doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now() && !isClosed && (
                        <p className="mt-1 text-[10px] font-semibold text-amber-700">Enlace caducado · no permite firmar</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      <button className={btnGhost + ' !px-2'} onClick={() => setDetailDocument(doc)} title="Ver detalle y evidencias">
                        <Eye size={15} />
                      </button>
                      <button className={btnGhost + ' !px-2'} onClick={() => download(doc)} disabled={downloadingId === doc.id} title="Descargar copia">
                        <Download size={15} className={downloadingId === doc.id ? 'animate-pulse' : ''} />
                      </button>
                      {canSend && (
                        <button className={btnGhost + ' !px-2'} onClick={() => setSendDocument(doc)} title="Enviar a firma">
                          <Send size={15} />
                        </button>
                      )}
                      {canNewVersion && (
                        <button className={btnGhost + ' !px-2'} onClick={() => openGenerator(doc)} title="Crear nueva versión">
                          <RefreshCw size={15} />
                        </button>
                      )}
                      {canRevoke && (
                        <button className={btnGhost + ' !px-2 text-red-500 hover:bg-red-50 hover:text-red-700'} onClick={() => { setRevokeTarget(doc); setRevokeReason(''); }} title="Revocar documento">
                          <XCircle size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-[11px] leading-relaxed text-stone-600">
          <div className="flex items-center gap-2 font-semibold text-stone-800"><ShieldCheck size={15} /> Garantías del módulo</div>
          <ul className="mt-2 space-y-1">
            <li>· El texto firmado procede de un snapshot inmutable, no de la plantilla viva.</li>
            <li>· Los enlaces son únicos, caducan, se pueden revocar y exigen OTP.</li>
            <li>· La posesión del correo no se trata como prueba de identidad ni de representación.</li>
            <li>· Los documentos firmados no se sobrescriben; las correcciones crean una nueva versión.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[11px] leading-relaxed text-amber-900">
          <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={15} /> Límites que debes conocer</div>
          <ul className="mt-2 space-y-1">
            <li>· La firma OTP es firma electrónica simple verificada; no es cualificada ni avanzada eIDAS.</li>
            <li>· La firma demo no tiene validez jurídica.</li>
            <li>· La validez de la representación de menores debe revisarse según edad, madurez, capacidad y ley aplicable.</li>
            <li>· Las plantillas iniciales están pendientes de validación por el DPO/asesor jurídico.</li>
          </ul>
        </div>
      </div>

      {generatorOpen && settings && (
        <GeneratorModal
          open={generatorOpen}
          patient={patient}
          user={user}
          settings={settings}
          templates={templates}
          replaceDocument={replaceDocument}
          onClose={() => { setGeneratorOpen(false); setReplaceDocument(null); }}
          onCreated={handleCreated}
          onOpenTemplates={() => navigate('/document-templates')}
        />
      )}

      {uploadOpen && settings && (
        <ExternalUploadModal
          open={uploadOpen}
          patient={patient}
          user={user}
          settings={settings}
          onClose={() => setUploadOpen(false)}
          onCreated={async doc => {
            setUploadOpen(false);
            await load(true);
            setDetailDocument(doc);
            setNotice('Documento externo verificado y archivado en el expediente.');
          }}
        />
      )}

      {detailDocument && (
        <DocumentDetailModal
          open={!!detailDocument}
          document={documents.find(d => d.id === detailDocument.id) || detailDocument}
          template={documentTemplate(detailDocument)}
          patient={patient}
          user={user}
          onClose={() => setDetailDocument(null)}
          onSend={doc => { setDetailDocument(null); setSendDocument(doc); }}
          onNewVersion={doc => { setDetailDocument(null); openGenerator(doc); }}
          onRevoke={doc => { setDetailDocument(null); setRevokeTarget(doc); setRevokeReason(''); }}
          onDownload={download}
          downloading={downloadingId === detailDocument.id}
        />
      )}

      {sendDocument && settings && (
        <SendModal
          open={!!sendDocument}
          document={documents.find(d => d.id === sendDocument.id) || sendDocument}
          patient={patient}
          template={documentTemplate(sendDocument)}
          settings={settings}
          user={user}
          onClose={() => setSendDocument(null)}
          onSent={async doc => {
            await load(true);
            setSendDocument(doc);
          }}
        />
      )}

      <Modal
        open={!!revokeTarget}
        onClose={() => { setRevokeTarget(null); setRevokeReason(''); }}
        title="Revocar documento"
        subtitle={revokeTarget?.title}
        size="sm"
        accent="bg-red-600"
        footer={
          <>
            <button className={btnGhost} onClick={() => { setRevokeTarget(null); setRevokeReason(''); }} disabled={revoking}>Cancelar</button>
            <button className={btnDanger} onClick={confirmRevoke} disabled={revoking || !revokeReason.trim()}>
              <XCircle size={15} /> {revoking ? 'Revocando…' : 'Revocar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <InlineAlert level="danger" title="La revocación no borra el historial">
            Se invalidarán los enlaces pendientes. Si el documento ya estaba firmado, el PDF y sus evidencias se conservan como prueba y se marca como revocado; no se sobrescribe.
          </InlineAlert>
          <Field label="Motivo de la revocación" required>
            <textarea className={inputClass + ' min-h-[90px]'} value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Error en los datos, representación insuficiente, sustitución por nueva versión…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default PatientDocumentsPanel;
