import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const PAGES: [string, string][] = [
  ['prehled', '/'],
  ['objekty', '/buildings'],
  ['objekt', '/buildings/bd-lipova14'],
  ['objekt-ukoly', '/buildings/bd-lipova14?tab=ukoly'],
  ['objekt-kontroly', '/buildings/bd-lipova14?tab=kontroly'],
  ['objekt-klice', '/buildings/bd-lipova14?tab=klice'],
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

const SIZES = [
  { name: 'desktop', width: 1680, height: 1000 },
  { name: 'mobil', width: 390, height: 844 },
];

fs.mkdirSync('e2e-shots', { recursive: true });

function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
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

  test('rychlé přidání a odškrtnutí úkolu', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/tasks');
    await page.getByLabel('Název úkolu').fill('E2E testovací úkol');
    await page.getByLabel('Název úkolu').press('Enter');
    await expect(page.getByText('E2E testovací úkol').first()).toBeVisible();
    const row = page.locator('.titem', { hasText: 'E2E testovací úkol' });
    await row.getByRole('button', { name: 'Označit jako hotové' }).click();
    await expect(row.getByRole('button', { name: 'Vrátit mezi nehotové' })).toBeVisible();
    await page.goto('/tasks?s=team&t=t2');
    await expect(page.getByRole('complementary', { name: 'Detail úkolu' })).toBeVisible();
    await page.getByPlaceholder('Napište komentář…').fill('Komentář z testu');
    await page.getByRole('button', { name: 'Komentovat' }).click();
    await expect(page.getByText('Komentář z testu').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('protokol kontroly od začátku do konce', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/inspections');
    await page.locator('.hero-start select[name="buildingId"]').selectOption('bd-zelena21');
    await page.getByRole('button', { name: 'Začít kontrolu' }).click();
    await page.waitForURL(/\/inspections\/reports\//);
    await page.getByRole('radiogroup', { name: 'Krytina' }).getByRole('radio', { name: 'Závada' }).click();
    await page.getByPlaceholder(/Popis závady/).fill('Prasklé tašky nad vchodem');
    await page.getByRole('button', { name: 'Zbytek v pořádku ✓' }).click();
    await expect(page.getByText('✓ Uloženo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Dokončit protokol' }).click();
    await expect(page.getByText(/Dokončeno/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Krytina: Prasklé tašky/).first()).toBeVisible();
    await page.screenshot({ path: 'e2e-shots/akce-protokol-hotovo.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('zapůjčení a vrácení klíčů s podpisem', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/keys/k4/lend');
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
    await page.goto('/attendance');
    await page.getByRole('button', { name: 'Příchod' }).click();
    await expect(page.getByRole('heading', { name: 'V práci' })).toBeVisible();
    await page.goto('/leave');
    const from = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await page.locator('input[name="from"]').fill(from);
    await page.getByRole('button', { name: 'Odeslat ke schválení' }).click();
    await expect(page.getByText('✓ Odesláno')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
