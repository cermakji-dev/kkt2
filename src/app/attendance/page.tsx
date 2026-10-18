import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { Panel, Pill } from '@/components/ui';
import { ActButton, ActionForm } from '@/components/forms';
import { addManual, deleteEvent, punch } from './actions';
import { currentStatus, fmtDuration, fmtHM, hours, KIND_LABEL, pragueDay, STATUS_LABEL, STATUS_TONE, summarize } from '@/lib/worktime';

export const dynamic = 'force-dynamic';

const BUTTONS = [
  { kind: 'PRICHOD', label: 'Příchod', when: ['ODCHOD', 'LEKAR', 'SLUZEBNI_CESTA', 'HOME_OFFICE'] },
  { kind: 'SLUZEBNI_CESTA', label: 'Služební cesta', when: ['PRICHOD', 'ODCHOD', 'LEKAR'] },
  { kind: 'LEKAR', label: 'Lékař', when: ['PRICHOD', 'SLUZEBNI_CESTA', 'HOME_OFFICE', 'ODCHOD'] },
  { kind: 'HOME_OFFICE', label: 'Home office', when: ['ODCHOD', 'PRICHOD'] },
  { kind: 'ODCHOD', label: 'Odchod', when: ['PRICHOD', 'SLUZEBNI_CESTA', 'LEKAR', 'HOME_OFFICE'] },
] as const;

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1) - 2 * 3_600_000), to: new Date(Date.UTC(y, m, 1)) };
}

export default async function Attendance({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = (await getUser())!;
  const { m } = await searchParams;
  const now = new Date();
  const ym = m && /^\d{4}-\d{2}$/.test(m) ? m : pragueDay(now).slice(0, 7);
  const { from, to } = monthRange(ym);
  const isAdmin = me.role === 'ADMIN';

  const [mine, all, people] = await Promise.all([
    prisma.attendanceEvent.findMany({ where: { profileId: me.id, at: { gte: from, lt: to } }, orderBy: { at: 'asc' } }),
    isAdmin ? prisma.attendanceEvent.findMany({ where: { at: { gte: from, lt: to } }, orderBy: { at: 'asc' } }) : Promise.resolve([]),
    isAdmin ? prisma.profile.findMany({ where: { active: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);
  const todayKey = pragueDay(now);
  const todayEvents = mine.filter((e) => pragueDay(e.at) === todayKey);
  const status = currentStatus(mine, now);
  const sumMine = summarize(mine, now);
  const today = sumMine.byDay.get(todayKey);
  const visible = BUTTONS.filter((b) => (b.when as readonly string[]).includes(status.kind));
  const [y, mo] = ym.split('-').map(Number);
  const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, '0')}`;
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}`;
  const monthName = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, 1)));
  const isThisMonth = ym === todayKey.slice(0, 7);

  return (
    <>
      <div className="head">
        <div>
          <h1>Docházka</h1>
          <p className="muted">Příchody, odchody a přerušení. Hodiny se počítají samy.</p>
        </div>
      </div>

      <section className={'panel clock ' + (STATUS_TONE[status.kind] || 'off')}>
        <div className="clock-state">
          <span className="lbl">Teď</span>
          <h2>{STATUS_LABEL[status.kind]}</h2>
          <p className="muted">
            {status.since ? `od ${fmtHM(status.since)}` : 'Dnes zatím bez záznamu'}
            {today && today.work > 0 && ` · dnes odpracováno ${fmtDuration(today.work)}`}
          </p>
        </div>
        <div className="clock-btns">
          {visible.map((b) => (
            <form key={b.kind} action={punch}>
              <input type="hidden" name="kind" value={b.kind} />
              <button className={'btn ' + (b.kind === 'PRICHOD' || b.kind === 'ODCHOD' ? 'pri big' : 'big')}>{b.label}</button>
            </form>
          ))}
        </div>
        {todayEvents.length > 0 && (
          <ol className="timeline">
            {todayEvents.map((e) => (
              <li key={e.id}>
                <span className="mono">{fmtHM(e.at)}</span>
                <span>{KIND_LABEL[e.kind]}</span>
                {e.note && <span className="muted small">{e.note}</span>}
                <ActButton action={deleteEvent} id={e.id} className="btn sm ghost" title="Smazat záznam">
                  ×
                </ActButton>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="monthnav">
        <a href={`/attendance?m=${prev}`} className="btn sm ghost">←</a>
        <b className="cap">{monthName}</b>
        {!isThisMonth && <a href={`/attendance?m=${next}`} className="btn sm ghost">→</a>}
      </div>

      <div className="stats three">
        <div className="stat">
          <span>Odpracováno</span>
          <b>{hours(sumMine.work).toLocaleString('cs-CZ')} h</b>
          <em>{sumMine.days} dní</em>
        </div>
        <div className="stat">
          <span>Průměr na den</span>
          <b>{sumMine.days ? hours(sumMine.work / sumMine.days).toLocaleString('cs-CZ') : 0} h</b>
          <em>bez přestávek</em>
        </div>
        <div className="stat">
          <span>Lékař</span>
          <b>{hours(sumMine.doctor).toLocaleString('cs-CZ')} h</b>
          <em>omluvená nepřítomnost</em>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <Panel title="Moje dny">
          {[...sumMine.byDay.entries()].reverse().map(([day, d]) => (
            <div key={day} className="row">
              <div className="main">
                <div className="t">
                  {new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'))}
                </div>
                <div className="s">
                  {d.first && d.last && (
                    <span className="mono">
                      {fmtHM(d.first)} – {d.open && day === todayKey ? 'teď' : fmtHM(d.last)}
                    </span>
                  )}
                  {d.trip > 0 && <span>cesta {fmtDuration(d.trip)}</span>}
                  {d.home > 0 && <span>home office</span>}
                  {d.doctor > 0 && <span>lékař {fmtDuration(d.doctor)}</span>}
                </div>
              </div>
              <div className="acts">
                <span className="mono">{fmtDuration(d.work)}</span>
              </div>
            </div>
          ))}
          {sumMine.byDay.size === 0 && <div className="empty">V tomto měsíci žádné záznamy.</div>}
        </Panel>

        {isAdmin && (
          <>
            <Panel
              title="Tým – podklady pro mzdy"
              action={
                <a href={`/attendance/export?m=${ym}`} className="btn sm">
                  Export CSV
                </a>
              }
            >
              {people.map((p) => {
                const ev = all.filter((e) => e.profileId === p.id);
                const s = summarize(ev, now);
                const st = currentStatus(ev, now);
                return (
                  <div key={p.id} className="row">
                    <div className="main">
                      <div className="t">{displayName(p)}</div>
                      <div className="s">
                        <span>{s.days} dní</span>
                        {s.doctor > 0 && <span>lékař {hours(s.doctor).toLocaleString('cs-CZ')} h</span>}
                      </div>
                    </div>
                    <div className="acts">
                      {isThisMonth && <Pill tone={STATUS_TONE[st.kind]}>{STATUS_LABEL[st.kind]}</Pill>}
                      <span className="mono">{hours(s.work).toLocaleString('cs-CZ')} h</span>
                    </div>
                  </div>
                );
              })}
            </Panel>
            <section className="panel">
              <header>
                <h2>Ruční doplnění</h2>
              </header>
              <ActionForm action={addManual} submitLabel="Doplnit záznam" resetOnSuccess>
                <label>
                  Zaměstnanec
                  <select name="profileId" required defaultValue="">
                    <option value="" disabled>
                      Vyberte…
                    </option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {displayName(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Událost
                  <select name="kind" defaultValue="PRICHOD">
                    {Object.entries(KIND_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Datum a čas
                  <input name="at" type="datetime-local" required />
                </label>
                <label>
                  Důvod
                  <input name="note" maxLength={200} placeholder="Zapomenutý příchod…" />
                </label>
              </ActionForm>
            </section>
          </>
        )}
      </div>
    </>
  );
}
