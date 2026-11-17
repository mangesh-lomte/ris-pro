import * as React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ModalityType, OrderStatus, Priority, ImagingOrder } from '../../types';
import {
  Search,
  Filter,
  Droplet,
  CalendarPlus,
  Activity,
  Radio,
  Check,
  X,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { MoreFiltersModal, MoreFilterValues } from './MoreFiltersModal';

interface OrdersTableViewProps {
  orders: ImagingOrder[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedModality: ModalityType | 'ALL';
  setSelectedModality: (mod: ModalityType | 'ALL') => void;
  selectedStatus: OrderStatus | 'ALL';
  setSelectedStatus: (st: OrderStatus | 'ALL') => void;
  selectedPriority: Priority | 'ALL';
  setSelectedPriority: (p: Priority | 'ALL') => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  moreFilters: MoreFilterValues;
  setMoreFilters: React.Dispatch<React.SetStateAction<MoreFilterValues>>;
  onScheduleOrder: (order: ImagingOrder) => void;
  onTrackOrder: (order: ImagingOrder) => void;
  onSyncMwl: (orderId: string) => void;
  syncedMwlId: string | null;
}

export function OrdersTableView({
  orders,
  isLoading,
  searchTerm,
  setSearchTerm,
  selectedModality,
  setSelectedModality,
  selectedStatus,
  setSelectedStatus,
  selectedPriority,
  setSelectedPriority,
  selectedDate,
  setSelectedDate,
  moreFilters,
  setMoreFilters,
  onScheduleOrder,
  onTrackOrder,
  onSyncMwl,
  syncedMwlId,
}: OrdersTableViewProps) {
  const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false);

  // Calculate active extra filter count
  const extraFilterCount = React.useMemo(() => {
    let count = 0;
    if (moreFilters.bodyPart !== 'ALL') count++;
    if (moreFilters.referringDoctor.trim() !== '') count++;
    if (moreFilters.contrastRequirement !== 'ALL') count++;
    if (moreFilters.authorizationStatus !== 'ALL') count++;
    return count;
  }, [moreFilters]);

  // Check if any filter is active
  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedModality !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedDate !== 'ALL' ||
    extraFilterCount > 0;

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedModality('ALL');
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedDate('ALL');
    setMoreFilters({
      referringDoctor: '',
      bodyPart: 'ALL',
      contrastRequirement: 'ALL',
      authorizationStatus: 'ALL',
    });
  };

  // Filter orders by extra client filters if set
  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      // Body part
      if (moreFilters.bodyPart !== 'ALL') {
        if (!o.bodyPart?.toLowerCase().includes(moreFilters.bodyPart.toLowerCase())) {
          return false;
        }
      }
      // Referring physician
      if (moreFilters.referringDoctor.trim() !== '') {
        const docName = o.referringDoctor?.name || o.referringDoctorText || '';
        if (!docName.toLowerCase().includes(moreFilters.referringDoctor.toLowerCase())) {
          return false;
        }
      }
      // Contrast requirement
      if (moreFilters.contrastRequirement !== 'ALL') {
        if (moreFilters.contrastRequirement === 'NONE' && o.contrastRequired) return false;
        if (moreFilters.contrastRequirement !== 'NONE') {
          if (!o.contrastRequired) return false;
          if (
            o.contrastRequirement &&
            o.contrastRequirement !== moreFilters.contrastRequirement &&
            o.contrastRequirement !== 'BOTH'
          ) {
            return false;
          }
        }
      }
      // Authorization status
      if (moreFilters.authorizationStatus !== 'ALL') {
        if (o.authorizationStatus !== moreFilters.authorizationStatus) {
          return false;
        }
      }
      return true;
    });
  }, [orders, moreFilters]);

  return (
    <div className="space-y-4">
      {/* 1. COMPACT ENTERPRISE FILTER BAR */}
      <div className="rounded-3xl border border-[#dce6e0] bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] sm:min-w-[280px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search accession, patient, MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-[#dce6e0] rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-[#f8faf8] focus:bg-white text-slate-800 placeholder:text-slate-400 font-medium transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Standard Dropdown Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Modality Dropdown */}
            <select
              aria-label="Filter by Modality"
              value={selectedModality}
              onChange={(e) => setSelectedModality(e.target.value as ModalityType | 'ALL')}
              className="px-3.5 py-2 text-xs font-bold border border-[#dce6e0] rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-[#f8faf8] hover:bg-[#f0f4f1] text-slate-700 cursor-pointer transition-colors"
            >
              <option value="ALL">Modality: All</option>
              <option value="MRI">MRI</option>
              <option value="CT">CT</option>
              <option value="XRAY">X-Ray (XR)</option>
              <option value="ULTRASOUND">Ultrasound (US)</option>
              <option value="MAMMOGRAPHY">Mammography (MG)</option>
            </select>

            {/* Status Dropdown */}
            <select
              aria-label="Filter by Status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'ALL')}
              className="px-3.5 py-2 text-xs font-bold border border-[#dce6e0] rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-[#f8faf8] hover:bg-[#f0f4f1] text-slate-700 cursor-pointer transition-colors"
            >
              <option value="ALL">Status: All</option>
              <option value="CREATED">Created</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="READY_FOR_TECH">Ready for Tech</option>
              <option value="SAFETY_REVIEW">Safety Review</option>
              <option value="SAFETY_CLEARED">Safety Cleared</option>
              <option value="PREPARATION_IN_PROGRESS">Prep in Progress</option>
              <option value="PREPARED">Prepared</option>
              <option value="READY_FOR_SCAN">Ready for Scan</option>
              <option value="SCAN_IN_PROGRESS">Scanning</option>
              <option value="SCAN_COMPLETED">Scan Completed</option>
              <option value="SCAN_CANCELLED">Cancelled</option>
            </select>

            {/* Priority Dropdown */}
            <select
              aria-label="Filter by Priority"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority | 'ALL')}
              className="px-3.5 py-2 text-xs font-bold border border-[#dce6e0] rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-[#f8faf8] hover:bg-[#f0f4f1] text-slate-700 cursor-pointer transition-colors"
            >
              <option value="ALL">Priority: All</option>
              <option value="STAT">STAT (Critical)</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>

            {/* Date Range Dropdown */}
            <select
              aria-label="Filter by Date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold border border-[#dce6e0] rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-[#f8faf8] hover:bg-[#f0f4f1] text-slate-700 cursor-pointer transition-colors"
            >
              <option value="ALL">Date: All</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </select>

            {/* More Filters Popover Trigger */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMoreFiltersOpen(true)}
              className={`px-3.5 py-2 text-xs font-bold gap-1.5 border-[#dce6e0] rounded-full transition-colors ${
                extraFilterCount > 0 ? 'bg-slate-900 text-white border-slate-900 shadow-soft' : 'bg-[#f8faf8] text-slate-700 hover:bg-[#f0f4f1]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {extraFilterCount > 0 && (
                <span className="rounded-full bg-emerald-400 text-slate-950 text-[10px] px-1.5 py-0 font-extrabold ml-0.5">
                  {extraFilterCount}
                </span>
              )}
            </Button>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAllFilters}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 rounded-full cursor-pointer"
                title="Clear all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* 2. FILTER STATES BADGES ROW */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Active Filters:
            </span>

            {searchTerm && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Query: "{searchTerm}"</span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedModality !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-[#174A70]/10 text-[#174A70] px-2 py-0.5 text-[11px] font-medium border border-[#174A70]/20">
                <span>Modality: {selectedModality}</span>
                <button
                  type="button"
                  onClick={() => setSelectedModality('ALL')}
                  className="text-[#174A70] hover:text-[#123855] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-800 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Status: {selectedStatus.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ALL')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedPriority !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px] font-medium border border-amber-200">
                <span>Priority: {selectedPriority}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPriority('ALL')}
                  className="text-amber-600 hover:text-amber-800 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedDate !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Date: {selectedDate === 'TODAY' ? 'Today' : selectedDate === '7DAYS' ? '7 Days' : '30 Days'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDate('ALL')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {moreFilters.bodyPart !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Region: {moreFilters.bodyPart}</span>
                <button
                  type="button"
                  onClick={() => setMoreFilters((prev) => ({ ...prev, bodyPart: 'ALL' }))}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {moreFilters.referringDoctor.trim() !== '' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Dr: {moreFilters.referringDoctor}</span>
                <button
                  type="button"
                  onClick={() => setMoreFilters((prev) => ({ ...prev, referringDoctor: '' }))}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {moreFilters.contrastRequirement !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-medium border border-indigo-200">
                <span>Contrast: {moreFilters.contrastRequirement}</span>
                <button
                  type="button"
                  onClick={() => setMoreFilters((prev) => ({ ...prev, contrastRequirement: 'ALL' }))}
                  className="text-indigo-400 hover:text-indigo-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {moreFilters.authorizationStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium border border-slate-200">
                <span>Auth: {moreFilters.authorizationStatus}</span>
                <button
                  type="button"
                  onClick={() => setMoreFilters((prev) => ({ ...prev, authorizationStatus: 'ALL' }))}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 underline ml-1 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* 3. ORDERS TABLE WITH CONTAINED SCROLL */}
      <div className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft overflow-hidden">
        <div className="px-5 py-3.5 bg-white border-b border-[#e9f1ed] flex items-center justify-between text-xs text-slate-600">
          <div className="font-bold text-slate-900 text-sm">
            Orders Registry ({filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'})
          </div>
          <span className="text-[11px] text-slate-400 font-clinical-mono font-semibold">
            {isLoading ? 'Refreshing orders...' : 'PACS & MWL Synchronized'}
          </span>
        </div>

        <div className="table-scroll-container thin-scroll w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              <p className="font-bold text-slate-700">No imaging orders match the selected criteria.</p>
              <p className="text-[11px] text-slate-400 mt-1">Try modifying the search query or resetting filters.</p>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAllFilters}
                  className="mt-3 text-xs font-bold border-[#dce6e0] rounded-full"
                >
                  Reset All Filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#e9f1ed] bg-[#f8faf8] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[150px]">Patient / MRN</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[140px]">Accession</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[180px]">Exam / Modality</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[90px]">Priority</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[160px]">Indication</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[130px]">Referring Physician</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[120px]">Scheduled</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap min-w-[110px]">Status</TableHead>
                  <TableHead className="py-3 px-4 whitespace-nowrap text-right min-w-[170px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const scheduledTime = order.appointment?.scheduledStart
                    ? new Date(order.appointment.scheduledStart).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <TableRow key={order.id} className="hover:bg-[#F8FAFC] transition-colors text-xs worklist-row">
                      {/* 1. Patient / MRN */}
                      <TableCell className="py-1.5 px-3 align-top">
                        {order.patient ? (
                          <Link
                            to={`/patients/${order.patient.patientId}`}
                            className="font-semibold text-[#1E293B] hover:text-[#2563EB] hover:underline block leading-tight"
                          >
                            {order.patient.lastName}, {order.patient.firstName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-[#1E293B] leading-tight">Unknown Patient</span>
                        )}
                        <div className="mt-0.5">
                          <IdentifierPill type="patient" value={order.patient?.patientId || ''} />
                        </div>
                      </TableCell>

                      {/* 2. Accession */}
                      <TableCell className="py-1.5 px-3 align-top">
                        <IdentifierPill type="accession" value={order.accessionNumber} />
                      </TableCell>

                      {/* 3. Exam & Modality */}
                      <TableCell className="py-1.5 px-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="font-semibold text-[10px] py-0 px-1 rounded bg-slate-100 text-slate-800">
                            {order.modality}
                          </Badge>
                          <span className="font-medium text-[#1E293B] text-xs">
                            {order.examinationName}
                          </span>
                          {order.contrastRequirement && order.contrastRequirement !== 'NONE' && (
                            <span
                              title={`Contrast Protocol: ${order.contrastRequirement}`}
                              className="inline-flex items-center text-[10px] bg-blue-50 text-[#2563EB] border border-blue-200 px-1 py-0.2 rounded font-medium"
                            >
                              <Droplet className="w-2.5 h-2.5 mr-0.5 fill-[#2563EB]" />
                              +{order.contrastRequirement}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{order.bodyPart}</span>
                      </TableCell>

                      {/* 4. Priority */}
                      <TableCell className="py-1.5 px-3 align-top">
                        <PriorityBadge priority={order.priority} />
                      </TableCell>

                      {/* 5. Indication */}
                      <TableCell className="py-1.5 px-3 align-top max-w-[200px]">
                        <p className="text-xs text-slate-600 truncate" title={order.clinicalIndication}>
                          {order.clinicalIndication || '—'}
                        </p>
                      </TableCell>

                      {/* 6. Referring Physician */}
                      <TableCell className="py-1.5 px-3 align-top">
                        <span className="text-xs text-slate-700 font-medium block">
                          {order.referringDoctor?.name || order.referringDoctorText || 'Internal / Hospital'}
                        </span>
                      </TableCell>

                      {/* 7. Scheduled */}
                      <TableCell className="py-2.5 px-3 align-top whitespace-nowrap">
                        {scheduledTime ? (
                          <div>
                            <span className="font-medium text-slate-800">{scheduledTime}</span>
                            {order.appointment?.location && (
                              <span className="text-[10px] text-slate-400 block">{order.appointment.location}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not scheduled</span>
                        )}
                      </TableCell>

                      {/* 8. Status */}
                      <TableCell className="py-2.5 px-3 align-top">
                        <StatusBadge status={order.orderStatus} />
                      </TableCell>

                      {/* 9. Actions */}
                      <TableCell className="py-3 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {order.orderStatus === 'CREATED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs font-bold gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-full whitespace-nowrap cursor-pointer"
                              onClick={() => onScheduleOrder(order)}
                              title="Schedule appointment slot"
                            >
                              <CalendarPlus className="w-3 h-3 text-emerald-600" />
                              <span>Schedule</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs font-bold gap-1 text-slate-700 hover:bg-[#f8faf8] border-[#dce6e0] rounded-full whitespace-nowrap cursor-pointer"
                            onClick={() => onTrackOrder(order)}
                            title="Track lifecycle status and milestones"
                          >
                            <Activity className="w-3 h-3 text-emerald-600" />
                            <span>Track</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs font-bold gap-1 text-slate-700 hover:bg-[#f8faf8] border-[#dce6e0] rounded-full whitespace-nowrap cursor-pointer"
                            onClick={() => onSyncMwl(order.id)}
                            title="Synchronize Order to DICOM Modality Worklist (MWL)"
                          >
                            {syncedMwlId === order.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Synced</span>
                              </>
                            ) : (
                              <>
                                <Radio className="w-3 h-3 text-slate-400" />
                                <span>MWL</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Advanced Filters Modal */}
      <MoreFiltersModal
        open={moreFiltersOpen}
        onOpenChange={setMoreFiltersOpen}
        filters={moreFilters}
        onApply={(updated) => setMoreFilters(updated)}
        onReset={() =>
          setMoreFilters({
            referringDoctor: '',
            bodyPart: 'ALL',
            contrastRequirement: 'ALL',
            authorizationStatus: 'ALL',
          })
        }
      />
    </div>
  );
}
