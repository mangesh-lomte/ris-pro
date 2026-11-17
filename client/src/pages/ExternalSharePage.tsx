import React, { useEffect, useState, useCallback } from 'react';
import {
  externalShareService,
  ExternalShareRecord,
  LargeFileTransferRecord,
  OutsideStudyImportRecord,
  ShareAccessLogRecord,
  CreateSharePayload,
} from '../services/externalShareService';
import { fetchPatients } from '../services/patientService';
import { fetchOrders } from '../services/orderService';
import { ActiveSharesTab } from '../features/externalShare/ActiveSharesTab';
import { TransfersTab } from '../features/externalShare/TransfersTab';
import { OutsideImportsTab } from '../features/externalShare/OutsideImportsTab';
import { AuditLogsTab } from '../features/externalShare/AuditLogsTab';
import { CreateShareModal } from '../features/externalShare/CreateShareModal';
import { InitiateTransferModal } from '../features/externalShare/InitiateTransferModal';
import { ReceiveImportModal } from '../features/externalShare/ReceiveImportModal';
import { ReconcileImportModal } from '../features/externalShare/ReconcileImportModal';
import { Button } from '../components/ui/button';
import { Share2, ArrowUpRight, ArrowDownLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const ExternalSharePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shares' | 'transfers' | 'imports' | 'logs'>('shares');

  const [shares, setShares] = useState<ExternalShareRecord[]>([]);
  const [transfers, setTransfers] = useState<LargeFileTransferRecord[]>([]);
  const [imports, setImports] = useState<OutsideStudyImportRecord[]>([]);
  const [logs, setLogs] = useState<ShareAccessLogRecord[]>([]);
  const [finalizedOrders, setFinalizedOrders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isCreateShareOpen, setIsCreateShareOpen] = useState(false);
  const [isInitiateTransferOpen, setIsInitiateTransferOpen] = useState(false);
  const [isReceiveImportOpen, setIsReceiveImportOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<OutsideStudyImportRecord | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [sharesRes, transfersRes, importsRes, logsRes] = await Promise.all([
        externalShareService.listShares({ limit: 100 }),
        externalShareService.listTransfers({ limit: 100 }),
        externalShareService.listImports({ limit: 100 }),
        externalShareService.listAuditLogs({ limit: 100 }),
      ]);

      setShares(Array.isArray(sharesRes) ? sharesRes : (sharesRes as any)?.items || []);
      setTransfers(Array.isArray(transfersRes) ? transfersRes : (transfersRes as any)?.items || []);
      setImports(Array.isArray(importsRes) ? importsRes : (importsRes as any)?.items || []);
      setLogs(Array.isArray(logsRes) ? logsRes : (logsRes as any)?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load external sharing information.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [ordersRes, patientsRes] = await Promise.all([
        fetchOrders({ pageSize: 500 }),
        fetchPatients({ limit: 200 }),
      ]);

      const rawOrders = Array.isArray(ordersRes.data?.items)
        ? ordersRes.data.items
        : Array.isArray(ordersRes.data)
        ? ordersRes.data
        : [];
      const formattedOrders = rawOrders.map((o: any) => ({
        id: o.id,
        accessionNumber: o.accessionNumber,
        patientId: o.patient?.patientId || o.patientId,
        patientName: o.patient ? `${o.patient.firstName} ${o.patient.lastName}` : 'Patient',
        modality: o.modality,
        examinationName: o.examinationName || `${o.modality} Study`,
        hasReport: !!o.report,
        reportStatus: o.report?.status,
        createdAt: o.createdAt,
      }));

      // Prioritize examinations with finalized diagnostic reports so they appear at top of selector
      formattedOrders.sort((a: any, b: any) => {
        if (a.hasReport && !b.hasReport) return -1;
        if (!a.hasReport && b.hasReport) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      setFinalizedOrders(formattedOrders);
      const rawPatients = Array.isArray(patientsRes.data?.items)
        ? patientsRes.data.items
        : Array.isArray(patientsRes.data)
        ? patientsRes.data
        : [];
      setPatients(rawPatients);
    } catch (err) {
      console.warn('Failed to load reference orders/patients', err);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    loadReferenceData();
  }, [loadAllData, loadReferenceData]);

  const handleCreateShare = async (payload: CreateSharePayload) => {
    const created = await externalShareService.createShare(payload);
    setSuccessMsg(`Share link #${created.shareNumber} created successfully! Token generated.`);
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadAllData();
  };

  const handleRevokeShare = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to revoke this share link? The recipient will no longer be able to access this shared study.'
    );
    if (!confirmed) return;

    const reason = window.prompt(
      'Please enter the clinical reason for revoking this share link:',
      'Clinical consultation completed'
    );
    if (!reason) return;

    try {
      await externalShareService.revokeShare(id, reason);
      setSuccessMsg('Share link revoked successfully. Recipient access has been immediately terminated.');
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadAllData();
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke share link.');
    }
  };

  const handleInitiateTransfer = async (payload: {
    orderId: string;
    destination: string;
    packageType: 'DICOM_ZIP' | 'DICOM_DIR' | 'C_STORE' | 'STOW_RS';
    totalFiles: number;
    totalBytes: number;
  }) => {
    const res = await externalShareService.initiateTransfer(payload);
    setSuccessMsg(`Transfer job #${res.transferNumber} queued for ${res.targetSystem}.`);
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadAllData();
  };

  const handleRetryTransfer = async (id: string) => {
    await externalShareService.retryTransfer(id);
    setSuccessMsg('Transfer retried successfully.');
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadAllData();
  };

  const handleReceiveImport = async (payload: any) => {
    const res = await externalShareService.receiveImport(payload);
    setSuccessMsg(`Outside DICOM study intake #${res.importNumber} logged. Status: ${res.status}.`);
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadAllData();
  };

  const handleReconcileImport = async (
    id: string,
    payload: {
      matchedPatientId?: string;
      matchedOrderId?: string;
      reconciliationNotes: string;
      reject: boolean;
    }
  ) => {
    const res = await externalShareService.reconcileImport(id, payload);
    setSuccessMsg(
      res.status === 'RECONCILED'
        ? `Outside study #${res.importNumber} reconciled to patient chart.`
        : `Outside study #${res.importNumber} rejected.`
    );
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadAllData();
  };

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Header */}
      <div className="rounded-3xl border border-[#dce6e0] bg-white p-5 md:p-6 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Interoperability &amp; Exchange</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            External Study Sharing &amp; DICOM Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Securely share authorized reports and imaging studies with verified external recipients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReceiveImportOpen(true)}
            className="text-xs gap-1.5 rounded-full border-[#dce6e0] bg-white hover:bg-slate-50 shadow-soft font-bold"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            <span>Intake Outside Study</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsInitiateTransferOpen(true)}
            className="text-xs gap-1.5 rounded-full border-[#dce6e0] bg-white hover:bg-slate-50 shadow-soft font-bold"
          >
            <ArrowUpRight className="w-4 h-4 text-sky-600" />
            <span>Dispatch DICOM Node</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateShareOpen(true)}
            className="text-xs gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-soft font-bold cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>+ New External Share</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs rounded-2xl flex items-center justify-between shadow-soft animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-sm font-bold cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/80 text-rose-900 text-xs rounded-2xl flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 text-sm font-bold cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <nav role="tablist" aria-label="External Share Sections" className="flex space-x-2 p-1.5 bg-[#f4f8f5]/80 rounded-3xl border border-[#dce6e0] shadow-soft">
          <button
            role="tab"
            aria-selected={activeTab === 'shares'}
            onClick={() => setActiveTab('shares')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'shares'
                ? 'bg-slate-900 text-white shadow-soft'
                : 'bg-white/80 hover:bg-white text-slate-600 border border-transparent hover:border-[#dce6e0]'
            }`}
          >
            <Share2 className={`w-3.5 h-3.5 ${activeTab === 'shares' ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>Active Shares</span>
            <span className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold tabular-nums ${
              activeTab === 'shares' ? 'bg-white/20 text-white' : 'bg-[#e9f1ed] text-emerald-800'
            }`}>
              {shares.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'transfers'}
            onClick={() => setActiveTab('transfers')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-slate-900 text-white shadow-soft'
                : 'bg-white/80 hover:bg-white text-slate-600 border border-transparent hover:border-[#dce6e0]'
            }`}
          >
            <ArrowUpRight className={`w-3.5 h-3.5 ${activeTab === 'transfers' ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Large File Transfers</span>
            <span className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold tabular-nums ${
              activeTab === 'transfers' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-800'
            }`}>
              {transfers.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'imports'}
            onClick={() => setActiveTab('imports')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'imports'
                ? 'bg-slate-900 text-white shadow-soft'
                : 'bg-white/80 hover:bg-white text-slate-600 border border-transparent hover:border-[#dce6e0]'
            }`}
          >
            <ArrowDownLeft className={`w-3.5 h-3.5 ${activeTab === 'imports' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Outside Study Imports</span>
            <span className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold tabular-nums ${
              activeTab === 'imports' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-800'
            }`}>
              {imports.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-slate-900 text-white shadow-soft'
                : 'bg-white/80 hover:bg-white text-slate-600 border border-transparent hover:border-[#dce6e0]'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${activeTab === 'logs' ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>Access &amp; Disclosure Audit</span>
            <span className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold tabular-nums ${
              activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {logs.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'shares' && (
        <ActiveSharesTab
          shares={shares}
          loading={loading}
          onRefresh={loadAllData}
          onOpenCreateModal={() => setIsCreateShareOpen(true)}
          onRevokeShare={handleRevokeShare}
        />
      )}

      {activeTab === 'transfers' && (
        <TransfersTab
          transfers={transfers}
          loading={loading}
          onRefresh={loadAllData}
          onOpenInitiateModal={() => setIsInitiateTransferOpen(true)}
          onRetryTransfer={handleRetryTransfer}
        />
      )}

      {activeTab === 'imports' && (
        <OutsideImportsTab
          imports={imports}
          loading={loading}
          onRefresh={loadAllData}
          onOpenReceiveModal={() => setIsReceiveImportOpen(true)}
          onOpenReconcileModal={(record) => setReconcileTarget(record)}
        />
      )}

      {activeTab === 'logs' && (
        <AuditLogsTab logs={logs} loading={loading} onRefresh={loadAllData} />
      )}

      {/* Modals */}
      <CreateShareModal
        isOpen={isCreateShareOpen}
        onClose={() => setIsCreateShareOpen(false)}
        onSubmit={handleCreateShare}
        finalizedOrders={finalizedOrders}
      />

      <InitiateTransferModal
        isOpen={isInitiateTransferOpen}
        onClose={() => setIsInitiateTransferOpen(false)}
        onSubmit={handleInitiateTransfer}
        orders={finalizedOrders}
      />

      <ReceiveImportModal
        isOpen={isReceiveImportOpen}
        onClose={() => setIsReceiveImportOpen(false)}
        onSubmit={handleReceiveImport}
      />

      <ReconcileImportModal
        isOpen={!!reconcileTarget}
        onClose={() => setReconcileTarget(null)}
        importRecord={reconcileTarget}
        patients={patients}
        onReconcile={handleReconcileImport}
      />
    </div>
  );
};
export default ExternalSharePage;
