// Ścieżka do Twojego pliku CSV w repozytorium
const csvUrl = 'food-production-prospectlist.csv';

Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
        const data = results.data;

        // Funkcja do zliczania wartości w kolumnie
        const countData = (columnName) => {
            const counts = {};
            data.forEach(row => {
                const val = row[columnName];
                if (val) {
                    counts[val] = (counts[val] || 0) + 1;
                }
            });
            return counts;
        };

        const cityData = countData('City');
        const industryData = countData('Company industry');

        createPieChart('cityChart', cityData, 'Miasta');
        createPieChart('industryChart', industryData, 'Branże');
    }
});

function createPieChart(canvasId, dataMap, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                label: label,
                data: Object.values(dataMap),
                backgroundColor: [
                    '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}