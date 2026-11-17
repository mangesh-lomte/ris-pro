import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import {
  History,
  CheckCircle2,
  Send,
  Printer,
  User,
  Clock,
  Loader2,
} from 'lucide-react';

interface ReportHistoryModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportHistoryModal({ orderId, open, onOpenChange }: ReportHistoryModalProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['reportDeliveryHistory', orderId],
    queryFn: () => receptionDeliveryService.getReportDeliveryHistory(orderId!),
    enabled: open && !!orderId,
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#2563EB]" />
            <DialogTitle className="text-base font-bold text-foreground">
              Report Delivery & Dispatch History
            </DialogTitle>
          </div>
          {history && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-foreground">{history.patientName}</span>
              <IdentifierPill type="patient" value={history.patientId} />
              <IdentifierPill type="accession" value={history.accessionNumber} />
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300">
                v{history.reportVersion} {history.reportStatus}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mb-2" />
              <span>Loading delivery audit log...</span>
            </div>
          ) : !history ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No delivery records found for this order.
            </div>
          ) : (
            <>
              {/* Ready for Reception Banner */}
              <div className="p-3 bg-muted/30 border rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-foreground">Reception Readiness:</span>
                  <span className="text-muted-foreground">
                    {history.isReadyForReception
                      ? `Marked ready on ${new Date(history.readyForReceptionAt).toLocaleString()} by ${history.readyForReceptionBy || 'Radiologist'}`
                      : 'Not yet marked ready'}
                  </span>
                </div>
              </div>

              {/* 1. Physical / Portal Deliveries */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>Delivery & Acknowledgment Log ({history.deliveries.length})</span>
                </h4>
                {history.deliveries.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-2">No handovers or portal downloads recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.deliveries.map((del: any) => (
                      <div key={del.id} className="p-3 border rounded-lg bg-card text-xs flex items-start justify-between gap-3 shadow-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="text-[10px] font-bold bg-blue-50 text-indigo-800 border-blue-200">
                              {del.deliveryMethod}
                            </Badge>
                            <span className="font-semibold text-foreground">
                              Recipient: {del.recipientName} ({del.recipientRole || 'PATIENT'})
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0">
                              {del.status}
                            </Badge>
                          </div>
                          {del.notes && <p className="text-muted-foreground text-[11px]">{del.notes}</p>}
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(del.deliveredAt).toLocaleString()}</span>
                            {del.deliveredBy && <span>• Processed by: {del.deliveredBy}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Patient SMS / Email Notifications */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>Dispatched Notifications ({history.notifications.length})</span>
                </h4>
                {history.notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-2">No SMS or Email notifications sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.notifications.map((notif: any) => (
                      <div key={notif.id} className="p-3 border rounded-lg bg-card text-xs space-y-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {notif.channel}
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {notif.recipientContact}
                            </span>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                            {notif.status} • {notif.provider}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px] bg-muted/20 p-2 rounded border border-border/50">
                          "{notif.messageBody}"
                        </p>
                        <div className="text-[10px] text-muted-foreground pt-0.5">
                          Sent on {new Date(notif.sentAt).toLocaleString()} {notif.sentBy ? `by ${notif.sentBy}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Physical Reprints Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>Physical Print / Reprint Log ({history.reprints.length})</span>
                </h4>
                {history.reprints.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-2">No physical reprints recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.reprints.map((rep: any) => (
                      <div key={rep.id} className="p-2.5 border rounded-lg bg-card text-xs flex items-center justify-between shadow-xs">
                        <div>
                          <div className="font-semibold text-foreground text-[11px]">
                            {rep.copiesCount} Copy(ies) printed • Reason: {rep.reason || 'General copy'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Printed by {rep.printedBy} on {new Date(rep.printedAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          v{rep.version}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-3 border-t bg-muted/10 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

