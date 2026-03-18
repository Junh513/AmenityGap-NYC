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
        .setHTML(`<b>H3:</b> ${f.properties.h3}<br/><b>Score:</b> ${f.properties.score}`)
        .addTo(map);
    });

    map.on("mouseenter", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", `h3-fill-${res}`, () => (map.getCanvas().style.cursor = ""));
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