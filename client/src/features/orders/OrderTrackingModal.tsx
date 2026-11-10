import { useQuery } from '@tanstack/react-query';
import { fetchOrderTimeline } from '../../services/orderService';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { CheckCircle2, Clock, Activity } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface OrderTrackingModalProps {
  orderId: string | null;
  accessionNumber?: string;
  patientName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderTrackingModal({
  orderId,
  accessionNumber,
  patientName,
  open,
  onOpenChange,
}: OrderTrackingModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['orderTimeline', orderId],
    queryFn: () => (orderId ? fetchOrderTimeline(orderId) : null),
    enabled: !!orderId && open,
  });

  const milestones = data?.milestones || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="lg">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Activity className="w-5 h-5 text-indigo-600" />
          <span>Order Status Tracking & Lifecycle Milestone History</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Real-time progression: Placed → Scheduled → Arrived → Scanned → Reported → Dispatched
        </DialogDescription>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {/* Order Header Summary */}
        <div className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Target</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{patientName || data?.patientName || 'Patient'}</span>
              {data?.patientId && <IdentifierPill type="patient" value={data.patientId} />}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(accessionNumber || data?.accessionNumber) && (
              <IdentifierPill type="accession" value={accessionNumber || data.accessionNumber} />
            )}
            <Badge variant="cyan">{data?.currentStatus || 'IN TRANSIT'}</Badge>
          </div>
        </div>

        {/* Milestone Timeline */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {milestones.map((m: any) => (
              <div key={m.stage} className="relative flex items-start gap-3">
                <div
                  className={`absolute -left-6 mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    m.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-slate-300'
                  }`}
                >
                  {m.completed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                </div>

                <div className="flex-1 p-3 rounded-lg border border-slate-100 bg-white shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{m.label}</span>
                    <Badge variant={m.completed ? 'default' : 'secondary'} className="text-[10px]">
                      {m.completed ? 'COMPLETED' : 'PENDING'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{m.details}</p>
                  {m.timestamp && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Timestamp: {new Date(m.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
