# Changelog

All notable changes to the Protected Area & Species Distribution Modeling project will be documented in this file.

## [Unreleased] - 2026-10-28

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
