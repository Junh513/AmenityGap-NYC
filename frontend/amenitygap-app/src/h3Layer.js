import { polygonToCells, cellToBoundary, cellToLatLng } from "h3-js";
import mapboxgl from "mapbox-gl";
import { point } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const NYC_BOUNDS = [
  [-74.27, 40.49],
  [-73.68, 40.49],
  [-73.68, 40.92],
  [-74.27, 40.92],
  [-74.27, 40.49],
];

//const H3_RES = 7;

export function addH3Layer(map, nycBoundary, resolution = 7)  {
  const cells = polygonToCells([NYC_BOUNDS], resolution, true);
  
  const filtered = cells.filter((cell) => {
  // Check center
  const [lat, lng] = cellToLatLng(cell);
  const pt = point([lng, lat]);
  for (const feature of nycBoundary.features) {
    if (booleanPointInPolygon(pt, feature)) return true;
  }
  // Check vertices
  const boundary = cellToBoundary(cell, true);
  for (const [vLng, vLat] of boundary) {
    const vPt = point([vLng, vLat]);
    for (const feature of nycBoundary.features) {
      if (booleanPointInPolygon(vPt, feature)) return true;
    }
  }
  return false;
});

  const features = filtered.map((cell) => {
    const boundary = cellToBoundary(cell, true);

    const ring =
      boundary[0][0] === boundary[boundary.length - 1][0] &&
      boundary[0][1] === boundary[boundary.length - 1][1]
        ? boundary
        : [...boundary, boundary[0]];

    const score = (parseInt(cell.slice(-3), 16) % 50) + 1;

    return {
      type: "Feature",
      properties: { h3: cell, score },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });

  const geojson = { type: "FeatureCollection", features };

  map.addSource("h3-hexes", { type: "geojson", data: geojson });

  map.addLayer({
    id: "h3-fill",
    type: "fill",
    source: "h3-hexes",
    paint: {
      "fill-color": [
        "step",
        ["get", "score"],
        "#ffffcc",
        10, "#a1dab4",
        20, "#41b6c4",
        30, "#2c7fb8",
        40, "#253494",
      ],
      "fill-opacity": 0.35,
    },
  });

  map.addLayer({
    id: "h3-outline",
    type: "line",
    source: "h3-hexes",
    paint: { "line-color": "#111", "line-width": 1 },
  });

  map.on("click", "h3-fill", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<b>H3:</b> ${f.properties.h3}<br/><b>Score:</b> ${f.properties.score}`)
      .addTo(map);
  });

  map.on("mouseenter", "h3-fill", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "h3-fill", () => (map.getCanvas().style.cursor = ""));
}