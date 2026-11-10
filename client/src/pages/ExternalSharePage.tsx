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

      const rawOrders = ordersRes.data?.items || (ordersRes.data as any) || [];
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
      setPatients(patientsRes.data?.items || (patientsRes.data as any) || []);
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
    targetSystem: string;
    transferProtocol: 'DICOM_DIR' | 'C_STORE' | 'TLS_HTTPS' | 'WADO_RS';
    simulateFailure?: boolean;
  }) => {
    const res = await externalShareService.initiateTransfer(payload);
    setSuccessMsg(`Transfer job #${res.transferNumber} queued with protocol ${res.transferProtocol}.`);
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
      action: 'ATTACH_TO_PATIENT' | 'REJECT';
      patientId?: string;
      notes?: string;
      rejectionReason?: string;
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
    <div className="space-y-6">
      {/* Standard RIS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE2EC]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">
            External Study Sharing &amp; DICOM Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Securely share authorized reports and imaging studies with verified external recipients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReceiveImportOpen(true)}
            className="text-xs gap-1.5 rounded-lg"
          >
            <ArrowDownLeft className="w-4 h-4 text-[#15966A]" />
            <span>Intake Outside Study</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsInitiateTransferOpen(true)}
            className="text-xs gap-1.5 rounded-lg"
          >
            <ArrowUpRight className="w-4 h-4 text-[#2563B8]" />
            <span>Dispatch DICOM Node</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateShareOpen(true)}
            className="text-xs gap-1.5 shadow-xs rounded-lg"
          >
            <Share2 className="w-4 h-4" />
            <span>+ New External Share</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2 shadow-2xs">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div role="tablist" aria-label="External Share Sections" className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          role="tab"
          aria-selected={activeTab === 'shares'}
          onClick={() => setActiveTab('shares')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#227DA5] ${activeTab === 'shares'
            ? 'border-[#174A70] text-[#174A70]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          Active Shares
          <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-[#174A70]/10 text-[#174A70] font-bold tabular-nums">
            {shares.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'transfers'}
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#227DA5] ${activeTab === 'transfers'
            ? 'border-[#174A70] text-[#174A70]'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Large File Transfers
          <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-50 text-indigo-700 font-bold tabular-nums">
            {transfers.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'imports'}
          onClick={() => setActiveTab('imports')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${activeTab === 'imports'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Outside Study Imports
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">
            {imports.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'logs'}
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${activeTab === 'logs'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Access & Disclosure Audit
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-bold">
            {logs.length}
          </span>
        </button>
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
