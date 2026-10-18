'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { FormState } from '@/app/actions';

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optDate = z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : null));

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  ico: opt(20),
  category: z.string().max(20).default('JINE'),
  contactName: opt(120),
  phone: opt(40),
  emergencyPhone: opt(40),
  email: opt(120),
  web: opt(200),
  note: opt(2000),
});

export async function createSupplier(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = supplierSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte název firmy.' };
  await prisma.supplier.create({ data: p.data });
  return { ok: Date.now() };
}

export async function updateSupplier(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = String(fd.get('id') ?? '');
  const p = supplierSchema.safeParse(Object.fromEntries(fd));
  if (!p.success || !id) return { error: 'Vyplňte název firmy.' };
  await prisma.supplier.update({ where: { id }, data: { ...p.data, active: fd.get('active') === 'on' } });
  return { ok: Date.now() };
}

const contractSchema = z.object({
  supplierId: z.string().min(1),
  buildingId: z.string().optional().transform((v) => v || null),
  title: z.string().trim().min(1).max(200),
  validFrom: optDate,
  validTo: optDate,
  noticeDays: z.string().optional().transform((v) => (v ? Number.parseInt(v, 10) || null : null)),
  price: opt(120),
  note: opt(2000),
});

export async function createContract(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = contractSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte firmu a předmět smlouvy.' };
  await prisma.contract.create({ data: { ...p.data, autoRenew: fd.get('autoRenew') === 'on' } });
  return { ok: Date.now() };
}

export async function deleteContract(fd: FormData) {
  await requireUser();
  await prisma.contract.deleteMany({ where: { id: String(fd.get('id') ?? '') } });
  revalidatePath('/', 'layout');
}
