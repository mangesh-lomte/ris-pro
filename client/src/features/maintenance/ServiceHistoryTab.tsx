import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Clock,
  AlertTriangle,
  FileCheck2,
  Package,
  CheckCircle2,
  History,
  Search,
  Filter
} from 'lucide-react';
import { EquipmentRecord, maintenanceService } from '../../services/maintenanceService';
import { formatINR } from '../../utils/formatters';

interface ServiceHistoryTabProps {
  equipment: EquipmentRecord[];
  loading: boolean;
  onRefresh: () => void;
}

type EventFilterType = 'ALL' | 'PM' | 'TICKET' | 'PART' | 'CERT' | 'DOWNTIME' | 'RECORD';

interface UnifiedHistoryEvent {
  id: string;
  type: 'PM' | 'TICKET' | 'PART' | 'CERT' | 'DOWNTIME' | 'RECORD';
  date: string;
  title: string;
  description: string;
  status: string;
  performer?: string;
  cost?: number | null;
  reference?: string;
}

export const ServiceHistoryTab: React.FC<ServiceHistoryTabProps> = ({
  equipment,
  loading: parentLoading,
  onRefresh,
}) => {
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRecord | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [eventFilter, setEventFilter] = useState<EventFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Default to first equipment if not selected
  useEffect(() => {
    if (!selectedEquipmentId && equipment.length > 0) {
      setSelectedEquipmentId(equipment[0].id);
      setSelectedEquipment(equipment[0]);
    }
  }, [equipment, selectedEquipmentId]);

  const fetchHistory = useCallback(async (eqId: string) => {
    if (!eqId) return;
    setLoadingHistory(true);
    try {
      const res = await maintenanceService.getServiceHistory(eqId);
      if (res.success && res.data) {
        setHistoryData(res.data);
      }
    } catch (err) {
      console.error('Failed to load equipment service history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEquipmentId) {
      const eq = equipment.find((e) => e.id === selectedEquipmentId) || null;
      setSelectedEquipment(eq);
      fetchHistory(selectedEquipmentId);
    }
  }, [selectedEquipmentId, equipment, fetchHistory]);

  // Flatten and unify chronological events
  const unifiedEvents: UnifiedHistoryEvent[] = React.useMemo(() => {
    if (!historyData) return [];
    const list: UnifiedHistoryEvent[] = [];

    // 1. Service Records
    (historyData.serviceRecords || []).forEach((r: any) => {
      list.push({
        id: `sr-${r.id}`,
        type: 'RECORD',
        date: r.serviceDate || r.createdAt,
        title: `Service Record: ${r.serviceType || 'Maintenance'}`,
        description: r.workDescription || 'Routine biomedical service performed',
        status: r.statusAfter || 'COMPLETED',
        performer: r.engineerName || r.serviceProvider,
        cost: r.cost,
        reference: r.recordNumber,
      });
    });

    // 2. Completed PMs
    (historyData.pmSchedules || []).forEach((pm: any) => {
      list.push({
        id: `pm-${pm.id}`,
        type: 'PM',
        date: pm.completedAt || pm.dueDate,
        title: `Preventive Maintenance: ${pm.pmType || pm.frequency}`,
        description: pm.completionNotes || pm.findings || 'Preventive maintenance protocol verified',
        status: pm.status,
        performer: pm.completedByName || pm.assignedEngineer || 'Field Service Team',
        cost: pm.cost,
        reference: pm.scheduleNumber,
      });
    });

    // 3. Service Tickets / Breakdowns
    (historyData.serviceTickets || []).forEach((t: any) => {
      list.push({
        id: `tkt-${t.id}`,
        type: 'TICKET',
        date: t.openedAt,
        title: `Breakdown Ticket: ${t.title}`,
        description: t.description + (t.resolutionNotes ? ` (Resolution: ${t.resolutionNotes})` : ''),
        status: t.status,
        performer: t.assignedEngineer || t.reportedByName,
        reference: t.ticketNumber,
      });
    });

    // 4. Spare Parts Usage
    (historyData.partsUsages || []).forEach((pu: any) => {
      list.push({
        id: `part-${pu.id}`,
        type: 'PART',
        date: pu.installedAt,
        title: `Part Replaced: ${pu.inventoryItem?.name || 'Spare Part'} (${pu.quantityUsed} units)`,
        description: `Installed at ${pu.location}. Reason: ${pu.reason || 'Component replacement'}`,
        status: 'INSTALLED',
        performer: pu.installedByName,
        cost: pu.totalCost,
        reference: pu.inventoryItem?.itemCode,
      });
    });

    // 5. Calibration / QA Certificates
    (historyData.certificates || []).forEach((c: any) => {
      list.push({
        id: `cert-${c.id}`,
        type: 'CERT',
        date: c.issueDate,
        title: `QA Certificate: ${c.certificationType}`,
        description: `Authority: ${c.issuingAuthority}. Valid until: ${new Date(c.expiryDate).toLocaleDateString()}`,
        status: c.status,
        performer: c.certifiedByName,
        reference: c.certificateNumber,
      });
    });

    // 6. Downtimes
    (historyData.downtimes || []).forEach((d: any) => {
      list.push({
        id: `dwn-${d.id}`,
        type: 'DOWNTIME',
        date: d.startTime,
        title: `Downtime Outage: ${d.cause}`,
        description: `Category: ${d.causeCategory}. Impact: ${d.impactLevel}. ${d.durationMinutes ? `Duration: ${Math.floor(d.durationMinutes / 60)}h ${d.durationMinutes % 60}m` : 'Ongoing outage'}`,
        status: d.endTime ? 'RESTORED' : 'ACTIVE_OUTAGE',
        performer: d.recordedByName,
        reference: d.downtimeNumber,
      });
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [historyData]);

  const filteredEvents = unifiedEvents.filter((ev) => {
    const matchesType = eventFilter === 'ALL' || ev.type === eventFilter;
    const matchesSearch =
      !searchQuery ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.reference && ev.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ev.performer && ev.performer.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getEventBadge = (type: UnifiedHistoryEvent['type']) => {
    switch (type) {
      case 'PM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PM Completed
          </span>
        );
      case 'TICKET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Breakdown Ticket
          </span>
        );
      case 'PART':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Package className="w-3 h-3 text-[#2563EB]" /> Part Replaced
          </span>
        );
      case 'CERT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <FileCheck2 className="w-3 h-3 text-sky-600" /> QA Certificate
          </span>
        );
      case 'DOWNTIME':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Clock className="w-3 h-3 text-rose-600" /> Outage Event
          </span>
        );
      case 'RECORD':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Wrench className="w-3 h-3 text-slate-600" /> Service Report
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Equipment Selector */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <History className="w-4 h-4 text-sky-600" />
            <span>Select Equipment Asset:</span>
          </label>
          <select
            value={selectedEquipmentId}
            onChange={(e) => setSelectedEquipmentId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 max-w-xs"
          >
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.assetTag} • {eq.modality})
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              fetchHistory(selectedEquipmentId);
              onRefresh();
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Refresh History
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search events, reference, engineer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Equipment Context Banner */}
      {selectedEquipment && (
        <div className="bg-sky-50/70 border border-sky-200/80 rounded p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">{selectedEquipment.name}</span>
              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900">
                {selectedEquipment.assetTag}
              </span>
              <span className="font-semibold text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                {selectedEquipment.modality}
              </span>
            </div>
            <div className="text-slate-600">
              <span>{selectedEquipment.manufacturer} {selectedEquipment.model}</span>
              <span className="mx-2">•</span>
              <span>Serial: <strong className="font-mono text-slate-800">{selectedEquipment.serialNumber}</strong></span>
              <span className="mx-2">•</span>
              <span>Location: <strong>{selectedEquipment.roomNumber || selectedEquipment.location}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Lifecycle Events Logged</div>
              <div className="font-bold text-sm text-slate-900">{unifiedEvents.length} records</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400" /> Filter:
        </span>
        {[
          { key: 'ALL', label: 'All Lifecycle Events' },
          { key: 'PM', label: 'Preventive Maintenance' },
          { key: 'TICKET', label: 'Breakdowns & Repairs' },
          { key: 'PART', label: 'Spare Parts Replaced' },
          { key: 'CERT', label: 'QA / Calibration' },
          { key: 'DOWNTIME', label: 'Downtime Outages' },
          { key: 'RECORD', label: 'Service Reports' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setEventFilter(tab.key as EventFilterType)}
            className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              eventFilter === tab.key
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chronological Timeline / Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
        {loadingHistory || parentLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading comprehensive service history...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No service history events match the selected criteria for this equipment asset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Event Date</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Reference #</th>
                  <th className="p-3.5">Event Title & Details</th>
                  <th className="p-3.5">Engineer / Performer</th>
                  <th className="p-3.5 text-right">Cost (INR)</th>
                  <th className="p-3.5 text-center">Lifecycle Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 whitespace-nowrap text-slate-700">
                      <div className="font-semibold text-slate-900">{new Date(ev.date).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">{getEventBadge(ev.type)}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {ev.reference || '—'}
                    </td>
                    <td className="p-3.5 max-w-md">
                      <div className="font-semibold text-slate-900">{ev.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">{ev.description}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 whitespace-nowrap font-medium">
                      {ev.performer || '—'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {ev.cost != null ? formatINR(ev.cost) : '—'}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {ev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
