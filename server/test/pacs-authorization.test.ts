import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import { UserRole, ModalityType, OrderStatus } from '@prisma/client';

describe('MODULE 07 — Requirement 10: PACS Security & Role-Based Access Control Matrix', () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let radToken: string;
  let techToken: string;
  let receptionToken: string;
  let patientToken: string;

  let testPatient: any;
  let testOrder: any;
  let testStudy: any;

  before(async () => {
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    const radUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RADIOLOGIST } });
    const techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });
    const receptionUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECEPTION } });

    adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    radToken = jwt.sign({ userId: radUser.id, email: radUser.email, role: radUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    techToken = jwt.sign({ userId: techUser.id, email: techUser.email, role: techUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    receptionToken = jwt.sign({ userId: receptionUser.id, email: receptionUser.email, role: receptionUser.role }, env.JWT_SECRET, { expiresIn: 3600 });

    const suffix = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    testPatient = await prisma.patient.create({
      data: {
        patientId: `PAT-PACS-SEC-${suffix}`,
        firstName: 'PacsSecurity',
        lastName: `Tester-${suffix}`,
        dateOfBirth: new Date('1988-06-15'),
        gender: 'OTHER',
        phone: `+1-555-777-${Math.floor(1000 + Math.random() * 9000)}`,
        email: `pacs-sec-${suffix}@example.com`,
      },
    });

    patientToken = jwt.sign(
      { role: 'PATIENT', patientId: testPatient.patientId },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    testOrder = await prisma.imagingOrder.create({
      data: {
        accessionNumber: `ACC-PACS-SEC-${suffix}`,
        patientId: testPatient.id,
        modality: ModalityType.CT,
        bodyPart: 'Chest',
        examinationName: 'CT Chest with Contrast (Security Test)',
        clinicalIndication: 'Verification of PACS role-based access control and security hardening',
        orderStatus: OrderStatus.COMPLETED,
      },
    });

    testStudy = await prisma.study.create({
      data: {
        orderId: testOrder.id,
        patientId: testPatient.id,
        accessionNumber: testOrder.accessionNumber,
        studyInstanceUid: `1.2.840.113619.SEC.${suffix}`,
        modality: ModalityType.CT,
        studyStatus: 'ACQUIRED',
        pacsStatus: 'SENT',
        seriesCount: 2,
        instanceCount: 120,
      },
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    if (testStudy) {
      await prisma.study.delete({ where: { id: testStudy.id } }).catch(() => {});
    }
    if (testOrder) {
      await prisma.imagingOrder.delete({ where: { id: testOrder.id } }).catch(() => {});
    }
    if (testPatient) {
      await prisma.patient.delete({ where: { id: testPatient.id } }).catch(() => {});
    }
  });

  const request = async (url: string, method = 'GET', token?: string, body?: any) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  describe('1. Received Studies Worklist (GET /pacs/studies)', () => {
    it('allows ADMIN', async () => {
      const res = await request('/pacs/studies', 'GET', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request('/pacs/studies', 'GET', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request('/pacs/studies', 'GET', techToken);
      assert.equal(res.status, 200);
    });

    it('denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request('/pacs/studies', 'GET', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies PATIENT token with HTTP 401 Unauthorized', async () => {
      const res = await request('/pacs/studies', 'GET', patientToken);
      assert.equal(res.status, 401);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request('/pacs/studies', 'GET');
      assert.equal(res.status, 401);
    });
  });

  describe('2. DICOM Viewer Launch Context (GET /pacs/viewer/:studyUid)', () => {
    it('allows ADMIN', async () => {
      const res = await request(`/pacs/viewer/${testStudy.studyInstanceUid}`, 'GET', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request(`/pacs/viewer/${testStudy.studyInstanceUid}`, 'GET', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request(`/pacs/viewer/${testStudy.studyInstanceUid}`, 'GET', techToken);
      assert.equal(res.status, 200);
    });

    it('denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/viewer/${testStudy.studyInstanceUid}`, 'GET', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request(`/pacs/viewer/${testStudy.studyInstanceUid}`, 'GET');
      assert.equal(res.status, 401);
    });
  });

  describe('3. Prior Study Auto-Matching (GET /pacs/priors/:identifier)', () => {
    it('allows ADMIN', async () => {
      const res = await request(`/pacs/priors/${testPatient.patientId}`, 'GET', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request(`/pacs/priors/${testPatient.patientId}`, 'GET', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request(`/pacs/priors/${testPatient.patientId}`, 'GET', techToken);
      assert.equal(res.status, 200);
    });

    it('denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/priors/${testPatient.patientId}`, 'GET', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request(`/pacs/priors/${testPatient.patientId}`, 'GET');
      assert.equal(res.status, 401);
    });
  });

  describe('4. DICOM Subspecialty Routing Rules (POST /pacs/route/:identifier)', () => {
    it('allows ADMIN', async () => {
      const res = await request(`/pacs/route/${testOrder.accessionNumber}`, 'POST', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request(`/pacs/route/${testOrder.accessionNumber}`, 'POST', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request(`/pacs/route/${testOrder.accessionNumber}`, 'POST', techToken);
      assert.equal(res.status, 200);
    });

    it('denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/route/${testOrder.accessionNumber}`, 'POST', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request(`/pacs/route/${testOrder.accessionNumber}`, 'POST');
      assert.equal(res.status, 401);
    });
  });

  describe('5. Study Integrity / Completeness Verification (GET /pacs/completeness/:studyUid)', () => {
    it('allows ADMIN', async () => {
      const res = await request(`/pacs/completeness/${testStudy.studyInstanceUid}`, 'GET', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request(`/pacs/completeness/${testStudy.studyInstanceUid}`, 'GET', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request(`/pacs/completeness/${testStudy.studyInstanceUid}`, 'GET', techToken);
      assert.equal(res.status, 200);
    });

    it('denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/completeness/${testStudy.studyInstanceUid}`, 'GET', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request(`/pacs/completeness/${testStudy.studyInstanceUid}`, 'GET');
      assert.equal(res.status, 401);
    });
  });

  describe('6. DICOM Anonymized Export (POST /pacs/export/:studyUid)', () => {
    it('allows ADMIN to export DICOM study', async () => {
      const res = await request(`/pacs/export/${testStudy.studyInstanceUid}`, 'POST', adminToken, {
        anonymizePatient: true,
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.anonymized, true);
      assert.equal(json.data.patientData.patientName, 'ANONYMOUS^RESEARCH');
    });

    it('allows RADIOLOGIST to export DICOM study for research/opinion', async () => {
      const res = await request(`/pacs/export/${testStudy.studyInstanceUid}`, 'POST', radToken, {
        anonymizePatient: true,
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.anonymized, true);
    });

    it('strictly denies TECHNOLOGIST with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/export/${testStudy.studyInstanceUid}`, 'POST', techToken, {
        anonymizePatient: true,
      });
      assert.equal(res.status, 403);
    });

    it('strictly denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request(`/pacs/export/${testStudy.studyInstanceUid}`, 'POST', receptionToken, {
        anonymizePatient: true,
      });
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request(`/pacs/export/${testStudy.studyInstanceUid}`, 'POST', undefined, {
        anonymizePatient: true,
      });
      assert.equal(res.status, 401);
    });
  });

  describe('7. DICOM Media Import (POST /pacs/import-media)', () => {
    it('allows ADMIN to import outside media', async () => {
      const res = await request('/pacs/import-media', 'POST', adminToken, {
        patientId: testPatient.patientId,
        modality: ModalityType.CT,
        mediaSource: 'CD',
        externalFacility: 'Metro General Hospital',
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
    });

    it('allows TECHNOLOGIST to import outside media at workstation', async () => {
      const res = await request('/pacs/import-media', 'POST', techToken, {
        patientId: testPatient.patientId,
        modality: ModalityType.MRI,
        mediaSource: 'USB',
        externalFacility: 'Outside Imaging Center',
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
    });

    it('strictly denies RADIOLOGIST from importing media with HTTP 403 Forbidden', async () => {
      const res = await request('/pacs/import-media', 'POST', radToken, {
        patientId: testPatient.patientId,
        modality: ModalityType.CT,
        mediaSource: 'CD',
      });
      assert.equal(res.status, 403);
    });

    it('strictly denies RECEPTION from importing media with HTTP 403 Forbidden', async () => {
      const res = await request('/pacs/import-media', 'POST', receptionToken, {
        patientId: testPatient.patientId,
        modality: ModalityType.CT,
        mediaSource: 'CD',
      });
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request('/pacs/import-media', 'POST', undefined, {
        patientId: testPatient.patientId,
        modality: ModalityType.CT,
        mediaSource: 'CD',
      });
      assert.equal(res.status, 401);
    });
  });

  describe('8. Administrative Storage Telemetry (Tiers, Capacity, Nodes)', () => {
    describe('8.1 Storage Tiers Telemetry (GET /pacs/storage/tiers)', () => {
      it('allows ADMIN', async () => {
        const res = await request('/pacs/storage/tiers', 'GET', adminToken);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.ok(Array.isArray(json.data.tiers));
      });

      it('strictly denies RADIOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/tiers', 'GET', radToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies TECHNOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/tiers', 'GET', techToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies RECEPTION with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/tiers', 'GET', receptionToken);
        assert.equal(res.status, 403);
      });

      it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
        const res = await request('/pacs/storage/tiers', 'GET');
        assert.equal(res.status, 401);
      });
    });

    describe('8.2 Storage Capacity Gauge (GET /pacs/storage/capacity)', () => {
      it('allows ADMIN', async () => {
        const res = await request('/pacs/storage/capacity', 'GET', adminToken);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.ok(json.data.totalCapacityGb > 0);
      });

      it('strictly denies RADIOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/capacity', 'GET', radToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies TECHNOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/capacity', 'GET', techToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies RECEPTION with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/storage/capacity', 'GET', receptionToken);
        assert.equal(res.status, 403);
      });

      it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
        const res = await request('/pacs/storage/capacity', 'GET');
        assert.equal(res.status, 401);
      });
    });

    describe('8.3 PACS Nodes Connectivity Monitor (GET /pacs/nodes/connectivity)', () => {
      it('allows ADMIN', async () => {
        const res = await request('/pacs/nodes/connectivity', 'GET', adminToken);
        assert.equal(res.status, 200);
      });

      it('strictly denies RADIOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/nodes/connectivity', 'GET', radToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies TECHNOLOGIST with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/nodes/connectivity', 'GET', techToken);
        assert.equal(res.status, 403);
      });

      it('strictly denies RECEPTION with HTTP 403 Forbidden', async () => {
        const res = await request('/pacs/nodes/connectivity', 'GET', receptionToken);
        assert.equal(res.status, 403);
      });

      it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
        const res = await request('/pacs/nodes/connectivity', 'GET');
        assert.equal(res.status, 401);
      });
    });
  });

  describe('9. Studies Resource Route (GET /studies)', () => {
    it('allows ADMIN', async () => {
      const res = await request('/studies', 'GET', adminToken);
      assert.equal(res.status, 200);
    });

    it('allows RADIOLOGIST', async () => {
      const res = await request('/studies', 'GET', radToken);
      assert.equal(res.status, 200);
    });

    it('allows TECHNOLOGIST', async () => {
      const res = await request('/studies', 'GET', techToken);
      assert.equal(res.status, 200);
    });

    it('strictly denies RECEPTION with HTTP 403 Forbidden', async () => {
      const res = await request('/studies', 'GET', receptionToken);
      assert.equal(res.status, 403);
    });

    it('denies unauthenticated request with HTTP 401 Unauthorized', async () => {
      const res = await request('/studies', 'GET');
      assert.equal(res.status, 401);
    });
  });
});
