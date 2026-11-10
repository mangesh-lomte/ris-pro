import { WorkflowVisualizer } from '../features/dashboard/WorkflowVisualizer';
import { DomainRuleDemo } from '../features/dashboard/DomainRuleDemo';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Network, Database, ShieldAlert } from 'lucide-react';

export function WorkflowPage() {
  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-base font-bold tracking-tight text-slate-900 mb-1">
          Radiology Information System (RIS) Architecture
        </h1>
        <p className="text-xs text-slate-500">
          Core orchestration workflow, single source of truth rules, and system boundaries
        </p>
      </div>

      {/* Main visualizer */}
      <WorkflowVisualizer />

      {/* Domain Rule Demo */}
      <DomainRuleDemo />

      {/* Architectural Separation: RIS vs PACS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-600" />
              <span>Role of the RIS (Workflow & Orchestration)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              The <strong>Radiology Information System (RIS)</strong> is the enterprise orchestrator for patient logistics, order scheduling, modality worklists, and diagnostic reporting.
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-700">
              <li>Generates and governs the persistent <strong>Patient ID (MRN)</strong>.</li>
              <li>Generates and governs the unique <strong>Accession Number</strong> per order.</li>
              <li>Feeds DICOM Modality Worklists (MWL) to CT, MRI, and X-Ray machines.</li>
              <li>Tracks exam timestamps: scheduled $\to$ arrived $\to$ in-scanner $\to$ acquired.</li>
              <li>Provides structured diagnostic dictation & attestation for Radiologists.</li>
              <li>Never stores binary DICOM pixel arrays directly in relational database.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Role of PACS / VNA (Imaging Archive)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              The <strong>Picture Archiving and Communication System (PACS)</strong> conceptually manages multi-slice binary pixel volumes, multi-planar reconstructions, and diagnostic displays.
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-700">
              <li>Receives DICOM C-STORE image pushes from CT/MRI scanners.</li>
              <li>Indexes study metadata matching the RIS Accession Number & Study UID.</li>
              <li>Provides DICOMweb WADO-RS streaming to high-resolution diagnostic viewers (e.g. OHIF Viewer).</li>
              <li>Manages hierarchical storage lifecycle (hot SSD cache to cold optical archive).</li>
              <li>Kept strictly separated from RIS relational database architecture.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Healthcare Compliance Principles */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>Healthcare Engineering Safety Standards</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Collision-Proof Accession</p>
              <p>Guaranteed unique numbering per order ensures exams cannot overwrite or contaminate prior studies.</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Tamper-Evident Reporting</p>
              <p>Once finalized by the attending Radiologist, reports cannot be silently modified without versioned addendums.</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">Audit Trail Logging</p>
              <p>Every clinical lifecycle mutation is logged with user ID, timestamp, and client IP metadata.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
