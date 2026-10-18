import Link from 'next/link';
import type { Building, Inspection, KeySet, Task } from '@prisma/client';
import { ActButton, DeleteButton, LendForm } from './forms';
import { cycleTask, deleteInspection, deleteKey, deleteTask, lendKey, returnKey } from '@/app/actions';
import { dueTone, fmtDate, isOverdue, startOfToday, TASK_STATUS, toInputDate } from '@/lib/format';

export function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header>
        <h2>
          {title}
          {count != null && <span className="count">{count}</span>}
        </h2>
        {action && <div className="panel-act">{action}</div>}
      </header>
      <div className="rows">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Pill({ tone, children }: { tone?: string; children: React.ReactNode }) {
  return <span className={'pill ' + (tone ?? '')}>{children}</span>;
}

type Named = { building: Pick<Building, 'id' | 'name'> };

function BLink({ b }: { b: Pick<Building, 'id' | 'name'> }) {
  return (
    <Link href={`/buildings/${b.id}`} className="blink">
      {b.name}
    </Link>
  );
}

export function TaskRow({ t, showBuilding = true }: { t: Task & Partial<Named>; showBuilding?: boolean }) {
  const st = TASK_STATUS[t.status];
  const late = isOverdue(t);
  return (
    <div className="row">
      <div className="main">
        <div className={'t' + (t.status === 'DONE' ? ' done' : '')}>{t.title}</div>
        <div className="s">
          {showBuilding && t.building && <BLink b={t.building} />}
          {t.notes && <span>{t.notes}</span>}
        </div>
      </div>
      <div className="acts">
        {t.dueAt &&
          (late ? (
            <Pill tone="bad">Po termínu · {fmtDate(t.dueAt)}</Pill>
          ) : (
            <span className="mono due">do {fmtDate(t.dueAt)}</span>
          ))}
        <ActButton action={cycleTask} id={t.id} className={'pill btnpill ' + st.tone} title="Posunout stav">
          {st.label}
        </ActButton>
        <DeleteButton action={deleteTask} id={t.id} />
      </div>
    </div>
  );
}

export function KeyRow({ k, showBuilding = true }: { k: KeySet & Partial<Named>; showBuilding?: boolean }) {
  const out = !!k.holder;
  return (
    <div className="row">
      <div className="main">
        <div className="t">
          <span className="code">{k.code}</span>
          {k.description}
        </div>
        <div className="s">
          {showBuilding && k.building && <BLink b={k.building} />}
          <span>
            {out ? (
              <>
                u <b>{k.holder}</b> od {fmtDate(k.borrowedAt)}
              </>
            ) : (
              'v kanceláři'
            )}
          </span>
        </div>
      </div>
      <div className="acts">
        {out ? (
          <>
            <Pill tone="warn">Zapůjčeno</Pill>
            <ActButton action={returnKey} id={k.id} className="btn sm">
              Vrátit
            </ActButton>
          </>
        ) : (
          <>
            <Pill tone="ok">K dispozici</Pill>
            <LendForm action={lendKey} id={k.id} today={toInputDate(startOfToday())} />
          </>
        )}
        <DeleteButton action={deleteKey} id={k.id} />
      </div>
    </div>
  );
}

export function InspectionRow({ x, showBuilding = true }: { x: Inspection & Partial<Named>; showBuilding?: boolean }) {
  const due = dueTone(x.nextDue);
  return (
    <div className="row">
      <div className="main">
        <div className="t">
          {x.type}{' '}
          {x.result === 'DEFECT' ? <Pill tone="bad">Závada</Pill> : <Pill tone="ok">Bez závad</Pill>}
        </div>
        <div className="s">
          {showBuilding && x.building && <BLink b={x.building} />}
          <span>provedeno {fmtDate(x.inspectedAt)}</span>
          {x.notes && <span>{x.notes}</span>}
        </div>
      </div>
      <div className="acts">
        <span className="lbl">další</span>
        <Pill tone={due.tone}>{due.label}</Pill>
        <DeleteButton action={deleteInspection} id={x.id} />
      </div>
    </div>
  );
}

export function BuildingSelect({ buildings, value }: { buildings: Pick<Building, 'id' | 'name'>[]; value?: string }) {
  if (value) return <input type="hidden" name="buildingId" value={value} />;
  return (
    <label>
      Objekt
      <select name="buildingId" required defaultValue="">
        <option value="" disabled>
          Vyberte objekt…
        </option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
