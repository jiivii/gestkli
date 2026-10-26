import {
  Appointment, AppointmentStatus, AuditEntry, CashClosing, CenterSettings, ChatMessage, ChatRoom,
  ClinicalRecord, ConsentRecord, Expense, Invoice, MedicalHistoryEntry, Patient, Payment,
  ReservationRequest, Service, SessionPackage, User, UserRole, Notification,
} from '../types';
import { CLINICAL_SPECIALTIES } from '../constants';

// ============================================================
//  Almacén local de DEMOSTRACIÓN
//  Se utiliza únicamente cuando no hay Supabase configurado o
//  cuando VITE_DEMO_MODE=true. Todos los registros van marcados
//  como demo y la interfaz muestra un aviso permanente.
// ============================================================

export const DEMO_STORAGE_KEY = 'sinestesya_demo_v1';
export const DEMO_SESSION_KEY = 'sinestesya_demo_session';

export interface DemoAssignment {
  id: string;
  patientId: string;
  professionalId: string;
  specialty: string;
  active: boolean;
  createdAt: string;
}

export interface DemoState {
  users: User[];
  patients: Patient[];
  assignments: DemoAssignment[];
  appointments: Appointment[];
  clinicalRecords: ClinicalRecord[];
  medicalHistory: MedicalHistoryEntry[];
  services: Service[];
  rooms: { id: string; name: string; specialty: string; active: boolean }[];
  payments: Payment[];
  invoices: Invoice[];
  expenses: Expense[];
  packages: SessionPackage[];
  cashClosings: CashClosing[];
  consents: ConsentRecord[];
  audit: AuditEntry[];
  reservations: ReservationRequest[];
  notifications: Notification[];
  settings: CenterSettings;
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha ISO local con desplazamiento de días. */
const dateAt = (dayOffset: number, hour = 10, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const dateOnly = (dayOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const now = new Date().toISOString();
const currentYear = new Date().getFullYear();

const demoUser = (
  id: string, name: string, email: string, role: UserRole,
  permissions: User['permissions'] = []
): User => ({
  id,
  name,
  email,
  role,
  profession: role === UserRole.ADMIN ? null : (role as any),
  permissions,
  active: true,
  sourceRole: role === UserRole.ADMIN ? 'admin' : 'medico',
  demo: true,
});

const USERS: User[] = [
  demoUser('u-admin', 'Laura Méndez', 'admin@sinestesya.es', UserRole.ADMIN),
  demoUser('u-psi', 'Daniel Ferrer', 'psicologia@sinestesya.es', UserRole.PSICOLOGIA),
  demoUser('u-fisio', 'Marta Soler', 'fisioterapia@sinestesya.es', UserRole.FISIOTERAPIA),
  demoUser('u-logo', 'Irene Navarro', 'logopedia@sinestesya.es', UserRole.LOGOPEDIA),
  demoUser('u-nutri', 'Clara Vidal', 'nutricion@sinestesya.es', UserRole.NUTRICION),
];

const PATIENTS: Patient[] = [
  {
    id: 'p-elena', dni: '48217563M', firstName: 'Elena', lastName: 'Ruiz García',
    birthDate: '1992-03-14', sex: 'mujer', phone: '612 345 678',
    email: 'elena.ruiz@example.com', address: 'C/ Pintor Sorolla 18, Valencia',
    createdAt: dateAt(-120), privacyPolicySigned: true, status: 'activo',
    alerts: ['Seguimiento conjunto Psicología + Nutrición'],
    allergies: ['Frutos secos'], legalGuardian: null,
    assignedSpecialties: [UserRole.PSICOLOGIA, UserRole.NUTRICION], demo: true,
  },
  {
    id: 'p-pau', dni: 'X4821991L', firstName: 'Pau', lastName: 'Martín Costa',
    birthDate: '2018-06-02', sex: 'hombre', phone: '677 881 220',
    email: 'familia.martin@example.com', address: 'Av. Blasco Ibáñez 72, Valencia',
    createdAt: dateAt(-95), privacyPolicySigned: true, status: 'activo',
    alerts: ['Menor de edad · representación legal de Marta Costa'],
    allergies: [], legalGuardian: {
      name: 'Marta Costa Ferrer', dni: '44889112P', phone: '677 881 220',
      email: 'familia.martin@example.com', relationship: 'Madre',
    },
    assignedSpecialties: [UserRole.LOGOPEDIA, UserRole.PSICOLOGIA], demo: true,
  },
  {
    id: 'p-carla', dni: '52338841D', firstName: 'Carla', lastName: 'Domínguez León',
    birthDate: '1984-11-27', sex: 'mujer', phone: '655 120 344',
    email: 'carla.dominguez@example.com', address: 'C/ Sagunto 44, Valencia',
    createdAt: dateAt(-80), privacyPolicySigned: true, status: 'activo',
    alerts: [], allergies: ['Penicilina'], legalGuardian: null,
    assignedSpecialties: [UserRole.FISIOTERAPIA], demo: true,
  },
  {
    id: 'p-javier', dni: '38991220B', firstName: 'Javier', lastName: 'Ortega Molina',
    birthDate: '1973-01-09', sex: 'hombre', phone: '699 430 218',
    email: 'javier.ortega@example.com', address: 'C/ Colón 9, Valencia',
    createdAt: dateAt(-70), privacyPolicySigned: true, status: 'activo',
    alerts: ['Trabajo físico · valorar carga lumbar'], allergies: [], legalGuardian: null,
    assignedSpecialties: [UserRole.FISIOTERAPIA], demo: true,
  },
  {
    id: 'p-hugo', dni: 'X6122443R', firstName: 'Hugo', lastName: 'López Serrano',
    birthDate: '2015-09-21', sex: 'hombre', phone: '688 002 119',
    email: 'familia.lopez@example.com', address: 'C/ Sueca 31, Valencia',
    createdAt: dateAt(-45), privacyPolicySigned: false, status: 'activo',
    alerts: ['Menor de edad · falta consentimiento de representante legal'],
    allergies: ['Lactosa'], legalGuardian: {
      name: 'Ana Serrano Gil', dni: '44556677J', phone: '688 002 119',
      email: 'familia.lopez@example.com', relationship: 'Madre',
    },
    assignedSpecialties: [UserRole.NUTRICION], demo: true,
  },
  {
    id: 'p-marta', dni: '48771220K', firstName: 'Marta', lastName: 'Gil Torres',
    birthDate: '1997-07-30', sex: 'mujer', phone: '633 541 990',
    email: 'marta.gil@example.com', address: 'C/ Cuba 12, Valencia',
    createdAt: dateAt(-25), privacyPolicySigned: true, status: 'activo',
    alerts: [], allergies: [], legalGuardian: null,
    assignedSpecialties: [UserRole.PSICOLOGIA], demo: true,
  },
];

const ASSIGNMENTS = PATIENTS.flatMap(p => {
  const map: Record<string, string> = {
    [UserRole.PSICOLOGIA]: 'u-psi', [UserRole.FISIOTERAPIA]: 'u-fisio',
    [UserRole.LOGOPEDIA]: 'u-logo', [UserRole.NUTRICION]: 'u-nutri',
  };
  return (p.assignedSpecialties || []).map((specialty, i) => ({
    id: `asg-${p.id}-${i}`,
    patientId: p.id,
    professionalId: map[specialty] || '',
    specialty,
    active: true,
    createdAt: dateAt(-20),
  }));
});

const SERVICES: Service[] = [
  { id: 's-fisio-val', name: 'Valoración fisioterapéutica', specialty: UserRole.FISIOTERAPIA, durationMinutes: 60, price: 60, taxRate: 0, room: 'Sala 1', active: true, description: 'Valoración inicial y plan de tratamiento.', demo: true },
  { id: 's-fisio-ses', name: 'Sesión de fisioterapia', specialty: UserRole.FISIOTERAPIA, durationMinutes: 45, price: 45, taxRate: 0, room: 'Sala 1', active: true, description: 'Sesión de tratamiento individual.', demo: true },
  { id: 's-psi-val', name: 'Valoración psicológica', specialty: UserRole.PSICOLOGIA, durationMinutes: 60, price: 70, taxRate: 0, room: 'Sala 3', active: true, description: 'Entrevista inicial y formulación clínica.', demo: true },
  { id: 's-psi-ses', name: 'Sesión de psicología', specialty: UserRole.PSICOLOGIA, durationMinutes: 50, price: 60, taxRate: 0, room: 'Sala 3', active: true, description: 'Sesión de intervención individual.', demo: true },
  { id: 's-logo-val', name: 'Valoración logopédica', specialty: UserRole.LOGOPEDIA, durationMinutes: 60, price: 60, taxRate: 0, room: 'Sala 2', active: true, description: 'Evaluación inicial del lenguaje y la comunicación.', demo: true },
  { id: 's-logo-ses', name: 'Sesión de logopedia', specialty: UserRole.LOGOPEDIA, durationMinutes: 45, price: 45, taxRate: 0, room: 'Sala 2', active: true, description: 'Intervención individual por objetivos.', demo: true },
  { id: 's-nutri-val', name: 'Valoración nutricional', specialty: UserRole.NUTRICION, durationMinutes: 60, price: 65, taxRate: 0, room: 'Sala 4', active: true, description: 'Historia dietética y antropometría inicial.', demo: true },
  { id: 's-nutri-ses', name: 'Seguimiento nutricional', specialty: UserRole.NUTRICION, durationMinutes: 45, price: 50, taxRate: 0, room: 'Sala 4', active: true, description: 'Revisión de evolución y ajuste del plan.', demo: true },
];

const APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1', patientId: 'p-elena', professionalId: 'u-psi', date: dateAt(0, 9, 0),
    status: AppointmentStatus.COMPLETED, reason: 'Seguimiento de ansiedad',
    specialty: UserRole.PSICOLOGIA, serviceId: 's-psi-ses', room: 'Sala 3', durationMinutes: 50,
    clinicalRecorded: true, invoiceId: 'inv-1', createdBy: 'u-admin', createdAt: dateAt(-7), demo: true,
  },
  {
    id: 'apt-2', patientId: 'p-carla', professionalId: 'u-fisio', date: dateAt(0, 10, 0),
    status: AppointmentStatus.COMPLETED, reason: 'Lumbalgia mecánica · sesión 3',
    specialty: UserRole.FISIOTERAPIA, serviceId: 's-fisio-ses', room: 'Sala 1', durationMinutes: 45,
    clinicalRecorded: true, invoiceId: null, createdBy: 'u-admin', createdAt: dateAt(-14), demo: true,
  },
  {
    id: 'apt-3', patientId: 'p-elena', professionalId: 'u-nutri', date: dateAt(0, 11, 30),
    status: AppointmentStatus.CONFIRMED, reason: 'Revisión de plan y adherencia',
    specialty: UserRole.NUTRICION, serviceId: 's-nutri-ses', room: 'Sala 4', durationMinutes: 45,
    clinicalRecorded: false, createdBy: 'u-admin', createdAt: dateAt(-10), demo: true,
  },
  {
    id: 'apt-4', patientId: 'p-pau', professionalId: 'u-logo', date: dateAt(0, 12, 30),
    status: AppointmentStatus.CONFIRMED, reason: 'Intervención lenguaje expresivo',
    specialty: UserRole.LOGOPEDIA, serviceId: 's-logo-ses', room: 'Sala 2', durationMinutes: 45,
    clinicalRecorded: false, createdBy: 'u-admin', createdAt: dateAt(-8), demo: true,
  },
  {
    id: 'apt-5', patientId: 'p-javier', professionalId: 'u-fisio', date: dateAt(0, 17, 0),
    status: AppointmentStatus.PENDING, reason: 'Valoración cervical',
    specialty: UserRole.FISIOTERAPIA, serviceId: 's-fisio-val', room: 'Sala 1', durationMinutes: 60,
    clinicalRecorded: false, createdBy: 'u-admin', createdAt: dateAt(-2), demo: true,
  },
  {
    id: 'apt-6', patientId: 'p-marta', professionalId: 'u-psi', date: dateAt(1, 10, 0),
    status: AppointmentStatus.CONFIRMED, reason: 'Seguimiento',
    specialty: UserRole.PSICOLOGIA, serviceId: 's-psi-ses', room: 'Sala 3', durationMinutes: 50,
    clinicalRecorded: false, createdBy: 'u-psi', createdAt: dateAt(-3), demo: true,
  },
  {
    id: 'apt-7', patientId: 'p-hugo', professionalId: 'u-nutri', date: dateAt(1, 12, 0),
    status: AppointmentStatus.PENDING, reason: 'Primera revisión',
    specialty: UserRole.NUTRICION, serviceId: 's-nutri-ses', room: 'Sala 4', durationMinutes: 45,
    clinicalRecorded: false, createdBy: 'u-admin', createdAt: dateAt(-1), demo: true,
  },
  {
    id: 'apt-8', patientId: 'p-pau', professionalId: 'u-logo', date: dateAt(2, 16, 30),
    status: AppointmentStatus.PENDING, reason: 'Sesión de articulación',
    specialty: UserRole.LOGOPEDIA, serviceId: 's-logo-ses', room: 'Sala 2', durationMinutes: 45,
    clinicalRecorded: false, createdBy: 'u-admin', createdAt: dateAt(-1), demo: true,
  },
  {
    id: 'apt-9', patientId: 'p-javier', professionalId: 'u-fisio', date: dateAt(-7, 18, 0),
    status: AppointmentStatus.COMPLETED, reason: 'Tratamiento cervical',
    specialty: UserRole.FISIOTERAPIA, serviceId: 's-fisio-ses', room: 'Sala 1', durationMinutes: 45,
    clinicalRecorded: true, invoiceId: 'inv-2', createdBy: 'u-admin', createdAt: dateAt(-10), demo: true,
  },
  {
    id: 'apt-10', patientId: 'p-pau', professionalId: 'u-psi', date: dateAt(-5, 17, 0),
    status: AppointmentStatus.COMPLETED, reason: 'Seguimiento emocional',
    specialty: UserRole.PSICOLOGIA, serviceId: 's-psi-ses', room: 'Sala 3', durationMinutes: 50,
    clinicalRecorded: false, invoiceId: null, createdBy: 'u-admin', createdAt: dateAt(-6), demo: true,
  },
];

let objectiveSeq = 0;
const baseObjectives = (items: { description: string; area?: string; target?: string; progress?: number }[]) =>
  items.map((o) => ({
    id: `obj-${++objectiveSeq}`, description: o.description, area: o.area, target: o.target,
    progress: o.progress ?? 20, status: (o.progress ?? 20) >= 100 ? 'conseguido' as const : 'activo' as const,
  }));

const CLINICAL_RECORDS: ClinicalRecord[] = [
  {
    id: 'cr-fisio-1', patientId: 'p-carla', professionalId: 'u-fisio', professionalName: 'Marta Soler',
    specialty: UserRole.FISIOTERAPIA, recordType: 'valoracion', date: dateAt(-14, 10, 0),
    status: 'firmado', summary: 'Lumbalgia mecánica tras esfuerzo. Buena tolerancia al tratamiento.',
    objectives: baseObjectives([
      { description: 'Reducir dolor lumbar de 7/10 a ≤3/10 en 4 semanas', area: 'Dolor', target: 'EVA ≤ 3', progress: 60 },
      { description: 'Recuperar movilidad lumbar completa', area: 'Movilidad', target: 'Flexión 60 cm', progress: 40 },
    ]),
    data: {
      motivo: 'Dolor lumbar tras levantar peso en el trabajo.',
      antecedentes: 'Episodio previo hace 2 años. Sin cirugías. Trabajo con carga física.',
      eva: 7, painZones: ['lumbar', 'gluteo-izq'], painLocation: 'Lumbar izquierda con irradiación glútea',
      mobility: 'Flexión lumbar limitada y dolorosa en el último tercio.', strength: 'Paravertebrales 4/5, glúteo medio 3+/5.',
      sensitivity: 'Conservada.', posture: 'Anteversión pélvica leve.', functionalTests: 'Lasègue negativo. Test de Schober 4 cm.',
      diagnosis: 'Lumbalgia mecánica subaguda.', techniques: ['Terapia manual', 'Ejercicio terapéutico', 'Educación en neurociencia del dolor'],
      exercises: ['Puente de glúteo', 'Estiramiento isquiotibiales'],
      recommendations: 'Evitar cargas >8 kg durante 7 días. Caminar 20 min diarios.',
      incidents: 'Sin incidencias.',
    },
    version: 1, createdAt: dateAt(-14, 11, 0), updatedAt: dateAt(-14, 11, 0), demo: true,
  },
  {
    id: 'cr-fisio-2', patientId: 'p-carla', professionalId: 'u-fisio', professionalName: 'Marta Soler',
    specialty: UserRole.FISIOTERAPIA, recordType: 'sesion', date: dateAt(-7, 10, 0),
    status: 'firmado', summary: 'Mejoría del dolor. Progresión de ejercicio.',
    objectives: baseObjectives([
      { description: 'Reducir dolor lumbar de 7/10 a ≤3/10 en 4 semanas', area: 'Dolor', target: 'EVA ≤ 3', progress: 80 },
      { description: 'Recuperar movilidad lumbar completa', area: 'Movilidad', target: 'Flexión 60 cm', progress: 60 },
    ]),
    data: {
      motivo: 'Revisión semanal.', antecedentes: 'Sin cambios.', eva: 5,
      painZones: ['lumbar'], painLocation: 'Lumbar central.', mobility: 'Mejoría de flexión, dolor al final del rango.',
      strength: 'Glúteo medio 4/5.', sensitivity: 'Conservada.', posture: 'Control pélvico en mejoría.',
      functionalTests: 'Schober 5,5 cm.', diagnosis: 'Lumbalgia mecánica en mejoría.',
      techniques: ['Terapia manual', 'Ejercicio terapéutico'],
      exercises: ['Puente de glúteo', 'Sentadilla al sillón', 'Respiración diafragmática'],
      recommendations: 'Mantener paseos y ejercicios 2 veces al día.', incidents: 'Sin incidencias.',
    },
    version: 1, createdAt: dateAt(-7, 11, 0), updatedAt: dateAt(-7, 11, 0), demo: true,
  },
  {
    id: 'cr-fisio-3', patientId: 'p-carla', professionalId: 'u-fisio', professionalName: 'Marta Soler',
    specialty: UserRole.FISIOTERAPIA, recordType: 'sesion', date: dateAt(0, 10, 30),
    status: 'completado', summary: 'Dolor 3/10. Inicio de control motor avanzado.',
    objectives: baseObjectives([
      { description: 'Reducir dolor lumbar de 7/10 a ≤3/10 en 4 semanas', area: 'Dolor', target: 'EVA ≤ 3', progress: 95 },
      { description: 'Recuperar movilidad lumbar completa', area: 'Movilidad', target: 'Flexión 60 cm', progress: 75 },
    ]),
    data: {
      motivo: 'Sesión 3.', antecedentes: 'Sin cambios.', eva: 3, painZones: ['lumbar'],
      painLocation: 'Molestia lumbar leve al final del día.', mobility: 'Flexión casi completa.',
      strength: 'Glúteo medio 4+/5.', sensitivity: 'Conservada.', posture: 'Buena disociación lumbopélvica.',
      functionalTests: 'Schober 6 cm.', diagnosis: 'Lumbalgia mecánica en resolución.',
      techniques: ['Ejercicio terapéutico', 'Control motor'],
      exercises: ['Peso muerto con mancuerna ligera', 'Estiramiento pectoral'],
      recommendations: 'Progresar carga de forma gradual.', incidents: 'Sin incidencias.',
    },
    version: 1, createdAt: dateAt(0, 11, 0), updatedAt: dateAt(0, 11, 0), demo: true,
  },
  {
    id: 'cr-fisio-4', patientId: 'p-javier', professionalId: 'u-fisio', professionalName: 'Marta Soler',
    specialty: UserRole.FISIOTERAPIA, recordType: 'valoracion', date: dateAt(-10, 18, 30),
    status: 'firmado', summary: 'Cervicalgia con componente tensional.',
    objectives: baseObjectives([
      { description: 'Disminuir cefalea tensional y dolor cervical', area: 'Dolor', target: 'EVA ≤ 2', progress: 50 },
    ]),
    data: {
      motivo: 'Dolor cervical y cefalea tensional de 3 semanas de evolución.',
      antecedentes: 'Trabajo de oficina. Bruxismo nocturno.', eva: 8,
      painZones: ['cervical', 'occipital', 'hombro-der'],
      painLocation: 'Cervical posterior y occipital derecho.',
      mobility: 'Rotación cervical derecha limitada a 50°.', strength: 'Flexores profundos 3/5.',
      sensitivity: 'Conservada.', posture: 'Proyección anterior de cabeza.',
      functionalTests: 'Test de flexión craneocervical 18 s.',
      diagnosis: 'Cervicalgia tensional con disfunción craneocervical.',
      techniques: ['Terapia manual', 'Liberación miofascial', 'Ejercicio terapéutico'],
      exercises: ['Retracción cervical', 'Activación escapular'],
      recommendations: 'Pausas activas cada 45 minutos. Revisar altura de pantalla.', incidents: 'Sin incidencias.',
    },
    version: 1, createdAt: dateAt(-10, 19, 0), updatedAt: dateAt(-10, 19, 0), demo: true,
  },
  // NUTRICIÓN
  {
    id: 'cr-nutri-1', patientId: 'p-elena', professionalId: 'u-nutri', professionalName: 'Clara Vidal',
    specialty: UserRole.NUTRICION, recordType: 'valoracion', date: dateAt(-30, 11, 0),
    status: 'firmado', summary: 'Valoración inicial. Objetivo: mejora de composición corporal y educación alimentaria.',
    objectives: baseObjectives([
      { description: 'Alcanzar 70 kg manteniendo masa muscular', area: 'Composición corporal', target: '70 kg', progress: 35 },
      { description: 'Mejorar adherencia a pauta mediterránea', area: 'Hábitos', target: '≥80%', progress: 50 },
    ]),
    data: {
      motivo: 'Desea mejorar composición corporal y ordenar horarios de comida.',
      antecedentes: 'Sin patologías digestivas diagnosticadas. Alergia a frutos secos.',
      allergies: 'Frutos secos', intolerances: 'Ninguna conocida',
      dietaryHistory: 'Dieta omnívora, comidas fuera de casa 3 días/semana.',
      habits: 'Desayuno escaso, cena tardía.', mealSchedule: 'Desayuno 7:30 · Comida 14:30 · Cena 22:00',
      preferences: 'Verduras, pescado, legumbres. Rechaza hígado.',
      physicalActivity: 'Caminata 3 días/semana, fuerza 1 día.',
      hydration: '1,2 L/día', goal: 'Pérdida de grasa',
      weight: 74.2, height: 165, bmi: 27.3, waist: 84, hip: 101, arm: 29, thigh: 58,
      skinfolds: { triceps: 24, subescapular: 22, suprailiaco: 26, abdominal: 28 },
      bodyFat: 31.4, muscleMass: 26.5, pediatric: false,
      planVersion: 1,
      plan: {
        meals: [
          { slot: 'Desayuno', foods: 'Avena, yogur natural, fruta', quantities: '40 g + 125 g + 1 pieza', alternatives: 'Pan integral + huevo', recipe: '' },
          { slot: 'Comida', foods: 'Legumbre, verdura, aceite de oliva', quantities: '1 plato + 1 cucharada', alternatives: 'Arroz integral + pollo', recipe: '' },
          { slot: 'Cena', foods: 'Pescado, verdura, patata', quantities: '150 g + 1 plato + 120 g', alternatives: 'Tortilla + ensalada', recipe: '' },
        ],
        recommendations: 'Priorizar alimentos frescos y evitar frutos secos. No saltar desayuno.',
      },
      adherence: 'Alta', difficulties: 'Cenas fuera de casa los fines de semana.',
      symptoms: 'Sin síntomas digestivos relevantes.',
    },
    version: 1, createdAt: dateAt(-30, 12, 0), updatedAt: dateAt(-30, 12, 0), demo: true,
  },
  {
    id: 'cr-nutri-2', patientId: 'p-elena', professionalId: 'u-nutri', professionalName: 'Clara Vidal',
    specialty: UserRole.NUTRICION, recordType: 'sesion', date: dateAt(-2, 11, 0),
    status: 'firmado', summary: 'Buena adherencia. Ajuste de cantidades y plan versión 2.',
    objectives: baseObjectives([
      { description: 'Alcanzar 70 kg manteniendo masa muscular', area: 'Composición corporal', target: '70 kg', progress: 65 },
      { description: 'Mejorar adherencia a pauta mediterránea', area: 'Hábitos', target: '≥80%', progress: 80 },
    ]),
    data: {
      motivo: 'Revisión mensual.', antecedentes: 'Sin cambios.', allergies: 'Frutos secos', intolerances: 'Ninguna conocida',
      dietaryHistory: 'Dieta omnívora.', habits: 'Desayuno más completo. Cenas antes de las 21:30.',
      mealSchedule: 'Desayuno 7:30 · Comida 14:00 · Cena 21:15', preferences: 'Igual.',
      physicalActivity: 'Fuerza 2 días/semana, caminata diaria.', hydration: '1,6 L/día',
      goal: 'Pérdida de grasa', weight: 72.8, height: 165, bmi: 26.7, waist: 82, hip: 99, arm: 29, thigh: 57,
      skinfolds: { triceps: 22, subescapular: 20, suprailiaco: 24, abdominal: 25 },
      bodyFat: 30.1, muscleMass: 27.0, pediatric: false,
      planVersion: 2,
      plan: {
        meals: [
          { slot: 'Desayuno', foods: 'Avena, yogur griego, fruta', quantities: '45 g + 150 g + 1 pieza', alternatives: 'Tostada integral + huevo', recipe: '' },
          { slot: 'Media mañana', foods: 'Fruta + infusion', quantities: '1 pieza', alternatives: 'Zanahoria', recipe: '' },
          { slot: 'Comida', foods: 'Proteína, verdura, cereal integral', quantities: '150 g + 1 plato + 60 g', alternatives: 'Legumbre + verdura', recipe: '' },
          { slot: 'Cena', foods: 'Pescado blanco, verdura, patata', quantities: '160 g + 1 plato + 150 g', alternatives: 'Tortilla + ensalada', recipe: '' },
        ],
        recommendations: 'Mantener el registro de comidas 3 días/semana. Evitar picoteo nocturno.',
      },
      adherence: 'Alta', difficulties: 'Eventos sociales.', symptoms: 'Sin síntomas.',
    },
    version: 2, createdAt: dateAt(-2, 12, 0), updatedAt: dateAt(-2, 12, 0), demo: true,
  },
  {
    id: 'cr-nutri-3', patientId: 'p-hugo', professionalId: 'u-nutri', professionalName: 'Clara Vidal',
    specialty: UserRole.NUTRICION, recordType: 'valoracion', date: dateAt(-20, 17, 0),
    status: 'borrador', summary: 'Valoración infantil. Pendiente de consentimiento de representante legal.',
    objectives: baseObjectives([
      { description: 'Mejorar variedad de desayunos y meriendas', area: 'Hábitos', target: '5 días/semana', progress: 25 },
    ]),
    data: {
      motivo: 'Asesoramiento familiar para mejorar hábitos y variedad alimentaria.',
      antecedentes: 'Intolerancia a la lactosa. Sin patologías relevantes.',
      allergies: 'Lactosa', intolerances: 'Lactosa',
      dietaryHistory: 'Dieta omnívora, rechazo a verduras.', habits: 'Desayuno escaso, picoteo entre horas.',
      mealSchedule: 'Desayuno 8:00 · Comida 14:30 · Merienda 17:30 · Cena 21:00',
      preferences: 'Pasta, arroz, pollo. Rechaza brócoli y pescado azul.',
      physicalActivity: 'Fútbol 2 días/semana.', hydration: '1 L/día',
      goal: 'Educación alimentaria', weight: 48.5, height: 148, bmi: 22.1, waist: 68, hip: 76, arm: 24, thigh: 44,
      skinfolds: { triceps: 18, subescapular: 16, suprailiaco: 20, abdominal: 22 },
      bodyFat: 25.5, muscleMass: 20.4, pediatric: true,
      growthReference: 'Referencias OMS 5-19 años', growthPercentile: 'IMC percentil 88',
      planVersion: 1,
      plan: {
        meals: [
          { slot: 'Desayuno', foods: 'Leche sin lactosa, pan integral, fruta', quantities: '200 ml + 40 g + 1 pieza', alternatives: 'Bebida vegetal + cereales', recipe: '' },
        ],
        recommendations: 'Introducir verduras de forma gradual sin forzar. Implicar al menor en la compra y preparación.',
      },
      adherence: 'Media', difficulties: 'Rechazo de verduras y pescado.', symptoms: 'Molestias abdominales ocasionales.',
      familyContext: 'Familia monoparental, horarios variables.',
    },
    version: 1, createdAt: dateAt(-20, 18, 0), updatedAt: dateAt(-20, 18, 0), demo: true,
  },
  // LOGOPEDIA
  {
    id: 'cr-logo-1', patientId: 'p-pau', professionalId: 'u-logo', professionalName: 'Irene Navarro',
    specialty: UserRole.LOGOPEDIA, recordType: 'valoracion', date: dateAt(-21, 16, 0),
    status: 'firmado', summary: 'Retraso del lenguaje expresivo con dificultades fonológicas. Entorno bilingüe.',
    objectives: baseObjectives([
      { description: 'Ampliar vocabulario comprensivo y expresivo a 300 palabras', area: 'Vocabulario', target: '300 palabras', progress: 55 },
      { description: 'Producir correctamente /r/ en sílaba directa', area: 'Articulación', target: '80%', progress: 30 },
      { description: 'Mejorar estructura de frase de 3 elementos', area: 'Gramática', target: '5/6 ensayos', progress: 45 },
    ]),
    data: {
      patientType: 'infantil', motivo: 'Dificultades para expresarse y comprensión de órdenes complejas.',
      antecedentes: 'Desarrollo motor normal. Primeras palabras a los 22 meses. Entorno bilingüe español/valenciano.',
      familyContext: 'Padres y hermana de 5 años. Buena estimulación en casa.',
      schoolContext: '2º de Infantil. La tutora refiere dificultad para seguir cuentos y expresar necesidades.',
      comprehension: 'Comprende órdenes de 2 elementos; dificultad con 3.', expression: 'Frases de 2-3 palabras, omisiones de artículos.',
      vocabulary: 'Vocabulario expresivo inferior a lo esperado para 6 años.', grammar: 'Errores en morfología verbal y plurales.',
      articulation: 'Dislalia de /r/, /rr/, /s/ intervocálica.', phonology: 'Procesos de simplificación de grupos consonánticos.',
      pragmatics: 'Inicia y mantiene turnos con ayuda.', speech: 'Inteligibilidad 70% en habla espontánea.',
      voice: 'Normal.', fluency: 'Disfluencias evolutivas leves.', reading: 'No procede', writing: 'No procede',
      orofacial: 'Praxis linguales limitadas. Frenillo normal.', feeding: 'Sin dificultades.', swallowing: 'Normal.',
      tests: 'Evaluación informal, registro de lenguaje espontáneo y prueba de articulación.',
      activities: 'Cuento interactivo, lotos fonológicos, juego simbólico.',
      materials: 'Lotos, dominós de verbos, cuentos.', homeTasks: 'Leer cuento diario 10 min y nombrar imágenes.',
      objectiveResults: {
        'obj-1': { correct: 4, attempts: 6, help: 'Verbal', notes: 'Mejor con apoyo visual.' },
        'obj-2': { correct: 2, attempts: 8, help: 'Modelado', notes: 'Aún inestable.' },
        'obj-3': { correct: 3, attempts: 6, help: 'Verbal', notes: 'Omite artículos.' },
      },
      coordinationAuth: true, coordinationNotes: 'Autorizado contacto con tutora y orientador del centro.',
    },
    version: 1, createdAt: dateAt(-21, 17, 0), updatedAt: dateAt(-21, 17, 0), demo: true,
  },
  {
    id: 'cr-logo-2', patientId: 'p-pau', professionalId: 'u-logo', professionalName: 'Irene Navarro',
    specialty: UserRole.LOGOPEDIA, recordType: 'sesion', date: dateAt(-7, 16, 0),
    status: 'firmado', summary: 'Progreso en vocabulario; /r/ ainda inestable. Buena implicación familiar.',
    objectives: baseObjectives([
      { description: 'Ampliar vocabulario comprensivo y expresivo a 300 palabras', area: 'Vocabulario', target: '300 palabras', progress: 70 },
      { description: 'Producir correctamente /r/ en sílaba directa', area: 'Articulación', target: '80%', progress: 40 },
      { description: 'Mejorar estructura de frase de 3 elementos', area: 'Gramática', target: '5/6 ensayos', progress: 60 },
    ]),
    data: {
      patientType: 'infantil', motivo: 'Sesión de intervención.', antecedentes: 'Sin cambios.',
      familyContext: 'La familia ha practicado el material enviado.', schoolContext: 'Tutora informa de mayor participación.',
      comprehension: 'Órdenes de 3 elementos con apoyo visual.', expression: 'Frases de 3-4 palabras.',
      vocabulary: 'Incorporadas 18 palabras nuevas.', grammar: 'Mejor uso de plurales.',
      articulation: '/r/ correcta en sílaba directa con modelado.', phonology: 'Menos simplificación.',
      pragmatics: 'Turnos adecuados.', speech: 'Inteligibilidad 80%.', voice: 'Normal.', fluency: 'Normal.',
      reading: 'No procede', writing: 'No procede', orofacial: 'Mayor precisión lingual.', feeding: 'Sin dificultades.', swallowing: 'Normal.',
      tests: 'Registro de sesión.', activities: 'Loto de /r/, construcción de frases con pictogramas.',
      materials: 'Pictogramas, loto fonológico.', homeTasks: '5 minutos diarios de loto y lectura compartida.',
      objectiveResults: {
        'obj-1': { correct: 5, attempts: 6, help: 'Autónomo', notes: 'Generaliza en casa.' },
        'obj-2': { correct: 4, attempts: 8, help: 'Verbal', notes: 'Mejor en sílaba directa.' },
        'obj-3': { correct: 5, attempts: 6, help: 'Autónomo', notes: 'Mantiene artículos.' },
      },
      coordinationAuth: true, coordinationNotes: 'Se comparte evolución general con la tutora, sin datos clínicos sensibles.',
    },
    version: 1, createdAt: dateAt(-7, 17, 0), updatedAt: dateAt(-7, 17, 0), demo: true,
  },
  // PSICOLOGÍA
  {
    id: 'cr-psi-1', patientId: 'p-elena', professionalId: 'u-psi', professionalName: 'Daniel Ferrer',
    specialty: UserRole.PSICOLOGIA, recordType: 'valoracion', date: dateAt(-28, 9, 0),
    status: 'firmado', summary: 'Cuadro ansioso con preocupación excesiva y sintomatología somática. Sin riesgo autolítico.',
    objectives: baseObjectives([
      { description: 'Reducir sintomatología ansiosa (STAI) por debajo del percentil 75', area: 'Ansiedad', target: 'STAI ≤ P75', progress: 45 },
      { description: 'Ampliar repertorio de regulación emocional', area: 'Regulación', target: '3 estrategias', progress: 60 },
    ]),
    data: {
      motivo: 'Preocupación constante, tensión muscular y dificultad para conciliar el sueño.',
      personalHistory: 'Madre con ansiedad. Sin antecedentes psiquiátricos propios.',
      familyHistory: 'Ansiedad materna. Buen apoyo familiar.', medicalHistory: 'Migrañas ocasionales. Sin medicación psiquiátrica.',
      psychologicalHistory: 'Episodio de ansiedad hace 4 años, resuelto sin tratamiento.',
      areas: { ansiedad: 'Elevada', animo: 'Estable', sueno: 'Dificultad inicial', apetito: 'Normal', funcionalidad: 'Conservada' },
      formulation: 'Patrón de intolerancia a la incertidumbre con conductas de comprobación y evitación. Mantenido por refuerzo negativo a corto plazo.',
      risk: { level: 'sin_riesgo', suicidal: 'No', selfHarm: 'No', protection: 'Apoyo familiar y red social', notes: 'Sin ideación autolítica. Se revisa en cada sesión.' },
      plan: 'Psicoeducación, reestructuración cognitiva, exposición gradual y entrenamiento en relajación. Revisión mensual.',
      techniques: ['Psicoeducación', 'Reestructuración cognitiva', 'Entrenamiento en relajación'],
      response: 'Buena alianza terapéutica.', homework: 'Registro de preocupaciones y respiración diafragmática.',
      relapsePrevention: 'Identificar señales tempranas y plan de acción.',
      tests: [{
        id: 'test-1', testId: 'stai', name: 'STAI', area: 'ansiedad', version: 'Revisada',
        date: dateAt(-28), answers: 'Registro manual de respuestas en ejemplar autorizado.',
        rawScore: 48, percentile: 85, result: 'Ansiedad elevada',
        autoCorrected: false, reviewed: true, reviewerNote: 'Corrección manual revisada por el profesional.',
        licenseNote: 'Material sujeto a licencia. No se almacenan ítems ni claves.',
      }],
      referrals: 'No procede en este momento. Coordinación con atención primaria si empeora.',
      draftReport: '',
    },
    version: 1, createdAt: dateAt(-28, 10, 0), updatedAt: dateAt(-28, 10, 0), demo: true,
  },
  {
    id: 'cr-psi-2', patientId: 'p-elena', professionalId: 'u-psi', professionalName: 'Daniel Ferrer',
    specialty: UserRole.PSICOLOGIA, recordType: 'sesion', date: dateAt(-7, 9, 0),
    status: 'firmado', summary: 'Mejoría parcial. Menor comprobación. Se mantiene exposición gradual.',
    objectives: baseObjectives([
      { description: 'Reducir sintomatología ansiosa (STAI) por debajo del percentil 75', area: 'Ansiedad', target: 'STAI ≤ P75', progress: 70 },
      { description: 'Ampliar repertorio de regulación emocional', area: 'Regulación', target: '3 estrategias', progress: 80 },
    ]),
    data: {
      motivo: 'Seguimiento.', personalHistory: 'Sin cambios.', familyHistory: 'Sin cambios.',
      medicalHistory: 'Sin cambios.', psychologicalHistory: 'Sin cambios.',
      areas: { ansiedad: 'Moderada', animo: 'Estable', sueno: 'Mejoría', apetito: 'Normal', funcionalidad: 'Buena' },
      formulation: 'Se observa reducción de conductas de comprobación. La exposición gradual está funcionando.',
      risk: { level: 'sin_riesgo', suicidal: 'No', selfHarm: 'No', protection: 'Apoyo familiar', notes: 'Sin cambios.' },
      plan: 'Continuar exposición gradual y entrenamiento en tolerancia a la incertidumbre.',
      techniques: ['Exposición gradual', 'Reestructuración cognitiva'],
      response: 'Buena adherencia a tareas.', homework: 'Exposición a situación laboral incierta 3 veces por semana.',
      relapsePrevention: 'Plan de acción ante repunte.', tests: [],
      referrals: 'No procede.', draftReport: '',
    },
    version: 1, createdAt: dateAt(-7, 10, 0), updatedAt: dateAt(-7, 10, 0), demo: true,
  },
  {
    id: 'cr-psi-3', patientId: 'p-pau', professionalId: 'u-psi', professionalName: 'Daniel Ferrer',
    specialty: UserRole.PSICOLOGIA, recordType: 'valoracion', date: dateAt(-18, 17, 0),
    status: 'firmado', summary: 'Dificultades de regulación emocional y atención sostenida. Contexto escolar demandante.',
    objectives: baseObjectives([
      { description: 'Identificar y nombrar 4 emociones básicas', area: 'Regulación emocional', target: '4/4', progress: 50 },
      { description: 'Mejorar atención sostenida en tarea de 10 minutos', area: 'Atención', target: '10 min', progress: 35 },
    ]),
    data: {
      motivo: 'Rabietas frecuentes y dificultad para mantener la atención en tareas escolares.',
      personalHistory: 'Desarrollo motor normal. Control de esfínteres adquirido. Sin antecedentes médicos relevantes.',
      familyHistory: 'Sin antecedentes psiquiátricos conocidos.', medicalHistory: 'Sin medicación.',
      psychologicalHistory: 'Sin evaluación previa.',
      areas: { ansiedad: 'Baja', animo: 'Estable', sueno: 'Adecuado', atencion: 'Dificultades', conducta: 'Rabietas', funcionalidad: 'Escolar afectada' },
      formulation: 'Patrón de baja tolerancia a la frustración con estrategias de evitación. Contexto escolar con alta demanda y escasa adaptación.',
      risk: { level: 'sin_riesgo', suicidal: 'No', selfHarm: 'No', protection: 'Familia y escuela', notes: 'Sin indicadores de riesgo.' },
      plan: 'Psicoeducación familiar, entrenamiento en regulación emocional y coordinación escolar.',
      techniques: ['Psicoeducación', 'Regulación emocional'],
      response: 'Colaborador. Buena respuesta a refuerzo positivo.', homework: 'Termómetro de emociones y economía de fichas.',
      relapsePrevention: 'Revisar señales de sobrecarga escolar.', tests: [{
        id: 'test-2', testId: 'cbcl', name: 'CBCL', area: 'conducta', version: 'Actual',
        date: dateAt(-18), answers: 'Cuestionario cumplimentado por la madre en ejemplar autorizado.',
        rawScore: 'Pendiente', percentile: '', result: 'Requiere corrección profesional',
        autoCorrected: false, reviewed: false, reviewerNote: 'Pendiente de revisión y baremos.',
        licenseNote: 'Material licenciado. Sin ítems ni claves en la aplicación.',
      }],
      referrals: 'Coordinación con orientación escolar autorizada por la familia.',
      draftReport: '',
    },
    version: 1, createdAt: dateAt(-18, 18, 0), updatedAt: dateAt(-18, 18, 0), demo: true,
  },
  {
    id: 'cr-psi-4', patientId: 'p-marta', professionalId: 'u-psi', professionalName: 'Daniel Ferrer',
    specialty: UserRole.PSICOLOGIA, recordType: 'valoracion', date: dateAt(-5, 17, 0),
    status: 'completado', summary: 'Duelo migratorio y dificultades de adaptación. Sin riesgo.',
    objectives: baseObjectives([
      { description: 'Elaborar narrativa de adaptación y reducir malestar', area: 'Adaptación', target: 'Malestar ≤ 4/10', progress: 30 },
    ]),
    data: {
      motivo: 'Tristeza y sensación de desarraigo tras mudanza.',
      personalHistory: 'Mudanza reciente. Red social limitada.', familyHistory: 'Sin antecedentes relevantes.',
      medicalHistory: 'Sin patologías.', psychologicalHistory: 'Sin tratamiento previo.',
      areas: { ansiedad: 'Moderada', animo: 'Bajo', sueno: 'Adecuado', funcionalidad: 'Conservada' },
      formulation: 'Proceso adaptativo con duelo migratorio. Factores de protección: motivación y apoyo de pareja.',
      risk: { level: 'sin_riesgo', suicidal: 'No', selfHarm: 'No', protection: 'Pareja y amistades', notes: 'Sin ideación autolítica.' },
      plan: 'Apoyo, activación conductual y construcción de red social.',
      techniques: ['Activación conductual', 'Psicoeducación'], response: 'Buena alianza.',
      homework: 'Planificar dos actividades sociales semanales.', relapsePrevention: 'Identificar aislamiento.',
      tests: [], referrals: 'No procede.', draftReport: '',
    },
    version: 1, createdAt: dateAt(-5, 18, 0), updatedAt: dateAt(-5, 18, 0), demo: true,
  },
  // Informe de ejemplo
  {
    id: 'cr-report-1', patientId: 'p-pau', professionalId: 'u-logo', professionalName: 'Irene Navarro',
    specialty: UserRole.LOGOPEDIA, recordType: 'informe', date: dateAt(-6, 18, 0),
    status: 'firmado', summary: 'Informe de seguimiento logopédico',
    objectives: [],
    data: {
      title: 'Informe de seguimiento logopédico',
      content: 'Pau Martín Costa, de 8 años, acude a seguimiento por retraso del lenguaje expresivo y dificultades fonológicas. Se observa una evolución favorable en vocabulario y estructura de frase. La articulación de /r/ continúa en proceso. Se recomienda mantener la práctica diaria en casa y revisar en 6 semanas.',
      recommendations: 'Mantener lectura compartida diaria y actividades de conciencia fonológica.',
      includeTestResults: false,
    },
    version: 1, createdAt: dateAt(-6, 18, 0), updatedAt: dateAt(-6, 18, 0), demo: true,
  },
];

const INVOICES: Invoice[] = [
  {
    id: 'inv-1', number: `${currentYear}-0001`, patientId: 'p-elena', patientName: 'Elena Ruiz García',
    appointmentId: 'apt-1', date: dateOnly(0), dueDate: dateOnly(30),
    items: [{ id: 'ii-1', serviceId: 's-psi-ses', description: 'Sesión de psicología', quantity: 1, unitPrice: 60 }],
    subtotal: 60, taxRate: 0, taxAmount: 0, total: 60, amountPaid: 60, status: 'pagada',
    method: 'tarjeta', notes: '', createdBy: 'u-admin', createdAt: dateAt(0, 9, 30), demo: true,
  },
  {
    id: 'inv-2', number: `${currentYear}-0002`, patientId: 'p-javier', patientName: 'Javier Ortega Molina',
    appointmentId: 'apt-9', date: dateOnly(-7), dueDate: dateOnly(23),
    items: [{ id: 'ii-2', serviceId: 's-fisio-ses', description: 'Sesión de fisioterapia', quantity: 1, unitPrice: 45 }],
    subtotal: 45, taxRate: 0, taxAmount: 0, total: 45, amountPaid: 45, status: 'pagada',
    method: 'efectivo', notes: '', createdBy: 'u-admin', createdAt: dateAt(-7, 18, 30), demo: true,
  },
  {
    id: 'inv-3', number: `${currentYear}-0003`, patientId: 'p-pau', patientName: 'Pau Martín Costa',
    appointmentId: null, date: dateOnly(-3), dueDate: dateOnly(-1),
    items: [
      { id: 'ii-3', serviceId: 's-logo-val', description: 'Valoración logopédica', quantity: 1, unitPrice: 60 },
      { id: 'ii-4', serviceId: 's-logo-ses', description: 'Sesión de logopedia', quantity: 1, unitPrice: 45 },
    ],
    subtotal: 105, taxRate: 0, taxAmount: 0, total: 105, amountPaid: 0, status: 'emitida',
    method: null, notes: 'Pendiente de cobro. Recordatorio enviado a la familia.', createdBy: 'u-admin', createdAt: dateAt(-3, 12, 0), demo: true,
  },
  {
    id: 'inv-4', number: `${currentYear}-0004`, patientId: 'p-carla', patientName: 'Carla Domínguez León',
    appointmentId: 'apt-2', date: dateOnly(0), dueDate: dateOnly(30),
    items: [{ id: 'ii-5', serviceId: 's-fisio-ses', description: 'Sesión de fisioterapia', quantity: 1, unitPrice: 45 }],
    subtotal: 45, taxRate: 0, taxAmount: 0, total: 45, amountPaid: 0, status: 'borrador',
    method: null, notes: 'Generada desde la agenda. Pendiente de emitir.', createdBy: 'u-admin', createdAt: dateAt(0, 10, 45), demo: true,
  },
];

const PAYMENTS: Payment[] = [
  {
    id: 'pay-1', concept: 'psicologia', amount: 60, method: 'tarjeta', paymentDate: dateOnly(0),
    professionalId: 'u-psi', patientId: 'p-elena', appointmentId: 'apt-1', invoiceId: 'inv-1',
    notes: 'Sesión de seguimiento', createdBy: 'u-admin', createdAt: dateAt(0, 9, 35),
    professionalName: 'Daniel Ferrer', patientName: 'Elena Ruiz García', demo: true,
  },
  {
    id: 'pay-2', concept: 'fisioterapia', amount: 45, method: 'efectivo', paymentDate: dateOnly(-7),
    professionalId: 'u-fisio', patientId: 'p-javier', appointmentId: 'apt-9', invoiceId: 'inv-2',
    notes: '', createdBy: 'u-admin', createdAt: dateAt(-7, 18, 35),
    professionalName: 'Marta Soler', patientName: 'Javier Ortega Molina', demo: true,
  },
];

const EXPENSES: Expense[] = [
  { id: 'exp-1', date: dateOnly(-10), supplier: 'Inmobiliaria Centro', category: 'Alquiler', specialty: 'general', amount: 1450, method: 'transferencia', status: 'pagado', reference: 'ALQ-10', notes: 'Alquiler mensual', createdBy: 'u-admin', createdAt: dateAt(-10), demo: true },
  { id: 'exp-2', date: dateOnly(-2), supplier: 'FisioSupply', category: 'Material clínico', specialty: UserRole.FISIOTERAPIA, amount: 186.4, method: 'tarjeta', status: 'pendiente', reference: 'FS-8821', notes: 'Bandas elásticas y cuñas', createdBy: 'u-admin', createdAt: dateAt(-2), demo: true },
  { id: 'exp-3', date: dateOnly(-1), supplier: 'Clínica Cloud', category: 'Software', specialty: 'general', amount: 59, method: 'tarjeta', status: 'pagado', reference: 'CC-2026', notes: 'Software de gestión', createdBy: 'u-admin', createdAt: dateAt(-1), demo: true },
];

const PACKAGES: SessionPackage[] = [
  { id: 'pack-1', patientId: 'p-carla', patientName: 'Carla Domínguez León', name: 'Bono 5 sesiones fisioterapia', serviceId: 's-fisio-ses', specialty: UserRole.FISIOTERAPIA, totalSessions: 5, usedSessions: 2, price: 200, purchaseDate: dateOnly(-14), expiryDate: dateOnly(76), status: 'activo', notes: 'Bono de tratamiento', demo: true },
  { id: 'pack-2', patientId: 'p-pau', patientName: 'Pau Martín Costa', name: 'Bono 10 sesiones logopedia', serviceId: 's-logo-ses', specialty: UserRole.LOGOPEDIA, totalSessions: 10, usedSessions: 4, price: 400, purchaseDate: dateOnly(-30), expiryDate: dateOnly(150), status: 'activo', notes: '', demo: true },
];

const CONSENTS: ConsentRecord[] = [
  { id: 'con-1', patientId: 'p-elena', type: 'privacidad', title: 'Consentimiento de privacidad y protección de datos', signed: true, signedBy: 'Elena Ruiz García', date: dateOnly(-120), createdBy: 'u-admin', createdAt: dateAt(-120), demo: true },
  { id: 'con-2', patientId: 'p-elena', type: 'clinico', title: 'Consentimiento informado para tratamiento clínico', signed: true, signedBy: 'Elena Ruiz García', date: dateOnly(-120), createdBy: 'u-admin', createdAt: dateAt(-120), demo: true },
  { id: 'con-3', patientId: 'p-pau', type: 'privacidad', title: 'Consentimiento de privacidad y protección de datos', signed: true, signedBy: 'Marta Costa Ferrer', guardianName: 'Marta Costa Ferrer', date: dateOnly(-95), createdBy: 'u-admin', createdAt: dateAt(-95), demo: true },
  { id: 'con-4', patientId: 'p-pau', type: 'menores', title: 'Autorización de representación legal para menor', signed: true, signedBy: 'Marta Costa Ferrer', guardianName: 'Marta Costa Ferrer', date: dateOnly(-95), createdBy: 'u-admin', createdAt: dateAt(-95), demo: true },
  { id: 'con-5', patientId: 'p-pau', type: 'coordinacion', title: 'Autorización de coordinación con centro escolar', signed: true, signedBy: 'Marta Costa Ferrer', guardianName: 'Marta Costa Ferrer', date: dateOnly(-21), expiresAt: dateOnly(344), createdBy: 'u-logo', createdAt: dateAt(-21), demo: true },
  { id: 'con-6', patientId: 'p-carla', type: 'privacidad', title: 'Consentimiento de privacidad y protección de datos', signed: true, signedBy: 'Carla Domínguez León', date: dateOnly(-80), createdBy: 'u-admin', createdAt: dateAt(-80), demo: true },
  { id: 'con-7', patientId: 'p-hugo', type: 'privacidad', title: 'Consentimiento de privacidad y protección de datos', signed: false, signedBy: '', guardianName: 'Ana Serrano Gil', date: '', createdBy: 'u-admin', createdAt: dateAt(-45), demo: true },
];

const AUDIT: AuditEntry[] = [
  {
    id: 'aud-1', userId: 'u-admin', userName: 'Laura Méndez', role: 'Administración',
    action: 'patient.create', entity: 'patient', entityId: 'p-elena', patientId: 'p-elena',
    detail: 'Alta administrativa de paciente', createdAt: dateAt(-120, 10, 0), demo: true,
  },
  {
    id: 'aud-2', userId: 'u-psi', userName: 'Daniel Ferrer', role: 'Psicología',
    action: 'clinical.view', entity: 'clinical_record', entityId: 'cr-psi-1', patientId: 'p-elena',
    detail: 'Acceso a historia clínica de su especialidad', createdAt: dateAt(-7, 9, 5), demo: true,
  },
  {
    id: 'aud-3', userId: 'u-admin', userName: 'Laura Méndez', role: 'Administración',
    action: 'invoice.create', entity: 'invoice', entityId: 'inv-3', patientId: 'p-pau',
    detail: 'Emisión de factura 105,00 €', createdAt: dateAt(-3, 12, 5), demo: true,
  },
];

const RESERVATIONS: ReservationRequest[] = [
  {
    id: 'res-1', area: 'psicologia', paciente: 'adulto', edad: 29,
    fecha: dateOnly(3), hora: '18:30', nombre: 'Nuria Sanz', telefono: '622 110 988',
    email: 'nuria.sanz@example.com', notas: 'Prefiere primera visita por la tarde.',
    status: 'pendiente', professional_id: null, appointment_id: null, created_at: dateAt(-1, 20, 0),
  },
  {
    id: 'res-2', area: 'logopedia', paciente: 'nino', edad: 6,
    fecha: dateOnly(5), hora: '17:00', nombre: 'Familia Ramos', telefono: '699 220 118',
    email: 'familia.ramos@example.com', notas: 'Derivación del pediatra. Adjuntará informe.',
    status: 'pendiente', professional_id: null, appointment_id: null, created_at: dateAt(0, 8, 15),
  },
];

const CHAT_ROOMS: ChatRoom[] = [
  { id: 'room-team', type: 'group', name: 'Equipo Sinestesya', updatedAt: dateAt(0, 8, 30), participants: USERS },
];

const CHAT_MESSAGES: ChatMessage[] = [
  { id: 'msg-1', roomId: 'room-team', senderId: 'u-admin', senderName: 'Laura Méndez', content: 'Buenos días. Recordad completar el registro clínico de las sesiones de hoy antes de las 19:00.', type: 'text', createdAt: dateAt(0, 8, 30), isRead: true },
  { id: 'msg-2', roomId: 'room-team', senderId: 'u-fisio', senderName: 'Marta Soler', content: 'Recibido. Yo termino la valoración de Javier a última hora.', type: 'text', createdAt: dateAt(0, 8, 45), isRead: true },
];

const SETTINGS: CenterSettings = {
  centerName: 'Sinestesya',
  legalName: 'Sinestesya Salud Integral S.L.',
  cif: 'B-00000000',
  address: 'C/ Ejemplo 1, Valencia',
  phone: '+34 900 000 000',
  email: 'hola@sinestesya.es',
  web: 'www.sinestesya.es',
  schedule: 'Lunes a viernes · 09:00–20:00',
  adminClinicalAccess: false,
  clinicalAccessJustification: '',
  retentionYears: 5,
  aiEnabled: false,
  aiPrivacyReviewed: false,
  lastBackupAt: dateAt(-1, 22, 0),
};

const buildInitialState = (): DemoState => ({
  users: USERS,
  patients: PATIENTS,
  assignments: ASSIGNMENTS,
  appointments: APPOINTMENTS,
  clinicalRecords: CLINICAL_RECORDS,
  medicalHistory: [
    {
      id: 'mh-1', patientId: 'p-elena', professionalId: 'u-admin', professionalName: 'Laura Méndez',
      date: dateAt(-120, 10, 0), description: 'Alta administrativa en el centro.', entryType: 'administrativa',
    },
    {
      id: 'mh-2', patientId: 'p-pau', professionalId: 'u-admin', professionalName: 'Laura Méndez',
      date: dateAt(-95, 10, 0), description: 'Alta de menor con representante legal autorizado.', entryType: 'administrativa',
    },
  ],
  services: SERVICES,
  rooms: [
    { id: 'room-1', name: 'Sala 1', specialty: UserRole.FISIOTERAPIA, active: true },
    { id: 'room-2', name: 'Sala 2', specialty: UserRole.LOGOPEDIA, active: true },
    { id: 'room-3', name: 'Sala 3', specialty: UserRole.PSICOLOGIA, active: true },
    { id: 'room-4', name: 'Sala 4', specialty: UserRole.NUTRICION, active: true },
    { id: 'room-5', name: 'Sala polivalente', specialty: 'comun', active: true },
  ],
  payments: PAYMENTS,
  invoices: INVOICES,
  expenses: EXPENSES,
  packages: PACKAGES,
  cashClosings: [],
  consents: CONSENTS,
  audit: AUDIT,
  reservations: RESERVATIONS,
  notifications: [],
  settings: SETTINGS,
  chatRooms: CHAT_ROOMS,
  chatMessages: CHAT_MESSAGES,
});

export const getDemoState = (): DemoState => {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const initial = buildInitialState();
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as DemoState;
    // Migración defensiva si faltan claves nuevas
    const initial = buildInitialState();
    return { ...initial, ...parsed };
  } catch {
    const initial = buildInitialState();
    try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial)); } catch { /* noop */ }
    return initial;
  }
};

export const saveDemoState = (state: DemoState): void => {
  try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
};

export const updateDemoState = <T,>(updater: (state: DemoState) => T): T => {
  const state = getDemoState();
  const result = updater(state);
  saveDemoState(state);
  return result;
};

export const resetDemoState = (): void => {
  const initial = buildInitialState();
  saveDemoState(initial);
  localStorage.removeItem(DEMO_SESSION_KEY);
};

export const getDemoSession = (): User | null => {
  try {
    const id = localStorage.getItem(DEMO_SESSION_KEY);
    if (!id) return null;
    return getDemoState().users.find(u => u.id === id) || null;
  } catch {
    return null;
  }
};

export const setDemoSession = (userId: string | null): void => {
  if (userId) localStorage.setItem(DEMO_SESSION_KEY, userId);
  else localStorage.removeItem(DEMO_SESSION_KEY);
};

export const demoLogin = (email: string, password?: string): User | null => {
  // En demostración la contraseña es "demo" (se indica en la pantalla de acceso).
  if (password && password !== 'demo') return null;
  const user = getDemoState().users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  setDemoSession(user.id);
  return user;
};

export const newId = (prefix: string): string =>
  `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

export const DEMO_PROFILES = USERS.map(u => ({
  user: u,
  label: u.role === UserRole.ADMIN ? 'Administración' : u.profession,
  description: u.role === UserRole.ADMIN
    ? 'Agenda global, facturación y gestión del centro'
    : `Acceso a ${u.profession} y pacientes asignados`,
}));

export const demoPatientName = (patientId: string): string => {
  const p = getDemoState().patients.find(x => x.id === patientId);
  return p ? `${p.firstName} ${p.lastName}` : 'Paciente';
};

export const demoProfessionalName = (id?: string | null): string =>
  getDemoState().users.find(u => u.id === id)?.name || 'Profesional';

export const demoSpecialtyOfPatient = (patientId: string): string[] =>
  getDemoState().assignments.filter(a => a.patientId === patientId && a.active).map(a => a.specialty);

export const DEMO_SPECIALTY_COUNT = CLINICAL_SPECIALTIES.length;
