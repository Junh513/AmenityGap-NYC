import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadAllH3Layers, showResolution, setH3Opacity } from './h3Layer'
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
  const [layersReady, setLayersReady] = useState(false)

  const handleResetView = () => {
    if (!mapRef.current) return
    mapRef.current.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM })
  }

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM
    })

    mapRef.current.on('load', async () => {
      await loadAllH3Layers(mapRef.current)
      setLayersReady(true)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    if (showH3) {
      showResolution(mapRef.current, resolution)
    } else {
      showResolution(mapRef.current, null)
    }
  }, [resolution, showH3, layersReady])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    setH3Opacity(mapRef.current, opacity)
  }, [opacity, layersReady])

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
          <label><strong>Show H3 Grid</strong></label>
          <br />
          <input
            type="checkbox"
            checked={showH3}
            onChange={(e) => setShowH3(e.target.checked)}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label><strong>Resolution: {pendingResolution}</strong></label>
          <br />
          <input
            type="range"
            min="7"
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
          <label><strong>Opacity: {opacity.toFixed(2)}</strong></label>
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