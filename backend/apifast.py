from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from supabase_utils import supabase 
from h3 import grid_disk
import json
from pathlib import Path


app = FastAPI(title="AmenityGap Opportunity Score API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



class SpilloverConfig(BaseModel):
    ring1: float = 0.5
    ring2: float = 0.2

class ScoreRequest(BaseModel):
    amenity_type: str
    resolution: int = 8
    amenity_weights: dict[str, float] = {}     
    borough_multipliers: dict[str, float] = {}  
    min_land_fraction: float = 0.25
    min_population: float = 500
    daytime_weight: float = 0.0                
    demand_spillover: SpilloverConfig = SpilloverConfig()
    supply_spillover: SpilloverConfig = SpilloverConfig()


def fetch_all(table: str, select: str, filters: dict = {}) -> list[dict]:
    """Paginate through any Supabase table and return all rows."""
    limit = 1000
    offset = 0
    all_data = []

    while True:
        q = supabase.table(table).select(select).range(offset, offset + limit - 1)
        for col, val in filters.items():
            q = q.eq(col, val)
        res = q.execute()
        batch = res.data or []
        all_data.extend(batch)
        if len(batch) < limit:
            break
        offset += limit

    return all_data

CACHE_DIR = Path(__file__).parent / "cache"

def load_cell_metadata() -> list[dict]:
    with open(CACHE_DIR / "cell-metadata.json") as f:
        raw = json.load(f)

    return [
        {
            "h3_index": k,
            "borough": v["borough"],
            "land_fraction": v["land_fraction"],
            "resolution": v["resolution"]
        }
        for k, v in raw.items()
    ]


def calculate_scores(
    amenities: list[dict],
    population_data: list[dict],
    jobs_data: list[dict],
    cell_metadata: list[dict],
    amenity_type: str,
    resolution: int,
    config: ScoreRequest,
) -> dict[str, Optional[int]]:

    h3_key = f"h3_res{resolution}"
    ideal_ratio = config.amenity_weights.get(amenity_type, 2000)

   
    counts: dict[str, int] = {}
    for a in amenities:
        cell = a.get(h3_key)
        if cell:
            counts[cell] = counts.get(cell, 0) + 1

    pop_lookup: dict[str, float] = {r["h3_index"]: r["population"] for r in population_data}
    jobs_lookup: dict[str, float] = {r["h3_index"]: r["jobs"] for r in jobs_data}

    def blended_pop(cell: str) -> float:
        residents = pop_lookup.get(cell, 0)
        workers = jobs_lookup.get(cell, 0)
        return (1 - config.daytime_weight) * residents + config.daytime_weight * workers

    scores: dict[str, Optional[int]] = {}

    for meta in cell_metadata:
        if int(meta["resolution"]) != resolution:
            continue

        cell_id = meta["h3_index"]

        if meta["land_fraction"] < config.min_land_fraction:
            scores[cell_id] = None
            continue

    
        disk2 = grid_disk(cell_id, 2)
        disk1_set = set(grid_disk(cell_id, 1))

        ring1_demand = ring2_demand = 0.0
        ring1_supply = ring2_supply = 0.0

        for neighbor in disk2:
            if neighbor == cell_id:
                continue
            is_ring1 = neighbor in disk1_set
            d = blended_pop(neighbor)
            s = counts.get(neighbor, 0)
            if is_ring1:
                ring1_demand += d
                ring1_supply += s
            else:
                ring2_demand += d
                ring2_supply += s

        own_demand = blended_pop(cell_id)
        effective_demand = (
            own_demand
            + config.demand_spillover.ring1 * ring1_demand
            + config.demand_spillover.ring2 * ring2_demand
        )

        
        if effective_demand < config.min_population:
            scores[cell_id] = None
            continue

        
        multiplier = config.borough_multipliers.get(meta.get("borough", ""), 1.0)
        effective_pop = effective_demand * multiplier

        
        own_supply = counts.get(cell_id, 0)
        effective_supply = (
            own_supply
            + config.supply_spillover.ring1 * ring1_supply
            + config.supply_spillover.ring2 * ring2_supply
        )

        # Gap score clamped to [-100, 100]
        expected_need = effective_pop / ideal_ratio
        gap = expected_need - effective_supply
        raw = (gap / max(expected_need, 0.01)) * 100
        scores[cell_id] = max(-100, min(100, round(raw)))

    return scores



@app.get("/")
def root():
    return {"status": "AmenityGap scoring API is running"}


@app.get("/test")
def test():
    """Quick sanity check — confirms Supabase connection works."""
    try:
        data = supabase.table("amenities").select("*").limit(1).execute()
        return {"ok": True, "sample": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/opportunity-scores")
def opportunity_scores(req: ScoreRequest):
    if req.resolution not in (7, 8, 9):
        raise HTTPException(status_code=400, detail="resolution must be 7, 8, or 9")

    amenities       = fetch_all("amenities", "*", {"amenity_type": req.amenity_type})
    population_data = fetch_all(f"h3_population_res{req.resolution}", "h3_index,population")
    jobs_data       = fetch_all(f"h3_jobs_res{req.resolution}", "h3_index,jobs")
    cell_metadata = load_cell_metadata()
    
    if not amenities:
        raise HTTPException(status_code=404, detail=f"No amenities found for '{req.amenity_type}'")

    scores = calculate_scores(
        amenities=amenities,
        population_data=population_data,
        jobs_data=jobs_data,
        cell_metadata=cell_metadata,
        amenity_type=req.amenity_type,
        resolution=req.resolution,
        config=req,
    )

    return {
        "resolution": req.resolution,
        "amenity_type": req.amenity_type,
        "scores": scores,
    }


@app.get("/api/opportunity-scores")
def opportunity_scores_get(
    amenity_type: str = Query(...),
    resolution: int = Query(8),
    min_land_fraction: float = Query(0.25),
    min_population: float = Query(500),
    daytime_weight: float = Query(0.0),
):
    """GET version with defaults — useful for quick browser testing."""
    req = ScoreRequest(
        amenity_type=amenity_type,
        resolution=resolution,
        min_land_fraction=min_land_fraction,
        min_population=min_population,
        daytime_weight=daytime_weight,
    )
    return opportunity_scores(req)