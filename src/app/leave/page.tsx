import { prisma } from '@/lib/prisma';
import { displayName, getUser, initials } from '@/lib/auth';
import { Panel, Pill } from '@/components/ui';
import { ActButton, ActionForm } from '@/components/forms';
import { LeaveForm } from '@/components/leave-form';
import { cancelLeave, decideLeave, requestLeave, setEntitlement } from './actions';
import { czHolidays } from '@/lib/worktime';
import { fmtDate, startOfToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS = {
  PENDING: { label: 'Čeká na schválení', tone: 'warn' },
  APPROVED: { label: 'Schváleno', tone: 'ok' },
  REJECTED: { label: 'Zamítnuto', tone: 'bad' },
  CANCELLED: { label: 'Zrušeno', tone: '' },
} as const;
const TYPE = { DOVOLENA: 'Dovolená', SICK_DAY: 'Sick day' } as const;

function range(from: Date, to: Date) {
  return from.getTime() === to.getTime() ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}
const plural = (n: number) => (n === 1 ? 'den' : n > 1 && n < 5 ? 'dny' : 'dní');

function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div className="ring">
      <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--raised)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="url(#g)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 40 40)" />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b7bff" />
            <stop offset="1" stopColor="#5b8cff" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-txt">
        <b>{value.toLocaleString('cs-CZ')}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default async function Leave() {
  const me = (await getUser())!;
  const isAdmin = me.role === 'ADMIN';
  const year = startOfToday().getUTCFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1));
  const yEnd = new Date(Date.UTC(year, 11, 31));
  const person = { select: { id: true, name: true, email: true } } as const;

  const [mine, pending, upcoming, team] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { profileId: me.id, from: { gte: yStart, lte: yEnd } }, orderBy: { from: 'desc' } }),
    isAdmin
      ? prisma.leaveRequest.findMany({ where: { status: 'PENDING' }, include: { profile: person }, orderBy: { from: 'asc' } })
      : Promise.resolve([]),
    prisma.leaveRequest.findMany({
      where: { status: 'APPROVED', type: 'DOVOLENA', to: { gte: startOfToday() } },
      include: { profile: person },
      orderBy: { from: 'asc' },
      take: 12,
    }),
    isAdmin
      ? prisma.profile.findMany({
          where: { active: true },
          orderBy: { name: 'asc' },
          include: { leaves: { where: { status: { in: ['APPROVED', 'PENDING'] }, from: { gte: yStart, lte: yEnd } } } },
        })
      : Promise.resolve([]),
  ]);

  const sum = (t: 'DOVOLENA' | 'SICK_DAY', s: ('APPROVED' | 'PENDING')[]) =>
    mine.filter((l) => l.type === t && (s as string[]).includes(l.status)).reduce((a, l) => a + l.days, 0);
  const used = sum('DOVOLENA', ['APPROVED']);
  const waiting = sum('DOVOLENA', ['PENDING']);
  const left = me.vacationDays - used - waiting;
  const sickUsed = sum('SICK_DAY', ['APPROVED']);
  const holidays = [...czHolidays(year), ...czHolidays(year + 1)];

  return (
    <>
      <div className="head">
        <div>
          <h1>Dovolená</h1>
          <p className="muted">Rok {year} · víkendy a státní svátky se do čerpání nepočítají.</p>
        </div>
      </div>

      <div className="leave-top">
        <section className="panel balance">
          <Ring value={left} total={me.vacationDays} label="zbývá" />
          <dl>
            <div><dt>Nárok</dt><dd>{me.vacationDays} dní</dd></div>
            <div><dt>Čerpáno</dt><dd>{used.toLocaleString('cs-CZ')} dní</dd></div>
            <div><dt>Čeká na schválení</dt><dd>{waiting.toLocaleString('cs-CZ')} dní</dd></div>
            <div><dt>Sick days</dt><dd>{sickUsed} / {me.sickDays}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <header>
            <h2>Nová žádost</h2>
          </header>
          <LeaveForm action={requestLeave} holidays={holidays} remaining={left} sickRemaining={me.sickDays - sickUsed} />
        </section>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {isAdmin && pending.length > 0 && (
          <Panel title="Ke schválení" count={pending.length}>
            {pending.map((l) => (
              <div key={l.id} className="row">
                <div className="main who-row">
                  <span className="avatar">{initials(l.profile)}</span>
                  <div className="main">
                    <div className="t">{displayName(l.profile)}</div>
                    <div className="s">
                      <span>{range(l.from, l.to)}</span>
                      <span>
                        {l.days.toLocaleString('cs-CZ')} {plural(l.days)}
                      </span>
                      {l.note && <span>{l.note}</span>}
                    </div>
                  </div>
                </div>
                <div className="acts">
                  <form action={decideLeave} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <button className="btn sm danger">Zamítnout</button>
                  </form>
                  <form action={decideLeave} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <button className="btn sm pri">Schválit</button>
                  </form>
                </div>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Kdo bude pryč" count={upcoming.length}>
          {upcoming.length ? (
            upcoming.map((l) => (
              <div key={l.id} className="row">
                <div className="main who-row">
                  <span className="avatar">{initials(l.profile)}</span>
                  <div className="main">
                    <div className="t">{displayName(l.profile)}</div>
                    <div className="s">
                      <span>{range(l.from, l.to)}</span>
                    </div>
                  </div>
                </div>
                <div className="acts">
                  <span className="mono due">
                    {l.days.toLocaleString('cs-CZ')} {plural(l.days)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Nikdo nemá naplánovanou dovolenou.</div>
          )}
        </Panel>

        <Panel title="Moje žádosti" count={mine.length}>
          {mine.length ? (
            mine.map((l) => (
              <div key={l.id} className="row">
                <div className="main">
                  <div className="t">
                    {TYPE[l.type]} · {range(l.from, l.to)}
                  </div>
                  <div className="s">
                    <span>
                      {l.days.toLocaleString('cs-CZ')} {plural(l.days)}
                    </span>
                    {l.note && <span>{l.note}</span>}
                  </div>
                </div>
                <div className="acts">
                  <Pill tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Pill>
                  {(l.status === 'PENDING' || (l.status === 'APPROVED' && l.from > startOfToday())) && (
                    <ActButton action={cancelLeave} id={l.id} className="btn sm ghost">
                      Zrušit
                    </ActButton>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Letos zatím žádné žádosti.</div>
          )}
        </Panel>

        {isAdmin && (
          <Panel title="Nároky týmu">
            {team.map((p) => {
              const u = p.leaves.filter((l) => l.type === 'DOVOLENA').reduce((a, l) => a + l.days, 0);
              return (
                <details key={p.id} className="person">
                  <summary className="row">
                    <div className="main who-row">
                      <span className="avatar">{initials(p)}</span>
                      <div className="main">
                        <div className="t">{displayName(p)}</div>
                        <div className="s">
                          <span>
                            čerpá / plánuje {u.toLocaleString('cs-CZ')} z {p.vacationDays}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="acts">
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, (u / Math.max(1, p.vacationDays)) * 100)}%` }} />
                      </div>
                    </div>
                  </summary>
                  <ActionForm action={setEntitlement} submitLabel="Uložit nárok">
                    <input type="hidden" name="id" value={p.id} />
                    <label>
                      Dovolená (dní / rok)
                      <input name="vacationDays" type="number" min={0} max={60} defaultValue={p.vacationDays} />
                    </label>
                    <label>
                      Sick days (dní / rok)
                      <input name="sickDays" type="number" min={0} max={30} defaultValue={p.sickDays} />
                    </label>
                  </ActionForm>
                </details>
              );
            })}
          </Panel>
        )}
      </div>
    </>
  );
}
