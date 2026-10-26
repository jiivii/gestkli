# Sinestesya Salud Integral

Aplicación de gestión clínica y administrativa para un centro multidisciplinar con cuatro especialidades y un perfil de administración:

- **Psicología** · amarillo
- **Fisioterapia** · verde
- **Logopedia** · azul
- **Nutrición** · naranja
- **Administración** · neutro

Cada profesional entra en su propio espacio de trabajo, ve su agenda y sus pacientes asignados, y registra únicamente la historia clínica de su especialidad. Administración gestiona la ficha administrativa única, la agenda global, facturación, cobros, gastos, bonos y estadísticas, pero **no puede leer notas clínicas** salvo autorización expresa y justificada.

> **Aviso de demostración:** si no hay Supabase configurado o si `VITE_DEMO_MODE=true`, la app arranca en modo local con datos ficticios marcados como demo. No introduzcas datos de pacientes reales en ese modo. Los datos viven solo en el navegador.

---

## 1. Stack

- React 19 + TypeScript + Vite
- React Router 7
- Tailwind CSS (CDN con tema propio)
- Recharts
- Supabase (Auth, Postgres, RLS)
- Funciones serverless de Vercel para la gestión segura de perfiles (`/api/profiles`)
- Impresión de informes y facturas mediante ventana/iframe del navegador

---

## 2. Puesta en marcha

### Requisitos

- Node.js 18 o superior
- npm
- Un proyecto de Supabase para el modo producción

### Instalación

```bash
npm install
npm run dev
```

La app queda disponible en `http://127.0.0.1:5173`.

### Scripts

```bash
npm run dev        # servidor de desarrollo
npm run typecheck  # comprobación de TypeScript
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve la build
```

Los scripts usan binarios locales de `node_modules` para evitar problemas con `npx` en Windows/PowerShell.

---

## 3. Modo demostración

Se activa automáticamente cuando **no** existen credenciales válidas de Supabase, o de forma forzada con:

```env
VITE_DEMO_MODE=true
```

Características:

- Todos los registros van marcados con `demo: true`.
- Banner permanente de advertencia en la cabecera.
- Sesión y datos en `localStorage` (`sinestesya_demo_v1`).
- Password de demostración: **`demo`**.

### Accesos de demostración

| Perfil | Email | Contraseña |
| --- | --- | --- |
| Administración | `admin@sinestesya.es` | `demo` |
| Psicología | `psicologia@sinestesya.es` | `demo` |
| Fisioterapia | `fisioterapia@sinestesya.es` | `demo` |
| Logopedia | `logopedia@sinestesya.es` | `demo` |
| Nutrición | `nutricion@sinestesya.es` | `demo` |

Para volver al estado inicial de la demo, elimina `sinestesya_demo_v1` y `sinestesya_demo_session` de `localStorage` y recarga.

---

## 4. Variables de entorno

Crea `.env.local` en la raíz:

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_DEMO_MODE=false
```

En Vercel, además, la función de perfiles necesita variables **sin** el prefijo `VITE_` (nunca se exponen al navegador):

```env
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> La `service_role` solo debe existir en el entorno del servidor. No la incluyas en el frontend ni en el repositorio.

---

## 5. Configuración de Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta completo `supabase/sinestesya_setup.sql`.
   - El script es idempotente: puede ejecutarse más de una vez.
   - Crea tablas, índices, funciones de autorización, políticas RLS, triggers de auditoría y el esquema de mensajería.
3. Crea el primer usuario administrador en **Authentication → Users** y asígnale el perfil:

```sql
insert into public.profiles (id, full_name, email, role, profession, active)
select id, 'Administración', email, 'admin', null, true
from auth.users
where email = 'admin@tu-centro.es'
on conflict (id) do update
set role = 'admin', profession = null, active = true;
```

4. A partir de ahí, el resto de perfiles pueden crearse desde **Profesionales → Nuevo perfil**. En producción esta acción llama a `/api/profiles` y requiere las variables de servidor indicadas arriba.

### Tablas principales

`profiles`, `patients`, `patient_professionals`, `medical_history`, `services`, `clinic_rooms`, `appointments`, `clinical_records`, `invoices`, `payments`, `expenses`, `cash_closings`, `session_packages`, `consents`, `audit_log`, `notifications`, `center_settings`, `rooms`, `room_participants`, `messages`, `reservation_requests`, `ai_conversations`.

Notas:

- La historia clínica vive en `clinical_records` con `specialty` + `data` JSONB.
- Las salas físicas están en `clinic_rooms`; las salas de chat en `rooms`.
- `audit_log` tiene un trigger que bloquea `UPDATE` y `DELETE`.
- No existe política de borrado clínico: las correcciones se guardan como nuevas versiones.

---

## 6. Perfiles y permisos

### Administración (por defecto)

Agenda global, pacientes, creación/edición de fichas administrativas, asignación de profesionales, facturación y cobros, servicios y tarifas, salas, informes, profesionales, configuración, auditoría, consentimientos y mensajería.

**No incluye** acceso a historias clínicas. Para concederlo hay que añadir el permiso `clinical.view.all` desde **Profesionales → Permisos**, escribir una justificación y guardar. La concesión queda auditada.

### Perfiles clínicos (por defecto)

- Agenda propia y gestión de sus citas.
- Pacientes asignados.
- Historia y registro de **su** especialidad.
- Consentimientos y mensajería interna.

No ven otras especialidades salvo que se les conceda `clinical.view.all` de forma expresa. Aunque lo tengan, el acceso es de solo lectura fuera de su especialidad.

### Pendiente

Cuenta creada sin especialidad asignada. No tiene acceso clínico ni administrativo hasta que administración le asigne un perfil.

### Matriz resumida

| Capacidad | Admin | Clínico | Pendiente |
| --- | --- | --- | --- |
| Agenda global | Sí | No | No |
| Agenda propia | — | Sí | No |
| Ficha administrativa | Sí | Pacientes asignados | No |
| Historia de su especialidad | Con permiso | Sí | No |
| Historia de otras especialidades | Solo `clinical.view.all` | Solo `clinical.view.all` | No |
| Facturación y cobros | Sí | No | No |
| Servicios, tarifas y salas | Sí | No | No |
| Profesionales y permisos | Sí | No | No |
| Auditoría | Sí | No | No |
| Mensajería interna | Sí | Sí | No |

---

## 7. Flujo clínico

1. Administración crea o acepta la ficha administrativa del paciente.
2. Asigna una o varias especialidades/profesionales.
3. El profesional ve al paciente en **Mis pacientes** y en su agenda.
4. Registra valoración o sesión desde **Herramientas clínicas**.
5. El estado de la cita avanza de forma trazable:
   `reservada → realizada → registro clínico completado → factura emitida → factura pagada`.
6. El informe se genera desde los registros seleccionados y se imprime/guarda como PDF con el diálogo del navegador.
7. Administración factura y cobra sin acceder al contenido clínico.

### Campos por especialidad

- **Fisioterapia:** EVA, mapa corporal anterior/posterior, localización y características del dolor, exploración física, diagnóstico fisioterapéutico, técnicas, ejercicios y respuesta.
- **Nutrición:** antropometría completa, pliegues, paciente pediátrico, historia dietética, plan alimentario versionado, adherencia, síntomas y ajustes.
- **Logopedia:** áreas de evaluación, exploración descriptiva, pruebas, objetivos con resultados medibles (aciertos/ensayos/ayuda), actividades, materiales, tareas y coordinación.
- **Psicología:** entrevista, formulación, antecedentes, contexto, plan, técnicas, tareas, evolución, riesgo y banco de pruebas psicométricas (solo metadatos y resultados; sin ítems ni claves de corrección).

---

## 8. Agenda, facturación y administración

- Agenda diaria y próximas citas, vista global para administración y personal para cada profesional.
- Servicios con duración, precio, IVA y sala; salas físicas independientes del chat.
- Citas recurrentes semanales, detección de solapamientos, cancelaciones y ausencias.
- Facturas con líneas de servicio, IVA, vencimiento, estados y pagos parciales.
- Cobros por efectivo, tarjeta, transferencia y Bizum; devoluciones.
- Cierre de caja diario con fondo inicial, efectivo contado, diferencia y notas.
- Gastos y proveedores, bonos de sesiones con consumo trazable.
- Informes de actividad, ocupación, rentabilidad y calidad administrativa.
- Exportación CSV para asesoría con separador `;` y BOM UTF-8.
- Solicitudes web con aceptación, creación o vinculación de ficha y detección de duplicados por teléfono/email/DNI.

---

## 9. Seguridad, privacidad y cumplimiento

Implementado en la aplicación:

- Autenticación Supabase y sesión con perfil activo.
- Permisos granulares en frontend y RLS en base de datos.
- Separación de especialidades en lectura y escritura.
- Acceso clínico de administración solo con permiso explícito y justificación auditada.
- Registro de auditoría de accesos y modificaciones, sin edición ni borrado desde la app.
- Protección de menores: representante legal, consentimientos y avisos.
- Versionado de registros clínicos.
- Copias de seguridad: verificación registrada y guía de restauración; la copia real se configura en Supabase/proveedor.
- Modo demo aislado y claramente señalizado.

Antes de usar datos reales:

- Revisar la base legal, información al paciente y consentimientos con un DPO/asesor legal.
- Aprobar una evaluación de impacto (DPIA) si corresponde.
- Definir política de retención, minimización y derechos de acceso/supresión.
- Configurar copias automáticas, prueba de restauración y control de accesos al proyecto Supabase.
- Revisar la política de contraseñas, MFA y bajas de personal.
- **No activar asistentes de IA clínica** sin una evaluación de privacidad previa. En esta versión la IA está desactivada y no aparece en la navegación.

Este repositorio no sustituye la revisión legal ni certifica por sí solo el cumplimiento del RGPD/LOPDGDD.

---

## 10. Estructura del proyecto

```text
App.tsx                  rutas y guardas de acceso
types.ts                 modelo de dominio
constants.ts             roles, colores, etiquetas y utilidades
services/dbService.ts    API unificada demo/Supabase
services/permissions.ts  permisos base, guardas y mapa de rutas
services/demoStore.ts    datos y sesión de demostración
pages/                   pantallas de la aplicación
components/clinical/     campos, evolución e informes clínicos
components/ui.tsx        componentes compartidos
api/profiles.js          función serverless de perfiles
supabase/                esquema SQL, RLS y auditoría
public/                  manifest, service worker e iconos PWA
```

---

## 11. Despliegue

### Vercel

1. Importa el repositorio.
2. Configura las variables de entorno del apartado 4.
3. Build: `npm run build`; salida: `dist`.
4. Despliega la función `api/profiles.js` junto al frontend.
5. Si usas rutas limpias en lugar de hash, añade una reescritura SPA hacia `index.html`. La app usa `HashRouter`, por lo que no es imprescindible.

### Checklist mínimo antes de producción

- [ ] `npm run typecheck` sin errores.
- [ ] `npm run build` correcto.
- [ ] SQL ejecutado en Supabase y RLS comprobado con dos usuarios distintos.
- [ ] Primer admin creado y resto de perfiles invitados.
- [ ] `VITE_DEMO_MODE=false` y credenciales reales.
- [ ] Copia de seguridad y restauración probadas.
- [ ] Aviso legal, privacidad, consentimientos y DPIA revisados.
- [ ] Flujo completo probado: cita → registro → factura → cobro → cierre de caja.
- [ ] Acceso clínico de administración denegado por defecto.

---

## 12. Limitaciones conocidas

- Tailwind se carga por CDN para simplificar el piloto; para producción a gran escala conviene compilarlo y aplicar una CSP estricta.
- Los informes y facturas se imprimen con el diálogo del navegador; el usuario debe elegir “Guardar como PDF”.
- El banco psicométrico guarda metadatos y resultados, no ítems ni claves sujetas a licencia.
- Los adjuntos clínicos están deshabilitados hasta configurar almacenamiento privado y sus permisos.
- La IA clínica está fuera de la navegación y desactivada por defecto.
- El modo demo no es un entorno multiusuario ni debe usarse con datos reales.
