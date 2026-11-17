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
    { key: 'booked', label: '1. Booked', count: breakdown.booked, border: 'border-[#dce6e0]' },
    { key: 'arrived', label: '2. Arrived', count: breakdown.arrived, border: 'border-[#dce6e0]' },
    { key: 'waiting', label: '3. Waiting / Prep', count: breakdown.waiting, border: 'border-[#dce6e0]' },
    { key: 'scanning', label: '4. Scanning', count: breakdown.scanning, border: 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-bold shadow-xs' },
    { key: 'reporting', label: '5. Reporting', count: breakdown.reporting, border: 'border-[#dce6e0]' },
    { key: 'delivered', label: '6. Delivered', count: breakdown.delivered, border: 'border-[#dce6e0]' },
  ];

  return (
    <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Live Patient Workflow Progression
              </CardTitle>
              <p className="text-[11px] text-slate-500 font-medium">End-to-end clinical encounter throughput</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-clinical-mono hidden sm:inline font-semibold">
            BOOKED → ARRIVED → WAITING → SCANNING → REPORTING → DELIVERED
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Pipeline Progress Stages */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {stages.map((stage, idx) => (
            <div
              key={stage.key}
              className={`p-3 rounded-2xl border ${stage.border || 'border-[#dce6e0]'} ${stage.key === 'scanning' ? 'bg-emerald-50/60' : 'bg-[#f8faf8]/70'} flex flex-col justify-between transition-colors`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stage.label}</span>
                {idx < stages.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden lg:block" />
                )}
              </div>
              <span className="text-xl font-extrabold text-slate-900 mt-2 font-mono">
                {isLoading ? '—' : stage.count}
              </span>
            </div>
          ))}
        </div>

        {/* Active Patients Clinical Table */}
        {data?.activePatients && data.activePatients.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[#dce6e0] table-scroll-container">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf8] text-slate-400 font-bold border-b border-[#e9f1ed] text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5">Patient / MRN</th>
                  <th className="py-2.5 px-3.5">Accession / Exam</th>
                  <th className="py-2.5 px-3.5">Current Stage</th>
                  <th className="py-2.5 px-3.5">Priority</th>
                  <th className="py-2.5 px-3.5">Elapsed</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f1] bg-white">
                {data.activePatients.slice(0, 8).map((patient) => (
                  <tr key={patient.id} className="hover:bg-[#f8faf8] transition-colors">
                    <td className="py-2.5 px-3.5">
                      <Link to={`/patients/${patient.databasePatientId}`} className="font-bold text-slate-900 hover:text-emerald-700 block">
                        {patient.patientName}
                      </Link>
                      <div className="mt-0.5">
                        <IdentifierPill type="patient" value={patient.patientId} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <IdentifierPill type="accession" value={patient.accessionNumber} />
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5 truncate max-w-xs">{patient.examinationName}</div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-bold rounded-full border-slate-200 bg-slate-50 text-slate-700">
                        {patient.stage}
                      </Badge>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{patient.status}</div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <PriorityBadge priority={patient.priority as any} />
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-mono font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {patient.timeAgoMinutes}m
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <Link
                        to={`/orders?search=${encodeURIComponent(patient.accessionNumber)}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400 bg-[#f8faf8] rounded-2xl border border-[#dce6e0] font-medium">
            No patients currently in progress.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
