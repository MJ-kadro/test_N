/* =============================================
   KADROMIERZ × PRACUJ — PIPELINE DASHBOARD
   ============================================= */

// ---- CONFIG ----
const PARTNER_COLORS = { 'Pracuj.pl': '#1a4a8a', 'eRecruiter': '#6b21a8' };
const STATUS_COLORS  = { won: '#1a7a4a', lost: '#c0392b', open: '#1a4a8a', blocked: '#b86b00' };
const FUNNEL_STAGES  = ['Prospect', 'Lead', 'Follow up', 'Demo/Meeting', 'Blocked', 'Consideration', 'Trial', 'Contract negotiation'];

// ---- STATE ----
const state = {
  current:     [],
  prev:        [],
  partner:     'all',
  tab:         'director',
  charts:      {},
  dealSortCol:    'Deal - Value',
  dealSortDir:    'desc',
  showAll:        false,
  search:         '',
  rejectedCount:  0,
};

// ---- SAMPLE DATA (20 dealów) ----
const SAMPLE_DATA = [
  // WON
  { "Deal - ID":"1001","Deal - Title":"Hotel Europejski Kraków","Deal - Value":"30000","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-01-15 09:00:00","Deal - Won time":"2025-02-28 14:00:00","Deal - Lost time":"","Deal - Total activities":"12","Deal - Organization":"Hotel Europejski Kraków","Deal - Lost reason":"" },
  { "Deal - ID":"1002","Deal - Title":"Medicover Polska","Deal - Value":"57600","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-20 10:00:00","Deal - Won time":"2025-03-10 11:00:00","Deal - Lost time":"","Deal - Total activities":"15","Deal - Organization":"Medicover Polska","Deal - Lost reason":"" },
  { "Deal - ID":"1003","Deal - Title":"Frisco.pl","Deal - Value":"21600","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-01 08:30:00","Deal - Won time":"2025-03-25 16:00:00","Deal - Lost time":"","Deal - Total activities":"9","Deal - Organization":"Frisco.pl","Deal - Lost reason":"" },
  // LOST
  { "Deal - ID":"1004","Deal - Title":"Orbis Hotels","Deal - Value":"38400","Deal - Stage":"Consideration","Deal - Status":"Lost","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2024-12-05 10:00:00","Deal - Won time":"","Deal - Lost time":"2025-02-15 09:00:00","Deal - Total activities":"7","Deal - Organization":"Orbis Hotels","Deal - Lost reason":"Pozostał przy obecnym rozwiązaniu" },
  { "Deal - ID":"1005","Deal - Title":"CCC Group","Deal - Value":"0","Deal - Stage":"Prospect","Deal - Status":"Lost","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-08 11:00:00","Deal - Won time":"","Deal - Lost time":"2025-02-20 14:00:00","Deal - Total activities":"3","Deal - Organization":"CCC Group","Deal - Lost reason":"Już w kontakcie" },
  { "Deal - ID":"1006","Deal - Title":"Alior Bank SA","Deal - Value":"26400","Deal - Stage":"Demo/Meeting","Deal - Status":"Lost","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-10 09:30:00","Deal - Won time":"","Deal - Lost time":"2025-03-30 15:00:00","Deal - Total activities":"6","Deal - Organization":"Alior Bank SA","Deal - Lost reason":"Brak funkcjonalności" },
  { "Deal - ID":"1007","Deal - Title":"KGHM Polska Miedź","Deal - Value":"66000","Deal - Stage":"Contract negotiation","Deal - Status":"Lost","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2024-11-20 08:00:00","Deal - Won time":"","Deal - Lost time":"2025-01-31 10:00:00","Deal - Total activities":"18","Deal - Organization":"KGHM Polska Miedź","Deal - Lost reason":"Pozostał przy obecnym rozwiązaniu" },
  // OPEN — Blocked
  { "Deal - ID":"1008","Deal - Title":"Grupa Eurocash","Deal - Value":"45600","Deal - Stage":"Blocked","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2024-10-15 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"5","Deal - Organization":"Grupa Eurocash","Deal - Lost reason":"" },
  { "Deal - ID":"1009","Deal - Title":"Żabka Polska","Deal - Value":"34800","Deal - Stage":"Blocked","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-05 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"4","Deal - Organization":"Żabka Polska","Deal - Lost reason":"" },
  // OPEN — Contract negotiation
  { "Deal - ID":"1010","Deal - Title":"InPost SA","Deal - Value":"50400","Deal - Stage":"Contract negotiation","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-20 08:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"11","Deal - Organization":"InPost SA","Deal - Lost reason":"" },
  // OPEN — Demo/Meeting
  { "Deal - ID":"1011","Deal - Title":"Allegro.eu","Deal - Value":"69600","Deal - Stage":"Demo/Meeting","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-01 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"7","Deal - Organization":"Allegro.eu","Deal - Lost reason":"" },
  { "Deal - ID":"1012","Deal - Title":"Comarch SA","Deal - Value":"37200","Deal - Stage":"Demo/Meeting","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-03-10 11:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"5","Deal - Organization":"Comarch SA","Deal - Lost reason":"" },
  // OPEN — Consideration
  { "Deal - ID":"1013","Deal - Title":"mBank SA","Deal - Value":"32400","Deal - Stage":"Consideration","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-15 10:30:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"4","Deal - Organization":"mBank SA","Deal - Lost reason":"" },
  // OPEN — Follow up
  { "Deal - ID":"1014","Deal - Title":"Nespresso Polska","Deal - Value":"18000","Deal - Stage":"Follow up","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-03-20 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"2","Deal - Organization":"Nespresso Polska","Deal - Lost reason":"" },
  { "Deal - ID":"1015","Deal - Title":"Leroy Merlin Polska","Deal - Value":"25200","Deal - Stage":"Follow up","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-25 14:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"3","Deal - Organization":"Leroy Merlin Polska","Deal - Lost reason":"" },
  // OPEN — Prospect
  { "Deal - ID":"1016","Deal - Title":"Decathlon Polska","Deal - Value":"0","Deal - Stage":"Prospect","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-12-01 08:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"1","Deal - Organization":"Decathlon Polska","Deal - Lost reason":"" },
  { "Deal - ID":"1017","Deal - Title":"Polpharma SA","Deal - Value":"22800","Deal - Stage":"Prospect","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2026-01-10 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"1","Deal - Organization":"Polpharma SA","Deal - Lost reason":"" },
  // OPEN — Lead (new)
  { "Deal - ID":"1018","Deal - Title":"Budimex SA","Deal - Value":"28800","Deal - Stage":"Lead","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2026-03-28 09:30:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"0","Deal - Organization":"Budimex SA","Deal - Lost reason":"" },
  { "Deal - ID":"1019","Deal - Title":"PKN Orlen SA","Deal - Value":"0","Deal - Stage":"Lead","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2026-03-30 11:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"0","Deal - Organization":"PKN Orlen SA","Deal - Lost reason":"" },
  // OPEN — Consideration
  { "Deal - ID":"1020","Deal - Title":"Raben Group","Deal - Value":"20400","Deal - Stage":"Consideration","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-15 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Total activities":"6","Deal - Organization":"Raben Group","Deal - Lost reason":"" },
];

// ---- UTILS ----
function norm(s)       { return (s || '').toLowerCase(); }
function parseMRR(v)   { const n = parseFloat(v); return (isNaN(n) || n <= 0) ? 0 : n; }
function parseDate(s)  { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
function now()         { return new Date(); }
function esc(s)        { return (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function daysInPipeline(deal) {
  const d = parseDate(deal['Deal - Deal created']);
  if (!d) return 0;
  return Math.floor((now() - d) / 86400000);
}

function isStale(_deal) { return false; } // Deal - Next activity date removed from export

function isNew(deal, days = 7) {
  const d = parseDate(deal['Deal - Deal created']);
  return d ? (now() - d) / 86400000 <= days : false;
}

function fmtMRR(v) {
  const n = parseMRR(v);
  return n > 0 ? n.toLocaleString('pl-PL') + ' zł' : '—';
}

function fmtNum(n) { return n.toLocaleString('pl-PL'); }

function fmtDate(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('pl-PL') : '—';
}

// ---- FILTER ----
function filtered(data) {
  if (state.partner === 'all') return data;
  return data.filter(d => d['Deal - Nazwa Partnera'] === state.partner);
}

// ---- METRICS ----
function calcMetrics(deals) {
  const won  = deals.filter(d => norm(d['Deal - Status']) === 'won');
  const lost = deals.filter(d => norm(d['Deal - Status']) === 'lost');
  const open = deals.filter(d => norm(d['Deal - Status']) === 'open');
  return {
    mrrWon:      won.reduce((s, d) => s + parseMRR(d['Deal - Value']), 0),
    mrrPipeline: open.filter(d => parseMRR(d['Deal - Value']) > 0).reduce((s, d) => s + parseMRR(d['Deal - Value']), 0),
    winRate:     (won.length + lost.length > 0) ? ((won.length / (won.length + lost.length)) * 100).toFixed(1) : '0.0',
    activePipeline: open.length,
    won, lost, open,
  };
}

function getMonthlyData(deals) {
  const m = {};
  const addMonth = (k) => { if (!m[k]) m[k] = { pracuj: 0, erecruiter: 0, total: 0, won: 0, lost: 0 }; };

  deals.forEach(d => {
    const dt = parseDate(d['Deal - Deal created']);
    if (!dt) return;
    const k = dt.toISOString().slice(0, 7);
    addMonth(k);
    if (d['Deal - Nazwa Partnera'] === 'Pracuj.pl') m[k].pracuj++;
    else if (d['Deal - Nazwa Partnera'] === 'eRecruiter') m[k].erecruiter++;
    m[k].total++;
  });
  deals.forEach(d => {
    if (norm(d['Deal - Status']) === 'won') {
      const dt = parseDate(d['Deal - Won time'] || d['Deal - Deal closed on']);
      if (dt) { const k = dt.toISOString().slice(0, 7); addMonth(k); m[k].won++; }
    }
    if (norm(d['Deal - Status']) === 'lost') {
      const dt = parseDate(d['Deal - Lost time'] || d['Deal - Deal closed on']);
      if (dt) { const k = dt.toISOString().slice(0, 7); addMonth(k); m[k].lost++; }
    }
  });

  const sorted = Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  let cumCreated = 0, cumWon = 0, cumLost = 0;
  return sorted.map(([month, v]) => ({
    month, ...v,
    cumulative_created: cumCreated += v.total,
    cumulative_won:     cumWon     += v.won,
    cumulative_lost:    cumLost    += v.lost,
  }));
}

function getFunnelData(deals) {
  const open = deals.filter(d => norm(d['Deal - Status']) === 'open');
  return FUNNEL_STAGES.map(stage => {
    const sd = open.filter(d => d['Deal - Stage'] === stage);
    return { stage, count: sd.length, mrr: sd.reduce((s, d) => s + parseMRR(d['Deal - Value']), 0) };
  });
}

function calcDelta(current, prev) {
  if (!prev || prev.length === 0) return null;
  const pm = new Map(prev.map(d => [String(d['Deal - ID']), d]));
  const newDeals = current.filter(d => !pm.has(String(d['Deal - ID'])));
  const wonDeals = current.filter(d => {
    const p = pm.get(String(d['Deal - ID']));
    return p && norm(p['Deal - Status']) !== 'won' && norm(d['Deal - Status']) === 'won';
  });
  const lostDeals = current.filter(d => {
    const p = pm.get(String(d['Deal - ID']));
    return p && norm(p['Deal - Status']) !== 'lost' && norm(d['Deal - Status']) === 'lost';
  });
  const stageChanges = current.filter(d => {
    const p = pm.get(String(d['Deal - ID']));
    return p && norm(d['Deal - Status']) === 'open' && p['Deal - Stage'] !== d['Deal - Stage'];
  }).map(d => ({ deal: d, from: pm.get(String(d['Deal - ID']))['Deal - Stage'], to: d['Deal - Stage'] }));
  return { newDeals, wonDeals, lostDeals, stageChanges };
}

// ---- CHARTS ----
function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function renderMonthlyChart(md) {
  destroyChart('monthly');
  const ctx = document.getElementById('chart-monthly');
  if (!ctx) return;
  state.charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: md.map(m => m.month),
      datasets: [
        { label: 'Pracuj.pl',  data: md.map(m => m.pracuj),     backgroundColor: '#1a4a8a', stack: 'p' },
        { label: 'eRecruiter', data: md.map(m => m.erecruiter), backgroundColor: '#6b21a8', stack: 'p' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function renderCumulativeChart(md) {
  destroyChart('cumulative');
  const ctx = document.getElementById('chart-cumulative');
  if (!ctx) return;
  const lineOpts = (color) => ({ borderColor: color, backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 3 });
  state.charts.cumulative = new Chart(ctx, {
    type: 'line',
    data: {
      labels: md.map(m => m.month),
      datasets: [
        { label: 'Wszystkie (created)', data: md.map(m => m.cumulative_created), ...lineOpts('#475569') },
        { label: 'Won',                 data: md.map(m => m.cumulative_won),     ...lineOpts('#1a7a4a') },
        { label: 'Lost',                data: md.map(m => m.cumulative_lost),    ...lineOpts('#c0392b') },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderPartnerSplitChart(deals) {
  destroyChart('partner-split');
  const ctx = document.getElementById('chart-partner-split');
  if (!ctx) return;
  const partners = ['Pracuj.pl', 'eRecruiter'];
  state.charts['partner-split'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: partners,
      datasets: [{ data: partners.map(p => deals.filter(d => d['Deal - Nazwa Partnera'] === p).length), backgroundColor: ['#1a4a8a', '#6b21a8'], borderWidth: 2 }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderStatusSplitChart(metrics) {
  destroyChart('status-split');
  const ctx = document.getElementById('chart-status-split');
  if (!ctx) return;
  state.charts['status-split'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Won', 'Lost', 'Open'],
      datasets: [{ data: [metrics.won.length, metrics.lost.length, metrics.open.length], backgroundColor: ['#1a7a4a', '#c0392b', '#94a3b8'], borderWidth: 2 }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderLostByStageChart(deals) {
  destroyChart('lost-stage');
  const ctx = document.getElementById('chart-lost-stage');
  if (!ctx) return;
  const byReason = {};
  deals.filter(d => norm(d['Deal - Status']) === 'lost').forEach(d => {
    let r = (d['Deal - Lost reason'] || '').trim() || 'Nie podano';
    if (r === 'Już w kontakcie') r = 'Odrzucone (już w kontakcie)';
    byReason[r] = (byReason[r] || 0) + 1;
  });
  const entries = Object.entries(byReason).sort(([, a], [, b]) => b - a);
  state.charts['lost-stage'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(([s]) => s),
      datasets: [{ label: 'Liczba', data: entries.map(([, c]) => c), backgroundColor: '#c0392b' }],
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

// ---- KPI STRIP ----
function renderKPIs(metrics, prevMetrics) {
  const el = document.getElementById('kpi-strip');
  if (!el) return;

  function delta(cur, prev, unit) {
    if (prevMetrics === null || prev === undefined) return '';
    const diff = parseFloat(cur) - parseFloat(prev);
    if (diff === 0) return '';
    const sign = diff > 0 ? '+' : '';
    const cls  = diff > 0 ? 'delta-up' : 'delta-down';
    const val  = Math.abs(diff) >= 100 ? fmtNum(Math.round(diff)) : diff.toFixed(1);
    return `<div class="kpi-delta ${cls}">${sign}${val}${unit}</div>`;
  }

  const cards = [
    { label: 'MRR Won',               val: fmtMRR(metrics.mrrWon),             d: delta(metrics.mrrWon,         prevMetrics?.mrrWon,         ' zł') },
    { label: 'Pipeline MRR Potential', val: fmtMRR(metrics.mrrPipeline),        d: delta(metrics.mrrPipeline,    prevMetrics?.mrrPipeline,    ' zł') },
    { label: 'Win Rate',               val: metrics.winRate + '%',               d: delta(metrics.winRate,        prevMetrics?.winRate,        'pp')  },
    { label: 'Aktywny pipeline',       val: metrics.activePipeline + ' dealów', d: delta(metrics.activePipeline, prevMetrics?.activePipeline, '')   },
  ];
  const rejCard = `
    <div class="kpi-card kpi-card--amber">
      <div class="kpi-label">Odrzucone deale <span class="kpi-tooltip" title="Deale odrzucone na etapie Prospect z powodem 'Już w kontakcie' — nie są widoczne w eksporcie CSV">ⓘ</span></div>
      <div class="kpi-value kpi-value--amber">${state.rejectedCount}</div>
    </div>`;
  el.innerHTML = cards.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.val}</div>
      ${k.d}
    </div>`).join('') + rejCard;
  el.style.gridTemplateColumns = 'repeat(5, 1fr)';
}

// ---- CALLOUT ----
function renderCallout(metrics, delta) {
  const el = document.getElementById('callout-box');
  if (!el) return;
  let txt = `Aktywny pipeline: <strong>${metrics.open.length} dealów</strong> · Won: <strong>${metrics.won.length}</strong> · Lost: <strong>${metrics.lost.length}</strong> · MRR Won: <strong>${fmtMRR(metrics.mrrWon)}</strong> · Pipeline MRR: <strong>${fmtMRR(metrics.mrrPipeline)}</strong>.`;
  if (delta) {
    txt += ` Vs. poprzedni raport: <strong>${delta.newDeals.length}</strong> nowych, <strong>${delta.wonDeals.length}</strong> wygranych, <strong>${delta.lostDeals.length}</strong> przegranych, <strong>${delta.stageChanges.length}</strong> zmian etapu.`;
  }
  el.innerHTML = `<div class="callout-content">ℹ️ ${txt}</div>`;
}

// ---- FUNNEL ----
function calcFunnelConversions(allDeals) {
  const counts = {};
  FUNNEL_STAGES.forEach(s => { counts[s] = allDeals.filter(d => d['Deal - Stage'] === s).length; });
  const result = [];
  for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
    const frm = FUNNEL_STAGES[i], to = FUNNEL_STAGES[i + 1];
    if (counts[frm] > 0) result.push({ from: frm, to, rate: counts[to] / counts[frm] });
  }
  return result;
}

function renderFunnel(deals) {
  destroyChart('funnel');
  const ctx = document.getElementById('chart-funnel');
  if (!ctx) return;

  const fd = getFunnelData(deals);
  const colors = fd.map(item => item.stage === 'Blocked' ? '#b86b00' : '#1a4a8a');
  const labels = fd.map(item => {
    const val = item.mrr > 0 ? ` (${fmtNum(item.mrr)} zł)` : '';
    return `${item.stage}${val}`;
  });

  state.charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: fd.map(f => f.count), backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${c.parsed.x} dealów`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 13 } } },
      },
    },
  });

  // Conversion badges below chart
  const convEl = document.getElementById('funnel-conversions');
  if (convEl) {
    const convs = calcFunnelConversions(state.current);
    if (convs.length > 0) {
      convEl.innerHTML = '<div class="funnel-conversions">'
        + convs.map(c => `<span class="funnel-conv-badge">${esc(c.from)} → ${esc(c.to)}: <strong>${(c.rate * 100).toFixed(0)}%</strong></span>`).join('')
        + '</div>';
    } else {
      convEl.innerHTML = '';
    }
  }
}

// ---- ALERTS ----
function partnerBadge(d) {
  const p = d['Deal - Nazwa Partnera'];
  const cls = p === 'Pracuj.pl' ? 'pracuj' : 'erecruiter';
  return `<span class="partner-badge partner-badge--${cls}">${esc(p || '—')}</span>`;
}

function dealName(d) {
  return esc(d['Deal - Title'] || d['Deal - Organization'] || '—');
}


// ---- DEALS TABLE ----
function renderDealsTable(allDeals) {
  const el = document.getElementById('deals-table-container');
  if (!el) return;

  let deals = state.showAll ? allDeals : allDeals.filter(d => norm(d['Deal - Status']) === 'open');
  const q = state.search.toLowerCase();
  if (q) deals = deals.filter(d => (d['Deal - Title'] || d['Deal - Organization'] || '').toLowerCase().includes(q));

  const sc = state.dealSortCol;
  deals = [...deals].sort((a, b) => {
    let av, bv;
    if (sc === 'Deal - Value' || sc === 'Deal - Total activities') {
      av = parseMRR(a[sc]); bv = parseMRR(b[sc]);
    } else {
      av = (a[sc] || '').toString().toLowerCase();
      bv = (b[sc] || '').toString().toLowerCase();
    }
    if (av < bv) return state.dealSortDir === 'asc' ? -1 : 1;
    if (av > bv) return state.dealSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const cols = [
    { label:'Firma',              key:'Deal - Title' },
    { label:'Etap',               key:'Deal - Stage' },
    { label:'Partner',            key:'Deal - Nazwa Partnera' },
    { label:'Wartość',            key:'Deal - Value' },
    { label:'Data dodania',       key:'Deal - Deal created' },
    { label:'Aktywności',         key:'Deal - Total activities' },
  ];

  const headers = cols.map(c => {
    const arr = sc === c.key ? (state.dealSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-sort="${c.key}">${c.label}${arr}</th>`;
  }).join('');

  const rows = deals.map(d => {
    const status = norm(d['Deal - Status']);
    const stage  = d['Deal - Stage'] || '';
    let cls = '';
    if (stage === 'Blocked') cls = 'row--blocked';
    else if (status === 'won') cls = 'row--won';

    return `<tr class="${cls}">
      <td><strong>${dealName(d)}</strong>${isNew(d) ? ' <span class="badge-new">NOWY</span>' : ''}</td>
      <td><span class="stage-badge">${esc(stage || '—')}</span></td>
      <td>${partnerBadge(d)}</td>
      <td>${fmtMRR(d['Deal - Value'])}</td>
      <td>${fmtDate(d['Deal - Deal created'])}</td>
      <td>${d['Deal - Total activities'] || 0}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table class="data-table" id="deals-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty-state">Brak dealów</td></tr>'}</tbody>
    </table>`;

  el.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.dealSortCol === col) state.dealSortDir = state.dealSortDir === 'asc' ? 'desc' : 'asc';
      else { state.dealSortCol = col; state.dealSortDir = 'asc'; }
      renderDealsTable(allDeals);
    });
  });
}

// ---- LOST ANALYSIS ----
function renderLostAnalysis(deals) {
  renderLostByStageChart(deals);

  const tblEl = document.getElementById('lost-table-container');
  if (!tblEl) return;
  const lost = deals.filter(d => norm(d['Deal - Status']) === 'lost')
    .sort((a, b) => (parseDate(b['Deal - Lost time']) || 0) - (parseDate(a['Deal - Lost time']) || 0));

  const rows = lost.map(d => {
    let reason = (d['Deal - Lost reason'] || '').trim() || '—';
    if (reason === 'Już w kontakcie') reason = 'Odrzucone (już w kontakcie)';
    return `<tr>
      <td><strong>${dealName(d)}</strong></td>
      <td>${partnerBadge(d)}</td>
      <td><span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span></td>
      <td>${esc(reason)}</td>
      <td>${fmtDate(d['Deal - Lost time'] || d['Deal - Deal closed on'])}</td>
      <td>${fmtMRR(d['Deal - Value'])}</td>
    </tr>`;
  }).join('');

  tblEl.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Firma</th><th>Partner</th><th>Etap zamknięcia</th><th>Powód utraty</th><th>Data zamknięcia</th><th>Wartość</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty-state">Brak</td></tr>'}</tbody>
    </table>`;
}

// ---- DELTA SECTION ----
function renderDeltaSection(delta) {
  const el = document.getElementById('delta-section');
  if (!el) return;
  if (!delta) { el.innerHTML = ''; return; }

  function mini(title, color, items, cols) {
    const rows = items.map(item => {
      const d = item.deal || item;
      return `<tr>${cols.map(c => `<td>${c(d, item)}</td>`).join('')}</tr>`;
    }).join('');
    return `
      <div class="delta-card delta-card--${color}">
        <h4>${title} (${items.length})</h4>
        ${items.length === 0
          ? '<p class="empty-state">Brak</p>'
          : `<table class="data-table"><tbody>${rows}</tbody></table>`}
      </div>`;
  }

  el.innerHTML = `
    <div class="section-title">Zmiany vs. poprzedni raport</div>
    <div class="delta-grid">
      ${mini('🆕 Nowe deale', 'new', delta.newDeals, [
        d => `<strong>${dealName(d)}</strong>`,
        d => partnerBadge(d),
        d => fmtMRR(d['Deal - Value']),
        d => `<span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span>`,
      ])}
      ${mini('✅ Wygrane', 'won', delta.wonDeals, [
        d => `<strong>${dealName(d)}</strong>`,
        d => partnerBadge(d),
        d => fmtMRR(d['Deal - Value']),
      ])}
      ${mini('❌ Przegrane', 'lost', delta.lostDeals, [
        d => `<strong>${dealName(d)}</strong>`,
        d => partnerBadge(d),
        d => fmtMRR(d['Deal - Value']),
      ])}
      ${mini('↔️ Zmiany etapu', 'stage', delta.stageChanges, [
        (d, item) => `<strong>${dealName(d)}</strong>`,
        (d, item) => `${esc(item.from)} → ${esc(item.to)}`,
        (d) => partnerBadge(d),
      ])}
    </div>`;
}

// ---- DIRECTOR VIEW ----
function renderDirector() {
  const deals = filtered(state.current);
  const metrics = calcMetrics(deals);
  const prevMetrics = state.prev.length > 0 ? calcMetrics(filtered(state.prev)) : null;
  const delta = state.prev.length > 0 ? calcDelta(deals, filtered(state.prev)) : null;
  const md = getMonthlyData(deals);

  renderCallout(metrics, delta);
  renderKPIs(metrics, prevMetrics);
  renderMonthlyChart(md);
  renderCumulativeChart(md);
  renderPartnerSplitChart(deals);
  renderStatusSplitChart(metrics);
  renderDeltaSection(delta);
}

// ---- MANAGER VIEW ----
function renderManager() {
  const deals = filtered(state.current);
  renderFunnel(deals);
  renderDealsTable(deals);
  renderLostAnalysis(deals);
}

function renderAll() {
  renderDirector();
  renderManager();
}

// ---- FILE LOADING ----
function loadJSON(file, slot) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let raw = JSON.parse(e.target.result);
      // Support both raw deal arrays and pre-processed dashboard_data.json
      let data = Array.isArray(raw) ? raw : (raw.manager?.all_open_deals ? null : null);
      if (!Array.isArray(raw)) throw new Error('Plik JSON musi zawierać tablicę dealów.');
      data = raw;
      if (raw.rejected_deals_count !== undefined) state.rejectedCount = raw.rejected_deals_count;
      if (slot === 'current') {
        state.current = data;
        const info = document.getElementById('file-info');
        if (info) info.textContent = `✓ ${file.name}`;
        const meta = document.getElementById('report-meta');
        if (meta) meta.textContent = `Bieżący raport: ${file.name}`;
      } else {
        state.prev = data;
      }
      renderAll();
    } catch (err) {
      alert('Błąd parsowania pliku JSON:\n' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ---- EVENTS ----
function setupEvents() {
  // Tab switch
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const view = document.getElementById(`view-${state.tab}`);
      if (view) view.classList.add('active');
    });
  });

  // Partner filter
  document.querySelectorAll('.pill[data-partner]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.partner = btn.dataset.partner;
      document.querySelectorAll('.pill[data-partner]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAll();
    });
  });

  // File input
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    // Sort by name descending → newest first
    files.sort((a, b) => b.name.localeCompare(a.name));
    if (files[0]) loadJSON(files[0], 'current');
    if (files[1]) loadJSON(files[1], 'prev');
    fileInput.value = '';
  });

  // Drag & drop
  const zone = document.getElementById('upload-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files)
      .filter(f => f.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name));
    if (files[0]) loadJSON(files[0], 'current');
    if (files[1]) loadJSON(files[1], 'prev');
  });

  // Search
  const search = document.getElementById('deal-search');
  if (search) search.addEventListener('input', e => {
    state.search = e.target.value;
    renderDealsTable(filtered(state.current));
  });

  // Show all toggle
  const toggle = document.getElementById('show-all-toggle');
  if (toggle) toggle.addEventListener('change', e => {
    state.showAll = e.target.checked;
    renderDealsTable(filtered(state.current));
  });
}

// ---- INIT ----
function init() {
  state.current = SAMPLE_DATA;
  setupEvents();
  renderAll();
  const meta = document.getElementById('report-meta');
  if (meta) meta.textContent = 'Dane: przykładowy zestaw — wgraj raport JSON aby zaktualizować';
}

document.addEventListener('DOMContentLoaded', init);
