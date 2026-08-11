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

        # 2. Process Sentinel-2 Imagery
        # Determine filter bounds based on what needs to be rendered
        if basemap_state or ndvi_state:
            bounds = state.geometry()
        else:
            bounds = park.geometry()

        s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(bounds) \
            .filterDate('2025-10-01', '2026-03-31') \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

        if s2_collection.size().getInfo() == 0:
            # Try a broader date range if no imagery found
            s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterBounds(bounds) \
                .filterDate('2024-01-01', '2026-03-31') \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))

        s2_median = s2_collection.median()
        ndvi = s2_median.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # NDVI Color Palette
        ndvi_palette = [
            'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901',
            '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
            '012E01', '011D01', '011301'
        ]

        # Build final image progressively
        final_img = ee.Image().byte().selfMask()

        if basemap_state:
            s2_basemap_state = s2_median.clip(state).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)
            final_img = final_img.blend(s2_basemap_state)

        if basemap_park:
            s2_basemap_park = s2_median.clip(park).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)
            final_img = final_img.blend(s2_basemap_park)

        if ndvi_state:
            ndvi_viz_state = ndvi.clip(state).visualize(min=0.0, max=0.8, palette=ndvi_palette)
            final_img = final_img.blend(ndvi_viz_state)

        if ndvi_park:
            ndvi_viz_park = ndvi.clip(park).visualize(min=0.0, max=0.8, palette=ndvi_palette)
            final_img = final_img.blend(ndvi_viz_park)

        # Outlines
        empty = ee.Image().byte()
        state_outline = empty.paint(state, 1, 2).selfMask().visualize(palette=['0000FF'])
        park_outline = empty.paint(park, 1, 3).selfMask().visualize(palette=['FF0000'])

        # Blend outlines
        final_img = final_img.blend(park_outline).blend(state_outline)

        # Generate GEE Thumbnail URL centered on the state so boundary is visible
        region = state.geometry().bounds()

        url = final_img.getThumbURL({
            'dimensions': 1200,
            'region': region,
            'format': 'jpg'
        })

        return jsonify({
            "map_url": url,
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
