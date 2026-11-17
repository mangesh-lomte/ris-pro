import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  Calendar,
  Fingerprint,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { formatDate } from '../../utils/formatters';
import { radiologistService, FinalizeReportResponse } from '../../services/radiologistService';

interface ReportReviewSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  modality: string;
  examinationName: string;
  draftVersion: number;
  findings: string;
  impression: string;
  measurementsCount?: number;
  keyImagesCount?: number;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  onSuccess: (result: FinalizeReportResponse) => void;
}

export const ReportReviewSignModal: React.FC<ReportReviewSignModalProps> = ({
  isOpen,
  onClose,
  orderId,
  accessionNumber,
  patientId,
  patientName,
  modality,
  examinationName,
  draftVersion,
  findings,
  impression,
  measurementsCount = 0,
  keyImagesCount = 0,
  signerName,
  signerEmail,
  signerRole,
  onSuccess,
}) => {
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasFindings = findings.trim().length > 0;
  const hasImpression = impression.trim().length > 0;
  const isComplete = hasFindings && hasImpression;

  const handleSignAndLock = async () => {
    if (!approved || !isComplete || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await radiologistService.finalizeAndSignReport(orderId, {
        draftVersion,
        findings: findings.trim(),
        impression: impression.trim(),
        approved: true,
        signatureStatement: `Electronically reviewed, approved, and signed by ${signerName} (${signerRole}) for final clinical release.`,
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to finalize and digitally sign report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/70 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#152B42] tracking-tight">
                  FINAL REPORT REVIEW & DIGITAL SIGNATURE
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Lock className="w-3 h-3" />
                  LOCK GATING
                </span>
              </div>
              <p className="text-xs text-[#65758A] mt-0.5">
                Verify text completeness, review exam identity, and apply tamper-evident electronic signature.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IdentifierPill type="patient" value={patientId} />
            <IdentifierPill type="accession" value={accessionNumber} />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Exam & Patient Identity Verification */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[#65758A] block font-medium">Patient</span>
              <span className="text-[#152B42] font-semibold text-sm">{patientName}</span>
            </div>
            <div>
              <span className="text-[#65758A] block font-medium">Modality</span>
              <span className="text-[#152B42] font-semibold text-sm">{modality}</span>
            </div>
            <div>
              <span className="text-[#65758A] block font-medium">Examination</span>
              <span className="text-[#152B42] font-medium truncate block" title={examinationName}>
                {examinationName}
              </span>
            </div>
            <div>
              <span className="text-[#65758A] block font-medium">Target Version</span>
              <span className="text-[#059669] font-semibold text-sm">Version 1 (FINAL)</span>
            </div>
          </div>

          {/* Completeness Checklist */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-semibold text-[#152B42] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
              Clinical Completeness Checklist
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                {hasFindings ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className={hasFindings ? 'text-[#152B42]' : 'text-amber-800 font-medium'}>
                  Findings Documented ({findings.trim().split(/\s+/).filter(Boolean).length} words)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasImpression ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className={hasImpression ? 'text-[#152B42]' : 'text-amber-800 font-medium'}>
                  Impression Documented ({impression.trim().split(/\s+/).filter(Boolean).length} words)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#65758A]">
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>OHIF Image Measurements Attached ({measurementsCount})</span>
              </div>
              <div className="flex items-center gap-2 text-[#65758A]">
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Key Image References Attached ({keyImagesCount})</span>
              </div>
            </div>
          </div>

          {/* Final Content Preview */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold text-[#152B42] uppercase tracking-wider">
              Diagnostic Report Preview
            </h4>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <span className="text-[11px] font-bold text-[#65758A] uppercase tracking-wider block mb-1">
                  Findings
                </span>
                <p className="text-xs text-[#152B42] whitespace-pre-wrap leading-relaxed font-sans bg-white p-3 rounded border border-slate-200 shadow-xs">
                  {findings || <span className="text-red-600 italic">No findings entered.</span>}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#65758A] uppercase tracking-wider block mb-1">
                  Impression
                </span>
                <p className="text-xs text-[#152B42] whitespace-pre-wrap leading-relaxed font-sans bg-white p-3 rounded border border-slate-200 shadow-xs font-medium">
                  {impression || <span className="text-red-600 italic">No impression entered.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Digital Signature Manifest Preview */}
          <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-[#059669]" />
                Electronic Signature Manifest
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">
                SHA-256 Digest
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#059669] shrink-0" />
                <div>
                  <span className="text-[#65758A] block text-[10px]">Named Signing Radiologist</span>
                  <span className="text-[#152B42] font-semibold">{signerName}</span>
                  <span className="text-[#65758A] text-[11px] ml-1">({signerRole} &middot; {signerEmail})</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#059669] shrink-0" />
                <div>
                  <span className="text-[#65758A] block text-[10px]">Signature Timestamp</span>
                  <span className="text-[#152B42] font-medium">{formatDate(new Date().toISOString())}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#65758A] leading-normal border-t border-emerald-200/60 pt-2.5">
              Legal Statement: Applying this electronic signature permanently finalizes and locks Version 1 of this report. Subsequent edits cannot overwrite this signed report and must be recorded as auditable clinical amendments.
            </p>
          </div>

          {/* Review Approval Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition-colors">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              disabled={!isComplete || submitting}
              className="mt-0.5 w-4 h-4 text-[#059669] bg-white border-slate-300 rounded focus:ring-[#059669] cursor-pointer"
            />
            <span className="text-xs text-slate-700 leading-relaxed select-none">
              <strong className="text-[#152B42] block font-medium">
                I have reviewed the report text, confirmed exam and patient identity, and approve final clinical release.
              </strong>
              I understand that submitting will permanently lock this diagnostic report with my cryptographic digital signature.
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/70 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Cancel / Return to Edit
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSignAndLock}
            disabled={!approved || !isComplete || submitting}
            className="bg-[#059669] hover:bg-[#047857] text-white font-semibold flex items-center gap-2 shadow-xs"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing & Locking...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Authorize, Sign & Lock (FINAL)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
