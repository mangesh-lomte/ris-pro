import React, { useState } from 'react';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { PmChecklistTemplateRecord } from '../../services/maintenanceService';

interface PmTemplatesTabProps {
  templates: PmChecklistTemplateRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export const PmTemplatesTab: React.FC<PmTemplatesTabProps> = ({
  templates,
  loading,
  onRefresh,
}) => {
  const [modalityFilter, setModalityFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const modalities = [
    { key: 'ALL', label: 'All Modalities' },
    { key: 'CT', label: 'Computed Tomography (CT)' },
    { key: 'MRI', label: 'Magnetic Resonance (MRI)' },
    { key: 'XRAY', label: 'Digital X-Ray' },
    { key: 'ULTRASOUND', label: 'Ultrasound' },
    { key: 'INJECTOR', label: 'Contrast Injectors' },
    { key: 'CHILLER', label: 'Helium Chillers' },
    { key: 'UPS', label: 'Medical Online UPS' },
  ];

  const filtered = templates.filter((t) => {
    const matchesModality = modalityFilter === 'ALL' || t.modality === modalityFilter;
    const matchesSearch =
      !search ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.oemManufacturer && t.oemManufacturer.toLowerCase().includes(search.toLowerCase()));
    return matchesModality && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls & Modality Rail */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search checklist code, title, OEM..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              />
            </div>

            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Checklists
            </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-600" />
            <span>OEM Engineering Specifications & AERB Radiation Safety Standards</span>
          </div>
        </div>

        {/* Modality Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {modalities.map((m) => (
            <button
              key={m.key}
              onClick={() => setModalityFilter(m.key)}
              className={`px-3 py-1 rounded-full font-semibold shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                modalityFilter === m.key
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-xs">Loading modality-specific PM checklists...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 text-xs">No checklists found for this modality.</div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-sky-400 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    {t.code}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {t.frequency}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">{t.title}</h3>
                <div className="text-xs text-slate-500 mb-3">
                  <span>Modality: <strong className="text-slate-800">{t.modality}</strong></span>
                  {t.oemManufacturer && <span> • OEM: <strong className="text-slate-800">{t.oemManufacturer}</strong></span>}
                  <span> • v{t.version}</span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Inspection Sections ({t.sections?.length || 0})</span>
                  </div>
                  <div className="space-y-1.5">
                    {t.sections?.slice(0, 3).map((sec: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <div className="font-semibold text-slate-900">{sec.title || sec.category}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {sec.items ? `${sec.items.length} verification steps` : 'Inspection criteria'}
                        </div>
                      </div>
                    ))}
                    {(t.sections?.length || 0) > 3 && (
                      <div className="text-xs text-sky-700 font-bold">
                        + {(t.sections?.length || 0) - 3} additional inspection sections
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Protocol
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Modality Standard</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
