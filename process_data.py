"""
Kadromierz × Pracuj — Pipeline Dashboard
Przetwarzanie danych źródłowych.

Kroki:
1. Konwertuje wszystkie data/basic_data_*.csv → data/basic_data_*.json
2. Aktualizuje data/manifest.json
3. Generuje dashboard_data.json z danymi z najnowszego CSV (delty = 0)

Po uruchomieniu tego skryptu uruchom convert.py aby uzupełnić delty KPI.

Użycie:
    python process_data.py
"""
import pandas as pd
import json
import glob
import os
import re
import math
from datetime import datetime

try:
    from task_api import fetch_activities_for_deals
    _TASK_API_AVAILABLE = True
except ImportError:
    _TASK_API_AVAILABLE = False


# Powody utraty kwalifikowane jako "odrzucenie / brak zainteresowania"
REJECTION_LOST_REASONS = {
    'Pozostał przy obecnym rozwiązaniu',
    'Zastał przy obecnym rozwiązaniu',  # wariant pisowni
    'Brak decyzji',
}

FUNNEL_STAGES = [
    'Prospect', 'Lead', 'Follow up', 'Demo/Meeting',
    'Blocked', 'Consideration', 'Trial', 'Contract negotiation',
]


def ddmm_to_date(ddmm: str) -> str:
    """'2003' → '2026-03-20', '0504' → '2026-04-05'"""
    dd, mm = ddmm[:2], ddmm[2:4]
    year = datetime.now().year
    return f"{year}-{mm}-{dd}"


def clean_val(v):
    """Zamień float NaN na None (json.dump nie obsługuje NaN)."""
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def parse_csv(file_path):
    df = pd.read_csv(file_path)
    df['Deal - Deal created'] = pd.to_datetime(df['Deal - Deal created'], errors='coerce')
    df['Deal - Deal closed on'] = pd.to_datetime(df['Deal - Deal closed on'], errors='coerce')
    df['Deal - Value'] = pd.to_numeric(df['Deal - Value'], errors='coerce').fillna(0)
    df['Deal - Total activities'] = pd.to_numeric(
        df.get('Deal - Total activities', pd.Series(dtype=float)), errors='coerce'
    ).fillna(0)
    if 'Deal - Lost reason' not in df.columns:
        df['Deal - Lost reason'] = None
    if 'Organization - Branża' not in df.columns:
        df['Organization - Branża'] = None
    return df


def calc_snapshot(df):
    """Oblicza metryki KPI dla jednego dataframe."""
    won = df[df['Deal - Status'].str.lower() == 'won']
    lost = df[df['Deal - Status'].str.lower() == 'lost']
    open_ = df[df['Deal - Status'].str.lower() == 'open']

    rejected = lost[lost['Deal - Lost reason'].fillna('').str.strip() == 'Duplikat']
    lost_qualified = lost[lost['Deal - Lost reason'].fillna('').str.strip() != 'Duplikat']

    mrr_won = float(won['Deal - Value'].sum())
    mrr_pipeline = float(open_[open_['Deal - Value'] > 0]['Deal - Value'].sum())
    denom = len(won) + len(lost_qualified)
    win_rate = round(len(won) / denom * 100, 1) if denom > 0 else 0.0
    open_deals = int(len(open_))
    rejected_count = int(len(rejected))

    won_dated = won[won['Deal - Deal created'].notna() & won['Deal - Deal closed on'].notna()]
    if len(won_dated) > 0:
        days = (won_dated['Deal - Deal closed on'] - won_dated['Deal - Deal created']).dt.days
        median_days = int(days.median())
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


def calc_director(df):
    won = df[df['Deal - Status'].str.lower() == 'won']
    lost = df[df['Deal - Status'].str.lower() == 'lost']
    open_ = df[df['Deal - Status'].str.lower() == 'open']

    metrics = calc_snapshot(df)

    # Monthly new deals (by Deal - Deal created)
    df2 = df.copy()
    df2['Month'] = df2['Deal - Deal created'].dt.to_period('M').astype(str)
    monthly_raw = df2.groupby('Month').apply(
        lambda g: {
            'pracuj': int((g['Deal - Nazwa Partnera'] == 'Pracuj.pl').sum()),
            'erecruiter': int((g['Deal - Nazwa Partnera'] == 'eRecruiter').sum()),
        }
    ).to_dict()
    monthly_new = [{'month': k, **v} for k, v in sorted(monthly_raw.items())]

    # Cumulative totals — won/lost use Deal - Deal closed on
    won_months = won[won['Deal - Deal closed on'].notna()]['Deal - Deal closed on'].dt.to_period('M').astype(str)
    lost_months = lost[lost['Deal - Deal closed on'].notna()]['Deal - Deal closed on'].dt.to_period('M').astype(str)

    all_months = sorted(set(
        list(df2['Month'].dropna().unique())
        + list(won_months.unique())
        + list(lost_months.unique())
    ))

    cum_created = cum_won = cum_lost = 0
    cumulative = []
    for m in all_months:
        cum_created += int((df2['Month'] == m).sum())
        cum_won += int((won_months == m).sum())
        cum_lost += int((lost_months == m).sum())
        cumulative.append({'month': m, 'total_created': cum_created, 'total_won': cum_won, 'total_lost': cum_lost})

    partner_split = {
        'pracuj': int((df['Deal - Nazwa Partnera'] == 'Pracuj.pl').sum()),
        'erecruiter': int((df['Deal - Nazwa Partnera'] == 'eRecruiter').sum()),
    }
    status_split = {
        'open': int(len(open_)),
        'won': int(len(won)),
        'lost': int(len(lost)),
    }

    return {
        'kpis': {
            'mrr_won': metrics['mrr_won'],
            'mrr_won_delta': 0.0,
            'pipeline_mrr_potential': metrics['pipeline_mrr_potential'],
            'pipeline_mrr_potential_delta': 0.0,
            'win_rate': metrics['win_rate'],
            'win_rate_delta': 0.0,
            'open_deals': metrics['open_deals'],
            'open_deals_delta': 0,
            'rejected_deals_count': metrics['rejected_deals_count'],
            'rejected_deals_count_delta': 0,
            'median_days_to_close': metrics['median_days_to_close'],
            'median_days_to_close_delta': None,
        },
        'monthly_new_deals': monthly_new,
        'cumulative_deals': cumulative,
        'partner_split': partner_split,
        'status_split': status_split,
    }


def calc_manager(df):
    open_ = df[df['Deal - Status'].str.lower() == 'open']
    lost = df[df['Deal - Status'].str.lower() == 'lost']
    won = df[df['Deal - Status'].str.lower() == 'won']

    funnel_stages = [
        {'stage': s, 'count': int((open_['Deal - Stage'] == s).sum())}
        for s in FUNNEL_STAGES
    ]

    all_open = []
    for _, row in open_.iterrows():
        all_open.append({
            'id': int(row['Deal - ID']) if pd.notna(row.get('Deal - ID')) else None,
            'title': str(row.get('Deal - Title', '') or row.get('Deal - Organization', '')),
            'partner': str(row.get('Deal - Nazwa Partnera', '')),
            'stage': str(row.get('Deal - Stage', '')),
            'status': 'open',
            'value': float(row['Deal - Value']),
            'created': row['Deal - Deal created'].strftime('%Y-%m-%d') if pd.notna(row['Deal - Deal created']) else None,
            'total_activities': int(row['Deal - Total activities']),
            'organization': str(row.get('Deal - Organization', '')),
            'branża': str(row.get('Organization - Branża', '') or ''),
        })

    lost_rows = []
    for _, row in lost.iterrows():
        closed = row.get('Deal - Deal closed on')
        lost_rows.append({
            'id': int(row['Deal - ID']) if pd.notna(row.get('Deal - ID')) else None,
            'title': str(row.get('Deal - Title', '') or row.get('Deal - Organization', '')),
            'partner': str(row.get('Deal - Nazwa Partnera', '')),
            'value': float(row['Deal - Value']),
            'lost_date': pd.Timestamp(closed).strftime('%Y-%m-%d') if pd.notna(closed) else None,
            'stage_at_close': str(row.get('Deal - Stage', '')),
            'lost_reason': str(row.get('Deal - Lost reason', '') or ''),
        })

    won_rows = []
    for _, row in won.iterrows():
        closed = row.get('Deal - Deal closed on')
        created = row.get('Deal - Deal created')
        if pd.notna(closed) and pd.notna(created):
            days = int((pd.Timestamp(closed) - pd.Timestamp(created)).days)
        else:
            days = None
        won_rows.append({
            'id': int(row['Deal - ID']) if pd.notna(row.get('Deal - ID')) else None,
            'title': str(row.get('Deal - Title', '') or row.get('Deal - Organization', '')),
            'partner': str(row.get('Deal - Nazwa Partnera', '')),
            'value': float(row['Deal - Value']),
            'won_date': pd.Timestamp(closed).strftime('%Y-%m-%d') if pd.notna(closed) else None,
            'stage_at_close': str(row.get('Deal - Stage', '')),
            'days_to_close': days,
        })

    reason_counts = lost['Deal - Lost reason'].fillna('Nie podano').value_counts().to_dict()
    lost_reasons_summary = [
        {'reason': k, 'count': int(v)}
        for k, v in sorted(reason_counts.items(), key=lambda x: -x[1])
    ]

    return {
        'funnel_stages': funnel_stages,
        'all_open_deals': all_open,
        'won_deals': won_rows,
        'lost_deals': lost_rows,
        'lost_reasons_summary': lost_reasons_summary,
        # gp_alerts jest uzupełniane przez convert.py po porównaniu dwóch raportów
        'gp_alerts': None,
    }


def _deal_id_int(row):
    """Bezpieczna konwersja Deal - ID na int."""
    v = row.get('Deal - ID')
    return int(v) if pd.notna(v) else None


def _deal_title(row):
    return str(row.get('Deal - Title', '') or row.get('Deal - Organization', ''))


def _parse_act_date(activity: dict):
    """Wyciąga datę aktywności jako datetime lub None."""
    raw = activity.get('add_time') or activity.get('due_date') or ''
    try:
        return datetime.fromisoformat(str(raw)[:10])
    except (ValueError, TypeError):
        return None


def calc_gp_alerts(df, prev_records: list, prev_date: datetime, current_date: datetime,
                   activities_by_deal: dict) -> dict:
    """
    Oblicza alerty GP Status Flow dla zdarzeń między prev_date a current_date.

    Parametry:
        df                — DataFrame z bieżącego CSV
        prev_records      — lista surowych rekordów z poprzedniego basic_data_*.json
        prev_date         — data poprzedniego raportu (datetime)
        current_date      — data bieżącego raportu (datetime)
        activities_by_deal — {str(deal_id): [activities]} z task_api

    Zwraca słownik z 6 kategoriami alertów.
    """

    def in_period(dt) -> bool:
        if dt is None:
            return False
        if isinstance(dt, pd.Timestamp):
            dt = dt.to_pydatetime().replace(tzinfo=None)
        return prev_date <= dt <= current_date

    # ── Pomocnicze słowniki z poprzedniego raportu ─────────────────────────────
    prev_spaceship = {}   # {deal_id: spaceship_link}
    for rec in prev_records:
        did = rec.get('Deal - ID')
        if did is not None:
            link = str(rec.get('Organization - Spaceship link', '') or '').strip()
            prev_spaceship[int(did)] = link

    # ── 1. ✅ Potwierdzenie przejęcia leada ───────────────────────────────────
    # Deal created w okresie, status open, stage != Prospect
    lead_confirmed = []
    mask_lc = (
        df['Deal - Status'].str.lower() == 'open'
    ) & (
        df['Deal - Stage'] != 'Prospect'
    )
    for _, row in df[mask_lc].iterrows():
        created = row.get('Deal - Deal created')
        if pd.notna(created) and in_period(pd.Timestamp(created)):
            lead_confirmed.append({
                'id': _deal_id_int(row),
                'title': _deal_title(row),
                'partner': str(row.get('Deal - Nazwa Partnera', '')),
                'stage': str(row.get('Deal - Stage', '')),
                'date': pd.Timestamp(created).strftime('%Y-%m-%d'),
            })

    # ── 2. 📅 Umówienie spotkania z klientem ──────────────────────────────────
    # Aktywność "Online Prezentacja" (subject) dodana w okresie
    meeting_scheduled = []
    seen_meetings = set()
    for _, row in df.iterrows():
        did = _deal_id_int(row)
        if did is None:
            continue
        for act in activities_by_deal.get(str(did), []):
            subject = (act.get('subject') or '').strip()
            if 'Online Prezentacja' not in subject:
                continue
            act_dt = _parse_act_date(act)
            if in_period(act_dt) and did not in seen_meetings:
                seen_meetings.add(did)
                meeting_scheduled.append({
                    'id': did,
                    'title': _deal_title(row),
                    'partner': str(row.get('Deal - Nazwa Partnera', '')),
                    'stage': str(row.get('Deal - Stage', '')),
                    'date': act_dt.strftime('%Y-%m-%d'),
                })
                break

    # ── 3. 🧑‍💻 Uruchomienie Trialu ──────────────────────────────────────────
    # Organization - Spaceship link był pusty w poprzednim raporcie, teraz jest wypełniony
    trial_started = []
    if 'Organization - Spaceship link' in df.columns:
        for _, row in df.iterrows():
            did = _deal_id_int(row)
            if did is None:
                continue
            raw_link = row.get('Organization - Spaceship link')
            link_now = '' if (raw_link is None or (isinstance(raw_link, float) and math.isnan(raw_link))) else str(raw_link).strip()
            link_prev = prev_spaceship.get(did, '')
            if link_now and not link_prev:
                trial_started.append({
                    'id': did,
                    'title': _deal_title(row),
                    'partner': str(row.get('Deal - Nazwa Partnera', '')),
                    'stage': str(row.get('Deal - Stage', '')),
                    'spaceship_link': link_now,
                    'date': current_date.strftime('%Y-%m-%d'),
                })

    # ── 4. ❌ Brak kontaktu (ostatnie 3 zadania są typu "call") ──────────────────
    # Sortuj aktywności wg daty — jeśli 3 ostatnie mają type=="call", brak kontaktu.
    # Data ostatniego zadania musi być w okresie.
    no_contact = []
    for _, row in df.iterrows():
        did = _deal_id_int(row)
        if did is None:
            continue
        dated_acts = []
        for act in activities_by_deal.get(str(did), []):
            act_dt = _parse_act_date(act)
            if act_dt:
                dated_acts.append((act_dt, act))
        if len(dated_acts) < 3:
            continue
        dated_acts.sort(key=lambda x: x[0])
        last_3 = dated_acts[-3:]
        if all((a.get('type') or '').lower() == 'call' for _, a in last_3):
            last_dt = last_3[-1][0]
            if in_period(last_dt):
                no_contact.append({
                    'id': did,
                    'title': _deal_title(row),
                    'partner': str(row.get('Deal - Nazwa Partnera', '')),
                    'stage': str(row.get('Deal - Stage', '')),
                    'date': last_dt.strftime('%Y-%m-%d'),
                    'call_count': len(dated_acts),
                })

    # ── 5. 🚫 Odrzucenie / brak zainteresowania ───────────────────────────────
    # Status LOST + powód z REJECTION_LOST_REASONS + zamknięty w okresie
    rejected = []
    lost_df = df[df['Deal - Status'].str.lower() == 'lost']
    for _, row in lost_df.iterrows():
        reason = str(row.get('Deal - Lost reason', '') or '').strip()
        if reason not in REJECTION_LOST_REASONS:
            continue
        closed = row.get('Deal - Deal closed on')
        if pd.notna(closed) and in_period(pd.Timestamp(closed)):
            rejected.append({
                'id': _deal_id_int(row),
                'title': _deal_title(row),
                'partner': str(row.get('Deal - Nazwa Partnera', '')),
                'stage': str(row.get('Deal - Stage', '')),
                'lost_reason': reason,
                'date': pd.Timestamp(closed).strftime('%Y-%m-%d'),
            })

    # ── 6. 🎯 Zamknięcie sprzedaży (won lub lost) ─────────────────────────────
    # Dowolne zamknięcie (won / lost) w okresie — z wyłączeniem Duplikatów
    closed_deals = []
    closed_df = df[df['Deal - Status'].str.lower().isin(['won', 'lost'])]
    for _, row in closed_df.iterrows():
        if str(row.get('Deal - Lost reason', '') or '').strip() == 'Duplikat':
            continue
        closed = row.get('Deal - Deal closed on')
        if pd.notna(closed) and in_period(pd.Timestamp(closed)):
            closed_deals.append({
                'id': _deal_id_int(row),
                'title': _deal_title(row),
                'partner': str(row.get('Deal - Nazwa Partnera', '')),
                'status': str(row.get('Deal - Status', '')).lower(),
                'lost_reason': str(row.get('Deal - Lost reason', '') or ''),
                'date': pd.Timestamp(closed).strftime('%Y-%m-%d'),
            })

    return {
        'prev_report_date':    prev_date.strftime('%Y-%m-%d'),
        'current_report_date': current_date.strftime('%Y-%m-%d'),
        'lead_confirmed':      lead_confirmed,
        'meeting_scheduled':   meeting_scheduled,
        'trial_started':       trial_started,
        'no_contact':          no_contact,
        'rejected':            rejected,
        'deal_closed':         closed_deals,
    }


def convert_csvs_to_json():
    """Konwertuje wszystkie basic_data_*.csv → JSON i aktualizuje manifest."""
    files = sorted(glob.glob('data/basic_data_*.csv'))
    if not files:
        print('Brak plików CSV w data/')
        return []

    manifest_entries = []
    for csv_path in files:
        basename = os.path.basename(csv_path)
        match = re.search(r'basic_data_(\d{4})\.csv$', basename)
        if not match:
            print(f'Pominięto (nieznany format): {basename}')
            continue

        ddmm = match.group(1)
        date_str = ddmm_to_date(ddmm)
        json_name = basename.replace('.csv', '.json')
        json_path = os.path.join('data', json_name)

        df = pd.read_csv(csv_path)
        df = df.where(pd.notna(df), None)
        records = df.to_dict(orient='records')
        records = [{k: clean_val(v) for k, v in row.items()} for row in records]

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

        manifest_entries.append({'name': json_name, 'date': date_str})
        print(f'  {basename} → {json_name} ({len(records)} dealów)')

    manifest_entries.sort(key=lambda x: x['date'])
    with open('data/manifest.json', 'w', encoding='utf-8') as f:
        json.dump({'files': manifest_entries}, f, ensure_ascii=False, indent=2)

    print(f'manifest.json zaktualizowany — {len(manifest_entries)} plik(ów)')
    return manifest_entries


def run_process():
    print('=== Krok 1: Konwersja CSV → JSON ===')
    manifest_entries = convert_csvs_to_json()

    print('\n=== Krok 2: Generowanie dashboard_data.json ===')
    files = sorted(glob.glob('data/basic_data_*.csv'))
    if not files:
        print('Brak plików CSV — przerywam.')
        return

    latest = files[-1]
    print(f'Źródło: {latest}')
    df = parse_csv(latest)

    # ── Daty okresu sprawozdawczego (z manifest) ──────────────────────────────
    manifest_entries_sorted = sorted(manifest_entries, key=lambda x: x['date'])
    if len(manifest_entries_sorted) >= 2:
        prev_date_str    = manifest_entries_sorted[-2]['date']
        current_date_str = manifest_entries_sorted[-1]['date']
    else:
        prev_date_str    = '2000-01-01'
        current_date_str = manifest_entries_sorted[-1]['date'] if manifest_entries_sorted else datetime.now().strftime('%Y-%m-%d')

    prev_date    = datetime.fromisoformat(prev_date_str)
    current_date = datetime.fromisoformat(current_date_str)
    print(f'Okres: {prev_date_str} → {current_date_str}')

    # ── Poprzedni raport (do porównania Spaceship link) ───────────────────────
    prev_json_files = sorted(glob.glob('data/basic_data_*.json'))
    prev_records = []
    if len(prev_json_files) >= 2:
        with open(prev_json_files[-2], encoding='utf-8') as f:
            prev_records = json.load(f)
        print(f'Poprzedni raport: {prev_json_files[-2]} ({len(prev_records)} rekordów)')

    # ── Pobieranie aktywności z Pipedrive API ─────────────────────────────────
    print('\n=== Krok 3: Aktywności z Pipedrive ===')
    all_deal_ids = [
        int(row['Deal - ID'])
        for _, row in df.iterrows()
        if pd.notna(row.get('Deal - ID'))
    ]
    if _TASK_API_AVAILABLE:
        activities_by_deal = fetch_activities_for_deals(all_deal_ids)
    else:
        print('[task_api] Moduł niedostępny — alerty zadaniowe będą puste.')
        activities_by_deal = {str(did): [] for did in all_deal_ids}

    # ── GP Alerts ─────────────────────────────────────────────────────────────
    print('\n=== Krok 4: GP Status Flow Alerts ===')
    gp_alerts = calc_gp_alerts(df, prev_records, prev_date, current_date, activities_by_deal)
    print(f'  ✅ Przejęcia leadów:    {len(gp_alerts["lead_confirmed"])}')
    print(f'  📅 Spotkania:           {len(gp_alerts["meeting_scheduled"])}')
    print(f'  🚫 Odrzucenia:          {len(gp_alerts["rejected"])}')
    print(f'  🎯 Zamknięcia:          {len(gp_alerts["deal_closed"])}')

    # ── Zapis dashboard_data.json ─────────────────────────────────────────────
    manager_data = calc_manager(df)
    manager_data['gp_alerts'] = gp_alerts

    output = {
        'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
        'report_date': current_date_str,
        'director': calc_director(df),
        'manager': manager_data,
    }

    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    open_count = (df['Deal - Status'].str.lower() == 'open').sum()
    won_count  = (df['Deal - Status'].str.lower() == 'won').sum()
    lost_count = (df['Deal - Status'].str.lower() == 'lost').sum()
    print(f'\ndashboard_data.json wygenerowany')
    print(f'  Deale łącznie: {len(df)} | Open: {open_count} | Won: {won_count} | Lost: {lost_count}')
    print('\nUruchom teraz: python convert.py  (aby dodać delty KPI)')


if __name__ == '__main__':
    run_process()
