import pandas as pd
import h3, os
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
    print("Cooking up job data...")
    wac = pd.read_csv('./data_exploration/data/wac_929fc6875af39f9b861b90560a08aa7c.csv')
    xw = pd.read_csv('./data_exploration/data/xwalk_929fc6875af39f9b861b90560a08aa7c.csv')

    wac = wac[wac['segment'] == 'S000'][['w_geocode', 'C000']]
    xw = xw[['tabblk2020', 'cty', 'blklatdd', 'blklondd']]

    nyc_counties = [36005, 36047, 36061, 36081, 36085]
    xw = xw[xw['cty'].isin(nyc_counties)]

    df = wac.merge(xw, left_on='w_geocode', right_on='tabblk2020', how='inner')

    H3_AREA_KM2 = {7: 5.1613, 8: 0.7373, 9: 0.1053}

    for res in [7, 8, 9]:
        print(f"\nProcessing H3 resolution {res}...")
        df[f'h3_res{res}'] = df.apply(
            lambda row: h3.latlng_to_cell(row['blklatdd'], row['blklondd'], res), axis=1
        )
        out = (
            df.groupby(f'h3_res{res}')['C000']
            .sum()
            .reset_index()
            .rename(columns={f'h3_res{res}': 'h3_index', 'C000': 'jobs'})
        )
        out['density'] = (out['jobs'] / H3_AREA_KM2[res]).round(2)
        out['jobs'] = out['jobs'].round(0).astype(int)
        print(f"  Cells: {len(out)}, Total jobs: {out['jobs'].sum():,}")
        print("  Pushing to Supabase...")
        push_to_supabase(out, f"h3_jobs_res{res}")
        print("  Done!")

    print("Cooking up MTA ridership data...")
    mta = pd.read_csv('./data_exploration/data/mta_ridership_q1_2024.csv')
    mta['total_ridership'] = (mta['total_ridership'] / 90).round(0)

    for res in [7, 8, 9]:
        print(f"\nProcessing MTA H3 resolution {res}...")
        mta[f'h3_res{res}'] = mta.apply(
            lambda row: h3.latlng_to_cell(row['latitude'], row['longitude'], res), axis=1
        )
        out = (
            mta.groupby(f'h3_res{res}')['total_ridership']
            .sum()
            .reset_index()
            .rename(columns={f'h3_res{res}': 'h3_index', 'total_ridership': 'ridership'})
        )
        out['ridership'] = out['ridership'].round(0).astype(int)
        
        print(f"  Cells: {len(out)}, Total ridership: {out['ridership'].sum():,.0f}")
        push_to_supabase(out, f"h3_transit_res{res}")
        print("  Done!")

    print("\nAll resolutions complete.")

if __name__ == "__main__":
    run()