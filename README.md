# Ravinto — Linda’s calorie & macro tracker

Phone-first PWA for daily food logging. Separate from the workout-program track. Finnish grocery staples, Helsinki calendar dates, local-only data.

**Live app:** [https://nieminenlinda-del.github.io/calorie-tracker/](https://nieminenlinda-del.github.io/calorie-tracker/)

Phase 1 does **not** include barcode scanning, Open Food Facts, or social features.

## Install on iPhone

1. Open the live URL in **Safari** (not Chrome or in-app browsers).
2. Tap the **Share** button (square with an arrow).
3. Scroll and tap **Add to Home Screen**.
4. Tap **Add**. Ravinto appears on the home screen and opens full-screen.

Data stays on this iPhone (IndexedDB). The app works offline after the first load.

## Defaults

- 2050 kcal · 125 g protein · 60 g fat · 265 g carbs
- Diet flags: dairy-free, no bread, no tofu, eggs ok, fish ok, no other meat, Finnish groceries
- Dates: `Europe/Helsinki`
- Food names: Finnish primary

## Run

```bash
npm install
npm run dev
```

The Vite `base` is `/calorie-tracker/`, so open `http://<your-ip>:5173/calorie-tracker/` (same Wi‑Fi) or that path in a mobile viewport. Production deploys from `main` via GitHub Actions to GitHub Pages.

```bash
npm test
npm run build
npm run preview
```

## Use it

1. **Tänään** shows remaining kcal / P / C / F against targets.
2. Tap **+ Lisää** on a meal (aamiainen, lounas, päivällinen, välipala) and pick a staple in grams. Eggs are logged by piece (`kpl`).
3. **Treenipäivä** drops in the seeded training-day templates (proteiinipuuro, linssi+munat, banaani+Härkis, kirjolohi+kuskus).
4. **Tallenna ateria** keeps the current meal as a reusable template. **Kopioi eilinen** / per-meal copy fills from yesterday.
5. **Pika** is a manual quick-add (name + kcal + P/C/F).
6. **Tavoitteet** edits the daily targets (defaults as above).

All of this is stored in IndexedDB in the browser. Clearing site data wipes the log.

## Phase 2 (not in this release)

Barcode scanning and Open Food Facts lookup. The catalog `Food` model already has room for brand and tags; a future `barcode` field and a remote food adapter can sit beside the existing repos without changing the log snapshot shape.
