import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Boxes,
  MapPin,
  FlaskConical,
  Trash2,
  ShieldAlert,
  Film,
  Scale,
  AlertOctagon,
  BarChart3,
  QrCode,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../features/auth/AuthContext';
import {
  inventoryService,
  InventoryItemRecord,
  WastageLogRecord,
} from '../services/inventoryService';

import { ItemMasterTab } from '../features/inventory/ItemMasterTab';
import { StockReceiptTab } from '../features/inventory/StockReceiptTab';
import { LocationsTab } from '../features/inventory/LocationsTab';
import { ContrastCatalogTab } from '../features/inventory/ContrastCatalogTab';
import { WastageLogTab } from '../features/inventory/WastageLogTab';
import { EmergencyKitTab } from '../features/inventory/EmergencyKitTab';
import { FilmStockTab } from '../features/inventory/FilmStockTab';
import { StockAuditTab } from '../features/inventory/StockAuditTab';
import { RecallTraceabilityTab } from '../features/inventory/RecallTraceabilityTab';
import { ReportsTab } from '../features/inventory/ReportsTab';
import { BarcodeScannerModal } from '../features/inventory/BarcodeScannerModal';
import { Button } from '../components/ui/button';

type TabKey =
  | 'item-master'
  | 'stock-receipt'
  | 'locations'
  | 'contrast'
  | 'wastage'
  | 'emergency-kit'
  | 'film'
  | 'audit'
  | 'recall'
  | 'reports';

interface TabConfig {
  id: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'item-master', label: 'Item Master', icon: Package },
  { id: 'stock-receipt', label: 'Stock Receipt & Batches', icon: Boxes },
  { id: 'locations', label: 'Store & Cabinet Locations', icon: MapPin },
  { id: 'contrast', label: 'Contrast Catalog', icon: FlaskConical },
  { id: 'wastage', label: 'Opened-Vial & Wastage', icon: Trash2 },
  { id: 'emergency-kit', label: 'Emergency Kit Register', icon: ShieldAlert },
  { id: 'film', label: 'Film Stock & Counting', icon: Film },
  { id: 'audit', label: 'Physical Stock Audit', icon: Scale },
  { id: 'recall', label: 'Recall & Traceability', icon: AlertOctagon },
  { id: 'reports', label: 'Reports & Valuation', icon: BarChart3 },
];

export function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<TabKey>('item-master');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Common data state
  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [locationData, setLocationData] = useState<any>({ locations: [], grouped: {} });
  const [wastageLogs, setWastageLogs] = useState<WastageLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, locRes, wasteRes] = await Promise.all([
        inventoryService.getItems(),
        inventoryService.getLocationStocks(),
        inventoryService.listWastageLogs(),
      ]);

      if (itemsRes.success && itemsRes.data) {
        setItems(itemsRes.data);
      }
      if (locRes.success && locRes.data) {
        setLocationData(locRes.data);
      }
      if (wasteRes.success && wasteRes.data) {
        setWastageLogs(wasteRes.data);
      }
    } catch (err) {
      console.error('Failed to load inventory master data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const contrastItems = items.filter((it) => it.category === 'CONTRAST');

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#dce6e0] shadow-soft">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Inventory, Pharmacy &amp; Contrast Management</h1>
            <span className="px-3 py-1 text-[11px] font-bold rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200">
              Clinical Materials &amp; Pharmacy
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Clinical inventory, contrast media, emergency crash cart supplies, radiology consumables, and batch traceability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-soft rounded-full px-4 py-2"
          >
            <QrCode className="w-4 h-4 text-emerald-400" /> Barcode / QR Scanner
          </Button>

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 h-auto rounded-full border-[#dce6e0] text-slate-800 hover:bg-[#f8faf8] shadow-soft"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} /> Refresh All
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border border-[#dce6e0] bg-[#f0f4f1] rounded-full p-1.5 shadow-soft">
        <nav role="tablist" aria-label="Inventory Sections" className="flex space-x-1 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all cursor-pointer ${isActive
                    ? 'bg-slate-900 text-white shadow-soft font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'item-master' && (
          <ItemMasterTab items={items} onRefresh={loadData} isAdmin={isAdmin} />
        )}
        {activeTab === 'stock-receipt' && (
          <StockReceiptTab items={items} onRefresh={loadData} />
        )}
        {activeTab === 'locations' && (
          <LocationsTab
            items={items}
            locationData={locationData}
            onRefresh={loadData}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === 'contrast' && (
          <ContrastCatalogTab contrastItems={contrastItems} onRefresh={loadData} />
        )}
        {activeTab === 'wastage' && (
          <WastageLogTab
            items={items}
            wastageLogs={wastageLogs}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'emergency-kit' && <EmergencyKitTab />}
        {activeTab === 'film' && <FilmStockTab />}
        {activeTab === 'audit' && <StockAuditTab />}
        {activeTab === 'recall' && <RecallTraceabilityTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>

      {/* Quick Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
}
export default InventoryPage;
