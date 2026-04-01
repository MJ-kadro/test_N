/* =============================================
   KADROMIERZ × PRACUJ — PIPELINE DASHBOARD
   ============================================= */

// ---- CONFIG ----
const PARTNER_COLORS = { 'Pracuj.pl': '#1a4a8a', 'eRecruiter': '#6b21a8' };
const STATUS_COLORS  = { won: '#1a7a4a', lost: '#c0392b', open: '#1a4a8a', blocked: '#b86b00' };
const FUNNEL_STAGES  = ['Lead', 'Prospect', 'Follow up', 'Consideration', 'Demo/Meeting', 'Contract negotiation'];

// ---- STATE ----
const state = {
  current:     [],
  prev:        [],
  partner:     'all',
  tab:         'director',
  charts:      {},
  dealSortCol: 'Deal - MRR',
  dealSortDir: 'desc',
  showAll:     false,
  search:      '',
};

// ---- SAMPLE DATA (20 dealów) ----
const SAMPLE_DATA = [
  // WON
  { "Deal - ID":"1001","Deal - Title":"Hotel Europejski Kraków","Deal - MRR":"2500","Deal - Value":"30000","Organization - MRR":"0","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-01-15 09:00:00","Deal - Won time":"2025-02-28 14:00:00","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"12","Deal - Organization":"Hotel Europejski Kraków","Organization - Branża":"Hotele","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1001" },
  { "Deal - ID":"1002","Deal - Title":"Medicover Polska","Deal - MRR":"4800","Deal - Value":"57600","Organization - MRR":"0","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-20 10:00:00","Deal - Won time":"2025-03-10 11:00:00","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"15","Deal - Organization":"Medicover Polska","Organization - Branża":"Ochrona zdrowia","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1002" },
  { "Deal - ID":"1003","Deal - Title":"Frisco.pl","Deal - MRR":"1800","Deal - Value":"21600","Organization - MRR":"0","Deal - Stage":"Won","Deal - Status":"Won","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-01 08:30:00","Deal - Won time":"2025-03-25 16:00:00","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"9","Deal - Organization":"Frisco.pl","Organization - Branża":"Retail","Organization - Spaceship link":"" },
  // LOST
  { "Deal - ID":"1004","Deal - Title":"Orbis Hotels","Deal - MRR":"3200","Deal - Value":"38400","Organization - MRR":"0","Deal - Stage":"Consideration","Deal - Status":"Lost","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2024-12-05 10:00:00","Deal - Won time":"","Deal - Lost time":"2025-02-15 09:00:00","Deal - Next activity date":"","Deal - Total activities":"7","Deal - Organization":"Orbis Hotels","Organization - Branża":"Hotele","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1004" },
  { "Deal - ID":"1005","Deal - Title":"CCC Group","Deal - MRR":"0","Deal - Value":"0","Organization - MRR":"0","Deal - Stage":"Follow up","Deal - Status":"Lost","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-08 11:00:00","Deal - Won time":"","Deal - Lost time":"2025-02-20 14:00:00","Deal - Next activity date":"","Deal - Total activities":"3","Deal - Organization":"CCC Group","Organization - Branża":"Retail","Organization - Spaceship link":"" },
  { "Deal - ID":"1006","Deal - Title":"Alior Bank SA","Deal - MRR":"2200","Deal - Value":"26400","Organization - MRR":"0","Deal - Stage":"Demo/Meeting","Deal - Status":"Lost","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-10 09:30:00","Deal - Won time":"","Deal - Lost time":"2025-03-30 15:00:00","Deal - Next activity date":"","Deal - Total activities":"6","Deal - Organization":"Alior Bank SA","Organization - Branża":"Finanse","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1006" },
  { "Deal - ID":"1007","Deal - Title":"KGHM Polska Miedź","Deal - MRR":"5500","Deal - Value":"66000","Organization - MRR":"0","Deal - Stage":"Contract negotiation","Deal - Status":"Lost","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2024-11-20 08:00:00","Deal - Won time":"","Deal - Lost time":"2025-01-31 10:00:00","Deal - Next activity date":"","Deal - Total activities":"18","Deal - Organization":"KGHM Polska Miedź","Organization - Branża":"Produkcja","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1007" },
  // OPEN — Blocked
  { "Deal - ID":"1008","Deal - Title":"Grupa Eurocash","Deal - MRR":"3800","Deal - Value":"45600","Organization - MRR":"0","Deal - Stage":"Blocked","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2024-10-15 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"5","Deal - Organization":"Grupa Eurocash","Organization - Branża":"Retail","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1008" },
  { "Deal - ID":"1009","Deal - Title":"Żabka Polska","Deal - MRR":"2900","Deal - Value":"34800","Organization - MRR":"0","Deal - Stage":"Blocked","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-01-05 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"4","Deal - Organization":"Żabka Polska","Organization - Branża":"Retail","Organization - Spaceship link":"" },
  // OPEN — Contract negotiation
  { "Deal - ID":"1010","Deal - Title":"InPost SA","Deal - MRR":"4200","Deal - Value":"50400","Organization - MRR":"0","Deal - Stage":"Contract negotiation","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-20 08:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-10","Deal - Total activities":"11","Deal - Organization":"InPost SA","Organization - Branża":"Transport","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1010" },
  // OPEN — Demo/Meeting
  { "Deal - ID":"1011","Deal - Title":"Allegro.eu","Deal - MRR":"5800","Deal - Value":"69600","Organization - MRR":"0","Deal - Stage":"Demo/Meeting","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-01 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-08","Deal - Total activities":"7","Deal - Organization":"Allegro.eu","Organization - Branża":"IT","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1011" },
  { "Deal - ID":"1012","Deal - Title":"Comarch SA","Deal - MRR":"3100","Deal - Value":"37200","Organization - MRR":"0","Deal - Stage":"Demo/Meeting","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-03-10 11:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-05","Deal - Total activities":"5","Deal - Organization":"Comarch SA","Organization - Branża":"IT","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1012" },
  // OPEN — Consideration
  { "Deal - ID":"1013","Deal - Title":"mBank SA","Deal - MRR":"2700","Deal - Value":"32400","Organization - MRR":"0","Deal - Stage":"Consideration","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-15 10:30:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-15","Deal - Total activities":"4","Deal - Organization":"mBank SA","Organization - Branża":"Finanse","Organization - Spaceship link":"" },
  // OPEN — Follow up (stale — next activity in past)
  { "Deal - ID":"1014","Deal - Title":"Nespresso Polska","Deal - MRR":"1500","Deal - Value":"18000","Organization - MRR":"0","Deal - Stage":"Follow up","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-03-20 09:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"2","Deal - Organization":"Nespresso Polska","Organization - Branża":"FMCG","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1014" },
  { "Deal - ID":"1015","Deal - Title":"Leroy Merlin Polska","Deal - MRR":"2100","Deal - Value":"25200","Organization - MRR":"0","Deal - Stage":"Follow up","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2025-03-25 14:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2025-03-28","Deal - Total activities":"3","Deal - Organization":"Leroy Merlin Polska","Organization - Branża":"Retail","Organization - Spaceship link":"" },
  // OPEN — Prospect
  { "Deal - ID":"1016","Deal - Title":"Decathlon Polska","Deal - MRR":"0","Deal - Value":"0","Organization - MRR":"0","Deal - Stage":"Prospect","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-12-01 08:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-12","Deal - Total activities":"1","Deal - Organization":"Decathlon Polska","Organization - Branża":"Retail","Organization - Spaceship link":"" },
  { "Deal - ID":"1017","Deal - Title":"Polpharma SA","Deal - MRR":"1900","Deal - Value":"22800","Organization - MRR":"0","Deal - Stage":"Prospect","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2026-01-10 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-14","Deal - Total activities":"1","Deal - Organization":"Polpharma SA","Organization - Branża":"Ochrona zdrowia","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1017" },
  // OPEN — Lead (new deals)
  { "Deal - ID":"1018","Deal - Title":"Budimex SA","Deal - MRR":"2400","Deal - Value":"28800","Organization - MRR":"0","Deal - Stage":"Lead","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2026-03-28 09:30:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2026-04-08","Deal - Total activities":"0","Deal - Organization":"Budimex SA","Organization - Branża":"Budownictwo","Organization - Spaceship link":"" },
  { "Deal - ID":"1019","Deal - Title":"PKN Orlen SA","Deal - MRR":"0","Deal - Value":"0","Organization - MRR":"0","Deal - Stage":"Lead","Deal - Status":"Open","Deal - Nazwa Partnera":"eRecruiter","Deal - Deal created":"2026-03-30 11:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"","Deal - Total activities":"0","Deal - Organization":"PKN Orlen SA","Organization - Branża":"Energetyka","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1019" },
  // OPEN — Consideration (stale)
  { "Deal - ID":"1020","Deal - Title":"Raben Group","Deal - MRR":"1700","Deal - Value":"20400","Organization - MRR":"0","Deal - Stage":"Consideration","Deal - Status":"Open","Deal - Nazwa Partnera":"Pracuj.pl","Deal - Deal created":"2025-02-15 10:00:00","Deal - Won time":"","Deal - Lost time":"","Deal - Next activity date":"2025-03-01","Deal - Total activities":"6","Deal - Organization":"Raben Group","Organization - Branża":"Transport","Organization - Spaceship link":"https://spaceship7.kadro.dev/account/1020" },
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

function isStale(deal) {
  if (norm(deal['Deal - Status']) !== 'open') return false;
  const na = deal['Deal - Next activity date'];
  if (!na) return true;
  const d = parseDate(na);
  return d ? d < now() : true;
}

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
    mrrWon:      won.reduce((s, d) => s + parseMRR(d['Deal - MRR']), 0),
    mrrPipeline: open.filter(d => parseMRR(d['Deal - MRR']) > 0).reduce((s, d) => s + parseMRR(d['Deal - MRR']), 0),
    winRate:     (won.length + lost.length > 0) ? ((won.length / (won.length + lost.length)) * 100).toFixed(1) : '0.0',
    activePipeline: open.length,
    won, lost, open,
  };
}

function getMonthlyData(deals) {
  const m = {};
  deals.forEach(d => {
    const dt = parseDate(d['Deal - Deal created']);
    if (!dt) return;
    const k = dt.toISOString().slice(0, 7);
    if (!m[k]) m[k] = { pracuj: 0, erecruiter: 0, total: 0 };
    if (d['Deal - Nazwa Partnera'] === 'Pracuj.pl') m[k].pracuj++;
    else if (d['Deal - Nazwa Partnera'] === 'eRecruiter') m[k].erecruiter++;
    m[k].total++;
  });
  const sorted = Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  let cum = 0;
  return sorted.map(([month, v]) => ({ month, ...v, cumulative: cum += v.total }));
}

function getFunnelData(deals) {
  const open = deals.filter(d => norm(d['Deal - Status']) === 'open');
  return FUNNEL_STAGES.map(stage => {
    const sd = open.filter(d => d['Deal - Stage'] === stage);
    return { stage, count: sd.length, mrr: sd.reduce((s, d) => s + parseMRR(d['Deal - MRR']), 0) };
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
  state.charts.cumulative = new Chart(ctx, {
    type: 'line',
    data: {
      labels: md.map(m => m.month),
      datasets: [{
        label: 'Łączna liczba dealów',
        data: md.map(m => m.cumulative),
        borderColor: '#1a4a8a',
        backgroundColor: 'rgba(26,74,138,0.08)',
        fill: true, tension: 0.3, pointRadius: 3,
      }],
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
  const byStage = {};
  deals.filter(d => norm(d['Deal - Status']) === 'lost').forEach(d => {
    const s = d['Deal - Stage'] || 'Nieznany';
    byStage[s] = (byStage[s] || 0) + 1;
  });
  const entries = Object.entries(byStage).sort(([, a], [, b]) => b - a);
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

  el.innerHTML = [
    { label: 'MRR Won',               val: fmtMRR(metrics.mrrWon),         d: delta(metrics.mrrWon,         prevMetrics?.mrrWon,         ' zł') },
    { label: 'Pipeline MRR Potential', val: fmtMRR(metrics.mrrPipeline),    d: delta(metrics.mrrPipeline,    prevMetrics?.mrrPipeline,    ' zł') },
    { label: 'Win Rate',               val: metrics.winRate + '%',           d: delta(metrics.winRate,        prevMetrics?.winRate,        'pp')  },
    { label: 'Aktywny pipeline',       val: metrics.activePipeline + ' dealów', d: delta(metrics.activePipeline, prevMetrics?.activePipeline, '') },
  ].map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.val}</div>
      ${k.d}
    </div>`).join('');
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
function renderFunnel(deals) {
  const el = document.getElementById('funnel-container');
  if (!el) return;
  const fd = getFunnelData(deals);
  const blocked = deals.filter(d => norm(d['Deal - Status']) === 'open' && d['Deal - Stage'] === 'Blocked');
  const maxCount = Math.max(...fd.map(f => f.count), blocked.length, 1);

  let html = '<div class="funnel">';
  fd.forEach((item, i) => {
    const w = Math.max(6, (item.count / maxCount) * 100);
    const conv = (i > 0 && fd[i-1].count > 0)
      ? `<span class="funnel-conv">${((item.count / fd[i-1].count) * 100).toFixed(0)}% konw.</span>`
      : '';
    html += `
      <div class="funnel-row" data-stage="${esc(item.stage)}">
        <div class="funnel-label">${esc(item.stage)}</div>
        <div class="funnel-bar-container">
          <div class="funnel-bar" style="width:${w}%">
            <span class="funnel-bar-text">${item.count}${item.mrr > 0 ? ' · ' + fmtNum(item.mrr) + ' zł' : ''}</span>
          </div>
          ${conv}
        </div>
      </div>`;
  });

  if (blocked.length > 0) {
    const bw = Math.max(6, (blocked.length / maxCount) * 100);
    html += `
      <div class="funnel-row funnel-row--blocked">
        <div class="funnel-label">⚠️ Blocked</div>
        <div class="funnel-bar-container">
          <div class="funnel-bar funnel-bar--blocked" style="width:${bw}%">
            <span class="funnel-bar-text">${blocked.length}</span>
          </div>
        </div>
      </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
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

function spaceshipLink(d) {
  const url = d['Organization - Spaceship link'];
  return url ? `<a href="${esc(url)}" target="_blank" class="spaceship-link" title="Otwórz w Spaceship">🔗</a>` : '—';
}

function nextActCell(d) {
  const na = d['Deal - Next activity date'];
  if (!na) return `<span class="text-danger">⚠️ Brak zadania</span>`;
  const dt = parseDate(na);
  const overdue = dt && dt < now();
  return `<span${overdue ? ' class="text-danger"' : ''}>${fmtDate(na)}</span>`;
}

function renderAlerts(deals) {
  const el = document.getElementById('alerts-container');
  if (!el) return;
  const open = deals.filter(d => norm(d['Deal - Status']) === 'open');
  const blocked = open.filter(d => d['Deal - Stage'] === 'Blocked').sort((a, b) => daysInPipeline(b) - daysInPipeline(a));
  const stale   = open.filter(d => d['Deal - Stage'] !== 'Blocked' && isStale(d)).sort((a, b) => daysInPipeline(b) - daysInPipeline(a));
  const hot     = open.filter(d => ['Demo/Meeting','Contract negotiation'].includes(d['Deal - Stage'])).sort((a, b) => parseMRR(b['Deal - MRR']) - parseMRR(a['Deal - MRR']));

  function panel(title, color, count, tHead, tBody) {
    return `
      <div class="alert-panel">
        <div class="alert-panel-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="alert-panel-title">${title}</span>
          <span class="alert-count ${color}">${count}</span>
          <span class="collapse-icon">▼</span>
        </div>
        <div class="alert-panel-body">
          ${count === 0
            ? '<p class="empty-state">Brak alertów ✓</p>'
            : `<table class="data-table"><thead><tr>${tHead}</tr></thead><tbody>${tBody}</tbody></table>`}
        </div>
      </div>`;
  }

  const th = (...cols) => cols.map(c => `<th>${c}</th>`).join('');

  el.innerHTML = [
    panel(
      '🔴 Blocked — wymagają decyzji', 'danger', blocked.length,
      th('Firma','Partner','MRR','Dni w pipeline','Następne zadanie','Spaceship'),
      blocked.map(d => `<tr class="row--blocked">
        <td><strong>${dealName(d)}</strong></td>
        <td>${partnerBadge(d)}</td>
        <td>${fmtMRR(d['Deal - MRR'])}</td>
        <td>${daysInPipeline(d)} dni</td>
        <td>${nextActCell(d)}</td>
        <td>${spaceshipLink(d)}</td>
      </tr>`).join(''),
    ),
    panel(
      '⚠️ Bez aktywności / przeterminowane', 'warning', stale.length,
      th('Firma','Etap','Partner','Dni w pipeline','Następne zadanie','MRR'),
      stale.map(d => `<tr class="row--stale">
        <td><strong>${dealName(d)}</strong></td>
        <td><span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span></td>
        <td>${partnerBadge(d)}</td>
        <td>${daysInPipeline(d)} dni</td>
        <td>${nextActCell(d)}</td>
        <td>${fmtMRR(d['Deal - MRR'])}</td>
      </tr>`).join(''),
    ),
    panel(
      '🟢 Hot deals — do zamknięcia', 'success', hot.length,
      th('Firma','Etap','Partner','MRR','Następne zadanie','Aktywności'),
      hot.map(d => `<tr>
        <td><strong>${dealName(d)}</strong></td>
        <td><span class="stage-badge">${esc(d['Deal - Stage'])}</span></td>
        <td>${partnerBadge(d)}</td>
        <td>${fmtMRR(d['Deal - MRR'])}</td>
        <td>${nextActCell(d)}</td>
        <td>${d['Deal - Total activities'] || 0}</td>
      </tr>`).join(''),
    ),
  ].join('');
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
    if (sc === 'Deal - MRR' || sc === 'Deal - Total activities') {
      av = parseMRR(a[sc]); bv = parseMRR(b[sc]);
    } else if (sc === '__days') {
      av = daysInPipeline(a); bv = daysInPipeline(b);
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
    { label:'Status',             key:'Deal - Status' },
    { label:'Partner',            key:'Deal - Nazwa Partnera' },
    { label:'Branża',             key:'Organization - Branża' },
    { label:'MRR',                key:'Deal - MRR' },
    { label:'Data dodania',       key:'Deal - Deal created' },
    { label:'Dni w pipeline',     key:'__days' },
    { label:'Następne zadanie',   key:'Deal - Next activity date' },
    { label:'Aktywności',         key:'Deal - Total activities' },
    { label:'Spaceship',          key:null },
  ];

  const headers = cols.map(c => {
    if (!c.key) return '<th>Spaceship</th>';
    const arr = sc === c.key ? (state.dealSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-sort="${c.key}">${c.label}${arr}</th>`;
  }).join('');

  const rows = deals.map(d => {
    const status = norm(d['Deal - Status']);
    const stage  = d['Deal - Stage'] || '';
    let cls = '';
    if (stage === 'Blocked')               cls = 'row--blocked';
    else if (isStale(d) && status==='open') cls = 'row--stale';
    else if (status === 'won')             cls = 'row--won';

    const na = d['Deal - Next activity date'];
    const naOverdue = na && parseDate(na) < now() && status === 'open';
    const naEmpty   = !na && status === 'open';

    return `<tr class="${cls}">
      <td><strong>${dealName(d)}</strong>${isNew(d) ? ' <span class="badge-new">NOWY</span>' : ''}</td>
      <td><span class="stage-badge">${esc(stage || '—')}</span></td>
      <td><span class="status-badge status-badge--${status}">${status === 'won' ? 'Won' : status === 'lost' ? 'Lost' : 'Open'}</span></td>
      <td>${partnerBadge(d)}</td>
      <td>${esc(d['Organization - Branża'] || '—')}</td>
      <td>${fmtMRR(d['Deal - MRR'])}</td>
      <td>${fmtDate(d['Deal - Deal created'])}</td>
      <td>${daysInPipeline(d)}</td>
      <td class="${naOverdue||naEmpty ? 'text-danger' : ''}">${na ? fmtDate(na) : '<span class="text-danger">⚠️ Brak</span>'}</td>
      <td>${d['Deal - Total activities'] || 0}</td>
      <td>${spaceshipLink(d)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table class="data-table" id="deals-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows || '<tr><td colspan="11" class="empty-state">Brak dealów</td></tr>'}</tbody>
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

  const kpiEl = document.getElementById('lost-mrr-kpi');
  if (kpiEl) {
    const totalLost = deals.filter(d => norm(d['Deal - Status']) === 'lost').reduce((s, d) => s + parseMRR(d['Deal - MRR']), 0);
    kpiEl.innerHTML = `
      <div class="kpi-label">Utracony potencjał MRR</div>
      <div class="kpi-value kpi-value--danger">${totalLost > 0 ? fmtNum(totalLost) + ' zł' : '—'}</div>`;
  }

  const tblEl = document.getElementById('lost-table-container');
  if (!tblEl) return;
  const lost = deals.filter(d => norm(d['Deal - Status']) === 'lost')
    .sort((a, b) => (parseDate(b['Deal - Lost time']) || 0) - (parseDate(a['Deal - Lost time']) || 0));

  const rows = lost.map(d => `<tr>
    <td><strong>${dealName(d)}</strong></td>
    <td>${partnerBadge(d)}</td>
    <td>${fmtMRR(d['Deal - MRR'])}</td>
    <td>${fmtDate(d['Deal - Lost time'] || d['Deal - Deal closed on'])}</td>
    <td><span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span></td>
  </tr>`).join('');

  tblEl.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Firma</th><th>Partner</th><th>MRR</th><th>Data utraty</th><th>Etap</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty-state">Brak</td></tr>'}</tbody>
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
        d => fmtMRR(d['Deal - MRR']),
        d => `<span class="stage-badge">${esc(d['Deal - Stage'] || '—')}</span>`,
      ])}
      ${mini('✅ Wygrane', 'won', delta.wonDeals, [
        d => `<strong>${dealName(d)}</strong>`,
        d => partnerBadge(d),
        d => fmtMRR(d['Deal - MRR']),
      ])}
      ${mini('❌ Przegrane', 'lost', delta.lostDeals, [
        d => `<strong>${dealName(d)}</strong>`,
        d => partnerBadge(d),
        d => fmtMRR(d['Deal - MRR']),
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
  renderAlerts(deals);
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
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Plik JSON musi zawierać tablicę dealów.');
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
