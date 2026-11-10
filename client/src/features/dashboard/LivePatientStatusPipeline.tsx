import { LivePatientStatusData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { Activity, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  data?: LivePatientStatusData;
  isLoading?: boolean;
}

export function LivePatientStatusPipeline({ data, isLoading }: Props) {
  const breakdown = data?.breakdown || {
    booked: 0,
    arrived: 0,
    waiting: 0,
    scanning: 0,
    reporting: 0,
    delivered: 0,
  };

  const stages = [
    { key: 'booked', label: '1. Booked', count: breakdown.booked, color: 'bg-blue-50/70 text-blue-800 border-blue-200' },
    { key: 'arrived', label: '2. Arrived', count: breakdown.arrived, color: 'bg-indigo-50/70 text-indigo-800 border-indigo-200' },
    { key: 'waiting', label: '3. Waiting / Prep', count: breakdown.waiting, color: 'bg-amber-50/70 text-amber-800 border-amber-200' },
    { key: 'scanning', label: '4. Scanning', count: breakdown.scanning, color: 'bg-cyan-50/70 text-cyan-800 border-cyan-200' },
    { key: 'reporting', label: '5. Reporting', count: breakdown.reporting, color: 'bg-purple-50/70 text-purple-800 border-purple-200' },
    { key: 'delivered', label: '6. Delivered', count: breakdown.delivered, color: 'bg-emerald-50/70 text-emerald-800 border-emerald-200' },
  ];

  return (
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
      <CardHeader className="p-3.5 sm:p-4 pb-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#174A70]" />
            <CardTitle className="text-sm font-semibold text-[#152B42]">
              Live Patient Workflow Pipeline
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            BOOKED → ARRIVED → WAITING → SCANNING → REPORTING → DELIVERED
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-0 space-y-3.5">
        {/* Pipeline Progress Stages */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stages.map((stage, idx) => (
            <div
              key={stage.key}
              className={`p-2.5 rounded-md border ${stage.color} flex flex-col justify-between relative group`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight uppercase">{stage.label}</span>
                {idx < stages.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-30 hidden lg:block" />
                )}
              </div>
              <span className="text-xl font-bold mt-1 tracking-tight tabular-nums">
                {isLoading ? '...' : stage.count}
              </span>
            </div>
          ))}
        </div>

        {/* Active Patients Clinical Table */}
        {data?.activePatients && data.activePatients.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Patient / MRN</th>
                  <th className="py-2.5 px-3">Accession / Exam</th>
                  <th className="py-2.5 px-3">Current Stage</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Elapsed</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.activePatients.slice(0, 8).map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <Link to={`/patients/${patient.databasePatientId}`} className="font-semibold text-[#152B42] hover:text-[#174A70] block">
                        {patient.patientName}
                      </Link>
                      <div className="mt-0.5">
                        <IdentifierPill type="patient" value={patient.patientId} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <IdentifierPill type="accession" value={patient.accessionNumber} />
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate max-w-xs">{patient.examinationName}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium">
                        {patient.stage}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <PriorityBadge priority={patient.priority as any} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {patient.timeAgoMinutes < 60
                            ? `${patient.timeAgoMinutes}m ago`
                            : `${Math.floor(patient.timeAgoMinutes / 60)}h ${patient.timeAgoMinutes % 60}m ago`}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to={`/patients/${patient.databasePatientId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[#174A70] bg-[#174A70]/5 hover:bg-[#174A70]/10 border border-[#174A70]/20 transition-colors shadow-2xs"
                      >
                        <span>View Chart</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-5 text-xs text-slate-500 bg-slate-50/60 rounded-md border border-dashed border-slate-200">
            No active patients currently in transit across pipeline stages.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
