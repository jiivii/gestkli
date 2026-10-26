import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

// Configuración de Supabase
const supabaseUrl = 'TU_SUPABASE_URL';
const supabaseKey = 'TU_SUPABASE_SERVICE_ROLE_KEY'; // usa service_role key en backend
const supabase = createClient(supabaseUrl, supabaseKey);

// Datos del nuevo usuario
const newUser = {
  email: 'medico@example.com',
  password: '123456', // contraseña en texto plano, se hash
  full_name: 'Dr. Juan Pérez',
  rol: 'medico', // coincide con tu enum UserRole
  specialty: 'Cardiología',
  avatar_url: null // opcional
};

const saltRounds = 10;

const createDoctor = async () => {
  try {
    // Hashear la contraseña
    const password_hash = await bcrypt.hash(newUser.password, saltRounds);

    // Insertar usuario en Supabase
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: newUser.email,
        password_hash,
        full_name: newUser.full_name,
        rol: newUser.rol,
        specialty: newUser.specialty,
        avatar_url: newUser.avatar_url,
        created_at: new Date() // timestamp actual
      }]);

    if (error) {
      console.error('Error al crear usuario:', error);
    } else {
      console.log('Usuario creado correctamente:', data);
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
};

createDoctor();