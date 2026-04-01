const Dashboard = (() => {
    async function loadData() {
        const res = await fetch('dashboard_data.json');
        return res.json();
    }

    function renderKPIs(cur, deltaWow) {
        const set = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        set('total-val', cur.total_value.toLocaleString() + ' PLN');
        set('win-rate', cur.win_rate + '%');
        set('pipe-count', cur.pipeline_count);
        set('median-days', cur.median_days + ' dni');
        set('mrr-val', cur.mrr_total.toLocaleString() + ' PLN');

        const deltaContainer = document.getElementById('value-delta');
        if (deltaContainer && deltaWow !== undefined) {
            if (deltaWow > 0) {
                deltaContainer.innerHTML = `<span class="delta up">▲ +${deltaWow.toLocaleString()} PLN</span>`;
            } else if (deltaWow < 0) {
                deltaContainer.innerHTML = `<span class="delta down">▼ ${deltaWow.toLocaleString()} PLN</span>`;
            }
        }
    }

    function renderCharts(cur) {
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: Object.keys(cur.trend),
                datasets: [{
                    label: 'Liczba nowych deali',
                    data: Object.values(cur.trend),
                    borderColor: '#0055ff',
                    backgroundColor: 'rgba(0, 85, 255, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            }
        });

        new Chart(document.getElementById('partnerChart'), {
            type: 'pie',
            data: {
                labels: Object.keys(cur.partners),
                datasets: [{
                    data: Object.values(cur.partners),
                    backgroundColor: ['#0055ff', '#00d4ff', '#a29bfe']
                }]
            }
        });

        new Chart(document.getElementById('industryChart'), {
            type: 'bar',
            data: {
                labels: Object.keys(cur.industries),
                datasets: [{
                    label: 'Wartość (PLN)',
                    data: Object.values(cur.industries),
                    backgroundColor: '#4bc0c0'
                }]
            },
            options: { indexAxis: 'y' }
        });
    }

    async function init() {
        try {
            const data = await loadData();
            renderKPIs(data.current, data.delta_wow_value);
            renderCharts(data.current);
        } catch (error) {
            console.error("Błąd ładowania danych dashboardu:", error);
        }
    }

    return { init };
})();

const StatusDot = (() => {
    function randomColor() {
        return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    }

    function init() {
        const dot = document.getElementById('status-dot');
        if (!dot) return;

        let baseColor = '#e74c3c';
        dot.style.backgroundColor = baseColor;

        dot.addEventListener('mouseenter', () => {
            dot.style.backgroundColor = '#27ae60';
        });

        dot.addEventListener('mouseleave', () => {
            dot.style.backgroundColor = baseColor;
        });

        dot.addEventListener('mousedown', () => {
            dot.style.backgroundColor = '#f1c40f';
        });

        dot.addEventListener('mouseup', () => {
            baseColor = randomColor();
            dot.style.backgroundColor = baseColor;
        });
    }

    return { init };
})();

Dashboard.init();
StatusDot.init();
