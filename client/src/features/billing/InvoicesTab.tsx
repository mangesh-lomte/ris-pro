import { useState, Fragment } from 'react';
import { formatINR } from '../../utils/formatters';
import {
  InvoiceRecord,
  PriceMasterItem,
  ReceiptRecord,
  PaymentRecord,
} from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Plus,
  Search,
  CreditCard,
  Receipt,
  Tag,
  Undo2,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { ApplyDiscountModal } from './ApplyDiscountModal';
import { ProcessRefundModal } from './ProcessRefundModal';
import { AttachClinicalChargesModal } from './AttachClinicalChargesModal';
import { CreateClaimModal } from './CreateClaimModal';

interface InvoicesTabProps {
  invoices: InvoiceRecord[];
  prices: PriceMasterItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function InvoicesTab({ invoices, prices, loading, onRefresh }: InvoicesTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);
  const [receiptRecord, setReceiptRecord] = useState<ReceiptRecord | null>(null);
  const [discountInvoice, setDiscountInvoice] = useState<InvoiceRecord | null>(null);
  const [refundInvoice, setRefundInvoice] = useState<InvoiceRecord | null>(null);
  const [chargesAccession, setChargesAccession] = useState<string | null>(null);
  const [claimInvoice, setClaimInvoice] = useState<InvoiceRecord | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.patientId.toLowerCase().includes(search.toLowerCase()) ||
      inv.accessionNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.patient &&
        `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handlePaymentSuccess = (_payment: PaymentRecord, receipt?: ReceiptRecord | null) => {
    if (receipt) {
      setReceiptRecord(receipt);
    }
    onRefresh();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-800">PAID</span>;
      case 'PARTIALLY_PAID':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800">PARTIAL</span>;
      case 'ISSUED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-blue-100 text-blue-800">ISSUED</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700">DRAFT</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-rose-100 text-rose-800">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Search Invoice #, MRN, Accession..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 text-xs px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="ISSUED">Issued / Unpaid</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setChargesAccession('')}
            className="text-xs gap-1.5 border-slate-300"
          >
            <Layers className="w-4 h-4 text-[#2563EB]" />
            Attach Contrast / Film
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-700 hover:bg-cyan-800 text-white text-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create RIS Invoice
          </Button>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Invoice #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient ID</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Accession</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Gross</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Discount</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Net Total</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Balance</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Status</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  No invoices found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((inv) => {
                const isExpanded = expandedInvoiceId === inv.id;
                const outstanding = Number(inv.balance ?? inv.outstandingAmount ?? 0);
                const gross = Number(inv.grossAmount) > 0
                  ? Number(inv.grossAmount)
                  : Math.max(0, Number(inv.total) + Number(inv.discount || 0) - Number(inv.taxAmount || 0));

                return (
                  <Fragment key={inv.id}>
                    <TableRow className={`hover:bg-slate-50/50 ${isExpanded ? 'bg-cyan-50/20' : ''}`}>
                      <TableCell className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-cyan-900 text-xs">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-blue-700 text-xs">
                        {inv.patientId}
                      </TableCell>
                      <TableCell className="font-mono text-slate-800 text-xs">
                        {inv.accessionNumber}
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 text-xs text-right">
                        {formatINR(gross)}
                      </TableCell>
                      <TableCell className="font-mono text-amber-700 text-xs text-right">
                        {Number(inv.discount) > 0 ? `-${formatINR(inv.discount)}` : formatINR(0)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900 text-xs text-right">
                        {formatINR(inv.total)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs text-right">
                        <span className={outstanding > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          {formatINR(outstanding)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(inv.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {outstanding > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => setPaymentInvoice(inv)}
                              className="h-7 px-2 text-2xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </Button>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          )}
                          {inv.receipts && inv.receipts.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReceiptRecord(inv.receipts[inv.receipts.length - 1])}
                              className="h-7 px-2 text-2xs gap-1 border-slate-300 text-slate-700"
                            >
                              <Receipt className="w-3 h-3" />
                              Receipt
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                            className="h-7 px-2 text-2xs text-slate-600 hover:text-slate-900"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/70 border-b-2 border-slate-200">
                        <TableCell colSpan={10} className="p-4 space-y-4 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left: Line Items */}
                            <div className="bg-white p-3.5 rounded border border-slate-200 space-y-2">
                              <span className="font-bold text-slate-800 text-2xs uppercase tracking-wide block">
                                Itemized Procedures & Fees ({inv.items?.length || 0})
                              </span>
                              {inv.items && inv.items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {inv.items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="flex items-center justify-between text-2xs p-1.5 rounded bg-slate-50 border border-slate-100"
                                    >
                                      <div>
                                        <span className="font-mono font-bold text-slate-800 mr-1.5">{it.code}</span>
                                        <span className="text-slate-600">{it.description}</span>
                                        <span className="text-slate-400 ml-1.5">x{it.quantity}</span>
                                      </div>
                                      <span className="font-mono font-bold text-slate-800">
                                        {formatINR(it.total)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-400 italic text-2xs">No individual items attached.</p>
                              )}
                            </div>

                            {/* Right: Payment Ledger & Receipts */}
                            <div className="bg-white p-3.5 rounded border border-slate-200 space-y-2">
                              <span className="font-bold text-slate-800 text-2xs uppercase tracking-wide block">
                                Payment Ledger ({inv.payments?.length || 0} transactions)
                              </span>
                              {inv.payments && inv.payments.length > 0 ? (
                                <div className="space-y-1.5">
                                  {inv.payments.map((p) => (
                                    <div
                                      key={p.id}
                                      className="flex items-center justify-between text-2xs p-1.5 rounded bg-slate-50 border border-slate-100"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">
                                          {p.method}
                                        </span>
                                        <span className="font-mono text-slate-500 text-3xs">
                                          {new Date(p.createdAt).toLocaleTimeString()}
                                        </span>
                                        {p.referenceNumber && (
                                          <span className="font-mono text-slate-400 text-3xs">
                                            Ref: {p.referenceNumber}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-emerald-700">
                                          +{formatINR(p.amount)}
                                        </span>
                                        {p.receipt && (
                                          <button
                                            type="button"
                                            onClick={() => setReceiptRecord(p.receipt!)}
                                            className="text-cyan-700 hover:text-cyan-900 font-mono text-3xs underline"
                                          >
                                            {p.receipt.receiptNumber}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-400 italic text-2xs">No payments recorded yet.</p>
                              )}

                              {/* Refunds if any */}
                              {inv.refunds && inv.refunds.length > 0 && (
                                <div className="pt-2 border-t space-y-1">
                                  <span className="font-bold text-rose-700 text-3xs uppercase block">
                                    Refund Ledger ({inv.refunds.length})
                                  </span>
                                  {inv.refunds.map((r) => (
                                    <div
                                      key={r.id}
                                      className="flex items-center justify-between text-2xs p-1.5 rounded bg-rose-50 border border-rose-100 text-rose-800"
                                    >
                                      <span>{r.reason}</span>
                                      <span className="font-mono font-bold">-{formatINR(r.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Toolbar for Invoice */}
                          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-3 text-2xs text-slate-500">
                              <span>Patient: <strong className="text-slate-800">{inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : inv.patientId}</strong></span>
                              <span>•</span>
                              <span>Modality: <strong className="text-slate-800">{inv.order?.modality || 'General'}</strong></span>
                              {inv.discountReason && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-700">Discount Reason: {inv.discountReason}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDiscountInvoice({ ...inv, grossAmount: gross })}
                                className="h-7 px-2.5 text-2xs gap-1 text-amber-800 border-amber-300 hover:bg-amber-50"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                Approve Discount
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRefundInvoice(inv)}
                                className="h-7 px-2.5 text-2xs gap-1 text-rose-800 border-rose-300 hover:bg-rose-50"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Refund / Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setClaimInvoice(inv)}
                                className="h-7 px-2.5 text-2xs gap-1 text-blue-800 border-blue-300 hover:bg-blue-50"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                TPA Claim
                              </Button>
                              {outstanding > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => setPaymentInvoice(inv)}
                                  className="h-7 px-3 text-2xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Collect Payment
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Dialogs */}
      <CreateInvoiceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        prices={prices}
        onInvoiceCreated={() => {
          onRefresh();
        }}
      />

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

      <ApplyDiscountModal
        open={!!discountInvoice}
        onOpenChange={(open) => !open && setDiscountInvoice(null)}
        invoice={discountInvoice}
        onSuccess={() => onRefresh()}
      />

      <ProcessRefundModal
        open={!!refundInvoice}
        onOpenChange={(open) => !open && setRefundInvoice(null)}
        invoice={refundInvoice}
        onSuccess={() => onRefresh()}
      />

      <AttachClinicalChargesModal
        open={chargesAccession !== null}
        onOpenChange={(open) => !open && setChargesAccession(null)}
        orderAccession={chargesAccession || ''}
        onSuccess={() => onRefresh()}
      />

      <CreateClaimModal
        open={!!claimInvoice}
        onOpenChange={(open) => !open && setClaimInvoice(null)}
        invoice={claimInvoice}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
}
