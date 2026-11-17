import { Printer } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { calculateAge, formatDate } from '../../utils/formatters';

const CODE39: Record<string, string> = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  A:'wnnnnwnnw',B:'nnwnnwnnw',C:'wnwnnwnnn',D:'nnnnwwnnw',E:'wnnnwwnnn',F:'nnwnwwnnn',G:'nnnnnwwnw',H:'wnnnnwwnn',I:'nnwnnwwnn',J:'nnnnwwwnn',
  K:'wnnnnnnww',L:'nnwnnnnww',M:'wnwnnnnwn',N:'nnnnwnnww',O:'wnnnwnnwn',P:'nnwnwnnwn',Q:'nnnnnnwww',R:'wnnnnnwwn',S:'nnwnnnwwn',T:'nnnnwnwwn',
  U:'wwnnnnnnw',V:'nwwnnnnnw',W:'wwwnnnnnn',X:'nwnnwnnnw',Y:'wwnnwnnnn',Z:'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn',
};

function Code39Barcode({ value }: { value: string }) {
  const safeValue = value.toUpperCase().replace(/[^0-9A-Z. -]/g, '-');
  const encoded = `*${safeValue}*`;
  let cursor = 0;
  const bars: Array<{ x: number; width: number }> = [];
  for (const character of encoded) {
    const pattern = CODE39[character];
    pattern.split('').forEach((widthCode, index) => {
      const width = widthCode === 'w' ? 3 : 1;
      if (index % 2 === 0) bars.push({ x: cursor, width });
      cursor += width;
    });
    cursor += 1;
  }
  return (
    <svg role="img" aria-label={`Code 39 barcode encoding ${safeValue}`} viewBox={`0 0 ${cursor} 40`} className="h-10 w-full max-w-sm" preserveAspectRatio="none">
      <title>{`Scannable Code 39: ${safeValue}`}</title>
      {bars.map((bar, index) => <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width} height="40" fill="currentColor" />)}
    </svg>
  );
}

interface PatientLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  accessionNumber?: string;
  tokenNumber?: string | null;
  modality?: string;
  examination?: string;
}

export function PatientLabelModal({
  open,
  onOpenChange,
  patient,
  accessionNumber,
  tokenNumber,
  modality,
  examination,
}: PatientLabelModalProps) {
  const handlePrint = () => {
    const cleanup = () => document.body.classList.remove('printing-patient-label');
    document.body.classList.add('printing-patient-label');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Patient Identification Label & Wristband</DialogTitle>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Printable specimen label / patient wristband formatted for 2" x 4" thermal transfer printers.
          </p>

          {/* Printable Label Preview Card */}
          <div
            id="printable-label"
            className="border-2 border-dashed border-slate-300 rounded-xl p-5 bg-white text-slate-900 shadow-sm font-mono space-y-3 print:border-none print:shadow-none print:m-0 print:p-2"
          >
            <div className="flex items-start justify-between border-b pb-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans block">
                  Radiology Information System (RIS)
                </span>
                <h3 className="text-sm font-bold tracking-tight">
                  {patient.lastName.toUpperCase()}, {patient.firstName.toUpperCase()}
                </h3>
              </div>
              {tokenNumber && (
                <div className="rounded border-2 border-slate-900 px-2 py-0.5 text-center">
                  <span className="text-[9px] uppercase font-sans block">Queue Token</span>
                  <span className="text-xs font-bold">{tokenNumber}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">Persistent Patient ID (MRN)</span>
                <span className="font-bold text-slate-900">{patient.patientId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">DOB / Age / Gender</span>
                <span>
                  {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)}y, {patient.gender.slice(0, 1)})
                </span>
              </div>
            </div>

            {accessionNumber && (
              <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Accession Number</span>
                  <span className="font-bold text-[#174A70]">{accessionNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Exam / Modality</span>
                  <span className="truncate block font-semibold">{examination || modality || 'Radiology'}</span>
                </div>
              </div>
            )}

            {/* Scannable Code 39 barcode */}
            <div className="pt-2 border-t flex flex-col items-center justify-center space-y-1">
              <Code39Barcode value={accessionNumber || patient.patientId} />
              <span className="text-[9px] text-slate-500">*{accessionNumber || patient.patientId}*</span>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button size="sm" onClick={handlePrint} className="bg-[#174A70] hover:bg-[#123855] text-white gap-1.5 shadow-2xs">
          <Printer className="w-3.5 h-3.5" />
          <span>Print Thermal Label</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

