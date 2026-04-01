async function loadDashboard() {
    const response = await fetch('dashboard_data.json');
    const data = await response.json();

    // Uzupełnianie liczb (KPI)
    document.getElementById('total-value').innerText = data.total_value.toLocaleString() + ' PLN';
    document.getElementById('win-rate').innerText = data.win_rate + '%';
    document.getElementById('pipe-count').innerText = data.pipeline_count;
    document.getElementById('median-days').innerText = data.median_days + ' dni';

    // Wykres Partnerów (Punkt 5)
    new Chart(document.getElementById('partnerChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(data.partners),
            datasets: [{ data: Object.values(data.partners), backgroundColor: ['#0055ff', '#00d4ff'] }]
        }
    });

    // Wykres Branż (Punkt 6)
    new Chart(document.getElementById('industryChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(data.industries),
            datasets: [{ data: Object.values(data.industries), backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'] }]
        }
    });

    // Wykres Trendu (Punkt 1)
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: Object.keys(data.monthly_trend),
            datasets: [{ label: 'Nowe Deale', data: Object.values(data.monthly_trend), borderColor: '#4bc0c0', fill: true }]
        }
    });
}

function showView(viewName) {
    document.getElementById('director-view').style.display = viewName === 'director' ? 'block' : 'none';
    document.getElementById('manager-view').style.display = viewName === 'manager' ? 'block' : 'none';
}

loadDashboard();