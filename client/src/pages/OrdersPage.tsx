import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrders, generateAccessionPreview } from '../services/orderService';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { PriorityBadge } from '../components/shared/PriorityBadge';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ModalityType, OrderStatus } from '../types';
import { Search, Sparkles, Filter, Droplet } from 'lucide-react';

export function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState<ModalityType | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | undefined>(undefined);
  const [previewAccession, setPreviewAccession] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { search: searchTerm, modality: selectedModality, status: selectedStatus }],
    queryFn: () =>
      fetchOrders({
        search: searchTerm,
        modality: selectedModality,
        status: selectedStatus,
      }),
  });

  const handleGenerateNextAccession = async () => {
    try {
      setGenerating(true);
      const res = await generateAccessionPreview();
      setPreviewAccession(res.accessionNumber);
    } finally {
      setGenerating(false);
    }
  };

  const orders = data?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Imaging Orders & Accession Registry
            </h1>
            <Badge variant="cyan">Diagnostic Orders</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Unique Accession Number tracing — Persistent bridge between Modality Worklist, PACS, and Reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateNextAccession}
            isLoading={generating}
            className="text-xs gap-1.5 border-cyan-300 text-cyan-800 hover:bg-cyan-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span>Generate Next Accession #</span>
          </Button>
        </div>
      </div>

      {previewAccession && (
        <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white font-bold text-xs">
              ACC
            </div>
            <div>
              <p className="text-xs font-bold text-cyan-950">Next Sequence Accession Number Generated</p>
              <p className="text-[11px] text-cyan-800 font-mono mt-0.5">
                Value: <span className="font-bold underline">{previewAccession}</span> (Format: ACC-YYYYMMDD-XXXX)
              </p>
            </div>
          </div>
          <IdentifierPill type="accession" value={previewAccession} />
        </div>
      )}

      {/* Orders Filter & Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search accession, patient, MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Modality & Status Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Modality:
              </span>
              <button
                type="button"
                onClick={() => setSelectedModality(undefined)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedModality === undefined
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              {(['CT', 'MRI', 'XRAY'] as ModalityType[]).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setSelectedModality(selectedModality === mod ? undefined : mod)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedModality === mod
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mod}
                </button>
              ))}

              <span className="text-slate-300 mx-1">|</span>

              <span className="text-[11px] font-semibold text-slate-500 uppercase">Status:</span>
              {(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] as OrderStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(selectedStatus === st ? undefined : st)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    selectedStatus === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.toLowerCase().replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No imaging orders found matching query.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Accession Number</TableHead>
                  <TableHead>Patient / MRN</TableHead>
                  <TableHead>Modality & Body Part</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Clinical Indication</TableHead>
                  <TableHead>Referring Doctor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <IdentifierPill type="accession" value={order.accessionNumber} />
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 text-xs">
                        {order.patient?.lastName}, {order.patient?.firstName}
                      </div>
                      <div className="mt-0.5">
                        <IdentifierPill type="patient" value={order.patient?.patientId || ''} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="cyan" className="font-bold text-[10px]">
                          {order.modality}
                        </Badge>
                        <span className="font-medium text-slate-800 text-xs">
                          {order.bodyPart}
                        </span>
                        {order.contrastRequirement && (
                          <span
                            title="IV Contrast Required"
                            className="inline-flex items-center text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold"
                          >
                            <Droplet className="w-2.5 h-2.5 mr-0.5 fill-purple-500" />
                            +C
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={order.priority} />
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-slate-600 max-w-xs truncate" title={order.clinicalIndication}>
                        {order.clinicalIndication}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700 font-medium">
                        {order.referringDoctor}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.orderStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
