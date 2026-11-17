import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { externalShareService, SharedStudyPublicContext } from '../../services/externalShareService';
import {
  Lock,
  KeyRound,
  FileText,
  Film,
  Monitor,
  Calendar,
  AlertTriangle,
  Download,
  ExternalLink,
} from 'lucide-react';

export const SharedStudyRecipientPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [context, setContext] = useState<SharedStudyPublicContext | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchContext = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await externalShareService.getSharedStudyContext(token);
      setContext(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shared study. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, [token]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !otpCode.trim()) return;

    try {
      setVerifying(true);
      setError(null);
      await externalShareService.verifyOtp(token, otpCode.trim());
      setSuccessMsg('Identity verified successfully! Unlocking clinical study.');
      // Refetch full unlocked context
      const freshContext = await externalShareService.getSharedStudyContext(token);
      setContext(freshContext);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen clinical-grid-bg flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Verifying secure diagnostic share token...</p>
        </div>
      </div>
    );
  }

  if (error && !context) {
    return (
      <div className="min-h-screen clinical-grid-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-soft border border-rose-100 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-600">{error}</p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-block px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-800 hover:text-white bg-slate-100 rounded-full transition"
            >
              Return to RadAxis RIS Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen clinical-grid-bg text-slate-800">
      {/* Brand Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <img src="/radaxis-symbol.png" alt="RadAxis" className="w-full h-full object-contain drop-shadow-xs" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-gray-900">RadAxis RIS</div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                External Diagnostic Sharing Network
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <Lock className="w-3.5 h-3.5" />
            <span>Verification required</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {context?.requiresVerification ? (
          /* OTP Gate */
          <div className="max-w-md mx-auto bg-white rounded shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1D4F73] p-6 text-white text-center">
              <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-bold">Clinical Access Verification</h2>
              <p className="text-xs text-blue-100 mt-1">
                Share #{context.shareNumber} • {context.recipientName}
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium">
                  {successMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Enter 6-Digit Security Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 849201"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full text-center tracking-[0.3em] font-mono text-2xl px-4 py-3 border-2 border-gray-300 rounded focus:border-blue-600 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 text-center">
                  Mandatory 6-digit OTP verification. This link requires secure verification before clinical information is displayed.
                </p>
              </div>

              <button
                type="submit"
                disabled={verifying || otpCode.length < 6}
                className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-md transition disabled:opacity-50"
              >
                {verifying ? 'Verifying Code...' : 'Unlock Diagnostic Study'}
              </button>

              <div className="text-[11px] text-gray-500 font-medium text-center pt-2">
                Access window valid until: {new Date(context.expiresAt).toLocaleDateString('en-IN')}
              </div>
            </form>
          </div>
        ) : context?.patient && context?.examination ? (
          /* Unlocked Study Context */
          <div className="space-y-6">
            {/* Share Metadata Banner */}
            <div className="bg-[#1D4F73] rounded p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-200 mb-1">
                  <span>Share #{context.shareNumber}</span>
                  <span>•</span>
                  <span>Authorized Recipient: {context.recipientName}</span>
                </div>
                <h1 className="text-2xl font-bold">{context.examination.examinationName}</h1>
                <p className="text-sm text-blue-100 mt-1">
                  Accession #{context.examination.accessionNumber} • Modality: {context.examination.modality}
                </p>
              </div>

              <div className="bg-white/10 px-4 py-2.5 rounded text-right">
                <div className="text-xs text-blue-200">Expires On</div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                  <Calendar className="w-4 h-4 text-amber-300" />
                  {new Date(context.expiresAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>

            {/* Patient & Exam Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Card */}
              <div className="bg-white rounded p-6 border border-gray-200 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                  Patient Demographics
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Patient Name:</span>
                    <span className="font-bold text-gray-900">{context.patient.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Patient ID:</span>
                    <span className="font-mono text-gray-800">{context.patient.patientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gender / DOB:</span>
                    <span className="text-gray-800">
                      {context.patient.gender || 'N/A'} • {context.patient.dateOfBirth ? new Date(context.patient.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Study Card */}
              <div className="bg-white rounded p-6 border border-gray-200 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                  Clinical Examination
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accession Number:</span>
                    <span className="font-mono font-bold text-blue-700">{context.examination.accessionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Modality & Body Part:</span>
                    <span className="text-gray-800 font-medium">
                      {context.examination.modality} — {context.examination.bodyPart || 'Unspecified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Indication:</span>
                    <span className="text-gray-800 text-right truncate max-w-[220px]">
                      {context.examination.clinicalIndication || 'Clinical investigation'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Report Summary & PDF */}
            {context.reportSummary && (
              <div className="bg-white rounded p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-rose-600" />
                    <h2 className="text-base font-bold text-gray-900">Official Diagnostic Radiology Report</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    FINAL & LOCKED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Signed By:</span>
                    <div className="font-bold text-gray-900 mt-0.5">{context.reportSummary.signedBy}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Finalized At:</span>
                    <div className="font-medium text-gray-800 mt-0.5">
                      {context.reportSummary.finalizedAt
                        ? new Date(context.reportSummary.finalizedAt).toLocaleString('en-IN')
                        : 'Verified'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Key Findings</h3>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1 p-3 bg-slate-50 rounded-lg border border-gray-200">
                      {context.reportSummary.findings}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Impression</h3>
                    <div className="text-sm text-gray-900 font-semibold whitespace-pre-wrap mt-1 p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                      {context.reportSummary.impression}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities Download & View Actions */}
            <div className="bg-white rounded p-6 border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                Available Clinical Artifacts
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {context.capabilities?.includeWebViewer && context.webViewerUrl && (
                  <a
                    href={context.webViewerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-5 rounded border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 transition text-center group"
                  >
                    <Monitor className="w-8 h-8 text-emerald-600 mb-2 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm text-gray-900">Launch Web Viewer</div>
                    <div className="text-xs text-gray-500 mt-1">Review diagnostic slices in OHIF</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 mt-3">
                      Open Viewer <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                )}

                {context.capabilities?.includeReportPdf && token && (
                  <a
                    href={externalShareService.getSharedReportPdfUrl(token)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-5 rounded border-2 border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 hover:border-rose-400 transition text-center group"
                  >
                    <FileText className="w-8 h-8 text-rose-600 mb-2 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm text-gray-900">Download Report PDF</div>
                    <div className="text-xs text-gray-500 mt-1">Authoritative signed diagnostic report</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 mt-3">
                      Download PDF <Download className="w-3 h-3" />
                    </span>
                  </a>
                )}

                {context.capabilities?.includeDicom && token && (
                  <a
                    href={externalShareService.getSharedDicomPackageUrl(token)}
                    download
                    className="flex flex-col items-center justify-center p-5 rounded border-2 border-blue-200 bg-blue-50/50 hover:bg-indigo-100/70 hover:border-indigo-400 transition text-center group"
                  >
                    <Film className="w-8 h-8 text-[#2563EB] mb-2 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm text-gray-900">DICOM Image Archive</div>
                    <div className="text-xs text-gray-500 mt-1">Authenticated ZIP with manifest</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 mt-3">
                      Download ZIP <Download className="w-3 h-3" />
                    </span>
                  </a>
                )}
              </div>
            </div>

            {/* Consent Disclosure Notice */}
            {context.consent && (
              <div className="p-4 bg-gray-100 rounded border border-gray-200 text-xs text-gray-600 space-y-1">
                <div className="font-semibold text-gray-800">Patient Consent & Clinical Disclosure Record</div>
                <div>Purpose: {context.consent.purpose}</div>
                <div>Consented By: {context.consent.consentedBy} on {new Date(context.consent.consentDate).toLocaleDateString('en-IN')}</div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
};
