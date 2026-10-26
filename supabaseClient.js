import { createClient } from '@supabase/supabase-js';

// Estas variables deben estar en tu archivo .env
// VITE_SUPABASE_URL=tu_url
// VITE_SUPABASE_ANON_KEY=tu_anon_key

// Usamos optional chaining (?.) para evitar errores si import.meta.env no está definido
// Y proporcionamos valores por defecto para que la app no se rompa al iniciarse si faltan las keys
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);