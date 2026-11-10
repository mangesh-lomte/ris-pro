import { useState, useEffect } from 'react';
import { inventoryService, EmergencyChecklistRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { EmergencyChecklistModal } from './EmergencyChecklistModal';
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Clock, ClipboardCheck, RefreshCw } from 'lucide-react';

export function EmergencyKitTab() {
  const [location, setLocation] = useState<string>('CT_SCANNER');
  const [registerItems, setRegisterItems] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<EmergencyChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [regRes, checkRes] = await Promise.all([
        inventoryService.getEmergencyRegister(location),
        inventoryService.listEmergencyChecklists(location),
      ]);

      if (regRes.success && regRes.data) {
        setRegisterItems(regRes.data);
      }
      if (checkRes.success && checkRes.data) {
        setChecklists(checkRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load emergency kit register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location]);

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Emergency & Crash Cart Register</h2>
            <p className="text-xs text-slate-500">Monitor resuscitation drugs, crash cart items, and mandatory safety checklists</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="CT_SCANNER">CT Scanner Console Room</option>
            <option value="MRI_SCANNER">MRI Scanner Control Room</option>
            <option value="XRAY_ROOM">X-Ray Emergency Cart</option>
            <option value="PHARMACY">Pharmacy Emergency Stock</option>
            <option value="GENERAL_STORE">Central Store</option>
          </select>

          <Button
            onClick={() => setIsChecklistModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 text-xs py-1.5 h-auto whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" /> Run Checklist
          </Button>

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs py-1.5 h-auto text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Emergency Register Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Adequate / Ready</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900">
            {registerItems.filter((i) => !i.isExpired && !i.isNearExpiry && (i.currentTotalStock || 0) >= (i.reorderLevel || 1)).length}
          </div>
          <p className="text-xs text-emerald-600 mt-1">Sufficient stock & valid expiry dates</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Low Stock / Reorder</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">
            {registerItems.filter((i) => (i.currentTotalStock || 0) < (i.reorderLevel || 1)).length}
          </div>
          <p className="text-xs text-amber-600 mt-1">Below minimum emergency threshold</p>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Expired / Near Expiry</span>
            <XCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">
            {registerItems.filter((i) => i.isExpired || i.isNearExpiry).length}
          </div>
          <p className="text-xs text-rose-600 mt-1">Requires immediate replacement</p>
        </div>
      </div>

      {/* Emergency Items Register Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-700">Crash Cart Drugs & Supplies ({registerItems.length})</h3>
          <span className="text-xs text-slate-500">Location: {location}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-2.5">Item Code</th>
                <th className="px-4 py-2.5">Drug / Item Name</th>
                <th className="px-4 py-2.5">Sub-Category</th>
                <th className="px-4 py-2.5 text-right">Available Qty</th>
                <th className="px-4 py-2.5 text-right">Min Threshold</th>
                <th className="px-4 py-2.5">Earliest Expiry</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {registerItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No emergency items found in register.
                  </td>
                </tr>
              ) : (
                registerItems.map((item) => {
                  const qty = item.currentTotalStock || 0;
                  const min = item.reorderLevel || 1;
                  const isLow = qty < min;
                  const isExp = item.isExpired;
                  const isNear = item.isNearExpiry;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{item.itemCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.unit}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.subCategory || 'EMERGENCY_DRUG'}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={isLow ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {qty} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">{min}</td>
                      <td className="px-4 py-3">
                        {item.earliestExpiry ? (
                          <span className={`inline-flex items-center gap-1 ${isExp ? 'text-red-600 font-semibold' : isNear ? 'text-amber-600' : 'text-slate-700'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(item.earliestExpiry).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isExp ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" /> EXPIRED
                          </span>
                        ) : isNear ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> NEAR EXPIRY
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="w-3 h-3" /> LOW STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> READY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Checklists Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-700">Checklist Inspection History</h3>
          <span className="text-xs text-slate-500">{checklists.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-2.5">Checklist #</th>
                <th className="px-4 py-2.5">Checked At</th>
                <th className="px-4 py-2.5">Checked By</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Items Inspected</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {checklists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No checklists recorded yet for this location.
                  </td>
                </tr>
              ) : (
                checklists.map((chk) => (
                  <tr key={chk.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{chk.checklistNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(chk.checkedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{chk.checkedByName}</td>
                    <td className="px-4 py-3 text-slate-600">{chk.location}</td>
                    <td className="px-4 py-3 text-slate-600">{chk.items?.length || 0} items</td>
                    <td className="px-4 py-3">
                      {chk.status === 'PASSED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> PASSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <AlertTriangle className="w-3 h-3" /> DEFICIENCIES FOUND
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{chk.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Checklist Modal */}
      <EmergencyChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        onSuccess={() => {
          setIsChecklistModalOpen(false);
          loadData();
        }}
        registerItems={registerItems}
      />
    </div>
  );
}

