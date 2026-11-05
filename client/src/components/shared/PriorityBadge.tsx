import { Priority } from '../../types';
import { Badge } from '../ui/badge';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'STAT':
      return (
        <Badge variant="destructive" className="gap-1 animate-pulse font-bold tracking-wider">
          <AlertCircle className="w-3 h-3" />
          <span>STAT</span>
        </Badge>
      );
    case 'URGENT':
      return (
        <Badge variant="warning" className="gap-1 font-semibold">
          <Clock className="w-3 h-3" />
          <span>URGENT</span>
        </Badge>
      );
    case 'ROUTINE':
    default:
      return (
        <Badge variant="secondary" className="gap-1 text-slate-600">
          <CheckCircle2 className="w-3 h-3 text-slate-400" />
          <span>ROUTINE</span>
        </Badge>
      );
  }
}
