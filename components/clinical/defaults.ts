import { ClinicalSpecialty, UserRole } from '../../types';

export const emptyClinicalData = (specialty: ClinicalSpecialty): Record<string, any> => {
  switch (specialty) {
    case UserRole.FISIOTERAPIA:
      return {
        motivo: '', antecedentes: '', eva: 0, painZones: [], painLocation: '',
        mobility: '', strength: '', sensitivity: '', posture: '', functionalTests: '',
        diagnosis: '', techniques: [], exercises: [], recommendations: '', incidents: '',
      };
    case UserRole.NUTRICION:
      return {
        motivo: '', antecedentes: '', allergies: '', intolerances: '',
        dietaryHistory: '', habits: '', mealSchedule: '', preferences: '',
        physicalActivity: '', hydration: '', goal: '',
        weight: '', height: '', bmi: '', waist: '', hip: '', arm: '', thigh: '',
        skinfolds: { triceps: '', subescapular: '', suprailiaco: '', abdominal: '' },
        bodyFat: '', muscleMass: '', pediatric: false,
        growthReference: '', growthPercentile: '',
        planVersion: 1,
        plan: { meals: [], recommendations: '' },
        adherence: '', difficulties: '', symptoms: '', familyContext: '',
      };
    case UserRole.LOGOPEDIA:
      return {
        patientType: 'infantil', motivo: '', antecedentes: '',
        familyContext: '', schoolContext: '',
        areas: {}, comprehension: '', expression: '', vocabulary: '', grammar: '',
        articulation: '', phonology: '', pragmatics: '', speech: '', voice: '', fluency: '',
        reading: '', writing: '', orofacial: '', feeding: '', swallowing: '',
        tests: '', activities: '', materials: '', homeTasks: '',
        objectiveResults: {}, coordinationAuth: false, coordinationNotes: '',
      };
    case UserRole.PSICOLOGIA:
      return {
        motivo: '', personalHistory: '', familyHistory: '', medicalHistory: '', psychologicalHistory: '',
        areas: {}, formulation: '', plan: '', techniques: [], response: '', homework: '',
        relapsePrevention: '', referrals: '',
        risk: { level: 'sin_riesgo', suicidal: 'No', selfHarm: 'No', protection: '', notes: '' },
        tests: [], draftReport: '',
      };
    default:
      return {};
  }
};

export const mergeClinicalData = (specialty: ClinicalSpecialty, base?: Record<string, any> | null): Record<string, any> => {
  const empty = emptyClinicalData(specialty);
  if (!base) return empty;
  const merged: Record<string, any> = { ...empty, ...base };
  (['skinfolds', 'plan', 'risk', 'areas', 'objectiveResults'] as const).forEach(key => {
    const defaultValue = empty[key];
    if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
      const baseValue = base[key];
      merged[key] = {
        ...defaultValue,
        ...(baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) ? baseValue : {}),
      };
    }
  });
  return merged;
};

export const statusOptions = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'completado', label: 'Completado' },
  { value: 'firmado', label: 'Firmado' },
];

export const recordTypeOptions = [
  { value: 'valoracion', label: 'Valoración inicial' },
  { value: 'sesion', label: 'Sesión / evolución' },
  { value: 'informe', label: 'Informe' },
  { value: 'alta', label: 'Alta' },
];
