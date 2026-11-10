import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../services/radiologistService';
import { RadiologistStudyDetailModal } from '../features/radiologist/RadiologistStudyDetailModal';
import { RadiologistReportModal } from '../features/radiologist/RadiologistReportModal';
import { RadiologistWorklistItem, ModalityType, Priority } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { calculateAge, formatDuration } from '../utils/formatters';
import { formatSafeErrorMessage } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import {
  Layers,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { PeerReviewWorkspaceModal } from '../features/radiologist/PeerReviewWorkspaceModal';
import { CriticalFindingDetailModal } from '../features/radiologist/CriticalFindingDetailModal';

export function RadiologistWorklistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalityFilter, setModalityFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // Phase 4.6 & 4.7 — Tab, Peer Review and Critical Findings state
  const [activeTab, setActiveTab] = useState<'WORKLIST' | 'PEER_REVIEW' | 'CRITICAL_FINDINGS'>('WORKLIST');
  const [activePeerReviewId, setActivePeerReviewId] = useState<string | null>(null);
  const [peerStatusFilter, setPeerStatusFilter] = useState<string>('ALL');
  const [peerPage, setPeerPage] = useState<number>(1);

  // Phase 4.7 — Critical Findings state
  const [activeCriticalFindingId, setActiveCriticalFindingId] = useState<string | null>(null);
  const [criticalStatusFilter, setCriticalStatusFilter] = useState<string>('ALL');
  const [criticalPage, setCriticalPage] = useState<number>(1);

  // Critical findings queue query
  const {
    data: criticalFindingsQueue,
    isLoading: isCriticalLoading,
    isFetching: isCriticalFetching,
    refetch: refetchCriticalQueue,
  } = useQuery({
    queryKey: ['criticalFindingQueue', { criticalPage, criticalStatusFilter }],
    queryFn: () =>
      radiologistService.getCriticalFindingQueue({
        page: criticalPage,
        limit: pageSize,
        status: criticalStatusFilter !== 'ALL' ? (criticalStatusFilter as any) : undefined,
      }),
    enabled: true,
  });

  // Peer review queue query
  const {
    data: peerReviewQueue,
    isLoading: isPeerLoading,
    isFetching: isPeerFetching,
    refetch: refetchPeerQueue,
  } = useQuery({
    queryKey: ['peerReviewQueue', { peerPage, peerStatusFilter }],
    queryFn: () =>
      radiologistService.getPeerReviewQueue({
        page: peerPage,
        limit: pageSize,
        status: peerStatusFilter !== 'ALL' ? (peerStatusFilter as any) : undefined,
      }),
    enabled: true,
  });

  const {
    data: worklistData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'radiologistWorklist',
      { modalityFilter, priorityFilter, assignmentFilter, searchTerm, page },
    ],
    queryFn: () =>
      radiologistService.getWorklist({
        page,
        limit: pageSize,
        modality: modalityFilter !== 'ALL' ? (modalityFilter as ModalityType) : undefined,
        priority: priorityFilter !== 'ALL' ? (priorityFilter as Priority) : undefined,
        assignmentStatus: assignmentFilter,
        search: searchTerm.trim() || undefined,
      }),
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => radiologistService.claimStudy(id),
    onSuccess: () => {
      setRowError(null);
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
    },
    onError: (err: any) => {
      setRowError(formatSafeErrorMessage(err, 'Failed to claim study.'));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => radiologistService.releaseStudy(id),
    onSuccess: () => {
      setRowError(null);
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
    },
    onError: (err: any) => {
      setRowError(formatSafeErrorMessage(err, 'Failed to release assignment.'));
    },
  });

  const handleOpenStudy = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsDetailOpen(true);
  };

  const isRadiologist = user?.role === 'RADIOLOGIST';

  return (
    <div className="space-y-4 w-full pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#DCE2EC]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">Radiologist Worklist</h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Prioritized queue of quality-accepted exams awaiting interpretation and reporting.
          </p>
        </div>
        {worklistData?.counts && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              Total: {worklistData.counts.total}
            </span>
            {worklistData.counts.stat > 0 && (
              <Badge variant="destructive" className="animate-pulse font-bold">
                STAT: {worklistData.counts.stat}
              </Badge>
            )}
            {worklistData.counts.urgent > 0 && (
              <Badge variant="warning" className="font-semibold">
                Urgent: {worklistData.counts.urgent}
              </Badge>
            )}
            <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
              Unassigned: {worklistData.counts.unassigned}
            </span>
          </div>
        )}
      </div>

      {rowError && (
        <div className="px-3 py-2 bg-rose-50 text-rose-700 rounded border border-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{rowError}</span>
          </div>
          <button type="button" onClick={() => setRowError(null)} className="text-rose-500 hover:text-rose-700 ml-2">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div role="tablist" aria-label="Radiologist Workspace Views" className="flex items-center border-b border-[#DCE2EC] overflow-x-auto thin-scroll">
        {[
          { tab: 'WORKLIST' as const,         label: 'Ready Studies',          Icon: Layers,        count: worklistData?.pagination?.total, color: '[#33398A]' },
          { tab: 'PEER_REVIEW' as const,      label: 'Peer Review',            Icon: Users,         count: peerReviewQueue?.pagination?.total, color: 'indigo-600' },
          { tab: 'CRITICAL_FINDINGS' as const, label: 'Critical Findings',     Icon: AlertTriangle, count: criticalFindingsQueue?.items?.filter((i) => i.status === 'PENDING').length, color: 'rose-600' },
        ].map(({ tab, label, Icon, count }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={[
                'flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors relative',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#33398A]',
                isActive
                  ? 'text-[#33398A] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#33398A]'
                  : 'text-[#64748B] hover:text-[#15233B] hover:bg-[#F3F6FC]',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-[#33398A] text-white' : 'bg-[#F3F6FC] text-[#64748B] border border-[#DCE2EC]'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'WORKLIST' ? (
        <>
          {/* 2. Filters & Search Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient, ID, accession, exam..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Modality Filter */}
            <div>
              <select
                className="w-full text-xs border rounded-md h-9 px-2 bg-background"
                value={modalityFilter}
                onChange={(e) => {
                  setModalityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Modalities</option>
                <option value="CT">CT</option>
                <option value="MRI">MRI</option>
                <option value="XRAY">X-Ray</option>
                <option value="ULTRASOUND">Ultrasound</option>
                <option value="MAMMOGRAPHY">Mammography</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                className="w-full text-xs border rounded-md h-9 px-2 bg-background"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Priorities</option>
                <option value="STAT">STAT First</option>
                <option value="URGENT">Urgent</option>
                <option value="ROUTINE">Routine</option>
              </select>
            </div>

            {/* Assignment Status Filter */}
            <div>
              <select
                className="w-full text-xs border rounded-md h-9 px-2 bg-background"
                value={assignmentFilter}
                onChange={(e) => {
                  setAssignmentFilter(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="ALL">All Assignments</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                <option value="ASSIGNED">Assigned Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>
              Showing {worklistData?.items.length || 0} of {worklistData?.pagination.total || 0} eligible studies
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-7 text-xs flex items-center gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Worklist Table */}
      <Card>
        <CardHeader className="p-4 pb-2 border-b">
          <CardTitle className="text-base font-semibold">Ready Studies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading eligible radiologist studies...
            </div>
          ) : error ? (
            <div className="py-8 px-4 text-center text-destructive">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              <p className="font-semibold">Unable to load radiologist worklist</p>
              <p className="text-xs text-muted-foreground mt-1">{formatSafeErrorMessage(error)}</p>
            </div>
          ) : !worklistData?.items.length ? (
            <div className="py-16 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-semibold text-foreground">No studies waiting</p>
              <p className="text-xs text-muted-foreground mt-1">
                All eligible PACS-ready studies have been processed, or no records matched the filters.
              </p>
            </div>
          ) : (
            <div className="table-scroll-container thin-scroll w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3 min-w-[110px] whitespace-nowrap">Priority</th>
                    <th className="py-2.5 px-3 min-w-[190px]">Patient</th>
                    <th className="py-2.5 px-3 min-w-[180px] whitespace-nowrap">Accession</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Modality & Examination</th>
                    <th className="py-2.5 px-3 min-w-[180px] whitespace-nowrap">Waiting</th>
                    <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Assignment</th>
                    <th className="py-2.5 px-3 min-w-[140px] whitespace-nowrap">PACS State</th>
                    <th className="py-2.5 px-3 min-w-[230px] whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {worklistData.items.map((item: RadiologistWorklistItem) => {
                    const isAssignedToMe = item.assignedRadiologist?.isAssignedToMe;
                    const isAssigned = item.assignmentStatus === 'ASSIGNED';

                    return (
                      <tr
                        key={item.imagingOrderId}
                        className={`group hover:bg-muted/30 transition-colors ${
                          item.priority === 'STAT'
                            ? 'bg-red-50/40 dark:bg-red-950/20'
                            : ''
                        }`}
                      >
                        {/* Priority */}
                        <td className="py-2.5 px-3 min-w-[110px] whitespace-nowrap align-middle">
                          <PriorityBadge priority={item.priority} />
                        </td>

                        {/* Patient */}
                        <td className="py-2.5 px-3 min-w-[190px] align-middle">
                          <div className="font-semibold text-foreground">
                            {item.patientName}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <IdentifierPill type="patient" value={item.patientId} />
                            <span>
                              {calculateAge(item.patientDob)}y / {item.patientGender[0]}
                            </span>
                          </div>
                        </td>

                        {/* Accession */}
                        <td className="py-2.5 px-3 min-w-[180px] whitespace-nowrap align-middle">
                          <IdentifierPill type="accession" value={item.accessionNumber} />
                        </td>

                        {/* Modality & Exam */}
                        <td className="py-2.5 px-3 min-w-[280px] align-middle">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
                              {item.modality}
                            </Badge>
                            <span>{item.procedureName}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            <span>{item.bodyPart}</span>
                            {item.referringDoctor && (
                              <span className="ml-2">• Ref: {item.referringDoctor}</span>
                            )}
                          </div>
                        </td>

                        {/* Waiting Duration */}
                        <td className="py-2.5 px-3 min-w-[180px] whitespace-nowrap align-middle">
                          {item.orderStatus === 'COMPLETED' ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Reported</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pl-5">
                                {formatDuration(item.waitingMinutes)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 text-xs">
                                <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span>Waiting</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 pl-5">
                                {formatDuration(item.waitingMinutes)}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Assignment */}
                        <td className="py-2.5 px-3 min-w-[150px] whitespace-nowrap align-middle">
                          {isAssignedToMe ? (
                            <Badge className="bg-emerald-600 text-white text-[11px]">
                              Assigned to You
                            </Badge>
                          ) : isAssigned ? (
                            <Badge variant="secondary" className="text-[11px] font-normal">
                              {item.assignedRadiologist?.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">
                              Unassigned
                            </Badge>
                          )}
                        </td>

                        {/* PACS State */}
                        <td className="py-2.5 px-3 min-w-[140px] whitespace-nowrap align-middle">
                          <Badge
                            className={`text-[10px] font-semibold ${
                              item.pacsIntegrationState.status === 'MATCHED'
                                ? 'bg-emerald-600 text-white'
                                : item.pacsIntegrationState.status === 'COMPLETE'
                                ? 'bg-blue-600 text-white'
                                : item.pacsIntegrationState.status === 'PACS_UNAVAILABLE'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-600 text-white'
                            }`}
                            title={item.pacsIntegrationState.label}
                          >
                            {item.pacsIntegrationState.status === 'MATCHED'
                              ? 'Study Matched'
                              : item.pacsIntegrationState.status === 'COMPLETE'
                              ? 'Complete'
                              : item.pacsIntegrationState.status === 'PACS_UNAVAILABLE'
                              ? 'Unavailable'
                              : item.pacsIntegrationState.label}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 min-w-[230px] whitespace-nowrap text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Claim button if Radiologist & unassigned */}
                            {isRadiologist && !isAssigned && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-primary border-primary/30 hover:bg-primary/10 shadow-xs"
                                onClick={() => claimMutation.mutate(item.imagingOrderId)}
                                disabled={claimMutation.isPending}
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Claim
                              </Button>
                            )}

                            {/* Release button if assigned to current user */}
                            {isAssignedToMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shadow-xs"
                                onClick={() => releaseMutation.mutate(item.imagingOrderId)}
                                disabled={releaseMutation.isPending}
                              >
                                Release
                              </Button>
                            )}

                            {/* Open Study Details Modal */}
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs flex items-center gap-1 shadow-xs bg-[#174A70] hover:bg-[#123855] text-white"
                              onClick={() => handleOpenStudy(item.imagingOrderId)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open Study
                            </Button>

                            {/* Open Diagnostic Reporting Workspace */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs flex items-center gap-1 text-[#227DA5] border-[#227DA5]/30 hover:bg-[#227DA5]/10 shadow-xs font-medium"
                              onClick={() => navigate(`/reporting/${item.imagingOrderId}`)}
                            >
                              <FileText className="h-3 w-3" />
                              {item.orderStatus === 'COMPLETED' ? 'View Report' : 'Draft Report'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {worklistData && worklistData.pagination.totalPages > 1 && (
            <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {worklistData.pagination.page} of {worklistData.pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page >= worklistData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      ) : activeTab === 'PEER_REVIEW' ? (
        /* ========================================== */
        /* Phase 4.6 — Peer Review Requests Queue    */
        /* ========================================== */
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Review Status Filter:
                </span>
                <select
                  className="text-xs border rounded-md h-8 px-2.5 bg-background text-foreground"
                  value={peerStatusFilter}
                  onChange={(e) => {
                    setPeerStatusFilter(e.target.value);
                    setPeerPage(1);
                  }}
                >
                  <option value="ALL">All Requests</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchPeerQueue()}
                disabled={isPeerFetching}
                className="h-7 text-xs flex items-center gap-1"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPeerFetching ? 'animate-spin text-primary' : ''}`} />
                Refresh
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Second Opinion Consultation Queue</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isPeerLoading ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading peer review requests...
                </div>
              ) : !peerReviewQueue?.items || peerReviewQueue.items.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No peer review requests matching current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left font-semibold text-muted-foreground">
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Accession</th>
                        <th className="py-2.5 px-3">Modality & Exam</th>
                        <th className="py-2.5 px-3">Requested By</th>
                        <th className="py-2.5 px-3">Assigned Reviewer</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Requested At</th>
                        <th className="py-2.5 px-3 text-right sticky right-0 z-20 bg-muted/95 backdrop-blur-xs shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {peerReviewQueue.items.map((item) => (
                        <tr key={item.id} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <PriorityBadge priority={item.order.priority} />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{item.patient.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <IdentifierPill type="patient" value={item.patient.patientId} />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                            <IdentifierPill type="accession" value={item.order.accessionNumber} />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                                {item.order.modality}
                              </Badge>
                              <span>{item.order.procedureName}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.order.bodyPart}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                            {item.requester.name}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                            {item.reviewer.name}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <Badge
                              className={`text-[10px] font-semibold ${
                                item.status === 'COMPLETED'
                                  ? 'bg-emerald-600 text-white'
                                  : item.status === 'IN_REVIEW'
                                  ? 'bg-blue-600 text-white'
                                  : item.status === 'PENDING'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-600 text-white'
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                            {new Date(item.requestedAt).toLocaleDateString()}{' '}
                            {new Date(item.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-right sticky right-0 z-10 bg-background/95 backdrop-blur-xs group-hover:bg-muted/40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] transition-colors">
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 shadow-xs"
                              onClick={() => setActivePeerReviewId(item.id)}
                            >
                              <Users className="h-3 w-3" />
                              Open Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Peer Queue Pagination */}
              {peerReviewQueue && peerReviewQueue.pagination.totalPages > 1 && (
                <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {peerReviewQueue.pagination.page} of {peerReviewQueue.pagination.totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={peerPage <= 1}
                      onClick={() => setPeerPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={peerPage >= peerReviewQueue.pagination.totalPages}
                      onClick={() => setPeerPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ========================================== */
        /* Phase 4.7 — Critical Findings Inbox Queue */
        /* ========================================== */
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span>Critical Findings Communication & Acknowledgment Inbox</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border rounded-md h-8 px-2.5 bg-background text-foreground"
                  value={criticalStatusFilter}
                  onChange={(e) => {
                    setCriticalStatusFilter(e.target.value);
                    setCriticalPage(1);
                  }}
                >
                  <option value="ALL">All Alerts</option>
                  <option value="PENDING">Pending Acknowledgment</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs flex items-center gap-1"
                  onClick={() => refetchCriticalQueue()}
                  disabled={isCriticalFetching}
                >
                  <RefreshCw className={`h-3 w-3 ${isCriticalFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isCriticalLoading ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-red-600" />
                  Loading critical findings...
                </div>
              ) : !criticalFindingsQueue?.items || criticalFindingsQueue.items.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40 text-red-500" />
                  No critical findings matching current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left font-semibold text-muted-foreground">
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Accession</th>
                        <th className="py-2.5 px-3">Modality & Exam</th>
                        <th className="py-2.5 px-3">Finding Summary</th>
                        <th className="py-2.5 px-3">Reporting Radiologist</th>
                        <th className="py-2.5 px-3">Responsible Clinician</th>
                        <th className="py-2.5 px-3">Sent At</th>
                        <th className="py-2.5 px-3 text-right sticky right-0 z-20 bg-muted/95 backdrop-blur-xs shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {criticalFindingsQueue.items.map((item) => (
                        <tr key={item.id} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <Badge
                              className={`text-[10px] font-semibold ${
                                item.status === 'ACKNOWLEDGED'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-red-600 text-white animate-pulse'
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{item.order?.patientName || 'Unknown'}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <IdentifierPill type="patient" value={item.order?.patientId || ''} />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                            <IdentifierPill type="accession" value={item.order?.accessionNumber || ''} />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                                {item.order?.modality}
                              </Badge>
                              <span>{item.order?.examinationName}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.order?.bodyPart}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-slate-800 dark:text-slate-200">
                            {item.findingText}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                            {item.createdBy.name}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                            {item.recipient.name}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                            {new Date(item.sentAt).toLocaleDateString()}{' '}
                            {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-right sticky right-0 z-10 bg-background/95 backdrop-blur-xs group-hover:bg-muted/40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] transition-colors">
                            <Button
                              size="sm"
                              className={`h-7 px-2.5 text-xs font-semibold flex items-center gap-1 shadow-xs ${
                                item.status === 'PENDING' && (user?.id === item.recipient.id || user?.role === 'ADMIN')
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-red-600 hover:bg-red-700 text-white'
                              }`}
                              onClick={() => setActiveCriticalFindingId(item.id)}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {item.status === 'PENDING' && (user?.id === item.recipient.id || user?.role === 'ADMIN')
                                ? 'Review & Acknowledge'
                                : 'View Alert'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Critical Queue Pagination */}
              {criticalFindingsQueue && criticalFindingsQueue.pagination.totalPages > 1 && (
                <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {criticalFindingsQueue.pagination.page} of {criticalFindingsQueue.pagination.totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={criticalPage <= 1}
                      onClick={() => setCriticalPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={criticalPage >= criticalFindingsQueue.pagination.totalPages}
                      onClick={() => setCriticalPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Study Detail Modal */}
      <RadiologistStudyDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        orderId={selectedOrderId}
      />

      {/* 5. Reporting Workspace Modal (Phase 4.3) */}
      <RadiologistReportModal
        open={!!reportingOrderId}
        onOpenChange={(isOpen) => !isOpen && setReportingOrderId(null)}
        orderId={reportingOrderId}
      />

      {/* 6. Peer Review Workspace Modal (Phase 4.6) */}
      <PeerReviewWorkspaceModal
        isOpen={!!activePeerReviewId}
        onOpenChange={(isOpen) => !isOpen && setActivePeerReviewId(null)}
        peerReviewId={activePeerReviewId}
      />

      {/* 7. Critical Finding Detail Modal (Phase 4.7) */}
      <CriticalFindingDetailModal
        isOpen={!!activeCriticalFindingId}
        onOpenChange={(isOpen) => !isOpen && setActiveCriticalFindingId(null)}
        findingId={activeCriticalFindingId}
      />
    </div>
  );
}
