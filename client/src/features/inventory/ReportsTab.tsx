import { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { BarChart3, TrendingUp, AlertTriangle, Building2, IndianRupee, RefreshCw, CheckCircle2 } from 'lucide-react';

export function ReportsTab() {
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getReports({
        supplierName: supplierName.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res.success && res.data) {
        setReportsData(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load inventory valuation reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Inventory Valuation & Supplier Spend Reports</h2>
              <p className="text-xs text-slate-500">Asset valuation, category distribution, vendor invoices, and reorder alerts</p>
            </div>
          </div>

          <Button
            onClick={loadReports}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs py-1.5 h-auto text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Reports
          </Button>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Supplier</label>
            <Input
              type="text"
              placeholder="e.g. Bayer, GE Healthcare..."
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={loadReports}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs h-8"
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      {reportsData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-medium uppercase">Total Stock Value</span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              ₹{Number(reportsData.totalInventoryValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Asset value on hand</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-medium uppercase">Tracked Categories</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {reportsData.categoryValuation?.length || 0}
            </div>
            <span className="text-[11px] text-slate-500">Contrast, Film, Drugs & Supplies</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-medium uppercase">Vendor Invoices</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {reportsData.supplierPurchases?.length || 0}
            </div>
            <span className="text-[11px] text-indigo-600 font-medium">Recorded receipts</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-medium uppercase">Reorder Alerts</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {reportsData.reorderAlerts?.length || 0}
            </div>
            <span className="text-[11px] text-rose-600 font-medium">Items below minimum stock</span>
          </div>
        </div>
      )}

      {/* Category Breakdown Table */}
      {reportsData?.categoryValuation && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-800">Category Valuation Breakdown</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Active SKUs</th>
                  <th className="px-4 py-2.5 text-right">In-Stock Quantity</th>
                  <th className="px-4 py-2.5 text-right">Total Valuation (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {reportsData.categoryValuation.map((c: any) => (
                  <tr key={c.category} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{c.category}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.itemCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{c.totalStock}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      ₹{Number(c.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reorder Alerts Warning List */}
      {reportsData?.reorderAlerts && reportsData.reorderAlerts.length > 0 && (
        <div className="bg-white rounded-lg border border-rose-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-rose-200 bg-rose-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-rose-900">
                Minimum Stock & Reorder Alerts ({reportsData.reorderAlerts.length} items)
              </h3>
            </div>
            <span className="text-xs text-rose-700 font-medium">Reorder required from supplier</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/50 text-rose-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Available Stock</th>
                  <th className="px-4 py-2.5 text-right">Reorder Threshold</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 text-slate-700">
                {reportsData.reorderAlerts.map((item: any) => (
                  <tr key={item.id} className="hover:bg-rose-50/30">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{item.itemCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.category}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">
                      {item.currentPhysicalStock || 0} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 font-medium">{item.reorderLevel}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                        <AlertTriangle className="w-3 h-3" /> REORDER REQUIRED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Purchase Receipts Table */}
      {reportsData?.supplierPurchases && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Supplier Invoices & Purchases</h3>
            </div>
            <span className="text-xs text-slate-500">{reportsData.supplierPurchases.length} invoices</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Supplier Name</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Items Received</th>
                  <th className="px-4 py-2.5 text-right">Total Amount (₹)</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {reportsData.supplierPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No supplier purchases found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  reportsData.supplierPurchases.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{inv.supplierName}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{inv.itemsCount || 1}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> {inv.status || 'RECEIVED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

