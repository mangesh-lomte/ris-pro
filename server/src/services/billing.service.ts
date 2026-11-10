import { Prisma, ModalityType, InvoiceStatus, PaymentStatus, PaymentMethod, UserRole } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { formatINR } from '../utils/formatters';

export interface AuditContext {
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

// -----------------------------------------------------------------------------
// 1. SERVICE PRICE MASTER
// -----------------------------------------------------------------------------

const DEFAULT_PRICE_ITEMS = [
  { code: 'SRV-CT-HEAD', name: 'CT Head / Brain without Contrast', modality: ModalityType.CT, category: 'EXAMINATION', basePrice: 450.00, taxRate: 0.00 },
  { code: 'SRV-CT-CHEST', name: 'CT Chest with Contrast', modality: ModalityType.CT, category: 'EXAMINATION', basePrice: 550.00, taxRate: 0.00 },
  { code: 'SRV-MRI-BRAIN', name: 'MRI Brain with and without Contrast', modality: ModalityType.MRI, category: 'EXAMINATION', basePrice: 750.00, taxRate: 0.00 },
  { code: 'SRV-MRI-KNEE', name: 'MRI Knee Joint Unilateral', modality: ModalityType.MRI, category: 'EXAMINATION', basePrice: 700.00, taxRate: 0.00 },
  { code: 'SRV-XRAY-CHEST', name: 'Chest X-Ray PA and Lateral View', modality: ModalityType.XRAY, category: 'EXAMINATION', basePrice: 150.00, taxRate: 0.00 },
  { code: 'SRV-US-ABDOMEN', name: 'Ultrasound Whole Abdomen & Pelvis', modality: ModalityType.ULTRASOUND, category: 'EXAMINATION', basePrice: 200.00, taxRate: 0.00 },
  { code: 'SRV-MAMMO-BILAT', name: 'Bilateral Digital Mammography', modality: ModalityType.MAMMOGRAPHY, category: 'EXAMINATION', basePrice: 250.00, taxRate: 0.00 },
  { code: 'SRV-CONTRAST-NONIONIC', name: 'Non-ionic Contrast Media (Iohexol / Gadolinium)', modality: null, category: 'CONTRAST', basePrice: 120.00, taxRate: 0.00 },
  { code: 'SRV-FILM-14X17', name: 'Laser Diagnostic Film 14x17 inch', modality: null, category: 'FILM', basePrice: 25.00, taxRate: 0.00 },
];

export async function ensureDefaultPriceMaster() {
  for (const item of DEFAULT_PRICE_ITEMS) {
    await prisma.priceMasterItem.upsert({
      where: { code: item.code },
      update: {},
      create: {
        code: item.code,
        name: item.name,
        modality: item.modality,
        category: item.category,
        basePrice: new Prisma.Decimal(item.basePrice),
        taxRate: new Prisma.Decimal(item.taxRate),
        isActive: true,
      },
    });
  }
}

export async function getPriceMasterList(filters?: { modality?: ModalityType; category?: string; search?: string; activeOnly?: boolean }) {
  await ensureDefaultPriceMaster();
  const where: Prisma.PriceMasterItemWhereInput = {};

  if (filters?.modality) where.modality = filters.modality;
  if (filters?.category) where.category = filters.category;
  if (filters?.activeOnly !== false) where.isActive = true;
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.priceMasterItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  });

  return items.map((it) => ({
    id: it.id,
    code: it.code,
    name: it.name,
    modality: it.modality,
    category: it.category,
    basePrice: Number(it.basePrice),
    taxRate: Number(it.taxRate),
    isActive: it.isActive,
    updatedAt: it.updatedAt,
  }));
}

export async function getPriceMasterItem(codeOrId: string) {
  await ensureDefaultPriceMaster();
  const item = await prisma.priceMasterItem.findFirst({
    where: { OR: [{ id: codeOrId }, { code: codeOrId }] },
  });
  if (!item) {
    throw AppError.notFound(`Price master item not found: ${codeOrId}`);
  }
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    modality: item.modality,
    category: item.category,
    basePrice: Number(item.basePrice),
    taxRate: Number(item.taxRate),
    isActive: item.isActive,
    updatedAt: item.updatedAt,
  };
}

export async function createPriceMasterItem(
  input: { code: string; name: string; modality?: ModalityType | null; category: string; basePrice: number; taxRate?: number },
  context?: AuditContext
) {
  if (context?.userRole && context.userRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Only administrative staff can modify service price catalog');
  }

  const existing = await prisma.priceMasterItem.findUnique({ where: { code: input.code } });
  if (existing) {
    throw AppError.conflict(`Price master item with code '${input.code}' already exists`);
  }

  const item = await prisma.priceMasterItem.create({
    data: {
      code: input.code,
      name: input.name,
      modality: input.modality || null,
      category: input.category,
      basePrice: new Prisma.Decimal(input.basePrice),
      taxRate: new Prisma.Decimal(input.taxRate || 0.0),
      isActive: true,
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'PRICE_MASTER_CREATED',
    entityType: 'PriceMasterItem',
    entityId: item.code,
    details: { code: item.code, name: item.name, basePrice: input.basePrice },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    modality: item.modality,
    category: item.category,
    basePrice: Number(item.basePrice),
    taxRate: Number(item.taxRate),
    isActive: item.isActive,
  };
}

export async function updatePriceMasterItem(
  codeOrId: string,
  input: { name?: string; basePrice?: number; taxRate?: number; isActive?: boolean; category?: string },
  context?: AuditContext
) {
  if (context?.userRole && context.userRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Only administrative staff can modify service price catalog');
  }

  const existing = await prisma.priceMasterItem.findFirst({
    where: { OR: [{ id: codeOrId }, { code: codeOrId }] },
  });
  if (!existing) {
    throw AppError.notFound(`Price master item not found: ${codeOrId}`);
  }

  const data: Prisma.PriceMasterItemUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.basePrice !== undefined) data.basePrice = new Prisma.Decimal(input.basePrice);
  if (input.taxRate !== undefined) data.taxRate = new Prisma.Decimal(input.taxRate);
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.category !== undefined) data.category = input.category;

  const updated = await prisma.priceMasterItem.update({
    where: { id: existing.id },
    data,
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'PRICE_MASTER_UPDATED',
    entityType: 'PriceMasterItem',
    entityId: updated.code,
    details: { code: updated.code, previousPrice: Number(existing.basePrice), newPrice: Number(updated.basePrice) },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    modality: updated.modality,
    category: updated.category,
    basePrice: Number(updated.basePrice),
    taxRate: Number(updated.taxRate),
    isActive: updated.isActive,
  };
}

// -----------------------------------------------------------------------------
// 2. QUOTATION / ESTIMATE
// -----------------------------------------------------------------------------

export async function createQuotation(
  input: {
    patientId: string;
    orderId?: string;
    items: { serviceCode: string; quantity?: number }[];
    discount?: number;
    discountReason?: string;
    taxRate?: number;
    notes?: string;
    validDays?: number;
  },
  context?: AuditContext
) {
  await ensureDefaultPriceMaster();

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ id: input.patientId }, { patientId: input.patientId }] },
  });
  if (!patient) {
    throw AppError.notFound(`Patient not found: ${input.patientId}`);
  }

  if (!input.items || input.items.length === 0) {
    throw AppError.badRequest('Quotation requires at least one service item');
  }

  let gross = new Prisma.Decimal(0);
  const quotationItemsData: { serviceCode: string; description: string; quantity: number; unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal }[] = [];

  for (const it of input.items) {
    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
    const priceItem = await prisma.priceMasterItem.findUnique({ where: { code: it.serviceCode } });
    if (!priceItem) {
      throw AppError.badRequest(`Unrecognized service item code: ${it.serviceCode}`);
    }
    const lineTotal = priceItem.basePrice.mul(qty);
    gross = gross.add(lineTotal);
    quotationItemsData.push({
      serviceCode: priceItem.code,
      description: priceItem.name,
      quantity: qty,
      unitPrice: priceItem.basePrice,
      totalPrice: lineTotal,
    });
  }

  const discount = new Prisma.Decimal(input.discount || 0);
  if (discount.greaterThan(gross)) {
    throw AppError.badRequest('Quotation discount cannot exceed gross amount');
  }

  const taxRate = new Prisma.Decimal(input.taxRate || 0);
  const taxableBase = gross.sub(discount);
  const taxAmount = taxableBase.mul(taxRate.div(100));
  const netAmount = taxableBase.add(taxAmount);

  const count = await prisma.quotation.count();
  const year = new Date().getFullYear();
  const quotationNumber = `QTE-${year}-${String(count + 1).padStart(4, '0')}`;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (input.validDays || 15));

  const quote = await prisma.quotation.create({
    data: {
      quotationNumber,
      patientId: patient.id,
      orderId: input.orderId || null,
      grossAmount: gross,
      discount,
      discountReason: input.discountReason || null,
      taxAmount,
      netAmount,
      status: 'ISSUED',
      validUntil,
      notes: input.notes || 'Official diagnostic estimate valid for 15 days.',
      createdById: context?.userId || null,
      items: {
        create: quotationItemsData,
      },
    },
    include: {
      items: true,
      patient: true,
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'QUOTATION_CREATED',
    entityType: 'Quotation',
    entityId: quote.quotationNumber,
    details: {
      quotationNumber: quote.quotationNumber,
      patientId: patient.patientId,
      grossAmount: Number(quote.grossAmount),
      netAmount: Number(quote.netAmount),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: quote.id,
    quotationNumber: quote.quotationNumber,
    patientId: quote.patient.patientId,
    patientName: `${quote.patient.firstName} ${quote.patient.lastName}`,
    orderId: quote.orderId,
    grossAmount: Number(quote.grossAmount),
    discount: Number(quote.discount),
    taxAmount: Number(quote.taxAmount),
    netAmount: Number(quote.netAmount),
    status: quote.status,
    validUntil: quote.validUntil,
    notes: quote.notes,
    items: quote.items.map((it) => ({
      serviceCode: it.serviceCode,
      description: it.description,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    })),
  };
}

export async function getQuotation(quoteNumberOrId: string) {
  const quote = await prisma.quotation.findFirst({
    where: { OR: [{ id: quoteNumberOrId }, { quotationNumber: quoteNumberOrId }] },
    include: { items: true, patient: true },
  });
  if (!quote) {
    throw AppError.notFound(`Quotation not found: ${quoteNumberOrId}`);
  }
  return {
    id: quote.id,
    quotationNumber: quote.quotationNumber,
    patientId: quote.patient.patientId,
    patientName: `${quote.patient.firstName} ${quote.patient.lastName}`,
    orderId: quote.orderId,
    grossAmount: Number(quote.grossAmount),
    discount: Number(quote.discount),
    taxAmount: Number(quote.taxAmount),
    netAmount: Number(quote.netAmount),
    status: quote.status,
    validUntil: quote.validUntil,
    notes: quote.notes,
    items: quote.items.map((it) => ({
      serviceCode: it.serviceCode,
      description: it.description,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    })),
  };
}

export async function listQuotations(patientId?: string) {
  const where: Prisma.QuotationWhereInput = {};
  if (patientId) {
    const p = await prisma.patient.findFirst({ where: { OR: [{ id: patientId }, { patientId }] } });
    if (p) where.patientId = p.id;
  }
  const quotes = await prisma.quotation.findMany({
    where,
    include: { patient: true, items: true },
    orderBy: { createdAt: 'desc' },
  });

  return quotes.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    patientId: q.patient.patientId,
    patientName: `${q.patient.firstName} ${q.patient.lastName}`,
    orderId: q.orderId,
    netAmount: Number(q.netAmount),
    status: q.status,
    validUntil: q.validUntil,
    createdAt: q.createdAt,
    itemCount: q.items.length,
  }));
}

// -----------------------------------------------------------------------------
// 3. INVOICE AND RECEIPT
// -----------------------------------------------------------------------------

export async function createInvoice(
  input: {
    patientId: string;
    orderId?: string;
    items?: { serviceCode: string; description?: string; quantity?: number; unitPrice?: number; itemType?: string }[];
    discount?: number;
    discountReason?: string;
  },
  context?: AuditContext
) {
  await ensureDefaultPriceMaster();

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ id: input.patientId }, { patientId: input.patientId }] },
  });
  if (!patient) {
    throw AppError.notFound(`Patient not found: ${input.patientId}`);
  }

  let order: any = null;
  if (input.orderId) {
    order = await prisma.imagingOrder.findFirst({
      where: { OR: [{ id: input.orderId }, { accessionNumber: input.orderId }] },
      include: {
        invoice: {
          include: { items: true, payments: true, receipts: true, refunds: true },
        },
      },
    });
    if (!order) {
      throw AppError.notFound(`Order not found: ${input.orderId}`);
    }
    // If invoice already exists for this order, return it
    if (order.invoice) {
      return formatInvoiceResponse(order.invoice, patient, order.accessionNumber);
    }
  }

  // Determine line items
  const lineItems = input.items ? [...input.items] : [];
  if (lineItems.length === 0 && order) {
    // Auto-resolve exam service from order modality
    let examCode = 'SRV-XRAY-CHEST';
    if (order.modality === ModalityType.MRI) examCode = 'SRV-MRI-BRAIN';
    else if (order.modality === ModalityType.CT) examCode = 'SRV-CT-HEAD';
    else if (order.modality === ModalityType.ULTRASOUND) examCode = 'SRV-US-ABDOMEN';
    else if (order.modality === ModalityType.MAMMOGRAPHY) examCode = 'SRV-MAMMO-BILAT';

    const pItem = await prisma.priceMasterItem.findUnique({ where: { code: examCode } });
    lineItems.push({
      serviceCode: examCode,
      description: order.examinationName || pItem?.name || `${order.modality} Scan`,
      quantity: 1,
      unitPrice: pItem ? Number(pItem.basePrice) : 300.0,
      itemType: 'EXAM',
    });

    if (order.contrastRequired) {
      const cItem = await prisma.priceMasterItem.findUnique({ where: { code: 'SRV-CONTRAST-NONIONIC' } });
      lineItems.push({
        serviceCode: 'SRV-CONTRAST-NONIONIC',
        description: cItem?.name || 'Non-ionic Contrast Media',
        quantity: 1,
        unitPrice: cItem ? Number(cItem.basePrice) : 120.0,
        itemType: 'CONTRAST',
      });
    }
  }

  if (lineItems.length === 0) {
    throw AppError.badRequest('Invoice requires at least one service item');
  }

  let gross = new Prisma.Decimal(0);
  const invoiceItemsToCreate: { serviceCode: string; description: string; quantity: number; unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal; itemType: string }[] = [];

  for (const it of lineItems) {
    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
    let unitPrice = it.unitPrice !== undefined ? new Prisma.Decimal(it.unitPrice) : null;
    let desc = it.description;

    if (!unitPrice) {
      const pItem = await prisma.priceMasterItem.findUnique({ where: { code: it.serviceCode } });
      if (!pItem) {
        throw AppError.badRequest(`Unknown service item: ${it.serviceCode}`);
      }
      unitPrice = pItem.basePrice;
      if (!desc) desc = pItem.name;
    }

    const lineTotal = unitPrice.mul(qty);
    gross = gross.add(lineTotal);
    invoiceItemsToCreate.push({
      serviceCode: it.serviceCode,
      description: desc || it.serviceCode,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      itemType: it.itemType || 'EXAM',
    });
  }

  const discount = new Prisma.Decimal(input.discount || 0);
  if (discount.greaterThan(gross)) {
    throw AppError.badRequest('Invoice discount cannot exceed gross amount');
  }

  if (discount.greaterThan(0) && context?.userRole && context.userRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Discounts require administrative approval');
  }

  const taxAmount = new Prisma.Decimal(0.0);
  const netTotal = gross.sub(discount).add(taxAmount);

  const count = await prisma.invoice.count();
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      patientId: patient.id,
      orderId: order ? order.id : null,
      grossAmount: gross,
      discount,
      discountReason: discount.greaterThan(0) ? input.discountReason || 'Authorized commercial concession' : null,
      discountApprovedById: discount.greaterThan(0) ? context?.userId || null : null,
      discountApprovedAt: discount.greaterThan(0) ? new Date() : null,
      taxAmount,
      total: netTotal,
      paidAmount: new Prisma.Decimal(0.0),
      outstandingAmount: netTotal,
      status: InvoiceStatus.PENDING,
      items: {
        create: invoiceItemsToCreate,
      },
    },
    include: {
      items: true,
      payments: true,
      receipts: true,
      refunds: true,
      claims: true,
      patient: true,
      order: true,
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: invoice.invoiceNumber,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      patientId: patient.patientId,
      accessionNumber: order?.accessionNumber,
      grossAmount: Number(invoice.grossAmount),
      total: Number(invoice.total),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return formatInvoiceResponse(invoice, patient, order?.accessionNumber);
}

export async function getInvoice(invoiceIdOrNumber: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }] },
    include: {
      patient: true,
      order: true,
      items: true,
      payments: { orderBy: { paidAt: 'desc' }, include: { receipt: true } },
      receipts: { orderBy: { issuedAt: 'desc' } },
      refunds: { orderBy: { createdAt: 'desc' } },
      claims: true,
    },
  });
  if (!invoice) {
    throw AppError.notFound(`Invoice not found: ${invoiceIdOrNumber}`);
  }
  return formatInvoiceResponse(invoice, invoice.patient, invoice.order?.accessionNumber);
}

export async function listInvoices(filters?: { patientId?: string; status?: InvoiceStatus; orderId?: string }) {
  const where: Prisma.InvoiceWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.orderId) {
    const o = await prisma.imagingOrder.findFirst({ where: { OR: [{ id: filters.orderId }, { accessionNumber: filters.orderId }] } });
    if (o) where.orderId = o.id;
  }
  if (filters?.patientId) {
    const p = await prisma.patient.findFirst({ where: { OR: [{ id: filters.patientId }, { patientId: filters.patientId }] } });
    if (p) where.patientId = p.id;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { patient: true, order: true, payments: true, items: true },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map((inv) => {
    const gross = Number(inv.grossAmount) > 0
      ? Number(inv.grossAmount)
      : (inv.items && inv.items.length > 0)
        ? inv.items.reduce((sum, it) => sum + Number(it.totalPrice), 0)
        : Math.max(0, Number(inv.total) + Number(inv.discount || 0) - Number(inv.taxAmount || 0));

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patientId: inv.patient.patientId,
      patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
      accessionNumber: inv.order?.accessionNumber || 'N/A',
      grossAmount: gross,
      discount: Number(inv.discount),
      total: Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      outstandingAmount: Number(inv.outstandingAmount),
      balance: Number(inv.outstandingAmount),
      status: inv.status,
      createdAt: inv.createdAt,
    };
  });
}

// -----------------------------------------------------------------------------
// 4. CASH / CARD / UPI / ONLINE PAYMENT & IDEMPOTENCY
// -----------------------------------------------------------------------------

function simulatePaymentCapture(method: PaymentMethod, amount: number, reference?: string) {
  const transactionId = reference || `TXN-${method}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  return {
    success: true,
    transactionId,
    gateway: 'LOCAL_EMBEDDED_GATEWAY',
    isSimulated: true,
    capturedAmount: amount,
    capturedAt: new Date().toISOString(),
  };
}

export async function recordPayment(
  invoiceIdOrNumber: string,
  input: {
    amount: number;
    paymentMethod: PaymentMethod;
    reference?: string;
    idempotencyKey?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  if (input.amount <= 0) {
    throw AppError.badRequest('Payment amount must be greater than zero');
  }

  if (!input.paymentMethod) {
    throw AppError.badRequest('Payment method is required');
  }

  // Validate payment method is a valid enum value
  const validMethods: PaymentMethod[] = [
    PaymentMethod.CASH,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.UPI,
    PaymentMethod.INSURANCE,
    PaymentMethod.ONLINE,
  ];
  if (!validMethods.includes(input.paymentMethod)) {
    throw AppError.badRequest('Invalid payment method');
  }

  // Idempotency check: if key matches an existing payment, return it immediately
  if (input.idempotencyKey) {
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { invoice: { include: { patient: true, order: true } }, receipt: true },
    });
    if (existingPayment) {
      return {
        idempotentReplay: true,
        paymentId: existingPayment.id,
        receiptNumber: existingPayment.receipt?.receiptNumber,
        amount: Number(existingPayment.amount),
        paymentMethod: existingPayment.paymentMethod,
        invoiceNumber: existingPayment.invoice.invoiceNumber,
        status: existingPayment.paymentStatus,
        receipt: existingPayment.receipt,
      };
    }
  }

  const invoice = await prisma.invoice.findFirst({
    where: { OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }] },
    include: { patient: true, order: true, payments: true },
  });

  if (!invoice) {
    throw AppError.notFound(`Invoice not found: ${invoiceIdOrNumber}`);
  }

  const paymentDecimal = new Prisma.Decimal(input.amount);
  if (paymentDecimal.greaterThan(invoice.outstandingAmount)) {
    throw AppError.badRequest(
      `Payment amount (${formatINR(input.amount)}) exceeds remaining outstanding balance (${formatINR(invoice.outstandingAmount)})`
    );
  }

  // Run payment simulation
  const gatewayResult = simulatePaymentCapture(input.paymentMethod, input.amount, input.reference);

  try {
    return await prisma.$transaction(async (tx) => {
      const receiptCount = await tx.receipt.count();
      const year = new Date().getFullYear();
      const receiptNumber = `RCP-${year}-${String(receiptCount + 1).padStart(4, '0')}`;

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paymentDecimal,
          paymentMethod: input.paymentMethod,
          reference: gatewayResult.transactionId,
          paymentStatus: PaymentStatus.COMPLETED,
          recordedById: context?.userId || null,
          idempotencyKey: input.idempotencyKey || null,
          notes: input.notes || null,
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          invoiceId: invoice.id,
          paymentId: payment.id,
          patientId: invoice.patientId,
          amount: paymentDecimal,
          paymentMethod: input.paymentMethod,
          reference: gatewayResult.transactionId,
          issuedById: context?.userId || null,
          receiptData: {
            invoiceNumber: invoice.invoiceNumber,
            accessionNumber: invoice.order?.accessionNumber || 'N/A',
            patientId: invoice.patient.patientId,
            patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
            amountPaid: input.amount,
            paymentMethod: input.paymentMethod,
            reference: gatewayResult.transactionId,
            timestamp: new Date().toISOString(),
            gateway: gatewayResult.gateway,
            isSimulated: gatewayResult.isSimulated,
          },
        },
      });

      const newPaidAmount = invoice.paidAmount.add(paymentDecimal);
      const newOutstanding = invoice.outstandingAmount.sub(paymentDecimal);
      let newStatus: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
      if (newOutstanding.equals(0)) {
        newStatus = InvoiceStatus.PAID;
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          outstandingAmount: newOutstanding,
          status: newStatus,
        },
      });

      await logAuditEvent({
        userId: context?.userId,
        action: 'PAYMENT_RECORDED',
        entityType: 'Invoice',
        entityId: invoice.invoiceNumber,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          receiptNumber: receipt.receiptNumber,
          amountPaid: input.amount,
          paymentMethod: input.paymentMethod,
          reference: gatewayResult.transactionId,
          newOutstanding: Number(newOutstanding),
          status: newStatus,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return {
        success: true,
        paymentId: payment.id,
        receiptNumber: receipt.receiptNumber,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: input.amount,
        outstandingAmount: Number(newOutstanding),
        status: newStatus,
        paymentMethod: input.paymentMethod,
        reference: gatewayResult.transactionId,
        receipt,
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          total: Number(updatedInvoice.total),
          paidAmount: Number(updatedInvoice.paidAmount),
          outstandingAmount: Number(updatedInvoice.outstandingAmount),
          status: updatedInvoice.status,
        },
      };
    });
  } catch (error: any) {
    // Log the error internally but return a safe message to the user
    console.error('[BILLING] Payment recording failed:', {
      invoiceId: invoiceIdOrNumber,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      error: error.message,
    });

    // If it's already an AppError, rethrow it
    if (error.name === 'AppError') {
      throw error;
    }

    // For any other error (including Prisma errors), return a safe generic message
    throw AppError.internal('Payment could not be recorded. Please check the payment details and try again.');
  }
}

export async function getReceipt(receiptIdOrNumber: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { OR: [{ id: receiptIdOrNumber }, { receiptNumber: receiptIdOrNumber }] },
    include: { invoice: { include: { patient: true, order: true } }, payment: true },
  });
  if (!receipt) {
    throw AppError.notFound(`Receipt not found: ${receiptIdOrNumber}`);
  }
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    invoiceNumber: receipt.invoice.invoiceNumber,
    patientId: receipt.invoice.patient.patientId,
    patientName: `${receipt.invoice.patient.firstName} ${receipt.invoice.patient.lastName}`,
    accessionNumber: receipt.invoice.order?.accessionNumber || 'N/A',
    amount: Number(receipt.amount),
    paymentMethod: receipt.paymentMethod,
    reference: receipt.reference,
    issuedAt: receipt.issuedAt,
    receiptData: receipt.receiptData,
  };
}

export async function listReceipts(filters?: { patientId?: string; invoiceId?: string }) {
  const where: Prisma.ReceiptWhereInput = {};
  if (filters?.invoiceId) {
    const inv = await prisma.invoice.findFirst({ where: { OR: [{ id: filters.invoiceId }, { invoiceNumber: filters.invoiceId }] } });
    if (inv) where.invoiceId = inv.id;
  }
  if (filters?.patientId) {
    const p = await prisma.patient.findFirst({ where: { OR: [{ id: filters.patientId }, { patientId: filters.patientId }] } });
    if (p) where.patientId = p.id;
  }

  const receipts = await prisma.receipt.findMany({
    where,
    include: { invoice: { include: { patient: true, order: true } } },
    orderBy: { issuedAt: 'desc' },
  });

  return receipts.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    invoiceNumber: r.invoice.invoiceNumber,
    patientId: r.invoice.patient.patientId,
    patientName: `${r.invoice.patient.firstName} ${r.invoice.patient.lastName}`,
    accessionNumber: r.invoice.order?.accessionNumber || 'N/A',
    amount: Number(r.amount),
    paymentMethod: r.paymentMethod,
    reference: r.reference,
    issuedAt: r.issuedAt,
  }));
}

// -----------------------------------------------------------------------------
// 5. PART PAYMENT & OUTSTANDING CALCULATION
// -----------------------------------------------------------------------------

export async function getOutstandingBalances(patientIdOrSearch?: string) {
  const where: Prisma.InvoiceWhereInput = {
    outstandingAmount: { gt: 0 },
  };

  if (patientIdOrSearch) {
    where.patient = {
      OR: [
        { patientId: { contains: patientIdOrSearch, mode: 'insensitive' } },
        { firstName: { contains: patientIdOrSearch, mode: 'insensitive' } },
        { lastName: { contains: patientIdOrSearch, mode: 'insensitive' } },
      ],
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { patient: true, order: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  return invoices.map((inv) => {
    const diffDays = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 3600 * 24));
    let agingBucket = '<30_DAYS';
    if (diffDays > 90) agingBucket = 'OVER_90_DAYS';
    else if (diffDays > 60) agingBucket = '61_90_DAYS';
    else if (diffDays > 30) agingBucket = '31_60_DAYS';

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patientId: inv.patient.patientId,
      patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
      phone: inv.patient.phone,
      accessionNumber: inv.order?.accessionNumber || 'N/A',
      totalBilled: Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      outstandingAmount: Number(inv.outstandingAmount),
      invoiceDate: inv.createdAt,
      daysOutstanding: diffDays,
      agingBucket,
    };
  });
}

// -----------------------------------------------------------------------------
// 6. DISCOUNT APPROVAL
// -----------------------------------------------------------------------------

export async function applyDiscount(
  invoiceIdOrNumber: string,
  input: { discountAmount?: number; discount?: number; discountPercent?: number; reason: string },
  context?: AuditContext
) {
  if (context?.userRole && context.userRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Discount approval requires administrative privileges');
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw AppError.badRequest('Discount reason is mandatory for audit trail');
  }

  const invoice = await prisma.invoice.findFirst({
    where: { OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }] },
    include: { items: true, patient: true, order: true },
  });

  if (!invoice) {
    throw AppError.notFound(`Invoice not found: ${invoiceIdOrNumber}`);
  }

  // Derive accurate gross amount before discount calculation
  let effectiveGross = invoice.grossAmount;
  if (effectiveGross.equals(0)) {
    if (invoice.items && invoice.items.length > 0) {
      effectiveGross = invoice.items.reduce(
        (sum, it) => sum.add(it.totalPrice),
        new Prisma.Decimal(0)
      );
    } else {
      effectiveGross = invoice.total.add(invoice.discount).sub(invoice.taxAmount);
    }
  }

  const rawDiscountAmount = input.discountAmount !== undefined ? input.discountAmount : input.discount;

  let discountDecimal: Prisma.Decimal;
  if (input.discountPercent !== undefined) {
    if (input.discountPercent < 0 || input.discountPercent > 100) {
      throw AppError.badRequest('Discount percent must be between 0 and 100');
    }
    discountDecimal = effectiveGross.mul(new Prisma.Decimal(input.discountPercent).div(100));
  } else if (rawDiscountAmount !== undefined) {
    if (rawDiscountAmount < 0) {
      throw AppError.badRequest('Discount amount cannot be negative');
    }
    discountDecimal = new Prisma.Decimal(rawDiscountAmount);
  } else {
    throw AppError.badRequest('Either discountAmount or discountPercent must be specified');
  }

  if (discountDecimal.greaterThan(effectiveGross)) {
    throw AppError.badRequest('Discount amount cannot exceed invoice gross amount');
  }

  const newNetTotal = effectiveGross.sub(discountDecimal).add(invoice.taxAmount);
  if (newNetTotal.lessThan(invoice.paidAmount)) {
    throw AppError.badRequest(
      `New net total (${formatINR(newNetTotal)}) is lower than already paid amount (${formatINR(invoice.paidAmount)}). Process a refund first.`
    );
  }

  const newOutstanding = newNetTotal.sub(invoice.paidAmount);
  let newStatus: InvoiceStatus;
  if (newOutstanding.equals(0)) {
    newStatus = InvoiceStatus.PAID;
  } else if (invoice.paidAmount.greaterThan(0)) {
    newStatus = InvoiceStatus.PARTIALLY_PAID;
  } else {
    newStatus = InvoiceStatus.PENDING;
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      grossAmount: effectiveGross,
      discount: discountDecimal,
      discountReason: input.reason,
      discountApprovedById: context?.userId || null,
      discountApprovedAt: new Date(),
      total: newNetTotal,
      outstandingAmount: newOutstanding,
      status: newStatus,
    },
    include: { patient: true, order: true, items: true, payments: true, receipts: true },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'DISCOUNT_APPROVED',
    entityType: 'Invoice',
    entityId: invoice.invoiceNumber,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      discountAmount: Number(discountDecimal),
      reason: input.reason,
      approvedBy: context?.userId,
      newTotal: Number(newNetTotal),
      newOutstanding: Number(newOutstanding),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return formatInvoiceResponse(updatedInvoice, updatedInvoice.patient, updatedInvoice.order?.accessionNumber);
}

// -----------------------------------------------------------------------------
// 7. REFUND / CANCELLATION BILLING
// -----------------------------------------------------------------------------

export async function processRefund(
  invoiceIdOrNumber: string,
  input: {
    paymentId?: string;
    amount: number;
    reason: string;
    refundMethod?: PaymentMethod;
  },
  context?: AuditContext
) {
  if (context?.userRole && context.userRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Refund processing requires administrative privileges');
  }

  if (input.amount <= 0) {
    throw AppError.badRequest('Refund amount must be greater than zero');
  }
  if (!input.reason || input.reason.trim().length === 0) {
    throw AppError.badRequest('Refund reason is required for financial compliance');
  }

  const invoice = await prisma.invoice.findFirst({
    where: { OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }] },
    include: { payments: true, refunds: true, patient: true, order: true },
  });
  if (!invoice) {
    throw AppError.notFound(`Invoice not found: ${invoiceIdOrNumber}`);
  }

  const totalRefundedSoFar = invoice.refunds.reduce(
    (acc, r) => acc.add(r.amount),
    new Prisma.Decimal(0)
  );
  const maxRefundable = invoice.paidAmount.sub(totalRefundedSoFar);

  const refundDecimal = new Prisma.Decimal(input.amount);
  if (refundDecimal.greaterThan(maxRefundable)) {
    throw AppError.badRequest(
      `Requested refund (${formatINR(input.amount)}) exceeds refundable balance (${formatINR(maxRefundable)})`
    );
  }

  return prisma.$transaction(async (tx) => {
    const refundCount = await tx.refund.count();
    const year = new Date().getFullYear();
    const refundNumber = `REF-${year}-${String(refundCount + 1).padStart(4, '0')}`;

    const refund = await tx.refund.create({
      data: {
        refundNumber,
        invoiceId: invoice.id,
        paymentId: input.paymentId || null,
        amount: refundDecimal,
        reason: input.reason,
        refundMethod: input.refundMethod || PaymentMethod.CASH,
        reference: `REF-TXN-${Date.now()}`,
        processedById: context?.userId || 'SYSTEM_ADMIN',
      },
    });

    const newOutstanding = invoice.outstandingAmount.add(refundDecimal);
    const newStatus = totalRefundedSoFar.add(refundDecimal).equals(invoice.paidAmount)
      ? InvoiceStatus.REFUNDED
      : InvoiceStatus.PARTIALLY_PAID;

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        outstandingAmount: newOutstanding,
        status: newStatus,
      },
      include: { refunds: true, payments: true, patient: true, order: true, items: true },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'REFUND_PROCESSED',
      entityType: 'Refund',
      entityId: refund.refundNumber,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        refundNumber: refund.refundNumber,
        amount: input.amount,
        reason: input.reason,
        processedById: context?.userId,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      success: true,
      refundNumber: refund.refundNumber,
      amountRefunded: input.amount,
      reason: refund.reason,
      refundMethod: refund.refundMethod,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: newStatus,
      outstandingAmount: Number(newOutstanding),
      refund,
      invoice: formatInvoiceResponse(updatedInvoice, invoice.patient, invoice.order?.accessionNumber),
    };
  });
}

// -----------------------------------------------------------------------------
// 8. INSURANCE / TPA CLAIMS
// -----------------------------------------------------------------------------

export async function createInsuranceClaim(
  input: {
    patientId?: string;
    orderId?: string;
    invoiceId?: string;
    payerName?: string;
    tpaProvider?: string;
    policyNumber: string;
    preAuthCode?: string;
    approvalCode?: string;
    claimAmount?: number;
    claimedAmount?: number;
    copayAmount?: number;
    notes?: string;
    documents?: any;
  },
  context?: AuditContext
) {
  const payerName = (input.payerName || input.tpaProvider || '').trim();
  if (!payerName) {
    throw AppError.badRequest('TPA / Insurance provider name is required.');
  }

  const policyNumber = (input.policyNumber || '').trim();
  if (!policyNumber) {
    throw AppError.badRequest('Policy / card number is required.');
  }

  const preAuthCode = (input.preAuthCode || input.approvalCode || '').trim() || null;

  const rawAmount = input.claimAmount ?? input.claimedAmount;
  if (rawAmount === undefined || isNaN(Number(rawAmount))) {
    throw AppError.badRequest('Claim amount is required.');
  }
  const claimDecimal = new Prisma.Decimal(rawAmount);
  if (claimDecimal.lessThanOrEqualTo(0)) {
    throw AppError.badRequest('Claim amount must be greater than zero.');
  }

  let patient: { id: string; patientId: string; firstName: string; lastName: string } | null;
  let invoice: any = null;
  let resolvedOrderId = input.orderId || null;

  if (input.invoiceId) {
    invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id: input.invoiceId }, { invoiceNumber: input.invoiceId }] },
      include: { patient: true, order: true },
    });

    if (!invoice) {
      throw AppError.notFound(`Invoice not found: ${input.invoiceId}`);
    }

    if (!invoice.patient) {
      throw AppError.badRequest('This invoice is not linked to a valid patient.');
    }

    patient = invoice.patient;
    if (!patient) {
      throw AppError.badRequest('This invoice is not linked to a valid patient.');
    }
    resolvedOrderId = invoice.orderId || resolvedOrderId;

    // Verify claim cannot attach to another patient's invoice
    if (input.patientId && input.patientId !== patient.id && input.patientId !== patient.patientId) {
      throw AppError.badRequest("Claim cannot attach to another patient's invoice.");
    }

    // Verify claim amount cannot exceed eligible invoice balance
    const eligibleBalance = invoice.outstandingAmount.greaterThan(0)
      ? invoice.outstandingAmount
      : invoice.total;

    if (claimDecimal.greaterThan(eligibleBalance)) {
      throw AppError.badRequest(
        `Claim amount (${formatINR(claimDecimal)}) cannot exceed eligible invoice balance (${formatINR(eligibleBalance)}).`
      );
    }
  } else if (input.patientId) {
    patient = await prisma.patient.findFirst({
      where: { OR: [{ id: input.patientId }, { patientId: input.patientId }] },
      select: { id: true, patientId: true, firstName: true, lastName: true },
    });

    if (!patient) {
      throw AppError.notFound(`Patient not found: ${input.patientId}`);
    }
  } else {
    throw AppError.badRequest('Either a valid invoiceId or patientId must be provided for the insurance claim.');
  }

  if (!patient) {
    throw AppError.badRequest('This invoice is not linked to a valid patient.');
  }

  const count = await prisma.insuranceClaim.count();
  const year = new Date().getFullYear();
  const claimNumber = `CLM-${year}-${String(count + 1).padStart(4, '0')}`;

  const claim = await prisma.insuranceClaim.create({
    data: {
      claimNumber,
      patientId: patient.id,
      orderId: resolvedOrderId,
      invoiceId: invoice ? invoice.id : null,
      payerName,
      policyNumber,
      preAuthCode,
      claimAmount: claimDecimal,
      copayAmount: new Prisma.Decimal(input.copayAmount || 0.0),
      status: 'SUBMITTED',
      notes: input.notes || null,
      documents: input.documents || null,
    },
    include: {
      invoice: {
        include: { patient: true, order: true },
      },
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'CLAIM_CREATED',
    entityType: 'InsuranceClaim',
    entityId: claim.claimNumber,
    details: {
      claimNumber: claim.claimNumber,
      invoiceNumber: invoice?.invoiceNumber,
      patientId: patient.patientId,
      payer: payerName,
      amount: Number(claimDecimal),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    invoiceId: claim.invoiceId,
    invoiceNumber: invoice?.invoiceNumber || (claim as any).invoice?.invoiceNumber || '—',
    patientId: patient.patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    orderId: claim.orderId,
    accessionNumber: invoice?.order?.accessionNumber || (claim as any).invoice?.order?.accessionNumber || 'N/A',
    tpaProvider: claim.payerName,
    payerName: claim.payerName,
    policyNumber: claim.policyNumber,
    approvalCode: claim.preAuthCode,
    preAuthCode: claim.preAuthCode,
    claimedAmount: Number(claim.claimAmount),
    claimAmount: Number(claim.claimAmount),
    approvedAmount: Number(claim.approvedAmount),
    copayAmount: Number(claim.copayAmount),
    status: claim.status,
    notes: claim.notes,
    createdAt: claim.createdAt,
    submittedAt: claim.createdAt.toISOString(),
  };
}

export async function updateClaimStatus(
  claimIdOrNumber: string,
  input: {
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SETTLED';
    approvedAmount?: number;
    settlementReference?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  const claim = await prisma.insuranceClaim.findFirst({
    where: { OR: [{ id: claimIdOrNumber }, { claimNumber: claimIdOrNumber }] },
    include: { invoice: { include: { patient: true } } },
  });
  if (!claim) {
    throw AppError.notFound(`Claim not found: ${claimIdOrNumber}`);
  }

  const data: Prisma.InsuranceClaimUpdateInput = {
    status: input.status,
  };
  const approvedAmt = input.approvedAmount ?? (input.status === 'APPROVED' ? Number(claim.claimAmount) : undefined);
  if (approvedAmt !== undefined) {
    data.approvedAmount = new Prisma.Decimal(approvedAmt);
  }
  if (input.settlementReference) data.settlementReference = input.settlementReference;
  if (input.notes) data.notes = input.notes;
  if (input.status === 'SETTLED') {
    data.settledAt = new Date();
    if (!claim.settlementReference && !input.settlementReference) {
      data.settlementReference = `SETTLE-${Date.now().toString().slice(-6)}`;
    }
  }

  const updated = await prisma.insuranceClaim.update({
    where: { id: claim.id },
    data,
    include: { invoice: { include: { patient: true } } },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'CLAIM_STATUS_UPDATED',
    entityType: 'InsuranceClaim',
    entityId: updated.claimNumber,
    details: { claimNumber: updated.claimNumber, previousStatus: claim.status, newStatus: updated.status },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: updated.id,
    claimNumber: updated.claimNumber,
    invoiceId: updated.invoiceId,
    invoiceNumber: updated.invoice?.invoiceNumber || '—',
    patientId: updated.invoice?.patient?.patientId || updated.patientId,
    tpaProvider: updated.payerName,
    payerName: updated.payerName,
    status: updated.status,
    claimAmount: Number(updated.claimAmount),
    claimedAmount: Number(updated.claimAmount),
    approvedAmount: Number(updated.approvedAmount),
    settledAmount: Number(updated.status === 'SETTLED' ? (updated.approvedAmount || updated.claimAmount) : 0),
    settlementReference: updated.settlementReference,
    settledAt: updated.settledAt,
  };
}

export async function listClaims(filters?: { status?: string; patientId?: string }) {
  const where: Prisma.InsuranceClaimWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.patientId) {
    const p = await prisma.patient.findFirst({ where: { OR: [{ id: filters.patientId }, { patientId: filters.patientId }] } });
    if (p) where.patientId = p.id;
  }

  const claims = await prisma.insuranceClaim.findMany({
    where,
    include: {
      invoice: {
        include: { patient: true, order: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const patientDbIds = claims.map((c) => c.patientId).filter(Boolean);
  const patients = await prisma.patient.findMany({
    where: { id: { in: patientDbIds } },
    select: { id: true, patientId: true, firstName: true, lastName: true },
  });
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  return claims.map((c) => {
    const patientObj = c.invoice?.patient || patientMap.get(c.patientId);
    const mrn = patientObj?.patientId || c.patientId;
    const patientName = patientObj ? `${patientObj.firstName} ${patientObj.lastName}` : 'N/A';

    return {
      id: c.id,
      claimNumber: c.claimNumber,
      invoiceId: c.invoiceId,
      invoiceNumber: c.invoice?.invoiceNumber || '—',
      patientId: mrn,
      patientName,
      tpaProvider: c.payerName,
      payerName: c.payerName,
      policyNumber: c.policyNumber,
      approvalCode: c.preAuthCode,
      preAuthCode: c.preAuthCode,
      claimedAmount: Number(c.claimAmount),
      claimAmount: Number(c.claimAmount),
      approvedAmount: Number(c.approvedAmount),
      settledAmount: Number(c.status === 'SETTLED' ? (c.approvedAmount || c.claimAmount) : 0),
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt,
      submittedAt: c.createdAt.toISOString(),
      settledAt: c.settledAt,
    };
  });
}

// -----------------------------------------------------------------------------
// 9. CONTRAST / FILM CHARGES
// -----------------------------------------------------------------------------

export async function attachClinicalCharges(
  orderIdOrAccession: string,
  input?: { includeContrast?: boolean; filmCount?: number },
  context?: AuditContext
) {
  await ensureDefaultPriceMaster();

  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: orderIdOrAccession }, { accessionNumber: orderIdOrAccession }] },
    include: {
      contrastAdministrations: true,
      invoice: { include: { items: true, patient: true } },
      patient: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${orderIdOrAccession}`);
  }

  let invoice = order.invoice;
  if (!invoice) {
    // Generate initial invoice if not present
    const created = await createInvoice({ patientId: order.patientId, orderId: order.id }, context);
    const found = await prisma.invoice.findUnique({
      where: { id: created.id },
      include: { items: true, patient: true },
    });
    if (!found) {
      throw AppError.internal('Failed to initialize invoice for order');
    }
    invoice = found;
  }

  const existingCodes = new Set(invoice!.items.map((i) => i.serviceCode));
  const newItemsToInsert: { serviceCode: string; description: string; quantity: number; unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal; itemType: string }[] = [];

  const shouldChargeContrast =
    input?.includeContrast ||
    order.contrastRequired ||
    (order.contrastAdministrations && order.contrastAdministrations.length > 0);

  if (shouldChargeContrast && !existingCodes.has('SRV-CONTRAST-NONIONIC')) {
    const cPrice = await prisma.priceMasterItem.findUnique({ where: { code: 'SRV-CONTRAST-NONIONIC' } });
    const price = cPrice?.basePrice || new Prisma.Decimal(120.0);
    newItemsToInsert.push({
      serviceCode: 'SRV-CONTRAST-NONIONIC',
      description: 'Non-ionic Contrast Media Charge',
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      itemType: 'CONTRAST',
    });
  }

  const filmCount = input?.filmCount !== undefined ? input.filmCount : order.modality === ModalityType.XRAY ? 1 : 0;
  if (filmCount > 0 && !existingCodes.has('SRV-FILM-14X17')) {
    const fPrice = await prisma.priceMasterItem.findUnique({ where: { code: 'SRV-FILM-14X17' } });
    const unitPrice = fPrice?.basePrice || new Prisma.Decimal(25.0);
    const totalPrice = unitPrice.mul(filmCount);
    newItemsToInsert.push({
      serviceCode: 'SRV-FILM-14X17',
      description: `Diagnostic Film Print (${filmCount} sheets)`,
      quantity: filmCount,
      unitPrice,
      totalPrice,
      itemType: 'FILM',
    });
  }

  if (newItemsToInsert.length === 0) {
    return {
      message: 'No new clinical charges to attach (already attached or none required)',
      attachedChargesCount: 0,
      invoice: formatInvoiceResponse(invoice!, invoice!.patient, order.accessionNumber),
    };
  }

  let addedGross = new Prisma.Decimal(0);
  for (const it of newItemsToInsert) {
    addedGross = addedGross.add(it.totalPrice);
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice!.id,
        serviceCode: it.serviceCode,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        itemType: it.itemType,
      },
    });
  }

  let baseGross = invoice!.grossAmount;
  if (baseGross.equals(0)) {
    baseGross = invoice!.total.add(invoice!.discount).sub(invoice!.taxAmount);
  }
  const updatedGross = baseGross.add(addedGross);
  const updatedTotal = updatedGross.sub(invoice!.discount).add(invoice!.taxAmount);
  const updatedOutstanding = updatedTotal.sub(invoice!.paidAmount);

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice!.id },
    data: {
      grossAmount: updatedGross,
      total: updatedTotal,
      outstandingAmount: updatedOutstanding,
      status: updatedOutstanding.equals(0) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
    },
    include: { items: true, patient: true, payments: true, receipts: true },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'CLINICAL_CHARGES_ATTACHED',
    entityType: 'Invoice',
    entityId: updatedInvoice.invoiceNumber,
    details: {
      accessionNumber: order.accessionNumber,
      chargesAdded: newItemsToInsert.map((i) => i.serviceCode),
      addedAmount: Number(addedGross),
      newTotal: Number(updatedTotal),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    message: `Attached ${newItemsToInsert.length} clinical charges to invoice`,
    attachedChargesCount: newItemsToInsert.length,
    invoice: formatInvoiceResponse(updatedInvoice, updatedInvoice.patient, order.accessionNumber),
  };
}

// -----------------------------------------------------------------------------
// 10. DAILY CASHIER CLOSING
// -----------------------------------------------------------------------------

export async function getCashierDailySummary(cashierId: string, businessDate?: Date) {
  const targetDate = businessDate || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const payments = await prisma.payment.findMany({
    where: {
      recordedById: cashierId,
      paidAt: { gte: startOfDay, lte: endOfDay },
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  let cash = new Prisma.Decimal(0);
  let card = new Prisma.Decimal(0);
  let upi = new Prisma.Decimal(0);
  let online = new Prisma.Decimal(0);

  for (const p of payments) {
    if (p.paymentMethod === PaymentMethod.CASH) cash = cash.add(p.amount);
    else if (p.paymentMethod === PaymentMethod.CREDIT_CARD || p.paymentMethod === PaymentMethod.DEBIT_CARD) card = card.add(p.amount);
    else if (p.paymentMethod === PaymentMethod.UPI) upi = upi.add(p.amount);
    else online = online.add(p.amount);
  }

  const refunds = await prisma.refund.findMany({
    where: {
      processedById: cashierId,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  let refundsTotal = new Prisma.Decimal(0);
  let cashRefunds = new Prisma.Decimal(0);
  for (const r of refunds) {
    refundsTotal = refundsTotal.add(r.amount);
    if (r.refundMethod === PaymentMethod.CASH) cashRefunds = cashRefunds.add(r.amount);
  }

  const expectedCash = cash.sub(cashRefunds);

  return {
    cashierId,
    businessDate: startOfDay.toISOString().slice(0, 10),
    openingFloat: 100,
    cashCollected: Number(cash),
    cardCollected: Number(card),
    upiCollected: Number(upi),
    onlineCollected: Number(online),
    totalCollected: Number(cash.add(card).add(upi).add(online)),
    refundsTotal: Number(refundsTotal),
    expectedCash: Number(expectedCash),
    expectedCashInDrawer: Number(expectedCash.add(100)),
    transactionCount: payments.length,
    refundCount: refunds.length,
  };
}

export async function closeCashierDrawer(
  input: {
    openingFloat: number;
    actualCash: number;
    notes?: string;
    closingDate?: Date;
  },
  context?: AuditContext
) {
  const cashierId = context?.userId || 'SYSTEM_CASHIER';
  const targetDate = input.closingDate || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if drawer already closed for this day
  const existingClosing = await prisma.cashierClosing.findFirst({
    where: {
      cashierId,
      closingDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (existingClosing) {
    throw AppError.conflict(
      `Cashier drawer has already been closed for this date (${existingClosing.closingNumber}). Reopening or rewriting closed shifts is blocked.`
    );
  }

  const summary = await getCashierDailySummary(cashierId, targetDate);

  const openingFloatDec = new Prisma.Decimal(input.openingFloat || 0);
  const actualCashDec = new Prisma.Decimal(input.actualCash);
  const expectedCashDec = new Prisma.Decimal(summary.expectedCash).add(openingFloatDec);
  const varianceDec = actualCashDec.sub(expectedCashDec);

  const count = await prisma.cashierClosing.count();
  const year = new Date().getFullYear();
  const closingNumber = `CLS-${year}-${String(count + 1).padStart(4, '0')}`;

  const closing = await prisma.cashierClosing.create({
    data: {
      closingNumber,
      cashierId,
      cashierName: context?.userId ? `Staff-${context.userId.slice(-6)}` : 'Front Desk Cashier',
      closingDate: targetDate,
      openingFloat: openingFloatDec,
      cashCollected: new Prisma.Decimal(summary.cashCollected),
      cardCollected: new Prisma.Decimal(summary.cardCollected),
      upiCollected: new Prisma.Decimal(summary.upiCollected),
      onlineCollected: new Prisma.Decimal(summary.onlineCollected),
      refundsTotal: new Prisma.Decimal(summary.refundsTotal),
      expectedCash: expectedCashDec,
      actualCash: actualCashDec,
      variance: varianceDec,
      notes: input.notes || 'End of day closing reconciled.',
      status: 'CLOSED',
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'CASHIER_DRAWER_CLOSED',
    entityType: 'CashierClosing',
    entityId: closing.closingNumber,
    details: {
      closingNumber: closing.closingNumber,
      cashierId,
      expectedCash: Number(expectedCashDec),
      actualCash: Number(actualCashDec),
      variance: Number(varianceDec),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    id: closing.id,
    closingNumber: closing.closingNumber,
    cashierId: closing.cashierId,
    closingDate: closing.closingDate,
    openingFloat: Number(closing.openingFloat),
    cashCollected: Number(closing.cashCollected),
    cardCollected: Number(closing.cardCollected),
    upiCollected: Number(closing.upiCollected),
    onlineCollected: Number(closing.onlineCollected),
    refundsTotal: Number(closing.refundsTotal),
    expectedCash: Number(closing.expectedCash),
    actualCash: Number(closing.actualCash),
    variance: Number(closing.variance),
    status: closing.status,
    closedAt: closing.closedAt,
    notes: closing.notes,
  };
}

export async function listCashierClosings(date?: Date) {
  const where: Prisma.CashierClosingWhereInput = {};
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.closingDate = { gte: start, lte: end };
  }

  const closings = await prisma.cashierClosing.findMany({
    where,
    orderBy: { closedAt: 'desc' },
  });

  return closings.map((c) => ({
    id: c.id,
    closingNumber: c.closingNumber,
    cashierId: c.cashierId,
    cashierName: c.cashierName,
    businessDate: c.closingDate ? new Date(c.closingDate).toISOString().slice(0, 10) : '',
    closingDate: c.closingDate,
    openingFloat: Number(c.openingFloat),
    expectedCash: Number(c.expectedCash),
    actualCash: Number(c.actualCash),
    variance: Number(c.variance),
    status: c.status,
    closedAt: c.closedAt,
  }));
}

// -----------------------------------------------------------------------------
// 11. REVENUE / DEBTOR REPORTS
// -----------------------------------------------------------------------------

export async function getRevenueReport(filters?: { startDate?: string; endDate?: string; modality?: ModalityType }) {
  const where: Prisma.InvoiceWhereInput = {};
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }
  if (filters?.modality) {
    where.order = { modality: filters.modality };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      order: true,
      payments: { where: { paymentStatus: PaymentStatus.COMPLETED } },
      refunds: true,
      items: true,
    },
  });

  let totalGross = new Prisma.Decimal(0);
  let totalDiscounts = new Prisma.Decimal(0);
  let totalNetBilled = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let totalOutstanding = new Prisma.Decimal(0);
  let totalRefunds = new Prisma.Decimal(0);

  const byModality: Record<string, { count: number; gross: Prisma.Decimal; paid: Prisma.Decimal }> = {};
  const byPaymentMethod: Record<string, { count: number; total: Prisma.Decimal }> = {
    CASH: { count: 0, total: new Prisma.Decimal(0) },
    CREDIT_CARD: { count: 0, total: new Prisma.Decimal(0) },
    DEBIT_CARD: { count: 0, total: new Prisma.Decimal(0) },
    UPI: { count: 0, total: new Prisma.Decimal(0) },
    ONLINE: { count: 0, total: new Prisma.Decimal(0) },
    INSURANCE: { count: 0, total: new Prisma.Decimal(0) },
  };

  for (const inv of invoices) {
    totalGross = totalGross.add(inv.grossAmount);
    totalDiscounts = totalDiscounts.add(inv.discount);
    totalNetBilled = totalNetBilled.add(inv.total);
    totalPaid = totalPaid.add(inv.paidAmount);
    totalOutstanding = totalOutstanding.add(inv.outstandingAmount);

    const mod = inv.order?.modality || 'OTHER';
    if (!byModality[mod]) {
      byModality[mod] = { count: 0, gross: new Prisma.Decimal(0), paid: new Prisma.Decimal(0) };
    }
    byModality[mod].count += 1;
    byModality[mod].gross = byModality[mod].gross.add(inv.total);
    byModality[mod].paid = byModality[mod].paid.add(inv.paidAmount);

    for (const p of inv.payments) {
      const m = p.paymentMethod;
      if (!byPaymentMethod[m]) byPaymentMethod[m] = { count: 0, total: new Prisma.Decimal(0) };
      byPaymentMethod[m].count += 1;
      byPaymentMethod[m].total = byPaymentMethod[m].total.add(p.amount);
    }

    for (const r of inv.refunds) {
      totalRefunds = totalRefunds.add(r.amount);
    }
  }

  const netRealizedRevenue = totalPaid.sub(totalRefunds);

  return {
    period: {
      startDate: filters?.startDate || 'All time',
      endDate: filters?.endDate || 'Now',
    },
    summary: {
      totalInvoices: invoices.length,
      grossBilled: Number(totalGross),
      discountsGiven: Number(totalDiscounts),
      netBilled: Number(totalNetBilled),
      totalPaid: Number(totalPaid),
      totalOutstanding: Number(totalOutstanding),
      totalRefunds: Number(totalRefunds),
      netRealizedRevenue: Number(netRealizedRevenue),
    },
    byPaymentMethod: Object.entries(byPaymentMethod).map(([method, data]) => ({
      method,
      count: data.count,
      total: Number(data.total),
    })),
    byModality: Object.entries(byModality).map(([modality, data]) => ({
      modality,
      invoiceCount: data.count,
      totalBilled: Number(data.gross),
      totalPaid: Number(data.paid),
    })),
  };
}

export async function getDebtorReport(filters?: { minOutstanding?: number }) {
  const where: Prisma.InvoiceWhereInput = {
    outstandingAmount: { gt: new Prisma.Decimal(filters?.minOutstanding || 0) },
  };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { patient: true, order: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  let totalReceivable = new Prisma.Decimal(0);
  let bucketCurrent = new Prisma.Decimal(0); // <30 days
  let bucket30to60 = new Prisma.Decimal(0);
  let bucket60to90 = new Prisma.Decimal(0);
  let bucketOver90 = new Prisma.Decimal(0);

  const debtors = invoices.map((inv) => {
    const diffDays = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 3600 * 24));
    totalReceivable = totalReceivable.add(inv.outstandingAmount);

    let bucket = '<30_DAYS';
    if (diffDays > 90) {
      bucket = 'OVER_90_DAYS';
      bucketOver90 = bucketOver90.add(inv.outstandingAmount);
    } else if (diffDays > 60) {
      bucket = '61_90_DAYS';
      bucket60to90 = bucket60to90.add(inv.outstandingAmount);
    } else if (diffDays > 30) {
      bucket = '31_60_DAYS';
      bucket30to60 = bucket30to60.add(inv.outstandingAmount);
    } else {
      bucketCurrent = bucketCurrent.add(inv.outstandingAmount);
    }

    return {
      invoiceNumber: inv.invoiceNumber,
      patientId: inv.patient.patientId,
      patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
      phone: inv.patient.phone,
      accessionNumber: inv.order?.accessionNumber || 'N/A',
      totalBilled: Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      outstandingAmount: Number(inv.outstandingAmount),
      invoiceDate: inv.createdAt,
      daysOutstanding: diffDays,
      agingBucket: bucket,
    };
  });

  return {
    debtorCount: debtors.length,
    totalReceivable: Number(totalReceivable),
    agingSummary: {
      currentUnder30Days: Number(bucketCurrent),
      thirtyToSixtyDays: Number(bucket30to60),
      sixtyToNinetyDays: Number(bucket60to90),
      overNinetyDays: Number(bucketOver90),
    },
    debtors,
  };
}

// -----------------------------------------------------------------------------
// 12. ACCOUNTING EXPORT (JOURNAL VOUCHERS / GENERAL LEDGER)
// -----------------------------------------------------------------------------

export interface AccountingJournalEntry {
  voucherNumber: string;
  voucherType: 'SALES_INVOICE' | 'RECEIPT_PAYMENT' | 'DISCOUNT_ALLOWANCE' | 'REFUND_VOUCHER';
  entryDate: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  referenceId: string;
  accessionNumber: string;
  patientId: string;
  description: string;
}

export async function generateAccountingExport(
  filters?: { startDate?: string; endDate?: string; format?: 'json' | 'csv' },
  context?: AuditContext
) {
  const where: Prisma.InvoiceWhereInput = {};
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      patient: true,
      order: true,
      items: true,
      payments: { where: { paymentStatus: PaymentStatus.COMPLETED } },
      refunds: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const entries: AccountingJournalEntry[] = [];
  let voucherIndex = 1;

  for (const inv of invoices) {
    const acc = inv.order?.accessionNumber || 'N/A';
    const patId = inv.patient.patientId;
    const dateStr = inv.createdAt.toISOString().slice(0, 10);

    // 1. Sales Invoice Entry:
    // Debit Accounts Receivable (Net Total)
    // Debit Discount Allowed (if discount > 0)
    // Credit Diagnostic Imaging Revenue (Gross Total)
    const invVoucher = `JV-INV-${voucherIndex++}`;
    const netTotal = Number(inv.total);
    const discount = Number(inv.discount);
    const grossRevenue = Number(inv.grossAmount) > 0 ? Number(inv.grossAmount) : netTotal + discount;

    if (netTotal > 0) {
      entries.push({
        voucherNumber: invVoucher,
        voucherType: 'SALES_INVOICE',
        entryDate: dateStr,
        accountCode: '1200',
        accountName: 'Accounts Receivable - Patients',
        debit: netTotal,
        credit: 0.0,
        referenceId: inv.invoiceNumber,
        accessionNumber: acc,
        patientId: patId,
        description: `Diagnostic fee billed for ${acc}`,
      });
    }

    if (discount > 0) {
      entries.push({
        voucherNumber: invVoucher,
        voucherType: 'DISCOUNT_ALLOWANCE',
        entryDate: dateStr,
        accountCode: '4050',
        accountName: 'Discount Concessions Allowed',
        debit: discount,
        credit: 0.0,
        referenceId: inv.invoiceNumber,
        accessionNumber: acc,
        patientId: patId,
        description: `Approved discount on ${inv.invoiceNumber} (${inv.discountReason || 'Authorized'})`,
      });
    }

    if (grossRevenue > 0) {
      entries.push({
        voucherNumber: invVoucher,
        voucherType: 'SALES_INVOICE',
        entryDate: dateStr,
        accountCode: '4000',
        accountName: 'Diagnostic Imaging Service Revenue',
        debit: 0.0,
        credit: grossRevenue,
        referenceId: inv.invoiceNumber,
        accessionNumber: acc,
        patientId: patId,
        description: `Diagnostic revenue recognized on ${inv.invoiceNumber}`,
      });
    }

    // 2. Payments (Receipts)
    // Debit Cash (1010) or Bank (1020)
    // Credit Accounts Receivable (1200)
    for (const p of inv.payments) {
      const pVoucher = `JV-RCT-${voucherIndex++}`;
      const isCash = p.paymentMethod === PaymentMethod.CASH;
      const accountCode = isCash ? '1010' : '1020';
      const accountName = isCash ? 'Cash on Hand - Cashier' : `Bank Clearing - ${p.paymentMethod}`;
      const pDate = p.paidAt.toISOString().slice(0, 10);

      entries.push({
        voucherNumber: pVoucher,
        voucherType: 'RECEIPT_PAYMENT',
        entryDate: pDate,
        accountCode,
        accountName,
        debit: Number(p.amount),
        credit: 0.0,
        referenceId: p.reference || p.id,
        accessionNumber: acc,
        patientId: patId,
        description: `Collection via ${p.paymentMethod} on ${inv.invoiceNumber}`,
      });

      entries.push({
        voucherNumber: pVoucher,
        voucherType: 'RECEIPT_PAYMENT',
        entryDate: pDate,
        accountCode: '1200',
        accountName: 'Accounts Receivable - Patients',
        debit: 0.0,
        credit: Number(p.amount),
        referenceId: p.reference || p.id,
        accessionNumber: acc,
        patientId: patId,
        description: `Settlement against ${inv.invoiceNumber}`,
      });
    }

    // 3. Refunds
    // Debit Refund Contra-Revenue (4060)
    // Credit Cash / Bank (1010 / 1020)
    for (const r of inv.refunds) {
      const rVoucher = `JV-REF-${voucherIndex++}`;
      const isCash = r.refundMethod === PaymentMethod.CASH;
      const accountCode = isCash ? '1010' : '1020';
      const accountName = isCash ? 'Cash on Hand - Cashier' : `Bank Clearing - ${r.refundMethod}`;
      const rDate = r.createdAt.toISOString().slice(0, 10);

      entries.push({
        voucherNumber: rVoucher,
        voucherType: 'REFUND_VOUCHER',
        entryDate: rDate,
        accountCode: '4060',
        accountName: 'Diagnostic Refunds & Allowances',
        debit: Number(r.amount),
        credit: 0.0,
        referenceId: r.refundNumber,
        accessionNumber: acc,
        patientId: patId,
        description: `Refund on ${inv.invoiceNumber}: ${r.reason}`,
      });

      entries.push({
        voucherNumber: rVoucher,
        voucherType: 'REFUND_VOUCHER',
        entryDate: rDate,
        accountCode,
        accountName,
        debit: 0.0,
        credit: Number(r.amount),
        referenceId: r.refundNumber,
        accessionNumber: acc,
        patientId: patId,
        description: `Cash/Bank payout for ${r.refundNumber}`,
      });
    }
  }

  const totalDebit = entries.reduce((acc, e) => acc + e.debit, 0);
  const totalCredit = entries.reduce((acc, e) => acc + e.credit, 0);

  let csvContent = '';
  if (filters?.format === 'csv') {
    const headers = ['VoucherNumber', 'VoucherType', 'Date', 'AccountCode', 'AccountName', 'Debit', 'Credit', 'ReferenceId', 'AccessionNumber', 'PatientId', 'Description'];
    const rows = entries.map((e) => [
      `"${e.voucherNumber}"`,
      `"${e.voucherType}"`,
      `"${e.entryDate}"`,
      `"${e.accountCode}"`,
      `"${e.accountName}"`,
      e.debit.toFixed(2),
      e.credit.toFixed(2),
      `"${e.referenceId}"`,
      `"${e.accessionNumber}"`,
      `"${e.patientId}"`,
      `"${e.description.replace(/"/g, '""')}"`,
    ].join(','));
    csvContent = [headers.join(','), ...rows].join('\n');
  }

  await logAuditEvent({
    userId: context?.userId,
    action: 'ACCOUNTING_EXPORT_GENERATED',
    entityType: 'AccountingExport',
    entityId: `EXP-${new Date().toISOString().slice(0, 10)}`,
    details: {
      entriesCount: entries.length,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      format: filters?.format || 'json',
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    exportStatus: 'GENERATED_FOR_EXTERNAL_ACCOUNTING',
    integrationBoundaryNotice: 'Export format structured for import into standard ERP / General Ledger platforms (Tally / QuickBooks / SAP). No external network call performed.',
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    reconciliation: {
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    entries,
    csvContent: filters?.format === 'csv' ? csvContent : undefined,
  };
}

// -----------------------------------------------------------------------------
// HELPER: FORMAT INVOICE RESPONSE
// -----------------------------------------------------------------------------

function formatInvoiceResponse(invoice: any, patient: any, accessionNumber?: string) {
  const gross = Number(invoice.grossAmount) > 0
    ? Number(invoice.grossAmount)
    : (invoice.items && invoice.items.length > 0)
      ? invoice.items.reduce((sum: number, it: any) => sum + Number(it.totalPrice), 0)
      : Math.max(0, Number(invoice.total) + Number(invoice.discount || 0) - Number(invoice.taxAmount || 0));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    patientId: patient.patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    orderId: invoice.orderId,
    accessionNumber: accessionNumber || invoice.order?.accessionNumber || 'N/A',
    grossAmount: gross,
    discount: Number(invoice.discount),
    discountReason: invoice.discountReason,
    discountApprovedAt: invoice.discountApprovedAt,
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
    status: invoice.status,
    createdAt: invoice.createdAt,
    items: (invoice.items || []).map((it: any) => ({
      id: it.id,
      serviceCode: it.serviceCode,
      description: it.description,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
      itemType: it.itemType,
    })),
    payments: (invoice.payments || []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      paymentStatus: p.paymentStatus,
      paidAt: p.paidAt,
      receiptNumber: p.receipt?.receiptNumber,
    })),
    receipts: (invoice.receipts || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod,
      reference: r.reference,
      issuedAt: r.issuedAt,
    })),
    refunds: (invoice.refunds || []).map((rf: any) => ({
      id: rf.id,
      refundNumber: rf.refundNumber,
      amount: Number(rf.amount),
      reason: rf.reason,
      refundMethod: rf.refundMethod,
      createdAt: rf.createdAt,
    })),
    claims: (invoice.claims || []).map((cl: any) => ({
      id: cl.id,
      claimNumber: cl.claimNumber,
      payerName: cl.payerName,
      claimAmount: Number(cl.claimAmount),
      status: cl.status,
    })),
  };
}
