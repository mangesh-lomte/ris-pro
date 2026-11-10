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
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-[#152B42] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#174A70]" />
              <span>Critical Domain Rule: Single Source of Truth Engine</span>
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-500 mt-0.5">
              Strict identifier persistence across patient registration, orders, PACS, and diagnostic reports
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Patient ID Generator Card */}
          <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                1. Persistent Patient ID (MRN)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewPatientId}
                isLoading={loadingPatient}
                className="text-[11px] h-6 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Generate
              </Button>
            </div>
            <div className="mb-1.5">
              <IdentifierPill type="patient" value={patientId} />
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Assigned exactly once at initial patient registration. Remains permanently immutable across all subsequent visits and admissions.
            </p>
          </div>

          {/* Accession Number Generator Card */}
          <div className="rounded-md border border-[#174A70]/30 bg-[#174A70]/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#174A70]">
                2. Unique Accession Number
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewAccession}
                isLoading={loadingAccession}
                className="text-[11px] h-6 px-2 border-[#174A70]/40 text-[#174A70] hover:bg-[#174A70]/10"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Generate
              </Button>
            </div>
            <div className="mb-1.5">
              <IdentifierPill type="accession" value={accessionNumber} />
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Assigned per imaging examination order. Written into DICOM Tag (0008,0050) and bound to the Radiologist Report.
            </p>
          </div>
        </div>

        {/* Real-time Data Integrity Flow Demonstration */}
        <div className="rounded-md border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[11px] font-bold text-[#152B42] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Traceability Path for Current Identifiers</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-slate-200 text-slate-700 font-medium">
              Registration ({patientId})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-[#174A70]/30 text-[#174A70] font-medium">
              Order ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-[#174A70]/30 text-[#174A70] font-medium">
              Modality Worklist ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-indigo-200 text-indigo-800 font-medium">
              PACS Study ({accessionNumber})
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-emerald-300 text-emerald-800 font-medium">
              Report & Invoice ({accessionNumber})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

