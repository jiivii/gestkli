/**
 * Vercel Serverless Function: /api/document-signing
 * ─────────────────────────────────────────────────
 * Flujo documental con la service_role de Supabase. Nunca se expone al navegador.
 *
 * Acciones autenticadas (Bearer del profesional):
 *   capabilities, send, revoke, download, upload-signed
 *
 * Acciones públicas (enlace de firma):
 *   public-preview, public-request-otp, public-verify-otp, public-document,
 *   public-sign, public-reject
 *
 * Garantías:
 *   · El token del enlace y el OTP se guardan solo como hash.
 *   · El OTP se compara con HMAC-SHA256 y un secreto de servidor.
 *   · El documento firmado se genera desde el snapshot almacenado, no desde
 *     la plantilla viva, y su SHA-256 se archiva.
 *   · Si el correo o el proveedor no están configurados, se devuelve error:
 *     no se simula una firma válida.
 *   · Una firma OTP es firma electrónica simple verificada. No se etiqueta
 *     como avanzada/cualificada salvo que un proveedor externo lo acredite.
 *
 * Variables:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   DOCUMENT_EMAIL_FROM, RESEND_API_KEY
 *   DOCUMENT_PUBLIC_URL (https://tu-dominio)
 *   DOCUMENT_SIGNING_SECRET (recomendado; si falta se usa la service_role)
 *   SIGNATURE_PROVIDER=local_otp | external | demo
 *   SIGNATURE_ASSURANCE=simple_verificada_otp | avanzada_proveedor | cualificada_proveedor
 *   SIGNATURE_PROVIDER_LABEL
 *   SIGNATURE_PROVIDER_CREATE_URL, SIGNATURE_PROVIDER_API_KEY (solo external)
 *   ALLOW_DEMO_SIGNING=true (solo desarrollo)
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { generateDocumentPdf, bytesToBase64 } from '../lib/documentPdf.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'patient-documents'
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null

const CLINICAL_ROLES = ['fisioterapia', 'nutricion', 'logopedia', 'psicologia']
const CLINICAL_CATEGORIES = ['psicologia', 'fisioterapia', 'nutricion', 'logopedia', 'menores']
const VALID_CONDITIONS = ['paciente', 'representante_legal', 'representante_legal_2', 'tutor', 'profesional', 'otro']

const BASE_PERMISSIONS = {
  admin: [
    'documents.view', 'documents.manage', 'documents.templates.manage',
    'patients.view.all', 'audit.view', 'clinical.consents.manage',
  ],
  fisioterapia: ['documents.view', 'documents.manage', 'patients.view.assigned', 'clinical.consents.manage'],
  nutricion: ['documents.view', 'documents.manage', 'patients.view.assigned', 'clinical.consents.manage'],
  logopedia: ['documents.view', 'documents.manage', 'patients.view.assigned', 'clinical.consents.manage'],
  psicologia: ['documents.view', 'documents.manage', 'patients.view.assigned', 'clinical.consents.manage'],
}

const clean = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}
const nowIso = () => new Date().toISOString()
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex')
const hmacHex = (value) => crypto
  .createHmac('sha256', process.env.DOCUMENT_SIGNING_SECRET || serviceRoleKey || 'sin-secreto')
  .update(value).digest('hex')
const secureCompare = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
const maskEmail = (email) => {
  if (!email || !String(email).includes('@')) return 'correo no disponible'
  const [local, domain] = String(email).split('@')
  return `${local.slice(0, Math.min(2, local.length))}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`
}
const getHeader = (req, name) => req.headers?.[name] || req.headers?.[name.toLowerCase()]
const getOrigin = (req) => {
  const configured = clean(process.env.DOCUMENT_PUBLIC_URL, 500).replace(/\/+$/, '')
  if (configured) return configured
  const origin = getHeader(req, 'origin')
  if (origin) return String(origin).replace(/\/+$/, '')
  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host')
  const proto = getHeader(req, 'x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : 'http://localhost:5173'
}
const publicLink = (req, token) => `${getOrigin(req)}/#/sign/${encodeURIComponent(token)}`
const tokenExpiry = (hours) => new Date(Date.now() + Math.max(1, Math.min(168, Number(hours) || 72)) * 3600000).toISOString()
const otpExpiry = (minutes) => new Date(Date.now() + Math.max(5, Math.min(30, Number(minutes) || 10)) * 60000).toISOString()
const randomSecret = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
const randomOtp = () => String(crypto.randomInt(100000, 1000000))
const today = () => new Date().toISOString().slice(0, 10)

const contentMaterial = (doc) => [
  doc.patient_id || doc.patientId || '',
  doc.template_id || doc.templateId || '',
  String(doc.template_version ?? doc.templateVersion ?? 0),
  doc.title || '',
  doc.category || '',
  doc.rendered_text || doc.renderedText || '',
].join('\n')

const permissionsFor = (profile) => {
  const base = BASE_PERMISSIONS[profile.role] || []
  const extra = parseJson(profile.permissions, [])
  return new Set([...base, ...(Array.isArray(extra) ? extra : [])])
}
const hasPermission = (profile, permission) => permissionsFor(profile).has(permission)

const isClinicalDocument = (doc) =>
  !!doc.specialty || CLINICAL_CATEGORIES.includes(doc.category)

const sendJson = (res, status, payload) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.status(status).json(payload)
}

const logServerError = (where, error) => {
  console.error(`[document-signing:${where}]`, error?.message || error)
}

async function authenticate(req, res) {
  if (!admin) {
    sendJson(res, 500, { ok: false, error: 'Configuración del servidor incompleta.' })
    return null
  }
  let token = ''
  const authHeader = String(getHeader(req, 'authorization') || '')
  if (authHeader.toLowerCase().startsWith('bearer ')) token = authHeader.slice(7).trim()
  if (!token) {
    sendJson(res, 401, { ok: false, error: 'Sesión no válida. Vuelve a iniciar sesión.' })
    return null
  }
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) {
    sendJson(res, 401, { ok: false, error: 'Sesión caducada o no válida.' })
    return null
  }
  const { data: profile, error: profileError } = await admin
    .from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.active === false) {
    sendJson(res, 403, { ok: false, error: 'Perfil no autorizado o inactivo.' })
    return null
  }
  return { ...profile, id: user.id, email: user.email }
}

async function isAssigned(profile, patientId) {
  if (profile.role === 'admin') return true
  if (!CLINICAL_ROLES.includes(profile.role)) return false
  const { data: assignment } = await admin.from('patient_professionals')
    .select('id').eq('patient_id', patientId).eq('professional_id', profile.id)
    .eq('active', true).limit(1).maybeSingle()
  if (assignment) return true
  const { data: appointment } = await admin.from('appointments')
    .select('id').eq('patient_id', patientId).eq('professional_id', profile.id)
    .limit(1).maybeSingle()
  return !!appointment
}

async function canAccessDocument(profile, doc) {
  if (!doc || !hasPermission(profile, 'documents.view')) return false
  if (!(await isAssigned(profile, doc.patient_id || doc.patientId))) return false
  if (profile.role === 'admin') {
    if (isClinicalDocument(doc) && !hasPermission(profile, 'clinical.view.all')) return false
    return true
  }
  if (!CLINICAL_ROLES.includes(profile.role)) return false
  if (doc.specialty && doc.specialty !== profile.role && doc.specialty !== profile.profession) return false
  return true
}

async function canManageDocument(profile, doc) {
  return hasPermission(profile, 'documents.manage') && await canAccessDocument(profile, doc)
}

async function getDocument(documentId) {
  const { data, error } = await admin.from('patient_documents').select('*').eq('id', documentId).maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

async function getPatient(patientId) {
  const { data, error } = await admin.from('patients').select('*').eq('id', patientId).maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

async function getTemplate(templateId) {
  if (!templateId) return null
  const { data, error } = await admin.from('document_templates').select('*').eq('id', templateId).maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

async function getSettings() {
  const { data } = await admin.from('center_settings').select('*').eq('id', 1).maybeSingle()
  return data || {}
}

async function getSignatureRequestByToken(token) {
  if (!token) return null
  const tokenHash = sha256Hex(token)
  const { data, error } = await admin.from('document_signature_requests').select('*').eq('token_hash', tokenHash).maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

async function getSignatureRequestById(id) {
  const { data, error } = await admin.from('document_signature_requests').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

async function addEvent(event) {
  try {
    await admin.from('document_events').insert({
      document_id: event.documentId,
      patient_id: event.patientId,
      request_id: event.requestId || null,
      type: event.type,
      actor_id: event.actorId || null,
      actor_name: event.actorName || 'Sistema',
      actor_type: event.actorType || 'sistema',
      detail: event.detail || '',
      metadata: event.metadata || null,
      ip_hint: clean(getHeader(event.req || {}, 'x-forwarded-for'), 120) || null,
      user_agent: clean(getHeader(event.req || {}, 'user-agent'), 500) || null,
    })
  } catch (error) {
    logServerError('addEvent', error)
  }
}

async function audit(profile, action, entityId, detail, patientId) {
  try {
    await admin.from('audit_log').insert({
      user_id: profile.id,
      user_name: profile.name || profile.email || '',
      role: profile.role || '',
      action,
      entity: 'patient_document',
      entity_id: entityId,
      patient_id: patientId || null,
      detail,
    })
  } catch (error) {
    logServerError('audit', error)
  }
}

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.DOCUMENT_EMAIL_FROM
  if (!apiKey || !from) {
    throw new Error('El correo transaccional no está configurado. Faltan RESEND_API_KEY y DOCUMENT_EMAIL_FROM.')
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json())?.message || '' } catch { /* noop */ }
    throw new Error(`No se pudo entregar el correo${detail ? `: ${detail}` : '.'}`)
  }
}

const emailShell = (title, body) => `
<div style="font-family:Arial,sans-serif;background:#f8f6f2;padding:24px;color:#292524">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e1d8;border-radius:16px;padding:28px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a7f73;margin:0 0 8px">Sinestesya · Salud Integral</p>
    <h1 style="font-size:21px;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="font-size:11px;color:#8a7f73;margin-top:24px">Este mensaje no contiene información clínica. Si no esperabas recibirlo, contacta con el centro.</p>
  </div>
</div>`

async function sendSignatureLinkEmail(req, request, document, template, hours) {
  const link = publicLink(req, request.__rawToken)
  const title = document.title || 'Documento pendiente de firma'
  const expires = new Date(request.expires_at).toLocaleString('es-ES')
  const text = [
    `Hola ${request.recipient_name || ''},`,
    '',
    `El centro Sinestesya ha preparado un documento para revisión y firma: ${title}.`,
    `Enlace: ${link}`,
    `El enlace caduca el ${expires}.`,
    '',
    'Por seguridad, el enlace no muestra el documento hasta verificar tu identidad mediante un código enviado a tu correo.',
    'No reenvíes este enlace. Cada acceso queda registrado.',
  ].join('\n')
  const html = emailShell('Documento pendiente de revisión y firma', `
    <p style="font-size:14px;line-height:1.6">Hola ${request.recipient_name || ''},</p>
    <p style="font-size:14px;line-height:1.6">El centro Sinestesya ha preparado un documento para revisión y firma.</p>
    <p style="font-size:14px;line-height:1.6"><strong>${title}</strong></p>
    <p style="margin:22px 0"><a href="${link}" style="background:#292524;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Revisar y firmar</a></p>
    <p style="font-size:12px;color:#57534e">Caduca el ${expires}. El documento no se mostrará hasta verificar tu identidad con un código enviado a tu correo.</p>
    <p style="font-size:12px;color:#57534e">No reenvíes el enlace. Cada acceso queda registrado.</p>
  `)
  await sendEmail({ to: request.recipient_email, subject: 'Documento pendiente de firma · Sinestesya', text, html })
}

async function markRequestExpired(request, document) {
  await admin.from('document_signature_requests').update({
    status: 'caducado', verification_hash: null, verification_expires_at: null, otp_hash: null,
  }).eq('id', request.id)
  const signers = parseJson(document.signers, [])
  const signed = signers.filter(s => s.status === 'firmado').length
  if (signed === 0) {
    await admin.from('patient_documents').update({
      status: 'enlace_caducado', updated_at: nowIso(),
    }).eq('id', document.id)
  }
  await addEvent({
    documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'expired', actorName: 'Sistema', actorType: 'sistema',
    detail: 'El enlace de firma ha caducado. No se permite el acceso.',
  })
}

async function requestProblem(request, document, allowSigned = false) {
  if (!request) return { status: 404, error: 'Este enlace no es válido o ha dejado de estar disponible.' }
  if (request.status === 'revocado') return { status: 410, error: 'Este enlace ha sido revocado. Solicita uno nuevo al centro.' }
  if (request.status === 'rechazado') return { status: 409, error: 'El documento fue rechazado. Contacta con el centro si necesitas revisarlo.' }
  if (request.status === 'caducado') return { status: 410, error: 'Este enlace ha caducado. Solicita uno nuevo al centro.' }
  if (request.status === 'error') return { status: 409, error: request.failure_reason || 'La firma no se pudo verificar. Contacta con el centro.' }
  if (request.status === 'firmado' && !allowSigned) return { status: 409, error: 'Este documento ya fue firmado con este enlace.' }
  if (['rechazado', 'revocado', 'sustituido'].includes(document.status)) {
    return { status: 409, error: 'Este documento ya no admite firmas. Contacta con el centro.' }
  }
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await markRequestExpired(request, document)
    return { status: 410, error: 'Este enlace ha caducado. Solicita uno nuevo al centro.' }
  }
  return null
}

const assureFor = () => {
  const provider = clean(process.env.SIGNATURE_PROVIDER || 'local_otp', 40)
  if (provider === 'external') {
    const configured = clean(process.env.SIGNATURE_ASSURANCE || 'avanzada_proveedor', 60)
    return configured === 'cualificada_proveedor' ? 'cualificada_proveedor' : 'avanzada_proveedor'
  }
  if (provider === 'demo') return 'demo_sin_validez'
  return 'simple_verificada_otp'
}

const providerLabel = () => clean(process.env.SIGNATURE_PROVIDER_LABEL, 160) || (
  clean(process.env.SIGNATURE_PROVIDER || 'local_otp', 40) === 'local_otp'
    ? 'Firma electrónica simple verificada por OTP'
    : clean(process.env.SIGNATURE_PROVIDER || '', 40) === 'external'
      ? 'Proveedor externo de firma'
      : 'Entorno de demostración'
)

function publicDocumentPayload(request, document, settings) {
  const signers = parseJson(document.signers, [])
  const signer = signers.find(s => s.id === request.signer_id) || {}
  const assurance = document.signature_assurance || assureFor()
  return {
    requestId: request.id,
    documentId: document.id,
    title: document.title,
    category: document.category,
    version: document.version,
    recipientName: request.recipient_name,
    recipientEmailMasked: maskEmail(request.recipient_email),
    condition: request.condition,
    renderedText: document.rendered_text,
    contentSha256: document.content_sha256,
    expiresAt: request.expires_at,
    status: request.status,
    requiresOtp: true,
    assurance,
    verificationMethod: request.status === 'firmado'
      ? (request.evidence?.verificationMethod || 'Firma registrada')
      : 'Enlace de un solo uso + OTP por correo',
    centerName: document.center_snapshot?.centerName || settings.center_name || 'Sinestesya',
    providerLabel: document.signature_provider || providerLabel(),
    signerName: signer.name || request.recipient_name,
    authorityRequired: ['representante_legal', 'representante_legal_2', 'tutor'].includes(request.condition),
    minorWarning: request.condition === 'paciente' && document.patient_snapshot?.isMinor
      ? 'El paciente es menor. La firma del menor no sustituye la representación legal cuando sea exigible.'
      : null,
    signedAt: request.signed_at || null,
    signedPdfSha256: request.signed_pdf_sha256 || document.signed_pdf_sha256 || null,
    isDemo: false,
    allSigned: document.status === 'firmado',
  }
}

// ------------------------------------------------------------
//  Acciones autenticadas
// ------------------------------------------------------------

async function actionCapabilities(req, res, profile) {
  if (!hasPermission(profile, 'documents.view')) {
    return sendJson(res, 403, { ok: false, error: 'No tienes permiso para ver documentación.' })
  }
  const provider = clean(process.env.SIGNATURE_PROVIDER || 'local_otp', 40)
  const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.DOCUMENT_EMAIL_FROM)
  const externalConfigured = !!(process.env.SIGNATURE_PROVIDER_CREATE_URL && process.env.SIGNATURE_PROVIDER_API_KEY)
  const providerConfigured = provider === 'local_otp'
    ? emailConfigured
    : provider === 'external'
      ? externalConfigured
      : process.env.ALLOW_DEMO_SIGNING === 'true'
  const warnings = []
  if (!emailConfigured) warnings.push('No hay proveedor de correo configurado: no se pueden enviar enlaces ni OTP.')
  if (provider === 'external' && !externalConfigured) warnings.push('El proveedor externo de firma no está configurado. El sistema no enviará documentos.')
  if (provider === 'demo' && process.env.ALLOW_DEMO_SIGNING !== 'true') warnings.push('La firma demo está deshabilitada en producción.')
  if (!process.env.DOCUMENT_PUBLIC_URL) warnings.push('DOCUMENT_PUBLIC_URL no está definida; los enlaces pueden usar el origen de la petición.')
  return sendJson(res, 200, {
    ok: true,
    capabilities: {
      demo: false,
      emailConfigured,
      providerConfigured,
      providerLabel: providerLabel(),
      assurance: assureFor(),
      warnings,
    },
  })
}

async function actionSend(req, res, profile) {
  if (!hasPermission(profile, 'documents.manage')) {
    return sendJson(res, 403, { ok: false, error: 'No tienes permiso para enviar documentación.' })
  }
  const body = req.body || {}
  const documentId = clean(body.documentId, 80)
  const signers = Array.isArray(body.signers) ? body.signers.slice(0, 6) : []
  const justification = clean(body.justification, 1000)
  const expiresInHours = Math.max(1, Math.min(168, Number(body.expiresInHours) || 72))

  if (!documentId) return sendJson(res, 400, { ok: false, error: 'Falta el documento.' })
  if (!justification) return sendJson(res, 400, { ok: false, error: 'Indica la justificación del envío.' })
  if (!signers.length) return sendJson(res, 400, { ok: false, error: 'Selecciona al menos un firmante.' })

  const document = await getDocument(documentId)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  if (!(await canManageDocument(profile, document))) {
    return sendJson(res, 403, { ok: false, error: 'No tienes acceso a este documento.' })
  }
  if (['firmado', 'archivado', 'revocado', 'sustituido', 'rechazado'].includes(document.status) || document.signed_at) {
    return sendJson(res, 409, { ok: false, error: 'El documento ya está cerrado. Genera una nueva versión si necesitas cambios.' })
  }
  if (!document.content_sha256 || !document.rendered_text) {
    return sendJson(res, 409, { ok: false, error: 'El documento no tiene snapshot o huella de integridad.' })
  }

  const template = await getTemplate(document.template_id)
  if (template && (template.legal_status !== 'aprobada' || template.active === false)) {
    return sendJson(res, 409, { ok: false, error: 'La plantilla no está aprobada y activa. No se puede enviar.' })
  }

  const patient = await getPatient(document.patient_id)
  if (!patient) return sendJson(res, 404, { ok: false, error: 'Paciente no encontrado.' })
  const birth = patient.birth_date ? new Date(patient.birth_date) : null
  const age = birth && !Number.isNaN(birth.getTime())
    ? Math.floor((Date.now() - birth.getTime()) / (365.25 * 86400000))
    : null
  const minor = age !== null && age < 18

  const seenEmails = new Set()
  const seenConditions = new Set()
  const normalizedSigners = []
  for (const raw of signers) {
    const name = clean(raw?.name, 200)
    const email = clean(raw?.email, 320).toLowerCase()
    const condition = clean(raw?.condition, 40)
    const required = raw?.required !== false
    if (!name || !email || !VALID_CONDITIONS.includes(condition)) {
      return sendJson(res, 400, { ok: false, error: 'Todos los firmantes necesitan nombre, correo y condición válidos.' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { ok: false, error: `El correo de ${name} no es válido.` })
    }
    if (seenEmails.has(email)) return sendJson(res, 400, { ok: false, error: 'No se puede enviar dos enlaces al mismo correo.' })
    if (seenConditions.has(condition)) return sendJson(res, 400, { ok: false, error: 'Hay condiciones de firma duplicadas.' })
    seenEmails.add(email)
    seenConditions.add(condition)
    normalizedSigners.push({ name, email, condition, required })
  }
  if (!normalizedSigners.some(s => s.required)) {
    return sendJson(res, 400, { ok: false, error: 'Debe existir al menos un firmante obligatorio.' })
  }
  if (minor && !normalizedSigners.some(s => ['representante_legal', 'representante_legal_2', 'tutor'].includes(s.condition))) {
    return sendJson(res, 400, { ok: false, error: 'Paciente menor: falta una firma de representación legal.' })
  }
  if (normalizedSigners.some(s => s.condition === 'representante_legal_2') && !patient.secondary_legal_guardian_name) {
    return sendJson(res, 400, { ok: false, error: 'No consta el segundo representante legal en la ficha.' })
  }
  if (normalizedSigners.some(s => s.condition === 'representante_legal_2') && !patient.representation_type) {
    return sendJson(res, 400, { ok: false, error: 'Indica el tipo de representación en la ficha antes de enviar a dos representantes.' })
  }

  const priorSigned = parseJson(document.signers, []).filter(s => s.status === 'firmado')
  const templateRule = template?.signer_rule || 'manual'
  const requiredConditions = new Set([
    ...normalizedSigners.filter(s => s.required).map(s => s.condition),
    ...priorSigned.filter(s => s.required).map(s => s.condition),
  ])
  if (minor && templateRule === 'guardian_only' && normalizedSigners.some(s => s.condition === 'paciente')) {
    return sendJson(res, 400, { ok: false, error: 'Un documento exclusivo de representación legal no puede enviarse al menor.' })
  }
  if (minor && templateRule !== 'manual'
    && !['representante_legal', 'representante_legal_2', 'tutor'].some(condition => requiredConditions.has(condition))) {
    return sendJson(res, 400, { ok: false, error: 'Paciente menor: falta una firma obligatoria de representación legal.' })
  }
  if (templateRule === 'guardian_both') {
    if (!patient.secondary_legal_guardian_name) {
      return sendJson(res, 400, { ok: false, error: 'La plantilla exige valorar la firma de ambos representantes, pero solo consta uno.' })
    }
    if (!requiredConditions.has('representante_legal') || !requiredConditions.has('representante_legal_2')) {
      return sendJson(res, 400, { ok: false, error: 'Esta plantilla exige la firma obligatoria de ambos representantes registrados.' })
    }
  }

  const provider = clean(process.env.SIGNATURE_PROVIDER || 'local_otp', 40)
  const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.DOCUMENT_EMAIL_FROM)
  if (!emailConfigured) {
    return sendJson(res, 503, { ok: false, error: 'Correo transaccional no configurado. No se ha enviado nada.' })
  }
  if (provider === 'external') {
    if (!process.env.SIGNATURE_PROVIDER_CREATE_URL || !process.env.SIGNATURE_PROVIDER_API_KEY) {
      return sendJson(res, 503, { ok: false, error: 'Proveedor externo de firma no configurado. No se ha enviado nada.' })
    }
    return sendJson(res, 503, {
      ok: false,
      error: 'La integración externa requiere el adaptador del proveedor contratado. El sistema no simula firmas avanzadas/cualificadas.',
    })
  }
  if (provider === 'demo' && process.env.ALLOW_DEMO_SIGNING !== 'true') {
    return sendJson(res, 503, { ok: false, error: 'La firma demo está deshabilitada. Configura local_otp o un proveedor externo.' })
  }

  const expiry = tokenExpiry(expiresInHours)
  const assurance = assureFor()
  const providerText = providerLabel()

  // Revoca enlaces anteriores que sigan activos.
  await admin.from('document_signature_requests').update({
    status: 'revocado', failure_reason: 'Sustituido por un nuevo envío.',
    verification_hash: null, verification_expires_at: null, otp_hash: null,
  }).eq('document_id', document.id).in('status', ['pendiente', 'verificado'])

  const existingSigners = parseJson(document.signers, [])
  const created = []
  const failures = []
  for (const signer of normalizedSigners) {
    const alreadySigned = existingSigners.find(s => s.condition === signer.condition && s.status === 'firmado')
    if (alreadySigned) continue
    const rawToken = randomSecret(32)
    const signerId = crypto.randomUUID()
    const { data: request, error } = await admin.from('document_signature_requests').insert({
      document_id: document.id,
      patient_id: document.patient_id,
      signer_id: signerId,
      recipient_name: signer.name,
      recipient_email: signer.email,
      condition: signer.condition,
      token_hash: sha256Hex(rawToken),
      status: 'pendiente',
      expires_at: expiry,
      sent_at: nowIso(),
      sent_count: 1,
      created_by: profile.id,
    }).select('*').single()
    if (error || !request) {
      failures.push({ signer, error: error?.message || 'No se pudo crear la solicitud.' })
      continue
    }
    request.__rawToken = rawToken
    created.push({ signer, request })
  }

  if (!created.length) {
    return sendJson(res, 409, { ok: false, error: failures[0]?.error || 'No hay firmantes pendientes a los que enviar.' })
  }

  for (const item of created) {
    try {
      await sendSignatureLinkEmail(req, item.request, document, template, expiresInHours)
    } catch (error) {
      failures.push({ signer: item.signer, error: error?.message || 'Error de correo.' })
      await admin.from('document_signature_requests').update({
        status: 'error', failure_reason: clean(error?.message, 500),
      }).eq('id', item.request.id)
      await addEvent({
        req, documentId: document.id, patientId: document.patient_id, requestId: item.request.id,
        type: 'error', actorId: profile.id, actorName: profile.name, actorType: 'usuario',
        detail: `No se pudo enviar el enlace a ${item.signer.name}: ${clean(error?.message, 500)}`,
      })
    }
  }

  const signersFromRequests = new Map(
    created.filter(item => !failures.some(f => f.signer.email === item.signer.email))
      .map(item => [item.signer.condition, item]),
  )
  const newSigners = []
  for (const signer of normalizedSigners) {
    const previous = existingSigners.find(s => s.condition === signer.condition)
    if (previous?.status === 'firmado') {
      newSigners.push(previous)
      continue
    }
    const item = signersFromRequests.get(signer.condition)
    newSigners.push({
      id: item?.request.signer_id || previous?.id || crypto.randomUUID(),
      name: signer.name,
      email: signer.email,
      condition: signer.condition,
      required: signer.required,
      status: item ? 'enviado' : 'error',
      requestId: item?.request.id || null,
      sentAt: item ? nowIso() : null,
      verificationMethod: 'Enlace de un solo uso + OTP por correo',
      assurance,
      authorityConfirmed: false,
      error: item ? null : 'No se pudo enviar el enlace.',
    })
  }
  // Conserva las firmas ya registradas aunque el reenvío solo incluya a los
  // firmantes que faltan. Nunca se pierde la evidencia de una firma previa.
  for (const previous of priorSigned) {
    if (!newSigners.some(s => s.condition === previous.condition)) newSigners.push(previous)
  }
  const requiredSignatures = newSigners.filter(s => s.required).length
  const signedCount = newSigners.filter(s => s.required && s.status === 'firmado').length
  const allSent = failures.length === 0
  const anySent = created.length > failures.length

  const newStatus = allSent ? 'pendiente_firma' : (anySent ? 'pendiente_firma' : 'envio_fallido')
  await admin.from('patient_documents').update({
    signers: newSigners,
    required_signatures: requiredSignatures,
    signed_count: signedCount,
    status: newStatus,
    sent_at: nowIso(),
    expires_at: expiry,
    signature_assurance: assurance,
    signature_provider: providerText,
    updated_at: nowIso(),
  }).eq('id', document.id)

  for (const signer of newSigners) {
    if (signer.status !== 'enviado') continue
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: signer.requestId,
      type: 'sent', actorId: profile.id, actorName: profile.name, actorType: 'usuario',
      detail: `Enlace de firma enviado a ${signer.name} (${signer.condition}). Justificación: ${justification}`,
      metadata: { recipientEmailMasked: maskEmail(signer.email), assurance },
    })
  }
  await audit(profile, 'document.send', document.id, `Envío de documentación a ${newSigners.length} firmante(s).`, document.patient_id)

  if (!anySent) {
    await admin.from('patient_documents').update({ status: 'envio_fallido', updated_at: nowIso() }).eq('id', document.id)
    return sendJson(res, 502, {
      ok: false,
      error: failures[0]?.error || 'No se pudo enviar ningún enlace.',
    })
  }
  return sendJson(res, 200, {
    ok: true,
    message: allSent
      ? 'Enlaces de firma enviados. El documento no se mostrará hasta verificar el OTP.'
      : 'Algunos enlaces no se pudieron enviar. Revisa las incidencias antes de continuar.',
    expiresAt: expiry,
    failures: failures.map(f => ({ signer: f.signer.name, error: f.error })),
  })
}

async function actionRevoke(req, res, profile) {
  if (!hasPermission(profile, 'documents.manage')) {
    return sendJson(res, 403, { ok: false, error: 'No tienes permiso para revocar documentación.' })
  }
  const body = req.body || {}
  const documentId = clean(body.documentId, 80)
  const reason = clean(body.reason, 1000)
  if (!documentId || !reason) return sendJson(res, 400, { ok: false, error: 'Faltan el documento o el motivo.' })
  const document = await getDocument(documentId)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  if (!(await canManageDocument(profile, document))) return sendJson(res, 403, { ok: false, error: 'No tienes acceso.' })

  await admin.from('document_signature_requests').update({
    status: 'revocado', failure_reason: reason,
    verification_hash: null, verification_expires_at: null, otp_hash: null,
  }).eq('document_id', document.id).in('status', ['pendiente', 'verificado'])

  const signedAlready = !!document.signed_at || document.status === 'firmado';
  const signers = signedAlready
    ? parseJson(document.signers, [])
    : parseJson(document.signers, []).map(s => ({ ...s, status: 'revocado' }));
  await admin.from('patient_documents').update({
    status: 'revocado',
    revoked_at: nowIso(),
    revocation_reason: reason,
    signers,
    is_current: document.status === 'firmado' ? false : document.is_current,
    updated_at: nowIso(),
  }).eq('id', document.id)

  await addEvent({
    req, documentId: document.id, patientId: document.patient_id,
    type: 'revoked', actorId: profile.id, actorName: profile.name, actorType: 'usuario',
    detail: `Documento revocado. Motivo: ${reason}`,
  })
  await audit(profile, 'document.revoke', document.id, `Revocación: ${reason}`, document.patient_id)
  return sendJson(res, 200, { ok: true, message: 'Documento y enlaces revocados. El archivo firmado, si existía, se conserva.' })
}

async function actionDownload(req, res, profile) {
  const body = req.body || {}
  const documentId = clean(body.documentId, 80)
  const document = await getDocument(documentId)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  if (!(await canAccessDocument(profile, document))) return sendJson(res, 403, { ok: false, error: 'No tienes acceso.' })
  if (!document.signed_pdf_path) {
    return sendJson(res, 404, { ok: false, error: 'El documento no tiene un PDF firmado archivado. Genera la copia desde el snapshot.' })
  }
  const { data, error } = await admin.storage.from(BUCKET).download(document.signed_pdf_path)
  if (error || !data) return sendJson(res, 502, { ok: false, error: 'No se pudo recuperar el PDF archivado.' })
  const bytes = new Uint8Array(await data.arrayBuffer())
  const sha256 = sha256Hex(bytes)
  if (document.signed_pdf_sha256 && sha256 !== document.signed_pdf_sha256) {
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, type: 'error',
      actorId: profile.id, actorName: profile.name, actorType: 'usuario',
      detail: 'La huella del PDF descargado no coincide con la archivada. Descarga bloqueada.',
      metadata: { expected: document.signed_pdf_sha256, actual: sha256 },
    })
    return sendJson(res, 409, { ok: false, error: 'La integridad del PDF archivado no se pudo verificar. Descarga bloqueada.' })
  }
  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, type: 'downloaded',
    actorId: profile.id, actorName: profile.name, actorType: 'usuario',
    detail: 'Descarga del PDF firmado verificada por huella SHA-256.',
  })
  await audit(profile, 'document.download', document.id, 'Descarga de PDF firmado verificada.', document.patient_id)
  return sendJson(res, 200, { ok: true, base64: bytesToBase64(bytes), sha256 })
}

async function actionUploadSigned(req, res, profile) {
  if (!hasPermission(profile, 'documents.manage')) {
    return sendJson(res, 403, { ok: false, error: 'No tienes permiso para incorporar documentación.' })
  }
  const body = req.body || {}
  const patientId = clean(body.patientId, 80)
  const title = clean(body.title, 240)
  const category = clean(body.category, 40) || 'general'
  const signedByName = clean(body.signedByName, 200)
  const signedByCondition = clean(body.signedByCondition, 40)
  const signedAt = clean(body.signedAt, 60)
  const method = clean(body.method, 500)
  const notes = clean(body.notes, 2000)
  const base64 = clean(body.base64, 12 * 1024 * 1024)
  if (!patientId || !title || !signedByName || !signedAt || !method || !base64) {
    return sendJson(res, 400, { ok: false, error: 'Faltan datos obligatorios del documento externo.' })
  }
  if (!VALID_CONDITIONS.includes(signedByCondition)) {
    return sendJson(res, 400, { ok: false, error: 'Condición de firma no válida.' })
  }
  const patient = await getPatient(patientId)
  if (!patient) return sendJson(res, 404, { ok: false, error: 'Paciente no encontrado.' })
  if (!(await isAssigned(profile, patientId))) {
    return sendJson(res, 403, { ok: false, error: 'No tienes acceso a este paciente.' })
  }
  if (profile.role === 'admin' && isClinicalDocument({ category, specialty: body.specialty }) && !hasPermission(profile, 'clinical.view.all')) {
    return sendJson(res, 403, { ok: false, error: 'La administración no puede incorporar documentación clínica sin clinical.view.all.' })
  }

  let bytes
  try { bytes = Buffer.from(base64, 'base64') } catch { bytes = null }
  if (!bytes || bytes.length === 0) return sendJson(res, 400, { ok: false, error: 'PDF no válido.' })
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'El PDF supera el tamaño máximo permitido (3 MB).' })
  }
  if (bytes.subarray(0, 5).toString('utf8') !== '%PDF-') {
    return sendJson(res, 400, { ok: false, error: 'El archivo no es un PDF válido.' })
  }

  const documentId = crypto.randomUUID()
  const signedPdfSha256 = sha256Hex(bytes)
  const path = `${patientId}/${documentId}/externo-${signedPdfSha256.slice(0, 12)}.pdf`
  const settings = await getSettings()
  const summary = [
    'Documento firmado externamente e incorporado al expediente.',
    '',
    `Título: ${title}`,
    `Firmante: ${signedByName} (${signedByCondition})`,
    `Fecha declarada de firma: ${signedAt}`,
    `Método declarado: ${method}`,
    `Huella SHA-256: ${signedPdfSha256}`,
    '',
    'Nota: la plataforma verifica la integridad del archivo desde su incorporación, pero no acredita por sí sola la identidad del firmante ni la validez jurídica externa.',
  ].join('\n')
  const contentSha256 = sha256Hex(summary)

  const upload = await admin.storage.from(BUCKET).upload(
    path,
    bytes,
    { contentType: 'application/pdf', upsert: false },
  )
  if (upload.error) {
    logServerError('storage-upload', upload.error)
    return sendJson(res, 502, { ok: false, error: 'No se pudo almacenar el PDF firmado. No se ha archivado el documento.' })
  }

  const signers = [{
    id: crypto.randomUUID(), name: signedByName, email: '', condition: signedByCondition,
    required: true, status: 'firmado', signedAt, verificationMethod: method,
    assurance: 'firma_manual_externa', authorityConfirmed: true,
    evidence: { externalUpload: true, originalSha256: signedPdfSha256, notes },
  }]
  const { data, error } = await admin.from('patient_documents').insert({
    id: documentId,
    patient_id: patientId,
    template_id: null,
    template_name: 'Documento firmado externamente',
    template_version: 0,
    category,
    specialty: clean(body.specialty, 40) || null,
    professional_id: profile.id,
    professional_name: profile.name || '',
    title,
    status: 'firmado',
    version: 1,
    is_current: true,
    fields: {},
    patient_snapshot: {
      fullName: [patient.first_name, patient.second_name, patient.last_name, patient.second_last_name].filter(Boolean).join(' '),
      dni: patient.dni, birthDate: patient.birth_date, address: patient.address,
      phone: patient.phone, email: patient.email,
      legalGuardian: patient.legal_guardian_name ? {
        name: patient.legal_guardian_name, dni: patient.legal_guardian_dni,
        phone: patient.legal_guardian_phone, email: patient.legal_guardian_email,
        relationship: patient.legal_guardian_relationship,
      } : null,
      representationType: patient.representation_type || null,
      isMinor: patient.birth_date ? new Date(patient.birth_date).getTime() > Date.now() - 18 * 365.25 * 86400000 : false,
    },
    professional_snapshot: { id: profile.id, name: profile.name, email: profile.email, role: profile.role },
    center_snapshot: {
      centerName: settings.center_name, legalName: settings.legal_name, cif: settings.cif,
      address: settings.address, phone: settings.phone, email: settings.email,
    },
    rendered_text: summary,
    content_sha256: contentSha256,
    signers,
    required_signatures: 1,
    signed_count: 1,
    signature_assurance: 'firma_manual_externa',
    signature_provider: 'Documento externo verificado al incorporar',
    evidence: {
      sha256: contentSha256, signedSha256: signedPdfSha256, signedAt,
      signedByName, signedByCondition, verificationMethod: method,
      assurance: 'firma_manual_externa', provider: 'Aportado por el paciente o el centro',
      integrityVerified: true, certificateInfo: null, signatures: [{
        name: signedByName, condition: signedByCondition, signedAt,
        verificationMethod: method, assurance: 'firma_manual_externa',
      }],
    },
    signed_pdf_path: path,
    signed_pdf_sha256: signedPdfSha256,
    signed_at: signedAt,
    archived_at: nowIso(),
    external_upload: true,
    notes,
    created_by: profile.id,
    created_by_name: profile.name || '',
    created_at: nowIso(),
    updated_at: nowIso(),
  }).select('*').single()
  if (error || !data) {
    logServerError('external-insert', error)
    return sendJson(res, 502, { ok: false, error: 'El PDF se almacenó, pero no se pudo registrar en el expediente. Revisa Storage y contacta con soporte.' })
  }
  await addEvent({
    req, documentId: data.id, patientId, type: 'external_upload', actorId: profile.id,
    actorName: profile.name || '', actorType: 'usuario',
    detail: `Documento firmado externamente incorporado. Huella del PDF: ${signedPdfSha256}`,
    metadata: { category, method, signedByName },
  })
  await addEvent({
    req, documentId: data.id, patientId, type: 'archived', actorId: profile.id,
    actorName: profile.name || '', actorType: 'usuario',
    detail: 'Documento externo archivado en el expediente con huella de integridad.',
  })
  await audit(profile, 'document.external_upload', data.id, `Carga externa: ${title}`, patientId)
  return sendJson(res, 200, { ok: true, documentId: data.id, signedPdfSha256 })
}

// ------------------------------------------------------------
//  Acciones públicas
// ------------------------------------------------------------

async function actionPublicPreview(req, res) {
  const body = req.body || {}
  const token = clean(body.token, 500)
  const request = await getSignatureRequestByToken(token)
  if (!request) return sendJson(res, 404, { ok: false, error: 'Este enlace no es válido o ha dejado de estar disponible.' })
  const document = await getDocument(request.document_id)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  const problem = await requestProblem(request, document, true)
  if (problem) return sendJson(res, problem.status, { ok: false, error: problem.error })
  const settings = await getSettings()
  return sendJson(res, 200, {
    ok: true,
    preview: {
      ok: true,
      title: document.title,
      centerName: document.center_snapshot?.centerName || settings.center_name || 'Sinestesya',
      recipientName: request.recipient_name,
      recipientEmailMasked: maskEmail(request.recipient_email),
      expiresAt: request.expires_at,
      status: request.status,
      requiresOtp: true,
      isDemo: false,
      providerLabel: document.signature_provider || providerLabel(),
      assurance: document.signature_assurance || assureFor(),
    },
  })
}

async function actionPublicRequestOtp(req, res) {
  const body = req.body || {}
  const token = clean(body.token, 500)
  const request = await getSignatureRequestByToken(token)
  if (!request) return sendJson(res, 404, { ok: false, error: 'Enlace no válido.' })
  const document = await getDocument(request.document_id)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  const problem = await requestProblem(request, document, false)
  if (problem) return sendJson(res, problem.status, { ok: false, error: problem.error })

  if (request.otp_last_sent_at && Date.now() - new Date(request.otp_last_sent_at).getTime() < 45000) {
    return sendJson(res, 429, { ok: false, error: 'Espera unos segundos antes de solicitar otro código.' })
  }
  const settings = await getSettings()
  const minutes = Math.max(5, Math.min(30, Number(settings.document_settings?.otpTtlMinutes) || 10))
  const code = randomOtp()
  const otpHash = hmacHex(code)
  const expiresAt = otpExpiry(minutes)
  const { error } = await admin.from('document_signature_requests').update({
    otp_hash: otpHash, otp_expires_at: expiresAt, otp_attempts: 0,
    otp_last_sent_at: nowIso(), status: 'pendiente',
    verification_hash: null, verification_expires_at: null,
  }).eq('id', request.id)
  if (error) return sendJson(res, 500, { ok: false, error: 'No se pudo generar el código.' })

  try {
    await sendEmail({
      to: request.recipient_email,
      subject: 'Código de verificación · Sinestesya',
      text: `Tu código de verificación es ${code}. Caduca en ${minutes} minutos. No lo compartas con nadie.\n\nSi no has solicitado este código, ignora el mensaje y contacta con el centro.`,
      html: emailShell('Código de verificación', `
        <p style="font-size:14px;line-height:1.6">Introduce este código en la página de firma:</p>
        <p style="font-size:34px;letter-spacing:.22em;font-weight:700;margin:20px 0">${code}</p>
        <p style="font-size:13px;color:#57534e">Caduca en ${minutes} minutos. No lo compartas con nadie.</p>
        <p style="font-size:12px;color:#8a7f73">Si no has solicitado este código, ignora el mensaje y contacta con el centro.</p>
      `),
    })
  } catch (error) {
    await admin.from('document_signature_requests').update({
      otp_hash: null, otp_expires_at: null, status: 'error',
      failure_reason: clean(error?.message, 500),
    }).eq('id', request.id)
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'error', actorName: request.recipient_name, actorType: 'sistema',
      detail: 'No se pudo enviar el código OTP. No se permite el acceso.',
    })
    return sendJson(res, 502, { ok: false, error: 'No se pudo enviar el código. Inténtalo más tarde o contacta con el centro.' })
  }
  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'otp_sent', actorName: request.recipient_name, actorType: 'sistema',
    detail: 'Código OTP enviado al correo del firmante.',
  })
  return sendJson(res, 200, { ok: true, maskedEmail: maskEmail(request.recipient_email) })
}

async function actionPublicVerifyOtp(req, res) {
  const body = req.body || {}
  const token = clean(body.token, 500)
  const code = clean(body.code, 10)
  if (!/^\d{6}$/.test(code)) return sendJson(res, 400, { ok: false, error: 'El código debe tener 6 dígitos.' })
  const request = await getSignatureRequestByToken(token)
  if (!request) return sendJson(res, 404, { ok: false, error: 'Enlace no válido.' })
  const document = await getDocument(request.document_id)
  if (!document) return sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
  const problem = await requestProblem(request, document, false)
  if (problem) return sendJson(res, problem.status, { ok: false, error: problem.error })
  if (!request.otp_hash || !request.otp_expires_at) {
    return sendJson(res, 400, { ok: false, error: 'Solicita un código nuevo antes de continuar.' })
  }
  const settings = await getSettings()
  const maxAttempts = Math.max(3, Math.min(10, Number(settings.document_settings?.otpMaxAttempts) || 5))
  if (new Date(request.otp_expires_at).getTime() <= Date.now()) {
    return sendJson(res, 410, { ok: false, error: 'El código ha caducado. Solicita uno nuevo.' })
  }
  if ((request.otp_attempts || 0) >= maxAttempts) {
    await admin.from('document_signature_requests').update({
      status: 'error', failure_reason: 'Se superó el número máximo de intentos de verificación.',
      otp_hash: null, otp_expires_at: null,
    }).eq('id', request.id)
    const signers = parseJson(document.signers, [])
    if (!signers.some(s => s.status === 'firmado')) {
      await admin.from('patient_documents').update({ status: 'firma_fallida', updated_at: nowIso() }).eq('id', document.id)
    }
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'error', actorName: request.recipient_name, actorType: 'sistema',
      detail: 'Máximo de intentos OTP superado. El documento no se marca como firmado.',
    })
    return sendJson(res, 429, { ok: false, error: 'Se han superado los intentos permitidos. Solicita un enlace nuevo al centro.' })
  }
  const expected = hmacHex(code)
  if (!secureCompare(expected, request.otp_hash)) {
    await admin.from('document_signature_requests').update({ otp_attempts: (request.otp_attempts || 0) + 1 }).eq('id', request.id)
    return sendJson(res, 400, { ok: false, error: `Código incorrecto. Intentos restantes: ${Math.max(0, maxAttempts - (request.otp_attempts || 0) - 1)}.` })
  }

  const sessionToken = randomSecret(32)
  const verificationHash = sha256Hex(sessionToken)
  const verifiedAt = nowIso()
  const { data: updatedRequest, error } = await admin.from('document_signature_requests').update({
    status: 'verificado', verified_at: verifiedAt,
    verification_hash: verificationHash,
    verification_expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
    otp_hash: null, otp_expires_at: null,
  }).eq('id', request.id).select('*').single()
  if (error || !updatedRequest) return sendJson(res, 500, { ok: false, error: 'No se pudo verificar el enlace.' })

  if (!document.viewed_at) {
    await admin.from('patient_documents').update({ viewed_at: verifiedAt, updated_at: nowIso() }).eq('id', document.id)
  }
  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'accessed', actorName: request.recipient_name, actorType: 'firmante',
    detail: 'Acceso al documento tras verificación OTP. Se muestra el contenido completo.',
  })
  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'otp_verified', actorName: request.recipient_name, actorType: 'firmante',
    detail: 'Identidad verificada mediante OTP de correo.',
  })
  return sendJson(res, 200, {
    ok: true,
    sessionToken,
    document: publicDocumentPayload(updatedRequest, document, settings),
  })
}

async function validatePublicSession(req, res, { allowSigned = false } = {}) {
  const body = req.body || {}
  const token = clean(body.token, 500)
  const sessionToken = clean(body.sessionToken, 500)
  if (!token || !sessionToken) {
    sendJson(res, 400, { ok: false, error: 'Falta el enlace o la sesión de firma.' })
    return null
  }
  const request = await getSignatureRequestByToken(token)
  if (!request) {
    sendJson(res, 404, { ok: false, error: 'Enlace no válido.' })
    return null
  }
  const document = await getDocument(request.document_id)
  if (!document) {
    sendJson(res, 404, { ok: false, error: 'Documento no encontrado.' })
    return null
  }
  const problem = await requestProblem(request, document, allowSigned)
  if (problem) {
    sendJson(res, problem.status, { ok: false, error: problem.error })
    return null
  }
  if (!request.verification_hash || !request.verification_expires_at) {
    sendJson(res, 401, { ok: false, error: 'Verifica tu identidad antes de acceder al documento.' })
    return null
  }
  if (new Date(request.verification_expires_at).getTime() <= Date.now()) {
    sendJson(res, 401, { ok: false, error: 'La sesión de firma ha caducado. Solicita un código nuevo.' })
    return null
  }
  if (!secureCompare(sha256Hex(sessionToken), request.verification_hash)) {
    sendJson(res, 401, { ok: false, error: 'Sesión de firma no válida.' })
    return null
  }
  return { request, document }
}

async function actionPublicDocument(req, res) {
  const context = await validatePublicSession(req, res, { allowSigned: true })
  if (!context) return
  const settings = await getSettings()
  return sendJson(res, 200, { ok: true, document: publicDocumentPayload(context.request, context.document, settings) })
}

async function actionPublicSign(req, res) {
  const context = await validatePublicSession(req, res, { allowSigned: false })
  if (!context) return
  const { request, document } = context
  const body = req.body || {}
  const signerName = clean(body.signerName, 200)
  const accepted = body.accepted === true
  const authorityConfirmed = body.authorityConfirmed === true
  const readConfirmed = body.readConfirmed === true
  const identityConfirmed = body.identityConfirmed === true

  if (!accepted) return sendJson(res, 400, { ok: false, error: 'Debes aceptar la firma para continuar.' })
  if (!readConfirmed || !identityConfirmed) return sendJson(res, 400, { ok: false, error: 'Confirma la lectura y la identidad antes de firmar.' })
  if (!signerName) return sendJson(res, 400, { ok: false, error: 'Indica el nombre completo del firmante.' })
  if (request.condition !== 'paciente' && !authorityConfirmed) {
    return sendJson(res, 400, { ok: false, error: 'Debes confirmar que actúas como representante legal o tutor.' })
  }

  const expectedHash = sha256Hex(contentMaterial(document))
  if (!document.content_sha256 || expectedHash !== document.content_sha256) {
    await admin.from('patient_documents').update({
      status: 'firma_fallida', updated_at: nowIso(),
    }).eq('id', document.id)
    await admin.from('document_signature_requests').update({
      status: 'error', failure_reason: 'Fallo de integridad del contenido.',
    }).eq('id', request.id)
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'error', actorName: signerName, actorType: 'sistema',
      detail: 'La huella del contenido no coincide con la del documento generado. Firma bloqueada.',
      metadata: { expected: document.content_sha256, actual: expectedHash },
    })
    return sendJson(res, 409, { ok: false, error: 'La integridad del documento no se pudo verificar. Contacta con el centro.' })
  }

  const settings = await getSettings()
  const assurance = document.signature_assurance || assureFor()
  const signedAt = nowIso()
  const signers = parseJson(document.signers, [])
  const target = signers.find(s => s.id === request.signer_id)
  if (!target) return sendJson(res, 409, { ok: false, error: 'El firmante ya no está activo en este documento.' })
  if (target.status === 'firmado') return sendJson(res, 409, { ok: false, error: 'Este firmante ya firmó el documento.' })

  const signerEvidence = {
    requestId: request.id,
    assurance,
    verificationMethod: 'Enlace de un solo uso + OTP de correo',
    readConfirmed,
    identityConfirmed,
    authorityConfirmed,
    timestamp: signedAt,
    userAgent: clean(getHeader(req, 'user-agent'), 500),
    ipHint: clean(getHeader(req, 'x-forwarded-for'), 120),
    contentSha256: document.content_sha256,
    notQualified: assurance === 'simple_verificada_otp',
    providerReference: null,
    certificateInfo: null,
  }

  const updatedSigners = signers.map(s => s.id === request.signer_id ? {
    ...s,
    name: signerName,
    status: 'firmado',
    signedAt,
    authorityConfirmed,
    verificationMethod: 'Enlace de un solo uso + OTP de correo',
    assurance,
    evidence: signerEvidence,
  } : s)
  const requiredSignatures = updatedSigners.filter(s => s.required).length
  const signedCount = updatedSigners.filter(s => s.required && s.status === 'firmado').length
  const allSigned = requiredSignatures > 0 && signedCount >= requiredSignatures
  const evidenceSignatures = updatedSigners.filter(s => s.status === 'firmado').map(s => ({
    name: s.name, condition: s.condition,
    conditionLabel: {
      paciente: 'Paciente', representante_legal: 'Representante legal',
      representante_legal_2: 'Segundo representante legal', tutor: 'Tutor o tutora',
      profesional: 'Profesional', otro: 'Otra condición',
    }[s.condition] || s.condition,
    signedAt: s.signedAt, verificationMethod: s.verificationMethod,
    assurance: s.assurance, requestId: s.requestId || request.id,
    certificateInfo: s.evidence?.certificateInfo || null,
  }))
  const evidence = {
    sha256: document.content_sha256,
    signedAt: allSigned ? signedAt : null,
    signedByName: signerName,
    signedByCondition: request.condition,
    verificationMethod: 'Enlace de un solo uso + OTP de correo',
    assurance,
    provider: document.signature_provider || providerLabel(),
    integrityVerified: true,
    certificateInfo: null,
    signatures: evidenceSignatures,
    archiveVersion: document.version,
  }

  const pdfDocument = {
    id: document.id,
    patientId: document.patient_id,
    title: document.title,
    templateName: document.template_name,
    templateVersion: document.template_version,
    category: document.category,
    specialty: document.specialty,
    version: document.version,
    renderedText: document.rendered_text,
    contentSha256: document.content_sha256,
    status: allSigned ? 'firmado' : 'pendiente_firma',
    signatureAssurance: assurance,
    signatureProvider: document.signature_provider || providerLabel(),
    signedAt: allSigned ? signedAt : null,
    evidence,
  }

  let signedBytes
  try {
    signedBytes = await generateDocumentPdf({ document: pdfDocument, evidence })
  } catch (error) {
    logServerError('pdf-generate', error)
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'error', actorName: signerName, actorType: 'sistema',
      detail: 'No se pudo generar el PDF firmado. La firma no se ha archivado.',
    })
    return sendJson(res, 502, { ok: false, error: 'No se pudo generar el PDF firmado. La operación no se ha completado.' })
  }
  const signedPdfSha256 = sha256Hex(Buffer.from(signedBytes))
  const path = `${document.patient_id}/${document.id}/${allSigned ? 'firmado' : 'firma-parcial'}-${request.id}.pdf`
  const upload = await admin.storage.from(BUCKET).upload(
    path,
    Buffer.from(signedBytes),
    { contentType: 'application/pdf', upsert: false },
  )
  if (upload.error) {
    logServerError('storage-signed', upload.error)
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'error', actorName: signerName, actorType: 'sistema',
      detail: 'El PDF firmado no se pudo archivar. La firma no se ha registrado como completada.',
    })
    return sendJson(res, 502, { ok: false, error: 'No se pudo archivar el PDF firmado. La firma no se ha completado.' })
  }

  // Primero se registra la firma; si la actualización del documento falla, la
  // petición queda marcada como error y no se presenta como firmada.
  const { error: requestError } = await admin.from('document_signature_requests').update({
    status: 'firmado',
    signed_at: signedAt,
    verification_hash: request.verification_hash,
    verification_expires_at: request.verification_expires_at,
    signed_pdf_path: path,
    signed_pdf_sha256: signedPdfSha256,
    evidence: signerEvidence,
  }).eq('id', request.id)
  if (requestError) {
    await admin.storage.from(BUCKET).remove([path])
    return sendJson(res, 500, { ok: false, error: 'No se pudo registrar la firma. El archivo temporal se ha eliminado.' })
  }

  const updatePayload = {
    signers: updatedSigners,
    required_signatures: requiredSignatures,
    signed_count: signedCount,
    status: allSigned ? 'firmado' : 'pendiente_firma',
    signed_at: allSigned ? signedAt : document.signed_at || null,
    archived_at: allSigned ? signedAt : document.archived_at || null,
    signature_assurance: assurance,
    signature_provider: document.signature_provider || providerLabel(),
    evidence,
    updated_at: nowIso(),
  }
  if (allSigned) {
    updatePayload.signed_pdf_path = path
    updatePayload.signed_pdf_sha256 = signedPdfSha256
  }
  const { data: updatedDocument, error: docError } = await admin.from('patient_documents')
    .update(updatePayload).eq('id', document.id).select('*').single()
  if (docError || !updatedDocument) {
    await admin.from('document_signature_requests').update({
      status: 'error', failure_reason: 'No se pudo actualizar el documento tras la firma.',
    }).eq('id', request.id)
    await admin.storage.from(BUCKET).remove([path])
    return sendJson(res, 500, { ok: false, error: 'No se pudo archivar la firma en el expediente. Contacta con soporte.' })
  }

  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'signed', actorName: signerName, actorType: 'firmante',
    detail: allSigned
      ? 'Firma registrada. Todas las firmas requeridas están completas.'
      : `Firma registrada. Pendientes ${requiredSignatures - signedCount} firma(s) obligatoria(s).`,
    metadata: { assurance, allSigned, signedPdfSha256 },
  })
  if (allSigned) {
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'verified', actorName: 'Sistema', actorType: 'sistema',
      detail: 'Huella del PDF firmado calculada y archivada.',
      metadata: { signedPdfSha256 },
    })
    await addEvent({
      req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
      type: 'archived', actorName: 'Sistema', actorType: 'sistema',
      detail: 'Documento firmado archivado en el expediente. No se sobrescribirá.',
      metadata: { signedPdfSha256 },
    })
  }
  const refreshedRequest = await getSignatureRequestById(request.id)
  return sendJson(res, 200, {
    ok: true,
    document: publicDocumentPayload(refreshedRequest || request, updatedDocument, settings),
    signedPdfBase64: bytesToBase64(signedBytes),
    signedPdfSha256,
    allSigned,
  })
}

async function actionPublicReject(req, res) {
  const context = await validatePublicSession(req, res, { allowSigned: false })
  if (!context) return
  const { request, document } = context
  const reason = clean(req.body?.reason, 1000) || 'El firmante rechazó la firma sin indicar motivo.'
  // Un rechazo invalida los enlaces pendientes para que ninguna otra firma
  // pueda convertir el documento en firmado después del rechazo.
  await admin.from('document_signature_requests').update({
    status: 'revocado', failure_reason: 'Documento rechazado por otro firmante.',
    verification_hash: null, verification_expires_at: null, otp_hash: null,
  }).eq('document_id', document.id).neq('id', request.id).in('status', ['pendiente', 'verificado'])
  await admin.from('document_signature_requests').update({
    status: 'rechazado', rejected_at: nowIso(), failure_reason: reason,
    verification_hash: null, verification_expires_at: null, otp_hash: null,
  }).eq('id', request.id)
  const signers = parseJson(document.signers, []).map(s => {
    if (s.id === request.signer_id) return { ...s, status: 'rechazado', evidence: { rejectionReason: reason } }
    if (s.status === 'firmado') return s
    return { ...s, status: 'revocado' }
  })
  await admin.from('patient_documents').update({
    status: 'rechazado', signers, updated_at: nowIso(),
  }).eq('id', document.id)
  await addEvent({
    req, documentId: document.id, patientId: document.patient_id, requestId: request.id,
    type: 'rejected', actorName: request.recipient_name, actorType: 'firmante',
    detail: `Firma rechazada. Motivo: ${reason}`,
  })
  return sendJson(res, 200, { ok: true, message: 'El rechazo ha quedado registrado. El centro podrá contactarte.' })
}

// ------------------------------------------------------------
//  Handler
// ------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Allow', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método no permitido.' })
  }
  if (!admin) {
    return sendJson(res, 500, { ok: false, error: 'Configuración del servidor incompleta.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  req.body = body || {}
  const action = clean(req.body.action, 80)
  if (!action) return sendJson(res, 400, { ok: false, error: 'Falta la acción.' })

  try {
    if (action.startsWith('public-')) {
      if (action === 'public-preview') return await actionPublicPreview(req, res)
      if (action === 'public-request-otp') return await actionPublicRequestOtp(req, res)
      if (action === 'public-verify-otp') return await actionPublicVerifyOtp(req, res)
      if (action === 'public-document') return await actionPublicDocument(req, res)
      if (action === 'public-sign') return await actionPublicSign(req, res)
      if (action === 'public-reject') return await actionPublicReject(req, res)
      return sendJson(res, 400, { ok: false, error: 'Acción pública no válida.' })
    }

    const profile = await authenticate(req, res)
    if (!profile) return
    if (action === 'capabilities') return await actionCapabilities(req, res, profile)
    if (action === 'send') return await actionSend(req, res, profile)
    if (action === 'revoke') return await actionRevoke(req, res, profile)
    if (action === 'download') return await actionDownload(req, res, profile)
    if (action === 'upload-signed') return await actionUploadSigned(req, res, profile)
    return sendJson(res, 400, { ok: false, error: 'Acción no válida.' })
  } catch (error) {
    logServerError(action, error)
    return sendJson(res, 500, { ok: false, error: 'Error interno al procesar la documentación.' })
  }
}
