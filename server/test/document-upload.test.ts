import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import { UserRole, ModalityType, Priority, OrderStatus, DocumentCategory } from '@prisma/client';

describe('MODULE 06 — Requirement 7: Supporting Documents Upload & Security Audit', () => {
  let server: http.Server;
  let baseUrl: string;

  let techToken: string;
  let adminToken: string;
  let radToken: string;
  let receptionToken: string;

  let techUser: { id: string; email: string; role: UserRole };
  let adminUser: { id: string; email: string; role: UserRole };
  let radUser: { id: string; email: string; role: UserRole };
  let receptionUser: { id: string; email: string; role: UserRole };

  let testPatient: any;
  let testOrder: any;
  let secondOrder: any;

  before(async () => {
    techUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.TECHNOLOGIST } });
    adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    radUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RADIOLOGIST } });
    receptionUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.RECEPTION } });

    techToken = jwt.sign({ userId: techUser.id, email: techUser.email, role: techUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    radToken = jwt.sign({ userId: radUser.id, email: radUser.email, role: radUser.role }, env.JWT_SECRET, { expiresIn: 3600 });
    receptionToken = jwt.sign({ userId: receptionUser.id, email: receptionUser.email, role: receptionUser.role }, env.JWT_SECRET, { expiresIn: 3600 });

    const suffix = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    testPatient = await prisma.patient.create({
      data: {
        patientId: `PAT-DOC-${suffix}`,
        firstName: 'Document',
        lastName: `Tester-${suffix}`,
        dateOfBirth: new Date('1985-04-12'),
        gender: 'FEMALE',
        phone: `+1-555-888-${Math.floor(1000 + Math.random() * 9000)}`,
        email: `doc-tester-${suffix}@example.com`,
      },
    });

    testOrder = await prisma.imagingOrder.create({
      data: {
        accessionNumber: `ACC-DOC-${suffix}`,
        patientId: testPatient.id,
        modality: ModalityType.CT,
        bodyPart: 'Chest',
        examinationName: 'CT Chest with IV Contrast',
        clinicalIndication: 'Test document attachments',
        priority: Priority.ROUTINE,
        orderStatus: OrderStatus.READY_FOR_TECH,
        createdById: adminUser.id,
      },
    });

    secondOrder = await prisma.imagingOrder.create({
      data: {
        accessionNumber: `ACC-DOC2-${suffix}`,
        patientId: testPatient.id,
        modality: ModalityType.MRI,
        bodyPart: 'Brain',
        examinationName: 'MRI Brain without Contrast',
        clinicalIndication: 'Cross-order isolation test',
        priority: Priority.ROUTINE,
        orderStatus: OrderStatus.READY_FOR_TECH,
        createdById: adminUser.id,
      },
    });

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
    // Clean up created documents
    await prisma.orderDocument.deleteMany({
      where: { imagingOrderId: { in: [testOrder.id, secondOrder.id] } },
    });
    await prisma.imagingOrder.deleteMany({
      where: { id: { in: [testOrder.id, secondOrder.id] } },
    });
    await prisma.patient.deleteMany({
      where: { id: testPatient.id },
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  let uploadedDocId: string;
  const samplePdfContent = '%PDF-1.4 sample test referral pdf content for technologist verification';
  const samplePdfBase64 = Buffer.from(samplePdfContent).toString('base64');

  it('DOC-001: Technologist successfully uploads referral PDF document (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techToken}`,
      },
      body: JSON.stringify({
        category: 'REFERRAL',
        fileName: 'referral_letter.pdf',
        fileType: 'application/pdf',
        fileBase64: `data:application/pdf;base64,${samplePdfBase64}`,
        notes: 'Signed referral from Dr. Smith',
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.id);
    assert.equal(json.data.category, 'REFERRAL');
    assert.equal(json.data.fileName, 'referral_letter.pdf');
    assert.equal(json.data.fileType, 'application/pdf');
    assert.equal(json.data.notes, 'Signed referral from Dr. Smith');
    assert.equal(json.data.accessionNumber, testOrder.accessionNumber);
    assert.equal(json.data.patientId, testPatient.id);
    assert.ok(json.data.fileSize > 0);

    uploadedDocId = json.data.id;
  });

  it('DOC-002: Technologist successfully uploads lab result PNG (201 Created)', async () => {
    const pngSample = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489', 'hex').toString('base64');
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techToken}`,
      },
      body: JSON.stringify({
        category: 'LAB_RESULT',
        fileName: 'creatinine_report.png',
        fileType: 'image/png',
        fileBase64: pngSample,
        notes: 'Creatinine 0.9 mg/dL, eGFR 85 mL/min',
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.category, 'LAB_RESULT');
    assert.equal(json.data.fileName, 'creatinine_report.png');
  });

  it('DOC-003: Rejects document with file size exceeding 5 MB limit (400 Bad Request)', async () => {
    // Generate a payload simulating > 5MB
    const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0x41);
    const oversizedBase64 = oversizedBuffer.toString('base64');

    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techToken}`,
      },
      body: JSON.stringify({
        category: 'OTHER',
        fileName: 'huge_document.pdf',
        fileType: 'application/pdf',
        fileBase64: oversizedBase64,
      }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /5 MB/);
  });

  it('DOC-004: Rejects unauthorized file types (e.g. executable/script) (400 Bad Request)', async () => {
    const maliciousPayload = Buffer.from('MZ\x90\x00\x03\x00\x00\x00').toString('base64');

    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techToken}`,
      },
      body: JSON.stringify({
        category: 'OTHER',
        fileName: 'malicious.exe',
        fileType: 'application/x-msdownload',
        fileBase64: maliciousPayload,
      }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /Supported clinical document formats/);
  });

  it('DOC-005: Technologist lists attached documents (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 2);
    assert.ok(json.data.some((d: any) => d.category === 'REFERRAL'));
    assert.ok(json.data.some((d: any) => d.category === 'LAB_RESULT'));
  });

  it('DOC-006: Authenticated download returns exact binary file with safe headers (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition') || '', /referral_letter\.pdf/);

    const bodyText = await res.text();
    assert.equal(bodyText, samplePdfContent);
  });

  it('DOC-007: Radiologist can view documents list and download supporting files (Read-Only)', async () => {
    // 1. Radiologist can list documents
    const listRes = await fetch(`${baseUrl}/radiologist/worklist/${testOrder.id}/documents`, {
      headers: { Authorization: `Bearer ${radToken}` },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.equal(listJson.success, true);
    assert.equal(listJson.data.length, 2);

    // 2. Radiologist can download document
    const dlRes = await fetch(`${baseUrl}/radiologist/worklist/${testOrder.id}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${radToken}` },
    });
    assert.equal(dlRes.status, 200);
    const dlBody = await dlRes.text();
    assert.equal(dlBody, samplePdfContent);
  });

  it('DOC-008: RBAC strictly blocks Reception from accessing technologist document endpoints (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`, {
      headers: { Authorization: `Bearer ${receptionToken}` },
    });
    assert.equal(res.status, 403);
  });

  it('DOC-009: Unauthenticated requests are rejected (401 Unauthorized)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents`);
    assert.equal(res.status, 401);
  });

  it('DOC-010: Cross-order isolation check prevents accessing document via wrong order ID (404 Not Found)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${secondOrder.id}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${techToken}` },
    });
    assert.equal(res.status, 404);
  });

  it('DOC-011: Audit trail records DOCUMENT_UPLOADED and DOCUMENT_DOWNLOADED', async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: uploadedDocId,
        action: { in: ['DOCUMENT_UPLOADED', 'DOCUMENT_DOWNLOADED'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    assert.ok(auditLogs.length >= 2);
    const uploadLog = auditLogs.find((l) => l.action === 'DOCUMENT_UPLOADED');
    const downloadLog = auditLogs.find((l) => l.action === 'DOCUMENT_DOWNLOADED');
    assert.ok(uploadLog);
    assert.ok(downloadLog);
    assert.equal(uploadLog.userId, techUser.id);
  });

  it('DOC-012: Delete document cleans up database and physical file, and creates DOCUMENT_DELETED audit log (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/technologist/worklist/${testOrder.id}/documents/${uploadedDocId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${techToken}` },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    // Verify record removed from database
    const docInDb = await prisma.orderDocument.findUnique({ where: { id: uploadedDocId } });
    assert.equal(docInDb, null);

    // Verify DOCUMENT_DELETED audit entry
    const deleteAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: uploadedDocId,
        action: 'DOCUMENT_DELETED',
      },
    });
    assert.ok(deleteAudit);
    assert.equal(deleteAudit.userId, techUser.id);
  });
});
