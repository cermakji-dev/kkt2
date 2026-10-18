'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { FormState } from '@/app/actions';
import { elog } from '@/lib/e2e';

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath('/', 'layout');

export async function quickAdd(_: FormState, fd: FormData): Promise<FormState> {
  elog('quickAdd start');
  const me = await requireUser();
  elog('quickAdd user', me.id);
  const p = z
    .object({
      title: z.string().trim().min(1).max(200),
      buildingId: z.string().max(64).optional(),
      dueAt: z.string().optional(),
      assigneeId: z.string().max(64).optional(),
      parentId: z.string().max(64).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Napište název úkolu.' };
  const parent = p.data.parentId ? await prisma.task.findUnique({ where: { id: p.data.parentId }, select: { buildingId: true, assigneeId: true } }) : null;
  await prisma.task.create({
    data: {
      title: p.data.title,
      buildingId: p.data.buildingId || parent?.buildingId || null,
      dueAt: p.data.dueAt ? new Date(p.data.dueAt + 'T00:00:00Z') : null,
      assigneeId: p.data.assigneeId === 'none' ? null : p.data.assigneeId || parent?.assigneeId || me.id,
      parentId: p.data.parentId || null,
      createdById: me.id,
    },
  });
  elog('quickAdd created');
  elog('quickAdd revalidated');
  return { ok: Date.now() };
}

export async function toggleDone(fd: FormData) {
  await requireUser();
  const t = await prisma.task.findUnique({ where: { id: id.parse(fd.get('id')) }, select: { id: true, status: true } });
  if (!t) return;
  const done = t.status !== 'DONE';
  await prisma.task.update({
    where: { id: t.id },
    data: { status: done ? 'DONE' : 'OPEN', completedAt: done ? new Date() : null },
  });
  refresh();
}

export async function moveTask(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE', sortOrder: number) {
  await requireUser();
  await prisma.task.update({
    where: { id: id.parse(taskId) },
    data: { status, sortOrder, completedAt: status === 'DONE' ? new Date() : null },
  });
  refresh();
}

const FIELDS = ['title', 'description', 'assigneeId', 'buildingId', 'dueAt', 'priority', 'status'] as const;

export async function updateTaskField(fd: FormData) {
  await requireUser();
  const tid = id.parse(fd.get('id'));
  const field = z.enum(FIELDS).parse(fd.get('field'));
  const raw = String(fd.get('value') ?? '');
  let data: Prisma.TaskUncheckedUpdateInput;
  switch (field) {
    case 'title': {
      const v = raw.trim().slice(0, 200);
      if (!v) return;
      data = { title: v };
      break;
    }
    case 'description':
      data = { description: raw.trim().slice(0, 5000) || null };
      break;
    case 'assigneeId':
      data = { assigneeId: raw || null };
      break;
    case 'buildingId':
      data = { buildingId: raw || null };
      break;
    case 'dueAt':
      data = { dueAt: /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00Z') : null };
      break;
    case 'priority':
      data = { priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']).parse(raw) };
      break;
    case 'status': {
      const s = z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).parse(raw);
      data = { status: s, completedAt: s === 'DONE' ? new Date() : null };
      break;
    }
  }
  await prisma.task.update({ where: { id: tid }, data });
  refresh();
}

export async function addComment(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = z.object({ taskId: id, body: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Napište komentář.' };
  await prisma.taskComment.create({ data: { taskId: p.data.taskId, body: p.data.body, authorId: me.id } });
  return { ok: Date.now() };
}

export async function deleteComment(fd: FormData) {
  const me = await requireUser();
  const c = await prisma.taskComment.findUnique({ where: { id: id.parse(fd.get('id')) } });
  if (!c || (c.authorId !== me.id && me.role !== 'ADMIN')) return;
  await prisma.taskComment.delete({ where: { id: c.id } });
  revalidatePath('/tasks');
}
