import geopandas as gpd
import pandas as pd
import requests, h3pandas, h3, os
from shapely.geometry import Polygon
from supabase import create_client, Client
from dotenv import load_dotenv


load_dotenv() 

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)


def push_to_supabase(df, table_name):
    data = df.to_dict(orient='records')
    try:
        response = supabase.table(table_name).upsert(
            data,
            on_conflict="h3_index"
        ).execute()
        print(f"  Successfully pushed {len(data)} rows to {table_name}!")
        return response
    except Exception as e:
        print(f"  Error pushing to Supabase: {e}")

def run():

    # Read govt file
    print("Loading census tract geometries...")
    geo = gpd.read_file('./data_exploration/data/2020_Census_Tracts_20260318.geojson')

    # Fetch pop data for NYC from census API
    print("\nFetching population data from Census API...")
    url = (
        "https://api.census.gov/data/2020/dec/pl"
        "?get=P1_001N,NAME"
        "&for=tract:*"
        "&in=state:36+county:005,047,061,081,085"
    )

    r = requests.get(url)
    data = r.json()

    pop = pd.DataFrame(data[1:], columns=data[0])

    # Make pop DF to map Tract GeoID <-> population
    pop['geoid'] = pop['state'] + pop['county'] + pop['tract']
    pop['population'] = pop['P1_001N'].astype(int)

    pop = pop[['geoid', 'population']]

    # Merge pop & tract geometry
    gdf = geo.merge(pop, on='geoid', how='left')

    # === Prep for intersection on all resolutions === #

    # Get NY State Plane in feet
    gdf_proj = gdf.to_crs(epsg=2263) 

    # Bound area to limit num of cells we calculate for
    nyc_wgs84 = gdf.union_all().convex_hull

    tract_areas = gdf_proj[['geoid', 'geometry']].copy()
    tract_areas['tract_area'] = tract_areas.geometry.area

    # === Calculate pop for res 7, 8, 9 === #

    H3_AREA_KM2 = {7: 5.1613, 8: 0.7373, 9: 0.1053}

    for res in [7, 8, 9]:
        print(f"\nProcessing H3 resolution {res}...")
        
        print(f"  Generating H3 cells...")
        cells = h3.geo_to_cells(nyc_wgs84.__geo_interface__, res=res)

        hex_geoms = [Polygon([(lng, lat) for lat, lng in h3.cell_to_boundary(c)]) for c in cells]
        gdf_hex = gpd.GeoDataFrame({'h3_index': list(cells), 'geometry': hex_geoms}, crs='EPSG:4326')
        gdf_hex = gdf_hex.to_crs(epsg=2263)
        print(f"  H3 cells generated: {len(gdf_hex)}")

        print(f"  Running intersection (this may take a moment)...")
        intersected = gdf_hex.overlay(gdf_proj[['geoid', 'population', 'geometry']], how='intersection')
        intersected['fragment_area'] = intersected.geometry.area
        intersected = intersected.merge(tract_areas[['geoid', 'tract_area']], on='geoid')
        intersected['pop_fragment'] = intersected['population'] * (intersected['fragment_area'] / intersected['tract_area'])

        gdf_h3_pop = (
            intersected
            .groupby('h3_index')['pop_fragment']
            .sum()
            .reset_index()
            .rename(columns={'pop_fragment': 'population'})
        )

        gdf_h3_pop = gdf_hex.merge(gdf_h3_pop, on='h3_index', how='left')
        gdf_h3_pop['population'] = gdf_h3_pop['population'].fillna(0)

        # Calculate pop density km2 
        gdf_h3_pop['density'] = (gdf_h3_pop['population'] / H3_AREA_KM2[res]).round(2)

        gdf_h3_pop['population'] = gdf_h3_pop['population'].round(0).astype(int)
        out = gdf_h3_pop[gdf_h3_pop['population'] >= 1][['h3_index', 'population', 'density']]
        # out = gdf_h3_pop[gdf_h3_pop['population'] > 0][['h3_index', 'population']]

        print(f"  Total population: {out['population'].sum():,.0f} ({out['population'].sum() / 8_804_190 * 100:.2f}%)")
        print(f"  Total H3 cells: {out.shape[0]}")

        print("  Pushing to Supabase...")
        push_to_supabase(out, f"h3_population_res{res}")
        print("  Done!")

    print("\nAll resolutions complete.")

if __name__ == "__main__":
    run()
