import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const PAGES: [string, string][] = [
  ['prehled', '/'],
  ['objekty', '/buildings'],
  ['objekt', '/buildings/bd-lipova14'],
  ['objekt-ukoly', '/buildings/bd-lipova14?tab=ukoly'],
  ['objekt-kontroly', '/buildings/bd-lipova14?tab=kontroly'],
  ['objekt-klice', '/buildings/bd-lipova14?tab=klice'],
  ['objekt-dum', '/buildings/bd-lipova14?tab=dum'],
  ['objekt-jednotky', '/buildings/bd-lipova14?tab=jednotky'],
  ['objekt-meridla', '/buildings/bd-lipova14?tab=meridla'],
  ['objekt-zavady', '/buildings/bd-korunni88?tab=zavady'],
  ['objekt-dokumenty', '/buildings/bd-lipova14?tab=dokumenty'],
  ['objekt-dodavatele', '/buildings/bd-vysluni3?tab=dodavatele'],
  ['zavady', '/tickets'],
  ['zavady-havarie', '/tickets?f=havarie'],
  ['zavada-nova', '/tickets/new'],
  ['zavada', '/tickets/tk1'],
  ['dodavatele', '/suppliers'],
  ['smlouvy', '/suppliers?tab=smlouvy'],
  ['dodavatel', '/suppliers/sup-vytahy'],
  ['vice', '/more'],
  ['revize-matice', '/inspections?tab=matice'],
  ['ukoly', '/tasks'],
  ['ukoly-tym', '/tasks?s=team'],
  ['ukoly-nastenka', '/tasks?s=team&v=board'],
  ['ukol-detail', '/tasks?s=team&t=t2'],
  ['klice', '/keys'],
  ['klic', '/keys/k0'],
  ['klic-zapujcit', '/keys/k0/lend'],
  ['kontroly', '/inspections'],
  ['kontroly-plan', '/inspections?tab=plan'],
  ['protokol', '/inspections/reports/rep-final'],
  ['protokol-koncept', '/inspections/reports/rep-draft'],
  ['dochazka', '/attendance'],
  ['dovolena', '/leave'],
  ['uzivatele', '/users'],
  ['profil', '/profile'],
];

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached', timeout: 15_000 });
}

const SIZES = [
  { name: 'desktop', width: 1680, height: 1000 },
  { name: 'mobil', width: 390, height: 844 },
];

fs.mkdirSync('e2e-shots', { recursive: true });

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const name = info.titlePath.slice(1).join('-').replace(/[^\w-]+/g, '_').slice(0, 80);
    await page.screenshot({ path: `e2e-shots/CHYBA-${name}.png`, fullPage: true }).catch(() => {});
  }
});

const netlog: string[] = [];
test.afterAll(() => fs.writeFileSync('e2e-shots/network.log', netlog.join('\n')));

function watch(page: Page) {
  const errors: string[] = [];
  const started = new Map<string, number>();
  page.on('request', (r) => {
    if (r.method() === 'POST') started.set(r.url() + '#' + r.postData()?.slice(0, 40), Date.now());
    else if (r.headers()['rsc'] || r.url().includes('_rsc=')) {
      started.set('GET ' + r.url(), Date.now());
      netlog.push(`${new Date().toISOString()} START RSC ${r.url()} prefetch=${r.headers()['next-router-prefetch'] ?? ''}`);
    }
  });
  page.on('response', (res) => {
    const r = res.request();
    if (r.method() !== 'POST' && (r.headers()['rsc'] || r.url().includes('_rsc='))) netlog.push(`${new Date().toISOString()} HEADERS RSC ${r.url()} ${res.status()}`);
  });
  page.on('requestfinished', async (r) => {
    if (r.method() !== 'POST') {
      const t0 = started.get('GET ' + r.url());
      if (t0) netlog.push(`${new Date().toISOString()} DONE RSC ${r.url()} ${Date.now() - t0}ms`);
      return;
    }
    const res = await r.response();
    const t0 = started.get(r.url() + '#' + r.postData()?.slice(0, 40));
    let body = '';
    try {
      const full = (await res?.text()) ?? '';
      body = full.slice(0, 300).replace(/\n/g, '⏎');
      if (/leave|tasks|inspections\/reports/.test(r.url())) fs.appendFileSync('e2e-shots/action-bodies.log', `\n===== ${r.url()} (${full.length} B)\n${full.slice(-4000)}\n`);
    } catch {}
    netlog.push(`${new Date().toISOString()} POST ${r.url()} ${res?.status()} ${t0 ? Date.now() - t0 : '?'}ms action=${r.headers()['next-action'] ?? ''} ct=${res?.headers()['content-type']} body=${body}`);
  });
  page.on('requestfailed', (r) => netlog.push(`FAILED ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  page.on('pageerror', (e) => {
    errors.push('pageerror: ' + e.message);
    netlog.push('PAGEERROR ' + page.url() + ' ' + e.message + '\n' + (e.stack ?? '').slice(0, 1500));
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') netlog.push(`CONSOLE.${m.type()} ${page.url()} ${m.text().slice(0, 1500)}`);
    if (m.type() === 'error' && !/favicon|Download the React DevTools/.test(m.text())) errors.push('console: ' + m.text());
  });
  return errors;
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const [name, url] of PAGES) {
      test(`${name} se načte bez chyb`, async ({ page }) => {
        const errors = watch(page);
        const res = await page.goto(url, { waitUntil: 'networkidle' });
        expect(res?.status(), `HTTP ${url}`).toBeLessThan(400);
        await expect(page.locator('body')).not.toContainText('Application error');
        await expect(page.locator('body')).not.toContainText('Internal Server Error');
        // žádné vodorovné posouvání stránky
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await page.screenshot({ path: `e2e-shots/${size.name}-${name}.png`, fullPage: true });
        expect(overflow, `vodorovný přesah ${url}`).toBeLessThanOrEqual(1);
        expect(errors, `chyby v konzoli ${url}`).toEqual([]);
      });
    }
  });
}

test.describe('akce', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('PDF a CSV výstupy', async ({ request }) => {
    for (const u of ['/inspections/reports/rep-final/pdf', '/inspections/reports/rep-draft/pdf', '/keys/loans/loan1/pdf']) {
      const r = await request.get(u);
      expect(r.status(), u).toBe(200);
      expect(r.headers()['content-type'], u).toContain('application/pdf');
      expect((await r.body()).length, u).toBeGreaterThan(2000);
    }
    const csv = await request.get('/attendance/export');
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain('Odpracováno');
  });

  test('hlášení závady od zápisu po vyřešení', async ({ page }) => {
    const errors = watch(page);
    await go(page, '/tickets/new');
    await page.getByLabel('Co se stalo *').fill('E2E kape kohoutek');
    await page.getByLabel('Dům *').selectOption('bd-lipova14');
    await page.getByRole('button', { name: 'Zapsat hlášení' }).click();
    await expect(page.getByRole('heading', { name: 'E2E kape kohoutek' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Přijmout' }).click();
    await expect(page.locator('.pill', { hasText: 'Přijato' }).first()).toBeVisible();
    await page.getByLabel('Poznámka').fill('Domluveno s instalatérem');
    await page.locator('form:has(textarea[name="body"]) button').first().click();
    await expect(page.getByText('Domluveno s instalatérem').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Vyřešeno' }).click();
    await expect(page.locator('.pill', { hasText: 'Vyřešeno' }).first()).toBeVisible();
    await page.screenshot({ path: 'e2e-shots/akce-zavada.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('rychlé přidání a odškrtnutí úkolu', async ({ page }) => {
    const errors = watch(page);
    await go(page, '/tasks');
    await page.getByLabel('Název úkolu').fill('E2E testovací úkol');
    await page.getByLabel('Název úkolu').press('Enter');
    await expect(page.getByText('E2E testovací úkol').first()).toBeVisible({ timeout: 15_000 });
    const row = page.locator('.trow', { hasText: 'E2E testovací úkol' });
    await row.getByRole('button', { name: 'Označit jako hotové' }).click();
    await expect(row.getByRole('button', { name: 'Vrátit mezi nehotové' })).toBeVisible();
    await go(page, '/tasks?s=team&t=t2');
    await expect(page.getByRole('complementary', { name: 'Detail úkolu' })).toBeVisible();
    await page.getByPlaceholder('Napište komentář…').fill('Komentář z testu');
    await page.getByRole('button', { name: 'Komentovat' }).click();
    await expect(page.getByText('Komentář z testu').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('protokol kontroly od začátku do konce', async ({ page }) => {
    const errors = watch(page);
    await go(page, '/inspections');
    await page.locator('.hero-start select[name="buildingId"]').selectOption('bd-zelena21');
    await page.getByRole('button', { name: 'Začít kontrolu' }).click();
    await page.waitForURL(/\/inspections\/reports\//);
    await page.getByRole('radiogroup', { name: 'Krytina' }).getByRole('radio', { name: 'Závada' }).click();
    await page.getByPlaceholder(/Popis závady/).fill('Prasklé tašky nad vchodem');
    await page.getByRole('button', { name: 'Zbytek v pořádku ✓' }).click();
    await expect(page.getByText('✓ Uloženo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Dokončit protokol' }).click();
    await expect(page.getByText(/Dokončeno/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Krytina: Prasklé tašky/).first()).toBeVisible();
    await page.screenshot({ path: 'e2e-shots/akce-protokol-hotovo.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('zapůjčení a vrácení klíčů s podpisem', async ({ page }) => {
    const errors = watch(page);
    await go(page, '/keys/k4/lend');
    await page.getByLabel('Jméno přebírajícího *').fill('Test Testovič');
    const pad = page.getByRole('img', { name: 'Podpis přebírajícího' }).or(page.locator('canvas.sigpad').first());
    const box = (await page.locator('canvas.sigpad').first().boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
    await page.mouse.move(box.x + 200, box.y + 30, { steps: 8 });
    await page.mouse.up();
    void pad;
    await page.getByRole('button', { name: 'Předat klíče' }).click();
    await page.waitForURL(/\/keys\/k4\?nova=/);
    await expect(page.getByText('Klíče předány')).toBeVisible();
    await page.getByRole('button', { name: 'Klíče vráceny' }).click();
    await expect(page.getByText('V kanceláři').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('docházka a žádost o dovolenou', async ({ page }) => {
    const errors = watch(page);
    await go(page, '/attendance');
    await page.getByRole('button', { name: 'Příchod' }).click();
    await expect(page.getByRole('heading', { name: 'V práci' })).toBeVisible();
    await go(page, '/leave');
    const from = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await page.locator('input[name="from"]').fill(from);
    await page.getByRole('button', { name: 'Odeslat ke schválení' }).click();
    await expect(page.getByText('✓ Odesláno')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
