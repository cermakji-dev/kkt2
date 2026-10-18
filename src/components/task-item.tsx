import Link from 'next/link';
import type { Priority, TaskStatus } from '@prisma/client';
import { CheckButton } from './task-client';
import { initials, displayName } from '@/lib/auth';
import { dueLabel, PRIORITY, STATUS_META } from '@/lib/tasks';

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | null;
  building?: { id: string; name: string } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  subtasks?: { status: TaskStatus }[];
  _count?: { comments: number };
};

/** Pro include v Prisma dotazech, aby měl řádek vše, co zobrazuje. */
export const taskItemInclude = {
  building: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
  subtasks: { select: { status: true } },
  _count: { select: { comments: true } },
} as const;

export function TaskItem({ t, href, showBuilding = true, showStatus = false }: { t: TaskListItem; href: string; showBuilding?: boolean; showStatus?: boolean }) {
  const done = t.status === 'DONE';
  const due = dueLabel(t.dueAt);
  const subDone = t.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const subAll = t.subtasks?.length ?? 0;
  const pr = PRIORITY[t.priority];
  return (
    <div className={'titem' + (done ? ' done' : '')}>
      <CheckButton id={t.id} done={done} />
      <Link href={href} className="titem-main" scroll={false}>
        <span className="titem-t">{t.title}</span>
        <span className="titem-m">
          {showStatus && t.status === 'IN_PROGRESS' && <span className="chip-s acc">{STATUS_META.IN_PROGRESS.label}</span>}
          {t.priority !== 'NONE' && <span className={'flag ' + pr.tone}>{pr.label}</span>}
          {showBuilding && t.building && <span className="chip-s">{t.building.name}</span>}
          {subAll > 0 && (
            <span className="meta-s">
              ☑ {subDone}/{subAll}
            </span>
          )}
          {(t._count?.comments ?? 0) > 0 && <span className="meta-s">💬 {t._count!.comments}</span>}
        </span>
      </Link>
      <span className="titem-r">
        {due.text && <span className={'due ' + due.tone}>{due.text}</span>}
        {t.assignee !== undefined && (
          <span className={'avatar xs' + (t.assignee ? '' : ' empty')} title={t.assignee ? displayName(t.assignee) : 'Nepřiřazeno'}>
            {t.assignee ? initials(t.assignee) : '?'}
          </span>
        )}
      </span>
    </div>
  );
}
