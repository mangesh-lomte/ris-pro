import { Priority } from '../../types';
import { Badge } from '../ui/badge';
import { AlertCircle, Clock, Minus } from 'lucide-react';

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'STAT':
      return (
        <Badge
          variant="destructive"
          className="gap-1 font-bold tracking-wider whitespace-nowrap select-none bg-rose-100/90 text-[#D92D4C] border border-rose-300"
          aria-label="Clinical priority: STAT — immediate attention required"
        >
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          STAT
        </Badge>
      );
    case 'URGENT':
      return (
        <Badge
          variant="warning"
          className="gap-1 font-bold whitespace-nowrap select-none bg-amber-100/80 text-[#D97706] border border-amber-300"
          aria-label="Clinical priority: URGENT — elevated turnaround"
        >
          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
          URGENT
        </Badge>
      );
    case 'ROUTINE':
    default:
      return (
        <Badge
          variant="secondary"
          className="gap-1 font-medium whitespace-nowrap select-none bg-[#F3F6FC] text-[#64748B] border border-[#DCE2EC]"
          aria-label="Clinical priority: ROUTINE — standard turnaround"
        >
          <Minus className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
          ROUTINE
        </Badge>
      );
  }
}
