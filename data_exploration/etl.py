import requests, os, argparse, h3
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

AMENITY_CONFIG = {
    'laundry': 'node["shop"="laundry"](area.searchArea); way["shop"="laundry"](area.searchArea); node["amenity"="washing-machine"](area.searchArea);',
    'pharmacy': 'node["amenity"="pharmacy"](area.searchArea); way["amenity"="pharmacy"](area.searchArea);',
    'deli': 'node["shop"="deli"](area.searchArea); way["shop"="deli"](area.searchArea); node["shop"="convenience"](area.searchArea);'
}

### SETUP SUPABASE ###
load_dotenv() 

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)
    

def fetch_and_index(dynamic_query, amenity_type):
    print(f"Trying to pull {amenity_type} data from Overpass-Turbo API...")

    # print(f"\n\nquery:\n{dynamic_query}\n\n")
    
    response = requests.post(OVERPASS_URL, data={'data': dynamic_query})
    
    if response.status_code == 200:
        data = response.json()
        elements = data.get('elements', [])
        
        processed_data = []
        for e in elements:
            # Need to handle ways and nodes differently
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            
            if lat is None or lon is None:
                continue

            processed_data.append({
                'osm_id': e['id'],
                'name': e.get('tags', {}).get('name', 'Unknown'),
                'lat': lat,
                'lng': lon,
                'amenity_type': amenity_type
            })
            
        if not processed_data:
            print(f"No results found for {amenity_type}.")
            return None

        df = pd.DataFrame(processed_data)
    
        # H3 indexing at 3 resolutions
        df['h3_res7'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 7), axis=1)
        df['h3_res8'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 8), axis=1)
        df['h3_res9'] = df.apply(lambda x: h3.latlng_to_cell(x.lat, x.lng, 9), axis=1)

        final = df[['osm_id', 'name', 'amenity_type', 'lat', 'lng', 'h3_res7', 'h3_res8', 'h3_res9']]
        
        print(f"Successfully retrieved and indexed {len(final)} {amenity_type} results")
        return final
    else:
        print(f"Error: Overpass API returned status {response.status_code}")
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

# def run():
#     parser = argparse.ArgumentParser(description="NYC Amenity ETL Ingestor")
#     parser.add_argument("--type", help="Amenity type to fetch (laundry, pharmacy, deli)", required=True)
#     args = parser.parse_args()

#     osm_filter = AMENITY_CONFIG.get(args.type)

#     if not osm_filter:
#         print(f"Error: Type '{args.type}' is not supported yet.")
#         return
    
#     dynamic_query = f"""
#         [out:json][timeout:90];
#         area(3600175905)->.searchArea;
#         (
#         {osm_filter}
#         );
#         out center;
#     """

#     df = fetch_and_index(dynamic_query, args.type)

#     if df is not None:
#         # df.to_csv("./data/laundry_etl.csv", index=False, encoding='utf-8')
#         push_to_supabase(df)
#     else:
#         print("Abort: Failed to fetch data")


def run():
    parser = argparse.ArgumentParser(description="NYC Amenity ETL Ingestor")
    parser.add_argument("--type", help="Amenity type (laundry, pharmacy, deli, or 'all')", required=True)
    args = parser.parse_args()

    # Determine which types to process
    types_to_run = AMENITY_CONFIG.keys() if args.type == "all" else [args.type]

    for amt_type in types_to_run:
        osm_filter = AMENITY_CONFIG.get(amt_type)

        if not osm_filter:
            print(f"Error: Type '{amt_type}' is not supported.")
            continue
        
        # Build query for THIS specific type
        dynamic_query = f"""
            [out:json][timeout:90];
            area(3600175905)->.searchArea;
            ({osm_filter});
            out center;
        """

        print(f"\n--- Starting ETL for: {amt_type} ---")
        df = fetch_and_index(dynamic_query, amt_type)

        if df is not None:
            push_to_supabase(df)
        else:
            print(f"Skipping {amt_type}: Fetch failed.")


if __name__ == "__main__":
    run()
