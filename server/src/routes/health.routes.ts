import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// GET /api/v1/health - System health and database connectivity diagnostics
router.get('/', asyncHandler(getHealth));

export default router;
