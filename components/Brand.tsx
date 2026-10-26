import React from 'react';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: boolean;
  inverse?: boolean;
  className?: string;
}

/**
 * Identidad visual de Sinestesya: cuatro trazos orgánicos que se
 * entrelazan (una por especialidad) alrededor de un núcleo común.
 */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <rect width="64" height="64" rx="18" fill="#FBF8F2" />
    <path
      d="M32 12c7.4 0 13.4 5.9 13.4 13.2 0 5.5-3.4 10.2-8.3 12.1 5 1.9 8.4 6.7 8.4 12.2C45.5 56.8 39.4 62 32 62"
      stroke="#C9A227" strokeWidth="3.2" strokeLinecap="round"
    />
    <path
      d="M32 12c-7.4 0-13.4 5.9-13.4 13.2 0 5.5 3.4 10.2 8.3 12.1-5 1.9-8.4 6.7-8.4 12.2C18.5 56.8 24.6 62 32 62"
      stroke="#4F8A70" strokeWidth="3.2" strokeLinecap="round"
    />
    <path
      d="M18.4 32c0-7.4 5.9-13.4 13.2-13.4 5.5 0 10.2 3.4 12.1 8.3 1.9-5 6.7-8.4 12.2-8.4 7.3 0 12.1 6.1 12.1 13.5"
      stroke="#4A7FB5" strokeWidth="3.2" strokeLinecap="round" transform="translate(-10 0)"
    />
    <path
      d="M18.4 32c0 7.4 5.9 13.4 13.2 13.4 5.5 0 10.2-3.4 12.1-8.3 1.9 5 6.7 8.4 12.2 8.4 7.3 0 12.1-6.1 12.1-13.5"
      stroke="#D9824B" strokeWidth="3.2" strokeLinecap="round" transform="translate(-10 0)"
    />
    <circle cx="32" cy="32" r="4.2" fill="#2F3A36" />
  </svg>
);

export const Brand: React.FC<BrandProps> = ({
  size = 'md', showText = true, subtitle = true, inverse = false, className = '',
}) => {
  const markSize = size === 'sm' ? 34 : size === 'lg' ? 56 : 42;
  const titleSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BrandMark size={markSize} className="shrink-0 shadow-sm ring-1 ring-black/5" />
      {showText && (
        <div className="leading-none">
          <p className={`font-display ${titleSize} tracking-tight ${inverse ? 'text-white' : 'text-stone-900'}`}>
            sinestesya
          </p>
          {subtitle && (
            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] ${inverse ? 'text-white/60' : 'text-stone-400'}`}>
              salud integral
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Brand;
