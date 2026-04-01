async function init() {
    // 1. Pobieranie danych
    const res = await fetch('dashboard_data.json');
    const data = await res.json();
    const cur = data.current;

    // 2. Obsługa danych liczbowych (KPI)
    // Punkt 2: Suma Deal Value
    document.getElementById('total-val').innerText = cur.total_value.toLocaleString() + ' PLN';

    // Punkt 3: MRR (z dodaniem wskaźnika zmiany pod spodem, jeśli masz deltę w JSON)
    document.getElementById('mrr-val').innerText = cur.mrr_total.toLocaleString() + ' PLN';

    // Punkt 4: Global Win Rate
    document.getElementById('win-rate').innerText = cur.win_rate + '%';

    // Punkt 8: Liczba deali w lejku
    document.getElementById('pipe-count').innerText = cur.pipeline_count;

    // Punkt 7: Mediana czasu zamknięcia
    document.getElementById('median-days').innerText = cur.median_days + ' dni';

    // Obsługa wskaźnika zmiany (WoW) dla Total Value (Twój wymóg przepływu danych)
    const deltaContainer = document.getElementById('value-delta');
    if (data.delta_wow_value > 0) {
        deltaContainer.innerHTML = `<span class="delta up">▲ +${data.delta_wow_value.toLocaleString()} PLN vs ost. tydzień</span>`;
    } else if (data.delta_wow_value < 0) {
        deltaContainer.innerHTML = `<span class="delta down">▼ ${data.delta_wow_value.toLocaleString()} PLN vs ost. tydzień</span>`;
    }

    // 3. Wykres Trendu (Punkt 1: Ilość pozyskanych deali)
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
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Trend pozyskiwania deali (Miesięcznie)' },
                tooltip: {
                    callbacks: {
                        // Tutaj można dopisać logikę obliczania % zmiany w tooltipie
                        label: function(context) {
                            return `Ilość: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });

    // 4. Wykres Partnerów (Punkt 5)
    new Chart(document.getElementById('partnerChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(cur.partners),
            datasets: [{
                data: Object.values(cur.partners),
                backgroundColor: ['#0055ff', '#00d4ff', '#a29bfe']
            }]
        },
        options: {
            plugins: {
                title: { display: true, text: 'Udział Partnerów (eRecruiter vs Pracuj.pl)' }
            }
        }
    });

    // 5. Wykres Branż (Punkt 6: Revenue per Industry)
    new Chart(document.getElementById('industryChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(cur.industries),
            datasets: [{
                label: 'Wartość deali (PLN)',
                data: Object.values(cur.industries),
                backgroundColor: '#4bc0c0'
            }]
        },
        options: {
            indexAxis: 'y', // Wykres poziomy lepiej wygląda dla branż
            plugins: {
                title: { display: true, text: 'Przychody według Branży' }
            }
        }
    });
}

init();