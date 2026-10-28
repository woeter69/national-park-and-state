# NDVI Analyzer: Protected Area Vegetation Intelligence & Species Distribution Modeling

> 📂 **Documentation:** [`docs/Indian_Elephant_SDM_Explainer.md`](./docs/Indian_Elephant_SDM_Explainer.md) — plain-language guide to the SDM data sources, methods, and accuracy (for teachers / non-technical readers).
> [`docs/Indian_Elephant_SDM_Documentation.md`](./docs/Indian_Elephant_SDM_Documentation.md) — full technical EVS documentation.

A full-stack geospatial intelligence platform for interactive satellite-based vegetation monitoring, multi-temporal NDVI time-series analysis, and cloud-based Species Distribution Modeling (SDM) across Indian National Parks and Wildlife Sanctuaries.

Powered by Google Earth Engine (GEE), Sentinel-2 MSI, SRTM Elevation, JRC Global Surface Water, and WDPA protected area boundaries.

---

## Overview

NDVI Analyzer enables environmental researchers, conservationists, and park managers to assess protected area ecological health, detect vegetation stress, analyze historical seasonal trends, and model wildlife habitat suitability in real time.

All compute-heavy operations—including cloud masking, median composite generation, band math, random forest training, and continuous raster classification—are offloaded to Google Earth Engine's distributed cloud infrastructure. Interactive map rendering is delivered via dynamic XYZ tile layers streamed directly to a high-performance Leaflet.js client.

---

## Key Features

### 1. Interactive Satellite Map Visualizer
- Dynamic GEE Tile Streaming: Satellite composites and analysis layers are rendered on the fly using `ee.Image.getMapId()` and streamed into an interactive Leaflet map.
- Keyless Basemaps: Integrated Esri Dark Gray Canvas and Esri World Imagery Satellite basemaps with a native Leaflet layer control switcher.
- Auto-Centering and Boundary Buffering: Automatically computes the geometric centroid of any selected protected area and adjusts the viewport.

### 2. Multi-Temporal Sentinel-2 NDVI Analysis
- Cloud-Masked Compositing: Filters Sentinel-2 Level-2A surface reflectance granules (`COPERNICUS/S2_SR_HARMONIZED`) by cloudy pixel percentage (<20%) over user-defined date ranges.
- Standardized Vegetation Index: Computes Normalized Difference Vegetation Index:
  $$\text{NDVI} = \frac{\text{B8 (NIR)} - \text{B4 (Red)}}{\text{B8 (NIR)} + \text{B4 (Red)}}$$
- 17-Class Color Palette: Multi-stop gradient ranging from barren land/water (white/tan) through moderate vegetation (yellow/olive) to dense tropical canopies (deep forest green).

### 3. Real-Time Multi-Layer Visibility Controls
All visibility layers are pre-generated concurrently on the backend via multi-threaded `getMapId()` calls and exposed as independent client-side tile layers:
- Park NDVI: Masked specifically to the gazetted protected area boundary.
- State NDVI: Expanded vegetation index across the entire state landmass.
- Park Landmass (Basemap): True-color optical RGB composite (B4, B3, B2) inside the park.
- State Landmass (Basemap): True-color optical RGB composite across the state.
- Boundary Outlines: High-contrast vector boundary overlays (Red for Park, Blue for State).
- Instant Client-Side Toggles: Checkboxes toggle map visibility in 0 ms without triggering server roundtrips.

### 4. Dual-Period Split Comparison (Swipe Divider)
- Side-by-Side Comparison: Compare vegetation health between two distinct time periods (e.g., pre-monsoon vs. post-monsoon or historical baseline vs. current year).
- Draggable Split Divider: Built using a standalone Leaflet swipe control (`L.Control.SideBySide`) to inspect changes interactively.
- Synchronized Dual Labels: Visual badges distinguishing Period A (Left) from Period B (Right).

### 5. Multi-Year NDVI Time-Series Analytics
- Cloud Reducer Engine: Computes monthly mean NDVI across the park boundary using `ee.Reducer.mean()` at 200m spatial resolution.
- Dynamic Chart.js Line Chart: Displays historical trajectory and seasonal fluctuation.
- Dual-Period Overlay: When comparison mode is enabled, displays Period A and Period B curves simultaneously for direct comparison.

### 6. Cloud-Based Species Distribution Modeling (SDM)
- Environmental Covariate Stack: Blends four continuous environmental raster layers inside Google Earth Engine:
  1. Sentinel-2 NDVI (10m): Vegetation productivity and canopy density.
  2. SRTM Elevation (30m): Digital elevation model from USGS SRTM.
  3. Terrain Slope (30m): Topographic slope derived via `ee.Terrain.slope()`.
  4. JRC Global Surface Water (30m): Water occurrence percentage.
- Cloud Random Forest Classifier: Trains an `ee.Classifier.smileRandomForest` model directly in Google Earth Engine using stratified presence and pseudo-absence sampling derived from species ecological niches.
- Continuous Habitat Heatmap: Classifies habitat suitability probability ($0.0 \rightarrow 1.0$) with a Navy Blue (Unsuitable) to Deep Red (Prime Habitat) gradient.
- Native Flagship Species Highlighting: Species dropdown organizes native flagship species into dedicated groups with emerald green styling and badges.
- Persistent NDVI / SDM Mode Switcher: Dedicated top-right segmented pill control allows instant switching between NDVI Vegetation view and Species Habitat view without losing state or reloading data.

### 7. Export and Download Suite
- High-Resolution Map PNG: Direct download of high-resolution rendered imagery from Earth Engine.
- ESRI Shapefile (ZIP): Vector boundary export packaged as an official ESRI Shapefile archive.
- GeoJSON: Raw GeoJSON boundary geometry of the selected protected area.
- Time-Series CSV: Tabular export of monthly dates and mean NDVI values.
- Chart PNG: Client-side canvas export of the rendered Chart.js time-series plot.

---

## Tech Stack

### Backend
- Language: Python 3.10+
- Framework: Flask 3.1
- Geospatial Engine: Google Earth Engine Python API (`earthengine-api`)
- Concurrency: `concurrent.futures.ThreadPoolExecutor` for parallel layer generation

### Frontend
- Core: Vanilla HTML5, CSS3 (Custom Design Tokens), ES6+ JavaScript
- Mapping Engine: Leaflet.js 1.9.4
- Map Split Plugin: Custom standalone `L.Control.SideBySide`
- Data Visualization: Chart.js 4.4.1
- Basemaps: Esri World Dark Gray Canvas, Esri World Imagery

### Datasets
- Satellite Imagery: `COPERNICUS/S2_SR_HARMONIZED` (Sentinel-2 MSI Level-2A)
- Protected Areas: `WCMC/WDPA/current/polygons` (World Database on Protected Areas)
- Administrative Boundaries: `FAO/GAUL/2015/level1` (Global Administrative Unit Layers)
- Topography: `USGS/SRTMGL1_003` (SRTM 1 Arc-Second Global Digital Elevation)
- Surface Water: `JRC/GSW1_4/GlobalSurfaceWater` (Joint Research Centre Global Surface Water)

---

## Project Structure

```
national-park-and-state/
├── app.py                      # Flask backend, Earth Engine processing, API endpoints
├── main.py                     # CLI / offline raster export utility
├── requirements.txt            # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css           # Responsive design, dark UI tokens, layout styles
│   └── js/
│       ├── leaflet-side-by-side.js  # Standalone swipe comparison Leaflet plugin
│       └── main.js             # Client state, layer management, API calls, Chart.js
├── templates/
│   └── index.html              # Single-page application layout and UI containers
└── README.md                   # Project documentation
```

---

## Installation & Setup

### Prerequisites
1. Python 3.10 or higher installed.
2. A registered Google Earth Engine account and Google Cloud Project with the Earth Engine API enabled.
3. Git installed.

### 1. Clone the Repository
```bash
git clone https://github.com/ChandraguptSharma07/national-park-and-state.git
cd national-park-and-state
```

### 2. Create and Activate Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
pip install flask
```

### 4. Authenticate Google Earth Engine
Authenticate your machine with your Google Cloud credentials:
```bash
earthengine authenticate
```

In `app.py`, confirm your Google Cloud Project ID is configured:
```python
ee.Initialize(project='your-google-cloud-project-id')
```

### 5. Run the Application
```bash
python app.py
```
The application will start on `http://127.0.0.1:5000`. Open this URL in any modern web browser.

---

## API Reference

### 1. `GET /api/states`
Returns the catalog of supported Indian states and union territories.
- Response: `string[]` (list of state names)

### 2. `GET /api/parks?state=<state_name>`
Retrieves all protected areas intersecting the specified state boundary from WDPA.
- Query Parameter:
  - `state` (string, required): State name (e.g. `Assam`, `Uttarakhand`).
- Response:
  ```json
  [
    {
      "id": 1251,
      "name": "Kaziranga National Park",
      "designation": "National Park",
      "area_km2": 858.98,
      "status_yr": 1974
    }
  ]
  ```

### 3. `POST /api/generate`
Processes Sentinel-2 imagery and concurrently generates tile URLs for all visibility layers.
- Request Body:
  ```json
  {
    "state": "Assam",
    "park_id": 1251,
    "start_date": "2023-10-01",
    "end_date": "2024-03-31",
    "compare_mode": false,
    "start_date_b": "2022-10-01",
    "end_date_b": "2023-03-31"
  }
  ```
- Response:
  ```json
  {
    "tile_url": "https://earthengine.googleapis.com/v1/...",
    "layers": {
      "ndvi_park": "https://earthengine.googleapis.com/v1/...",
      "ndvi_state": "https://earthengine.googleapis.com/v1/...",
      "basemap_park": "https://earthengine.googleapis.com/v1/...",
      "basemap_state": "https://earthengine.googleapis.com/v1/...",
      "boundaries": "https://earthengine.googleapis.com/v1/..."
    },
    "compare_mode": false,
    "high_res_url": "https://earthengine.googleapis.com/v1/...",
    "center": [93.17, 26.65],
    "park_details": {
      "name": "Kaziranga",
      "designation": "National Park",
      "area_km2": 858.98,
      "status_yr": 1974,
      "iucn_cat": "II"
    }
  }
  ```

### 4. `POST /api/timeseries`
Computes monthly mean NDVI time series for the park over the specified date window.
- Request Body:
  ```json
  {
    "park_id": 1251,
    "start_date": "2023-01-01",
    "end_date": "2024-03-31"
  }
  ```
- Response:
  ```json
  [
    { "date": "2023-01", "ndvi": 0.62 },
    { "date": "2023-02", "ndvi": 0.58 }
  ]
  ```

### 5. `GET /api/species?state=<state_name>`
Returns the species catalog annotated with native flagship status for the given state.
- Query Parameter:
  - `state` (string, optional): State filter.
- Response:
  ```json
  [
    {
      "id": "one_horned_rhino",
      "name": "Greater One-Horned Rhinoceros",
      "scientific_name": "Rhinoceros unicornis",
      "iucn": "Vulnerable",
      "is_flagship": true,
      "native_states": ["Assam", "West Bengal", "Uttar Pradesh"]
    }
  ]
  ```

### 6. `POST /api/sdm`
Trains a GEE Random Forest classifier on multi-band environmental rasters and returns suitability tiles.
- Request Body:
  ```json
  {
    "park_id": 1251,
    "species_id": "one_horned_rhino",
    "start_date": "2023-10-01",
    "end_date": "2024-03-31"
  }
  ```
- Response:
  ```json
  {
    "tile_url": "https://earthengine.googleapis.com/v1/...",
    "center": [93.17, 26.65],
    "mean_suitability": 68.4,
    "presence_points": [[93.21, 26.62], [93.15, 26.67]],
    "species": {
      "name": "Greater One-Horned Rhinoceros",
      "iucn": "Vulnerable"
    },
    "predictors": ["Sentinel-2 NDVI", "SRTM Elevation", "Terrain Slope", "JRC Surface Water"]
  }
  ```

### 7. Export Endpoints
- `GET /api/download/shapefile?park_id=<id>`: Generates direct GEE download URL for an ESRI Shapefile ZIP.
- `GET /api/download/geojson?park_id=<id>`: Returns the GeoJSON boundary FeatureCollection.

---

## Ecological Notes on SDM Modeling

The Species Distribution Model implements pseudo-absence generation tailored to protected area terrain:
1. Target Species Niches: Defined by empirical ecological thresholds (NDVI range, slope tolerance, water proximity requirements).
2. Sampling Strategy: Stratified sampling (`stratifiedSample`) extracts presence points from favorable environmental zones and pseudo-absences from unfavorable zones.
3. Classification: Random Forest output mode is set to continuous probability (`PROBABILITY`), yielding a seamless gradient of habitat suitability from 0.0 to 1.0.
4. Flagship Association: Native flagship species are mapped directly to corresponding Indian states to guide biological relevance and highlight priority conservation targets.

---

## License

This project is open source and available under the MIT License.
