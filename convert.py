"""
Kadromierz × Pracuj — Pipeline Dashboard
Obliczanie delt KPI między dwoma ostatnimi raportami + Alerty GP.

Porównuje 2 ostatnie pliki basic_data_*.json i aktualizuje
dashboard_data.json o:
  1. WoW delty 6 metryk KPI (MRR Won, Pipeline MRR, Win Rate, ...)
  2. Alerty GP — 6 kategorii zdarzeń między raportami

Wymagania: process_data.py musi być uruchomiony wcześniej.

Użycie:
    python convert.py            # z pobieraniem aktywności przez API
    python convert.py --no-api   # bez API (tylko cache lokalny)
"""
import json
import glob
import math
import os
import re
import sys
from datetime import datetime


def calc_kpis_from_records(records):
    """Oblicza snapshot KPI z listy surowych rekordów dealów."""
    won = [r for r in records if (r.get('Deal - Status') or '').lower() == 'won']
    lost = [r for r in records if (r.get('Deal - Status') or '').lower() == 'lost']
    open_ = [r for r in records if (r.get('Deal - Status') or '').lower() == 'open']

    rejected = [r for r in lost if (r.get('Deal - Lost reason') or '').strip() == 'Duplikat']
    lost_qualified = [r for r in lost if (r.get('Deal - Lost reason') or '').strip() != 'Duplikat']

    def val(r):
        v = r.get('Deal - Value') or 0
        try:
            f = float(v)
            return 0 if math.isnan(f) else f
        except (TypeError, ValueError):
            return 0

    mrr_won = round(sum(val(r) for r in won), 2)
    mrr_pipeline = round(sum(val(r) for r in open_ if val(r) > 0), 2)
    denom = len(won) + len(lost_qualified)
    win_rate = round(len(won) / denom * 100, 1) if denom > 0 else 0.0
    open_deals = len(open_)
    rejected_count = len(rejected)

    def parse_date(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(str(s)[:10])
        except (ValueError, TypeError):
            return None

    days_list = []
    for r in won:
        created = parse_date(r.get('Deal - Deal created'))
        closed = parse_date(r.get('Deal - Deal closed on'))
        if created and closed:
            days_list.append((closed - created).days)

    if days_list:
        days_list.sort()
        n = len(days_list)
        median_days = days_list[n // 2] if n % 2 == 1 else (days_list[n // 2 - 1] + days_list[n // 2]) // 2
    else:
        median_days = None

    return {
        'mrr_won': mrr_won,
        'pipeline_mrr_potential': mrr_pipeline,
        'win_rate': win_rate,
        'open_deals': open_deals,
        'rejected_deals_count': rejected_count,
        'median_days_to_close': median_days,
    }


def _ddmm_to_date(ddmm: str) -> str:
    """'1004' → '2026-04-10', '0304' → '2026-04-03'"""
    dd, mm = ddmm[:2], ddmm[2:4]
    year = datetime.now().year
    return f'{year}-{mm}-{dd}'


def run_convert():
    use_api = '--no-api' not in sys.argv

    json_files = sorted(glob.glob('data/basic_data_*.json'))
    if len(json_files) < 2:
        print(f'Potrzebne co najmniej 2 pliki JSON (znaleziono {len(json_files)}).')
        print('Delty nie zostaną obliczone — dashboard_data.json pozostaje bez zmian.')
        return

    latest_path = json_files[-1]
    prev_path = json_files[-2]

    print(f'Porównuję:')
    print(f'  Aktualny:  {latest_path}')
    print(f'  Poprzedni: {prev_path}')

    # Wyznacz daty raportów z nazw plików (basic_data_DDMM.json)
    m_curr = re.search(r'basic_data_(\d{4})\.json$', latest_path)
    m_prev = re.search(r'basic_data_(\d{4})\.json$', prev_path)
    curr_date_str = _ddmm_to_date(m_curr.group(1)) if m_curr else datetime.now().strftime('%Y-%m-%d')
    prev_date_str = _ddmm_to_date(m_prev.group(1)) if m_prev else curr_date_str
    print(f'  Data bieżąca:    {curr_date_str}')
    print(f'  Data poprzednia: {prev_date_str}')

    with open(latest_path, encoding='utf-8') as f:
        latest_records = json.load(f)
    with open(prev_path, encoding='utf-8') as f:
        prev_records = json.load(f)

    kpis_now = calc_kpis_from_records(latest_records)
    kpis_prev = calc_kpis_from_records(prev_records)

    def delta_float(key, decimals=2):
        now, prev = kpis_now[key], kpis_prev[key]
        if now is None or prev is None:
            return None
        return round(now - prev, decimals)

    def delta_int(key):
        now, prev = kpis_now[key], kpis_prev[key]
        if now is None or prev is None:
            return None
        return int(now - prev)

    deltas = {
        'mrr_won_delta': delta_float('mrr_won', 2),
        'pipeline_mrr_potential_delta': delta_float('pipeline_mrr_potential', 2),
        'win_rate_delta': delta_float('win_rate', 1),
        'open_deals_delta': delta_int('open_deals'),
        'rejected_deals_count_delta': delta_int('rejected_deals_count'),
        'median_days_to_close_delta': delta_int('median_days_to_close'),
    }

    with open('dashboard_data.json', encoding='utf-8') as f:
        dashboard = json.load(f)

    kpis = dashboard['director']['kpis']
    for key, value in deltas.items():
        kpis[key] = value

    # ── Alerty GP ────────────────────────────────────────────────────────────
    print('\n=== Krok 2: Obliczanie alertów GP ===')
    try:
        from task_api import compute_all_gp_alerts
        gp_alerts = compute_all_gp_alerts(
            latest_records,
            prev_records,
            prev_date_str,
            curr_date_str,
            fetch_api=use_api,
        )
    except Exception as e:
        print(f'  UWAGA: Obliczanie alertów GP nie powiodło się: {e}')
        gp_alerts = {
            'prev_report_date':    prev_date_str,
            'current_report_date': curr_date_str,
            'lead_confirmed':      [],
            'meeting_scheduled':   [],
            'trial_started':       [],
            'no_contact':          [],
            'rejected':            [],
            'deal_closed':         [],
            'error':               str(e),
        }

    # ── Zapis ────────────────────────────────────────────────────────────────
    dashboard['manager']['gp_alerts'] = gp_alerts

    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)

    print('\n=== Podsumowanie ===')
    print('Delty KPI:')
    labels = {
        'mrr_won': 'MRR Won',
        'pipeline_mrr_potential': 'Pipeline MRR Potential',
        'win_rate': 'Win Rate (%)',
        'open_deals': 'Aktywny Pipeline',
        'rejected_deals_count': 'Odrzucone deale',
        'median_days_to_close': 'Mediana czasu zamknięcia (dni)',
    }
    for metric, label in labels.items():
        delta_key = f'{metric}_delta'
        prev_val = kpis_prev[metric]
        now_val = kpis_now[metric]
        d = deltas[delta_key]
        sign = '+' if (d is not None and d > 0) else ''
        print(f'  {label}: {prev_val} → {now_val}  (Δ {sign}{d})')

    print('\ndashboard_data.json zaktualizowany (delty KPI + alerty GP).')


if __name__ == '__main__':
    run_convert()
