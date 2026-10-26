// Carga variables de entorno automáticamente
import 'dotenv/config';
import pkg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pkg;

// Configuración de la base de datos
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medcore_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: 5432,
});

const createAdmin = async () => {
  try {
    const email = 'admin@prueba.com';
    const password = '123456';   // Contraseña que usarás en login
    const fullName = 'Administrador';
    const role = 'admin';
    const specialty = null;
    const avatarUrl = null;

    // Crear hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar o actualizar usuario
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, specialty, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash`,
      [email, passwordHash, fullName, role, specialty, avatarUrl]
    );

    console.log(`✅ Usuario admin creado o actualizado con email: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creando usuario admin:', err);
    process.exit(1);
  }
};

createAdmin();
