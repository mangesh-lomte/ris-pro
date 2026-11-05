import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { generatePatientIdPreview } from '../../services/patientService';
import { generateAccessionPreview } from '../../services/orderService';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { KeyRound, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export function DomainRuleDemo() {
  const [patientId, setPatientId] = useState<string>('PAT-2026-10001');
  const [accessionNumber, setAccessionNumber] = useState<string>('ACC-20261105-CT01');
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadingAccession, setLoadingAccession] = useState(false);

  const handleNewPatientId = async () => {
    try {
      setLoadingPatient(true);
      const res = await generatePatientIdPreview();
      setPatientId(res.patientId);
    } catch {
      // Fallback generator
      const year = new Date().getFullYear();
      const rand = Math.floor(10000 + Math.random() * 90000);
      setPatientId(`PAT-${year}-${rand}`);
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleNewAccession = async () => {
    try {
      setLoadingAccession(true);
      const res = await generateAccessionPreview();
      setAccessionNumber(res.accessionNumber);
    } catch {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
      setAccessionNumber(`ACC-${dateStr}-${hex}`);
    } finally {
      setLoadingAccession(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-600" />
              <span>Critical Domain Rule: Single Source of Truth Engine</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Strict identifier persistence across patient registration, orders, PACS, and diagnostic reports
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patient ID Generator Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                1. Persistent Patient ID (MRN)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewPatientId}
                isLoading={loadingPatient}
                className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Generate New
              </Button>
            </div>
            <div className="mb-2">
              <IdentifierPill type="patient" value={patientId} />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Assigned exactly once at initial patient registration. Remains permanently immutable across all subsequent visits, appointments, and hospital admissions.
            </p>
          </div>

          {/* Accession Number Generator Card */}
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                2. Unique Accession Number
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewAccession}
                isLoading={loadingAccession}
                className="text-xs h-7 border-cyan-300 text-cyan-800 hover:bg-cyan-100"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Generate New
              </Button>
            </div>
            <div className="mb-2">
              <IdentifierPill type="accession" value={accessionNumber} />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Assigned per imaging examination order. Written into DICOM Tag (0008,0050) and bound to the Radiologist Report to prevent study mismatch errors.
            </p>
          </div>
        </div>

        {/* Real-time Data Integrity Flow Demonstration */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
            <span>Traceability Path for Current Identifiers</span>
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-white px-2.5 py-1 font-mono text-[11px] border border-slate-200 text-slate-700 font-medium">
              Registration ({patientId})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2.5 py-1 font-mono text-[11px] border border-cyan-300 text-cyan-800 font-medium">
              Order ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2.5 py-1 font-mono text-[11px] border border-cyan-300 text-cyan-800 font-medium">
              Modality Worklist ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2.5 py-1 font-mono text-[11px] border border-indigo-300 text-indigo-800 font-medium">
              PACS Study ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2.5 py-1 font-mono text-[11px] border border-emerald-300 text-emerald-800 font-medium">
              Report & Invoice ({accessionNumber})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
