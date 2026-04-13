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
