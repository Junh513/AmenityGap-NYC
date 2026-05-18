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
          ['==', ['coalesce', ['feature-state', 'score'], -998], -999],
          'rgba(80, 80, 80, 0.4)',
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
          [
            'step',
            ['coalesce', ['feature-state', 'count'], 0],
            'rgba(0,0,0,0)',
            1, '#fff8f0',
            5, '#fcd9b0',
            10, '#f4a460',
            20, '#d4742a',
            35, '#a84a10',
            50, '#7a2e08',
            70, '#4a1200',
            90, '#2a0800',
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

    const layerId = `h3-fill-${res}`;
    map._h3ClickHandlers = map._h3ClickHandlers || {};
    if (map._h3ClickHandlers[layerId]) {
      map.off('click', layerId, map._h3ClickHandlers[layerId]);
    }
    const clickHandler = (e) => {
      const overlayLayers = ['amenity-points', 'search-points'].filter(l => map.getLayer(l));
      const points = overlayLayers.length ? map.queryRenderedFeatures(e.point, { layers: overlayLayers }) : [];
      if (points.length > 0) return;

      const f = e.features?.[0];
      if (!f) return;

      const count = f.state?.count || 0;
      const amenityType = f.state?.amenityType || '';
      const amenityLabel = amenityType
        ? amenityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Amenities';

      const pop = f.state?.population;
      const jobs = f.state?.jobs;
      const score = f.state?.score;

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <h3 style="text-align:center; margin-bottom:8px; font-size:1rem; border-bottom: 1px solid rgba(255,255,255,0.4); padding-bottom:6px;">Neighborhood Info</h3>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>H3 Cell:</b> <span>${f.properties.h3}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>Borough:</b> <span>${f.properties.borough || 'Unknown'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>Land:</b> <span>${Math.round((f.properties.land_fraction || 0) * 100)}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b># of ${amenityLabel}:</b> <span>${count}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>Workers:</b> <span>${jobs != null ? Math.round(jobs).toLocaleString() : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <b>Population:</b> <span>${pop != null ? Math.round(pop).toLocaleString() : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <b>Opportunity Score:</b> <span>${score === -999 ? '<i>Excluded</i>' : (score != null ? score : '—')}</span>
          </div>
        `)
        .addTo(map);
    };
    map._h3ClickHandlers[layerId] = clickHandler;
    map.on('click', layerId, clickHandler);
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

export function applyJobsData(map, jobRows, resolution) {
  const sourceId = `h3-hexes-${resolution}`;
  if (!map.getSource(sourceId)) return;
  for (const { h3_index, jobs } of jobRows) {
    map.setFeatureState(
      { source: sourceId, sourceLayer: SOURCE_LAYER_NAMES[resolution], id: h3_index },
      { jobs }
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

