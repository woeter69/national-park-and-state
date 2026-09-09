import os
import ee
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Initialize Earth Engine
try:
    ee.Initialize(project='meet-attendance-500308')
except Exception:
    ee.Authenticate()
    ee.Initialize(project='meet-attendance-500308')

# Cached states to avoid repeating GEE calls on startup
INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand",
    "Karnataka", "Kerala", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/states', methods=['GET'])
def get_states():
    return jsonify(INDIAN_STATES)

@app.route('/api/parks', methods=['GET'])
def get_parks():
    state_name = request.args.get('state')
    if not state_name:
        return jsonify({"error": "State parameter is required"}), 400

    try:
        # Get State boundary
        state = ee.FeatureCollection("FAO/GAUL/2015/level1") \
            .filter(ee.Filter.eq('ADM0_NAME', 'India')) \
            .filter(ee.Filter.eq('ADM1_NAME', state_name))

        if state.size().getInfo() == 0:
            return jsonify([])

        # Find parks intersecting state boundary
        parks = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('ISO3', 'IND')) \
            .filterBounds(state.geometry())

        parks_info = parks.getInfo()
        results = []
        for feature in parks_info.get('features', []):
            props = feature.get('properties', {})
            name = props.get('NAME_ENG') or props.get('NAME') or "Unnamed Area"
            site_id = props.get('SITE_ID') or props.get('SITE_PID')
            if site_id:
                results.append({
                    "id": site_id,
                    "name": name,
                    "designation": props.get('DESIG_ENG', 'Protected Area'),
                    "area_km2": props.get('REP_AREA', 0),
                    "status_yr": props.get('STATUS_YR', 'Unknown')
                })
        
        # Sort parks by name
        results = sorted(results, key=lambda x: x['name'])
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate', methods=['POST'])
def generate_map():
    data = request.json or {}
    state_name = data.get('state')
    park_id = data.get('park_id')
    start_date = data.get('start_date', '2025-10-01')
    end_date = data.get('end_date', '2026-03-31')
    compare_mode = data.get('compare_mode', False)
    start_date_b = data.get('start_date_b', '2023-10-01')
    end_date_b = data.get('end_date_b', '2024-03-31')
    basemap_state = data.get('basemap_state', False)
    basemap_park = data.get('basemap_park', False)
    ndvi_state = data.get('ndvi_state', False)
    ndvi_park = data.get('ndvi_park', True) # Default from before

    if not state_name or not park_id:
        return jsonify({"error": "State and Park ID are required"}), 400

    try:
        # 1. Fetch State and Park Geometries
        state = ee.FeatureCollection("FAO/GAUL/2015/level1") \
            .filter(ee.Filter.eq('ADM0_NAME', 'India')) \
            .filter(ee.Filter.eq('ADM1_NAME', state_name))

        park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('SITE_ID', int(park_id)))

        if park.size().getInfo() == 0:
            return jsonify({"error": "Selected park boundary not found"}), 404

        # Determine filter bounds based on what needs to be rendered
        if basemap_state or ndvi_state:
            bounds = state.geometry()
        else:
            bounds = park.geometry()

        ndvi_palette = [
            'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901',
            '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
            '012E01', '011D01', '011301'
        ]

        def build_rendered_image(s_date, e_date):
            s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterBounds(bounds) \
                .filterDate(s_date, e_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

            if s2_collection.size().getInfo() == 0:
                s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                    .filterBounds(bounds) \
                    .filterDate('2017-01-01', e_date) \
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))

            s2_median = s2_collection.median()
            ndvi = s2_median.normalizedDifference(['B8', 'B4']).rename('NDVI')

            img = ee.Image().byte().selfMask()

            if basemap_state:
                s2_basemap_state = s2_median.clip(state).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)
                img = img.blend(s2_basemap_state)

            if basemap_park:
                s2_basemap_park = s2_median.clip(park).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)
                img = img.blend(s2_basemap_park)

            if ndvi_state:
                ndvi_viz_state = ndvi.clip(state).visualize(min=0.0, max=0.8, palette=ndvi_palette)
                img = img.blend(ndvi_viz_state)

            if ndvi_park:
                ndvi_viz_park = ndvi.clip(park).visualize(min=0.0, max=0.8, palette=ndvi_palette)
                img = img.blend(ndvi_viz_park)

            # Outlines
            empty = ee.Image().byte()
            state_outline = empty.paint(state, 1, 2).selfMask().visualize(palette=['0000FF'])
            park_outline = empty.paint(park, 1, 3).selfMask().visualize(palette=['FF0000'])
            return img.blend(park_outline).blend(state_outline)

        final_img = build_rendered_image(start_date, end_date)
        tile_url = final_img.getMapId()['tile_fetcher'].url_format

        tile_url_b = None
        if compare_mode:
            final_img_b = build_rendered_image(start_date_b, end_date_b)
            tile_url_b = final_img_b.getMapId()['tile_fetcher'].url_format

        snapshot_region = state.geometry().bounds() if (basemap_state or ndvi_state) else park.geometry().bounds()
        high_res_url = final_img.getThumbURL({
            'dimensions': 2048,
            'region': snapshot_region,
            'format': 'png'
        })

        center = park.geometry().centroid().coordinates().getInfo() # [lon, lat]

        return jsonify({
            "tile_url": tile_url,
            "tile_url_b": tile_url_b,
            "compare_mode": compare_mode,
            "high_res_url": high_res_url,
            "center": center,
            "park_details": {
                "name": park.first().get('NAME_ENG').getInfo() or park.first().get('NAME').getInfo(),
                "designation": park.first().get('DESIG_ENG').getInfo(),
                "area_km2": park.first().get('REP_AREA').getInfo(),
                "status_yr": park.first().get('STATUS_YR').getInfo(),
                "iucn_cat": park.first().get('IUCN_CAT').getInfo()
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/shapefile', methods=['GET'])
def download_shapefile():
    park_id = request.args.get('park_id')
    if not park_id:
        return jsonify({"error": "Park ID is required"}), 400
    try:
        park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('SITE_ID', int(park_id)))
        url = park.getDownloadURL(filetype='shp')
        return jsonify({"download_url": url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/geojson', methods=['GET'])
def download_geojson():
    park_id = request.args.get('park_id')
    if not park_id:
        return jsonify({"error": "Park ID is required"}), 400
    try:
        park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('SITE_ID', int(park_id)))
        return jsonify(park.getInfo())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/timeseries', methods=['POST'])
def get_timeseries():
    data = request.json or {}
    park_id = data.get('park_id')
    start_date = data.get('start_date', '2025-10-01')
    end_date = data.get('end_date', '2026-03-31')

    if not park_id:
        return jsonify({"error": "Park ID is required"}), 400

    try:
        park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('SITE_ID', int(park_id)))

        s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(park.geometry()) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

        def calc_mean_ndvi(image):
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            mean_dict = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=park.geometry(),
                scale=200,  # 200m scale for speed
                maxPixels=1e9
            )
            return ee.Feature(None, {
                'date': image.date().format('YYYY-MM-dd'),
                'ndvi': mean_dict.get('NDVI')
            })

        time_series_fc = s2_collection.map(calc_mean_ndvi)
        features = time_series_fc.getInfo().get('features', [])
        
        data_points = []
        for f in features:
            props = f.get('properties', {})
            val = props.get('ndvi')
            if val is not None:
                data_points.append({
                    'date': props['date'],
                    'ndvi': val
                })
                
        # Sort by date
        data_points = sorted(data_points, key=lambda x: x['date'])
        
        # Deduplicate dates (Sentinel-2 can have multiple images same day)
        unique_points = {}
        for dp in data_points:
            unique_points[dp['date']] = dp['ndvi']
            
        final_series = [{"date": k, "ndvi": v} for k, v in unique_points.items()]
        
        return jsonify(final_series)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Flagship species profiles for Species Distribution Modeling
SPECIES_CATALOG = [
    {
        "id": "panthera_tigris",
        "name": "Bengal Tiger",
        "scientific_name": "Panthera tigris",
        "iucn": "Endangered",
        "preferences": {"min_ndvi": 0.45, "max_ndvi": 0.85, "max_slope": 25, "min_water_prob": 5}
    },
    {
        "id": "rhinoceros_unicornis",
        "name": "Indian Rhinoceros",
        "scientific_name": "Rhinoceros unicornis",
        "iucn": "Vulnerable",
        "preferences": {"min_ndvi": 0.35, "max_ndvi": 0.75, "max_slope": 10, "min_water_prob": 20}
    },
    {
        "id": "elephas_maximus",
        "name": "Asian Elephant",
        "scientific_name": "Elephas maximus",
        "iucn": "Endangered",
        "preferences": {"min_ndvi": 0.40, "max_ndvi": 0.80, "max_slope": 20, "min_water_prob": 10}
    },
    {
        "id": "panthera_leo_persica",
        "name": "Asiatic Lion",
        "scientific_name": "Panthera leo persica",
        "iucn": "Endangered",
        "preferences": {"min_ndvi": 0.20, "max_ndvi": 0.55, "max_slope": 15, "min_water_prob": 0}
    },
    {
        "id": "panthera_uncia",
        "name": "Snow Leopard",
        "scientific_name": "Panthera uncia",
        "iucn": "Vulnerable",
        "preferences": {"min_ndvi": 0.05, "max_ndvi": 0.35, "max_slope": 45, "min_water_prob": 0}
    }
]

@app.route('/api/species', methods=['GET'])
def get_species():
    return jsonify(SPECIES_CATALOG)

@app.route('/api/sdm', methods=['POST'])
def run_sdm():
    data = request.json or {}
    park_id = data.get('park_id')
    species_id = data.get('species_id')
    start_date = data.get('start_date', '2025-10-01')
    end_date = data.get('end_date', '2026-03-31')

    if not park_id or not species_id:
        return jsonify({"error": "Park ID and Species ID are required"}), 400

    species = next((s for s in SPECIES_CATALOG if s['id'] == species_id), None)
    if not species:
        return jsonify({"error": f"Species {species_id} not found"}), 404

    try:
        park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
            .filter(ee.Filter.eq('SITE_ID', int(park_id)))

        if park.size().getInfo() == 0:
            return jsonify({"error": "Selected park boundary not found"}), 404

        geom = park.geometry()

        # 1. Environmental Covariates Stack
        # A. Vegetation Index (Sentinel-2)
        s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(geom) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

        if s2_collection.size().getInfo() == 0:
            s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterBounds(geom) \
                .filterDate('2020-01-01', end_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))

        s2_median = s2_collection.median()
        ndvi = s2_median.normalizedDifference(['B8', 'B4']).rename('ndvi')

        # B. Topography (SRTM 30m Elevation & Slope)
        elevation = ee.Image('USGS/SRTMGL1_003').rename('elevation')
        slope = ee.Terrain.slope(elevation).rename('slope')

        # C. Surface Water Proximity / Frequency
        water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0).rename('water')

        # Multi-band predictor stack clipped to park
        predictors = ndvi.addBands(elevation).addBands(slope).addBands(water).clip(park)

        # 2. Species-Specific Habitats: Presence vs Absence Sampling
        prefs = species['preferences']
        min_ndvi = prefs.get('min_ndvi', 0.3)
        max_ndvi = prefs.get('max_ndvi', 0.8)
        max_slope = prefs.get('max_slope', 30)
        min_water = prefs.get('min_water_prob', 0)

        # Build habitat affinity mask based on ecological preferences
        favorable_zone = ndvi.gte(min_ndvi).And(ndvi.lte(max_ndvi)) \
            .And(slope.lte(max_slope))

        if min_water > 0:
            favorable_zone = favorable_zone.Or(water.gte(min_water).And(slope.lte(max_slope)))

        unfavorable_zone = favorable_zone.Not()

        # Sample presence and pseudo-absence points across the ecological zones
        presence_points = favorable_zone.selfMask().stratifiedSample(
            numPoints=35,
            region=geom,
            scale=100,
            seed=42,
            geometries=True
        ).map(lambda f: f.set('presence', 1))

        absence_points = unfavorable_zone.selfMask().stratifiedSample(
            numPoints=35,
            region=geom,
            scale=100,
            seed=84,
            geometries=True
        ).map(lambda f: f.set('presence', 0))

        training_fc = presence_points.merge(absence_points)

        # 3. Train GEE Cloud Random Forest Model
        training_data = predictors.sampleRegions(
            collection=training_fc,
            properties=['presence'],
            scale=100,
            geometries=False
        )

        classifier = ee.Classifier.smileRandomForest(numberOfTrees=35) \
            .setOutputMode('PROBABILITY') \
            .train(
                features=training_data,
                classProperty='presence',
                inputProperties=['ndvi', 'elevation', 'slope', 'water']
            )

        # 4. Classify continuous suitability probability (0.0 to 1.0)
        suitability = predictors.select(['ndvi', 'elevation', 'slope', 'water']).classify(classifier)

        # Color palette: Navy Blue (0.0 Unsuitable) -> Cyan -> Yellow -> Deep Red (1.0 Prime Habitat)
        sdm_palette = ['000080', '0000FF', '00FFFF', 'FFFF00', 'FF7F00', 'FF0000']
        suitability_viz = suitability.visualize(min=0.0, max=1.0, palette=sdm_palette)

        # Blend park outline on top
        empty = ee.Image().byte()
        park_outline = empty.paint(park, 1, 3).selfMask().visualize(palette=['FFFFFF'])
        final_sdm_img = suitability_viz.blend(park_outline)

        map_id = final_sdm_img.getMapId()
        tile_url = map_id['tile_fetcher'].url_format

        # 5. Calculate park habitat suitability metrics
        stats = suitability.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=geom,
            scale=200,
            maxPixels=1e9
        ).getInfo()

        mean_suitability = stats.get('classification_mean', 0.5)

        # Get presence point coordinates for visualization
        presence_coords = []
        try:
            feat_info = presence_points.limit(20).getInfo().get('features', [])
            for ft in feat_info:
                coords = ft.get('geometry', {}).get('coordinates', [])
                if coords:
                    presence_coords.append(coords)
        except Exception:
            presence_coords = []

        center = geom.centroid().coordinates().getInfo()

        return jsonify({
            "tile_url": tile_url,
            "center": center,
            "species": species,
            "mean_suitability": round(mean_suitability * 100, 1),
            "presence_points": presence_coords,
            "predictors": ["Sentinel-2 NDVI", "SRTM Elevation", "Terrain Slope", "JRC Surface Water"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

