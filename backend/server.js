require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Importamos bcrypt

// ── Transcripción de voz (Whisper) ────────────────────────────
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Multer: guarda el audio en un fichero temporal del sistema
const upload = multer({ dest: os.tmpdir() });
// ─────────────────────────────────────────────────────────────

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_demo';

// Middleware
app.use(cors());
app.use(express.json());

// Database Config
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medcore_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Test Database Connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error fatal: No se pudo conectar a la base de datos', err.stack);
    console.error('   Asegúrate de que PostgreSQL está corriendo y la base de datos "medcore_db" existe.');
  } else {
    console.log('✅ Conexión exitosa a la base de datos PostgreSQL: ' + (process.env.DB_NAME || 'medcore_db'));
    release();
  }
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// Login Seguro con Bcrypt
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // 1. Buscamos el usuario por email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return res.status(401).json({ message: 'Contraseña incorrecta' });
      }

      // Mapear campos de DB (snake_case) a Frontend (camelCase)
      const userData = {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        avatarUrl: user.avatar_url
      };
      
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '8h' });
      res.json({ user: userData, token });
    } else {
      res.status(401).json({ message: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Patients
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    // Incluimos privacy_policy_signed
    const result = await pool.query('SELECT id, dni, first_name as "firstName", last_name as "lastName", birth_date as "birthDate", phone, email, address, privacy_policy_signed as "privacyPolicySigned" FROM patients ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { 
    console.error(err);
    res.status(500).json(err); 
  }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, dni, first_name as "firstName", last_name as "lastName", birth_date as "birthDate", phone, email, address, privacy_policy_signed as "privacyPolicySigned" FROM patients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).send();
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
  const { dni, firstName, lastName, birthDate, phone, email, address } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO patients (dni, first_name, last_name, birth_date, phone, email, address, privacy_policy_signed) VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id',
      [dni, firstName, lastName, birthDate, phone, email, address]
    );
    res.json(result.rows[0]);
  } catch (err) { 
    console.error(err);
    res.status(500).json(err); 
  }
});

// Toggle Privacy Policy
app.put('/api/patients/:id/privacy', authenticateToken, async (req, res) => {
  const { signed } = req.body; // boolean
  try {
    await pool.query('UPDATE patients SET privacy_policy_signed = $1 WHERE id = $2', [signed, req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Mock Email Send
app.post('/api/patients/:id/send-privacy', authenticateToken, async (req, res) => {
  // Simulamos envío de correo
  setTimeout(() => {
    console.log(`📧 Email de política de privacidad enviado al paciente ${req.params.id}`);
    res.json({ message: 'Email enviado correctamente' });
  }, 1500);
});

// Appointments
app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT a.id, a.patient_id as "patientId", a.professional_id as "professionalId", 
             a.date, a.status, a.reason, a.notes,
             CONCAT(p.first_name, ' ', p.last_name) as "patientName",
             u.full_name as "professionalName"
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.professional_id = u.id
      ORDER BY a.date ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
  const { patientId, professionalId, date, status, reason, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO appointments (patient_id, professional_id, date, status, reason, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [patientId, professionalId, date, status, reason, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json(err); }
});

// Medical History
app.get('/api/history/:patientId', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT h.id, h.patient_id as "patientId", h.professional_id as "professionalId", 
             h.date, h.description,
             u.full_name as "professionalName"
      FROM medical_history h
      LEFT JOIN users u ON h.professional_id = u.id
      WHERE h.patient_id = $1
      ORDER BY h.date DESC
    `;
    const result = await pool.query(query, [req.params.patientId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/history', authenticateToken, async (req, res) => {
  const { patientId, professionalId, description } = req.body;
  try {
    await pool.query(
      'INSERT INTO medical_history (patient_id, professional_id, description) VALUES ($1, $2, $3)',
      [patientId, professionalId, description]
    );
    res.sendStatus(201);
  } catch (err) { res.status(500).json(err); }
});

// --- PROFESSIONALS MANAGEMENT (CRUD) ---

// Get all professionals (Including admins if needed for the list)
app.get('/api/professionals', authenticateToken, async (req, res) => {
  try {
    // Devolvemos todos para que el admin pueda gestionarlos
    const result = await pool.query('SELECT id, full_name as name, email, role, specialty FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json(err); }
});

// Create Professional
app.post('/api/professionals', authenticateToken, async (req, res) => {
  // Solo admin debería poder crear usuarios
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });

  const { name, email, role, specialty } = req.body;
  
  // Contraseña por defecto: "medcore123"
  const defaultPassword = 'medcore123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(defaultPassword, saltRounds);
    
    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, specialty) VALUES ($1, $2, $3, $4, $5)',
      [name, email, hash, role, specialty]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creando usuario. El email podría estar duplicado.' });
  }
});

// Delete Professional
app.delete('/api/professionals/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
    
    // Evitar que el admin se borre a sí mismo
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'No puedes borrar tu propia cuenta' });

    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'No se puede borrar porque tiene citas o historial asociado.' });
    }
});


// ── POST /api/transcribe ──────────────────────────────────────
// Recibe un fichero de audio (multipart), lo pasa a Whisper y
// devuelve { text: "..." }. No toca ninguna otra ruta.
app.post('/api/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo de audio.' });
  }

  const tmpPath = req.file.path;

  try {
    // Renombrar con extensión correcta para que Whisper lo acepte
    const ext = '.webm';
    const renamedPath = tmpPath + ext;
    fs.renameSync(tmpPath, renamedPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: 'whisper-1',
      language: 'es',
      response_format: 'json',
    });

    // Limpiar fichero temporal
    fs.unlinkSync(renamedPath);

    console.log(`🎙️  Whisper transcribed: "${transcription.text?.slice(0, 80)}..."`);
    res.json({ text: transcription.text });

  } catch (err) {
    // Limpiar fichero temporal aunque haya error
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    try { fs.unlinkSync(tmpPath + '.webm'); } catch (_) {}

    console.error('❌ Error en /api/transcribe:', err?.message || err);
    const msg = err?.status === 401
      ? 'API key de OpenAI inválida o no configurada.'
      : err?.message || 'Error interno al transcribir.';
    res.status(500).json({ error: msg });
  }
});
// ─────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
});