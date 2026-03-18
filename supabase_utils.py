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
    Fetches all records for a specific amenity type from Supabase.
    """
    try:
        print(f"Fetching {amenity_type} from Supabase...")
        
        res = supabase.table("amenities") \
            .select("*") \
            .eq("amenity_type", amenity_type) \
            .execute()
        
        return res.data
        
    except Exception as e:
        print(f"Error retrieving data: {e}")
        return []

if __name__ == "__main__":  
    amenity_type = "laundry" # or "pharmacy" / "deli"
    test_data = get_amenities_by_type(amenity_type)
    
    if test_data:
        df = pd.DataFrame(test_data)
        print(f"\n--- Top 5 Records for {amenity_type.upper()} ---")
        print(df.head())
        print(f"\nTotal Records: {len(df)}")
        print(f"Columns: {list(df.columns)}")
    else:
        print(f"No data found for {amenity_type}. Did you run the ETL first?")
