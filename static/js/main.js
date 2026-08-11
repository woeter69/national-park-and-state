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

    // 4. Handle generate map action
    generateBtn.addEventListener('click', () => {
        const state = stateSelect.value;
        const parkId = parkSelect.value;

        const basemapState = document.getElementById('basemap-state').checked;
        const basemapPark = document.getElementById('basemap-park').checked;
        const ndviState = document.getElementById('ndvi-state').checked;
        const ndviPark = document.getElementById('ndvi-park').checked;

        if (!state || !parkId) return;

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
                basemap_state: basemapState,
                basemap_park: basemapPark,
                ndvi_state: ndviState,
                ndvi_park: ndviPark
            })
        })
        .then(res => {
            if (!res.ok) throw new Error('Failed to generate map');
            return res.json();
        })
        .then(data => {
            // Update Image
            generatedMap.src = data.map_url;

            // Wait for image to load before showing it to avoid blank flash
            generatedMap.onload = () => {
                viewportLoader.classList.add('hidden');
                viewportImageContainer.classList.remove('hidden');
            };

            // Update Metadata Card
            const details = data.park_details;
            detailDesignation.textContent = details.designation || 'Protected Area';
            detailArea.textContent = details.area_km2 ? `${parseFloat(details.area_km2).toFixed(2)} km²` : 'Not Reported';
            detailYear.textContent = details.status_yr || 'Unknown';
            detailIucn.textContent = details.iucn_cat || 'Not Classified';

            parkDetailsCard.classList.remove('hidden');
        })
        .catch(err => {
            console.error(err);
            viewportLoader.classList.add('hidden');
            welcomeMessage.classList.remove('hidden');
            
            // Show error message inside welcome layout
            const title = welcomeMessage.querySelector('h2');
            const desc = welcomeMessage.querySelector('p');
            title.textContent = "Processing Failed";
            desc.textContent = "Could not generate NDVI map. This could be due to missing Sentinel-2 imagery coverage or GEE server limits. Please try another area.";
            title.style.color = "#ef4444";
        })
        .finally(() => {
            // Re-enable controls
            stateSelect.disabled = false;
            parkSelect.disabled = false;
            generateBtn.disabled = false;
        });
    });
});
