// Testovací data pro Playwright v CI. Vymyšlená, relativně k dnešku.
import { PrismaClient } from '@prisma/client';
import data from '../prisma/seed-data.json';
import sbd from '../prisma/sbd-data.json';

const prisma = new PrismaClient();
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const day = (n: number) => new Date(today.getTime() + n * 86_400_000);
const at = (n: number, h: number, m = 0) => new Date(today.getTime() + n * 86_400_000 + (h - 2) * 3_600_000 + m * 60_000);

async function main() {
  await prisma.profile.createMany({
    data: [
      { id: 'e2e-admin', email: 'admin@ukazka.cz', name: 'Jana Testová', role: 'ADMIN', phone: '+420 600 000 000' },
      { id: 'demo-svoboda', email: 'petr.svoboda@ukazka.cz', name: 'Petr Svoboda', role: 'TECHNIK', phone: '+420 601 111 222' },
      { id: 'demo-kralova', email: 'lucie.kralova@ukazka.cz', name: 'Lucie Králová', role: 'TECHNIK', phone: '+420 602 333 444' },
      { id: 'demo-benes', email: 'tomas.benes@ukazka.cz', name: 'Tomáš Beneš', role: 'REFERENT', phone: '+420 603 555 666' },
      { id: 'demo-markova', email: 'eva.markova@ukazka.cz', name: 'Eva Marková', role: 'REFERENT', phone: '+420 604 777 888' },
    ],
  });
  const tech = ['e2e-admin', 'e2e-admin', 'e2e-admin', 'demo-svoboda', 'demo-svoboda', 'demo-kralova', 'demo-kralova', null];
  const ref = ['demo-benes', 'demo-benes', 'demo-markova', 'demo-markova', null, 'demo-benes', 'demo-markova', 'demo-benes'];
  await prisma.building.createMany({
    data: data.buildings.map((b, i) => ({ ...b, technicianId: tech[i], referentId: ref[i] })),
  });
  const techOf = new Map(data.buildings.map((b, i) => [b.id, tech[i]]));
  const prio = ['HIGH', 'MEDIUM', 'NONE', 'LOW'] as const;
  await prisma.task.createMany({
    data: data.tasks.map((t, i) => ({
      id: `t${i}`,
      buildingId: t.b,
      title: t.title,
      status: t.status as 'OPEN' | 'IN_PROGRESS' | 'DONE',
      dueAt: t.due == null ? null : day(t.due),
      completedAt: t.status === 'DONE' ? day((t.due ?? 0) as number) : null,
      notes: 'notes' in t ? (t.notes as string) : null,
      assigneeId: techOf.get(t.b) ?? null,
      priority: prio[i % 4],
    })),
  });
  await prisma.task.createMany({
    data: [
      { id: 'sub1', parentId: 't2', title: 'Poptat Topení Novák', status: 'DONE', buildingId: 'bd-lipova14', assigneeId: 'e2e-admin' },
      { id: 'sub2', parentId: 't2', title: 'Srovnat nabídky pro výbor', buildingId: 'bd-lipova14', assigneeId: 'e2e-admin' },
      { id: 'tp', title: 'Objednat nové razítko pro kancelář', assigneeId: 'e2e-admin', dueAt: day(0) },
    ],
  });
  await prisma.taskComment.createMany({
    data: [
      { taskId: 't2', authorId: 'demo-benes', body: 'Výbor SVJ zasedá příští týden, do té doby to chce mít srovnané.' },
      { taskId: 't2', authorId: 'e2e-admin', body: 'Dvě nabídky mám, třetí firma se ozve v pondělí.' },
    ],
  });
  await prisma.keySet.createMany({
    data: data.keys.map((k, i) => ({ id: `k${i}`, buildingId: k.b, code: k.code, description: k.description, count: k.code.endsWith('-A') ? 2 : 1 })),
  });
  const lent = data.keys.map((k, i) => ({ k, i })).filter(({ k }) => 'holder' in k);
  for (const { k, i } of lent) {
    const kk = k as { holder: string; lent: number };
    await prisma.keyLoan.create({
      data: { id: `loan${i}`, keySetId: `k${i}`, holder: kk.holder, holderCompany: kk.holder, purpose: 'Servis', borrowedAt: at(kk.lent, 8), expectedReturn: day(kk.lent + 5), issuedById: 'e2e-admin' },
    });
    await prisma.keySet.update({ where: { id: `k${i}` }, data: { holder: kk.holder, borrowedAt: at(kk.lent, 8) } });
  }
  await prisma.keyLoan.create({
    data: { keySetId: 'k0', holder: 'Martin Říha', holderCompany: 'Odečty Praha s.r.o.', purpose: 'Odečet vodoměrů', borrowedAt: at(-9, 8), returnedAt: at(-9, 15), issuedById: 'e2e-admin', returnedToId: 'e2e-admin' },
  });
  await prisma.inspection.createMany({
    data: data.inspections.map((x) => ({
      buildingId: x.b,
      type: x.type,
      inspectedAt: day(x.done),
      nextDue: x.next == null ? null : day(x.next),
      result: x.result as 'OK' | 'DEFECT',
      notes: 'notes' in x ? (x.notes as string) : null,
    })),
  });
  await prisma.inspectionReport.create({
    data: {
      id: 'rep-final',
      buildingId: 'bd-lipova14',
      template: 'rocni',
      status: 'FINAL',
      date: day(-9),
      nextDue: day(356),
      inspectorId: 'e2e-admin',
      svjName: 'p. Horák',
      summary: 'Objekt v dobrém stavu.',
      finalizedAt: day(-9),
      items: { 'strecha.krytina': { s: 'OK' }, 'strecha.klempir': { s: 'DEFECT', n: 'Uvolněný svod u vchodu B.' }, 'fasada.plast': { s: 'OK' }, 'technika.vytah': { s: 'NA', n: 'Bez výtahu.' } },
    },
  });
  await prisma.inspectionReport.create({
    data: { id: 'rep-draft', buildingId: 'bd-korunni88', template: 'rocni', date: day(0), nextDue: day(365), inspectorId: 'e2e-admin', items: { 'strecha.krytina': { s: 'OK' } } },
  });
  // docházka: posledních 10 pracovních dnů
  const events: { profileId: string; kind: 'PRICHOD' | 'ODCHOD' | 'LEKAR' | 'HOME_OFFICE' | 'SLUZEBNI_CESTA'; at: Date }[] = [];
  for (let n = -14; n < 0; n++) {
    const wd = day(n).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const p of ['e2e-admin', 'demo-svoboda', 'demo-benes', 'demo-markova']) {
      events.push({ profileId: p, kind: 'PRICHOD', at: at(n, 7, 30) });
      if (p === 'demo-svoboda' && n % 3 === 0) events.push({ profileId: p, kind: 'SLUZEBNI_CESTA', at: at(n, 11) }, { profileId: p, kind: 'PRICHOD', at: at(n, 13) });
      events.push({ profileId: p, kind: 'ODCHOD', at: at(n, 15, 45) });
    }
  }
  await prisma.attendanceEvent.createMany({ data: events });
  await prisma.leaveRequest.createMany({
    data: [
      { profileId: 'demo-svoboda', type: 'DOVOLENA', from: day(7), to: day(11), days: 5, status: 'PENDING', note: 'Hory' },
      { profileId: 'demo-benes', type: 'DOVOLENA', from: day(14), to: day(15), days: 2, status: 'APPROVED', approverId: 'e2e-admin', decidedAt: day(-1) },
      { profileId: 'e2e-admin', type: 'DOVOLENA', from: day(-30), to: day(-28), days: 3, status: 'APPROVED', approverId: 'e2e-admin', decidedAt: day(-40) },
    ],
  });
  // SBD: údaje domů, kontakty, jednotky, měřidla, dodavatelé, smlouvy, závady
  for (const [id, info] of Object.entries(sbd.buildings)) await prisma.building.update({ where: { id }, data: info as never });
  await prisma.buildingContact.createMany({ data: sbd.contacts as never });
  await prisma.unit.createMany({ data: sbd.units as never });
  await prisma.meter.createMany({ data: sbd.meters.map((m) => ({ ...m, verifiedUntil: m.verifiedUntil ? new Date(m.verifiedUntil) : null })) as never });
  await prisma.meterReading.createMany({ data: sbd.readings.map((r) => ({ ...r, date: new Date(r.date) })) });
  await prisma.supplier.createMany({ data: sbd.suppliers as never });
  await prisma.contract.createMany({
    data: sbd.contracts.map((c) => ({ ...c, validFrom: c.validFrom ? new Date(c.validFrom) : null, validTo: c.validTo ? new Date(c.validTo) : null })) as never,
  });
  const H = 3_600_000;
  const URG_H: Record<string, number> = { HAVARIE: 24, VYSOKA: 72, BEZNA: 336 };
  for (const t of sbd.tickets as (Record<string, unknown> & { id: string; hoursAgo: number; resolvedHours?: number; urgency: string; buildingId: string; supplierId?: string | null })[]) {
    const { hoursAgo, resolvedHours, ...rest } = t;
    const createdAt = new Date(Date.now() - hoursAgo * H);
    await prisma.ticket.create({
      data: {
        ...(rest as never),
        assigneeId: techOf.get(t.buildingId) ?? null,
        createdAt,
        dueAt: new Date(createdAt.getTime() + URG_H[t.urgency] * H),
        resolvedAt: resolvedHours != null ? new Date(Date.now() - resolvedHours * H) : null,
        events: {
          create: [
            { kind: 'STATUS', body: 'Hlášení přijato do systému', createdAt },
            ...(t.supplierId ? [{ kind: 'STATUS', body: 'Předáno dodavateli', createdAt: new Date(createdAt.getTime() + 20 * 60_000) }] : []),
            ...(t.id === 'tk1' ? [{ kind: 'COMMENT', body: 'Instalatér dorazí do hodiny, stoupačka zavřena.', authorId: 'e2e-admin' }] : []),
          ],
        },
      },
    });
  }
  await prisma.$executeRawUnsafe(`SELECT setval('"Ticket_number_seq"', 1010)`);
  console.log('E2E seed hotov');
}

main().finally(() => prisma.$disconnect());
