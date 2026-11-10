import { Router } from 'express';
import { login, getMe, loginSchema } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// POST /api/v1/auth/login - Secure authentication with bcrypt verification
router.post('/login', validateRequest({ body: loginSchema }), asyncHandler(login));

// GET /api/v1/auth/me - Retrieve current authenticated healthcare professional
router.get('/me', authenticate, asyncHandler(getMe));

export default router;

