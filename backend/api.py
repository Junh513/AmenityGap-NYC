from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
import logging
import numpy as np
from supabase_utils import supabase

logger = logging.getLogger(__name__)

app = FastAPI(title="AmenityGap NYC - Opportunity Score API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

POPULATION_TABLE_MAP = {
    7: "h3_population_res7",
    8: "h3_population_res8",
    9: "h3_population_res9",
}

JOBS_TABLE_MAP = {
    7: "h3_jobs_res7",
    8: "h3_jobs_res8",
    9: "h3_jobs_res9",
}

AMENITY_H3_COLUMN_MAP = {
    7: "h3_res7",
    8: "h3_res8",
    9: "h3_res9",
}

class AmenityType(str, Enum):
    deli = "deli"
    laundry = "laundry"
    pharmacy = "pharmacy"
    barber = "barber"
    gas_station = "gas_station"

BATCH_SIZE = 200


def compute_score(
    population: float,
    jobs: float,
    amenity_count: int,
    weight: float,
    borough_mult: float,
    daytime_weight: float,
    demand_spillover_pop: float,
    demand_spillover_jobs: float,
    supply_spillover: float,
) -> float:

    blended_demand = (
        population * (1 - daytime_weight)
        + jobs * daytime_weight
        + demand_spillover_pop * (1 - daytime_weight)
        + demand_spillover_jobs * daytime_weight
    ) * borough_mult

    effective_supply = amenity_count + supply_spillover

    ideal_amenities = blended_demand / weight if weight > 0 else 0

    gap = ideal_amenities - effective_supply

    return max(0.0, round(gap, 4))


def assign_label(score: float, p33: float, p66: float) -> str:
    if score <= 0:
        return "Excluded"
    if score < p33:
        return "Low"
    if score < p66:
        return "Medium"
    return "High"


def fetch_amenity_counts_batched(
    h3_ids: list[str],
    amenity: AmenityType,
    resolution: int,
) -> dict[str, int]:

    amenity_map: dict[str, int] = {}

    h3_column = AMENITY_H3_COLUMN_MAP[resolution]

    for i in range(0, len(h3_ids), BATCH_SIZE):

        chunk = h3_ids[i:i + BATCH_SIZE]

        resp = (
            supabase.table("amenities")
            .select(h3_column)
            .eq("amenity_type", amenity.value)
            .in_(h3_column, chunk)
            .execute()
        )

        for row in resp.data:

            h3_id = row[h3_column]

            amenity_map[h3_id] = (
                amenity_map.get(h3_id, 0) + 1
            )

    return amenity_map


@app.get("/test")
def test():

    try:

        data = (
            supabase.table("amenities")
            .select("*")
            .limit(1)
            .execute()
        )

        return data.data

    except Exception:

        logger.exception(
            "Supabase connectivity test failed"
        )

        raise HTTPException(
            status_code=500,
            detail="Database connectivity check failed"
        )


@app.get("/opportunity-score")
def get_score(
    h3: str,
    amenity: AmenityType,
    resolution: int = 8,
    weight: float = 2000.0,
    daytime_weight: float = 0.5,
    borough_mult: float = 1.0,
):

    try:

        h3_column = AMENITY_H3_COLUMN_MAP[resolution]

        pop_table = POPULATION_TABLE_MAP[resolution]

        jobs_table = JOBS_TABLE_MAP[resolution]

        pop_data = (
            supabase.table(pop_table)
            .select("h3_index, population")
            .eq("h3_index", h3)
            .execute()
        )

        jobs_data = (
            supabase.table(jobs_table)
            .select("h3_index, jobs")
            .eq("h3_index", h3)
            .execute()
        )

        amenity_data = (
            supabase.table("amenities")
            .select(h3_column)
            .eq(h3_column, h3)
            .eq("amenity_type", amenity.value)
            .execute()
        )

        population = (
            pop_data.data[0]["population"]
            if pop_data.data else 0
        )

        jobs = (
            jobs_data.data[0]["jobs"]
            if jobs_data.data else 0
        )

        amenity_count = len(amenity_data.data)

        score = compute_score(
            population=population,
            jobs=jobs,
            amenity_count=amenity_count,
            weight=weight,
            borough_mult=borough_mult,
            daytime_weight=daytime_weight,
            demand_spillover_pop=0,
            demand_spillover_jobs=0,
            supply_spillover=0,
        )

        return {
            "h3": h3,
            "population": population,
            "jobs": jobs,
            "amenity_count": amenity_count,
            "score": score,
        }

    except HTTPException:
        raise

    except Exception:

        logger.exception(
            "Error computing score for h3=%s amenity=%s",
            h3,
            amenity
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to compute opportunity score"
        )


class BoroughMultiplier(BaseModel):
    borough: str
    multiplier: float = Field(1.0, ge=0.0, le=5.0)


class SpilloverRings(BaseModel):
    ring1: float = Field(0.5, ge=0.0, le=1.0)
    ring2: float = Field(0.2, ge=0.0, le=1.0)


class BulkScoreRequest(BaseModel):
    amenity: AmenityType
    resolution: int = Field(8, ge=7, le=9)
    min_population: int = Field(500, ge=0)
    weight: float = Field(2000.0, ge=0.0)
    daytime_weight: float = Field(0.5, ge=0.0, le=1.0)
    borough_multipliers: list[BoroughMultiplier] = []
    demand_spillover: SpilloverRings = SpilloverRings()
    supply_spillover: SpilloverRings = SpilloverRings()


@app.post("/opportunity-score/bulk")
def get_bulk_scores(req: BulkScoreRequest):

    try:

        pop_table = POPULATION_TABLE_MAP[req.resolution]

        jobs_table = JOBS_TABLE_MAP[req.resolution]

        pop_resp = (
            supabase.table(pop_table)
            .select("h3_index, population")
            .gte("population", req.min_population)
            .execute()
        )

        cells = pop_resp.data

        if not cells:

            return {
                "amenity": req.amenity,
                "total_cells": 0,
                "cells": []
            }

        h3_ids = [c["h3_index"] for c in cells]

        jobs_map: dict[str, float] = {}

        for i in range(0, len(h3_ids), BATCH_SIZE):

            chunk = h3_ids[i:i + BATCH_SIZE]

            resp = (
                supabase.table(jobs_table)
                .select("h3_index, jobs")
                .in_("h3_index", chunk)
                .execute()
            )

            for row in resp.data:

                jobs_map[row["h3_index"]] = row["jobs"]

        amenity_map = fetch_amenity_counts_batched(
            h3_ids,
            req.amenity,
            req.resolution
        )

        borough_mult_map = {
            bm.borough: bm.multiplier
            for bm in req.borough_multipliers
        }

        results = []

        raw_scores = []

        for cell in cells:

            h3_id = cell["h3_index"]

            population = cell.get("population", 0)

            jobs = jobs_map.get(h3_id, 0)

            amenity_count = amenity_map.get(h3_id, 0)

            borough_mult = borough_mult_map.get(
                cell.get("borough", "Unknown"),
                1.0
            )

            score = compute_score(
                population=population,
                jobs=jobs,
                amenity_count=amenity_count,
                weight=req.weight,
                borough_mult=borough_mult,
                daytime_weight=req.daytime_weight,
                demand_spillover_pop=0,
                demand_spillover_jobs=0,
                supply_spillover=0,
            )

            raw_scores.append(score)

            results.append({
                "h3": h3_id,
                "population": population,
                "jobs": jobs,
                "amenity_count": amenity_count,
                "score": score,
                "label": "",
            })

        positive_scores = [
            s for s in raw_scores if s > 0
        ]

        if positive_scores:

            arr = np.array(positive_scores)

            p33 = float(
                np.percentile(arr, 33)
            )

            p66 = float(
                np.percentile(arr, 66)
            )

        else:

            p33 = 0.0

            p66 = 0.0

        for cell, score in zip(results, raw_scores):

            cell["label"] = assign_label(
                score,
                p33,
                p66
            )

        return {
            "amenity": req.amenity,
            "resolution": req.resolution,
            "total_cells": len(results),
            "cells": results,
        }

    except HTTPException:
        raise

    except Exception:

        logger.exception(
            "Error computing bulk scores for amenity=%s",
            req.amenity
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to compute bulk opportunity scores"
        )