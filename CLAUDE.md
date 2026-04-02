# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales dashboard for **Kadromierz × Grupa Pracuj** lead program. It visualizes the B2B sales pipeline where leads originate from Pracuj.pl and eRecruiter.

**Two audiences, two tabs:**
- **Sales Director tab** — executive KPIs, MRR, win rate, monthly trends, partner split
- **Sales Manager tab** — operational pipeline: funnel, full deal table, lost analysis

Python processes CSV exports from Pipedrive into `dashboard_data.json`; a static HTML/CSS/JS frontend renders it using Chart.js.

---

## Development Workflow

### Data Processing (Python)

```bash
# Activate virtualenv
source .venv/bin/activate

# Regenerate dashboard_data.json from the latest CSV
python process_data.py
```

The script picks up the most recent file matching `data/basic_data_*.csv` (sorted by filename date suffix, e.g. `basic_data_0504.csv`).

### Serve Frontend Locally

```bash
python -m http.server 8000
# Open http://localhost:8000
```

Chart.js is loaded from CDN — no build step needed for the frontend.

---

## Architecture

```
data/basic_data_DDMM.csv
data/grade_data.csv          →  process_data.py  →  dashboard_data.json  →  script.js  →  index.html
data/basic_data_DDMM_prev.csv (optional, for WoW delta)
```

1. `process_data.py` reads the latest `data/basic_data_*.csv` (and optionally the previous week's file for delta), computes all KPI metrics, and writes `dashboard_data.json`.
2. `script.js` fetches `dashboard_data.json` on page load, renders both dashboard tabs.
3. `index.html` + `style.css` define the two-tab layout (Polish-language UI).

`dashboard_data.json` must be regenerated whenever source CSV files change.

---

## Source Data — CSV Structure

**Primary file:** `data/basic_data_DDMM.csv` (exported from Pipedrive every Friday by 12:00)

| Column | Type | Notes |
|---|---|---|
| `Deal - ID` | int | Unique deal identifier |
| `Deal - Title` | string | Company / deal name |
| `Deal - MRR` | int | Monthly recurring revenue (0 or null = no pricing yet) |
| `Deal - Value` | float | Total deal value |
| `Organization - MRR` | float | MRR at organization level |
| `Deal - Deal created` | date | Date added to pipeline |
| `Deal - Deal closed on` | date | Date closed (won or lost) |
| `Deal - Stage` | string | Funnel stage — see ordered list below |
| `Deal - Status` | string | `"open"`, `"won"`, `"lost"` |
| `Deal - Next activity date` | date/null | Next scheduled task in Pipedrive |
| `Deal - Won time` | date/null | Timestamp of won |
| `Deal - Lost time` | date/null | Timestamp of lost |
| `Deal - Total activities` | int | Total logged activities on deal |
| `Deal - Organization` | string | Legal entity name |
| `Organization - Status konta` | string | Account status |
| `Organization - Pakiet` | string | Subscription package |
| `Organization - Liczba userów` | float | Number of users |
| `Organization - Branża` | string | Industry (may be null → display as "—") |
| `Deal - Nazwa Partnera` | string | `"Pracuj.pl"` or `"eRecruiter"` |

**Funnel stage order** (`Deal - Stage`):
1. Lead
2. Prospect
3. Follow up
4. Consideration
5. Demo/Meeting
6. Blocked ← special status: deal is stalled
7. Contract negotiation
8. Won (status = won)
9. Lost (status = lost)

**Note on Blocked:** Treat `Blocked` as a separate funnel category. A deal tagged Blocked is stalled regardless of its previous stage.

---

## process_data.py — Required Output (dashboard_data.json)

The script must compute and output the following structure:

```json
{
  "generated_at": "2026-04-05T12:00:00",
  "report_date": "2026-04-04",
  "previous_report_date": "2026-03-28",

  "director": {
    "kpis": {
      "mrr_won": 700,
      "mrr_won_delta": 0,
      "pipeline_mrr_potential": 29820,
      "pipeline_mrr_potential_delta": 5000,
      "win_rate": 9.1,
      "win_rate_delta": 0.5,
      "open_deals": 26,
      "open_deals_delta": 8
    },
    "monthly_new_deals": [
      { "month": "2025-06", "pracuj": 1, "erecruiter": 0 },
      { "month": "2025-07", "pracuj": 4, "erecruiter": 0 }
    ],
    "cumulative_deals": [
      { "month": "2025-06", "total": 1 },
      { "month": "2025-07", "total": 5 }
    ],
    "partner_split": { "pracuj": 25, "erecruiter": 13 },
    "status_split": { "open": 26, "won": 1, "lost": 10 },
    "delta_new_deals": [
      { "id": 123, "title": "Circle K Polska", "partner": "Pracuj.pl", "stage": "Follow up", "created": "2026-03-17" }
    ],
    "delta_closed_deals": [
      { "id": 99, "title": "Eneris", "partner": "Pracuj.pl", "status": "lost", "mrr": 5000, "closed": "2026-03-11" }
    ]
  },

  "manager": {
    "funnel_stages": [
      { "stage": "Lead", "count": 1 },
      { "stage": "Prospect", "count": 2 },
      { "stage": "Follow up", "count": 7 },
      { "stage": "Consideration", "count": 4 },
      { "stage": "Demo/Meeting", "count": 6 },
      { "stage": "Blocked", "count": 5 },
      { "stage": "Contract negotiation", "count": 1 }
    ],
    "blocked_deals": [
      {
        "id": 45,
        "title": "Destigo Hotels",
        "partner": "Pracuj.pl",
        "mrr": 10000,
        "days_in_pipeline": 87,
        "next_activity_date": null,
        "total_activities": 6,
        "industry": "Hotele"
      }
    ],
    "stale_deals": [
      {
        "id": 67,
        "title": "Sky Bowling",
        "partner": "Pracuj.pl",
        "stage": "Blocked",
        "mrr": 1600,
        "days_since_activity": 45,
        "next_activity_date": null
      }
    ],
    "hot_deals": [
      {
        "id": 88,
        "title": "Dla Spania",
        "partner": "Pracuj.pl",
        "stage": "Demo/Meeting",
        "mrr": 5000,
        "next_activity_date": "2026-04-07",
        "total_activities": 9
      }
    ],
    "all_open_deals": [ ],
    "lost_deals": [
      {
        "id": 12,
        "title": "Eneris",
        "partner": "Pracuj.pl",
        "mrr": 5000,
        "lost_date": "2026-03-11",
        "stage_at_close": "Follow up"
      }
    ],
    "lost_mrr_total": 23224,
    "total_activities_all": 156,
    "avg_activities_per_deal": 5.2
  }
}
```

---

## KPI Computation Rules

| Metric | Formula |
|---|---|
| `mrr_won` | `SUM(Deal - MRR)` where `Deal - Status == "won"` |
| `pipeline_mrr_potential` | `SUM(Deal - MRR)` where `Deal - Status == "open"` AND `Deal - MRR > 0` |
| `win_rate` | `COUNT(won) / (COUNT(won) + COUNT(lost)) * 100` |
| `open_deals` | `COUNT` where `Deal - Status == "open"` |
| `days_in_pipeline` | `today - Deal - Deal created` (in days) |
| `days_since_activity` | today minus last known activity date; if `Next activity date` is null and no activity logged → flag as stale |
| **Stale threshold** | No next activity date OR next activity date < today |
| **Delta fields** | Compare current CSV vs previous week's CSV (previous file = `data/basic_data_*` sorted by date, second most recent) |

---

## Frontend — Tab Structure

### Tab 1: Sales Director

1. **Global partner filter** (sticky): All | Pracuj.pl | eRecruiter — filters all charts and tables on both tabs
2. **KPI strip** (4 cards): MRR Won | Pipeline MRR Potential | Win Rate | Open Deals — each with WoW delta badge
3. **Charts row 1**: Monthly new deals stacked bar (Pracuj.pl + eRecruiter) | Cumulative deals line chart
4. **Charts row 2**: Partner split donut | Won/Lost/Open status donut
5. **Delta section** (visible only if previous week data exists): new deals table + closed deals table
6. **Auto-generated callout text** summarizing the period

### Tab 2: Sales Manager

1. **Visual funnel** — horizontal bars per stage, clickable → filters deal table below
2. **Alert panels** (priority order):
   - 🟡 **Blocked deals** — sorted by days in pipeline descending; show: company, partner, MRR, days blocked, next activity
   - 🔴 **Stale deals** — no next activity / overdue; show: company, stage, partner, days without activity
   - 🟢 **Hot deals** — Demo/Meeting + Contract negotiation; show: company, stage, MRR, next activity date
3. **Full deal table** — all open deals, sortable by any column, searchable by company name; toggle to show Won/Lost too; row color coding: Blocked=amber, stale=red tint, Won=green tint
4. **Lost analysis**: horizontal bar chart of lost reasons (if field available) + lost MRR total + lost deals table

---

## Color System

| Meaning | Hex |
|---|---|
| Pracuj.pl | `#1a4a8a` |
| eRecruiter | `#6b21a8` |
| Won / positive | `#1a7a4a` |
| Lost / negative | `#c0392b` |
| Blocked / warning | `#b86b00` |
| Open / neutral | `#1a4a8a` |
| Primary UI | `#0055ff` (existing) |

---

## Deployment (Netlify)

- Repo connected to Netlify; every push to `main` triggers a deploy
- **No build command** — static site, Netlify serves `index.html` directly
- `dashboard_data.json` is committed to the repo after each Friday's data processing run
- Python preprocessing runs **locally** before committing

### Friday update workflow
```bash
# 1. Drop new CSV into data/
cp ~/Downloads/basic_data_0504.csv data/

# 2. Regenerate JSON
source .venv/bin/activate
python process_data.py

# 3. Commit and push → Netlify auto-deploys
git add data/ dashboard_data.json
git commit -m "data: update week 2026-04-04"
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
- `Deal - MRR` null or 0 → exclude from all MRR sums, display as "—"
- `Organization - Branża` null → display as "—"
- `Deal - Next activity date` null → display as "Brak zadania" with red alert indicator