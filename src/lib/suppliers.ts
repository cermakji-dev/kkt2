import { daysUntil } from './format';

export const SUPPLIER_CATEGORIES: Record<string, string> = {
  VYTAHY: 'Výtahy',
  TOPENI: 'Topení a plyn',
  VODA: 'Voda a kanalizace',
  ELEKTRO: 'Elektro',
  REVIZE: 'Revizní technici',
  KOMINY: 'Kominictví',
  STRECHY: 'Střechy a klempířství',
  UKLID: 'Úklid',
  ZAMECNIK: 'Zámečnictví',
  DERATIZACE: 'Deratizace',
  ZELEN: 'Zeleň',
  STAVBA: 'Stavební práce',
  JINE: 'Ostatní',
};

export type ContractState = { label: string; tone: string; noticeBy: Date | null };

/** Stav smlouvy: kdy nejpozději podat výpověď, jestli končí, nebo už skončila. */
export function contractState(c: { validTo: Date | null; noticeDays: number | null; autoRenew: boolean }): ContractState {
  if (!c.validTo) return { label: 'Na dobu neurčitou', tone: 'ok', noticeBy: null };
  const noticeBy = c.noticeDays ? new Date(c.validTo.getTime() - c.noticeDays * 86_400_000) : c.validTo;
  const dEnd = daysUntil(c.validTo);
  const dNotice = daysUntil(noticeBy);
  if (dEnd < 0) return { label: c.autoRenew ? 'Automaticky prodloužena' : 'Vypršela', tone: c.autoRenew ? '' : 'bad', noticeBy };
  if (dNotice < 0) return { label: c.autoRenew ? 'Po výpovědní lhůtě – prodlouží se' : `Končí za ${dEnd} d`, tone: 'warn', noticeBy };
  if (dNotice <= 60) return { label: `Výpověď do ${dNotice} d`, tone: 'warn', noticeBy };
  return { label: 'Platná', tone: 'ok', noticeBy };
}
