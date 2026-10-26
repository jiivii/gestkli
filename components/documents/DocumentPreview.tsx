import React from 'react';
import { FileText, Fingerprint, ShieldCheck } from 'lucide-react';
import { ASSURANCE_LABELS } from '../../services/documentTemplates';
import { SignatureAssurance } from '../../types';

interface Props {
  title: string;
  text: string;
  contentSha256?: string;
  templateName?: string;
  templateVersion?: number;
  version?: number;
  centerName?: string;
  documentId?: string;
  assurance?: SignatureAssurance | null;
  className?: string;
  showHeader?: boolean;
}

const renderInline = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-stone-900">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });

/**
 * Vista de lectura de un snapshot documental. No interpreta HTML ni ejecuta
 * contenido: el texto aprobado se muestra como texto, con formato mínimo.
 */
const DocumentPreview: React.FC<Props> = ({
  title, text, contentSha256, templateName, templateVersion, version, centerName,
  documentId, assurance, className = '', showHeader = true,
}) => {
  const lines = String(text || '').split('\n');
  const blocks: React.ReactNode[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/\s+$/g, '');
    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (line.trim() === '---') {
      blocks.push(<hr key={`hr-${index}`} className="my-5 border-stone-200" />);
      return;
    }
    if (line.startsWith('### ')) {
      blocks.push(<h4 key={index} className="mt-4 text-[13px] font-bold uppercase tracking-wide text-stone-700">{line.slice(4)}</h4>);
      return;
    }
    if (line.startsWith('## ')) {
      blocks.push(<h3 key={index} className="mt-5 font-display text-lg text-stone-900">{line.slice(3)}</h3>);
      return;
    }
    if (line.startsWith('# ')) {
      blocks.push(<h2 key={index} className="mt-5 font-display text-xl text-stone-900">{line.slice(2)}</h2>);
      return;
    }
    const checkbox = line.match(/^- \[( |x|X)\]\s*(.*)$/);
    if (checkbox) {
      blocks.push(
        <div key={index} className="flex items-start gap-2 py-0.5 text-[13px] leading-relaxed text-stone-700">
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${checkbox[1].toLowerCase() === 'x' ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white text-transparent'}`}>✓</span>
          <span>{renderInline(checkbox[2])}</span>
        </div>,
      );
      return;
    }
    if (line.startsWith('- ')) {
      blocks.push(
        <div key={index} className="flex items-start gap-2 py-0.5 text-[13px] leading-relaxed text-stone-700">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
      return;
    }
    blocks.push(
      <p key={index} className="py-0.5 text-[13px] leading-relaxed text-stone-700">{renderInline(line)}</p>,
    );
  });

  return (
    <div className={`rounded-2xl border border-stone-200 bg-white ${className}`}>
      {showHeader && (
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-stone-500 shadow-sm">
              <FileText size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{centerName || 'Sinestesya · Salud Integral'}</p>
              <h3 className="truncate text-sm font-bold text-stone-900">{title}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stone-500">
                {templateName && <span>{templateName}</span>}
                {!!templateVersion && <span>Plantilla v{templateVersion}</span>}
                {!!version && <span>Documento v{version}</span>}
                {documentId && <span>ID {documentId.slice(0, 12)}…</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-h-[58vh] overflow-y-auto px-5 py-4 md:px-7">
        {blocks}
      </div>
      <div className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-[10px] text-stone-500">
          <Fingerprint size={13} className="shrink-0" />
          <span className="truncate">SHA-256 del contenido: {contentSha256 || 'pendiente de cálculo'}</span>
        </div>
        {assurance && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-stone-600">
            <ShieldCheck size={13} /> {ASSURANCE_LABELS[assurance] || assurance}
          </span>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
