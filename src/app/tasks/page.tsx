import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { Empty, Panel, TaskRow } from '@/components/ui';
import { AddTask } from '@/components/add-forms';
import { isOverdue, startOfToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'mine', label: 'Moje' },
  { key: 'active', label: 'Všechny otevřené' },
  { key: 'overdue', label: 'Po termínu' },
  { key: 'unassigned', label: 'Nepřiřazené' },
  { key: 'done', label: 'Hotové' },
] as const;
type F = (typeof FILTERS)[number]['key'];

export default async function Tasks({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const me = (await getUser())!;
  const { f: raw } = await searchParams;
  const f: F = FILTERS.some((x) => x.key === raw) ? (raw as F) : 'mine';
  const open = { status: { not: 'DONE' as const } };
  const where: Prisma.TaskWhereInput =
    f === 'mine'
      ? { ...open, assigneeId: me.id }
      : f === 'active'
        ? open
        : f === 'done'
          ? { status: 'DONE' }
          : f === 'unassigned'
            ? { ...open, assigneeId: null }
            : { ...open, dueAt: { lt: startOfToday() } };

  const [tasks, buildings, people] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: f === 'done' ? 100 : undefined,
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    activePeople(),
  ]);
  tasks.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));

  return (
    <>
      <div className="head">
        <div>
          <h1>Úkoly</h1>
          <p className="muted">Klepnutím na stav úkol posunete: otevřený → rozpracovaný → hotovo.</p>
        </div>
      </div>
      <div className="filters scroll" role="tablist">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === 'mine' ? '/tasks' : `/tasks?f=${x.key}`}
            className="chip"
            aria-current={f === x.key ? 'true' : undefined}
          >
            {x.label}
          </Link>
        ))}
      </div>
      <Panel title={FILTERS.find((x) => x.key === f)!.label} count={tasks.length} action={<AddTask buildings={buildings} people={people} />}>
        {tasks.length ? (
          tasks.map((t) => <TaskRow key={t.id} t={t} people={people} />)
        ) : (
          <Empty>{f === 'mine' ? 'Nemáte žádné otevřené úkoly. 🎉' : 'Nic tu není.'}</Empty>
        )}
      </Panel>
    </>
  );
}
