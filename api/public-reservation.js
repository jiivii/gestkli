import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const web2Secret = process.env.WEB2_API_SECRET

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido.'
    })
  }

  // Comprobar configuración
  if (!supabase || !web2Secret) {
    console.error('Faltan variables de entorno.')
    return res.status(500).json({
      error: 'Configuración del servidor incompleta.'
    })
  }

  // Comprobar secreto de Web2
  const receivedSecret = req.headers['x-web2-secret']

  if (
    typeof receivedSecret !== 'string' ||
    receivedSecret !== web2Secret
  ) {
    return res.status(401).json({
      error: 'No autorizado.'
    })
  }

  const body = req.body || {}

  const clean = (value, max) => {
    if (typeof value !== 'string') return ''
    return value.trim().slice(0, max)
  }

  const area = clean(body.area, 50)
  const paciente = clean(body.paciente, 20)
  const fecha = clean(body.fecha, 10)
  const hora = clean(body.hora, 5)
  const nombre = clean(body.nombre, 120)
  const telefono = clean(body.telefono, 30)
  const email = clean(body.email, 160)
  const notas = clean(body.notas, 500)

  const edad =
    body.edad === undefined ||
    body.edad === null ||
    body.edad === ''
      ? null
      : Number(body.edad)

  // Validación de fecha
  const dia = new Date(`${fecha}T12:00:00`)

  const manana = new Date()
  manana.setHours(0, 0, 0, 0)
  manana.setDate(manana.getDate() + 1)

  let validationError = ''

  if (!area) {
    validationError = 'Área no válida.'
  } else if (!['adulto', 'nino'].includes(paciente)) {
    validationError = 'Tipo de paciente no válido.'
  } else if (
    paciente === 'nino' &&
    !(Number.isInteger(edad) && edad >= 0 && edad <= 17)
  ) {
    validationError = 'Edad no válida.'
  } else if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    isNaN(dia.getTime()) ||
    dia < manana ||
    dia.getDay() % 6 === 0
  ) {
    validationError =
      'Elige un día laborable a partir de mañana.'
  } else if (!/^\d{2}:\d{2}$/.test(hora)) {
    validationError = 'Hora no válida.'
  } else if (nombre.length < 3) {
    validationError = 'Escribe tu nombre.'
  } else if (telefono.replace(/\D/g, '').length < 9) {
    validationError = 'Teléfono no válido.'
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    validationError = 'Correo no válido.'
  }

  if (validationError) {
    return res.status(400).json({
      error: validationError
    })
  }

  // Datos que vamos a guardar en Web1
  const reservation = {
    area,
    paciente,
    edad: paciente === 'nino' ? edad : null,
    fecha,
    hora,
    nombre,
    telefono,
    email,
    notas: notas || null,
    status: 'pendiente'
  }

  const { data, error } = await supabase
    .from('reservation_requests')
    .insert(reservation)
    .select('id')
    .single()

  if (error) {
    console.error(
      'Error insertando reservation_request:',
      error
    )

    return res.status(500).json({
      error: 'No hemos podido guardar la solicitud.'
    })
  }

  return res.status(201).json({
    ok: true,
    id: data.id
  })
} 