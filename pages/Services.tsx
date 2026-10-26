import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, DoorOpen, Euro, Package, Pencil, Plus, RefreshCw, Search, Stethoscope, Trash2, Wrench,
} from 'lucide-react';
import { Service, User } from '../types';
import { dbService } from '../services/dbService';
import { hasPermission } from '../services/permissions';
import {
  CLINICAL_SPECIALTIES, ROLE_PROFILES, SPECIALTY_LABELS, formatMoney, getRoleProfile,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard, StatCard, Tabs, Toggle,
  btnGhost, btnPrimary, btnSecondary, cardClass, inputClass,
} from '../components/ui';

interface Props { user: User; }

type RoomRow = { id: string; name: string; specialty: string; active: boolean };

const SPECIALTY_FILTERS = [
  { value: '', label: 'Todas' },
  ...CLINICAL_SPECIALTIES.map(s => ({ value: s, label: SPECIALTY_LABELS[s] })),
  { value: 'otro', label: 'Otros' },
];

const BLANK_SERVICE: Partial<Service> = {
  name: '', specialty: CLINICAL_SPECIALTIES[0], durationMinutes: 45, price: 0,
  taxRate: 0, room: '', description: '', active: true,
};

const Services: React.FC<Props> = ({ user }) => {
  const canManage = hasPermission(user, 'services.manage');
  const [tab, setTab] = useState('services');
  const [services, setServices] = useState<Service[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');

  const [serviceModal, setServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>(BLANK_SERVICE);
  const [roomModal, setRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [roomForm, setRoomForm] = useState<{ name: string; specialty: string; active: boolean }>({ name: '', specialty: 'comun', active: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [servs, rms] = await Promise.all([dbService.getServices(), dbService.getPhysicalRooms()]);
      setServices(servs);
      setRooms(rms);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los servicios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => services.filter(s => {
    if (filterSpecialty && s.specialty !== filterSpecialty) return false;
    if (!search.trim()) return true;
    return `${s.name} ${s.description || ''} ${s.room || ''}`.toLowerCase().includes(search.toLowerCase());
  }), [services, filterSpecialty, search]);

  const bySpecialty = useMemo(() => {
    const map = new Map<string, Service[]>();
    filtered.forEach(s => {
      const arr = map.get(s.specialty) || [];
      arr.push(s);
      map.set(s.specialty, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const activeServices = services.filter(s => s.active);
  const avgPrice = activeServices.length
    ? activeServices.reduce((sum, s) => sum + s.price, 0) / activeServices.length
    : 0;
  const coveredSpecialties = new Set(activeServices.map(s => s.specialty).filter(s => CLINICAL_SPECIALTIES.includes(s as any))).size;

  const openService = (service?: Service) => {
    setEditingService(service || null);
    setServiceForm(service ? { ...service } : { ...BLANK_SERVICE });
    setServiceModal(true);
  };

  const saveService = async () => {
    setError('');
    if (!serviceForm.name?.trim()) { setError('El nombre del servicio es obligatorio.'); return; }
    if (!serviceForm.durationMinutes || Number(serviceForm.durationMinutes) < 5) { setError('La duración debe ser de al menos 5 minutos.'); return; }
    if (Number(serviceForm.price) < 0) { setError('El precio no puede ser negativo.'); return; }
    setSaving(true);
    try {
      await dbService.saveService({
        ...serviceForm,
        name: serviceForm.name.trim(),
        durationMinutes: Number(serviceForm.durationMinutes),
        price: Number(serviceForm.price) || 0,
        taxRate: Number(serviceForm.taxRate) || 0,
        active: serviceForm.active !== false,
      });
      setServiceModal(false);
      setNotice(editingService ? 'Servicio actualizado.' : 'Servicio creado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  const removeService = async (service: Service) => {
    if (!window.confirm(`¿Eliminar el servicio «${service.name}»? Las citas y facturas ya emitidas conservan su histórico.`)) return;
    try {
      await dbService.deleteService(service.id);
      setNotice('Servicio eliminado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el servicio.');
    }
  };

  const openRoom = (room?: RoomRow) => {
    setEditingRoom(room || null);
    setRoomForm(room ? { name: room.name, specialty: room.specialty, active: room.active } : { name: '', specialty: 'comun', active: true });
    setRoomModal(true);
  };

  const saveRoom = async () => {
    setError('');
    if (!roomForm.name.trim()) { setError('El nombre de la sala es obligatorio.'); return; }
    setSaving(true);
    try {
      await dbService.saveRoom({
        id: editingRoom?.id, name: roomForm.name.trim(), specialty: roomForm.specialty, active: roomForm.active,
      });
      setRoomModal(false);
      setNotice(editingRoom ? 'Sala actualizada.' : 'Sala creada.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la sala.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoom = async (room: RoomRow) => {
    try {
      await dbService.saveRoom({ ...room, active: !room.active });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la sala.');
    }
  };

  const renderServices = () => (
    <div className="space-y-4">
      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-center'}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
          <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar servicio, descripción o sala…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}>
          {SPECIALTY_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {canManage && <button onClick={() => openService()} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Nuevo servicio</button>}
      </div>

      {filtered.length === 0 ? (
        <div className={cardClass}><EmptyState icon={Wrench} title="Sin servicios" description="Crea los servicios y tarifas que se usarán en agenda y facturación." action={canManage ? <button onClick={() => openService()} className={btnPrimary}><Plus size={15} /> Nuevo servicio</button> : undefined} /></div>
      ) : (
        <div className="space-y-5">
          {bySpecialty.map(([specialty, list]) => {
            const profile = getRoleProfile(specialty);
            return (
              <SectionCard
                key={specialty}
                title={profile.label}
                description={`${list.length} servicio(s) · ${list.filter(s => s.active).length} activos`}
                actions={<Badge className={`${profile.soft} ${profile.text} ${profile.border}`}>{profile.shortLabel}</Badge>}
                padded={false}
              >
                <div className="divide-y divide-stone-100">
                  {list.map(service => (
                    <div key={service.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${profile.soft} ${profile.text}`}>
                        <Stethoscope size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-stone-800">{service.name}</p>
                          {!service.active && <Badge className="border-stone-200 bg-stone-50 text-stone-500">Inactivo</Badge>}
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {service.durationMinutes} min · {formatMoney(service.price)}
                          {service.taxRate ? ` + ${service.taxRate}% IVA` : ' · IVA no aplicado'}
                          {service.room ? ` · ${service.room}` : ''}
                        </p>
                        {service.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-400">{service.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => openService(service)} className={btnGhost + ' border border-stone-200 !px-2 !py-1 text-[10px]'}><Pencil size={11} /> Editar</button>
                            <button onClick={() => removeService(service)} className={btnGhost + ' !px-2 !py-1 text-[10px] text-red-600'}><Trash2 size={11} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">Las salas se asignan a las citas y a los servicios. Una sala inactiva no debe usarse en nueva agenda.</p>
        {canManage && <button onClick={() => openRoom()} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Nueva sala</button>}
      </div>
      {rooms.length === 0 ? (
        <div className={cardClass}><EmptyState icon={DoorOpen} title="Sin salas" description="Crea las salas del centro para organizar la agenda." action={canManage ? <button onClick={() => openRoom()} className={btnPrimary}><Plus size={15} /> Nueva sala</button> : undefined} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map(room => {
            const profile = room.specialty === 'comun' ? null : ROLE_PROFILES[room.specialty as keyof typeof ROLE_PROFILES];
            return (
              <div key={room.id} className={`${cardClass} p-4 ${room.active ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${profile ? `${profile.soft} ${profile.text}` : 'bg-stone-100 text-stone-500'}`}>
                    <DoorOpen size={18} />
                  </div>
                  <Toggle checked={room.active} onChange={() => canManage && toggleRoom(room)} disabled={!canManage} />
                </div>
                <p className="mt-3 text-sm font-bold text-stone-800">{room.name}</p>
                <p className="text-[11px] text-stone-400">{profile ? profile.label : 'Sala común'} · {room.active ? 'Activa' : 'Inactiva'}</p>
                <div className="mt-3 flex justify-end gap-1">
                  {canManage && (
                    <button onClick={() => openRoom(room)} className={btnGhost + ' border border-stone-200 !px-2 !py-1 text-[10px]'}><Pencil size={11} /> Editar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración · Catálogo"
        title="Servicios, tarifas y salas"
        description="Define duraciones, precios, salas y especialidades. Sirven de base para la agenda, las facturas y los bonos."
        icon={Wrench}
        actions={
          <button onClick={load} className={btnSecondary} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
        }
      />

      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}
      {notice && <InlineAlert level="success">{notice}</InlineAlert>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Servicios activos" value={activeServices.length} icon={Wrench} tone="blue" hint={`${services.length} en catálogo`} />
        <StatCard title="Precio medio" value={formatMoney(avgPrice)} icon={Euro} tone="green" hint="Servicios activos" />
        <StatCard title="Salas" value={rooms.length} icon={DoorOpen} tone="orange" hint={`${rooms.filter(r => r.active).length} activas`} />
        <StatCard title="Especialidades" value={`${coveredSpecialties}/4`} icon={Stethoscope} tone="yellow" hint="Con tarifa activa" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link to="/billing?tab=packages" className={`${cardClass} flex items-center gap-3 p-4 transition-shadow hover:shadow-md`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-psy-50 text-psy-700"><Package size={18} /></div>
          <div>
            <p className="text-sm font-bold text-stone-800">Bonos de sesiones</p>
            <p className="text-xs text-stone-500">Se gestionan desde Facturación, con consumo trazable.</p>
          </div>
        </Link>
        <Link to="/appointments" className={`${cardClass} flex items-center gap-3 p-4 transition-shadow hover:shadow-md`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-logo-50 text-logo-700"><Clock size={18} /></div>
          <div>
            <p className="text-sm font-bold text-stone-800">Duración en agenda</p>
            <p className="text-xs text-stone-500">Cada servicio propone automáticamente su duración al reservar.</p>
          </div>
        </Link>
      </div>

      <Tabs
        items={[
          { id: 'services', label: 'Servicios y tarifas', icon: Wrench, count: services.length },
          { id: 'rooms', label: 'Salas', icon: DoorOpen, count: rooms.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando catálogo…</div>
      ) : tab === 'services' ? renderServices() : renderRooms()}

      <Modal
        open={serviceModal}
        onClose={() => setServiceModal(false)}
        title={editingService ? 'Editar servicio' : 'Nuevo servicio'}
        subtitle="Los cambios afectan a nuevas citas y facturas; el histórico se conserva"
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setServiceModal(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveService} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar servicio'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre" required className="sm:col-span-2">
              <input className={inputClass} value={serviceForm.name || ''} onChange={e => setServiceForm(prev => ({ ...prev, name: e.target.value }))} />
            </Field>
            <Field label="Especialidad">
              <select className={inputClass} value={serviceForm.specialty || CLINICAL_SPECIALTIES[0]} onChange={e => setServiceForm(prev => ({ ...prev, specialty: e.target.value as any }))}>
                {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
                <option value="administracion">Administración</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Sala por defecto">
              <select className={inputClass} value={serviceForm.room || ''} onChange={e => setServiceForm(prev => ({ ...prev, room: e.target.value }))}>
                <option value="">Sin sala</option>
                {rooms.filter(r => r.active).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Duración (minutos)" required>
              <input type="number" min={5} step={5} className={inputClass} value={serviceForm.durationMinutes ?? 45} onChange={e => setServiceForm(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))} />
            </Field>
            <Field label="Precio (€)" required>
              <input type="number" step="0.01" min={0} className={inputClass} value={serviceForm.price ?? 0} onChange={e => setServiceForm(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </Field>
            <Field label="IVA (%)" hint="0 si el servicio está exento.">
              <input type="number" step="0.5" min={0} className={inputClass} value={serviceForm.taxRate ?? 0} onChange={e => setServiceForm(prev => ({ ...prev, taxRate: Number(e.target.value) }))} />
            </Field>
            <div className="flex items-end pb-2">
              <Toggle checked={serviceForm.active !== false} onChange={value => setServiceForm(prev => ({ ...prev, active: value }))} label="Servicio activo" description="Disponible para nuevas citas." />
            </div>
          </div>
          <Field label="Descripción">
            <textarea rows={2} className={`${inputClass} resize-y`} value={serviceForm.description || ''} onChange={e => setServiceForm(prev => ({ ...prev, description: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={roomModal}
        onClose={() => setRoomModal(false)}
        title={editingRoom ? 'Editar sala' : 'Nueva sala'}
        subtitle="Organiza la ocupación del centro"
        accent="bg-slate-700"
        size="sm"
        footer={
          <>
            <button onClick={() => setRoomModal(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveRoom} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar sala'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <Field label="Nombre" required>
            <input className={inputClass} value={roomForm.name} onChange={e => setRoomForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej. Sala 1" />
          </Field>
          <Field label="Especialidad">
            <select className={inputClass} value={roomForm.specialty} onChange={e => setRoomForm(prev => ({ ...prev, specialty: e.target.value }))}>
              <option value="comun">Sala común</option>
              {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
            </select>
          </Field>
          <Toggle checked={roomForm.active} onChange={value => setRoomForm(prev => ({ ...prev, active: value }))} label="Sala activa" />
        </div>
      </Modal>
    </div>
  );
};

export default Services;
