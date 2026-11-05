import { OrderStatus, AppointmentStatus, StudyStatus } from '../../types';
import { Badge } from '../ui/badge';

export function StatusBadge({ status }: { status: OrderStatus | AppointmentStatus | StudyStatus | string }) {
  let variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'cyan' = 'secondary';

  switch (status) {
    case 'COMPLETED':
    case 'REPORTED':
    case 'FINAL':
      variant = 'success';
      break;
    case 'IN_PROGRESS':
    case 'ACQUIRING':
    case 'ARRIVED':
      variant = 'cyan';
      break;
    case 'READY_FOR_REPORTING':
    case 'SENT_TO_PACS':
      variant = 'info';
      break;
    case 'SCHEDULED':
    case 'CONFIRMED':
    case 'PENDING':
    case 'CREATED':
      variant = 'warning';
      break;
    case 'CANCELLED':
    case 'NO_SHOW':
    case 'FAILED':
      variant = 'destructive';
      break;
    default:
      variant = 'secondary';
  }

  return (
    <Badge variant={variant} className="capitalize text-[11px] font-medium">
      {status.replace(/_/g, ' ').toLowerCase()}
    </Badge>
  );
}
