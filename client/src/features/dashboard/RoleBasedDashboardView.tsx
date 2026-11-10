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
      <Card className="border-slate-200/90 bg-white shadow-2xs rounded-lg">
        <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#33398A] text-white shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-[#15233B] text-sm">Reception & Front Desk Command View</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  Intake Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Welcome, {userName}. Patient intake, arrival check-in tokens, report handovers, and patient portal downloads.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/reception"
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#33398A] text-white hover:bg-[#282D6E] transition-colors flex items-center gap-1.5 shadow-xs"
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
      <Card className="border-slate-200/90 bg-white shadow-2xs rounded-lg">
        <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#33398A] text-white shrink-0 shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-[#15233B] text-sm">Technologist Modality Acquisition Workspace</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
                  Acquisition Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Welcome, {userName}. Modality queues, protocol selection, scan execution, and Orthanc PACS transfers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/technologist"
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#33398A] text-white hover:bg-[#282D6E] transition-colors flex items-center gap-1.5 shadow-xs"
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
      <Card className="border-[#DCE2EC] bg-white shadow-card rounded-xl">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#33398A] text-white shrink-0 shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-[#15233B] text-sm">Radiologist Diagnostic Workspace</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  PACS Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Welcome, {userName}. Prioritized unreported studies, voice dictation, OHIF viewer, and digital signatures.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/radiologist/worklist"
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#33398A] text-white hover:bg-[#282D6E] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Open Diagnostic Worklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Admin default
  return (
    <Card className="border-[#DCE2EC] bg-white shadow-card rounded-xl">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#33398A] text-white shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[#15233B] text-sm">Executive Clinical Administration View</h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Clinical Governance Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Welcome, {userName}. Comprehensive departmental overview, cross-functional clinical flow, audit compliance, and revenue intelligence.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin"
            className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#33398A] text-white hover:bg-[#282D6E] transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>Administration Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
