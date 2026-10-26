import { ClinicalSpecialty, DocumentCategory, PatientDocument, Permission, User, UserRole } from '../types';
import { CLINICAL_SPECIALTIES, isClinicalRole } from '../constants';

const ADMIN_BASE: Permission[] = [
  'agenda.view.all',
  'agenda.manage.all',
  'patients.view.all',
  'patients.create',
  'patients.edit.admin',
  'patients.assign',
  'billing.view',
  'billing.manage',
  'services.manage',
  'reports.view',
  'professionals.manage',
  'settings.manage',
  'audit.view',
  'clinical.consents.manage',
  'documents.view',
  'documents.manage',
  'documents.templates.manage',
  'messages.use',
];

const CLINICAL_BASE: Permission[] = [
  'agenda.view.own',
  'agenda.manage.own',
  'patients.view.assigned',
  'patients.create',
  'clinical.view.own',
  'clinical.write.own',
  'clinical.consents.manage',
  'documents.view',
  'documents.manage',
  'messages.use',
];

const PENDING_BASE: Permission[] = [];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: ADMIN_BASE,
  [UserRole.FISIOTERAPIA]: CLINICAL_BASE,
  [UserRole.NUTRICION]: CLINICAL_BASE,
  [UserRole.LOGOPEDIA]: CLINICAL_BASE,
  [UserRole.PSICOLOGIA]: CLINICAL_BASE,
  [UserRole.PENDIENTE]: PENDING_BASE,
};

export const ALL_PERMISSIONS: { id: Permission; label: string; group: string }[] = [
  { id: 'agenda.view.all', label: 'Ver agenda global', group: 'Agenda' },
  { id: 'agenda.view.own', label: 'Ver agenda propia', group: 'Agenda' },
  { id: 'agenda.manage.all', label: 'Gestionar cualquier cita', group: 'Agenda' },
  { id: 'agenda.manage.own', label: 'Gestionar citas propias', group: 'Agenda' },
  { id: 'patients.view.all', label: 'Ver todos los pacientes', group: 'Pacientes' },
  { id: 'patients.view.assigned', label: 'Ver pacientes asignados', group: 'Pacientes' },
  { id: 'patients.create', label: 'Crear fichas de pacientes', group: 'Pacientes' },
  { id: 'patients.edit.admin', label: 'Editar datos administrativos', group: 'Pacientes' },
  { id: 'patients.assign', label: 'Asignar pacientes a profesionales', group: 'Pacientes' },
  { id: 'clinical.view.own', label: 'Ver historia de su especialidad', group: 'Clínica' },
  { id: 'clinical.write.own', label: 'Registrar en su especialidad', group: 'Clínica' },
  { id: 'clinical.view.all', label: 'Ver historias clínicas de todas las especialidades (autorización expresa)', group: 'Clínica' },
  { id: 'clinical.consents.manage', label: 'Gestionar consentimientos', group: 'Clínica' },
  { id: 'documents.view', label: 'Ver documentación y consentimientos', group: 'Documentación' },
  { id: 'documents.manage', label: 'Generar, enviar y archivar documentación', group: 'Documentación' },
  { id: 'documents.templates.manage', label: 'Gestionar plantillas documentales y su revisión', group: 'Documentación' },
  { id: 'billing.view', label: 'Ver facturación y cobros', group: 'Administración' },
  { id: 'billing.manage', label: 'Gestionar facturación y cobros', group: 'Administración' },
  { id: 'services.manage', label: 'Gestionar servicios, tarifas y salas', group: 'Administración' },
  { id: 'reports.view', label: 'Ver informes de centro', group: 'Administración' },
  { id: 'professionals.manage', label: 'Gestionar profesionales y permisos', group: 'Administración' },
  { id: 'settings.manage', label: 'Configuración técnica del centro', group: 'Administración' },
  { id: 'audit.view', label: 'Consultar registro de auditoría', group: 'Seguridad' },
  { id: 'messages.use', label: 'Usar mensajería interna', group: 'Comunicación' },
];

export const getBasePermissions = (role: UserRole): Permission[] => ROLE_PERMISSIONS[role] || [];

export const getEffectivePermissions = (user?: User | null): Permission[] => {
  if (!user) return [];
  const base = getBasePermissions(user.role);
  const extra = (user.permissions || []).filter(p => !base.includes(p));
  return Array.from(new Set([...base, ...extra]));
};

export const hasPermission = (user: User | null | undefined, permission: Permission): boolean => {
  if (!user) return false;
  return getEffectivePermissions(user).includes(permission);
};

export const hasAnyPermission = (user: User | null | undefined, permissions: Permission[]): boolean =>
  permissions.some(p => hasPermission(user, p));

export const isAdmin = (user?: User | null): boolean => user?.role === UserRole.ADMIN;

export const isClinical = (user?: User | null): boolean => isClinicalRole(user?.role);

export const getClinicalSpecialty = (user?: User | null): ClinicalSpecialty | null => {
  if (!user) return null;
  if (isClinicalRole(user.role)) return user.role as ClinicalSpecialty;
  const profession = user.profession;
  if (profession && CLINICAL_SPECIALTIES.includes(profession as ClinicalSpecialty)) {
    return profession as ClinicalSpecialty;
  }
  return null;
};

export const canViewSpecialty = (user: User | null | undefined, specialty: ClinicalSpecialty): boolean => {
  if (!user) return false;
  if (user.role === specialty && hasPermission(user, 'clinical.view.own')) return true;
  return hasPermission(user, 'clinical.view.all');
};

export const canWriteSpecialty = (user: User | null | undefined, specialty: ClinicalSpecialty): boolean => {
  if (!user) return false;
  return user.role === specialty && hasPermission(user, 'clinical.write.own');
};

export const canManageClinicalNotes = (user?: User | null): boolean =>
  isAdmin(user) && hasPermission(user, 'clinical.view.all');

export const canAccessAdminArea = (user?: User | null): boolean =>
  isAdmin(user) && hasAnyPermission(user, ['billing.view', 'reports.view', 'settings.manage', 'professionals.manage']);

export const visibleClinicalSpecialties = (user: User | null | undefined): ClinicalSpecialty[] => {
  if (!user) return [];
  return CLINICAL_SPECIALTIES.filter(s => canViewSpecialty(user, s));
};

const CLINICAL_DOCUMENT_CATEGORIES: DocumentCategory[] = ['psicologia', 'fisioterapia', 'nutricion', 'logopedia', 'menores'];

/** Visibilidad de un documento concreto según rol, especialidad y permiso clínico. */
export const canViewPatientDocument = (user: User | null | undefined, document: PatientDocument): boolean => {
  if (!user || !hasPermission(user, 'documents.view')) return false;
  const clinical = !!document.specialty || CLINICAL_DOCUMENT_CATEGORIES.includes(document.category);
  if (isAdmin(user)) {
    return !clinical || hasPermission(user, 'clinical.view.all');
  }
  if (!isClinicalRole(user.role)) return false;
  const ownSpecialty = getClinicalSpecialty(user);
  if (document.specialty && document.specialty !== ownSpecialty) return false;
  return true;
};

export const canManagePatientDocument = (user: User | null | undefined, document: PatientDocument): boolean =>
  canViewPatientDocument(user, document) && hasPermission(user, 'documents.manage');

/** Permisos mínimos para cada ruta protegida. */
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/appointments': ['agenda.view.own', 'agenda.view.all'],
  '/patients': ['patients.view.assigned', 'patients.view.all'],
  '/clinical': ['clinical.view.own', 'clinical.view.all'],
  '/billing': ['billing.view'],
  '/services': ['services.manage'],
  '/reports': ['reports.view'],
  '/professionals': ['professionals.manage'],
  '/settings': ['settings.manage'],
  '/audit': ['audit.view'],
  '/document-templates': ['documents.templates.manage'],
  '/reservations': ['agenda.manage.all'],
  '/messages': ['messages.use'],
  '/system': ['settings.manage'],
};

export const canAccessRoute = (user: User | null | undefined, path: string): boolean => {
  if (!user) return false;
  const required = ROUTE_PERMISSIONS[path];
  if (!required) return true;
  return hasAnyPermission(user, required);
};
