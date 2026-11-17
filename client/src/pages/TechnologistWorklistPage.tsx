import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TechnologistWorklistTable } from '../features/technologist/TechnologistWorklistTable';
import { TechnologistExamDetailModal } from '../features/technologist/TechnologistExamDetailModal';
import { technologistService } from '../services/technologistService';
import { fetchEquipment } from '../services/clinicalMasterService';
import { TechnologistWorklistItem, ModalityType } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';

export function TechnologistWorklistPage() {
  const [dateFilter, setDateFilter] = useState<string>('TODAY');
  const [modalityFilter, setModalityFilter] = useState<string>('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Compute ISO date string for TODAY or custom
  const getQueryDate = () => {
    if (dateFilter === 'ALL') return 'ALL';
    if (dateFilter === 'TODAY') {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return dateFilter;
  };

  // 1. Fetch Worklist query
  const {
    data: worklistData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'technologist',
      'worklist',
      {
        page,
        pageSize,
        date: getQueryDate(),
        modality: modalityFilter,
        equipmentId: equipmentFilter,
        priority: priorityFilter,
        search: searchTerm,
      },
    ],
    queryFn: () =>
      technologistService.getWorklist({
        page,
        pageSize,
        date: getQueryDate(),
        modality: modalityFilter,
        equipmentId: equipmentFilter,
        priority: priorityFilter,
        search: searchTerm,
      }),
    refetchInterval: 30000, // Reasonable, gentle 30s auto-refresh
  });

  // 2. Fetch Equipment list for filter (filtered by selected modality)
  const { data: equipmentList } = useQuery({
    queryKey: ['equipment', modalityFilter],
    queryFn: () =>
      fetchEquipment(
        modalityFilter !== 'ALL'
          ? { modality: modalityFilter as ModalityType }
          : undefined
      ),
  });

  const handleOpenExam = (item: TechnologistWorklistItem) => {
    setSelectedExamId(item.appointmentId);
    setIsDetailOpen(true);
  };

  const handleModalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setModalityFilter(e.target.value);
    setEquipmentFilter('ALL'); // Reset equipment when modality switches
    setPage(1);
  };

  const statCount = worklistData?.items.filter((i) => i.order.priority === 'STAT').length || 0;
  const urgentCount = worklistData?.items.filter((i) => i.order.priority === 'URGENT').length || 0;
  const routineCount = worklistData?.items.filter((i) => i.order.priority === 'ROUTINE').length || 0;

  const isForbidden =
    Boolean(
      (error && 'statusCode' in error && (error as { statusCode?: number }).statusCode === 403) ||
      (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && (
        error.message.toLowerCase().includes('access denied') ||
        error.message.toLowerCase().includes('forbidden') ||
        error.message.includes('403')
      ))
    );

  if (isForbidden) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md w-full border-rose-200 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-rose-900 text-base font-bold">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm font-semibold text-slate-800">
              You do not have permission to access the Technologist Worklist.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              This clinical area is strictly restricted to authorized Technologist and Administrator personnel.
            </p>
            <div className="pt-2 flex justify-center">
              <Link to="/dashboard">
                <Button size="sm" variant="outline" className="text-xs">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Technologist Acquisition Worklist (MWL)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Operational scanner queue: safety check, clinical protocol selection, and PACS transfer
          </p>
        </div>

        {/* Live Queue Urgency Counter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#dce6e0] rounded-full text-xs shadow-soft">
            <span className="text-slate-500 font-semibold">Ready:</span>
            <span className="font-extrabold text-slate-900 font-mono text-xs">{worklistData?.total || 0}</span>
            {statCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full animate-pulse">
                {statCount} STAT
              </span>
            )}
            {urgentCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full">
                {urgentCount} URGENT
              </span>
            )}
            {routineCount > 0 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-[10px] rounded-full">
                {routineCount} ROUTINE
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full border-[#dce6e0] text-slate-800 hover:bg-[#f8faf8] shadow-soft"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="shadow-soft border border-[#dce6e0] rounded-3xl bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search patient, MRN, accession, procedure..."
                className="pl-9 pr-4 py-2 text-xs rounded-full border-[#dce6e0] bg-[#f8faf8] focus:bg-white"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Modality Filter */}
            <div>
              <select
                aria-label="Filter by Modality"
                value={modalityFilter}
                onChange={handleModalityChange}
                className="w-full py-2 px-3.5 text-xs font-bold rounded-full border border-[#dce6e0] bg-[#f8faf8] text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Modalities</option>
                <option value="CT">CT (Computed Tomography)</option>
                <option value="MRI">MRI (Magnetic Resonance)</option>
                <option value="XRAY">X-Ray (Radiography)</option>
              </select>
            </div>

            {/* Equipment Filter */}
            <div>
              <select
                aria-label="Filter by Equipment"
                value={equipmentFilter}
                onChange={(e) => {
                  setEquipmentFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2 px-3.5 text-xs font-bold rounded-full border border-[#dce6e0] bg-[#f8faf8] text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Scanners</option>
                {equipmentList?.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.modality})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                aria-label="Filter by Priority"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2 px-3.5 text-xs font-bold rounded-full border border-[#dce6e0] bg-[#f8faf8] text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Priorities</option>
                <option value="STAT">STAT (Emergency)</option>
                <option value="URGENT">URGENT</option>
                <option value="ROUTINE">ROUTINE</option>
              </select>
            </div>
          </div>

          {/* Quick Date Pills */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-600">Date Range:</span>
              <div className="flex items-center gap-1 bg-[#f0f4f1] p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('TODAY');
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${
                    dateFilter === 'TODAY'
                      ? 'bg-slate-900 text-white shadow-soft font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('ALL');
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${
                    dateFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-soft font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Dates
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Clinical sorting: STAT &gt; URGENT &gt; ROUTINE &gt; Scheduled Time
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Failed to load technologist worklist</span>
            <p className="mt-0.5">
              {error instanceof Error ? error.message : 'Please check your connection and login session.'}
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-3">
          <div className="h-4 bg-slate-100 rounded w-1/4 animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? null : worklistData && worklistData.items.length > 0 ? (
        /* Real Worklist Table */
        <div className="space-y-4">
          <TechnologistWorklistTable
            items={worklistData.items}
            onOpenExam={handleOpenExam}
          />

          {/* Pagination Controls */}
          {worklistData.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Showing page <strong className="text-slate-800">{worklistData.page}</strong> of{' '}
                <strong className="text-slate-800">{worklistData.totalPages}</strong> ({worklistData.total} exams)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={worklistData.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={worklistData.page >= worklistData.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="border border-slate-200 border-dashed rounded-xl bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 text-sm">
              No patients are currently ready for technologist processing.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Exams automatically appear here once reception completes patient arrival and check-in,
              moving the order to READY FOR TECHNOLOGIST status.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDateFilter('ALL');
                setModalityFilter('ALL');
                setEquipmentFilter('ALL');
                setPriorityFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs"
            >
              Clear Active Filters
            </Button>
          </div>
        </div>
      )}

      {/* Technologist Exam Detail Modal */}
      <TechnologistExamDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        examId={selectedExamId}
      />
    </div>
  );
}

export default TechnologistWorklistPage;

