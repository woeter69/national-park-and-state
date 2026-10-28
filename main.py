import ee
import requests
import shutil
import zipfile
import io
import os

# Initialize the Earth Engine module.
try:
    ee.Initialize(project='gen-lang-client-0070085043')
except Exception as e:
    ee.Authenticate()
    ee.Initialize(project='gen-lang-client-0070085043')

def download_shapefile(fc, folder_name):
    print(f"Downloading shapefile for {folder_name}...")
    url = fc.getDownloadURL(filetype='shp')
    response = requests.get(url)
    
    if response.status_code == 200:
        os.makedirs(folder_name, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(folder_name)
        print(f"Successfully extracted {folder_name} shapefiles.")
    else:
        print(f"Failed to download {folder_name}.")

def main():
    print("Fetching boundaries for Assam and Kaziranga...")

    # 1. Define Vector Geometries
    state = ee.FeatureCollection("FAO/GAUL/2015/level1") \
        .filter(ee.Filter.eq('ADM0_NAME', 'India')) \
        .filter(ee.Filter.eq('ADM1_NAME', 'Assam'))

    park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
        .filter(ee.Filter.Or(
            ee.Filter.stringContains('NAME', 'Kaziranga'),
            ee.Filter.stringContains('ORIG_NAME', 'Kaziranga')
        ))

    # 2. Download Shapefiles Locally
    download_shapefile(state, "Assam_State_Boundary")
    download_shapefile(park, "Kaziranga_National_Park")

    # 3. Process Sentinel-2 Imagery and Calculate NDVI
    print("Calculating NDVI for Kaziranga and generating map...")
    
    # Fetch base Sentinel-2 median composite for the state
    s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterBounds(state.geometry()) \
        .filterDate('2025-10-01', '2026-03-31') \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    
    s2_median = s2_collection.median()
    
    # Create the true-color basemap clipped to the state
    s2_basemap = s2_median.clip(state).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)

    # Calculate NDVI: (B8 - B4) / (B8 + B4)
    ndvi = s2_median.normalizedDifference(['B8', 'B4']).rename('NDVI')

    # Define a color palette for NDVI (brown/white -> light green -> dark green)
    ndvi_palette = [
        'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901',
        '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
        '012E01', '011D01', '011301'
    ]

    # Visualize NDVI and clip it strictly to the park boundary
    ndvi_viz = ndvi.clip(park).visualize(min=0.0, max=0.8, palette=ndvi_palette)

    # Create an empty byte image for outlines
    empty = ee.Image().byte()

    # Paint the state outline
    state_outline = empty.paint(state, 1, 2).selfMask().visualize(palette=['0000FF'])
    
    # Paint the park outline (using red to contrast with the green NDVI)
    park_outline = empty.paint(park, 1, 2).selfMask().visualize(palette=['FF0000'])

    # 4. Blend all layers together
    # Basemap -> NDVI overlay -> Park Outline -> State Outline
    final_img = s2_basemap.blend(ndvi_viz).blend(park_outline).blend(state_outline)

    # Generate the image URL
    url = final_img.getThumbURL({
        'dimensions': 1000,
        'region': state.geometry().bounds(),
        'format': 'jpg'
    })
    
    print("Downloading NDVI map image from GEE servers...")
    response = requests.get(url, stream=True)
    
    if response.status_code == 200:
        with open('Assam_Kaziranga_NDVI_Map.jpg', 'wb') as f:
            response.raw.decode_content = True
            shutil.copyfileobj(response.raw, f)
        print("Download complete! Saved as 'Assam_Kaziranga_NDVI_Map.jpg'.")
    else:
        print("Failed to download the image.")

if __name__ == '__main__':
    main()