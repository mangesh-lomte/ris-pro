import React, { useState } from 'react';
import {
  Layers,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Clock,
  Droplet
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { formatINR } from '../../utils/formatters';

interface ServiceMastersTabProps {
  examCatalog: any[];
  reportingTemplates: any[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, isErr?: boolean) => void;
}

export const ServiceMastersTab: React.FC<ServiceMastersTabProps> = ({
  examCatalog,
  reportingTemplates,
  loading,
  onRefresh,
  onNotify,
}) => {
  const [examSearch, setExamSearch] = useState('');
  const [examModalityFilter, setExamModalityFilter] = useState('ALL');
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);

  const [templateSearch, setTemplateSearch] = useState('');
  const [templateModalityFilter, setTemplateModalityFilter] = useState('ALL');
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const [newExamData, setNewExamData] = useState({
    code: '',
    name: '',
    modality: 'CT',
    bodyPart: 'HEAD',
    typicalDurationMinutes: 15,
    requiresContrast: false,
    basePrice: 2500,
  });

  const [newTemplateData, setNewTemplateData] = useState({
    modality: 'CT',
    bodyPart: 'CHEST',
    title: 'Standard Non-Contrast Chest CT',
    language: 'en',
    findings: 'Lungs are clear bilaterally without focal consolidation, pneumothorax or pleural effusion. Heart size is within normal limits.',
    impression: 'Normal non-contrast chest CT examination.',
  });

  const filteredExams = examCatalog.filter((ex) => {
    const q = examSearch.toLowerCase();
    const matchesSearch =
      !examSearch ||
      ex.name.toLowerCase().includes(q) ||
      ex.code.toLowerCase().includes(q);
    const matchesModality =
      examModalityFilter === 'ALL' || ex.modality === examModalityFilter;
    return matchesSearch && matchesModality;
  });

  const filteredTemplates = reportingTemplates.filter((tmpl) => {
    const q = templateSearch.toLowerCase();
    const matchesSearch =
      !templateSearch ||
      tmpl.title.toLowerCase().includes(q) ||
      tmpl.bodyPart.toLowerCase().includes(q);
    const matchesModality =
      templateModalityFilter === 'ALL' || tmpl.modality === templateModalityFilter;
    return matchesSearch && matchesModality;
  });

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamData.code.trim() || !newExamData.name.trim()) {
      onNotify('Please enter service code and examination name.', true);
      return;
    }

    try {
      setCreatingExam(true);
      await adminService.createExamDefinition({
        ...newExamData,
        code: newExamData.code.trim().toUpperCase(),
        name: newExamData.name.trim(),
        basePrice: Number(newExamData.basePrice) || 0,
      });
      onNotify(`Service definition ${newExamData.code} created.`);
      setIsAddExamOpen(false);
      setNewExamData({
        code: '',
        name: '',
        modality: 'CT',
        bodyPart: 'HEAD',
        typicalDurationMinutes: 15,
        requiresContrast: false,
        basePrice: 2500,
      });
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to create service', true);
    } finally {
      setCreatingExam(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateData.title.trim() || !newTemplateData.findings.trim() || !newTemplateData.impression.trim()) {
      onNotify('Please fill in title, findings, and impression.', true);
      return;
    }

    try {
      setCreatingTemplate(true);
      await adminService.createReportingTemplate({
        ...newTemplateData,
        title: newTemplateData.title.trim(),
      });
      onNotify(`Reporting template '${newTemplateData.title}' saved.`);
      setIsAddTemplateOpen(false);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to create template', true);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const getModalityBadge = (modality: string) => {
    switch (modality) {
      case 'CT':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">CT</span>;
      case 'MRI':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">MRI</span>;
      case 'XRAY':
      case 'XR':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">X-Ray</span>;
      case 'US':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">US</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{modality}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Examination Service Catalog */}
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Examination Service Catalog</h2>
              <p className="text-xs text-slate-500">Standardized modality master data & diagnostic pricing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsAddExamOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Service Definition
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by code or service name..."
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {['ALL', 'CT', 'MRI', 'XRAY', 'US'].map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setExamModalityFilter(mod)}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                  examModalityFilter === mod
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* Exam Table */}
        <div className="overflow-x-auto max-h-[360px] border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Service Code</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Examination Name</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Modality</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Typical Duration</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Contrast Protocol</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold text-slate-700">Base Price (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No examination services found.
                  </td>
                </tr>
              ) : (
                filteredExams.map((ex) => (
                  <tr key={ex.id || ex.code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-700 bg-blue-50/50">
                      {ex.code}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{ex.name}</td>
                    <td className="px-4 py-2.5">{getModalityBadge(ex.modality)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {ex.typicalDurationMinutes || 15} mins
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {ex.requiresContrast ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Droplet className="w-3 h-3 text-amber-600" />
                          Requires Contrast
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                          Non-Contrast
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                      {formatINR(ex.basePrice ?? 2500)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Radiology Reporting Templates */}
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Radiology Reporting Templates</h2>
              <p className="text-xs text-slate-500">Structured narrative templates for radiologist sign-off</p>
            </div>
          </div>
          <button
            onClick={() => setIsAddTemplateOpen(true)}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Reporting Template
          </button>
        </div>

        {/* Template Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by title or body part..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {['ALL', 'CT', 'MRI', 'XRAY', 'US'].map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setTemplateModalityFilter(mod)}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                  templateModalityFilter === mod
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* Template Table */}
        <div className="overflow-x-auto max-h-[360px] border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Template Title</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Modality</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Body Part</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Language</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Impression Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No reporting templates found.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((tmpl) => (
                  <tr key={tmpl.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{tmpl.title}</td>
                    <td className="px-4 py-2.5">{getModalityBadge(tmpl.modality)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{tmpl.bodyPart}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-bold">
                        {tmpl.language || 'en'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-xs">{tmpl.impression}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Exam Modal */}
      {isAddExamOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              New Examination Service Definition
            </h3>
            <form onSubmit={handleCreateExam} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SRV-CT-CHEST"
                  value={newExamData.code}
                  onChange={(e) => setNewExamData({ ...newExamData, code: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm font-mono uppercase focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Examination Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CT Chest with Intravenous Contrast"
                  value={newExamData.name}
                  onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modality</label>
                  <select
                    value={newExamData.modality}
                    onChange={(e) => setNewExamData({ ...newExamData, modality: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <option value="CT">CT</option>
                    <option value="MRI">MRI</option>
                    <option value="XRAY">X-Ray</option>
                    <option value="US">Ultrasound</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    value={newExamData.typicalDurationMinutes}
                    onChange={(e) => setNewExamData({ ...newExamData, typicalDurationMinutes: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={newExamData.basePrice}
                    onChange={(e) => setNewExamData({ ...newExamData, basePrice: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="modalContrastReq"
                    checked={newExamData.requiresContrast}
                    onChange={(e) => setNewExamData({ ...newExamData, requiresContrast: e.target.checked })}
                    className="rounded border-slate-300 text-[#2563EB] focus:ring-cyan-500"
                  />
                  <label htmlFor="modalContrastReq" className="font-semibold text-slate-700">Requires Contrast</label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddExamOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {creatingExam ? 'Saving...' : 'Save Definition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {isAddTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              New Radiology Reporting Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Template Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Normal Brain MRI"
                  value={newTemplateData.title}
                  onChange={(e) => setNewTemplateData({ ...newTemplateData, title: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modality</label>
                  <select
                    value={newTemplateData.modality}
                    onChange={(e) => setNewTemplateData({ ...newTemplateData, modality: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <option value="CT">CT</option>
                    <option value="MRI">MRI</option>
                    <option value="XRAY">X-Ray</option>
                    <option value="US">Ultrasound</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Body Part</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHEST"
                    value={newTemplateData.bodyPart}
                    onChange={(e) => setNewTemplateData({ ...newTemplateData, bodyPart: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm uppercase focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Findings Narrative</label>
                <textarea
                  rows={3}
                  required
                  value={newTemplateData.findings}
                  onChange={(e) => setNewTemplateData({ ...newTemplateData, findings: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnostic Impression</label>
                <textarea
                  rows={2}
                  required
                  value={newTemplateData.impression}
                  onChange={(e) => setNewTemplateData({ ...newTemplateData, impression: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddTemplateOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTemplate}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {creatingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
