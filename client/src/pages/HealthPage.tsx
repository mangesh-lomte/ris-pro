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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              System & Database Health Diagnostics
            </h1>
            <Badge variant="cyan" className="font-mono text-xs">
              GET /api/v1/health
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Real-time status check for Node.js REST API server and PostgreSQL database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </Button>
          <Button
            variant={showRawJson ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showRawJson ? 'Hide JSON' : 'View Raw JSON'}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
            <p className="text-xs text-slate-500">Pinging backend health endpoint...</p>
          </div>
        </div>
      ) : isError || !health ? (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-rose-900">Backend Server Unreachable</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">
              Could not connect to `/api/v1/health` at `http://localhost:5000`. Ensure the backend server is running.
            </p>
            <Button variant="destructive" size="sm" onClick={() => refetch()}>
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Health Status Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    health.status === 'healthy'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}
                >
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Application Status
                  </p>
                  <p className="text-xl font-bold capitalize text-slate-900 mt-0.5">
                    {health.status}
                  </p>
                  <Badge
                    variant={health.status === 'healthy' ? 'success' : 'destructive'}
                    className="mt-1 text-[10px]"
                  >
                    HTTP 200 OK
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    health.database.connected
                      ? 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}
                >
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    PostgreSQL Database
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {health.database.connected ? 'Connected' : 'Disconnected'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Latency: {health.database.responseTimeMs ?? 'N/A'} ms
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    System Uptime
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {formatUptime(health.uptimeSeconds)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Env: <span className="font-semibold uppercase">{health.environment}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Diagnostic Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Info */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-600" />
                  <span>Node.js Runtime Environment</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Node Version</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {health.system.nodeVersion}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Platform OS</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {health.system.platform}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">RIS Release Version</span>
                  <span className="font-semibold text-slate-800">{health.version}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Diagnostic Timestamp</span>
                  <span className="font-mono text-slate-600">
                    {formatDateTime(health.timestamp)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span>Server Memory Utilization</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Resident Set Size (RSS)</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {health.system.memoryUsageMb.rss} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">V8 Heap Total</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {health.system.memoryUsageMb.heapTotal} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">V8 Heap Used</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {health.system.memoryUsageMb.heapUsed} MB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Heap Utilization</span>
                  <span className="font-semibold text-slate-800">
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

          {/* Raw JSON viewer */}
          {showRawJson && (
            <Card className="border-slate-300 bg-slate-900 text-slate-100 shadow-md">
              <CardHeader className="pb-2 border-b border-slate-800">
                <CardTitle className="text-xs font-mono text-cyan-400">
                  Response Payload: GET /api/v1/health
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <pre className="font-mono text-xs overflow-x-auto text-emerald-400 leading-relaxed">
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
