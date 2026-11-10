import { useState } from 'react';
import { InvoiceRecord, PaymentRecord, ReceiptRecord } from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CreditCard, Search, Clock } from 'lucide-react';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { formatINR } from '../../utils/formatters';

interface OutstandingTabProps {
  invoices: InvoiceRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function OutstandingTab({ invoices, loading, onRefresh }: OutstandingTabProps) {
  const [search, setSearch] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);
  const [receiptRecord, setReceiptRecord] = useState<ReceiptRecord | null>(null);

  // Filter only invoices that have an outstanding balance > 0
  const outstandingInvoices = invoices.filter((inv) => {
    const hasBalance = Number(inv.balance) > 0;
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.patientId.toLowerCase().includes(search.toLowerCase()) ||
      inv.accessionNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.patient &&
        `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase().includes(search.toLowerCase()));

    return hasBalance && matchesSearch;
  });

  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  const handlePaymentSuccess = (_payment: PaymentRecord, receipt?: ReceiptRecord | null) => {
    if (receipt) {
      setReceiptRecord(receipt);
    }
    onRefresh();
  };

  const calculateDaysAging = (createdDate: string) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(createdDate).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
          <span className="text-3xs uppercase font-bold text-rose-700 block">Total Outstanding Balance</span>
          <span className="text-xl font-extrabold text-rose-700 font-mono">
            {formatINR(totalOutstanding)}
          </span>
          <p className="text-3xs text-rose-600">Across {outstandingInvoices.length} active invoices</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
          <span className="text-3xs uppercase font-bold text-amber-700 block">Partially Paid</span>
          <span className="text-xl font-extrabold text-amber-800 font-mono">
            {outstandingInvoices.filter((i) => i.status === 'PARTIALLY_PAID').length}
          </span>
          <p className="text-3xs text-amber-700">Accounts with partial deposits</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
          <span className="text-3xs uppercase font-bold text-slate-500 block">Uncollected / Issued</span>
          <span className="text-xl font-extrabold text-slate-800 font-mono">
            {outstandingInvoices.filter((i) => i.status === 'ISSUED').length}
          </span>
          <p className="text-3xs text-slate-500">Zero payments collected yet</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            placeholder="Search outstanding by patient or accession..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
        <span className="text-2xs text-slate-500">
          Showing {outstandingInvoices.length} uncollected ledger records
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Invoice #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient ID</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient Name</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Accession</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Invoice Total</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Balance Due</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Aging</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Status</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">Loading debtors...</TableCell>
              </TableRow>
            ) : outstandingInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  All accounts fully settled! Zero outstanding balances.
                </TableCell>
              </TableRow>
            ) : (
              outstandingInvoices.map((inv) => {
                const agingDays = calculateDaysAging(inv.createdAt);
                const balance = Number(inv.balance);

                return (
                  <TableRow key={inv.id} className="hover:bg-slate-50/50 text-xs">
                    <TableCell className="font-mono font-bold text-cyan-900">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-mono font-bold text-indigo-700">{inv.patientId}</TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : 'Walk-in'}
                    </TableCell>
                    <TableCell className="font-mono text-slate-800">{inv.accessionNumber}</TableCell>
                    <TableCell className="font-mono text-slate-800 text-right">
                      {formatINR(inv.total)}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-rose-600 text-right">
                      {formatINR(balance)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-2xs text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {agingDays}d
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-3xs font-bold uppercase ${
                          inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.status === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setPaymentInvoice(inv)}
                        className="h-7 px-2.5 text-2xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <RecordPaymentModal
        open={!!paymentInvoice}
        onOpenChange={(open) => !open && setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <ReceiptModal
        open={!!receiptRecord}
        onOpenChange={(open) => !open && setReceiptRecord(null)}
        receipt={receiptRecord}
      />
    </div>
  );
}
