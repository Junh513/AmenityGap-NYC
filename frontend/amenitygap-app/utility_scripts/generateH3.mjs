// ONLY RUN THIS IF BORDERS NEED TO BE REGENERATED
import { polygonToCells, cellToBoundary, cellToLatLng } from "h3-js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { readFileSync, writeFileSync } from "fs";

const nycBoundary = JSON.parse(readFileSync("public/nyc-boroughs.geojson", "utf-8"));

const NYC_BOUNDS = [
  [-74.27, 40.49],
  [-73.68, 40.49],
  [-73.68, 40.92],
  [-74.27, 40.92],
  [-74.27, 40.49],
];

for (const resolution of [7, 8, 9]) {
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

  const features = filtered.map((cell, index) => {
    const boundary = cellToBoundary(cell, true);
    const ring = boundary.map(([lng, lat]) => [lng, lat]);

    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }

    return {
      type: "Feature",
      id: index,
      properties: { h3: cell },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });

  const geojson = { type: "FeatureCollection", features };
  writeFileSync(`public/h3-res-${resolution}.json`, JSON.stringify(geojson));
  console.log(`Resolution ${resolution}: ${filtered.length} cells`);
}