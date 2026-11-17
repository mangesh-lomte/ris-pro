import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { Stethoscope, FileDown, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ReferringDoctorPortalModalProps {
  initialEmail?: string;
  initialRegNo?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferringDoctorPortalModal({
  initialEmail = 's.mitchell@metrohealth.org',
  initialRegNo = 'MED-REG-88219',
  open,
  onOpenChange,
}: ReferringDoctorPortalModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [registrationNumber, setRegistrationNumber] = useState(initialRegNo);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [doctorData, setDoctorData] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      setRegistrationNumber(initialRegNo);
      setToken(null);
      setDoctorData(null);
      setReports([]);
      setError(null);
      setDownloadSuccess(null);
    }
  }, [open, initialEmail, initialRegNo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    setDownloadSuccess(null);

    try {
      const res = await receptionDeliveryService.referringDoctorLogin(email.trim(), registrationNumber.trim());
      setToken(res.token);
      setDoctorData(res.doctor);
      const repList = await receptionDeliveryService.getReferringDoctorReports(res.token);
      setReports(repList);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Referring physician authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDownload = async (accession: string) => {
    if (!token) return;
    setError(null);
    setDownloadSuccess(null);
    try {
      await receptionDeliveryService.downloadReferringDoctorReportPdf(accession, token);
      setDownloadSuccess(`Downloaded finalized diagnostic report for Accession ${accession}`);
    } catch (err: any) {
      setError(err?.message || 'Download failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#2563EB]" />
            <DialogTitle className="text-base font-bold">
              Referring Physician Secure Report Portal
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Item 9: Referring doctor access — Provide referring clinician secure login access to view report and images.
          </p>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {downloadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {!token ? (
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="p-3 bg-muted/40 border rounded-lg text-xs space-y-1">
              <span className="font-semibold text-foreground">Clinician Medical Board Authentication</span>
              <p className="text-muted-foreground text-[11px]">
                Enter registered clinical email address and Medical Board Registration number.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Doctor Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="s.mitchell@metrohealth.org"
                className="w-full text-xs rounded border bg-background p-2"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Medical Registration Number *</label>
              <input
                type="text"
                required
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="MED-REG-88219"
                className="w-full min-h-11 rounded border bg-background px-3 text-sm font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In as Referring Doctor
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Authenticated Doctor Card */}
            <div className="p-3 bg-blue-50/60 dark:bg-indigo-950/20 border border-blue-200 dark:border-indigo-800 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-foreground text-sm">{doctorData.name}</span>
                <div className="text-muted-foreground text-[11px] flex items-center gap-2 mt-0.5">
                  <span>{doctorData.organization || 'Clinical Center'}</span>
                  {doctorData.registrationNumber && <span>• Reg: {doctorData.registrationNumber}</span>}
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px]">AUTHORIZED CLINICIAN</Badge>
            </div>

            {/* Reports List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Referred Patients Final Reports ({reports.length})
              </h4>
              {reports.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  No finalized reports referred by this doctor.
                </p>
              ) : (
                <div className="space-y-2">
                  {reports.map((rep) => (
                    <div
                      key={rep.orderId}
                      className="p-3 border rounded-lg bg-card text-xs flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{rep.patientName}</span>
                          <span className="text-muted-foreground text-[11px]">({rep.patientId})</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {rep.accessionNumber}
                          </Badge>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0">
                            v{rep.version} {rep.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {rep.modality} • {rep.examinationName} • Reported by {rep.signedBy}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shrink-0"
                        onClick={() => handleDownload(rep.accessionNumber)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Download Report PDF
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button size="sm" variant="outline" onClick={() => setToken(null)}>
                Sign Out
              </Button>
              <Button size="sm" variant="default" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

