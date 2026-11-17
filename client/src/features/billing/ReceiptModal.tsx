import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { ReceiptRecord } from '../../services/billingService';
import { Printer, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptRecord | null;
}

export function ReceiptModal({ open, onOpenChange, receipt }: ReceiptModalProps) {
  if (!receipt) return null;

  const snapshot = receipt.receiptSnapshot || {};
  const formattedDate = new Date(receipt.issuedAt).toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle>Official Payment Receipt</DialogTitle>
            <p className="text-2xs text-slate-500 font-mono">{receipt.receiptNumber}</p>
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="p-6 space-y-4 print:p-0">
        <div className="border border-slate-200 rounded p-5 bg-slate-50/50 space-y-4 text-xs">
          <div className="text-center border-b pb-3 flex flex-col items-center">
            <img src="/radaxis-symbol.png" alt="RadAxis" className="w-8 h-8 object-contain mb-1 drop-shadow-xs" />
            <h3 className="font-bold text-sm tracking-wide text-slate-900 uppercase">
              RADAXIS RADIOLOGY & IMAGING CENTRE
            </h3>
            <p className="text-2xs text-slate-500">100 Healthcare Blvd, Suite 200 • Tax ID: TX-99201-RIS</p>
            <p className="text-2xs font-semibold text-emerald-700 mt-1">PAYMENT RECEIPT ACKNOWLEDGMENT</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-slate-600">
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Receipt Number</span>
              <span className="font-mono font-bold text-slate-900">{receipt.receiptNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Date & Time</span>
              <span>{formattedDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Patient ID (MRN)</span>
              <span className="font-mono font-bold text-blue-700">{snapshot.patientId || receipt.invoice?.patientId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Accession Number</span>
              <span className="font-mono font-bold text-slate-900">{snapshot.accessionNumber || receipt.invoice?.accessionNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Invoice Ref</span>
              <span className="font-mono text-slate-800">{snapshot.invoiceNumber || receipt.invoice?.invoiceNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Payment Method</span>
              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-2xs">
                {receipt.paymentMethod}
              </span>
            </div>
          </div>

          <div className="border-t pt-3 flex justify-between items-center text-sm">
            <span className="font-bold text-slate-700">Amount Paid:</span>
            <span className="font-mono font-extrabold text-emerald-700 text-base">
              {formatINR(receipt.amount)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 text-3xs text-slate-500 space-y-1">
            <p>• This is a computer-generated, immutable digital receipt.</p>
            <p>• Linked to Patient ID and Study Accession Number.</p>
            <p>• Cashier ID: <span className="font-mono">{receipt.issuedById}</span></p>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5" onClick={handlePrint}>
          <Printer className="w-4 h-4" />
          Print Receipt
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

