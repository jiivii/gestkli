import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, Mail, Pencil, Plus, RefreshCw, Search,
  ShieldCheck, Trash2, UserCog, UserPlus, Users,
} from 'lucide-react';
import { Appointment, AppointmentStatus, Permission, User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import {
  ALL_PERMISSIONS, getBasePermissions, getEffectivePermissions, hasPermission,
} from '../services/permissions';
import {
  CLINICAL_SPECIALTIES, PROFESSION_OPTIONS, SPECIALTY_LABELS, formatDate, getProfessionalLabel,
  getRoleProfile,
} from '../constants';
import {
  Avatar, Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, StatCard, Toggle,
  btnGhost, btnPrimary, btnSecondary, btnDanger, cardClass, inputClass,
} from '../components/ui';

interface Props { user: User; }

interface Workload {
  today: number;
  upcoming: number;
  month: number;
  completed: number;
  lastDate?: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: UserRole.ADMIN, label: 'Administración', description: 'Agenda global, pacientes, facturación y configuración.' },
  ...CLINICAL_SPECIALTIES.map(s => ({
    value: s,
    label: SPECIALTY_LABELS[s],
    description: getRoleProfile(s).description,
  })),
  { value: UserRole.PENDIENTE, label: 'Perfil pendiente', description: 'Cuenta sin especialidad asignada y sin acceso clínico.' },
];

const roleLabel = (role: UserRole) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;

const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Professionals: React.FC<Props> = ({ user }) => {
  const canManage = hasPermission(user, 'professionals.manage');
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; email: string; role: UserRole }>({
    name: '', email: '', role: UserRole.FISIOTERAPIA,
  });
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: UserRole; active: boolean }>({ name: '', role: UserRole.FISIOTERAPIA, active: true });

  const [permTarget, setPermTarget] = useState<User | null>(null);
  const [permSelected, setPermSelected] = useState<Permission[]>([]);
  const [permReason, setPermReason] = useState('');
  const [permError, setPermError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [profs, appts] = await Promise.all([
        dbService.getProfessionals(),
        dbService.getAppointments(user),
      ]);
      setProfessionals(profs);
      setAppointments(appts);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los profesionales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const workload = useMemo(() => {
    const today = dayKey(new Date().toISOString());
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const map = new Map<string, Workload>();
    professionals.forEach(p => map.set(p.id, { today: 0, upcoming: 0, month: 0, completed: 0 }));
    appointments.forEach(appt => {
      const current = map.get(appt.professionalId);
      if (!current) return;
      const when = new Date(appt.date);
      if (dayKey(appt.date) === today && appt.status !== AppointmentStatus.CANCELLED) current.today++;
      if (when >= now && appt.status !== AppointmentStatus.CANCELLED) current.upcoming++;
      if (when >= monthStart && appt.status !== AppointmentStatus.CANCELLED) current.month++;
      if (appt.status === AppointmentStatus.COMPLETED) current.completed++;
      if (when <= now && (!current.lastDate || appt.date > current.lastDate)) current.lastDate = appt.date;
    });
    return map;
  }, [professionals, appointments]);

  const filtered = useMemo(() => professionals.filter(p => {
    if (filterRole === 'clinical' && !CLINICAL_SPECIALTIES.includes(p.role as any)) return false;
    if (filterRole === 'pending' && p.role !== UserRole.PENDIENTE) return false;
    if (filterRole && !['clinical', 'pending'].includes(filterRole) && p.role !== filterRole) return false;
    if (!search.trim()) return true;
    return `${p.name} ${p.email} ${getProfessionalLabel(p)}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => {
    if (a.role === UserRole.ADMIN && b.role !== UserRole.ADMIN) return -1;
    if (a.role !== UserRole.ADMIN && b.role === UserRole.ADMIN) return 1;
    return a.name.localeCompare(b.name);
  }), [professionals, filterRole, search]);

  const stats = {
    total: professionals.length,
    active: professionals.filter(p => p.active !== false).length,
    clinical: professionals.filter(p => CLINICAL_SPECIALTIES.includes(p.role as any)).length,
    pending: professionals.filter(p => p.role === UserRole.PENDIENTE).length,
    admins: professionals.filter(p => p.role === UserRole.ADMIN).length,
  };

  const openCreate = () => {
    setCreateForm({ name: '', email: '', role: UserRole.FISIOTERAPIA });
    setError('');
    setCreateOpen(true);
  };

  const createProfessional = async () => {
    setError('');
    if (!createForm.name.trim()) { setError('Indica el nombre completo.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(createForm.email.trim())) { setError('Introduce un correo válido.'); return; }
    setSaving(true);
    try {
      const result = await dbService.createProfessional({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
        profession: CLINICAL_SPECIALTIES.includes(createForm.role as any) ? createForm.role : '',
        permissions: [],
      });
      if (!result.success) throw new Error(result.message || 'No se pudo crear el perfil.');
      setCreateOpen(false);
      setNotice('Perfil creado. La persona recibirá las indicaciones de acceso por correo si el servidor de invitaciones está configurado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el profesional.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (prof: User) => {
    setEditTarget(prof);
    setEditForm({ name: prof.name, role: prof.role, active: prof.active !== false });
    setError('');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setError('');
    if (!editForm.name.trim()) { setError('El nombre no puede estar vacío.'); return; }
    if (editForm.role === UserRole.ADMIN && editTarget.role === UserRole.ADMIN && !editForm.active && stats.admins <= 1) {
      setError('No puedes desactivar el último perfil de administración.'); return;
    }
    setSaving(true);
    try {
      const profession = CLINICAL_SPECIALTIES.includes(editForm.role as any) ? editForm.role : null;
      const result = await dbService.updateProfessional(editTarget.id, {
        name: editForm.name.trim(),
        role: editForm.role,
        profession: profession as any,
        active: editForm.active,
      });
      if (!result.success) throw new Error(result.message || 'No se pudo actualizar el perfil.');
      await dbService.logAudit(user, 'professional.update', 'profile', editTarget.id,
        `Perfil actualizado: ${roleLabel(editForm.role)}${editForm.active ? '' : ' (inactivo)'}`);
      setEditTarget(null);
      setNotice('Perfil actualizado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prof: User) => {
    if (prof.role === UserRole.ADMIN && prof.active !== false && stats.admins <= 1) {
      setError('No puedes desactivar el último perfil de administración.'); return;
    }
    try {
      const result = await dbService.updateProfessional(prof.id, { active: prof.active === false });
      if (!result.success) throw new Error(result.message);
      await dbService.logAudit(user, 'professional.update', 'profile', prof.id,
        prof.active === false ? 'Perfil reactivado' : 'Perfil desactivado');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el estado del perfil.');
    }
  };

  const remove = async (prof: User) => {
    if (prof.id === user.id) { setError('No puedes eliminar tu propio perfil.'); return; }
    if (prof.role === UserRole.ADMIN && stats.admins <= 1) { setError('No puedes eliminar el último perfil de administración.'); return; }
    if (!window.confirm(`¿Eliminar el perfil de ${prof.name}? Los registros clínicos y la auditoría se conservan; la cuenta perderá el acceso.`)) return;
    setSaving(true);
    try {
      const ok = await dbService.deleteProfessional(prof.id);
      if (!ok) throw new Error('No se pudo eliminar. Puede tener registros asociados.');
      await dbService.logAudit(user, 'professional.delete', 'profile', prof.id, `Perfil eliminado: ${prof.name}`);
      setNotice('Perfil eliminado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const openPermissions = (prof: User) => {
    setPermTarget(prof);
    const base = getBasePermissions(prof.role);
    setPermSelected(getEffectivePermissions(prof).filter(p => !base.includes(p)));
    setPermReason('');
    setPermError('');
  };

  const togglePermission = (permission: Permission) => {
    setPermSelected(prev => prev.includes(permission) ? prev.filter(p => p !== permission) : [...prev, permission]);
  };

  const savePermissions = async () => {
    if (!permTarget) return;
    setPermError('');
    const grantsClinicalAll = permSelected.includes('clinical.view.all');
    if (grantsClinicalAll && !permReason.trim()) {
      setPermError('Justifica por qué este perfil necesita acceso clínico global. La autorización es excepcional y queda auditada.');
      return;
    }
    setSaving(true);
    try {
      const result = await dbService.updatePermissions(permTarget.id, permSelected);
      if (!result.success) throw new Error(result.message || 'No se pudieron guardar los permisos.');
      await dbService.logAudit(user, 'permissions.update', 'profile', permTarget.id,
        `Permisos adicionales: ${permSelected.length ? permSelected.join(', ') : 'ninguno'}${grantsClinicalAll ? ` · Justificación: ${permReason.trim()}` : ''}`);
      setPermTarget(null);
      setNotice('Permisos actualizados. Los cambios se aplican en el siguiente acceso del usuario.');
      await load();
    } catch (e: any) {
      setPermError(e?.message || 'No se pudieron guardar los permisos.');
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = useMemo(() => {
    const base = permTarget ? getBasePermissions(permTarget.role) : [];
    const available = ALL_PERMISSIONS.filter(p => !base.includes(p.id));
    const groups = new Map<string, typeof ALL_PERMISSIONS>();
    available.forEach(p => {
      const arr = groups.get(p.group) || [];
      arr.push(p);
      groups.set(p.group, arr);
    });
    return Array.from(groups.entries());
  }, [permTarget]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración · Equipo"
        title="Profesionales y permisos"
        description="Cinco perfiles independientes. Cada profesional accede solo a su especialidad; los permisos extra son excepcionales y auditados."
        icon={UserCog}
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
            {canManage && <button onClick={openCreate} className={btnPrimary}><UserPlus size={15} /> Nuevo perfil</button>}
          </>
        }
      />

      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}
      {notice && <InlineAlert level="success">{notice}</InlineAlert>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Perfiles" value={stats.total} icon={Users} tone="blue" hint={`${stats.active} activos`} />
        <StatCard title="Clínicos" value={stats.clinical} icon={ShieldCheck} tone="green" hint="Cuatro especialidades" />
        <StatCard title="Administración" value={stats.admins} icon={UserCog} tone="neutral" hint="Sin acceso clínico por defecto" />
        <StatCard title="Pendientes" value={stats.pending} icon={LockKeyhole} tone={stats.pending ? 'yellow' : 'neutral'} hint="Sin especialidad asignada" />
      </div>

      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-center'}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
          <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar por nombre, correo o especialidad…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Todos los perfiles</option>
          <option value="clinical">Solo clínicos</option>
          <option value={UserRole.ADMIN}>Administración</option>
          {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
          <option value="pending">Pendientes</option>
        </select>
      </div>

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando equipo…</div>
      ) : filtered.length === 0 ? (
        <div className={cardClass}><EmptyState icon={Users} title="Sin perfiles" description="No hay profesionales que coincidan con la búsqueda." action={canManage ? <button onClick={openCreate} className={btnPrimary}><Plus size={15} /> Nuevo perfil</button> : undefined} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map(prof => {
            const profile = getRoleProfile(prof.role);
            const work = workload.get(prof.id) || { today: 0, upcoming: 0, month: 0, completed: 0 };
            const extras = getEffectivePermissions(prof).filter(p => !getBasePermissions(prof.role).includes(p));
            const inactive = prof.active === false;
            const isSelf = prof.id === user.id;
            return (
              <div key={prof.id} className={`${cardClass} overflow-hidden ${inactive ? 'opacity-75' : ''}`}>
                <div className={`h-1.5 ${profile.solid}`} />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={prof.name} url={prof.avatarUrl} size={48} className={profile.soft} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-stone-900">{prof.name}</p>
                        {isSelf && <Badge className="border-stone-200 bg-stone-50 text-stone-500">Tú</Badge>}
                        {inactive && <Badge className="border-red-200 bg-red-50 text-red-700">Inactivo</Badge>}
                      </div>
                      <p className="truncate text-[11px] text-stone-400">{prof.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge className={`${profile.soft} ${profile.text} ${profile.border}`}>{profile.label}</Badge>
                        {extras.length > 0 && <Badge className="border-amber-200 bg-amber-50 text-amber-800"><KeyRound size={10} /> {extras.length} permiso(s) extra</Badge>}
                        {extras.includes('clinical.view.all') && <Badge className="border-red-200 bg-red-50 text-red-700">Acceso clínico global</Badge>}
                      </div>
                    </div>
                    {canManage && <Toggle checked={!inactive} onChange={() => toggleActive(prof)} disabled={saving} />}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-xl bg-stone-50 p-2 text-center">
                    {[
                      ['Hoy', work.today],
                      ['Próximas', work.upcoming],
                      ['Mes', work.month],
                      ['Hechas', work.completed],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="text-sm font-bold text-stone-800">{value}</p>
                        <p className="text-[9px] uppercase tracking-wide text-stone-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2 text-[10px] text-stone-400">
                    {work.lastDate ? `Última actividad de agenda: ${formatDate(work.lastDate)}` : 'Sin actividad de agenda registrada.'}
                  </p>

                  {canManage && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button onClick={() => openEdit(prof)} className={btnSecondary + ' flex-1 !px-2 !py-1.5 text-[11px]'}><Pencil size={12} /> Editar</button>
                      <button onClick={() => openPermissions(prof)} className={btnSecondary + ' flex-1 !px-2 !py-1.5 text-[11px]'}><KeyRound size={12} /> Permisos</button>
                      {!isSelf && <button onClick={() => remove(prof)} className={btnGhost + ' border border-red-100 !px-2 !py-1.5 text-[11px] text-red-600'}><Trash2 size={12} /></button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionCard title="Cómo funcionan los perfiles" description="Separación estricta de especialidades">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ROLE_OPTIONS.map(option => {
            const profile = getRoleProfile(option.value);
            return (
              <div key={option.value} className="flex items-start gap-2.5 rounded-xl border border-stone-100 p-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${profile.soft} ${profile.text}`}>
                  {option.value === UserRole.ADMIN ? <UserCog size={15} /> : option.value === UserRole.PENDIENTE ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-800">{option.label}</p>
                  <p className="text-[11px] text-stone-500">{option.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <InlineAlert level="warning" title="Acceso clínico de administración" className="mt-4">
          La autorización «ver notas clínicas detalladas» no se concede por defecto. Si se concede, debe justificarse,
          queda auditada y debe revisarse periódicamente. La administración nunca puede escribir en la historia clínica.
        </InlineAlert>
      </SectionCard>

      {/* Crear perfil */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo perfil profesional"
        subtitle="La cuenta se crea sin contraseña; se envía invitación si el servidor está configurado"
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={createProfessional} className={btnPrimary} disabled={saving}>{saving ? 'Creando…' : 'Crear perfil'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <Field label="Nombre completo" required>
            <input className={inputClass} value={createForm.name} onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))} />
          </Field>
          <Field label="Correo electrónico" required hint="Se usará para el acceso y las notificaciones.">
            <input type="email" className={inputClass} value={createForm.email} onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))} />
          </Field>
          <Field label="Perfil de acceso" required>
            <select className={inputClass} value={createForm.role} onChange={e => setCreateForm(prev => ({ ...prev, role: e.target.value as UserRole }))}>
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
            {ROLE_OPTIONS.find(o => o.value === createForm.role)?.description}
          </p>
          <InlineAlert level="info">
            El perfil se crea activo y sin permisos adicionales. Podrás ajustar los permisos desde su tarjeta.
          </InlineAlert>
        </div>
      </Modal>

      {/* Editar perfil */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Editar perfil"
        subtitle={editTarget ? `${editTarget.email}` : undefined}
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setEditTarget(null)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveEdit} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <Field label="Nombre completo" required>
            <input className={inputClass} value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
          </Field>
          <Field label="Perfil de acceso">
            <select className={inputClass} value={editForm.role} onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}>
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <div className="rounded-xl border border-stone-200 p-3">
            <Toggle checked={editForm.active} onChange={value => setEditForm(prev => ({ ...prev, active: value }))} label="Perfil activo" description="Si se desactiva, la persona no podrá iniciar sesión." />
          </div>
          <InlineAlert level="warning" title="Cambio de perfil">
            Cambiar el perfil modifica los permisos base. Revisa los permisos adicionales y comunica el cambio a la persona afectada.
          </InlineAlert>
        </div>
      </Modal>

      {/* Permisos */}
      <Modal
        open={!!permTarget}
        onClose={() => setPermTarget(null)}
        title="Permisos adicionales"
        subtitle={permTarget ? `${permTarget.name} · ${roleLabel(permTarget.role)}` : undefined}
        accent="bg-psy-500"
        size="lg"
        footer={
          <>
            <button onClick={() => setPermTarget(null)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={savePermissions} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar permisos'}</button>
          </>
        }
      >
        {permTarget && (
          <div className="space-y-4">
            {permError && <InlineAlert level="danger">{permError}</InlineAlert>}
            <InlineAlert level="info" title="Permisos incluidos por el perfil">
              <div className="mt-1 flex flex-wrap gap-1.5">
                {getBasePermissions(permTarget.role).length === 0
                  ? <span>Este perfil no tiene permisos base. Asigna permisos adicionales si es necesario.</span>
                  : getBasePermissions(permTarget.role).map(p => (
                    <Badge key={p} className="border-stone-200 bg-white text-stone-600">{ALL_PERMISSIONS.find(x => x.id === p)?.label || p}</Badge>
                  ))}
              </div>
            </InlineAlert>

            {groupedPermissions.length === 0 ? (
              <p className="text-sm text-stone-500">Este perfil ya incluye todos los permisos disponibles.</p>
            ) : (
              <div className="space-y-4">
                {groupedPermissions.map(([group, list]) => (
                  <div key={group}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{group}</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {list.map(permission => {
                        const selected = permSelected.includes(permission.id);
                        const risky = permission.id === 'clinical.view.all';
                        return (
                          <button
                            key={permission.id}
                            type="button"
                            onClick={() => togglePermission(permission.id)}
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                              selected
                                ? risky ? 'border-red-300 bg-red-50' : 'border-psy-300 bg-psy-50'
                                : 'border-stone-200 bg-white hover:bg-stone-50'
                            }`}
                          >
                            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? (risky ? 'border-red-500 bg-red-500 text-white' : 'border-psy-500 bg-psy-500 text-white') : 'border-stone-300 bg-white'}`}>
                              {selected && <CheckCircle2 size={11} />}
                            </span>
                            <span>
                              <span className={`block text-xs font-semibold ${risky ? 'text-red-800' : 'text-stone-700'}`}>{permission.label}</span>
                              {risky && <span className="mt-0.5 block text-[10px] text-red-600">Permite leer todas las historias clínicas. Uso excepcional y justificado.</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {permSelected.includes('clinical.view.all') && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-800"><AlertTriangle size={14} /> Justificación obligatoria para acceso clínico global</p>
                <textarea
                  rows={2}
                  className={`${inputClass} resize-y border-red-200`}
                  value={permReason}
                  onChange={e => setPermReason(e.target.value)}
                  placeholder="Motivo concreto, alcance y duración prevista de la autorización…"
                />
                <p className="text-[10px] text-red-700">Quedará registrado en auditoría con tu nombre y la fecha.</p>
              </div>
            )}

            <p className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
              <Mail size={13} className="mt-0.5 shrink-0" />
              Los permisos adicionales no modifican el perfil base. Para retirar un permiso incluido por el perfil, cambia el perfil de acceso.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Professionals;
