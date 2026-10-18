import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Empty, Panel, TaskRow } from '@/components/ui';
import { AddTask } from '@/components/add-forms';
import { isOverdue, startOfToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'active', label: 'Otevřené' },
  { key: 'overdue', label: 'Po termínu' },
  { key: 'done', label: 'Hotové' },
  { key: 'all', label: 'Vše' },
] as const;
type F = (typeof FILTERS)[number]['key'];

export default async function Tasks({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f: raw } = await searchParams;
  const f: F = FILTERS.some((x) => x.key === raw) ? (raw as F) : 'active';
  const where: Prisma.TaskWhereInput =
    f === 'active'
      ? { status: { not: 'DONE' } }
      : f === 'done'
        ? { status: 'DONE' }
        : f === 'overdue'
          ? { status: { not: 'DONE' }, dueAt: { lt: startOfToday() } }
          : {};

  const [tasks, buildings] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { building: { select: { id: true, name: true } } },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  tasks.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));

  return (
    <>
      <div className="head">
        <div>
          <h1>Úkoly</h1>
          <p className="muted">Klepnutím na stav úkol posunete: otevřený → rozpracovaný → hotovo.</p>
        </div>
        <div className="filters">
          {FILTERS.map((x) => (
            <Link key={x.key} href={x.key === 'active' ? '/tasks' : `/tasks?f=${x.key}`} className="chip" aria-current={f === x.key ? 'true' : undefined}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>
      <Panel title="Úkoly" count={tasks.length} action={<AddTask buildings={buildings} />}>
        {tasks.length ? (
          tasks.map((t) => <TaskRow key={t.id} t={t} />)
        ) : (
          <Empty>{buildings.length ? 'Nic tu není.' : 'Nejdřív přidejte objekt v Evidenci objektů.'}</Empty>
        )}
      </Panel>
    </>
  );
}
