'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemsMap, ItemState, Template } from '@/lib/templates';
import { itemKey, reportStats } from '@/lib/templates';
import {
  deleteAttachment,
  finalizeReport,
  saveReport,
  uploadAttachment,
  type ReportPayload,
} from '@/app/inspections/reports/actions';

export type Att = { id: string; kind: string; itemKey: string | null };

type Props = {
  reportId: string;
  template: Template;
  initial: { items: ItemsMap; summary: string; svjName: string; date: string; nextDue: string };
  attachments: Att[];
};

const STATES: { v: ItemState; label: string; cls: string }[] = [
  { v: 'OK', label: 'V pořádku', cls: 'ok' },
  { v: 'DEFECT', label: 'Závada', cls: 'bad' },
  { v: 'NA', label: 'Nehodnoceno', cls: 'na' },
];

/** Zmenší fotku v prohlížeči (max. 1600 px, JPEG), ať se nahrává rychle i přes mobilní data. */
async function compress(file: File, max = 1600, quality = 0.78): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
}

export default function ReportEditor({ reportId, template, initial, attachments }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ItemsMap>(initial.items);
  const [summary, setSummary] = useState(initial.summary);
  const [svjName, setSvjName] = useState(initial.svjName);
  const [date, setDate] = useState(initial.date);
  const [nextDue, setNextDue] = useState(initial.nextDue);
  const [atts, setAtts] = useState<Att[]>(attachments);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, startFinish] = useTransition();
  const [open, setOpen] = useState<string>(() => {
    // Otevřít první sekci, která není hotová.
    const s = template.sections.find((sec) => sec.items.some((i) => !initial.items[itemKey(sec, i)]?.s));
    return s?.key ?? template.sections[0].key;
  });

  const payload = useMemo<ReportPayload>(
    () => ({ items, summary: summary || null, svjName: svjName || null, date, nextDue: nextDue || null }),
    [items, summary, svjName, date, nextDue],
  );
  const first = useRef(true);
  const latest = useRef(payload);
  latest.current = payload;

  const flush = useCallback(async () => {
    setSaveState('saving');
    try {
      await saveReport(reportId, latest.current);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [reportId]);

  // Automatické ukládání 700 ms po poslední změně.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState('dirty');
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [payload, flush]);

  // Neztratit rozepsané při zavření stránky.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saveState]);

  const st = reportStats(template, items);
  const pct = Math.round((st.filled / st.total) * 100);

  function setItem(key: string, patch: Partial<ItemsMap[string]>) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }
  function sectionAllOk(secKey: string) {
    const sec = template.sections.find((s) => s.key === secKey)!;
    setItems((prev) => {
      const next = { ...prev };
      for (const i of sec.items) {
        const k = itemKey(sec, i);
        if (!next[k]?.s) next[k] = { ...next[k], s: 'OK' };
      }
      return next;
    });
    const idx = template.sections.findIndex((s) => s.key === secKey);
    const nextSec = template.sections[idx + 1];
    if (nextSec) setOpen(nextSec.key);
  }

  async function addPhoto(key: string, files: FileList | null) {
    if (!files?.length) return;
    setBusyItem(key);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const blob = await compress(f);
        const fd = new FormData();
        fd.set('reportId', reportId);
        fd.set('kind', 'PHOTO');
        fd.set('itemKey', key);
        fd.set('file', blob, 'foto.jpg');
        const r = await uploadAttachment(fd);
        if ('error' in r) {
          setError(r.error);
          break;
        }
        setAtts((a) => [...a, { id: r.id, kind: 'PHOTO', itemKey: key }]);
      }
    } catch {
      setError('Fotku se nepodařilo nahrát. Zkuste to znovu.');
    } finally {
      setBusyItem(null);
    }
  }

  async function removePhoto(id: string) {
    setAtts((a) => a.filter((x) => x.id !== id));
    await deleteAttachment(id).catch(() => setError('Fotku se nepodařilo smazat.'));
  }

  function finish() {
    setError(null);
    startFinish(async () => {
      await flush();
      const r = await finalizeReport(reportId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const sigTech = atts.find((a) => a.kind === 'SIGNATURE_TECH');
  const sigSvj = atts.find((a) => a.kind === 'SIGNATURE_SVJ');
  const defectsWithTask = template.sections.reduce(
    (n, s) => n + s.items.filter((i) => items[itemKey(s, i)]?.s === 'DEFECT' && items[itemKey(s, i)]?.task !== false).length,
    0,
  );

  return (
    <div className="rep">
      <div className="rep-progress" role="status">
        <div className="rep-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="rep-meta">
          <span>
            <b>{st.filled}</b>/{st.total} položek
          </span>
          {st.defects > 0 && <span className="bad">{st.defects} závad</span>}
          <span className={'save ' + saveState}>
            {saveState === 'saving' || saveState === 'dirty'
              ? 'Ukládám…'
              : saveState === 'error'
                ? 'Neuloženo, zkouším znovu při další změně'
                : saveState === 'saved'
                  ? '✓ Uloženo'
                  : ''}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="rep-basic">
          <label>
            Datum kontroly
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Další kontrola
            <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          </label>
          <label>
            Za SVJ / družstvo
            <input value={svjName} onChange={(e) => setSvjName(e.target.value)} maxLength={120} placeholder="Jméno zástupce" />
          </label>
        </div>
      </section>

      {template.sections.map((sec, si) => {
        const done = sec.items.filter((i) => items[itemKey(sec, i)]?.s).length;
        const bad = sec.items.filter((i) => items[itemKey(sec, i)]?.s === 'DEFECT').length;
        const isOpen = open === sec.key;
        return (
          <section key={sec.key} className={'panel rep-sec' + (isOpen ? ' open' : '')}>
            <button type="button" className="rep-sec-h" onClick={() => setOpen(isOpen ? '' : sec.key)} aria-expanded={isOpen}>
              <span className="num">{si + 1}</span>
              <span className="ttl">{sec.label}</span>
              {bad > 0 && <span className="pill bad">{bad}</span>}
              <span className={'cnt' + (done === sec.items.length ? ' full' : '')}>
                {done}/{sec.items.length}
              </span>
            </button>
            {isOpen && (
              <div className="rep-items">
                {sec.items.map((it) => {
                  const k = itemKey(sec, it);
                  const v = items[k] ?? {};
                  const photos = atts.filter((a) => a.kind === 'PHOTO' && a.itemKey === k);
                  return (
                    <div key={k} className={'rep-item' + (v.s === 'DEFECT' ? ' defect' : '')}>
                      <div className="rep-item-h">
                        <div>
                          <b>{it.label}</b>
                          {it.hint && <small>{it.hint}</small>}
                        </div>
                      </div>
                      <div className="seg" role="radiogroup" aria-label={it.label}>
                        {STATES.map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            role="radio"
                            aria-checked={v.s === o.v}
                            className={o.cls}
                            onClick={() => setItem(k, { s: v.s === o.v ? undefined : o.v })}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      {(v.s === 'DEFECT' || v.n || photos.length > 0) && (
                        <div className="rep-detail">
                          <textarea
                            value={v.n ?? ''}
                            onChange={(e) => setItem(k, { n: e.target.value })}
                            placeholder={v.s === 'DEFECT' ? 'Popis závady, umístění, návrh opravy…' : 'Poznámka'}
                            maxLength={1000}
                            rows={2}
                          />
                          <div className="rep-photos">
                            {photos.map((p) => (
                              <div key={p.id} className="thumb">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/attachments/${p.id}`} alt="" loading="lazy" />
                                <button type="button" onClick={() => removePhoto(p.id)} aria-label="Odebrat fotku">
                                  ×
                                </button>
                              </div>
                            ))}
                            <label className={'addphoto' + (busyItem === k ? ' busy' : '')}>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                onChange={(e) => {
                                  addPhoto(k, e.target.files);
                                  e.target.value = '';
                                }}
                                disabled={busyItem !== null}
                              />
                              {busyItem === k ? 'Nahrávám…' : '+ Foto'}
                            </label>
                          </div>
                          {v.s === 'DEFECT' && (
                            <label className="check">
                              <input type="checkbox" checked={v.task !== false} onChange={(e) => setItem(k, { task: e.target.checked })} />
                              Po dokončení vytvořit úkol na odstranění
                            </label>
                          )}
                        </div>
                      )}
                      {v.s !== 'DEFECT' && !v.n && photos.length === 0 && (
                        <button type="button" className="linkish" onClick={() => setItem(k, { n: ' ' })}>
                          + poznámka / foto
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="rep-sec-f">
                  <button type="button" className="btn" onClick={() => sectionAllOk(sec.key)}>
                    Zbytek v pořádku ✓
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <section className="panel">
        <header>
          <h2>Závěr a podpisy</h2>
        </header>
        <div className="rep-final">
          <label>
            Celkové zhodnocení
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={4000} placeholder="Shrnutí stavu objektu, doporučení…" />
          </label>
          <div className="sigs">
            <SignatureBox
              label="Podpis technika"
              reportId={reportId}
              kind="SIGNATURE_TECH"
              current={sigTech?.id}
              onChange={(id) => setAtts((a) => [...a.filter((x) => x.kind !== 'SIGNATURE_TECH'), ...(id ? [{ id, kind: 'SIGNATURE_TECH', itemKey: null }] : [])])}
            />
            <SignatureBox
              label={svjName ? `Podpis: ${svjName}` : 'Podpis za SVJ'}
              reportId={reportId}
              kind="SIGNATURE_SVJ"
              current={sigSvj?.id}
              onChange={(id) => setAtts((a) => [...a.filter((x) => x.kind !== 'SIGNATURE_SVJ'), ...(id ? [{ id, kind: 'SIGNATURE_SVJ', itemKey: null }] : [])])}
            />
          </div>
        </div>
      </section>

      {error && (
        <p className="err big" role="alert">
          {error}
        </p>
      )}
      <div className="rep-actions">
        <p className="muted small">
          {st.filled < st.total
            ? `Nevyplněné položky (${st.total - st.filled}) budou v protokolu jako nehodnocené.`
            : 'Vše vyplněno.'}{' '}
          {defectsWithTask > 0 && `Vznikne ${defectsWithTask} ${defectsWithTask === 1 ? 'úkol' : defectsWithTask < 5 ? 'úkoly' : 'úkolů'} ze závad.`}
        </p>
        <button type="button" className="btn pri big" onClick={finish} disabled={finishing}>
          {finishing ? 'Dokončuji…' : 'Dokončit protokol'}
        </button>
      </div>
    </div>
  );
}

function SignatureBox({
  label,
  reportId,
  kind,
  current,
  onChange,
}: {
  label: string;
  reportId: string;
  kind: 'SIGNATURE_TECH' | 'SIGNATURE_SVJ';
  current?: string;
  onChange: (id: string | null) => void;
}) {
  const [editing, setEditing] = useState(!current);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2a6b';
    let down = false;
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const start = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent) => {
      if (!down) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      drawn.current = true;
    };
    const end = () => {
      down = false;
    };
    c.addEventListener('pointerdown', start);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    return () => {
      c.removeEventListener('pointerdown', start);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', end);
      c.removeEventListener('pointercancel', end);
    };
  }, [editing]);

  function clear() {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    drawn.current = false;
  }

  async function save() {
    if (!drawn.current) return;
    setBusy(true);
    const blob: Blob | null = await new Promise((r) => canvas.current!.toBlob(r, 'image/png'));
    if (blob) {
      const fd = new FormData();
      fd.set('reportId', reportId);
      fd.set('kind', kind);
      fd.set('file', blob, 'podpis.png');
      const r = await uploadAttachment(fd);
      if ('id' in r) {
        onChange(r.id);
        setEditing(false);
      }
    }
    setBusy(false);
  }

  return (
    <div className="sig">
      <span className="lbl">{label}</span>
      {editing ? (
        <>
          <canvas ref={canvas} className="sigpad" aria-label={label} />
          <div className="sig-act">
            <button type="button" className="btn sm ghost" onClick={clear}>
              Smazat
            </button>
            {current && (
              <button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>
                Zrušit
              </button>
            )}
            <button type="button" className="btn sm pri" onClick={save} disabled={busy}>
              {busy ? 'Ukládám…' : 'Uložit podpis'}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/attachments/${current}`} alt={label} className="sigimg" />
          <div className="sig-act">
            <button type="button" className="btn sm" onClick={() => setEditing(true)}>
              Podepsat znovu
            </button>
          </div>
        </>
      )}
    </div>
  );
}
