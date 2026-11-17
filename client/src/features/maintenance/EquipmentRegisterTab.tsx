import React, { useState } from 'react';
import {
  CheckCircle2,
  Activity,
  Wrench,
  Clock,
  AlertOctagon,
  HelpCircle,
  Search,
  Plus,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { EquipmentRecord } from '../../services/maintenanceService';

interface EquipmentRegisterTabProps {
  equipment: EquipmentRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onSelectEquipment: (eq: EquipmentRecord) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export const EquipmentRegisterTab: React.FC<EquipmentRegisterTabProps> = ({
  equipment,
  loading,
  onRefresh,
  onOpenCreateModal,
  onSelectEquipment,
  onUpdateStatus,
}) => {
  const [search, setSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = equipment.filter((eq) => {
    const matchesSearch =
      !search ||
      eq.name.toLowerCase().includes(search.toLowerCase()) ||
      eq.assetTag.toLowerCase().includes(search.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      eq.manufacturer.toLowerCase().includes(search.toLowerCase());
    const matchesModality = modalityFilter === 'ALL' || eq.modality === modalityFilter;
    const matchesStatus = statusFilter === 'ALL' || eq.status === statusFilter;
    return matchesSearch && matchesModality && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Available / Ready</span>
          </span>
        );
      case 'BUSY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Activity className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>In Scan / Acquisition</span>
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Maintenance</span>
          </span>
        );
      case 'UNDER_PM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-indigo-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span>Under PM Protocol</span>
          </span>
        );
      case 'OUT_OF_SERVICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Out of Service / Offline</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const operationalCount = equipment.filter((e) => e.status === 'OPERATIONAL' || e.status === 'AVAILABLE').length;
  const inScanCount = equipment.filter((e) => e.status === 'BUSY').length;
  const maintenanceCount = equipment.filter((e) => e.status === 'MAINTENANCE' || e.status === 'UNDER_PM').length;
  const downCount = equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length;

  return (
    <div className="space-y-4">
      {/* Top Equipment Status Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fleet Available</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{operationalCount}</p>
            <p className="text-[10px] text-emerald-700 font-medium">Ready for intake</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In Scan / Busy</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{inScanCount}</p>
            <p className="text-[10px] text-sky-700 font-medium">Active acquisition</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Maintenance / PM</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{maintenanceCount}</p>
            <p className="text-[10px] text-amber-700 font-medium">Under calibration</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fleet Down / Offline</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{downCount}</p>
            <p className="text-[10px] text-rose-700 font-medium">Out of service</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search asset tag, model, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Modalities</option>
            <option value="CT">Computed Tomography (CT)</option>
            <option value="MRI">Magnetic Resonance (MRI)</option>
            <option value="XRAY">Digital Radiography (X-Ray)</option>
            <option value="ULTRASOUND">Ultrasound</option>
            <option value="MAMMOGRAPHY">Mammography</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Fleet Statuses</option>
            <option value="OPERATIONAL">Operational / Available</option>
            <option value="BUSY">In Scan</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="UNDER_PM">Under PM</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-3.5 py-1.5 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Register Equipment Asset</span>
        </button>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading equipment asset register...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No equipment assets found matching the specified filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Asset Tag & Serial</th>
                  <th className="py-3 px-3.5">Equipment Name</th>
                  <th className="py-3 px-3.5">Modality & Category</th>
                  <th className="py-3 px-3.5">Manufacturer & Model</th>
                  <th className="py-3 px-3.5">Facility Location</th>
                  <th className="py-3 px-3.5">Machine Availability</th>
                  <th className="py-3 px-3.5">Next PM Due</th>
                  <th className="py-3 px-3.5 text-right">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((eq) => {
                  const nextPm = eq.schedules?.[0]?.nextDueDate
                    ? new Date(eq.schedules[0].nextDueDate).toLocaleDateString()
                    : 'Scheduled in cycle';

                  return (
                    <tr
                      key={eq.id}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      onClick={() => onSelectEquipment(eq)}
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                          {eq.assetTag}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{eq.serialNumber}</div>
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{eq.name}</span>
                        </div>
                        {eq.powerRatingKva && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            Power Rating: {eq.powerRatingKva} kVA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-sky-50 text-sky-800 border border-sky-200">
                          {eq.modality}
                        </span>
                        {eq.assetCategory && eq.assetCategory !== eq.modality && (
                          <span className="ml-1 text-[11px] text-slate-500">/ {eq.assetCategory}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{eq.manufacturer}</div>
                        <div className="text-[11px] text-slate-500">{eq.model}</div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{eq.roomNumber || eq.location}</div>
                        <div className="text-[11px] text-slate-400">{eq.department || 'Radiology Suite'}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">{getStatusBadge(eq.status)}</td>
                      <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{nextPm}</span>
                      </td>
                      <td
                        className="py-3 px-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={eq.status}
                          aria-label={`Change status for ${eq.name}`}
                          onChange={(e) => onUpdateStatus(eq.id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                        >
                          <option value="OPERATIONAL">Operational</option>
                          <option value="AVAILABLE">Available</option>
                          <option value="UNDER_PM">Under PM</option>
                          <option value="MAINTENANCE">Maintenance</option>
                          <option value="OUT_OF_SERVICE">Out of Service</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
