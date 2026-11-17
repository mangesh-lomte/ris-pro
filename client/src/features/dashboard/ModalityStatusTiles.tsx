import { ModalityStatusTile } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Cpu, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react';

interface Props {
  tiles?: ModalityStatusTile[];
  isLoading?: boolean;
}

export function ModalityStatusTiles({ tiles, isLoading }: Props) {
  return (
    <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white h-full flex flex-col justify-between overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Fleet Telemetry &amp; Modalities
              </CardTitle>
              <p className="text-[11px] text-slate-500 font-medium">Scanner health &amp; workload</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>PACS Active</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-3">
        {isLoading ? (
          <div className="text-center py-10 text-xs text-slate-400 font-medium animate-pulse">
            Loading scanner telemetry...
          </div>
        ) : !tiles || tiles.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium">
            No modalities reporting online telemetry.
          </div>
        ) : (
          tiles.map((tile) => {
            const isOperational = tile.status === 'OPERATIONAL' || tile.status === 'BUSY';
            const isHighLoad = tile.utilizationPercent > 80;
            return (
              <div
                key={tile.modality}
                className="p-3.5 rounded-2xl border border-[#dce6e0] bg-[#f8faf8]/70 hover:bg-white hover:shadow-card hover:border-emerald-200 transition-all duration-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{tile.modality}</h4>
                      <span className="text-[11px] text-slate-500 font-medium truncate max-w-[130px]">{tile.name}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      tile.status === 'BUSY'
                        ? 'bg-amber-100/70 text-amber-900 border-amber-200'
                        : isOperational
                        ? 'bg-emerald-100/70 text-emerald-900 border-emerald-200'
                        : 'bg-rose-100/70 text-rose-900 border-rose-200'
                      }`}
                  >
                    {isOperational ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 mr-1 inline" />
                    ) : (
                      <AlertTriangle className="w-2.5 h-2.5 text-rose-700 mr-1 inline" />
                    )}
                    {tile.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-100 text-[11px]">
                  <div>
                    <div className="text-slate-400 font-medium text-[10px]">Today</div>
                    <div className="font-bold text-slate-900 font-mono text-xs mt-0.5">{tile.todayScheduledCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium text-[10px]">Scanning</div>
                    <div className="font-bold text-emerald-600 font-mono text-xs mt-0.5">{tile.currentlyScanningCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium text-[10px]">Units</div>
                    <div className="font-bold text-slate-700 font-mono text-xs mt-0.5">
                      {tile.totalScanners === 0 ? '—' : `${tile.operationalScanners}/${tile.totalScanners}`}
                    </div>
                  </div>
                </div>

                {/* Utilization bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                    <span>Modality Load</span>
                    <span className="font-bold text-slate-800 font-mono">{tile.utilizationPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isHighLoad ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(tile.utilizationPercent, 100)}%` }}
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
