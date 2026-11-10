import * as React from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Filter, RotateCcw } from 'lucide-react';

export interface MoreFilterValues {
  referringDoctor: string;
  bodyPart: string;
  contrastRequirement: string;
  authorizationStatus: string;
}

interface MoreFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MoreFilterValues;
  onApply: (filters: MoreFilterValues) => void;
  onReset: () => void;
}

export function MoreFiltersModal({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset,
}: MoreFiltersModalProps) {
  const [draft, setDraft] = React.useState<MoreFilterValues>(filters);

  // Sync draft when modal opens
  React.useEffect(() => {
    setDraft(filters);
  }, [filters, open]);

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle className="flex items-center gap-2 text-sm font-bold text-[#152B42]">
          <Filter className="w-4 h-4 text-[#174A70]" />
          <span>Advanced Order Filters</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Filter orders by anatomical region, physician, contrast protocol, and pre-authorization.
        </DialogDescription>
      </DialogHeader>

      <DialogContent className="space-y-4 py-2">
        {/* Anatomical Region / Body Part */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Anatomical Region / Body Part</label>
          <select
            value={draft.bodyPart}
            onChange={(e) => setDraft({ ...draft, bodyPart: e.target.value })}
            className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700"
          >
            <option value="ALL">All Anatomical Regions</option>
            <option value="Brain">Brain & Head</option>
            <option value="Chest">Chest / Thorax</option>
            <option value="Abdomen">Abdomen</option>
            <option value="Pelvis">Pelvis</option>
            <option value="Spine">Spine (Cervical / Lumbar)</option>
            <option value="Extremity">Extremities (Knee / Shoulder / Ankle)</option>
            <option value="Neck">Neck & Soft Tissue</option>
            <option value="Cardiac">Cardiac & Coronary</option>
          </select>
        </div>

        {/* Referring Physician */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Referring Physician Search</label>
          <input
            type="text"
            placeholder="Search doctor name or clinic..."
            value={draft.referringDoctor}
            onChange={(e) => setDraft({ ...draft, referringDoctor: e.target.value })}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Contrast Administration Requirement */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Contrast Requirement Protocol</label>
          <select
            value={draft.contrastRequirement}
            onChange={(e) => setDraft({ ...draft, contrastRequirement: e.target.value })}
            className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700"
          >
            <option value="ALL">All Protocols (Contrast & Non-Contrast)</option>
            <option value="NONE">Non-Contrast Examinations Only</option>
            <option value="IV">Intravenous (IV) Contrast Required</option>
            <option value="ORAL">Oral Contrast Required</option>
            <option value="BOTH">Dual Protocol (IV + Oral)</option>
          </select>
        </div>

        {/* Pre-Authorization Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Insurance Pre-Authorization Status</label>
          <select
            value={draft.authorizationStatus}
            onChange={(e) => setDraft({ ...draft, authorizationStatus: e.target.value })}
            className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#227DA5] bg-white text-slate-700"
          >
            <option value="ALL">All Authorization Statuses</option>
            <option value="APPROVED">Pre-Authorized / Approved</option>
            <option value="PENDING">Pending Insurance Clearance</option>
            <option value="NOT_REQUIRED">Self-Pay / Not Required</option>
            <option value="DENIED">Pre-Authorization Denied</option>
          </select>
        </div>
      </DialogContent>

      <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-200 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="text-xs gap-1.5 text-slate-600 hover:text-slate-900"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Extra Filters</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs bg-[#174A70] hover:bg-[#123855] text-white"
          >
            Apply Filters
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
