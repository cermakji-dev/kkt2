'use client';
import { useMemo, useState } from 'react';
import { ActionForm } from './forms';
import type { FormState } from '@/app/actions';

/** Formulář žádosti s živým výpočtem pracovních dnů (svátky dodá server). */
export function LeaveForm({
  action,
  holidays,
  remaining,
  sickRemaining,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  holidays: string[];
  remaining: number;
  sickRemaining: number;
}) {
  const [type, setType] = useState<'DOVOLENA' | 'SICK_DAY'>('DOVOLENA');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [half, setHalf] = useState(false);
  const hol = useMemo(() => new Set(holidays), [holidays]);
  const days = useMemo(() => {
    if (!from) return 0;
    const end = type === 'SICK_DAY' ? from : to || from;
    let n = 0;
    for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += 86_400_000) {
      const d = new Date(t);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      if (hol.has(d.toISOString().slice(0, 10))) continue;
      n++;
    }
    return half && n === 1 ? 0.5 : n;
  }, [from, to, type, half, hol]);
  const left = type === 'DOVOLENA' ? remaining : sickRemaining;

  return (
    <ActionForm action={action} submitLabel={type === 'DOVOLENA' ? 'Odeslat ke schválení' : 'Zaznamenat sick day'} successText="Odesláno" resetOnSuccess>
      <div className="seg wide" role="radiogroup" aria-label="Typ">
        <button type="button" role="radio" aria-checked={type === 'DOVOLENA'} className="ok" onClick={() => setType('DOVOLENA')}>
          Dovolená
        </button>
        <button type="button" role="radio" aria-checked={type === 'SICK_DAY'} className="ok" onClick={() => setType('SICK_DAY')}>
          Sick day
        </button>
      </div>
      <input type="hidden" name="type" value={type} />
      <label>
        {type === 'SICK_DAY' ? 'Den' : 'Od'}
        <input name="from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      {type === 'DOVOLENA' && (
        <label>
          Do
          <input name="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      )}
      {type === 'DOVOLENA' && (
        <label className="check">
          <input type="checkbox" name="half" checked={half} onChange={(e) => setHalf(e.target.checked)} /> Půlden (jen pro jeden den)
        </label>
      )}
      <label className="wide">
        Poznámka
        <input name="note" maxLength={500} placeholder="Nepovinné" />
      </label>
      <p className={'wide calc' + (days > left ? ' over' : '')}>
        {from ? (
          <>
            <b>{days.toLocaleString('cs-CZ')}</b> {days === 1 ? 'pracovní den' : days > 1 && days < 5 ? 'pracovní dny' : 'pracovních dní'} · po odečtení zbude{' '}
            <b>{(left - days).toLocaleString('cs-CZ')}</b>
          </>
        ) : (
          <>Zbývá {left.toLocaleString('cs-CZ')} dní. Víkendy a státní svátky se nepočítají.</>
        )}
      </p>
    </ActionForm>
  );
}
