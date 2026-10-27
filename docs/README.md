# 📂 SDM Documentation

This folder contains all documentation for the Indian Elephant Species Distribution Model.

| File | Audience | What it covers |
|---|---|---|
| [Indian_Elephant_SDM_Explainer.md](./Indian_Elephant_SDM_Explainer.md) | Teacher / Non-technical | Plain-language explanation of every data source, what we did, how we did it, and how accurate it is |
| [Indian_Elephant_SDM_Documentation.md](./Indian_Elephant_SDM_Documentation.md) | Technical / Developer | Full EVS technical documentation — pipeline architecture, GEE datasets, RF methodology, outputs |

## Quick Links — Data Sources Referenced in the Explainer

| Source | Provider | Used for |
|---|---|---|
| GBIF Occurrences | [gbif.org](https://gbif.org) | 1,200 real elephant GPS sighting records |
| WorldClim BioClim | [worldclim.org](https://worldclim.org) | Climate variables (temp, rainfall) — 🌡️ BioClim source |
| MODIS MOD13A1 NDVI | [NASA LPDAAC](https://lpdaac.usgs.gov) | Vegetation greenness — 🛰️ Remote Sensing source |
| SRTM Elevation | [NASA JPL](https://www2.jpl.nasa.gov/srtm/) | Terrain height & slope — all sources |
| JRC Surface Water | [EC JRC](https://global-surface-water.appspot.com) | Rivers & water bodies — all sources |
| ESA WorldCover 2021 | [esa-worldcover.org](https://esa-worldcover.org) | Land cover classes — 🌿 Land Cover source |
| Hansen Forest Change | [Global Forest Watch](https://globalforestwatch.org) | Canopy cover % — 🌿 Land Cover source |
| FAO GAUL | [fao.org](https://www.fao.org/geonetwork) | India political boundary |
