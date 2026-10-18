import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { hours, pragueDay, summarize, workingDays } from '@/lib/worktime';

export async function GET(req: Request) {
  const me = await getUser();
  if (!me?.active || me.role !== 'ADMIN') return NextResponse.json({ error: 'Jen pro administrátory' }, { status: 403 });
  const url = new URL(req.url);
  const m = url.searchParams.get('m') ?? pragueDay(new Date()).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return NextResponse.json({ error: 'Neplatný měsíc' }, { status: 400 });
  const [y, mo] = m.split('-').map(Number);
  const mFrom = new Date(Date.UTC(y, mo - 1, 1));
  const mTo = new Date(Date.UTC(y, mo, 0));
  const [people, events, leaves] = await Promise.all([
    prisma.profile.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.attendanceEvent.findMany({ where: { at: { gte: new Date(mFrom.getTime() - 2 * 3_600_000), lt: new Date(Date.UTC(y, mo, 1)) } } }),
    prisma.leaveRequest.findMany({ where: { status: 'APPROVED', from: { lte: mTo }, to: { gte: mFrom } } }),
  ]);
  const fund = workingDays(mFrom, mTo);
  const n = (v: number) => v.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
  const rows = [['Zaměstnanec', 'E-mail', 'Odpracované dny', 'Odpracováno (h)', 'Lékař (h)', 'Dovolená (dny)', 'Sick days', `Fond (dny, ${m})`]];
  for (const p of people) {
    const s = summarize(events.filter((e) => e.profileId === p.id));
    const mine = leaves.filter((l) => l.profileId === p.id);
    const inMonth = (l: (typeof mine)[number]) =>
      l.days === 0.5 ? 0.5 : workingDays(l.from < mFrom ? mFrom : l.from, l.to > mTo ? mTo : l.to);
    const vac = mine.filter((l) => l.type === 'DOVOLENA').reduce((a, l) => a + inMonth(l), 0);
    const sick = mine.filter((l) => l.type === 'SICK_DAY').reduce((a, l) => a + inMonth(l), 0);
    rows.push([displayName(p), p.email, String(s.days), n(hours(s.work)), n(hours(s.doctor)), n(vac), n(sick), String(fund)]);
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dochazka-${m}.csv"`,
    },
  });
}
