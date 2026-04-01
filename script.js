async function init() {
    try {
        const res = await fetch('dashboard_data.json');
        const data = await res.json();
        const cur = data.current;

        // 1. Dane liczbowe
        if(document.getElementById('total-val'))
            document.getElementById('total-val').innerText = cur.total_value.toLocaleString() + ' PLN';

        if(document.getElementById('win-rate'))
            document.getElementById('win-rate').innerText = cur.win_rate + '%';

        if(document.getElementById('pipe-count'))
            document.getElementById('pipe-count').innerText = cur.pipeline_count;

        if(document.getElementById('median-days'))
            document.getElementById('median-days').innerText = cur.median_days + ' dni';

        if(document.getElementById('mrr-val'))
            document.getElementById('mrr-val').innerText = cur.mrr_total.toLocaleString() + ' PLN';

        // 2. Obsługa wskaźnika WoW
        const deltaContainer = document.getElementById('value-delta');
        if (deltaContainer && data.delta_wow_value !== undefined) {
            if (data.delta_wow_value > 0) {
                deltaContainer.innerHTML = `<span class="delta up">▲ +${data.delta_wow_value.toLocaleString()} PLN</span>`;
            } else if (data.delta_wow_value < 0) {
                deltaContainer.innerHTML = `<span class="delta down">▼ ${data.delta_wow_value.toLocaleString()} PLN</span>`;
            }
        }

        // 3. Wykresy
        this.renderCharts(cur);

    } catch (error) {
        console.error("Błąd ładowania danych dashboardu:", error);
    }
}

function renderCharts(cur) {
    // Trend Chart
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

    // Partner Chart
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

    // Industry Chart
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

init();