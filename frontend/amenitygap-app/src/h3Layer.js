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
        1, "#fed976",           // 1+  yellow
        3, "#fd8d3c",           // 3+  orange
        5, "#e31a1c",           // 5+  red
        8, "#bd0026",           // 8+  dark red
        12, "#800026",          // 12+ deep crimson
      ],
        "fill-opacity": 0.75,
      },
    });

    map.addLayer({
      id: `h3-outline-${res}`,
      type: "line",
      source: `h3-hexes-${res}`,
      layout: { visibility: res === 7 ? "visible" : "none" },
      paint: { "line-color": "#111", "line-width": 1 },
    });

    map.on("click", `h3-fill-${res}`, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<b>H3:</b> ${f.properties.h3}<br/><b>Laundromats:</b> ${f.properties.count}`)
        .addTo(map);
    });

    map.on("mouseenter", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = ""));
  }
}

export function applyAmenityData(map, amenities) {
  for (const res of ALL_RESOLUTIONS) {
    const sourceId = `h3-hexes-${res}`;
    const source = map.getSource(sourceId);
    if (!source) continue;

    const h3Key = `h3_res${res}`;

    // Count amenities per cell
    const counts = {};
    for (const a of amenities) {
      const cell = a[h3Key];
      if (cell) counts[cell] = (counts[cell] || 0) + 1;
    }

    // Get current geojson and update counts
    const geojson = source._data;
    for (const feature of geojson.features) {
      feature.properties.count = counts[feature.properties.h3] || 0;
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