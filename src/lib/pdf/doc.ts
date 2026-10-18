import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CARLITO_BOLD, CARLITO_REGULAR } from './fonts';

// A4 v bodech
export const W = 595.28;
export const H = 841.89;
export const M = 42; // okraj

export const C = {
  ink: rgb(0.09, 0.13, 0.11),
  muted: rgb(0.36, 0.41, 0.38),
  line: rgb(0.81, 0.84, 0.82),
  sunk: rgb(0.93, 0.94, 0.93),
  accent: rgb(0.83, 0.34, 0.11),
  ok: rgb(0.18, 0.48, 0.31),
  okSoft: rgb(0.86, 0.94, 0.89),
  bad: rgb(0.71, 0.15, 0.17),
  badSoft: rgb(0.97, 0.86, 0.86),
  naSoft: rgb(0.9, 0.91, 0.9),
};

const b64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));

/** Jednoduchý sázecí stroj nad pdf-lib: stránkování, zalamování textu, obrázky. */
export class Doc {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;
  footer = '';
  private pages: PDFPage[] = [];

  static async create(title: string, footer: string) {
    const d = new Doc();
    d.pdf = await PDFDocument.create();
    d.pdf.registerFontkit(fontkit);
    d.pdf.setTitle(title);
    d.pdf.setCreator('iSYS');
    d.pdf.setProducer('iSYS');
    d.font = await d.pdf.embedFont(b64(CARLITO_REGULAR), { subset: true });
    d.bold = await d.pdf.embedFont(b64(CARLITO_BOLD), { subset: true });
    d.footer = footer;
    d.newPage();
    return d;
  }

  newPage() {
    this.page = this.pdf.addPage([W, H]);
    this.pages.push(this.page);
    this.y = H - M;
  }

  /** Zajistí místo; když není, založí novou stránku. */
  need(h: number) {
    if (this.y - h < M + 24) this.newPage();
  }

  /** Text s nahrazením znaků, které font nemá. */
  clean(s: string) {
    return s
      .replace(/[‘’]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/\t/g, ' ')
      .replace(/[^ -ſ‐-‧‰€№™←-↓−✓✗\n]/g, '');
  }

  wrap(text: string, size: number, maxW: number, font = this.font): string[] {
    const out: string[] = [];
    for (const para of this.clean(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        out.push('');
        continue;
      }
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
        else {
          if (line) out.push(line);
          // Příliš dlouhé slovo rozdělit natvrdo.
          let rest = w;
          while (font.widthOfTextAtSize(rest, size) > maxW) {
            let i = rest.length;
            while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxW) i--;
            out.push(rest.slice(0, i));
            rest = rest.slice(i);
          }
          line = rest;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(s: string, x: number, y: number, size = 10, opts: { font?: PDFFont; color?: RGB } = {}) {
    this.page.drawText(this.clean(s), { x, y, size, font: opts.font ?? this.font, color: opts.color ?? C.ink });
  }

  /** Odstavec od aktuální pozice, vrací výšku. */
  para(s: string, opts: { x?: number; w?: number; size?: number; font?: PDFFont; color?: RGB; lead?: number } = {}) {
    const size = opts.size ?? 10;
    const lead = opts.lead ?? size * 1.32;
    const x = opts.x ?? M;
    const lines = this.wrap(s, size, opts.w ?? W - 2 * M, opts.font);
    for (const l of lines) {
      this.need(lead);
      this.y -= lead;
      this.text(l, x, this.y + lead * 0.24, size, opts);
    }
    return lines.length * lead;
  }

  rule(color = C.line, thickness = 0.6) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness, color });
  }

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  async image(bytes: Uint8Array, mime: string): Promise<PDFImage | null> {
    try {
      return mime === 'image/png' ? await this.pdf.embedPng(bytes) : await this.pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }

  async save() {
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M - 6 }, end: { x: W - M, y: M - 6 }, thickness: 0.5, color: C.line });
      p.drawText(this.clean(this.footer), { x: M, y: M - 20, size: 8, font: this.font, color: C.muted });
      const t = `Strana ${i + 1} z ${n}`;
      p.drawText(t, { x: W - M - this.font.widthOfTextAtSize(t, 8), y: M - 20, size: 8, font: this.font, color: C.muted });
    });
    return this.pdf.save();
  }
}

export function fmtCz(d: Date | null | undefined) {
  if (!d) return '—';
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  const ascii = filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
