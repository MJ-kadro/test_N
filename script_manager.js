/* =============================================
   KADROMIERZ × PRACUJ — PIPELINE DASHBOARD
   Sales Manager tab
   Requires: script_director.js loaded first
   ============================================= */

// ---- LOST BY REASON CHART ----
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
    if (r === 'Duplikat') r = 'Odrzucone (duplikat)';
    byReason[r] = (byReason[r] || 0) + 1;
  });
  const entries = Object.entries(byReason).sort(([, a], [, b]) => b - a);

  state.charts['lost-stage'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(([s]) => s),
      datasets: [{ label: 'Liczba', data: entries.map(([, c]) => c), backgroundColor: '#c0392b' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

// ---- FUNNEL CHART ----
function renderFunnel(deals) {
  destroyChart('funnel');
  const ctx = document.getElementById('chart-funnel');
  if (!ctx) return;

  const fd = getFunnelData(deals);
  const openCount = deals.filter(d => norm(d['Deal - Status']) === 'open').length;
  const titleEl = document.getElementById('funnel-chart-title');
  if (titleEl) titleEl.textContent = `Lejek sprzedażowy · ${openCount} aktywnych`;

  const colors = fd.map(item => item.stage === 'Blocked' ? '#b86b00' : '#1a4a8a');

  state.charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: fd.map(f => f.stage),
      datasets: [{ data: fd.map(f => f.count), backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.parsed.x} dealów` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 12 } } },
      },
    },
  });

  const popup = document.getElementById('funnel-info-popup');
  if (popup) {
    popup.innerHTML = Object.entries(FUNNEL_DESC)
      .map(([stage, desc]) => `<div class="stage-info-row"><strong>${esc(stage)}</strong><span>${esc(desc)}</span></div>`)
      .join('');
  }
}

// ---- CUMULATIVE FUNNEL CHART ----
function renderCumulativeFunnelChart(deals) {
  destroyChart('cumulative-funnel');
  const ctx = document.getElementById('chart-cumulative-funnel');
  if (!ctx) return;

  const stageCounts = {};
  FUNNEL_STAGES.forEach(s => { stageCounts[s] = deals.filter(d => d['Deal - Stage'] === s).length; });

  const titleEl = document.getElementById('cumulative-funnel-title');
  if (titleEl) titleEl.textContent = `Skumulowany lejek · ${deals.length} leadów`;

  const total = deals.length;
  let cumSubtract = 0;
  const values = FUNNEL_STAGES.map(stage => {
    const val = total - cumSubtract;
    cumSubtract += stageCounts[stage];
    return val;
  });

  state.charts['cumulative-funnel'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FUNNEL_STAGES,
      datasets: [{
        label: 'Skumulowana liczba dealów',
        data: values,
        backgroundColor: FUNNEL_STAGES.map(s => s === 'Blocked' ? '#b86b00' : '#1a4a8a'),
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
        y: { ticks: { font: { size: 12 } } },
      },
    },
  });
}

// ---- FUNNEL FLOW (hidden) ----
function renderFunnelFlow(deals) {
  destroyChart('funnel-flow');
  // Container is hidden — no-op unless re-enabled
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
    { label: 'Firma',        key: 'Deal - Title' },
    { label: 'Etap',         key: 'Deal - Stage' },
    { label: 'Partner',      key: 'Deal - Nazwa Partnera' },
    { label: 'Wartość',      key: 'Deal - Value' },
    { label: 'Data dodania', key: 'Deal - Deal created' },
    { label: 'Aktywności',   key: 'Deal - Total activities' },
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
    .sort((a, b) => (parseDate(b['Deal - Lost time'] || b['Deal - Deal closed on']) || 0) - (parseDate(a['Deal - Lost time'] || a['Deal - Deal closed on']) || 0));

  const rows = lost.map(d => {
    let reason = (d['Deal - Lost reason'] || '').trim() || '—';
    if (reason === 'Duplikat') reason = 'Odrzucone (duplikat)';
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

// ---- WON TABLE ----
function renderWonTable(deals) {
  const el = document.getElementById('won-table-container');
  if (!el) return;
  const won = deals.filter(d => norm(d['Deal - Status']) === 'won')
    .sort((a, b) => (parseDate(b['Deal - Won time'] || b['Deal - Deal closed on']) || 0) - (parseDate(a['Deal - Won time'] || a['Deal - Deal closed on']) || 0));

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

// ---- AI SUMMARY — MANAGER ----
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
  const blocked  = funnelData.find(f => f.stage === 'Blocked');

  let text = '';
  if (topStage.count > 0) text += `Lejek koncentruje się głównie na etapie <strong>${esc(topStage.stage)}</strong> (${topStage.count} otwartych dealów). `;
  if (blocked && blocked.count > 0) {
    const blockedPct = open.length > 0 ? ((blocked.count / open.length) * 100).toFixed(0) : 0;
    text += `⚠️ <strong>${blocked.count} dealów jest Blocked</strong> (${blockedPct}% aktywnego pipeline) — wymagają działania lub decyzji o zamknięciu. `;
  }
  if (topReasons.length > 0) {
    const [topReason, topCount] = topReasons[0];
    const pct = lost.length > 0 ? ((topCount / lost.length) * 100).toFixed(0) : 0;
    const label = topReason === 'Duplikat' ? 'Odrzucone (duplikat)' : topReason;
    text += `Dominujący powód utraty: <strong>"${esc(label)}"</strong> — ${topCount} dealów (${pct}% wszystkich strat). `;
    if (topReasons.length > 1) {
      const [r2, c2] = topReasons[1];
      const label2 = r2 === 'Duplikat' ? 'Odrzucone (duplikat)' : r2;
      text += `Drugi w kolejności: <strong>"${esc(label2)}"</strong> (${c2} dealów). `;
    }
  }
  if (lost.length > 0 && open.length > 0) {
    const ratio = (open.length / lost.length).toFixed(1);
    text += `Na każdy utracony deal przypada ${ratio} aktywnych — `;
    text += parseFloat(ratio) < 2 ? `stosunek wymaga uwagi. ` : `stosunek wskazuje na zdrowy pipeline. `;
  }
  const metrics = calcMetrics(deals);
  if (metrics.avgDaysToClose !== null) text += `Mediana czasu zamknięcia deala: <strong>${metrics.avgDaysToClose} dni</strong>.`;

  el.innerHTML = `<div class="ai-summary-card">
    <div class="ai-summary-label">✦ Podsumowanie AI</div>
    <div class="ai-summary-text">${text}</div>
  </div>`;
}

// ---- GP STATUS FLOW ALERTS ----

// Helper: badge partnera dla wpisów GP (mają pole d.partner, nie d['Deal - Nazwa Partnera'])
function _gpPartnerBadge(partner) {
  if (!partner || partner === '—') return '<span class="partner-badge">—</span>';
  const cls = partner === 'Pracuj.pl' ? 'pracuj' : 'erecruiter';
  return `<span class="partner-badge partner-badge--${cls}">${esc(partner)}</span>`;
}

// Definicje 6 kategorii alertów GP
const GP_CATEGORIES = [
  {
    key:     'lead_confirmed',
    label:   'Potwierdzenie przejęcia leada',
    tooltip: 'Deal stworzony między raportami, status aktywny, etap ≠ Prospect',
    accent:  '#1a4a8a',
    cols:    ['Firma', 'Partner', 'Etap', 'Wartość', 'Data przejęcia'],
    row: d => `<tr>
      <td><strong>${esc(d.title)}</strong></td>
      <td>${_gpPartnerBadge(d.partner)}</td>
      <td><span class="stage-badge">${esc(d.stage || '—')}</span></td>
      <td>${fmtMRR(d.value)}</td>
      <td>${fmtDate(d.date)}</td>
    </tr>`,
  },
  {
    key:     'meeting_scheduled',
    label:   'Umówienie spotkania z klientem',
    tooltip: 'Zadanie "Online Prezentacja" dodane w Pipedrive między raportami',
    accent:  '#0055ff',
    cols:    ['Firma', 'Partner', 'Etap', 'Wartość', 'Data zadania'],
    row: d => `<tr>
      <td><strong>${esc(d.title)}</strong></td>
      <td>${_gpPartnerBadge(d.partner)}</td>
      <td><span class="stage-badge">${esc(d.stage || '—')}</span></td>
      <td>${fmtMRR(d.value)}</td>
      <td>${fmtDate(d.date)}</td>
    </tr>`,
  },
  {
    key:     'trial_started',
    label:   'Uruchomienie Trialu',
    tooltip: 'Pole "Organization - Spaceship link" uzupełnione między raportami',
    accent:  '#6b21a8',
    cols:    ['Firma', 'Partner', 'Etap', 'Wartość'],
    row: d => `<tr>
      <td><strong>${esc(d.title)}</strong></td>
      <td>${_gpPartnerBadge(d.partner)}</td>
      <td><span class="stage-badge">${esc(d.stage || '—')}</span></td>
      <td>${fmtMRR(d.value)}</td>
      <td>${d.spaceship_link
        ? `<a href="${esc(d.spaceship_link)}" target="_blank" class="gp-link">🔗 Link</a>`
        : '—'}</td>
      <td>${fmtDate(d.date)}</td>
    </tr>`,
  },

  {
    key:     'rejected',
    label:   'Odrzucenie / brak zainteresowania',
    tooltip: '"Zastał przy obecnym rozwiązaniu" lub "Brak decyzji" — nowa strata między raportami',
    accent:  '#c0392b',
    cols:    ['Firma', 'Partner', 'Wartość', 'Powód utraty', 'Data zamknięcia'],
    row: d => `<tr>
      <td><strong>${esc(d.title)}</strong></td>
      <td>${_gpPartnerBadge(d.partner)}</td>
      <td>${fmtMRR(d.value)}</td>
      <td><em>${esc(d.lost_reason || '—')}</em></td>
      <td>${fmtDate(d.date)}</td>
    </tr>`,
  },
  {
    key:     'deal_closed',
    label:   'Zamknięcie sprzedaży (Won / Lost)',
    tooltip: 'Deale zamknięte między raportami z wyłączeniem odrzuceń (kategoria wyżej)',
    accent:  '#1a7a4a',
    cols:    ['Firma', 'Partner', 'Wartość', 'Wynik', 'Powód', 'Data zamknięcia'],
    row: d => {
      const outcomeHtml = d.outcome === 'won'
        ? '<span class="stage-badge" style="background:#d1fae5;color:#1a7a4a">Won</span>'
        : '<span class="stage-badge" style="background:#fee2e2;color:#c0392b">Lost</span>';
      return `<tr class="${d.outcome === 'won' ? 'row--won' : ''}">
        <td><strong>${esc(d.title)}</strong></td>
        <td>${_gpPartnerBadge(d.partner)}</td>
        <td>${fmtMRR(d.value)}</td>
        <td>${outcomeHtml}</td>
        <td><em>${esc(d.lost_reason || '—')}</em></td>
        <td>${fmtDate(d.date)}</td>
      </tr>`;
    },
  },
];

function renderGPAlerts(gpAlerts) {
  const el = document.getElementById('gp-alerts-container');
  if (!el) return;

  if (!gpAlerts) {
    el.innerHTML = `<div class="gp-flow-wrapper">
      <p class="empty-state">⚠️ Brak danych alertów GP. Uruchom <code>python convert.py</code> i odśwież stronę.</p>
    </div>`;
    return;
  }

  // Aktualizuj nagłówek okresu
  const periodEl = document.getElementById('gp-alerts-period');
  const prev = gpAlerts.prev_report_date;
  const curr = gpAlerts.current_report_date;
  if (periodEl && prev && curr) {
    periodEl.textContent = `${fmtDate(prev)} → ${fmtDate(curr)}`;
  }

  const activePartner = state.partner;
  const applyFilter = items => activePartner === 'all'
    ? items
    : items.filter(d => d.partner === activePartner);

  const cardsHtml = GP_CATEGORIES.map(cat => {
    const allItems = gpAlerts[cat.key] || [];
    const items = applyFilter(allItems);

    const countBadge = allItems.length > 0
      ? `<span class="gp-count gp-count--active">${items.length}</span>`
      : `<span class="gp-count">0</span>`;

    let bodyHtml;
    if (items.length === 0) {
      bodyHtml = `<p class="gp-empty">Brak zdarzeń w tym okresie${activePartner !== 'all' ? ` dla ${esc(activePartner)}` : ''}.</p>`;
    } else {
      const headers = cat.cols.map(c => `<th>${c}</th>`).join('');
      const rows    = items.map(d => cat.row(d)).join('');
      bodyHtml = `<div class="gp-table-wrap"><table class="data-table">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    const tooltipHtml = cat.tooltip
      ? `<span class="gp-tooltip-icon" tabindex="0">ⓘ<span class="gp-tooltip-text">${esc(cat.tooltip)}</span></span>`
      : '';

    return `<div class="gp-alert-card" style="--gp-accent:${cat.accent}">
      <div class="gp-alert-header">
        <span class="gp-alert-icon">${cat.icon}</span>
        <span class="gp-label">${esc(cat.label)}</span>
        ${tooltipHtml}
        ${countBadge}
      </div>
      <div class="gp-alert-body">${bodyHtml}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="gp-flow-wrapper">${cardsHtml}</div>`;
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
  renderGPAlerts(state.gpAlerts);
}
