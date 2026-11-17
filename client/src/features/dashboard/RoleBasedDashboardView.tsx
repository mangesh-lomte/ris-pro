import { UserRole } from '../../types';
import { Card, CardContent } from '../../components/ui/card';
import { ShieldCheck, Stethoscope, Users, Cpu, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  userRole?: UserRole;
  userName?: string;
}

export function RoleBasedDashboardView({ userRole, userName }: Props) {
  if (userRole === 'RECEPTION') {
    return (
      <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Reception &amp; Intake Command</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                  Intake Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Operator: <span className="text-slate-800 font-semibold">{userName}</span> · Patient intake, arrival tokens, insurance verification, and triage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/reception"
              className="text-xs font-bold px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-soft"
            >
              <span>Open Front Desk Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userRole === 'TECHNOLOGIST') {
    return (
      <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Technologist Acquisition Console</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                  Acquisition Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Technologist: <span className="text-slate-800 font-semibold">{userName}</span> · Protocol execution, contrast safety screening, and Orthanc PACS transfer.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/technologist"
              className="text-xs font-bold px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-soft"
            >
              <span>Open Scanner Worklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userRole === 'RADIOLOGIST') {
    return (
      <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Diagnostic Reading Suite</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100/70 text-purple-800 border border-purple-200">
                  Reading Session Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Attending: <span className="text-slate-800 font-semibold">{userName}</span> · Unassigned study claims, OHIF viewer synchronization, and digital signature authorization.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/radiologist/worklist"
              className="text-xs font-bold px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-soft"
            >
              <span>Open Reading Worklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Admin View
  return (
    <Card className="rounded-3xl border border-[#dce6e0] bg-white shadow-soft overflow-hidden">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm">System Administration &amp; Governance</h4>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Administrator: <span className="text-slate-800 font-semibold">{userName}</span> · User provisioning, immutable clinical audit logs, and PACS infrastructure.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin"
            className="text-xs font-bold px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-soft"
          >
            <span>Administration Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
