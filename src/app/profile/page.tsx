import { redirect } from 'next/navigation';
import { displayName, getUser, initials, ROLE_LABEL } from '@/lib/auth';
import { ActionForm } from '@/components/forms';
import { changeMyPassword, updateMyProfile } from './actions';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const me = await getUser();
  if (!me) redirect('/login');
  return (
    <>
      <div className="head">
        <div className="who-row">
          <span className="avatar lg" aria-hidden="true">{initials(me)}</span>
          <div>
            <h1>{displayName(me)}</h1>
            <p className="muted">
              {me.email} · {ROLE_LABEL[me.role]}
            </p>
          </div>
        </div>
      </div>
      <div className="stack">
        <section className="panel">
          <header>
            <h2>Kontaktní údaje</h2>
          </header>
          <ActionForm action={updateMyProfile} submitLabel="Uložit">
            <label>
              Jméno a příjmení
              <input name="name" defaultValue={me.name ?? ''} maxLength={120} placeholder="Jak vás uvidí kolegové" />
            </label>
            <label>
              Telefon
              <input name="phone" type="tel" defaultValue={me.phone ?? ''} maxLength={40} placeholder="+420 …" />
            </label>
          </ActionForm>
        </section>
        <section className="panel">
          <header>
            <h2>Změna hesla</h2>
          </header>
          <ActionForm action={changeMyPassword} submitLabel="Změnit heslo" successText="Heslo změněno" resetOnSuccess>
            <label>
              Nové heslo
              <input name="password" type="password" minLength={8} required autoComplete="new-password" />
            </label>
            <label>
              Nové heslo znovu
              <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
            </label>
          </ActionForm>
        </section>
        <form action="/auth/signout" method="post">
          <button className="btn danger">Odhlásit se</button>
        </form>
      </div>
    </>
  );
}
