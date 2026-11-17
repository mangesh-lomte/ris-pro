import React from 'react';
import {
  Activity,
  Database,
  Server,
  Layers,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { IntegrationHealth } from '../../services/adminService';

interface IntegrationHealthTabProps {
  healthData: IntegrationHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

export const IntegrationHealthTab: React.FC<IntegrationHealthTabProps> = ({
  healthData,
  loading,
  onRefresh,
}) => {
  if (!healthData) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center space-y-3">
        <p className="text-slate-500 text-sm">Integration telemetry is currently loading or unavailable.</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Poll Integration Health
        </button>
      </div>
    );
  }

  const isHealthy = healthData.status === 'HEALTHY';

  return (
    <div className="space-y-6">
      {/* Overall Integration Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              isHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Healthcare Communication Interfaces Posture</h2>
            <p className="text-xs text-slate-500">
              Live operational connectivity for clinical database, PACS, imaging modalities & HL7 gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isHealthy
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
            {isHealthy ? 'All Systems Operational' : 'Degraded Posture'}
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid of 4 Core Healthcare Interfaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. PostgreSQL Database */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-[#2563EB]" />
              {healthData.interfaces?.database?.name || 'PostgreSQL Clinical Database'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                healthData.interfaces?.database?.status === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Operational
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <strong>Interface Engine:</strong> {healthData.interfaces?.database?.type || 'Prisma ORM / PostgreSQL 16'}
            </p>
            <p className="flex items-center gap-1 text-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <strong>Round-Trip Latency:</strong>{' '}
              <span className="font-mono font-semibold text-emerald-700">
                {healthData.interfaces?.database?.latencyMs ?? 1} ms
              </span>
            </p>
            <p className="text-slate-500 text-[11px] pt-1">
              Primary transactional authority for Patient Master Index, Orders & Reports.
            </p>
          </div>
        </div>

        {/* 2. Orthanc PACS */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-[#2563EB]" />
              {healthData.interfaces?.pacs?.name || 'Orthanc DICOM PACS'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                healthData.interfaces?.pacs?.status === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Operational
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <strong>DICOM AET Title:</strong>{' '}
              <span className="font-mono font-bold text-blue-700">
                {String(healthData.interfaces?.pacs?.details?.dicomAet || 'ORTHANC')}
              </span>
            </p>
            <p>
              <strong>DICOM Port:</strong>{' '}
              <span className="font-mono text-slate-800">
                {String(healthData.interfaces?.pacs?.details?.dicomPort || '4242')}
              </span>{' '}
              | <strong>HTTP REST:</strong> <span className="font-mono text-slate-800">8042</span>
            </p>
            <p className="text-slate-500 text-[11px] pt-1">
              Stores raw multi-slice DICOM series. Pixel streaming to OHIF Viewer v3.
            </p>
          </div>
        </div>

        {/* 3. Imaging Modalities */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#2563EB]" />
              {healthData.interfaces?.modalities?.name || 'Modality Scanners (CT / MRI / X-Ray / US)'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Ready
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <strong>Configured Scanners:</strong>{' '}
              <span className="font-mono font-bold text-slate-900">
                {healthData.interfaces?.modalities?.configuredCount ?? 4} units online
              </span>
            </p>
            <p>
              <strong>Protocol Gateway:</strong> {healthData.interfaces?.modalities?.type || 'DICOM Modality Worklist (MWL) & MPPS'}
            </p>
            <p className="text-slate-500 text-[11px] pt-1">
              Supports automated patient demographic feed to console avoiding technician retyping.
            </p>
          </div>
        </div>

        {/* 4. HL7 / FHIR Interoperability Gateway */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2563EB]" />
              {healthData.interfaces?.hl7_fhir?.name || 'HIS / EMR Interoperability Gateway'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Ready
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <strong>Integration Endpoint:</strong>{' '}
              <span className="font-mono text-slate-800">
                {healthData.interfaces?.hl7_fhir?.endpoint || '/api/v1/integration/hl7/message'}
              </span>
            </p>
            <p>
              <strong>Standards Support:</strong>{' '}
              <span className="font-semibold text-slate-900">
                {healthData.interfaces?.hl7_fhir?.type || 'HL7 v2.5 (ORM, ORU, ADT) & FHIR R4'}
              </span>
            </p>
            <p className="text-slate-500 text-[11px] pt-1">
              Inbound patient admissions & outbound final diagnostic report delivery to Hospital EMR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
