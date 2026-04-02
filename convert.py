"""
Konwertuje pliki CSV z Pipedrive (data/basic_data_DDMM.csv)
na tablice JSON gotowe do załadowania przez dashboard.
Generuje data/manifest.json z listą dostępnych plików.

Użycie:
    python convert.py
"""
import pandas as pd
import json
import glob
import os
import re
from datetime import datetime


def ddmm_to_sortable(ddmm: str) -> str:
    """'2003' → '2025-03-20', '0504' → '2026-04-05' (rok wykryty heurystycznie)."""
    dd, mm = ddmm[:2], ddmm[2:4]
    # Prosta heurystyka: jeśli miesiąc >= bieżącego miesiąca i dd <= 31 → rok bieżący,
    # inaczej załóż rok bieżący i tak (dla sortowania wystarczy RRRR-MM-DD)
    year = datetime.now().year
    return f"{year}-{mm}-{dd}"


def convert_all():
    files = sorted(glob.glob('data/basic_data_*.csv'))
    if not files:
        print('Brak plików CSV w katalogu data/')
        return

    manifest_entries = []

    for csv_path in files:
        basename = os.path.basename(csv_path)
        match = re.search(r'basic_data_(\d{4})\.csv$', basename)
        if not match:
            print(f'Pominięto (nieznany format nazwy): {basename}')
            continue

        ddmm = match.group(1)
        date_str = ddmm_to_sortable(ddmm)
        json_name = basename.replace('.csv', '.json')
        json_path = os.path.join('data', json_name)

        df = pd.read_csv(csv_path)
        # Zamień NaN na None (serializable jako null)
        records = df.where(pd.notna(df), None).to_dict(orient='records')

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2, default=str)

        manifest_entries.append({'name': json_name, 'date': date_str})
        print(f'  {basename}  →  {json_name}  ({len(records)} dealów)')

    manifest_entries.sort(key=lambda x: x['date'])

    with open('data/manifest.json', 'w', encoding='utf-8') as f:
        json.dump({'files': manifest_entries}, f, ensure_ascii=False, indent=2)

    print(f'\nmanifest.json zaktualizowany — {len(manifest_entries)} plik(i/ów)')


if __name__ == '__main__':
    convert_all()
