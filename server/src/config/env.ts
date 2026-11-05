import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from server root or monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for PostgreSQL connection'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for healthcare security'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid Environment Variables Configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
