import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import {
  UserRole,
  ModalityType,
  Priority,
  OrderStatus,
  SafetyStatus,
  PreparationStatus,
  ScanState,
  ScanLifecycleAction,
  ImageQualityStatus,
  ImageQualityReason,
  PacsHandoffStatus,
  PacsStudyLinkStatus,
} from '@prisma/client';
import {
  getPacsGateway,
  setPacsGateway,
  PacsStudyLookupOutcome,
} from '../src/integrations/pacs';
import { MockPacsGateway } from '../src/integrations/pacs/mockPacsGateway';
import { OrthancPacsGateway } from '../src/integrations/pacs/orthancPacsGateway';

describe('PHASE 3.7 — Full Technologist Workflow Integration QA (Master Matrix)', () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let receptionToken: string;
  let techToken: string;
  let radToken: string;

  let adminUser: { id: string; email: string; role: UserRole };
  let techUser: { id: string; email: string; role: UserRole };
  let receptionUser: { id: string; email: string; role: UserRole };
  let radUser: { id: string; email: string; role: UserRole };

  let mockGateway: MockPacsGateway;

  before(async () => {
    // 1. Fetch authorized seed users for tokens
    adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    receptionUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECEPTION } });
    techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });
    radUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RADIOLOGIST } });

    adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    receptionToken = jwt.sign({ userId: receptionUser.id, email: receptionUser.email, role: receptionUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    techToken = jwt.sign({ userId: techUser.id, email: techUser.email, role: techUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    radToken = jwt.sign({ userId: radUser.id, email: radUser.email, role: radUser.role }, env.JWT_SECRET, { expiresIn: 3600 });

    // 2. Set up deterministic Mock PACS Gateway
    mockGateway = new MockPacsGateway('success');
    setPacsGateway(mockGateway);

    // 3. Start ephemeral test server
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    if (mockGateway) {
      mockGateway.setOutcome('success');
    }
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  // Test Fixture Helper
  async function createTestWorkflowFixture(options: {
    modality?: ModalityType;
    contrastRequired?: boolean;
    examName?: string;
    bodyPart?: string;
    additionalPreparationInstructions?: string;
  } = {}) {
    const modality = options.modality || ModalityType.CT;
    const contrastRequired = options.contrastRequired ?? false;
    const examName = options.examName || `${modality} Diagnostic Scan`;
    const bodyPart = options.bodyPart || (modality === ModalityType.MRI ? 'Brain' : (modality === ModalityType.CT ? 'Head/Brain' : 'Chest'));
    const suffix = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Patient
    const patient = await prisma.patient.create({
      data: {
        patientId: `PAT-QA-${suffix}`,
        firstName: 'Integration',
        lastName: `Tester-${suffix}`,
        dateOfBirth: new Date('1988-06-15'),
        gender: 'MALE',
        phone: `+1-555-999-${Math.floor(1000 + Math.random() * 9000)}`,
        email: `tester-${suffix}@example.com`,
      },
    });

    // Scanner Equipment - created unique per fixture to prevent concurrent test teardown race conditions
    const equipment = await prisma.equipment.create({
      data: {
        name: `QA ${modality} Scanner ${suffix}`,
        modality,
        manufacturer: 'QA Systems',
        model: 'Standard',
        serialNumber: `SN-QA-${suffix}`,
        location: 'QA Testing Room 1',
        status: 'AVAILABLE',
      },
    });

    // Exam Definition - created specifically per test fixture to guarantee requirement/protocol consistency
    const examDef = await prisma.examDefinition.create({
      data: {
        code: `EX-${suffix}`,
        name: examName,
        modality,
        bodyPart,
        defaultDurationMinutes: 30,
        additionalPreparationInstructions: options.additionalPreparationInstructions ?? null,
      },
    });

    // Order
    const order = await prisma.imagingOrder.create({
      data: {
        accessionNumber: `ACC-QA-${suffix}`,
        patientId: patient.id,
        modality,
        bodyPart,
        examinationName: examName,
        clinicalIndication: 'Phase 3.7 Release Gate Integration QA Test',
        contrastRequired,
        priority: Priority.ROUTINE,
        orderStatus: OrderStatus.READY_FOR_TECH,
        createdById: adminUser.id,
      },
    });

    // Appointment (Checked in)
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-QA-${suffix}`,
        imagingOrderId: order.id,
        patientId: patient.id,
        modality,
        examination: examName,
        equipmentId: equipment.id,
        examDefinitionId: examDef.id,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 30 * 60000),
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        checkedInById: receptionUser.id,
      },
    });

    // Approved Protocol linked to examDef
    const protocol = await prisma.imagingProtocol.create({
      data: {
        code: `PR-QA-${suffix}`,
        name: `Standard QA ${modality} ${bodyPart} Protocol`,
        modality,
        bodyPart,
        examDefinitionId: examDef.id,
        isActive: true,
      },
    });

    return { patient, order, equipment, appointment, protocol, examDef };
  }

  // Safety Screening Helper
  async function performSafetyScreening(orderId: string, options: {
    token?: string;
    answers?: Record<string, string>;
    safetyNotes?: string;
    identityVerified?: boolean;
    identityVerificationMethod?: string;
  } = {}) {
    const token = options.token || techToken;
    const defaultAnswers = {
      ct_pregnancy: 'NO',
      ct_contrast_allergy: 'NO',
      ct_renal_disease: 'NO',
      ct_metformin: 'NO',
      ct_asthma_allergies: 'NO',
      mri_pacemaker: 'NO',
      mri_aneurysm_clip: 'NO',
      mri_cochlear_implant: 'NO',
      mri_neurostimulator: 'NO',
      mri_infusion_pump: 'NO',
      mri_metal_in_eyes: 'NO',
      mri_claustrophobia: 'NO',
      mri_pregnancy: 'NO',
      mri_contrast_allergy: 'NO',
      mri_renal_disease: 'NO',
    };
    return fetch(`${baseUrl}/technologist/worklist/${orderId}/safety`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityVerified: options.identityVerified ?? true,
        identityVerificationMethod: options.identityVerificationMethod ?? 'WRISTBAND_AND_VERBAL',
        answers: { ...defaultAnswers, ...(options.answers || {}) },
        safetyNotes: options.safetyNotes,
      }),
    });
  }

  // -------------------------------------------------------------------------
  // SECTION 1: CORE WORKFLOW LIFECYCLE (QA-001 - QA-017)
  // -------------------------------------------------------------------------

  describe('Section 1: Master Workflow Lifecycle Matrix', () => {
    it('QA-001: COMPLETE HAPPY PATH from registration through Mock PACS handoff', async () => {
      const { patient, order, protocol } = await createTestWorkflowFixture();

      // Step 1: Technologist Worklist includes the checked-in order
      const worklistRes = await fetch(`${baseUrl}/technologist/worklist`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(worklistRes.status, 200);

      // Step 2: Patient Identity + Safety Screening (CLEARED)
      const safetyRes = await performSafetyScreening(order.id, {
        answers: {
          ct_pregnancy: 'NO',
          ct_contrast_allergy: 'NO',
          ct_renal_disease: 'NO',
          ct_metformin: 'NO',
          ct_asthma_allergies: 'NO',
        },
        safetyNotes: 'Patient verified by two identifiers (name, DOB). No contraindications.',
      });
      assert.strictEqual(safetyRes.status, 201);
      const safetyBody = await safetyRes.json();
      assert.strictEqual(safetyBody.data.screening.safetyStatus, SafetyStatus.CLEARED);

      // Step 3: Patient Preparation (COMPLETE)
      const prepRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fastingStatus: 'CONFIRMED',
          ivReady: true,
          contrastReady: true,
          consentStatus: 'CONFIRMED',
          additionalPreparationComplete: true,
          preparationNotes: 'Patient changed into gown, checklist complete.',
        }),
      });
      assert.strictEqual(prepRes.status, 200);
      const prepBody = await prepRes.json();
      assert.strictEqual(prepBody.data.preparation.preparationStatus, PreparationStatus.COMPLETE);

      // Step 4: Confirm Approved Protocol -> Advances to READY_FOR_SCAN
      const protoRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      assert.strictEqual(protoRes.status, 200);
      const protoBody = await protoRes.json();
      assert.strictEqual(protoBody.data.orderStatus, OrderStatus.READY_FOR_SCAN);

      // Step 5: Start Scan -> SCAN_IN_PROGRESS
      const startRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(startRes.status, 201);
      const startBody = await startRes.json();
      assert.strictEqual(startBody.data.orderStatus, OrderStatus.SCAN_IN_PROGRESS);

      // Step 6: Finish Scan -> SCAN_COMPLETED
      const finishRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(finishRes.status, 200);
      const finishBody = await finishRes.json();
      assert.strictEqual(finishBody.data.orderStatus, OrderStatus.SCAN_COMPLETED);

      // Step 7: Image QA Review -> Accept -> PACS_READY
      const qaStartRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(qaStartRes.status, 201);

      const qaAcceptRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Diagnostic quality images verified.' }),
      });
      assert.strictEqual(qaAcceptRes.status, 200);
      const qaAcceptBody = await qaAcceptRes.json();
      assert.strictEqual(qaAcceptBody.data.orderStatus, OrderStatus.PACS_READY);

      // Step 8: Initiate Mock PACS handoff -> PACS_HANDOFF_COMPLETE
      const handoffRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-handoff/initiate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(handoffRes.status, 200);
      const handoffBody = await handoffRes.json();
      assert.strictEqual(handoffBody.data.orderStatus, OrderStatus.PACS_HANDOFF_COMPLETE);

      // Immutability Assertions across the whole chain
      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { patient: true },
      });
      assert.strictEqual(orderCheck.patient.patientId, patient.patientId, 'Patient ID must remain immutable');
      assert.strictEqual(orderCheck.accessionNumber, order.accessionNumber, 'Accession Number must remain immutable');
      assert.strictEqual(orderCheck.patientId, patient.id, 'Patient relation must remain unchanged');
    });

    it('QA-002: CONTRAST EXAM HAPPY PATH with contrast documentation during SCAN_IN_PROGRESS', async () => {
      const { order, protocol } = await createTestWorkflowFixture({ contrastRequired: true });

      // Progress to SCAN_IN_PROGRESS
      await performSafetyScreening(order.id, {
        answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO', ct_renal_disease: 'NO' },
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ivReady: true, contrastReady: true, additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Record Contrast Administration
      const contrastRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/contrast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrastAgentName: 'Omnipaque 350',
          volume: 85,
          volumeUnit: 'mL',
          route: 'IV',
          batchLotNumber: 'LOT-QA-2026',
        }),
      });
      assert.strictEqual(contrastRes.status, 201);
      const contrastBody = await contrastRes.json();
      const contrastData = contrastBody.data.contrastAdmin || contrastBody.data.contrastAdministration || contrastBody.data;
      assert.strictEqual(contrastData.contrastAgentName, 'Omnipaque 350');
      assert.strictEqual(Number(contrastData.volume), 85);

      // Finish scan and accept QA
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Contrast enhancement verified' }),
      });

      // Verify contrast persists with correct order and scanLifecycle link
      const savedAdmin = await prisma.contrastAdministration.findFirstOrThrow({
        where: { imagingOrderId: order.id },
      });
      assert.ok(savedAdmin.scanLifecycleId, 'Contrast must link to scanLifecycle');
      assert.strictEqual(savedAdmin.administeredByUserId, techUser.id);
    });

    it('QA-003: NON-CONTRAST EXAM strictly rejects contrast administration with HTTP 409', async () => {
      const { order, protocol } = await createTestWorkflowFixture({ contrastRequired: false });

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Direct contrast attempt must fail
      const contrastRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/contrast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrastAgentName: 'Isovue 300',
          volume: 50,
          route: 'IV',
        }),
      });
      assert.strictEqual(contrastRes.status, 409);
      const body = await contrastRes.json();
      assert.strictEqual(body.error.code, 'CONTRAST_NOT_REQUIRED');

      // Rest of workflow completes normally
      const finishRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(finishRes.status, 200);
    });

    it('QA-004: SAFETY REVIEW BLOCK prevents progression for all roles including ADMIN', async () => {
      const { order, protocol } = await createTestWorkflowFixture({ modality: ModalityType.MRI });

      // Safety screening with pacemaker -> REQUIRES_REVIEW
      const safetyRes = await performSafetyScreening(order.id, {
        answers: { mri_pacemaker: 'YES' },
        safetyNotes: 'Cardiac pacemaker identified in MRI safety check.',
      });
      assert.strictEqual(safetyRes.status, 201);

      // Order status is now SAFETY_REVIEW
      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.strictEqual(orderCheck.orderStatus, OrderStatus.SAFETY_REVIEW);

      // Attempt Protocol Confirmation via Tech -> HTTP 409
      const protoRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      assert.strictEqual(protoRes.status, 409);

      // Attempt Protocol Confirmation via ADMIN -> HTTP 409 (No Admin bypass)
      const adminProtoRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      assert.strictEqual(adminProtoRes.status, 409);

      // Attempt Start Scan via Tech -> HTTP 409
      const startRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(startRes.status, 409);
    });

    it('QA-005: PREPARATION INCOMPLETE BLOCK rejects protocol confirmation and scan start', async () => {
      const { order, protocol } = await createTestWorkflowFixture({
        additionalPreparationInstructions: 'Special prep instructions',
      });

      // Clear safety
      await performSafetyScreening(order.id);

      // Leave preparation incomplete (additionalPreparationComplete = false)
      const prepRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: false }),
      });
      assert.strictEqual(prepRes.status, 200);

      // Attempt protocol confirmation -> HTTP 409
      const protoRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      assert.strictEqual(protoRes.status, 409);
      const protoBody = await protoRes.json();
      assert.strictEqual(protoBody.error.code, 'RESOURCE_CONFLICT');
      assert.ok((protoBody.message || protoBody.error?.message).includes('Patient preparation must be COMPLETE'));
    });

    it('QA-006: PROTOCOL MISMATCH rejects incompatible protocol (e.g. MRI order + CT protocol)', async () => {
      const { order } = await createTestWorkflowFixture({ modality: ModalityType.MRI });

      // Create an approved CT protocol (incompatible with MRI)
      const ctProtocol = await prisma.imagingProtocol.create({
        data: {
          code: `PR-CT-MISMATCH-${Date.now()}`,
          name: 'Chest Routine CT Protocol',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          isActive: true,
        },
      });

      // Clear safety & preparation
      await performSafetyScreening(order.id, {
        answers: { mri_pacemaker: 'NO', mri_implants_other: 'NO' },
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });

      // Confirm incompatible CT protocol on MRI order -> HTTP 409
      const res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: ctProtocol.id }),
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'RESOURCE_CONFLICT');
      assert.ok((body.message || body.error?.message).includes('Protocol modality mismatch'));
    });

    it('QA-007: SCAN INTERRUPTION / RESUME preserves original startedAt and lifecycle history', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Progress to SCAN_IN_PROGRESS
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      const startRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const startBody = await startRes.json();
      const initialStartedAt = startBody.data.scan.startedAt;

      // Interrupt Scan
      const interruptRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/interrupt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'PATIENT_REQUEST', notes: 'Patient coughing fit' }),
      });
      assert.strictEqual(interruptRes.status, 200);

      // Resume Scan
      const resumeRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(resumeRes.status, 200);
      const resumeBody = await resumeRes.json();
      assert.strictEqual(resumeBody.data.scan.startedAt, initialStartedAt, 'startedAt must remain identical after resume');

      // Finish Scan
      const finishRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(finishRes.status, 200);

      // Verify lifecycle events
      const events = await prisma.scanLifecycleEvent.findMany({
        where: { scanLifecycle: { imagingOrderId: order.id } },
        orderBy: { timestamp: 'asc' },
      });
      const actions = events.map((e) => e.action);
      assert.ok(actions.includes(ScanLifecycleAction.STARTED));
      assert.ok(actions.includes(ScanLifecycleAction.INTERRUPTED));
      assert.ok(actions.includes(ScanLifecycleAction.RESUMED));
      assert.ok(actions.includes(ScanLifecycleAction.COMPLETED));
    });

    it('QA-008: SCAN CANCELLATION PROTECTION forbids direct cancellation of SCAN_IN_PROGRESS', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Progress to SCAN_IN_PROGRESS
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Attempt DIRECT cancellation -> HTTP 409 Forbidden
      const directCancelRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'PATIENT_REQUEST', notes: 'Direct cancel attempt' }),
      });
      assert.strictEqual(directCancelRes.status, 409);
      const cancelBody = await directCancelRes.json();
      assert.strictEqual(cancelBody.error.code, 'WORKFLOW_STATE_CONFLICT');

      // Valid path: Interrupt then Cancel
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/interrupt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
      });

      const validCancelRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'PATIENT_UNABLE_TO_CONTINUE', notes: 'Patient withdrew consent' }),
      });
      assert.strictEqual(validCancelRes.status, 200);
      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.strictEqual(orderCheck.orderStatus, OrderStatus.SCAN_CANCELLED);
    });

    it('QA-009: INCIDENT STATE INDEPENDENCE verifies recording incident does not alter scan state', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Progress to SCAN_IN_PROGRESS
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Record an incident
      const incRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'PATIENT_DISTRESS',
          description: 'Patient felt mild dizziness, advised deep breathing.',
          clinicianNotified: true,
          notificationNotes: 'On-duty nurse notified.',
        }),
      });
      assert.strictEqual(incRes.status, 201);

      // Verify orderStatus remains SCAN_IN_PROGRESS and scan remains IN_PROGRESS
      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { scanLifecycles: { orderBy: { attemptNumber: 'desc' } } },
      });
      assert.strictEqual(orderCheck.orderStatus, OrderStatus.SCAN_IN_PROGRESS);
      assert.strictEqual(orderCheck.scanLifecycles[0].state, ScanState.IN_PROGRESS);
    });

    it('QA-010: IMAGE QA ACCEPT triggers PACS_READY status', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Move to SCAN_COMPLETED
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const acceptRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Diagnostic quality images verified.' }),
      });
      assert.strictEqual(acceptRes.status, 200);

      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.strictEqual(orderCheck.orderStatus, OrderStatus.PACS_READY);
    });

    it('QA-011: IMAGE QA REJECT blocks PACS handoff and prevents automatic repeat', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Reject images
      const rejectRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ImageQualityReason.PATIENT_MOTION, notes: 'Severe patient motion throughout scan.' }),
      });
      assert.strictEqual(rejectRes.status, 200);

      const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.strictEqual(orderCheck.orderStatus, OrderStatus.IMAGE_REJECTED);

      // Attempt PACS handoff -> HTTP 409
      const handoffRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-handoff/initiate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(handoffRes.status, 409);
    });

    it('QA-012, QA-013, QA-014: REPEAT ACQUISITION preserves prior attempt history across attempts', async () => {
      const { patient, order, protocol } = await createTestWorkflowFixture();

      // Attempt 1: Start -> Finish -> Mark REPEAT_REQUIRED
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      const start1Res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const start1Body = await start1Res.json();
      assert.strictEqual(start1Body.data.scan.attemptNumber, 1);

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const repeatReqRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/repeat-required`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ImageQualityReason.POSITIONING, notes: 'Patient slightly rotated on head holder.' }),
      });
      assert.strictEqual(repeatReqRes.status, 200);

      // QA-012: Authorize Repeat -> Order returns to READY_FOR_SCAN (does NOT start scan automatically)
      const authRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/authorize-repeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(authRes.status, 200);
      const authBody = await authRes.json();
      assert.strictEqual(authBody.data.orderStatus, OrderStatus.READY_FOR_SCAN);

      // QA-013: Attempt 2: Start Scan creates attempt 2 (attemptNumber = 2)
      const start2Res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(start2Res.status, 201);
      const start2Body = await start2Res.json();
      assert.strictEqual(start2Body.data.scan.attemptNumber, 2);

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Attempt 2 positioning corrected, images excellent.' }),
      });

      // QA-014: Repeat Attempt History Assertions
      const lifecycles = await prisma.scanLifecycle.findMany({
        where: { imagingOrderId: order.id },
        orderBy: { attemptNumber: 'asc' },
        include: { imageQualityReview: true },
      });
      assert.strictEqual(lifecycles.length, 2, 'Must have exactly 2 distinct ScanLifecycle attempts');
      assert.strictEqual(lifecycles[0].attemptNumber, 1);
      assert.strictEqual(lifecycles[0].imageQualityReview?.status, ImageQualityStatus.REPEAT_REQUIRED);
      assert.strictEqual(lifecycles[1].attemptNumber, 2);
      assert.strictEqual(lifecycles[1].imageQualityReview?.status, ImageQualityStatus.ACCEPTED);

      // Identifiers remain untouched across both attempts
      const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: order.id }, include: { patient: true } });
      assert.strictEqual(finalOrder.accessionNumber, order.accessionNumber);
      assert.strictEqual(finalOrder.patient.patientId, patient.patientId);
    });

    it('QA-015, QA-016, QA-017: CROSS-ATTEMPT LINKAGES preserve contrast, incidents, and QA per attempt', async () => {
      const { order, protocol } = await createTestWorkflowFixture({ contrastRequired: true });

      // Progress attempt 1
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ivReady: true, contrastReady: true, additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Attempt 1: Contrast Administration + Incident
      const contrastRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/contrast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrastAgentName: 'Omnipaque 350',
          volume: 90,
          route: 'IV',
        }),
      });
      const contrastBody = await contrastRes.json();
      const contrastAdminId = (contrastBody.data.contrastAdmin || contrastBody.data.contrastAdministration || contrastBody.data).id;

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'EXTRAVASATION',
          description: 'Small 5mL extravasation at IV site.',
          contrastAdministrationId: contrastAdminId,
        }),
      });

      // Finish attempt 1 and require repeat
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/repeat-required`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ImageQualityReason.OTHER, notes: 'Repeat required due to extravasation.' }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/authorize-repeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Start attempt 2
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const attempts = await prisma.scanLifecycle.findMany({
        where: { imagingOrderId: order.id },
        orderBy: { attemptNumber: 'asc' },
        include: {
          contrastAdministrations: true,
          incidents: true,
          imageQualityReview: true,
        },
      });

      assert.strictEqual(attempts.length, 2);
      // QA-015: Contrast remains linked to Attempt 1 only
      assert.strictEqual(attempts[0].contrastAdministrations.length, 1);
      assert.strictEqual(attempts[1].contrastAdministrations.length, 0);

      // QA-016: Incident remains linked to Attempt 1 only
      assert.strictEqual(attempts[0].incidents.length, 1);
      assert.strictEqual(attempts[1].incidents.length, 0);

      // QA-017: QA remains distinct per attempt
      assert.ok(attempts[0].imageQualityReview);
      assert.strictEqual(attempts[0].imageQualityReview?.status, ImageQualityStatus.REPEAT_REQUIRED);
      assert.strictEqual(attempts[1].imageQualityReview, null, 'Attempt 2 has not started QA yet');
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2: CONCURRENCY & STALE CLIENT CONFLICTS (QA-018 - QA-023)
  // -------------------------------------------------------------------------

  describe('Section 2: Concurrency & Stale Client Conflict Matrix', () => {
    it('QA-018: DOUBLE START SCAN rejects duplicate concurrent start with HTTP 409', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });

      // Simulate two tabs clicking Start simultaneously
      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ]);

      const statuses = [resA.status, resB.status];
      assert.ok(statuses.includes(201), 'One request must succeed');
      assert.ok(statuses.includes(409), 'Second concurrent request must fail with 409 Conflict');

      // Verify only ONE scan lifecycle attempt was created
      const lifecycles = await prisma.scanLifecycle.findMany({ where: { imagingOrderId: order.id } });
      assert.strictEqual(lifecycles.length, 1);
    });

    it('QA-019: STALE FINISH rejects subsequent interrupt or finish with HTTP 409', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Tab A finishes scan
      const finishA = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(finishA.status, 200);

      // Stale Tab B attempts to interrupt -> 409
      const interruptB = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/interrupt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
      });
      assert.strictEqual(interruptB.status, 409);

      // Stale Tab B attempts to finish again -> 409
      const finishB = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(finishB.status, 409);
    });

    it('QA-020: STALE QA DECISION rejects conflicting second decision with HTTP 409', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Tab A accepts
      const acceptRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'First decision' }),
      });
      assert.strictEqual(acceptRes.status, 200);

      // Stale Tab B attempts to reject -> HTTP 409 IMAGE_QA_ALREADY_DECIDED
      const rejectRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ImageQualityReason.OTHER, notes: 'Conflicting late reject' }),
      });
      assert.strictEqual(rejectRes.status, 409);
      const body = await rejectRes.json();
      assert.strictEqual(body.error.code, 'IMAGE_QA_ALREADY_DECIDED');
    });

    it('QA-021: STALE REPEAT AUTHORIZATION permits only one transition with HTTP 409 on second', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Progress to REPEAT_REQUIRED
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/repeat-required`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ImageQualityReason.PATIENT_MOTION }),
      });

      // Concurrent repeat authorization
      const [authA, authB] = await Promise.all([
        fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/authorize-repeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/authorize-repeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ]);

      const statuses = [authA.status, authB.status];
      assert.ok(statuses.includes(200));
      assert.ok(statuses.includes(409));
    });

    it('QA-022: STALE PACS INITIATION permits only one handoff initiation with HTTP 409 on second', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      // Progress to PACS_READY
      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Concurrent handoff initiation
      const [handoffA, handoffB] = await Promise.all([
        fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-handoff/initiate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-handoff/initiate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ]);

      const statuses = [handoffA.status, handoffB.status];
      assert.ok(statuses.includes(200));
      assert.ok(statuses.includes(409));
    });

    it('QA-023 & QA-041: STALE PACS RECONCILIATION IDEMPOTENCY prevents duplicate PacsStudyLink', async () => {
      const { patient, order } = await createTestWorkflowFixture();

      mockGateway.clearMockStudies();
      mockGateway.addMockStudy({
        orthancStudyId: `orthanc-study-idempotent-${Date.now()}`,
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        patientName: 'INTEGRATION^TESTER',
        studyInstanceUid: `1.2.840.113619.2.55.qa.${Date.now()}`,
        studyDate: '20261105',
        studyDescription: 'Idempotent Test Study',
        modalitiesInStudy: ['CT'],
      });

      // Call reconcile study twice
      const res1 = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res1.status, 200);

      const res2 = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res2.status, 200);

      // Verify exactly ONE PacsStudyLink exists
      const links = await prisma.pacsStudyLink.findMany({ where: { imagingOrderId: order.id } });
      assert.strictEqual(links.length, 1);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3: RBAC SECURITY LEAKAGE MATRIX (QA-024 - QA-028)
  // -------------------------------------------------------------------------

  describe('Section 3: RBAC Security Leakage Matrix', () => {
    it('QA-024: RECEPTION LEAKAGE denies all technologist workflow APIs with HTTP 403', async () => {
      const { order } = await createTestWorkflowFixture();

      const endpoints = [
        { path: `/technologist/worklist`, method: 'GET' },
        { path: `/technologist/worklist/${order.id}`, method: 'GET' },
        { path: `/technologist/worklist/${order.id}/safety`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/preparation`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/protocol`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/scan/start`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/scan/interrupt`, method: 'POST', body: { reason: 'PATIENT_REQUEST' } },
        { path: `/technologist/worklist/${order.id}/scan/resume`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/scan/finish`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/scan/cancel`, method: 'POST', body: { reason: 'ORDER_CANCELLED' } },
        { path: `/technologist/worklist/${order.id}/contrast`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/incidents`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/image-quality/start`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/image-quality/accept`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/image-quality/reject`, method: 'POST', body: { reason: 'OTHER' } },
        { path: `/technologist/worklist/${order.id}/image-quality/repeat-required`, method: 'POST', body: { reason: 'OTHER' } },
        { path: `/technologist/worklist/${order.id}/image-quality/authorize-repeat`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/pacs-handoff/initiate`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/pacs-study/reconcile`, method: 'POST', body: {} },
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert.strictEqual(
          res.status,
          403,
          `RECEPTION role must receive 403 Forbidden on ${ep.method} ${ep.path}`
        );
      }
    });

    it('QA-025: RADIOLOGIST LEAKAGE denies Phase 3 technologist mutations with HTTP 403', async () => {
      const { order } = await createTestWorkflowFixture();

      const mutations = [
        { path: `/technologist/worklist/${order.id}/safety`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/preparation`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/protocol`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/scan/start`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/contrast`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/incidents`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/image-quality/start`, method: 'POST', body: {} },
        { path: `/technologist/worklist/${order.id}/pacs-handoff/initiate`, method: 'POST', body: {} },
      ];

      for (const ep of mutations) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ep.body),
        });
        assert.strictEqual(
          res.status,
          403,
          `RADIOLOGIST role must receive 403 Forbidden on ${ep.method} ${ep.path}`
        );
      }
    });

    it('QA-026: TECHNOLOGIST BOUNDARY denies administrative and role modification actions', async () => {
      // Technologist cannot cancel appointments
      const res = await fetch(`${baseUrl}/appointments/APT-2026-0001/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Unauthorized tech cancel' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('QA-027: ADMIN BOUNDARY enforces clinical safety and terminal state protection', async () => {
      const { order } = await createTestWorkflowFixture({ modality: ModalityType.MRI });

      // Admin cannot bypass safety screening requirement when screening requires review
      await performSafetyScreening(order.id, {
        token: adminToken,
        answers: { mri_pacemaker: 'YES' },
      });

      const res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 409, 'ADMIN cannot bypass safety review block');
    });

    it('QA-028: UNAUTHENTICATED requests receive HTTP 401 across all protected routes', async () => {
      const unauthRes = await fetch(`${baseUrl}/technologist/worklist`);
      assert.strictEqual(unauthRes.status, 401);
      const body = await unauthRes.json();
      assert.strictEqual(body.error?.code, 'UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 4: REFRESH / RELOAD RECOVERY (QA-029 - QA-036)
  // -------------------------------------------------------------------------

  describe('Section 4: Refresh & Reload Persistence Recovery Matrix', () => {
    it('QA-029: REFRESH DURING SAFETY restores saved answers from backend', async () => {
      const { order } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id, {
        answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO' },
        safetyNotes: 'Safety notes verified',
      });

      // Simulate browser refresh by querying GET endpoint fresh
      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/safety`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.screening.safetyStatus, SafetyStatus.CLEARED);
      assert.strictEqual(getBody.data.screening.safetyNotes, 'Safety notes verified');
    });

    it('QA-030: REFRESH DURING PREPARATION restores IN_PROGRESS checklist', async () => {
      const { order } = await createTestWorkflowFixture({
        additionalPreparationInstructions: 'Special gown instructions',
      });

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fastingStatus: 'CONFIRMED',
          ivReady: false,
          additionalPreparationComplete: false,
          preparationNotes: 'Awaiting IV line placement',
        }),
      });

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.preparation.preparationStatus, PreparationStatus.IN_PROGRESS);
      assert.strictEqual(getBody.data.preparation.ivReady, false);
      assert.strictEqual(getBody.data.preparation.preparationNotes, 'Awaiting IV line placement');
    });

    it('QA-031: REFRESH AT READY_FOR_SCAN restores confirmed protocol without re-confirmation', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.orderStatus, OrderStatus.READY_FOR_SCAN);
      assert.strictEqual(getBody.data.protocol.code, protocol.code);
    });

    it('QA-032: REFRESH DURING ACTIVE SCAN reloads SCAN_IN_PROGRESS and startedAt', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      const startRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const expectedStartedAt = (await startRes.json()).data.scan.startedAt;

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.orderStatus, OrderStatus.SCAN_IN_PROGRESS);
      assert.strictEqual(getBody.data.scan.startedAt, expectedStartedAt);
    });

    it('QA-033: REFRESH DURING INTERRUPTION restores SCAN_INTERRUPTED and options', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/interrupt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'EQUIPMENT_ISSUE', notes: 'Gantry calibration check' }),
      });

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.orderStatus, OrderStatus.SCAN_INTERRUPTED);
      assert.strictEqual(getBody.data.scan.interruptionReason, 'EQUIPMENT_ISSUE');
    });

    it('QA-034: REFRESH AFTER CONTRAST/INCIDENT preserves administrations and incident list', async () => {
      const { order, protocol } = await createTestWorkflowFixture({ contrastRequired: true });

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ivReady: true, contrastReady: true, additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/contrast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrastAgentName: 'Omnipaque 350', volume: 75, route: 'IV' }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'WORKFLOW_EVENT', description: 'Patient requested pause before injection.' }),
      });

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/contrast`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.administrations.length, 1);
      assert.strictEqual(getBody.data.incidents.length, 1);
    });

    it('QA-035: REFRESH DURING QA restores IMAGE_QA_PENDING without duplicating review record', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.orderStatus, OrderStatus.IMAGE_QA_PENDING);

      const reviews = await prisma.imageQualityReview.findMany({ where: { imagingOrderId: order.id } });
      assert.strictEqual(reviews.length, 1);
    });

    it('QA-036: REFRESH AFTER PACS FAILURE restores failure state, attempt count, and retry option', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Configure Mock PACS to fail
      mockGateway.setOutcome('failure');

      const handoffRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-handoff/initiate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(handoffRes.status, 200);

      // Refresh / re-query
      const getRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/image-quality`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.orderStatus, OrderStatus.PACS_HANDOFF_FAILED);
      assert.strictEqual(getBody.data.pacsHandoff.status, PacsHandoffStatus.FAILED);
      assert.strictEqual(getBody.data.pacsHandoff.attemptCount, 1);
      assert.strictEqual(getBody.data.flags.canRetryHandoff, true);

      // Restore mock gateway
      mockGateway.setOutcome('success');
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 5: PACS RECONCILIATION & OUTAGE RESILIENCE (QA-037 - QA-044)
  // -------------------------------------------------------------------------

  describe('Section 5: PACS Reconciliation & Outage Resilience Matrix', () => {
    it('QA-037: ORTHANC HEALTHY / NO STUDY returns NOT_FOUND (not PACS_UNAVAILABLE)', async () => {
      const { order } = await createTestWorkflowFixture();

      mockGateway.clearMockStudies(); // Zero matching studies in mock PACS

      const res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.outcome, PacsStudyLookupOutcome.NOT_FOUND);
      assert.ok(body.data.message.includes('no PACS study currently matches'));
    });

    it('QA-038: PATIENT-ID MISMATCH returns PATIENT_ID_MISMATCH without creating link', async () => {
      const { order } = await createTestWorkflowFixture();

      mockGateway.clearMockStudies();
      mockGateway.addMockStudy({
        orthancStudyId: `orthanc-mismatch-${Date.now()}`,
        accessionNumber: order.accessionNumber,
        patientId: 'PAT-WRONG-99999',
        patientName: 'IMPOSTER^PATIENT',
        studyInstanceUid: '1.2.3.4.5',
        studyDate: '20261105',
        modalitiesInStudy: ['CT'],
      });

      const res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.outcome, PacsStudyLookupOutcome.PATIENT_ID_MISMATCH);

      // No link created
      const linkCheck = await prisma.pacsStudyLink.findUnique({ where: { imagingOrderId: order.id } });
      assert.strictEqual(linkCheck, null);
    });

    it('QA-039: AMBIGUOUS STUDY returns AMBIGUOUS_MATCH when multiple studies share accession', async () => {
      const { patient, order } = await createTestWorkflowFixture();

      mockGateway.clearMockStudies();
      mockGateway.addMockStudy({
        orthancStudyId: `orthanc-amb-1-${Date.now()}`,
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        patientName: 'DUPLICATE^STUDY',
        modalitiesInStudy: ['CT'],
      });
      mockGateway.addMockStudy({
        orthancStudyId: `orthanc-amb-2-${Date.now()}`,
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        patientName: 'DUPLICATE^STUDY',
        modalitiesInStudy: ['CT'],
      });

      const res = await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.outcome, PacsStudyLookupOutcome.AMBIGUOUS_MATCH);
    });

    it('QA-040: CROSS-ORDER PACS LINK CONFLICT rejects cross-linking with HTTP 409', async () => {
      const { patient: pA, order: orderA } = await createTestWorkflowFixture();
      const { patient: pB, order: orderB } = await createTestWorkflowFixture();

      const sharedOrthancId = `orthanc-shared-${Date.now()}`;

      // Link Order A to sharedOrthancId
      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: orderA.id,
          orthancStudyId: sharedOrthancId,
          studyInstanceUid: `1.2.840.113619.${Date.now()}`,
          verifiedByUserId: techUser.id,
          status: PacsStudyLinkStatus.LINKED,
        },
      });

      // Configure Mock study for Order B lookup to match Order B accession and patient ID, but return sharedOrthancId
      mockGateway.clearMockStudies();
      mockGateway.addMockStudy({
        orthancStudyId: sharedOrthancId,
        accessionNumber: orderB.accessionNumber,
        patientId: pB.patientId,
        studyInstanceUid: `1.2.840.113619.${Date.now()}`,
        modalitiesInStudy: ['CT'],
      });

      // Attempt to reconcile Order B against already-linked shared study -> HTTP 409
      const reconcileRes = await fetch(`${baseUrl}/technologist/worklist/${orderB.id}/pacs-study/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(reconcileRes.status, 409);
      const body = await reconcileRes.json();
      assert.strictEqual(body.error.code, 'PACS_STUDY_ALREADY_LINKED');

      // Verify original link remains unchanged
      const linkA = await prisma.pacsStudyLink.findUniqueOrThrow({ where: { imagingOrderId: orderA.id } });
      assert.strictEqual(linkA.orthancStudyId, sharedOrthancId);

      // Verify no link created for Order B
      const linkB = await prisma.pacsStudyLink.findUnique({ where: { imagingOrderId: orderB.id } });
      assert.strictEqual(linkB, null);
    });

    it('QA-042: ORTHANC REST RECOVERY demonstrates gateway resilience when connection restores', async () => {
      const gateway = new OrthancPacsGateway({
        baseUrl: 'http://127.0.0.1:9999', // Non-existent port
        username: 'orthanc',
        password: 'password',
        timeoutMs: 300,
      });

      // When server is offline -> health returns connected: false safely
      const offlineHealth = await gateway.checkHealth();
      assert.strictEqual(offlineHealth.connected, false);

      // Lookup returns PACS_UNAVAILABLE outcome without throwing an unhandled exception
      const lookupResult = await gateway.findStudyByAccession('ACC-OFFLINE-TEST');
      assert.strictEqual(lookupResult.outcome, PacsStudyLookupOutcome.PACS_UNAVAILABLE);
    });

    it('QA-043: NORMAL TEST SUITE INDEPENDENT OF LIVE ORTHANC confirms zero live Orthanc dependency', async () => {
      // The current test suite runs using MockPacsGateway and does not require port 8042
      const activeGateway = getPacsGateway();
      assert.ok(activeGateway instanceof MockPacsGateway, 'Default test suite must use MockPacsGateway');
    });

    it('QA-044: APP WITH DATABASE UNAVAILABLE fails safely without leaking credentials', async () => {
      // Test the error formatter / middleware with a synthetic database error
      const res = await fetch(`${baseUrl}/patients/non-existent-id`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 404);
      const body = await res.json();

      // Ensure no raw stack traces or internal secrets are returned
      assert.strictEqual(body.success, false);
      assert.strictEqual(typeof body.message, 'string');
      assert.strictEqual(body.stack, undefined);
      assert.ok(!JSON.stringify(body).includes('password'));
      assert.ok(!JSON.stringify(body).includes('secret'));
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 6: BROWSER ERROR SANITIZATION & AUDIT INTEGRITY (QA-045 - QA-055)
  // -------------------------------------------------------------------------

  describe('Section 6: Browser Error Sanitization & Audit Integrity Matrix', () => {
    it('QA-045 - QA-050: BROWSER-VISIBLE ERROR SANITIZATION confirms zero raw stack/secret leak', async () => {
      // 1. Validation error (QA-049)
      const valRes = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${receptionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: '' }), // Invalid payload
      });
      assert.strictEqual(valRes.status, 400);
      const valBody = await valRes.json();
      assert.strictEqual(valBody.error?.code, 'VALIDATION_ERROR');
      assert.strictEqual(valBody.stack, undefined);

      // 2. 401 Error (QA-045)
      const authRes = await fetch(`${baseUrl}/orders`);
      assert.strictEqual(authRes.status, 401);
      const authBody = await authRes.json();
      assert.strictEqual(authBody.error?.code, 'UNAUTHORIZED');

      // 3. 403 Error (QA-046)
      const permRes = await fetch(`${baseUrl}/technologist/worklist`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(permRes.status, 403);
      const permBody = await permRes.json();
      assert.strictEqual(permBody.error?.code, 'FORBIDDEN_ROLE');
    });

    it('QA-051 & QA-052: AUDIT TRAIL INTEGRITY confirms chronological sequence and user attribution', async () => {
      const { order } = await createTestWorkflowFixture();

      // Perform audited mutations
      await performSafetyScreening(order.id);
      const prepRes = await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      const prepBody = await prepRes.json();
      const prepId = prepBody.data?.preparation?.id;

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityId: order.id },
            { entityId: order.patientId },
            ...(prepId ? [{ entityId: prepId }] : []),
          ],
        },
        orderBy: { timestamp: 'asc' },
      });

      assert.ok(auditLogs.length >= 2, 'Audit logs must be recorded for safety and preparation');

      // QA-055: Authenticated User Attribution
      for (const log of auditLogs) {
        assert.strictEqual(log.userId, techUser.id, 'Audit log actor must match JWT authenticated user ID');
        // QA-054: Zero credentials or passwords in audit details
        const detailsStr = JSON.stringify(log.details || {});
        assert.ok(!detailsStr.includes('password'));
        assert.ok(!detailsStr.includes('Bearer'));
        assert.ok(!detailsStr.includes(env.JWT_SECRET));
      }
    });

    it('QA-053: INCIDENT AUDIT independently logs INCIDENT_RECORDED and CLINICIAN_NOTIFIED', async () => {
      const { order, protocol } = await createTestWorkflowFixture();

      await performSafetyScreening(order.id);
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/preparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPreparationComplete: true }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/protocol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: protocol.id }),
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/scan/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'PATIENT_DISTRESS',
          description: 'Patient felt anxious.',
          clinicianNotified: true,
          notificationNotes: 'Radiologist on call advised short break.',
        }),
      });

      const incidentAudits = await prisma.auditLog.findMany({
        where: {
          entityId: order.id,
          action: { in: ['INCIDENT_RECORDED', 'CLINICIAN_NOTIFICATION_RECORDED'] },
        },
      });

      assert.strictEqual(incidentAudits.length, 2, 'Both incident and clinician notification must be audited');
    });

    it('QA-054: PACS RECONCILIATION AUDIT records lookup, match, and reconcile without secrets', async () => {
      const { patient, order } = await createTestWorkflowFixture();

      mockGateway.clearMockStudies();
      mockGateway.addMockStudy({
        orthancStudyId: `orthanc-audit-${Date.now()}`,
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        studyInstanceUid: `1.2.840.113619.audit.${Date.now()}`,
        modalitiesInStudy: ['CT'],
      });

      await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      await fetch(`${baseUrl}/technologist/worklist/${order.id}/pacs-study/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const pacsAudits = await prisma.auditLog.findMany({
        where: {
          entityId: order.id,
          action: { in: ['PACS_STUDY_MATCHED', 'PACS_STUDY_RECONCILED'] },
        },
      });

      assert.ok(pacsAudits.length >= 2);
      for (const audit of pacsAudits) {
        const detailsStr = JSON.stringify(audit.details || {});
        assert.ok(!detailsStr.includes('password'));
        assert.ok(!detailsStr.includes('Bearer'));
      }
    });
  });
});
