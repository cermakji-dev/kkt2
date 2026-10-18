'use client';
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/app/actions';
import { moveTask, toggleDone, updateTaskField } from '@/app/tasks/actions';

/** Kulaté zaškrtávátko jako v Asaně, s okamžitou odezvou. */
export function CheckButton({ id, done, size = 20 }: { id: string; done: boolean; size?: number }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleDone(fd);
        })
      }
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button className={'tcheck' + (optimistic ? ' on' : '')} aria-pressed={optimistic} aria-label={optimistic ? 'Vrátit mezi nehotové' : 'Označit jako hotové'} style={{ width: size, height: size }}>
        <svg viewBox="0 0 16 16" width={size * 0.6} height={size * 0.6} aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}

/** Rychlé přidání úkolu: napiš a Enter. */
export function QuickAdd({
  action,
  placeholder = 'Přidat úkol…',
  hidden = {},
  buildings,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  placeholder?: string;
  hidden?: Record<string, string>;
  buildings?: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      const input = ref.current?.querySelector<HTMLInputElement>('input[name="title"]');
      if (input) input.value = '';
      input?.focus();
    }
  }, [state.ok, router]);
  return (
    <form ref={ref} action={formAction} className={'quickadd' + (focused ? ' focus' : '')}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="qa-plus" aria-hidden="true">+</span>
      <input name="title" placeholder={placeholder} maxLength={200} autoComplete="off" onFocus={() => setFocused(true)} onBlur={(e) => !e.currentTarget.value && setFocused(false)} aria-label="Název úkolu" />
      {focused && (
        <>
          {buildings && (
            <select name="buildingId" defaultValue="" aria-label="Objekt" className="mini">
              <option value="">Bez objektu</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <input name="dueAt" type="date" aria-label="Termín" className="mini" />
          <QASubmit />
        </>
      )}
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
function QASubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm pri" disabled={pending}>
      {pending ? '…' : 'Přidat'}
    </button>
  );
}

/** Pole v detailu úkolu, které se uloží samo (změna / opuštění pole). */
export function TaskField({
  id,
  field,
  value,
  type = 'text',
  options,
  placeholder,
  className,
  label,
}: {
  id: string;
  field: string;
  value: string;
  type?: 'text' | 'textarea' | 'date' | 'select' | 'title';
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const initial = useRef(value);
  const submit = (v: string) => {
    if (v === initial.current) return;
    initial.current = v;
    const fd = new FormData(ref.current!);
    fd.set('value', v);
    start(async () => {
      await updateTaskField(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  };
  return (
    <form ref={ref} className={'tfield ' + (className ?? '') + (pending ? ' pending' : '') + (saved ? ' saved' : '')} onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      {type === 'select' ? (
        <select aria-label={label} defaultValue={value} onChange={(e) => submit(e.target.value)}>
          {options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea aria-label={label} defaultValue={value} placeholder={placeholder} rows={4} onBlur={(e) => submit(e.target.value)} />
      ) : type === 'title' ? (
        <textarea
          aria-label={label}
          defaultValue={value}
          rows={1}
          className="ttitle"
          onBlur={(e) => submit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
        />
      ) : (
        <input aria-label={label} type={type} defaultValue={value} placeholder={placeholder} onChange={type === 'date' ? (e) => submit(e.target.value) : undefined} onBlur={type !== 'date' ? (e) => submit(e.target.value) : undefined} />
      )}
    </form>
  );
}

type Card = {
  id: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  sortOrder: number;
  building: string | null;
  due: { text: string; tone: string };
  priority: { label: string; tone: string } | null;
  assignee: string | null;
  subtasks: string | null;
  comments: number;
  href: string;
};

const COLS: { key: Card['status']; label: string }[] = [
  { key: 'OPEN', label: 'K řešení' },
  { key: 'IN_PROGRESS', label: 'Rozpracováno' },
  { key: 'DONE', label: 'Hotovo' },
];

/** Nástěnka: přetahování mezi sloupci (myš i dotyk přes tlačítka), okamžitá odezva. */
export function Board({ cards }: { cards: Card[] }) {
  const [items, setItems] = useState(cards);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Card['status'] | null>(null);
  const [, start] = useTransition();
  useEffect(() => setItems(cards), [cards]);

  function move(id: string, status: Card['status']) {
    const col = items.filter((c) => c.status === status && c.id !== id);
    const order = (col.length ? Math.max(...col.map((c) => c.sortOrder)) : 0) + 1;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status, sortOrder: order } : c)));
    start(() => moveTask(id, status, order));
  }

  return (
    <div className="board">
      {COLS.map((col) => {
        const list = items.filter((c) => c.status === col.key).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section
            key={col.key}
            className={'bcol' + (over === col.key ? ' over' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (drag) move(drag, col.key);
              setDrag(null);
            }}
          >
            <header>
              <h3>{col.label}</h3>
              <span className="count">{list.length}</span>
            </header>
            <div className="bcards">
              {list.map((c) => (
                <article
                  key={c.id}
                  className={'bcard' + (drag === c.id ? ' dragging' : '') + (c.status === 'DONE' ? ' done' : '')}
                  draggable
                  onDragStart={(e) => {
                    setDrag(c.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDrag(null)}
                >
                  <Link href={c.href} className="bcard-t">
                    {c.title}
                  </Link>
                  <div className="bcard-m">
                    {c.priority && <span className={'flag ' + c.priority.tone}>{c.priority.label}</span>}
                    {c.building && <span className="chip-s">{c.building}</span>}
                  </div>
                  <div className="bcard-f">
                    {c.due.text && <span className={'due ' + c.due.tone}>{c.due.text}</span>}
                    {c.subtasks && <span className="meta-s">☑ {c.subtasks}</span>}
                    {c.comments > 0 && <span className="meta-s">💬 {c.comments}</span>}
                    <span className="sp" />
                    {c.assignee && <span className="avatar xs">{c.assignee}</span>}
                  </div>
                  <div className="bcard-move">
                    {COLS.filter((x) => x.key !== c.status).map((x) => (
                      <button key={x.key} type="button" className="btn sm ghost" onClick={() => move(c.id, x.key)}>
                        → {x.label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {list.length === 0 && <div className="bempty">Přetáhněte sem úkol</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
