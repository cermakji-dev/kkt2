const DAY = 86_400_000;

/** Půlnoc dnešního dne v Praze, aby se termíny nepřehoupávaly kvůli UTC. */
export function startOfToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(parts + 'T00:00:00Z');
}

function dayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Kolik dní zbývá do data (záporné = po termínu). */
export function daysUntil(d: Date): number {
  return Math.round((dayOnly(d).getTime() - startOfToday().getTime()) / DAY);
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

export function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function longToday(): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export const TASK_STATUS = {
  OPEN: { label: 'Otevřený', tone: 'acc' },
  IN_PROGRESS: { label: 'Rozpracovaný', tone: 'warn' },
  DONE: { label: 'Hotovo', tone: 'ok' },
} as const;

export const NEXT_STATUS = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'OPEN' } as const;

export const INSPECTION_TYPES = [
  'Roční prohlídka objektu',
  'Revize elektroinstalace',
  'Revize hromosvodu',
  'Kontrola hasicích přístrojů',
  'Revize plynu',
  'Kontrola výtahu',
  'Revize komínů',
  'Kontrola požárních dveří',
  'Jiná kontrola',
] as const;

export function dueTone(next: Date | null): { label: string; tone: string } {
  if (!next) return { label: 'Bez termínu', tone: '' };
  const d = daysUntil(next);
  if (d < 0) return { label: `Po termínu ${-d} d`, tone: 'bad' };
  if (d === 0) return { label: 'Dnes', tone: 'bad' };
  if (d <= 30) return { label: `Za ${d} d`, tone: 'warn' };
  return { label: fmtDate(next), tone: 'ok' };
}

/** Poslední kontrola každého druhu v každém objektu. */
export function latestPerType<T extends { buildingId: string; type: string; inspectedAt: Date }>(items: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of items) {
    const k = x.buildingId + '|' + x.type;
    const prev = m.get(k);
    if (!prev || x.inspectedAt > prev.inspectedAt) m.set(k, x);
  }
  return [...m.values()];
}

export function isOverdue(t: { status: string; dueAt: Date | null }): boolean {
  return t.status !== 'DONE' && !!t.dueAt && daysUntil(t.dueAt) < 0;
}

export function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + m);
  return r;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** „před 3 h“, „včera“, „před 5 dny“ */
export function ago(d: Date): string {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `před ${h} h`;
  const dd = Math.round(h / 24);
  return dd === 1 ? 'včera' : `před ${dd} dny`;
}
