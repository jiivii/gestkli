import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Building2, CheckCircle2, Database, Download, HardDrive, KeyRound, LockKeyhole,
  RefreshCw, Save, ShieldCheck, Sparkles, UserCog, Sparkles as SparklesIcon,
} from 'lucide-react';
import { CenterSettings, User, UserRole } from '../types';
import { dbService, isDemoMode } from '../services/dbService';
import { hasPermission } from '../services/permissions';
import {
  CENTER_EMAIL, CENTER_PHONE, formatDate, getRoleProfile, localTodayISO,
} from '../constants';
import {
  Badge, Field, InlineAlert, PageHeader, SectionCard, Toggle, btnGhost, btnPrimary, btnSecondary,
  cardClass, inputClass,
} from '../components/ui';

interface Props { user: User; }

const BLANK: CenterSettings = {
  centerName: 'Sinestesya', legalName: 'Sinestesya Salud Integral S.L.', cif: '',
  address: '', phone: CENTER_PHONE, email: CENTER_EMAIL, web: '',
  schedule: 'Lunes a viernes · 09:00–20:00', adminClinicalAccess: false,
  clinicalAccessJustification: '', retentionYears: 5, aiEnabled: false,
  aiPrivacyReviewed: false, lastBackupAt: null,
};

const Settings: React.FC<Props> = ({ user }) => {
  const canManage = hasPermission(user, 'settings.manage');
  const [settings, setSettings] = useState<CenterSettings>(BLANK);
  const [original, setOriginal] = useState<CenterSettings>(BLANK);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, profs] = await Promise.all([dbService.getSettings(), dbService.getProfessionals()]);
      setSettings(cfg);
      setOriginal(cfg);
      setProfessionals(profs);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = (patch: Partial<CenterSettings>) => setSettings(prev => ({ ...prev, ...patch }));

  const adminsWithClinicalAccess = useMemo(
    () => professionals.filter(p => p.role === UserRole.ADMIN && hasPermission(p, 'clinical.view.all')),
    [professionals],
  );
  const clinicalUsers = professionals.filter(p => p.role !== UserRole.ADMIN);

  const unsaved = JSON.stringify(settings) !== JSON.stringify(original);

  const save = async () => {
    setError('');
    if (!settings.centerName.trim()) { setError('El nombre comercial del centro es obligatorio.'); return; }
    if (!settings.email.trim() || !/^\S+@\S+\.\S+$/.test(settings.email)) { setError('Introduce un correo de contacto válido.'); return; }
    if (settings.adminClinicalAccess && !(settings.clinicalAccessJustification || '').trim()) {
      setError('Para documentar el acceso clínico de administración debes indicar una justificación.'); return;
    }
    if (settings.aiEnabled && !settings.aiPrivacyReviewed) {
      setError('No se puede activar la IA clínica sin completar antes la evaluación de privacidad.'); return;
    }
    if (settings.retentionYears < 1) { setError('La retención debe ser al menos de un año.'); return; }
    setSaving(true);
    try {
      const next: CenterSettings = {
        ...settings,
        aiEnabled: settings.aiPrivacyReviewed ? settings.aiEnabled : false,
        centerName: settings.centerName.trim(),
        email: settings.email.trim(),
      };
      const ok = await dbService.saveSettings(next, user);
      if (!ok) throw new Error('No se pudo guardar la configuración.');
      if (next.adminClinicalAccess !== original.adminClinicalAccess) {
        await dbService.logAudit(user, 'settings.clinical_access', 'settings', '1',
          next.adminClinicalAccess
            ? `Acceso clínico de administración documentado. Justificación: ${(next.clinicalAccessJustification || '').trim()}`
            : 'Acceso clínico de administración desactivado');
      }
      setSettings(next);
      setOriginal(next);
      setNotice('Configuración guardada.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const recordBackup = async () => {
    setError('');
    if (!window.confirm('¿Registrar que se ha verificado una copia de seguridad externa? Esto no crea la copia: solo deja constancia de la revisión.')) return;
    setSaving(true);
    try {
      const next = { ...settings, lastBackupAt: new Date().toISOString() };
      const ok = await dbService.saveSettings(next, user);
      if (!ok) throw new Error('No se pudo registrar la copia.');
      await dbService.logAudit(user, 'backup.verify', 'settings', '1', 'Verificación de copia de seguridad registrada');
      setSettings(next);
      setOriginal(next);
      setNotice('Verificación de copia registrada.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la verificación.');
    } finally {
      setSaving(false);
    }
  };

  const resetDemo = async () => {
    if (!window.confirm('¿Restablecer todos los datos de demostración? Se cerrará la sesión y se perderán los cambios locales.')) return;
    await dbService.resetDemo();
    localStorage.removeItem('sinestesya_user');
    localStorage.removeItem('sinestesya_token');
    window.location.hash = '#/login';
    window.location.reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema · Configuración"
        title="Configuración del centro"
        description="Datos fiscales, seguridad, protección de datos y estado técnico. Los cambios sensibles quedan auditados."
        icon={ShieldCheck}
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={loading || saving}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Recargar</button>
            {canManage && <button onClick={save} className={btnPrimary} disabled={saving || !unsaved}><Save size={15} /> {saving ? 'Guardando…' : unsaved ? 'Guardar cambios' : 'Sin cambios'}</button>}
          </>
        }
      />

      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}
      {notice && <InlineAlert level="success">{notice}</InlineAlert>}
      {isDemoMode && (
        <InlineAlert level="warning" title="Entorno de demostración">
          Los datos mostrados son ficticios. La configuración que guardes aquí solo afecta a este navegador y
          no debe usarse para operar con pacientes reales.
        </InlineAlert>
      )}

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando configuración…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <SectionCard title="Datos del centro" description="Aparecen en facturas, informes y comunicaciones">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre comercial" required><input className={inputClass} value={settings.centerName} onChange={e => set({ centerName: e.target.value })} /></Field>
                <Field label="Razón social"><input className={inputClass} value={settings.legalName} onChange={e => set({ legalName: e.target.value })} /></Field>
                <Field label="CIF / NIF"><input className={inputClass} value={settings.cif} onChange={e => set({ cif: e.target.value })} /></Field>
                <Field label="Teléfono"><input className={inputClass} value={settings.phone} onChange={e => set({ phone: e.target.value })} /></Field>
                <Field label="Correo de contacto" required><input type="email" className={inputClass} value={settings.email} onChange={e => set({ email: e.target.value })} /></Field>
                <Field label="Web"><input className={inputClass} value={settings.web} onChange={e => set({ web: e.target.value })} /></Field>
                <Field label="Dirección" className="sm:col-span-2"><input className={inputClass} value={settings.address} onChange={e => set({ address: e.target.value })} /></Field>
                <Field label="Horario" className="sm:col-span-2"><input className={inputClass} value={settings.schedule} onChange={e => set({ schedule: e.target.value })} /></Field>
              </div>
            </SectionCard>

            <SectionCard title="Acceso clínico de administración" description="Desactivado por defecto. Requiere autorización expresa, justificación y perfil habilitado">
              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${settings.adminClinicalAccess ? 'border-red-200 bg-red-50/60' : 'border-fisio-200 bg-fisio-50/60'}`}>
                  <Toggle
                    checked={settings.adminClinicalAccess}
                    onChange={value => set({ adminClinicalAccess: value, ...(value ? {} : { clinicalAccessJustification: '' }) })}
                    label={settings.adminClinicalAccess ? 'Autorización documentada activa' : 'Acceso clínico de administración desactivado'}
                    description="Documenta la autorización del centro. El acceso efectivo se concede perfil a perfil en Profesionales."
                  />
                </div>

                {settings.adminClinicalAccess && (
                  <>
                    <Field label="Justificación de la autorización" required hint="Motivo, alcance, responsables y fecha de revisión.">
                      <textarea rows={3} className={`${inputClass} resize-y`} value={settings.clinicalAccessJustification || ''} onChange={e => set({ clinicalAccessJustification: e.target.value })} placeholder="Ej. Auditoría interna de calidad solicitada por dirección. Acceso de solo lectura limitado a 30 días…" />
                    </Field>
                    <InlineAlert level="warning" title="Autorización excepcional">
                      La administración solo podrá leer, nunca escribir. Cada consulta debe quedar auditada.
                      Revisa esta autorización periódicamente y retírala cuando deje de ser necesaria.
                    </InlineAlert>
                  </>
                )}

                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Estado real de los permisos</p>
                  {adminsWithClinicalAccess.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      Ningún perfil de administración tiene la autorización «ver notas clínicas detalladas».
                      {settings.adminClinicalAccess && ' La autorización del centro está documentada, pero falta concederla en el perfil correspondiente.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {adminsWithClinicalAccess.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                          <span className="text-xs font-semibold text-red-800">{admin.name}</span>
                          <Badge className="border-red-200 bg-white text-red-700">Lectura clínica global</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link to="/professionals" className={btnSecondary + ' mt-3 !py-1.5 text-xs'}><UserCog size={13} /> Gestionar permisos por perfil</Link>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Protección de datos y conservación" description="RGPD y LOPDGDD">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Años de conservación de la historia clínica" hint="Ajusta según normativa autonómica y criterio jurídico.">
                  <input type="number" min={1} max={30} className={inputClass} value={settings.retentionYears} onChange={e => set({ retentionYears: Number(e.target.value) })} />
                </Field>
                <div className="rounded-xl bg-stone-50 p-3 text-[11px] text-stone-500">
                  <p className="font-semibold text-stone-700">Retención configurada</p>
                  <p className="mt-1">Los datos clínicos se conservarán {settings.retentionYears} año(s) desde el último contacto, salvo obligación legal distinta.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  'Consentimiento de privacidad y consentimiento clínico por paciente.',
                  'Representación legal obligatoria en menores de edad.',
                  'Minimización: administración no ve notas clínicas salvo autorización expresa.',
                  'Derechos de acceso, rectificación, supresión y portabilidad atendidos por el responsable.',
                  'Registro de actividades de tratamiento y contrato de encargado con proveedores.',
                ].map(text => (
                  <div key={text} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-fisio-500" />
                    <span className="text-xs text-stone-600">{text}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Esta configuración es una ayuda operativa, no asesoramiento jurídico. Valida el periodo de conservación
                y la información al paciente con tu delegado de protección de datos.
              </p>
            </SectionCard>

            <SectionCard title="Inteligencia artificial clínica" description="Desactivada por defecto hasta superar la evaluación de privacidad">
              <div className="space-y-3">
                <div className="rounded-xl border border-stone-200 p-3">
                  <Toggle
                    checked={settings.aiPrivacyReviewed}
                    onChange={value => set({ aiPrivacyReviewed: value, ...(value ? {} : { aiEnabled: false }) })}
                    label="Evaluación de privacidad completada"
                    description="Análisis de finalidad, base jurídica, minimización, proveedor y transferencias internacionales."
                  />
                </div>
                <div className={`rounded-xl border p-3 ${settings.aiPrivacyReviewed ? 'border-stone-200' : 'border-stone-200 bg-stone-50'}`}>
                  <Toggle
                    checked={settings.aiEnabled}
                    onChange={value => set({ aiEnabled: value })}
                    disabled={!settings.aiPrivacyReviewed}
                    label="Asistente de IA clínica"
                    description={settings.aiPrivacyReviewed ? 'Solo debe usarse con datos anonimizados y revisión humana.' : 'Bloqueado hasta completar la evaluación de privacidad.'}
                  />
                </div>
                <InlineAlert level={settings.aiEnabled ? 'warning' : 'info'} title={settings.aiEnabled ? 'IA activada' : 'IA desactivada'}>
                  {settings.aiEnabled
                    ? 'Ninguna sugerencia de IA sustituye el juicio clínico. Revisa cada salida y evita introducir datos identificables.'
                    : 'No se envían datos clínicos a modelos externos. La navegación no incluye asistente de IA.'}
                </InlineAlert>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5">
            <SectionCard title="Copias de seguridad" description="Verificación y continuidad">
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-stone-500"><HardDrive size={17} /></div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Última verificación</p>
                    <p className="text-xs font-semibold text-stone-800">{settings.lastBackupAt ? formatDate(settings.lastBackupAt, true) : 'No registrada'}</p>
                  </div>
                </div>
                {canManage && (
                  <button onClick={recordBackup} className={btnSecondary + ' w-full !py-2 text-xs'} disabled={saving}>
                    <Database size={14} /> Registrar verificación de copia
                  </button>
                )}
                <p className="text-[11px] leading-relaxed text-stone-500">
                  Este botón no crea la copia: deja constancia de que se ha comprobado una copia externa.
                  Configura copias automáticas y pruebas de restauración en Supabase o en tu proveedor de infraestructura.
                </p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  <AlertTriangle size={13} className="mr-1 inline" /> Una copia sin prueba de restauración no es una copia fiable.
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Estado técnico" description="Entorno y conexión">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Modo</span>
                  <Badge className={isDemoMode ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-fisio-200 bg-fisio-50 text-fisio-800'}>
                    {isDemoMode ? 'Demostración' : 'Producción'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">Supabase</span>
                  <span className={supabaseUrl ? 'font-semibold text-fisio-700' : 'font-semibold text-stone-500'}>
                    {supabaseUrl ? 'Configurado' : 'No configurado'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-stone-500">IA clínica</span>
                  <span className={settings.aiEnabled ? 'font-semibold text-amber-700' : 'font-semibold text-fisio-700'}>
                    {settings.aiEnabled ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Autorización clínica admin</span>
                  <span className={settings.adminClinicalAccess ? 'font-semibold text-red-700' : 'font-semibold text-fisio-700'}>
                    {settings.adminClinicalAccess ? 'Documentada' : 'No'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Link to="/system" className={btnSecondary + ' w-full !py-2 text-xs'}><Database size={14} /> Instalación y SQL</Link>
                <Link to="/audit" className={btnSecondary + ' w-full !py-2 text-xs'}><ShieldCheck size={14} /> Registro de auditoría</Link>
              </div>
            </SectionCard>

            <SectionCard title="Perfiles del centro" description="Resumen de acceso">
              <div className="space-y-2">
                {[UserRole.ADMIN, ...([UserRole.PSICOLOGIA, UserRole.FISIOTERAPIA, UserRole.LOGOPEDIA, UserRole.NUTRICION] as UserRole[])].map(role => {
                  const profile = getRoleProfile(role);
                  const count = professionals.filter(p => p.role === role && p.active !== false).length;
                  return (
                    <div key={role} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${profile.solid}`} />
                      <span className="flex-1 text-xs text-stone-600">{profile.label}</span>
                      <span className="text-xs font-bold text-stone-800">{count}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500">Pacientes con especialidad</span>
                  <span className="text-xs font-bold text-stone-800">{clinicalUsers.length} profesionales</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Seguridad recomendada" description="Controles mínimos antes de producción">
              <div className="space-y-2">
                {[
                  ['Autenticación segura', 'Supabase Auth con contraseñas gestionadas y sesiones revocables.'],
                  ['RLS activo', 'Políticas por rol y especialidad en pacientes, historia y facturación.'],
                  ['Auditoría', 'Altas, accesos clínicos, cambios y cobros registrados.'],
                  ['Copias y restauración', 'Prueba periódica documentada.'],
                  ['MFA administración', 'Recomendado para perfiles con acceso económico.'],
                  ['Revisión de permisos', 'Trimestral o tras cada cambio de equipo.'],
                ].map(([title, description]) => (
                  <div key={title} className="flex items-start gap-2">
                    <LockKeyhole size={13} className="mt-0.5 shrink-0 text-stone-400" />
                    <div>
                      <p className="text-[11px] font-semibold text-stone-700">{title}</p>
                      <p className="text-[10px] text-stone-500">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {isDemoMode && (
              <SectionCard title="Datos de demostración" description="Solo visible en este entorno">
                <p className="mb-3 text-[11px] text-stone-500">
                  Restablece los datos ficticios originales. Se cerrará la sesión.
                </p>
                <button onClick={resetDemo} className={btnGhost + ' w-full border border-red-200 !py-2 text-xs text-red-600'} disabled={saving}>
                  <RefreshCw size={13} /> Restablecer demostración
                </button>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {canManage && unsaved && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs font-semibold text-stone-700">Hay cambios sin guardar en la configuración.</p>
          <div className="flex gap-2">
            <button onClick={() => setSettings(original)} className={btnGhost} disabled={saving}>Descartar</button>
            <button onClick={save} className={btnPrimary} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
