import pandas as pd
import json
import glob
import os
from datetime import datetime


def calculate_all_metrics(file_path):
    df = pd.read_csv(file_path)
    # Konwersja dat i liczb
    df['Deal - Deal created'] = pd.to_datetime(df['Deal - Deal created'])
    df['Deal - Deal closed on'] = pd.to_datetime(df['Deal - Deal closed on'], errors='coerce')
    df['Deal - Value'] = pd.to_numeric(df['Deal - Value'], errors='coerce').fillna(0)
    df['Deal - MRR'] = pd.to_numeric(df['Deal - MRR'], errors='coerce').fillna(0)

    # 1. Trend miesięczny
    df['Month'] = df['Deal - Deal created'].dt.to_period('M').astype(str)
    trend = df.groupby('Month').size().to_dict()

    # 7. Mediana czasu zamknięcia
    closed_df = df[df['Deal - Deal closed on'].notna()].copy()
    closed_df['duration'] = (closed_df['Deal - Deal closed on'] - closed_df['Deal - Deal created']).dt.days
    median_val = float(closed_df['duration'].median()) if not closed_df.empty else 0

    return {
        "total_value": float(df[df['Deal - Status'] == 'Won']['Deal - Value'].sum()),
        "mrr_total": float(df['Deal - MRR'].sum()),
        "win_rate": round(float((len(df[df['Deal - Status'] == 'Won']) /
                                 (len(df[df['Deal - Status'].isin(['Won', 'Lost'])]) or 1)) * 100), 2),
        "pipeline_count": int(len(df[df['Deal - Status'] == 'Open'])),
        "median_days": median_val,
        "partners": df['Deal - Nazwa Partnera'].value_counts().to_dict(),
        "industries": df[df['Deal - Status'] == 'Won'].groupby('Organization - Branża')['Deal - Value'].sum().to_dict(),
        "trend": trend
    }


def run_process():
    files = sorted(glob.glob('data/basic_data_*.csv'))
    if not files: return

    current_metrics = calculate_all_metrics(files[-1])
    delta_value = 0

    if len(files) >= 2:
        prev_metrics = calculate_all_metrics(files[-2])
        delta_value = current_metrics["total_value"] - prev_metrics["total_value"]

    final_data = {
        "current": current_metrics,
        "delta_wow_value": float(delta_value),
        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)


if __name__ == "__main__":
    run_process()