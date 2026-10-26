import React, { useMemo } from 'react';
import { RotateCcw, MapPin } from 'lucide-react';
import { BODY_ZONES, BodyZone } from '../../data/clinicalCatalog';
import { btnGhost } from '../ui';

/**
 * Mapa corporal de dolor. Vista anterior y posterior.
 * Las zonas se seleccionan con un clic y se colorean según la EVA.
 * Nota anatómica: en la vista anterior la izquierda del dibujo es la
 * derecha del paciente, por lo que la etiqueta visible se invierte.
 */
const anatomicalLabel = (zone: BodyZone): string => {
  if (zone.view !== 'anterior') return zone.label;
  return zone.label.replace('izquierd', 'TMP').replace('derech', 'izquierd').replace('TMP', 'derech');
};

const painFill = (eva: number): string => {
  if (eva <= 0) return '#a8a29e';
  if (eva <= 3) return '#6ba58a';
  if (eva <= 6) return '#e0a33e';
  return '#cf5b52';
};

interface BodyMapProps {
  selected: string[];
  onChange?: (zones: string[]) => void;
  eva?: number;
  readOnly?: boolean;
  compact?: boolean;
}

const BodyMap: React.FC<BodyMapProps> = ({ selected, onChange, eva = 5, readOnly, compact }) => {
  const fill = painFill(eva);
  const toggle = (id: string) => {
    if (readOnly || !onChange) return;
    onChange(selected.includes(id) ? selected.filter(z => z !== id) : [...selected, id]);
  };

  const selectedZones = useMemo(
    () => BODY_ZONES.filter(z => selected.includes(z.id)),
    [selected]
  );

  const renderView = (view: 'anterior' | 'posterior') => {
    const zones = BODY_ZONES.filter(z => z.view === view);
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
          {view === 'anterior' ? 'Vista anterior' : 'Vista posterior'}
        </p>
        <svg
          viewBox="0 0 200 430"
          className={`mx-auto w-full ${compact ? 'max-h-[280px]' : 'max-h-[420px]'}`}
          role="img"
          aria-label={`Mapa corporal ${view}`}
        >
          <g fill="#f5f5f4" stroke="#d6d3d1" strokeWidth="1.5">
            <circle cx="100" cy="34" r="22" />
            <rect x="88" y="54" width="24" height="16" rx="7" />
            <path d="M68 88 Q100 76 132 88 L128 176 Q100 194 72 176 Z" />
            <path d="M72 188 Q100 200 128 188 L126 210 Q100 220 74 210 Z" />
            {/* brazos */}
            <path d="M68 96 L48 130 L40 196" fill="none" strokeWidth="17" strokeLinecap="round" />
            <path d="M132 96 L152 130 L160 196" fill="none" strokeWidth="17" strokeLinecap="round" />
            {/* piernas */}
            <path d="M84 202 L82 300 L82 390" fill="none" strokeWidth="22" strokeLinecap="round" />
            <path d="M116 202 L118 300 L118 390" fill="none" strokeWidth="22" strokeLinecap="round" />
            {/* pies */}
            <ellipse cx="78" cy="408" rx="14" ry="8" />
            <ellipse cx="122" cy="408" rx="14" ry="8" />
          </g>

          {zones.map(zone => {
            const active = selected.includes(zone.id);
            return (
              <g key={zone.id} onClick={() => toggle(zone.id)} className={readOnly ? '' : 'cursor-pointer'}>
                <ellipse
                  cx={zone.cx}
                  cy={zone.cy}
                  rx={zone.rx}
                  ry={zone.ry}
                  fill={active ? fill : 'transparent'}
                  fillOpacity={active ? 0.55 : 0}
                  stroke={active ? fill : '#a8a29e'}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={active ? undefined : '3 4'}
                  strokeOpacity={active ? 1 : 0}
                  className={readOnly ? '' : 'transition-all hover:fill-stone-300/40 hover:stroke-stone-300'}
                >
                  <title>{anatomicalLabel(zone)}</title>
                </ellipse>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <MapPin size={14} />
          <span>{selected.length} zona(s) marcada(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-stone-400">
            EVA {eva}/10
            <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: fill }} />
          </span>
          {!readOnly && selected.length > 0 && (
            <button type="button" onClick={() => onChange?.([])} className={`${btnGhost} !px-2 !py-1 text-[11px]`}>
              <RotateCcw size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-2 sm:gap-4 sm:p-3">
        {renderView('anterior')}
        {renderView('posterior')}
      </div>

      {selectedZones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedZones.map(zone => (
            <span
              key={zone.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600"
            >
              {anatomicalLabel(zone)}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggle(zone.id)}
                  className="text-stone-300 hover:text-red-500"
                  aria-label={`Quitar ${anatomicalLabel(zone)}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default BodyMap;
