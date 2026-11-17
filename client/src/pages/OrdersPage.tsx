import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrders, generateAccessionPreview, syncOrderMwl } from '../services/orderService';
import { Button } from '../components/ui/button';
import { IdentifierPill } from '../components/shared/IdentifierPill';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ModalityType, OrderStatus, Priority, ImagingOrder } from '../types';
import {
  Sparkles,
  FilePlus,
  Building2,
  ChevronDown,
  Layers,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { CreateOrderModal } from '../features/orders/CreateOrderModal';
import { BookAppointmentModal } from '../features/scheduling/BookAppointmentModal';
import { HisOrderImportModal } from '../features/orders/HisOrderImportModal';
import { OrderTrackingModal } from '../features/orders/OrderTrackingModal';
import { OrdersTableView } from '../features/orders/OrdersTableView';
import { ModalityWorklistView } from '../features/orders/ModalityWorklistView';
import { OrderTrackingView } from '../features/orders/OrderTrackingView';
import { MoreFilterValues } from '../features/orders/MoreFiltersModal';

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<string>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState<ModalityType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'ALL'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  const [moreFilters, setMoreFilters] = useState<MoreFilterValues>({
    referringDoctor: '',
    bodyPart: 'ALL',
    contrastRequirement: 'ALL',
    authorizationStatus: 'ALL',
  });

  const [previewAccession, setPreviewAccession] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // Modals state
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [hisImportOpen, setHisImportOpen] = useState(false);
  const [bookModalOrder, setBookModalOrder] = useState<ImagingOrder | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<{ id: string; accession: string; patientName: string } | null>(null);
  const [syncedMwlId, setSyncedMwlId] = useState<string | null>(null);

  // Calculate date boundaries for API if needed
  const dateParams = useMemo(() => {
    if (selectedDate === 'TODAY') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { dateFrom: today.toISOString() };
    }
    if (selectedDate === '7DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { dateFrom: d.toISOString() };
    }
    if (selectedDate === '30DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { dateFrom: d.toISOString() };
    }
    return {};
  }, [selectedDate]);

  // Fetch orders query
  const { data, isLoading } = useQuery({
    queryKey: [
      'orders',
      {
        search: searchTerm,
        modality: selectedModality === 'ALL' ? undefined : selectedModality,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        priority: selectedPriority === 'ALL' ? undefined : selectedPriority,
        ...dateParams,
      },
    ],
    queryFn: () =>
      fetchOrders({
        search: searchTerm || undefined,
        modality: selectedModality === 'ALL' ? undefined : selectedModality,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        priority: selectedPriority === 'ALL' ? undefined : selectedPriority,
        ...dateParams,
        pageSize: 100,
      }),
  });

  const handleGenerateNextAccession = async () => {
    try {
      setGenerating(true);
      const res = await generateAccessionPreview(selectedModality !== 'ALL' ? selectedModality : 'MRI');
      setPreviewAccession(res.accessionNumber);
    } finally {
      setGenerating(false);
    }
  };

  const handleSyncMwl = async (orderId: string) => {
    try {
      await syncOrderMwl(orderId);
      setSyncedMwlId(orderId);
      setTimeout(() => setSyncedMwlId(null), 3000);
    } catch (e) {
      console.error('Failed to sync order to MWL', e);
    }
  };

  const orders: ImagingOrder[] = data?.data?.items || (Array.isArray(data?.data) ? data.data : []);

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">
      {/* 1. PAGE HEADER & RESPONSIVE ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Imaging Orders &amp; Accession Registry
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track diagnostic imaging orders across scheduling, scanner acquisition, PACS handoff, and reporting.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Secondary Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateNextAccession}
              isLoading={generating}
              className="px-3.5 py-1.5 text-xs font-bold gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 whitespace-nowrap rounded-full shadow-soft"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Preview Next Accession</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setHisImportOpen(true)}
              variant="outline"
              className="px-3.5 py-1.5 text-xs font-bold border-[#dce6e0] text-slate-700 hover:bg-[#f8faf8] gap-1.5 shadow-soft whitespace-nowrap rounded-full"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Import HIS / EMR</span>
            </Button>
          </div>

          {/* More Actions Dropdown for smaller screens */}
          <div className="relative lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
              className="px-3 py-1.5 text-xs font-bold border-[#dce6e0] text-slate-700 gap-1 whitespace-nowrap rounded-full"
              aria-label="More actions menu"
              aria-expanded={actionsMenuOpen}
            >
              <span>More Actions</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </Button>

            {actionsMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#dce6e0] bg-white p-1.5 shadow-soft z-30 space-y-1 animate-in fade-in"
                onMouseLeave={() => setActionsMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleGenerateNextAccession();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-[#f8faf8] text-left font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preview Next Accession</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setHisImportOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-[#f8faf8] text-left font-bold cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Import HIS / EMR</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <Button
            size="sm"
            onClick={() => setCreateOrderOpen(true)}
            className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shadow-soft whitespace-nowrap rounded-full font-bold"
          >
            <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create Imaging Order</span>
          </Button>
        </div>
      </div>

      {/* Generated Accession Preview Callout */}
      {previewAccession && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between shadow-soft animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
              ACC
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Next Sequence Accession Number Preview</p>
              <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                Value: <span className="font-bold underline">{previewAccession}</span> (Format: ACC-YYYYMMDD-[MOD]-XXXX)
              </p>
            </div>
          </div>
          <IdentifierPill type="accession" value={previewAccession} />
        </div>
      )}

      {/* 2. THREE OPERATIONAL VIEWS TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200">
          <TabsList className="bg-transparent border-0 p-0 gap-0">
            <TabsTrigger value="orders" className="gap-1.5 rounded-none px-4 py-2.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Orders Registry</span>
            </TabsTrigger>
            <TabsTrigger value="mwl" className="gap-1.5 rounded-none px-4 py-2.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Modality Worklist</span>
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-1.5 rounded-none px-4 py-2.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Lifecycle Tracking</span>
            </TabsTrigger>
          </TabsList>
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 pb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Master Registry Active
          </span>
        </div>

        {/* View 1: Orders Registry (Section 7) */}
        <TabsContent value="orders" className="outline-none">
          <OrdersTableView
            orders={orders}
            isLoading={isLoading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedModality={selectedModality}
            setSelectedModality={setSelectedModality}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            selectedPriority={selectedPriority}
            setSelectedPriority={setSelectedPriority}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            moreFilters={moreFilters}
            setMoreFilters={setMoreFilters}
            onScheduleOrder={(ord) => setBookModalOrder(ord)}
            onTrackOrder={(ord) =>
              setTrackingOrder({
                id: ord.id,
                accession: ord.accessionNumber,
                patientName: `${ord.patient?.firstName || ''} ${ord.patient?.lastName || ''}`.trim(),
              })
            }
            onSyncMwl={handleSyncMwl}
            syncedMwlId={syncedMwlId}
          />
        </TabsContent>

        {/* View 2: Modality Worklist (Section 8, 9, 10) */}
        <TabsContent value="mwl" className="outline-none">
          <ModalityWorklistView
            orders={orders}
            isLoading={isLoading}
            onSyncMwl={handleSyncMwl}
            syncedMwlId={syncedMwlId}
          />
        </TabsContent>

        {/* View 3: Tracking (Section 11, 12) */}
        <TabsContent value="tracking" className="outline-none">
          <OrderTrackingView
            orders={orders}
            isLoading={isLoading}
            onTrackOrder={(ord) =>
              setTrackingOrder({
                id: ord.id,
                accession: ord.accessionNumber,
                patientName: `${ord.patient?.firstName || ''} ${ord.patient?.lastName || ''}`.trim(),
              })
            }
          />
        </TabsContent>
      </Tabs>

      {/* MODALS */}
      <CreateOrderModal
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        onScheduleOrder={(ord) => {
          setBookModalOrder(ord);
        }}
      />

      <HisOrderImportModal
        open={hisImportOpen}
        onOpenChange={setHisImportOpen}
      />

      {trackingOrder && (
        <OrderTrackingModal
          open={!!trackingOrder}
          onOpenChange={(op) => !op && setTrackingOrder(null)}
          orderId={trackingOrder.id}
          accessionNumber={trackingOrder.accession}
          patientName={trackingOrder.patientName}
        />
      )}

      {bookModalOrder && (
        <BookAppointmentModal
          open={!!bookModalOrder}
          onOpenChange={(op) => !op && setBookModalOrder(null)}
          order={bookModalOrder}
          patient={bookModalOrder.patient}
        />
      )}
    </div>
  );
}
