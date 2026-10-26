
import { createClient } from '@supabase/supabase-js';

// Intentar obtener de múltiples fuentes de entorno para máxima compatibilidad
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 
                   (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') || 
                   'https://placeholder-project.supabase.co';

const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 
                       (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || 
                       'placeholder-key';

// Verificamos si la configuración es real o placeholder
export const isConfigured = !!supabaseUrl && 
                           !!supabaseAnonKey && 
                           !supabaseUrl.includes('placeholder') &&
                           !supabaseUrl.includes('tu-proyecto');

if (!isConfigured) {
  console.warn("⚠️ Configuración de Supabase incompleta. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
