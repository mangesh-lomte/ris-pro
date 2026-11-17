import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { PrismaClient, ModalityType, Priority, OrderStatus, ScanState, ImageQualityStatus, UserRole, ReportStatus, StudyStatus } from '@prisma/client';
import { reconcilePacsStudy } from '../src/services/pacsReconciliation.service';
import { ensureDefaultReportingTemplates } from '../src/services/radiologist.service';

const prisma = new PrismaClient();

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME;
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD;

if (!ORTHANC_USERNAME || !ORTHANC_PASSWORD) {
  throw new Error('ORTHANC_USERNAME and ORTHANC_PASSWORD environment variables are required in .env');
}

function getOrthancAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${ORTHANC_USERNAME}:${ORTHANC_PASSWORD}`).toString('base64');
}

async function main() {
  console.log('--- Phase 4.2A: Seed Demo DICOM Fixture & Authentic Reconciliation ---');

  // 1. Resolve or create Technologist user for QA attestation
  let reviewerUser = await prisma.user.findFirst({
    where: { role: { in: [UserRole.TECHNOLOGIST, UserRole.ADMIN] }, isActive: true },
  });

  if (!reviewerUser) {
    throw new Error('No active Technologist or Admin user found in database to attest QA.');
  }

  // 2. Resolve or create CT equipment
  let equipment = await prisma.equipment.findFirst({
    where: { modality: ModalityType.CT },
  });

  if (!equipment) {
    equipment = await prisma.equipment.create({
      data: {
        name: 'GE Revolution CT 128-Slice',
        manufacturer: 'GE Healthcare',
        model: 'Revolution EVO',
        serialNumber: 'CT-SN-DEMO-001',
        location: 'Room CT-01, Ground Floor',
        modality: ModalityType.CT,
      },
    });
  }

  // 3. Upsert Demo Patient
  const demoPatient = await prisma.patient.upsert({
    where: { patientId: 'PAT-2026-DEMO01' },
    create: {
      patientId: 'PAT-2026-DEMO01',
      firstName: 'Eleanor',
      lastName: 'Vance (Demo)',
      gender: 'FEMALE',
      dateOfBirth: new Date('1985-04-12T00:00:00.000Z'),
      phone: '555-0199',
      email: 'eleanor.vance.demo@example.com',
      address: '100 Innovation Way, Radiology Tech Center',
      emergencyContactName: 'Thomas Vance',
      emergencyContactPhone: '555-0198',
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });
  console.log(`Verified demo patient: ${demoPatient.patientId} (${demoPatient.firstName} ${demoPatient.lastName})`);

  // 4. Upsert Demo ImagingOrder
  let order = await prisma.imagingOrder.findUnique({
    where: { accessionNumber: 'ACC-2026-DEMO01' },
    include: {
      scanLifecycles: {
        include: { imageQualityReview: true },
      },
      pacsStudyLink: true,
    },
  });

  if (!order) {
    order = await prisma.imagingOrder.create({
      data: {
        accessionNumber: 'ACC-2026-DEMO01',
        patientId: demoPatient.id,
        modality: ModalityType.CT,
        examinationName: 'CT Chest with Contrast (Demo Study)',
        bodyPart: 'CHEST',
        priority: Priority.ROUTINE,
        clinicalIndication: 'Demonstration and verification of radiologist OHIF image viewing (LIDC CT fixture)',
        contrastRequired: true,
        orderStatus: OrderStatus.PACS_READY,
      },
      include: {
        scanLifecycles: {
          include: { imageQualityReview: true },
        },
        pacsStudyLink: true,
      },
    });
  } else {
    order = await prisma.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PACS_READY,
      },
      include: {
        scanLifecycles: {
          include: { imageQualityReview: true },
        },
        pacsStudyLink: true,
      },
    });
  }
  console.log(`Verified demo imaging order: ${order.accessionNumber} (Status: ${order.orderStatus})`);

  // 5. Ensure completed ScanLifecycle and accepted ImageQualityReview
  let scan = await prisma.scanLifecycle.findFirst({
    where: { imagingOrderId: order.id, attemptNumber: 1 },
    include: { imageQualityReview: true },
  });

  if (!scan) {
    scan = await prisma.scanLifecycle.create({
      data: {
        imagingOrderId: order.id,
        equipmentId: equipment.id,
        attemptNumber: 1,
        state: ScanState.COMPLETED,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 3000000),
      },
      include: { imageQualityReview: true },
    });
  }

  if (!scan.imageQualityReview) {
    const qa = await prisma.imageQualityReview.create({
      data: {
        imagingOrderId: order.id,
        scanLifecycleId: scan.id,
        status: ImageQualityStatus.ACCEPTED,
        startedByUserId: reviewerUser.id,
        reviewedByUserId: reviewerUser.id,
        reviewedAt: new Date(Date.now() - 2900000),
        notes: 'High diagnostic resolution, optimal contrast enhancement for demo fixture',
      },
    });
    console.log(`Created accepted QA review: QA-${qa.id.slice(0, 8)} for Scan attempt #${scan.attemptNumber}`);
  } else {
    console.log(`Existing accepted QA review confirmed on attempt #${scan.attemptNumber}`);
  }

  // 6. Orthanc DICOM Fixture Setup
  const authHeader = getOrthancAuthHeader();

  // Search Orthanc for existing demo study with accession ACC-2026-DEMO01
  const findRes = await fetch(`${ORTHANC_URL}/tools/find`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Level: 'Study',
      Query: { AccessionNumber: 'ACC-2026-DEMO01' },
    }),
  });

  if (!findRes.ok) {
    throw new Error(`Failed to query Orthanc /tools/find: HTTP ${findRes.status}`);
  }

  const matchingOrthancStudies = (await findRes.json()) as string[];
  let orthancStudyId: string;
  let studyInstanceUid: string;

  if (matchingOrthancStudies.length > 0) {
    orthancStudyId = matchingOrthancStudies[0];
    const studyDetailRes = await fetch(`${ORTHANC_URL}/studies/${orthancStudyId}`, {
      headers: { Authorization: authHeader },
    });
    const studyDetail = (await studyDetailRes.json()) as any;
    studyInstanceUid = studyDetail.MainDicomTags?.StudyInstanceUID;
    console.log(`Found existing demo study in Orthanc: ${orthancStudyId} (StudyInstanceUID: ${studyInstanceUid})`);
  } else {
    // Locate base de-identified LIDC study in Orthanc
    const lidcFindRes = await fetch(`${ORTHANC_URL}/tools/find`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Level: 'Study',
        Query: { PatientID: 'LIDC-IDRI-0001' },
      }),
    });

    const lidcStudies = (await lidcFindRes.json()) as string[];
    if (lidcStudies.length === 0) {
      throw new Error(
        'Base LIDC study (PatientID: LIDC-IDRI-0001) not found in Orthanc. Ensure sample DICOM is loaded.'
      );
    }

    const baseStudyId = lidcStudies[0];
    console.log(`Found base LIDC study: ${baseStudyId}. Deriving demo study with matching metadata...`);

    // Modify base study into derived demo study (keeping pixel data intact)
    const modifyRes = await fetch(`${ORTHANC_URL}/studies/${baseStudyId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Replace: {
          PatientID: 'PAT-2026-DEMO01',
          PatientName: 'VANCE^ELEANOR^DEMO',
          AccessionNumber: 'ACC-2026-DEMO01',
          StudyDescription: 'CT Chest with Contrast (Demo Study)',
        },
        Force: true,
      }),
    });

    if (!modifyRes.ok) {
      const errText = await modifyRes.text();
      throw new Error(`Failed to modify study in Orthanc: HTTP ${modifyRes.status}: ${errText}`);
    }

    const modifyResult = (await modifyRes.json()) as any;
    orthancStudyId = modifyResult.ID;

    // Fetch details of newly derived study
    const newStudyRes = await fetch(`${ORTHANC_URL}/studies/${orthancStudyId}`, {
      headers: { Authorization: authHeader },
    });
    const newStudy = (await newStudyRes.json()) as any;
    studyInstanceUid = newStudy.MainDicomTags?.StudyInstanceUID;

    console.log(`Derived demo Orthanc study created: ${orthancStudyId}`);
    console.log(`Instances: ${modifyResult.InstancesCount}, StudyInstanceUID: ${studyInstanceUid}`);
  }

  // 7. Execute Authentic PACS Reconciliation Workflow
  console.log('Executing authentic RIS-PACS reconciliation workflow...');
  const reconciliationResult = await reconcilePacsStudy('ACC-2026-DEMO01', {
    userId: reviewerUser.id,
    role: reviewerUser.role,
    ipAddress: '127.0.0.1',
    userAgent: 'seed-demo-dicom',
  });

  console.log('Authentic PACS Reconciliation Succeeded:');
  console.log(`- PacsStudyLink ID: ${reconciliationResult.link.id}`);
  console.log(`- Status: ${reconciliationResult.link.status}`);
  console.log(`- Orthanc Study ID: ${reconciliationResult.link.orthancStudyId}`);
  console.log(`- StudyInstanceUID: ${reconciliationResult.link.studyInstanceUid}`);
  console.log(`- Verified By User: ${reviewerUser.firstName} ${reviewerUser.lastName} (${reviewerUser.id})`);
  console.log(
    `- OHIF Viewer Direct URL: http://localhost:3002/viewer?StudyInstanceUIDs=${encodeURIComponent(
      studyInstanceUid
    )}`
  );

  // 8. Phase 4.2B: Historical Prior Study (ACC-2026-DEMO00) with Finalized Prior Report
  console.log('\n--- Phase 4.2B: Historical Prior Study Setup (ACC-2026-DEMO00) ---');

  let radUser = await prisma.user.findFirst({
    where: { role: UserRole.RADIOLOGIST, isActive: true },
  });
  if (!radUser) {
    radUser = reviewerUser;
  }

  // Upsert Prior Order
  let priorOrder = await prisma.imagingOrder.findUnique({
    where: { accessionNumber: 'ACC-2026-DEMO00' },
    include: {
      scanLifecycles: { include: { imageQualityReview: true } },
      pacsStudyLink: true,
      report: true,
    },
  });

  if (!priorOrder) {
    priorOrder = await prisma.imagingOrder.create({
      data: {
        accessionNumber: 'ACC-2026-DEMO00',
        patientId: demoPatient.id,
        modality: ModalityType.CT,
        bodyPart: 'Chest',
        examinationName: 'CT Chest without Contrast (Historical Baseline)',
        clinicalIndication: 'Baseline non-contrast chest CT for chronic dry cough. Rule out mass or infiltrate.',
        priority: Priority.ROUTINE,
        orderStatus: OrderStatus.COMPLETED,
        contrastRequired: false,
        createdAt: new Date('2025-11-15T09:00:00.000Z'),
        updatedAt: new Date('2025-11-15T14:30:00.000Z'),
      },
      include: {
        scanLifecycles: { include: { imageQualityReview: true } },
        pacsStudyLink: true,
        report: true,
      },
    });
    console.log(`Created historical prior imaging order: ${priorOrder.accessionNumber}`);
  } else {
    console.log(`Found existing prior order: ${priorOrder.accessionNumber}`);
  }

  // Ensure completed scan lifecycle attempt #1
  let priorScan = await prisma.scanLifecycle.findFirst({
    where: { imagingOrderId: priorOrder.id, attemptNumber: 1 },
    include: { imageQualityReview: true },
  });
  if (!priorScan) {
    priorScan = await prisma.scanLifecycle.create({
      data: {
        imagingOrderId: priorOrder.id,
        attemptNumber: 1,
        equipmentId: equipment.id,
        state: ScanState.COMPLETED,
        startedAt: new Date('2025-11-15T09:30:00.000Z'),
        completedAt: new Date('2025-11-15T09:50:00.000Z'),
      },
      include: { imageQualityReview: true },
    });
  }

  // Ensure accepted image quality review
  let priorQa = await prisma.imageQualityReview.findFirst({
    where: { scanLifecycleId: priorScan.id },
  });
  if (!priorQa) {
    priorQa = await prisma.imageQualityReview.create({
      data: {
        scanLifecycleId: priorScan.id,
        imagingOrderId: priorOrder.id,
        startedByUserId: reviewerUser.id,
        reviewedByUserId: reviewerUser.id,
        status: ImageQualityStatus.ACCEPTED,
        notes: 'Historical QA: Optimal baseline inspiratory volume, no motion artifacts.',
        reviewedAt: new Date('2025-11-15T10:05:00.000Z'),
      },
    });
  }

  // Search Orthanc for existing prior study ACC-2026-DEMO00
  const findPriorRes = await fetch(`${ORTHANC_URL}/tools/find`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Level: 'Study',
      Query: { AccessionNumber: 'ACC-2026-DEMO00' },
    }),
  });

  if (!findPriorRes.ok) {
    throw new Error(`Failed to query Orthanc /tools/find for prior: HTTP ${findPriorRes.status}`);
  }

  const matchingPriorStudies = (await findPriorRes.json()) as string[];
  let priorOrthancStudyId: string;
  let priorStudyInstanceUid: string;

  if (matchingPriorStudies.length > 0) {
    priorOrthancStudyId = matchingPriorStudies[0];
    const priorDetailRes = await fetch(`${ORTHANC_URL}/studies/${priorOrthancStudyId}`, {
      headers: { Authorization: authHeader },
    });
    const priorDetail = (await priorDetailRes.json()) as any;
    priorStudyInstanceUid = priorDetail.MainDicomTags?.StudyInstanceUID;
    console.log(`Found existing prior study in Orthanc: ${priorOrthancStudyId} (${priorStudyInstanceUid})`);
  } else {
    // Derive from base LIDC study
    const lidcFindRes = await fetch(`${ORTHANC_URL}/tools/find`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Level: 'Study',
        Query: { PatientID: 'LIDC-IDRI-0001' },
      }),
    });
    const lidcStudies = (await lidcFindRes.json()) as string[];
    const baseStudyId = lidcStudies[0];

    const modifyRes = await fetch(`${ORTHANC_URL}/studies/${baseStudyId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Replace: {
          PatientID: 'PAT-2026-DEMO01',
          PatientName: 'VANCE^ELEANOR^DEMO',
          AccessionNumber: 'ACC-2026-DEMO00',
          StudyDescription: 'CT Chest without Contrast (Historical Baseline)',
          StudyDate: '20251115',
        },
        Force: true,
      }),
    });

    if (!modifyRes.ok) {
      const errText = await modifyRes.text();
      throw new Error(`Failed to modify prior study in Orthanc: HTTP ${modifyRes.status}: ${errText}`);
    }

    const modifyResult = (await modifyRes.json()) as any;
    priorOrthancStudyId = modifyResult.ID;

    const newStudyRes = await fetch(`${ORTHANC_URL}/studies/${priorOrthancStudyId}`, {
      headers: { Authorization: authHeader },
    });
    const newStudy = (await newStudyRes.json()) as any;
    priorStudyInstanceUid = newStudy.MainDicomTags?.StudyInstanceUID;
    console.log(`Derived prior Orthanc study created: ${priorOrthancStudyId} (${priorStudyInstanceUid})`);
  }

  // Reconcile prior study
  console.log('Reconciling prior study in RIS...');
  const priorReconciliation = await reconcilePacsStudy('ACC-2026-DEMO00', {
    userId: reviewerUser.id,
    role: reviewerUser.role,
    ipAddress: '127.0.0.1',
    userAgent: 'seed-demo-dicom',
  });
  console.log(`Prior study reconciled: link ${priorReconciliation.link.id}, status: ${priorReconciliation.link.status}`);

  // Create or link Study and finalized Report for ACC-2026-DEMO00
  let priorStudy = await prisma.study.findUnique({
    where: { orderId: priorOrder.id },
  });
  if (!priorStudy) {
    priorStudy = await prisma.study.create({
      data: {
        orderId: priorOrder.id,
        patientId: demoPatient.id,
        accessionNumber: 'ACC-2026-DEMO00',
        modality: ModalityType.CT,
        studyStatus: StudyStatus.REPORTED,
        pacsStatus: 'SENT',
        studyInstanceUid: priorStudyInstanceUid,
      },
    });
  }

  await prisma.report.upsert({
    where: { orderId: priorOrder.id },
    create: {
      orderId: priorOrder.id,
      studyId: priorStudy.id,
      radiologistId: radUser.id,
      status: ReportStatus.FINAL,
      findings:
        'Lungs: Clear bilaterally without focal consolidation, pneumothorax, or large pleural effusion. Mild dependent subsegmental atelectasis in right middle lobe.\n' +
        'Mediastinum: Heart size within normal limits. Normal caliber aorta and pulmonary trunk. No pathologically enlarged mediastinal or hilar lymph nodes.\n' +
        'Chest Wall & Skeleton: Visualized osseous structures intact without acute fracture or aggressive osteolytic lesions.',
      impression:
        '1. No acute cardiopulmonary process.\n' +
        '2. Minor dependent subsegmental atelectasis without airspace consolidation.\n' +
        '3. Normal baseline non-contrast CT study.',
      finalizedAt: new Date('2025-11-15T14:30:00.000Z'),
      createdAt: new Date('2025-11-15T11:00:00.000Z'),
    },
    update: {
      status: ReportStatus.FINAL,
      finalizedAt: new Date('2025-11-15T14:30:00.000Z'),
    },
  });
  console.log(`Finalized prior report upserted for ${priorOrder.accessionNumber} (Author: ${radUser.firstName} ${radUser.lastName})`);

  // Seed default reporting templates for Phase 4.3 demonstration
  await ensureDefaultReportingTemplates();
  console.log('Structured reporting templates ensured (CT Chest, CT Head, MRI Brain, MRI Spine, CT Abdomen).');

  console.log(
    `- Multi-Study OHIF Comparison URL: http://localhost:3002/viewer?StudyInstanceUIDs=${encodeURIComponent(
      studyInstanceUid
    )},${encodeURIComponent(priorStudyInstanceUid)}`
  );
}

main()
  .catch((e) => {
    console.error('Error seeding demo DICOM fixture:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
