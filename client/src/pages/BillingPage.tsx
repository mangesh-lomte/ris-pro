import { useState, useEffect } from 'react';
import {
  billingService,
  PriceMasterItem,
  InvoiceRecord,
  Quotation,
  InsuranceClaimRecord,
} from '../services/billingService';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import {
  CreditCard,
  Receipt,
  Tag,
  Calculator,
  ShieldCheck,
  Lock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { InvoicesTab } from '../features/billing/InvoicesTab';
import { OutstandingTab } from '../features/billing/OutstandingTab';
import { QuotationTab } from '../features/billing/QuotationTab';
import { PriceMasterTab } from '../features/billing/PriceMasterTab';
import { InsuranceClaimsTab } from '../features/billing/InsuranceClaimsTab';
import { CashierClosingTab } from '../features/billing/CashierClosingTab';
import { ReportsAndExportTab } from '../features/billing/ReportsAndExportTab';

export function BillingPage() {
  const [activeTab, setActiveTab] = useState<string>('invoices');

  // Shared state
  const [prices, setPrices] = useState<PriceMasterItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [claims, setClaims] = useState<InsuranceClaimRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pricesRes, invoicesRes, quotesRes, claimsRes] = await Promise.all([
        billingService.getPrices().catch(() => ({ data: [] })),
        billingService.listInvoices().catch(() => ({ data: [] })),
        billingService.listQuotations().catch(() => ({ data: [] })),
        billingService.listClaims().catch(() => ({ data: [] })),
      ]);

      if (pricesRes.data) setPrices(pricesRes.data);
      if (invoicesRes.data) setInvoices(invoicesRes.data);
      if (quotesRes.data) setQuotations(quotesRes.data);
      if (claimsRes.data) setClaims(claimsRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#DCE2EC]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">
            Billing &amp; Accounts
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Invoices, payments, TPA claims, cashier shifts &amp; revenue export
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="pills">
        <div className="bg-[#F3F6FC] p-2 rounded-xl border border-[#DCE2EC] flex flex-wrap items-center gap-2">
          {/* Group 1: Transactions */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 hidden sm:inline">Transactions</span>
            <TabsList className="bg-transparent p-0 gap-1">
              <TabsTrigger value="invoices" className="gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Invoices ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="outstanding" className="gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Outstanding ({invoices.filter((i) => Number(i.balance) > 0).length})
              </TabsTrigger>
              <TabsTrigger value="quotations" className="gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Quotes ({quotations.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="h-4 w-px bg-slate-300 hidden md:block" />

          {/* Group 2: Configuration */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 hidden sm:inline">
              Configuration
            </span>
            <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-1">
              <TabsTrigger
                value="prices"
                className="gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                Price Catalog ({prices.length})
              </TabsTrigger>
              <TabsTrigger
                value="claims"
                className="gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                TPA Claims ({claims.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="h-4 w-px bg-slate-300 hidden md:block" />

          {/* Group 3: Operations */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 hidden sm:inline">
              Operations
            </span>
            <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-1">
              <TabsTrigger
                value="cashier"
                className="gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Cashier Closing
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                GL Export & Reports
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="mt-5">
          {activeTab === 'invoices' && (
            <InvoicesTab
              invoices={invoices}
              prices={prices}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'outstanding' && (
            <OutstandingTab
              invoices={invoices}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'quotations' && (
            <QuotationTab
              quotations={quotations}
              prices={prices}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'prices' && (
            <PriceMasterTab
              prices={prices}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'claims' && (
            <InsuranceClaimsTab
              claims={claims}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'cashier' && (
            <CashierClosingTab onRefreshParent={loadData} />
          )}

          {activeTab === 'reports' && (
            <ReportsAndExportTab />
          )}
        </div>
      </Tabs>
    </div>
  );
}
export default BillingPage;

