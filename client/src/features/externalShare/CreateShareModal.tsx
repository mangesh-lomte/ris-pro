import React, { useState } from 'react';
import { CreateSharePayload } from '../../services/externalShareService';
import { X, Lock, FileText, Film, Monitor, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface CreateShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateSharePayload) => Promise<void>;
  finalizedOrders: Array<{
    id: string;
    accessionNumber: string;
    patientId: string;
    patientName: string;
    modality: string;
    examinationName: string;
    hasReport: boolean;
    reportStatus?: string;
  }>;
}

export const CreateShareModal: React.FC<CreateShareModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  finalizedOrders,
}) => {
  const [orderId, setOrderId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientRole, setRecipientRole] = useState<'PATIENT' | 'REFERRING_PHYSICIAN' | 'OUTSIDE_HOSPITAL' | 'SPECIALIST'>('REFERRING_PHYSICIAN');
  const [institutionName, setInstitutionName] = useState('');
  const [shareType, setShareType] = useState<'PATIENT_LINK' | 'DOCTOR_SHARE' | 'OUTSIDE_HOSPITAL'>(
    'DOCTOR_SHARE'
  );
  const [durationDays, setDurationDays] = useState(7);
  const requiresOtp = true; // Mandatory per PDF Req 6
  const [includeDicom, setIncludeDicom] = useState(true);
  const [includeReportPdf, setIncludeReportPdf] = useState(true);
  const [includeWebViewer, setIncludeWebViewer] = useState(true);
  const [notes, setNotes] = useState('');

  // Consent fields
  const [consentPurpose, setConsentPurpose] = useState('External consultation & continuous clinical care');
  const [consentedBy, setConsentedBy] = useState('');
  const [relationToPatient, setRelationToPatient] = useState('SELF');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError('Please select an examination to share.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Recipient name is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        orderId,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        recipientRole: recipientRole.trim() || undefined,
        institutionName: institutionName.trim() || undefined,
        shareType,
        durationDays: Number(durationDays),
        requiresOtp,
        includeDicom,
        includeReportPdf,
        includeWebViewer,
        consentNotes: notes.trim() || undefined,
        consentPurpose: consentPurpose.trim() || undefined,
        consentedBy: consentedBy.trim() || recipientName.trim(),
        consentedByRelation: relationToPatient.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create external share link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Create Secure External Share Link</h2>
              <p className="text-xs text-gray-500">Secure tokenized external study links with time-limited recipient access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {/* Examination Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Diagnostic Examination <span className="text-rose-500">*</span>
            </label>
            <select
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                const sel = finalizedOrders.find((o) => o.id === e.target.value);
                if (sel && !consentedBy) {
                  setConsentedBy(sel.patientName);
                }
              }}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Select Examination Order --</option>
              {finalizedOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.accessionNumber} — {ord.examinationName} ({ord.patientName} • {ord.modality})
                  {ord.hasReport ? ' [Report FINAL]' : ' [Imaging Complete]'}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">
              Only examinations with finalized and signed reports can include official diagnostic PDFs.
            </p>
          </div>

          {/* Share Type & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Share Type</label>
              <select
                value={shareType}
                onChange={(e) => setShareType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="DOCTOR_SHARE">Outside Doctor / Referring Clinician</option>
                <option value="OUTSIDE_HOSPITAL">Outside Hospital / Tertiary Center</option>
                <option value="PATIENT_LINK">Patient Direct Share</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Link Validity Duration
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={1}>24 Hours (Urgent consult)</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days (Standard clinical window)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days (Maximum permissible)</option>
              </select>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="border border-gray-200 rounded p-4 bg-gray-50/50 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Recipient Identification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Recipient Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Dr. Marcus Vance"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Role / Designation</label>
                <select
                  value={recipientRole}
                  onChange={(e) => setRecipientRole(e.target.value as typeof recipientRole)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="REFERRING_PHYSICIAN">Referring physician</option>
                  <option value="SPECIALIST">Specialist</option>
                  <option value="OUTSIDE_HOSPITAL">Outside hospital</option>
                  <option value="PATIENT">Patient</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="recipient@hospital.org"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Phone (Optional)</label>
                <input
                  type="tel"
                  placeholder="+1 555-0192"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Outside Facility</label>
                <input
                  type="text"
                  placeholder="e.g., Metro Neuroscience"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Capabilities & Security Controls */}
          <div className="border border-gray-200 rounded p-4 bg-gray-50/50 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Access Permissions & Security</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={includeWebViewer}
                  onChange={(e) => setIncludeWebViewer(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="text-xs">
                  <div className="font-semibold text-gray-800 flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5 text-emerald-600" /> Web Viewer
                  </div>
                  <div className="text-gray-500 text-[10px]">Launch in OHIF</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={includeReportPdf}
                  onChange={(e) => setIncludeReportPdf(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="text-xs">
                  <div className="font-semibold text-gray-800 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-600" /> Report PDF
                  </div>
                  <div className="text-gray-500 text-[10px]">Finalized report download</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={includeDicom}
                  onChange={(e) => setIncludeDicom(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="text-xs">
                  <div className="font-semibold text-gray-800 flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-[#2563EB]" /> DICOM ZIP
                  </div>
                  <div className="text-gray-500 text-[10px]">Authenticated image archive</div>
                </div>
              </label>
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-900">
                <div className="font-semibold">Mandatory 6-digit OTP verification</div>
                <div className="text-blue-800/80 mt-0.5">
                  This link requires mandatory 6-digit OTP verification before clinical information, images, or diagnostic reports are displayed.
                </div>
              </div>
            </div>
          </div>

          {/* Consent / Disclosure Record */}
          <div className="border border-gray-200 rounded p-4 bg-gray-50/50 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Patient Consent & Clinical Disclosure</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Purpose of Disclosure</label>
                <input
                  type="text"
                  value={consentPurpose}
                  onChange={(e) => setConsentPurpose(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Consented By</label>
                <input
                  type="text"
                  placeholder="Patient name or legal proxy"
                  value={consentedBy}
                  onChange={(e) => setConsentedBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Relation to Patient</label>
                <select
                  value={relationToPatient}
                  onChange={(e) => setRelationToPatient(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="SELF">Patient Self</option>
                  <option value="PARENT_GUARDIAN">Parent / Guardian</option>
                  <option value="LEGAL_REPRESENTATIVE">Legal Representative</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Administrative Notes (Optional)</label>
              <input
                type="text"
                placeholder="Internal clinical context"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition disabled:opacity-50"
            >
              {loading ? (
                'Generating Link...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Generate External Share Link
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
