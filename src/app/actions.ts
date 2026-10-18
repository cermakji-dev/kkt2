'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { NEXT_STATUS } from '@/lib/format';

export type FormState = { error?: string; ok?: number };

const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Neplatné datum' });
      return z.NEVER;
    }
    return d;
  });
const reqDate = z.string().min(1).transform((v) => new Date(v + 'T00:00:00Z'));
const id = z.string().min(1).max(64);

function fields(fd: FormData) {
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
}

function done(): FormState {
  revalidatePath('/', 'layout');
  return { ok: Date.now() };
}

// ---------- Objekty ----------
const buildingSchema = z.object({
  name: text(120),
  address: text(250),
  units: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : null))
    .pipe(z.number().int().min(0).max(10_000).nullable()),
  notes: optText(2000),
});

export async function createBuilding(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = buildingSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte název a adresu objektu.' };
  await prisma.building.create({ data: p.data });
  return done();
}

export async function deleteBuilding(fd: FormData) {
  await requireUser();
  const bid = id.parse(fd.get('id'));
  try {
    await prisma.building.delete({ where: { id: bid } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return; // má navázané záznamy, UI smazání nenabízí
    }
    throw e;
  }
  revalidatePath('/', 'layout');
  redirect('/buildings');
}

// ---------- Úkoly ----------
const taskSchema = z.object({
  title: text(200),
  buildingId: id,
  dueAt: optDate,
  notes: optText(1000),
});

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = taskSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte úkol a vyberte objekt.' };
  await prisma.task.create({ data: p.data });
  return done();
}

export async function cycleTask(fd: FormData) {
  await requireUser();
  const t = await prisma.task.findUnique({ where: { id: id.parse(fd.get('id')) }, select: { id: true, status: true } });
  if (!t) return;
  await prisma.task.update({ where: { id: t.id }, data: { status: NEXT_STATUS[t.status] } });
  revalidatePath('/', 'layout');
}

export async function deleteTask(fd: FormData) {
  await requireUser();
  await prisma.task.deleteMany({ where: { id: id.parse(fd.get('id')) } });
  revalidatePath('/', 'layout');
}

// ---------- Klíče ----------
const keySchema = z.object({
  code: text(40),
  description: optText(200),
  buildingId: id,
});

export async function createKey(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = keySchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte kód svazku a vyberte objekt.' };
  try {
    await prisma.keySet.create({ data: p.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: `Svazek s kódem ${p.data.code} už existuje.` };
    }
    throw e;
  }
  return done();
}

const lendSchema = z.object({ id, holder: text(80), date: reqDate });

export async function lendKey(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = lendSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte, komu klíče půjčujete.' };
  await prisma.keySet.update({ where: { id: p.data.id }, data: { holder: p.data.holder, borrowedAt: p.data.date } });
  return done();
}

export async function returnKey(fd: FormData) {
  await requireUser();
  await prisma.keySet.update({ where: { id: id.parse(fd.get('id')) }, data: { holder: null, borrowedAt: null } });
  revalidatePath('/', 'layout');
}

export async function deleteKey(fd: FormData) {
  await requireUser();
  await prisma.keySet.deleteMany({ where: { id: id.parse(fd.get('id')) } });
  revalidatePath('/', 'layout');
}

// ---------- Kontroly ----------
const inspectionSchema = z.object({
  type: text(80),
  buildingId: id,
  inspectedAt: reqDate,
  nextDue: optDate,
  result: z.enum(['OK', 'DEFECT']),
  notes: optText(500),
});

export async function createInspection(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = inspectionSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte druh kontroly, objekt a datum.' };
  await prisma.inspection.create({ data: p.data });
  return done();
}

export async function deleteInspection(fd: FormData) {
  await requireUser();
  await prisma.inspection.deleteMany({ where: { id: id.parse(fd.get('id')) } });
  revalidatePath('/', 'layout');
}
