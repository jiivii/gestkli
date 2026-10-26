import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Mail, Lock, AlertTriangle, ArrowRight, HeartPulse, Apple,
  MessageCircle, Brain, Shield, Sparkles, Eye, EyeOff, CheckCircle2,
} from 'lucide-react';
import { dbService, isDemoMode } from '../services/dbService';
import { User, UserRole } from '../types';
import { DEMO_PROFILES } from '../services/demoStore';
import { Brand } from '../components/Brand';
import { getRoleProfile } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

const roleIcon = (role: UserRole, size = 18) => {
  switch (role) {
    case UserRole.PSICOLOGIA: return <Brain size={size} />;
    case UserRole.FISIOTERAPIA: return <HeartPulse size={size} />;
    case UserRole.LOGOPEDIA: return <MessageCircle size={size} />;
    case UserRole.NUTRICION: return <Apple size={size} />;
    default: return <Shield size={size} />;
  }
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState('');
  const navigate = useNavigate();

  const finishLogin = (user: User) => {
    onLogin(user);
    navigate('/', { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await dbService.login(email, password);
    if (result) {
      localStorage.setItem('sinestesya_token', result.token);
      finishLogin(result.user);
    } else {
      setError(isDemoMode
        ? 'Correo no encontrado en la demostración. Usa uno de los perfiles inferiores.'
        : 'Credenciales no válidas o error de conexión. Revisa tu cuenta.');
    }
    setIsLoading(false);
  };

  const demoAccess = async (demoEmail: string) => {
    setLoadingEmail(demoEmail);
    setError('');
    const result = await dbService.login(demoEmail, 'demo');
    if (result) finishLogin(result.user);
    else setError('No se pudo iniciar la sesión de demostración.');
    setLoadingEmail('');
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panel visual */}
      <section className="relative hidden overflow-hidden bg-stone-900 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-90">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-psy-500/20 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-fisio-500/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-nutri-500/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 h-64 w-64 rounded-full bg-logo-500/20 blur-3xl" />
        </div>
        <div className="relative z-10">
          <Brand size="lg" inverse />
          <p className="mt-8 max-w-md font-display text-3xl leading-tight text-white/90 xl:text-4xl">
            Cada especialidad, en su lugar.
            <br />
            <span className="text-white/55">Una sola historia, bien protegida.</span>
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
            Plataforma clínica y administrativa para psicología, fisioterapia, logopedia y nutrición,
            con acceso segmentado por especialidad y trazabilidad completa.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {[
            { role: UserRole.PSICOLOGIA, text: 'Psicología', desc: 'Evaluación y psicometría' },
            { role: UserRole.FISIOTERAPIA, text: 'Fisioterapia', desc: 'Dolor y evolución física' },
            { role: UserRole.LOGOPEDIA, text: 'Logopedia', desc: 'Lenguaje y comunicación' },
            { role: UserRole.NUTRICION, text: 'Nutrición', desc: 'Antropometría y planes' },
          ].map(item => {
            const config = getRoleProfile(item.role);
            return (
              <div key={item.role} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${config.solid} text-white`}>
                  {roleIcon(item.role, 16)}
                </div>
                <p className="text-sm font-semibold text-white">{item.text}</p>
                <p className="mt-0.5 text-[11px] text-white/50">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[11px] text-white/40">
          <ShieldCheck size={14} />
          <span>RGPD · LOPDGDD · Datos clínicos segmentados por especialidad</span>
        </div>
      </section>

      {/* Acceso */}
      <section className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand size="md" />
          </div>

          <div className="mb-7">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Acceso profesionales</p>
            <h1 className="font-display text-3xl text-stone-900">Bienvenido/a</h1>
            <p className="mt-2 text-sm text-stone-500">
              {isDemoMode
                ? 'Estás en el entorno de demostración. Elige un perfil para explorar la aplicación con datos de ejemplo.'
                : 'Introduce tus credenciales corporativas para acceder a tu espacio de trabajo.'}
            </p>
          </div>

          {isDemoMode && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
              <Sparkles size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Modo demostración activo</p>
                <p className="mt-0.5 text-amber-700">Los datos mostrados son ficticios y están marcados como demo. No introduzcas información clínica real.</p>
              </div>
            </div>
          )}

          {!isDemoMode && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Correo corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 text-stone-400" size={18} />
                  <input
                    type="email"
                    className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60"
                    placeholder="nombre@sinestesya.es"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 text-stone-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-11 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <AlertTriangle size={14} /> {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 disabled:opacity-50"
              >
                {isLoading ? 'Conectando…' : 'Iniciar sesión'}
                {!isLoading && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          {isDemoMode && (
            <div className="space-y-2.5">
              {DEMO_PROFILES.map(({ user: demoUser, description }) => {
                const config = getRoleProfile(demoUser.role);
                const isLoadingThis = loadingEmail === demoUser.email;
                return (
                  <button
                    key={demoUser.id}
                    onClick={() => demoAccess(demoUser.email)}
                    disabled={!!loadingEmail}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md disabled:opacity-60"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${config.solid}`}>
                      {roleIcon(demoUser.role, 19)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-stone-900">{config.label}</p>
                        <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-400">Demo</span>
                      </div>
                      <p className="truncate text-xs text-stone-500">{demoUser.name} · {description}</p>
                    </div>
                    {isLoadingThis
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
                      : <ArrowRight size={17} className="text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-600" />}
                  </button>
                );
              })}

              <details className="pt-2">
                <summary className="cursor-pointer text-center text-xs font-medium text-stone-400 hover:text-stone-600">
                  Acceder con correo y contraseña de demostración
                </summary>
                <form onSubmit={handleLogin} className="mt-3 space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 text-stone-400" size={17} />
                    <input
                      type="email"
                      className="w-full rounded-lg border border-stone-200 py-2.5 pl-10 pr-3 text-sm focus:border-stone-400 focus:outline-none"
                      placeholder="admin@sinestesya.es"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-2.5 text-stone-400" size={17} />
                    <input
                      type="password"
                      className="w-full rounded-lg border border-stone-200 py-2.5 pl-10 pr-3 text-sm focus:border-stone-400 focus:outline-none"
                      placeholder="Contraseña: demo"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">
                    {isLoading ? 'Conectando…' : 'Entrar'}
                  </button>
                </form>
              </details>
            </div>
          )}

          {!isDemoMode && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-xs text-stone-500">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-fisio-600" />
              <p>Acceso restringido a personal autorizado. Todas las consultas y modificaciones quedan registradas en la auditoría del centro.</p>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-2 border-t border-stone-200 pt-5 text-center">
            <p className="text-[11px] text-stone-400">
              © {new Date().getFullYear()} Sinestesya Salud Integral · Protección de datos y confidencialidad clínica
            </p>
            {isDemoMode && (
              <button onClick={() => dbService.resetDemo()} className="text-[11px] font-medium text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">
                Reiniciar datos de demostración
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
