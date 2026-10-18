import type { TicketChannel, TicketStatus, TicketUrgency } from '@prisma/client';

export const URGENCY: Record<TicketUrgency, { label: string; tone: string; hours: number; hint: string }> = {
  HAVARIE: { label: 'Havárie', tone: 'bad', hours: 24, hint: 'Ohrožení osob či majetku, únik vody, plynu, výpadek' },
  VYSOKA: { label: 'Vysoká', tone: 'warn', hours: 72, hint: 'Omezuje provoz domu' },
  BEZNA: { label: 'Běžná', tone: '', hours: 14 * 24, hint: 'Drobná závada' },
};

export const STATUS: Record<TicketStatus, { label: string; tone: string; open: boolean }> = {
  NOVE: { label: 'Nové', tone: 'acc', open: true },
  PRIJATO: { label: 'Přijato', tone: '', open: true },
  PREDANO: { label: 'Předáno firmě', tone: 'warn', open: true },
  RESI_SE: { label: 'Řeší se', tone: 'warn', open: true },
  VYRESENO: { label: 'Vyřešeno', tone: 'ok', open: false },
  ZAMITNUTO: { label: 'Zamítnuto', tone: '', open: false },
};

export const OPEN_STATUSES: TicketStatus[] = ['NOVE', 'PRIJATO', 'PREDANO', 'RESI_SE'];

export const CATEGORIES: Record<string, string> = {
  VODA: 'Voda a kanalizace',
  TOPENI: 'Topení a teplá voda',
  ELEKTRO: 'Elektro a osvětlení',
  VYTAH: 'Výtah',
  STRECHA: 'Střecha a fasáda',
  SPOLECNE: 'Společné prostory',
  ZAMKY: 'Zámky, dveře, zvonky',
  UKLID: 'Úklid a odpad',
  ZELEN: 'Zeleň a okolí',
  JINE: 'Jiné',
};

export const CHANNEL: Record<TicketChannel, string> = {
  TELEFON: 'Telefon',
  EMAIL: 'E-mail',
  OSOBNE: 'Osobně',
  KONTROLA: 'Zjištěno při kontrole',
  JINE: 'Jinak',
};

/** Zbývající čas do lhůty jako text a barva. */
export function slaLabel(dueAt: Date | null, open: boolean): { text: string; tone: string } {
  if (!dueAt || !open) return { text: '', tone: '' };
  const ms = dueAt.getTime() - Date.now();
  const h = Math.round(ms / 3_600_000);
  if (ms < 0) {
    const late = -h;
    return { text: late < 48 ? `po lhůtě ${late} h` : `po lhůtě ${Math.round(late / 24)} d`, tone: 'bad' };
  }
  if (h < 48) return { text: `zbývá ${h} h`, tone: h < 12 ? 'bad' : 'warn' };
  return { text: `zbývá ${Math.round(h / 24)} d`, tone: '' };
}

export const ticketNo = (n: number) => `#${n}`;
