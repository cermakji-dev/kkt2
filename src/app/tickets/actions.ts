'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { STATUS, URGENCY } from '@/lib/tickets';
import type { FormState } from '@/app/actions';

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const createSchema = z.object({
  buildingId: z.string().min(1),
  unitLabel: opt(40),
  title: z.string().trim().min(1).max(200),
  description: opt(4000),
  category: z.string().max(20).default('JINE'),
  urgency: z.enum(['HAVARIE', 'VYSOKA', 'BEZNA']),
  channel: z.enum(['TELEFON', 'EMAIL', 'OSOBNE', 'KONTROLA', 'JINE']),
  reporterName: opt(120),
  reporterPhone: opt(40),
  reporterEmail: opt(120),
});

export async function createTicket(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte dům a stručný popis závady.' };
  const b = await prisma.building.findUnique({ where: { id: p.data.buildingId }, select: { technicianId: true } });
  const t = await prisma.ticket.create({
    data: {
      ...p.data,
      assigneeId: b?.technicianId ?? null,
      createdById: me.id,
      dueAt: new Date(Date.now() + URGENCY[p.data.urgency].hours * 3_600_000),
      events: { create: { authorId: me.id, kind: 'STATUS', body: 'Hlášení přijato do systému' } },
    },
    select: { id: true },
  });
  revalidatePath('/', 'layout');
  redirect(`/tickets/${t.id}`);
}

export async function setTicketStatus(fd: FormData) {
  const me = await requireUser();
  const id = z.string().min(1).parse(fd.get('id'));
  const status = z.enum(['NOVE', 'PRIJATO', 'PREDANO', 'RESI_SE', 'VYRESENO', 'ZAMITNUTO']).parse(fd.get('status'));
  const note = String(fd.get('note') ?? '').trim().slice(0, 1000);
  const closing = !STATUS[status].open;
  await prisma.ticket.update({
    where: { id },
    data: {
      status,
      resolvedAt: closing ? new Date() : null,
      events: { create: { authorId: me.id, kind: 'STATUS', body: `Stav: ${STATUS[status].label}${note ? ` – ${note}` : ''}` } },
    },
  });
  // Vyřešené hlášení uzavře i navázaný úkol.
  if (closing) {
    const t = await prisma.ticket.findUnique({ where: { id }, select: { taskId: true } });
    if (t?.taskId) await prisma.task.update({ where: { id: t.taskId }, data: { status: 'DONE', completedAt: new Date() } });
  }
  revalidatePath('/', 'layout');
}

export async function updateTicketField(fd: FormData) {
  const me = await requireUser();
  const id = z.string().min(1).parse(fd.get('id'));
  const field = z.enum(['assigneeId', 'supplierId', 'urgency', 'category']).parse(fd.get('field'));
  const value = String(fd.get('value') ?? '');
  if (field === 'urgency') {
    const u = z.enum(['HAVARIE', 'VYSOKA', 'BEZNA']).parse(value);
    const t = await prisma.ticket.findUniqueOrThrow({ where: { id }, select: { createdAt: true } });
    await prisma.ticket.update({
      where: { id },
      data: { urgency: u, dueAt: new Date(t.createdAt.getTime() + URGENCY[u].hours * 3_600_000), events: { create: { authorId: me.id, kind: 'STATUS', body: `Naléhavost: ${URGENCY[u].label}` } } },
    });
  } else if (field === 'supplierId') {
    const s = value ? await prisma.supplier.findUnique({ where: { id: value }, select: { name: true } }) : null;
    await prisma.ticket.update({
      where: { id },
      data: {
        supplierId: value || null,
        status: value ? 'PREDANO' : undefined,
        events: { create: { authorId: me.id, kind: 'STATUS', body: s ? `Předáno firmě ${s.name}` : 'Firma odebrána' } },
      },
    });
  } else if (field === 'assigneeId') {
    await prisma.ticket.update({ where: { id }, data: { assigneeId: value || null } });
  } else {
    await prisma.ticket.update({ where: { id }, data: { category: value.slice(0, 20) || 'JINE' } });
  }
  revalidatePath('/', 'layout');
}

export async function addTicketComment(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = z.object({ ticketId: z.string().min(1), body: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Napište poznámku.' };
  await prisma.ticketEvent.create({ data: { ticketId: p.data.ticketId, body: p.data.body, authorId: me.id } });
  revalidatePath(`/tickets/${p.data.ticketId}`);
  return { ok: Date.now() };
}

export async function ticketToTask(fd: FormData) {
  const me = await requireUser();
  const id = z.string().min(1).parse(fd.get('id'));
  const t = await prisma.ticket.findUniqueOrThrow({ where: { id }, include: { building: { select: { technicianId: true } } } });
  if (t.taskId) return;
  const task = await prisma.task.create({
    data: {
      title: `#${t.number} ${t.title}`.slice(0, 200),
      description: [t.description, t.unitLabel ? `Jednotka: ${t.unitLabel}` : '', t.reporterName ? `Nahlásil: ${t.reporterName} ${t.reporterPhone ?? ''}` : ''].filter(Boolean).join('\n'),
      buildingId: t.buildingId,
      assigneeId: t.assigneeId ?? t.building.technicianId,
      dueAt: t.dueAt,
      priority: t.urgency === 'HAVARIE' ? 'HIGH' : t.urgency === 'VYSOKA' ? 'MEDIUM' : 'NONE',
      createdById: me.id,
    },
  });
  await prisma.ticket.update({
    where: { id },
    data: { taskId: task.id, status: t.status === 'NOVE' ? 'RESI_SE' : t.status, events: { create: { authorId: me.id, kind: 'STATUS', body: 'Vytvořen úkol' } } },
  });
  revalidatePath('/', 'layout');
}
