import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { ExternalLink, LockKeyhole } from 'lucide-react';

interface PatientPortalModalProps {
  initialPatientId?: string;
  initialDob?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientPortalModal({ open, onOpenChange }: PatientPortalModalProps) {
  const openSecurePortal = () => {
    onOpenChange(false);
    window.location.assign('/patient-portal');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
            <DialogTitle className="text-base font-bold">Secure Patient Report Portal</DialogTitle>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Patient reports are available through the mobile OTP portal. Date of birth and patient ID alone are not accepted as authentication.
          </p>
        </DialogHeader>

        <div className="rounded border border-[#E2E8F0] bg-[#F7F8FB] p-4 text-sm text-[#34435C]">
          The patient must verify the code sent to their registered mobile number before viewing or downloading a released final report.
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" className="min-h-11 gap-2 bg-[#2563EB] text-white hover:bg-[#292F75]" onClick={openSecurePortal}>
            Open OTP Portal <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
