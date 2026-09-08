document.addEventListener('DOMContentLoaded', () => {
    const stateSelect = document.getElementById('state-select');
    const parkSelect = document.getElementById('park-select');
    const generateBtn = document.getElementById('generate-btn');
    
    const welcomeMessage = document.getElementById('welcome-message');
    const viewportLoader = document.getElementById('viewport-loader');
    const viewportImageContainer = document.getElementById('viewport-image-container');
    const generatedMap = document.getElementById('generated-map');
    
    // Metadata fields
    const parkDetailsCard = document.getElementById('park-details-card');
    const detailDesignation = document.getElementById('detail-designation');
    const detailArea = document.getElementById('detail-area');
    const detailYear = document.getElementById('detail-year');
    const detailIucn = document.getElementById('detail-iucn');

    // 1. Fetch and populate states on load
    fetch('/api/states')
        .then(res => res.json())
        .then(states => {
            states.forEach(state => {
                const opt = document.createElement('option');
                opt.value = state;
                opt.textContent = state;
                stateSelect.appendChild(opt);
            });
        })
        .catch(err => console.error('Error loading states:', err));

    // 2. Handle state selection change
    stateSelect.addEventListener('change', () => {
        const selectedState = stateSelect.value;
        if (!selectedState) return;

        // Reset park select & generate button
        parkSelect.innerHTML = '<option value="" disabled selected>Loading protected areas...</option>';
        parkSelect.disabled = true;
        generateBtn.disabled = true;
        
        // Fetch parks for the state
        fetch(`/api/parks?state=${encodeURIComponent(selectedState)}`)
            .then(res => res.json())
            .then(parks => {
                parkSelect.innerHTML = '';
                
                if (parks.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = "";
                    opt.textContent = "No protected areas found";
                    opt.disabled = true;
                    opt.selected = true;
                    parkSelect.appendChild(opt);
                    return;
                }

                // Add placeholder option
                const placeholder = document.createElement('option');
                placeholder.value = "";
                placeholder.textContent = "Choose a park...";
                placeholder.disabled = true;
                placeholder.selected = true;
                parkSelect.appendChild(placeholder);

                // Populate choices
                parks.forEach(park => {
                    const opt = document.createElement('option');
                    opt.value = park.id;
                    opt.textContent = `${park.name} (${park.designation})`;
                    // Store extra data
                    opt.dataset.designation = park.designation;
                    opt.dataset.area = park.area_km2;
                    opt.dataset.year = park.status_yr;
                    parkSelect.appendChild(opt);
                });

                parkSelect.disabled = false;
            })
            .catch(err => {
                console.error('Error loading parks:', err);
                parkSelect.innerHTML = '<option value="" disabled selected>Error loading parks</option>';
            });
    });

    // 3. Handle park selection change
    parkSelect.addEventListener('change', () => {
        generateBtn.disabled = !parkSelect.value;
    });

    let map = null;
    let eeTileLayer = null;

    // 4. Handle generate map action
    generateBtn.addEventListener('click', () => {
        const state = stateSelect.value;
        const parkId = parkSelect.value;

        const basemapState = document.getElementById('basemap-state').checked;
        const basemapPark = document.getElementById('basemap-park').checked;
        const ndviState = document.getElementById('ndvi-state').checked;
        const ndviPark = document.getElementById('ndvi-park').checked;

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!state || !parkId || !startDate || !endDate) return;

        // UI State: Loading
        welcomeMessage.classList.add('hidden');
        viewportImageContainer.classList.add('hidden');
        viewportLoader.classList.remove('hidden');
        generateBtn.disabled = true;
        stateSelect.disabled = true;
        parkSelect.disabled = true;

        fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                state, 
                park_id: parkId,
                start_date: startDate,
                end_date: endDate,
                basemap_state: basemapState,
                basemap_park: basemapPark,
                ndvi_state: ndviState,
                ndvi_park: ndviPark
            })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate map');
            return data;
        })
        .then(data => {
            viewportLoader.classList.add('hidden');
            viewportImageContainer.classList.remove('hidden');

            // Initialize map if it doesn't exist
            if (!map) {
                map = L.map('generated-map');

                const darkBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
                    maxZoom: 16
                });

                const satelliteBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, AeroGRID',
                    maxZoom: 18
                });

                darkBasemap.addTo(map);

                const baseLayers = {
                    "Dark Canvas": darkBasemap,
                    "Satellite": satelliteBasemap
                };
                L.control.layers(baseLayers, null, { position: 'bottomright' }).addTo(map);
            }

            // Remove previous EE layer if exists
            if (eeTileLayer) {
                map.removeLayer(eeTileLayer);
            }

            // Add new EE layer
            eeTileLayer = L.tileLayer(data.tile_url).addTo(map);

            // Center map
            map.setView([data.center[1], data.center[0]], 10);

            // Update Metadata Card
            const details = data.park_details;
            detailDesignation.textContent = details.designation || 'Protected Area';
            detailArea.textContent = details.area_km2 ? `${parseFloat(details.area_km2).toFixed(2)} km²` : 'Not Reported';
            detailYear.textContent = details.status_yr || 'Unknown';
            detailIucn.textContent = details.iucn_cat || 'Not Classified';

            parkDetailsCard.classList.remove('hidden');

            // Save export info and show export card
            currentHighResUrl = data.high_res_url;
            currentParkId = parkId;
            currentParkName = details.name || 'park';
            exportCard.classList.remove('hidden');
        })
        .catch(err => {
            console.error(err);
            viewportLoader.classList.add('hidden');
            welcomeMessage.classList.remove('hidden');
            
            // Show error message inside welcome layout
            const title = welcomeMessage.querySelector('h2');
            const desc = welcomeMessage.querySelector('p');
            title.textContent = "Processing Failed";
            desc.textContent = err.message || "Could not generate NDVI map. Please check selection or try another area.";
            title.style.color = "#ef4444";
        })
        .finally(() => {
            // Re-enable controls
            stateSelect.disabled = false;
            parkSelect.disabled = false;
            generateBtn.disabled = false;
        });

        // Also fetch and render the time-series chart
        const chartViewport = document.getElementById('chart-viewport');
        chartViewport.classList.add('hidden');
        downloadCsvBtn.disabled = true;
        downloadChartBtn.disabled = true;

        fetch('/api/timeseries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ park_id: parkId, start_date: startDate, end_date: endDate })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            if (data.length > 0) {
                currentTimeSeriesData = data;
                renderChart(data);
                chartViewport.classList.remove('hidden');
                downloadCsvBtn.disabled = false;
                downloadChartBtn.disabled = false;
            }
        })
        .catch(err => console.error("Chart error:", err));
    });

    // Export & Download event listeners
    const exportCard = document.getElementById('export-card');
    const downloadMapBtn = document.getElementById('download-map-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const downloadChartBtn = document.getElementById('download-chart-btn');
    const downloadShapefileBtn = document.getElementById('download-shapefile-btn');
    const downloadGeojsonBtn = document.getElementById('download-geojson-btn');

    let currentHighResUrl = null;
    let currentParkId = null;
    let currentParkName = '';
    let currentTimeSeriesData = [];

    downloadMapBtn.addEventListener('click', () => {
        if (currentHighResUrl) {
            window.open(currentHighResUrl, '_blank');
        }
    });

    downloadCsvBtn.addEventListener('click', () => {
        if (!currentTimeSeriesData || currentTimeSeriesData.length === 0) return;
        let csvContent = "data:text/csv;charset=utf-8,Date,Mean_NDVI\n" +
            currentTimeSeriesData.map(d => `${d.date},${d.ndvi}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${(currentParkName || 'park').replace(/\s+/g, '_')}_ndvi_timeseries.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    downloadChartBtn.addEventListener('click', () => {
        if (!ndviChart) return;
        const link = document.createElement("a");
        link.href = ndviChart.toBase64Image();
        link.download = `${(currentParkName || 'park').replace(/\s+/g, '_')}_chart.png`;
        link.click();
    });

    downloadShapefileBtn.addEventListener('click', () => {
        if (!currentParkId) return;
        const origText = downloadShapefileBtn.querySelector('span').textContent;
        downloadShapefileBtn.disabled = true;
        downloadShapefileBtn.querySelector('span').textContent = 'Generating Shapefile...';
        fetch(`/api/download/shapefile?park_id=${currentParkId}`)
            .then(res => res.json())
            .then(data => {
                if (data.download_url) {
                    window.open(data.download_url, '_blank');
                } else {
                    alert('Shapefile generation error: ' + (data.error || 'Unknown'));
                }
            })
            .catch(err => alert('Error: ' + err))
            .finally(() => {
                downloadShapefileBtn.disabled = false;
                downloadShapefileBtn.querySelector('span').textContent = origText;
            });
    });

    downloadGeojsonBtn.addEventListener('click', () => {
        if (!currentParkId) return;
        const origText = downloadGeojsonBtn.querySelector('span').textContent;
        downloadGeojsonBtn.disabled = true;
        downloadGeojsonBtn.querySelector('span').textContent = 'Fetching GeoJSON...';
        fetch(`/api/download/geojson?park_id=${currentParkId}`)
            .then(res => res.json())
            .then(data => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(currentParkName || 'park').replace(/\s+/g, '_')}.geojson`;
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(err => alert('Error: ' + err))
            .finally(() => {
                downloadGeojsonBtn.disabled = false;
                downloadGeojsonBtn.querySelector('span').textContent = origText;
            });
    });

    let ndviChart = null;
    function renderChart(data) {
        const ctx = document.getElementById('ndvi-chart').getContext('2d');
        const labels = data.map(d => d.date);
        const values = data.map(d => d.ndvi);

        if (ndviChart) {
            ndviChart.destroy();
        }

        ndviChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mean NDVI',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#10b981',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af', maxTicksLimit: 10 }
                    },
                    y: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af' },
                        min: Math.min(0, Math.min(...values)) < 0 ? -0.2 : 0,
                        max: 1
                    }
                }
            }
        });
    }
});
