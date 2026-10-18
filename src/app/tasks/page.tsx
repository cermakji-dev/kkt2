import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUser, initials } from '@/lib/auth';
import { TaskHead, TaskItem, taskItemInclude } from '@/components/task-item';
import { TaskPanel } from '@/components/task-panel';
import { Board, QuickAdd } from '@/components/task-client';
import { quickAdd } from './actions';
import { BUCKETS, bucketOf, dueLabel, PRIORITY, sortTasks, type Bucket } from '@/lib/tasks';
import { startOfToday } from '@/lib/format';
import { elog } from '@/lib/e2e';

export const dynamic = 'force-dynamic';

const SCOPES = [
  { key: 'mine', label: 'Moje úkoly' },
  { key: 'team', label: 'Celý tým' },
  { key: 'unassigned', label: 'Nepřiřazené' },
  { key: 'done', label: 'Dokončené' },
] as const;
type Scope = (typeof SCOPES)[number]['key'];

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; v?: string; b?: string; t?: string }>;
}) {
  elog('tasks page start');
  const me = (await getUser())!;
  const sp = await searchParams;
  const scope: Scope = SCOPES.some((x) => x.key === sp.s) ? (sp.s as Scope) : 'mine';
  const view = sp.v === 'board' ? 'board' : 'list';
  const buildingId = sp.b || '';

  // Odkazy zachovávají aktuální filtry.
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { s: scope === 'mine' ? undefined : scope, v: view === 'list' ? undefined : view, b: buildingId || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return '/tasks' + (s ? '?' + s : '');
  };
  const base = q({});
  const taskHref = (id: string) => q({ t: id });

  // Dnes dokončené zůstanou v seznamu přeškrtnuté (jako v Asaně).
  const notDone: Prisma.TaskWhereInput = { OR: [{ status: { not: 'DONE' } }, { completedAt: { gte: startOfToday() } }] };
  let scoped: Prisma.TaskWhereInput;
  if (scope === 'mine') scoped = view === 'board' ? { assigneeId: me.id } : { assigneeId: me.id, ...notDone };
  else if (scope === 'team') scoped = view === 'board' ? {} : notDone;
  else if (scope === 'unassigned') scoped = { assigneeId: null, status: { not: 'DONE' } };
  else scoped = { status: 'DONE' };
  const where: Prisma.TaskWhereInput = { parentId: null, ...(buildingId ? { buildingId } : {}), ...scoped };

  const [tasks, buildings, counts] = await Promise.all([
    prisma.task.findMany({
      where,
      include: taskItemInclude,
      orderBy: scope === 'done' ? { completedAt: 'desc' } : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: scope === 'done' || view === 'board' ? 200 : undefined,
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { parentId: null, status: { not: 'DONE' } },
      _count: { _all: true },
    }),
  ]);
  elog('tasks page data');
  const mineCount = counts.find((c) => c.assigneeId === me.id)?._count._all ?? 0;
  const unassignedCount = counts.find((c) => c.assigneeId === null)?._count._all ?? 0;
  const teamCount = counts.reduce((a, c) => a + c._count._all, 0);
  const countFor: Record<Scope, number | null> = { mine: mineCount, team: teamCount, unassigned: unassignedCount, done: null };

  const groups = new Map<Bucket, typeof tasks>();
  if (scope !== 'done') for (const t of [...tasks].sort(sortTasks)) groups.set(bucketOf(t.dueAt), [...(groups.get(bucketOf(t.dueAt)) ?? []), t]);
  const late = groups.get('late')?.length ?? 0;

  const boardCards =
    view === 'board'
      ? tasks
          .filter((t) => t.status !== 'DONE' || (t.completedAt && Date.now() - t.completedAt.getTime() < 14 * 86_400_000))
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            sortOrder: t.sortOrder,
            building: t.building?.name ?? null,
            due: dueLabel(t.dueAt),
            priority: t.priority !== 'NONE' ? { label: PRIORITY[t.priority].label, tone: PRIORITY[t.priority].tone } : null,
            assignee: t.assignee ? initials(t.assignee) : null,
            subtasks: t.subtasks.length ? `${t.subtasks.filter((s) => s.status === 'DONE').length}/${t.subtasks.length}` : null,
            comments: t._count.comments,
            href: taskHref(t.id),
          }))
      : [];

  return (
    <>
      <div className="head">
        <div>
          <h1>{SCOPES.find((x) => x.key === scope)!.label}</h1>
          <p className="muted">
            {scope === 'done'
              ? 'Naposledy dokončené úkoly.'
              : `${tasks.length} otevřených${late ? ` · ${late} po termínu` : ''}`}
          </p>
        </div>
        <div className="viewtoggle" role="tablist" aria-label="Zobrazení">
          <Link href={q({ v: undefined })} aria-current={view === 'list' ? 'true' : undefined} scroll={false}>
            Seznam
          </Link>
          <Link href={q({ v: 'board' })} aria-current={view === 'board' ? 'true' : undefined} scroll={false}>
            Nástěnka
          </Link>
        </div>
      </div>

      <div className="tbar">
        <div className="filters scroll">
          {SCOPES.map((x) => (
            <Link key={x.key} href={q({ s: x.key === 'mine' ? undefined : x.key })} className="chip" aria-current={scope === x.key ? 'true' : undefined} scroll={false}>
              {x.label}
              {countFor[x.key] != null && <span className="cnt">{countFor[x.key]}</span>}
            </Link>
          ))}
        </div>
        <form className="tbar-b" action="/tasks">
          {scope !== 'mine' && <input type="hidden" name="s" value={scope} />}
          {view === 'board' && <input type="hidden" name="v" value="board" />}
          <select name="b" defaultValue={buildingId} aria-label="Objekt" className="mini" data-autosubmit>
            <option value="">Všechny objekty</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="btn sm">Filtrovat</button>
        </form>
      </div>

      {scope !== 'done' && (
        <QuickAdd
          action={quickAdd}
          placeholder={scope === 'unassigned' ? 'Přidat nepřiřazený úkol…' : 'Přidat úkol… (Enter)'}
          hidden={{ ...(buildingId ? { buildingId } : {}), ...(scope === 'unassigned' ? { assigneeId: 'none' } : {}) }}
          buildings={buildingId ? undefined : buildings}
        />
      )}

      {view === 'board' ? (
        <Board cards={boardCards} />
      ) : scope === 'done' ? (
        <section className="tlist">
          <TaskHead />
          {tasks.map((t) => (
            <TaskItem key={t.id} t={t} href={taskHref(t.id)} />
          ))}
          {tasks.length === 0 && <div className="empty">Zatím nic dokončeného.</div>}
        </section>
      ) : tasks.length === 0 ? (
        <div className="panel empty big-empty">
          <b>{scope === 'mine' ? 'Všechno hotovo 🎉' : 'Nic tu není'}</b>
          <span>{scope === 'mine' && unassignedCount > 0 ? <Link href={q({ s: 'unassigned' })}>Převzít některý z {unassignedCount} nepřiřazených úkolů →</Link> : 'Nový úkol přidáte řádkem výše.'}</span>
        </div>
      ) : (
        <section className="tlist">
          <TaskHead />
          {BUCKETS.filter((b) => groups.has(b.key)).map((b) => (
            <details key={b.key} className={'tgroup tgroup-' + b.key} open>
              <summary className="tgroup-h">
                <span className="chev" aria-hidden="true" />
                {b.label}
                <span className="count">{groups.get(b.key)!.length}</span>
              </summary>
              {groups.get(b.key)!.map((t) => (
                <TaskItem key={t.id} t={t} href={taskHref(t.id)} />
              ))}
            </details>
          ))}
        </section>
      )}

      {sp.t && <TaskPanel id={sp.t} closeHref={base} />}
    </>
  );
}
