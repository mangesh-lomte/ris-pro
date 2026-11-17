import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import {
  radiologistService,
  ReportVersionItem,
} from '../../services/radiologistService';
import {
  History,
  Clock,
  User,
  AlertTriangle,
  PlusCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface ReportVersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  patientId?: string;
  accessionNumber?: string;
  onOpenAmendment?: (type: 'CORRECTION' | 'ADDENDUM') => void;
}

export const ReportVersionHistoryModal: React.FC<ReportVersionHistoryModalProps> = ({
  open,
  onOpenChange,
  orderId,
  patientId,
  accessionNumber,
  onOpenAmendment,
}) => {
  const {
    data: historyData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reportVersionHistory', orderId],
    queryFn: () => radiologistService.getReportVersionHistory(orderId!),
    enabled: open && !!orderId,
  });

  const versions = historyData?.versions || [];
  const currentVersion = historyData?.currentVersion || 1;

  const getBadgeForType = (type: string, isOriginal: boolean) => {
    if (isOriginal || type === 'FINAL') {
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 flex items-center gap-1 text-[11px]">
          <CheckCircle2 className="h-3 w-3" /> FINAL (ORIGINAL)
        </Badge>
      );
    }
    if (type === 'CORRECTION') {
      return (
        <Badge className="bg-amber-600 text-white hover:bg-amber-600 flex items-center gap-1 text-[11px]">
          <AlertTriangle className="h-3 w-3" /> CORRECTION
        </Badge>
      );
    }
    if (type === 'ADDENDUM') {
      return (
        <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 flex items-center gap-1 text-[11px]">
          <PlusCircle className="h-3 w-3" /> ADDENDUM
        </Badge>
      );
    }
    return <Badge variant="outline">{type}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <div className="flex flex-col max-h-[85vh] min-w-0">
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 pr-8">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[#2563EB] shrink-0">
                <History className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold flex flex-wrap items-center gap-2 break-words">
                  <span>REPORT VERSION HISTORY</span>
                  <Badge variant="outline" className="text-xs font-mono shrink-0">
                    Current: v{currentVersion}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 break-words [overflow-wrap:anywhere]">
                  Immutable chronological audit log of the original final report and later amendments.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <IdentifierPill
                type="patient"
                value={patientId || historyData?.patientId || 'UNKNOWN'}
              />
              <IdentifierPill
                type="accession"
                value={accessionNumber || historyData?.accessionNumber || 'UNKNOWN'}
              />
            </div>
          </div>
        </DialogHeader>

        <DialogContent className="p-5 overflow-y-auto overflow-x-hidden flex-1 min-w-0 max-h-none">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 animate-spin text-primary" />
              Loading version history...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-destructive bg-destructive/10 rounded-md">
              Failed to load version history. Please ensure report is finalized.
            </div>
          ) : (
            <div className="space-y-4 py-1 min-w-0">
              {/* Version timeline list */}
              <div className="space-y-3 min-w-0">
                {versions.map((ver: ReportVersionItem, idx: number) => {
                  const isLatest = ver.versionNumber === currentVersion;
                  return (
                    <div
                      key={`ver-${ver.versionNumber}-${idx}`}
                      className={`border rounded-lg p-3.5 transition-all min-w-0 overflow-hidden ${
                        isLatest
                          ? 'border-indigo-400 bg-blue-50/20 dark:bg-indigo-950/20 shadow-sm'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded text-foreground shrink-0">
                            v{ver.versionNumber}
                          </span>
                          <div className="shrink-0">
                            {getBadgeForType(ver.amendmentType, ver.isOriginal)}
                          </div>
                          {isLatest && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB] dark:text-indigo-400 shrink-0">
                              (Current Active State)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1 min-w-0">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-[150px]">{ver.author.name}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {formatDate(ver.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Reason / Context */}
                      <div className="mt-2 text-xs min-w-0 break-words [overflow-wrap:anywhere]">
                        <span className="font-semibold text-muted-foreground">Reason / Context: </span>
                        <span className="text-foreground italic">{ver.reason}</span>
                      </div>

                      {/* Report Content Snapshot */}
                      <div className="mt-2.5 bg-muted/40 p-2.5 rounded border border-border/50 text-xs font-mono space-y-2 min-w-0 overflow-hidden">
                        {ver.findings && (
                          <div className="min-w-0">
                            <div className="font-semibold text-muted-foreground text-[10px] uppercase font-sans">
                              Findings:
                            </div>
                            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-foreground/90 mt-0.5">
                              {ver.findings}
                            </div>
                          </div>
                        )}
                        {ver.impression && (
                          <div className="min-w-0">
                            <div className="font-semibold text-muted-foreground text-[10px] uppercase font-sans">
                              Impression:
                            </div>
                            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-foreground/90 mt-0.5">
                              {ver.impression}
                            </div>
                          </div>
                        )}
                        {!ver.findings && !ver.impression && ver.content && (
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-foreground/90 min-w-0">
                            {ver.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>

        <DialogFooter className="p-4 border-t flex flex-wrap items-center justify-between gap-2 bg-[#f8faf9] shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenAmendment && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 flex items-center gap-1 shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAmendment('CORRECTION');
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Create Correction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-blue-700 border-indigo-300 hover:bg-blue-50 dark:hover:bg-indigo-950 flex items-center gap-1 shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAmendment('ADDENDUM');
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                  Create Addendum
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            Close History
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
};
