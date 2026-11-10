import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  TrendingUp,
} from 'lucide-react';

export function TatDashboardView() {
  const { data: tatData, isLoading, refetch } = useQuery({
    queryKey: ['tatDashboardMetrics'],
    queryFn: () => receptionDeliveryService.getTatMetrics(),
    refetchInterval: 15000,
  });

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '—';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTimestamp = (isoStr: string | null) => {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
        <span>Loading Turnaround Time (TAT) analytics...</span>
      </div>
    );
  }

  const summary = tatData?.summary || {
    totalOrdersTracked: 0,
    averageReportingTatMinutes: 0,
    averageDeliveryTatMinutes: 0,
    averageEndToEndTatMinutes: 0,
    deliveredOrdersCount: 0,
    delayedCasesCount: 0,
    onTargetCasesCount: 0,
  };

  const items = tatData?.items || [];

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <span>Turnaround Time (TAT) Performance Dashboard</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Turnaround time tracking from order to schedule, scan, report finalization and delivery.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh TAT
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-xs bg-card">
          <CardHeader className="pb-2 text-xs font-semibold uppercase text-muted-foreground flex flex-row items-center justify-between">
            <span>Avg Reporting TAT</span>
            <Activity className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              {formatMinutes(summary.averageReportingTatMinutes)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Scan completion → Final report signoff
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs bg-card">
          <CardHeader className="pb-2 text-xs font-semibold uppercase text-muted-foreground flex flex-row items-center justify-between">
            <span>Avg Delivery TAT</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              {formatMinutes(summary.averageDeliveryTatMinutes)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Final signoff → Handover / download
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs bg-card">
          <CardHeader className="pb-2 text-xs font-semibold uppercase text-muted-foreground flex flex-row items-center justify-between">
            <span>Avg End-to-End TAT</span>
            <TrendingUp className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              {formatMinutes(summary.averageEndToEndTatMinutes)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Order creation → Patient delivery
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs bg-card">
          <CardHeader className="pb-2 text-xs font-semibold uppercase text-muted-foreground flex flex-row items-center justify-between">
            <span>SLA Performance</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-emerald-600">
              {summary.onTargetCasesCount} <span className="text-xs font-normal text-muted-foreground">on-target / {summary.delayedCasesCount} delayed</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {summary.deliveredOrdersCount} total completed deliveries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Examinations TAT Telemetry Table */}
      <Card className="border shadow-xs bg-card">
        <CardHeader className="pb-3 border-b">
          <h3 className="text-sm font-bold text-foreground">
            Examination Lifecycle & Turnaround Milestones
          </h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Accession / Order</TableHead>
                  <TableHead className="text-xs">Patient</TableHead>
                  <TableHead className="text-xs">Modality & Priority</TableHead>
                  <TableHead className="text-xs">Scan Completed</TableHead>
                  <TableHead className="text-xs">Report Finalized</TableHead>
                  <TableHead className="text-xs">Delivered At</TableHead>
                  <TableHead className="text-xs">Reporting TAT</TableHead>
                  <TableHead className="text-xs">Delivery TAT</TableHead>
                  <TableHead className="text-xs">SLA Adherence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                      No examinations currently tracked for turnaround telemetry.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.orderId} className="text-xs">
                      <TableCell className="font-mono">
                        <IdentifierPill type="accession" value={item.accessionNumber} />
                        <div className="text-[10px] text-muted-foreground truncate max-w-[130px] mt-0.5">
                          {item.examinationName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground">{item.patientName}</span>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {item.patientId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.modality}
                          </Badge>
                          <PriorityBadge priority={item.priority} />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(item.timestamps.scanCompletedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(item.timestamps.reportFinalizedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(item.timestamps.deliveredAt)}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {formatMinutes(item.turnaroundMinutes.reportingTatMinutes)}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {formatMinutes(item.turnaroundMinutes.deliveryTatMinutes)}
                      </TableCell>
                      <TableCell>
                        {item.slaStatus === 'ON_TARGET' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            ON TARGET ({item.targetSlaMinutes / 60}h SLA)
                          </Badge>
                        ) : item.slaStatus === 'DELAYED' ? (
                          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 text-[10px] flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                            DELAYED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground w-fit">
                            IN PROGRESS
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

