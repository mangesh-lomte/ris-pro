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
    <div className="space-y-3.5">
      {/* 1. COMPACT ENTERPRISE FILTER BAR */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search accession, patient, MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-800 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
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
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
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
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
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
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
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
              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
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
              className={`h-8 px-2.5 text-xs gap-1.5 border-slate-300 rounded-md ${
                extraFilterCount > 0 ? 'bg-slate-100 font-semibold text-[#174A70] border-[#174A70]/40' : 'text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#174A70]" />
              <span>More Filters</span>
              {extraFilterCount > 0 && (
                <span className="rounded-full bg-[#174A70] text-white text-[10px] px-1.5 py-0 font-bold ml-0.5">
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
                className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 rounded-md"
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
      <div className="rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="font-semibold text-[#152B42]">
            Orders Registry ({filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'})
          </div>
          <span className="text-[11px] text-slate-400">
            {isLoading ? 'Refreshing orders...' : 'Synchronized with PACS and Scheduling'}
          </span>
        </div>

        <div className="table-scroll-container thin-scroll w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#174A70] border-t-transparent" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-14 text-slate-500 text-xs">
              <p className="font-semibold text-slate-700">No imaging orders match the selected criteria.</p>
              <p className="text-[11px] text-slate-400 mt-1">Try modifying the search term or resetting the filters.</p>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAllFilters}
                  className="mt-3 text-xs border-slate-300"
                >
                  Reset All Filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[150px]">Patient / MRN</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">Accession</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[180px]">Exam / Modality</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[90px]">Priority</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">Indication</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Referring Physician</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">Scheduled</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[110px]">Status</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap text-right min-w-[170px]">Actions</TableHead>
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
                    <TableRow key={order.id} className="hover:bg-slate-50/80 transition-colors text-xs">
                      {/* 1. Patient / MRN */}
                      <TableCell className="py-2.5 px-3 align-top">
                        {order.patient ? (
                          <Link
                            to={`/patients/${order.patient.patientId}`}
                            className="font-bold text-[#152B42] hover:text-[#174A70] hover:underline block leading-tight"
                          >
                            {order.patient.lastName}, {order.patient.firstName}
                          </Link>
                        ) : (
                          <span className="font-bold text-[#152B42] leading-tight">Unknown Patient</span>
                        )}
                        <div className="mt-1">
                          <IdentifierPill type="patient" value={order.patient?.patientId || ''} />
                        </div>
                      </TableCell>

                      {/* 2. Accession */}
                      <TableCell className="py-2.5 px-3 align-top">
                        <IdentifierPill type="accession" value={order.accessionNumber} />
                      </TableCell>

                      {/* 3. Exam & Modality */}
                      <TableCell className="py-2.5 px-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="cyan" className="font-bold text-[10px] py-0 px-1.5">
                            {order.modality}
                          </Badge>
                          <span className="font-medium text-[#152B42] text-xs">
                            {order.examinationName}
                          </span>
                          {order.contrastRequirement && order.contrastRequirement !== 'NONE' && (
                            <span
                              title={`Contrast Protocol: ${order.contrastRequirement}`}
                              className="inline-flex items-center text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-semibold"
                            >
                              <Droplet className="w-2.5 h-2.5 mr-0.5 fill-indigo-500" />
                              +{order.contrastRequirement}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{order.bodyPart}</span>
                      </TableCell>

                      {/* 4. Priority */}
                      <TableCell className="py-2.5 px-3 align-top">
                        <PriorityBadge priority={order.priority} />
                      </TableCell>

                      {/* 5. Indication */}
                      <TableCell className="py-2.5 px-3 align-top max-w-[200px]">
                        <p className="text-xs text-slate-600 truncate" title={order.clinicalIndication}>
                          {order.clinicalIndication || '—'}
                        </p>
                      </TableCell>

                      {/* 6. Referring Physician */}
                      <TableCell className="py-2.5 px-3 align-top">
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
                      <TableCell className="py-2.5 px-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {order.orderStatus === 'CREATED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-[#174A70]/30 text-[#174A70] hover:bg-[#174A70]/10 rounded-md whitespace-nowrap cursor-pointer"
                              onClick={() => onScheduleOrder(order)}
                              title="Schedule appointment slot"
                            >
                              <CalendarPlus className="w-3 h-3 text-[#174A70]" />
                              <span>Schedule</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 text-slate-700 hover:bg-slate-100 border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
                            onClick={() => onTrackOrder(order)}
                            title="Track lifecycle status and milestones"
                          >
                            <Activity className="w-3 h-3 text-indigo-600" />
                            <span>Track</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 text-slate-700 hover:bg-slate-100 border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
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
                                <Radio className="w-3 h-3 text-slate-500" />
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
