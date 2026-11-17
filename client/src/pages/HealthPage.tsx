import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../services/healthService';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { formatUptime, formatDateTime } from '../utils/formatters';
import { SystemHealthData } from '../types';
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  Cpu,
  Clock,
  Code2,
} from 'lucide-react';

export function HealthPage() {
  const [showRawJson, setShowRawJson] = useState(false);

  const {
    data: health,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<SystemHealthData>({
    queryKey: ['systemHealthDetails'],
    queryFn: fetchHealth,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="rounded-3xl border border-[#dce6e0] bg-white p-5 md:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Infrastructure Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            System &amp; Database Health Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time status check for Node.js REST API server and PostgreSQL database
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5 rounded-full border-[#dce6e0] bg-white hover:bg-slate-50 shadow-soft"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-emerald-500' : ''}`} />
            <span>Refresh Telemetry</span>
          </Button>
          <Button
            variant={showRawJson ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs gap-1.5 rounded-full shadow-soft"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showRawJson ? 'Hide JSON' : 'View Raw JSON'}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[#dce6e0] bg-white shadow-soft">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500">Pinging backend health endpoint...</p>
          </div>
        </div>
      ) : isError || !health ? (
        <Card className="border-rose-200 bg-rose-50/60 rounded-3xl shadow-soft">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm">
              <Activity className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-extrabold text-rose-950">Backend Server Unreachable</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
              Could not connect to `/api/v1/health` at `http://localhost:5000`. Ensure the backend server is running.
            </p>
            <Button variant="destructive" size="sm" onClick={() => refetch()} className="rounded-full shadow-soft font-bold">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Operational Services Summary (Primary View) */}
          <section className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Operational Services Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-[#e8f7f0] to-white p-5 shadow-soft flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                    health.status === 'healthy'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Application Status
                  </p>
                  <p className="text-xl font-extrabold capitalize text-slate-900 mt-0.5">
                    {health.status}
                  </p>
                  <Badge
                    variant={health.status === 'healthy' ? 'success' : 'destructive'}
                    className="mt-1 text-[10px] py-0 px-2 rounded-full font-bold"
                  >
                    HTTP 200 OK
                  </Badge>
                </div>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-[#eaf4fd] to-white p-5 shadow-soft flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                    health.database.connected
                      ? 'bg-sky-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    PostgreSQL Database
                  </p>
                  <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {health.database.connected ? 'Connected' : 'Disconnected'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1 tabular-nums font-semibold">
                    Latency: {health.database.responseTimeMs ?? 'N/A'} ms
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-[#fef5e9] to-white p-5 shadow-soft flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    System Uptime
                  </p>
                  <p className="text-xl font-extrabold text-slate-900 mt-0.5 font-mono tabular-nums">
                    {formatUptime(health.uptimeSeconds)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold flex items-center gap-1.5">
                    <span>Env:</span>
                    <span className="font-bold text-slate-700 uppercase">{health.environment}</span>
                    {health.appEnv && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {health.appEnv.toUpperCase()} DEMO
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Secondary: Technical Diagnostics & Runtime Internals */}
          <section className="space-y-3 pt-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Technical Diagnostics & Runtime Internals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* System Info */}
            <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-sky-50 text-sky-600">
                    <Server className="w-4 h-4" />
                  </div>
                  <span>Node.js Runtime Environment</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Node Version</span>
                  <span className="font-mono font-bold text-slate-800 tabular-nums">
                    {health.system.nodeVersion}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Platform OS</span>
                  <span className="font-mono font-bold text-slate-800">
                    {health.system.platform}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">RIS Release Version</span>
                  <span className="font-bold text-slate-800">{health.version}</span>
                </div>
                {health.commit && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Deployed Commit</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                      {health.commit}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Diagnostic Timestamp</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {formatDateTime(health.timestamp)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span>Server Memory Utilization</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Resident Set Size (RSS)</span>
                  <span className="font-mono font-bold text-slate-800 tabular-nums">
                    {health.system.memoryUsageMb.rss} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">V8 Heap Total</span>
                  <span className="font-mono font-bold text-slate-800 tabular-nums">
                    {health.system.memoryUsageMb.heapTotal} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">V8 Heap Used</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {health.system.memoryUsageMb.heapUsed} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Heap Utilization</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    {Math.round(
                      (health.system.memoryUsageMb.heapUsed /
                        health.system.memoryUsageMb.heapTotal) *
                        100
                    )}
                    %
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          </section>

          {/* Raw JSON viewer */}
          {showRawJson && (
            <Card className="rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-soft">
              <CardHeader className="p-5 pb-3 border-b border-slate-800">
                <CardTitle className="text-xs font-mono text-emerald-400">
                  Response Payload: GET /api/v1/health
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <pre className="font-mono text-xs overflow-x-auto text-emerald-300 leading-relaxed">
                  {JSON.stringify(health, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
