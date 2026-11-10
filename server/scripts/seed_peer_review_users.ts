import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../src/config/db';

export async function ensurePeerReviewUsers() {
  const passwordHash = await bcrypt.hash('Demo@123', 10);

  const rad2 = await prisma.user.upsert({
    where: { email: 'rad2@ris.local' },
    update: {
      isActive: true,
      role: UserRole.RADIOLOGIST,
    },
    create: {
      firstName: 'Marcus',
      lastName: 'Sterling',
      email: 'rad2@ris.local',
      passwordHash,
      role: UserRole.RADIOLOGIST,
      isActive: true,
    },
  });

  const clinician = await prisma.user.upsert({
    where: { email: 'clinician@ris.local' },
    update: {
      isActive: true,
      role: UserRole.RADIOLOGIST,
    },
    create: {
      firstName: 'Sarah',
      lastName: 'Mitchell',
      email: 'clinician@ris.local',
      passwordHash,
      role: UserRole.RADIOLOGIST,
      isActive: true,
    },
  });

  console.log(`[Seed] Ensured secondary radiologist: ${rad2.firstName} ${rad2.lastName} (${rad2.email})`);
  console.log(`[Seed] Ensured responsible clinician: ${clinician.firstName} ${clinician.lastName} (${clinician.email})`);
}

if (require.main === module) {
  ensurePeerReviewUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

