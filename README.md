# iSYS — interní systém techniků

Vývojový základ samostatné aplikace pro správu bytových domů. Next.js, TypeScript, Prisma, PostgreSQL.

## Spuštění lokálně

Požadavky: Node.js 22+.

### S databází v Supabase (projekt `kkt2`)

Tabulky v Supabase už existují a mají zapnuté RLS (veřejné Data API je zablokované, aplikace přistupuje přes Prismu).

```bash
cp .env.example .env
# v .env doplňte připojovací řetězce ze Supabase: Connect -> ORMs -> Prisma
npm install
npm run dev
```

### S lokální databází v Dockeru

Požadavky navíc: Docker Desktop. V `.env` použijte zakomentované lokální řetězce.

```bash
docker compose up -d
npx prisma db push
npm run dev
```

Na Windows PowerShell místo `cp` použijte `Copy-Item .env.example .env`.
Otevřete http://localhost:3000.

**Bezpečnost:** Aplikace vyžaduje přihlášení (Supabase Auth, e-mail + heslo). Všechny stránky i API jsou za přihlášením (`src/middleware.ts`). Role a audit zatím chybí: každý přihlášený uživatel může všechno.

### Uživatelé

Veřejná registrace není. Účty zakládá správce:

1. Supabase → projekt **kkt2** → **Authentication → Sign In / Providers** → vypnout **Allow new users to sign up**. (Důležité: jinak by se kdokoli mohl zaregistrovat přímo přes Supabase API.)
2. **Authentication → Users → Add user → Create new user**, zadat e-mail a heslo, zaškrtnout *Auto Confirm User*.

## Nasazení na Vercel

1. https://vercel.com/new → **Import** repozitáře `cermakji-dev/kkt2` (framework Next.js se pozná sám).
2. V **Environment Variables** vyplnit čtyři proměnné z `.env` (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
3. **Deploy**. Každý další push do `main` se nasadí automaticky.

## GitHub

1. Vytvořte **soukromý** repozitář `isys` bez automatického README.
2. Rozbalte obsah ZIP do složky projektu.
3. Spusťte `npm install` (vytvoří package-lock.json), potom:

```bash
git init
git add .
git commit -m "Initial iSYS starter"
git branch -M main
git remote add origin https://github.com/VASE-ORGANIZACE/isys.git
git push -u origin main
```

Soubor `.env` je ignorovaný Gitem. V CI běží build nad testovací databází.

## Co je hotové
- Dashboard s počty objektů, úkolů, klíčů a kontrol
- Evidence objektů: seznam a vytvoření objektu
- Datový model: objekty, úkoly, svazky klíčů, kontroly
- Základ API a validace vstupů
- Přihlašování přes Supabase Auth, databáze v Supabase
- Docker PostgreSQL a GitHub Actions

## Další etapy
1. Role a oprávnění, auditní záznamy, případně SSO (Microsoft Entra ID).
2. Detail objektu a dokumentace.
3. Roční kontroly s fotografiemi a PDF.
4. Evidence výpůjček klíčů a QR/NFC workflow.
5. Úkoly SVJ, termíny a notifikace.
6. Zálohování, bezpečnostní testy, produkční nasazení.
