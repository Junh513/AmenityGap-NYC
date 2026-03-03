import requests, os, h3
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv


### SETUP OVERPASS ###
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

overpass_query = """
[out:json][timeout:25];
area(3600175905)->.searchArea;
(
  node["shop"="laundry"](area.searchArea);
  way["shop"="laundry"](area.searchArea);
  node["amenity"="washing-machine"](area.searchArea);
);
out center;
"""

### SETUP SUPABASE ###
load_dotenv() 

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)



def fetch_and_index_laundry():
    print("Trying to pull laundry data from Overpass-Turbo API")
    response = requests.post(OVERPASS_URL, data={'data': overpass_query})
    
    if response.status_code == 200:
        data = response.json()
        elements = data.get('elements', [])
        
        processed_data = []
        for e in elements:
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            
            processed_data.append({
                'osm_id': e['id'],
                'name': e.get('tags', {}).get('name', 'Unknown'),
                'lat': lat,
                'lng': lon,
                'amenity_type': 'laundry'
            })
            
        df = pd.DataFrame(processed_data)
    
        df['h3_res7'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 7), axis=1)
        df['h3_res8'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 8), axis=1)
        df['h3_res9'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 9), axis=1)

        final = df[['osm_id', 'name', 'amenity_type', 'lat', 'lng', 'h3_res7', 'h3_res8', 'h3_res9']]
        row_num = final.shape[0]
        print(f"Successfully retrieved {row_num} results")
        return final
    else:
        print(f"Error: {response.status_code}")
        return None



def push_to_supabase(df):
    data = df.to_dict(orient='records')

    try:
        response = supabase.table("amenities").upsert(
            data, 
            on_conflict="osm_id"
        ).execute()
        
        print(f"Successfully pushed {len(data)} rows to Supabase!")
        return response
    except Exception as e:
        print(f"Error pushing to Supabase: {e}")

def run():
    df = fetch_and_index_laundry()
    # df.to_csv("./data/laundry_etl.csv", index=False, encoding='utf-8')

    if df is not None:
        push_to_supabase(df)
    else:
        print("Abort: Failed to fetch data")

if __name__ == "__main__":
    run()
