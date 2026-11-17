import { useState } from 'react';
import { inventoryService, InventoryItemRecord, WastageLogRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  items: InventoryItemRecord[];
  wastageLogs: WastageLogRecord[];
  onRefresh: () => void;
}

const LOCATIONS = ['CT_SCANNER', 'MRI_SCANNER', 'XRAY_ROOM', 'PHARMACY', 'GENERAL_STORE'];
const REASONS = [
  'PARTIAL_VIAL_REMAINDER',
  'CONTAMINATION',
  'EXPIRED',
  'SPILLAGE',
  'REJECTED_DRAW',
];

export function WastageLogTab({ items, wastageLogs, onRefresh }: Props) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [location, setLocation] = useState('CT_SCANNER');
  const [quantity, setQuantity] = useState('1');
  const [volumeUsedMl, setVolumeUsedMl] = useState('80');
  const [volumeWastedMl, setVolumeWastedMl] = useState('20');
  const [reason, setReason] = useState('PARTIAL_VIAL_REMAINDER');
  const [orderId, setOrderId] = useState('');
  const [patientId, setPatientId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await inventoryService.recordWastage({
        itemId: selectedItemId,
        location,
        quantity: parseInt(quantity, 10) || 1,
        volumeUsedMl: parseFloat(volumeUsedMl) || undefined,
        volumeWastedMl: parseFloat(volumeWastedMl) || undefined,
        reason,
        orderId: orderId.trim() || undefined,
        patientId: patientId.trim() || undefined,
      });

      if (res.data) {
        setSuccess(`Logged wastage record ${res.data.wastageNumber} and adjusted inventory.`);
        onRefresh();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record wastage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wastage Recording Form */}
      <div className="bg-white p-6 rounded border border-slate-200 shadow-sm max-w-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Trash2 className="w-5 h-5 text-rose-600" />
          <h3 className="font-semibold text-base text-slate-900">Opened-Vial, Residual & Wastage Entry</h3>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-sm border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg text-sm border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Item *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.itemCode} — {it.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location Room *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity (Vials / Units) *</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Volume Used (mL)</label>
              <Input
                type="number"
                step="0.1"
                value={volumeUsedMl}
                onChange={(e) => setVolumeUsedMl(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Volume Wasted (mL)</label>
              <Input
                type="number"
                step="0.1"
                value={volumeWastedMl}
                onChange={(e) => setVolumeWastedMl(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Wastage Reason *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Linked Order ID</label>
              <Input
                placeholder="Optional order link"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Linked Patient ID</label>
              <Input
                placeholder="Optional patient link"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'Recording...' : 'Record Wastage & Reduce Usable Stock'}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Historical Wastage Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
            Auditable Opened-Vial & Wastage Log
          </h4>
          <span className="text-xs text-slate-500">{wastageLogs.length} total incident entries</span>
        </div>

        <div className="table-scroll-container thin-scroll overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Wastage Ref</th>
              <th className="p-3">Item Name</th>
              <th className="p-3">Location</th>
              <th className="p-3">Units</th>
              <th className="p-3">Volume (Used / Wasted)</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Recorded By</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {wastageLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  No wastage logged yet.
                </td>
              </tr>
            ) : (
              wastageLogs.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono font-medium text-slate-900">{w.wastageNumber}</td>
                  <td className="p-3 font-medium text-slate-800">{w.item?.name || w.itemId}</td>
                  <td className="p-3 text-slate-600">{w.location.replace('_', ' ')}</td>
                  <td className="p-3 font-bold text-slate-900">{w.quantity}</td>
                  <td className="p-3 text-slate-700 font-mono">
                    {w.volumeUsedMl || 0} mL / <span className="text-rose-600 font-bold">{w.volumeWastedMl || 0} mL</span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                      {w.reason.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{w.recordedByName || w.recordedById}</td>
                  <td className="p-3 text-slate-500">{new Date(w.recordedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

