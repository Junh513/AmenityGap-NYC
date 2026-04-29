import { polygonToCells, cellToBoundary, cellToLatLng } from "h3-js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon, featureCollection } from "@turf/helpers";
import area from "@turf/area";
import intersect from "@turf/intersect";
import { readFileSync, writeFileSync } from "fs";

const nycBoundary = JSON.parse(readFileSync("public/nyc-boroughs.geojson", "utf-8"));

const NYC_BOUNDS = [
  [-74.27, 40.49],
  [-73.68, 40.49],
  [-73.68, 40.92],
  [-74.27, 40.92],
  [-74.27, 40.49],
];

// Detect borough for a given lat/lng
function getBorough(lat, lng) {
  const pt = point([lng, lat]);
  for (const feature of nycBoundary.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return feature.properties.boroname || "Unknown";
    }
  }
  return "Unknown";
}

// Calculate what fraction of a hex cell is land (overlaps with NYC boroughs)
function getLandFraction(hexCoords) {
  // Close the ring if needed
  const ring = [...hexCoords];
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push(ring[0]);
  }

  const hexPoly = turfPolygon([ring]);
  const hexArea = area(hexPoly);

  if (hexArea === 0) return 0;

  let landArea = 0;

  for (const feature of nycBoundary.features) {
    try {
      const clipped = intersect(featureCollection([hexPoly, feature]));
      if (clipped) {
        landArea += area(clipped);
      }
    } catch {
      // Skip invalid geometries
    }
  }

  return Math.min(landArea / hexArea, 1.0);
}

const allMetadata = {};

for (const resolution of [7, 8, 9]) {
  console.log(`\nProcessing resolution ${resolution}...`);

  const cells = polygonToCells([NYC_BOUNDS], resolution, true);

  const filtered = cells.filter((cell) => {
    const [lat, lng] = cellToLatLng(cell);
    const pt = point([lng, lat]);
    for (const feature of nycBoundary.features) {
      if (booleanPointInPolygon(pt, feature)) return true;
    }
    const boundary = cellToBoundary(cell, true);
    for (const [vLng, vLat] of boundary) {
      const vPt = point([vLng, vLat]);
      for (const feature of nycBoundary.features) {
        if (booleanPointInPolygon(vPt, feature)) return true;
      }
    }
    return false;
  });

  console.log(`Filtered to ${filtered.length} cells`);

  const features = filtered.map((cell, index) => {
    const boundary = cellToBoundary(cell, true);
    const ring = boundary.map(([lng, lat]) => [lng, lat]);

    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }

    const [lat, lng] = cellToLatLng(cell);
    const borough = getBorough(lat, lng);
    const landFraction = getLandFraction(ring);

    allMetadata[cell] = {
      borough,
      land_fraction: Math.round(landFraction * 1000) / 1000,
      resolution,
    };

    if ((index + 1) % 100 === 0) {
      console.log(`  Processed ${index + 1}/${filtered.length} cells`);
    }

    return {
      type: "Feature",
      id: index,
      properties: {
        h3: cell,
        borough,
        land_fraction: Math.round(landFraction * 1000) / 1000,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });

  const geojson = { type: "FeatureCollection", features };
  writeFileSync(`public/h3-res-${resolution}.json`, JSON.stringify(geojson));
  console.log(`Resolution ${resolution}: ${filtered.length} cells written`);
}

writeFileSync(`backend/cache/cell-metadata.json`, JSON.stringify(allMetadata));
console.log(`\nCell metadata saved: ${Object.keys(allMetadata).length} total cells`);
console.log("Done");