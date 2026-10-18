import type { AttendanceEvent, AttendanceKind } from '@prisma/client';

export const KIND_LABEL: Record<AttendanceKind, string> = {
  PRICHOD: 'Příchod',
  ODCHOD: 'Odchod',
  SLUZEBNI_CESTA: 'Služební cesta',
  LEKAR: 'Lékař',
  HOME_OFFICE: 'Home office',
};

export const STATUS_LABEL: Record<AttendanceKind, string> = {
  PRICHOD: 'V práci',
  ODCHOD: 'Mimo práci',
  SLUZEBNI_CESTA: 'Na služební cestě',
  LEKAR: 'U lékaře',
  HOME_OFFICE: 'Home office',
};

export const STATUS_TONE: Record<AttendanceKind, string> = {
  PRICHOD: 'ok',
  ODCHOD: '',
  SLUZEBNI_CESTA: 'acc',
  LEKAR: 'warn',
  HOME_OFFICE: 'ok',
};

/** Pracovní úseky (odpracováno) vs. lékař. Ostatní se počítá do práce. */
const WORKING: AttendanceKind[] = ['PRICHOD', 'SLUZEBNI_CESTA', 'HOME_OFFICE'];

const TZ = 'Europe/Prague';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const pragueDay = (d: Date) => dayFmt.format(d); // YYYY-MM-DD

export const fmtHM = (d: Date) => new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);

export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
export const hours = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;

type Ev = Pick<AttendanceEvent, 'kind' | 'at'>;

/**
 * Sečte čas podle dnů. Úsek začíná událostí a končí další událostí téhož dne
 * (nebo „teď“, pokud je to dnešek a úsek je otevřený; jinak se otevřený úsek zahodí).
 */
export function summarize(events: Ev[], now = new Date()) {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const byDay = new Map<string, { work: number; doctor: number; trip: number; home: number; first?: Date; last?: Date; open: boolean }>();
  const today = pragueDay(now);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const day = pragueDay(e.at);
    const d = byDay.get(day) ?? { work: 0, doctor: 0, trip: 0, home: 0, open: false };
    if (!d.first) d.first = e.at;
    d.last = e.at;
    const next = sorted[i + 1];
    const sameDayNext = next && pragueDay(next.at) === day ? next : undefined;
    if (e.kind !== 'ODCHOD') {
      const end = sameDayNext ? sameDayNext.at : day === today ? now : null;
      if (end) {
        const ms = end.getTime() - e.at.getTime();
        if (WORKING.includes(e.kind)) d.work += ms;
        if (e.kind === 'LEKAR') d.doctor += ms;
        if (e.kind === 'SLUZEBNI_CESTA') d.trip += ms;
        if (e.kind === 'HOME_OFFICE') d.home += ms;
      }
      d.open = !sameDayNext;
    } else d.open = false;
    byDay.set(day, d);
  }
  let work = 0;
  let doctor = 0;
  let days = 0;
  for (const d of byDay.values()) {
    work += d.work;
    doctor += d.doctor;
    if (d.work > 0) days++;
  }
  return { byDay, work, doctor, days };
}

export function currentStatus(events: Ev[], now = new Date()): { kind: AttendanceKind; since?: Date } {
  const today = pragueDay(now);
  const last = [...events].filter((e) => pragueDay(e.at) === today).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  if (!last) return { kind: 'ODCHOD' };
  return { kind: last.kind, since: last.at };
}

// --- pracovní dny a svátky ---

function easterSunday(y: number): Date {
  // Anonymní gregoriánský algoritmus
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const cache = new Map<number, Set<string>>();
export function czHolidays(y: number): Set<string> {
  if (cache.has(y)) return cache.get(y)!;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const fixed = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'].map((md) => `${y}-${md}`);
  const easter = easterSunday(y);
  const s = new Set([...fixed, iso(new Date(easter.getTime() - 2 * 86_400_000)), iso(new Date(easter.getTime() + 86_400_000))]);
  cache.set(y, s);
  return s;
}

/** Počet pracovních dnů (Po–Pá bez českých svátků) v intervalu včetně. Data jako UTC půlnoc. */
export function workingDays(from: Date, to: Date): number {
  let n = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (czHolidays(d.getUTCFullYear()).has(d.toISOString().slice(0, 10))) continue;
    n++;
  }
  return n;
}
