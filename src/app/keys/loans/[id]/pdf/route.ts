import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { C, Doc, fmtCz, H, M, pdfResponse, W } from '@/lib/pdf/doc';

export const runtime = 'nodejs';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }).format(d);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.active) return NextResponse.json({ error: 'Nepřihlášený uživatel' }, { status: 401 });
  const { id } = await params;
  const l = await prisma.keyLoan.findUnique({
    where: { id },
    include: {
      keySet: { include: { building: { include: { technician: true } } } },
      issuedBy: true,
      returnedTo: true,
      attachments: true,
    },
  });
  if (!l) return new NextResponse('Nenalezeno', { status: 404 });
  const b = l.keySet.building;
  const no = `${l.keySet.code}/${l.borrowedAt.toISOString().slice(0, 10).replace(/-/g, '')}`;

  const d = await Doc.create(`Předávací protokol ${no}`, `iSYS · Předávací protokol klíčů ${no}`);
  const cw = W - 2 * M;

  d.rect(0, H - 8, W, 8, C.accent);
  d.y = H - M - 4;
  d.text('PŘEDÁVACÍ PROTOKOL', M, d.y, 9, { font: d.bold, color: C.accent });
  const nt = `č. ${no}`;
  d.text(nt, W - M - d.font.widthOfTextAtSize(nt, 9), d.y, 9, { color: C.muted });
  d.y -= 26;
  d.text('Předání klíčů od objektu', M, d.y, 22, { font: d.bold });
  d.y -= 20;
  d.text(b.name, M, d.y, 13, { font: d.bold, color: C.muted });
  d.y -= 15;
  d.text(b.address, M, d.y, 10.5, { color: C.muted });
  d.y -= 26;

  const block = (title: string, rows: [string, string][]) => {
    d.need(30 + rows.length * 18);
    d.text(title.toUpperCase(), M, d.y, 10, { font: d.bold, color: C.accent });
    d.y -= 7;
    d.rule(C.accent, 1);
    for (const [k, v] of rows) {
      const lines = d.wrap(v || '—', 10.5, cw - 160);
      d.need(lines.length * 14 + 6);
      d.y -= 15;
      d.text(k, M, d.y, 9.5, { color: C.muted });
      lines.forEach((ln, i) => d.text(ln, M + 160, d.y - i * 14, 10.5, { font: i === 0 ? d.bold : d.font }));
      d.y -= (lines.length - 1) * 14 + 4;
      d.page.drawLine({ start: { x: M, y: d.y }, end: { x: W - M, y: d.y }, thickness: 0.4, color: C.line });
    }
    d.y -= 18;
  };

  block('Klíče', [
    ['Kód svazku', l.keySet.code],
    ['Popis', l.keySet.description ?? ''],
    ['Počet kusů', l.keySet.count ? String(l.keySet.count) : ''],
  ]);
  block('Přebírající', [
    ['Jméno', l.holder],
    ['Firma', l.holderCompany ?? ''],
    ['Telefon', l.holderPhone ?? ''],
    ['Účel zapůjčení', l.purpose ?? ''],
  ]);
  block('Výpůjčka', [
    ['Předáno', `${fmtCz(l.borrowedAt)} ${fmtTime(l.borrowedAt)}`],
    ['Předal', displayName(l.issuedBy)],
    ['Vrátit do', fmtCz(l.expectedReturn)],
    ['Vráceno', l.returnedAt ? `${fmtCz(l.returnedAt)} ${fmtTime(l.returnedAt)} (převzal ${displayName(l.returnedTo)})` : 'Dosud nevráceno'],
    ...(l.note ? ([['Poznámka', l.note]] as [string, string][]) : []),
  ]);

  d.need(70);
  d.para(
    'Přebírající potvrzuje převzetí výše uvedených klíčů. Zavazuje se je chránit před ztrátou a zneužitím, nepořizovat kopie a vrátit je v dohodnutém termínu. Ztrátu klíčů neprodleně ohlásí správci objektu.',
    { size: 9.5, color: C.muted },
  );
  d.y -= 24;

  d.need(110);
  const sw = (cw - 30) / 2;
  const top = d.y;
  const sigs = [
    { label: 'Předal (za správce)', name: displayName(l.issuedBy), att: l.attachments.find((a) => a.kind === 'SIGNATURE_ISSUER') },
    { label: 'Převzal', name: l.holder, att: l.attachments.find((a) => a.kind === 'SIGNATURE_HOLDER') },
  ];
  for (let i = 0; i < 2; i++) {
    const s = sigs[i];
    const x = M + i * (sw + 30);
    if (s.att) {
      const img = await d.image(new Uint8Array(s.att.data), s.att.mime);
      if (img) {
        const sc = Math.min(sw / img.width, 60 / img.height);
        d.page.drawImage(img, { x, y: top - 66, width: img.width * sc, height: img.height * sc });
      }
    }
    d.page.drawLine({ start: { x, y: top - 72 }, end: { x: x + sw, y: top - 72 }, thickness: 0.7, color: C.ink });
    d.text(s.label, x, top - 85, 8.5, { font: d.bold, color: C.muted });
    d.text(s.name, x, top - 97, 10);
  }

  const bytes = await d.save();
  return pdfResponse(bytes, `Predavaci protokol ${l.keySet.code} ${l.borrowedAt.toISOString().slice(0, 10)}.pdf`);
}
