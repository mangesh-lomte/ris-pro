import { OrderStatus, AppointmentStatus, StudyStatus } from '../../types';
import { Badge } from '../ui/badge';
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus | AppointmentStatus | StudyStatus | string;
  className?: string;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'cyan';

function resolve(status: string): { variant: BadgeVariant; Icon: typeof HelpCircle } {
  switch (status) {
    case 'COMPLETED':
    case 'REPORTED':
    case 'FINAL':
    case 'SAFETY_CLEARED':
    case 'CLEARED':
    case 'PREPARED':
    case 'READY_FOR_SCAN':
    case 'SCAN_COMPLETED':
    case 'IMAGE_ACCEPTED':
    case 'PACS_HANDOFF_COMPLETE':
      return { variant: 'success', Icon: CheckCircle2 };

    case 'IN_PROGRESS':
    case 'PREPARATION_IN_PROGRESS':
    case 'SCAN_IN_PROGRESS':
    case 'ACQUIRING':
    case 'ARRIVED':
    case 'CHECKED_IN':
    case 'PACS_HANDOFF_PENDING':
      return { variant: 'cyan', Icon: Clock };

    case 'READY_FOR_REPORTING':
    case 'READY_FOR_TECH':
    case 'SENT_TO_PACS':
    case 'IMAGE_QA_PENDING':
    case 'PACS_READY':
      return { variant: 'info', Icon: FileText };

    case 'SCHEDULED':
    case 'CONFIRMED':
    case 'PENDING':
    case 'CREATED':
    case 'SAFETY_REVIEW':
    case 'REQUIRES_REVIEW':
    case 'SCAN_INTERRUPTED':
      return { variant: 'warning', Icon: AlertTriangle };

    case 'CANCELLED':
    case 'SCAN_CANCELLED':
    case 'NO_SHOW':
    case 'FAILED':
    case 'REPEAT_REQUIRED':
    case 'IMAGE_REJECTED':
    case 'PACS_HANDOFF_FAILED':
      return { variant: 'destructive', Icon: XCircle };

    default:
      return { variant: 'secondary', Icon: HelpCircle };
  }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { variant, Icon } = resolve(status);
  const label = status.replace(/_/g, ' ').toLowerCase();

  return (
    <Badge
      variant={variant}
      className={`capitalize whitespace-nowrap inline-flex items-center gap-1 ${className}`}
      aria-label={`Status: ${label}`}
    >
      <Icon className="w-3 h-3 shrink-0 opacity-75" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
