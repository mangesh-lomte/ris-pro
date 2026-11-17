import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[#2563EB]">
                <History className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  REPORT VERSION HISTORY
                  <Badge variant="outline" className="text-xs font-mono">
                    Current: v{currentVersion}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Immutable chronological audit log of the original final report and later amendments.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
          <div className="space-y-4 py-2">
            {/* Version timeline list */}
            <div className="space-y-3">
              {versions.map((ver: ReportVersionItem, idx: number) => {
                const isLatest = ver.versionNumber === currentVersion;
                return (
                  <div
                    key={`ver-${ver.versionNumber}-${idx}`}
                    className={`border rounded-lg p-3.5 transition-all ${
                      isLatest
                        ? 'border-indigo-400 bg-blue-50/20 dark:bg-indigo-950/20 shadow-sm'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded text-foreground">
                          v{ver.versionNumber}
                        </span>
                        {getBadgeForType(ver.amendmentType, ver.isOriginal)}
                        {isLatest && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB] dark:text-indigo-400">
                            (Current Active State)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="font-medium text-foreground">{ver.author.name}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(ver.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reason / Context */}
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Reason / Context: </span>
                      <span className="text-foreground italic">{ver.reason}</span>
                    </div>

                    {/* Report Content Snapshot */}
                    <div className="mt-2.5 bg-muted/40 p-2.5 rounded border border-border/50 text-xs font-mono space-y-2">
                      {ver.findings && (
                        <div>
                          <div className="font-semibold text-muted-foreground text-[10px] uppercase font-sans">
                            Findings:
                          </div>
                          <div className="whitespace-pre-wrap text-foreground/90 mt-0.5">
                            {ver.findings}
                          </div>
                        </div>
                      )}
                      {ver.impression && (
                        <div>
                          <div className="font-semibold text-muted-foreground text-[10px] uppercase font-sans">
                            Impression:
                          </div>
                          <div className="whitespace-pre-wrap text-foreground/90 mt-0.5">
                            {ver.impression}
                          </div>
                        </div>
                      )}
                      {!ver.findings && !ver.impression && ver.content && (
                        <div className="whitespace-pre-wrap text-foreground/90">
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

        <div className="border-t pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onOpenAmendment && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 flex items-center gap-1"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAmendment('CORRECTION');
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Create Correction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-blue-700 border-indigo-300 hover:bg-blue-50 dark:hover:bg-indigo-950 flex items-center gap-1"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAmendment('ADDENDUM');
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Create Addendum
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Close History
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
