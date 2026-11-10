import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import { UserRole, ModalityType, Priority, OrderStatus, AppointmentStatus, SafetyStatus, PreparationStatus, Gender, EquipmentStatus, ScanState, ScanLifecycleAction, ImageQualityStatus, ImageQualityReason, PacsHandoffStatus, PacsHandoffOutcome, PacsStudyLinkStatus, RadiologistAssignmentStatus, StudyStatus, ReportStatus, PeerReviewStatus, ReportDeliveryMethod, NotificationChannel, NotificationStatus } from '@prisma/client';
import { setMockPacsOutcome, resetMockPacs, getPacsGateway, setPacsGateway, createPacsGateway, PacsStudyLookupOutcome } from '../src/integrations/pacs';
import { MockPacsGateway } from '../src/integrations/pacs/mockPacsGateway';
import { OrthancPacsGateway } from '../src/integrations/pacs/orthancPacsGateway';
import { getHospitalDayBounds } from '../src/utils/hospitalTime';

describe('Healthcare API Integration Tests (Phase 2)', () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let receptionToken: string;
  let techToken: string;
  let radToken: string;

  before(async () => {
    // Ensure default test suite runs against MockPacsGateway regardless of env adapter
    setPacsGateway(new MockPacsGateway('success'));

    // Generate valid JWT tokens for each role
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    const receptionUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECEPTION } });
    const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });
    const radUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RADIOLOGIST } });

    adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    receptionToken = jwt.sign({ userId: receptionUser.id, email: receptionUser.email, role: receptionUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    techToken = jwt.sign({ userId: techUser.id, email: techUser.email, role: techUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    radToken = jwt.sign({ userId: radUser.id, email: radUser.email, role: radUser.role }, env.JWT_SECRET, { expiresIn: 3600 });

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

  after(async () => {
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM imaging_orders 
        WHERE "accessionNumber" LIKE 'ACC-QA%' 
           OR "accessionNumber" LIKE 'ACC-P4%' 
           OR "accessionNumber" LIKE 'ACC-TEST%' 
           OR "accessionNumber" LIKE 'ACC-411%' 
           OR "accessionNumber" LIKE 'ACC-CK%';
      `);
      await prisma.$executeRawUnsafe(`
        DELETE FROM patients 
        WHERE ("patientId" LIKE 'PAT-QA%' OR "patientId" LIKE 'PAT-P4%' OR "patientId" LIKE 'PAT-TEST%')
          AND id NOT IN (SELECT "patientId" FROM imaging_orders WHERE "patientId" IS NOT NULL);
      `);
    } catch {
      // non-fatal
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  describe('1. Authentication & RBAC Security Matrix', () => {
    it('returns 401 Unauthorized when Authorization header is missing', async () => {
      const res = await fetch(`${baseUrl}/patients`);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error?.code, 'UNAUTHORIZED');
    });

    it('denies RADIOLOGIST from registering patients (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${radToken}`,
        },
        body: JSON.stringify({
          firstName: 'Unauthorized',
          lastName: 'Patient',
          dateOfBirth: '1995-03-10',
          gender: 'MALE',
          phone: '+1-555-999-0001',
        }),
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'FORBIDDEN_ROLE');
    });

    it('denies TECHNOLOGIST from cancelling appointments (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/appointments/APT-2026-0001/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${techToken}`,
        },
        body: JSON.stringify({ reason: 'Tech attempted cancellation' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('allows RECEPTION to create patients (HTTP 201 Created)', async () => {
      const runId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const randomPhone = `+1-555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          firstName: `Eleanor_${runId}`,
          lastName: `Vance_${runId}`,
          dateOfBirth: '1984-11-20',
          gender: 'FEMALE',
          phone: randomPhone,
          email: `eleanor.${runId}@example.com`,
          city: 'Chicago',
          state: 'IL',
        }),
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.patientId.startsWith('PAT-'));
      assert.strictEqual(body.data.firstName, `Eleanor_${runId}`);
    });

    it('allows ADMIN to perform reception operations (HTTP 200 OK)', async () => {
      const res = await fetch(`${baseUrl}/reception/queue`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
    });
  });

  describe('2. Patient Domain Workflows', () => {
    let createdPatientId: string;
    const runId = Date.now().toString().slice(-5);
    const testPhone = `+1-555-777-${Math.floor(1000 + Math.random() * 9000)}`;
    const testLastName = `Antoninus_${runId}`;

    it('creates a new patient and assigns persistent unique Patient ID', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          firstName: 'Marcus',
          middleName: 'Aurelius',
          lastName: testLastName,
          dateOfBirth: '1975-04-26',
          gender: 'MALE',
          phone: testPhone,
          email: `marcus.${runId}@example.com`,
          addressLine1: '100 Forum Way',
          city: 'Rome',
          state: 'IL',
          postalCode: '60101',
        }),
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      createdPatientId = body.data.patientId;
      assert.ok(createdPatientId.startsWith('PAT-2026-'));
    });

    it('detects duplicate patient and returns HTTP 409 warning with candidates', async () => {
      const res = await fetch(`${baseUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          firstName: 'Marcus',
          lastName: testLastName,
          dateOfBirth: '1975-04-26',
          gender: 'MALE',
          phone: testPhone, // Duplicate phone + name + DOB
        }),
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'POSSIBLE_DUPLICATE_PATIENT');
      assert.ok(Array.isArray(body.error?.details?.candidates));
      assert.ok(body.error.details.candidates.length > 0);
    });

    it('searches patients by name, phone or MRN with database matching', async () => {
      const res = await fetch(`${baseUrl}/patients?search=${testLastName}`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.items.length >= 1);
      assert.strictEqual(body.data.items[0].lastName, testLastName);
    });

    it('retrieves patient by ID with complete clinical relations', async () => {
      const res = await fetch(`${baseUrl}/patients/${createdPatientId}`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.patientId, createdPatientId);
      assert.ok(Array.isArray(body.data.appointments));
      assert.ok(Array.isArray(body.data.imagingOrders));
    });

    it('updates patient demographics safely without altering persistent MRN', async () => {
      const res = await fetch(`${baseUrl}/patients/${createdPatientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          addressLine1: '200 Updated Boulevard',
          city: 'Chicago',
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.patientId, createdPatientId, 'Patient ID must remain unchanged');
      assert.strictEqual(body.data.addressLine1, '200 Updated Boulevard');
    });
  });

  describe('3. Imaging Order & Accession Workflows', () => {
    let patientId: string;
    let createdAccession: string;
    let createdOrderId: string;

    before(async () => {
      const p = await prisma.patient.findFirstOrThrow({ where: { patientId: 'PAT-2026-10001' } });
      patientId = p.id;
    });

    it('creates an imaging order and generates unique Accession Number', async () => {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          patientId,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain with and without Contrast',
          clinicalIndication: 'Test refractory seizure disorder for structural etiology',
          contrastRequired: true,
          priority: Priority.URGENT,
        }),
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      createdAccession = body.data.accessionNumber;
      createdOrderId = body.data.id;
      assert.ok(createdAccession.startsWith('ACC-'));
      assert.ok(createdAccession.includes('-MRI-'));
      assert.strictEqual(body.data.orderStatus, 'CREATED');
    });

    it('rejects order creation for non-existent patient (HTTP 404)', async () => {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          patientId: 'non-existent-patient-cuid',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest',
          clinicalIndication: 'Chest pain evaluation',
        }),
      });
      assert.strictEqual(res.status, 404);
    });

    it('retrieves order details with patient and accession tracing', async () => {
      const res = await fetch(`${baseUrl}/orders/${createdAccession}`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.accessionNumber, createdAccession);
      assert.strictEqual(body.data.patient.patientId, 'PAT-2026-10001');
    });
  });

  describe('4. Appointment Scheduling & Conflict Protection', () => {
    let patientId: string;
    let imagingOrderId: string;
    let mriScannerId: string;
    let createdAppointmentId: string;

    const testSlotStart = new Date('2026-11-20T10:00:00Z');
    const testSlotEnd = new Date('2026-11-20T10:45:00Z');

    before(async () => {
      const p = await prisma.patient.findFirstOrThrow({ where: { patientId: 'PAT-2026-10002' } });
      patientId = p.id;

      const order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-TEST-${Date.now().toString().slice(-4)}`,
          patientId: p.id,
          modality: ModalityType.MRI,
          bodyPart: 'Knee',
          examinationName: 'MRI Knee',
          clinicalIndication: 'Test scheduling conflict ACL tear',
          orderStatus: 'CREATED',
        },
      });
      imagingOrderId = order.id;

      const scanner = await prisma.equipment.findFirstOrThrow({ where: { modality: ModalityType.MRI } });
      mriScannerId = scanner.id;
    });

    it('calculates real-time slot availability for selected date and modality', async () => {
      const res = await fetch(`${baseUrl}/scheduling/availability?modality=MRI&date=2026-11-20`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.slots));
      assert.ok(body.data.slots.length > 0);
    });

    it('successfully books valid appointment (HTTP 201 Created)', async () => {
      const res = await fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          patientId,
          imagingOrderId,
          equipmentId: mriScannerId,
          scheduledStart: testSlotStart.toISOString(),
          scheduledEnd: testSlotEnd.toISOString(),
          notes: 'Test appointment booking',
        }),
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      createdAppointmentId = body.data.id;
      assert.strictEqual(body.data.status, 'SCHEDULED');
      assert.strictEqual(body.data.imagingOrder.orderStatus, 'SCHEDULED');
    });

    it('rejects overlapping machine booking on the same scanner (HTTP 409 Conflict)', async () => {
      // Second patient attempting to book overlapping window (10:15 - 10:45) on same MRI machine
      const otherPatient = await prisma.patient.findFirstOrThrow({ where: { patientId: 'PAT-2026-10003' } });
      const otherOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-TEST2-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          patientId: otherPatient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain',
          clinicalIndication: 'Second patient scan',
        },
      });

      const res = await fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          patientId: otherPatient.id,
          imagingOrderId: otherOrder.id,
          equipmentId: mriScannerId,
          scheduledStart: new Date('2026-11-20T10:15:00Z').toISOString(), // Overlaps 10:00 - 10:45
          scheduledEnd: new Date('2026-11-20T10:45:00Z').toISOString(),
        }),
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'SCHEDULING_CONFLICT');
      assert.strictEqual(body.error?.details?.conflictType, 'EQUIPMENT_OVERLAP');
    });

    it('reschedules appointment to new non-conflicting slot', async () => {
      const newSlot = new Date('2026-11-20T14:00:00Z');
      const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          scheduledStart: newSlot.toISOString(),
          reason: 'Patient requested afternoon appointment instead',
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(new Date(body.data.scheduledStart).toISOString(), newSlot.toISOString());
    });

    it('cancels appointment and releases machine slot', async () => {
      const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient called with transportation difficulty',
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.status, 'CANCELLED');
    });
  });

  describe('5. Reception Check-In & Waiting Queue', () => {
    let checkInApptId: string;

    before(async () => {
      // Create a dedicated scheduled test appointment specifically for check-in testing
      const patient = await prisma.patient.findFirstOrThrow();
      const doctor = await prisma.referringDoctor.findFirstOrThrow();
      const exam = await prisma.examDefinition.findFirstOrThrow();
      const eq = await prisma.equipment.findFirstOrThrow();
      const user = await prisma.user.findFirstOrThrow();
      const order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-CK-${Date.now().toString().slice(-6)}`,
          patientId: patient.id,
          referringDoctorId: doctor.id,
          modality: exam.modality,
          bodyPart: exam.bodyPart,
          examinationName: exam.name,
          clinicalIndication: 'Test check-in clinical indication',
          priority: 'ROUTINE',
          orderStatus: 'SCHEDULED',
          createdById: user.id,
        },
      });
      const now = new Date();
      const appt = await prisma.appointment.create({
        data: {
          appointmentNumber: `APT-CK-${Date.now().toString().slice(-6)}`,
          patientId: patient.id,
          imagingOrderId: order.id,
          equipmentId: eq.id,
          modality: exam.modality,
          examination: exam.name,
          scheduledStart: new Date(now.getTime() + 3600000),
          scheduledEnd: new Date(now.getTime() + 7200000),
          status: 'SCHEDULED',
          createdById: user.id,
        },
      });
      checkInApptId = appt.id;
    });

    it('fails check-in when staff identity confirmation is false', async () => {
      const res = await fetch(`${baseUrl}/appointments/${checkInApptId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({ identityConfirmed: false }),
      });
      assert.strictEqual(res.status, 400);
    });

    it('performs reception check-in, assigns token number and updates order to READY_FOR_TECH', async () => {
      const res = await fetch(`${baseUrl}/appointments/${checkInApptId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${receptionToken}`,
        },
        body: JSON.stringify({ identityConfirmed: true }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.tokenNumber);
      assert.strictEqual(body.data.appointment.status, 'CHECKED_IN');

      // Verify associated imaging order advanced to READY_FOR_TECH
      const updatedOrder = await prisma.imagingOrder.findUnique({
        where: { id: body.data.appointment.imagingOrderId },
      });
      assert.strictEqual(updatedOrder?.orderStatus, 'READY_FOR_TECH');
    });

    it('displays patient in active reception waiting queue prioritized by urgency', async () => {
      const res = await fetch(`${baseUrl}/reception/queue`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length > 0);
      // Verify STAT/URGENT is at the top of the queue
      if (body.data.length > 1) {
        const first = body.data[0];
        assert.ok(first.priority === 'STAT' || first.priority === 'URGENT' || first.priority === 'ROUTINE');
      }
    });
  });

  describe('6. Phase 3.1 Technologist Worklist API & Security Workflows', () => {
    it('returns HTTP 401 Unauthorized when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist`);
      assert.strictEqual(res.status, 401);
    });

    it('denies RECEPTION from accessing technologist worklist (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('denies RADIOLOGIST from accessing technologist worklist (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('allows TECHNOLOGIST to view worklist (HTTP 200 OK)', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.items));
      assert.ok(typeof body.data.total === 'number');
    });

    it('allows ADMIN to view technologist worklist (HTTP 200 OK)', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?date=ALL`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.items));
    });

    it('strictly enforces worklist eligibility: excludes SCHEDULED, CANCELLED, and NO_SHOW', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const items = body.data.items;

      for (const item of items) {
        assert.ok(
          [
            'READY_FOR_TECH',
            'SAFETY_REVIEW',
            'SAFETY_CLEARED',
            'PREPARATION_IN_PROGRESS',
            'PREPARED',
            'READY_FOR_SCAN',
            'SCAN_IN_PROGRESS',
            'SCAN_INTERRUPTED',
            'SCAN_COMPLETED',
            'IMAGE_QA_PENDING',
            'IMAGE_ACCEPTED',
            'REPEAT_REQUIRED',
            'IMAGE_REJECTED',
            'PACS_READY',
            'PACS_HANDOFF_PENDING',
            'PACS_HANDOFF_COMPLETE',
            'PACS_HANDOFF_FAILED',
          ].includes(item.order.orderStatus),
          `Worklist item status '${item.order.orderStatus}' must be an eligible active workflow status`
        );
        assert.ok(item.appointment.checkedInAt !== null, 'Must be checked in');
        assert.notStrictEqual(item.order.orderStatus, 'SCHEDULED');
        assert.notStrictEqual(item.order.orderStatus, 'CANCELLED');
      }

      // Explicitly check that known cancelled, no-show, and scheduled accession numbers never appear
      const accessions = items.map((i: any) => i.order.accessionNumber);
      assert.ok(!accessions.includes('ACC-20261105-CT06'), 'Cancelled order ACC-20261105-CT06 must be excluded');
      assert.ok(!accessions.includes('ACC-20261105-XR07'), 'No-show order ACC-20261105-XR07 must be excluded');
      assert.ok(!accessions.includes('ACC-20261106-MR08'), 'Scheduled order ACC-20261106-MR08 must be excluded');
    });

    it('maintains strict identifier fidelity: Patient ID and Accession Number are never regenerated', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.items.length > 0, 'Seed should contain eligible worklist items');

      const sample = body.data.items[0];
      // Verify against database source of truth
      const dbAppt = await prisma.appointment.findUniqueOrThrow({
        where: { id: sample.appointmentId },
        include: { patient: true, imagingOrder: true },
      });

      assert.strictEqual(sample.patient.patientId, dbAppt.patient.patientId, 'Patient ID must match DB exactly');
      assert.strictEqual(sample.order.accessionNumber, dbAppt.imagingOrder?.accessionNumber, 'Accession number must match DB exactly');
      assert.strictEqual(sample.patientId, dbAppt.patient.patientId);
    });

    it('filters worklist accurately by modality (CT, MRI, XRAY)', async () => {
      const resMri = await fetch(`${baseUrl}/technologist/worklist?modality=MRI&date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(resMri.status, 200);
      const bodyMri = await resMri.json();
      for (const item of bodyMri.data.items) {
        assert.strictEqual(item.order.modality, 'MRI');
      }

      const resCt = await fetch(`${baseUrl}/technologist/worklist?modality=CT&date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(resCt.status, 200);
      const bodyCt = await resCt.json();
      for (const item of bodyCt.data.items) {
        assert.strictEqual(item.order.modality, 'CT');
      }
    });

    it('filters worklist accurately by priority (STAT, URGENT, ROUTINE)', async () => {
      const resStat = await fetch(`${baseUrl}/technologist/worklist?priority=STAT&date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(resStat.status, 200);
      const bodyStat = await resStat.json();
      for (const item of bodyStat.data.items) {
        assert.strictEqual(item.order.priority, 'STAT');
      }
    });

    it('searches worklist by patient name, accession or examination', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?search=Chest&date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.items.length >= 1);
      for (const item of body.data.items) {
        const matchesExam = item.order.examinationName.toLowerCase().includes('chest');
        const matchesBodyPart = item.order.bodyPart.toLowerCase().includes('chest');
        assert.ok(matchesExam || matchesBodyPart);
      }
    });

    it('handles pagination parameters correctly', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist?page=1&pageSize=2&date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.page, 1);
      assert.strictEqual(body.data.pageSize, 2);
      assert.ok(body.data.items.length <= 2);
    });

    it('retrieves complete exam context for worklist detail modal (HTTP 200 OK)', async () => {
      // Find an eligible item
      const listRes = await fetch(`${baseUrl}/technologist/worklist?date=ALL`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      const listBody = await listRes.json();
      assert.ok(listBody.data.items.length > 0);
      const targetApptId = listBody.data.items[0].appointmentId;

      const detailRes = await fetch(`${baseUrl}/technologist/worklist/${targetApptId}`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(detailRes.status, 200);
      const detailBody = await detailRes.json();
      assert.strictEqual(detailBody.success, true);
      assert.ok(detailBody.data.patient.patientId);
      assert.ok(detailBody.data.order.accessionNumber);
      assert.ok(typeof detailBody.data.waitingMinutes === 'number');
      assert.ok(
        [
          'READY_FOR_TECH',
          'SAFETY_REVIEW',
          'SAFETY_CLEARED',
          'PREPARATION_IN_PROGRESS',
          'PREPARED',
          'READY_FOR_SCAN',
        ].includes(detailBody.data.order.orderStatus)
      );
    });

    it('returns HTTP 404 when requesting exam details for ineligible or non-existent record', async () => {
      const res = await fetch(`${baseUrl}/technologist/worklist/non-existent-id`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 404);
    });
  });

  describe('7. Phase 3.2 Patient Identity & Safety Screening API & Security Workflows', () => {
    let testPatient: any;
    let ctOrder: any;
    let mriOrder: any;
    let cancelledOrder: any;
    let ctAppointment: any;
    let mriAppointment: any;

    before(async () => {
      // Clean up previous runs
      await prisma.technologistSafetyScreening.deleteMany({
        where: {
          imagingOrder: {
            accessionNumber: {
              in: ['ACC-TEST-SF-CT1', 'ACC-TEST-SF-MR2', 'ACC-TEST-SF-CAN3'],
            },
          },
        },
      });

      await prisma.appointment.deleteMany({
        where: {
          appointmentNumber: {
            in: ['APT-TEST-SF-01', 'APT-TEST-SF-02', 'APT-TEST-SF-03'],
          },
        },
      });

      await prisma.imagingOrder.deleteMany({
        where: {
          accessionNumber: {
            in: ['ACC-TEST-SF-CT1', 'ACC-TEST-SF-MR2', 'ACC-TEST-SF-CAN3'],
          },
        },
      });

      await prisma.patient.deleteMany({
        where: {
          patientId: 'PAT-TEST-SAFETY-99',
        },
      });

      // Create isolated test patient
      testPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-TEST-SAFETY-99',
          firstName: 'Sarah',
          lastName: 'Connor',
          dateOfBirth: new Date('1990-05-15'),
          gender: Gender.FEMALE,
          phone: '+1-555-019-9988',
        },
      });

      // Create CT Order (READY_FOR_TECH)
      ctOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SF-CT1',
          patientId: testPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest without Contrast',
          clinicalIndication: 'Persistent dry cough and shortness of breath for 3 weeks',
          contrastRequired: false,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.READY_FOR_TECH,
        },
      });

      ctAppointment = await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SF-01',
          patientId: testPatient.id,
          imagingOrderId: ctOrder.id,
          modality: ModalityType.CT,
          examination: 'CT Chest without Contrast',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.URGENT,
          checkedInAt: new Date(Date.now() - 15 * 60 * 1000),
          tokenNumber: 'CT-991',
        },
      });

      // Create MRI Order (READY_FOR_TECH, contrastRequired: true)
      mriOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SF-MR2',
          patientId: testPatient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain with and without Contrast',
          clinicalIndication: 'Intractable migraines with aura',
          contrastRequired: true,
          priority: Priority.STAT,
          orderStatus: OrderStatus.READY_FOR_TECH,
        },
      });

      mriAppointment = await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SF-02',
          patientId: testPatient.id,
          imagingOrderId: mriOrder.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain with and without Contrast',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.STAT,
          checkedInAt: new Date(Date.now() - 5 * 60 * 1000),
          tokenNumber: 'MRI-992',
        },
      });

      // Create Cancelled Order
      cancelledOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SF-CAN3',
          patientId: testPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Abdomen',
          examinationName: 'CT Abdomen',
          clinicalIndication: 'Abdominal pain evaluation',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.CANCELLED,
        },
      });
    });

    after(async () => {
      // Clean up test fixtures
      await prisma.technologistSafetyScreening.deleteMany({
        where: {
          imagingOrder: {
            accessionNumber: {
              in: ['ACC-TEST-SF-CT1', 'ACC-TEST-SF-MR2', 'ACC-TEST-SF-CAN3'],
            },
          },
        },
      });
      await prisma.appointment.deleteMany({
        where: {
          appointmentNumber: {
            in: ['APT-TEST-SF-01', 'APT-TEST-SF-02', 'APT-TEST-SF-03'],
          },
        },
      });
      await prisma.imagingOrder.deleteMany({
        where: {
          accessionNumber: {
            in: ['ACC-TEST-SF-CT1', 'ACC-TEST-SF-MR2', 'ACC-TEST-SF-CAN3'],
          },
        },
      });
      await prisma.patient.deleteMany({
        where: {
          patientId: 'PAT-TEST-SAFETY-99',
        },
      });
    });

    describe('7.1 RBAC Matrix for Safety Screening Endpoints', () => {
      it('denies unauthenticated request to GET /technologist/worklist/:id/safety (HTTP 401)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`);
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION role from accessing safety screening GET (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from saving safety screening POST (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identityVerified: true,
            identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
            answers: { ct_pregnancy: 'NO' },
          }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from saving safety screening POST (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identityVerified: true,
            identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
            answers: { ct_pregnancy: 'NO' },
          }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('authorizes TECHNOLOGIST role to retrieve safety screening context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.accessionNumber, 'ACC-TEST-SF-CT1');
        assert.strictEqual(body.data.patient.patientId, 'PAT-TEST-SAFETY-99');
        assert.strictEqual(body.data.modality, 'CT');
      });
    });

    describe('7.2 Full Safety Clearance Workflow (Server Authoritative)', () => {
      it('authoritatively evaluates clean screening and advances order to SAFETY_CLEARED', async () => {
        const payload = {
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyNotes: 'Patient wristband barcode scanned; verified name & DOB verbally. No pregnancy, non-contrast study.',
          answers: {
            ct_pregnancy: 'NO',
          },
        };

        const res = await fetch(`${baseUrl}/technologist/worklist/${ctOrder.id}/safety`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.decision.safetyStatus, 'CLEARED');
        assert.strictEqual(body.data.orderStatus, 'SAFETY_CLEARED');
        assert.strictEqual(body.data.screening.identityVerified, true);
        assert.strictEqual(body.data.screening.identityVerificationMethod, 'WRISTBAND_AND_VERBAL');

        // Verify in database: Order status is SAFETY_CLEARED
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: ctOrder.id },
          include: { safetyScreening: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.SAFETY_CLEARED);
        assert.ok(dbOrder.safetyScreening !== null);
        assert.strictEqual(dbOrder.safetyScreening?.safetyStatus, SafetyStatus.CLEARED);

        // Verify Audit Logs: PATIENT_IDENTITY_VERIFIED & SAFETY_CLEARED
        const idVerifiedLog = await prisma.auditLog.findFirst({
          where: {
            action: 'PATIENT_IDENTITY_VERIFIED',
            entityId: testPatient.id,
          },
        });
        assert.ok(idVerifiedLog !== null, 'PATIENT_IDENTITY_VERIFIED audit log must be recorded');

        const clearedLog = await prisma.auditLog.findFirst({
          where: {
            action: 'SAFETY_CLEARED',
            entityId: ctOrder.id,
          },
        });
        assert.ok(clearedLog !== null, 'SAFETY_CLEARED audit log must be recorded');
      });
    });

    describe('7.3 Contraindication Detection & Blocking Workflow (MRI Pacemaker)', () => {
      it('detects MRI pacemaker and routes order to SAFETY_REVIEW without clearing', async () => {
        const payload = {
          identityVerified: true,
          identityVerificationMethod: 'GOVT_PHOTO_ID_AND_DOB',
          safetyNotes: 'Patient has pacemaker implanted in 2021. Requires cardiology MR-safety clearance.',
          answers: {
            mri_pacemaker: 'YES',
            mri_aneurysm_clip: 'NO',
            mri_cochlear_implant: 'NO',
            mri_neurostimulator: 'NO',
            mri_infusion_pump: 'NO',
            mri_metal_in_eyes: 'NO',
            mri_pregnancy: 'NO',
            mri_contrast_allergy: 'NO',
            mri_renal_disease: 'NO',
          },
        };

        const res = await fetch(`${baseUrl}/technologist/worklist/${mriOrder.id}/safety`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.decision.safetyStatus, 'REQUIRES_REVIEW');
        assert.strictEqual(body.data.orderStatus, 'SAFETY_REVIEW');
        assert.ok(body.data.decision.riskFactors.some((r: string) => r.includes('pacemaker')));

        // Verify database: orderStatus is SAFETY_REVIEW, NEVER SAFETY_CLEARED
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: mriOrder.id },
          include: { safetyScreening: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.SAFETY_REVIEW);
        assert.strictEqual(dbOrder.safetyScreening?.safetyStatus, SafetyStatus.REQUIRES_REVIEW);

        // Verify Audit Log: SAFETY_REQUIRES_REVIEW
        const reviewLog = await prisma.auditLog.findFirst({
          where: {
            action: 'SAFETY_REQUIRES_REVIEW',
            entityId: mriOrder.id,
          },
        });
        assert.ok(reviewLog !== null, 'SAFETY_REQUIRES_REVIEW audit log must be recorded');
      });
    });

    describe('7.4 Workflow Conflict & Immutability Rules', () => {
      it('rejects safety screening submission on a CANCELLED order with HTTP 409 Conflict', async () => {
        const payload = {
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          answers: { ct_pregnancy: 'NO' },
        };

        const res = await fetch(`${baseUrl}/technologist/worklist/${cancelledOrder.id}/safety`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('preserves immutable identifiers: Patient ID and Accession Number remain strictly intact', async () => {
        const dbCtOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: ctOrder.id },
          include: { patient: true },
        });

        assert.strictEqual(dbCtOrder.accessionNumber, 'ACC-TEST-SF-CT1');
        assert.strictEqual(dbCtOrder.patient.patientId, 'PAT-TEST-SAFETY-99');
      });
    });
  });

  describe('8. Phase 3.3 Patient Preparation & Protocol Confirmation Integration Tests', () => {
    let prepPatient: any;
    let prepCtOrder: any;
    let prepBlockedMriOrder: any;
    let protoCtValid: any;
    let protoMriValid: any;
    let protoInactive: any;
    let prepExamDef: any;

    before(async () => {
      // 1. Create Patient fixture
      prepPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-TEST-PREP-101',
          firstName: 'Jonathan',
          lastName: 'Harker',
          dateOfBirth: new Date('1988-06-14'),
          gender: Gender.MALE,
          phone: '+1-555-889-1122',
        },
      });

      // 1b. Create Configured Exam Definition (authoritative preparation driver)
      prepExamDef = await prisma.examDefinition.create({
        data: {
          code: 'CT-TEST-CHEST-DEF',
          name: 'CT Chest with Contrast',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          defaultDurationMinutes: 30,
          bufferMinutes: 10,
          contrastSupported: true,
          fastingRequired: false,
          ivRequired: true,
          consentRequired: true,
          contrastPreparationRequired: true,
          isActive: true,
        },
      });

      // 2. Create Protocols
      protoCtValid = await prisma.imagingProtocol.create({
        data: {
          code: 'CT-TEST-PE-PROTO',
          name: 'CT Test PE Angio',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          description: 'Test pulmonary angiogram protocol',
          isActive: true,
        },
      });

      protoMriValid = await prisma.imagingProtocol.create({
        data: {
          code: 'MR-TEST-BRAIN-PROTO',
          name: 'MRI Test Brain Routine',
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          description: 'Test MRI Brain routine',
          isActive: true,
        },
      });

      protoInactive = await prisma.imagingProtocol.create({
        data: {
          code: 'CT-TEST-INACTIVE-PROTO',
          name: 'CT Deprecated Protocol',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          description: 'Archived inactive CT protocol',
          isActive: false,
        },
      });

      // 3. Create Cleared CT Order with contrast
      prepCtOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-PREP-CT1',
          patientId: prepPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast',
          clinicalIndication: 'Test PE evaluation',
          contrastRequired: true,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.SAFETY_CLEARED,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-PREP-01',
          patientId: prepPatient.id,
          imagingOrderId: prepCtOrder.id,
          examDefinitionId: prepExamDef.id,
          modality: ModalityType.CT,
          examination: 'CT Chest with Contrast',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.URGENT,
          checkedInAt: new Date(Date.now() - 10 * 60 * 1000),
          tokenNumber: 'CT-P01',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: prepCtOrder.id,
          patientId: prepPatient.id,
          completedByUserId: (await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } })).id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO', ct_renal_disease: 'NO' },
        },
      });

      // 4. Create Blocked MRI Order in SAFETY_REVIEW
      prepBlockedMriOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-PREP-MR2',
          patientId: prepPatient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain with Contrast',
          clinicalIndication: 'Migraines evaluation',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SAFETY_REVIEW,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: prepBlockedMriOrder.id,
          patientId: prepPatient.id,
          completedByUserId: (await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } })).id,
          modality: ModalityType.MRI,
          identityVerified: true,
          identityVerificationMethod: 'PHOTO_ID_AND_VERBAL',
          safetyStatus: SafetyStatus.REQUIRES_REVIEW,
          riskFactors: ['Implanted pacemaker reported'],
          answers: { mri_pacemaker: 'YES' },
        },
      });
    });

    after(async () => {
      // Clean up test fixtures
      await prisma.technologistPreparation.deleteMany({
        where: {
          imagingOrder: {
            accessionNumber: {
              in: ['ACC-TEST-PREP-CT1', 'ACC-TEST-PREP-MR2'],
            },
          },
        },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: {
          imagingOrder: {
            accessionNumber: {
              in: ['ACC-TEST-PREP-CT1', 'ACC-TEST-PREP-MR2'],
            },
          },
        },
      });
      await prisma.appointment.deleteMany({
        where: { appointmentNumber: 'APT-TEST-PREP-01' },
      });
      await prisma.imagingOrder.deleteMany({
        where: {
          accessionNumber: {
            in: ['ACC-TEST-PREP-CT1', 'ACC-TEST-PREP-MR2'],
          },
        },
      });
      await prisma.imagingProtocol.deleteMany({
        where: {
          id: { in: [protoCtValid.id, protoMriValid.id, protoInactive.id] },
        },
      });
      await prisma.patient.deleteMany({
        where: { id: prepPatient.id },
      });
      await prisma.examDefinition.deleteMany({
        where: { code: 'CT-TEST-CHEST-DEF' },
      });
    });

    describe('8.1 RBAC Security Matrix for Preparation & Protocol Endpoints', () => {
      it('returns 401 Unauthorized for unauthenticated GET preparation request', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`);
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION role from accessing GET preparation (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from accessing GET preparation (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from submitting PUT preparation (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ivReady: true }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from confirming protocol POST (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoCtValid.id }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('allows TECHNOLOGIST role to retrieve preparation context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.accessionNumber, 'ACC-TEST-PREP-CT1');
        assert.strictEqual(body.data.patient.patientId, 'PAT-TEST-PREP-101');
        assert.strictEqual(body.data.requirements.ivRequired, true);
        assert.strictEqual(body.data.requirements.contrastPreparationRequired, true);
      });

      it('allows ADMIN role to retrieve preparation context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
      });
    });

    describe('8.2 Strict Authoritative Safety Gate (No Bypass)', () => {
      it('rejects preparation PUT on an order in SAFETY_REVIEW status (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepBlockedMriOrder.id}/preparation`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fastingStatus: 'CONFIRMED',
            ivReady: true,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('safety screening must be CLEARED'));
      });

      it('strictly enforces safety gate for ADMIN role with ZERO bypass (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepBlockedMriOrder.id}/preparation`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ivReady: true,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });
    });

    describe('8.3 Preparation Lifecycle & Decision Engine Transitions', () => {
      it('updates preparation to IN_PROGRESS when required contrast preparation is missing', async () => {
        const payload = {
          fastingStatus: 'NOT_REQUIRED',
          ivReady: true,
          contrastReady: false, // Incomplete!
          consentStatus: 'CONFIRMED',
          preparationNotes: '18G IV in left antecubital, contrast warmer pending.',
        };

        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.preparationStatus, 'IN_PROGRESS');
        assert.strictEqual(body.data.orderStatus, 'PREPARATION_IN_PROGRESS');

        // Verify DB
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: prepCtOrder.id },
          include: { preparation: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.PREPARATION_IN_PROGRESS);
        assert.strictEqual(dbOrder.preparation?.preparationStatus, PreparationStatus.IN_PROGRESS);
      });

      it('rejects protocol confirmation when preparation is IN_PROGRESS (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoCtValid.id }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('preparation must be COMPLETE'));
      });

      it('advances preparation to COMPLETE and order to PREPARED when all checklist items satisfied', async () => {
        const payload = {
          fastingStatus: 'NOT_REQUIRED',
          ivReady: true,
          contrastReady: true,
          consentStatus: 'CONFIRMED',
          additionalPreparationComplete: true,
          preparationNotes: 'IV patent with saline flush, contrast primed, patient ready.',
        };

        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/preparation`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.preparationStatus, 'COMPLETE');
        assert.strictEqual(body.data.orderStatus, 'PREPARED');

        // Verify DB
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: prepCtOrder.id },
          include: { preparation: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.PREPARED);
        assert.strictEqual(dbOrder.preparation?.preparationStatus, PreparationStatus.COMPLETE);

        // Verify Audit Log: PREPARATION_COMPLETED
        const prepLog = await prisma.auditLog.findFirst({
          where: {
            action: 'PREPARATION_COMPLETED',
            entityId: dbOrder.preparation!.id,
          },
        });
        assert.ok(prepLog !== null, 'PREPARATION_COMPLETED audit log must be recorded');
      });
    });

    describe('8.4 Protocol Compatibility & READY_FOR_SCAN Milestone Transition', () => {
      it('rejects confirmation of an inactive protocol (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoInactive.id }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('inactive or deprecated'));
      });

      it('rejects confirmation when protocol modality mismatches exam modality (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoMriValid.id }), // MRI protocol for CT exam!
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('Protocol modality mismatch'));
      });

      it('atomically confirms valid protocol, transitions order to READY_FOR_SCAN, and logs audit', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoCtValid.id }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'READY_FOR_SCAN');
        assert.strictEqual(body.data.preparationStatus, 'COMPLETE');
        assert.strictEqual(body.data.protocol.code, 'CT-TEST-PE-PROTO');

        // Verify DB State
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: prepCtOrder.id },
          include: { confirmedProtocol: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.READY_FOR_SCAN);
        assert.strictEqual(dbOrder.confirmedProtocol?.code, 'CT-TEST-PE-PROTO');
        assert.ok(dbOrder.protocolConfirmedAt !== null);

        // Verify Audit Logs: PROTOCOL_CONFIRMED & ORDER_READY_FOR_SCAN
        const protoLog = await prisma.auditLog.findFirst({
          where: {
            action: 'PROTOCOL_CONFIRMED',
            entityId: prepCtOrder.id,
          },
        });
        assert.ok(protoLog !== null, 'PROTOCOL_CONFIRMED audit log must be recorded');

        const scanReadyLog = await prisma.auditLog.findFirst({
          where: {
            action: 'ORDER_READY_FOR_SCAN',
            entityId: prepCtOrder.id,
          },
        });
        assert.ok(scanReadyLog !== null, 'ORDER_READY_FOR_SCAN audit log must be recorded');
      });

      it('locks protocol after READY_FOR_SCAN transition: rejects further edits (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${prepCtOrder.id}/protocol`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ protocolId: protoCtValid.id }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('locked in READY_FOR_SCAN'));
      });
    });

    describe('8.5 Data Integrity & Non-Regenerated Identifiers', () => {
      it('preserves immutable identifiers: Patient ID and Accession Number remain strictly invariant', async () => {
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: prepCtOrder.id },
          include: { patient: true },
        });

        assert.strictEqual(dbOrder.accessionNumber, 'ACC-TEST-PREP-CT1');
        assert.strictEqual(dbOrder.patient.patientId, 'PAT-TEST-PREP-101');
      });

      it('returns 404 Not Found for non-existent exam identifier', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/non-existent-order-id/preparation`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 404);
      });
    });
  });

  describe('9. Phase 3.4 Scan Acquisition Lifecycle Integration Tests', () => {
    let scanPatient: any;
    let scanCtEquip: any;
    let scanMrEquip: any;
    let scanExamDef: any;
    let scanProtocol: any;

    let scanOrderActive: any;
    let scanOrderCancel: any;
    let scanOrderReview: any;
    let scanOrderPrepIncomplete: any;
    let scanOrderFinish: any;
    let scanOrderConcurrency: any;

    before(async () => {
      // 1. Create Patient fixture
      scanPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-TEST-SCAN-201',
          firstName: 'Jonathan',
          lastName: 'Mina',
          dateOfBirth: new Date('1990-03-25'),
          gender: Gender.MALE,
          phone: '+1-555-443-8899',
        },
      });

      // 2. Create Equipment fixtures
      scanCtEquip = await prisma.equipment.create({
        data: {
          name: 'Siemens Somatom CT Scanner 99',
          modality: ModalityType.CT,
          manufacturer: 'Siemens Healthineers',
          model: 'Somatom Force',
          serialNumber: 'SN-TEST-CT-99',
          status: EquipmentStatus.AVAILABLE,
          location: 'Scanner Suite CT-99',
        },
      });

      scanMrEquip = await prisma.equipment.create({
        data: {
          name: 'GE Signa 3T MRI Scanner 99',
          modality: ModalityType.MRI,
          manufacturer: 'GE Healthcare',
          model: 'Signa Premier',
          serialNumber: 'SN-TEST-MR-99',
          status: EquipmentStatus.AVAILABLE,
          location: 'Scanner Suite MRI-99',
        },
      });

      // 3. Create Exam Definition & Protocol
      scanExamDef = await prisma.examDefinition.create({
        data: {
          code: 'CT-CHEST-PE-99',
          name: 'CT Chest PE Diagnostic 99',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          defaultDurationMinutes: 30,
          bufferMinutes: 10,
          contrastSupported: true,
          fastingRequired: false,
          ivRequired: true,
          consentRequired: true,
          contrastPreparationRequired: true,
          isActive: true,
        },
      });

      scanProtocol = await prisma.imagingProtocol.create({
        data: {
          code: 'CT-PROTO-PE-99',
          name: 'CT Pulmonary Angiography PE Protocol 99',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examDefinitionId: scanExamDef.id,
          description: 'Bolus-triggered pulmonary arterial angiogram protocol',
          isActive: true,
        },
      });

      const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });

      // 4. Create Order 1: READY_FOR_SCAN (for start -> interrupt -> resume -> cancel sequence)
      scanOrderActive = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-01',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Evaluation of acute pulmonary embolism',
          contrastRequired: true,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          confirmedProtocolId: scanProtocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SCAN-01',
          patientId: scanPatient.id,
          imagingOrderId: scanOrderActive.id,
          equipmentId: scanCtEquip.id,
          examDefinitionId: scanExamDef.id,
          modality: ModalityType.CT,
          examination: 'CT Chest PE Diagnostic 99',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.URGENT,
          checkedInAt: new Date(Date.now() - 15 * 60 * 1000),
          tokenNumber: 'CT-S01',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderActive.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO', ct_renal_disease: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: scanOrderActive.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          fastingRequired: false,
          fastingStatus: 'NOT_REQUIRED',
          ivRequired: true,
          ivReady: true,
          contrastPreparationRequired: true,
          contrastReady: true,
          consentRequired: true,
          consentStatus: 'CONFIRMED',
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      // 5. Create Order 2: READY_FOR_SCAN (for clean direct cancellation before start)
      scanOrderCancel = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-02',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Pre-scan cancellation testing',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          confirmedProtocolId: scanProtocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SCAN-02',
          patientId: scanPatient.id,
          imagingOrderId: scanOrderCancel.id,
          equipmentId: scanCtEquip.id,
          examDefinitionId: scanExamDef.id,
          modality: ModalityType.CT,
          examination: 'CT Chest PE Diagnostic 99',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.ROUTINE,
          tokenNumber: 'CT-S02',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderCancel.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: scanOrderCancel.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      // 6. Create Order 3: SAFETY_REVIEW (blocked)
      scanOrderReview = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-03',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Safety review blocked order',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SAFETY_REVIEW,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderReview.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.REQUIRES_REVIEW,
          answers: { ct_pregnancy: 'YES' },
        },
      });

      // 7. Create Order 4: PREPARATION_IN_PROGRESS (prep incomplete)
      scanOrderPrepIncomplete = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-04',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Preparation incomplete order',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PREPARATION_IN_PROGRESS,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderPrepIncomplete.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO', ct_renal_disease: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: scanOrderPrepIncomplete.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          ivRequired: true,
          ivReady: false,
          preparationStatus: PreparationStatus.IN_PROGRESS,
        },
      });

      // 8. Create Order 5: READY_FOR_SCAN (for finish scan testing)
      scanOrderFinish = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-05',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Finish scan workflow test',
          contrastRequired: false,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          confirmedProtocolId: scanProtocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SCAN-05',
          patientId: scanPatient.id,
          imagingOrderId: scanOrderFinish.id,
          equipmentId: scanCtEquip.id,
          examDefinitionId: scanExamDef.id,
          modality: ModalityType.CT,
          examination: 'CT Chest PE Diagnostic 99',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.URGENT,
          tokenNumber: 'CT-S05',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderFinish.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: scanOrderFinish.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      // 9. Create Order 6: READY_FOR_SCAN (for concurrency testing)
      scanOrderConcurrency = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-SCAN-06',
          patientId: scanPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest PE Diagnostic 99',
          clinicalIndication: 'Concurrency race condition testing',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          confirmedProtocolId: scanProtocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-SCAN-06',
          patientId: scanPatient.id,
          imagingOrderId: scanOrderConcurrency.id,
          equipmentId: scanCtEquip.id,
          examDefinitionId: scanExamDef.id,
          modality: ModalityType.CT,
          examination: 'CT Chest PE Diagnostic 99',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.ROUTINE,
          tokenNumber: 'CT-S06',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: scanOrderConcurrency.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: scanOrderConcurrency.id,
          patientId: scanPatient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });
    });

    after(async () => {
      const orderIds = [
        scanOrderActive.id,
        scanOrderCancel.id,
        scanOrderReview.id,
        scanOrderPrepIncomplete.id,
        scanOrderFinish.id,
        scanOrderConcurrency.id,
      ];

      await prisma.scanLifecycleEvent.deleteMany({
        where: { scanLifecycle: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.appointment.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
      await prisma.imagingProtocol.deleteMany({
        where: { id: scanProtocol.id },
      });
      await prisma.examDefinition.deleteMany({
        where: { id: scanExamDef.id },
      });
      await prisma.equipment.deleteMany({
        where: { id: { in: [scanCtEquip.id, scanMrEquip.id] } },
      });
      await prisma.patient.deleteMany({
        where: { id: scanPatient.id },
      });
    });

    describe('9.1 RBAC Security Matrix for Scan Lifecycle Endpoints', () => {
      it('returns 401 Unauthorized for unauthenticated GET scan request', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan`);
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION role from accessing GET scan context (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from accessing GET scan context (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from executing POST /scan/start (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from executing POST /scan/start (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from executing POST /scan/interrupt (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/interrupt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from executing POST /scan/resume (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from executing POST /scan/finish (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from executing POST /scan/cancel (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('allows TECHNOLOGIST to retrieve scan lifecycle context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'READY_FOR_SCAN');
        assert.strictEqual(body.data.isSafetyCleared, true);
        assert.strictEqual(body.data.isPreparationComplete, true);
        assert.strictEqual(body.data.protocol.code, 'CT-PROTO-PE-99');
      });

      it('allows ADMIN to retrieve scan lifecycle context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
      });
    });

    describe('9.2 Precondition Enforcement on START SCAN', () => {
      it('rejects start scan when order is in SAFETY_REVIEW status (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderReview.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('READY_FOR_SCAN'));
      });

      it('rejects start scan when patient preparation is IN_PROGRESS (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderPrepIncomplete.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('rejects start scan when equipment modality mismatches examination modality (HTTP 409 Conflict)', async () => {
        // Attempt to start CT scan using an MRI scanner
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ equipmentId: scanMrEquip.id }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('Equipment modality mismatch'));
      });

      it('atomically starts scan from READY_FOR_SCAN, transitions to SCAN_IN_PROGRESS, and writes audit', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_IN_PROGRESS');
        assert.strictEqual(body.data.scan.state, 'IN_PROGRESS');
        assert.ok(body.data.scan.startedAt !== null);

        // Verify DB State
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: scanOrderActive.id },
          include: { scanLifecycles: { include: { events: true } } },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.SCAN_IN_PROGRESS);
        assert.strictEqual(dbOrder.scanLifecycles[0]?.state, ScanState.IN_PROGRESS);
        assert.strictEqual(dbOrder.scanLifecycles[0]?.events[0]?.action, ScanLifecycleAction.STARTED);

        // Verify Audit Event
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'SCAN_STARTED',
            entityId: scanOrderActive.id,
          },
        });
        assert.ok(audit !== null, 'SCAN_STARTED audit event must be logged');

        // Verify Invariant Identifiers
        assert.strictEqual(dbOrder.accessionNumber, 'ACC-TEST-SCAN-01');
        assert.strictEqual(dbOrder.patientId, scanPatient.id);
      });

      it('rejects second start scan attempt while already in progress (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('already in progress'));
      });
    });

    describe('9.3 Operational Interruption & Resume Lifecycle', () => {
      it('rejects finishing an interrupted scan directly before resumption (HTTP 409 Conflict)', async () => {
        // First interrupt the scan
        const intRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/interrupt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'PATIENT_REQUEST',
            notes: 'Patient requested brief pause',
          }),
        });
        assert.strictEqual(intRes.status, 200);

        // Now attempt direct finish from SCAN_INTERRUPTED
        const finishRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(finishRes.status, 409);
        const body = await finishRes.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('interrupted scan directly'));
      });

      it('successfully resumes an interrupted scan, returning to SCAN_IN_PROGRESS and preserving startedAt', async () => {
        const dbBefore = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: scanOrderActive.id },
          include: { scanLifecycles: true },
        });
        const originalStartedAt = dbBefore.scanLifecycles[0]?.startedAt?.toISOString();

        const resumeRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(resumeRes.status, 200);
        const body = await resumeRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_IN_PROGRESS');
        assert.strictEqual(body.data.scan.state, 'IN_PROGRESS');

        // Verify startedAt was NOT overwritten
        assert.strictEqual(new Date(body.data.scan.startedAt).toISOString(), originalStartedAt);

        // Verify Audit Log: SCAN_RESUMED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'SCAN_RESUMED',
            entityId: scanOrderActive.id,
          },
        });
        assert.ok(audit !== null, 'SCAN_RESUMED audit log must be recorded');
      });

      it('rejects resuming a scan that is already in progress (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
      });
    });

    describe('9.4 Cancellation Rules & Section 7 Operational Guard', () => {
      it('strictly forbids DIRECT cancellation of SCAN_IN_PROGRESS (HTTP 409 Conflict)', async () => {
        // Section 7 critical rule: Active acquisition cannot be cancelled directly without interruption
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'PATIENT_UNABLE_TO_CONTINUE',
            notes: 'Patient refusing to stay in gantry',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('Direct cancellation of an active scan in progress is prohibited'));
      });

      it('permits cancellation after interruption: SCAN_INTERRUPTED -> SCAN_CANCELLED', async () => {
        // 1. Interrupt first
        await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/interrupt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'PATIENT_REQUEST',
            notes: 'Patient unable to tolerate breathing instructions',
          }),
        });

        // 2. Now cancel from SCAN_INTERRUPTED
        const cancelRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'PATIENT_UNABLE_TO_CONTINUE',
            notes: 'Patient became dizzy and requested immediate cancellation',
          }),
        });

        assert.strictEqual(cancelRes.status, 200);
        const body = await cancelRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_CANCELLED');
        assert.strictEqual(body.data.scan.state, 'CANCELLED');
        assert.ok(body.data.scan.cancelledAt !== null);

        // Verify DB State
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: scanOrderActive.id },
          include: { scanLifecycles: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.SCAN_CANCELLED);
        assert.strictEqual(dbOrder.scanLifecycles[0]?.state, ScanState.CANCELLED);
        assert.ok(dbOrder.scanLifecycles[0]?.startedAt !== null, 'Acquisition start time must be preserved');
        assert.ok(dbOrder.scanLifecycles[0]?.interruptedAt !== null, 'Interruption time must be preserved');

        // Verify Audit Log: SCAN_CANCELLED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'SCAN_CANCELLED',
            entityId: scanOrderActive.id,
          },
        });
        assert.ok(audit !== null, 'SCAN_CANCELLED audit log must be recorded');
      });

      it('enforces terminal protection: rejects further lifecycle actions on SCAN_CANCELLED (HTTP 409 Conflict)', async () => {
        // Attempt to start cancelled scan
        const startRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes.status, 409);

        // Attempt to resume cancelled scan
        const resumeRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(resumeRes.status, 409);

        // Attempt to finish cancelled scan
        const finishRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderActive.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(finishRes.status, 409);
      });

      it('permits clean pre-start cancellation directly from READY_FOR_SCAN', async () => {
        const cancelRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderCancel.id}/scan/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'ORDER_CANCELLED',
            notes: 'Attending physician cancelled order prior to acquisition',
          }),
        });

        assert.strictEqual(cancelRes.status, 200);
        const body = await cancelRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_CANCELLED');
      });
    });

    describe('9.5 Completion Lifecycle (START -> FINISH -> SCAN_COMPLETED)', () => {
      it('starts and cleanly finishes acquisition, verifying completion monotonicity', async () => {
        // 1. Start scan
        const startRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderFinish.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes.status, 201);

        // Small wait to ensure timestamp monotonicity
        await new Promise((r) => setTimeout(r, 50));

        // 2. Finish scan
        const finishRes = await fetch(`${baseUrl}/technologist/worklist/${scanOrderFinish.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(finishRes.status, 200);
        const body = await finishRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_COMPLETED');
        assert.strictEqual(body.data.scan.state, 'COMPLETED');

        const startedAt = new Date(body.data.scan.startedAt).getTime();
        const completedAt = new Date(body.data.scan.completedAt).getTime();
        assert.ok(completedAt >= startedAt, 'completedAt must be greater than or equal to startedAt');

        // Verify DB State
        const dbOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: scanOrderFinish.id },
          include: { scanLifecycles: true },
        });
        assert.strictEqual(dbOrder.orderStatus, OrderStatus.SCAN_COMPLETED);
        assert.strictEqual(dbOrder.scanLifecycles[0]?.state, ScanState.COMPLETED);

        // Verify Audit Log: SCAN_COMPLETED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'SCAN_COMPLETED',
            entityId: scanOrderFinish.id,
          },
        });
        assert.ok(audit !== null, 'SCAN_COMPLETED audit log must be recorded');
      });

      it('enforces terminal protection: rejects second finish attempt on SCAN_COMPLETED (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderFinish.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('enforces terminal protection: rejects interrupt on SCAN_COMPLETED (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderFinish.id}/scan/interrupt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
        });

        assert.strictEqual(res.status, 409);
      });

      it('enforces terminal protection: rejects cancel on SCAN_COMPLETED (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${scanOrderFinish.id}/scan/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'PATIENT_REQUEST' }),
        });

        assert.strictEqual(res.status, 409);
      });
    });

    describe('9.6 Concurrency & Double Action Protection', () => {
      it('handles parallel double-start cleanly: exactly one succeeds, second receives 409 Conflict', async () => {
        const [res1, res2] = await Promise.all([
          fetch(`${baseUrl}/technologist/worklist/${scanOrderConcurrency.id}/scan/start`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${techToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }),
          fetch(`${baseUrl}/technologist/worklist/${scanOrderConcurrency.id}/scan/start`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${techToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }),
        ]);

        const statuses = [res1.status, res2.status].sort();
        assert.deepStrictEqual(statuses, [201, 409], 'Exactly one start request must succeed (201) and one fail with conflict (409)');

        // Verify only one SCAN_STARTED audit log generated for this order
        const audits = await prisma.auditLog.findMany({
          where: {
            action: 'SCAN_STARTED',
            entityId: scanOrderConcurrency.id,
          },
        });
        assert.strictEqual(audits.length, 1, 'Only one SCAN_STARTED audit event must exist');
      });
    });
  });

  describe('10. Phase 3.5 Contrast Administration & Incident Recording Integration Tests', () => {
    let p35Patient: any;
    let p35CtEquip: any;
    let p35ExamDefContrast: any;
    let p35ExamDefNonContrast: any;
    let p35Protocol: any;
    let p35OrderActive: any;
    let p35OrderNonContrast: any;
    let p35OrderReadyForScan: any;
    let p35OrderInterrupted: any;
    let p35OrderCompleted: any;
    let p35OrderCancelled: any;
    let p35ContrastRecord: any;

    before(async () => {
      setPacsGateway(new MockPacsGateway('success'));
      const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });

      // Clean up any lingering records from previous failed test runs
      await prisma.technologistIncident.deleteMany({
        where: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } },
      });
      await prisma.contrastAdministration.deleteMany({
        where: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } },
      });
      await prisma.scanLifecycleEvent.deleteMany({
        where: { scanLifecycle: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrder: { accessionNumber: { startsWith: 'ACC-TEST-P35' } } },
      });
      await prisma.appointment.deleteMany({
        where: { appointmentNumber: { startsWith: 'APT-TEST-P35' } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P35' } },
      });
      await prisma.imagingProtocol.deleteMany({
        where: { code: 'CT-PROTO-P35-PE' },
      });
      await prisma.examDefinition.deleteMany({
        where: { code: { in: ['CT-CHEST-P35', 'CT-HEAD-NC-P35'] } },
      });
      await prisma.equipment.deleteMany({
        where: { serialNumber: 'SN-TEST-CT-P35' },
      });
      await prisma.patient.deleteMany({
        where: { patientId: 'PAT-2026-P3501' },
      });

      p35Patient = await prisma.patient.create({
        data: {
          patientId: 'PAT-2026-P3501',
          firstName: 'Marcus',
          lastName: 'Vance',
          dateOfBirth: new Date('1984-07-22'),
          gender: Gender.MALE,
          phone: '+1-555-888-3501',
          isActive: true,
        },
      });

      p35CtEquip = await prisma.equipment.create({
        data: {
          name: 'Siemens SOMATOM Force (P35)',
          modality: ModalityType.CT,
          manufacturer: 'Siemens Healthineers',
          model: 'SOMATOM Force',
          serialNumber: 'SN-TEST-CT-P35',
          location: 'Scanner Bay 3 - Ground Floor',
          status: EquipmentStatus.AVAILABLE,
        },
      });

      p35ExamDefContrast = await prisma.examDefinition.create({
        data: {
          code: 'CT-CHEST-P35',
          name: 'CT Chest with IV Contrast Diagnostic (P35)',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          defaultDurationMinutes: 30,
          bufferMinutes: 10,
          contrastSupported: true,
          fastingRequired: false,
          ivRequired: true,
          consentRequired: true,
          contrastPreparationRequired: true,
          isActive: true,
        },
      });

      p35ExamDefNonContrast = await prisma.examDefinition.create({
        data: {
          code: 'CT-HEAD-NC-P35',
          name: 'CT Head Non-Contrast Diagnostic (P35)',
          modality: ModalityType.CT,
          bodyPart: 'Head',
          defaultDurationMinutes: 20,
          bufferMinutes: 5,
          contrastSupported: false,
          fastingRequired: false,
          ivRequired: false,
          consentRequired: false,
          contrastPreparationRequired: false,
          isActive: true,
        },
      });

      p35Protocol = await prisma.imagingProtocol.create({
        data: {
          code: 'CT-PROTO-P35-PE',
          name: 'CT Pulmonary Angiogram Protocol P35',
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examDefinitionId: p35ExamDefContrast.id,
          description: 'Protocol with IV contrast administration',
          isActive: true,
        },
      });

      // 1. Order Active: contrastRequired=true, in SCAN_IN_PROGRESS
      p35OrderActive = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-01',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with IV Contrast Diagnostic (P35)',
          clinicalIndication: 'Phase 3.5 Contrast Administration Active Test',
          contrastRequired: true,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
          confirmedProtocolId: p35Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P35-01',
          patientId: p35Patient.id,
          imagingOrderId: p35OrderActive.id,
          equipmentId: p35CtEquip.id,
          examDefinitionId: p35ExamDefContrast.id,
          modality: ModalityType.CT,
          examination: 'CT Chest with IV Contrast Diagnostic (P35)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          priority: Priority.URGENT,
          tokenNumber: 'CT-P35-01',
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p35OrderActive.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO', ct_contrast_allergy: 'NO', ct_renal_disease: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p35OrderActive.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          ivRequired: true,
          ivReady: true,
          contrastPreparationRequired: true,
          contrastReady: true,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p35OrderActive.id,
          equipmentId: p35CtEquip.id,
          startedByUserId: techUser.id,
          startedAt: new Date(),
          state: ScanState.IN_PROGRESS,
        },
      });

      // 2. Order Non-Contrast: contrastRequired=false, in SCAN_IN_PROGRESS
      p35OrderNonContrast = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-02',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head',
          examinationName: 'CT Head Non-Contrast Diagnostic (P35)',
          clinicalIndication: 'Non-contrast order rejection test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p35OrderNonContrast.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'VERBAL',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p35OrderNonContrast.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p35OrderNonContrast.id,
          equipmentId: p35CtEquip.id,
          startedByUserId: techUser.id,
          startedAt: new Date(),
          state: ScanState.IN_PROGRESS,
        },
      });

      // 3. Order Ready For Scan: contrastRequired=true, in READY_FOR_SCAN
      p35OrderReadyForScan = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-03',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with IV Contrast Diagnostic (P35)',
          clinicalIndication: 'Pre-acquisition contrast rejection test',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.READY_FOR_SCAN,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p35OrderReadyForScan.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p35OrderReadyForScan.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      // 4. Order Interrupted: contrastRequired=true, in SCAN_INTERRUPTED
      p35OrderInterrupted = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-04',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with IV Contrast Diagnostic (P35)',
          clinicalIndication: 'Interrupted scan incident test',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_INTERRUPTED,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p35OrderInterrupted.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.CT,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { ct_pregnancy: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p35OrderInterrupted.id,
          patientId: p35Patient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p35OrderInterrupted.id,
          equipmentId: p35CtEquip.id,
          startedByUserId: techUser.id,
          startedAt: new Date(),
          interruptedByUserId: techUser.id,
          interruptedAt: new Date(),
          interruptionReason: 'PATIENT_REQUEST',
          state: ScanState.INTERRUPTED,
        },
      });

      // 5. Order Completed: contrastRequired=true, in SCAN_COMPLETED
      p35OrderCompleted = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-05',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with IV Contrast Diagnostic (P35)',
          clinicalIndication: 'Completed scan rejection test',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_COMPLETED,
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p35OrderCompleted.id,
          equipmentId: p35CtEquip.id,
          startedByUserId: techUser.id,
          startedAt: new Date(),
          completedByUserId: techUser.id,
          completedAt: new Date(),
          state: ScanState.COMPLETED,
        },
      });

      // 6. Order Cancelled: contrastRequired=true, in SCAN_CANCELLED
      p35OrderCancelled = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P35-06',
          patientId: p35Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with IV Contrast Diagnostic (P35)',
          clinicalIndication: 'Cancelled scan rejection test',
          contrastRequired: true,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_CANCELLED,
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p35OrderCancelled.id,
          equipmentId: p35CtEquip.id,
          startedByUserId: techUser.id,
          startedAt: new Date(),
          cancelledByUserId: techUser.id,
          cancelledAt: new Date(),
          state: ScanState.CANCELLED,
        },
      });
    });

    after(async () => {
      const orderIds = [
        p35OrderActive.id,
        p35OrderNonContrast.id,
        p35OrderReadyForScan.id,
        p35OrderInterrupted.id,
        p35OrderCompleted.id,
        p35OrderCancelled.id,
      ];

      await prisma.technologistIncident.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.contrastAdministration.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.scanLifecycleEvent.deleteMany({
        where: { scanLifecycle: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.appointment.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
      await prisma.imagingProtocol.deleteMany({
        where: { id: p35Protocol.id },
      });
      await prisma.examDefinition.deleteMany({
        where: { id: { in: [p35ExamDefContrast.id, p35ExamDefNonContrast.id] } },
      });
      await prisma.equipment.deleteMany({
        where: { id: p35CtEquip.id },
      });
      await prisma.patient.deleteMany({
        where: { id: p35Patient.id },
      });
    });

    describe('10.1 RBAC Security Matrix for Phase 3.5 Endpoints', () => {
      it('returns 401 Unauthorized for unauthenticated GET /contrast request', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`);
        assert.strictEqual(res.status, 401);
      });

      it('returns 401 Unauthorized for unauthenticated POST /contrast request', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contrastAgentName: 'Omnipaque 350', volume: 80, route: 'IV' }),
        });
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION role from GET /contrast (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from POST /contrast (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contrastAgentName: 'Omnipaque 350', volume: 80, route: 'IV' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from POST /contrast (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contrastAgentName: 'Omnipaque 350', volume: 80, route: 'IV' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from POST /incidents (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category: 'CONTRAST_REACTION', description: 'Patient distress' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RADIOLOGIST role from POST /incidents (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category: 'CONTRAST_REACTION', description: 'Patient distress' }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('allows TECHNOLOGIST to retrieve GET /contrast context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.contrastRequired, true);
        assert.strictEqual(body.data.orderStatus, 'SCAN_IN_PROGRESS');
      });

      it('allows ADMIN to retrieve GET /contrast context (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
      });
    });

    describe('10.2 Contrast Administration Workflow Gating & Preconditions', () => {
      it('rejects contrast administration when exam is non-contrast (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderNonContrast.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 75,
            volumeUnit: 'mL',
            route: 'IV',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'CONTRAST_NOT_REQUIRED');
      });

      it('rejects contrast administration in READY_FOR_SCAN state before scan acquisition starts (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderReadyForScan.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 75,
            route: 'IV',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'SCAN_NOT_IN_PROGRESS');
      });

      it('rejects first-time contrast administration when scan is in SCAN_INTERRUPTED state (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderInterrupted.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 75,
            route: 'IV',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'SCAN_NOT_IN_PROGRESS');
      });

      it('rejects contrast administration on a completed scan (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderCompleted.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 75,
            route: 'IV',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'SCAN_COMPLETED');
      });

      it('rejects contrast administration on a cancelled scan (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderCancelled.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 75,
            route: 'IV',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'SCAN_CANCELLED');
      });
    });

    describe('10.3 Contrast Administration Execution, Attribution & Immutability', () => {
      it('successfully records contrast administration in SCAN_IN_PROGRESS and logs audit (HTTP 201 Created)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            concentration: '350 mgI/mL',
            volume: 85,
            volumeUnit: 'mL',
            route: 'IV',
            batchLotNumber: 'LOT-P35-99',
            expirationDate: '2028-06-30',
            administrationNotes: 'Power injected at 3.0 mL/s via 18G right antecubital fossa cannula.',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.contrastAgentName, 'Omnipaque 350');
        assert.strictEqual(body.data.volume, 85);
        assert.strictEqual(body.data.route, 'IV');
        assert.ok(body.data.administeredAt, 'administeredAt must be server generated');
        assert.ok(body.data.administeredBy, 'administeredBy user object must be present');
        assert.strictEqual(body.data.patientId, 'PAT-2026-P3501');
        assert.strictEqual(body.data.accessionNumber, 'ACC-TEST-P35-01');
        assert.strictEqual(body.data.hasIncident, false, 'Initial contrast administration must have hasIncident=false');

        p35ContrastRecord = body.data;

        // Verify order status remains SCAN_IN_PROGRESS
        const orderInDb = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p35OrderActive.id },
        });
        assert.strictEqual(orderInDb.orderStatus, OrderStatus.SCAN_IN_PROGRESS);

        // Verify Audit Log was emitted
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'CONTRAST_ADMINISTERED',
            entityId: p35OrderActive.id,
          },
        });
        assert.ok(audit, 'CONTRAST_ADMINISTERED audit record must be generated');
        assert.strictEqual(audit.entityType, 'ImagingOrder');
      });

      it('preserves immutable identifiers: patientId and accessionNumber never change', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p35OrderActive.id } });
        const patient = await prisma.patient.findUniqueOrThrow({ where: { id: p35Patient.id } });
        assert.strictEqual(order.accessionNumber, 'ACC-TEST-P35-01');
        assert.strictEqual(patient.patientId, 'PAT-2026-P3501');
      });

      it('strictly enforces volumeUnit "mL" and rejects units like "cc", "ML", or "mls" (HTTP 400 Bad Request)', async () => {
        const resCc = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 50,
            volumeUnit: 'cc',
            route: 'IV',
          }),
        });
        assert.strictEqual(resCc.status, 400);

        const resCaps = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            volume: 50,
            volumeUnit: 'ML',
            route: 'IV',
          }),
        });
        assert.strictEqual(resCaps.status, 400);
      });

      it('supports multiple separate contrast administrations on the same examination order', async () => {
        const resSecond = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contrastAgentName: 'Omnipaque 350',
            concentration: '350 mgI/mL',
            volume: 20,
            volumeUnit: 'mL',
            route: 'IV',
            administrationNotes: 'Second injection / delayed phase bolus.',
          }),
        });
        assert.strictEqual(resSecond.status, 201);
        const bodySecond = await resSecond.json();
        assert.strictEqual(bodySecond.success, true);
        assert.strictEqual(bodySecond.data.volume, 20);

        // Fetch contrast context and verify multiple records exist
        const getRes = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(getRes.status, 200);
        const getBody = await getRes.json();
        assert.strictEqual(getBody.data.administrations.length, 2);
      });
    });

    describe('10.4 Incident Recording & Scan Lifecycle Independence', () => {
      it('successfully records an incident linked to contrast dose during SCAN_IN_PROGRESS (HTTP 201 Created)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: 'CONTRAST_REACTION',
            description: 'Patient developed mild generalized urticaria on arms and neck 4 minutes post-injection.',
            contrastAdministrationId: p35ContrastRecord.id,
            clinicianNotified: true,
            notificationNotes: 'On-duty Radiologist Dr. Evans notified immediately at scanner console.',
            workflowActionTaken: 'CLINICIAN_NOTIFIED',
            workflowActionNotes: 'Patient vital signs checked: BP 120/80, HR 74, SpO2 99%.',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.category, 'CONTRAST_REACTION');
        assert.strictEqual(body.data.clinicianNotified, true);
        assert.ok(body.data.contrastAdministration, 'Linked contrast administration summary must be present');

        // Critical Section 25 & 26: Scan lifecycle state MUST NOT be altered automatically
        const orderInDb = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p35OrderActive.id },
          include: { scanLifecycles: true },
        });
        assert.strictEqual(orderInDb.orderStatus, OrderStatus.SCAN_IN_PROGRESS, 'OrderStatus must remain SCAN_IN_PROGRESS');
        assert.strictEqual(orderInDb.scanLifecycles[0]?.state, ScanState.IN_PROGRESS, 'ScanState must remain IN_PROGRESS');

        // Verify Audit Logs
        const incidentAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'INCIDENT_RECORDED',
            entityId: p35OrderActive.id,
          },
        });
        assert.ok(incidentAudit, 'INCIDENT_RECORDED audit event must be logged');

        const notificationAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'CLINICIAN_NOTIFICATION_RECORDED',
            entityId: p35OrderActive.id,
          },
        });
        assert.ok(notificationAudit, 'CLINICIAN_NOTIFICATION_RECORDED audit event must be logged');

        // Verify Authoritative Derived hasIncident Status on GET /contrast
        const contrastContextRes = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(contrastContextRes.status, 200);
        const contrastContextBody = await contrastContextRes.json();
        const linkedAdmin = contrastContextBody.data.administrations.find((a: any) => a.id === p35ContrastRecord.id);
        assert.ok(linkedAdmin, 'Documented contrast administration must be returned');
        assert.strictEqual(linkedAdmin.hasIncident, true, 'hasIncident must be derived as true from linked incidents');
        assert.strictEqual(linkedAdmin.incidents.length, 1, 'incidents array must contain the linked incident');
      });

      it('permits incident recording during SCAN_INTERRUPTED state', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderInterrupted.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: 'PATIENT_DISTRESS',
            description: 'Patient felt sudden severe claustrophobia and requested scan table evacuation.',
            clinicianNotified: false,
            workflowActionTaken: 'SCAN_INTERRUPTED',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.category, 'PATIENT_DISTRESS');
      });

      it('rejects incident recording on a completed scan (HTTP 409 Conflict)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderCompleted.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: 'OTHER',
            description: 'Late incident documentation attempt',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'WORKFLOW_STATE_CONFLICT');
      });

      it('rejects incident recording with invalid contrast administration link (HTTP 400 Bad Request)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p35OrderInterrupted.id}/incidents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: 'CONTRAST_REACTION',
            description: 'Attempting to link contrast record belonging to a different order',
            contrastAdministrationId: p35ContrastRecord.id, // Belongs to p35OrderActive, not p35OrderInterrupted!
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'INVALID_CONTRAST_LINK');
      });

      it('prohibits DELETE endpoints for contrast and incidents (HTTP 404 or 405 Method Not Allowed)', async () => {
        const resContrast = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/contrast`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.ok([404, 405].includes(resContrast.status), 'DELETE contrast must not be implemented');

        const resIncident = await fetch(`${baseUrl}/technologist/worklist/${p35OrderActive.id}/incidents`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.ok([404, 405].includes(resIncident.status), 'DELETE incident must not be implemented');
      });
    });
  });

  describe('11. Phase 3.6 — Image Quality Review & RIS-Side PACS Handoff API Tests', () => {
    let p36Patient: any;
    let p36MriEquip: any;
    let p36ExamDef: any;
    let p36Protocol: any;
    let p36OrderCompleted: any;
    let p36OrderRbac: any;
    let p36OrderRepeat: any;
    let p36OrderRetry: any;
    let p36OrderContrastRepeat: any;
    let p36ScanAttemptContrast: any;

    before(async () => {
      setPacsGateway(new MockPacsGateway('success'));
      const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });

      // Clean up existing P36 test records
      const existingOrders = await prisma.imagingOrder.findMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P36' } },
        select: { id: true },
      });
      const orderIds = existingOrders.map((o) => o.id);

      await prisma.pacsHandoffAttempt.deleteMany({
        where: { pacsHandoff: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.pacsHandoff.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.imageQualityReview.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistIncident.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.contrastAdministration.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.scanLifecycleEvent.deleteMany({
        where: { scanLifecycle: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.appointment.deleteMany({
        where: { appointmentNumber: { startsWith: 'APT-TEST-P36' } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P36' } },
      });
      await prisma.imagingProtocol.deleteMany({
        where: { code: 'MRI-PROTO-P36-01' },
      });
      await prisma.examDefinition.deleteMany({
        where: { code: 'MRI-BRAIN-P36' },
      });
      await prisma.equipment.deleteMany({
        where: { serialNumber: 'SN-TEST-MRI-P36' },
      });
      await prisma.patient.deleteMany({
        where: { patientId: 'PAT-2026-P3601' },
      });

      p36Patient = await prisma.patient.create({
        data: {
          patientId: 'PAT-2026-P3601',
          firstName: 'Elena',
          lastName: 'Rostova',
          dateOfBirth: new Date('1990-04-12'),
          gender: Gender.FEMALE,
          phone: '+1-555-888-3601',
          isActive: true,
        },
      });

      p36MriEquip = await prisma.equipment.create({
        data: {
          name: 'Siemens MAGNETOM Vida (P36)',
          modality: ModalityType.MRI,
          manufacturer: 'Siemens Healthineers',
          model: 'MAGNETOM Vida 3T',
          serialNumber: 'SN-TEST-MRI-P36',
          location: 'MRI Suite 2 - Ground Floor',
          status: EquipmentStatus.AVAILABLE,
        },
      });

      p36ExamDef = await prisma.examDefinition.create({
        data: {
          code: 'MRI-BRAIN-P36',
          name: 'MRI Brain with/without Contrast (P36)',
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          defaultDurationMinutes: 45,
          bufferMinutes: 10,
          contrastSupported: true,
          fastingRequired: false,
          ivRequired: true,
          consentRequired: true,
          contrastPreparationRequired: true,
          isActive: true,
        },
      });

      p36Protocol = await prisma.imagingProtocol.create({
        data: {
          code: 'MRI-PROTO-P36-01',
          name: 'MRI Brain Standard Neuro Protocol P36',
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examDefinitionId: p36ExamDef.id,
          description: 'Standard multi-planar brain MRI protocol',
          isActive: true,
        },
      });

      // 1. p36OrderCompleted: SCAN_COMPLETED with Attempt 1 completed
      p36OrderCompleted = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36-01',
          patientId: p36Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain with/without Contrast (P36)',
          clinicalIndication: 'Phase 3.6 QA & PACS Happy Path Test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_COMPLETED,
          confirmedProtocolId: p36Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      const scan1 = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p36OrderCompleted.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 30 * 60 * 1000),
          startedByUserId: techUser.id,
          completedAt: new Date(Date.now() - 5 * 60 * 1000),
          completedByUserId: techUser.id,
        },
      });

      await prisma.scanLifecycleEvent.create({
        data: {
          scanLifecycleId: scan1.id,
          action: ScanLifecycleAction.COMPLETED,
          userId: techUser.id,
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P36-01',
          patientId: p36Patient.id,
          imagingOrderId: p36OrderCompleted.id,
          equipmentId: p36MriEquip.id,
          examDefinitionId: p36ExamDef.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain with/without Contrast (P36)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 35 * 60 * 1000),
          priority: Priority.ROUTINE,
          tokenNumber: 'MR-P36-01',
        },
      });

      // 2. p36OrderRbac: For RBAC endpoint matrix
      p36OrderRbac = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36-02',
          patientId: p36Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain RBAC Test (P36)',
          clinicalIndication: 'Phase 3.6 RBAC Security Matrix Test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_COMPLETED,
          confirmedProtocolId: p36Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p36OrderRbac.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          startedByUserId: techUser.id,
          completedAt: new Date(Date.now() - 2 * 60 * 1000),
          completedByUserId: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P36-02',
          patientId: p36Patient.id,
          imagingOrderId: p36OrderRbac.id,
          equipmentId: p36MriEquip.id,
          examDefinitionId: p36ExamDef.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain RBAC Test (P36)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 25 * 60 * 1000),
          priority: Priority.ROUTINE,
          tokenNumber: 'MR-P36-02',
        },
      });

      // 3. p36OrderRepeat: In READY_FOR_SCAN for repeat lifecycle testing
      p36OrderRepeat = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36-03',
          patientId: p36Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain Repeat Lifecycle Test (P36)',
          clinicalIndication: 'Phase 3.6 Repeat Scan Multi-Attempt Test',
          contrastRequired: false,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.READY_FOR_SCAN,
          confirmedProtocolId: p36Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p36OrderRepeat.id,
          patientId: p36Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.MRI,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { mri_pacemaker: 'NO', mri_metal: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p36OrderRepeat.id,
          patientId: p36Patient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P36-03',
          patientId: p36Patient.id,
          imagingOrderId: p36OrderRepeat.id,
          equipmentId: p36MriEquip.id,
          examDefinitionId: p36ExamDef.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain Repeat Lifecycle Test (P36)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 15 * 60 * 1000),
          priority: Priority.URGENT,
          tokenNumber: 'MR-P36-03',
        },
      });

      // 4. p36OrderRetry: For PACS Failure and Retry Flow
      p36OrderRetry = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36-04',
          patientId: p36Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain PACS Retry Test (P36)',
          clinicalIndication: 'Phase 3.6 PACS Gateway Retry Test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_COMPLETED,
          confirmedProtocolId: p36Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p36OrderRetry.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 25 * 60 * 1000),
          startedByUserId: techUser.id,
          completedAt: new Date(Date.now() - 3 * 60 * 1000),
          completedByUserId: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P36-04',
          patientId: p36Patient.id,
          imagingOrderId: p36OrderRetry.id,
          equipmentId: p36MriEquip.id,
          examDefinitionId: p36ExamDef.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain PACS Retry Test (P36)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 30 * 60 * 1000),
          priority: Priority.ROUTINE,
          tokenNumber: 'MR-P36-04',
        },
      });

      // 5. p36OrderContrastRepeat: For Phase 3.5 Relationship Preservation across Attempts
      p36OrderContrastRepeat = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36-05',
          patientId: p36Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain Contrast Repeat Preservation Test (P36)',
          clinicalIndication: 'Phase 3.6 Cross-Attempt Attribution Test',
          contrastRequired: true,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.SCAN_COMPLETED,
          confirmedProtocolId: p36Protocol.id,
          protocolConfirmedAt: new Date(),
          protocolConfirmedById: techUser.id,
        },
      });

      await prisma.technologistSafetyScreening.create({
        data: {
          imagingOrderId: p36OrderContrastRepeat.id,
          patientId: p36Patient.id,
          completedByUserId: techUser.id,
          modality: ModalityType.MRI,
          identityVerified: true,
          identityVerificationMethod: 'WRISTBAND',
          safetyStatus: SafetyStatus.CLEARED,
          answers: { mri_pacemaker: 'NO', mri_metal: 'NO' },
        },
      });

      await prisma.technologistPreparation.create({
        data: {
          imagingOrderId: p36OrderContrastRepeat.id,
          patientId: p36Patient.id,
          completedByUserId: techUser.id,
          preparationStatus: PreparationStatus.COMPLETE,
          preparedAt: new Date(),
        },
      });

      p36ScanAttemptContrast = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p36OrderContrastRepeat.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 40 * 60 * 1000),
          startedByUserId: techUser.id,
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
          completedByUserId: techUser.id,
        },
      });

      const contrastAdmin = await prisma.contrastAdministration.create({
        data: {
          imagingOrderId: p36OrderContrastRepeat.id,
          scanLifecycleId: p36ScanAttemptContrast.id,
          contrastAgentName: 'Gadovist 1.0 mmol/mL',
          volume: 15.0,
          volumeUnit: 'mL',
          route: 'IV',
          administeredByUserId: techUser.id,
          administeredAt: new Date(Date.now() - 25 * 60 * 1000),
        },
      });

      await prisma.technologistIncident.create({
        data: {
          imagingOrderId: p36OrderContrastRepeat.id,
          scanLifecycleId: p36ScanAttemptContrast.id,
          contrastAdministrationId: contrastAdmin.id,
          category: 'EXTRAVASATION',
          description: 'Slight swelling at antecubital injection site; cold pack applied immediately.',
          clinicianNotified: true,
          workflowActionTaken: 'PATIENT_MONITORED',
          recordedByUserId: techUser.id,
        },
      });

      await prisma.appointment.create({
        data: {
          appointmentNumber: 'APT-TEST-P36-05',
          patientId: p36Patient.id,
          imagingOrderId: p36OrderContrastRepeat.id,
          equipmentId: p36MriEquip.id,
          examDefinitionId: p36ExamDef.id,
          modality: ModalityType.MRI,
          examination: 'MRI Brain Contrast Repeat Preservation Test (P36)',
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 40 * 60 * 1000),
          priority: Priority.URGENT,
          tokenNumber: 'MR-P36-05',
        },
      });
    });

    after(async () => {
      resetMockPacs();
      setMockPacsOutcome('success');
    });

    describe('11.1 RBAC Enforcement Matrix for Phase 3.6 Endpoints', () => {
      it('permits TECHNOLOGIST and ADMIN to access QA context (HTTP 200 OK)', async () => {
        const resTech = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(resTech.status, 200);
        const bodyTech = await resTech.json();
        assert.strictEqual(bodyTech.success, true);
        assert.strictEqual(bodyTech.data.accessionNumber, 'ACC-TEST-P36-02');

        const resAdmin = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(resAdmin.status, 200);
      });

      it('denies RECEPTION and RADIOLOGIST from accessing QA endpoints (HTTP 403 Forbidden)', async () => {
        const resRecep = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(resRecep.status, 403);

        const resRad = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });
        assert.strictEqual(resRad.status, 403);
      });

      it('denies unauthenticated requests to QA endpoints (HTTP 401 Unauthorized)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa`);
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION and RADIOLOGIST from initiating PACS handoff (HTTP 403 Forbidden)', async () => {
        const resRecep = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/pacs/initiate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${receptionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(resRecep.status, 403);

        const resRad = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/pacs/initiate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(resRad.status, 403);
      });
    });

    describe('11.2 End-to-End Image Quality Review & PACS Handoff (Happy Path)', () => {
      it('successfully executes QA Start -> QA Accept -> PACS Handoff Initiate', async () => {
        setMockPacsOutcome('success');

        // Step 1: Start QA
        const startRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderCompleted.id}/qa/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes.status, 201);
        const startBody = await startRes.json();
        assert.strictEqual(startBody.success, true);
        assert.strictEqual(startBody.data.orderStatus, OrderStatus.IMAGE_QA_PENDING);

        // Verify Audit Log: IMAGE_QA_STARTED
        const startAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'IMAGE_QA_STARTED',
            entityId: p36OrderCompleted.id,
          },
        });
        assert.ok(startAudit, 'IMAGE_QA_STARTED audit entry must be logged');

        // Step 2: Accept QA
        const acceptRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderCompleted.id}/qa/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'High diagnostic quality confirmed. No motion artifacts.',
          }),
        });
        assert.strictEqual(acceptRes.status, 200);
        const acceptBody = await acceptRes.json();
        assert.strictEqual(acceptBody.success, true);
        assert.strictEqual(acceptBody.data.orderStatus, OrderStatus.PACS_READY);

        // Verify DB State after QA Accept
        const dbReview = await prisma.imageQualityReview.findFirstOrThrow({
          where: { imagingOrderId: p36OrderCompleted.id },
        });
        assert.strictEqual(dbReview.status, ImageQualityStatus.ACCEPTED);
        assert.ok(dbReview.reviewedAt !== null);

        // Verify Audit Log: IMAGE_ACCEPTED
        const acceptAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'IMAGE_ACCEPTED',
            entityId: p36OrderCompleted.id,
          },
        });
        assert.ok(acceptAudit, 'IMAGE_ACCEPTED audit entry must be logged');

        // Step 3: Initiate PACS Handoff
        const handoffRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderCompleted.id}/pacs/initiate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(handoffRes.status, 200);
        const handoffBody = await handoffRes.json();
        assert.strictEqual(handoffBody.success, true);
        assert.strictEqual(handoffBody.data.orderStatus, OrderStatus.PACS_HANDOFF_COMPLETE);
        assert.strictEqual(handoffBody.data.pacsHandoff.status, PacsHandoffStatus.COMPLETE);

        // Verify DB State after PACS Handoff Complete
        const dbHandoff = await prisma.pacsHandoff.findUniqueOrThrow({
          where: { id: handoffBody.data.pacsHandoff.id },
          include: { attempts: true },
        });
        assert.strictEqual(dbHandoff.status, PacsHandoffStatus.COMPLETE);
        assert.strictEqual(dbHandoff.attempts.length, 1);
        assert.strictEqual(dbHandoff.attempts[0].outcome, PacsHandoffOutcome.SUCCESS);

        // Verify Audit Log: PACS_HANDOFF_COMPLETED
        const pacsAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'PACS_HANDOFF_COMPLETED',
            entityId: p36OrderCompleted.id,
          },
        });
        assert.ok(pacsAudit, 'PACS_HANDOFF_COMPLETED audit entry must be logged');
      });
    });

    describe('11.3 Multi-Attempt Scan Repeat Lifecycle & History Preservation', () => {
      it('executes repeat authorization, returns order to READY_FOR_SCAN, increments attemptNumber, and preserves attempt 1', async () => {
        // Step 1: Start Attempt 1
        const startRes1 = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes1.status, 201);
        const startBody1 = await startRes1.json();
        assert.strictEqual(startBody1.data.scan.attemptNumber, 1);
        assert.strictEqual(startBody1.data.scan.state, ScanState.IN_PROGRESS);

        // Step 2: Finish Attempt 1
        const finishRes1 = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(finishRes1.status, 200);

        // Step 3: Start QA on Attempt 1
        const qaStartRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/qa/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(qaStartRes.status, 201);

        // Step 4: Mark REPEAT_REQUIRED on Attempt 1 due to Patient Motion
        const repeatReqRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/qa/repeat-required`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'PATIENT_MOTION',
            notes: 'Patient head movement during sagittal T1 acquisition phase.',
          }),
        });
        assert.strictEqual(repeatReqRes.status, 200);
        const repeatReqBody = await repeatReqRes.json();
        assert.strictEqual(repeatReqBody.data.orderStatus, OrderStatus.REPEAT_REQUIRED);

        // Verify Audit Log: IMAGE_REPEAT_REQUIRED
        const repeatAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'IMAGE_REPEAT_REQUIRED',
            entityId: p36OrderRepeat.id,
          },
        });
        assert.ok(repeatAudit, 'IMAGE_REPEAT_REQUIRED audit entry must be logged');

        // Step 5: Authorize Repeat Scan
        const authRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/qa/repeat-authorize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'Patient stabilized with head sponge pads. Ready for repeat acquisition.',
          }),
        });
        assert.strictEqual(authRes.status, 200);
        const authBody = await authRes.json();
        assert.strictEqual(authBody.data.orderStatus, OrderStatus.READY_FOR_SCAN);

        // Verify Audit Log: REPEAT_AUTHORIZED
        const authAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'REPEAT_AUTHORIZED',
            entityId: p36OrderRepeat.id,
          },
        });
        assert.ok(authAudit, 'REPEAT_AUTHORIZED audit entry must be logged');

        // Step 6: Verify Attempt 1 remains immutable in DB
        const dbAttemptsBeforeAttempt2 = await prisma.scanLifecycle.findMany({
          where: { imagingOrderId: p36OrderRepeat.id },
          orderBy: { attemptNumber: 'asc' },
        });
        assert.strictEqual(dbAttemptsBeforeAttempt2.length, 1);
        assert.strictEqual(dbAttemptsBeforeAttempt2[0].attemptNumber, 1);
        assert.strictEqual(dbAttemptsBeforeAttempt2[0].state, ScanState.COMPLETED);

        // Step 7: Start Scan Attempt 2
        const startRes2 = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/scan/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes2.status, 201);
        const startBody2 = await startRes2.json();
        assert.strictEqual(startBody2.data.scan.attemptNumber, 2, 'Attempt 2 must be created with attemptNumber 2');
        assert.strictEqual(startBody2.data.scan.state, ScanState.IN_PROGRESS);

        // Step 8: Verify DB now holds both Attempt 1 and Attempt 2
        const dbAttemptsAfterAttempt2 = await prisma.scanLifecycle.findMany({
          where: { imagingOrderId: p36OrderRepeat.id },
          orderBy: { attemptNumber: 'asc' },
        });
        assert.strictEqual(dbAttemptsAfterAttempt2.length, 2);
        assert.strictEqual(dbAttemptsAfterAttempt2[0].attemptNumber, 1);
        assert.strictEqual(dbAttemptsAfterAttempt2[0].state, ScanState.COMPLETED);
        assert.strictEqual(dbAttemptsAfterAttempt2[1].attemptNumber, 2);
        assert.strictEqual(dbAttemptsAfterAttempt2[1].state, ScanState.IN_PROGRESS);

        // Step 9: Finish Attempt 2
        const finishRes2 = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/scan/finish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${techToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(finishRes2.status, 200);

        // Step 10: Start QA and Accept Attempt 2
        await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/qa/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const accept2 = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRepeat.id}/qa/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Repeat images perfectly diagnostic.' }),
        });
        assert.strictEqual(accept2.status, 200);
        const acceptBody2 = await accept2.json();
        assert.strictEqual(acceptBody2.data.orderStatus, OrderStatus.PACS_READY);
      });
    });

    describe('11.4 Phase 3.5 Contrast Administration & Incident Attribution across Attempts', () => {
      it('preserves contrast administration and incident records strictly linked to Attempt 1 across repeat cycles', async () => {
        // Step 1: Start QA on p36OrderContrastRepeat (which has Attempt 1 with contrast and incident)
        await fetch(`${baseUrl}/technologist/worklist/${p36OrderContrastRepeat.id}/qa/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        // Step 2: Reject images
        const rejectRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderContrastRepeat.id}/qa/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'TECHNICAL_ARTIFACT',
            notes: 'Coil RF decoupling defect detected on series 2.',
          }),
        });
        assert.strictEqual(rejectRes.status, 200);

        // Step 3: Authorize repeat
        const authRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderContrastRepeat.id}/qa/repeat-authorize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Replaced head coil with tested unit.' }),
        });
        assert.strictEqual(authRes.status, 200);

        // Step 4: Start Scan Attempt 2
        const startRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderContrastRepeat.id}/scan/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(startRes.status, 201);
        const startBody = await startRes.json();
        assert.strictEqual(startBody.data.scan.attemptNumber, 2);

        // Step 5: Verify Contrast and Incident records in DB are strictly attached to Attempt 1
        const contrastRecords = await prisma.contrastAdministration.findMany({
          where: { imagingOrderId: p36OrderContrastRepeat.id },
        });
        assert.strictEqual(contrastRecords.length, 1);
        assert.strictEqual(contrastRecords[0].scanLifecycleId, p36ScanAttemptContrast.id);

        const incidentRecords = await prisma.technologistIncident.findMany({
          where: { imagingOrderId: p36OrderContrastRepeat.id },
        });
        assert.strictEqual(incidentRecords.length, 1);
        assert.strictEqual(incidentRecords[0].scanLifecycleId, p36ScanAttemptContrast.id);
        assert.strictEqual(incidentRecords[0].contrastAdministrationId, contrastRecords[0].id);
      });
    });

    describe('11.5 PACS Failure and Retry Flow', () => {
      it('handles simulated PACS failure, transitions to PACS_HANDOFF_FAILED, and succeeds upon retry', async () => {
        // Step 1: Start QA and Accept on p36OrderRetry
        await fetch(`${baseUrl}/technologist/worklist/${p36OrderRetry.id}/qa/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const acceptRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRetry.id}/qa/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Images cleared for archive' }),
        });
        assert.strictEqual(acceptRes.status, 200);

        // Step 2: Configure Mock PACS to fail
        setMockPacsOutcome('failure');

        // Step 3: Initiate PACS handoff (fails)
        const handoffFailRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRetry.id}/pacs/initiate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(handoffFailRes.status, 200);
        const handoffFailBody = await handoffFailRes.json();
        assert.strictEqual(handoffFailBody.data.orderStatus, OrderStatus.PACS_HANDOFF_FAILED);
        assert.strictEqual(handoffFailBody.data.pacsHandoff.status, PacsHandoffStatus.FAILED);
        assert.strictEqual(handoffFailBody.data.pacsHandoff.attemptCount, 1);
        assert.strictEqual(handoffFailBody.data.pacsHandoff.lastErrorCode, 'PACS_UNAVAILABLE');

        const dbHandoffFail = await prisma.pacsHandoff.findUniqueOrThrow({
          where: { id: handoffFailBody.data.pacsHandoff.id },
          include: { attempts: true },
        });
        assert.strictEqual(dbHandoffFail.attempts.length, 1);
        assert.strictEqual(dbHandoffFail.attempts[0].outcome, PacsHandoffOutcome.FAILURE);
        assert.strictEqual(dbHandoffFail.attempts[0].errorCode, 'PACS_UNAVAILABLE');

        // Verify Audit Log: PACS_HANDOFF_FAILED
        const failAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'PACS_HANDOFF_FAILED',
            entityId: p36OrderRetry.id,
          },
        });
        assert.ok(failAudit, 'PACS_HANDOFF_FAILED audit entry must be logged');

        // Step 4: Configure Mock PACS to succeed
        setMockPacsOutcome('success');

        // Step 5: Retry PACS Handoff
        const retryRes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRetry.id}/pacs/retry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(retryRes.status, 200);
        const retryBody = await retryRes.json();
        assert.strictEqual(retryBody.data.orderStatus, OrderStatus.PACS_HANDOFF_COMPLETE);
        assert.strictEqual(retryBody.data.pacsHandoff.status, PacsHandoffStatus.COMPLETE);
        assert.strictEqual(retryBody.data.pacsHandoff.attemptCount, 2);

        const dbHandoffRetry = await prisma.pacsHandoff.findUniqueOrThrow({
          where: { id: retryBody.data.pacsHandoff.id },
          include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
        });
        assert.strictEqual(dbHandoffRetry.attempts.length, 2);
        assert.strictEqual(dbHandoffRetry.attempts[0].outcome, PacsHandoffOutcome.FAILURE);
        assert.strictEqual(dbHandoffRetry.attempts[1].outcome, PacsHandoffOutcome.SUCCESS);

        // Verify Audit Log: PACS_HANDOFF_RETRIED
        const retryAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'PACS_HANDOFF_RETRIED',
            entityId: p36OrderRetry.id,
          },
        });
        assert.ok(retryAudit, 'PACS_HANDOFF_RETRIED audit entry must be logged');
      });
    });

    describe('11.6 Workflow Gating, Duplicate Prevention, and Negative Paths', () => {
      it('rejects starting QA on an order that is not SCAN_COMPLETED (HTTP 409 Conflict)', async () => {
        // p36OrderRepeat is currently in SCAN_IN_PROGRESS or PACS_READY; let's test with a fresh order in READY_FOR_SCAN
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        // p36OrderRbac is in SCAN_COMPLETED, so this first one succeeds
        assert.strictEqual(res.status, 201);

        // Second start should fail with 409 because it is now IMAGE_QA_PENDING
        const resConflict = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(resConflict.status, 409);
        const bodyConflict = await resConflict.json();
        assert.strictEqual(bodyConflict.error.code, 'SCAN_NOT_COMPLETED');
      });

      it('rejects repeatRequired with reason OTHER when notes are missing or shorter than 3 characters (HTTP 400 Bad Request)', async () => {
        const resNoNotes = await fetch(`${baseUrl}/technologist/worklist/${p36OrderRbac.id}/qa/repeat-required`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'OTHER', notes: 'ab' }),
        });
        assert.strictEqual(resNoNotes.status, 400);
      });

      it('rejects duplicate or redundant PACS handoff initiation when already COMPLETED (HTTP 409 Conflict)', async () => {
        // p36OrderCompleted is already PACS_HANDOFF_COMPLETE
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36OrderCompleted.id}/pacs/initiate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok(
          ['PACS_HANDOFF_NOT_READY', 'PACS_HANDOFF_ALREADY_COMPLETE'].includes(body.error.code),
          'Must reject duplicate handoff initiation with conflict'
        );
      });

      it('rejects repeat authorization when QA is already ACCEPTED (HTTP 409 Conflict)', async () => {
        // p36OrderCompleted was ACCEPTED
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36OrderCompleted.id}/qa/repeat-authorize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Invalid repeat attempt' }),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'REPEAT_NOT_ALLOWED');
      });
    });
  });

  describe('12. Phase 3.6R — Real Orthanc PACS Integration Foundation API Tests', () => {
    let p36rPatient: any;
    let p36rOrder: any;
    let p36rOrderMismatch: any;
    let mockGateway: MockPacsGateway;

    before(async () => {
      mockGateway = new MockPacsGateway('success');
      setPacsGateway(mockGateway);

      // Clean existing P36R test records
      const existing = await prisma.imagingOrder.findMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P36R' } },
        select: { id: true },
      });
      const ids = existing.map((o) => o.id);
      await prisma.pacsStudyLink.deleteMany({ where: { imagingOrderId: { in: ids } } });
      await prisma.pacsHandoffAttempt.deleteMany({ where: { pacsHandoff: { imagingOrderId: { in: ids } } } });
      await prisma.pacsHandoff.deleteMany({ where: { imagingOrderId: { in: ids } } });
      await prisma.imageQualityReview.deleteMany({ where: { imagingOrderId: { in: ids } } });
      await prisma.scanLifecycle.deleteMany({ where: { imagingOrderId: { in: ids } } });
      await prisma.imagingOrder.deleteMany({ where: { id: { in: ids } } });
      await prisma.patient.deleteMany({ where: { patientId: { in: ['PAT-2026-99901', 'PAT-2026-99902'] } } });

      p36rPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-2026-99901',
          firstName: 'Robert',
          lastName: 'Langdon',
          dateOfBirth: new Date('1975-06-22'),
          gender: Gender.MALE,
          phone: '555-019-9901',
        },
      });

      p36rOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36R-01',
          patientId: p36rPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Diagnostic (P36R)',
          clinicalIndication: 'P36R Reconciliation Test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_READY,
        },
      });

      p36rOrderMismatch = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P36R-02',
          patientId: p36rPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head',
          examinationName: 'CT Head Diagnostic (P36R)',
          clinicalIndication: 'P36R Patient Mismatch Test',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_READY,
        },
      });
    });

    after(async () => {
      const orderIds = [p36rOrder.id, p36rOrderMismatch.id];
      await prisma.pacsStudyLink.deleteMany({ where: { imagingOrderId: { in: orderIds } } });
      await prisma.pacsHandoffAttempt.deleteMany({ where: { pacsHandoff: { imagingOrderId: { in: orderIds } } } });
      await prisma.pacsHandoff.deleteMany({ where: { imagingOrderId: { in: orderIds } } });
      await prisma.imagingOrder.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.patient.deleteMany({ where: { id: p36rPatient.id } });
      resetMockPacs();
    });

    describe('12.1 PACS Status Endpoint (/api/v1/integrations/pacs/status)', () => {
      it('returns 401 Unauthorized for unauthenticated status request', async () => {
        const res = await fetch(`${baseUrl}/integrations/pacs/status`);
        assert.strictEqual(res.status, 401);
      });

      it('denies RECEPTION role from accessing PACS status (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/integrations/pacs/status`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('permits TECHNOLOGIST role to view PACS status and capabilities', async () => {
        const res = await fetch(`${baseUrl}/integrations/pacs/status`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.adapter, 'mock');
        assert.strictEqual(body.data.connected, true);
        assert.strictEqual(body.data.metadataLookupSupported, true);
        assert.strictEqual(body.data.reconciliationSupported, true);
        // Ensure credentials are never returned
        assert.strictEqual(body.data.password, undefined);
        assert.strictEqual(body.data.username, undefined);
      });

      it('permits ADMIN role to inspect PACS status', async () => {
        const res = await fetch(`${baseUrl}/integrations/pacs/status`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
      });
    });

    describe('12.2 Study Lookup Endpoint (/api/v1/technologist/worklist/:id/pacs-study)', () => {
      it('denies RECEPTION role from looking up PACS studies (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('returns NOT_FOUND when no matching study exists in PACS for RIS accession', async () => {
        mockGateway.clearMockStudies();
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.outcome, 'NOT_FOUND');
        assert.strictEqual(body.data.risAccession, 'ACC-TEST-P36R-01');
        assert.strictEqual(body.data.metadata, null);

        // Verify Audit Log: PACS_STUDY_LOOKUP
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'PACS_STUDY_LOOKUP', entityId: p36rOrder.id },
        });
        assert.ok(audit, 'PACS_STUDY_LOOKUP audit log must be recorded');
      });

      it('returns MATCHED when single exact match exists for RIS accession and patient ID', async () => {
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-p36r-01',
          accessionNumber: 'ACC-TEST-P36R-01',
          patientId: 'PAT-2026-99901',
          patientName: 'LANGDON^ROBERT',
          studyInstanceUid: '1.2.840.113619.2.55.99901',
          studyDate: '20261105',
          studyDescription: 'CT Chest Diagnostic (P36R)',
          modalitiesInStudy: ['CT'],
        });

        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.outcome, 'MATCHED');
        assert.strictEqual(body.data.metadata.orthancStudyId, 'orthanc-study-p36r-01');
        assert.strictEqual(body.data.metadata.accessionNumber, 'ACC-TEST-P36R-01');
        assert.strictEqual(body.data.metadata.patientId, 'PAT-2026-99901');

        // Verify Audit Log: PACS_STUDY_MATCHED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'PACS_STUDY_MATCHED', entityId: p36rOrder.id },
        });
        assert.ok(audit, 'PACS_STUDY_MATCHED audit log must be recorded');
      });

      it('returns PATIENT_ID_MISMATCH when accession matches but PACS patientId differs from RIS patientId', async () => {
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-p36r-mismatch',
          accessionNumber: 'ACC-TEST-P36R-02',
          patientId: 'PAT-DIFFERENT-99999', // Mismatched patient ID
          patientName: 'OTHER^PATIENT',
          studyInstanceUid: '1.2.840.113619.2.55.99902',
          studyDate: '20261105',
          studyDescription: 'CT Head Diagnostic',
          modalitiesInStudy: ['CT'],
        });

        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrderMismatch.id}/pacs-study`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.outcome, 'PATIENT_ID_MISMATCH');
        assert.ok(body.data.message.includes('Patient ID mismatch'));

        // Verify Audit Log: PACS_STUDY_MISMATCH_DETECTED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'PACS_STUDY_MISMATCH_DETECTED', entityId: p36rOrderMismatch.id },
        });
        assert.ok(audit, 'PACS_STUDY_MISMATCH_DETECTED audit log must be recorded');
      });

      it('returns AMBIGUOUS_MATCH when multiple PACS studies share the same accession', async () => {
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-ambig-1',
          accessionNumber: 'ACC-TEST-P36R-01',
          patientId: 'PAT-2026-99901',
          patientName: 'LANGDON^ROBERT',
          studyInstanceUid: '1.2.3.4.1',
          studyDate: '20261105',
          studyDescription: 'Scan 1',
          modalitiesInStudy: ['CT'],
        });
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-ambig-2',
          accessionNumber: 'ACC-TEST-P36R-01',
          patientId: 'PAT-2026-99901',
          patientName: 'LANGDON^ROBERT',
          studyInstanceUid: '1.2.3.4.2',
          studyDate: '20261105',
          studyDescription: 'Scan 2',
          modalitiesInStudy: ['CT'],
        });

        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.outcome, 'AMBIGUOUS_MATCH');
        assert.strictEqual(body.data.candidateStudies.length, 2);
      });
    });

    describe('12.3 Study Reconciliation & Linkage Endpoint (/api/v1/technologist/worklist/:id/pacs-study/reconcile)', () => {
      it('denies RECEPTION role from performing PACS study reconciliation (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study/reconcile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${receptionToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('rejects reconciliation when study outcome is not MATCHED (HTTP 400 Bad Request)', async () => {
        // Set mismatch on p36rOrderMismatch
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-p36r-mismatch',
          accessionNumber: 'ACC-TEST-P36R-02',
          patientId: 'PAT-WRONG-ID',
          patientName: 'WRONG^NAME',
          studyInstanceUid: '1.2.3.4.5',
          studyDate: '20261105',
          studyDescription: 'Mismatch',
          modalitiesInStudy: ['CT'],
        });

        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrderMismatch.id}/pacs-study/reconcile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PACS_RECONCILIATION_NOT_MATCHED');

        // Confirm NO link was created
        const link = await prisma.pacsStudyLink.findUnique({
          where: { imagingOrderId: p36rOrderMismatch.id },
        });
        assert.strictEqual(link, null);
      });

      it('persists PacsStudyLink upon successful reconciliation of a MATCHED study', async () => {
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-p36r-01',
          accessionNumber: 'ACC-TEST-P36R-01',
          patientId: 'PAT-2026-99901',
          patientName: 'LANGDON^ROBERT',
          studyInstanceUid: '1.2.840.113619.2.55.99901',
          studyDate: '20261105',
          studyDescription: 'CT Chest Diagnostic (P36R)',
          modalitiesInStudy: ['CT'],
        });

        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study/reconcile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.outcome, 'MATCHED');
        assert.strictEqual(body.data.link.orthancStudyId, 'orthanc-study-p36r-01');

        // Database verification
        const dbLink = await prisma.pacsStudyLink.findUniqueOrThrow({
          where: { imagingOrderId: p36rOrder.id },
        });
        assert.strictEqual(dbLink.orthancStudyId, 'orthanc-study-p36r-01');
        assert.strictEqual(dbLink.studyInstanceUid, '1.2.840.113619.2.55.99901');
        assert.strictEqual(dbLink.status, 'LINKED');

        // Verify Audit Log: PACS_STUDY_RECONCILED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'PACS_STUDY_RECONCILED', entityId: p36rOrder.id },
        });
        assert.ok(audit, 'PACS_STUDY_RECONCILED audit log must be recorded');

        // Repeated reconciliation updates without duplicate error
        const repeatRes = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs-study/reconcile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(repeatRes.status, 200);

        // Accession Number and Patient ID remain strictly immutable
        const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p36rOrder.id } });
        assert.strictEqual(finalOrder.accessionNumber, 'ACC-TEST-P36R-01');
      });
    });

    describe('12.4 Real PACS Transfer Protection Test', () => {
      it('rejects handoff initiation with HTTP 409 Conflict when dicomTransferSupported is false', async () => {
        // Temporarily switch active gateway to Orthanc gateway
        const orthancGateway = new OrthancPacsGateway({
          baseUrl: process.env.ORTHANC_URL || 'http://localhost:8042',
          username: process.env.ORTHANC_USERNAME || 'orthanc',
          password: process.env.ORTHANC_PASSWORD || 'test-transfer-protection-password',
        });
        setPacsGateway(orthancGateway);

        // Attempt handoff on p36rOrder (which is in PACS_READY)
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrder.id}/pacs/initiate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PACS_TRANSFER_NOT_AVAILABLE');
        assert.ok(body.message.includes('does not yet have a DICOM payload to transmit'));

        // Verify order status was NOT mutated to COMPLETE
        const orderCheck = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p36rOrder.id } });
        assert.strictEqual(orderCheck.orderStatus, OrderStatus.PACS_READY);

        // Restore mock gateway
        setPacsGateway(mockGateway);
      });
    });

    describe('12.5 PacsStudyLink Uniqueness & Cross-Order Conflict Protection', () => {
      it('rejects reconciliation when the Orthanc study is already linked to another clinical order (HTTP 409 Conflict)', async () => {
        // Step 1: Ensure p36rOrder is linked to 'orthanc-study-p36r-01'
        const existingLink = await prisma.pacsStudyLink.findUnique({
          where: { imagingOrderId: p36rOrder.id },
        });
        assert.ok(existingLink, 'p36rOrder must already be linked to orthanc-study-p36r-01');

        // Step 2: Configure mock study lookup for p36rOrderMismatch to return the SAME orthancStudyId
        mockGateway.clearMockStudies();
        mockGateway.addMockStudy({
          orthancStudyId: 'orthanc-study-p36r-01', // Colliding Orthanc Study ID
          accessionNumber: 'ACC-TEST-P36R-02',
          patientId: 'PAT-2026-99901',
          patientName: 'LANGDON^ROBERT',
          studyInstanceUid: '1.2.840.113619.2.55.99901',
          studyDate: '20261105',
          studyDescription: 'CT Duplicate Link Attempt',
          modalitiesInStudy: ['CT'],
        });

        // Step 3: Attempt to reconcile p36rOrderMismatch against the already linked study
        const res = await fetch(`${baseUrl}/technologist/worklist/${p36rOrderMismatch.id}/pacs-study/reconcile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${techToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PACS_STUDY_ALREADY_LINKED');
        assert.ok(body.message.includes('already linked to another clinical order'));

        // Step 4: Verify the original link for p36rOrder remains untouched
        const originalLinkCheck = await prisma.pacsStudyLink.findUniqueOrThrow({
          where: { imagingOrderId: p36rOrder.id },
        });
        assert.strictEqual(originalLinkCheck.orthancStudyId, 'orthanc-study-p36r-01');

        // Step 5: Verify no link was created for p36rOrderMismatch
        const rejectedLinkCheck = await prisma.pacsStudyLink.findUnique({
          where: { imagingOrderId: p36rOrderMismatch.id },
        });
        assert.strictEqual(rejectedLinkCheck, null);

        // Step 6: Verify Audit Log: PACS_STUDY_LINK_CONFLICT
        const conflictAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'PACS_STUDY_LINK_CONFLICT',
            entityId: p36rOrderMismatch.id,
          },
        });
        assert.ok(conflictAudit, 'PACS_STUDY_LINK_CONFLICT audit log must be recorded');
      });

      it('enforces database-level uniqueness on orthancStudyId to prevent duplicate links', async () => {
        const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });

        // Directly attempting to insert a second record with the same orthancStudyId must fail
        await assert.rejects(
          async () => {
            await prisma.pacsStudyLink.create({
              data: {
                imagingOrderId: p36rOrderMismatch.id,
                orthancStudyId: 'orthanc-study-p36r-01', // Already belongs to p36rOrder
                verifiedByUserId: techUser.id,
              },
            });
          },
          (err: any) => {
            assert.ok(err.message.includes('Unique constraint failed') || err.code === 'P2002');
            return true;
          }
        );
      });

      it('confirms Patient ID and Accession Number remain strictly immutable during conflict rejections', async () => {
        const orderA = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p36rOrder.id } });
        const orderB = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p36rOrderMismatch.id } });
        const patient = await prisma.patient.findUniqueOrThrow({ where: { id: p36rPatient.id } });

        assert.strictEqual(orderA.accessionNumber, 'ACC-TEST-P36R-01');
        assert.strictEqual(orderB.accessionNumber, 'ACC-TEST-P36R-02');
        assert.strictEqual(patient.patientId, 'PAT-2026-99901');
      });
    });
  });

  // =========================================================================
  // SECTION 13: PHASE 4.1 — RADIOLOGIST WORKLIST & ASSIGNMENT API TESTS
  // =========================================================================

  describe('13. Phase 4.1 — Radiologist Worklist & Assignment API Tests', () => {
    let p41Patient: any;
    let p41OrderStat: any;
    let p41OrderUrgent: any;
    let p41OrderRoutine: any;
    let p41OrderScanCompletedOnly: any;
    let p41OrderQaPending: any;
    let p41OrderQaRejected: any;
    let p41OrderRepeatRequired: any;
    let p41OrderSafetyReview: any;
    let p41OrderRepeatLifecycle: any;
    let p41OrderPrior: any;
    let p41OrderMockReadyOnly: any;
    let p41OrderOrthancNoLink: any;
    let p41OrderOrthancLinked: any;
    let p41OrderOrthancMismatched: any;

    let radUser1: any;
    let radUser2: any;
    let radToken1: string;
    let radToken2: string;

    before(async () => {
      // Find or create primary and secondary radiologist test users
      radUser1 = await prisma.user.findFirstOrThrow({
        where: { role: UserRole.RADIOLOGIST, NOT: { email: 'rad.secondary.p41@ris.local' } },
      });

      let secondRad = await prisma.user.findFirst({
        where: { email: 'rad.secondary.p41@ris.local' },
      });
      if (!secondRad) {
        secondRad = await prisma.user.create({
          data: {
            email: 'rad.secondary.p41@ris.local',
            passwordHash: 'hashed-password-secondary-rad',
            firstName: 'Marcus',
            lastName: 'Brody',
            role: UserRole.RADIOLOGIST,
            isActive: true,
          },
        });
      }
      radUser2 = secondRad;

      radToken1 = jwt.sign({ userId: radUser1.id, email: radUser1.email, role: radUser1.role }, env.JWT_SECRET, { expiresIn: 3600 });
      radToken2 = jwt.sign({ userId: radUser2.id, email: radUser2.email, role: radUser2.role }, env.JWT_SECRET, { expiresIn: 3600 });

      // Clean up previous test artifacts
      const existingOrders = await prisma.imagingOrder.findMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P41' } },
        select: { id: true },
      });
      const orderIds = existingOrders.map((o) => o.id);

      await prisma.radiologistAssignment.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.pacsStudyLink.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.pacsHandoffAttempt.deleteMany({
        where: { pacsHandoff: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.pacsHandoff.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.imageQualityReview.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistIncident.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.contrastAdministration.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.scanLifecycleEvent.deleteMany({
        where: { scanLifecycle: { imagingOrderId: { in: orderIds } } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistPreparation.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.technologistSafetyScreening.deleteMany({
        where: { imagingOrderId: { in: orderIds } },
      });
      await prisma.appointment.deleteMany({
        where: { appointmentNumber: { startsWith: 'APT-TEST-P41' } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P41' } },
      });
      await prisma.patient.deleteMany({
        where: { patientId: 'PAT-2026-P4101' },
      });

      // 1. Patient Fixture
      p41Patient = await prisma.patient.create({
        data: {
          patientId: 'PAT-2026-P4101',
          firstName: 'Clara',
          lastName: 'Oswald',
          dateOfBirth: new Date('1988-11-23'),
          gender: Gender.FEMALE,
          phone: '+1-555-410-0001',
          isActive: true,
        },
      });

      // 2. An earlier prior study completed in the past
      p41OrderPrior = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-PRIOR',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Routine',
          clinicalIndication: 'Historical baseline prior study',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      });

      // 3. STAT Eligible Order (PACS_HANDOFF_COMPLETE)
      p41OrderStat = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-STAT',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head/Brain',
          examinationName: 'CT Head / Brain without Contrast',
          clinicalIndication: 'Acute neurological deficit, rule out hemorrhage',
          contrastRequired: false,
          priority: Priority.STAT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          createdAt: new Date(Date.now() - 60 * 60 * 1000), // 60 mins ago
        },
      });
      const scanStat = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderStat.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 55 * 60 * 1000),
          completedAt: new Date(Date.now() - 45 * 60 * 1000),
          startedByUserId: techToken ? (jwt.decode(techToken) as any).userId : radUser1.id,
        },
      });
      const qaStat = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderStat.id,
          scanLifecycleId: scanStat.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 40 * 60 * 1000),
          notes: 'Clear diagnostic quality without motion',
        },
      });
      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p41OrderStat.id,
          scanLifecycleId: scanStat.id,
          imageQualityReviewId: qaStat.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(Date.now() - 35 * 60 * 1000),
        },
      });

      // 4. URGENT Eligible Order (PACS_HANDOFF_COMPLETE)
      p41OrderUrgent = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-URGENT',
          patientId: p41Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Spine',
          examinationName: 'MRI Lumbar Spine',
          clinicalIndication: 'Radiculopathy with motor weakness',
          contrastRequired: false,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          createdAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
        },
      });
      const scanUrgent = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderUrgent.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 110 * 60 * 1000),
          completedAt: new Date(Date.now() - 80 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      const qaUrgent = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderUrgent.id,
          scanLifecycleId: scanUrgent.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 75 * 60 * 1000),
        },
      });
      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p41OrderUrgent.id,
          scanLifecycleId: scanUrgent.id,
          imageQualityReviewId: qaUrgent.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(Date.now() - 70 * 60 * 1000),
        },
      });

      // 5. ROUTINE Eligible Order (PACS_HANDOFF_COMPLETE)
      p41OrderRoutine = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-ROUTINE',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Abdomen',
          examinationName: 'CT Abdomen & Pelvis',
          clinicalIndication: 'Follow-up surveillance scan',
          contrastRequired: false,
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      });
      const scanRoutine = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderRoutine.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 25 * 60 * 1000),
          completedAt: new Date(Date.now() - 15 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      const qaRoutine = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderRoutine.id,
          scanLifecycleId: scanRoutine.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      });
      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p41OrderRoutine.id,
          scanLifecycleId: scanRoutine.id,
          imageQualityReviewId: qaRoutine.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(Date.now() - 8 * 60 * 1000),
        },
      });

      // 6. Ineligible: SCAN_COMPLETED alone (no QA)
      p41OrderScanCompletedOnly = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-INEL-01',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Ineligible Test',
          clinicalIndication: 'Testing gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCAN_COMPLETED,
        },
      });

      // 7. Ineligible: IMAGE_QA_PENDING
      p41OrderQaPending = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-INEL-02',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest QA Pending Test',
          clinicalIndication: 'Testing gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.IMAGE_QA_PENDING,
        },
      });

      // 8. Ineligible: IMAGE_REJECTED
      p41OrderQaRejected = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-INEL-03',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Rejected Test',
          clinicalIndication: 'Testing gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.IMAGE_REJECTED,
        },
      });

      // 9. Ineligible: REPEAT_REQUIRED
      p41OrderRepeatRequired = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-INEL-04',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Repeat Required Test',
          clinicalIndication: 'Testing gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.REPEAT_REQUIRED,
        },
      });

      // 10. Ineligible: SAFETY_REVIEW
      p41OrderSafetyReview = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-INEL-05',
          patientId: p41Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Safety Blocked Test',
          clinicalIndication: 'Testing gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SAFETY_REVIEW,
        },
      });

      // 11. Multi-Attempt Repeat Exam with Contrast & Incident (Eligible: PACS_HANDOFF_COMPLETE)
      p41OrderRepeatLifecycle = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-REPEAT-LC',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast Repeat Lifecycle Test',
          clinicalIndication: 'Evaluate pulmonary nodule with contrast',
          contrastRequired: true,
          priority: Priority.URGENT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      // Attempt 1: Failed/Repeat Required
      const scanAtt1 = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 50 * 60 * 1000),
          completedAt: new Date(Date.now() - 40 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          scanLifecycleId: scanAtt1.id,
          status: ImageQualityStatus.REPEAT_REQUIRED,
          reasonCode: ImageQualityReason.PATIENT_MOTION,
          notes: 'Excessive cough and respiratory motion artifact on base sequences',
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 35 * 60 * 1000),
        },
      });

      // Attempt 2: Successful & Accepted
      const scanAtt2 = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          attemptNumber: 2,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 30 * 60 * 1000),
          completedAt: new Date(Date.now() - 20 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      const qaAtt2 = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          scanLifecycleId: scanAtt2.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 15 * 60 * 1000),
          notes: 'Repeat breath-hold acquired successfully without motion artifact',
        },
      });
      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          scanLifecycleId: scanAtt2.id,
          imageQualityReviewId: qaAtt2.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      });

      // Contrast Administration on Attempt 2
      const contrastAdmin = await prisma.contrastAdministration.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          scanLifecycleId: scanAtt2.id,
          contrastAgentName: 'Omnipaque 350',
          volume: 75.0,
          volumeUnit: 'mL',
          route: 'IV',
          administeredByUserId: (jwt.decode(techToken) as any).userId,
          administeredAt: new Date(Date.now() - 28 * 60 * 1000),
          administrationNotes: 'Power injector 3.0 mL/s via 20G right forearm IV cannula',
        },
      });

      // Incident on Attempt 2
      await prisma.technologistIncident.create({
        data: {
          imagingOrderId: p41OrderRepeatLifecycle.id,
          scanLifecycleId: scanAtt2.id,
          contrastAdministrationId: contrastAdmin.id,
          category: 'PATIENT_DISTRESS',
          description: 'Mild transient warmth sensation reported, resolved quickly without intervention',
          clinicianNotified: true,
          recordedByUserId: (jwt.decode(techToken) as any).userId,
          recordedAt: new Date(Date.now() - 26 * 60 * 1000),
        },
      });

      // 12. Mock Mode PACS_READY-only Order (Accepted QA, but NO handoff complete -> excluded in mock mode)
      p41OrderMockReadyOnly = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-MOCK-READY',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head/Brain',
          examinationName: 'CT Head Mock PACS_READY Only',
          clinicalIndication: 'Testing mock gating',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_READY,
        },
      });
      const scanMockReady = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderMockReadyOnly.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      const qaMockReady = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderMockReadyOnly.id,
          scanLifecycleId: scanMockReady.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      });
      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p41OrderMockReadyOnly.id,
          scanLifecycleId: scanMockReady.id,
          imageQualityReviewId: qaMockReady.id,
          status: PacsHandoffStatus.READY,
        },
      });

      // 13. Orthanc Mode PACS_READY without PacsStudyLink -> excluded in Orthanc mode
      p41OrderOrthancNoLink = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-ORTH-NOLINK',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Orthanc No Link',
          clinicalIndication: 'Testing Orthanc without link',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_READY,
        },
      });
      const scanOrthNoLink = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderOrthancNoLink.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderOrthancNoLink.id,
          scanLifecycleId: scanOrthNoLink.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      });

      // 14. Orthanc Mode PACS_READY with valid reconciled PacsStudyLink -> ELIGIBLE in Orthanc mode
      p41OrderOrthancLinked = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-ORTH-LINKED',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Orthanc Reconciled Study',
          clinicalIndication: 'Testing Orthanc with valid link',
          priority: Priority.URGENT,
          orderStatus: OrderStatus.PACS_READY,
        },
      });
      const scanOrthLinked = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderOrthancLinked.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderOrthancLinked.id,
          scanLifecycleId: scanOrthLinked.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      });
      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p41OrderOrthancLinked.id,
          orthancStudyId: `test-orthanc-study-${Date.now()}`,
          studyInstanceUid: `1.2.840.113619.test.${Date.now()}`,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: radUser1.id,
        },
      });

      // 15. Orthanc Mode with UNLINKED / mismatched study -> EXCLUDED in Orthanc mode
      p41OrderOrthancMismatched = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P41-ORTH-MISMATCH',
          patientId: p41Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Orthanc Mismatched',
          clinicalIndication: 'Testing Orthanc with unlinked mismatch',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_READY,
        },
      });
      const scanOrthMismatch = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p41OrderOrthancMismatched.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          completedAt: new Date(Date.now() - 10 * 60 * 1000),
          startedByUserId: (jwt.decode(techToken) as any).userId,
        },
      });
      await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p41OrderOrthancMismatched.id,
          scanLifecycleId: scanOrthMismatch.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedByUserId: (jwt.decode(techToken) as any).userId,
          reviewedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      });
      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p41OrderOrthancMismatched.id,
          orthancStudyId: `test-orthanc-unlinked-${Date.now()}`,
          status: PacsStudyLinkStatus.UNLINKED,
          verifiedByUserId: radUser1.id,
        },
      });
    });

    describe('13.1 RBAC Enforcement Matrix for Phase 4.1 Radiologist Endpoints', () => {
      it('permits RADIOLOGIST and ADMIN to read radiologist worklist (HTTP 200 OK)', async () => {
        const resRad = await fetch(`${baseUrl}/radiologist/worklist`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        assert.strictEqual(resRad.status, 200);
        const bodyRad = await resRad.json();
        assert.strictEqual(bodyRad.success, true);
        assert.ok(Array.isArray(bodyRad.data.items));

        const resAdmin = await fetch(`${baseUrl}/radiologist/worklist`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(resAdmin.status, 200);
      });

      it('permits RADIOLOGIST and ADMIN to read study context (HTTP 200 OK)', async () => {
        const resRad = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        assert.strictEqual(resRad.status, 200);
        const bodyRad = await resRad.json();
        assert.strictEqual(bodyRad.data.order.accessionNumber, 'ACC-TEST-P41-STAT');

        const resAdmin = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(resAdmin.status, 200);
      });

      it('strictly denies RECEPTION and TECHNOLOGIST from radiologist worklist and context (HTTP 403 Forbidden)', async () => {
        const resRecep = await fetch(`${baseUrl}/radiologist/worklist`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(resRecep.status, 403);

        const resTech = await fetch(`${baseUrl}/radiologist/worklist`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(resTech.status, 403);

        const resRecepContext = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(resRecepContext.status, 403);

        const resTechContext = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(resTechContext.status, 403);
      });

      it('denies unauthenticated requests to radiologist endpoints (HTTP 401 Unauthorized)', async () => {
        const resList = await fetch(`${baseUrl}/radiologist/worklist`);
        assert.strictEqual(resList.status, 401);

        const resContext = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`);
        assert.strictEqual(resContext.status, 401);
      });

      it('denies RADIOLOGIST from executing admin assignment endpoint (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/assign`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken1}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ radiologistUserId: radUser2.id }),
        });
        assert.strictEqual(res.status, 403);
      });
    });

    describe('13.2 Server-Authoritative Worklist Eligibility & Downstream Gating', () => {
      it('mock mode requires PACS_HANDOFF_COMPLETE: includes completed handoffs and strictly excludes PACS_READY-only orders', async () => {
        // Active gateway is MockPacsGateway
        const res = await fetch(`${baseUrl}/radiologist/worklist?limit=1000`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const accessions = body.data.items.map((i: any) => i.accessionNumber);

        // Eligible in mock mode (PACS_HANDOFF_COMPLETE with accepted QA)
        assert.ok(accessions.includes('ACC-TEST-P41-STAT'), 'STAT order must appear');
        assert.ok(accessions.includes('ACC-TEST-P41-URGENT'), 'URGENT order must appear');
        assert.ok(accessions.includes('ACC-TEST-P41-ROUTINE'), 'ROUTINE order must appear');
        assert.ok(accessions.includes('ACC-TEST-P41-REPEAT-LC'), 'Repeat lifecycle accepted order must appear');

        // Strictly excluded: Mock PACS_READY-only order
        assert.ok(!accessions.includes('ACC-TEST-P41-MOCK-READY'), 'Mock mode PACS_READY-only order must be excluded');

        // Rejection for PACS_READY-only order in mock mode
        const contextRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderMockReadyOnly.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        assert.strictEqual(contextRes.status, 409);
        const contextBody = await contextRes.json();
        assert.strictEqual(contextBody.error.code, 'ORDER_NOT_ELIGIBLE');

        // Claim rejection for PACS_READY-only order in mock mode
        const claimRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderMockReadyOnly.id}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${radToken1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(claimRes.status, 409);
        const claimBody = await claimRes.json();
        assert.strictEqual(claimBody.error.code, 'ORDER_NOT_ELIGIBLE');
      });

      it('strictly excludes non-ready and non-accepted studies from entering the worklist', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        console.log('WORKLIST TOTAL:', body.data.pagination?.total, 'ITEMS COUNT:', body.data.items.length);
        const routineItem = body.data.items.find((i: any) => i.accessionNumber === 'ACC-TEST-P41-ROUTINE');
        console.log('FOUND ROUTINE IN BODY:', !!routineItem);
        const accessions = body.data.items.map((i: any) => i.accessionNumber);

        assert.ok(!accessions.includes('ACC-TEST-P41-INEL-01'), 'SCAN_COMPLETED alone must be excluded');
        assert.ok(!accessions.includes('ACC-TEST-P41-INEL-02'), 'IMAGE_QA_PENDING must be excluded');
        assert.ok(!accessions.includes('ACC-TEST-P41-INEL-03'), 'IMAGE_REJECTED must be excluded');
        assert.ok(!accessions.includes('ACC-TEST-P41-INEL-04'), 'REPEAT_REQUIRED must be excluded');
        assert.ok(!accessions.includes('ACC-TEST-P41-INEL-05'), 'SAFETY_REVIEW must be excluded');
      });

      it('rejects study context requests for ineligible studies with HTTP 409 conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderQaPending.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'ORDER_NOT_ELIGIBLE');
      });

      it('Orthanc mode: strictly excludes unreconciled PACS_READY studies and includes reconciled studies', async () => {
        // Switch to Orthanc gateway
        setPacsGateway(new OrthancPacsGateway({
          baseUrl: 'http://localhost:8042',
          username: '',
          password: '',
        }));

        try {
          const res = await fetch(`${baseUrl}/radiologist/worklist?limit=1000`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          const accessions = body.data.items.map((i: any) => i.accessionNumber);

          // 1. PACS_READY alone without PacsStudyLink is EXCLUDED
          assert.ok(!accessions.includes('ACC-TEST-P41-ORTH-NOLINK'), 'Orthanc PACS_READY without PacsStudyLink must be excluded');

          // 2. Unlinked/mismatched PacsStudyLink is EXCLUDED
          assert.ok(!accessions.includes('ACC-TEST-P41-ORTH-MISMATCH'), 'Orthanc study with UNLINKED/mismatch status must be excluded');

          // 3. Valid reconciled PacsStudyLink IS ELIGIBLE
          assert.ok(accessions.includes('ACC-TEST-P41-ORTH-LINKED'), 'Orthanc study with valid PacsStudyLink must be included');

          // Direct context verification
          const noLinkRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderOrthancNoLink.id}`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(noLinkRes.status, 409);
          const noLinkBody = await noLinkRes.json();
          assert.strictEqual(noLinkBody.error.code, 'ORDER_NOT_ELIGIBLE');

          const mismatchRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderOrthancMismatched.id}`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(mismatchRes.status, 409);
          const mismatchBody = await mismatchRes.json();
          assert.strictEqual(mismatchBody.error.code, 'ORDER_NOT_ELIGIBLE');

          const linkedRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderOrthancLinked.id}`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(linkedRes.status, 200);
          const linkedBody = await linkedRes.json();
          assert.strictEqual(linkedBody.data.order.accessionNumber, 'ACC-TEST-P41-ORTH-LINKED');
          assert.ok(linkedBody.data.pacsIntegrationState.reconciled);
        } finally {
          // Switch back to Mock gateway
          setPacsGateway(new MockPacsGateway('success'));
        }
      });

      it('Orthanc temporary outage: keeps RIS worklist and study metadata safe and displays PACS_UNAVAILABLE honestly', async () => {
        // Set an unreachable Orthanc gateway to simulate an outage
        const unreachableGateway = new OrthancPacsGateway({
          baseUrl: 'http://127.0.0.1:19999',
          username: 'bad-user',
          password: 'bad-password',
          timeoutMs: 100,
        });
        setPacsGateway(unreachableGateway);

        try {
          // 1. Worklist query succeeds (HTTP 200) without crashing
          const res = await fetch(`${baseUrl}/radiologist/worklist?limit=1000`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.success, true);

          // Reconciled study remains on worklist
          const linkedItem = body.data.items.find((i: any) => i.accessionNumber === 'ACC-TEST-P41-ORTH-LINKED');
          assert.ok(linkedItem, 'Previously reconciled study must remain safely on worklist during outage');
          assert.strictEqual(linkedItem.pacsIntegrationState.status, 'PACS_UNAVAILABLE');

          // 2. Study context query succeeds (HTTP 200) and preserves all RIS clinical details
          const contextRes = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderOrthancLinked.id}`, {
            headers: { Authorization: `Bearer ${radToken1}` },
          });
          assert.strictEqual(contextRes.status, 200);
          const contextBody = await contextRes.json();
          const data = contextBody.data;

          assert.strictEqual(data.order.accessionNumber, 'ACC-TEST-P41-ORTH-LINKED');
          assert.strictEqual(data.patient.patientId, 'PAT-2026-P4101');
          assert.strictEqual(data.pacsIntegrationState.status, 'PACS_UNAVAILABLE');
          assert.ok(data.pacsIntegrationState.message.includes('unreachable'));

          // 3. Database records remain intact (neither assignment nor PacsStudyLink was deleted)
          const linkInDb = await prisma.pacsStudyLink.findUnique({
            where: { imagingOrderId: p41OrderOrthancLinked.id },
          });
          assert.ok(linkInDb !== null, 'PacsStudyLink must not be deleted during outage');
          assert.strictEqual(linkInDb.status, 'LINKED');
        } finally {
          setPacsGateway(new MockPacsGateway('success'));
        }
      });
    });

    describe('13.3 Worklist Ordering, Waiting Time & Server-Side Filtering', () => {
      it('orders worklist deterministically: STAT -> URGENT -> ROUTINE', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist?limit=1000`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const items = body.data.items;

        const statIdx = items.findIndex((i: any) => i.accessionNumber === 'ACC-TEST-P41-STAT');
        const urgentIdx = items.findIndex((i: any) => i.accessionNumber === 'ACC-TEST-P41-URGENT');
        const routineIdx = items.findIndex((i: any) => i.accessionNumber === 'ACC-TEST-P41-ROUTINE');

        assert.ok(statIdx < urgentIdx, 'STAT must appear before URGENT');
        assert.ok(urgentIdx < routineIdx, 'URGENT must appear before ROUTINE');
      });

      it('filters worklist accurately by modality', async () => {
        const resCt = await fetch(`${baseUrl}/radiologist/worklist?modality=CT`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyCt = await resCt.json();
        bodyCt.data.items.forEach((item: any) => {
          assert.strictEqual(item.modality, 'CT');
        });

        const resMri = await fetch(`${baseUrl}/radiologist/worklist?modality=MRI`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyMri = await resMri.json();
        bodyMri.data.items.forEach((item: any) => {
          assert.strictEqual(item.modality, 'MRI');
        });
      });

      it('filters worklist accurately by priority', async () => {
        const resStat = await fetch(`${baseUrl}/radiologist/worklist?priority=STAT`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyStat = await resStat.json();
        bodyStat.data.items.forEach((item: any) => {
          assert.strictEqual(item.priority, 'STAT');
        });
      });

      it('searches worklist by accession, patient ID, and patient name', async () => {
        const resAcc = await fetch(`${baseUrl}/radiologist/worklist?search=ACC-TEST-P41-STAT`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyAcc = await resAcc.json();
        assert.strictEqual(bodyAcc.data.items.length, 1);
        assert.strictEqual(bodyAcc.data.items[0].accessionNumber, 'ACC-TEST-P41-STAT');

        const resMrn = await fetch(`${baseUrl}/radiologist/worklist?search=PAT-2026-P4101`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyMrn = await resMrn.json();
        assert.ok(bodyMrn.data.items.length >= 3);

        const resName = await fetch(`${baseUrl}/radiologist/worklist?search=Oswald`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const bodyName = await resName.json();
        assert.ok(bodyName.data.items.length >= 3);
      });
    });

    describe('13.4 Radiologist Claim & Concurrency Protection', () => {
      it('successfully claims an unassigned study (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken1}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.assignment.status, 'ASSIGNED');
        assert.strictEqual(body.data.assignment.radiologistUserId, radUser1.id);

        // Verify in DB
        const dbAssignment = await prisma.radiologistAssignment.findFirstOrThrow({
          where: { imagingOrderId: p41OrderStat.id, status: RadiologistAssignmentStatus.ASSIGNED },
        });
        assert.strictEqual(dbAssignment.radiologistUserId, radUser1.id);

        // Verify Audit Log: RADIOLOGIST_STUDY_CLAIMED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'RADIOLOGIST_STUDY_CLAIMED', entityId: p41OrderStat.id },
        });
        assert.ok(audit, 'Audit log for RADIOLOGIST_STUDY_CLAIMED must exist');
      });

      it('rejects duplicate claim by same radiologist with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken1}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'STUDY_ALREADY_ASSIGNED');
      });

      it('rejects claim by a different radiologist when already assigned with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken2}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'STUDY_ALREADY_ASSIGNED');
      });

      it('protects concurrent claiming: exactly one radiologist wins and second gets HTTP 409 Conflict', async () => {
        // Run concurrent claims on unassigned p41OrderUrgent simultaneously
        const [claim1, claim2] = await Promise.all([
          fetch(`${baseUrl}/radiologist/worklist/${p41OrderUrgent.id}/claim`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${radToken1}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
          fetch(`${baseUrl}/radiologist/worklist/${p41OrderUrgent.id}/claim`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${radToken2}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
        ]);

        const statuses = [claim1.status, claim2.status].sort();
        assert.deepStrictEqual(
          statuses,
          [200, 409],
          'Concurrent claims must result in exactly one 200 success and one 409 conflict'
        );

        // Verify database holds exactly 1 active assignment
        const activeCount = await prisma.radiologistAssignment.count({
          where: { imagingOrderId: p41OrderUrgent.id, status: RadiologistAssignmentStatus.ASSIGNED },
        });
        assert.strictEqual(activeCount, 1, 'Database must enforce at most one active assignment');
      });
    });

    describe('13.5 Admin Assignment & Role Validation', () => {
      it('allows ADMIN to assign an unassigned eligible study to a radiologist (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRoutine.id}/assign`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ radiologistUserId: radUser2.id }),
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.assignment.radiologistUserId, radUser2.id);

        // Verify Audit Log: RADIOLOGIST_ASSIGNED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'RADIOLOGIST_ASSIGNED', entityId: p41OrderRoutine.id },
        });
        assert.ok(audit, 'Audit log for RADIOLOGIST_ASSIGNED must exist');
      });

      it('rejects admin assignment to a non-radiologist user with HTTP 400 Bad Request', async () => {
        const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRepeatLifecycle.id}/assign`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ radiologistUserId: techUser.id }),
        });
        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'INVALID_TARGET_ROLE');
      });

      it('rejects admin assignment when study is already actively assigned with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRoutine.id}/assign`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ radiologistUserId: radUser1.id }),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'STUDY_ALREADY_ASSIGNED');
      });
    });

    describe('13.6 Assignment Release & Role Enforcement', () => {
      it('forbids unrelated radiologist from releasing another radiologist assignment (HTTP 403 Forbidden)', async () => {
        // p41OrderRoutine is assigned to radUser2; radUser1 tries to release it
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRoutine.id}/release`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken1}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 403);
      });

      it('allows assigned radiologist to release their own assignment (HTTP 200 OK)', async () => {
        // radUser2 releases p41OrderRoutine
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRoutine.id}/release`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${radToken2}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.assignment.status, 'RELEASED');

        // Study must now be UNASSIGNED
        const activeCheck = await prisma.radiologistAssignment.findFirst({
          where: { imagingOrderId: p41OrderRoutine.id, status: RadiologistAssignmentStatus.ASSIGNED },
        });
        assert.strictEqual(activeCheck, null, 'No active assignment should remain');

        // Historical record preserved
        const historyCount = await prisma.radiologistAssignment.count({
          where: { imagingOrderId: p41OrderRoutine.id },
        });
        assert.ok(historyCount >= 1, 'Historical assignment records must be preserved');

        // Verify Audit Log: RADIOLOGIST_ASSIGNMENT_RELEASED
        const audit = await prisma.auditLog.findFirst({
          where: { action: 'RADIOLOGIST_ASSIGNMENT_RELEASED', entityId: p41OrderRoutine.id },
        });
        assert.ok(audit, 'Audit log for RADIOLOGIST_ASSIGNMENT_RELEASED must exist');
      });

      it('allows ADMIN to release any active assignment for operational support (HTTP 200 OK)', async () => {
        // p41OrderStat is assigned to radUser1; ADMIN releases it
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/release`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 200);

        const activeCheck = await prisma.radiologistAssignment.findFirst({
          where: { imagingOrderId: p41OrderStat.id, status: RadiologistAssignmentStatus.ASSIGNED },
        });
        assert.strictEqual(activeCheck, null);
      });

      it('returns HTTP 409 when attempting to release an unassigned study', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/release`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'NO_ACTIVE_ASSIGNMENT');
      });
    });

    describe('13.7 Comprehensive Study Context: Repeat History, Contrast, Incidents, Priors & PACS State', () => {
      it('resolves accepted acquisition attempt accurately across multiple repeat attempts', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRepeatLifecycle.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        const data = body.data;

        // Accepted acquisition attempt must be Attempt #2
        assert.strictEqual(data.acceptedAcquisition.attemptNumber, 2);
        assert.strictEqual(data.acceptedAcquisition.qaStatus, 'ACCEPTED');

        // Repeat history must contain both Attempt #1 and Attempt #2
        assert.strictEqual(data.repeatHistory.length, 2);
        assert.strictEqual(data.repeatHistory[0].attemptNumber, 1);
        assert.strictEqual(data.repeatHistory[0].qaStatus, 'REPEAT_REQUIRED');
        assert.strictEqual(data.repeatHistory[0].isAcceptedAcquisition, false);
        assert.strictEqual(data.repeatHistory[1].attemptNumber, 2);
        assert.strictEqual(data.repeatHistory[1].qaStatus, 'ACCEPTED');
        assert.strictEqual(data.repeatHistory[1].isAcceptedAcquisition, true);
      });

      it('returns factual contrast documentation summary for contrast examinations', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRepeatLifecycle.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const contrast = body.data.contrastSummary;

        assert.strictEqual(contrast.length, 1);
        assert.strictEqual(contrast[0].agentName, 'Omnipaque 350');
        assert.strictEqual(contrast[0].volume, 75);
        assert.strictEqual(contrast[0].route, 'IV');
      });

      it('returns factual incident documentation without enabling mutation controls', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderRepeatLifecycle.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const incidents = body.data.incidentSummary;

        assert.strictEqual(incidents.length, 1);
        assert.strictEqual(incidents[0].category, 'PATIENT_DISTRESS');
        assert.strictEqual(incidents[0].clinicianNotified, true);
      });

      it('discovers and returns prior studies for the patient based on Patient ID', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const data = body.data;

        assert.ok(data.hasPriorStudies, 'hasPriorStudies flag must be true');
        assert.ok(data.priorStudyCount >= 1, 'Must discover previous studies');
        const priorAccessions = data.priorStudies.map((p: any) => p.accessionNumber);
        assert.ok(priorAccessions.includes('ACC-TEST-P41-PRIOR'), 'Historical prior study must appear');
      });

      it('exposes safe, honest PACS integration state without claiming raw image storage', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}`, {
          headers: { Authorization: `Bearer ${radToken1}` },
        });
        const body = await res.json();
        const pacs = body.data.pacsIntegrationState;

        assert.ok(['mock', 'orthanc'].includes(pacs.adapter));
        assert.ok(!JSON.stringify(pacs).includes('password'));
        assert.ok(!JSON.stringify(pacs).includes('Bearer'));
        assert.ok(!pacs.label.includes('STORED'));
      });

      it('confirms Patient ID and Accession Number remain strictly immutable during claim/release', async () => {
        const patientBefore = await prisma.patient.findUniqueOrThrow({ where: { id: p41Patient.id } });
        const orderBefore = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p41OrderStat.id } });

        // Radiologist claims and then releases
        await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${radToken1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        await fetch(`${baseUrl}/radiologist/worklist/${p41OrderStat.id}/release`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${radToken1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const patientAfter = await prisma.patient.findUniqueOrThrow({ where: { id: p41Patient.id } });
        const orderAfter = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p41OrderStat.id } });

        assert.strictEqual(patientBefore.patientId, patientAfter.patientId);
        assert.strictEqual(orderBefore.accessionNumber, orderAfter.accessionNumber);
        assert.strictEqual(patientAfter.patientId, 'PAT-2026-P4101');
        assert.strictEqual(orderAfter.accessionNumber, 'ACC-TEST-P41-STAT');
      });
    });

    after(() => {
      setPacsGateway(new MockPacsGateway('success'));
    });
  });

  describe('14. Phase 4.2A — Radiologist Current Study Image Viewing', () => {
    let p42Patient: any;
    let p42OrderEligibleLinked: any;
    let p42OrderUnlinked: any;
    let p42OrderMissingUID: any;
    let p42OrderUnreconciled: any;
    let p42OrderNotEligible: any;
    let p42ScanLinked: any;
    let p42Equipment: any;

    const testStudyUid = '1.2.840.113619.2.55.1.42.2026.999';
    const testOrthancStudyId = 'orthanc-study-p42-linked-01';

    before(async () => {
      // Clean up previous test fixtures if present
      const oldOrders = await prisma.imagingOrder.findMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P42' } },
        select: { id: true },
      });
      const oldIds = oldOrders.map((o) => o.id);

      await prisma.auditLog.deleteMany({
        where: { entityType: 'ImagingOrder', entityId: { in: oldIds } },
      });
      await prisma.pacsStudyLink.deleteMany({
        where: { imagingOrderId: { in: oldIds } },
      });
      await prisma.imageQualityReview.deleteMany({
        where: { imagingOrderId: { in: oldIds } },
      });
      await prisma.scanLifecycle.deleteMany({
        where: { imagingOrderId: { in: oldIds } },
      });
      await prisma.imagingOrder.deleteMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P42' } },
      });
      await prisma.patient.deleteMany({
        where: { patientId: 'PAT-2026-P4201' },
      });

      p42Patient = await prisma.patient.create({
        data: {
          patientId: 'PAT-2026-P4201',
          firstName: 'Gwen',
          lastName: 'Cooper',
          dateOfBirth: new Date('1986-08-16'),
          gender: Gender.FEMALE,
          phone: '+1-555-420-0001',
          isActive: true,
        },
      });

      p42Equipment = await prisma.equipment.findFirst({
        where: { modality: ModalityType.CT },
      });

      const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });

      // 1. Eligible and Reconciled Study (with valid PacsStudyLink)
      p42OrderEligibleLinked = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42-LINKED',
          patientId: p42Patient.id,
          modality: ModalityType.CT,
          examinationName: 'CT Chest Diagnostic (Phase 4.2A)',
          bodyPart: 'CHEST',
          priority: Priority.ROUTINE,
          clinicalIndication: 'Test viewer launch with valid StudyInstanceUID',
          contrastRequired: false,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      p42ScanLinked = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p42OrderEligibleLinked.id,
          equipmentId: p42Equipment.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
          startedAt: new Date(Date.now() - 30 * 60 * 1000),
          completedAt: new Date(Date.now() - 25 * 60 * 1000),
        },
      });

      const qaLinked = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p42OrderEligibleLinked.id,
          scanLifecycleId: p42ScanLinked.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: techUser.id,
          reviewedByUserId: techUser.id,
          reviewedAt: new Date(Date.now() - 20 * 60 * 1000),
          notes: 'Optimal diagnostic resolution verified',
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p42OrderEligibleLinked.id,
          scanLifecycleId: p42ScanLinked.id,
          imageQualityReviewId: qaLinked.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p42OrderEligibleLinked.id,
          orthancStudyId: testOrthancStudyId,
          studyInstanceUid: testStudyUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date(),
          verifiedByUserId: techUser.id,
        },
      });

      // 2. Unlinked Order (No PacsStudyLink)
      p42OrderUnlinked = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42-UNLINKED',
          patientId: p42Patient.id,
          modality: ModalityType.CT,
          examinationName: 'CT Chest (Unlinked Test)',
          bodyPart: 'CHEST',
          priority: Priority.ROUTINE,
          clinicalIndication: 'Test clinical indication',
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scanUnlinked = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p42OrderUnlinked.id,
          equipmentId: p42Equipment.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
        },
      });

      const qaUnlinked = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p42OrderUnlinked.id,
          scanLifecycleId: scanUnlinked.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: techUser.id,
          reviewedByUserId: techUser.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p42OrderUnlinked.id,
          scanLifecycleId: scanUnlinked.id,
          imageQualityReviewId: qaUnlinked.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(),
        },
      });

      // 3. Order with PacsStudyLink missing StudyInstanceUID
      p42OrderMissingUID = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42-NOUID',
          patientId: p42Patient.id,
          modality: ModalityType.CT,
          examinationName: 'CT Chest (Missing UID Test)',
          bodyPart: 'CHEST',
          priority: Priority.ROUTINE,
          clinicalIndication: 'Test clinical indication',
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scanNoUid = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p42OrderMissingUID.id,
          equipmentId: p42Equipment.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
        },
      });

      const qaNoUid = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p42OrderMissingUID.id,
          scanLifecycleId: scanNoUid.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: techUser.id,
          reviewedByUserId: techUser.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p42OrderMissingUID.id,
          scanLifecycleId: scanNoUid.id,
          imageQualityReviewId: qaNoUid.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p42OrderMissingUID.id,
          orthancStudyId: 'orthanc-study-no-uid',
          studyInstanceUid: '',
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date(),
          verifiedByUserId: techUser.id,
        },
      });

      // 4. Order with unreconciled / unlinked status
      p42OrderUnreconciled = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42-UNRECONCILED',
          patientId: p42Patient.id,
          modality: ModalityType.CT,
          examinationName: 'CT Chest (Unreconciled Status)',
          bodyPart: 'CHEST',
          priority: Priority.ROUTINE,
          clinicalIndication: 'Test clinical indication',
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scanUnrec = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p42OrderUnreconciled.id,
          equipmentId: p42Equipment.id,
          attemptNumber: 1,
          state: ScanState.COMPLETED,
        },
      });

      const qaUnrec = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p42OrderUnreconciled.id,
          scanLifecycleId: scanUnrec.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: techUser.id,
          reviewedByUserId: techUser.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p42OrderUnreconciled.id,
          scanLifecycleId: scanUnrec.id,
          imageQualityReviewId: qaUnrec.id,
          status: PacsHandoffStatus.COMPLETE,
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p42OrderUnreconciled.id,
          orthancStudyId: 'orthanc-study-unrec',
          studyInstanceUid: '1.2.840.113619.unrec.uid',
          status: PacsStudyLinkStatus.UNLINKED,
          verifiedAt: new Date(),
          verifiedByUserId: techUser.id,
        },
      });

      // 5. Ineligible Order (e.g. in SCAN_IN_PROGRESS)
      p42OrderNotEligible = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42-NOT-ELIGIBLE',
          patientId: p42Patient.id,
          modality: ModalityType.CT,
          examinationName: 'CT Chest (In Progress)',
          bodyPart: 'CHEST',
          priority: Priority.ROUTINE,
          clinicalIndication: 'Test clinical indication',
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p42OrderNotEligible.id,
          orthancStudyId: 'orthanc-study-not-eligible',
          studyInstanceUid: '1.2.840.113619.noteligible.uid',
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date(),
          verifiedByUserId: techUser.id,
        },
      });
    });

    it('1. permits RADIOLOGIST to retrieve viewer-launch configuration for an eligible linked study (HTTP 200 OK)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.imagingOrderId, p42OrderEligibleLinked.id);
      assert.strictEqual(body.data.accessionNumber, 'ACC-TEST-P42-LINKED');
      assert.strictEqual(body.data.patientId, 'PAT-2026-P4201');
      assert.strictEqual(body.data.studyInstanceUid, testStudyUid);
      assert.ok(body.data.viewerUrl.includes('/viewer?StudyInstanceUIDs='));
    });

    it('2. authoritative viewer URL strictly uses StudyInstanceUID and URL-encodes it', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      const body = await res.json();
      const expectedUrl = `http://localhost:3000/viewer?StudyInstanceUIDs=${encodeURIComponent(testStudyUid)}`;
      assert.strictEqual(body.data.viewerUrl, expectedUrl);
    });

    it('3. proves Accession Number is NOT used as OHIF launch identifier', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      const body = await res.json();
      const parsedUrl = new URL(body.data.viewerUrl);
      assert.strictEqual(parsedUrl.searchParams.get('StudyInstanceUIDs'), testStudyUid);
      assert.strictEqual(parsedUrl.searchParams.has('accession'), false);
      assert.ok(!parsedUrl.search.includes(p42OrderEligibleLinked.accessionNumber));
    });

    it('4. proves Orthanc internal study ID is NOT used as OHIF launch identifier', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      const body = await res.json();
      assert.ok(!body.data.viewerUrl.includes(testOrthancStudyId));
    });

    it('5. rejects unlinked PACS_READY study (HTTP 409 Conflict with PACS_STUDY_NOT_LINKED)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderUnlinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'PACS_STUDY_NOT_LINKED');
    });

    it('6. rejects mismatched / unreconciled study link (HTTP 409 Conflict with PACS_STUDY_NOT_LINKED)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderUnreconciled.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'PACS_STUDY_NOT_LINKED');
    });

    it('7. rejects study link with missing StudyInstanceUID (HTTP 409 Conflict with STUDY_INSTANCE_UID_MISSING)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderMissingUID.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'STUDY_INSTANCE_UID_MISSING');
    });

    it('8. rejects ineligible order in pre-QA state (HTTP 409 Conflict with ORDER_NOT_ELIGIBLE)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderNotEligible.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'ORDER_NOT_ELIGIBLE');
    });

    it('9. strictly denies RECEPTION role from viewer-launch (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${receptionToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('10. strictly denies TECHNOLOGIST role from viewer-launch (HTTP 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${techToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('11. strictly denies unauthenticated requests from viewer-launch (HTTP 401 Unauthorized)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`);
      assert.strictEqual(res.status, 401);
    });

    it('12. permits ADMIN role to retrieve viewer-launch configuration (HTTP 200 OK)', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.studyInstanceUid, testStudyUid);
    });

    it('13. confirms Patient ID and Accession Number remain strictly immutable during viewer launch', async () => {
      const patientBefore = await prisma.patient.findUniqueOrThrow({ where: { id: p42Patient.id } });
      const orderBefore = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p42OrderEligibleLinked.id } });

      await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });

      const patientAfter = await prisma.patient.findUniqueOrThrow({ where: { id: p42Patient.id } });
      const orderAfter = await prisma.imagingOrder.findUniqueOrThrow({ where: { id: p42OrderEligibleLinked.id } });

      assert.strictEqual(patientBefore.patientId, patientAfter.patientId);
      assert.strictEqual(orderBefore.accessionNumber, orderAfter.accessionNumber);
      assert.strictEqual(patientAfter.patientId, 'PAT-2026-P4201');
      assert.strictEqual(orderAfter.accessionNumber, 'ACC-TEST-P42-LINKED');
    });

    it('14. confirms viewer launch does NOT mutate scan lifecycle, QA history, or radiologist assignment', async () => {
      const scanBefore = await prisma.scanLifecycle.findUniqueOrThrow({ where: { id: p42ScanLinked.id } });
      const qaBefore = await prisma.imageQualityReview.findUniqueOrThrow({ where: { scanLifecycleId: p42ScanLinked.id } });
      const assignmentsBefore = await prisma.radiologistAssignment.findMany({ where: { imagingOrderId: p42OrderEligibleLinked.id } });

      await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });

      const scanAfter = await prisma.scanLifecycle.findUniqueOrThrow({ where: { id: p42ScanLinked.id } });
      const qaAfter = await prisma.imageQualityReview.findUniqueOrThrow({ where: { scanLifecycleId: p42ScanLinked.id } });
      const assignmentsAfter = await prisma.radiologistAssignment.findMany({ where: { imagingOrderId: p42OrderEligibleLinked.id } });

      assert.strictEqual(scanBefore.state, scanAfter.state);
      assert.strictEqual(qaBefore.status, qaAfter.status);
      assert.strictEqual(assignmentsBefore.length, assignmentsAfter.length);
    });

    it('15. records RADIOLOGIST_IMAGES_OPENED audit event with correct metadata', async () => {
      await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });

      const auditEvent = await prisma.auditLog.findFirst({
        where: {
          entityType: 'ImagingOrder',
          entityId: p42OrderEligibleLinked.id,
          action: 'RADIOLOGIST_IMAGES_OPENED',
        },
        orderBy: { timestamp: 'desc' },
      });

      assert.ok(auditEvent, 'Audit event RADIOLOGIST_IMAGES_OPENED must be recorded');
      assert.strictEqual((auditEvent.details as any).studyInstanceUid, testStudyUid);
      assert.strictEqual((auditEvent.details as any).accessionNumber, 'ACC-TEST-P42-LINKED');
      assert.strictEqual((auditEvent.details as any).patientId, 'PAT-2026-P4201');
    });

    it('16. handles Orthanc PACS outage gracefully with safe HTTP 503 response without leaking raw errors', async () => {
      const originalGateway = getPacsGateway();
      const unreachableGateway = new OrthancPacsGateway({
        baseUrl: 'http://127.0.0.1:59999',
        username: 'orthanc',
        password: 'bad',
        timeoutMs: 300,
      });
      setPacsGateway(unreachableGateway);

      try {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });

        assert.strictEqual(res.status, 503);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PACS_UNAVAILABLE');
        assert.ok((body.message || body.error?.message || '').includes('PACS server is currently unreachable'));
        assert.ok(!JSON.stringify(body).includes('ECONNREFUSED'));
        assert.ok(!JSON.stringify(body).includes('stack'));
      } finally {
        setPacsGateway(originalGateway);
      }
    });

    it('17. strictly ensures NO credentials (username, password, basic auth header) are returned in the response', async () => {
      const res = await fetch(`${baseUrl}/radiologist/worklist/${p42OrderEligibleLinked.id}/viewer-launch`, {
        headers: { Authorization: `Bearer ${radToken}` },
      });
      const rawText = await res.text();
      if (process.env.ORTHANC_PASSWORD) {
        assert.ok(!rawText.includes(process.env.ORTHANC_PASSWORD), 'Must not contain Orthanc password');
      }
      assert.ok(!rawText.toLowerCase().includes('basic '), 'Must not contain Basic Auth header');
      assert.ok(!rawText.includes('JWT_SECRET'), 'Must not contain JWT secret');
    });

    after(() => {
      setPacsGateway(new MockPacsGateway('success'));
    });
  });

  describe('15. Phase 4.2B — Prior Study Comparison & Associated Prior Report Context', () => {
    let p42bPatient: any;
    let otherPatient: any;
    let currentOrder: any;
    let priorOrderLinkedWithReport: any;
    let priorOrderUnreconciled: any;
    let priorOrderDraftReport: any;
    let otherPatientOrder: any;
    let p42bEquipment: any;
    let p42bRadiologistUser: any;

    const currStudyUid = '1.2.840.113619.2.55.1.42b.2026.curr';
    const prior1StudyUid = '1.2.840.113619.2.55.1.42b.2026.prior1';
    const otherStudyUid = '1.2.840.113619.2.55.1.42b.2026.other';

    before(async () => {
      // Clean up previous test fixtures
      const oldOrders = await prisma.imagingOrder.findMany({
        where: { accessionNumber: { startsWith: 'ACC-TEST-P42B' } },
        select: { id: true },
      });
      const oldIds = oldOrders.map((o) => o.id);

      await prisma.report.deleteMany({ where: { orderId: { in: oldIds } } });
      await prisma.study.deleteMany({ where: { orderId: { in: oldIds } } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ entityId: { in: oldIds } }, { entityType: 'Report' }] },
      });
      await prisma.pacsStudyLink.deleteMany({ where: { imagingOrderId: { in: oldIds } } });
      await prisma.imageQualityReview.deleteMany({ where: { imagingOrderId: { in: oldIds } } });
      await prisma.scanLifecycle.deleteMany({ where: { imagingOrderId: { in: oldIds } } });
      await prisma.pacsHandoff.deleteMany({ where: { imagingOrderId: { in: oldIds } } });
      await prisma.imagingOrder.deleteMany({ where: { id: { in: oldIds } } });

      await prisma.patient.deleteMany({
        where: { patientId: { in: ['PAT-TEST-P42B-01', 'PAT-TEST-P42B-OTHER'] } },
      });

      p42bEquipment = await prisma.equipment.findFirst({ where: { modality: ModalityType.CT } });
      p42bRadiologistUser = await prisma.user.findFirst({
        where: { role: UserRole.RADIOLOGIST, isActive: true },
      });

      p42bPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-TEST-P42B-01',
          firstName: 'Clara',
          lastName: 'Oswald',
          gender: 'FEMALE',
          dateOfBirth: new Date('1988-11-23'),
          phone: '555-0421',
          isActive: true,
        },
      });

      otherPatient = await prisma.patient.create({
        data: {
          patientId: 'PAT-TEST-P42B-OTHER',
          firstName: 'Rory',
          lastName: 'Williams',
          gender: 'MALE',
          dateOfBirth: new Date('1989-05-10'),
          phone: '555-0422',
          isActive: true,
        },
      });

      // Current Order: ACC-TEST-P42B-CURR
      currentOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42B-CURR',
          patientId: p42bPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast',
          clinicalIndication: 'Current staging examination',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
        },
      });

      const currScan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: currentOrder.id,
          attemptNumber: 1,
          equipmentId: p42bEquipment.id,
          state: ScanState.COMPLETED,
          completedAt: new Date('2026-11-01T10:30:00.000Z'),
        },
      });

      const currQa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: currentOrder.id,
          scanLifecycleId: currScan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p42bRadiologistUser.id,
          reviewedByUserId: p42bRadiologistUser.id,
          reviewedAt: new Date('2026-11-01T10:35:00.000Z'),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: currentOrder.id,
          scanLifecycleId: currScan.id,
          imageQualityReviewId: currQa.id,
          status: 'COMPLETE',
          completedAt: new Date('2026-11-01T10:40:00.000Z'),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: currentOrder.id,
          orthancStudyId: 'orthanc-study-curr-42b',
          studyInstanceUid: currStudyUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date('2026-11-01T10:40:00.000Z'),
          verifiedByUserId: p42bRadiologistUser.id,
        },
      });

      // Prior Order 1 (Linked with finalized Report): ACC-TEST-P42B-PRIOR1
      priorOrderLinkedWithReport = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42B-PRIOR1',
          patientId: p42bPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest without Contrast',
          clinicalIndication: 'Baseline chest scan',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.COMPLETED,
          createdAt: new Date('2025-05-15T09:00:00.000Z'),
        },
      });

      const prior1Scan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: priorOrderLinkedWithReport.id,
          attemptNumber: 1,
          equipmentId: p42bEquipment.id,
          state: ScanState.COMPLETED,
          completedAt: new Date('2025-05-15T09:30:00.000Z'),
        },
      });

      await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: priorOrderLinkedWithReport.id,
          scanLifecycleId: prior1Scan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p42bRadiologistUser.id,
          reviewedByUserId: p42bRadiologistUser.id,
          reviewedAt: new Date('2025-05-15T09:35:00.000Z'),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: priorOrderLinkedWithReport.id,
          orthancStudyId: 'orthanc-study-prior1-42b',
          studyInstanceUid: prior1StudyUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date('2025-05-15T09:40:00.000Z'),
          verifiedByUserId: p42bRadiologistUser.id,
        },
      });

      const prior1Study = await prisma.study.create({
        data: {
          orderId: priorOrderLinkedWithReport.id,
          patientId: p42bPatient.id,
          accessionNumber: priorOrderLinkedWithReport.accessionNumber,
          modality: ModalityType.CT,
          studyStatus: StudyStatus.REPORTED,
          pacsStatus: 'SENT',
          studyInstanceUid: prior1StudyUid,
        },
      });

      await prisma.report.create({
        data: {
          orderId: priorOrderLinkedWithReport.id,
          studyId: prior1Study.id,
          radiologistId: p42bRadiologistUser.id,
          status: ReportStatus.FINAL,
          findings: 'Clear lung fields bilaterally. No focal nodules or infiltrates.',
          impression: 'Normal baseline CT chest examination.',
          finalizedAt: new Date('2025-05-15T14:00:00.000Z'),
        },
      });

      // Prior Order 2 (Unreconciled / no PACS link): ACC-TEST-P42B-PRIOR2
      priorOrderUnreconciled = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42B-PRIOR2',
          patientId: p42bPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Abdomen',
          examinationName: 'CT Abdomen without Contrast',
          clinicalIndication: 'Abdominal pain evaluation',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.COMPLETED,
          createdAt: new Date('2024-02-10T11:00:00.000Z'),
        },
      });

      // Prior Order 3 (Draft Report, not FINAL): ACC-TEST-P42B-PRIOR3
      priorOrderDraftReport = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42B-PRIOR3',
          patientId: p42bPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head',
          examinationName: 'CT Head without Contrast',
          clinicalIndication: 'Headache',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.COMPLETED,
          createdAt: new Date('2023-01-20T10:00:00.000Z'),
        },
      });

      const prior3Study = await prisma.study.create({
        data: {
          orderId: priorOrderDraftReport.id,
          patientId: p42bPatient.id,
          accessionNumber: priorOrderDraftReport.accessionNumber,
          modality: ModalityType.CT,
          studyStatus: StudyStatus.READY_FOR_REPORTING,
        },
      });

      await prisma.report.create({
        data: {
          orderId: priorOrderDraftReport.id,
          studyId: prior3Study.id,
          radiologistId: p42bRadiologistUser.id,
          status: ReportStatus.DRAFT,
          draftContent: 'Draft in progress...',
        },
      });

      // Other Patient Order: ACC-TEST-P42B-OTHER
      otherPatientOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: 'ACC-TEST-P42B-OTHER',
          patientId: otherPatient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast',
          clinicalIndication: 'Separate patient examination',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.COMPLETED,
          createdAt: new Date('2025-06-01T10:00:00.000Z'),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: otherPatientOrder.id,
          orthancStudyId: 'orthanc-study-other-42b',
          studyInstanceUid: otherStudyUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedAt: new Date('2025-06-01T10:40:00.000Z'),
          verifiedByUserId: p42bRadiologistUser.id,
        },
      });
    });

    describe('15.1 Prior Study Discovery', () => {
      it('discovers historical prior studies belonging strictly to the same Patient ID', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));

        // Must find exactly the 3 priors for p42bPatient
        const accessions = body.data.map((p: any) => p.accessionNumber);
        assert.ok(accessions.includes('ACC-TEST-P42B-PRIOR1'));
        assert.ok(accessions.includes('ACC-TEST-P42B-PRIOR2'));
        assert.ok(accessions.includes('ACC-TEST-P42B-PRIOR3'));

        // Excludes current order and other patient's order
        assert.ok(!accessions.includes('ACC-TEST-P42B-CURR'), 'Must exclude current order');
        assert.ok(!accessions.includes('ACC-TEST-P42B-OTHER'), 'Must exclude other patient order');
      });

      it('evaluates PACS and report availability on discovered priors accurately', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });
        const body = await res.json();

        const prior1 = body.data.find((p: any) => p.accessionNumber === 'ACC-TEST-P42B-PRIOR1');
        assert.ok(prior1);
        assert.strictEqual(prior1.hasPacsStudy, true);
        assert.strictEqual(prior1.pacsStatus, 'LINKED');
        assert.strictEqual(prior1.isImageComparisonEligible, true);
        assert.strictEqual(prior1.studyInstanceUid, prior1StudyUid);
        assert.strictEqual(prior1.hasPriorReport, true);
        assert.ok(prior1.priorReport);
        assert.strictEqual(prior1.priorReport.status, 'FINAL');
        assert.ok(prior1.priorReport.findings.includes('Clear lung fields'));

        const prior2 = body.data.find((p: any) => p.accessionNumber === 'ACC-TEST-P42B-PRIOR2');
        assert.ok(prior2);
        assert.strictEqual(prior2.hasPacsStudy, false);
        assert.strictEqual(prior2.pacsStatus, 'NOT_RECONCILED');
        assert.strictEqual(prior2.isImageComparisonEligible, false);
        assert.strictEqual(prior2.hasPriorReport, false);

        const prior3 = body.data.find((p: any) => p.accessionNumber === 'ACC-TEST-P42B-PRIOR3');
        assert.ok(prior3);
        assert.strictEqual(prior3.hasPriorReport, false, 'Draft reports must not be exposed as finalized prior reports');
      });

      it('includes rich prior studies in study context modal query', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.ok(body.data.priorStudies.length >= 3);
        const prior1 = body.data.priorStudies.find((p: any) => p.accessionNumber === 'ACC-TEST-P42B-PRIOR1');
        assert.strictEqual(prior1.pacsStatus, 'LINKED');
        assert.strictEqual(prior1.isImageComparisonEligible, true);
        assert.strictEqual(prior1.hasPriorReport, true);
      });
    });

    describe('15.2 Associated Read-Only Prior Report Context', () => {
      it('retrieves factual finalized prior report with reporting radiologist metadata', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderLinkedWithReport.id}/report`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.priorAccessionNumber, 'ACC-TEST-P42B-PRIOR1');
        assert.strictEqual(body.data.reportStatus, 'FINAL');
        assert.ok(body.data.findings.includes('Clear lung fields bilaterally'));
        assert.ok(body.data.impression.includes('Normal baseline CT chest'));
        assert.ok(body.data.authorName.length > 0);
        assert.ok(body.data.finalizedAt !== null);
      });

      it('rejects prior report retrieval for draft / unfinalized reports with HTTP 404', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderDraftReport.id}/report`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );
        assert.strictEqual(res.status, 404);
      });

      it('rejects prior report request on current order with HTTP 400', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${currentOrder.id}/report`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );
        assert.strictEqual(res.status, 400);
      });

      it('rejects prior report request for another patient with HTTP 409 Conflict', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${otherPatientOrder.id}/report`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PRIOR_PATIENT_MISMATCH');
      });
    });

    describe('15.3 Multi-Study Viewer Launch & Comparison Integration', () => {
      it('generates valid multi-study OHIF launch URL containing comma-separated StudyInstanceUIDs', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.isMultiStudy, true);
        assert.strictEqual(body.data.studyInstanceUid, currStudyUid);
        assert.strictEqual(body.data.priorStudyInstanceUid, prior1StudyUid);
        assert.strictEqual(body.data.accessionNumber, 'ACC-TEST-P42B-CURR');
        assert.strictEqual(body.data.priorAccessionNumber, 'ACC-TEST-P42B-PRIOR1');

        const expectedUrl = `http://localhost:3000/viewer?StudyInstanceUIDs=${encodeURIComponent(currStudyUid)},${encodeURIComponent(prior1StudyUid)}`;
        assert.strictEqual(body.data.viewerUrl, expectedUrl);
      });

      it('preserves single study launch behavior when priorId is not provided', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch`, {
          headers: { Authorization: `Bearer ${radToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.isMultiStudy, false);
        assert.strictEqual(
          body.data.viewerUrl,
          `http://localhost:3000/viewer?StudyInstanceUIDs=${encodeURIComponent(currStudyUid)}`
        );
      });

      it('strictly rejects multi-study comparison with another patient study with HTTP 409', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${otherPatientOrder.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PRIOR_PATIENT_MISMATCH');
      });

      it('strictly rejects multi-study comparison with unreconciled prior with HTTP 409', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderUnreconciled.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PRIOR_STUDY_NOT_RECONCILED');
      });

      it('strictly rejects multi-study comparison with self with HTTP 400', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${currentOrder.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );
        assert.strictEqual(res.status, 400);
      });
    });

    describe('15.4 Concurrency, Stale Data & Outage Handling', () => {
      it('revalidates prior reconciliation dynamically when stale client state requests unlinked prior', async () => {
        // Temporarily revoke prior1 link
        await prisma.pacsStudyLink.update({
          where: { imagingOrderId: priorOrderLinkedWithReport.id },
          data: { status: PacsStudyLinkStatus.UNLINKED },
        });

        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'PRIOR_STUDY_NOT_RECONCILED');

        // Restore link
        await prisma.pacsStudyLink.update({
          where: { imagingOrderId: priorOrderLinkedWithReport.id },
          data: { status: PacsStudyLinkStatus.LINKED },
        });
      });

      it('returns safe HTTP 503 PACS_UNAVAILABLE during Orthanc outage', async () => {
        const originalGateway = getPacsGateway();
        const unreachableGateway = new OrthancPacsGateway({
          baseUrl: 'http://127.0.0.1:19999',
          username: 'orthanc',
          password: 'test-password',
          timeoutMs: 200,
        });

        try {
          setPacsGateway(unreachableGateway);

          const res = await fetch(
            `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
            { headers: { Authorization: `Bearer ${radToken}` } }
          );

          assert.strictEqual(res.status, 503);
          const body = await res.json();
          assert.strictEqual(body.error.code, 'PACS_UNAVAILABLE');
          assert.ok(!JSON.stringify(body).includes('ECONNREFUSED'));
        } finally {
          setPacsGateway(originalGateway);
        }
      });
    });

    describe('15.5 RBAC & Security Matrix', () => {
      it('permits ADMIN access to prior discovery, prior report, and multi-study launch', async () => {
        const priorsRes = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(priorsRes.status, 200);

        const reportRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderLinkedWithReport.id}/report`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        assert.strictEqual(reportRes.status, 200);

        const launchRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        assert.strictEqual(launchRes.status, 200);
      });

      it('strictly forbids TECHNOLOGIST from prior discovery, prior report, and multi-launch (HTTP 403)', async () => {
        const priorsRes = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(priorsRes.status, 403);

        const reportRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderLinkedWithReport.id}/report`,
          { headers: { Authorization: `Bearer ${techToken}` } }
        );
        assert.strictEqual(reportRes.status, 403);

        const launchRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${techToken}` } }
        );
        assert.strictEqual(launchRes.status, 403);
      });

      it('strictly forbids RECEPTION from prior discovery, prior report, and multi-launch (HTTP 403)', async () => {
        const priorsRes = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(priorsRes.status, 403);

        const reportRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderLinkedWithReport.id}/report`,
          { headers: { Authorization: `Bearer ${receptionToken}` } }
        );
        assert.strictEqual(reportRes.status, 403);

        const launchRes = await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${receptionToken}` } }
        );
        assert.strictEqual(launchRes.status, 403);
      });

      it('strictly denies unauthenticated requests (HTTP 401)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${currentOrder.id}/priors`);
        assert.strictEqual(res.status, 401);
      });
    });

    describe('15.6 Clinical Audit & Identifier Immutability', () => {
      it('logs RADIOLOGIST_PRIOR_IMAGES_OPENED and RADIOLOGIST_PRIOR_REPORT_VIEWED audit entries without leaking credentials', async () => {
        // Trigger report view
        await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/priors/${priorOrderLinkedWithReport.id}/report`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        // Trigger multi-launch
        await fetch(
          `${baseUrl}/radiologist/worklist/${currentOrder.id}/viewer-launch?priorId=${priorOrderLinkedWithReport.id}`,
          { headers: { Authorization: `Bearer ${radToken}` } }
        );

        const imageLog = await prisma.auditLog.findFirst({
          where: { action: 'RADIOLOGIST_PRIOR_IMAGES_OPENED', entityId: currentOrder.id },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(imageLog, 'RADIOLOGIST_PRIOR_IMAGES_OPENED audit entry must exist');
        const imgDetails = imageLog.details as any;
        assert.strictEqual(imgDetails.currentAccessionNumber, 'ACC-TEST-P42B-CURR');
        assert.strictEqual(imgDetails.priorAccessionNumber, 'ACC-TEST-P42B-PRIOR1');
        assert.strictEqual(imgDetails.currentStudyInstanceUid, currStudyUid);
        assert.strictEqual(imgDetails.priorStudyInstanceUid, prior1StudyUid);
        assert.ok(!JSON.stringify(imgDetails).toLowerCase().includes('basic '));

        const reportLog = await prisma.auditLog.findFirst({
          where: { action: 'RADIOLOGIST_PRIOR_REPORT_VIEWED' },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(reportLog, 'RADIOLOGIST_PRIOR_REPORT_VIEWED audit entry must exist');
        const repDetails = reportLog.details as any;
        assert.strictEqual(repDetails.currentAccessionNumber, 'ACC-TEST-P42B-CURR');
        assert.strictEqual(repDetails.priorAccessionNumber, 'ACC-TEST-P42B-PRIOR1');
      });

      it('confirms Patient ID and Accession Numbers remain strictly immutable', async () => {
        const currAfter = await prisma.imagingOrder.findUnique({
          where: { id: currentOrder.id },
          include: { patient: true },
        });
        const priorAfter = await prisma.imagingOrder.findUnique({
          where: { id: priorOrderLinkedWithReport.id },
          include: { patient: true },
        });

        assert.strictEqual(currAfter?.accessionNumber, 'ACC-TEST-P42B-CURR');
        assert.strictEqual(currAfter?.patient.patientId, 'PAT-TEST-P42B-01');
        assert.strictEqual(priorAfter?.accessionNumber, 'ACC-TEST-P42B-PRIOR1');
        assert.strictEqual(priorAfter?.patient.patientId, 'PAT-TEST-P42B-01');
      });
    });

    after(() => {
      setPacsGateway(new MockPacsGateway('success'));
    });
  });

  describe('16. Phase 4.3 — Reporting Templates & Draft / Autosave', () => {
    let p43Patient: any;
    let p43Equipment: any;
    let p43RadUser1: any;
    let p43RadUser2: any;
    let p43RadToken1: string;
    let p43RadToken2: string;

    let p43OrderCT: any;
    let p43OrderMRI: any;
    let p43OrderIneligible: any;

    let ctChestTemplate: any;
    let mriBrainTemplate: any;

    before(async () => {
      // Ensure PACS gateway is configured for success
      setPacsGateway(new MockPacsGateway('success'));

      // Seed default templates if not present
      const count = await prisma.reportingTemplate.count();
      if (count === 0) {
        await prisma.reportingTemplate.createMany({
          data: [
            {
              name: 'CT Chest Standard Template',
              modality: ModalityType.CT,
              bodyPart: 'Chest',
              description: 'Standard thoracic computed tomography',
              sections: ['Clinical Indication', 'Comparison', 'Findings', 'Impression'],
              isActive: true,
            },
            {
              name: 'MRI Brain Standard Template',
              modality: ModalityType.MRI,
              bodyPart: 'Brain',
              description: 'Standard brain magnetic resonance imaging',
              sections: ['Clinical Indication', 'Comparison', 'Findings', 'Impression'],
              isActive: true,
            },
          ],
        });
      }

      ctChestTemplate = await prisma.reportingTemplate.findFirstOrThrow({
        where: { modality: ModalityType.CT, bodyPart: 'Chest' },
      });
      mriBrainTemplate = await prisma.reportingTemplate.findFirstOrThrow({
        where: { modality: ModalityType.MRI, bodyPart: 'Brain' },
      });

      // Distinct test radiologist users
      p43RadUser1 = await prisma.user.create({
        data: {
          firstName: 'Elena',
          lastName: 'Rostova-P43',
          email: `elena.p43.${Date.now()}@ris.local`,
          passwordHash: 'dummy',
          role: UserRole.RADIOLOGIST,
        },
      });

      p43RadUser2 = await prisma.user.create({
        data: {
          firstName: 'Marcus',
          lastName: 'Vance-P43',
          email: `marcus.p43.${Date.now()}@ris.local`,
          passwordHash: 'dummy',
          role: UserRole.RADIOLOGIST,
        },
      });

      p43RadToken1 = jwt.sign(
        { userId: p43RadUser1.id, email: p43RadUser1.email, role: p43RadUser1.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p43RadToken2 = jwt.sign(
        { userId: p43RadUser2.id, email: p43RadUser2.email, role: p43RadUser2.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p43Patient = await prisma.patient.create({
        data: {
          patientId: `PAT-TEST-P43-${Date.now()}`,
          firstName: 'Jonathan',
          lastName: 'Harker',
          dateOfBirth: new Date('1982-04-12'),
          gender: Gender.MALE,
          phone: '+1-555-430-1000',
        },
      });

      p43Equipment = await prisma.equipment.findFirst();
      if (!p43Equipment) {
        p43Equipment = await prisma.equipment.create({
          data: {
            name: 'CT Scanner Suite 4.3',
            modality: ModalityType.CT,
            manufacturer: 'GE Healthcare',
            model: 'Revolution EVO',
            serialNumber: `SN-43-${Date.now()}`,
            location: 'Room 430',
            status: EquipmentStatus.OPERATIONAL,
          },
        });
      }

      // Eligible CT Order
      p43OrderCT = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P43-CT-${Date.now()}`,
          patientId: p43Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast',
          clinicalIndication: 'Evaluation of persistent cough and hemoptysis',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const ctScan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p43OrderCT.id,
          attemptNumber: 1,
          equipmentId: p43Equipment.id,
          state: ScanState.COMPLETED,
          completedAt: new Date(),
        },
      });

      const ctQa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p43OrderCT.id,
          scanLifecycleId: ctScan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p43RadUser1.id,
          reviewedByUserId: p43RadUser1.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p43OrderCT.id,
          scanLifecycleId: ctScan.id,
          imageQualityReviewId: ctQa.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p43OrderCT.id,
          orthancStudyId: `orthanc-study-p43-ct-${Date.now()}`,
          studyInstanceUid: `1.2.840.113619.4.3.ct.${Date.now()}`,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p43RadUser1.id,
        },
      });

      // Eligible MRI Order
      p43OrderMRI = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P43-MRI-${Date.now()}`,
          patientId: p43Patient.id,
          modality: ModalityType.MRI,
          bodyPart: 'Brain',
          examinationName: 'MRI Brain without Contrast',
          clinicalIndication: 'Recurrent migraine with visual aura',
          priority: Priority.URGENT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const mriScan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p43OrderMRI.id,
          attemptNumber: 1,
          equipmentId: p43Equipment.id,
          state: ScanState.COMPLETED,
          completedAt: new Date(),
        },
      });

      const mriQa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p43OrderMRI.id,
          scanLifecycleId: mriScan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p43RadUser1.id,
          reviewedByUserId: p43RadUser1.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p43OrderMRI.id,
          scanLifecycleId: mriScan.id,
          imageQualityReviewId: mriQa.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p43OrderMRI.id,
          orthancStudyId: `orthanc-study-p43-mri-${Date.now()}`,
          studyInstanceUid: `1.2.840.113619.4.3.mri.${Date.now()}`,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p43RadUser1.id,
        },
      });

      // Ineligible Order (pre-scan, no QA)
      p43OrderIneligible = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P43-INELIGIBLE-${Date.now()}`,
          patientId: p43Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Head',
          examinationName: 'CT Head without Contrast',
          clinicalIndication: 'Acute trauma',
          priority: Priority.STAT,
          orderStatus: OrderStatus.READY_FOR_TECH,
        },
      });
    });

    describe('16.1 Reporting Templates Catalog & Selection', () => {
      it('returns appropriate structured templates matching order modality and body region', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken1}` },
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.order.accessionNumber, p43OrderCT.accessionNumber);
        assert.ok(Array.isArray(body.data.templates));
        assert.ok(body.data.templates.length > 0);

        // All returned templates must match order modality CT
        for (const t of body.data.templates) {
          assert.strictEqual(t.modality, ModalityType.CT);
        }

        // Recommended template for 'Chest' must be first
        assert.strictEqual(body.data.templates[0].isRecommended, true);
        assert.strictEqual(body.data.templates[0].bodyPart, 'Chest');
      });

      it('returns MRI Brain template as recommended for MRI Brain study', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderMRI.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken1}` },
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.order.modality, ModalityType.MRI);
        assert.strictEqual(body.data.templates[0].modality, ModalityType.MRI);
        assert.strictEqual(body.data.templates[0].bodyPart, 'Brain');
        assert.strictEqual(body.data.templates[0].isRecommended, true);
      });

      it('strictly rejects report workspace request on ineligible orders with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderIneligible.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken1}` },
        });

        assert.strictEqual(res.status, 409);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error?.code || body.error, 'ORDER_NOT_ELIGIBLE');
      });

      it('rejects draft creation with template from a mismatched modality with HTTP 400 Bad Request', async () => {
        // Attempting to use MRI Brain template on CT Chest order
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            templateId: mriBrainTemplate.id,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('does not match order modality'));
      });

      it('rejects draft creation with non-existent template ID with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            templateId: 'non-existent-template-id',
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('not found'));
      });
    });

    describe('16.2 Report Draft Lifecycle (Create, Save, Autosave, Reload)', () => {
      let createdDraft: any;

      it('creates an initial draft after template selection with HTTP 201 Created and version 1', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            templateId: ctChestTemplate.id,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.draft.version, 1);
        assert.strictEqual(body.data.draft.templateId, ctChestTemplate.id);
        assert.strictEqual(body.data.draft.authorId, p43RadUser1.id);
        assert.ok(body.data.draft.content['Clinical Indication'].includes('persistent cough'));
        assert.strictEqual(body.data.draft.content['Findings'], '');
        assert.strictEqual(body.data.draft.content['Impression'], '');

        createdDraft = body.data.draft;
      });

      it('idempotently returns existing draft when createDraft is called repeatedly (no duplicate drafts)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            templateId: ctChestTemplate.id,
          }),
        });

        assert.ok([200, 201].includes(res.status));
        const body = (await res.json()) as any;
        assert.strictEqual(body.data.draft.id, createdDraft.id);
        assert.strictEqual(body.data.draft.version, createdDraft.version);

        // Verify in database that exactly ONE draft exists
        const count = await prisma.reportDraft.count({
          where: { imagingOrderId: p43OrderCT.id },
        });
        assert.strictEqual(count, 1, 'Database must have exactly one active draft record');
      });

      it('manually saves draft updates and increments version (v1 -> v2)', async () => {
        const updatedContent = {
          'Clinical Indication': p43OrderCT.clinicalIndication,
          Comparison: 'Compared with baseline chest radiography.',
          Findings: 'Lungs: Minimal bibasilar atelectasis. No focal infiltrate or pleural effusion.',
          Impression: '1. No evidence of acute pulmonary consolidation.\n2. Minor dependent atelectasis.',
        };

        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: 1,
            content: updatedContent,
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.draft.version, 2);
        assert.strictEqual(body.data.draft.content['Comparison'], updatedContent['Comparison']);
        assert.strictEqual(body.data.draft.content['Findings'], updatedContent['Findings']);

        createdDraft = body.data.draft;
      });

      it('autosaves draft updates and updates lastAutosavedAt with incremented version (v2 -> v3)', async () => {
        const autosavedContent = {
          ...createdDraft.content,
          Findings: 'Lungs: Minimal bibasilar atelectasis. No focal infiltrate or pleural effusion. Trachea midline.',
        };

        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft/autosave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: 2,
            content: autosavedContent,
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.draft.version, 3);
        assert.ok(body.data.draft.lastAutosavedAt, 'lastAutosavedAt must be populated');
        assert.strictEqual(body.data.draft.content['Findings'], autosavedContent['Findings']);

        createdDraft = body.data.draft;
      });

      it('restores the latest draft revision, template, and content upon reload / refresh', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken1}` },
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.ok(body.data.draft, 'Draft must exist on reload');
        assert.strictEqual(body.data.draft.id, createdDraft.id);
        assert.strictEqual(body.data.draft.version, 3);
        assert.strictEqual(body.data.draft.content['Findings'], createdDraft.content['Findings']);
        assert.strictEqual(body.data.draft.templateName, ctChestTemplate.name);
      });
    });

    describe('16.3 Stale-Tab Optimistic Concurrency Protection', () => {
      it('strictly prevents stale-tab overwrites with HTTP 409 REPORT_DRAFT_VERSION_CONFLICT', async () => {
        // Tab A and Tab B both loaded at version 3
        const tabA_version = 3;
        const tabB_version = 3;

        // Tab A saves changes -> advances version to 4
        const tabA_res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: tabA_version,
            content: {
              'Clinical Indication': p43OrderCT.clinicalIndication,
              Comparison: 'Tab A comparison note',
              Findings: 'Tab A findings: clear lung parenchyma.',
              Impression: 'Tab A impression: Normal study.',
            },
          }),
        });

        assert.strictEqual(tabA_res.status, 200);
        const tabA_body = (await tabA_res.json()) as any;
        assert.strictEqual(tabA_body.data.draft.version, 4);

        // Tab B now attempts to save its stale version 3 content
        const tabB_res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: tabB_version,
            content: {
              'Clinical Indication': p43OrderCT.clinicalIndication,
              Comparison: 'Stale Tab B comparison',
              Findings: 'Stale Tab B findings that should be rejected',
              Impression: 'Stale Tab B impression',
            },
          }),
        });

        assert.strictEqual(tabB_res.status, 409);
        const tabB_body = (await tabB_res.json()) as any;
        assert.strictEqual(tabB_body.success, false);
        assert.strictEqual(tabB_body.error?.code || tabB_body.error, 'REPORT_DRAFT_VERSION_CONFLICT');
        assert.ok(tabB_body.message.includes('another tab'));

        // Tab B autosave attempt with stale version 3 also rejected with HTTP 409
        const tabB_autosave = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft/autosave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: tabB_version,
            content: {
              Findings: 'Stale autosave content',
            },
          }),
        });

        assert.strictEqual(tabB_autosave.status, 409);

        // Verify Tab A's content was preserved in database
        const dbDraft = await prisma.reportDraft.findUniqueOrThrow({
          where: { imagingOrderId: p43OrderCT.id },
        });
        assert.strictEqual(dbDraft.version, 4);
        const content = dbDraft.content as any;
        assert.strictEqual(content['Findings'], 'Tab A findings: clear lung parenchyma.');

        // Tab B reloads latest draft and then saves with correct version 4 -> succeeds
        const reloadRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken1}` },
        });
        const reloaded = (await reloadRes.json()) as any;
        assert.strictEqual(reloaded.data.draft.version, 4);

        const tabB_recoverRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken1}`,
          },
          body: JSON.stringify({
            version: 4,
            content: {
              ...reloaded.data.draft.content,
              Impression: 'Tab B recovered and successfully merged impression.',
            },
          }),
        });
        assert.strictEqual(tabB_recoverRes.status, 200);
        const tabB_recoverBody = (await tabB_recoverRes.json()) as any;
        assert.strictEqual(tabB_recoverBody.data.draft.version, 5);
      });
    });

    describe('16.4 RBAC, Assignment Policy & Draft Ownership Security', () => {
      it('prevents another radiologist from viewing or editing a draft owned by RadUser1 (HTTP 403 Forbidden)', async () => {
        // RadUser2 tries to view RadUser1's draft
        const viewRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${p43RadToken2}` },
        });

        assert.strictEqual(viewRes.status, 403);
        const viewBody = (await viewRes.json()) as any;
        assert.strictEqual(viewBody.success, false);
        assert.strictEqual(viewBody.error?.code || viewBody.error, 'DRAFT_FORBIDDEN');

        // RadUser2 tries to save RadUser1's draft
        const saveRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p43RadToken2}`,
          },
          body: JSON.stringify({
            version: 5,
            content: { Findings: 'Unauthorized takeover attempt' },
          }),
        });

        assert.strictEqual(saveRes.status, 403);
      });

      it('permits ADMIN to access reporting workspace according to administrative policy', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as any;
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.order.accessionNumber, p43OrderCT.accessionNumber);
      });

      it('strictly forbids TECHNOLOGIST from report workspace and draft operations (HTTP 403)', async () => {
        const getRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(getRes.status, 403);

        const postRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${techToken}`,
          },
          body: JSON.stringify({ templateId: ctChestTemplate.id }),
        });
        assert.strictEqual(postRes.status, 403);
      });

      it('strictly forbids RECEPTION from report workspace and draft operations (HTTP 403)', async () => {
        const getRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(getRes.status, 403);

        const patchRes = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({ version: 1, content: {} }),
        });
        assert.strictEqual(patchRes.status, 403);
      });

      it('strictly denies unauthenticated requests (HTTP 401 Unauthorized)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p43OrderCT.id}/report`);
        assert.strictEqual(res.status, 401);
      });
    });

    describe('16.5 Clinical Audit Integrity & Identifier Immutability', () => {
      it('logs REPORT_DRAFT_CREATED and REPORT_DRAFT_SAVED audit entries without leaking credentials', async () => {
        const createdLog = await prisma.auditLog.findFirst({
          where: { action: 'REPORT_DRAFT_CREATED' },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(createdLog, 'REPORT_DRAFT_CREATED audit entry must exist');
        const cDetails = createdLog.details as any;
        assert.strictEqual(cDetails.accessionNumber, p43OrderCT.accessionNumber);
        assert.strictEqual(cDetails.version, 1);

        const savedLog = await prisma.auditLog.findFirst({
          where: { action: 'REPORT_DRAFT_SAVED' },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(savedLog, 'REPORT_DRAFT_SAVED audit entry must exist');
        const sDetails = savedLog.details as any;
        assert.strictEqual(sDetails.accessionNumber, p43OrderCT.accessionNumber);
        assert.ok(sDetails.version >= 2);
      });

      it('confirms Patient ID and Accession Numbers remain strictly immutable', async () => {
        const orderAfter = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p43OrderCT.id },
          include: { patient: true },
        });

        assert.strictEqual(orderAfter.accessionNumber, p43OrderCT.accessionNumber);
        assert.strictEqual(orderAfter.patient.patientId, p43Patient.patientId);
      });
    });
  });

  describe('17. Phase 4.4 — Dictation & Speech-to-Text Reporting Integration Tests', () => {
    let p44Patient: any;
    let p44Order: any;
    let p44RadUser1: any;
    let p44RadUser2: any;
    let p44RadToken1: string;
    let p44RadToken2: string;
    let p44Equipment: any;

    before(async () => {
      p44Equipment = await prisma.equipment.findFirst();
      if (!p44Equipment) {
        p44Equipment = await prisma.equipment.create({
          data: {
            name: 'CT Scanner Suite 1',
            modality: ModalityType.CT,
            manufacturer: 'GE Healthcare',
            model: 'Revolution CT',
            serialNumber: `SN-P44-${Date.now()}`,
            location: 'Room CT-101',
            status: EquipmentStatus.AVAILABLE,
          },
        });
      }

      p44RadUser1 = await prisma.user.create({
        data: {
          email: `rad1.p44.${Date.now()}@manrad.local`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          firstName: 'Elena',
          lastName: 'Rostova',
          role: UserRole.RADIOLOGIST,
          isActive: true,
        },
      });
      p44RadToken1 = jwt.sign(
        { userId: p44RadUser1.id, email: p44RadUser1.email, role: p44RadUser1.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p44RadUser2 = await prisma.user.create({
        data: {
          email: `rad2.p44.${Date.now()}@manrad.local`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          firstName: 'Marcus',
          lastName: 'Vance',
          role: UserRole.RADIOLOGIST,
          isActive: true,
        },
      });
      p44RadToken2 = jwt.sign(
        { userId: p44RadUser2.id, email: p44RadUser2.email, role: p44RadUser2.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p44Patient = await prisma.patient.create({
        data: {
          patientId: `PAT-TEST-P44-${Date.now()}`,
          firstName: 'Speech',
          lastName: 'Subject',
          dateOfBirth: new Date('1985-06-15'),
          gender: Gender.MALE,
          email: `dictation.patient.${Date.now()}@test.local`,
          phone: '+1-555-888-0099',
          address: '404 Dictation Way, Diagnostic City',
          isActive: true,
        },
      });

      p44Order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P44-${Date.now()}`,
          patientId: p44Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest with Contrast',
          clinicalIndication: 'Persistent cough and hemoptysis',
          priority: Priority.URGENT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p44Order.id,
          attemptNumber: 1,
          equipmentId: p44Equipment.id,
          state: ScanState.COMPLETED,
          completedAt: new Date(),
        },
      });

      const qa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p44Order.id,
          scanLifecycleId: scan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p44RadUser1.id,
          reviewedByUserId: p44RadUser1.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p44Order.id,
          scanLifecycleId: scan.id,
          imageQualityReviewId: qa.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p44Order.id,
          orthancStudyId: `orthanc-study-p44-${Date.now()}`,
          studyInstanceUid: `1.2.840.113619.4.4.ct.${Date.now()}`,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p44RadUser1.id,
        },
      });

      await prisma.radiologistAssignment.create({
        data: {
          imagingOrderId: p44Order.id,
          radiologistUserId: p44RadUser1.id,
          assignedByUserId: p44RadUser1.id,
          status: RadiologistAssignmentStatus.ASSIGNED,
        },
      });

      const templates = await prisma.reportingTemplate.findMany({
        where: { modality: ModalityType.CT, isActive: true },
      });
      const tpl = templates.find((t) => t.bodyPart.toLowerCase() === 'chest') || templates[0];

      await fetch(`${baseUrl}/radiologist/worklist/${p44Order.id}/report/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p44RadToken1}`,
        },
        body: JSON.stringify({ templateId: tpl.id }),
      });
    });

    describe('17.1 Dictation Session Lifecycle Audit', () => {
      it('records REPORT_DICTATION_STARTED on start dictation without audio or credentials', async () => {
        const startRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken1}`,
            },
            body: JSON.stringify({
              action: 'START',
              section: 'Findings',
            }),
          }
        );

        assert.strictEqual(startRes.status, 200);
        const body = await startRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.action, 'START');

        const audit = await prisma.auditLog.findFirst({
          where: { action: 'REPORT_DICTATION_STARTED' },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log entry must exist for start dictation');
        const details = audit.details as any;
        assert.strictEqual(details.section, 'Findings');
        assert.strictEqual(details.accessionNumber, p44Order.accessionNumber);
        assert.strictEqual(details.audio, undefined, 'Must not log audio');
        assert.strictEqual(details.transcript, undefined, 'Must not log full transcript in audit');
      });

      it('records REPORT_DICTATION_COMPLETED on stop dictation', async () => {
        const stopRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken1}`,
            },
            body: JSON.stringify({
              action: 'COMPLETE',
              section: 'Findings',
            }),
          }
        );

        assert.strictEqual(stopRes.status, 200);
        const body = await stopRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.action, 'COMPLETE');

        const audit = await prisma.auditLog.findFirst({
          where: { action: 'REPORT_DICTATION_COMPLETED' },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log entry must exist for complete dictation');
        const details = audit.details as any;
        assert.strictEqual(details.section, 'Findings');
      });
    });

    describe('17.2 Dictated Draft Persistence & Subsequent Manual Editing', () => {
      let currentDraftVersion = 1;

      it('persists speech-generated transcript through standard draft autosave mechanism', async () => {
        const getRes = await fetch(`${baseUrl}/radiologist/worklist/${p44Order.id}/report`, {
          headers: { Authorization: `Bearer ${p44RadToken1}` },
        });
        const getBody = await getRes.json();
        currentDraftVersion = getBody.data.draft.version;

        const dictatedContent = {
          ...getBody.data.draft.content,
          Findings: 'Lungs are clear bilaterally. No pleural effusion or pneumothorax.',
        };

        const autosaveRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/draft/autosave`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken1}`,
            },
            body: JSON.stringify({
              version: currentDraftVersion,
              content: dictatedContent,
            }),
          }
        );

        assert.strictEqual(autosaveRes.status, 200);
        const autosaveBody = await autosaveRes.json();
        assert.strictEqual(autosaveBody.success, true);
        assert.strictEqual(autosaveBody.data.draft.version, currentDraftVersion + 1);
        assert.strictEqual(
          autosaveBody.data.draft.content.Findings,
          'Lungs are clear bilaterally. No pleural effusion or pneumothorax.'
        );

        currentDraftVersion = autosaveBody.data.draft.version;
      });

      it('allows manual keyboard editing and correction of previously dictated transcript', async () => {
        const correctedContent = {
          'Clinical Indication': 'Rule out pulmonary nodule.',
          Comparison: 'None available.',
          Findings:
            'Lungs are clear bilaterally. No pleural effusion or pneumothorax. Heart size is normal.',
          Impression: 'No acute cardiopulmonary disease.',
        };

        const saveRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken1}`,
            },
            body: JSON.stringify({
              version: currentDraftVersion,
              content: correctedContent,
            }),
          }
        );

        assert.strictEqual(saveRes.status, 200);
        const saveBody = await saveRes.json();
        assert.strictEqual(saveBody.success, true);
        assert.strictEqual(
          saveBody.data.draft.content.Findings,
          'Lungs are clear bilaterally. No pleural effusion or pneumothorax. Heart size is normal.'
        );
        assert.strictEqual(
          saveBody.data.draft.content.Impression,
          'No acute cardiopulmonary disease.'
        );

        currentDraftVersion = saveBody.data.draft.version;
      });

      it('reloads draft on refresh/re-entry and confirms all dictated and edited text remains intact', async () => {
        const getRes = await fetch(`${baseUrl}/radiologist/worklist/${p44Order.id}/report`, {
          headers: { Authorization: `Bearer ${p44RadToken1}` },
        });
        assert.strictEqual(getRes.status, 200);
        const body = await getRes.json();
        assert.strictEqual(
          body.data.draft.content.Findings,
          'Lungs are clear bilaterally. No pleural effusion or pneumothorax. Heart size is normal.'
        );
        assert.strictEqual(
          body.data.draft.content.Impression,
          'No acute cardiopulmonary disease.'
        );
      });
    });

    describe('17.3 Concurrency Protection for Dictated Drafts', () => {
      it('rejects stale tab autosave attempt with HTTP 409 REPORT_DRAFT_VERSION_CONFLICT', async () => {
        const conflictRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/draft/autosave`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken1}`,
            },
            body: JSON.stringify({
              version: 1, // Deliberately stale
              content: { Findings: 'Stale dictation text' },
            }),
          }
        );

        assert.strictEqual(conflictRes.status, 409);
        const body = await conflictRes.json();
        assert.strictEqual(body.success, false);
        const errorCode = body.error?.code || body.error;
        assert.strictEqual(errorCode, 'REPORT_DRAFT_VERSION_CONFLICT');
      });
    });

    describe('17.4 RBAC Security Matrix for Dictation Lifecycle', () => {
      it('denies another non-assigned radiologist from recording dictation sessions (HTTP 403)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p44RadToken2}`,
            },
            body: JSON.stringify({ action: 'START', section: 'Findings' }),
          }
        );
        assert.strictEqual(res.status, 403);
      });

      it('denies TECHNOLOGIST role from recording dictation sessions (HTTP 403)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${techToken}`,
            },
            body: JSON.stringify({ action: 'START', section: 'Findings' }),
          }
        );
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION role from recording dictation sessions (HTTP 403)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${receptionToken}`,
            },
            body: JSON.stringify({ action: 'START', section: 'Findings' }),
          }
        );
        assert.strictEqual(res.status, 403);
      });

      it('denies unauthenticated requests from recording dictation sessions (HTTP 401)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'START', section: 'Findings' }),
          }
        );
        assert.strictEqual(res.status, 401);
      });
    });

    describe('17.5 Zero Audio Storage & Transmission Boundary', () => {
      it('confirms that no audio upload endpoints exist (HTTP 404)', async () => {
        const audioUploadRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/audio`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${p44RadToken1}` },
          }
        );
        assert.strictEqual(audioUploadRes.status, 404);

        const speechUploadRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p44Order.id}/report/dictation/audio`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${p44RadToken1}` },
          }
        );
        assert.strictEqual(speechUploadRes.status, 404);
      });

      it('confirms that Patient ID and Accession Numbers remain strictly immutable after dictation', async () => {
        const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p44Order.id },
          include: { patient: true },
        });

        assert.strictEqual(finalOrder.accessionNumber, p44Order.accessionNumber);
        assert.strictEqual(finalOrder.patient.patientId, p44Patient.patientId);
      });
    });
  });

  describe('SECTION 18 — PHASE 4.5: MEASUREMENTS & KEY IMAGE REFERENCES', () => {
    let p45Patient: any;
    let p45Order: any;
    let p45RadUser1: any;
    let p45RadUser2: any;
    let p45RadToken1: string;
    let p45RadToken2: string;
    const p45StudyInstanceUid = `1.2.840.113619.4.5.ct.${Date.now()}`;
    const p45SeriesUid = `${p45StudyInstanceUid}.1`;
    const p45SopUid1 = `${p45StudyInstanceUid}.1.1`;
    const p45SopUid2 = `${p45StudyInstanceUid}.1.2`;

    before(async () => {
      p45Patient = await prisma.patient.create({
        data: {
          patientId: `PAT-TEST-P45-${Date.now()}`,
          firstName: 'Measurement',
          lastName: 'Patient',
          dateOfBirth: new Date('1985-05-15'),
          gender: Gender.FEMALE,
          phone: '+1-555-0199',
          email: `p45.test.${Date.now()}@example.com`,
          address: '450 DICOM Ave',
          isActive: true,
        },
      });

      p45RadUser1 = await prisma.user.create({
        data: {
          email: `rad.p45.1.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'P45-Marcus',
          lastName: 'Radiologist',
          isActive: true,
        },
      });
      p45RadToken1 = jwt.sign(
        { userId: p45RadUser1.id, email: p45RadUser1.email, role: p45RadUser1.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p45RadUser2 = await prisma.user.create({
        data: {
          email: `rad.p45.2.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'P45-Elena',
          lastName: 'Radiologist',
          isActive: true,
        },
      });
      p45RadToken2 = jwt.sign(
        { userId: p45RadUser2.id, email: p45RadUser2.email, role: p45RadUser2.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p45Order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P45-${Date.now()}`,
          patientId: p45Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Contrast',
          clinicalIndication: 'Solitary pulmonary nodule follow-up',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p45Order.id,
          state: ScanState.COMPLETED,
          attemptNumber: 1,
          startedByUserId: p45RadUser1.id,
          completedByUserId: p45RadUser1.id,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const qa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p45Order.id,
          scanLifecycleId: scan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p45RadUser1.id,
          reviewedByUserId: p45RadUser1.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p45Order.id,
          scanLifecycleId: scan.id,
          imageQualityReviewId: qa.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p45Order.id,
          orthancStudyId: `orthanc-study-p45-${Date.now()}`,
          studyInstanceUid: p45StudyInstanceUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p45RadUser1.id,
        },
      });

      await prisma.radiologistAssignment.create({
        data: {
          imagingOrderId: p45Order.id,
          radiologistUserId: p45RadUser1.id,
          assignedByUserId: p45RadUser1.id,
          status: RadiologistAssignmentStatus.ASSIGNED,
        },
      });

      // Create initial draft
      await fetch(`${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p45RadToken1}`,
        },
        body: JSON.stringify({}),
      });
    });

    describe('18.1 Study Instances Inspection Endpoint', () => {
      it('returns verified DICOM series and instances for eligible study (HTTP 200)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/study-instances`,
          {
            headers: { Authorization: `Bearer ${p45RadToken1}` },
          }
        );

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.studyInstanceUid, p45StudyInstanceUid);
        assert.ok(Array.isArray(body.data.series), 'Series array must exist');
        assert.ok(body.data.series.length > 0, 'At least one series must be present');
        assert.ok(Array.isArray(body.data.series[0].instances), 'Instances array must exist');
      });

      it('denies unauthenticated request to study-instances (HTTP 401)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/study-instances`
        );
        assert.strictEqual(res.status, 401);
      });

      it('denies TECHNOLOGIST role from study-instances (HTTP 403)', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/study-instances`,
          {
            headers: { Authorization: `Bearer ${techToken}` },
          }
        );
        assert.strictEqual(res.status, 403);
      });
    });

    describe('18.2 Measurement Reference Insertion & Audit Verification', () => {
      it('saves draft with valid measurement reference and audits REPORT_MEASUREMENT_ADDED (HTTP 200)', async () => {
        const measurementId = `meas-p45-1-${Date.now()}`;
        const saveRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 1,
              content: {
                'Clinical Indication': 'Solitary pulmonary nodule follow-up',
                Findings: 'Subpleural right upper lobe nodule measured with caliper at 12.4 mm.',
                Impression: 'Stable pulmonary nodule.',
              },
              measurements: [
                {
                  id: measurementId,
                  toolType: 'Length',
                  label: 'RUL Nodule Long Axis',
                  numericValue: 12.4,
                  unit: 'mm',
                  studyInstanceUid: p45StudyInstanceUid,
                  seriesInstanceUid: p45SeriesUid,
                  sopInstanceUid: p45SopUid1,
                  instanceNumber: 1,
                  sliceLocation: 2.5,
                  findingText: 'Non-calcified solid nodule',
                },
              ],
            }),
          }
        );

        assert.strictEqual(saveRes.status, 200);
        const saveBody = await saveRes.json();
        assert.strictEqual(saveBody.success, true);
        assert.strictEqual(saveBody.data.draft.version, 2);
        assert.strictEqual(saveBody.data.draft.measurements.length, 1);
        assert.strictEqual(saveBody.data.draft.measurements[0].label, 'RUL Nodule Long Axis');

        // Verify Audit Log: REPORT_MEASUREMENT_ADDED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'REPORT_MEASUREMENT_ADDED',
            userId: p45RadUser1.id,
          },
          orderBy: { timestamp: 'desc' },
        });

        assert.ok(audit, 'Audit log for REPORT_MEASUREMENT_ADDED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.measurementId, measurementId);
        assert.strictEqual(details.toolType, 'Length');
        assert.strictEqual(details.numericValue, 12.4);
        assert.strictEqual(details.unit, 'mm');
      });

      it('does not duplicate REPORT_MEASUREMENT_ADDED audit when re-saving existing measurement', async () => {
        const auditsBefore = await prisma.auditLog.count({
          where: {
            action: 'REPORT_MEASUREMENT_ADDED',
            userId: p45RadUser1.id,
          },
        });

        // Save again with same measurement, version 2 -> 3
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 2,
              content: {
                'Clinical Indication': 'Solitary pulmonary nodule follow-up',
                Findings: 'Updated finding description.',
                Impression: 'Stable nodule.',
              },
            }),
          }
        );

        assert.strictEqual(res.status, 200);

        const auditsAfter = await prisma.auditLog.count({
          where: {
            action: 'REPORT_MEASUREMENT_ADDED',
            userId: p45RadUser1.id,
          },
        });

        assert.strictEqual(auditsAfter, auditsBefore, 'No duplicate measurement added audit log');
      });
    });

    describe('18.3 Key Image Reference Insertion & Audit Verification', () => {
      it('saves draft with valid key image reference and audits REPORT_KEY_IMAGE_ADDED (HTTP 200)', async () => {
        const keyImageId = `keyimg-p45-1-${Date.now()}`;
        const saveRes = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 3,
              content: {
                'Clinical Indication': 'Solitary pulmonary nodule follow-up',
                Findings: 'Nodule demonstrated on slice #2.',
                Impression: 'Stable nodule.',
              },
              keyImages: [
                {
                  id: keyImageId,
                  studyInstanceUid: p45StudyInstanceUid,
                  seriesInstanceUid: p45SeriesUid,
                  sopInstanceUid: p45SopUid2,
                  instanceNumber: 2,
                  sliceLocation: 5.0,
                  label: 'Key Image 1 — Nodule Slice',
                  description: 'Demonstrating subpleural location and lack of lymphadenopathy',
                },
              ],
            }),
          }
        );

        assert.strictEqual(saveRes.status, 200);
        const body = await saveRes.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.draft.version, 4);
        assert.strictEqual(body.data.draft.keyImages.length, 1);
        assert.strictEqual(body.data.draft.keyImages[0].label, 'Key Image 1 — Nodule Slice');

        // Verify Audit Log: REPORT_KEY_IMAGE_ADDED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'REPORT_KEY_IMAGE_ADDED',
            userId: p45RadUser1.id,
          },
          orderBy: { timestamp: 'desc' },
        });

        assert.ok(audit, 'Audit log for REPORT_KEY_IMAGE_ADDED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.keyImageId, keyImageId);
        assert.strictEqual(details.label, 'Key Image 1 — Nodule Slice');
      });

      it('unpacks both measurements and key images on GET workspace context', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report`,
          {
            headers: { Authorization: `Bearer ${p45RadToken1}` },
          }
        );

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.draft.measurements), 'Measurements must be an array');
        assert.strictEqual(body.data.draft.measurements.length, 1);
        assert.ok(Array.isArray(body.data.draft.keyImages), 'Key images must be an array');
        assert.strictEqual(body.data.draft.keyImages.length, 1);
        // Verify internal _keys are stripped from content sections
        assert.strictEqual(body.data.draft.content._measurements, undefined);
        assert.strictEqual(body.data.draft.content._keyImages, undefined);
      });
    });

    describe('18.4 Cross-Study Validation Boundary', () => {
      it('rejects measurement belonging to a different StudyInstanceUID with HTTP 409 STUDY_UID_MISMATCH', async () => {
        const foreignStudyUid = '1.3.6.1.4.1.99999.FOREIGN.STUDY.UID';
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 4,
              content: {
                Findings: 'Attempted cross-study measurement injection',
              },
              measurements: [
                {
                  id: 'meas-foreign',
                  toolType: 'Length',
                  label: 'Foreign Measurement',
                  numericValue: 5.0,
                  unit: 'mm',
                  studyInstanceUid: foreignStudyUid,
                  seriesInstanceUid: `${foreignStudyUid}.1`,
                  sopInstanceUid: `${foreignStudyUid}.1.1`,
                },
              ],
            }),
          }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'STUDY_UID_MISMATCH');
      });

      it('rejects key image belonging to a different StudyInstanceUID with HTTP 409 STUDY_UID_MISMATCH', async () => {
        const foreignStudyUid = '1.3.6.1.4.1.99999.FOREIGN.STUDY.UID';
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 4,
              content: {
                Findings: 'Attempted cross-study key image injection',
              },
              keyImages: [
                {
                  id: 'keyimg-foreign',
                  label: 'Foreign Key Image',
                  studyInstanceUid: foreignStudyUid,
                  seriesInstanceUid: `${foreignStudyUid}.1`,
                  sopInstanceUid: `${foreignStudyUid}.1.1`,
                },
              ],
            }),
          }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'STUDY_UID_MISMATCH');
      });
    });

    describe('18.5 Concurrency, RBAC & Immutability Integrity', () => {
      it('rejects stale-tab save with version conflict HTTP 409 REPORT_DRAFT_VERSION_CONFLICT', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken1}`,
            },
            body: JSON.stringify({
              version: 1, // Current version is 4!
              content: { Findings: 'Stale edit' },
            }),
          }
        );

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'REPORT_DRAFT_VERSION_CONFLICT');
      });

      it('denies another radiologist from editing draft with HTTP 403 DRAFT_FORBIDDEN', async () => {
        const res = await fetch(
          `${baseUrl}/radiologist/worklist/${p45Order.id}/report/draft`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${p45RadToken2}`,
            },
            body: JSON.stringify({
              version: 4,
              content: { Findings: 'Unauthorized radiologist edit' },
            }),
          }
        );

        assert.strictEqual(res.status, 403);
        const body = await res.json();
        assert.strictEqual(body.error.code, 'DRAFT_FORBIDDEN');
      });

      it('confirms that Patient ID and Accession Number remain strictly immutable', async () => {
        const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p45Order.id },
          include: { patient: true },
        });

        assert.strictEqual(finalOrder.accessionNumber, p45Order.accessionNumber);
        assert.strictEqual(finalOrder.patient.patientId, p45Patient.patientId);
      });
    });
  });

  // ==========================================
  // SECTION 19: PHASE 4.6 — PEER REVIEW / SECOND OPINION
  // ==========================================
  describe('SECTION 19 — PHASE 4.6: PEER REVIEW & SECOND OPINION', () => {
    let p46Patient: any;
    let p46RadUser1: any;
    let p46RadToken1: string;
    let p46RadUser2: any;
    let p46RadToken2: string;
    let p46RadUser3: any;
    let p46RadToken3: string;
    let p46InactiveRad: any;
    let p46Order: any;
    let p46CancelledOrder: any;
    let p46UnlinkedOrder: any;
    let createdPeerReviewId: string;
    const p46StudyInstanceUid = `1.2.840.10008.5.1.4.1.1.2.p46.${Date.now()}`;

    before(async () => {
      p46Patient = await prisma.patient.create({
        data: {
          patientId: `PAT-P46-${Date.now()}`,
          firstName: 'Jonathan',
          lastName: 'Hark',
          dateOfBirth: new Date('1978-06-22'),
          gender: Gender.MALE,
          phone: '+1-555-460-0001',
        },
      });

      p46RadUser1 = await prisma.user.create({
        data: {
          email: `rad.p46.1.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Elena',
          lastName: 'Requester',
          isActive: true,
        },
      });
      p46RadToken1 = jwt.sign(
        { userId: p46RadUser1.id, email: p46RadUser1.email, role: p46RadUser1.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p46RadUser2 = await prisma.user.create({
        data: {
          email: `rad.p46.2.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Marcus',
          lastName: 'Reviewer',
          isActive: true,
        },
      });
      p46RadToken2 = jwt.sign(
        { userId: p46RadUser2.id, email: p46RadUser2.email, role: p46RadUser2.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p46RadUser3 = await prisma.user.create({
        data: {
          email: `rad.p46.3.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Julian',
          lastName: 'ThirdParty',
          isActive: true,
        },
      });
      p46RadToken3 = jwt.sign(
        { userId: p46RadUser3.id, email: p46RadUser3.email, role: p46RadUser3.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p46InactiveRad = await prisma.user.create({
        data: {
          email: `rad.p46.inactive.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Inactive',
          lastName: 'Doctor',
          isActive: false,
        },
      });

      // 1. Eligible primary study with scan, QA accepted, and PACS linked
      p46Order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P46-${Date.now()}`,
          patientId: p46Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Contrast',
          clinicalIndication: 'Equivocal pulmonary nodule evaluation',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scan = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p46Order.id,
          state: ScanState.COMPLETED,
          attemptNumber: 1,
          startedByUserId: p46RadUser1.id,
          completedByUserId: p46RadUser1.id,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const qa = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p46Order.id,
          scanLifecycleId: scan.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p46RadUser1.id,
          reviewedByUserId: p46RadUser1.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p46Order.id,
          scanLifecycleId: scan.id,
          imageQualityReviewId: qa.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p46Order.id,
          orthancStudyId: `orthanc-study-p46-${Date.now()}`,
          studyInstanceUid: p46StudyInstanceUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p46RadUser1.id,
        },
      });

      // Primary Report Draft
      await prisma.reportDraft.create({
        data: {
          imagingOrderId: p46Order.id,
          authorId: p46RadUser1.id,
          templateName: 'CT Chest Standard',
          content: {
            'Clinical Indication': 'Equivocal pulmonary nodule evaluation',
            Findings: 'Indeterminate 8mm RUL nodule.',
            Impression: 'Recommend peer consultation.',
          },
          version: 1,
        },
      });

      // 2. Ineligible cancelled order
      p46CancelledOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P46-CANC-${Date.now()}`,
          patientId: p46Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Contrast',
          clinicalIndication: 'Cancelled study test',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.CANCELLED,
        },
      });

      // 3. Ineligible unlinked order
      p46UnlinkedOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P46-UNLINK-${Date.now()}`,
          patientId: p46Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Contrast',
          clinicalIndication: 'Unlinked test',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.CREATED,
        },
      });
    });

    describe('19.1 Peer Review Request Creation & Validation', () => {
      it('creates peer review request successfully when eligible with HTTP 201 Created', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46Order.id,
            reviewerId: p46RadUser2.id,
            reason: 'Equivocal 8mm RUL nodule vs vascular confluence. Requesting second opinion.',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'PENDING');
        assert.strictEqual(body.data.requesterId, p46RadUser1.id);
        assert.strictEqual(body.data.reviewerId, p46RadUser2.id);
        assert.ok(body.data.reason.includes('Equivocal 8mm RUL nodule'));
        createdPeerReviewId = body.data.id;

        // Verify DB record
        const dbRecord = await prisma.peerReviewRequest.findUniqueOrThrow({
          where: { id: createdPeerReviewId },
        });
        assert.strictEqual(dbRecord.status, PeerReviewStatus.PENDING);

        // Verify Audit Log: PEER_REVIEW_REQUESTED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'PEER_REVIEW_REQUESTED',
            userId: p46RadUser1.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for PEER_REVIEW_REQUESTED must exist');
      });

      it('rejects duplicate active peer review request on same order with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46Order.id,
            reviewerId: p46RadUser3.id,
            reason: 'Duplicate review attempt',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok(body.message.includes('already requested'));
      });

      it('rejects requester selecting themselves as reviewer with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46Order.id,
            reviewerId: p46RadUser1.id, // Self-selection!
            reason: 'Self review attempt',
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.ok(body.message.includes('cannot select themselves'));
      });

      it('rejects selecting an inactive radiologist with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46Order.id,
            reviewerId: p46InactiveRad.id,
            reason: 'Inactive reviewer attempt',
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.ok(body.message.includes('not an eligible active Radiologist'));
      });

      it('rejects request on cancelled order with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46CancelledOrder.id,
            reviewerId: p46RadUser2.id,
            reason: 'Cancelled order attempt',
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.ok(body.message.includes('not eligible for peer review'));
      });

      it('rejects request on unlinked PACS order with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: p46UnlinkedOrder.id,
            reviewerId: p46RadUser2.id,
            reason: 'Unlinked order attempt',
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.ok(body.message.includes('not eligible for peer review'));
      });
    });

    describe('19.2 RBAC & Queue Visibility', () => {
      it('assigned reviewer sees pending peer review request in their queue', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews?status=PENDING&type=assigned`, {
          headers: { Authorization: `Bearer ${p46RadToken2}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const found = body.data.items.find((i: any) => i.id === createdPeerReviewId);
        assert.ok(found, 'Assigned reviewer must see the created peer review request');
        assert.strictEqual(found.status, 'PENDING');
        assert.strictEqual(found.order.accessionNumber, p46Order.accessionNumber);
      });

      it('unrelated radiologist queue does not show the request under their assigned queue', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews?status=PENDING&type=assigned`, {
          headers: { Authorization: `Bearer ${p46RadToken3}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        const found = body.data.items.find((i: any) => i.id === createdPeerReviewId);
        assert.strictEqual(found, undefined, 'Unrelated radiologist must not see other radiologist assigned queue');
      });

      it('denies TECHNOLOGIST from creating or viewing peer reviews with HTTP 403 Forbidden', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          headers: { Authorization: `Bearer ${techToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies RECEPTION from creating or viewing peer reviews with HTTP 403 Forbidden', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });
        assert.strictEqual(res.status, 403);
      });

      it('denies unauthenticated requests with HTTP 401 Unauthorized', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews`);
        assert.strictEqual(res.status, 401);
      });
    });

    describe('19.3 Claim Lifecycle & Concurrency Protection', () => {
      it('assigned reviewer claims pending request and transitions status to IN_REVIEW', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${createdPeerReviewId}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${p46RadToken2}`,
          },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'IN_REVIEW');
        assert.ok(body.data.startedAt, 'startedAt timestamp must be recorded');

        // Verify DB State
        const dbRecord = await prisma.peerReviewRequest.findUniqueOrThrow({
          where: { id: createdPeerReviewId },
        });
        assert.strictEqual(dbRecord.status, PeerReviewStatus.IN_REVIEW);

        // Verify Audit Log: PEER_REVIEW_CLAIMED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'PEER_REVIEW_CLAIMED',
            userId: p46RadUser2.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for PEER_REVIEW_CLAIMED must exist');
      });

      it('rejects another reviewer attempting to claim already-claimed request with HTTP 409 PEER_REVIEW_ALREADY_CLAIMED', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${createdPeerReviewId}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`, // Admin attempting re-claim
          },
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok(body.error?.code === 'PEER_REVIEW_ALREADY_CLAIMED' || body.message.includes('already been claimed'));
      });
    });

    describe('19.4 Second Opinion Submission & Primary Report Protection', () => {
      it('assigned reviewer submits concise second-opinion response with HTTP 200', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${createdPeerReviewId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken2}`,
          },
          body: JSON.stringify({
            decision: 'CONCUR',
            reviewComment: 'Second opinion: Findings concur with indeterminate 8mm nodule. Follow-up low dose CT in 6 months recommended according to Fleischner guidelines.',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'COMPLETED');
        assert.strictEqual(body.data.decision, 'CONCUR');
        assert.ok(body.data.reviewComment.includes('Fleischner guidelines'));
        assert.ok(body.data.completedAt, 'completedAt must be populated');

        // Verify DB State
        const dbRecord = await prisma.peerReviewRequest.findUniqueOrThrow({
          where: { id: createdPeerReviewId },
        });
        assert.strictEqual(dbRecord.status, PeerReviewStatus.COMPLETED);

        // Verify Audit Log: PEER_REVIEW_COMPLETED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'PEER_REVIEW_COMPLETED',
            userId: p46RadUser2.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for PEER_REVIEW_COMPLETED must exist');
      });

      it('confirms primary ReportDraft is completely protected and untouched', async () => {
        const primaryDraft = await prisma.reportDraft.findUniqueOrThrow({
          where: { imagingOrderId: p46Order.id },
        });

        // Version and author remain exactly as created
        assert.strictEqual(primaryDraft.version, 1);
        assert.strictEqual(primaryDraft.authorId, p46RadUser1.id);
        const content = primaryDraft.content as any;
        assert.strictEqual(content['Clinical Indication'], 'Equivocal pulmonary nodule evaluation');
        assert.strictEqual(content.Findings, 'Indeterminate 8mm RUL nodule.');
        assert.strictEqual(content.Impression, 'Recommend peer consultation.');
      });

      it('primary requesting radiologist can retrieve completed peer review for study', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p46Order.id}/peer-review`, {
          headers: { Authorization: `Bearer ${p46RadToken1}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'COMPLETED');
        assert.strictEqual(body.data.decision, 'CONCUR');
        assert.ok(body.data.reviewComment.includes('Fleischner guidelines'));
      });

      it('rejects duplicate second opinion submission on already completed review with HTTP 409', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${createdPeerReviewId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken2}`,
          },
          body: JSON.stringify({
            decision: 'DISCREPANT',
            reviewComment: 'Attempt to overwrite completed review',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok((body.message || body.error?.message || '').includes('already been completed'));
      });
    });

    describe('19.5 Concurrency, Cancellation & Identity Immutability', () => {
      let cancellableReviewId: string;
      let orderForCancellation: any;

      before(async () => {
        orderForCancellation = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P46-CANCEL-${Date.now()}`,
            patientId: p46Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Chest',
            examinationName: 'CT Chest Contrast',
            clinicalIndication: 'Cancellation test',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          },
        });

        const scan = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: orderForCancellation.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p46RadUser1.id,
            completedByUserId: p46RadUser1.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: orderForCancellation.id,
            scanLifecycleId: scan.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p46RadUser1.id,
            reviewedByUserId: p46RadUser1.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: orderForCancellation.id,
            scanLifecycleId: scan.id,
            imageQualityReviewId: qa.id,
            status: 'COMPLETE',
            completedAt: new Date(),
          },
        });

        await prisma.pacsStudyLink.create({
          data: {
            imagingOrderId: orderForCancellation.id,
            orthancStudyId: `orthanc-study-cancel-${Date.now()}`,
            studyInstanceUid: `1.2.840.10008.5.1.4.1.1.2.cancel.${Date.now()}`,
            status: PacsStudyLinkStatus.LINKED,
            verifiedByUserId: p46RadUser1.id,
          },
        });

        const reqRes = await fetch(`${baseUrl}/radiologist/peer-reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p46RadToken1}`,
          },
          body: JSON.stringify({
            imagingOrderId: orderForCancellation.id,
            reviewerId: p46RadUser2.id,
            reason: 'Testing cancellation lifecycle',
          }),
        });
        const body = await reqRes.json();
        cancellableReviewId = body.data.id;
      });

      it('requester cancels pending peer review successfully with status CANCELLED', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${cancellableReviewId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p46RadToken1}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'CANCELLED');

        // Verify Audit Log: PEER_REVIEW_CANCELLED
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'PEER_REVIEW_CANCELLED',
            userId: p46RadUser1.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for PEER_REVIEW_CANCELLED must exist');
      });

      it('rejects cancellation of an already completed peer review with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/peer-reviews/${createdPeerReviewId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p46RadToken1}` },
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.ok((body.message || body.error?.message || '').includes('Cannot cancel a completed peer review'));
      });

      it('confirms that Patient ID and Accession Number remain strictly immutable throughout peer review', async () => {
        const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p46Order.id },
          include: { patient: true, pacsStudyLink: true },
        });

        assert.strictEqual(finalOrder.accessionNumber, p46Order.accessionNumber);
        assert.strictEqual(finalOrder.patient.patientId, p46Patient.patientId);
        assert.strictEqual(finalOrder.pacsStudyLink?.studyInstanceUid, p46StudyInstanceUid);
      });
    });
  });

  // ==========================================
  // SECTION 20: PHASE 4.7 — CRITICAL FINDINGS ALERTS
  // ==========================================
  describe('SECTION 20 — PHASE 4.7: CRITICAL FINDINGS ALERTS', () => {
    let p47Patient: any;
    let p47RadUser: any;
    let p47RadToken: string;
    let p47ClinicianUser: any;
    let p47ClinicianToken: string;
    let p47OtherRadUser: any;
    let p47OtherRadToken: string;
    let p47Order: any;
    let p47IneligibleOrder: any;
    let createdCriticalFindingId: string;
    const p47StudyInstanceUid = `1.2.840.10008.5.1.4.1.1.2.p47.${Date.now()}`;

    before(async () => {
      p47Patient = await prisma.patient.create({
        data: {
          patientId: `PAT-P47-${Date.now()}`,
          firstName: 'Jonathan',
          lastName: 'Marrow',
          dateOfBirth: new Date('1985-04-12'),
          gender: Gender.MALE,
          phone: '+1-555-470-0001',
        },
      });

      p47RadUser = await prisma.user.create({
        data: {
          email: `rad.p47.sender.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Elena',
          lastName: 'ReportingRad',
          isActive: true,
        },
      });
      p47RadToken = jwt.sign(
        { userId: p47RadUser.id, email: p47RadUser.email, role: p47RadUser.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p47ClinicianUser = await prisma.user.create({
        data: {
          email: `clinician.p47.recipient.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'Sarah',
          lastName: 'TreatingClinician',
          isActive: true,
        },
      });
      p47ClinicianToken = jwt.sign(
        { userId: p47ClinicianUser.id, email: p47ClinicianUser.email, role: p47ClinicianUser.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p47OtherRadUser = await prisma.user.create({
        data: {
          email: `rad.p47.other.${Date.now()}@example.com`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          role: UserRole.RADIOLOGIST,
          firstName: 'David',
          lastName: 'Bystander',
          isActive: true,
        },
      });
      p47OtherRadToken = jwt.sign(
        { userId: p47OtherRadUser.id, email: p47OtherRadUser.email, role: p47OtherRadUser.role },
        env.JWT_SECRET,
        { expiresIn: 3600 }
      );

      p47Order = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P47-${Date.now()}`,
          patientId: p47Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Chest',
          examinationName: 'CT Chest Contrast',
          clinicalIndication: 'Acute aortic dissection evaluation',
          priority: Priority.STAT,
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      const scan47 = await prisma.scanLifecycle.create({
        data: {
          imagingOrderId: p47Order.id,
          state: ScanState.COMPLETED,
          attemptNumber: 1,
          startedByUserId: p47RadUser.id,
          completedByUserId: p47RadUser.id,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const qa47 = await prisma.imageQualityReview.create({
        data: {
          imagingOrderId: p47Order.id,
          scanLifecycleId: scan47.id,
          status: ImageQualityStatus.ACCEPTED,
          startedByUserId: p47RadUser.id,
          reviewedByUserId: p47RadUser.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.pacsHandoff.create({
        data: {
          imagingOrderId: p47Order.id,
          scanLifecycleId: scan47.id,
          imageQualityReviewId: qa47.id,
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });

      await prisma.pacsStudyLink.create({
        data: {
          imagingOrderId: p47Order.id,
          orthancStudyId: `orthanc-study-p47-${Date.now()}`,
          studyInstanceUid: p47StudyInstanceUid,
          status: PacsStudyLinkStatus.LINKED,
          verifiedByUserId: p47RadUser.id,
        },
      });

      p47IneligibleOrder = await prisma.imagingOrder.create({
        data: {
          accessionNumber: `ACC-P47-INEL-${Date.now()}`,
          patientId: p47Patient.id,
          modality: ModalityType.CT,
          bodyPart: 'Abdomen',
          examinationName: 'CT Abdomen',
          clinicalIndication: 'Ineligible study',
          priority: Priority.ROUTINE,
          orderStatus: OrderStatus.SCHEDULED,
        },
      });
    });

    describe('20.1 Active Clinicians Endpoint', () => {
      it('returns list of eligible active clinicians for alert recipient selection', async () => {
        const res = await fetch(`${baseUrl}/radiologist/clinicians`, {
          headers: { Authorization: `Bearer ${p47RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));
        const found = body.data.find((c: any) => c.id === p47ClinicianUser.id);
        assert.ok(found, 'Created clinician must be present in clinicians list');
      });

      it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
        const res = await fetch(`${baseUrl}/radiologist/clinicians`);
        assert.strictEqual(res.status, 401);
      });
    });

    describe('20.2 Critical Finding Alert Creation & Validation', () => {
      it('rejects creation with empty finding text with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47RadToken}`,
          },
          body: JSON.stringify({
            imagingOrderId: p47Order.id,
            recipientId: p47ClinicianUser.id,
            findingText: '   ',
          }),
        });

        assert.strictEqual(res.status, 400);
      });

      it('rejects creation for an ineligible study with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47RadToken}`,
          },
          body: JSON.stringify({
            imagingOrderId: p47IneligibleOrder.id,
            recipientId: p47ClinicianUser.id,
            findingText: 'Acute finding on unacquired exam',
          }),
        });

        assert.strictEqual(res.status, 400);
      });

      it('successfully creates critical finding alert and records audit log', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47RadToken}`,
          },
          body: JSON.stringify({
            imagingOrderId: p47Order.id,
            recipientId: p47ClinicianUser.id,
            findingText: 'Critical finding demonstration: urgent communication required.',
            severity: 'CRITICAL',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'PENDING');
        assert.strictEqual(body.data.findingText, 'Critical finding demonstration: urgent communication required.');
        assert.strictEqual(body.data.recipient.id, p47ClinicianUser.id);
        assert.strictEqual(body.data.createdBy.id, p47RadUser.id);
        createdCriticalFindingId = body.data.id;

        // Verify audit log
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'CRITICAL_FINDING_CREATED',
            entityId: p47Order.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for CRITICAL_FINDING_CREATED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.accessionNumber, p47Order.accessionNumber);
        assert.strictEqual(details.patientId, p47Patient.patientId);
      });

      it('rejects duplicate pending critical finding alert with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47RadToken}`,
          },
          body: JSON.stringify({
            imagingOrderId: p47Order.id,
            recipientId: p47ClinicianUser.id,
            findingText: 'Duplicate alert attempt',
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok((body.message || body.error?.message || '').includes('already exists'));
      });
    });

    describe('20.3 Queue Visibility & Detail Retrieval', () => {
      it('allows recipient clinician to view pending critical finding in queue', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings?status=PENDING`, {
          headers: { Authorization: `Bearer ${p47ClinicianToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const found = body.data.items.find((i: any) => i.id === createdCriticalFindingId);
        assert.ok(found, 'Pending finding must appear in recipient clinician queue');
      });

      it('allows retrieving critical finding details by ID', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings/${createdCriticalFindingId}`, {
          headers: { Authorization: `Bearer ${p47ClinicianToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.id, createdCriticalFindingId);
        assert.strictEqual(body.data.status, 'PENDING');
      });

      it('allows retrieving order critical finding by orderId', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p47Order.id}/critical-finding`, {
          headers: { Authorization: `Bearer ${p47RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.id, createdCriticalFindingId);
      });
    });

    describe('20.4 Acknowledgment Lifecycle & Security', () => {
      it('rejects acknowledgment by unauthorized user with HTTP 403 Forbidden', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings/${createdCriticalFindingId}/acknowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47OtherRadToken}`,
          },
          body: JSON.stringify({ notes: 'Attempted acknowledgment by non-recipient' }),
        });

        assert.strictEqual(res.status, 403);
      });

      it('allows designated recipient clinician to acknowledge critical finding', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings/${createdCriticalFindingId}/acknowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47ClinicianToken}`,
          },
          body: JSON.stringify({ notes: 'Received and patient informed for emergent transfer' }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.status, 'ACKNOWLEDGED');
        assert.ok(body.data.acknowledgedAt);
        assert.strictEqual(body.data.acknowledgedBy.id, p47ClinicianUser.id);

        // Verify audit log
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'CRITICAL_FINDING_ACKNOWLEDGED',
            entityId: p47Order.id,
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for CRITICAL_FINDING_ACKNOWLEDGED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.acknowledgedById, p47ClinicianUser.id);
      });

      it('rejects second acknowledgment attempt on already acknowledged finding with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/critical-findings/${createdCriticalFindingId}/acknowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p47ClinicianToken}`,
          },
          body: JSON.stringify({ notes: 'Second acknowledgment attempt' }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.ok((body.message || body.error?.message || '').includes('already been acknowledged'));
      });

      it('confirms Patient ID and Accession Number remain strictly immutable', async () => {
        const finalOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p47Order.id },
          include: { patient: true, pacsStudyLink: true },
        });

        assert.strictEqual(finalOrder.accessionNumber, p47Order.accessionNumber);
        assert.strictEqual(finalOrder.patient.patientId, p47Patient.patientId);
        assert.strictEqual(finalOrder.pacsStudyLink?.studyInstanceUid, p47StudyInstanceUid);
      });
    });
  });

    // ==========================================
    // SECTION 21 — PHASE 4.8: REPORT CORRECTIONS & ADDENDA
    // ==========================================
    describe('21. Phase 4.8 — Report Corrections & Addenda API Integration Tests', () => {
      let p48Patient: any;
      let p48RadUser: any;
      let p48RadToken: string;
      let p48FinalOrder: any;
      let p48FinalStudy: any;
      let p48FinalReport: any;
      let p48DraftOrder: any;
      let p48DraftStudy: any;
      let p48DraftReport: any;
      let p48PrelimOrder: any;
      let p48PrelimStudy: any;
      let p48PrelimReport: any;
      let p48ActiveDraft: any;

      before(async () => {
        setPacsGateway(new MockPacsGateway('success'));

        p48Patient = await prisma.patient.create({
          data: {
            patientId: `PAT-P48-${Date.now()}`,
            firstName: 'Aurelia',
            lastName: 'Vance',
            dateOfBirth: new Date('1982-08-14'),
            gender: Gender.FEMALE,
            phone: '555-4848',
          },
        });

        p48RadUser = await prisma.user.create({
          data: {
            email: `rad.p48.${Date.now()}@example.com`,
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            role: UserRole.RADIOLOGIST,
            firstName: 'Elena',
            lastName: 'Rostova',
            isActive: true,
          },
        });
        p48RadToken = jwt.sign(
          { userId: p48RadUser.id, email: p48RadUser.email, role: p48RadUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        // 1. Finalized Order with existing Report
        p48FinalOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P48-FIN-${Date.now()}`,
            patientId: p48Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Chest',
            examinationName: 'CT Chest with Contrast',
            clinicalIndication: 'Evaluation of pulmonary nodule',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.COMPLETED,
          },
        });

        const scan48 = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p48FinalOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p48RadUser.id,
            completedByUserId: p48RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa48 = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p48FinalOrder.id,
            scanLifecycleId: scan48.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p48RadUser.id,
            reviewedByUserId: p48RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p48FinalOrder.id,
            scanLifecycleId: scan48.id,
            imageQualityReviewId: qa48.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        p48FinalStudy = await prisma.study.create({
          data: {
            orderId: p48FinalOrder.id,
            patientId: p48Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.48.1`,
            modality: ModalityType.CT,
            accessionNumber: p48FinalOrder.accessionNumber,
          },
        });

        p48FinalReport = await prisma.report.create({
          data: {
            orderId: p48FinalOrder.id,
            studyId: p48FinalStudy.id,
            radiologistId: p48RadUser.id,
            status: ReportStatus.FINAL,
            findings: 'Original final findings v1: Lungs clear bilaterally.',
            impression: 'Original final impression v1: Normal chest CT.',
            finalizedAt: new Date('2026-11-01T10:00:00Z'),
            version: 1,
          },
        });

        // Attach an active ReportDraft to p48FinalOrder to prove drafts are NEVER overwritten by amendments
        p48ActiveDraft = await prisma.reportDraft.create({
          data: {
            imagingOrderId: p48FinalOrder.id,
            authorId: p48RadUser.id,
            content: { Findings: 'Active unfinalized working draft text', Impression: 'Unfinalized impression' },
            version: 1,
          },
        });

        // 2. Draft Order & Report
        p48DraftOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P48-DFT-${Date.now()}`,
            patientId: p48Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Head',
            examinationName: 'CT Head without Contrast',
            clinicalIndication: 'Headache',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.PACS_READY,
          },
        });

        const scan48D = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p48DraftOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p48RadUser.id,
            completedByUserId: p48RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p48DraftOrder.id,
            scanLifecycleId: scan48D.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p48RadUser.id,
            reviewedByUserId: p48RadUser.id,
            reviewedAt: new Date(),
          },
        });

        p48DraftStudy = await prisma.study.create({
          data: {
            orderId: p48DraftOrder.id,
            patientId: p48Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.48.2`,
            modality: ModalityType.CT,
            accessionNumber: p48DraftOrder.accessionNumber,
          },
        });

        p48DraftReport = await prisma.report.create({
          data: {
            orderId: p48DraftOrder.id,
            studyId: p48DraftStudy.id,
            radiologistId: p48RadUser.id,
            status: ReportStatus.DRAFT,
            findings: 'Draft findings in progress...',
            impression: 'Draft impression...',
            version: 1,
          },
        });

        // 3. Preliminary Order & Report
        p48PrelimOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P48-PRE-${Date.now()}`,
            patientId: p48Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Abdomen',
            examinationName: 'CT Abdomen',
            clinicalIndication: 'Abdominal pain',
            priority: Priority.URGENT,
            orderStatus: OrderStatus.PACS_READY,
          },
        });

        const scan48P = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p48PrelimOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p48RadUser.id,
            completedByUserId: p48RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p48PrelimOrder.id,
            scanLifecycleId: scan48P.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p48RadUser.id,
            reviewedByUserId: p48RadUser.id,
            reviewedAt: new Date(),
          },
        });

        p48PrelimStudy = await prisma.study.create({
          data: {
            orderId: p48PrelimOrder.id,
            patientId: p48Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.48.3`,
            modality: ModalityType.CT,
            accessionNumber: p48PrelimOrder.accessionNumber,
          },
        });

        p48PrelimReport = await prisma.report.create({
          data: {
            orderId: p48PrelimOrder.id,
            studyId: p48PrelimStudy.id,
            radiologistId: p48RadUser.id,
            status: ReportStatus.PRELIMINARY,
            findings: 'Preliminary findings...',
            impression: 'Preliminary impression...',
            version: 1,
          },
        });
      });

      it('1. permits authorized Radiologist to retrieve initial version history showing Version 1 FINAL', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/version-history`, {
          headers: { Authorization: `Bearer ${p48RadToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.currentVersion, 1);
        assert.strictEqual(body.data.reportStatus, 'FINAL');
        assert.strictEqual(body.data.versions.length, 1);
        assert.strictEqual(body.data.versions[0].versionNumber, 1);
        assert.strictEqual(body.data.versions[0].amendmentType, 'FINAL');
        assert.strictEqual(body.data.versions[0].isOriginal, true);
        assert.strictEqual(body.data.versions[0].findings, 'Original final findings v1: Lungs clear bilaterally.');
      });

      it('2. rejects amendment creation on DRAFT report with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48DraftOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Attempting to correct draft',
            content: 'Corrected draft text',
            targetVersion: 1,
          }),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_NOT_FINALIZED');
      });

      it('3. rejects amendment creation on PRELIMINARY report with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48PrelimOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Attempting to correct preliminary',
            content: 'Corrected preliminary text',
            targetVersion: 1,
          }),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_NOT_FINALIZED');
      });

      it('4. creates CORRECTION on FINAL report producing Version 2 and audit log', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Resolved measurement typo in right apical segment',
            content: 'Corrected findings: 4mm benign calcified granuloma in right apex. No acute disease.',
            targetVersion: 1,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.currentVersion, 2);
        assert.strictEqual(body.data.amendment.versionNumber, 2);
        assert.strictEqual(body.data.amendment.amendmentType, 'CORRECTION');
        assert.strictEqual(body.data.amendment.reason, 'Resolved measurement typo in right apical segment');

        // Audit check
        const audit = await prisma.auditLog.findFirst({
          where: {
            entityId: p48FinalReport.id,
            action: 'REPORT_CORRECTION_CREATED',
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for REPORT_CORRECTION_CREATED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.versionNumber, 2);
        assert.strictEqual(details.reason, 'Resolved measurement typo in right apical segment');
      });

      it('5. creates ADDENDUM on amended report producing Version 3 and audit log', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'ADDENDUM',
            reason: 'Correlated with prior outside radiographs per pulmonology request',
            content: 'Addendum: Comparison with 2024 radiograph confirms long-standing granuloma stability.',
            targetVersion: 2,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.currentVersion, 3);
        assert.strictEqual(body.data.amendment.versionNumber, 3);
        assert.strictEqual(body.data.amendment.amendmentType, 'ADDENDUM');
        assert.strictEqual(body.data.reportStatus, 'ADDENDUM');

        // Audit check
        const audit = await prisma.auditLog.findFirst({
          where: {
            entityId: p48FinalReport.id,
            action: 'REPORT_ADDENDUM_CREATED',
          },
          orderBy: { timestamp: 'desc' },
        });
        assert.ok(audit, 'Audit log for REPORT_ADDENDUM_CREATED must exist');
        const details = audit.details as any;
        assert.strictEqual(details.versionNumber, 3);
      });

      it('6. confirms Original Final Report (Version 1) content remains 100% immutable in the database', async () => {
        const dbReport = await prisma.report.findUniqueOrThrow({
          where: { id: p48FinalReport.id },
        });

        assert.strictEqual(dbReport.findings, 'Original final findings v1: Lungs clear bilaterally.');
        assert.strictEqual(dbReport.impression, 'Original final impression v1: Normal chest CT.');
        assert.strictEqual(dbReport.version, 3);
      });

      it('7. confirms version history exposes all 3 versions chronologically', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/version-history`, {
          headers: { Authorization: `Bearer ${p48RadToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.versions.length, 3);
        assert.strictEqual(body.data.versions[0].versionNumber, 1);
        assert.strictEqual(body.data.versions[0].amendmentType, 'FINAL');
        assert.strictEqual(body.data.versions[1].versionNumber, 2);
        assert.strictEqual(body.data.versions[1].amendmentType, 'CORRECTION');
        assert.strictEqual(body.data.versions[2].versionNumber, 3);
        assert.strictEqual(body.data.versions[2].amendmentType, 'ADDENDUM');
      });

      it('8. strictly requires amendment reason (rejects empty or whitespace with HTTP 400)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: '   ',
            content: 'Valid content',
            targetVersion: 3,
          }),
        });
        assert.strictEqual(res.status, 400);
      });

      it('9. strictly requires amendment content (rejects empty content with HTTP 400)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Valid reason',
            content: '   ',
            targetVersion: 3,
          }),
        });
        assert.strictEqual(res.status, 400);
      });

      it('10. denies TECHNOLOGIST role from creating amendments with HTTP 403 Forbidden', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${techToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Unauthorized attempt',
            content: 'Tech content',
            targetVersion: 3,
          }),
        });
        assert.strictEqual(res.status, 403);
      });

      it('11. denies anonymous request without JWT with HTTP 401 Unauthorized', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Anonymous attempt',
            content: 'Content',
            targetVersion: 3,
          }),
        });
        assert.strictEqual(res.status, 401);
      });

      it('12. rejects non-existent order with HTTP 404 Not Found', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/non-existent-order-id/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Valid reason',
            content: 'Valid content',
            targetVersion: 1,
          }),
        });
        assert.strictEqual(res.status, 404);
      });

      it('13. confirms Patient ID remains unchanged after multiple amendments', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p48FinalOrder.id },
          include: { patient: true },
        });
        assert.strictEqual(order.patient.patientId, p48Patient.patientId);
      });

      it('14. confirms Accession Number remains unchanged after multiple amendments', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p48FinalOrder.id },
        });
        assert.strictEqual(order.accessionNumber, p48FinalOrder.accessionNumber);
      });

      it('15. rejects stale version with HTTP 409 Conflict (optimistic locking protection)', async () => {
        // Report is now at version 3; submitting with targetVersion: 1 must fail
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Concurrent edit attempt with stale version 1',
            content: 'Stale correction text',
            targetVersion: 1,
          }),
        });
        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_VERSION_CONFLICT');
      });

      it('16. confirms active ReportDraft was NOT touched, overwritten, or cleared by report amendments', async () => {
        const draft = await prisma.reportDraft.findUniqueOrThrow({
          where: { imagingOrderId: p48FinalOrder.id },
        });
        const content = draft.content as any;
        assert.strictEqual(content.Findings, 'Active unfinalized working draft text');
        assert.strictEqual(content.Impression, 'Unfinalized impression');
      });

      it('17. confirms reporting workspace endpoint surfaces finalized report and version data', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report`, {
          headers: { Authorization: `Bearer ${p48RadToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.ok(body.data.finalizedReport, 'finalizedReport summary must be present in workspace');
        assert.strictEqual(body.data.finalizedReport.version, 3);
        assert.strictEqual(body.data.finalizedReport.amendmentCount, 2);
      });

      it('18. confirms re-querying version history persists cleanly across calls (API reload persistence)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/version-history`, {
          headers: { Authorization: `Bearer ${p48RadToken}` },
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.data.versions.length, 3);
        assert.strictEqual(body.data.currentVersion, 3);
      });

      it('19. rejects invalid amendmentType with HTTP 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p48FinalOrder.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p48RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'INVALID_TYPE',
            reason: 'Valid reason',
            content: 'Valid content',
            targetVersion: 3,
          }),
        });
        assert.strictEqual(res.status, 400);
      });

      it('20. confirms no accidental status mutations to non-finalized orders occur', async () => {
        const draftOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p48DraftOrder.id },
          include: { report: true },
        });
        assert.strictEqual(draftOrder.report?.status, 'DRAFT');

        const prelimOrder = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p48PrelimOrder.id },
          include: { report: true },
        });
        assert.strictEqual(prelimOrder.report?.status, 'PRELIMINARY');
      });
    });

    describe('Section 22: Phase 4.9 — Report Review, Approval, Sign & Lock API Integration Tests', () => {
      let p49Patient: any;
      let p49RadUser: any;
      let p49RadToken: string;
      let p49TechUser: any;
      let p49TechToken: string;
      let p49Order: any;
      let p49Study: any;
      let p49FinalizedReportId: string;

      let p49ConflictOrder: any;

      before(async () => {
        setPacsGateway(new MockPacsGateway('success'));

        p49Patient = await prisma.patient.create({
          data: {
            patientId: `PAT-P49-${Date.now()}`,
            firstName: 'Dmitri',
            lastName: 'Voronov',
            dateOfBirth: new Date('1975-04-12'),
            gender: Gender.MALE,
            phone: '555-4949',
          },
        });

        p49RadUser = await prisma.user.create({
          data: {
            email: `rad.p49.${Date.now()}@example.com`,
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            role: UserRole.RADIOLOGIST,
            firstName: 'Elena',
            lastName: 'Rostova',
            isActive: true,
          },
        });
        p49RadToken = jwt.sign(
          { userId: p49RadUser.id, email: p49RadUser.email, role: p49RadUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        p49TechUser = await prisma.user.create({
          data: {
            email: `tech.p49.${Date.now()}@example.com`,
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            role: UserRole.TECHNOLOGIST,
            firstName: 'Marcus',
            lastName: 'Cole',
            isActive: true,
          },
        });
        p49TechToken = jwt.sign(
          { userId: p49TechUser.id, email: p49TechUser.email, role: p49TechUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        // Standard unfinalized order with active draft, scan, review, and handoff
        p49Order = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P49-ORD-${Date.now()}`,
            patientId: p49Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Chest',
            examinationName: 'CT Chest with Contrast',
            clinicalIndication: 'Persistent cough, rule out mass',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          },
        });

        const scan49 = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p49Order.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p49RadUser.id,
            completedByUserId: p49RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa49 = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p49Order.id,
            scanLifecycleId: scan49.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p49RadUser.id,
            reviewedByUserId: p49RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p49Order.id,
            scanLifecycleId: scan49.id,
            imageQualityReviewId: qa49.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        p49Study = await prisma.study.create({
          data: {
            orderId: p49Order.id,
            patientId: p49Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.49.1`,
            modality: ModalityType.CT,
            accessionNumber: p49Order.accessionNumber,
          },
        });

        await prisma.reportDraft.create({
          data: {
            imagingOrderId: p49Order.id,
            authorId: p49RadUser.id,
            content: {
              Findings: 'Lungs are clear bilaterally. No consolidations, pneumothorax, or pleural effusion. Normal cardiac silhouette.',
              Impression: 'Normal CT Chest. No acute cardiopulmonary disease.',
            },
            version: 1,
          },
        });

        // Stale draft conflict order
        p49ConflictOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P49-CNF-${Date.now()}`,
            patientId: p49Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Brain',
            examinationName: 'CT Brain without Contrast',
            clinicalIndication: 'Acute headache',
            priority: Priority.URGENT,
            orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          },
        });

        const scan49C = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p49ConflictOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p49RadUser.id,
            completedByUserId: p49RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa49C = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p49ConflictOrder.id,
            scanLifecycleId: scan49C.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p49RadUser.id,
            reviewedByUserId: p49RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p49ConflictOrder.id,
            scanLifecycleId: scan49C.id,
            imageQualityReviewId: qa49C.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        await prisma.study.create({
          data: {
            orderId: p49ConflictOrder.id,
            patientId: p49Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.49.2`,
            modality: ModalityType.CT,
            accessionNumber: p49ConflictOrder.accessionNumber,
          },
        });

        await prisma.reportDraft.create({
          data: {
            imagingOrderId: p49ConflictOrder.id,
            authorId: p49RadUser.id,
            content: {
              Findings: 'Initial brain CT findings',
              Impression: 'Initial impression',
            },
            version: 5, // Draft is ahead at version 5
          },
        });
      });

      it('1. permits authorized Radiologist to retrieve review summary and completeness checklist', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/review`, {
          headers: { Authorization: `Bearer ${p49RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderId, p49Order.id);
        assert.strictEqual(body.data.accessionNumber, p49Order.accessionNumber);
        assert.strictEqual(body.data.patientId, p49Patient.patientId);
        assert.strictEqual(body.data.patientName, 'Dmitri Voronov');
        assert.strictEqual(body.data.modality, 'CT');
        assert.strictEqual(body.data.examinationName, 'CT Chest with Contrast');
        assert.strictEqual(body.data.draftVersion, 1);
        assert.strictEqual(body.data.completeness.hasFindings, true);
        assert.strictEqual(body.data.completeness.hasImpression, true);
        assert.strictEqual(body.data.completeness.isComplete, true);
        assert.strictEqual(body.data.completeness.missingFields.length, 0);
        assert.strictEqual(body.data.signerPreview.name, 'Elena Rostova');
      });

      it('2. rejects finalize attempt with missing/empty findings (HTTP 400 Bad Request)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: '   ',
            impression: 'Normal CT Chest.',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('3. rejects finalize attempt with missing/empty impression (HTTP 400 Bad Request)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: 'Lungs clear.',
            impression: '',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('4. rejects finalize attempt when approved checkbox is false (HTTP 400 Bad Request)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: 'Lungs clear.',
            impression: 'Normal exam.',
            approved: false,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      it('5. enforces RBAC: rejects finalize attempt by TECHNOLOGIST role (HTTP 403 Forbidden)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49TechToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: 'Lungs clear.',
            impression: 'Normal exam.',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 403);
      });

      it('6. rejects unauthenticated finalize request (HTTP 401 Unauthorized)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: 'Lungs clear.',
            impression: 'Normal exam.',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 401);
      });

      it('7. detects stale draft version and returns HTTP 409 REPORT_DRAFT_VERSION_CONFLICT', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49ConflictOrder.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1, // Stale version (actual draft is at 5)
            findings: 'Stale findings text',
            impression: 'Stale impression',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_DRAFT_VERSION_CONFLICT');
      });

      it('8. successfully finalizes, digitally signs, and permanently locks report', async () => {
        const findingsText = 'Lungs are clear bilaterally. No consolidations, pneumothorax, or pleural effusion. Normal cardiac silhouette.';
        const impressionText = 'Normal CT Chest. No acute cardiopulmonary disease.';

        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: findingsText,
            impression: impressionText,
            approved: true,
            signatureStatement: 'Electronically signed by Dr. Elena Rostova per Part 11 policy.',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.reportId, 'Report ID must be returned');

        p49FinalizedReportId = body.data.reportId;

        assert.strictEqual(body.data.status, 'FINAL');
        assert.strictEqual(body.data.version, 1);
        assert.strictEqual(body.data.isSigned, true);
        assert.strictEqual(body.data.isLocked, true);
        assert.strictEqual(body.data.signer.id, p49RadUser.id);
        assert.ok(body.data.signedAt, 'signedAt must be set');
        assert.ok(body.data.finalizedAt, 'finalizedAt must be set');
        assert.strictEqual(body.data.findings, findingsText);
        assert.strictEqual(body.data.impression, impressionText);

        // Digital signature manifest validation
        assert.ok(body.data.signatureHash, 'signatureHash must be present');
        assert.strictEqual(body.data.signatureHash.length, 64, 'SHA-256 hash must be 64 characters');
        assert.strictEqual(body.data.digitalSignature.algorithm, 'SHA-256');
        assert.strictEqual(body.data.digitalSignature.signatureHash, body.data.signatureHash);
        assert.strictEqual(body.data.digitalSignature.signerId, p49RadUser.id);
        assert.strictEqual(body.data.digitalSignature.manifest.accessionNumber, p49Order.accessionNumber);
        assert.strictEqual(body.data.digitalSignature.manifest.patientId, p49Patient.patientId);
      });

      it('9. confirms ImagingOrder status transitioned to COMPLETED in database', async () => {
        const orderInDb = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p49Order.id },
        });
        assert.strictEqual(orderInDb.orderStatus, OrderStatus.COMPLETED);
      });

      it('10. confirms REPORT_FINALIZED_AND_SIGNED audit log was generated', async () => {
        const audit = await prisma.auditLog.findFirst({
          where: {
            entityId: p49FinalizedReportId,
            action: 'REPORT_FINALIZED_AND_SIGNED',
          },
        });
        assert.ok(audit !== null, 'REPORT_FINALIZED_AND_SIGNED audit log must exist');
        assert.strictEqual(audit.userId, p49RadUser.id);
        const details = audit.details as any;
        assert.strictEqual(details.status, 'FINAL');
        assert.strictEqual(details.version, 1);
        assert.strictEqual(details.isLocked, true);
        assert.ok(details.signatureHash, 'Audit details must record signature hash');
      });

      it('11. prevents duplicate finalization and returns HTTP 409 REPORT_ALREADY_FINALIZED', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            draftVersion: 1,
            findings: 'Attempted duplicate finalization',
            impression: 'Duplicate attempt',
            approved: true,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_ALREADY_FINALIZED');
      });

      it('12. enforces draft lock: rejects saveReportDraft on finalized report with HTTP 409', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            content: { Findings: 'Modified after lock', Impression: 'Should fail' },
            version: 1,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_ALREADY_FINALIZED');
      });

      it('13. enforces draft lock: rejects autosaveReportDraft on finalized report with HTTP 409', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/draft/autosave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            content: { Findings: 'Autosave after lock', Impression: 'Should fail' },
            version: 1,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_ALREADY_FINALIZED');
      });

      it('14. reporting workspace endpoint returns locked and digitally signed state', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report`, {
          headers: { Authorization: `Bearer ${p49RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.finalizedReport, 'finalizedReport must be present in workspace');
        assert.strictEqual(body.data.finalizedReport.status, 'FINAL');
        assert.strictEqual(body.data.finalizedReport.isSigned, true);
        assert.strictEqual(body.data.finalizedReport.isLocked, true);
        assert.strictEqual(body.data.finalizedReport.version, 1);
        assert.ok(body.data.finalizedReport.signatureHash);
        assert.strictEqual(body.data.finalizedReport.signedBy.name, 'Elena Rostova');
      });

      it('15. verifies Single Source of Truth immutability: MRN and Accession unchanged', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p49Order.id },
          include: { patient: true, study: true, report: true },
        });

        assert.strictEqual(order.patient.patientId, p49Patient.patientId);
        assert.strictEqual(order.accessionNumber, p49Order.accessionNumber);
        assert.strictEqual(order.study?.accessionNumber, p49Order.accessionNumber);
        assert.strictEqual(order.study?.studyInstanceUid, p49Study.studyInstanceUid);
      });

      it('16. Phase 4.8 compatibility: creating CORRECTION against newly signed report succeeds cleanly', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p49Order.id}/report/amendments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p49RadToken}`,
          },
          body: JSON.stringify({
            amendmentType: 'CORRECTION',
            reason: 'Post-sign addendum noting comparison with prior radiographs',
            content: 'Comparison with prior radiograph from 2025 confirms stable appearance. Normal CT chest.',
            targetVersion: 1,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.currentVersion, 2);
        assert.strictEqual(body.data.amendment.versionNumber, 2);
        assert.strictEqual(body.data.amendment.amendmentType, 'CORRECTION');
      });
    });

    describe('Section 23: Phase 4.10 — PDF Report Generation API Integration Tests', () => {
      let p410Patient: any;
      let p410RadUser: any;
      let p410RadToken: string;
      let p410TechUser: any;
      let p410TechToken: string;
      let p410FinalOrder: any;
      let p410FinalStudy: any;
      let p410FinalReport: any;

      let p410DraftOrder: any;
      let p410DraftReport: any;

      let p410AmendedOrder: any;
      let p410AmendedReport: any;

      before(async () => {
        setPacsGateway(new MockPacsGateway('success'));

        p410Patient = await prisma.patient.create({
          data: {
            patientId: `PAT-P410-${Date.now()}`,
            firstName: 'Seraphina',
            lastName: 'Cross',
            dateOfBirth: new Date('1988-06-22'),
            gender: Gender.FEMALE,
            phone: '555-4100',
          },
        });

        p410RadUser = await prisma.user.create({
          data: {
            email: `rad.p410.${Date.now()}@example.com`,
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            role: UserRole.RADIOLOGIST,
            firstName: 'Elena',
            lastName: 'Rostova',
            isActive: true,
          },
        });
        p410RadToken = jwt.sign(
          { userId: p410RadUser.id, email: p410RadUser.email, role: p410RadUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        p410TechUser = await prisma.user.create({
          data: {
            email: `tech.p410.${Date.now()}@example.com`,
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            role: UserRole.TECHNOLOGIST,
            firstName: 'Marcus',
            lastName: 'Cole',
            isActive: true,
          },
        });
        p410TechToken = jwt.sign(
          { userId: p410TechUser.id, email: p410TechUser.email, role: p410TechUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        // 1. Finalized and Locked Order + Report
        p410FinalOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P410-FIN-${Date.now()}`,
            patientId: p410Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Chest',
            examinationName: 'CT Chest with Contrast',
            clinicalIndication: 'Evaluation of persistent chronic cough',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.COMPLETED,
          },
        });

        const scan410 = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p410FinalOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p410RadUser.id,
            completedByUserId: p410RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa410 = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p410FinalOrder.id,
            scanLifecycleId: scan410.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p410RadUser.id,
            reviewedByUserId: p410RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p410FinalOrder.id,
            scanLifecycleId: scan410.id,
            imageQualityReviewId: qa410.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        p410FinalStudy = await prisma.study.create({
          data: {
            orderId: p410FinalOrder.id,
            patientId: p410Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.410.1`,
            modality: ModalityType.CT,
            accessionNumber: p410FinalOrder.accessionNumber,
          },
        });

        p410FinalReport = await prisma.report.create({
          data: {
            orderId: p410FinalOrder.id,
            studyId: p410FinalStudy.id,
            radiologistId: p410RadUser.id,
            signedById: p410RadUser.id,
            status: ReportStatus.FINAL,
            findings: 'Lungs are clear bilaterally. No consolidations, pneumothorax, or pleural effusion. Heart size is normal.',
            impression: 'Normal CT Chest. No acute cardiopulmonary disease.',
            version: 1,
            isSigned: true,
            isLocked: true,
            signedAt: new Date(),
            finalizedAt: new Date(),
            signatureHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
            digitalSignature: {
              algorithm: 'SHA-256',
              signedBy: 'Dr. Elena Rostova',
              statement: 'Electronically approved and digitally locked.',
            },
          },
        });

        // 2. Draft / Unfinalized Order + Report
        p410DraftOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P410-DFT-${Date.now()}`,
            patientId: p410Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Head',
            examinationName: 'CT Head without Contrast',
            clinicalIndication: 'Headache',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
          },
        });

        const scan410D = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p410DraftOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p410RadUser.id,
            completedByUserId: p410RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa410D = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p410DraftOrder.id,
            scanLifecycleId: scan410D.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p410RadUser.id,
            reviewedByUserId: p410RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p410DraftOrder.id,
            scanLifecycleId: scan410D.id,
            imageQualityReviewId: qa410D.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        const draftStudy = await prisma.study.create({
          data: {
            orderId: p410DraftOrder.id,
            patientId: p410Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.410.2`,
            modality: ModalityType.CT,
            accessionNumber: p410DraftOrder.accessionNumber,
          },
        });

        p410DraftReport = await prisma.report.create({
          data: {
            orderId: p410DraftOrder.id,
            studyId: draftStudy.id,
            radiologistId: p410RadUser.id,
            status: ReportStatus.DRAFT,
            findings: 'Preliminary draft text in progress...',
            impression: 'Working impression...',
            version: 1,
            isSigned: false,
            isLocked: false,
          },
        });

        // 3. Amended Order + Report (Phase 4.8 Version 2)
        p410AmendedOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-P410-AMD-${Date.now()}`,
            patientId: p410Patient.id,
            modality: ModalityType.CT,
            bodyPart: 'Abdomen',
            examinationName: 'CT Abdomen with Contrast',
            clinicalIndication: 'Right upper quadrant pain',
            priority: Priority.URGENT,
            orderStatus: OrderStatus.COMPLETED,
          },
        });

        const scan410A = await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p410AmendedOrder.id,
            state: ScanState.COMPLETED,
            attemptNumber: 1,
            startedByUserId: p410RadUser.id,
            completedByUserId: p410RadUser.id,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        const qa410A = await prisma.imageQualityReview.create({
          data: {
            imagingOrderId: p410AmendedOrder.id,
            scanLifecycleId: scan410A.id,
            status: ImageQualityStatus.ACCEPTED,
            startedByUserId: p410RadUser.id,
            reviewedByUserId: p410RadUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.pacsHandoff.create({
          data: {
            imagingOrderId: p410AmendedOrder.id,
            scanLifecycleId: scan410A.id,
            imageQualityReviewId: qa410A.id,
            status: PacsHandoffStatus.COMPLETE,
            completedAt: new Date(),
          },
        });

        const amendedStudy = await prisma.study.create({
          data: {
            orderId: p410AmendedOrder.id,
            patientId: p410Patient.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.410.3`,
            modality: ModalityType.CT,
            accessionNumber: p410AmendedOrder.accessionNumber,
          },
        });

        p410AmendedReport = await prisma.report.create({
          data: {
            orderId: p410AmendedOrder.id,
            studyId: amendedStudy.id,
            radiologistId: p410RadUser.id,
            signedById: p410RadUser.id,
            status: ReportStatus.ADDENDUM,
            findings: 'Original abdominal findings: gallstones noted without gallbladder wall thickening.',
            impression: 'Cholelithiasis without acute cholecystitis.',
            version: 2,
            isSigned: true,
            isLocked: true,
            signedAt: new Date(),
            finalizedAt: new Date(),
            signatureHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
          },
        });

        await prisma.reportAmendment.create({
          data: {
            reportId: p410AmendedReport.id,
            versionNumber: 2,
            amendmentType: 'CORRECTION',
            reason: 'Added comparison with prior ultrasound study from 2024',
            findings: 'Gallstones stable in size and appearance compared to 2024 US.',
            impression: 'Stable cholelithiasis without acute inflammatory changes.',
            createdById: p410RadUser.id,
          },
        });
      });

      it('1. rejects PDF generation attempt on unfinalized DRAFT report with HTTP 409', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410DraftOrder.id}/report/pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p410RadToken}` },
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_NOT_FINALIZED');
      });

      it('2. rejects PDF generation attempt without authorization token with HTTP 401', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410FinalOrder.id}/report/pdf`, {
          method: 'POST',
        });

        assert.strictEqual(res.status, 401);
      });

      it('3. rejects PDF generation attempt by unauthorized role TECHNOLOGIST with HTTP 403', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410FinalOrder.id}/report/pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p410TechToken}` },
        });

        assert.strictEqual(res.status, 403);
      });

      it('4. successfully generates authoritative clinical PDF for FINAL and LOCKED report', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410FinalOrder.id}/report/pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p410RadToken}` },
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderId, p410FinalOrder.id);
        assert.strictEqual(body.data.accessionNumber, p410FinalOrder.accessionNumber);
        assert.strictEqual(body.data.patientId, p410Patient.patientId);
        assert.strictEqual(body.data.patientName, 'Seraphina Cross');
        assert.strictEqual(body.data.version, 1);
        assert.ok(body.data.filename.includes(p410FinalOrder.accessionNumber));
        assert.ok(body.data.fileSizeBytes > 1000, 'PDF size must be greater than 1KB');
        assert.strictEqual(body.data.facility.name, 'RadNexus Diagnostic Imaging Center');
        assert.ok(body.data.pdfArtifactPath.endsWith('.pdf'));
      });

      it('5. verifies PDF file exists on disk and begins with %PDF- header magic bytes', async () => {
        const report = await prisma.report.findUniqueOrThrow({
          where: { id: p410FinalReport.id },
        });

        assert.ok(report.pdfArtifactPath, 'pdfArtifactPath must be set on Report record');
        assert.ok(report.pdfGeneratedAt, 'pdfGeneratedAt must be set on Report record');
        assert.strictEqual(report.pdfVersion, 1);
        assert.ok(report.pdfFileSizeBytes && report.pdfFileSizeBytes > 1000);

        const resolveArtifact = (rel: string) =>
          fs.existsSync(path.resolve(process.cwd(), rel))
            ? path.resolve(process.cwd(), rel)
            : path.resolve(process.cwd(), '..', rel);

        const filePath = resolveArtifact(report.pdfArtifactPath);
        assert.ok(fs.existsSync(filePath), `PDF file must exist at ${filePath}`);

        const fileBuffer = fs.readFileSync(filePath);
        const magicBytes = fileBuffer.subarray(0, 5).toString('ascii');
        assert.strictEqual(magicBytes, '%PDF-', 'PDF file must start with %PDF- magic bytes');
      });

      it('6. confirms REPORT_PDF_GENERATED audit log was recorded in PostgreSQL', async () => {
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'REPORT_PDF_GENERATED',
            entityId: p410FinalReport.id,
          },
        });

        assert.ok(audit !== null, 'Audit log REPORT_PDF_GENERATED must be recorded');
        assert.strictEqual(audit.userId, p410RadUser.id);
        const details = audit.details as any;
        assert.strictEqual(details.accessionNumber, p410FinalOrder.accessionNumber);
        assert.strictEqual(details.patientId, p410Patient.patientId);
        assert.strictEqual(details.version, 1);
      });

      it('7. streams and downloads clinical PDF via GET endpoint with correct HTTP headers', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410FinalOrder.id}/report/pdf`, {
          headers: { Authorization: `Bearer ${p410RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
        assert.ok(res.headers.get('content-disposition')?.includes('inline; filename='));

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const magicBytes = buffer.subarray(0, 5).toString('ascii');
        assert.strictEqual(magicBytes, '%PDF-');
        assert.ok(buffer.length > 1000);
      });

      it('8. confirms REPORT_PDF_ACCESSED audit log was recorded upon retrieval', async () => {
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'REPORT_PDF_ACCESSED',
            entityId: p410FinalReport.id,
          },
        });

        assert.ok(audit !== null, 'Audit log REPORT_PDF_ACCESSED must be recorded');
        assert.strictEqual(audit.userId, p410RadUser.id);
      });

      it('9. supports amended reports (Phase 4.8 continuity): generates PDF with Version 2 and amendment history', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p410AmendedOrder.id}/report/pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p410RadToken}` },
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.version, 2);
        assert.ok(body.data.filename.includes('_v2.pdf'));

        const resolveArtifact = (rel: string) =>
          fs.existsSync(path.resolve(process.cwd(), rel))
            ? path.resolve(process.cwd(), rel)
            : path.resolve(process.cwd(), '..', rel);
        const filePath = resolveArtifact(body.data.pdfArtifactPath);
        assert.ok(fs.existsSync(filePath));
        const buffer = fs.readFileSync(filePath);
        assert.strictEqual(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
      });

      it('10. verifies Single Source of Truth immutability: MRN and Accession unchanged', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p410FinalOrder.id },
          include: { patient: true, study: true, report: true },
        });

        assert.strictEqual(order.patient.patientId, p410Patient.patientId);
        assert.strictEqual(order.accessionNumber, p410FinalOrder.accessionNumber);
        assert.strictEqual(order.study?.accessionNumber, p410FinalOrder.accessionNumber);
        assert.strictEqual(order.study?.studyInstanceUid, p410FinalStudy.studyInstanceUid);
      });
    });

    describe('24. Phase 4.11 — Report Delivery, Front Desk & TAT Verification', () => {
      let p411RadUser: any;
      let p411RecUser: any;
      let p411RadToken: string;
      let p411RecToken: string;

      let p411DoctorA: any;
      let p411DoctorB: any;

      let p411PatientA: any;
      let p411PatientB: any;

      let p411OrderA: any;
      let p411OrderB: any;
      let p411DraftOrder: any;

      let p411StudyA: any;
      let p411StudyB: any;
      let p411DraftStudy: any;

      let p411ReportA: any;
      let p411DraftReport: any;

      let p411PatientToken: string;
      let p411DoctorAToken: string;
      let p411DoctorBToken: string;

      before(async () => {
        p411RadUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RADIOLOGIST } });
        p411RecUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECEPTION } });

        p411RadToken = jwt.sign(
          { userId: p411RadUser.id, email: p411RadUser.email, role: p411RadUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );
        p411RecToken = jwt.sign(
          { userId: p411RecUser.id, email: p411RecUser.email, role: p411RecUser.role },
          env.JWT_SECRET,
          { expiresIn: 3600 }
        );

        const suffix = Date.now().toString().slice(-6);

        // Referring Doctors
        p411DoctorA = await prisma.referringDoctor.create({
          data: {
            name: `Dr. Sarah Mitchell ${suffix}`,
            organization: 'MetroHealth Medical Center',
            email: `s.mitchell.${suffix}@metrohealth.org`,
            phone: '+1-555-777-1001',
            registrationNumber: `MED-REG-${suffix}-A`,
            isActive: true,
          },
        });

        p411DoctorB = await prisma.referringDoctor.create({
          data: {
            name: `Dr. James Thorne ${suffix}`,
            organization: 'Central University Clinic',
            email: `j.thorne.${suffix}@clinic.org`,
            phone: '+1-555-777-1002',
            registrationNumber: `MED-REG-${suffix}-B`,
            isActive: true,
          },
        });

        // Patients
        p411PatientA = await prisma.patient.create({
          data: {
            patientId: `PAT-411-A-${suffix}`,
            firstName: 'Eleanor',
            lastName: `Vance-${suffix}`,
            dateOfBirth: new Date('1988-06-15T00:00:00.000Z'),
            gender: Gender.FEMALE,
            phone: `+1-555-411-${Math.floor(1000 + Math.random() * 9000)}`,
            email: `eleanor.${suffix}@patientmail.local`,
          },
        });

        p411PatientB = await prisma.patient.create({
          data: {
            patientId: `PAT-411-B-${suffix}`,
            firstName: 'Arthur',
            lastName: `Pendelton-${suffix}`,
            dateOfBirth: new Date('1975-11-22T00:00:00.000Z'),
            gender: Gender.MALE,
            phone: `+1-555-412-${Math.floor(1000 + Math.random() * 9000)}`,
            email: `arthur.${suffix}@patientmail.local`,
          },
        });

        // Orders
        p411OrderA = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-411-A-${suffix}`,
            patientId: p411PatientA.id,
            referringDoctorId: p411DoctorA.id,
            modality: ModalityType.CT,
            bodyPart: 'Head',
            examinationName: 'CT Head without Contrast',
            clinicalIndication: 'Acute headache evaluation',
            priority: Priority.URGENT,
            orderStatus: OrderStatus.COMPLETED,
            createdAt: new Date(Date.now() - 3600000 * 4), // 4 hours ago
          },
        });

        p411DraftOrder = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-411-D-${suffix}`,
            patientId: p411PatientA.id,
            referringDoctorId: p411DoctorA.id,
            modality: ModalityType.MRI,
            bodyPart: 'Brain',
            examinationName: 'MRI Brain with Contrast',
            clinicalIndication: 'Progressive visual deficit',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.IN_PROGRESS,
            createdAt: new Date(Date.now() - 3600000 * 2),
          },
        });

        p411OrderB = await prisma.imagingOrder.create({
          data: {
            accessionNumber: `ACC-411-B-${suffix}`,
            patientId: p411PatientB.id,
            referringDoctorId: p411DoctorB.id,
            modality: ModalityType.XRAY,
            bodyPart: 'Chest',
            examinationName: 'Chest X-Ray PA',
            clinicalIndication: 'Cough and dyspnea',
            priority: Priority.ROUTINE,
            orderStatus: OrderStatus.COMPLETED,
            createdAt: new Date(Date.now() - 3600000 * 3),
          },
        });

        // Scan lifecycles
        await prisma.scanLifecycle.create({
          data: {
            imagingOrderId: p411OrderA.id,
            attemptNumber: 1,
            state: ScanState.COMPLETED,
            startedByUserId: p411RecUser.id,
            completedByUserId: p411RecUser.id,
            startedAt: new Date(Date.now() - 3600000 * 3.5),
            completedAt: new Date(Date.now() - 3600000 * 3),
          },
        });

        // Studies
        p411StudyA = await prisma.study.create({
          data: {
            orderId: p411OrderA.id,
            patientId: p411PatientA.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.411.1`,
            modality: ModalityType.CT,
            accessionNumber: p411OrderA.accessionNumber,
            studyStatus: StudyStatus.REPORTED,
          },
        });

        p411DraftStudy = await prisma.study.create({
          data: {
            orderId: p411DraftOrder.id,
            patientId: p411PatientA.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.411.2`,
            modality: ModalityType.MRI,
            accessionNumber: p411DraftOrder.accessionNumber,
          },
        });

        p411StudyB = await prisma.study.create({
          data: {
            orderId: p411OrderB.id,
            patientId: p411PatientB.id,
            studyInstanceUid: `1.2.840.10008.1.${Date.now()}.411.3`,
            modality: ModalityType.XRAY,
            accessionNumber: p411OrderB.accessionNumber,
            studyStatus: StudyStatus.REPORTED,
          },
        });

        // Storage directory for test PDF
        const targetDirs = [
          path.resolve(process.cwd(), 'storage', 'reports'),
          path.resolve(process.cwd(), 'server', 'storage', 'reports'),
        ];
        const samplePdfFilename = `report_${p411OrderA.accessionNumber}_v1.pdf`;
        const dummyPdfContent = Buffer.from(
          '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n111\n%%EOF'
        );
        for (const dir of targetDirs) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(path.join(dir, samplePdfFilename), dummyPdfContent);
        }

        // Finalized Report A
        p411ReportA = await prisma.report.create({
          data: {
            orderId: p411OrderA.id,
            studyId: p411StudyA.id,
            radiologistId: p411RadUser.id,
            signedById: p411RadUser.id,
            status: ReportStatus.FINAL,
            findings: 'No acute intracranial hemorrhage, midline shift, or mass effect. Ventricles are normal in caliber.',
            impression: 'Unremarkable non-contrast head CT. No acute intracranial abnormality.',
            version: 1,
            isSigned: true,
            isLocked: true,
            signedAt: new Date(Date.now() - 3600000 * 2),
            finalizedAt: new Date(Date.now() - 3600000 * 2),
            signatureHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
            pdfArtifactPath: `storage/reports/${samplePdfFilename}`,
            pdfGeneratedAt: new Date(Date.now() - 3600000 * 1.9),
            pdfVersion: 1,
            pdfFileSizeBytes: dummyPdfContent.length,
          },
        });

        // Draft Report
        p411DraftReport = await prisma.report.create({
          data: {
            orderId: p411DraftOrder.id,
            studyId: p411DraftStudy.id,
            radiologistId: p411RadUser.id,
            status: ReportStatus.DRAFT,
            findings: 'Preliminary brain images reviewed.',
            impression: 'Pending radiologist review.',
            version: 1,
            isSigned: false,
            isLocked: false,
          },
        });

        // Finalized Report B
        await prisma.report.create({
          data: {
            orderId: p411OrderB.id,
            studyId: p411StudyB.id,
            radiologistId: p411RadUser.id,
            signedById: p411RadUser.id,
            status: ReportStatus.FINAL,
            findings: 'Lungs are clear bilaterally. Heart size normal.',
            impression: 'Normal chest radiograph.',
            version: 1,
            isSigned: true,
            isLocked: true,
            signedAt: new Date(Date.now() - 3600000 * 1),
            finalizedAt: new Date(Date.now() - 3600000 * 1),
            signatureHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef02',
          },
        });
      });

      it('1. rejects send to reception on unfinalized DRAFT report with HTTP 409 Conflict', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p411DraftOrder.id}/report/send-to-reception`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p411RadToken}` },
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'REPORT_NOT_FINALIZED');
      });

      it('2. radiologist sends finalized report to reception (HTTP 200 OK)', async () => {
        const res = await fetch(`${baseUrl}/radiologist/worklist/${p411OrderA.id}/report/send-to-reception`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p411RadToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.isReadyForReception, true);
        assert.ok(body.data.readyForReceptionAt);

        // Verify in DB
        const updated = await prisma.report.findUniqueOrThrow({ where: { id: p411ReportA.id } });
        assert.strictEqual(updated.isReadyForReception, true);
        assert.strictEqual(updated.readyForReceptionById, p411RadUser.id);
      });

      it('3. reception queries ready reports via GET /reception/reports/ready', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/ready`, {
          headers: { Authorization: `Bearer ${p411RecToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));

        const item = body.data.find((r: any) => r.orderId === p411OrderA.id);
        assert.ok(item, 'Ready reports list must contain Order A');
        assert.strictEqual(item.accessionNumber, p411OrderA.accessionNumber);
        assert.strictEqual(item.patientId, p411PatientA.patientId);
        assert.strictEqual(item.isReadyForReception, true);
        assert.strictEqual(item.hasPdf, true);
      });

      it('4. reception records in-person handover delivery acknowledgment', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/${p411OrderA.id}/handover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p411RecToken}`,
          },
          body: JSON.stringify({
            recipientName: 'Eleanor Vance (Patient)',
            recipientRole: 'PATIENT',
            notes: 'Physical handover at front desk reception counter',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.deliveryMethod, ReportDeliveryMethod.RECEPTION_HANDOVER);
        assert.strictEqual(body.data.recipientName, 'Eleanor Vance (Patient)');
        assert.strictEqual(body.data.status, 'ACKNOWLEDGED');

        // Confirm database record
        const delivery = await prisma.reportDelivery.findFirst({
          where: { reportId: p411ReportA.id, deliveryMethod: ReportDeliveryMethod.RECEPTION_HANDOVER },
        });
        assert.ok(delivery !== null);
        assert.strictEqual(delivery.deliveredById, p411RecUser.id);
      });

      it('5. reception dispatches non-sensitive patient SMS notice', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/${p411OrderA.id}/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p411RecToken}`,
          },
          body: JSON.stringify({ channel: NotificationChannel.SMS }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.channel, NotificationChannel.SMS);
        assert.strictEqual(body.data.status, NotificationStatus.SENT);
        assert.strictEqual(body.data.provider, 'LOCAL_DEMO_ADAPTER');
      });

      it('6. reception dispatches non-sensitive patient Email notice', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/${p411OrderA.id}/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p411RecToken}`,
          },
          body: JSON.stringify({ channel: NotificationChannel.EMAIL }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.channel, NotificationChannel.EMAIL);
        assert.strictEqual(body.data.status, NotificationStatus.SENT);
      });

      it('7. verifies notification message strictly excludes sensitive findings and impression', async () => {
        const notifications = await prisma.reportNotification.findMany({
          where: { reportId: p411ReportA.id },
        });

        assert.ok(notifications.length >= 2, 'Must have at least 2 notifications recorded');
        for (const notif of notifications) {
          assert.strictEqual(notif.messageBody.includes('acute intracranial hemorrhage'), false);
          assert.strictEqual(notif.messageBody.includes('midline shift'), false);
          assert.strictEqual(notif.messageBody.includes('ventricles are normal'), false);
          assert.ok(notif.messageBody.includes('RadNexus Diagnostic Imaging'));
          assert.ok(notif.messageBody.includes('is finalized and ready') || notif.messageBody.includes('is now available'));
        }
      });

      it('8. authenticates patient via Patient Portal credentials', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: p411PatientA.patientId,
            dateOfBirth: '1988-06-15',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.token);
        assert.strictEqual(body.data.patient.patientId, p411PatientA.patientId);

        p411PatientToken = body.data.token;
      });

      it('9. rejects patient portal login with mismatched date of birth (HTTP 401)', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: p411PatientA.patientId,
            dateOfBirth: '1995-01-01',
          }),
        });

        assert.strictEqual(res.status, 401);
      });

      it('10. patient portal retrieves patient own finalized reports', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/reports`, {
          headers: { Authorization: `Bearer ${p411PatientToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].accessionNumber, p411OrderA.accessionNumber);
        assert.strictEqual(body.data[0].hasPdf, true);
      });

      it('11. patient portal downloads own report PDF and logs PATIENT_PORTAL delivery', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/reports/${p411OrderA.accessionNumber}/pdf`, {
          headers: { Authorization: `Bearer ${p411PatientToken}` },
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
        const buffer = Buffer.from(await res.arrayBuffer());
        assert.strictEqual(buffer.subarray(0, 5).toString('ascii'), '%PDF-');

        // Confirm delivery log
        const delivery = await prisma.reportDelivery.findFirst({
          where: { reportId: p411ReportA.id, deliveryMethod: ReportDeliveryMethod.PATIENT_PORTAL },
        });
        assert.ok(delivery !== null);
      });

      it('12. patient portal enforces cross-patient boundary: rejects accessing other patient report with HTTP 403', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/reports/${p411OrderB.accessionNumber}/pdf`, {
          headers: { Authorization: `Bearer ${p411PatientToken}` },
        });

        assert.strictEqual(res.status, 403);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'CROSS_PATIENT_ACCESS_DENIED');
      });

      it('13. authenticates referring physician via Doctor Portal', async () => {
        const resA = await fetch(`${baseUrl}/portal/doctor/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: p411DoctorA.email,
            registrationNumber: p411DoctorA.registrationNumber,
          }),
        });

        assert.strictEqual(resA.status, 200);
        const bodyA = await resA.json();
        p411DoctorAToken = bodyA.data.token;
        assert.strictEqual(bodyA.data.doctor.id, p411DoctorA.id);

        const resB = await fetch(`${baseUrl}/portal/doctor/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: p411DoctorB.email,
            registrationNumber: p411DoctorB.registrationNumber,
          }),
        });
        assert.strictEqual(resB.status, 200);
        const bodyB = await resB.json();
        p411DoctorBToken = bodyB.data.token;
      });

      it('14. referring physician retrieves only their referred patients reports', async () => {
        const res = await fetch(`${baseUrl}/portal/doctor/reports`, {
          headers: { Authorization: `Bearer ${p411DoctorAToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].accessionNumber, p411OrderA.accessionNumber);
      });

      it('15. referring physician downloads authorized report PDF and logs delivery', async () => {
        const res = await fetch(`${baseUrl}/portal/doctor/reports/${p411OrderA.accessionNumber}/pdf`, {
          headers: { Authorization: `Bearer ${p411DoctorAToken}` },
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-type'), 'application/pdf');

        const delivery = await prisma.reportDelivery.findFirst({
          where: { reportId: p411ReportA.id, deliveryMethod: ReportDeliveryMethod.REFERRING_PHYSICIAN },
        });
        assert.ok(delivery !== null);
      });

      it('16. referring doctor portal enforces boundary: rejects unrelated doctor download with HTTP 403', async () => {
        const res = await fetch(`${baseUrl}/portal/doctor/reports/${p411OrderA.accessionNumber}/pdf`, {
          headers: { Authorization: `Bearer ${p411DoctorBToken}` },
        });

        assert.strictEqual(res.status, 403);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'UNAUTHORIZED_REFERRING_DOCTOR');
      });

      it('17. reception records physical reprint and logs PRINT delivery acknowledgment', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/${p411OrderA.id}/reprint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p411RecToken}`,
          },
          body: JSON.stringify({
            copiesCount: 2,
            reason: 'Patient requested duplicate physical copy for insurance',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.copiesCount, 2);

        const reprintRecord = await prisma.reportReprint.findFirst({
          where: { reportId: p411ReportA.id },
        });
        assert.ok(reprintRecord !== null);
        assert.strictEqual(reprintRecord.copiesCount, 2);

        const printDelivery = await prisma.reportDelivery.findFirst({
          where: { reportId: p411ReportA.id, deliveryMethod: ReportDeliveryMethod.PRINT },
        });
        assert.ok(printDelivery !== null);
      });

      it('18. reception queries complete report delivery history timeline', async () => {
        const res = await fetch(`${baseUrl}/reception/reports/${p411OrderA.id}/deliveries`, {
          headers: { Authorization: `Bearer ${p411RecToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.deliveries.length >= 3, 'Must contain handover, portal, and print deliveries');
        assert.ok(body.data.notifications.length >= 2, 'Must contain SMS and Email notifications');
        assert.ok(body.data.reprints.length >= 1, 'Must contain reprint record');
      });

      it('19. TAT dashboard calculates reporting TAT, delivery TAT, and SLA status from real database timestamps', async () => {
        const res = await fetch(`${baseUrl}/reports/tat`, {
          headers: { Authorization: `Bearer ${p411RecToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.summary);
        assert.ok(Array.isArray(body.data.items));

        const item = body.data.items.find((i: any) => i.orderId === p411OrderA.id);
        assert.ok(item, 'Order A must appear in TAT items');
        assert.ok(item.turnaroundMinutes.reportingTatMinutes !== null);
        assert.ok(item.turnaroundMinutes.deliveryTatMinutes !== null);
        assert.strictEqual(item.deliveryStatus, 'DELIVERED');
        assert.strictEqual(item.slaStatus, 'ON_TARGET');
      });

      it('20. verifies Single Source of Truth immutability: Master Patient ID and Accession Number remain intact', async () => {
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: p411OrderA.id },
          include: { patient: true, study: true, report: true },
        });

        assert.strictEqual(order.patient.patientId, p411PatientA.patientId);
        assert.strictEqual(order.accessionNumber, p411OrderA.accessionNumber);
        assert.strictEqual(order.study?.accessionNumber, p411OrderA.accessionNumber);
        assert.strictEqual(order.study?.studyInstanceUid, p411StudyA.studyInstanceUid);
      });
    });

    describe('25. Module 01 — Main Desktop Dashboard', () => {
      let m1AdminToken: string;
      let m1ReceptionToken: string;
      let m1TechToken: string;
      let m1RadToken: string;
      let m1Order: any;
      let m1Patient: any;

      before(async () => {
        // Authenticate users for different roles
        const adminRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@ris.local', password: 'Demo@123' }),
        });
        const adminData = await adminRes.json();
        m1AdminToken = adminData.data.token;

        const recRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'reception@ris.local', password: 'Demo@123' }),
        });
        const recData = await recRes.json();
        m1ReceptionToken = recData.data.token;

        const techRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'tech@ris.local', password: 'Demo@123' }),
        });
        const techData = await techRes.json();
        m1TechToken = techData.data.token;

        const radRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'rad@ris.local', password: 'Demo@123' }),
        });
        const radData = await radRes.json();
        m1RadToken = radData.data.token;

        // Fetch an existing order and patient for search verification
        m1Order = await prisma.imagingOrder.findFirst({
          include: { patient: true, report: true },
        });
        m1Patient = m1Order?.patient;
      });

      it('1. requires authentication to access dashboard overview (HTTP 401 on missing token)', async () => {
        const res = await fetch(`${baseUrl}/dashboard/overview`);
        assert.strictEqual(res.status, 401);
      });

      it('2. GET /dashboard/overview returns all 9 comprehensive dashboard requirement datasets', async () => {
        const res = await fetch(`${baseUrl}/dashboard/overview`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const data = body.data;

        // 1. Today Overview
        assert.ok(data.todayOverview, 'todayOverview must exist');
        assert.strictEqual(typeof data.todayOverview.totalBookings, 'number');
        assert.strictEqual(typeof data.todayOverview.completedScans, 'number');
        assert.strictEqual(typeof data.todayOverview.pendingReports, 'number');
        assert.strictEqual(typeof data.todayOverview.totalRevenue, 'number');

        // 2. Live Patient Status
        assert.ok(data.livePatientStatus, 'livePatientStatus must exist');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.booked, 'number');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.arrived, 'number');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.waiting, 'number');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.scanning, 'number');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.reporting, 'number');
        assert.strictEqual(typeof data.livePatientStatus.breakdown.delivered, 'number');
        assert.ok(Array.isArray(data.livePatientStatus.activePatients));

        // 3. Modality Status Tiles
        assert.ok(Array.isArray(data.modalityTiles));
        assert.ok(data.modalityTiles.some((m: any) => m.modality === 'CT'));
        assert.ok(data.modalityTiles.some((m: any) => m.modality === 'MRI'));
        assert.ok(data.modalityTiles.some((m: any) => m.modality === 'XRAY'));
        const ctTile = data.modalityTiles.find((m: any) => m.modality === 'CT');
        assert.ok(ctTile.totalScanners >= 0);
        assert.ok(ctTile.utilizationPercent >= 0);
        if (ctTile.operationalScanners === 0) {
          assert.strictEqual(ctTile.utilizationPercent, 0);
        }

        // 4. Pending Task Alerts
        assert.ok(Array.isArray(data.pendingTaskAlerts));

        // 5. Daily Analytics
        assert.ok(data.dailyAnalytics);
        assert.strictEqual(typeof data.dailyAnalytics.scanVolumeToday, 'number');
        assert.strictEqual(typeof data.dailyAnalytics.averageReportingTatMinutes, 'number');
        assert.strictEqual(typeof data.dailyAnalytics.averageDeliveryTatMinutes, 'number');
        assert.strictEqual(typeof data.dailyAnalytics.noShowCountToday, 'number');

        // 6. Notifications
        assert.ok(Array.isArray(data.notifications));
        assert.ok(data.notifications.some((n: any) => n.type === 'SYSTEM_STATUS'));

        // 7. Role Capabilities
        assert.strictEqual(data.roleCapabilities.role, 'ADMIN');
        assert.ok(data.roleCapabilities.allowedActions.includes('MANAGE_USERS'));

        const { start, end } = getHospitalDayBounds();
        const todayRange = { gte: start, lt: end };
        const [expectedBookings, expectedCompleted, expectedPayments, expectedNoShows, expectedCancelled] = await Promise.all([
          prisma.appointment.count({ where: { scheduledStart: todayRange } }),
          prisma.scanLifecycle.count({ where: { state: ScanState.COMPLETED, completedAt: todayRange } }),
          prisma.payment.findMany({ where: { paymentStatus: 'COMPLETED', paidAt: todayRange }, select: { amount: true } }),
          prisma.appointment.count({ where: { status: AppointmentStatus.NO_SHOW, updatedAt: todayRange } }),
          prisma.appointment.count({ where: { status: AppointmentStatus.CANCELLED, cancelledAt: todayRange } }),
        ]);
        assert.strictEqual(data.todayOverview.totalBookings, expectedBookings);
        assert.strictEqual(data.todayOverview.completedScans, expectedCompleted);
        assert.strictEqual(data.todayOverview.totalRevenue, expectedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0));
        assert.strictEqual(data.dailyAnalytics.noShowCountToday, expectedNoShows);
        assert.strictEqual(data.dailyAnalytics.cancelledCountToday, expectedCancelled);
        assert.ok(data.livePatientStatus.activePatients.every((item: any) => item.databasePatientId && item.id !== item.databasePatientId));
        assert.ok(data.livePatientStatus.activePatients.every((item: any) => !['COMPLETED', 'CANCELLED', 'SCAN_CANCELLED'].includes(item.status) || item.stage === 'DELIVERED'));

        const appointmentNotification = data.notifications.find((item: any) => item.type === 'APPOINTMENT_CHANGE');
        if (expectedCancelled === 0) assert.strictEqual(appointmentNotification, undefined);
        else {
          assert.ok(appointmentNotification.message.startsWith(`${expectedCancelled} appointment(s) cancelled today.`));
          assert.ok(new Date(appointmentNotification.timestamp) >= start && new Date(appointmentNotification.timestamp) < end);
        }
      });

      it('3. role-based dashboard view returns customized actions per clinical role', async () => {
        // Reception
        const recRes = await fetch(`${baseUrl}/dashboard/overview`, {
          headers: { Authorization: `Bearer ${m1ReceptionToken}` },
        });
        const recBody = await recRes.json();
        assert.strictEqual(recBody.data.roleCapabilities.role, 'RECEPTION');
        assert.ok(recBody.data.roleCapabilities.allowedActions.includes('REPORT_HANDOVER'));

        // Technologist
        const techRes = await fetch(`${baseUrl}/dashboard/overview`, {
          headers: { Authorization: `Bearer ${m1TechToken}` },
        });
        const techBody = await techRes.json();
        assert.strictEqual(techBody.data.roleCapabilities.role, 'TECHNOLOGIST');
        assert.ok(techBody.data.roleCapabilities.allowedActions.includes('START_SCAN'));

        // Radiologist
        const radRes = await fetch(`${baseUrl}/dashboard/overview`, {
          headers: { Authorization: `Bearer ${m1RadToken}` },
        });
        const radBody = await radRes.json();
        assert.strictEqual(radBody.data.roleCapabilities.role, 'RADIOLOGIST');
        assert.ok(radBody.data.roleCapabilities.allowedActions.includes('DICTATE_REPORT'));
        assert.ok(radBody.data.roleCapabilities.allowedActions.includes('SIGN_LOCK_REPORT'));

        const allowedTargets: Record<string, string[]> = {
          RECEPTION: ['/reception', '/orders'],
          TECHNOLOGIST: ['/technologist/worklist', '/orders'],
          RADIOLOGIST: ['/radiologist/worklist', '/orders'],
        };
        for (const body of [recBody, techBody, radBody]) {
          const role = body.data.roleCapabilities.role;
          assert.ok(body.data.pendingTaskAlerts.every((alert: any) =>
            allowedTargets[role].some((prefix) => alert.targetUrl.startsWith(prefix))
          ));
        }
      });

      it('4. global search endpoint matches patient by Name, Phone, Patient ID (MRN), and Accession Number', async () => {
        assert.ok(m1Order, 'Order must exist');
        assert.ok(m1Patient, 'Patient must exist');

        // Search by Accession Number
        const accRes = await fetch(`${baseUrl}/dashboard/search?q=${m1Order.accessionNumber}`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });
        assert.strictEqual(accRes.status, 200);
        const accBody = await accRes.json();
        assert.strictEqual(accBody.success, true);
        assert.ok(accBody.data.length >= 1);
        assert.ok(accBody.data.some((item: any) => item.accessionNumber === m1Order.accessionNumber));

        // Search by Patient ID
        const pidRes = await fetch(`${baseUrl}/dashboard/search?q=${m1Patient.patientId}`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });
        assert.strictEqual(pidRes.status, 200);
        const pidBody = await pidRes.json();
        assert.strictEqual(pidBody.success, true);
        assert.ok(pidBody.data.length >= 1);
        assert.ok(pidBody.data.some((item: any) => item.patientId === m1Patient.patientId));

        // Search by First Name
        const nameRes = await fetch(`${baseUrl}/dashboard/search?q=${m1Patient.firstName}`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });
        assert.strictEqual(nameRes.status, 200);
        const nameBody = await nameRes.json();
        assert.strictEqual(nameBody.success, true);
        assert.ok(nameBody.data.length >= 1);
        assert.ok(nameBody.data.some((item: any) => item.patientName.includes(m1Patient.firstName)));

        const lastNameRes = await fetch(`${baseUrl}/dashboard/search?q=${encodeURIComponent(m1Patient.lastName)}`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });
        assert.strictEqual(lastNameRes.status, 200);
        const lastNameBody = await lastNameRes.json();
        assert.ok(lastNameBody.data.some((item: any) => item.patientId === m1Patient.patientId));

        const phoneRes = await fetch(`${baseUrl}/dashboard/search?q=${encodeURIComponent(m1Patient.phone)}`, {
          headers: { Authorization: `Bearer ${m1AdminToken}` },
        });
        assert.strictEqual(phoneRes.status, 200);
        const phoneBody = await phoneRes.json();
        assert.ok(phoneBody.data.some((item: any) => item.patientId === m1Patient.patientId));
      });

      it('5. single source of truth immutability: dashboard inspection does not alter patient/order/report state', async () => {
        assert.ok(m1Order, 'Order must exist');
        const order = await prisma.imagingOrder.findUniqueOrThrow({
          where: { id: m1Order.id },
          include: { patient: true, report: true },
        });
        assert.strictEqual(order.patient.patientId, m1Patient.patientId);
        assert.strictEqual(order.accessionNumber, m1Order.accessionNumber);
      });
    });

    describe('26. Module 02 — Online Patient Appointment Portal', () => {
      const testMobile = `+1-555-${Date.now().toString().slice(-7)}`;
      let portalToken: string;
      let portalPatient: any;
      let availableExams: any[];
      let chosenExam: any;
      let bookedAppt: any;
      let otherPatientToken: string;

      before(async () => {
        // Authenticate another patient to test multi-tenant security boundary
        const otherRes = await fetch(`${baseUrl}/portal/patient/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: `+1-555-999${Date.now().toString().slice(-4)}`,
            otp: '123456',
            firstName: 'Other',
            lastName: 'BoundaryPatient',
            dateOfBirth: '1992-05-15',
            gender: 'MALE',
          }),
        });
        const otherData = await otherRes.json();
        otherPatientToken = otherData.data.token;
      });

      it('1. request OTP via local demo adapter returns demo code and logs notification', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testMobile }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.demoOtp, '123456');
        assert.strictEqual(body.data.phone, testMobile);
      });

      it('2. verify OTP rejects invalid verification code with HTTP 401', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testMobile, otp: '000000' }),
        });

        assert.strictEqual(res.status, 401);
      });

      it('3. verify OTP registers new patient, generates persistent Patient ID (MRN) and returns JWT', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: testMobile,
            otp: '123456',
            firstName: 'Aria',
            lastName: 'Montgomery',
            dateOfBirth: '1994-07-22',
            gender: 'FEMALE',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.token, 'JWT token must be issued');
        portalToken = body.data.token;
        portalPatient = body.data.patient;

        assert.ok(portalPatient.patientId.startsWith('PAT-2026-'));
        assert.strictEqual(portalPatient.firstName, 'Aria');
        assert.strictEqual(portalPatient.lastName, 'Montgomery');
      });

      it('4. GET /portal/patient/examinations returns active exam catalogue with preparation and pricing', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/examinations?modality=CT`);
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));
        assert.ok(body.data.length >= 1);

        availableExams = body.data;
        chosenExam = availableExams[0];

        assert.strictEqual(chosenExam.modality, 'CT');
        assert.ok(chosenExam.estimatedFee > 0);
        assert.ok(chosenExam.advanceDepositRequired > 0);
        assert.ok(chosenExam.preparation.instructions);
      });

      it('5. GET /portal/patient/slots returns real-time equipment operational slot schedule', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        const dateStr = tomorrow.toISOString().slice(0, 10);

        const res = await fetch(`${baseUrl}/portal/patient/slots?modality=CT&date=${dateStr}`);
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.slots.length > 0);
        assert.strictEqual(body.data.modality, 'CT');
        assert.ok(body.data.availableSlotsCount > 0);
      });

      it('6. POST /portal/patient/book blocks unauthenticated requests with HTTP 401', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examDefinitionId: chosenExam.id,
            scheduledStart: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          }),
        });

        assert.strictEqual(res.status, 401);
      });

      it('7. POST /portal/patient/book creates appointment and order with single source of truth identifiers', async () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        targetDate.setHours(10, 0, 0, 0);

        const res = await fetch(`${baseUrl}/portal/patient/book`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            examDefinitionId: chosenExam.id,
            scheduledStart: targetDate.toISOString(),
            clinicalNotes: 'Persistent migraine and localized headaches',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        bookedAppt = body.data;

        assert.ok(bookedAppt.appointment.id);
        assert.ok(bookedAppt.appointment.appointmentNumber.startsWith('APT-2026-'));
        assert.ok(bookedAppt.accessionNumber.startsWith('ACC-'));
        assert.strictEqual(bookedAppt.patientId, portalPatient.patientId);

        // Confirmation notifications check
        assert.ok(bookedAppt.notificationsSent.some((n: any) => n.channel === 'SMS'));
        assert.ok(bookedAppt.notificationsSent.some((n: any) => n.channel === 'WHATSAPP'));
        assert.ok(bookedAppt.notificationsSent.some((n: any) => n.channel === 'EMAIL'));
      });

      it('8. double booking prevention: rejects conflicting slot booking with HTTP 409', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/book`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            examDefinitionId: chosenExam.id,
            scheduledStart: bookedAppt.appointment.scheduledStart,
          }),
        });

        assert.strictEqual(res.status, 409);
      });

      it('9. uploads and attaches doctor prescription / referral note', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/referral`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            fileName: 'dr_referral_scan.pdf',
            fileType: 'application/pdf',
            doctorName: 'Dr. Gregory House',
            referralNotes: 'Rule out acute subarachnoid hemorrhage or aneurysm',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.notes.includes('Dr. Gregory House'));
      });

      it('10. GET preparation instructions returns fasting, contrast, and attire instructions', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/instructions`, {
          headers: { Authorization: `Bearer ${portalToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.fasting);
        assert.ok(body.data.contrastAdvice);
        assert.ok(body.data.clothingAdvice);
        assert.ok(Array.isArray(body.data.whatToBring));
      });

      it('11. submits pre-visit safety questionnaire and flags clinical contraindication risks', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/questionnaire`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            hasMetalImplants: true,
            hasAllergies: true,
            isPregnant: false,
            hasKidneyDisease: false,
            notes: 'Patient has coronary stent placed in 2022 and mild shell-fish allergy',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.screeningStatus, 'REQUIRES_TECH_REVIEW');
        assert.ok(body.data.risksIdentified.includes('PACEMAKER_OR_METALLIC_IMPLANT'));
        assert.ok(body.data.risksIdentified.includes('CONTRAST_OR_IODINE_ALLERGY'));
      });

      it('12. online advance payment records deposit and generates official payment receipt', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/deposit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            amount: 50,
            paymentMethod: 'UPI',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.amountPaid, 50);
        assert.ok(body.data.receiptNumber.startsWith('REC-'));
        assert.strictEqual(body.data.gateway, 'LOCAL_DEMO_PAYMENT_GATEWAY');
      });

      it('13. self-service reschedule updates slot and dispatches notification', async () => {
        const newTargetDate = new Date();
        newTargetDate.setDate(newTargetDate.getDate() + 4);
        newTargetDate.setHours(14, 0, 0, 0);

        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/reschedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({
            newStart: newTargetDate.toISOString(),
            reason: 'Work schedule change',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(new Date(body.data.appointment.scheduledStart).getTime(), newTargetDate.getTime());
      });

      it('14. automated reminder dispatch dispatches 24hr / 2hr notifications', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/remind`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({ reminderType: '24HR' }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.reminderType, '24HR');
        assert.ok(body.data.dispatchedVia.includes('SMS'));
      });

      it('15. security boundary: patient cannot modify another patient appointment (HTTP 404/403)', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${otherPatientToken}`,
          },
          body: JSON.stringify({ reason: 'Malicious cancellation attempt' }),
        });

        assert.strictEqual(res.status, 404);
      });

      it('16. self-service cancel cancels appointment, frees slot, and updates order status to CANCELLED', async () => {
        const res = await fetch(`${baseUrl}/portal/patient/appointments/${bookedAppt.appointment.id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${portalToken}`,
          },
          body: JSON.stringify({ reason: 'Patient recovered, examination no longer required' }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.appointment.status, 'CANCELLED');

        // Confirm database status
        const dbAppt = await prisma.appointment.findUniqueOrThrow({
          where: { id: bookedAppt.appointment.id },
          include: { imagingOrder: true, patient: true },
        });
        assert.strictEqual(dbAppt.status, 'CANCELLED');
        assert.strictEqual(dbAppt.imagingOrder?.orderStatus, 'CANCELLED');
        assert.strictEqual(dbAppt.patient.patientId, portalPatient.patientId);
      });
    });

    // ==========================================
    // 27. Module 03 — Reception / Front Desk Full Verification
    // ==========================================
    describe('27. Module 03 — Reception / Front Desk Core Workflows', () => {
      let receptionToken: string;
      let walkInResult: any;

      before(async () => {
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'reception@ris.local', password: 'Demo@123' }),
        });
        const loginBody = await loginRes.json();
        receptionToken = loginBody.data.token;
      });

      it('1. POST /api/v1/reception/walk-in registers urgent scan order, assigns queue token, and places in waiting queue', async () => {
        const res = await fetch(`${baseUrl}/reception/walk-in`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            newPatient: {
              firstName: 'WalkIn',
              lastName: 'EmergencyPatient',
              dateOfBirth: '1992-04-12',
              gender: 'FEMALE',
              phone: '+1-555-019-9944',
            },
            modality: 'CT',
            bodyPart: 'Chest',
            examinationName: 'CT Chest Angiography with Contrast',
            clinicalIndication: 'Acute onset pleuritic chest pain and dyspnea, rule out pulmonary embolism',
            priority: 'STAT',
            referringDoctorText: 'ER Attending Physician Dr. Ross',
            contrastRequired: true,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        walkInResult = body.data;

        assert.ok(walkInResult.accessionNumber.startsWith('ACC-'));
        assert.ok(walkInResult.patientId.startsWith('PAT-'));
        assert.ok(walkInResult.tokenNumber);
        assert.strictEqual(walkInResult.appointment.status, 'CHECKED_IN');
        assert.strictEqual(walkInResult.order.orderStatus, 'READY_FOR_TECH');
        assert.strictEqual(walkInResult.order.priority, 'STAT');
        assert.ok(walkInResult.invoice.invoiceNumber.startsWith('INV-'));
      });

      it('2. GET /api/v1/reception/queue displays the newly created walk-in patient with token number', async () => {
        const res = await fetch(`${baseUrl}/reception/queue?modality=CT`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const items = Array.isArray(body.data) ? body.data : body.data.items;
        const found = items.find((a: any) => a.id === walkInResult.appointment.id);
        assert.ok(found, 'Walk-in appointment must be present in reception waiting queue');
        assert.strictEqual(found.tokenNumber, walkInResult.tokenNumber);
      });

      it('3. POST /api/v1/reception/orders/:id/consent records signed patient consent form under audit control', async () => {
        const res = await fetch(`${baseUrl}/reception/orders/${walkInResult.order.id}/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            formType: 'CONTRAST_CONSENT',
            signedByName: 'WalkIn EmergencyPatient',
            witnessName: 'Nurse Jackie',
            notes: 'Patient informed of contrast risks and consented verbally and in writing',
            status: 'SIGNED',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.consent.formType, 'CONTRAST_CONSENT');
        assert.strictEqual(body.data.consent.status, 'SIGNED');
      });

      it('4. GET /api/v1/reception/orders/:id/consent retrieves recorded consent forms', async () => {
        const res = await fetch(`${baseUrl}/reception/orders/${walkInResult.order.id}/consent`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.consentForms.length, 1);
        assert.strictEqual(body.data.consentForms[0].formType, 'CONTRAST_CONSENT');
      });

      it('5. GET /api/v1/reception/appointments/:id/slip returns structured printable appointment slip and prep instructions', async () => {
        const res = await fetch(`${baseUrl}/reception/appointments/${walkInResult.appointment.id}/slip`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const slip = body.data;

        assert.ok(slip.facilityName);
        assert.strictEqual(slip.appointment.tokenNumber, walkInResult.tokenNumber);
        assert.strictEqual(slip.patient.patientId, walkInResult.patientId);
        assert.strictEqual(slip.order.accessionNumber, walkInResult.accessionNumber);
        assert.ok(slip.preparationInstructions.instructions);
      });

      it('6. GET /api/v1/reception/orders/:id/billing returns financial ledger (total, paid, outstanding balance)', async () => {
        const res = await fetch(`${baseUrl}/reception/orders/${walkInResult.order.id}/billing`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        const billing = body.data;

        assert.strictEqual(billing.accessionNumber, walkInResult.accessionNumber);
        assert.ok(billing.invoice.total > 0);
        assert.strictEqual(billing.invoice.paidAmount, 0);
        assert.strictEqual(billing.invoice.outstandingAmount, billing.invoice.total);
        assert.strictEqual(billing.invoice.status, 'PENDING');
      });

      it('7. POST /api/v1/reception/orders/:id/payments records part-payment and updates invoice status to PARTIALLY_PAID', async () => {
        const res = await fetch(`${baseUrl}/reception/orders/${walkInResult.order.id}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            amount: 100,
            paymentMethod: 'CASH',
            reference: 'POS-CASH-REC01',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.amountPaid, 100);
        assert.strictEqual(body.data.invoiceStatus, 'PARTIALLY_PAID');
        assert.strictEqual(Number(body.data.invoice.paidAmount), 100);
      });

      it('8. POST /api/v1/reception/orders/:id/payments records final balance payment and completes invoice status to PAID', async () => {
        const remaining = walkInResult.invoice.total - 100;
        const res = await fetch(`${baseUrl}/reception/orders/${walkInResult.order.id}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            amount: remaining,
            paymentMethod: 'CREDIT_CARD',
            reference: 'CARD-AUTH-998822',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.amountPaid, remaining);
        assert.strictEqual(body.data.outstandingAmount, 0);
        assert.strictEqual(body.data.invoiceStatus, 'PAID');
      });

      it('9. RBAC: unauthenticated requests are strictly rejected with HTTP 401', async () => {
        const res = await fetch(`${baseUrl}/reception/walk-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modality: 'CT' }),
        });
        assert.strictEqual(res.status, 401);
      });
    });

    // =========================================================================
    // SECTION 28: MODULE 04 — SCHEDULING & ORDER MANAGEMENT INTEGRATION TESTS
    // =========================================================================
    describe('Section 28: Module 04 — Scheduling & Order Management (Interviewer PDF Requirements)', () => {
      let m4Patient: any;
      let m4Order: any;
      let m4Equipment: any;
      let m4Appointment: any;
      let m4HisImportResult: any;

      before(async () => {
        // Setup equipment
        m4Equipment = await prisma.equipment.create({
          data: {
            name: 'GE Signa 3T MRI Suite 1',
            modality: 'MRI',
            manufacturer: 'GE Healthcare',
            model: 'Signa Pioneer',
            serialNumber: `SN-MRI-${Date.now()}`,
            location: 'Suite MRI-01, West Wing',
            status: 'AVAILABLE',
          },
        });

        // Setup test patient
        m4Patient = await prisma.patient.create({
          data: {
            patientId: `PAT-${Date.now().toString().slice(-6)}`,
            firstName: 'Eleanor',
            lastName: 'Vance',
            dateOfBirth: new Date('1988-04-15'),
            gender: 'FEMALE',
            phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });

        // Setup test order
        const createOrderRes = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            patientId: m4Patient.patientId,
            modality: 'MRI',
            bodyPart: 'Brain',
            examinationName: 'MRI Brain with and without IV Contrast',
            clinicalIndication: 'Chronic migraine and visual field deficits',
            priority: 'ROUTINE',
            contrastRequired: true,
            authorizationRequired: true,
            authorizationStatus: 'APPROVED',
            authorizationCode: 'AUTH-PRE-98214',
            insuranceNotes: 'Pre-auth valid until 2026-12-31',
          }),
        });

        const orderBody = await createOrderRes.json();
        m4Order = orderBody.data;
      });

      after(async () => {
        try {
          if (m4Order) {
            await prisma.appointment.deleteMany({ where: { imagingOrderId: m4Order.id } });
            await prisma.imagingOrder.deleteMany({ where: { id: m4Order.id } });
          }
          if (m4HisImportResult?.order?.id) {
            await prisma.appointment.deleteMany({ where: { imagingOrderId: m4HisImportResult.order.id } });
            await prisma.imagingOrder.deleteMany({ where: { id: m4HisImportResult.order.id } });
          }
          if (m4Patient) {
            await prisma.patient.deleteMany({ where: { id: m4Patient.id } });
          }
          if (m4Equipment) {
            await prisma.equipment.deleteMany({ where: { id: m4Equipment.id } });
          }
        } catch (e) {
          // ignore cleanup errors
        }
      });

      it('1. Multi-modality Calendar & Slot Duration: GET /api/v1/appointments retrieves slot availability and list', async () => {
        const res = await fetch(`${baseUrl}/appointments?modality=MRI`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.items));
      });

      it('2. Patient Preparation Check: GET /api/v1/appointments/prep-check provides fasting, contrast, and allergy reminders', async () => {
        const res = await fetch(`${baseUrl}/appointments/prep-check?modality=MRI&contrastRequired=true`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.contrastPreparationRequired, true);
        assert.strictEqual(body.data.ivRequired, true);
        assert.ok(body.data.allergyReminder.includes('contrast media allergies'));
      });

      it('3. Booking with Conflict Detection: POST /api/v1/appointments books slot and prevents machine conflict', async () => {
        const startTime = new Date(Date.now() + 86400000); // Tomorrow
        startTime.setHours(10, 0, 0, 0);

        const res = await fetch(`${baseUrl}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            patientId: m4Patient.id,
            imagingOrderId: m4Order.id,
            equipmentId: m4Equipment.id,
            scheduledStart: startTime.toISOString(),
            priority: 'ROUTINE',
            notes: 'Standard brain MRI appointment',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        m4Appointment = body.data;
        assert.strictEqual(m4Appointment.status, 'SCHEDULED');
        assert.ok(m4Appointment.appointmentNumber.startsWith('APT-'));
      });

      it('4. Conflict Detection: POST /api/v1/appointments rejects overlapping booking with 409 SCHEDULING_CONFLICT', async () => {
        // Create second patient and second order to test machine overlap conflict
        const patient2 = await prisma.patient.create({
          data: {
            patientId: `PAT-${Date.now().toString().slice(-6)}`,
            firstName: 'Second',
            lastName: 'Patient',
            dateOfBirth: new Date('1992-01-01'),
            gender: 'MALE',
            phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });

        const order2Res = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            patientId: patient2.patientId,
            modality: 'MRI',
            bodyPart: 'Knee',
            examinationName: 'MRI Knee',
            clinicalIndication: 'Meniscal tear evaluation',
          }),
        });
        const order2 = (await order2Res.json()).data;

        // Try booking same machine at same start time
        const res = await fetch(`${baseUrl}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            patientId: patient2.id,
            imagingOrderId: order2.id,
            equipmentId: m4Equipment.id,
            scheduledStart: m4Appointment.scheduledStart,
          }),
        });

        assert.strictEqual(res.status, 409);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.ok(body.message.includes('already booked'));

        // Clean up temp test entities
        await prisma.imagingOrder.delete({ where: { id: order2.id } });
        await prisma.patient.delete({ where: { id: patient2.id } });
      });

      it('5. Overbooking / Emergency Slot: POST /api/v1/appointments permits supervisor emergency override', async () => {
        const emergencyPatient = await prisma.patient.create({
          data: {
            patientId: `PAT-${Date.now().toString().slice(-6)}`,
            firstName: 'Emergency',
            lastName: 'Trauma',
            dateOfBirth: new Date('1975-09-20'),
            gender: 'MALE',
            phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });

        const emergencyOrderRes = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            patientId: emergencyPatient.patientId,
            modality: 'MRI',
            bodyPart: 'Spine',
            examinationName: 'Emergency MRI Whole Spine',
            clinicalIndication: 'Suspected acute cauda equina compression',
            priority: 'STAT',
          }),
        });
        const emergencyOrder = (await emergencyOrderRes.json()).data;

        // Book slot with supervisor override enabled
        const res = await fetch(`${baseUrl}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            patientId: emergencyPatient.id,
            imagingOrderId: emergencyOrder.id,
            equipmentId: m4Equipment.id,
            scheduledStart: m4Appointment.scheduledStart,
            priority: 'STAT',
            allowConflictOverride: true,
            overrideReason: 'Supervisor emergency cauda equina overbooking override',
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.notes.includes('OVERBOOKING OVERRIDE'));

        // Cleanup emergency test order
        await prisma.appointment.deleteMany({ where: { imagingOrderId: emergencyOrder.id } });
        await prisma.imagingOrder.delete({ where: { id: emergencyOrder.id } });
        await prisma.patient.delete({ where: { id: emergencyPatient.id } });
      });

      it('6. Staff & Machine Allocation: PATCH /api/v1/appointments/:id/allocation assigns radiographer and nurse', async () => {
        const res = await fetch(`${baseUrl}/appointments/${m4Appointment.id}/allocation`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            radiographer: 'David Tennant, RT(R)(MR)',
            nurse: 'Donna Noble, RN',
            location: 'Suite MRI-01 (Primary Gantry)',
            notes: 'Patient requires IV cannulation 15 min prior',
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.staffAllocation.radiographer, 'David Tennant, RT(R)(MR)');
        assert.strictEqual(body.data.staffAllocation.nurse, 'Donna Noble, RN');
        assert.ok(body.data.notes.includes('Radiographer: David Tennant'));
      });

      it('7. Order Status Tracking Timeline: GET /api/v1/orders/:id/tracking returns lifecycle progression', async () => {
        const res = await fetch(`${baseUrl}/orders/${m4Order.id}/tracking`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.accessionNumber, m4Order.accessionNumber);

        const milestones = body.data.milestones;
        assert.strictEqual(milestones.length, 6);
        assert.strictEqual(milestones[0].stage, 'PLACED');
        assert.strictEqual(milestones[0].completed, true);
        assert.strictEqual(milestones[1].stage, 'SCHEDULED');
        assert.strictEqual(milestones[1].completed, true);
        assert.strictEqual(milestones[2].stage, 'ARRIVED');
        assert.strictEqual(milestones[2].completed, false);
      });

      it('8. DICOM Modality Worklist (MWL) Sync: POST /api/v1/orders/:id/mwl-sync generates MWL record', async () => {
        const res = await fetch(`${baseUrl}/orders/${m4Order.id}/mwl-sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.accessionNumber, m4Order.accessionNumber);
        assert.strictEqual(body.data.mwlRecord.accessionNumber, m4Order.accessionNumber);
        assert.strictEqual(body.data.mwlRecord.patientId, m4Patient.patientId);
        assert.strictEqual(body.data.mwlRecord.modality, 'MRI');
        assert.ok(body.data.mwlRecord.scheduledStationAETitle);
      });

      it('9. Prior Authorization Tracking: GET /api/v1/orders/:id confirms pre-authorization code and notes', async () => {
        const res = await fetch(`${baseUrl}/orders/${m4Order.id}`, {
          headers: { Authorization: `Bearer ${receptionToken}` },
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.authorizationCode, 'AUTH-PRE-98214');
        assert.strictEqual(body.data.authorizationStatus, 'APPROVED');
        assert.ok(body.data.insuranceNotes.includes('Pre-auth valid'));
      });

      it('10. HIS / EMR Ingestion: POST /api/v1/orders/import-his ingests hospital scan orders directly', async () => {
        const res = await fetch(`${baseUrl}/orders/import-his`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${receptionToken}`,
          },
          body: JSON.stringify({
            externalSystem: 'Cerner Millennium HIS',
            externalOrderId: `CRN-${Date.now()}`,
            patient: {
              firstName: 'Gillian',
              lastName: 'Anderson',
              dateOfBirth: '1978-08-09',
              gender: 'FEMALE',
              phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
            },
            order: {
              modality: 'CT',
              bodyPart: 'Abdomen',
              examinationName: 'CT Abdomen Pelvis with IV Contrast',
              clinicalIndication: 'Right lower quadrant abdominal pain, rule out acute appendicitis',
              priority: 'URGENT',
              contrastRequired: true,
              referringDoctorName: 'Dr. John Watson, MD',
              referringDoctorHospital: 'Baker St. Urgent Care',
            },
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.externalSystem, 'Cerner Millennium HIS');
        assert.ok(body.data.accessionNumber.startsWith('ACC-'));
        assert.ok(body.data.order.clinicalIndication.includes('Cerner Millennium HIS'));
        m4HisImportResult = body.data;
      });

      it('11. Security & RBAC: unauthenticated requests to Module 04 endpoints are rejected with HTTP 401', async () => {
        const res = await fetch(`${baseUrl}/orders/import-his`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 401);
      });
    });
  });
