/**
 * Testovací režim pro automatické testy v CI (Playwright).
 * Funguje POUZE když je nastaveno ISYS_E2E_BYPASS=1 a aplikace NEběží na Vercelu.
 * Na produkci (Vercel nastavuje VERCEL=1) je vždy vypnutý.
 */
export function e2eUserId(): string | null {
  if (process.env.VERCEL) return null;
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') return null;
  if (process.env.ISYS_E2E_BYPASS !== '1') return null;
  return process.env.ISYS_E2E_USER_ID || null;
}
