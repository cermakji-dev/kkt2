'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireUser } from '@/lib/auth';
import type { FormState } from '@/app/actions';

const kind = z.enum(['PRICHOD', 'ODCHOD', 'SLUZEBNI_CESTA', 'LEKAR', 'HOME_OFFICE']);

export async function punch(fd: FormData) {
  const me = await requireUser();
  const k = kind.parse(fd.get('kind'));
  const note = String(fd.get('note') ?? '').trim().slice(0, 200) || null;
  // Ochrana proti dvojkliku: stejná událost v rámci 30 s se nezapíše dvakrát.
  const last = await prisma.attendanceEvent.findFirst({ where: { profileId: me.id }, orderBy: { at: 'desc' } });
  if (last && last.kind === k && Date.now() - last.at.getTime() < 30_000) return;
  await prisma.attendanceEvent.create({ data: { profileId: me.id, kind: k, at: new Date(), note } });
  revalidatePath('/', 'layout');
}

const manualSchema = z.object({
  profileId: z.string().min(1),
  kind,
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  note: z.string().trim().max(200).optional(),
});

/** Ruční doplnění (admin). Čas se zadává v pražském čase. */
export async function addManual(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const p = manualSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyberte zaměstnance, událost a čas.' };
  const at = pragueLocalToUtc(p.data.at);
  await prisma.attendanceEvent.create({
    data: { profileId: p.data.profileId, kind: p.data.kind, at, note: p.data.note || 'Doplněno ručně', createdById: me.id },
  });
  return { ok: Date.now() };
}

export async function deleteEvent(fd: FormData) {
  const me = await requireUser();
  const id = String(fd.get('id') ?? '');
  const e = await prisma.attendanceEvent.findUnique({ where: { id } });
  if (!e) return;
  // Vlastní záznam smaže každý jen týž den; admin cokoli.
  const sameDay = new Date().toDateString() === e.at.toDateString();
  if (me.role !== 'ADMIN' && (e.profileId !== me.id || !sameDay)) return;
  await prisma.attendanceEvent.delete({ where: { id } });
  revalidatePath('/attendance');
}

function pragueLocalToUtc(local: string): Date {
  // Zjistí posun Prahy pro dané datum (letní/zimní čas).
  const guess = new Date(local + ':00Z');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', timeZoneName: 'shortOffset' }).formatToParts(guess);
  const off = parts.find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = off.match(/GMT([+-]\d+)/);
  const hours = m ? Number(m[1]) : 1;
  return new Date(guess.getTime() - hours * 3_600_000);
}
