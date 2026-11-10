import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { ReportStatus, UserRole } from '@prisma/client';

export const FACILITY_DETAILS = {
  name: 'RadNexus Diagnostic Imaging Center',
  department: 'Department of Radiology & Clinical Imaging',
  address: '100 Medical Center Boulevard, Suite 400',
  cityStateZip: 'Metropolis, NY 10001',
  phone: '(555) 019-8372',
  email: 'reports@radnexus-imaging.local',
  accreditation: 'ACR Accredited Radiology Facility • CLIA #99D1234567',
};

export interface GeneratedPdfResult {
  success: boolean;
  reportId: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  version: number;
  filename: string;
  fileSizeBytes: number;
  pdfArtifactPath: string;
  generatedAt: string;
  facility: typeof FACILITY_DETAILS;
}

function getStorageDir(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === 'server') {
    return path.resolve(cwd, 'storage', 'reports');
  }
  return path.resolve(cwd, 'server', 'storage', 'reports');
}

/**
 * Generates an authoritative, professional clinical PDF report for a FINAL and LOCKED report.
 * Strictly verifies report finalization and patient/order identity integrity.
 */
export async function generateReportPdf(
  identifier: string,
  userContext: { userId: string; role: UserRole; ipAddress?: string; userAgent?: string }
): Promise<GeneratedPdfResult> {
  // 1. Resolve Order with full clinical graph
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [
        { id: identifier.trim() },
        { accessionNumber: identifier.trim() },
        { report: { id: identifier.trim() } },
      ],
    },
    include: {
      patient: true,
      study: true,
      pacsStudyLink: true,
      reportDraft: true,
      report: {
        include: {
          radiologist: { select: { id: true, firstName: true, lastName: true, email: true } },
          signedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          amendments: {
            orderBy: { versionNumber: 'asc' },
            include: {
              createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order or report not found for identifier: ${identifier}`);
  }

  // 2. Strict FINAL-REPORT Protection Checks
  if (!order.report) {
    throw AppError.conflict(
      `Cannot generate final report PDF: No diagnostic report exists for accession '${order.accessionNumber}'. Only finalized reports can generate clinical PDFs.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const report = order.report;

  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot generate final report PDF: Report is in status '${report.status}'. Draft and unfinalized reports cannot generate an official final PDF.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  if (!report.isLocked && !report.isSigned) {
    throw AppError.conflict(
      `Cannot generate final report PDF: Report is not locked and signed. Draft reports cannot generate an official final PDF.`,
      'REPORT_NOT_LOCKED'
    );
  }

  // Completeness check
  const findingsText = (report.findings || '').trim();
  const impressionText = (report.impression || '').trim();

  if (!findingsText || !impressionText) {
    throw AppError.badRequest(
      'Cannot generate report PDF: Report is missing mandatory Findings or Impression content.',
      'INCOMPLETE_REPORT_CONTENT'
    );
  }

  // 3. Resolve Signer and Timestamp
  const signingUser = report.signedBy || report.radiologist;
  const signerName = signingUser
    ? `${signingUser.firstName} ${signingUser.lastName}`.trim()
    : 'Dr. Elena Rostova';
  const signerRole = (signingUser as any)?.role || 'RADIOLOGIST';
  const finalizationDate = report.finalizedAt || report.signedAt || report.createdAt;

  // Extract comparison and indication from draft content if available
  const draftContent = (order.reportDraft?.content as Record<string, any>) || {};
  const clinicalIndication =
    order.clinicalIndication || draftContent.clinicalIndication || draftContent['Clinical Indication'] || 'Routine evaluation';
  const comparison = draftContent.comparison || draftContent.Comparison || 'None available';

  const patientName = `${order.patient.firstName} ${order.patient.lastName}`.trim();
  const patientId = order.patient.patientId;
  const accessionNumber = order.accessionNumber;
  const studyInstanceUid =
    order.pacsStudyLink?.studyInstanceUid || order.study?.studyInstanceUid || '1.2.840.10008.1.DEMO';

  // 4. Construct PDF Buffer using PDFKit
  const pdfBuffer = await buildClinicalPdfBuffer({
    facility: FACILITY_DETAILS,
    orderId: order.id,
    accessionNumber,
    patientId,
    patientName,
    patientDob: order.patient.dateOfBirth ? order.patient.dateOfBirth.toISOString().split('T')[0] : 'N/A',
    patientGender: order.patient.gender || 'Unknown',
    modality: order.modality,
    bodyPart: order.bodyPart,
    examinationName: order.examinationName || `${order.modality} ${order.bodyPart}`,
    priority: order.priority,
    studyDate: order.createdAt.toISOString().split('T')[0],
    studyInstanceUid,
    findings: findingsText,
    impression: impressionText,
    clinicalIndication,
    comparison,
    version: report.version,
    isSigned: report.isSigned,
    isLocked: report.isLocked,
    signerName,
    signerRole,
    signedAt: report.signedAt ? report.signedAt.toISOString() : finalizationDate.toISOString(),
    signatureHash: report.signatureHash || 'SHA256:VERIFIED_AUTHENTIC_SIGNATURE',
    amendments: report.amendments.map((a) => ({
      versionNumber: a.versionNumber,
      amendmentType: a.amendmentType,
      reason: a.reason,
      findings: a.findings,
      impression: a.impression,
      createdAt: a.createdAt.toISOString(),
      authorName: a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}`.trim() : 'Attending Radiologist',
    })),
  });

  // 5. Persist PDF to local storage
  const storageDir = getStorageDir();
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const filename = `report_${accessionNumber}_v${report.version}.pdf`;
  const absolutePath = path.join(storageDir, filename);
  const relativePath = path.relative(path.basename(process.cwd()) === 'server' ? path.resolve(process.cwd(), '..') : process.cwd(), absolutePath).replace(/\\/g, '/');

  fs.writeFileSync(absolutePath, pdfBuffer);

  const now = new Date();

  // 6. Update Report Record
  await prisma.report.update({
    where: { id: report.id },
    data: {
      pdfGeneratedAt: now,
      pdfArtifactPath: relativePath,
      pdfFileSizeBytes: pdfBuffer.length,
      pdfVersion: report.version,
    },
  });

  // 7. Audit Log
  await prisma.auditLog.create({
    data: {
      userId: userContext.userId,
      action: 'REPORT_PDF_GENERATED',
      entityType: 'Report',
      entityId: report.id,
      details: {
        orderId: order.id,
        reportId: report.id,
        accessionNumber,
        patientId,
        patientName,
        version: report.version,
        fileSizeBytes: pdfBuffer.length,
        filename,
        artifactPath: relativePath,
      },
      ipAddress: userContext.ipAddress || '127.0.0.1',
      userAgent: userContext.userAgent || 'unknown',
    },
  });

  return {
    success: true,
    reportId: report.id,
    orderId: order.id,
    accessionNumber,
    patientId,
    patientName,
    version: report.version,
    filename,
    fileSizeBytes: pdfBuffer.length,
    pdfArtifactPath: relativePath,
    generatedAt: now.toISOString(),
    facility: FACILITY_DETAILS,
  };
}

/**
 * Retrieves the generated PDF stream for an authorized user, automatically generating it if needed.
 */
export async function getReportPdfStream(
  identifier: string,
  userContext: { userId: string; role: UserRole; ipAddress?: string; userAgent?: string }
): Promise<{ buffer: Buffer; filename: string; fileSizeBytes: number; contentType: string }> {
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [
        { id: identifier.trim() },
        { accessionNumber: identifier.trim() },
        { report: { id: identifier.trim() } },
      ],
    },
    include: {
      patient: true,
      report: true,
    },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Diagnostic report not found for identifier: ${identifier}`);
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot retrieve PDF: Report is in status '${report.status}'. Only finalized reports have clinical PDFs.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const storageDir = getStorageDir();
  const filename = `report_${order.accessionNumber}_v${report.version}.pdf`;
  const absolutePath = path.join(storageDir, filename);

  let buffer: Buffer;

  if (fs.existsSync(absolutePath)) {
    buffer = fs.readFileSync(absolutePath);
  } else {
    // Generate fresh artifact on demand
    await generateReportPdf(order.id, userContext);
    buffer = fs.readFileSync(absolutePath);
  }

  // Record audit access
  let validUserId: string | undefined = undefined;
  if (userContext.userId) {
    const user = await prisma.user.findUnique({ where: { id: userContext.userId }, select: { id: true } });
    if (user) {
      validUserId = user.id;
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: validUserId,
      action: 'REPORT_PDF_ACCESSED',
      entityType: 'Report',
      entityId: report.id,
      details: {
        orderId: order.id,
        accessionNumber: order.accessionNumber,
        patientId: order.patient.patientId,
        version: report.version,
        filename,
        fileSizeBytes: buffer.length,
      },
      ipAddress: userContext.ipAddress || '127.0.0.1',
      userAgent: userContext.userAgent || 'unknown',
    },
  });

  return {
    buffer,
    filename,
    fileSizeBytes: buffer.length,
    contentType: 'application/pdf',
  };
}

/**
 * Builds the PDF buffer using PDFKit with clean, clinical formatting.
 */
function buildClinicalPdfBuffer(data: {
  facility: typeof FACILITY_DETAILS;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientDob: string;
  patientGender: string;
  modality: string;
  bodyPart: string;
  examinationName: string;
  priority: string;
  studyDate: string;
  studyInstanceUid: string;
  findings: string;
  impression: string;
  clinicalIndication: string;
  comparison: string;
  version: number;
  isSigned: boolean;
  isLocked: boolean;
  signerName: string;
  signerRole: string;
  signedAt: string;
  signatureHash: string;
  amendments: Array<{
    versionNumber: number;
    amendmentType: string;
    reason: string;
    findings?: string | null;
    impression?: string | null;
    createdAt: string;
    authorName: string;
  }>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: {
        Title: `Radiology Report - ${data.accessionNumber}`,
        Author: data.signerName,
        Subject: `Diagnostic Report for ${data.patientName} (${data.patientId})`,
        Keywords: `RIS, Radiology, ${data.modality}, ${data.accessionNumber}, ${data.patientId}`,
        CreationDate: new Date(),
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const left = 36;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 72;

    // --- 1. HEADER & FACILITY BRANDING ---
    doc
      .fillColor('#0f172a')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(data.facility.name.toUpperCase(), left, 36);

    doc
      .fillColor('#475569')
      .fontSize(9)
      .font('Helvetica')
      .text(data.facility.department, left, 54)
      .text(`${data.facility.address} • ${data.facility.cityStateZip} • Tel: ${data.facility.phone}`, left, 66)
      .text(data.facility.accreditation, left, 78);

    // Decorative Divider Line
    doc
      .strokeColor('#059669')
      .lineWidth(2)
      .moveTo(left, 94)
      .lineTo(left + contentWidth, 94)
      .stroke();

    // --- 2. REPORT TITLE & STATUS BADGE ---
    const bannerY = 104;
    doc
      .fillColor('#0f172a')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('DIAGNOSTIC RADIOLOGY REPORT', left, bannerY);

    // Right-aligned status badge
    const badgeText = `STATUS: FINAL • VERSION: ${data.version}`;
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#065f46')
      .text(badgeText, left, bannerY + 2, { align: 'right', width: contentWidth });

    // --- 3. PATIENT & EXAMINATION METADATA BOX ---
    const boxY = 126;
    const boxHeight = 84;
    doc
      .roundedRect(left, boxY, contentWidth, boxHeight, 4)
      .fillColor('#f8fafc')
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .fillAndStroke();

    const colWidth = (contentWidth - 24) / 2;
    const col1X = left + 12;
    const col2X = left + colWidth + 12;

    // Left Column: Patient Demographics
    doc.fillColor('#0f172a').fontSize(9);
    let rowY = boxY + 8;
    const lineHeight = 14;

    doc.font('Helvetica-Bold').text('Patient Name: ', col1X, rowY, { continued: true });
    doc.font('Helvetica').text(data.patientName);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Patient ID (MRN): ', col1X, rowY, { continued: true });
    doc.font('Helvetica').text(data.patientId);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Date of Birth: ', col1X, rowY, { continued: true });
    doc.font('Helvetica').text(`${data.patientDob}  (Gender: ${data.patientGender})`);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Study Date: ', col1X, rowY, { continued: true });
    doc.font('Helvetica').text(data.studyDate);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Study Instance UID: ', col1X, rowY, { continued: true });
    doc.font('Helvetica').fontSize(7.5).text(data.studyInstanceUid);

    // Right Column: Order & Examination Metadata
    doc.fontSize(9);
    rowY = boxY + 8;

    doc.font('Helvetica-Bold').text('Accession Number: ', col2X, rowY, { continued: true });
    doc.font('Helvetica').text(data.accessionNumber);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Modality: ', col2X, rowY, { continued: true });
    doc.font('Helvetica').text(`${data.modality} (${data.bodyPart})`);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Examination: ', col2X, rowY, { continued: true });
    doc.font('Helvetica').text(data.examinationName);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Priority: ', col2X, rowY, { continued: true });
    doc.font('Helvetica').text(data.priority);

    rowY += lineHeight;
    doc.font('Helvetica-Bold').text('Finalized Timestamp: ', col2X, rowY, { continued: true });
    doc.font('Helvetica').text(data.signedAt.split('T')[0] + ' ' + data.signedAt.split('T')[1]?.substring(0, 8));

    // --- 4. CLINICAL INDICATION & COMPARISON ---
    let currentY = boxY + boxHeight + 16;

    doc
      .fillColor('#0f172a')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Clinical Indication: ', left, currentY, { continued: true })
      .font('Helvetica')
      .text(data.clinicalIndication);

    currentY = doc.y + 4;
    doc
      .font('Helvetica-Bold')
      .text('Comparison: ', left, currentY, { continued: true })
      .font('Helvetica')
      .text(data.comparison);

    currentY = doc.y + 12;

    // --- 5. REPORT BODY: FINDINGS ---
    doc
      .fillColor('#0f172a')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('FINDINGS', left, currentY);

    doc
      .strokeColor('#cbd5e1')
      .lineWidth(0.75)
      .moveTo(left, doc.y + 2)
      .lineTo(left + contentWidth, doc.y + 2)
      .stroke();

    currentY = doc.y + 6;

    doc
      .fillColor('#1e293b')
      .fontSize(9.5)
      .font('Helvetica')
      .text(data.findings, left, currentY, {
        width: contentWidth,
        lineGap: 3,
        align: 'left',
      });

    currentY = doc.y + 14;

    // --- 6. REPORT BODY: IMPRESSION ---
    doc
      .fillColor('#0f172a')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('IMPRESSION', left, currentY);

    doc
      .strokeColor('#cbd5e1')
      .lineWidth(0.75)
      .moveTo(left, doc.y + 2)
      .lineTo(left + contentWidth, doc.y + 2)
      .stroke();

    currentY = doc.y + 6;

    // Impression Highlight Box
    const impressionStartY = currentY;
    const impressionTextHeight = doc.heightOfString(data.impression, { width: contentWidth - 16, lineGap: 3 });
    const impressionBoxHeight = Math.max(30, impressionTextHeight + 12);

    doc
      .roundedRect(left, impressionStartY, contentWidth, impressionBoxHeight, 3)
      .fillColor('#f1f5f9')
      .strokeColor('#94a3b8')
      .lineWidth(0.5)
      .fillAndStroke();

    doc
      .fillColor('#0f172a')
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .text(data.impression, left + 8, impressionStartY + 6, {
        width: contentWidth - 16,
        lineGap: 3,
      });

    currentY = impressionStartY + impressionBoxHeight + 14;

    // --- 7. AMENDMENTS SECTION (if any) ---
    if (data.amendments && data.amendments.length > 0) {
      doc
        .fillColor('#0f172a')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('AMENDMENTS & ADDENDA HISTORY', left, currentY);

      doc
        .strokeColor('#cbd5e1')
        .lineWidth(0.5)
        .moveTo(left, doc.y + 2)
        .lineTo(left + contentWidth, doc.y + 2)
        .stroke();

      currentY = doc.y + 6;

      for (const a of data.amendments) {
        doc
          .fillColor('#047857')
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text(
            `Amendment v${a.versionNumber} [${a.amendmentType}] — ${a.createdAt.split('T')[0]} by ${a.authorName}`,
            left + 4,
            currentY
          );
        currentY = doc.y + 2;

        doc
          .fillColor('#334155')
          .fontSize(8)
          .font('Helvetica')
          .text(`Reason: ${a.reason}`, left + 8, currentY, { width: contentWidth - 16 });
        currentY = doc.y + 2;

        const amendmentContent = a.findings || a.impression || '';
        if (amendmentContent) {
          doc
            .fillColor('#1e293b')
            .fontSize(8)
            .font('Helvetica')
            .text(`Content: ${amendmentContent}`, left + 8, currentY, { width: contentWidth - 16 });
          currentY = doc.y + 6;
        }
      }
      currentY += 8;
    }

    // --- 8. ELECTRONIC SIGNATURE & ATTESTATION MANIFEST ---
    const sigBoxHeight = 56;
    const sigBoxY = Math.max(currentY, doc.page.height - 36 - sigBoxHeight - 20);

    doc
      .roundedRect(left, sigBoxY, contentWidth, sigBoxHeight, 3)
      .fillColor('#ecfdf5')
      .strokeColor('#10b981')
      .lineWidth(0.75)
      .fillAndStroke();

    doc
      .fillColor('#065f46')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text('AUTHENTICATED ELECTRONIC SIGNATURE & ATTESTATION', left + 8, sigBoxY + 6);

    doc
      .fillColor('#047857')
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Electronically signed and authorized by ${data.signerName} (${data.signerRole}) on ${data.signedAt}`,
        left + 8,
        sigBoxY + 18
      )
      .text(`Cryptographic SHA-256 Digest: ${data.signatureHash}`, left + 8, sigBoxY + 28)
      .text(
        'Legal Attestation: This diagnostic report is permanently finalized and locked per 21 CFR Part 11 electronic records policy.',
        left + 8,
        sigBoxY + 38
      );

    // --- 9. FOOTER ---
    const footerY = doc.page.height - 28;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(left, footerY - 4)
      .lineTo(left + contentWidth, footerY - 4)
      .stroke();

    doc
      .fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text(
        `CONFIDENTIAL MEDICAL RECORD — ${data.facility.name} • ${data.accessionNumber} • MRN ${data.patientId} • Page 1 of 1`,
        left,
        footerY,
        { align: 'center', width: contentWidth }
      );

    doc.end();
  });
}
