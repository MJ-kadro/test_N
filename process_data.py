import pandas as pd
import json
import glob
from datetime import datetime

FUNNEL_STAGES = [
    'Prospect', 'Lead', 'Follow up', 'Demo/Meeting',
    'Blocked', 'Consideration', 'Trial', 'Contract negotiation',
]

# Columns in new CSV export (Deal - MRR and others removed)
# MRR source: Deal - Value
# New column: Deal - Lost reason


def parse_csv(file_path):
    df = pd.read_csv(file_path)
    df['Deal - Deal created']  = pd.to_datetime(df['Deal - Deal created'],  errors='coerce')
    df['Deal - Deal closed on'] = pd.to_datetime(df['Deal - Deal closed on'], errors='coerce')
    df['Deal - Won time']       = pd.to_datetime(df['Deal - Won time'],       errors='coerce')
    df['Deal - Lost time']      = pd.to_datetime(df['Deal - Lost time'],      errors='coerce')
    df['Deal - Value']          = pd.to_numeric(df['Deal - Value'],           errors='coerce').fillna(0)
    df['Deal - Total activities'] = pd.to_numeric(df.get('Deal - Total activities', 0), errors='coerce').fillna(0)
    # Optional column — may not exist
    if 'Deal - Lost reason' not in df.columns:
        df['Deal - Lost reason'] = None
    return df


def calc_director(df, prev_df=None):
    won  = df[df['Deal - Status'].str.lower() == 'won']
    lost = df[df['Deal - Status'].str.lower() == 'lost']
    open_ = df[df['Deal - Status'].str.lower() == 'open']

    mrr_won      = float(won['Deal - Value'].sum())
    mrr_pipeline = float(open_[open_['Deal - Value'] > 0]['Deal - Value'].sum())
    denom        = len(won) + len(lost)
    win_rate     = round(len(won) / denom * 100, 1) if denom > 0 else 0.0
    open_deals   = int(len(open_))

    # Deltas vs previous file
    def _kpi(prev):
        if prev is None:
            return 0.0, 0.0, 0.0, 0
        pw  = prev[prev['Deal - Status'].str.lower() == 'won']
        pl  = prev[prev['Deal - Status'].str.lower() == 'lost']
        po  = prev[prev['Deal - Status'].str.lower() == 'open']
        pmrr_won      = float(pw['Deal - Value'].sum())
        pmrr_pipeline = float(po[po['Deal - Value'] > 0]['Deal - Value'].sum())
        pd_denom      = len(pw) + len(pl)
        pwin_rate     = round(len(pw) / pd_denom * 100, 1) if pd_denom > 0 else 0.0
        return pmrr_won, pmrr_pipeline, pwin_rate, int(len(po))

    p_mrr_won, p_mrr_pipeline, p_win_rate, p_open = _kpi(prev_df)

    # Monthly new deals (by Deal created)
    df2 = df.copy()
    df2['Month'] = df2['Deal - Deal created'].dt.to_period('M').astype(str)
    monthly_raw = df2.groupby('Month').apply(
        lambda g: {
            'pracuj':    int((g['Deal - Nazwa Partnera'] == 'Pracuj.pl').sum()),
            'erecruiter': int((g['Deal - Nazwa Partnera'] == 'eRecruiter').sum()),
        }
    ).to_dict()
    monthly_new = [{'month': k, **v} for k, v in sorted(monthly_raw.items())]

    # Cumulative: created, won, lost (running totals per month)
    all_months = sorted(set(
        list(df2['Month'].dropna().unique())
        + list(df[df['Deal - Won time'].notna()]['Deal - Won time'].dt.to_period('M').astype(str).unique())
        + list(df[df['Deal - Lost time'].notna()]['Deal - Lost time'].dt.to_period('M').astype(str).unique())
    ))
    cum_created = cum_won = cum_lost = 0
    cumulative = []
    for m in all_months:
        cum_created += int((df2['Month'] == m).sum())
        cum_won     += int((df[df['Deal - Won time'].notna()]['Deal - Won time'].dt.to_period('M').astype(str) == m).sum())
        cum_lost    += int((df[df['Deal - Lost time'].notna()]['Deal - Lost time'].dt.to_period('M').astype(str) == m).sum())
        cumulative.append({'month': m, 'total_created': cum_created, 'total_won': cum_won, 'total_lost': cum_lost})

    # Partner & status split
    partner_split = {
        'pracuj':    int((df['Deal - Nazwa Partnera'] == 'Pracuj.pl').sum()),
        'erecruiter': int((df['Deal - Nazwa Partnera'] == 'eRecruiter').sum()),
    }
    status_split = {
        'open': int(len(open_)),
        'won':  int(len(won)),
        'lost': int(len(lost)),
    }

    return {
        'kpis': {
            'mrr_won':                       mrr_won,
            'mrr_won_delta':                 round(mrr_won - p_mrr_won, 2),
            'pipeline_mrr_potential':        mrr_pipeline,
            'pipeline_mrr_potential_delta':  round(mrr_pipeline - p_mrr_pipeline, 2),
            'win_rate':                      win_rate,
            'win_rate_delta':                round(win_rate - p_win_rate, 1),
            'open_deals':                    open_deals,
            'open_deals_delta':              open_deals - p_open,
            'rejected_deals_count':          0,  # Set manually after generation
        },
        'monthly_new_deals': monthly_new,
        'cumulative_deals':  cumulative,
        'partner_split':     partner_split,
        'status_split':      status_split,
    }


def calc_manager(df):
    open_ = df[df['Deal - Status'].str.lower() == 'open']
    lost  = df[df['Deal - Status'].str.lower() == 'lost']

    # Funnel stages — only open deals
    funnel_stages = [
        {'stage': s, 'count': int((open_['Deal - Stage'] == s).sum())}
        for s in FUNNEL_STAGES
    ]

    # Funnel conversions — from ALL deals (historical)
    stage_counts = {s: int((df['Deal - Stage'] == s).sum()) for s in FUNNEL_STAGES}
    funnel_conversions = []
    for i in range(len(FUNNEL_STAGES) - 1):
        frm = FUNNEL_STAGES[i]
        to  = FUNNEL_STAGES[i + 1]
        if stage_counts[frm] > 0:
            funnel_conversions.append({
                'from': frm,
                'to':   to,
                'rate': round(stage_counts[to] / stage_counts[frm], 4),
            })

    # All open deals
    all_open = []
    for _, row in open_.iterrows():
        all_open.append({
            'id':               int(row['Deal - ID']) if pd.notna(row.get('Deal - ID')) else None,
            'title':            str(row.get('Deal - Title', '') or row.get('Deal - Organization', '')),
            'partner':          str(row.get('Deal - Nazwa Partnera', '')),
            'stage':            str(row.get('Deal - Stage', '')),
            'status':           'open',
            'value':            float(row['Deal - Value']),
            'created':          row['Deal - Deal created'].strftime('%Y-%m-%d') if pd.notna(row['Deal - Deal created']) else None,
            'total_activities': int(row['Deal - Total activities']),
            'organization':     str(row.get('Deal - Organization', '')),
        })

    # Lost deals
    lost_rows = []
    for _, row in lost.iterrows():
        lost_date = row.get('Deal - Lost time') or row.get('Deal - Deal closed on')
        lost_rows.append({
            'id':             int(row['Deal - ID']) if pd.notna(row.get('Deal - ID')) else None,
            'title':          str(row.get('Deal - Title', '') or row.get('Deal - Organization', '')),
            'partner':        str(row.get('Deal - Nazwa Partnera', '')),
            'value':          float(row['Deal - Value']),
            'lost_date':      pd.Timestamp(lost_date).strftime('%Y-%m-%d') if pd.notna(lost_date) else None,
            'stage_at_close': str(row.get('Deal - Stage', '')),
            'lost_reason':    str(row.get('Deal - Lost reason', '') or ''),
        })

    # Lost reasons summary
    reason_counts = lost['Deal - Lost reason'].fillna('Nie podano').value_counts().to_dict()
    lost_reasons_summary = [
        {'reason': k, 'count': int(v)}
        for k, v in sorted(reason_counts.items(), key=lambda x: -x[1])
    ]

    total_activities = int(df['Deal - Total activities'].sum())
    n = len(df)
    avg_activities = round(total_activities / n, 1) if n > 0 else 0.0

    return {
        'funnel_stages':          funnel_stages,
        'funnel_conversions':     funnel_conversions,
        'all_open_deals':         all_open,
        'lost_deals':             lost_rows,
        'lost_reasons_summary':   lost_reasons_summary,
        'total_activities_all':   total_activities,
        'avg_activities_per_deal': avg_activities,
    }


def run_process():
    files = sorted(glob.glob('data/basic_data_*.csv'))
    if not files:
        print('Brak plików CSV w data/')
        return

    df_current = parse_csv(files[-1])
    df_prev    = parse_csv(files[-2]) if len(files) >= 2 else None

    report_date = datetime.now().strftime('%Y-%m-%d')

    output = {
        'generated_at':        datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
        'report_date':         report_date,
        'rejected_deals_count': 0,  # Update manually after generation
        'director':            calc_director(df_current, df_prev),
        'manager':             calc_manager(df_current),
    }

    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'dashboard_data.json wygenerowany ({report_date})')
    print(f'  Deale: {len(df_current)}, Open: {(df_current["Deal - Status"].str.lower() == "open").sum()}')


if __name__ == '__main__':
    run_process()
