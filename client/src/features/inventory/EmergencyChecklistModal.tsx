import { useState } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ShieldAlert, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  registerItems: any[];
}

export function EmergencyChecklistModal({ isOpen, onClose, onSuccess, registerItems }: Props) {
  const [location, setLocation] = useState('CT_SCANNER');
  const [notes, setNotes] = useState('');
  const [itemsStatus, setItemsStatus] = useState<Record<string, { status: string; remarks: string; replacementDone: boolean; replacementBatch: string }>>(() => {
    const init: any = {};
    for (const it of registerItems) {
      init[it.id] = {
        status: it.isExpired ? 'EXPIRED' : 'ACCEPTABLE',
        remarks: '',
        replacementDone: false,
        replacementBatch: '',
      };
    }
    return init;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payloadItems = registerItems.map((it) => {
        const s = itemsStatus[it.id] || { status: 'ACCEPTABLE', remarks: '', replacementDone: false, replacementBatch: '' };
        return {
          itemId: it.id,
          batchId: it.batches?.[0]?.id || undefined,
          status: s.status as any,
          currentStock: it.currentTotalStock || 0,
          expiryDate: it.earliestExpiry || undefined,
          replacementDone: s.replacementDone,
          replacementBatch: s.replacementBatch.trim() || undefined,
          remarks: s.remarks.trim() || undefined,
        };
      });

      await inventoryService.recordEmergencyChecklist({
        location,
        notes: notes.trim() || undefined,
        items: payloadItems,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit checklist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="font-semibold text-lg">Contrast-Reaction Crash Cart Checklist</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-sm border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Crash Cart Location *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="CT_SCANNER">CT Scanner Bay (Crash Cart #1)</option>
                <option value="MRI_SCANNER">MRI Scanner Bay (Non-Magnetic Cart #2)</option>
                <option value="XRAY_ROOM">X-Ray Department</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Checklist Notes</label>
              <Input
                placeholder="e.g. Monthly scheduled inspection per ACR standards"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Item & Stock</th>
                  <th className="p-2.5">Earliest Expiry</th>
                  <th className="p-2.5">Check Status</th>
                  <th className="p-2.5">Replacement Done?</th>
                  <th className="p-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registerItems.map((it) => {
                  const s = itemsStatus[it.id] || { status: 'ACCEPTABLE', remarks: '', replacementDone: false, replacementBatch: '' };
                  return (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-medium text-slate-800">
                        {it.name}
                        <div className="text-[10px] text-slate-400">Stock: {it.currentTotalStock || 0} {it.unit}</div>
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {it.earliestExpiry ? new Date(it.earliestExpiry).toLocaleDateString() : 'N/A'}
                        {it.isExpired && (
                          <span className="block text-rose-600 font-bold text-[10px]">EXPIRED</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <select
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:ring-teal-500"
                          value={s.status}
                          onChange={(e) =>
                            setItemsStatus((prev) => ({
                              ...prev,
                              [it.id]: { ...s, status: e.target.value },
                            }))
                          }
                        >
                          <option value="ACCEPTABLE">Acceptable</option>
                          <option value="EXPIRED">Expired</option>
                          <option value="LOW_STOCK">Low Stock</option>
                          <option value="REPLACED">Replaced</option>
                          <option value="MISSING">Missing</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          checked={s.replacementDone}
                          onChange={(e) =>
                            setItemsStatus((prev) => ({
                              ...prev,
                              [it.id]: { ...s, replacementDone: e.target.checked },
                            }))
                          }
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          placeholder="Notes / lot..."
                          className="w-full text-xs rounded border border-slate-200 px-2 py-1"
                          value={s.remarks}
                          onChange={(e) =>
                            setItemsStatus((prev) => ({
                              ...prev,
                              [it.id]: { ...s, remarks: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white">
              {loading ? 'Submitting...' : 'Complete & Sign Checklist'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

