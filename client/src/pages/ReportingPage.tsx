import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { radiologistService } from '../services/radiologistService';
import { DiagnosticReportingWorkspace } from '../features/radiologist/DiagnosticReportingWorkspace';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import {
  FileText,
  Layers,
  Clock,
  ArrowRight,
  Stethoscope,
  ChevronRight,
} from 'lucide-react';
import { formatWaitingDuration } from '../utils/formatters';

export function ReportingPage() {
  const { orderId } = useParams<{ orderId?: string }>();

  // If orderId is present in URL, render the dedicated Diagnostic Reporting Workspace
  if (orderId) {
    return <DiagnosticReportingWorkspace orderId={orderId} />;
  }

  // Otherwise, render clean empty entry state for direct /reporting navigation
  return <NoStudyReportingEntry />;
}

function NoStudyReportingEntry() {
  const navigate = useNavigate();

  // Compact summary of PACS-ready studies awaiting reporting
  const { data: readyWorklist } = useQuery({
    queryKey: ['radiologistWorklistCompactSummary'],
    queryFn: () =>
      radiologistService.getWorklist({
        page: 1,
        limit: 5,
        assignmentStatus: 'ALL',
      }),
  });

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-10">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#dce6e0] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Diagnostic Reporting</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dedicated clinical reporting workspace for image review, structured findings, impression, and final report authorization.
          </p>
        </div>

        <Button
          onClick={() => navigate('/radiologist/worklist')}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 px-4 flex items-center gap-1.5 self-start sm:self-auto shadow-soft rounded-full"
        >
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          Open Radiologist Worklist
        </Button>
      </div>

      {/* 2. Hero Guide Card */}
      <Card className="border border-[#dce6e0] bg-white shadow-soft rounded-3xl overflow-hidden">
        <CardContent className="py-12 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-soft">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-base font-extrabold text-slate-900">No Examination Selected</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Select a completed examination from the Radiologist Worklist to launch OHIF viewer integration, attach measurements and key images, author structured findings, and sign finalized reports.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => navigate('/radiologist/worklist')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 h-9 shadow-soft rounded-full inline-flex items-center gap-2"
            >
              <Layers className="h-4 w-4 text-emerald-400" />
              Open Radiologist Worklist
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Compact Assigned / Ready Studies Quick Selector */}
      {readyWorklist && readyWorklist.items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ready Studies Awaiting Reporting ({readyWorklist.pagination.total})
            </h3>
            <button
              onClick={() => navigate('/radiologist/worklist')}
              className="text-xs text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              View all in worklist <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {readyWorklist.items.map((item) => (
              <div
                key={item.imagingOrderId}
                onClick={() => navigate(`/reporting/${item.imagingOrderId}`)}
                className="p-4 rounded-2xl border border-[#dce6e0] bg-[#f8faf8]/70 hover:bg-white hover:border-emerald-300 hover:shadow-card cursor-pointer transition-all space-y-2.5 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {item.patientName}
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                  <IdentifierPill type="accession" value={item.accessionNumber} />
                  <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 border-slate-200 text-slate-700 bg-white rounded-full">
                    {item.modality}
                  </Badge>
                  <span className="truncate text-slate-600">{item.procedureName}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatWaitingDuration(item.waitingMinutes)}
                  </span>
                  <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                    Open Workspace <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
