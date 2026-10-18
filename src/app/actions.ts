'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireUser } from '@/lib/auth';
import { NEXT_STATUS } from '@/lib/format';
import { defaultNextDue } from '@/lib/revisions';

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
  await requireAdmin();
  const p = buildingSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte název a adresu objektu.' };
  await prisma.building.create({ data: p.data });
  return done();
}

export async function deleteBuilding(fd: FormData) {
  await requireAdmin();
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

const assignSchema = z.object({
  id,
  technicianId: z.string().max(64).optional().transform((v) => v || null),
  referentId: z.string().max(64).optional().transform((v) => v || null),
});

export async function assignBuilding(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = assignSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Neplatné přiřazení.' };
  await prisma.building.update({
    where: { id: p.data.id },
    data: { technicianId: p.data.technicianId, referentId: p.data.referentId },
  });
  return done();
}

// ---------- Úkoly ----------
const taskSchema = z.object({
  title: text(200),
  buildingId: z.string().max(64).optional().transform((v) => v || null),
  dueAt: optDate,
  notes: optText(1000),
  assigneeId: z.string().max(64).optional(),
});

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = taskSchema.safeParse(fields(fd));
  if (!p.success) return { error: 'Vyplňte úkol a vyberte objekt.' };
  const { assigneeId: rawAssignee, ...data } = p.data;
  // Bez výběru připadne úkol technikovi objektu.
  let assigneeId: string | null = rawAssignee && rawAssignee !== 'auto' ? rawAssignee : null;
  if ((rawAssignee === undefined || rawAssignee === 'auto') && data.buildingId) {
    const b = await prisma.building.findUnique({ where: { id: data.buildingId }, select: { technicianId: true } });
    assigneeId = b?.technicianId ?? null;
  }
  await prisma.task.create({ data: { ...data, assigneeId } });
  return done();
}

export async function assignTask(fd: FormData) {
  await requireUser();
  const tid = id.parse(fd.get('id'));
  const raw = String(fd.get('assigneeId') ?? '');
  await prisma.task.update({ where: { id: tid }, data: { assigneeId: raw || null } });
  revalidatePath('/', 'layout');
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
  count: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : null))
    .pipe(z.number().int().min(1).max(99).nullable()),
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
  // Bez ručně zadaného termínu se další termín dopočítá ze zákonného intervalu.
  const nextDue = p.data.nextDue ?? defaultNextDue(p.data.type, p.data.inspectedAt);
  await prisma.inspection.create({ data: { ...p.data, nextDue } });
  return done();
}

export async function deleteInspection(fd: FormData) {
  await requireUser();
  await prisma.inspection.deleteMany({ where: { id: id.parse(fd.get('id')) } });
  revalidatePath('/', 'layout');
}
