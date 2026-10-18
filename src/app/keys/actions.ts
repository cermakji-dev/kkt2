'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { FormState } from '@/app/actions';

const optStr = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

/** data:image/png;base64,... → bajty (max ~300 kB). */
function decodeSignature(v: FormDataEntryValue | null): Uint8Array<ArrayBuffer> | null {
  if (typeof v !== 'string' || !v.startsWith('data:image/png;base64,')) return null;
  const b = new Uint8Array(Buffer.from(v.slice('data:image/png;base64,'.length), 'base64'));
  return b.length > 0 && b.length < 300_000 ? b : null;
}

const loanSchema = z.object({
  keySetId: z.string().min(1),
  holder: z.string().trim().min(1).max(120),
  holderPhone: optStr(40),
  holderCompany: optStr(120),
  purpose: optStr(200),
  note: optStr(1000),
  expectedReturn: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + 'T00:00:00Z') : null)),
});

export async function createLoan(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = loanSchema.safeParse({
    keySetId: fd.get('keySetId'),
    holder: fd.get('holder'),
    holderPhone: fd.get('holderPhone') ?? undefined,
    holderCompany: fd.get('holderCompany') ?? undefined,
    purpose: fd.get('purpose') ?? undefined,
    note: fd.get('note') ?? undefined,
    expectedReturn: fd.get('expectedReturn') ?? undefined,
  });
  if (!p.success) return { error: 'Vyplňte, kdo klíče přebírá.' };
  const sigHolder = decodeSignature(fd.get('sigHolder'));
  const sigIssuer = decodeSignature(fd.get('sigIssuer'));
  if (!sigHolder) return { error: 'Chybí podpis přebírajícího.' };

  const key = await prisma.keySet.findUnique({ where: { id: p.data.keySetId }, select: { id: true, holder: true } });
  if (!key) return { error: 'Svazek neexistuje.' };
  if (key.holder) return { error: 'Svazek je už zapůjčený, nejdřív ho vraťte.' };

  const now = new Date();
  const loan = await prisma.$transaction(async (tx) => {
    const l = await tx.keyLoan.create({
      data: { ...p.data, borrowedAt: now, issuedById: me.id },
      select: { id: true },
    });
    await tx.keySet.update({
      where: { id: key.id },
      data: { holder: p.data.holderCompany || p.data.holder, borrowedAt: now },
    });
    await tx.attachment.create({ data: { loanId: l.id, kind: 'SIGNATURE_HOLDER', mime: 'image/png', data: sigHolder } });
    if (sigIssuer) {
      await tx.attachment.create({ data: { loanId: l.id, kind: 'SIGNATURE_ISSUER', mime: 'image/png', data: sigIssuer } });
    }
    return l;
  });
  revalidatePath('/', 'layout');
  redirect(`/keys/${key.id}?nova=${loan.id}`);
}

export async function returnKey(fd: FormData) {
  const me = await requireUser();
  const keySetId = z.string().min(1).parse(fd.get('id'));
  const now = new Date();
  await prisma.$transaction([
    prisma.keyLoan.updateMany({
      where: { keySetId, returnedAt: null },
      data: { returnedAt: now, returnedToId: me.id },
    }),
    prisma.keySet.update({ where: { id: keySetId }, data: { holder: null, borrowedAt: null } }),
  ]);
  revalidatePath('/', 'layout');
}
