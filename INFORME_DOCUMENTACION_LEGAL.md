# Informe de implementación: módulo de documentación legal, protección de datos y firma electrónica

## 1. Resumen ejecutivo

Se ha implementado un módulo integrado de documentación legal y consentimientos dentro de la ficha de cada paciente. El módulo reutiliza la arquitectura existente de Sinestesya: autenticación, roles, pacientes, expediente, permisos, configuración del centro, auditoría y almacenamiento.

El sistema incluye:

- Sección «Documentación y consentimientos» en la ficha del paciente.
- Gestor de plantillas para administradores autorizados.
- Biblioteca inicial de plantillas legales, clínicas y de privacidad.
- Generación de documentos personalizados con auto-rellenado.
- Revisión previa al envío.
- Envío de enlaces seguros de firma por correo.
- Portal público de firma desde móvil o escritorio.
- Archivo del PDF firmado y sus evidencias.
- Historial de estados, eventos e incidencias.
- Revocación, renovación y nuevas versiones con trazabilidad.
- Carga de documentos firmados externamente con verificación de integridad.
- Configuración de DPO, proveedor de firma, caducidad de enlaces y OTP.

La implementación está orientada a producción, pero **no debe declararse válida jurídicamente** hasta completar la revisión legal y la integración real del proveedor de firma. La firma actual en demo es simple y sin validez jurídica.

## 2. Funcionalidades implementadas

### 2.1 Documentación por paciente

Archivo: `components/documents/PatientDocumentsPanel.tsx`

Funcionalidades:

- Listado de todos los documentos del paciente.
- Filtros por categoría, estado y texto.
- Contadores de firmados, pendientes, revisión, alertas y enlaces caducados.
- Alerta de documentos obligatorios pendientes.
- Botón de generación.
- Botón de envío a firma.
- Botón de carga de documento firmado externamente.
- Vista previa y descarga.
- Detalle y evidencias.
- Revocación y nueva versión.
- Control de permisos por documento, especialidad y rol.

### 2.2 Gestor de plantillas

Archivo: `pages/DocumentTemplates.tsx`

Funcionalidades:

- Listado y filtro por categoría, estado y texto.
- Creación de plantillas sin modificar código.
- Edición de plantillas pendientes en su lugar.
- Creación de nueva versión pendiente cuando se edita una plantilla aprobada.
- Activación y desactivación.
- Flujo de aprobación con revisor y fecha.
- Vista previa con datos de ejemplo.
- Advertencias de impacto sobre documentos ya generados.
- Metadatos de categoría, especialidad, obligatoriedad, firma, regla de firmantes y campos.

### 2.3 Motor de plantillas

Archivo: `services/documentTemplates.ts`

Características:

- Cuerpo de texto seguro en Markdown simple.
- Placeholders `{{key}}`.
- Fallbacks `{{key || 'texto'}}`.
- Bloques condicionales `{{#if key}}...{{/if}}`.
- Bloques negativos `{{#unless key}}...{{/unless}}`.
- Sin HTML ejecutable ni código.
- Auto-rellenado desde paciente, profesional, centro y documento.
- Solicitud de datos obligatorios antes de generar.
- Reglas de firma por condición: paciente adulto, representante legal, ambos representantes, menor desde 16 años, manual.

### 2.4 Biblioteca inicial de plantillas

Se han creado aproximadamente 21 plantillas iniciales en categorías:

- Privacidad y protección de datos.
- Psicología.
- Fisioterapia.
- Nutrición.
- Logopedia.
- Menores.
- Comunicaciones y coordinación.
- Teleconsulta.
- Informes y cierre.

Los estados iniciales son `pendiente_revision`. Solo las plantillas `aprobada` y activas son utilizables.

### 2.5 Generación de documentos

Archivo: `services/documentService.ts`

Funcionalidades:

- Creación de borrador.
- Validación de datos obligatorios.
- Marcado como listo para enviar.
- Vista previa exacta.
- Entrega informativa sin firma.
- Nueva versión preservando trazabilidad.
- Auto-rellenado de centro, paciente, profesional y firma.
- Hash de integridad sobre el contenido material del documento.

### 2.6 Firma remota

Archivos:

- `pages/SignDocument.tsx`
- `api/document-signing.js`
- `services/documentService.ts`

Funcionalidades:

- Enlace individual por firmante.
- Token hasheado con SHA-256.
- Caducidad configurable entre 1 y 168 horas.
- OTP con HMAC-SHA256.
- Sesión de verificación con token separado y caducidad.
- Lectura completa del documento antes de firmar.
- Descarga del documento antes de firmar.
- Confirmaciones de lectura, identidad y autoridad.
- Firma o rechazo.
- Justificante tras la firma.
- Copia descargable hasta la caducidad del enlace.
- Revocación de enlaces anteriores al reenviar.

### 2.7 API de producción

Archivo: `api/document-signing.js`

Endpoints:

- `capabilities`
- `send`
- `revoke`
- `download`
- `upload-signed`
- `public-preview`
- `public-request-otp`
- `public-verify-otp`
- `public-document`
- `public-sign`
- `public-reject`

Características:

- Validación de permisos.
- Validación de plantilla aprobada y activa.
- Validación de representación legal.
- Rate limiting de OTP.
- Límite de intentos.
- Verificación de integridad del contenido.
- Generación de PDF desde snapshot.
- Subida a Storage privado.
- Registro de eventos y auditoría.
- Manejo fail-closed si falta correo o proveedor.

### 2.8 Archivo y trazabilidad

Funcionalidades:

- PDF firmado archivado en la ficha del paciente.
- Identificador único del documento.
- Paciente y expediente asociados.
- Tipo, categoría, especialidad y versión de plantilla.
- Fechas de generación, envío y firma.
- Identidad declarada y método de verificación.
- Condición del firmante.
- Evidencias y certificado cuando existan.
- Hash SHA-256 del contenido y del PDF final.
- Historial de eventos.
- Revocación y sustitución.
- Nueva versión sin sobrescribir el documento firmado.

### 2.9 Carga externa

Funcionalidades:

- Subida de PDF firmado externamente.
- Límite de 3 MB por restricción de Vercel.
- Cálculo y verificación de SHA-256 en servidor.
- Clasificación por tipo y especialidad.
- Registro como evidencia externa.

## 3. Seguridad implementada

### 3.1 Control de acceso

- Roles: `admin`, `fisioterapia`, `nutricion`, `logopedia`, `psicologia`, `pendiente`.
- Permisos explícitos.
- Administración clínica requiere `clinical.view.all`, justificación y auditoría.
- Documentos clínicos visibles solo por especialidad o administradores autorizados.
- Plantillas transversales visibles según rol.
- Descargas y envíos protegidos por permisos.

### 3.2 Identidad y firma

- Enlaces únicos e impredecibles.
- Hash SHA-256 del token en base de datos.
- Caducidad configurable.
- Revocación.
- OTP con HMAC-SHA256.
- Sesión de firma separada con token hasheado.
- Comparación segura de OTP.
- No se considera que el correo demuestre identidad por sí solo.
- La firma demo se etiqueta como sin validez jurídica.

### 3.3 Integridad documental

- Hash de contenido estable desde generación hasta firma.
- Verificación antes de firmar.
- PDF generado desde snapshot almacenado.
- Hash del PDF final.
- Evidencias de firma en el PDF.
- Documentos firmados no se editan silenciosamente.
- Nueva versión para correcciones.

### 3.4 Privacidad

- No se envían diagnósticos ni datos clínicos innecesarios por correo.
- El correo solo contiene enlace y datos mínimos.
- Los datos del firmante se enmascaran en eventos.
- Separación entre documentos administrativos y clínicos.
- Configuración de DPO, correo de privacidad y aviso de privacidad.
- AI deshabilitada hasta evaluación de privacidad.

### 3.5 Auditoría

- Registro de generación, envío, acceso, firma, rechazo, revocación, descarga y errores.
- Actor, fecha, tipo y metadatos.
- Eventos por documento.

### 3.6 Almacenamiento

- Bucket privado `patient-documents`.
- Rutas por paciente y documento.
- PDFs firmados y parciales.
- Evidencias de carga externa.
- SQL con RLS y trigger de inmutabilidad.

## 4. Pruebas realizadas

### 4.1 Automáticas

- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: correcto.
- Advertencia no bloqueante: tamaño del bundle principal (>1.6 MB).

### 4.2 Manuales en demo

Verificado:

1. Aprobación y activación de plantillas.
2. Generación de documento con auto-rellenado.
3. Revisión previa al envío.
4. Envío de enlace de firma.
5. Firma de paciente adulto.
6. Descarga de PDF firmado.
7. Consulta de detalle y evidencias.
8. Integridad verificada en el detalle.
9. Rechazo de OTP incorrecto.
10. Rechazo de enlace caducado.
11. Rechazo de enlace revocado.
12. Filtrado de plantillas por rol/especialidad para administrador sin acceso clínico.
13. Validación de representación legal en menor con plantilla `guardian_both`.
14. Generación de nueva versión y sustitución de enlaces al reenviar.

No verificado manualmente de extremo a extremo:

- Flujo completo en Supabase real.
- Envío real por correo.
- Firma real con proveedor externo.
- Carga externa de PDF.
- Recuperación desde copia de seguridad.
- Pruebas de permisos con usuarios no admin.
- Inmutabilidad del documento firmado mediante trigger SQL.
- Archivado cross-patient en base de datos real.

## 5. Integraciones necesarias para producción

### 5.1 Supabase

Configurar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Aplicar:

- `supabase/sinestesya_setup.sql`
- Bucket privado `patient-documents`
- Políticas RLS
- Trigger de inmutabilidad

### 5.2 Correo transaccional

Configurar:

- `RESEND_API_KEY`
- `DOCUMENT_EMAIL_FROM`

Sin estas variables, el envío falla con 503 por diseño.

### 5.3 Firma electrónica

Opciones:

- `SIGNATURE_PROVIDER=local_otp`: firma simple verificada por OTP.
- `SIGNATURE_PROVIDER=external`: requiere adaptador real y certificado.
- `SIGNATURE_PROVIDER=demo`: solo desarrollo con `ALLOW_DEMO_SIGNING=true`.

Variables:

- `DOCUMENT_SIGNING_SECRET`
- `DOCUMENT_PUBLIC_URL`
- `SIGNATURE_PROVIDER`
- `SIGNATURE_ASSURANCE`
- `SIGNATURE_PROVIDER_LABEL`
- `SIGNATURE_PROVIDER_CREATE_URL`
- `SIGNATURE_PROVIDER_API_KEY`

### 5.4 Despliegue

- Ejecutar `npm.cmd run typecheck`.
- Ejecutar `npm.cmd run build`.
- Publicar en Vercel o entorno equivalente.
- Configurar variables de entorno.
- Ejecutar SQL en Supabase.
- Probar flujo completo en staging antes de producción.

## 6. Limitaciones actuales

- El proveedor externo de firma avanzada/cualificada no está integrado.
- El envío externo devuelve 503 de forma segura.
- La firma demo no tiene validez jurídica.
- El estado de demo es local al navegador.
- La carga externa está limitada a 3 MB por Vercel.
- Los documentos firmados son inmutables a nivel SQL, pero la aplicación no impide todos los intentos de edición en demo.
- La comodidad de uso no debe prevalecer sobre la seguridad.
- Algunas plantillas siguen pendientes de revisión jurídica.
- No se ha realizado una evaluación de impacto en protección de datos.
- No se han validado copias de seguridad ni recuperación.

## 7. Requisitos legales pendientes de validación profesional

Antes de producción, revisar con profesionales competentes:

- Texto completo de todas las plantillas.
- Base jurídica del tratamiento de datos sanitarios.
- Distinción entre información, base jurídica y consentimiento opcional.
- Reglas de representación legal por documento, edad y capacidad.
- Firma de uno o ambos progenitores según el caso.
- Consentimiento de menores y asentimiento.
- Autorizaciones de imagen, voz, vídeo y comunicaciones.
- Teleconsulta y coordinación con terceros.
- Plazos de conservación y eliminación.
- Contratos con proveedores que traten datos personales.
- Política de incidentes y brechas.
- Evaluación de impacto en protección de datos.
- Separación administrativa/clínica.
- Validación de que no se afirma validez cualificada sin proveedor adecuado.
- Adaptación a la normativa de Aragón y a la Ley 41/2002.

## 8. Conclusión

El módulo está implementado como funcionalidad integrada, no como maqueta. Cumple los requisitos técnicos principales: generación, revisión, envío, firma remota, archivo, trazabilidad, estados, revocación, versionado y carga externa.

Antes de producción es obligatorio:

1. Configurar Supabase y correo real.
2. Integrar o contratar un proveedor de firma adecuado.
3. Revisar jurídicamente todas las plantillas.
4. Validar reglas de representación legal.
5. Realizar pruebas de seguridad y recuperación.
6. Ejecutar el flujo completo en staging.
7. No declarar firmas como cualificadas salvo acreditación real.

Prioridad absoluta: privacidad, integridad documental, identificación del firmante, representación legal y trazabilidad.
