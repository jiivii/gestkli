import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer@6.9.9"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

// Variables de entorno para SMTP
const SMTP_HOST = Deno.env.get('SMTP_HOST')
const SMTP_PORT = Deno.env.get('SMTP_PORT')
const SMTP_USER = Deno.env.get('SMTP_USER')
const SMTP_PASS = Deno.env.get('SMTP_PASS')
const SMTP_SECURE = Deno.env.get('SMTP_SECURE') === 'true' // 'true' para puerto 465

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { patientId } = await req.json()

    // 1. Validar configuración SMTP
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error('Configuración SMTP incompleta en el servidor.')
    }

    // 2. Conectar a Supabase para obtener datos del paciente
    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: patient, error: dbError } = await supabaseClient
      .from('patients')
      .select('email, first_name, last_name, dni')
      .eq('id', patientId)
      .single()

    if (dbError || !patient) throw new Error('Paciente no encontrado.')
    if (!patient.email) throw new Error('El paciente no tiene email registrado.')

    // 3. Configurar el Transporter de Nodemailer
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE, // true para 465, false para otros (STARTTLS)
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

    // 4. Verificar conexión SMTP antes de enviar
    await new Promise((resolve, reject) => {
        transporter.verify(function (error, success) {
            if (error) reject(new Error(`Error conexión SMTP: ${error.message}`));
            else resolve(success);
        });
    });

    // 5. Enviar el correo
    const info = await transporter.sendMail({
      from: `"KLINIKA Legal" <${SMTP_USER}>`,
      to: patient.email,
      subject: 'Documentación Legal: Política de Privacidad y Protección de Datos',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #333;">
            <div style="background-color: #1e40af; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">KLINIKA</h1>
            </div>
            <div style="padding: 30px 20px;">
              <p>Estimado/a <strong>${patient.first_name} ${patient.last_name}</strong>,</p>
              <p>Se confirma la recepción y registro de su consentimiento RGPD.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin: 20px 0;">
                <p><strong>DNI:</strong> ${patient.dni}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
                <p>Sus datos están protegidos bajo la Ley Orgánica 3/2018.</p>
              </div>

              <p style="font-size: 12px; color: #999;">
                Este correo ha sido enviado automáticamente a ${patient.email}.
              </p>
            </div>
        </div>
      `,
    })

    console.log("Mensaje enviado: %s", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})