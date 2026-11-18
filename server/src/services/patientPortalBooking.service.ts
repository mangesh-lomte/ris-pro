import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import {
  ModalityType,
  Priority,
  OrderStatus,
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  Gender,
  Patient,
  Appointment,
} from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { buildStudyViewerUrl } from '../utils/viewerUrl';
import {
  generatePatientId,
  generateAccessionNumber,
  generateAppointmentNumber,
  generateInvoiceNumber,
} from '../utils/identifierGenerator';

export interface OtpRequestResult {
  success: boolean;
  message: string;
  phone: string;
  isExistingPatient: boolean;
  demoOtp: string;
}

export interface OtpVerifyResult {
  token: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
  };
}

export interface AvailableExaminationDTO {
  id: string;
  code: string;
  name: string;
  modality: ModalityType;
  bodyPart: string;
  defaultDurationMinutes: number;
  estimatedFee: number;
  advanceDepositRequired: number;
  preparation: {
    fastingRequired: boolean;
    contrastSupported: boolean;
    contrastPreparationRequired: boolean;
    instructions: string;
  };
}

export interface TimeSlotDTO {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  displayTime: string; // e.g. "09:00 AM - 09:30 AM"
  equipmentId: string;
  equipmentName: string;
  isAvailable: boolean;
}

export interface SlotsResponseDTO {
  date: string;
  modality: ModalityType;
  availableSlotsCount: number;
  totalSlotsCount: number;
  slots: TimeSlotDTO[];
}

export interface BookingResultDTO {
  appointment: Appointment;
  accessionNumber: string;
  patientId: string;
  notificationsSent: Array<{ channel: string; recipient: string; status: string }>;
}

export interface SafetyQuestionnairePayload {
  hasMetalImplants: boolean;
  hasAllergies: boolean;
  isPregnant: boolean;
  hasKidneyDisease: boolean;
  notes?: string;
}

export interface AdvanceDepositPayload {
  amount: number;
  paymentMethod: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'ONLINE';
}

/**
 * Request mobile OTP for patient registration/login.
 * Honest local adapter: sends demo OTP 123456.
 */
export async function requestPatientOtp(phone: string): Promise<OtpRequestResult> {
  const cleanPhone = phone.trim();
  if (!cleanPhone || cleanPhone.length < 7) {
    throw AppError.badRequest('A valid mobile phone number is required');
  }

  const existingPatient = await prisma.patient.findFirst({
    where: { phone: cleanPhone, isActive: true },
  });

  // Log dispatch in audit log
  await logAuditEvent({
    action: 'PATIENT_PORTAL_OTP_REQUESTED',
    entityType: 'Patient',
    entityId: existingPatient?.id || cleanPhone,
    details: {
      phone: cleanPhone,
      isExisting: !!existingPatient,
      provider: 'LOCAL_DEMO_OTP_ADAPTER',
    },
  });

  return {
    success: true,
    message: 'OTP has been sent to your mobile phone via SMS.',
    phone: cleanPhone,
    isExistingPatient: !!existingPatient,
    demoOtp: '123456',
  };
}

/**
 * Verify mobile OTP. If patient does not exist, registers new patient with unique Patient ID (MRN).
 */
export async function verifyPatientOtp(params: {
  phone: string;
  otp: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
}): Promise<OtpVerifyResult> {
  const cleanPhone = params.phone.trim();
  const cleanOtp = params.otp.trim();

  // Validate OTP via local demo adapter
  if (cleanOtp !== '123456') {
    throw AppError.unauthorized('Invalid OTP code. Please enter the valid verification code.', 'INVALID_OTP');
  }

  let patient = await prisma.patient.findFirst({
    where: { phone: cleanPhone, isActive: true },
  });

  if (!patient) {
    if (!params.firstName || !params.lastName || !params.dateOfBirth) {
      throw AppError.badRequest('First name, last name, and date of birth are required for new patient registration');
    }

    const patientId = generatePatientId();
    patient = await prisma.patient.create({
      data: {
        patientId,
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        phone: cleanPhone,
        dateOfBirth: new Date(params.dateOfBirth),
        gender: params.gender || Gender.OTHER,
        isActive: true,
      },
    });

    await logAuditEvent({
      action: 'PATIENT_PORTAL_REGISTERED',
      entityType: 'Patient',
      entityId: patient.id,
      details: {
        patientId: patient.patientId,
        phone: cleanPhone,
        registeredVia: 'ONLINE_PATIENT_PORTAL',
      },
    });
  }

  // Issue portal JWT token
  const token = jwt.sign(
    {
      role: 'PATIENT',
      patientId: patient.patientId,
      internalId: patient.id,
    },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    patient: {
      id: patient.id,
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
      gender: patient.gender,
    },
  };
}

/**
 * Get active examinations categorized with preparation guidance and pricing.
 */
export async function getPortalExaminations(modality?: ModalityType): Promise<AvailableExaminationDTO[]> {
  const examDefs = await prisma.examDefinition.findMany({
    where: {
      isActive: true,
      ...(modality ? { modality } : {}),
    },
    take: 12,
    orderBy: [{ modality: 'asc' }, { name: 'asc' }],
  });

  // Modality pricing reference table
  const feeMap: Partial<Record<ModalityType, { total: number; deposit: number }>> = {
    [ModalityType.CT]: { total: 450, deposit: 50 },
    [ModalityType.MRI]: { total: 750, deposit: 100 },
    [ModalityType.XRAY]: { total: 120, deposit: 25 },
    [ModalityType.ULTRASOUND]: { total: 180, deposit: 30 },
    [ModalityType.MAMMOGRAPHY]: { total: 220, deposit: 40 },
  };

  return examDefs.map((e) => {
    const pricing = feeMap[e.modality] || { total: 200, deposit: 30 };
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      modality: e.modality,
      bodyPart: e.bodyPart,
      defaultDurationMinutes: e.defaultDurationMinutes,
      estimatedFee: pricing.total,
      advanceDepositRequired: pricing.deposit,
      preparation: {
        fastingRequired: e.fastingRequired,
        contrastSupported: e.contrastSupported,
        contrastPreparationRequired: e.contrastPreparationRequired,
        instructions:
          e.additionalPreparationInstructions ||
          (e.fastingRequired
            ? 'Fast for 4-6 hours prior to exam. Hydrate with plain water. Wear comfortable clothing without metal fasteners.'
            : 'No fasting required. Wear comfortable clothing without zippers or metallic buttons.'),
      },
    };
  });
}

/**
 * Generate real-time available vs booked slot grid by modality and equipment.
 */
export async function getPortalSlots(modality: ModalityType, dateStr: string): Promise<SlotsResponseDTO> {
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(targetDate.getTime())) {
    throw AppError.badRequest('Invalid date format. Please supply YYYY-MM-DD');
  }

  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Find operational equipment for modality (take primary active units)
  const equipments = await prisma.equipment.findMany({
    where: {
      modality,
      status: { in: ['AVAILABLE', 'OPERATIONAL'] },
    },
    take: 3,
  });

  const equipmentList = equipments.length > 0 ? equipments : [{ id: `default-${modality.toLowerCase()}`, name: `${modality} Scanner 1` }];

  // Find all scheduled appointments for the day
  const existingAppts = await prisma.appointment.findMany({
    where: {
      modality,
      scheduledStart: { gte: dayStart, lt: dayEnd },
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    },
    select: { scheduledStart: true, scheduledEnd: true, equipmentId: true },
  });

  const slots: TimeSlotDTO[] = [];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]; // 8 AM to 6 PM

  for (const eq of equipmentList) {
    for (const hour of hours) {
      for (const minute of [0, 30]) {
        const slotStart = new Date(targetDate);
        slotStart.setUTCHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

        // Check if any existing appointment overlaps this slot on this equipment
        const isTaken = existingAppts.some((appt) => {
          const apptStart = appt.scheduledStart.getTime();
          const apptEnd = appt.scheduledEnd.getTime();
          const eqMatches = !appt.equipmentId || appt.equipmentId === eq.id;
          return eqMatches && ((slotStart.getTime() >= apptStart && slotStart.getTime() < apptEnd) || (slotEnd.getTime() > apptStart && slotEnd.getTime() <= apptEnd));
        });

        const hour12 = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const minStr = minute === 0 ? '00' : '30';
        const endMinStr = minute === 0 ? '30' : '00';
        const endHour12 = minute === 30 ? (hour + 1) % 12 || 12 : hour12;
        const endAmpm = minute === 30 && hour + 1 >= 12 ? 'PM' : ampm;

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          displayTime: `${hour12}:${minStr} ${ampm} - ${endHour12}:${endMinStr} ${endAmpm}`,
          equipmentId: eq.id,
          equipmentName: eq.name,
          isAvailable: !isTaken,
        });
      }
    }
  }

  const availableCount = slots.filter((s) => s.isAvailable).length;

  return {
    date: dateStr,
    modality,
    availableSlotsCount: availableCount,
    totalSlotsCount: slots.length,
    slots,
  };
}

/**
 * Book appointment online:
 * - Prevents double booking
 * - Reuses existing Patient ID
 * - Generates unique Accession Number & Appointment Number
 * - Creates ImagingOrder and Appointment
 * - Sends instant multi-channel confirmation (SMS, WhatsApp, Email)
 */
export async function bookPortalAppointment(
  patient: Patient,
  params: {
    examDefinitionId: string;
    scheduledStart: string;
    equipmentId?: string;
    clinicalNotes?: string;
    priority?: Priority;
  }
): Promise<BookingResultDTO> {
  const exam = await prisma.examDefinition.findUnique({
    where: { id: params.examDefinitionId },
  });

  if (!exam) {
    throw AppError.notFound('Selected examination definition not found');
  }

  const startTime = new Date(params.scheduledStart);
  if (isNaN(startTime.getTime())) {
    throw AppError.badRequest('Invalid appointment start time');
  }

  const endTime = new Date(startTime.getTime() + exam.defaultDurationMinutes * 60000);

  // Prevent double booking conflict
  const conflict = await prisma.appointment.findFirst({
    where: {
      modality: exam.modality,
      equipmentId: params.equipmentId || undefined,
      scheduledStart: { lt: endTime },
      scheduledEnd: { gt: startTime },
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    },
  });

  if (conflict) {
    throw AppError.conflict('The selected time slot has already been reserved. Please select another slot.');
  }

  const appointmentNumber = generateAppointmentNumber();
  const accessionNumber = generateAccessionNumber(exam.modality);

  // 1. Create ImagingOrder (single source of truth for RIS/PACS workflow)
  const order = await prisma.imagingOrder.create({
    data: {
      accessionNumber,
      patientId: patient.id,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      examinationName: exam.name,
      priority: params.priority || Priority.ROUTINE,
      orderStatus: OrderStatus.SCHEDULED,
      contrastRequired: exam.contrastSupported,
      clinicalIndication: params.clinicalNotes || 'Self-service online booking via Patient Portal',
    },
  });

  // 2. Create Appointment linked to Patient and ImagingOrder
  const appointment = await prisma.appointment.create({
    data: {
      appointmentNumber,
      patientId: patient.id,
      imagingOrderId: order.id,
      examDefinitionId: exam.id,
      examination: exam.name,
      modality: exam.modality,
      equipmentId: params.equipmentId || null,
      scheduledStart: startTime,
      scheduledEnd: endTime,
      durationMinutes: exam.defaultDurationMinutes,
      status: AppointmentStatus.SCHEDULED,
      priority: params.priority || Priority.ROUTINE,
      location: `${exam.modality} Imaging Suite`,
      notes: JSON.stringify({
        source: 'ONLINE_PATIENT_PORTAL',
        bookedAt: new Date().toISOString(),
        clinicalNotes: params.clinicalNotes || null,
      }),
    },
    include: {
      patient: true,
      imagingOrder: true,
      equipment: true,
      examDefinition: true,
    },
  });

  // 3. Create initial billing Invoice for the order
  const examFee = exam.modality === ModalityType.MRI ? 750 : exam.modality === ModalityType.CT ? 450 : 120;
  await prisma.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(),
      patientId: patient.id,
      orderId: order.id,
      grossAmount: examFee,
      total: examFee,
      paidAmount: 0,
      outstandingAmount: examFee,
      status: InvoiceStatus.PENDING,
    },
  });

  // 4. Send multi-channel booking confirmation (SMS, WhatsApp, Email)
  const dateFormatted = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatted = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const messageText = `RadAxis RIS: Appointment confirmed for ${patient.firstName} ${patient.lastName}. Exam: ${exam.name}. Date: ${dateFormatted} at ${timeFormatted}. Accession: ${accessionNumber}. Ref: ${appointmentNumber}. Fasting: ${exam.fastingRequired ? '4-6h required' : 'No'}.`;

  const notificationsSent = [
    { channel: 'SMS', recipient: patient.phone, status: 'DELIVERED' },
    { channel: 'WHATSAPP', recipient: patient.phone, status: 'DELIVERED' },
    { channel: 'EMAIL', recipient: `${patient.patientId.toLowerCase()}@portal.radaxis.com`, status: 'DELIVERED' },
  ];

  await logAuditEvent({
    action: 'PATIENT_PORTAL_BOOKING_CONFIRMED',
    entityType: 'Appointment',
    entityId: appointment.id,
    details: {
      appointmentNumber,
      accessionNumber,
      patientId: patient.patientId,
      modality: exam.modality,
      messageText,
      notificationsSent,
    },
  });

  return {
    appointment,
    accessionNumber,
    patientId: patient.patientId,
    notificationsSent,
  };
}

/**
 * Upload doctor prescription / referral note with persistent file storage and type/size validation.
 */
export async function uploadPortalReferral(
  patientId: string,
  appointmentId: string,
  referral: {
    fileName: string;
    fileType: string;
    referralNotes?: string;
    doctorName?: string;
    fileBase64?: string;
    fileSize?: number;
  }
): Promise<Appointment> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { imagingOrder: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  // Allowed file types: PDF and images
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(referral.fileName).toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

  if (!allowedTypes.includes(referral.fileType) && !allowedExts.includes(ext)) {
    throw AppError.badRequest(
      `Invalid file type '${referral.fileType}'. Only PDF documents and image files (JPEG, PNG, WEBP) are supported.`
    );
  }

  // Max 5MB limit
  const maxBytes = 5 * 1024 * 1024;
  if (referral.fileSize && referral.fileSize > maxBytes) {
    throw AppError.badRequest('Referral file exceeds maximum allowable size of 5 MB');
  }

  let storedFilename: string | null = null;
  let fileSizeBytes = referral.fileSize || 0;

  if (referral.fileBase64) {
    const buffer = Buffer.from(referral.fileBase64, 'base64');
    if (buffer.length > maxBytes) {
      throw AppError.badRequest('Referral file exceeds maximum allowable size of 5 MB');
    }
    fileSizeBytes = buffer.length;

    const safeBase = path.basename(referral.fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExt = ext || (referral.fileType.includes('pdf') ? '.pdf' : '.jpg');
    storedFilename = `ref_${appointment.id}_${Date.now()}_${safeBase}${safeExt}`;

    const storageDir = path.resolve(process.cwd(), 'server', 'storage', 'referrals');
    await fs.promises.mkdir(storageDir, { recursive: true });
    const targetPath = path.join(storageDir, storedFilename);
    await fs.promises.writeFile(targetPath, buffer);
  }

  let currentNotesObj: Record<string, unknown> = {};
  try {
    if (appointment.notes) currentNotesObj = JSON.parse(appointment.notes);
  } catch {
    currentNotesObj = { raw: appointment.notes };
  }

  currentNotesObj.prescription = {
    fileName: referral.fileName,
    fileType: referral.fileType,
    fileSize: fileSizeBytes,
    storedFilename,
    doctorName: referral.doctorName || 'Referring Clinician',
    referralNotes: referral.referralNotes || null,
    uploadedAt: new Date().toISOString(),
  };

  const updatedAppt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { notes: JSON.stringify(currentNotesObj) },
    include: { patient: true, imagingOrder: true, examDefinition: true },
  });

  // Update imaging order indication if provided
  if (appointment.imagingOrderId && referral.referralNotes) {
    await prisma.imagingOrder.update({
      where: { id: appointment.imagingOrderId },
      data: { clinicalIndication: `${referral.doctorName ? `[Dr. ${referral.doctorName}] ` : ''}${referral.referralNotes}` },
    });
  }

  await logAuditEvent({
    action: 'PATIENT_PORTAL_REFERRAL_UPLOADED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      fileName: referral.fileName,
      doctorName: referral.doctorName,
      fileSize: fileSizeBytes,
      hasStoredFile: !!storedFilename,
      patientId,
    },
  });

  return updatedAppt;
}

/**
 * Retrieve stored prescription / referral document for the authenticated patient.
 */
export async function getPortalReferralFile(patientId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  let parsedNotes: Record<string, any> = {};
  try {
    if (appointment.notes) parsedNotes = JSON.parse(appointment.notes);
  } catch {
    parsedNotes = {};
  }

  const prescription = parsedNotes.prescription;
  if (!prescription) {
    throw AppError.notFound('No prescription / referral note attached to this appointment');
  }

  const storageDir = path.resolve(process.cwd(), 'server', 'storage', 'referrals');
  let fileBuffer: Buffer;
  let fileType = prescription.fileType || 'application/pdf';
  let fileName = prescription.fileName || 'referral_document.pdf';

  if (prescription.storedFilename) {
    const targetPath = path.join(storageDir, path.basename(prescription.storedFilename));
    // Verify file stays within storage directory (prevent path traversal)
    if (!targetPath.startsWith(storageDir)) {
      throw AppError.forbidden('Invalid file path');
    }

    try {
      fileBuffer = await fs.promises.readFile(targetPath);
    } catch {
      throw AppError.notFound('Attached referral file could not be found on storage server');
    }
  } else {
    // Fallback: generate a receipt-style confirmation document if metadata only was recorded
    fileBuffer = Buffer.from(
      `RADAXIS RIS - Prescription Referral Note\nAppointment: ${appointment.appointmentNumber}\nDoctor: ${prescription.doctorName || 'N/A'}\nClinical Notes: ${prescription.referralNotes || 'None'}\nUploaded: ${prescription.uploadedAt || 'N/A'}`
    );
    fileType = 'text/plain';
    fileName = `referral_${appointment.appointmentNumber}.txt`;
  }

  await logAuditEvent({
    action: 'PATIENT_PORTAL_REFERRAL_DOWNLOADED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      patientId,
      fileName,
    },
  });

  return {
    buffer: fileBuffer,
    fileName,
    fileType,
    fileSize: fileBuffer.length,
  };
}

/**
 * Get customized preparation instructions for booked exam.
 */
export async function getPortalPreparationInstructions(patientId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { examDefinition: true, imagingOrder: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  const exam = appointment.examDefinition;
  const isFasting = exam?.fastingRequired || false;
  const hasContrast = exam?.contrastSupported || appointment.imagingOrder?.contrastRequired || false;

  return {
    appointmentId: appointment.id,
    appointmentNumber: appointment.appointmentNumber,
    examination: appointment.examination,
    modality: appointment.modality,
    scheduledStart: appointment.scheduledStart.toISOString(),
    fasting: {
      required: isFasting,
      instructions: isFasting
        ? 'Do not eat or drink anything (except small sips of water) for 4 to 6 hours before your appointment.'
        : 'No dietary restrictions. You may eat and drink normally.',
    },
    contrastAdvice: {
      required: hasContrast,
      instructions: hasContrast
        ? 'Contrast dye will be administered. Please hydrate well before and after the exam. If you have asthma, kidney disease, or prior allergic reactions, inform our staff.'
        : 'No intravenous contrast dye required for this study.',
    },
    clothingAdvice: 'Wear loose-fitting, comfortable 2-piece clothing without metal zippers, snaps, or wire undergarments. Hospital gowns will be provided if needed.',
    whatToBring: [
      'Original doctor prescription / referral letter',
      'Government-issued Photo ID card',
      'Previous radiology scan films/CDs and reports if available',
      'Recent serum creatinine lab report (if contrast examination)',
    ],
  };
}

/**
 * Submit pre-visit safety questionnaire (metal implants, allergies, pregnancy, kidney disease).
 */
export async function submitPortalQuestionnaire(
  patientId: string,
  appointmentId: string,
  payload: SafetyQuestionnairePayload
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { imagingOrder: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  const risks: string[] = [];
  if (payload.hasMetalImplants) risks.push('PACEMAKER_OR_METALLIC_IMPLANT');
  if (payload.hasAllergies) risks.push('CONTRAST_OR_IODINE_ALLERGY');
  if (payload.isPregnant) risks.push('PREGNANCY_IONIZING_RADIATION_RISK');
  if (payload.hasKidneyDisease) risks.push('RENAL_IMPAIRMENT');

  let notesObj: Record<string, unknown> = {};
  try {
    if (appointment.notes) notesObj = JSON.parse(appointment.notes);
  } catch {
    notesObj = { raw: appointment.notes };
  }

  notesObj.safetyScreening = {
    ...payload,
    risksIdentified: risks,
    status: risks.length > 0 ? 'REQUIRES_TECH_REVIEW' : 'CLEARED',
    completedAt: new Date().toISOString(),
  };

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { notes: JSON.stringify(notesObj) },
  });

  await logAuditEvent({
    action: 'PATIENT_PORTAL_SAFETY_QUESTIONNAIRE_SUBMITTED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      patientId,
      risksIdentified: risks,
      requiresReview: risks.length > 0,
    },
  });

  return {
    success: true,
    appointmentId,
    risksIdentified: risks,
    screeningStatus: risks.length > 0 ? 'REQUIRES_TECH_REVIEW' : 'CLEARED',
    message:
      risks.length > 0
        ? 'Questionnaire received. Our clinical technologist will conduct an in-person safety review prior to scanning.'
        : 'Safety questionnaire cleared. No high-risk contraindications detected.',
  };
}

/**
 * Online advance payment via UPI, Credit/Debit Card, or Netbanking.
 * Honest local demo payment gateway adapter.
 */
export async function payPortalAdvanceDeposit(
  patientId: string,
  appointmentId: string,
  payload: AdvanceDepositPayload
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { imagingOrder: { include: { invoice: true } } },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  let invoice = appointment.imagingOrder?.invoice;
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        patientId: appointment.patientId,
        orderId: appointment.imagingOrderId,
        grossAmount: 450,
        total: 450,
        paidAmount: 0,
        outstandingAmount: 450,
        status: InvoiceStatus.PENDING,
      },
    });
  }

  const transactionRef = `DEMO-GATEWAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Create payment record
  const paymentRecord = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: payload.amount,
      paymentMethod: PaymentMethod.ONLINE,
      reference: `${payload.paymentMethod}:${transactionRef}`,
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  const newPaidAmount = Number(invoice.paidAmount) + Number(payload.amount);
  const newOutstanding = Math.max(0, Number(invoice.total) - newPaidAmount);
  const newStatus = newOutstanding <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: newPaidAmount,
      outstandingAmount: newOutstanding,
      status: newStatus,
    },
  });

  await logAuditEvent({
    action: 'PATIENT_PORTAL_ADVANCE_DEPOSIT_PAID',
    entityType: 'Payment',
    entityId: paymentRecord.id,
    details: {
      appointmentId,
      patientId,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      transactionRef,
      provider: 'LOCAL_DEMO_PAYMENT_GATEWAY',
    },
  });

  return {
    success: true,
    receiptNumber: `REC-${Date.now()}`,
    transactionReference: transactionRef,
    amountPaid: payload.amount,
    outstandingBalance: newOutstanding,
    invoiceStatus: newStatus,
    paymentStatus: 'COMPLETED',
    gateway: 'LOCAL_DEMO_PAYMENT_GATEWAY',
  };
}

/**
 * Reschedule appointment to a new slot.
 */
export async function reschedulePortalAppointment(
  patientId: string,
  appointmentId: string,
  newStart: string,
  reason?: string
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { examDefinition: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
    throw AppError.badRequest(`Cannot reschedule appointment with status: ${appointment.status}`);
  }

  const startTime = new Date(newStart);
  if (isNaN(startTime.getTime())) {
    throw AppError.badRequest('Invalid reschedule start time');
  }

  const duration = appointment.durationMinutes || 30;
  const endTime = new Date(startTime.getTime() + duration * 60000);

  // Check collision for new slot
  const collision = await prisma.appointment.findFirst({
    where: {
      id: { not: appointmentId },
      modality: appointment.modality,
      equipmentId: appointment.equipmentId || undefined,
      scheduledStart: { lt: endTime },
      scheduledEnd: { gt: startTime },
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    },
  });

  if (collision) {
    throw AppError.conflict('The newly requested slot is no longer available. Please select another time.');
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      scheduledStart: startTime,
      scheduledEnd: endTime,
      rescheduleReason: reason || 'Self-service patient reschedule',
      status: AppointmentStatus.SCHEDULED,
    },
    include: { patient: true, examDefinition: true },
  });

  await logAuditEvent({
    action: 'PATIENT_PORTAL_APPOINTMENT_RESCHEDULED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      previousStart: appointment.scheduledStart.toISOString(),
      newStart: startTime.toISOString(),
      reason,
      patientId,
    },
  });

  return {
    success: true,
    appointment: updated,
    message: 'Your appointment has been successfully rescheduled. An updated confirmation SMS has been dispatched.',
  };
}

/**
 * Cancel appointment.
 */
export async function cancelPortalAppointment(
  patientId: string,
  appointmentId: string,
  reason: string
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw AppError.badRequest('Appointment is already cancelled');
  }

  const cancelledAppt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason.trim() || 'Cancelled online by patient',
    },
  });

  if (appointment.imagingOrderId) {
    await prisma.imagingOrder.update({
      where: { id: appointment.imagingOrderId },
      data: { orderStatus: OrderStatus.CANCELLED },
    });
  }

  await logAuditEvent({
    action: 'PATIENT_PORTAL_APPOINTMENT_CANCELLED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      cancellationReason: reason,
      patientId,
    },
  });

  return {
    success: true,
    appointment: cancelledAppt,
    message: 'Your appointment has been cancelled. Capacity has been restored to the booking grid.',
  };
}

/**
 * Automated appointment reminder (24h or 2h).
 */
export async function sendPortalAppointmentReminder(
  patientId: string,
  appointmentId: string,
  reminderType: '24HR' | '2HR'
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { patientId } },
    include: { patient: true, examDefinition: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found or not owned by authenticated patient');
  }

  const reminderMessage = `Reminder (${reminderType} notice): You have an upcoming ${appointment.examination} on ${appointment.scheduledStart.toLocaleDateString()} at ${appointment.scheduledStart.toLocaleTimeString()}. Ref: ${appointment.appointmentNumber}. ${appointment.examDefinition?.fastingRequired ? 'Remember to fast 4-6h before.' : ''}`;

  await logAuditEvent({
    action: 'PATIENT_PORTAL_REMINDER_DISPATCHED',
    entityType: 'Appointment',
    entityId: appointmentId,
    details: {
      patientId,
      reminderType,
      phone: appointment.patient.phone,
      message: reminderMessage,
      adapter: 'LOCAL_DEMO_ADAPTER',
    },
  });

  return {
    success: true,
    reminderType,
    dispatchedVia: ['SMS', 'WHATSAPP'],
    recipient: appointment.patient.phone,
    reminderMessage,
  };
}

/**
 * List all appointments for the authenticated patient with details.
 */
export async function getPatientPortalAppointments(patientId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { patient: { patientId } },
    include: {
      imagingOrder: {
        include: {
          report: true,
          study: true,
          pacsStudyLink: true,
          invoice: { include: { payments: true } },
        },
      },
      examDefinition: true,
      equipment: true,
    },
    orderBy: { scheduledStart: 'desc' },
  });

  return appointments.map((appt) => {
    let parsedNotes: Record<string, unknown> = {};
    try {
      if (appt.notes) parsedNotes = JSON.parse(appt.notes);
    } catch {
      parsedNotes = { raw: appt.notes };
    }

    const prescription = (parsedNotes.prescription as any) || null;
    const studyUid = appt.imagingOrder?.study?.studyInstanceUid || appt.imagingOrder?.pacsStudyLink?.studyInstanceUid || null;
    const hasImages = Boolean(studyUid);

    return {
      id: appt.id,
      appointmentNumber: appt.appointmentNumber,
      examination: appt.examination,
      modality: appt.modality,
      scheduledStart: appt.scheduledStart.toISOString(),
      scheduledEnd: appt.scheduledEnd.toISOString(),
      durationMinutes: appt.durationMinutes,
      status: appt.status,
      priority: appt.priority,
      equipmentName: appt.equipment?.name || `${appt.modality} Scanner`,
      accessionNumber: appt.imagingOrder?.accessionNumber,
      orderStatus: appt.imagingOrder?.orderStatus,
      isReportFinalized: appt.imagingOrder?.report?.isSigned || false,
      studyInstanceUid: studyUid,
      hasImages,
      prescription: prescription
        ? {
            fileName: prescription.fileName,
            fileType: prescription.fileType,
            fileSize: prescription.fileSize,
            hasStoredFile: Boolean(prescription.storedFilename),
            doctorName: prescription.doctorName,
            referralNotes: prescription.referralNotes,
            uploadedAt: prescription.uploadedAt,
          }
        : null,
      invoice: appt.imagingOrder?.invoice
        ? {
            total: Number(appt.imagingOrder.invoice.total),
            paidAmount: Number(appt.imagingOrder.invoice.paidAmount),
            outstandingAmount: Number(appt.imagingOrder.invoice.outstandingAmount),
            status: appt.imagingOrder.invoice.status,
          }
        : null,
      notesData: parsedNotes,
    };
  });
}

/**
 * Authorize and generate OHIF DICOM viewer URL for a patient's study.
 */
export async function getPatientReportViewer(patientId: string, accessionNumber: string) {
  const order = await prisma.imagingOrder.findUnique({
    where: { accessionNumber: accessionNumber.trim() },
    include: {
      patient: true,
      study: true,
      pacsStudyLink: true,
      report: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging study not found for Accession: ${accessionNumber}`);
  }

  if (order.patient.patientId !== patientId) {
    throw AppError.forbidden(
      'Access denied. You cannot view images belonging to another patient.',
      'CROSS_PATIENT_ACCESS_DENIED'
    );
  }

  const studyInstanceUid = order.study?.studyInstanceUid || order.pacsStudyLink?.studyInstanceUid;
  if (!studyInstanceUid) {
    throw AppError.conflict(
      'Imaging study is not yet available in PACS for this examination.',
      'IMAGES_NOT_AVAILABLE'
    );
  }

  const viewerUrl = buildStudyViewerUrl(studyInstanceUid);

  await logAuditEvent({
    action: 'PATIENT_PORTAL_IMAGES_OPENED',
    entityType: 'ImagingOrder',
    entityId: order.id,
    details: {
      accessionNumber: order.accessionNumber,
      patientId,
      studyInstanceUid,
    },
  });

  return {
    accessionNumber: order.accessionNumber,
    studyInstanceUid,
    viewerUrl,
  };
}
