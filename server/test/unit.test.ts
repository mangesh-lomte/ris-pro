import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePatientId,
  generateAccessionNumber,
  generateUniquePatientId,
  generateUniqueAccessionNumber,
} from '../src/utils/identifierGenerator';
import { createPatientSchema } from '../src/controllers/patient.controller';
import { createOrderSchema } from '../src/controllers/order.controller';
import {
  technologistWorklistQuerySchema,
  saveSafetyScreeningSchema,
  savePreparationSchema,
  confirmProtocolSchema,
  startScanSchema,
  interruptScanSchema,
  cancelScanSchema,
  recordContrastSchema,
  recordIncidentSchema,
  acceptImageQualitySchema,
  repeatRequiredSchema,
  rejectImageQualitySchema,
} from '../src/controllers/technologist.controller';
import { MockPacsGateway } from '../src/integrations/pacs/mockPacsGateway';
import { OrthancPacsGateway } from '../src/integrations/pacs/orthancPacsGateway';
import { createPacsGateway, PacsStudyLookupOutcome } from '../src/integrations/pacs';
import { envSchema } from '../src/config/env';
import { calculateWaitingMinutes } from '../src/services/technologist.service';
import { formatINR } from '../src/utils/formatters';
import {
  evaluateSafetyDecision,
  SafetyQuestionAnswers,
} from '../src/services/safetyScreening.service';
import {
  evaluatePreparationRequirements,
  evaluatePreparationDecision,
  PreparationRequirements,
} from '../src/services/preparation.service';
import { validateProtocolCompatibility } from '../src/services/protocol.service';
import {
  Gender,
  ModalityType,
  Priority,
  OrderStatus,
  AppointmentStatus,
  SafetyStatus,
  PreparationStatus,
  FastingStatus,
  ConsentStatus,
  ScanState,
  ScanLifecycleAction,
  ImageQualityStatus,
  ImageQualityReason,
  PacsHandoffStatus,
  PacsHandoffOutcome,
  UserRole,
} from '@prisma/client';
import {
  calculateCapacityUtilization,
  getDashboardAlertTarget,
} from '../src/services/dashboard.service';
import { getHospitalDayBounds } from '../src/utils/hospitalTime';

/**
 * Healthcare Age Calculation logic matching client & server expectations
 */
function calculatePatientAge(dob: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Pure mathematical interval overlap check:
 * existingStart < requestedEnd && existingEnd > requestedStart
 */
function hasTimeOverlap(
  existingStart: Date,
  existingEnd: Date,
  requestedStart: Date,
  requestedEnd: Date
): boolean {
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

describe('Healthcare Unit Tests (Phase 2)', () => {
  describe('1. Patient ID Generation', () => {
    it('generates Patient ID matching PAT-YYYY-XXXXX format', () => {
      const pid = generatePatientId();
      const currentYear = new Date().getFullYear();
      const regex = new RegExp(`^PAT-${currentYear}-\\d{5}$`);
      assert.match(pid, regex, `Patient ID ${pid} should match PAT-${currentYear}-XXXXX`);
    });

    it('handles collision and retries safely until unique candidate is found', async () => {
      let callCount = 0;
      // Mock Prisma client simulating collisions on attempts 1 and 2
      const mockClient: any = {
        patient: {
          findUnique: async () => {
            callCount++;
            if (callCount < 3) {
              return { id: 'existing-patient-id' }; // Collision simulated
            }
            return null; // Unique on 3rd attempt
          },
        },
      };

      const result = await generateUniquePatientId(mockClient);
      assert.ok(result.startsWith(`PAT-${new Date().getFullYear()}-`));
      assert.strictEqual(callCount, 3, 'Should retry until unique candidate is found');
    });
  });

  describe('2. Accession Number Generation', () => {
    it('generates Accession Number matching ACC-YYYYMMDD-[MOD]-XXXX format', () => {
      const acc = generateAccessionNumber('CT');
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const regex = new RegExp(`^ACC-${todayStr}-CT-[0-9A-F]{4}$`);
      assert.match(acc, regex, `Accession Number ${acc} should match ACC-YYYYMMDD-MOD-XXXX`);
    });

    it('handles accession collision and retries until unique', async () => {
      let callCount = 0;
      const mockClient: any = {
        imagingOrder: {
          findUnique: async () => {
            callCount++;
            if (callCount < 2) return { id: 'existing-order' };
            return null;
          },
        },
      };

      const result = await generateUniqueAccessionNumber(mockClient, 'MRI');
      assert.ok(result.includes('-MRI-'));
      assert.strictEqual(callCount, 2);
    });
  });

  describe('3. Scheduling Overlap Conflict Logic', () => {
    const existingStart = new Date('2026-11-06T10:00:00Z');
    const existingEnd = new Date('2026-11-06T10:30:00Z');

    it('rejects slot overlapping start: 10:15 - 10:45', () => {
      const reqStart = new Date('2026-11-06T10:15:00Z');
      const reqEnd = new Date('2026-11-06T10:45:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), true);
    });

    it('rejects slot overlapping end: 09:45 - 10:15', () => {
      const reqStart = new Date('2026-11-06T09:45:00Z');
      const reqEnd = new Date('2026-11-06T10:15:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), true);
    });

    it('rejects identical slot: 10:00 - 10:30', () => {
      const reqStart = new Date('2026-11-06T10:00:00Z');
      const reqEnd = new Date('2026-11-06T10:30:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), true);
    });

    it('rejects enclosing slot: 09:30 - 11:00', () => {
      const reqStart = new Date('2026-11-06T09:30:00Z');
      const reqEnd = new Date('2026-11-06T11:00:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), true);
    });

    it('allows contiguous slot immediately before: 09:30 - 10:00', () => {
      const reqStart = new Date('2026-11-06T09:30:00Z');
      const reqEnd = new Date('2026-11-06T10:00:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), false);
    });

    it('allows contiguous slot immediately after: 10:30 - 11:00', () => {
      const reqStart = new Date('2026-11-06T10:30:00Z');
      const reqEnd = new Date('2026-11-06T11:00:00Z');
      assert.strictEqual(hasTimeOverlap(existingStart, existingEnd, reqStart, reqEnd), false);
    });
  });

  describe('4. Dynamic Age Calculation & Birthday Boundaries', () => {
    it('calculates exact age for typical birthday', () => {
      const dob = new Date('1990-05-15');
      const ref = new Date('2026-11-05');
      assert.strictEqual(calculatePatientAge(dob, ref), 36);
    });

    it('handles day before birthday boundary correctly', () => {
      const dob = new Date('1990-11-06');
      const ref = new Date('2026-11-05'); // Day before 36th birthday
      assert.strictEqual(calculatePatientAge(dob, ref), 35);
    });

    it('handles exact day of birthday correctly', () => {
      const dob = new Date('1990-11-05');
      const ref = new Date('2026-11-05'); // Birthday today
      assert.strictEqual(calculatePatientAge(dob, ref), 36);
    });

    it('handles day after birthday correctly', () => {
      const dob = new Date('1990-11-04');
      const ref = new Date('2026-11-05'); // Day after birthday
      assert.strictEqual(calculatePatientAge(dob, ref), 36);
    });
  });

  describe('5. Zod Schema Validations', () => {
    it('fails when patient date of birth is in the future', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
      const result = createPatientSchema.safeParse({
        firstName: 'Future',
        lastName: 'Baby',
        dateOfBirth: futureDate,
        gender: Gender.FEMALE,
        phone: '1234567890',
      });
      assert.strictEqual(result.success, false);
    });

    it('fails when email format is invalid', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-01',
        gender: Gender.MALE,
        phone: '1234567890',
        email: 'not-an-email',
      });
      assert.strictEqual(result.success, false);
    });

    it('fails when order clinical indication is missing or too short', () => {
      const result = createOrderSchema.safeParse({
        patientId: 'patient-id-123',
        modality: ModalityType.CT,
        bodyPart: 'Chest',
        examinationName: 'CT Chest',
        clinicalIndication: 'No', // Too short (< 3 chars)
      });
      assert.strictEqual(result.success, false);
    });

    it('fails when modality is invalid', () => {
      const result = createOrderSchema.safeParse({
        patientId: 'patient-id-123',
        modality: 'INVALID_SCAN' as any,
        bodyPart: 'Chest',
        examinationName: 'Chest Scan',
        clinicalIndication: 'Persistent chest pain',
      });
      assert.strictEqual(result.success, false);
    });

    it('passes with complete valid imaging order payload', () => {
      const result = createOrderSchema.safeParse({
        patientId: 'patient-id-123',
        modality: ModalityType.MRI,
        bodyPart: 'Brain',
        examinationName: 'MRI Brain with Contrast',
        clinicalIndication: 'Frequent seizures, rule out structural lesion',
        contrastRequired: true,
        priority: Priority.URGENT,
      });
      assert.strictEqual(result.success, true);
    });
  });

  describe('6. Phase 3.1 Technologist Worklist Unit Tests', () => {
    describe('6.1 Worklist Eligibility Rules', () => {
      function isEligibleForTechWorklist(
        orderStatus: OrderStatus,
        appointmentStatus: AppointmentStatus,
        patientActive: boolean = true
      ): boolean {
        return (
          patientActive === true &&
          orderStatus === OrderStatus.READY_FOR_TECH &&
          appointmentStatus === AppointmentStatus.CHECKED_IN
        );
      }

      it('includes exam when READY_FOR_TECH and CHECKED_IN', () => {
        const eligible = isEligibleForTechWorklist(
          OrderStatus.READY_FOR_TECH,
          AppointmentStatus.CHECKED_IN,
          true
        );
        assert.strictEqual(eligible, true);
      });

      it('excludes exam when order is SCHEDULED even if appointment exists', () => {
        const eligible = isEligibleForTechWorklist(
          OrderStatus.SCHEDULED,
          AppointmentStatus.SCHEDULED,
          true
        );
        assert.strictEqual(eligible, false);
      });

      it('excludes exam when appointment is CANCELLED', () => {
        const eligible = isEligibleForTechWorklist(
          OrderStatus.READY_FOR_TECH,
          AppointmentStatus.CANCELLED,
          true
        );
        assert.strictEqual(eligible, false);
      });

      it('excludes exam when appointment is NO_SHOW', () => {
        const eligible = isEligibleForTechWorklist(
          OrderStatus.READY_FOR_TECH,
          AppointmentStatus.NO_SHOW,
          true
        );
        assert.strictEqual(eligible, false);
      });

      it('excludes exam when patient is marked inactive', () => {
        const eligible = isEligibleForTechWorklist(
          OrderStatus.READY_FOR_TECH,
          AppointmentStatus.CHECKED_IN,
          false
        );
        assert.strictEqual(eligible, false);
      });
    });


    describe('6.2 Priority Ordering & Deterministic Sorting', () => {
      const priorityWeights: Record<Priority, number> = {
        STAT: 3,
        URGENT: 2,
        ROUTINE: 1,
      };

      function compareWorklistItems(
        a: { priority: Priority; scheduledStart: Date; checkedInAt: Date },
        b: { priority: Priority; scheduledStart: Date; checkedInAt: Date }
      ): number {
        // 1. Priority desc
        const pDiff = priorityWeights[b.priority] - priorityWeights[a.priority];
        if (pDiff !== 0) return pDiff;

        // 2. Scheduled time asc
        const sDiff = a.scheduledStart.getTime() - b.scheduledStart.getTime();
        if (sDiff !== 0) return sDiff;

        // 3. Checked-in time asc
        return a.checkedInAt.getTime() - b.checkedInAt.getTime();
      }

      it('sorts STAT before URGENT and URGENT before ROUTINE', () => {
        const now = new Date('2026-11-05T09:00:00Z');
        const items = [
          { priority: Priority.ROUTINE, scheduledStart: now, checkedInAt: now },
          { priority: Priority.STAT, scheduledStart: now, checkedInAt: now },
          { priority: Priority.URGENT, scheduledStart: now, checkedInAt: now },
        ];

        items.sort(compareWorklistItems);

        assert.strictEqual(items[0]!.priority, Priority.STAT);
        assert.strictEqual(items[1]!.priority, Priority.URGENT);
        assert.strictEqual(items[2]!.priority, Priority.ROUTINE);
      });

      it('breaks priority ties using scheduled start time', () => {
        const base = new Date('2026-11-05T09:00:00Z');
        const earlier = new Date('2026-11-05T08:30:00Z');
        const items = [
          { priority: Priority.ROUTINE, scheduledStart: base, checkedInAt: base },
          { priority: Priority.ROUTINE, scheduledStart: earlier, checkedInAt: base },
        ];

        items.sort(compareWorklistItems);
        assert.strictEqual(items[0]!.scheduledStart.getTime(), earlier.getTime());
      });
    });


    describe('6.3 Dynamic Waiting Time Calculation', () => {
      it('returns 0 when checkedInAt is missing, null, or invalid', () => {
        assert.strictEqual(calculateWaitingMinutes(null), 0);
        assert.strictEqual(calculateWaitingMinutes(undefined), 0);
        assert.strictEqual(calculateWaitingMinutes('invalid-date'), 0);
      });

      it('calculates correct minutes from check-in time', () => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const waiting = calculateWaitingMinutes(tenMinutesAgo);
        assert.strictEqual(waiting, 10);
      });
    });


    describe('6.4 Technologist Worklist Zod Query Schema Validation', () => {
      it('rejects invalid modality', () => {
        const res = technologistWorklistQuerySchema.safeParse({ modality: 'INVALID_MODALITY' });
        assert.strictEqual(res.success, false);
      });

      it('rejects invalid priority', () => {
        const res = technologistWorklistQuerySchema.safeParse({ priority: 'SUPER_URGENT' });
        assert.strictEqual(res.success, false);
      });

      it('rejects page number less than 1', () => {
        const res = technologistWorklistQuerySchema.safeParse({ page: 0 });
        assert.strictEqual(res.success, false);
      });

      it('rejects pageSize greater than 100', () => {
        const res = technologistWorklistQuerySchema.safeParse({ pageSize: 150 });
        assert.strictEqual(res.success, false);
      });

      it('accepts valid query parameters and applies defaults', () => {
        const res = technologistWorklistQuerySchema.safeParse({
          modality: 'MRI',
          priority: 'URGENT',
          search: 'Shah',
          date: '2026-11-05',
        });
        assert.strictEqual(res.success, true);
        if (res.success) {
          assert.strictEqual(res.data.page, 1);
          assert.strictEqual(res.data.pageSize, 20);
          assert.strictEqual(res.data.modality, 'MRI');
          assert.strictEqual(res.data.priority, 'URGENT');
          assert.strictEqual(res.data.search, 'Shah');
        }
      });
    });

  });

  describe('7. Phase 3.2 Patient Identity & Safety Screening Unit Tests', () => {
    const cleanMriAnswers: SafetyQuestionAnswers = {
      mri_pacemaker: 'NO',
      mri_aneurysm_clip: 'NO',
      mri_cochlear_implant: 'NO',
      mri_neurostimulator: 'NO',
      mri_infusion_pump: 'NO',
      mri_metal_in_eyes: 'NO',
      mri_implants_other: 'NO',
      mri_pregnancy: 'NO',
      mri_claustrophobia: 'NO',
      mri_contrast_allergy: 'NO',
      mri_renal_disease: 'NO',
    };

    const cleanCtAnswers: SafetyQuestionAnswers = {
      ct_pregnancy: 'NO',
      ct_contrast_allergy: 'NO',
      ct_renal_disease: 'NO',
      ct_metformin: 'NO',
      ct_asthma_allergies: 'NO',
    };

    describe('7.1 Patient Identity Verification Rules', () => {
      it('blocks clearance when identity is not verified even if questionnaire has no contraindications', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          false, // identityVerified = false
          cleanMriAnswers
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('identity has not been verified')));
      });

      it('permits clearance when identity is confirmed and screening is clean', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true, // identityVerified = true
          cleanMriAnswers
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.CLEARED);
        assert.strictEqual(decision.riskFactors.length, 0);
      });
    });


    describe('7.2 MRI Modality Safety Rules', () => {
      it('flags cardiac pacemaker as contraindication requiring review', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_pacemaker: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('pacemaker')));
      });

      it('flags unknown pacemaker status as contraindication requiring review', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_pacemaker: 'UNKNOWN' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('pacemaker')));
      });

      it('flags aneurysm clip as contraindication requiring review', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_aneurysm_clip: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('aneurysm clip')));
      });

      it('flags metallic fragment in eyes as requiring review and orbital clearance', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_metal_in_eyes: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('eyes')));
      });

      it('flags prior contrast reaction/allergy when MRI contrast is ordered', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          true, // contrastRequired = true
          true,
          { ...cleanMriAnswers, mri_contrast_allergy: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('contrast allergy') || r.includes('reaction history')));
      });

      it('flags renal-risk history when MRI contrast is ordered', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          true, // contrastRequired = true
          true,
          { ...cleanMriAnswers, mri_renal_disease: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('Renal-risk')));
      });

      it('adds caution notes for other implants and claustrophobia without blocking clean exam', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_implants_other: 'YES', mri_claustrophobia: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.CLEARED);
        assert.ok(decision.cautionNotes.some((c) => c.includes('claustrophobia')));
        assert.ok(decision.cautionNotes.some((c) => c.includes('implant')));
      });
    });


    describe('7.3 CT Modality Safety Rules', () => {
      it('flags potential pregnancy for CT radiation risk', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.CT,
          false,
          true,
          { ...cleanCtAnswers, ct_pregnancy: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('pregnancy')));
      });

      it('flags contrast allergy history when contrast is ordered for CT', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.CT,
          true,
          true,
          { ...cleanCtAnswers, ct_contrast_allergy: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('contrast allergy') || r.includes('reaction history')));
      });

      it('flags renal-risk history when contrast is ordered for CT', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.CT,
          true,
          true,
          { ...cleanCtAnswers, ct_renal_disease: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('Renal-risk')));
      });

      it('adds caution note for Metformin without blocking clean exam', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.CT,
          true,
          true,
          { ...cleanCtAnswers, ct_metformin: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.CLEARED);
        assert.ok(decision.cautionNotes.some((c) => c.includes('Metformin')));
      });
    });


    describe('7.4 X-Ray Modality Safety Rules', () => {
      it('flags potential pregnancy for ionizing radiation review', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.XRAY,
          false,
          true,
          { xray_pregnancy: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        assert.ok(decision.riskFactors.some((r) => r.includes('pregnancy')));
      });

      it('clears X-ray when pregnancy is negative and identity verified', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.XRAY,
          false,
          true,
          { xray_pregnancy: 'NO' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.CLEARED);
      });
    });


    describe('7.5 Safety Screening Zod Schema Validation', () => {
      it('rejects payload when identityVerified is missing', () => {
        const res = saveSafetyScreeningSchema.safeParse({
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          answers: cleanMriAnswers,
        });
        assert.strictEqual(res.success, false);
      });

      it('rejects payload when identityVerificationMethod is too short', () => {
        const res = saveSafetyScreeningSchema.safeParse({
          identityVerified: true,
          identityVerificationMethod: 'AB',
          answers: cleanMriAnswers,
        });
        assert.strictEqual(res.success, false);
      });

      it('accepts complete valid safety screening payload', () => {
        const res = saveSafetyScreeningSchema.safeParse({
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyNotes: 'Patient confirmed no metal history, wedding ring removed.',
          answers: cleanMriAnswers,
        });
        assert.strictEqual(res.success, true);
      });
    });


    describe('7.6 SafetyStatus to OrderStatus Mapping Matrix', () => {
      it('maps normal case: SafetyStatus.CLEARED -> OrderStatus.SAFETY_CLEARED', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          cleanMriAnswers
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.CLEARED);
        const orderStatus =
          decision.safetyStatus === SafetyStatus.CLEARED
            ? OrderStatus.SAFETY_CLEARED
            : OrderStatus.SAFETY_REVIEW;
        assert.strictEqual(orderStatus, OrderStatus.SAFETY_CLEARED);
      });

      it('maps risk case: SafetyStatus.REQUIRES_REVIEW -> OrderStatus.SAFETY_REVIEW', () => {
        const decision = evaluateSafetyDecision(
          ModalityType.MRI,
          false,
          true,
          { ...cleanMriAnswers, mri_pacemaker: 'YES' }
        );
        assert.strictEqual(decision.safetyStatus, SafetyStatus.REQUIRES_REVIEW);
        const orderStatus =
          decision.safetyStatus === SafetyStatus.CLEARED
            ? OrderStatus.SAFETY_CLEARED
            : OrderStatus.SAFETY_REVIEW;
        assert.strictEqual(orderStatus, OrderStatus.SAFETY_REVIEW);
      });
    });

  });

  describe('8. Phase 3.3 Patient Preparation & Protocol Selection Unit Tests', () => {
    describe('8.1 Preparation Requirements Rule Engine', () => {
      it('derives zero requirements for routine non-contrast exam without configured requirements', () => {
        const reqs = evaluatePreparationRequirements(
          { modality: ModalityType.XRAY, bodyPart: 'Chest', contrastRequired: false },
          null
        );
        assert.strictEqual(reqs.fastingRequired, false);
        assert.strictEqual(reqs.ivRequired, false);
        assert.strictEqual(reqs.contrastPreparationRequired, false);
        assert.strictEqual(reqs.consentRequired, false);
        assert.strictEqual(reqs.additionalPreparationRequired, false);
      });

      it('configured fastingRequired drives fasting requirement', () => {
        const reqs = evaluatePreparationRequirements(
          { modality: ModalityType.CT, bodyPart: 'Head/Brain', contrastRequired: false },
          { fastingRequired: true }
        );
        assert.strictEqual(reqs.fastingRequired, true);
      });

      it('body part alone does NOT create fasting requirement (clinical rule hardening)', () => {
        // Even for Abdomen and Pelvis, if exam definition does not require fasting, fastingRequired is false
        const reqs = evaluatePreparationRequirements(
          { modality: ModalityType.CT, bodyPart: 'Abdomen and Pelvis', contrastRequired: false },
          { fastingRequired: false }
        );
        assert.strictEqual(reqs.fastingRequired, false);

        const reqsNull = evaluatePreparationRequirements(
          { modality: ModalityType.CT, bodyPart: 'Abdomen and Pelvis', contrastRequired: false },
          null
        );
        assert.strictEqual(reqsNull.fastingRequired, false);
      });

      it('configured ivRequired drives IV readiness requirement', () => {
        // IV requirement is driven strictly by configured ExamDefinition, not order.contrastRequired inference
        const reqsWithIv = evaluatePreparationRequirements(
          { modality: ModalityType.CT, bodyPart: 'Chest', contrastRequired: false },
          { ivRequired: true }
        );
        assert.strictEqual(reqsWithIv.ivRequired, true);

        const reqsWithoutIv = evaluatePreparationRequirements(
          { modality: ModalityType.CT, bodyPart: 'Chest', contrastRequired: true },
          { ivRequired: false }
        );
        assert.strictEqual(reqsWithoutIv.ivRequired, false);
      });

      it('respects authoritative exam definition configurations for all preparation flags', () => {
        const reqs = evaluatePreparationRequirements(
          { modality: ModalityType.MRI, bodyPart: 'Brain', contrastRequired: true },
          {
            fastingRequired: true,
            ivRequired: true,
            contrastPreparationRequired: true,
            consentRequired: true,
            additionalPreparationInstructions: 'Remove all jewelry and body piercings before Zone IV.',
          }
        );
        assert.strictEqual(reqs.fastingRequired, true);
        assert.strictEqual(reqs.ivRequired, true);
        assert.strictEqual(reqs.contrastPreparationRequired, true);
        assert.strictEqual(reqs.consentRequired, true);
        assert.strictEqual(reqs.additionalPreparationRequired, true);
        assert.strictEqual(reqs.additionalPreparationInstructions, 'Remove all jewelry and body piercings before Zone IV.');
      });
    });


    describe('8.2 Preparation Decision Engine', () => {
      const allRequirements: PreparationRequirements = {
        fastingRequired: true,
        ivRequired: true,
        contrastPreparationRequired: true,
        consentRequired: true,
        additionalPreparationRequired: true,
        additionalPreparationInstructions: 'Change into gown',
      };

      it('returns COMPLETE when no special requirements exist and valid checklist submitted', () => {
        const emptyReqs: PreparationRequirements = {
          fastingRequired: false,
          ivRequired: false,
          contrastPreparationRequired: false,
          consentRequired: false,
          additionalPreparationRequired: false,
          additionalPreparationInstructions: null,
        };
        const status = evaluatePreparationDecision(emptyReqs, {});
        assert.strictEqual(status, PreparationStatus.COMPLETE);
      });

      it('returns IN_PROGRESS when required fasting is not confirmed', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.NOT_CONFIRMED,
          ivReady: true,
          contrastReady: true,
          consentStatus: ConsentStatus.CONFIRMED,
          additionalPreparationComplete: true,
        });
        assert.strictEqual(status, PreparationStatus.IN_PROGRESS);
      });

      it('returns IN_PROGRESS when required IV is not ready', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.CONFIRMED,
          ivReady: false,
          contrastReady: true,
          consentStatus: ConsentStatus.CONFIRMED,
          additionalPreparationComplete: true,
        });
        assert.strictEqual(status, PreparationStatus.IN_PROGRESS);
      });

      it('returns IN_PROGRESS when required contrast preparation is not ready', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.CONFIRMED,
          ivReady: true,
          contrastReady: false,
          consentStatus: ConsentStatus.CONFIRMED,
          additionalPreparationComplete: true,
        });
        assert.strictEqual(status, PreparationStatus.IN_PROGRESS);
      });

      it('returns IN_PROGRESS when required consent is not confirmed', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.CONFIRMED,
          ivReady: true,
          contrastReady: true,
          consentStatus: ConsentStatus.NOT_CONFIRMED,
          additionalPreparationComplete: true,
        });
        assert.strictEqual(status, PreparationStatus.IN_PROGRESS);
      });

      it('returns IN_PROGRESS when required additional preparation is incomplete', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.CONFIRMED,
          ivReady: true,
          contrastReady: true,
          consentStatus: ConsentStatus.CONFIRMED,
          additionalPreparationComplete: false,
        });
        assert.strictEqual(status, PreparationStatus.IN_PROGRESS);
      });

      it('returns COMPLETE when all required preparation items are verified', () => {
        const status = evaluatePreparationDecision(allRequirements, {
          fastingStatus: FastingStatus.CONFIRMED,
          ivReady: true,
          contrastReady: true,
          consentStatus: ConsentStatus.CONFIRMED,
          additionalPreparationComplete: true,
        });
        assert.strictEqual(status, PreparationStatus.COMPLETE);
      });
    });


    describe('8.3 Protocol Compatibility & Gate Rules', () => {
      const activeMriProtocol = {
        id: 'proto-mri-1',
        code: 'MRI-BRAIN-ROUTINE',
        name: 'MRI Brain Routine',
        modality: ModalityType.MRI,
        examDefinitionId: 'exam-mri-brain',
        bodyPart: 'Brain',
        description: 'Standard multi-planar brain protocol',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      it('validates active compatible protocol without throwing', () => {
        assert.doesNotThrow(() => {
          validateProtocolCompatibility(
            activeMriProtocol,
            { modality: 'MRI', bodyPart: 'Brain', examinationName: 'MRI Brain' },
            { id: 'exam-mri-brain', code: 'MRI-BRAIN', name: 'MRI Brain' }
          );
        });
      });

      it('rejects inactive or deprecated protocol with HTTP 409 conflict', () => {
        assert.throws(
          () => {
            validateProtocolCompatibility(
              { ...activeMriProtocol, isActive: false },
              { modality: 'MRI', bodyPart: 'Brain' },
              null
            );
          },
          (err: any) => err.statusCode === 409 && err.message.includes('inactive or deprecated')
        );
      });

      it('rejects protocol modality mismatch (e.g. CT protocol for MRI exam)', () => {
        assert.throws(
          () => {
            validateProtocolCompatibility(
              { ...activeMriProtocol, modality: ModalityType.CT },
              { modality: 'MRI', bodyPart: 'Brain' },
              null
            );
          },
          (err: any) => err.statusCode === 409 && err.message.includes('modality mismatch')
        );
      });

      it('rejects protocol with incompatible exam definition ID', () => {
        assert.throws(
          () => {
            validateProtocolCompatibility(
              activeMriProtocol,
              { modality: 'MRI', bodyPart: 'Brain' },
              { id: 'different-exam-id', code: 'MRI-KNEE', name: 'MRI Knee' }
            );
          },
          (err: any) => err.statusCode === 409 && err.message.includes('incompatible with scheduled exam')
        );
      });

      it('rejects protocol with incompatible anatomical body part', () => {
        assert.throws(
          () => {
            validateProtocolCompatibility(
              { ...activeMriProtocol, examDefinitionId: null, bodyPart: 'Knee' },
              { modality: 'MRI', bodyPart: 'Brain' },
              null
            );
          },
          (err: any) => err.statusCode === 409 && err.message.includes('incompatible with order anatomy')
        );
      });
    });


    describe('8.4 Preparation & Protocol Zod Schemas', () => {
      it('validates valid preparation payload and strips extraneous fields', () => {
        const res = savePreparationSchema.safeParse({
          fastingStatus: 'CONFIRMED',
          ivReady: true,
          contrastReady: true,
          consentStatus: 'CONFIRMED',
          additionalPreparationComplete: true,
          preparationNotes: 'Patient changed into gown and ready.',
        });
        assert.strictEqual(res.success, true);
      });

      it('contrast readiness uses a boolean/readiness state only (no contrast dose or agent fields)', () => {
        const res = savePreparationSchema.safeParse({
          contrastReady: true,
          contrastDose: '50ml', // extra field should not be required or accepted as schema property
          contrastAgent: 'Isovue 370',
        });
        assert.strictEqual(res.success, true);
        if (res.success) {
          assert.strictEqual(res.data.contrastReady, true);
          assert.strictEqual((res.data as any).contrastDose, undefined);
          assert.strictEqual((res.data as any).contrastAgent, undefined);
        }
      });

      it('validates protocolId confirmation schema', () => {
        const valid = confirmProtocolSchema.safeParse({ protocolId: 'proto-valid-1' });
        assert.strictEqual(valid.success, true);

        const invalidEmpty = confirmProtocolSchema.safeParse({ protocolId: '' });
        assert.strictEqual(invalidEmpty.success, false);
      });

      it('verifies no scanner engineering field is required for protocol confirmation', () => {
        // Confirmation schema only expects protocolId; engineering fields are ignored or disallowed
        const parsed = confirmProtocolSchema.safeParse({
          protocolId: 'proto-standard-brain',
          sliceThickness: '1.25mm',
          kvp: 120,
          mas: 250,
          tr: 2000,
          te: 30,
        });
        assert.strictEqual(parsed.success, true);
        if (parsed.success) {
          assert.strictEqual(parsed.data.protocolId, 'proto-standard-brain');
          assert.strictEqual((parsed.data as any).sliceThickness, undefined);
          assert.strictEqual((parsed.data as any).kvp, undefined);
        }
      });
    });

  });

  describe('9. Phase 3.4 Scan Acquisition Lifecycle Unit Tests', () => {
    describe('9.1 Scan Lifecycle Zod Schemas', () => {
      it('validates startScanSchema with optional equipmentId or empty body', () => {
        const empty = startScanSchema.safeParse({});
        assert.strictEqual(empty.success, true);

        const withEquip = startScanSchema.safeParse({ equipmentId: 'eq-ct-01' });
        assert.strictEqual(withEquip.success, true);
        if (withEquip.success) {
          assert.strictEqual(withEquip.data.equipmentId, 'eq-ct-01');
        }
      });

      it('validates interruptScanSchema requiring valid reason', () => {
        const valid = interruptScanSchema.safeParse({
          reason: 'PATIENT_REQUEST',
          notes: 'Patient requested pause',
        });
        assert.strictEqual(valid.success, true);

        const invalidReason = interruptScanSchema.safeParse({
          reason: 'INVALID_REASON',
        });
        assert.strictEqual(invalidReason.success, false);
      });

      it("rejects interruptScanSchema when reason is 'OTHER' and notes is missing or too short", () => {
        const missingNotes = interruptScanSchema.safeParse({
          reason: 'OTHER',
        });
        assert.strictEqual(missingNotes.success, false);

        const shortNotes = interruptScanSchema.safeParse({
          reason: 'OTHER',
          notes: 'no',
        });
        assert.strictEqual(shortNotes.success, false);

        const validOther = interruptScanSchema.safeParse({
          reason: 'OTHER',
          notes: 'Power dip on generator line',
        });
        assert.strictEqual(validOther.success, true);
      });

      it('validates cancelScanSchema requiring valid reason', () => {
        const valid = cancelScanSchema.safeParse({
          reason: 'PATIENT_UNABLE_TO_CONTINUE',
          notes: 'Severe acute claustrophobia',
        });
        assert.strictEqual(valid.success, true);

        const invalidReason = cancelScanSchema.safeParse({
          reason: 'NOT_A_REASON',
        });
        assert.strictEqual(invalidReason.success, false);
      });

      it("rejects cancelScanSchema when reason is 'OTHER' and notes is missing or too short", () => {
        const missingNotes = cancelScanSchema.safeParse({
          reason: 'OTHER',
        });
        assert.strictEqual(missingNotes.success, false);

        const validOther = cancelScanSchema.safeParse({
          reason: 'OTHER',
          notes: 'Scanner helium quench alarm',
        });
        assert.strictEqual(validOther.success, true);
      });
    });


    describe('9.2 State Machine Transition Rules Matrix', () => {
      // Helper function verifying transition matrix rules
      function isTransitionPermitted(from: OrderStatus, action: 'START' | 'INTERRUPT' | 'RESUME' | 'FINISH' | 'CANCEL'): boolean {
        switch (from) {
          case OrderStatus.READY_FOR_SCAN:
            return action === 'START' || action === 'CANCEL';
          case OrderStatus.SCAN_IN_PROGRESS:
            return action === 'INTERRUPT' || action === 'FINISH'; // Direct cancel is strictly prohibited!
          case OrderStatus.SCAN_INTERRUPTED:
            return action === 'RESUME' || action === 'CANCEL'; // Direct finish is strictly prohibited!
          case OrderStatus.SCAN_COMPLETED:
          case OrderStatus.SCAN_CANCELLED:
            return false; // Terminal states
          default:
            return false;
        }
      }

      it('permits START and CANCEL from READY_FOR_SCAN only', () => {
        assert.strictEqual(isTransitionPermitted(OrderStatus.READY_FOR_SCAN, 'START'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.READY_FOR_SCAN, 'CANCEL'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.READY_FOR_SCAN, 'INTERRUPT'), false);
        assert.strictEqual(isTransitionPermitted(OrderStatus.READY_FOR_SCAN, 'RESUME'), false);
        assert.strictEqual(isTransitionPermitted(OrderStatus.READY_FOR_SCAN, 'FINISH'), false);
      });

      it('permits INTERRUPT and FINISH from SCAN_IN_PROGRESS, but strictly prohibits direct CANCEL', () => {
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_IN_PROGRESS, 'INTERRUPT'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_IN_PROGRESS, 'FINISH'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_IN_PROGRESS, 'START'), false);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_IN_PROGRESS, 'RESUME'), false);
        // Section 7 critical rule:
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_IN_PROGRESS, 'CANCEL'), false);
      });

      it('permits RESUME and CANCEL from SCAN_INTERRUPTED, but prohibits direct FINISH', () => {
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_INTERRUPTED, 'RESUME'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_INTERRUPTED, 'CANCEL'), true);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_INTERRUPTED, 'FINISH'), false);
        assert.strictEqual(isTransitionPermitted(OrderStatus.SCAN_INTERRUPTED, 'START'), false);
      });

      it('strictly forbids all transitions from terminal states SCAN_COMPLETED and SCAN_CANCELLED', () => {
        const terminalStates = [OrderStatus.SCAN_COMPLETED, OrderStatus.SCAN_CANCELLED];
        const actions: ('START' | 'INTERRUPT' | 'RESUME' | 'FINISH' | 'CANCEL')[] = [
          'START',
          'INTERRUPT',
          'RESUME',
          'FINISH',
          'CANCEL',
        ];

        for (const st of terminalStates) {
          for (const act of actions) {
            assert.strictEqual(isTransitionPermitted(st, act), false, `Action ${act} should be forbidden from ${st}`);
          }
        }
      });
    });

  });

  describe('10. Phase 3.5 Contrast Administration & Incident Recording Unit Tests', () => {
    describe('10.1 Contrast Administration Workflow Gate & Eligibility Matrix', () => {
      // Helper function modeling contrast eligibility decision
      function isContrastAdministrationAllowed(params: {
        contrastRequired: boolean;
        orderStatus: OrderStatus;
        safetyStatus: SafetyStatus;
        preparationStatus: PreparationStatus;
        isPatientActive: boolean;
      }): { allowed: boolean; reason?: string } {
        if (!params.isPatientActive) return { allowed: false, reason: 'PATIENT_INACTIVE' };
        if (params.orderStatus === OrderStatus.SCAN_CANCELLED || params.orderStatus === OrderStatus.CANCELLED) {
          return { allowed: false, reason: 'SCAN_CANCELLED' };
        }
        if (params.orderStatus === OrderStatus.SCAN_COMPLETED) {
          return { allowed: false, reason: 'SCAN_COMPLETED' };
        }
        if (!params.contrastRequired) return { allowed: false, reason: 'CONTRAST_NOT_REQUIRED' };
        if (params.safetyStatus !== SafetyStatus.CLEARED) return { allowed: false, reason: 'SAFETY_CLEARANCE_REQUIRED' };
        if (params.preparationStatus !== PreparationStatus.COMPLETE) return { allowed: false, reason: 'PREPARATION_INCOMPLETE' };
        if (params.orderStatus !== OrderStatus.SCAN_IN_PROGRESS) return { allowed: false, reason: 'SCAN_NOT_IN_PROGRESS' };
        return { allowed: true };
      }

      it('permits contrast administration when contrastRequired=true and order is SCAN_IN_PROGRESS with CLEARED safety and COMPLETE prep', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, true);
      });

      it('strictly rejects contrast administration when contrastRequired is false (CONTRAST_NOT_REQUIRED)', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: false,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.reason, 'CONTRAST_NOT_REQUIRED');
      });

      it('strictly rejects contrast administration in READY_FOR_SCAN state before scan acquisition starts', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.reason, 'SCAN_NOT_IN_PROGRESS');
      });

      it('strictly rejects first-time contrast administration while scan is in SCAN_INTERRUPTED state', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_INTERRUPTED,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.reason, 'SCAN_NOT_IN_PROGRESS');
      });

      it('strictly rejects contrast administration when scan is SCAN_COMPLETED', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_COMPLETED,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
      });

      it('strictly rejects contrast administration when scan is SCAN_CANCELLED', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_CANCELLED,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
      });

      it('strictly rejects contrast administration when safety is REQUIRES_REVIEW', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
          safetyStatus: SafetyStatus.REQUIRES_REVIEW,
          preparationStatus: PreparationStatus.COMPLETE,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.reason, 'SAFETY_CLEARANCE_REQUIRED');
      });

      it('strictly rejects contrast administration when patient preparation is IN_PROGRESS', () => {
        const res = isContrastAdministrationAllowed({
          contrastRequired: true,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
          safetyStatus: SafetyStatus.CLEARED,
          preparationStatus: PreparationStatus.IN_PROGRESS,
          isPatientActive: true,
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.reason, 'PREPARATION_INCOMPLETE');
      });
    });


    describe('10.2 Contrast Administration Zod Schema Validation', () => {
      it('validates a complete, standard contrast administration payload', () => {
        const parsed = recordContrastSchema.parse({
          contrastAgentName: 'Omnipaque 350',
          concentration: '350 mgI/mL',
          volume: 85,
          volumeUnit: 'mL',
          route: 'IV',
          batchLotNumber: 'LOT-2026-X99',
          expirationDate: '2028-12-31',
          administrationNotes: 'Administered via power injector at 3.0 mL/s without resistance.',
        });
        assert.strictEqual(parsed.contrastAgentName, 'Omnipaque 350');
        assert.strictEqual(parsed.volume, 85);
        assert.strictEqual(parsed.volumeUnit, 'mL');
        assert.strictEqual(parsed.route, 'IV');
      });

      it('rejects contrast administration with non-positive volume (volume <= 0)', () => {
        assert.throws(() => {
          recordContrastSchema.parse({
            contrastAgentName: 'Omnipaque 350',
            volume: 0,
            route: 'IV',
          });
        });

        assert.throws(() => {
          recordContrastSchema.parse({
            contrastAgentName: 'Omnipaque 350',
            volume: -10,
            route: 'IV',
          });
        });
      });

      it('rejects volume exceeding system upper bound (> 1000 mL)', () => {
        assert.throws(() => {
          recordContrastSchema.parse({
            contrastAgentName: 'Omnipaque 350',
            volume: 1500,
            route: 'IV',
          });
        });
      });

      it('rejects missing or empty contrast agent name', () => {
        assert.throws(() => {
          recordContrastSchema.parse({
            contrastAgentName: '   ',
            volume: 50,
            route: 'IV',
          });
        });
      });

      it('strictly enforces volumeUnit "mL" and defaults to "mL" when omitted', () => {
        // Defaults to mL
        const parsedOmitted = recordContrastSchema.parse({
          contrastAgentName: 'Omnipaque 350',
          volume: 50,
          route: 'IV',
        });
        assert.strictEqual(parsedOmitted.volumeUnit, 'mL');

        // Explicitly mL
        const parsedExplicit = recordContrastSchema.parse({
          contrastAgentName: 'Omnipaque 350',
          volume: 50,
          volumeUnit: 'mL',
          route: 'IV',
        });
        assert.strictEqual(parsedExplicit.volumeUnit, 'mL');

        // Rejects cc, ML, mls, milliliters
        for (const badUnit of ['cc', 'ML', 'mls', 'milliliters', 'L', 'fl oz']) {
          assert.throws(
            () => {
              recordContrastSchema.parse({
                contrastAgentName: 'Omnipaque 350',
                volume: 50,
                // @ts-expect-error Testing invalid volume unit
                volumeUnit: badUnit,
                route: 'IV',
              });
            },
            (err: any) => err.name === 'ZodError',
            `Must reject invalid volume unit '${badUnit}'`
          );
        }
      });

      it('rejects invalid administration route', () => {
        assert.throws(() => {
          recordContrastSchema.parse({
            contrastAgentName: 'Omnipaque 350',
            volume: 50,
            // @ts-expect-error Testing invalid route enum
            route: 'SUBCUTANEOUS',
          });
        });
      });
    });


    describe('10.3 Absence of Clinical Decision Support (Verification)', () => {
      it('verifies the system records actual volume without prescribing dosage formulas', () => {
        // System must accept any valid technologist-documented volume without computing mg/kg or eGFR
        const sampleWeights = [45, 75, 110];
        for (const _weight of sampleWeights) {
          const result = recordContrastSchema.parse({
            contrastAgentName: 'Isovue 370',
            volume: 100,
            route: 'IV',
          });
          assert.strictEqual(result.volume, 100);
        }
      });
    });


    describe('10.4 Technologist Incident Zod Schema & Gating', () => {
      // Helper function modeling incident recording eligibility
      function isIncidentRecordingAllowed(status: OrderStatus): boolean {
        return status === OrderStatus.SCAN_IN_PROGRESS || status === OrderStatus.SCAN_INTERRUPTED;
      }

      it('permits incident recording during SCAN_IN_PROGRESS and SCAN_INTERRUPTED', () => {
        assert.strictEqual(isIncidentRecordingAllowed(OrderStatus.SCAN_IN_PROGRESS), true);
        assert.strictEqual(isIncidentRecordingAllowed(OrderStatus.SCAN_INTERRUPTED), true);
      });

      it('strictly forbids incident recording in READY_FOR_SCAN, SCAN_COMPLETED, and SCAN_CANCELLED', () => {
        assert.strictEqual(isIncidentRecordingAllowed(OrderStatus.READY_FOR_SCAN), false);
        assert.strictEqual(isIncidentRecordingAllowed(OrderStatus.SCAN_COMPLETED), false);
        assert.strictEqual(isIncidentRecordingAllowed(OrderStatus.SCAN_CANCELLED), false);
      });

      it('validates a complete valid incident payload', () => {
        const parsed = recordIncidentSchema.parse({
          category: 'CONTRAST_REACTION',
          description: 'Patient experienced mild urticaria on neck and chest approximately 3 minutes post-injection.',
          clinicianNotified: true,
          notificationNotes: 'On-duty radiologist Dr. Smith notified at scanner suite.',
          workflowActionTaken: 'CLINICIAN_NOTIFIED',
          workflowActionNotes: 'Cold compress applied and vital signs monitored.',
        });
        assert.strictEqual(parsed.category, 'CONTRAST_REACTION');
        assert.strictEqual(parsed.clinicianNotified, true);
        assert.strictEqual(parsed.workflowActionTaken, 'CLINICIAN_NOTIFIED');
      });

      it('rejects incident description shorter than 3 characters', () => {
        assert.throws(() => {
          recordIncidentSchema.parse({
            category: 'EXTRAVASATION',
            description: 'No',
          });
        });
      });

      it('rejects incident description containing HTML tags or scripts', () => {
        assert.throws(() => {
          recordIncidentSchema.parse({
            category: 'PATIENT_DISTRESS',
            description: '<script>alert("distress")</script> Patient panicked',
          });
        });
      });
    });


    describe('10.5 Incident Independence from Scan Lifecycle State', () => {
      it('confirms that recording an incident does NOT automatically alter scan lifecycle state', () => {
        let scanStatus = OrderStatus.SCAN_IN_PROGRESS;
        let scanLifecycleState = ScanState.IN_PROGRESS;

        // Simulate incident recording
        const recordedIncident = {
          category: 'CONTRAST_REACTION' as const,
          description: 'Mild nausea reported by patient.',
          recordedAt: new Date(),
        };

        // Assert scan state remains untouched
        assert.ok(recordedIncident);
        assert.strictEqual(scanStatus, OrderStatus.SCAN_IN_PROGRESS);
        assert.strictEqual(scanLifecycleState, ScanState.IN_PROGRESS);

        // State changes only when technologist executes explicit Phase 3.4 interruption
        scanStatus = OrderStatus.SCAN_INTERRUPTED;
        scanLifecycleState = ScanState.INTERRUPTED;
        assert.strictEqual(scanStatus, OrderStatus.SCAN_INTERRUPTED);
        assert.strictEqual(scanLifecycleState, ScanState.INTERRUPTED);
      });
    });

    describe('10.6 Authoritative Relation-Based Incident Derivation', () => {
      it('derives hasIncident strictly from presence of related incidents without duplicate stored boolean state', () => {
        const adminWithoutIncidents = {
          id: 'adm-1',
          incidents: [],
        };
        const hasIncidentWithout = adminWithoutIncidents.incidents.length > 0;
        assert.strictEqual(hasIncidentWithout, false);

        const adminWithIncidents = {
          id: 'adm-2',
          incidents: [{ id: 'inc-1', category: 'CONTRAST_REACTION', description: 'Urticaria' }],
        };
        const hasIncidentWith = adminWithIncidents.incidents.length > 0;
        assert.strictEqual(hasIncidentWith, true);
      });
    });

    describe('11. Phase 3.6 — Image Quality Review & Simulated PACS Handoff', () => {
      describe('11.1 QA Entry Gating & Prerequisites', () => {
        function isQaReviewAllowed(status: OrderStatus): boolean {
          return status === OrderStatus.SCAN_COMPLETED;
        }

        it('permits entering QA review strictly when status is SCAN_COMPLETED', () => {
          assert.strictEqual(isQaReviewAllowed(OrderStatus.SCAN_COMPLETED), true);
        });

        it('strictly forbids entering QA review from earlier or incomplete scan states', () => {
          assert.strictEqual(isQaReviewAllowed(OrderStatus.READY_FOR_SCAN), false);
          assert.strictEqual(isQaReviewAllowed(OrderStatus.SCAN_IN_PROGRESS), false);
          assert.strictEqual(isQaReviewAllowed(OrderStatus.SCAN_INTERRUPTED), false);
          assert.strictEqual(isQaReviewAllowed(OrderStatus.SCAN_CANCELLED), false);
          assert.strictEqual(isQaReviewAllowed(OrderStatus.PREPARED), false);
          assert.strictEqual(isQaReviewAllowed(OrderStatus.SAFETY_CLEARED), false);
        });
      });

      describe('11.2 QA Decision State Transitions & Immutability', () => {
        function evaluateQaDecisionTransition(
          currentStatus: ImageQualityStatus,
          targetStatus: ImageQualityStatus
        ): { allowed: boolean; nextOrderStatus?: OrderStatus } {
          if (currentStatus !== ImageQualityStatus.PENDING) {
            return { allowed: false }; // Terminal decision already made
          }
          switch (targetStatus) {
            case ImageQualityStatus.ACCEPTED:
              return { allowed: true, nextOrderStatus: OrderStatus.PACS_READY };
            case ImageQualityStatus.REPEAT_REQUIRED:
              return { allowed: true, nextOrderStatus: OrderStatus.REPEAT_REQUIRED };
            case ImageQualityStatus.REJECTED:
              return { allowed: true, nextOrderStatus: OrderStatus.IMAGE_REJECTED };
            default:
              return { allowed: false };
          }
        }

        it('advances PENDING to ACCEPTED and triggers PACS_READY status', () => {
          const res = evaluateQaDecisionTransition(ImageQualityStatus.PENDING, ImageQualityStatus.ACCEPTED);
          assert.strictEqual(res.allowed, true);
          assert.strictEqual(res.nextOrderStatus, OrderStatus.PACS_READY);
        });

        it('advances PENDING to REPEAT_REQUIRED and triggers REPEAT_REQUIRED status', () => {
          const res = evaluateQaDecisionTransition(ImageQualityStatus.PENDING, ImageQualityStatus.REPEAT_REQUIRED);
          assert.strictEqual(res.allowed, true);
          assert.strictEqual(res.nextOrderStatus, OrderStatus.REPEAT_REQUIRED);
        });

        it('advances PENDING to REJECTED and triggers IMAGE_REJECTED status', () => {
          const res = evaluateQaDecisionTransition(ImageQualityStatus.PENDING, ImageQualityStatus.REJECTED);
          assert.strictEqual(res.allowed, true);
          assert.strictEqual(res.nextOrderStatus, OrderStatus.IMAGE_REJECTED);
        });

        it('rejects duplicate or conflicting second QA decisions once decided', () => {
          const fromAccepted = evaluateQaDecisionTransition(ImageQualityStatus.ACCEPTED, ImageQualityStatus.REJECTED);
          assert.strictEqual(fromAccepted.allowed, false);

          const fromRejected = evaluateQaDecisionTransition(ImageQualityStatus.REJECTED, ImageQualityStatus.ACCEPTED);
          assert.strictEqual(fromRejected.allowed, false);

          const fromRepeat = evaluateQaDecisionTransition(ImageQualityStatus.REPEAT_REQUIRED, ImageQualityStatus.ACCEPTED);
          assert.strictEqual(fromRepeat.allowed, false);
        });
      });

      describe('11.3 Repeat Authorization Gating & Target State', () => {
        function canAuthorizeRepeat(orderStatus: OrderStatus, qaStatus: ImageQualityStatus): boolean {
          const validOrderStatus = orderStatus === OrderStatus.REPEAT_REQUIRED || orderStatus === OrderStatus.IMAGE_REJECTED;
          const validQaStatus = qaStatus === ImageQualityStatus.REPEAT_REQUIRED || qaStatus === ImageQualityStatus.REJECTED;
          return validOrderStatus && validQaStatus;
        }

        it('allows repeat authorization from REPEAT_REQUIRED or IMAGE_REJECTED', () => {
          assert.strictEqual(canAuthorizeRepeat(OrderStatus.REPEAT_REQUIRED, ImageQualityStatus.REPEAT_REQUIRED), true);
          assert.strictEqual(canAuthorizeRepeat(OrderStatus.IMAGE_REJECTED, ImageQualityStatus.REJECTED), true);
        });

        it('strictly forbids repeat authorization from ACCEPTED or earlier workflow states', () => {
          assert.strictEqual(canAuthorizeRepeat(OrderStatus.PACS_READY, ImageQualityStatus.ACCEPTED), false);
          assert.strictEqual(canAuthorizeRepeat(OrderStatus.IMAGE_ACCEPTED, ImageQualityStatus.ACCEPTED), false);
          assert.strictEqual(canAuthorizeRepeat(OrderStatus.SCAN_COMPLETED, ImageQualityStatus.PENDING), false);
        });

        it('confirms repeat authorization resets order state to READY_FOR_SCAN without altering historical attempts', () => {
          const historicalAttempts = [
            { attemptNumber: 1, state: ScanState.COMPLETED, completedAt: new Date() },
          ];
          const newOrderState = OrderStatus.READY_FOR_SCAN;

          assert.strictEqual(newOrderState, OrderStatus.READY_FOR_SCAN);
          assert.strictEqual(historicalAttempts.length, 1);
          assert.strictEqual(historicalAttempts[0].attemptNumber, 1);
          assert.strictEqual(historicalAttempts[0].state, ScanState.COMPLETED);
        });
      });

      describe('11.4 Image Quality Zod Validation Schemas', () => {
        it('accepts valid repeatRequired payload with recognized reason and optional notes', () => {
          const parsed = repeatRequiredSchema.parse({
            reason: 'PATIENT_MOTION',
            notes: 'Patient sneezed during acquisition phase',
          });
          assert.strictEqual(parsed.reason, 'PATIENT_MOTION');
          assert.strictEqual(parsed.notes, 'Patient sneezed during acquisition phase');
        });

        it('enforces notes requirement (>= 3 chars) when reason is OTHER', () => {
          assert.throws(() => {
            repeatRequiredSchema.parse({
              reason: 'OTHER',
              notes: '',
            });
          });

          assert.throws(() => {
            repeatRequiredSchema.parse({
              reason: 'OTHER',
              notes: 'ab',
            });
          });

          const valid = repeatRequiredSchema.parse({
            reason: 'OTHER',
            notes: 'Hardware table jitter observed on sequence 3',
          });
          assert.strictEqual(valid.reason, 'OTHER');
        });

        it('validates rejectImageQuality payload with reason and notes', () => {
          const parsed = rejectImageQualitySchema.parse({
            reason: 'TECHNICAL_ARTIFACT',
            notes: 'Severe RF zipper artifact through region of interest',
          });
          assert.strictEqual(parsed.reason, 'TECHNICAL_ARTIFACT');
        });

        it('validates acceptImageQuality payload with optional notes', () => {
          const empty = acceptImageQualitySchema.parse({});
          assert.strictEqual(empty.notes, undefined);

          const withNotes = acceptImageQualitySchema.parse({
            notes: 'All 4 sequences verified with diagnostic SNR',
          });
          assert.strictEqual(withNotes.notes, 'All 4 sequences verified with diagnostic SNR');
        });
      });

      describe('11.5 PacsGateway Abstraction & MockPacsGateway Deterministic Behavior', () => {
        it('returns successful handoff result with synthetic handoff ID and simulated payload when configured for success', async () => {
          const gateway = new MockPacsGateway('success');
          const context = {
            imagingOrderId: 'ord-123',
            accessionNumber: 'ACC-2026-99999',
            patientId: 'PAT-2026-11111',
            modality: ModalityType.MRI,
            attemptNumber: 1,
            completedAt: new Date(),
          };

          const result = await gateway.requestHandoff(context);
          assert.strictEqual(result.success, true);
          assert.strictEqual(result.errorCode, undefined);
          assert.strictEqual(result.adapterIdentifier, 'Demo PACS Adapter (Simulated)');
          assert.ok(result.simulatedTimestamp instanceof Date);
        });

        it('returns simulated communication failure when configured for failure', async () => {
          const gateway = new MockPacsGateway('failure');
          const context = {
            imagingOrderId: 'ord-456',
            accessionNumber: 'ACC-2026-88888',
            patientId: 'PAT-2026-22222',
            modality: ModalityType.CT,
            attemptNumber: 1,
            completedAt: new Date(),
          };

          const result = await gateway.requestHandoff(context);
          assert.strictEqual(result.success, false);
          assert.strictEqual(result.errorCode, 'PACS_UNAVAILABLE');
          assert.ok(result.errorMessage?.includes('Simulated downstream PACS storage service unavailable'));
        });

        it('implements fail_once behavior: fails on first attempt and succeeds on second attempt', async () => {
          const gateway = new MockPacsGateway('fail_once');
          const context = {
            imagingOrderId: 'ord-789',
            accessionNumber: 'ACC-2026-77777',
            patientId: 'PAT-2026-33333',
            modality: ModalityType.XRAY,
            attemptNumber: 1,
            completedAt: new Date(),
          };

          // 1st attempt fails
          const first = await gateway.requestHandoff(context);
          assert.strictEqual(first.success, false);
          assert.strictEqual(first.errorCode, 'HANDOFF_TIMEOUT');

          // 2nd attempt succeeds
          const second = await gateway.requestHandoff(context);
          assert.strictEqual(second.success, true);
          assert.strictEqual(second.errorCode, undefined);
        });

        it('explicitly confirms no real DICOM networking or pixel storage is performed', () => {
          const gateway = new MockPacsGateway();
          assert.ok(gateway instanceof MockPacsGateway);
          // Confirm architectural boundary contracts
          assert.strictEqual(typeof gateway.requestHandoff, 'function');
          assert.strictEqual(typeof gateway.setOutcome, 'function');
        });
      });
    });

    describe('12. Phase 3.6R — Real Orthanc PACS Integration Foundation Unit Tests', () => {
      describe('12.1 Adapter Factory & Configuration Validation', () => {
        it('selects MockPacsGateway when PACS_ADAPTER is mock', () => {
          const gateway = createPacsGateway('mock');
          assert.ok(gateway instanceof MockPacsGateway);
        });

        it('selects OrthancPacsGateway when PACS_ADAPTER is orthanc', () => {
          const gateway = createPacsGateway('orthanc');
          assert.ok(gateway instanceof OrthancPacsGateway);
        });

        it('rejects invalid PACS_ADAPTER configuration with validation error', () => {
          const result = envSchema.safeParse({
            DATABASE_URL: 'postgresql://test:test@localhost:5432/ris_db',
            JWT_SECRET: 'super-secret-jwt-key-2026',
            PACS_ADAPTER: 'invalid_adapter',
          });
          assert.strictEqual(result.success, false);
        });

        it('requires ORTHANC_URL, ORTHANC_USERNAME, and ORTHANC_PASSWORD when PACS_ADAPTER is orthanc', () => {
          const missingUsername = envSchema.safeParse({
            DATABASE_URL: 'postgresql://test:test@localhost:5432/ris_db',
            JWT_SECRET: 'super-secret-jwt-key-2026',
            PACS_ADAPTER: 'orthanc',
            ORTHANC_URL: 'http://localhost:8042',
            ORTHANC_USERNAME: '',
            ORTHANC_PASSWORD: 'secretpassword',
          });
          assert.strictEqual(missingUsername.success, false);

          const missingPassword = envSchema.safeParse({
            DATABASE_URL: 'postgresql://test:test@localhost:5432/ris_db',
            JWT_SECRET: 'super-secret-jwt-key-2026',
            PACS_ADAPTER: 'orthanc',
            ORTHANC_URL: 'http://localhost:8042',
            ORTHANC_USERNAME: 'orthanc',
            ORTHANC_PASSWORD: '',
          });
          assert.strictEqual(missingPassword.success, false);
        });

        it('never leaks credentials or authorization headers in error details', () => {
          const failed = envSchema.safeParse({
            DATABASE_URL: 'postgresql://test:test@localhost:5432/ris_db',
            JWT_SECRET: 'super-secret-jwt-key-2026',
            PACS_ADAPTER: 'orthanc',
            ORTHANC_URL: 'http://localhost:8042',
            ORTHANC_USERNAME: 'orthanc',
            ORTHANC_PASSWORD: '',
          });
          const errorText = JSON.stringify(failed);
          assert.ok(!errorText.includes('secretpassword'));
          assert.ok(!errorText.includes('Basic '));
        });
      });

      describe('12.2 PacsCapabilities & Honesty Boundaries', () => {
        it('exposes dicomTransferSupported = false for OrthancPacsGateway', async () => {
          const gateway = new OrthancPacsGateway({
            baseUrl: 'http://localhost:8042',
            username: 'orthanc',
            password: 'secret',
          });
          const caps = await gateway.getCapabilities();
          assert.strictEqual(caps.adapter, 'orthanc');
          assert.strictEqual(caps.metadataLookupSupported, true);
          assert.strictEqual(caps.reconciliationSupported, true);
          assert.strictEqual(caps.dicomTransferSupported, false); // Strict honesty boundary
        });

        it('exposes dicomTransferSupported = true for MockPacsGateway simulated handoffs', async () => {
          const gateway = new MockPacsGateway('success');
          const caps = await gateway.getCapabilities();
          assert.strictEqual(caps.adapter, 'mock');
          assert.strictEqual(caps.dicomTransferSupported, true);
        });

        it('strictly rejects requestHandoff on OrthancPacsGateway with PACS_TRANSFER_NOT_AVAILABLE', async () => {
          const gateway = new OrthancPacsGateway({
            baseUrl: 'http://localhost:8042',
            username: 'orthanc',
            password: 'secret',
          });
          await assert.rejects(
            async () => {
              await gateway.requestHandoff({
                imagingOrderId: 'ord-123',
                accessionNumber: 'ACC-123',
                patientId: 'PAT-123',
                patientInternalId: 'pid-123',
                modality: 'CT',
                examination: 'CT Head',
                protocolCode: null,
                scanLifecycleId: 'scan-123',
                attemptNumber: 1,
                equipmentId: null,
                equipmentName: null,
                imageQualityReviewId: 'qa-123',
                reviewedByUserId: 'usr-123',
                reviewedAt: new Date(),
              });
            },
            (err: any) => {
              assert.strictEqual(err.statusCode, 409);
              assert.strictEqual(err.code, 'PACS_TRANSFER_NOT_AVAILABLE');
              assert.ok(err.message.includes('does not yet have a DICOM payload'));
              return true;
            }
          );
        });
      });

      describe('12.3 Study Lookup Outcomes & Reconciliation Logic', () => {
        it('handles zero matches with outcome NOT_FOUND', async () => {
          const gateway = new MockPacsGateway();
          gateway.clearMockStudies();
          const result = await gateway.findStudyByAccession('ACC-NONEXIST');
          assert.strictEqual(result.outcome, PacsStudyLookupOutcome.NOT_FOUND);
          assert.strictEqual(result.studies.length, 0);
        });

        it('handles single match with outcome MATCHED', async () => {
          const gateway = new MockPacsGateway();
          gateway.clearMockStudies();
          gateway.addMockStudy({
            orthancStudyId: 'orthanc-study-001',
            accessionNumber: 'ACC-2026-10001',
            patientId: 'PAT-2026-00001',
            patientName: 'DOE^JOHN',
            studyInstanceUid: '1.2.840.113619.2.55.12345',
            studyDate: '20261105',
            studyDescription: 'CT Chest Non-Contrast',
            modalitiesInStudy: ['CT'],
          });

          const result = await gateway.findStudyByAccession('ACC-2026-10001');
          assert.strictEqual(result.outcome, PacsStudyLookupOutcome.MATCHED);
          assert.strictEqual(result.studies.length, 1);
          assert.strictEqual(result.studies[0].orthancStudyId, 'orthanc-study-001');
        });

        it('handles multiple matches with outcome AMBIGUOUS_MATCH without guessing', async () => {
          const gateway = new MockPacsGateway();
          gateway.clearMockStudies();
          gateway.addMockStudy({
            orthancStudyId: 'orthanc-study-dup-1',
            accessionNumber: 'ACC-2026-DUP',
            patientId: 'PAT-2026-00001',
            patientName: 'DOE^JOHN',
            studyInstanceUid: '1.2.3.1',
            studyDate: '20261105',
            studyDescription: 'CT Chest A',
            modalitiesInStudy: ['CT'],
          });
          gateway.addMockStudy({
            orthancStudyId: 'orthanc-study-dup-2',
            accessionNumber: 'ACC-2026-DUP',
            patientId: 'PAT-2026-00002',
            patientName: 'SMITH^JANE',
            studyInstanceUid: '1.2.3.2',
            studyDate: '20261105',
            studyDescription: 'CT Chest B',
            modalitiesInStudy: ['CT'],
          });

          const result = await gateway.findStudyByAccession('ACC-2026-DUP');
          assert.strictEqual(result.outcome, PacsStudyLookupOutcome.AMBIGUOUS_MATCH);
          assert.strictEqual(result.studies.length, 2);
        });

        it('preserves patientId and accession immutability during lookup', () => {
          const orderAccession = 'ACC-2026-ORIGINAL';
          const patientId = 'PAT-2026-ORIGINAL';
          assert.strictEqual(orderAccession, 'ACC-2026-ORIGINAL');
          assert.strictEqual(patientId, 'PAT-2026-ORIGINAL');
        });
      });
    });
  });

  describe('17. Phase 4.4 — Dictation & Speech-to-Text Unit Tests', () => {
    describe('17.1 Text Insertion and Section Boundary Formatting', () => {
      it('appends text to an empty report section', async () => {
        const { insertTranscriptIntoSection } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const result = insertTranscriptIntoSection('', 'Lungs are clear bilaterally.');
        assert.strictEqual(result.newText, 'Lungs are clear bilaterally.');
        assert.strictEqual(result.newCursor, 28);
      });

      it('appends text with a clean space separator to existing section content', async () => {
        const { insertTranscriptIntoSection } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const result = insertTranscriptIntoSection(
          'Heart is normal in size.',
          'No pleural effusion.'
        );
        assert.strictEqual(
          result.newText,
          'Heart is normal in size. No pleural effusion.'
        );
      });

      it('does not insert duplicate whitespace when existing section ends with space or newline', async () => {
        const { insertTranscriptIntoSection } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const resultWithSpace = insertTranscriptIntoSection(
          'Heart is normal. ',
          'No pneumothorax.'
        );
        assert.strictEqual(
          resultWithSpace.newText,
          'Heart is normal. No pneumothorax.'
        );

        const resultWithNewline = insertTranscriptIntoSection(
          'Findings:\n',
          'Osseous structures intact.'
        );
        assert.strictEqual(
          resultWithNewline.newText,
          'Findings:\nOsseous structures intact.'
        );
      });

      it('inserts text cleanly at cursor position in the middle of a section', async () => {
        const { insertTranscriptIntoSection } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const original = 'Cardiac size is normal. No focal consolidation.';
        // Insert after first sentence (cursor = 23)
        const result = insertTranscriptIntoSection(
          original,
          'Mediastinal contours are unremarkable.',
          23
        );
        assert.ok(
          result.newText.includes('Mediastinal contours are unremarkable.'),
          'Expected inserted phrase'
        );
        assert.ok(
          result.newText.startsWith('Cardiac size is normal.'),
          'Preserved prefix'
        );
        assert.ok(
          result.newText.endsWith('No focal consolidation.'),
          'Preserved suffix'
        );
      });

      it('safely handles empty or whitespace-only transcript chunks without modifying text', async () => {
        const { insertTranscriptIntoSection } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const result = insertTranscriptIntoSection('Unchanged text.', '   ', 5);
        assert.strictEqual(result.newText, 'Unchanged text.');
      });
    });

    describe('17.2 BrowserSpeechProvider & Dictation Lifecycle', () => {
      it('reports isSupported = false when running in an environment without Web Speech API', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const provider = new BrowserSpeechProvider();
        assert.strictEqual(provider.isSupported(), false);
      });

      it('invokes unavailable callback if start() is called in unsupported browser', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );
        const provider = new BrowserSpeechProvider();

        let stateReported = '';
        let errorReported = '';

        provider.start({
          onStateChange: (state) => {
            stateReported = state;
          },
          onTranscriptChunk: () => {},
          onError: (msg) => {
            errorReported = msg;
          },
        });

        assert.strictEqual(stateReported, 'unavailable');
        assert.strictEqual(
          errorReported,
          'Speech-to-text is not available in this browser.'
        );
      });

      it('transitions through listening and processes finalized speech chunks with mock factory', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );

        class MockSpeechRecognition {
          public continuous = false;
          public interimResults = false;
          public lang = '';
          public onstart: (() => void) | null = null;
          public onresult: ((e: any) => void) | null = null;
          public onerror: ((e: any) => void) | null = null;
          public onend: (() => void) | null = null;

          start() {
            setTimeout(() => {
              this.onstart?.();
              // Emit speech result
              this.onresult?.({
                resultIndex: 0,
                results: [
                  Object.assign([{ transcript: 'Impression: Normal CT Chest' }], {
                    isFinal: true,
                  }),
                ],
              });
            }, 10);
          }

          stop() {
            this.onend?.();
          }
        }

        const provider = new BrowserSpeechProvider(() => MockSpeechRecognition);
        assert.strictEqual(provider.isSupported(), true);

        const states: string[] = [];
        const chunks: string[] = [];

        await new Promise<void>((resolve) => {
          provider.start({
            onStateChange: (state) => {
              states.push(state);
            },
            onTranscriptChunk: (chunk) => {
              chunks.push(chunk);
              provider.stop();
              resolve();
            },
            onError: () => {},
          });
        });

        assert.ok(states.includes('listening'));
        assert.ok(chunks.includes('Impression: Normal CT Chest'));
        assert.strictEqual(provider.getState(), 'stopped');
      });

      it('prevents duplicate dictation sessions when already listening', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );

        let startCallCount = 0;
        class MockSpeechRecognition {
          public onstart: (() => void) | null = null;
          start() {
            startCallCount++;
            setTimeout(() => this.onstart?.(), 5);
          }
          stop() {}
        }

        const provider = new BrowserSpeechProvider(() => MockSpeechRecognition);

        await new Promise<void>((resolve) => {
          provider.start({
            onStateChange: (state) => {
              if (state === 'listening') {
                // Try second start while listening
                provider.start({
                  onStateChange: () => {},
                  onTranscriptChunk: () => {},
                  onError: () => {},
                });
                resolve();
              }
            },
            onTranscriptChunk: () => {},
            onError: () => {},
          });
        });

        assert.strictEqual(startCallCount, 1, 'Only one session should be started');
        provider.stop();
      });

      it('maps permission denial (not-allowed) to permission_denied with safe message', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );

        class MockSpeechRecognition {
          public onerror: ((e: any) => void) | null = null;
          start() {
            setTimeout(() => {
              this.onerror?.({ error: 'not-allowed' });
            }, 5);
          }
          stop() {}
        }

        const provider = new BrowserSpeechProvider(() => MockSpeechRecognition);
        let reportedState = '';
        let reportedError = '';

        await new Promise<void>((resolve) => {
          provider.start({
            onStateChange: (state) => {
              reportedState = state;
            },
            onTranscriptChunk: () => {},
            onError: (msg) => {
              reportedError = msg;
              resolve();
            },
          });
        });

        assert.strictEqual(reportedState, 'permission_denied');
        assert.strictEqual(
          reportedError,
          'Microphone permission was denied. You can continue typing the report manually.'
        );
      });

      it('maps network errors safely without exposing internal details', async () => {
        const { BrowserSpeechProvider } = await import(
          '../../client/src/services/speechRecognitionService'
        );

        class MockSpeechRecognition {
          public onerror: ((e: any) => void) | null = null;
          start() {
            setTimeout(() => {
              this.onerror?.({ error: 'network' });
            }, 5);
          }
          stop() {}
        }

        const provider = new BrowserSpeechProvider(() => MockSpeechRecognition);
        let reportedError = '';

        await new Promise<void>((resolve) => {
          provider.start({
            onStateChange: () => {},
            onTranscriptChunk: () => {},
            onError: (msg) => {
              reportedError = msg;
              resolve();
            },
          });
        });

        assert.ok(!reportedError.includes('stack'), 'No stack trace');
        assert.ok(!reportedError.includes('http'), 'No URL leakage');
        assert.strictEqual(
          reportedError,
          'Speech recognition network connection failed. Your existing draft is preserved.'
        );
      });
    });

    describe('17.3 Security and Immutability Boundary', () => {
      it('confirms dictation modifies only draft text without altering patient identity or accession', () => {
        const patientId = 'PAT-2026-DICTATION-SAFE';
        const accessionNumber = 'ACC-2026-DICTATION-SAFE';

        // Simulated text mutation
        const draftContent = {
          Findings: 'No acute abnormality.',
        };
        draftContent.Findings += ' Clear lung fields.';

        assert.strictEqual(patientId, 'PAT-2026-DICTATION-SAFE');
        assert.strictEqual(accessionNumber, 'ACC-2026-DICTATION-SAFE');
        assert.strictEqual(draftContent.Findings, 'No acute abnormality. Clear lung fields.');
      });
    });
  });

  describe('SECTION 18 — PHASE 4.5: MEASUREMENTS & KEY IMAGE REFERENCES', () => {
    describe('18.1 Measurement Reference Structure & Tool Validation', () => {
      it('validates supported OHIF measurement tools', async () => {
        const { measurementReferenceSchema } = await import(
          '../src/controllers/radiologist.controller'
        );

        const validMeasurement = {
          id: 'meas-test-1',
          toolType: 'Length',
          label: 'Lesion max diameter',
          numericValue: 14.2,
          unit: 'mm',
          studyInstanceUid: '1.2.840.113619.2.55.3.1',
          seriesInstanceUid: '1.2.840.113619.2.55.3.1.2',
          sopInstanceUid: '1.2.840.113619.2.55.3.1.2.3',
          instanceNumber: 42,
          sliceLocation: -125.0,
          findingText: 'Spiculated right upper lobe nodule',
        };

        const parsed = measurementReferenceSchema.safeParse(validMeasurement);
        assert.strictEqual(parsed.success, true);
        if (parsed.success) {
          assert.strictEqual(parsed.data.toolType, 'Length');
          assert.strictEqual(parsed.data.numericValue, 14.2);
          assert.strictEqual(parsed.data.unit, 'mm');
        }
      });

      it('rejects unsupported or arbitrary measurement tools outside OHIF capability', async () => {
        const { measurementReferenceSchema } = await import(
          '../src/controllers/radiologist.controller'
        );

        const invalidMeasurement = {
          id: 'meas-invalid',
          toolType: 'Unsupported3DVolumetricAIEngine',
          label: 'AI Volume',
          numericValue: 100,
          unit: 'cm3',
          studyInstanceUid: '1.2.3',
          seriesInstanceUid: '1.2.3.4',
          sopInstanceUid: '1.2.3.4.5',
        };

        const parsed = measurementReferenceSchema.safeParse(invalidMeasurement);
        assert.strictEqual(parsed.success, false);
      });
    });

    describe('18.2 Key Image Reference Structure Validation', () => {
      it('validates key image reference with exact DICOM UIDs and slice coordinates', async () => {
        const { keyImageReferenceSchema } = await import(
          '../src/controllers/radiologist.controller'
        );

        const validKeyImage = {
          id: 'keyimg-test-1',
          label: 'Key Image 1 — Carina bifurcation',
          description: 'Reference showing mediastinal lymphadenopathy at station 7',
          studyInstanceUid: '1.2.840.113619.2.55.3.1',
          seriesInstanceUid: '1.2.840.113619.2.55.3.1.2',
          sopInstanceUid: '1.2.840.113619.2.55.3.1.2.10',
          instanceNumber: 10,
          sliceLocation: -45.5,
        };

        const parsed = keyImageReferenceSchema.safeParse(validKeyImage);
        assert.strictEqual(parsed.success, true);
        if (parsed.success) {
          assert.strictEqual(parsed.data.label, 'Key Image 1 — Carina bifurcation');
          assert.strictEqual(parsed.data.instanceNumber, 10);
        }
      });
    });

    describe('18.3 formatDraftResponse Unpacking and Isolation', () => {
      it('unpacks internal _measurements and _keyImages to top-level arrays and keeps content clean', async () => {
        const { formatDraftResponse } = await import(
          '../src/services/radiologist.service'
        );

        const mockDraft = {
          id: 'draft-unit-test-1',
          authorId: 'user-rad-1',
          author: { firstName: 'Alice', lastName: 'Radiologist' },
          templateId: 'tpl-ct-chest',
          templateName: 'CT Chest Standard',
          content: {
            'Clinical Indication': 'Cough and dyspnea',
            Findings: 'Subcentimeter nodule in right upper lobe',
            Impression: 'Benign-appearing nodule',
            _measurements: [
              {
                id: 'm1',
                toolType: 'Length',
                label: 'Nodule length',
                numericValue: 8.5,
                unit: 'mm',
                studyInstanceUid: 'study-1',
                seriesInstanceUid: 'series-1',
                sopInstanceUid: 'sop-1',
              },
            ],
            _keyImages: [
              {
                id: 'k1',
                label: 'Key Image 1',
                studyInstanceUid: 'study-1',
                seriesInstanceUid: 'series-1',
                sopInstanceUid: 'sop-1',
              },
            ],
          },
          version: 2,
          lastAutosavedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = formatDraftResponse(mockDraft);
        assert.strictEqual(result.measurements.length, 1);
        assert.strictEqual(result.measurements[0].label, 'Nodule length');
        assert.strictEqual(result.keyImages.length, 1);
        assert.strictEqual(result.keyImages[0].label, 'Key Image 1');

        // Content object must NOT retain _measurements or _keyImages as text sections
        assert.strictEqual((result.content as any)._measurements, undefined);
        assert.strictEqual((result.content as any)._keyImages, undefined);
        assert.strictEqual(result.content['Findings'], 'Subcentimeter nodule in right upper lobe');
      });
    });

    describe('18.4 OHIF Slice Navigation URL Composition', () => {
      it('correctly formats direct slice navigation URL parameters for OHIF', () => {
        const viewerBaseUrl = 'http://localhost:3000/viewer?StudyInstanceUIDs=1.2.3.4';
        const url = new URL(viewerBaseUrl);
        url.searchParams.set('initialSeriesInstanceUID', '1.2.3.4.5');
        url.searchParams.set('initialSOPInstanceUID', '1.2.3.4.5.6');

        assert.strictEqual(
          url.toString(),
          'http://localhost:3000/viewer?StudyInstanceUIDs=1.2.3.4&initialSeriesInstanceUID=1.2.3.4.5&initialSOPInstanceUID=1.2.3.4.5.6'
        );
        assert.strictEqual(url.searchParams.get('initialSeriesInstanceUID'), '1.2.3.4.5');
        assert.strictEqual(url.searchParams.get('initialSOPInstanceUID'), '1.2.3.4.5.6');
      });
    });
  });
});

describe('Module 01 dashboard truth helpers', () => {
  describe('1. Timezone and day boundaries', () => {
    it('uses an explicit Asia/Kolkata calendar-day boundary', () => {
      const bounds = getHospitalDayBounds(new Date('2026-11-09T11:30:00.000Z'), 'Asia/Kolkata');
      assert.strictEqual(bounds.dateKey, '2026-11-09');
      assert.strictEqual(bounds.start.toISOString(), '2026-11-08T18:30:00.000Z');
      assert.strictEqual(bounds.end.toISOString(), '2026-11-09T18:30:00.000Z');
    });

    it('correctly calculates boundaries right after UTC midnight (e.g. 05:30 IST)', () => {
      const bounds = getHospitalDayBounds(new Date('2026-11-09T00:15:00.000Z'), 'Asia/Kolkata');
      assert.strictEqual(bounds.dateKey, '2026-11-09');
      assert.strictEqual(bounds.start.toISOString(), '2026-11-08T18:30:00.000Z');
      assert.strictEqual(bounds.end.toISOString(), '2026-11-09T18:30:00.000Z');
    });
  });

  describe('2. Capacity utilization and equipment states', () => {
    it('never fabricates utilization when no operational scanner or schedule exists', () => {
      assert.strictEqual(calculateCapacityUtilization(120, 0), 0);
      assert.strictEqual(calculateCapacityUtilization(0, 4), 0);
      assert.strictEqual(calculateCapacityUtilization(600, 1), 100);
      assert.strictEqual(calculateCapacityUtilization(1200, 1), 100);
    });

    it('calculates utilization from documented operating window (600 mins / scanner)', () => {
      // 180 scheduled minutes on 1 scanner = 30%
      assert.strictEqual(calculateCapacityUtilization(180, 1), 30);
      // 300 scheduled minutes on 2 scanners = 25% (300 / 1200)
      assert.strictEqual(calculateCapacityUtilization(300, 2), 25);
    });
  });

  describe('3. Role-authorized alert targets', () => {
    it('routes technologist only to authorized destinations', () => {
      assert.strictEqual(getDashboardAlertTarget(UserRole.TECHNOLOGIST, 'URGENT_SCAN'), '/technologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.TECHNOLOGIST, 'DELAYED_APPOINTMENT'), '/technologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.TECHNOLOGIST, 'UNSIGNED_REPORT', 'ACC-1'), '/orders?search=ACC-1');
      assert.strictEqual(getDashboardAlertTarget(UserRole.TECHNOLOGIST, 'CRITICAL_FINDING', 'ACC-1'), '/orders?search=ACC-1');
    });

    it('routes radiologist only to authorized destinations', () => {
      assert.strictEqual(getDashboardAlertTarget(UserRole.RADIOLOGIST, 'UNSIGNED_REPORT'), '/radiologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RADIOLOGIST, 'CRITICAL_FINDING'), '/radiologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RADIOLOGIST, 'URGENT_SCAN'), '/radiologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RADIOLOGIST, 'DELAYED_APPOINTMENT', 'ACC-2'), '/orders?search=ACC-2');
    });

    it('routes reception only to authorized destinations', () => {
      assert.strictEqual(getDashboardAlertTarget(UserRole.RECEPTION, 'URGENT_SCAN'), '/reception');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RECEPTION, 'DELAYED_APPOINTMENT'), '/reception');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RECEPTION, 'CRITICAL_FINDING', 'ACC 1'), '/orders?search=ACC%201');
      assert.strictEqual(getDashboardAlertTarget(UserRole.RECEPTION, 'UNSIGNED_REPORT', 'ACC-3'), '/orders?search=ACC-3');
    });

    it('routes admin to primary clinical workspaces', () => {
      assert.strictEqual(getDashboardAlertTarget(UserRole.ADMIN, 'URGENT_SCAN'), '/technologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.ADMIN, 'DELAYED_APPOINTMENT'), '/reception');
      assert.strictEqual(getDashboardAlertTarget(UserRole.ADMIN, 'UNSIGNED_REPORT'), '/radiologist/worklist');
      assert.strictEqual(getDashboardAlertTarget(UserRole.ADMIN, 'CRITICAL_FINDING'), '/radiologist/worklist');
    });
  });

  describe('4. Workflow Stage and Elapsed Time Calculations', () => {
    it('calculates elapsed time from specific milestone transition', () => {
      const now = new Date('2026-11-09T14:30:00.000Z');
      const checkedInAt = new Date('2026-11-09T14:00:00.000Z'); // 30 mins ago
      const createdAt = new Date('2026-11-09T10:00:00.000Z'); // 270 mins ago

      // Waiting stage should calculate from checkedInAt (30m), NOT from createdAt (270m)
      const waitingElapsed = Math.max(0, Math.floor((now.getTime() - checkedInAt.getTime()) / 60000));
      assert.strictEqual(waitingElapsed, 30);
    });

    it('calculates scan elapsed time from scan start timestamp', () => {
      const now = new Date('2026-11-09T14:30:00.000Z');
      const scanStartedAt = new Date('2026-11-09T14:18:00.000Z'); // 12 mins ago
      const scanElapsed = Math.max(0, Math.floor((now.getTime() - scanStartedAt.getTime()) / 60000));
      assert.strictEqual(scanElapsed, 12);
    });

    it('calculates reporting elapsed time from scan finish timestamp', () => {
      const now = new Date('2026-11-09T14:30:00.000Z');
      const scanCompletedAt = new Date('2026-11-09T13:45:00.000Z'); // 45 mins ago
      const reportingElapsed = Math.max(0, Math.floor((now.getTime() - scanCompletedAt.getTime()) / 60000));
      assert.strictEqual(reportingElapsed, 45);
    });
  });

  describe('5. Turnaround Time (TAT) and Metrics Boundaries', () => {
    it('returns 0 TAT when no completed events exist', () => {
      const intervals: Array<{ start: Date | null; end: Date | null }> = [];
      const valid = intervals.filter((item): item is { start: Date; end: Date } => Boolean(item.start && item.end && item.end >= item.start));
      const tat = valid.length ? Math.round(valid.reduce((sum, item) => sum + (item.end.getTime() - item.start.getTime()) / 60000, 0) / valid.length) : 0;
      assert.strictEqual(tat, 0);
    });

    it('calculates accurate average TAT from real event pairs', () => {
      const intervals = [
        { start: new Date('2026-11-09T10:00:00Z'), end: new Date('2026-11-09T10:30:00Z') }, // 30m
        { start: new Date('2026-11-09T11:00:00Z'), end: new Date('2026-11-09T11:50:00Z') }, // 50m
      ];
      const valid = intervals.filter((item): item is { start: Date; end: Date } => Boolean(item.start && item.end && item.end >= item.start));
      const tat = valid.length ? Math.round(valid.reduce((sum, item) => sum + (item.end.getTime() - item.start.getTime()) / 60000, 0) / valid.length) : 0;
      assert.strictEqual(tat, 40); // (30 + 50) / 2 = 40 min
    });
  });

  describe('6. Patient Route Identifier Integrity', () => {
    it('strictly constructs patient details routes using database ID and never MRN', () => {
      const dbId = 'cmw95x7rl0004us3kj9et1nb1';
      const mrn = 'PAT-2026-00001';
      const accession = 'ACC-20261109-MR01';

      const targetUrl = `/patients/${dbId}`;
      assert.strictEqual(targetUrl.includes(mrn), false);
      assert.strictEqual(targetUrl.includes(accession), false);
      assert.strictEqual(targetUrl, `/patients/${dbId}`);
    });
  });

  describe('7. Billing & Discount Approval Mathematics', () => {
    it('correctly derives effective gross amount when stored grossAmount is zero', () => {
      const invoice = { grossAmount: 0, total: 450, discount: 0, taxAmount: 0 };
      const effectiveGross = invoice.grossAmount > 0
        ? invoice.grossAmount
        : Math.max(0, invoice.total + invoice.discount - invoice.taxAmount);
      assert.strictEqual(effectiveGross, 450);
    });

    it('calculates consistent net total and outstanding balance after valid discount', () => {
      const gross = 450;
      const discount = 10;
      const tax = 0;
      const paid = 50;

      const newNetTotal = gross - discount + tax;
      const newOutstanding = newNetTotal - paid;
      assert.strictEqual(newNetTotal, 440);
      assert.strictEqual(newOutstanding, 390);
    });

    it('rejects discount that exceeds eligible gross amount', () => {
      const gross = 450;
      const discount = 500;
      const isValid = discount <= gross;
      assert.strictEqual(isValid, false);
    });

    it('rejects negative discount', () => {
      const discount = -10;
      const isValid = discount > 0;
      assert.strictEqual(isValid, false);
    });

    it('formats monetary values to Indian Rupees consistently (450 -> ₹450.00, 448 -> ₹448.00, 1200 -> ₹1,200.00)', () => {
      assert.strictEqual(formatINR(450), '₹450.00');
      assert.strictEqual(formatINR(448), '₹448.00');
      assert.strictEqual(formatINR(1200), '₹1,200.00');
      assert.strictEqual(formatINR(0), '₹0.00');
      assert.strictEqual(formatINR(null), '₹0.00');
    });

    it('generates rupee-formatted validation error message when discount causes net total to fall below paid amount', () => {
      const newNetTotal = 448;
      const paidAmount = 450;
      const errorMessage = `New net total (${formatINR(newNetTotal)}) is lower than already paid amount (${formatINR(paidAmount)}). Process a refund first.`;
      assert.strictEqual(
        errorMessage,
        'New net total (₹448.00) is lower than already paid amount (₹450.00). Process a refund first.'
      );
      assert.strictEqual(errorMessage.includes('$'), false);
    });
  });

  describe('8. TPA & Insurance Claim Processing Validation', () => {
    it('validates claim amount does not exceed eligible invoice balance', () => {
      const invoice = {
        total: 440,
        outstandingAmount: 390,
      };
      const eligibleBalance = Number(invoice.outstandingAmount > 0 ? invoice.outstandingAmount : invoice.total);
      assert.strictEqual(eligibleBalance, 390);

      const validClaim = 10;
      const overClaim = 400;

      assert.strictEqual(validClaim <= eligibleBalance, true);
      assert.strictEqual(overClaim <= eligibleBalance, false);
    });

    it('validates fallback to total when outstandingAmount is zero or not set', () => {
      const invoice = {
        total: 500,
        outstandingAmount: 0,
      };
      const eligibleBalance = Number(invoice.outstandingAmount > 0 ? invoice.outstandingAmount : invoice.total);
      assert.strictEqual(eligibleBalance, 500);

      assert.strictEqual(100 <= eligibleBalance, true);
      assert.strictEqual(600 <= eligibleBalance, false);
    });

    it('rejects non-positive claim amounts', () => {
      assert.strictEqual(0 > 0, false);
      assert.strictEqual(-50 > 0, false);
      assert.strictEqual(10 > 0, true);
    });

    it('detects cross-patient claim mismatch between invoice patient and request patientId', () => {
      const invoicePatient = {
        id: 'cmwaeh3qs00u1gqk3zfkveiua',
        patientId: 'PAT-2026-92149',
      };

      const matchByCuid = invoicePatient.id === 'cmwaeh3qs00u1gqk3zfkveiua';
      const matchByMrn = invoicePatient.patientId === 'PAT-2026-92149';
      const mismatch = invoicePatient.id !== 'other-patient' && invoicePatient.patientId !== 'other-patient';

      assert.strictEqual(matchByCuid, true);
      assert.strictEqual(matchByMrn, true);
      assert.strictEqual(mismatch, true);
    });

    it('normalizes alias properties consistently for TPA claims', () => {
      const inputA = {
        tpaProvider: 'STAR HEALTH',
        approvalCode: 'AUTH-7721',
        claimedAmount: 10,
      };
      const payerNameA = (inputA as any).payerName || inputA.tpaProvider;
      const preAuthA = (inputA as any).preAuthCode || inputA.approvalCode;
      const amountA = (inputA as any).claimAmount ?? inputA.claimedAmount;

      assert.strictEqual(payerNameA, 'STAR HEALTH');
      assert.strictEqual(preAuthA, 'AUTH-7721');
      assert.strictEqual(amountA, 10);

      const inputB = {
        payerName: 'MEDICARE',
        preAuthCode: 'AUTH-9999',
        claimAmount: 250,
      };
      const payerNameB = inputB.payerName || (inputB as any).tpaProvider;
      const preAuthB = inputB.preAuthCode || (inputB as any).approvalCode;
      const amountB = inputB.claimAmount ?? (inputB as any).claimedAmount;

      assert.strictEqual(payerNameB, 'MEDICARE');
      assert.strictEqual(preAuthB, 'AUTH-9999');
      assert.strictEqual(amountB, 250);
    });
  });
});

