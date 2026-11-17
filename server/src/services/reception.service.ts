import { prisma } from '../config/db';
import {
  generateUniqueAccessionNumber,
  generateUniqueAppointmentNumber,
  generateDailyQueueToken,
  generateUniquePatientId,
} from '../utils/identifierGenerator';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  ModalityType,
  OrderStatus,
  AppointmentStatus,
  Priority,
  Gender,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
} from '@prisma/client';

export interface RegisterWalkInInput {
  patientId?: string;
  // If patientId not supplied, register new patient inline
  newPatient?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | Date;
    gender: Gender;
    phone: string;
    email?: string;
  };
  modality: ModalityType;
  bodyPart: string;
  examinationName: string;
  clinicalIndication: string;
  priority?: Priority;
  referringDoctorId?: string;
  referringDoctorText?: string;
  contrastRequired?: boolean;
  equipmentId?: string;
  location?: string;
}

export interface ConsentFormInput {
  formType: 'GENERAL_CONSENT' | 'CONTRAST_CONSENT' | 'MRI_SAFETY_FORM' | 'PROCEDURE_CONSENT';
  signedByName: string;
  signedDate?: string;
  witnessName?: string;
  notes?: string;
  documentUrl?: string;
  status?: 'SIGNED' | 'EXEMPT';
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  discount?: number;
}

/**
 * 03.4 Walk-in registration: Create urgent or non-booked scan orders with immediate token issuance.
 */
export async function registerWalkIn(
  input: RegisterWalkInInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve or create patient
    let patient: any;

    if (input.patientId) {
      patient = await tx.patient.findFirst({
        where: { OR: [{ id: input.patientId }, { patientId: input.patientId }], isActive: true },
      });
      if (!patient) {
        throw AppError.notFound(`Patient not found with identifier: ${input.patientId}`);
      }
    } else if (input.newPatient) {
      const generatedPid = await generateUniquePatientId(tx);
      const dob =
        typeof input.newPatient.dateOfBirth === 'string'
          ? new Date(input.newPatient.dateOfBirth)
          : input.newPatient.dateOfBirth;

      patient = await tx.patient.create({
        data: {
          patientId: generatedPid,
          firstName: input.newPatient.firstName.trim(),
          lastName: input.newPatient.lastName.trim(),
          dateOfBirth: dob,
          gender: input.newPatient.gender,
          phone: input.newPatient.phone.trim(),
          email: input.newPatient.email?.trim() || null,
        },
      });

      await logAuditEvent({
        userId: context?.userId,
        action: 'PATIENT_REGISTERED',
        entityType: 'Patient',
        entityId: patient.patientId,
        details: { patientId: patient.patientId, walkIn: true },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    } else {
      throw AppError.badRequest('Either patientId or newPatient registration details must be provided');
    }

    // 2. Generate collision-safe Accession Number
    const accessionNumber = await generateUniqueAccessionNumber(tx, input.modality);
    const priority = input.priority || Priority.STAT; // Walk-ins default to STAT or URGENT

    // 3. Create ImagingOrder directly in READY_FOR_TECH
    const order = await tx.imagingOrder.create({
      data: {
        accessionNumber,
        patientId: patient.id,
        modality: input.modality,
        bodyPart: input.bodyPart,
        examinationName: input.examinationName,
        clinicalIndication: input.clinicalIndication,
        priority,
        referringDoctorId: input.referringDoctorId || null,
        referringDoctorText: input.referringDoctorText || 'Emergency / Walk-in Department',
        contrastRequired: input.contrastRequired || false,
        orderStatus: OrderStatus.READY_FOR_TECH,
        createdById: context?.userId || null,
      },
    });

    // 4. Generate daily queue token & immediate walk-in appointment record
    const appointmentNumber = await generateUniqueAppointmentNumber(tx);
    const tokenNumber = await generateDailyQueueToken(tx, input.modality);
    const now = new Date();
    const scheduledEnd = new Date(now.getTime() + 30 * 60000);

    const appointment = await tx.appointment.create({
      data: {
        appointmentNumber,
        patientId: patient.id,
        imagingOrderId: order.id,
        modality: input.modality,
        examination: input.examinationName,
        equipmentId: input.equipmentId || null,
        location: input.location || `${input.modality} Suite (Walk-in)`,
        scheduledStart: now,
        scheduledEnd,
        durationMinutes: 30,
        status: AppointmentStatus.CHECKED_IN,
        tokenNumber,
        checkedInAt: now,
        checkedInById: context?.userId || null,
        priority,
        notes: `Walk-in registration. Indication: ${input.clinicalIndication}`,
        createdById: context?.userId || null,
      },
    });

    // 5. Initialize Invoice for Walk-in
    const invCount = await tx.invoice.count();
    const invNum = `INV-${now.getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;
    const baseFee = input.modality === ModalityType.MRI ? 750 : input.modality === ModalityType.CT ? 450 : 150;

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: invNum,
        patientId: patient.id,
        orderId: order.id,
        total: baseFee,
        discount: 0,
        paidAmount: 0,
        outstandingAmount: baseFee,
        status: InvoiceStatus.PENDING,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'RECEPTION_WALK_IN_REGISTERED',
      entityType: 'ImagingOrder',
      entityId: order.accessionNumber,
      details: {
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        tokenNumber,
        priority,
        invoiceNumber: invoice.invoiceNumber,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      order,
      appointment,
      tokenNumber,
      accessionNumber: order.accessionNumber,
      patientId: patient.patientId,
      invoice,
    };
  });
}

/**
 * 03.9 Consent and forms: Collect signed forms and record copies under audit control.
 */
export async function recordOrderConsent(
  orderIdOrAccession: string,
  input: ConsentFormInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: orderIdOrAccession }, { accessionNumber: orderIdOrAccession }] },
    include: { patient: true, appointment: true },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${orderIdOrAccession}`);
  }

  const consentRecord = {
    formType: input.formType,
    signedByName: input.signedByName,
    signedDate: input.signedDate || new Date().toISOString(),
    witnessName: input.witnessName || null,
    notes: input.notes || null,
    documentUrl: input.documentUrl || null,
    status: input.status || 'SIGNED',
    recordedAt: new Date().toISOString(),
    recordedByUserId: context?.userId || null,
  };

  // Append to appointment notes as structured JSON
  if (order.appointment) {
    let existingNotes: any = {};
    try {
      if (order.appointment.notes && order.appointment.notes.startsWith('{')) {
        existingNotes = JSON.parse(order.appointment.notes);
      } else if (order.appointment.notes) {
        existingNotes = { rawNotes: order.appointment.notes };
      }
    } catch {
      existingNotes = { rawNotes: order.appointment.notes };
    }

    const consentList = existingNotes.consentForms || [];
    consentList.push(consentRecord);
    existingNotes.consentForms = consentList;

    await prisma.appointment.update({
      where: { id: order.appointment.id },
      data: { notes: JSON.stringify(existingNotes) },
    });
  }

  await logAuditEvent({
    userId: context?.userId,
    action: 'CONSENT_FORM_RECORDED',
    entityType: 'ImagingOrder',
    entityId: order.accessionNumber,
    details: {
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      formType: input.formType,
      signedByName: input.signedByName,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    success: true,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    consent: consentRecord,
  };
}

/**
 * 03.9 View consent forms for order.
 */
export async function getOrderConsent(orderIdOrAccession: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: orderIdOrAccession }, { accessionNumber: orderIdOrAccession }] },
    include: { patient: true, appointment: true },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${orderIdOrAccession}`);
  }

  let consentForms: any[] = [];
  if (order.appointment?.notes) {
    try {
      if (order.appointment.notes.startsWith('{')) {
        const parsed = JSON.parse(order.appointment.notes);
        consentForms = parsed.consentForms || [];
      }
    } catch {
      // notes was not JSON or parsing failed; fallback to empty consent forms
    }
  }

  return {
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`,
    consentForms,
  };
}

/**
 * 03.11 Patient instructions: Print preparation instructions and appointment slip.
 */
export async function getAppointmentSlip(appointmentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: {
      patient: true,
      imagingOrder: true,
      equipment: true,
      examDefinition: true,
    },
  });

  if (!appt) {
    throw AppError.notFound(`Appointment not found: ${appointmentId}`);
  }

  const examDef = appt.examDefinition;
  const fasting = examDef?.fastingRequired || false;
  const contrast = appt.imagingOrder?.contrastRequired || examDef?.contrastSupported || false;

  let preparationGuidance = 'Wear loose, comfortable clothing without metallic fasteners or jewelry.';
  if (fasting) {
    preparationGuidance = 'FASTING REQUIRED: Do not eat solid food for 4 to 6 hours before scan. Hydrate with plain water only.';
  }
  if (contrast) {
    preparationGuidance += ' Hydrate well with water before and after scan. Bring recent serum creatinine / eGFR reports if requested.';
  }
  if (appt.modality === ModalityType.MRI) {
    preparationGuidance += ' Remove all metal objects, hairpins, watches, hearing aids, and credit cards before entering the scanner suite.';
  }

  return {
    facilityName: 'RadAxis Imaging & Diagnostic Center',
    facilityAddress: '100 Medical Center Way, Suite 200',
    facilityPhone: '+1 (555) 019-8472',
    slipGeneratedAt: new Date().toISOString(),
    appointment: {
      id: appt.id,
      appointmentNumber: appt.appointmentNumber,
      tokenNumber: appt.tokenNumber || 'Awaiting Check-in',
      scheduledStart: appt.scheduledStart,
      scheduledEnd: appt.scheduledEnd,
      status: appt.status,
      modality: appt.modality,
      examination: appt.examination,
      location: appt.location || appt.equipment?.location || `${appt.modality} Suite`,
      equipmentName: appt.equipment?.name || `${appt.modality} Scanner`,
    },
    patient: {
      patientId: appt.patient.patientId,
      fullName: `${appt.patient.firstName} ${appt.patient.lastName}`,
      dateOfBirth: appt.patient.dateOfBirth.toISOString().slice(0, 10),
      gender: appt.patient.gender,
      phone: appt.patient.phone,
    },
    order: {
      accessionNumber: appt.imagingOrder?.accessionNumber || 'N/A',
      clinicalIndication: appt.imagingOrder?.clinicalIndication || 'Routine evaluation',
      priority: appt.priority,
      referringDoctor: appt.imagingOrder?.referringDoctorText || 'Internal Staff',
    },
    preparationInstructions: {
      fastingRequired: fasting,
      contrastRequired: contrast,
      arrivalTimeNotice: 'Please arrive 15 minutes before your scheduled examination time.',
      instructions: preparationGuidance,
    },
  };
}

/**
 * 03.12 Payment status: See due, paid, refund and part-payment status.
 */
export async function getOrderBilling(orderIdOrAccession: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: orderIdOrAccession }, { accessionNumber: orderIdOrAccession }] },
    include: {
      patient: true,
      invoice: {
        include: {
          payments: {
            orderBy: { paidAt: 'desc' },
          },
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${orderIdOrAccession}`);
  }

  let invoice = order.invoice;
  // If invoice does not yet exist, create initial pending invoice
  if (!invoice) {
    const invCount = await prisma.invoice.count();
    const now = new Date();
    const invNum = `INV-${now.getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;
    const baseFee = order.modality === ModalityType.MRI ? 750 : order.modality === ModalityType.CT ? 450 : 150;

    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invNum,
        patientId: order.patientId,
        orderId: order.id,
        grossAmount: baseFee,
        total: baseFee,
        discount: 0,
        paidAmount: 0,
        outstandingAmount: baseFee,
        status: InvoiceStatus.PENDING,
      },
      include: { payments: true },
    });
  }

  return {
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: Number(invoice.total),
      discount: Number(invoice.discount),
      paidAmount: Number(invoice.paidAmount),
      outstandingAmount: Number(invoice.outstandingAmount),
      status: invoice.status,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        reference: p.reference,
        paidAt: p.paidAt,
      })),
    },
  };
}

/**
 * 03.12 Record payment (Cash, Card, UPI, online) with receipt generation.
 */
export async function recordOrderPayment(
  orderIdOrAccession: string,
  input: RecordPaymentInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  if (input.amount <= 0) {
    throw AppError.badRequest('Payment amount must be greater than zero');
  }

  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: orderIdOrAccession }, { accessionNumber: orderIdOrAccession }] },
    include: { invoice: { include: { payments: true } }, patient: true },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${orderIdOrAccession}`);
  }

  return prisma.$transaction(async (tx) => {
    let invoice = order.invoice;
    const now = new Date();

    if (!invoice) {
      const invCount = await tx.invoice.count();
      const invNum = `INV-${now.getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;
      const baseFee = order.modality === ModalityType.MRI ? 750 : order.modality === ModalityType.CT ? 450 : 150;

      invoice = await tx.invoice.create({
        data: {
          invoiceNumber: invNum,
          patientId: order.patientId,
          orderId: order.id,
          total: baseFee,
          discount: 0,
          paidAmount: 0,
          outstandingAmount: baseFee,
          status: InvoiceStatus.PENDING,
        },
        include: { payments: true },
      });
    }

    const currentPaid = Number(invoice.paidAmount);
    const total = Number(invoice.total);
    const newPaid = currentPaid + input.amount;
    const newOutstanding = Math.max(0, total - newPaid);

    let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
    if (newOutstanding <= 0) {
      status = InvoiceStatus.PAID;
    }

    // Create payment entry
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod || PaymentMethod.CASH,
        reference: input.reference || `REC-PAY-${Date.now()}`,
        paymentStatus: PaymentStatus.COMPLETED,
        paidAt: now,
      },
    });

    // Update invoice balance
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        outstandingAmount: newOutstanding,
        status,
        discount: input.discount !== undefined ? input.discount : invoice.discount,
      },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'PAYMENT_RECORDED',
      entityType: 'Invoice',
      entityId: invoice.invoiceNumber,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        accessionNumber: order.accessionNumber,
        amountPaid: input.amount,
        paymentMethod: input.paymentMethod,
        reference: payment.reference,
        outstandingAmount: newOutstanding,
        status,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      success: true,
      receiptNumber: payment.reference,
      amountPaid: input.amount,
      outstandingAmount: newOutstanding,
      invoiceStatus: status,
      payment,
      invoice: {
        ...updatedInvoice,
        total: Number(updatedInvoice.total),
        paidAmount: Number(updatedInvoice.paidAmount),
        outstandingAmount: Number(updatedInvoice.outstandingAmount),
      },
    };
  });
}
