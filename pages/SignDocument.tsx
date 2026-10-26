import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileCheck2, FileText, Fingerprint, KeyRound,
  Loader2, LockKeyhole, Mail, RefreshCw, ShieldCheck, ShieldX, XCircle,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  ASSURANCE_LABELS, SIGNATURE_CONDITION_LABELS,
} from '../services/documentTemplates';
import {
  PublicSignatureDocument, PublicSignaturePreview, getPublicSignatureDocument,
  getPublicSignaturePreview, rejectPublicDocument, requestSignatureOtp, signPublicDocument,
  verifySignatureOtp,
} from '../services/documentService';
import DocumentPreview from '../components/documents/DocumentPreview';
import { formatDate } from '../constants';

const sessionKey = (token: string) => `sinestesya_sign_session_${token}`;

const saveSession = (token: string, sessionToken: string) => {
  try { sessionStorage.setItem(sessionKey(token), sessionToken); } catch { /* sesión efímera */ }
};
const readSession = (token: string): string | null => {
  try { return sessionStorage.getItem(sessionKey(token)); } catch { return null; }
};
const clearSession = (token: string) => {
  try { sessionStorage.removeItem(sessionKey(token)); } catch { /* noop */ }
};

const base64ToBlob = (base64: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
};

const downloadSigned = (base64: string, title: string) => {
  const url = URL.createObjectURL(base64ToBlob(base64));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'documento'}-firmado.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
};

type Stage = 'loading' | 'landing' | 'otp' | 'document' | 'signed' | 'rejected' | 'error';

const SignDocument: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<PublicSignaturePreview | null>(null);
  const [document, setDocument] = useState<PublicSignatureDocument | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedPdfBase64, setSignedPdfBase64] = useState('');
  const [signedPdfSha256, setSignedPdfSha256] = useState('');
  const [allSigned, setAllSigned] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.document.title = 'Firmar documento · Sinestesya';
    const init = async () => {
      if (!token) {
        setError('Enlace no válido.');
        setStage('error');
        return;
      }
      const result = await getPublicSignaturePreview(token);
      if (!result.ok) {
        setError(result.error || 'Enlace no válido o caducado.');
        setStage('error');
        return;
      }
      setPreview(result);
      setMaskedEmail(result.recipientEmailMasked || '');
      setStage('landing');
      const stored = readSession(token);
      if (stored) {
        const restored = await getPublicSignatureDocument(token, stored);
        if (restored.ok && restored.document) {
          setSessionToken(stored);
          setDocument(restored.document);
          if (restored.document.status === 'firmado' || restored.document.signedAt) {
            setStage('signed');
            setAllSigned(!!restored.document.allSigned);
            setSignedPdfSha256(restored.document.signedPdfSha256 || '');
          } else {
            setStage('document');
            setSignerName(restored.document.signerName || restored.document.recipientName || '');
          }
        } else {
          clearSession(token);
        }
      }
    };
    init();
  }, [token]);

  useEffect(() => {
    if (stage !== 'document') return;
    const timer = window.setTimeout(() => {
      const node = contentRef.current;
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + 12) setReachedEnd(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [stage, document?.documentId]);

  const requestOtp = async () => {
    setRequestingOtp(true);
    setError('');
    try {
      const result = await requestSignatureOtp(token);
      if (!result.ok) {
        setError(result.error || 'No se pudo enviar el código.');
        return;
      }
      setOtpSent(true);
      setDemoCode(result.demoCode || '');
      setMaskedEmail(result.maskedEmail || maskedEmail);
      setStage('otp');
    } finally {
      setRequestingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setError('Introduce el código de verificación.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const result = await verifySignatureOtp(token, otp.trim());
      if (!result.ok || !result.document || !result.sessionToken) {
        setError(result.error || 'Código no válido.');
        return;
      }
      saveSession(token, result.sessionToken);
      setSessionToken(result.sessionToken);
      setDocument(result.document);
      setSignerName(result.document.signerName || result.document.recipientName || '');
      setStage('document');
      setReachedEnd(false);
    } finally {
      setVerifying(false);
    }
  };

  const onScroll = () => {
    const node = contentRef.current;
    if (!node) return;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 40) setReachedEnd(true);
  };

  const sign = async () => {
    if (!document) return;
    if (!reachedEnd || !readConfirmed || !identityConfirmed || !accepted) {
      setError('Debes leer el documento completo y marcar todas las confirmaciones.');
      return;
    }
    if (document.authorityRequired && !authorityConfirmed) {
      setError('Confirma tu condición de representante legal o tutor.');
      return;
    }
    if (!signerName.trim()) {
      setError('Indica el nombre completo del firmante.');
      return;
    }
    setSigning(true);
    setError('');
    try {
      const result = await signPublicDocument({
        token, sessionToken, signerName,
        accepted, authorityConfirmed, readConfirmed, identityConfirmed,
      });
      if (!result.ok || !result.document) {
        setError(result.error || 'No se pudo completar la firma.');
        return;
      }
      setDocument(result.document);
      setSignedPdfBase64(result.signedPdfBase64 || '');
      setSignedPdfSha256(result.signedPdfSha256 || '');
      setAllSigned(!!result.allSigned);
      setStage('signed');
      clearSession(token);
    } finally {
      setSigning(false);
    }
  };

  const reject = async () => {
    if (!document) return;
    setRejecting(true);
    setError('');
    try {
      const result = await rejectPublicDocument({ token, sessionToken, reason: rejectReason });
      if (!result.ok) {
        setError(result.error || 'No se pudo registrar el rechazo.');
        return;
      }
      setRejectOpen(false);
      setStage('rejected');
      clearSession(token);
    } finally {
      setRejecting(false);
    }
  };

  const reassurance = (assurance?: string) => ASSURANCE_LABELS[assurance as keyof typeof ASSURANCE_LABELS] || 'Firma electrónica';

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#f7f5f0] px-4 py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">Sinestesya · Salud Integral</p>
            <h1 className="font-display text-xl text-stone-900 md:text-2xl">Firma de documentación</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-stone-500 shadow-sm">
            <ShieldCheck size={19} />
          </div>
        </header>
        {children}
        <footer className="mt-6 space-y-1 text-center text-[10px] leading-relaxed text-stone-400">
          <p>Sinestesya Villarroya S.L. · Documentación con trazabilidad, control de acceso y verificación de integridad.</p>
          <p>Si no esperabas este enlace, no introduzcas ningún código y contacta con el centro.</p>
        </footer>
      </div>
    </div>
  );

  if (stage === 'loading') {
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white py-16 text-stone-500">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">Comprobando enlace seguro…</p>
      </div>,
    );
  }

  if (stage === 'error') {
    return shell(
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><ShieldX size={24} /></div>
        <h2 className="mt-3 font-display text-lg text-stone-900">No se puede abrir este documento</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-stone-600">{error}</p>
        <p className="mt-3 text-xs text-stone-500">Por seguridad no mostramos el contenido sin un enlace válido. Solicita uno nuevo al centro si lo necesitas.</p>
      </div>,
    );
  }

  if (stage === 'rejected') {
    return shell(
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><XCircle size={24} /></div>
        <h2 className="mt-3 font-display text-lg text-stone-900">Rechazo registrado</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">No se ha firmado el documento. El centro podrá revisar el motivo y contactarte si es necesario.</p>
      </div>,
    );
  }

  if (stage === 'signed' && document) {
    return shell(
      <div className="space-y-4">
        <div className="rounded-2xl border border-fisio-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fisio-50 text-fisio-700"><CheckCircle2 size={24} /></div>
          <h2 className="mt-3 font-display text-xl text-stone-900">Firma registrada</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-stone-600">
            {allSigned
              ? 'Todas las firmas requeridas están completas. El documento queda archivado en tu expediente y no puede modificarse.'
              : 'Tu firma se ha registrado. El documento sigue pendiente de otras firmas obligatorias.'}
          </p>
          {signedPdfSha256 && (
            <p className="mt-3 break-all rounded-lg bg-stone-50 px-3 py-2 text-[10px] text-stone-500">
              Huella SHA-256 del PDF: {signedPdfSha256}
            </p>
          )}
          {signedPdfBase64 && (
            <button
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
              onClick={() => downloadSigned(signedPdfBase64, document.title)}
            >
              <Download size={16} /> Descargar copia firmada
            </button>
          )}
          {!signedPdfBase64 && (
            <p className="mt-3 text-xs text-stone-500">La copia firmada está disponible en el expediente del centro. Puedes solicitarla si necesitas otro duplicado.</p>
          )}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-600">
          <div className="flex items-center gap-2 font-semibold text-stone-800"><FileCheck2 size={15} /> Datos de la firma</div>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Documento</dt><dd className="font-semibold text-stone-700">{document.title}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Condición</dt><dd className="font-semibold text-stone-700">{SIGNATURE_CONDITION_LABELS[document.condition]}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Firmante</dt><dd className="font-semibold text-stone-700">{signerName || document.recipientName}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Fecha</dt><dd className="font-semibold text-stone-700">{document.signedAt ? formatDate(document.signedAt, true) : '—'}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Nivel</dt><dd className="font-semibold text-stone-700">{reassurance(document.assurance)}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-stone-400">Verificación</dt><dd className="font-semibold text-stone-700">{document.verificationMethod}</dd></div>
          </dl>
        </div>
        <p className="text-center text-[10px] text-stone-400">Conserva esta copia. El centro conserva el original firmado con sus evidencias y trazabilidad.</p>
      </div>,
    );
  }

  if (stage === 'landing' && preview) {
    return shell(
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><FileText size={20} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{preview.centerName}</p>
              <h2 className="mt-0.5 text-lg font-semibold leading-snug text-stone-900">{preview.title}</h2>
              <p className="mt-1 text-sm text-stone-600">Para {preview.recipientName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2"><Mail size={14} className="text-stone-400" /> Código a {preview.recipientEmailMasked || maskedEmail}</div>
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2"><Clock size={14} className="text-stone-400" /> Enlace válido hasta {preview.expiresAt ? formatDate(preview.expiresAt, true) : '—'}</div>
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2"><KeyRound size={14} className="text-stone-400" /> Verificación por OTP</div>
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2"><Fingerprint size={14} className="text-stone-400" /> Huella de integridad SHA-256</div>
          </div>
          {preview.isDemo && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>Entorno de demostración: el código aparece en pantalla y la firma no tiene validez jurídica.</p>
            </div>
          )}
          {preview.status === 'firmado' && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-fisio-200 bg-fisio-50 px-3 py-2 text-[11px] leading-relaxed text-fisio-900">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <p>Este enlace ya fue utilizado para firmar. Si necesitas una copia, solicítala al centro.</p>
            </div>
          )}
          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
            onClick={requestOtp}
            disabled={requestingOtp || preview.status === 'firmado'}
          >
            {requestingOtp ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
            {requestingOtp ? 'Enviando código…' : 'Verificar mi identidad y leer el documento'}
          </button>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <p className="mt-3 text-center text-[10px] leading-relaxed text-stone-400">
            El contenido no se muestra hasta verificar el código enviado al correo del firmante. La posesión del enlace no acredita por sí sola la identidad ni la representación.
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-[11px] leading-relaxed text-stone-500">
          <strong className="text-stone-700">Nivel de firma:</strong> {reassurance(preview.assurance)}. Se trata de una firma electrónica simple verificada por OTP; no es una firma electrónica cualificada eIDAS salvo que el proveedor configurado lo indique expresamente.
        </div>
      </div>,
    );
  }

  if (stage === 'otp') {
    return shell(
      <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-800"><Mail size={16} /> Introduce el código de verificación</div>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Hemos enviado un código temporal a <strong>{maskedEmail || preview?.recipientEmailMasked}</strong>. Caduca en unos minutos y no debe compartirse.
        </p>
        {demoCode && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Demostración: el código es <strong className="font-mono text-sm">{demoCode}</strong>
          </div>
        )}
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="sign-otp">Código OTP</label>
        <input
          id="sign-otp"
          className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-stone-900 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
        />
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
          onClick={verifyOtp}
          disabled={verifying || otp.trim().length < 4}
        >
          {verifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {verifying ? 'Verificando…' : 'Verificar y ver el documento'}
        </button>
        <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50" onClick={requestOtp} disabled={requestingOtp}>
          <RefreshCw size={13} /> {requestingOtp ? 'Solicitando…' : 'Solicitar otro código'}
        </button>
      </div>,
    );
  }

  if (stage === 'document' && document) {
    const canSign = reachedEnd && readConfirmed && identityConfirmed && accepted
      && (!document.authorityRequired || authorityConfirmed)
      && signerName.trim().length > 1;
    return shell(
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{document.centerName}</p>
              <h2 className="mt-0.5 text-lg font-semibold leading-snug text-stone-900">{document.title}</h2>
              <p className="mt-1 text-xs text-stone-500">Versión {document.version} · {SIGNATURE_CONDITION_LABELS[document.condition]} · {document.recipientEmailMasked}</p>
            </div>
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-semibold text-stone-600">{reassurance(document.assurance)}</span>
          </div>
          {document.minorWarning && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {document.minorWarning}
            </div>
          )}
          {document.isDemo && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Entorno demo: firma sin validez jurídica.
            </div>
          )}
        </div>

        <div ref={contentRef} onScroll={onScroll} className="max-h-[52vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 md:max-h-[58vh] md:p-6">
          <DocumentPreview
            title={document.title}
            text={document.renderedText}
            contentSha256={document.contentSha256}
            centerName={document.centerName}
            documentId={document.documentId}
            version={document.version}
            assurance={document.assurance}
            showHeader={false}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-stone-500">
          <span>{reachedEnd ? 'Has llegado al final del documento.' : 'Desplázate hasta el final para poder firmar.'}</span>
          {!reachedEnd && <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><Clock size={12} /> Lectura en curso</span>}
        </div>

        <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="signer-name">Nombre completo del firmante</label>
          <input
            id="signer-name"
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            autoComplete="name"
          />
          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
            <input type="checkbox" className="mt-0.5" checked={readConfirmed} onChange={e => setReadConfirmed(e.target.checked)} />
            <span>He leído el documento completo y he podido descargarlo o consultarlo antes de firmar.</span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
            <input type="checkbox" className="mt-0.5" checked={identityConfirmed} onChange={e => setIdentityConfirmed(e.target.checked)} />
            <span>Confirmo que soy la persona destinataria y que el nombre indicado corresponde a mi identidad.</span>
          </label>
          {document.authorityRequired && (
            <label className="flex items-start gap-2.5 rounded-xl border border-logo-200 bg-logo-50/60 px-3 py-2.5 text-xs leading-relaxed text-logo-900">
              <input type="checkbox" className="mt-0.5" checked={authorityConfirmed} onChange={e => setAuthorityConfirmed(e.target.checked)} />
              <span>Actúo como representante legal o tutor con capacidad suficiente para este documento y asumo esa condición.</span>
            </label>
          )}
          <label className="flex items-start gap-2.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
            <span><strong>Doy mi consentimiento y firmo electrónicamente.</strong> Entiendo que el contenido quedará congelado y que la firma se archivará con evidencias de fecha, verificación y dispositivo.</span>
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fisio-700 px-4 py-3 text-sm font-semibold text-white hover:bg-fisio-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={sign}
            disabled={signing || !canSign}
          >
            {signing ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
            {signing ? 'Registrando firma…' : 'Firmar electrónicamente'}
          </button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50" onClick={() => setRejectOpen(true)} disabled={signing}>
            <XCircle size={13} /> No acepto / rechazar firma
          </button>
          <p className="pt-1 text-center text-[10px] leading-relaxed text-stone-400">
            {document.verificationMethod}. La firma no se considerará completada hasta que el servidor verifique la integridad del documento y registre la evidencia.
          </p>
        </div>

        {rejectOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="font-display text-lg text-stone-900">Rechazar la firma</h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">No se firmará el documento. El centro verá el motivo y podrá contactarte.</p>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="reject-reason">Motivo (opcional)</label>
              <textarea id="reject-reason" className="mt-1 min-h-[90px] w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-500" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explica brevemente por qué no aceptas…" />
              {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100" onClick={() => setRejectOpen(false)} disabled={rejecting}>Volver</button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60" onClick={reject} disabled={rejecting}>
                  {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Rechazar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>,
    );
  }

  return shell(
    <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center text-sm text-stone-500">
      <Loader2 size={20} className="mx-auto animate-spin" />
      <p className="mt-2">Preparando el documento…</p>
    </div>,
  );
};

export default SignDocument;
