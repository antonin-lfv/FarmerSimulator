# FarmerSimulator — Streamlit/SQLite legacy app (historical reference)

This document is the full reference for the original Streamlit + SQLite implementation of
FarmerSimulator, written immediately before deleting that codebase (`Dashboard.py`, `pages/`,
`database_manager.py`, `config.py`, `logo.py`, `market_updater.py`, `farming_simulator.db`,
`requirements.txt`, `pyproject.toml`, `poetry.lock`, the shell scripts, and `backend/server.py`).

**All of this logic has already been ported (and several bugs fixed) into the current backend**
at `backend/app/` (FastAPI + PostgreSQL) — see that codebase for the live implementation. This
document exists purely as a historical record of what the original app did, in case anything
here needs to be cross-checked later. The deleted code is also still recoverable from git history
if ever needed (`git log --diff-filter=D -- database_manager.py`, etc.).

## What it was

A single-player farm management simulator built as a multipage Streamlit app, backed by a single
SQLite file (`farming_simulator.db`), with all business logic living in one 2,674-line procedural
file, `database_manager.py` (raw `sqlite3` connections, no ORM, no migrations, no tests).

## File structure (as it existed)

```
Dashboard.py            # Streamlit home page: wallet/parcels/actions summary, market snapshot,
                         # cheat button (+10k USD), nav links, crude auto-refresh (sleep+rerun)
config.py                # PATH_config (svg/image/db paths, all relative — cwd-fragile),
                         # get_image() (base64-encodes images for inline HTML), a CSS snippet
logo.py                  # Injected sidebar CSS pointing at an externally-hosted logo image URL
                         # (not the local assets/images/logo.png that existed on disk)
database_manager.py      # The entire backend: schema, seed data, and all business logic
market_updater.py        # Standalone daemon loop (meant to run as a separate process), called
                         # automatic_market_update() every 60s
pages/
  01_Plan.py              # Interactive map (see "Map interaction" below) + action management
  01_Plan.py.backup        # Stale backup file, unused
  02_Shop.py               # Catalog browsing + purchases
  03_Inventaire.py         # Owned items, sell action
  05_Marche.py              # Market prices, price history charts, sell harvest
  (04_Ouvriers.py referenced by a nav link in 01_Plan.py but never existed — broken link)
map/
  map.svg                  # Inkscape export: a raster <image> (map.png) + 54 <path> elements,
                            # each wrapping a <title>Parcelle N</title>, in parcel-id order 1→54
  map.png                  # 1646×1644px background raster
assets/images/             # Product images (tractors, harvesters, seed packs...) in png+webp
backend/server.py          # Unused FastAPI "Hello World" stub, never wired to anything
requirements.txt / pyproject.toml / poetry.lock   # streamlit, streamlit-plotly-events, plotly,
                                                   # shapely, svgpathtools, geopandas,
                                                   # streamlit-aggrid
start_farm_simulator.sh / stop_farm_simulator.sh / watch_logs.sh
  # Launched Streamlit on port 8001 + market_updater.py as a background process, logged to logs/
```

## Database schema (SQLite, via `init_db()`)

| Table | Columns | Notes |
|---|---|---|
| `wallet` | `wallet_id` PK, `balance_usd` | Single row, `wallet_id=1` hardcoded everywhere. No `user` table — genuinely single-player. |
| `type_surface` | `type_surface_id` PK, `type_surface` (unique) | Seed values: `champ`, `forêt`, `vigne`, `entrepôt` |
| `parcels` | `parcel_id` PK, `superficie`, `type_surface_id` FK, `prix`, `is_purchased`, `parcel_next_action` | 54 rows, ids not contiguous. `parcel_id` order must match the 54 `<title>Parcelle N</title>` elements in `map/map.svg`. |
| `catalog` | `item_id` PK, `category`, `subcategory`, `name`, `price`, `promotion`, `img_path` | Master product list |
| `vehicules` | `vehicle_id` PK, `item_id` FK, `amount`, `num_available` | Owned vehicle stock |
| `accessories` | `accessory_id` PK, `item_id` FK, `amount`, `num_available` | Owned accessory stock |
| `packs` | `pack_id` PK, `item_id` FK, `amount` | Dual-purpose: purchased consumables (seeds/fertilizer) AND harvested crop output reuse this same table |
| `actions` | `action_id` PK, `action_type`, `type_surface_id` FK, `action_time`, `next_action` | Crop-cycle state machine via `next_action` string chain |
| `action_requirements` | `action_requirements_id` PK, `action_id` FK, `subcategory`, `amount` | Requirements referenced by `subcategory` string, not `item_id` |
| `workers` | `worker_id` PK, `worker_name`, `worker_price`, `available` | Hourly-rate hired workers |
| `ongoing_actions` | `ongoing_action_id` PK, `parcel_id` FK, `action_type`, `worker_id` FK, `start_time`, `end_time`, `resources_used` (JSON text), `cost` | Real-time timed job tracking |
| `market_prices` | `price_id` PK, `item_category`, `item_subcategory`, `price`, `timestamp` | Time-series price history |
| `used_vehicles` | `used_vehicle_id` PK, `item_id` FK, `ongoing_action_id` FK | Locks a vehicle instance while it's in use by an ongoing action |

## Seed data (via `populate_db()`)

**Wallet**: starting balance **$1000**.

**Parcels** — 54 total, `parcel_id`s not contiguous, all `superficie = 10.0 ha`, all start
unpurchased with a starting `parcel_next_action`:

- **champ** (33 parcels, $1000 each, next action `"labourer"`): ids 7, 8, 9, 10, 11, 13, 14, 15,
  18, 19, 20, 21, 22, 23, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 47
- **forêt** (8 parcels, $1500 each, next action `"planter des arbres"`): ids 6, 16, 17, 24, 27,
  36, 52, 53
- **vigne** (9 parcels, $1200 each, next action `"planter des vignes"`): ids 1, 2, 4, 5, 12, 45,
  46, 51, 54
- **entrepôt** (4 parcels, $2000 each, no next action / no crop cycle): ids 3, 48, 49, 50

**Catalog** — 25 items:

| item_id | category | subcategory | name | price |
|---|---|---|---|---|
| 1 | vehicules | tracteur | Petit tracteur | 5000 |
| 2 | vehicules | tracteur | Moyen tracteur | 8000 |
| 3 | vehicules | tracteur | Grand tracteur | 12000 |
| 4 | vehicules | moissonneuse | Moissonneuse batteuse | 15000 |
| 5 | vehicules | ramasse patates | Arracheuse de patates | 7000 |
| 6 | vehicules | ramasse coton | Récolteuse de coton | 7500 |
| 7 | vehicules | véhicule vignes | Enjambeur | 9000 |
| 8 | vehicules | véhicule bois | Abatteuse/porteur forestier | 8500 |
| 10 | accessoires | benne | Benne standard | 1500 |
| 11 | accessoires | benne | Grande benne | 2000 |
| 12 | accessoires | coupe de moissonneuse | Coupe 4 mètres | 3000 |
| 13 | accessoires | coupe de moissonneuse | Coupe 8 mètres | 4000 |
| 14 | accessoires | coupe de moissonneuse | Coupe 12 mètres | 5000 |
| 15 | accessoires | accessoire pour labourer | Déchaumeur à disques | 1200 |
| 16 | accessoires | accessoire pour semer | Semoir | 1300 |
| 17 | accessoires | accessoire pour engrais | Épandeur d'engrais | 1400 |
| 18 | packs | graines céréales | Graines de blés | 100 |
| 19 | packs | graines céréales | Graines de maïs | 100 |
| 20 | packs | graines céréales | Graines d'orge | 100 |
| 21 | packs | graines céréales | Graines de colza | 100 |
| 22 | packs | graines raisins | Graines de raisins | 100 |
| 23 | packs | graines coton | Graines de coton | 100 |
| 24 | packs | pousses arbres | Pousses d'arbres | 100 |
| 25 | packs | graines patates | Graines de patates | 100 |
| 26 | packs | engrais | Engrais | 100 |

(item_id 9 is skipped — never existed in the seed data.) All `promotion = 0` in the seed
(promotions were a supported field, never actually used).

**Actions** (15, `action_time` field — see "the game-time naming bug" below):

| action_id | surface | action_type | action_time | next_action |
|---|---|---|---|---|
| 1 | champ | labourer | 2.0 | semer céréales |
| 2 | champ | semer céréales | 1.5 | mettre engrais céréales |
| 3 | champ | mettre engrais céréales | 1.0 | récolter céréales |
| 4 | champ | récolter céréales | 2.5 | labourer |
| 5 | champ | semer coton | 1.5 | mettre engrais coton |
| 6 | champ | mettre engrais coton | 1.0 | récolter coton |
| 7 | champ | récolter coton | 2.5 | labourer |
| 8 | champ | semer patates | 1.5 | mettre engrais patates |
| 9 | champ | mettre engrais patates | 1.0 | récolter patates |
| 10 | champ | récolter patates | 2.5 | labourer |
| 11 | forêt | planter des arbres | 3.0 | couper le bois |
| 12 | forêt | couper le bois | 4.0 | planter des arbres |
| 13 | vigne | planter des vignes | 2.0 | recolter raisins |
| 14 | vigne | recolter raisins | 3.0 | planter des vignes |
| 15 | entrepôt | stockage | 1.0 | — |

Note: a parcel only ever starts at `labourer` / `planter des arbres` / `planter des vignes` — the
"semer coton"/"semer patates" branches exist in `actions` but nothing in the seed data ever
routes a parcel there (the `champ` cycle always chains through the céréales branch,
`labourer → semer céréales → ... → récolter céréales → labourer`). Coton/patates actions appear
to have been intended as alternate crop choices that were never wired into the state machine.

**Action requirements** (34 rows, by `subcategory` string):

- **labourer**: tracteur ×1, accessoire pour labourer ×1
- **semer céréales**: graines céréales ×1, accessoire pour semer ×1, tracteur ×1
- **mettre engrais céréales**: engrais ×1, tracteur ×1, accessoire pour engrais ×1
- **récolter céréales**: moissonneuse ×1, coupe de moissonneuse ×1, tracteur ×1, benne ×1
- **semer coton**: graines coton ×1, accessoire pour semer ×1, tracteur ×1
- **mettre engrais coton**: engrais ×1, tracteur ×1, accessoire pour engrais ×1
- **récolter coton**: ramasse coton ×1
- **semer patates**: graines patates ×1, accessoire pour semer ×1, tracteur ×1
- **mettre engrais patates**: engrais ×1, tracteur ×1, accessoire pour engrais ×1
- **récolter patates**: ramasse patates ×1
- **planter des arbres**: pousses arbres ×1, tracteur ×1, accessoire pour semer ×1
- **couper le bois**: véhicule bois ×1
- **planter des vignes**: graines raisins ×1, tracteur ×1, accessoire pour semer ×1
- **recolter raisins**: **ramasse raisins** ×1 — ⚠️ **this vehicle subcategory does not exist
  anywhere in the catalog** (only `véhicule vignes` does). This action could never actually be
  started in the original game either. Carried forward as a known data gap into the new backend
  (see `backend/` memory notes) — not fixed since it would mean inventing catalog data that was
  never specified.

**Workers**: `init_db()` seeds 5 fixed workers ("Ouvrier 1".."Ouvrier 5", $50/h, available). A
*second*, dead-code path at the bottom of `populate_db()` also tries to seed 5 more workers with
random French names and a random $30–80/h price — but since `init_db()` already inserted 5 rows
first, the `workers_count == 0` guard in `populate_db()` always sees 5 existing rows and this
second block never actually ran in practice.

## Game mechanics

- **Wallet**: single global balance, starts at $1000. A "+10k USD" cheat button existed on the
  dashboard for testing (`add_10k_usd`, defined twice in the file — dead duplication).
- **Buying a parcel**: `buy_parcel()` — **bug**: this function checked the balance but never
  actually debited it. Parcels were effectively free in the original game.
- **Crop cycle**: each parcel has a `parcel_next_action` string that names the single next legal
  action; `get_possible_actions()` always returns exactly one action (never a choice of several).
  Completing an action advances `parcel_next_action` to that action's `next_action`, forming a
  loop (e.g. `labourer → semer céréales → mettre engrais céréales → récolter céréales → labourer`).
- **Starting a timed action** (`start_action_with_time`, the function actually wired to the UI —
  a separate, older `perform_action()` function also exists earlier in the file but is dead code,
  never called from any page): validates resources & worker availability, debits
  `worker_price × duration`, consumes `packs`-category resources immediately, locks any
  `vehicules`-category resource via a row in `used_vehicles` for the action's duration, and
  inserts a row into `ongoing_actions`.
- **The game-time naming bug**: `action_time` is documented/named as if it were **hours**
  (`get_game_time()`'s docstring even claims "1 minute réelle = 1 heure de jeu"), but
  `minutes_to_game_hours()` / `game_hours_to_minutes()` are literal identity functions (return
  their input unchanged), and the actual timed-action code computes `end_time = start_time +
  action_time * 60` seconds. So in practice `action_time` was always treated as **minutes**, not
  hours, despite the naming — e.g. `labourer` (`action_time = 2.0`) took 2 real minutes, not 2
  real hours. The new backend keeps the exact same real-world durations but names the constant
  honestly (`GAME_MINUTE_IN_SECONDS`).
- **Harvest rewards**: on completion, if the action's `action_type` contained the accented string
  `"récolter"` (checked via `perform_action`'s dead code path) a random 2–5 packs/hectare of the
  matching seed's subcategory were granted. The function actually used in practice,
  `complete_finished_actions`, had a similar but not-quite-matching check that silently failed to
  reward **`"recolter raisins"`** (no accent in the seed data) and **`"couper le bois"`** (doesn't
  contain "récolter" at all) — grapes and wood harvests granted nothing in the original game. Also
  fixed in the new backend (3–8 packs/hectare there, a minor tuning change made during the port).
- **Market simulation**: prices random-walk with a seasonal factor and a weather factor, mean-
  revert toward a target price (packs target ~$40, harvest target ~$80), and are clamped to
  per-category min/max bounds. A price update ran automatically once per simulated "market day"
  (1440 real seconds = 24 real minutes), throttled inside `automatic_market_update()`, normally
  driven by the separate `market_updater.py` daemon polling every 60s. There was also a 10% daily
  chance of one of 5 named market events, each applying a category-wide price multiplier for one
  update: `drought` (sécheresse), `bumper_crop` (récolte exceptionnelle), `export_demand` (forte
  demande export), `fuel_increase` (hausse carburant), `government_subsidy` (subventions).
- **Shop / inventory**: items bought at listed catalog price (`add_transaction`), added to the
  matching `vehicules`/`accessories`/`packs` table. `sell_item()` sold owned items back at **full
  catalog price** with **no depreciation**, even though the Streamlit inventory page's copy
  claimed an 80% resale discount — the UI text and the actual behavior disagreed. Not something a
  balance-tuning fix, just an inconsistency to be aware of; the new backend keeps the same
  full-price behavior (flagged, not changed, since no correct depreciation rate was ever
  specified).
- **Workers**: `hire_worker()` (defined twice) generated a worker with a random French name and a
  random $30–80/h price. `fire_worker()` (also defined twice) only allowed firing a worker with no
  currently-ongoing action.

## Map interaction (`pages/01_Plan.py`)

Streamlit has no native interactive image map, so the original app worked around it:

1. `parse_svg()` parsed `map/map.svg`'s 54 `<path>` elements with `svgpathtools`, converting each
   path's `d` attribute into a list of (x, y) points (curves subsampled to 5 points), and read
   each path's `<title>Parcelle N</title>` for its label.
2. `create_plot()` built a single Plotly `go.Figure`: one `go.Scatter(mode="lines", fill="toself")`
   trace per parcel polygon (near-invisible fill, used purely as an invisible clickable hit
   region), with `map.png` overlaid as a background image and panning/zooming disabled.
3. Clicks were captured via `streamlit_plotly_events.plotly_events(...)`; the clicked trace's
   `curveNumber + 1` was treated as the `parcel_id` — this only worked because Scatter traces were
   added in the same 1→54 order as the parcel ids, an implicit and fragile coupling.
4. A right-hand panel then showed parcel info, a buy button if unpurchased, or the single next
   possible action with worker/resource dropdowns and a submit button that called
   `start_action_with_time`.

The current app replaces this whole mechanism with a real `<svg>` in React, rendering the same 54
`<path>` elements directly with native `onMouseEnter`/`onClick` handlers — see
`frontend/src/components/map/FarmMap.tsx` and `frontend/src/data/parcelPaths.ts`.

## Other legacy quirks worth remembering

- `logo.py` pointed at an externally-hosted GitHub image URL for the sidebar logo, instead of the
  local `assets/images/logo.png` that existed on disk.
- `pages/01_Plan.py` linked to a `pages/04_Ouvriers.py` workers-management page that was never
  actually created — a permanently broken nav link.
- `fire_worker`, `get_all_workers_status`, and `add_10k_usd` were each defined **twice** in
  `database_manager.py` (dead duplication, later occurrence would just shadow the earlier one).
- No auth, no per-user data, no `.env`/environment-based config, no automated tests, no DB
  migrations — `config.py` used plain relative paths (`"map/map.svg"`, `"farming_simulator.db"`),
  which only worked if the process's cwd happened to be the repo root.
- `Dashboard.py` only auto-ran `init_db()`/`populate_db()` if `farming_simulator.db` **did not
  exist at all** — since an empty 0-byte file had been present in the repo, this init path never
  actually ran in the checked-in state, meaning the "live" SQLite save was never truly seeded.

## Original product vision (never implemented, from the old README)

The original README documented forward-looking ideas that were never built in the Streamlit app.
Worth keeping in mind for future roadmap discussions:

- **Equipment customization** — upgrading owned vehicles/accessories to boost yields.
- **Contracts system** — a way to earn money by completing specific tasks/objectives, distinct
  from the regular buy→grow→sell loop.
- A dedicated, richer catalog page (partially achieved by the Shop page).

