/**
 * Vercel Serverless Function: /api/reservation-requests
 * ─────────────────────────────────────────────────────
 * Gestión de las citas que llegan desde la web externa
 * (tabla `reservation_requests`) y su paso a `appointments`.
 *
 *   GET    → lista solicitudes (?status=pendiente|confirmada|cancelada)
 *   POST   → body { action: 'accept', ... }  acepta y crea la cita
 *   PATCH  → body { action: 'reject', id }    rechaza (status = 'cancelada')
 *   DELETE → ?id=<uuid>                       borra la solicitud
 *
 * Variables de entorno necesarias en Vercel (ya usadas por public-reservation.js):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Autenticación: Bearer token de la sesión Supabase del usuario.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null

// Roles que existen en la tabla profiles (user_role)
const VALID_ROLES = ['admin', 'medico', 'enfermero', 'recepcionista']

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/**
 * Valida el token y devuelve el perfil del usuario, o null
 * (ya ha enviado la respuesta de error correspondiente).
 */
async function authenticate(req, res) {
  if (!admin) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.')
    res.status(500).json({ error: 'Configuración del servidor incompleta.' })
    return null
  }

  const header = req.headers['authorization'] || req.headers['Authorization']
  const token =
    typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : null

  if (!token) {
    res.status(401).json({ error: 'No autorizado.' })
    return null
  }

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' })
    return null
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'No se encontró tu perfil de usuario.' })
    return null
  }

  if (!VALID_ROLES.includes(profile.role)) {
    res.status(403).json({ error: 'No tienes permisos para gestionar solicitudes.' })
    return null
  }

  return profile
}

/** Devuelve la solicitud o null (y responde con el error). */
async function getRequest(id, res) {
  if (!id) {
    res.status(400).json({ error: 'Falta el identificador de la solicitud.' })
    return null
  }

  const { data, error } = await admin
    .from('reservation_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Solicitud no encontrada.' })
    return null
  }

  return data
}

/** GET → listado */
async function handleList(req, res, profile) {
  const status = clean(req.query?.status, 20)

  let query = admin.from('reservation_requests').select('*')

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error listando reservation_requests:', error)
    return res.status(500).json({ error: 'No se pudieron cargar las solicitudes.' })
  }

  return res.status(200).json({ ok: true, requests: data || [], viewer: profile.full_name })
}

/** PATCH → rechazar (status = 'cancelada', se mantiene el registro) */
async function handleReject(req, res, profile) {
  const body = req.body || {}
  const id = clean(body.id, 64)

  const request = await getRequest(id, res)
  if (!request) return undefined

  if (request.status !== 'pendiente') {
    return res.status(409).json({
      error: `Esta solicitud ya fue gestionada (estado: ${request.status}).`
    })
  }

  const { data, error } = await admin
    .from('reservation_requests')
    .update({ status: 'cancelada' })
    .eq('id', id)
    .eq('status', 'pendiente')
    .select('id')
    .single()

  if (error || !data) {
    console.error('Error rechazando solicitud:', error)
    return res.status(500).json({ error: 'No se pudo rechazar la solicitud.' })
  }

  console.log(`Solicitud ${id} rechazada por ${profile.full_name}`)
  return res.status(200).json({ ok: true, id, status: 'cancelada' })
}

/** DELETE → borra la solicitud físicamente */
async function handleDelete(req, res, profile) {
  const id = clean(req.query?.id, 64)

  const request = await getRequest(id, res)
  if (!request) return undefined

  const { error } = await admin.from('reservation_requests').delete().eq('id', id)

  if (error) {
    console.error('Error eliminando solicitud:', error)
    return res.status(500).json({ error: 'No se pudo eliminar la solicitud.' })
  }

  console.log(`Solicitud ${id} eliminada por ${profile.full_name}`)
  return res.status(200).json({ ok: true, id })
}

/** POST → aceptar: crea/usar paciente + cita y marca la solicitud como confirmada */
async function handleAccept(req, res, profile) {
  const body = req.body || {}

  const id = clean(body.id, 64)
  const professionalId = clean(body.professionalId, 64)
  const date = clean(body.date, 40)
  const reason = clean(body.reason, 300)
  const notes = clean(body.notes, 1000)
  const patientId = clean(body.patientId, 64)
  const newPatient = body.newPatient || null

  // --- Validaciones ---
  if (!id) return res.status(400).json({ error: 'Falta el identificador de la solicitud.' })
  if (!professionalId) return res.status(400).json({ error: 'Debes seleccionar un profesional.' })
  if (!date || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Fecha y hora no válidas.' })
  }
  if (!patientId && !newPatient) {
    return res.status(400).json({ error: 'Debes seleccionar o crear un paciente.' })
  }

  const request = await getRequest(id, res)
  if (!request) return undefined

  if (request.status !== 'pendiente') {
    return res.status(409).json({
      error: `Esta solicitud ya fue gestionada (estado: ${request.status}).`
    })
  }

  // --- 1. Profesional ---
  const { data: professional, error: professionalError } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', professionalId)
    .single()

  if (professionalError || !professional) {
    return res.status(400).json({ error: 'El profesional seleccionado no existe.' })
  }

  // --- 2. Paciente (existente o alta nueva) ---
  let patient = null

  if (patientId) {
    const { data, error } = await admin
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', patientId)
      .single()

    if (error || !data) {
      return res.status(400).json({ error: 'El paciente seleccionado no existe.' })
    }
    patient = data
  } else {
    const firstName = clean(newPatient.firstName, 100)
    const lastName = clean(newPatient.lastName, 100)
    const dni = clean(newPatient.dni, 20)
    const birthDate = clean(newPatient.birthDate, 10)
    const phone = clean(newPatient.phone, 30)
    const email = clean(newPatient.email, 160)
    const address = clean(newPatient.address, 250)

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Nombre y apellidos del paciente son obligatorios.' })
    }
    if (!dni) return res.status(400).json({ error: 'El DNI del paciente es obligatorio.' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return res.status(400).json({ error: 'La fecha de nacimiento es obligatoria.' })
    }

    const { data: inserted, error: insertError } = await admin
      .from('patients')
      .insert({
        dni,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        phone: phone || request.telefono || null,
        email: email || request.email || null,
        address: address || null
      })
      .select('id, first_name, last_name')
      .single()

    if (insertError || !inserted) {
      if (insertError?.code === '23505') {
        return res.status(409).json({
          error: `Ya existe un paciente con el DNI "${dni}". Selecciona ese paciente existente.`
        })
      }
      console.error('Error creando paciente:', insertError)
      return res.status(500).json({ error: 'No se pudo crear la ficha del paciente.' })
    }
    patient = inserted
  }

  // --- 3. Crear la cita en `appointments` ---
  const area = clean(request.area, 50)
  const finalReason = reason || (area ? `Solicitud web · ${area}` : 'Solicitud desde la web')

  const contactLines = [
    `Solicitud de cita recibida en la web (ID ${request.id}).`,
    `Contacto: ${request.nombre} · ${request.telefono} · ${request.email}`,
    request.edad !== null && request.edad !== undefined ? `Edad: ${request.edad} años` : null,
    area ? `Área: ${area} · Tipo: ${request.paciente}` : null,
    request.notas ? `Notas del paciente: ${request.notas}` : null,
    notes ? `Notas internas: ${notes}` : null
  ]
    .filter(Boolean)
    .join('\n')

  const { data: appointment, error: appointmentError } = await admin
    .from('appointments')
    .insert({
      patient_id: patient.id,
      professional_id: professionalId,
      date,
      status: 'pendiente',
      reason: finalReason,
      notes: contactLines
    })
    .select('id')
    .single()

  if (appointmentError || !appointment) {
    console.error('Error creando cita:', appointmentError)
    return res.status(500).json({
      error: `No se pudo crear la cita: ${appointmentError?.message || 'error desconocido'}`
    })
  }

  // --- 4. Marcar la solicitud como confirmada (con rollback si falla) ---
  const { data: updated, error: updateError } = await admin
    .from('reservation_requests')
    .update({
      status: 'confirmada',
      professional_id: professionalId,
      appointment_id: appointment.id
    })
    .eq('id', id)
    .eq('status', 'pendiente')
    .select('id')
    .single()

  if (updateError || !updated) {
    console.error('Error confirmando solicitud, se revierte la cita:', updateError)
    await admin.from('appointments').delete().eq('id', appointment.id)
    return res.status(500).json({
      error: 'No se pudo confirmar la solicitud. La cita no se ha creado.'
    })
  }

  console.log(
    `Solicitud ${id} aceptada por ${profile.full_name} → cita ${appointment.id} para ${professional.full_name}`
  )

  return res.status(200).json({
    ok: true,
    id,
    appointmentId: appointment.id,
    patientId: patient.id
  })
}

export default async function handler(req, res) {
  const profile = await authenticate(req, res)
  if (!profile) return undefined

  try {
    switch (req.method) {
      case 'GET':
        return await handleList(req, res, profile)
      case 'POST':
        return await handleAccept(req, res, profile)
      case 'PATCH':
        return await handleReject(req, res, profile)
      case 'DELETE':
        return await handleDelete(req, res, profile)
      default:
        return res.status(405).json({ error: 'Método no permitido.' })
    }
  } catch (err) {
    console.error('Error inesperado en /api/reservation-requests:', err?.message || err)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}
