import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { technologistService } from '../../services/technologistService';
import { calculateAge, formatDate } from '../../utils/formatters';
import { ApiError } from '../../lib/api';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Stethoscope,
  Loader2,
} from 'lucide-react';

interface TechnologistSafetyScreeningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onSuccess?: () => void;
}

type AnswerOption = 'YES' | 'NO' | 'UNKNOWN' | 'NOT_APPLICABLE';

export function TechnologistSafetyScreeningModal({
  open,
  onOpenChange,
  examId,
  onSuccess,
}: TechnologistSafetyScreeningModalProps) {
  const queryClient = useQueryClient();

  // Load existing safety screening & exam context
  const { data: context, isLoading, error } = useQuery({
    queryKey: ['technologist', 'safety-screening', examId],
    queryFn: () => (examId ? technologistService.getSafetyScreening(examId) : null),
    enabled: !!examId && open,
  });

  // Form State
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityVerificationMethod, setIdentityVerificationMethod] = useState(
    'WRISTBAND_AND_VERBAL'
  );
  const [safetyNotes, setSafetyNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, AnswerOption>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Sync state when context loads
  useEffect(() => {
    if (context?.screening) {
      setIdentityVerified(context.screening.identityVerified);
      setIdentityVerificationMethod(
        context.screening.identityVerificationMethod || 'WRISTBAND_AND_VERBAL'
      );
      setSafetyNotes(context.screening.safetyNotes || '');
      setAnswers((context.screening.answers as Record<string, AnswerOption>) || {});
    } else if (context) {
      // Default clean answers for convenience based on modality
      setIdentityVerified(false);
      setIdentityVerificationMethod('WRISTBAND_AND_VERBAL');
      setSafetyNotes('');
      setAnswers({});
    }
  }, [context]);

  const setQuestionAnswer = (key: string, value: AnswerOption) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Live evaluation logic for client feedback preview
  const evaluateLiveRisks = () => {
    if (!context) return { risks: [], cautions: [], isCleared: false };
    const risks: string[] = [];
    const cautions: string[] = [];

    if (!identityVerified) {
      risks.push('Patient identity has not been confirmed using at least 2 clinical identifiers.');
    }

    if (context.modality === 'MRI') {
      if (answers.mri_pacemaker === 'YES' || answers.mri_pacemaker === 'UNKNOWN') {
        risks.push('Implanted cardiac device concern reported (pacemaker/ICD). Requires clinical review.');
      }
      if (answers.mri_aneurysm_clip === 'YES' || answers.mri_aneurysm_clip === 'UNKNOWN') {
        risks.push('Cerebral aneurysm clip concern reported. Requires clinical review.');
      }
      if (answers.mri_cochlear_implant === 'YES' || answers.mri_cochlear_implant === 'UNKNOWN') {
        risks.push('Cochlear implant or auditory device concern reported. Requires clinical review.');
      }
      if (answers.mri_neurostimulator === 'YES' || answers.mri_neurostimulator === 'UNKNOWN') {
        risks.push('Neurostimulator or electronic implant concern reported. Requires clinical review.');
      }
      if (answers.mri_infusion_pump === 'YES' || answers.mri_infusion_pump === 'UNKNOWN') {
        risks.push('Implanted infusion pump or catheter concern reported. Requires clinical review.');
      }
      if (answers.mri_metal_in_eyes === 'YES' || answers.mri_metal_in_eyes === 'UNKNOWN') {
        risks.push('Metallic fragment in eyes concern reported. Requires clinical review.');
      }
      if (answers.mri_pregnancy === 'YES' || answers.mri_pregnancy === 'UNKNOWN') {
        risks.push('Potential pregnancy reported. Requires clinical review.');
      }
      if (context.contrastRequired) {
        if (answers.mri_contrast_allergy === 'YES') {
          risks.push('Prior contrast allergy or adverse reaction history reported. Requires clinical review.');
        }
        if (answers.mri_renal_disease === 'YES' || answers.mri_renal_disease === 'UNKNOWN') {
          risks.push('Renal-risk history reported with contrast examination requested. Requires clinical review.');
        }
      }
      if (answers.mri_implants_other === 'YES') {
        cautions.push('Other metallic implant history noted. Verify implant safety before scanning.');
      }
      if (answers.mri_claustrophobia === 'YES') {
        cautions.push('Patient reported history of claustrophobia.');
      }
    } else if (context.modality === 'CT') {
      if (answers.ct_pregnancy === 'YES' || answers.ct_pregnancy === 'UNKNOWN') {
        risks.push('Potential pregnancy reported for ionizing radiation examination. Requires clinical review.');
      }
      if (context.contrastRequired) {
        if (answers.ct_contrast_allergy === 'YES') {
          risks.push('Prior contrast allergy or adverse reaction history reported. Requires clinical review.');
        }
        if (answers.ct_renal_disease === 'YES' || answers.ct_renal_disease === 'UNKNOWN') {
          risks.push('Renal-risk history reported with contrast examination requested. Requires clinical review.');
        }
      }
      if (answers.ct_metformin === 'YES') {
        cautions.push('Patient reported taking Metformin.');
      }
      if (answers.ct_asthma_allergies === 'YES') {
        cautions.push('Patient reported history of asthma or allergies.');
      }
    } else if (context.modality === 'XRAY') {
      if (answers.xray_pregnancy === 'YES' || answers.xray_pregnancy === 'UNKNOWN') {
        risks.push('Potential pregnancy reported for ionizing radiation examination. Requires clinical review.');
      }
    }

    const isCleared = identityVerified && risks.length === 0;
    return { risks, cautions, isCleared };
  };

  const { risks, cautions, isCleared } = evaluateLiveRisks();

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.saveSafetyScreening(examId, {
        identityVerified,
        identityVerificationMethod,
        safetyNotes: safetyNotes.trim() || undefined,
        answers: answers as Record<string, string>,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'safety-screening', examId] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'preparation', examId] });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const isConflict =
        (err instanceof ApiError && err.statusCode === 409) ||
        (err as { statusCode?: number })?.statusCode === 409;
      if (isConflict) {
        setSubmissionError('This workflow changed in another session. Refreshing current status.');
        queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
        queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
        queryClient.invalidateQueries({ queryKey: ['technologist', 'safety-screening', examId] });
      } else {
        setSubmissionError(err instanceof Error ? err.message : 'Failed to save safety screening');
      }
    },
  });

  if (!open || !examId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Patient Identity & Modality Safety Screening</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clinical Pre-Acquisition Safety Gate
                </p>
              </div>
            </div>
            {context?.screening?.safetyStatus ? (
              <Badge
                variant={
                  context.screening.safetyStatus === 'CLEARED'
                    ? 'success'
                    : context.screening.safetyStatus === 'REQUIRES_REVIEW'
                    ? 'destructive'
                    : 'warning'
                }
                className="font-semibold text-xs tracking-wide"
              >
                {context.screening.safetyStatus.replace(/_/g, ' ')}
              </Badge>
            ) : (
              <Badge variant="cyan" className="font-semibold text-xs tracking-wide">
                SCREENING REQUIRED
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-20 bg-slate-100 rounded animate-pulse" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : error || !context ? (
          <div className="p-6 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-semibold">Unable to load safety screening context</p>
            <p className="text-xs text-slate-500">
              {error instanceof Error ? error.message : 'Exam record not found or inaccessible.'}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Core Patient & Accession Identifiers (Immutable) */}
            <div className="p-4 bg-slate-900 text-white rounded shadow-sm border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Clinical Identifiers (Single Source of Truth)</span>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED RECORD
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3 rounded border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Patient Identification (MRN)
                  </span>
                  <div className="flex items-center gap-2">
                    <IdentifierPill type="patient" value={context.patient.patientId} />
                    <span className="text-xs text-slate-200 font-semibold truncate">
                      {context.patient.firstName} {context.patient.lastName} (
                      {calculateAge(context.patient.dateOfBirth)}y, {context.patient.gender})
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Order Accession Number
                  </span>
                  <div className="flex items-center gap-2">
                    <IdentifierPill type="accession" value={context.accessionNumber} />
                    <Badge variant="outline" className="text-cyan-300 border-cyan-800 text-[10px] font-bold">
                      {context.modality}
                    </Badge>
                    <PriorityBadge priority={context.priority} />
                  </div>
                </div>
              </div>
            </div>

            {context.patientPreVisitScreening && (
              <div
                role="alert"
                className={`rounded border p-4 ${
                  context.patientPreVisitScreening.status === 'REQUIRES_TECH_REVIEW'
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-[#E2E8F0] bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold">Patient pre-visit questionnaire</p>
                    <p className="mt-1 text-xs">
                      {context.patientPreVisitScreening.status === 'REQUIRES_TECH_REVIEW'
                        ? 'The patient reported potential risk factors. Review them in person before completing the authoritative safety screen.'
                        : 'The patient reported no risk factors. Complete the in-person safety screen before acquisition.'}
                    </p>
                    {!!context.patientPreVisitScreening.risksIdentified?.length && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-semibold">
                        {context.patientPreVisitScreening.risksIdentified.map((risk) => (
                          <li key={risk}>{risk.replace(/_/g, ' ')}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: Bedside Patient Double-Identity Verification */}
            <div className="border border-blue-200 bg-blue-50/50 rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
                <UserCheck className="w-4 h-4 text-blue-700" />
                <span>1. Patient Identity Verification (Mandatory Double-ID)</span>
              </div>

              <div className="bg-white p-3.5 rounded border border-indigo-100 shadow-xs space-y-3">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-[#2563EB] focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">
                      I have verified this patient's identity using at least two independent identifiers.
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Confirmed against patient wristband barcode, photo identification, or verbal confirmation of Full Name and Date of Birth ({formatDate(context.patient.dateOfBirth)}).
                    </span>
                  </div>
                </label>

                {identityVerified && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Verification Method:</span>
                    <select
                      value={identityVerificationMethod}
                      onChange={(e) => setIdentityVerificationMethod(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 font-medium focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="WRISTBAND_AND_VERBAL">Wristband Barcode + Verbal Name & DOB</option>
                      <option value="GOVT_PHOTO_ID_AND_DOB">Government Photo ID + Verbal DOB</option>
                      <option value="MRN_CARD_AND_NAME">Hospital ID Card (MRN) + Verbal Full Name</option>
                      <option value="BIOMETRIC_AND_VERBAL">Biometric Verification + Verbal Confirmation</option>
                      <option value="OTHER_TWO_POINT_VERIFIED">Other Verified 2-Point Healthcare Method</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Clinical Indication Review (Read-Only) */}
            <div className="border border-[#E2E8F0] bg-white rounded p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-800 font-semibold text-xs border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>2. Clinical Context & Indication Review</span>
                </div>
                {context.contrastRequired ? (
                  <Badge variant="warning" className="text-[10px]">
                    IV CONTRAST REQUIRED
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-600">
                    NON-CONTRAST EXAM
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Procedure</span>
                  <span className="font-semibold text-slate-800">{context.examinationName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Target Anatomical Region</span>
                  <span className="font-medium text-slate-700">{context.bodyPart}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase">Ordering Clinical Indication</span>
                  <p className="font-medium text-amber-950 bg-amber-50 p-2.5 rounded border border-amber-200/70 mt-1 leading-relaxed">
                    {context.clinicalIndication}
                  </p>
                </div>
                {context.referringDoctor && (
                  <div className="sm:col-span-2 text-slate-600 flex items-center gap-1.5 text-[11px]">
                    <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ordering Physician: {context.referringDoctor}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Modality-Specific Safety Screening Checklist */}
            <div className="border border-[#E2E8F0] bg-white rounded p-4 space-y-4">
              <div className="flex items-center justify-between text-slate-800 font-semibold text-xs border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-slate-600" />
                  <span>3. {context.modality} Modality Safety Screening Checklist</span>
                </div>
                <span className="text-[11px] text-slate-500">All questions required</span>
              </div>

              <div className="space-y-3">
                {/* MRI Questionnaire */}
                {context.modality === 'MRI' && (
                  <>
                    <QuestionRow
                      title="Cardiac pacemaker or implantable cardioverter defibrillator (ICD)?"
                      subtitle="Absolute contraindication without verified MR-conditional protocol"
                      name="mri_pacemaker"
                      value={answers.mri_pacemaker}
                      onChange={(val) => setQuestionAnswer('mri_pacemaker', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Ferromagnetic cerebral aneurysm clip?"
                      subtitle="High hazard of clip displacement or torque"
                      name="mri_aneurysm_clip"
                      value={answers.mri_aneurysm_clip}
                      onChange={(val) => setQuestionAnswer('mri_aneurysm_clip', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Cochlear implant or implanted auditory device?"
                      subtitle="Risk of magnet displacement or device damage"
                      name="mri_cochlear_implant"
                      value={answers.mri_cochlear_implant}
                      onChange={(val) => setQuestionAnswer('mri_cochlear_implant', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Neurostimulator, deep brain stimulator (DBS), or spinal cord stimulator?"
                      subtitle="Risk of RF-induced thermal injury and device malfunction"
                      name="mri_neurostimulator"
                      value={answers.mri_neurostimulator}
                      onChange={(val) => setQuestionAnswer('mri_neurostimulator', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Implanted drug infusion pump, reservoir, or programmable catheter?"
                      subtitle="Requires manufacturer MR compatibility clearance"
                      name="mri_infusion_pump"
                      value={answers.mri_infusion_pump}
                      onChange={(val) => setQuestionAnswer('mri_infusion_pump', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="History of metal fragments, welding, or shrapnel injury to eyes?"
                      subtitle="Risk of intraocular metallic foreign body movement"
                      name="mri_metal_in_eyes"
                      value={answers.mri_metal_in_eyes}
                      onChange={(val) => setQuestionAnswer('mri_metal_in_eyes', val)}
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Possibility of pregnancy?"
                      subtitle="Acoustic noise and RF deposition risk during organogenesis"
                      name="mri_pregnancy"
                      value={answers.mri_pregnancy}
                      onChange={(val) => setQuestionAnswer('mri_pregnancy', val)}
                      includeNotApplicable
                      highRisk="YES"
                    />
                    <QuestionRow
                      title="Other metallic implants, stents, surgical clips, or joint replacements?"
                      subtitle="Technologist will confirm implant model and conditionality"
                      name="mri_implants_other"
                      value={answers.mri_implants_other}
                      onChange={(val) => setQuestionAnswer('mri_implants_other', val)}
                    />
                    <QuestionRow
                      title="History of severe claustrophobia?"
                      subtitle="Consider wide-bore unit or technologist communication reassurance"
                      name="mri_claustrophobia"
                      value={answers.mri_claustrophobia}
                      onChange={(val) => setQuestionAnswer('mri_claustrophobia', val)}
                    />

                    {context.contrastRequired && (
                      <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>IV Gadolinium Contrast Safety Checks</span>
                        </div>
                        <QuestionRow
                          title="Prior allergic or anaphylactoid reaction to MRI Gadolinium contrast?"
                          subtitle="Previous hives, bronchospasm, or severe reaction"
                          name="mri_contrast_allergy"
                          value={answers.mri_contrast_allergy}
                          onChange={(val) => setQuestionAnswer('mri_contrast_allergy', val)}
                          highRisk="YES"
                        />
                        <QuestionRow
                          title="History of renal disease, dialysis, or known renal dysfunction?"
                          subtitle="Documented for clinical evaluation before contrast administration"
                          name="mri_renal_disease"
                          value={answers.mri_renal_disease}
                          onChange={(val) => setQuestionAnswer('mri_renal_disease', val)}
                          highRisk="YES"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* CT Questionnaire */}
                {context.modality === 'CT' && (
                  <>
                    <QuestionRow
                      title="Possibility of pregnancy?"
                      subtitle="Ionizing radiation exposure to developing fetus requires justification"
                      name="ct_pregnancy"
                      value={answers.ct_pregnancy}
                      onChange={(val) => setQuestionAnswer('ct_pregnancy', val)}
                      includeNotApplicable
                      highRisk="YES"
                    />

                    {context.contrastRequired && (
                      <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>IV Iodinated Contrast Safety Checks</span>
                        </div>
                        <QuestionRow
                          title="Prior allergic or anaphylactoid reaction to IV iodinated contrast?"
                          subtitle="Requires clinical premedication protocol (steroids/antihistamines)"
                          name="ct_contrast_allergy"
                          value={answers.ct_contrast_allergy}
                          onChange={(val) => setQuestionAnswer('ct_contrast_allergy', val)}
                          highRisk="YES"
                        />
                        <QuestionRow
                          title="History of renal insufficiency, kidney disease, or dialysis?"
                          subtitle="Documented for clinical evaluation before contrast administration"
                          name="ct_renal_disease"
                          value={answers.ct_renal_disease}
                          onChange={(val) => setQuestionAnswer('ct_renal_disease', val)}
                          highRisk="YES"
                        />
                        <QuestionRow
                          title="Patient taking Metformin or related oral diabetes medication?"
                          subtitle="Documented for clinical medication review"
                          name="ct_metformin"
                          value={answers.ct_metformin}
                          onChange={(val) => setQuestionAnswer('ct_metformin', val)}
                        />
                        <QuestionRow
                          title="History of severe bronchial asthma or multiple severe allergies?"
                          subtitle="Increased relative risk for contrast hypersensitivity reaction"
                          name="ct_asthma_allergies"
                          value={answers.ct_asthma_allergies}
                          onChange={(val) => setQuestionAnswer('ct_asthma_allergies', val)}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* X-Ray Questionnaire */}
                {context.modality === 'XRAY' && (
                  <>
                    <QuestionRow
                      title="Possibility of pregnancy?"
                      subtitle="Ionizing radiation exposure to pelvic/abdominal region"
                      name="xray_pregnancy"
                      value={answers.xray_pregnancy}
                      onChange={(val) => setQuestionAnswer('xray_pregnancy', val)}
                      includeNotApplicable
                      highRisk="YES"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Section 4: Live Safety Evaluation Result */}
            <div
              className={`p-4 rounded border space-y-2.5 ${
                isCleared
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : risks.length > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  {isCleared ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Status: CLEARED FOR ACQUISITION</span>
                    </>
                  ) : risks.length > 0 ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Status: REQUIRES REVIEW (CONTRAINDICATIONS IDENTIFIED)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Status: NOT CLEARED (SAFETY CHECKLIST INCOMPLETE)</span>
                    </>
                  )}
                </span>
                <Badge
                  variant={isCleared ? 'success' : risks.length > 0 ? 'destructive' : 'warning'}
                  className="font-bold text-[10px]"
                >
                  {isCleared ? 'CLEARED' : risks.length > 0 ? 'REQUIRES REVIEW' : 'NOT CLEARED'}
                </Badge>
              </div>

              {risks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-rose-900 block">
                    Identified Clinical Contraindications / Action Items:
                  </span>
                  <ul className="list-disc list-inside text-xs space-y-1 text-rose-800">
                    {risks.map((risk, idx) => (
                      <li key={idx} className="leading-snug">
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cautions.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-amber-900 block">
                    Clinical Caution Notes:
                  </span>
                  <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-800">
                    {cautions.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isCleared ? (
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Patient identity confirmed with 2 identifiers and all modality-specific safety criteria
                  are satisfied. Saving will advance order to <span className="font-semibold">SAFETY CLEARED</span> (SafetyStatus = CLEARED).
                </p>
              ) : risks.length > 0 ? (
                <p className="text-xs text-rose-800 leading-relaxed">
                  Clinical safety risks or contraindications detected. Saving will place order in <span className="font-semibold">SAFETY REVIEW</span> (SafetyStatus = REQUIRES_REVIEW).
                </p>
              ) : null}
            </div>

            {/* Section 5: Technologist Clinical Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Technologist Safety Notes (Optional)
              </label>
              <textarea
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                placeholder="Enter any implant serial numbers, patient positioning accommodations, or clinical safety notes..."
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {submissionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submissionError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setSubmissionError(null);
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending || isLoading || !context}
            className={`gap-1.5 font-semibold text-xs ${
              isCleared ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#2563EB] hover:bg-blue-700 text-white'
            }`}
          >
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isCleared ? 'Save & Clear Exam' : 'Save Safety Screening'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QuestionRowProps {
  title: string;
  subtitle?: string;
  name: string;
  value?: AnswerOption;
  onChange: (val: AnswerOption) => void;
  includeNotApplicable?: boolean;
  highRisk?: 'YES' | 'NO';
}

function QuestionRow({
  title,
  subtitle,
  name,
  value,
  onChange,
  includeNotApplicable,
  highRisk,
}: QuestionRowProps) {
  const isHighRiskSelected = value === highRisk;

  return (
    <div
      data-testid={name}
      className={`p-3 rounded border transition-colors ${
        isHighRiskSelected
          ? 'bg-rose-50/70 border-rose-300'
          : value
          ? 'bg-slate-50 border-[#E2E8F0]'
          : 'bg-white border-[#E2E8F0]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5 max-w-lg">
          <span className="text-xs font-semibold text-slate-800 block">{title}</span>
          {subtitle && <span className="text-[11px] text-slate-500 block leading-tight">{subtitle}</span>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(['NO', 'YES', 'UNKNOWN'] as AnswerOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                value === opt
                  ? opt === highRisk
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {opt}
            </button>
          ))}

          {includeNotApplicable && (
            <button
              type="button"
              onClick={() => onChange('NOT_APPLICABLE')}
              className={`px-2 py-1 text-[11px] font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                value === 'NOT_APPLICABLE'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              N/A
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
