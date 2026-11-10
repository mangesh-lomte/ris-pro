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
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DCE2EC] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-[#33398A]" />
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">Diagnostic Reporting</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Dedicated clinical reporting workspace for image review, structured findings, impression, and final report authorization.
          </p>
        </div>

        <Button
          onClick={() => navigate('/radiologist/worklist')}
          className="bg-[#174A70] hover:bg-[#133E5E] text-white font-semibold text-xs h-8 px-3.5 flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <Layers className="h-3.5 w-3.5" />
          Open Radiologist Worklist
        </Button>
      </div>

      {/* 2. Hero Guide Card */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardContent className="py-12 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#174A70]/10 border border-[#174A70]/20 flex items-center justify-center mx-auto text-[#174A70]">
            <Stethoscope className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-base font-bold text-[#152B42]">No Examination Selected</h2>
            <p className="text-xs text-[#65758A] leading-relaxed">
              Select a completed examination from the Radiologist Worklist to launch OHIF viewer integration, attach measurements and key images, author structured findings, and sign finalized reports.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => navigate('/radiologist/worklist')}
              className="bg-[#174A70] hover:bg-[#133E5E] text-white font-semibold text-xs px-4 h-9 shadow-xs inline-flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#65758A]">
              Ready Studies Awaiting Reporting ({readyWorklist.pagination.total})
            </h3>
            <button
              onClick={() => navigate('/radiologist/worklist')}
              className="text-xs text-[#227DA5] hover:text-[#174A70] font-semibold flex items-center gap-1"
            >
              View all in worklist <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {readyWorklist.items.map((item) => (
              <div
                key={item.imagingOrderId}
                onClick={() => navigate(`/reporting/${item.imagingOrderId}`)}
                className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-[#227DA5]/50 hover:shadow-xs cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs text-[#152B42] group-hover:text-[#227DA5] transition-colors">
                    {item.patientName}
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#65758A]">
                  <IdentifierPill type="accession" value={item.accessionNumber} />
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-slate-200 text-slate-700 bg-slate-50">
                    {item.modality}
                  </Badge>
                  <span className="truncate text-slate-600">{item.procedureName}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#65758A]">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatWaitingDuration(item.waitingMinutes)}
                  </span>
                  <span className="text-[#227DA5] font-semibold group-hover:underline flex items-center gap-1">
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
