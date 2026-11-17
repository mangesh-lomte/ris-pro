import React, { useState } from 'react';
import {
  HardDrive,
  ShieldCheck,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileCode2
} from 'lucide-react';
import { BackupRecord, DrDrillRecord, adminService } from '../../services/adminService';

interface BackupDrTabProps {
  backups: BackupRecord[];
  drDrills: DrDrillRecord[];
  backupTriggering: boolean;
  loading: boolean;
  onTriggerBackup: () => void;
  onVerifyBackup: (id: string) => void;
  onRefresh: () => void;
  onNotify: (msg: string, isErr?: boolean) => void;
}

export const BackupDrTab: React.FC<BackupDrTabProps> = ({
  backups,
  drDrills,
  backupTriggering,
  loading,
  onTriggerBackup,
  onVerifyBackup,
  onRefresh,
  onNotify,
}) => {
  const [isAddDrillOpen, setIsAddDrillOpen] = useState(false);
  const [loggingDrill, setLoggingDrill] = useState(false);

  const [newDrillData, setNewDrillData] = useState({
    drillName: 'Quarterly Cold-Site Database Recovery Drill',
    recoveryTarget: 'Complete Patient Master Index & Reports Restoration',
    simulatedRtoMinutes: 25,
    simulatedRpoMinutes: 10,
    findings: 'All database tables restored cleanly without transaction log truncation.',
  });

  const handleRecordDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoggingDrill(true);
      await adminService.recordDrDrill({
        ...newDrillData,
        status: 'SUCCESS',
      });
      onNotify('Disaster recovery drill simulation recorded.');
      setIsAddDrillOpen(false);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to log drill', true);
    } finally {
      setLoggingDrill(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Database Backup & Disaster Recovery Catalog</h2>
            <p className="text-xs text-slate-500">
              Point-in-time PostgreSQL database snapshots with SHA-256 cryptographic verification.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsAddDrillOpen(true)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Log DR Drill
          </button>
          <button
            onClick={onTriggerBackup}
            disabled={backupTriggering}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded shadow-sm disabled:opacity-50 transition-colors"
          >
            <HardDrive className={`w-3.5 h-3.5 mr-1.5 ${backupTriggering ? 'animate-spin' : ''}`} />
            {backupTriggering ? 'Creating Snapshot...' : 'Trigger Database Backup'}
          </button>
        </div>
      </div>

      {/* 1. Backup History Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#2563EB]" />
            <span>Database Backup Snapshots Ledger</span>
          </div>
          <span className="text-slate-500 font-mono">Total: {backups.length} snapshots</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Filename</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Started Timestamp</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Status</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Size / Records</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">SHA-256 Checksum</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold text-slate-700">Integrity Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No database snapshots recorded yet.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-blue-700 truncate max-w-xs">
                      {b.filename}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(b.startedAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {Math.round((b.sizeBytes || 0) / 1024)} KB ({b.recordCount} records)
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 truncate max-w-xs" title={b.checksumSha256 || ''}>
                      {b.checksumSha256 ? `${b.checksumSha256.slice(0, 16)}...` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        onClick={() => onVerifyBackup(b.id)}
                        className="inline-flex items-center px-2 py-1 text-xs font-semibold text-blue-700 hover:text-indigo-900 bg-blue-50 hover:bg-indigo-100 border border-blue-200 rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1 text-[#2563EB]" />
                        Verify Checksum
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. DR Simulation Drills Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Disaster Recovery Simulation Drills</span>
          </div>
          <span className="text-slate-500">Scheduled drills & compliance audits</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Drill Name</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Execution Date</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Recovery Target</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Status</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">RTO / RPO Metrics</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Conducted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {drDrills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No disaster recovery drills recorded.
                  </td>
                </tr>
              ) : (
                drDrills.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{d.drillName}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {d.drillDate || (d as any).executedAt
                        ? new Date(d.drillDate || (d as any).executedAt).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{d.recoveryTarget}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      RTO: <strong className="text-slate-900">{d.simulatedRtoMinutes}m</strong> | RPO:{' '}
                      <strong className="text-slate-900">{d.simulatedRpoMinutes}m</strong>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{d.conductedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log DR Drill Modal */}
      {isAddDrillOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Log Disaster Recovery Simulation Drill
            </h3>
            <form onSubmit={handleRecordDrill} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Drill Name</label>
                <input
                  type="text"
                  required
                  value={newDrillData.drillName}
                  onChange={(e) => setNewDrillData({ ...newDrillData, drillName: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recovery Target</label>
                <input
                  type="text"
                  required
                  value={newDrillData.recoveryTarget}
                  onChange={(e) => setNewDrillData({ ...newDrillData, recoveryTarget: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Achieved RTO (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newDrillData.simulatedRtoMinutes}
                    onChange={(e) =>
                      setNewDrillData({ ...newDrillData, simulatedRtoMinutes: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Achieved RPO (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newDrillData.simulatedRpoMinutes}
                    onChange={(e) =>
                      setNewDrillData({ ...newDrillData, simulatedRpoMinutes: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Findings / Post-Drill Observations</label>
                <textarea
                  rows={3}
                  required
                  value={newDrillData.findings}
                  onChange={(e) => setNewDrillData({ ...newDrillData, findings: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddDrillOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingDrill}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {loggingDrill ? 'Saving Drill...' : 'Log DR Drill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
