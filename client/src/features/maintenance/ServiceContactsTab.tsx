import React, { useState } from 'react';
import {
  Phone,
  Mail,
  Clock,
  ShieldAlert,
  Search,
  Plus,
  RefreshCw,
  Building2
} from 'lucide-react';
import { ServiceContactRecord } from '../../services/maintenanceService';

interface ServiceContactsTabProps {
  contacts: ServiceContactRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

export const ServiceContactsTab: React.FC<ServiceContactsTabProps> = ({
  contacts,
  loading,
  onRefresh,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [filterEmergencyOnly, setFilterEmergencyOnly] = useState(false);

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase());
    const matchesEmergency = !filterEmergencyOnly || c.isEmergencyContact;
    return matchesSearch && matchesEmergency;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor, specialist, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <input
              type="checkbox"
              checked={filterEmergencyOnly}
              onChange={(e) => setFilterEmergencyOnly(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <span>24x7 Emergency Hotlines Only</span>
          </label>

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
          <span>Add Service Contact / OEM Directory</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-xs">Loading escalation contacts directory...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 text-xs">No service contacts matching search criteria.</div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded shadow-sm border border-slate-200 p-4 hover:border-sky-400 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {c.role}
                  </span>
                  {c.isEmergencyContact && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                      <ShieldAlert className="w-3 h-3 text-rose-600" /> 24x7 HOTLINE
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-0.5">{c.contactPerson}</h3>
                <div className="text-xs font-semibold text-sky-700 mb-3 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>{c.vendorName}</span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-600">Phone:</span>
                    <a href={`tel:${c.phone}`} className="text-sky-700 font-semibold font-mono hover:underline">
                      {c.phone}
                    </a>
                  </div>
                  {c.alternatePhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-semibold text-rose-700">24x7 Alt:</span>
                      <a href={`tel:${c.alternatePhone}`} className="text-rose-700 font-semibold font-mono hover:underline">
                        {c.alternatePhone}
                      </a>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-600">Email:</span>
                      <a href={`mailto:${c.email}`} className="text-sky-700 hover:underline truncate">
                        {c.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-600">Hours:</span>
                    <span>{c.supportHours || 'Standard On-Call Business Hours'}</span>
                  </div>
                </div>

                {c.notes && (
                  <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg text-slate-600 border border-slate-100">
                    {c.notes}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
