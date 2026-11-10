import { Prisma } from '@prisma/client';

export function formatINR(amount: number | string | Prisma.Decimal | null | undefined): string {
  const num = Number(amount ?? 0);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

