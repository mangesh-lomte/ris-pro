import { Router } from 'express';
import { getDashboardOverviewHandler, searchDashboardHandler } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All dashboard endpoints require staff authentication
router.use(authenticate);

// GET /api/v1/dashboard/overview
router.get('/overview', asyncHandler(getDashboardOverviewHandler));

// GET /api/v1/dashboard/search?q=...
router.get('/search', asyncHandler(searchDashboardHandler));

export default router;

