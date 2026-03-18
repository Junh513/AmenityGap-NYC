import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

# Initialize the client once
supabase: Client = create_client(URL, KEY)

def get_amenities_by_type(amenity_type: str):
    """
    Fetches ALL records for a specific amenity type from Supabase using pagination.
    """
    all_data = []
    limit = 1000
    offset = 0
    
    try:
        print(f"Fetching {amenity_type} from Supabase...")
        
        while True:
            res = supabase.table("amenities") \
                .select("*") \
                .eq("amenity_type", amenity_type) \
                .range(offset, offset + limit - 1) \
                .execute()
            
            batch = res.data
            
            if not batch:
                break
                
            all_data.extend(batch)
            print(f"  > Progress: {len(all_data)} rows collected...")

            if len(batch) < limit:
                break
            
            offset += limit
            
        return all_data
        
    except Exception as e:
        print(f"Error retrieving data: {e}")
        return []


if __name__ == "__main__":  

    test_type = "deli" 
    data = get_amenities_by_type(test_type)
    
    if data:
        df = pd.DataFrame(data)
        print(f"\n--- TEST SUCCESS ---")
        print(f"Category: {test_type.upper()}")
        print(f"Total Records: {len(df)}")
        
        if len(df) > 1000:
            print("✅ Pagination logic is working (found > 1000 rows).")
        
        print(f"Columns: {list(df.columns)}")
        print(df.head(3))
    else:
        print(f"No data found for {test_type}. Check your Supabase table!")