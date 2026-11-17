import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { ReceptionReadyReport } from '../../types';
import { ReportHandoverModal } from './ReportHandoverModal';
import { ReportHistoryModal } from './ReportHistoryModal';
import { PatientPortalModal } from './PatientPortalModal';
import { ReferringDoctorPortalModal } from './ReferringDoctorPortalModal';
import {
  FileText,
  UserCheck,
  Send,
  Printer,
  History,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Stethoscope,
  Clock,
} from 'lucide-react';

export function ReportDeliveryView() {
  const [selectedReport, setSelectedReport] = useState<ReceptionReadyReport | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPatientPortalOpen, setIsPatientPortalOpen] = useState(false);
  const [isDoctorPortalOpen, setIsDoctorPortalOpen] = useState(false);

  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingNoticeOrderId, setSendingNoticeOrderId] = useState<string | null>(null);
  const [reprintingOrderId, setReprintingOrderId] = useState<string | null>(null);

  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['receptionReadyReports'],
    queryFn: () => receptionDeliveryService.getReceptionReadyReports(),
    refetchInterval: 15000,
  });

  const handleSendNotice = async (orderId: string, channel: 'SMS' | 'EMAIL') => {
    setSendingNoticeOrderId(orderId);
    setNotificationMsg(null);
    try {
      const notif = await receptionDeliveryService.sendPatientNotification(orderId, { channel });
      setNotificationMsg({
        type: 'success',
        text: notif.status === 'SIMULATED'
          ? `Simulated ${channel} alert for ${notif.recipientContact}. No external message was sent in local development.`
          : `${channel} alert accepted for ${notif.recipientContact} by ${notif.provider}.`,
      });
      refetch();
    } catch (err: any) {
      setNotificationMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to send notification',
      });
    } finally {
      setSendingNoticeOrderId(null);
    }
  };

  const handleReprint = async (orderId: string, accession: string) => {
    setReprintingOrderId(orderId);
    setNotificationMsg(null);
    try {
      await receptionDeliveryService.downloadReprintPdf(orderId, `report_${accession}.pdf`, 'Front Desk Physical Handover');
      setNotificationMsg({
        type: 'success',
        text: `Printed official report PDF for Accession ${accession}. Reprint event recorded.`,
      });
      refetch();
    } catch (err: any) {
      setNotificationMsg({
        type: 'error',
        text: err?.message || 'Reprint failed',
      });
    } finally {
      setReprintingOrderId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#2563EB]" />
            <span>Finalized Diagnostic Reports — Front Desk Collection & Delivery</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Front desk collection, patient SMS/email alert, portal access, reprinting and delivery acknowledgment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setIsPatientPortalOpen(true)}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Patient Portal</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setIsDoctorPortalOpen(true)}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span>Referring Doctor Portal</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {notificationMsg && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{notificationMsg.text}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-xs"
            onClick={() => setNotificationMsg(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Reports Table */}
      <Card className="border shadow-xs bg-card">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Ready for Patient Collection / Delivery ({reports.length})
            </h3>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
              Finalized & Signed Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mb-2" />
              <span>Loading reception report queue...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              No finalized reports currently marked for reception pickup.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Patient / MRN</TableHead>
                    <TableHead className="text-xs">Accession / Exam</TableHead>
                    <TableHead className="text-xs">Report Version</TableHead>
                    <TableHead className="text-xs">Readiness Date</TableHead>
                    <TableHead className="text-xs">Delivery Status</TableHead>
                    <TableHead className="text-xs text-right">Delivery Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.orderId} className="text-xs">
                      <TableCell>
                        <div className="font-semibold text-foreground text-sm">{report.patientName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <IdentifierPill type="patient" value={report.patientId} />
                          <span className="text-muted-foreground text-[10px]">DOB: {report.dateOfBirth}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <IdentifierPill type="accession" value={report.accessionNumber} />
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {report.modality}
                          </Badge>
                          <PriorityBadge priority={report.priority} />
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate max-w-[180px] mt-0.5">
                          {report.examinationName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 font-bold text-[10px]">
                          v{report.reportVersion} FINAL
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Signed by {report.signedBy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {report.readyForReceptionAt
                              ? new Date(report.readyForReceptionAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'Ready'}
                          </span>
                        </div>
                        {report.readyForReceptionBy && (
                          <div className="text-[10px] text-muted-foreground">
                            by {report.readyForReceptionBy}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.deliveryStatus === 'DELIVERED' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            HANDED OVER ({report.deliveriesCount})
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] w-fit">
                            READY FOR PICKUP
                          </Badge>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-1">
                          {report.notificationsCount > 0 && <span>• {report.notificationsCount} alert(s)</span>}
                          {report.reprintsCount > 0 && <span>• {report.reprintsCount} print(s)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                            onClick={() => {
                              setSelectedReport(report);
                              setIsHandoverOpen(true);
                            }}
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>Handover</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex items-center gap-1"
                            disabled={sendingNoticeOrderId === report.orderId}
                            onClick={() => handleSendNotice(report.orderId, 'SMS')}
                          >
                            <Send className="h-3 w-3" />
                            <span>SMS</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex items-center gap-1"
                            disabled={sendingNoticeOrderId === report.orderId}
                            onClick={() => handleSendNotice(report.orderId, 'EMAIL')}
                          >
                            <Send className="h-3 w-3" />
                            <span>Email</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex items-center gap-1"
                            disabled={reprintingOrderId === report.orderId}
                            onClick={() => handleReprint(report.orderId, report.accessionNumber)}
                          >
                            <Printer className="h-3 w-3" />
                            <span>Print</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setHistoryOrderId(report.orderId);
                              setIsHistoryOpen(true);
                            }}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ReportHandoverModal
        report={selectedReport}
        open={isHandoverOpen}
        onOpenChange={setIsHandoverOpen}
        onSuccess={() => {
          setNotificationMsg({
            type: 'success',
            text: `Report delivery handover acknowledged successfully for ${selectedReport?.patientName}.`,
          });
          refetch();
        }}
      />

      <ReportHistoryModal
        orderId={historyOrderId}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      <PatientPortalModal
        open={isPatientPortalOpen}
        onOpenChange={setIsPatientPortalOpen}
      />

      <ReferringDoctorPortalModal
        open={isDoctorPortalOpen}
        onOpenChange={setIsDoctorPortalOpen}
      />
    </div>
  );
}

