import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  UserPlus,
  CalendarCheck,
  ListOrdered,
  Scan,
  Database,
  FileCheck2,
  Receipt,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface StepDetail {
  id: string;
  stepNumber: number;
  title: string;
  role: string;
  patientIdRole: string;
  accessionRole: string;
  description: string;
  pacsRole: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function WorkflowVisualizer() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps: StepDetail[] = [
    {
      id: 'step-1',
      stepNumber: 1,
      title: 'Online Booking / Reception',
      role: 'RECEPTION',
      patientIdRole: 'CREATED: Persistent unique Patient ID (MRN) assigned to patient master index',
      accessionRole: 'PENDING: Awaiting specific physician examination order',
      pacsRole: 'Out of scope',
      description:
        'Patient presents for registration. System queries Master Patient Index (MPI) to prevent duplicates. A persistent Patient ID (e.g., PAT-2026-10001) is permanently locked to the demographic record.',
      icon: UserPlus,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      title: 'Scheduling & Order Creation',
      role: 'RECEPTION / NURSE',
      patientIdRole: 'ATTACHED: Linked as foreign key relation to appointment',
      accessionRole: 'CREATED: Unique Accession Number (ACC-20261105-XXXX) generated per study',
      pacsRole: 'Out of scope',
      description:
        'Physician places clinical order for CT/MRI/X-Ray. The order generates a collision-proof Accession Number. This Accession Number becomes the single source of truth connecting clinical indications, machine worklists, and diagnostic reports.',
      icon: CalendarCheck,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      title: 'Modality Worklist (MWL)',
      role: 'SYSTEM ORCHESTRATION',
      patientIdRole: 'BROADCAST: DICOM Tag (0010,0020) Patient ID',
      accessionRole: 'BROADCAST: DICOM Tag (0008,0050) Accession Number',
      pacsRole: 'DICOM C-FIND queries worklist from modalities',
      description:
        'The RIS serves scheduled orders to CT, MRI, and X-Ray modalities via DICOM Modality Worklist (MWL). The technologist selects the study directly at the scanner console without manual re-typing, preventing transcription errors.',
      icon: ListOrdered,
    },
    {
      id: 'step-4',
      stepNumber: 4,
      title: 'Technologist Acquisition',
      role: 'TECHNOLOGIST',
      patientIdRole: 'VERIFIED: Confirmed at scanner bedside with two identifiers',
      accessionRole: 'EMBEDDED: Written into DICOM header metadata for every acquired image',
      pacsRole: 'DICOM C-STORE push to PACS archive',
      description:
        'Technologist confirms pre-scan safety screening (renal function, implants, allergy checklist), administers contrast if required, performs acquisition, and triggers DICOM C-STORE transmission to PACS.',
      icon: Scan,
    },
    {
      id: 'step-5',
      stepNumber: 5,
      title: 'PACS Image Archive',
      role: 'PACS / DICOM STORAGE',
      patientIdRole: 'INDEXED: Matched against DICOM header',
      accessionRole: 'INDEXED: PACS indexes study instance under the exact Accession Number',
      pacsRole: 'Stores raw multi-frame DICOM slices & provides WADO-RS / OHIF Viewer streams',
      description:
        'DICOM imaging data remains safely stored in PACS or vendor-neutral archive (VNA). The RIS retains only workflow telemetry, instance counts, and PACs receipt confirmation, maintaining clean separation of concerns.',
      icon: Database,
    },
    {
      id: 'step-6',
      stepNumber: 6,
      title: 'Radiologist Diagnostic Reporting',
      role: 'RADIOLOGIST',
      patientIdRole: 'DISPLAYED: Patient medical history & prior studies correlated',
      accessionRole: 'LOCKED: Report created strictly bound to this unique Accession Number',
      pacsRole: 'RIS synchronizes viewport to PACS viewer using Accession/Study UID',
      description:
        'Radiologist claims examination from reporting worklist. Dictates technique, clinical findings, and impression. Electronic signature finalized with SHA-256 tamper-evident integrity hash.',
      icon: FileCheck2,
    },
    {
      id: 'step-7',
      stepNumber: 7,
      title: 'Billing & Report Delivery',
      role: 'BILLING / PATIENT DESK',
      patientIdRole: 'BILLED: Ledger item assigned to patient account',
      accessionRole: 'INVOICED: Order accession number itemized on clinical invoice',
      pacsRole: 'Patient portal or referring physician download',
      description:
        'Verified final diagnostic report is dispatched to referring physician and patient portal. Cashier invoices imaging order with automatic insurance/copay reconciliation.',
      icon: Receipt,
    },
  ];

  const currentStep = steps.find((s) => s.stepNumber === activeStep) || steps[0];

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Core RIS Workflow Pipeline</span>
              <Badge variant="cyan" className="text-[10px]">
                End-to-End Orchestration
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Visualizing the complete radiology trajectory from booking to finalized diagnostic delivery
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <ShieldAlert className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>Single Source of Truth: Patient ID & Accession Number</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step progression nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCurrent = step.stepNumber === activeStep;
            const isCompleted = step.stepNumber < activeStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.stepNumber)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-cyan-500 bg-cyan-50/80 ring-2 ring-cyan-500/20 shadow-xs'
                    : isCompleted
                    ? 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                      isCurrent
                        ? 'bg-cyan-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step.stepNumber}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Step {step.stepNumber}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? 'text-cyan-700' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold leading-tight truncate ${
                      isCurrent ? 'text-cyan-950' : 'text-slate-800'
                    }`}
                  >
                    {step.title.split('/')[0]}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">{step.role}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detailed Diagnostic Box */}
        {currentStep && (
          <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50/40 via-white to-slate-50 p-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="cyan" className="font-mono text-xs">
                    Stage {currentStep.stepNumber} of 7
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium">•</span>
                  <span className="text-xs font-semibold text-slate-700">
                    Responsible Role: {currentStep.role}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900">{currentStep.title}</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  {currentStep.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeStep <= 1}
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-white"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={activeStep >= 7}
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 text-xs font-semibold text-white hover:bg-cyan-700 flex items-center gap-1 disabled:opacity-40"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Traceability Metrics for this step */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-cyan-100">
              <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Patient ID (MRN) Traceability
                </span>
                <p className="text-xs text-slate-700 leading-snug">{currentStep.patientIdRole}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 flex items-center gap-1 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Accession Number Traceability
                </span>
                <p className="text-xs text-slate-700 leading-snug">{currentStep.accessionRole}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  PACS & Imaging Boundary
                </span>
                <p className="text-xs text-slate-700 leading-snug">{currentStep.pacsRole}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
