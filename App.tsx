import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import AccessDenied from './components/AccessDenied';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SpecialtyWorkspace from './pages/SpecialtyWorkspace';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Billing from './pages/Billing';
import Services from './pages/Services';
import Reports from './pages/Reports';
import Professionals from './pages/Professionals';
import ReservationRequests from './pages/ReservationRequests';
import Settings from './pages/Settings';
import Audit from './pages/Audit';
import TeamChat from './pages/TeamChat';
import SystemInfo from './pages/SystemInfo';
import { dbService } from './services/dbService';
import { User, UserRole, ClinicalSpecialty } from './types';
import { canAccessRoute, canViewSpecialty, hasPermission } from './services/permissions';
import { getRoleProfile } from './constants';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = localStorage.getItem('sinestesya_user');
        if (stored) setUser(JSON.parse(stored));
        const fresh = await dbService.getSession();
        if (fresh) {
          setUser(fresh);
          localStorage.setItem('sinestesya_user', JSON.stringify(fresh));
        } else if (stored) {
          localStorage.removeItem('sinestesya_user');
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    document.title = user ? `Sinestesya · ${getRoleProfile(user.role).label}` : 'Sinestesya · Salud integral';
  }, [user]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('sinestesya_user', JSON.stringify(newUser));
  };

  const handleLogout = async () => {
    await dbService.logout();
    setUser(null);
    localStorage.removeItem('sinestesya_user');
    localStorage.removeItem('sinestesya_token');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
          <p className="text-sm">Cargando Sinestesya…</p>
        </div>
      </div>
    );
  }

  const Guard: React.FC<{ children: React.ReactNode; permissionPath?: string; allowed?: boolean }> = ({
    children, permissionPath, allowed,
  }) => {
    if (!user) return <Navigate to="/login" replace />;
    const ok = allowed !== undefined ? allowed : permissionPath ? canAccessRoute(user, permissionPath) : true;
    return ok ? <>{children}</> : <AccessDenied user={user} />;
  };

  const SpecialtyRoute: React.FC = () => {
    const { specialty } = useParams<{ specialty: string }>();
    if (!user) return <Navigate to="/login" replace />;
    const valid = ['psicologia', 'fisioterapia', 'logopedia', 'nutricion'].includes(specialty || '');
    if (!valid) return <Navigate to="/" replace />;
    if (!canViewSpecialty(user, specialty as ClinicalSpecialty)) {
      return <AccessDenied user={user} title="Herramientas de otra especialidad" message="Cada profesional accede únicamente a las herramientas clínicas de su especialidad. Administración puede consultar si dispone de autorización expresa." />;
    }
    return <SpecialtyWorkspace user={user} specialty={specialty as ClinicalSpecialty} />;
  };

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />} />

          <Route path="/" element={<Guard><Dashboard user={user!} /></Guard>} />

          <Route path="/clinical/:specialty" element={<SpecialtyRoute />} />

          <Route path="/patients" element={<Guard permissionPath="/patients"><Patients user={user!} /></Guard>} />
          <Route path="/patient/:id" element={<Guard><PatientDetail user={user!} /></Guard>} />

          <Route path="/appointments" element={<Guard permissionPath="/appointments"><Appointments user={user!} /></Guard>} />

          <Route path="/billing" element={<Guard permissionPath="/billing"><Billing user={user!} /></Guard>} />
          <Route path="/accounting" element={<Navigate to="/billing" replace />} />

          <Route path="/services" element={<Guard permissionPath="/services"><Services user={user!} /></Guard>} />
          <Route path="/reports" element={<Guard permissionPath="/reports"><Reports user={user!} /></Guard>} />

          <Route path="/professionals" element={<Guard permissionPath="/professionals"><Professionals user={user!} /></Guard>} />
          <Route path="/reservations" element={<Guard permissionPath="/reservations"><ReservationRequests user={user!} /></Guard>} />

          <Route path="/settings" element={<Guard permissionPath="/settings"><Settings user={user!} /></Guard>} />
          <Route path="/audit" element={<Guard permissionPath="/audit"><Audit user={user!} /></Guard>} />
          <Route path="/system" element={<Guard permissionPath="/system"><SystemInfo /></Guard>} />

          <Route path="/messages" element={<Guard allowed={hasPermission(user, 'messages.use')}><TeamChat user={user!} /></Guard>} />
          <Route path="/chat" element={<Navigate to="/messages" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
