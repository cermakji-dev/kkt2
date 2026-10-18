'use client';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="loginform">
      <input type="hidden" name="next" value={next ?? ''} />
      <label>
        E-mail
        <input type="email" name="email" autoComplete="email" required autoFocus />
      </label>
      <label>
        Heslo
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <button className="btn pri" disabled={pending}>
        {pending ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
      {state.error && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
