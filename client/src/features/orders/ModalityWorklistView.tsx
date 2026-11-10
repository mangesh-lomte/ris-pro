import * as React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ModalityType, ImagingOrder } from '../../types';
import {
  Search,
  Radio,
  Check,
  ShieldCheck,
  Layers,
  Sparkles,
  Droplet,
  RotateCcw,
  Clock,
  MapPin,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModalityWorklistViewProps {
  orders: ImagingOrder[];
  isLoading: boolean;
  onSyncMwl: (orderId: string) => void;
  syncedMwlId: string | null;
}

export function ModalityWorklistView({
  orders,
  isLoading,
  onSyncMwl,
  syncedMwlId,
}: ModalityWorklistViewProps) {
  // Query Bar Controls
  const [querySearch, setQuerySearch] = React.useState('');
  const [queryModality, setQueryModality] = React.useState<ModalityType | 'ALL'>('ALL');
  const [queryDate, setQueryDate] = React.useState<'ALL' | 'TODAY' | 'TOMORROW' | 'UPCOMING'>('ALL');
  const [queryStation, setQueryStation] = React.useState<string>('ALL');
  const [queryStatus, setQueryStatus] = React.useState<string>('ALL');

  // Selected Order for Unambiguous Patient Safety Target Panel (Section 10)
  const [selectedOrder, setSelectedOrder] = React.useState<ImagingOrder | null>(null);

  // Extract unique stations/rooms from orders appointments
  const availableStations = React.useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.appointment?.location) {
        set.add(o.appointment.location);
      }
    });
    return Array.from(set);
  }, [orders]);

  // Filter orders according to MWL Query parameters
  const mwlOrders = React.useMemo(() => {
    return orders.filter((o) => {
      // Modality filter
      if (queryModality !== 'ALL' && o.modality !== queryModality) {
        return false;
      }
      // Station filter
      if (queryStation !== 'ALL') {
        if (!o.appointment?.location || !o.appointment.location.includes(queryStation)) {
          return false;
        }
      }
      // Status filter
      if (queryStatus !== 'ALL') {
        if (o.orderStatus !== queryStatus) {
          return false;
        }
      }
      // Date filter
      if (queryDate !== 'ALL' && o.appointment?.scheduledStart) {
        const sched = new Date(o.appointment.scheduledStart);
        const today = new Date();
        const isToday =
          sched.getDate() === today.getDate() &&
          sched.getMonth() === today.getMonth() &&
          sched.getFullYear() === today.getFullYear();

        if (queryDate === 'TODAY' && !isToday) return false;
      }
      // Search term
      if (querySearch.trim() !== '') {
        const term = querySearch.toLowerCase();
        const pName = `${o.patient?.firstName || ''} ${o.patient?.lastName || ''}`.toLowerCase();
        const mrn = (o.patient?.patientId || '').toLowerCase();
        const acc = o.accessionNumber.toLowerCase();
        const exam = o.examinationName.toLowerCase();
        if (!pName.includes(term) && !mrn.includes(term) && !acc.includes(term) && !exam.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, queryModality, queryDate, queryStation, queryStatus, querySearch]);

  // Set default selected order when data loads or selection clears
  React.useEffect(() => {
    if (mwlOrders.length > 0 && (!selectedOrder || !mwlOrders.some((o) => o.id === selectedOrder.id))) {
      setSelectedOrder(mwlOrders[0]);
    }
  }, [mwlOrders, selectedOrder]);

  const handleResetQuery = () => {
    setQuerySearch('');
    setQueryModality('ALL');
    setQueryDate('ALL');
    setQueryStation('ALL');
    setQueryStatus('ALL');
  };

  return (
    <div className="space-y-4">
      {/* 1. MWL VIEW HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#152B42] tracking-tight">
              Modality Worklist (MWL)
            </h2>
            <span className="rounded bg-[#174A70]/10 px-2 py-0.5 text-[10px] font-bold text-[#174A70] border border-[#174A70]/20">
              DICOM C-FIND Compatible
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Scheduled examinations ready for acquisition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/technologist"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#174A70] text-white hover:bg-[#123855] shadow-2xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Open Acquisition Console</span>
          </Link>
        </div>
      </div>

      {/* 2. MWL QUERY CONTROLS (Section 9) */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Query Search */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patient / MRN / accession..."
              value={querySearch}
              onChange={(e) => setQuerySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Modality Query Dropdown */}
          <select
            aria-label="Query by Modality"
            value={queryModality}
            onChange={(e) => setQueryModality(e.target.value as ModalityType | 'ALL')}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
          >
            <option value="ALL">Modality: All</option>
            <option value="MRI">MRI</option>
            <option value="CT">CT</option>
            <option value="XRAY">X-Ray (XR)</option>
            <option value="ULTRASOUND">Ultrasound (US)</option>
            <option value="MAMMOGRAPHY">Mammography (MG)</option>
          </select>

          {/* Date Query Dropdown */}
          <select
            aria-label="Query by Date"
            value={queryDate}
            onChange={(e) => setQueryDate(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
          >
            <option value="ALL">Schedule Date: All</option>
            <option value="TODAY">Today's Queue</option>
            <option value="TOMORROW">Tomorrow</option>
            <option value="UPCOMING">Upcoming Days</option>
          </select>

          {/* Station / Room Query Dropdown */}
          <select
            aria-label="Query by Station"
            value={queryStation}
            onChange={(e) => setQueryStation(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
          >
            <option value="ALL">Station / Room: All</option>
            {availableStations.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
            {availableStations.length === 0 && (
              <>
                <option value="MRI Suite 1">MRI Suite 1</option>
                <option value="CT Scanner 1">CT Scanner 1</option>
                <option value="X-Ray Room A">X-Ray Room A</option>
                <option value="Ultrasound 1">Ultrasound 1</option>
              </>
            )}
          </select>

          {/* Status Query Dropdown */}
          <select
            aria-label="Query by Status"
            value={queryStatus}
            onChange={(e) => setQueryStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 cursor-pointer"
          >
            <option value="ALL">Acquisition Status: All</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="READY_FOR_TECH">Ready for Tech</option>
            <option value="READY_FOR_SCAN">Ready for Scan</option>
            <option value="SCAN_IN_PROGRESS">Scan in Progress</option>
            <option value="SCAN_COMPLETED">Scan Completed</option>
          </select>

          {/* Reset Query Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetQuery}
            className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 gap-1 rounded-md cursor-pointer"
            title="Reset query fields"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* 3. MWL PATIENT SAFETY TARGET PANEL (Section 10) */}
      {selectedOrder ? (
        <div
          data-testid="mwl-patient-safety-panel"
          className="rounded-lg border-2 border-[#174A70]/30 bg-gradient-to-r from-[#174A70]/5 to-transparent p-4 shadow-xs"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#174A70] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#174A70]/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Worklist Target & Patient Safety
                </span>
                <PriorityBadge priority={selectedOrder.priority} />
                <Badge variant="cyan" className="font-bold text-[10px]">
                  {selectedOrder.modality}
                </Badge>
              </div>

              {/* Patient Name - Prominent & Unambiguous */}
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-extrabold text-[#152B42]">
                  {selectedOrder.patient
                    ? `${selectedOrder.patient.lastName.toUpperCase()}, ${selectedOrder.patient.firstName}`
                    : 'UNKNOWN PATIENT'}
                </span>
                <span className="text-xs text-slate-500">
                  (MRN: <strong className="text-slate-800">{selectedOrder.patient?.patientId || 'N/A'}</strong>)
                </span>
                <span className="text-xs text-slate-500">
                  Accession: <strong className="text-[#174A70] font-mono">{selectedOrder.accessionNumber}</strong>
                </span>
              </div>

              {/* Procedure & Station Info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Procedure:</strong> {selectedOrder.examinationName} ({selectedOrder.bodyPart})
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Scheduled:</strong>{' '}
                  {selectedOrder.appointment?.scheduledStart
                    ? new Date(selectedOrder.appointment.scheduledStart).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Immediate / Unscheduled'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Station:</strong> {selectedOrder.appointment?.location || 'Assigned Scanner Suite'}
                </span>
                {selectedOrder.contrastRequirement && selectedOrder.contrastRequirement !== 'NONE' && (
                  <span className="flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                    <Droplet className="w-3 h-3 fill-indigo-500" />
                    Contrast: {selectedOrder.contrastRequirement}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Buttons for Target Entry */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSyncMwl(selectedOrder.id)}
                className="text-xs gap-1.5 border-slate-300 rounded-md cursor-pointer whitespace-nowrap"
              >
                {syncedMwlId === selectedOrder.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Synced to DICOM MWL</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5 text-[#174A70]" />
                    <span>Sync to DICOM MWL</span>
                  </>
                )}
              </Button>

              <Link
                to="/technologist"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#174A70] text-white hover:bg-[#123855] shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Begin Scan</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. MWL ACQUISITION TABLE (Section 8) */}
      <div className="rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="font-semibold text-[#152B42]">
            DICOM Worklist Queue ({mwlOrders.length} {mwlOrders.length === 1 ? 'item' : 'items'})
          </div>
          <span className="text-[11px] text-slate-400">
            Click row to inspect patient safety parameters
          </span>
        </div>

        <div className="table-scroll-container thin-scroll w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#174A70] border-t-transparent" />
            </div>
          ) : mwlOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <p className="font-semibold text-slate-700">No scheduled modality examinations found in current queue.</p>
              <p className="text-[11px] text-slate-400 mt-1">Adjust query parameters or sync orders to worklist.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[150px]">Patient & MRN</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Accession Number</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[170px]">Procedure & Region</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[80px]">Modality</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Scheduled Time</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">Station / Room</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[90px]">Priority</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap min-w-[100px]">Status</TableHead>
                  <TableHead className="py-2.5 px-3 whitespace-nowrap text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mwlOrders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  const schedTime = order.appointment?.scheduledStart
                    ? new Date(order.appointment.scheduledStart).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Immediate Queue';

                  return (
                    <TableRow
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer transition-colors text-xs ${
                        isSelected
                          ? 'bg-[#174A70]/10 border-l-4 border-l-[#174A70] font-medium'
                          : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Patient & MRN */}
                      <TableCell className="py-2.5 px-3">
                        <span className="font-bold text-[#152B42] block">
                          {order.patient ? `${order.patient.lastName}, ${order.patient.firstName}` : 'Unknown Patient'}
                        </span>
                        <div className="mt-0.5">
                          <IdentifierPill type="patient" value={order.patient?.patientId || ''} />
                        </div>
                      </TableCell>

                      {/* Accession Number */}
                      <TableCell className="py-2.5 px-3">
                        <IdentifierPill type="accession" value={order.accessionNumber} />
                      </TableCell>

                      {/* Procedure & Region */}
                      <TableCell className="py-2.5 px-3">
                        <span className="font-medium text-[#152B42] block">{order.examinationName}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{order.bodyPart}</span>
                      </TableCell>

                      {/* Modality */}
                      <TableCell className="py-2.5 px-3">
                        <Badge variant="cyan" className="font-bold text-[10px]">
                          {order.modality}
                        </Badge>
                      </TableCell>

                      {/* Scheduled Time */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-slate-800 font-medium">{schedTime}</span>
                      </TableCell>

                      {/* Station / Room */}
                      <TableCell className="py-2.5 px-3">
                        <span className="text-slate-700">
                          {order.appointment?.location || 'Assigned Suite'}
                        </span>
                      </TableCell>

                      {/* Priority */}
                      <TableCell className="py-2.5 px-3">
                        <PriorityBadge priority={order.priority} />
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5 px-3">
                        <StatusBadge status={order.orderStatus} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 text-slate-700 hover:bg-slate-100 border-slate-300 rounded-md cursor-pointer"
                            onClick={() => onSyncMwl(order.id)}
                            title="Sync Order to DICOM Modality Worklist (MWL)"
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
    </div>
  );
}
