import { ModalityStatusTile } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Cpu, CheckCircle, AlertTriangle, Wifi } from 'lucide-react';

interface Props {
  tiles?: ModalityStatusTile[];
  isLoading?: boolean;
}

export function ModalityStatusTiles({ tiles, isLoading }: Props) {
  return (
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white h-full flex flex-col justify-between">
      <CardHeader className="p-3.5 sm:p-4 pb-2.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#174A70]" />
            <CardTitle className="text-sm font-semibold text-[#152B42]">
              Modality Status & Telemetry
            </CardTitle>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>PACS / DICOM Online</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3 flex-1 flex flex-col justify-between space-y-2.5">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading modality status...</div>
        ) : (
          tiles?.map((tile) => {
            const isOperational = tile.status === 'OPERATIONAL' || tile.status === 'BUSY';
            return (
              <div
                key={tile.modality}
                className="p-2.5 sm:p-3 rounded-lg border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[#152B42] text-xs sm:text-sm tracking-tight">{tile.modality}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{tile.name}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.2 flex items-center gap-1 font-semibold ${
                      tile.status === 'BUSY'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : isOperational
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-red-50 text-red-700 border-red-300'
                    }`}
                  >
                    {isOperational ? (
                      <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                    )}
                    {tile.status}
                  </Badge>
                </div>

                <div className="space-y-1 bg-slate-50/70 p-2 rounded-md border border-slate-100 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Today's Schedule:</span>
                    <span className="font-bold text-slate-900 tabular-nums">{tile.todayScheduledCount} exams</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Currently Scanning:</span>
                    <span className="font-semibold text-[#174A70] tabular-nums">{tile.currentlyScanningCount} scanner(s)</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Operational Scanners:</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {tile.totalScanners === 0
                        ? 'No configured equipment'
                        : `${tile.operationalScanners} / ${tile.totalScanners} Online`}
                    </span>
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="pt-0.5">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span className="font-medium">Capacity Utilization</span>
                    <span className="font-bold text-slate-800 tabular-nums">{tile.utilizationPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        tile.utilizationPercent > 80 ? 'bg-amber-500' : 'bg-[#174A70]'
                      }`}
                      style={{ width: `${tile.utilizationPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
