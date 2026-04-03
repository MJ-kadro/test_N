/* =============================================
   KADROMIERZ × PRACUJ — PIPELINE DASHBOARD
   ============================================= */

// ---- CONFIG ----
const PARTNER_COLORS = { 'Pracuj.pl': '#1a4a8a', 'eRecruiter': '#6b21a8' };
const STATUS_COLORS  = { won: '#1a7a4a', lost: '#c0392b', open: '#1a4a8a', blocked: '#b86b00' };
const FUNNEL_STAGES  = ['Prospect', 'Lead', 'Follow up', 'Demo/Meeting', 'Blocked', 'Consideration', 'Trial', 'Contract negotiation'];
const FUNNEL_DESC = {
  'Prospect':             'Firmy z którymi chcemy nawiązać relacje, ale nie mieliśmy jeszcze z nimi kontaktu',
  'Lead':                 'Nawiązaliśmy kontakt z daną firmą. Wstępnie wyraziła zainteresowanie rozmowami',
  'Follow up':            'Potrzebujemy ponowić działania mające na celu zaangażowanie tej firmy w dalszy etap procesu sprzedażowego',
  'Demo/Meeting':         'Deals z którymi mamy już umówiony konkretny termin na spotkanie',
  'Blocked':              'Deals które z różnego powodu wstrzymały proces sprzedaży',
  'Consideration':        'Deals, które po przeprowadzonym spotkaniu i/lub zapoznaniu się z naszym Value Proposition potrzebują czasu i/lub organizują wewnętrznie uruchomienie testowego okresu',
  'Trial':                'Deals wśród których uruchomiliśmy okres testowy',
  'Contract negotiation': 'Deals, które są w trakcie lub po okresie testowym, ale wyraziły chęć zakupu i trwają obecne negocjacje umowy i/lub warunków współpracy',
  'Success':              'Jesteśmy pewni, że dana firma wykupi subskrypcję Kadromierz',
};

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

  // Average days from created to closed (won + lost with both dates present)
  const closedDeals = [...won, ...lost].filter(d => d['Deal - Deal created'] && d['Deal - Deal closed on']);
  const totalDays = closedDeals.reduce((s, d) => {
    const created = parseDate(d['Deal - Deal created']);
    const closed  = parseDate(d['Deal - Deal closed on']);
    return (created && closed) ? s + Math.floor((closed - created) / 86400000) : s;
  }, 0);
  const avgDaysToClose = closedDeals.length > 0 ? Math.round(totalDays / closedDeals.length) : null;

  return {
    mrrWon:         won.reduce((s, d) => s + parseMRR(d['Deal - Value']), 0),
    mrrPipeline:    open.filter(d => parseMRR(d['Deal - Value']) > 0).reduce((s, d) => s + parseMRR(d['Deal - Value']), 0),
    winRate:        (won.length + lost.length > 0) ? ((won.length / (won.length + lost.length)) * 100).toFixed(1) : '0.0',
    activePipeline: open.length,
    avgDaysToClose,
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
  // Cumulative open: count deals by created month that are still Open
  deals.forEach(d => {
    if (norm(d['Deal - Status']) === 'open') {
      const dt = parseDate(d['Deal - Deal created']);
      if (dt) { const k = dt.toISOString().slice(0, 7); addMonth(k); m[k].openCreated = (m[k].openCreated || 0) + 1; }
    }
  });

  let cumCreated = 0, cumWon = 0, cumLost = 0, cumOpen = 0;
  return sorted.map(([month, v]) => ({
    month, ...v,
    cumulative_created: cumCreated += v.total,
    cumulative_won:     cumWon     += v.won,
    cumulative_lost:    cumLost    += v.lost,
    cumulative_open:    cumOpen    += (v.openCreated || 0),
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
        { label: 'Open',                data: md.map(m => m.cumulative_open),    ...lineOpts('#1a4a8a') },
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
  const lostDeals = deals.filter(d => norm(d['Deal - Status']) === 'lost');
  const lostTitleEl = document.getElementById('lost-chart-title');
  if (lostTitleEl) lostTitleEl.textContent = `Lost wg powodu utraty · ${lostDeals.length} dealów`;

  const byReason = {};
  lostDeals.forEach(d => {
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

  const avgVal = metrics.avgDaysToClose !== null ? metrics.avgDaysToClose + ' dni' : '—';
  const prevAvg = prevMetrics?.avgDaysToClose ?? undefined;

  const cards = [
    { label: 'MRR Won',               val: fmtMRR(metrics.mrrWon),             d: delta(metrics.mrrWon,            prevMetrics?.mrrWon,         ' zł') },
    { label: 'Pipeline MRR Potential', val: fmtMRR(metrics.mrrPipeline),        d: delta(metrics.mrrPipeline,       prevMetrics?.mrrPipeline,    ' zł') },
    { label: 'Win Rate',               val: metrics.winRate + '%',               d: delta(metrics.winRate,           prevMetrics?.winRate,        'pp')  },
    { label: 'Aktywny pipeline',       val: metrics.activePipeline + ' dealów', d: delta(metrics.activePipeline,    prevMetrics?.activePipeline, '')    },
    { label: 'Śr. czas zamknięcia',    val: avgVal,                              d: prevAvg !== undefined && metrics.avgDaysToClose !== null ? delta(metrics.avgDaysToClose, prevAvg, ' dni') : '' },
  ];
  const rejCard = `
    <div class="kpi-card kpi-card--amber">
      <div class="kpi-label">Odrzucone deale <span class="kpi-tooltip" title="Deale które już mamy w procesie sprzedaży">ⓘ</span></div>
      <div class="kpi-value kpi-value--amber">${state.rejectedCount}</div>
    </div>`;
  el.innerHTML = cards.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.val}</div>
      ${k.d}
    </div>`).join('') + rejCard;
  el.style.gridTemplateColumns = 'repeat(6, 1fr)';
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
  const openCount = deals.filter(d => norm(d['Deal - Status']) === 'open').length;
  const titleEl = document.getElementById('funnel-chart-title');
  if (titleEl) titleEl.textContent = `Lejek sprzedażowy · ${openCount} aktywnych`;

  const colors = fd.map(item => item.stage === 'Blocked' ? '#b86b00' : '#1a4a8a');
  const labels = fd.map(item => item.stage);

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
        tooltip: { callbacks: { label: (c) => `${c.parsed.x} dealów` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 12 } } },
      },
    },
  });

  // Populate info icon popup with all stage definitions
  const popup = document.getElementById('funnel-info-popup');
  if (popup) {
    popup.innerHTML = Object.entries(FUNNEL_DESC)
      .map(([stage, desc]) => `<div class="stage-info-row"><strong>${esc(stage)}</strong><span>${esc(desc)}</span></div>`)
      .join('');
  }
}

// ---- FUNNEL FLOW ----
function renderFunnelFlow(deals) {
  destroyChart('funnel-flow');
  const ctx = document.getElementById('chart-funnel-flow');
  if (!ctx) return;

  // Count ALL deals (any status) by stage — shows how many reached each stage historically
  const counts = FUNNEL_STAGES.map(stage => deals.filter(d => d['Deal - Stage'] === stage).length);
  const colors = FUNNEL_STAGES.map(s => s === 'Blocked' ? '#b86b0044' : '#1a4a8a44');
  const borders = FUNNEL_STAGES.map(s => s === 'Blocked' ? '#b86b00' : '#1a4a8a');

  state.charts['funnel-flow'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FUNNEL_STAGES,
      datasets: [{
        label: 'Liczba dealów',
        data: counts,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 2,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.parsed.x} dealów` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 13 } } },
      },
    },
  });
}

// ---- MANAGER MONTHLY CHART ----
function renderManagerMonthlyChart(deals) {
  destroyChart('manager-monthly');
  const ctx = document.getElementById('chart-manager-monthly');
  if (!ctx) return;
  const md = getMonthlyData(deals);
  state.charts['manager-monthly'] = new Chart(ctx, {
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

// ---- WON TABLE ----
function renderWonTable(deals) {
  const el = document.getElementById('won-table-container');
  if (!el) return;
  const won = deals.filter(d => norm(d['Deal - Status']) === 'won')
    .sort((a, b) => (parseDate(b['Deal - Won time']) || 0) - (parseDate(a['Deal - Won time']) || 0));

  const rows = won.map(d => {
    const created = parseDate(d['Deal - Deal created']);
    const wonTime = parseDate(d['Deal - Won time'] || d['Deal - Deal closed on']);
    const days = (created && wonTime) ? Math.floor((wonTime - created) / 86400000) : null;
    return `<tr class="row--won">
      <td><strong>${dealName(d)}</strong></td>
      <td>${partnerBadge(d)}</td>
      <td><span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span></td>
      <td>${fmtDate(d['Deal - Won time'] || d['Deal - Deal closed on'])}</td>
      <td>${fmtMRR(d['Deal - Value'])}</td>
      <td>${days !== null ? days + ' dni' : '—'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Firma</th><th>Partner</th><th>Etap zamknięcia</th><th>Data zamknięcia</th><th>Wartość</th><th>Czas pozyskania</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="empty-state">Brak wygranych dealów</td></tr>'}</tbody>
  </table>`;
}

// ---- AI SUMMARY ----
function renderAISummaryDirector(deals, metrics, md) {
  const el = document.getElementById('ai-summary-director');
  if (!el) return;

  const total = deals.length;
  const wonCount = metrics.won.length;
  const lostCount = metrics.lost.length;
  const openCount = metrics.open.length;
  const wonPct = total > 0 ? ((wonCount / total) * 100).toFixed(0) : 0;
  const lostPct = total > 0 ? ((lostCount / total) * 100).toFixed(0) : 0;

  const funnelData = getFunnelData(deals);
  const topStage = funnelData.reduce((a, b) => b.count > a.count ? b : a, { stage: '', count: 0 });

  const lastMonths = md.slice(-3);
  const recentAvg = lastMonths.length > 0
    ? Math.round(lastMonths.reduce((s, m) => s + m.total, 0) / lastMonths.length)
    : 0;

  let text = `Pipeline aktualnie obejmuje <strong>${openCount} aktywnych dealów</strong>`;
  if (metrics.mrrPipeline > 0) text += ` o potencjale MRR wynoszącym <strong>${fmtMRR(metrics.mrrPipeline)}</strong>`;
  text += `. `;

  if (topStage.count > 0) {
    text += `Największa koncentracja otwartych dealów znajduje się na etapie <strong>${esc(topStage.stage)}</strong> (${topStage.count} dealów). `;
  }

  text += `Spośród wszystkich ${total} dealów historycznie: <strong>${wonPct}% zostało wygranych</strong> (${wonCount}), ${lostPct}% przegranych (${lostCount}), pozostałe aktywne. `;

  if (parseFloat(metrics.winRate) < 15) {
    text += `Win rate na poziomie <strong>${metrics.winRate}%</strong> wskazuje na przestrzeń do optymalizacji kwalifikacji lub zamykania dealów. `;
  } else {
    text += `Win rate wynosi <strong>${metrics.winRate}%</strong>. `;
  }

  if (recentAvg > 0) {
    text += `Średni napływ nowych dealów w ostatnich ${lastMonths.length} miesiącach: <strong>${recentAvg} dealów/miesiąc</strong>. `;
  }

  if (metrics.avgDaysToClose !== null) {
    text += `Średni czas zamknięcia deala (od dodania do zamknięcia won/lost): <strong>${metrics.avgDaysToClose} dni</strong>.`;
  }

  el.innerHTML = `<div class="ai-summary-card">
    <div class="ai-summary-label">✦ Podsumowanie AI</div>
    <div class="ai-summary-text">${text}</div>
  </div>`;
}

function renderAISummaryManager(deals) {
  const el = document.getElementById('ai-summary-manager');
  if (!el) return;

  const lost = deals.filter(d => norm(d['Deal - Status']) === 'lost');
  const open = deals.filter(d => norm(d['Deal - Status']) === 'open');

  const reasons = {};
  lost.forEach(d => {
    const r = (d['Deal - Lost reason'] || '').trim() || 'Nie podano';
    reasons[r] = (reasons[r] || 0) + 1;
  });
  const topReasons = Object.entries(reasons).sort(([, a], [, b]) => b - a).slice(0, 2);

  const funnelData = getFunnelData(deals);
  const topStage = funnelData.reduce((a, b) => b.count > a.count ? b : a, { stage: '', count: 0 });
  const blocked = funnelData.find(f => f.stage === 'Blocked');

  let text = '';

  if (topStage.count > 0) {
    text += `Lejek koncentruje się głównie na etapie <strong>${esc(topStage.stage)}</strong> (${topStage.count} otwartych dealów). `;
  }

  if (blocked && blocked.count > 0) {
    const blockedPct = open.length > 0 ? ((blocked.count / open.length) * 100).toFixed(0) : 0;
    text += `⚠️ <strong>${blocked.count} dealów jest Blocked</strong> (${blockedPct}% aktywnego pipeline) — wymagają działania lub decyzji o zamknięciu. `;
  }

  if (topReasons.length > 0) {
    const [topReason, topCount] = topReasons[0];
    const pct = lost.length > 0 ? ((topCount / lost.length) * 100).toFixed(0) : 0;
    const label = topReason === 'Już w kontakcie' ? 'Odrzucone (już w kontakcie)' : topReason;
    text += `Dominujący powód utraty: <strong>"${esc(label)}"</strong> — ${topCount} dealów (${pct}% wszystkich strat). `;
    if (topReasons.length > 1) {
      const [r2, c2] = topReasons[1];
      const label2 = r2 === 'Już w kontakcie' ? 'Odrzucone (już w kontakcie)' : r2;
      text += `Drugi w kolejności: <strong>"${esc(label2)}"</strong> (${c2} dealów). `;
    }
  }

  if (lost.length > 0 && open.length > 0) {
    const ratio = (open.length / lost.length).toFixed(1);
    text += `Na każdy utracony deal przypada ${ratio} aktywnych — `;
    text += parseFloat(ratio) < 2 ? `stosunek wymaga uwagi. ` : `stosunek wskazuje na zdrowy pipeline. `;
  }

  const metrics = calcMetrics(deals);
  if (metrics.avgDaysToClose !== null) {
    text += `Średni czas zamknięcia deala: <strong>${metrics.avgDaysToClose} dni</strong> (od dodania do zamknięcia won/lost).`;
  }

  el.innerHTML = `<div class="ai-summary-card">
    <div class="ai-summary-label">✦ Podsumowanie AI</div>
    <div class="ai-summary-text">${text}</div>
  </div>`;
}

// ---- DIRECTOR VIEW ----
function renderDirector() {
  const deals = filtered(state.current);
  const metrics = calcMetrics(deals);
  const prevMetrics = state.prev.length > 0 ? calcMetrics(filtered(state.prev)) : null;
  const delta = state.prev.length > 0 ? calcDelta(deals, filtered(state.prev)) : null;
  const md = getMonthlyData(deals);

  // Auto-compute rejected count from ALL current deals (regardless of partner filter)
  state.rejectedCount = state.current.filter(d =>
    norm(d['Deal - Status']) === 'lost' &&
    (d['Deal - Lost reason'] || '').trim() === 'Już w kontakcie'
  ).length;

  renderAISummaryDirector(deals, metrics, md);
  renderCallout(metrics, delta);
  renderKPIs(metrics, prevMetrics);
  renderMonthlyChart(md);
  renderCumulativeChart(md);
  renderPartnerSplitChart(deals);
  renderStatusSplitChart(metrics);
  renderDeltaSection(delta);
}

// ---- CUMULATIVE FUNNEL CHART ----
function renderCumulativeFunnelChart(deals) {
  destroyChart('cumulative-funnel');
  const ctx = document.getElementById('chart-cumulative-funnel');
  if (!ctx) return;

  // Count deals (all statuses) per stage
  const stageCounts = {};
  FUNNEL_STAGES.forEach(s => { stageCounts[s] = deals.filter(d => d['Deal - Stage'] === s).length; });

  // Cumulative: each stage = total - sum of all previous stage counts
  const total = deals.length;
  let cumSubtract = 0;
  const values = FUNNEL_STAGES.map(stage => {
    const val = total - cumSubtract;
    cumSubtract += stageCounts[stage];
    return val;
  });

  const colors = FUNNEL_STAGES.map(s => s === 'Blocked' ? '#b86b0066' : '#1a4a8a66');
  const borders = FUNNEL_STAGES.map(s => s === 'Blocked' ? '#b86b00' : '#1a4a8a');

  state.charts['cumulative-funnel'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FUNNEL_STAGES,
      datasets: [{
        label: 'Skumulowana liczba dealów',
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.parsed.x} dealów osiągnęło ten etap` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { position: 'right', ticks: { font: { size: 12 } } },
      },
    },
  });
}

// ---- MANAGER VIEW ----
function renderManager() {
  const deals = filtered(state.current);
  renderAISummaryManager(deals);
  renderDealsTable(deals);
  renderManagerMonthlyChart(deals);
  renderFunnel(deals);
  renderCumulativeFunnelChart(deals);
  renderFunnelFlow(deals);
  renderLostAnalysis(deals);
  renderWonTable(deals);
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

  // Drag & drop (disabled — upload zone removed from UI)


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

// ---- AUTO-LOAD FROM data/manifest.json ----
async function loadDefaultData() {
  try {
    const res = await fetch('data/manifest.json');
    if (!res.ok) throw new Error('manifest.json niedostępny');
    const manifest = await res.json();
    const files = (manifest.files || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (files.length === 0) throw new Error('Brak plików w manifeście');

    const curr = files[files.length - 1];
    const prev = files.length > 1 ? files[files.length - 2] : null;

    const currRes = await fetch(`data/${curr.name}`);
    if (!currRes.ok) throw new Error(`Nie można załadować: ${curr.name}`);
    state.current = await currRes.json();

    if (prev) {
      const prevRes = await fetch(`data/${prev.name}`);
      if (prevRes.ok) state.prev = await prevRes.json();
    }

    const meta = document.getElementById('report-meta');
    const fmtD = iso => iso.split('-').reverse().join('.');
    if (meta) meta.textContent = `Dane na dzień: ${fmtD(curr.date)}${prev ? ` (poprzedni: ${fmtD(prev.date)})` : ''}`;

    renderAll();
  } catch (err) {
    console.warn('Auto-load nieudany:', err.message);
    const el = document.getElementById('callout-box');
    if (el) el.innerHTML = '<div class="callout-content" style="background:#fef3c7;border-color:#fcd34d;color:#92400e">⚠️ Brak danych. Uruchom <code>python convert.py</code> i odśwież stronę, lub wgraj raport JSON ręcznie.</div>';
    const meta = document.getElementById('report-meta');
    if (meta) meta.textContent = 'Brak danych — wgraj raport JSON';
  }
}

// ---- INIT ----
function init() {
  setupEvents();
  loadDefaultData();
}

document.addEventListener('DOMContentLoaded', init);
