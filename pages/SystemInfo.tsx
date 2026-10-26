import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, CloudOff, Copy, Database, HardDrive,
  LockKeyhole, Server, ShieldCheck, Sparkles, Terminal,
} from 'lucide-react';
import { ACCOUNTING_SQL, SINESTESYA_SQL } from '../constants';
import { CenterSettings } from '../types';
import { dbService, isDemoMode } from '../services/dbService';
import {
  Badge, InlineAlert, PageHeader, SectionCard, StatCard, btnPrimary, btnSecondary,
  cardClass,
} from '../components/ui';

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copiar SQL' }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para navegadores sin permiso de portapapeles.
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button onClick={copy} className={btnSecondary}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? 'Copiado' : label}
    </button>
  );
};

const SqlBlock: React.FC<{ sql: string; tone?: string }> = ({ sql, tone = 'text-emerald-200' }) => (
  <pre className={`max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-stone-950 p-4 font-mono text-[11px] leading-relaxed ${tone}`}>
    {sql}
  </pre>
);

const SystemInfo: React.FC = () => {
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loadError, setLoadError] = useState('');

  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  const forceDemo = String(import.meta.env?.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  useEffect(() => {
    let mounted = true;
    dbService.getSettings()
      .then(cfg => { if (mounted) setSettings(cfg); })
      .catch((e: any) => { if (mounted) setLoadError(e?.message || 'No se pudo leer la configuración del centro.'); });
    return () => { mounted = false; };
  }, []);

  const checklist = [
    {
      ok: !isDemoMode,
      title: 'Backend de producción configurado',
      detail: isDemoMode
        ? 'La app funciona en modo demostración local. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y desactiva VITE_DEMO_MODE.'
        : 'Supabase está configurado. Verifica que el esquema y las políticas RLS estén aplicados.',
    },
    {
      ok: !isDemoMode,
      title: 'Row Level Security activo',
      detail: 'El script sinestesya_setup.sql activa RLS y separa pacientes, historia clínica, facturación y mensajería por rol.',
    },
    {
      ok: !!settings?.adminClinicalAccess === false,
      title: 'Notas clínicas fuera del alcance de administración',
      detail: settings?.adminClinicalAccess
        ? 'El acceso clínico de administración está activado. Debe existir una justificación documentada y revisarse periódicamente.'
        : 'Administración no puede leer notas clínicas salvo que se conceda el permiso explícito clinical.view.all.',
    },
    {
      ok: settings?.aiEnabled === false,
      title: 'IA clínica desactivada',
      detail: settings?.aiEnabled
        ? 'La IA está activada. Confirma que existe evaluación de privacidad, base jurídica y proveedor con garantías.'
        : 'Sin evaluación de privacidad previa no debe activarse ningún asistente de IA sobre datos clínicos.',
    },
    {
      ok: !!settings?.lastBackupAt,
      title: 'Copia de seguridad verificada',
      detail: settings?.lastBackupAt
        ? 'Existe una verificación registrada. Comprueba que la restauración también se prueba.'
        : 'No consta verificación de copia de seguridad. Regístrala en Configuración cuando la hayas comprobado.',
    },
    {
      ok: !loadError,
      title: 'Configuración del centro accesible',
      detail: loadError || 'La configuración del centro se ha podido leer correctamente.',
    },
  ];

  const okCount = checklist.filter(item => item.ok).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Estado técnico y puesta en marcha"
        description="Comprobaciones reales del entorno, guía de despliegue y scripts SQL. No se muestran estados simulados como si fueran producción."
        icon={Server}
        accent="bg-slate-700"
        actions={<Badge className={isDemoMode ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-fisio-200 bg-fisio-50 text-fisio-800'}>
          {isDemoMode ? 'Demostración local' : 'Producción'}
        </Badge>}
      />

      {isDemoMode ? (
        <InlineAlert level="warning" title="Modo demostración activo">
          {forceDemo
            ? 'VITE_DEMO_MODE=true fuerza el modo demostración aunque Supabase esté configurado.'
            : 'No se ha detectado configuración de Supabase. Los datos se guardan únicamente en este navegador y están marcados como demo.'}
          {' '}No introduzcas datos clínicos reales.
        </InlineAlert>
      ) : (
        <InlineAlert level="success" title="Conexión de producción">
          La aplicación está usando Supabase. Aun así, revisa el checklist y ejecuta el esquema antes de dar acceso al equipo.
        </InlineAlert>
      )}

      {loadError && (
        <InlineAlert level="danger" title="Configuración no disponible">{loadError}</InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Backend"
          value={isDemoMode ? 'Demo' : 'Supabase'}
          icon={isDemoMode ? CloudOff : Database}
          tone={isDemoMode ? 'orange' : 'green'}
          hint={supabaseUrl ? 'URL configurada' : 'Sin URL de Supabase'}
        />
        <StatCard title="Comprobaciones" value={`${okCount}/${checklist.length}`} icon={ShieldCheck} tone={okCount === checklist.length ? 'green' : 'yellow'} hint="Checklist de seguridad" />
        <StatCard title="Retención" value={`${settings?.retentionYears || 5} años`} icon={HardDrive} hint="Política configurada" />
        <StatCard title="IA clínica" value={settings?.aiEnabled ? 'Activada' : 'Desactivada'} icon={Sparkles} tone={settings?.aiEnabled ? 'red' : 'neutral'} hint="Requiere evaluación previa" />
      </div>

      <SectionCard
        title="Checklist de seguridad y cumplimiento"
        description="Cada punto refleja el estado real de la configuración. Los puntos pendientes deben resolverse antes de usar datos de pacientes."
        actions={<Badge className={okCount === checklist.length ? 'border-fisio-200 bg-fisio-50 text-fisio-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>
          {okCount === checklist.length ? 'Todo correcto' : `${checklist.length - okCount} pendiente(s)`}
        </Badge>}
      >
        <ul className="space-y-3">
          {checklist.map(item => (
            <li key={item.title} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.ok ? 'bg-fisio-50 text-fisio-700' : 'bg-amber-50 text-amber-700'}`}>
                {item.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{item.title}</p>
                <p className="mt-0.5 text-xs text-stone-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Puesta en marcha"
        description="Orden recomendado para un centro nuevo."
      >
        <ol className="space-y-3">
          {[
            ['Configura las variables de entorno', 'En Vercel o en .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. No expongas nunca la service role en el navegador.'],
            ['Ejecuta el esquema en Supabase', 'SQL Editor → pega sinestesya_setup.sql → Run. El script es idempotente y elimina políticas antiguas de las tablas gestionadas.'],
            ['Crea el primer administrador', 'Crea el usuario en Authentication → Users y actualiza su fila en profiles con role = admin y active = true.'],
            ['Asigna especialidad al equipo', 'Cada cuenta clínica debe tener role = medico y profession = psicologia / fisioterapia / logopedia / nutricion.'],
            ['Prueba permisos con cuentas reales', 'Comprueba que cada especialidad solo ve su historia, que administración no ve notas clínicas y que la auditoría registra los accesos.'],
            ['Configura copias y retención', 'Activa copias automáticas en Supabase, prueba una restauración y registra la verificación en Configuración.'],
          ].map(([title, detail], index) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-800">{title}</p>
                <p className="mt-0.5 text-xs text-stone-500">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title="Esquema completo de Sinestesya"
        description="Incluye pacientes, agenda, historia clínica segmentada, facturación, consentimientos, auditoría, configuración y mensajería."
        actions={<CopyButton text={SINESTESYA_SQL} />}
      >
        <SqlBlock sql={SINESTESYA_SQL} />
      </SectionCard>

      <SectionCard
        title="Script de compatibilidad contable"
        description="Necesario solo si vienes de una instalación anterior con la tabla payments y la columna profession sin crear. El esquema principal ya las incluye."
        actions={<CopyButton text={ACCOUNTING_SQL} />}
      >
        <SqlBlock sql={ACCOUNTING_SQL} tone="text-sky-200" />
      </SectionCard>

      <SectionCard
        title="Diagnóstico del navegador"
        description="Datos técnicos visibles para soporte. No incluyen información clínica."
      >
        <div className={`${cardClass} divide-y divide-stone-100 overflow-hidden`}>
          {[
            ['Modo de ejecución', isDemoMode ? 'Demostración local (localStorage)' : 'Producción (Supabase)'],
            ['URL de Supabase', supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, '$1') : 'No configurada'],
            ['Forzar demo', forceDemo ? 'Sí (VITE_DEMO_MODE=true)' : 'No'],
            ['Centro configurado', settings?.centerName || 'Sin datos'],
            ['Retención documental', `${settings?.retentionYears || 5} años`],
            ['Última verificación de copia', settings?.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('es-ES') : 'Sin registrar'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-stone-500">{label}</span>
              <span className="break-all font-mono text-xs text-stone-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => window.location.reload()} className={btnPrimary}>
            <Terminal size={16} /> Recargar aplicación
          </button>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className={btnSecondary}>
            <LockKeyhole size={16} /> Abrir Supabase
          </a>
        </div>
      </SectionCard>

      <p className="flex items-start gap-2 text-xs text-stone-400">
        <LockKeyhole size={14} className="mt-0.5 shrink-0" />
        Este panel no ejecuta SQL ni modifica la base de datos: solo muestra el estado y permite copiar los scripts.
        Aplica los cambios desde el SQL Editor de Supabase y revisa el resultado antes de dar acceso a pacientes reales.
      </p>
    </div>
  );
};

export default SystemInfo;
