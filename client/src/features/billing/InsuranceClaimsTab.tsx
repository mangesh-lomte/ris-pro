import { useState } from 'react';
import { InsuranceClaimRecord, billingService } from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface InsuranceClaimsTabProps {
  claims: InsuranceClaimRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function InsuranceClaimsTab({ claims, loading, onRefresh }: InsuranceClaimsTabProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (
    claim: InsuranceClaimRecord,
    newStatus: 'APPROVED' | 'REJECTED' | 'SETTLED'
  ) => {
    setUpdatingId(claim.id);
    try {
      await billingService.updateClaimStatus(claim.id, {
        status: newStatus,
        approvedAmount: newStatus === 'APPROVED' ? Number(claim.claimedAmount) : undefined,
        settledAmount: newStatus === 'SETTLED' ? Number(claim.approvedAmount || claim.claimedAmount) : undefined,
      });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to update claim');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SETTLED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-800">SETTLED</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-blue-100 text-blue-800">APPROVED</span>;
      case 'SUBMITTED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800">SUBMITTED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-rose-100 text-rose-800">REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              Third Party Administrator (TPA) & Insurance Claims
            </h4>
          </div>
          <span className="text-2xs text-slate-500">{claims.length} registered claims</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Claim #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Invoice #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient ID</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">TPA Provider</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Policy / Auth</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Claimed (₹)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Approved (₹)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Settled (₹)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Status</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">Loading claims...</TableCell>
              </TableRow>
            ) : claims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  No insurance claims submitted yet.
                </TableCell>
              </TableRow>
            ) : (
              claims.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/50 text-xs">
                  <TableCell className="font-mono font-bold text-blue-900">{c.claimNumber}</TableCell>
                  <TableCell className="font-mono font-semibold text-slate-700">{c.invoiceNumber || '—'}</TableCell>
                  <TableCell className="font-mono font-bold text-indigo-700">{c.patientId}</TableCell>
                  <TableCell className="font-medium text-slate-900">{c.tpaProvider}</TableCell>
                  <TableCell className="text-2xs text-slate-600 font-mono">
                    {c.policyNumber} {c.approvalCode ? `(${c.approvalCode})` : ''}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-800 text-right">
                    {formatINR(c.claimedAmount)}
                  </TableCell>
                  <TableCell className="font-mono text-blue-700 text-right">
                    {c.approvedAmount ? formatINR(c.approvedAmount) : '—'}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-emerald-700 text-right">
                    {c.settledAmount ? formatINR(c.settledAmount) : '—'}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.status === 'SUBMITTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === c.id}
                          onClick={() => handleUpdateStatus(c, 'APPROVED')}
                          className="h-6 px-2 text-3xs border-blue-300 text-blue-800 hover:bg-blue-50"
                        >
                          Approve
                        </Button>
                      )}
                      {c.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          disabled={updatingId === c.id}
                          onClick={() => handleUpdateStatus(c, 'SETTLED')}
                          className="h-6 px-2 text-3xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Settle
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
