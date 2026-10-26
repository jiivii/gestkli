/**
 * Vercel Serverless Function: /api/profiles
 * ──────────────────────────────────────────
 * Gestión de perfiles profesionales con la service_role de Supabase.
 * Nunca se expone la service_role al navegador.
 *
 *   POST   → { action: 'create', name, email, role, profession, permissions?, password? }
 *            Crea la cuenta en Auth y el perfil. Si no se envía password, se
 *            intenta enviar una invitación por correo.
 *   PATCH  → { action: 'update', professionalId, name?, role?, profession?,
 *              permissions?, active?, phone? }
 *   DELETE → { professionalId }
 *
 * Seguridad:
 *   · Solo un perfil admin activo puede llamar a esta función.
 *   · No se permite que un administrador se quite a sí mismo el acceso.
 *   · No se puede eliminar/desactivar el último administrador activo.
 *   · Todas las operaciones quedan registradas en audit_log.
 *
 * Variables de entorno necesarias en Vercel:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const APP_ROLES = ['admin', 'fisioterapia', 'nutricion', 'psicologia', 'logopedia', 'pendiente']
const CLINICAL_ROLES = ['fisioterapia', 'nutricion', 'psicologia', 'logopedia']
const VALID_PROFESSIONS = [...CLINICAL_ROLES, 'otro']

const ALLOWED_PERMISSIONS = new Set([
  'agenda.view.all',
  'agenda.view.own',
  'agenda.manage.all',
  'agenda.manage.own',
  'patients.view.all',
  'patients.view.assigned',
  'patients.create',
  'patients.edit.admin',
  'patients.assign',
  'clinical.view.own',
  'clinical.write.own',
  'clinical.view.all',
  'clinical.consents.manage',
  'billing.view',
  'billing.manage',
  'services.manage',
  'reports.view',
  'professionals.manage',
  'settings.manage',
  'audit.view',
  'messages.use'
])

const clean = (value, max) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const normaliseRole = (value) => (APP_ROLES.includes(value) ? value : null)

/** Traduce el perfil de la app al esquema compatible role/profession. */
const toDbRole = (appRole, profession) => {
  if (appRole === 'admin') return { role: 'admin', profession: null }
  if (CLINICAL_ROLES.includes(appRole)) return { role: 'medico', profession: appRole }
  if (appRole === 'pendiente') return { role: 'medico', profession: null }
  if (CLINICAL_ROLES.includes(profession)) return { role: 'medico', profession }
  if (profession === 'otro') return { role: 'medico', profession: 'otro' }
  return { role: 'medico', profession: null }
}

const normalisePermissions = (value) => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return { error: 'Los permisos deben enviarse como lista.' }
  const unique = Array.from(new Set(value.filter((item) => typeof item === 'string')))
  const invalid = unique.filter((item) => !ALLOWED_PERMISSIONS.has(item))
  if (invalid.length) {
    return { error: `Permiso no reconocido: ${invalid.join(', ')}.` }
  }
  return unique
}

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
    .select('id, full_name, role, profession, active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'No se encontró tu perfil de usuario.' })
    return null
  }

  if (profile.role !== 'admin' || profile.active === false) {
    res.status(403).json({ error: 'Solo un administrador activo puede modificar perfiles.' })
    return null
  }

  return profile
}

async function writeAudit(actor, action, entityId, detail) {
  try {
    await admin.from('audit_log').insert({
      user_id: actor.id,
      user_name: actor.full_name || 'Administración',
      role: actor.role || 'admin',
      action,
      entity: 'profile',
      entity_id: entityId,
      patient_id: null,
      detail
    })
  } catch (error) {
    console.error('No se pudo registrar la auditoría:', error?.message || error)
  }
}

async function countActiveAdmins() {
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('active', true)
  return count || 0
}

const schemaError = (error) => {
  const message = error?.message || ''
  if (error?.code === '42703' || /column .* does not exist/i.test(message)) {
    return 'El esquema no está actualizado. Ejecuta supabase/sinestesya_setup.sql en Supabase.'
  }
  return message || 'No se pudo guardar el perfil.'
}

async function createProfile(req, res, actor) {
  const body = req.body || {}
  const name = clean(body.name, 120)
  const email = clean(body.email, 160).toLowerCase()
  const appRole = normaliseRole(body.role) || 'pendiente'
  const profession = body.profession === null || body.profession === ''
    ? null
    : clean(body.profession, 30)
  const permissions = normalisePermissions(body.permissions)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name) return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'El correo electrónico no es válido.' })
  if (profession !== null && !VALID_PROFESSIONS.includes(profession)) {
    return res.status(400).json({ error: 'La profesión no es válida.' })
  }
  if (permissions?.error) return res.status(400).json({ error: permissions.error })
  if (password && password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })
  }

  const { role: dbRole, profession: dbProfession } = toDbRole(appRole, profession)

  // 1. Cuenta de autenticación
  let userId = null
  let invited = false

  if (password) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })
    if (error || !data?.user) {
      const message = /already registered|already exists/i.test(error?.message || '')
        ? 'Ya existe una cuenta con ese correo.'
        : (error?.message || 'No se pudo crear la cuenta.')
      return res.status(400).json({ error: message })
    }
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name }
    })
    if (error || !data?.user) {
      const message = /already registered|already exists/i.test(error?.message || '')
        ? 'Ya existe una cuenta con ese correo.'
        : `No se pudo enviar la invitación: ${error?.message || 'revisa la configuración de correo de Supabase.'}`
      return res.status(502).json({
        error: `${message} También puedes crear la cuenta manualmente en Authentication → Users.`
      })
    }
    userId = data.user.id
    invited = true
  }

  // 2. Perfil con rol, profesión y permisos
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: userId,
      full_name: name,
      email,
      role: dbRole,
      profession: dbProfession,
      permissions: permissions || [],
      active: true
    }, { onConflict: 'id' })
    .select('id, full_name, email, role, profession, permissions, active')
    .single()

  if (profileError) {
    console.error('Error creando perfil:', profileError)
    // La cuenta de Auth ya existe: se devuelve su id para que pueda repararse.
    return res.status(500).json({
      error: `${schemaError(profileError)} La cuenta de acceso ${userId} ya existe; corrige el esquema y vuelve a intentarlo.`
    })
  }

  await writeAudit(
    actor,
    'professional.create',
    userId,
    `Alta de perfil ${name} (${appRole}${dbProfession ? ` · ${dbProfession}` : ''})`
  )

  return res.status(200).json({ ok: true, invited, profile })
}

async function updateProfile(req, res, actor) {
  const body = req.body || {}
  const professionalId = clean(body.professionalId, 64)
  if (!professionalId) return res.status(400).json({ error: 'Falta el identificador del profesional.' })

  const { data: current, error: currentError } = await admin
    .from('profiles')
    .select('id, full_name, role, profession, permissions, active')
    .eq('id', professionalId)
    .single()

  if (currentError || !current) {
    return res.status(404).json({ error: 'No se encontró el perfil del profesional.' })
  }

  const isSelf = current.id === actor.id
  const updates = {}
  const changedLabels = []

  if (body.name !== undefined) {
    const name = clean(body.name, 120)
    if (!name) return res.status(400).json({ error: 'El nombre no puede estar vacío.' })
    updates.full_name = name
    changedLabels.push('nombre')
  }

  if (body.phone !== undefined) {
    updates.phone = clean(body.phone, 30) || null
    changedLabels.push('teléfono')
  }

  if (body.permissions !== undefined) {
    const permissions = normalisePermissions(body.permissions)
    if (permissions?.error) return res.status(400).json({ error: permissions.error })
    updates.permissions = permissions || []
    changedLabels.push('permisos')
  }

  if (body.role !== undefined) {
    const appRole = normaliseRole(body.role)
    if (!appRole) return res.status(400).json({ error: 'Perfil de acceso no válido.' })

    const professionInput = body.profession === null || body.profession === ''
      ? null
      : clean(body.profession, 30)
    if (professionInput !== null && !VALID_PROFESSIONS.includes(professionInput)) {
      return res.status(400).json({ error: 'La profesión no es válida.' })
    }

    const mapped = toDbRole(appRole, professionInput)
    updates.role = mapped.role
    updates.profession = mapped.profession
    changedLabels.push('perfil de acceso')

    if (isSelf && appRole !== 'admin') {
      return res.status(400).json({ error: 'No puedes retirarte a ti mismo el perfil de administración.' })
    }
  } else if (body.profession !== undefined) {
    if (current.role === 'admin') {
      return res.status(400).json({ error: 'Cambia primero el perfil de acceso de administración a un perfil clínico.' })
    }
    const profession = body.profession === null || body.profession === ''
      ? null
      : clean(body.profession, 30)
    if (profession !== null && !VALID_PROFESSIONS.includes(profession)) {
      return res.status(400).json({ error: 'La profesión no es válida.' })
    }
    updates.profession = profession
    changedLabels.push('profesión')
  }

  if (body.active !== undefined) {
    const nextActive = body.active !== false
    if (isSelf && !nextActive) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio perfil.' })
    }
    updates.active = nextActive
    changedLabels.push(nextActive ? 'perfil activado' : 'perfil desactivado')
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No hay cambios que guardar.' })
  }

  // Protección del último administrador activo.
  const losesAdmin = current.role === 'admin' && (
    updates.role === 'medico' || updates.active === false
  )
  if (losesAdmin) {
    const activeAdmins = await countActiveAdmins()
    if (activeAdmins <= 1) {
      return res.status(400).json({ error: 'No puedes dejar el centro sin ningún administrador activo.' })
    }
  }

  // Un perfil clínico no debe conservar permisos de administración por error.
  if (updates.role === 'medico' && Array.isArray(updates.permissions)) {
    const adminOnly = ['billing.view', 'billing.manage', 'services.manage', 'reports.view', 'professionals.manage', 'settings.manage', 'audit.view', 'clinical.view.all']
    const filtered = updates.permissions.filter((permission) => !adminOnly.includes(permission))
    if (filtered.length !== updates.permissions.length) {
      updates.permissions = filtered
      changedLabels.push('permisos de administración retirados')
    }
  }

  const { data: profile, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', professionalId)
    .select('id, full_name, email, role, profession, permissions, active')
    .single()

  if (error || !profile) {
    console.error('Error actualizando perfil:', error)
    return res.status(500).json({ error: schemaError(error) })
  }

  await writeAudit(
    actor,
    'professional.update',
    professionalId,
    `Actualización de perfil de ${profile.full_name}: ${changedLabels.join(', ') || 'sin cambios visibles'}`
  )

  return res.status(200).json({ ok: true, profile })
}

async function deleteProfile(req, res, actor) {
  const body = req.body || {}
  const professionalId = clean(body.professionalId, 64)
  if (!professionalId) return res.status(400).json({ error: 'Falta el identificador del profesional.' })
  if (professionalId === actor.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio perfil.' })
  }

  const { data: current, error: currentError } = await admin
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('id', professionalId)
    .single()

  if (currentError || !current) {
    return res.status(404).json({ error: 'No se encontró el perfil del profesional.' })
  }

  if (current.role === 'admin') {
    const activeAdmins = await countActiveAdmins()
    if (activeAdmins <= 1) {
      return res.status(400).json({ error: 'No puedes eliminar el último administrador activo.' })
    }
  }

  const { error } = await admin.auth.admin.deleteUser(professionalId)
  if (error) {
    console.error('Error eliminando cuenta:', error)
    const message = /foreign key|violates/i.test(error.message || '')
      ? 'El profesional tiene registros clínicos o facturas asociadas. Desactívalo en lugar de eliminarlo para conservar la trazabilidad.'
      : error.message || 'No se pudo eliminar la cuenta.'
    return res.status(400).json({ error: message })
  }

  await writeAudit(
    actor,
    'professional.delete',
    professionalId,
    `Cuenta eliminada: ${current.full_name}. Los registros clínicos y la auditoría se conservan.`
  )

  return res.status(200).json({ ok: true })
}

export default async function handler(req, res) {
  const actor = await authenticate(req, res)
  if (!actor) return undefined

  try {
    const body = req.body || {}
    const action = clean(body.action, 30)

    if (req.method === 'POST') {
      if (action && action !== 'create') {
        return res.status(400).json({ error: 'Acción no reconocida.' })
      }
      return await createProfile(req, res, actor)
    }

    if (req.method === 'PATCH') {
      if (action && action !== 'update') {
        return res.status(400).json({ error: 'Acción no reconocida.' })
      }
      return await updateProfile(req, res, actor)
    }

    if (req.method === 'DELETE') {
      return await deleteProfile(req, res, actor)
    }

    return res.status(405).json({ error: 'Método no permitido.' })
  } catch (error) {
    console.error('Error inesperado en /api/profiles:', error?.message || error)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}
