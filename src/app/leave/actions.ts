'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireUser } from '@/lib/auth';
import { workingDays } from '@/lib/worktime';
import type { FormState } from '@/app/actions';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(v + 'T00:00:00Z'));

const reqSchema = z.object({
  type: z.enum(['DOVOLENA', 'SICK_DAY']),
  from: date,
  to: date.optional(),
  half: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function requestLeave(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = reqSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte typ a datum.' };
  const from = p.data.from;
  const to = p.data.type === 'SICK_DAY' ? from : p.data.to ?? from;
  if (to < from) return { error: 'Datum „do“ je před datem „od“.' };
  let days = workingDays(from, to);
  if (days === 0) return { error: 'Ve zvoleném období není žádný pracovní den.' };
  if (p.data.half === 'on' && days === 1) days = 0.5;

  const year = from.getUTCFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1));
  const yEnd = new Date(Date.UTC(year, 11, 31));
  const used = await prisma.leaveRequest.aggregate({
    where: { profileId: me.id, type: p.data.type, status: { in: ['PENDING', 'APPROVED'] }, from: { gte: yStart, lte: yEnd } },
    _sum: { days: true },
  });
  const limit = p.data.type === 'DOVOLENA' ? me.vacationDays : me.sickDays;
  if ((used._sum.days ?? 0) + days > limit) {
    return { error: `Překročili byste roční nárok (${limit} dní). Zbývá ${Math.max(0, limit - (used._sum.days ?? 0))} dní.` };
  }
  const overlap = await prisma.leaveRequest.count({
    where: { profileId: me.id, status: { in: ['PENDING', 'APPROVED'] }, from: { lte: to }, to: { gte: from } },
  });
  if (overlap) return { error: 'V tomto termínu už máte žádost.' };

  await prisma.leaveRequest.create({
    data: {
      profileId: me.id,
      type: p.data.type,
      from,
      to,
      days,
      note: p.data.note || null,
      // Sick day se neschvaluje, jen eviduje.
      status: p.data.type === 'SICK_DAY' ? 'APPROVED' : 'PENDING',
      decidedAt: p.data.type === 'SICK_DAY' ? new Date() : null,
    },
  });
  revalidatePath('/leave');
  return { ok: Date.now() };
}

export async function cancelLeave(fd: FormData) {
  const me = await requireUser();
  const id = String(fd.get('id') ?? '');
  const r = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!r || (r.profileId !== me.id && me.role !== 'ADMIN')) return;
  await prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  revalidatePath('/leave');
}

export async function decideLeave(fd: FormData) {
  const me = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const decision = z.enum(['APPROVED', 'REJECTED']).parse(fd.get('decision'));
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: decision, approverId: me.id, decidedAt: new Date() },
  });
  revalidatePath('/', 'layout');
}

const entSchema = z.object({
  id: z.string().min(1),
  vacationDays: z.coerce.number().int().min(0).max(60),
  sickDays: z.coerce.number().int().min(0).max(30),
});

export async function setEntitlement(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = entSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Neplatný nárok.' };
  await prisma.profile.update({ where: { id: p.data.id }, data: { vacationDays: p.data.vacationDays, sickDays: p.data.sickDays } });
  revalidatePath('/leave');
  return { ok: Date.now() };
}
