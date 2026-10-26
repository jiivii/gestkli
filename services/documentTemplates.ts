import {
  ClinicalSpecialty, DocumentCategory, DocumentSettings, DocumentSignerRule, DocumentTemplate,
  DocumentTemplateField, DocumentTemplateFieldType, Patient, PatientDocumentStatus, SignatureAssurance,
  SignatureCondition, User, UserRole,
} from '../types';
import { CENTER_EMAIL, CENTER_LEGAL_NAME, CENTER_NAME, CENTER_PHONE, formatDate, patientFullName } from '../constants';

// ============================================================
//  Documentación legal · catálogos y plantillas base
// ============================================================

export const DOCUMENT_CATEGORIES: {
  id: DocumentCategory;
  label: string;
  short: string;
  description: string;
  tone: string;
}[] = [
  { id: 'privacidad', label: 'Protección de datos y privacidad', short: 'Privacidad', description: 'Información, bases jurídicas y autorizaciones opcionales.', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  { id: 'psicologia', label: 'Psicología', short: 'Psicología', description: 'Contrato terapéutico, consentimiento y confidencialidad.', tone: 'border-psy-200 bg-psy-50 text-psy-800' },
  { id: 'fisioterapia', label: 'Fisioterapia', short: 'Fisioterapia', description: 'Consentimientos, técnicas y documentación de seguimiento.', tone: 'border-fisio-200 bg-fisio-50 text-fisio-800' },
  { id: 'nutricion', label: 'Nutrición', short: 'Nutrición', description: 'Acuerdo, intervención y composición corporal.', tone: 'border-nutri-200 bg-nutri-50 text-nutri-800' },
  { id: 'logopedia', label: 'Logopedia', short: 'Logopedia', description: 'Evaluación, intervención, coordinación y grabaciones.', tone: 'border-logo-200 bg-logo-50 text-logo-800' },
  { id: 'menores', label: 'Menores y representación legal', short: 'Menores', description: 'Patria potestad, tutela, asentimiento y representación compartida.', tone: 'border-violet-200 bg-violet-50 text-violet-800' },
  { id: 'general', label: 'Documentación general del centro', short: 'General', description: 'Teleconsulta, cierre de tratamiento y entregas.', tone: 'border-stone-200 bg-stone-50 text-stone-700' },
];

export const DOCUMENT_STATUS_META: Record<PatientDocumentStatus, { label: string; tone: string; description: string }> = {
  borrador: { label: 'Borrador', tone: 'border-stone-200 bg-stone-100 text-stone-700', description: 'Generado, todavía no revisado.' },
  pendiente_revision: { label: 'Pendiente de revisión', tone: 'border-amber-200 bg-amber-50 text-amber-800', description: 'Debe revisarse antes de enviarse.' },
  listo_para_enviar: { label: 'Listo para enviar', tone: 'border-sky-200 bg-sky-50 text-sky-800', description: 'Revisado y pendiente de envío.' },
  enviado: { label: 'Enviado', tone: 'border-logo-200 bg-logo-50 text-logo-800', description: 'Correo enviado; pendiente de acceso.' },
  pendiente_firma: { label: 'Pendiente de firma', tone: 'border-amber-200 bg-amber-50 text-amber-800', description: 'El firmante ha recibido el enlace.' },
  firmado: { label: 'Firmado y verificado', tone: 'border-fisio-200 bg-fisio-50 text-fisio-800', description: 'Todas las firmas requeridas están archivadas.' },
  rechazado: { label: 'Rechazado por el firmante', tone: 'border-red-200 bg-red-50 text-red-800', description: 'El firmante no aceptó la firma.' },
  enlace_caducado: { label: 'Enlace caducado', tone: 'border-amber-200 bg-amber-50 text-amber-800', description: 'Debe generarse un enlace nuevo.' },
  envio_fallido: { label: 'Envío fallido', tone: 'border-red-200 bg-red-50 text-red-800', description: 'El correo no se pudo entregar.' },
  firma_fallida: { label: 'Firma fallida o no verificable', tone: 'border-red-200 bg-red-50 text-red-800', description: 'No se ha archivado como firmado.' },
  revocado: { label: 'Revocado', tone: 'border-stone-300 bg-stone-100 text-stone-700', description: 'El acceso o el documento se ha revocado.' },
  sustituido: { label: 'Sustituido', tone: 'border-stone-300 bg-stone-100 text-stone-600', description: 'Existe una versión posterior vigente.' },
  fuera_vigencia: { label: 'Fuera de vigencia', tone: 'border-amber-200 bg-amber-50 text-amber-800', description: 'Requiere revisión o renovación.' },
  entregado: { label: 'Entregado', tone: 'border-fisio-200 bg-fisio-50 text-fisio-800', description: 'Información entregada y registrada.' },
  archivado: { label: 'Archivado', tone: 'border-fisio-200 bg-fisio-50 text-fisio-800', description: 'Documento final conservado en el expediente.' },
};

export const SIGNATURE_CONDITION_LABELS: Record<SignatureCondition, string> = {
  paciente: 'Paciente',
  representante_legal: 'Representante legal',
  representante_legal_2: 'Segundo representante legal',
  tutor: 'Tutor o tutora',
  profesional: 'Profesional',
  otro: 'Otra condición',
};

export const SIGNER_RULE_LABELS: Record<DocumentSignerRule, string> = {
  patient_adult: 'Paciente adulto (menor: representante legal)',
  guardian_or_patient_16: 'Representante legal; valorar firma del menor desde 16 años',
  guardian_only: 'Solo representante legal',
  guardian_both: 'Ambos representantes legales cuando proceda',
  patient_and_guardian: 'Paciente y representante legal',
  manual: 'Selección manual justificada por el profesional',
};

export const ASSURANCE_LABELS: Record<SignatureAssurance, string> = {
  demo_sin_validez: 'Demostración · sin validez jurídica',
  simple_verificada_otp: 'Firma electrónica simple con OTP y evidencias',
  avanzada_proveedor: 'Firma electrónica avanzada del proveedor',
  cualificada_proveedor: 'Firma electrónica cualificada del proveedor',
  firma_manual_externa: 'Documento firmado externamente y verificado',
};

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  dpoName: '',
  dpoEmail: '',
  privacyEmail: CENTER_EMAIL,
  emailFrom: '',
  signatureProvider: 'demo',
  signatureProviderLabel: 'Entorno de demostración',
  signatureLevel: 'demo_sin_validez',
  linkTtlHours: 72,
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  requireLegalReview: true,
  lastLegalReviewAt: null,
  privacyNoticeVersion: '1.0',
  notes: 'La firma OTP del entorno local no equivale a una firma cualificada eIDAS. Integra un proveedor acreditado antes de producción.',
};

const today = new Date().toISOString();

const auto = (
  key: string,
  label: string,
  autoFill: DocumentTemplateField['autoFill'],
  required = true,
): DocumentTemplateField => ({
  key, label, type: 'text', required, autoFill, editable: false,
  sensitive: ['patient.dni', 'guardian.dni', 'guardian2.dni', 'patient.address', 'patient.email', 'patient.phone'].includes(key),
});

const manual = (
  key: string,
  label: string,
  type: DocumentTemplateFieldType = 'text',
  required = false,
  options?: string[],
  help?: string,
): DocumentTemplateField => ({
  key, label, type, required, autoFill: null, editable: true, options, help,
});

const identityFields = (): DocumentTemplateField[] => [
  auto('patient.fullName', 'Nombre y apellidos del paciente', 'patient.fullName'),
  auto('patient.birthDate', 'Fecha de nacimiento', 'patient.birthDate'),
];

const guardianFields = (): DocumentTemplateField[] => [
  auto('guardian.name', 'Representante legal', 'guardian.name', false),
  auto('guardian.dni', 'DNI del representante', 'guardian.dni', false),
  auto('guardian.relationship', 'Relación con el menor', 'guardian.relationship', false),
];

const legalBodyNote = 'Texto base pendiente de revisión jurídica. El centro debe validar la redacción, la base jurídica aplicable, la representación y los plazos antes de aprobar esta plantilla.';

const header = (title: string) => `## ${title}

**Centro:** {{center.name}} · {{center.legalName}}
**CIF:** {{center.cif}}
**Domicilio:** {{center.address}}
**Contacto:** {{center.phone}} · {{center.email}}
**Fecha de generación:** {{document.date}} · **Versión de plantilla:** {{document.version}}

---

`;

const interpretationNote = `
---

## Nota de alcance y revisión

${legalBodyNote}

Este documento no sustituye la información verbal, el juicio clínico ni la revisión de la documentación por el responsable del centro. No se han incluido cláusulas cuya validez dependa de datos no verificados.
`;

const signBlock = `\n\n## Declaración y firma

Declaro que he leído el documento completo, que se me ha permitido formular preguntas y que la información facilitada es comprensible. Confirmo la identidad y la condición en la que firmo.

La firma se formaliza electrónicamente mediante el proceso seguro del centro. En el momento de firmar se registran la lectura completa, la identidad declarada, la condición del firmante, la fecha y hora, el método de verificación y la huella de integridad del documento. La evidencia completa se incorpora al PDF firmado y al expediente.
`;

type SeedInput = Omit<DocumentTemplate, 'createdAt' | 'updatedAt' | 'demo' | 'active' | 'legalStatus'> & {
  active?: boolean;
  required?: boolean;
};

const seed = (input: SeedInput): DocumentTemplate => ({
  ...input,
  active: input.active !== false,
  legalStatus: 'pendiente_revision',
  createdAt: today,
  updatedAt: today,
  legalReviewedBy: null,
  legalReviewedAt: null,
  legalReviewNotes: 'Pendiente de validación por el DPO/asesor jurídico del centro. No enviar hasta aprobación expresa.',
  demo: true,
});

// ============================================================
//  Biblioteca inicial
// ============================================================

export const INITIAL_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  seed({
    id: 'tpl-info-privacidad',
    name: 'Información de protección de datos para pacientes',
    category: 'privacidad',
    specialty: null,
    description: 'Información general sobre responsable, finalidades, base jurídica, conservación y derechos. No es un consentimiento.',
    version: 1,
    requiresSignature: false,
    signerRule: 'manual',
    required: true,
    validityDays: null,
    fields: [
      ...identityFields(),
      auto('patient.address', 'Dirección', 'patient.address', false),
      auto('patient.email', 'Correo electrónico', 'patient.email', false),
      manual('deliveryChannel', 'Canal de entrega', 'select', true, ['Presencial', 'Correo electrónico', 'Área privada del paciente'], 'Registra cómo se ha entregado la información.'),
      manual('identityCheck', 'He comprobado la identidad del destinatario', 'checkbox', true),
      manual('questionsAnswered', 'He podido responder a las preguntas del paciente', 'checkbox', false),
    ],
    body: `${header('Información de protección de datos para pacientes')}**Paciente:** {{patient.fullName}}
**Fecha de nacimiento:** {{patient.birthDate}}
**Responsable del tratamiento:** {{center.legalName}} · {{center.cif}} · {{center.address}}
**Delegado de Protección de Datos:** {{center.dpoName}} · {{center.dpoEmail}}

## 1. Para qué tratamos tus datos

Tratamos los datos identificativos y de contacto necesarios para la atención sanitaria, la gestión de citas, la facturación y el cumplimiento de las obligaciones legales del centro. Los datos de salud se tratan con la finalidad de prestar la asistencia y mantener la historia clínica.

## 2. Base jurídica

La base jurídica depende de cada tratamiento. La prestación de la asistencia sanitaria se apoya en la relación asistencial y en el cumplimiento de obligaciones legales; determinados usos opcionales (por ejemplo, comunicaciones comerciales o imágenes) requieren consentimiento específico. El consentimiento no es la única base jurídica posible para tratar datos de salud.

## 3. Conservación

Los datos se conservarán durante el tiempo necesario para la asistencia y, después, durante los plazos legalmente exigibles. La política de conservación del centro se aplica según la naturaleza del documento y la normativa sanitaria.

## 4. Destinatarios y encargados

Los datos podrán comunicarse a los destinatarios legalmente previstos y a proveedores que actúen como encargados del tratamiento con las garantías exigibles. No se realizarán cesiones adicionales sin base jurídica.

## 5. Derechos

Puedes ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad cuando resulten aplicables, así como retirar un consentimiento opcional sin afectar a la licitud del tratamiento previo. Puedes contactar con {{center.dpoEmail}} o con la autoridad de control competente.

## 6. Decisiones y datos opcionales

No se adoptan decisiones automatizadas con efectos jurídicos sobre el paciente ni se elaboran perfiles con estos datos. Los campos opcionales se identifican en la ficha y no son obligatorios para recibir asistencia, salvo que sean necesarios para el servicio solicitado.

## 7. Registro de entrega

- Canal de entrega: {{deliveryChannel}}
- Identidad comprobada: {{identityCheck}}
- Preguntas atendidas: {{questionsAnswered}}
- Fecha de entrega: {{document.date}}

${interpretationNote}`,
  }),
  seed({
    id: 'tpl-info-salud',
    name: 'Información sobre el tratamiento de datos de salud',
    category: 'privacidad',
    specialty: null,
    description: 'Información específica sobre datos de salud, confidencialidad, acceso y conservación.',
    version: 1,
    requiresSignature: false,
    signerRule: 'manual',
    required: true,
    fields: [
      ...identityFields(),
      manual('serviceScope', 'Servicio o proceso asistencial', 'text', false),
      manual('deliveryChannel', 'Canal de entrega', 'select', true, ['Presencial', 'Correo electrónico', 'Área privada']),
      manual('identityCheck', 'Identidad comprobada', 'checkbox', true),
    ],
    body: `${header('Información sobre el tratamiento de datos de salud')}**Paciente:** {{patient.fullName}}
**Servicio o proceso:** {{serviceScope || 'Asistencia en el centro'}}
**Responsable:** {{center.legalName}} · **DPO:** {{center.dpoName}} · {{center.dpoEmail}}

## Datos tratados

Se tratan datos identificativos, de contacto, de asistencia y datos de salud necesarios para la valoración, la intervención, el seguimiento y la continuidad asistencial. La información clínica se conserva en la historia del centro y se comparte únicamente con el equipo autorizado.

## Confidencialidad y límites

El equipo profesional está sujeto al deber de secreto. Los límites legales de la confidencialidad se explican de forma adaptada al servicio y no se amplían sin base jurídica. La coordinación con terceros requiere la salvaguarda correspondiente y, cuando proceda, autorización específica.

## Conservación y seguridad

Se aplican medidas técnicas y organizativas proporcionadas al riesgo, control de acceso por perfiles, registro de actividad y copias de seguridad con pruebas de restauración. La conservación se ajusta a la finalidad y a los plazos legales aplicables.

## Derechos y reclamaciones

Puedes dirigirte a {{center.dpoEmail}} para ejercer tus derechos. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos. La información se entrega por el canal {{deliveryChannel}} y la identidad se ha comprobado: {{identityCheck}}.

${interpretationNote}`,
  }),
  seed({
    id: 'tpl-consent-salud',
    name: 'Consentimiento específico para datos de salud cuando proceda',
    category: 'privacidad',
    specialty: null,
    description: 'Consentimiento separado para un uso concreto que lo requiera. No se presenta como base única de la asistencia.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    required: false,
    fields: [
      ...identityFields(),
      manual('specificPurpose', 'Uso concreto para el que se solicita', 'textarea', true, undefined, 'Describe el tratamiento opcional o específico sin incluir más datos de los necesarios.'),
      manual('optionalData', 'Datos o categorías afectadas', 'textarea', false),
      manual('consequences', 'Consecuencias de no consentir', 'textarea', true),
      manual('revocation', 'Cómo se puede retirar', 'text', true),
    ],
    body: `${header('Consentimiento específico para el tratamiento de datos de salud')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Uso concreto:** {{specificPurpose}}
**Datos afectados:** {{optionalData || 'Los descritos en el uso concreto'}}
**Consecuencias de no consentir:** {{consequences}}
**Retirada:** {{revocation}}

## Información previa

Se me ha explicado que la asistencia sanitaria puede prestarse sobre otras bases jurídicas y que este consentimiento se refiere únicamente al uso concreto descrito. No consiento un uso distinto del indicado. La negativa a este consentimiento no impide la asistencia que no dependa de él.

## Alcance y límites

Este documento no autoriza comunicaciones comerciales, imágenes ni cesiones no descritas. Cualquier ampliación requerirá un documento nuevo. La retirada del consentimiento no afecta a la licitud del tratamiento previo.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-autorizacion-comunicaciones',
    name: 'Autorización para comunicaciones y usos opcionales',
    category: 'privacidad',
    specialty: null,
    description: 'Autorización separada y revocable para comunicaciones o usos que requieran consentimiento.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('channels', 'Canales autorizados', 'select', true, ['Correo electrónico', 'Teléfono', 'WhatsApp', 'SMS', 'Correo postal']),
      manual('purpose', 'Finalidad de las comunicaciones', 'textarea', true),
      manual('frequency', 'Frecuencia prevista', 'select', false, ['Solo citas', 'Información del centro', 'Recordatorios', 'Otra']),
      manual('validUntil', 'Vigencia de la autorización', 'date', false),
      manual('revocation', 'Procedimiento de revocación', 'text', true),
    ],
    body: `${header('Autorización para comunicaciones y usos opcionales')}**Paciente:** {{patient.fullName}}
**Canales autorizados:** {{channels}}
**Finalidad:** {{purpose}}
**Frecuencia:** {{frequency || 'No especificada'}}
**Vigencia:** {{validUntil || 'Hasta revocación'}}
**Revocación:** {{revocation}}

## Carácter opcional

Esta autorización es opcional y revocable. La negativa o la retirada no afecta a la asistencia sanitaria ni a la licitud del tratamiento previo. No se utilizarán los canales indicados para finalidades distintas de las descritas.

## Datos mínimos

Las comunicaciones no incluirán diagnósticos, resultados, documentos identificativos ni información clínica sensible salvo que sea imprescindible y esté expresamente descrito en esta autorización. Se recomienda un canal seguro para cualquier contenido sanitario.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-autorizacion-imagen',
    name: 'Autorización para fotografías, grabaciones o material audiovisual',
    category: 'privacidad',
    specialty: null,
    description: 'Consentimiento separado para imagen clínica o material audiovisual, con finalidad y alcance delimitados.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('materialType', 'Tipo de material', 'select', true, ['Fotografía clínica', 'Vídeo de sesión', 'Audio de sesión', 'Material de difusión']),
      manual('clinicalPurpose', 'Finalidad clínica o de difusión', 'textarea', true),
      manual('area', 'Zona o contenido grabado', 'text', false),
      manual('storage', 'Lugar y plazo de conservación', 'text', true),
      manual('publication', '¿Se publicará en web o redes?', 'select', true, ['No', 'Sí, con condiciones descritas']),
      manual('publicationConditions', 'Condiciones de publicación', 'textarea', false),
    ],
    body: `${header('Autorización para fotografías, grabaciones o material audiovisual')}**Paciente:** {{patient.fullName}}
**Material:** {{materialType}}
**Finalidad:** {{clinicalPurpose}}
**Zona o contenido:** {{area || 'No especificado'}}
**Conservación:** {{storage}}
**Publicación:** {{publication}}
**Condiciones de publicación:** {{publicationConditions || 'No procede'}}

## Alcance

La autorización se limita al material, finalidad y condiciones descritos. No se autoriza su uso para otras campañas, cesiones o adaptaciones. Cuando el material sea clínico, se almacenará en el sistema documental del centro con acceso restringido.

## Revocación y derechos

Puedo revocar esta autorización por escrito. La revocación impedirá usos futuros y, cuando sea técnicamente posible, la retirada de publicaciones, sin afectar a la licitud del uso previo ni a la conservación obligatoria de la documentación clínica.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-autorizacion-terceros',
    name: 'Autorización para comunicaciones con familiares, centros o profesionales',
    category: 'privacidad',
    specialty: null,
    description: 'Delimita con quién y para qué se puede compartir información, evitando autorizaciones genéricas.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('recipientName', 'Persona o entidad destinataria', 'text', true),
      manual('recipientRole', 'Relación o condición', 'text', true),
      manual('recipientContact', 'Contacto', 'text', false),
      manual('informationScope', 'Información que se autoriza compartir', 'textarea', true),
      manual('purpose', 'Finalidad de la coordinación', 'textarea', true),
      manual('limitations', 'Límites y exclusiones', 'textarea', false),
      manual('validUntil', 'Vigencia', 'date', false),
    ],
    body: `${header('Autorización para comunicaciones con familiares, centros o profesionales')}**Paciente:** {{patient.fullName}}
**Destinatario:** {{recipientName}} · {{recipientRole}}
**Contacto:** {{recipientContact || 'No indicado'}}
**Información autorizada:** {{informationScope}}
**Finalidad:** {{purpose}}
**Límites:** {{limitations || 'Solo la información y finalidad descritas'}}
**Vigencia:** {{validUntil || 'Hasta revocación'}}

## Delimitación

La autorización no permite compartir la historia clínica completa ni información distinta de la descrita. El destinatario recibirá únicamente la información necesaria para la finalidad indicada. Las comunicaciones se realizarán por canales seguros y quedarán registradas.

## Revocación

La autorización puede revocarse en cualquier momento por escrito. La revocación no afecta a las comunicaciones ya realizadas ni a las obligaciones legales de conservación.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-entrega-info',
    name: 'Registro de entrega de información de privacidad',
    category: 'privacidad',
    specialty: null,
    description: 'Constancia de que se ha entregado la información de privacidad. No equivale a consentimiento.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    required: true,
    fields: [
      ...identityFields(),
      manual('deliveryChannel', 'Canal de entrega', 'select', true, ['Presencial', 'Correo electrónico', 'Área privada del paciente']),
      manual('noticeVersion', 'Versión de la información entregada', 'text', true),
      manual('deliveryDate', 'Fecha de entrega', 'date', true),
      manual('identityCheck', 'Identidad comprobada', 'checkbox', true),
      manual('questions', 'Preguntas o incidencias', 'textarea', false),
    ],
    body: `${header('Registro de entrega de información de privacidad')}**Paciente:** {{patient.fullName}}
**Canal:** {{deliveryChannel}}
**Versión de la información:** {{noticeVersion}}
**Fecha de entrega:** {{deliveryDate}}
**Identidad comprobada:** {{identityCheck}}
**Preguntas o incidencias:** {{questions || 'Sin incidencias registradas'}}

## Constancia

Se deja constancia de la entrega de la información de privacidad y de la posibilidad de formular preguntas. Este registro no sustituye el consentimiento para tratamientos opcionales ni convierte el consentimiento en la base jurídica única de la asistencia.

${interpretationNote}${signBlock}`,
  }),

  seed({
    id: 'tpl-psi-contrato',
    name: 'Contrato terapéutico y acuerdo de prestación · Psicología',
    category: 'psicologia',
    specialty: UserRole.PSICOLOGIA,
    description: 'Condiciones del servicio, honorarios, duración, cancelaciones y límites de la relación terapéutica.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('modality', 'Modalidad', 'select', true, ['Presencial', 'Online', 'Mixta']),
      manual('frequency', 'Frecuencia orientativa', 'text', true),
      manual('sessionDuration', 'Duración de sesión', 'text', true),
      manual('fee', 'Honorarios', 'text', true),
      manual('paymentTerms', 'Forma y plazos de pago', 'textarea', true),
      manual('cancellation', 'Política de cancelación', 'textarea', true),
      manual('confidentialityLimits', 'Límites de confidencialidad', 'textarea', true),
    ],
    body: `${header('Contrato terapéutico y acuerdo de prestación · Psicología')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Modalidad:** {{modality}} · **Frecuencia orientativa:** {{frequency}}
**Duración de sesión:** {{sessionDuration}} · **Honorarios:** {{fee}}
**Forma y plazos de pago:** {{paymentTerms}}
**Política de cancelación:** {{cancellation}}

## Relación terapéutica

La intervención psicológica requiere colaboración activa. El profesional explicará el enfoque, los objetivos iniciales y la revisión periódica. No se garantiza un resultado concreto. El paciente puede solicitar información sobre alternativas y finalizar el tratamiento cuando lo considere.

## Confidencialidad y límites

{{confidentialityLimits}}

## Cambios y finalización

Los cambios de honorarios, modalidad o condiciones se comunicarán con antelación y, cuando afecten al acuerdo, se documentarán. La finalización no impide solicitar un resumen o informe en los términos legalmente aplicables.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-psi-consentimiento',
    name: 'Consentimiento informado para la intervención psicológica',
    category: 'psicologia',
    specialty: UserRole.PSICOLOGIA,
    description: 'Información sobre la intervención, alternativas, riesgos relevantes y derecho a retirarse.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de consulta o demanda', 'textarea', true),
      manual('approach', 'Enfoque y técnicas previstas', 'textarea', true),
      manual('risks', 'Riesgos o molestias relevantes', 'textarea', true),
      manual('alternatives', 'Alternativas razonables', 'textarea', true),
      manual('teleconsult', 'Incluye teleconsulta', 'checkbox', false),
    ],
    body: `${header('Consentimiento informado para la intervención psicológica')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Motivo o demanda:** {{reason}}
**Enfoque y técnicas previstas:** {{approach}}
**Riesgos o molestias relevantes:** {{risks}}
**Alternativas:** {{alternatives}}
**Incluye teleconsulta:** {{teleconsult}}

## Información y decisión

Se me ha explicado la naturaleza de la intervención, sus objetivos orientativos, el modo de trabajo y las alternativas. Comprendo que la psicoterapia puede implicar malestar emocional transitorio y que no existe garantía de resultado. Puedo plantear dudas, rechazar una técnica concreta o retirar el consentimiento sin perjuicio de la continuidad de la asistencia que no dependa de él.

## Confidencialidad

La información se tratará con confidencialidad y con los límites legales explicados. Cuando sea necesario coordinar con otro profesional, se solicitará autorización específica salvo obligación legal.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-psi-confidencialidad',
    name: 'Documento de confidencialidad y límites legales · Psicología',
    category: 'psicologia',
    specialty: UserRole.PSICOLOGIA,
    description: 'Explicación comprensible del secreto profesional y de sus límites, con constancia de recepción.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('limitsDetail', 'Límites explicados de forma adaptada', 'textarea', true),
      manual('coordinationPolicy', 'Procedimiento de coordinación', 'textarea', true),
      manual('questions', 'Dudas planteadas', 'textarea', false),
    ],
    body: `${header('Confidencialidad y límites legales · Psicología')}**Paciente:** {{patient.fullName}}
**Profesional:** {{professional.name}}

## Secreto profesional

La información compartida en las sesiones se trata como confidencial. El acceso se limita al profesional y al personal autorizado. Se aplican medidas de seguridad y registro de accesos.

## Límites explicados

{{limitsDetail}}

## Coordinación con terceros

{{coordinationPolicy}}

## Dudas

{{questions || 'No se han registrado dudas adicionales.'}}

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-psi-menor',
    name: 'Atención psicológica infantil y adolescente · representación legal',
    category: 'menores',
    specialty: UserRole.PSICOLOGIA,
    description: 'Documento adaptado a menores, con representantes legales, participación del menor y coordinación.',
    version: 1,
    requiresSignature: true,
    signerRule: 'guardian_both',
    fields: [
      ...identityFields(),
      ...guardianFields(),
      auto('guardian2.name', 'Segundo representante legal', 'guardian2.name', false),
      auto('representation.type', 'Tipo de representación', 'representation.type', false),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de consulta', 'textarea', true),
      manual('minorInformation', 'Información ofrecida al menor', 'textarea', true),
      manual('assent', '¿Consta asentimiento del menor?', 'select', true, ['Sí, documentado', 'No procede por edad/madurez', 'Pendiente de valorar']),
      manual('schoolCoordination', 'Coordinación escolar autorizada', 'select', false, ['No', 'Sí, con autorización separada']),
      manual('representationChecks', 'Comprobaciones de representación', 'textarea', true),
    ],
    body: `${header('Atención psicológica infantil y adolescente · representación legal')}**Menor:** {{patient.fullName}} · **Nacimiento:** {{patient.birthDate}}
**Representante 1:** {{guardian.name}} · {{guardian.dni}} · {{guardian.relationship}}
**Representante 2:** {{guardian2.name || 'No consta'}} · {{guardian2.dni || 'No consta'}}
**Representación:** {{representation.type || 'No consta'}}
**Profesional:** {{professional.name}}
**Motivo:** {{reason}}

## Información y participación del menor

{{minorInformation}}
Asentimiento del menor: {{assent}}. La participación se adaptará a su edad y madurez, sin sustituir la representación legal cuando sea exigible.

## Representación y comprobaciones

{{representationChecks}}
No se presume que una única firma parental sea suficiente en todos los casos. Si existe patria potestad compartida, discrepancia o documentación insuficiente, se activará el procedimiento de revisión del centro antes de continuar con actuaciones que requieran autorización.

## Coordinación

Coordinación escolar: {{schoolCoordination || 'No autorizada en este documento'}}. Cualquier comunicación con terceros se limitará a la información necesaria y, cuando proceda, requerirá autorización específica.

${interpretationNote}${signBlock}`,
  }),

  seed({
    id: 'tpl-fisio-consentimiento',
    name: 'Consentimiento informado para fisioterapia',
    category: 'fisioterapia',
    specialty: UserRole.FISIOTERAPIA,
    description: 'Información sobre valoración, técnicas, riesgos relevantes, alternativas y seguimiento.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de consulta', 'textarea', true),
      manual('techniques', 'Técnicas o procedimientos previstos', 'textarea', true),
      manual('risks', 'Riesgos relevantes explicados', 'textarea', true),
      manual('alternatives', 'Alternativas', 'textarea', true),
      manual('sessions', 'Número orientativo de sesiones', 'text', false),
    ],
    body: `${header('Consentimiento informado para fisioterapia')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Motivo:** {{reason}}
**Técnicas o procedimientos:** {{techniques}}
**Riesgos relevantes:** {{risks}}
**Alternativas:** {{alternatives}}
**Número orientativo de sesiones:** {{sessions || 'A valorar según evolución'}}

## Información

Se me ha explicado la valoración, los objetivos, las técnicas previstas y la posibilidad de modificar el plan. Comprendo que pueden aparecer molestias, reacciones locales o riesgos relacionados con las técnicas indicadas. Puedo solicitar una pausa, rechazar una técnica o pedir una segunda opinión.

## Seguimiento

Se registrarán la valoración, la intervención y la evolución. Cualquier cambio relevante se comunicará y, cuando afecte al consentimiento, se documentará.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-fisio-foto',
    name: 'Autorización de fotografías clínicas · Fisioterapia',
    category: 'fisioterapia',
    specialty: UserRole.FISIOTERAPIA,
    description: 'Autorización específica para fotografías clínicas con finalidad asistencial y acceso restringido.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('bodyArea', 'Zona corporal', 'text', true),
      manual('purpose', 'Finalidad clínica', 'textarea', true),
      manual('storage', 'Conservación y acceso', 'text', true),
      manual('diffusion', 'Uso en docencia o difusión', 'select', true, ['No', 'Sí, con autorización separada']),
    ],
    body: `${header('Autorización de fotografías clínicas · Fisioterapia')}**Paciente:** {{patient.fullName}}
**Zona corporal:** {{bodyArea}}
**Finalidad:** {{purpose}}
**Conservación y acceso:** {{storage}}
**Docencia o difusión:** {{diffusion}}

## Condiciones

Las imágenes clínicas se utilizarán únicamente para la finalidad descrita y se almacenarán en el sistema documental con acceso restringido. No se publicarán ni compartirán con terceros sin una autorización específica y separada.

## Revocación

La autorización es revocable. La revocación impedirá nuevos usos y no afectará a la conservación obligatoria de la documentación clínica.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-fisio-acuerdo',
    name: 'Acuerdo de prestación del servicio · Fisioterapia',
    category: 'fisioterapia',
    specialty: UserRole.FISIOTERAPIA,
    description: 'Condiciones del servicio, sesiones, honorarios, cancelaciones y seguimiento.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('sessions', 'Sesiones o bono contratado', 'text', true),
      manual('fee', 'Honorarios', 'text', true),
      manual('validity', 'Vigencia del bono o plan', 'text', false),
      manual('cancellation', 'Política de cancelación', 'textarea', true),
      manual('paymentTerms', 'Forma de pago', 'textarea', true),
    ],
    body: `${header('Acuerdo de prestación del servicio · Fisioterapia')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Sesiones o bono:** {{sessions}}
**Honorarios:** {{fee}}
**Vigencia:** {{validity || 'Según condiciones del servicio'}}
**Forma de pago:** {{paymentTerms}}
**Cancelación:** {{cancellation}}

## Condiciones

El plan se ajustará a la valoración y evolución. Los bonos no son transferibles salvo acuerdo escrito. Las sesiones canceladas con el preaviso indicado podrán reprogramarse según disponibilidad.

## Seguimiento y alta

Se registrará la evolución y se informará del alta o derivación cuando proceda. La finalización del plan no impide solicitar la documentación clínica que corresponda.

${interpretationNote}${signBlock}`,
  }),

  seed({
    id: 'tpl-nutri-acuerdo',
    name: 'Acuerdo de prestación del servicio · Nutrición',
    category: 'nutricion',
    specialty: UserRole.NUTRICION,
    description: 'Condiciones del servicio, valoración, seguimiento, honorarios y cancelaciones.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('modality', 'Modalidad', 'select', true, ['Presencial', 'Online', 'Mixta']),
      manual('planDuration', 'Duración orientativa del plan', 'text', true),
      manual('fee', 'Honorarios', 'text', true),
      manual('paymentTerms', 'Forma de pago', 'textarea', true),
      manual('cancellation', 'Política de cancelación', 'textarea', true),
    ],
    body: `${header('Acuerdo de prestación del servicio · Nutrición')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Modalidad:** {{modality}}
**Duración orientativa:** {{planDuration}}
**Honorarios:** {{fee}}
**Forma de pago:** {{paymentTerms}}
**Cancelación:** {{cancellation}}

## Naturaleza del servicio

La intervención nutricional incluye valoración, objetivos, plan de alimentación y seguimiento. No sustituye la atención médica urgente ni garantiza un resultado concreto. El paciente debe informar de alergias, patologías y tratamientos relevantes.

## Compromisos

El paciente se compromete a facilitar información veraz y a comunicar cambios de salud. El profesional adaptará el plan y documentará las revisiones.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-nutri-consentimiento',
    name: 'Consentimiento de intervención nutricional y antropometría',
    category: 'nutricion',
    specialty: UserRole.NUTRICION,
    description: 'Información y consentimiento para valoración nutricional, mediciones y composición corporal.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de consulta', 'textarea', true),
      manual('measurements', 'Mediciones previstas', 'textarea', true),
      manual('method', 'Método o dispositivo', 'text', true),
      manual('risks', 'Molestias o limitaciones', 'textarea', true),
      manual('alternatives', 'Alternativas', 'textarea', true),
      manual('photoConsent', 'Incluye fotografías de seguimiento', 'checkbox', false),
    ],
    body: `${header('Consentimiento de intervención nutricional y antropometría')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Motivo:** {{reason}}
**Mediciones previstas:** {{measurements}}
**Método o dispositivo:** {{method}}
**Molestias o limitaciones:** {{risks}}
**Alternativas:** {{alternatives}}
**Fotografías de seguimiento:** {{photoConsent}}

## Información

Se me ha explicado la valoración, las mediciones antropométricas, la estimación de composición corporal y el seguimiento. Comprendo que los resultados son orientativos y que pueden variar según el método. Puedo rechazar una medición concreta y solicitar información adicional.

## Datos y conservación

Los resultados se incorporan a la historia de nutrición y se conservan según la política del centro. Las fotografías, si se autorizan, se tratan como documento clínico con acceso restringido.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-nutri-foto',
    name: 'Autorización de fotografías o seguimiento audiovisual · Nutrición',
    category: 'nutricion',
    specialty: UserRole.NUTRICION,
    description: 'Autorización separada para imágenes de evolución, con finalidad y difusión delimitadas.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('material', 'Material autorizado', 'select', true, ['Fotografía corporal', 'Fotografía de composición', 'Vídeo de seguimiento']),
      manual('purpose', 'Finalidad', 'textarea', true),
      manual('storage', 'Conservación y acceso', 'text', true),
      manual('publication', 'Publicación o difusión', 'select', true, ['No', 'Sí, con condiciones']),
      manual('conditions', 'Condiciones de publicación', 'textarea', false),
    ],
    body: `${header('Autorización de fotografías o seguimiento audiovisual · Nutrición')}**Paciente:** {{patient.fullName}}
**Material:** {{material}}
**Finalidad:** {{purpose}}
**Conservación y acceso:** {{storage}}
**Publicación o difusión:** {{publication}}
**Condiciones:** {{conditions || 'No procede'}}

## Límites

La autorización se limita al material y finalidad indicados. Las imágenes clínicas no se publicarán ni compartirán sin una autorización específica. La revocación impedirá usos futuros.

${interpretationNote}${signBlock}`,
  }),

  seed({
    id: 'tpl-logo-consentimiento',
    name: 'Consentimiento informado y prestación · Logopedia',
    category: 'logopedia',
    specialty: UserRole.LOGOPEDIA,
    description: 'Información sobre evaluación e intervención logopédica, alternativas y seguimiento.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de consulta', 'textarea', true),
      manual('assessment', 'Evaluación prevista', 'textarea', true),
      manual('intervention', 'Intervención prevista', 'textarea', true),
      manual('risks', 'Molestias o limitaciones relevantes', 'textarea', true),
      manual('alternatives', 'Alternativas', 'textarea', true),
      manual('sessions', 'Frecuencia y duración', 'text', true),
    ],
    body: `${header('Consentimiento informado y prestación · Logopedia')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Motivo:** {{reason}}
**Evaluación prevista:** {{assessment}}
**Intervención prevista:** {{intervention}}
**Molestias o limitaciones:** {{risks}}
**Alternativas:** {{alternatives}}
**Frecuencia y duración:** {{sessions}}

## Información

Se me ha explicado el proceso de evaluación, los objetivos orientativos, la intervención y la revisión periódica. Comprendo que los resultados dependen de múltiples factores y que no se garantiza un resultado concreto. Puedo solicitar una pausa o revisar el plan.

## Seguimiento

Se documentarán la evaluación, las sesiones, los objetivos y la evolución. Se informará de la finalización o derivación cuando proceda.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-logo-coordinacion',
    name: 'Autorización de coordinación con familia, escuela y otros profesionales',
    category: 'logopedia',
    specialty: UserRole.LOGOPEDIA,
    description: 'Delimita la coordinación educativa, familiar y con otros profesionales.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('schoolName', 'Centro educativo', 'text', false),
      manual('schoolContact', 'Persona de contacto del centro', 'text', false),
      manual('otherProfessionals', 'Otros profesionales', 'textarea', false),
      manual('scope', 'Información autorizada', 'textarea', true),
      manual('purpose', 'Finalidad de la coordinación', 'textarea', true),
      manual('validUntil', 'Vigencia', 'date', false),
    ],
    body: `${header('Autorización de coordinación con familia, escuela y otros profesionales')}**Paciente:** {{patient.fullName}}
**Centro educativo:** {{schoolName || 'No procede'}} · **Contacto:** {{schoolContact || 'No indicado'}}
**Otros profesionales:** {{otherProfessionals || 'No indicados'}}
**Información autorizada:** {{scope}}
**Finalidad:** {{purpose}}
**Vigencia:** {{validUntil || 'Hasta revocación'}}

## Alcance

La coordinación se limitará a la información necesaria para la finalidad descrita. No se compartirá la historia clínica completa ni se ampliará el alcance sin nueva autorización. Las comunicaciones quedarán registradas.

## Revocación

La autorización es revocable por escrito. La revocación no afecta a las actuaciones previas ni a las obligaciones legales.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-logo-grabacion',
    name: 'Autorización para grabaciones de voz, vídeo o muestras de comunicación',
    category: 'logopedia',
    specialty: UserRole.LOGOPEDIA,
    description: 'Autorización específica para muestras de voz o comunicación con finalidad clínica.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      manual('material', 'Tipo de muestra', 'select', true, ['Audio', 'Vídeo', 'Muestra escrita', 'Comunicación multimodal']),
      manual('purpose', 'Finalidad clínica o docente', 'textarea', true),
      manual('storage', 'Conservación y acceso', 'text', true),
      manual('diffusion', 'Uso en docencia o difusión', 'select', true, ['No', 'Sí, con autorización separada']),
      manual('validUntil', 'Vigencia', 'date', false),
    ],
    body: `${header('Autorización para grabaciones de voz, vídeo o muestras de comunicación')}**Paciente:** {{patient.fullName}}
**Muestra:** {{material}}
**Finalidad:** {{purpose}}
**Conservación y acceso:** {{storage}}
**Docencia o difusión:** {{diffusion}}
**Vigencia:** {{validUntil || 'Hasta revocación'}}

## Condiciones

Las muestras se utilizarán para la evaluación, la intervención o el seguimiento descritos. Se almacenarán con acceso restringido y no se difundirán sin autorización separada. La revocación impedirá usos futuros.

${interpretationNote}${signBlock}`,
  }),

  seed({
    id: 'tpl-menor-representacion',
    name: 'Representación legal y consentimiento para atención a menores',
    category: 'menores',
    specialty: null,
    description: 'Identificación de progenitores o tutores, comprobación de representación y consentimiento adaptado.',
    version: 1,
    requiresSignature: true,
    signerRule: 'guardian_both',
    required: true,
    fields: [
      ...identityFields(),
      ...guardianFields(),
      auto('guardian2.name', 'Segundo representante legal', 'guardian2.name', false),
      auto('guardian2.dni', 'DNI del segundo representante', 'guardian2.dni', false),
      auto('representation.type', 'Tipo de representación', 'representation.type', false),
      manual('representationDocument', 'Documento acreditado', 'select', true, ['Libro de familia', 'Certificado de nacimiento', 'Resolución de tutela', 'Otro documento', 'No aportado']),
      manual('authorityScope', 'Alcance de la representación', 'textarea', true),
      manual('minorInfo', 'Información ofrecida al menor', 'textarea', true),
      manual('assent', 'Asentimiento del menor', 'select', true, ['Sí, documentado', 'No procede por edad/madurez', 'Pendiente de valorar']),
      manual('disagreement', 'Discrepancia o representación insuficiente', 'textarea', false),
    ],
    body: `${header('Representación legal y consentimiento para atención a menores')}**Menor:** {{patient.fullName}} · **Nacimiento:** {{patient.birthDate}}
**Representante 1:** {{guardian.name}} · {{guardian.dni}} · {{guardian.relationship}}
**Representante 2:** {{guardian2.name || 'No consta'}} · {{guardian2.dni || 'No consta'}}
**Tipo de representación:** {{representation.type || 'No consta'}}
**Documento acreditado:** {{representationDocument}}
**Alcance:** {{authorityScope}}

## Información y asentimiento

{{minorInfo}}
Asentimiento del menor: {{assent}}. La información y la participación se adaptarán a la edad y madurez.

## Comprobación de representación

No se presume que una única firma parental sea suficiente en todos los casos. Si la patria potestad es compartida, existe discrepancia o la documentación es insuficiente, se revisará el caso antes de continuar. Observaciones: {{disagreement || 'Sin incidencias registradas'}}.

## Límites

Este documento no sustituye una resolución judicial ni acredita por sí solo una tutela. El centro conservará la documentación comprobada y registrará las incidencias.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-menor-asentimiento',
    name: 'Asentimiento y participación del menor (adaptado a edad y madurez)',
    category: 'menores',
    specialty: null,
    description: 'Constancia de información y asentimiento del menor, sin sustituir la representación legal.',
    version: 1,
    requiresSignature: true,
    signerRule: 'guardian_or_patient_16',
    fields: [
      ...identityFields(),
      manual('minorAge', 'Edad del menor', 'text', true),
      manual('explanation', 'Explicación adaptada', 'textarea', true),
      manual('understanding', '¿Ha comprendido la información?', 'select', true, ['Sí', 'Parcialmente', 'No', 'Pendiente de valorar']),
      manual('assent', '¿Otorga asentimiento?', 'select', true, ['Sí', 'No', 'No procede']),
      manual('questions', 'Preguntas o comentarios', 'textarea', false),
    ],
    body: `${header('Asentimiento y participación del menor')}**Menor:** {{patient.fullName}} · **Edad:** {{minorAge}}
**Explicación adaptada:** {{explanation}}
**Comprensión:** {{understanding}}
**Asentimiento:** {{assent}}
**Preguntas o comentarios:** {{questions || 'Sin comentarios'}}

## Participación

Se ha informado al menor de forma adaptada a su edad y madurez. Su opinión se tendrá en cuenta. Este documento no sustituye el consentimiento de quien ejerza la representación legal cuando sea exigible.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-menor-patria-potestad',
    name: 'Comprobación documental de patria potestad o tutela',
    category: 'menores',
    specialty: null,
    description: 'Registro de la documentación comprobada y de las incidencias de representación.',
    version: 1,
    requiresSignature: true,
    signerRule: 'guardian_only',
    required: true,
    fields: [
      ...identityFields(),
      ...guardianFields(),
      manual('documentType', 'Documentación comprobada', 'select', true, ['Libro de familia', 'Certificado de nacimiento', 'Resolución de tutela', 'Poder notarial', 'Otro', 'No aportada']),
      manual('documentReference', 'Referencia o número', 'text', false),
      manual('holder', 'Persona que acredita la representación', 'text', true),
      manual('scope', 'Alcance y limitaciones', 'textarea', true),
      manual('verifiedBy', 'Persona que comprueba', 'text', true),
      manual('incidents', 'Incidencias', 'textarea', false),
    ],
    body: `${header('Comprobación documental de patria potestad o tutela')}**Menor:** {{patient.fullName}} · **Nacimiento:** {{patient.birthDate}}
**Representante:** {{guardian.name}} · {{guardian.dni}} · {{guardian.relationship}}
**Documentación:** {{documentType}} · {{documentReference || 'Sin referencia'}}
**Persona que acredita:** {{holder}}
**Alcance:** {{scope}}
**Comprobado por:** {{verifiedBy}}
**Incidencias:** {{incidents || 'Sin incidencias'}}

## Constancia

Se ha comprobado la documentación indicada y se conserva copia cuando procede. La comprobación no implica una valoración jurídica definitiva. Si la representación es compartida, existe discrepancia o falta documentación, se activará el procedimiento interno de revisión.

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-teleconsulta',
    name: 'Información y consentimiento para teleconsulta',
    category: 'general',
    specialty: null,
    description: 'Condiciones de la atención a distancia, identidad, privacidad, límites y alternativas.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('platform', 'Plataforma utilizada', 'text', true),
      manual('location', 'Lugar desde el que atiende el paciente', 'text', false),
      manual('limits', 'Límites de la teleconsulta', 'textarea', true),
      manual('emergency', 'Procedimiento ante urgencias', 'textarea', true),
      manual('alternatives', 'Alternativa presencial', 'textarea', true),
      manual('identityCheck', 'Verificación de identidad', 'text', true),
    ],
    body: `${header('Información y consentimiento para teleconsulta')}**Paciente:** {{patient.fullName}} · **DNI:** {{patient.dni}}
**Profesional:** {{professional.name}}
**Plataforma:** {{platform}}
**Lugar del paciente:** {{location || 'No indicado'}}
**Verificación de identidad:** {{identityCheck}}

## Condiciones

La teleconsulta se realiza por un canal acordado. El paciente debe encontrarse en un lugar privado y disponer de conexión suficiente. El profesional puede interrumpir la sesión si no se garantizan las condiciones de seguridad o privacidad.

## Límites y urgencias

{{limits}}
{{emergency}}

## Alternativa presencial

{{alternatives}}

${interpretationNote}${signBlock}`,
  }),
  seed({
    id: 'tpl-finalizacion',
    name: 'Documento de finalización y entrega de información',
    category: 'general',
    specialty: null,
    description: 'Constancia de cierre del proceso, información entregada y documentación disponible.',
    version: 1,
    requiresSignature: true,
    signerRule: 'patient_adult',
    fields: [
      ...identityFields(),
      auto('professional.name', 'Profesional responsable', 'professional.name'),
      manual('reason', 'Motivo de finalización', 'textarea', true),
      manual('summary', 'Resumen de la información entregada', 'textarea', true),
      manual('pending', 'Seguimiento o derivación', 'textarea', false),
      manual('documents', 'Documentos entregados', 'textarea', true),
    ],
    body: `${header('Documento de finalización y entrega de información')}**Paciente:** {{patient.fullName}}
**Profesional:** {{professional.name}}
**Motivo de finalización:** {{reason}}
**Información entregada:** {{summary}}
**Seguimiento o derivación:** {{pending || 'No procede'}}
**Documentos entregados:** {{documents}}

## Constancia

Se deja constancia de la finalización del proceso y de la información entregada. La historia clínica se conservará según la política del centro y la normativa aplicable. El paciente puede solicitar la documentación que le corresponda.

${interpretationNote}${signBlock}`,
  }),
];

// ============================================================
//  Utilidades
// ============================================================

export const categoryMeta = (category: DocumentCategory) =>
  DOCUMENT_CATEGORIES.find(c => c.id === category) || DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];

export const templateIsUsable = (template: DocumentTemplate): boolean =>
  template.active && template.legalStatus === 'aprobada';

export const templateFieldValue = (
  field: DocumentTemplateField,
  values: Record<string, any>,
): any => {
  const value = values[field.key];
  if (field.type === 'checkbox') return !!value;
  return value;
};

export const resolveRepresentationLabel = (type?: string | null): string => {
  const map: Record<string, string> = {
    patria_potestad_conjunta: 'Patria potestad conjunta',
    patria_potestad_exclusiva: 'Patria potestad exclusiva',
    tutela: 'Tutela',
    acogimiento: 'Acogimiento',
    otro: 'Otra representación',
    no_consta: 'No consta',
  };
  return type ? (map[type] || type) : 'No consta';
};

const patientAge = (birthDate?: string): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

/** Construye los valores automáticos sin inventar datos ausentes. */
export const buildAutoValues = (params: {
  patient: Patient;
  professional?: User | null;
  center: any;
  serviceName?: string | null;
  documentVersion?: number | null;
}): Record<string, any> => {
  const { patient, professional, center, serviceName, documentVersion } = params;
  const g = patient.legalGuardian;
  const g2 = patient.secondaryLegalGuardian;
  return {
    'patient.fullName': patientFullName(patient),
    'patient.firstName': patient.firstName,
    'patient.lastName': patient.lastName,
    'patient.dni': patient.dni,
    'patient.birthDate': patient.birthDate ? formatDate(patient.birthDate) : '',
    'patient.age': patientAge(patient.birthDate) != null ? String(patientAge(patient.birthDate)) : '',
    'patient.address': patient.address,
    'patient.phone': patient.phone,
    'patient.email': patient.email,
    'guardian.name': g?.name || '',
    'guardian.dni': g?.dni || '',
    'guardian.phone': g?.phone || '',
    'guardian.email': g?.email || '',
    'guardian.relationship': g?.relationship || '',
    'guardian2.name': g2?.name || '',
    'guardian2.dni': g2?.dni || '',
    'guardian2.phone': g2?.phone || '',
    'guardian2.email': g2?.email || '',
    'guardian2.relationship': g2?.relationship || '',
    'representation.type': resolveRepresentationLabel(patient.representationType),
    'professional.name': professional?.name || '',
    'professional.email': professional?.email || '',
    'professional.phone': professional?.phone || '',
    'service.name': serviceName || '',
    'center.name': center?.centerName || CENTER_NAME,
    'center.legalName': center?.legalName || CENTER_LEGAL_NAME,
    'center.cif': center?.cif || '',
    'center.address': center?.address || '',
    'center.phone': center?.phone || CENTER_PHONE,
    'center.email': center?.email || CENTER_EMAIL,
    'center.dpoName': center?.documentSettings?.dpoName || '',
    'center.dpoEmail': center?.documentSettings?.dpoEmail || center?.documentSettings?.privacyEmail || '',
    'document.date': formatDate(new Date().toISOString()),
    'document.version': documentVersion ? `v${documentVersion}` : 'v1',
  };
};

const truthy = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '' && !['false', 'no', '0', 'no procede'].includes(value.trim().toLowerCase());
  return !!value;
};

/** Resuelve condicionales simples sin evaluar código. */
const resolveConditionals = (text: string, values: Record<string, any>): string => {
  let output = text;
  let guard = 0;
  while (guard < 30 && (output.includes('{{#if') || output.includes('{{#unless'))) {
    guard += 1;
    let changed = false;

    output = output.replace(/\{\{#if\s+([\w.]+)(?:=([^}]+))?\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, expected, content) => {
      changed = true;
      const raw = values[key];
      const ok = expected !== undefined
        ? String(raw ?? '').trim().toLowerCase() === String(expected).trim().toLowerCase()
        : truthy(raw);
      return ok ? content : '';
    });

    output = output.replace(/\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_match, key, content) => {
      changed = true;
      return truthy(values[key]) ? '' : content;
    });

    if (!changed) break;
  }
  return output;
};

export interface RenderedTemplate {
  text: string;
  missingRequired: string[];
  values: Record<string, any>;
  placeholderKeys: string[];
}

/** Renderiza la plantilla a texto plano seguro (sin HTML ejecutable). */
export const renderTemplate = (
  template: DocumentTemplate,
  values: Record<string, any>,
): RenderedTemplate => {
  const merged = { ...values };
  const missingRequired: string[] = [];
  for (const field of template.fields) {
    if (field.autoFill) continue;
    if (field.required && !truthy(merged[field.key])) {
      missingRequired.push(field.label);
    }
  }
  // Los campos automáticos obligatorios no se pueden sustituir por texto inventado.
  for (const field of template.fields) {
    if (!field.autoFill || !field.required) continue;
    if (!truthy(merged[field.key])) missingRequired.push(field.label);
  }

  const placeholderKeys = Array.from(new Set(
    Array.from(template.body.matchAll(/\{\{\s*([\w.]+)/g)).map(m => m[1]),
  ));

  let text = resolveConditionals(template.body, merged);
  text = text.replace(/\{\{\s*([\w.]+)(?:\s*\|\|\s*'([^']*)')?\s*\}\}/g, (_match, key, fallback) => {
    const value = merged[key];
    const field = template.fields.find(f => f.key === key);
    if (field?.type === 'checkbox') return truthy(value) ? '☑' : '☐';
    if (value === undefined || value === null || value === '') return fallback ?? '';
    return String(value);
  });

  // Si el texto contiene una línea de casilla seguida de un campo vacío, conserva
  // el marcador vacío para que el documento sea legible y revisable.
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

  if (template.requiresSignature) {
    text += `\n\n---\n\nDocumento generado desde la plantilla «${template.name}» · versión ${template.version}.`;
  }

  return { text, missingRequired, values: merged, placeholderKeys };
};

export const defaultDocumentSettings = (): DocumentSettings => ({ ...DEFAULT_DOCUMENT_SETTINGS });

export const isMinorAge = (birthDate?: string): boolean => {
  const age = patientAge(birthDate);
  return age !== null && age < 18;
};

export const ageFromBirthDate = patientAge;

/** Condiciones de firma que deben recogerse para una regla y paciente. */
export const suggestedSignerConditions = (
  template: DocumentTemplate,
  patient: Patient,
): { condition: SignatureCondition; required: boolean; reason: string }[] => {
  const minor = isMinorAge(patient.birthDate);
  const age = patientAge(patient.birthDate);
  const g = patient.legalGuardian;
  const g2 = patient.secondaryLegalGuardian;

  switch (template.signerRule) {
    case 'guardian_only':
      return [{ condition: 'representante_legal', required: true, reason: 'La plantilla exige representación legal.' }];
    case 'guardian_both':
      return [
        { condition: 'representante_legal', required: true, reason: 'Primer representante legal.' },
        ...(g2 ? [{ condition: 'representante_legal_2' as SignatureCondition, required: true, reason: 'Segundo representante legal registrado.' }] : []),
      ];
    case 'patient_and_guardian':
      return [
        { condition: 'paciente', required: true, reason: 'Firma del paciente.' },
        { condition: 'representante_legal', required: true, reason: 'Firma del representante legal.' },
      ];
    case 'guardian_or_patient_16':
      if (minor) {
        return [
          { condition: 'representante_legal', required: true, reason: 'Paciente menor de edad.' },
          ...(age !== null && age >= 16 ? [{ condition: 'paciente' as SignatureCondition, required: true, reason: 'Valorar asentimiento/firma del menor desde 16 años.' }] : []),
        ];
      }
      return [{ condition: 'paciente', required: true, reason: 'Paciente adulto.' }];
    case 'patient_adult':
      if (minor) {
        return g
          ? [
              { condition: 'representante_legal', required: true, reason: 'Paciente menor: firma el representante legal.' },
              ...(g2 ? [{ condition: 'representante_legal_2' as SignatureCondition, required: false, reason: 'Segundo representante registrado; valorar representación compartida.' }] : []),
            ]
          : [{ condition: 'representante_legal', required: true, reason: 'Falta representante legal en la ficha.' }];
      }
      return [{ condition: 'paciente', required: true, reason: 'Paciente adulto.' }];
    case 'manual':
    default:
      return [{ condition: 'paciente', required: true, reason: 'Revisa y ajusta la condición de firma.' }];
  }
};

export const signerNameForCondition = (patient: Patient, condition: SignatureCondition): string => {
  if (condition === 'representante_legal') return patient.legalGuardian?.name || '';
  if (condition === 'representante_legal_2' || condition === 'tutor') return patient.secondaryLegalGuardian?.name || patient.legalGuardian?.name || '';
  return patientFullName(patient);
};

export const signerEmailForCondition = (patient: Patient, condition: SignatureCondition): string => {
  if (condition === 'representante_legal') return patient.legalGuardian?.email || '';
  if (condition === 'representante_legal_2' || condition === 'tutor') return patient.secondaryLegalGuardian?.email || patient.legalGuardian?.email || '';
  return patient.email;
};

export const specialtyLabelForDocument = (specialty?: ClinicalSpecialty | null): string => {
  if (!specialty) return 'Transversal';
  const map: Record<string, string> = {
    [UserRole.PSICOLOGIA]: 'Psicología',
    [UserRole.FISIOTERAPIA]: 'Fisioterapia',
    [UserRole.LOGOPEDIA]: 'Logopedia',
    [UserRole.NUTRICION]: 'Nutrición',
  };
  return map[specialty] || specialty;
};
