import { useEffect, useRef } from "react";

/*
    mapbox gl js library to display the interactive library
*/
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

/*
    the latLngToCell converts (lat,lng,resolution) into an H3 hex cell 
    the gridDisk gets a “disk” of hex cells around a center cell 
    the cellToBoundary gets the corner points of a hex cell so we can draw it as a polygon 
*/
import { latLngToCell, gridDisk, cellToBoundary } from "h3-js";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
// mapbox access token to load map 

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,        // the div element to mount the map into
      style: "mapbox://styles/mapbox/standard",     // Mapbox base map style
      center: [-73.98, 40.75],          // starting position [lng, lat] (nyc)
      zoom: 10.5,                       // starting zoom level
    });

    // Save the map instance so we can reuse it later
    mapRef.current = map;

    
    map.on("load", () => {
    /*
    H3 resolution controls hex size:
        lower = bigger hexes
        higher = smaller hexes
    */
    
        const H3_RES = 7;

        // H3 uses (lat, lng) order for latLngToCell
        // gives the H3 cell id that contains the center point of nyc 

      const centerCell = latLngToCell(40.75, -73.98, H3_RES);

      // the bigger radius the more hexes are drawn
      const radius = 30;
      
      // Generated the set of H3 cell IDs in a disk around the center cell

      const cells = gridDisk(centerCell, radius);

      console.log("H3 center cell:", centerCell);
      console.log("H3 cells generated:", cells.length);
    
      // this converts each H3 cell into a a polygon which is a GeoJSON Feature
      const features = cells.map((cell) => {
       
        /*
        this gets the hexagon boundary corners for this cell so when geoJson=true 
        the h3-js returns coordinates in [lng, lat] order,
        */
        const boundaryLngLat = cellToBoundary(cell, true);

        /*
            GeoJSON polygons match the last and first cooridnate  
            check if he ring is already closed 
        */
        const ring =
          boundaryLngLat[0][0] === boundaryLngLat[boundaryLngLat.length - 1][0] &&
          boundaryLngLat[0][1] === boundaryLngLat[boundaryLngLat.length - 1][1]
            ? boundaryLngLat
            : [...boundaryLngLat, boundaryLngLat[0]];

        /*
        mock score for coloring
        i created a fake reate a fake score so the hex colors can vary
        which is just demo data not real score 
        */

        const score = (parseInt(cell.slice(-3), 16) % 50) + 1;

        return {
          type: "Feature",
          properties: { h3: cell, score },
          geometry: { type: "Polygon", coordinates: [ring] },
        };
      });

    // Wrap all features into a FeatureCollection
      const hexGeojson = { type: "FeatureCollection", features };

      if (map.getLayer("h3-fill")) map.removeLayer("h3-fill");
      if (map.getLayer("h3-outline")) map.removeLayer("h3-outline");
      if (map.getSource("h3-hexes")) map.removeSource("h3-hexes");

    // adds the hex FeatureCollection as a Mapbox data source
    
        map.addSource("h3-hexes", { type: "geojson", data: hexGeojson });

    // adds a fill color to each of the hexs
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

      //an outline layer so the hex borders are visible
      map.addLayer({
        id: "h3-outline",
        type: "line",
        source: "h3-hexes",
        paint: { "line-color": "#111", "line-width": 1 },
      });

 // CLICK INTERACTION: when  a user clicks a hex a popup shows with the cell id + score

      map.on("click", "h3-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<b>H3:</b> ${f.properties.h3}<br/><b>Score:</b> ${f.properties.score}`)
          .addTo(map);
      });

// Change mouse cursor to a pointer when hovering over a hex

      map.on("mouseenter", "h3-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "h3-fill", () => (map.getCanvas().style.cursor = ""));
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}