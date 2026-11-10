import { Request, Response } from 'express';
import {
  registerWalkIn,
  recordOrderConsent,
  getOrderConsent,
  getAppointmentSlip,
  getOrderBilling,
  recordOrderPayment,
} from '../services/reception.service';
import { sendSuccess } from '../utils/apiResponse';

export async function registerWalkInHandler(req: Request, res: Response) {
  const result = await registerWalkIn(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Walk-in scan order and token generated successfully.', 201);
}

export async function recordConsentHandler(req: Request, res: Response) {
  const result = await recordOrderConsent(req.params.id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Signed consent form recorded successfully.');
}

export async function getConsentHandler(req: Request, res: Response) {
  const result = await getOrderConsent(req.params.id);
  return sendSuccess(res, result, 'Consent forms retrieved successfully.');
}

export async function getAppointmentSlipHandler(req: Request, res: Response) {
  const result = await getAppointmentSlip(req.params.id);
  return sendSuccess(res, result, 'Appointment slip and preparation instructions retrieved successfully.');
}

export async function getOrderBillingHandler(req: Request, res: Response) {
  const result = await getOrderBilling(req.params.id);
  return sendSuccess(res, result, 'Billing and payment status retrieved successfully.');
}

export async function recordOrderPaymentHandler(req: Request, res: Response) {
  const result = await recordOrderPayment(req.params.id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Payment recorded and official receipt generated.');
}
