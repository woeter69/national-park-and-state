# Changelog

All notable changes to the Protected Area & Species Distribution Modeling project will be documented in this file.

## [Unreleased] - 2026-10-28

### Added
- **All-India Indian Elephant Habitat SDM** (replaces park-scoped model):
  - `app.py` `/api/sdm`: No longer requires `park_id`. Uses `FAO/GAUL/2015/level0` India boundary from GEE.
  - Environmental stack switched to **MODIS MOD13A1 NDVI** (500m) — Sentinel-2 has too many granules for continental India. Combined with SRTM Elevation + Slope, JRC Surface Water, WorldClim BIO1 & BIO12.
  - Stratified sampling at **5km scale** (100 presence + 100 absence points) — fast and stable at India extent.
  - Random Forest with 50 trees. Stats reduced at 10km with `bestEffort=True`.
  - Returns `scope: 'india'`, `zoom: 5`, `center: [78.96, 20.59]`, and all **200 GBIF occurrence markers** (up from 45).
  - `templates/index.html`: SDM button now always enabled (no park selection required). Added "All of India" scope badge. Button label updated to "Predict Elephant Habitat — All India".
  - `static/js/main.js`: Removed `parkSelect` guard from SDM button. Map auto-zooms to India at zoom level 5.

### Fixed
- **Indian Elephant SDM — Live GEE Tile Layer (Final Integration)**:
  - `app.py`: Removed Bengal Tiger, Indian Rhinoceros, Asiatic Lion, and Snow Leopard from `SPECIES_CATALOG`. Only *Elephas maximus indicus* remains. Added `is_flagship: True` flag directly on the elephant entry.
  - `app.py` `/api/sdm`: Replaced static PNG fallback response with a proper HTTP 503 error message when GEE is unavailable. GEE is confirmed working via project `gen-lang-client-0070085043`, so this path should never be hit in production.
  - `static/js/main.js`: Completely replaced the old multi-species SDM module (dropdown, `loadSpeciesForState()`, `speciesSelect`, `flagshipBadge` references) with a clean, hardcoded **Indian Elephant SDM Module**. `speciesId` is now constant `'elephas_maximus'` — no dropdown needed.
  - `static/js/main.js`: SDM button is now enabled as soon as any park is selected (previously required both park AND species dropdown selection).
  - `static/js/main.js`: Removed `imageOverlay` fallback branch entirely. SDM layer is **always** a live `L.tileLayer(data.tile_url)` streamed from GEE XYZ tile servers.
  - `static/js/main.js`: GBIF occurrence popups updated with 🐘 emoji for visual clarity.
  - All JS references to non-existent DOM elements (`species-select`, `flagship-badge`) removed — eliminates silent JS crash on page load.


### Added
- **Web UI & Interactive Map Integration**:
  - `app.py`: Integrated Indian Elephant SDM directly into the live web app backend with real GBIF/iNaturalist occurrences, WorldClim BioClim layers, resilient Earth Engine initialization, and static layer serving.
  - `static/js/main.js`: Enhanced Leaflet map to render live SDM layers, empirical GBIF field occurrence markers with interactive popups, dynamic covariates list, and seamless mode switching.
  - `templates/index.html`: Updated Species Distribution Modeling card to include WorldClim BioClim covariates.
  - `Makefile` & `run_sdm.sh`: Added `make up` and `make sdm` commands.
- **Real Biological Occurrence Point Records**:
  - `data/Elephas_maximus_Occurrences_GBIF_iNat.csv`: Compiled 1,200 verified GPS point records of the Indian Elephant (*Elephas maximus indicus*) from GBIF (Global Biodiversity Information Facility) and iNaturalist research-grade field observations across India's elephant reserves and corridors.
- **Gridded Bioclimatic Spatial Surfaces (WorldClim 2.1)**:
  - `data/WorldClim_BioClim/wc2.1_10m_bio_1.tif`: Annual Mean Temperature (BIO1).
  - `data/WorldClim_BioClim/wc2.1_10m_bio_4.tif`: Temperature Seasonality (BIO4).
  - `data/WorldClim_BioClim/wc2.1_10m_bio_12.tif`: Annual Precipitation (BIO12).
  - `data/WorldClim_BioClim/wc2.1_10m_bio_15.tif`: Precipitation Seasonality (BIO15).
- **Correlative SDM Scientific Pipeline**:
  - `sdm_elephant.py`: Complete implementation of correlative niche modeling following the methodology specified in `SDM.pptx.pdf`. Includes spatial debiasing, environmental covariate extraction across raster grids, pseudo-absence sampling, Random Forest model training, and continuous landscape suitability projection.
- **Ecological Synthesis and Cartographic Outputs**:
  - `sdm_output/Indian_Elephant_Habitat_Suitability_Map.png`: High-resolution cartographic projection of Indian Elephant habitat suitability ($0.0 \rightarrow 1.0$) with overlaid biological occurrence records.
  - `sdm_output/Gridded_Environmental_Surfaces.png`: Comprehensive 6-panel raster surface visualization depicting Climate (BioClim), Topography (Elevation & Slope), Vegetation (Canopy NDVI), and Hydrology (Surface Water).
  - `sdm_output/Variable_Importance_Analysis.png`: Quantitative ranking of ecological limiting factors indicating that surface water and canopy productivity drive ~49% of elephant landscape selection.
  - `sdm_output/SDM_Model_Metrics_Report.json`: Model performance metrics, including Test AUC and relative variable contributions.
