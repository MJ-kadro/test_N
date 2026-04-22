"""
task_api.py — Pobieranie aktywności (zadań) z Pipedrive API dla dealów.

Cały algorytm zapytań i przetwarzania odpowiedzi API znajduje się w tym pliku.
Wyniki są cachowane lokalnie w data/activities_cache.json, aby unikać
nadmiarowych wywołań API przy każdym uruchomieniu process_data.py.

Użycie w kodzie:
    from task_api import fetch_activities_for_deals
    activities = fetch_activities_for_deals(deal_ids, api_token='TWÓJ_TOKEN')
    # Zwraca: {str(deal_id): [lista aktywności]}

Użycie z linii poleceń (test dla konkretnych dealów):
    python task_api.py 123 456 789
    python task_api.py 123 --refresh   # wymusza odświeżenie cache
"""
import json
import os
import ssl
import time
import urllib.request
import urllib.error
import sys

# Wyłącz weryfikację SSL (certyfikaty systemowe macOS mogą być niekompletne)
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# ── Konfiguracja ──────────────────────────────────────────────────────────────
PIPEDRIVE_API_TOKEN = 'd5c1f0485084b572993bd345067eca619cd25398'   # ← Uzupełnij swoim tokenem API Pipedrive
BASE_URL = 'https://api.pipedrive.com/v1'
CACHE_FILE = 'data/activities_cache.json'
REQUEST_DELAY = 0.15           # sekund między zapytaniami (~6 req/s, limit Pipedrive = 10)
PAGE_LIMIT = 100               # rekordów na stronę (max 100)


# ── Cache ─────────────────────────────────────────────────────────────────────
def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding='utf-8') as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


# ── Pojedyncze zapytanie do API ───────────────────────────────────────────────
def _api_get(path: str, api_token: str, params: dict = None) -> dict | None:
    """
    Wykonuje GET {BASE_URL}{path} i zwraca sparsowany JSON.
    Zwraca None przy błędzie HTTP lub timeoucie.
    """
    qs_parts = [f'api_token={api_token}']
    if params:
        qs_parts += [f'{k}={v}' for k, v in params.items()]
    url = f'{BASE_URL}{path}?{"&".join(qs_parts)}'
    try:
        with urllib.request.urlopen(url, timeout=15, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f'  [API] HTTP {e.code} — {path}')
        return None
    except urllib.error.URLError as e:
        print(f'  [API] URLError — {path}: {e.reason}')
        return None
    except Exception as e:
        print(f'  [API] Nieoczekiwany błąd — {path}: {e}')
        return None


# ── Pobieranie aktywności dla jednego deala (z paginacją) ─────────────────────
def fetch_activities_for_deal(deal_id: int | str, api_token: str) -> list:
    """
    Pobiera WSZYSTKIE aktywności powiązane z deal_id z Pipedrive.
    Obsługuje paginację (next_start / more_items_in_collection).

    Pola każdej aktywności istotne dla GP alerts:
        subject      — nazwa zadania (np. "Online Prezentacja", "Call")
        type         — typ aktywności (np. "call", "task", "meeting")
        note         — komentarz / notatka (BK dla nieudanych połączeń)
        add_time     — data/czas dodania aktywności (YYYY-MM-DD HH:MM:SS)
        due_date     — planowana data wykonania
        done         — 1/0 czy wykonane
        deal_id      — id powiązanego deala

    Zwraca: listę słowników z polami aktywności.
    """
    all_activities = []
    start = 0

    while True:
        data = _api_get(
            f'/deals/{deal_id}/activities',
            api_token,
            params={'limit': PAGE_LIMIT, 'start': start},
        )
        if data is None or not data.get('success'):
            break

        items = data.get('data') or []
        all_activities.extend(items)

        pagination = (data.get('additional_data') or {}).get('pagination') or {}
        if pagination.get('more_items_in_collection'):
            start = pagination.get('next_start', start + PAGE_LIMIT)
        else:
            break

    return all_activities


# ── Główna funkcja ────────────────────────────────────────────────────────────
def fetch_activities_for_deals(
    deal_ids: list,
    api_token: str = None,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> dict:
    """
    Pobiera aktywności dla listy deal_id. Używa lokalnego cache.

    Parametry:
        deal_ids      — lista int lub str z ID dealów
        api_token     — token API (domyślnie PIPEDRIVE_API_TOKEN z pliku)
        use_cache     — czy korzystać z cache (domyślnie True)
        force_refresh — wymuś pobieranie z API nawet dla dealów w cache

    Zwraca:
        dict { str(deal_id): [lista aktywności] }
        Dla dealów bez aktywności wartość to pusta lista [].
    """
    if api_token is None:
        api_token = PIPEDRIVE_API_TOKEN

    if api_token in ('XXX', '', None):
        print('[task_api] UWAGA: Brak tokenu API — pomijam pobieranie aktywności.')
        print('           Ustaw PIPEDRIVE_API_TOKEN w task_api.py')
        return {str(did): [] for did in deal_ids}

    cache = _load_cache() if use_cache else {}
    result: dict = {}
    to_fetch: list = []

    for did in deal_ids:
        key = str(did)
        if not force_refresh and key in cache:
            result[key] = cache[key]
        else:
            to_fetch.append(did)

    if not to_fetch:
        print(f'[task_api] Cache: {len(deal_ids)} dealów (bez zapytań do API)')
        return result

    print(f'[task_api] Pobieranie z Pipedrive API: {len(to_fetch)} dealów...')
    for i, did in enumerate(to_fetch):
        activities = fetch_activities_for_deal(did, api_token)
        key = str(did)
        result[key] = activities
        cache[key] = activities

        # Zapisz co 10 dealów (checkpoint)
        if (i + 1) % 10 == 0 or (i + 1) == len(to_fetch):
            print(f'  {i + 1}/{len(to_fetch)} dealów')
            _save_cache(cache)

        time.sleep(REQUEST_DELAY)

    print(f'[task_api] Gotowe. Cache zapisany do {CACHE_FILE}')
    return result


# ─────────────────────────────────────────────────────────────────────────────
# GP ALERT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

import math
from datetime import datetime


def _parse_date_gp(s) -> datetime | None:
    """Parsuje string daty ISO (YYYY-MM-DD lub datetime) → datetime lub None."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:10])
    except (ValueError, TypeError):
        return None


def _in_window(date_val, prev_date: datetime, curr_date: datetime) -> bool:
    """Zwraca True jeśli prev_date <= date_val <= curr_date (okno raportowe)."""
    d = _parse_date_gp(date_val) if not isinstance(date_val, datetime) else date_val
    return d is not None and prev_date <= d <= curr_date


def _safe_float(v) -> float:
    """Zwraca float lub 0.0 dla None/NaN."""
    try:
        f = float(v or 0)
        return 0.0 if math.isnan(f) else f
    except (TypeError, ValueError):
        return 0.0


def _deal_entry(r: dict) -> dict:
    """Uproszczony słownik deala do zapisu w alertach GP."""
    return {
        'id':      r.get('Deal - ID'),
        'title':   (r.get('Deal - Title') or r.get('Deal - Organization') or '—').strip(),
        'partner': (r.get('Deal - Nazwa Partnera') or '—').strip(),
        'stage':   (r.get('Deal - Stage') or '—').strip(),
        'value':   round(_safe_float(r.get('Deal - Value')), 2),
    }


# ─── ALERT 1 ─── ✅ Potwierdzenie przejęcia leada ───────────────────────────
def compute_lead_confirmed(
    current_records: list,
    prev_date: datetime,
    curr_date: datetime,
) -> list:
    """
    Deale spełniające WSZYSTKIE warunki:
      - Deal - Deal created ∈ (prev_date, curr_date]
      - Deal - Status ∉ {won, lost}
      - Deal - Stage ≠ 'Prospect'
    Data: Deal - Deal created
    """
    results = []
    for r in current_records:
        if (r.get('Deal - Status') or '').lower() in ('won', 'lost'):
            continue
        if (r.get('Deal - Stage') or '').strip() == 'Prospect':
            continue
        created_raw = r.get('Deal - Deal created')
        if not _in_window(created_raw, prev_date, curr_date):
            continue
        entry = _deal_entry(r)
        entry['date'] = _parse_date_gp(created_raw).strftime('%Y-%m-%d')
        results.append(entry)
    return results


# ─── ALERT 2 ─── 📅 Umówienie spotkania z klientem ──────────────────────────
def compute_meeting_scheduled(
    current_records: list,
    activities_by_deal: dict,
    prev_date: datetime,
    curr_date: datetime,
) -> list:
    """
    Deale, dla których pojawiło się zadanie 'Online Prezentacja'
    (po subject, case-insensitive) w oknie raportowym.
    Data: add_time aktywności (lub due_date jako fallback).
    """
    deal_map  = {str(r.get('Deal - ID')): r for r in current_records}
    seen      = set()
    results   = []

    for deal_id_str, activities in activities_by_deal.items():
        if deal_id_str not in deal_map or deal_id_str in seen:
            continue
        for act in activities:
            if (act.get('subject') or '').strip().lower() != 'online prezentacja':
                continue
            act_date = act.get('add_time') or act.get('due_date')
            if not _in_window(act_date, prev_date, curr_date):
                continue
            entry = _deal_entry(deal_map[deal_id_str])
            entry['date']             = _parse_date_gp(act_date).strftime('%Y-%m-%d')
            entry['activity_subject'] = act.get('subject', 'Online Prezentacja')
            results.append(entry)
            seen.add(deal_id_str)
            break  # jeden alert per deal
    return results


# ─── ALERT 3 ─── 🧑‍💻 Uruchomienie Trialu (Spaceship link) ─────────────────
def compute_trial_started(
    current_records: list,
    prev_records: list,
    prev_date: datetime,
    curr_date: datetime,
) -> list:
    """
    Deale gdzie 'Organization - Spaceship link' zmieniło się z pustego
    na niepuste między raportami.
    Data: data bieżącego raportu (curr_date) — brak timestampu w polu.
    Jeśli kolumna nie istnieje w CSV — zwraca [].
    """
    SPACESHIP_COL = 'Organization - Spaceship link'
    prev_by_id = {str(r.get('Deal - ID')): r for r in prev_records}
    results = []

    for r in current_records:
        curr_val = (r.get(SPACESHIP_COL) or '').strip()
        if not curr_val:
            continue
        deal_id  = str(r.get('Deal - ID'))
        prev_r   = prev_by_id.get(deal_id)
        prev_val = (prev_r.get(SPACESHIP_COL) or '').strip() if prev_r else ''
        if prev_val:
            continue  # link był już wcześniej
        entry = _deal_entry(r)
        entry['date']           = curr_date.strftime('%Y-%m-%d')
        entry['spaceship_link'] = curr_val
        results.append(entry)
    return results


# ─── ALERT 4 ─── ❌ Brak kontaktu (4 kolejne Call + BK) ────────────────────
def compute_no_contact(
    current_records: list,
    activities_by_deal: dict,
    prev_date: datetime,
    curr_date: datetime,
) -> list:
    """
    Deale gdzie wystąpiły ≥4 KOLEJNE aktywności typu 'call'
    z 'BK' w notatce; data 4. z nich ∈ (prev_date, curr_date].
    Data: data 4. kolejnej aktywności Call+BK.
    """
    deal_map = {str(r.get('Deal - ID')): r for r in current_records}
    results  = []

    for deal_id_str, activities in activities_by_deal.items():
        if deal_id_str not in deal_map:
            continue

        calls = sorted(
            [a for a in activities if (a.get('type') or '').lower() == 'call'],
            key=lambda a: (a.get('due_date') or a.get('add_time') or ''),
        )

        consecutive = 0
        fourth_date = None
        for call in calls:
            note = (call.get('note') or call.get('public_description') or '').upper()
            if 'BK' in note:
                consecutive += 1
                if consecutive == 4:
                    fourth_date = _parse_date_gp(call.get('due_date') or call.get('add_time'))
                    break
            else:
                consecutive = 0  # przerwanie ciągu

        if fourth_date and _in_window(fourth_date, prev_date, curr_date):
            entry = _deal_entry(deal_map[deal_id_str])
            entry['date']                 = fourth_date.strftime('%Y-%m-%d')
            entry['consecutive_bk_calls'] = 4
            results.append(entry)
    return results


# ─── ALERT 5 ─── 🚫 Odrzucenie / brak zainteresowania ──────────────────────
REJECTION_REASONS = {'Zastał przy obecnym rozwiązaniu', 'Brak decyzji'}

def compute_rejected(
    current_records: list,
    prev_records: list,
    prev_date: datetime,
    curr_date: datetime,
) -> list:
    """
    Deale które zmieniły status → 'lost' między raportami,
    z powodem ∈ REJECTION_REASONS i datą zamknięcia w oknie.
    Data: Deal - Deal closed on
    """
    prev_lost_ids = {
        str(r.get('Deal - ID'))
        for r in prev_records
        if (r.get('Deal - Status') or '').lower() == 'lost'
    }
    results = []

    for r in current_records:
        if (r.get('Deal - Status') or '').lower() != 'lost':
            continue
        deal_id = str(r.get('Deal - ID'))
        if deal_id in prev_lost_ids:
            continue
        reason = (r.get('Deal - Lost reason') or '').strip()
        if reason not in REJECTION_REASONS:
            continue
        closed_raw = r.get('Deal - Deal closed on')
        if not _in_window(closed_raw, prev_date, curr_date):
            continue
        entry = _deal_entry(r)
        entry['date']        = _parse_date_gp(closed_raw).strftime('%Y-%m-%d')
        entry['lost_reason'] = reason
        results.append(entry)
    return results


# ─── ALERT 6 ─── 🎯 Zamknięcie sprzedaży (won lub lost) ────────────────────
def compute_deal_closed(
    current_records: list,
    prev_records: list,
    prev_date: datetime,
    curr_date: datetime,
    excluded_ids: set = None,
) -> list:
    """
    Deale zamknięte (won/lost) w oknie raportowym,
    z wyłączeniem tych już zgłoszonych w Alercie 5.
    Data: Deal - Deal closed on
    """
    excluded = excluded_ids or set()
    prev_closed_ids = {
        str(r.get('Deal - ID'))
        for r in prev_records
        if (r.get('Deal - Status') or '').lower() in ('won', 'lost')
    }
    results = []

    for r in current_records:
        status  = (r.get('Deal - Status') or '').lower()
        if status not in ('won', 'lost'):
            continue
        deal_id = str(r.get('Deal - ID'))
        if deal_id in prev_closed_ids or deal_id in excluded:
            continue
        closed_raw = r.get('Deal - Deal closed on')
        if not _in_window(closed_raw, prev_date, curr_date):
            continue
        entry = _deal_entry(r)
        entry['date']        = _parse_date_gp(closed_raw).strftime('%Y-%m-%d')
        entry['outcome']     = status
        entry['lost_reason'] = (r.get('Deal - Lost reason') or '').strip() if status == 'lost' else None
        results.append(entry)
    return results


# ─── GŁÓWNA FUNKCJA ALERTÓW GP ──────────────────────────────────────────────
def compute_all_gp_alerts(
    current_records: list,
    prev_records: list,
    prev_date_str: str,
    curr_date_str: str,
    fetch_api: bool = True,
) -> dict:
    """
    Oblicza wszystkie 6 kategorii alertów GP dla okna raportowego.

    Args:
        current_records: lista rekordów z najnowszego raportu (surowe CSV→JSON)
        prev_records:    lista rekordów z poprzedniego raportu
        prev_date_str:   data poprzedniego raportu 'YYYY-MM-DD'
        curr_date_str:   data bieżącego raportu   'YYYY-MM-DD'
        fetch_api:       True → pobierz aktywności przez API (z cache)
                         False → użyj tylko lokalnego cache (bez requestów)

    Zwraca dict z kluczami:
        prev_report_date, current_report_date,
        lead_confirmed, meeting_scheduled, trial_started,
        no_contact, rejected, deal_closed
    """
    prev_date = datetime.fromisoformat(prev_date_str)
    curr_date = datetime.fromisoformat(curr_date_str)

    print(f'\n  [task_api] === Alerty GP: {prev_date_str} → {curr_date_str} ===')

    # Zbierz ID wszystkich dealów bieżącego raportu do pobrania aktywności
    if fetch_api:
        all_ids = [r['Deal - ID'] for r in current_records if r.get('Deal - ID') is not None]
        activities_by_deal = fetch_activities_for_deals(all_ids, use_cache=True)
    else:
        activities_by_deal = _load_cache()
        print(f'  [task_api] Używam lokalnego cache ({len(activities_by_deal)} dealów).')

    # Oblicz każdą kategorię
    lead_confirmed = compute_lead_confirmed(current_records, prev_date, curr_date)
    meeting_sched  = compute_meeting_scheduled(current_records, activities_by_deal, prev_date, curr_date)
    trial_started  = compute_trial_started(current_records, prev_records, prev_date, curr_date)
    no_contact     = compute_no_contact(current_records, activities_by_deal, prev_date, curr_date)
    rejected       = compute_rejected(current_records, prev_records, prev_date, curr_date)
    rejected_ids   = {str(item['id']) for item in rejected if item.get('id')}
    deal_closed    = compute_deal_closed(current_records, prev_records, prev_date, curr_date, excluded_ids=rejected_ids)

    print(f'  [task_api] Wyniki:')
    print(f'    ✅ Przejęcia leadów:       {len(lead_confirmed)}')
    print(f'    📅 Spotkania umówione:     {len(meeting_sched)}')
    print(f'    🧑‍💻 Trialy uruchomione:   {len(trial_started)}')
    print(f'    ❌ Brak kontaktu (4× BK): {len(no_contact)}')
    print(f'    🚫 Odrzucenia:            {len(rejected)}')
    print(f'    🎯 Zamknięcia:            {len(deal_closed)}')

    return {
        'prev_report_date':    prev_date_str,
        'current_report_date': curr_date_str,
        'lead_confirmed':      lead_confirmed,
        'meeting_scheduled':   meeting_sched,
        'trial_started':       trial_started,
        'no_contact':          no_contact,
        'rejected':            rejected,
        'deal_closed':         deal_closed,
    }


# ── CLI: test manualy ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    refresh = '--refresh' in sys.argv

    if not args:
        print('Użycie: python task_api.py <deal_id1> <deal_id2> ... [--refresh]')
        print('Przykład: python task_api.py 88 123 456')
        sys.exit(0)

    ids = [int(a) for a in args]
    result = fetch_activities_for_deals(ids, force_refresh=refresh)

    for did, acts in result.items():
        print(f'\n── Deal {did}: {len(acts)} aktywności ──')
        for a in acts:
            subject = a.get('subject', '—')
            atype   = a.get('type', '—')
            date    = (a.get('add_time') or a.get('due_date') or '')[:10]
            note    = (a.get('note') or '').strip()[:60]
            print(f'  [{atype}] {subject}  ({date})')
            if note:
                print(f'    Notatka: {note}')
