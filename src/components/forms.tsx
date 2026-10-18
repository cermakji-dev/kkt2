'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/app/actions';

export function Submit({ children, pending: pendingLabel = 'Ukládám…', className = 'btn pri' }: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Rozbalovací panel s formulářem; po úspěšném uložení se vyčistí a zavře. */
export function AddPanel({
  label,
  action,
  children,
  submitLabel,
  keepOpen = false,
}: {
  label: string;
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  keepOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (!keepOpen) setOpen(false);
    }
  }, [state.ok, keepOpen]);

  return (
    <>
      <button type="button" className={open ? 'btn sm ghost' : 'btn sm pri'} onClick={() => setOpen((o) => !o)}>
        {open ? 'Zavřít' : label}
      </button>
      {open && (
        <div className="drawer">
          <form ref={formRef} action={formAction} className="add">
            {children}
            {state.error && (
              <p className="err" role="alert">
                {state.error}
              </p>
            )}
            <div className="end">
              <Submit>{submitLabel}</Submit>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Tlačítko mazání: první klik se zeptá, druhý smaže. */
export function DeleteButton({ action, id, label = 'Smazat' }: { action: (fd: FormData) => Promise<void>; id: string; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      {armed ? (
        <Submit className="btn sm danger armed" pending="Mažu…">
          Opravdu smazat?
        </Submit>
      ) : (
        <button type="button" className="btn sm danger" onClick={() => setArmed(true)}>
          {label}
        </button>
      )}
    </form>
  );
}

/** Jedno tlačítko odesílající formulář s id (změna stavu, vrácení klíčů). */
export function ActButton({
  action,
  id,
  className,
  children,
  title,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  className: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <PendingButton className={className} title={title}>
        {children}
      </PendingButton>
    </form>
  );
}

function PendingButton({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} title={title} disabled={pending} aria-busy={pending}>
      {children}
    </button>
  );
}

/** Zapůjčení klíčů: tlačítko rozbalí malý formulář. */
export function LendForm({ action, id, today }: { action: (s: FormState, fd: FormData) => Promise<FormState>; id: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);
  if (!open)
    return (
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        Zapůjčit
      </button>
    );
  return (
    <form action={formAction} className="lend">
      <input type="hidden" name="id" value={id} />
      <input name="holder" required maxLength={80} placeholder="Komu" aria-label="Komu" autoFocus />
      <input name="date" type="date" defaultValue={today} required aria-label="Datum" />
      <Submit className="btn sm pri" pending="…">
        Zapsat
      </Submit>
      <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>
        Zrušit
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
