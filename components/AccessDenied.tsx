import React from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ArrowLeft } from 'lucide-react';
import { User } from '../types';
import { getRoleProfile } from '../constants';

const AccessDenied: React.FC<{ user?: User | null; title?: string; message?: string }> = ({
  user, title = 'Acceso no autorizado', message,
}) => {
  const role = getRoleProfile(user?.role);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ${role.soft} ${role.text}`}>
        <LockKeyhole size={28} />
      </div>
      <h1 className="font-display text-2xl text-stone-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">
        {message || 'Tu perfil no tiene permiso para acceder a esta sección. Si necesitas acceso, solicita la autorización expresa a administración.'}
      </p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50">
        <ArrowLeft size={16} /> Volver a mi inicio
      </Link>
      <p className="mt-4 text-[11px] text-stone-400">Perfil actual: {role.label}</p>
    </div>
  );
};

export default AccessDenied;
