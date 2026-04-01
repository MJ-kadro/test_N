import pandas as pd
import json
import os
from datetime import datetime


def process_latest_data():
    # Znajdź najnowszy plik basic_data
    files = [f for f in os.listdir('.') if f.startswith('basic_data')]
    if not files: return
    latest_file = max(files)

    df = pd.read_csv(latest_file)
    df['Deal - Deal created'] = pd.to_datetime(df['Deal - Deal created'])
    df['Deal - Deal closed on'] = pd.to_datetime(df['Deal - Deal closed on'], errors='coerce')

    # 1. Monthly trend
    monthly = df.set_index('Deal - Deal created').resample('ME').size()

    # 4. Global Win Rate
    won = len(df[df['Deal - Status'] == 'Won'])
    lost = len(df[df['Deal - Status'] == 'Lost'])
    win_rate = (won / (won + lost) * 100) if (won + lost) > 0 else 0

    # 7. Median Duration (Won deals)
    closed = df[df['Deal - Deal closed on'].notna()].copy()
    closed['duration'] = (closed['Deal - Deal closed on'] - closed['Deal - Deal created']).dt.days

    results = {
        "total_value": float(df[df['Deal - Status'] == 'Won']['Deal - Value'].sum()),
        "mrr_current": float(df['Deal - MRR'].sum()),  # Uproszczone dla przykładu
        "win_rate": round(win_rate, 2),
        "pipeline_count": len(df[df['Deal - Status'] == 'Open']),
        "median_days": float(closed['duration'].median()),
        "partners": df['Deal - Nazwa Partnera'].value_counts().to_dict(),
        "industries": df[df['Deal - Status'] == 'Won'].groupby('Organization - Branża')['Deal - Value'].sum().to_dict(),
        "monthly_trend": {str(k.date()): int(v) for k, v in monthly.items()}
    }

    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4, ensure_ascii=False)
    print(f"Przetworzono plik: {latest_file}")


if __name__ == "__main__":
    process_latest_data()