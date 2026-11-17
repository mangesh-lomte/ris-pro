import { useState, useEffect } from 'react';
import {
  RevenueReportData,
  DebtorReportData,
  AccountingExportData,
  billingService,
} from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import {
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileCode,
  AlertCircle,
  PieChart,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatINR } from '../../utils/formatters';

export function ReportsAndExportTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [revenue, setRevenue] = useState<RevenueReportData | null>(null);
  const [debtors, setDebtors] = useState<DebtorReportData | null>(null);
  const [accounting, setAccounting] = useState<AccountingExportData | null>(null);
  const [, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [revRes, debtRes, accRes] = await Promise.all([
        billingService.getRevenueReport(),
        billingService.getDebtorReport(),
        billingService.getAccountingExport('json'),
      ]);
      setRevenue(revRes.data);
      setDebtors(debtRes.data);
      setAccounting(accRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [isAdmin]);

  const handleDownloadCsv = async () => {
    setExporting(true);
    try {
      const csvText = await billingService.getAccountingExport('csv');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GL_Journal_Vouchers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to download CSV export');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadJson = () => {
    if (!accounting) return;
    const jsonStr = JSON.stringify(accounting, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GL_Journal_Vouchers_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded border border-slate-200 shadow-sm space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Financial Access Restricted</h3>
        <p className="text-2xs text-slate-500 max-w-md mx-auto">
          Executive revenue reporting, debtor aging analytics, and double-entry General Ledger exports are restricted to Administrator accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Accounting Export Callout Header */}
      <div className="p-5 rounded border border-cyan-200 bg-cyan-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-700 text-white rounded-lg">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">General Ledger Double-Entry Accounting Export</h3>
          </div>
          <p className="text-2xs text-slate-600 mt-1">
            Export verified balanced journal vouchers (Debits = Credits) across Sales, Receipts, and Refunds for ERP / Tally / QuickBooks integration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadJson}
            disabled={!accounting}
            className="text-xs gap-1.5 bg-white border-slate-300"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-700" />
            Download JSON
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadCsv}
            disabled={exporting}
            className="bg-cyan-700 hover:bg-cyan-800 text-white text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export GL CSV'}
          </Button>
        </div>
      </div>

      {/* Revenue Performance Summary */}
      {revenue && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Revenue & Billing Performance
          </h4>

          {(() => {
            const grossBilled = Number(revenue.summary?.grossBilled ?? (revenue as any).totalGross ?? 0);
            const discountsGiven = Number(revenue.summary?.discountsGiven ?? (revenue as any).totalDiscount ?? 0);
            const netRealized = Number(revenue.summary?.netRealizedRevenue ?? (revenue as any).totalNetRevenue ?? 0);
            const outstanding = Number(revenue.summary?.totalOutstanding ?? (revenue as any).totalOutstanding ?? 0);
            const invCount = revenue.summary?.totalInvoices ?? (revenue as any).invoiceCount ?? 0;
            const totalCollected = Number(revenue.summary?.totalPaid ?? (revenue as any).totalCollected ?? 0);

            const getMethodTotal = (m: string) => {
              if (Array.isArray(revenue.byPaymentMethod)) {
                const found = revenue.byPaymentMethod.find((x) => x.method === m);
                return found ? Number(found.total) : 0;
              }
              return Number((revenue.byPaymentMethod as any)?.[m]?.total ?? (revenue.byPaymentMethod as any)?.[m] ?? 0);
            };

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-4 rounded border border-slate-200 bg-white shadow-sm">
                    <span className="text-3xs uppercase font-bold text-slate-400 block">Gross Invoiced</span>
                    <span className="text-lg font-extrabold text-slate-900 font-mono">
                      {formatINR(grossBilled)}
                    </span>
                    <p className="text-3xs text-slate-500 mt-0.5">{invCount} invoices issued</p>
                  </div>

                  <div className="p-4 rounded border border-amber-200 bg-amber-50/40">
                    <span className="text-3xs uppercase font-bold text-amber-700 block">Discounts Approved</span>
                    <span className="text-lg font-extrabold text-amber-800 font-mono">
                      {formatINR(discountsGiven)}
                    </span>
                    <p className="text-3xs text-amber-700 mt-0.5">Admin authorized</p>
                  </div>

                  <div className="p-4 rounded border border-emerald-200 bg-emerald-50/40">
                    <span className="text-3xs uppercase font-bold text-emerald-700 block">Total Net Realized</span>
                    <span className="text-lg font-extrabold text-emerald-800 font-mono">
                      {formatINR(netRealized)}
                    </span>
                    <p className="text-3xs text-emerald-700 mt-0.5">Collections: {formatINR(totalCollected)}</p>
                  </div>

                  <div className="p-4 rounded border border-rose-200 bg-rose-50/40">
                    <span className="text-3xs uppercase font-bold text-rose-700 block">Outstanding Receivables</span>
                    <span className="text-lg font-extrabold text-rose-700 font-mono">
                      {formatINR(outstanding)}
                    </span>
                    <p className="text-3xs text-rose-600 mt-0.5">Debtor balances</p>
                  </div>
                </div>

                {/* Payment Method Breakdown */}
                <div className="p-4 rounded border border-slate-200 bg-white space-y-2">
                  <span className="font-bold text-2xs uppercase tracking-wide text-slate-600 block">
                    Collections by Tender / Payment Method
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-2xs">
                    {(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE', 'INSURANCE'] as const).map((m) => (
                      <div key={m} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                        <span className="text-slate-400 block text-3xs uppercase">{m.replace('_', ' ')}</span>
                        <span className="font-mono font-bold text-slate-800">{formatINR(getMethodTotal(m))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Debtor Aging Report */}
      {debtors && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-cyan-600" />
            Debtor Aging Analysis & Accounts Receivable
          </h4>

          {(() => {
            const under30 = Number(debtors.agingSummary?.currentUnder30Days ?? (debtors.agingSummary as any)?.under30Days ?? 0);
            const days31to60 = Number(debtors.agingSummary?.thirtyToSixtyDays ?? (debtors.agingSummary as any)?.days31To60 ?? 0);
            const days61to90 = Number(debtors.agingSummary?.sixtyToNinetyDays ?? (debtors.agingSummary as any)?.days61To90 ?? 0);
            const over90 = Number(debtors.agingSummary?.overNinetyDays ?? (debtors.agingSummary as any)?.over90Days ?? 0);
            const totalRec = Number(debtors.totalReceivable ?? (debtors as any).totalOutstanding ?? 0);

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded border border-slate-200 bg-white">
                    <span className="text-3xs uppercase font-bold text-slate-400 block">&lt; 30 Days (Current)</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatINR(under30)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded border border-slate-200 bg-white">
                    <span className="text-3xs uppercase font-bold text-slate-400 block">31 - 60 Days</span>
                    <span className="text-base font-extrabold text-amber-700 font-mono">
                      {formatINR(days31to60)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded border border-slate-200 bg-white">
                    <span className="text-3xs uppercase font-bold text-slate-400 block">61 - 90 Days</span>
                    <span className="text-base font-extrabold text-rose-600 font-mono">
                      {formatINR(days61to90)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded border border-rose-200 bg-rose-50/50">
                    <span className="text-3xs uppercase font-bold text-rose-700 block">&gt; 90 Days (Delinquent)</span>
                    <span className="text-base font-extrabold text-rose-800 font-mono">
                      {formatINR(over90)}
                    </span>
                  </div>
                </div>

                <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b bg-slate-50/50 flex items-center justify-between">
                    <span className="font-bold text-2xs uppercase text-slate-700">Detailed Debtor Registry</span>
                    <span className="text-3xs text-slate-500 font-mono">Total Outstanding: {formatINR(totalRec)}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="text-3xs uppercase font-bold text-slate-500">Invoice #</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient ID</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient Name</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500">Accession</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Overdue Days</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Invoice Total</TableHead>
                        <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Outstanding Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtors.debtors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                            Zero debtor balances on record.
                          </TableCell>
                        </TableRow>
                      ) : (
                        debtors.debtors.map((d, dIdx) => {
                          const totalBilled = Number(d.totalBilled ?? (d as any).totalAmount ?? 0);
                          const outstandingDue = Number(d.outstandingAmount ?? (d as any).outstandingBalance ?? 0);
                          const daysOverdue = d.daysOutstanding ?? (d as any).daysOverdue ?? 0;

                          return (
                            <TableRow key={d.invoiceNumber || dIdx} className="hover:bg-slate-50/50 text-xs">
                              <TableCell className="font-mono font-bold text-cyan-900">{d.invoiceNumber}</TableCell>
                              <TableCell className="font-mono font-bold text-blue-700">{d.patientId}</TableCell>
                              <TableCell className="font-medium text-slate-800">{d.patientName}</TableCell>
                              <TableCell className="font-mono text-slate-800">{d.accessionNumber}</TableCell>
                              <TableCell className="text-center font-mono text-2xs">{daysOverdue} days</TableCell>
                              <TableCell className="font-mono text-right">{formatINR(totalBilled)}</TableCell>
                              <TableCell className="font-mono font-bold text-rose-600 text-right">
                                {formatINR(outstandingDue)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
