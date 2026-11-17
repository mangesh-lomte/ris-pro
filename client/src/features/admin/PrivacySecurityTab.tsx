import React from 'react';
import {
  Lock,
  ShieldCheck,
  KeyRound,
  FileCheck2,
  RefreshCw,
  Users,
  Server,
  CheckCircle2
} from 'lucide-react';
import { SecurityOverview } from '../../services/adminService';

interface PrivacySecurityTabProps {
  securityData: SecurityOverview | null;
  loading: boolean;
  onRefresh: () => void;
}

export const PrivacySecurityTab: React.FC<PrivacySecurityTabProps> = ({
  securityData,
  loading,
  onRefresh,
}) => {
  if (!securityData) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center space-y-3">
        <p className="text-slate-500 text-sm">Security posture data is currently unavailable.</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Retry Security Telemetry
        </button>
      </div>
    );
  }

  const controls = securityData.controls;
  const activeControls = securityData.activeSecurityControls;
  const userMetrics = securityData.userMetrics;
  const auditMetrics = securityData.auditMetrics;

  const passwordHashing =
    controls?.authentication?.type ||
    activeControls?.passwordHashing ||
    'JWT + bcrypt (12 rounds)';

  const jwtExpiry = controls?.authentication?.tokenExpiryHours
    ? `${controls.authentication.tokenExpiryHours * 60} minutes (${controls.authentication.tokenExpiryHours} hours)`
    : activeControls?.jwtExpiryMinutes
    ? `${activeControls.jwtExpiryMinutes} minutes`
    : '480 minutes (8 hours)';

  const totalUsers = userMetrics?.totalUsers ?? 0;
  const activeUsers = userMetrics?.activeUsers ?? 0;
  const disabledUsers = userMetrics?.deactivatedUsers ?? userMetrics?.disabledUsers ?? 0;

  // Build normalized role counts array
  const roleList: Array<{ role: string; count: number }> = [];
  if (Array.isArray(userMetrics?.roleDistribution)) {
    for (const item of userMetrics.roleDistribution) {
      roleList.push(item);
    }
  } else if (userMetrics?.byRole && typeof userMetrics.byRole === 'object') {
    for (const [role, count] of Object.entries(userMetrics.byRole)) {
      roleList.push({ role, count });
    }
  }

  const totalAudits = auditMetrics?.totalAuditsLogged ?? auditMetrics?.totalEventsLogged ?? 0;
  const lastLogin = auditMetrics?.lastLoginEvent
    ? new Date(auditMetrics.lastLoginEvent).toLocaleString('en-IN')
    : 'Active clinical sessions';

  return (
    <div className="space-y-6">
      {/* Top 4 Active Security Controls Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. RBAC */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Access Control
              </span>
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                RBAC Enforcement
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Strict server-side role gating on all clinical endpoints across 4 distinct roles.
          </p>
        </div>

        {/* 2. Password & Credential Encryption */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Credentials
              </span>
              <p className="text-sm font-bold text-blue-700 font-mono">
                {passwordHashing}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Salted password hashing with zero plaintext credential storage or leakage in DOM.
          </p>
        </div>

        {/* 3. Mandatory Share Verification */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recipient Security
              </span>
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Mandatory OTP
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            External diagnostic links require multi-factor OTP verification for report & study access.
          </p>
        </div>

        {/* 4. Audit Trail Integrity */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Audit Trail
              </span>
              <p className="text-sm font-bold text-blue-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                Tamper-Evident Ledger
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Continuous database-level audit recording of all clinical views, merges, and reports.
          </p>
        </div>
      </div>

      {/* Security Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Accounts by Role */}
        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2563EB]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Staff Role Allocation & Active Accounts
                </h3>
                <p className="text-xs text-slate-500">
                  Total Accounts: {totalUsers} ({activeUsers} active, {disabledUsers} disabled)
                </p>
              </div>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
              title="Refresh security metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2.5">
            {roleList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No role metrics available.</p>
            ) : (
              roleList.map((item) => (
                <div
                  key={item.role}
                  className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200/80 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{item.role}</span>
                    <span className="text-xs text-slate-500">
                      {item.role === 'ADMIN' && '• System Governance & Policy'}
                      {item.role === 'RADIOLOGIST' && '• Diagnostic Interpretation & Sign-off'}
                      {item.role === 'TECHNOLOGIST' && '• Protocol Acquisition & QC'}
                      {item.role === 'RECEPTION' && '• Patient Registration & Cashier'}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold font-mono">
                    {item.count} accounts
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Trail & Session Security */}
        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Server className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Audit Trail Telemetry & Session Policy
              </h3>
              <p className="text-xs text-slate-500">Real-time governance activity</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Total Audit Events</span>
              <p className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
                {totalAudits}
              </p>
              <span className="text-[11px] text-slate-400">All-time database logs</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Last Authentication Event</span>
              <p className="text-sm font-semibold text-emerald-700 font-mono mt-1 truncate">
                {lastLogin}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">Verified system login</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-medium">JWT Session Token Expiry:</span>
              <span className="font-mono font-semibold">{jwtExpiry}</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-medium">Transport Layer Security (TLS):</span>
              <span className="font-semibold text-emerald-700">
                TLS Ready (Encrypted Transport)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-medium">Single Source of Truth:</span>
              <span className="font-semibold text-slate-900">PostgreSQL Immutable Patient ID & Accession</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
