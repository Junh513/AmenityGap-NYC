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

export function loadAllH3Layers(map, darkMode = true) {
  for (const res of ALL_RESOLUTIONS) {
    const sourceId = `h3-hexes-${res}`;

    map.addSource(sourceId, {
      type: 'vector',
      url: `mapbox://${TILESET_IDS[res]}`,
      promoteId: 'h3',
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
          'case',
          // Greyed out: score set to -999
          ['==', ['coalesce', ['feature-state', 'score'], -998], -999],
          'rgba(80, 80, 80, 0.4)',
          // Has valid score: color by opportunity
          ['!=', ['coalesce', ['feature-state', 'score'], -998], -998],
          [
            'interpolate',
            ['linear'],
            ['feature-state', 'score'],
            -100, '#67001f',
            -75, '#d73027',
            -50, '#f46d43',
            -30, '#fdae61',
            -10, '#fee08b',
            0, '#ffffbf',
            10, '#d9ef8b',
            30, '#91cf60',
            50, '#66bd63',
            75, '#1a9850',
            100, '#006837',
          ],
          // No score yet: amenity count fallback
          [
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
        'line-color': darkMode ? '#ffffff' : '#888888',
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

      const pop = f.state?.population;
      const popText = pop != null ? `<br/><b>Population:</b> ${Math.round(pop).toLocaleString()}` : '';

      const score = f.state?.score;
      let scoreText = '';
      if (score === -999) {
        scoreText = '<br/><b>Opportunity:</b> <i>Excluded</i>';
      } else if (score != null) {
        scoreText = `<br/><b>Opportunity Score:</b> ${score}`;
      }

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`${scoreText}<br/><b>H3:</b> ${f.properties.h3}<br/><b>Borough:</b> ${f.properties.borough || 'Unknown'}<br/><b>Land:</b> ${Math.round((f.properties.land_fraction || 0) * 100)}%<br/><b>${amenityLabel}:</b> ${count}${popText}`)
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

    const counts = {};
    for (const a of amenities) {
      const cell = a[h3Key];
      if (cell) counts[cell] = (counts[cell] || 0) + 1;
    }

    const prevCounted = map._h3Counted?.[res] || new Set();
    for (const cellId of prevCounted) {
      map.setFeatureState(
        { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[res], id: cellId },
        { count: 0, amenityType: '' }
      );
    }

    const nowCounted = new Set();
    for (const [cellId, count] of Object.entries(counts)) {
      map.setFeatureState(
        { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[res], id: cellId },
        { count, amenityType: amenityType || '' }
      );
      nowCounted.add(cellId);
    }

    map._h3Counted = map._h3Counted || {};
    map._h3Counted[res] = nowCounted;
  }
}

export function applyOpportunityScores(map, scores, resolution) {
  const sourceId = `h3-hexes-${resolution}`;
  if (!map.getSource(sourceId)) return;

  // Clear previous scores
  const prevScored = map._h3Scored?.[resolution] || new Set();
  for (const cellId of prevScored) {
    map.removeFeatureState(
      { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[resolution], id: cellId },
      'score'
    );
  }

  const nowScored = new Set();
  for (const [cellId, score] of Object.entries(scores)) {
    // null = doesn't meet criteria → grey out with -999
    const val = score === null ? -999 : score;
    map.setFeatureState(
      { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[resolution], id: cellId },
      { score: val }
    );
    nowScored.add(cellId);
  }

  map._h3Scored = map._h3Scored || {};
  map._h3Scored[resolution] = nowScored;
}

export function applyPopulationData(map, popRows, resolution) {
  const sourceId = `h3-hexes-${resolution}`;
  if (!map.getSource(sourceId)) return;
  for (const { h3_index, population } of popRows) {
    map.setFeatureState(
      { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[resolution], id: h3_index },
      { population }
    );
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