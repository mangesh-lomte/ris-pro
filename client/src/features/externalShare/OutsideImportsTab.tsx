import React, { useState } from 'react';
import { OutsideStudyImportRecord } from '../../services/externalShareService';
import { ArrowDownLeft, CheckCircle2, AlertCircle, Link, XCircle } from 'lucide-react';

interface OutsideImportsTabProps {
  imports: OutsideStudyImportRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenReceiveModal: () => void;
  onOpenReconcileModal: (record: OutsideStudyImportRecord) => void;
}

export const OutsideImportsTab: React.FC<OutsideImportsTabProps> = ({
  imports,
  loading,
  onRefresh,
  onOpenReceiveModal,
  onOpenReconcileModal,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = imports.filter((imp) => {
    const matchesSearch =
      !search ||
      imp.importNumber.toLowerCase().includes(search.toLowerCase()) ||
      imp.patientName.toLowerCase().includes(search.toLowerCase()) ||
      (imp.patientIdOutside && imp.patientIdOutside.toLowerCase().includes(search.toLowerCase())) ||
      imp.sourceFacility.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || imp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECONCILED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Reconciled
          </span>
        );
      case 'MATCHED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <Link className="w-3 h-3 text-sky-600" /> Patient Matched
          </span>
        );
      case 'RECEIVED':
      case 'UNMATCHED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Unmatched Intake
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-xs text-gray-700 bg-gray-100">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search import #, patient name, source facility..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Intake Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="MATCHED">Patient Matched</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="RECONCILED">Reconciled to RIS</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Refresh
          </button>
          <button
            onClick={onOpenReceiveModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Intake Outside DICOM
          </button>
        </div>
      </div>

      {/* Imports Table */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Import #</th>
                <th className="px-4 py-3">Outside Patient</th>
                <th className="px-4 py-3">Modality / Exam</th>
                <th className="px-4 py-3">Source Facility</th>
                <th className="px-4 py-3">DICOM Payload</th>
                <th className="px-4 py-3">Matched Patient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Loading outside DICOM intake records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No outside study imports match criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50/75 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-gray-900">{imp.importNumber}</div>
                      <div className="text-[11px] text-gray-400">{new Date(imp.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{imp.patientName}</div>
                      {imp.patientIdOutside && (
                        <div className="font-mono text-[11px] text-gray-500">Ext ID: {imp.patientIdOutside}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {imp.modality}
                        </span>
                        <span className="text-xs text-gray-800 font-medium">
                          {imp.studyDescription || 'Imported DICOM Exam'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 font-mono truncate max-w-[200px]" title={imp.studyInstanceUid}>
                        UID: {imp.studyInstanceUid}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{imp.sourceFacility}</div>
                      {imp.studyDate && (
                        <div className="text-[11px] text-gray-400">Study Date: {imp.studyDate}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-gray-700 font-medium">
                        {imp.seriesCount || 1} Series, {imp.instancesCount || 1} Images
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {imp.matchedPatient ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {imp.matchedPatient.firstName} {imp.matchedPatient.lastName}
                          </div>
                          <div className="font-mono text-[11px] text-emerald-700 font-semibold">
                            {imp.matchedPatient.patientId}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No exact demographic match</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(imp.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {imp.status !== 'RECONCILED' && imp.status !== 'REJECTED' && (
                        <button
                          onClick={() => onOpenReconcileModal(imp)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition"
                        >
                          Reconcile
                        </button>
                      )}
                      {imp.status === 'RECONCILED' && imp.reconciledOrder && (
                        <div className="font-mono text-[11px] text-emerald-800 font-semibold">
                          RIS: {imp.reconciledOrder.accessionNumber}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
