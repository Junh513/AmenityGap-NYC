import mapboxgl from "mapbox-gl";

const ALL_RESOLUTIONS = [7, 8, 9];

const TILESET_IDS = {
  7: 'jhe513.53dq11td',
  8: 'jhe513.3czwq5v0',
  9: 'jhe513.9jzhyvtz',
};

const SOURCE_LAYER_NAMES = {
  7: 'h3-res-7-dfd6ps',
  8: 'h3-res-8-5fxdbq',
  9: 'h3-res-9-9yggdz',
};

const TILESET_MAXZOOM = {
  7: 10,
  8: 10,
  9: 12,
};

export function loadAllH3Layers(map, darkMode = true, onCellClick) {
  for (const res of ALL_RESOLUTIONS) {
    const sourceId = `h3-hexes-${res}`;

    map.addSource(sourceId, {
      type: 'vector',
      url: `mapbox://${TILESET_IDS[res]}`,
      promoteId: 'h3',   // Use h3 cell ID as the feature ID for feature-state
      maxzoom: TILESET_MAXZOOM[res],
    });

    map.addLayer({
      id: `h3-fill-${res}`,
      type: 'fill',
      source: sourceId,
      'source-layer': SOURCE_LAYER_NAMES[res],
      layout: { visibility: res === 7 ? 'visible' : 'none' },
      paint: {
        'fill-color': [
          'step',
          ['coalesce', ['feature-state', 'count'], 0],
          'rgba(0,0,0,0)',
          1, '#e6d280',
          5, '#d4b44a',
          10, '#c49620',
          20, '#d4820a',
          35, '#fd8d3c',
          50, '#fc4e2a',
          70, '#e31a1c',
          90, '#800026',
        ],
        'fill-opacity': 0.45,
        'fill-antialias': true,
      },
    });

    map.addLayer({
      id: `h3-outline-${res}`,
      type: 'line',
      source: sourceId,
      'source-layer': SOURCE_LAYER_NAMES[res],
      layout: { visibility: res === 7 ? 'visible' : 'none' },
      paint: {
        'line-color':darkMode ? '#ffffff' : '#888888',
        'line-width': 0.3,
        'line-opacity': 0.5,
      },
    });

    map.on('click', `h3-fill-${res}`, (e) => {
      const points = map.queryRenderedFeatures(e.point, { layers: ['amenity-points'] });
      if (points.length > 0) return;

      const f = e.features?.[0];
      if (!f) return;

      const count = f.state?.count || 0;
      const amenityType = f.state?.amenityType || '';
      const amenityLabel = amenityType
        ? amenityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Amenities';

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <h3 style="text-align:center; margin-bottom:8px; font-size:1rem; border-bottom: 1px solid rgba(255,255,255,0.4); padding-bottom:6px;">Neighborhood Info</h3>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>H3 Cell</b> <span>${f.properties.h3}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>Amenity Type</b> <span>${amenityLabel}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b># of Amenity</b> <span>${count}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <b>Population</b> <span>Coming soon</span>
          </div>
        `)
        .addTo(map);
    });
  }
}

export function applyAmenityData(map, amenities, amenityType) {
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

    // Reset all feature states first
    map.removeFeatureState({ source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[res] });

    // Set count on each cell that has amenities
    for (const [cellId, count] of Object.entries(counts)) {
      map.setFeatureState(
        { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[res], id: cellId },
        { count, amenityType: amenityType || '' }
      );
    }
  }
}

export function showResolution(map, resolution) {
  for (const res of ALL_RESOLUTIONS) {
    const visibility = res === resolution ? 'visible' : 'none';
    if (map.getLayer(`h3-fill-${res}`)) map.setLayoutProperty(`h3-fill-${res}`, 'visibility', visibility);
    if (map.getLayer(`h3-outline-${res}`)) map.setLayoutProperty(`h3-outline-${res}`, 'visibility', visibility);
  }
}

export function setH3Opacity(map, opacity) {
  for (const res of ALL_RESOLUTIONS) {
    if (map.getLayer(`h3-fill-${res}`)) map.setPaintProperty(`h3-fill-${res}`, 'fill-opacity', opacity);
  }
}