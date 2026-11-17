import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from server root or monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.string().default('demo'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for PostgreSQL connection'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for healthcare security'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PACS_ADAPTER: z.enum(['mock', 'orthanc']).default('mock'),
  ORTHANC_URL: z.string().default('http://localhost:8044'),
  ORTHANC_USERNAME: z.string().optional(),
  ORTHANC_PASSWORD: z.string().optional(),
  ORTHANC_TIMEOUT_MS: z.string().default('5000').transform((val) => parseInt(val, 10)),
  OHIF_BASE_URL: z.string().default('http://localhost:3002'),
  HOSPITAL_TIME_ZONE: z.string().default('Asia/Kolkata'),
  DASHBOARD_DELAYED_PATIENT_MINUTES: z.string().default('15').transform((val) => parseInt(val, 10)),
}).superRefine((data, ctx) => {
  if (data.PACS_ADAPTER === 'orthanc') {
    if (!data.ORTHANC_URL || data.ORTHANC_URL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ORTHANC_URL'],
        message: 'ORTHANC_URL is required when PACS_ADAPTER=orthanc',
      });
    }
    if (!data.ORTHANC_USERNAME || data.ORTHANC_USERNAME.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ORTHANC_USERNAME'],
        message: 'ORTHANC_USERNAME is required when PACS_ADAPTER=orthanc',
      });
    }
    if (!data.ORTHANC_PASSWORD || data.ORTHANC_PASSWORD.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ORTHANC_PASSWORD'],
        message: 'ORTHANC_PASSWORD is required when PACS_ADAPTER=orthanc (credentials masked)',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid Environment Variables Configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

