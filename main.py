import ee
import requests
import shutil
import zipfile
import io
import os

# Initialize the Earth Engine module.
try:
    ee.Initialize(project='meet-attendance-500308')
except Exception as e:
    ee.Authenticate()
    ee.Initialize(project='meet-attendance-500308')

def download_shapefile(fc, folder_name):
    print(f"Downloading shapefile for {folder_name}...")
    url = fc.getDownloadURL(filetype='shp')
    response = requests.get(url)
    
    if response.status_code == 200:
        os.makedirs(folder_name, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(folder_name)
        print(f"Successfully extracted {folder_name} shapefiles to local folder.")
    else:
        print(f"Failed to download {folder_name}.")

def main():
    print("Fetching boundaries for Assam and Kaziranga...")

    # 1. Define the Vector Geometries
    state = ee.FeatureCollection("FAO/GAUL/2015/level1") \
        .filter(ee.Filter.eq('ADM0_NAME', 'India')) \
        .filter(ee.Filter.eq('ADM1_NAME', 'Assam'))

    park = ee.FeatureCollection("WCMC/WDPA/current/polygons") \
        .filter(ee.Filter.Or(
            ee.Filter.stringContains('NAME', 'Kaziranga'),
            ee.Filter.stringContains('ORIG_NAME', 'Kaziranga')
        ))

    # 2. Download the .shp files locally
    download_shapefile(state, "Assam_State_Boundary")
    download_shapefile(park, "Kaziranga_National_Park")

    # 3. Generate the Superimposed JPEG with Sentinel-2 Basemap
    print("Generating the superimposed JPEG with Sentinel-2 basemap...")
    
    # Fetch Sentinel-2 Surface Reflectance imagery
    # Filtering for the dry season to minimize cloud cover
    s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterBounds(state.geometry()) \
        .filterDate('2025-10-01', '2026-03-31') \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    
    # Create a median composite to remove clouds, clip to state bounds, and visualize in True Color
    s2_basemap = s2_collection.median().clip(state).visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000)

    empty = ee.Image().byte()

    # Paint the state outline
    state_outline = empty.paint(state, 1, 2) \
        .selfMask() \
        .visualize(palette=['0000FF'])

    # Paint the park fill
    park_fill = empty.paint(park, 1) \
        .selfMask() \
        .visualize(palette=['00FF00'])

    # Blend layers: Sentinel-2 Basemap -> State Outline -> Park Fill
    superimposed_img = s2_basemap.blend(state_outline).blend(park_fill)

    # Generate the image URL
    url = superimposed_img.getThumbURL({
        'dimensions': 1000,
        'region': state.geometry().bounds(),
        'format': 'jpg'
    })
    
    print("Downloading satellite map image from GEE servers...")
    response = requests.get(url, stream=True)
    
    if response.status_code == 200:
        with open('Assam_Kaziranga_Map_Satellite.jpg', 'wb') as f:
            response.raw.decode_content = True
            shutil.copyfileobj(response.raw, f)
        print("Download complete! Saved as 'Assam_Kaziranga_Map_Satellite.jpg' in your current directory.")
    else:
        print("Failed to download the image.")

if __name__ == '__main__':
    main()