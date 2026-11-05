import { Router } from 'express';
import { getOrders, generateAccessionPreview, orderQuerySchema } from '../controllers/order.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All imaging order routes require authentication
router.use(authenticate);

// GET /api/v1/orders - List imaging orders with relational patient and accession details
router.get('/', validateRequest({ query: orderQuerySchema }), asyncHandler(getOrders));

// GET /api/v1/orders/generate-accession - Preview unique Accession Number
router.get('/generate-accession', asyncHandler(generateAccessionPreview));

export default router;
