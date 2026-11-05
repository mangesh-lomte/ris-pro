import * as React from 'react';
import { Copy, Check } from 'lucide-react';

interface IdentifierPillProps {
  type: 'patient' | 'accession' | 'study';
  value: string;
}

export function IdentifierPill({ type, value }: IdentifierPillProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorStyles = {
    patient: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
    accession: 'bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100',
    study: 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100',
  };

  const labelPrefix = {
    patient: 'MRN',
    accession: 'ACC',
    study: 'UID',
  };

  return (
    <span
      onClick={handleCopy}
      title="Click to copy identifier (Single Source of Truth)"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-medium transition-colors cursor-pointer select-none ${colorStyles[type]}`}
    >
      <span className="text-[10px] uppercase font-sans font-bold opacity-70">
        {labelPrefix[type]}:
      </span>
      <span>{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600 animate-in fade-in" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 hover:opacity-100" />
      )}
    </span>
  );
}
