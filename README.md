# iSYS — interní systém techniků

Vývojový základ samostatné aplikace pro správu bytových domů. Next.js, TypeScript, Prisma, PostgreSQL.

## Spuštění lokálně

Požadavky: Node.js 22+, Docker Desktop.

```bash
cp .env.example .env
npm install
docker compose up -d
npx prisma db push
npm run dev
```

Na Windows PowerShell místo `cp` použijte `Copy-Item .env.example .env`.
Otevřete http://localhost:3000.

**Bezpečnost:** Toto je pouze lokální vývojová verze. NEMÁ přihlašování ani kontrolu oprávnění. Nenasazujte veřejně a nevkládejte reálné osobní údaje, klíčové identifikátory ani dokumenty družstva. Heslo v docker-compose je jen pro lokální vývoj. Před produkčním provozem doplnit autentizaci, role, audit, zálohy, HTTPS, ochranu dat a bezpečné ukládání tajných údajů.

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
- Docker PostgreSQL a GitHub Actions

## Další etapy
1. Microsoft Entra ID / jiné SSO, role a oprávnění, auditní záznamy.
2. Detail objektu a dokumentace.
3. Roční kontroly s fotografiemi a PDF.
4. Evidence výpůjček klíčů a QR/NFC workflow.
5. Úkoly SVJ, termíny a notifikace.
6. Zálohování, bezpečnostní testy, produkční nasazení.
