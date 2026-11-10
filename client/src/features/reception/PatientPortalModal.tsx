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
import { UserCheck, FileDown, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PatientPortalModalProps {
  initialPatientId?: string;
  initialDob?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientPortalModal({
  initialPatientId = 'PAT-2026-DEMO01',
  initialDob = '1985-04-12',
  open,
  onOpenChange,
}: PatientPortalModalProps) {
  const [patientId, setPatientId] = useState(initialPatientId);
  const [dateOfBirth, setDateOfBirth] = useState(initialDob);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setPatientId(initialPatientId);
      setDateOfBirth(initialDob);
      setToken(null);
      setPatientData(null);
      setReports([]);
      setError(null);
      setDownloadSuccess(null);
    }
  }, [open, initialPatientId, initialDob]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    setDownloadSuccess(null);

    try {
      const res = await receptionDeliveryService.patientLogin(patientId.trim(), dateOfBirth.trim());
      setToken(res.token);
      setPatientData(res.patient);
      const repList = await receptionDeliveryService.getPatientReports(res.token);
      setReports(repList);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Patient authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDownload = async (accession: string) => {
    if (!token) return;
    setError(null);
    setDownloadSuccess(null);
    try {
      await receptionDeliveryService.downloadPatientReportPdf(accession, token);
      setDownloadSuccess(`Successfully downloaded diagnostic report for Accession ${accession}`);
    } catch (err: any) {
      setError(err?.message || 'Download failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-base font-bold">
              Online Patient Report Portal
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Item 8: Patient portal access — Allow authorized patient to view and download finalized report.
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
              <span className="font-semibold text-foreground">Secure Patient Verification</span>
              <p className="text-muted-foreground text-[11px]">
                Enter your Master Patient ID and registered Date of Birth.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Patient ID *</label>
              <input
                type="text"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. PAT-2026-DEMO01"
                className="w-full text-xs rounded border bg-background p-2 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Date of Birth (YYYY-MM-DD) *</label>
              <input
                type="text"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                placeholder="1985-04-12"
                className="w-full text-xs rounded border bg-background p-2 font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In to Portal
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Authenticated Patient Card */}
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-foreground text-sm">
                  {patientData.firstName} {patientData.lastName}
                </span>
                <div className="text-muted-foreground text-[11px] flex items-center gap-2 mt-0.5">
                  <span className="font-mono">ID: {patientData.patientId}</span>
                  <span>• DOB: {patientData.dateOfBirth}</span>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px]">VERIFIED PATIENT</Badge>
            </div>

            {/* Reports List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Finalized Reports Available for Download ({reports.length})
              </h4>
              {reports.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  No finalized reports currently ready.
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
                          <span className="font-bold text-foreground text-sm">{rep.examinationName}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {rep.accessionNumber}
                          </Badge>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0">
                            v{rep.version} {rep.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Reported by {rep.signedBy} on {new Date(rep.finalizedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shrink-0"
                        onClick={() => handleDownload(rep.accessionNumber)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Download PDF
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

