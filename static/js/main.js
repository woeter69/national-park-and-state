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
    let eeTileLayerB = null;
    let sideBySideControl = null;
    let sdmLayer = null;
    let presenceMarkersLayer = null;

    let currentMode = 'ndvi'; // 'ndvi' | 'sdm'
    let currentLayersData = null;
    let currentLayersDataB = null;
    let isCompareActive = false;

    const activeLayers = {
        basemap_state: null,
        basemap_park: null,
        ndvi_state: null,
        ndvi_park: null,
        boundaries: null
    };

    const mapModeSwitcher = document.getElementById('map-mode-switcher');
    const modeNdviBtn = document.getElementById('mode-ndvi-btn');
    const modeSdmBtn = document.getElementById('mode-sdm-btn');
    const ndviLegend = document.getElementById('ndvi-legend');

    function syncNdviLayersVisibility() {
        if (!map || !currentLayersData || currentMode !== 'ndvi') return;

        if (isCompareActive) {
            if (eeTileLayer && !map.hasLayer(eeTileLayer)) eeTileLayer.addTo(map);
            if (eeTileLayerB && !map.hasLayer(eeTileLayerB)) eeTileLayerB.addTo(map);
            if (sideBySideControl) sideBySideControl.addTo(map);
            compareLabels.classList.remove('hidden');
            return;
        }

        const layerMapping = [
            { id: 'basemap-state', key: 'basemap_state', zIndex: 10 },
            { id: 'basemap-park', key: 'basemap_park', zIndex: 20 },
            { id: 'ndvi-state', key: 'ndvi_state', zIndex: 30 },
            { id: 'ndvi-park', key: 'ndvi_park', zIndex: 40 },
            { id: 'boundary-outlines', key: 'boundaries', zIndex: 50 }
        ];

        layerMapping.forEach(item => {
            const cb = document.getElementById(item.id);
            const shouldShow = cb ? cb.checked : false;
            const url = currentLayersData[item.key];

            if (shouldShow && url) {
                if (!activeLayers[item.key]) {
                    activeLayers[item.key] = L.tileLayer(url, { zIndex: item.zIndex });
                }
                if (!map.hasLayer(activeLayers[item.key])) {
                    activeLayers[item.key].addTo(map);
                }
            } else {
                if (activeLayers[item.key] && map.hasLayer(activeLayers[item.key])) {
                    map.removeLayer(activeLayers[item.key]);
                }
            }
        });
    }

    function setMapMode(mode) {
        currentMode = mode;

        if (mode === 'ndvi') {
            if (modeNdviBtn) {
                modeNdviBtn.style.background = '#10b981';
                modeNdviBtn.style.color = '#ffffff';
            }
            if (modeSdmBtn && !modeSdmBtn.disabled) {
                modeSdmBtn.style.background = 'transparent';
                modeSdmBtn.style.color = 'var(--text-secondary)';
            }

            // Hide SDM layers and legend
            if (sdmLayer && map && map.hasLayer(sdmLayer)) {
                map.removeLayer(sdmLayer);
            }
            if (presenceMarkersLayer && map && map.hasLayer(presenceMarkersLayer)) {
                map.removeLayer(presenceMarkersLayer);
            }
            const sdmLegendEl = document.getElementById('sdm-legend');
            if (sdmLegendEl) sdmLegendEl.classList.add('hidden');

            // Show NDVI legend
            if (ndviLegend) ndviLegend.classList.remove('hidden');

            // Restore NDVI layers
            syncNdviLayersVisibility();
        } else if (mode === 'sdm') {
            if (modeSdmBtn) {
                modeSdmBtn.style.background = '#ef4444';
                modeSdmBtn.style.color = '#ffffff';
            }
            if (modeNdviBtn) {
                modeNdviBtn.style.background = 'transparent';
                modeNdviBtn.style.color = 'var(--text-secondary)';
            }

            // Hide NDVI layers and compare controls
            Object.keys(activeLayers).forEach(k => {
                if (activeLayers[k] && map && map.hasLayer(activeLayers[k])) {
                    map.removeLayer(activeLayers[k]);
                }
            });
            if (eeTileLayer && map && map.hasLayer(eeTileLayer)) {
                map.removeLayer(eeTileLayer);
            }
            if (eeTileLayerB && map && map.hasLayer(eeTileLayerB)) {
                map.removeLayer(eeTileLayerB);
            }
            if (sideBySideControl) {
                map.removeControl(sideBySideControl);
            }
            if (compareLabels) compareLabels.classList.add('hidden');

            // Hide NDVI legend
            if (ndviLegend) ndviLegend.classList.add('hidden');

            // Show SDM layers and legend
            if (sdmLayer && map && !map.hasLayer(sdmLayer)) {
                sdmLayer.addTo(map);
            }
            if (presenceMarkersLayer && map && !map.hasLayer(presenceMarkersLayer)) {
                presenceMarkersLayer.addTo(map);
            }
            const sdmLegendEl = document.getElementById('sdm-legend');
            if (sdmLegendEl) sdmLegendEl.classList.remove('hidden');
        }
    }

    if (modeNdviBtn) {
        modeNdviBtn.addEventListener('click', () => setMapMode('ndvi'));
    }
    if (modeSdmBtn) {
        modeSdmBtn.addEventListener('click', () => {
            if (!modeSdmBtn.disabled) setMapMode('sdm');
        });
    }

    ['basemap-state', 'basemap-park', 'ndvi-state', 'ndvi-park', 'boundary-outlines'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (currentLayersData && currentMode === 'ndvi') {
                    syncNdviLayersVisibility();
                }
            });
        }
    });

    // Toggle Period B visibility
    const compareModeToggle = document.getElementById('compare-mode-toggle');
    const periodBSection = document.getElementById('period-b-section');
    const compareLabels = document.getElementById('compare-labels');

    compareModeToggle.addEventListener('change', () => {
        if (compareModeToggle.checked) {
            periodBSection.classList.remove('hidden');
        } else {
            periodBSection.classList.add('hidden');
        }
    });

    // 4. Handle generate map action
    generateBtn.addEventListener('click', () => {
        const state = stateSelect.value;
        const parkId = parkSelect.value;

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        const isCompare = compareModeToggle.checked;
        const startDateB = document.getElementById('start-date-b').value;
        const endDateB = document.getElementById('end-date-b').value;

        if (!state || !parkId || !startDate || !endDate) return;
        if (isCompare && (!startDateB || !endDateB)) return;

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
                compare_mode: isCompare,
                start_date_b: startDateB,
                end_date_b: endDateB
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

            // Show map mode switcher
            if (mapModeSwitcher) mapModeSwitcher.classList.remove('hidden');

            // Remove existing split control and previous layers
            if (sideBySideControl) {
                map.removeControl(sideBySideControl);
                sideBySideControl = null;
            }
            if (eeTileLayer) {
                map.removeLayer(eeTileLayer);
                eeTileLayer = null;
            }
            if (eeTileLayerB) {
                map.removeLayer(eeTileLayerB);
                eeTileLayerB = null;
            }
            Object.keys(activeLayers).forEach(k => {
                if (activeLayers[k] && map.hasLayer(activeLayers[k])) {
                    map.removeLayer(activeLayers[k]);
                }
                activeLayers[k] = null;
            });

            currentLayersData = data.layers || {
                ndvi_park: data.tile_url,
                boundaries: null
            };
            currentLayersDataB = data.layers_b || null;
            isCompareActive = Boolean(data.compare_mode && data.tile_url_b && typeof L.control.sideBySide === 'function');

            if (isCompareActive) {
                try {
                    eeTileLayer = L.tileLayer(data.tile_url);
                    eeTileLayerB = L.tileLayer(data.tile_url_b);
                    sideBySideControl = L.control.sideBySide(eeTileLayer, eeTileLayerB).addTo(map);
                    compareLabels.classList.remove('hidden');
                } catch (ctrlErr) {
                    console.error("SideBySide control initialization error:", ctrlErr);
                    isCompareActive = false;
                    compareLabels.classList.add('hidden');
                }
            } else {
                compareLabels.classList.add('hidden');
            }

            // Set mode to NDVI and display layers
            setMapMode('ndvi');

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

        const tsRequests = [
            fetch('/api/timeseries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ park_id: parkId, start_date: startDate, end_date: endDate })
            }).then(res => res.json())
        ];

        if (isCompare) {
            tsRequests.push(
                fetch('/api/timeseries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ park_id: parkId, start_date: startDateB, end_date: endDateB })
                }).then(res => res.json())
            );
        }

        Promise.all(tsRequests)
        .then(([dataA, dataB]) => {
            if (dataA && dataA.length > 0) {
                currentTimeSeriesData = dataA;
                renderChart(dataA, dataB);
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
    function renderChart(dataA, dataB) {
        const ctx = document.getElementById('ndvi-chart').getContext('2d');

        const datasets = [{
            label: dataB && dataB.length > 0 ? 'Period A' : 'Mean NDVI',
            data: dataA.map(d => ({ x: d.date, y: d.ndvi })),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#10b981',
            fill: !dataB || dataB.length === 0,
            tension: 0.3
        }];

        if (dataB && dataB.length > 0) {
            datasets.push({
                label: 'Period B',
                data: dataB.map(d => ({ x: d.date, y: d.ndvi })),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6',
                fill: false,
                tension: 0.3
            });
        }

        // Collect all distinct dates sorted
        const allDates = Array.from(new Set([
            ...dataA.map(d => d.date),
            ...(dataB ? dataB.map(d => d.date) : [])
        ])).sort();

        if (ndviChart) {
            ndviChart.destroy();
        }

        ndviChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allDates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: Boolean(dataB && dataB.length > 0),
                        labels: { color: '#f3f4f6' }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af', maxTicksLimit: 12 }
                    },
                    y: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af' },
                        min: 0,
                        max: 1
                    }
                }
            }
        });
    }

    // ==========================================
    // Species Distribution Modeling (SDM) Module
    // ==========================================
    const speciesSelect = document.getElementById('species-select');
    const runSdmBtn = document.getElementById('run-sdm-btn');
    const sdmResults = document.getElementById('sdm-results');
    const sdmSuitabilityVal = document.getElementById('sdm-suitability-val');
    const sdmIucnVal = document.getElementById('sdm-iucn-val');
    const sdmLegend = document.getElementById('sdm-legend');
    const sdmLegendTitle = document.getElementById('sdm-legend-title');

    const flagshipBadge = document.getElementById('flagship-badge');

    // Load species catalog filtered by state with visual highlighting
    function loadSpeciesForState(stateName) {
        const url = stateName ? `/api/species?state=${encodeURIComponent(stateName)}` : '/api/species';
        fetch(url)
            .then(res => res.json())
            .then(speciesList => {
                speciesSelect.innerHTML = '<option value="" disabled selected>Choose a species...</option>';

                const flagships = speciesList.filter(s => s.is_flagship);
                const others = speciesList.filter(s => !s.is_flagship);

                if (flagships.length > 0 && stateName) {
                    const groupFlagship = document.createElement('optgroup');
                    groupFlagship.label = 'Native Flagship Species';
                    flagships.forEach(sp => {
                        const opt = document.createElement('option');
                        opt.value = sp.id;
                        opt.textContent = `${sp.name} (${sp.scientific_name})`;
                        opt.dataset.name = sp.name;
                        opt.dataset.iucn = sp.iucn;
                        opt.dataset.flagship = 'true';
                        opt.style.color = '#34d399';
                        opt.style.fontWeight = '600';
                        opt.style.backgroundColor = '#13241c';
                        groupFlagship.appendChild(opt);
                    });
                    speciesSelect.appendChild(groupFlagship);

                    if (others.length > 0) {
                        const groupOthers = document.createElement('optgroup');
                        groupOthers.label = 'Other Regional Species';
                        others.forEach(sp => {
                            const opt = document.createElement('option');
                            opt.value = sp.id;
                            opt.textContent = `${sp.name} (${sp.scientific_name})`;
                            opt.dataset.name = sp.name;
                            opt.dataset.iucn = sp.iucn;
                            opt.dataset.flagship = 'false';
                            opt.style.color = '#9ca3af';
                            groupOthers.appendChild(opt);
                        });
                        speciesSelect.appendChild(groupOthers);
                    }
                } else {
                    speciesList.forEach(sp => {
                        const opt = document.createElement('option');
                        opt.value = sp.id;
                        opt.textContent = `${sp.name} (${sp.scientific_name})`;
                        opt.dataset.name = sp.name;
                        opt.dataset.iucn = sp.iucn;
                        opt.dataset.flagship = 'false';
                        speciesSelect.appendChild(opt);
                    });
                }

                flagshipBadge.classList.add('hidden');
                speciesSelect.style.borderColor = 'var(--border-color)';
                speciesSelect.style.boxShadow = 'none';
                updateSdmBtnState();
            })
            .catch(err => console.error("Error loading species:", err));
    }

    // Initial load
    loadSpeciesForState('');

    // Reload species when state changes
    stateSelect.addEventListener('change', () => {
        loadSpeciesForState(stateSelect.value);
    });

    // Toggle Flagship badge on species selection
    speciesSelect.addEventListener('change', () => {
        const selectedOpt = speciesSelect.options[speciesSelect.selectedIndex];
        if (selectedOpt && selectedOpt.dataset.flagship === 'true') {
            flagshipBadge.classList.remove('hidden');
            speciesSelect.style.borderColor = '#10b981';
            speciesSelect.style.boxShadow = '0 0 0 1px rgba(16, 185, 129, 0.4)';
        } else {
            flagshipBadge.classList.add('hidden');
            speciesSelect.style.borderColor = 'var(--border-color)';
            speciesSelect.style.boxShadow = 'none';
        }
        updateSdmBtnState();
    });

    // Enable SDM button when park and species are selected
    function updateSdmBtnState() {
        runSdmBtn.disabled = !(parkSelect.value && speciesSelect.value);
    }

    parkSelect.addEventListener('change', updateSdmBtnState);

    runSdmBtn.addEventListener('click', () => {
        const parkId = parkSelect.value;
        const speciesId = speciesSelect.value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!parkId || !speciesId) return;

        const origText = runSdmBtn.querySelector('span').textContent;
        runSdmBtn.disabled = true;
        runSdmBtn.querySelector('span').textContent = 'Training GEE Random Forest...';

        welcomeMessage.classList.add('hidden');
        viewportImageContainer.classList.remove('hidden');

        fetch('/api/sdm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                park_id: parkId,
                species_id: speciesId,
                start_date: startDate,
                end_date: endDate
            })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'SDM execution failed');
            return data;
        })
        .then(data => {
            if (!map) {
                map = L.map('generated-map');
                const darkBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
                    maxZoom: 16
                }).addTo(map);
            }

            // Enable modeSdmBtn on map
            if (modeSdmBtn) {
                modeSdmBtn.disabled = false;
                modeSdmBtn.title = "Switch to Species Habitat Model";
                modeSdmBtn.style.cursor = "pointer";
                modeSdmBtn.style.opacity = "1";
            }
            if (mapModeSwitcher) mapModeSwitcher.classList.remove('hidden');

            // Remove previous SDM layers if any
            if (sdmLayer && map.hasLayer(sdmLayer)) {
                map.removeLayer(sdmLayer);
                sdmLayer = null;
            }
            if (presenceMarkersLayer && map.hasLayer(presenceMarkersLayer)) {
                map.removeLayer(presenceMarkersLayer);
                presenceMarkersLayer = null;
            }

            // Create new SDM Probability tile layer
            sdmLayer = L.tileLayer(data.tile_url, { zIndex: 100 });

            // Create sample presence markers
            if (data.presence_points && data.presence_points.length > 0) {
                presenceMarkersLayer = L.layerGroup();
                data.presence_points.forEach(coord => {
                    const marker = L.circleMarker([coord[1], coord[0]], {
                        radius: 5,
                        fillColor: '#ffffff',
                        color: '#000000',
                        weight: 1.5,
                        opacity: 1,
                        fillOpacity: 0.9
                    }).bindPopup(`<strong>${data.species.name}</strong><br>Optimal Habitat Coordinate`);
                    presenceMarkersLayer.addLayer(marker);
                });
            }

            // Pan and zoom to centroid
            map.setView([data.center[1], data.center[0]], 11);

            // Display SDM metrics
            sdmSuitabilityVal.textContent = `${data.mean_suitability}%`;
            sdmIucnVal.textContent = data.species.iucn;
            sdmResults.classList.remove('hidden');

            // Show SDM legend
            sdmLegendTitle.textContent = `${data.species.name} Habitat Suitability`;

            // Switch map view to SDM mode (NDVI layers stay preserved in memory)
            setMapMode('sdm');
        })
        .catch(err => {
            console.error("SDM Error:", err);
            alert("Habitat Modeling Failed: " + err.message);
        })
        .finally(() => {
            runSdmBtn.disabled = false;
            runSdmBtn.querySelector('span').textContent = origText;
        });
    });
});
