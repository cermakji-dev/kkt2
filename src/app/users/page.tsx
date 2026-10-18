import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { displayName, getUser, initials, ROLE_LABEL } from '@/lib/auth';
import { Panel, Pill } from '@/components/ui';
import { ActionForm, AddPanel } from '@/components/forms';
import { createUser, setPassword, updateUser } from './actions';

export const dynamic = 'force-dynamic';

const ROLE_TONE = { ADMIN: 'acc', TECHNIK: 'ok', REFERENT: 'warn' } as const;

export default async function Users() {
  const me = await getUser();
  if (!me || me.role !== 'ADMIN') notFound();
  const users = await prisma.profile.findMany({
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { technicianBuildings: true, referentBuildings: true, tasks: { where: { status: { not: 'DONE' } } } } } },
  });
  const hasKey = !!process.env.SUPABASE_SECRET_KEY;

  return (
    <>
      <div className="head">
        <div>
          <h1>Uživatelé</h1>
          <p className="muted">Účty, role a kontakty. Technik a referent se přiřazují v detailu objektu.</p>
        </div>
      </div>
      {!hasKey && (
        <div className="banner">
          Pro zakládání účtů a změnu hesel doplňte ve Vercelu proměnnou <code>SUPABASE_SECRET_KEY</code> (Supabase → Project Settings → API Keys → Secret key).
        </div>
      )}
      <Panel
        title="Lidé"
        count={users.length}
        action={
          <AddPanel label="Nový uživatel" submitLabel="Založit účet" action={createUser}>
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label>
              Jméno
              <input name="name" maxLength={120} placeholder="Jméno Příjmení" />
            </label>
            <label>
              Role
              <select name="role" defaultValue="TECHNIK">
                <option value="TECHNIK">Technik</option>
                <option value="REFERENT">Referent</option>
                <option value="ADMIN">Administrátor</option>
              </select>
            </label>
            <label>
              Počáteční heslo
              <input name="password" type="text" minLength={8} required autoComplete="off" placeholder="aspoň 8 znaků" />
            </label>
          </AddPanel>
        }
      >
        {users.map((u) => {
          const demo = u.id.startsWith('demo-');
          const objs = u._count.technicianBuildings + u._count.referentBuildings;
          return (
            <details key={u.id} className={'person' + (u.active ? '' : ' inactive')}>
              <summary className="row">
                <div className="main who-row">
                  <span className="avatar" aria-hidden="true">{initials(u)}</span>
                  <div className="main">
                    <div className="t">
                      {displayName(u)} {u.id === me.id && <span className="muted small">(vy)</span>}
                    </div>
                    <div className="s">
                      <span>{u.email}</span>
                      {u.phone && <span>{u.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="acts">
                  {!u.active && <Pill tone="bad">Deaktivován</Pill>}
                  {demo && <Pill>Ukázka</Pill>}
                  <Pill tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Pill>
                  <span className="mono due">{objs} obj. · {u._count.tasks} úk.</span>
                </div>
              </summary>
              <div className="person-edit">
                <ActionForm action={updateUser} submitLabel="Uložit změny">
                  <input type="hidden" name="id" value={u.id} />
                  <label>
                    Jméno
                    <input name="name" defaultValue={u.name ?? ''} maxLength={120} />
                  </label>
                  <label>
                    Telefon
                    <input name="phone" type="tel" defaultValue={u.phone ?? ''} maxLength={40} />
                  </label>
                  <label>
                    Role
                    <select name="role" defaultValue={u.role}>
                      <option value="TECHNIK">Technik</option>
                      <option value="REFERENT">Referent</option>
                      <option value="ADMIN">Administrátor</option>
                    </select>
                  </label>
                  <label className="check">
                    <input type="checkbox" name="active" defaultChecked={u.active} /> Aktivní účet
                  </label>
                </ActionForm>
                {!demo && (
                  <ActionForm action={setPassword} submitLabel="Nastavit heslo" successText="Heslo změněno" resetOnSuccess>
                    <input type="hidden" name="id" value={u.id} />
                    <label className="wide">
                      Nové heslo
                      <input name="password" type="text" minLength={8} required autoComplete="off" placeholder="aspoň 8 znaků" />
                    </label>
                  </ActionForm>
                )}
              </div>
            </details>
          );
        })}
      </Panel>
    </>
  );
}
