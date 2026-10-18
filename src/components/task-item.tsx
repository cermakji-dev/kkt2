import Link from 'next/link';
import type { Priority, TaskStatus } from '@prisma/client';
import { CheckButton } from './task-client';
import { initials, displayName } from '@/lib/auth';
import { dueLabel, PRIORITY } from '@/lib/tasks';

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

const firstName = (p: { name: string | null; email: string }) => (p.name ? p.name.split(' ')[0] : p.email.split('@')[0]);

/** Řádek úkolu. V širokém kontejneru se zobrazí jako tabulka se sloupci, v úzkém kompaktně. */
export function TaskItem({ t, href, showBuilding = true }: { t: TaskListItem; href: string; showBuilding?: boolean; showStatus?: boolean }) {
  const done = t.status === 'DONE';
  const due = dueLabel(t.dueAt);
  const subDone = t.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const subAll = t.subtasks?.length ?? 0;
  const pr = PRIORITY[t.priority];
  const comments = t._count?.comments ?? 0;
  return (
    <div className={'trow' + (done ? ' done' : '') + (due.tone === 'bad' && !done ? ' late' : '')}>
      <span className="c-check">
        <CheckButton id={t.id} done={done} size={18} />
      </span>
      <Link href={href} className="c-title" scroll={false}>
        <span className="tt">{t.title}</span>
        {t.status === 'IN_PROGRESS' && <span className="st-dot" title="Rozpracováno">Rozpracováno</span>}
        {subAll > 0 && (
          <span className="meta-s" title="Podúkoly">
            ☑ {subDone}/{subAll}
          </span>
        )}
        {comments > 0 && (
          <span className="meta-s" title="Komentáře">
            💬 {comments}
          </span>
        )}
        <span className="open-hint" aria-hidden="true">Detail ›</span>
      </Link>
      {showBuilding && <span className="c-bld">{t.building ? <span className="chip-s">{t.building.name}</span> : <span className="muted">—</span>}</span>}
      <span className="c-who">
        {t.assignee !== undefined &&
          (t.assignee ? (
            <span className="who" title={displayName(t.assignee)}>
              <span className="avatar xs">{initials(t.assignee)}</span>
              <span className="who-n">{firstName(t.assignee)}</span>
            </span>
          ) : (
            <span className="who none" title="Nepřiřazeno">
              <span className="avatar xs empty">?</span>
              <span className="who-n">nikdo</span>
            </span>
          ))}
      </span>
      <span className={'c-due due ' + due.tone}>{due.text}</span>
      <span className="c-pri">{t.priority !== 'NONE' && <span className={'flag ' + pr.tone}>{pr.label}</span>}</span>
    </div>
  );
}

/** Hlavička sloupců (zobrazí se jen v širokém kontejneru). */
export function TaskHead({ showBuilding = true }: { showBuilding?: boolean }) {
  return (
    <div className="thead" aria-hidden="true">
      <span />
      <span>Úkol</span>
      {showBuilding && <span>Objekt</span>}
      <span>Řeší</span>
      <span>Termín</span>
      <span>Priorita</span>
    </div>
  );
}
