import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, CheckCircle2, Clock, Download, FileClock, Fingerprint, History,
  KeyRound, MailCheck, RefreshCw, Send, ShieldCheck, ShieldX, UserRound, XCircle,
} from 'lucide-react';
import {
  DocumentEvent, DocumentTemplate, PatientDocument, Patient, User,
} from '../../types';
import { Badge, InlineAlert, Modal, SectionCard, btnGhost, btnPrimary, btnSecondary } from '../ui';
import DocumentPreview from './DocumentPreview';
import {
  ASSURANCE_LABELS, DOCUMENT_STATUS_META, SIGNATURE_CONDITION_LABELS, categoryMeta,
} from '../../services/documentTemplates';
import { documentNeedsAttention, sha256Hex } from '../../services/documentService';
import { dbService } from '../../services/dbService';
import { formatDate } from '../../constants';

interface Props {
  open: boolean;
  document: PatientDocument | null;
  template?: DocumentTemplate | null;
  patient: Patient;
  user: User;
  onClose: () => void;
  onSend: (document: PatientDocument) => void;
  onNewVersion: (document: PatientDocument) => void;
  onRevoke: (document: PatientDocument) => void;
  onDownload: (document: PatientDocument) => void;
  downloading?: boolean;
}

const eventIcon = (type: string) => {
  if (['signed', 'verified', 'archived', 'delivered', 'approved'].includes(type)) return <CheckCircle2 size={14} className="text-fisio-600" />;
  if (['rejected', 'error', 'expired', 'revoked'].includes(type)) return <XCircle size={14} className="text-red-500" />;
  if (['sent', 'otp_sent', 'external_upload'].includes(type)) return <MailCheck size={14} className="text-logo-600" />;
  if (['accessed', 'otp_verified'].includes(type)) return <KeyRound size={14} className="text-amber-600" />;
  if (['downloaded'].includes(type)) return <Download size={14} className="text-stone-500" />;
  return <FileClock size={14} className="text-stone-400" />;
};

const DocumentDetailModal: React.FC<Props> = ({
  open, document, template, patient, user, onClose, onSend, onNewVersion, onRevoke, onDownload, downloading,
}) => {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [integrity, setIntegrity] = useState<'checking' | 'ok' | 'fail' | 'unknown'>('unknown');

  useEffect(() => {
    if (!open || !document) return;
    let cancelled = false;
    setLoadingEvents(true);
    setEvents([]);
    setIntegrity('checking');
    dbService.getDocumentEvents(document.id)
      .then(list => { if (!cancelled) setEvents(list); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoadingEvents(false); });

    if (!document.contentSha256) {
      setIntegrity('unknown');
    } else {
      const material = [
        document.patientId, document.templateId || '', String(document.templateVersion || 0),
        document.title, document.category, document.renderedText || '',
      ].join('\n');
      sha256Hex(material)
        .then(hash => { if (!cancelled) setIntegrity(hash === document.contentSha256 ? 'ok' : 'fail'); })
        .catch(() => { if (!cancelled) setIntegrity('unknown'); });
    }
    return () => { cancelled = true; };
  }, [open, document?.id, document?.contentSha256]);

  if (!open || !document) return null;

  const meta = DOCUMENT_STATUS_META[document.status];
  const category = categoryMeta(document.category);
  const signed = document.status === 'firmado' || document.status === 'archivado' || !!document.signedAt;
  const closed = ['firmado', 'archivado', 'revocado', 'sustituido', 'rechazado'].includes(document.status);
  const canSend = !closed && !!template && document.status !== 'firmado';
  const signatures = document.evidence?.signatures || document.signers.filter(s => s.status === 'firmado').map(s => ({
    name: s.name, conditionLabel: SIGNATURE_CONDITION_LABELS[s.condition], signedAt: s.signedAt,
    verificationMethod: s.verificationMethod, assurance: s.assurance,
  }));

  const statusIcon = signed ? <CheckCircle2 size={17} /> : documentNeedsAttention(document) ? <AlertTriangle size={17} /> : <Clock size={17} />;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={document.title}
      subtitle={`${patient.firstName} ${patient.lastName} · ${meta.label}`}
      size="xl"
      accent={signed ? 'bg-fisio-600' : documentNeedsAttention(document) ? 'bg-amber-600' : 'bg-stone-700'}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>Cerrar</button>
          <button className={btnSecondary} onClick={() => onDownload(document)} disabled={downloading}>
            <Download size={15} /> {downloading ? 'Generando…' : signed ? 'Descargar PDF firmado' : 'Descargar copia'}
          </button>
          {!closed && <button className={btnSecondary} onClick={() => onNewVersion(document)}><RefreshCw size={15} /> Nueva versión</button>}
          {!closed && <button className={btnSecondary} onClick={() => onRevoke(document)}><XCircle size={15} /> Revocar</button>}
          {canSend && <button className={btnPrimary} onClick={() => onSend(document)}><Send size={15} /> Enviar a firma</button>}
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={`rounded-xl border p-3 ${meta.tone}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">{statusIcon} {meta.label}</div>
            <p className="mt-1 text-[11px] opacity-80">{meta.description}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Categoría y versión</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge className={category.tone}>{category.short}</Badge>
              <span className="text-[11px] text-stone-600">Documento v{document.version}</span>
              <span className="text-[11px] text-stone-600">Plantilla v{document.templateVersion}</span>
            </div>
          </div>
          <div className={`rounded-xl border p-3 ${
            integrity === 'ok' ? 'border-fisio-200 bg-fisio-50 text-fisio-900'
              : integrity === 'fail' ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-stone-200 bg-stone-50 text-stone-600'
          }`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {integrity === 'ok' ? <ShieldCheck size={16} /> : integrity === 'fail' ? <ShieldX size={16} /> : <Fingerprint size={16} />}
              {integrity === 'ok' ? 'Integridad verificada' : integrity === 'fail' ? 'Integridad no verificada' : integrity === 'checking' ? 'Comprobando huella…' : 'Sin huella calculada'}
            </div>
            <p className="mt-1 break-all text-[9px] opacity-80">{document.contentSha256 || 'Este documento demo no tiene huella de contenido.'}</p>
          </div>
        </div>

        {integrity === 'fail' && (
          <InlineAlert level="danger" title="No se debe usar esta copia">
            El texto actual no coincide con la huella del snapshot. No se ha permitido modificar un documento firmado; si aparece esta alerta, conserva el archivo y contacta con soporte.
          </InlineAlert>
        )}

        <DocumentPreview
          title={document.title}
          text={document.renderedText}
          contentSha256={document.contentSha256}
          templateName={document.templateName}
          templateVersion={document.templateVersion}
          version={document.version}
          centerName={document.centerSnapshot?.centerName || 'Sinestesya'}
          documentId={document.id}
          assurance={document.signatureAssurance}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Evidencias de firma" description="Identidad declarada, condición y método">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Nivel</p><p className="font-semibold text-stone-700">{document.signatureAssurance ? ASSURANCE_LABELS[document.signatureAssurance] : 'No consta'}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Proveedor</p><p className="font-semibold text-stone-700">{document.signatureProvider || 'No consta'}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Generado</p><p className="font-semibold text-stone-700">{formatDate(document.createdAt, true)}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Enviado</p><p className="font-semibold text-stone-700">{document.sentAt ? formatDate(document.sentAt, true) : 'No enviado'}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Firmado</p><p className="font-semibold text-stone-700">{document.signedAt ? formatDate(document.signedAt, true) : 'Pendiente'}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-stone-400">Caducidad enlace</p><p className="font-semibold text-stone-700">{document.expiresAt ? formatDate(document.expiresAt, true) : '—'}</p></div>
              </div>
              <div className="space-y-2">
                {document.signers.length === 0 && <p className="text-xs text-stone-500">Todavía no se han definido firmantes.</p>}
                {document.signers.map(signer => (
                  <div key={signer.id} className="rounded-lg border border-stone-200 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-stone-800">{signer.name}</p>
                        <p className="text-[10px] text-stone-500">{SIGNATURE_CONDITION_LABELS[signer.condition]} · {signer.required ? 'Obligatoria' : 'Opcional'}</p>
                      </div>
                      <Badge className={signer.status === 'firmado' ? 'border-fisio-200 bg-fisio-50 text-fisio-700' : signer.status === 'error' || signer.status === 'rechazado' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                        {signer.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-stone-500">{signer.verificationMethod || 'Método no registrado'}</p>
                    {signer.signedAt && <p className="text-[10px] text-stone-400">Firmado {formatDate(signer.signedAt, true)}</p>}
                  </div>
                ))}
              </div>
              {signed && document.signedPdfSha256 && (
                <div className="rounded-lg bg-fisio-50 px-3 py-2 text-[10px] text-fisio-900">
                  <p className="font-semibold">SHA-256 del PDF firmado</p>
                  <p className="mt-0.5 break-all font-mono">{document.signedPdfSha256}</p>
                </div>
              )}
              {signatures.length > 0 && (
                <div className="rounded-lg border border-stone-200 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Anexo de firmas</p>
                  {signatures.map((signature: any, index: number) => (
                    <div key={index} className="mt-1 text-[10px] text-stone-600">
                      <span className="font-semibold text-stone-800">{signature.name}</span> · {signature.conditionLabel || signature.condition} · {signature.signedAt ? formatDate(signature.signedAt, true) : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Historial y trazabilidad" description="Eventos inmutables del documento">
            {loadingEvents ? (
              <p className="text-xs text-stone-500">Cargando historial…</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-stone-500">Sin eventos registrados.</p>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {events.map(event => (
                  <div key={event.id} className="flex items-start gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-2.5 py-2">
                    <div className="mt-0.5">{eventIcon(event.type)}</div>
                    <div className="min-w-0">
                      <p className="text-[11px] leading-snug text-stone-700">{event.detail}</p>
                      <p className="mt-0.5 text-[9px] text-stone-400">{formatDate(event.createdAt, true)} · {event.actorName} · {event.actorType}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {(document.revokedAt || document.revocationReason) && (
          <InlineAlert level="danger" title="Documento revocado">
            {document.revocationReason || 'Sin motivo registrado.'} · {document.revokedAt ? formatDate(document.revokedAt, true) : ''}
          </InlineAlert>
        )}
        {document.status === 'sustituido' && document.replacedByDocumentId && (
          <InlineAlert level="info" title="Documento sustituido">
            Se conserva por trazabilidad. La versión vigente es el documento {document.replacedByDocumentId.slice(0, 12)}…
          </InlineAlert>
        )}
        {document.expiresAt && !signed && new Date(document.expiresAt).getTime() <= Date.now() && (
          <InlineAlert level="warning" title="Enlace caducado">
            El enlace ya no es válido. Si el documento sigue siendo necesario, genera una nueva versión o un nuevo envío.
          </InlineAlert>
        )}
        {document.externalUpload && (
          <InlineAlert level="info" title="Documento externo">
            La plataforma verifica la integridad del archivo desde su incorporación. No acredita por sí sola la identidad del firmante ni la validez jurídica del proveedor externo.
          </InlineAlert>
        )}
        {template?.legalStatus === 'aprobada' && (
          <p className="text-[10px] text-stone-400">Plantilla aprobada por {template.legalReviewedBy || 'revisor no registrado'} · {template.legalReviewedAt ? formatDate(template.legalReviewedAt, true) : 'fecha no registrada'}.</p>
        )}
      </div>
    </Modal>
  );
};

export default DocumentDetailModal;
