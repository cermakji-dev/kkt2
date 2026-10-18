import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/** Aktivní lidé pro výběr řešitele / technika / referenta. */
export const activePeople = cache(() =>
  prisma.profile.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  }),
);
