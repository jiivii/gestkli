import { ClinicalSpecialty, UserRole } from '../types';

// ============================================================
//  Catálogos clínicos de Sinestesya
//  Solo metadatos y opciones: NO se incluyen ítems de tests
//  sujetos a licencia. La corrección automática queda
//  deshabilitada salvo instrumentos autorizados con baremos.
// ============================================================

export interface BodyZone {
  id: string;
  label: string;
  view: 'anterior' | 'posterior';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Zonas corporales simplificadas para el mapa del dolor.
 * Coordenadas sobre un viewBox 200x420.
 */
export const BODY_ZONES: BodyZone[] = [
  // Vista anterior
  { id: 'cabeza', label: 'Cabeza', view: 'anterior', cx: 100, cy: 34, rx: 22, ry: 26 },
  { id: 'cuello', label: 'Cuello', view: 'anterior', cx: 100, cy: 70, rx: 14, ry: 10 },
  { id: 'hombro-izq', label: 'Hombro izquierdo', view: 'anterior', cx: 62, cy: 94, rx: 17, ry: 13 },
  { id: 'hombro-der', label: 'Hombro derecho', view: 'anterior', cx: 138, cy: 94, rx: 17, ry: 13 },
  { id: 'pecho', label: 'Pecho', view: 'anterior', cx: 100, cy: 116, rx: 30, ry: 24 },
  { id: 'abdomen', label: 'Abdomen', view: 'anterior', cx: 100, cy: 158, rx: 28, ry: 24 },
  { id: 'brazo-izq', label: 'Brazo izquierdo', view: 'anterior', cx: 48, cy: 132, rx: 10, ry: 26 },
  { id: 'brazo-der', label: 'Brazo derecho', view: 'anterior', cx: 152, cy: 132, rx: 10, ry: 26 },
  { id: 'codo-izq', label: 'Codo izquierdo', view: 'anterior', cx: 42, cy: 168, rx: 9, ry: 11 },
  { id: 'codo-der', label: 'Codo derecho', view: 'anterior', cx: 158, cy: 168, rx: 9, ry: 11 },
  { id: 'antebrazo-izq', label: 'Antebrazo izquierdo', view: 'anterior', cx: 38, cy: 202, rx: 9, ry: 26 },
  { id: 'antebrazo-der', label: 'Antebrazo derecho', view: 'anterior', cx: 162, cy: 202, rx: 9, ry: 26 },
  { id: 'mano-izq', label: 'Mano izquierda', view: 'anterior', cx: 34, cy: 240, rx: 11, ry: 14 },
  { id: 'mano-der', label: 'Mano derecha', view: 'anterior', cx: 166, cy: 240, rx: 11, ry: 14 },
  { id: 'cadera-izq', label: 'Cadera izquierda', view: 'anterior', cx: 80, cy: 200, rx: 18, ry: 15 },
  { id: 'cadera-der', label: 'Cadera derecha', view: 'anterior', cx: 120, cy: 200, rx: 18, ry: 15 },
  { id: 'muslo-izq', label: 'Muslo izquierdo', view: 'anterior', cx: 82, cy: 250, rx: 17, ry: 40 },
  { id: 'muslo-der', label: 'Muslo derecho', view: 'anterior', cx: 118, cy: 250, rx: 17, ry: 40 },
  { id: 'rodilla-izq', label: 'Rodilla izquierda', view: 'anterior', cx: 82, cy: 300, rx: 13, ry: 14 },
  { id: 'rodilla-der', label: 'Rodilla derecha', view: 'anterior', cx: 118, cy: 300, rx: 13, ry: 14 },
  { id: 'pierna-izq', label: 'Pierna izquierda', view: 'anterior', cx: 82, cy: 348, rx: 13, ry: 35 },
  { id: 'pierna-der', label: 'Pierna derecha', view: 'anterior', cx: 118, cy: 348, rx: 13, ry: 35 },
  { id: 'tobillo-izq', label: 'Tobillo izquierdo', view: 'anterior', cx: 82, cy: 390, rx: 10, ry: 10 },
  { id: 'tobillo-der', label: 'Tobillo derecho', view: 'anterior', cx: 118, cy: 390, rx: 10, ry: 10 },
  { id: 'pie-izq', label: 'Pie izquierdo', view: 'anterior', cx: 78, cy: 407, rx: 12, ry: 8 },
  { id: 'pie-der', label: 'Pie derecho', view: 'anterior', cx: 122, cy: 407, rx: 12, ry: 8 },
  // Vista posterior
  { id: 'occipital', label: 'Región occipital', view: 'posterior', cx: 100, cy: 36, rx: 21, ry: 25 },
  { id: 'cervical', label: 'Cervicales', view: 'posterior', cx: 100, cy: 70, rx: 14, ry: 11 },
  { id: 'dorsal-alta', label: 'Espalda dorsal alta', view: 'posterior', cx: 100, cy: 112, rx: 31, ry: 22 },
  { id: 'dorsal-baja', label: 'Espalda dorsal baja', view: 'posterior', cx: 100, cy: 148, rx: 28, ry: 20 },
  { id: 'lumbar', label: 'Zona lumbar', view: 'posterior', cx: 100, cy: 178, rx: 26, ry: 16 },
  { id: 'gluteo-izq', label: 'Glúteo izquierdo', view: 'posterior', cx: 80, cy: 210, rx: 19, ry: 17 },
  { id: 'gluteo-der', label: 'Glúteo derecho', view: 'posterior', cx: 120, cy: 210, rx: 19, ry: 17 },
  { id: 'post-muslo-izq', label: 'Muslo posterior izquierdo', view: 'posterior', cx: 82, cy: 258, rx: 16, ry: 36 },
  { id: 'post-muslo-der', label: 'Muslo posterior derecho', view: 'posterior', cx: 118, cy: 258, rx: 16, ry: 36 },
  { id: 'post-rodilla-izq', label: 'Hueco poplíteo izquierdo', view: 'posterior', cx: 82, cy: 302, rx: 12, ry: 13 },
  { id: 'post-rodilla-der', label: 'Hueco poplíteo derecho', view: 'posterior', cx: 118, cy: 302, rx: 12, ry: 13 },
  { id: 'gemelo-izq', label: 'Gemelo izquierdo', view: 'posterior', cx: 82, cy: 348, rx: 13, ry: 32 },
  { id: 'gemelo-der', label: 'Gemelo derecho', view: 'posterior', cx: 118, cy: 348, rx: 13, ry: 32 },
  { id: 'post-tobillo-izq', label: 'Tobillo posterior izquierdo', view: 'posterior', cx: 82, cy: 390, rx: 10, ry: 10 },
  { id: 'post-tobillo-der', label: 'Tobillo posterior derecho', view: 'posterior', cx: 118, cy: 390, rx: 10, ry: 10 },
  { id: 'talon-izq', label: 'Talón izquierdo', view: 'posterior', cx: 78, cy: 407, rx: 11, ry: 8 },
  { id: 'talon-der', label: 'Talón derecho', view: 'posterior', cx: 122, cy: 407, rx: 11, ry: 8 },
];

export const PHYSIO_TECHNIQUES = [
  'Terapia manual', 'Movilización articular', 'Manipulación', 'Masoterapia',
  'Liberación miofascial', 'Punción seca', 'Ejercicio terapéutico', 'Control motor',
  'Fortalecimiento excéntrico', 'Estiramientos', 'Reeducación postural', 'Drenaje linfático',
  'Electroterapia', 'Ultrasonido', 'TENS', 'Crioterapia', 'Termoterapia',
  'Vendaje funcional', 'Vendaje neuromuscular', 'Educación en neurociencia del dolor',
];

export const PHYSIO_EXERCISES = [
  'Movilidad cervical activa', 'Retracción cervical', 'Activación escapular',
  'Puente de glúteo', 'Sentadilla al sillón', 'Elevación de talón',
  'Estiramiento isquiotibiales', 'Estiramiento pectoral', 'Respiración diafragmática',
  'Ejercicios de estabilización lumbar', 'Péndulo de Codman', 'Reeducación del paso',
];

export const NUTRITION_MEAL_SLOTS = [
  'Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Recena',
];

export const NUTRITION_GOALS = [
  'Pérdida de grasa', 'Mantenimiento', 'Ganancia de masa muscular',
  'Mejora de composición corporal', 'Educación alimentaria',
  'Control de síntomas digestivos', 'Rendimiento deportivo', 'Salud metabólica',
];

export const NUTRITION_DIETS = [
  'Omnívora', 'Vegetariana', 'Vegana', 'Mediterránea', 'Sin gluten',
  'Sin lactosa', 'Baja en FODMAP', 'Otra',
];

export const SPEECH_AREAS = [
  { key: 'comprension', label: 'Lenguaje comprensivo' },
  { key: 'expresion', label: 'Lenguaje expresivo' },
  { key: 'vocabulario', label: 'Vocabulario' },
  { key: 'gramatica', label: 'Gramática y morfosintaxis' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'fonologia', label: 'Fonología' },
  { key: 'pragmatica', label: 'Pragmática' },
  { key: 'habla', label: 'Habla' },
  { key: 'voz', label: 'Voz' },
  { key: 'fluidez', label: 'Fluidez' },
  { key: 'lectoescritura', label: 'Lectoescritura' },
  { key: 'motricidad_orofacial', label: 'Motricidad orofacial' },
  { key: 'alimentacion', label: 'Alimentación' },
  { key: 'deglucion', label: 'Deglución' },
];

export const SPEECH_HELP_LEVELS = [
  'Autónomo', 'Verbal', 'Gestual', 'Modelado', 'Físico',
];

export const PSYCH_AREAS = [
  { key: 'ansiedad', label: 'Ansiedad' },
  { key: 'depresion', label: 'Depresión' },
  { key: 'estado_emocional', label: 'Estado emocional' },
  { key: 'conducta', label: 'Conducta' },
  { key: 'atencion', label: 'Atención' },
  { key: 'funciones_ejecutivas', label: 'Funciones ejecutivas' },
  { key: 'desarrollo_infantil', label: 'Desarrollo infantil' },
  { key: 'habilidades_cognitivas', label: 'Habilidades cognitivas' },
  { key: 'personalidad', label: 'Personalidad' },
  { key: 'funcionamiento_adaptativo', label: 'Funcionamiento adaptativo' },
];

export interface PsychTestDefinition {
  id: string;
  name: string;
  fullName: string;
  area: string;
  version: string;
  publisher: string;
  licensed: boolean;
  autoCorrection: boolean;
  normsAvailable: boolean;
  description: string;
  licenseNote: string;
}

/**
 * Banco de pruebas: metadatos para organizar aplicaciones.
 * Los ítems, baremos y claves de corrección NO se almacenan en la app.
 * Cualquier corrección automática exige autorización, licencia vigente
 * y baremos válidos; por defecto queda desactivada.
 */
export const PSYCH_TEST_BANK: PsychTestDefinition[] = [
  // Ansiedad
  { id: 'stai', name: 'STAI', fullName: 'State-Trait Anxiety Inventory', area: 'ansiedad', version: 'Revisada', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Ansiedad estado y ansiedad rasgo.', licenseNote: 'Material sujeto a licencia. Registro manual y revisión profesional.' },
  { id: 'bai', name: 'BAI', fullName: 'Beck Anxiety Inventory', area: 'ansiedad', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Sintomatología ansiosa autoinformada.', licenseNote: 'No se incluyen ítems ni claves. Requiere ejemplar autorizado.' },
  { id: 'pswq', name: 'PSWQ', fullName: 'Penn State Worry Questionnaire', area: 'ansiedad', version: 'Original', publisher: 'Uso clínico/investigador', licensed: false, autoCorrection: false, normsAvailable: false, description: 'Tendencia a la preocupación excesiva.', licenseNote: 'Puntuación manual; no se incluyen ítems.' },
  // Depresión
  { id: 'bdi2', name: 'BDI-II', fullName: 'Beck Depression Inventory-II', area: 'depresion', version: 'II', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Gravedad de sintomatología depresiva.', licenseNote: 'Material licenciado. Solo registro de resultados.' },
  { id: 'phq9', name: 'PHQ-9', fullName: 'Patient Health Questionnaire-9', area: 'depresion', version: 'Española', publisher: 'Uso libre clínico', licensed: false, autoCorrection: false, normsAvailable: false, description: 'Cribado y seguimiento de sintomatología depresiva.', licenseNote: 'Se registra resultado; revisar condiciones de uso vigentes.' },
  // Estado emocional
  { id: 'panas', name: 'PANAS', fullName: 'Positive and Negative Affect Schedule', area: 'estado_emocional', version: 'Española', publisher: 'Uso clínico/investigador', licensed: false, autoCorrection: false, normsAvailable: false, description: 'Afecto positivo y negativo.', licenseNote: 'Sin ítems en la aplicación. Puntuación manual.' },
  { id: 'dass21', name: 'DASS-21', fullName: 'Depression Anxiety Stress Scales', area: 'estado_emocional', version: '21 ítems', publisher: 'Uso clínico/investigador', licensed: false, autoCorrection: false, normsAvailable: false, description: 'Depresión, ansiedad y estrés.', licenseNote: 'Registro de puntuaciones; validar baremos aplicables.' },
  // Conducta
  { id: 'cbcl', name: 'CBCL', fullName: 'Child Behavior Checklist', area: 'conducta', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Conducta infantil desde informantes.', licenseNote: 'Requiere licencia y formación. Sin ítems en la app.' },
  { id: 'basc', name: 'BASC', fullName: 'Behavior Assessment System for Children', area: 'conducta', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Conducta adaptativa y clínica.', licenseNote: 'Material licenciado. Resultados manuales.' },
  // Atención
  { id: 'd2', name: 'd2-R', fullName: 'Test de atención d2-R', area: 'atencion', version: 'R', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Atención selectiva y concentración.', licenseNote: 'Requiere ejemplar y baremos oficiales.' },
  { id: 'cpt', name: 'CPT', fullName: 'Continuous Performance Test', area: 'atencion', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Atención sostenida e impulsividad.', licenseNote: 'Registro de resultados; sin estímulos ni claves.' },
  // Funciones ejecutivas
  { id: 'bri', name: 'BRIEF', fullName: 'Behavior Rating Inventory of Executive Function', area: 'funciones_ejecutivas', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Funciones ejecutivas en contexto cotidiano.', licenseNote: 'Material licenciado. No se reproducen ítems.' },
  { id: 'wiscons', name: 'WCST', fullName: 'Wisconsin Card Sorting Test', area: 'funciones_ejecutivas', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Flexibilidad cognitiva y categorización.', licenseNote: 'Requiere material oficial y corrección profesional.' },
  // Desarrollo infantil
  { id: 'bayley', name: 'Bayley', fullName: 'Bayley Scales of Infant Development', area: 'desarrollo_infantil', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Desarrollo cognitivo, motor y socioemocional.', licenseNote: 'Material licenciado y formación específica.' },
  { id: 'batelle', name: 'Battelle', fullName: 'Battelle Developmental Inventory', area: 'desarrollo_infantil', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Desarrollo infantil por dominios.', licenseNote: 'No se incluyen ítems ni baremos.' },
  // Habilidades cognitivas
  { id: 'wisc', name: 'WISC', fullName: 'Wechsler Intelligence Scale for Children', area: 'habilidades_cognitivas', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Capacidad intelectual infantil.', licenseNote: 'Requiere licencia, material oficial y profesional cualificado.' },
  { id: 'wais', name: 'WAIS', fullName: 'Wechsler Adult Intelligence Scale', area: 'habilidades_cognitivas', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Capacidad intelectual adulta.', licenseNote: 'Prohibida la reproducción no autorizada.' },
  { id: 'moca', name: 'MoCA', fullName: 'Montreal Cognitive Assessment', area: 'habilidades_cognitivas', version: 'Actual', publisher: 'Uso clínico con condiciones', licensed: false, autoCorrection: false, normsAvailable: false, description: 'Cribado cognitivo breve.', licenseNote: 'Revisar condiciones de uso y formación; sin ítems en la app.' },
  // Personalidad
  { id: 'mmpi', name: 'MMPI', fullName: 'Minnesota Multiphasic Personality Inventory', area: 'personalidad', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Perfil de personalidad y psicopatología.', licenseNote: 'Material licenciado. Registro de resultados únicamente.' },
  { id: 'neo', name: 'NEO-PI', fullName: 'NEO Personality Inventory', area: 'personalidad', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Cinco grandes factores de personalidad.', licenseNote: 'Requiere licencia y corrección autorizada.' },
  // Funcionamiento adaptativo
  { id: 'vineland', name: 'Vineland', fullName: 'Vineland Adaptive Behavior Scales', area: 'funcionamiento_adaptativo', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Conducta adaptativa y autonomía.', licenseNote: 'Material licenciado. Sin ítems ni baremos en la app.' },
  { id: 'abasi', name: 'ABAS', fullName: 'Adaptive Behavior Assessment System', area: 'funcionamiento_adaptativo', version: 'Actual', publisher: 'Licencia editorial', licensed: true, autoCorrection: false, normsAvailable: false, description: 'Habilidades adaptativas por áreas.', licenseNote: 'Requiere ejemplar oficial y revisión profesional.' },
];

export const PSYCH_TECHNIQUES = [
  'Psicoeducación', 'Reestructuración cognitiva', 'Activación conductual',
  'Exposición gradual', 'Prevención de respuesta', 'Entrenamiento en relajación',
  'Mindfulness', 'Aceptación y compromiso', 'Entrevista motivacional',
  'Entrenamiento en habilidades sociales', 'Resolución de problemas',
  'Regulación emocional', 'Terapia de pareja', 'Terapia familiar',
];

export const PSYCH_RISK_LEVELS = [
  { value: 'sin_riesgo', label: 'Sin indicadores de riesgo' },
  { value: 'bajo', label: 'Riesgo bajo' },
  { value: 'moderado', label: 'Riesgo moderado' },
  { value: 'alto', label: 'Riesgo alto' },
  { value: 'inminente', label: 'Riesgo inminente / protocolo urgente' },
];

export const REPORT_TITLES: Record<ClinicalSpecialty, { valoracion: string; seguimiento: string; alta: string }> = {
  [UserRole.FISIOTERAPIA]: {
    valoracion: 'Informe de valoración fisioterapéutica',
    seguimiento: 'Informe de seguimiento fisioterapéutico',
    alta: 'Informe de alta fisioterapéutica',
  },
  [UserRole.NUTRICION]: {
    valoracion: 'Informe de valoración nutricional',
    seguimiento: 'Informe de evolución nutricional',
    alta: 'Informe de alta nutricional',
  },
  [UserRole.LOGOPEDIA]: {
    valoracion: 'Informe de valoración logopédica',
    seguimiento: 'Informe de seguimiento logopédico',
    alta: 'Informe de alta logopédica',
  },
  [UserRole.PSICOLOGIA]: {
    valoracion: 'Informe de valoración psicológica',
    seguimiento: 'Informe de evolución psicológica',
    alta: 'Informe de alta psicológica',
  },
};
