import * as React from 'react';
import { Copy, Check } from 'lucide-react';

interface IdentifierPillProps {
  type: 'patient' | 'accession' | 'study';
  value: string;
  className?: string;
}

const labels = {
  patient:   'MRN',
  accession: 'ACC',
  study:     'UID',
};

export function IdentifierPill({ type, value, className = '' }: IdentifierPillProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy(e); }
      }}
      title={`Copy ${labels[type]}: ${value}`}
      aria-label={`Copy ${labels[type]}: ${value}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-200/80 bg-[#f4f7f5] hover:bg-[#edf2ee] text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer select-none max-w-full group shadow-2xs ${className}`}
    >
      <span className="text-[9px] uppercase font-sans font-bold text-slate-400 tracking-wider shrink-0">
        {labels[type]}
      </span>
      <span className="tracking-tight truncate text-slate-800 font-semibold">{value}</span>
      {copied
        ? <Check className="w-2.5 h-2.5 text-emerald-600 fade-in shrink-0" />
        : <Copy className="w-2.5 h-2.5 opacity-30 group-hover:opacity-70 shrink-0 text-slate-500" />
      }
    </span>
  );
}
