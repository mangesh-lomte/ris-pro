import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getOrders,
  getOrder,
  create,
  update,
  generateAccessionPreview,
  trackOrder,
  syncMwl,
  importHis,
  orderQuerySchema,
  createOrderSchema,
  updateOrderSchema,
} from '../controllers/order.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All imaging order routes require authentication
router.use(authenticate);

// GET /api/v1/orders - List imaging orders with relational patient and accession details
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  validateRequest({ query: orderQuerySchema }),
  asyncHandler(getOrders)
);

// GET /api/v1/orders/generate-accession - Preview unique Accession Number
router.get(
  '/generate-accession',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(generateAccessionPreview)
);

// POST /api/v1/orders - Create new clinical imaging order
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: createOrderSchema }),
  asyncHandler(create)
);

// POST /api/v1/orders/import-his - Ingest scan orders from hospital HIS / doctor EMR
router.post(
  '/import-his',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(importHis)
);

// GET /api/v1/orders/:id/tracking - Order lifecycle status tracking timeline
router.get(
  '/:id/tracking',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(trackOrder)
);

// POST /api/v1/orders/:id/mwl-sync - Synchronize booked order to DICOM Modality Worklist (MWL)
router.post(
  '/:id/mwl-sync',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(syncMwl)
);

// GET /api/v1/orders/:id - Get order details by ID or Accession Number
router.get(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getOrder)
);

// PATCH /api/v1/orders/:id - Update order metadata (before completion)
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: updateOrderSchema }),
  asyncHandler(update)
);

export default router;
