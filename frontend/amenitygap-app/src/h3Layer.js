import mapboxgl from "mapbox-gl";

const ALL_RESOLUTIONS = [7, 8, 9];

export async function loadAllH3Layers(map) {
  for (const res of ALL_RESOLUTIONS) {
    const response = await fetch(`/h3-res-${res}.json`);
    const geojson = await response.json();

    map.addSource(`h3-hexes-${res}`, { type: "geojson", data: geojson });

    map.addLayer({
      id: `h3-fill-${res}`,
      type: "fill",
      source: `h3-hexes-${res}`,
      layout: { visibility: res === 7 ? "visible" : "none" },
      paint: {
        "fill-color": [
          "step",
          ["get", "count"],
          "rgba(0,0,0,0)",       // 0 = transparent
          1, "#e6d280",           // 1+
          5, "#d4b44a",           // 5+
          10, "#c49620",          // 10+
          20, "#d4820a",          // 20+
          35, "#fd8d3c",          // 35+
          50, "#fc4e2a",          // 50+
          70, "#e31a1c",          // 70+
          90, "#800026",          // 90+
        ],
        "fill-opacity": 0.45,
      },
    });

    map.addLayer({
      id: `h3-outline-${res}`,
      type: "line",
      source: `h3-hexes-${res}`,
      layout: { visibility: res === 7 ? "visible" : "none" },
      paint: { "line-color": "#ffffff", "line-width": 0.3, "line-opacity":0.5 },
    });

    map.on("click", `h3-fill-${res}`, (e) => {
      // Check if an amenity point is clicked
      const points = map.queryRenderedFeatures(e.point, { layers: ['amenity-points'] })
      if (points.length > 0) return

      const f = e.features?.[0];
      if (!f) return;
      const amenityLabel = f.properties.amenityType
        ? f.properties.amenityType.charAt(0).toUpperCase() + f.properties.amenityType.slice(1)
        : "Amenities";
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<b>H3:</b> ${f.properties.h3}<br/><b>${amenityLabel}:</b> ${f.properties.count}`)
        .addTo(map);
    });

    map.on("mouseenter", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = ""));
  }
}

export function applyAmenityData(map, amenities, amenityType) {
  for (const res of ALL_RESOLUTIONS) {
    const sourceId = `h3-hexes-${res}`;
    const source = map.getSource(sourceId);
    if (!source) continue;

    const h3Key = `h3_res${res}`;

    const counts = {};
    for (const a of amenities) {
      const cell = a[h3Key];
      if (cell) counts[cell] = (counts[cell] || 0) + 1;
    }

    const geojson = source._data;
    for (const feature of geojson.features) {
      feature.properties.count = counts[feature.properties.h3] || 0;
      feature.properties.amenityType = amenityType || "";
    }

    source.setData(geojson);
  }
}

export function showResolution(map, resolution) {
  for (const res of ALL_RESOLUTIONS) {
    const visibility = res === resolution ? "visible" : "none";
    if (map.getLayer(`h3-fill-${res}`)) map.setLayoutProperty(`h3-fill-${res}`, "visibility", visibility);
    if (map.getLayer(`h3-outline-${res}`)) map.setLayoutProperty(`h3-outline-${res}`, "visibility", visibility);
  }
}

export function setH3Opacity(map, opacity) {
  for (const res of ALL_RESOLUTIONS) {
    if (map.getLayer(`h3-fill-${res}`)) map.setPaintProperty(`h3-fill-${res}`, "fill-opacity", opacity);
  }
}