# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales dashboard for **Kadromierz × Grupa Pracuj** lead program. It visualizes the B2B sales pipeline where leads originate from Pracuj.pl and eRecruiter.

**Two audiences, two tabs:**
- **Sales Director tab** — executive KPIs, MRR, win rate, monthly trends, partner split
- **Sales Manager tab** — operational pipeline: funnel with stage conversion rates, lost analysis, full deal table

Python processes CSV exports from Pipedrive into `dashboard_data.json`; a static HTML/CSS/JS frontend renders it using Chart.js.

---

## Development Workflow

### Data Processing (Python)

```bash
source .venv/bin/activate
python process_data.py
```

The script picks up the most recent file matching `data/basic_data_*.csv` (sorted by filename date suffix, e.g. `basic_data_1304.csv` = 13 April).

### Serve Frontend Locally

```bash
python -m http.server 8000
# Open http://localhost:8000
```

Chart.js is loaded from CDN — no build step needed for the frontend.

---

## Architecture

```
data/basic_data_DDMM.csv  →  process_data.py  →  dashboard_data.json  →  script.js  →  index.html
```

1. `process_data.py` reads the latest `data/basic_data_*.csv`, computes all KPI metrics, and writes `dashboard_data.json`.
2. `script.js` fetches `dashboard_data.json` on page load and renders both dashboard tabs.
3. `index.html` + `style.css` define the two-tab layout (Polish-language UI).

`dashboard_data.json` must be regenerated whenever source CSV files change.

---

## Source Data — CSV Structure

**Primary file:** `data/basic_data_DDMM.csv` (exported from Pipedrive every Friday by 12:00)

| Column | Type | Notes |
|---|---|---|
| `Deal - ID` | int | Unique deal identifier |
| `Deal - Value` | float | Deal value — used as MRR (both potential and Won). Null/0 = no pricing yet |
| `Organization - MRR` | float | MRR at organization level (secondary, not used for KPI sums) |
| `Deal - Title` | string | Company / deal name |
| `Deal - Deal created` | date | Date added to pipeline |
| `Deal - Deal closed on` | date | Date closed (won or lost) |
| `Deal - Stage` | string | Funnel stage — see ordered list below |
| `Deal - Status` | string | `"open"`, `"won"`, `"lost"` |
| `Deal - Won time` | date/null | Timestamp of won |
| `Deal - Lost time` | date/null | Timestamp of lost |
| `Deal - Total activities` | int | Total logged activities on deal |
| `Deal - Organization` | string | Legal entity name |
| `Organization - Status konta` | string | Account status |
| `Deal - Nazwa Partnera` | string | `"Pracuj.pl"` or `"eRecruiter"` |
| `Deal - Lost reason` | string/null | Reason for loss — see values below |

**Columns removed vs previous version (do not reference):**
`Deal - MRR`, `Deal - Next activity date`, `Organization - Branża`, `Organization - Pakiet`, `Organization - Liczba userów`, `Organization - Spaceship link`

### MRR source — important
**All MRR calculations (Won MRR, Pipeline MRR Potential) must use `Deal - Value`, not any MRR column.**
- `Deal - Value` null or 0 → exclude from MRR sums, display as "—"

### Funnel stage order (`Deal - Stage`) — Sales Manager funnel
Only deals where `Deal - Status == "open"` appear in the funnel. Order:

1. Prospect
2. Lead
3. Follow up
4. Demo/Meeting
5. Blocked
6. Consideration
7. Trial
8. Contract negotiation

### Rejected deals (odrzucone) — special category
A **rejected deal** is defined as:
- `Deal - Stage == "Prospect"` AND
- `Deal - Status == "lost"` AND
- `Deal - Lost reason == "Już w kontakcie"`

These deals are NOT in the current CSV (they exist in the full Pipedrive database but are filtered out of the export). Their **count must be tracked separately** and displayed as a distinct metric. The count is provided as a manually maintained value or derived from a secondary source — do not attempt to compute it from the current CSV alone. Expose it as a configurable field in `dashboard_data.json` (`"rejected_deals_count"`).

### Known `Deal - Lost reason` values
- `"Już w kontakcie"` — already a customer / in contact (= rejected deal, see above)
- Other free-text reasons from Pipedrive (e.g. "Pozostał przy obecnym rozwiązaniu", "Brak funkcjonalności", "Brak kontaktu", "Osoba nie jest decyzyjna")

---

## process_data.py — Required Output (dashboard_data.json)

```json
{
  "generated_at": "2026-04-13T12:00:00",
  "report_date": "2026-04-13",
  "rejected_deals_count": 12,

  "director": {
    "kpis": {
      "mrr_won": 700.0,
      "mrr_won_delta": 0.0,
      "pipeline_mrr_potential": 29820.0,
      "pipeline_mrr_potential_delta": 5000.0,
      "win_rate": 9.1,
      "win_rate_delta": 0.5,
      "open_deals": 26,
      "open_deals_delta": 1,
      "rejected_deals_count": 12
    },
    "monthly_new_deals": [
      { "month": "2025-06", "pracuj": 1, "erecruiter": 0 }
    ],
    "cumulative_deals": [
      { "month": "2025-06", "total_created": 1, "total_won": 0, "total_lost": 0 }
    ],
    "partner_split": { "pracuj": 25, "erecruiter": 13 },
    "status_split": { "open": 26, "won": 1, "lost": 10 }
  },

  "manager": {
    "funnel_stages": [
      { "stage": "Prospect", "count": 2 },
      { "stage": "Lead", "count": 1 },
      { "stage": "Follow up", "count": 7 },
      { "stage": "Demo/Meeting", "count": 6 },
      { "stage": "Blocked", "count": 5 },
      { "stage": "Consideration", "count": 4 },
      { "stage": "Trial", "count": 0 },
      { "stage": "Contract negotiation", "count": 1 }
    ],
    "funnel_conversions": [
      { "from": "Prospect", "to": "Lead", "rate": 0.72 },
      { "from": "Lead", "to": "Follow up", "rate": 0.65 }
    ],
    "all_open_deals": [
      {
        "id": 88,
        "title": "Dla Spania",
        "partner": "Pracuj.pl",
        "stage": "Demo/Meeting",
        "status": "open",
        "value": 5000.0,
        "created": "2026-01-15",
        "total_activities": 9,
        "organization": "Dla Spania sieć sklepów"
      }
    ],
    "lost_deals": [
      {
        "id": 12,
        "title": "Eneris",
        "partner": "Pracuj.pl",
        "value": 5000.0,
        "lost_date": "2026-03-11",
        "stage_at_close": "Follow up",
        "lost_reason": "Pozostał przy obecnym rozwiązaniu"
      }
    ],
    "lost_reasons_summary": [
      { "reason": "Pozostał przy obecnym rozwiązaniu", "count": 4 },
      { "reason": "Już w kontakcie", "count": 12 },
      { "reason": "Brak funkcjonalności", "count": 2 }
    ],
    "total_activities_all": 156,
    "avg_activities_per_deal": 5.2
  }
}
```

---

## KPI Computation Rules

| Metric | Formula |
|---|---|
| `mrr_won` | `SUM(Deal - Value)` where `Deal - Status == "won"` |
| `pipeline_mrr_potential` | `SUM(Deal - Value)` where `Deal - Status == "open"` AND `Deal - Value > 0` |
| `win_rate` | `COUNT(won) / (COUNT(won) + COUNT(lost)) * 100` |
| `open_deals` | `COUNT` where `Deal - Status == "open"` |
| `rejected_deals_count` | Manually set in JSON — not computable from current CSV export |
| `cumulative_won` | Running total of `COUNT(won)` by month of `Deal - Won time` |
| `cumulative_lost` | Running total of `COUNT(lost)` by month of `Deal - Lost time` |
| `cumulative_created` | Running total of `COUNT(all deals)` by month of `Deal - Deal created` |
| `funnel_conversions` | For each consecutive stage pair: `COUNT(stage N+1) / COUNT(stage N)` — computed from all-time deal data, not just current open |

---

## Frontend — Tab 1: Sales Director

### Layout (top to bottom)

1. **Global partner filter** (sticky): All | Pracuj.pl | eRecruiter — filters all charts and tables on both tabs

2. **KPI strip** — 5 cards:
   - MRR Won (`mrr_won`) + WoW delta badge
   - Pipeline MRR Potential (`pipeline_mrr_potential`) + WoW delta badge
   - Win Rate % (`win_rate`) + WoW delta badge
   - Open Deals (`open_deals`) + WoW delta badge
   - Rejected Deals / Odrzucone (`rejected_deals_count`) — amber/warning color, tooltip explaining definition

3. **Charts row 1:**
   - Monthly new deals — stacked bar: Pracuj.pl (blue `#1a4a8a`) + eRecruiter (purple `#6b21a8`)
   - Partner split — donut: Pracuj.pl vs eRecruiter

4. **Charts row 2 — Cumulative deals (single chart, 3 lines):**
   - Line 1: Total deals created (all statuses) — dark/neutral color
   - Line 2: Cumulative Won — green `#1a7a4a`
   - Line 3: Cumulative Lost — red `#c0392b`
   - X axis: months; Y axis: count; legend visible

5. **Won / Lost / Open status donut**

---

## Frontend — Tab 2: Sales Manager

### Layout (top to bottom)

1. **Funnel — open deals only** (`Deal - Status == "open"`)
   - Horizontal bar chart (Chart.js, `indexAxis: 'y'`)
   - Stages in order: Prospect | Lead | Follow up | Demo/Meeting | Blocked | Consideration | Trial | Contract negotiation
   - Each bar shows deal count
   - Below each bar (or as annotation): conversion rate to next stage (from `funnel_conversions`)
   - Blocked stage bar: amber color `#b86b00`

2. **All open deals table** — "Wszystkie aktywne deale"
   - Source: `all_open_deals` (Status == "open" only)
   - Columns: Firma | Etap | Partner | Wartość (Deal - Value) | Data dodania | Liczba aktywności
   - **No Spaceship column**
   - Sortable by any column
   - Search/filter by company name
   - Row color coding: Blocked = amber tint, default = white

3. **Lost analysis** — "Analiza Lost"
   - Horizontal bar chart: lost reasons by count (from `lost_reasons_summary`)
   - Includes `"Już w kontakcie"` as a bar — label it "Odrzucone (już w kontakcie)"
   - **No lost MRR / utracony potencjał section** — removed
   - Section header: "Analiza Lost"

4. **Lost deals table** — "Lista Lost"
   - Source: `lost_deals`
   - Columns: Firma | Partner | Etap zamknięcia | Powód utraty | Data zamknięcia | Wartość
   - All lost deals, no filtering by default
   - Section header: "Lista Lost"

### Removed from Sales Manager tab (do not implement)
- "Wymagają Uwagi" section (Blocked alerts, Stale deals, Hot deals) — **out of scope**
- Spaceship column in any table
- Utracony potencjał MRR block

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

---

## Deployment (Netlify)

- Repo connected to Netlify; every push to `main` triggers a deploy
- **No build command** — static site, Netlify serves `index.html` directly
- `dashboard_data.json` is committed to the repo after each Friday's data processing run
- Python preprocessing runs **locally** before committing

### Friday update workflow
```bash
# 1. Drop new CSV into data/
cp ~/Downloads/basic_data_1304.csv data/

# 2. Regenerate JSON
source .venv/bin/activate
python process_data.py

# 3. Commit and push → Netlify auto-deploys
git add data/ dashboard_data.json
git commit -m "data: update 2026-04-13"
git push
```

---

## Key Constraints

- Python 3.11, dependencies: `pandas`, `numpy` only
- No test suite
- No linting configuration
- All UI content in Polish
- Chart.js loaded from CDN (`cdnjs.cloudflare.com`)
- No backend — `dashboard_data.json` is the only data contract between Python and JS
- `Deal - Value` null or 0 → exclude from MRR sums, display as "—"
- `Organization - Status konta` null → display as "—"
- Report switching between weeks — **out of scope for v1**, will be added in next iteration