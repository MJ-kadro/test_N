# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales dashboard web application for "Grupa Pracuj" that visualizes deal/sales metrics. Python processes CSV data into a JSON file; a static HTML/CSS/JS frontend renders it using Chart.js.

## Development Workflow

### Data Processing (Python)

```bash
# Activate virtualenv
source .venv/bin/activate

# Regenerate dashboard_data.json from CSV sources
python process_data.py
```

### Serve Frontend Locally

```bash
python -m http.server 8000
# Open http://localhost:8000
```

Chart.js is loaded from CDN — no build step needed for the frontend.

## Architecture

```
data/*.csv  →  process_data.py  →  dashboard_data.json  →  script.js  →  index.html
```

1. `process_data.py` reads `data/basic_data_*.csv` and `data/grade_data.csv`, computes 8 KPI metrics (deal value, MRR, win rate, pipeline, sales cycle, partner breakdown, industry breakdown, monthly trends), compares with previous week for WoW deltas, and writes `dashboard_data.json`.
2. `script.js` fetches `dashboard_data.json` on page load, populates the 5 KPI cards, and renders 3 Chart.js charts (line: monthly trends, pie: partners, bar: industry revenue).
3. `index.html` + `style.css` define the static layout (Polish-language UI, CSS grid, primary color `#0055ff`).

`dashboard_data.json` must be regenerated whenever source CSV files change — the frontend reads only the pre-built JSON.

## Key Details

- Python 3.11, dependencies: `pandas`, `numpy` only (no `requirements.txt` — install manually)
- No test suite exists
- No linting configuration exists
- All content is in Polish
- Deployed as static site on Netlify; Python preprocessing runs locally before deploy
