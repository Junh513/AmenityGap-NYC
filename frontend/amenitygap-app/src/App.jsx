import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { addH3Layer } from './h3Layer'
import './App.css'

const INITIAL_CENTER = [-73.9712, 40.6842]
const INITIAL_ZOOM = 11.5

function App() {
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)

  const [showH3, setShowH3] = useState(true)
  const [opacity, setOpacity] = useState(0.35)
  const [resolution, setResolution] = useState(7)
  const [pendingResolution, setPendingResolution] = useState(7)
  const [nycBoundary, setNycBoundary] = useState(null)

  const handleResetView = () => {
    if (!mapRef.current) return

    mapRef.current.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM
    })
  }

  // Create the map once
  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM
    })

    mapRef.current.on('load', async () => {
      const res = await fetch('/nyc-boroughs.geojson')
      const boundaryData = await res.json()
      setNycBoundary(boundaryData)
      addH3Layer(mapRef.current, boundaryData, resolution)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update H3 opacity whenever opacity changes
  useEffect(() => {
    if (!mapRef.current) return
    if (!mapRef.current.getLayer('h3-fill')) return

    mapRef.current.setPaintProperty('h3-fill', 'fill-opacity', opacity)
  }, [opacity])

  // Show or hide the H3 layer whenever showH3 changes
  useEffect(() => {
    if (!mapRef.current) return
    if (!mapRef.current.getLayer('h3-fill')) return
    if (!mapRef.current.getLayer('h3-outline')) return

    const visibility = showH3 ? 'visible' : 'none'

    mapRef.current.setLayoutProperty('h3-fill', 'visibility', visibility)
    mapRef.current.setLayoutProperty('h3-outline', 'visibility', visibility)
  }, [showH3])

  // Rebuild the H3 layer whenever resolution changes
  useEffect(() => {
    if (!mapRef.current) return
    if (!nycBoundary) return
    if (!mapRef.current.isStyleLoaded()) return

    if (mapRef.current.getLayer('h3-fill')) mapRef.current.removeLayer('h3-fill')
    if (mapRef.current.getLayer('h3-outline')) mapRef.current.removeLayer('h3-outline')
    if (mapRef.current.getSource('h3-hexes')) mapRef.current.removeSource('h3-hexes')

    addH3Layer(mapRef.current, nycBoundary, resolution)
  }, [resolution, nycBoundary])

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1,
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          width: '220px',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <h3 style={{ marginTop: 0 }}>H3 Control Panel</h3>

        <div style={{ marginBottom: '16px' }}>
          <label>
            <strong>Show H3 Grid</strong>
          </label>
          <br />
          <input
            type="checkbox"
            checked={showH3}
            onChange={(e) => setShowH3(e.target.checked)}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
           <strong>Resolution: {pendingResolution}</strong>
          </label>
          <br />
          <input
           type="range"
            min="6"
            max="9"
            step="1"
            value={pendingResolution}
            onChange={(e) => setPendingResolution(Number(e.target.value))}
            onMouseUp={() => setResolution(pendingResolution)}
            onTouchEnd={() => setResolution(pendingResolution)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            <strong>Opacity: {opacity.toFixed(2)}</strong>
          </label>
          <br />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={handleResetView}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#1f4ed8',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Reset View
          </button>
        </div>
      </div>

      <div id='map-container' ref={mapContainerRef} />
    </>
  )
}

export default App