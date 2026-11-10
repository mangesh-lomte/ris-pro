import * as React from 'react';
import { Copy, Check } from 'lucide-react';

interface IdentifierPillProps {
  type: 'patient' | 'accession' | 'study';
  value: string;
  className?: string;
}

const styles = {
  patient:   'bg-emerald-50/80 text-[#15966A] border-emerald-200 hover:bg-emerald-100/80',
  accession: 'bg-sky-50/80 text-[#0284C7] border-sky-200 hover:bg-sky-100/80',
  study:     'bg-[#E8EDF9] text-[#33398A] border-[#33398A]/25 hover:bg-[#D5E1F7]',
};

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
    setTimeout(() => setCopied(false), 2000);
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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer select-none max-w-full ${styles[type]} ${className}`}
    >
      <span className="text-[9px] uppercase font-sans font-bold opacity-75 tracking-wider shrink-0">
        {labels[type]}
      </span>
      <span className="tracking-tight truncate">{value}</span>
      {copied
        ? <Check className="w-3 h-3 text-[#15966A] fade-in shrink-0" />
        : <Copy className="w-3 h-3 opacity-35 group-hover:opacity-80 shrink-0" />
      }
    </span>
  );
}
