import {
  CenterSettings, ClinicalSpecialty, DocumentEvent, DocumentEventType, DocumentSettings, DocumentSigner,
  DocumentSignatureRequest, DocumentTemplate, Patient, PatientDocument, SignatureAssurance,
  SignatureCondition, User,
} from '../types';
import { dbService, isDemoMode } from './dbService';
import { supabase } from '../supabaseClients';
import {
  DEFAULT_DOCUMENT_SETTINGS, buildAutoValues, isMinorAge, renderTemplate,
  signerEmailForCondition, signerNameForCondition, suggestedSignerConditions, templateIsUsable,
} from './documentTemplates';
import { generateDocumentPdf, bytesToBase64, base64ToBytes } from '../lib/documentPdf';
import { patientFullName } from '../constants';

// ============================================================
//  Servicio de documentación y firma
//  - La generación usa snapshots: nunca lee la plantilla viva al firmar.
//  - Los tokens y OTP solo se guardan como hash.
//  - En demo no se envía correo real; se muestra un correo simulado.
// ============================================================

export interface GeneratedDocumentResult {
  document: PatientDocument;
  missingFields: string[];
}

export interface SendSignerInput {
  name: string;
  email: string;
  condition: SignatureCondition;
  required: boolean;
}

export interface SendResult {
  ok: boolean;
  message: string;
  document?: PatientDocument;
  demoLinks?: { signerName: string; link: string; expiresAt: string }[];
}

export interface PublicSignaturePreview {
  ok: boolean;
  error?: string;
  title?: string;
  centerName?: string;
  recipientName?: string;
  recipientEmailMasked?: string;
  expiresAt?: string;
  status?: string;
  requiresOtp?: boolean;
  isDemo?: boolean;
  providerLabel?: string;
  assurance?: SignatureAssurance;
}

export interface PublicSignatureSession {
  ok: boolean;
  error?: string;
  document?: PublicSignatureDocument;
  sessionToken?: string;
}

export interface PublicSignatureDocument {
  requestId: string;
  documentId: string;
  title: string;
  category: string;
  version: number;
  recipientName: string;
  recipientEmailMasked: string;
  condition: SignatureCondition;
  renderedText: string;
  contentSha256: string;
  expiresAt: string;
  status: string;
  requiresOtp: boolean;
  assurance: SignatureAssurance;
  verificationMethod: string;
  centerName: string;
  providerLabel: string;
  signerName?: string;
  authorityRequired?: boolean;
  minorWarning?: string | null;
  signedAt?: string | null;
  signedPdfSha256?: string | null;
  isDemo: boolean;
  allSigned?: boolean;
}

export interface SignResponse {
  ok: boolean;
  error?: string;
  document?: PublicSignatureDocument;
  signedPdfBase64?: string;
  signedPdfSha256?: string;
  allSigned?: boolean;
}

// ------------------------------------------------------------
//  Utilidades criptográficas
// ------------------------------------------------------------

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (value: string | Uint8Array): Promise<string> => {
  const data = typeof value === 'string' ? encoder.encode(value) : value;
  if (!globalThis.crypto?.subtle) throw new Error('El navegador no permite calcular huellas criptográficas. Usa HTTPS.');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
};

const randomToken = (bytes = 32): string => {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const randomOtp = (): string => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
};

const nowIso = () => new Date().toISOString();

const addHours = (hours: number): string => new Date(Date.now() + hours * 3600000).toISOString();
const addMinutes = (minutes: number): string => new Date(Date.now() + minutes * 60000).toISOString();

const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return 'correo no disponible';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
};

const safeFileName = (value: string): string =>
  String(value || 'documento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'documento';

const publicUrlForToken = (token: string): string => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/sign/${encodeURIComponent(token)}`;
};

const getSettings = async (): Promise<CenterSettings> => dbService.getSettings();

const documentSettings = (settings: CenterSettings): DocumentSettings => ({
  ...DEFAULT_DOCUMENT_SETTINGS,
  ...(settings.documentSettings || {}),
});

const assuranceFor = (settings: CenterSettings): SignatureAssurance => {
  if (isDemoMode) return 'demo_sin_validez';
  const configured = documentSettings(settings);
  if (configured.signatureLevel === 'cualificada_proveedor' && configured.signatureProvider === 'external') return 'cualificada_proveedor';
  if (configured.signatureProvider === 'external') return 'avanzada_proveedor';
  return 'simple_verificada_otp';
};

const conditionLabel = (condition: SignatureCondition): string => {
  const map: Record<SignatureCondition, string> = {
    paciente: 'Paciente',
    representante_legal: 'Representante legal',
    representante_legal_2: 'Segundo representante legal',
    tutor: 'Tutor o tutora',
    profesional: 'Profesional',
    otro: 'Otra condición',
  };
  return map[condition] || condition;
};

// ------------------------------------------------------------
//  Solicitud autenticada a la API de producción
// ------------------------------------------------------------

const authedFetch = async (body: Record<string, any>): Promise<any> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
  const response = await fetch('/api/document-signing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Error del servidor documental (${response.status}).`);
  }
  return payload;
};

const publicFetch = async (body: Record<string, any>): Promise<any> => {
  const response = await fetch('/api/document-signing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `No se pudo completar la operación (${response.status}).`);
  }
  return payload;
};

// ------------------------------------------------------------
//  Construcción y validación de documentos
// ------------------------------------------------------------

const patientSnapshot = (patient: Patient): Record<string, any> => ({
  fullName: patientFullName(patient),
  firstName: patient.firstName,
  lastName: patient.lastName,
  dni: patient.dni,
  birthDate: patient.birthDate,
  isMinor: isMinorAge(patient.birthDate),
  address: patient.address,
  phone: patient.phone,
  email: patient.email,
  legalGuardian: patient.legalGuardian ? { ...patient.legalGuardian } : null,
  secondaryLegalGuardian: patient.secondaryLegalGuardian ? { ...patient.secondaryLegalGuardian } : null,
  representationType: patient.representationType || null,
  guardianshipNotes: patient.guardianshipNotes || '',
});

const centerSnapshot = (settings: CenterSettings): Record<string, any> => ({
  centerName: settings.centerName,
  legalName: settings.legalName,
  cif: settings.cif,
  address: settings.address,
  phone: settings.phone,
  email: settings.email,
  web: settings.web,
  dpoName: documentSettings(settings).dpoName,
  dpoEmail: documentSettings(settings).dpoEmail,
  privacyEmail: documentSettings(settings).privacyEmail,
  privacyNoticeVersion: documentSettings(settings).privacyNoticeVersion,
});

const professionalSnapshot = (professional: User): Record<string, any> => ({
  id: professional.id,
  name: professional.name,
  email: professional.email,
  phone: professional.phone || '',
  role: professional.role,
  specialty: professional.profession || professional.role,
});

const validateCenter = (settings: CenterSettings): string[] => {
  const missing: string[] = [];
  if (!settings.legalName?.trim()) missing.push('Razón social del centro');
  if (!settings.address?.trim()) missing.push('Domicilio del centro');
  if (!settings.email?.trim()) missing.push('Correo de contacto del centro');
  if (!settings.cif?.trim()) missing.push('CIF del centro');
  return missing;
};

const contentMaterial = (document: Partial<PatientDocument>): string => [
  document.patientId || '',
  document.templateId || '',
  String(document.templateVersion || 0),
  document.title || '',
  document.category || '',
  document.renderedText || '',
].join('\n');

const canonicalPayload = (document: Partial<PatientDocument>): string => contentMaterial(document);

export const buildDocumentSigners = (
  patient: Patient,
  template: DocumentTemplate,
  inputSigners?: SendSignerInput[],
): SendSignerInput[] => {
  if (inputSigners?.length) return inputSigners;
  return suggestedSignerConditions(template, patient).map(item => ({
    name: signerNameForCondition(patient, item.condition),
    email: signerEmailForCondition(patient, item.condition),
    condition: item.condition,
    required: item.required,
  }));
};

export const validateSignersForSend = (
  patient: Patient,
  template: DocumentTemplate,
  signers: SendSignerInput[],
): string[] => {
  const errors: string[] = [];
  const minor = isMinorAge(patient.birthDate);
  if (!signers.length) errors.push('Selecciona al menos un firmante.');
  if (!signers.some(s => s.required)) errors.push('Debe existir al menos un firmante obligatorio.');
  const duplicateConditions = signers
    .map(s => s.condition)
    .filter((condition, index, list) => list.indexOf(condition) !== index);
  if (duplicateConditions.length) {
    errors.push(`Hay condiciones de firma duplicadas: ${Array.from(new Set(duplicateConditions)).map(conditionLabel).join(', ')}.`);
  }

  for (const signer of signers) {
    if (!signer.name?.trim()) errors.push('Todos los firmantes deben tener nombre.');
    if (!/^\S+@\S+\.\S+$/.test(signer.email || '')) errors.push(`El correo de ${signer.name || 'un firmante'} no es válido.`);
    if (signer.condition === 'representante_legal' && !patient.legalGuardian) {
      errors.push('Falta el representante legal en la ficha del paciente.');
    }
    if (signer.condition === 'representante_legal_2' && !patient.secondaryLegalGuardian) {
      errors.push('Falta el segundo representante legal en la ficha del paciente.');
    }
    if (minor && signer.condition === 'paciente' && template.signerRule === 'guardian_only') {
      errors.push('Un documento exclusivo de representación legal no puede enviarse solo al menor.');
    }
  }

  if (minor && template.signerRule !== 'manual') {
    const hasRepresentative = signers.some(s => s.required && ['representante_legal', 'representante_legal_2', 'tutor'].includes(s.condition));
    if (!hasRepresentative) errors.push('El paciente es menor: falta una firma de representación legal.');
  }

  if (template.signerRule === 'guardian_both' && !patient.secondaryLegalGuardian) {
    errors.push('La plantilla exige valorar la firma de ambos representantes, pero solo consta uno en la ficha.');
  }
  if (template.signerRule === 'guardian_both' && patient.secondaryLegalGuardian) {
    const hasFirst = signers.some(s => s.required && s.condition === 'representante_legal');
    const hasSecond = signers.some(s => s.required && s.condition === 'representante_legal_2');
    if (!hasFirst || !hasSecond) {
      errors.push('Esta plantilla exige la firma de ambos representantes legales registrados. Añade las dos condiciones o cambia a una plantilla que solo requiera una.');
    }
  }

  if (signers.some(s => s.condition === 'representante_legal_2') && !patient.representationType) {
    errors.push('Indica el tipo de representación en la ficha antes de enviar a dos representantes.');
  }

  return Array.from(new Set(errors));
};

export const createDocumentDraft = async (params: {
  patient: Patient;
  template: DocumentTemplate;
  professional: User;
  settings: CenterSettings;
  fields: Record<string, any>;
  serviceName?: string | null;
  serviceId?: string | null;
  appointmentId?: string | null;
  replacesDocumentId?: string | null;
  version?: number;
}): Promise<GeneratedDocumentResult> => {
  const { patient, template, professional, settings, fields } = params;
  if (!templateIsUsable(template)) {
    throw new Error('La plantilla no está aprobada y activa. Un administrador autorizado debe revisarla antes de usarla.');
  }
  const centerMissing = validateCenter(settings);
  const autoValues = buildAutoValues({
    patient, professional, center: settings, serviceName: params.serviceName || '',
    documentVersion: params.version || 1,
  });
  const rendered = renderTemplate(template, { ...autoValues, ...fields });
  const missing = [...centerMissing, ...rendered.missingRequired];
  if (missing.length) {
    throw new Error(`Faltan datos obligatorios: ${Array.from(new Set(missing)).join(', ')}.`);
  }
  if (rendered.text.includes('{{')) {
    throw new Error('El documento contiene campos sin resolver. Revisa la plantilla antes de generar.');
  }

  // Validación de representación: no se inventan firmantes ni se presupone
  // que una única firma parental sea suficiente.
  if (isMinorAge(patient.birthDate)) {
    if (template.category === 'menores' && !patient.legalGuardian) {
      throw new Error('El paciente es menor y no consta representante legal. Completa la ficha antes de generar el documento.');
    }
    if (template.signerRule === 'guardian_both' && !patient.secondaryLegalGuardian) {
      throw new Error('La plantilla requiere valorar la representación de ambos progenitores/tutores, pero solo consta uno en la ficha.');
    }
  }

  const baseDocument: Partial<PatientDocument> = {
    patientId: patient.id,
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    category: template.category,
    specialty: template.specialty || null,
    professionalId: professional.id,
    professionalName: professional.name,
    serviceId: params.serviceId || null,
    serviceName: params.serviceName || null,
    appointmentId: params.appointmentId || null,
    title: template.name,
    status: 'borrador',
    version: params.version || 1,
    isCurrent: true,
    replacesDocumentId: params.replacesDocumentId || null,
    fields,
    patientSnapshot: patientSnapshot(patient),
    professionalSnapshot: professionalSnapshot(professional),
    centerSnapshot: centerSnapshot(settings),
    renderedText: rendered.text,
    signers: [],
    requiredSignatures: 0,
    signedCount: 0,
    signatureAssurance: assuranceFor(settings),
    signatureProvider: settings.documentSettings?.signatureProviderLabel || 'Sin proveedor configurado',
    notes: '',
  };
  baseDocument.contentSha256 = await sha256Hex(canonicalPayload(baseDocument));

  const saved = await dbService.savePatientDocument(baseDocument, professional);
  await dbService.addDocumentEvent({
    documentId: saved.id, patientId: patient.id, type: 'created', actorId: professional.id,
    actorName: professional.name, actorType: 'usuario',
    detail: `Documento generado desde «${template.name}» v${template.version}.`,
  });
  return { document: saved, missingFields: [] };
};

export const markDocumentReady = async (document: PatientDocument, actor: User): Promise<PatientDocument> => {
  const ready: PatientDocument = { ...document, status: 'listo_para_enviar' };
  const saved = await dbService.savePatientDocument(ready, actor);
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: document.patientId, type: 'ready', actorId: actor.id,
    actorName: actor.name, actorType: 'usuario', detail: 'Documento revisado y listo para enviar.',
  });
  return saved;
};

/** Documentos informativos: se registra la entrega revisada sin simular una firma. */
export const markDocumentDelivered = async (
  document: PatientDocument,
  actor: User,
  method = 'Entrega documental revisada y registrada en el expediente',
): Promise<PatientDocument> => {
  const delivered: PatientDocument = {
    ...document,
    status: 'entregado',
    sentAt: document.sentAt || nowIso(),
    notes: [document.notes, `Entrega registrada: ${method}`].filter(Boolean).join('\n'),
  };
  const saved = await dbService.savePatientDocument(delivered, actor);
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: document.patientId, type: 'delivered', actorId: actor.id,
    actorName: actor.name, actorType: 'usuario',
    detail: `Documento informativo entregado. ${method}`,
  });
  return saved;
};

export const getSignersFromDocument = (document: PatientDocument): SendSignerInput[] =>
  document.signers.map(s => ({ name: s.name, email: s.email, condition: s.condition, required: s.required }));

// ------------------------------------------------------------
//  Envío para firma
// ------------------------------------------------------------

export const sendForSignature = async (params: {
  document: PatientDocument;
  patient: Patient;
  template: DocumentTemplate;
  signers: SendSignerInput[];
  actor: User;
  settings: CenterSettings;
  justification: string;
  expiresInHours?: number;
}): Promise<SendResult> => {
  const { document, patient, template, signers, actor, settings, justification } = params;
  if (!justification.trim()) throw new Error('Indica la justificación del envío para la auditoría.');
  const alreadySigned = document.signers
    .filter(s => s.status === 'firmado')
    .map(s => ({ name: s.name, email: s.email, condition: s.condition, required: s.required }));
  const pendingConditions = new Set(alreadySigned.map(s => s.condition));
  const repeated = signers.filter(s => pendingConditions.has(s.condition));
  if (repeated.length) {
    throw new Error(`Ya existe una firma registrada para: ${repeated.map(s => conditionLabel(s.condition)).join(', ')}. No se puede volver a enviar esa condición.`);
  }
  const errors = validateSignersForSend(patient, template, [...alreadySigned, ...signers]);
  if (errors.length) throw new Error(errors.join(' '));
  if (document.status === 'firmado' || document.signedAt) {
    throw new Error('El documento ya está firmado. Genera una nueva versión si necesitas cambios.');
  }
  if (!document.contentSha256) throw new Error('El documento no tiene huella de integridad. Vuelve a generarlo.');

  const configured = documentSettings(settings);
  const assurance = assuranceFor(settings);
  const linkHours = Math.max(1, Math.min(168, Number(params.expiresInHours) || configured.linkTtlHours));

  if (!isDemoMode) {
    const payload = await authedFetch({
      action: 'send',
      documentId: document.id,
      signers,
      justification,
      expiresInHours: linkHours,
      provider: configured.signatureProvider,
    });
    const refreshed = await dbService.getPatientDocument(document.id);
    return {
      ok: true,
      message: payload?.message || 'Documento enviado para firma.',
      document: refreshed,
      demoLinks: [],
    };
  }

  // Demostración local: se crean peticiones con token y OTP hasheados.
  const expiresAt = addHours(linkHours);
  const createdRequests: DocumentSignatureRequest[] = [];
  const demoLinks: { signerName: string; link: string; expiresAt: string }[] = [];
  const newSigners: DocumentSigner[] = [];
  const priorSigned = document.signers.filter(s => s.status === 'firmado');

  // Al reenviar a los firmantes que faltan, los enlaces anteriores dejan de ser
  // utilizables. Las firmas ya registradas se conservan intactas.
  const previousRequests = await dbService.getDocumentSignatureRequests(document.id);
  for (const previous of previousRequests) {
    if (previous.status === 'pendiente' || previous.status === 'verificado') {
      await dbService.updateDocumentSignatureRequest(previous.id, {
        status: 'revocado',
        failureReason: 'Sustituido por un envío posterior.',
      });
    }
  }

  for (const signer of signers) {
    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const signerId = `sig-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    const request = await dbService.createDocumentSignatureRequest({
      documentId: document.id, patientId: patient.id, signerId,
      recipientName: signer.name, recipientEmail: signer.email, condition: signer.condition,
      tokenHash, expiresAt, createdBy: actor.id,
    });
    createdRequests.push(request);
    demoLinks.push({ signerName: signer.name, link: publicUrlForToken(token), expiresAt });
    newSigners.push({
      id: signerId, name: signer.name, email: signer.email, condition: signer.condition,
      required: signer.required, status: 'enviado', requestId: request.id, sentAt: nowIso(),
      assurance, verificationMethod: 'Demostración local: OTP + enlace de un solo uso',
      authorityConfirmed: false,
    });
  }

  const mergedSigners = [...priorSigned, ...newSigners];
  const signedCount = mergedSigners.filter(s => s.status === 'firmado').length;
  const requiredSignatures = mergedSigners.filter(s => s.required).length;
  const updated: PatientDocument = {
    ...document,
    signers: mergedSigners,
    requiredSignatures,
    signedCount,
    status: signedCount >= requiredSignatures ? 'firmado' : 'pendiente_firma',
    sentAt: nowIso(),
    expiresAt,
    signatureAssurance: assurance,
    signatureProvider: configured.signatureProviderLabel,
  };
  const saved = await dbService.savePatientDocument(updated, actor);
  for (const signer of newSigners) {
    await dbService.addDocumentEvent({
      documentId: document.id, patientId: patient.id, requestId: signer.requestId || null,
      type: 'sent', actorId: actor.id, actorName: actor.name, actorType: 'usuario',
      detail: `Enlace de firma generado para ${signer.name} (${conditionLabel(signer.condition)}). Justificación: ${justification.trim()}`,
      metadata: { recipientEmailMasked: maskEmail(signer.email), assurance, demo: true },
    });
  }

  return {
    ok: true,
    message: `Documento preparado para ${newSigners.length} firmante(s). En el entorno demo no se envía correo real.`,
    document: saved,
    demoLinks,
  };
};

export const revokeDocument = async (document: PatientDocument, actor: User, reason: string): Promise<PatientDocument> => {
  if (!reason.trim()) throw new Error('Indica el motivo de la revocación.');
  if (!isDemoMode) {
    await authedFetch({ action: 'revoke', documentId: document.id, reason });
    const refreshed = await dbService.getPatientDocument(document.id);
    if (!refreshed) throw new Error('No se pudo recuperar el documento revocado.');
    return refreshed;
  }
  const requests = await dbService.getDocumentSignatureRequests(document.id);
  for (const request of requests) {
    if (request.status === 'pendiente' || request.status === 'verificado') {
      await dbService.updateDocumentSignatureRequest(request.id, { status: 'revocado', failureReason: reason });
    }
  }
  const updated: PatientDocument = {
    ...document,
    status: 'revocado',
    revokedAt: nowIso(),
    revocationReason: reason.trim(),
    signers: document.signedAt
      ? document.signers
      : document.signers.map(s => s.status === 'firmado' ? s : { ...s, status: 'revocado' }),
    isCurrent: document.status === 'firmado' ? false : document.isCurrent,
  };
  const saved = await dbService.savePatientDocument(updated, actor);
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: document.patientId, type: 'revoked',
    actorId: actor.id, actorName: actor.name, actorType: 'usuario',
    detail: `Documento revocado. Motivo: ${reason.trim()}`,
  });
  return saved;
};

// ------------------------------------------------------------
//  Portal público de firma (demo local)
// ------------------------------------------------------------

const loadRequestByToken = async (token: string): Promise<DocumentSignatureRequest | undefined> => {
  const hash = await sha256Hex(token);
  return dbService.getSignatureRequestByTokenHash(hash);
};

/** Migración defensiva de los documentos demo antiguos sin huella. */
const ensureDemoDocumentHash = async (document: PatientDocument): Promise<PatientDocument> => {
  if (!isDemoMode || !document.demo || document.contentSha256) return document;
  const contentSha256 = await sha256Hex(contentMaterial(document));
  const saved = await dbService.savePatientDocument({ ...document, contentSha256 });
  return saved;
};

const checkRequestUsable = (request: DocumentSignatureRequest, allowSigned = false): string | null => {
  if (request.status === 'revocado') return 'Este enlace ha sido revocado. Solicita un enlace nuevo al centro.';
  if (request.status === 'rechazado') return 'El documento fue rechazado. Contacta con el centro si necesitas revisarlo.';
  if (request.status === 'firmado' && !allowSigned) return 'Este documento ya fue firmado con este enlace.';
  if (request.status === 'caducado') return 'Este enlace ha caducado. Solicita uno nuevo al centro.';
  if (request.status === 'error') return request.failureReason || 'La firma no se pudo verificar. Contacta con el centro.';
  if (new Date(request.expiresAt).getTime() <= Date.now()) return 'Este enlace ha caducado. Solicita uno nuevo al centro.';
  return null;
};

export const getPublicSignaturePreview = async (token: string): Promise<PublicSignaturePreview> => {
  if (!isDemoMode) {
    try {
      const payload = await publicFetch({ action: 'public-preview', token });
      return payload.preview;
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Enlace no válido.' };
    }
  }
  const request = await loadRequestByToken(token);
  if (!request) return { ok: false, error: 'Este enlace no es válido o ha dejado de estar disponible.' };
  const problem = checkRequestUsable(request, true);
  if (problem) return { ok: false, error: problem };
  const foundDocument = await dbService.getPatientDocument(request.documentId);
  if (!foundDocument) return { ok: false, error: 'Documento no encontrado.' };
  const document = await ensureDemoDocumentHash(foundDocument);
  if (document.patientId !== request.patientId) return { ok: false, error: 'El documento no corresponde a este enlace.' };
  return {
    ok: true,
    title: document.title,
    centerName: (document.centerSnapshot?.centerName || 'Sinestesya'),
    recipientName: request.recipientName,
    recipientEmailMasked: maskEmail(request.recipientEmail),
    expiresAt: request.expiresAt,
    status: request.status,
    requiresOtp: true,
    isDemo: true,
    providerLabel: document.signatureProvider || 'Entorno local de demostración',
    assurance: 'demo_sin_validez',
  };
};

export const requestSignatureOtp = async (token: string): Promise<{ ok: boolean; error?: string; demoCode?: string; maskedEmail?: string }> => {
  if (!isDemoMode) {
    try {
      const payload = await publicFetch({ action: 'public-request-otp', token });
      return { ok: true, maskedEmail: payload.maskedEmail };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'No se pudo enviar el código.' };
    }
  }
  const request = await loadRequestByToken(token);
  if (!request) return { ok: false, error: 'Enlace no válido.' };
  const problem = checkRequestUsable(request);
  if (problem) return { ok: false, error: problem };
  if (request.otpLastSentAt && Date.now() - new Date(request.otpLastSentAt).getTime() < 15000) {
    return { ok: false, error: 'Espera unos segundos antes de solicitar otro código.' };
  }
  const settings = await getSettings();
  const configured = documentSettings(settings);
  const code = randomOtp();
  const otpHash = await sha256Hex(code);
  await dbService.updateDocumentSignatureRequest(request.id, {
    otpHash, otpExpiresAt: addMinutes(configured.otpTtlMinutes),
    otpAttempts: 0, otpLastSentAt: nowIso(),
  });
  await dbService.addDocumentEvent({
    documentId: request.documentId, patientId: request.patientId, requestId: request.id,
    type: 'otp_sent', actorName: request.recipientName, actorType: 'firmante',
    detail: 'Código OTP generado para verificar la identidad (simulación demo; no se envía correo real).',
    metadata: { demo: true },
  });
  return { ok: true, demoCode: code, maskedEmail: maskEmail(request.recipientEmail) };
};

const buildPublicSignatureDocument = async (
  request: DocumentSignatureRequest,
  document: PatientDocument,
  settings: CenterSettings,
): Promise<PublicSignatureDocument> => {
  const signer = document.signers.find(s => s.id === request.signerId);
  const configured = documentSettings(settings);
  return {
    requestId: request.id,
    documentId: document.id,
    title: document.title,
    category: document.category,
    version: document.version,
    recipientName: request.recipientName,
    recipientEmailMasked: maskEmail(request.recipientEmail),
    condition: request.condition,
    renderedText: document.renderedText,
    contentSha256: document.contentSha256,
    expiresAt: request.expiresAt,
    status: request.status,
    requiresOtp: true,
    assurance: document.signatureAssurance || assuranceFor(settings),
    verificationMethod: isDemoMode
      ? 'Demostración: enlace de un solo uso + OTP local'
      : configured.signatureProvider === 'external'
        ? `Proveedor de firma: ${configured.signatureProviderLabel}`
        : 'Enlace seguro + OTP por correo',
    centerName: document.centerSnapshot?.centerName || settings.centerName,
    providerLabel: document.signatureProvider || configured.signatureProviderLabel,
    signerName: signer?.name || request.recipientName,
    authorityRequired: ['representante_legal', 'representante_legal_2', 'tutor'].includes(request.condition),
    minorWarning: request.condition === 'paciente' && document.patientSnapshot?.isMinor
      ? 'El paciente es menor. La firma del menor no sustituye la representación legal cuando sea exigible.'
      : null,
    signedAt: request.signedAt || null,
    signedPdfSha256: request.signedPdfSha256 || document.signedPdfSha256 || null,
    isDemo: isDemoMode,
    allSigned: document.status === 'firmado',
  };
};

export const verifySignatureOtp = async (
  token: string,
  code: string,
): Promise<PublicSignatureSession> => {
  if (!isDemoMode) {
    try {
      const payload = await publicFetch({ action: 'public-verify-otp', token, code });
      return { ok: true, document: payload.document, sessionToken: payload.sessionToken };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Código no válido.' };
    }
  }
  const request = await loadRequestByToken(token);
  if (!request) return { ok: false, error: 'Enlace no válido.' };
  const problem = checkRequestUsable(request);
  if (problem) return { ok: false, error: problem };
  if (!request.otpHash || !request.otpExpiresAt) return { ok: false, error: 'Solicita un código nuevo antes de continuar.' };
  if (new Date(request.otpExpiresAt).getTime() <= Date.now()) return { ok: false, error: 'El código ha caducado. Solicita uno nuevo.' };
  const settings = await getSettings();
  const maxAttempts = documentSettings(settings).otpMaxAttempts;
  if (request.otpAttempts >= maxAttempts) {
    await dbService.updateDocumentSignatureRequest(request.id, {
      status: 'error', failureReason: 'Se superó el número máximo de intentos de verificación.',
    });
    await dbService.addDocumentEvent({
      documentId: request.documentId, patientId: request.patientId, requestId: request.id,
      type: 'error', actorName: request.recipientName, actorType: 'sistema',
      detail: 'Se superó el número máximo de intentos OTP. El documento no se marca como firmado.',
    });
    return { ok: false, error: 'Se han superado los intentos permitidos. Solicita un enlace nuevo al centro.' };
  }
  const expected = await sha256Hex(code.trim());
  if (expected !== request.otpHash) {
    await dbService.updateDocumentSignatureRequest(request.id, { otpAttempts: request.otpAttempts + 1 });
    return { ok: false, error: `Código incorrecto. Intentos restantes: ${Math.max(0, maxAttempts - request.otpAttempts - 1)}.` };
  }

  const sessionToken = randomToken(32);
  const verificationHash = await sha256Hex(sessionToken);
  const verifiedAt = nowIso();
  const updatedRequest = await dbService.updateDocumentSignatureRequest(request.id, {
    status: 'verificado', verifiedAt, verificationHash,
    verificationExpiresAt: addMinutes(30), otpHash: null, otpExpiresAt: null,
  });
  if (!updatedRequest) return { ok: false, error: 'No se pudo verificar el enlace.' };
  const foundDocument = await dbService.getPatientDocument(request.documentId);
  if (!foundDocument) return { ok: false, error: 'Documento no encontrado.' };
  const document = await ensureDemoDocumentHash(foundDocument);
  await dbService.addDocumentEvent({
    documentId: request.documentId, patientId: request.patientId, requestId: request.id,
    type: 'otp_verified', actorName: request.recipientName, actorType: 'firmante',
    detail: 'Identidad verificada mediante OTP. Se muestra el documento completo (demo).',
    metadata: { demo: true },
  });
  return { ok: true, document: await buildPublicSignatureDocument(updatedRequest, document, settings), sessionToken };
};

export const getPublicSignatureDocument = async (
  token: string,
  sessionToken: string,
): Promise<PublicSignatureSession> => {
  if (!isDemoMode) {
    try {
      const payload = await publicFetch({ action: 'public-document', token, sessionToken });
      return { ok: true, document: payload.document };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Sesión de firma no válida.' };
    }
  }
  const request = await loadRequestByToken(token);
  if (!request) return { ok: false, error: 'Enlace no válido.' };
  const problem = checkRequestUsable(request, true);
  if (problem) return { ok: false, error: problem };
  if (!request.verificationHash || !request.verificationExpiresAt) return { ok: false, error: 'Verifica tu identidad antes de acceder al documento.' };
  if (new Date(request.verificationExpiresAt).getTime() <= Date.now()) return { ok: false, error: 'La sesión de firma ha caducado. Solicita un código nuevo.' };
  const hash = await sha256Hex(sessionToken);
  if (hash !== request.verificationHash) return { ok: false, error: 'Sesión de firma no válida.' };
  const document = await dbService.getPatientDocument(request.documentId);
  if (!document) return { ok: false, error: 'Documento no encontrado.' };
  if (document.patientId !== request.patientId) return { ok: false, error: 'El documento no corresponde a este enlace.' };
  const settings = await getSettings();
  return { ok: true, document: await buildPublicSignatureDocument(request, document, settings) };
};

export const signPublicDocument = async (params: {
  token: string;
  sessionToken: string;
  signerName: string;
  accepted: boolean;
  authorityConfirmed: boolean;
  readConfirmed: boolean;
  identityConfirmed: boolean;
}): Promise<SignResponse> => {
  if (!isDemoMode) {
    try {
      const payload = await publicFetch({
        action: 'public-sign', token: params.token, sessionToken: params.sessionToken,
        signerName: params.signerName, accepted: params.accepted,
        authorityConfirmed: params.authorityConfirmed, readConfirmed: params.readConfirmed,
        identityConfirmed: params.identityConfirmed,
      });
      return {
        ok: true, document: payload.document, signedPdfBase64: payload.signedPdfBase64,
        signedPdfSha256: payload.signedPdfSha256, allSigned: payload.allSigned,
      };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'No se pudo completar la firma.' };
    }
  }

  if (!params.accepted) return { ok: false, error: 'Debes aceptar la firma para continuar.' };
  if (!params.readConfirmed || !params.identityConfirmed) return { ok: false, error: 'Confirma la lectura y la identidad antes de firmar.' };
  if (!params.signerName.trim()) return { ok: false, error: 'Indica el nombre completo del firmante.' };
  const request = await loadRequestByToken(params.token);
  if (!request) return { ok: false, error: 'Enlace no válido.' };
  const problem = checkRequestUsable(request);
  if (problem) return { ok: false, error: problem };
  if (request.status === 'firmado') return { ok: false, error: 'Este documento ya fue firmado con este enlace.' };
  if (!request.verificationHash || !request.verificationExpiresAt) return { ok: false, error: 'La sesión de firma ha caducado.' };
  if (new Date(request.verificationExpiresAt).getTime() <= Date.now()) return { ok: false, error: 'La sesión de firma ha caducado. Solicita un código nuevo.' };
  const sessionHash = await sha256Hex(params.sessionToken);
  if (sessionHash !== request.verificationHash) return { ok: false, error: 'Sesión de firma no válida.' };

  const foundDocument = await dbService.getPatientDocument(request.documentId);
  if (!foundDocument) return { ok: false, error: 'Documento no encontrado.' };
  const document = await ensureDemoDocumentHash(foundDocument);
  if (document.patientId !== request.patientId) return { ok: false, error: 'El documento no corresponde al paciente del enlace.' };
  if (document.status === 'rechazado' || document.status === 'revocado' || document.status === 'sustituido') {
    await dbService.updateDocumentSignatureRequest(request.id, {
      status: 'revocado', failureReason: 'El documento ya no admite firmas.',
    });
    return { ok: false, error: 'Este documento ya no admite firmas. Contacta con el centro.' };
  }
  if (request.condition !== 'paciente' && !params.authorityConfirmed) {
    return { ok: false, error: 'Debes confirmar que actúas como representante legal o tutor.' };
  }
  const settings = await getSettings();
  const assurance = assuranceFor(settings);
  const signedAt = nowIso();
  const integrityVerified = document.contentSha256 === await sha256Hex(contentMaterial(document));

  // Nota: canonicalPayload incluye el estado de los firmantes (nombre/correo/condición),
  // no las evidencias mutables. Si el contenido base cambió, la huella no coincide.
  if (!integrityVerified) {
    await dbService.addDocumentEvent({
      documentId: document.id, patientId: document.patientId, requestId: request.id,
      type: 'error', actorName: params.signerName, actorType: 'sistema',
      detail: 'La verificación de integridad del documento ha fallado. No se firma ni se archiva.',
    });
    await dbService.updateDocumentSignatureRequest(request.id, {
      status: 'error', failureReason: 'Fallo de integridad del contenido.',
    });
    return { ok: false, error: 'La integridad del documento no se pudo verificar. Contacta con el centro.' };
  }

  const evidence: Record<string, any> = {
    demo: true,
    requestId: request.id,
    assurance,
    verificationMethod: 'Enlace de un solo uso + OTP local (demostración)',
    readConfirmed: true,
    identityConfirmed: true,
    authorityConfirmed: params.authorityConfirmed,
    timestamp: signedAt,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    contentSha256: document.contentSha256,
    notQualified: true,
  };

  const updatedSigners: DocumentSigner[] = document.signers.map(signer => {
    if (signer.id !== request.signerId) return signer;
    return {
      ...signer,
      status: 'firmado' as const,
      signedAt,
      authorityConfirmed: params.authorityConfirmed,
      verificationMethod: 'Enlace de un solo uso + OTP local (demo)',
      assurance,
      evidence,
      name: params.signerName.trim(),
    };
  });
  const signedCount = updatedSigners.filter(s => s.status === 'firmado' && s.required).length;
  const requiredSignatures = updatedSigners.filter(s => s.required).length;
  const allSigned = requiredSignatures > 0 && signedCount >= requiredSignatures;

  const evidenceSignatures = updatedSigners
    .filter(s => s.status === 'firmado')
    .map(s => ({
      name: s.name, condition: s.condition, conditionLabel: conditionLabel(s.condition),
      signedAt: s.signedAt, verificationMethod: s.verificationMethod, assurance: s.assurance,
      requestId: s.requestId, certificateInfo: s.evidence?.certificateInfo || null,
    }));

  const updatedDocument: PatientDocument = {
    ...document,
    signers: updatedSigners,
    signedCount,
    requiredSignatures,
    status: allSigned ? 'firmado' : 'pendiente_firma',
    signedAt: allSigned ? signedAt : document.signedAt || null,
    archivedAt: allSigned ? signedAt : document.archivedAt || null,
    signatureAssurance: assurance,
    signatureProvider: settings.documentSettings?.signatureProviderLabel || 'Entorno local de demostración',
    evidence: {
      sha256: document.contentSha256,
      signedAt: allSigned ? signedAt : null,
      signedByName: params.signerName.trim(),
      signedByCondition: request.condition,
      verificationMethod: 'Enlace de un solo uso + OTP local (demo)',
      assurance,
      provider: settings.documentSettings?.signatureProviderLabel || 'Entorno local de demostración',
      integrityVerified,
      certificateInfo: { demo: true, notQualified: true },
      signatures: evidenceSignatures,
      archiveVersion: document.version,
    },
  };

  await dbService.updateDocumentSignatureRequest(request.id, {
    status: 'firmado', signedAt,
    verificationHash: request.verificationHash,
    verificationExpiresAt: request.verificationExpiresAt,
    evidence,
  });
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: document.patientId, requestId: request.id,
    type: 'signed', actorName: params.signerName.trim(), actorType: 'firmante',
    detail: allSigned
      ? 'Firma registrada. Todas las firmas requeridas están completas.'
      : `Firma registrada. Pendientes ${requiredSignatures - signedCount} firma(s) obligatoria(s).`,
    metadata: { assurance, demo: true, allSigned },
  });

  const bytes = await generateDocumentPdf({
    document: { ...updatedDocument, status: allSigned ? 'firmado' : 'pendiente_firma' },
    evidence: updatedDocument.evidence,
  });
  const signedPdfBase64 = bytesToBase64(bytes);
  const signedPdfSha256 = await sha256Hex(bytes);
  updatedDocument.evidence = { ...(updatedDocument.evidence as any), signedSha256: signedPdfSha256 };
  if (allSigned) {
    updatedDocument.signedPdfBase64 = signedPdfBase64;
    updatedDocument.signedPdfSha256 = signedPdfSha256;
  }
  await dbService.updateDocumentSignatureRequest(request.id, {
    signedPdfPath: `demo:${document.id}/${request.signerId}.pdf`,
    signedPdfSha256,
    verificationHash: request.verificationHash,
    verificationExpiresAt: request.verificationExpiresAt,
  });

  const saved = await dbService.savePatientDocument(updatedDocument);
  if (allSigned) {
    await dbService.addDocumentEvent({
      documentId: document.id, patientId: document.patientId, requestId: request.id,
      type: 'verified', actorName: 'Sistema', actorType: 'sistema',
      detail: 'Huella del PDF firmado calculada y verificada.',
      metadata: { signedPdfSha256 },
    });
    await dbService.addDocumentEvent({
      documentId: document.id, patientId: document.patientId, requestId: request.id,
      type: 'archived', actorName: 'Sistema', actorType: 'sistema',
      detail: 'Documento firmado archivado en el expediente. No se sobrescribirá.',
      metadata: { signedPdfSha256 },
    });
  }

  return {
    ok: true,
    document: await buildPublicSignatureDocument(
      { ...request, status: 'firmado', signedAt, signedPdfSha256 },
      saved,
      settings,
    ),
    signedPdfBase64,
    signedPdfSha256,
    allSigned,
  };
};

export const rejectPublicDocument = async (params: {
  token: string; sessionToken: string; reason: string;
}): Promise<{ ok: boolean; error?: string }> => {
  if (!isDemoMode) {
    try {
      await publicFetch({ action: 'public-reject', ...params });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'No se pudo registrar el rechazo.' };
    }
  }
  const request = await loadRequestByToken(params.token);
  if (!request) return { ok: false, error: 'Enlace no válido.' };
  const problem = checkRequestUsable(request);
  if (problem) return { ok: false, error: problem };
  const hash = await sha256Hex(params.sessionToken);
  if (hash !== request.verificationHash) return { ok: false, error: 'Sesión de firma no válida.' };
  const document = await dbService.getPatientDocument(request.documentId);
  if (!document) return { ok: false, error: 'Documento no encontrado.' };
  if (document.status === 'rechazado' || document.status === 'revocado' || document.status === 'sustituido') {
    return { ok: false, error: 'Este documento ya no admite firmas. Contacta con el centro.' };
  }
  const reason = params.reason.trim() || 'El firmante rechazó la firma sin indicar motivo.';
  if (!request.verificationExpiresAt || new Date(request.verificationExpiresAt).getTime() <= Date.now()) {
    return { ok: false, error: 'La sesión de firma ha caducado. Solicita un código nuevo.' };
  }
  const otherRequests = await dbService.getDocumentSignatureRequests(document.id);
  for (const other of otherRequests) {
    if (other.id !== request.id && (other.status === 'pendiente' || other.status === 'verificado')) {
      await dbService.updateDocumentSignatureRequest(other.id, {
        status: 'revocado',
        failureReason: 'Documento rechazado por otro firmante.',
      });
    }
  }
  await dbService.updateDocumentSignatureRequest(request.id, {
    status: 'rechazado', rejectedAt: nowIso(), failureReason: reason, verificationHash: null,
  });
  const updated: PatientDocument = {
    ...document,
    status: 'rechazado',
    signers: document.signers.map(s => {
      if (s.id === request.signerId) return { ...s, status: 'rechazado', evidence: { rejectionReason: reason } };
      if (s.status === 'firmado') return s;
      return { ...s, status: 'revocado' };
    }),
  };
  await dbService.savePatientDocument(updated);
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: document.patientId, requestId: request.id,
    type: 'rejected', actorName: request.recipientName, actorType: 'firmante',
    detail: `Firma rechazada. Motivo: ${reason}`,
  });
  return { ok: true };
};

// ------------------------------------------------------------
//  Carga de documentos firmados externamente
// ------------------------------------------------------------

export const uploadExternallySignedDocument = async (params: {
  patient: Patient;
  actor: User;
  settings: CenterSettings;
  file: File;
  title: string;
  category: PatientDocument['category'];
  specialty?: ClinicalSpecialty | null;
  signedByName: string;
  signedByCondition: SignatureCondition;
  signedAt: string;
  method: string;
  notes: string;
}): Promise<PatientDocument> => {
  const { file, patient, actor, settings } = params;
  if (!file) throw new Error('Selecciona el PDF firmado.');
  if (file.size > 3 * 1024 * 1024) throw new Error('El PDF supera el tamaño máximo de 3 MB. Para archivos mayores, divide el documento o contacta con soporte.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (!header.startsWith('%PDF-')) throw new Error('El archivo no parece un PDF válido.');
  if (!params.title.trim()) throw new Error('Indica un título para el documento.');
  if (!params.signedByName.trim()) throw new Error('Indica quién firmó el documento.');
  if (!params.signedAt) throw new Error('Indica la fecha de firma.');
  if (!params.method.trim()) throw new Error('Indica el método de firma o verificación.');

  if (!isDemoMode) {
    const payload = await authedFetch({
      action: 'upload-signed',
      patientId: patient.id,
      title: params.title.trim(),
      category: params.category,
      specialty: params.specialty || null,
      signedByName: params.signedByName.trim(),
      signedByCondition: params.signedByCondition,
      signedAt: params.signedAt,
      method: params.method.trim(),
      notes: params.notes.trim(),
      base64: bytesToBase64(bytes),
    });
    const loaded = await dbService.getPatientDocument(payload.documentId);
    if (!loaded) throw new Error('El documento se archivó, pero no se pudo recuperar. Actualiza la ficha.');
    return loaded;
  }

  const base64 = bytesToBase64(bytes);
  const signedPdfSha256 = await sha256Hex(bytes);
  const contentSummary = `Documento firmado externamente e incorporado al expediente.\n\nTítulo: ${params.title}\nFirmante: ${params.signedByName} (${conditionLabel(params.signedByCondition)})\nFecha declarada de firma: ${params.signedAt}\nMétodo declarado: ${params.method}\nHuella SHA-256: ${signedPdfSha256}\n\nNota: la plataforma verifica la integridad del archivo desde su incorporación, pero no acredita por sí sola la identidad del firmante ni la validez jurídica externa.`;
  const contentSha256 = await sha256Hex(contentSummary);
  const document = await dbService.savePatientDocument({
    patientId: patient.id,
    templateId: null,
    templateName: 'Documento firmado externamente',
    templateVersion: 0,
    category: params.category,
    specialty: params.specialty || null,
    professionalId: actor.id,
    professionalName: actor.name,
    title: params.title.trim(),
    status: 'firmado',
    version: 1,
    isCurrent: true,
    fields: {},
    patientSnapshot: patientSnapshot(patient),
    professionalSnapshot: professionalSnapshot(actor),
    centerSnapshot: centerSnapshot(settings),
    renderedText: contentSummary,
    contentSha256,
    signers: [{
      id: `ext-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      name: params.signedByName.trim(),
      email: '',
      condition: params.signedByCondition,
      required: true,
      status: 'firmado',
      signedAt: params.signedAt,
      verificationMethod: params.method.trim(),
      assurance: 'firma_manual_externa',
      authorityConfirmed: true,
      evidence: { externalUpload: true, originalSha256: signedPdfSha256, notes: params.notes },
    }],
    requiredSignatures: 1,
    signedCount: 1,
    signatureAssurance: 'firma_manual_externa',
    signatureProvider: 'Documento externo verificado al incorporar',
    evidence: {
      sha256: contentSha256,
      signedSha256: signedPdfSha256,
      signedAt: params.signedAt,
      signedByName: params.signedByName.trim(),
      signedByCondition: params.signedByCondition,
      verificationMethod: params.method.trim(),
      assurance: 'firma_manual_externa',
      provider: 'Aportado por el paciente o el centro',
      integrityVerified: true,
      certificateInfo: null,
    },
    signedPdfBase64: base64,
    signedPdfSha256,
    signedAt: params.signedAt,
    archivedAt: nowIso(),
    externalUpload: true,
    notes: params.notes.trim(),
    createdBy: actor.id,
    createdByName: actor.name,
  }, actor);
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: patient.id, type: 'external_upload', actorId: actor.id,
    actorName: actor.name, actorType: 'usuario',
    detail: `Documento firmado externamente incorporado. Huella del PDF: ${signedPdfSha256}`,
    metadata: { category: params.category, method: params.method, signedByName: params.signedByName },
  });
  await dbService.addDocumentEvent({
    documentId: document.id, patientId: patient.id, type: 'archived', actorId: actor.id,
    actorName: actor.name, actorType: 'usuario',
    detail: 'Documento externo archivado en el expediente con huella de integridad.',
  });
  return document;
};

// ------------------------------------------------------------
//  Descarga de PDF
// ------------------------------------------------------------

const triggerDownload = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const downloadDocumentPdf = async (document: PatientDocument, actor?: User): Promise<void> => {
  const filename = `${safeFileName(document.title)}-${safeFileName(document.patientSnapshot?.fullName || document.patientId)}.pdf`;
  if (document.signedPdfBase64) {
    triggerDownload(base64ToBytes(document.signedPdfBase64), filename);
    if (actor) {
      await dbService.addDocumentEvent({
        documentId: document.id, patientId: document.patientId, type: 'downloaded',
        actorId: actor.id, actorName: actor.name, actorType: 'usuario',
        detail: 'Descarga del PDF archivado por un usuario autorizado.',
      });
    }
    return;
  }
  if (!isDemoMode && document.signedPdfPath && !document.signedPdfPath.startsWith('demo:')) {
    const payload = await authedFetch({ action: 'download', documentId: document.id });
    if (payload?.base64) {
      triggerDownload(base64ToBytes(payload.base64), filename);
      if (actor) {
        await dbService.addDocumentEvent({
          documentId: document.id, patientId: document.patientId, type: 'downloaded',
          actorId: actor.id, actorName: actor.name, actorType: 'usuario',
          detail: 'Descarga del PDF archivado.',
        });
      }
      return;
    }
    throw new Error('No se pudo recuperar el PDF archivado.');
  }
  const bytes = await generateDocumentPdf({ document, evidence: document.evidence });
  triggerDownload(bytes, filename);
  if (actor) {
    await dbService.addDocumentEvent({
      documentId: document.id, patientId: document.patientId, type: 'downloaded',
      actorId: actor.id, actorName: actor.name, actorType: 'usuario',
      detail: document.status === 'firmado' ? 'Descarga de copia generada desde el snapshot firmado.' : 'Descarga del borrador en PDF.',
    });
  }
};

export const buildReceiptPdfBase64 = async (document: PatientDocument): Promise<string> => {
  const bytes = await generateDocumentPdf({ document, evidence: document.evidence });
  return bytesToBase64(bytes);
};

// ------------------------------------------------------------
//  Estado del proveedor de firma
// ------------------------------------------------------------

export const getDocumentCapabilities = async (): Promise<{
  demo: boolean;
  emailConfigured: boolean;
  providerConfigured: boolean;
  providerLabel: string;
  assurance: SignatureAssurance;
  warnings: string[];
}> => {
  if (isDemoMode) {
    return {
      demo: true,
      emailConfigured: false,
      providerConfigured: false,
      providerLabel: 'Entorno local de demostración',
      assurance: 'demo_sin_validez',
      warnings: [
        'No se envían correos reales.',
        'La firma demo no tiene validez jurídica ni equivale a una firma avanzada o cualificada.',
        'El enlace y el OTP funcionan solo en este navegador.',
      ],
    };
  }
  try {
    const payload = await authedFetch({ action: 'capabilities' });
    return payload.capabilities;
  } catch (error: any) {
    return {
      demo: false,
      emailConfigured: false,
      providerConfigured: false,
      providerLabel: 'No disponible',
      assurance: 'simple_verificada_otp',
      warnings: [error?.message || 'No se pudo comprobar la configuración del proveedor.'],
    };
  }
};

// ------------------------------------------------------------
//  Alertas documentales
// ------------------------------------------------------------

export const documentNeedsAttention = (document: PatientDocument): boolean => {
  if (document.status === 'pendiente_firma' || document.status === 'enviado' || document.status === 'rechazado' || document.status === 'envio_fallido' || document.status === 'firma_fallida') return true;
  if (document.expiresAt && new Date(document.expiresAt).getTime() <= Date.now() && document.status !== 'firmado' && document.status !== 'archivado') return true;
  return false;
};

export const documentExpiresSoon = (document: PatientDocument): boolean => {
  if (!document.expiresAt || document.status === 'firmado' || document.status === 'archivado') return false;
  const diff = new Date(document.expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 24 * 3600000;
};

export const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / 86400000);
};
