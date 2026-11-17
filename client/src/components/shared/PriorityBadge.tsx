import { Priority } from '../../types';
import { AlertCircle, Clock, Minus } from 'lucide-react';

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'STAT':
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200/60 whitespace-nowrap select-none animate-pulse"
          aria-label="Clinical priority: STAT — immediate attention required"
        >
          <AlertCircle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          STAT
        </span>
      );
    case 'URGENT':
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 whitespace-nowrap select-none"
          aria-label="Clinical priority: URGENT — elevated turnaround"
        >
          <Clock className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          URGENT
        </span>
      );
    case 'ROUTINE':
    default:
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap select-none"
          aria-label="Clinical priority: ROUTINE — standard turnaround"
        >
          <Minus className="w-2.5 h-2.5 shrink-0 opacity-50" aria-hidden="true" />
          ROUTINE
        </span>
      );
  }
}
