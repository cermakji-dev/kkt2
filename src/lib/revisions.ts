// Katalog pravidelných revizí a kontrol bytového domu s obvyklými zákonnými intervaly.
// Intervaly jsou orientační dle běžné praxe správců; u konkrétního zařízení může revizní
// technik stanovit kratší lhůtu (pak ji zapište do „Další termín“ ručně).
import { addMonths, daysUntil } from './format';

export type BuildingFlags = {
  hasElevator: boolean;
  hasGas: boolean;
  hasBoiler: boolean;
  hasChimney: boolean;
  hasHydrants: boolean;
};

export type RevisionType = {
  key: string;
  label: string;
  /** Interval v měsících */
  months: number;
  law: string;
  /** Jiné názvy, pod kterými se typ v evidenci objevuje */
  aliases?: string[];
  applies: (b: BuildingFlags) => boolean;
};

const always = () => true;

export const REVISIONS: RevisionType[] = [
  { key: 'elektro', label: 'Revize elektroinstalace', months: 60, law: 'NV 190/2022 Sb., ČSN 33 1500', applies: always },
  { key: 'hromosvod', label: 'Revize hromosvodu', months: 48, law: 'ČSN EN 62305-3', applies: always },
  { key: 'plyn', label: 'Revize plynu', months: 36, law: 'NV 191/2022 Sb.', aliases: ['Revize plynového zařízení'], applies: (b) => b.hasGas },
  { key: 'plyn_kontrola', label: 'Kontrola plynového zařízení', months: 12, law: 'NV 191/2022 Sb.', applies: (b) => b.hasGas },
  { key: 'kominy', label: 'Revize komínů', months: 12, law: 'NV 34/2016 Sb.', aliases: ['Kontrola spalinové cesty'], applies: (b) => b.hasChimney || b.hasGas || b.hasBoiler },
  { key: 'kotelna', label: 'Revize kotelny', months: 12, law: 'NV 191/2022 Sb., ČSN 07 0703', applies: (b) => b.hasBoiler },
  { key: 'php', label: 'Kontrola hasicích přístrojů', months: 12, law: 'vyhl. 246/2001 Sb.', applies: always },
  { key: 'hydranty', label: 'Kontrola požárních hydrantů', months: 12, law: 'vyhl. 246/2001 Sb., ČSN 73 0873', applies: (b) => b.hasHydrants },
  { key: 'pozdvere', label: 'Kontrola požárních dveří', months: 12, law: 'vyhl. 246/2001 Sb.', applies: always },
  { key: 'vytah', label: 'Kontrola výtahu', months: 3, law: 'ČSN 27 4002 (odborná prohlídka)', aliases: ['Odborná prohlídka výtahu'], applies: (b) => b.hasElevator },
  { key: 'vytah_zkouska', label: 'Odborná zkouška výtahu', months: 36, law: 'ČSN 27 4002', applies: (b) => b.hasElevator },
  { key: 'vytah_inspekce', label: 'Inspekční prohlídka výtahu', months: 72, law: 'ČSN 27 4007', applies: (b) => b.hasElevator },
  { key: 'rocni', label: 'Roční prohlídka objektu', months: 12, law: 'standard správce', applies: always },
];

export const INSPECTION_TYPE_NAMES = [...REVISIONS.map((r) => r.label), 'Jiná kontrola'];

export function revisionByName(name: string): RevisionType | undefined {
  const n = name.trim().toLowerCase();
  return REVISIONS.find((r) => r.label.toLowerCase() === n || r.aliases?.some((a) => a.toLowerCase() === n));
}

export function defaultNextDue(type: string, done: Date): Date | null {
  const r = revisionByName(type);
  return r ? addMonths(done, r.months) : null;
}

export type RevisionState = 'late' | 'soon' | 'ok' | 'missing' | 'na';

export type RevisionCell = {
  rev: RevisionType;
  state: RevisionState;
  last?: { inspectedAt: Date; nextDue: Date | null; result: string; id: string };
  nextDue: Date | null;
};

/** Stav všech revizí pro jeden dům (podle vybavení a evidence). */
export function revisionMatrix(
  b: BuildingFlags,
  inspections: { id: string; type: string; inspectedAt: Date; nextDue: Date | null; result: string }[],
): RevisionCell[] {
  return REVISIONS.map((rev) => {
    if (!rev.applies(b)) return { rev, state: 'na' as const, nextDue: null };
    const recs = inspections.filter((i) => revisionByName(i.type)?.key === rev.key).sort((x, y) => y.inspectedAt.getTime() - x.inspectedAt.getTime());
    const last = recs[0];
    if (!last) return { rev, state: 'missing' as const, nextDue: null };
    const nextDue = last.nextDue ?? addMonths(last.inspectedAt, rev.months);
    const d = daysUntil(nextDue);
    return { rev, last, nextDue, state: d < 0 ? 'late' : d <= 30 ? 'soon' : 'ok' };
  });
}

export const STATE_META: Record<RevisionState, { label: string; tone: string }> = {
  late: { label: 'Po termínu', tone: 'bad' },
  soon: { label: 'Do 30 dní', tone: 'warn' },
  ok: { label: 'V pořádku', tone: 'ok' },
  missing: { label: 'Chybí záznam', tone: 'miss' },
  na: { label: 'Netýká se', tone: '' },
};
