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
    <div className="table-scroll-container thin-scroll overflow-x-auto border border-[#dce6e0] rounded-3xl bg-white shadow-soft">
      <table className="w-full text-left border-collapse min-w-[1050px]">
        <thead>
          <tr className="bg-[#f8faf8] border-b border-[#e9f1ed] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 px-4 w-28">Priority</th>
            <th className="py-3 px-3 w-24">Token</th>
            <th className="py-3 px-4 w-24">Scheduled</th>
            <th className="py-3 px-4">Patient</th>
            <th className="py-3 px-4">Patient ID</th>
            <th className="py-3 px-4">Accession</th>
            <th className="py-3 px-4">Examination</th>
            <th className="py-3 px-3 w-20">Modality</th>
            <th className="py-3 px-4">Machine</th>
            <th className="py-3 px-4 w-24">Checked In</th>
            <th className="py-3 px-4 w-28">Waiting</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right w-28">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f4f1] text-xs">
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
                ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500'
                : item.order.priority === 'URGENT'
                ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                : 'hover:bg-[#f8faf8] border-l-4 border-l-transparent';

            return (
              <tr
                key={item.appointmentId}
                className={`${priorityRowClass} transition-colors group cursor-pointer h-12`}
                onClick={() => onOpenExam(item)}
              >
                {/* Priority */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <PriorityBadge priority={item.order.priority} />
                </td>

                {/* Token */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {item.appointment.tokenNumber ? (
                    <span className="px-2.5 py-0.5 bg-emerald-100/70 border border-emerald-200 text-emerald-900 rounded-full font-mono font-bold text-[11px] shadow-xs">
                      {item.appointment.tokenNumber}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">Q-—</span>
                  )}
                </td>

                {/* Scheduled Time */}
                <td className="py-2.5 px-4 whitespace-nowrap font-mono font-medium text-slate-700">
                  {scheduledTime}
                </td>

                {/* Patient */}
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900 leading-tight">
                    {item.patient.firstName} {item.patient.lastName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium capitalize mt-0.5">
                    {item.patient.gender.toLowerCase()}
                  </div>
                </td>

                {/* Patient ID */}
                <td className="py-2.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <IdentifierPill type="patient" value={item.patient.patientId} />
                </td>

                {/* Accession */}
                <td className="py-2.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <IdentifierPill type="accession" value={item.order.accessionNumber} />
                </td>

                {/* Examination */}
                <td className="py-2.5 px-4 max-w-[220px]">
                  <div className="font-bold text-slate-800 truncate leading-tight" title={item.order.examinationName}>
                    {item.order.examinationName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                    {item.order.bodyPart}
                  </div>
                </td>

                {/* Modality */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <Badge variant="outline" className="font-mono text-[10px] font-bold border-slate-200 text-slate-700 bg-slate-50 rounded-full">
                    {item.order.modality}
                  </Badge>
                </td>

                {/* Machine */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[130px] text-xs" title={item.equipment?.name || 'Unassigned'}>
                      {item.equipment?.name || 'Unassigned'}
                    </span>
                  </div>
                </td>

                {/* Checked In */}
                <td className="py-2.5 px-4 whitespace-nowrap font-mono font-medium text-slate-600 text-xs">
                  {checkedInTime}
                </td>

                {/* Waiting Duration */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/70 px-2.5 py-0.5 rounded-full text-[11px] border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {formatWaitingDuration(item.waitingMinutes)}
                  </span>
                </td>

                {/* Workflow Status */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <StatusBadge status={item.order.orderStatus} />
                </td>

                {/* Action */}
                <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className={`h-7 px-3.5 text-xs gap-1 font-bold rounded-full shadow-soft ${
                      item.order.priority === 'STAT'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : item.order.orderStatus === 'SAFETY_CLEARED' || item.order.orderStatus === 'READY_FOR_SCAN'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                    onClick={() => onOpenExam(item)}
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
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
