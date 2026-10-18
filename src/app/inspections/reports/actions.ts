'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { startOfToday } from '@/lib/format';
import { getTemplate, itemKey, reportStats, type ItemsMap } from '@/lib/templates';
import { elog } from '@/lib/e2e';

const DAY = 86_400_000;

function addMonths(d: Date, m: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + m);
  return r;
}

export async function startReport(fd: FormData) {
  const me = await requireUser();
  const p = z.object({ buildingId: z.string().min(1), template: z.string().min(1) }).parse(Object.fromEntries(fd));
  const t = getTemplate(p.template);
  if (!t) throw new Error('Neznámá šablona');
  const today = startOfToday();
  const r = await prisma.inspectionReport.create({
    data: {
      buildingId: p.buildingId,
      template: t.key,
      date: today,
      nextDue: addMonths(today, t.intervalMonths),
      inspectorId: me.id,
    },
    select: { id: true },
  });
  redirect(`/inspections/reports/${r.id}`);
}

const itemSchema = z.object({
  s: z.enum(['OK', 'DEFECT', 'NA']).optional(),
  n: z.string().max(1000).optional(),
  task: z.boolean().optional(),
});
const saveSchema = z.object({
  items: z.record(z.string().max(80), itemSchema),
  summary: z.string().max(4000).nullable(),
  svjName: z.string().max(120).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type ReportPayload = z.infer<typeof saveSchema>;

async function draftOrThrow(id: string) {
  const r = await prisma.inspectionReport.findUnique({ where: { id }, select: { id: true, status: true, buildingId: true, template: true } });
  if (!r) throw new Error('Protokol neexistuje');
  if (r.status !== 'DRAFT') throw new Error('Dokončený protokol už nelze měnit');
  return r;
}

export async function saveReport(id: string, payload: ReportPayload): Promise<{ ok: boolean; at: number }> {
  await requireUser();
  await draftOrThrow(id);
  const p = saveSchema.parse(payload);
  await prisma.inspectionReport.update({
    where: { id },
    data: {
      items: p.items as Prisma.InputJsonValue,
      summary: p.summary || null,
      svjName: p.svjName || null,
      date: new Date(p.date + 'T00:00:00Z'),
      nextDue: p.nextDue ? new Date(p.nextDue + 'T00:00:00Z') : null,
    },
  });
  return { ok: true, at: Date.now() };
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadAttachment(fd: FormData): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const reportId = String(fd.get('reportId') ?? '');
  const kind = z.enum(['PHOTO', 'SIGNATURE_TECH', 'SIGNATURE_SVJ']).parse(fd.get('kind'));
  const key = fd.get('itemKey');
  const file = fd.get('file');
  if (!(file instanceof Blob)) return { error: 'Chybí soubor.' };
  if (!ALLOWED.includes(file.type)) return { error: 'Podporované jsou jen obrázky JPG, PNG nebo WebP.' };
  if (file.size > 3_500_000) return { error: 'Fotka je příliš velká.' };
  await draftOrThrow(reportId);
  if (kind === 'PHOTO') {
    const count = await prisma.attachment.count({ where: { reportId, kind: 'PHOTO' } });
    if (count >= 40) return { error: 'Protokol může mít nejvýš 40 fotek.' };
  } else {
    await prisma.attachment.deleteMany({ where: { reportId, kind } });
  }
  const a = await prisma.attachment.create({
    data: {
      reportId,
      kind,
      itemKey: typeof key === 'string' && key ? key.slice(0, 80) : null,
      mime: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    },
    select: { id: true },
  });
  return { id: a.id };
}

export async function deleteAttachment(id: string) {
  await requireUser();
  const a = await prisma.attachment.findUnique({ where: { id }, select: { reportId: true } });
  if (!a?.reportId) return;
  await draftOrThrow(a.reportId);
  await prisma.attachment.delete({ where: { id } });
}

export async function deleteReport(fd: FormData) {
  await requireUser();
  const id = String(fd.get('id') ?? '');
  await draftOrThrow(id);
  await prisma.inspectionReport.delete({ where: { id } });
  revalidatePath('/inspections');
  redirect('/inspections');
}

export async function finalizeReport(id: string): Promise<{ error?: string }> {
  elog('finalize start', id);
  await requireUser();
  const r = await draftOrThrow(id);
  const t = getTemplate(r.template);
  if (!t) return { error: 'Neznámá šablona protokolu.' };
  const full = await prisma.inspectionReport.findUniqueOrThrow({
    where: { id },
    include: { building: { select: { technicianId: true } } },
  });
  const items = (full.items ?? {}) as ItemsMap;
  const st = reportStats(t, items);
  if (st.filled === 0) return { error: 'Vyplňte aspoň jednu položku.' };

  const defects = t.sections.flatMap((s) =>
    s.items
      .filter((i) => items[itemKey(s, i)]?.s === 'DEFECT')
      .map((i) => ({ section: s, item: i, v: items[itemKey(s, i)] })),
  );
  const due = new Date(startOfToday().getTime() + 14 * DAY);

  await prisma.$transaction([
    prisma.inspection.create({
      data: {
        buildingId: full.buildingId,
        type: t.inspectionType,
        inspectedAt: full.date,
        nextDue: full.nextDue,
        result: st.defects ? 'DEFECT' : 'OK',
        notes: st.defects
          ? `${st.defects} ${st.defects === 1 ? 'závada' : st.defects < 5 ? 'závady' : 'závad'}: ${defects.map((d) => d.item.label).join(', ')}`.slice(0, 500)
          : full.summary?.slice(0, 500) || null,
        reportId: id,
      },
    }),
    ...defects
      .filter((d) => d.v.task !== false)
      .map((d) =>
        prisma.task.create({
          data: {
            title: `${d.item.label}: ${d.v.n?.trim() || 'odstranit závadu z kontroly'}`.slice(0, 200),
            notes: `Z protokolu „${t.label}“ (${d.section.label}).`,
            buildingId: full.buildingId,
            assigneeId: full.building.technicianId,
            dueAt: due,
            reportId: id,
          },
        }),
      ),
    prisma.inspectionReport.update({ where: { id }, data: { status: 'FINAL', finalizedAt: new Date() } }),
  ]);
  elog('finalize done');
  return {};
}
