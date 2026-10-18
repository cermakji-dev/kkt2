import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { getTemplate, itemKey, reportStats, type ItemsMap } from '@/lib/templates';
import { C, Doc, fmtCz, H, M, pdfResponse, W } from '@/lib/pdf/doc';

export const runtime = 'nodejs';

const STATE = {
  OK: { label: 'V pořádku', fg: C.ok, bg: C.okSoft },
  DEFECT: { label: 'Závada', fg: C.bad, bg: C.badSoft },
  NA: { label: 'Nehodnoceno', fg: C.muted, bg: C.naSoft },
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.active) return NextResponse.json({ error: 'Nepřihlášený uživatel' }, { status: 401 });
  const { id } = await params;
  const r = await prisma.inspectionReport.findUnique({
    where: { id },
    include: {
      building: { include: { technician: true, referent: true } },
      inspector: true,
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!r) return new NextResponse('Nenalezeno', { status: 404 });
  const t = getTemplate(r.template);
  if (!t) return new NextResponse('Neznámá šablona', { status: 500 });
  const items = (r.items ?? {}) as ItemsMap;
  const st = reportStats(t, items);
  const draft = r.status === 'DRAFT';

  const title = `${t.label} – ${r.building.name} – ${fmtCz(r.date)}`;
  const d = await Doc.create(title, `iSYS · ${t.label} · ${r.building.name} · ${fmtCz(r.date)}${draft ? ' · KONCEPT' : ''}`);
  const contentW = W - 2 * M;

  // --- Hlavička ---
  d.rect(0, H - 8, W, 8, C.accent);
  d.y = H - M - 4;
  d.text('PROTOKOL O KONTROLE', M, d.y, 9, { font: d.bold, color: C.accent });
  if (draft) {
    const tx = 'KONCEPT – NEDOKONČENO';
    d.text(tx, W - M - d.bold.widthOfTextAtSize(tx, 9), d.y, 9, { font: d.bold, color: C.bad });
  }
  d.y -= 26;
  d.text(t.label, M, d.y, 22, { font: d.bold });
  d.y -= 20;
  d.text(r.building.name, M, d.y, 13, { font: d.bold, color: C.muted });
  d.y -= 15;
  d.text(r.building.address, M, d.y, 10.5, { color: C.muted });
  d.y -= 18;

  // --- Údaje ---
  const meta: [string, string][] = [
    ['Datum kontroly', fmtCz(r.date)],
    ['Další kontrola', fmtCz(r.nextDue)],
    ['Kontroloval', displayName(r.inspector)],
    ['Za SVJ / družstvo', r.svjName || '—'],
    ['Technik objektu', displayName(r.building.technician)],
    ['Výsledek', st.defects ? `${st.defects} ${st.defects === 1 ? 'závada' : st.defects < 5 ? 'závady' : 'závad'}` : 'Bez závad'],
  ];
  const colW = contentW / 3;
  const boxH = 2 * 34 + 12;
  d.rect(M, d.y - boxH, contentW, boxH, C.sunk);
  meta.forEach(([k, v], i) => {
    const cx = M + 12 + (i % 3) * colW;
    const cy = d.y - 18 - Math.floor(i / 3) * 34;
    d.text(k.toUpperCase(), cx, cy, 7.5, { font: d.bold, color: C.muted });
    d.text(v, cx, cy - 13, 11, { font: d.bold, color: k === 'Výsledek' && st.defects ? C.bad : C.ink });
  });
  d.y -= boxH + 22;

  // --- Sekce ---
  const stateW = 74;
  const labelW = 180;
  const noteX = M + labelW + stateW + 12;
  const noteW = W - M - noteX;
  t.sections.forEach((sec, si) => {
    d.need(46);
    d.text(`${si + 1}. ${sec.label.toUpperCase()}`, M, d.y, 10, { font: d.bold, color: C.accent });
    d.y -= 7;
    d.rule(C.accent, 1);
    for (const it of sec.items) {
      const v = items[itemKey(sec, it)] ?? {};
      const s = STATE[v.s ?? 'NA'];
      const noteLines = v.n?.trim() ? d.wrap(v.n.trim(), 9.5, noteW) : [];
      const labelLines = d.wrap(it.label, 10, labelW - 6, d.bold);
      const rowH = Math.max(22, 8 + Math.max(labelLines.length * 12.5, noteLines.length * 12.2) + 6);
      d.need(rowH);
      const top = d.y;
      labelLines.forEach((l, i) => d.text(l, M, top - 15 - i * 12.5, 10, { font: d.bold }));
      // stav jako štítek
      d.rect(M + labelW, top - 19, stateW, 15, s.bg);
      const sw = d.bold.widthOfTextAtSize(s.label, 8.5);
      d.text(s.label, M + labelW + (stateW - sw) / 2, top - 15, 8.5, { font: d.bold, color: s.fg });
      noteLines.forEach((l, i) => d.text(l, noteX, top - 15 - i * 12.2, 9.5, { color: C.ink }));
      d.y = top - rowH;
      d.page.drawLine({ start: { x: M, y: d.y + 2 }, end: { x: W - M, y: d.y + 2 }, thickness: 0.4, color: C.line });
    }
    d.y -= 16;
  });

  // --- Závěr ---
  if (r.summary?.trim()) {
    d.need(50);
    d.text('CELKOVÉ ZHODNOCENÍ', M, d.y, 10, { font: d.bold, color: C.accent });
    d.y -= 6;
    d.para(r.summary.trim(), { size: 10.5 });
    d.y -= 16;
  }

  // --- Fotodokumentace ---
  const photos = r.attachments.filter((a) => a.kind === 'PHOTO');
  if (photos.length) {
    const labels = new Map<string, string>();
    for (const s of t.sections) for (const i of s.items) labels.set(itemKey(s, i), `${s.label} – ${i.label}`);
    d.need(60);
    d.text('FOTODOKUMENTACE', M, d.y, 10, { font: d.bold, color: C.accent });
    d.y -= 14;
    const gap = 12;
    const pw = (contentW - gap) / 2;
    const ph = pw * 0.72;
    for (let i = 0; i < photos.length; i += 2) {
      d.need(ph + 26);
      const top = d.y;
      for (let j = 0; j < 2 && i + j < photos.length; j++) {
        const a = photos[i + j];
        const img = await d.image(new Uint8Array(a.data), a.mime);
        const x = M + j * (pw + gap);
        d.rect(x, top - ph, pw, ph, C.sunk);
        if (img) {
          const sc = Math.min(pw / img.width, ph / img.height);
          const iw = img.width * sc;
          const ih = img.height * sc;
          d.page.drawImage(img, { x: x + (pw - iw) / 2, y: top - ph + (ph - ih) / 2, width: iw, height: ih });
        }
        const cap = d.wrap(`${i + j + 1}. ${a.itemKey ? labels.get(a.itemKey) ?? '' : ''}`, 8.5, pw)[0] ?? '';
        d.text(cap, x, top - ph - 11, 8.5, { color: C.muted });
      }
      d.y = top - ph - 24;
    }
    d.y -= 6;
  }

  // --- Podpisy ---
  d.need(120);
  d.y -= 8;
  const sigs = [
    { label: 'Za správce – technik', name: displayName(r.inspector), att: r.attachments.find((a) => a.kind === 'SIGNATURE_TECH') },
    { label: 'Za SVJ / družstvo', name: r.svjName || '', att: r.attachments.find((a) => a.kind === 'SIGNATURE_SVJ') },
  ];
  const sw2 = (contentW - 30) / 2;
  const sigTop = d.y;
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    const x = M + i * (sw2 + 30);
    if (s.att) {
      const img = await d.image(new Uint8Array(s.att.data), s.att.mime);
      if (img) {
        const sc = Math.min(sw2 / img.width, 60 / img.height);
        d.page.drawImage(img, { x, y: sigTop - 66, width: img.width * sc, height: img.height * sc });
      }
    }
    d.page.drawLine({ start: { x, y: sigTop - 72 }, end: { x: x + sw2, y: sigTop - 72 }, thickness: 0.7, color: C.ink });
    d.text(s.label, x, sigTop - 85, 8.5, { font: d.bold, color: C.muted });
    if (s.name) d.text(s.name, x, sigTop - 97, 10);
  }
  d.y = sigTop - 110;
  if (r.finalizedAt) {
    d.text(`Protokol uzavřen ${fmtCz(r.finalizedAt)} v systému iSYS.`, M, d.y, 8, { color: C.muted });
  }

  const bytes = await d.save();
  const iso = r.date.toISOString().slice(0, 10);
  return pdfResponse(bytes, `Protokol ${r.building.name} ${iso}.pdf`);
}
