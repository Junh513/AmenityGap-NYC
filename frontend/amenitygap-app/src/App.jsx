import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { addH3Layer } from './h3Layer'
import './App.css'

function App() {
  const mapRef = useRef()
  const mapContainerRef = useRef()

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-73.9712, 40.6842],
      zoom: 11.5
    });

    mapRef.current.on('load', async () => {
      const res = await fetch('/nyc-boroughs.geojson');
      const nycBoundary = await res.json();
      addH3Layer(mapRef.current, nycBoundary);
    });

    return () => {
      mapRef.current.remove()
    }
  }, [])

  return (
    <div id='map-container' ref={mapContainerRef}/>
  )
}

export default App