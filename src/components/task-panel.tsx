import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { displayName, initials } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { fmtDate, toInputDate } from '@/lib/format';
import { PRIORITY, STATUS_META } from '@/lib/tasks';
import { getTemplate } from '@/lib/templates';
import { CheckButton, QuickAdd, TaskField } from './task-client';
import { ActButton, ActionForm, DeleteButton } from './forms';
import { addComment, deleteComment, quickAdd } from '@/app/tasks/actions';
import { deleteTask } from '@/app/actions';

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `před ${h} h`;
  const dd = Math.round(h / 24);
  return dd === 1 ? 'včera' : `před ${dd} dny`;
}

/** Detail úkolu ve výsuvném panelu (jako v Asaně). */
export async function TaskPanel({ id, closeHref }: { id: string; closeHref: string }) {
  const person = { select: { id: true, name: true, email: true } } as const;
  const [t, people, buildings] = await Promise.all([
    prisma.task.findUnique({
      where: { id },
      include: {
        building: { select: { id: true, name: true } },
        assignee: person,
        createdBy: person,
        parent: { select: { id: true, title: true } },
        subtasks: { orderBy: { createdAt: 'asc' }, include: { assignee: person } },
        comments: { orderBy: { createdAt: 'asc' }, include: { author: person } },
        report: { select: { id: true, template: true, date: true } },
      },
    }),
    activePeople(),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!t) {
    return (
      <aside className="tpanel" aria-label="Detail úkolu">
        <div className="tpanel-h">
          <span />
          <Link href={closeHref} className="btn sm ghost" scroll={false} aria-label="Zavřít">
            ✕
          </Link>
        </div>
        <div className="empty">Úkol neexistuje nebo byl smazán.</div>
      </aside>
    );
  }
  const done = t.status === 'DONE';
  const sep = closeHref.includes('?') ? '&' : '?';

  return (
    <>
      <Link href={closeHref} className="tpanel-backdrop" scroll={false} aria-label="Zavřít detail" />
      <aside className="tpanel" aria-label="Detail úkolu">
        <div className="tpanel-h">
          <div className={'tdone-btn' + (done ? ' on' : '')}>
            <CheckButton id={t.id} done={done} size={18} />
            <span>{done ? 'Hotovo' : 'Označit jako hotové'}</span>
          </div>
          <div className="tpanel-tools">
            <DeleteButton action={deleteTask} id={t.id} label="Smazat" />
            <Link href={closeHref} className="btn sm ghost" scroll={false} aria-label="Zavřít">
              ✕
            </Link>
          </div>
        </div>
        <div className="tpanel-body">
          {t.parent && (
            <Link href={`${closeHref}${sep}t=${t.parent.id}`} className="back" scroll={false}>
              ↑ {t.parent.title}
            </Link>
          )}
          <TaskField id={t.id} field="title" value={t.title} type="title" label="Název úkolu" />

          <dl className="tprops">
            <dt>Řeší</dt>
            <dd>
              <TaskField
                id={t.id}
                field="assigneeId"
                value={t.assigneeId ?? ''}
                type="select"
                label="Řešitel"
                options={[{ value: '', label: 'Nepřiřazeno' }, ...people.map((p) => ({ value: p.id, label: displayName(p) }))]}
              />
            </dd>
            <dt>Termín</dt>
            <dd>
              <TaskField id={t.id} field="dueAt" value={t.dueAt ? toInputDate(t.dueAt) : ''} type="date" label="Termín" />
            </dd>
            <dt>Objekt</dt>
            <dd>
              <TaskField
                id={t.id}
                field="buildingId"
                value={t.buildingId ?? ''}
                type="select"
                label="Objekt"
                options={[{ value: '', label: 'Bez objektu' }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </dd>
            <dt>Priorita</dt>
            <dd>
              <TaskField
                id={t.id}
                field="priority"
                value={t.priority}
                type="select"
                label="Priorita"
                options={(['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const).map((p) => ({ value: p, label: PRIORITY[p].label }))}
                className={'pri-' + t.priority.toLowerCase()}
              />
            </dd>
            <dt>Stav</dt>
            <dd>
              <TaskField
                id={t.id}
                field="status"
                value={t.status}
                type="select"
                label="Stav"
                options={(['OPEN', 'IN_PROGRESS', 'DONE'] as const).map((s) => ({ value: s, label: STATUS_META[s].label }))}
              />
            </dd>
          </dl>

          <div className="tsection">
            <h4>Popis</h4>
            <TaskField id={t.id} field="description" value={t.description ?? t.notes ?? ''} type="textarea" label="Popis" placeholder="Co přesně je potřeba udělat, kde, kontakty…" />
          </div>

          <div className="tsection">
            <h4>
              Podúkoly{' '}
              {t.subtasks.length > 0 && (
                <span className="muted small">
                  {t.subtasks.filter((s) => s.status === 'DONE').length}/{t.subtasks.length}
                </span>
              )}
            </h4>
            <div className="subtasks">
              {t.subtasks.map((s) => (
                <div key={s.id} className={'subtask' + (s.status === 'DONE' ? ' done' : '')}>
                  <CheckButton id={s.id} done={s.status === 'DONE'} size={16} />
                  <Link href={`${closeHref}${sep}t=${s.id}`} scroll={false}>
                    {s.title}
                  </Link>
                  {s.assignee && <span className="avatar xs">{initials(s.assignee)}</span>}
                </div>
              ))}
              <QuickAdd action={quickAdd} placeholder="Přidat podúkol…" hidden={{ parentId: t.id }} />
            </div>
          </div>

          <div className="tsection">
            <h4>Komentáře</h4>
            <div className="comments">
              {t.comments.map((c) => (
                <div key={c.id} className="comment">
                  <span className="avatar sm">{c.author ? initials(c.author) : '?'}</span>
                  <div className="comment-b">
                    <div className="comment-h">
                      <b>{displayName(c.author)}</b>
                      <span className="muted small">{ago(c.createdAt)}</span>
                      <ActButton action={deleteComment} id={c.id} className="btn sm ghost xs" title="Smazat komentář">
                        ×
                      </ActButton>
                    </div>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))}
              <ActionForm action={addComment} submitLabel="Komentovat" className="add commentform" successText="Přidáno" resetOnSuccess>
                <input type="hidden" name="taskId" value={t.id} />
                <label className="wide">
                  <textarea name="body" rows={2} placeholder="Napište komentář…" maxLength={4000} required aria-label="Komentář" />
                </label>
              </ActionForm>
            </div>
          </div>

          <p className="tfoot muted small">
            Vytvořeno {fmtDate(t.createdAt)}
            {t.createdBy && ` · ${displayName(t.createdBy)}`}
            {t.completedAt && ` · dokončeno ${fmtDate(t.completedAt)}`}
            {t.report && (
              <>
                {' · '}
                <Link href={`/inspections/reports/${t.report.id}`}>z protokolu {getTemplate(t.report.template)?.label ?? ''}</Link>
              </>
            )}
            {t.building && (
              <>
                {' · '}
                <Link href={`/buildings/${t.building.id}`}>karta objektu</Link>
              </>
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
