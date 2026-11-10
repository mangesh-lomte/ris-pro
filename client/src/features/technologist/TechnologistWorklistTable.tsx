import { TechnologistWorklistItem } from '../../types';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatWaitingDuration } from '../../utils/formatters';
import { Eye, Clock, Building } from 'lucide-react';

interface TechnologistWorklistTableProps {
  items: TechnologistWorklistItem[];
  onOpenExam: (item: TechnologistWorklistItem) => void;
}

export function TechnologistWorklistTable({
  items,
  onOpenExam,
}: TechnologistWorklistTableProps) {
  return (
    <div className="table-scroll-container thin-scroll overflow-x-auto border border-[#DCE2EC] rounded-xl bg-white shadow-card">
      <table className="w-full text-left border-collapse min-w-[1050px]">
        <thead>
          <tr className="bg-[#F3F6FC] border-b border-[#DCE2EC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
            <th className="py-3 px-3 w-28">Priority</th>
            <th className="py-3 px-2 w-20">Token</th>
            <th className="py-3 px-3 w-24">Scheduled</th>
            <th className="py-3 px-3">Patient</th>
            <th className="py-3 px-3">Patient ID</th>
            <th className="py-3 px-3">Accession</th>
            <th className="py-3 px-3">Examination</th>
            <th className="py-3 px-2 w-20">Modality</th>
            <th className="py-3 px-3">Machine</th>
            <th className="py-3 px-3 w-24">Checked In</th>
            <th className="py-3 px-3 w-28">Waiting</th>
            <th className="py-3 px-3">Status</th>
            <th className="py-3 px-3 text-right w-24">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {items.map((item) => {
            const scheduledTime = new Date(item.appointment.scheduledStart).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            const checkedInTime = item.appointment.checkedInAt
              ? new Date(item.appointment.checkedInAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';

            const priorityRowClass =
              item.order.priority === 'STAT'
                ? 'border-l-4 border-l-rose-500 bg-rose-50/25 hover:bg-rose-50/50'
                : item.order.priority === 'URGENT'
                ? 'border-l-4 border-l-amber-400 bg-amber-50/20 hover:bg-amber-50/40'
                : 'border-l-4 border-l-transparent hover:bg-slate-50/80';

            return (
              <tr
                key={item.appointmentId}
                className={`${priorityRowClass} transition-colors group cursor-pointer`}
                onClick={() => onOpenExam(item)}
              >
                {/* Priority */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <PriorityBadge priority={item.order.priority} />
                </td>

                {/* Token */}
                <td className="py-2.5 px-2 whitespace-nowrap">
                  {item.appointment.tokenNumber ? (
                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 rounded font-mono font-bold text-[11px]">
                      {item.appointment.tokenNumber}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">Q-—</span>
                  )}
                </td>

                {/* Scheduled Time */}
                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                  {scheduledTime}
                </td>

                {/* Patient */}
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-900">
                    {item.patient.firstName} {item.patient.lastName}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {item.patient.gender.toLowerCase()}
                  </div>
                </td>

                {/* Patient ID */}
                <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <IdentifierPill type="patient" value={item.patient.patientId} />
                </td>

                {/* Accession */}
                <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <IdentifierPill type="accession" value={item.order.accessionNumber} />
                </td>

                {/* Examination */}
                <td className="py-2.5 px-3 max-w-[220px]">
                  <div className="font-medium text-slate-800 truncate" title={item.order.examinationName}>
                    {item.order.examinationName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.order.bodyPart}
                  </div>
                </td>

                {/* Modality */}
                <td className="py-2.5 px-2 whitespace-nowrap">
                  <Badge variant="outline" className="font-mono text-[11px] font-bold">
                    {item.order.modality}
                  </Badge>
                </td>

                {/* Machine */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[130px] font-medium" title={item.equipment?.name || 'Unassigned'}>
                      {item.equipment?.name || 'Unassigned'}
                    </span>
                  </div>
                </td>

                {/* Checked In */}
                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                  {checkedInTime}
                </td>

                {/* Waiting Duration */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {formatWaitingDuration(item.waitingMinutes)}
                  </span>
                </td>

                {/* Workflow Status */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {item.order.orderStatus === 'SCAN_IN_PROGRESS' ? (
                    <Badge variant="cyan" className="font-bold text-[10px] tracking-wide bg-sky-600 text-white animate-pulse">
                      SCAN IN PROGRESS
                    </Badge>
                  ) : item.order.orderStatus === 'SCAN_INTERRUPTED' ? (
                    <Badge variant="warning" className="font-bold text-[10px] tracking-wide bg-amber-500 text-white">
                      SCAN INTERRUPTED
                    </Badge>
                  ) : item.order.orderStatus === 'SCAN_COMPLETED' ? (
                    <Badge variant="success" className="font-bold text-[10px] tracking-wide bg-emerald-700 text-white">
                      SCAN COMPLETED
                    </Badge>
                  ) : item.order.orderStatus === 'IMAGE_QA_PENDING' ? (
                    <Badge variant="warning" className="font-bold text-[10px] tracking-wide bg-amber-500 text-white animate-pulse">
                      QA PENDING
                    </Badge>
                  ) : item.order.orderStatus === 'IMAGE_ACCEPTED' ? (
                    <Badge variant="success" className="font-bold text-[10px] tracking-wide bg-emerald-600 text-white">
                      IMAGE ACCEPTED
                    </Badge>
                  ) : item.order.orderStatus === 'REPEAT_REQUIRED' ? (
                    <Badge variant="destructive" className="font-bold text-[10px] tracking-wide bg-rose-600 text-white">
                      REPEAT REQUIRED
                    </Badge>
                  ) : item.order.orderStatus === 'IMAGE_REJECTED' ? (
                    <Badge variant="destructive" className="font-bold text-[10px] tracking-wide bg-rose-700 text-white">
                      IMAGE REJECTED
                    </Badge>
                  ) : item.order.orderStatus === 'PACS_READY' ? (
                    <Badge variant="cyan" className="font-bold text-[10px] tracking-wide bg-sky-700 text-white">
                      PACS READY
                    </Badge>
                  ) : item.order.orderStatus === 'PACS_HANDOFF_PENDING' ? (
                    <Badge variant="cyan" className="font-bold text-[10px] tracking-wide bg-sky-600 text-white animate-pulse">
                      PACS SENDING
                    </Badge>
                  ) : item.order.orderStatus === 'PACS_HANDOFF_COMPLETE' ? (
                    <Badge variant="success" className="font-bold text-[10px] tracking-wide bg-emerald-800 text-white">
                      PACS COMPLETE
                    </Badge>
                  ) : item.order.orderStatus === 'PACS_HANDOFF_FAILED' ? (
                    <Badge variant="destructive" className="font-bold text-[10px] tracking-wide bg-rose-800 text-white">
                      PACS FAILED
                    </Badge>
                  ) : item.order.orderStatus === 'SCAN_CANCELLED' ? (
                    <Badge variant="destructive" className="font-bold text-[10px] tracking-wide">
                      SCAN CANCELLED
                    </Badge>
                  ) : item.order.orderStatus === 'READY_FOR_SCAN' ? (
                    <Badge variant="success" className="font-bold text-[10px] tracking-wide bg-emerald-600 text-white">
                      READY FOR SCAN
                    </Badge>
                  ) : item.order.orderStatus === 'PREPARED' ? (
                    <Badge variant="success" className="font-semibold text-[10px] tracking-wide">
                      PREPARED
                    </Badge>
                  ) : item.order.orderStatus === 'PREPARATION_IN_PROGRESS' ? (
                    <Badge variant="cyan" className="font-semibold text-[10px] tracking-wide">
                      PREP IN PROGRESS
                    </Badge>
                  ) : item.order.orderStatus === 'SAFETY_CLEARED' ? (
                    <Badge variant="success" className="font-semibold text-[10px] tracking-wide">
                      SAFETY CLEARED
                    </Badge>
                  ) : item.order.orderStatus === 'SAFETY_REVIEW' ? (
                    <Badge variant="warning" className="font-semibold text-[10px] tracking-wide">
                      SAFETY REVIEW
                    </Badge>
                  ) : item.order.orderStatus === 'READY_FOR_TECH' ? (
                    <Badge variant="cyan" className="font-semibold text-[10px] tracking-wide">
                      READY FOR TECH
                    </Badge>
                  ) : (
                    <StatusBadge status={item.order.orderStatus} />
                  )}
                </td>

                {/* Action */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className={`h-7 text-xs gap-1.5 font-semibold shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      item.order.priority === 'STAT'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : item.order.orderStatus === 'SAFETY_CLEARED' || item.order.orderStatus === 'READY_FOR_SCAN'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                    onClick={() => onOpenExam(item)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open Exam</span>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

