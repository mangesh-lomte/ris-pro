import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { recordPayment } from '../src/services/billing.service';
import { prisma } from '../src/config/db';
import { PaymentMethod } from '@prisma/client';

describe('Billing Service - Record Payment', () => {
  let testInvoiceId: string;
  let testPatientId: string;

  beforeAll(async () => {
    // Create a test patient
    const patient = await prisma.patient.create({
      data: {
        patientId: 'TEST-PAY-001',
        firstName: 'Payment',
        lastName: 'Test',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        phone: '9876543210',
      },
    });
    testPatientId = patient.id;

    // Create a test invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-TEST-PAY-001',
        patientId: testPatientId,
        grossAmount: 500,
        discount: 0,
        taxAmount: 0,
        total: 500,
        paidAmount: 0,
        outstandingAmount: 500,
        status: 'PENDING',
      },
    });
    testInvoiceId = invoice.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.receipt.deleteMany({ where: { invoiceId: testInvoiceId } });
    await prisma.payment.deleteMany({ where: { invoiceId: testInvoiceId } });
    await prisma.invoice.delete({ where: { id: testInvoiceId } });
    await prisma.patient.delete({ where: { id: testPatientId } });
  });

  it('should reject payment when paymentMethod is missing', async () => {
    await expect(
      recordPayment(testInvoiceId, {
        amount: 100,
        paymentMethod: undefined as any, // Simulate missing payment method
      })
    ).rejects.toThrow('Payment method is required');
  });

  it('should reject payment when paymentMethod is invalid', async () => {
    await expect(
      recordPayment(testInvoiceId, {
        amount: 100,
        paymentMethod: 'INVALID_METHOD' as any,
      })
    ).rejects.toThrow('Invalid payment method');
  });

  it('should accept CASH payment with valid paymentMethod', async () => {
    const result = await recordPayment(testInvoiceId, {
      amount: 100,
      paymentMethod: PaymentMethod.CASH,
      idempotencyKey: 'TEST-CASH-001',
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('paymentMethod', PaymentMethod.CASH);
    expect(result).toHaveProperty('amountPaid', 100);
    expect(result).toHaveProperty('receiptNumber');
  });

  it('should accept UPI payment with valid paymentMethod', async () => {
    const result = await recordPayment(testInvoiceId, {
      amount: 150,
      paymentMethod: PaymentMethod.UPI,
      reference: 'UPI-TEST-REF-123',
      idempotencyKey: 'TEST-UPI-001',
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('paymentMethod', PaymentMethod.UPI);
    expect(result).toHaveProperty('amountPaid', 150);
  });

  it('should not expose Prisma internals in error messages', async () => {
    try {
      await recordPayment(testInvoiceId, {
        amount: 100,
        paymentMethod: undefined as any,
      });
      fail('Should have thrown an error');
    } catch (error: any) {
      const errorMessage = error.message.toLowerCase();
      expect(errorMessage).not.toContain('prisma');
      expect(errorMessage).not.toContain('tx.receipt.create');
      expect(errorMessage).not.toContain('c:\\users\\');
      expect(errorMessage).not.toContain('node_modules');
    }
  });

  it('should prevent overpayment', async () => {
    // Get current invoice state
    const invoice = await prisma.invoice.findUnique({ where: { id: testInvoiceId } });

    await expect(
      recordPayment(testInvoiceId, {
        amount: Number(invoice!.outstandingAmount) + 100,
        paymentMethod: PaymentMethod.CASH,
      })
    ).rejects.toThrow('exceeds remaining outstanding balance');
  });

  it('should handle idempotency correctly', async () => {
    const idempotencyKey = 'TEST-IDEMPOTENT-001';

    // First payment
    const result1 = await recordPayment(testInvoiceId, {
      amount: 50,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      idempotencyKey,
    });

    // Second payment with same idempotency key
    const result2 = await recordPayment(testInvoiceId, {
      amount: 50,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      idempotencyKey,
    });

    expect(result2).toHaveProperty('idempotentReplay', true);
    expect(result1.paymentId).toBe(result2.paymentId);
  });
});
