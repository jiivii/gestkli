import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Copy, ExternalLink, Link2, Mail, Plus, Send, ShieldAlert, Trash2, UserRound,
} from 'lucide-react';
import {
  CenterSettings, DocumentTemplate, Patient, PatientDocument, SignatureCondition, User,
} from '../../types';
import { Badge, Field, InlineAlert, Modal, btnGhost, btnPrimary, btnSecondary, inputClass } from '../ui';
import {
  SendSignerInput, buildDocumentSigners, getDocumentCapabilities, getSignersFromDocument,
  markDocumentReady, sendForSignature, validateSignersForSend,
} from '../../services/documentService';
import { ASSURANCE_LABELS, SIGNATURE_CONDITION_LABELS, isMinorAge, signerEmailForCondition, signerNameForCondition } from '../../services/documentTemplates';
import { formatDate } from '../../constants';

interface Props {
  open: boolean;
  document: PatientDocument;
  patient: Patient;
  template?: DocumentTemplate | null;
  settings: CenterSettings;
  user: User;
  onClose: () => void;
  onSent: (document: PatientDocument) => void;
}

const conditions: SignatureCondition[] = ['paciente', 'representante_legal', 'representante_legal_2', 'tutor', 'profesional', 'otro'];

const SendModal: React.FC<Props> = ({ open, document, patient, template, settings, user, onClose, onSent }) => {
  const [signers, setSigners] = useState<SendSignerInput[]>([]);
  const [justification, setJustification] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [expires, setExpires] = useState(settings.documentSettings?.linkTtlHours || 72);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [resultLinks, setResultLinks] = useState<{ signerName: string; link: string; expiresAt: string }[]>([]);
  const [resultMessage, setResultMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof getDocumentCapabilities>> | null>(null);

  const minor = isMinorAge(patient.birthDate);
  const signedSigners = useMemo(() => document.signers.filter(s => s.status === 'firmado'), [document.signers]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setReviewed(false);
    setSending(false);
    setResultLinks([]);
    setResultMessage('');
    setCopied('');
    setExpires(settings.documentSettings?.linkTtlHours || 72);
    setJustification(`Envío de «${document.title}» para revisión y firma.`);
    const existing = getSignersFromDocument(document).filter(s => !document.signers.some(signed => signed.condition === s.condition && signed.status === 'firmado'));
    if (template) {
      const suggested = buildDocumentSigners(patient, template, existing.length ? existing : undefined);
      const cleaned = suggested.filter(s => !document.signers.some(signed => signed.condition === s.condition && signed.status === 'firmado'));
      setSigners(cleaned.length ? cleaned : [{
        name: signerNameForCondition(patient, minor ? 'representante_legal' : 'paciente'),
        email: signerEmailForCondition(patient, minor ? 'representante_legal' : 'paciente'),
        condition: minor ? 'representante_legal' : 'paciente',
        required: true,
      }]);
    } else {
      setSigners([]);
    }
    getDocumentCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
    // La inicialización solo depende de la apertura: no se reinicia si el padre
    // refresca el documento después de enviar y queremos conservar el resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = useMemo(
    () => template
      ? validateSignersForSend(patient, template, [
          ...document.signers
            .filter(s => s.status === 'firmado')
            .map(s => ({ name: s.name, email: s.email, condition: s.condition, required: s.required })),
          ...signers,
        ])
      : ['El documento no tiene una plantilla asociada.'],
    [patient, template, signers, document.signers],
  );

  if (!open) return null;

  const updateSigner = (index: number, patch: Partial<SendSignerInput>) => {
    setSigners(prev => prev.map((signer, i) => i === index ? { ...signer, ...patch } : signer));
  };

  const changeCondition = (index: number, condition: SignatureCondition) => {
    const current = signers[index];
    const name = current.name || signerNameForCondition(patient, condition);
    const email = current.email || signerEmailForCondition(patient, condition);
    updateSigner(index, { condition, name, email });
  };

  const addSigner = () => {
    const condition: SignatureCondition = patient.secondaryLegalGuardian && minor ? 'representante_legal_2'
      : patient.legalGuardian ? 'representante_legal' : 'paciente';
    if (signers.some(s => s.condition === condition)) {
      setError('Ya hay un firmante con esa condición. Ajusta la condición antes de añadir otro.');
      return;
    }
    setSigners(prev => [...prev, {
      name: signerNameForCondition(patient, condition),
      email: signerEmailForCondition(patient, condition),
      condition,
      required: true,
    }]);
  };

  const send = async () => {
    setError('');
    if (!template) {
      setError('No se puede enviar un documento sin plantilla aprobada.');
      return;
    }
    if (!reviewed) {
      setError('Confirma que has revisado la versión exacta y que los firmantes son correctos.');
      return;
    }
    if (errors.length) {
      setError(errors.join(' '));
      return;
    }
    setSending(true);
    try {
      let current = document;
      if (current.status === 'borrador' || current.status === 'pendiente_revision') {
        current = await markDocumentReady(current, user);
      }
      const response = await sendForSignature({
        document: current, patient, template, signers, actor: user, settings, justification,
        expiresInHours: expires,
      });
      onSent(response.document || current);
      setResultMessage(response.message);
      setResultLinks(response.demoLinks || []);
      if (!response.demoLinks?.length) {
        // En producción los enlaces se envían por correo; no se exponen en pantalla.
        setResultLinks([]);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el documento.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (link: string, signerName: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(signerName);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('No se pudo copiar el enlace. Selecciónalo manualmente.');
    }
  };

  const providerName = capabilities?.providerLabel || settings.documentSettings?.signatureProviderLabel || 'Sin proveedor comprobado';
  const assurance = capabilities?.assurance || settings.documentSettings?.signatureLevel || 'simple_verificada_otp';
  const hasResult = !!resultMessage;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hasResult ? 'Envío preparado' : 'Enviar a firma'}
      subtitle={document.title}
      size="lg"
      accent="bg-amber-600"
      footer={hasResult ? (
        <button className={btnPrimary} onClick={onClose}><CheckCircle2 size={15} /> Cerrar</button>
      ) : (
        <>
          <button className={btnGhost} onClick={onClose} disabled={sending}>Cancelar</button>
          <button className={btnPrimary} onClick={send} disabled={sending || !reviewed || !!errors.length || !signers.length}>
            <Send size={15} /> {sending ? 'Enviando…' : 'Enviar enlaces de firma'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {error && <InlineAlert level="danger" title="No se puede enviar">{error}</InlineAlert>}

        {hasResult ? (
          <div className="space-y-4">
            <InlineAlert level={resultLinks.length ? 'success' : 'info'} title="Documento enviado">
              {resultMessage}
            </InlineAlert>
            {resultLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Enlaces de demostración</p>
                {resultLinks.map(item => (
                  <div key={item.signerName + item.link} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{item.signerName}</p>
                        <p className="text-[10px] text-stone-500">Caduca {formatDate(item.expiresAt, true)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className={btnSecondary + ' !px-3 !py-1.5 text-xs'} onClick={() => copyLink(item.link, item.signerName)}>
                          <Copy size={13} /> {copied === item.signerName ? 'Copiado' : 'Copiar'}
                        </button>
                        <a href={item.link} target="_blank" rel="noreferrer" className={btnSecondary + ' !px-3 !py-1.5 text-xs'}>
                          <ExternalLink size={13} /> Abrir
                        </a>
                      </div>
                    </div>
                    <p className="mt-2 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-[9px] text-stone-500">{item.link}</p>
                    <p className="mt-2 text-[10px] text-amber-700">En demo el OTP se mostrará en la propia página. El enlace solo funciona en este navegador y no tiene validez jurídica.</p>
                  </div>
                ))}
              </div>
            )}
            {!resultLinks.length && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-600">
                Los enlaces se han enviado al correo de cada firmante. Por seguridad no se muestran en pantalla. El documento no será visible hasta que el firmante verifique el OTP.
              </div>
            )}
          </div>
        ) : (
          <>
            <InlineAlert level="info" title="Qué ocurre al enviar">
              Se generará un enlace único, impredecible y temporal para cada firmante. El correo solo acredita el control del buzón: no prueba por sí solo la identidad ni la representación legal. El acceso exigirá OTP y quedará auditado.
            </InlineAlert>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs sm:grid-cols-3">
              <div><span className="block text-[10px] uppercase tracking-wide text-stone-400">Nivel efectivo</span><span className="font-semibold text-stone-800">{ASSURANCE_LABELS[assurance]}</span></div>
              <div><span className="block text-[10px] uppercase tracking-wide text-stone-400">Proveedor</span><span className="font-semibold text-stone-800">{providerName}</span></div>
              <div><span className="block text-[10px] uppercase tracking-wide text-stone-400">Caducidad</span><span className="font-semibold text-stone-800">{expires} h</span></div>
            </div>
            {capabilities?.warnings?.map(warning => (
              <InlineAlert key={warning} level="warning" title="Configuración pendiente">{warning}</InlineAlert>
            ))}
            {minor && (
              <InlineAlert level="warning" title="Paciente menor de edad">
                No se presupone que una sola firma parental sea suficiente. Revisa la representación registrada, la edad y madurez del menor y el tipo de documento. Condiciones registradas: {patient.representationType || 'no consta'}.
              </InlineAlert>
            )}
            {document.status !== 'listo_para_enviar' && document.status !== 'pendiente_firma' && (
              <InlineAlert level="warning" title="Revisión previa">
                Este documento está en estado «{document.status}». Al enviar se marcará como revisado y listo para firma. Confirma solo después de leer la versión exacta.
              </InlineAlert>
            )}
            {signedSigners.length > 0 && (
              <InlineAlert level="success" title="Firmas ya registradas">
                {signedSigners.map(s => SIGNATURE_CONDITION_LABELS[s.condition]).join(', ')}. No se volverá a enviar a esas condiciones.
              </InlineAlert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Firmantes</p>
                <button className={btnSecondary + ' !px-3 !py-1.5 text-xs'} onClick={addSigner} disabled={signers.length >= 6}>
                  <Plus size={13} /> Añadir
                </button>
              </div>
              {signers.map((signer, index) => (
                <div key={`${signer.condition}-${index}`} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><UserRound size={15} /></div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{signer.name || 'Firmante sin nombre'}</p>
                        <p className="text-[10px] text-stone-500">{SIGNATURE_CONDITION_LABELS[signer.condition]}</p>
                      </div>
                    </div>
                    {signers.length > 1 && (
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => setSigners(prev => prev.filter((_, i) => i !== index))} aria-label="Quitar firmante">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Nombre completo" required>
                      <input className={inputClass} value={signer.name} onChange={e => updateSigner(index, { name: e.target.value })} />
                    </Field>
                    <Field label="Correo electrónico" required>
                      <input className={inputClass} type="email" value={signer.email} onChange={e => updateSigner(index, { email: e.target.value })} />
                    </Field>
                    <Field label="Condición">
                      <select className={inputClass} value={signer.condition} onChange={e => changeCondition(index, e.target.value as SignatureCondition)}>
                        {conditions.map(condition => <option key={condition} value={condition}>{SIGNATURE_CONDITION_LABELS[condition]}</option>)}
                      </select>
                    </Field>
                    <Field label="Obligatoria">
                      <label className="flex h-[42px] items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm">
                        <input type="checkbox" checked={signer.required} onChange={e => updateSigner(index, { required: e.target.checked })} />
                        <span>Su firma es necesaria</span>
                      </label>
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <InlineAlert level="warning" title="Revisa los firmantes">
                <ul className="list-disc space-y-0.5 pl-4">
                  {Array.from(new Set(errors)).map(errorItem => <li key={errorItem}>{errorItem}</li>)}
                </ul>
              </InlineAlert>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Caducidad del enlace (horas)" className="sm:col-span-1">
                <input className={inputClass} type="number" min={1} max={168} value={expires} onChange={e => setExpires(Number(e.target.value) || 72)} />
              </Field>
              <Field label="Justificación del envío" className="sm:col-span-2" required>
                <input className={inputClass} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Motivo y contexto del envío" />
              </Field>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-stone-300 bg-white p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />
              <span>
                <strong className="block text-stone-800">He revisado la versión exacta que se enviará</strong>
                <span className="text-xs leading-relaxed text-stone-500">He comprobado identidad, representación, datos del centro, cláusulas y firmantes. Entiendo que el documento quedará inmutable y que cualquier corrección exigirá una nueva versión.</span>
              </span>
            </label>

            <div className="flex items-start gap-2 rounded-xl border border-logo-200 bg-logo-50/70 p-3 text-[11px] leading-relaxed text-logo-900">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              <p>No se enviará información clínica en el correo. Solo un aviso genérico y un enlace. El firmante verá el contenido tras verificar el OTP. Si el enlace se reenvía, el OTP sigue siendo necesario y el acceso queda registrado.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-stone-500">
              <Mail size={13} /> El correo se envía a {signers.map(s => s.email).filter(Boolean).join(', ') || 'los firmantes indicados'}.
              <Link2 size={13} /> Enlaces de un solo uso para cada firma.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SendModal;
