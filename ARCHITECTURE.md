# Architecture

Ravinto is a client-only Vite + React + TypeScript PWA. There is no backend in phase 1.

```
UI (pages/components)
  → TrackerContext (day + catalog + targets)
    → domain (macros, dates, diet, logging)
      → repos (IndexedDB)
```

## Persistence

IndexedDB database `ravinto` (see `src/db/database.ts`) with stores:

| Store | Role |
| --- | --- |
| `foods` | Staples catalog (seeded, Finnish names primary) |
| `food_logs` | One row per logged item; macros snapshotted at log time |
| `meal_templates` | Named meal recipes: `{ food_id, amount, unit }[]` |
| `user_targets` | Single `default` record (kcal/P/C/F + diet flags) |
| `meta` | Seed version |

Daily totals are **computed** from `food_logs` (`src/domain/summary.ts`), not stored.

Repos in `src/repos/` are the only modules that touch IndexedDB. UI never opens IDB directly.

## Dates

Calendar days use `Europe/Helsinki` (`src/domain/dates.ts`). Logs key off `YYYY-MM-DD` in that zone so a late evening in Finland does not spill into the next UTC day.

## Macros

- Catalog foods are `per_100g` (or `per_ml`) except eggs (`per_piece`).
- `scaleFoodMacros` converts amount → kcal / P / C / F.
- Custom quick-add stores the entered macros as a snapshot with optional `custom_name` and no `food_id`.

## Seed

`src/seed/foods.ts` and `src/seed/templates.ts` run on first open (`bootstrapDb`). Catalog upserts keep macros current; user logs keep the snapshot from when they were saved. Seeded foods omit dairy, bread, tofu, and land meat.

## PWA

`vite-plugin-pwa` injects a service worker (precache + SPA navigate fallback) and a standalone manifest. Installable on iOS/Android via Add to Home Screen.

## Phase 2 extension points

Barcode + Open Food Facts should land as:

1. Optional `barcode` on `Food` (and a `by-barcode` index).
2. A `FoodLookup` adapter next to repos — local catalog first, OFF second — returning the same `Food` shape.
3. Camera UI on the add-food page only. Log rows stay snapshots so offline totals never depend on OFF.

Do not couple logs to live remote nutrition data.
