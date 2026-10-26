/**
 * Vercel Serverless Function: /api/transcribe
 * ─────────────────────────────────────────────
 * Recibe un archivo de audio (multipart/form-data),
 * lo envía a OpenAI Whisper y devuelve { text: "..." }.
 *
 * Variable de entorno necesaria en Vercel:
 *   OPENAI_API_KEY
 */

import { IncomingForm } from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

// Desactivar el body parser de Vercel para manejar multipart manualmente
export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Parsea el multipart form data de la request.
 * Devuelve { fields, files }.
 */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25 MB (límite de Whisper)
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  // Validar API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY no configurada en Vercel.');
    return res.status(500).json({ error: 'Servicio de transcripción no configurado.' });
  }

  let tmpPath = null;

  try {
    // Parsear el archivo de audio del multipart
    const { files } = await parseForm(req);

    // formidable v3 puede devolver array o single file
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de audio.' });
    }

    tmpPath = audioFile.filepath;

    // Renombrar con extensión .webm para que Whisper lo identifique
    const renamedPath = tmpPath + '.webm';
    fs.renameSync(tmpPath, renamedPath);
    tmpPath = renamedPath;

    // Enviar a OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: 'whisper-1',
      language: 'es',
      response_format: 'json',
    });

    // Limpiar fichero temporal
    try { fs.unlinkSync(renamedPath); } catch (_) {}

    console.log(`🎙️ Whisper transcribed: "${transcription.text?.slice(0, 80)}..."`);
    return res.status(200).json({ text: transcription.text });

  } catch (err) {
    // Limpiar fichero temporal en caso de error
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }

    console.error('❌ Error en /api/transcribe:', err?.message || err);

    const msg = err?.status === 401
      ? 'API key de OpenAI inválida o no configurada.'
      : err?.message || 'Error interno al transcribir.';

    return res.status(500).json({ error: msg });
  }
}
