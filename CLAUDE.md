# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales dashboard for **Kadromierz × Grupa Pracuj** lead program. It visualizes the B2B sales pipeline where leads originate from Pracuj.pl and eRecruiter.

**Two audiences, two tabs:**
- **Sales Director tab** — executive KPIs, MRR, win rate, monthly trends, partner split, tables of rejected / referred / won / lost deals
- **Sales Manager tab** — operational pipeline: GP status-flow alerts, full deal table (with referrer filter), funnel, monthly/funnel charts, Lost and Won lists

Python processes CSV exports from Pipedrive into a set of per-report JSON files plus an aggregated `dashboard_data.json`; a static HTML/CSS/JS frontend renders it using Chart.js. The frontend loads the raw per-report JSON directly and only reads `dashboard_data.json` for GP alerts.

---

## Repository Layout

```
netlify/
├── index.html                     # page shell: auth overlay, two tabs, partner filter
├── style.css                      # styles
├── script_director.js             # shared globals + Sales Director tab logic
├── script_manager.js              # Sales Manager tab logic (requires script_director.js first)
├── script.js                      # LEGACY monolithic JS — not loaded by index.html, kept as reference
├── process_data.py                # main pipeline: CSVs → per-report JSONs + manifest + dashboard_data.json
├── convert.py                     # fills WoW KPI deltas + recomputes GP alerts in dashboard_data.json
├── task_api.py                    # Pipedrive REST client for activities + GP-alert computation helpers
├── dashboard_data.json            # aggregate output (KPIs, deltas, gp_alerts)
├── data/
│   ├── basic_data_DDMM.csv        # raw weekly export from Pipedrive
│   ├── basic_data_DDMM.json       # same, converted to JSON records (primary frontend data source)
│   ├── manifest.json              # { files: [{name, date}] } — sorted list of reports
│   └── activities_cache.json      # cache of Pipedrive activities keyed by deal_id
└── CLAUDE.md                      # this file
```

---

## Development Workflow

### Data processing (Python)

```bash
source .venv/bin/activate
python process_data.py     # Step 1: CSVs → JSONs, manifest, dashboard_data.json (deltas = 0)
python convert.py          # Step 2: compute KPI deltas and GP alerts between last 2 reports
# python convert.py --no-api   # skip Pipedrive API calls; use activities_cache.json only
```

`process_data.py` always regenerates the JSON twin of every `data/basic_data_*.csv`. It then picks the newest one as the "current" report (files sorted lexicographically; the `DDMM` suffix encodes day-month, e.g. `basic_data_1604.csv` = 16 April).

### Serve frontend locally

```bash
python -m http.server 8000
# Open http://localhost:8000
```

Chart.js is loaded from jsDelivr CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.0/...`). No build step.

---

## Architecture / Data Flow

```
data/basic_data_DDMM.csv ──┐
                           │ process_data.py
                           ├──► data/basic_data_DDMM.json
                           ├──► data/manifest.json
                           └──► dashboard_data.json (KPIs, gp_alerts, deltas=0)
                                         ▲
                                         │ convert.py (uses 2 newest JSONs + task_api.py)
                                         │  - fills director.kpis.*_delta
                                         │  - overwrites manager.gp_alerts
                                         └── final dashboard_data.json

Frontend (browser):
  fetch data/manifest.json            → pick newest + previous report
  fetch data/basic_data_<curr>.json   → state.current (primary data)
  fetch data/basic_data_<prev>.json   → state.prev    (for WoW comparisons, optional)
  fetch dashboard_data.json           → state.gpAlerts (manager.gp_alerts only)
  render ← script_director.js + script_manager.js
```

Key implication: **the frontend re-derives most KPIs/charts client-side from the raw per-report JSON**, not from `dashboard_data.json`. `dashboard_data.json` is still committed and is the canonical source for `gp_alerts` (and a machine-readable KPI snapshot with deltas).

---

## Source Data — CSV Structure

**Primary file:** `data/basic_data_DDMM.csv` (exported from Pipedrive, typically Friday)

Actual columns observed in current exports:

| Column | Type | Notes |
|---|---|---|
| `Deal - ID` | int | Unique deal identifier |
| `Deal - Value` | float | Used as MRR (both potential and Won). Null/0 → excluded from MRR sums, displayed as "—" |
| `Organization - MRR` | float | Present but not used for KPI math — MRR comes from `Deal - Value` |
| `Deal - Title` | string | Company / deal name |
| `Deal - Deal created` | datetime | Date added to pipeline |
| `Deal - Deal closed on` | datetime | Date closed (won or lost) |
| `Deal - Stage` | string | Funnel stage — see list below; `"Success"` appears for closed-won |
| `Deal - Status` | string | `"Open"`, `"Won"`, `"Lost"` (case-insensitive in code) |
| `Deal - Total activities` | int | Total logged activities on deal |
| `Deal - Organization` | string | Legal entity name |
| `Deal - Nazwa Partnera` | string | `"Pracuj.pl"` or `"eRecruiter"` |
| `Deal - Lost reason` | string/null | See values below |
| `Organization - Branża` | string/null | Industry (used in open-deals table) |
| `Deal - Adres e-mail polecającego` | string/null | Referring salesperson email — used for "Deale polecone" and the referrer multi-select filter |

Columns referenced by older docs but **not** present in current exports: `Deal - Won time`, `Deal - Lost time`, `Organization - Status konta`. The `Organization - Spaceship link` column is referenced optionally by `process_data.calc_gp_alerts` but absent from current CSVs, so the `trial_started` GP alert stays empty.

### MRR source
All MRR calculations (Won MRR, Pipeline MRR Potential) use `Deal - Value`.
- `Deal - Value` null or 0 → excluded from MRR sums and displayed as "—".

### Funnel stages (`Deal - Stage`)
Open-deal funnel (Sales Manager tab), ordered:

1. Prospect
2. Lead
3. Follow up
4. Demo/Meeting
5. Blocked
6. Consideration
7. Trial
8. Contract negotiation

`Success` is a closed-won stage (appears in `won_deals[].stage_at_close`) — it is **not** part of the open funnel.

### Rejected deals (odrzucone) — how it's actually defined in code
A **rejected deal** = `Deal - Status == "lost"` **AND** `Deal - Lost reason == "Duplikat"`.

This is what `process_data.calc_snapshot` and `convert.calc_kpis_from_records` both count as `rejected_deals_count`, and what the Manager tab labels as "Odrzucone (duplikat)" in the lost-by-reason chart.

> Note: earlier drafts of this doc defined rejected as `Prospect + lost + "Już w kontakcie"`. That does **not** match the code; the current implementation uses the `Duplikat` rule above.

### Lost reasons used for GP alerts
`process_data.py` and `task_api.py` treat the following set as "rejection / no interest" for the `rejected` GP-alert bucket:

```
REJECTION_LOST_REASONS = {
    'Pozostał przy obecnym rozwiązaniu',
    'Zastał przy obecnym rozwiązaniu',
    'Brak decyzji',
}
```

Other free-text reasons (e.g. `"Brak funkcjonalności"`, `"Brak kontaktu"`, `"Osoba nie jest decyzyjna"`, `"Już w kontakcie"`) appear in Pipedrive and are grouped in the Lost-by-reason chart as their own bars. `"Duplikat"` is relabelled on the UI as `"Odrzucone (duplikat)"`.

---

## `dashboard_data.json` — Actual Schema

```json
{
  "generated_at": "2026-04-16T15:55:59",
  "report_date": "2026-04-16",

  "director": {
    "kpis": {
      "mrr_won": 700.0,
      "mrr_won_delta": 0.0,
      "pipeline_mrr_potential": 26242.46,
      "pipeline_mrr_potential_delta": -1600.0,
      "win_rate": 5.0,
      "win_rate_delta": -0.3,
      "open_deals": 27,
      "open_deals_delta": 1,
      "rejected_deals_count": 4,
      "rejected_deals_count_delta": 0,
      "median_days_to_close": 94,
      "median_days_to_close_delta": 0
    },
    "monthly_new_deals": [
      { "month": "2025-06", "pracuj": 1, "erecruiter": 0 }
    ],
    "cumulative_deals": [
      { "month": "2025-06", "total_created": 2, "total_won": 0, "total_lost": 0 }
    ],
    "partner_split": { "pracuj": 36, "erecruiter": 15 },
    "status_split": { "open": 27, "won": 1, "lost": 23 }
  },

  "manager": {
    "funnel_stages": [
      { "stage": "Prospect", "count": 3 },
      { "stage": "Lead", "count": 3 }
    ],
    "all_open_deals": [
      {
        "id": 23645,
        "title": "Destigo Hotels",
        "partner": "Pracuj.pl",
        "stage": "Blocked",
        "status": "open",
        "value": 10000.0,
        "created": "2025-07-03",
        "total_activities": 18,
        "organization": "Destigo Hotels",
        "branża": "Hotele"
      }
    ],
    "won_deals": [
      {
        "id": 26057,
        "title": "Deal Art Suites",
        "partner": "Pracuj.pl",
        "value": 700.0,
        "won_date": "2026-02-02",
        "stage_at_close": "Success",
        "days_to_close": 94
      }
    ],
    "lost_deals": [
      {
        "id": 850,
        "title": "Hotel Monopol Wrocław deal",
        "partner": "Pracuj.pl",
        "value": 1300.0,
        "lost_date": "2026-03-02",
        "stage_at_close": "Consideration",
        "lost_reason": "Brak decyzji"
      }
    ],
    "lost_reasons_summary": [
      { "reason": "Brak decyzji", "count": 7 }
    ],
    "gp_alerts": {
      "prev_report_date": "2026-04-10",
      "current_report_date": "2026-04-16",
      "lead_confirmed":    [ /* {id,title,partner,stage,date} */ ],
      "meeting_scheduled": [ /* {id,title,partner,stage,date} */ ],
      "trial_started":     [ /* {id,title,partner,stage,spaceship_link,date} */ ],
      "no_contact":        [ /* {id,title,partner,stage,date,call_count} */ ],
      "rejected":          [ /* {id,title,partner,stage,lost_reason,date} */ ],
      "deal_closed":       [ /* {id,title,partner,status,lost_reason,date} */ ]
    }
  }
}
```

Things the earlier spec mentioned but are **not** emitted today: top-level `rejected_deals_count`, `director.kpis.funnel_conversions` (no such field — frontend computes funnel purely from per-report JSON), `manager.total_activities_all`, `manager.avg_activities_per_deal`, `manager.funnel_conversions`.

---

## KPI Computation Rules (as implemented)

Both `process_data.calc_snapshot` and `convert.calc_kpis_from_records` implement the same formulas, so WoW deltas use consistent math.

| Metric | Formula |
|---|---|
| `mrr_won` | `SUM(Deal - Value)` where `Deal - Status == "won"` |
| `pipeline_mrr_potential` | `SUM(Deal - Value)` where `Deal - Status == "open"` AND `Deal - Value > 0` |
| `win_rate` | `COUNT(won) / (COUNT(won) + COUNT(lost where Lost reason != "Duplikat")) * 100` — `Duplikat` rows are excluded from the denominator |
| `open_deals` | `COUNT` where `Deal - Status == "open"` |
| `rejected_deals_count` | `COUNT` where `Deal - Status == "lost"` AND `Deal - Lost reason == "Duplikat"` |
| `median_days_to_close` | Median of `(Deal - Deal closed on - Deal - Deal created)` in days, over Won deals with both dates present |
| `monthly_new_deals[month]` | Grouped by `Deal - Deal created` month; split by `Deal - Nazwa Partnera` (`pracuj` / `erecruiter`) |
| `cumulative_deals[month]` | Running totals: `total_created` by `Deal - Deal created`, `total_won`/`total_lost` by `Deal - Deal closed on` |
| `partner_split` | Counts of `Deal - Nazwa Partnera` values |
| `status_split` | Counts of `Deal - Status` values |
| `*_delta` | `convert.py`: `current - previous` computed from the two newest `data/basic_data_*.json` files |

Funnel and lost-by-reason visuals are recomputed client-side from the raw per-report JSON — there is no `funnel_conversions` array in `dashboard_data.json`.

---

## GP Status-Flow Alerts

Computed between the two newest reports (`prev_date` → `current_date`). Six buckets, emitted in `manager.gp_alerts`:

1. **`lead_confirmed`** — deal created in the period, currently `open`, stage ≠ `Prospect`.
2. **`meeting_scheduled`** — Pipedrive activity with `subject` containing `"Online Prezentacja"` added in the period.
3. **`trial_started`** — `Organization - Spaceship link` was empty in the previous report and is filled now. (Requires the column; stays empty in current exports.)
4. **`no_contact`** — the last three dated activities on a deal are all `type == "call"` and the most recent one falls in the period.
5. **`rejected`** — `Deal - Status == "lost"` AND `Deal - Lost reason` ∈ `REJECTION_LOST_REASONS` AND closed in the period.
6. **`deal_closed`** — any `won`/`lost` closed in the period, excluding `Lost reason == "Duplikat"`.

`task_api.py` handles Pipedrive REST fetches for activities (paged, with rate limit and local cache in `data/activities_cache.json`). `convert.py` calls `task_api.compute_all_gp_alerts(...)`; `process_data.py` has an older copy of the same logic via `calc_gp_alerts`.

> Security note: `PIPEDRIVE_API_TOKEN` is currently hard-coded at the top of `task_api.py`. Do not commit a new token to a public fork — move it to an env var / `.env` on next refactor.

---

## Frontend

### Auth overlay
`index.html` shows an `#auth-overlay` password gate before loading data. The check is client-side only (`setupAuth` in `script_director.js`); success is stored in `sessionStorage.kp_ok`. Do not treat this as real authentication — the page and data are public once deployed.

### Partner filter (sticky, both tabs)
`All | Pracuj.pl | eRecruiter` — filters every chart and table on both tabs by `Deal - Nazwa Partnera`.

### Tab 1: Sales Director (`#view-director`)

Top-to-bottom:

1. AI summary placeholder (`#ai-summary-director`) and a callout box (`#callout-box`, shown on load errors).
2. **KPI strip** (`#kpi-strip`) — cards with WoW delta badges. Includes (at minimum): MRR Won, Pipeline MRR Potential, Win Rate, Open Deals, Rejected Deals (Odrzucone), Median days to close.
3. **Trendy** section with two chart cards side by side:
   - `#chart-monthly` — monthly new deals, stacked bar by partner (Pracuj.pl `#1a4a8a`, eRecruiter `#6b21a8`).
   - `#chart-cumulative` — cumulative deals: 3 lines (created / won / lost).
4. **Donuts + right-side tables**:
   - `#chart-partner-split` — Pracuj.pl vs eRecruiter donut.
   - `#chart-status-split` — Open / Won / Lost donut.
   - Right panels: "Deale odrzucone", "Deale polecone" (filtered by `Deal - Adres e-mail polecającego`), "Wygrane deale".
5. **Przegrane deale** full-width card.

### Tab 2: Sales Manager (`#view-manager`)

Top-to-bottom:

1. AI summary placeholder (`#ai-summary-manager`).
2. **"Zmiany w programie partnerskim"** — renders `manager.gp_alerts` grouped by category.
3. **"Wszystkie deale"** table:
   - Search by company name.
   - Toggle "Pokaż wszystkie (z Won/Lost)" (default: open-only).
   - **Referrer multi-select pills** driven by `Deal - Adres e-mail polecającego`.
   - Columns include company, stage, partner, value, created date, activities, referring salesperson email.
4. **Wykresy** — 4 chart cards:
   - `#chart-manager-monthly` — deals per month.
   - `#chart-funnel` — horizontal bar funnel; "Blocked" bar colored `#b86b00`; title shows live count; ⓘ popup uses `FUNNEL_DESC` (stage tooltips).
   - `#chart-lost-stage` — horizontal bar of lost reasons; `"Duplikat"` relabelled to `"Odrzucone (duplikat)"`.
   - `#chart-cumulative-funnel` — cumulative funnel chart.
5. **Lista Lost** — full lost-deals table.
6. **Wygrane deale** — full won-deals table.

### Data source for the frontend
`loadDefaultData()` in `script_director.js`:
1. `fetch('data/manifest.json')`
2. Load the two newest `data/basic_data_*.json` files referenced there into `state.current` / `state.prev`.
3. `fetch('dashboard_data.json')` → pull only `manager.gp_alerts` into `state.gpAlerts`.
4. Render.

If any fetch fails, `#callout-box` shows a warning suggesting `python convert.py`.

---

## Color System

| Meaning | Hex |
|---|---|
| Pracuj.pl | `#1a4a8a` |
| eRecruiter | `#6b21a8` |
| Won / positive | `#1a7a4a` |
| Lost / negative | `#c0392b` |
| Blocked / warning | `#b86b00` |
| Rejected / odrzucone | `#b86b00` (amber, same as warning) |
| Open / neutral | `#1a4a8a` |
| Primary UI | `#0055ff` |

Defined in `script_director.js` as `PARTNER_COLORS` and `STATUS_COLORS`.

---

## Deployment (Netlify)

- Repo connected to Netlify; every push to `main` triggers a deploy.
- **No build command** — static site; Netlify serves `index.html` directly.
- All `data/basic_data_*.json`, `data/manifest.json`, and `dashboard_data.json` are committed after each Friday data-processing run.
- Python preprocessing runs **locally** before committing.

### Friday update workflow
```bash
# 1. Drop new CSV into data/
cp ~/Downloads/basic_data_DDMM.csv data/

# 2. Regenerate per-report JSONs, manifest, and dashboard_data.json
source .venv/bin/activate
python process_data.py

# 3. Fill KPI deltas and GP alerts (needs Pipedrive API token)
python convert.py
# or: python convert.py --no-api    # rely on data/activities_cache.json only

# 4. Commit and push → Netlify auto-deploys
git add data/ dashboard_data.json
git commit -m "data: update YYYY-MM-DD"
git push
```

---

## Key Constraints

- Python 3.11, dependencies: `pandas`, `numpy` (+ stdlib `urllib` in `task_api.py`).
- No test suite, no linting config.
- All UI content in Polish.
- Chart.js loaded from jsDelivr CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.0`).
- No backend; the per-report JSON files plus `dashboard_data.json` are the only data contracts between Python and JS.
- `Deal - Value` null or 0 → excluded from MRR sums, displayed as "—".
- Auth overlay is client-side only — **not** a real security boundary.
- `PIPEDRIVE_API_TOKEN` is currently hard-coded in `task_api.py` — relocate before open-sourcing.
- `script.js` (legacy) is not loaded by `index.html`; only `script_director.js` + `script_manager.js` are.
- Report switching between historical weeks is not wired into the UI yet — `state.current` / `state.prev` are always the two newest reports from `manifest.json`.
