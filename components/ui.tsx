import React from 'react';
import { X, LucideIcon } from 'lucide-react';
import { ClinicalSpecialty } from '../types';
import { getRoleProfile } from '../constants';

// ------------------------------------------------------------
// Clases compartidas
// ------------------------------------------------------------

export const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60 transition-shadow';

export const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-300 disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 focus:outline-none focus:ring-4 focus:ring-stone-200 disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100';

export const cardClass = 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(41,37,36,0.04)]';

// ------------------------------------------------------------
// Badge
// ------------------------------------------------------------

export const Badge: React.FC<{
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}> = ({ children, className = '', dot }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${className || 'border-stone-200 bg-stone-50 text-stone-600'}`}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
    {children}
  </span>
);

export const SpecialtyBadge: React.FC<{ specialty?: ClinicalSpecialty | string | null; className?: string }> = ({
  specialty, className = '',
}) => {
  if (!specialty) return null;
  const profile = getRoleProfile(specialty);
  return <Badge className={`${profile.soft} ${profile.text} ${profile.border} ${className}`}>{profile.label}</Badge>;
};

// ------------------------------------------------------------
// Cabecera de página
// ------------------------------------------------------------

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  accent?: string;
}> = ({ eyebrow, title, description, icon: Icon, actions, accent = 'bg-stone-800' }) => (
  <div className="flex flex-col gap-4 border-b border-stone-200/80 pb-5 md:flex-row md:items-end md:justify-between">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${accent}`}>
          <Icon size={21} />
        </div>
      )}
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">{eyebrow}</p>}
        <h1 className="font-display text-2xl text-stone-900 md:text-[28px] md:leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-stone-500">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

// ------------------------------------------------------------
// Tarjetas
// ------------------------------------------------------------

export const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: 'neutral' | 'green' | 'blue' | 'orange' | 'yellow' | 'red' | 'violet';
  onClick?: () => void;
}> = ({ title, value, icon: Icon, hint, tone = 'neutral', onClick }) => {
  const tones: Record<string, string> = {
    neutral: 'bg-stone-100 text-stone-600',
    green: 'bg-fisio-50 text-fisio-700',
    blue: 'bg-logo-50 text-logo-700',
    orange: 'bg-nutri-50 text-nutri-700',
    yellow: 'bg-psy-50 text-psy-700',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div
      onClick={onClick}
      className={`${cardClass} flex items-center gap-4 overflow-hidden p-4 md:p-5 ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
    >
      {Icon && <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19} /></div>}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-stone-400">{title}</p>
        <p className="mt-0.5 text-xl font-bold leading-tight text-stone-900 md:text-[22px]">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-tight text-stone-400">{hint}</p>}
      </div>
    </div>
  );
};

export const SectionCard: React.FC<{
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ title, description, actions, children, className = '', padded = true }) => (
  <section className={`${cardClass} ${className}`}>
    {(title || actions) && (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          {title && <h2 className="text-sm font-bold text-stone-800">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={padded ? 'p-5' : ''}>{children}</div>
  </section>
);

// ------------------------------------------------------------
// Estado vacío / alertas
// ------------------------------------------------------------

export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    {Icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400"><Icon size={22} /></div>}
    <p className="text-sm font-semibold text-stone-700">{title}</p>
    {description && <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const InlineAlert: React.FC<{
  level?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ level = 'info', title, children, action, className = '' }) => {
  const styles = {
    info: 'border-logo-200 bg-logo-50/70 text-logo-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-fisio-200 bg-fisio-50 text-fisio-900',
  };
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${styles[level]} ${className}`}>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5 text-[13px] opacity-90' : ''}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

// ------------------------------------------------------------
// Modal
// ------------------------------------------------------------

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  accent?: string;
  bodyClassName?: string;
}> = ({ open, onClose, title, subtitle, children, footer, size = 'md', accent = 'bg-stone-800', bodyClassName = 'p-5 md:p-6' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[94vh] w-full ${sizes[size]} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-9 w-1.5 shrink-0 rounded-full ${accent}`} />
            <div>
              <h2 className="font-display text-xl text-stone-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-4 md:px-6">{footer}</div>}
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Pestañas
// ------------------------------------------------------------

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export const Tabs: React.FC<{
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  accent?: string;
  className?: string;
  fullWidth?: boolean;
}> = ({ items, active, onChange, accent = 'border-stone-800 text-stone-900', className = '', fullWidth }) => (
  <div className={`flex gap-1 overflow-x-auto border-b border-stone-200/80 ${className}`} role="tablist">
    {items.map(item => {
      const Icon = item.icon;
      const selected = active === item.id;
      return (
        <button
          key={item.id}
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(item.id)}
          className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${fullWidth ? 'flex-1 justify-center' : ''} ${
            selected ? accent : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {Icon && <Icon size={16} />}
          <span>{item.label}</span>
          {typeof item.count === 'number' && (
            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">{item.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

// ------------------------------------------------------------
// Formularios
// ------------------------------------------------------------

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
  required?: boolean;
}> = ({ label, children, hint, className = '', required }) => (
  <div className={className}>
    <label className={labelClass}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
  </div>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-stone-800' : 'bg-stone-200'}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
    {(label || description) && (
      <span>
        {label && <span className="block text-sm font-semibold text-stone-800">{label}</span>}
        {description && <span className="mt-0.5 block text-xs text-stone-500">{description}</span>}
      </span>
    )}
  </label>
);

export const ProgressBar: React.FC<{ value: number; className?: string; tone?: string }> = ({
  value, className = '', tone = 'bg-stone-800',
}) => (
  <div className={`h-2 overflow-hidden rounded-full bg-stone-100 ${className}`}>
    <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

// ------------------------------------------------------------
// Avatar
// ------------------------------------------------------------

export const Avatar: React.FC<{ name?: string; url?: string; size?: number; className?: string }> = ({
  name, url, size = 40, className = '',
}) => {
  const initials = (name || 'S').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200 font-semibold text-stone-600 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? <img src={url} alt={name || ''} className="h-full w-full object-cover" /> : initials}
    </div>
  );
};
