import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, CalendarDays, Users, Wallet, Settings, UserCog, ClipboardList, Sparkles,
  MessageSquare, LogOut, Menu, X, Bell, ChevronRight, Wrench, BarChart3, Inbox,
  HeartPulse, Apple, MessageCircle, Brain, ShieldCheck, CircleHelp, Database, FileCheck2,
} from 'lucide-react';
import { User, UserRole, Notification } from '../types';
import { getProfessionalLabel, getRoleProfile, isClinicalRole } from '../constants';
import { dbService, isDemoMode } from '../services/dbService';
import { hasPermission, isAdmin } from '../services/permissions';
import Brand from './Brand';
import { Avatar } from './ui';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  section: string;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingReservations, setPendingReservations] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    if (isAdmin(user)) loadPendingReservations();
    setIsSidebarOpen(false);
    setShowNotifications(false);
  }, [user, location.pathname]);

  const loadNotifications = async () => {
    if (!user) return;
    try { setNotifications(await dbService.getNotifications(user.id)); } catch { setNotifications([]); }
  };

  const loadPendingReservations = async () => {
    try {
      const data = await dbService.getReservationRequests('pendiente');
      setPendingReservations(data.length);
    } catch { setPendingReservations(0); }
  };

  const specialty = user && isClinicalRole(user.role) ? user.role : null;
  const roleProfile = getRoleProfile(user?.role);
  const admin = user ? isAdmin(user) : false;

  const navGroups = useMemo(() => {
    if (!user) return [] as { label: string; items: NavItem[] }[];

    if (admin) {
      const groups = [
        {
          label: 'Centro',
          items: [
            { name: 'Inicio', path: '/', icon: <Activity size={19} />, section: 'Centro' },
            { name: 'Agenda global', path: '/appointments', icon: <CalendarDays size={19} />, section: 'Centro' },
            { name: 'Pacientes', path: '/patients', icon: <Users size={19} />, section: 'Centro' },
            { name: 'Solicitudes web', path: '/reservations', icon: <Inbox size={19} />, badge: pendingReservations, section: 'Centro' },
          ],
        },
        {
          label: 'Gestión',
          items: [
            { name: 'Facturación y cobros', path: '/billing', icon: <Wallet size={19} />, section: 'Gestión' },
            { name: 'Servicios y bonos', path: '/services', icon: <Wrench size={19} />, section: 'Gestión' },
            { name: 'Estadísticas', path: '/reports', icon: <BarChart3 size={19} />, section: 'Gestión' },
            { name: 'Profesionales', path: '/professionals', icon: <UserCog size={19} />, section: 'Gestión' },
          ],
        },
        {
          label: 'Sistema',
          items: [
            { name: 'Mensajes internos', path: '/messages', icon: <MessageSquare size={19} />, section: 'Sistema' },
            { name: 'Plantillas legales', path: '/document-templates', icon: <FileCheck2 size={19} />, section: 'Sistema' },
            { name: 'Configuración', path: '/settings', icon: <Settings size={19} />, section: 'Sistema' },
            { name: 'Auditoría', path: '/audit', icon: <ShieldCheck size={19} />, section: 'Sistema' },
          ],
        },
      ];
      return groups;
    }

    const clinicalHome = specialty ? `/clinical/${specialty}` : '/';
    return [
      {
        label: 'Mi consulta',
        items: [
          { name: 'Inicio', path: '/', icon: <Activity size={19} />, section: 'Consulta' },
          { name: 'Mi agenda', path: '/appointments', icon: <CalendarDays size={19} />, section: 'Consulta' },
          { name: 'Mis pacientes', path: '/patients', icon: <Users size={19} />, section: 'Consulta' },
          { name: 'Herramientas clínicas', path: clinicalHome, icon: <ClipboardList size={19} />, section: 'Consulta' },
        ],
      },
      {
        label: 'Equipo',
        items: [
          { name: 'Mensajes internos', path: '/messages', icon: <MessageSquare size={19} />, section: 'Equipo' },
        ],
      },
    ];
  }, [user, admin, specialty, pendingReservations]);

  const allItems = navGroups.flatMap(g => g.items);
  const mobileItems = allItems.filter(i => ['/', '/appointments', '/patients', specialty ? `/clinical/${specialty}` : '', '/billing'].includes(i.path)).slice(0, 4);

  if (!user) return <>{children}</>;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const SidebarContent = (
    <>
      <div className="flex h-20 shrink-0 items-center justify-between px-5">
        <Link to="/" className="flex items-center"><Brand size="sm" /></Link>
        <button onClick={() => setIsSidebarOpen(false)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 lg:hidden">
          <X size={20} />
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-2xl border border-stone-200/70 bg-stone-50/80 p-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${roleProfile.solid}`}>
            {specialty === UserRole.PSICOLOGIA ? <Brain size={16} /> :
              specialty === UserRole.FISIOTERAPIA ? <HeartPulse size={16} /> :
              specialty === UserRole.LOGOPEDIA ? <MessageCircle size={16} /> :
              specialty === UserRole.NUTRICION ? <Apple size={16} /> : <ShieldCheck size={16} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-stone-800">{roleProfile.label}</p>
            <p className="truncate text-[11px] text-stone-400">{specialty ? 'Perfil clínico' : 'Perfil administrativo'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map(group => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? `${roleProfile.navActive} shadow-sm`
                      : 'border-transparent text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                  }`}
                >
                  <span className={isActive(item.path) ? roleProfile.text : 'text-stone-400 group-hover:text-stone-600'}>{item.icon}</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  {!!item.badge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{item.badge}</span>
                  )}
                  {isActive(item.path) && <ChevronRight size={14} className="text-stone-400" />}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-stone-200/70 p-3">
        <div className="rounded-2xl bg-stone-50 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} url={user.avatarUrl} size={38} className="ring-2 ring-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
              <p className="truncate text-[11px] text-stone-500">{getProfessionalLabel(user)}</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-white hover:text-red-600">
              <LogOut size={17} />
            </button>
          </div>
          {isDemoMode && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
              <Sparkles size={11} /> Entorno de demostración
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-stone-300">Sinestesya · v2.0</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f5f0]">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-20 bg-stone-950/30 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[276px] flex-col border-r border-stone-200/80 bg-white/95 shadow-xl backdrop-blur transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-none ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {SidebarContent}
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior móvil */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100">
            <Menu size={22} />
          </button>
          <Link to="/"><Brand size="sm" showText subtitle={false} /></Link>
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative rounded-lg p-2 text-stone-500 hover:bg-stone-100">
            <Bell size={21} />
            {(notifications.length + pendingReservations) > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {notifications.length + pendingReservations}
              </span>
            )}
          </button>
        </header>

        {/* Barra de utilidades escritorio */}
        <div className="hidden shrink-0 items-center justify-between border-b border-stone-200/60 bg-white/60 px-8 py-2.5 backdrop-blur lg:flex">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold text-stone-700">{getProfessionalLabel(user)}</span>
            <span className="text-stone-300">·</span>
            <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <Sparkles size={12} /> Datos de demostración
              </span>
            )}
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <Bell size={18} />
              {(notifications.length + pendingReservations) > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {notifications.length + pendingReservations}
                </span>
              )}
            </button>
          </div>
        </div>

        {showNotifications && (
          <div className="absolute right-4 top-16 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl lg:right-8 lg:top-24">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="text-sm font-bold text-stone-800">Avisos</p>
              <button onClick={() => setShowNotifications(false)} className="text-stone-400 hover:text-stone-700"><X size={16} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {pendingReservations > 0 && (
                <Link to="/reservations" onClick={() => setShowNotifications(false)} className="flex items-start gap-2 rounded-xl p-3 hover:bg-stone-50">
                  <Inbox size={16} className="mt-0.5 text-logo-500" />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{pendingReservations} solicitud(es) web</p>
                    <p className="text-xs text-stone-500">Pendientes de confirmar en agenda.</p>
                  </div>
                </Link>
              )}
              {notifications.map(n => (
                <div key={n.id} className="rounded-xl p-3 hover:bg-stone-50">
                  <p className="text-sm font-semibold text-stone-800">{n.title}</p>
                  <p className="text-xs text-stone-500">{n.message}</p>
                </div>
              ))}
              {!notifications.length && !pendingReservations && (
                <p className="px-3 py-8 text-center text-sm text-stone-400">Sin avisos pendientes.</p>
              )}
            </div>
          </div>
        )}

        {isDemoMode && (
          <div className="border-b border-amber-200/70 bg-amber-50/80 px-4 py-2 text-center text-[11px] font-medium text-amber-800 lg:px-8">
            Entorno de demostración con datos ficticios marcados como demo. No introduzcas datos clínicos reales.
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>

        {/* Navegación inferior móvil */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-stone-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
          {mobileItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold ${
                isActive(item.path) ? roleProfile.text : 'text-stone-400'
              }`}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.name.replace(' global', '').replace(' y cobros', '').replace('Herramientas clínicas', 'Consulta')}</span>
            </Link>
          ))}
          <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold text-stone-400">
            <Menu size={19} />
            <span>Más</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
