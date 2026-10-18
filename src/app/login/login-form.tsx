'use client';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next ?? ''} />
      <input aria-label="E-mail" type="email" name="email" placeholder="E-mail" autoComplete="email" required />
      <input aria-label="Heslo" type="password" name="password" placeholder="Heslo" autoComplete="current-password" required />
      <button disabled={pending}>{pending ? 'Přihlašuji…' : 'Přihlásit se'}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
