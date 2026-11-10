import * as React from 'react';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { ImagingOrder, Priority } from '../../types';
import {
  Calendar,
  UserCheck,
  ClipboardList,
  Activity,
  CheckCircle2,
  FileCheck2,
  Send,
  AlertCircle,
  Clock,
  Check,
  ChevronRight,
  History,
} from 'lucide-react';

interface OrderTrackingViewProps {
  orders: ImagingOrder[];
  isLoading: boolean;
  onTrackOrder: (order: ImagingOrder) => void;
}

type TrackingStage = 'BOOKED' | 'ARRIVED' | 'WAITING_PREP' | 'SCANNING' | 'QC' | 'REPORTING' | 'DELIVERED';

interface StageDefinition {
  id: TrackingStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const STAGES: StageDefinition[] = [
  { id: 'BOOKED', label: 'BOOKED', icon: Calendar, description: 'Order created & slot scheduled' },
  { id: 'ARRIVED', label: 'ARRIVED', icon: UserCheck, description: 'Reception arrival & token checked in' },
  { id: 'WAITING_PREP', label: 'WAITING / PREP', icon: ClipboardList, description: 'Safety screening & IV cannulation' },
  { id: 'SCANNING', label: 'SCANNING', icon: Activity, description: 'In scanner suite acquisition' },
  { id: 'QC', label: 'QC', icon: CheckCircle2, description: 'Image quality check & PACS transfer' },
  { id: 'REPORTING', label: 'REPORTING', icon: FileCheck2, description: 'Radiologist reading & signing' },
  { id: 'DELIVERED', label: 'DELIVERED', icon: Send, description: 'Report dispatched & delivered' },
];

function getOrderStage(order: ImagingOrder): TrackingStage {
  const status = order.orderStatus as string;

  if (status === 'DELIVERED' || status === 'DISPATCHED' || status === 'FINAL_DELIVERED') {
    return 'DELIVERED';
  }
  if (status === 'IN_REPORTING' || status === 'DRAFT_REPORT' || status === 'COMPLETED' || status === 'PACS_READY') {
    return 'REPORTING';
  }
  if (status === 'SCAN_COMPLETED' || status === 'IMAGE_QUALITY_REVIEW') {
    return 'QC';
  }
  if (status === 'SCAN_IN_PROGRESS') {
    return 'SCANNING';
  }
  if (
    status === 'READY_FOR_TECH' ||
    status === 'SAFETY_REVIEW' ||
    status === 'SAFETY_CLEARED' ||
    status === 'PREPARATION_IN_PROGRESS' ||
    status === 'PREPARED' ||
    status === 'READY_FOR_SCAN'
  ) {
    return 'WAITING_PREP';
  }
  if (order.appointment?.status === 'CHECKED_IN' || !!order.appointment?.tokenNumber) {
    return 'ARRIVED';
  }
  return 'BOOKED';
}

function getPriorityVisuals(priority: Priority) {
  if (priority === 'STAT') {
    return {
      border: 'border-l-4 border-l-rose-500 border-rose-200 bg-rose-50/30',
      badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      icon: AlertCircle,
      text: 'text-rose-700',
    };
  }
  if (priority === 'URGENT') {
    return {
      border: 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/20',
      badge: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      icon: Clock,
      text: 'text-amber-700',
    };
  }
  return {
    border: 'border-l-4 border-l-slate-400 border-slate-200 bg-white',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
    icon: Check,
    text: 'text-slate-600',
  };
}

export function OrderTrackingView({ orders, isLoading, onTrackOrder }: OrderTrackingViewProps) {
  const [selectedStage, setSelectedStage] = React.useState<TrackingStage | 'ALL'>('ALL');

  // Group orders by tracking stage
  const groupedOrders = React.useMemo(() => {
    const map: Record<TrackingStage, ImagingOrder[]> = {
      BOOKED: [],
      ARRIVED: [],
      WAITING_PREP: [],
      SCANNING: [],
      QC: [],
      REPORTING: [],
      DELIVERED: [],
    };

    orders.forEach((o) => {
      const stage = getOrderStage(o);
      map[stage].push(o);
    });

    return map;
  }, [orders]);

  const displayedOrders = React.useMemo(() => {
    if (selectedStage === 'ALL') return orders;
    return groupedOrders[selectedStage];
  }, [orders, groupedOrders, selectedStage]);

  return (
    <div className="space-y-4">
      {/* 1. LIFECYCLE PROGRESSION STAGES (Section 11) */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-[#152B42] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#174A70]" />
            <span>Clinical Lifecycle Progression Tracking</span>
          </span>
          <span className="text-[11px] text-slate-500">
            Total Active Orders: <strong>{orders.length}</strong>
          </span>
        </div>

        {/* 7-Stage Progression Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STAGES.map((st, idx) => {
            const count = groupedOrders[st.id].length;
            const isSelected = selectedStage === st.id;
            const Icon = st.icon;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStage(selectedStage === st.id ? 'ALL' : st.id)}
                className={`p-2 rounded-md border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#174A70] bg-[#174A70]/10 shadow-2xs ring-1 ring-[#174A70]'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#174A70]' : 'text-slate-500'}`} />
                    <span className="text-[10px] font-bold tracking-tight text-slate-800">
                      {idx + 1}. {st.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      count > 0 ? 'bg-[#174A70] text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate leading-tight">{st.description}</p>
              </button>
            );
          })}
        </div>

        {selectedStage !== 'ALL' && (
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-600 font-medium text-[11px]">
              Filtering view to: <strong>{selectedStage.replace('_', ' ')}</strong> ({groupedOrders[selectedStage].length} orders)
            </span>
            <button
              type="button"
              onClick={() => setSelectedStage('ALL')}
              className="text-[#174A70] hover:underline font-semibold text-[11px] cursor-pointer"
            >
              Show All Stages
            </button>
          </div>
        )}
      </div>

      {/* 2. COMPACT WORKFLOW BOARD / GROUPED ORDERS (Section 12) */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#174A70] border-t-transparent" />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-12 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs">
            <p className="font-semibold text-slate-700">No orders currently in this workflow stage.</p>
            <p className="text-[11px] text-slate-400 mt-1">Select "Show All Stages" to inspect complete fleet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedOrders.map((order) => {
              const stage = getOrderStage(order);
              const priorityStyle = getPriorityVisuals(order.priority);
              const PriorityIcon = priorityStyle.icon;

              return (
                <div
                  key={order.id}
                  className={`rounded-lg border p-3.5 shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between ${priorityStyle.border}`}
                >
                  <div className="space-y-2">
                    {/* Top Header: Accession & Priority */}
                    <div className="flex items-center justify-between gap-2">
                      <IdentifierPill type="accession" value={order.accessionNumber} />
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${priorityStyle.badge}`}
                        >
                          <PriorityIcon className="w-3 h-3" />
                          <span>{order.priority}</span>
                        </span>
                        <Badge variant="cyan" className="font-bold text-[10px] py-0 px-1.5">
                          {order.modality}
                        </Badge>
                      </div>
                    </div>

                    {/* Patient & Procedure Identity */}
                    <div>
                      <p className="text-xs font-bold text-[#152B42] leading-tight">
                        {order.patient ? `${order.patient.lastName}, ${order.patient.firstName}` : 'Unknown Patient'}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">MRN:</span>
                        <IdentifierPill type="patient" value={order.patient?.patientId || ''} />
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 font-medium">
                      <p className="line-clamp-1">{order.examinationName}</p>
                      <span className="text-[11px] text-slate-400 block">{order.bodyPart}</span>
                    </div>

                    {/* Current Clinical Stage Badge */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#174A70] animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                          {stage.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {order.appointment?.scheduledStart
                          ? new Date(order.appointment.scheduledStart).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Queue'}
                      </span>
                    </div>
                  </div>

                  {/* Track Timeline Action Button */}
                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                      {order.referringDoctor?.name || 'Internal'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onTrackOrder(order)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#174A70] hover:text-[#123855] hover:underline cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Track Timeline</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
